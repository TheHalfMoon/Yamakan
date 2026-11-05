// A person's generation, over an engine contract double: what start, status,
// cancel and import refuse. `npm run qualify:comfyui-generation` runs the path
// against a real ComfyUI.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import {
  createGenerationService,
  type GenerationRecipe,
} from "../core/engines/generation.ts";
import type {
  Artifact,
  EngineAdapterV2,
  EngineContextV2,
  EngineRequestV2,
  ExecutionStatus,
  RefusalReason,
} from "../core/engines/contract-v2.ts";

const bases: string[] = [];
const handles: { close: () => unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  for (const b of bases)
    await rm(b, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
});
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return toCommandError(e).code;
  }
};

const recipe: GenerationRecipe = {
  id: "t",
  hash: "a".repeat(64),
  operation: "textToVideo",
  modelManifestHash: "b".repeat(64),
};
const stillRecipe: GenerationRecipe = { ...recipe, operation: "imageToVideo" };

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-generation-test-"));
  bases.push(root);
  const store = new ProjectStore(path.join(root, "workspace"));
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  } as unknown as CommandContext;
  const project = (
    await execute(ctx, "yamakan.project.create", {
      name: "G",
      frameRate: { num: 24000, den: 1001 },
    })
  ).result as { id: string };
  const video = path.join(root, "out.mp4");
  const still = path.join(root, "still.png");
  const ffmpeg = (args: string[]) =>
    execFileSync(
      mediaTools().ffmpeg,
      ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", ...args],
      { windowsHide: true },
    );
  ffmpeg([
    "-i",
    "color=c=green:s=64x36:r=24000/1001:d=1",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    video,
  ]);
  ffmpeg(["-i", "color=c=blue:s=64x36", "-frames:v", "1", still]);
  return {
    ctx,
    store,
    projectId: project.id,
    video: await readFile(video),
    still: await readFile(still),
  };
}

// A contract double whose answers a test sets.
function engine(video: Buffer) {
  const state = {
    submitted: [] as EngineRequestV2[],
    refused: null as RefusalReason | null,
    status: "succeeded" as ExecutionStatus["state"],
    artifacts: [
      {
        handle: "output-0.mp4",
        mediaType: "video/mp4",
        byteLength: video.length,
        sha256: sha(video),
      },
    ] as Artifact[],
    bytes: video as Buffer,
    cancelled: [] as string[],
    inputRead: null as Buffer | null,
  };
  const adapter = {
    async submit(request: EngineRequestV2, context: EngineContextV2) {
      state.submitted.push(request);
      if (state.refused) return { refused: state.refused };
      for (const { asset } of request.inputs) {
        const chunks: Uint8Array[] = [];
        for await (const c of context.openAsset(asset)) chunks.push(c);
        state.inputRead = Buffer.concat(chunks);
      }
      return { executionRef: "run-1" };
    },
    async status(executionRef: string) {
      return { executionRef, state: state.status };
    },
    async requestCancel(ref: string) {
      state.cancelled.push(ref);
      return { requested: true, localProcessExited: false };
    },
    async enumerateArtifacts() {
      return state.artifacts;
    },
    async *readArtifact() {
      yield state.bytes;
    },
  } as unknown as EngineAdapterV2;
  return { state, adapter };
}

const service = (
  f: Awaited<ReturnType<typeof fixture>>,
  adapter: EngineAdapterV2,
) =>
  createGenerationService({
    adapter,
    store: f.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
  });
const ask = (projectId: string, over: object = {}) => ({
  projectId,
  recipe,
  prompt: "go",
  width: 64,
  height: 36,
  durationFrames: 24,
  ...over,
});

test("a request takes the project's own frame rate and exact timing", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  await service(f, adapter).start(ask(f.projectId));
  const [sent] = state.submitted;
  assert.equal(sent.operation, "textToVideo");
  assert.deepEqual(sent.output.kind === "video" ? sent.output.fps : null, {
    num: 24000,
    den: 1001,
  });
  assert.equal(
    sent.output.kind === "video" ? sent.output.durationTicks : 0,
    29_429_400 * 24,
  );
});

test("an engine's refusal reaches the person as a plain reason, and tracks nothing", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  state.refused = "WEIGHTS_ABSENT";
  const g = service(f, adapter);
  assert.equal(await code(g.start(ask(f.projectId))), "CAPABILITY_UNAVAILABLE");
  assert.equal(await code(g.status("nope")), "NOT_FOUND");
  assert.equal(await code(g.importResult("nope")), "NOT_FOUND");
  assert.equal(await code(g.cancel("nope")), "NOT_FOUND");
});

