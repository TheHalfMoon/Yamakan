/**
 * Agent access from the page: a person makes a scoped token that ends, sees it once, the
 * token works for an agent and nothing beyond its grant, and revoking it from the page stops
 * it. The receipt is printed, and written only where YAMAKAN_QUALIFY_RECEIPT points.
 */
import { chromium } from "playwright-core";
import { fork, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const root = mkdtempSync(join(tmpdir(), "yamakan-agent-access-"));
const port = 24371;
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

const result = {
  qualification: "AGENT_ACCESS",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  passed: false,
  steps: [],
};
const step = (name) => result.steps.push(name);

// As an agent: the token in the Authorization header, nothing from the page.
const asAgent = async (token, operation) => {
  const res = await fetch(`${url}/api/v1/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ apiVersion: 1, operation, parameters: {} }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok && !body.error, body };
};

let browser;
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

  // Agent tools sit under Finish, with or without an open project.
  await page.getByRole("tab", { name: "Finish", exact: true }).click();
  await page.locator("details.agent-tools > summary").click();
  const panel = page.getByTestId("agent-access");
  await panel.waitFor();
  await page.getByTestId("agent-access-empty").waitFor();
  step("the panel opens and says there are no tokens yet");

  // Nothing is chosen for the person: the end must be picked first.
  const create = page.getByTestId("agent-access-create");
  assert.equal(await create.isDisabled(), true);
  assert.match(
    await page.getByTestId("agent-access-why").textContent(),
    /Choose when it ends/,
  );
  step("making a token waits until its end is chosen");

  await page.getByTestId("agent-access-label").fill("qualify bot");
  await page.getByTestId("agent-access-end").selectOption("7");
  await create.click();
  const tokenBox = page.getByTestId("agent-access-token");
  await tokenBox.waitFor();
  const token = await tokenBox.inputValue();
  assert.match(token, /^[0-9a-f]{64}$/);
  const item = page.getByTestId("agent-access-item");
  await item.waitFor();
  assert.equal(await item.getAttribute("data-status"), "active");
  const itemText = await item.textContent();
  assert.match(itemText, /qualify bot/);
  assert.match(itemText, /read projects/);
  assert.match(itemText, /ends /);
  assert.ok(!itemText.includes(token), "the list never shows the token");
  step("a token is made, shown once, and listed as active with its end");

  const read = await asAgent(token, "yamakan.project.list");
  assert.equal(read.ok, true, JSON.stringify(read.body));
  const write = await asAgent(token, "yamakan.agent.list");
  assert.equal(write.ok, false, "an agent cannot list tokens");
  step("the token works for an agent, within its grant only");

  await page.getByTestId("agent-access-done").click();
  assert.equal(await tokenBox.count(), 0);
  assert.ok(
    !(await page.content()).includes(token),
    "closed, the token is gone from the page",
  );
  step("closed, the token is no longer on the page");

  await page.getByTestId("agent-access-revoke").click();
  await page.getByTestId("agent-access-revoke-now").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="agent-access-item"]')
        ?.getAttribute("data-status") === "revoked",
    null,
    { timeout: 15000 },
  );
  const after = await asAgent(token, "yamakan.project.list");
  assert.equal(after.ok, false, "a revoked token is refused");
  result.revokedStatus = after.status;
  step("revoked from the page, the token is refused");

  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  result.passed = true;
} catch (err) {
  result.detail = err instanceof Error ? err.message : String(err);
  result.serverError = serverError.slice(-2000);
  throw err;
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  const out = JSON.stringify(result, null, 2);
  console.log(out);
  if (process.env.YAMAKAN_QUALIFY_RECEIPT)
    writeFileSync(process.env.YAMAKAN_QUALIFY_RECEIPT, out + "\n");
}
console.log("AGENT ACCESS PASS");
