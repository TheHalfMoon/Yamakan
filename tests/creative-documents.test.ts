import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore, WORKSPACE_SCHEMA_VERSION } from "../core/store.ts";
import type { FaultPoint } from "../core/store.ts";
import {
  CREATIVE_DOCUMENTS_ENABLED,
  DOCUMENT_LIMITS,
  validateDocument,
} from "../core/documents.ts";
import {
  fromEditView,
  parseCanonical,
  serializeCanonical,
} from "../core/canonical.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { sha256Hex } from "../core/hash/canonical.ts";
import { CommandError } from "../core/command/errors.ts";

const ffmpeg =
  process.env.YAMAKAN_FFMPEG || process.env.DARZAIN_FFMPEG || "ffmpeg";
const bases: string[] = [];
const handles: { close(): void }[] = [];
after(() => {
  for (const handle of handles.reverse()) handle.close();
  return Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

async function workspace(options?: { fault?: (p: FaultPoint) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-docs-"));
  bases.push(root);
  const store = new ProjectStore(root, options);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Documents");
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  handles.push({ close: () => db.isOpen && db.close() });
  return { root, store, project, db };
}

const bytes = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8");
const studio = (name = "Board") =>
  createEmptyStudioDocument({ id: randomUUID(), name, width: 64, height: 64 });
const scene = (assetId: string | null) => ({
  format: "yamakan.scene3d",
  formatVersion: 1,
  id: randomUUID(),
  units: "metres",
  eulerOrder: "XYZ",
  camera: { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 },
  items: [
    {
      id: randomUUID(),
      name: "card",
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      assetId,
    },
  ],
});
const refused = async (p: Promise<unknown>, code: string, pattern?: RegExp) =>
  assert.rejects(
    p,
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === code &&
      (!pattern || pattern.test(e.message)),
  );
const headBytes = (db: DatabaseSync, projectId: string) =>
  JSON.parse(
    Buffer.from(
      (
        db
          .prepare(
            "SELECT s.bytes FROM snapshots s JOIN projects p ON p.snapshot_hash = s.hash WHERE p.project_id = ?",
          )
          .get(projectId) as { bytes: Uint8Array }
      ).bytes,
    ).toString("utf8"),
  );

async function png(dir: string, color: string) {
  const file = path.join(dir, `${color}.png`);
  execFileSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      `color=${color}:s=16x16`,
      "-frames:v",
      "1",
      file,
    ],
    { windowsHide: true },
  );
  return readFile(file);
}

test("AG-DOCS is on and the workspace schema adds document tables", async () => {
  assert.equal(CREATIVE_DOCUMENTS_ENABLED, true);
  assert.equal(WORKSPACE_SCHEMA_VERSION, 14);
  const { db } = await workspace();
  const tables = (
    db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all() as {
      name: string;
    }[]
  ).map((t) => t.name);
  assert.ok(tables.includes("creative_documents"));
  assert.ok(tables.includes("snapshot_document_refs"));
});

test("a project without documents is still stored as version 4, byte for byte", async () => {
  const { store, project, db } = await workspace();
  const stored = headBytes(db, project.id);
  assert.equal(stored.formatVersion, 4);
  assert.ok(!("documents" in stored));
  const canonical = parseCanonical(stored);
  assert.deepEqual(canonical.documents, []);
  assert.deepEqual(JSON.parse(serializeCanonical(canonical)), stored);
  assert.deepEqual(await store.exportProject(project.id), stored);
});

test("committing a Studio document writes a v5 revision that references its canonical bytes", async () => {
  const { store, project, db } = await workspace();
  const doc = studio();
  const documentId = randomUUID();
  const next = await store.commitDocument({
    projectId: project.id,
    expectedRevision: 0,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes: bytes(doc) },
  });
  assert.equal(next.revision, 1);
  const stored = headBytes(db, project.id);
  assert.equal(stored.formatVersion, 5);
  assert.equal(stored.documents.length, 1);
  const [ref] = store.listDocuments(project.id);
  assert.equal(ref!.id, documentId);
  const got = store.getDocument(project.id, documentId);
  assert.equal(sha256Hex(got.bytes), ref!.contentHash);
  assert.deepEqual(JSON.parse(got.bytes.toString("utf8")), doc);
  // The snapshot's reference row names the document.
  const refs = db
    .prepare(
      "SELECT d.document_hash FROM snapshot_document_refs d JOIN projects p ON p.snapshot_hash = d.snapshot_hash WHERE p.project_id = ?",
    )
    .all(project.id) as { document_hash: string }[];
  assert.deepEqual(
    refs.map((r) => r.document_hash),
    [ref!.contentHash],
  );
});

