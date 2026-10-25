import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFile, fork, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { ProjectStore } from "../core/store.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";
import { YamakanClient, YamakanError } from "../sdk/client.ts";
import { stageDocument } from "../server/document-stage.ts";
import { principals } from "../server/api.ts";
import type { CommandError } from "../core/command/errors.ts";

const bases: string[] = [];
const closers: Array<() => unknown> = [];
after(async () => {
  for (const close of closers.reverse()) await close();
  await Promise.all(bases.map((b) => rm(b, { recursive: true, force: true })));
});

const studio = () =>
  createEmptyStudioDocument({ id: randomUUID(), name: "Board" });

// The SDK against the staging handler over real HTTP, flag passed in.
test("the SDK stages a document and a retry returns the same receipt", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-sdkstage-"));
  bases.push(root);
  const store = new ProjectStore(root);
  closers.push(() => store.close());
  await store.initialize();
  const project = await store.create("SDK");
  const server = createServer(async (req, res) => {
    const id = /\/projects\/([^/]+)\//.exec(req.url ?? "")?.[1] ?? "";
    try {
      const receipt = await stageDocument(
        store,
        principals["local-client"],
        id,
        req,
        true,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(receipt));
    } catch (e) {
      const err = e as CommandError;
      res.writeHead(400, {
        "Content-Type": "application/json",
        Connection: "close",
      });
      res.end(
        JSON.stringify({ error: { code: err.code, message: err.message } }),
      );
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  closers.push(() => new Promise((r) => server.close(r)));
  const client = new YamakanClient({
    baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
  });
  const body = new TextEncoder().encode(JSON.stringify(studio()));
  const options = {
    kind: "studio" as const,
    schemaVersion: 1,
    requestId: "sdk-1",
  };
  const receipt = await client.stageDocument(project.id, body, options);
  assert.equal(receipt.kind, "studio");
  assert.match(receipt.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    await client.stageDocument(project.id, body, options),
    receipt,
  );
  await assert.rejects(
    client.stageDocument(project.id, new TextEncoder().encode("{}"), {
      ...options,
      requestId: "sdk-2",
    }),
    (e: unknown) => e instanceof YamakanError && e.code === "VALIDATION",
  );
});

test("against the real service with AG-DOCS off, SDK, MCP and CLI saves are refused", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-docclients-"));
  bases.push(root);
  const port = 24331;
  const url = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    YAMAKAN_WORKSPACE: root,
    YAMAKAN_PORT: String(port),
    YAMAKAN_URL: url,
  };
  const server = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    {
      env,
      silent: true,
      windowsHide: true,
    },
  );
  closers.push(async () => {
    if (server.exitCode !== null) return;
    const done = once(server, "exit");
    server.send("shutdown");
    await done;
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("startup timeout")),
      10_000,
    );
    server.stdout?.on("data", (c) => {
      if (String(c).includes("Yamakan is running")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const token = (await readFile(path.join(root, "token"), "utf8")).trim();
  const client = new YamakanClient({ baseUrl: url, token });
  const project = await client.call("yamakan.project.create", { name: "Docs" });
  const save = {
    projectId: project.id,
    expectedRevision: project.revision,
    documentId: randomUUID(),
    kind: "studio" as const,
    schemaVersion: 1,
    expectedContentHash: null,
    content: studio(),
    requestId: "save-1",
  };
  await assert.rejects(
    client.saveDocument(save),
    (e: unknown) =>
      e instanceof YamakanError && e.code === "CAPABILITY_UNAVAILABLE",
  );

  // MCP lists the save tool (content, not source) and refuses the same way.
  const mcp = spawn(
    process.execPath,
    [fileURLToPath(new URL("../mcp/main.ts", import.meta.url))],
    {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
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
  const { tools } = (await rpc("tools/list")).result;
  const tool = tools.find(
    (t: { name: string }) => t.name === "yamakan_document_save",
  );
  assert.ok(tool, "the save tool is listed");
  assert.ok(tool.inputSchema.required.includes("content"));
  assert.ok(!("source" in tool.inputSchema.properties));
  const { requestId: _r, ...args } = save;
  const called = await rpc("tools/call", {
    name: "yamakan_document_save",
    arguments: args,
  });
  assert.equal(called.result.isError, true);
  assert.equal(
    JSON.parse(called.result.content[0].text).code,
    "CAPABILITY_UNAVAILABLE",
  );

  // The CLI reads the file locally and sends only its bytes.
  const file = path.join(root, "board.json");
  await writeFile(file, JSON.stringify(studio()));
  const cli = await new Promise<{ code: number | null; stderr: string }>(
    (resolve) => {
      const child = execFile(
        process.execPath,
        [
          fileURLToPath(new URL("../cli/main.ts", import.meta.url)),
          "stage-document",
          project.id,
          "studio",
          "1",
          file,
        ],
        { env, windowsHide: true },
        (error, _stdout, stderr) =>
          resolve({ code: error ? (error.code as number) : 0, stderr }),
      );
      void child;
    },
  );
  assert.equal(cli.code, 1);
  assert.equal(JSON.parse(cli.stderr.trim()).code, "CAPABILITY_UNAVAILABLE");
});
