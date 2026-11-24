import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import {
  mkdtemp,
  rm,
  access,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { writeFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  ProjectStore,
  WORKSPACE_SCHEMA_STEPS,
  WORKSPACE_SCHEMA_VERSION,
} from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { CommandError } from "../core/command/errors.ts";
import { acquireServiceLock } from "../core/service-lock.ts";

const child = fileURLToPath(new URL("./fixtures/t2-child.ts", import.meta.url));
const spawnChild = (...args: string[]) =>
  fork(child, args, { stdio: ["ignore", "ignore", "pipe", "ipc"] });
const nextMessage = (c: ChildProcess) =>
  new Promise<any>((resolve, reject) => {
    c.once("message", resolve);
    c.once("exit", (code) => reject(new Error(`child exited ${code}`)));
  });
async function waitFor(file: string) {
  for (let i = 0; i < 1000 && !existsSync(file); i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.ok(existsSync(file), `timed out waiting for ${file}`);
}
async function kill(c: ChildProcess) {
  if (c.exitCode !== null || c.signalCode !== null) return;
  const exited = once(c, "exit");
  c.kill("SIGKILL");
  await exited;
}
// Every test folder is removed when the file's tests finish, after the
// stores opened in it close (Windows cannot delete them open).
const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const handle of handles.reverse()) await handle.close();
  await Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});
async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-db-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Original");
  return { root, store, project };
}
const integrity = (root: string) => {
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  try {
    return (
      db.prepare("PRAGMA integrity_check").get() as Record<string, string>
    ).integrity_check;
  } finally {
    db.close();
  }
};
const snapshotCount = (root: string) => {
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  try {
    return (
      db.prepare("SELECT count(*) AS n FROM snapshots").get() as { n: number }
    ).n;
  } finally {
    db.close();
  }
};

test("two processes racing the same revision produce exactly one commit and one conflict", async () => {
  const { root, store, project } = await workspace();
  const release = path.join(root, "release-a");
  const a = spawnChild(
    "writer",
    root,
    project.id,
    "From A",
    "req-a",
    "after-snapshot-insert",
    release,
  );
  const b = spawnChild("writer", root, project.id, "From B", "req-b");
  try {
    await Promise.all([nextMessage(a), nextMessage(b)]);
    // A holds the write transaction mid-commit; B must wait and then observe A's revision.
    const resultA = nextMessage(a);
    a.send("go");
    await waitFor(`${release}.paused`);
    const resultB = nextMessage(b);
    b.send("go");
    await new Promise((r) => setTimeout(r, 200));
    writeFileSync(release, "");
    const [outA, outB] = [await resultA, await resultB];
    assert.deepEqual([outA.ok, outA.revision], [true, 1]);
    assert.deepEqual([outB.ok, outB.code], [false, "REVISION_CONFLICT"]);
    // B proposed revision 0 and was blocked on A's write lock until release.
    assert.ok(outB.ms >= 150, `B waited only ${outB.ms} ms`);
    const head = await store.load(project.id);
    assert.equal(head.name, "From A");
    assert.equal(head.revision, 1);
    assert.equal(integrity(root), "ok");
  } finally {
    await kill(a);
    await kill(b);
    store.close();
  }
});

test("a process killed inside the transaction leaves no partial commit; one killed after commit keeps it", async () => {
  const { root, store, project } = await workspace();
  const before = snapshotCount(root);
  const release = path.join(root, "never");
  const victim = spawnChild(
    "writer",
    root,
    project.id,
    "Lost",
    "req-kill",
    "before-commit",
    release,
  );
  await nextMessage(victim);
  victim.send("go");
  await waitFor(`${release}.paused`);
  await kill(victim);
  assert.equal((await store.load(project.id)).revision, 0);
  assert.equal(snapshotCount(root), before, "rolled back snapshot bytes too");
  assert.equal(integrity(root), "ok");

  const after = path.join(root, "after");
  const committed = spawnChild(
    "writer",
    root,
    project.id,
    "Kept",
    "req-after",
    "after-commit",
    after,
  );
  await nextMessage(committed);
  committed.send("go");
  await waitFor(`${after}.paused`);
  await kill(committed);
  const head = await store.load(project.id);
  assert.deepEqual([head.revision, head.name], [1, "Kept"]);
  // The caller never saw a response; retrying the same request returns the
  // original result instead of a conflict or a duplicate revision.
  const retried = await store.save({ ...project, name: "Kept" }, 0, {
    principalId: "local-client",
    requestId: "req-after",
    digest: "Kept",
  });
  assert.deepEqual(retried, head);
  assert.equal((await store.load(project.id)).revision, 1);
  store.close();
});

