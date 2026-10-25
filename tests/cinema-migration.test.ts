// YU-012: legacy workspace Cinema sidecars become project documents only
// on an explicit request naming the project; originals are never changed.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { CommandError } from "../core/command/errors.ts";
import { execute, type CommandContext } from "../core/command/registry.ts";
import {
  SCENE3D_FORMAT,
  SCENE3D_FORMAT_VERSION,
  parseScene3D,
} from "../core/scene3d.ts";
import { persistCinemaScene } from "../core/cinema-store.ts";
import {
  inventoryCinemaSidecars,
  migrateCinemaSidecar,
} from "../core/documents-legacy.ts";
import { canonicalJson } from "../core/hash/canonical.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  await Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function scene(id: string, focal = 35) {
  return {
    format: SCENE3D_FORMAT,
    formatVersion: SCENE3D_FORMAT_VERSION,
    id,
    units: "metres" as const,
    eulerOrder: "XYZ" as const,
    camera: { focalLengthMm: focal, sensorWidthMm: 36, near: 0.1, far: 1000 },
    items: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "cube",
        position: { x: 0, y: 1, z: -2 },
        rotation: { x: 0, y: 0.5, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        assetId: null,
      },
    ],
  };
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-cinema-mig-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  await mkdir(path.join(root, "cinema"), { recursive: true });
  const sidecar = async (name: string, content: string | Buffer) => {
    const file = path.join(root, "cinema", name);
    await writeFile(file, content);
    return file;
  };
  return { root, store, sidecar };
}

async function refused(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof CommandError, String(e));
    assert.equal(e.code, code, e.message);
    return true;
  });
}

// Bytes and modification time of every given file, to prove nothing wrote.
const fingerprint = async (files: string[]) =>
  Promise.all(
    files.map(async (f) => [sha(await readFile(f)), (await stat(f)).mtimeMs]),
  );

test("the inventory reports every sidecar without changing any of them", async () => {
  const { store, sidecar } = await workspace();
  const files = [
    await sidecar(`${A}.json`, `${JSON.stringify(scene(A), null, 2)}\n`),
    // Truncated mid-write by an old non-atomic save.
    await sidecar(`${B}.json`, JSON.stringify(scene(B)).slice(0, 80)),
    // A copy of A under C's name: its scene is not C.
    await sidecar(`${C}.json`, JSON.stringify(scene(A))),
    await sidecar(`${A.toUpperCase()}.JSON.bak`, "{}"),
    await sidecar("notes.txt", "hello"),
  ];
  const before = await fingerprint(files);
  const { sidecars, truncated } = await inventoryCinemaSidecars(store);
  assert.equal(truncated, false);
  const by = Object.fromEntries(sidecars.map((s) => [s.name, s]));
  assert.equal(by[`${A}.json`]!.state, "valid");
  assert.equal(by[`${A}.json`]!.sourceSha256, sha(await readFile(files[0]!)));
  assert.equal(
    by[`${A}.json`]!.contentHash,
    sha(Buffer.from(canonicalJson(parseScene3D(scene(A))), "utf8")),
  );
  assert.equal(by[`${B}.json`]!.state, "invalid");
  assert.match(by[`${B}.json`]!.reason!, /not valid JSON/);
  assert.equal(by[`${C}.json`]!.state, "invalid");
  assert.match(by[`${C}.json`]!.reason!, /different id/);
  assert.equal(by["notes.txt"]!.state, "invalid");
  assert.equal(sidecars.length, 5);
  assert.deepEqual(await fingerprint(files), before);
});

test("an upper-case scene file (an older save kept the id's case) is an original and migrates", async () => {
  const { store, sidecar } = await workspace();
  // An id with hex letters, so its upper-case form is a different name.
  const D = "DDDDDDDD-DDDD-4DDD-ADDD-DDDDDDDDDDDD";
  const file = await sidecar(`${D}.json`, JSON.stringify(scene(D)));
  const [entry] = (await inventoryCinemaSidecars(store)).sidecars;
  assert.equal(entry!.state, "valid");
  assert.equal(entry!.sceneId, D);
  const project = await store.create("Cinema");
  const out = await migrateCinemaSidecar(store, {
    projectId: project.id,
    expectedRevision: project.revision,
    sceneId: D.toLowerCase(),
    sourceSha256: sha(await readFile(file)),
  });
  assert.equal(out.migrated, true);
  assert.equal(out.document.id, D, "the scene keeps its own id");
});

