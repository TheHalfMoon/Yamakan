import {
  access,
  lstat,
  mkdir,
  open,
  readdir,
  unlink,
  statfs,
} from "node:fs/promises";
import { createReadStream, statfsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import {
  ProjectSchema,
  Id,
  AssetSchema,
  createProject,
  frameRateOf,
} from "./project.ts";
import type { Rational } from "./time.ts";
import {
  EFFECTS_OFF,
  clipLut,
  effectWritesEnabled,
} from "./effects/registry.ts";
import { TRANSITIONS_OFF, transitionWritesEnabled } from "./transitions.ts";

import type { Project, Asset } from "./project.ts";
import { safePath, initializeRoot } from "./paths.ts";
import {
  durationFramesAt,
  mediaHeader,
  MAX_ASSET_BYTES,
  probe,
  verifyAndProbe,
} from "./media.ts";
import {
  isHiddenVfrOriginal,
  referencedDigestsInRetention,
} from "./recovery.ts";
import { LocalContentAddressedStorage } from "./storage/storage.ts";
import { CommandError } from "./command/errors.ts";
import {
  FORMAT,
  LATEST_FORMAT_VERSION,
  fromEditView,
  inspectFormat,
  parseCanonical,
  serializeCanonical,
  toEditView,
} from "./canonical.ts";
import {
  DOCUMENT_LIMITS,
  DocumentKind,
  DocumentRefSchema,
  missingDocumentAssets,
  validateDocument,
} from "./documents.ts";
import type { DocumentRef } from "./documents.ts";
import type { CommitContext as DocumentCommitContext } from "./story.ts";
import { assertPlacementConsent } from "./continuity.ts";
import { assertStudioImageLimits } from "./studio.ts";

// A sealed staged upload as clients see it: never a host path.
export type StagedDocumentReceipt = {
  stagedUploadId: string;
  contentHash: string;
  byteLength: number;
  kind: DocumentKind;
  schemaVersion: number;
  expiresAt: string;
};
type UploadRow = {
  id: string;
  request_digest: string;
  kind: DocumentKind;
  schema_version: number;
  declared_bytes: number;
  body_sha256: string;
  state: "receiving" | "sealed" | "consumed";
  content_hash: string | null;
  bytes: Uint8Array | null;
  expires_at: number;
};
const uploadReceipt = (row: UploadRow): StagedDocumentReceipt => ({
  stagedUploadId: row.id,
  contentHash: row.content_hash!,
  // The stored canonical document's length, which contentHash names.
  byteLength: row.bytes ? row.bytes.byteLength : row.declared_bytes,
  kind: row.kind,
  schemaVersion: row.schema_version,
  expiresAt: new Date(row.expires_at).toISOString(),
});

// Width and height from a PNG signature and IHDR chunk, within Studio limits.
function pngSize(head: Buffer): { width: number; height: number } {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (
    !head.subarray(0, 8).equals(signature) ||
    head.readUInt32BE(8) !== 13 ||
    head.subarray(12, 16).toString("latin1") !== "IHDR"
  )
    throw new CommandError("VALIDATION", "A Studio bitmap must be a PNG.");
  const width = head.readUInt32BE(16);
  const height = head.readUInt32BE(20);
  assertStudioImageLimits(width, height);
  return { width, height };
}

export type ExportedProject = Omit<CanonicalProject, "documents"> & {
  documents?: DocumentRef[];
};
import type { CanonicalProject } from "./canonical.ts";
import { applyBatch } from "./timeline/operations.ts";
import type { Operation } from "./timeline/operations.ts";
import { RESOURCE_POLICY } from "./command/policy.ts";
import { inspectWal } from "./wal.ts";
import type { Scope } from "./command/registry.ts";
import type { Principal } from "./command/registry.ts";
import {
  encodeAgentScopes,
  hashAgentToken,
  newAgentId,
  newAgentToken,
  parseAgentScopes,
} from "./agents.ts";

export type ProjectHistory = {
  projectId: string;
  headFingerprint: string | null;
  currentRevision: number | null;
  snapshots: {
    revision: number;
    name: string | null;
    verified: boolean;
    error: string | null;
  }[];
};

// Identifies a client request for idempotent replay (operational contracts,
// "Commit algorithm"). The digest covers the operation and its complete input.
export type RequestReceipt = {
  principalId: string;
  requestId: string;
  digest: string;
};

export type FaultPoint =
  | "stage-write"
  | "stage-publish"
  | "after-snapshot-insert"
  | "before-commit"
  | "after-commit";
export type RecoveryFaultPoint =
  "after-recovery-effect" | "before-recovery-receipt";
export type StoreOptions = {
  fault?: (point: FaultPoint) => void;
  recoveryFault?: (point: RecoveryFaultPoint) => void;
  // Test seam: can only lower the policy's snapshot byte limit.
  snapshotBytes?: number;
  // Test seam: can only shorten the 60 s grace added to every upload deadline.
  uploadGraceMs?: number;
  // Test seam: the free bytes a commit sees (default: the volume's, statfs).
  freeBytes?: () => number;
  // Test seam: awaited while Studio bitmap collection holds the discard
  // mark, before it unlinks (lets a test race an upload against it).
  studioCollectionPause?: () => Promise<void>;
};

// Snapshots hold canonical project bytes (core/canonical.ts). Snapshots that
// T2 builds stored in the 30 fps editing shape are upgraded on read by the
// same pure, lossless conversion; they are never rewritten in place.
export const SNAPSHOT_FORMAT = "yamakan.project/2";
export const EDIT_VIEW_FORMAT = "yamakan.edit-view/1";
const MAX_REVISION = 10000;
export const WORKSPACE_SCHEMA_VERSION = 15;
const SCHEMA_VERSION = WORKSPACE_SCHEMA_VERSION;
const WORKSPACE_SCOPE = "";

// Asset objects are content-addressed files under a project; a version is a
// project's logical asset bound to one verified object plus its probe.
const SCHEMA_V2 = `
CREATE TABLE asset_objects(
  project_id TEXT NOT NULL,
  digest TEXT NOT NULL CHECK(length(digest) = 64),
  byte_length INTEGER NOT NULL CHECK(byte_length > 0),
  state TEXT NOT NULL CHECK(state IN ('ready', 'gcPending', 'quarantined')),
  generation INTEGER NOT NULL CHECK(generation > 0),
  PRIMARY KEY(project_id, digest)
) STRICT;
CREATE TABLE asset_versions(
  version_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  probe TEXT,
  FOREIGN KEY(project_id, digest) REFERENCES asset_objects(project_id, digest)
) STRICT;
-- Work that must finish after this step; cleared in the work's own transaction.
CREATE TABLE pending_work(name TEXT PRIMARY KEY) STRICT;
INSERT INTO pending_work(name) VALUES ('asset-backfill');
`;
// Durable jobs (T5): intent in jobs, execution identity in attempts, and one
// supervisor generation that fences attempts from an earlier service run.
const SCHEMA_V3 = `
CREATE TABLE jobs(
  job_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  project_id TEXT NOT NULL,
  frozen_revision INTEGER NOT NULL CHECK(frozen_revision >= 0),
  idempotency_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued', 'preparing', 'running', 'validating', 'succeeded', 'cancelRequested', 'cancelled', 'failed', 'reconciliationRequired')),
  cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK(cancel_requested IN (0, 1)),
  progress REAL NOT NULL DEFAULT 0,
  error TEXT,
  artifact TEXT,
  UNIQUE(project_id, kind, frozen_revision, idempotency_key)
) STRICT;
CREATE INDEX jobs_active ON jobs(state) WHERE state NOT IN ('succeeded', 'cancelled', 'failed', 'reconciliationRequired');
CREATE TABLE attempts(
  job_id TEXT NOT NULL REFERENCES jobs(job_id),
  attempt_no INTEGER NOT NULL CHECK(attempt_no > 0),
  generation INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('preparing', 'running', 'validating', 'succeeded', 'cancelled', 'failed')),
  pid INTEGER,
  exit_code INTEGER,
  error TEXT,
  PRIMARY KEY(job_id, attempt_no)
) STRICT;
CREATE TABLE supervisor(
  id INTEGER PRIMARY KEY CHECK(id = 1),
  generation INTEGER NOT NULL
) STRICT;
INSERT INTO supervisor(id, generation) VALUES (1, 0);
`;
// Revision-bound undo/redo (T6): each applied batch records the revision it
// produced, the revision it started from and the principal that wrote it;
// the cursor binds undo/redo to the exact head they were computed for, and
// only the writer of a step may undo or redo it.
// Render plans (T7): a succeeded job names the plan it rendered, and its
// attempt keeps the output receipt (plan hash, probed size, frames, audio).
const SCHEMA_V5 = `
ALTER TABLE jobs ADD COLUMN plan_hash TEXT CHECK(plan_hash IS NULL OR length(plan_hash) = 64);
ALTER TABLE attempts ADD COLUMN receipt TEXT;
`;
// Replay-safe workspace backup/restore (W2): result stored with the request digest.
const SCHEMA_V6 = `
CREATE TABLE recovery_receipts(
  principal_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(length(operation) BETWEEN 1 AND 80),
  request_id TEXT NOT NULL CHECK(length(request_id) BETWEEN 1 AND 80),
  request_digest TEXT NOT NULL CHECK(length(request_digest) = 64),
  effect_ref TEXT NOT NULL,
  result_json TEXT,
  PRIMARY KEY(principal_id, operation, request_id)
) STRICT;
`;
const SCHEMA_V7 = `
CREATE TABLE agent_tokens(
  agent_id TEXT PRIMARY KEY CHECK(agent_id GLOB 'agent:*'),
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash) = 64),
  scopes TEXT NOT NULL,
  label TEXT,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;
`;
// Creative documents (YU-010, AG-DOCS): immutable canonical document bytes
// and which snapshot references which document. A document is named by the
// hash of its bytes; asset_ids lists the project assets it needs, so every
// commit can keep them in the project without re-parsing the document.
const SCHEMA_V8 = `
CREATE TABLE creative_documents(
  hash TEXT PRIMARY KEY CHECK(length(hash) = 64),
  kind TEXT NOT NULL CHECK(kind IN ('studio', 'cinemaScene')),
  schema_version INTEGER NOT NULL CHECK(schema_version > 0),
  asset_ids TEXT NOT NULL,
  bytes BLOB NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length = length(bytes))
) STRICT;
CREATE TABLE snapshot_document_refs(
  snapshot_hash TEXT NOT NULL REFERENCES snapshots(hash),
  document_hash TEXT NOT NULL REFERENCES creative_documents(hash),
  PRIMARY KEY(snapshot_hash, document_hash)
) STRICT, WITHOUT ROWID;
CREATE INDEX snapshot_document_refs_by_document ON snapshot_document_refs(document_hash);
`;
// Staged creative document uploads (YU-010b): a reservation, then the
// sealed canonical bytes, held in the database (never a host path) until
// one document commit consumes them or they expire.
const SCHEMA_V9 = `
CREATE TABLE document_uploads(
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  project_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  request_id TEXT NOT NULL CHECK(length(request_id) BETWEEN 1 AND 128),
  request_digest TEXT NOT NULL CHECK(length(request_digest) = 64),
  kind TEXT NOT NULL CHECK(kind IN ('studio', 'cinemaScene')),
  schema_version INTEGER NOT NULL CHECK(schema_version > 0),
  declared_bytes INTEGER NOT NULL CHECK(declared_bytes > 0),
  body_sha256 TEXT NOT NULL CHECK(length(body_sha256) = 64),
  state TEXT NOT NULL CHECK(state IN ('receiving', 'sealed', 'consumed')),
  content_hash TEXT CHECK(content_hash IS NULL OR length(content_hash) = 64),
  asset_ids TEXT,
  bytes BLOB,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_revision INTEGER,
  UNIQUE(principal_id, project_id, request_id)
) STRICT;
`;
// Studio bitmaps (YU-011): which content-addressed objects of a project are
// Studio layer bitmaps, and the bitmaps each stored document names.
const SCHEMA_V10 = `
CREATE TABLE studio_bitmaps(
  project_id TEXT NOT NULL,
  digest TEXT NOT NULL CHECK(length(digest) = 64),
  byte_length INTEGER NOT NULL CHECK(byte_length > 0),
  width INTEGER NOT NULL CHECK(width > 0),
  height INTEGER NOT NULL CHECK(height > 0),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(project_id, digest)
) STRICT;
ALTER TABLE creative_documents ADD COLUMN object_digests TEXT NOT NULL DEFAULT '[]';
ALTER TABLE document_uploads ADD COLUMN object_digests TEXT;
`;
// Legacy migrations (YU-012): which legacy source (a workspace Cinema
// sidecar, by its scene id and the SHA-256 of its bytes) became which
// project's document, at which revision. Written in the commit's own
// transaction; a source is assigned to one project only.
const SCHEMA_V11 = `
CREATE TABLE legacy_migrations(
  source_kind TEXT NOT NULL CHECK(source_kind IN ('cinema-sidecar')),
  source_name TEXT NOT NULL CHECK(length(source_name) BETWEEN 1 AND 64),
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256) = 64),
  source_bytes INTEGER NOT NULL CHECK(source_bytes > 0),
  project_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK(length(content_hash) = 64),
  revision INTEGER NOT NULL CHECK(revision > 0),
  migrated_at INTEGER NOT NULL,
  PRIMARY KEY(source_kind, source_name, source_sha256, project_id, revision)
) STRICT;
`;
// Director durability (YU-013): runs with a compare-and-swap version, an
// append-only attempt log (advances and approvals), immutable likeness
// consents with append-only revocations and revalidations, identity
// encodings whose validity is derived (never a stored flag), replayable
// request results, and the workspace's execution epoch (a fresh one after a
// restore or import invalidates approvals and requires consent revalidation).
const SCHEMA_V12 = `
CREATE TABLE director_epoch(
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  value INTEGER NOT NULL CHECK(value > 0)
) STRICT;
INSERT INTO director_epoch(singleton, value) VALUES (1, 1);
CREATE TABLE director_runs(
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  pipeline_name TEXT NOT NULL CHECK(length(pipeline_name) BETWEEN 1 AND 80),
  version INTEGER NOT NULL CHECK(version > 0),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
) STRICT;
CREATE TABLE director_attempts(
  run_id TEXT NOT NULL REFERENCES director_runs(id),
  seq INTEGER NOT NULL CHECK(seq > 0),
  stage TEXT NOT NULL CHECK(length(stage) BETWEEN 1 AND 80),
  kind TEXT NOT NULL CHECK(kind IN ('advance', 'approve')),
  status TEXT NOT NULL,
  output_hash TEXT CHECK(output_hash IS NULL OR length(output_hash) = 64),
  approval_expires_at INTEGER,
  epoch INTEGER NOT NULL,
  principal_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY(run_id, seq)
) STRICT;
CREATE TABLE likeness_consents(
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL CHECK(length(character_id) BETWEEN 1 AND 80),
  purpose TEXT NOT NULL,
  version TEXT NOT NULL CHECK(length(version) BETWEEN 1 AND 40),
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  grantor_principal_id TEXT NOT NULL,
  epoch INTEGER NOT NULL
) STRICT;
CREATE TABLE consent_revocations(
  consent_id TEXT PRIMARY KEY REFERENCES likeness_consents(id),
  revoked_at INTEGER NOT NULL,
  principal_id TEXT NOT NULL
) STRICT;
CREATE TABLE consent_revalidations(
  consent_id TEXT NOT NULL REFERENCES likeness_consents(id),
  epoch INTEGER NOT NULL,
  revalidated_at INTEGER NOT NULL,
  principal_id TEXT NOT NULL,
  PRIMARY KEY(consent_id, epoch)
) STRICT;
CREATE TABLE identity_encodings(
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  consent_id TEXT NOT NULL REFERENCES likeness_consents(id),
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64),
  created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE director_requests(
  principal_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  result TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(principal_id, request_id)
) STRICT;
`;
// Story documents and reference packs (YU-031): the two document tables
// accept the new kinds, and each story or pack version is recorded under
// its document id when it is committed (so a pin is one indexed lookup). SQLite cannot alter a CHECK, so each table is
// rebuilt with the same columns and rows (foreign keys are checked after,
// in the same transaction).
// YU-025: provenance of each approved source replacement (relink): the
// revision it made and the two media versions it swapped.
const SCHEMA_V15 = `
CREATE TABLE asset_replacements(
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  from_asset_id TEXT NOT NULL CHECK(length(from_asset_id) = 36),
  from_hash TEXT NOT NULL CHECK(length(from_hash) = 64),
  to_asset_id TEXT NOT NULL CHECK(length(to_asset_id) = 36),
  to_hash TEXT NOT NULL CHECK(length(to_hash) = 64),
  clips INTEGER NOT NULL CHECK(clips > 0),
  principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 64),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(project_id, revision)
) STRICT;
CREATE INDEX IF NOT EXISTS jobs_batch ON jobs(json_extract(payload, '$.batchId')) WHERE kind = 'export' AND json_valid(payload);
`;
// Caption tracks (YU-024): the document tables accept any kind name the
// application validates (DocumentKind), so a new kind needs no further
// rebuild. Same columns and rows; foreign keys checked after.
const SCHEMA_V14 = `
CREATE TABLE creative_documents_v14(
  hash TEXT PRIMARY KEY CHECK(length(hash) = 64),
  kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 32 AND kind NOT GLOB '*[^A-Za-z]*'),
  schema_version INTEGER NOT NULL CHECK(schema_version > 0),
  asset_ids TEXT NOT NULL,
  bytes BLOB NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length = length(bytes)),
  object_digests TEXT NOT NULL DEFAULT '[]'
) STRICT;
INSERT INTO creative_documents_v14(hash, kind, schema_version, asset_ids, bytes, byte_length, object_digests)
  SELECT hash, kind, schema_version, asset_ids, bytes, byte_length, object_digests FROM creative_documents;
DROP TABLE creative_documents;
ALTER TABLE creative_documents_v14 RENAME TO creative_documents;
CREATE TABLE document_uploads_v14(
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  project_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  request_id TEXT NOT NULL CHECK(length(request_id) BETWEEN 1 AND 128),
  request_digest TEXT NOT NULL CHECK(length(request_digest) = 64),
  kind TEXT NOT NULL CHECK(length(kind) BETWEEN 1 AND 32 AND kind NOT GLOB '*[^A-Za-z]*'),
  schema_version INTEGER NOT NULL CHECK(schema_version > 0),
  declared_bytes INTEGER NOT NULL CHECK(declared_bytes > 0),
  body_sha256 TEXT NOT NULL CHECK(length(body_sha256) = 64),
  state TEXT NOT NULL CHECK(state IN ('receiving', 'sealed', 'consumed')),
  content_hash TEXT CHECK(content_hash IS NULL OR length(content_hash) = 64),
  asset_ids TEXT,
  bytes BLOB,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_revision INTEGER,
  object_digests TEXT,
  UNIQUE(principal_id, project_id, request_id)
) STRICT;
INSERT INTO document_uploads_v14 SELECT id, project_id, principal_id, request_id, request_digest, kind, schema_version, declared_bytes, body_sha256, state, content_hash, asset_ids, bytes, created_at, expires_at, consumed_revision, object_digests FROM document_uploads;
DROP TABLE document_uploads;
ALTER TABLE document_uploads_v14 RENAME TO document_uploads;
`;
const SCHEMA_V13 = `
CREATE TABLE creative_documents_v13(
  hash TEXT PRIMARY KEY CHECK(length(hash) = 64),
  kind TEXT NOT NULL CHECK(kind IN ('studio', 'cinemaScene', 'story', 'referencePack')),
  schema_version INTEGER NOT NULL CHECK(schema_version > 0),
  asset_ids TEXT NOT NULL,
  bytes BLOB NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length = length(bytes)),
  object_digests TEXT NOT NULL DEFAULT '[]'
) STRICT;
INSERT INTO creative_documents_v13(hash, kind, schema_version, asset_ids, bytes, byte_length, object_digests)
  SELECT hash, kind, schema_version, asset_ids, bytes, byte_length, object_digests FROM creative_documents;
DROP TABLE creative_documents;
ALTER TABLE creative_documents_v13 RENAME TO creative_documents;
CREATE TABLE document_uploads_v13(
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  project_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  request_id TEXT NOT NULL CHECK(length(request_id) BETWEEN 1 AND 128),
  request_digest TEXT NOT NULL CHECK(length(request_digest) = 64),
  kind TEXT NOT NULL CHECK(kind IN ('studio', 'cinemaScene', 'story', 'referencePack')),
  schema_version INTEGER NOT NULL CHECK(schema_version > 0),
  declared_bytes INTEGER NOT NULL CHECK(declared_bytes > 0),
  body_sha256 TEXT NOT NULL CHECK(length(body_sha256) = 64),
  state TEXT NOT NULL CHECK(state IN ('receiving', 'sealed', 'consumed')),
  content_hash TEXT CHECK(content_hash IS NULL OR length(content_hash) = 64),
  asset_ids TEXT,
  bytes BLOB,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_revision INTEGER,
  object_digests TEXT,
  UNIQUE(principal_id, project_id, request_id)
) STRICT;
INSERT INTO document_uploads_v13 SELECT id, project_id, principal_id, request_id, request_digest, kind, schema_version, declared_bytes, body_sha256, state, content_hash, asset_ids, bytes, created_at, expires_at, consumed_revision, object_digests FROM document_uploads;
DROP TABLE document_uploads;
ALTER TABLE document_uploads_v13 RENAME TO document_uploads;
CREATE TABLE story_document_versions(
  project_id TEXT NOT NULL,
  document_id TEXT NOT NULL CHECK(length(document_id) = 36),
  content_hash TEXT NOT NULL REFERENCES creative_documents(hash),
  revision INTEGER NOT NULL CHECK(revision > 0),
  PRIMARY KEY(project_id, document_id, content_hash)
) STRICT, WITHOUT ROWID;
`;
const SCHEMA_V4 = `
CREATE TABLE edit_history(
  project_id TEXT NOT NULL,
  seq INTEGER NOT NULL CHECK(seq > 0),
  revision INTEGER NOT NULL,
  before_revision INTEGER NOT NULL,
  author TEXT NOT NULL CHECK(length(author) BETWEEN 1 AND 64),
  PRIMARY KEY(project_id, seq)
) STRICT;
CREATE TABLE edit_cursor(
  project_id TEXT PRIMARY KEY,
  cursor INTEGER NOT NULL CHECK(cursor >= 0),
  head_revision INTEGER NOT NULL
) STRICT;
`;
const SCHEMA = `
CREATE TABLE snapshots(
  hash TEXT PRIMARY KEY CHECK(length(hash) = 64),
  format TEXT NOT NULL,
  bytes BLOB NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length = length(bytes))
) STRICT;
CREATE TABLE projects(
  project_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  snapshot_hash TEXT NOT NULL REFERENCES snapshots(hash)
) STRICT;
CREATE TABLE command_receipts(
  id INTEGER PRIMARY KEY,
  principal_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  committed_revision INTEGER NOT NULL,
  UNIQUE(principal_id, project_id, request_id)
) STRICT;
CREATE TABLE revisions(
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  revision INTEGER NOT NULL CHECK(revision >= 0),
  snapshot_hash TEXT NOT NULL REFERENCES snapshots(hash),
  parent_revision INTEGER,
  operation TEXT NOT NULL,
  receipt_id INTEGER REFERENCES command_receipts(id),
  PRIMARY KEY(project_id, revision)
) STRICT;
CREATE TABLE outbox(
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  operation TEXT NOT NULL
) STRICT;
`;

type Head = { revision: number; snapshot_hash: string };
// Agents may fill at most half of a workspace budget, so the person (the
// browser session, the local CLI and SDK) always keeps the other half.
const budgetFor = (budget: number, principalId: string | undefined) =>
  principalId?.startsWith("agent:") ? Math.floor(budget / 2) : budget;
// A new stored document must fit the workspace's document budget; one
// already stored (by hash) costs nothing more.
function withinDocumentBudget(
  db: DatabaseSync,
  hash: string,
  bytes: number,
  principalId: string | undefined,
) {
  if (db.prepare("SELECT 1 FROM creative_documents WHERE hash = ?").get(hash))
    return;
  const used = (
    db
      .prepare(
        "SELECT coalesce(sum(byte_length), 0) AS n FROM creative_documents",
      )
      .get() as { n: number }
  ).n;
  if (
    used + bytes >
    budgetFor(DOCUMENT_LIMITS.workspaceDocumentBytes, principalId)
  )
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "The workspace's creative document space is full; stored versions are kept by project history and are not yet pruned.",
    );
}
type Commit = {
  operation: string;
  projectId: string;
  // null: apply to whatever head is current (commutative appends such as asset import).
  expectedRevision: number | null;
  receipt?: RequestReceipt;
  // Precondition evaluated inside the transaction, before any write.
  check?: (head: Head) => void;
  // Extra rows written in the same transaction, before the snapshot.
  effects?: (db: DatabaseSync, revision: number) => void;
  // Project language for the new snapshot; defaults to the current head's.
  language?: () => CanonicalProject["language"];
  // Document references of the new snapshot; defaults to the head's, so
  // every save path through the editing shape keeps them (YU-010).
  // The head's references are decoded only on request: restore must be able
  // to replace a head whose snapshot no longer verifies.
  documents?: (head: () => DocumentRef[]) => DocumentRef[];
  next: (current: () => Project, revision: number) => Project;
};

