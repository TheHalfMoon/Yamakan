// YU-013: Director runs and likeness consent in the workspace database:
// compare-and-swap, replay, atomic revocation, verified outputs, restore and
// import fences.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { CommandError } from "../core/command/errors.ts";
import { backupWorkspace, restoreFromHome } from "../core/recovery.ts";
import {
  advanceStage,
  approveStage,
  directorNext,
  grantConsent,
  listEncodings,
  loadRun,
  recordEncoding,
  revalidateConsent,
  revokeConsentRecord,
  startDirectorRun,
} from "../core/director/runtime.ts";
import { importLegacyDirector } from "../core/director/legacy.ts";

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

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function open(root: string) {
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  return store;
}

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-director-"));
  bases.push(root);
  const store = await open(root);
  const project = await store.create("Director");
  // A stored output of the project (a small WAV derived from its name).
  const output = async (name: string) => {
    const samples = Buffer.alloc(4800 * 2);
    for (let i = 0; i < 4800; i++)
      samples.writeInt16LE(
        (hash(name).charCodeAt(i % 64) * 97 + i) % 30000,
        i * 2,
      );
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(36 + samples.length, 4);
    header.write("WAVEfmt ", 8, "ascii");
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(48000, 24);
    header.writeUInt32LE(96000, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(samples.length, 40);
    const { asset } = await store.importAsset(
      project.id,
      `${name}.wav`,
      Buffer.concat([header, samples]),
    );
    return asset.hash;
  };
  return { root, store, project, output };
}

async function refused(p: Promise<unknown>, code: string, message?: RegExp) {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof CommandError, String(e));
    assert.equal(e.code, code, e.message);
    if (message) assert.match(e.message, message);
    return true;
  });
}

const consentInput = {
  characterId: "hero",
  purpose: "identity-encode" as const,
  version: "v1",
  ttlMs: 3_600_000,
  principalId: "browser-ui",
};

test("two writers of one run version: one result is kept, the other conflicts", async () => {
  const { store, project, output } = await workspace();
  const run = await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: "framework-smoke",
  });
  const out = await output("brief");
  const results = await Promise.allSettled([
    advanceStage(store, {
      runId: run.id,
      stage: "research",
      status: "awaiting_human",
      outputHash: out,
      expectedVersion: run.version,
    }),
    advanceStage(store, {
      runId: run.id,
      stage: "research",
      status: "failed",
      outputHash: null,
      expectedVersion: run.version,
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const lost = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal((lost.reason as CommandError).code, "REVISION_CONFLICT");
  const now = await loadRun(store, run.id);
  assert.equal(now.version, run.version + 1);
  // An approval against the stale version conflicts too.
  await refused(
    approveStage(store, {
      runId: run.id,
      stage: "research",
      outputHash: out,
      ttlMs: 60_000,
      expectedVersion: run.version,
    }),
    "REVISION_CONFLICT",
  );
});

test("a lost response is replayed with its original result, once", async () => {
  const { store, project, output } = await workspace();
  const run = await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: "framework-smoke",
  });
  const out = await output("brief");
  const receipt = {
    principalId: "local-client",
    requestId: "advance-1",
    digest: hash("advance-1 research"),
  };
  const input = {
    runId: run.id,
    stage: "research",
    status: "awaiting_human" as const,
    outputHash: out,
  };
  const first = await advanceStage(store, input, receipt);
  const again = await advanceStage(store, input, receipt);
  assert.deepEqual(again, first);
  assert.equal(
    (await loadRun(store, run.id)).version,
    first.version,
    "no second attempt",
  );
  await refused(
    advanceStage(store, input, { ...receipt, digest: hash("other") }),
    "IDEMPOTENCY_MISMATCH",
  );
});

test("an approval binds a stored output; missing, changed and expired outputs are refused", async () => {
  const { store, project, output } = await workspace();
  const run = await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: "framework-smoke",
  });
  // Not an object of this project: refused at advance and at approval.
  await refused(
    advanceStage(store, {
      runId: run.id,
      stage: "research",
      status: "awaiting_human",
      outputHash: hash("nowhere"),
    }),
    "VALIDATION",
    /not a stored object/,
  );
  const out = await output("brief");
  await advanceStage(store, {
    runId: run.id,
    stage: "research",
    status: "awaiting_human",
    outputHash: out,
  });
  const other = await output("other");
  await refused(
    approveStage(store, {
      runId: run.id,
      stage: "research",
      outputHash: other,
      ttlMs: 60_000,
    }),
    "VALIDATION",
    /does not match/,
  );
  const now = Date.now();
  await approveStage(store, {
    runId: run.id,
    stage: "research",
    outputHash: out,
    ttlMs: 60_000,
    nowMs: now,
  });
  assert.equal((await directorNext(store, run.id, now + 1000)).kind, "stage");
  // Past its expiry the approval no longer opens the next stage.
  const late = await directorNext(store, run.id, now + 120_000);
  assert.equal(late.kind, "blocked");
});

