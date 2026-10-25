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

// A scene file is named by its scene's UUID. Older saves kept the id's case
// as given, so an upper-case name can be the original; two names that
// differ only in case (possible off Windows) are ambiguous and never read.
const SIDECAR =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$/;
// Inventory bounds per call: entries, and bytes read and validated.
export const SIDECAR_INVENTORY_LIMIT = 10_000;
export const SIDECAR_INVENTORY_BYTES = 256 * 1024 * 1024;

export type SidecarState = "valid" | "invalid" | "unexamined";
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

// The ownership key of a scene file: one per scene id, whatever its case.
const sourceKey = (sceneId: string) => `${sceneId.toLowerCase()}.json`;

const unreadable = () =>
  new CommandError("UNAVAILABLE", "The legacy scene file could not be read.");

// The folder itself must be a real folder of this workspace (not a link to
// somewhere else); missing means there is nothing to migrate.
async function folder(store: ProjectStore) {
  const dir = path.join(store.root, "cinema");
  const info = await lstat(dir).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw unreadable();
  });
  if (!info) return null;
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new CommandError(
      "VALIDATION",
      "The workspace's cinema folder is not a plain folder; it is not read.",
    );
  return dir;
}

// Scene file names, without saves in progress (core/cinema-store.ts).
async function sceneNames(dir: string) {
  const names = await readdir(dir).catch(() => {
    throw unreadable();
  });
  return names.filter((n) => !/^\..*\.tmp$/.test(n)).sort();
}

