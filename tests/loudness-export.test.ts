// SS-012: real two-pass exports. A job says truthfully whether its sound was
// measured, sound too quiet to measure is refused in plain words, and output
// lands on the target, with its timing kept.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_LOUDNORM_TARGET } from "../core/audio/loudnorm.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { mediaTools } from "../core/process/workers.ts";
import { ProjectStore } from "../core/store.ts";
import { framesToTicks } from "../core/time.ts";

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
    { windowsHide: true },
  );
const integrated = (file: string) => {
  const { stderr } = spawnSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-map",
      "a:0",
      "-af",
      "ebur128",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  return Number([...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)![1]);
};
const firstSound = (file: string) => {
  const pcm = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-map",
      "a:0",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "s16le",
      "-",
    ],
    { windowsHide: true, maxBuffer: 1 << 28 },
  );
  for (let i = 0; i + 1 < pcm.length; i += 2)
    if (Math.abs(pcm.readInt16LE(i)) > 300) return i / 2 / 48000;
  return null;
};

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-loudness-"));
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
  const call = async (operation: string, args: object) =>
    (await execute(ctx, operation, args)).result;
  return { root, store, queue, call };
}
type Workspace = Awaited<ReturnType<typeof workspace>>;

const F = framesToTicks(1, { num: 30, den: 1 });
async function timeline(
  w: Workspace,
  source: string,
  options: { startFrames?: number; muted?: boolean } = {},
) {
  const project = (await w.call("yamakan.project.create", {
    name: "Sound",
  })) as {
    id: string;
  };
  const make = async (name: string, args: string[]) => {
    const file = path.join(w.root, `${crypto.randomUUID()}${name}`);
    ffmpeg([...args, file]);
    return (await w.store.importAsset(project.id, name, await readFile(file)))
      .asset;
  };
  const tone = await make("t.wav", ["-f", "lavfi", "-i", source]);
  const still = await make("s.png", [
    "-f",
    "lavfi",
    "-i",
    "color=c=gray:s=160x90",
    "-frames:v",
    "1",
  ]);
  const head = await w.store.load(project.id);
  const video = head.tracks.find((t) => t.kind === "video")!.id;
  const audio = head.tracks.find((t) => t.kind === "audio")!.id;
  const add = (
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
  await w.call("yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: head.revision,
    operations: [
      add(video, still.id, 0, 120),
      add(audio, tone.id, options.startFrames ?? 0, 60),
      ...(options.muted
        ? [{ type: "track.update", trackId: audio, muted: true }]
        : []),
    ],
  });
  return project.id;
}
async function exported(w: Workspace, projectId: string, normalize = true) {
  const queued = await w.queue.submit(projectId, crypto.randomUUID(), {
    normalizeLoudness: normalize,
  });
  for (let i = 0; i < 480; i++) {
    const job = w.queue.status(queued.id);
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.state)) return job;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("The export did not finish.");
}
const artifact = (
  w: Workspace,
  projectId: string,
  job: { artifact: string | null },
) =>
  w.store.file(
    projectId,
    ...(job.artifact!.split("/") as [string, ...string[]]),
  );
const tone = (db: number) => `sine=frequency=440:duration=2,volume=${db}dB`;

test("a measured export lands on target and says what it measured", async () => {
  const w = await workspace();
  const projectId = await timeline(w, tone(-30));
  const job = await exported(w, projectId);
  assert.equal(job.state, "COMPLETED");
  assert.equal(job.loudness?.state, "measured");
  assert.equal(job.loudness?.targetI, DEFAULT_LOUDNORM_TARGET.I);
  assert.ok(job.loudness!.inputI! < -30, `input ${job.loudness!.inputI}`);
  const output = integrated(await artifact(w, projectId, job));
  assert.ok(
    Math.abs(output - DEFAULT_LOUDNORM_TARGET.I) <= 1,
    `output ${output} LUFS`,
  );

  // The same revision again: the same sound, the same plan, the same report.
  const again = await exported(w, projectId);
  assert.equal(again.planHash, job.planHash);
  assert.deepEqual(again.loudness, job.loudness);
  assert.ok(
    (await readFile(await artifact(w, projectId, again))).equals(
      await readFile(await artifact(w, projectId, job)),
    ),
  );
});

test("an export that did not ask says off, and its sound is left alone", async () => {
  const w = await workspace();
  const projectId = await timeline(w, tone(-30));
  const job = await exported(w, projectId, false);
  assert.equal(job.state, "COMPLETED");
  assert.deepEqual(job.loudness, { state: "off" });
  assert.ok(integrated(await artifact(w, projectId, job)) < -40);
});

