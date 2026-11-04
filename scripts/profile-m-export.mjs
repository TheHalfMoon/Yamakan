// SS-005a: where one M export window's time goes. Builds the M profile through
// the command layer, captures the exact FFmpeg arguments and graph production
// would run for one segment, stops before running them, then replays controlled
// variants with the pinned FFmpeg. Diagnostic only: it changes no production
// behaviour, limit or evidence file, and a replay is outside the process owner
// (no Job Object), so its times attribute cost and are not export results.
//
// Run it from a work folder: it writes m-window-graph.txt to the current folder.
// --compare-only runs just the owner/direct comparison; --controls-only just
// the identity and its controls.
//
// Usage: node scripts/profile-m-export.mjs [--window N] [--runs N] [--compare-only] [--controls-only]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { mediaTools, workers } from "../core/process/workers.ts";
import { renderPlan } from "../core/render.ts";
import { compilePlan } from "../core/render/plan.ts";
import { planSegments } from "../core/render/segments.ts";
import { titleFonts } from "../core/render/fonts.ts";
import { RESOURCE_POLICY, SCALE_PROFILES } from "../core/command/policy.ts";

const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : Number(process.argv[at + 1]);
};
const windowIndex = option("--window", 6);
const runs = option("--runs", 3);
const compareOnly = process.argv.includes("--compare-only");
const controlsOnly = process.argv.includes("--controls-only");
const profile = SCALE_PROFILES.supported.M;
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const FRAME = 23_520_000; // flicks per 30 fps frame

const root = await mkdtemp(path.join(tmpdir(), "yamakan-profile-m-"));
const store = new ProjectStore(root);
await store.initialize();
const queue = new JobSupervisor(store);
const ctx = {
  store,
  queue,
  recoveryHome: `${root}-recovery`,
  principal: { id: "browser-ui", scopes: new Set(Scopes) },
};
const run = async (op, args) => (await execute(ctx, op, args)).result;
const ffmpeg = mediaTools().ffmpeg;

// Sampled host load, recorded beside each replay.
const hostLoad = () => {
  const text = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "(Get-CimInstance Win32_Processor).LoadPercentage",
    ],
    { encoding: "utf8", windowsHide: true },
  ).stdout.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
};

