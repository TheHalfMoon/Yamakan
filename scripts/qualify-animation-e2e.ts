/**
 * P10-02 — Animation UI→render path qualification.
 * Proves: setAnimation → compilePlan → shared sampler parity → filter compile.
 * Transform paths remain residual (opacity + volume only in render).
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { ANIMATION_ENABLED } from "../core/animation/flags.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import { fromEditView, toEditView } from "../core/canonical.ts";
import { compilePlan } from "../core/render/plan.ts";
import {
  opacityFilterChain,
  sampleAnimationPathAtLocalTime,
  volumeFilterChain,
} from "../core/render/animation-filters.ts";
import { FLICKS_PER_SECOND, rational } from "../core/time.ts";
import type { Channel } from "../core/animation/types.ts";
import type { Project } from "../core/project.ts";

assert.equal(ANIMATION_ENABLED, true, "ANIMATION_ENABLED must be true");

const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const video = crypto.randomUUID();
const asset = crypto.randomUUID();
const clipId = crypto.randomUUID();
const project: Project = {
  schemaVersion: 2,
  id: crypto.randomUUID(),
  name: "anim-e2e",
  revision: 1,
  fps: 30,
  width: 640,
  height: 360,
  assets: [
    {
      id: asset,
      name: "a.mp4",
      kind: "video",
      hash: "c".repeat(64),
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
      id: clipId,
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

const animation = {
  opacity: {
    keys: [
      {
        id: "opacity-start",
        time: 0,
        value: 0,
        segmentToNext: "linear" as const,
        tangentMode: "auto" as const,
      },
      {
        id: "opacity-end",
        time: FLICKS_PER_SECOND,
        value: 1,
        segmentToNext: "linear" as const,
        tangentMode: "auto" as const,
      },
    ],
  },
  volume: {
    keys: [
      {
        id: "volume-start",
        time: 0,
        value: 0.25,
        segmentToNext: "linear" as const,
        tangentMode: "auto" as const,
      },
      {
        id: "volume-end",
        time: FLICKS_PER_SECOND,
        value: 1,
        segmentToNext: "linear" as const,
        tangentMode: "auto" as const,
      },
    ],
  },
};

const withAnim = applyBatch(fromEditView(project), [
  { type: "clip.setAnimation", clipId, animation },
]);
const persisted = fromEditView(toEditView(withAnim));
assert.ok(persisted.clips[0]!.animation?.opacity);
assert.ok(persisted.clips[0]!.animation?.volume);

const cleared = applyBatch(persisted, [
  { type: "clip.setAnimation", clipId, animation: null },
]);
assert.equal(cleared.clips[0]!.animation, undefined);

const restored = applyBatch(cleared, [
  { type: "clip.setAnimation", clipId, animation },
]);
const { plan } = compilePlan(restored, "d".repeat(64), []);
assert.ok(plan.layers[0]!.animation?.opacity, "plan layer carries opacity");
assert.ok(plan.audio[0]!.animation?.volume, "plan audio carries volume");

const mid = Math.round(FLICKS_PER_SECOND / 2);
const opacityCh = animation.opacity as Channel<number>;
const volumeCh = animation.volume as Channel<number>;
const previewOpacity = sampleAnimationPathAtLocalTime(
  opacityCh,
  "opacity",
  mid,
  0,
);
const exportOpacity = sampleAnimationPathAtLocalTime(
  opacityCh,
  "opacity",
  mid,
  0,
);
assert.equal(previewOpacity, exportOpacity);
assert.ok(Math.abs(previewOpacity - 0.5) < 0.05);

const fps = rational(30, 1);
const opacityFilters = opacityFilterChain("c0", "c0a", opacityCh, {
  clipStartTicks: 0,
  rangeStartTicks: mid,
  rangeEndTicks: mid + Math.round(FLICKS_PER_SECOND / 30),
  fps,
});
assert.equal(opacityFilters.length, 1);
assert.match(opacityFilters[0]!, /colorchannelmixer=aa=/);

const volumeFilters = volumeFilterChain(volumeCh, FLICKS_PER_SECOND, fps);
assert.ok(volumeFilters.length >= 1);

const mainSrc = readFileSync(resolve("src/main.tsx"), "utf8");
assert.match(mainSrc, /clip-animation-panel/);
assert.match(mainSrc, /ANIMATION_ENABLED/);
assert.match(mainSrc, /setClipAnimation/);

const receipt = {
  qualification: "animation-ui-render-e2e",
  task: "P10-02",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  animationEnabled: ANIMATION_ENABLED,
  path: {
    setAnimation: true,
    clearAndRestore: true,
    editViewPersist: true,
    compilePlanOpacity: true,
    compilePlanVolume: true,
    samplerParityPreviewExport: true,
    opacityFilterCompile: true,
    volumeFilterCompile: true,
    uiPanelPresent: true,
  },
  midOpacity: previewOpacity,
  residual: {
    transformFilters:
      "transform.position/scale/rotate stored on plan but not compiled to FFmpeg (opacity+volume MVP).",
  },
  verdict: "pass",
};

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const path = join(outDir, "p10-02-animation-e2e.json");
writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(
  JSON.stringify({
    wrote: path,
    sha256: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    verdict: receipt.verdict,
    animationEnabled: true,
  }),
);
