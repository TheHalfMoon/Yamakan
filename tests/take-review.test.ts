// SS-006: the derived take review reads the existing take commands and keeps no
// state of its own. What it shows must describe the exact payload apply receives.
import assert from "node:assert/strict";
import test from "node:test";
import {
  proposalIsCurrent,
  refusal,
  shortHash,
  takeRows,
  ticksToSeconds,
  type TakeProposal,
} from "../src/director/take-review.ts";

const listed = {
  documentId: "story",
  contentHash: "c",
  revision: 4,
  shots: [
    {
      shotId: "shot",
      name: "Wide",
      timeline: { clipId: "clip", currentTakeId: "a" },
      problem: null,
      takes: [
        { id: "a", assetHash: "a".repeat(64), kind: "image" },
        { id: "b", assetHash: "b".repeat(64), kind: "video" },
      ],
    },
    {
      shotId: "loose",
      name: "Close",
      timeline: null,
      problem: "split",
      takes: [{ id: "c", assetHash: null, kind: null }],
    },
  ],
};

test("take rows say which take shows and which shots cannot be replaced", () => {
  const rows = takeRows(listed)!;
  assert.deepEqual(
    rows.map((r) => [r.takeId, r.current, r.assembled, r.problem]),
    [
      ["a", true, true, null],
      ["b", false, true, null],
      ["c", false, false, "split"],
    ],
  );
});

test("a malformed answer is not known, never a partial list", () => {
  for (const bad of [
    null,
    {},
    { documentId: "d" },
    { documentId: "d", shots: [{}] },
    { documentId: "d", shots: [{ shotId: "s", name: "n", takes: [{}] }] },
  ])
    assert.equal(takeRows(bad), null);
});

test("a proposal is current only for its own project and revision", () => {
  const proposal = { projectId: "p", revision: 4 } as TakeProposal;
  assert.equal(proposalIsCurrent(proposal, "p", 4), true);
  assert.equal(proposalIsCurrent(proposal, "p", 5), false);
  assert.equal(proposalIsCurrent(proposal, "other", 4), false);
  assert.equal(proposalIsCurrent(proposal, "p", null), false);
});

test("times and media versions read plainly", () => {
  assert.equal(ticksToSeconds(705_600_000), "1.000");
  assert.equal(ticksToSeconds(23_520_000), "0.033");
  assert.equal(shortHash("a".repeat(64)), "a".repeat(12));
  assert.equal(shortHash(null), "—");
});

test("only plain refusals are shown as the service wrote them", () => {
  assert.deepEqual(refusal("REVISION_CONFLICT", "x"), { kind: "stale" });
  assert.deepEqual(refusal("VALIDATION", "A plain reason."), {
    kind: "refused",
    message: "A plain reason.",
  });
  assert.equal(
    (refusal("NOT_FOUND", "x".repeat(500)) as { message: string }).message
      .length,
    200,
  );
  // An internal error can carry host details.
  assert.deepEqual(refusal("INTERNAL", "C:\\Users\\someone"), {
    kind: "failed",
  });
  assert.deepEqual(refusal(undefined, "no code"), { kind: "failed" });
});
