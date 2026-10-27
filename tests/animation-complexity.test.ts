// YU-022: bounded animation compilation. The bounded compiler matches the
// per-frame reference within its tolerance on every frame (holds, steps,
// linear, Bezier, both ends); its graph grows with the curve's travel, not
// the clip's frames; undrawable animation is refused before any render; and
// rendered video and audio follow the sampled curve.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ANIMATION_COMPILER,
  ANIMATION_COMPILER_V1,
  MAX_PLAN_SAMPLES,
  MAX_PLAN_SEGMENTS,
  assertPlanAnimationBudget,
  renderableAnimationChannels,
  sampleAnimationPathAtLocalTime,
  OPACITY_TOLERANCE,
  VOLUME_TOLERANCE,
  boundedSegments,
  opacityFilterChain,
  perFrameSegments,
  volumeFilterChain,
} from "../core/render/animation-filters.ts";
import { compilePlan } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import { renderRevision } from "../core/render.ts";
import { fromEditView } from "../core/canonical.ts";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { mediaTime } from "../core/animation/media-time.ts";
import type { Channel } from "../core/animation/types.ts";
import { rational } from "../core/time.ts";
import type { Project } from "../core/project.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});
const F = 23_520_000; // one 30 fps frame
const FPS30 = rational(30, 1);
const FPS23976 = rational(24000, 1001);
type Key = Channel<number>["keys"][number];
const key = (
  id: string,
  ticks: number,
  value: number,
  segmentToNext: Key["segmentToNext"] = "linear",
  extra: Partial<Key> = {},
): Key => ({
  id,
  time: mediaTime({ ticks }),
  value,
  segmentToNext,
  tangentMode: "auto",
  ...extra,
});
const channel = (...keys: Key[]): Channel<number> => ({ keys });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};

const curves: [string, Channel<number>, number][] = [
  ["hold", channel(key("a", 0, 0.4, "step")), 90 * F],
  [
    "steps",
    channel(
      key("a", 0, 0.1, "step"),
      key("b", 30 * F, 0.9, "step"),
      key("c", 60 * F, 0.5, "step"),
    ),
    90 * F,
  ],
  [
    "linear with ends held",
    channel(key("a", 10 * F, 0, "linear"), key("b", 70 * F, 1, "linear")),
    90 * F,
  ],
  [
    "bezier",
    channel(
      key("a", 0, 0.2, "bezier", {
        rightHandle: { dt: mediaTime({ ticks: 20 * F }), dv: 0.6 },
        tangentMode: "broken",
      }),
      key("b", 60 * F, 0.8, "linear", {
        leftHandle: { dt: mediaTime({ ticks: -20 * F }), dv: -0.1 },
        tangentMode: "broken",
      }),
    ),
    75 * F,
  ],
];

test("bounded segments match the per-frame reference within half a tolerance on every frame", () => {
  for (const [label, curve, duration] of curves)
    for (const [fps, tol, p] of [
      [FPS30, OPACITY_TOLERANCE, "opacity"],
      [FPS23976, VOLUME_TOLERANCE, "volume"],
    ] as const) {
      const reference = perFrameSegments(curve, p, 0, duration, fps);
      const bounded = boundedSegments(curve, p, 0, duration, fps);
      // The segments tile the span exactly, on frame boundaries.
      assert.equal(bounded[0]!.t0, 0, label);
      assert.equal(bounded.at(-1)!.t1, reference.at(-1)!.t1, label);
      for (let i = 1; i < bounded.length; i++)
        assert.equal(bounded[i]!.t0, bounded[i - 1]!.t1, label);
      for (const frame of reference) {
        const seg = bounded.find((s) => s.t0 <= frame.t0 && frame.t1 <= s.t1);
        assert.ok(seg, `${label}: frame at ${frame.t0} is covered`);
        assert.ok(
          Math.abs(seg.value - frame.value) <= tol / 2 + 1e-12,
          `${label} ${p}: ${seg.value} vs ${frame.value}`,
        );
      }
    }
});

