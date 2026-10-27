// Story documents and reference packs (YU-031): creative documents of a
// project, immutable and content-addressed like Studio canvases and Cinema
// scenes (core/documents.ts), so every version is kept by the revisions
// that name it. A story holds scenes, shots and takes with stable ids and
// timings in ticks; a shot pins reference pack versions by content hash. A
// reference pack lists role-tagged project media pinned by asset hash, and
// a likeness (character) entry links a likeness consent for its purpose.
// A storyboard needs no generator: takes are imported stills or footage,
// and a shot without one is assembled as a title card.
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";
import { Id, frameRateOf, type Project } from "./project.ts";
import type { DocumentRef } from "./document-ref.ts";
import { Ticks, framesToTicks } from "./time.ts";
import type { CanonicalProject } from "./canonical.ts";
import type { Operation } from "./timeline/operations.ts";
import { assertConsentUsable } from "./director/runtime.ts";

export const STORY_LIMITS = Object.freeze({
  // Canonical bytes of one story or reference pack (well under the 8 MiB
  // document ceiling, and under the 2 MiB command body that carries it).
  documentBytes: 256 * 1024,
  scenes: 50,
  shotsPerScene: 100,
  // A whole story assembles onto one timeline (200 clips at most).
  shots: 200,
  takesPerShot: 8,
  packsPerShot: 4,
  entriesPerPack: 64,
});

const Name = z.string().trim().min(1).max(120);
const Note = z.string().max(2_000);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);

const TakeSchema = z
  .object({
    id: Id,
    assetId: Id,
    // Where the take starts in its source; it plays for the shot's duration.
    sourceStartTicks: Ticks,
  })
  .strict();

const PackPinSchema = z
  .object({
    documentId: Id,
    contentHash: Sha256,
  })
  .strict();

const ShotSchema = z
  .object({
    id: Id,
    name: Name,
    durationTicks: Ticks.min(1),
    notes: Note,
    referencePacks: z.array(PackPinSchema).max(STORY_LIMITS.packsPerShot),
    takes: z.array(TakeSchema).max(STORY_LIMITS.takesPerShot),
    selectedTakeId: Id.nullable(),
  })
  .strict();

const StorySceneSchema = z
  .object({
    id: Id,
    name: Name,
    shots: z.array(ShotSchema).max(STORY_LIMITS.shotsPerScene),
  })
  .strict();

export const StoryDocumentSchema = z
  .object({
    format: z.literal("yamakan.story"),
    formatVersion: z.literal(1),
    title: Name,
    scenes: z.array(StorySceneSchema).max(STORY_LIMITS.scenes),
  })
  .strict()
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const shots = s.scenes.flatMap((sc) => sc.shots);
    if (shots.length > STORY_LIMITS.shots)
      fail(`A story holds at most ${STORY_LIMITS.shots} shots.`);
    const ids = [
      ...s.scenes.map((x) => x.id),
      ...shots.map((x) => x.id),
      ...shots.flatMap((x) => x.takes.map((t) => t.id)),
    ];
    if (new Set(ids).size !== ids.length)
      fail("Story identifiers must be unique.");
    for (const shot of shots) {
      if (
        shot.selectedTakeId !== null &&
        !shot.takes.some((t) => t.id === shot.selectedTakeId)
      )
        fail("A shot's selected take must be one of its takes.");
      const pins = shot.referencePacks.map((p) => p.documentId);
      if (new Set(pins).size !== pins.length)
        fail("A shot pins each reference pack once.");
    }
  });
export type StoryDocument = z.infer<typeof StoryDocumentSchema>;

export const REFERENCE_ROLES = [
  "character",
  "environment",
  "prop",
  "wardrobe",
  "style",
  "camera",
] as const;

