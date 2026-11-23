/**
 * MPR-501: what an agent sees over MCP, with the real service and the real MCP server. A person
 * makes a read-only token and a wider one on the page; each token's tool list is the service's
 * own for it; a withheld tool is refused as over REST; a cancelled call gets no answer; and the
 * same MCP process lists again after the service restarts. Real Edge, no media, no model.
 *
 * What this host has is recorded first. What the run needs is unmeasured. A missing browser or
 * native helper ends BLOCKED, never PASS.
 *
 * Usage: node scripts/qualify-agent-mcp.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork, spawn } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { commands } from "../core/command/registry.ts";
import { writeLaunchLink } from "../core/launch.ts";
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();
const at = (file) => fileURLToPath(new URL(`../${file}`, import.meta.url));
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const gitHead = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain") !== "";
const receiptOut =
  process.argv[2] ?? at("docs/evidence/qualification/mpr-501-agent-mcp.json");

const root = mkdtempSync(path.join(tmpdir(), "yamakan-agent-mcp-"));
const workspace = path.join(root, "workspace");
const port = 24377;
const url = `http://127.0.0.1:${port}`;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const children = [];
let service;
let browser;
let passed = false;
let blocked = null;
let failure = null;

const start = async () => {
  service = fork(at("server/main.ts"), [], {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: workspace,
      YAMAKAN_PORT: String(port),
    },
    silent: true,
    windowsHide: true,
  });
  children.push(service);
  let stderr = "";
  service.stderr.on("data", (c) => (stderr += String(c)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Startup timeout: ${stderr.slice(-500)}`)),
      20000,
    );
    service.stdout.on("data", (c) => {
      if (!String(c).includes("Yamakan is running")) return;
      clearTimeout(timer);
      resolve();
    });
    service.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Service exited ${code}: ${stderr.slice(-500)}`));
    });
  });
};
const stop = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const gone = once(child, "exit");
  child.kill();
  await gone;
};
const catalogOf = async (token) =>
  (
    await fetch(`${url}/api/v1/tools`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
const overRest = async (token, operation, parameters) =>
  (
    await fetch(`${url}/api/v1/call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ apiVersion: 1, operation, parameters }),
    })
  ).json();

// The MCP server as an agent starts it: its token in a file, nothing else.
function connect(name, token) {
  const file = path.join(root, `${name}.token`);
  writeFileSync(file, token, { mode: 0o600 });
  const {
    YAMAKAN_MCP_LOCAL_CLIENT: _,
    YAMAKAN_AGENT_TOKEN: __,
    ...env
  } = process.env;
  const child = spawn(process.execPath, [at("mcp/main.ts")], {
    env: {
      ...env,
      YAMAKAN_WORKSPACE: path.join(root, "no-workspace"),
      YAMAKAN_AGENT_TOKEN_FILE: file,
      YAMAKAN_URL: url,
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);
  const answers = [];
  const waiting = new Map();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    answers.push(message);
    waiting.get(message.id)?.(message);
  });
  let next = 1;
  const line = (message) =>
    `${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`;
  const request = (method, params) => {
    const id = next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No answer to ${method}.`)),
        20000,
      );
      waiting.set(id, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      child.stdin.write(line({ id, method, params }));
    });
  };
  return {
    request,
    answers,
    // One write, so that the cancellation is there as soon as the call is.
    callAndCancel: (name, args) => {
      const id = next++;
      child.stdin.write(
        line({ id, method: "tools/call", params: { name, arguments: args } }) +
          line({
            method: "notifications/cancelled",
            params: { requestId: id },
          }),
      );
      return id;
    },
  };
}

// The MCP list against the service's own for the same token.
async function compare(name, client, token) {
  const list = await client.request("tools/list");
  const tools = list.result.tools;
  const shown = tools.filter((t) => t.title !== "yamakan.document.save");
  const own = await catalogOf(token);
  assert.deepEqual(
    shown.map((t) => t.title).sort(),
    own.tools.map((t) => t.name).sort(),
  );
  assert.equal(
    own.tools.length + own.withheld.length,
    Object.keys(commands).length,
  );
  for (const t of shown) {
    const entry = own.tools.find((x) => x.name === t.title);
    assert.equal(entry.humanOnly, false, t.title);
    assert.deepEqual(
      t.annotations,
      entry.mutation
        ? { readOnlyHint: false, destructiveHint: entry.destructive }
        : { readOnlyHint: true },
      t.title,
    );
  }
  return {
    token: name,
    tools: tools.length,
    commands: shown.length,
    withheldByScope: own.withheld.filter((w) => w.reason === "scope").length,
    browserOnly: own.withheld.filter((w) => w.reason === "browser-only").length,
    changing: shown.filter((t) => !t.annotations.readOnlyHint).length,
    destructive: shown.filter((t) => t.annotations.destructiveHint).length,
  };
}

try {
  if (
    process.platform === "win32" &&
    !existsSync(at("native/procd/target/release/yamakan-acl.exe"))
  ) {
    blocked = "The native helpers are not built.";
    throw new Error(blocked);
  }
  execFileSync("npm", ["run", "build"], {
    stdio: "inherit",
    windowsHide: true,
    shell: true,
  });
  await start();
  await writeLaunchLink(workspace, url);
  try {
    browser = await chromium.launch({
      channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
      headless: true,
    });
  } catch (e) {
    blocked = "The browser does not start on this host.";
    throw e;
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(
    readFileSync(path.join(workspace, "launch"), "utf8").split("\n")[0].trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  await page.getByRole("tab", { name: "Finish", exact: true }).click();
  await page.locator("details.agent-tools > summary").click();
  await page.getByTestId("agent-access").waitFor();
  const make = async (label, scopes) => {
    await page.getByTestId("agent-access-label").fill(label);
    for (const scope of scopes)
      await page.getByTestId(`agent-access-scope-${scope}`).check();
    await page.getByTestId("agent-access-end").selectOption("7");
    await page.getByTestId("agent-access-create").click();
    const box = page.getByTestId("agent-access-token");
    await box.waitFor();
    const token = await box.inputValue();
    assert.match(token, /^[0-9a-f]{64}$/);
    await page.getByTestId("agent-access-done").click();
    return token;
  };
  const reader = await make("qualify reader", []);
  const wider = await make("qualify wider", [
    "project:write",
    "render:execute",
    "job:control",
  ]);
  step("a person makes a read-only token and a wider one on the page");

  const asReader = connect("reader", reader);
  const asWider = connect("wider", wider);
  for (const client of [asReader, asWider])
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "qualify", version: "1" },
    });
  const seen = {
    reader: await compare("reader", asReader, reader),
    wider: await compare("wider", asWider, wider),
  };
  assert.ok(seen.reader.commands < seen.wider.commands);
  assert.equal(seen.reader.changing, 0);
  step(
    "each token's MCP list is the service's own for it, with its marks",
    seen,
  );

  for (const operation of [
    "yamakan.project.create",
    "yamakan.agent.create",
    "yamakan.generation.start",
  ]) {
    const answer = await asReader.request("tools/call", {
      name: operation.replaceAll(".", "_"),
      arguments: {},
    });
    assert.equal(answer.result.isError, true);
    const said = JSON.parse(answer.result.content[0].text);
    const { error } = await overRest(reader, operation, {});
    assert.equal(said.code, "SCOPE_DENIED");
    assert.deepEqual([said.code, said.message], [error.code, error.message]);
  }
  const unknown = await asReader.request("tools/call", {
    name: "yamakan_nothing",
    arguments: {},
  });
  assert.equal(unknown.error.code, -32602);
  step("a withheld tool is refused as over REST, and an unknown one unknown");

  const id = asWider.callAndCancel("yamakan_project_create", {
    name: "Cancelled",
  });
  const kept = await asWider.request("tools/call", {
    name: "yamakan_project_create",
    arguments: { name: "Kept" },
  });
  assert.equal(kept.result.isError, undefined);
  assert.equal(asWider.answers.filter((a) => a.id === id).length, 0);
  const names = JSON.parse(
    (
      await asWider.request("tools/call", {
        name: "yamakan_project_list",
        arguments: {},
      })
    ).result.content[0].text,
  ).map((p) => p.name);
  assert.deepEqual(names, ["Kept"]);
  step(
    "a call cancelled in flight, before it is sent, is not done or answered",
  );

  const refused = await asWider.request("tools/call", {
    name: "yamakan_proxy_build",
    arguments: {
      projectId: crypto.randomUUID(),
      assetId: crypto.randomUUID(),
      requestId: "proxy.1",
    },
  });
  assert.match(refused.result.content[0].text, /cannot replay a request ID/);
  step("a proxy build refuses a request id");

  await stop(service);
  await start();
  assert.deepEqual(await compare("reader", asReader, reader), seen.reader);
  assert.deepEqual(await compare("wider", asWider, wider), seen.wider);
  step("after a restart the same MCP processes list the same");

  assert.deepEqual(pageErrors, []);
  passed = true;
} catch (e) {
  failure = e instanceof Error ? e.message : String(e);
  console.error(failure);
} finally {
  await browser?.close().catch(() => {});
  for (const child of children) await stop(child).catch(() => {});
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  mkdirSync(path.dirname(receiptOut), { recursive: true });
  writeFileSync(
    receiptOut,
    `${JSON.stringify(
      {
        task: "MPR-501",
        gitHead,
        dirty,
        host,
        outcome: passed ? "PASS" : blocked ? "BLOCKED" : "FAIL",
        passed,
        failure,
        steps,
      },
      null,
      2,
    )}\n`,
  );
}
console.log(passed ? "PASS" : blocked ? "BLOCKED" : "FAIL", receiptOut);
process.exitCode = passed ? 0 : 1;
