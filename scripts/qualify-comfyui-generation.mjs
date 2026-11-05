/**
 * The whole generation path against a real ComfyUI on CPU, using core nodes and no
 * weights: explicitly started, followed, imported as an asset, placed on the
 * timeline, and exported by the real pipeline. Its clips are solid colours built
 * by core nodes, so this qualifies the path. No output here is AI-generated.
 *
 * Usage: YAMAKAN_COMFYUI_DIR=<folder holding ComfyUI and venv> \
 *   node scripts/qualify-comfyui-generation.mjs [receipt.json]
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import {
  comfyLaunchArguments,
  comfyRecipeHash,
  createComfyEngine,
} from "../core/engines/comfyui.ts";
import { createGenerationService } from "../core/engines/generation.ts";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
} from "../core/command/registry.ts";
import { mediaTools } from "../core/process/workers.ts";

const dir = process.env.YAMAKAN_COMFYUI_DIR;
if (!dir) {
  console.error(
    "Set YAMAKAN_COMFYUI_DIR to the folder holding ComfyUI and venv.",
  );
  console.log("GENERATION NOT RUN");
  process.exit(2);
}
const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-comfyui-generation-"));
const port = 18191;
const base = `http://127.0.0.1:${port}`;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const FRAME = 29_429_400;
const MANIFEST = "0".repeat(64);

const recipe = {
  id: "core-nodes-solid",
  operation: "textToVideo",
  modelManifestHash: MANIFEST,
  qualificationHash: "1".repeat(64),
  constraints: {
    maxWidth: 1280,
    maxHeight: 720,
    fps: [{ num: 24000, den: 1001 }],
    minDurationTicks: 1,
    maxDurationTicks: 705_600_000 * 60,
    audio: false,
    controls: [],
    roles: [],
  },
  graph: {
    1: {
      class_type: "EmptyImage",
      inputs: { width: 16, height: 16, batch_size: 1, color: 0x00ff00 },
      _meta: { title: "pixels" },
    },
    8: {
      class_type: "CreateVideo",
      inputs: { images: ["1", 0], fps: 24 },
      _meta: { title: "video" },
    },
    9: {
      class_type: "SaveVideo",
      inputs: {
        video: ["8", 0],
        filename_prefix: "yamakan/generated",
        format: "mp4",
        codec: "h264",
      },
      _meta: { title: "save" },
    },
  },
  bindings: {
    width: { node: "pixels", input: "width" },
    height: { node: "pixels", input: "height" },
    frames: { node: "pixels", input: "batch_size" },
    fps: { node: "video", input: "fps" },
  },
  outputNode: "save",
};
const asGeneration = {
  id: recipe.id,
  hash: comfyRecipeHash(recipe),
  operation: recipe.operation,
  modelManifestHash: MANIFEST,
};

const server = spawn(
  join(dir, "venv", "Scripts", "python.exe"),
  [
    join(dir, "ComfyUI", "main.py"),
    "--cpu",
    ...comfyLaunchArguments({ port, baseDirectory: join(root, "comfy") }),
  ],
  { windowsHide: true, stdio: "ignore" },
);

let passed = false;
let engine;
let store;
let queue;
try {
  let up = false;
  for (let i = 0; i < 240 && !up; i++) {
    assert.equal(server.exitCode, null, "ComfyUI exited");
    up = await fetch(`${base}/system_stats`, { redirect: "error" }).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(up, "ComfyUI did not start");

  store = new ProjectStore(join(root, "workspace"));
  await store.initialize();
  queue = new JobSupervisor(store);
  await queue.start();
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  };
  const project = (
    await execute(ctx, "yamakan.project.create", {
      name: "First generation",
      frameRate: { num: 24000, den: 1001 },
    })
  ).result;
  const projectId = project.id;

  engine = createComfyEngine({
    baseUrl: base,
    recipes: [recipe],
    enabled: true,
  });
  assert.deepEqual(await engine.checkSetup(), []);
  const generation = createGenerationService({
    adapter: engine,
    store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
  });

  const { generationId } = await generation.start({
    projectId,
    recipe: asGeneration,
    prompt: "not used by core nodes",
    width: 160,
    height: 90,
    durationFrames: 48,
  });
  step("a generation starts on an explicit request");

  let last;
  for (let i = 0; i < 480; i++) {
    last = await generation.status(generationId);
    if (!["queued", "running", "unknown"].includes(last.state)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(last.state, "succeeded", JSON.stringify(last));
  step("it is followed to success", { state: last.state });

  const { assetId } = await generation.importResult(generationId);
  const again = await generation.importResult(generationId);
  assert.equal(again.lineage.inputs.length, 0);
  assert.equal(again.lineage.recipeId, recipe.id);
  assert.equal(again.assetId, assetId, "importing twice gives one asset");
  const head = await execute(ctx, "yamakan.project.open", { projectId });
  const asset = head.result.assets.find((a) => a.id === assetId);
  assert.ok(asset, "the output joined the project");
  assert.equal(head.result.assets.length, 1);
  assert.equal(head.result.clips.length, 0);
  assert.equal(asset.width, 160);
  assert.equal(asset.height, 90);
  step("its output is imported as one asset, with no clip yet", {
    name: asset.name,
    hash: asset.hash,
    clips: head.result.clips.length,
  });

  const track = head.result.tracks.find((t) => t.kind === "video").id;
  const clipId = crypto.randomUUID();
  await execute(ctx, "yamakan.project.applyBatch", {
    projectId,
    expectedRevision: head.result.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: track,
        assetId,
        title: null,
        startTicks: 0,
        durationTicks: 48 * FRAME,
        sourceStartTicks: 0,
      },
    ],
  });
  step("it is placed on the timeline");

  const job = (
    await execute(ctx, "yamakan.export.video", {
      projectId,
      idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
    })
  ).result;
  let done;
  for (let i = 0; i < 600; i++) {
    done = (await execute(ctx, "yamakan.job.status", { jobId: job.id })).result;
    if (["COMPLETED", "FAILED"].includes(done.state)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(done.state, "COMPLETED", done.error ?? "");
  const exported = readdirSync(join(root, "workspace"), { recursive: true })
    .map(String)
    .find((f) => f.replaceAll("\\", "/").endsWith(done.artifact));
  assert.ok(exported, "the export is in the workspace");
  const raw = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      join(root, "workspace", exported),
      "-vf",
      "scale=1:1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ],
    { windowsHide: true, maxBuffer: 1 << 26 },
  );
  const frames = raw.length / 3;
  assert.equal(frames, 48, "the export has the clip's frames");
  for (let n = 0; n < frames; n++) {
    const [r, g, b] = raw.subarray(n * 3, n * 3 + 3);
    assert.ok(g > 200 && r < 50 && b < 50, `frame ${n}: ${r},${g},${b}`);
  }
  const pixel = [...raw.subarray(0, 3)];
  step("a real export of it comes out, with its frames and colour", {
    frames,
    pixel,
  });
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  engine?.close();
  await queue?.close?.();
  await store?.close?.();
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
          task: "comfyui-generation-path",
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
console.log(passed ? "GENERATION PATH PASS" : "GENERATION PATH FAIL");
process.exit(passed ? 0 : 1);
