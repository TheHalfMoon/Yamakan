// Canonical Yamakan project, format "yamakan.project" version 1. This is what
// the workspace database stores. Time is integer flicks (core/time.ts). The
// 30 fps editing shape in core/project.ts is a lossless projection of this
// model used by the current editor until command reducers replace whole-
// project saves (T6); conversions that would lose information fail instead.
// The one normalization: a title's source offset, which nothing reads, is 0.
import { z } from "zod";
import { Id, ProjectSchema, frameRateOf, isSupportedRate } from "./project.ts";
import type { Project } from "./project.ts";
import { RESOURCE_POLICY } from "./command/policy.ts";
import {
  FLICKS_PER_SECOND,
  RationalSchema,
  Ticks,
  addTicks,
  framesToTicks,
  rational,
  ticksToFrames,
  type Rational,
} from "./time.ts";
import { CommandError } from "./command/errors.ts";
import { canPlaceTimeSpansOnTrack } from "./timeline/overlap.ts";
import { ClipAnimationSchema } from "./timeline/animation-schema.ts";
import { ClipEffectsSchema } from "./effects/registry.ts";
import { DOCUMENT_LIMITS, DocumentRefSchema } from "./document-ref.ts";
import type { DocumentRef } from "./document-ref.ts";
import { canonicalJson } from "./hash/canonical.ts";

export const FORMAT = "yamakan.project";
// v5 (YU-010) adds creative document references. A project without any is
// still written as v4, byte for byte, so its hash and every older reader are
// unaffected (serializeCanonical).
export const FORMAT_VERSION = 5;
const DOCUMENTLESS_FORMAT_VERSION = 4;
const { mediaDimension, timelineFrames } = RESOURCE_POLICY.enforced;
// The timeline horizon stays the editor's ten minutes at 30 fps.
const MAX_TIMELINE_TICKS = framesToTicks(timelineFrames, rational(30, 1));

const CanonicalAsset = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    kind: z.enum(["image", "video", "audio"]),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    extension: z.enum([
      "png",
      "jpg",
      "jpeg",
      "webp",
      "mp4",
      "mov",
      "webm",
      "wav",
      "mp3",
      "ogg",
    ]),
    bytes: z
      .number()
      .int()
      .positive()
      .max(RESOURCE_POLICY.enforced.assetImportBytes),
    width: z.number().int().min(0).max(mediaDimension),
    height: z.number().int().min(0).max(mediaDimension),
    durationTicks: Ticks.max(MAX_TIMELINE_TICKS),
    // Stream time base from probing; null when imported before probing recorded it.
    timebase: RationalSchema.nullable(),
    // Whether the source carries an audio stream; null when unknown (migration).
    hasAudio: z.boolean().nullable(),
  })
  .strict();
const CanonicalClipSound = z
  .object({
    enabled: z.boolean(),
    gainDb: z.number().min(-60).max(12),
    fadeInTicks: Ticks,
    fadeOutTicks: Ticks,
  })
  .strict();
const CanonicalTrack = z
  .object({
    id: Id,
    name: z.string().min(1).max(80),
    kind: z.enum(["video", "audio"]),
    muted: z.boolean(),
    locked: z.boolean(),
    solo: z.boolean(),
    targeted: z.boolean(),
  })
  .strict();
const CanonicalClip = z
  .object({
    id: Id,
    trackId: Id,
    assetId: Id.nullable(),
    startTicks: Ticks,
    durationTicks: Ticks.min(1),
    // Offset into the source media, in flicks from the source's first sample.
    sourceStartTicks: Ticks,
    title: z.string().max(500).nullable(),
    // v2: audio gain and linear fades. MVP renders them on audio clips only.
    gainDb: z.number().min(-60).max(12),
    fadeInTicks: Ticks,
    fadeOutTicks: Ticks,
    // v3: embedded sound on video-track video clips only; null elsewhere.
    sound: CanonicalClipSound.nullable(),
    // W9/M5: constant retime. Absent means 1/1 (no migration required).
    speed: RationalSchema.optional(),
    // W16/M6: OpenCut-shaped animation channel map (path → channel). Absent when unused.
    animation: ClipAnimationSchema.optional(),
    // YU-020: versioned effect stack (transform/crop). Absent when unused,
    // so projects without effects keep their bytes.
    effects: ClipEffectsSchema.optional(),
  })
  .strict();
