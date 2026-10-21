// W9/M5: clip.setSpeed command and plan/render wiring.
import test from "node:test";
import assert from "node:assert/strict";
import { applyBatch } from "../core/timeline/operations.ts";
import { fromEditView, toEditView } from "../core/canonical.ts";
import { compilePlan } from "../core/render/plan.ts";
import { setClipSpeed } from "../src/edit-ops.ts";
import type { Project } from "../core/project.ts";
import { rational } from "../core/time.ts";

function baseProject(): Project {
  const video = crypto.randomUUID();
  const asset = crypto.randomUUID();
  const clip = crypto.randomUUID();
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: "retime",
    revision: 1,
    fps: 30,
    width: 640,
    height: 360,
    assets: [
      {
        id: asset,
        name: "a.mp4",
        kind: "video",
        hash: "a".repeat(64),
        extension: "mp4",
        bytes: 1000,
        durationFrames: 300,
        width: 640,
        height: 360,
        hasAudio: true,
      },
    ],
    scenes: [],
    tracks: [
      {
        id: video,
        name: "Picture",
        kind: "video",
        muted: false,
        locked: false,
      },
    ],
    clips: [
      {
        id: clip,
        trackId: video,
        assetId: asset,
        startFrame: 0,
        durationFrames: 90,
        sourceFrame: 0,
        title: null,
        sound: { enabled: true },
      },
    ],
  };
}

test("clip.setSpeed stores a rational and projects through edit view", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const next = toEditView(
    applyBatch(fromEditView(p), [
      { type: "clip.setSpeed", clipId, speed: { num: 3, den: 2 } },
    ]),
  );
  assert.deepEqual(next.clips[0]!.speed, { num: 3, den: 2 });
  const viaHelper = setClipSpeed(p, clipId, { num: 2, den: 1 });
  assert.deepEqual(viaHelper.clips[0]!.speed, { num: 2, den: 1 });
});

test("compilePlan carries speed onto video and embedded sound layers", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const canonical = applyBatch(fromEditView(p), [
    { type: "clip.setSpeed", clipId, speed: { num: 2, den: 1 } },
  ]);
  const { plan } = compilePlan(canonical, "b".repeat(64), []);
  assert.deepEqual(plan.layers[0]!.speed, rational(2, 1));
  assert.deepEqual(plan.audio[0]!.speed, rational(2, 1));
});

test("trim and split advance source by rate×timeline delta", () => {
  const p = baseProject();
  const clipId = p.clips[0]!.id;
  const sped = applyBatch(fromEditView(p), [
    { type: "clip.setSpeed", clipId, speed: { num: 2, den: 1 } },
  ]);
  const F = 23_520_000; // one frame at 30 fps
  const trimmed = applyBatch(sped, [
    {
      type: "clip.trim",
      clipId,
      startTicks: 10 * F,
      endTicks: 90 * F,
    },
  ]);
  const c = trimmed.clips.find((x) => x.id === clipId)!;
  // 10 frames of timeline at 2× → 20 frames of source.
  assert.equal(c.sourceStartTicks, 20 * F);
  const rightId = crypto.randomUUID();
  const split = applyBatch(trimmed, [
    {
      type: "clip.split",
      clipId,
      atTicks: c.startTicks + 30 * F,
      newClipId: rightId,
    },
  ]);
  const right = split.clips.find((x) => x.id === rightId)!;
  assert.equal(right.sourceStartTicks, 20 * F + 60 * F);
});

test("titles refuse retime", () => {
  const p = baseProject();
  const titleTrack = crypto.randomUUID();
  const titleClip = crypto.randomUUID();
  p.tracks.push({
    id: titleTrack,
    name: "Titles",
    kind: "video",
    muted: false,
    locked: false,
  });
  p.clips.push({
    id: titleClip,
    trackId: titleTrack,
    assetId: null,
    startFrame: 0,
    durationFrames: 30,
    sourceFrame: 0,
    title: "Hello",
  });
  assert.throws(
    () =>
      applyBatch(fromEditView(p), [
        {
          type: "clip.setSpeed",
          clipId: titleClip,
          speed: { num: 2, den: 1 },
        },
      ]),
    /Titles do not support retime/,
  );
});
