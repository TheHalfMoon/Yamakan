// Take compare and replace (YU-032). A story shot keeps its alternative
// takes (core/story.ts), each a project still or footage with an optional
// immutable lineage; the assembled timeline shot of the same id shows one
// of them. Listing and comparing takes read the head and change nothing. A
// replacement is first proposed: the exact clip mapping it would make,
// bound to the revision, the story version and the media versions, and
// named by its hash. Applying it recomputes the proposal at the head and
// commits only an identical one, as one undoable revision that changes
// that shot's clips and nothing else. A shot split or trimmed in the editor
// keeps its take replaceable: each of its clips keeps its own place in the
// take (MPR-105). Every take stays in the story and its media stays in the
// project, so undo returns exactly the old take.
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";
import { Id } from "./project.ts";
import { FLICKS_PER_SECOND, Ticks } from "./time.ts";
import type { CanonicalProject } from "./canonical.ts";
import type { DocumentRef } from "./document-ref.ts";
import { applyBatch, applyOne, type Operation } from "./timeline/operations.ts";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import type { StoryDocument } from "./story.ts";

export const TAKE_LIMITS = Object.freeze({
  // Takes compared at once (a shot holds at most 8).
  compare: 8,
  // The clips one replacement changes (the batch's own limit).
  mappings: 64,
  // Clips that show a take's media but belong to no shot, and their guesses.
  orphans: 64,
  orphanCandidates: 4,
});

type Story = StoryDocument;
type Shot = Story["scenes"][number]["shots"][number];
type Take = Shot["takes"][number];
type Clip = CanonicalProject["clips"][number];

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const ClipMedia = z
  .object({
    assetId: Id.nullable(),
    assetHash: Sha256.nullable(),
    title: z.string().max(500).nullable(),
    sourceStartTicks: Ticks,
  })
  .strict();

export const TakeProposalSchema = z
  .object({
    format: z.literal("yamakan.take-proposal"),
    formatVersion: z.literal(2),
    projectId: Id,
    revision: z.number().int().nonnegative(),
    documentId: Id,
    storyContentHash: Sha256,
    shotId: Id,
    takeId: Id,
    // In timeline order, then by clip id.
    mappings: z
      .array(
        z
          .object({
            clipId: Id,
            startTicks: Ticks,
            durationTicks: Ticks,
            // Where in the new take the clip starts.
            takeOffsetTicks: Ticks,
            from: ClipMedia,
            to: ClipMedia,
          })
          .strict(),
      )
      .min(1)
      .max(TAKE_LIMITS.mappings),
    proposalHash: Sha256,
  })
  .strict();
export type TakeProposal = z.infer<typeof TakeProposalSchema>;

// A proposal made by a page from before version 2, accepted only so that it can be
// refused in words: the page takes its own stale path and proposes again.
export const TakeProposalV1Schema = z
  .object({
    format: z.literal("yamakan.take-proposal"),
    formatVersion: z.literal(1),
    projectId: Id,
    revision: z.number().int().nonnegative(),
    documentId: Id,
    storyContentHash: Sha256,
    shotId: Id,
    takeId: Id,
    mappings: z
      .array(
        z
          .object({
            clipId: Id,
            startTicks: Ticks,
            durationTicks: Ticks,
            from: ClipMedia,
            to: ClipMedia,
          })
          .strict(),
      )
      .length(1),
    proposalHash: Sha256,
  })
  .strict();
export const TakeProposalInputSchema = z.discriminatedUnion("formatVersion", [
  TakeProposalV1Schema,
  TakeProposalSchema,
]);

const notFound = (message: string) => new CommandError("NOT_FOUND", message);
const invalid = (message: string) => new CommandError("VALIDATION", message);

function storyShot(story: Story, shotId: string) {
  for (const scene of story.scenes)
    for (const shot of scene.shots)
      if (shot.id === shotId) return { scene, shot };
  throw notFound("The story has no such shot.");
}

const byPlace = (
  a: { startTicks: number; id: string },
  b: { startTicks: number; id: string },
) => a.startTicks - b.startTicks || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// What a project's shots, clips and tracks are, read once.
function indexOf(project: CanonicalProject) {
  return {
    shots: new Map(
      project.scenes.flatMap((s) => s.shots.map((x) => [x.id, x] as const)),
    ),
    clips: new Map(project.clips.map((c) => [c.id, c])),
    tracks: new Map(project.tracks.map((t) => [t.id, t.kind])),
  };
}