// v2: a shot is an ordered group of a scene's clips.
const CanonicalShot = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    clipIds: z.array(Id).max(200),
  })
  .strict();
const CanonicalScene = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    referenceAssetId: Id.nullable(),
    // Camera values are labelled intent, not an applied-conditioning receipt.
    camera: z
      .object({
        focalLengthMm: z.number().min(8).max(300),
        shotScale: z.enum(["wide", "medium", "close"]),
        movement: z.enum(["static", "dolly", "pan", "orbit"]),
      })
      .strict(),
    shots: z.array(CanonicalShot).max(100),
  })
  .strict();

const ProjectBody = z
  .object({
    format: z.literal(FORMAT),
    formatVersion: z.union([
      z.literal(DOCUMENTLESS_FORMAT_VERSION),
      z.literal(FORMAT_VERSION),
    ]),
    id: Id,
    name: z.string().min(1).max(120),
    revision: z.number().int().nonnegative().max(10000),
    language: z.enum(["en", "ar"]),
    output: z
      .object({
        width: z
          .number()
          .int()
          .min(16)
          .max(1920)
          .refine((x) => x % 2 === 0),
        height: z
          .number()
          .int()
          .min(16)
          .max(1080)
          .refine((x) => x % 2 === 0),
        fps: RationalSchema,
      })
      .strict(),
    assets: z
      .array(CanonicalAsset)
      .max(RESOURCE_POLICY.enforced.assetsPerProject),
    scenes: z.array(CanonicalScene).max(100),
    tracks: z.array(CanonicalTrack).max(16),
    clips: z.array(CanonicalClip).max(200),
    // v5: references to immutable creative documents (core/documents.ts).
    documents: z
      .array(DocumentRefSchema)
      .max(DOCUMENT_LIMITS.documentsPerProject)
      .default([]),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (p.formatVersion === DOCUMENTLESS_FORMAT_VERSION && p.documents.length)
      fail("A version 4 project cannot contain documents.");
    const ids = [
      p.id,
      ...p.assets,
      ...p.scenes,
      ...p.scenes.flatMap((s) => s.shots),
      ...p.tracks,
      ...p.clips,
      ...p.documents,
    ].map((x) => (typeof x === "string" ? x : x.id));
    if (new Set(ids).size !== ids.length) fail("Identifiers must be unique.");
    for (const s of p.scenes)
      if (
        s.referenceAssetId &&
        !p.assets.some((a) => a.id === s.referenceAssetId && a.kind === "image")
      )
        fail("Scene reference must identify an imported image.");
    const shotClips = p.scenes.flatMap((s) =>
      s.shots.flatMap((sh) => sh.clipIds),
    );
    if (new Set(shotClips).size !== shotClips.length)
      fail("A clip belongs to at most one shot.");
    for (const id of shotClips)
      if (!p.clips.some((c) => c.id === id)) fail("Shot clip is missing.");
    for (const c of p.clips) {
      const track = p.tracks.find((t) => t.id === c.trackId);
      if (c.fadeInTicks + c.fadeOutTicks > c.durationTicks)
        fail("Fades are longer than the clip.");
      const audible = track?.kind === "audio";
      if (!audible && (c.gainDb !== 0 || c.fadeInTicks || c.fadeOutTicks))
        fail("Gain and fades apply to audio clips only.");
      if (
        c.effects &&
        (c.title !== null ||
          track?.kind !== "video" ||
          !p.assets.some(
            (a) =>
              a.id === c.assetId && (a.kind === "video" || a.kind === "image"),
          ))
      )
        fail("Effects apply to footage and stills on video tracks only.");
      const asset = p.assets.find((a) => a.id === c.assetId);
      const videoMedia =
        c.title === null && track?.kind === "video" && asset?.kind === "video";
      if (videoMedia) {
        const sound = c.sound;
        if (sound === null) {
          fail("Video clips require sound settings.");
          continue;
        }
        if (
          sound.enabled &&
          sound.fadeInTicks + sound.fadeOutTicks > c.durationTicks
        )
          fail("Sound fades are longer than the clip.");
      } else if (c.sound !== null) fail("Sound applies to video clips only.");
      if (!track) fail("Clip track is missing.");
      let end: number;
      try {
        end = addTicks(c.startTicks, c.durationTicks);
      } catch {
        fail("Clip time is out of range.");
        continue;
      }
      if (end > MAX_TIMELINE_TICKS) fail("Timeline exceeds ten minutes.");
      if (c.title !== null) {
        if (c.assetId !== null || track?.kind !== "video")
          fail("Title requires a video track and no asset.");
        if (c.sourceStartTicks !== 0) fail("Titles have no source offset.");
      } else if (!asset) fail("Clip asset is missing.");
      else {
        // W18: an audio track may hold a video asset's unlinked sound
        // when the asset probe reported hasAudio.
        if (track?.kind === "audio") {
          const ok =
            asset.kind === "audio" ||
            (asset.kind === "video" && asset.hasAudio === true);
          if (!ok)
            fail(
              "Audio track requires an audio asset or a video asset with audio.",
            );
        } else if (asset.kind === "audio") {
          fail("Asset and track types do not match.");
        }
        if (
          asset.kind !== "image" &&
          !(
            Number.isSafeInteger(c.sourceStartTicks + c.durationTicks) &&
            c.sourceStartTicks + c.durationTicks <= asset.durationTicks
          )
        )
          fail("Clip extends beyond its source.");
      }
    }
    for (const track of p.tracks) {
      const onTrack = p.clips.filter((c) => c.trackId === track.id);
      const elements = onTrack.map((c) => ({
        id: c.id,
        startTicks: c.startTicks,
        durationTicks: c.durationTicks,
      }));
      for (const clip of onTrack) {
        try {
          const others = elements.filter((e) => e.id !== clip.id);
          if (
            !canPlaceTimeSpansOnTrack({
              track: { elements: others },
              timeSpans: [
                {
                  startTime: clip.startTicks,
                  duration: clip.durationTicks,
                  excludeElementId: clip.id,
                },
              ],
            })
          )
            fail("Clips on a track cannot overlap.");
        } catch {
          // Unsafe or out-of-range ticks are reported by the tick validators.
        }
      }
    }
  });