test("request replay is checked before the revision and rejects reused IDs with different input", async () => {
  const { store, project } = await workspace();
  const queue = new JobSupervisor(store);
  const ctx = (requestId: string) => ({
    store,
    queue,
    principal: { id: "local-client" as const, scopes: new Set(Scopes) },
    requestId,
  });
  const save = (requestId: string, name: string) =>
    execute(ctx(requestId), "yamakan.project.save", {
      project: { ...project, name },
      expectedRevision: 0,
    });
  const first = await save("r1", "One");
  const again = await save("r1", "One");
  assert.deepEqual(again.result, first.result);
  assert.equal((await store.load(project.id)).revision, 1);
  await assert.rejects(
    save("r1", "Different"),
    (e: unknown) =>
      e instanceof CommandError && e.code === "IDEMPOTENCY_MISMATCH",
  );
  await assert.rejects(
    save("r2", "Stale"),
    (e: unknown) => e instanceof CommandError && e.code === "REVISION_CONFLICT",
  );
  // Receipts are scoped per principal: another principal's ID is a new request.
  await assert.rejects(
    execute(
      {
        ...ctx("r1"),
        principal: { id: "browser-ui", scopes: new Set(Scopes) },
      },
      "yamakan.project.save",
      {
        project: { ...project, name: "One" },
        expectedRevision: 0,
      },
    ),
    (e: unknown) => e instanceof CommandError && e.code === "REVISION_CONFLICT",
  );
  const created = await execute(ctx("c1"), "yamakan.project.create", {
    name: "New",
  });
  const replayed = await execute(ctx("c1"), "yamakan.project.create", {
    name: "New",
  });
  assert.deepEqual(replayed.result, created.result);
  assert.equal(
    (await store.list()).length,
    2,
    "create replay made no second project",
  );
  await queue.close();
  store.close();
});

test("the service lock is exclusive, and the OS releases it when its owner is killed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-lock-"));
  bases.push(root);
  const holder = spawnChild("lock", root);
  try {
    assert.deepEqual(await nextMessage(holder), { locked: true });
    await assert.rejects(
      acquireServiceLock(root),
      (e: unknown) => e instanceof CommandError && e.code === "BUSY",
    );
    await kill(holder);
    // No manual unlock: the stale file remains as metadata and is reacquired.
    await access(path.join(root, "service.lock"));
    const lock = await acquireServiceLock(root);
    lock.release();
  } finally {
    await kill(holder);
  }
});

test("reopen needs only the database; snapshots and history live in SQLite", async () => {
  const { root, store, project } = await workspace();
  const one = await store.save({ ...project, name: "Edited" }, 0);
  store.close();
  await rm(path.join(root, "projects", project.id), { recursive: true });
  const reopened = new ProjectStore(root);
  handles.push(reopened);
  await reopened.initialize();
  assert.deepEqual(await reopened.load(project.id), one);
  const history = await reopened.history(project.id);
  assert.deepEqual(
    history.snapshots.map((s) => [s.revision, s.verified]),
    [
      [1, true],
      [0, true],
    ],
  );
  assert.deepEqual(
    reopened.events().map((e) => [e.revision, e.operation]),
    [
      [0, "project.create"],
      [1, "project.save"],
    ],
  );
  const restored = await reopened.restore(
    project.id,
    0,
    history.headFingerprint,
  );
  assert.deepEqual([restored.revision, restored.name], [2, "Original"]);
  await assert.rejects(
    reopened.restore(project.id, 1, history.headFingerprint),
    (e: unknown) => e instanceof CommandError && e.code === "REVISION_CONFLICT",
  );
  reopened.close();
});