/**
 * The clips that show a story shot on the timeline, in timeline order: those
 * of the timeline shot of the same id, on a video track. A shot not assembled
 * has none (null); one whose clips were all removed, are more than one
 * replacement changes, or are off video is refused.
 */
function shotClips(
  project: CanonicalProject,
  shotId: string,
  index = indexOf(project),
): Clip[] | null {
  const shot = index.shots.get(shotId);
  if (!shot) return null;
  if (!shot.clipIds.length)
    throw invalid(
      "The shot has no clip on the timeline; assemble it again or attach a clip.",
    );
  if (shot.clipIds.length > TAKE_LIMITS.mappings)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "The shot is shown by more than 64 clips; replace its takes in the editor.",
    );
  const clips = shot.clipIds.map((id) => {
    const clip = index.clips.get(id);
    if (!clip) throw invalid("The shot's clip is missing from the timeline.");
    if (index.tracks.get(clip.trackId) !== "video")
      throw invalid("The shot's clip is not on a video track.");
    return clip;
  });
  return clips.sort(byPlace);
}

const assetOf = (project: CanonicalProject, id: string | null) =>
  project.assets.find((a) => a.id === id) ?? null;

const NO_LONGER_SHOWS =
  "The shot's clip no longer shows one of this shot's takes; replace it in the editor.";
const SAME_MEDIA =
  "Two takes of this shot use the same media, so the clip's place in the take cannot be told; replace it in the editor.";

/**
 * The take of a shot that a clip shows, and how far into it the clip starts.
 * A take whose in-point is the clip's own is the one shown. Otherwise the
 * clip is that far into the only take of the shot with its media. A later
 * piece of a split shot whose in-point is a take's own can also be another
 * take of the same media, played on: which is not told, so it is refused.
 */
function shown(
  clip: Clip,
  takes: readonly Take[],
  later = false,
): { takeId: string; offsetTicks: number } | { reason: string } {
  if (clip.title !== null) return { reason: NO_LONGER_SHOWS };
  const same = takes.filter((t) => t.assetId === clip.assetId);
  const exact = same.find((t) => t.sourceStartTicks === clip.sourceStartTicks);
  if (exact)
    return later &&
      same.some((t) => t.sourceStartTicks < exact.sourceStartTicks)
      ? { reason: SAME_MEDIA }
      : { takeId: exact.id, offsetTicks: 0 };
  if (same.length > 1) return { reason: SAME_MEDIA };
  const take = same[0];
  if (!take || clip.sourceStartTicks < take.sourceStartTicks)
    return { reason: NO_LONGER_SHOWS };
  return {
    takeId: take.id,
    offsetTicks: clip.sourceStartTicks - take.sourceStartTicks,
  };
}

/**
 * How far into a footage take each of a shot's clips would start. A clip keeps
 * its offset in the take it shows. A still has none, so after a still a clip
 * starts where the shot's earlier clips ended: the footage runs on.
 */
function footageOffsets(
  project: CanonicalProject,
  clips: readonly Clip[],
  takes: readonly Take[],
): number[] {
  let before = 0;
  return clips.map((clip, i) => {
    const from = shown(clip, takes, i > 0);
    const still =
      clip.title === null && assetOf(project, clip.assetId)?.kind === "image";
    const offset = still ? before : "reason" in from ? 0 : from.offsetTicks;
    before += clip.durationTicks;
    return offset;
  });
}

// The take all of a shot's clips show, at some offset, or null.
function currentTake(clips: readonly Clip[], takes: readonly Take[]) {
  const ids = clips.map((clip, i) => {
    const s = shown(clip, takes, i > 0);
    return "reason" in s ? null : s.takeId;
  });
  return ids.length && ids.every((id) => id !== null && id === ids[0])
    ? ids[0]
    : null;
}

function clipMedia(project: CanonicalProject, clip: Clip) {
  return {
    assetId: clip.assetId,
    assetHash: assetOf(project, clip.assetId)?.hash ?? null,
    title: clip.title,
    sourceStartTicks: clip.sourceStartTicks,
  };
}