// Own keys that alter prototypes when objects are copied or merged. Zod's
// strict mode does not report an own "__proto__" key, so it is checked here.
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function prototypeKey(value: unknown, depth = 0): boolean {
  if (depth > 32 || value === null || typeof value !== "object") return false;
  for (const key of Object.keys(value)) {
    if (PROTOTYPE_KEYS.has(key)) return true;
    if (prototypeKey((value as Record<string, unknown>)[key], depth + 1))
      return true;
  }
  return false;
}
export const CanonicalProjectSchema = z.preprocess((value, ctx) => {
  if (prototypeKey(value))
    ctx.addIssue({
      code: "custom",
      message: "Prototype keys are not allowed.",
    });
  return value;
}, ProjectBody.transform(normalizeVersion));
// One parsed form: version 4 without documents, version 5 with them.
function normalizeVersion<
  T extends { formatVersion: 4 | 5; documents: unknown[] },
>(p: T): T {
  return {
    ...p,
    formatVersion: p.documents.length
      ? FORMAT_VERSION
      : DOCUMENTLESS_FORMAT_VERSION,
  };
}
export type CanonicalProject = z.output<typeof ProjectBody>;

// Bounded, write-free inspection of a stored snapshot whose format may be
// newer than this build. Never used to rewrite the snapshot.
export function inspectFormat(value: unknown): {
  format: string | null;
  formatVersion: number | null;
  supported: boolean;
} {
  const v = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const format = typeof v.format === "string" ? v.format.slice(0, 80) : null;
  const formatVersion = Number.isSafeInteger(v.formatVersion)
    ? (v.formatVersion as number)
    : null;
  return {
    format,
    formatVersion,
    supported:
      format === FORMAT &&
      formatVersion !== null &&
      formatVersion >= 1 &&
      formatVersion <= FORMAT_VERSION,
  };
}

