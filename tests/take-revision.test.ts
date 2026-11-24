// MPR-103: a take's request read back as a draft, what today's offer says of each part of it, and
// what a run made from it changed, which the service finds and no client states. The store, the
// job table and the commands are the real ones. The engine is a double whose one video is already
// the project's, as its rows and ten bytes, so that no decoder is asked.
// First: an engine tidies the folder it is given.
import "./fixtures/own-temp.ts";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
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
import { DOCUMENT_SCHEMA_VERSIONS } from "../core/document-ref.ts";
import {
  createGenerationService,
  noRemoteUse,
  type GenerationRecipe,
  type GenerationRecord,
} from "../core/engines/generation.ts";
import type {
  EngineAdapterV2,
  EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import { sha256Hex } from "../core/hash/canonical.ts";
import {
  KAGGLE_RECIPES,
  kaggleCli,
  kaggleRecipes,
} from "../core/engines/kaggle.ts";
import type { Asset, Project } from "../core/project.ts";
import { revisionDraft } from "../core/takes.ts";
import { FLICKS_PER_SECOND } from "../core/time.ts";
import type { StoryDocument } from "../core/story.ts";
import {
  REVISION_FIELDS,
  TakeRecordSchema,
  buildGenerationRecord,
  diffRequests,
  recordHashOf,
  type TakeRecord,
} from "../core/take-record.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
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
const FRAME = 23_520_000; // flicks per 30 fps frame
const PROMPT = "a marker no other row may hold: zq-103-marker";
const id = () => crypto.randomUUID();
const reason = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const c = toCommandError(e);
    return `${c.code}: ${c.message}`;
  }
};
const recipe: GenerationRecipe = {
  id: "t",
  hash: "a".repeat(64),
  operation: "textToVideo",
  modelManifestHash: "b".repeat(64),
};

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-revision-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const sent: EngineRequestV2[] = [];
  // Every call of the engine, by its name.
  const asked: string[] = [];
  const videos = new Map<string, string>();
  let next = "";
  const adapter = {
    submit: async (request: EngineRequestV2) => {
      asked.push("submit");
      sent.push(request);
      const executionRef = `run-${request.attemptKey}`;
      videos.set(executionRef, next);
      return { executionRef };
    },
    status: async (executionRef: string) => {
      asked.push("status");
      return { executionRef, state: "succeeded" };
    },
    enumerateArtifacts: async (ref: string) => {
      asked.push("enumerateArtifacts");
      return [
        {
          handle: "o.mp4",
          mediaType: "video/mp4",
          byteLength: 10,
          sha256: videos.get(ref),
        },
      ];
    },
  } as unknown as EngineAdapterV2;
  const recipes = [recipe];
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
    generation: {
      service: createGenerationService({
        adapter,
        store,
        resourcePolicyHash: RESOURCE_POLICY_HASH,
        permit: noRemoteUse,
        ledger: queue.generationLedger(),
      }),
      recipes,
    },
  } as unknown as CommandContext;
  const projectId = (
    (await execute(ctx, "yamakan.project.create", { name: "R" }))
      .result as Project
  ).id;
  return {
    root,
    store,
    queue,
    ctx,
    recipes,
    sent,
    asked,
    projectId,
    leaves: (hash: string) => {
      next = hash;
    },
  };
}
type W = Awaited<ReturnType<typeof workspace>>;
const call = async (w: W, operation: string, parameters: object, ctx = w.ctx) =>
  (await execute(ctx, operation, parameters)).result as any;

