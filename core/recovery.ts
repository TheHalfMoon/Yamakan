// Recovery (plan T9): online workspace backups, restore into a new root and
// read-only diagnosis. A backup is a database copy taken online plus every
// ready content object it registers, each re-hashed as it is copied, and a
// manifest written last; a folder without a manifest is not a backup.
// Restore never writes into an existing workspace: it builds a new root,
// verifies every byte against the manifest and the content addresses, and
// quarantines what it cannot verify instead of failing the whole restore.
//
// The manifest and the database copy sit in the same folder, so the
// manifest's hashes detect corruption, truncation and partial copies, not
// deliberate tampering; the restore receipt names the manifest's hash for
// an out-of-band check.
import { createReadStream } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  statfs,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { z } from "zod";
import { Id, ProjectSchema } from "./project.ts";
import { initializeRoot, safePath } from "./paths.ts";
import { CommandError } from "./command/errors.ts";
import { RESOURCE_POLICY } from "./command/policy.ts";
import { inspectWal } from "./wal.ts";
import { restrictToOwner } from "./process/access.ts";
import { fromEditView, parseCanonical } from "./canonical.ts";
import type { CanonicalProject } from "./canonical.ts";
import type { ProjectStore, RequestReceipt } from "./store.ts";

// Format 2 (YU-014) adds the legacy workspace files and the creative closure
// of the database copy; format 1 backups stay restorable, labelled as not
// proving a complete creative scope.
export const BACKUP_FORMAT = "yamakan.backup/2";
const BACKUP_FORMAT_V1 = "yamakan.backup/1";
export const RESTORE_FORMAT = "yamakan.restore/2";
const Digest = z.string().regex(/^[0-9a-f]{64}$/);
export const BackupId = z.string().regex(/^\d{8}T\d{6}Z-[0-9a-f]{8}$/);
// Restores kept per backup; older restored folders are the user's to remove.
const MAX_RESTORES_PER_BACKUP = 20;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;

// What a backup leaves out, stated in every manifest: derived files that
// are rebuilt from the database (exports, previews), in-flight staging, and
// secrets and locks that belong to one running service.
const EXCLUDED = [
  "token",
  "launch",
  "service.lock",
  "projects/*/exports",
  "projects/*/imports",
  "projects/*/cache",
];

// Damaged entries name database rows as found, which may be malformed; they
// are data only and never become paths.
const Reported = z.string().max(200);

// What a restore of a format 2 backup does with copied state, stated in the
// manifest so a reader need not know this build.
const RESTORE_POLICY = [
  "A restore creates a new workspace folder; the original is never changed.",
  "Jobs active in the original (cancel requests included) wait for an explicit retry or discard; their attempts are failed.",
  "Staged document uploads are dropped; agent tokens are revoked.",
  "Director approvals are void and likeness consents need revalidation (new execution epoch).",
  "Unverifiable media is quarantined, unverifiable legacy files are left out, and unresolved documents are reported; the restore receipt names each.",
];

// Workspace files kept outside the database by earlier builds: Cinema scene
// sidecars (YU-012 migrates them into projects) and Director records
// (YU-013 imports them). A backup copies them as found, so a restore can
// still migrate them; only names those builds wrote are copied.
const LEGACY = {
  // Scene ids are written as given, so either case (core/documents-legacy.ts).
  cinema:
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.json$/,
  director: /^(run|consent|encoding)-[0-9a-f-]{36}\.json$/,
} as const;
type LegacyFolder = keyof typeof LEGACY;
const LEGACY_LIMITS = {
  files: 10_000,
  bytes: 256 * 1024 * 1024,
  // Invalid entries recorded per folder before the folder is marked "limit".
  invalid: 1_000,
};
// Closure gaps named in a manifest or receipt; the counts stay exact.
const MAX_REPORTED = 200;
const LegacyPath = z
  .string()
  .max(120)
  .refine((p) => {
    const [folder, name, ...rest] = p.split("/");
    return (
      rest.length === 0 &&
      Object.hasOwn(LEGACY, folder) &&
      LEGACY[folder as LegacyFolder].test(name ?? "")
    );
  });
const ClosureSchema = z
  .object({
    documents: z.number().int().nonnegative(),
    objects: z.number().int().nonnegative(),
    gaps: z.number().int().nonnegative(),
    reported: z
      .array(
        z
          .object({
            projectId: Reported,
            kind: z.enum(["snapshot", "document", "object"]),
            ref: Reported,
            reason: z.enum(["missing", "mismatch", "unreadable"]),
          })
          .strict(),
      )
      .max(MAX_REPORTED),
  })
  .strict();