// Reads one sidecar exactly once, bounded: a plain file with one link (not
// a link, a hard link to elsewhere, or a file swapped after it was looked
// at), no larger than a document, and unchanged while read.
async function readSidecar(dir: string, name: string) {
  const file = path.join(dir, name);
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
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
      const opened = await handle.stat();
      if (
        opened.ino !== info.ino ||
        opened.dev !== info.dev ||
        opened.size !== info.size ||
        opened.nlink !== 1
      )
        throw new CommandError(
          "VALIDATION",
          "The file changed while it was read.",
        );
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
  } catch (e) {
    if (e instanceof CommandError) throw e;
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      throw new CommandError("NOT_FOUND", "No such legacy Cinema scene.");
    // Never a host path or a raw system message.
    throw unreadable();
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
export async function inventoryCinemaSidecars(
  store: ProjectStore,
  // Test seam: can only lower the byte budget.
  limits: { bytes?: number } = {},
): Promise<{
  sidecars: SidecarEntry[];
  truncated: boolean;
}> {
  const dir = await folder(store);
  if (!dir) return { sidecars: [], truncated: false };
  const names = await sceneNames(dir);
  const variants = new Map<string, number>();
  for (const n of names)
    variants.set(n.toLowerCase(), (variants.get(n.toLowerCase()) ?? 0) + 1);
  const sidecars: SidecarEntry[] = [];
  let budget = Math.min(
    SIDECAR_INVENTORY_BYTES,
    limits.bytes ?? SIDECAR_INVENTORY_BYTES,
  );
  for (const name of names.slice(0, SIDECAR_INVENTORY_LIMIT)) {
    const match = SIDECAR.exec(name);
    if (!match) {
      // Reported without reading it.
      sidecars.push({
        name: name.slice(0, 128),
        sceneId: null,
        state: "invalid",
        reason: "Not a scene file name.",
        migrations: [],
      });
      continue;
    }
    const sceneId = match[1]!;
    const migrations = store.legacyMigrations(
      "cinema-sidecar",
      sourceKey(sceneId),
    );
    const entry = { name, sceneId, migrations };
    if (variants.get(name.toLowerCase())! > 1) {
      sidecars.push({
        ...entry,
        state: "invalid",
        reason:
          "Several files differ only in the case of this id; none is read.",
      });
      continue;
    }
    const size = await lstat(path.join(dir, name)).then(
      (s) => s.size,
      () => 0,
    );
    // Files refused before reading (over the document limit) cost nothing.
    const cost = size > DOCUMENT_LIMITS.documentBytes ? 0 : size;
    if (cost > budget) {
      sidecars.push({
        ...entry,
        state: "unexamined",
        reason: "Not examined: this inventory's read budget is spent.",
      });
      budget = 0;
      continue;
    }
    budget -= cost;
    try {
      const bytes = await readSidecar(dir, name);
      const { validated, sourceSha256 } = examine(sceneId, bytes);
      sidecars.push({
        ...entry,
        state: "valid",
        byteLength: bytes.length,
        sourceSha256,
        contentHash: validated.hash,
      });
    } catch (e) {
      sidecars.push({
        ...entry,
        state: "invalid",
        reason:
          e instanceof CommandError ? e.message : "The file could not be read.",
      });
    }
  }
  return {
    sidecars,
    truncated:
      names.length > SIDECAR_INVENTORY_LIMIT ||
      sidecars.some((s) => s.state === "unexamined"),
  };
}

/**
 * Migrates one sidecar into the project the caller names, as its document
 * `sceneId`, compare-and-swap on the project revision. The caller names the
 * bytes it inventoried (`sourceSha256`), so a file changed since then is
 * refused. A scene file is migrated once: into one project, never another;
 * a retry returns that recorded migration whatever happened to the file or
 * the project's scene since (later changes are made to the document).
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
  const key = sourceKey(input.sceneId);
  const recorded = store.legacyMigrations("cinema-sidecar", key);
  if (recorded.some((m) => m.projectId !== input.projectId))
    throw new CommandError(
      "VALIDATION",
      "This legacy scene was already migrated into another project.",
    );
  const mine = recorded.at(-1);
  // (Projects are never deleted, so a recorded project always loads.)
  if (mine) {
    const project = await store.load(input.projectId);
    return {
      migrated: false as const,
      project: { id: project.id, revision: project.revision },
      document: {
        id: mine.documentId,
        kind: "cinemaScene" as const,
        contentHash: mine.contentHash,
      },
      receipt: mine,
    };
  }
  const dir = await folder(store);
  const names = dir
    ? (await sceneNames(dir)).filter((n) => n.toLowerCase() === key)
    : [];
  if (!dir || names.length === 0)
    throw new CommandError("NOT_FOUND", "No such legacy Cinema scene.");
  if (names.length > 1)
    throw new CommandError(
      "VALIDATION",
      "Several files differ only in the case of this id; none is migrated.",
    );
  const name = names[0]!;
  const sceneId = SIDECAR.exec(name)![1]!;
  const bytes = await readSidecar(dir, name);
  const { validated, sourceSha256 } = examine(sceneId, bytes);
  if (sourceSha256 !== input.sourceSha256)
    throw new CommandError(
      "REVISION_CONFLICT",
      "The legacy scene file changed since it was inventoried; inventory it again.",
    );
  // A project document of this id that did not come from this file is never
  // overwritten (and a migration is never invented for it).
  if (
    store
      .listDocuments(input.projectId)
      .some((d) => d.id.toLowerCase() === sceneId.toLowerCase())
  )
    throw new CommandError(
      "VALIDATION",
      "The project already has a document with this scene's id that was not migrated from this file.",
    );
  const project = await store.commitDocument(
    {
      projectId: input.projectId,
      expectedRevision: input.expectedRevision,
      documentId: sceneId,
      kind: "cinemaScene",
      schemaVersion: DOCUMENT_SCHEMA_VERSIONS.cinemaScene,
      expectedContentHash: null,
      source: { bytes },
      principalId: input.principalId,
      migration: {
        sourceKind: "cinema-sidecar",
        sourceName: key,
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
      id: sceneId,
      kind: "cinemaScene" as const,
      contentHash: validated.hash,
    },
    receipt: store.legacyMigrations("cinema-sidecar", key).at(-1)!,
  };
}
