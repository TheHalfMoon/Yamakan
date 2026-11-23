/**
 * MPR-202: the capability report and the models a person can start, from the real service on
 * loopback, over REST and over MCP, set up in three ways: with no route, with a stand-in for the
 * Kaggle CLI, and with a ComfyUI address where nothing answers. Nothing is sent to Kaggle, no
 * quota is used, no model runs, and the stand-in is never started.
 *
 * What this host has is recorded first. What the run needs is unmeasured.
 *
 * Usage: node scripts/qualify-capability-report.mjs [receipt.json]
 */
import assert from "node:assert/strict";
import { execFileSync, fork, spawn } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnostic } from "../core/engines/contract-v2.ts";
import { YamakanClient } from "../sdk/client.ts";
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain") !== "";
const out =
  process.argv[2] ??
  fileURLToPath(
    new URL(
      "../docs/evidence/model-system/capability-report.json",
      import.meta.url,
    ),
  );
const root = mkdtempSync(join(tmpdir(), "yamakan-capability-report-"));
const where = fileURLToPath(new URL("..", import.meta.url));
const COMMANDS = {
  capabilities: "yamakan.engines.capabilities",
  options: "yamakan.generation.options",
};

// A program the service takes for the Kaggle CLI, with the fixture behind it. It leaves a mark
// if it is ever started.
const program = join(root, "fake-kaggle.exe");
const mark = join(root, "started.txt");
function standIn() {
  const csc =
    process.platform === "win32"
      ? join(
          process.env.WINDIR,
          "Microsoft.NET",
          "Framework64",
          "v4.0.30319",
          "csc.exe",
        )
      : null;
  if (!csc || !existsSync(csc))
    return "The C# compiler that the stand-in needs is not on this host.";
  const source = join(root, "fake-kaggle.cs");
  writeFileSync(
    source,
    `using System; using System.Diagnostics; using System.IO; using System.Linq;
class P { static int Main(string[] a) {
  File.WriteAllText(Environment.GetEnvironmentVariable("KAGGLE_FAKE_MARK"), "started");
  var s = new ProcessStartInfo(Environment.GetEnvironmentVariable("KAGGLE_FAKE_NODE"));
  s.Arguments = "\\"" + Environment.GetEnvironmentVariable("KAGGLE_FAKE_SCRIPT") + "\\" " + string.Join(" ", a.Select(x => "\\"" + x + "\\""));
  s.UseShellExecute = false;
  var p = Process.Start(s); p.WaitForExit(); return p.ExitCode;
} }`,
  );
  execFileSync(csc, ["/nologo", `/out:${program}`, source], {
    windowsHide: true,
    stdio: "ignore",
  });
  return null;
}

const ROUTES = {
  none: {},
  kaggle: {
    YAMAKAN_KAGGLE_CLI: program,
    YAMAKAN_KAGGLE_USERNAME: "someone",
    KAGGLE_FAKE_MARK: mark,
    KAGGLE_FAKE_NODE: process.execPath,
    KAGGLE_FAKE_SCRIPT: fileURLToPath(
      new URL("./fixtures/fake-kaggle.mjs", import.meta.url),
    ),
  },
  // The discard port, where nothing is expected to listen; the service asks it nothing here.
  comfyui: { YAMAKAN_COMFYUI_URL: "http://127.0.0.1:9" },
};
// This host's own settings are no part of it.
const bare = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^(YAMAKAN_|MAKANSTUDIO_|KAGGLE_)/.test(name),
  ),
);