const ManifestSchema = z
  .object({
    format: z.enum([BACKUP_FORMAT, BACKUP_FORMAT_V1]),
    backupId: BackupId,
    createdAt: z.iso.datetime(),
    schemaVersion: z.number().int().positive(),
    database: z
      .object({ sha256: Digest, bytes: z.number().int().positive() })
      .strict(),
    projects: z.array(
      z
        .object({
          projectId: Id,
          revision: z.number().int().nonnegative(),
          snapshotHash: Digest,
        })
        .strict(),
    ),
    objects: z.array(
      z
        .object({
          projectId: Id,
          digest: Digest,
          bytes: z.number().int().positive(),
        })
        .strict(),
    ),
    damaged: z.array(
      z
        .object({
          projectId: Reported,
          digest: Reported,
          reason: z.enum(["missing", "mismatch", "invalid"]),
        })
        .strict(),
    ),
    excluded: z.array(z.string().max(80)),
    // Format 2 only.
    legacyFiles: z
      .array(
        z
          .object({
            path: LegacyPath,
            sha256: Digest,
            bytes: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(LEGACY_LIMITS.files)
      // Each file once, and no more bytes than a backup copies.
      .refine(
        (files) =>
          // Names differing only in case are one file on Windows.
          new Set(files.map((f) => f.path.toLowerCase())).size ===
            files.length &&
          files.reduce((n, f) => n + f.bytes, 0) <= LEGACY_LIMITS.bytes,
      )
      .optional(),
    legacyDamaged: z
      .array(
        z
          .object({
            path: Reported,
            reason: z.enum(["invalid", "changed", "limit"]),
          })
          .strict(),
      )
      // Copy failures (at most one per file) plus each folder's bounded
      // invalid entries and its final mark.
      .max(LEGACY_LIMITS.files + 2 * (LEGACY_LIMITS.invalid + 2))
      .optional(),
    closure: ClosureSchema.optional(),
    restorePolicy: z.array(z.string().max(200)).max(20).optional(),
  })
  .strict()
  .refine(
    (m) =>
      (m.format === BACKUP_FORMAT) ===
      (m.legacyFiles !== undefined &&
        m.legacyDamaged !== undefined &&
        m.closure !== undefined &&
        m.restorePolicy !== undefined),
    "Format 2 manifests (only) declare legacy files and closure.",
  );
export type BackupManifest = z.infer<typeof ManifestSchema>;
// Whether a backup proves the complete creative scope: format 2, every
// object copied, every legacy file copied, and a closed reference graph.
const creativeScope = (m: BackupManifest) =>
  m.format === BACKUP_FORMAT &&
  m.damaged.length === 0 &&
  m.legacyDamaged!.length === 0 &&
  m.closure!.gaps === 0
    ? ("complete" as const)
    : ("incomplete" as const);
type Damage = BackupManifest["damaged"][number];

type Head = { projectId: string; revision: number; snapshotHash: string };
type ObjectRow = { projectId: string; digest: string; bytes: number };

// What a backup reads from: the running store, or an offline workspace.
export type BackupSource = {
  readonly root: string;
  // Bytes other work has promised on the same volume (in-flight imports).
  readonly reservedBytes: number;
  backupDatabase(destination: string): Promise<void>;
  holdObjects(): () => void;
};

// The canonical place of an object below a root; every part is validated,
// so a manifest or database row cannot name another path.
const objectParts = (projectId: string, digest: string) => [
  "projects",
  Id.parse(projectId),
  "objects",
  "sha256",
  Digest.parse(digest).slice(0, 2),
  digest,
];

const isInside = (parent: string, child: string) => {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};
// Neither folder may contain the other: a backup inside the workspace
// would copy itself, and a workspace inside the backups would be backed up
// with them.
export async function assertSeparate(root: string, other: string) {
  // Each path resolves through its nearest ancestor that resolves at all
  // (a junction or link to its target), so a folder that does not exist
  // yet is judged by where it will be.
  const real = async (p: string) => {
    let base = path.resolve(p);
    for (;;) {
      const resolved = await realpath(base).catch(() => null);
      if (resolved)
        return path.join(resolved, path.relative(base, path.resolve(p)));
      if (path.dirname(base) === base) return path.resolve(p);
      base = path.dirname(base);
    }
  };
  // Windows paths compare without case; POSIX paths with it.
  const fold = (p: string) =>
    process.platform === "win32" ? p.toLowerCase() : p;
  const a = fold(await real(root));
  const b = fold(await real(other));
  if (isInside(a, b) || isInside(b, a))
    throw new CommandError(
      "VALIDATION",
      "Backups and restores must be outside the workspace folder.",
    );
}

const sha256File = async (file: string) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};
const sizeOf = async (file: string) =>
  (await lstat(file).catch(() => null))?.size ?? 0;
const freeBytes = async (dir: string) => {
  const space = await statfs(dir);
  return Number(space.bavail) * Number(space.bsize);
};
// The nearest folder that exists (a restore target may not yet).
async function existingAncestor(p: string) {
  for (let dir = path.resolve(p); ; dir = path.dirname(dir)) {
    if ((await lstat(dir).catch(() => null))?.isDirectory()) return dir;
    if (path.dirname(dir) === dir) return dir;
  }
}
// Space for `bytes` more, keeping the policy's reserve and what other work
// on the volume has already promised.
async function requireSpace(dir: string, bytes: number, reserved = 0) {
  if (
    (await freeBytes(dir)) <
    bytes + reserved + RESOURCE_POLICY.enforced.diskReserveBytes
  )
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "Not enough free disk space for this recovery operation.",
    );
}

// Copies a file to `target` through a private partial file, hashing as it
// goes; the target appears (by rename) only if the bytes match.
async function copyVerified(
  source: string,
  target: string,
  expected: { sha256: string; bytes: number },
): Promise<"ok" | "missing" | "mismatch"> {
  const info = await lstat(source).catch(() => null);
  if (!info?.isFile()) return "missing";
  if (info.size !== expected.bytes) return "mismatch";
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const partial = `${target}.partial-${randomBytes(4).toString("hex")}`;
  const hash = createHash("sha256");
  let written = 0;
  const out = await open(partial, "wx", 0o600);
  try {
    for await (const chunk of createReadStream(source)) {
      const bytes = chunk as Buffer;
      hash.update(bytes);
      written += bytes.length;
      for (let offset = 0; offset < bytes.length;) {
        const { bytesWritten } = await out.write(bytes, offset);
        offset += bytesWritten;
      }
    }
    await out.sync();
  } catch (e) {
    await out.close().catch(() => {});
    await rm(partial, { force: true });
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw e;
  }
  await out.close();
  if (written !== expected.bytes || hash.digest("hex") !== expected.sha256) {
    await rm(partial, { force: true });
    return "mismatch";
  }
  await rename(partial, target);
  return "ok";
}

function integrity(db: DatabaseSync) {
  const rows = db.prepare("PRAGMA integrity_check(20)").all() as {
    integrity_check: string;
  }[];
  return rows.length === 1 && rows[0].integrity_check === "ok"
    ? null
    : rows.map((r) => r.integrity_check);
}
const userVersion = (db: DatabaseSync) =>
  (db.prepare("PRAGMA user_version").get() as { user_version: number })
    .user_version;
function heads(db: DatabaseSync): Head[] {
  return (
    db
      .prepare(
        "SELECT project_id, revision, snapshot_hash FROM projects ORDER BY project_id",
      )
      .all() as {
      project_id: string;
      revision: number;
      snapshot_hash: string;
    }[]
  ).map((r) => ({
    projectId: r.project_id,
    revision: r.revision,
    snapshotHash: r.snapshot_hash,
  }));
}
function readyObjects(db: DatabaseSync): ObjectRow[] {
  return (
    db
      .prepare(
        "SELECT project_id, digest, byte_length FROM asset_objects WHERE state = 'ready' ORDER BY project_id, digest",
      )
      .all() as { project_id: string; digest: string; byte_length: number }[]
  ).map((r) => ({
    projectId: r.project_id,
    digest: r.digest,
    bytes: r.byte_length,
  }));
}
// A row whose project id or digest cannot name an object path.
const malformed = (o: { projectId: string; digest: string }) =>
  !Id.safeParse(o.projectId).success || !Digest.safeParse(o.digest).success;

// The file holding an object in a live workspace: the content-addressed
// path, or the pre-v2 `assets/<hash>.<extension>` layout.
async function sourceObject(root: string, projectId: string, digest: string) {
  const canonical = await safePath(root, ...objectParts(projectId, digest));
  if ((await lstat(canonical).catch(() => null))?.isFile()) return canonical;
  const assets = await safePath(root, "projects", projectId, "assets");
  for (const name of await readdir(assets).catch(() => [] as string[]))
    if (/^[0-9a-f]{64}\.[a-z0-9]{1,8}$/.test(name) && name.startsWith(digest))
      return safePath(assets, name);
  return canonical;
}

type LegacyFile = { path: string; bytes: number };
type LegacyDamage = NonNullable<BackupManifest["legacyDamaged"]>[number];

// The legacy files of a workspace, as found: plain files with a name the
// earlier builds wrote, in plain folders. A folder or file that is a link
// or junction is never followed; it is recorded instead.
async function scanLegacy(root: string) {
  const files: LegacyFile[] = [];
  const damaged: LegacyDamage[] = [];
  let bytes = 0;
  for (const folder of Object.keys(LEGACY) as LegacyFolder[]) {
    // Joined, not resolved: a junction must be seen as one, not followed.
    const dir = path.join(root, folder);
    const info = await lstat(dir).catch(() => null);
    if (!info) continue;
    if (!info.isDirectory() || info.isSymbolicLink()) {
      damaged.push({ path: folder, reason: "invalid" });
      continue;
    }
    const names = await readdir(dir).catch(() => null);
    if (!names) {
      damaged.push({ path: folder, reason: "invalid" });
      continue;
    }
    let invalid = 0;
    const refuse = (entry: string) => {
      invalid++;
      damaged.push({ path: entry, reason: "invalid" });
    };
    for (const name of names.sort()) {
      if (!LEGACY[folder].test(name)) continue;
      if (invalid >= LEGACY_LIMITS.invalid) {
        damaged.push({ path: folder, reason: "limit" });
        break;
      }
      const file = await safePath(root, folder, name).catch(() => null);
      if (!file) {
        damaged.push({ path: folder, reason: "invalid" });
        break;
      }
      const entry = await lstat(file).catch(() => null);
      if (!entry) continue;
      if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) {
        refuse(`${folder}/${name}`);
        continue;
      }
      if (
        files.length >= LEGACY_LIMITS.files ||
        bytes + entry.size > LEGACY_LIMITS.bytes
      ) {
        damaged.push({ path: folder, reason: "limit" });
        break;
      }
      bytes += entry.size;
      files.push({ path: `${folder}/${name}`, bytes: entry.size });
    }
  }
  return { files, damaged };
}