test("graph size follows the curve's travel, not the clip's frames", () => {
  const tenMinutes = 18_000 * F;
  const ramp = channel(key("a", 0, 0, "linear"), key("b", tenMinutes, 1));
  assert.equal(
    perFrameSegments(ramp, "opacity", 0, tenMinutes, FPS30).length,
    18_000,
  );
  const bounded = boundedSegments(ramp, "opacity", 0, tenMinutes, FPS30);
  assert.ok(bounded.length <= 256, String(bounded.length));
  // The filter text is bounded the same way: one filter per segment.
  const chain = opacityFilterChain("in", "out", ramp, {
    clipStartTicks: 0,
    rangeStartTicks: 0,
    rangeEndTicks: tenMinutes,
    fps: FPS30,
  });
  assert.ok(chain.length <= 257, String(chain.length));
  // (The graph goes to FFmpeg as a file, not on the command line.)
  assert.ok(chain.join(";").length < 30_000);
  // A long volume ramp to 2x (+6 dB) compiles too: 400 steps at 1/200.
  const louder = channel(key("a", 0, 0, "linear"), key("b", 1800 * F, 2));
  const louderSegs = boundedSegments(louder, "volume", 0, 1800 * F, FPS30);
  assert.ok(louderSegs.length <= 401, String(louderSegs.length));
  // Holds and steps are one segment per key, however long.
  const steps = channel(
    key("a", 0, 0.25, "step"),
    key("b", 6000 * F, 0.75, "step"),
  );
  assert.equal(
    boundedSegments(steps, "volume", 0, tenMinutes, FPS30).length,
    2,
  );
  assert.equal(volumeFilterChain(steps, tenMinutes, FPS30).length, 2);
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-anim-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const browser = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const project = (
    await execute(browser, "yamakan.project.create", { name: "Animated" })
  ).result as Project;
  return { root, store, browser, projectId: project.id };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;

async function addClip(
  c: Ctx,
  file: string,
  name: string,
  kind: "video" | "audio",
  durationTicks: number,
  animation: object,
) {
  const { asset } = await c.store.importAsset(
    c.projectId,
    name,
    await readFile(file),
  );
  const h = await c.store.load(c.projectId);
  const clipId = crypto.randomUUID();
  return execute(c.browser, "yamakan.project.applyBatch", {
    projectId: c.projectId,
    expectedRevision: h.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: h.tracks.find((t) => t.kind === kind)!.id,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks,
        sourceStartTicks: 0,
      },
      { type: "clip.setAnimation", clipId, animation },
    ],
  });
}

const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
  );

