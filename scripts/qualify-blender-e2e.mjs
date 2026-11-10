/**
 * The Blender integration's first vertical slice, end to end through the real service and its
 * SDK (Windows, with the pinned Blender installed by `npm run blender:install`):
 *
 *   a project → its saved Cinema scene → a contained Blender render → a verified video asset
 *   → the timeline → a real MP4 export, decoded frame by frame → the service restarted and the
 *   project reopened with its asset and clip.
 *
 * Nothing here is mocked. The receipt is printed, and written only where
 * YAMAKAN_QUALIFY_RECEIPT points (never into the repository).
 */
import { execFileSync, fork } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { YamakanClient } from "../sdk/client.ts";
import { mediaTools } from "../core/process/workers.ts";

const root = mkdtempSync(join(tmpdir(), "yamakan-blender-e2e-"));
const workspace = join(root, "workspace");
const port = 24381;
const base = `http://127.0.0.1:${port}`;
const SECOND = 705_600_000;
const steps = [];
const step = (name, detail) => {
  steps.push(detail ? { name, ...detail } : { name });
  console.log(`- ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

let child;
async function start() {
  child = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    {
      env: {
        ...process.env,
        YAMAKAN_WORKSPACE: workspace,
        YAMAKAN_PORT: String(port),
      },
      silent: true,
      windowsHide: true,
    },
  );
  let errors = "";
  child.stderr.on("data", (c) => (errors += String(c)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`startup: ${errors}`)),
      30000,
    );
    child.stdout.on("data", (c) => {
      if (String(c).includes("Yamakan is running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`exited ${code}: ${errors}`));
    });
  });
  // The service makes a new client token each start.
  const token = readFileSync(join(workspace, "token"), "utf8").trim();
  return new YamakanClient({ baseUrl: base, token });
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const done = new Promise((r) => child.once("exit", r));
  try {
    child.send("shutdown");
  } catch {}
  // A service that does not stop in time is ended, so the run never hangs.
  const late = setTimeout(() => child.kill(), 30000);
  await done;
  clearTimeout(late);
}

let passed = false;
const started = Date.now();
try {
  let client = await start();
  const capability = await client.call("yamakan.blender.capability", {});
  assert.equal(capability.available, true, capability.message ?? "");
  step("the pinned Blender is available", { version: capability.version });

  const project = await client.call("yamakan.project.create", {
    name: "Blender slice",
  });
  const projectId = project.id;
  // The project's Cinema scene, as the Cinema page saves it: two boxes.
  const sceneId = randomUUID();
  const opened = await client.call("yamakan.project.open", { projectId });
  await client.saveDocument({
    projectId,
    expectedRevision: opened.revision,
    documentId: sceneId,
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: null,
    content: {
      format: "yamakan.scene3d",
      formatVersion: 1,
      id: sceneId,
      units: "metres",
      eulerOrder: "XYZ",
      camera: { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 },
      items: [
        {
          id: randomUUID(),
          name: "blue",
          position: { x: 0, y: 0.5, z: -2 },
          rotation: { x: 0, y: 0.4, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          assetId: null,
          color: "#3366cc",
        },
        {
          id: randomUUID(),
          name: "orange",
          position: { x: -1.25, y: 0.5, z: -2 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 2, z: 1 },
          assetId: null,
          color: "#e07020",
        },
      ],
    },
    requestId: `scene.${randomUUID()}`,
  });
  step("the project's Cinema scene is saved");

  const renderStarted = Date.now();
  const job = await client.call("yamakan.blender.render", {
    projectId,
    settings: {
      width: 320,
      height: 180,
      fps: 30,
      frames: 30,
      samples: 8,
      orbitDegrees: 90,
    },
    name: "Two boxes",
  });
  let done;
  for (let i = 0; i < 1200; i++) {
    done = await client.call("yamakan.job.status", { jobId: job.id });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(done.state)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(done.state, "COMPLETED", done.error ?? JSON.stringify(done));
  const renderSeconds = (Date.now() - renderStarted) / 1000;
  const head = await client.call("yamakan.project.open", { projectId });
  const asset = head.assets.find((a) => a.name === "Two boxes.mp4");
  assert.ok(asset, "the render joined the project");
  assert.equal(asset.kind, "video");
  assert.equal(asset.width, 320);
  assert.equal(asset.height, 180);
  assert.equal(asset.durationFrames, 30, "one second of render at 30 fps");
  step("Blender rendered it, contained, and the video joined the project", {
    renderSeconds,
    asset: {
      width: asset.width,
      height: asset.height,
      durationFrames: asset.durationFrames,
    },
  });

  const track = head.tracks.find((t) => t.kind === "video").id;
  const clipId = randomUUID();
  await client.call("yamakan.project.applyBatch", {
    projectId,
    expectedRevision: head.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: track,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: SECOND,
        sourceStartTicks: 0,
      },
    ],
  });
  step("it is placed on the timeline");

  const exportJob = await client.call("yamakan.export.video", {
    projectId,
    idempotencyKey: randomUUID().replaceAll("-", ""),
  });
  let exported;
  for (let i = 0; i < 1200; i++) {
    exported = await client.call("yamakan.job.status", { jobId: exportJob.id });
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(exported.state)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(exported.state, "COMPLETED", exported.error ?? "");
  const matches = readdirSync(workspace, { recursive: true })
    .map(String)
    .filter((f) => f.replaceAll("\\", "/").endsWith(exported.artifact));
  assert.equal(matches.length, 1, "exactly one export file");
  const file = matches[0];
  // Decoded frame by frame, each scaled to 8×8: the boxes move across the frames (the camera
  // orbits), so the frames differ, and they hold more than the background colour.
  const raw = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      join(workspace, file),
      "-vf",
      "scale=64:36",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ],
    { windowsHide: true, maxBuffer: 1 << 26 },
  );
  // For a person to look at: the first, middle and last exported frames as BMP images, written
  // only where YAMAKAN_QUALIFY_FRAMES points (never into the repository).
  if (process.env.YAMAKAN_QUALIFY_FRAMES) {
    const [w, h] = [320, 180];
    const big = execFileSync(
      mediaTools().ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        join(workspace, file),
        "-vf",
        `scale=${w}:${h}`,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "bgr24",
        "-",
      ],
      { windowsHide: true, maxBuffer: 1 << 28 },
    );
    const size = w * h * 3;
    for (const [n, label] of [
      [0, "first"],
      [15, "middle"],
      [29, "last"],
    ]) {
      const header = Buffer.alloc(54);
      header.write("BM", 0);
      header.writeUInt32LE(54 + size, 2);
      header.writeUInt32LE(54, 10);
      header.writeUInt32LE(40, 14);
      header.writeInt32LE(w, 18);
      header.writeInt32LE(-h, 22); // top-down rows
      header.writeUInt16LE(1, 26);
      header.writeUInt16LE(24, 28);
      header.writeUInt32LE(size, 34);
      writeFileSync(
        join(process.env.YAMAKAN_QUALIFY_FRAMES, `${label}.bmp`),
        Buffer.concat([header, big.subarray(n * size, (n + 1) * size)]),
      );
    }
  }
  // 64×36 cells: fine enough that small boxes moving near the middle register.
  const frameBytes = 64 * 36 * 3;
  const frames = raw.length / frameBytes;
  assert.equal(frames, 30, "one second at 30 fps");
  const frameAt = (n) => raw.subarray(n * frameBytes, (n + 1) * frameBytes);
  // The share of cells that changed by more than encoder noise does (24 levels on some channel).
  // Measured on this scene's 90° orbit: 3 to 5 % between first, middle and last; identical
  // frames give 0 %. A still render cannot pass 1.5 %.
  const changed = (a, b) => {
    let n = 0;
    for (let x = 0; x < frameBytes; x += 3)
      if (
        Math.max(
          Math.abs(a[x] - b[x]),
          Math.abs(a[x + 1] - b[x + 1]),
          Math.abs(a[x + 2] - b[x + 2]),
        ) > 24
      )
        n++;
    return n / (frameBytes / 3);
  };
  const first = frameAt(0);
  const middle = frameAt(Math.floor(frames / 2));
  const last = frameAt(frames - 1);
  const motion = {
    firstToMiddle: Math.round(changed(first, middle) * 1000) / 10,
    middleToLast: Math.round(changed(middle, last) * 1000) / 10,
    firstToLast: Math.round(changed(first, last) * 1000) / 10,
  };
  assert.ok(
    motion.firstToMiddle > 1.5,
    `the camera moved early (% of the picture): ${JSON.stringify(motion)}`,
  );
  assert.ok(
    motion.middleToLast > 1.5,
    `and kept moving (% of the picture): ${JSON.stringify(motion)}`,
  );
  // The boxes' own colours, in some frame: a bluish pixel (#3366cc) and an orangish one (#e07020).
  let bluish = false;
  let orangish = false;
  for (let n = 0; n < frames; n++) {
    const f = frameAt(n);
    for (let x = 0; x < frameBytes; x += 3) {
      const [r, g, b] = [f[x], f[x + 1], f[x + 2]];
      if (b > r + 40 && b > g + 10) bluish = true;
      if (r > b + 60 && r > g + 20) orangish = true;
    }
  }
  assert.ok(bluish, "the blue box is in the render");
  assert.ok(orangish, "the orange box is in the render");
  const colours = new Set();
  for (let x = 0; x < frameBytes; x += 3)
    colours.add(`${first[x] >> 4},${first[x + 1] >> 4},${first[x + 2] >> 4}`);
  step(
    "a real MP4 export decodes with both boxes in their colours and the camera moving",
    {
      frames,
      motion,
      coloursInFirstFrame: colours.size,
    },
  );

  // Saved and reopened: the service is stopped and started again.
  await stop();
  client = await start();
  const reopened = await client.call("yamakan.project.open", { projectId });
  assert.ok(
    reopened.assets.some((a) => a.id === asset.id),
    "the asset is still there",
  );
  assert.ok(
    reopened.clips.some((c) => c.id === clipId),
    "the clip is still there",
  );
  assert.equal(reopened.revision, head.revision + 1);
  step("after a restart the project reopens with the render and its clip", {
    revision: reopened.revision,
  });
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await stop().catch(() => {});
  const receipt = {
    task: "blender-vertical-slice",
    head: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    // Uncommitted changes would make "head" not the code that ran.
    clean:
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim() === "",
    passed,
    seconds: (Date.now() - started) / 1000,
    engine:
      "Blender 5.3.0, Cycles CPU, contained (yamakan-procd engine-worker profile)",
    aiGenerated: false,
    steps,
  };
  console.log(JSON.stringify(receipt, null, 2));
  if (process.env.YAMAKAN_QUALIFY_RECEIPT)
    writeFileSync(
      process.env.YAMAKAN_QUALIFY_RECEIPT,
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
  await new Promise((r) => setTimeout(r, 1000));
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}
console.log(passed ? "BLENDER SLICE PASS" : "BLENDER SLICE FAIL");
process.exit(passed ? 0 : 1);