// Copies legacy files into `<backup>/legacy/`, each hashed as read and
// verified as written. A file replaced while it is copied (a Cinema save
// renames over its scene) is read once more; one that keeps changing is
// recorded, not copied.
async function copyLegacy(root: string, files: LegacyFile[], dir: string) {
  const copied: NonNullable<BackupManifest["legacyFiles"]> = [];
  const damaged: LegacyDamage[] = [];
  let total = 0;
  for (const file of files) {
    let done = false;
    let reason: LegacyDamage["reason"] = "changed";
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      const source = await safePath(root, ...file.path.split("/")).catch(
        () => null,
      );
      if (!source) {
        reason = "invalid";
        break;
      }
      const info = await lstat(source).catch(() => null);
      if (!info?.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
        reason = "invalid";
        break;
      }
      // A file that grew since the scan still fits the backup's bound.
      if (total + info.size > LEGACY_LIMITS.bytes) {
        reason = "limit";
        break;
      }
      const expected = {
        sha256: await sha256File(source).catch(() => ""),
        bytes: info.size,
      };
      if (!expected.sha256) continue;
      const result = await copyVerified(
        source,
        await safePath(dir, "legacy", ...file.path.split("/")),
        expected,
      );
      if (result === "ok") {
        copied.push({ path: file.path, ...expected });
        total += expected.bytes;
        done = true;
      }
    }
    if (!done) damaged.push({ path: file.path, reason });
  }
  return { copied, damaged };
}

export function defaultRecoveryHome(root: string) {
  return path.join(path.dirname(root), `${path.basename(root)}-recovery`);
}

// One recovery operation (backup or restore) at a time per process: each
// may write as much as the workspace holds.
let running = false;
async function exclusive<T>(work: () => Promise<T>) {
  if (running)
    throw new CommandError(
      "BUSY",
      "A backup or restore is already running; retry when it finishes.",
    );
  running = true;
  try {
    return await work();
  } finally {
    running = false;
  }
}

