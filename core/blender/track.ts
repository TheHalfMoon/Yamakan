// Camera tracking with the Blender worker (Blender integration: tracking). A project's video is
// handed to a fixed Yamakan script (scripts/blender/yamakan_track.py), never user code: it finds
// features, follows them through the clip and solves how the camera moved. What comes back is
// checked against this schema before anything uses it.
//
// The solved camera is Blender's own reconstruction: the first solved frame's camera is the
// identity, distances are in an arbitrary scale (one track's depth sets it), and each matrix is
// that frame's camera-to-world transform, row-major, in Blender's camera convention (looking
// down -Z, Y up).
import { z } from "zod";

export const CAMERA_TRACK_FORMAT = "yamakan.camera-track/1";

export const BLENDER_TRACK_LIMITS = Object.freeze({
  maxFrames: 720,
  maxWidth: 1920,
  maxHeight: 1080,
  minSide: 64,
  // A solve whose features land further than this from where the solved camera puts them, on
  // average, is refused rather than handed on as if it were good.
  maxErrorPixels: 3,
  // Features placed by the solve; fewer than this many and there is nothing to solve.
  minTracks: 8,
  // Shorter clips cannot be solved: features followed for fewer frames are dropped.
  minFrames: 10,
  resultBytes: 4 * 1024 * 1024,
});

const Finite = z.number().finite();

/** The lens the footage was shot with: the solve needs it to be right. */
export const TrackLensSchema = z
  .object({
    focalLengthMm: Finite.min(1).max(1000),
    sensorWidthMm: Finite.min(1).max(100),
  })
  .strict();
export type TrackLens = z.infer<typeof TrackLensSchema>;

export const CameraTrackSchema = z
  .object({
    format: z.literal(CAMERA_TRACK_FORMAT),
    width: z
      .number()
      .int()
      .min(BLENDER_TRACK_LIMITS.minSide)
      .max(BLENDER_TRACK_LIMITS.maxWidth),
    height: z
      .number()
      .int()
      .min(BLENDER_TRACK_LIMITS.minSide)
      .max(BLENDER_TRACK_LIMITS.maxHeight),
    fps: Finite.positive().max(240),
    // Frames in the clip; the solved cameras cover at least 80 % of them (gaps may remain where
    // the camera could not be placed).
    frames: z.number().int().min(10).max(BLENDER_TRACK_LIMITS.maxFrames),
    lens: TrackLensSchema,
    // Features that were followed and kept for the solve.
    tracks: z.number().int().min(BLENDER_TRACK_LIMITS.minTracks).max(100_000),
    averageErrorPixels: Finite.min(0).max(BLENDER_TRACK_LIMITS.maxErrorPixels),
    keyframes: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
    cameras: z
      .array(
        z
          .object({
            frame: z.number().int().min(1).max(BLENDER_TRACK_LIMITS.maxFrames),
            matrix: z.array(Finite.min(-1e6).max(1e6)).length(16),
          })
          .strict(),
      )
      .min(2)
      .max(BLENDER_TRACK_LIMITS.maxFrames),
  })
  .strict()
  .refine(
    (t) =>
      t.cameras.every((c, i) => i === 0 || c.frame > t.cameras[i - 1].frame),
    "The solved cameras are in frame order, each once.",
  )
  .refine(
    (t) =>
      t.cameras.length >= Math.ceil(0.8 * t.frames) &&
      t.cameras.every((c) => c.frame <= t.frames),
    "The solved cameras cover most of the clip, within it.",
  );
export type CameraTrack = z.infer<typeof CameraTrackSchema>;

/**
 * How far the camera turned between its first and last solved frames, in degrees, from the
 * rotation parts of the two matrices.
 */
export function cameraTurnDegrees(track: CameraTrack): number {
  const first = track.cameras[0].matrix;
  const last = track.cameras[track.cameras.length - 1].matrix;
  const r = (m: number[], row: number, col: number) => m[row * 4 + col];
  // trace(R_firstᵀ · R_last) = 1 + 2 cos(angle)
  let trace = 0;
  for (let i = 0; i < 3; i++)
    for (let k = 0; k < 3; k++) trace += r(first, k, i) * r(last, k, i);
  const cos = Math.min(1, Math.max(-1, (trace - 1) / 2));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * The axis the camera turned about, first to last solved frame, in the first camera's own axes
 * (a unit vector; the identity gives 0, 0, 0).
 */
export function cameraTurnAxis(track: CameraTrack): [number, number, number] {
  const first = track.cameras[0].matrix;
  const last = track.cameras[track.cameras.length - 1].matrix;
  // R = R_firstᵀ · R_last; its axis is (R32 - R23, R13 - R31, R21 - R12).
  const r = (row: number, col: number) =>
    first[row] * last[col] +
    first[1 * 4 + row] * last[1 * 4 + col] +
    first[2 * 4 + row] * last[2 * 4 + col];
  const axis = [r(2, 1) - r(1, 2), r(0, 2) - r(2, 0), r(1, 0) - r(0, 1)];
  const n = Math.hypot(...axis);
  return (n ? axis.map((v) => v / n) : [0, 0, 0]) as [number, number, number];
}

/** The direction the camera moved, first to last solved frame, in the first camera's own axes. */
export function cameraTravelDirection(
  track: CameraTrack,
): [number, number, number] {
  const first = track.cameras[0].matrix;
  const last = track.cameras[track.cameras.length - 1].matrix;
  const d = [3, 7, 11].map((i) => last[i] - first[i]);
  // Into the first camera's axes: Rᵀ · d.
  const local = [0, 1, 2].map(
    (col) => first[col] * d[0] + first[4 + col] * d[1] + first[8 + col] * d[2],
  );
  const n = Math.hypot(...local) || 1;
  return local.map((v) => v / n) as [number, number, number];
}
