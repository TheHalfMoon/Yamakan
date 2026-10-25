// M12 / W15, YU-013: Director runs and likeness consent, durable in the
// workspace database. Every mutation is one transaction: runs advance by
// compare-and-swap on their version and keep an append-only attempt log;
// consents are immutable, revoked or revalidated by append-only rows, and an
// identity encoding is valid only while its consent is (derived, never a
// stored flag), so a revocation invalidates its encodings atomically. A
// workspace execution epoch, minted fresh by a restore or import, voids
// earlier approvals and requires restored consents to be revalidated.
// Replayed requests return their original result. The Director feature flag
// stays off for the UI.
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ProjectStore, RequestReceipt } from "../store.ts";
import { CommandError } from "../command/errors.ts";
import {
  ConsentRecordSchema,
  IdentityEncodingSchema,
  assertConsentForEncoding,
  type ConsentPurpose,
  type ConsentRecord,
  type IdentityEncoding,
} from "../identity.ts";
import {
  builtinManifest,
  stageRequiresApproval,
  type PipelineManifest,
} from "./manifest.ts";
import {
  StageReceiptSchema,
  applyApproval,
  enforceStagePrerequisites,
  nextStage,
  type DirectorRun,
  type StageReceipt,
  type StageStatus,
} from "./stages.ts";

export async function loadManifestFromAssets(
  name: string,
): Promise<PipelineManifest> {
  return builtinManifest(name);
}

/** A run as stored, with its compare-and-swap version. */
export type VersionedRun = DirectorRun & { version: number };

const epochOf = (db: DatabaseSync) =>
  (
    db
      .prepare("SELECT value FROM director_epoch WHERE singleton = 1")
      .get() as { value: number }
  ).value;

/**
 * Mints a fresh execution epoch (YU-013). Called after a restore or import,
 * before anything runs: approvals recorded under an earlier epoch no longer
 * count, and consents granted under one must be revalidated before use.
 */
export function bumpDirectorEpoch(db: DatabaseSync): number {
  db.prepare(
    "UPDATE director_epoch SET value = value + 1 WHERE singleton = 1",
  ).run();
  return epochOf(db);
}

// A replayable mutation: a retry under the same request id returns the
// stored result; the same id with a different request is refused.
function once<T>(
  db: DatabaseSync,
  receipt: RequestReceipt | undefined,
  compute: () => T,
): T {
  if (!receipt) return compute();
  const prior = db
    .prepare(
      "SELECT digest, result FROM director_requests WHERE principal_id = ? AND request_id = ?",
    )
    .get(receipt.principalId, receipt.requestId) as
    { digest: string; result: string } | undefined;
  if (prior) {
    if (prior.digest !== receipt.digest)
      throw new CommandError(
        "IDEMPOTENCY_MISMATCH",
        "Request ID was already used for a different request.",
      );
    return JSON.parse(prior.result) as T;
  }
  const result = compute();
  db.prepare(
    "INSERT INTO director_requests(principal_id, request_id, digest, result, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    receipt.principalId,
    receipt.requestId,
    receipt.digest,
    JSON.stringify(result),
    Date.now(),
  );
  return result;
}

type ConsentRow = {
  id: string;
  character_id: string;
  purpose: string;
  version: string;
  granted_at: number;
  expires_at: number;
  grantor_principal_id: string;
  epoch: number;
  revoked_at: number | null;
};

function consentRow(db: DatabaseSync, id: string): ConsentRow | undefined {
  return db
    .prepare(
      "SELECT c.*, r.revoked_at FROM likeness_consents c LEFT JOIN consent_revocations r ON r.consent_id = c.id WHERE c.id = ?",
    )
    .get(id) as ConsentRow | undefined;
}

const consentRecord = (row: ConsentRow): ConsentRecord =>
  ConsentRecordSchema.parse({
    format: "yamakan.likeness-consent",
    formatVersion: 1,
    id: row.id,
    characterId: row.character_id,
    purpose: row.purpose,
    version: row.version,
    grantedAtMs: row.granted_at,
    expiresAtMs: row.expires_at,
    revokedAtMs: row.revoked_at,
    grantorPrincipalId: row.grantor_principal_id,
  });

// Whether a consent granted under an earlier epoch was revalidated in this one.
function revalidated(db: DatabaseSync, row: ConsentRow, epoch: number) {
  return (
    row.epoch === epoch ||
    Boolean(
      db
        .prepare(
          "SELECT 1 FROM consent_revalidations WHERE consent_id = ? AND epoch = ?",
        )
        .get(row.id, epoch),
    )
  );
}

