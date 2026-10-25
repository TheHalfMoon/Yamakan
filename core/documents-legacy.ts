// Legacy Cinema sidecars (YU-012). Before creative documents, a saved scene
// was a mutable workspace file, <workspace>/cinema/<sceneId>.json, with no
// project and no compare-and-swap. This module inventories those files
// read-only and migrates one, on an explicit request naming its project,
// into that project's canonical `cinemaScene` document. Nothing here infers
// ownership or writes, renames or deletes a sidecar: originals stay as they
// were, and each migration leaves a receipt in the workspace database.
import { createHash } from "node:crypto";
import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";
import { CommandError } from "./command/errors.ts";
import {
  DOCUMENT_LIMITS,
  DOCUMENT_SCHEMA_VERSIONS,
  validateDocument,
} from "./documents.ts";
import type { RequestReceipt, ProjectStore } from "./store.ts";

// Canonical lowercase UUID file names only; anything else is reported, never
// read as a scene (an upper-case alias names the same file on Windows).
const SIDECAR =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/;
// Inventory bound: entries examined per call.
export const SIDECAR_INVENTORY_LIMIT = 10_000;

export type SidecarState = "valid" | "invalid";
export type SidecarEntry = {
  name: string;
  sceneId: string | null;
  state: SidecarState;
  reason?: string;
  byteLength?: number;
  // SHA-256 of the file's bytes: a migration must name it.
  sourceSha256?: string;
  // The canonical document hash the scene would have.
  contentHash?: string;
  migrations: ReturnType<ProjectStore["legacyMigrations"]>;
};

const sidecarDir = (store: ProjectStore) => path.join(store.root, "cinema");

// The folder itself must be a real folder of this workspace (not a link to
// somewhere else); missing means there is nothing to migrate.
async function folder(store: ProjectStore) {
  const dir = sidecarDir(store);
  const info = await lstat(dir).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!info) return null;
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new CommandError(
      "VALIDATION",
      "The workspace's cinema folder is not a plain folder; it is not read.",
    );
  return dir;
}

// Reads one sidecar exactly once, bounded, refusing links and oversize files.
async function readSidecar(dir: string, name: string) {
  const file = path.join(dir, name);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink())
    throw new CommandError("VALIDATION", "Not a plain file.");
  if (info.size === 0)
    throw new CommandError("VALIDATION", "The file is empty.");
  if (info.size > DOCUMENT_LIMITS.documentBytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      `The file exceeds ${DOCUMENT_LIMITS.documentBytes} bytes.`,
    );
  const handle = await open(file, "r");
  try {
    const bytes = Buffer.alloc(info.size);
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
    // Truncated while reading, or grown since its size was taken.
    const extra = await handle.read(Buffer.alloc(1), 0, 1, read);
    if (read !== info.size || extra.bytesRead !== 0)
      throw new CommandError(
        "VALIDATION",
        "The file changed while it was read.",
      );
    return bytes;
  } finally {
    await handle.close();
  }
}

