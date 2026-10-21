// Q1 (W1): the import probe's hasAudio matches an independent ffprobe audio
// stream count over the resource qualification corpus fixtures.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { probe } from "../core/media.ts";
import { closeWorkers, mediaTools } from "../core/process/workers.ts";

const RECEIPT = "docs/evidence/qualification/q1-has-audio.json";
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", ".", `:!${RECEIPT}`);
if (dirty && !process.env.YAMAKAN_QUALIFY_DIRTY)
  throw new Error(`Commit or stash changes before qualifying:\n${dirty}`);

const ffmpeg = (args: string[]) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
const ffprobeStreams = (file: string) => {
  const out = execFileSync(
    mediaTools().ffprobe,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  if (!out) return 0;
  return out.split("\n").filter(Boolean).length;
};

const v = (size: string, rate = 30, seconds = 5) => [
  "-f",
  "lavfi",
  "-i",
  `testsrc2=size=${size}:rate=${rate}:duration=${seconds}`,
];
const a = (seconds = 5) => [
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=440:duration=${seconds}`,
];
const corpus: { name: string; args: string[] }[] = [
  {
    name: "h264-1080p.mp4",
    args: [
      ...v("1920x1080", 30, 10),
      ...a(10),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
    ],
  },
  {
    name: "h264-2160p.mp4",
    args: [
      ...v("3840x2160", 30, 5),
      ...a(5),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
    ],
  },
  {
    name: "tone-600s.wav",
    args: [...a(600), "-c:a", "pcm_s16le"],
  },
  {
    name: "tone-10s.mp3",
    args: [...a(10), "-c:a", "libmp3lame"],
  },
  {
    name: "tone-10s.ogg",
    args: [...a(10), "-c:a", "libvorbis"],
  },
  {
    name: "still.png",
    args: ["-f", "lavfi", "-i", "color=c=red:s=640x360", "-frames:v", "1"],
  },
  {
    name: "video-only.mp4",
    args: [...v("640x360", 30, 3), "-pix_fmt", "yuv420p", "-c:v", "libx264"],
  },
];

const root = await mkdtemp(path.join(tmpdir(), "yamakan-q1-"));
const files: Record<string, string> = {};
try {
  await mkdir(path.join(root, "media"), { recursive: true });
  for (const item of corpus) {
    const file = path.join(root, item.name);
    ffmpeg([...item.args, file]);
    files[item.name] = file;
  }
  const rows: {
    file: string;
    probeHasAudio: boolean;
    ffprobeAudioStreams: number;
    match: boolean;
  }[] = [];
  for (const [name, file] of Object.entries(files)) {
    const meta = await probe(file);
    const streams = ffprobeStreams(file);
    const probeHasAudio = meta.hasAudio;
    const match = probeHasAudio === streams > 0;
    rows.push({
      file: name,
      probeHasAudio,
      ffprobeAudioStreams: streams,
      match,
    });
  }
  const passed = rows.every((r) => r.match);
  const receipt = {
    receipt: "yamakan.qualification/q1-has-audio/1",
    commit: git("rev-parse", "HEAD"),
    measuredAt: new Date().toISOString(),
    ffprobeSha256: createHash("sha256")
      .update(await readFile(mediaTools().ffprobe))
      .digest("hex"),
    rows,
    passed,
  };
  await writeFile(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ passed, rows }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  closeWorkers();
  await rm(root, { recursive: true, force: true });
}
