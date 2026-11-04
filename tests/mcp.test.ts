import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, fork, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { createServer, type AddressInfo } from "node:net";
import { YamakanClient } from "../sdk/client.ts";
// A free loopback port for a child server (tests run concurrently, so no
// two may share a fixed one).
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

// Every test folder is removed when the file's tests finish; each test
// waits for its server to exit first.
const bases: string[] = [];
after(() =>
  Promise.all(bases.map((b) => rm(b, { recursive: true, force: true }))),
);

test("a refused first tool list keeps the caller's own request id", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-mcp-"));
  bases.push(root);
  await writeFile(path.join(root, "token"), "refused");
  const refusing = createHttpServer((_req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        apiVersion: 1,
        requestId: "service-trace",
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required.",
          retryable: false,
        },
      }),
    );
  });
  refusing.listen(0, "127.0.0.1");
  await once(refusing, "listening");
  const { port } = refusing.address() as AddressInfo;
  const mcp = spawn(
    process.execPath,
    [fileURLToPath(new URL("../mcp/main.ts", import.meta.url))],
    {
      env: {
        ...process.env,
        YAMAKAN_WORKSPACE: root,
        YAMAKAN_URL: `http://127.0.0.1:${port}`,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  try {
    const lines = createInterface({ input: mcp.stdout! })[
      Symbol.asyncIterator
    ]();
    let id = 1;
    const metaFor = async (name: string, requestId: unknown) => {
      mcp.stdin!.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: id++,
          method: "tools/call",
          params: { name, arguments: { requestId } },
        })}\n`,
      );
      const { value } = await lines.next();
      const { result } = JSON.parse(value as string);
      assert.equal(result.isError, true);
      return result._meta["yamakan/requestId"];
    };
    const create = "yamakan_project_create";
    assert.equal(await metaFor(create, "mine.1"), "mine.1");
    assert.equal(await metaFor("yamakan_document_save", "mine.2"), "mine.2");
    // Never echoed: a malformed id, or one too long for a save to use.
    assert.equal(await metaFor(create, "<img src=x>"), "service-trace");
    assert.equal(
      await metaFor("yamakan_document_save", "s".repeat(122)),
      "service-trace",
    );
    assert.equal(
      await metaFor("yamakan_document_save", "s".repeat(121)),
      "s".repeat(121),
    );
    assert.equal(await metaFor(create, "s".repeat(125)), "s".repeat(125));
  } finally {
    const done = once(mcp, "exit");
    mcp.stdin!.end();
    await done;
    refusing.close();
  }
});

test("MCP stdio exposes registry tools and runs the shared command path", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-mcp-"));
  bases.push(root);
  const port = await freePort();
  const env = {
    ...process.env,
    YAMAKAN_WORKSPACE: root,
    YAMAKAN_PORT: String(port),
    YAMAKAN_URL: `http://127.0.0.1:${port}`,
  };
  const server = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    { env, silent: true, windowsHide: true },
  );
  const mcp = spawn(
    process.execPath,
    [fileURLToPath(new URL("../mcp/main.ts", import.meta.url))],
    { env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("startup timeout")),
        10000,
      );
      server.stdout?.on("data", (chunk) => {
        if (String(chunk).includes("Yamakan is running")) {
          clearTimeout(timer);
          resolve();
        }
      });
      server.once("exit", (code) => reject(new Error(`server exited ${code}`)));
    });
    const responses = new Map<number, (value: any) => void>();
    createInterface({ input: mcp.stdout! }).on("line", (line) => {
      const message = JSON.parse(line);
      responses.get(message.id)?.(message);
    });
    let nextId = 1;
    const request = (method: string, params?: unknown) =>
      new Promise<any>((resolve) => {
        const id = nextId++;
        responses.set(id, resolve);
        mcp.stdin!.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
        );
      });

    const init = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "yamakan-test", version: "1" },
    });
    assert.equal(init.result.protocolVersion, "2025-06-18");
    assert.equal(init.result.serverInfo.name, "yamakan");
    mcp.stdin!.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );

    const { tools } = (await request("tools/list")).result;
    const names = tools.map((t: { name: string }) => t.name);
    assert.ok(names.includes("yamakan_project_create"));
    assert.ok(names.every((n: string) => /^[A-Za-z0-9_-]{1,64}$/.test(n)));
    assert.equal(
      tools.find((t: { name: string }) => t.name === "yamakan_project_list")
        .annotations.readOnlyHint,
      true,
    );

    const created = await request("tools/call", {
      name: "yamakan_project_create",
      arguments: { name: "MCP film" },
    });
    assert.equal(created.result.isError, undefined);
    const project = JSON.parse(created.result.content[0].text);
    assert.equal(project.name, "MCP film");

    const listed = await request("tools/call", {
      name: "yamakan_project_list",
      arguments: {},
    });
    assert.deepEqual(
      JSON.parse(listed.result.content[0].text).map(
        (p: { id: string }) => p.id,
      ),
      [project.id],
    );

    // A request id comes back beside the result, and replays it; the result
    // text is the same with or without one.
    const named = {
      name: "yamakan_project_create",
      arguments: { name: "Replayed", requestId: "mcp-replay.1" },
    };
    const first = await request("tools/call", named);
    assert.equal(first.result._meta["yamakan/requestId"], "mcp-replay.1");
    const again = await request("tools/call", named);
    assert.equal(again.result.content[0].text, first.result.content[0].text);
    assert.equal(created.result._meta, undefined);
    // A refusal carries the caller's id, which is the one to retry under.
    const refused = await request("tools/call", {
      name: "yamakan_project_create",
      arguments: { name: "x", shell: "whoami", requestId: "mcp-refused.1" },
    });
    assert.equal(refused.result.isError, true);
    assert.equal(refused.result._meta["yamakan/requestId"], "mcp-refused.1");
    // With no id of the caller's, it carries the service's, to report.
    const untraced = await request("tools/call", {
      name: "yamakan_project_create",
      arguments: { name: "x", shell: "whoami" },
    });
    assert.equal(untraced.result.isError, true);
    assert.match(untraced.result._meta["yamakan/requestId"], /^[0-9a-f-]{36}$/);
    // MCP, the SDK and the CLI read one progress view, cursor included.
    const viewed = JSON.parse(
      (
        await request("tools/call", {
          name: "yamakan_progress_read",
          arguments: { projectId: project.id },
        })
      ).result.content[0].text,
    );
    assert.equal(viewed.format, "yamakan.progress");
    const sdk = new YamakanClient({
      baseUrl: env.YAMAKAN_URL,
      token: (await readFile(path.join(root, "token"), "utf8")).trim(),
    });
    assert.deepEqual(
      await sdk.call("yamakan.progress.read", { projectId: project.id }),
      viewed,
    );
    assert.deepEqual(
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            fileURLToPath(new URL("../cli/main.ts", import.meta.url)),
            "yamakan.progress.read",
            JSON.stringify({ projectId: project.id }),
          ],
          { env, windowsHide: true },
        ).toString(),
      ),
      viewed,
    );
    // A mutation with no receipt refuses an id rather than ignoring it.
    const unreplayable = await request("tools/call", {
      name: "yamakan_job_cancel",
      arguments: { jobId: project.id, requestId: "mcp-cancel.1" },
    });
    assert.equal(unreplayable.result.isError, true);
    assert.match(
      unreplayable.result.content[0].text,
      /cannot replay a request ID/,
    );
    // The same id with other input is refused, not replayed.
    const mismatch = await request("tools/call", {
      name: "yamakan_project_create",
      arguments: { name: "Different", requestId: "mcp-replay.1" },
    });
    assert.equal(
      JSON.parse(mismatch.result.content[0].text).code,
      "IDEMPOTENCY_MISMATCH",
    );

    const invalid = await request("tools/call", {
      name: "yamakan_project_create",
      arguments: { name: "x", shell: "whoami" },
    });
    assert.equal(invalid.result.isError, true);
    assert.equal(JSON.parse(invalid.result.content[0].text).code, "VALIDATION");

    const unknown = await request("tools/call", {
      name: "run_command",
      arguments: { cmd: "whoami" },
    });
    assert.equal(unknown.error.code, -32602);
    assert.equal((await request("no/such/method")).error.code, -32601);
  } finally {
    mcp.stdin!.end();
    if (mcp.exitCode === null) await once(mcp, "exit");
    if (server.exitCode === null) {
      const done = once(server, "exit");
      server.send("shutdown");
      await done;
    }
  }
});
