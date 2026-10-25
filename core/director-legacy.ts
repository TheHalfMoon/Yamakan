// YU-013: one-time import of the pre-database Director files
// (<workspace>/director/run-*.json, consent-*.json, encoding-*.json) into the
// workspace database. Explicit and idempotent (rows keep their ids; a retry
// imports nothing twice), bounded, and read-only on the files: originals
// stay. Runs are mapped by their existing project id only; a run naming no
// project of this workspace is reported, not imported. Imported state
// belongs to no current epoch (epoch 0): its approvals must be given again
// and its consents revalidated before any new encoding, while live state
// already in the database is untouched.
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { CommandError } from "./command/errors.ts";
import { ConsentRecordSchema, IdentityEncodingSchema } from "./identity.ts";
import { DirectorRunSchema } from "./director/stages.ts";
import type { ProjectStore } from "./store.ts";

const FILE = /^(run|consent|encoding)-([0-9a-f-]{36})\.json$/;
const MAX_FILES = 10_000;
const MAX_FILE_BYTES = 1024 * 1024;
// Bytes read per import, across all files.
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
// Skipped files listed in the report.
const MAX_REPORTED = 200;
// Imported rows carry no live epoch.
const LEGACY_EPOCH = 0;

export type LegacyDirectorReport = {
  runs: number;
  attempts: number;
  consents: number;
  revocations: number;
  encodings: number;
  skipped: { file: string; reason: string }[];
  skippedTotal: number;
};

// One plain, single-link file of at most MAX_FILE_BYTES, opened once and
// checked on the handle (a swap after lstat is refused).
async function readBounded(file: string) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
    throw new Error("Not a plain file.");
  if (info.size > MAX_FILE_BYTES) throw new Error("The file is too large.");
  const handle = await open(file, "r");
  try {
    const opened = await handle.stat();
    if (
      opened.ino !== info.ino ||
      opened.size !== info.size ||
      opened.nlink !== 1
    )
      throw new Error("The file changed while it was read.");
    const bytes = Buffer.alloc(info.size);
    // Reads may return less than asked: read until the file's size.
    let read = 0;
    while (read < bytes.length) {
      const { bytesRead } = await handle.read(
        bytes,
        read,
        bytes.length - read,
        read,
      );
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    if (read !== info.size)
      throw new Error("The file changed while it was read.");
    return {
      value: JSON.parse(bytes.toString("utf8")) as unknown,
      size: info.size,
    };
  } finally {
    await handle.close();
  }
}

