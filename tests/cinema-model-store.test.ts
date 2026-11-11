// Cinema 3D models (3D asset import): a checked .glb is stored by digest in the project's
// object store, named by a Cinema scene item, kept while a revision names it, and freed when
// nothing does. What is stored is the checked copy, its description re-written.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { CommandError } from "../core/command/errors.ts";
import { SCENE3D_FORMAT, SCENE3D_FORMAT_VERSION } from "../core/scene3d.ts";
import { checkGlb } from "../core/cinema/glb.ts";
import { YamakanClient, YamakanError } from "../sdk/client.ts";
import { uploadCinemaModel } from "../server/document-stage.ts";
import { creativeClosure } from "../core/recovery.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { principals } from "../server/api.ts";

const bases: string[] = [];
const handles: { close(): void }[] = [];
after(() => {
  for (const handle of handles.reverse()) handle.close();
  return Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-models-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Models");
  return { root, store, project };
}

// One triangle as a .glb; `description` replaces the JSON text when given.
function triangle(width = 1, description?: string) {
  const bin = Buffer.alloc(44);
  [0, 0, 0, width, 0, 0, 0, 2, 0].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  [0, 1, 2].forEach((v, i) => bin.writeUInt16LE(v, 36 + i * 2));
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [width, 2, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  };
  const text = Buffer.from(description ?? JSON.stringify(gltf), "utf8");
  const json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(json);
  const header = Buffer.alloc(20);
  const length = 20 + json.length + 8 + bin.length;
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return { bytes: Buffer.concat([header, json, binHeader, bin]), gltf };
}

const stream = async function* (bytes: Buffer) {
  for (let i = 0; i < bytes.length; i += 7) yield bytes.subarray(i, i + 7);
};
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const refused = (p: Promise<unknown>, code: string, pattern?: RegExp) =>
  assert.rejects(
    p,
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === code &&
      (!pattern || pattern.test(e.message)),
  );

// A Cinema scene whose items name the given models.
function sceneWith(models: string[]) {
  return Buffer.from(
    JSON.stringify({
      format: SCENE3D_FORMAT,
      formatVersion: SCENE3D_FORMAT_VERSION,
      id: randomUUID(),
      units: "metres",
      eulerOrder: "XYZ",
      camera: { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 },
      items: models.map((model) => ({
        id: randomUUID(),
        name: "model",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        assetId: null,
        model,
      })),
    }),
    "utf8",
  );
}
const commitScene = (
  store: ProjectStore,
  projectId: string,
  bytes: Buffer,
  expectedRevision: number,
) =>
  store.commitDocument({
    projectId,
    expectedRevision,
    documentId: randomUUID(),
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes },
  });

test("a checked model is stored once, by the digest of its stored bytes, and read back", async () => {
  const { store, project } = await workspace();
  const { bytes } = triangle();
  const first = await store.importCinemaModel(
    project.id,
    stream(bytes),
    bytes.length,
  );
  assert.equal(first.vertices, 3);
  assert.equal(first.triangles, 1);
  assert.deepEqual(
    [first.min, first.max],
    [
      [0, 0, 0],
      [1, 2, 0],
    ],
  );
  const stored = await readFile(
    await store.cinemaModelFile(project.id, first.digest),
  );
  assert.equal(sha(stored), first.digest);
  assert.equal(stored.length, first.byteLength);
  assert.equal(checkGlb(stored).triangles, 1);
  const again = await store.importCinemaModel(
    project.id,
    stream(bytes),
    bytes.length,
  );
  assert.equal(again.digest, first.digest);
});

test("what is stored is the checked copy: the description re-written from what was parsed", async () => {
  const { store, project } = await workspace();
  const { gltf } = triangle();
  // Over-precise numbers and extra spacing are read once and written back plainly.
  const loose = JSON.stringify(gltf, null, 2).replace(
    '"indices": 1',
    '"indices": 1.00000000000000000001',
  );
  const { bytes } = triangle(1, loose);
  const model = await store.importCinemaModel(
    project.id,
    stream(bytes),
    bytes.length,
  );
  const stored = await readFile(
    await store.cinemaModelFile(project.id, model.digest),
  );
  const jsonLength = stored.readUInt32LE(12);
  const text = stored
    .subarray(20, 20 + jsonLength)
    .toString("utf8")
    .trimEnd();
  assert.equal(text, JSON.stringify(gltf));
  // The same model written plainly is the same stored model.
  const plain = triangle().bytes;
  assert.equal(
    (await store.importCinemaModel(project.id, stream(plain), plain.length))
      .digest,
    model.digest,
  );
});