try {
  // The same timeline as scripts/qualify-editor-scale.mjs: one still on every
  // video track, end to end.
  const project = await run("yamakan.project.create", { name: "Profile M" });
  const blank = await store.load(project.id);
  await run("yamakan.project.save", {
    expectedRevision: blank.revision,
    project: { ...blank, width: profile.width, height: profile.height },
  });
  const still = path.join(root, "still.png");
  spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc2=size=${profile.width}x${profile.height}`,
      "-frames:v",
      "1",
      still,
    ],
    { windowsHide: true },
  );
  const stillBytes = await readFile(still);
  const { asset } = await store.importAsset(
    project.id,
    "still.png",
    stillBytes,
  );
  let head = await store.load(project.id);
  const tracks = head.tracks.filter((t) => t.kind === "video").map((t) => t.id);
  const ops = [];
  for (let total = head.tracks.length; total < profile.tracks; total++) {
    const id = crypto.randomUUID();
    tracks.push(id);
    ops.push({
      type: "track.add",
      trackId: id,
      name: `V${tracks.length}`,
      kind: "video",
    });
  }
  const perTrack = Math.ceil(profile.clips / tracks.length);
  const frames = Math.floor(profile.timelineFrames / perTrack);
  const last = profile.timelineFrames - frames * (perTrack - 1);
  let added = 0;
  for (const trackId of tracks)
    for (let i = 0; i < perTrack && added < profile.clips; i++, added++)
      ops.push({
        type: "clip.add",
        clipId: crypto.randomUUID(),
        trackId,
        assetId: asset.id,
        title: null,
        startTicks: i * frames * FRAME,
        durationTicks: (i === perTrack - 1 ? last : frames) * FRAME,
        sourceStartTicks: 0,
      });
  for (let i = 0; i < ops.length; i += 64) {
    head = await store.load(project.id);
    await run("yamakan.project.applyBatch", {
      projectId: project.id,
      expectedRevision: head.revision,
      operations: ops.slice(i, i + 64),
    });
  }
  head = await store.load(project.id);

  const stored = store.revisionCanonical(project.id, head.revision);
  const { plan, ass } = compilePlan(
    stored.project,
    stored.snapshotHash,
    await titleFonts(),
  );
  const segments = planSegments(plan);
  const segment = segments[windowIndex];
  if (!segment) throw new Error(`There is no window ${windowIndex}.`);

  // Capture the window's real command, then stop before it runs.
  const owner = workers();
  const realRun = owner.run;
  const abort = new AbortController();
  let captured = null;
  owner.run = async (request) => {
    captured = request;
    abort.abort();
    return { code: 1, stdout: "", stderr: "", peakMemoryBytes: null };
  };
  await renderPlan(
    store,
    plan,
    ass,
    ["exports", "profile"],
    abort.signal,
    () => {},
    undefined,
    { ...segment, output: "mp4", streams: "video", wallSeconds: 900 },
  ).catch(() => {});
  owner.run = realRun;
  if (!captured) throw new Error("The window's command was not captured.");
  const dir = captured.cwd;
  const graphFile = path.join(dir, "graph.txt");
  const graph = await readFile(graphFile, "utf8");
  await writeFile(
    path.join(process.cwd(), "m-window-graph.txt"),
    graph.replaceAll(root, "<workspace>"),
  );

  const outputAt = captured.args.indexOf("-c:v");
  const inputArgs = captured.args.slice(0, outputAt);
  const encodeArgs = captured.args
    .slice(outputAt)
    .filter((a) => a !== "worker/render.partial.mp4");
  const seconds = segment.durationTicks / (FRAME * 30);
  const clipLines = graph.split(/;\r?\n/);
  const overlayLines = clipLines.filter((l) => l.includes("overlay="));
  if (!/scale=1920:1080/.test(graph))
    throw new Error("The captured window is not at the M profile's size.");
  // The rewrites below understand only plain chains of one split still.
  if (
    /\bass=/.test(graph) ||
    overlayLines.some((l) => !/^\[[^\]]+\]\[c\d+\]overlay=/.test(l))
  )
    throw new Error("This window has layers the profile cannot rewrite.");

  // The last track's chains: going back from the last chain, each starts
  // earlier than the one after it, until the previous track's last clip.
  const startOf = (line) => Number(/gte\(t,([\d.]+)\)/.exec(line)[1]);
  let KEPT = 1;
  while (
    KEPT < overlayLines.length &&
    startOf(overlayLines[overlayLines.length - KEPT - 1]) <
      startOf(overlayLines[overlayLines.length - KEPT])
  )
    KEPT++;

  // Keeps the last `keep` chains, renumbered. In this fixture every layer is
  // opaque and fills the frame, so only they can show; that is true of this
  // fixture and not of timelines in general, so the identity of the result is
  // measured below and a mismatch fails the run.
  const lastChains = (keep) => {
    const first = overlayLines.length - keep;
    const out = [
      clipLines[0],
      `[0:v]split=${keep}${Array.from({ length: keep }, (_, k) => `[s0_${k}]`).join("")}`,
    ];
    for (let k = 0; k < keep; k++) {
      const n = first + k;
      const chain = clipLines.find((l) => l.endsWith(`[c${n}]`));
      const overlay = clipLines.find((l) => l.endsWith(`[v${n}]`));
      out.push(
        chain.replace(/^\[s0_\d+\]/, `[s0_${k}]`).replace(`[c${n}]`, `[c${k}]`),
        overlay
          .replace(
            /^\[[^\]]+\]\[c\d+\]/,
            `[${k ? `v${k - 1}` : "base"}][c${k}]`,
          )
          .replace(`[v${n}]`, `[v${k}]`),
      );
    }
    out.push(`[v${keep - 1}]setpts=PTS-STARTPTS[picture]`);
    return out.join(";\n");
  };
  const duration = encodeArgs[encodeArgs.indexOf("-t") + 1];
  const nullOutput = ["-t", duration, "-f", "null", "-"];
  const fileOutput = [...encodeArgs, path.join(dir, "worker", "profile.mp4")];
  const variantFile = path.join(dir, "graph-variant.txt");
  const argsFor = async (text) => {
    await writeFile(variantFile, text);
    return inputArgs.map((a) => (a === graphFile ? variantFile : a));
  };
  // Every chain still pulled and synchronized, with nothing drawn.
  const noBlending = graph.replace(/enable='[^']*'/g, "enable='0'");
  const variants = {
    "production graph, encode": { graph, output: fileOutput },
    "production graph, no encode": { graph, output: nullOutput },
    "nothing drawn, no encode": {
      graph: noBlending,
      output: nullOutput,
    },
    "first frame only, no encode": {
      graph,
      output: ["-frames:v", "1", "-f", "null", "-"],
    },
    "last track only, encode": { graph: lastChains(KEPT), output: fileOutput },
    "last track only, no encode": {
      graph: lastChains(KEPT),
      output: nullOutput,
    },
  };
  const measure = async (text, output, benchmark = true) => {
    const args = await argsFor(text);
    const hostCpuPercentBefore = hostLoad();
    const started = performance.now();
    const done = spawnSync(
      ffmpeg,
      [...(benchmark ? ["-benchmark"] : []), ...args, ...output],
      { cwd: dir, encoding: "utf8", windowsHide: true, maxBuffer: 2 ** 26 },
    );
    const bench = /utime=([\d.]+)s stime=([\d.]+)s rtime=([\d.]+)s/.exec(
      done.stderr,
    );
    const rss = /maxrss=(\d+)KiB/.exec(done.stderr);
    return {
      exit: done.status,
      hostCpuPercentBefore,
      wallMs: Math.round(performance.now() - started),
      cpuUserS: bench ? Number(bench[1]) : null,
      cpuSystemS: bench ? Number(bench[2]) : null,
      maxRssMiB: rss ? Math.round(Number(rss[1]) / 1024) : null,
    };
  };

  const results = [];
  for (const [name, variant] of compareOnly || controlsOnly
    ? []
    : Object.entries(variants))
    for (let attempt = 1; attempt <= runs; attempt++) {
      results.push({
        variant: name,
        attempt,
        ...(await measure(variant.graph, variant.output)),
      });
      console.error(JSON.stringify(results.at(-1)));
    }

  // What -benchmark itself adds: paired, the order swapped on each pair.
  const benchmarkOverhead = [];
  for (
    let attempt = 1;
    !compareOnly && !controlsOnly && attempt <= runs;
    attempt++
  ) {
    const first = attempt % 2 === 1;
    const a = await measure(graph, nullOutput, first);
    const b = await measure(graph, nullOutput, !first);
    benchmarkOverhead.push({
      attempt,
      withBenchmarkMs: first ? a.wallMs : b.wallMs,
      withoutBenchmarkMs: first ? b.wallMs : a.wallMs,
    });
    console.error(JSON.stringify(benchmarkOverhead.at(-1)));
  }

  // The filter output of a graph over the whole window. A failed run is an
  // error here, so that two failures can never read as two equal pictures.
  const digest = async (text) => {
    const done = spawnSync(
      ffmpeg,
      [...(await argsFor(text)), "-t", duration, "-f", "md5", "-"],
      { cwd: dir, encoding: "utf8", windowsHide: true, maxBuffer: 2 ** 26 },
    );
    const md5 = /MD5=([0-9a-f]+)/.exec(done.stdout)?.[1];
    if (done.status !== 0 || !md5)
      throw new Error(`A digest failed: ${done.stderr.slice(-400)}`);
    return md5;
  };
  const firstKept = overlayLines.length - KEPT;
  const onChain = (text, n, change) =>
    text
      .split(/;\r?\n/)
      .map((line) => (line.endsWith(`[c${n}]`) ? change(line, n) : line))
      .join(";\n");
  const windowStart = segment.startTicks / 705_600_000;
  // An inverting LUT, through the production filter form (core/render.ts).
  await mkdir(path.join(dir, "luts"), { recursive: true });
  const lutCorners = [];
  for (let b = 1; b >= 0; b--)
    for (let g = 1; g >= 0; g--)
      for (let r = 1; r >= 0; r--) lutCorners.push(`${r} ${g} ${b}`);
  await writeFile(
    path.join(dir, "luts", "control.cube"),
    `LUT_3D_SIZE 2\n${lutCorners.join("\n")}\n`,
  );
  // Removing what lies beneath the changed layer must change the picture when
  // that layer lets it show, and must not when the layer stays opaque.
  const controls = [
    {
      control: "alpha top layer",
      expectDiffers: true,
      change: (line, n) =>
        line.replace(`[c${n}]`, `,colorchannelmixer=aa=0.5[c${n}]`),
    },
    {
      control: "non-covering top layer (transform)",
      expectDiffers: true,
      change: (line) => line.replace("scale=1920:1080:", "scale=960:540:"),
    },
    {
      control: "fading top layer (animation)",
      expectDiffers: true,
      change: (line, n) =>
        line.replace(
          `[c${n}]`,
          `,fade=t=in:st=${windowStart}:d=2:alpha=1[c${n}]`,
        ),
    },
    {
      control: "graded top layer, still opaque (lut3d)",
      expectDiffers: false,
      change: (line) =>
        line.replace(
          /^(\[s0_\d+\])/,
          "$1format=gbrap,lut3d=file=luts/control.cube:interp=tetrahedral,",
        ),
    },
  ];
  const identity = compareOnly
    ? null
    : await (async () => {
        const fullMd5 = await digest(graph);
        const keptMd5 = await digest(lastChains(KEPT));
        return { fullMd5, keptMd5, equal: fullMd5 === keptMd5, kept: KEPT };
      })();
  const negativeControls = [];
  for (const { control, expectDiffers, change } of compareOnly
    ? []
    : controls) {
    const withAll = await digest(onChain(graph, firstKept, change));
    const culled = await digest(onChain(lastChains(KEPT), 0, change));
    negativeControls.push({
      control,
      withAll,
      culled,
      expectDiffers,
      asExpected: (withAll !== culled) === expectDiffers,
    });
  }

  // The same command, through the process owner (as production runs it) and
  // directly, on this host at this moment, the order swapped on each pair.
  const ownerComparison = [];
  // Its own output: a file it leaves behind is not one the owner's restricted
  // worker may replace.
  const directArgs = captured.args.map((a) =>
    a === "worker/render.partial.mp4" ? path.join(dir, "direct.mp4") : a,
  );
  const viaOwner = async () => {
    await rm(path.join(dir, "worker", "render.partial.mp4"), { force: true });
    const started = performance.now();
    const done = await owner.run({
      ...captured,
      signal: new AbortController().signal,
    });
    return { exit: done.code, wallMs: Math.round(performance.now() - started) };
  };
  const viaDirect = () => {
    const started = performance.now();
    const done = spawnSync(ffmpeg, directArgs, {
      cwd: dir,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 ** 26,
    });
    return {
      exit: done.status,
      wallMs: Math.round(performance.now() - started),
    };
  };
  for (let attempt = 1; !controlsOnly && attempt <= runs; attempt++) {
    const ownerFirst = attempt % 2 === 1;
    const first = ownerFirst ? await viaOwner() : viaDirect();
    const second = ownerFirst ? viaDirect() : await viaOwner();
    ownerComparison.push({
      attempt,
      ownerFirst,
      owner: ownerFirst ? first : second,
      direct: ownerFirst ? second : first,
    });
    console.error(JSON.stringify(ownerComparison.at(-1)));
  }
  if (identity?.equal === false || negativeControls.some((c) => !c.asExpected))
    process.exitCode = 1;
  console.log(
    JSON.stringify(
      {
        format: "yamakan.m-window-profile/v2",
        hashes: {
          stillSha256: sha256(stillBytes),
          snapshotHash: stored.snapshotHash,
          graphSha256: sha256(graph),
          resourcePolicySha256: sha256(JSON.stringify(RESOURCE_POLICY)),
        },
        identity,
        negativeControls,
        benchmarkOverhead,
        ownerComparison,
        window: windowIndex,
        windows: segments.length,
        windowSeconds: seconds,
        chains: overlayLines.length,
        inputs: captured.args.filter((a) => a === "-i").length,
        graphLines: clipLines.length,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await queue.close();
  store.close();
  await rm(root, { recursive: true, force: true });
}
