// MPR-101: how a take was made, as an immutable record its take names by hash. The service
// writes it with the story, from its own ledger row or a declared receipt; a version 1 story
// reads and saves as version 2. The media here is rows only, so nothing is probed.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore, SNAPSHOT_FORMAT } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  API_VERSION,
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import {
  DOCUMENT_READ_VERSIONS,
  DocumentRefSchema,
  validateDocument,
} from "../core/documents.ts";
import {
  createGenerationService,
  memoryLedger,
  type GenerationRecord,
} from "../core/engines/generation.ts";
import {
  engineReport,
  type EngineAdapterV2,
} from "../core/engines/contract-v2.ts";
import {
  KAGGLE_RECIPES,
  kaggleRecipeFacts,
  kaggleRecipes,
} from "../core/engines/kaggle.ts";
import {
  STORY_LIMITS,
  StoryDocumentV1Schema,
  parseStory,
  storyTextBytes,
  verifyStory,
  type StoryDocument,
} from "../core/story.ts";
import {
  RECORD_HOLDS_PROMPT,
  TAKE_RECORD_LIMITS,
  TakeRecordSchema,
  buildDeclaredRecord,
  buildGenerationRecord,
  recordHashOf,
  type TakeRecord,
} from "../core/take-record.ts";
import { renderStoryShot } from "../core/director/cinema-pipeline.ts";
import type { Asset, Project } from "../core/project.ts";

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
const id = () => crypto.randomUUID();
const PROMPT = "a marker no row but these may hold: zq-71-marker";
const reason = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const c = toCommandError(e);
    return `${c.code}: ${c.message}`;
  }
};

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-take-record-"));
  bases.push(root);
  const store = new ProjectStore(root);
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
    await execute(ctx, "yamakan.project.create", { name: "Records" })
  ).result as Project;
  return { root, store, queue, ctx, projectId: project.id };
}
type W = Awaited<ReturnType<typeof workspace>>;

