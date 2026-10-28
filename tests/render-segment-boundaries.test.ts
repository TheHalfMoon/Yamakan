// YU-026d: segmented export across its boundaries. One timeline holds a
// dissolve that a segment boundary splits, an inverting LUT, a scaled
// still whose opacity ramps across another boundary, and a tone exported
// with two-pass loudness. Rendered whole and in segments, at 30 and
// 24000/1001 fps, the two must have exactly the same frames at the same
// times (every frame compared by PSNR, both encodes being lossy), the
// same decoded sound bit for bit with the same start, and pass the
// export's own exact frame check. Cancels at each stage stop the export,
// leave no parts, and a retry then succeeds; a timeline of more than 32
// clips goes through the job queue segmented and publishes its export.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { mediaTools } from "../core/process/workers.ts";
import { renderPlan } from "../core/render.ts";
import { compilePlan, type RenderPlan } from "../core/render/plan.ts";
import { titleFonts } from "../core/render/fonts.ts";
import { planSegments, renderSegmented } from "../core/render/segments.ts";
import { framesToTicks, type Rational } from "../core/time.ts";
import { mediaTime } from "../core/animation/media-time.ts";
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
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true, maxBuffer: 256 * 1024 * 1024 },
  );
const ffprobe = (args: string[]) =>
  execFileSync(mediaTools().ffprobe, ["-v", "error", ...args], {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");
// An inverting 2³ LUT (exact under interpolation).
const INVERT = [
  'TITLE "Invert"',
  "LUT_3D_SIZE 2",
  "DOMAIN_MIN 0 0 0",
  "DOMAIN_MAX 1 1 1",
  ...[0, 1].flatMap((b) =>
    [0, 1].flatMap((g) => [0, 1].map((r) => `${1 - r} ${1 - g} ${1 - b}`)),
  ),
].join("\n");

async function workspace(frameRate?: Rational) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-boundaries-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const call = async <T>(operation: string, args: object) =>
    (await execute(ctx, operation, args)).result as T;
  const project = await call<Project>("yamakan.project.create", {
    name: "Boundaries",
    ...(frameRate ? { frameRate } : {}),
  });
  const make = async (name: string, args: string[]) => {
    const file = path.join(root, name);
    ffmpeg([...args, file]);
    return (await store.importAsset(project.id, name, await readFile(file)))
      .asset;
  };
  const head = () => store.load(project.id);
  const batch = async (operations: object[]) =>
    call("yamakan.project.applyBatch", {
      projectId: project.id,
      expectedRevision: (await head()).revision,
      operations,
    });
  const planOf = async (normalizeLoudness = false) => {
    const p = await head();
    const stored = store.revisionCanonical(project.id, p.revision);
    return compilePlan(
      {
        ...stored.project,
        output: { ...stored.project.output, width: 320, height: 180 },
      },
      stored.snapshotHash,
      await titleFonts(),
      { normalizeLoudness },
    );
  };
  return { root, store, queue, call, project, make, head, batch, planOf };
}

const packets = (file: string, stream: string) =>
  Number(
    ffprobe([
      "-count_packets",
      "-select_streams",
      stream,
      "-show_entries",
      "stream=nb_read_packets",
      "-of",
      "csv=p=0",
      file,
    ]).trim(),
  );
const times = (file: string) =>
  ffprobe([
    "-select_streams",
    "v:0",
    "-show_entries",
    "packet=pts_time",
    "-of",
    "csv=p=0",
    file,
  ])
    .trim()
    .split(/\r?\n/)
    .map(Number)
    .sort((a, b) => a - b);
const startOf = (file: string, stream: string) =>
  ffprobe([
    "-select_streams",
    stream,
    "-show_entries",
    "stream=start_time",
    "-of",
    "csv=p=0",
    file,
  ]).trim();
const sound = (file: string) =>
  ffmpeg(["-i", file, "-map", "0:a:0", "-f", "md5", "-"])
    .toString("utf8")
    .trim();
const psnrs = (a: string, b: string) =>
  ffmpeg([
    "-i",
    a,
    "-i",
    b,
    "-lavfi",
    "[0:v][1:v]psnr=stats_file=-",
    "-f",
    "null",
    "-",
  ])
    .toString("utf8")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("n:"))
    .map((l) => /psnr_avg:(\S+)/.exec(l)![1]!)
    .map((v) => (v === "inf" ? Infinity : Number(v)));

// Frame n of a file as 320x180 RGB, and two frames' mean squared error.
const rgbFrame = (file: string, n: number) =>
  ffmpeg([
    "-i",
    file,
    "-vf",
    `select=eq(n\\,${n}),scale=320:180`,
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
  ]);
