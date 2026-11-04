// SS-005a: where one M export window's time goes. Builds the M profile through
// the command layer, captures the exact FFmpeg arguments and graph production
// would run for one segment, stops before running them, then replays controlled
// variants with the pinned FFmpeg. Diagnostic only: it changes no production
// behaviour, limit or evidence file, and a replay is outside the process owner
// (no Job Object), so its times attribute cost and are not export results.
//
// Usage: node scripts/profile-m-export.mjs [--window N] [--runs N]
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
import { SCALE_PROFILES } from "../core/command/policy.ts";

const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : Number(process.argv[at + 1]);
};
const windowIndex = option("--window", 6);
const runs = option("--runs", 3);
const compareOnly = process.argv.includes("--compare-only");
const profile = SCALE_PROFILES.supported.M;
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
const hostLoad = () =>
  Number(
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "(Get-CimInstance Win32_Processor).LoadPercentage",
      ],
      { encoding: "utf8", windowsHide: true },
    ).stdout.trim(),
  );

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
  const { asset } = await store.importAsset(
    project.id,
    "still.png",
    await readFile(still),
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

  // Keeps the last `keep` chains, renumbered. In this fixture every layer is
  // opaque and fills the frame, so the top track alone is visible; that is true
  // of this fixture and not of timelines in general, which is why the identity
  // of the result is checked below.
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
  const nullOutput = [
    "-t",
    encodeArgs[encodeArgs.indexOf("-t") + 1],
    "-f",
    "null",
    "-",
  ];
  const fileOutput = () => [
    ...encodeArgs,
    path.join(dir, "worker", "profile.mp4"),
  ];
  const keepTop = Number(process.env.PROFILE_KEEP_TOP ?? 2);
  const variants = {
    "full: production graph, encode": { graph, output: fileOutput() },
    "full graph, no encode": { graph, output: nullOutput },
    "top track only, encode": {
      graph: lastChains(keepTop),
      output: fileOutput(),
    },
    "top track only, no encode": {
      graph: lastChains(keepTop),
      output: nullOutput,
    },
  };

  const results = [];
  for (const [name, variant] of compareOnly ? [] : Object.entries(variants)) {
    const variantGraph = path.join(dir, "graph-variant.txt");
    await writeFile(variantGraph, variant.graph);
    const args = inputArgs.map((a) => (a === graphFile ? variantGraph : a));
    for (let attempt = 1; attempt <= runs; attempt++) {
      const hostCpuPercentBefore = hostLoad();
      const started = performance.now();
      const done = spawnSync(
        ffmpeg,
        [
          "-benchmark",
          ...args.filter((a) => a !== "pipe:1"),
          ...variant.output,
        ],
        { cwd: dir, encoding: "utf8", windowsHide: true, maxBuffer: 2 ** 26 },
      );
      const bench = /utime=([\d.]+)s stime=([\d.]+)s rtime=([\d.]+)s/.exec(
        done.stderr,
      );
      const rss = /maxrss=(\d+)KiB/.exec(done.stderr);
      results.push({
        variant: name,
        attempt,
        exit: done.status,
        hostCpuPercentBefore,
        wallMs: Math.round(performance.now() - started),
        cpuUserS: bench ? Number(bench[1]) : null,
        cpuSystemS: bench ? Number(bench[2]) : null,
        maxRssMiB: rss ? Math.round(Number(rss[1]) / 1024) : null,
      });
      console.error(JSON.stringify(results.at(-1)));
    }
  }
  // Decoded identity of the two graphs over the whole window.
  const digest = async (text) => {
    const file = path.join(dir, "graph-variant.txt");
    await writeFile(file, text);
    const done = spawnSync(
      ffmpeg,
      [
        ...inputArgs
          .map((a) => (a === graphFile ? file : a))
          .filter((a) => a !== "pipe:1"),
        "-t",
        encodeArgs[encodeArgs.indexOf("-t") + 1],
        "-f",
        "md5",
        "-",
      ],
      { cwd: dir, encoding: "utf8", windowsHide: true, maxBuffer: 2 ** 26 },
    );
    return /MD5=([0-9a-f]+)/.exec(done.stdout)?.[1] ?? null;
  };
  const fullMd5 = compareOnly ? null : await digest(graph);
  const topMd5 = compareOnly ? null : await digest(lastChains(keepTop));

  // Negative controls: when the top layer has alpha or does not cover the
  // frame, removing the layers beneath it must change the picture. Equal
  // digests here would mean the identity above proves nothing.
  const firstKept = overlayLines.length - keepTop;
  const onChain = (text, n, change) =>
    text
      .split(/;\r?\n/)
      .map((line) => (line.endsWith(`[c${n}]`) ? change(line, n) : line))
      .join(";\n");
  const controls = {
    "alpha top layer": (line, n) =>
      line.replace(`[c${n}]`, `,colorchannelmixer=aa=0.5[c${n}]`),
    "non-covering top layer": (line) =>
      line.replace("scale=1920:1080:", "scale=960:540:"),
  };
  const negativeControls = [];
  for (const [control, change] of compareOnly ? [] : Object.entries(controls)) {
    const withAll = await digest(onChain(graph, firstKept, change));
    const culled = await digest(onChain(lastChains(keepTop), 0, change));
    negativeControls.push({
      control,
      withAll,
      culled,
      differs: withAll !== culled,
    });
  }

  // The same command, alternately through the process owner (as production
  // runs it) and directly, on this host at this moment.
  const ownerComparison = [];
  for (let attempt = 1; attempt <= runs; attempt++) {
    const started = performance.now();
    await rm(path.join(dir, "worker", "render.partial.mp4"), { force: true });
    const viaOwner = await owner.run({
      ...captured,
      signal: new AbortController().signal,
    });
    const ownerWallMs = Math.round(performance.now() - started);
    const directStarted = performance.now();
    // Its own output: a file it leaves behind is not one the owner's restricted
    // worker may replace.
    const directArgs = captured.args.map((a) =>
      a === "worker/render.partial.mp4" ? path.join(dir, "direct.mp4") : a,
    );
    const direct = spawnSync(ffmpeg, directArgs, {
      cwd: dir,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 ** 26,
    });
    ownerComparison.push({
      attempt,
      ownerExit: viaOwner.code,
      ownerWallMs,
      directExit: direct.status,
      directWallMs: Math.round(performance.now() - directStarted),
    });
    console.error(JSON.stringify(ownerComparison.at(-1)));
  }
  console.log(
    JSON.stringify(
      {
        identity: { fullMd5, topMd5, equal: fullMd5 === topMd5, keepTop },
        negativeControls,
        ownerComparison,
        format: "yamakan.m-window-profile/v1",
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