const PackEntrySchema = z
  .object({
    id: Id,
    role: z.enum(REFERENCE_ROLES),
    label: Name,
    assetId: Id,
    // The immutable media version the entry means: the asset's SHA-256.
    assetHash: Sha256,
    // A likeness entry names its character and the consent it relies on.
    characterId: z.string().min(1).max(80).nullable(),
    consentId: Id.nullable(),
  })
  .strict();

export const ReferencePackSchema = z
  .object({
    format: z.literal("yamakan.reference-pack"),
    formatVersion: z.literal(1),
    name: Name,
    entries: z.array(PackEntrySchema).max(STORY_LIMITS.entriesPerPack),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const ids = p.entries.map((e) => e.id);
    if (new Set(ids).size !== ids.length)
      fail("Reference entry identifiers must be unique.");
    for (const e of p.entries)
      if (e.role === "character") {
        if (e.characterId === null || e.consentId === null)
          fail("A character reference needs its character and a consent.");
      } else if (e.characterId !== null || e.consentId !== null)
        fail("Only a character reference links a likeness consent.");
  });
export type ReferencePack = z.infer<typeof ReferencePackSchema>;

// The purpose a likeness reference is collected for.
export const REFERENCE_CONSENT_PURPOSE = "likeness-generate" as const;

const schemaError = (e: unknown, what: string): never => {
  if (e instanceof z.ZodError)
    throw new CommandError(
      "VALIDATION",
      e.issues.map((i) => i.message).join("; ") || `Invalid ${what}.`,
    );
  throw e;
};

/** Pure validation of a parsed story (core/documents.ts bounds it first). */
export function validateStory(value: unknown) {
  let content: StoryDocument;
  try {
    content = StoryDocumentSchema.parse(value);
  } catch (e) {
    return schemaError(e, "story");
  }
  const assetIds = new Set<string>();
  for (const sc of content.scenes)
    for (const shot of sc.shots)
      for (const take of shot.takes) assetIds.add(take.assetId);
  return { content, assetIds: [...assetIds].sort(), objectDigests: [] };
}

/** Pure validation of a parsed reference pack. */
export function validateReferencePack(value: unknown) {
  let content: ReferencePack;
  try {
    content = ReferencePackSchema.parse(value);
  } catch (e) {
    return schemaError(e, "reference pack");
  }
  const assetIds = [...new Set(content.entries.map((e) => e.assetId))].sort();
  return { content, assetIds, objectDigests: [] };
}

export type CommitContext = {
  db: DatabaseSync;
  // The head's editing view and its document references.
  project: Project;
  documents: DocumentRef[];
  // Whether this project held a document version of a kind in any revision.
  held: (contentHash: string, kind: DocumentRef["kind"]) => boolean;
  nowMs: number;
};

const assetOf = (p: Project, id: string) => {
  const a = p.assets.find((x) => x.id === id);
  if (!a)
    throw new CommandError(
      "VALIDATION",
      "A story or reference pack uses media this project does not hold.",
    );
  return a;
};

/**
 * Inside the commit transaction: a story's takes are this project's stills
 * or footage and fit their source, and its pins name reference pack
 * versions this project holds whose consents are still usable.
 */
export function verifyStory(story: StoryDocument, c: CommitContext) {
  const rate = frameRateOf(c.project);
  for (const sc of story.scenes)
    for (const shot of sc.shots) {
      for (const take of shot.takes) {
        const asset = assetOf(c.project, take.assetId);
        if (asset.kind === "audio")
          throw new CommandError(
            "VALIDATION",
            "A take is a still or footage, not audio.",
          );
        if (
          asset.kind === "video" &&
          take.sourceStartTicks + shot.durationTicks >
            framesToTicks(asset.durationFrames, rate)
        )
          throw new CommandError(
            "VALIDATION",
            `Take of shot "${shot.name}" runs past the end of its source.`,
          );
      }
      for (const pin of shot.referencePacks) verifyPin(pin, c);
    }
}

