import { z } from "zod";
import { RESOURCE_POLICY } from "./command/policy.ts";
import { ClipAnimationSchema } from "./timeline/animation-schema.ts";
import { FLICKS_PER_SECOND, framesToTicks, type Rational } from "./time.ts";
const { timelineFrames, mediaDimension } = RESOURCE_POLICY.enforced;
export const Id = z.uuid();
const frame = z.number().int().min(0).max(timelineFrames);
// Project frame rates (YU-019). Every frame field of the editing view counts
// frames at the project's rate. 30 fps projects keep view schema 2 exactly
// (fps: 30); other qualified rates use schema 3 with a rational frameRate.
// Further rates are added only with the same qualification.
export const EDIT_RATE_30: Rational = Object.freeze({ num: 30, den: 1 });
export const EDIT_RATE_23976: Rational = Object.freeze({
  num: 24000,
  den: 1001,
});
export const SUPPORTED_FRAME_RATES: readonly Rational[] = Object.freeze([
  EDIT_RATE_30,
  EDIT_RATE_23976,
]);
const sameRate = (a: Rational, b: Rational) =>
  a.num === b.num && a.den === b.den;
export const isSupportedRate = (r: Rational) =>
  SUPPORTED_FRAME_RATES.some((x) => sameRate(x, r));
const FrameRateSchema = z
  .object({
    num: z.number().int().positive().max(1_000_000),
    den: z.number().int().positive().max(1_000_000),
  })
  .strict()
  .refine((r) => isSupportedRate(r) && !sameRate(r, EDIT_RATE_30), {
    message: "Unsupported project frame rate (30 fps projects use schema 2).",
  });
// The longest timeline: ten minutes, whatever the rate.
const MAX_TIMELINE_TICKS = FLICKS_PER_SECOND * 600;
export const AssetSchema = z
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
    durationFrames: frame,
    width: z.number().int().min(0).max(mediaDimension),
    height: z.number().int().min(0).max(mediaDimension),
    // Recorded at import from the probe; null means unknown (pre-v3 migration).
    hasAudio: z.boolean().nullable(),
  })
  .strict();
const ClipSoundSchema = z
  .object({
    enabled: z.boolean(),
    gainDb: z.number().min(-60).max(12).optional(),
    fadeInFrames: frame.optional(),
    fadeOutFrames: frame.optional(),
  })
  .strict();
export const TrackSchema = z
  .object({
    id: Id,
    name: z.string().min(1).max(80),
    kind: z.enum(["video", "audio"]),
    muted: z.boolean(),
    locked: z.boolean(),
    solo: z.boolean().optional(),
    targeted: z.boolean().optional(),
  })
  .strict();
export const ClipSchema = z
  .object({
    id: Id,
    trackId: Id,
    assetId: Id.nullable(),
    startFrame: frame,
    durationFrames: frame.min(1),
    sourceFrame: frame,
    title: z.string().max(500).nullable(),
    // Absent means neutral: 0 dB and no fade.
    gainDb: z.number().min(-60).max(12).optional(),
    fadeInFrames: frame.optional(),
    fadeOutFrames: frame.optional(),
    sound: ClipSoundSchema.optional(),
    // W9/M5: optional constant retime (rational). Absent = 1×.
    speed: z
      .object({
        num: z.number().int().positive().max(1_000_000),
        den: z.number().int().positive().max(1_000_000),
      })
      .strict()
      .optional(),
    // W16/M6: optional animation channel map (path → channel). Absent when unused.
    animation: ClipAnimationSchema.optional(),
  })
  .strict();
const ShotSchema = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    clipIds: z.array(Id).max(200),
  })
  .strict();
const SceneSchema = z
  .object({
    id: Id,
    name: z.string().min(1).max(120),
    referenceAssetId: Id.nullable(),
    camera: z
      .object({
        focalLengthMm: z.number().min(8).max(300),
        shotScale: z.enum(["wide", "medium", "close"]),
        movement: z.enum(["static", "dolly", "pan", "orbit"]),
      })
      .strict(),
    shots: z.array(ShotSchema).max(100).optional(),
  })
  .strict();