async function media(
  w: W,
  seed: string,
  over: Partial<Asset> = {},
): Promise<Asset> {
  const bytes = Buffer.from(seed.padEnd(10).slice(0, 10));
  const asset: Asset = {
    id: id(),
    name: `${seed}.mp4`,
    kind: "video",
    hash: sha256Hex(bytes),
    extension: "mp4",
    bytes: 10,
    durationFrames: 90,
    width: 64,
    height: 36,
    hasAudio: false,
    ...over,
  };
  const folder = path.join(w.root, "projects", w.projectId, "assets");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${asset.hash}.${asset.extension}`), bytes);
  await w.store.attachAsset(w.projectId, asset, (db) => {
    db.prepare(
      "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, 10, 'ready', 1)",
    ).run(w.projectId, asset.hash);
    db.prepare(
      "INSERT INTO asset_versions(version_id, project_id, digest, probe) VALUES (?, ?, ?, '{}')",
    ).run(asset.id, w.projectId, asset.hash);
  });
  return asset;
}
const picture = (w: W) =>
  media(w, "picture", {
    name: "picture.png",
    kind: "image",
    extension: "png",
    durationFrames: 1,
  });

type Shot = StoryDocument["scenes"][number]["shots"][number];
const shot = (over: Partial<Shot> = {}): Shot => ({
  id: id(),
  name: "Shot",
  durationTicks: 60 * FRAME,
  notes: "",
  referencePacks: [],
  takes: [],
  selectedTakeId: null,
  ...over,
});
const story = (shots: Shot[], sceneId = id()): StoryDocument => ({
  format: "yamakan.story",
  formatVersion: 2,
  title: "Revisions",
  scenes: [{ id: sceneId, name: "One", shots }],
});
const headOf = async (w: W) => (await w.store.load(w.projectId)).revision;
const hashOf = (w: W, documentId: string) =>
  w.store.listDocuments(w.projectId).find((d) => d.id === documentId)
    ?.contentHash ?? null;
const save = async (
  w: W,
  documentId: string,
  body: StoryDocument,
  over: object = {},
) =>
  call(w, "yamakan.story.save", {
    projectId: w.projectId,
    expectedRevision: await headOf(w),
    documentId,
    expectedContentHash: hashOf(w, documentId),
    story: body,
    ...over,
  });
const stored = (w: W, documentId: string) =>
  JSON.parse(
    w.store.getDocument(w.projectId, documentId).bytes.toString("utf8"),
  ) as StoryDocument;

const REQUEST = {
  recipeId: recipe.id,
  prompt: PROMPT,
  seed: 7,
  width: 64,
  height: 36,
  durationFrames: 90,
};
type Target = { documentId: string; shotId: string };
const start = (w: W, made: Asset, target: Target | null, over: object = {}) => {
  w.leaves(made.hash);
  return call(w, "yamakan.generation.start", {
    projectId: w.projectId,
    ...REQUEST,
    ...(target ? { target } : {}),
    ...over,
  }) as Promise<{ generationId: string }>;
};
const make = async (w: W, made: Asset, target: Target, over: object = {}) => {
  const { generationId } = await start(w, made, target, over);
  const { take } = await call(w, "yamakan.generation.import", { generationId });
  assert.ok(take?.appended, JSON.stringify(take));
  return take as {
    takeId: string;
    recordHash: string;
    notice?: string;
  };
};
const recordOf = async (w: W, target: Target, takeId: string) =>
  (
    await call(w, "yamakan.take.record", {
      projectId: w.projectId,
      ...target,
      takeId,
    })
  ).record as TakeRecord;
type Draft = {
  base: {
    documentId: string;
    shotId: string;
    takeId: string;
    recordHash: string | null;
    storyContentHash: string;
  };
  draft: Record<string, unknown> | null;
  complete: boolean;
  startable: boolean;
  checks: { field: string; state: string; message: string }[];
  reason: string | null;
};
const draftOf = (w: W, target: Target, takeId: string, ctx = w.ctx) =>
  call(
    w,
    "yamakan.take.revisionDraft",
    { projectId: w.projectId, ...target, takeId },
    ctx,
  ) as Promise<Draft>;
const states = (d: Draft) =>
  Object.fromEntries(d.checks.map((c) => [c.field, c.state]));
const said = (d: Draft, field: string) =>
  d.checks.find((c) => c.field === field)?.message;
// The same workspace with nothing set up, and with a Kaggle CLI that can run: any program it
// starts is counted, and an engine that is made asks for the ledger, which is counted too.
const bare = (w: W) =>
  ({ ...w.ctx, generation: undefined }) as unknown as CommandContext;
const withKaggle = (w: W) => {
  let ledgers = 0;
  const queue = new Proxy(w.queue, {
    get: (held, name) => {
      if (name === "generationLedger") ledgers++;
      const value = Reflect.get(held, name, held);
      return typeof value === "function" ? value.bind(held) : value;
    },
  });
  return {
    ctx: {
      ...w.ctx,
      queue,
      generation: undefined,
      kaggle: { cli: process.execPath, username: "someone" },
    } as unknown as CommandContext,
    ledgers: () => ledgers,
  };
};
const started = async (during: () => Promise<unknown>) => {
  let n = 0;
  const count = () => void n++;
  subscribe("child_process", count);
  try {
    await during();
  } finally {
    unsubscribe("child_process", count);
  }
  return n;
};

// A take whose record is this one, as an import commits it.
async function plant(w: W, target: Target, asset: Asset, given: TakeRecord) {
  // A part given as undefined is left out.
  const record = TakeRecordSchema.parse(JSON.parse(JSON.stringify(given)));
  const ref = w.store
    .listDocuments(w.projectId)
    .find((d) => d.id === target.documentId)!;
  const takeId = id();
  const now = stored(w, target.documentId);
  const next = {
    ...now,
    scenes: now.scenes.map((sc) => ({
      ...sc,
      shots: sc.shots.map((s) =>
        s.id === target.shotId
          ? {
              ...s,
              takes: [
                ...s.takes,
                {
                  id: takeId,
                  assetId: asset.id,
                  sourceStartTicks: 0,
                  recordHash: recordHashOf(record),
                },
              ],
            }
          : s,
      ),
    })),
  };
  await w.store.commitDocument({
    projectId: w.projectId,
    expectedRevision: await headOf(w),
    documentId: target.documentId,
    kind: "story",
    schemaVersion: DOCUMENT_SCHEMA_VERSIONS.story,
    expectedContentHash: ref.contentHash,
    source: { bytes: Buffer.from(JSON.stringify(next), "utf8") },
    principalId: "browser-ui",
    attachments: [record],
    verify: () => {},
  });
  return takeId;
}
const withShot = async () => {
  const w = await workspace();
  const target = { documentId: id(), shotId: id() };
  await save(w, target.documentId, story([shot({ id: target.shotId })]));
  return { w, target };
};
const facts = {
  route: "comfyui" as const,
  model: null,
  fps: null,
  steps: null,
};

test("a draft returns the request a take was made from", async () => {
  const { w, target } = await withShot();
  const take = await make(w, await media(w, "made"), target);
  const d = await draftOf(w, target, take.takeId);
  assert.deepEqual(d.base, {
    ...target,
    takeId: take.takeId,
    recordHash: take.recordHash,
    storyContentHash: hashOf(w, target.documentId),
  });
  assert.deepEqual(d.draft, { ...REQUEST, firstFrameAssetId: null });
  assert.deepEqual([d.complete, d.startable, d.reason], [true, true, null]);
  // What the double's model makes is not known, and nothing else is in doubt.
  assert.deepEqual(d.checks, [
    { field: "route", state: "ok", message: "Models can be started here." },
    {
      field: "recipe",
      state: "ok",
      message: "This model is offered with the same run script.",
    },
    { field: "model", state: "ok", message: "The model is the same version." },
    { field: "prompt", state: "ok", message: "The prompt was kept." },
    { field: "seed", state: "ok", message: "The seed was kept." },
    {
      field: "width",
      state: "unknown",
      message: "The width this model makes is not known here.",
    },
    {
      field: "height",
      state: "unknown",
      message: "The height this model makes is not known here.",
    },
    {
      field: "durationFrames",
      state: "unknown",
      message: "The length this model makes is not known here.",
    },
  ]);
});

test("a draft of a run from a still names it, and says when it is gone", async () => {
  const { w, target } = await withShot();
  const [known] = kaggleRecipes().filter((r) => r.operation === "imageToVideo");
  w.recipes.push(known!);
  const still = await picture(w);
  const made = await media(w, "made");
  const take = await make(w, made, target, {
    recipeId: known!.id,
    firstFrameAssetId: still.id,
    noUnconsentedPerson: true,
  });
  const d = await draftOf(w, target, take.takeId);
  assert.equal(d.draft!.firstFrameAssetId, still.id);
  assert.equal(d.complete, true);
  assert.equal(states(d).firstFrame, "ok");
  // A person says it again for every run.
  assert.ok(!JSON.stringify(d).includes("noUnconsentedPerson"));
  // Another version of it under its id, and none.
  const record = await recordOf(w, target, take.takeId);
  for (const pin of [
    { assetId: still.id, assetHash: "c".repeat(64) },
    { assetId: id(), assetHash: still.hash },
  ]) {
    const gone = await plant(w, target, made, {
      ...record,
      inputs: [{ ...pin, role: "firstFrame" }],
    });
    const after = await draftOf(w, target, gone);
    assert.equal(states(after).firstFrame, "unavailable");
    assert.equal(
      said(after, "firstFrame"),
      "The still this take started from is no longer in the project.",
    );
    assert.deepEqual([after.complete, after.startable], [true, false]);
  }
  // An image-to-video whose record names no first frame cannot be started from its draft.
  const unsaid = await draftOf(
    w,
    target,
    await plant(w, target, made, { ...record, inputs: [] }),
  );
  assert.equal(states(unsaid).firstFrame, "unknown");
  assert.deepEqual([unsaid.complete, unsaid.startable], [false, false]);
});

test("a changed seed is the only changed field, and an unchanged request is an exact repeat", async () => {
  const { w, target } = await withShot();
  const base = await make(w, await media(w, "made"), target);
  const { draft } = await draftOf(w, target, base.takeId);
  const { firstFrameAssetId, ...again } = draft!;
  assert.equal(firstFrameAssetId, null);
  const seeded = await make(w, await media(w, "seeded"), target, {
    ...again,
    seed: 8,
    derivedFromTakeId: base.takeId,
    revisionNote: "  The kite flew too low.  ",
  });
  const record = await recordOf(w, target, seeded.takeId);
  assert.equal(record.derivedFromTakeId, base.takeId);
  assert.equal(record.derivedFromRecordHash, base.recordHash);
  assert.deepEqual(record.changedFields, ["seed"]);
  assert.equal(record.revisionNote, "The kite flew too low.");
  assert.equal(seeded.notice, undefined);
  const repeat = await make(w, await media(w, "repeat"), target, {
    ...again,
    derivedFromTakeId: base.takeId,
  });
  const same = await recordOf(w, target, repeat.takeId);
  assert.deepEqual(same.changedFields, []);
  assert.equal(same.derivedFromRecordHash, base.recordHash);
  assert.equal(same.revisionNote, null);
  // A run that revises nothing says nothing of it.
  const first = await recordOf(w, target, base.takeId);
  assert.deepEqual(
    [first.derivedFromTakeId, first.derivedFromRecordHash, first.changedFields],
    [null, null, []],
  );
  // The shot's history says it of the runs too.
  const { attempts } = await call(w, "yamakan.shot.history", {
    projectId: w.projectId,
    ...target,
  });
  assert.deepEqual(
    attempts.map(
      (a: { derivedFromTakeId: string | null }) => a.derivedFromTakeId,
    ),
    [base.takeId, base.takeId, null],
  );
});

const full = (): TakeRecord =>
  TakeRecordSchema.parse({
    format: "yamakan.take-record",
    formatVersion: 1,
    origin: "generation",
    route: "kaggle",
    source: { generationId: id() },
    recipe: { id: "r", hash: "1".repeat(64) },
    model: {
      id: "m",
      revision: "1",
      manifestHash: "2".repeat(64),
      licence: null,
    },
    operation: "imageToVideo",
    request: {
      kind: "generation",
      prompt: "p",
      promptHash: sha256Hex("p"),
      seed: 1,
      width: 64,
      height: 36,
      durationFrames: 90,
      fps: 24,
      steps: 30,
    },
    inputs: [
      { assetId: id(), assetHash: "3".repeat(64), role: "firstFrame" },
      { assetId: id(), assetHash: "4".repeat(64), role: "reference" },
      { assetId: id(), assetHash: "5".repeat(64), role: "audio" },
    ],
    output: { sha256: "6".repeat(64) },
    reported: null,
    timings: { startedAt: null, endedAt: null, importedAt: null },
    usage: { wallMs: null, quotaSeconds: null },
    derivedFromTakeId: null,
    derivedFromRecordHash: null,
    revisionNote: null,
    changedFields: [],
  });

test("each field of REVISION_FIELDS is detected on its own", () => {
  const base = full();
  const request = (over: object) => ({
    ...base,
    request: { ...base.request, ...over },
  });
  const [first, ...rest] = base.inputs;
  const table: [string, unknown[]][] = [
    [
      "recipe",
      [
        { ...base, recipe: { ...base.recipe!, id: "other" } },
        { ...base, recipe: { ...base.recipe!, hash: "9".repeat(64) } },
        { ...base, recipe: null },
      ],
    ],
    [
      "model",
      [
        { ...base, model: { ...base.model!, id: "other" } },
        { ...base, model: { ...base.model!, revision: "2" } },
        { ...base, model: { ...base.model!, revision: null } },
        { ...base, model: { ...base.model!, manifestHash: "9".repeat(64) } },
        { ...base, model: null },
      ],
    ],
    [
      "prompt",
      [
        request({ prompt: "q", promptHash: sha256Hex("q") }),
        request({ prompt: undefined, promptHash: sha256Hex("q") }),
        request({ prompt: undefined, promptHash: null }),
      ],
    ],
    ["seed", [request({ seed: 2 }), request({ seed: null })]],
    ["width", [request({ width: 65 }), request({ width: null })]],
    ["height", [request({ height: 37 }), request({ height: null })]],
    ["durationFrames", [request({ durationFrames: 91 })]],
    ["fps", [request({ fps: 25 }), request({ fps: null })]],
    ["steps", [request({ steps: 31 }), request({ steps: null })]],
    [
      "firstFrame",
      [
        {
          ...base,
          inputs: [{ ...first!, assetHash: "9".repeat(64) }, ...rest],
        },
        { ...base, inputs: rest },
      ],
    ],
    [
      "inputs",
      [
        { ...base, inputs: [first!, rest[0]!] },
        {
          ...base,
          inputs: [first!, { ...rest[0]!, role: "source" }, rest[1]!],
        },
        {
          ...base,
          inputs: [
            first!,
            ...rest,
            { assetId: id(), assetHash: "5".repeat(64), role: "mask" },
          ],
        },
      ],
    ],
  ];
  assert.deepEqual(
    table.map(([field]) => field),
    [...REVISION_FIELDS],
  );
  for (const [field, variants] of table)
    for (const [n, variant] of variants.entries()) {
      const next = TakeRecordSchema.parse(variant);
      assert.deepEqual(diffRequests(base, next), [field], `${field} ${n}`);
      assert.deepEqual(diffRequests(next, base), [field], `${field} ${n}`);
    }
  // The same: but for its time, output, own ids, a licence and the order of its inputs, and where
  // one of the two kept the prompt's hash alone.
  for (const variant of [
    {
      ...base,
      source: { generationId: id() },
      output: { sha256: "7".repeat(64) },
      timings: { startedAt: 1, endedAt: 2, importedAt: 3 },
      model: { ...base.model!, licence: "MIT" },
      inputs: [...base.inputs].reverse().map((i) => ({ ...i, assetId: id() })),
    },
    request({ prompt: undefined }),
  ])
    assert.deepEqual(diffRequests(base, TakeRecordSchema.parse(variant)), []);
  // All of them, in their order, and no more than a record may name.
  assert.deepEqual(
    diffRequests(
      base,
      TakeRecordSchema.parse({
        ...base,
        recipe: null,
        model: null,
        request: {
          kind: "generation",
          promptHash: null,
          seed: null,
          width: null,
          height: null,
          durationFrames: null,
          fps: null,
          steps: null,
        },
        inputs: [],
      }),
    ),
    [...REVISION_FIELDS],
  );
});

test("a retired recipe and a changed recipe are told apart", async () => {
  const { w, target } = await withShot();
  const { takeId } = await make(w, await media(w, "made"), target);
  w.recipes[0] = { ...recipe, hash: "c".repeat(64) };
  const changed = await draftOf(w, target, takeId);
  assert.deepEqual(
    [changed.complete, changed.startable, states(changed).recipe],
    [true, true, "changed"],
  );
  assert.equal(
    said(changed, "recipe"),
    "The model's run script changed since this take; the same request may give a different result.",
  );
  assert.equal(states(changed).model, "ok");
  w.recipes[0] = { ...recipe, modelManifestHash: "d".repeat(64) };
  const other = await draftOf(w, target, takeId);
  assert.deepEqual(
    [states(other).recipe, states(other).model, other.startable],
    ["ok", "changed", true],
  );
  // The same name, for another kind of request.
  w.recipes[0] = { ...recipe, operation: "imageToVideo" };
  const turned = await draftOf(w, target, takeId);
  assert.deepEqual(
    [states(turned).recipe, turned.complete, turned.startable],
    ["unavailable", true, false],
  );
  assert.equal(
    said(turned, "recipe"),
    "This model no longer makes a video from a request of this kind.",
  );
  w.recipes[0] = { ...recipe, id: "another" };
  const gone = await draftOf(w, target, takeId);
  assert.deepEqual(
    [states(gone).route, states(gone).recipe, gone.startable],
    ["ok", "unavailable", false],
  );
  w.recipes.length = 0;
  const retired = await draftOf(w, target, takeId);
  assert.deepEqual(retired.draft, { ...REQUEST, firstFrameAssetId: null });
  assert.deepEqual(
    [retired.complete, retired.startable, states(retired).recipe],
    [true, false, "unavailable"],
  );
  assert.equal(
    said(retired, "recipe"),
    "This model is no longer offered here.",
  );
  assert.equal(states(retired).model, "unknown");
  assert.deepEqual(
    [states(retired).route, said(retired, "route")],
    ["unavailable", "No model is offered here."],
  );
  // With nothing set up the request is still read, and whether the model is offered is not said.
  const none = await draftOf(w, target, takeId, bare(w));
  assert.deepEqual(none.draft, { ...REQUEST, firstFrameAssetId: null });
  assert.deepEqual(
    [none.complete, none.startable, states(none).route, states(none).recipe],
    [true, false, "unavailable", "unknown"],
  );
  // In the words a start is refused with.
  assert.equal(
    await reason(
      execute(bare(w), "yamakan.generation.start", {
        projectId: w.projectId,
        ...REQUEST,
      }),
    ),
    `CAPABILITY_UNAVAILABLE: ${said(none, "route")}`,
  );
});

test("a take of a Kaggle model is held to its present size and length, and no CLI is run", async () => {
  const { w, target } = await withShot();
  const kaggle = withKaggle(w);
  const wan = KAGGLE_RECIPES[0]!;
  const [known] = kaggleRecipes();
  const asset = await media(w, "made");
  const row = (over: Partial<GenerationRecord>): GenerationRecord => ({
    generationId: id(),
    projectId: w.projectId,
    recipe: known!,
    prompt: PROMPT,
    seed: null,
    width: wan.width,
    height: wan.height,
    // As the page asks for it, at this project's 30 frames a second.
    durationFrames: Math.floor((wan.frames / wan.fps) * 30),
    firstFrameAssetId: null,
    inputs: [],
    executionRef: "run",
    phase: "sent",
    startedAt: 1,
    state: "succeeded",
    diagnostic: null,
    videoSha256: asset.hash,
    imported: {
      assetId: asset.id,
      lineage: {
        outputHash: asset.hash,
        inputs: [],
        recipeId: known!.id,
        recipeHash: known!.hash,
        modelManifestHash: known!.modelManifestHash,
        seed: null,
        promptHash: sha256Hex(PROMPT),
      },
    },
    cancelled: false,
    dismissed: false,
    ...over,
  });
  const same = await draftOf(
    w,
    target,
    await plant(w, target, asset, buildGenerationRecord(row({}), facts)),
    kaggle.ctx,
  );
  assert.deepEqual(states(same), {
    route: "ok",
    recipe: "ok",
    model: "ok",
    prompt: "ok",
    seed: "unknown",
    width: "ok",
    height: "ok",
    durationFrames: "ok",
  });
  assert.equal(
    said(same, "seed"),
    "This take has no recorded seed; a repeat may differ.",
  );
  assert.equal(same.startable, true);
  const other = await draftOf(
    w,
    target,
    await plant(
      w,
      target,
      asset,
      buildGenerationRecord(
        row({ width: 640, height: 360, durationFrames: 30 }),
        facts,
      ),
    ),
    kaggle.ctx,
  );
  assert.deepEqual(
    [states(other).width, states(other).height, states(other).durationFrames],
    ["changed", "changed", "changed"],
  );
  assert.equal(
    said(other, "width"),
    `The width this model makes is now ${wan.width} pixels; this take was asked for 640.`,
  );
  assert.equal(
    said(other, "durationFrames"),
    "The length this model makes is now 101 frames of this project; this take was asked for 30.",
  );
});

test("a length is compared in the project's own frames, and is at least one", async () => {
  const w = await workspace();
  w.projectId = (
    (
      await execute(w.ctx, "yamakan.project.create", {
        name: "Film",
        frameRate: { num: 24_000, den: 1001 },
      })
    ).result as Project
  ).id;
  const target = { documentId: id(), shotId: id() };
  await save(
    w,
    target.documentId,
    story([
      shot({
        id: target.shotId,
        durationTicks: (FLICKS_PER_SECOND * 1001) / 1000,
      }),
    ]),
  );
  const asset = await media(w, "made");
  const wan = KAGGLE_RECIPES[0]!;
  const [known] = kaggleRecipes();
  const record: TakeRecord = {
    ...full(),
    operation: "textToVideo",
    recipe: { id: known!.id, hash: known!.hash },
    inputs: [],
    request: {
      ...full().request,
      // 81 frames at 24 a second, in frames of 23.976.
      durationFrames: 80,
    } as TakeRecord["request"],
  };
  const d = await draftOf(
    w,
    target,
    await plant(w, target, asset, record),
    withKaggle(w).ctx,
  );
  assert.equal(states(d).durationFrames, "ok");
  const offer = {
    reason: null,
    recipes: [
      { ...known!, makes: { width: 64, height: 36, frames: 1, fps: 1000 } },
    ],
  };
  const short = await revisionDraft(
    w.store,
    { projectId: w.projectId, ...target, takeId: d.base.takeId },
    offer,
    () => null,
  );
  assert.equal(
    short.checks.find((c) => c.field === "durationFrames")!.message,
    "The length this model makes is now 1 frames of this project; this take was asked for 80.",
  );
  assert.equal(wan.fps, 24);
});

test("what a record does not hold is said of each part", async () => {
  const { w, target } = await withShot();
  const asset = await media(w, "made");
  const record: TakeRecord = {
    ...full(),
    operation: "textToVideo",
    recipe: { id: recipe.id, hash: recipe.hash },
    inputs: [],
  };
  const drafted = async (over: Partial<TakeRecord>) =>
    draftOf(w, target, await plant(w, target, asset, { ...record, ...over }));
  const request = (over: object) =>
    ({
      request: { ...record.request, ...over } as TakeRecord["request"],
    }) as Partial<TakeRecord>;
  assert.equal((await drafted({})).complete, true);
  for (const field of ["width", "height", "durationFrames"] as const) {
    const d = await drafted(request({ [field]: null }));
    assert.deepEqual(
      [d.complete, d.startable, states(d)[field]],
      [false, false, "unknown"],
      field,
    );
  }
  // A run sent without a prompt needs none again.
  const silent = await drafted(
    request({ prompt: undefined, promptHash: null }),
  );
  assert.deepEqual(
    [silent.complete, silent.draft!.prompt, said(silent, "prompt")],
    [true, null, "This take was made without a prompt."],
  );
  const unpinned = await drafted({
    model: { ...record.model!, manifestHash: null },
  });
  assert.deepEqual(
    [states(unpinned).model, unpinned.startable],
    ["unknown", true],
  );
});

test("a declared take gives a partial draft, a rendered take gives none", async () => {
  const { w, target } = await withShot();
  const asset = await media(w, "made");
  const now = stored(w, target.documentId);
  const declared = { id: id(), assetId: asset.id, sourceStartTicks: 0 };
  const plain = { id: id(), assetId: asset.id, sourceStartTicks: 0 };
  now.scenes[0]!.shots[0]!.takes = [declared, plain];
  await save(w, target.documentId, now, {
    records: [
      {
        takeId: declared.id,
        from: { declared: { model: "m", prompt: PROMPT, seed: 3 } },
      },
    ],
  });
  const partial = await draftOf(w, target, declared.id);
  assert.deepEqual(partial.draft, {
    recipeId: null,
    prompt: PROMPT,
    seed: 3,
    width: null,
    height: null,
    durationFrames: null,
    firstFrameAssetId: null,
  });
  assert.deepEqual(
    [partial.complete, partial.startable, partial.reason],
    [false, false, null],
  );
  assert.deepEqual(states(partial), {
    route: "ok",
    recipe: "unknown",
    model: "unknown",
    prompt: "ok",
    seed: "ok",
    width: "unknown",
    height: "unknown",
    durationFrames: "unknown",
  });
  assert.equal(said(partial, "width"), "This take's record holds no width.");
  const silent = await draftOf(w, target, plain.id);
  assert.deepEqual(
    [silent.draft, silent.checks, silent.reason, silent.base.recordHash],
    [null, [], "This take has no generation record.", null],
  );
  const render = TakeRecordSchema.parse({
    ...full(),
    origin: "render",
    route: "blender",
    source: { jobId: id() },
    recipe: null,
    model: null,
    operation: "render",
    request: {
      kind: "render",
      blenderVersion: "5.1",
      sceneFormat: "s",
      sceneHash: "8".repeat(64),
      width: 64,
      height: 36,
      fps: 30,
      frames: 60,
      samples: 1,
      camera: { focalLengthMm: 50, sensorWidthMm: 36 },
      moves: { orbitDegrees: 0, panDegrees: 0 },
    },
    inputs: [],
  });
  const rendered = await plant(w, target, asset, render);
  const none = await draftOf(w, target, rendered);
  assert.deepEqual(
    [none.draft, none.complete, none.startable, none.checks, none.reason],
    [
      null,
      false,
      false,
      [],
      "This take was rendered with Blender; revise it from its shot direction.",
    ],
  );
  // And a run can revise the one that has a request.
  const why =
    "VALIDATION: The base take has no generation request to revise from.";
  for (const takeId of [plain.id, rendered])
    assert.equal(
      await reason(start(w, asset, target, { derivedFromTakeId: takeId })),
      why,
    );
  const next = await make(w, await media(w, "next"), target, {
    derivedFromTakeId: declared.id,
  });
  assert.deepEqual((await recordOf(w, target, next.takeId)).changedFields, [
    "recipe",
    "model",
    "seed",
    "width",
    "height",
    "durationFrames",
  ]);
});

test("a hash-only record takes its prompt from the ledger row or says it cannot", async () => {
  const { w, target } = await withShot();
  const asset = await media(w, "made");
  const { generationId } = await start(w, asset, null);
  await call(w, "yamakan.generation.import", { generationId });
  await call(w, "yamakan.generation.dismiss", { generationId });
  const row = w.ctx.generation!.service.row(generationId)!;
  const hashOnly = buildGenerationRecord(row, facts, false);
  assert.equal((hashOnly.request as { prompt?: string }).prompt, undefined);
  const found = await draftOf(
    w,
    target,
    await plant(w, target, asset, hashOnly),
  );
  assert.equal(found.draft!.prompt, PROMPT);
  assert.equal(found.complete, true);
  const other = (
    (await execute(w.ctx, "yamakan.project.create", { name: "Other" }))
      .result as Project
  ).id;
  const w2 = { ...w, projectId: other };
  const elsewhere = await media(w2, "else");
  const theirs = await start(w2, elsewhere, null);
  const wordless = await start(w, asset, null);
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  db.prepare(
    "UPDATE jobs SET payload = json_remove(payload, '$.prompt') WHERE job_id = ?",
  ).run(wordless.generationId);
  db.close();
  for (const [why, record] of [
    ["the row is gone", { ...hashOnly, source: { generationId: id() } }],
    [
      "the row is of other words",
      {
        ...hashOnly,
        request: { ...hashOnly.request, promptHash: sha256Hex("other") },
      },
    ],
    [
      "the row holds no words",
      { ...hashOnly, source: { generationId: wordless.generationId } },
    ],
    [
      "the row is another project's",
      { ...hashOnly, source: { generationId: theirs.generationId } },
    ],
  ] as [string, TakeRecord][]) {
    const d = await draftOf(w, target, await plant(w, target, asset, record));
    assert.equal(d.draft!.prompt, null, why);
    assert.deepEqual([d.complete, d.startable], [false, false], why);
    assert.equal(states(d).prompt, "unknown", why);
    assert.ok(!JSON.stringify(d).includes("zq-103-marker"), why);
  }
});

test("a revision is compared, proposed, applied and undone as one step", async () => {
  const { w, target } = await withShot();
  const base = await make(w, await media(w, "made"), target);
  const now = stored(w, target.documentId);
  now.scenes[0]!.shots[0]!.selectedTakeId = base.takeId;
  await save(w, target.documentId, now);
  const opened = await w.store.load(w.projectId);
  await call(w, "yamakan.story.assemble", {
    projectId: w.projectId,
    expectedRevision: opened.revision,
    documentId: target.documentId,
    trackId: opened.tracks.find((t) => t.kind === "video")!.id,
  });
  const second = await media(w, "second");
  const revised = await make(w, second, target, {
    seed: 8,
    derivedFromTakeId: base.takeId,
  });
  const compared = await call(w, "yamakan.take.compare", {
    projectId: w.projectId,
    ...target,
    takeIds: [base.takeId, revised.takeId],
  });
  assert.equal(compared.takes.length, 2);
  const shows = async () =>
    (await w.store.load(w.projectId)).clips.at(-1)!.assetId;
  const before = await shows();
  const proposal = await call(w, "yamakan.take.proposeReplace", {
    projectId: w.projectId,
    ...target,
    takeId: revised.takeId,
  });
  const at = await headOf(w);
  const applied = await call(w, "yamakan.take.apply", {
    projectId: w.projectId,
    expectedRevision: at,
    proposal,
  });
  assert.equal(applied.revision, at + 1);
  assert.equal(await shows(), second.id);
  const undone = await call(w, "yamakan.project.undo", {
    projectId: w.projectId,
    expectedRevision: applied.revision,
  });
  assert.equal(undone.revision, at + 2);
  assert.equal(await shows(), before);
  assert.notEqual(before, second.id);
});

test("a start names its base rightly, or nothing is recorded or sent", async () => {
  const { w, target } = await withShot();
  const made = await media(w, "made");
  const base = await make(w, made, target);
  const now = stored(w, target.documentId);
  const other = shot({ name: "Other" });
  now.scenes[0]!.shots.push(other);
  await save(w, target.documentId, now);
  const rows = () =>
    w.store.read(
      (db) =>
        db.prepare("SELECT count(*) AS n FROM jobs").get() as { n: number },
    ).n;
  const [held, sent] = [rows(), w.sent.length];
  const derivedFromTakeId = base.takeId;
  const there = { ...target, shotId: other.id };
  for (const [over, why] of [
    [{ derivedFromTakeId }, "VALIDATION: A revision names the shot it is for."],
    [
      { target: there, derivedFromTakeId },
      "VALIDATION: A revision is made for the shot its base take belongs to.",
    ],
    [
      { target, derivedFromTakeId: id() },
      "VALIDATION: A revision is made for the shot its base take belongs to.",
    ],
    [
      { target, revisionNote: "why" },
      "VALIDATION: A revision note is of a run that revises a take.",
    ],
  ] as [object, string][])
    assert.equal(await reason(start(w, made, null, over)), why);
  // What changed, and the base's record, are the service's to say.
  for (const over of [
    { changedFields: [] },
    { derivedFromRecordHash: base.recordHash },
    { derivedFrom: { takeId: base.takeId, recordHash: base.recordHash } },
    { revisionNote: "" },
    { revisionNote: "   " },
    { revisionNote: "x".repeat(501) },
    { derivedFromTakeId: "not an id" },
  ])
    assert.match(
      await reason(start(w, made, target, { derivedFromTakeId, ...over })),
      /^VALIDATION: /,
      JSON.stringify(over).slice(0, 60),
    );
  assert.deepEqual([rows(), w.sent.length], [held, sent]);
  // An agent reads a draft, and starts nothing.
  const agent = {
    ...w.ctx,
    principal: { id: `agent:${id()}`, scopes: new Set(Scopes) },
  } as unknown as CommandContext;
  assert.equal((await draftOf(w, target, base.takeId, agent)).complete, true);
  assert.match(
    await reason(
      execute(agent, "yamakan.generation.start", {
        projectId: w.projectId,
        ...REQUEST,
        target,
        derivedFromTakeId,
      }),
    ),
    /^SCOPE_DENIED/,
  );
  assert.deepEqual([rows(), w.sent.length], [held, sent]);
});

test("a draft is read from its own project's story, and reading it changes nothing", async () => {
  const { w, target } = await withShot();
  const { takeId } = await make(w, await media(w, "made"), target);
  const other = (
    (await execute(w.ctx, "yamakan.project.create", { name: "Other" }))
      .result as Project
  ).id;
  const pack = id();
  const still = await media(w, "pack");
  await call(w, "yamakan.pack.save", {
    projectId: w.projectId,
    expectedRevision: await headOf(w),
    documentId: pack,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Pack",
      entries: [
        {
          id: id(),
          role: "environment",
          assetId: still.id,
          assetHash: still.hash,
          label: "Place",
          characterId: null,
          consentId: null,
        },
      ],
    },
  });
  const ask = (over: object) =>
    reason(
      execute(w.ctx, "yamakan.take.revisionDraft", {
        projectId: w.projectId,
        ...target,
        takeId,
        ...over,
      }),
    );
  const NO_STORY = "NOT_FOUND: This project has no such story.";
  assert.equal(await ask({ projectId: other }), NO_STORY);
  assert.equal(await ask({ documentId: pack }), NO_STORY);
  assert.equal(await ask({ documentId: id() }), NO_STORY);
  assert.equal(
    await ask({ shotId: id() }),
    "NOT_FOUND: The story has no such shot.",
  );
  assert.equal(
    await ask({ takeId: id() }),
    "NOT_FOUND: The shot has no such take.",
  );
  assert.match(await ask({ noUnconsentedPerson: true }), /^VALIDATION/);
  const asIs = async () => {
    const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"), {
      readOnly: true,
    });
    const jobs = db.prepare("SELECT * FROM jobs ORDER BY rowid").all();
    db.close();
    return JSON.stringify([
      await headOf(w),
      hashOf(w, target.documentId),
      jobs,
    ]);
  };
  const before = await asIs();
  const asked = w.asked.length;
  const kaggle = withKaggle(w);
  // The count sees the CLI that this would run.
  assert.equal(
    await started(() =>
      kaggleCli(process.execPath, { mayConnect: () => {} })(
        ["--version"],
        20_000,
      ),
    ),
    1,
  );
  const programs = await started(async () => {
    for (let n = 0; n < 5; n++) {
      await draftOf(w, target, takeId);
      await draftOf(w, target, takeId, bare(w));
      await draftOf(w, target, takeId, kaggle.ctx);
    }
  });
  assert.equal(await asIs(), before);
  assert.equal(w.asked.length, asked, "no engine was asked");
  assert.equal(programs, 0, "no CLI was run");
  assert.equal(kaggle.ledgers(), 0, "no engine was made");
  // A list of runs makes one, which the count sees.
  await call(
    w,
    "yamakan.generation.list",
    { projectId: w.projectId },
    kaggle.ctx,
  );
  assert.ok(kaggle.ledgers() > 0);
  // A change between the two reads is said, not mixed.
  const load = w.store.load.bind(w.store);
  w.store.load = async (projectId: string) => {
    const held = await load(projectId);
    w.store.load = load;
    await save(w, id(), story([shot()]));
    return held;
  };
  assert.equal(
    await ask({}),
    "REVISION_CONFLICT: The project changed while it was read; try again.",
  );
});

test("a base taken out later is still named, and one that cannot be read is said", async () => {
  const { w, target } = await withShot();
  const base = await make(w, await media(w, "made"), target);
  const later = await media(w, "later");
  const run = await start(w, later, target, {
    seed: 8,
    derivedFromTakeId: base.takeId,
  });
  const lost = await media(w, "lost");
  const second = await start(w, lost, target, {
    seed: 9,
    derivedFromTakeId: base.takeId,
  });
  const now = stored(w, target.documentId);
  now.scenes[0]!.shots[0]!.takes = [];
  await save(w, target.documentId, now);
  const { take } = await call(w, "yamakan.generation.import", run);
  const record = await recordOf(w, target, take.takeId);
  assert.deepEqual(
    [record.derivedFromTakeId, record.derivedFromRecordHash],
    [base.takeId, base.recordHash],
  );
  assert.deepEqual(record.changedFields, ["seed"]);
  // Its record damaged meanwhile: the take comes in, and the answer says what it lacks.
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  db.prepare(
    "UPDATE creative_documents SET bytes = zeroblob(byte_length) WHERE hash = ?",
  ).run(base.recordHash);
  db.close();
  // A failure of this service's own is not taken for one.
  const takeRecord = w.store.takeRecord.bind(w.store);
  w.store.takeRecord = (projectId, documentId, recordHash) => {
    if (recordHash === base.recordHash) throw new Error("a fault");
    return takeRecord(projectId, documentId, recordHash);
  };
  assert.match(
    await reason(call(w, "yamakan.generation.import", second)),
    /^INTERNAL/,
  );
  w.store.takeRecord = takeRecord;
  const { take: noted } = await call(w, "yamakan.generation.import", second);
  assert.equal(noted.appended, true);
  assert.equal(
    noted.notice,
    "The record of the take this one revises could not be read, so what changed from it is not recorded.",
  );
  const bareRecord = await recordOf(w, target, noted.takeId);
  assert.deepEqual(
    [
      bareRecord.derivedFromTakeId,
      bareRecord.derivedFromRecordHash,
      bareRecord.changedFields,
    ],
    [base.takeId, base.recordHash, []],
  );
  // And again, when a stop came before the run's row kept it.
  const db2 = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  const job = (runId: string) =>
    JSON.parse(
      (
        db2.prepare("SELECT payload FROM jobs WHERE job_id = ?").get(runId) as {
          payload: string;
        }
      ).payload,
    );
  const keep = (runId: string, row: object) =>
    db2
      .prepare("UPDATE jobs SET payload = ? WHERE job_id = ?")
      .run(JSON.stringify(row), runId);
  for (const [runId, notice] of [
    [second.generationId, noted.notice],
    [run.generationId, undefined],
  ]) {
    const { take: kept, ...row } = job(runId);
    keep(runId, row);
    const { take: again } = await call(w, "yamakan.generation.import", {
      generationId: runId,
    });
    assert.deepEqual([again.takeId, again.notice], [kept.takeId, notice]);
  }
  // By hand no answer could say it, so it is refused.
  const there = { documentId: id(), shotId: id() };
  const byHand = async (runId: string) => {
    const takeId = id();
    const made = job(runId).imported.assetId;
    return reason(
      save(
        w,
        there.documentId,
        story([
          shot({
            id: there.shotId,
            takes: [{ id: takeId, assetId: made, sourceStartTicks: 0 }],
          }),
        ]),
        { records: [{ takeId, from: { generationId: runId } }] },
      ),
    );
  };
  assert.equal(
    await byHand(second.generationId),
    `RECOVERY_REQUIRED: ${noted.notice} Nothing was saved; the take can be saved without a record.`,
  );
  // Nor is a row that names a base and no story that could hold its record.
  const { target: _aim, ...aimless } = job(second.generationId);
  keep(second.generationId, aimless);
  assert.match(
    await byHand(second.generationId),
    /^RECOVERY_REQUIRED: What this run kept/,
  );
  keep(second.generationId, { ...aimless, target });
  // A row that says anything of its base comes in without one, and that is said.
  const said = job(second.generationId);
  for (const [n, derivedFrom] of [
    {},
    "str",
    7,
    null,
    { takeId: base.takeId },
    { takeId: "C:\\x", recordHash: base.recordHash },
    { takeId: base.takeId, recordHash: "z" },
    { ...said.derivedFrom, revisionNote: "x".repeat(501) },
  ].entries()) {
    const odd = await media(w, `odd ${n}`);
    const started = await start(w, odd, target);
    keep(started.generationId, { ...job(started.generationId), derivedFrom });
    const { take: plain } = await call(w, "yamakan.generation.import", started);
    assert.equal(
      plain.notice,
      "What this run kept of the take it revises does not read, so nothing of it is recorded.",
      `${n}`,
    );
    const record = await recordOf(w, target, plain.takeId);
    assert.deepEqual(
      [record.derivedFromTakeId, record.revisionNote, record.changedFields],
      [null, null, []],
    );
    assert.match(await byHand(started.generationId), /^RECOVERY_REQUIRED/);
    const body = stored(w, target.documentId);
    body.scenes[0]!.shots[0]!.takes = [];
    await save(w, target.documentId, body);
  }
  db2.close();
});

test("a revision's video saved as a take by hand carries the same words of its base", async () => {
  const { w, target } = await withShot();
  const base = await make(w, await media(w, "made"), target);
  const made = await media(w, "next");
  const { generationId } = await start(w, made, target, {
    width: 32,
    derivedFromTakeId: base.takeId,
  });
  // Its shot is full as it comes in, so the person puts it elsewhere.
  const now = stored(w, target.documentId);
  const [only] = now.scenes[0]!.shots;
  only!.takes.push(
    ...Array.from({ length: 7 }, () => ({
      id: id(),
      assetId: made.id,
      sourceStartTicks: 0,
    })),
  );
  const there = shot({ name: "There" });
  now.scenes[0]!.shots.push(there);
  await save(w, target.documentId, now);
  const { take } = await call(w, "yamakan.generation.import", { generationId });
  assert.equal(take.reason, "shot-full");
  const takeId = id();
  const after = stored(w, target.documentId);
  after.scenes[0]!.shots[1]!.takes = [
    { id: takeId, assetId: made.id, sourceStartTicks: 0 },
  ];
  await save(w, target.documentId, after, {
    records: [{ takeId, from: { generationId } }],
  });
  const record = await recordOf(w, { ...target, shotId: there.id }, takeId);
  assert.deepEqual(
    [record.derivedFromTakeId, record.changedFields],
    [base.takeId, ["width"]],
  );
});