test("rendered opacity and volume follow the sampled curve, steps and ends included", async () => {
  const c = await workspace();
  const red = path.join(c.root, "red.png");
  ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=64x36", "-frames:v", "1", red]);
  const opacity = channel(
    key("a", 0, 0, "linear"),
    key("b", 20 * F, 1, "step"),
    key("c", 40 * F, 0.5, "step"),
  );
  await addClip(c, red, "red.png", "video", 60 * F, {
    opacity: { keys: opacity.keys },
  });
  const tone = path.join(c.root, "tone.wav");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:sample_rate=48000:duration=2",
    "-af",
    "volume=0.5",
    tone,
  ]);
  const volume = channel(
    key("a", 0, 1, "step"),
    key("b", 30 * F, 0.25, "step"),
  );
  await addClip(c, tone, "tone.wav", "audio", 60 * F, {
    volume: { keys: volume.keys },
  });
  const p = await c.store.load(c.projectId);
  const out = await renderRevision(
    c.store,
    c.projectId,
    p.revision,
    ["exports", "anim"],
    new AbortController().signal,
    () => {},
  );
  assert.equal(out.plan.animationCompiler, ANIMATION_COMPILER);
  // Video: each frame's red at the centre is the curve's value at that
  // frame's middle, times 255, within encoder rounding: 8 levels, since in
  // the policy's BT.709 limited range one chroma step moves pure red by
  // about 1.8 levels (YU-023), and FFmpeg builds round it differently.
  const frames = ffmpeg([
    "-i",
    out.output,
    "-vf",
    "crop=2:2:639:359",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
  const reference = perFrameSegments(opacity, "opacity", 0, 60 * F, FPS30);
  // The rendered graph for this clip is bounded: 20 ramp levels, 2 holds.
  const graph = opacityFilterChain("i", "o", opacity, {
    clipStartTicks: 0,
    rangeStartTicks: 0,
    rangeEndTicks: 60 * F,
    fps: FPS30,
  });
  assert.ok(graph.length <= 24, String(graph.length));
  assert.equal(frames.length, 60 * 2 * 2 * 3);
  for (let i = 0; i < 60; i++) {
    const r = frames[i * 12]!;
    const want = reference[i]!.value * 255;
    assert.ok(
      Math.abs(r - want) <= 8,
      `frame ${i}: red ${r}, curve ${want.toFixed(1)}`,
    );
  }
  // Audio: the peak in each half second follows the volume step.
  const pcm = ffmpeg([
    "-i",
    out.output,
    "-map",
    "0:a",
    "-ac",
    "1",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "pipe:1",
  ]);
  const peak = (from: number, to: number) => {
    let m = 0;
    for (let s = from; s < to; s++)
      m = Math.max(m, Math.abs(pcm.readInt16LE(s * 2)));
    return m / 32768;
  };
  const before = peak(4800, 19200); // 0.1–0.4 s: gain 1
  const afterStep = peak(52800, 67200); // 1.1–1.4 s: gain 0.25
  // The mix sets the absolute level; the step sets the ratio (1 → 0.25).
  assert.ok(before > 0.01, `before ${before}`);
  const ratio = afterStep / before;
  assert.ok(Math.abs(ratio - 0.25) < 0.03, `ratio ${ratio}`);
});

test("duplicate keys, undrawable channels and oversized curves fail before rendering", async () => {
  const c = await workspace();
  const red = path.join(c.root, "red.png");
  ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=64x36", "-frames:v", "1", red]);
  await addClip(c, red, "red.png", "video", 60 * F, {});
  const base = fromEditView(await c.store.load(c.projectId));
  const fonts = await titleFonts();
  const plan = (animation: object) => {
    const p = structuredClone(base);
    (p.clips[0] as { animation?: object }).animation = animation;
    return compilePlan(p, "0".repeat(64), fonts);
  };
  const refused = (fn: () => unknown) => {
    try {
      fn();
      return "ok";
    } catch (e) {
      return toCommandError(e).code;
    }
  };
  assert.equal(
    refused(() =>
      plan({
        opacity: { keys: [key("a", 0, 0.2), key("b", 0, 0.8)] },
      }),
    ),
    "VALIDATION",
  );
  assert.equal(
    refused(() =>
      plan({
        "transform.scaleX": { keys: [key("a", 0, 1), key("b", 30 * F, 2)] },
      }),
    ),
    "CAPABILITY_UNAVAILABLE",
  );
  // A curve that swings 0 → 1 → 0 every eight frames: a distinct value on
  // most of its 4096 frames, so it would compile past the cap: refused.
  const flips = Array.from({ length: 512 }, (_, i) =>
    key(`k${i}`, i * 8 * F, i % 2, "linear"),
  );
  const long = structuredClone(base);
  long.clips[0]!.durationTicks = 4096 * F;
  (long.clips[0] as { animation?: object }).animation = {
    opacity: {
      keys: flips,
      extrapolation: { before: "hold", after: "hold" },
    },
  };
  assert.equal(
    refused(() => compilePlan(long, "0".repeat(64), fonts)),
    "LIMIT_EXCEEDED",
  );
  // Non-finite keys never reach a plan: the command refuses them.
  const h = await c.store.load(c.projectId);
  assert.equal(
    await code(
      execute(c.browser, "yamakan.clip.setAnimation", {
        projectId: c.projectId,
        expectedRevision: h.revision,
        clipId: h.clips[0]!.id,
        animation: {
          opacity: {
            keys: [{ ...key("a", 0, 0), value: Number.NaN }],
          },
        },
      }),
    ),
    "VALIDATION",
  );
  // An animation the renderer can draw still compiles, with its version.
  assert.equal(
    plan({ opacity: { keys: [key("a", 0, 0.5, "step")] } }).plan
      .animationCompiler,
    ANIMATION_COMPILER,
  );
  // A plan without animation carries no compiler field (hash unchanged).
  assert.equal(
    compilePlan(base, "0".repeat(64), fonts).plan.animationCompiler,
    undefined,
  );
});