async function withDocument() {
  const ws = await workspace();
  const documentId = randomUUID();
  await ws.store.commitDocument({
    projectId: ws.project.id,
    expectedRevision: 0,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes: bytes(studio()) },
  });
  const [ref] = ws.store.listDocuments(ws.project.id);
  return { ...ws, documentId, ref: ref! };
}

test("an old client's whole-project save keeps every document reference", async () => {
  const { store, project, ref } = await withDocument();
  const view = await store.load(project.id);
  // A pre-v5 client knows nothing about documents and saves the edit view.
  const saved = await store.save({ ...view, name: "Renamed" }, 1);
  assert.equal(saved.name, "Renamed");
  assert.deepEqual(store.listDocuments(project.id), [ref]);
});

test("timeline batches, undo and redo keep document references", async () => {
  const { store, project, ref } = await withDocument();
  const sceneId = randomUUID();
  const added = await store.applyOperations(
    project.id,
    1,
    [{ type: "scene.add", sceneId, name: "Opening" }],
    "local-client",
  );
  assert.ok(added.scenes.some((s) => s.id === sceneId));
  assert.deepEqual(store.listDocuments(project.id), [ref]);
  await store.undo(project.id, 2, "local-client");
  assert.deepEqual(store.listDocuments(project.id), [ref]);
  await store.redo(project.id, 3, "local-client");
  assert.deepEqual(store.listDocuments(project.id), [ref]);
});

