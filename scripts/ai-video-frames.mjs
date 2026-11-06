/**
 * Comparing a video's frames with those of its export. Frames are tiny raw pictures,
 * so a difference is a mean over the picture, out of 255.
 */
export const FRAME = 64 * 36 * 3;
// How far off a right frame may be, and how far apart two source frames must be for
// an export to tell them apart once its steady colour offset is taken out.
const LIMIT = 8;
const DISTINCT = 2;

const frameOf = (raw, n) => raw.subarray(n * FRAME, (n + 1) * FRAME);
const difference = (a, b, offset = [0, 0, 0]) => {
  let total = 0;
  for (let i = 0; i < FRAME; i++)
    total += Math.abs(b[i] - a[i] - offset[i % 3]);
  return total / FRAME;
};

/**
 * The export frames that show source frame n, as [first, last]: the export starts
 * each source frame at the project frame nearest its time. Null if it never shows.
 */
export function exportFramesOf(n, perSource, frames) {
  const first = Math.floor(n * perSource + 0.5);
  const last = Math.min(Math.floor((n + 1) * perSource + 0.5) - 1, frames - 1);
  return first > last ? null : [first, last];
}

/**
 * How closely an export follows its source, and `problem` if it does not. Where two
 * compared source frames differ, every export frame of each must be closer to its
 * own, so a fully frozen export fails once any such pair exists. A still stretch
 * cannot show its order: `orderedFrames` says how many source frames this reached,
 * perhaps none. One steady offset is taken out, so a flat-colour fade, whose real
 * offset varies with its colour, can be refused although it is right.
 */
export function compareFrames(source, result, perSource) {
  const sourceFrames = source.length / FRAME;
  const frames = result.length / FRAME;
  const nothing = (problem) => ({
    shown: 0,
    worst: 0,
    offset: [0, 0, 0],
    pairs: 0,
    orderChecks: 0,
    orderedFrames: 0,
    orderFailures: [],
    problem,
  });
  if (!(perSource > 0) || !Number.isFinite(perSource))
    return nothing(`no frame rate to compare at: ${perSource}`);
  if (!Number.isInteger(sourceFrames) || !Number.isInteger(frames))
    return nothing("a part of a frame cannot be compared");
  if (sourceFrames < 1 || frames < 1) return nothing("no frames to compare");
  const shownAt = new Map();
  for (let n = 0; n < sourceFrames; n++) {
    const shown = exportFramesOf(n, perSource, frames);
    if (shown) shownAt.set(n, shown);
  }
  if (shownAt.size === 0) return nothing("no source frame shows in the export");
  let worst = 0;
  let compared = 0;
  const offset = [0, 0, 0];
  for (const [n, [first, last]] of shownAt)
    for (let i = first; i <= last; i++) {
      const a = frameOf(source, n);
      const b = frameOf(result, i);
      worst = Math.max(worst, difference(a, b));
      for (let k = 0; k < FRAME; k++) offset[k % 3] += b[k] - a[k];
      compared++;
    }
  for (let c = 0; c < 3; c++) offset[c] /= (compared * FRAME) / 3;

  const pairs = [];
  const shownFrames = [...shownAt.keys()];
  const firstShown = shownFrames[0];
  const lastShown = shownFrames.at(-1);
  for (const n of shownAt.keys())
    for (const m of [n + 1, n + 2]) if (shownAt.has(m)) pairs.push([n, m]);
  // Slow drift in one direction can stay under the limit between neighbours.
  if (lastShown - firstShown > 2) pairs.push([firstShown, lastShown]);

  const closerToOwn = (n, own, other) => {
    const [first, last] = shownAt.get(n);
    for (let i = first; i <= last; i++) {
      const frame = frameOf(result, i);
      if (difference(own, frame, offset) >= difference(other, frame, offset))
        return false;
    }
    return true;
  };
  let orderChecks = 0;
  const ordered = new Set();
  const orderFailures = [];
  for (const [n, m] of pairs) {
    const a = frameOf(source, n);
    const b = frameOf(source, m);
    if (difference(a, b) < DISTINCT) continue;
    orderChecks++;
    ordered.add(n).add(m);
    if (!closerToOwn(n, a, b) || !closerToOwn(m, b, a))
      orderFailures.push([n, m]);
  }
  let problem = null;
  if (worst >= LIMIT) problem = `worst frame differs by ${worst}`;
  else if (orderFailures.length > 0)
    problem = `frames out of order: ${JSON.stringify(orderFailures)}`;
  return {
    shown: shownAt.size,
    worst,
    offset,
    pairs: pairs.length,
    orderChecks,
    orderedFrames: ordered.size,
    orderFailures,
    problem,
  };
}