const mse = (a: Buffer, b: Buffer) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
  return sum / a.length;
};
const at = (frame: Buffer, x: number, y: number) => [
  ...frame.subarray((y * 320 + x) * 3, (y * 320 + x) * 3 + 3),
];

// The shared timeline, 120 frames at the project's rate.
async function boundaryTimeline(w: Awaited<ReturnType<typeof workspace>>) {
  const fps = (await w.head()).frameRate ?? { num: 30, den: 1 };
  const F = framesToTicks(1, fps);
  const a = await w.make("a.mp4", [
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=30:duration=6",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
  ]);
  const b = await w.make("b.mp4", [
    "-f",
    "lavfi",
    "-i",
    "smptebars=size=320x180:rate=30:duration=6",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
  ]);
  const still = await w.make("s.png", [
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=160x90",
    "-frames:v",
    "1",
  ]);
  const tone = await w.make("t.wav", [
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=6",
    "-af",
    "volume=0.3",
  ]);
  const lutId = crypto.randomUUID();
  const lut = await w.call<{ document: { contentHash: string } }>(
    "yamakan.lut.import",
    {
      projectId: w.project.id,
      expectedRevision: (await w.head()).revision,
      documentId: lutId,
      expectedContentHash: null,
      name: "Invert",
      text: INVERT,
    },
  );
  const h = await w.head();
  const video = h.tracks.find((t) => t.kind === "video")!.id;
  const audio = h.tracks.find((t) => t.kind === "audio")!.id;
  const upper = crypto.randomUUID();
  const ids = {
    a: crypto.randomUUID(),
    b: crypto.randomUUID(),
    s: crypto.randomUUID(),
    t: crypto.randomUUID(),
  };
  const add = (
    clipId: string,
    trackId: string,
    assetId: string,
    start: number,
    frames: number,
    sourceStart = 0,
  ) => ({
    type: "clip.add",
    clipId,
    trackId,
    assetId,
    title: null,
    startTicks: start * F,
    durationTicks: frames * F,
    sourceStartTicks: sourceStart * F,
  });
  const key = (id: string, frames: number, value: number) => ({
    id,
    time: mediaTime({ ticks: frames * F }),
    value,
    segmentToNext: "linear",
    tangentMode: "auto",
  });
  await w.batch([
    { type: "track.add", trackId: upper, name: "Upper", kind: "video" },
    // A footage cut at frame 60, dissolved over 12 frames (54 to 66).
    add(ids.a, video, a.id, 0, 60),
    add(ids.b, video, b.id, 60, 60, 10),
    {
      type: "clip.setTransition",
      clipId: ids.b,
      transition: {
        kind: "dissolve",
        fromClipId: ids.a,
        durationTicks: 12 * F,
        audio: "equalPower",
      },
    },
    // The first shot inverted by a LUT.
    {
      type: "clip.setEffects",
      clipId: ids.a,
      effects: [
        {
          type: "lut",
          version: 1,
          documentId: lutId,
          contentHash: lut.document.contentHash,
        },
      ],
    },
    // A scaled still fading in from frame 20 to 80.
    add(ids.s, upper, still.id, 20, 80),
    {
      type: "clip.setEffects",
      clipId: ids.s,
      effects: [
        {
          type: "transform",
          version: 1,
          scale: 500,
          offsetX: 0,
          offsetY: 0,
          crop: { left: 0, top: 0, right: 0, bottom: 0 },
        },
      ],
    },
    {
      type: "clip.setAnimation",
      clipId: ids.s,
      animation: { opacity: { keys: [key("k0", 0, 0), key("k1", 60, 1)] } },
    },
    add(ids.t, audio, tone.id, 0, 120),
  ]);
  return { F, fps };
}

