import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { canvasBitmapDigests, validateDocument } from "../core/documents.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { CommandError } from "../core/command/errors.ts";

const bases: string[] = [];
const handles: { close(): void }[] = [];
after(() => {
  for (const handle of handles.reverse()) handle.close();
  return Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-studio-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Studio");
  return { root, store, project };
}

// A real, minimal RGBA PNG (deterministic for a given size and colour).
function png(width: number, height: number, rgba = [200, 30, 30, 255]) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) Buffer.from(rgba).copy(row, 1 + x * 4);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const stream = async function* (bytes: Buffer) {
  // Arrives in pieces, as from a socket.
  for (let i = 0; i < bytes.length; i += 7) yield bytes.subarray(i, i + 7);
};
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const refused = (p: Promise<unknown>, code: string, pattern?: RegExp) =>
  assert.rejects(
    p,
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === code &&
      (!pattern || pattern.test(e.message)),
  );

// A Studio document whose canvas names the given bitmaps by digest.
function studioWith(digests: string[], name = "Board") {
  const doc = createEmptyStudioDocument({ id: randomUUID(), name });
  const canvas = JSON.parse(doc.canvasJson);
  canvas.document.stacks.raster = digests.map((digest) => ({
    id: randomUUID(),
    type: "raster_layer",
    objects: [
      { id: randomUUID(), type: "image", image: { imageName: digest } },
    ],
  }));
  doc.canvasJson = JSON.stringify(canvas);
  return Buffer.from(JSON.stringify(doc), "utf8");
}
const commitStudio = (
  store: ProjectStore,
  projectId: string,
  bytes: Buffer,
  expectedRevision: number,
  documentId = randomUUID(),
  expectedContentHash: string | null = null,
) =>
  store.commitDocument({
    projectId,
    expectedRevision,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash,
    source: { bytes },
  });