// Integrity, version and ownership checks, run read-only before any write.
function acceptable(db: DatabaseSync): number {
  const integrity = db.prepare("PRAGMA quick_check").all();
  if (
    integrity.length !== 1 ||
    (integrity[0] as { quick_check: string }).quick_check !== "ok"
  )
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "Workspace database failed its integrity check; restore a verified backup to a new root.",
    );
  const { user_version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (user_version > SCHEMA_VERSION)
    throw new CommandError(
      "RECOVERY_REQUIRED",
      `Workspace database version ${user_version} is newer than this build supports.`,
    );
  if (
    user_version === 0 &&
    (
      db.prepare("SELECT count(*) AS n FROM sqlite_schema").get() as {
        n: number;
      }
    ).n !== 0
  )
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "workspace.sqlite is not a Yamakan workspace database.",
    );
  return user_version;
}

// Registers a verified, published object and the asset version bound to it.
// Called only inside a commit transaction, after publication.
function registerAsset(
  db: DatabaseSync,
  projectId: string,
  asset: { id: string; hash: string; bytes: number },
  probe: string | null,
) {
  db.prepare(
    "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, ?, 'ready', 1) ON CONFLICT(project_id, digest) DO NOTHING",
  ).run(projectId, asset.hash, asset.bytes);
  const object = db
    .prepare(
      "SELECT byte_length, state FROM asset_objects WHERE project_id = ? AND digest = ?",
    )
    .get(projectId, asset.hash) as { byte_length: number; state: string };
  if (object.state !== "ready" || object.byte_length !== asset.bytes)
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "Asset object is not ready or does not match its size.",
    );
  db.prepare(
    "INSERT INTO asset_versions(version_id, project_id, digest, probe) VALUES (?, ?, ?, ?) ON CONFLICT(version_id) DO NOTHING",
  ).run(asset.id, projectId, asset.hash, probe);
  const version = db
    .prepare(
      "SELECT project_id, digest FROM asset_versions WHERE version_id = ?",
    )
    .get(asset.id) as { project_id: string; digest: string };
  if (version.project_id !== projectId || version.digest !== asset.hash)
    throw new CommandError(
      "VALIDATION",
      "Asset version is already bound to different content.",
    );
}

const EDIT_HISTORY_OPERATIONS = new Set([
  "project.applyBatch",
  "project.undo",
  "project.redo",
]);
type Cursor = { cursor: number; head_revision: number };

// SQLite reports a damaged or foreign file as malformed or not a database.
const isDamaged = (e: unknown) =>
  e instanceof Error &&
  /malformed|not a database|SQLITE_CORRUPT|SQLITE_NOTADB/i.test(e.message);
const isBusy = (e: unknown) =>
  e instanceof Error && /database is locked|SQLITE_BUSY/i.test(e.message);