export async function grantConsent(
  store: ProjectStore,
  input: {
    characterId: string;
    purpose: ConsentPurpose;
    version: string;
    ttlMs: number;
    principalId: string;
    nowMs?: number;
  },
  receipt?: RequestReceipt,
): Promise<ConsentRecord> {
  const now = input.nowMs ?? Date.now();
  if (input.ttlMs < 60_000 || input.ttlMs > 366 * 24 * 60 * 60 * 1000)
    throw new CommandError("VALIDATION", "Consent TTL out of range.");
  const record = ConsentRecordSchema.parse({
    format: "yamakan.likeness-consent",
    formatVersion: 1,
    id: randomUUID(),
    characterId: input.characterId,
    purpose: input.purpose,
    version: input.version,
    grantedAtMs: now,
    expiresAtMs: now + input.ttlMs,
    revokedAtMs: null,
    grantorPrincipalId: input.principalId,
  });
  return store.transaction((db) =>
    once(db, receipt, () => {
      db.prepare(
        "INSERT INTO likeness_consents(id, character_id, purpose, version, granted_at, expires_at, grantor_principal_id, epoch) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        record.id,
        record.characterId,
        record.purpose,
        record.version,
        record.grantedAtMs,
        record.expiresAtMs,
        record.grantorPrincipalId,
        epochOf(db),
      );
      return record;
    }),
  );
}

/**
 * Revokes a consent, once and for good (an append-only row); its encodings
 * are invalid from the same commit, since validity is derived from it.
 */
export async function revokeConsentRecord(
  store: ProjectStore,
  consentId: string,
  nowMs = Date.now(),
  principalId = "local-client",
  receipt?: RequestReceipt,
): Promise<{ consent: ConsentRecord; encodings: IdentityEncoding[] }> {
  return store.transaction((db) =>
    once(db, receipt, () => {
      const row = consentRow(db, consentId);
      if (!row) throw new CommandError("NOT_FOUND", "Consent not found.");
      if (row.revoked_at !== null)
        throw new CommandError("VALIDATION", "Consent is already revoked.");
      db.prepare(
        "INSERT INTO consent_revocations(consent_id, revoked_at, principal_id) VALUES (?, ?, ?)",
      ).run(consentId, nowMs, principalId);
      return {
        consent: consentRecord({ ...row, revoked_at: nowMs }),
        encodings: encodingsOf(db, consentId, nowMs),
      };
    }),
  );
}