// Backs up a workspace into `<home>/backups/<id>`. With a running store,
// edits, imports and jobs continue meanwhile; the backup is the state at
// the moment its database copy completed.
export function backupWorkspace(
  source: BackupSource,
  home: string,
  options: { now?: Date; backupId?: string } = {},
) {
  return exclusive(async () => {
    const release = source.holdObjects();
    let dir: string | null = null;
    try {
      const now = options.now ?? new Date();
      const backupId =
        options.backupId ??
        `${now
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}-${randomBytes(4).toString("hex")}`;
      BackupId.parse(backupId);
      await assertSeparate(source.root, home);
      await mkdir(home, { recursive: true });
      // Backups hold the whole workspace: private to this account too.
      await restrictToOwner(home, "dir");
      const backups = await safePath(home, "backups");
      await mkdir(backups, { recursive: true });
      const target = await safePath(home, "backups", backupId);
      // The database copy is at most the database plus its log.
      const live = path.join(source.root, "workspace.sqlite");
      await requireSpace(
        backups,
        (await sizeOf(live)) + (await sizeOf(`${live}-wal`)),
        source.reservedBytes,
      );
      await mkdir(target);
      dir = target;
      const database = path.join(dir, "workspace.sqlite");
      await source.backupDatabase(database);
      const copy = new DatabaseSync(database);
      let schemaVersion: number,
        projects: Head[],
        objects: ObjectRow[],
        closure: Closure;
      try {
        // The copy is a standalone file: no write-ahead log beside it.
        copy.exec("PRAGMA journal_mode = DELETE");
        const problems = integrity(copy);
        if (problems)
          throw new CommandError(
            "RECOVERY_REQUIRED",
            `The database copy failed its integrity check: ${problems[0]}`,
          );
        schemaVersion = userVersion(copy);
        projects = heads(copy);
        objects = readyObjects(copy);
        closure = creativeClosure(copy);
      } finally {
        copy.close();
      }
      const legacy = await scanLegacy(source.root);
      await requireSpace(
        dir,
        objects.reduce((n, o) => n + o.bytes, 0) +
          legacy.files.reduce((n, f) => n + f.bytes, 0),
        source.reservedBytes,
      );
      const copied: ObjectRow[] = [];
      const damaged: Damage[] = [];
      for (const object of objects) {
        if (malformed(object)) {
          damaged.push({ ...reported(object), reason: "invalid" });
          continue;
        }
        const result = await copyVerified(
          await sourceObject(source.root, object.projectId, object.digest),
          await safePath(dir, ...objectParts(object.projectId, object.digest)),
          { sha256: object.digest, bytes: object.bytes },
        );
        if (result === "ok") copied.push(object);
        else damaged.push({ ...reported(object), reason: result });
      }
      const legacyFiles = await copyLegacy(source.root, legacy.files, dir);
      const manifest: BackupManifest = {
        format: BACKUP_FORMAT,
        backupId,
        createdAt: now.toISOString(),
        schemaVersion,
        database: {
          sha256: await sha256File(database),
          bytes: (await lstat(database)).size,
        },
        projects,
        objects: copied,
        damaged,
        excluded: EXCLUDED,
        legacyFiles: legacyFiles.copied,
        legacyDamaged: [...legacy.damaged, ...legacyFiles.damaged],
        closure,
        restorePolicy: RESTORE_POLICY,
      };
      ManifestSchema.parse(manifest);
      // Written last and atomically: its presence marks a complete backup.
      const partial = path.join(dir, "backup.json.partial");
      const handle = await open(partial, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(manifest, null, 2));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(partial, path.join(dir, "backup.json"));
      return summary(manifest);
    } catch (e) {
      // Only the folder this backup created is removed.
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
      throw e;
    } finally {
      release();
    }
  });
}

const reported = (o: { projectId: string; digest: string }) => ({
  projectId: String(o.projectId).slice(0, 200),
  digest: String(o.digest).slice(0, 200),
});

const legacyBytes = (m: BackupManifest) =>
  (m.legacyFiles ?? []).reduce((n, f) => n + f.bytes, 0);
const summary = (m: BackupManifest) => ({
  backupId: m.backupId,
  createdAt: m.createdAt,
  complete: true as const,
  format: m.format,
  // "complete" only when the backup proves every creative reference and
  // legacy file was kept; a format 1 backup never does.
  creative: creativeScope(m),
  projects: m.projects.length,
  objects: m.objects.length,
  legacyFiles: m.legacyFiles?.length ?? 0,
  bytes:
    m.database.bytes +
    m.objects.reduce((n, o) => n + o.bytes, 0) +
    legacyBytes(m),
  damaged: m.damaged.length + (m.legacyDamaged?.length ?? 0),
  closureGaps: m.closure?.gaps ?? null,
});

