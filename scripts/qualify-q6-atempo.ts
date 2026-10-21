// Q6 (W9/M5): FFmpeg atempo chains keep exact export duration for rational
// rates 0.5×, 2× and 3/2× (±1 audio frame at 48 kHz). Rubberband is not in
// the pinned Windows FFmpeg build; rates stay on the atempo-exact set.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";
import { probe } from "../core/media.ts";

const RECEIPT = "docs/evidence/qualification/q6-atempo.json";
const SAMPLE_RATE = 48000;
const TOLERANCE_FRAMES = 1;
const TOLERANCE_SEC = TOLERANCE_FRAMES / SAMPLE_RATE;

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", ".", `:!${RECEIPT}`);
if (dirty)
  throw new Error(`Commit or stash changes before qualifying:\n${dirty}`);
const commit = git("rev-parse", "HEAD");

const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );

const rates = [
  { label: "0.5x", key: "q6-half", num: 1, den: 2 },
  { label: "2x", key: "q6-double", num: 2, den: 1 },
  { label: "1.5x", key: "q6-three-halves", num: 3, den: 2 },
] as const;

// Source must cover the fastest rate: 2× of a 6 s timeline needs 12 s of media.
// Clip duration stays 6 s on the timeline; speed changes source span + atempo.
const SOURCE_SEC = 12;
const TIMELINE_SEC = 6;

const root = await mkdtemp(path.join(tmpdir(), "yamakan-q6-"));
const open: { store?: ProjectStore; supervisor?: JobSupervisor } = {};
try {
  const media = path.join(root, "av.mp4");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=640x360:rate=30:duration=${SOURCE_SEC}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:duration=${SOURCE_SEC}`,
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "-shortest",
    media,
  ]);

  open.store = new ProjectStore(path.join(root, "workspace"));
  await open.store.initialize();
  open.supervisor = new JobSupervisor(open.store);
  await open.supervisor.start();

  const rows: {
    label: string;
    speed: { num: number; den: number };
    expectedSec: number;
    measuredSec: number;
    deltaSec: number;
    withinTolerance: boolean;
  }[] = [];

  for (const rate of rates) {
    const created = await open.store.create(rate.key);
    const imported = await open.store.importAsset(
      created.id,
      "av.mp4",
      await readFile(media),
    );
    const head = await open.store.load(created.id);
    const videoTrack = {
      id: crypto.randomUUID(),
      name: "Picture",
      kind: "video" as const,
      muted: false,
      locked: false,
    };
    const clipId = crypto.randomUUID();
    const saved = await open.store.save(
      {
        ...head,
        width: 640,
        height: 360,
        tracks: [videoTrack],
        clips: [
          {
            id: clipId,
            trackId: videoTrack.id,
            assetId: imported.asset.id,
            startFrame: 0,
            durationFrames: TIMELINE_SEC * 30,
            sourceFrame: 0,
            title: null,
            sound: { enabled: true },
            speed: { num: rate.num, den: rate.den },
          },
        ],
      },
      head.revision,
    );
    const job = await open.supervisor.submit(saved.id, rate.key);
    let state = open.supervisor.status(job.id);
    for (
      let i = 0;
      i < 600 && !["COMPLETED", "FAILED", "CANCELLED"].includes(state.state);
      i++
    ) {
      await new Promise((r) => setTimeout(r, 100));
      state = open.supervisor.status(job.id);
    }
    if (state.state !== "COMPLETED")
      throw new Error(
        `Export ${rate.label} failed: ${state.error ?? state.state}`,
      );
    const file = await open.store.file(saved.id, state.artifact!);
    // Exact container duration (seconds), not floor(frames/30).
    const measuredSec = Number(
      execFileSync(
        mediaTools().ffprobe,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "csv=p=0",
          file,
        ],
        { encoding: "utf8", windowsHide: true },
      ).trim(),
    );
    const expectedSec = TIMELINE_SEC;
    const deltaSec = Math.abs(measuredSec - expectedSec);
    rows.push({
      label: rate.label,
      speed: { num: rate.num, den: rate.den },
      expectedSec,
      measuredSec,
      deltaSec,
      withinTolerance: deltaSec <= TOLERANCE_SEC + 1e-6,
    });
    // Sanity: plan still probes.
    await probe(file);
  }

  const passed = rows.every((r) => r.withinTolerance);
  const receipt = {
    receipt: "yamakan.qualification/q6-atempo/1",
    qualification: "Q6",
    module: "M5",
    task: "W9",
    commit,
    measuredAt: new Date().toISOString(),
    sampleRate: SAMPLE_RATE,
    toleranceAudioFrames: TOLERANCE_FRAMES,
    toleranceSec: TOLERANCE_SEC,
    rubberband: false,
    claim:
      "Export at 0.5×, 2× and 3/2× keeps timeline duration within ±1 audio frame via atempo.",
    ffmpegSha256: createHash("sha256")
      .update(await readFile(mediaTools().ffmpeg))
      .digest("hex"),
    rows,
    passed,
  };
  await writeFile(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ passed, rows }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  await open.supervisor?.close();
  open.store?.close();
  closeWorkers();
  await rm(root, { recursive: true, force: true });
}