// v1 had no gain, fades or shots; their neutral values are exactly v1's meaning.
// v1 had no gain, fades or shots: they are added with neutral values. A
// document that claims v1 but already carries them is not a v1 project and
// is refused rather than silently overwritten.
function upgradeV1(value: Record<string, unknown>) {
  const clips = Array.isArray(value.clips) ? value.clips : [];
  const scenes = Array.isArray(value.scenes) ? value.scenes : [];
  const has = (x: unknown, keys: string[]) =>
    Boolean(x) && typeof x === "object" && keys.some((k) => k in (x as object));
  if (
    clips.some((c) => has(c, ["gainDb", "fadeInTicks", "fadeOutTicks"])) ||
    scenes.some((sc) => has(sc, ["shots"]))
  )
    throw new CommandError(
      "VALIDATION",
      "A version 1 project cannot contain version 2 fields.",
    );
  return {
    ...value,
    formatVersion: 2,
    clips: clips.map((c) =>
      c && typeof c === "object"
        ? { ...c, gainDb: 0, fadeInTicks: 0, fadeOutTicks: 0 }
        : c,
    ),
    scenes: scenes.map((sc) =>
      sc && typeof sc === "object" ? { ...sc, shots: [] } : sc,
    ),
  };
}

// v3 adds asset hasAudio and clip sound. Migrated clips keep export intent:
// embedded video sound stays off until the editor enables it.
function upgradeV2(value: Record<string, unknown>) {
  const assets = Array.isArray(value.assets) ? value.assets : [];
  const clips = Array.isArray(value.clips) ? value.clips : [];
  const tracks = Array.isArray(value.tracks) ? value.tracks : [];
  const has = (x: unknown, keys: string[]) =>
    Boolean(x) && typeof x === "object" && keys.some((k) => k in (x as object));
  if (
    assets.some((a) => has(a, ["hasAudio"])) ||
    clips.some((c) => has(c, ["sound"]))
  )
    throw new CommandError(
      "VALIDATION",
      "A version 2 project cannot contain version 3 fields.",
    );
  const trackKind = new Map(
    tracks
      .filter((t) => t && typeof t === "object" && "id" in t && "kind" in t)
      .map((t) => [(t as { id: string }).id, (t as { kind: string }).kind]),
  );
  const assetKind = new Map(
    assets
      .filter((a) => a && typeof a === "object" && "id" in a && "kind" in a)
      .map((a) => [(a as { id: string }).id, (a as { kind: string }).kind]),
  );
  return {
    ...value,
    formatVersion: 3,
    assets: assets.map((a) =>
      a && typeof a === "object" ? { ...a, hasAudio: null } : a,
    ),
    clips: clips.map((c) => {
      if (!c || typeof c !== "object") return c;
      const clip = c as Record<string, unknown>;
      const trackId = clip.trackId as string;
      const assetId = clip.assetId as string | null;
      const title = clip.title;
      if (
        trackKind.get(trackId) === "video" &&
        title === null &&
        assetId !== null &&
        assetKind.get(assetId) === "video"
      )
        return {
          ...clip,
          sound: {
            enabled: false,
            gainDb: 0,
            fadeInTicks: 0,
            fadeOutTicks: 0,
          },
        };
      return { ...clip, sound: null };
    }),
  };
}

export function parseCanonical(value: unknown): CanonicalProject {
  const info = inspectFormat(value);
  if (!info.supported) {
    if (info.format === FORMAT && (info.formatVersion ?? 0) > FORMAT_VERSION)
      throw new CommandError(
        "RECOVERY_REQUIRED",
        `Project format version ${info.formatVersion} is newer than this build supports; it can be inspected but not edited.`,
      );
    throw new CommandError("VALIDATION", "Not a Yamakan project snapshot.");
  }
  let doc = value as Record<string, unknown>;
  if (info.formatVersion === 1) doc = upgradeV1(doc);
  if (doc.formatVersion === 2) doc = upgradeV2(doc);
  if (doc.formatVersion === 3) doc = upgradeV3(doc);
  return CanonicalProjectSchema.parse(doc);
}

