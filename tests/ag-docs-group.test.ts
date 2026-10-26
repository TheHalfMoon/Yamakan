// AG-DOCS group qualification (YU-010…YU-015): creative documents through
// the real service and its clients, end to end. Studio canvases with stored
// bitmaps and Cinema scenes are saved by the SDK and MCP, survive a legacy
// whole-project save, typed batches with undo and redo, a legacy scene
// migration, a hard service kill, and a backup restored into a new
// workspace that a second service opens.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fork, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { SCENE3D_FORMAT, SCENE3D_FORMAT_VERSION } from "../core/scene3d.ts";
import { YamakanClient } from "../sdk/client.ts";

const bases: string[] = [];
const closers: Array<() => unknown> = [];
after(async () => {
  for (const close of closers.reverse()) await close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});

function png(rgba: number[]) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(4, 0);
  ihdr.writeUInt32BE(4, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + 16);
  for (let x = 0; x < 4; x++) Buffer.from(rgba).copy(row, 1 + x * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat([row, row, row, row]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const canvasWith = (digest: string) => {
  const doc = createEmptyStudioDocument({ id: randomUUID(), name: "Board" });
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
  return doc;
};
const scene = (id: string, focal = 35) => ({
  format: SCENE3D_FORMAT,
  formatVersion: SCENE3D_FORMAT_VERSION,
  id,
  units: "metres",
  eulerOrder: "XYZ",
  camera: { focalLengthMm: focal, sensorWidthMm: 36, near: 0.1, far: 1000 },
  items: [],
});

// The real service on a workspace, as a user starts it (AG-DOCS on).
async function service(root: string, port: number) {
  const url = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    YAMAKAN_WORKSPACE: root,
    YAMAKAN_PORT: String(port),
    YAMAKAN_URL: url,
  };
  const child = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    { env, silent: true, windowsHide: true },
  );
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const done = once(child, "exit");
    child.send("shutdown");
    await done;
  };
  closers.push(stop);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("startup timeout")),
      20_000,
    );
    child.stdout?.on("data", (c) => {
      if (String(c).includes("Yamakan is running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => reject(new Error(`service exited ${code}`)));
  });
  const token = (await readFile(path.join(root, "token"), "utf8")).trim();
  return {
    child: child as ChildProcess,
    env,
    stop,
    client: new YamakanClient({ baseUrl: url, token }),
  };
}

test("AG-DOCS group: documents through the real service survive save, undo, migration, a crash and a restore", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "yamakan-agdocs-"));
  bases.push(base);
  const root = path.join(base, "workspace");
  await mkdir(root);
  let live = await service(root, 24381);
  let { client } = live;
  assert.equal(
    (
      (await client.call("yamakan.document.capability", {})) as {
        available: boolean;
      }
    ).available,
    true,
  );
  const project = await client.call("yamakan.project.create", { name: "Film" });
  // The head revision, as any client reads it.
  const open = () =>
    live.client.call("yamakan.project.open", { projectId: project.id });

  // A Studio canvas naming a stored bitmap, saved by the SDK.
  const pixels = png([10, 200, 40, 255]);
  const bitmap = await client.uploadStudioBitmap(project.id, pixels);
  const studioId = randomUUID();
  await client.saveDocument({
    projectId: project.id,
    expectedRevision: project.revision,
    documentId: studioId,
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: null,
    content: canvasWith(bitmap.digest),
    requestId: "studio-1",
  });

  // A Cinema scene, saved by MCP.
  const mcp = spawn(
    process.execPath,
    [fileURLToPath(new URL("../mcp/main.ts", import.meta.url))],
    { env: live.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  closers.push(async () => {
    if (mcp.exitCode !== null) return;
    const done = once(mcp, "exit");
    mcp.stdin!.end();
    await done;
  });
  const replies = new Map<number, (v: any) => void>();
  createInterface({ input: mcp.stdout! }).on("line", (line) => {
    const m = JSON.parse(line);
    replies.get(m.id)?.(m);
  });
  let next = 1;
  const rpc = (method: string, params?: unknown) =>
    new Promise<any>((resolve) => {
      const id = next++;
      replies.set(id, resolve);
      mcp.stdin!.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
    });
  const sceneId = randomUUID();
  const saved = await rpc("tools/call", {
    name: "yamakan_document_save",
    arguments: {
      projectId: project.id,
      expectedRevision: (await open()).revision,
      documentId: sceneId,
      kind: "cinemaScene",
      schemaVersion: 1,
      expectedContentHash: null,
      content: scene(sceneId),
    },
  });
  assert.notEqual(saved.result.isError, true, saved.result.content[0].text);
  mcp.stdin!.end();

  const documents = async () =>
    (await live.client.call("yamakan.document.list", {
      projectId: project.id,
    })) as { id: string; contentHash: string }[];
  const refs = await documents();
  assert.deepEqual(refs.map((d) => d.id).sort(), [studioId, sceneId].sort());

  // An old client's whole-project save keeps both documents.
  const view = await open();
  await client.call("yamakan.project.save", {
    project: { ...view, name: "Film (renamed)" },
    expectedRevision: view.revision,
  });
  assert.equal((await open()).name, "Film (renamed)");
  assert.deepEqual(await documents(), refs);

  // Typed batches, undo and redo keep them too.
  await client.call("yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: (await open()).revision,
    operations: [{ type: "scene.add", sceneId: randomUUID(), name: "Opening" }],
  });
  await client.call("yamakan.project.undo", {
    projectId: project.id,
    expectedRevision: (await open()).revision,
  });
  assert.deepEqual(await documents(), refs);
  await client.call("yamakan.project.redo", {
    projectId: project.id,
    expectedRevision: (await open()).revision,
  });
  assert.deepEqual(await documents(), refs);

  // A legacy workspace scene migrates into the project, original kept.
  const legacyId = randomUUID();
  await mkdir(path.join(root, "cinema"), { recursive: true });
  const legacyBytes = JSON.stringify(scene(legacyId, 85));
  await writeFile(path.join(root, "cinema", `${legacyId}.json`), legacyBytes);
  const inventory = (await client.call("yamakan.scene.inventory", {})) as {
    sidecars: { sceneId: string | null; sourceSha256?: string }[];
  };
  const entry = inventory.sidecars.find((e) => e.sceneId === legacyId)!;
  assert.ok(entry, "the legacy scene is listed");
  await client.call("yamakan.scene.migrate", {
    projectId: project.id,
    expectedRevision: (await open()).revision,
    sceneId: legacyId,
    sourceSha256: entry.sourceSha256!,
  });
  const migrated = await documents();
  assert.equal(migrated.length, 3);
  assert.equal(
    await readFile(path.join(root, "cinema", `${legacyId}.json`), "utf8"),
    legacyBytes,
  );
  const bytesOf = async (c: YamakanClient, id: string) =>
    JSON.stringify(
      await c.call("yamakan.document.get", {
        projectId: project.id,
        documentId: id,
      }),
    );
  const expected = new Map<string, string>();
  for (const d of migrated) expected.set(d.id, await bytesOf(client, d.id));

  // A hard kill, then a new service on the same workspace.
  live.child.kill("SIGKILL");
  await once(live.child, "exit");
  live = await service(root, 24382);
  client = live.client;
  assert.deepEqual(await documents(), migrated);
  for (const [id, bytes] of expected)
    assert.equal(await bytesOf(client, id), bytes);
  assert.deepEqual(
    Buffer.from(
      await (
        await client.studioBitmap(project.id, bitmap.digest)
      ).arrayBuffer(),
    ),
    pixels,
  );

  // A backup restored into a new workspace that a second service opens.
  const backup = (await client.call("yamakan.workspace.backup", {})) as {
    backupId: string;
    creative: string;
  };
  assert.equal(backup.creative, "complete");
  const restored = (await client.call("yamakan.workspace.restore", {
    backupId: backup.backupId,
  })) as { root: string; creative: string };
  assert.equal(restored.creative, "complete");
  bases.push(path.dirname(path.dirname(restored.root)));
  const copy = await service(restored.root, 24383);
  const restoredDocs = (await copy.client.call("yamakan.document.list", {
    projectId: project.id,
  })) as { id: string; contentHash: string }[];
  assert.deepEqual(restoredDocs, migrated);
  for (const [id, bytes] of expected)
    assert.equal(await bytesOf(copy.client, id), bytes);
  assert.deepEqual(
    Buffer.from(
      await (
        await copy.client.studioBitmap(project.id, bitmap.digest)
      ).arrayBuffer(),
    ),
    pixels,
  );
  // The legacy file came along, still migratable as found.
  assert.equal(
    await readFile(
      path.join(restored.root, "cinema", `${legacyId}.json`),
      "utf8",
    ),
    legacyBytes,
  );
  await copy.stop();
  await live.stop();
});
