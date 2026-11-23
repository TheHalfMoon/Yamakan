// MPR-101: how a take was made, as an immutable record its take names by hash. The service
// writes it with the story, from its own ledger row or a declared receipt; a version 1 story
// reads and saves as version 2. The media here is rows only, so nothing is probed.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { canonicalJson, sha256Hex } from "../core/hash/canonical.ts";
import { DOCUMENT_READ_VERSIONS, validateDocument } from "../core/documents.ts";
import {
  createGenerationService,
  memoryLedger,
  type GenerationRecord,
} from "../core/engines/generation.ts";
import type { EngineAdapterV2 } from "../core/engines/contract-v2.ts";
import { KAGGLE_RECIPES } from "../core/engines/kaggle.ts";
import {
  STORY_LIMITS,
  StoryDocumentV1Schema,
  parseStory,
  storyTextBytes,
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
      hash: "c".repeat(64),
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
  // Removed, changed, its media changed, and one written over it.
  for (const edit of [
    (takes: Take[]) => void delete takes[0]!.recordHash,
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
        script: "سطر",
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
    script: "x".repeat(4000),
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
    { ...record, extra: 1 },
  ])
    assert.equal(TakeRecordSchema.safeParse(bad).success, false);
});