test("files that fail the .glb check, or their declared length, keep nothing", async () => {
  const { store, project } = await workspace();
  const { gltf } = triangle();
  const withUri = triangle(
    1,
    JSON.stringify({
      ...gltf,
      buffers: [{ byteLength: 44, uri: "data:,x" }],
    }),
  ).bytes;
  await refused(
    store.importCinemaModel(project.id, stream(withUri), withUri.length),
    "VALIDATION",
    /another file or a URL/,
  );
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(40).fill(0)]);
  await refused(
    store.importCinemaModel(project.id, stream(png), png.length),
    "VALIDATION",
    /not a \.glb/,
  );
  const ok = triangle().bytes;
  await refused(
    store.importCinemaModel(project.id, stream(ok), ok.length + 10),
    "VALIDATION",
    /declared length/,
  );
  await refused(
    store.importCinemaModel(project.id, stream(ok), ok.length - 4),
    "VALIDATION",
    /longer than its declared length/,
  );
  await refused(
    store.importCinemaModel(project.id, stream(ok), 64 * 1024 * 1024 + 1),
    "LIMIT_EXCEEDED",
  );
  await refused(store.cinemaModelFile(project.id, sha(ok)), "NOT_FOUND");
});

test("a Cinema scene commits only with models its own project holds", async () => {
  const { store, project } = await workspace();
  const other = await store.create("Other");
  const { bytes } = triangle();
  const { digest } = await store.importCinemaModel(
    project.id,
    stream(bytes),
    bytes.length,
  );
  await refused(
    commitScene(store, project.id, sceneWith(["b".repeat(64)]), 0),
    "VALIDATION",
    /3D model this project does not hold/,
  );
  await refused(
    commitScene(store, other.id, sceneWith([digest]), 0),
    "VALIDATION",
    /3D model this project does not hold/,
  );
  await refused(store.cinemaModelFile(other.id, digest), "NOT_FOUND");
  // A model is not a Studio bitmap, and a scene item's model must be a digest.
  await refused(
    commitScene(store, project.id, sceneWith(["not-a-digest"]), 0),
    "VALIDATION",
  );
  await commitScene(store, project.id, sceneWith([digest]), 0);
  assert.equal(store.listDocuments(project.id).length, 1);
});

test("garbage collection frees models nothing names and keeps those a revision names", async () => {
  const { store, project } = await workspace();
  const kept = triangle(1).bytes;
  const loose = triangle(3).bytes;
  const k = await store.importCinemaModel(
    project.id,
    stream(kept),
    kept.length,
  );
  const l = await store.importCinemaModel(
    project.id,
    stream(loose),
    loose.length,
  );
  await commitScene(store, project.id, sceneWith([k.digest]), 0);
  const report = await store.collectGarbage({ graceMs: 0 });
  assert.ok(report.objects >= 1);
  await refused(store.cinemaModelFile(project.id, l.digest), "NOT_FOUND");
  assert.equal(
    sha(await readFile(await store.cinemaModelFile(project.id, k.digest))),
    k.digest,
  );
  // A later revision without the scene still keeps it: history names it.
  const view = await store.load(project.id);
  await store.save({ ...view, name: "Renamed" }, view.revision);
  await store.collectGarbage({ graceMs: 0 });
  assert.ok(await store.cinemaModelFile(project.id, k.digest));
  // A model kept within the grace period is not collected.
  const fresh = await store.importCinemaModel(
    project.id,
    stream(loose),
    loose.length,
  );
  await store.collectGarbage({ graceMs: 60 * 60 * 1000 });
  assert.ok(await store.cinemaModelFile(project.id, fresh.digest));
});

test("a project's model budget is enforced before the upload is read", async () => {
  const { store, project, root } = await workspace();
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  handles.push({ close: () => db.isOpen && db.close() });
  db.prepare(
    "INSERT INTO cinema_models(project_id, digest, byte_length, vertices, triangles, created_at) VALUES (?, ?, ?, 3, 1, ?)",
  ).run(project.id, "f".repeat(64), 2 * 1024 * 1024 * 1024, Date.now());
  const { bytes } = triangle();
  let read = false;
  const watched = async function* () {
    read = true;
    yield bytes;
  };
  await refused(
    store.importCinemaModel(project.id, watched(), bytes.length),
    "LIMIT_EXCEEDED",
    /model space is full/,
  );
  assert.equal(read, false);
});

