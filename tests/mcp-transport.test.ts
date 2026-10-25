import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import type { Socket } from "node:net";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { LineFramer, MCP_LIMITS } from "../mcp/framing.ts";

const lines = (frames: ReturnType<LineFramer["push"]>) =>
  frames.map((f) => ("line" in f ? f.line : "<oversized>"));

test("framer joins frames across chunks and skips blank and CRLF lines", () => {
  const framer = new LineFramer(64);
  assert.deepEqual(lines(framer.push('{"a":1}\n{"b"')), ['{"a":1}']);
  assert.deepEqual(lines(framer.push(':2}\r\n\n  \n{"c":3}\n')), [
    '{"b":2}',
    '{"c":3}',
  ]);
  assert.equal(framer.retainedBytes, 0);
});

test("framer counts UTF-8 bytes, not characters, at the limit", () => {
  const framer = new LineFramer(8);
  // Four two-byte characters: exactly at the limit.
  assert.deepEqual(lines(framer.push("éééé\n")), ["éééé"]);
  // Five characters, ten bytes: over the limit although only five long.
  assert.deepEqual(lines(framer.push("ééééé\n")), ["<oversized>"]);
  // An emoji is four bytes (two UTF-16 units).
  assert.deepEqual(lines(framer.push("😀😀\n")), ["😀😀"]);
  assert.deepEqual(lines(framer.push("😀😀a\n")), ["<oversized>"]);
});

test("a complete oversized line is refused without parsing; the next line still works", () => {
  const framer = new LineFramer(16);
  const frames = framer.push(`${"x".repeat(17)}\n{"ok":true}\n`);
  assert.deepEqual(lines(frames), ["<oversized>", '{"ok":true}']);
});

test("an oversized partial line is dropped once and its tail never becomes a message", () => {
  const framer = new LineFramer(16);
  assert.deepEqual(lines(framer.push("y".repeat(10))), []);
  assert.equal(framer.retainedBytes, 10);
  // Crosses the limit without a newline: reported now, held no longer.
  assert.deepEqual(lines(framer.push("y".repeat(10))), ["<oversized>"]);
  assert.equal(framer.retainedBytes, 0);
  // Tail of the same line, including JSON-looking text, is discarded.
  assert.deepEqual(lines(framer.push('{"id":1}'.repeat(50))), []);
  assert.equal(framer.retainedBytes, 0);
  assert.deepEqual(lines(framer.push('{"id":2}\n{"id":3}\n')), ['{"id":3}']);
});

test("limits are the request cap and small fixed admission bounds", () => {
  assert.equal(MCP_LIMITS.lineBytes, 2 * 1024 * 1024);
  assert.ok(MCP_LIMITS.inFlight >= 1 && MCP_LIMITS.inFlight <= 64);
  assert.ok(MCP_LIMITS.outputBytes <= 4 * 1024 * 1024);
});

// The MCP process alone: initialize and ping need no service, and tool
// calls go to `url` (a listener this test controls).
function startMcp(url: string, nodeArgs: string[] = []) {
  const mcp = spawn(
    process.execPath,
    [...nodeArgs, fileURLToPath(new URL("../mcp/main.ts", import.meta.url))],
    {
      env: {
        ...process.env,
        YAMAKAN_URL: url,
        YAMAKAN_AGENT_TOKEN: "test-token",
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const replies: any[] = [];
  const waiters: Array<() => void> = [];
  createInterface({ input: mcp.stdout! }).on("line", (line) => {
    replies.push(JSON.parse(line));
    for (const wake of waiters.splice(0)) wake();
  });
  const until = async (count: number, ms: number) => {
    const deadline = Date.now() + ms;
    while (replies.length < count) {
      if (Date.now() > deadline)
        throw new Error(`timed out with ${replies.length}/${count} replies`);
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 200);
      });
    }
  };
  return { mcp, replies, until };
}

async function stop(mcp: ChildProcess) {
  if (mcp.exitCode !== null) return;
  const exited = once(mcp, "exit");
  mcp.stdin!.end();
  const timer = setTimeout(() => mcp.kill(), 20_000);
  await exited;
  clearTimeout(timer);
}

