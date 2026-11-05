/**
 * The ComfyUI adapter against a real ComfyUI on CPU. It uses only ComfyUI's core
 * nodes, with no model weights, so what it qualifies is the path: setup check,
 * upload, submit, cancel, history and a real MP4 read back and decoded.
 * It says nothing about any model, and no output here is AI-generated.
 *
 * Usage: YAMAKAN_COMFYUI_DIR=<folder holding ComfyUI and venv> \
 *   node scripts/qualify-comfyui.mjs [receipt.json]
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { comfyRecipeHash, createComfyEngine } from "../core/engines/comfyui.ts";
import {
  ENGINE_CONTRACT_V2,
  readArtifactVerified,
} from "../core/engines/contract-v2.ts";
import { mediaTools } from "../core/process/workers.ts";

const dir = process.env.YAMAKAN_COMFYUI_DIR;
if (!dir) {
  console.error(
    "Set YAMAKAN_COMFYUI_DIR to the folder holding ComfyUI and venv.",
  );
  console.log("COMFYUI NOT RUN");
  process.exit(2);
}
const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-comfyui-"));
const port = 18188;
const base = `http://127.0.0.1:${port}`;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const MANIFEST = "0".repeat(64);
const TICK = 705_600_000;

const constraints = {
  maxWidth: 1280,
  maxHeight: 720,
  fps: [
    { num: 30, den: 1 },
    { num: 24000, den: 1001 },
  ],
  minDurationTicks: 1,
  maxDurationTicks: TICK * 600,
  audio: false,
  controls: [],
  roles: ["firstFrame"],
};
const saved = (from) => ({
  8: {
    class_type: "CreateVideo",
    inputs: { images: [from, 0], fps: 30 },
    _meta: { title: "video" },
  },
  9: {
    class_type: "SaveVideo",
    inputs: {
      video: ["8", 0],
      filename_prefix: "yamakan/check",
      format: "mp4",
      codec: "h264",
    },
    _meta: { title: "save" },
  },
});
const t2v = {
  id: "core-nodes-solid",
  operation: "textToVideo",
  modelManifestHash: MANIFEST,
  qualificationHash: "1".repeat(64),
  constraints,
  graph: {
    1: {
      class_type: "EmptyImage",
      inputs: { width: 16, height: 16, batch_size: 1, color: 0xff0000 },
      _meta: { title: "pixels" },
    },
    ...saved("1"),
  },
  bindings: {
    width: { node: "pixels", input: "width" },
    height: { node: "pixels", input: "height" },
    frames: { node: "pixels", input: "batch_size" },
    fps: { node: "video", input: "fps" },
    seed: undefined,
  },
  outputNode: "save",
};
const i2v = {
  id: "core-nodes-still",
  operation: "imageToVideo",
  modelManifestHash: MANIFEST,
  qualificationHash: "2".repeat(64),
  constraints,
  graph: {
    1: {
      class_type: "LoadImage",
      inputs: { image: "unset.png" },
      _meta: { title: "first" },
    },
    2: {
      class_type: "RepeatImageBatch",
      inputs: { image: ["1", 0], amount: 1 },
      _meta: { title: "repeat" },
    },
    ...saved("2"),
  },
  bindings: {
    frames: { node: "repeat", input: "amount" },
    fps: { node: "video", input: "fps" },
    roles: { firstFrame: { node: "first", input: "image" } },
  },
  outputNode: "save",
};
const request = (recipe, attemptKey, output, over = {}) => ({
  contract: ENGINE_CONTRACT_V2,
  operation: recipe.operation,
  recipeId: recipe.id,
  recipeHash: comfyRecipeHash(recipe),
  modelManifestHash: MANIFEST,
  attemptKey,
  leaseGeneration: 1,
  deadlineMs: 600_000,
  resourcePolicyHash: "3".repeat(64),
  inputs: [],
  output: { kind: "video", audio: false, ...output },
  ...over,
});
const context = { openAsset: () => (async function* () {})() };

const python = join(dir, "venv", "Scripts", "python.exe");
const server = spawn(
  python,
  [
    join(dir, "ComfyUI", "main.py"),
    "--cpu",
    "--listen",
    "127.0.0.1",
    "--port",
    String(port),
    "--disable-auto-launch",
    "--disable-all-custom-nodes",
    "--base-directory",
    root,
  ],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
const logged = (c) => (serverLog = (serverLog + c).slice(-8000));
server.stdout.on("data", logged);
server.stderr.on("data", logged);

const decode = (bytes, name) => {
  const file = join(root, name);
  writeFileSync(file, bytes);
  const { ffmpeg, ffprobe } = mediaTools();
  const probe = JSON.parse(
    execFileSync(
      ffprobe,
      [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,nb_read_frames,r_frame_rate",
        "-of",
        "json",
        file,
      ],
      { windowsHide: true, encoding: "utf8" },
    ),
  ).streams[0];
  const raw = execFileSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=1:1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ],
    { windowsHide: true },
  );
  return { ...probe, pixel: [...raw.subarray(0, 3)] };
};
const near = (p, q) => p.every((v, i) => Math.abs(v - q[i]) < 16);

let passed = false;
let engine;
const started = Date.now();
try {
  let up = false;
  for (let i = 0; i < 240 && !up; i++) {
    if (server.exitCode !== null)
      throw new Error(`ComfyUI exited: ${serverLog}`);
    up = await fetch(`${base}/system_stats`, { redirect: "error" }).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(up, `ComfyUI did not start: ${serverLog}`);
  const stats = await (await fetch(`${base}/system_stats`)).json();
  step("a real ComfyUI answers on loopback", {
    comfyuiVersion: stats.system?.comfyui_version,
    device: stats.devices?.[0]?.type,
    seconds: Math.round((Date.now() - started) / 1000),
  });

  engine = createComfyEngine({
    baseUrl: base,
    recipes: [t2v, i2v],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), []);
  step("the setup check finds every core node");

  const lacking = createComfyEngine({
    baseUrl: base,
    enabled: true,
    recipes: [
      {
        ...t2v,
        id: "lacking",
        graph: {
          ...t2v.graph,
          2: {
            class_type: "CheckpointLoaderSimple",
            inputs: { ckpt_name: "no-such-model.safetensors" },
            _meta: { title: "model" },
          },
          3: { class_type: "NoSuchNode", inputs: {}, _meta: { title: "x" } },
        },
        modelInputs: [{ node: "model", input: "ckpt_name" }],
      },
    ],
  });
  const problems = await lacking.checkSetup();
  assert.deepEqual(problems, [
    { kind: "node", recipe: "lacking", classType: "NoSuchNode" },
    { kind: "model", recipe: "lacking", name: "no-such-model.safetensors" },
  ]);
  assert.equal(
    lacking.capabilities().find((c) => c.operation === "textToVideo").reason,
    "WEIGHTS_ABSENT",
  );
  lacking.close();
  step("a missing node and a missing model are named, and refuse", {
    problems,
  });

  const finished = async (ref) => {
    for (let i = 0; i < 1200; i++) {
      const s = await engine.status(ref);
      if (!["queued", "running", "unknown"].includes(s.state)) return s;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("A job did not finish.");
  };

  for (const [label, fps, frames, duration] of [
    ["30 fps", { num: 30, den: 1 }, 30, TICK],
    ["24000/1001", { num: 24000, den: 1001 }, 48, 29_429_400 * 48],
  ]) {
    const answer = await engine.submit(
      request(
        t2v,
        `t2v-${fps.num}`,
        {
          width: 64,
          height: 36,
          fps,
          durationTicks: duration,
        },
        { prompt: "a solid red frame" },
      ),
      context,
    );
    assert.ok(answer.executionRef, JSON.stringify(answer));
    const status = await finished(answer.executionRef);
    assert.equal(status.state, "succeeded", JSON.stringify(status));
    const [artifact, ...rest] = await engine.enumerateArtifacts(
      answer.executionRef,
    );
    assert.equal(rest.length, 0);
    assert.equal(artifact.mediaType, "video/mp4");
    const chunks = [];
    await readArtifactVerified(engine, answer.executionRef, artifact, (c) =>
      chunks.push(Buffer.from(c)),
    );
    const video = decode(Buffer.concat(chunks), `t2v-${fps.num}.mp4`);
    assert.equal(video.width, 64);
    assert.equal(video.height, 36);
    assert.equal(Number(video.nb_read_frames), frames);
    assert.ok(near(video.pixel, [255, 0, 0]), `pixel ${video.pixel}`);
    step(`${label}: a real MP4 comes back with the requested size and frames`, {
      ...video,
      bytes: artifact.byteLength,
    });
  }

  const png = join(root, "still.png");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=64x36",
      "-frames:v",
      "1",
      png,
    ],
    { windowsHide: true },
  );
  const still = await readFile(png);
  const asset = {
    assetVersionId: "still",
    sha256: sha(still),
    mediaType: "image/png",
  };
  const fromImage = await engine.submit(
    request(
      i2v,
      "i2v",
      { width: 64, height: 36, fps: { num: 30, den: 1 }, durationTicks: TICK },
      { inputs: [{ role: "firstFrame", asset }] },
    ),
    {
      openAsset: () =>
        (async function* () {
          yield still;
        })(),
    },
  );
  assert.ok(fromImage.executionRef, JSON.stringify(fromImage));
  assert.equal((await finished(fromImage.executionRef)).state, "succeeded");
  const [made] = await engine.enumerateArtifacts(fromImage.executionRef);
  const parts = [];
  await readArtifactVerified(engine, fromImage.executionRef, made, (c) =>
    parts.push(Buffer.from(c)),
  );
  const moved = decode(Buffer.concat(parts), "i2v.mp4");
  assert.equal(Number(moved.nb_read_frames), 30);
  assert.ok(near(moved.pixel, [0, 0, 255]), `pixel ${moved.pixel}`);
  step("an uploaded image reaches the graph and the MP4", moved);

  const refused = await engine.submit(
    request(
      i2v,
      "i2v-bad",
      { width: 64, height: 36, fps: { num: 30, den: 1 }, durationTicks: TICK },
      {
        inputs: [
          { role: "firstFrame", asset: { ...asset, sha256: "f".repeat(64) } },
        ],
      },
    ),
    {
      openAsset: () =>
        (async function* () {
          yield still;
        })(),
    },
  );
  assert.deepEqual(refused, { refused: "INVALID_REQUEST" });
  step("an input failing its hash is not submitted");

  // Long enough to catch running, then cancelled, and small enough for this RAM.
  const long = await engine.submit(
    request(
      t2v,
      "long",
      {
        width: 256,
        height: 144,
        fps: { num: 30, den: 1 },
        durationTicks: TICK * 133,
      },
      { prompt: "a long solid red clip" },
    ),
    context,
  );
  assert.ok(long.executionRef, JSON.stringify(long));
  let saw = "";
  for (let i = 0; i < 400 && saw !== "running"; i++) {
    saw = (await engine.status(long.executionRef)).state;
    if (saw === "running") break;
    await new Promise((r) => setTimeout(r, 25));
  }
  const cancelled = await engine.requestCancel(long.executionRef);
  const end = await finished(long.executionRef);
  assert.equal(saw, "running");
  assert.equal(cancelled.remoteAcknowledged, true);
  assert.equal(end.state, "cancelled", JSON.stringify(end));
  assert.deepEqual(await engine.enumerateArtifacts(long.executionRef), []);
  step("a running job is interrupted, and leaves no output", {
    state: end.state,
  });
  passed = true;
} catch (e) {
  console.error(e);
  console.error(serverLog.slice(-2000));
} finally {
  engine?.close();
  if (server.pid)
    try {
      execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {
      server.kill();
    }
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "comfyui-path",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          passed,
          aiGenerated: false,
          weights: "none",
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
    retryDelay: 200,
  });
}
console.log(passed ? "COMFYUI PASS" : "COMFYUI FAIL");
process.exit(passed ? 0 : 1);
