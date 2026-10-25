// YU-013: one-time import of the pre-database Director files
// (<workspace>/director/run-*.json, consent-*.json, encoding-*.json) into the
// workspace database. Explicit and idempotent (rows keep their ids; a retry
// imports nothing twice), bounded, and read-only on the files: originals
// stay. Runs are mapped by their existing project id only; a run naming no
// project of this workspace is reported, not imported. What is imported
// starts under a fresh execution epoch: its approvals must be given again
// and its consents revalidated before any new encoding.
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CommandError } from "../command/errors.ts";
import { ConsentRecordSchema, IdentityEncodingSchema } from "../identity.ts";
import { DirectorRunSchema } from "./stages.ts";
import { bumpDirectorEpoch } from "./runtime.ts";
import type { ProjectStore } from "../store.ts";

const FILE = /^(run|consent|encoding)-([0-9a-f-]{36})\.json$/;
const MAX_FILES = 10_000;
const MAX_FILE_BYTES = 1024 * 1024;

export type LegacyDirectorReport = {
  runs: number;
  attempts: number;
  consents: number;
  revocations: number;
  encodings: number;
  skipped: { file: string; reason: string }[];
  epoch: number | null;
};

async function readBounded(file: string) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
    throw new Error("Not a plain file.");
  if (info.size > MAX_FILE_BYTES) throw new Error("The file is too large.");
  return JSON.parse(await readFile(file, "utf8")) as unknown;
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
    epoch: null,
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
  const parsed = { run: [], consent: [], encoding: [] } as {
    run: { file: string; value: ReturnType<typeof DirectorRunSchema.parse> }[];
    consent: {
      file: string;
      value: ReturnType<typeof ConsentRecordSchema.parse>;
    }[];
    encoding: {
      file: string;
      value: ReturnType<typeof IdentityEncodingSchema.parse>;
    }[];
  };
  for (const name of names) {
    const match = FILE.exec(name);
    if (!match) continue;
    try {
      const raw = await readBounded(path.join(dir, name));
      const kind = match[1] as "run" | "consent" | "encoding";
      const value =
        kind === "run"
          ? DirectorRunSchema.parse(raw)
          : kind === "consent"
            ? ConsentRecordSchema.parse(raw)
            : IdentityEncodingSchema.parse(raw);
      if (value.id !== match[2])
        throw new Error("The id differs from the file name.");
      (parsed[kind] as { file: string; value: unknown }[]).push({
        file: name,
        value,
      });
    } catch (e) {
      report.skipped.push({
        file: name.slice(0, 128),
        reason:
          e instanceof Error && !/[\\/]/.test(e.message)
            ? e.message.slice(0, 200)
            : "The file is not a valid Director record.",
      });
    }
  }
  // Runs belong to projects of this workspace only.
  const projects = new Set<string>();
  for (const { value } of parsed.run)
    if (
      await store.load(value.projectId).then(
        () => true,
        () => false,
      )
    )
      projects.add(value.projectId);
  return store.transaction((db) => {
    const now = Date.now();
    const epoch = (
      db
        .prepare("SELECT value FROM director_epoch WHERE singleton = 1")
        .get() as { value: number }
    ).value;
    for (const { file, value } of parsed.consent) {
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
          epoch,
        );
      report.consents += Number(added.changes);
      if (value.revokedAtMs !== null) {
        const revoked = db
          .prepare(
            "INSERT INTO consent_revocations(consent_id, revoked_at, principal_id) VALUES (?, ?, ?) ON CONFLICT(consent_id) DO NOTHING",
          )
          .run(value.id, value.revokedAtMs, `legacy:${file}`);
        report.revocations += Number(revoked.changes);
      }
    }
    for (const { file, value } of parsed.encoding) {
      const consent = db
        .prepare("SELECT 1 FROM likeness_consents WHERE id = ?")
        .get(value.consentId);
      if (!consent) {
        report.skipped.push({ file, reason: "Its consent is not recorded." });
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
    for (const { file, value } of parsed.run) {
      if (!projects.has(value.projectId)) {
        report.skipped.push({
          file,
          reason: "Its project is not in this workspace.",
        });
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
      // Each legacy receipt becomes its stage's attempt; an approval is kept
      // as history but belongs to the epoch before this import.
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
          epoch,
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
    if (report.runs || report.consents || report.encodings)
      report.epoch = bumpDirectorEpoch(db);
    return report;
  });
}
