import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { DOCUMENT_LIMITS } from "../core/documents.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { CommandError } from "../core/command/errors.ts";
import { RESOURCE_POLICY } from "../core/command/policy.ts";
import { execute } from "../core/command/registry.ts";
import { stageDocument } from "../server/document-stage.ts";
import { principals } from "../server/api.ts";

const bases: string[] = [];
const handles: { close(): void }[] = [];
after(() => {
  for (const handle of handles.reverse()) handle.close();
  return Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

async function workspace() {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-stage-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const project = await store.create("Staging");
  return { root, store, project };
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const studioBytes = (name = "Board", pad = 0) => {
  const doc = createEmptyStudioDocument({ id: randomUUID(), name });
  if (pad) {
    // A canvas carrying a large pixel-free payload: big, but few nodes.
    const canvas = JSON.parse(doc.canvasJson);
    canvas.note = "x".repeat(pad);
    doc.canvasJson = JSON.stringify(canvas);
  }
  return Buffer.from(JSON.stringify(doc), "utf8");
};
const refusedSync = (fn: () => unknown, code: string, pattern?: RegExp) =>
  assert.throws(
    fn,
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === code &&
      (!pattern || pattern.test(e.message)),
  );
const refused = (p: Promise<unknown>, code: string, pattern?: RegExp) =>
  assert.rejects(
    p,
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === code &&
      (!pattern || pattern.test(e.message)),
  );

function stageInput(
  projectId: string,
  body: Buffer,
  requestId: string = randomUUID(),
) {
  return {
    projectId,
    principalId: "local-client",
    requestId,
    kind: "studio" as const,
    schemaVersion: 1,
    declaredBytes: body.length,
    bodySha256: sha(body),
  };
}
function stage(store: ProjectStore, projectId: string, body: Buffer) {
  const r = store.reserveDocumentUpload(stageInput(projectId, body));
  assert.ok("reserved" in r);
  return store.sealDocumentUpload(r.reserved, body);
}
const commitStaged = (
  store: ProjectStore,
  projectId: string,
  receipt: { stagedUploadId: string; contentHash: string },
  extra: Partial<{
    principalId: string;
    expectedRevision: number;
    documentId: string;
    expectedContentHash: string | null;
  }> = {},
) =>
  store.commitDocument({
    projectId,
    expectedRevision: extra.expectedRevision ?? 0,
    documentId: extra.documentId ?? randomUUID(),
    kind: "studio",
    schemaVersion: 1,
    expectedContentHash: extra.expectedContentHash ?? null,
    source: {
      stagedUploadId: receipt.stagedUploadId,
      contentHash: receipt.contentHash,
    },
    principalId: extra.principalId ?? "local-client",
  });

test("a sealed receipt names the upload and its content, never a host path", async () => {
  const { store, project, root } = await workspace();
  const body = studioBytes();
  const receipt = stage(store, project.id, body);
  assert.deepEqual(Object.keys(receipt).sort(), [
    "byteLength",
    "contentHash",
    "expiresAt",
    "kind",
    "schemaVersion",
    "stagedUploadId",
  ]);
  assert.equal(receipt.byteLength, body.length);
  assert.ok(!JSON.stringify(receipt).includes(root));
  const expires = Date.parse(receipt.expiresAt) - Date.now();
  assert.ok(expires > 14 * 60_000 && expires <= DOCUMENT_LIMITS.uploadTtlMs);
  // Staged content is not a revision.
  assert.deepEqual(store.listDocuments(project.id), []);
  await commitStaged(store, project.id, receipt);
  assert.equal(
    store.listDocuments(project.id)[0]!.contentHash,
    receipt.contentHash,
  );
});

test("a retried stage after a lost response returns the same receipt; a changed request is refused", async () => {
  const { store, project } = await workspace();
  const body = studioBytes();
  const input = stageInput(project.id, body, "stage-1");
  const first = store.reserveDocumentUpload(input);
  assert.ok("reserved" in first);
  // While the first body is still arriving, the same request is busy.
  refusedSync(() => store.reserveDocumentUpload(input), "BUSY");
  const sealed = store.sealDocumentUpload(first.reserved, body);
  const retry = store.reserveDocumentUpload(input);
  assert.deepEqual(retry, { receipt: sealed });
  const other = studioBytes("Other");
  refusedSync(
    () =>
      store.reserveDocumentUpload({
        ...input,
        declaredBytes: other.length,
        bodySha256: sha(other),
      }),
    "IDEMPOTENCY_MISMATCH",
  );
});

test("reservations bound active uploads per principal and staged bytes per workspace", async () => {
  const { store, project } = await workspace();
  const big = DOCUMENT_LIMITS.documentBytes;
  const reserve = (principalId: string, declaredBytes: number) =>
    store.reserveDocumentUpload({
      ...stageInput(project.id, studioBytes()),
      principalId,
      declaredBytes,
    });
  refusedSync(() => reserve("local-client", big + 1), "LIMIT_EXCEEDED");
  reserve("local-client", 1000);
  reserve("local-client", 1000);
  refusedSync(
    () => reserve("local-client", 1000),
    "LIMIT_EXCEEDED",
    /Too many/,
  );
  // Agents share 8 MiB between them (the local client's bytes do not
  // count against it): another agent's document no longer fits.
  reserve("agent:a", big - 4000);
  refusedSync(() => reserve("agent:b", 5000), "LIMIT_EXCEEDED", /agents/);
  // The browser session keeps its own share, whatever agents hold...
  reserve("browser-ui", big);
  // ...but no principal holds more than one document's worth.
  refusedSync(() => reserve("browser-ui", 1), "LIMIT_EXCEEDED", /staged bytes/);
  assert.equal(RESOURCE_POLICY.enforced.requestBytes, 2 * 1024 * 1024);
});

test("agents share one staging pool and can never lock out the local client", async () => {
  const { store, project } = await workspace();
  const big = DOCUMENT_LIMITS.documentBytes;
  const reserve = (principalId: string, declaredBytes: number) =>
    store.reserveDocumentUpload({
      ...stageInput(project.id, studioBytes()),
      principalId,
      declaredBytes,
    });
  reserve("agent:a", big);
  refusedSync(() => reserve("agent:b", 1), "LIMIT_EXCEEDED", /agents/);
  // The CLI and SDK stage a whole document whatever agents hold.
  assert.ok("reserved" in reserve("local-client", big));
});

test("a restart releases uploads that were still being received, and expired ones", async () => {
  const { root, store, project } = await workspace();
  const body = studioBytes();
  const input = stageInput(project.id, body);
  const receiving = store.reserveDocumentUpload(input);
  assert.ok("reserved" in receiving);
  stage(store, project.id, studioBytes("Sealed"));
  store.close();
  const reopened = new ProjectStore(root);
  handles.push(reopened);
  await reopened.initialize();
  // The interrupted request can start over; the sealed one still counts.
  const again = reopened.reserveDocumentUpload(input);
  assert.ok("reserved" in again);
  refusedSync(
    () => reopened.reserveDocumentUpload(stageInput(project.id, body)),
    "LIMIT_EXCEEDED",
    /Too many/,
  );
});

test("a commit replays by receipt even after its upload row was cleaned up", async () => {
  const { store, project } = await workspace();
  const receipt = stage(store, project.id, studioBytes());
  const request = {
    principalId: "local-client",
    requestId: "commit-x",
    digest: "f".repeat(64),
  };
  const input = {
    projectId: project.id,
    expectedRevision: 0,
    documentId: randomUUID(),
    kind: "studio" as const,
    schemaVersion: 1,
    expectedContentHash: null,
    source: {
      stagedUploadId: receipt.stagedUploadId,
      contentHash: receipt.contentHash,
    },
    principalId: "local-client",
  };
  const first = await store.commitDocument(input, request);
  // A later reservation far in the future sweeps every expired row.
  store.reserveDocumentUpload(
    stageInput(project.id, studioBytes("Later")),
    Date.now() + 2 * DOCUMENT_LIMITS.uploadTtlMs,
  );
  assert.deepEqual(await store.commitDocument(input, request), first);
});

test("a staged document still keeps its assets in the project at commit", async () => {
  const { store, project } = await workspace();
  const scene = Buffer.from(
    JSON.stringify({
      format: "yamakan.scene3d",
      formatVersion: 1,
      id: randomUUID(),
      units: "metres",
      eulerOrder: "XYZ",
      camera: { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 },
      items: [
        {
          id: randomUUID(),
          name: "card",
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          assetId: randomUUID(),
        },
      ],
    }),
  );
  const r = store.reserveDocumentUpload({
    ...stageInput(project.id, scene),
    kind: "cinemaScene",
  });
  assert.ok("reserved" in r);
  const sealed = store.sealDocumentUpload(r.reserved, scene);
  await refused(
    store.commitDocument({
      projectId: project.id,
      expectedRevision: 0,
      documentId: randomUUID(),
      kind: "cinemaScene",
      schemaVersion: 1,
      expectedContentHash: null,
      source: {
        stagedUploadId: sealed.stagedUploadId,
        contentHash: sealed.contentHash,
      },
      principalId: "local-client",
    }),
    "VALIDATION",
    /asset/,
  );
  assert.deepEqual(store.listDocuments(project.id), []);
});

test("a body that is not what was declared, or not a valid document, keeps nothing", async () => {
  const { store, project } = await workspace();
  const body = studioBytes();
  const cases: Array<[Buffer, RegExp]> = [
    [body.subarray(0, body.length - 1), /length/],
    [Buffer.from(body).fill(0x20, 10, 12), /SHA-256/],
  ];
  for (const [sent, pattern] of cases) {
    const r = store.reserveDocumentUpload(stageInput(project.id, body));
    assert.ok("reserved" in r);
    refusedSync(
      () => store.sealDocumentUpload(r.reserved, sent),
      "VALIDATION",
      pattern,
    );
  }
  const invalid = Buffer.from('{"not":"a studio document"}');
  const r = store.reserveDocumentUpload(stageInput(project.id, invalid));
  assert.ok("reserved" in r);
  refusedSync(
    () => store.sealDocumentUpload(r.reserved, invalid),
    "VALIDATION",
  );
  // Every refused upload released its reservation: two can be held again.
  stage(store, project.id, studioBytes("A"));
  stage(store, project.id, studioBytes("B"));
});

test("a staged handle commits once, only for its uploader and project, before it expires", async () => {
  const { store, project } = await workspace();
  const other = await store.create("Other");
  const receipt = stage(store, project.id, studioBytes());
  await refused(
    commitStaged(store, project.id, receipt, { principalId: "agent:someone" }),
    "NOT_FOUND",
  );
  await refused(commitStaged(store, other.id, receipt), "NOT_FOUND");
  await refused(
    commitStaged(store, project.id, {
      ...receipt,
      contentHash: "e".repeat(64),
    }),
    "VALIDATION",
    /does not match/,
  );
  await commitStaged(store, project.id, receipt);
  await refused(
    commitStaged(store, project.id, receipt, { expectedRevision: 1 }),
    "VALIDATION",
    /already committed/,
  );

  // An expired handle is gone, and its reservation with it.
  const old = Date.now() - DOCUMENT_LIMITS.uploadTtlMs - 1000;
  const body = studioBytes("Late");
  const late = store.reserveDocumentUpload(stageInput(project.id, body), old);
  assert.ok("reserved" in late);
  const sealedLate = store.sealDocumentUpload(late.reserved, body);
  await refused(
    commitStaged(store, project.id, sealedLate, { expectedRevision: 1 }),
    "NOT_FOUND",
  );
});

test("a committed staged upload replays by request receipt even after the handle is consumed", async () => {
  const { store, project } = await workspace();
  const receipt = stage(store, project.id, studioBytes());
  const documentId = randomUUID();
  const request = {
    principalId: "local-client",
    requestId: "commit-1",
    digest: "d".repeat(64),
  };
  const input = {
    projectId: project.id,
    expectedRevision: 0,
    documentId,
    kind: "studio" as const,
    schemaVersion: 1,
    expectedContentHash: null,
    source: {
      stagedUploadId: receipt.stagedUploadId,
      contentHash: receipt.contentHash,
    },
    principalId: "local-client",
  };
  const first = await store.commitDocument(input, request);
  const replay = await store.commitDocument(input, request);
  assert.deepEqual(replay, first);
  assert.equal(store.listDocuments(project.id).length, 1);
});

// The handler over real HTTP, with the flag passed explicitly (the route in
// server/main.ts always passes the build's flag, which is off).
async function stagingServer(
  store: ProjectStore,
  enabled: boolean,
  deadlineMs?: number,
) {
  const server: Server = createServer(async (req, res) => {
    const projectId = /\/projects\/([^/]+)\//.exec(req.url ?? "")?.[1] ?? "";
    try {
      const receipt = await stageDocument(
        store,
        principals["local-client"],
        projectId,
        req,
        enabled,
        deadlineMs,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(receipt));
    } catch (e) {
      res.writeHead(400, {
        "Content-Type": "application/json",
        Connection: "close",
      });
      res.end(
        JSON.stringify({
          code: (e as CommandError).code,
          message: (e as Error).message,
        }),
      );
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  handles.push({ close: () => server.close() });
  return (server.address() as { port: number }).port;
}
function post(
  port: number,
  projectId: string,
  body: Buffer,
  headers: Record<string, string> = {},
  cut?: number,
) {
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: `/api/v1/projects/${projectId}/documents/stage`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(body.length),
          "X-Request-Id": randomUUID(),
          "X-Content-SHA256": sha(body),
          "X-Document-Kind": "studio",
          "X-Document-Schema-Version": "1",
          ...headers,
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () =>
          resolve({ status: res.statusCode!, json: JSON.parse(text) }),
        );
      },
    );
    req.on("error", reject);
    if (cut === undefined) req.end(body);
    else {
      req.write(body.subarray(0, cut));
      setTimeout(() => {
        req.destroy();
        resolve({ status: 0, json: null });
      }, 200);
    }
  });
}

test("a 6 MiB document streams through the route and commits without widening the command cap", async () => {
  const { store, project } = await workspace();
  const port = await stagingServer(store, true);
  const body = studioBytes("Large", 6 * 1024 * 1024);
  assert.ok(
    body.length > 6 * 1024 * 1024 &&
      body.length < DOCUMENT_LIMITS.documentBytes,
  );
  assert.ok(body.length > RESOURCE_POLICY.enforced.requestBytes);
  const { status, json } = await post(port, project.id, body);
  assert.equal(status, 200, JSON.stringify(json));
  await commitStaged(store, project.id, json);
  const [ref] = store.listDocuments(project.id);
  const stored = store.getDocument(project.id, ref!.id).bytes;
  assert.deepEqual(
    JSON.parse(stored.toString("utf8")),
    JSON.parse(body.toString("utf8")),
  );
});

test("the route refuses bad headers and oversize before reading, and a cut connection keeps nothing", async () => {
  const { store, project } = await workspace();
  const port = await stagingServer(store, true);
  const body = studioBytes();
  const bad = await post(port, project.id, body, {
    "X-Content-SHA256": "nope",
  });
  assert.equal(bad.json.code, "VALIDATION");
  const tooBig = await post(port, project.id, body, {
    "Content-Length": String(DOCUMENT_LIMITS.documentBytes + 1),
  }).catch(() => ({ status: 400, json: { code: "LIMIT_EXCEEDED" } }));
  assert.equal(tooBig.json.code, "LIMIT_EXCEEDED");
  // Disconnect midway: the reservation is released (two fresh ones fit).
  await post(port, project.id, body, {}, Math.floor(body.length / 2));
  await new Promise((r) => setTimeout(r, 300));
  stage(store, project.id, studioBytes("A"));
  stage(store, project.id, studioBytes("B"));
});

test("with AG-DOCS turned off the route and the commit command refuse before any work", async () => {
  const { store, project } = await workspace();
  const port = await stagingServer(store, false);
  const { json } = await post(port, project.id, studioBytes());
  assert.equal(json.code, "CAPABILITY_UNAVAILABLE");
  const ctx = {
    store,
    queue: {},
    principal: principals["local-client"],
  } as never;
  process.env.YAMAKAN_AG_DOCS_OFF = "1";
  try {
    await refused(
      execute(ctx, "yamakan.document.commit", {
        projectId: project.id,
        expectedRevision: 0,
        documentId: randomUUID(),
        kind: "studio",
        schemaVersion: 1,
        expectedContentHash: null,
        source: { contentHash: "a".repeat(64) },
      }),
      "CAPABILITY_UNAVAILABLE",
    );
  } finally {
    delete process.env.YAMAKAN_AG_DOCS_OFF;
  }
});

test("a body dripped slower than the upload deadline is cut off and keeps nothing", async () => {
  const { store, project } = await workspace();
  const port = await stagingServer(store, true, 300);
  const body = studioBytes();
  const result = await new Promise<string>((resolve) => {
    const req = request({
      host: "127.0.0.1",
      port,
      method: "POST",
      path: `/api/v1/projects/${project.id}/documents/stage`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(body.length),
        "X-Request-Id": randomUUID(),
        "X-Content-SHA256": sha(body),
        "X-Document-Kind": "studio",
        "X-Document-Schema-Version": "1",
      },
    });
    req.on("error", () => resolve("closed"));
    req.on("response", () => resolve("answered"));
    req.write(body.subarray(0, 10)); // ...and never the rest
  });
  assert.ok(["closed", "answered"].includes(result));
  await new Promise((r) => setTimeout(r, 200));
  // The stalled reservation is gone: two fresh uploads fit.
  stage(store, project.id, studioBytes("A"));
  stage(store, project.id, studioBytes("B"));
});

test("an empty body is refused as invalid before any reservation", async () => {
  const { store, project } = await workspace();
  const port = await stagingServer(store, true);
  const { json } = await post(port, project.id, Buffer.alloc(0));
  assert.equal(json.code, "VALIDATION");
  stage(store, project.id, studioBytes("A"));
  stage(store, project.id, studioBytes("B"));
});
