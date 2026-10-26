// YU-014: complete creative backup/restore. A backup proves its creative
// scope (documents, Studio bitmaps, legacy scene and Director files, a
// closed reference graph from its own database copy); a restore verifies all
// of it and fences everything copied from the original (YU-013b).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { CommandError } from "../core/command/errors.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { SCENE3D_FORMAT, SCENE3D_FORMAT_VERSION } from "../core/scene3d.ts";
import {
  backupWorkspace,
  listBackups,
  restoreWorkspace,
  type BackupSource,
} from "../core/recovery.ts";
import {
  grantConsent,
  listEncodings,
  loadRun,
  recordEncoding,
  revokeConsentRecord,
  startDirectorRun,
} from "../core/director/runtime.ts";
import { JobSupervisor } from "../core/jobs.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});

const sha = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
const temp = async (prefix: string) => {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  bases.push(dir);
  return dir;
};
async function open(root: string) {
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  return store;
}
async function refused(p: Promise<unknown>, code: string, message?: RegExp) {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof CommandError, String(e));
    assert.equal(e.code, code, e.message);
    if (message) assert.match(e.message, message);
    return true;
  });
}

// A real, minimal RGBA PNG.
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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) Buffer.from(rgba).copy(row, 1 + x * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(Array(height).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const bitmap = async (
  store: ProjectStore,
  projectId: string,
  rgba: number[],
) => {
  const bytes = png(8, 8, rgba);
  const stored = await store.importStudioBitmap(
    projectId,
    (async function* () {
      yield bytes;
    })(),
    bytes.length,
  );
  return { ...stored, bytes };
};
function studioWith(digests: string[]) {
  const doc = createEmptyStudioDocument({ id: randomUUID(), name: "Board" });
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
const scene = (id: string, focal = 35) =>
  Buffer.from(
    JSON.stringify({
      format: SCENE3D_FORMAT,
      formatVersion: SCENE3D_FORMAT_VERSION,
      id,
      units: "metres",
      eulerOrder: "XYZ",
      camera: { focalLengthMm: focal, sensorWidthMm: 36, near: 0.1, far: 1000 },
      items: [],
    }),
  );
const commit = (
  store: ProjectStore,
  projectId: string,
  expectedRevision: number,
  kind: "studio" | "cinemaScene",
  bytes: Buffer,
  documentId: string = randomUUID(),
  expectedContentHash: string | null = null,
) =>
  store.commitDocument({
    projectId,
    expectedRevision,
    documentId,
    kind,
    schemaVersion: 1,
    expectedContentHash,
    source: { bytes },
  });

// A workspace holding every kind of creative state.
async function creativeWorkspace() {
  const root = await temp("yamakan-creative-");
  const store = await open(root);
  const project = await store.create("Film");
  const red = await bitmap(store, project.id, [200, 30, 30, 255]);
  const blue = await bitmap(store, project.id, [20, 30, 230, 255]);
  const board = studioWith([red.digest, blue.digest]);
  const studioId = randomUUID();
  const one = await commit(
    store,
    project.id,
    project.revision,
    "studio",
    board,
    studioId,
  );
  const sceneId = randomUUID();
  const sceneBytes = scene(sceneId);
  const two = await commit(
    store,
    project.id,
    one.revision,
    "cinemaScene",
    sceneBytes,
    sceneId,
  );
  // Legacy files: an un-migrated Cinema sidecar, a Director record, and a
  // save in progress that is not copied.
  const legacyScene = randomUUID();
  await mkdir(path.join(root, "cinema"), { recursive: true });
  await writeFile(
    path.join(root, "cinema", `${legacyScene}.json`),
    scene(legacyScene, 50),
  );
  await writeFile(
    path.join(root, "cinema", `.${legacyScene}.${randomUUID()}.tmp`),
    "torn",
  );
  await mkdir(path.join(root, "director"), { recursive: true });
  const directorFile = `run-${randomUUID()}.json`;
  await writeFile(path.join(root, "director", directorFile), '{"legacy":true}');
  // Director: a run and a revoked consent with its encoding.
  const run = await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: "framework-smoke",
  });
  const consent = await grantConsent(store, {
    characterId: "hero",
    purpose: "identity-encode",
    version: "v1",
    ttlMs: 3_600_000,
    principalId: "browser-ui",
  });
  await recordEncoding(store, {
    characterId: "hero",
    purpose: "identity-encode",
    consentId: consent.id,
    provider: "local",
    method: "ref",
    payloadHash: sha("face"),
  });
  await revokeConsentRecord(store, consent.id);
  return {
    root,
    store,
    project,
    revision: two.revision,
    red,
    blue,
    studioId,
    board,
    sceneId,
    sceneBytes,
    legacyScene,
    directorFile,
    run,
    consent,
  };
}

test("canvas pixels, scenes, story, run and revoked-consent state survive a verified restore", async () => {
  const w = await creativeWorkspace();
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  assert.equal(backup.format, "yamakan.backup/2");
  assert.equal(backup.creative, "complete");
  assert.equal(backup.legacyFiles, 2, "the save in progress is not copied");
  assert.equal(backup.closureGaps, 0);
  const restored = await restoreWorkspace(
    path.join(home, "backups", backup.backupId),
    path.join(home, "restored-1"),
  );
  assert.equal(restored.creative, "complete");
  assert.equal(restored.legacyRestored, 2);
  assert.deepEqual(restored.legacyQuarantined, []);
  assert.equal(restored.closure.gaps, 0);
  assert.equal(restored.closure.documents, 2);
  // Both bitmaps of the canvas, by every revision that names them.
  assert.equal(restored.closure.objects, 2);
  const copy = await open(restored.root);
  // The story: the same head revision and document references.
  const head = await copy.load(w.project.id);
  assert.equal(head.revision, w.revision);
  assert.deepEqual(
    copy.listDocuments(w.project.id),
    w.store.listDocuments(w.project.id),
  );
  // The canvas and its pixels, byte for byte.
  assert.deepEqual(
    copy.getDocument(w.project.id, w.studioId).bytes,
    w.store.getDocument(w.project.id, w.studioId).bytes,
  );
  for (const b of [w.red, w.blue])
    assert.deepEqual(
      await readFile(await copy.studioBitmapFile(w.project.id, b.digest)),
      b.bytes,
    );
  assert.deepEqual(
    copy.getDocument(w.project.id, w.sceneId).bytes,
    w.store.getDocument(w.project.id, w.sceneId).bytes,
  );
  // Legacy files as found, and no save in progress.
  assert.deepEqual(
    await readFile(path.join(restored.root, "cinema", `${w.legacyScene}.json`)),
    await readFile(path.join(w.root, "cinema", `${w.legacyScene}.json`)),
  );
  assert.deepEqual(await readdir(path.join(restored.root, "cinema")), [
    `${w.legacyScene}.json`,
  ]);
  assert.equal(
    await readFile(
      path.join(restored.root, "director", w.directorFile),
      "utf8",
    ),
    '{"legacy":true}',
  );
  // The run is there; the revocation stays a revocation.
  assert.equal((await loadRun(copy, w.run.id)).id, w.run.id);
  const encodings = await listEncodings(copy);
  assert.equal(encodings.length, 1);
  assert.equal(encodings[0]!.invalidated, true);
  await refused(
    recordEncoding(copy, {
      characterId: "hero",
      purpose: "identity-encode",
      consentId: w.consent.id,
      provider: "local",
      method: "ref",
      payloadHash: sha("again"),
    }),
    "VALIDATION",
  );
});

test("the closure is the backup's own database copy while edits, imports and collection continue", async () => {
  const w = await creativeWorkspace();
  const home = await temp("yamakan-creative-home-");
  let revision = w.revision;
  let expected = w.store
    .listDocuments(w.project.id)
    .find((d) => d.id === w.studioId)!.contentHash;
  const editing = (async () => {
    for (let i = 0; i < 12; i++) {
      const fresh = await bitmap(w.store, w.project.id, [i * 20, 90, 9, 255]);
      const next = await commit(
        w.store,
        w.project.id,
        revision,
        "studio",
        studioWith([fresh.digest]),
        w.studioId,
        expected,
      );
      revision = next.revision;
      expected = w.store
        .listDocuments(w.project.id)
        .find((d) => d.id === w.studioId)!.contentHash;
      await w.store.collectGarbage({ graceMs: 0 });
    }
  })();
  const [backup] = await Promise.all([backupWorkspace(w.store, home), editing]);
  assert.equal(backup.creative, "complete");
  const restored = await restoreWorkspace(
    path.join(home, "backups", backup.backupId),
    path.join(home, "restored-concurrent"),
  );
  assert.equal(restored.creative, "complete");
  assert.equal(restored.closure.gaps, 0);
  // Whatever revision the copy caught, its canvas and every bitmap it
  // names are there.
  const copy = await open(restored.root);
  const doc = copy.getDocument(w.project.id, w.studioId);
  const canvas = JSON.parse(JSON.parse(doc.bytes.toString("utf8")).canvasJson);
  for (const layer of canvas.document.stacks.raster)
    for (const object of layer.objects)
      assert.ok(
        await copy.studioBitmapFile(w.project.id, object.image.imageName),
      );
});

test("a missing bitmap or a corrupt document is recorded, and the restore says incomplete", async () => {
  const w = await creativeWorkspace();
  // The blue bitmap's file is lost; the canvas document is altered in place.
  await unlink(
    path.join(
      w.root,
      "projects",
      w.project.id,
      "objects",
      "sha256",
      w.blue.digest.slice(0, 2),
      w.blue.digest,
    ),
  );
  const hash = w.store
    .listDocuments(w.project.id)
    .find((d) => d.id === w.sceneId)!.contentHash;
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  const row = db
    .prepare("SELECT bytes FROM creative_documents WHERE hash = ?")
    .get(hash) as {
    bytes: Uint8Array;
  };
  const altered = Buffer.from(row.bytes);
  altered[altered.length - 2] ^= 1;
  db.prepare("UPDATE creative_documents SET bytes = ? WHERE hash = ?").run(
    altered,
    hash,
  );
  db.close();
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  assert.equal(backup.creative, "incomplete");
  assert.equal(backup.damaged, 1);
  assert.equal(backup.closureGaps, 1, "the altered scene");
  const listed = (await listBackups(home))[0]!;
  assert.ok(listed.complete && listed.creative === "incomplete");
  const restored = await restoreWorkspace(
    path.join(home, "backups", backup.backupId),
    path.join(home, "restored-damaged"),
  );
  assert.equal(restored.creative, "incomplete");
  assert.deepEqual(
    restored.quarantined.map((q) => q.digest),
    [w.blue.digest],
  );
  assert.deepEqual(
    restored.closure.reported.map((g) => [g.kind, g.ref, g.reason]).sort(),
    [
      ["document", hash, "mismatch"],
      ["object", w.blue.digest, "missing"],
    ].sort(),
  );
  // Nothing unverified is served; what is intact still is.
  const copy = await open(restored.root);
  await refused(
    copy.studioBitmapFile(w.project.id, w.blue.digest),
    "NOT_FOUND",
  );
  assert.deepEqual(
    await readFile(await copy.studioBitmapFile(w.project.id, w.red.digest)),
    w.red.bytes,
  );
  assert.throws(
    () => copy.getDocument(w.project.id, w.sceneId),
    (e: unknown) => e instanceof CommandError && e.code === "RECOVERY_REQUIRED",
  );
});

test("a legacy folder that is a junction is never followed", async () => {
  const w = await creativeWorkspace();
  const elsewhere = await temp("yamakan-elsewhere-");
  const outside = `${randomUUID()}.json`;
  await writeFile(path.join(elsewhere, outside), scene(randomUUID()));
  await rm(path.join(w.root, "cinema"), { recursive: true });
  await symlink(elsewhere, path.join(w.root, "cinema"), "junction");
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  assert.equal(backup.creative, "incomplete");
  assert.equal(backup.legacyFiles, 1, "the Director file only");
  const manifest = JSON.parse(
    await readFile(
      path.join(home, "backups", backup.backupId, "backup.json"),
      "utf8",
    ),
  );
  assert.deepEqual(manifest.legacyDamaged, [
    { path: "cinema", reason: "invalid" },
  ]);
  await assert.rejects(
    readFile(
      path.join(home, "backups", backup.backupId, "legacy", "cinema", outside),
    ),
  );
});

test("an altered legacy file or a manifest naming another path never restores it", async () => {
  const w = await creativeWorkspace();
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  const dir = path.join(home, "backups", backup.backupId);
  await writeFile(
    path.join(dir, "legacy", "cinema", `${w.legacyScene}.json`),
    "changed",
  );
  const restored = await restoreWorkspace(
    dir,
    path.join(home, "restored-altered"),
  );
  assert.equal(restored.creative, "incomplete");
  assert.deepEqual(restored.legacyQuarantined, [
    { path: `cinema/${w.legacyScene}.json`, reason: "mismatch" },
  ]);
  await assert.rejects(
    readFile(path.join(restored.root, "cinema", `${w.legacyScene}.json`)),
  );
  // A manifest whose legacy path escapes its folder is not a backup.
  const manifest = JSON.parse(
    await readFile(path.join(dir, "backup.json"), "utf8"),
  );
  manifest.legacyFiles[0].path = "cinema/../../token";
  await writeFile(path.join(dir, "backup.json"), JSON.stringify(manifest));
  await refused(
    restoreWorkspace(dir, path.join(home, "restored-escape")),
    "VALIDATION",
  );
});

test("without space for the legacy files too, a backup or restore leaves nothing behind", async () => {
  const w = await creativeWorkspace();
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  const tight: BackupSource = {
    root: w.root,
    reservedBytes: Number.MAX_SAFE_INTEGER / 2,
    backupDatabase: (d) => w.store.backupDatabase(d),
    holdObjects: () => w.store.holdObjects(),
  };
  await refused(backupWorkspace(tight, home), "LIMIT_EXCEEDED");
  assert.deepEqual(
    (await listBackups(home)).map((b) => b.backupId),
    [backup.backupId],
  );
  const target = path.join(home, "restored-full");
  await refused(
    restoreWorkspace(path.join(home, "backups", backup.backupId), target, {
      reservedBytes: Number.MAX_SAFE_INTEGER / 2,
    }),
    "LIMIT_EXCEEDED",
  );
  await assert.rejects(readdir(target));
});

test("copied jobs, attempts, uploads and agent tokens cannot act in a restored workspace", async () => {
  const w = await creativeWorkspace();
  const agent = w.store.createAgentToken(
    new Set(["project:read"] as const),
    "copied",
  );
  w.store.reserveDocumentUpload({
    projectId: w.project.id,
    principalId: "browser-ui",
    requestId: "staged-1",
    kind: "studio",
    schemaVersion: 1,
    declaredBytes: 10,
    bodySha256: sha("x"),
  });
  // Jobs as the original service left them at the moment of the backup.
  const db = new DatabaseSync(path.join(w.root, "workspace.sqlite"));
  const job = db.prepare(
    "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state, cancel_requested) VALUES (?, 'export', ?, ?, ?, '{\"format\":\"export/1\"}', ?, ?)",
  );
  const ids: Record<string, string> = {};
  for (const [state, cancel] of [
    ["queued", 0],
    ["preparing", 0],
    ["running", 0],
    ["validating", 0],
    ["cancelRequested", 1],
    ["succeeded", 0],
  ] as const) {
    ids[state] = randomUUID();
    job.run(ids[state], w.project.id, w.revision, state, state, cancel);
  }
  const generation = (
    db.prepare("SELECT generation FROM supervisor WHERE id = 1").get() as {
      generation: number;
    }
  ).generation;
  for (const state of ["preparing", "running", "validating"])
    db.prepare(
      "INSERT INTO attempts(job_id, attempt_no, generation, state, pid) VALUES (?, 1, ?, ?, 4242)",
    ).run(ids[state], generation, state === "preparing" ? "preparing" : state);
  db.close();
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  const restored = await restoreWorkspace(
    path.join(home, "backups", backup.backupId),
    path.join(home, "restored-fenced"),
  );
  assert.equal(restored.fenced.jobsHeld, 4);
  assert.equal(restored.fenced.jobsCancelled, 1);
  assert.equal(restored.fenced.attemptsFenced, 3);
  assert.equal(restored.fenced.uploadsDropped, 1);
  assert.equal(restored.fenced.agentTokensRevoked, 1);
  assert.ok(restored.fenced.directorEpoch! > 1);
  // Two service starts in the copy: no attempt is made, nothing resumes.
  for (let start = 0; start < 2; start++) {
    const copy = await open(restored.root);
    const supervisor = new JobSupervisor(copy);
    await supervisor.start();
    for (const state of ["queued", "preparing", "running", "validating"])
      assert.equal(
        supervisor.status(ids[state]!).detail,
        "reconciliationRequired",
      );
    assert.equal(supervisor.status(ids.cancelRequested!).detail, "cancelled");
    assert.equal(supervisor.status(ids.succeeded!).detail, "succeeded");
    assert.equal(copy.principalForAgentToken(agent.token), null);
    await supervisor.close();
    await copy.close();
  }
  const check = new DatabaseSync(path.join(restored.root, "workspace.sqlite"), {
    readOnly: true,
  });
  assert.deepEqual(
    check
      .prepare("SELECT DISTINCT state FROM attempts")
      .all()
      .map((r) => r.state),
    ["failed"],
  );
  assert.equal(
    (check.prepare("SELECT count(*) AS n FROM attempts").get() as { n: number })
      .n,
    3,
    "no new attempt",
  );
  assert.equal(
    (
      check.prepare("SELECT count(*) AS n FROM document_uploads").get() as {
        n: number;
      }
    ).n,
    0,
  );
  check.close();
  // Only an explicit decision moves a held job; the original keeps its own.
  const copy = await open(restored.root);
  const supervisor = new JobSupervisor(copy);
  assert.equal(supervisor.discard(ids.queued!).detail, "cancelled");
  await supervisor.close();
  assert.ok(w.store.principalForAgentToken(agent.token));
});

test("an earlier backup format still restores, labelled as not proving creative scope", async () => {
  const w = await creativeWorkspace();
  const home = await temp("yamakan-creative-home-");
  const backup = await backupWorkspace(w.store, home);
  const dir = path.join(home, "backups", backup.backupId);
  const manifest = JSON.parse(
    await readFile(path.join(dir, "backup.json"), "utf8"),
  );
  manifest.format = "yamakan.backup/1";
  delete manifest.legacyFiles;
  delete manifest.legacyDamaged;
  delete manifest.closure;
  delete manifest.restorePolicy;
  await writeFile(path.join(dir, "backup.json"), JSON.stringify(manifest));
  const listed = (await listBackups(home))[0]!;
  assert.ok(listed.complete);
  assert.equal(listed.creative, "incomplete");
  const restored = await restoreWorkspace(dir, path.join(home, "restored-v1"));
  assert.equal(restored.backupFormat, "yamakan.backup/1");
  assert.equal(restored.creative, "incomplete");
  assert.equal(restored.legacyRestored, 0);
  assert.equal(restored.closure.gaps, 0);
});
