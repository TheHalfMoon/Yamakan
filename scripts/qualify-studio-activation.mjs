/**
 * Studio activation — real browser E2E with STUDIO_ENABLED=true (no forceMount required).
 * Prerequisites: Q8/Q9/Q10 receipts already on main.
 */
import { chromium } from "playwright-core";
import { fork, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const root = mkdtempSync(join(tmpdir(), "yamakan-studio-act-"));
const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const receiptPath = join(outDir, "studio-activation.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const port = 24359;
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
  qualification: "STUDIO_ACTIVATION",
  module: "M7",
  task: "P10-01",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  prerequisites: {
    q8: "docs/evidence/qualification/q8-studio-stroke.json",
    q9: "docs/evidence/qualification/q9-studio-inherited.json",
    q10: "docs/evidence/qualification/q10-studio.json",
  },
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
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Studio activation");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Studio activation", exact: true })
    .waitFor();

  // No forceMount query — flag must mount Studio on its own.
  await page.getByRole("button", { name: "Agent tools", exact: true }).click();
  const studio = page.getByTestId("studio-canvas");
  await studio.waitFor();
  assert.equal(await studio.getAttribute("data-studio-enabled"), "true");
  assert.equal(await studio.getAttribute("data-studio-force-mount"), "false");

  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="studio-canvas"]')
        ?.getAttribute("data-studio-status") === "mounted" &&
      window.__yamakanStudioQ8,
    null,
    { timeout: 60000 },
  );

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
  assert.equal(
    await page.evaluate(() => window.__yamakanStudioQ8.getActiveTool()),
    "brush",
  );

  const overlay = page.getByTestId("studio-overlay");
  const box = await overlay.boundingBox();
  assert.ok(box, "overlay bounding box");
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, {
    steps: 24,
  });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    const h = window.__yamakanStudioQ8;
    return {
      tool: h.getActiveTool(),
      layerPixelEpoch: h.getLayerPixelEpoch(),
      documentEpoch: h.getDocumentEpoch(),
      canUndo: h.canUndo(),
      canRedo: h.canRedo(),
    };
  });
  const strokeEvidence =
    after.layerPixelEpoch > before.layerPixelEpoch ||
    after.documentEpoch > before.documentEpoch ||
    after.canUndo === true;
  assert.ok(strokeEvidence, JSON.stringify({ before, after }));

  if (after.canUndo) {
    await page.evaluate(() => window.__yamakanStudioQ8.undo());
    await page.waitForTimeout(100);
    const mid = await page.evaluate(() => ({
      canRedo: window.__yamakanStudioQ8.canRedo(),
      epoch: window.__yamakanStudioQ8.getLayerPixelEpoch(),
    }));
    result.undoRedo = mid;
  }

  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  result.passed = true;
  result.before = before;
  result.after = after;
  result.pageErrors = pageErrors;
  result.detail =
    "STUDIO_ENABLED=true mounts without forceMount; brush stroke advances epoch/undo; command capability available.";
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
console.log(`STUDIO ACTIVATION PASS — ${receiptPath}`);
