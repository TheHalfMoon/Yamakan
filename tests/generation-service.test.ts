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

test("a cancel during an import's download stops it joining the project", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { generationId: id } = await g.start(ask(f.projectId));
  adapter.readArtifact = async function* () {
    await g.cancel(id);
    yield state.bytes;
  };
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

test("an import returns where the video came from, without repeating the prompt", async () => {
  const f = await fixture();
  const { adapter } = engine(f.video);
  const g = service(f, adapter);
  const { asset: still } = await f.store.importAsset(
    f.projectId,
    "still.png",
    f.still,
  );
  const { generationId: id } = await g.start(
    ask(f.projectId, {
      recipe: stillRecipe,
      firstFrameAssetId: still.id,
      seed: 7,
      prompt: "a private prompt",
    }),
  );
  const { lineage } = await g.importResult(id);
  assert.deepEqual(lineage, {
    outputHash: sha(f.video),
    inputs: [{ assetId: still.id, assetHash: still.hash }],
    recipeId: stillRecipe.id,
    recipeHash: stillRecipe.hash,
    modelManifestHash: stillRecipe.modelManifestHash,
    seed: 7,
    promptHash: sha(Buffer.from("a private prompt")),
  });
  assert.ok(!JSON.stringify(lineage).includes("private"));
});

const consented = async (
  f: Awaited<ReturnType<typeof fixture>>,
  stillId: string,
  hash: string,
) => {
  const consent = (
    await execute(f.ctx, "yamakan.consent.grant", {
      characterId: "lead",
      purpose: "likeness-generate",
      version: "v1",
      ttlMs: 3_600_000,
    })
  ).result as { id: string };
  const head = (
    await execute(f.ctx, "yamakan.project.open", {
      projectId: f.projectId,
    })
  ).result as { revision: number };
  await execute(f.ctx, "yamakan.pack.save", {
    projectId: f.projectId,
    expectedRevision: head.revision,
    documentId: crypto.randomUUID(),
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Cast",
      entries: [
        {
          id: crypto.randomUUID(),
          role: "character",
          label: "Lead",
          assetId: stillId,
          assetHash: hash,
          characterId: "lead",
          consentId: consent.id,
        },
      ],
    },
  });
  return consent.id;
};

test("a still linked to a revoked consent never reaches the engine", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const g = service(f, adapter);
  const { asset: still } = await f.store.importAsset(
    f.projectId,
    "still.png",
    f.still,
  );
  const consentId = await consented(f, still.id, still.hash);
  const request = ask(f.projectId, {
    recipe: stillRecipe,
    firstFrameAssetId: still.id,
  });
  await g.start(request);
  assert.equal(state.submitted.length, 1, "allowed while consent stands");
  await execute(f.ctx, "yamakan.consent.revoke", { consentId });
  assert.notEqual(await code(g.start(request)), "ok");
  assert.equal(state.submitted.length, 1);
});

test("what was made from a still is not imported once its consent is revoked", async () => {
  const f = await fixture();
  const { adapter } = engine(f.video);
  const g = service(f, adapter);
  const { asset: still } = await f.store.importAsset(
    f.projectId,
    "still.png",
    f.still,
  );
  const consentId = await consented(f, still.id, still.hash);
  const { generationId: id } = await g.start(
    ask(f.projectId, { recipe: stillRecipe, firstFrameAssetId: still.id }),
  );
  await execute(f.ctx, "yamakan.consent.revoke", { consentId });
  assert.notEqual(await code(g.importResult(id)), "ok");
  const { assets } = await f.store.exportProject(f.projectId);
  assert.deepEqual(
    assets.map((x) => x.id),
    [still.id],
  );
});

test("the commands reach the service for a person, and an agent cannot start one", async () => {
  const f = await fixture();
  const { state, adapter } = engine(f.video);
  const generation = { service: service(f, adapter), recipes: [recipe] };
  const person = { ...f.ctx, generation };
  const args = {
    projectId: f.projectId,
    recipeId: recipe.id,
    prompt: "go",
    width: 64,
    height: 36,
    durationFrames: 24,
  };
  const { generationId } = (
    await execute(person, "yamakan.generation.start", args)
  ).result as { generationId: string };
  assert.equal(state.submitted.length, 1);
  assert.equal(
    (
      (await execute(person, "yamakan.generation.status", { generationId }))
        .result as { state: string }
    ).state,
    "succeeded",
  );
  const imported = (
    await execute(person, "yamakan.generation.import", { generationId })
  ).result as { assetId: string };
  assert.ok(imported.assetId);
  assert.equal(
    await code(
      execute(person, "yamakan.generation.start", {
        ...args,
        recipeId: "other",
      }),
    ),
    "NOT_FOUND",
  );
  const agent = {
    ...person,
    principal: {
      id: `agent:${crypto.randomUUID()}`,
      scopes: new Set(Scopes),
    },
  } as unknown as CommandContext;
  for (const [operation, input] of [
    ["yamakan.generation.start", args],
    ["yamakan.generation.cancel", { generationId }],
    ["yamakan.generation.import", { generationId }],
  ] as const)
    assert.notEqual(
      await code(execute(agent, operation, input)),
      "ok",
      operation,
    );
  assert.equal(state.submitted.length, 1, "an agent started nothing");
});

test("without a service the commands refuse, and say why, touching nothing", async () => {
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