/** Revalidates a consent granted before the current epoch (after restore). */
export async function revalidateConsent(
  store: ProjectStore,
  consentId: string,
  principalId: string,
  nowMs = Date.now(),
): Promise<ConsentRecord> {
  return store.transaction((db) => {
    const row = consentRow(db, consentId);
    if (!row) throw new CommandError("NOT_FOUND", "Consent not found.");
    if (row.revoked_at !== null)
      throw new CommandError(
        "VALIDATION",
        "A revoked consent cannot be revalidated.",
      );
    db.prepare(
      "INSERT INTO consent_revalidations(consent_id, epoch, revalidated_at, principal_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    ).run(consentId, epochOf(db), nowMs, principalId);
    return consentRecord(row);
  });
}

type EncodingRow = {
  id: string;
  character_id: string;
  consent_id: string;
  provider: string;
  method: string;
  payload_hash: string;
  revoked_at: number | null;
  expires_at: number;
};

function encodingFrom(row: EncodingRow, nowMs: number): IdentityEncoding {
  return IdentityEncodingSchema.parse({
    format: "yamakan.identity-encoding",
    formatVersion: 1,
    id: row.id,
    characterId: row.character_id,
    provider: row.provider,
    method: row.method,
    payloadHash: row.payload_hash,
    consentId: row.consent_id,
    metadata: {},
    // Derived: a revoked or expired consent invalidates its encodings.
    invalidated: row.revoked_at !== null || nowMs >= row.expires_at,
  });
}

function encodingsOf(
  db: DatabaseSync,
  consentId: string | null,
  nowMs: number,
) {
  const rows = db
    .prepare(
      `SELECT e.*, r.revoked_at, c.expires_at FROM identity_encodings e JOIN likeness_consents c ON c.id = e.consent_id LEFT JOIN consent_revocations r ON r.consent_id = e.consent_id${consentId ? " WHERE e.consent_id = ?" : ""} ORDER BY e.created_at, e.id`,
    )
    .all(...(consentId ? [consentId] : [])) as EncodingRow[];
  return rows.map((r) => encodingFrom(r, nowMs));
}

export async function listEncodings(
  store: ProjectStore,
  nowMs = Date.now(),
): Promise<IdentityEncoding[]> {
  return store.read((db) => encodingsOf(db, null, nowMs));
}

export async function recordEncoding(
  store: ProjectStore,
  input: {
    characterId: string;
    purpose: ConsentPurpose;
    consentId: string;
    provider: string;
    method: string;
    payloadHash: string;
    nowMs?: number;
  },
  receipt?: RequestReceipt,
): Promise<IdentityEncoding> {
  const now = input.nowMs ?? Date.now();
  return store.transaction((db) =>
    once(db, receipt, () => {
      // Checked in the same transaction as the insert: a revocation either
      // came first (refused here) or invalidates this encoding after.
      const row = consentRow(db, input.consentId);
      const consent = assertConsentForEncoding(
        row ? consentRecord(row) : null,
        { characterId: input.characterId, purpose: input.purpose, nowMs: now },
      );
      if (row && !revalidated(db, row, epochOf(db)))
        throw new CommandError(
          "VALIDATION",
          "This consent predates a restore and must be revalidated before use.",
        );
      const encoding = IdentityEncodingSchema.parse({
        format: "yamakan.identity-encoding",
        formatVersion: 1,
        id: randomUUID(),
        characterId: input.characterId,
        provider: input.provider,
        method: input.method,
        payloadHash: input.payloadHash,
        consentId: consent.id,
        metadata: {},
        invalidated: false,
      });
      db.prepare(
        "INSERT INTO identity_encodings(id, character_id, consent_id, provider, method, payload_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        encoding.id,
        encoding.characterId,
        encoding.consentId,
        encoding.provider,
        encoding.method,
        encoding.payloadHash,
        now,
      );
      return encoding;
    }),
  );
}

type AttemptRow = {
  seq: number;
  stage: string;
  kind: "advance" | "approve";
  status: StageStatus;
  output_hash: string | null;
  approval_expires_at: number | null;
  epoch: number;
};

// A run's receipts: each stage's latest attempt. An approval counts only in
// the epoch it was given in.
function runFrom(
  db: DatabaseSync,
  row: {
    id: string;
    project_id: string;
    pipeline_name: string;
    version: number;
  },
): VersionedRun {
  const epoch = epochOf(db);
  const attempts = db
    .prepare(
      "SELECT seq, stage, kind, status, output_hash, approval_expires_at, epoch FROM director_attempts WHERE run_id = ? ORDER BY seq",
    )
    .all(row.id) as AttemptRow[];
  const latest = new Map<string, AttemptRow>();
  for (const a of attempts) latest.set(a.stage, a);
  const receipts: StageReceipt[] = [...latest.values()].map((a) => {
    const approved = a.kind === "approve" && a.epoch === epoch;
    return StageReceiptSchema.parse({
      format: "yamakan.stage-receipt",
      formatVersion: 1,
      projectId: row.project_id,
      pipelineName: row.pipeline_name,
      stage: a.stage,
      // An approval from before a restore no longer completes its stage.
      status: a.kind === "approve" && !approved ? "awaiting_human" : a.status,
      outputHash: a.output_hash,
      humanApproved: approved,
      approvalExpiresAtMs: approved ? a.approval_expires_at : null,
      approvedOutputHash: approved ? a.output_hash : null,
    });
  });
  return {
    format: "yamakan.director-run",
    formatVersion: 1,
    id: row.id,
    projectId: row.project_id,
    pipelineName: row.pipeline_name,
    receipts,
    version: row.version,
  };
}

function runRow(db: DatabaseSync, runId: string) {
  const row = db
    .prepare(
      "SELECT id, project_id, pipeline_name, version FROM director_runs WHERE id = ?",
    )
    .get(runId) as
    | { id: string; project_id: string; pipeline_name: string; version: number }
    | undefined;
  if (!row) throw new CommandError("NOT_FOUND", "Director run not found.");
  return row;
}

function assertVersion(
  row: { version: number },
  expectedVersion: number | undefined,
) {
  if (expectedVersion !== undefined && expectedVersion !== row.version)
    throw new CommandError(
      "REVISION_CONFLICT",
      "The Director run changed; reload it before acting.",
    );
}

function appendAttempt(
  db: DatabaseSync,
  run: { id: string; version: number },
  attempt: {
    stage: string;
    kind: "advance" | "approve";
    status: StageStatus;
    outputHash: string | null;
    approvalExpiresAt: number | null;
    principalId: string;
    now: number;
  },
) {
  const seq = run.version;
  db.prepare(
    "INSERT INTO director_attempts(run_id, seq, stage, kind, status, output_hash, approval_expires_at, epoch, principal_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    run.id,
    seq,
    attempt.stage,
    attempt.kind,
    attempt.status,
    attempt.outputHash,
    attempt.approvalExpiresAt,
    epochOf(db),
    attempt.principalId,
    attempt.now,
  );
  // The version moves only if nobody moved it meanwhile.
  const moved = db
    .prepare(
      "UPDATE director_runs SET version = version + 1 WHERE id = ? AND version = ?",
    )
    .run(run.id, run.version);
  if (moved.changes !== 1)
    throw new CommandError(
      "REVISION_CONFLICT",
      "The Director run changed; reload it before acting.",
    );
}

// An output a stage names must be a managed object of the run's project:
// hashes are verified against what the workspace actually holds.
function assertManagedOutput(
  db: DatabaseSync,
  projectId: string,
  outputHash: string,
) {
  const held = db
    .prepare(
      "SELECT 1 FROM asset_objects WHERE project_id = ? AND digest = ? AND state = 'ready'",
    )
    .get(projectId, outputHash);
  if (!held)
    throw new CommandError(
      "VALIDATION",
      "The stage output is not a stored object of this project.",
    );
}

export async function startDirectorRun(
  store: ProjectStore,
  input: { projectId: string; pipelineName: string; principalId?: string },
  receipt?: RequestReceipt,
): Promise<VersionedRun> {
  const manifest = await loadManifestFromAssets(input.pipelineName);
  // The run belongs to an existing project.
  await store.load(input.projectId);
  return store.transaction((db) =>
    once(db, receipt, () => {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO director_runs(id, project_id, pipeline_name, version, created_at, created_by) VALUES (?, ?, ?, 1, ?, ?)",
      ).run(
        id,
        input.projectId,
        manifest.name,
        Date.now(),
        input.principalId ?? "local-client",
      );
      return runFrom(db, runRow(db, id));
    }),
  );
}