test(
  "names that differ only in case are ambiguous and never read",
  { skip: process.platform === "win32" && "case-insensitive file system" },
  async () => {
    const { store, sidecar } = await workspace();
    const D = "dddddddd-dddd-4ddd-addd-dddddddddddd";
    await sidecar(`${D}.json`, JSON.stringify(scene(D)));
    await sidecar(
      `${D.toUpperCase()}.json`,
      JSON.stringify(scene(D.toUpperCase())),
    );
    const { sidecars } = await inventoryCinemaSidecars(store);
    assert.deepEqual(
      sidecars.map((s) => s.state),
      ["invalid", "invalid"],
    );
    const project = await store.create("Cinema");
    await refused(
      migrateCinemaSidecar(store, {
        projectId: project.id,
        expectedRevision: project.revision,
        sceneId: D,
        sourceSha256: "0".repeat(64),
      }),
      "VALIDATION",
    );
  },
);

test("hard links and links are not read; the inventory stops at its byte budget", async () => {
  const { root, store, sidecar } = await workspace();
  const outside = path.join(root, "outside.json");
  await writeFile(outside, JSON.stringify(scene(A)));
  await link(outside, path.join(root, "cinema", `${A}.json`));
  await sidecar(`${B}.json`, JSON.stringify(scene(B)));
  await sidecar(`${C}.json`, JSON.stringify(scene(C)));
  const all = await inventoryCinemaSidecars(store);
  const by = Object.fromEntries(all.sidecars.map((s) => [s.name, s]));
  assert.equal(by[`${A}.json`]!.state, "invalid");
  assert.match(by[`${A}.json`]!.reason!, /Not a plain file/);
  assert.equal(all.truncated, false);
  // A budget for one file: the rest are listed, not examined.
  const one = (await stat(path.join(root, "cinema", `${B}.json`))).size;
  const small = await inventoryCinemaSidecars(store, { bytes: one + one });
  assert.equal(small.truncated, true);
  assert.deepEqual(
    small.sidecars.map((s) => s.state),
    ["invalid", "valid", "unexamined"],
  );
});

test("a scene migrates only into the project named, with exact content, and keeps its original", async () => {
  const { store, sidecar } = await workspace();
  const raw = `${JSON.stringify(scene(A), null, 2)}\n`;
  const file = await sidecar(`${A}.json`, raw);
  const before = await fingerprint([file]);
  const project = await store.create("Cinema");
  const [entry] = (await inventoryCinemaSidecars(store)).sidecars;
  // Nothing is assigned by inventory or by default.
  assert.deepEqual(store.listDocuments(project.id), []);
  const out = await migrateCinemaSidecar(store, {
    projectId: project.id,
    expectedRevision: project.revision,
    sceneId: A,
    sourceSha256: entry!.sourceSha256!,
  });
  assert.equal(out.migrated, true);
  assert.equal(out.project.revision, project.revision + 1);
  assert.equal(out.document.contentHash, entry!.contentHash);
  const { bytes } = store.getDocument(project.id, A);
  assert.deepEqual(JSON.parse(bytes.toString("utf8")), parseScene3D(scene(A)));
  assert.equal(out.receipt.projectId, project.id);
  assert.equal(out.receipt.sourceSha256, entry!.sourceSha256);
  assert.equal(out.receipt.revision, out.project.revision);
  assert.deepEqual(
    await fingerprint([file]),
    before,
    "the original is untouched",
  );
  // The inventory now shows where it went.
  const again = (await inventoryCinemaSidecars(store)).sidecars[0]!;
  assert.deepEqual(
    again.migrations.map((m) => [m.projectId, m.revision]),
    [[project.id, out.project.revision]],
  );
});

