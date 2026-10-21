// M3/M4 edit benchmarks (proposed targets in docs/research/rea-source-reuse/10).
// Reports p95 for ripple and group-move; does not fail the build until
// thresholds are frozen into qualification-policy.
import { performance } from "node:perf_hooks";
import {
  CanonicalProjectSchema,
  FORMAT,
  FORMAT_VERSION,
  type CanonicalProject,
} from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";
import { framesToTicks, rational } from "../core/time.ts";

const F = framesToTicks(1, rational(30, 1));
const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
}

function denseProject(): CanonicalProject {
  const tracks: CanonicalProject["tracks"] = [];
  const clips: CanonicalProject["clips"] = [];
  let clipN = 100;
  // Schema caps: 16 tracks, 200 clips. Title clips need no assets.
  for (let t = 0; t < 16; t++) {
    const trackId = id(10 + t);
    tracks.push({
      id: trackId,
      name: `V${t}`,
      kind: "video",
      muted: false,
      locked: false,
      solo: false,
      targeted: false,
    });
    for (let c = 0; c < 12; c++) {
      clips.push({
        id: id(clipN++),
        trackId,
        assetId: null,
        title: `c${c}`,
        startTicks: c * 10 * F,
        durationTicks: 10 * F,
        sourceStartTicks: 0,
        gainDb: 0,
        fadeInTicks: 0,
        fadeOutTicks: 0,
        sound: null,
      });
    }
  }
  return CanonicalProjectSchema.parse({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id: id(1),
    name: "Bench",
    revision: 0,
    language: "en",
    output: { width: 1280, height: 720, fps: rational(30, 1) },
    assets: [],
    scenes: [],
    tracks,
    clips: clips.slice(0, 200),
  });
}

function measure(label: string, targetMs: number, run: () => void) {
  const samples: number[] = [];
  for (let i = 0; i < 40; i++) {
    const t0 = performance.now();
    run();
    samples.push(performance.now() - t0);
  }
  const value = p95(samples);
  console.log(
    JSON.stringify({
      benchmark: label,
      p95Ms: Number(value.toFixed(3)),
      targetMs,
      ok: value <= targetMs,
      note: "proposed target; not yet a qualification-policy gate",
    }),
  );
}

const base = denseProject();
const victim = base.clips.find((c) => c.trackId === base.tracks[0]!.id)!;

measure("m3-ripple-delete", 50, () => {
  applyBatch(structuredClone(base), [
    { type: "timeline.rippleDelete", clipId: victim.id },
  ]);
});

// OpenCut group-move places one member per track (vertical stack). Pick the
// first clip on each of eight video tracks.
const stacked = base.tracks.slice(0, 8).map((t) => {
  const clip = base.clips.find(
    (c) => c.trackId === t.id && c.startTicks === 0,
  )!;
  return clip.id;
});
const anchor = stacked[0]!;
measure("m4-group-move", 16, () => {
  applyBatch(structuredClone(base), [
    {
      type: "timeline.groupMove",
      anchorClipId: anchor,
      clipIds: stacked,
      anchorStartTicks: 500 * F,
      targetTrackId: base.tracks[0]!.id,
    },
  ]);
});