test("revocation and its encodings' invalidation are one change; revoked stays revoked", async () => {
  const { store, project, output } = await workspace();
  const consent = await grantConsent(store, consentInput);
  const encode = () =>
    recordEncoding(store, {
      characterId: "hero",
      purpose: "identity-encode",
      consentId: consent.id,
      provider: "local",
      method: "ref",
      payloadHash: hash(randomUUID()),
    });
  const enc = await encode();
  assert.equal(enc.invalidated, false);
  const revoked = await revokeConsentRecord(store, consent.id);
  assert.ok(revoked.consent.revokedAtMs !== null);
  assert.deepEqual(
    revoked.encodings.map((e) => [e.id, e.invalidated]),
    [[enc.id, true]],
  );
  assert.ok((await listEncodings(store)).every((e) => e.invalidated));
  // The race: an encoding after the revocation is refused, never created.
  await refused(encode(), "VALIDATION", /revoked/);
  assert.equal((await listEncodings(store)).length, 1);
  await refused(
    revokeConsentRecord(store, consent.id),
    "VALIDATION",
    /already revoked/,
  );
  // Restoring an old project revision (a project-level restore) cannot
  // un-revoke: consent is workspace state, not project state.
  await output("later"); // a later project revision
  const history = await store.history(project.id);
  await store.restore(project.id, project.revision, history.headFingerprint);
  await refused(encode(), "VALIDATION", /revoked/);
});

test("a restored workspace starts a new epoch: approvals void, consents revalidated, nothing resumes", async () => {
  const { store, project, output } = await workspace();
  const run = await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: "framework-smoke",
  });
  const out = await output("brief");
  await advanceStage(store, {
    runId: run.id,
    stage: "research",
    status: "awaiting_human",
    outputHash: out,
  });
  await approveStage(store, {
    runId: run.id,
    stage: "research",
    outputHash: out,
    ttlMs: 3_600_000,
  });
  assert.equal((await directorNext(store, run.id)).kind, "stage");
  const consent = await grantConsent(store, consentInput);
  const home = await mkdtemp(path.join(tmpdir(), "yamakan-director-home-"));
  bases.push(home);
  const backup = await backupWorkspace(store, home);
  const restored = await restoreFromHome(home, backup.backupId);
  bases.push(restored.root);
  // The original stays live and unchanged.
  assert.equal((await directorNext(store, run.id)).kind, "stage");
  // Reopened twice (two service starts): the copy never acts on its own.
  for (let start = 0; start < 2; start++) {
    const copy = await open(restored.root);
    const copied = await loadRun(copy, run.id);
    const research = copied.receipts.find((r) => r.stage === "research")!;
    assert.equal(
      research.humanApproved,
      false,
      "the backup's approval does not count",
    );
    const next = await directorNext(copy, run.id);
    assert.equal(next.kind, "blocked");
    await refused(
      recordEncoding(copy, {
        characterId: "hero",
        purpose: "identity-encode",
        consentId: consent.id,
        provider: "local",
        method: "ref",
        payloadHash: hash("x"),
      }),
      "VALIDATION",
      /revalidated/,
    );
    assert.deepEqual(await listEncodings(copy), []);
    await copy.close();
  }
  // A human revalidates and approves again in the copy.
  const copy = await open(restored.root);
  await revalidateConsent(copy, consent.id, "browser-ui");
  const enc = await recordEncoding(copy, {
    characterId: "hero",
    purpose: "identity-encode",
    consentId: consent.id,
    provider: "local",
    method: "ref",
    payloadHash: hash("y"),
  });
  assert.equal(enc.invalidated, false);
  await approveStage(copy, {
    runId: run.id,
    stage: "research",
    outputHash: out,
    ttlMs: 60_000,
  });
  assert.equal((await directorNext(copy, run.id)).kind, "stage");
});

