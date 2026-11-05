import assert from "node:assert/strict";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { FRAME, compareFrames, exportFrameOf } from "../scripts/ai-video-frames.mjs";

// Each value is a whole frame of that brightness, so differences read directly.
const clip = (values: number[]) =>
  Buffer.concat(values.map((v) => Buffer.alloc(FRAME, v)));
// A still clip with one jump: 12 frames at 100, then 12 at 130.
const jump = Array.from({ length: 24 }, (_, n) => (n < 12 ? 100 : 130));
// Export frame i shows source frame floor(i / perSource).
const exported = (values: number[], perSource: number, shift = 0) => {
  const frames = Math.floor(values.length * perSource);
  return Array.from({ length: frames }, (_, i) => {
    const n = Math.floor(i / perSource) + shift;
    return values[Math.min(values.length - 1, Math.max(0, n))];
  });
};

test("an export frame is one that shows the source frame", () => {
  assert.equal(exportFrameOf(25, 1.25, 51), 32);
  assert.equal(exportFrameOf(40, 1.25, 51), 50);
  assert.equal(exportFrameOf(0, 3.75, 183), 1);
});

test("a source frame the export never reaches is not compared", () => {
  assert.equal(exportFrameOf(2, 1.25, 3), null);
  assert.equal(exportFrameOf(1, 0.5, 2), null);
  const result = compareFrames(clip([1, 2, 3]), clip([1, 2, 2]), 1.25);
  assert.equal(result.shown, 2);
});

for (const perSource of [1.25, 3.75]) {
  test(`a faithful export passes at ${perSource} frames per source frame`, () => {
    const result = compareFrames(
      clip(jump),
      clip(exported(jump, perSource).map((v) => v + 2)),
      perSource,
    );
    assert.equal(result.worst, 2);
    assert.ok(result.apart > result.worst);
    assert.ok(result.orderChecks > 0);
    assert.deepEqual(result.orderFailures, []);
  });

  for (const shift of [-1, 1]) {
    test(`a shift of ${shift} fails at ${perSource}`, () => {
      const result = compareFrames(
        clip(jump),
        clip(exported(jump, perSource, shift)),
        perSource,
      );
      assert.notDeepEqual(result.orderFailures, []);
    });
  }
}

test("a frozen export is not closer to its source than the clip's change", () => {
  const frozen = Array(30).fill(100);
  const result = compareFrames(clip(jump), clip(frozen), 1.25);
  assert.ok(!(result.apart > result.worst));
});

test("a still clip does not fail, and says its order went unchecked", () => {
  const still = Array(24).fill(100);
  const result = compareFrames(clip(still), clip(Array(30).fill(102)), 1.25);
  assert.equal(result.orderChecks, 0);
  assert.equal(result.orderedFrames, 0);
  assert.deepEqual(result.orderFailures, []);
});

test("the order check reaches only frames near a change", () => {
  const result = compareFrames(clip(jump), clip(exported(jump, 1.25)), 1.25);
  // Frames 10 and 11 reach 12 and 13 across the jump; no others differ.
  assert.equal(result.orderedFrames, 4);
});