test("the windowed sampler equals sampling the whole channel, frame by frame", () => {
  // Random curves of every segment kind, extrapolated at both ends.
  let seed = 7;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const kinds = ["step", "linear", "bezier"] as const;
  for (let n = 0; n < 6; n++) {
    const keys = Array.from({ length: 40 }, (_, i) =>
      key(
        `k${i}`,
        (5 + i * 13 + Math.floor(rand() * 6)) * F,
        rand(),
        kinds[i % 3],
        i % 3 === 2
          ? {
              rightHandle: {
                dt: mediaTime({ ticks: 4 * F }),
                dv: rand() - 0.5,
              },
              tangentMode: "broken" as const,
            }
          : {},
      ),
    );
    const curve: Channel<number> = {
      keys,
      extrapolation: { before: "linear", after: "linear" },
    };
    const duration = 560 * F;
    const windowed = perFrameSegments(curve, "opacity", 0, duration, FPS30);
    for (const frame of windowed) {
      const mid = frame.t0 + Math.floor((frame.t1 - frame.t0) / 2);
      const whole = Math.min(
        1,
        Math.max(0, sampleAnimationPathAtLocalTime(curve, "opacity", mid, 1)),
      );
      assert.equal(frame.value, whole, `curve ${n} at ${mid}`);
    }
  }
});

test("a window shows the whole export's frames; version 1 stays selectable", () => {
  const ramp = channel(key("a", 0, 0, "linear"), key("b", 90 * F, 1));
  const whole = opacityFilterChain("i", "o", ramp, {
    clipStartTicks: 10 * F,
    rangeStartTicks: 10 * F,
    rangeEndTicks: 100 * F,
    fps: FPS23976,
  });
  // A window starting mid-frame of the clip: its values are the export's.
  const window = opacityFilterChain("i", "o", ramp, {
    clipStartTicks: 10 * F,
    rangeStartTicks: 10 * F + 37 * F + 1234,
    rangeEndTicks: 10 * F + 60 * F,
    fps: FPS23976,
  });
  const values = (chain: string[]) =>
    new Set(chain.map((x) => /aa=([0-9.]+)/.exec(x)?.[1]).filter(Boolean));
  for (const v of values(window)) assert.ok(values(whole).has(v), String(v));
  // Version 1 (per frame) is still compiled when selected, for rollback.
  const v1 = opacityFilterChain("i", "o", ramp, {
    clipStartTicks: 0,
    rangeStartTicks: 0,
    rangeEndTicks: 90 * F,
    fps: FPS30,
    compiler: ANIMATION_COMPILER_V1,
  });
  assert.equal(v1.length, 91);
  process.env.YAMAKAN_ANIMATION_COMPILER = "1";
  try {
    assert.equal(
      volumeFilterChain(ramp, 90 * F, FPS30, ANIMATION_COMPILER_V1).length,
      90,
    );
  } finally {
    delete process.env.YAMAKAN_ANIMATION_COMPILER;
  }
  // The version names its tolerances: changing them needs a new version.
  assert.equal(ANIMATION_COMPILER, "yamakan.animation-compiler/2");
  assert.equal(OPACITY_TOLERANCE, 1 / 255);
  assert.equal(VOLUME_TOLERANCE, 1 / 200);
});

