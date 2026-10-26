/**
 * P10-03 — Cinema supported-scope activation E2E.
 * Preview + orbit interaction + scene.save/open persist. AI camera must stay off.
 */
import { chromium } from "playwright-core";
import { fork, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { CINEMA_ENABLED } from "../core/scene3d-flags.ts";

assert.equal(CINEMA_ENABLED, true);

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const receiptPath = join(outDir, "cinema-activation.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

const root = mkdtempSync(join(tmpdir(), "yamakan-cinema-act-"));
const port = 24369;
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
  qualification: "CINEMA_ACTIVATION",
  task: "P10-03",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  cinemaEnabled: true,
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
  await page.getByLabel("Project name", { exact: true }).fill("Cinema act");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Cinema act", exact: true })
    .waitFor();

  await page.getByRole("tab", { name: "Story", exact: true }).click();
  const cinema = page.getByTestId("cinema-viewport");
  await cinema.waitFor();
  assert.equal(await cinema.getAttribute("data-cinema-enabled"), "true");
  assert.equal(await cinema.getAttribute("data-ai-camera"), "disabled");

  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="cinema-viewport"]')
        ?.getAttribute("data-cinema-status") === "mounted" &&
      window.__yamakanCinema,
    null,
    { timeout: 60000 },
  );

  const before = await page.evaluate(() => {
    const h = window.__yamakanCinema;
    return {
      items: h.getItemCount(),
      pose: h.getCameraPose(),
      ai: h.aiCameraAvailable(),
      sceneId: h.getScene().id,
    };
  });
  assert.equal(before.ai, false);
  assert.ok(before.items >= 1);

  await page.evaluate(() => window.__yamakanCinema.orbitBy(25, 10));
  const after = await page.evaluate(() =>
    window.__yamakanCinema.getCameraPose(),
  );
  assert.ok(
    after.x !== before.pose.x ||
      after.y !== before.pose.y ||
      after.z !== before.pose.z,
    "orbit should move camera",
  );

  // Persist via command API (session header from launch exchange — never cookies).
  const scene = await page.evaluate(() => window.__yamakanCinema.getScene());
  const callApi = async (operation, parameters) =>
    page.evaluate(
      async ({ operation: op, parameters: params }) => {
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
            operation: op,
            parameters: params,
          }),
        });
        return res.json();
      },
      { operation, parameters },
    );

  const save = await callApi("yamakan.scene.save", { scene });
  assert.ok(!save.error, JSON.stringify(save));
  const contentHash = save.result.contentHash;
  assert.match(contentHash, /^[a-f0-9]{64}$/);

  const opened = await callApi("yamakan.scene.open", { sceneId: scene.id });
  assert.ok(!opened.error, JSON.stringify(opened));
  assert.equal(opened.result.contentHash, contentHash);

  // Reload and remount — reopen evidence via list + open.
  await page.reload();
  await page.waitForFunction(() => location.hash === "");
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="cinema-viewport"]')
        ?.getAttribute("data-cinema-status") === "mounted",
    null,
    { timeout: 60000 },
  );
  const listed = await callApi("yamakan.scene.list", {});
  assert.ok(
    listed.result.scenes.some((s) => s.id === scene.id),
    "scene survives reload via workspace cinema store",
  );

  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  result.passed = true;
  result.before = before;
  result.afterPose = after;
  result.contentHash = contentHash;
  result.pageErrors = pageErrors;
  result.detail =
    "Cinema mounted; orbit interaction; scene.save/open/list across reload; AI camera disabled.";
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
console.log(`CINEMA ACTIVATION PASS — ${receiptPath}`);