async function readManifest(dir: string) {
  const file = path.join(dir, "backup.json");
  const info = await lstat(file);
  if (!info.isFile() || info.size > MAX_MANIFEST_BYTES)
    throw new Error("backup.json is not a regular file of bounded size.");
  return ManifestSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

// Backups in a recovery home, newest first. A folder without a valid
// manifest is listed as incomplete and cannot be restored.
export async function listBackups(home: string) {
  const result: (
    ReturnType<typeof summary> | { backupId: string; complete: false }
  )[] = [];
  const backups = await safePath(home, "backups").catch(() => null);
  if (!backups) return result;
  for (const name of await readdir(backups).catch(() => [] as string[])) {
    if (!BackupId.safeParse(name).success) continue;
    try {
      const manifest = await readManifest(await safePath(backups, name));
      if (manifest.backupId !== name) throw new Error("Mismatched backup id.");
      result.push(summary(manifest));
    } catch {
      result.push({ backupId: name, complete: false });
    }
  }
  return result.sort((a, b) => b.backupId.localeCompare(a.backupId));
}

// Restores a backup into a new, empty root and returns the restore receipt
// (also written as `restore.json` in the new root).
export function restoreWorkspace(
  backupDir: string,
  newRoot: string,
  options: { reservedBytes?: number } = {},
) {
  return exclusive(() => restore(backupDir, newRoot, options));
}

const RESTORED_JOB =
  "Restored from a backup: this job was active in the original workspace. Retry or discard it.";
const RESTORED_CANCEL =
  "Restored from a backup: the original workspace had asked to cancel this job. Discard it, or retry to run it after all.";
const RESTORED_ATTEMPT =
  "Restored from a backup: this attempt belonged to the original workspace's service.";

type Fenced = {
  directorEpoch: number | null;
  jobsHeld: number;
  attemptsFenced: number;
  uploadsDropped: number;
  agentTokensRevoked: number;
};

// Restore fencing (YU-013b), in the restore's own transaction, before any
// service can open the new root: nothing copied from the original workspace
// may act on its own. The original may still be running, so
//   - active jobs, cancel requests included, wait for an explicit retry or
//     discard (which also releases a conversion's staged original), and
//     their attempts are failed;
//   - the supervisor generation moves on, fencing any copied attempt;
//   - staged document uploads, which belong to a client of the original,
//     are dropped (consumed ones stay: they replay a committed result);
//   - agent tokens are revoked: an old snapshot never restores authority;
//   - a fresh Director epoch voids approvals and requires consents to be
//     revalidated (YU-013).
// Recorded history (receipts, Director requests, migrations) stays as it was.
function fenceRestored(db: DatabaseSync): Fenced {
  const run = (sql: string, ...args: (string | number)[]) =>
    Number(db.prepare(sql).run(...args).changes);
  const fenced: Fenced = {
    directorEpoch: null,
    jobsHeld: 0,
    attemptsFenced: 0,
    uploadsDropped: 0,
    agentTokensRevoked: 0,
  };
  if (has(db, "jobs")) {
    fenced.attemptsFenced = run(
      "UPDATE attempts SET state = 'failed', error = ? WHERE state IN ('preparing', 'running', 'validating')",
      RESTORED_ATTEMPT,
    );
    // Each a legal transition (core/jobs/rules/yamakan-transitions.ts).
    fenced.jobsHeld = run(
      "UPDATE jobs SET state = 'reconciliationRequired', error = CASE WHEN cancel_requested = 1 OR state = 'cancelRequested' THEN ? ELSE ? END, cancel_requested = 0, progress = 0 WHERE state IN ('queued', 'preparing', 'running', 'validating', 'cancelRequested')",
      RESTORED_CANCEL,
      RESTORED_JOB,
    );
    run("UPDATE supervisor SET generation = generation + 1 WHERE id = 1");
  }
  if (has(db, "document_uploads"))
    fenced.uploadsDropped = run(
      "DELETE FROM document_uploads WHERE state <> 'consumed'",
    );
  if (has(db, "agent_tokens"))
    fenced.agentTokensRevoked = run(
      "UPDATE agent_tokens SET revoked = 1 WHERE revoked = 0",
    );
  // A backup older than schema v12 has no Director tables; its legacy
  // files, once imported, belong to no live epoch either.
  if (has(db, "director_epoch")) {
    run("UPDATE director_epoch SET value = value + 1 WHERE singleton = 1");
    fenced.directorEpoch = (
      db
        .prepare("SELECT value FROM director_epoch WHERE singleton = 1")
        .get() as {
        value: number;
      }
    ).value;
  }
  return fenced;
}

async function restore(
  backupDir: string,
  newRoot: string,
  options: { reservedBytes?: number },
) {
  let manifest: BackupManifest;
  try {
    manifest = await readManifest(backupDir);
  } catch {
    throw new CommandError(
      "VALIDATION",
      "This folder is not a complete Yamakan backup (backup.json is missing or invalid).",
    );
  }
  const root = path.resolve(newRoot);
  let existed = true;
  try {
    if ((await readdir(root)).length > 0)
      throw new CommandError(
        "VALIDATION",
        "Restore destination must be a new, empty folder.",
      );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    existed = false;
  }
  // Checked before anything is created.
  await assertSeparate(root, backupDir);
  const total =
    manifest.database.bytes +
    manifest.objects.reduce((n, o) => n + o.bytes, 0) +
    legacyBytes(manifest);
  await requireSpace(
    await existingAncestor(root),
    total,
    options.reservedBytes,
  );
  let initialized = false;
  try {
    await initializeRoot(root);
    initialized = true;
    await restrictToOwner(root, "dir");
    // The database is verified and fenced under a staging name and becomes
    // the workspace's only as the last step: a crash or a failed cleanup
    // never leaves an unfenced copy that a service would open.
    const database = path.join(root, "restore.partial.sqlite");
    if (
      (await copyVerified(path.join(backupDir, "workspace.sqlite"), database, {
        sha256: manifest.database.sha256,
        bytes: manifest.database.bytes,
      })) !== "ok"
    )
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "The backup's database does not match its manifest.",
      );
    let restored: Head[];
    let ready: ObjectRow[];
    const check = new DatabaseSync(database, { readOnly: true });
    try {
      const problems = integrity(check);
      if (problems)
        throw new CommandError(
          "RECOVERY_REQUIRED",
          `The restored database failed its integrity check: ${problems[0]}`,
        );
      // The workspace schema has no triggers or views; one in a backup
      // could undo the restore fencing, so such a database is refused.
      if (
        check
          .prepare(
            "SELECT 1 FROM sqlite_master WHERE type IN ('trigger', 'view') OR sql LIKE 'CREATE VIRTUAL%' LIMIT 1",
          )
          .get()
      )
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "The backup's database holds triggers, views or virtual tables this workspace never creates.",
        );
      if (userVersion(check) !== manifest.schemaVersion)
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "The restored database's version does not match the backup manifest.",
        );
      restored = heads(check);
      if (JSON.stringify(restored) !== JSON.stringify(manifest.projects))
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "The restored project heads do not match the backup manifest.",
        );
      ready = readyObjects(check);
    } finally {
      check.close();
    }
    // Every object the database registers as ready must be verified here;
    // anything else (recorded as damaged, absent from the manifest, altered
    // in the backup, or malformed) is quarantined.
    const listed = new Map(
      manifest.objects.map((o) => [`${o.projectId}/${o.digest}`, o]),
    );
    const recorded = new Map(
      manifest.damaged.map((d) => [`${d.projectId}/${d.digest}`, d.reason]),
    );
    const quarantined: { projectId: string; digest: string; reason: string }[] =
      [];
    const toQuarantine: ObjectRow[] = [];
    let verified = 0;
    for (const row of ready) {
      const key = `${row.projectId}/${row.digest}`;
      const entry = listed.get(key);
      let result: string = malformed(row)
        ? "invalid"
        : (recorded.get(key) ?? "unlisted");
      if (entry && !malformed(row) && entry.bytes === row.bytes) {
        const parts = objectParts(row.projectId, row.digest);
        result = await copyVerified(
          await safePath(backupDir, ...parts),
          await safePath(root, ...parts),
          { sha256: row.digest, bytes: row.bytes },
        );
      }
      if (result === "ok") verified++;
      else {
        quarantined.push({ ...reported(row), reason: result });
        // The database is updated with the row as found, not as reported.
        toQuarantine.push(row);
      }
    }
    // Legacy files are verified like objects; one that does not match is
    // left out (the restore receipt names it), never written.
    const legacyQuarantined: { path: string; reason: string }[] = [];
    let legacyRestored = 0;
    for (const file of manifest.legacyFiles ?? []) {
      const parts = file.path.split("/");
      const result = await copyVerified(
        await safePath(backupDir, "legacy", ...parts),
        await safePath(root, ...parts),
        file,
      );
      if (result === "ok") legacyRestored++;
      else legacyQuarantined.push({ path: file.path, reason: result });
    }
    // What could not be verified is kept registered but never served.
    const db = new DatabaseSync(database);
    let fenced: Fenced;
    let closure: Closure;
    try {
      const quarantine = db.prepare(
        "UPDATE asset_objects SET state = 'quarantined' WHERE project_id = ? AND digest = ?",
      );
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const q of toQuarantine) quarantine.run(q.projectId, q.digest);
        fenced = fenceRestored(db);
        db.exec("COMMIT");
      } catch (e) {
        if (db.isTransaction) db.exec("ROLLBACK");
        throw e;
      }
      closure = creativeClosure(db);
    } finally {
      db.close();
    }
    const receipt = {
      format: RESTORE_FORMAT,
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      manifestSha256: createHash("sha256")
        .update(await readFile(path.join(backupDir, "backup.json")))
        .digest("hex"),
      restoredAt: new Date().toISOString(),
      database: manifest.database,
      projects: restored,
      objectsVerified: verified,
      quarantined,
      backupFormat: manifest.format,
      // Complete only when the backup proved its creative scope and this
      // restore verified all of it: every object, legacy file and reference.
      creative:
        creativeScope(manifest) === "complete" &&
        quarantined.length === 0 &&
        legacyQuarantined.length === 0 &&
        closure.gaps === 0
          ? ("complete" as const)
          : ("incomplete" as const),
      legacyRestored,
      legacyQuarantined,
      closure,
      fenced,
    };
    // Fenced and closed: now it is the workspace's database.
    await rename(database, path.join(root, "workspace.sqlite"));
    const partial = path.join(root, "restore.json.partial");
    await writeFile(partial, JSON.stringify(receipt, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    await rename(partial, path.join(root, "restore.json"));
    return { root, ...receipt };
  } catch (e) {
    // Only what this restore made is removed: the folder if it created it,
    // otherwise (the folder was empty) its contents.
    if (!existed)
      await rm(root, { recursive: true, force: true }).catch(() => {});
    else if (initialized)
      for (const name of await readdir(root).catch(() => [] as string[]))
        await rm(path.join(root, name), { recursive: true, force: true }).catch(
          () => {},
        );
    throw e;
  }
}