export async function importLegacyDirector(
  store: ProjectStore,
): Promise<LegacyDirectorReport> {
  const dir = path.join(store.root, "director");
  const report: LegacyDirectorReport = {
    runs: 0,
    attempts: 0,
    consents: 0,
    revocations: 0,
    encodings: 0,
    skipped: [],
    skippedTotal: 0,
  };
  const skip = (file: string, reason: string) => {
    report.skippedTotal++;
    if (report.skipped.length < MAX_REPORTED)
      report.skipped.push({ file: file.slice(0, 128), reason });
  };
  const info = await lstat(dir).catch(() => null);
  if (!info) return report;
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new CommandError(
      "VALIDATION",
      "The workspace's director folder is not a plain folder; it is not read.",
    );
  const names = (await readdir(dir)).sort();
  if (names.length > MAX_FILES)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `The director folder holds more than ${MAX_FILES} files.`,
    );
  const runs: ReturnType<typeof DirectorRunSchema.parse>[] = [];
  const consents: ReturnType<typeof ConsentRecordSchema.parse>[] = [];
  const encodings: ReturnType<typeof IdentityEncodingSchema.parse>[] = [];
  const files = new Map<object, string>();
  let budget = MAX_TOTAL_BYTES;
  for (const name of names) {
    const match = FILE.exec(name);
    if (!match) continue;
    try {
      const { value: raw, size } = await readBounded(path.join(dir, name));
      budget -= size;
      if (budget < 0)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          `The director files exceed ${MAX_TOTAL_BYTES} bytes in total; nothing was imported.`,
        );
      const kind = match[1] as "run" | "consent" | "encoding";
      const value =
        kind === "run"
          ? DirectorRunSchema.parse(raw)
          : kind === "consent"
            ? ConsentRecordSchema.parse(raw)
            : IdentityEncodingSchema.parse(raw);
      if (value.id !== match[2])
        throw new Error("The id differs from the file name.");
      files.set(value, name);
      if (kind === "run") runs.push(value as (typeof runs)[number]);
      else if (kind === "consent")
        consents.push(value as (typeof consents)[number]);
      else encodings.push(value as (typeof encodings)[number]);
    } catch (e) {
      if (e instanceof CommandError) throw e;
      skip(
        name,
        e instanceof Error && !/[\\/]/.test(e.message)
          ? e.message.slice(0, 200)
          : "The file is not a valid Director record.",
      );
    }
  }
  // Runs belong to projects of this workspace only (each looked up once).
  const known = new Map<string, boolean>();
  for (const run of runs)
    if (!known.has(run.projectId))
      known.set(
        run.projectId,
        await store.load(run.projectId).then(
          () => true,
          () => false,
        ),
      );
  return store.transaction((db) => {
    const now = Date.now();
    for (const value of consents) {
      const added = db
        .prepare(
          "INSERT INTO likeness_consents(id, character_id, purpose, version, granted_at, expires_at, grantor_principal_id, epoch) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        )
        .run(
          value.id,
          value.characterId,
          value.purpose,
          value.version,
          value.grantedAtMs,
          value.expiresAtMs,
          value.grantorPrincipalId,
          LEGACY_EPOCH,
        );
      report.consents += Number(added.changes);
      if (value.revokedAtMs !== null) {
        const revoked = db
          .prepare(
            "INSERT INTO consent_revocations(consent_id, revoked_at, principal_id) VALUES (?, ?, ?) ON CONFLICT(consent_id) DO NOTHING",
          )
          .run(value.id, value.revokedAtMs, `legacy:${files.get(value)}`);
        report.revocations += Number(revoked.changes);
      }
    }
    for (const value of encodings) {
      const consent = db
        .prepare("SELECT character_id FROM likeness_consents WHERE id = ?")
        .get(value.consentId) as { character_id: string } | undefined;
      if (!consent) {
        skip(files.get(value)!, "Its consent is not recorded.");
        continue;
      }
      // An encoding is only ever of its consent's character.
      if (consent.character_id !== value.characterId) {
        skip(files.get(value)!, "Its character differs from its consent's.");
        continue;
      }
      const added = db
        .prepare(
          "INSERT INTO identity_encodings(id, character_id, consent_id, provider, method, payload_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        )
        .run(
          value.id,
          value.characterId,
          value.consentId,
          value.provider,
          value.method,
          value.payloadHash,
          now,
        );
      report.encodings += Number(added.changes);
    }
    for (const value of runs) {
      const file = files.get(value)!;
      if (!known.get(value.projectId)) {
        skip(file, "Its project is not in this workspace.");
        continue;
      }
      const added = db
        .prepare(
          "INSERT INTO director_runs(id, project_id, pipeline_name, version, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        )
        .run(
          value.id,
          value.projectId,
          value.pipelineName,
          1,
          now,
          `legacy:${file}`,
        );
      if (!added.changes) continue;
      report.runs++;
      // Each legacy receipt becomes its stage's attempt. Its output is
      // verified whenever the run is read (core/director/runtime.ts), and
      // its approval, from no live epoch, must be given again.
      let seq = 1;
      const insert = db.prepare(
        "INSERT INTO director_attempts(run_id, seq, stage, kind, status, output_hash, approval_expires_at, epoch, principal_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const r of value.receipts) {
        insert.run(
          value.id,
          seq++,
          r.stage,
          r.humanApproved ? "approve" : "advance",
          r.status,
          r.humanApproved ? r.approvedOutputHash : r.outputHash,
          r.humanApproved ? r.approvalExpiresAtMs : null,
          LEGACY_EPOCH,
          `legacy:${file}`,
          now,
        );
        report.attempts++;
      }
      db.prepare("UPDATE director_runs SET version = ? WHERE id = ?").run(
        seq,
        value.id,
      );
    }
    return report;
  });
}
