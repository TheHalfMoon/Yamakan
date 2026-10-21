/**
 * Q10 — Studio application chunk gzip + brush stroke p95 on 4096² × 20 layers.
 * STUDIO_ENABLED stays false; uses ?studioQ8=1 forceMount for measurement.
 * Measures the real Studio application chunks (not isolated InvokeAI-only).
 */
import { chromium } from "playwright-core";
import { fork, execFileSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const receiptPath = join(outDir, "q10-studio.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

/** Sum gzip sizes of Studio application chunks under dist/assets. */
function measureStudioChunks() {
  const assets = join(resolve("dist/assets"));
  const names = readdirSync(assets).filter((n) => n.endsWith(".js"));
  // Application Studio surface: engine + host ports + migration + fonts + staging + document store.
  // Excludes main app shell (index-*) and demux worker — those are not the Studio application chunk.
  const studioHints =
    /^(engine-|port-|rasterComposite-|canvasMigration-|documentStore-|fonts-|canvasStaging|q10Fixture-)/;
  const chunks = [];
  let studioBytes = 0;
  let allGzip = 0;
  for (const name of names) {
    const raw = readFileSync(join(assets, name));
    const gz = gzipSync(raw).byteLength;
    allGzip += gz;
    const studioRelated = studioHints.test(name);
    if (studioRelated) studioBytes += gz;
    chunks.push({
      name,
      rawBytes: raw.byteLength,
      gzipBytes: gz,
      studioRelated,
    });
  }
  return {
    studioGzipBytes: studioBytes,
    studioGzipMiB: studioBytes / (1024 * 1024),
    allJsGzipBytes: allGzip,
    allJsGzipMiB: allGzip / (1024 * 1024),
    chunks: chunks.filter((c) => c.studioRelated),
    allChunks: chunks.map(({ name, gzipBytes, studioRelated }) => ({
      name,
      gzipBytes,
      studioRelated,
    })),
  };
}

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});
const chunk = measureStudioChunks();
const chunkPass = chunk.studioGzipMiB <= 2.5;

const root = mkdtempSync(join(tmpdir(), "yamakan-q10-"));
const port = 24349;
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
  qualification: "Q10",
  module: "M7",
  task: "P10-01",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    browserChannel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
  },
  budget: { chunkMiBGzip: 2.5, strokeP95Ms: 16 },
  chunk,
  chunkPass,
  latency: null,
  latencyPass: false,
  workflows: null,
  memory: null,
  passed: false,
  detail: "",
};

let browser;
try {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Startup timeout: ${serverError}`)),
      20000,
    );
    child.stdout.on("data", (chunkText) => {
      if (String(chunkText).includes("Yamakan is running")) {
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
  await page.getByLabel("Project name", { exact: true }).fill("Q10 Studio");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Q10 Studio", exact: true })
    .waitFor();
  await page.goto(`${url}/?studioQ8=1`);
  await page.getByRole("button", { name: "Agent tools", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="studio-canvas"]')
        ?.getAttribute("data-studio-status") === "mounted" &&
      window.__yamakanStudioQ8,
    null,
    { timeout: 60000 },
  );

  const samples = await page.evaluate(async () => {
    const h = window.__yamakanStudioQ8;
    const fixture = h.loadQ10Fixture();
    // Allow mirror/subscribe to propagate the replaced canvas.
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const geometry = h.getCanvasGeometry();
    h.setBrushTool();
    const overlay = document.querySelector('[data-testid="studio-overlay"]');
    const box = overlay.getBoundingClientRect();
    const times = [];
    const strokes = 40;
    const memBefore = performance.memory?.usedJSHeapSize ?? null;
    for (let i = 0; i < strokes; i++) {
      const before = h.getLayerPixelEpoch();
      const t0 = performance.now();
      const x0 = box.left + box.width * (0.2 + (i % 5) * 0.1);
      const y0 = box.top + box.height * (0.2 + Math.floor(i / 5) * 0.08);
      const x1 = x0 + box.width * 0.15;
      const y1 = y0 + box.height * 0.05;
      overlay.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: x0,
          clientY: y0,
          pointerId: 1,
          buttons: 1,
          pointerType: "mouse",
        }),
      );
      overlay.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: x1,
          clientY: y1,
          pointerId: 1,
          buttons: 1,
          pointerType: "mouse",
        }),
      );
      overlay.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: x1,
          clientY: y1,
          pointerId: 1,
          buttons: 0,
          pointerType: "mouse",
        }),
      );
      const deadline = performance.now() + 500;
      while (h.getLayerPixelEpoch() <= before && performance.now() < deadline) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      times.push(performance.now() - t0);
    }
    const memAfter = performance.memory?.usedJSHeapSize ?? null;
    const epochAfterStrokes = h.getLayerPixelEpoch();
    const canUndoAfter = h.canUndo();
    h.undo();
    await new Promise((r) => requestAnimationFrame(r));
    const canRedoAfterUndo = h.canRedo();
    h.redo();
    await new Promise((r) => requestAnimationFrame(r));
    return {
      fixture,
      geometry,
      times,
      finalEpoch: h.getLayerPixelEpoch(),
      epochAfterStrokes,
      canUndoAfter,
      canRedoAfterUndo,
      memBefore,
      memAfter,
      activeTool: h.getActiveTool(),
    };
  });

  assert.equal(samples.geometry.width, 4096, "fixture width");
  assert.equal(samples.geometry.height, 4096, "fixture height");
  assert.equal(samples.geometry.layerCount, 20, "fixture layer count");

  const sorted = [...samples.times].sort((a, b) => a - b);
  const p95 =
    sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
  const latencyPass = p95 <= 16 && samples.epochAfterStrokes > 0;
  result.latency = {
    fixture:
      "4096x4096 document with 20 raster paint layers via loadQ10Fixture",
    samples: samples.times.length,
    p50Ms: sorted[Math.floor(sorted.length / 2)],
    p95Ms: p95,
    meanMs: samples.times.reduce((a, b) => a + b, 0) / samples.times.length,
    finalEpoch: samples.finalEpoch,
    epochAfterStrokes: samples.epochAfterStrokes,
    targetP95Ms: 16,
    timesMs: samples.times,
  };
  result.latencyPass = latencyPass;
  result.workflows = {
    canvasInteraction: samples.epochAfterStrokes > 0,
    undoAvailableAfterStroke: samples.canUndoAfter === true,
    redoAvailableAfterUndo: samples.canRedoAfterUndo === true,
    activeTool: samples.activeTool,
    note: "Save/reopen + asset persistence + export covered by host assetStore + Q8 path; Q10 focuses latency/chunk on 4096×20.",
  };
  result.memory = {
    usedJSHeapBefore: samples.memBefore,
    usedJSHeapAfter: samples.memAfter,
    deltaBytes:
      samples.memBefore != null && samples.memAfter != null
        ? samples.memAfter - samples.memBefore
        : null,
    note:
      samples.memBefore == null
        ? "performance.memory unavailable in this browser channel"
        : "Chromium performance.memory heap samples around stroke loop",
  };
  result.pageErrors = pageErrors;
  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  result.passed = chunkPass && latencyPass;
  result.detail = result.passed
    ? "Studio application chunk gzip and 4096×20 stroke p95 within budget."
    : `chunkPass=${chunkPass} (${chunk.studioGzipMiB.toFixed(3)} MiB); latencyPass=${latencyPass} (p95=${p95?.toFixed(2)} ms). Flag stays off if either fails.`;
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
console.log(`Q10 PASS — ${receiptPath}`);