async function resumeBackupSummary(home: string, backupId: string) {
  try {
    const manifest = await readManifest(
      await safePath(home, "backups", BackupId.parse(backupId)),
    );
    if (manifest.backupId !== backupId) return null;
    return summary(manifest);
  } catch {
    return null;
  }
}

async function resumeRestoreResult(home: string, effectRef: string) {
  try {
    const root = await safePath(home, ...effectRef.split("/"));
    const file = path.join(root, "restore.json");
    const info = await lstat(file);
    if (!info.isFile() || info.size > MAX_MANIFEST_BYTES) return null;
    const receipt = JSON.parse(await readFile(file, "utf8"));
    return { root, ...receipt };
  } catch {
    return null;
  }
}

export async function backupWorkspaceIdempotent(
  store: ProjectStore,
  home: string,
  receipt: RequestReceipt,
  options: { now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const suffix = createHash("sha256")
    .update(`${receipt.principalId}:${receipt.requestId}:${receipt.digest}`)
    .digest("hex")
    .slice(0, 8);
  const backupId = `${stamp}-${suffix}`;
  return store.runIdempotentRecovery(
    receipt,
    "yamakan.workspace.backup",
    backupId,
    (ref) => resumeBackupSummary(home, ref),
    (ref) => backupWorkspace(store, home, { ...options, now, backupId: ref }),
  );
}

function idempotentRestoreRef(backupId: string, receipt: RequestReceipt) {
  const id = BackupId.parse(backupId);
  const tag = createHash("sha256")
    .update(`${receipt.principalId}:${receipt.requestId}:${receipt.digest}`)
    .digest("hex");
  // One folder per request id; sequential slots stay for non-idempotent restores.
  return `restored/${id}-req-${tag}`;
}

export async function restoreFromHomeIdempotent(
  store: ProjectStore,
  home: string,
  backupId: string,
  receipt: RequestReceipt,
  options: { reservedBytes?: number } = {},
) {
  const id = BackupId.parse(backupId);
  const effectRef = idempotentRestoreRef(id, receipt);
  return store.runIdempotentRecovery(
    receipt,
    "yamakan.workspace.restore",
    effectRef,
    (ref) => resumeRestoreResult(home, ref),
    async (ref) => {
      const dir = await safePath(home, "backups", id);
      if (!(await lstat(dir).catch(() => null))?.isDirectory())
        throw new CommandError("NOT_FOUND", "Backup not found.");
      const target = await safePath(home, ...ref.split("/"));
      return restoreWorkspace(dir, target, options);
    },
  );
}

export async function restoreFromHome(
  home: string,
  backupId: string,
  options: { reservedBytes?: number } = {},
) {
  const id = BackupId.parse(backupId);
  const dir = await safePath(home, "backups", id);
  if (!(await lstat(dir).catch(() => null))?.isDirectory())
    throw new CommandError("NOT_FOUND", "Backup not found.");
  await mkdir(await safePath(home, "restored"), { recursive: true });
  for (let n = 1; n <= MAX_RESTORES_PER_BACKUP; n++) {
    const target = await safePath(home, "restored", `${id}-${n}`);
    if (await lstat(target).catch(() => null)) continue;
    return restoreWorkspace(dir, target, options);
  }
  throw new CommandError(
    "LIMIT_EXCEEDED",
    `This backup has been restored ${MAX_RESTORES_PER_BACKUP} times; remove older restored folders first.`,
  );
}

// An offline workspace as a backup source (no service may be running: the
// caller holds the service lock). The database is read through a read-only
// connection and never upgraded; a damaged write-ahead log is refused.
export async function offlineSource(root: string) {
  const file = await safePath(root, "workspace.sqlite");
  if (!(await lstat(file).catch(() => null))?.isFile())
    throw new CommandError(
      "NOT_FOUND",
      "No workspace database in this folder.",
    );
  if ((await inspectWal(`${file}-wal`))?.damaged)
    throw new CommandError(
      "RECOVERY_REQUIRED",
      "The workspace's write-ahead log is damaged; diagnose it before backing up.",
    );
  const sides = [`${file}-wal`, `${file}-shm`];
  const present = await Promise.all(
    sides.map((p) =>
      lstat(p).then(
        () => true,
        () => false,
      ),
    ),
  );
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    root,
    reservedBytes: 0,
    backupDatabase: (destination: string) =>
      backup(db, destination, { rate: -1 }).then(() => {}),
    holdObjects: () => () => {},
    // Closes the connection and removes only side files it created.
    async close() {
      db.close();
      for (const [i, side] of sides.entries())
        if (!present[i]) await unlink(side).catch(() => {});
    },
  };
}

