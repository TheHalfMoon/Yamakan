/**
 * Comparing a video's frames with those of its export. Frames are tiny raw pictures,
 * so a difference is a mean over the picture, out of 255.
 */
export const FRAME = 64 * 36 * 3;
// Source frames at least this far apart can be told from each other in an export,
// where a right frame already sits about 2 away from its source.
const DISTINCT = 4;

const difference = (a, b) => {
  let total = 0;
  for (let i = 0; i < FRAME; i++) total += Math.abs(a[i] - b[i]);
  return total / FRAME;
};
const frameOf = (raw, n) => raw.subarray(n * FRAME, (n + 1) * FRAME);

/**
 * The export frame from the middle of where source frame n shows, when export frame
 * i shows source frame floor(i / perSource). Null if it does not show at all.
 */
export function exportFrameOf(n, perSource, frames) {
  const first = Math.ceil(n * perSource);
  const last = Math.min(Math.ceil((n + 1) * perSource) - 1, frames - 1);
  return first > last ? null : Math.floor((first + last) / 2);
}

/**
 * How closely an export follows its source. A still stretch of a clip cannot show
 * its order, however it is measured, so `orderedFrames` says how many source frames
 * the order check reached: on a quiet clip that may be few, or none.
 */
export function compareFrames(source, result, perSource) {
  const sourceFrames = source.length / FRAME;
  const frames = result.length / FRAME;
  const shownAt = new Map();
  for (let n = 0; n < sourceFrames; n++) {
    const i = exportFrameOf(n, perSource, frames);
    if (i !== null) shownAt.set(n, i);
  }
  let worst = 0;
  for (const [n, i] of shownAt)
    worst = Math.max(worst, difference(frameOf(source, n), frameOf(result, i)));
  const apart = difference(frameOf(source, 0), frameOf(result, frames - 1));

  // Where two nearby source frames differ, each one's export frame must be closer
  // to its own source frame than to the other's.
  let orderChecks = 0;
  const ordered = new Set();
  const orderFailures = [];
  for (const [n, i] of shownAt)
    for (const m of [n + 1, n + 2]) {
      if (!shownAt.has(m)) continue;
      const a = frameOf(source, n);
      const b = frameOf(source, m);
      if (difference(a, b) < DISTINCT) continue;
      const atA = frameOf(result, i);
      const atB = frameOf(result, shownAt.get(m));
      orderChecks++;
      ordered.add(n).add(m);
      if (
        difference(a, atA) >= difference(b, atA) ||
        difference(b, atB) >= difference(a, atB)
      )
        orderFailures.push([n, m]);
    }
  return {
    shown: shownAt.size,
    worst,
    apart,
    orderChecks,
    orderedFrames: ordered.size,
    orderFailures,
  };
}