/** v4: video-with-audio assets may sit on audio tracks (unlinked sound). */
function upgradeV3(value: Record<string, unknown>) {
  return { ...value, formatVersion: 4 };
}

// Frames of the editing view at the project's rate (YU-019): exact both
// ways. A canonical time that is not on a frame of the project's rate is
// refused, never rounded.
const editRate = (fps: Rational) => {
  const label = fps.den === 1 ? `${fps.num} fps` : `${fps.num}/${fps.den} fps`;
  return {
    toTicks: (frames: number) => framesToTicks(frames, fps),
    toFrames: (ticks: number, what: string) => {
      try {
        return ticksToFrames(ticks, fps, "exact");
      } catch {
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          `${what} is not frame-aligned at ${label}; this editor cannot represent it without loss.`,
        );
      }
    },
  };
};

// Editing shape → canonical. Exact: one 30 fps frame is 23,520,000 flicks,
// one 24000/1001 fps frame 29,429,400.
// The editing shape has no documents: callers pass the revision's own
// references (the store carries the head's forward), never drop them.
export function fromEditView(
  view: Project,
  language: "en" | "ar" = "en",
  documents: DocumentRef[] = [],
): CanonicalProject {
  const p = ProjectSchema.parse(view);
  const fps = frameRateOf(p);
  const { toTicks } = editRate(fps);
  return CanonicalProjectSchema.parse({
    format: FORMAT,
    formatVersion: documents.length
      ? FORMAT_VERSION
      : DOCUMENTLESS_FORMAT_VERSION,
    documents,
    id: p.id,
    name: p.name,
    revision: p.revision,
    language,
    output: {
      width: p.width,
      height: p.height,
      fps: rational(fps.num, fps.den),
    },
    assets: p.assets.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      hash: a.hash,
      extension: a.extension,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      durationTicks: toTicks(a.durationFrames),
      timebase: null,
      hasAudio: a.hasAudio,
    })),
    scenes: p.scenes.map((sc) => ({ ...sc, shots: sc.shots ?? [] })),
    tracks: p.tracks.map((t) => ({
      ...t,
      solo: Boolean(t.solo),
      targeted: Boolean(t.targeted),
    })),
    clips: p.clips.map((c) => {
      const track = p.tracks.find((t) => t.id === c.trackId);
      const asset = p.assets.find((a) => a.id === c.assetId);
      const videoMedia =
        c.title === null && track?.kind === "video" && asset?.kind === "video";
      let sound: {
        enabled: boolean;
        gainDb: number;
        fadeInTicks: number;
        fadeOutTicks: number;
      } | null = null;
      if (videoMedia) {
        sound = {
          enabled: c.sound?.enabled ?? false,
          gainDb: c.sound?.gainDb ?? 0,
          fadeInTicks: toTicks(c.sound?.fadeInFrames ?? 0),
          fadeOutTicks: toTicks(c.sound?.fadeOutFrames ?? 0),
        };
      }
      return {
        id: c.id,
        trackId: c.trackId,
        assetId: c.assetId,
        startTicks: toTicks(c.startFrame),
        durationTicks: toTicks(c.durationFrames),
        // Titles have no source media: the renderer never reads their offset,
        // so a stray editor value carries no meaning and is not preserved.
        sourceStartTicks: c.title === null ? toTicks(c.sourceFrame) : 0,
        title: c.title,
        gainDb: c.gainDb ?? 0,
        fadeInTicks: toTicks(c.fadeInFrames ?? 0),
        fadeOutTicks: toTicks(c.fadeOutFrames ?? 0),
        sound,
        ...(c.speed ? { speed: c.speed } : {}),
        ...(c.animation ? { animation: c.animation } : {}),
        ...(c.effects ? { effects: c.effects } : {}),
      };
    }),
  });
}