test("out-of-range keys, non-finite curves and plan budgets are refused", async () => {
  const c = await workspace();
  const red = path.join(c.root, "red.png");
  ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=64x36", "-frames:v", "1", red]);
  await addClip(c, red, "red.png", "video", 60 * F, {});
  const base = fromEditView(await c.store.load(c.projectId));
  const fonts = await titleFonts();
  const refused = (animation: object) => {
    const p = structuredClone(base);
    (p.clips[0] as { animation?: object }).animation = animation;
    try {
      compilePlan(p, "0".repeat(64), fonts);
      return "ok";
    } catch (e) {
      return toCommandError(e).code;
    }
  };
  for (const value of [1e22, 1.8e302, -0.5, 1.5])
    assert.equal(
      refused({ opacity: { keys: [key("a", 0, value, "step")] } }),
      "VALIDATION",
      String(value),
    );
  // Extreme handles overshoot; the curve is clamped to the range, not
  // refused (a value that cannot be computed at all is refused).
  assert.equal(
    refused({
      opacity: {
        keys: [
          key("a", 0, 0, "bezier", {
            rightHandle: { dt: mediaTime({ ticks: 10 * F }), dv: 1.7e308 },
            tangentMode: "broken",
          }),
          key("b", 30 * F, 1, "linear", {
            leftHandle: { dt: mediaTime({ ticks: -10 * F }), dv: -1.7e308 },
            tangentMode: "broken",
          }),
        ],
      },
    }),
    "ok",
  );
  // Version 1 is selectable for new plans, and named in them.
  process.env.YAMAKAN_ANIMATION_COMPILER = "1";
  try {
    const p = structuredClone(base);
    (p.clips[0] as { animation?: object }).animation = {
      opacity: { keys: [key("a", 0, 0.5, "step")] },
    };
    assert.equal(
      compilePlan(p, "0".repeat(64), fonts).plan.animationCompiler,
      ANIMATION_COMPILER_V1,
    );
  } finally {
    delete process.env.YAMAKAN_ANIMATION_COMPILER;
  }
  const budget = (segments: number, samples: number) => {
    try {
      assertPlanAnimationBudget({ segments, samples }, ANIMATION_COMPILER);
      return "ok";
    } catch (e) {
      return toCommandError(e).code;
    }
  };
  assert.equal(budget(MAX_PLAN_SEGMENTS, MAX_PLAN_SAMPLES), "ok");
  assert.equal(budget(MAX_PLAN_SEGMENTS + 1, 10), "LIMIT_EXCEEDED");
  assert.equal(budget(10, MAX_PLAN_SAMPLES + 1), "LIMIT_EXCEEDED");
});

test("edge cases of the windowed sampler: one or two keys, keys on frame middles, holds, unsorted keys", () => {
  const mid = Math.floor(F / 2);
  const cases: [string, Channel<number>][] = [
    ["one key", channel(key("a", 7 * F + mid, 0.3, "linear"))],
    [
      "two keys on frame middles, held ends",
      {
        keys: [key("a", 3 * F + mid, 0.1), key("b", 20 * F + mid, 0.9)],
        extrapolation: { before: "hold", after: "hold" },
      },
    ],
    [
      "linear ends, unsorted, before 0 and past the end",
      {
        keys: [
          key("c", 70 * F, 0.2, "bezier", {
            leftHandle: { dt: mediaTime({ ticks: -5 * F }), dv: 0.2 },
            tangentMode: "broken",
          }),
          key("a", -10 * F, 0.5, "bezier"),
          key("b", 30 * F + mid, 0.8, "linear"),
        ],
        extrapolation: { before: "linear", after: "linear" },
      },
    ],
  ];
  for (const [label, curve] of cases) {
    const windowed = perFrameSegments(curve, "opacity", 0, 60 * F, FPS30);
    for (const frame of windowed) {
      const at = frame.t0 + Math.floor((frame.t1 - frame.t0) / 2);
      const whole = Math.min(
        1,
        Math.max(0, sampleAnimationPathAtLocalTime(curve, "opacity", at, 1)),
      );
      assert.equal(frame.value, whole, `${label} at ${at}`);
    }
  }
});

test("a channel without keys draws and compiles nothing", () => {
  assert.deepEqual(
    renderableAnimationChannels({
      opacity: { keys: [] },
      volume: { keys: [] },
    }),
    {},
  );
});