test("only a finished generation can be imported, and only once", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { generationId: id } = await g.start(ask(f.projectId));
  for (const s of [
    "queued",
    "running",
    "failed",
    "cancelled",
    "unknown",
  ] as const) {
    state.status = s;
    assert.equal(await code(g.importResult(id)), "VALIDATION", s);
  }
  assert.equal((await f.store.exportProject(f.projectId)).assets.length, 0);
  state.status = "succeeded";
  const first = await g.importResult(id);
  assert.deepEqual(await g.importResult(id), first);
  const { assets, clips } = await f.store.exportProject(f.projectId);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].hash, sha(f.video));
  assert.equal(clips.length, 0, "the timeline is the person's to change");
  assert.deepEqual((await g.status(id)).imported, first);
});

test("output that is not what the engine reported joins nothing", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { generationId: id } = await g.start(ask(f.projectId));
  const good = state.bytes;
  state.bytes = Buffer.from(good).fill(0, 0, 16);
  assert.equal(await code(g.importResult(id)), "VALIDATION", "changed bytes");
  state.bytes = good.subarray(0, 100);
  assert.equal(await code(g.importResult(id)), "VALIDATION", "too short");
  state.bytes = Buffer.concat([good, Buffer.from("x")]);
  assert.notEqual(await code(g.importResult(id)), "ok", "too long");
  state.bytes = good;
  state.artifacts = [];
  assert.equal(await code(g.importResult(id)), "VALIDATION", "none");
  state.artifacts = [
    {
      handle: "a.mp4",
      mediaType: "video/mp4",
      byteLength: good.length,
      sha256: sha(good),
    },
    {
      handle: "b.mp4",
      mediaType: "video/mp4",
      byteLength: good.length,
      sha256: sha(good),
    },
  ];
  assert.equal(await code(g.importResult(id)), "VALIDATION", "more than one");
  assert.equal((await f.store.exportProject(f.projectId)).assets.length, 0);
});

test("an image-to-video starts from a project still, and nothing else", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { asset: still } = await f.store.importAsset(
    f.projectId,
    "still.png",
    f.still,
  );
  const { asset: clip } = await f.store.importAsset(
    f.projectId,
    "clip.mp4",
    f.video,
  );
  assert.equal(
    await code(g.start(ask(f.projectId, { recipe: stillRecipe }))),
    "VALIDATION",
  );
  assert.equal(
    await code(
      g.start(
        ask(f.projectId, { recipe: stillRecipe, firstFrameAssetId: clip.id }),
      ),
    ),
    "VALIDATION",
  );
  assert.equal(
    await code(g.start(ask(f.projectId, { firstFrameAssetId: still.id }))),
    "VALIDATION",
  );
  assert.equal(state.submitted.length, 0);
  await g.start(
    ask(f.projectId, { recipe: stillRecipe, firstFrameAssetId: still.id }),
  );
  assert.deepEqual(state.submitted[0].inputs, [
    {
      role: "firstFrame",
      asset: {
        assetVersionId: still.id,
        sha256: still.hash,
        mediaType: "image/png",
      },
    },
  ]);
  assert.deepEqual(state.inputRead, f.still);
});

test("cancel reaches the engine, and what it leaves is not imported", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { generationId: id } = await g.start(ask(f.projectId));
  await g.cancel(id);
  assert.deepEqual(state.cancelled, ["run-1"]);
  assert.equal(state.status, "succeeded", "it finished anyway");
  assert.equal(await code(g.importResult(id)), "VALIDATION");
  assert.equal((await f.store.exportProject(f.projectId)).assets.length, 0);
});

test("two imports at once are one asset", async () => {
  const f = await fixture();
  const { adapter } = engine(f.video);
  const g = service(f, adapter);
  const { generationId: id } = await g.start(ask(f.projectId));
  const [a, b] = await Promise.all([g.importResult(id), g.importResult(id)]);
  assert.deepEqual(a, b);
  assert.equal((await f.store.exportProject(f.projectId)).assets.length, 1);
});

test("an output that fails while being read is this call's error, and a retry works", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { generationId: id } = await g.start(ask(f.projectId));
  const read = adapter.readArtifact;
  adapter.readArtifact = async function* () {
    yield state.bytes.subarray(0, 10);
    throw new Error("connection lost");
  };
  await assert.rejects(g.importResult(id), /connection lost/);
  adapter.readArtifact = read;
  assert.ok((await g.importResult(id)).assetId);
});

test("the commands refuse today, and say why, without touching anything", async () => {
  const f = await fixture();
  const before = await f.store.exportProject(f.projectId);
  for (const [operation, args] of [
    [
      "yamakan.generation.start",
      {
        projectId: f.projectId,
        recipeId: "x",
        prompt: "go",
        width: 64,
        height: 36,
        durationFrames: 24,
      },
    ],
    ["yamakan.generation.status", { generationId: crypto.randomUUID() }],
    ["yamakan.generation.cancel", { generationId: crypto.randomUUID() }],
    ["yamakan.generation.import", { generationId: crypto.randomUUID() }],
  ] as const) {
    assert.equal(
      await code(execute(f.ctx, operation, args)),
      "CAPABILITY_UNAVAILABLE",
      operation,
    );
  }
  assert.deepEqual(await f.store.exportProject(f.projectId), before);
});