test("legacy Director files import once, by existing project, under a fresh epoch", async () => {
  const { root, store, project, output } = await workspace();
  const out = await output("brief");
  const dir = path.join(root, "director");
  await mkdir(dir, { recursive: true });
  const runId = randomUUID();
  const strayRun = randomUUID();
  const consentId = randomUUID();
  const revokedId = randomUUID();
  const encodingId = randomUUID();
  const receipt = (stage: string, approved: boolean) => ({
    format: "yamakan.stage-receipt",
    formatVersion: 1,
    projectId: project.id,
    pipelineName: "framework-smoke",
    stage,
    status: approved ? "completed" : "awaiting_human",
    outputHash: out,
    humanApproved: approved,
    approvalExpiresAtMs: approved ? Date.now() + 3_600_000 : null,
    approvedOutputHash: approved ? out : null,
  });
  const files: Record<string, unknown> = {
    [`run-${runId}.json`]: {
      format: "yamakan.director-run",
      formatVersion: 1,
      id: runId,
      projectId: project.id,
      pipelineName: "framework-smoke",
      receipts: [receipt("research", true)],
    },
    [`run-${strayRun}.json`]: {
      format: "yamakan.director-run",
      formatVersion: 1,
      id: strayRun,
      projectId: randomUUID(),
      pipelineName: "framework-smoke",
      receipts: [],
    },
    [`consent-${consentId}.json`]: {
      format: "yamakan.likeness-consent",
      formatVersion: 1,
      id: consentId,
      characterId: "hero",
      purpose: "identity-encode",
      version: "v1",
      grantedAtMs: Date.now(),
      expiresAtMs: Date.now() + 3_600_000,
      revokedAtMs: null,
      grantorPrincipalId: "browser-ui",
    },
    [`consent-${revokedId}.json`]: {
      format: "yamakan.likeness-consent",
      formatVersion: 1,
      id: revokedId,
      characterId: "hero",
      purpose: "identity-encode",
      version: "v1",
      grantedAtMs: Date.now(),
      expiresAtMs: Date.now() + 3_600_000,
      revokedAtMs: Date.now(),
      grantorPrincipalId: "browser-ui",
    },
    [`encoding-${encodingId}.json`]: {
      format: "yamakan.identity-encoding",
      formatVersion: 1,
      id: encodingId,
      characterId: "hero",
      provider: "local",
      method: "ref",
      payloadHash: hash("e"),
      consentId: revokedId,
      metadata: {},
      invalidated: false,
    },
    "run-not-a-uuid.json": {},
  };
  for (const [name, value] of Object.entries(files))
    await writeFile(path.join(dir, name), JSON.stringify(value));
  await writeFile(path.join(dir, `run-${randomUUID()}.json`), "{ truncated");
  const originals = await Promise.all(
    Object.keys(files).map((n) => readFile(path.join(dir, n))),
  );
  const report = await importLegacyDirector(store);
  assert.equal(report.runs, 1);
  assert.equal(report.consents, 2);
  assert.equal(report.revocations, 1);
  assert.equal(report.encodings, 1);
  assert.ok(report.epoch! > 1);
  assert.ok(
    report.skipped.some(
      (s) =>
        s.file === `run-${strayRun}.json` &&
        /not in this workspace/.test(s.reason),
    ),
  );
  assert.ok(
    report.skipped.some((s) =>
      /not a valid Director record|JSON/.test(s.reason),
    ),
  );
  // The imported approval belongs to the old epoch: the stage needs a new one.
  const imported = await loadRun(store, runId);
  assert.equal(imported.receipts[0]!.humanApproved, false);
  // The revoked consent's encoding is invalid; the live one needs revalidation.
  assert.deepEqual(
    (await listEncodings(store)).map((e) => [e.id, e.invalidated]),
    [[encodingId, true]],
  );
  await refused(
    recordEncoding(store, {
      characterId: "hero",
      purpose: "identity-encode",
      consentId,
      provider: "local",
      method: "ref",
      payloadHash: hash("n"),
    }),
    "VALIDATION",
    /revalidated/,
  );
  // Idempotent: nothing is imported twice, and no new epoch is minted.
  const again = await importLegacyDirector(store);
  assert.deepEqual(
    [
      again.runs,
      again.consents,
      again.revocations,
      again.encodings,
      again.epoch,
    ],
    [0, 0, 0, 0, null],
  );
  // Originals are untouched.
  assert.deepEqual(
    await Promise.all(
      Object.keys(files).map((n) => readFile(path.join(dir, n))),
    ),
    originals,
  );
});
