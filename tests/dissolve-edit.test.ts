// SS-014: removing a dissolve in the editor keeps the rule the commit enforces.
import test from "node:test";
import assert from "node:assert/strict";
import { setClipDissolve } from "../src/edit-ops.ts";
import type { Project } from "../core/project.ts";

const withDissolve = (locked: boolean) =>
  ({
    tracks: [{ id: "v", locked }],
    clips: [
      { id: "a", trackId: "v", startFrame: 0, durationFrames: 60 },
      {
        id: "b",
        trackId: "v",
        startFrame: 60,
        durationFrames: 60,
        transition: { kind: "dissolve", fromClipId: "a" },
      },
    ],
  }) as unknown as Project;

test("removing a dissolve on a locked track is refused, naming the lock", () => {
  assert.throws(
    () => setClipDissolve(withDissolve(true), "b", null),
    /Track is locked/,
  );
});

test("removing a dissolve leaves its clip otherwise as it was", () => {
  const [a, b] = setClipDissolve(withDissolve(false), "b", null).clips;
  assert.equal(a.id, "a");
  assert.equal(b.startFrame, 60);
  assert.ok(!("transition" in b));
});