// A video of the project, as its rows and ten bytes that no decoder is asked about.
async function video(w: W, seed: string): Promise<Asset> {
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
  };
  const folder = path.join(w.root, "projects", w.projectId, "assets");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${asset.hash}.mp4`), bytes);
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

const wan = KAGGLE_RECIPES[0]!;
// An imported run of this project, as the job table keeps it.
function run(
  w: W,
  asset: Asset,
  over: Partial<GenerationRecord> = {},
): GenerationRecord {
  const row: GenerationRecord = {
    generationId: id(),
    projectId: w.projectId,
    recipe: {
      id: wan.id,
      hash: "a".repeat(64),
      operation: "textToVideo",
      modelManifestHash: sha256Hex(`${wan.model}@${wan.revision}`),
    },
    prompt: PROMPT,
    seed: 7,
    width: 704,
    height: 480,
    durationFrames: 81,
    firstFrameAssetId: null,
    inputs: [],
    executionRef: "run-1",
    phase: "sent",
    startedAt: 1_000,
    endedAt: 61_000,
    importedAt: 70_000,
    state: "succeeded",
    diagnostic: null,
    videoSha256: asset.hash,
    imported: {
      assetId: asset.id,
      lineage: {
        outputHash: asset.hash,
        inputs: [],
        recipeId: wan.id,
        recipeHash: "a".repeat(64),
        modelManifestHash: sha256Hex(`${wan.model}@${wan.revision}`),
        seed: 7,
        promptHash: sha256Hex(PROMPT),
      },
    },
    cancelled: false,
    dismissed: false,
    ...over,
  };
  w.queue.generationLedger().begin(row);
  return row;
}

type Take = StoryDocument["scenes"][number]["shots"][number]["takes"][number];
const take = (asset: Asset, over: Partial<Take> = {}): Take => ({
  id: id(),
  assetId: asset.id,
  sourceStartTicks: 0,
  ...over,
});
const story = (takes: Take[], shotId = id(), sceneId = id()) => ({
  format: "yamakan.story" as const,
  formatVersion: 2 as const,
  title: "Records",
  scenes: [
    {
      id: sceneId,
      name: "One",
      shots: [
        {
          id: shotId,
          name: "Shot",
          durationTicks: 30 * FRAME,
          notes: "",
          referencePacks: [],
          takes,
          selectedTakeId: takes[0]?.id ?? null,
        },
      ],
    },
  ],
});
type Saved = {
  project: Project;
  document: { contentHash: string; schemaVersion: number };
  records: { takeId: string; recordHash: string }[];
};
const save = async (
  w: W,
  documentId: string,
  body: object,
  over: object = {},
) => {
  const held = w.store
    .listDocuments(w.projectId)
    .find((d) => d.id === documentId);
  return (
    await execute(w.ctx, "yamakan.story.save", {
      projectId: w.projectId,
      expectedRevision: (await w.store.load(w.projectId)).revision,
      documentId,
      expectedContentHash: held?.contentHash ?? null,
      story: body,
      ...over,
    })
  ).result as Saved;
};
const stored = (w: W, documentId: string) =>
  JSON.parse(
    w.store.getDocument(w.projectId, documentId).bytes.toString("utf8"),
  ) as StoryDocument;
const read = async (w: W, documentId: string, body: StoryDocument, n = 0) =>
  (
    await execute(w.ctx, "yamakan.take.record", {
      projectId: w.projectId,
      documentId,
      shotId: body.scenes[0]!.shots[0]!.id,
      takeId: body.scenes[0]!.shots[0]!.takes[n]!.id,
    })
  ).result as { recordHash: string; record: TakeRecord };

test("a generation's take record matches its ledger row and its own hash", async () => {
  const w = await workspace();
  const asset = await video(w, "made");
  const still = await video(w, "first");
  const row = run(w, asset, {
    recipe: {
      id: "kaggle-wan22-ti2v-5b-first-frame",
      hash: kaggleRecipes().find(
        (r) => r.id === "kaggle-wan22-ti2v-5b-first-frame",
      )!.hash,
      operation: "imageToVideo",
      modelManifestHash: sha256Hex(`${wan.model}@${wan.revision}`),
    },
    firstFrameAssetId: still.id,
    inputs: [{ assetId: still.id, assetHash: still.hash }],
  });
  const documentId = id();
  const t = take(asset);
  const saved = await save(w, documentId, story([t]), {
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const body = stored(w, documentId);
  const { recordHash, record } = await read(w, documentId, body);
  assert.deepEqual(saved.records, [{ takeId: t.id, recordHash }]);
  assert.equal(body.scenes[0]!.shots[0]!.takes[0]!.recordHash, recordHash);
  assert.equal(recordHash, sha256Hex(canonicalJson(record)));
  assert.equal(record.origin, "generation");
  assert.equal(record.route, "kaggle");
  assert.deepEqual(record.source, { generationId: row.generationId });
  assert.deepEqual(record.recipe, { id: row.recipe.id, hash: row.recipe.hash });
  assert.deepEqual(record.model, {
    id: wan.model,
    revision: wan.revision,
    manifestHash: row.recipe.modelManifestHash,
    licence: wan.licence,
  });
  assert.equal(record.operation, "imageToVideo");
  assert.deepEqual(record.request, {
    kind: "generation",
    promptHash: sha256Hex(PROMPT),
    seed: 7,
    width: 704,
    height: 480,
    durationFrames: 81,
    fps: wan.fps,
    steps: wan.steps,
  });
  assert.deepEqual(record.inputs, [
    { assetId: still.id, assetHash: still.hash, role: "firstFrame" },
  ]);
  assert.deepEqual(record.output, { sha256: asset.hash });
  assert.deepEqual(record.timings, {
    startedAt: 1_000,
    endedAt: 61_000,
    importedAt: 70_000,
  });
  assert.deepEqual(record.usage, { wallMs: 60_000, quotaSeconds: null });
  assert.deepEqual(record.changedFields, []);
  // The take list names it.
  const list = (
    await execute(w.ctx, "yamakan.take.list", {
      projectId: w.projectId,
      documentId,
    })
  ).result as { shots: { takes: { recordHash: string | null }[] }[] };
  assert.equal(list.shots[0]!.takes[0]!.recordHash, recordHash);
});

test("a row without its end, or of a recipe this build does not know, records what is not known as such", async () => {
  const w = await workspace();
  const asset = await video(w, "old");
  const row = run(w, asset, {
    endedAt: undefined,
    importedAt: undefined,
    recipe: {
      id: "local-graph",
      hash: "d".repeat(64),
      operation: "textToVideo",
      modelManifestHash: "e".repeat(64),
    },
  });
  const record = buildGenerationRecord(row, {
    route: "comfyui",
    model: null,
    fps: null,
    steps: null,
  });
  assert.deepEqual(record.timings, {
    startedAt: 1_000,
    endedAt: null,
    importedAt: null,
  });
  assert.equal(record.usage.wallMs, null);
  assert.deepEqual(record.model, {
    id: "local-graph",
    revision: null,
    manifestHash: "e".repeat(64),
    licence: null,
  });
  // The prompt's words are in a record only when FD-2 says so; both forms are valid.
  assert.equal(RECORD_HOLDS_PROMPT, false);
  assert.ok(!("prompt" in record.request));
  const open = buildGenerationRecord(
    row,
    { route: "comfyui", model: null, fps: null, steps: null },
    true,
  );
  assert.equal(
    open.request.kind === "generation" && open.request.prompt,
    PROMPT,
  );
  TakeRecordSchema.parse(open);
});

// The head's story as an older build left it: its bytes, hash and version 1, named by a head
// snapshot of its own.
function asAnOlderBuildStored(w: W, documentId: string, one: object) {
  const bytes = Buffer.from(canonicalJson(one), "utf8");
  const hash = sha256Hex(bytes);
  const ref = w.store
    .listDocuments(w.projectId)
    .find((d) => d.id === documentId)!;
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  const head = db
    .prepare(
      "SELECT p.snapshot_hash AS hash, s.format AS format, s.bytes AS bytes FROM projects p JOIN snapshots s ON s.hash = p.snapshot_hash WHERE p.project_id = ?",
    )
    .get(w.projectId) as { hash: string; format: string; bytes: Uint8Array };
  const was = Buffer.from(head.bytes).toString("utf8");
  const now = was
    .replace(ref.contentHash, hash)
    .replace('"schemaVersion":2', '"schemaVersion":1');
  assert.ok(now.includes(hash) && now.includes('"schemaVersion":1'));
  const snapshot = Buffer.from(now, "utf8");
  const next = sha256Hex(snapshot);
  db.prepare(
    "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) SELECT ?, kind, 1, asset_ids, object_digests, ?, ? FROM creative_documents WHERE hash = ?",
  ).run(hash, bytes, bytes.length, ref.contentHash);
  db.prepare(
    "INSERT INTO story_document_versions(project_id, document_id, content_hash, revision) SELECT project_id, document_id, ?, revision FROM story_document_versions WHERE content_hash = ?",
  ).run(hash, ref.contentHash);
  db.prepare(
    "INSERT INTO snapshots(hash, format, bytes, byte_length) VALUES (?, ?, ?, ?)",
  ).run(next, head.format, snapshot, snapshot.length);
  db.prepare("INSERT INTO snapshot_document_refs VALUES (?, ?)").run(
    next,
    hash,
  );
  db.prepare("UPDATE projects SET snapshot_hash = ? WHERE project_id = ?").run(
    next,
    w.projectId,
  );
  db.prepare(
    "UPDATE revisions SET snapshot_hash = ? WHERE project_id = ? AND snapshot_hash = ?",
  ).run(next, w.projectId, head.hash);
  db.close();
  return { hash, bytes };
}

test("a version 1 story reads and saves as version 2 without losing a take", async () => {
  const w = await workspace();
  const asset = await video(w, "kept");
  const documentId = id();
  const takes = [
    take(asset, {
      lineage: {
        label: "seed 7",
        outputHash: asset.hash,
        inputs: [{ assetId: asset.id, assetHash: asset.hash }],
      },
    }),
    take(asset),
  ];
  const two = story(takes);
  await save(w, documentId, two);
  const one = StoryDocumentV1Schema.parse({ ...two, formatVersion: 1 });
  const old = asAnOlderBuildStored(w, documentId, one);
  // It opens as it is stored, and its takes are listed and assembled.
  assert.deepEqual(stored(w, documentId) as object, one);
  const list = (
    await execute(w.ctx, "yamakan.take.list", {
      projectId: w.projectId,
      documentId,
    })
  ).result as { shots: { takes: { id: string; recordHash: null }[] }[] };
  assert.deepEqual(
    list.shots[0]!.takes.map((t) => [t.id, t.recordHash]),
    takes.map((t) => [t.id, null]),
  );
  const opened = await w.store.load(w.projectId);
  const assembled = (
    await execute(w.ctx, "yamakan.story.assemble", {
      projectId: w.projectId,
      expectedRevision: opened.revision,
      documentId,
      trackId: opened.tracks.find((t) => t.kind === "video")!.id,
    })
  ).result as Project;
  assert.equal(assembled.clips.at(-1)!.assetId, asset.id);
  // The page's next save of what it read is stored as version 2, with everything kept.
  const saved = await save(w, documentId, { ...one, title: "Next" });
  assert.equal(saved.document.schemaVersion, 2);
  assert.deepEqual(stored(w, documentId), { ...two, title: "Next" });
  // What the older build stored is untouched, and is never written again.
  assert.equal(validateDocument("story", 1, old.bytes).hash, old.hash);
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"), {
    readOnly: true,
  });
  const row = db
    .prepare("SELECT bytes FROM creative_documents WHERE hash = ?")
    .get(old.hash) as { bytes: Uint8Array };
  db.close();
  assert.equal(sha256Hex(Buffer.from(row.bytes)), old.hash);
  assert.equal(
    await reason(save(w, documentId, one)),
    "VALIDATION: This story was saved in a newer format; read it again before saving.",
  );
  assert.equal(
    await reason(
      w.store.commitDocument({
        projectId: w.projectId,
        expectedRevision: (await w.store.load(w.projectId)).revision,
        documentId: id(),
        kind: "story",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { bytes: old.bytes },
        verify: () => {},
      }),
    ),
    "VALIDATION: Unsupported story document schema version 1.",
  );
  // Nor for a request id that has committed nothing.
  assert.equal(
    await reason(
      w.store.commitDocument(
        {
          projectId: w.projectId,
          expectedRevision: (await w.store.load(w.projectId)).revision,
          documentId: id(),
          kind: "story",
          schemaVersion: 1,
          expectedContentHash: null,
          source: { bytes: old.bytes },
          verify: () => {},
        },
        {
          principalId: "browser-ui",
          requestId: id(),
          digest: "a".repeat(64),
        },
      ),
    ),
    "VALIDATION: Unsupported story document schema version 1.",
  );
  assert.deepEqual(DOCUMENT_READ_VERSIONS.story, [1, 2]);
});

test("a take record survives restart, restore and later saves", async () => {
  const w = await workspace();
  const asset = await video(w, "lasting");
  const row = run(w, asset);
  const documentId = id();
  const t = take(asset);
  const saved = await save(w, documentId, story([t]), {
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const body = stored(w, documentId);
  const before = await read(w, documentId, body);
  const titled = { ...body, title: "Later" };
  await save(w, documentId, titled);
  assert.deepEqual(await read(w, documentId, titled), before);
  await execute(w.ctx, "yamakan.project.restore", {
    projectId: w.projectId,
    revision: saved.project.revision,
    expectedHeadFingerprint: (
      (
        await execute(w.ctx, "yamakan.project.history", {
          projectId: w.projectId,
        })
      ).result as { headFingerprint: string }
    ).headFingerprint,
  });
  assert.deepEqual(await read(w, documentId, body), before);
  await w.queue.close();
  w.store.close();
  const store = new ProjectStore(w.root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const reopened = { ...w, store, queue, ctx: { ...w.ctx, store, queue } };
  assert.deepEqual(await read(reopened, documentId, body), before);
});

test("a declared record says so, and a retry of the request replays it", async () => {
  const w = await workspace();
  const asset = await video(w, "receipt");
  const documentId = id();
  const t = take(asset);
  const declared = {
    model: "someone/model",
    revision: "r1",
    prompt: PROMPT,
    seed: 3,
    steps: 20,
    licence: "Apache-2.0",
  };
  const request = {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId,
    expectedContentHash: null,
    story: story([t]),
    records: [{ takeId: t.id, from: { declared } }],
  };
  const ctx = { ...w.ctx, requestId: id() };
  const first = (await execute(ctx, "yamakan.story.save", request))
    .result as Saved;
  const again = (await execute(ctx, "yamakan.story.save", request))
    .result as Saved;
  assert.deepEqual(again.records, first.records);
  assert.equal(again.project.revision, first.project.revision);
  const { record } = await read(w, documentId, stored(w, documentId));
  assert.equal(record.origin, "declared");
  assert.equal(record.route, "receiptFile");
  assert.equal(record.source, null);
  assert.equal(record.output.sha256, asset.hash);
  assert.deepEqual(record.model, {
    id: "someone/model",
    revision: "r1",
    manifestHash: null,
    licence: "Apache-2.0",
  });
  assert.deepEqual(record.timings, {
    startedAt: null,
    endedAt: null,
    importedAt: null,
  });
});

test("a prompt appears in no receipt, revision or outbox row, nor in the record", async () => {
  const w = await workspace();
  const asset = await video(w, "private");
  const row = run(w, asset);
  const t = take(asset);
  await execute({ ...w.ctx, requestId: id() }, "yamakan.story.save", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId: id(),
    expectedContentHash: null,
    story: story([t]),
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"), {
    readOnly: true,
  });
  const holds = (table: string) =>
    (db.prepare(`SELECT * FROM ${table}`).all() as object[]).some((r) =>
      Object.values(r).some((v) =>
        (v instanceof Uint8Array
          ? Buffer.from(v).toString("utf8")
          : String(v)
        ).includes("zq-71-marker"),
      ),
    );
  const tables = (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[]
  ).map((r) => r.name);
  assert.ok(tables.includes("command_receipts"));
  // Only the run's own ledger row.
  assert.deepEqual(tables.filter(holds), ["jobs"]);
  db.close();
});

test("a record the service did not write for a take is refused, and nothing is stored", async () => {
  const w = await workspace();
  const [a, b] = [await video(w, "a"), await video(w, "b")];
  const row = run(w, a);
  const documentId = id();
  const [ta, tb] = [take(a), take(b)];
  await save(w, documentId, story([ta, tb]), {
    records: [{ takeId: ta.id, from: { generationId: row.generationId } }],
  });
  const body = stored(w, documentId);
  const before = w.store.getDocument(w.projectId, documentId).ref.contentHash;
  const changed = (edit: (takes: Take[]) => void) => {
    const next = structuredClone(body);
    edit(next.scenes[0]!.shots[0]!.takes);
    return next;
  };
  const held = body.scenes[0]!.shots[0]!.takes[0]!.recordHash!;
  const SERVICE =
    "VALIDATION: A take's generation record is written by the service.";
  const KEEPS = "VALIDATION: A take keeps its generation record.";
  // Invented, and copied from another take.
  for (const hash of ["f".repeat(64), held])
    assert.equal(
      await reason(
        save(
          w,
          documentId,
          changed((takes) => void (takes[1]!.recordHash = hash)),
        ),
      ),
      SERVICE,
    );
  // Removed, changed, its media changed, and (below) one written over it.
  for (const edit of [
    (takes: Take[]) => void delete takes[0]!.recordHash,
    (takes: Take[]) => void (takes[0]!.recordHash = "e".repeat(64)),
    (takes: Take[]) => void (takes[0]!.assetId = b.id),
  ])
    assert.equal(await reason(save(w, documentId, changed(edit))), KEEPS);
  assert.equal(
    await reason(
      save(w, documentId, body, {
        records: [
          {
            takeId: ta.id,
            from: { declared: { model: "m", prompt: "p", seed: 1 } },
          },
        ],
      }),
    ),
    KEEPS,
  );
  // Two records of the same take, and one of no take of this story.
  const from = { generationId: row.generationId };
  assert.equal(
    await reason(
      save(w, documentId, body, {
        records: [
          { takeId: ta.id, from },
          { takeId: ta.id, from },
        ],
      }),
    ),
    "VALIDATION: A take has one record.",
  );
  assert.equal(
    await reason(
      save(w, documentId, body, { records: [{ takeId: id(), from }] }),
    ),
    "VALIDATION: A record is for a take of this story.",
  );
  assert.equal(
    w.store.getDocument(w.projectId, documentId).ref.contentHash,
    before,
  );
  // Saving it as it is, or with the same record asked for again, is fine.
  await save(
    w,
    documentId,
    { ...body, title: "Same record" },
    {
      records: [{ takeId: ta.id, from }],
    },
  );
});

test("a generation of another project, not imported, or of other media is refused", async () => {
  const w = await workspace();
  const [a, b] = [await video(w, "mine"), await video(w, "other")];
  const t = take(a);
  const documentId = id();
  const other = (
    await execute(w.ctx, "yamakan.project.create", { name: "Other" })
  ).result as Project;
  const foreign = run(w, a, { projectId: other.id });
  const pending = run(w, a, { imported: null, state: "running" });
  const elsewhere = run(w, b);
  for (const [generationId, why] of [
    [foreign.generationId, "NOT_FOUND: Generation not found."],
    [id(), "NOT_FOUND: Generation not found."],
    [pending.generationId, "VALIDATION: This generation is not imported."],
    [
      elsewhere.generationId,
      "VALIDATION: This generation did not make the take's media.",
    ],
  ] as const)
    assert.equal(
      await reason(
        save(w, documentId, story([t]), {
          records: [{ takeId: t.id, from: { generationId } }],
        }),
      ),
      why,
    );
  assert.deepEqual(w.store.listDocuments(w.projectId), []);
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"), {
    readOnly: true,
  });
  assert.deepEqual(db.prepare("SELECT kind FROM creative_documents").all(), []);
  db.close();
});

test("bounds: eight records, the prompt, unknown keys, and 16 KiB", async () => {
  const w = await workspace();
  const asset = await video(w, "bounds");
  const takes = Array.from({ length: 8 }, () => take(asset));
  const declared = { model: "m", prompt: "p", seed: 1 };
  const ask = (from: object, n = 1) =>
    reason(
      save(w, id(), story(takes), {
        records: Array.from({ length: n }, (_, i) => ({
          takeId: takes[i % 8]!.id,
          from,
        })),
      }),
    );
  assert.match(await ask({ declared }, 9), /^VALIDATION/);
  assert.match(
    await ask({ declared: { ...declared, prompt: "x".repeat(4001) } }),
    /^VALIDATION/,
  );
  assert.match(
    await ask({ declared: { ...declared, path: "C:/x" } }),
    /^VALIDATION/,
  );
  assert.equal(await ask({ declared }, 8), "ok");
  const record = buildDeclaredRecord(
    { ...declared, prompt: "\u0000".repeat(4000) },
    asset.hash,
    [],
    true,
  );
  const bytes = Buffer.from(canonicalJson(record), "utf8");
  assert.ok(bytes.length > TAKE_RECORD_LIMITS.recordBytes);
  assert.throws(
    () => validateDocument("takeRecord", 1, bytes),
    /Canonical document exceeds 16384 bytes/,
  );
});

test("a take record is no project document, and the capability names each kind's versions", async () => {
  const w = await workspace();
  assert.equal(
    await reason(
      execute(w.ctx, "yamakan.document.commit", {
        projectId: w.projectId,
        expectedRevision: 0,
        documentId: id(),
        kind: "takeRecord",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { contentHash: "c".repeat(64) },
      }),
    ),
    "VALIDATION: A take record is saved with its take.",
  );
  const { kinds } = (await execute(w.ctx, "yamakan.document.capability", {}))
    .result as {
    kinds: Record<string, { written: number; read: number[] }>;
  };
  assert.deepEqual(kinds.story, { written: 2, read: [1, 2] });
  assert.deepEqual(kinds.takeRecord, { written: 1, read: [1] });
  assert.deepEqual(kinds.studio, { written: 1, read: [1] });
});

test("a take without a record, or with a damaged one, says so", async () => {
  const w = await workspace();
  const asset = await video(w, "damaged");
  const documentId = id();
  const t = take(asset);
  await save(w, documentId, story([t]));
  assert.equal(
    await reason(read(w, documentId, stored(w, documentId))),
    "NOT_FOUND: The take has no generation record.",
  );
  const row = run(w, asset);
  await save(w, documentId, stored(w, documentId), {
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const raw = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  raw
    .prepare(
      "UPDATE creative_documents SET byte_length = 2, bytes = ? WHERE kind = 'takeRecord'",
    )
    .run(Buffer.from("{}"));
  raw.close();
  assert.match(
    await reason(read(w, documentId, stored(w, documentId))),
    /^RECOVERY_REQUIRED/,
  );
});

test("a run's end is kept once, at its first terminal state", async () => {
  const w = await workspace();
  let now = 100;
  let state: "running" | "failed" = "running";
  const ledger = memoryLedger();
  const service = createGenerationService({
    adapter: {
      submit: async () => ({ executionRef: "r" }),
      status: async () => ({ executionRef: "r", state }),
      enumerateArtifacts: async () => [],
    } as unknown as EngineAdapterV2,
    store: w.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
    now: () => now,
  });
  const { generationId } = await service.start({
    projectId: w.projectId,
    recipe: {
      id: "t",
      hash: "a".repeat(64),
      operation: "textToVideo",
      modelManifestHash: "b".repeat(64),
    },
    prompt: "go",
    width: 64,
    height: 36,
    durationFrames: 24,
  });
  now = 200;
  await service.status(generationId);
  assert.equal(service.row(generationId)?.endedAt, undefined);
  state = "failed";
  now = 300;
  await service.status(generationId);
  now = 400;
  await service.status(generationId);
  assert.equal(service.row(generationId)?.endedAt, 300);
});

test("a story's text is bounded, and an empty part is left out", () => {
  const base = parseStory({ ...story([]), formatVersion: 2 });
  const withText = {
    ...base,
    brief: { logline: "A kite.", languages: ["ar", "en-GB"] },
    scenes: [
      {
        ...base.scenes[0]!,
        sceneText: "سطر",
        shots: [
          {
            ...base.scenes[0]!.shots[0]!,
            intent: { action: "rises", direction: { lens: "wide" } },
          },
        ],
      },
    ],
  };
  // 7 + 2 + 5, 6 in Arabic, and 5 + 4.
  assert.equal(storyTextBytes(parseStory(withText)), 29);
  for (const bad of [
    { ...base, brief: {} },
    { ...base, brief: { logline: "" } },
    { ...base, brief: { languages: ["en", "EN"] } },
    { ...base, formatVersion: 1, brief: { logline: "x" } },
  ])
    assert.throws(() => parseStory(bad));
  const scenes = Array.from({ length: 25 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    name: "S",
    shots: [],
    sceneText: "x".repeat(4000),
  }));
  assert.throws(
    () =>
      validateDocument(
        "story",
        2,
        Buffer.from(JSON.stringify({ ...base, scenes })),
      ),
    /hold 100000 bytes of text; the limit is 98304/,
  );
});

test("a story at its limits stays inside documentBytes with record hashes", () => {
  const uid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  // Shots of 8 takes, each with a typical lineage and a record.
  const made = (shots: number, record: boolean) => {
    let n = 0;
    const scenes = [];
    for (let left = shots; left > 0; left -= 100)
      scenes.push({
        id: uid(n++),
        name: "Scene",
        shots: Array.from({ length: Math.min(100, left) }, () => ({
          id: uid(n++),
          name: "Shot",
          durationTicks: 30 * FRAME,
          notes: "",
          referencePacks: [],
          takes: Array.from({ length: STORY_LIMITS.takesPerShot }, () => ({
            id: uid(n++),
            assetId: uid(9_999),
            sourceStartTicks: 0,
            lineage: {
              label: "seed 7, steps 30, Wan-AI/Wan2.2-TI2V-5B-Diffusers",
              outputHash: "a".repeat(64),
              inputs: [],
            },
            ...(record ? { recordHash: "b".repeat(64) } : {}),
          })),
          selectedTakeId: null,
        })),
      });
    return Buffer.byteLength(
      canonicalJson(
        parseStory({
          format: "yamakan.story",
          formatVersion: 2,
          title: "Full",
          scenes,
        }),
      ),
    );
  };
  const most = (record: boolean) => {
    let shots = 1;
    while (
      shots < STORY_LIMITS.shots &&
      made(shots + 1, record) <= STORY_LIMITS.documentBytes
    )
      shots++;
    return shots;
  };
  // A record hash is this many bytes of a take.
  assert.equal((made(10, true) - made(10, false)) / 80, 80);
  console.log(
    `shots of 8 takes that fit in ${STORY_LIMITS.documentBytes} bytes: ${most(false)} without record hashes, ${most(true)} with`,
  );
  assert.ok(made(most(true), true) <= STORY_LIMITS.documentBytes);
  assert.ok(most(true) >= 75);
});

test("every query of the versions table names the kind it reads, or inserts", async () => {
  let queries = 0;
  for (const file of ["store", "continuity", "recovery"]) {
    const source = await readFile(
      new URL(`../core/${file}.ts`, import.meta.url),
      "utf8",
    );
    for (const [query] of source.matchAll(
      /SELECT[^"`]*\bstory_document_versions\b[^"`]*/g,
    ))
      assert.match(query, /\bkind\b/, `${++queries}: ${query}`);
  }
  assert.ok(queries >= 6);
});