test("a retry, and a retry after a restart, return the same migration without a new revision", async () => {
  const { root, store, sidecar } = await workspace();
  await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const project = await store.create("Cinema");
  const sourceSha256 = (await inventoryCinemaSidecars(store)).sidecars[0]!
    .sourceSha256!;
  const input = {
    projectId: project.id,
    expectedRevision: project.revision,
    sceneId: A,
    sourceSha256,
  };
  const first = await migrateCinemaSidecar(store, input);
  const second = await migrateCinemaSidecar(store, input);
  assert.equal(second.migrated, false);
  assert.equal(second.project.revision, first.project.revision);
  assert.deepEqual(second.receipt, first.receipt);
  await store.close();
  const reopened = new ProjectStore(root);
  handles.push(reopened);
  await reopened.initialize();
  const third = await migrateCinemaSidecar(reopened, input);
  assert.equal(third.migrated, false);
  assert.deepEqual(third.receipt, first.receipt);
  assert.equal(
    (await reopened.load(project.id)).revision,
    first.project.revision,
  );
});

test("ownership is never inferred or moved, and project documents are never overwritten", async () => {
  const { store, sidecar } = await workspace();
  const file = await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const one = await store.create("One");
  const two = await store.create("Two");
  const sourceSha256 = sha(await readFile(file));
  await migrateCinemaSidecar(store, {
    projectId: one.id,
    expectedRevision: one.revision,
    sceneId: A,
    sourceSha256,
  });
  await refused(
    migrateCinemaSidecar(store, {
      projectId: two.id,
      expectedRevision: two.revision,
      sceneId: A,
      sourceSha256,
    }),
    "VALIDATION",
  );
  assert.deepEqual(store.listDocuments(two.id), []);
  // A project that already has its own, different scene under this id.
  const three = await store.create("Three");
  const own = await store.commitDocument({
    projectId: three.id,
    expectedRevision: three.revision,
    documentId: A,
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: null,
    source: { bytes: Buffer.from(JSON.stringify(scene(A, 85))) },
  });
  const ownHash = store.listDocuments(three.id)[0]!.contentHash;
  await refused(
    migrateCinemaSidecar(store, {
      projectId: three.id,
      expectedRevision: own.revision,
      sceneId: A,
      sourceSha256,
    }),
    "VALIDATION",
  );
  assert.equal(store.listDocuments(three.id)[0]!.contentHash, ownHash);
});

test("a scene file stays its project's after it changes; retries return the recorded migration", async () => {
  const { store, sidecar } = await workspace();
  const file = await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const one = await store.create("One");
  const two = await store.create("Two");
  const first = await migrateCinemaSidecar(store, {
    projectId: one.id,
    expectedRevision: one.revision,
    sceneId: A,
    sourceSha256: sha(await readFile(file)),
  });
  // The legacy file is saved again (still allowed), and the project edits
  // its own scene.
  await writeFile(file, JSON.stringify(scene(A, 70)));
  const changed = sha(await readFile(file));
  await refused(
    migrateCinemaSidecar(store, {
      projectId: two.id,
      expectedRevision: two.revision,
      sceneId: A,
      sourceSha256: changed,
    }),
    "VALIDATION",
  );
  const edited = await store.commitDocument({
    projectId: one.id,
    expectedRevision: first.project.revision,
    documentId: A,
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: first.document.contentHash,
    source: { bytes: Buffer.from(JSON.stringify(scene(A, 90))) },
  });
  // A retry (a lost response) returns the recorded migration, unchanged,
  // and never overwrites the project's later edit.
  const retry = await migrateCinemaSidecar(store, {
    projectId: one.id,
    expectedRevision: first.project.revision - 1,
    sceneId: A,
    sourceSha256: changed,
  });
  assert.equal(retry.migrated, false);
  assert.deepEqual(retry.receipt, first.receipt);
  assert.equal(retry.project.revision, edited.revision);
  assert.notEqual(
    store.listDocuments(one.id)[0]!.contentHash,
    first.document.contentHash,
  );
  assert.deepEqual(store.listDocuments(two.id), []);
});