/** Every shot of a story with its takes and the take its clip shows. */
export function listTakes(
  story: Story,
  ref: DocumentRef,
  project: CanonicalProject,
) {
  const { orphans, total: orphanTotal } = orphansOf(story, project);
  const index = indexOf(project);
  return {
    documentId: ref.id,
    contentHash: ref.contentHash,
    revision: project.revision,
    // Clips that show a take's media and belong to no shot: attach one with
    // shot.update or shot.add. Nothing here changes them.
    orphans,
    orphanTotal,
    shots: story.scenes.flatMap((scene) =>
      scene.shots.map((shot) => {
        let clips: Clip[] | null = null;
        let problem: string | null = null;
        try {
          clips = shotClips(project, shot.id, index);
        } catch (e) {
          if (!(e instanceof CommandError)) throw e;
          problem = e.message;
        }
        const first = clips?.[0];
        return {
          sceneId: scene.id,
          shotId: shot.id,
          name: shot.name,
          durationTicks: shot.durationTicks,
          selectedTakeId: shot.selectedTakeId,
          // The first clip's own fields describe the shot as they always have.
          timeline:
            clips && first
              ? {
                  clipId: first.id,
                  startTicks: first.startTicks,
                  durationTicks: first.durationTicks,
                  ...clipMedia(project, first),
                  currentTakeId: currentTake(clips, shot.takes),
                  clips: clips.map((clip, i) => {
                    const s = shown(clip, shot.takes, i > 0);
                    const known = !("reason" in s);
                    return {
                      clipId: clip.id,
                      startTicks: clip.startTicks,
                      durationTicks: clip.durationTicks,
                      assetId: clip.assetId,
                      sourceStartTicks: clip.sourceStartTicks,
                      takeId: known ? s.takeId : null,
                      takeOffsetTicks: known ? s.offsetTicks : null,
                    };
                  }),
                }
              : null,
          problem,
          takes: shot.takes.map((t) => {
            const asset = assetOf(project, t.assetId);
            return {
              id: t.id,
              assetId: t.assetId,
              assetHash: asset?.hash ?? null,
              kind: asset?.kind ?? null,
              sourceStartTicks: t.sourceStartTicks,
              lineage: t.lineage ?? null,
            };
          }),
        };
      }),
    ),
  };
}

/**
 * Side-by-side facts about some of a shot's takes, without changing
 * anything: each take's media version and size, whether it covers the
 * shot's clip, and a small preview to show for it. Footage is previewed by
 * its indexed thumbnail (a 90-pixel JPEG drawn from the edit proxy when
 * there is one), never by decoding the original here.
 */
export function compareTakes(
  story: Story,
  ref: DocumentRef,
  project: CanonicalProject,
  shotId: string,
  takeIds: string[],
) {
  const { shot } = storyShot(story, shotId);
  if (new Set(takeIds).size !== takeIds.length)
    throw invalid("Each take is compared once.");
  const clips = shotClips(project, shot.id);
  const offsets = clips ? footageOffsets(project, clips, shot.takes) : [];
  // How far into a footage take the shot's clips reach, in all, and how long they play.
  const reach = clips
    ? Math.max(...clips.map((c, i) => offsets[i]! + c.durationTicks))
    : shot.durationTicks;
  const length = clips
    ? clips.reduce((sum, c) => sum + c.durationTicks, 0)
    : shot.durationTicks;
  const from = clips ? Math.min(...offsets) : 0;
  const current = clips ? currentTake(clips, shot.takes) : null;
  return {
    documentId: ref.id,
    contentHash: ref.contentHash,
    revision: project.revision,
    shotId: shot.id,
    clipId: clips?.[0]?.id ?? null,
    durationTicks: length,
    takes: takeIds.map((takeId) => {
      const take = shot.takes.find((t) => t.id === takeId);
      if (!take) throw notFound("The shot has no such take.");
      const asset = assetOf(project, take.assetId);
      const sourceTicks = asset?.kind === "video" ? asset.durationTicks : null;
      const seconds =
        sourceTicks === null
          ? 0
          : Math.max(1, Math.ceil(sourceTicks / FLICKS_PER_SECOND));
      return {
        takeId: take.id,
        current: current === take.id,
        assetId: take.assetId,
        assetHash: asset?.hash ?? null,
        kind: asset?.kind ?? null,
        width: asset?.width ?? null,
        height: asset?.height ?? null,
        hasAudio: asset?.hasAudio ?? null,
        sourceStartTicks: take.sourceStartTicks,
        sourceDurationTicks: sourceTicks,
        covers:
          asset?.kind === "image"
            ? take.sourceStartTicks === 0
            : asset?.kind === "video" &&
              take.sourceStartTicks + reach <= asset.durationTicks,
        // The second in the middle of what the shot's clips would play of it.
        preview:
          asset?.kind === "video"
            ? {
                type: "thumbnail" as const,
                assetId: asset.id,
                index: Math.min(
                  seconds - 1,
                  Math.floor(
                    (take.sourceStartTicks + (from + reach) / 2) /
                      FLICKS_PER_SECOND,
                  ),
                ),
              }
            : asset?.kind === "image"
              ? { type: "still" as const, assetId: asset.id }
              : null,
        lineage: take.lineage ?? null,
      };
    }),
  };
}

