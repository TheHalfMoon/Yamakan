/**
 * Q8 — real browser brush stroke against the Studio React host.
 * Mount uses ?studioQ8=1 (forceMount); STUDIO_ENABLED stays false until Q8–Q10 pass.
 */
import { chromium } from "playwright-core";
import { fork } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = mkdtempSync(join(tmpdir(), "yamakan-q8-"));
const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const receiptPath = join(outDir, "q8-studio-stroke.json");

const port = 24329;
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

const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

let browser;
const result = {
  qualification: "Q8",
  module: "M7",
  task: "P10-01",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  passed: false,
  detail: "",
};

try {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Startup timeout: ${serverError}`)),
      15000,
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

  await page
    .getByLabel("Project name", { exact: true })
    .fill("Q8 Studio stroke");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Q8 Studio stroke", exact: true })
    .waitFor();

  // Re-enter with forceMount measurement query (session survives in sessionStorage).
  await page.goto(`${url}/?studioQ8=1`);
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Open Studio", exact: true }).click();

  const studio = page.getByTestId("studio-canvas");
  await studio.waitFor();
  assert.equal(await studio.getAttribute("data-studio-enabled"), "false");
  assert.equal(await studio.getAttribute("data-studio-force-mount"), "true");
  try {
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="studio-canvas"]')
          ?.getAttribute("data-studio-status") === "mounted" &&
        window.__yamakanStudioQ8,
      null,
      { timeout: 60000 },
    );
  } catch (mountErr) {
    const diag = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="studio-canvas"]');
      return {
        status: el?.getAttribute("data-studio-status") ?? null,
        force: el?.getAttribute("data-studio-force-mount") ?? null,
        error:
          document.querySelector('[data-testid="studio-error"]')?.textContent ??
          null,
        hasHandle: Boolean(window.__yamakanStudioQ8),
      };
    });
    result.mountDiagnostics = diag;
    result.pageErrors = pageErrors;
    throw new Error(
      `Studio mount failed: ${mountErr instanceof Error ? mountErr.message : String(mountErr)}; diag=${JSON.stringify(diag)}; pageErrors=${JSON.stringify(pageErrors)}`,
    );
  }

  const before = await page.evaluate(() => {
    const h = window.__yamakanStudioQ8;
    return {
      tool: h.getActiveTool(),
      layerPixelEpoch: h.getLayerPixelEpoch(),
      documentEpoch: h.getDocumentEpoch(),
      canUndo: h.canUndo(),
    };
  });

  await page.evaluate(() => window.__yamakanStudioQ8.setBrushTool());
  const tool = await page.evaluate(() =>
    window.__yamakanStudioQ8.getActiveTool(),
  );
  assert.equal(tool, "brush");

  const overlay = page.getByTestId("studio-overlay");
  const box = await overlay.boundingBox();
  assert.ok(box, "overlay bounding box");
  const x0 = box.x + box.width * 0.3;
  const y0 = box.y + box.height * 0.3;
  const x1 = box.x + box.width * 0.7;
  const y1 = box.y + box.height * 0.7;

  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    const h = window.__yamakanStudioQ8;
    return {
      tool: h.getActiveTool(),
      layerPixelEpoch: h.getLayerPixelEpoch(),
      documentEpoch: h.getDocumentEpoch(),
      canUndo: h.canUndo(),
      midPixel: h.sampleScreenPixel(512, 512),
    };
  });

  const strokeEvidence =
    after.layerPixelEpoch > before.layerPixelEpoch ||
    after.documentEpoch > before.documentEpoch ||
    after.canUndo === true;

  assert.ok(
    strokeEvidence,
    `stroke left no state change: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
  );
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));

  result.passed = true;
  result.detail =
    "React host mounted with forceMount; brush tool selected; pointer stroke changed document/layer epoch or undo stack; STUDIO_ENABLED remains false.";
  result.before = before;
  result.after = after;
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
console.log(`Q8 PASS — receipt ${receiptPath}`);
console.log(readFileSync(receiptPath, "utf8"));
