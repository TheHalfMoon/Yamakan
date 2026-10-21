// Q5 (W9/M14): Mediabunny decodes each accepted audio-bearing container in
// Chromium within 2 s. Containers that fail keep the server-derived peaks
// fallback (recorded as decode:false; not a skip-as-pass).
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mediaTools } from "../core/process/workers.ts";

const RECEIPT = "docs/evidence/qualification/q5-mediabunny.json";
const TIMEOUT_MS = 2000;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, "..");
const BUNDLE = path.join(
  REPO,
  "node_modules",
  "mediabunny",
  "dist",
  "bundles",
  "mediabunny.mjs",
);

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const Q6_RECEIPT = "docs/evidence/qualification/q6-atempo.json";
const dirty = git(
  "status",
  "--porcelain",
  "--",
  ".",
  `:!${RECEIPT}`,
  `:!${Q6_RECEIPT}`,
);
if (dirty)
  throw new Error(`Commit or stash changes before qualifying:\n${dirty}`);
const commit = git("rev-parse", "HEAD");

if (!existsSync(BUNDLE))
  throw new Error(`Mediabunny bundle missing at ${BUNDLE}`);

// Fixture encoding only: the R8 pin may omit libvpx; prefer a host build that
// can write every accepted container. Decode under test is Mediabunny, not FFmpeg.
function fixtureFfmpeg() {
  const pinned = mediaTools().ffmpeg;
  const candidates = [process.env.YAMAKAN_FFMPEG_FIXTURE, pinned].filter(
    Boolean,
  );
  try {
    const which = execFileSync("where.exe", ["ffmpeg"], {
      encoding: "utf8",
      windowsHide: true,
    })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    candidates.push(...which);
  } catch {
    /* no PATH ffmpeg */
  }
  for (const bin of candidates) {
    try {
      const out = execFileSync(bin, ["-hide_banner", "-encoders"], {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      });
      if (out.includes("libvpx-vp9") && out.includes("libopus")) return bin;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "No FFmpeg with libvpx-vp9+libopus found to build Q5 fixtures (set YAMAKAN_FFMPEG_FIXTURE).",
  );
}
const ffmpeg = fixtureFfmpeg();
const ffmpegRun = (args) =>
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    windowsHide: true,
  });

const v = (size = "640x360", rate = 30, seconds = 2) => [
  "-f",
  "lavfi",
  "-i",
  `testsrc2=size=${size}:rate=${rate}:duration=${seconds}`,
];
const a = (seconds = 2) => [
  "-f",
  "lavfi",
  "-i",
  `sine=frequency=440:duration=${seconds}`,
];

// Accepted containers with audio (images have no peaks path).
const corpus = [
  {
    name: "tone.mp4",
    args: [
      ...v(),
      ...a(),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
    ],
  },
  {
    name: "tone.mov",
    args: [
      ...v(),
      ...a(),
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
    ],
  },
  {
    name: "tone.webm",
    args: [
      ...v(),
      ...a(),
      "-c:v",
      "libvpx-vp9",
      "-c:a",
      "libopus",
      "-shortest",
    ],
  },
  { name: "tone.wav", args: [...a(), "-c:a", "pcm_s16le"] },
  { name: "tone.mp3", args: [...a(), "-c:a", "libmp3lame"] },
  { name: "tone.ogg", args: [...a(), "-c:a", "libvorbis"] },
];

const work = await mkdtemp(path.join(tmpdir(), "yamakan-q5-"));
const mediaDir = path.join(work, "media");
await mkdir(mediaDir, { recursive: true });
for (const item of corpus) {
  ffmpegRun([...item.args, path.join(mediaDir, item.name)]);
}

const harness = `<!doctype html>
<html><head><meta charset="utf-8"><title>Q5 Mediabunny</title></head>
<body><pre id="out">running</pre>
<script type="module">
import { Input, ALL_FORMATS, BlobSource, AudioSampleSink } from "/mediabunny.mjs";
const TIMEOUT_MS = ${TIMEOUT_MS};
const files = ${JSON.stringify(corpus.map((c) => c.name))};
async function peaksFor(name) {
  const res = await fetch("/media/" + name);
  const blob = await res.blob();
  const started = performance.now();
  const work = (async () => {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryAudioTrack();
    if (!track) return { ok: false, error: "no-audio" };
    const sink = new AudioSampleSink(track);
    let frames = 0;
    for await (const sample of sink.samples()) {
      frames += sample.numberOfFrames;
      sample.close();
      if (frames > sample.sampleRate) break;
    }
    return { ok: true, frames };
  })();
  const result = await Promise.race([
    work.then((r) => ({ ...r, ms: performance.now() - started })),
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ ok: false, error: "timeout", ms: TIMEOUT_MS }),
        TIMEOUT_MS,
      ),
    ),
  ]);
  return { file: name, ...result };
}
const rows = [];
for (const name of files) rows.push(await peaksFor(name));
window.__q5 = { rows, passed: rows.every((r) => r.ok && r.ms <= TIMEOUT_MS) };
document.getElementById("out").textContent = JSON.stringify(window.__q5);
</script></body></html>`;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let file;
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": mime[".html"] });
    res.end(harness);
    return;
  }
  if (url.pathname === "/mediabunny.mjs") file = BUNDLE;
  else if (url.pathname.startsWith("/media/"))
    file = path.join(mediaDir, path.basename(url.pathname));
  else {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    "content-type": mime[ext] || "application/octet-stream",
  });
  createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

let browser;
try {
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.waitForFunction(() => window.__q5, null, { timeout: 120_000 });
  const result = await page.evaluate(() => window.__q5);
  const receipt = {
    receipt: "yamakan.qualification/q5-mediabunny/1",
    qualification: "Q5",
    module: "M14",
    task: "W9",
    commit,
    measuredAt: new Date().toISOString(),
    timeoutMs: TIMEOUT_MS,
    mediabunny: "1.61.3",
    mediabunnyBundleSha256: createHash("sha256")
      .update(await readFile(BUNDLE))
      .digest("hex"),
    claim:
      "Mediabunny decodes each accepted audio-bearing container in Chromium within 2 s; failures keep server-derived peaks.",
    rows: result.rows,
    passed: result.passed,
    fallback:
      "Any row with ok:false keeps server-derived / empty peaks (not skip-as-pass).",
  };
  await writeFile(RECEIPT, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(
    JSON.stringify({ passed: result.passed, rows: result.rows }, null, 2),
  );
  if (!result.passed) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
  await rm(work, { recursive: true, force: true });
}