/**
 * Clips on a video track, not titles, that show the media of one of the
 * story's takes and are in no shot: each with the shots and takes it may belong to.
 */
function orphansOf(story: Story, project: CanonicalProject) {
  const takesOf = new Map<string, { shotId: string; takeId: string }[]>();
  for (const scene of story.scenes)
    for (const shot of scene.shots)
      for (const take of shot.takes) {
        const list = takesOf.get(take.assetId) ?? [];
        list.push({ shotId: shot.id, takeId: take.id });
        takesOf.set(take.assetId, list);
      }
  const held = new Set(
    project.scenes.flatMap((s) => s.shots.flatMap((x) => x.clipIds)),
  );
  const video = new Set(
    project.tracks.filter((t) => t.kind === "video").map((t) => t.id),
  );
  const found = project.clips
    .filter(
      (c) =>
        c.title === null &&
        c.assetId !== null &&
        video.has(c.trackId) &&
        !held.has(c.id) &&
        takesOf.has(c.assetId),
    )
    .sort(byPlace);
  return {
    total: found.length,
    orphans: found.slice(0, TAKE_LIMITS.orphans).map((c) => ({
      clipId: c.id,
      startTicks: c.startTicks,
      durationTicks: c.durationTicks,
      assetId: c.assetId!,
      candidates: takesOf
        .get(c.assetId!)!
        .slice(0, TAKE_LIMITS.orphanCandidates),
    })),
  };
}

/** The operations a proposal makes: each of the shot's clips shows the take. */
export const replaceOperations = (p: TakeProposal): Operation[] =>
  p.mappings.map((m) => ({
    type: "clip.replaceMedia",
    clipId: m.clipId,
    assetId: m.to.assetId!,
    sourceStartTicks: m.to.sourceStartTicks,
  }));

/**
 * The exact replacement that would make a shot's clips show one of its
 * takes, each keeping its place on the timeline and in the take, at this
 * revision of this story version. It is checked by applying it to a copy of
 * the head, so a proposal that is made can be applied while nothing it names
 * has changed.
 */
