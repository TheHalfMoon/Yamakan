// Take compare and replace (YU-032). A story shot keeps its alternative
// takes (core/story.ts), each a project still or footage with an optional
// immutable lineage; the assembled timeline shot of the same id shows one
// of them. Listing and comparing takes read the head and change nothing. A
// replacement is first proposed: the exact clip mapping it would make,
// bound to the revision, the story version and the media versions, and
// named by its hash. Applying it recomputes the proposal at the head and
// commits only an identical one, as one undoable revision that changes
// that shot's clip and nothing else. Every take stays in the story and its
// media stays in the project, so undo returns exactly the old take.
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";
import { Id } from "./project.ts";
import { FLICKS_PER_SECOND, Ticks } from "./time.ts";
import type { CanonicalProject } from "./canonical.ts";
import type { DocumentRef } from "./document-ref.ts";
import { applyBatch, type Operation } from "./timeline/operations.ts";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import type { StoryDocument } from "./story.ts";

export const TAKE_LIMITS = Object.freeze({
  // Takes compared at once (a shot holds at most 8).
  compare: 8,
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
export type TakeProposal = z.infer<typeof TakeProposalSchema>;

const notFound = (message: string) => new CommandError("NOT_FOUND", message);
const invalid = (message: string) => new CommandError("VALIDATION", message);

function storyShot(story: Story, shotId: string) {
  for (const scene of story.scenes)
    for (const shot of scene.shots)
      if (shot.id === shotId) return { scene, shot };
  throw notFound("The story has no such shot.");
}

/**
 * The clip that shows a story shot on the timeline: the one clip of the
 * timeline shot of the same id, on a video track. A shot not assembled has
 * none; one whose clip was split or moved off video is refused.
 */
function shotClip(project: CanonicalProject, shotId: string): Clip | null {
  const shot = project.scenes
    .flatMap((s) => s.shots)
    .find((s) => s.id === shotId);
  if (!shot) return null;
  if (shot.clipIds.length !== 1)
    throw invalid(
      "The shot is shown by more than one clip on the timeline; replace its takes one clip at a time in the editor.",
    );
  const clip = project.clips.find((c) => c.id === shot.clipIds[0]);
  if (!clip) throw invalid("The shot's clip is missing from the timeline.");
  if (project.tracks.find((t) => t.id === clip.trackId)?.kind !== "video")
    throw invalid("The shot's clip is not on a video track.");
  return clip;
}

const assetOf = (project: CanonicalProject, id: string | null) =>
  project.assets.find((a) => a.id === id) ?? null;

// The take a clip shows: same media and in-point.
const shows = (clip: Clip | null, take: Take) =>
  clip !== null &&
  clip.title === null &&
  clip.assetId === take.assetId &&
  clip.sourceStartTicks === take.sourceStartTicks;

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
  return {
    documentId: ref.id,
    contentHash: ref.contentHash,
    revision: project.revision,
    shots: story.scenes.flatMap((scene) =>
      scene.shots.map((shot) => {
        let clip: Clip | null = null;
        let problem: string | null = null;
        try {
          clip = shotClip(project, shot.id);
        } catch (e) {
          if (!(e instanceof CommandError)) throw e;
          problem = e.message;
        }
        return {
          sceneId: scene.id,
          shotId: shot.id,
          name: shot.name,
          durationTicks: shot.durationTicks,
          selectedTakeId: shot.selectedTakeId,
          timeline: clip
            ? {
                clipId: clip.id,
                startTicks: clip.startTicks,
                durationTicks: clip.durationTicks,
                ...clipMedia(project, clip),
                currentTakeId:
                  shot.takes.find((t) => shows(clip, t))?.id ?? null,
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
  const clip = shotClip(project, shot.id);
  const length = clip?.durationTicks ?? shot.durationTicks;
  return {
    documentId: ref.id,
    contentHash: ref.contentHash,
    revision: project.revision,
    shotId: shot.id,
    clipId: clip?.id ?? null,
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
        current: shows(clip, take),
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
              take.sourceStartTicks + length <= asset.durationTicks,
        // The second in the middle of the take's range.
        preview:
          asset?.kind === "video"
            ? {
                type: "thumbnail" as const,
                assetId: asset.id,
                index: Math.min(
                  seconds - 1,
                  Math.floor(
                    (take.sourceStartTicks + length / 2) / FLICKS_PER_SECOND,
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

/** The operations a proposal makes: one clip shows the take. */
export const replaceOperations = (p: TakeProposal): Operation[] =>
  p.mappings.map((m) => ({
    type: "clip.replaceMedia",
    clipId: m.clipId,
    assetId: m.to.assetId!,
    sourceStartTicks: m.to.sourceStartTicks,
  }));

/**
 * The exact replacement that would make a shot's clip show one of its
 * takes, at this revision of this story version. It is checked by applying
 * it to a copy of the head, so a proposal that is made can be applied
 * while nothing it names has changed.
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
  const clip = shotClip(project, shot.id);
  if (!clip)
    throw invalid("Assemble the story before replacing a shot's take.");
  if (shows(clip, take)) throw invalid("The shot already shows this take.");
  // The clip is this story shot's: its title card or one of its takes (a
  // shot id alone could be another story's shot of the same id).
  if (clip.title === null && !shot.takes.some((t) => shows(clip, t)))
    throw invalid(
      "The shot's clip no longer shows one of this shot's takes; replace it in the editor.",
    );
  const asset = assetOf(project, take.assetId);
  if (!asset) throw notFound("The take's media is no longer in this project.");
  if (asset.kind === "audio")
    throw invalid("A take is a still or footage of this project.");
  if (take.lineage && take.lineage.outputHash !== asset.hash)
    throw invalid("The take does not match its recorded media version.");
  const body = {
    format: "yamakan.take-proposal" as const,
    formatVersion: 1 as const,
    projectId,
    revision: project.revision,
    documentId: ref.id,
    storyContentHash: ref.contentHash,
    shotId: shot.id,
    takeId: take.id,
    mappings: [
      {
        clipId: clip.id,
        startTicks: clip.startTicks,
        durationTicks: clip.durationTicks,
        from: clipMedia(project, clip),
        to: {
          assetId: asset.id,
          assetHash: asset.hash,
          title: null,
          sourceStartTicks: take.sourceStartTicks,
        },
      },
    ],
  };
  const proposal = { ...body, proposalHash: sha256Hex(canonicalJson(body)) };
  // Refusals (a locked track, a retimed clip, unlinked sound, a take
  // shorter than the clip) come now, not at apply.
  applyBatch(project, replaceOperations(proposal));
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