for (const [label, frameRate] of [
  ["30", undefined],
  ["24000/1001", { num: 24000, den: 1001 }],
] as const)
  test(`a dissolve, LUT, animated transform and two-pass loudness survive segment boundaries at ${label} fps`, async () => {
    const w = await workspace(frameRate);
    const { F } = await boundaryTimeline(w);
    const { plan, ass } = await w.planOf(true);
    assert.ok(plan.loudnorm, "two-pass loudness requested");
    assert.ok(
      plan.layers.some((l) => l.lut),
      "a LUT layer",
    );
    assert.ok(
      plan.layers.some((l) => l.dissolveInTicks),
      "a dissolve",
    );
    assert.ok(
      plan.layers.some((l) => l.animation),
      "an animated layer",
    );
    // Boundaries inside the opacity ramp (40) and the dissolve (60).
    const segments = [
      { startTicks: 0, durationTicks: 40 * F },
      { startTicks: 40 * F, durationTicks: 20 * F },
      { startTicks: 60 * F, durationTicks: 60 * F },
    ];
    const signal = new AbortController().signal;
    const single = await renderPlan(
      w.store,
      plan,
      ass,
      ["exports", "single"],
      signal,
      () => {},
    );
    const joined = await renderSegmented(
      w.store,
      plan,
      ass,
      ["exports", "joined"],
      segments,
      signal,
      () => {},
    );
    // Both measured loudness once, the same way.
    assert.ok(single.plan.loudnorm?.measured && joined.plan.loudnorm?.measured);
    assert.equal(joined.plan.planHash, single.plan.planHash);
    assert.equal(packets(joined.output, "v:0"), 120);
    assert.equal(packets(single.output, "v:0"), 120);
    assert.deepEqual(times(joined.output), times(single.output));
    const frames = psnrs(joined.output, single.output);
    assert.equal(frames.length, 120);
    const worst = Math.min(...frames);
    assert.ok(
      worst >= 38,
      `worst frame ${frames.indexOf(worst)} at ${worst} dB`,
    );
    // Each boundary's neighbours in particular.
    for (const f of [39, 40, 59, 60])
      assert.ok(frames[f]! >= 38, `frame ${f} at ${frames[f]} dB`);
    // No boundary frame is shifted: each joined frame is closer to the
    // single pass's same frame than to either neighbour.
    for (const n of [39, 40, 59, 60]) {
      const j = rgbFrame(joined.output, n);
      const same = mse(j, rgbFrame(single.output, n));
      for (const other of [n - 1, n + 1])
        assert.ok(
          same < mse(j, rgbFrame(single.output, other)),
          `frame ${n} matches frame ${other} better`,
        );
    }
    // The effects are really drawn, not only alike in both renders.
    const source = path.join(w.root, "a.mp4");
    const near = (got: number[], want: number[], tol: number, what: string) =>
      got.forEach((v, i) =>
        assert.ok(Math.abs(v - want[i]!) <= tol, `${what}: ${got} vs ${want}`),
      );
    // The LUT inverts the first shot (a corner, away from the still).
    const ten = Math.round(10 * (30 / (frameRate ? 24000 / 1001 : 30)));
    near(
      at(rgbFrame(joined.output, 10), 8, 8),
      at(rgbFrame(source, ten), 8, 8).map((v) => 255 - v),
      40,
      "inverted first shot",
    );
    // The dissolve leaves the first shot for the second: before it the
    // corner is the inverted first shot, after it the second shot.
    const corner = (n: number) => at(rgbFrame(joined.output, n), 8, 8);
    near(
      corner(70),
      at(
        rgbFrame(
          path.join(w.root, "b.mp4"),
          Math.round((70 - 60 + 10) * (30 / (frameRate ? 24000 / 1001 : 30))),
        ),
        8,
        8,
      ),
      40,
      "second shot after the dissolve",
    );
    // The still fades in: its red rises across the ramp at the centre.
    const red = (n: number) => at(rgbFrame(joined.output, n), 160, 90)[0]!;
    assert.ok(red(78) - red(22) > 60, `red ${red(22)} → ${red(78)}`);
    // The sound: the same samples, starting at the same time, as long.
    assert.equal(sound(joined.output), sound(single.output));
    assert.equal(startOf(joined.output, "a:0"), startOf(single.output, "a:0"));
    assert.equal(startOf(joined.output, "v:0"), startOf(single.output, "v:0"));
    assert.equal(packets(joined.output, "a:0"), packets(single.output, "a:0"));
  });

test("cancels at each stage stop a segmented export, leave no parts, and a retry succeeds", async () => {
  const w = await workspace();
  const { F } = await boundaryTimeline(w);
  const { plan, ass } = await w.planOf(true);
  const segments = [
    { startTicks: 0, durationTicks: 60 * F },
    { startTicks: 60 * F, durationTicks: 60 * F },
  ];
  // Each worker the export starts is announced while still suspended:
  // the sound (1st), the windows (2nd, 3rd) and the join (4th). A cancel
  // as each starts stops that very worker.
  for (const [stage, worker] of [
    ["sound", 1],
    ["window", 3],
    ["join", 4],
  ] as const) {
    const controller = new AbortController();
    const staging = ["exports", `cancel-${stage}`];
    let started = 0;
    const result = await renderSegmented(
      w.store,
      plan,
      ass,
      staging,
      segments,
      controller.signal,
      () => {},
      () => {
        if (++started === worker) controller.abort();
      },
    ).then(
      () => "ok",
      (e: Error) => e.message,
    );
    assert.equal(result, "Cancelled.", stage);
    const dir = await w.store.file(w.project.id, ...staging);
    assert.deepEqual(
      (await readdir(dir)).filter((n) =>
        ["seg", "sound", "worker", "segments.txt", "render.mp4"].includes(n),
      ),
      [],
      stage,
    );
  }
  // A retry from scratch after the cancels completes exactly.
  const retry = await renderSegmented(
    w.store,
    plan,
    ass,
    ["exports", "retry"],
    segments,
    new AbortController().signal,
    () => {},
  );
  assert.equal(packets(retry.output, "v:0"), 120);
});