test("a record's hash is its canonical JSON's, whatever the key order", () => {
  const record = buildDeclaredRecord(
    { model: "m", prompt: "p", seed: 1 },
    "a".repeat(64),
    [{ assetId: id(), assetHash: "b".repeat(64) }],
  );
  assert.equal(record.operation, "imageToVideo");
  const shuffled = Object.fromEntries(
    Object.entries(record).reverse(),
  ) as TakeRecord;
  assert.equal(recordHashOf(shuffled), recordHashOf(record));
  for (const bad of [
    { ...record, origin: "generation" },
    { ...record, route: "kaggle" },
    { ...record, source: { generationId: id() } },
    { ...record, derivedFromRecordHash: "c".repeat(64) },
    { ...record, changedFields: ["seed", "seed"] },
    { ...record, revisionNote: "why" },
    { ...record, revisionNote: "", derivedFromTakeId: id() },
    {
      ...record,
      revisionNote: "x".repeat(501),
      derivedFromTakeId: id(),
    },
    { ...record, reported: { model: null, seed: 1, runtime: null } },
    { ...record, extra: 1 },
  ])
    assert.equal(TakeRecordSchema.safeParse(bad).success, false);
});

test("a record is read only for the project and story that hold it", async () => {
  const w = await workspace();
  const asset = await video(w, "held");
  const row = run(w, asset);
  const documentId = id();
  const t = take(asset);
  const { records } = await save(w, documentId, story([t]), {
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const hash = records[0]!.recordHash;
  assert.equal(
    w.store.takeRecord(w.projectId, documentId, hash).output.sha256,
    asset.hash,
  );
  const other = (
    await execute(w.ctx, "yamakan.project.create", { name: "Other" })
  ).result as Project;
  for (const [project, document] of [
    [w.projectId, id()],
    [other.id, documentId],
  ] as const)
    assert.equal(
      await reason((async () => w.store.takeRecord(project, document, hash))()),
      "NOT_FOUND: The take has no generation record.",
    );
  // The shared verifier refuses one not held, for the commands that read a story.
  const body = stored(w, documentId);
  const project = await w.store.load(w.projectId);
  const context = (held: boolean, attached?: Set<string>) => ({
    db: null as never,
    project,
    documents: [],
    held: () => held,
    attached,
    nowMs: 0,
  });
  verifyStory(body, context(true), documentId);
  verifyStory(body, context(false, new Set([hash])), documentId);
  assert.throws(
    () => verifyStory(body, context(false), documentId),
    /written by the service/,
  );
  // A copy of the story under another id keeps no record.
  assert.equal(
    await reason(save(w, id(), { ...body, title: "Copy" })),
    "VALIDATION: A take's generation record is written by the service.",
  );
});

test("a record is never a project document, staged, or written but with a story", async () => {
  const w = await workspace();
  assert.equal(
    DocumentRefSchema.safeParse({
      id: id(),
      kind: "takeRecord",
      schemaVersion: 1,
      contentHash: "a".repeat(64),
    }).success,
    false,
  );
  const record = buildDeclaredRecord(
    { model: "m", prompt: "p", seed: 1 },
    "a".repeat(64),
    [],
  );
  const bytes = Buffer.from(canonicalJson(record), "utf8");
  const commit = (over: object) =>
    reason(
      (async () =>
        w.store.commitDocument({
          projectId: w.projectId,
          expectedRevision: (await w.store.load(w.projectId)).revision,
          documentId: id(),
          kind: "takeRecord",
          schemaVersion: 1,
          expectedContentHash: null,
          source: { bytes },
          verify: () => {},
          ...over,
        } as Parameters<typeof w.store.commitDocument>[0]))(),
    );
  assert.equal(
    await commit({}),
    "VALIDATION: A take record is saved with its take.",
  );
  const scene = {
    kind: "story",
    schemaVersion: 2,
    source: { bytes: Buffer.from(JSON.stringify(story([]))) },
  };
  assert.equal(await commit({ ...scene, attachments: [record] }), "ok");
  assert.equal(
    await commit({ ...scene, attachments: Array(9).fill(record) }),
    "VALIDATION: Only a story's save writes take records, a few at a time.",
  );
  assert.equal(
    await commit({
      kind: "referencePack",
      source: {
        bytes: Buffer.from(
          JSON.stringify({
            format: "yamakan.reference-pack",
            formatVersion: 1,
            name: "P",
            entries: [],
          }),
        ),
      },
      attachments: [record],
    }),
    "VALIDATION: Only a story's save writes take records, a few at a time.",
  );
  assert.match(
    await reason(
      (async () =>
        w.store.reserveDocumentUpload({
          projectId: w.projectId,
          principalId: "browser-ui",
          requestId: id(),
          kind: "takeRecord",
          schemaVersion: 1,
          declaredBytes: bytes.length,
          bodySha256: "a".repeat(64),
        }))(),
    ),
    /^VALIDATION: Stories, take records/,
  );
  // A story over another kind of document is refused as that.
  const packId = id();
  await execute(w.ctx, "yamakan.pack.save", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId: packId,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "P",
      entries: [],
    },
  });
  assert.equal(
    await reason(save(w, packId, story([]))),
    "VALIDATION: A document keeps its kind.",
  );
});