export class ProjectStore {
  readonly root: string;
  readonly #options: StoreOptions;
  #db: DatabaseSync | null = null;
  // Bytes promised to in-flight imports (staging + publication).
  #reserved = 0;
  #importing = 0;
  #publishing = new Map<string, number>();
  #discarding = new Map<string, Promise<void>>();
  // Open object holds (backups): while any is held, no object file is
  // deleted, so every object a backup's database copy registers stays
  // readable until the backup has copied it.
  #holds = 0;
  constructor(root: string, options: StoreOptions = {}) {
    this.root = root;
    this.#options = options;
  }
  get #database() {
    if (!this.#db) throw new CommandError("UNAVAILABLE", "Store is closed.");
    return this.#db;
  }
  async initialize() {
    await initializeRoot(this.root);
    const file = await safePath(this.root, "workspace.sqlite");
    const present = (p: string) =>
      access(p).then(
        () => true,
        () => false,
      );
    const sideFiles = [`${file}-wal`, `${file}-shm`];
    const hadSideFiles = await Promise.all(sideFiles.map(present));
    // SQLite skips committed transactions after a damaged log frame without
    // an error and deletes the log at the next checkpoint; such a log is
    // refused before any connection opens, so it stays as found.
    if ((await inspectWal(sideFiles[0]))?.damaged)
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "Workspace write-ahead log is damaged (committed changes after the damage would be lost) and was left as found; diagnose it (npm run recovery -- diagnose) and restore a verified backup to a new root.",
      );
    // Inspect before writing anything: a database this build refuses is left
    // exactly as it was found (no journal-mode change, no schema).
    if (await present(file)) {
      const probe = new DatabaseSync(file, { readOnly: true });
      let refusal: unknown = null;
      try {
        probe.exec("PRAGMA busy_timeout = 5000");
        acceptable(probe);
      } catch (e) {
        refusal = isBusy(e)
          ? new CommandError("BUSY", "Workspace database is busy.")
          : isDamaged(e)
            ? new CommandError(
                "RECOVERY_REQUIRED",
                "Workspace database is damaged and was left as found; diagnose it (npm run recovery -- diagnose) and restore a verified backup to a new root.",
                { cause: e },
              )
            : e;
      } finally {
        probe.close();
      }
      if (refusal) {
        // Remove only WAL side files this read-only check itself created; a
        // busy database has a live writer whose files must not be touched.
        const busy = refusal instanceof CommandError && refusal.code === "BUSY";
        if (!busy)
          for (const [i, side] of sideFiles.entries())
            if (!hadSideFiles[i]) await unlink(side).catch(() => {});
        throw refusal;
      }
    }
    const db = new DatabaseSync(file, { enableForeignKeyConstraints: true });
    let upgradedFrom = SCHEMA_VERSION;
    try {
      db.exec(
        "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;",
      );
      // Versioned, transactional schema steps; each commits on its own.
      const steps = [
        SCHEMA,
        SCHEMA_V2,
        SCHEMA_V3,
        SCHEMA_V4,
        SCHEMA_V5,
        SCHEMA_V6,
        SCHEMA_V7,
        SCHEMA_V8,
        SCHEMA_V9,
        SCHEMA_V10,
        SCHEMA_V11,
        SCHEMA_V12,
        SCHEMA_V13,
        SCHEMA_V14,
        SCHEMA_V15,
      ];
      // Steps that rebuild a table referenced by a foreign key run with
      // enforcement off (it cannot change inside a transaction) and verify
      // every reference before committing.
      const rebuilds = new Set([12, 13]);
      upgradedFrom = acceptable(db);
      for (let v = upgradedFrom; v < SCHEMA_VERSION; v++) {
        const rebuild = rebuilds.has(v);
        if (rebuild) db.exec("PRAGMA foreign_keys = OFF");
        db.exec("BEGIN IMMEDIATE");
        try {
          // Another process may have upgraded while this one waited.
          const { user_version: at } = db
            .prepare("PRAGMA user_version")
            .get() as { user_version: number };
          if (at < v || at > SCHEMA_VERSION)
            throw new CommandError(
              "RECOVERY_REQUIRED",
              "Workspace database version changed during its upgrade.",
            );
          if (at > v) {
            db.exec("ROLLBACK");
            v = at - 1;
            continue;
          }
          db.exec(steps[v]);
          if (
            rebuild &&
            ["snapshot_document_refs", "story_document_versions"].some(
              (table) =>
                db
                  .prepare(
                    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?",
                  )
                  .get(table) &&
                db.prepare(`PRAGMA foreign_key_check(${table})`).all().length,
            )
          )
            throw new CommandError(
              "RECOVERY_REQUIRED",
              "Workspace upgrade would break a document reference; the database was left as it was. Diagnose it (npm run recovery -- diagnose).",
            );
          db.exec(`PRAGMA user_version = ${v + 1}`);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        } finally {
          if (rebuild) db.exec("PRAGMA foreign_keys = ON");
        }
      }
    } catch (e) {
      db.close();
      throw isBusy(e)
        ? new CommandError("BUSY", "Workspace database is busy.")
        : e;
    }
    try {
      await mkdir(await safePath(this.root, "projects"), { recursive: true });
    } catch (e) {
      db.close();
      throw e;
    }
    this.#db = db;
    // Staged bodies lived only in the previous process's memory: uploads it
    // was receiving can never complete, and expired ones only hold space.
    db.prepare(
      "DELETE FROM document_uploads WHERE state = 'receiving' OR expires_at <= ?",
    ).run(Date.now());
    // Upgrading to v2: register every asset that existing snapshots reference.
    if (
      this.#database
        .prepare("SELECT 1 FROM pending_work WHERE name = 'asset-backfill'")
        .get()
    )
      await this.#backfillAssets();
  }
  // Registers objects/versions for assets referenced by snapshots written
  // before schema v2. An object whose file is missing or has the wrong size is
  // registered as quarantined, never as ready.
  async #backfillAssets() {
    const rows = this.#database
      .prepare(
        "SELECT DISTINCT r.project_id, s.bytes FROM revisions r JOIN snapshots s ON s.hash = r.snapshot_hash",
      )
      .all() as { project_id: string; bytes: Uint8Array }[];
    const assets = new Map<
      string,
      {
        projectId: string;
        id: string;
        hash: string;
        bytes: number;
        extension: string;
      }
    >();
    for (const row of rows) {
      let parsed: { assets?: unknown };
      try {
        parsed = JSON.parse(Buffer.from(row.bytes).toString("utf8"));
      } catch {
        continue;
      }
      for (const a of Array.isArray(parsed.assets) ? parsed.assets : []) {
        const asset = a as Record<string, unknown>;
        if (
          typeof asset.id === "string" &&
          typeof asset.hash === "string" &&
          /^[a-f0-9]{64}$/.test(asset.hash) &&
          Number.isSafeInteger(asset.bytes) &&
          (asset.bytes as number) > 0
        )
          assets.set(`${row.project_id}:${asset.id}`, {
            projectId: row.project_id,
            id: asset.id,
            hash: asset.hash,
            bytes: asset.bytes as number,
            extension: String(asset.extension ?? ""),
          });
      }
    }
    const states = new Map<string, "ready" | "quarantined">();
    for (const a of assets.values()) {
      const key = `${a.projectId}:${a.hash}`;
      if (states.has(key)) continue;
      const size = await this.#objectSize(a.projectId, a.hash, a.extension);
      states.set(key, size === a.bytes ? "ready" : "quarantined");
    }
    const db = this.#database;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const a of assets.values()) {
        db.prepare(
          "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, ?, ?, 1) ON CONFLICT(project_id, digest) DO NOTHING",
        ).run(
          a.projectId,
          a.hash,
          a.bytes,
          states.get(`${a.projectId}:${a.hash}`)!,
        );
        db.prepare(
          "INSERT INTO asset_versions(version_id, project_id, digest, probe) VALUES (?, ?, ?, NULL) ON CONFLICT(version_id) DO NOTHING",
        ).run(a.id, a.projectId, a.hash);
      }
      db.prepare(
        "DELETE FROM pending_work WHERE name = 'asset-backfill'",
      ).run();
      db.exec("COMMIT");
    } catch (e) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw e;
    }
  }
  // Size of a stored object (content-addressed, or the pre-CAS layout), or null.
  async #objectSize(projectId: string, hash: string, extension: string) {
    for (const parts of [
      ["objects", "sha256", hash.slice(0, 2), hash],
      ["assets", `${hash}.${extension}`],
    ]) {
      try {
        const info = await lstat(await this.file(projectId, ...parts));
        if (info.isFile()) return info.size;
      } catch {
        /* try the next layout */
      }
    }
    return null;
  }
  close() {
    this.#db?.close();
    this.#db = null;
  }
  async file(id: string, ...parts: string[]) {
    return safePath(this.root, "projects", Id.parse(id), ...parts);
  }
  // Media, exports and staging stay outside the database as immutable files.
  async #ensureDirectories(id: string) {
    // The content-addressed store requires a private objects directory on
    // POSIX; mkdir never tightens an existing directory, so create it first.
    await mkdir(await this.file(id, "objects"), {
      recursive: true,
      mode: 0o700,
    });
    for (const sub of ["exports", "imports"])
      await mkdir(await this.file(id, sub), { recursive: true });
  }

  #head(id: string): Head | undefined {
    return this.#database
      .prepare(
        "SELECT revision, snapshot_hash FROM projects WHERE project_id = ?",
      )
      .get(id) as Head | undefined;
  }
  #canonical(hash: string, id: string, revision: number): CanonicalProject {
    const row = this.#database
      .prepare("SELECT format, bytes FROM snapshots WHERE hash = ?")
      .get(hash) as { format: string; bytes: Uint8Array } | undefined;
    if (!row) throw new Error("Project snapshot hash mismatch.");
    const text = Buffer.from(row.bytes).toString("utf8");
    if (sha256Hex(text) !== hash)
      throw new Error("Project snapshot hash mismatch.");
    const value: unknown = JSON.parse(text);
    const project =
      row.format === EDIT_VIEW_FORMAT
        ? fromEditView(ProjectSchema.parse(value))
        : parseCanonical(value);
    if (project.id !== id || project.revision !== revision)
      throw new Error("Project snapshot identity mismatch.");
    return project;
  }
  #newerFormat(hash: string): boolean {
    const row = this.#database
      .prepare("SELECT format, bytes FROM snapshots WHERE hash = ?")
      .get(hash) as { format: string; bytes: Uint8Array } | undefined;
    if (!row || row.format === EDIT_VIEW_FORMAT) return false;
    try {
      const info = inspectFormat(
        JSON.parse(Buffer.from(row.bytes).toString("utf8")),
      );
      return (
        info.format === FORMAT &&
        (info.formatVersion ?? 0) > LATEST_FORMAT_VERSION
      );
    } catch {
      return false;
    }
  }
  // The editing shape the current editor and renderer consume.
  #snapshot(hash: string, id: string, revision: number): Project {
    return toEditView(this.#canonical(hash, id, revision));
  }
  static fingerprint(head: Head) {
    return sha256Hex(`${head.revision}:${head.snapshot_hash}`);
  }

  #commit(c: Commit): Project {
    const db = this.#database;
    const scope =
      c.operation === "project.create" ? WORKSPACE_SCOPE : c.projectId;
    try {
      db.exec("BEGIN IMMEDIATE");
    } catch (e) {
      throw isBusy(e)
        ? new CommandError("BUSY", "Workspace database is busy; retry.")
        : e;
    }
    try {
      // Replay is checked before the revision so a retry after a lost response
      // returns its own committed result instead of a conflict.
      if (c.receipt) {
        const prior = db
          .prepare(
            "SELECT r.request_digest, v.project_id, v.revision, v.snapshot_hash FROM command_receipts r JOIN revisions v ON v.receipt_id = r.id WHERE r.principal_id = ? AND r.project_id = ? AND r.request_id = ?",
          )
          .get(c.receipt.principalId, scope, c.receipt.requestId) as
          | {
              request_digest: string;
              project_id: string;
              revision: number;
              snapshot_hash: string;
            }
          | undefined;
        if (prior) {
          db.exec("ROLLBACK");
          if (prior.request_digest !== c.receipt.digest)
            throw new CommandError(
              "IDEMPOTENCY_MISMATCH",
              "Request ID was already used for a different request.",
            );
          // The original result, re-verified like any stored snapshot.
          return this.#snapshot(
            prior.snapshot_hash,
            prior.project_id,
            prior.revision,
          );
        }
      }
      // A new revision writes a snapshot of up to snapshotBytes, and the
      // import reserve stays free, so a stream of small edits cannot fill the
      // disk. Replays (above) need no space; restore, the recovery path,
      // needs only room for its snapshot.
      const free = this.#options.freeBytes
        ? this.#options.freeBytes()
        : (() => {
            const space = statfsSync(this.root);
            return Number(space.bavail) * Number(space.bsize);
          })();
      if (
        free <
        RESOURCE_POLICY.enforced.snapshotBytes +
          (c.operation === "project.restore"
            ? 0
            : RESOURCE_POLICY.enforced.diskReserveBytes)
      )
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Insufficient free disk space to commit a revision.",
        );
      const head = this.#head(c.projectId);
      if (c.operation === "project.create" ? head : !head)
        throw new CommandError(
          c.operation === "project.create" ? "VALIDATION" : "NOT_FOUND",
          c.operation === "project.create"
            ? "Project already exists."
            : "Project not found.",
        );
      if (
        c.expectedRevision !== null &&
        head &&
        head.revision !== c.expectedRevision
      )
        throw new CommandError(
          "REVISION_CONFLICT",
          "Revision conflict; reopen before saving.",
        );
      if (head) c.check?.(head);
      const revision = head ? head.revision + 1 : 0;
      if (revision > MAX_REVISION)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Project history limit reached.",
        );
      // Decoded only on demand: restore must be able to replace a head whose
      // snapshot no longer verifies.
      const current = () => {
        if (!head) throw new Error("Project not found.");
        return this.#snapshot(head.snapshot_hash, c.projectId, head.revision);
      };
      const view = ProjectSchema.parse(c.next(current, revision));
      if (view.id !== c.projectId || view.revision !== revision)
        throw new Error("Project snapshot identity mismatch.");
      let decoded: CanonicalProject | null = null;
      const headCanonical = () =>
        head
          ? (decoded ??= this.#canonical(
              head.snapshot_hash,
              c.projectId,
              head.revision,
            ))
          : null;
      const language = c.language?.() ?? headCanonical()?.language ?? "en";
      const headDocuments = () => headCanonical()?.documents ?? [];
      const documents = c.documents
        ? c.documents(headDocuments)
        : headDocuments();
      const canonicalNext = fromEditView(view, language, documents);
      // YU-051b: a newly placed take's references need usable consent now,
      // for every timeline commit but creating a project and restoring a
      // verified backup (restored consents are revalidated per epoch).
      if (c.operation !== "project.create" && c.operation !== "project.restore")
        assertPlacementConsent(
          {
            db,
            projectId: c.projectId,
            project: view,
            held: (documentId, contentHash, kind) =>
              this.#held(c.projectId, documentId, contentHash, kind),
            nowMs: Date.now(),
          },
          headCanonical()?.clips ?? [],
          canonicalNext.clips,
        );
      const bytes = Buffer.from(serializeCanonical(canonicalNext), "utf8");
      if (
        bytes.length >
        Math.min(
          RESOURCE_POLICY.enforced.snapshotBytes,
          this.#options.snapshotBytes ?? Infinity,
        )
      )
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Project snapshot exceeds its byte limit.",
        );
      const hash = sha256Hex(bytes);
      db.prepare(
        "INSERT INTO snapshots(hash, format, bytes, byte_length) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING",
      ).run(hash, SNAPSHOT_FORMAT, bytes, bytes.length);
      c.effects?.(db, revision);
      // After effects, which may store the document being committed.
      this.#assertDocumentAssets(db, canonicalNext);
      const refDocument = db.prepare(
        "INSERT INTO snapshot_document_refs(snapshot_hash, document_hash) VALUES (?, ?) ON CONFLICT DO NOTHING",
      );
      for (const ref of canonicalNext.documents)
        refDocument.run(hash, ref.contentHash);
      // Edits made any other way end the undo history they would invalidate.
      if (!EDIT_HISTORY_OPERATIONS.has(c.operation)) {
        db.prepare("DELETE FROM edit_cursor WHERE project_id = ?").run(
          c.projectId,
        );
        db.prepare("DELETE FROM edit_history WHERE project_id = ?").run(
          c.projectId,
        );
      }
      this.#options.fault?.("after-snapshot-insert");
      if (head) {
        const moved = db
          .prepare(
            "UPDATE projects SET revision = ?, snapshot_hash = ? WHERE project_id = ? AND revision = ?",
          )
          .run(revision, hash, c.projectId, head.revision);
        if (moved.changes !== 1)
          throw new CommandError(
            "REVISION_CONFLICT",
            "Revision conflict; reopen before saving.",
          );
      } else
        db.prepare(
          "INSERT INTO projects(project_id, revision, snapshot_hash) VALUES (?, ?, ?)",
        ).run(c.projectId, revision, hash);
      const receiptId = c.receipt
        ? Number(
            db
              .prepare(
                "INSERT INTO command_receipts(principal_id, project_id, request_id, request_digest, committed_revision) VALUES (?, ?, ?, ?, ?)",
              )
              .run(
                c.receipt.principalId,
                scope,
                c.receipt.requestId,
                c.receipt.digest,
                revision,
              ).lastInsertRowid,
          )
        : null;
      db.prepare(
        "INSERT INTO revisions(project_id, revision, snapshot_hash, parent_revision, operation, receipt_id) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        c.projectId,
        revision,
        hash,
        head?.revision ?? null,
        c.operation,
        receiptId,
      );
      db.prepare(
        "INSERT INTO outbox(project_id, revision, operation) VALUES (?, ?, ?)",
      ).run(c.projectId, revision, c.operation);
      this.#options.fault?.("before-commit");
      db.exec("COMMIT");
      this.#options.fault?.("after-commit");
      // Return exactly what a later load returns.
      return toEditView(canonicalNext);
    } catch (e) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw isBusy(e)
        ? new CommandError("BUSY", "Workspace database is busy; retry.")
        : e;
    }
  }

  async create(name: string, receipt?: RequestReceipt, frameRate?: Rational) {
    const draft = createProject(name, frameRate);
    const p = this.#commit({
      operation: "project.create",
      projectId: draft.id,
      expectedRevision: null,
      receipt,
      next: () => draft,
    });
    await this.#ensureDirectories(p.id);
    return p;
  }
  // Runs fn inside one immediate transaction for other core modules (jobs).
  // fn must be synchronous: no I/O, process or network wait inside.
  transaction<T>(fn: (db: DatabaseSync) => T): T {
    const db = this.#database;
    try {
      db.exec("BEGIN IMMEDIATE");
    } catch (e) {
      throw isBusy(e)
        ? new CommandError("BUSY", "Workspace database is busy; retry.")
        : e;
    }
    try {
      const result = fn(db);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw e;
    }
  }
  read<T>(fn: (db: DatabaseSync) => T): T {
    return fn(this.#database);
  }
  // The editing shape of one retained revision (jobs render frozen revisions).
  async loadRevision(id: string, revision: number): Promise<Project> {
    Id.parse(id);
    const row = this.#database
      .prepare(
        "SELECT snapshot_hash FROM revisions WHERE project_id = ? AND revision = ?",
      )
      .get(id, revision) as { snapshot_hash: string } | undefined;
    if (!row) throw new Error("Revision not found.");
    return this.#snapshot(row.snapshot_hash, id, revision);
  }
  // The canonical project at one revision with the hash of its stored
  // snapshot: the inputs of a render plan.
  revisionCanonical(
    id: string,
    revision: number,
  ): { project: CanonicalProject; snapshotHash: string } {
    Id.parse(id);
    const row = this.#database
      .prepare(
        "SELECT snapshot_hash FROM revisions WHERE project_id = ? AND revision = ?",
      )
      .get(id, revision) as { snapshot_hash: string } | undefined;
    if (!row) throw new Error("Revision not found.");
    return {
      project: this.#canonical(row.snapshot_hash, id, revision),
      snapshotHash: row.snapshot_hash,
    };
  }
  async load(id: string): Promise<Project> {
    Id.parse(id);
    const head = this.#head(id);
    if (!head) throw new Error("Project not found.");
    return this.#snapshot(head.snapshot_hash, id, head.revision);
  }
  // Every asset a referenced document needs stays in the project: a commit
  // that would drop one (or reference a document never stored) is refused.
  #assertDocumentAssets(db: DatabaseSync, project: CanonicalProject) {
    // YU-023: a clip's LUT is a LUT document of this revision, at the
    // version it names (checked with the revision's own references).
    for (const c of project.clips) {
      const lut = clipLut(c.effects);
      if (!lut) continue;
      const doc = project.documents.find((d) => d.id === lut.documentId);
      if (doc?.kind === "lut" && doc.contentHash !== lut.contentHash)
        throw new CommandError(
          "VALIDATION",
          "A clip uses another version of this LUT: a LUT a clip uses is not replaced (import the new version under a new document id, then point the clip to it).",
        );
      if (doc?.kind !== "lut")
        throw new CommandError(
          "VALIDATION",
          "A clip's LUT must be a LUT document of this project.",
        );
    }
    if (!project.documents.length) return;
    const assets = new Map(project.assets.map((a) => [a.id, a.kind]));
    const read = db.prepare(
      "SELECT kind, schema_version, asset_ids, object_digests FROM creative_documents WHERE hash = ?",
    );
    const bitmap = db.prepare(
      "SELECT 1 FROM studio_bitmaps b JOIN asset_objects o ON o.project_id = b.project_id AND o.digest = b.digest WHERE b.project_id = ? AND b.digest = ? AND o.state = 'ready'",
    );
    for (const ref of project.documents) {
      const row = read.get(ref.contentHash) as
        | {
            kind: string;
            schema_version: number;
            asset_ids: string;
            object_digests: string;
          }
        | undefined;
      // Refs are only written beside their stored document, so a mismatch
      // is workspace damage, not a client error.
      let assetIds: string[] | null = null;
      let objectDigests: string[] | null = null;
      try {
        if (
          row &&
          row.kind === ref.kind &&
          row.schema_version === ref.schemaVersion
        ) {
          assetIds = JSON.parse(row.asset_ids) as string[];
          objectDigests = JSON.parse(row.object_digests) as string[];
        }
      } catch {
        assetIds = null;
      }
      if (!Array.isArray(assetIds) || !Array.isArray(objectDigests))
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "A document reference does not match a stored document; restore an earlier revision.",
        );
      if (missingDocumentAssets({ assetIds }, assets.keys()).length)
        throw new CommandError(
          "VALIDATION",
          "A creative document uses an asset this revision would not hold.",
        );
      if (
        ref.kind === "studio" &&
        assetIds.some((id) => assets.get(id) !== "image")
      )
        throw new CommandError(
          "VALIDATION",
          "Studio bitmaps must be image assets.",
        );
      // Canvas bitmaps must be this project's stored Studio bitmaps.
      if (objectDigests.some((digest) => !bitmap.get(project.id, digest)))
        throw new CommandError(
          "VALIDATION",
          "A Studio canvas names a bitmap this project does not hold.",
        );
    }
  }
  // The head revision's document references.
  listDocuments(projectId: string): DocumentRef[] {
    Id.parse(projectId);
    const head = this.#head(projectId);
    if (!head) throw new CommandError("NOT_FOUND", "Project not found.");
    return this.#canonical(head.snapshot_hash, projectId, head.revision)
      .documents;
  }
  // One document of the head revision with its verified canonical bytes.
  getDocument(
    projectId: string,
    documentId: string,
  ): { ref: DocumentRef; bytes: Buffer } {
    Id.parse(documentId);
    const ref = this.listDocuments(projectId).find((d) => d.id === documentId);
    if (!ref) throw new CommandError("NOT_FOUND", "Document not found.");
    const row = this.#database
      .prepare("SELECT bytes FROM creative_documents WHERE hash = ?")
      .get(ref.contentHash) as { bytes: Uint8Array } | undefined;
    const bytes = row ? Buffer.from(row.bytes) : null;
    if (!bytes || sha256Hex(bytes) !== ref.contentHash)
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "Stored document does not match its hash.",
      );
    return { ref, bytes };
  }
  /**
   * A document named by a revision's own reference (its content hash), for
   * rendering that revision (YU-024 captions): verified against its hash.
   */
  documentBytes(ref: DocumentRef): Buffer {
    const row = this.#database
      .prepare(
        "SELECT bytes FROM creative_documents WHERE hash = ? AND kind = ?",
      )
      .get(ref.contentHash, ref.kind) as { bytes: Uint8Array } | undefined;
    const bytes = row ? Buffer.from(row.bytes) : null;
    if (!bytes || sha256Hex(bytes) !== ref.contentHash)
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "Stored document does not match its hash.",
      );
    return bytes;
  }
  /** Recorded migrations of one legacy source (YU-012), oldest first. */
  legacyMigrations(sourceKind: "cinema-sidecar", sourceName: string) {
    return (
      this.#database
        .prepare(
          "SELECT source_sha256, source_bytes, project_id, document_id, content_hash, revision, migrated_at FROM legacy_migrations WHERE source_kind = ? AND source_name = ? ORDER BY migrated_at, revision",
        )
        .all(sourceKind, sourceName) as {
        source_sha256: string;
        source_bytes: number;
        project_id: string;
        document_id: string;
        content_hash: string;
        revision: number;
        migrated_at: number;
      }[]
    ).map((r) => ({
      sourceSha256: r.source_sha256,
      sourceBytes: r.source_bytes,
      projectId: r.project_id,
      documentId: r.document_id,
      contentHash: r.content_hash,
      revision: r.revision,
      migratedAt: r.migrated_at,
    }));
  }
  /**
   * Commits one creative document as a new project revision (YU-010).
   * `source` is either new bytes, validated here outside the transaction, or
   * the hash of a document an earlier revision of this project referenced
   * (revert). `expectedContentHash` is the document's current hash, or null
   * when the id is new: any other current value is a conflict, so two
   * writers of one document cannot both succeed. The command surface
   * refuses while AG-DOCS is turned off (creativeDocumentsEnabled).
   */
  async commitDocument(
    input: {
      projectId: string;
      expectedRevision: number;
      documentId: string;
      kind: DocumentKind;
      schemaVersion: number;
      expectedContentHash: string | null;
      source:
        | { bytes: Uint8Array }
        | { contentHash: string }
        | { stagedUploadId: string; contentHash: string };
      // Who commits: a staged upload is consumable only by its uploader.
      principalId?: string;
      // Kind-specific checks against the head, inside the commit's own
      // transaction (YU-031 stories and reference packs).
      verify?: (context: DocumentCommitContext) => void;
      // A legacy source this commit migrates (YU-012), recorded atomically.
      migration?: {
        sourceKind: "cinema-sidecar";
        sourceName: string;
        sourceSha256: string;
        sourceBytes: number;
      };
    },
    receipt?: RequestReceipt,
  ) {
    Id.parse(input.projectId);
    Id.parse(input.documentId);
    const kind = DocumentKind.parse(input.kind);
    // Stories and packs are checked against the project and the consent
    // ledger on every commit; a caller that brings no check is refused.
    if (
      (kind === "story" || kind === "referencePack") &&
      (!input.verify || !("bytes" in input.source))
    )
      throw new CommandError(
        "VALIDATION",
        "Stories and reference packs are saved with their own commands.",
      );
    if (input.migration && !("bytes" in input.source))
      throw new CommandError(
        "VALIDATION",
        "A migration commits the legacy bytes themselves.",
      );
    const validated =
      "bytes" in input.source
        ? validateDocument(kind, input.schemaVersion, input.source.bytes)
        : null;
    const contentHash = validated
      ? validated.hash
      : DocumentRefSchema.shape.contentHash.parse(
          (input.source as { contentHash: string }).contentHash,
        );
    const stagedId =
      "stagedUploadId" in input.source
        ? Id.parse(input.source.stagedUploadId)
        : null;
    const now = Date.now();
    // The replay digest also binds what is committed, so a retry under the
    // same request id with other content can never return this result.
    const bound = receipt && {
      ...receipt,
      digest: sha256Hex(
        canonicalJson({
          request: receipt.digest,
          documentId: input.documentId,
          kind,
          schemaVersion: input.schemaVersion,
          expectedContentHash: input.expectedContentHash,
          contentHash,
          migration: input.migration ?? null,
        }),
      ),
    };
    const migration = input.migration;
    return this.#commit({
      operation: "document.commit",
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      receipt: bound,
      check: () => {
        if (migration) {
          // Never inferred, never moved: a source belongs to the first
          // project it was explicitly migrated into.
          const elsewhere = this.#database
            .prepare(
              "SELECT 1 FROM legacy_migrations WHERE source_kind = ? AND source_name = ? AND project_id <> ?",
            )
            .get(migration.sourceKind, migration.sourceName, input.projectId);
          if (elsewhere)
            throw new CommandError(
              "VALIDATION",
              "This legacy scene was already migrated into another project.",
            );
        }
        if (validated) return;
        if (stagedId) {
          const upload = this.#database
            .prepare(
              "SELECT project_id, principal_id, kind, schema_version, state, content_hash, expires_at FROM document_uploads WHERE id = ?",
            )
            .get(stagedId) as
            | {
                project_id: string;
                principal_id: string;
                kind: string;
                schema_version: number;
                state: string;
                content_hash: string | null;
                expires_at: number;
              }
            | undefined;
          // Foreign, unknown and expired handles are indistinguishable.
          if (
            !upload ||
            upload.project_id !== input.projectId ||
            upload.principal_id !== input.principalId ||
            upload.expires_at <= now
          )
            throw new CommandError(
              "NOT_FOUND",
              "No such staged upload; stage the document again.",
            );
          if (upload.state !== "sealed")
            throw new CommandError(
              "VALIDATION",
              upload.state === "consumed"
                ? "This staged upload was already committed."
                : "This staged upload is not complete.",
            );
          if (
            upload.content_hash !== contentHash ||
            upload.kind !== kind ||
            upload.schema_version !== input.schemaVersion
          )
            throw new CommandError(
              "VALIDATION",
              "The staged upload does not match this document.",
            );
          return;
        }
        // A revert may only name a document this project already held.
        const owned = this.#database
          .prepare(
            "SELECT 1 FROM snapshot_document_refs d JOIN revisions r ON r.snapshot_hash = d.snapshot_hash JOIN creative_documents c ON c.hash = d.document_hash WHERE r.project_id = ? AND d.document_hash = ? AND c.kind = ? AND c.schema_version = ?",
          )
          .get(input.projectId, contentHash, kind, input.schemaVersion);
        if (!owned)
          throw new CommandError(
            "NOT_FOUND",
            "This project has no such document version.",
          );
      },
      documents: (head) => {
        const current = head();
        const existing = current.find((d) => d.id === input.documentId);
        if ((existing?.contentHash ?? null) !== input.expectedContentHash)
          throw new CommandError(
            "REVISION_CONFLICT",
            "The document changed; reopen it before saving.",
          );
        if (existing && existing.kind !== kind)
          throw new CommandError("VALIDATION", "A document keeps its kind.");
        const ref = {
          id: input.documentId,
          kind,
          schemaVersion: input.schemaVersion,
          contentHash,
        };
        return existing
          ? current.map((d) => (d.id === ref.id ? ref : d))
          : [...current, ref];
      },
      effects: stagedId
        ? (db, revision) => {
            const staged = db
              .prepare(
                "SELECT content_hash AS hash, length(bytes) AS bytes FROM document_uploads WHERE id = ?",
              )
              .get(stagedId) as { hash: string; bytes: number } | undefined;
            if (staged)
              withinDocumentBudget(
                db,
                staged.hash,
                staged.bytes,
                input.principalId,
              );
            db.prepare(
              "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) SELECT content_hash, kind, schema_version, asset_ids, object_digests, bytes, length(bytes) FROM document_uploads WHERE id = ? ON CONFLICT(hash) DO NOTHING",
            ).run(stagedId);
            db.prepare(
              "UPDATE document_uploads SET state = 'consumed', consumed_revision = ?, bytes = NULL WHERE id = ? AND state = 'sealed'",
            ).run(revision, stagedId);
          }
        : validated
          ? (db, revision) => {
              withinDocumentBudget(
                db,
                validated.hash,
                validated.bytes.length,
                input.principalId,
              );
              db.prepare(
                "INSERT INTO creative_documents(hash, kind, schema_version, asset_ids, object_digests, bytes, byte_length) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING",
              ).run(
                validated.hash,
                validated.kind,
                validated.schemaVersion,
                JSON.stringify(validated.assetIds),
                JSON.stringify(validated.objectDigests),
                validated.bytes,
                validated.bytes.length,
              );
              if (kind === "story" || kind === "referencePack")
                db.prepare(
                  "INSERT INTO story_document_versions(project_id, document_id, content_hash, revision) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
                ).run(
                  input.projectId,
                  input.documentId,
                  validated.hash,
                  revision,
                );
              if (migration)
                db.prepare(
                  "INSERT INTO legacy_migrations(source_kind, source_name, source_sha256, source_bytes, project_id, document_id, content_hash, revision, migrated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ).run(
                  migration.sourceKind,
                  migration.sourceName,
                  migration.sourceSha256,
                  migration.sourceBytes,
                  input.projectId,
                  input.documentId,
                  validated.hash,
                  revision,
                  Date.now(),
                );
            }
          : undefined,
      next: (current, revision) => {
        const project = current();
        input.verify?.({
          db: this.#database,
          project,
          documents: this.listDocuments(input.projectId),
          held: (documentId, hash, kind) =>
            this.#held(input.projectId, documentId, hash, kind),
          // Read under the write lock, so a consent cannot expire unseen.
          nowMs: Date.now(),
        });
        return { ...project, revision };
      },
    });
  }
  /** Whether this project committed this document version (read-only checks). */
  holdsDocument(
    projectId: string,
    documentId: string,
    contentHash: string,
    kind: DocumentKind,
  ) {
    return this.#held(projectId, documentId, contentHash, kind);
  }
  // Whether this project committed this version of this story or pack
  // document (recorded with the commit; YU-031).
  #held(
    projectId: string,
    documentId: string,
    contentHash: string,
    kind: DocumentKind,
  ) {
    return Boolean(
      this.#database
        .prepare(
          "SELECT 1 FROM story_document_versions v JOIN creative_documents c ON c.hash = v.content_hash WHERE v.project_id = ? AND v.document_id = ? AND v.content_hash = ? AND c.kind = ?",
        )
        .get(projectId, documentId, contentHash, kind),
    );
  }
  /**
   * Reserves a staged document upload before any byte is read (YU-010b).
   * The request digest binds the project, kind, version, declared length and
   * the body's SHA-256, so a retry after a lost response returns the same
   * sealed receipt without re-sending, and a changed request is refused.
   */
  reserveDocumentUpload(
    input: {
      projectId: string;
      principalId: string;
      requestId: string;
      kind: DocumentKind;
      schemaVersion: number;
      declaredBytes: number;
      bodySha256: string;
    },
    now = Date.now(),
  ): { reserved: string } | { receipt: StagedDocumentReceipt } {
    Id.parse(input.projectId);
    const kind = DocumentKind.parse(input.kind);
    // Stories, packs and caption tracks are saved inline by their own
    // commands (YU-031, YU-024).
    if (
      kind === "story" ||
      kind === "referencePack" ||
      kind === "captions" ||
      kind === "lut"
    )
      throw new CommandError(
        "VALIDATION",
        "Stories, reference packs, caption tracks and LUTs are not staged; save them with their own commands.",
      );
    const bodySha256 = DocumentRefSchema.shape.contentHash.parse(
      input.bodySha256,
    );
    if (
      !Number.isSafeInteger(input.declaredBytes) ||
      input.declaredBytes < 1 ||
      input.declaredBytes > DOCUMENT_LIMITS.documentBytes
    )
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `A staged document is 1 to ${DOCUMENT_LIMITS.documentBytes} bytes.`,
      );
    const digest = sha256Hex(
      canonicalJson({
        projectId: input.projectId,
        kind,
        schemaVersion: input.schemaVersion,
        declaredBytes: input.declaredBytes,
        bodySha256,
      }),
    );
    return this.transaction((db) => {
      // Expired uploads release their reservation (and any bytes) here.
      db.prepare("DELETE FROM document_uploads WHERE expires_at <= ?").run(now);
      if (!this.#head(input.projectId))
        throw new CommandError("NOT_FOUND", "Project not found.");
      const prior = db
        .prepare(
          "SELECT * FROM document_uploads WHERE principal_id = ? AND project_id = ? AND request_id = ?",
        )
        .get(input.principalId, input.projectId, input.requestId) as
        UploadRow | undefined;
      if (prior) {
        if (prior.request_digest !== digest)
          throw new CommandError(
            "IDEMPOTENCY_MISMATCH",
            "Request ID was already used for a different upload.",
          );
        if (prior.state === "receiving")
          throw new CommandError(
            "BUSY",
            "This upload is still being received; retry shortly.",
          );
        return { receipt: uploadReceipt(prior) };
      }
      const active = db
        .prepare(
          "SELECT count(*) AS n FROM document_uploads WHERE principal_id = ? AND state IN ('receiving', 'sealed')",
        )
        .get(input.principalId) as { n: number };
      if (active.n >= DOCUMENT_LIMITS.activeUploadsPerPrincipal)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Too many staged uploads in progress; commit or wait for one to expire.",
        );
      const reserved = db
        .prepare(
          "SELECT coalesce(sum(declared_bytes), 0) AS n FROM document_uploads WHERE state IN ('receiving', 'sealed')",
        )
        .get() as { n: number };
      if (
        reserved.n + input.declaredBytes >
        DOCUMENT_LIMITS.reservedUploadBytes
      )
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "The workspace's staged upload space is in use; retry later.",
        );
      const sum = (sql: string, ...args: string[]) =>
        (db.prepare(sql).get(...args) as { n: number }).n;
      const mine = sum(
        "SELECT coalesce(sum(declared_bytes), 0) AS n FROM document_uploads WHERE principal_id = ? AND state IN ('receiving', 'sealed')",
        input.principalId,
      );
      if (
        mine + input.declaredBytes >
        DOCUMENT_LIMITS.reservedBytesPerPrincipal
      )
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Too many staged bytes in progress; commit or wait for one to expire.",
        );
      // Agents share one bounded pool, so they can never lock out the
      // browser session or the local CLI and SDK.
      if (input.principalId.startsWith("agent:")) {
        const agents = sum(
          "SELECT coalesce(sum(declared_bytes), 0) AS n FROM document_uploads WHERE principal_id GLOB 'agent:*' AND state IN ('receiving', 'sealed')",
        );
        if (
          agents + input.declaredBytes >
          DOCUMENT_LIMITS.reservedBytesForAgents
        )
          throw new CommandError(
            "LIMIT_EXCEEDED",
            "The staged upload space for agents is in use; retry later.",
          );
      }
      const free = this.#options.freeBytes
        ? this.#options.freeBytes()
        : (() => {
            const space = statfsSync(this.root);
            return Number(space.bavail) * Number(space.bsize);
          })();
      if (
        free <
        input.declaredBytes + RESOURCE_POLICY.enforced.diskReserveBytes
      )
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Insufficient free disk space to stage a document.",
        );
      const id = randomUUID();
      db.prepare(
        "INSERT INTO document_uploads(id, project_id, principal_id, request_id, request_digest, kind, schema_version, declared_bytes, body_sha256, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'receiving', ?, ?)",
      ).run(
        id,
        input.projectId,
        input.principalId,
        input.requestId,
        digest,
        kind,
        input.schemaVersion,
        input.declaredBytes,
        bodySha256,
        now,
        now + DOCUMENT_LIMITS.uploadTtlMs,
      );
      return { reserved: id };
    });
  }
  // Seals a reserved upload with its complete body: the bytes must be the
  // declared length and hash and a valid document; otherwise the
  // reservation is released and nothing is kept.
  sealDocumentUpload(
    uploadId: string,
    body: Uint8Array,
  ): StagedDocumentReceipt {
    const row = this.#database
      .prepare("SELECT * FROM document_uploads WHERE id = ?")
      .get(uploadId) as UploadRow | undefined;
    if (!row || row.state !== "receiving")
      throw new CommandError("NOT_FOUND", "No such upload in progress.");
    try {
      if (body.byteLength !== row.declared_bytes)
        throw new CommandError(
          "VALIDATION",
          "The upload's length does not match its Content-Length.",
        );
      if (sha256Hex(body) !== row.body_sha256)
        throw new CommandError(
          "VALIDATION",
          "The upload does not match its declared SHA-256.",
        );
      const doc = validateDocument(
        DocumentKind.parse(row.kind),
        row.schema_version,
        body,
      );
      return this.transaction((db) => {
        db.prepare(
          "UPDATE document_uploads SET state = 'sealed', content_hash = ?, asset_ids = ?, object_digests = ?, bytes = ? WHERE id = ? AND state = 'receiving'",
        ).run(
          doc.hash,
          JSON.stringify(doc.assetIds),
          JSON.stringify(doc.objectDigests),
          doc.bytes,
          uploadId,
        );
        return uploadReceipt(
          db
            .prepare("SELECT * FROM document_uploads WHERE id = ?")
            .get(uploadId) as UploadRow,
        );
      });
    } catch (e) {
      this.abandonDocumentUpload(uploadId);
      throw e;
    }
  }
  // Releases a reservation whose body never arrived complete.
  abandonDocumentUpload(uploadId: string) {
    this.transaction((db) =>
      db
        .prepare(
          "DELETE FROM document_uploads WHERE id = ? AND state = 'receiving'",
        )
        .run(uploadId),
    );
  }
  /**
   * Stores one Studio layer bitmap (PNG) in the project's content-addressed
   * object store and registers it, so the canvas can name it by digest
   * (YU-011). Identical bytes are stored once. The PNG header and the Studio
   * dimension limits are checked from the first bytes, before the rest is
   * read; the registration happens inside the publication hold, so garbage
   * collection never sees the object unregistered.
   */
  async importStudioBitmap(
    projectId: string,
    source: AsyncIterable<Uint8Array>,
    declaredBytes: number,
    principalId?: string,
  ): Promise<{
    digest: string;
    byteLength: number;
    width: number;
    height: number;
  }> {
    Id.parse(projectId);
    if (!this.#head(projectId))
      throw new CommandError("NOT_FOUND", "Project not found.");
    if (
      !Number.isSafeInteger(declaredBytes) ||
      declaredBytes < 33 ||
      declaredBytes > DOCUMENT_LIMITS.bitmapBytes
    )
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `A Studio bitmap is a PNG of at most ${DOCUMENT_LIMITS.bitmapBytes} bytes.`,
      );
    const free = this.#options.freeBytes
      ? this.#options.freeBytes()
      : (() => {
          const space = statfsSync(this.root);
          return Number(space.bavail) * Number(space.bsize);
        })();
    if (free < declaredBytes + RESOURCE_POLICY.enforced.diskReserveBytes)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Insufficient free disk space to store a Studio bitmap.",
      );
    // The project's Studio bitmap budget, checked before streaming and again
    // when the bitmap is registered.
    const overBudget = (db: DatabaseSync, digest: string | null) => {
      const used = db
        .prepare(
          "SELECT count(*) AS n, coalesce(sum(byte_length), 0) AS bytes FROM studio_bitmaps WHERE project_id = ? AND digest IS NOT ?",
        )
        .get(projectId, digest) as { n: number; bytes: number };
      // And the workspace's, across all projects.
      const all = db
        .prepare(
          "SELECT coalesce(sum(byte_length), 0) AS bytes FROM studio_bitmaps WHERE NOT (project_id = ? AND digest IS ?)",
        )
        .get(projectId, digest) as { bytes: number };
      return (
        used.n + 1 > budgetFor(DOCUMENT_LIMITS.projectBitmaps, principalId) ||
        used.bytes + declaredBytes >
          budgetFor(DOCUMENT_LIMITS.projectBitmapBytes, principalId) ||
        all.bytes + declaredBytes >
          budgetFor(DOCUMENT_LIMITS.workspaceBitmapBytes, principalId)
      );
    };
    if (overBudget(this.#database, null))
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Studio bitmap space is full; unused bitmaps are freed by garbage collection (hourly, an hour after they were last used).",
      );
    let size = 0;
    let head = Buffer.alloc(0);
    let size2d: { width: number; height: number } | null = null;
    const checked = async function* () {
      for await (const chunk of source) {
        size += chunk.byteLength;
        if (size > declaredBytes)
          throw new CommandError(
            "VALIDATION",
            "The bitmap is longer than its declared length.",
          );
        if (!size2d) {
          head = Buffer.concat([head, Buffer.from(chunk)]).subarray(0, 33);
          if (head.length >= 24) size2d = pngSize(head);
        }
        yield chunk;
      }
      if (!size2d || size !== declaredBytes)
        throw new CommandError(
          "VALIDATION",
          "A Studio bitmap must be a complete PNG of its declared length.",
        );
    };
    const release = await this.beginPublication(projectId);
    try {
      await this.#ensureDirectories(projectId);
      const stored = await (await this.#objects(projectId)).put(checked());
      const { width, height } = size2d!;
      this.transaction((db) => {
        const object = db
          .prepare(
            "SELECT state FROM asset_objects WHERE project_id = ? AND digest = ?",
          )
          .get(projectId, stored.sha256) as { state: string } | undefined;
        if (object && object.state !== "ready")
          throw new CommandError(
            "RECOVERY_REQUIRED",
            "This bitmap's stored copy is quarantined; restore a verified backup.",
          );
        const known = db
          .prepare(
            "SELECT 1 FROM studio_bitmaps WHERE project_id = ? AND digest = ?",
          )
          .get(projectId, stored.sha256);
        if (!known && overBudget(db, stored.sha256))
          throw new CommandError(
            "LIMIT_EXCEEDED",
            "Studio bitmap space is full; unused bitmaps are freed by garbage collection (hourly, an hour after they were last used).",
          );
        if (!object)
          db.prepare(
            "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, ?, 'ready', 1)",
          ).run(projectId, stored.sha256, stored.byteLength);
        db.prepare(
          "INSERT INTO studio_bitmaps(project_id, digest, byte_length, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, digest) DO UPDATE SET created_at = excluded.created_at",
        ).run(
          projectId,
          stored.sha256,
          stored.byteLength,
          width,
          height,
          Date.now(),
        );
      });
      return {
        digest: stored.sha256,
        byteLength: stored.byteLength,
        width,
        height,
      };
    } finally {
      release();
    }
  }
  // The stored file of one of this project's Studio bitmaps.
  async studioBitmapFile(projectId: string, digest: string) {
    Id.parse(projectId);
    if (!/^[a-f0-9]{64}$/.test(digest))
      throw new CommandError("NOT_FOUND", "Bitmap not found.");
    const row = this.#database
      .prepare(
        "SELECT b.byte_length FROM studio_bitmaps b JOIN asset_objects o ON o.project_id = b.project_id AND o.digest = b.digest WHERE b.project_id = ? AND b.digest = ? AND o.state = 'ready'",
      )
      .get(projectId, digest) as { byte_length: number } | undefined;
    if (!row) throw new CommandError("NOT_FOUND", "Bitmap not found.");
    const file = await this.file(
      projectId,
      "objects",
      "sha256",
      digest.slice(0, 2),
      digest,
    );
    const info = await lstat(file).catch(() => null);
    if (!info?.isFile() || info.size !== row.byte_length)
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "A Studio bitmap's stored copy is missing or damaged.",
      );
    return file;
  }
  // Migration only (T3): import a project's verified history with its original
  // revision numbers into this workspace in one transaction. Refuses a project
  // that already exists; nothing is committed if any revision is invalid.
  importHistory(projectId: string, revisions: CanonicalProject[]) {
    Id.parse(projectId);
    if (!revisions.length) throw new Error("Migration has no revisions.");
    const ordered = [...revisions].sort((a, b) => a.revision - b.revision);
    const db = this.#database;
    db.exec("BEGIN IMMEDIATE");
    try {
      if (this.#head(projectId))
        throw new CommandError("VALIDATION", "Project already exists.");
      const limit = Math.min(
        RESOURCE_POLICY.enforced.snapshotBytes,
        this.#options.snapshotBytes ?? Infinity,
      );
      let parent: number | null = null;
      let headHash = "";
      const registered = new Set<string>();
      for (const project of ordered) {
        const p = parseCanonical(project);
        if (p.id !== projectId)
          throw new Error("Project snapshot identity mismatch.");
        // Migrated folder history predates creative documents.
        if (p.documents.length)
          throw new CommandError(
            "VALIDATION",
            "Migrated history cannot contain creative documents.",
          );
        const bytes = Buffer.from(serializeCanonical(p), "utf8");
        if (bytes.length > limit)
          throw new CommandError(
            "LIMIT_EXCEEDED",
            "Project snapshot exceeds its byte limit.",
          );
        headHash = sha256Hex(bytes);
        for (const asset of p.assets)
          if (!registered.has(asset.id)) {
            registerAsset(db, projectId, asset, null);
            registered.add(asset.id);
          }
        db.prepare(
          "INSERT INTO snapshots(hash, format, bytes, byte_length) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING",
        ).run(headHash, SNAPSHOT_FORMAT, bytes, bytes.length);
        if (parent === null)
          db.prepare(
            "INSERT INTO projects(project_id, revision, snapshot_hash) VALUES (?, ?, ?)",
          ).run(projectId, p.revision, headHash);
        db.prepare(
          "INSERT INTO revisions(project_id, revision, snapshot_hash, parent_revision, operation, receipt_id) VALUES (?, ?, ?, ?, ?, NULL)",
        ).run(projectId, p.revision, headHash, parent, "migration.import");
        parent = p.revision;
      }
      db.prepare(
        "UPDATE projects SET revision = ?, snapshot_hash = ? WHERE project_id = ?",
      ).run(parent, headHash, projectId);
      db.prepare(
        "INSERT INTO outbox(project_id, revision, operation) VALUES (?, ?, ?)",
      ).run(projectId, parent, "migration.import");
      db.exec("COMMIT");
    } catch (e) {
      if (db.isTransaction) db.exec("ROLLBACK");
      throw e;
    }
  }
  // Publish verified media bytes into this workspace's content-addressed store.
  async importObject(
    projectId: string,
    source: AsyncIterable<Uint8Array>,
  ): Promise<{ sha256: string; byteLength: number }> {
    const release = await this.beginPublication(projectId);
    try {
      await this.#ensureDirectories(projectId);
      return await (await this.#objects(projectId)).put(source);
    } finally {
      release();
    }
  }
  // Marks a publication in flight from before its bytes are written until
  // the returned release is called (after its row commits or it is
  // abandoned). Unregistered objects are never removed while one is open.
  // importObject holds one only around the copy; a caller that registers
  // the object later (a derivative job) holds its own until it commits.
  async beginPublication(projectId: string) {
    for (
      let pending = this.#discarding.get(projectId);
      pending;
      pending = this.#discarding.get(projectId)
    )
      await pending;
    this.#publishing.set(projectId, (this.#publishing.get(projectId) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const n = (this.#publishing.get(projectId) ?? 1) - 1;
      if (n > 0) this.#publishing.set(projectId, n);
      else this.#publishing.delete(projectId);
    };
  }
  // Removes a content object that no row registers. Skipped (left for the
  // T9 garbage collector) while another publication into the project is in
  // flight, since that publication may be about to register the same bytes.
  async discardUnregisteredObject(projectId: string, digest: string) {
    Id.parse(projectId);
    if (!/^[0-9a-f]{64}$/.test(digest)) return false;
    if (
      this.#publishing.has(projectId) ||
      this.#discarding.has(projectId) ||
      this.#holds > 0
    )
      return false;
    const registered = this.#database
      .prepare(
        "SELECT 1 FROM asset_objects WHERE project_id = ? AND digest = ?",
      )
      .get(projectId, digest);
    if (registered) return false;
    // Set synchronously after the check, so no publication starts between.
    const work = (async () => {
      await unlink(
        await this.file(
          projectId,
          "objects",
          "sha256",
          digest.slice(0, 2),
          digest,
        ),
      ).catch(() => {});
    })();
    this.#discarding.set(projectId, work);
    try {
      await work;
    } finally {
      this.#discarding.delete(projectId);
    }
    return true;
  }
  // Holds every object file in place until the returned release is called.
  holdObjects() {
    this.#holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#holds--;
    };
  }
  // Copies the database online with SQLite's backup API from a separate
  // read-only connection, in one step: it reads one consistent snapshot of
  // everything committed when the copy began (write-ahead log), while this
  // connection keeps committing. The copy never runs on this connection,
  // which writes from the main thread meanwhile.
  async backupDatabase(destination: string) {
    const source = new DatabaseSync(
      await safePath(this.root, "workspace.sqlite"),
      { readOnly: true },
    );
    try {
      source.exec("PRAGMA busy_timeout = 5000");
      await backup(source, destination, { rate: -1 });
    } finally {
      source.close();
    }
  }

  // Runs a workspace recovery command once per request id (W2). The effect
  // reference is reserved in SQLite before filesystem work so a retry after
  // a lost response can return or resume the original result.
  async runIdempotentRecovery<T>(
    receipt: RequestReceipt,
    operation: string,
    effectRef: string,
    resume: (ref: string) => Promise<T | null>,
    effect: (ref: string) => Promise<T>,
  ): Promise<T> {
    const replay = this.transaction((db) =>
      this.#recoveryReceiptRow(db, receipt, operation),
    );
    if (replay?.result !== undefined) return replay.result as T;
    if (replay?.effectRef) {
      const healed = await resume(replay.effectRef);
      if (healed !== null)
        return this.#finishRecoveryReceipt(receipt, operation, healed);
    }
    const reserved = this.transaction((db) => {
      const existing = this.#recoveryReceiptRow(db, receipt, operation);
      if (existing?.result !== undefined) return { done: existing.result as T };
      if (existing?.effectRef) return { ref: existing.effectRef };
      try {
        db.prepare(
          "INSERT INTO recovery_receipts(principal_id, operation, request_id, request_digest, effect_ref) VALUES (?, ?, ?, ?, ?)",
        ).run(
          receipt.principalId,
          operation,
          receipt.requestId,
          receipt.digest,
          effectRef,
        );
      } catch (e) {
        if (!/UNIQUE constraint failed/i.test(String(e))) throw e;
        const raced = this.#recoveryReceiptRow(db, receipt, operation);
        if (raced?.result !== undefined) return { done: raced.result as T };
        if (raced?.effectRef) return { ref: raced.effectRef };
        throw e;
      }
      return { ref: effectRef };
    });
    if ("done" in reserved) return reserved.done as T;
    const ref = reserved.ref ?? effectRef;
    const resumed = await resume(ref);
    if (resumed !== null)
      return this.#finishRecoveryReceipt(receipt, operation, resumed);
    const result = await effect(ref);
    this.#options.recoveryFault?.("after-recovery-effect");
    return this.#finishRecoveryReceipt(receipt, operation, result);
  }

  #recoveryReceiptRow(
    db: DatabaseSync,
    receipt: RequestReceipt,
    operation: string,
  ): { effectRef: string; result?: unknown } | null {
    const row = db
      .prepare(
        "SELECT request_digest, effect_ref, result_json FROM recovery_receipts WHERE principal_id = ? AND operation = ? AND request_id = ?",
      )
      .get(receipt.principalId, operation, receipt.requestId) as
      | {
          request_digest: string;
          effect_ref: string;
          result_json: string | null;
        }
      | undefined;
    if (!row) return null;
    if (row.request_digest !== receipt.digest)
      throw new CommandError(
        "IDEMPOTENCY_MISMATCH",
        "Request ID was already used for a different request.",
      );
    if (row.result_json !== null)
      return { effectRef: row.effect_ref, result: JSON.parse(row.result_json) };
    return { effectRef: row.effect_ref };
  }

  #finishRecoveryReceipt<T>(
    receipt: RequestReceipt,
    operation: string,
    result: T,
  ): T {
    this.#options.recoveryFault?.("before-recovery-receipt");
    return this.transaction((db) => {
      const row = this.#recoveryReceiptRow(db, receipt, operation);
      if (row?.result !== undefined) return row.result as T;
      const moved = db
        .prepare(
          "UPDATE recovery_receipts SET result_json = ? WHERE principal_id = ? AND operation = ? AND request_id = ? AND request_digest = ? AND result_json IS NULL",
        )
        .run(
          JSON.stringify(result),
          receipt.principalId,
          operation,
          receipt.requestId,
          receipt.digest,
        );
      if (moved.changes === 1) return result;
      const again = this.#recoveryReceiptRow(db, receipt, operation);
      if (again?.result !== undefined) return again.result as T;
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "Recovery receipt could not be recorded.",
      );
    });
  }
  // Bytes promised to in-flight imports on this volume.
  get reservedBytes() {
    return this.#reserved;
  }
  // Removes crash leftovers older than the grace period: content objects no
  // row registers, temporary files of the object store and staging files of
  // uploads. Registered objects are never removed here. Nothing is removed
  // while a backup holds objects, and a project's objects are skipped while
  // a publication into it is in flight.
  async collectGarbage(options: { graceMs?: number; now?: number } = {}) {
    const graceMs = options.graceMs ?? 60 * 60 * 1000;
    const now = options.now ?? Date.now();
    const report = { objects: 0, bytes: 0, temporary: 0 };
    if (this.#holds > 0) return report;
    const stale = async (file: string) => {
      const info = await lstat(file).catch(() => null);
      return info?.isFile() && now - info.mtimeMs > graceMs ? info : null;
    };
    const names = async (...parts: string[]) =>
      readdir(await safePath(this.root, "projects", ...parts)).catch(
        () => [] as string[],
      );
    for (const id of await names()) {
      if (!Id.safeParse(id).success) continue;
      for (const dir of [["objects", ".tmp"], ["imports"]]) {
        if (
          dir[0] === "imports" ? this.#importing > 0 : this.#publishing.has(id)
        )
          continue;
        for (const name of await names(id, ...dir)) {
          if (this.#holds > 0) return report;
          const file = await this.file(id, ...dir, name);
          if (
            (await stale(file)) &&
            (await unlink(file).then(
              () => true,
              () => false,
            ))
          )
            report.temporary++;
        }
      }
      for (const prefix of await names(id, "objects", "sha256")) {
        if (!/^[0-9a-f]{2}$/.test(prefix)) continue;
        for (const digest of await names(id, "objects", "sha256", prefix)) {
          if (!/^[0-9a-f]{64}$/.test(digest) || !digest.startsWith(prefix))
            continue;
          const info = await stale(
            await this.file(id, "objects", "sha256", prefix, digest),
          );
          if (info && (await this.discardUnregisteredObject(id, digest))) {
            report.objects++;
            report.bytes += info.size;
          }
        }
      }
    }
    await this.#collectHiddenVfrOriginals(report);
    await this.#collectStudioBitmaps(report, graceMs, now);
    return report;
  }
  // Studio bitmaps no retained revision's document (and no sealed upload
  // awaiting its commit) names, once older than the grace period: a save in
  // progress uploads its bitmaps before committing the document.
  async #collectStudioBitmaps(
    report: { objects: number; bytes: number },
    graceMs: number,
    now: number,
  ) {
    const db = this.#database;
    const projects = db
      .prepare("SELECT DISTINCT project_id FROM studio_bitmaps")
      .all() as { project_id: string }[];
    for (const { project_id: projectId } of projects) {
      if (
        this.#publishing.has(projectId) ||
        this.#discarding.has(projectId) ||
        this.#holds > 0
      )
        continue;
      const removed = this.transaction((inner) => {
        const named = new Set<string>();
        const lists = inner
          .prepare(
            `SELECT c.object_digests AS list FROM revisions r
             JOIN snapshot_document_refs d ON d.snapshot_hash = r.snapshot_hash
             JOIN creative_documents c ON c.hash = d.document_hash
             WHERE r.project_id = ?
             UNION ALL
             SELECT object_digests AS list FROM document_uploads
             WHERE project_id = ? AND state = 'sealed' AND object_digests IS NOT NULL`,
          )
          .all(projectId, projectId) as { list: string }[];
        for (const { list } of lists)
          for (const digest of JSON.parse(list) as string[]) named.add(digest);
        const stale = (
          inner
            .prepare(
              "SELECT digest, byte_length FROM studio_bitmaps WHERE project_id = ? AND created_at < ?",
            )
            .all(projectId, now - graceMs) as {
            digest: string;
            byte_length: number;
          }[]
        ).filter((b) => !named.has(b.digest));
        const files: { digest: string; bytes: number }[] = [];
        for (const b of stale) {
          inner
            .prepare(
              "DELETE FROM studio_bitmaps WHERE project_id = ? AND digest = ?",
            )
            .run(projectId, b.digest);
          // The same bytes may also be an imported asset's: keep them then.
          const shared = inner
            .prepare(
              "SELECT 1 FROM asset_versions WHERE project_id = ? AND digest = ? LIMIT 1",
            )
            .get(projectId, b.digest);
          if (shared) continue;
          inner
            .prepare(
              "DELETE FROM asset_objects WHERE project_id = ? AND digest = ?",
            )
            .run(projectId, b.digest);
          files.push({ digest: b.digest, bytes: b.byte_length });
        }
        return files;
      });
      if (!removed.length) continue;
      // Marked synchronously, right after the rows are gone: a publication
      // of the same bytes waits (beginPublication) until the files are, so
      // it can never re-register a digest whose file is then deleted.
      const work = (async () => {
        await this.#options.studioCollectionPause?.();
        for (const { digest, bytes } of removed) {
          // One file that cannot be removed is left for the next pass.
          const unlinked = await this.file(
            projectId,
            "objects",
            "sha256",
            digest.slice(0, 2),
            digest,
          )
            .then((file) => unlink(file))
            .then(
              () => true,
              () => false,
            );
          if (unlinked) {
            report.objects++;
            report.bytes += bytes;
          }
        }
      })();
      this.#discarding.set(projectId, work);
      try {
        await work;
      } finally {
        this.#discarding.delete(projectId);
      }
    }
  }
  async #collectHiddenVfrOriginals(report: { objects: number; bytes: number }) {
    if (this.#holds > 0 || this.#importing > 0) return;
    const db = this.#database;
    const projects = db.prepare("SELECT project_id FROM projects").all() as {
      project_id: string;
    }[];
    for (const { project_id: projectId } of projects) {
      if (this.#publishing.has(projectId) || this.#holds > 0) return;
      const refs = referencedDigestsInRetention(
        db,
        projectId,
        (hash, revision) => this.#canonical(hash, projectId, revision),
      );
      const rows = db
        .prepare(
          `SELECT v.version_id, v.digest, v.probe, o.byte_length
           FROM asset_versions v
           JOIN asset_objects o ON o.project_id = v.project_id AND o.digest = v.digest
           WHERE v.project_id = ? AND o.state = 'ready'`,
        )
        .all(projectId) as {
        version_id: string;
        digest: string;
        probe: string | null;
        byte_length: number;
      }[];
      for (const row of rows) {
        if (!isHiddenVfrOriginal(row.probe) || refs.has(row.digest)) continue;
        const digest = this.transaction((inner) => {
          const current = inner
            .prepare(
              "SELECT probe FROM asset_versions WHERE version_id = ? AND project_id = ?",
            )
            .get(row.version_id, projectId) as
            { probe: string | null } | undefined;
          if (!current || !isHiddenVfrOriginal(current.probe)) return null;
          const liveRefs = referencedDigestsInRetention(
            inner,
            projectId,
            (hash, revision) => this.#canonical(hash, projectId, revision),
          );
          if (liveRefs.has(row.digest)) return null;
          inner
            .prepare(
              "DELETE FROM asset_versions WHERE version_id = ? AND project_id = ?",
            )
            .run(row.version_id, projectId);
          const shared = inner
            .prepare(
              "SELECT 1 FROM asset_versions WHERE project_id = ? AND digest = ? LIMIT 1",
            )
            .get(projectId, row.digest);
          if (shared) return null;
          inner
            .prepare(
              "DELETE FROM asset_objects WHERE project_id = ? AND digest = ?",
            )
            .run(projectId, row.digest);
          return row.digest;
        });
        if (!digest) continue;
        if (
          await unlink(
            await this.file(
              projectId,
              "objects",
              "sha256",
              digest.slice(0, 2),
              digest,
            ),
          ).then(
            () => true,
            () => false,
          )
        ) {
          report.objects++;
          report.bytes += row.byte_length;
        }
      }
    }
  }
  // Releases a staged version that never joined the project (its conversion
  // failed or was cancelled): the version row goes, and the object goes too
  // unless another version still uses the same bytes.
  async discardStagedVersion(projectId: string, versionId: string) {
    const digest = this.transaction((db) => {
      const version = db
        .prepare(
          "SELECT digest FROM asset_versions WHERE version_id = ? AND project_id = ?",
        )
        .get(versionId, projectId) as { digest: string } | undefined;
      if (!version) return null;
      const head = this.#head(projectId);
      if (
        head &&
        this.#canonical(
          head.snapshot_hash,
          projectId,
          head.revision,
        ).assets.some((a) => a.id === versionId)
      )
        return null;
      db.prepare("DELETE FROM asset_versions WHERE version_id = ?").run(
        versionId,
      );
      const shared = db
        .prepare(
          "SELECT 1 FROM asset_versions WHERE project_id = ? AND digest = ? LIMIT 1",
        )
        .get(projectId, version.digest);
      // The same bytes may also be a Studio bitmap of this project.
      const bitmap = db
        .prepare(
          "SELECT 1 FROM studio_bitmaps WHERE project_id = ? AND digest = ?",
        )
        .get(projectId, version.digest);
      if (shared || bitmap) return null;
      db.prepare(
        "DELETE FROM asset_objects WHERE project_id = ? AND digest = ?",
      ).run(projectId, version.digest);
      return version.digest;
    });
    if (digest) await this.discardUnregisteredObject(projectId, digest);
  }
  // Canonical bytes for portable export: no host paths, tokens or UI state.
  // Exactly the stored serialization: v4 without documents, v5 with them.
  async exportProject(id: string): Promise<ExportedProject> {
    Id.parse(id);
    const head = this.#head(id);
    if (!head) throw new Error("Project not found.");
    return JSON.parse(
      serializeCanonical(
        this.#canonical(head.snapshot_hash, id, head.revision),
      ),
    ) as ExportedProject;
  }
  async list() {
    const rows = this.#database
      .prepare("SELECT project_id FROM projects ORDER BY rowid")
      .all() as { project_id: string }[];
    const known = new Set(rows.map((r) => r.project_id));
    const listed = await Promise.all(
      rows.map(async ({ project_id: id }) => {
        try {
          const p = await this.load(id);
          return { id, name: p.name, revision: p.revision, error: null };
        } catch {
          return {
            id,
            name: "Recovery required",
            revision: null,
            error: "Project cannot be verified.",
          };
        }
      }),
    );
    // Pre-database project folders are reported, never silently adopted (T3 migrates them).
    for (const id of await readdir(await safePath(this.root, "projects")))
      if (Id.safeParse(id).success && !known.has(id))
        listed.push({
          id,
          name: "Legacy project",
          revision: null,
          error: "Legacy project requires migration.",
        });
    return listed;
  }
  // Newest first and bounded: each listed revision is decoded and hash-checked.
  async history(
    id: string,
    limit = 100,
    beforeRevision?: number,
  ): Promise<ProjectHistory> {
    Id.parse(id);
    const head = this.#head(id);
    if (!head) throw new Error("Project not found.");
    const rows = this.#database
      .prepare(
        "SELECT revision, snapshot_hash FROM revisions WHERE project_id = ? AND revision < ? ORDER BY revision DESC LIMIT ?",
      )
      .all(
        id,
        beforeRevision ?? MAX_REVISION + 1,
        Math.min(Math.max(1, limit), 500),
      ) as Head[];
    return {
      projectId: id,
      headFingerprint: ProjectStore.fingerprint(head),
      currentRevision: (() => {
        try {
          return this.#snapshot(head.snapshot_hash, id, head.revision).revision;
        } catch {
          return null;
        }
      })(),
      snapshots: rows.map((r) => {
        try {
          const p = this.#snapshot(r.snapshot_hash, id, r.revision);
          return {
            revision: r.revision,
            name: p.name,
            verified: true,
            error: null,
          };
        } catch {
          return {
            revision: r.revision,
            name: null,
            verified: false,
            error: "Snapshot cannot be verified.",
          };
        }
      }),
    };
  }
  async restore(
    id: string,
    revision: number,
    expectedHeadFingerprint: string | null,
    receipt?: RequestReceipt,
  ) {
    Id.parse(id);
    const row = this.#database
      .prepare(
        "SELECT snapshot_hash FROM revisions WHERE project_id = ? AND revision = ?",
      )
      .get(id, revision) as { snapshot_hash: string } | undefined;
    if (!row) throw new Error("Revision not found.");
    const restoredCanonical = this.#canonical(row.snapshot_hash, id, revision);
    const selected = toEditView(restoredCanonical);
    // Filesystem verification happens before, never inside, the transaction.
    for (const asset of selected.assets) await this.#verifiedAsset(id, asset);
    return this.#commit({
      operation: "project.restore",
      projectId: id,
      expectedRevision: null,
      receipt,
      // A damaged head can still be replaced: the fingerprint covers the head
      // row, not the snapshot bytes it points to.
      check: (head) => {
        if (ProjectStore.fingerprint(head) !== expectedHeadFingerprint)
          throw new CommandError(
            "REVISION_CONFLICT",
            "Revision conflict; refresh history before restoring.",
          );
        // A damaged head may be replaced; a head written by a newer build may not.
        if (this.#newerFormat(head.snapshot_hash))
          throw new CommandError(
            "RECOVERY_REQUIRED",
            "The current revision uses a newer project format; restore it with a newer build.",
          );
      },
      language: () => restoredCanonical.language,
      // The restored revision's own documents, never the head's.
      documents: () => restoredCanonical.documents,
      next: (_current, next) => ({ ...selected, revision: next }),
    });
  }
  // Applies a batch of timeline operations as one revision.
  async applyOperations(
    projectId: string,
    expectedRevision: number,
    // The operations, or (YU-031 story assembly) a builder that makes them
    // from the head inside the commit, so a retry replays and the head the
    // operations were made from is the head they apply to.
    operations: Operation[] | ((head: CanonicalProject) => Operation[]),
    author: string,
    receipt?: RequestReceipt,
    // Checks against the head inside the commit (YU-031 story assembly).
    verify?: (context: DocumentCommitContext) => void,
  ) {
    Id.parse(projectId);
    return this.#commit({
      operation: "project.applyBatch",
      projectId,
      expectedRevision,
      receipt,
      next: (current, revision) => {
        const head = current();
        verify?.({
          db: this.#database,
          project: head,
          documents: this.listDocuments(projectId),
          held: (documentId, hash, kind) =>
            this.#held(projectId, documentId, hash, kind),
          // Read under the write lock, so a consent cannot expire unseen.
          nowMs: Date.now(),
        });
        const canonical = fromEditView(head);
        const ops =
          typeof operations === "function" ? operations(canonical) : operations;
        // A batch holds at most 64 operations; a built assembly may hold
        // more, applied in order within this one revision (it is bounded
        // by the story's own limits).
        let next = canonical;
        for (let i = 0; i < ops.length || i === 0; i += 64)
          next = applyBatch(next, ops.slice(i, i + 64));
        return { ...toEditView(next), revision };
      },
      effects: (db, revision) => {
        const at = this.#cursor(db, projectId);
        const cursor = at?.head_revision === expectedRevision ? at.cursor : 0;
        // A new edit discards anything that could have been redone.
        db.prepare(
          "DELETE FROM edit_history WHERE project_id = ? AND seq > ?",
        ).run(projectId, cursor);
        db.prepare(
          "INSERT INTO edit_history(project_id, seq, revision, before_revision, author) VALUES (?, ?, ?, ?, ?)",
        ).run(projectId, cursor + 1, revision, expectedRevision, author);
        this.#setCursor(db, projectId, cursor + 1, revision);
      },
    });
  }
  // Undo commits a new revision equal to the state before the last batch,
  // and only from the head that batch (or a redo of it) produced.
  async undo(
    projectId: string,
    expectedRevision: number,
    author: string,
    receipt?: RequestReceipt,
  ) {
    return this.#travel(projectId, expectedRevision, "undo", author, receipt);
  }
  async redo(
    projectId: string,
    expectedRevision: number,
    author: string,
    receipt?: RequestReceipt,
  ) {
    return this.#travel(projectId, expectedRevision, "redo", author, receipt);
  }
  #cursor(db: DatabaseSync, projectId: string) {
    return db
      .prepare(
        "SELECT cursor, head_revision FROM edit_cursor WHERE project_id = ?",
      )
      .get(projectId) as Cursor | undefined;
  }
  #setCursor(
    db: DatabaseSync,
    projectId: string,
    cursor: number,
    head: number,
  ) {
    db.prepare(
      "INSERT INTO edit_cursor(project_id, cursor, head_revision) VALUES (?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET cursor = excluded.cursor, head_revision = excluded.head_revision",
    ).run(projectId, cursor, head);
  }
  async #travel(
    projectId: string,
    expectedRevision: number,
    direction: "undo" | "redo",
    author: string,
    receipt?: RequestReceipt,
  ) {
    Id.parse(projectId);
    let target = 0;
    let cursor = 0;
    return this.#commit({
      operation: `project.${direction}`,
      projectId,
      expectedRevision,
      receipt,
      check: (head) => {
        const db = this.#database;
        const at = this.#cursor(db, projectId);
        if (!at || at.head_revision !== head.revision)
          throw new CommandError(
            "REVISION_CONFLICT",
            `Nothing to ${direction} at this revision.`,
          );
        const step = db
          .prepare(
            "SELECT revision, before_revision, author FROM edit_history WHERE project_id = ? AND seq = ?",
          )
          .get(projectId, direction === "undo" ? at.cursor : at.cursor + 1) as
          | { revision: number; before_revision: number; author: string }
          | undefined;
        if (!step)
          throw new CommandError(
            "REVISION_CONFLICT",
            `Nothing to ${direction} at this revision.`,
          );
        // Undo never rewinds another writer's acknowledged work.
        if (step.author !== author)
          throw new CommandError(
            "REVISION_CONFLICT",
            `The edit to ${direction} was made by another client.`,
          );
        target = direction === "undo" ? step.before_revision : step.revision;
        cursor = direction === "undo" ? at.cursor - 1 : at.cursor + 1;
      },
      next: (_current, revision) => {
        const row = this.#database
          .prepare(
            "SELECT snapshot_hash FROM revisions WHERE project_id = ? AND revision = ?",
          )
          .get(projectId, target) as { snapshot_hash: string };
        return {
          ...this.#snapshot(row.snapshot_hash, projectId, target),
          revision,
        };
      },
      effects: (db, revision) =>
        this.#setCursor(db, projectId, cursor, revision),
    });
  }
  async save(
    input: Project,
    expectedRevision: number,
    receipt?: RequestReceipt,
  ) {
    const proposed = ProjectSchema.parse(input);
    if (proposed.revision !== expectedRevision)
      throw new CommandError(
        "REVISION_CONFLICT",
        "Revision conflict; reopen before saving.",
      );
    return this.#commit({
      operation: "project.save",
      projectId: proposed.id,
      expectedRevision,
      receipt,
      next: (current, revision) => {
        // The frame rate is fixed at creation: every frame field and asset
        // duration is counted at it, so a save never reinterprets them.
        const rate = frameRateOf(proposed),
          head = frameRateOf(current());
        if (rate.num !== head.num || rate.den !== head.den)
          throw new CommandError(
            "VALIDATION",
            "A project's frame rate cannot change on save.",
          );
        // With effect writes off (YU-020), a save keeps every clip's effects.
        if (!effectWritesEnabled()) {
          const before = new Map(
            current().clips.map((c) => [
              c.id,
              canonicalJson(c.effects ?? null),
            ]),
          );
          if (
            proposed.clips.some(
              (c) =>
                (before.get(c.id) ?? canonicalJson(null)) !==
                canonicalJson(c.effects ?? null),
            )
          )
            throw new CommandError("CAPABILITY_UNAVAILABLE", EFFECTS_OFF);
        }
        // With transition writes off (YU-021), a save may keep or remove a
        // transition, never add or change one.
        if (!transitionWritesEnabled()) {
          const before = new Map(
            current().clips.map((c) => [
              c.id,
              canonicalJson(c.transition ?? null),
            ]),
          );
          if (
            proposed.clips.some(
              (c) =>
                c.transition !== undefined &&
                before.get(c.id) !== canonicalJson(c.transition),
            )
          )
            throw new CommandError("CAPABILITY_UNAVAILABLE", TRANSITIONS_OFF);
        }
        // Asset identities and immutable metadata come only from the validated import path.
        if (canonicalJson(proposed.assets) !== canonicalJson(current().assets))
          throw new CommandError(
            "VALIDATION",
            "Assets must be added through asset.import.",
          );
        return { ...proposed, revision };
      },
    });
  }
  async #objects(id: string) {
    const rootDir = await this.file(id, "objects");
    await mkdir(rootDir, { recursive: true, mode: 0o700 });
    return new LocalContentAddressedStorage({
      rootDir,
      maxBytes: MAX_ASSET_BYTES,
      // A 4 GiB object on a slow disk needs far more than the default 30 s.
      maxTimeoutMs: 60 * 60 * 1000,
    });
  }
  async #verifiedAsset(id: string, asset: Asset) {
    const objectFile = await this.file(
      id,
      "objects",
      "sha256",
      asset.hash.slice(0, 2),
      asset.hash,
    );
    try {
      if ((await (await this.#objects(id)).verify(asset.hash)) !== asset.bytes)
        throw new Error("Asset integrity check failed.");
      return objectFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // Pre-content-addressing projects stored media by hash and extension.
      const legacy = await this.file(
        id,
        "assets",
        `${asset.hash}.${asset.extension}`,
      );
      const digest = createHash("sha256");
      let length = 0;
      for await (const chunk of createReadStream(legacy)) {
        digest.update(chunk as Buffer);
        length += (chunk as Buffer).length;
      }
      if (digest.digest("hex") !== asset.hash || length !== asset.bytes)
        throw new Error("Asset integrity check failed.");
      return legacy;
    }
  }
  // Streams an upload to a private staging file (hashing as it writes, with
  // a byte budget and a disk preflight), probes it with an owned worker,
  // publishes it to the content-addressed store, and only then commits a
  // snapshot that references it, together with its object/version rows.
  // Memory use is independent of the media size.
  // Stage + attach in one call: the common import path.
  async importAsset(
    id: string,
    name: string,
    source: Buffer | AsyncIterable<Uint8Array>,
    declaredBytes?: number,
  ) {
    const staged = await this.stageAsset(id, name, source, declaredBytes);
    if (staged.probe.variableFrameRate && staged.asset.kind === "video") {
      await this.discardStagedVersion(id, staged.asset.id);
      throw new CommandError(
        "CAPABILITY_UNAVAILABLE",
        "Variable-frame-rate video is imported through a constant-rate conversion job.",
      );
    }
    const project = await this.attachAsset(id, staged.asset);
    return { project, asset: staged.asset, probe: staged.probe };
  }
  // Streams, probes, publishes and registers an asset's object and version,
  // without changing any snapshot. A staged asset can be attached later
  // (after a revision conflict, or once a derivative job has finished)
  // without re-uploading it.
  async stageAsset(
    id: string,
    name: string,
    source: Buffer | AsyncIterable<Uint8Array>,
    declaredBytes?: number,
  ) {
    const p = await this.load(id);
    if (p.assets.length >= RESOURCE_POLICY.enforced.assetsPerProject)
      throw new Error("Asset limit reached.");
    const expected = Buffer.isBuffer(source) ? source.length : declaredBytes;
    if (
      expected === undefined ||
      !Number.isSafeInteger(expected) ||
      expected <= 0 ||
      expected > MAX_ASSET_BYTES
    )
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Asset size is missing or exceeds the limit.",
      );
    const extension = name.split(".").pop()?.toLowerCase() || "";
    if (!/^[a-z0-9]{1,8}$/.test(extension))
      throw new CommandError("MEDIA_INVALID", "Unsupported media extension.");
    await this.#ensureDirectories(id);
    const space = await statfs(this.root);
    // From the checks to taking the slot and the space there is no await, so
    // concurrent imports always see each other's reservations.
    if (this.#importing >= RESOURCE_POLICY.enforced.concurrentImports)
      throw new CommandError("BUSY", "Another import is in progress; retry.");
    // Staging plus the published object, with a reserve left for the system.
    if (
      Number(space.bavail) * Number(space.bsize) <
      2 * expected + RESOURCE_POLICY.enforced.diskReserveBytes + this.#reserved
    )
      throw new Error("Insufficient free disk space.");
    this.#reserved += 2 * expected;
    this.#importing++;
    const assetId = randomUUID();
    let temp: string | null = null;
    let release: (() => void) | null = null;
    const hash = createHash("sha256");
    let received = 0;
    const header: Buffer[] = [];
    let headerBytes = 0;
    const chunks: AsyncIterable<Uint8Array> = Buffer.isBuffer(source)
      ? (async function* () {
          yield source;
        })()
      : source;
    // Every upload must finish within a deadline scaled to its size.
    const deadline = setTimeout(
      () =>
        (source as { destroy?: (e: Error) => void }).destroy?.(
          new CommandError("LIMIT_EXCEEDED", "Upload is too slow."),
        ),
      Math.min(60_000, this.#options.uploadGraceMs ?? 60_000) +
        Math.ceil(expected / RESOURCE_POLICY.enforced.minUploadBytesPerSecond) *
          1000,
    );
    try {
      temp = await this.file(id, "imports", `${assetId}.${extension}`);
      const file = await open(temp, "wx");
      try {
        for await (const chunk of chunks) {
          const bytes = Buffer.from(
            chunk.buffer,
            chunk.byteOffset,
            chunk.byteLength,
          );
          received += bytes.length;
          if (received > expected)
            throw new CommandError(
              "LIMIT_EXCEEDED",
              "Upload is larger than declared.",
            );
          if (headerBytes < 64) {
            header.push(bytes.subarray(0, 64 - headerBytes));
            headerBytes += Math.min(bytes.length, 64 - headerBytes);
            // Reject non-media as soon as its signature is known.
            if (headerBytes === 64)
              mediaHeader(Buffer.concat(header), extension);
          }
          hash.update(bytes);
          this.#options.fault?.("stage-write");
          for (let offset = 0; offset < bytes.length;) {
            const { bytesWritten } = await file.write(bytes, offset);
            offset += bytesWritten;
          }
        }
        await file.sync();
      } finally {
        await file.close();
      }
      // The body has arrived; probing and publication are not upload time.
      clearTimeout(deadline);
      if (received !== expected)
        throw new CommandError(
          "VALIDATION",
          "Upload ended before its declared size.",
        );
      if (headerBytes < 64) mediaHeader(Buffer.concat(header), extension);
      const metadata = await probe(temp);
      const kind = ["png", "jpg", "jpeg", "webp"].includes(extension)
        ? "image"
        : metadata.hasVideo
          ? "video"
          : "audio";
      const durationFrames =
        kind === "image"
          ? 0
          : durationFramesAt(metadata.durationTicks, frameRateOf(p));
      if (
        (kind === "image" && !metadata.hasVideo) ||
        (kind !== "image" && durationFrames < 1)
      )
        throw new Error("Media duration or image stream is invalid.");
      const asset: Asset = AssetSchema.parse({
        id: assetId,
        name: name.slice(0, 120),
        kind,
        extension,
        hash: hash.digest("hex"),
        bytes: received,
        width: metadata.width,
        height: metadata.height,
        // Frames at the project's rate, floored: a final partial frame is
        // not addressable.
        durationFrames,
        hasAudio:
          kind === "video"
            ? metadata.hasAudio
            : kind === "audio"
              ? true
              : false,
      });
      // Publish by streaming the staged bytes; the store re-hashes them. The
      // handle opens eagerly and closes before cleanup, so no deferred open
      // can race the staging file's removal.
      this.#options.fault?.("stage-publish");
      release = await this.beginPublication(id);
      const source = await open(temp, "r");
      let stored;
      try {
        stored = await (
          await this.#objects(id)
        ).put(
          source.createReadStream({
            autoClose: false,
          }) as AsyncIterable<Uint8Array>,
        );
      } finally {
        await source.close();
      }
      if (stored.sha256 !== asset.hash || stored.byteLength !== asset.bytes)
        throw new Error("Asset integrity check failed.");
      const probeRecord = JSON.stringify({
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        hasVideo: metadata.hasVideo,
        hasAudio: metadata.hasAudio,
        timebase: metadata.timebase,
        frameRate: metadata.frameRate,
        averageFrameRate: metadata.averageFrameRate,
        variableFrameRate: metadata.variableFrameRate,
        color: metadata.color,
      });
      this.transaction((db) => registerAsset(db, id, asset, probeRecord));
      return {
        asset,
        probe: JSON.parse(probeRecord) as Record<string, unknown> & {
          variableFrameRate: boolean;
          frameRate: { num: number; den: number } | null;
          averageFrameRate: { num: number; den: number } | null;
        },
      };
    } finally {
      release?.();
      clearTimeout(deadline);
      this.#reserved -= 2 * expected;
      this.#importing--;
      if (temp) await unlink(temp).catch(() => {});
    }
  }
  // Adds an asset whose object is published and ready. The append commutes
  // with concurrent edits, so it applies to whichever head is current.
  // `effects` run in the same transaction (a job's success, for example), and
  // an exception there commits nothing.
  async attachAsset(
    id: string,
    asset: Asset,
    effects?: (db: DatabaseSync) => void,
  ) {
    return this.#commit({
      operation: "asset.import",
      projectId: id,
      expectedRevision: null,
      effects: (db) => {
        effects?.(db);
        const object = db
          .prepare(
            "SELECT state, byte_length FROM asset_objects WHERE project_id = ? AND digest = ?",
          )
          .get(id, asset.hash) as
          { state: string; byte_length: number } | undefined;
        if (object?.state !== "ready" || object.byte_length !== asset.bytes)
          throw new CommandError(
            "RECOVERY_REQUIRED",
            "Only a published, ready media object can be attached.",
          );
      },
      next: (current, revision) => {
        const head = current();
        if (head.assets.length >= RESOURCE_POLICY.enforced.assetsPerProject)
          throw new Error("Asset limit reached.");
        if (head.assets.some((a) => a.id === asset.id))
          throw new CommandError("VALIDATION", "Asset is already attached.");
        return { ...head, revision, assets: [...head.assets, asset] };
      },
    });
  }
  // Path of a verified media object, for workers that read it.
  async objectFile(id: string, asset: Asset) {
    return this.#verifiedAsset(id, asset);
  }
  // Records a derivative version (for example a constant-rate mezzanine) of a
  // logical asset, with its probe and lineage. Runs inside a transaction.
  static registerDerivative(
    db: DatabaseSync,
    projectId: string,
    derivative: { id: string; hash: string; bytes: number },
    probe: Record<string, unknown>,
  ) {
    const versionId = derivative.id;
    registerAsset(
      db,
      projectId,
      { id: versionId, hash: derivative.hash, bytes: derivative.bytes },
      JSON.stringify(probe),
    );
    return versionId;
  }
  // Recorded probe and object state for one asset version.
  assetVersion(versionId: string) {
    const row = this.#database
      .prepare(
        "SELECT v.version_id, v.project_id, v.digest, v.probe, o.byte_length, o.state FROM asset_versions v JOIN asset_objects o ON o.project_id = v.project_id AND o.digest = v.digest WHERE v.version_id = ?",
      )
      .get(versionId) as
      | {
          version_id: string;
          project_id: string;
          digest: string;
          probe: string | null;
          byte_length: number;
          state: string;
        }
      | undefined;
    return row
      ? {
          versionId: row.version_id,
          projectId: row.project_id,
          digest: row.digest,
          bytes: row.byte_length,
          state: row.state,
          probe: row.probe === null ? null : JSON.parse(row.probe),
        }
      : null;
  }
  // Serving and rendering path: the object was hash-verified when it was
  // published and is registered ready, so only its size is checked here.
  // Whole-object re-hashing belongs to import, restore and scrubbing.
  async assetFile(id: string, assetId: string) {
    const p = await this.load(id);
    const a = p.assets.find((a) => a.id === Id.parse(assetId));
    if (!a) throw new Error("Asset not found.");
    // The project's rate: the asset's durationFrames count its frames.
    return {
      file: await this.readyObjectFile(id, a),
      asset: a,
      frameRate: frameRateOf(p),
    };
  }
  /** YU-025: the project's approved source replacements, newest first. */
  assetReplacements(projectId: string) {
    Id.parse(projectId);
    return this.#database
      .prepare(
        "SELECT revision, from_asset_id AS fromAssetId, from_hash AS fromHash, to_asset_id AS toAssetId, to_hash AS toHash, clips, principal_id AS principalId, created_at AS createdAt FROM asset_replacements WHERE project_id = ? ORDER BY revision DESC LIMIT 200",
      )
      .all(projectId);
  }
  async repairAsset(projectId: string, assetId: string) {
    Id.parse(projectId);
    Id.parse(assetId);
    const version = this.assetVersion(assetId);
    if (!version || version.projectId !== projectId)
      throw new CommandError("NOT_FOUND", "Asset version was not found.");
    if (version.state !== "quarantined")
      throw new CommandError(
        "VALIDATION",
        "Only a quarantined asset can be repaired.",
      );
    const head = await this.load(projectId);
    const asset = head.assets.find((a) => a.id === assetId);
    if (!asset)
      throw new CommandError(
        "VALIDATION",
        "The asset is not attached to the project head.",
      );
    const file = await this.file(
      projectId,
      "objects",
      "sha256",
      version.digest.slice(0, 2),
      version.digest,
    );
    const result = await verifyAndProbe(file, version.digest, version.bytes);
    if (!result.released)
      return { released: false as const, reason: result.reason };
    const probeRecord = JSON.stringify({
      format: result.probed.format,
      width: result.probed.width,
      height: result.probed.height,
      hasVideo: result.probed.hasVideo,
      hasAudio: result.probed.hasAudio,
      timebase: result.probed.timebase,
      frameRate: result.probed.frameRate,
      averageFrameRate: result.probed.averageFrameRate,
      color: result.probed.color,
      variableFrameRate: result.probed.variableFrameRate,
    });
    this.transaction((db) => {
      db.prepare(
        "UPDATE asset_objects SET state = 'ready' WHERE project_id = ? AND digest = ? AND state = 'quarantined'",
      ).run(projectId, version.digest);
      db.prepare(
        "UPDATE asset_versions SET probe = ? WHERE version_id = ? AND project_id = ?",
      ).run(probeRecord, assetId, projectId);
    });
    return { released: true as const };
  }
  // The file of a published object, by its hash: the object row is ready and
  // the file has the recorded size (bytes are re-hashed on import, restore
  // and scrub, not on every read). Renders resolve their plan's assets this
  // way, so a frozen revision renders even after the asset left the head.
  async readyObjectFile(
    id: string,
    a: { hash: string; bytes: number; extension: string },
  ) {
    if (!/^[a-f0-9]{64}$/.test(a.hash))
      throw new CommandError("VALIDATION", "Asset hash is invalid.");
    // Only the canonical media extensions: a crafted extension could
    // otherwise name a path outside this project.
    if (!AssetSchema.shape.extension.safeParse(a.extension).success)
      throw new CommandError("VALIDATION", "Asset extension is invalid.");
    const object = this.#database
      .prepare(
        "SELECT state FROM asset_objects WHERE project_id = ? AND digest = ?",
      )
      .get(id, a.hash) as { state: string } | undefined;
    for (const parts of [
      ["objects", "sha256", a.hash.slice(0, 2), a.hash],
      ["assets", `${a.hash}.${a.extension}`],
    ]) {
      const file = await this.file(id, ...parts);
      const info = await lstat(file).catch(() => null);
      if (object?.state === "ready" && info?.isFile() && info.size === a.bytes)
        return file;
    }
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "Asset object is missing, damaged or not ready.",
    );
  }
  // Committed events in order, for progress/resume by cursor.
  events(afterEventId = 0, limit = 100) {
    return this.#database
      .prepare(
        "SELECT event_id AS eventId, project_id AS projectId, revision, operation FROM outbox WHERE event_id > ? ORDER BY event_id LIMIT ?",
      )
      .all(afterEventId, Math.min(Math.max(1, limit), 1000)) as {
      eventId: number;
      projectId: string;
      revision: number;
      operation: string;
    }[];
  }
  createAgentToken(scopes: ReadonlySet<Scope>, label?: string) {
    const agentId = newAgentId();
    const token = newAgentToken();
    const tokenHash = hashAgentToken(token);
    this.#database
      .prepare(
        "INSERT INTO agent_tokens(agent_id, token_hash, scopes, label, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        agentId,
        tokenHash,
        encodeAgentScopes(scopes),
        label ?? null,
        new Date().toISOString(),
      );
    return { agentId, token, scopes: [...scopes] };
  }
  revokeAgentToken(agentId: string) {
    const changed = this.#database
      .prepare(
        "UPDATE agent_tokens SET revoked = 1 WHERE agent_id = ? AND revoked = 0",
      )
      .run(agentId).changes;
    if (!changed)
      throw new CommandError("NOT_FOUND", "Agent token was not found.");
    return { agentId, revoked: true as const };
  }
  principalForAgentToken(token: string): Principal | null {
    const row = this.#database
      .prepare(
        "SELECT agent_id, scopes, revoked FROM agent_tokens WHERE token_hash = ?",
      )
      .get(hashAgentToken(token)) as
      { agent_id: string; scopes: string; revoked: number } | undefined;
    if (!row || row.revoked) return null;
    return {
      id: row.agent_id as Principal["id"],
      scopes: parseAgentScopes(row.scopes),
    };
  }
}
