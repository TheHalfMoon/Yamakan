import test from "node:test";
import assert from "node:assert/strict";
import {
  MOTION_PERCENT,
  boxColours,
  changedPercent,
  moved,
} from "../scripts/lib/frame-checks.ts";

// A 64×36 frame of the slice's background colour, with an optional box drawn into it.
const W = 64;
const H = 36;
const frame = (
  box?: { x: number; y: number; w: number; h: number; rgb: number[] },
  noise = 0,
  seed = 1,
) => {
  const f = new Uint8Array(W * H * 3);
  let s = seed;
  const rand = () =>
    ((s = (s * 1103515245 + 12345) & 0x7fffffff) % (2 * noise + 1)) - noise;
  for (let i = 0; i < W * H; i++) {
    f[i * 3] = 0x1a + (noise ? rand() : 0);
    f[i * 3 + 1] = 0x1d + (noise ? rand() : 0);
    f[i * 3 + 2] = 0x21 + (noise ? rand() : 0);
  }
  if (box)
    for (let y = box.y; y < box.y + box.h; y++)
      for (let x = box.x; x < box.x + box.w; x++)
        f.set(box.rgb, (y * W + x) * 3);
  return f;
};
const blue = [0x33, 0x66, 0xcc];
const orange = [0xe0, 0x70, 0x20];

test("a still picture does not count as motion, even with compression-level noise", () => {
  const still = frame({ x: 28, y: 14, w: 6, h: 6, rgb: blue });
  assert.equal(changedPercent(still, still), 0);
  const noisy = (seed: number) =>
    frame({ x: 28, y: 14, w: 6, h: 6, rgb: blue }, 12, seed);
  const result = moved(noisy(1), noisy(2), noisy(3));
  assert.equal(result.moved, false, JSON.stringify(result.motion));
  assert.ok(result.motion.firstToMiddle < MOTION_PERCENT);
});

test("a box that moves across the picture counts as motion", () => {
  const at = (x: number) => frame({ x, y: 14, w: 6, h: 6, rgb: blue });
  const result = moved(at(10), at(30), at(50));
  assert.equal(result.moved, true, JSON.stringify(result.motion));
});

test("motion only at the start, then still, does not count", () => {
  const at = (x: number) => frame({ x, y: 14, w: 6, h: 6, rgb: blue });
  assert.equal(moved(at(10), at(30), at(30)).moved, false);
});

test("the boxes' colours are found, and a picture of one colour has neither", () => {
  assert.deepEqual(boxColours([frame()]), { bluish: false, orangish: false });
  assert.deepEqual(
    boxColours([
      frame({ x: 10, y: 10, w: 4, h: 4, rgb: blue }),
      frame({ x: 30, y: 10, w: 4, h: 4, rgb: orange }),
    ]),
    { bluish: true, orangish: true },
  );
});

test("frames of different sizes are refused", () => {
  assert.throws(() => changedPercent(new Uint8Array(6), new Uint8Array(9)));
});
