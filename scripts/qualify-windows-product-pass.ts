// Bounded Windows product-quality campaign for the final UX pass (#82).
// Isolated D: QA root when available. Short locally generated media only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";
import { preview } from "../core/render/preview.ts";
import { ANIMATION_ENABLED } from "../core/animation/flags.ts";
import { fromEditView, toEditView } from "../core/canonical.ts";
import { applyBatch } from "../core/timeline/operations.ts";

const RECEIPT = "docs/evidence/qualification/windows-product-pass.json";
const FLICKS_PER_SECOND = 705_600_000;
const QA_ROOT =
  process.env.YAMAKAN_QA_ROOT ||
  (existsSync("D:\\")
    ? "D:\\yamakan-qa-product-pass"
    : path.join(process.cwd(), "work", "yamakan-qa-product-pass"));

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const allowDirty = process.env.YAMAKAN_QA_ALLOW_DIRTY === "1";
const dirty = git("status", "--porcelain", "--", ".", `:!${RECEIPT}`);
if (dirty && !allowDirty)
  throw new Error(`Commit or stash changes before qualifying:\n${dirty}`);
const commit = git("rev-parse", "HEAD");

const ffmpegBin = mediaTools().ffmpeg;
const ffprobeBin = mediaTools().ffprobe;
const ffmpeg = (args: string[], maxBuffer = 64 * 1024 * 1024) =>
  execFileSync(
    ffmpegBin,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    {
      windowsHide: true,
      maxBuffer,
    },
  );