test("a canvas names bitmaps only by digest, never by URL, other name or video", () => {
  const d = "a".repeat(64);
  assert.deepEqual(
    canvasBitmapDigests({ deep: [{ x: { imageName: d } }, { image_name: d }] }),
    [d],
  );
  for (const bad of [
    { imageName: "studio-123" },
    { image: { imageName: "https://example.com/x.png" } },
    { videoName: "clip.mp4" },
  ])
    assert.throws(
      () => canvasBitmapDigests(bad),
      (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
    );
  const validated = validateDocument("studio", 1, studioWith([d, d]));
  assert.deepEqual(validated.objectDigests, [d]);
});

test("a PNG bitmap is stored once, registered, and kept by garbage collection", async () => {
  const { store, project, root } = await workspace();
  const bytes = png(32, 16);
  const first = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  assert.deepEqual(first, {
    digest: sha(bytes),
    byteLength: bytes.length,
    width: 32,
    height: 16,
  });
  const again = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  assert.deepEqual(again, first);
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  handles.push({ close: () => db.isOpen && db.close() });
  assert.equal(
    (
      db.prepare("SELECT count(*) AS n FROM studio_bitmaps").get() as {
        n: number;
      }
    ).n,
    1,
  );
  // Within the grace period an unreferenced bitmap survives collection (a
  // save uploads its bitmaps before committing the document).
  await store.collectGarbage();
  const file = await store.studioBitmapFile(project.id, first.digest);
  assert.equal(sha(await readFile(file)), first.digest);
});

test("garbage collection frees unreferenced Studio bitmaps and keeps those a revision names", async () => {
  const { store, project } = await workspace();
  const kept = png(8, 8, [1, 2, 3, 255]);
  const loose = png(8, 8, [9, 9, 9, 255]);
  const k = await store.importStudioBitmap(
    project.id,
    stream(kept),
    kept.length,
  );
  const l = await store.importStudioBitmap(
    project.id,
    stream(loose),
    loose.length,
  );
  await commitStudio(store, project.id, studioWith([k.digest]), 0);
  const report = await store.collectGarbage({ graceMs: 0 });
  assert.ok(report.objects >= 1);
  await refused(store.studioBitmapFile(project.id, l.digest), "NOT_FOUND");
  assert.equal(
    sha(await readFile(await store.studioBitmapFile(project.id, k.digest))),
    k.digest,
  );
  // A later revision without the document still keeps it: history names it.
  const view = await store.load(project.id);
  await store.save({ ...view, name: "Renamed" }, view.revision);
  await store.collectGarbage({ graceMs: 0 });
  assert.ok(await store.studioBitmapFile(project.id, k.digest));
});

test("a project's Studio bitmap budget is enforced before streaming", async () => {
  const { store, project, root } = await workspace();
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  handles.push({ close: () => db.isOpen && db.close() });
  // Simulate a project whose bitmaps already fill its budget.
  db.prepare(
    "INSERT INTO studio_bitmaps(project_id, digest, byte_length, width, height, created_at) VALUES (?, ?, ?, 1, 1, ?)",
  ).run(project.id, "f".repeat(64), 2 * 1024 * 1024 * 1024, Date.now());
  const bytes = png(4, 4);
  await refused(
    store.importStudioBitmap(project.id, stream(bytes), bytes.length),
    "LIMIT_EXCEEDED",
    /bitmap space is full/,
  );
});

test("bitmap uploads that are not a PNG within Studio limits keep nothing", async () => {
  const { store, project } = await workspace();
  const notPng = Buffer.from("GIF89a" + "x".repeat(40));
  await refused(
    store.importStudioBitmap(project.id, stream(notPng), notPng.length),
    "VALIDATION",
    /PNG/,
  );
  const huge = png(1, 1);
  huge.writeUInt32BE(20_000, 16); // IHDR width beyond the 16,384 px side limit
  await refused(
    store.importStudioBitmap(project.id, stream(huge), huge.length),
    "LIMIT_EXCEEDED",
  );
  const ok = png(4, 4);
  await refused(
    store.importStudioBitmap(project.id, stream(ok), ok.length + 10),
    "VALIDATION",
    /declared length/,
  );
  await refused(
    store.importStudioBitmap(project.id, stream(ok), 64 * 1024 * 1024 + 1),
    "LIMIT_EXCEEDED",
  );
  await refused(store.studioBitmapFile(project.id, sha(ok)), "NOT_FOUND");
});

test("a Studio document commits only with bitmaps its own project holds", async () => {
  const { store, project } = await workspace();
  const other = await store.create("Other");
  const bytes = png(8, 8);
  const { digest } = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  // Unknown digest, and another project's digest, are both refused.
  await refused(
    commitStudio(store, project.id, studioWith(["b".repeat(64)]), 0),
    "VALIDATION",
    /does not hold/,
  );
  await refused(
    commitStudio(store, other.id, studioWith([digest]), 0),
    "VALIDATION",
    /does not hold/,
  );
  await refused(store.studioBitmapFile(other.id, digest), "NOT_FOUND");
  await commitStudio(store, project.id, studioWith([digest]), 0);
  assert.equal(store.listDocuments(project.id).length, 1);
});

test("draw, import, commit and restart yield the exact canvas and bitmap bytes", async () => {
  const { store, project, root } = await workspace();
  const bytes = png(64, 64, [10, 120, 240, 255]);
  const { digest } = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  const doc = studioWith([digest]);
  const documentId = randomUUID();
  await commitStudio(store, project.id, doc, 0, documentId);
  const before = store.getDocument(project.id, documentId);
  store.close();
  const reopened = new ProjectStore(root);
  handles.push(reopened);
  await reopened.initialize();
  const after = reopened.getDocument(project.id, documentId);
  assert.equal(after.ref.contentHash, before.ref.contentHash);
  assert.deepEqual(
    JSON.parse(after.bytes.toString("utf8")),
    JSON.parse(doc.toString("utf8")),
  );
  const file = await reopened.studioBitmapFile(project.id, digest);
  assert.equal(sha(await readFile(file)), digest);
});

test("two windows saving one canvas: one commits, the other conflicts; revert restores the earlier canvas", async () => {
  const { store, project } = await workspace();
  const bytes = png(8, 8);
  const { digest } = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  const documentId = randomUUID();
  await commitStudio(
    store,
    project.id,
    studioWith([digest], "v1"),
    0,
    documentId,
  );
  const v1 = store.listDocuments(project.id)[0]!;
  const save = (name: string) =>
    commitStudio(
      store,
      project.id,
      studioWith([digest], name),
      1,
      documentId,
      v1.contentHash,
    );
  const results = await Promise.allSettled([
    save("window A"),
    save("window B"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason as CommandError
    ).code,
    "REVISION_CONFLICT",
  );
  const v2 = store.listDocuments(project.id)[0]!;
  assert.notEqual(v2.contentHash, v1.contentHash);
  // Durable undo of a saved canvas: a new revision naming the earlier version.
  await store.commitDocument({
    projectId: project.id,
    expectedRevision: 2,
    documentId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: v2.contentHash,
    source: { contentHash: v1.contentHash },
  });
  assert.deepEqual(store.listDocuments(project.id), [v1]);
});

test("a client that dies between bitmap import and document commit leaves no phantom document", async () => {
  const { store, project, root } = await workspace();
  const bytes = png(8, 8);
  await store.importStudioBitmap(project.id, stream(bytes), bytes.length);
  // ...the browser closes here; nothing was committed.
  store.close();
  const reopened = new ProjectStore(root);
  handles.push(reopened);
  await reopened.initialize();
  assert.deepEqual(reopened.listDocuments(project.id), []);
  assert.equal((await reopened.load(project.id)).revision, 0);
});

test("canvas media by URL is refused, while text that looks like a URL is kept", () => {
  const d = "a".repeat(64);
  for (const bad of [
    { image: { imageName: d, url: "https://example.com/x.png" } },
    { reference: { src: "file:///C:/secret.png" } },
    { candidate: { href: "blob:http://127.0.0.1/abc" } },
  ])
    assert.throws(
      () => canvasBitmapDigests(bad),
      (e: unknown) => e instanceof CommandError && /URL/.test(e.message),
    );
  assert.deepEqual(
    canvasBitmapDigests({
      text: { content: "see https://yamakan.example" },
      image: { imageName: d, url: "" },
    }),
    [d],
  );
});

test("the qualification switch never applies in an installed bundle", async () => {
  const { creativeDocumentsEnabled } = await import("../core/documents.ts");
  const saved = { ...process.env };
  try {
    delete process.env.YAMAKAN_AG_DOCS_QUALIFICATION;
    delete process.env.YAMAKAN_BUNDLE_INSTALL;
    assert.equal(creativeDocumentsEnabled(), false);
    process.env.YAMAKAN_AG_DOCS_QUALIFICATION = "1";
    assert.equal(creativeDocumentsEnabled(), true);
    process.env.YAMAKAN_BUNDLE_INSTALL = "C:/Program Files/Yamakan";
    assert.equal(creativeDocumentsEnabled(), false);
  } finally {
    process.env = saved;
  }
});

test("a bitmap collected by garbage collection can be stored again, and never loses its file", async () => {
  const { store, project } = await workspace();
  const bytes = png(6, 6, [5, 6, 7, 255]);
  const later = () => ({ graceMs: 0, now: Date.now() + 1000 });
  const first = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  await store.collectGarbage(later());
  await refused(store.studioBitmapFile(project.id, first.digest), "NOT_FOUND");
  // Collection and a new upload of the same bytes, at once, many times:
  // the bitmap is then either fully present or absent, never a row whose
  // file is gone (RECOVERY_REQUIRED).
  for (let round = 0; round < 10; round++) {
    await Promise.all([
      store.collectGarbage(later()),
      store.importStudioBitmap(project.id, stream(bytes), bytes.length),
    ]);
    try {
      const file = await store.studioBitmapFile(project.id, first.digest);
      assert.equal(sha(await readFile(file)), first.digest);
    } catch (e) {
      assert.equal((e as CommandError).code, "NOT_FOUND", String(e));
    }
  }
  const again = await store.importStudioBitmap(
    project.id,
    stream(bytes),
    bytes.length,
  );
  assert.equal(
    sha(await readFile(await store.studioBitmapFile(project.id, again.digest))),
    first.digest,
  );
});