test("sound too quiet to measure is refused in plain words", async () => {
  const w = await workspace();
  for (const source of ["anullsrc=r=48000:cl=mono:d=2", tone(-85)]) {
    const projectId = await timeline(w, source);
    const job = await exported(w, projectId);
    assert.equal(job.state, "FAILED");
    assert.match(job.error!, /too quiet to measure/);
    assert.deepEqual(job.loudness, { state: "unmeasured" });
    // The same sound exports when normalizing is not asked for.
    assert.equal((await exported(w, projectId, false)).state, "COMPLETED");
  }
});

test("a muted track has nothing to measure, and the job says so", async () => {
  const w = await workspace();
  const projectId = await timeline(w, tone(-20), { muted: true });
  const job = await exported(w, projectId);
  assert.equal(job.state, "COMPLETED");
  assert.deepEqual(job.loudness, { state: "unmeasured" });
});

test("delayed sound keeps its start when normalized", async () => {
  const w = await workspace();
  const projectId = await timeline(w, tone(-20), { startFrames: 60 });
  const job = await exported(w, projectId);
  assert.equal(job.loudness?.state, "measured");
  const start = firstSound(await artifact(w, projectId, job));
  assert.ok(start !== null && Math.abs(start - 2) < 0.05, `starts at ${start}`);
});

test("the report survives a reopen, and undo leaves the original sound", async () => {
  const w = await workspace();
  const projectId = await timeline(w, tone(-30));
  const job = await exported(w, projectId);
  assert.equal(job.loudness?.state, "measured");
  const before = await w.store.load(projectId);
  await w.call("yamakan.project.undo", {
    projectId,
    expectedRevision: before.revision,
  });
  await w.queue.close();
  w.store.close();
  const store = new ProjectStore(w.root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  assert.deepEqual(queue.status(job.id).loudness, job.loudness);
  assert.ok(
    (await store.load(projectId)).assets.some((a) => a.name === "t.wav"),
    "the source is kept",
  );
});

// The level of the decoded sound over a window, in samples at 48 kHz.
const level = (pcm: Buffer, fromSeconds: number, toSeconds: number) => {
  let peak = 0;
  for (let i = Math.round(fromSeconds * 48000); i < toSeconds * 48000; i++)
    peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
  return peak;
};
const decoded = (file: string) =>
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-map",
      "a:0",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "s16le",
      "-",
    ],
    { windowsHide: true, maxBuffer: 1 << 28 },
  );

test("solo and a fade reach the normalized sound", async () => {
  const w = await workspace();
  const projectId = await timeline(w, tone(-20));
  const head = await w.store.load(projectId);
  const clip = head.clips.find((c) => {
    const track = head.tracks.find((t) => t.id === c.trackId);
    return track?.kind === "audio";
  })!;
  const later = (
    await w.store.importAsset(
      projectId,
      "later.wav",
      await (async () => {
        const file = path.join(w.root, `${crypto.randomUUID()}.wav`);
        ffmpeg(["-f", "lavfi", "-i", tone(-20), file]);
        return readFile(file);
      })(),
    )
  ).asset;
  const soloed = crypto.randomUUID();
  const laterClip = crypto.randomUUID();
  await w.call("yamakan.project.applyBatch", {
    projectId,
    expectedRevision: (await w.store.load(projectId)).revision,
    operations: [
      { type: "track.add", trackId: soloed, name: "Solo", kind: "audio" },
      { type: "track.update", trackId: soloed, solo: true },
      {
        type: "clip.add",
        clipId: laterClip,
        trackId: soloed,
        assetId: later.id,
        title: null,
        startTicks: 60 * F,
        durationTicks: 60 * F,
        sourceStartTicks: 0,
      },
    ],
  });
  const solo = await artifact(w, projectId, await exported(w, projectId));
  // The first clip is not soloed, so nothing sounds until the second.
  const start = firstSound(solo);
  assert.ok(start !== null && Math.abs(start - 2) < 0.05, `starts at ${start}`);

  await w.call("yamakan.project.applyBatch", {
    projectId,
    expectedRevision: (await w.store.load(projectId)).revision,
    operations: [
      { type: "clip.setAudio", clipId: laterClip, fadeInTicks: 45 * F },
    ],
  });
  const faded = decoded(
    await artifact(w, projectId, await exported(w, projectId)),
  );
  assert.ok(
    level(faded, 2.05, 2.15) < level(faded, 3.6, 3.7) / 2,
    "the fade rises",
  );
  // The first clip's source stays in the project.
  assert.ok(
    (await w.store.load(projectId)).clips.some((c) => c.id === clip.id),
  );
});
