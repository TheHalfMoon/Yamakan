// W18: unlink/relink sound, Flow snapshot, loudnorm parse helpers.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CanonicalProjectSchema,
  FORMAT,
  FORMAT_VERSION,
  type CanonicalProject,
} from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import { compilePlan } from "../core/render/plan.ts";
import { framesToTicks, rational } from "../core/time.ts";
import { FLOW_ENABLED, flowSnapshot } from "../core/flow/snapshot.ts";
import { FRAMEWORK_SMOKE_MANIFEST } from "../core/director/manifest.ts";
import {
  DEFAULT_LOUDNORM_TARGET,
  LOUDNORM_ENABLED,
  parseLoudnormJson,
} from "../core/audio/loudnorm.ts";
import { AUDIO_UNLINK_ENABLED } from "../core/audio/unlink.ts";

const F30 = framesToTicks(1, rational(30, 1));
const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const HASH = "a".repeat(64);

function projectWithVideoSound(): CanonicalProject {
  return CanonicalProjectSchema.parse({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id: id(1),
    name: "W18",
    revision: 0,
    language: "en",
    output: { width: 640, height: 360, fps: rational(30, 1) },
    assets: [
      {
        id: id(10),
        name: "cam.mp4",
        kind: "video",
        hash: HASH,
        extension: "mp4",
        bytes: 1000,
        width: 640,
        height: 360,
        durationTicks: 90 * F30,
        timebase: null,
        hasAudio: true,
      },
    ],
    scenes: [],
    tracks: [
      {
        id: id(2),
        name: "V1",
        kind: "video",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
      {
        id: id(3),
        name: "A1",
        kind: "audio",
        muted: false,
        locked: false,
        solo: false,
        targeted: false,
      },
    ],
    clips: [
      {
        id: id(20),
        trackId: id(2),
        assetId: id(10),
        title: null,
        startTicks: 0,
        durationTicks: 30 * F30,
        sourceStartTicks: 0,
        gainDb: 0,
        fadeInTicks: 0,
        fadeOutTicks: 0,
        sound: {
          enabled: true,
          gainDb: -3,
          fadeInTicks: 0,
          fadeOutTicks: 0,
        },
      },
    ],
  });
}

test("W18 flags stay on", () => {
  assert.equal(AUDIO_UNLINK_ENABLED, true);
  assert.equal(LOUDNORM_ENABLED, true);
  assert.equal(FLOW_ENABLED, true);
});

test("unlink then relink restores the exact render planHash", () => {
  const base = projectWithVideoSound();
  const fonts: never[] = [];
  const before = compilePlan(base, HASH, fonts).plan.planHash;

  const unlinked = applyBatch(base, [
    {
      type: "clip.unlinkSound",
      clipId: id(20),
      audioTrackId: id(3),
      audioClipId: id(30),
    },
  ]);
  assert.equal(unlinked.formatVersion, 4);
  const video = unlinked.clips.find((c) => c.id === id(20))!;
  const audio = unlinked.clips.find((c) => c.id === id(30))!;
  assert.equal(video.sound?.enabled, false);
  assert.equal(audio.trackId, id(3));
  assert.equal(audio.assetId, id(10));
  assert.equal(audio.gainDb, -3);

  const mid = compilePlan(unlinked, HASH, fonts).plan;
  assert.equal(mid.audio.length, 1);
  assert.equal(mid.audio[0].clipId, id(30));
  assert.notEqual(mid.planHash, before);

  const relinked = applyBatch(unlinked, [
    {
      type: "clip.relinkSound",
      clipId: id(20),
      audioClipId: id(30),
    },
  ]);
  assert.equal(relinked.clips.length, 1);
  assert.equal(relinked.clips[0].sound?.enabled, true);
  assert.equal(relinked.clips[0].sound?.gainDb, -3);
  const after = compilePlan(relinked, HASH, fonts).plan.planHash;
  assert.equal(after, before);
});

test("Flow snapshot is read-only and shows stage state", () => {
  const snap = flowSnapshot(FRAMEWORK_SMOKE_MANIFEST, null);
  assert.equal(snap.readOnly, true);
  assert.equal(snap.format, "yamakan.flow-snapshot");
  assert.equal(snap.stages.length, 3);
  assert.equal(snap.stages[0].status, "not_started");
  assert.equal(snap.stages[0].requiresApproval, true);
  // Flow never exposes a command surface — only stage metadata.
  assert.ok(!("commands" in snap));
  assert.ok(!("mutate" in snap));
});

test("loudnorm JSON parser extracts measured fields", () => {
  const stderr = `noise
{
  "input_i": -22.1,
  "input_tp": -3.2,
  "input_lra": 5.5,
  "input_thresh": -32.0,
  "output_i": ${DEFAULT_LOUDNORM_TARGET.I},
  "output_tp": -1.5,
  "output_lra": 5.5,
  "output_thresh": -32.0,
  "normalization_type": "dynamic",
  "target_offset": 0.1
}
`;
  const m = parseLoudnormJson(stderr);
  assert.equal(m.input_i, -22.1);
  assert.equal(m.target_offset, 0.1);
});

test("setSound cannot re-enable while an unlinked audio clip exists", () => {
  const base = projectWithVideoSound();
  const unlinked = applyBatch(base, [
    {
      type: "clip.unlinkSound",
      clipId: id(20),
      audioTrackId: id(3),
      audioClipId: id(30),
    },
  ]);
  assert.throws(
    () =>
      applyBatch(unlinked, [
        { type: "clip.setSound", clipId: id(20), enabled: true },
      ]),
    /Relink the unlinked audio/,
  );
});

test("compilePlan attaches loudnorm target when requested", () => {
  const base = projectWithVideoSound();
  const off = compilePlan(base, HASH, []).plan;
  assert.equal(off.loudnorm, null);
  const on = compilePlan(base, HASH, [], { normalizeLoudness: true }).plan;
  assert.deepEqual(on.loudnorm?.target, { ...DEFAULT_LOUDNORM_TARGET });
  assert.equal(on.loudnorm?.measured, null);
  assert.notEqual(on.planHash, off.planHash);
});