test("snapshots over the byte limit are refused and commit nothing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-limit-"));
  bases.push(root);
  const store = new ProjectStore(root, { snapshotBytes: 300 });
  handles.push(store);
  await store.initialize();
  await assert.rejects(
    store.create("A name long enough to exceed a 300 byte snapshot limit"),
    (e: unknown) => e instanceof CommandError && e.code === "LIMIT_EXCEEDED",
  );
  assert.equal(snapshotCount(root), 0);
  assert.deepEqual(await store.list(), []);
  store.close();
});

test("a newer or foreign database is refused and left byte-identical", async () => {
  const { root, store } = await workspace();
  store.close();
  const file = path.join(root, "workspace.sqlite");
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE; PRAGMA user_version = 99",
  );
  db.close();
  const before = await readFile(file);
  await assert.rejects(
    new ProjectStore(root).initialize(),
    (e: unknown) => e instanceof CommandError && e.code === "RECOVERY_REQUIRED",
  );
  assert.deepEqual(await readFile(file), before);
  assert.ok(!existsSync(`${file}-wal`), "no WAL was created");

  const foreign = await mkdtemp(path.join(tmpdir(), "yamakan-foreign-"));
  bases.push(foreign);
  const other = new DatabaseSync(path.join(foreign, "workspace.sqlite"));
  other.exec("CREATE TABLE notes(text TEXT)");
  other.close();
  await assert.rejects(
    new ProjectStore(foreign).initialize(),
    /not a Yamakan workspace database/,
  );
});

