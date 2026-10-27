// YU-026c: segmented export (policy v3). Segments are cut on frame
// boundaries and cover the timeline exactly; a timeline exported in forced
// segments has exactly the single pass's frame count, the same pictures
// (both are lossy encodes, so every frame is compared by PSNR) and
// bit-identical decoded sound, because the sound is rendered once over the
// whole timeline and only stream-copied into place.
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
import {
  chainsIn,
  planSegments,
  renderSegmented,
} from "../core/render/segments.ts";
import { RESOURCE_POLICY, exportWallSeconds } from "../core/command/policy.ts";
import { framesToTicks } from "../core/time.ts";
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
  }).toString("utf8");
const MINUTE = 705_600_000 * 60;

test("the export wall limit grows with length and is capped (policy v3)", () => {
  assert.equal(RESOURCE_POLICY.policy, "yamakan.resource-policy/v3");
  assert.equal(exportWallSeconds(1), 210);
  assert.equal(exportWallSeconds(2 * MINUTE), 240);
  assert.equal(exportWallSeconds(10 * MINUTE), 480);
  assert.equal(exportWallSeconds(10 * MINUTE + 1), 510);
  assert.equal(exportWallSeconds(100 * MINUTE), 900);
});

for (const [label, fps] of [
  ["30", { num: 30, den: 1 }],
  ["24000/1001", { num: 24000, den: 1001 }],
] as const)
  test(`segments are cut on frame boundaries and cover the timeline at ${label} fps`, () => {
    const frame = framesToTicks(1, fps);
    const frames = 600;
    // 40 one-second clips on overlapping tracks.
    const layers = Array.from({ length: 40 }, (_, i) => ({
      startTicks: (i % 20) * 30 * frame,
      durationTicks: 30 * frame,
    }));
    const plan = {
      profile: { fps },
      durationTicks: frames * frame,
      layers,
    } as unknown as RenderPlan;
    assert.deepEqual(planSegments(plan, 40), [
      { startTicks: 0, durationTicks: plan.durationTicks },
    ]);
    const parts = planSegments(plan, 6);
    assert.ok(parts.length > 1);
    let at = 0;
    for (const p of parts) {
      assert.equal(p.startTicks, at, "contiguous");
      assert.equal(p.startTicks % frame, 0, "starts on a frame");
      assert.equal(p.durationTicks % frame, 0, "a whole number of frames");
      assert.ok(
        chainsIn(plan, p.startTicks, p.startTicks + p.durationTicks) <= 6,
      );
      at += p.durationTicks;
    }
    assert.equal(at, plan.durationTicks, "covers the timeline exactly");
  });

test("a timeline exported in segments matches its single-pass export", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-segments-"));
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
  const project = (
    await execute(ctx, "yamakan.project.create", { name: "Segments" })
  ).result as Project;
  const make = async (name: string, args: string[]) => {
    const file = path.join(root, name);
    ffmpeg([...args, file]);
    return (await store.importAsset(project.id, name, await readFile(file)))
      .asset;
  };
  const clipA = await make("a.mp4", [
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=30:duration=6",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=6",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
  ]);
  const clipB = await make("b.mp4", [
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
  const still = await make("s.png", [
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=160x90",
    "-frames:v",
    "1",
  ]);
  const tone = await make("t.wav", [
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=660:duration=6",
  ]);
  const head = await store.load(project.id);
  const video = head.tracks.find((t) => t.kind === "video")!.id;
  const audio = head.tracks.find((t) => t.kind === "audio")!.id;
  const upper = crypto.randomUUID();
  const F = 23_520_000;
  const clip = (
    trackId: string,
    assetId: string,
    start: number,
    frames: number,
  ) => ({
    type: "clip.add",
    clipId: crypto.randomUUID(),
    trackId,
    assetId,
    title: null,
    startTicks: start * F,
    durationTicks: frames * F,
    sourceStartTicks: 0,
  });
  await execute(ctx, "yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: head.revision,
    operations: [
      { type: "track.add", trackId: upper, name: "Upper", kind: "video" },
      // Footage cut on the base track, a still and footage above it, and a
      // tone on the audio track: 4 s at 30 fps.
      clip(video, clipA.id, 0, 50),
      clip(video, clipB.id, 50, 70),
      clip(upper, still.id, 20, 40),
      clip(upper, clipA.id, 75, 30),
      clip(audio, tone.id, 10, 100),
    ],
  });
  const p = await store.load(project.id);
  const stored = store.revisionCanonical(project.id, p.revision);
  const { plan, ass } = compilePlan(
    stored.project,
    stored.snapshotHash,
    await titleFonts(),
    {},
  );
  // The single pass, and the same plan in segments of at most two chains.
  const segments = planSegments(plan, 2);
  assert.ok(segments.length >= 3, `${segments.length} segments`);
  const signal = new AbortController().signal;
  const single = await renderPlan(
    store,
    plan,
    ass,
    ["exports", "single"],
    signal,
    () => {},
  );
  const joined = await renderSegmented(
    store,
    plan,
    ass,
    ["exports", "joined"],
    segments,
    signal,
    () => {},
  );
  assert.equal(joined.segments, segments.length);
  assert.equal(joined.plan.planHash, single.plan.planHash);
  // Exactly the same frame count.
  const count = (f: string) =>
    Number(
      ffprobe([
        "-count_packets",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=nb_read_packets",
        "-of",
        "csv=p=0",
        f,
      ]).trim(),
    );
  assert.equal(count(joined.output), 120);
  assert.equal(count(single.output), 120);
  // Every frame alike (both lossy, encoded in different GOPs).
  const psnr = ffmpeg([
    "-i",
    joined.output,
    "-i",
    single.output,
    "-lavfi",
    "[0:v][1:v]psnr=stats_file=-",
    "-f",
    "null",
    "-",
  ]).toString("utf8");
  const frames = psnr
    .split(/\r?\n/)
    .filter((l) => l.startsWith("n:"))
    .map((l) => /psnr_avg:(\S+)/.exec(l)![1]!)
    .map((v) => (v === "inf" ? Infinity : Number(v)));
  assert.equal(frames.length, 120);
  const worst = Math.min(...frames);
  assert.ok(worst >= 38, `worst frame PSNR ${worst} dB`);
  // The same decoded sound, bit for bit.
  const sound = (f: string) =>
    ffmpeg(["-i", f, "-map", "0:a:0", "-f", "md5", "-"])
      .toString("utf8")
      .trim();
  assert.equal(sound(joined.output), sound(single.output));
  // The parts were removed after the join.
  assert.deepEqual(
    (await readdir(path.dirname(joined.output))).filter((n) =>
      ["seg", "sound"].includes(n),
    ),
    [],
  );
});