export async function loadRun(
  store: ProjectStore,
  runId: string,
): Promise<VersionedRun> {
  return store.read((db) => runFrom(db, runRow(db, runId)));
}

export async function advanceStage(
  store: ProjectStore,
  input: {
    runId: string;
    stage: string;
    status: StageStatus;
    outputHash: string | null;
    expectedVersion?: number;
    principalId?: string;
    nowMs?: number;
  },
  receipt?: RequestReceipt,
): Promise<VersionedRun> {
  const now = input.nowMs ?? Date.now();
  const pipeline = store.read((db) => runRow(db, input.runId).pipeline_name);
  const manifest = await loadManifestFromAssets(pipeline);
  return store.transaction((db) =>
    once(db, receipt, () => {
      const row = runRow(db, input.runId);
      assertVersion(row, input.expectedVersion);
      const run = runFrom(db, row);
      const existing = run.receipts.find((r) => r.stage === input.stage);
      if (
        existing?.humanApproved &&
        existing.outputHash &&
        existing.outputHash === input.outputHash
      )
        throw new CommandError(
          "VALIDATION",
          "Cannot rewrite a stage that already has a valid human approval for this output.",
        );
      if (
        stageRequiresApproval(manifest, input.stage) &&
        input.status === "completed"
      )
        throw new CommandError(
          "VALIDATION",
          "Approval-required stages complete only through yamakan.director.approve.",
        );
      enforceStagePrerequisites(manifest, run, input.stage, input.status, now);
      if (input.outputHash)
        assertManagedOutput(db, row.project_id, input.outputHash);
      appendAttempt(db, row, {
        stage: input.stage,
        kind: "advance",
        status: input.status,
        outputHash: input.outputHash,
        approvalExpiresAt: null,
        principalId: input.principalId ?? "local-client",
        now,
      });
      return runFrom(db, runRow(db, input.runId));
    }),
  );
}

export async function approveStage(
  store: ProjectStore,
  input: {
    runId: string;
    stage: string;
    outputHash: string;
    ttlMs: number;
    expectedVersion?: number;
    principalId?: string;
    nowMs?: number;
  },
  receipt?: RequestReceipt,
): Promise<VersionedRun> {
  const now = input.nowMs ?? Date.now();
  return store.transaction((db) =>
    once(db, receipt, () => {
      const row = runRow(db, input.runId);
      assertVersion(row, input.expectedVersion);
      const run = runFrom(db, row);
      const current = run.receipts.find((r) => r.stage === input.stage);
      if (!current)
        throw new CommandError("NOT_FOUND", "Stage receipt not found.");
      // Validates the hash binding and expiry (core/director/stages.ts).
      const approved = applyApproval(current, {
        outputHash: input.outputHash,
        nowMs: now,
        expiresAtMs: now + input.ttlMs,
      });
      assertManagedOutput(db, row.project_id, input.outputHash);
      appendAttempt(db, row, {
        stage: input.stage,
        kind: "approve",
        status: approved.status,
        outputHash: input.outputHash,
        approvalExpiresAt: approved.approvalExpiresAtMs,
        principalId: input.principalId ?? "browser-ui",
        now,
      });
      return runFrom(db, runRow(db, input.runId));
    }),
  );
}

export async function directorNext(
  store: ProjectStore,
  runId: string,
  nowMs = Date.now(),
): Promise<ReturnType<typeof nextStage>> {
  const run = await loadRun(store, runId);
  const manifest = await loadManifestFromAssets(run.pipelineName);
  return nextStage(manifest, run, nowMs);
}