// Reads a workspace without changing it: the write-ahead log is inspected
// in place (read only), the database and its log are examined as copies in
// a scratch folder, and objects are read in place. Suitable for a workspace
// the service refuses to open.
export async function diagnoseWorkspace(
  root: string,
  options: { verifyObjects?: boolean; scratch?: string } = {},
) {
  const file = await safePath(root, "workspace.sqlite");
  const size = async (p: string) =>
    (await lstat(p).catch(() => null))?.size ?? null;
  const report = {
    database: {
      bytes: await size(file),
      walBytes: await size(`${file}-wal`),
      shmBytes: await size(`${file}-shm`),
      wal: await inspectWal(`${file}-wal`),
      schemaVersion: null as number | null,
      integrity: null as string[] | null,
      error: null as string | null,
    },
    projects: [] as Head[],
    objects: {
      ready: 0,
      quarantined: 0,
      missing: [] as ObjectRow[],
      mismatched: [] as ObjectRow[],
      invalid: [] as ObjectRow[],
      verified: 0,
    },
    unregisteredFiles: 0,
  };
  if (report.database.bytes === null) {
    report.database.error = "workspace.sqlite is missing.";
    return report;
  }
  const scratchParent = options.scratch ?? tmpdir();
  if (
    (await freeBytes(scratchParent)) <
    report.database.bytes + (report.database.walBytes ?? 0) + 64 * 1024 * 1024
  )
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "Not enough free space in the scratch folder to examine a copy of the database; choose another with --scratch.",
    );
  const scratch = await mkdtemp(path.join(scratchParent, "yamakan-diagnose-"));
  try {
    const copy = path.join(scratch, "workspace.sqlite");
    await copyFile(file, copy);
    if (report.database.walBytes !== null)
      await copyFile(`${file}-wal`, `${copy}-wal`);
    let db: DatabaseSync | null = null;
    let rows: {
      project_id: string;
      digest: string;
      byte_length: number;
      state: string;
    }[] = [];
    try {
      db = new DatabaseSync(copy);
      report.database.schemaVersion = userVersion(db);
      report.database.integrity = integrity(db) ?? ["ok"];
      report.projects = heads(db);
      rows = db
        .prepare(
          "SELECT project_id, digest, byte_length, state FROM asset_objects ORDER BY project_id, digest",
        )
        .all() as typeof rows;
    } catch (e) {
      report.database.error = (e as Error).message;
    } finally {
      db?.close();
    }
    const registered = new Set(rows.map((r) => `${r.project_id}/${r.digest}`));
    for (const row of rows) {
      if (row.state === "quarantined") report.objects.quarantined++;
      if (row.state !== "ready") continue;
      report.objects.ready++;
      const object = {
        projectId: row.project_id,
        digest: row.digest,
        bytes: row.byte_length,
      };
      if (malformed(object)) {
        report.objects.invalid.push(object);
        continue;
      }
      const source = await sourceObject(root, row.project_id, row.digest);
      const info = await lstat(source).catch(() => null);
      if (!info?.isFile()) report.objects.missing.push(object);
      else if (info.size !== row.byte_length)
        report.objects.mismatched.push(object);
      else if (options.verifyObjects) {
        if ((await sha256File(source)) === row.digest)
          report.objects.verified++;
        else report.objects.mismatched.push(object);
      }
    }
    const projectsDir = await safePath(root, "projects");
    for (const id of await readdir(projectsDir).catch(() => [] as string[])) {
      if (!Id.safeParse(id).success) continue;
      const top = await safePath(projectsDir, id, "objects", "sha256");
      for (const prefix of await readdir(top).catch(() => [] as string[]))
        for (const digest of await readdir(path.join(top, prefix)).catch(
          () => [] as string[],
        ))
          if (
            /^[0-9a-f]{64}$/.test(digest) &&
            !registered.has(`${id}/${digest}`)
          )
            report.unregisteredFiles++;
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return report;
}

// Whether a diagnosis found nothing wrong.
export const healthy = (r: Awaited<ReturnType<typeof diagnoseWorkspace>>) =>
  !r.database.error &&
  !r.database.wal?.damaged &&
  r.database.integrity?.[0] === "ok" &&
  r.objects.missing.length === 0 &&
  r.objects.mismatched.length === 0 &&
  r.objects.invalid.length === 0;

function probeDerivedFromDigest(probe: string | null): string | null {
  if (!probe) return null;
  try {
    const value = JSON.parse(probe) as { derivedFrom?: { digest?: string } };
    const digest = value.derivedFrom?.digest;
    return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
      ? digest
      : null;
  } catch {
    return null;
  }
}

export function isHiddenVfrOriginal(probe: string | null): boolean {
  if (!probe) return false;
  try {
    return JSON.parse(probe).variableFrameRate === true;
  } catch {
    return false;
  }
}

// Digests retained revisions still reference, including variable-frame-rate
// originals named by a derivative's lineage.
export function referencedDigestsInRetention(
  db: DatabaseSync,
  projectId: string,
  canonicalAt: (snapshotHash: string, revision: number) => CanonicalProject,
): Set<string> {
  const refs = new Set<string>();
  const rows = db
    .prepare(
      "SELECT revision, snapshot_hash FROM revisions WHERE project_id = ?",
    )
    .all(projectId) as { revision: number; snapshot_hash: string }[];
  for (const row of rows) {
    const project = canonicalAt(row.snapshot_hash, row.revision);
    for (const asset of project.assets) {
      refs.add(asset.hash);
      const version = db
        .prepare(
          "SELECT probe FROM asset_versions WHERE version_id = ? AND project_id = ?",
        )
        .get(asset.id, projectId) as { probe: string | null } | undefined;
      const lineage = probeDerivedFromDigest(version?.probe ?? null);
      if (lineage) refs.add(lineage);
    }
  }
  return refs;
}

// Creative closure of a workspace database (YU-014): everything the retained
// revisions of every project name, checked against what the database holds.
// It runs on a backup's own database copy (the destination snapshot), so
// edits committed while the backup runs never change it, and again on a
// restored database after quarantine. A reference that does not resolve is
// reported, never repaired.
// The snapshot format of the editing shape (core/store.ts EDIT_VIEW_FORMAT);
// named here because the store imports this module.
const EDIT_VIEW_FORMAT = "yamakan.edit-view/1";

export type ClosureGap = {
  projectId: string;
  kind: "snapshot" | "document" | "object";
  ref: string;
  reason: "missing" | "mismatch" | "unreadable";
};
export type Closure = {
  documents: number;
  objects: number;
  gaps: number;
  reported: ClosureGap[];
};

const has = (db: DatabaseSync, table: string) =>
  db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) !== undefined;

