/**
 * A real model's video through Yamakan: imported by the real service, seen on the
 * timeline in a real browser, and exported by the real pipeline, with the export
 * compared against the source frame by frame. The video is made elsewhere and
 * brought in as a file: this says nothing about generating inside Yamakan.
 *
 * Usage: node scripts/qualify-ai-video.mjs <video.mp4> <sha256> [receipt.json]
 * With a receipt path, the export is also kept beside it, so keep that outside git.
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mediaTools } from "../core/process/workers.ts";
import { FRAME, compareFrames } from "./ai-video-frames.mjs";

const [video, expected, receipt] = process.argv.slice(2);
if (!video || !expected) {
  console.error(
    "Usage: qualify-ai-video.mjs <video.mp4> <sha256> [receipt.json]",
  );
  process.exit(2);
}
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});
const root = mkdtempSync(join(tmpdir(), "yamakan-ai-video-"));
const port = 24420;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const FLICKS = 705_600_000;
const child = fork(
  fileURLToPath(new URL("../server/main.ts", import.meta.url)),
  [],
  {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: join(root, "workspace"),
      YAMAKAN_PORT: String(port),
    },
    silent: true,
    windowsHide: true,
  },
);
let log = "";
child.stderr.on("data", (c) => (log += String(c)));

// Frames as tiny raw pictures, for comparing a file with another.
const small = (file, filter = "scale=64:36") =>
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-vf",
      filter,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ],
    { windowsHide: true, maxBuffer: 1 << 28 },
  );
// What a file holds: its frames counted by decoding, the rest from its stream.
const probe = (file) => {
  const stream = JSON.parse(
    execFileSync(
      mediaTools().ffprobe,
      [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,r_frame_rate,nb_read_frames",
        "-of",
        "json",
        file,
      ],
      { windowsHide: true, encoding: "utf8" },
    ),
  ).streams[0];
  const [top, bottom] = stream.r_frame_rate.split("/").map(Number);
  return {
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    fps: top / bottom,
    frames: Number(stream.nb_read_frames),
  };
};

let browser;
let passed = false;
try {
  const bytes = await readFile(video);
  const sha = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha, expected, "the file is the one the receipt names");
  step("the file matches the hash given for it", { sha256: sha });

  await new Promise((ready, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${log}`)),
      60_000,
    );
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Yamakan is running")) {
        clearTimeout(timer);
        ready();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${log}`));
    });
  });
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), `http://127.0.0.1:${port}`);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  const service = async (operation, parameters) => {
    const body = await page.evaluate(
      async ([operation, parameters]) => {
        const stored = JSON.parse(
          sessionStorage.getItem("yamakan.session") ?? "null",
        );
        const headers = { "Content-Type": "application/json" };
        if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
        const res = await fetch("/api/v1/call", {
          method: "POST",
          headers,
          body: JSON.stringify({ apiVersion: 1, operation, parameters }),
        });
        return res.json();
      },
      [operation, parameters],
    );
    if (body.error) throw new Error(`${operation}: ${body.error.message}`);
    return body.result;
  };

  const project = await service("yamakan.project.create", {
    name: "First AI video",
    // The default 30 fps project, whatever the model's rate: projects offer neither
    // CogVideoX's 8 fps nor Wan's 24, so a source frame lasts 30/fps of its frames.
  });
  const uploaded = await page.evaluate(
    async ([projectId, base64, name]) => {
      const stored = JSON.parse(
        sessionStorage.getItem("yamakan.session") ?? "null",
      );
      const headers = { "Content-Type": "video/mp4", "X-Asset-Name": name };
      if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
      const res = await fetch(`/api/v1/projects/${projectId}/assets`, {
        method: "POST",
        headers,
        body: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      });
      return res.json();
    },
    [project.id, bytes.toString("base64"), basename(video)],
  );
  const asset = uploaded.result?.asset ?? uploaded.asset ?? uploaded;
  assert.equal(asset.hash, sha, JSON.stringify(uploaded).slice(0, 300));
  step("it is imported as an asset, with the same hash", {
    width: asset.width,
    height: asset.height,
  });

  const open = await service("yamakan.project.open", { projectId: project.id });
  const track = open.tracks.find((t) => t.kind === "video").id;
  const clipId = crypto.randomUUID();
  const made = probe(video);
  const sourceFrames = made.frames;
  const perSource = 30 / made.fps;
  const frames = Math.floor(sourceFrames * perSource);
  const tick = FLICKS / 30;
  // A video narrower than 16:9 sits between black bars, on an even width.
  const pictureWidth = 2 * Math.round((720 * made.width) / made.height / 2);
  assert.ok(pictureWidth < 1280, `this expects bars, not ${pictureWidth}`);
  const bar = (1280 - pictureWidth) / 2;
  await service("yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: open.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: track,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: frames * tick,
        sourceStartTicks: 0,
      },
    ],
  });
  await page.goto(new URL("/", page.url()).href);
  await page
    .getByRole("button", { name: "First AI video", exact: false })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "First AI video", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.locator(`[data-clip-id="${clipId}"]`).waitFor({ timeout: 30_000 });
  step("it is on the timeline, in a real browser");

  const job = await service("yamakan.export.video", {
    projectId: project.id,
    idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
  });
  let done;
  for (let i = 0; i < 600; i++) {
    done = await service("yamakan.job.status", { jobId: job.id });
    if (["COMPLETED", "FAILED"].includes(done.state)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(done.state, "COMPLETED", done.error ?? "");
  const exported = readdirSync(join(root, "workspace"), { recursive: true })
    .map(String)
    .find((f) => f.replaceAll("\\", "/").endsWith(done.artifact));
  assert.ok(exported, "the export is in the workspace");
  const out = join(root, "workspace", exported);
  if (receipt) copyFileSync(out, `${receipt}.export.mp4`);
  const source = small(video);
  const delivered = probe(out);
  assert.deepEqual(
    [delivered.codec, delivered.width, delivered.height, delivered.fps],
    ["h264", 1280, 720, 30],
    "the export is H.264, 1280x720, 30 fps",
  );
  const result = small(out, `crop=${pictureWidth}:720:${bar}:0,scale=64:36`);
  let brightest = 0;
  for (const x of [0, 1280 - bar])
    for (const value of small(out, `crop=${bar}:720:${x}:0`))
      brightest = Math.max(brightest, value);
  assert.ok(brightest < 24, `the bars reach ${brightest}`);
  const count = result.length / FRAME;
  assert.equal(count, frames, "every frame came through");
  const compared = compareFrames(source, result, perSource);
  assert.equal(compared.problem, null, compared.problem);
  const { worst } = compared;
  console.log(
    `note - order rule reached ${compared.orderedFrames} of ${sourceFrames} source frames`,
  );
  step(
    "the export has every frame at 30 fps, and matches its source frame by frame",
    {
      source: made,
      frames: count,
      size: `1280x720, picture ${pictureWidth}x720`,
      brightestBar: brightest,
      worstDifference: Number(worst.toFixed(2)),
      steadyOffset: compared.offset.map((v) => Number(v.toFixed(2))),
      sourceFramesShown: compared.shown,
      orderChecks: compared.orderChecks,
      orderPairs: compared.pairs,
      sourceFramesOrderReached: compared.orderedFrames,
    },
  );
  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "ai-video-through-yamakan",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          passed,
          steps,
        },
        null,
        2,
      )}\n`,
    );
  await new Promise((r) => setTimeout(r, 1000));
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
console.log(passed ? "AI VIDEO PASS" : "AI VIDEO FAIL");
process.exit(passed ? 0 : 1);
