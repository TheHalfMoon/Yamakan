// M5 / Q6: OpenCut retime with rational rates and atempo chain.
import test from "node:test";
import assert from "node:assert/strict";
import { rational } from "../core/time.ts";
import {
  buildConstantRetime,
  getSourceTimeAtClipTime,
  getTimelineDurationForSourceSpan,
  sourceRange,
  timelineDuration,
  splitRetimeAtClipTime,
} from "../core/donors/opencut/retime/index.ts";
import { atempoChain } from "../core/donors/opencut/retime/atempo.ts";
import { framesToTicks } from "../core/time.ts";

const F = framesToTicks(1, rational(30, 1));

test("rational 2× maps timeline duration to twice the source span", () => {
  const retime = buildConstantRetime({ rate: { num: 2, den: 1 } });
  assert.equal(getSourceTimeAtClipTime({ clipTime: 30 * F, retime }), 60 * F);
  assert.equal(
    getTimelineDurationForSourceSpan({ sourceSpan: 60 * F, retime }),
    30 * F,
  );
  assert.deepEqual(
    sourceRange({ sourceStartTicks: 0, durationTicks: 30 * F, retime }),
    {
      startTicks: 0,
      durationTicks: 60 * F,
    },
  );
  assert.equal(
    timelineDuration({ sourceDurationTicks: 60 * F, retime }),
    30 * F,
  );
});

test("3/2× and 1/2× stay exact in flicks", () => {
  const half = buildConstantRetime({ rate: { num: 1, den: 2 } });
  const threeHalves = buildConstantRetime({ rate: { num: 3, den: 2 } });
  assert.equal(
    getSourceTimeAtClipTime({ clipTime: 40 * F, retime: half }),
    20 * F,
  );
  assert.equal(
    getSourceTimeAtClipTime({ clipTime: 40 * F, retime: threeHalves }),
    60 * F,
  );
});

test("split keeps the same retime on both halves", () => {
  const retime = buildConstantRetime({ rate: { num: 2, den: 1 } });
  const { left, right } = splitRetimeAtClipTime({
    retime,
    splitClipTime: 10 * F,
  });
  assert.deepEqual(left, retime);
  assert.deepEqual(right, retime);
});

test("Q6: atempo chain factors rates into 0.5–2.0 filters", () => {
  assert.deepEqual(atempoChain(rational(2, 1)), ["atempo=2"]);
  assert.deepEqual(atempoChain(rational(1, 2)), ["atempo=0.5"]);
  assert.deepEqual(atempoChain(rational(3, 2)), ["atempo=1.5"]);
  assert.deepEqual(atempoChain(rational(4, 1)), ["atempo=2.0", "atempo=2"]);
});
