/**
 * Toolbar Undo and unsaved document work, in a real browser against the real
 * service. An undo in the service restores whole snapshots, documents included,
 * so it must wait for unsaved caption or canvas edits rather than strand them,
 * and a clean canvas must follow an undo.
 *
 * Usage: node scripts/qualify-undo-unsaved.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-undo-unsaved-"));
const port = 24396;
const origin = `http://127.0.0.1:${port}`;
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
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nFirst\n";
let browser;
let passed = false;
try {
  await new Promise((ready, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Startup timeout: ${serverError}`)),
      30_000,
    );
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Yamakan is running")) {
        clearTimeout(timer);
        ready();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${serverError}`));
    });
  });
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), origin);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1400 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill("Drafts");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name: "Drafts", exact: true }).waitFor();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const refusal = /unsaved caption or canvas edits/;
  const revisionShown = async () =>
    Number(
      /Revision (\d+)/.exec(
        await page
          .locator("small", { hasText: "Revision" })
          .first()
          .innerText(),
      )[1],
    );
  const status = page.locator('[role="status"].status');

  // A caption draft.
  await page.getByRole("tab", { name: "Finish", exact: true }).click();
  await page.getByTestId("captions-panel").waitFor();
  await page.getByTestId("captions-file").setInputFiles({
    name: "cues.srt",
    mimeType: "application/x-subrip",
    buffer: Buffer.from(SRT),
  });
  await page.getByTestId("captions-editor").waitFor({ timeout: 15_000 });
  const text = page.getByTestId("captions-text").first();
  await text.fill("Unsaved words");
  const before = await revisionShown();
  await undo.click();
  await page.waitForTimeout(500);
  assert.match(await status.innerText(), refusal);
  assert.equal(await text.inputValue(), "Unsaved words");
  assert.equal(await revisionShown(), before);
  step("Undo waits for a caption draft, and keeps it");

  // Restore waits too.
  await page
    .getByRole("button", { name: /History/ })
    .first()
    .click();
  const restore = page
    .getByRole("button", { name: /^Restore revision/ })
    .first();
  await restore.waitFor({ timeout: 15_000 });
  await restore.click();
  await page.waitForTimeout(500);
  assert.match(await status.innerText(), refusal);
  assert.equal(await revisionShown(), before);
  step("Restore waits for a caption draft too");

  await page
    .getByRole("button", { name: "Discard edits", exact: true })
    .click();
  await undo.click();
  await page.getByTestId("captions-editor").waitFor({ state: "detached" });
  assert.equal(await page.getByTestId("captions-error").count(), 0);
  step(
    "With the draft discarded, Undo takes back the import, with no false message",
  );

  // A Studio canvas.
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Open Studio", exact: true }).click();
  const studio = page.getByTestId("studio-canvas");
  await studio.waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="studio-canvas"]')
        ?.getAttribute("data-studio-status") === "mounted",
    null,
    { timeout: 60_000 },
  );
  await studio.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.__yamakanStudioQ8.setBrushTool());
  const saved = () =>
    page.getByTestId("studio-save-state").getAttribute("data-content-hash");
  const state = () =>
    page.getByTestId("studio-save-state").getAttribute("data-state");
  const surface = page.getByTestId("studio-surface");
  const stroke = async (offset) => {
    await surface.scrollIntoViewIfNeeded();
    const box = await surface.boundingBox();
    const y = box.y + box.height / 2 + offset;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y, { steps: 16 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  const saveCanvas = async () => {
    const was = await saved();
    await page.getByTestId("studio-save").click();
    for (let i = 0; i < 100; i++) {
      if ((await state()) === "saved" && (await saved()) !== was)
        return saved();
      assert.notEqual(await state(), "error");
      await page.waitForTimeout(100);
    }
    throw new Error(`The canvas did not save: ${await state()}`);
  };
  await stroke(-40);
  const first = await saveCanvas();
  // Undo of the first save, then redo: one document, shown again.
  await undo.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="studio-save-state"]')
        ?.getAttribute("data-state") === "new",
    null,
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForFunction(
    (hash) =>
      document
        .querySelector('[data-testid="studio-save-state"]')
        ?.getAttribute("data-content-hash") === hash,
    first,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.__yamakanStudioQ8.setBrushTool());
  step("Undo and redo of the first canvas save keep one document");
  await stroke(0);
  const second = await saveCanvas();
  assert.notEqual(first, second);
  step("Two canvas versions are saved");

  // Unsaved strokes: Undo waits, nothing is lost, and the save still works.
  await stroke(40);
  const revision = await revisionShown();
  await undo.click();
  await page.waitForTimeout(600);
  assert.match(await status.innerText(), refusal);
  assert.equal(await revisionShown(), revision);
  assert.equal(await saved(), second);
  const third = await saveCanvas();
  assert.notEqual(third, second);
  step("Undo waits for unsaved strokes, and they save with no conflict");

  // A clean canvas follows an undo, so the next stroke saves over what it shows.
  await undo.click();
  await page.waitForFunction(
    (hash) =>
      document
        .querySelector('[data-testid="studio-save-state"]')
        ?.getAttribute("data-content-hash") === hash,
    second,
    { timeout: 30_000 },
  );
  step("A clean canvas re-reads after Undo, and shows the restored version");

  await page.evaluate(() => window.__yamakanStudioQ8.setBrushTool());
  await stroke(60);
  const fourth = await saveCanvas();
  assert.notEqual(fourth, second);
  assert.equal(await state(), "saved");
  step("The next stroke saves with no conflict");

  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "undo-unsaved",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          passed,
          steps,
          serverError: serverError.slice(-1000),
        },
        null,
        2,
      )}\n`,
    );
  await new Promise((r) => setTimeout(r, 500));
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
console.log(passed ? "UNDO UNSAVED PASS" : "UNDO UNSAVED FAIL");
process.exit(passed ? 0 : 1);