// What a sidecar's bytes are, as a document of `sceneId`.
function examine(sceneId: string, bytes: Buffer) {
  const validated = validateDocument(
    "cinemaScene",
    DOCUMENT_SCHEMA_VERSIONS.cinemaScene,
    bytes,
  );
  const scene = JSON.parse(validated.bytes.toString("utf8")) as {
    id?: unknown;
  };
  // A file whose scene names another id is not that scene's original.
  if (scene.id !== sceneId)
    throw new CommandError(
      "VALIDATION",
      "The scene inside names a different id than its file.",
    );
  return {
    validated,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Every legacy Cinema sidecar, examined read-only (bounded). */
export async function inventoryCinemaSidecars(store: ProjectStore): Promise<{
  sidecars: SidecarEntry[];
  truncated: boolean;
}> {
  const dir = await folder(store);
  if (!dir) return { sidecars: [], truncated: false };
  // A save in progress (core/cinema-store.ts) is not a scene file yet.
  const names = (await readdir(dir))
    .filter((n) => !/^\..*\.tmp$/.test(n))
    .sort();
  const sidecars: SidecarEntry[] = [];
  for (const name of names.slice(0, SIDECAR_INVENTORY_LIMIT)) {
    const match = SIDECAR.exec(name);
    const migrations = match
      ? store.legacyMigrations("cinema-sidecar", name)
      : [];
    if (!match) {
      // Report what is there without reading it.
      const lower = SIDECAR.exec(name.toLowerCase());
      sidecars.push({
        name: name.slice(0, 128),
        sceneId: null,
        state: "invalid",
        reason: lower
          ? "Upper-case name: an alias of a scene file, not read."
          : "Not a scene file name.",
        migrations,
      });
      continue;
    }
    try {
      const bytes = await readSidecar(dir, name);
      const { validated, sourceSha256 } = examine(match[1]!, bytes);
      sidecars.push({
        name,
        sceneId: match[1]!,
        state: "valid",
        byteLength: bytes.length,
        sourceSha256,
        contentHash: validated.hash,
        migrations,
      });
    } catch (e) {
      sidecars.push({
        name,
        sceneId: match[1]!,
        state: "invalid",
        reason:
          e instanceof CommandError ? e.message : "The file could not be read.",
        migrations,
      });
    }
  }
  return { sidecars, truncated: names.length > SIDECAR_INVENTORY_LIMIT };
}

/**
 * Migrates one sidecar into the project the caller names, as its document
 * `sceneId`, compare-and-swap on the project revision. The caller names the
 * bytes it inventoried (`sourceSha256`), so a file changed since then is
 * refused. A retry, or a project that already holds exactly this scene from
 * this source, returns the existing migration without a new revision.
 */
export async function migrateCinemaSidecar(
  store: ProjectStore,
  input: {
    projectId: string;
    expectedRevision: number;
    sceneId: string;
    sourceSha256: string;
    principalId?: string;
  },
  receipt?: RequestReceipt,
) {
  const dir = await folder(store);
  const name = `${input.sceneId}.json`;
  if (!dir || !SIDECAR.test(name))
    throw new CommandError("NOT_FOUND", "No such legacy Cinema scene.");
  const bytes = await readSidecar(dir, name).catch(
    (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT")
        throw new CommandError("NOT_FOUND", "No such legacy Cinema scene.");
      throw e;
    },
  );
  const { validated, sourceSha256 } = examine(input.sceneId, bytes);
  if (sourceSha256 !== input.sourceSha256)
    throw new CommandError(
      "REVISION_CONFLICT",
      "The legacy scene file changed since it was inventoried; inventory it again.",
    );
  const held = store
    .listDocuments(input.projectId)
    .find((d) => d.id === input.sceneId);
  const recorded = store
    .legacyMigrations("cinema-sidecar", name)
    .filter(
      (m) => m.sourceSha256 === sourceSha256 && m.projectId === input.projectId,
    );
  if (held && held.contentHash === validated.hash && recorded.length) {
    const project = await store.load(input.projectId);
    return {
      migrated: false as const,
      project: { id: project.id, revision: project.revision },
      document: { id: held.id, kind: held.kind, contentHash: held.contentHash },
      receipt: recorded.at(-1)!,
    };
  }
  // A project document of this id that did not come from this source is
  // never overwritten.
  if (held)
    throw new CommandError(
      "VALIDATION",
      "The project already has a different document with this scene's id.",
    );
  const project = await store.commitDocument(
    {
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      documentId: input.sceneId,
      kind: "cinemaScene",
      schemaVersion: DOCUMENT_SCHEMA_VERSIONS.cinemaScene,
      expectedContentHash: null,
      source: { bytes },
      principalId: input.principalId,
      migration: {
        sourceKind: "cinema-sidecar",
        sourceName: name,
        sourceSha256,
        sourceBytes: bytes.length,
      },
    },
    receipt,
  );
  return {
    migrated: true as const,
    project: { id: project.id, revision: project.revision },
    document: {
      id: input.sceneId,
      kind: "cinemaScene" as const,
      contentHash: validated.hash,
    },
    receipt: store
      .legacyMigrations("cinema-sidecar", name)
      .filter((m) => m.projectId === input.projectId)
      .at(-1)!,
  };
}