const ffprobeJson = (file: string) =>
  JSON.parse(
    execFileSync(
      ffprobeBin,
      [
        "-hide_banner",
        "-v",
        "error",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  );
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

mkdirSync(QA_ROOT, { recursive: true });
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const root = path.join(QA_ROOT, runId);
await mkdir(root, { recursive: true });
const evidence = path.join(root, "evidence");
await mkdir(evidence, { recursive: true });

const started = performance.now();
const open: { store?: ProjectStore; supervisor?: JobSupervisor } = {};
try {
  const store = (open.store = new ProjectStore(root));
  await store.initialize();
  const created = await store.create("Windows product pass");
  const media = path.join(root, "media");
  await mkdir(media);

  const clipA = path.join(media, "clip-a.mp4");
  const clipB = path.join(media, "clip-b.mp4");
  const tone = path.join(media, "tone.wav");
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=6",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=6",
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    clipA,
  ]);
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=4",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=660:duration=4",
    "-shortest",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    clipB,
  ]);
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=220:duration=5", tone]);

  const a = await store.importAsset(
    created.id,
    "clip-a.mp4",
    await readFile(clipA),
  );
  const b = await store.importAsset(
    created.id,
    "clip-b.mp4",
    await readFile(clipB),
  );
  const s = await store.importAsset(
    created.id,
    "tone.wav",
    await readFile(tone),
  );

  const titles = crypto.randomUUID();
  const picture = s.project.tracks.find((t) => t.kind === "video")!.id;
  const audio = s.project.tracks.find((t) => t.kind === "audio")!.id;
  const clip1 = crypto.randomUUID();
  const clip2 = crypto.randomUUID();
  const clip3 = crypto.randomUUID();
  const titleId = crypto.randomUUID();
  const soundId = crypto.randomUUID();

  const opacity = {
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
  };

  let head = await store.save(
    {
      ...s.project,
      width: 1280,
      height: 720,
      tracks: [
        ...s.project.tracks,
        {
          id: titles,
          name: "Titles",
          kind: "video" as const,
          muted: false,
          locked: false,
        },
      ],
      clips: [
        {
          id: clip1,
          trackId: picture,
          assetId: a.asset.id,
          startFrame: 0,
          durationFrames: 90,
          sourceFrame: 0,
          title: null,
          sound: {
            enabled: true,
            gainDb: 0,
            fadeInFrames: 0,
            fadeOutFrames: 0,
          },
          ...(ANIMATION_ENABLED ? { animation: { opacity } } : {}),
        },
        {
          id: clip2,
          trackId: picture,
          assetId: b.asset.id,
          startFrame: 90,
          durationFrames: 90,
          sourceFrame: 0,
          title: null,
          sound: {
            enabled: true,
            gainDb: 0,
            fadeInFrames: 0,
            fadeOutFrames: 0,
          },
        },
        {
          id: soundId,
          trackId: audio,
          assetId: s.asset.id,
          startFrame: 0,
          durationFrames: 150,
          sourceFrame: 0,
          title: null,
        },
        {
          id: titleId,
          trackId: titles,
          assetId: null,
          startFrame: 30,
          durationFrames: 90,
          sourceFrame: 0,
          title: "يماكن · اختبار الجودة",
        },
      ],
    },
    s.project.revision,
  );

  // Split first picture clip at 2 s through the same reducer as the UI.
  const split = toEditView(
    applyBatch(fromEditView(head), [
      {
        type: "clip.split",
        clipId: clip1,
        atTicks: 2 * FLICKS_PER_SECOND,
        newClipId: clip3,
      },
    ]),
  );
  head = await store.save({ ...split, revision: head.revision }, head.revision);

  const supervisor = (open.supervisor = new JobSupervisor(store));
  await supervisor.start();
  const job = await supervisor.submit(created.id, "product-pass");
  const deadline = Date.now() + 120_000;
  let status = supervisor.status(job.id);
  while (!["COMPLETED", "FAILED", "CANCELLED"].includes(status.state)) {
    if (Date.now() > deadline) throw new Error("Export timed out.");
    await new Promise((r) => setTimeout(r, 250));
    status = supervisor.status(job.id);
  }
  if (status.state !== "COMPLETED")
    throw new Error(`Export ${status.state}: ${status.error}`);

  const file = await store.file(created.id, status.artifact!);
  const mp4 = await readFile(file);
  const mp4Path = path.join(evidence, "export.mp4");
  await writeFile(mp4Path, mp4);
  const probe = ffprobeJson(mp4Path);
  ffmpeg(["-i", mp4Path, "-f", "null", "-"]);
  const frameOut = path.join(evidence, "export-frame-1s.png");
  ffmpeg(["-ss", "1", "-i", mp4Path, "-frames:v", "1", frameOut]);

  const previewResult = await preview(
    store,
    created.id,
    head.revision,
    "frame",
    30,
  );
  const previewPng = await readFile(previewResult.file);
  await writeFile(path.join(evidence, "preview-frame-1s.png"), previewPng);

  const videoStream = (probe.streams ?? []).find(
    (x: { codec_type?: string }) => x.codec_type === "video",
  );
  const audioStream = (probe.streams ?? []).find(
    (x: { codec_type?: string }) => x.codec_type === "audio",
  );
  const elapsedMs = Math.round(performance.now() - started);
  const receipt = {
    policy: "yamakan.windows-product-pass/v1",
    commit,
    runId,
    qaRoot: root,
    elapsedMs,
    animationEnabled: ANIMATION_ENABLED,
    clipsAfterSplit: head.clips.length,
    export: {
      bytes: mp4.length,
      sha256: sha256(mp4),
      duration: Number(probe.format?.duration ?? 0),
      video: videoStream
        ? {
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
          }
        : null,
      audio: audioStream
        ? {
            codec: audioStream.codec_name,
            sampleRate: Number(audioStream.sample_rate),
            channels: audioStream.channels,
          }
        : null,
      decodePass: true,
    },
    previewFrameBytes: previewPng.length,
    exportFrameBytes: (await readFile(frameOut)).length,
    arabicTitle: "يماكن · اختبار الجودة",
    verdict:
      videoStream?.codec_name === "h264" &&
      audioStream?.codec_name === "aac" &&
      Number(probe.format?.duration ?? 0) >= 5
        ? "PASS"
        : "FAIL",
    limitations: [
      "Dev-profile workspace on isolated QA root; not H2 Profile A.",
      "Does not satisfy H1 native Arabic human sign-off.",
      "Single-frame preview/export presence check; not full SSIM campaign.",
      "Public release remains NO-GO.",
    ],
  };
  if (receipt.verdict !== "PASS")
    throw new Error(`Product pass failed: ${JSON.stringify(receipt.export)}`);
  await writeFile(
    path.join(evidence, "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  await writeFile(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  await supervisor.close();
  store.close();
  open.supervisor = open.store = undefined;
} finally {
  try {
    await open.supervisor?.close();
  } catch {}
  try {
    open.store?.close();
  } catch {}
  closeWorkers();
  if (!root.toUpperCase().startsWith("D:"))
    await rm(root, { recursive: true, force: true });
}