const ProjectBody = z
  .object({
    schemaVersion: z.union([z.literal(2), z.literal(3)]),
    id: Id,
    name: z.string().min(1).max(120),
    revision: z.number().int().nonnegative(),
    // Schema 2: fps 30. Schema 3: frameRate (a qualified non-30 rate).
    fps: z.literal(30).optional(),
    frameRate: FrameRateSchema.optional(),
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
    assets: z.array(AssetSchema).max(200),
    scenes: z.array(SceneSchema).max(100),
    tracks: z.array(TrackSchema).max(16),
    clips: z.array(ClipSchema).max(200),
  })
  .strict()
  .superRefine((p, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (p.schemaVersion === 2 && (p.fps !== 30 || p.frameRate))
      fail("A schema 2 project is 30 fps.");
    if (p.schemaVersion === 3 && (p.fps !== undefined || !p.frameRate))
      fail("A schema 3 project names its frame rate.");
    // Only a qualified rate times the timeline (a refused one is already
    // an issue above, and is never used for arithmetic).
    const rate =
      p.frameRate && isSupportedRate(p.frameRate) ? p.frameRate : EDIT_RATE_30;
    const frameTicks = (frames: number) => framesToTicks(frames, rate);
    const ids = [
      p.id,
      ...p.assets.map((x) => x.id),
      ...p.scenes.map((x) => x.id),
      ...p.tracks.map((x) => x.id),
      ...p.clips.map((x) => x.id),
    ];
    if (new Set(ids).size !== ids.length) fail("Identifiers must be unique.");
    for (const s of p.scenes)
      if (
        s.referenceAssetId &&
        !p.assets.some((a) => a.id === s.referenceAssetId && a.kind === "image")
      )
        fail("Scene reference must identify an imported image.");
    for (const c of p.clips) {
      const track = p.tracks.find((t) => t.id === c.trackId);
      const asset = p.assets.find((a) => a.id === c.assetId);
      if (!track) fail("Clip track is missing.");
      // Field bounds can fail without stopping this refinement, so the end
      // is converted to ticks only when it is a bounded, safe frame count.
      const end = c.startFrame + c.durationFrames;
      if (
        Number.isSafeInteger(end) &&
        end >= 0 &&
        (end > timelineFrames || frameTicks(end) > MAX_TIMELINE_TICKS)
      )
        fail("Timeline exceeds ten minutes.");
      if (c.title !== null) {
        if (c.assetId !== null || track?.kind !== "video")
          fail("Title requires a video track and no asset.");
      } else if (!asset) fail("Clip asset is missing.");
      else {
        if ((asset.kind === "audio") !== (track?.kind === "audio"))
          fail("Asset and track types do not match.");
        if (
          asset.kind !== "image" &&
          c.sourceFrame + c.durationFrames > asset.durationFrames
        )
          fail("Clip extends beyond its source.");
      }
    }
  });

function upgradeEditView(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== 1) return value;
  const assets = Array.isArray(v.assets)
    ? v.assets.map((a) =>
        a && typeof a === "object"
          ? { ...(a as Record<string, unknown>), hasAudio: null }
          : a,
      )
    : v.assets;
  return { ...v, schemaVersion: 2, assets };
}

export const ProjectSchema = z.preprocess(upgradeEditView, ProjectBody);
export type Project = z.infer<typeof ProjectBody>;
export type Asset = z.infer<typeof AssetSchema>;
// The project's frame rate (frames of the editing view per second).
export function frameRateOf(p: { frameRate?: Rational }): Rational {
  return p.frameRate ?? EDIT_RATE_30;
}
// Seconds of `frames` frames at a rate (for FFmpeg arguments and progress;
// exact frame arithmetic stays in ticks).
export const framesToSeconds = (frames: number, rate: Rational) =>
  (frames * rate.den) / rate.num;
// Frames per second as a number (the browser views in seconds).
export const framesPerSecond = (p: { frameRate?: Rational }) => {
  const r = frameRateOf(p);
  return r.num / r.den;
};
export type Clip = z.infer<typeof ClipSchema>;
export function createProject(
  name: string,
  frameRate: Rational = EDIT_RATE_30,
): Project {
  const thirty = sameRate(frameRate, EDIT_RATE_30);
  return ProjectSchema.parse({
    schemaVersion: thirty ? 2 : 3,
    id: crypto.randomUUID(),
    name,
    revision: 0,
    ...(thirty ? { fps: 30 } : { frameRate: { ...frameRate } }),
    width: 1280,
    height: 720,
    assets: [],
    scenes: [],
    tracks: [
      {
        id: crypto.randomUUID(),
        name: "Picture",
        kind: "video",
        muted: false,
        locked: false,
      },
      {
        id: crypto.randomUUID(),
        name: "Audio",
        kind: "audio",
        muted: false,
        locked: false,
      },
    ],
    clips: [],
  });
}