test("two writers of one document: one commits, the other conflicts", async () => {
  const { store, project, documentId, ref } = await withDocument();
  const write = (name: string, expectedRevision: number) =>
    store.commitDocument({
      projectId: project.id,
      expectedRevision,
      documentId,
      kind: "studio",
      schemaVersion: 1,
      expectedContentHash: ref.contentHash,
      source: { bytes: bytes(studio(name)) },
    });
  const results = await Promise.allSettled([write("A", 1), write("B", 1)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failed = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal((failed.reason as CommandError).code, "REVISION_CONFLICT");
  // A writer that caught up on the revision but not the document still loses.
  await refused(write("C", 2), "REVISION_CONFLICT", /document changed/);
});

test("a retried commit returns its original revision; a reused request id with other input fails", async () => {
  const { store, project } = await workspace();
  const receipt = (digest: string) => ({
    principalId: "local-client",
    requestId: "doc-1",
    digest,
  });
  const input = {
    projectId: project.id,
    expectedRevision: 0,
    documentId: randomUUID(),
    kind: "studio" as const,
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes: bytes(studio()) },
  };
  const first = await store.commitDocument(input, receipt("a".repeat(64)));
  const replay = await store.commitDocument(input, receipt("a".repeat(64)));
  assert.deepEqual(replay, first);
  assert.equal(store.listDocuments(project.id).length, 1);
  await refused(
    store.commitDocument(input, receipt("b".repeat(64))),
    "IDEMPOTENCY_MISMATCH",
  );
  // The same request id and caller digest with other bytes is not a replay.
  await refused(
    store.commitDocument(
      { ...input, source: { bytes: bytes(studio("Other")) } },
      receipt("a".repeat(64)),
    ),
    "IDEMPOTENCY_MISMATCH",
  );
});

test("reverting to an earlier document version is a new revision; another project's version is refused", async () => {
  const { store, project, documentId, ref } = await withDocument();
  await store.commitDocument({
    projectId: project.id,
    expectedRevision: 1,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: ref.contentHash,
    source: { bytes: bytes(studio("Edited")) },
  });
  const edited = store.listDocuments(project.id)[0]!;
  assert.notEqual(edited.contentHash, ref.contentHash);
  const reverted = await store.commitDocument({
    projectId: project.id,
    expectedRevision: 2,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: edited.contentHash,
    source: { contentHash: ref.contentHash },
  });
  assert.equal(reverted.revision, 3);
  assert.deepEqual(store.listDocuments(project.id), [ref]);

  const other = await store.create("Other");
  await refused(
    store.commitDocument({
      projectId: other.id,
      expectedRevision: 0,
      documentId: randomUUID(),
      kind: "studio",
      schemaVersion: 1,
      expectedContentHash: null,
      source: { contentHash: ref.contentHash },
    }),
    "NOT_FOUND",
  );
  assert.deepEqual(store.listDocuments(other.id), []);
});

test("restoring an earlier revision restores that revision's documents", async () => {
  const { store, project, documentId, ref } = await withDocument();
  await store.commitDocument({
    projectId: project.id,
    expectedRevision: 1,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: ref.contentHash,
    source: { bytes: bytes(studio("Later")) },
  });
  const history = await store.history(project.id);
  await store.restore(project.id, 1, history.headFingerprint);
  assert.deepEqual(store.listDocuments(project.id), [ref]);
  await store.restore(
    project.id,
    0,
    (await store.history(project.id)).headFingerprint,
  );
  assert.deepEqual(store.listDocuments(project.id), []);
});

test("a Cinema scene keeps the assets it uses in the project", async () => {
  const { root, store, project } = await workspace();
  const image = await store.importAsset(
    project.id,
    "card.png",
    await png(root, "red"),
  );
  const imageId =
    (image as { id?: string }).id ??
    (await store.load(project.id)).assets[0]!.id;
  await refused(
    store.commitDocument({
      projectId: project.id,
      expectedRevision: (await store.load(project.id)).revision,
      documentId: randomUUID(),
      kind: "cinemaScene",
      schemaVersion: 1,
      expectedContentHash: null,
      source: { bytes: bytes(scene(randomUUID())) },
    }),
    "VALIDATION",
    /uses an asset this revision would not hold/,
  );
  const current = await store.load(project.id);
  await store.commitDocument({
    projectId: project.id,
    expectedRevision: current.revision,
    documentId: randomUUID(),
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes: bytes(scene(imageId)) },
  });
  assert.equal(store.listDocuments(project.id).length, 1);
});

test("a Studio bitmap must be an image asset the project holds", async () => {
  const { store, project } = await workspace();
  const doc = { ...studio(), bitmapAssetIds: [randomUUID()] };
  await refused(
    store.commitDocument({
      projectId: project.id,
      expectedRevision: 0,
      documentId: randomUUID(),
      kind: "studio",
      schemaVersion: 1,
      expectedContentHash: null,
      source: { bytes: bytes(doc) },
    }),
    "VALIDATION",
  );
  assert.deepEqual(store.listDocuments(project.id), []);
});