test("a retry replays what its request committed, whatever has changed since", async () => {
  const w = await workspace();
  const before = (await w.store.load(w.projectId)).revision;
  const asset = await video(w, "retried");
  const t = take(asset);
  const documentId = id();
  const ledger = memoryLedger();
  const row = run(w, asset, { generationId: id() });
  ledger.begin(row);
  const service = createGenerationService({
    adapter: {} as EngineAdapterV2,
    store: w.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
  });
  const request = async (from: object) => ({
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId,
    expectedContentHash: null,
    story: story([t]),
    records: [{ takeId: t.id, from }],
  });
  const local = run(w, asset);
  await w.store.transaction((db) =>
    db.prepare("DELETE FROM jobs WHERE job_id = ?").run(local.generationId),
  );
  ledger.begin(local);
  const ctx = {
    ...w.ctx,
    requestId: id(),
    generation: { service, recipes: [] },
  } as CommandContext;
  const sent = await request({ generationId: local.generationId });
  const first = (await execute(ctx, "yamakan.story.save", sent))
    .result as Saved;
  assert.equal(first.records.length, 1);
  // The run in this machine's memory is gone, and so is the media from the head.
  const gone = { ...ctx, generation: undefined } as CommandContext;
  const history = (
    await execute(w.ctx, "yamakan.project.history", { projectId: w.projectId })
  ).result as { headFingerprint: string };
  await execute(w.ctx, "yamakan.project.restore", {
    projectId: w.projectId,
    revision: before,
    expectedHeadFingerprint: history.headFingerprint,
  });
  const again = (await execute(gone, "yamakan.story.save", sent))
    .result as Saved;
  assert.deepEqual(again.records, first.records);
  assert.equal(again.project.revision, first.project.revision);
  assert.deepEqual(again.document, first.document);
  // Another request under the same id is refused, and so is one for another document.
  for (const other of [
    { ...sent, story: { ...sent.story, title: "Other" } },
    { ...sent, documentId: id() },
  ])
    assert.match(
      await reason(execute(gone, "yamakan.story.save", other)),
      /^IDEMPOTENCY_MISMATCH/,
    );
});