test("a timeline of more than 32 clips exports through the job queue in segments", async () => {
  const w = await workspace();
  const still = await w.make("s.png", [
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=64x36",
    "-frames:v",
    "1",
  ]);
  const h = await w.head();
  const video = h.tracks.find((t) => t.kind === "video")!.id;
  const F = framesToTicks(1, { num: 30, den: 1 });
  const tone = await w.make("t.wav", [
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=300:duration=4",
  ]);
  const audio = h.tracks.find((t) => t.kind === "audio")!.id;
  await w.batch([
    {
      type: "clip.add",
      clipId: crypto.randomUUID(),
      trackId: audio,
      assetId: tone.id,
      title: null,
      startTicks: 0,
      durationTicks: 102 * F,
      sourceStartTicks: 0,
    },
  ]);
  await w.batch(
    Array.from({ length: 34 }, (_, i) => ({
      type: "clip.add",
      clipId: crypto.randomUUID(),
      trackId: video,
      assetId: still.id,
      title: null,
      startTicks: i * 3 * F,
      durationTicks: 3 * F,
      sourceStartTicks: 0,
    })),
  );
  const { plan } = await w.planOf();
  assert.ok(
    planSegments(plan as RenderPlan).length > 1,
    "the plan is segmented",
  );
  const job = await w.call<{ id: string; state: string }>(
    "yamakan.export.video",
    {
      projectId: w.project.id,
      idempotencyKey: "segmented",
      normalizeLoudness: true,
    },
  );
  let status = job as {
    id: string;
    state: string;
    artifact?: string | null;
    error?: string | null;
  };
  for (
    let i = 0;
    i < 1800 && !["COMPLETED", "FAILED", "CANCELLED"].includes(status.state);
    i++
  ) {
    await new Promise((r) => setTimeout(r, 100));
    status = await w.call("yamakan.job.status", { jobId: job.id });
  }
  assert.equal(status.state, "COMPLETED", String(status.error));
  // The published export: 34 clips of 3 frames at the project's 1080p.
  const artifact = path.isAbsolute(status.artifact ?? "")
    ? status.artifact!
    : await w.store.file(w.project.id, status.artifact!);
  assert.equal(packets(artifact, "v:0"), 102);
  assert.ok(packets(artifact, "a:0") > 0, "the normalised sound is there");
  // A cancel through the supervisor while it renders: the job ends
  // cancelled and its attempt's folder is removed.
  // A long still on its own track keeps it rendering for a while, so the
  // cancel lands mid-render rather than racing the end.
  const long = crypto.randomUUID();
  await w.batch([
    { type: "track.add", trackId: long, name: "Long", kind: "video" },
    {
      type: "clip.add",
      clipId: crypto.randomUUID(),
      trackId: long,
      assetId: still.id,
      title: null,
      startTicks: 0,
      durationTicks: 3000 * F,
      sourceStartTicks: 0,
    },
  ]);
  const second = await w.call<{ id: string; state: string }>(
    "yamakan.export.video",
    {
      projectId: w.project.id,
      idempotencyKey: "segmented-cancel",
    },
  );
  let s2 = second as { id: string; state: string };
  for (
    let i = 0;
    i < 600 &&
    s2.state !== "RUNNING" &&
    !["COMPLETED", "FAILED", "CANCELLED"].includes(s2.state);
    i++
  ) {
    await new Promise((r) => setTimeout(r, 20));
    s2 = await w.call("yamakan.job.status", { jobId: second.id });
  }
  await w.call("yamakan.job.cancel", { jobId: second.id });
  for (
    let i = 0;
    i < 1800 && !["COMPLETED", "FAILED", "CANCELLED"].includes(s2.state);
    i++
  ) {
    await new Promise((r) => setTimeout(r, 100));
    s2 = await w.call("yamakan.job.status", { jobId: second.id });
  }
  assert.equal(s2.state, "CANCELLED");
  const attempts = await w.store.file(w.project.id, "exports", second.id);
  assert.deepEqual(
    (await readdir(attempts).catch(() => [])).filter((n) =>
      n.startsWith("attempt-"),
    ),
    [],
  );
});