test("a version 18 database gains the approval tables, empty, and keeps every row", async () => {
  const { root, store, project } = await workspace();
  await store.save({ ...project, name: "Edited" }, 0);
  store.close();
  const file = path.join(root, "workspace.sqlite");
  // As the build before left it: without the tables, at its version.
  const db = new DatabaseSync(file);
  const GATES = [
    "gate_approval_uses",
    "gate_approval_revocations",
    "gate_approvals",
  ];
  for (const table of GATES) db.exec(`DROP TABLE ${table}`);
  db.exec("PRAGMA user_version = 18");
  // Every other table, row by row and column by column.
  const rows = (from: DatabaseSync) =>
    Object.fromEntries(
      (
        from
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all() as { name: string }[]
      )
        .filter(({ name }) => !GATES.includes(name))
        .map(({ name }) => [
          name,
          from
            .prepare(`SELECT * FROM "${name}"`)
            .all()
            .map((row) => JSON.stringify(row))
            .sort(),
        ]),
    );
  const before = rows(db);
  assert.ok(Object.values(before).some((r) => r.length > 1));
  db.close();
  const upgraded = new ProjectStore(root);
  handles.push(upgraded);
  await upgraded.initialize();
  upgraded.close();
  const after = new DatabaseSync(file, { readOnly: true });
  assert.equal(
    (after.prepare("PRAGMA user_version").get() as { user_version: number })
      .user_version,
    WORKSPACE_SCHEMA_VERSION,
  );
  const now = rows(after);
  // The service's own lease is not a person's row.
  delete now.supervisor;
  delete before.supervisor;
  assert.deepEqual(now, before);
  for (const table of GATES)
    assert.deepEqual(after.prepare(`SELECT * FROM ${table}`).all(), []);
  // A row outside the bounds is refused by the table itself.
  after.close();
  const write = new DatabaseSync(file);
  const plant = (over: Record<string, string | number>) => {
    const row: Record<string, string | number> = {
      id: "00000000-0000-4000-8000-000000000000",
      kind: "egress",
      route: "kaggle",
      host: "kaggle.com",
      account: "someone",
      purpose: "generation",
      proxy_configured: 0,
      certificate_override: 0,
      limit_runs: 1,
      limit_units: 1,
      limit_unit: "bytes",
      granted_at: 1,
      expires_at: 2,
      grantor_principal_id: "browser-ui",
      epoch: 1,
      ...over,
    };
    write
      .prepare(
        `INSERT INTO gate_approvals(${Object.keys(row).join(", ")}) VALUES (${Object.keys(
          row,
        )
          .map(() => "?")
          .join(", ")})`,
      )
      .run(...Object.values(row));
  };
  for (const over of [
    { id: "x" },
    { kind: "money" },
    { route: "" },
    { host: "h".repeat(254) },
    { account: "a".repeat(81) },
    { purpose: "other" },
    { proxy_configured: 2 },
    { certificate_override: 2 },
    { limit_runs: 0 },
    { limit_units: -1 },
    { limit_unit: "euros" },
    { expires_at: 1 },
    { grantor_principal_id: "" },
    { epoch: "soon" },
    { granted_at: "long ago" },
  ])
    assert.throws(
      () => plant(over as never),
      /constraint|cannot store/i,
      JSON.stringify(over),
    );
  plant({});
  assert.throws(() => plant({}), /constraint/i);
  // A number that was one's is never another's.
  const last = () =>
    (
      write.prepare("SELECT max(n) AS n FROM gate_approvals").get() as {
        n: number;
      }
    ).n;
  plant({ id: "00000000-0000-4000-8000-000000000001" });
  const was = last();
  write.exec(`DELETE FROM gate_approvals WHERE n = ${was}`);
  plant({ id: "00000000-0000-4000-8000-000000000002" });
  assert.equal(last(), was + 1);
  // The same of the rows beside it.
  const ID = "00000000-0000-4000-8000-000000000000";
  write.exec("PRAGMA foreign_keys = ON");
  for (const sql of [
    "INSERT INTO gate_approval_revocations VALUES ('x', 1, 'browser-ui')",
    `INSERT INTO gate_approval_revocations VALUES ('${ID}', 1, '')`,
    `INSERT INTO gate_approval_revocations VALUES ('${ID}', 'soon', 'browser-ui')`,
    "INSERT INTO gate_approval_uses VALUES ('x', 'u', 1, 1)",
    `INSERT INTO gate_approval_uses VALUES ('${ID}', '', 1, 1)`,
    `INSERT INTO gate_approval_uses VALUES ('${ID}', '${"u".repeat(81)}', 1, 1)`,
    `INSERT INTO gate_approval_uses VALUES ('${ID}', 'u', -1, 1)`,
    `INSERT INTO gate_approval_uses VALUES ('${ID}', 'u', 'much', 1)`,
    "INSERT INTO gate_approvals(id) VALUES ('x')",
  ])
    assert.throws(() => write.exec(sql), /constraint|cannot store/i, sql);
  write.exec(
    `INSERT INTO gate_approval_revocations VALUES ('${ID}', 1, 'browser-ui')`,
  );
  write.exec(`INSERT INTO gate_approval_uses VALUES ('${ID}', 'u', 0, 1)`);
  for (const sql of [
    `INSERT INTO gate_approval_revocations VALUES ('${ID}', 2, 'browser-ui')`,
    `INSERT INTO gate_approval_uses VALUES ('${ID}', 'u', 1, 1)`,
  ])
    assert.throws(() => write.exec(sql), /UNIQUE/, sql);
  write.close();
});