test("a file changed since inventory, a missing one and a foreign id are refused", async () => {
  const { store, sidecar } = await workspace();
  const file = await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const project = await store.create("Cinema");
  const stale = sha(await readFile(file));
  await writeFile(file, JSON.stringify(scene(A, 50)));
  await refused(
    migrateCinemaSidecar(store, {
      projectId: project.id,
      expectedRevision: project.revision,
      sceneId: A,
      sourceSha256: stale,
    }),
    "REVISION_CONFLICT",
  );
  await refused(
    migrateCinemaSidecar(store, {
      projectId: project.id,
      expectedRevision: project.revision,
      sceneId: B,
      sourceSha256: stale,
    }),
    "NOT_FOUND",
  );
  await sidecar(`${C}.json`, JSON.stringify(scene(A)));
  await refused(
    migrateCinemaSidecar(store, {
      projectId: project.id,
      expectedRevision: project.revision,
      sceneId: C,
      sourceSha256: sha(
        await readFile(path.join(path.dirname(file), `${C}.json`)),
      ),
    }),
    "VALIDATION",
  );
  assert.deepEqual(store.listDocuments(project.id), []);
});

test("two migrations against one revision: one commits, the other conflicts", async () => {
  const { store, sidecar } = await workspace();
  const fa = await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const fb = await sidecar(`${B}.json`, JSON.stringify(scene(B)));
  const project = await store.create("Cinema");
  const results = await Promise.allSettled([
    migrateCinemaSidecar(store, {
      projectId: project.id,
      expectedRevision: project.revision,
      sceneId: A,
      sourceSha256: sha(await readFile(fa)),
    }),
    migrateCinemaSidecar(store, {
      projectId: project.id,
      expectedRevision: project.revision,
      sceneId: B,
      sourceSha256: sha(await readFile(fb)),
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const lost = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal((lost.reason as CommandError).code, "REVISION_CONFLICT");
  assert.equal(store.listDocuments(project.id).length, 1);
});

test("two simultaneous legacy saves never tear the scene file", async () => {
  const { root, store } = await workspace();
  const scenes = Array.from({ length: 12 }, (_, i) =>
    parseScene3D(scene(A, 20 + i)),
  );
  await Promise.all(scenes.map((s) => persistCinemaScene(store, s)));
  const saved = parseScene3D(
    JSON.parse(await readFile(path.join(root, "cinema", `${A}.json`), "utf8")),
  );
  assert.ok(
    scenes.some((s) => s.camera.focalLengthMm === saved.camera.focalLengthMm),
  );
  const { sidecars } = await inventoryCinemaSidecars(store);
  assert.deepEqual(
    sidecars.map((s) => [s.name, s.state]),
    [[`${A}.json`, "valid"]],
  );
});

test("after a later edit, reverting restores the migrated scene exactly", async () => {
  const { store, sidecar } = await workspace();
  const file = await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const project = await store.create("Cinema");
  const out = await migrateCinemaSidecar(store, {
    projectId: project.id,
    expectedRevision: project.revision,
    sceneId: A,
    sourceSha256: sha(await readFile(file)),
  });
  const edited = await store.commitDocument({
    projectId: project.id,
    expectedRevision: out.project.revision,
    documentId: A,
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: out.document.contentHash,
    source: { bytes: Buffer.from(JSON.stringify(scene(A, 120))) },
  });
  const changed = store.listDocuments(project.id)[0]!.contentHash;
  await store.commitDocument({
    projectId: project.id,
    expectedRevision: edited.revision,
    documentId: A,
    kind: "cinemaScene",
    schemaVersion: 1,
    expectedContentHash: changed,
    source: { contentHash: out.document.contentHash },
  });
  const { bytes } = store.getDocument(project.id, A);
  assert.deepEqual(JSON.parse(bytes.toString("utf8")), parseScene3D(scene(A)));
});

test("the commands: inventory reads, migration stays behind the AG-DOCS flag", async () => {
  const { store, sidecar } = await workspace();
  const file = await sidecar(`${A}.json`, JSON.stringify(scene(A)));
  const project = await store.create("Cinema");
  const ctx = {
    store,
    queue: {} as CommandContext["queue"],
    principal: {
      id: "local-client",
      scopes: new Set(["project:write", "project:read"]),
    },
  } satisfies CommandContext;
  const listed = await execute(ctx, "yamakan.scene.inventory", {});
  assert.equal((listed.result as { sidecars: unknown[] }).sidecars.length, 1);
  await refused(
    execute(ctx, "yamakan.scene.migrate", {
      projectId: project.id,
      expectedRevision: project.revision,
      sceneId: A,
      sourceSha256: sha(await readFile(file)),
    }),
    "CAPABILITY_UNAVAILABLE",
  );
  assert.deepEqual(store.listDocuments(project.id), []);
});
