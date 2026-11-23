/**
 * MPR-204: the approvals without which nothing is sent to Kaggle, on the Create page in a real
 * browser against the real service, with a stand-in for the Kaggle CLI. No network, no quota and
 * no model: what it shows is what this page and this service do, and nothing of real Kaggle.
 *
 * What this host has is recorded first. What the run needs is unmeasured. A missing browser or C#
 * compiler is BLOCKED, never PASS.
 *
 * Usage: node scripts/qualify-gates.mjs [evidence.md]   (Windows, for now)
 */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { execFileSync, fork } from "node:child_process";
import {
  existsSync,
  mkdirSync,
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
    new URL("../docs/evidence/model-system/gates.md", import.meta.url),
  );
const USERNAME = "someone";
const PORT = 24395;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const root = mkdtempSync(join(tmpdir(), "yamakan-gates-check-"));
const scene = join(root, "scene.json");
const steps = [];
const step = (name, detail) => {
  steps.push(detail ? `${name}: ${detail}` : name);
  console.log(`ok - ${name}`);
};
const calls = () =>
  existsSync(`${scene}.log`)
    ? readFileSync(`${scene}.log`, "utf8").trim().split("\n").filter(Boolean)
    : [];
let child;
let browser;
let blocked = null;
let failure = null;
let passed = false;
try {
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
  if (!csc || !existsSync(csc)) {
    blocked = "The C# compiler that the stand-in needs is not on this host.";
    throw new Error(blocked);
  }
  try {
    browser = await chromium.launch({
      channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
      headless: true,
    });
  } catch {
    blocked = "The browser does not start on this host.";
    throw new Error(blocked);
  }
  execFileSync("npm", ["run", "build"], {
    stdio: "ignore",
    shell: true,
    windowsHide: true,
  });
  // The service needs a program it can run directly: this hands on to the script.
  const program = join(root, "fake-kaggle.exe");
  writeFileSync(
    join(root, "fake-kaggle.cs"),
    `using System; using System.Diagnostics; using System.Linq;
class P { static int Main(string[] a) {
  var s = new ProcessStartInfo(Environment.GetEnvironmentVariable("KAGGLE_FAKE_NODE"));
  s.Arguments = "\\"" + Environment.GetEnvironmentVariable("KAGGLE_FAKE_SCRIPT") + "\\" " + string.Join(" ", a.Select(x => "\\"" + x + "\\""));
  s.UseShellExecute = false; s.RedirectStandardOutput = true; s.RedirectStandardError = true;
  var p = Process.Start(s);
  var e = p.StandardError.ReadToEndAsync();
  Console.Out.Write(p.StandardOutput.ReadToEnd());
  Console.Error.Write(e.Result);
  p.WaitForExit();
  return p.ExitCode;
} }`,
  );
  execFileSync(
    csc,
    ["/nologo", `/out:${program}`, join(root, "fake-kaggle.cs")],
    { windowsHide: true, stdio: "ignore" },
  );
  writeFileSync(
    scene,
    JSON.stringify({
      state: "RUNNING",
      push: "ok",
      pushes: [],
      remote: `${USERNAME}/yamakan`,
      video: {},
    }),
  );
  const scratch = join(root, "tmp");
  mkdirSync(scratch);
  // This host's own proxy and certificate settings are no part of it.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !/^(YAMAKAN_|MAKANSTUDIO_|KAGGLE_)/.test(name) &&
        !/^(?:(?:HTTP|HTTPS|ALL|NO)_PROXY|REQUESTS_CA_BUNDLE|CURL_CA_BUNDLE|SSL_CERT_FILE)$/i.test(
          name,
        ),
    ),
  );
  const start = async (over = {}) => {
    let log = "";
    child = fork(
      fileURLToPath(new URL("../server/main.ts", import.meta.url)),
      [],
      {
        env: {
          ...env,
          TEMP: scratch,
          TMP: scratch,
          YAMAKAN_WORKSPACE: join(root, "workspace"),
          YAMAKAN_PORT: String(PORT),
          YAMAKAN_KAGGLE_CLI: program,
          YAMAKAN_KAGGLE_USERNAME: USERNAME,
          KAGGLE_FAKE_NODE: process.execPath,
          KAGGLE_FAKE_SCRIPT: fileURLToPath(
            new URL("./fixtures/fake-kaggle.mjs", import.meta.url),
          ),
          KAGGLE_FAKE_SCENE: scene,
          ...over,
        },
        silent: true,
        windowsHide: true,
      },
    );
    child.stderr.on("data", (c) => (log += String(c)));
    await new Promise((ready, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout: ${log}`)),
        60_000,
      );
      child.stdout.on("data", (chunk) => {
        if (!String(chunk).includes("Yamakan is running")) return;
        clearTimeout(timer);
        ready();
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited ${code}: ${log}`));
      });
    });
  };
  const stop = () =>
    new Promise((done) => {
      if (child.exitCode !== null || child.signalCode !== null) return done();
      child.once("exit", done);
      child.kill("SIGKILL");
    });
  const { writeLaunchLink } = await import("../core/launch.ts");
  const link = async () => {
    await writeLaunchLink(join(root, "workspace"), ORIGIN);
    return readFileSync(join(root, "workspace", "launch"), "utf8")
      .split("\n")[0]
      .trim();
  };
  await start();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
  });
  const pageErrors = [];
  const external = [];
  page.on("pageerror", (e) => {
    pageErrors.push(e.message);
    console.error(e.stack);
  });
  page.on("request", (r) => {
    if (!r.url().startsWith(ORIGIN) && !/^(data|blob|about):/.test(r.url()))
      external.push(r.url());
  });
  await page.addInitScript(() => {
    // A blank page has no storage.
    if (location.protocol !== "http:") return;
    if (!localStorage.getItem("yamakan.lang"))
      localStorage.setItem("yamakan.lang", "en");
  });
  const arrive = async () => {
    // A session of a service that has gone is no session of this one.
    await page.evaluate(() => sessionStorage.clear()).catch(() => {});
    await page.goto("about:blank");
    await page.goto(await link());
    await page.waitForFunction(
      () => location.hash === "" && sessionStorage.getItem("yamakan.session"),
    );
  };
  const call = async (operation, parameters) => {
    const body = await page.evaluate(
      async ([operation, parameters]) => {
        const stored = JSON.parse(sessionStorage.getItem("yamakan.session"));
        const res = await fetch("/api/v1/call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Yamakan-Session": stored.session,
          },
          body: JSON.stringify({ apiVersion: 1, operation, parameters }),
        });
        return res.json();
      },
      [operation, parameters],
    );
    if (body.error)
      throw Object.assign(new Error(body.error.message), {
        code: body.error.code,
      });
    return body.result;
  };
  await arrive();
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-panel").waitFor();
  await page.getByTestId("create-prompt").fill("A red kite.");
  const at = (id) => page.getByTestId(id);
  const gates = at("create-gates");
  await gates.waitFor();
  const isOpen = (open) =>
    page.waitForFunction(
      (want) =>
        document
          .querySelector('[data-testid="create-gates"]')
          ?.getAttribute("data-open") === want,
      String(open),
    );
  await isOpen(false);
  const asked = await gates.innerText();
  for (const part of [
    "Nothing is sent until you allow it.",
    "kaggle.com",
    USERNAME,
    "the picture",
    "allowance: 1",
    "Hours from now: 1",
    "is not followed here until you allow it again",
    "The Kaggle CLI chooses the hosts it contacts.",
  ])
    assert.ok(asked.includes(part), `${part} in: ${asked}`);
  assert.equal(await at("create-gates-runs").inputValue(), "1");
  assert.equal(await at("create-gates-hours").inputValue(), "1");
  assert.equal(await gates.locator("a").count(), 0);
  step(
    "with no approval the page says what would be allowed, one run and one hour",
  );

  const startRun = async () => {
    await at("create-agree").check();
    await at("create-generate-start").click();
  };
  await startRun();
  const refused = page.locator(".create-generate [role=alert]");
  await refused.waitFor();
  assert.match(
    await refused.innerText(),
    /No one has approved contacting kaggle\.com as someone/,
  );
  assert.deepEqual(calls(), []);
  assert.equal(await at("create-run-state").count(), 0);
  step(
    "with no approval the start is refused on the page, and the stand-in was not started",
  );

  const agent = await call("yamakan.agent.create", {
    scopes: ["project:read", "project:write"],
  });
  const asAgent = new YamakanClient({ baseUrl: ORIGIN, token: agent.token });
  for (const [operation, parameters] of [
    [
      "yamakan.gates.approve",
      {
        kind: "egress",
        route: "kaggle",
        host: "kaggle.com",
        account: USERNAME,
        purpose: "generation",
        ttlMs: 3_600_000,
        limit: { runs: 1, units: 1_000_000 },
      },
    ],
    ["yamakan.gates.list", {}],
  ]) {
    const answer = await asAgent.call(operation, parameters).then(
      () => "ok",
      (e) => e.code,
    );
    assert.equal(answer, "SCOPE_DENIED", operation);
  }
  assert.equal((await call("yamakan.gates.list", {})).approvals.length, 0);
  step("an agent's token is refused the approval and the list");

  for (const bad of ["0", "1001", "1.5", ""]) {
    await at("create-gates-runs").fill(bad);
    assert.equal(await at("create-gates-approve").isDisabled(), true, bad);
  }
  // As proposed: one run and one hour.
  await at("create-gates-runs").fill("1");
  await at("create-gates-approve").click();
  await isOpen(true);
  await at("create-gates-done").waitFor();
  const given = (await call("yamakan.gates.list", {})).approvals;
  assert.deepEqual(given.map((a) => [a.kind, a.limit.runs, a.state]).sort(), [
    ["egress", 1, "approved"],
    ["spend", 1, "approved"],
  ]);
  await startRun();
  await at("create-run-state").waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-run-state"]')?.dataset
        .state === "running",
    null,
    { timeout: 60_000 },
  );
  assert.equal(calls().filter((c) => c === "kernels push").length, 1);
  const left = (await call("yamakan.gates.list", {})).approvals;
  assert.ok(left.every((a) => a.runsLeft === 0 && a.state === "exhausted"));
  // Used up, they are still listed, to be taken back, and no other run is asked for.
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-testid="create-gates-list"] li[data-state="exhausted"]',
      ).length === 2,
  );
  assert.equal(await gates.getAttribute("data-needed"), "false");
  assert.equal(await at("create-gates-approve").count(), 0);
  step(
    "one press approves both, the start is sent once, and one run is counted",
  );

  const egress = left.find((a) => a.kind === "egress");
  await page
    .locator('[data-testid="create-gates-list"] li[data-kind="egress"]')
    .getByTestId("create-gates-revoke")
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-gates"]')?.dataset.needed ===
      "true",
  );
  assert.equal(
    (await call("yamakan.gates.list", {})).approvals.find(
      (a) => a.id === egress.id,
    ).state,
    "revoked",
  );
  const before = calls().length;
  // More than two of the page's own intervals of twenty seconds.
  await page.waitForTimeout(45_000);
  assert.equal(calls().length, before, "no line since it was taken back");
  assert.match(
    await at("create-run-note").innerText(),
    /The approval was revoked for contacting kaggle\.com as someone/,
  );
  assert.equal(
    await at("create-run-state").getAttribute("data-state"),
    "unknown",
  );
  step(
    "taken back, two intervals pass with no start of the stand-in, and the page says why",
  );

  // Following asks for contacting alone, and for no other run.
  assert.match(
    await gates.innerText(),
    /to ask how your run goes[^]*No other run\./,
  );
  assert.ok(!/allowance/.test(await at("create-gates-what").innerText()));
  assert.equal(await at("create-gates-runs").count(), 0);
  await at("create-gates-approve").click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-run-state"]')?.dataset
        .state === "running",
    null,
    { timeout: 60_000 },
  );
  assert.deepEqual(
    (await call("yamakan.gates.list", {})).approvals.map((a) => a.kind),
    ["egress", "spend", "egress"],
  );
  assert.ok(calls().length > before);
  assert.equal(calls().filter((c) => c === "kernels push").length, 1);
  step("a new approval resumes following the same run, with no second push");

  // Another network than the one it was given under (OA-20).
  await stop();
  await start({ HTTPS_PROXY: "http://user:secret-zq71@127.0.0.1:9" });
  await arrive();
  await page
    .getByRole("button", { name: /revision/i })
    .first()
    .click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await gates.waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-gates"]')?.dataset.needed ===
      "true",
  );
  const changed = await gates.innerText();
  assert.match(changed, /proxy or a certificate setting has come or gone/);
  assert.ok(!(await page.content()).includes("zq71"));
  const asOf = calls().length;
  await page.waitForTimeout(25_000);
  assert.equal(calls().length, asOf);
  step(
    "under a proxy that came since, nothing is contacted and the page asks again",
  );

  await page.evaluate(() => localStorage.setItem("yamakan.lang", "ar"));
  await page.reload();
  await page.getByRole("button", { name: /.+/ }).first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  await page
    .locator(".project-list button, aside button")
    .nth(1)
    .click()
    .catch(() => {});
  if ((await gates.count()) === 0) await page.getByRole("tab").first().click();
  await gates.waitFor();
  assert.match(await gates.innerText(), /[\u0600-\u06ff]{3}/);
  step("the page turns right to left in Arabic, whose words are unreviewed");
  assert.deepEqual(external, []);
  assert.deepEqual(pageErrors, []);
  step("no external requests and no page errors");
  passed = true;
} catch (e) {
  // This file may be committed, and an error can hold a local path naming the user.
  failure = blocked ?? diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  if (child && child.exitCode === null && child.signalCode === null) {
    const gone = new Promise((done) => child.once("exit", done));
    child.kill("SIGKILL");
    await gone;
  }
}
const outcome = passed ? "PASS" : blocked ? "BLOCKED" : "FAIL";
const section = `## The check

\`npm run qualify:gates\`: **${outcome}** at \`${head}\`${dirty ? " (with uncommitted changes)" : ", with a clean checkout"}.${failure ? ` ${failure}` : ""} Host: \`${JSON.stringify(host)}\`.

${steps.map((s) => `- ${s}.`).join("\n")}
`;
const had = existsSync(out) ? readFileSync(out, "utf8") : "";
const from = had.indexOf("## The check");
const next = from < 0 ? -1 : had.indexOf("\n## ", from + 5);
writeFileSync(
  out,
  from < 0
    ? `${had}${had ? "\n" : "# MPR-204: the gates\n\n"}${section}`
    : `${had.slice(0, from)}${section}${next < 0 ? "" : had.slice(next)}`,
);
rmSync(root, {
  recursive: true,
  force: true,
  maxRetries: 10,
  retryDelay: 200,
});
console.log(`GATES ${outcome}`);
process.exit(passed ? 0 : 1);