// OA-22: each step as it landed, by its text's SHA-256, in order. A step that has landed is never
// changed: a workspace that already took it would differ from one that takes it now. A new step
// adds one line here; a line that is here is not changed to make this pass.
const LANDED_STEPS = [
  "c80c78ec629f53ecbd32ae21cbeaff95fe0f0291f0031344903fce2d4f00129e",
  "ed139eb77bb3dcf6440f8169364f68985a1afdefa9ad022185cd32cba6ec3055",
  "5aed7c060e55ca0422e754708c1531b38ea6a62bcbf2b434f9440492c4d9df0c",
  "d54a498a5e08c2b9ab96baa2b19a114f29d100dbb69e65a4d7b4400de6f3d05a",
  "5f52278755dfcf55b544b2c0b1e0ee4028c288098286dea06b2186572d2f5211",
  "30cd27ac8d586355939d2dd7b2bc7c9cd8792749bc9ed0d3cbcf1006aaac1fda",
  "8aee51958749f82ebfe281cd6008d3ceaa7a20e2e9add46ef0e0a86be77064ff",
  "137d1ff780c5e06d9d010288fbb3de1a932d709f245084cf8505b248dd77e6d3",
  "5aa9ef60f677496c35300f9674b8c9d69c3559b8475316ec76249079e55c906f",
  "75626c1a1113dbb78e5f812186cf6d5c2ebf9d38f7136d949fd6ce7cf7ac5be6",
  "ca8b56b828629f4c4447d6da811c5380d50c6ef633696938d3303a30ff6dfe2e",
  "901718bf1d56247d4b26b54a21511e2c7ece95c9210c327902fea4f80fad8372",
  "13d64f91c5fbc0c4739a59df22a0243c7682a43ce793ec8d76d6617d5bdf2d8b",
  "89dd69eddb14165134480c5ad16bf59e945f0fd6c228cab840bc4b2f57aedcb5",
  "a3be9bd5da23f58753ce11b927b8701e33df67ba4b7a331667dfb9170474fafa",
  "0dc43bbaa687ea247511300eebc60f885706084ebca959ac0ecd7ad7f83d2a48",
  "78b4ca38240778491833e91b7ca960530333b4d4072107a4d54bbdf35cfb39cf",
  "9bec1d84d41450bf40718daf1dbbac97b90a722fc084683873735c214726a75d",
  "1ae103451ada9d980d29ce7365fc4841cf7b44e71b4b797124887ef2951c5d1b",
];

test("each landed schema step is the text that landed", () => {
  assert.equal(LANDED_STEPS.length, WORKSPACE_SCHEMA_VERSION);
  assert.deepEqual(
    WORKSPACE_SCHEMA_STEPS.map((step) =>
      createHash("sha256").update(step).digest("hex"),
    ),
    LANDED_STEPS,
  );
});

test("a database of every older version opens with the same approval tables", async () => {
  assert.equal(WORKSPACE_SCHEMA_STEPS.length, WORKSPACE_SCHEMA_VERSION);
  const tables = (file: string) => {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      assert.equal(
        (db.prepare("PRAGMA user_version").get() as { user_version: number })
          .user_version,
        WORKSPACE_SCHEMA_VERSION,
      );
      return db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE name LIKE 'gate_%' ORDER BY name",
        )
        .all();
    } finally {
      db.close();
    }
  };
  const { root, store } = await workspace();
  store.close();
  const fresh = tables(path.join(root, "workspace.sqlite"));
  assert.equal(fresh.length, 4);
  for (let version = 1; version < WORKSPACE_SCHEMA_VERSION; version++) {
    const old = await mkdtemp(path.join(tmpdir(), "yamakan-db-old-"));
    bases.push(old);
    const file = path.join(old, "workspace.sqlite");
    const db = new DatabaseSync(file, { enableForeignKeyConstraints: false });
    for (const step of WORKSPACE_SCHEMA_STEPS.slice(0, version)) db.exec(step);
    db.exec(`PRAGMA user_version = ${version}`);
    db.close();
    const opened = new ProjectStore(old);
    handles.push(opened);
    await opened.initialize();
    await opened.create("After");
    opened.close();
    assert.deepEqual(tables(file), fresh, `from version ${version}`);
  }
});

test("a damaged lock file is set aside and the lock is acquired", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-lockfile-"));
  bases.push(root);
  await writeFile(path.join(root, "service.lock"), "x".repeat(4096));
  const lock = await acquireServiceLock(root);
  lock.release();
  assert.ok(
    (await readdir(root)).some((f) => f.startsWith("service.lock.damaged-")),
    "damaged metadata is preserved for diagnosis",
  );
});