test("the SDK uploads a model over HTTP; the route takes only model/gltf-binary", async () => {
  const { store, project } = await workspace();
  const server = createServer(async (req, res) => {
    const id = /\/projects\/([^/]+)\//.exec(req.url ?? "")?.[1] ?? "";
    try {
      const model = await uploadCinemaModel(
        store,
        principals["local-client"],
        id,
        req,
        true,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(model));
    } catch (e) {
      const err = e as CommandError;
      res.writeHead(400, {
        "Content-Type": "application/json",
        Connection: "close",
      });
      res.end(
        JSON.stringify({ error: { code: err.code, message: err.message } }),
      );
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  handles.push({ close: () => server.close() });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const client = new YamakanClient({ baseUrl: base });
  const { bytes } = triangle();
  const model = await client.uploadCinemaModel(project.id, bytes);
  assert.equal(model.triangles, 1);
  assert.ok(await store.cinemaModelFile(project.id, model.digest));
  // Another content type is refused before the body is read.
  const wrong = await fetch(
    `${base}/api/v1/projects/${project.id}/cinema/models`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    },
  );
  assert.equal(wrong.status, 400);
  assert.match(
    ((await wrong.json()) as { error: { message: string } }).error.message,
    /model\/gltf-binary/,
  );
  await assert.rejects(
    client.uploadCinemaModel(
      project.id,
      Buffer.from("not a model at all, just forty-odd bytes"),
    ),
    (e: unknown) => e instanceof YamakanError && e.code === "VALIDATION",
  );
});

test("a number the description cannot write back is refused, not stored as null", async () => {
  const { store, project } = await workspace();
  const { gltf } = triangle();
  const text = JSON.stringify(gltf).replace(
    '"max":[1,2,0]',
    '"max":[1e400,2,0]',
  );
  assert.ok(text.includes("1e400"));
  const { bytes } = triangle(1, text);
  await refused(
    store.importCinemaModel(project.id, stream(bytes), bytes.length),
    "VALIDATION",
    /number out of range/,
  );
});

test("a Studio canvas cannot name a model, and a backup counts a scene's model as held", async () => {
  const { store, project, root } = await workspace();
  const { bytes } = triangle();
  const { digest } = await store.importCinemaModel(
    project.id,
    stream(bytes),
    bytes.length,
  );
  const doc = createEmptyStudioDocument({ id: randomUUID(), name: "Board" });
  const canvas = JSON.parse(doc.canvasJson);
  canvas.document.stacks.raster = [
    {
      id: randomUUID(),
      type: "raster_layer",
      objects: [
        { id: randomUUID(), type: "image", image: { imageName: digest } },
      ],
    },
  ];
  doc.canvasJson = JSON.stringify(canvas);
  await refused(
    store.commitDocument({
      projectId: project.id,
      expectedRevision: 0,
      documentId: randomUUID(),
      kind: "studio",
      schemaVersion: 1,
      expectedContentHash: null,
      source: { bytes: Buffer.from(JSON.stringify(doc), "utf8") },
    }),
    "VALIDATION",
    /does not hold/,
  );
  await commitScene(store, project.id, sceneWith([digest]), 0);
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"), {
    readOnly: true,
  });
  try {
    const closure = creativeClosure(db);
    assert.equal(closure.gaps, 0, JSON.stringify(closure.reported));
    assert.ok(closure.objects >= 1);
  } finally {
    db.close();
  }
});

test("model uploads held in memory are bounded per principal and released on every path", async () => {
  const { store, project } = await workspace();
  const { bytes } = triangle();
  // A request whose body has not arrived yet; ended or broken later.
  const pending = () => {
    const body = new PassThrough();
    Object.assign(body, {
      headers: {
        "content-type": "model/gltf-binary",
        "content-length": String(bytes.length),
      },
    });
    return body;
  };
  const upload = (req: PassThrough) =>
    uploadCinemaModel(
      store,
      principals["local-client"],
      project.id,
      req as unknown as IncomingMessage,
      true,
    );
  const a = pending();
  const b = pending();
  const first = upload(a);
  const second = upload(b);
  await refused(upload(pending()), "LIMIT_EXCEEDED", /Too many model uploads/);
  // One fails part-way, the other completes; both slots come back.
  b.destroy(new Error("connection lost"));
  await assert.rejects(second);
  a.end(bytes);
  assert.equal((await first).triangles, 1);
  const c = pending();
  const d = pending();
  const third = upload(c);
  const fourth = upload(d);
  c.end(bytes);
  d.end(bytes);
  assert.equal((await third).digest, (await fourth).digest);
});
