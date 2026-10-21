// M4: OpenCut multi-clip group move with snapping and kind checks.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CanonicalProjectSchema,
  FORMAT,
  FORMAT_VERSION,
  type CanonicalProject,
} from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import { framesToTicks, rational } from "../core/time.ts";
import { CommandError } from "../core/command/errors.ts";

const F30 = framesToTicks(1, rational(30, 1));
const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

function projectWith(
  tracks: CanonicalProject["tracks"],
  clips: CanonicalProject["clips"],
): CanonicalProject {
  return CanonicalProjectSchema.parse({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id: id(1),
    name: "GroupMove",
    revision: 0,
    language: "en",
    output: { width: 1280, height: 720, fps: rational(30, 1) },
    assets: [],
    scenes: [],
    tracks,
    clips,
  });
}

function title(
  clipId: string,
  trackId: string,
  startFrames: number,
  durationFrames: number,
): CanonicalProject["clips"][number] {
  return {
    id: clipId,
    trackId,
    assetId: null,
    title: `t-${clipId.slice(-4)}`,
    startTicks: startFrames * F30,
    durationTicks: durationFrames * F30,
    sourceStartTicks: 0,
    gainDb: 0,
    fadeInTicks: 0,
    fadeOutTicks: 0,
    sound: null,
  };
}

const videoA = {
  id: id(2),
  name: "V1",
  kind: "video" as const,
  muted: false,
  locked: false,
  solo: false,
  targeted: false,
};
const videoB = {
  id: id(3),
  name: "V2",
  kind: "video" as const,
  muted: false,
  locked: false,
  solo: false,
  targeted: false,
};
const audioA = {
  id: id(4),
  name: "A1",
  kind: "audio" as const,
  muted: false,
  locked: false,
  solo: false,
  targeted: false,
};

test("group move preserves relative offsets", () => {
  const c1 = title(id(10), videoA.id, 0, 20);
  const c2 = title(id(11), videoB.id, 10, 20);
  const before = projectWith([videoA, videoB, audioA], [c1, c2]);
  const after = applyBatch(before, [
    {
      type: "timeline.groupMove",
      anchorClipId: c1.id,
      clipIds: [c1.id, c2.id],
      anchorStartTicks: 40 * F30,
      targetTrackId: videoA.id,
    },
  ]);
  const a = after.clips.find((x) => x.id === c1.id)!;
  const b = after.clips.find((x) => x.id === c2.id)!;
  assert.equal(a.startTicks, 40 * F30);
  assert.equal(b.startTicks - a.startTicks, 10 * F30);
  assert.equal(a.trackId, videoA.id);
  assert.equal(b.trackId, videoB.id);
});

test("group snaps to the nearest edge within the threshold", () => {
  const moving = title(id(20), videoA.id, 0, 10);
  const edge = title(id(21), videoA.id, 50, 10);
  const before = projectWith([videoA, audioA], [moving, edge]);
  const after = applyBatch(before, [
    {
      type: "timeline.groupMove",
      anchorClipId: moving.id,
      clipIds: [moving.id],
      // End at 48 frames; within 5 of edge start (50) → anchor lands at 40.
      anchorStartTicks: 38 * F30,
      targetTrackId: videoA.id,
      snapTicks: 5 * F30,
    },
  ]);
  assert.equal(
    after.clips.find((x) => x.id === moving.id)!.startTicks,
    40 * F30,
  );
});

test("a move refused for overlap leaves the revision unchanged", () => {
  const a = title(id(30), videoA.id, 0, 30);
  const b = title(id(31), videoA.id, 40, 30);
  const before = projectWith([videoA, audioA], [a, b]);
  const snapshot = structuredClone(before);
  assert.throws(
    () =>
      applyBatch(before, [
        {
          type: "timeline.groupMove",
          anchorClipId: a.id,
          clipIds: [a.id],
          // Would land on b.
          anchorStartTicks: 40 * F30,
          targetTrackId: videoA.id,
        },
      ]),
    (e: unknown) => e instanceof CommandError,
  );
  assert.deepEqual(before, snapshot);
});

test("cross-kind placement is refused", () => {
  const v = title(id(40), videoA.id, 0, 20);
  const before = projectWith([videoA, audioA], [v]);
  assert.throws(
    () =>
      applyBatch(before, [
        {
          type: "timeline.groupMove",
          anchorClipId: v.id,
          clipIds: [v.id],
          anchorStartTicks: 0,
          targetTrackId: audioA.id,
        },
      ]),
    (e: unknown) =>
      e instanceof CommandError && /refused|kind|compatible/i.test(e.message),
  );
});

test("group move onto new tracks appends tracks of the member kinds", () => {
  const v = title(id(50), videoA.id, 0, 20);
  const before = projectWith([videoA, audioA], [v]);
  const newId = id(51);
  const after = applyBatch(before, [
    {
      type: "timeline.groupMove",
      anchorClipId: v.id,
      clipIds: [v.id],
      anchorStartTicks: 40 * F30,
      targetTrackId: videoA.id,
      newTrackIds: [newId],
      anchorInsertIndex: 0,
    },
  ]);
  const created = after.tracks.find((t) => t.id === newId);
  assert.ok(created);
  assert.equal(created!.kind, "video");
  assert.equal(after.tracks.at(-1)!.id, newId, "new track is appended");
  assert.equal(after.clips.find((c) => c.id === v.id)!.trackId, newId);
  assert.equal(after.clips.find((c) => c.id === v.id)!.startTicks, 40 * F30);
});