test("server-generated request IDs are not stored as replay receipts", async () => {
  const { root, store, project } = await workspace();
  const queue = new JobSupervisor(store);
  await execute(
    {
      store,
      queue,
      principal: { id: "local-client", scopes: new Set(Scopes) },
    },
    "yamakan.project.save",
    { project: { ...project, name: "No receipt" }, expectedRevision: 0 },
  );
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  const n = (
    db.prepare("SELECT count(*) AS n FROM command_receipts").get() as {
      n: number;
    }
  ).n;
  db.close();
  assert.equal(n, 0);
  await queue.close();
  store.close();
});

test("explicit restore replaces a damaged head and preserves the damaged evidence", async () => {
  const { root, store, project } = await workspace();
  const one = await store.save({ ...project, name: "Good" }, 0);
  await store.save({ ...one, name: "Will be damaged" }, 1);
  const db = new DatabaseSync(path.join(root, "workspace.sqlite"));
  // Damage the head snapshot bytes: the head cannot be read, older revisions can.
  db.prepare(
    "UPDATE snapshots SET bytes = ?, byte_length = 3 WHERE hash = (SELECT snapshot_hash FROM projects WHERE project_id = ?)",
  ).run(Buffer.from("bad"), project.id);
  await assert.rejects(store.load(project.id), /hash mismatch/);
  let history = await store.history(project.id);
  assert.equal(history.currentRevision, null);
  assert.deepEqual(
    history.snapshots.map((s) => [s.revision, s.verified]),
    [
      [2, false],
      [1, true],
      [0, true],
    ],
  );
  await assert.rejects(store.save({ ...one, revision: 2 }, 2), /hash mismatch/);
  const restored = await store.restore(project.id, 1, history.headFingerprint);
  assert.deepEqual([restored.revision, restored.name], [3, "Good"]);
  // Damage only the head pointer (identity mismatch); its snapshot stays intact.
  const other = await store.create("Other");
  db.prepare(
    "UPDATE projects SET snapshot_hash = (SELECT snapshot_hash FROM projects WHERE project_id = ?) WHERE project_id = ?",
  ).run(other.id, project.id);
  await assert.rejects(store.load(project.id), /identity mismatch/);
  history = await store.history(project.id);
  const again = await store.restore(project.id, 3, history.headFingerprint);
  assert.deepEqual([again.revision, again.name], [4, "Good"]);
  const kept = db
    .prepare("SELECT count(*) AS n FROM snapshots WHERE bytes = ?")
    .get(Buffer.from("bad")) as { n: number };
  assert.equal(kept.n, 1, "damaged bytes are preserved for diagnosis");
  db.close();
  store.close();
});

test("refusing a WAL-mode foreign database leaves the folder exactly as found", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-walforeign-"));
  bases.push(root);
  const file = path.join(root, "workspace.sqlite");
  const other = new DatabaseSync(file);
  other.exec("PRAGMA journal_mode = WAL; CREATE TABLE notes(text TEXT)");
  other.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  other.close();
  const before = (await readdir(root)).sort();
  const bytes = await readFile(file);
  await assert.rejects(new ProjectStore(root).initialize(), /not a Yamakan/);
  assert.deepEqual((await readdir(root)).sort(), before);
  assert.deepEqual(await readFile(file), bytes);
});

test("history pages older revisions with a cursor", async () => {
  const { store, project } = await workspace();
  let p = project;
  for (let i = 0; i < 6; i++)
    p = await store.save({ ...p, name: `v${i}` }, p.revision);
  const first = await store.history(project.id, 3);
  assert.deepEqual(
    first.snapshots.map((s) => s.revision),
    [6, 5, 4],
  );
  const next = await store.history(project.id, 3, 4);
  assert.deepEqual(
    next.snapshots.map((s) => s.revision),
    [3, 2, 1],
  );
  const last = await store.history(project.id, 3, 1);
  assert.deepEqual(
    last.snapshots.map((s) => s.revision),
    [0],
  );
  store.close();
});
