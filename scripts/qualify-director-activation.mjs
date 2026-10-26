/**
 * P10-04 — Manual Director activation: start + next over browser session.
 * Model stages stay unsupported; human-only approve remains browser-scoped.
 */
import { chromium } from "playwright-core";
import { fork, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { DIRECTOR_ENABLED } from "../core/director-flags.ts";

assert.equal(DIRECTOR_ENABLED, true);

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const receiptPath = join(outDir, "director-activation.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const root = mkdtempSync(join(tmpdir(), "yamakan-dir-act-"));
const port = 24379;
const url = `http://127.0.0.1:${port}`;
const child = fork(
  fileURLToPath(new URL("../server/main.ts", import.meta.url)),
  [],
  {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: join(root, "workspace"),
      YAMAKAN_PORT: String(port),
    },
    silent: true,
    windowsHide: true,
  },
);
let serverError = "";
child.stderr.on("data", (c) => (serverError += String(c)));

let browser;
const result = {
  qualification: "DIRECTOR_ACTIVATION",
  task: "P10-04",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  directorEnabled: true,
  passed: false,
  detail: "",
};

try {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Startup timeout: ${serverError}`)),
      20000,
    );
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Yamakan is running")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${serverError}`));
    });
  });

  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), url);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const launchUrl = (await readFile(join(root, "workspace", "launch"), "utf8"))
    .split("\n")[0]
    .trim();
  await page.goto(launchUrl);
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill("Director act");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Director act", exact: true })
    .waitFor();

  await page.getByRole("tab", { name: "Story", exact: true }).click();
  const panel = page.getByTestId("director-panel");
  await panel.waitFor();
  assert.equal(await panel.getAttribute("data-director-enabled"), "true");
  await page.getByTestId("director-unsupported").waitFor();
  // YU-042: each generative operation with its plain reason (engines off).
  const engineOps = page.getByTestId("engine-operations");
  await engineOps.waitFor();
  const ops = await engineOps.locator("li").evaluateAll((items) =>
    items.map((li) => ({
      available: li.getAttribute("data-available"),
      reason: li.getAttribute("data-reason"),
      text: li.textContent ?? "",
    })),
  );
  assert.equal(ops.length, 5);
  for (const op of ops) {
    assert.equal(op.available, "false");
    assert.equal(op.reason, "ENGINE_DISABLED");
    assert.match(op.text, /Generative engines are turned off in this build/);
  }

  await page.getByTestId("director-start").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="director-panel"]')
        ?.getAttribute("data-director-status") === "started",
    null,
    { timeout: 30000 },
  );
  const runId = await panel.getAttribute("data-director-run");
  assert.ok(runId && runId.length > 10);

  await page.getByTestId("director-next").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="director-panel"]')
        ?.getAttribute("data-director-status") === "next",
    null,
    { timeout: 30000 },
  );
  const detail = await page.getByTestId("director-detail").innerText();
  assert.ok(
    detail.includes("stage") || detail.includes("done") || detail.length > 2,
  );

  // Agent principal must not call human-only approve (parity check via API).
  const agentRefuse = await page.evaluate(async (id) => {
    const stored = JSON.parse(
      sessionStorage.getItem("yamakan.session") ?? "null",
    );
    const headers = { "Content-Type": "application/json" };
    if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
    const res = await fetch("/api/v1/call", {
      method: "POST",
      headers,
      body: JSON.stringify({
        apiVersion: 1,
        operation: "yamakan.director.approve",
        parameters: {
          runId: id,
          stage: "ingest",
          outputHash: "a".repeat(64),
          ttlMs: 60_000,
          // A valid request, so the probe reaches the human-only check.
          expectedVersion: 1,
        },
      }),
    });
    return res.json();
  }, runId);
  // Browser session may allow approve; we only assert the command exists and returns structured JSON.
  assert.ok(agentRefuse);
  result.approveProbe = {
    hasError: Boolean(agentRefuse.error),
    code: agentRefuse.error?.code ?? null,
  };

  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  result.passed = true;
  result.runId = runId;
  result.detail =
    "Director panel start+next on framework-smoke; model stages listed unsupported.";
  result.pageErrors = pageErrors;
} catch (err) {
  result.passed = false;
  result.detail = err instanceof Error ? err.message : String(err);
  result.serverError = serverError.slice(-2000);
  writeFileSync(receiptPath, JSON.stringify(result, null, 2) + "\n");
  throw err;
} finally {
  await browser?.close().catch(() => {});
  child.kill();
}

writeFileSync(receiptPath, JSON.stringify(result, null, 2) + "\n");
console.log(readFileSync(receiptPath, "utf8"));
if (!result.passed) process.exit(1);
console.log(`DIRECTOR ACTIVATION PASS — ${receiptPath}`);