export function proposeReplace(
  story: Story,
  ref: DocumentRef,
  project: CanonicalProject,
  projectId: string,
  shotId: string,
  takeId: string,
): TakeProposal {
  const { shot } = storyShot(story, shotId);
  const take = shot.takes.find((t) => t.id === takeId);
  if (!take) throw notFound("The shot has no such take.");
  const clips = shotClips(project, shot.id);
  if (!clips)
    throw invalid("Assemble the story before replacing a shot's take.");
  const single = clips.length === 1;
  const refuse = (index: number, reason: string): never => {
    throw invalid(
      single
        ? reason
        : `Clip ${index + 1} of ${clips.length} of this shot: ${reason}`,
    );
  };
  // The clips are this story shot's: a title card or ones showing its takes (a
  // shot id alone could be another story's shot of the same id).
  if (clips.some((c) => c.title !== null) && !single)
    throw invalid(
      "The shot's title card was split; replace its clips in the editor.",
    );
  clips.forEach((clip, i) => {
    if (clip.title !== null) return;
    const s = shown(clip, shot.takes, i > 0);
    if ("reason" in s) refuse(i, s.reason);
  });
  const asset = assetOf(project, take.assetId);
  if (!asset) throw notFound("The take's media is no longer in this project.");
  if (asset.kind === "audio")
    throw invalid("A take is a still or footage of this project.");
  if (take.lineage && take.lineage.outputHash !== asset.hash)
    throw invalid("The take does not match its recorded media version.");
  const offsets = footageOffsets(project, clips, shot.takes);
  // Which of the shot's clips each mapping is about, for a refusal's words.
  const places: number[] = [];
  const mappings = clips.flatMap((clip, index) => {
    const takeOffsetTicks = asset.kind === "image" ? 0 : offsets[index]!;
    const to = {
      assetId: asset.id,
      assetHash: asset.hash,
      title: null,
      sourceStartTicks: take.sourceStartTicks + takeOffsetTicks,
    };
    const there =
      clip.title === null &&
      clip.assetId === to.assetId &&
      clip.sourceStartTicks === to.sourceStartTicks;
    if (!there) places.push(index);
    return there
      ? []
      : [
          {
            clipId: clip.id,
            startTicks: clip.startTicks,
            durationTicks: clip.durationTicks,
            takeOffsetTicks,
            from: clipMedia(project, clip),
            to,
          },
        ];
  });
  if (!mappings.length) throw invalid("The shot already shows this take.");
  const body = {
    format: "yamakan.take-proposal" as const,
    formatVersion: 2 as const,
    projectId,
    revision: project.revision,
    documentId: ref.id,
    storyContentHash: ref.contentHash,
    shotId: shot.id,
    takeId: take.id,
    mappings,
  };
  const proposal = { ...body, proposalHash: sha256Hex(canonicalJson(body)) };
  // Refusals (a locked track, a retimed clip, unlinked sound, a take shorter
  // than the clip) come now, not at apply, and name the clip they are about.
  const operations = replaceOperations(proposal);
  try {
    applyBatch(project, operations);
  } catch (e) {
    if (single || !(e instanceof CommandError)) throw e;
    // The batch names an operation, not a clip: try each clip alone, in order, and say
    // which is refused. Unlinked sound is found by its media, so that refusal can name
    // a clip whose own sound is linked.
    operations.forEach((operation, i) => {
      try {
        applyOne(project, operation);
        applyBatch(project, [operation]);
      } catch (x) {
        if (x instanceof CommandError) refuse(places[i]!, x.message);
        throw x;
      }
    });
    throw e;
  }
  return proposal;
}

/**
 * Inside the commit: a take's media is this project's ready object at its
 * version, with the probe recorded at import, before a clip shows it.
 */
export function assertTakeMedia(
  db: DatabaseSync,
  projectId: string,
  asset: { id: string; hash: string; bytes: number },
) {
  const row = db
    .prepare(
      "SELECT v.project_id, v.digest, v.probe, o.byte_length, o.state FROM asset_versions v JOIN asset_objects o ON o.project_id = v.project_id AND o.digest = v.digest WHERE v.version_id = ?",
    )
    .get(asset.id) as
    | {
        project_id: string;
        digest: string;
        probe: string | null;
        byte_length: number;
        state: string;
      }
    | undefined;
  if (
    !row ||
    row.project_id !== projectId ||
    row.digest !== asset.hash ||
    row.state !== "ready" ||
    row.byte_length !== asset.bytes
  )
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "The take's media is missing, damaged or not ready; repair or import it again.",
    );
  if (row.probe === null)
    throw invalid(
      "The take's media has no recorded probe; import it again before using it as a take.",
    );
}

/** The story limited to one shot and one take, for its checks at apply. */
export function shotWithTake(story: Story, shotId: string, takeId: string) {
  const { scene, shot } = storyShot(story, shotId);
  const take = shot.takes.find((t) => t.id === takeId);
  if (!take) throw notFound("The shot has no such take.");
  return {
    ...story,
    scenes: [
      {
        ...scene,
        shots: [{ ...shot, takes: [take], selectedTakeId: take.id }],
      },
    ],
  };
}
