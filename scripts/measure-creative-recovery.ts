// YU-014 measurement: backup (barrier = database copy + closure) and restore
// latency for creative workspaces of two sizes. Synthetic, local only; prints
// one JSON line per profile. Usage: node scripts/measure-creative-recovery.ts
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "../core/store.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import {
  backupWorkspace,
  creativeClosure,
  restoreWorkspace,
} from "../core/recovery.ts";

function png(seed: number) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const size = 64;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 31 + seed * 7) & 0xff;
  for (let y = 0; y < size; y++) raw[y * (1 + size * 4)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function profile(name: string, documents: number, edits: number) {
  const base = await mkdtemp(path.join(tmpdir(), "yamakan-measure-"));
  try {
    const root = path.join(base, "ws");
    const store = new ProjectStore(root);
    await store.initialize();
    const project = await store.create(name);
    let revision = project.revision;
    const ids = Array.from({ length: documents }, () => randomUUID());
    const hashes = new Map<string, string | null>(ids.map((id) => [id, null]));
    for (let i = 0; i < edits; i++) {
      const bytes = png(i);
      const { digest } = await store.importStudioBitmap(
        project.id,
        (async function* () {
          yield bytes;
        })(),
        bytes.length,
      );
      const id = ids[i % documents]!;
      const doc = createEmptyStudioDocument({
        id: randomUUID(),
        name: `D${i}`,
      });
      const canvas = JSON.parse(doc.canvasJson);
      canvas.document.stacks.raster = [
        {
          id: randomUUID(),
          type: "raster_layer",
          objects: [
            { id: randomUUID(), type: "image", image: { imageName: digest } },
          ],
        },
      ];
      doc.canvasJson = JSON.stringify(canvas);
      const next = await store.commitDocument({
        projectId: project.id,
        expectedRevision: revision,
        documentId: id,
        kind: "studio",
        schemaVersion: 1,
        expectedContentHash: hashes.get(id)!,
        source: { bytes: Buffer.from(JSON.stringify(doc)) },
      });
      revision = next.revision;
      hashes.set(
        id,
        store.listDocuments(project.id).find((d) => d.id === id)!.contentHash,
      );
    }
    const home = path.join(base, "home");
    const t0 = performance.now();
    const backup = await backupWorkspace(store, home);
    const backupMs = performance.now() - t0;
    const copy = new DatabaseSync(
      path.join(home, "backups", backup.backupId, "workspace.sqlite"),
      { readOnly: true },
    );
    const c0 = performance.now();
    const closure = creativeClosure(copy);
    const closureMs = performance.now() - c0;
    copy.close();
    const r0 = performance.now();
    const restored = await restoreWorkspace(
      path.join(home, "backups", backup.backupId),
      path.join(base, "restored"),
    );
    const restoreMs = performance.now() - r0;
    store.close();
    console.log(
      JSON.stringify({
        profile: name,
        revisions: revision,
        documents,
        objects: backup.objects,
        bytes: backup.bytes,
        creative: restored.creative,
        closure: {
          documents: closure.documents,
          objects: closure.objects,
          gaps: closure.gaps,
        },
        backupMs: Math.round(backupMs),
        closureMs: Math.round(closureMs),
        restoreMs: Math.round(restoreMs),
      }),
    );
  } finally {
    await rm(base, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
}

await profile("S", 4, 20);
await profile("M", 20, 150);
