/**
 * MPR-208: the licence gate over the whole model catalog, and the models the real service on
 * loopback says a person can start, over REST and over MCP, with a stand-in for the Kaggle CLI.
 * Nothing is sent to Kaggle, no quota is used, no model runs, and the stand-in is never started.
 * It reads nothing from the network: no licence text is read here, only what the blocks say.
 *
 * What this host has is recorded first. What the run needs is unmeasured.
 *
 * Usage: node scripts/qualify-licence-gate.mjs [receipt.json]
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
import { MODEL_CATALOG } from "../core/engines/catalog.ts";
import {
  PRE_GATE_EXCEPTIONS,
  beforeTheGate,
  licenceGate,
  openLicenceFields,
  recipeLicence,
} from "../core/engines/licence.ts";
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
      "../docs/evidence/qualification/mpr-208-licence-gate.json",
      import.meta.url,
    ),
  );
const root = mkdtempSync(join(tmpdir(), "yamakan-licence-gate-"));
const where = fileURLToPath(new URL("..", import.meta.url));
const COMMANDS = { options: "yamakan.generation.options" };

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

const ROUTE = {
  YAMAKAN_KAGGLE_CLI: program,
  YAMAKAN_KAGGLE_USERNAME: "someone",
  KAGGLE_FAKE_MARK: mark,
  KAGGLE_FAKE_NODE: process.execPath,
  KAGGLE_FAKE_SCRIPT: fileURLToPath(
    new URL("./fixtures/fake-kaggle.mjs", import.meta.url),
  ),
};
// This host's own settings are no part of it.
const bare = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^(YAMAKAN_|MAKANSTUDIO_|KAGGLE_)/.test(name),
  ),
);

async function answers(port) {
  const workspace = join(root, "workspace");
  const env = {
    ...bare,
    ...ROUTE,
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
    return { rest: rest.options, mcp: overMcp.options };
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const gone = once(child, "exit");
        child.kill();
        await gone.catch(() => {});
      }
  }
}

// Every offer of the catalog, by what the gate and the list from before it say.
const began = process.hrtime.bigint();
const entries = MODEL_CATALOG.entries.flatMap((entry) =>
  entry.offers.map((offer) => {
    const use = { run: offer.route === "kaggle" ? "hosted" : "local" };
    const gate = licenceGate(entry.licence, use);
    const recipe = {
      recipeId: offer.recipeId,
      model: entry.identity.model,
      revision: entry.identity.revision,
    };
    const { offered } = recipeLicence(recipe, entry.licence, use);
    return {
      id: entry.id,
      recipeId: offer.recipeId,
      route: offer.route,
      lifecycle: offer.lifecycle,
      gate: gate.offered ? "offered" : "refused",
      reasons: gate.offered ? [] : gate.reasons,
      open: openLicenceFields(entry.licence, use),
      beforeTheGate: beforeTheGate(recipe),
      mayBeOffered: offered,
      sourceUrl: entry.licence.sourceUrl,
      verifiedAt: entry.licence.verifiedAt,
      ageDays: Math.floor(
        (Date.now() - Date.parse(entry.licence.verifiedAt)) / 86_400_000,
      ),
      evidence: entry.licence.evidence,
    };
  }),
);
const checkedMs = Number(process.hrtime.bigint() - began) / 1e6;

let service = { outcome: "BLOCKED", reason: null };
let failure = null;
try {
  assert.ok(checkedMs < 500, `${checkedMs} ms for the whole catalog`);
  const expected = entries
    .filter((e) => e.lifecycle === "offered" && e.mayBeOffered)
    .map((e) => e.recipeId)
    .sort();
  // Nothing in the offered state but what the gate allows, or the closed list from before it.
  for (const e of entries.filter((x) => x.lifecycle === "offered"))
    assert.ok(e.gate === "offered" || e.beforeTheGate, `${e.recipeId}`);
  const blocked = standIn();
  if (blocked) {
    service.reason = blocked;
    console.log(`BLOCKED - ${blocked}`);
  } else {
    const { rest, mcp } = await answers(24394);
    assert.deepEqual(mcp, rest, "the two transports agree");
    assert.equal(rest.route, "kaggle");
    assert.deepEqual(rest.models.map((m) => m.recipeId).sort(), expected);
    for (const m of rest.models) {
      const e = entries.find((x) => x.recipeId === m.recipeId);
      assert.deepEqual(m.licenceOpen, e.open, m.recipeId);
    }
    assert.ok(!existsSync(mark), "the stand-in was never started");
    service = {
      outcome: "PASS",
      rest: rest.models.map((m) => m.recipeId),
      mcp: mcp.models.map((m) => m.recipeId),
      bothListWhatMayBeOffered: true,
    };
    console.log("ok - both surfaces list what may be offered, and no more");
  }
} catch (e) {
  // The receipt is committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
}
const passed = failure === null && service.outcome === "PASS";
const outcome = passed ? "PASS" : failure === null ? "BLOCKED" : "FAIL";
writeFileSync(
  out,
  `${JSON.stringify(
    {
      task: "MPR-208",
      head,
      dirty,
      host,
      outcome,
      passed,
      failure,
      checkedMs,
      exceptionsFrom: PRE_GATE_EXCEPTIONS.at,
      entries,
      service,
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
console.log(`LICENCE GATE ${outcome}`);
process.exit(passed ? 0 : 1);