async function answers(name, port) {
  const workspace = join(root, name);
  const env = {
    ...bare,
    ...ROUTES[name],
    YAMAKAN_WORKSPACE: workspace,
    YAMAKAN_PORT: String(port),
  };
  const url = `http://127.0.0.1:${port}`;
  const children = [];
  let said = "";
  try {
    const service = fork(join(where, "server", "main.ts"), [], {
      env,
      silent: true,
      windowsHide: true,
    });
    children.push(service);
    service.stderr.on("data", (c) => (said += String(c)));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The service did not start.")),
        30_000,
      );
      service.stdout.on("data", (chunk) => {
        if (!String(chunk).includes("Yamakan is running")) return;
        clearTimeout(timer);
        resolve();
      });
      service.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`The service exited ${code}. ${said}`));
      });
    });
    const client = new YamakanClient({
      baseUrl: url,
      token: readFileSync(join(workspace, "token"), "utf8").trim(),
    });
    const rest = {};
    for (const [key, operation] of Object.entries(COMMANDS))
      rest[key] = await client.call(operation, {});
    const mcp = spawn(process.execPath, [join(where, "mcp", "main.ts")], {
      env: { ...env, YAMAKAN_MCP_LOCAL_CLIENT: "1", YAMAKAN_URL: url },
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    children.push(mcp);
    const overMcp = {};
    const waiting = new Map();
    let buffer = "";
    mcp.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const answer = JSON.parse(line);
        waiting.get(answer.id)?.(JSON.parse(answer.result.content[0].text));
      }
    });
    let id = 0;
    for (const [key, operation] of Object.entries(COMMANDS))
      overMcp[key] = await new Promise((resolve, reject) => {
        const mine = ++id;
        const timer = setTimeout(
          () => reject(new Error("MCP did not answer.")),
          20_000,
        );
        mcp.once("exit", (code) => reject(new Error(`MCP exited ${code}.`)));
        mcp.stdin.on("error", reject);
        waiting.set(mine, (result) => {
          clearTimeout(timer);
          resolve(result);
        });
        mcp.stdin.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: mine,
            method: "tools/call",
            params: { name: operation.replaceAll(".", "_"), arguments: {} },
          })}\n`,
        );
      });
    assert.deepEqual(overMcp, rest, `${name}: the two transports agree`);
    return rest;
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const gone = once(child, "exit");
        child.kill();
        await gone.catch(() => {});
      }
  }
}

const measured = {};
const configurations = {};
let failure = null;
try {
  const blocked = standIn();
  let port = 24390;
  for (const name of Object.keys(ROUTES)) {
    if (name === "kaggle" && blocked) {
      configurations[name] = { outcome: "BLOCKED", reason: blocked };
      console.log(`BLOCKED - ${name}: ${blocked}`);
      continue;
    }
    const { capabilities, options } = await answers(name, port++);
    const { report, operations } = capabilities;
    const count = (state) =>
      report.cells.filter((c) => c.state === state).length;
    assert.equal(report.cells.length, 30);
    assert.deepEqual(
      ["supported", "unverified", "unsupported"].map(count),
      [3, 3, 24],
    );
    assert.equal(report.refused.length, 1);
    assert.equal(operations.length, 5);
    assert.ok(operations.every((o) => o.reason === "ENGINE_DISABLED"));
    assert.deepEqual(
      report.routes.map((r) => [r.route, r.configured]),
      [
        ["kaggle", name === "kaggle"],
        ["comfyui", name === "comfyui"],
        ["local", false],
      ],
    );
    for (const c of report.cells)
      if (c.state !== "supported")
        for (const reason of c.reasons)
          assert.ok(report.reasonMessages[reason], reason);
    assert.equal(options.route, name === "kaggle" ? "kaggle" : null);
    assert.deepEqual(
      options.models.map((m) => m.recipeId).sort(),
      name === "kaggle"
        ? report.cells
            .filter((c) => c.route === "kaggle" && c.state === "supported")
            .map((c) => c.recipeId)
            .sort()
        : [],
    );
    const bytes = Buffer.byteLength(JSON.stringify(report));
    assert.ok(bytes < 32 * 1024, `${bytes}`);
    measured.largestReportBytes = Math.max(
      measured.largestReportBytes ?? 0,
      bytes,
    );
    configurations[name] = { outcome: "PASS", capabilities, options };
    console.log(`ok - ${name}`);
  }
  // A route that is set up changes no cell.
  const cells = Object.values(configurations)
    .filter((c) => c.outcome === "PASS")
    .map((c) => c.capabilities.report.cells);
  for (const other of cells) assert.deepEqual(other, cells[0]);
  assert.ok(!existsSync(mark), "the stand-in was never started");
} catch (e) {
  // The receipt is committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
}
const outcomes = Object.values(configurations).map((c) => c.outcome);
const passed =
  failure === null &&
  outcomes.length === Object.keys(ROUTES).length &&
  outcomes.every((o) => o === "PASS");
const outcome = passed ? "PASS" : failure === null ? "BLOCKED" : "FAIL";
writeFileSync(
  out,
  `${JSON.stringify(
    {
      task: "MPR-202",
      head,
      dirty,
      host,
      outcome,
      passed,
      failure,
      measured,
      configurations,
    },
    null,
    2,
  )}\n`,
);
rmSync(root, {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 200,
});
console.log(`CAPABILITY REPORT ${outcome}`);
process.exit(passed ? 0 : 1);