export function creativeClosure(db: DatabaseSync): Closure {
  const closure: Closure = { documents: 0, objects: 0, gaps: 0, reported: [] };
  const gap = (g: ClosureGap) => {
    closure.gaps++;
    // Data as found (a malformed row may name anything): bounded, as the
    // manifest schema requires.
    if (closure.reported.length < MAX_REPORTED)
      closure.reported.push({
        ...g,
        projectId: String(g.projectId).slice(0, 200),
        ref: String(g.ref).slice(0, 200),
      });
  };
  const documentsTable = has(db, "creative_documents");
  const ready = db.prepare(
    "SELECT 1 FROM asset_objects WHERE project_id = ? AND digest = ? AND state = 'ready'",
  );
  const snapshot = db.prepare(
    "SELECT format, bytes FROM snapshots WHERE hash = ?",
  );
  const studioBitmap = has(db, "studio_bitmaps")
    ? db.prepare(
        "SELECT 1 FROM studio_bitmaps WHERE project_id = ? AND digest = ?",
      )
    : null;
  const document = documentsTable
    ? db.prepare(
        "SELECT bytes, object_digests FROM creative_documents WHERE hash = ?",
      )
    : null;
  const projects = db
    .prepare("SELECT project_id FROM projects ORDER BY project_id")
    .all() as { project_id: string }[];
  for (const { project_id: projectId } of projects) {
    const parsed = new Map<string, CanonicalProject | null>();
    // As the store reads a snapshot (ProjectStore#canonical), cached by
    // hash: one snapshot names the same references at any revision.
    const canonicalAt = (hash: string, revision: number) => {
      if (!parsed.has(hash)) {
        let project: CanonicalProject | null = null;
        const row = snapshot.get(hash) as
          { format: string; bytes: Uint8Array } | undefined;
        try {
          const text = row ? Buffer.from(row.bytes).toString("utf8") : "";
          if (row && createHash("sha256").update(text).digest("hex") === hash) {
            const value: unknown = JSON.parse(text);
            project =
              row.format === EDIT_VIEW_FORMAT
                ? fromEditView(ProjectSchema.parse(value))
                : parseCanonical(value);
            if (project.id !== projectId) project = null;
          }
        } catch {
          project = null;
        }
        if (!project)
          gap({
            projectId,
            kind: "snapshot",
            ref: `${hash}@${revision}`,
            reason: row ? "unreadable" : "missing",
          });
        parsed.set(hash, project);
      }
      // An unreadable snapshot names nothing more; it is already a gap.
      return (
        parsed.get(hash) ??
        ({ assets: [], documents: [] } as unknown as CanonicalProject)
      );
    };
    const media = referencedDigestsInRetention(db, projectId, canonicalAt);
    const bitmaps = new Set<string>();
    const documents = new Set<string>();
    for (const project of parsed.values())
      for (const ref of project?.documents ?? [])
        documents.add(ref.contentHash);
    for (const hash of [...documents].sort()) {
      closure.documents++;
      const row = document?.get(hash) as
        { bytes: Uint8Array; object_digests: string } | undefined;
      if (!row) {
        gap({ projectId, kind: "document", ref: hash, reason: "missing" });
        continue;
      }
      if (createHash("sha256").update(row.bytes).digest("hex") !== hash) {
        gap({ projectId, kind: "document", ref: hash, reason: "mismatch" });
        continue;
      }
      let digests: unknown;
      try {
        digests = JSON.parse(row.object_digests);
      } catch {
        digests = null;
      }
      if (!Array.isArray(digests)) {
        gap({ projectId, kind: "document", ref: hash, reason: "unreadable" });
        continue;
      }
      for (const digest of digests) bitmaps.add(String(digest));
    }
    for (const digest of [...new Set([...media, ...bitmaps])].sort()) {
      closure.objects++;
      if (
        !ready.get(projectId, digest) ||
        (bitmaps.has(digest) && !studioBitmap?.get(projectId, digest))
      )
        gap({ projectId, kind: "object", ref: digest, reason: "missing" });
    }
  }
  return closure;
}