// The stored bytes of a canonical project: v4 exactly as before when it has
// no documents, v5 with its references otherwise, ordered by document id.
export function serializeCanonical(project: CanonicalProject): string {
  const p = CanonicalProjectSchema.parse(project);
  const { documents, ...rest } = p;
  if (!documents.length)
    return canonicalJson({
      ...rest,
      formatVersion: DOCUMENTLESS_FORMAT_VERSION,
    });
  const ordered = [...documents].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return canonicalJson({
    ...rest,
    formatVersion: FORMAT_VERSION,
    documents: ordered,
  });
}

// Canonical → editing shape. Refuses anything the editor cannot hold: a
// frame rate it is not qualified for, or a time off the project's frames.
export function toEditView(project: CanonicalProject): Project {
  const p = CanonicalProjectSchema.parse(project);
  const fps = p.output.fps;
  if (!isSupportedRate(fps))
    throw new CommandError(
      "CAPABILITY_UNAVAILABLE",
      "This editor supports 30 and 24000/1001 fps projects only.",
    );
  const thirty = fps.num === 30 && fps.den === 1;
  const { toFrames } = editRate(fps);
  for (const a of p.assets)
    if (a.timebase !== null) {
      // Recorded time bases are not representable in the editing shape yet.
      throw new CommandError(
        "CAPABILITY_UNAVAILABLE",
        "Source time bases require the timeline editor.",
      );
    }
  return ProjectSchema.parse({
    // 30 fps projects keep the schema 2 view byte for byte.
    schemaVersion: thirty ? 2 : 3,
    id: p.id,
    name: p.name,
    revision: p.revision,
    ...(thirty ? { fps: 30 } : { frameRate: { num: fps.num, den: fps.den } }),
    width: p.output.width,
    height: p.output.height,
    assets: p.assets.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      hash: a.hash,
      extension: a.extension,
      bytes: a.bytes,
      durationFrames: toFrames(a.durationTicks, "Asset duration"),
      width: a.width,
      height: a.height,
      hasAudio: a.hasAudio,
    })),
    scenes: p.scenes.map(({ shots, ...sc }) =>
      shots.length ? { ...sc, shots } : sc,
    ),
    tracks: p.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      muted: t.muted,
      locked: t.locked,
      ...(t.solo ? { solo: true } : {}),
      ...(t.targeted ? { targeted: true } : {}),
    })),
    clips: p.clips.map((c) => ({
      id: c.id,
      trackId: c.trackId,
      assetId: c.assetId,
      startFrame: toFrames(c.startTicks, "Clip start"),
      durationFrames: toFrames(c.durationTicks, "Clip duration"),
      sourceFrame: toFrames(c.sourceStartTicks, "Clip source offset"),
      title: c.title,
      ...(c.gainDb !== 0 ? { gainDb: c.gainDb } : {}),
      ...(c.fadeInTicks
        ? { fadeInFrames: toFrames(c.fadeInTicks, "Clip fade-in") }
        : {}),
      ...(c.fadeOutTicks
        ? { fadeOutFrames: toFrames(c.fadeOutTicks, "Clip fade-out") }
        : {}),
      ...(c.sound
        ? {
            sound: {
              enabled: c.sound.enabled,
              ...(c.sound.gainDb !== 0 ? { gainDb: c.sound.gainDb } : {}),
              ...(c.sound.fadeInTicks
                ? {
                    fadeInFrames: toFrames(
                      c.sound.fadeInTicks,
                      "Clip sound fade-in",
                    ),
                  }
                : {}),
              ...(c.sound.fadeOutTicks
                ? {
                    fadeOutFrames: toFrames(
                      c.sound.fadeOutTicks,
                      "Clip sound fade-out",
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(c.speed && !(c.speed.num === 1 && c.speed.den === 1)
        ? { speed: c.speed }
        : {}),
      ...(c.animation ? { animation: c.animation } : {}),
      ...(c.effects ? { effects: c.effects } : {}),
    })),
  });
}

export { FLICKS_PER_SECOND };
