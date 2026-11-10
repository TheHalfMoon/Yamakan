/**
 * Physical lens metadata for the local Cinema preview. This is not AI model
 * conditioning and it does not alter the canonical project until saved by
 * a separate, qualified scene-persistence operation.
 */
export type CinemaCameraOptics = {
  focalLengthMm: number;
  sensorWidthMm: number;
  near: number;
  far: number;
};

export const CINEMA_LENS_PRESETS_MM = [24, 35, 50, 85] as const;

export function assertCinemaCameraOptics(raw: unknown): CinemaCameraOptics {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Cinema camera intrinsics must be an object");
  }
  const c = raw as Record<string, unknown>;
  const limits: Array<[keyof CinemaCameraOptics, number]> = [
    ["focalLengthMm", 10_000],
    ["sensorWidthMm", 1_000],
    ["near", 1e6],
    ["far", 1e9],
  ];
  for (const [key, maximum] of limits) {
    const n = c[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > maximum) {
      throw new Error("Invalid Cinema camera " + key);
    }
  }
  const optics: CinemaCameraOptics = {
    focalLengthMm: c.focalLengthMm as number,
    sensorWidthMm: c.sensorWidthMm as number,
    near: c.near as number,
    far: c.far as number,
  };
  if (optics.far <= optics.near) {
    throw new Error("Cinema camera far plane must exceed near plane");
  }
  return optics;
}

/**
 * PerspectiveCamera.fov is vertical; the saved sensor width is horizontal.
 * Compute film height from the current viewport aspect before applying it.
 */
export function cinemaVerticalFovDegrees(
  camera: CinemaCameraOptics,
  aspectRatio: number,
): number {
  assertCinemaCameraOptics(camera);
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    throw new Error("Cinema camera aspect ratio must be positive and finite");
  }
  const sensorHeightMm = camera.sensorWidthMm / aspectRatio;
  return (
    (2 * Math.atan(sensorHeightMm / (2 * camera.focalLengthMm)) * 180) / Math.PI
  );
}

/**
 * The preview's size for the width it has: all of it, rounded down (so a phone never scrolls
 * sideways and CSS never squashes it), a 16:9 frame, between 180 and 360 pixels tall.
 */
export function cinemaPreviewSize(hostWidth: number): {
  width: number;
  height: number;
} {
  const width = Math.max(
    1,
    Math.floor(Number.isFinite(hostWidth) && hostWidth > 0 ? hostWidth : 640),
  );
  const height = Math.min(360, Math.max(180, Math.round((width * 9) / 16)));
  return { width, height };
}