function verifyPin(pin: z.infer<typeof PackPinSchema>, c: CommitContext) {
  const ref = c.documents.find((d) => d.id === pin.documentId);
  if (ref?.kind !== "referencePack" || !c.held(pin.contentHash, ref.kind))
    throw new CommandError(
      "VALIDATION",
      "A shot pins a reference pack version this project does not hold.",
    );
  const row = c.db
    .prepare(
      "SELECT bytes FROM creative_documents WHERE hash = ? AND kind = 'referencePack'",
    )
    .get(pin.contentHash) as { bytes: Uint8Array } | undefined;
  if (!row)
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "A pinned reference pack is missing from the workspace.",
    );
  const pack = ReferencePackSchema.parse(
    JSON.parse(Buffer.from(row.bytes).toString("utf8")),
  );
  verifyConsents(pack, c);
}

/**
 * Inside the commit transaction: each entry is this project's still or
 * footage at exactly the pinned version, and each likeness entry's consent
 * is usable for its character and purpose now.
 */
export function verifyReferencePack(pack: ReferencePack, c: CommitContext) {
  for (const e of pack.entries) {
    const asset = assetOf(c.project, e.assetId);
    if (asset.kind === "audio")
      throw new CommandError(
        "VALIDATION",
        "A reference is a still or footage, not audio.",
      );
    if (asset.hash !== e.assetHash)
      throw new CommandError(
        "VALIDATION",
        `Reference "${e.label}" does not match its media version.`,
      );
  }
  verifyConsents(pack, c);
}

function verifyConsents(pack: ReferencePack, c: CommitContext) {
  for (const e of pack.entries)
    if (e.consentId !== null && e.characterId !== null)
      assertConsentUsable(c.db, e.consentId, {
        characterId: e.characterId,
        purpose: REFERENCE_CONSENT_PURPOSE,
        nowMs: c.nowMs,
      });
}

/** Whether a pack links any likeness consent (agents cannot link one). */
export const linksConsent = (pack: ReferencePack) =>
  pack.entries.some((e) => e.consentId !== null);

/**
 * The operations that put a story on one video track, shot after shot from
 * `startTicks`: a shot's selected take as a clip of its media, or a title
 * card of its name when it has none. Each story scene and shot becomes the
 * timeline scene and shot of the same id, so the timeline keeps the link.
 */
export function assembleOperations(
  story: StoryDocument,
  project: CanonicalProject,
  trackId: string,
  startTicks: number,
  newId: () => string,
): Operation[] {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track || track.kind !== "video")
    throw new CommandError(
      "VALIDATION",
      "A story is assembled onto a video track.",
    );
  const shots = new Set(
    project.scenes.flatMap((s) => s.shots.map((x) => x.id)),
  );
  const ops: Operation[] = [];
  let at = startTicks;
  for (const sc of story.scenes) {
    if (!sc.shots.length) continue;
    if (!project.scenes.some((s) => s.id === sc.id))
      ops.push({ type: "scene.add", sceneId: sc.id, name: sc.name });
    for (const shot of sc.shots) {
      if (shots.has(shot.id))
        throw new CommandError(
          "VALIDATION",
          `Shot "${shot.name}" is already on the timeline.`,
        );
      const take = shot.takes.find((t) => t.id === shot.selectedTakeId);
      const clipId = newId();
      ops.push({
        type: "clip.add",
        clipId,
        trackId,
        assetId: take?.assetId ?? null,
        title: take ? null : shot.name,
        startTicks: at,
        durationTicks: shot.durationTicks,
        sourceStartTicks: take?.sourceStartTicks ?? 0,
      });
      ops.push({
        type: "shot.add",
        sceneId: sc.id,
        shotId: shot.id,
        name: shot.name,
        clipIds: [clipId],
      });
      at += shot.durationTicks;
    }
  }
  if (!ops.length)
    throw new CommandError("VALIDATION", "The story has no shots to assemble.");
  return ops;
}