const ping = (id: number) =>
  `${JSON.stringify({ jsonrpc: "2.0", id, method: "ping" })}\n`;

test("MCP refuses an oversized newline-terminated frame and keeps serving", async () => {
  const { mcp, replies, until } = startMcp("http://127.0.0.1:9");
  try {
    const huge = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "ping",
      params: { pad: "a".repeat(MCP_LIMITS.lineBytes) },
    });
    mcp.stdin!.write(`${huge}\n${ping(2)}`);
    await until(2, 20_000);
    assert.equal(replies[0].id, null);
    assert.equal(replies[0].error.code, -32700);
    assert.match(replies[0].error.message, /size limit/);
    // The oversized message was never executed: no reply for id 1.
    assert.deepEqual(replies[1], { jsonrpc: "2.0", id: 2, result: {} });
    assert.ok(!replies.some((r) => r.id === 1));
  } finally {
    await stop(mcp);
  }
});

test("positive control: thousands of frames in one chunk are all answered in order", async () => {
  // Valid traffic at volume keeps working under the bounds (a small heap
  // guards against gross retention, not a precise memory bound).
  const { mcp, replies, until } = startMcp("http://127.0.0.1:9", [
    "--max-old-space-size=48",
  ]);
  try {
    const count = 50_000;
    let batch = "";
    for (let id = 1; id <= count; id++) batch += ping(id);
    mcp.stdin!.write(batch);
    await until(count, 120_000);
    assert.equal(replies.length, count);
    assert.ok(replies.every((r, i) => r.id === i + 1 && r.result));
  } finally {
    await stop(mcp);
  }
  assert.equal(mcp.exitCode, 0);
});

test("10k concurrent tool calls never exceed the in-flight bound and all get answers", async () => {
  // A listener that holds every connection open without answering, so each
  // admitted call stays in flight until the test releases it.
  const open = new Set<Socket>();
  let peak = 0;
  let release = false;
  const service = createServer((socket) => {
    socket.on("error", () => {});
    if (release) return void socket.destroy();
    open.add(socket);
    peak = Math.max(peak, open.size);
    socket.on("close", () => open.delete(socket));
  });
  service.listen(0, "127.0.0.1");
  await once(service, "listening");
  const port = (service.address() as { port: number }).port;
  const { mcp, replies, until } = startMcp(`http://127.0.0.1:${port}`);
  try {
    const count = 10_000;
    let batch = "";
    for (let id = 1; id <= count; id++)
      batch += `${JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name: "yamakan_project_list", arguments: {} },
      })}\n`;
    mcp.stdin!.write(batch);
    // Let the server admit as many as it will.
    const settle = Date.now() + 3000;
    while (Date.now() < settle) await new Promise((r) => setTimeout(r, 100));
    assert.ok(peak >= 1, "no call reached the service");
    assert.ok(
      peak <= MCP_LIMITS.inFlight,
      `${peak} connections in flight exceed ${MCP_LIMITS.inFlight}`,
    );
    assert.equal(replies.length, 0);
    // Release: every held and later connection fails, so each call answers.
    release = true;
    for (const socket of open) socket.destroy();
    await until(count, 180_000);
    const ids = new Set(replies.map((r) => r.id));
    assert.equal(ids.size, count);
    assert.ok(replies.every((r) => r.error?.code === -32603 || r.result));
    assert.ok(peak <= MCP_LIMITS.inFlight);
  } finally {
    await stop(mcp);
    service.close();
  }
});

test("closing stdin right after a flood still delivers every reply before exit", async () => {
  const { mcp, replies, until } = startMcp("http://127.0.0.1:9");
  const count = 5_000;
  let batch = "";
  for (let id = 1; id <= count; id++) batch += ping(id);
  const exited = once(mcp, "exit");
  mcp.stdin!.end(batch);
  await until(count, 60_000);
  const [code] = await exited;
  assert.equal(code, 0);
  assert.equal(replies.length, count);
});
