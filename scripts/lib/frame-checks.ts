// What the Blender slice qualification asks of decoded frames (scripts/qualify-blender-e2e.mjs),
// kept apart so it can be tested on frames made to order (tests/frame-checks.test.ts).
//
// Frames are raw RGB24, `cells` pixels each (the export scaled to a small grid).

/** A cell counts as changed when some channel moved by more than this: compression noise
 * stays well below it. */
export const NOISE_LEVELS = 24;

/** The share of the picture, in percent, that must change between frames for motion to count.
 * Measured on the slice's 90° orbit: 3 to 5 %; identical frames: 0 %. */
export const MOTION_PERCENT = 1.5;

/** The share of cells, in percent, that changed by more than noise between two frames. */
export function changedPercent(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length || a.length % 3 !== 0)
    throw new Error("Frames of different sizes.");
  let n = 0;
  for (let x = 0; x < a.length; x += 3)
    if (
      Math.max(
        Math.abs(a[x] - b[x]),
        Math.abs(a[x + 1] - b[x + 1]),
        Math.abs(a[x + 2] - b[x + 2]),
      ) > NOISE_LEVELS
    )
      n++;
  return Math.round((n / (a.length / 3)) * 1000) / 10;
}

/** Whether the picture moved: first to middle, and middle to last, both above the threshold. */
export function moved(first: Uint8Array, middle: Uint8Array, last: Uint8Array) {
  const motion = {
    firstToMiddle: changedPercent(first, middle),
    middleToLast: changedPercent(middle, last),
    firstToLast: changedPercent(first, last),
  };
  return {
    motion,
    moved:
      motion.firstToMiddle > MOTION_PERCENT &&
      motion.middleToLast > MOTION_PERCENT,
  };
}

/** Whether some pixel is clearly blue (as the slice's #3366cc box) and some clearly orange
 * (as its #e07020 box). */
export function boxColours(frames: Uint8Array[]) {
  let bluish = false;
  let orangish = false;
  for (const f of frames)
    for (let x = 0; x < f.length; x += 3) {
      const [r, g, b] = [f[x], f[x + 1], f[x + 2]];
      if (b > r + 40 && b > g + 10) bluish = true;
      if (r > b + 60 && r > g + 20) orangish = true;
    }
  return { bluish, orangish };
}