test("hostile document bytes are refused before or during parsing", () => {
  const ok = bytes(studio());
  assert.ok(validateDocument("studio", 1, ok).hash);
  const expect = (fn: () => unknown, code: string) =>
    assert.throws(
      fn,
      (e: unknown) => e instanceof CommandError && e.code === code,
    );
  expect(() => validateDocument("studio", 2, ok), "VALIDATION");
  expect(
    () =>
      validateDocument(
        "studio",
        1,
        Buffer.alloc(DOCUMENT_LIMITS.documentBytes + 1, 0x20),
      ),
    "LIMIT_EXCEEDED",
  );
  expect(
    () => validateDocument("studio", 1, Buffer.from([0x7b, 0xff, 0x7d])),
    "VALIDATION",
  );
  expect(
    () =>
      validateDocument(
        "studio",
        1,
        Buffer.from("[".repeat(65) + "]".repeat(65)),
      ),
    "LIMIT_EXCEEDED",
  );
  expect(
    () =>
      validateDocument(
        "studio",
        1,
        bytes(Array.from({ length: DOCUMENT_LIMITS.nodes + 1 }, () => 0)),
      ),
    "LIMIT_EXCEEDED",
  );
  expect(
    () =>
      validateDocument(
        "studio",
        1,
        Buffer.from('{"__proto__":{"polluted":true}}'),
      ),
    "VALIDATION",
  );
  // A canvas nested past the depth limit inside the canvas JSON text.
  const deepCanvas = {
    ...studio(),
    canvasJson: JSON.stringify({
      version: 3,
      deep: JSON.parse("[".repeat(70) + "]".repeat(70)),
    }),
  };
  expect(
    () => validateDocument("studio", 1, bytes(deepCanvas)),
    "LIMIT_EXCEEDED",
  );
  // Unicode escapes that expand: raw bytes are bounded, and so is the result.
  assert.ok(
    validateDocument(
      "studio",
      1,
      Buffer.from(JSON.stringify({ ...studio(), name: "é".repeat(100) })),
    ).hash,
  );
});

test("a crash before commit leaves no reference; after commit the document is durable", async () => {
  for (const point of ["before-commit", "after-commit"] as const) {
    let armed = false;
    const { store, project, root } = await workspace({
      fault: (p) => {
        if (armed && p === point) throw new Error(`fault ${p}`);
      },
    });
    armed = true;
    await assert.rejects(
      store.commitDocument({
        projectId: project.id,
        expectedRevision: 0,
        documentId: randomUUID(),
        kind: "studio",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { bytes: bytes(studio()) },
      }),
      /fault/,
    );
    armed = false;
    store.close();
    const reopened = new ProjectStore(root);
    handles.push(reopened);
    await reopened.initialize();
    assert.equal(
      reopened.listDocuments(project.id).length,
      point === "after-commit" ? 1 : 0,
      point,
    );
  }
});

test("v4 documents are refused, and migrated history may not carry documents", async () => {
  const { store, project } = await workspace();
  const view = await store.load(project.id);
  const ref = {
    id: randomUUID(),
    kind: "studio" as const,
    schemaVersion: 1,
    contentHash: "c".repeat(64),
  };
  const v5 = fromEditView(view, "en", [ref]);
  assert.equal(JSON.parse(serializeCanonical(v5)).formatVersion, 5);
  assert.throws(() =>
    parseCanonical({ ...JSON.parse(serializeCanonical(v5)), formatVersion: 4 }),
  );
  assert.throws(
    () => store.importHistory(randomUUID(), [{ ...v5, id: randomUUID() }]),
    (e: unknown) => e instanceof Error,
  );
});

test("document reads go through the shared registry path", async () => {
  const { store, project, documentId, ref } = await withDocument();
  const { execute } = await import("../core/command/registry.ts");
  const ctx = {
    store,
    queue: {},
    principal: { id: "local-client", scopes: new Set(["project:read"]) },
  } as never;
  const listed = await execute(ctx, "yamakan.document.list", {
    projectId: project.id,
  });
  assert.deepEqual(listed.result, [ref]);
  const got = await execute(ctx, "yamakan.document.get", {
    projectId: project.id,
    documentId,
  });
  assert.equal(
    (got.result as { contentHash: string }).contentHash,
    ref.contentHash,
  );
  await refused(
    execute(ctx, "yamakan.document.get", {
      projectId: project.id,
      documentId: randomUUID(),
    }),
    "NOT_FOUND",
  );
});