test("a declared prompt appears in no row", async () => {
  const w = await workspace();
  const asset = await video(w, "declared");
  const t = take(asset);
  await execute({ ...w.ctx, requestId: id() }, "yamakan.story.save", {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId: id(),
    expectedContentHash: null,
    story: story([t]),
    records: [
      {
        takeId: t.id,
        from: { declared: { model: "m", prompt: PROMPT, seed: 1 } },
      },
    ],
  });
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"), {
    readOnly: true,
  });
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];
  for (const { name } of tables)
    for (const row of db.prepare(`SELECT * FROM ${name}`).all() as object[])
      for (const v of Object.values(row))
        assert.ok(
          !(
            v instanceof Uint8Array ? Buffer.from(v).toString() : String(v)
          ).includes("zq-71-marker"),
          name,
        );
  db.close();
});

test("what a recipe says is recorded only for the model version and script it is of", async () => {
  const [known] = kaggleRecipes();
  assert.deepEqual(kaggleRecipeFacts(known!), {
    route: "kaggle",
    model: { id: wan.model, revision: wan.revision, licence: wan.licence },
    fps: wan.fps,
    steps: wan.steps,
  });
  const older = kaggleRecipeFacts({ ...known!, hash: "a".repeat(64) });
  assert.equal(older?.model?.id, wan.model);
  assert.deepEqual([older?.fps, older?.steps], [null, null]);
  assert.equal(
    kaggleRecipeFacts({ ...known!, modelManifestHash: "a".repeat(64) }),
    null,
  );
  assert.equal(kaggleRecipeFacts({ ...known!, id: "other" }), null);
  // Through the command, a recipe this build does not know is a local engine's.
  const w = await workspace();
  const asset = await video(w, "local");
  const row = run(w, asset, {
    recipe: {
      id: "local-graph",
      hash: "d".repeat(64),
      operation: "textToVideo",
      modelManifestHash: "e".repeat(64),
    },
  });
  const t = take(asset);
  const documentId = id();
  await save(w, documentId, story([t]), {
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const { record } = await read(w, documentId, stored(w, documentId));
  assert.equal(record.route, "comfyui");
  assert.equal(record.model?.id, "local-graph");
});

test("an end is stamped when first known, and an older row gains none", async () => {
  const w = await workspace();
  const asset = await video(w, "ended");
  let now = 0;
  let state: "running" | "succeeded" | "failed" = "running";
  const ledger = memoryLedger();
  const service = createGenerationService({
    adapter: {
      status: async () => ({ executionRef: "r", state }),
      // Each answer takes a while.
      enumerateArtifacts: async () => {
        now += 500;
        return [
          {
            handle: "o.mp4",
            mediaType: "video/mp4",
            byteLength: 10,
            sha256: asset.hash,
          },
        ];
      },
    } as unknown as EngineAdapterV2,
    store: w.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
    now: () => now,
  });
  const begin = (over: Partial<GenerationRecord>) => {
    const row = run(w, asset, {
      endedAt: undefined,
      importedAt: undefined,
      imported: null,
      state: "running",
      ...over,
    });
    ledger.begin(row);
    return row.generationId;
  };
  // The import is what learns of it: known before the video is read.
  state = "succeeded";
  now = 1_000;
  const first = begin({});
  await service.importResult(first);
  assert.equal(service.row(first)?.endedAt, 1_000);
  assert.equal(service.row(first)?.importedAt, 1_500);
  // A row that ended before this field was kept does not gain the import's time.
  const older = begin({ state: "succeeded" });
  await service.importResult(older);
  assert.equal(service.row(older)?.endedAt, undefined);
  assert.equal(typeof service.row(older)?.importedAt, "number");
  // One that seemed ended, went on and ended again keeps the first time.
  const twice = begin({});
  for (const [at, s] of [
    [10_000, "failed"],
    [11_000, "running"],
    [12_000, "failed"],
  ] as const) {
    now = at;
    state = s;
    await service.status(twice);
  }
  assert.equal(service.row(twice)?.endedAt, 10_000);
});

test("a recorded take, and one of a version 1 story, are placed by apply", async () => {
  for (const older of [false, true]) {
    const w = await workspace();
    const [a, b] = [await video(w, "first"), await video(w, "second")];
    const documentId = id();
    const takes = [take(a), take(b)];
    const body = story(takes);
    await save(
      w,
      documentId,
      body,
      older
        ? {}
        : {
            records: takes.map((t) => ({
              takeId: t.id,
              from: { declared: { model: "m", prompt: "p", seed: 1 } },
            })),
          },
    );
    if (older)
      asAnOlderBuildStored(w, documentId, { ...body, formatVersion: 1 });
    const opened = await w.store.load(w.projectId);
    await execute(w.ctx, "yamakan.story.assemble", {
      projectId: w.projectId,
      expectedRevision: opened.revision,
      documentId,
      trackId: opened.tracks.find((t) => t.kind === "video")!.id,
    });
    const proposal = (
      await execute(w.ctx, "yamakan.take.proposeReplace", {
        projectId: w.projectId,
        documentId,
        shotId: body.scenes[0]!.shots[0]!.id,
        takeId: takes[1]!.id,
      })
    ).result as { revision: number };
    const applied = (
      await execute(w.ctx, "yamakan.take.apply", {
        projectId: w.projectId,
        expectedRevision: proposal.revision,
        proposal,
      })
    ).result as Project;
    assert.equal(applied.clips.at(-1)!.assetId, b.id, `older: ${older}`);
  }
});

test("a shot of a version 1 story is planned for a render", async () => {
  const w = await workspace();
  const documentId = id();
  const body = story([]);
  await save(w, documentId, body);
  asAnOlderBuildStored(w, documentId, { ...body, formatVersion: 1 });
  const started = (
    await execute(w.ctx, "yamakan.director.start", {
      projectId: w.projectId,
      pipelineName: "cinema-blender",
    })
  ).result as { id: string };
  const planned = await renderStoryShot(
    w.store,
    {
      submitBlenderRender: async () => ({ id: "job" }),
    } as unknown as JobSupervisor,
    {
      runId: started.id,
      storyDocumentId: documentId,
      shotId: body.scenes[0]!.shots[0]!.id,
      direction: {},
    },
  );
  assert.equal(planned.shot.id, body.scenes[0]!.shots[0]!.id);
});

test("a retry of a save that an older build committed as version 1 replays it", async () => {
  const w = await workspace();
  const documentId = id();
  const two = story([]);
  const one = { ...two, formatVersion: 1 };
  const ctx = { ...w.ctx, requestId: id() };
  const request = {
    projectId: w.projectId,
    expectedRevision: (await w.store.load(w.projectId)).revision,
    documentId,
    expectedContentHash: null,
    story: one,
  };
  const first = (await execute(ctx, "yamakan.story.save", request))
    .result as Saved;
  const old = asAnOlderBuildStored(w, documentId, one);
  // What that build bound its receipt to: the same request, its version and its hash.
  const bound = (schemaVersion: number, contentHash: string) =>
    sha256Hex(
      canonicalJson({
        request: sha256Hex(
          canonicalJson({
            apiVersion: API_VERSION,
            format: SNAPSHOT_FORMAT,
            operation: "yamakan.story.save",
            input: request,
          }),
        ),
        documentId,
        kind: "story",
        schemaVersion,
        expectedContentHash: null,
        contentHash,
        migration: null,
      }),
    );
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  const { request_digest } = db
    .prepare("SELECT request_digest FROM command_receipts WHERE request_id = ?")
    .get(ctx.requestId) as { request_digest: string };
  assert.equal(request_digest, bound(2, first.document.contentHash));
  db.prepare(
    "UPDATE command_receipts SET request_digest = ? WHERE request_id = ?",
  ).run(bound(1, old.hash), ctx.requestId);
  db.close();
  const again = (await execute(ctx, "yamakan.story.save", request))
    .result as Saved;
  assert.equal(again.project.revision, first.project.revision);
  assert.equal(again.document.schemaVersion, 1);
  assert.equal(again.document.contentHash, old.hash);
  assert.deepEqual(again.records, []);
  // Another request under that id still writes nothing.
  assert.match(
    await reason(
      execute(ctx, "yamakan.story.save", {
        ...request,
        story: { ...one, title: "Other" },
      }),
    ),
    /^IDEMPOTENCY_MISMATCH/,
  );
  assert.equal(
    (await w.store.load(w.projectId)).revision,
    first.project.revision,
  );
  // Nor does one whose commit left another kind of document under this id.
  const packId = id();
  const packCtx = { ...w.ctx, requestId: id() };
  await execute(packCtx, "yamakan.pack.save", {
    projectId: w.projectId,
    expectedRevision: first.project.revision,
    documentId: packId,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "P",
      entries: [],
    },
  });
  assert.match(
    await reason(
      execute(packCtx, "yamakan.story.save", {
        ...request,
        documentId: packId,
      }),
    ),
    /^IDEMPOTENCY_MISMATCH/,
  );
});

test("a record holds what the run said of itself, beside what was asked", async () => {
  const w = await workspace();
  const asset = await video(w, "said");
  const said = {
    model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    version: "b8fff7315c768468a5333511427288870b2e9635",
    seed: 8,
    python: "3.13.16",
    torch: "2.11.0+cu130",
    packages: ["diffusers==0.36.0", "transformers==4.57.1"],
  };
  const reported = engineReport(said);
  assert.deepEqual(reported, {
    model: { id: said.model, version: said.version },
    seed: 8,
    runtime: {
      python: said.python,
      torch: said.torch,
      packages: said.packages,
    },
  });
  let kept: typeof reported | null = reported;
  const ledger = memoryLedger();
  const row = run(w, asset, { imported: null, state: "running" });
  ledger.begin(row);
  const service = createGenerationService({
    adapter: {
      status: async () => ({ executionRef: "r", state: "succeeded" }),
      enumerateArtifacts: async () => [
        {
          handle: "o.mp4",
          mediaType: "video/mp4",
          byteLength: 10,
          sha256: asset.hash,
        },
      ],
      // Once only, as an engine that is started again forgets it.
      reported: () => {
        const once = kept;
        kept = null;
        return once;
      },
    } as unknown as EngineAdapterV2,
    store: w.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
  });
  await service.status(row.generationId);
  assert.deepEqual(service.row(row.generationId)?.reported, reported);
  await service.importResult(row.generationId);
  const ctx = {
    ...w.ctx,
    generation: { service, recipes: [] },
  } as CommandContext;
  const t = take(asset);
  const documentId = id();
  await save({ ...w, ctx }, documentId, story([t]), {
    records: [{ takeId: t.id, from: { generationId: row.generationId } }],
  });
  const { record } = await read(w, documentId, stored(w, documentId));
  assert.deepEqual(record.reported, reported);
  // Asked for 7, it said 8: both are there.
  assert.equal(record.request.kind === "generation" && record.request.seed, 7);
  assert.equal(record.revisionNote, null);
  // A run that said nothing, as one recorded before this did.
  const silent = buildGenerationRecord(run(w, asset), {
    route: "comfyui",
    model: null,
    fps: null,
    steps: null,
  });
  assert.equal(silent.reported, null);
});

test("what an import is the first to learn of a run is kept too", async () => {
  const w = await workspace();
  const asset = await video(w, "direct");
  const ledger = memoryLedger();
  const row = run(w, asset, { imported: null, state: "running" });
  ledger.begin(row);
  const reported = engineReport({ seed: 4 });
  const service = createGenerationService({
    adapter: {
      status: async () => ({ executionRef: "r", state: "succeeded" }),
      enumerateArtifacts: async () => [
        {
          handle: "o.mp4",
          mediaType: "video/mp4",
          byteLength: 10,
          sha256: asset.hash,
        },
      ],
      reported: () => reported,
    } as unknown as EngineAdapterV2,
    store: w.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
  });
  await service.importResult(row.generationId);
  assert.deepEqual(service.row(row.generationId)?.reported, {
    model: null,
    seed: 4,
    runtime: null,
  });
});

test("a run's word is taken only where it has the form of such a name", () => {
  const none = { model: null, seed: null, runtime: null };
  const runtime = { python: null, torch: null, packages: null };
  for (const said of [
    {},
    { model: "C:\\Users\\someone\\model" },
    { model: "/home/someone/model" },
    { model: "Users/someone/model" },
    { model: "a/../b" },
    { model: "a..b" },
    { model: "someone@example.com" },
    { model: "https://example.com/x" },
    { model: "a/b\nc" },
    { model: "two words" },
    { model: "m".repeat(201) },
    { model: 5, seed: "7", packages: "x" },
    { seed: -1 },
    { seed: 1.5 },
    { packages: Array(33).fill("a==1") },
    { packages: ["a==1", "b @ /home/someone/b"] },
    { packages: ["a".repeat(81)] },
    { packages: [5] },
    { python: "a b" },
    { python: "1".repeat(81) },
    { torch: "../x" },
    { version: "only a version" },
  ])
    assert.equal(engineReport(said), null, JSON.stringify(said));
  for (const [said, expected] of [
    [
      { model: "m".repeat(200), seed: 0 },
      { ...none, model: { id: "m".repeat(200), version: null }, seed: 0 },
    ],
    [
      { model: "a/b", version: "not a version" },
      { ...none, model: { id: "a/b", version: null } },
    ],
    [
      { model: "a/b", version: "1".repeat(81) },
      { ...none, model: { id: "a/b", version: null } },
    ],
    // Each part alone: an odd package leaves Python and torch known.
    [
      { packages: ["./x"], python: "3.13.16", torch: "2.11.0+cu130" },
      {
        ...none,
        runtime: { ...runtime, python: "3.13.16", torch: "2.11.0+cu130" },
      },
    ],
    [
      { packages: ["imageio[ffmpeg]==2.37.0", "ftfy>=6", "accelerate"] },
      {
        ...none,
        runtime: {
          ...runtime,
          packages: ["imageio[ffmpeg]==2.37.0", "ftfy>=6", "accelerate"],
        },
      },
    ],
  ] as const)
    assert.deepEqual(engineReport(said), expected, JSON.stringify(said));
  // What the real scripts pin has this form.
  for (const r of KAGGLE_RECIPES) {
    const script = readFileSync(
      new URL(`../scripts/kaggle/${r.folder}/run.py`, import.meta.url),
      "utf8",
    );
    const packages = [
      ...script
        .slice(script.indexOf("PACKAGES = ["))
        .split("]")[0]!
        .matchAll(/"([^"]+)"/g),
    ].map((m) => m[1]!);
    assert.ok(packages.length > 3);
    assert.deepEqual(
      engineReport({ model: r.model, version: r.revision, packages }),
      {
        model: { id: r.model, version: r.revision },
        seed: null,
        runtime: { ...runtime, packages },
      },
    );
  }
});
