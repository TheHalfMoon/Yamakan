// YU-071: deterministic scene-cut analysis. Cuts land on the exact source
// frames where a new scene starts, the same on every run, at 30 fps and
// 24000/1001 sources; the source is unchanged; stills, sound, hostile or
// truncated streams, bad thresholds and a cancel are refused cleanly.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import { detectSceneCuts, parseSceneCuts } from "../core/media/repair.ts";
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
const failure = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-scenes-"));
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
    await execute(ctx, "yamakan.project.create", { name: "Scenes" })
  ).result as Project;
  return { root, store, ctx, projectId: project.id };
}
type Ctx = Awaited<ReturnType<typeof workspace>>;

// Black, white and grey, one second each, at a given rate.
async function scenes(
  c: Ctx,
  name: string,
  rate: string,
  audio = false,
  options: { frames?: number[]; offset?: string } = {},
) {
  const file = path.join(c.root, name);
  const frames = options.frames;
  ffmpeg([
    ...["black", "white", "gray"].flatMap((colour, i) => [
      "-f",
      "lavfi",
      "-i",
      frames
        ? `color=${colour}:s=320x180:r=${rate},trim=end_frame=${frames[i]}`
        : `color=${colour}:s=320x180:r=${rate}:d=1`,
    ]),
    ...(audio
      ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=3"]
      : []),
    "-filter_complex",
    "[0][1][2]concat=n=3:v=1:a=0[v]",
    "-map",
    "[v]",
    ...(audio ? ["-map", "3:a", "-c:a", "aac"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    ...(options.offset ? ["-output_ts_offset", options.offset] : []),
    file,
  ]);
  return (await c.store.importAsset(c.projectId, name, await readFile(file)))
    .asset;
}
const cuts = (c: Ctx, assetId: string, threshold?: number) =>
  execute(c.ctx, "yamakan.analysis.sceneCuts", {
    projectId: c.projectId,
    assetId,
    ...(threshold === undefined ? {} : { threshold }),
  }).then(
    (r) =>
      r.result as {
        version: string;
        assetHash: string;
        cuts: { frame: number; sourceTicks: number; score: number }[];
      },
  );

test("scene cuts land on the exact frames a new scene starts, the same every run, and the source is unchanged", async () => {
  const c = await workspace();
  const asset = await scenes(c, "scenes.mp4", "30", true);
  const before = await readFile(
    await c.store.readyObjectFile(c.projectId, asset),
  );
  const first = await cuts(c, asset.id);
  assert.equal(first.version, "yamakan.scene-cuts/v1:scdet");
  assert.equal(first.assetHash, asset.hash);
  assert.deepEqual(
    first.cuts.map((x) => x.frame),
    [30, 60],
  );
  assert.deepEqual(
    first.cuts.map((x) => x.sourceTicks),
    [705_600_000, 2 * 705_600_000],
  );
  assert.ok(first.cuts.every((x) => x.score >= 10 && x.score <= 100));
  // Deterministic: a second run is identical.
  assert.deepEqual(await cuts(c, asset.id), first);
  // A threshold above every change finds none.
  assert.deepEqual((await cuts(c, asset.id, 100)).cuts, []);
  // Nothing about the source changed.
  assert.deepEqual(
    await readFile(await c.store.readyObjectFile(c.projectId, asset)),
    before,
  );
});

test("a 24000/1001 source's cuts are at its own frame times, counted in the project's frames", async () => {
  const c = await workspace();
  const asset = await scenes(c, "film.mp4", "24000/1001");
  // Each second of the source holds 23.976 frames, so the second scene
  // starts on source frame 24 (1.001 s): project frame 30 at 30 fps.
  const found = await cuts(c, asset.id);
  assert.deepEqual(
    found.cuts.map((x) => x.sourceTicks),
    [24 * 29_429_400, 48 * 29_429_400],
  );
  assert.deepEqual(
    found.cuts.map((x) => x.frame),
    [30, 60],
  );
});

test("cut times are exact at uneven frames and count from the source's first frame", async () => {
  const c = await workspace();
  // 31, 29 and 30 frames: cuts at 31/30 s and 2 s, which do not print as
  // short decimals.
  const uneven = await scenes(c, "uneven.mp4", "30", false, {
    frames: [31, 29, 30],
  });
  const found = await cuts(c, uneven.id);
  assert.deepEqual(
    found.cuts.map((x) => [x.frame, x.sourceTicks]),
    [
      [31, 31 * 23_520_000],
      [60, 60 * 23_520_000],
    ],
  );
  // A source whose video starts at 1.4 s: cuts count from its first frame.
  const late = await scenes(c, "late.mp4", "30", false, { offset: "1.4" });
  assert.deepEqual(
    (await cuts(c, late.id)).cuts.map((x) => x.frame),
    [30, 60],
  );
});

test("stills, sound, bad thresholds, a truncated stream and a cancel are refused cleanly", async () => {
  const c = await workspace();
  const png = path.join(c.root, "still.png");
  ffmpeg(["-f", "lavfi", "-i", "color=red:s=320x180", "-frames:v", "1", png]);
  const still = (
    await c.store.importAsset(c.projectId, "still.png", await readFile(png))
  ).asset;
  assert.match(await failure(cuts(c, still.id)), /^VALIDATION: .*footage only/);
  const wav = path.join(c.root, "tone.wav");
  ffmpeg(["-f", "lavfi", "-i", "sine=duration=1", wav]);
  const tone = (
    await c.store.importAsset(c.projectId, "tone.wav", await readFile(wav))
  ).asset;
  assert.match(await failure(cuts(c, tone.id)), /^VALIDATION/);
  const asset = await scenes(c, "scenes.mp4", "30");
  for (const threshold of [0, 101, 2.5])
    assert.match(await failure(cuts(c, asset.id, threshold)), /^VALIDATION/);
  // The stored object is damaged after import (its size kept, its
  // container overwritten): FFmpeg reads it and the analysis fails as
  // unreadable media, with no host path in the message.
  const file = await c.store.readyObjectFile(c.projectId, asset);
  const bytes = await readFile(file);
  const garbage = Buffer.from(bytes);
  garbage.fill(0x5a, 0, garbage.length);
  await writeFile(file, garbage);
  const damaged = await failure(cuts(c, asset.id));
  assert.match(damaged, /^MEDIA_INVALID/);
  assert.doesNotMatch(damaged, /[A-Z]:\\|\/tmp\//);
  await writeFile(file, bytes);
  // A cancel before the call starts no worker; one during the analysis
  // stops it.
  const before = new AbortController();
  before.abort();
  assert.match(
    await failure(
      detectSceneCuts(c.store, c.projectId, asset.id, 10, before.signal),
    ),
    /^UNAVAILABLE: Cancelled/,
  );
  const long = path.join(c.root, "long.mp4");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=60",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    long,
  ]);
  const longAsset = (
    await c.store.importAsset(c.projectId, "long.mp4", await readFile(long))
  ).asset;
  const during = new AbortController();
  const started = Date.now();
  const running = detectSceneCuts(
    c.store,
    c.projectId,
    longAsset.id,
    10,
    during.signal,
  );
  setTimeout(() => during.abort(), 300);
  assert.match(await failure(running), /^UNAVAILABLE: Cancelled/);
  assert.ok(Date.now() - started < 10_000, "the cancel stopped the scan");
  // The parser bounds what it reports.
  const many = Array.from(
    { length: 1002 },
    (_, i) => `frame:${i} pts:${i} pts_time:${i}\nlavfi.scd.score=50`,
  ).join("\n");
  assert.throws(
    () => parseSceneCuts(many, { num: 30, den: 1 }),
    /More than 1000 scene cuts/,
  );
});
