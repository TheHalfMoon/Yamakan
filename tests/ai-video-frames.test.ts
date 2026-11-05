import assert from "node:assert/strict";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { FRAME, compareFrames, exportFramesOf } from "../scripts/ai-video-frames.mjs";

// Each value is a whole frame of that brightness, so differences read directly.
const clip = (values: number[]) =>
  Buffer.concat(values.map((v) => Buffer.alloc(FRAME, v)));
// A still clip with one jump: 12 frames at 100, then 12 at 130.
const jump = Array.from({ length: 24 }, (_, n) => (n < 12 ? 100 : 130));
const RATES = [3.75, 1.25, 30 / 25, 30 / (24000 / 1001), 30 / (30000 / 1001)];
// Each export frame shows the latest source frame to have started by then.
const exported = (values: number[], perSource: number, shift = 0) => {
  const frames = Math.floor(values.length * perSource);
  return Array.from({ length: frames }, (_, i) => {
    let n = 0;
    while (Math.floor((n + 1) * perSource + 0.5) <= i) n++;
    return values[Math.min(values.length - 1, Math.max(0, n + shift))];
  });
};

test("each source frame starts at the project frame nearest its time", () => {
  assert.deepEqual(exportFramesOf(25, 1.25, 51), [31, 32]);
  assert.deepEqual(exportFramesOf(26, 1.25, 51), [33, 33]);
  assert.deepEqual(exportFramesOf(40, 1.25, 51), [50, 50]);
  assert.deepEqual(exportFramesOf(0, 3.75, 183), [0, 3]);
  assert.deepEqual(exportFramesOf(1, 3.75, 183), [4, 7]);
});

test("a source frame the export never reaches is not compared", () => {
  assert.equal(exportFramesOf(2, 1.25, 3), null);
  const result = compareFrames(clip([1, 2, 3]), clip([1, 2, 2]), 1.25);
  assert.equal(result.shown, 2);
});

for (const perSource of RATES) {
  const name = perSource.toFixed(3);
  test(`a faithful export passes at ${name}, with a steady offset`, () => {
    const result = compareFrames(
      clip(jump),
      clip(exported(jump, perSource).map((v) => v - 2)),
      perSource,
    );
    assert.equal(result.problem, null);
    assert.equal(result.worst, 2);
    assert.deepEqual(result.offset, [-2, -2, -2]);
    assert.ok(result.orderChecks > 0);
  });

  for (const shift of [-1, 1]) {
    test(`a shift of ${shift} source frame fails at ${name}`, () => {
      // A jump small enough that only the order rule can see this.
      const small = jump.map((v) => (v === 100 ? 100 : 106));
      const result = compareFrames(
        clip(small),
        clip(exported(small, perSource, shift)),
        perSource,
      );
      assert.match(result.problem, /out of order/);
    });
  }
}

for (const value of [100, 115, 130]) {
  test(`an export frozen at ${value} fails`, () => {
    const result = compareFrames(clip(jump), clip(Array(30).fill(value)), 1.25);
    assert.notEqual(result.problem, null);
  });
}

test("every frame is held to the limit, wherever it falls", () => {
  const values = Array(24).fill(100);
  for (const at of [0, 12, 29]) {
    const delivered = Array(30).fill(100);
    delivered[at] = 108;
    const over = compareFrames(clip(values), clip(delivered), 1.25);
    assert.equal(over.worst, 8);
    assert.match(over.problem, /worst frame/);
    delivered[at] = 107;
    const under = compareFrames(clip(values), clip(delivered), 1.25);
    assert.equal(under.problem, null);
  }
});

test("frames from another part of the clip fail even under the limit", () => {
  const rising = Array.from({ length: 24 }, (_, n) => 100 + Math.floor(n / 4));
  const delivered = exported(rising, 1.25).reverse();
  const result = compareFrames(clip(rising), clip(delivered), 1.25);
  assert.ok(result.worst < 8);
  assert.match(result.problem, /out of order/);
});

test("a tie is not closer", () => {
  // With no steady offset, the middle frame is 5 from its own and 5 from the next.
  const result = compareFrames(clip([100, 110, 120]), clip([95, 115, 120]), 1);
  assert.deepEqual(result.offset, [0, 0, 0]);
  assert.deepEqual(result.orderFailures, [[1, 2]]);
});

test("a still clip passes, and says its order went unchecked", () => {
  const still = Array(24).fill(100);
  const result = compareFrames(clip(still), clip(Array(30).fill(102)), 1.25);
  assert.equal(result.problem, null);
  assert.equal(result.orderChecks, 0);
  assert.equal(result.orderedFrames, 0);
});

test("a clip that returns to its start passes", () => {
  const up = Array.from({ length: 12 }, (_, n) => 100 + n * 3);
  const loop = [...up, ...up.toReversed()];
  const result = compareFrames(clip(loop), clip(exported(loop, 1.25)), 1.25);
  assert.equal(result.problem, null);
  assert.ok(result.orderChecks > 0);
});

test("a swap of neighbours fails", () => {
  const values = [100, 100, 100, 104, 108, 108, 108];
  assert.equal(compareFrames(clip(values), clip(values), 1).problem, null);
  const swapped = [100, 100, 100, 108, 104, 108, 108];
  assert.match(
    compareFrames(clip(values), clip(swapped), 1).problem,
    /out of order/,
  );
});

test("only frames at least the threshold apart are compared", () => {
  const near = [100, 101, 101];
  assert.equal(compareFrames(clip(near), clip(near), 1).orderChecks, 0);
  const far = [100, 102, 102];
  assert.equal(compareFrames(clip(far), clip(far), 1).orderChecks, 2);
});

test("slow drift is checked across the clip", () => {
  const drift = Array.from({ length: 24 }, (_, n) => 100 + Math.floor(n / 8));
  const faithful = compareFrames(
    clip(drift),
    clip(exported(drift, 1.25)),
    1.25,
  );
  assert.equal(faithful.problem, null);
  assert.ok(faithful.orderChecks >= 1);
  const frozen = compareFrames(clip(drift), clip(Array(30).fill(101)), 1.25);
  assert.notEqual(frozen.problem, null);
});

test("the order rule reaches only frames near a change", () => {
  const result = compareFrames(clip(jump), clip(exported(jump, 1.25)), 1.25);
  // Frames 10 and 11 pair with 12 and 13 across the jump, and frame 0 with 23.
  assert.equal(result.orderedFrames, 6);
});
