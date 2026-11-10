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

  // #203: the project's Cinema scene opens first. A new project has none yet.
  const projectState = () =>
    page.getByTestId("cinema-project-state").getAttribute("data-state");
  const waitState = (state) =>
    page.waitForFunction(
      (s) =>
        document
          .querySelector('[data-testid="cinema-project-state"]')
          ?.getAttribute("data-state") === s,
      state,
      { timeout: 30000 },
    );
  await waitState("new");
  assert.equal(
    await page.getByTestId("cinema-project-save").isDisabled(),
    false,
  );
  assert.equal(
    await page.getByTestId("cinema-project-reopen").isDisabled(),
    true,
  );

  // #203: the lens inspector must control the real Cinema camera, not just
  // change text or pretend to condition a generative model.
  await page.getByTestId("cinema-lens-85").click();
  assert.equal(
    await page.getByTestId("cinema-lens-85").getAttribute("aria-pressed"),
    "true",
  );
  const longLensFov = await page.getByTestId("cinema-lens-fov").textContent();
  assert.equal(
    await page.evaluate(
      () => window.__yamakanCinema.getScene().camera.focalLengthMm,
    ),
    85,
  );
  await page.getByTestId("cinema-lens-24").click();
  const wideLensFov = await page.getByTestId("cinema-lens-fov").textContent();
  assert.equal(
    await page.evaluate(
      () => window.__yamakanCinema.getScene().camera.focalLengthMm,
    ),
    24,
  );
  assert.notEqual(wideLensFov, longLensFov);
  assert.match(
    await page.getByTestId("cinema-lens-panel").textContent(),
    /until you choose Save scene to project/i,
  );

  // #203: saved to the project only when the person chooses, then opened from it.
  assert.equal(await projectState(), "changed");
  await page.getByTestId("cinema-project-save").click();
  await waitState("saved");
  const savedSceneId = await page.evaluate(
    () => window.__yamakanCinema.getScene().id,
  );
  await page.getByTestId("cinema-lens-85").click();
  assert.equal(await projectState(), "changed");
  await page.getByTestId("cinema-project-reopen").click();
  await waitState("saved");
  assert.equal(
    await page.evaluate(
      () => window.__yamakanCinema.getScene().camera.focalLengthMm,
    ),
    24,
    "Reopen shows the saved lens, not the unsaved one",
  );
  assert.equal(
    await page.getByTestId("cinema-lens-24").getAttribute("aria-pressed"),
    "true",
  );

  // #203: objects are moved and added from the page, and saved with the scene.
  const sceneItems = () =>
    page.evaluate(() =>
      window.__yamakanCinema.getScene().items.map((i) => ({
        name: i.name,
        x: i.position.x,
        z: i.position.z,
        assetId: i.assetId,
      })),
    );
  const firstX = (await sceneItems())[0].x;
  await page.getByTestId("cinema-move-right").click();
  await page.getByTestId("cinema-move-right").click();
  await page.getByTestId("cinema-move-forward").click();
  assert.equal(await projectState(), "changed");
  const moved = (await sceneItems())[0];
  assert.equal(moved.x, firstX + 0.5);
  assert.equal(moved.z, -2.25);
  assert.match(
    await page.getByTestId("cinema-objects-readout").textContent(),
    /Position 0\.5, 0\.5, -2\.25 m/,
  );
  await page.getByTestId("cinema-objects-add").click();
  const withBox = await sceneItems();
  assert.equal(withBox.length, 2);
  assert.deepEqual(
    { name: withBox[1].name, assetId: withBox[1].assetId },
    { name: "Box 2", assetId: null },
  );
  assert.equal(
    await page.getByTestId("cinema-objects-select").inputValue(),
    await page.evaluate(() => window.__yamakanCinema.getScene().items[1].id),
    "the new box is the one selected",
  );
  await page.getByTestId("cinema-project-save").click();
  await waitState("saved");

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
  // The project's saved scene opens again with the project after a reload.
  await page
    .getByRole("button", { name: /Cinema act/ })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Cinema act", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await waitState("saved");
  const reloaded = await page.evaluate(() => {
    const scene = window.__yamakanCinema.getScene();
    return {
      id: scene.id,
      lensMm: scene.camera.focalLengthMm,
      items: scene.items.length,
      firstX: scene.items[0].position.x,
    };
  });
  assert.deepEqual(reloaded, {
    id: savedSceneId,
    lensMm: 24,
    items: 2,
    firstX: firstX + 0.5,
  });

  // The editor's Undo takes the last save back: the view shows the scene saved before it
  // (the lens only), not the objects it no longer holds.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(
    () => window.__yamakanCinema.getScene().items.length === 1,
    null,
    { timeout: 30000 },
  );
  await waitState("saved");
  const undone = await page.evaluate(() => {
    const scene = window.__yamakanCinema.getScene();
    return {
      lensMm: scene.camera.focalLengthMm,
      items: scene.items.length,
      firstX: scene.items[0].position.x,
    };
  });
  assert.deepEqual(undone, { lensMm: 24, items: 1, firstX });
  const listed = await callApi("yamakan.scene.list", {});
  assert.ok(
    listed.result.scenes.some((s) => s.id === scene.id),
    "scene survives reload via workspace cinema store",
  );

  // #203: the preview fits the width it has and its field of view follows its shape, at a
  // desktop and a phone width. Screenshots go only where YAMAKAN_QUALIFY_SHOTS points
  // (outside the repository), never into the evidence.
  const shots = process.env.YAMAKAN_QUALIFY_SHOTS;
  const layout = async (width, height) => {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('[data-testid="cinema-canvas"]');
        const host = document.querySelector('[data-testid="cinema-surface"]');
        if (!canvas || !host) return false;
        // The size the renderer set, not the CSS clamp, must match the room it has.
        const w = Math.floor(host.getBoundingClientRect().width);
        return (
          parseFloat(canvas.style.width) === w &&
          parseFloat(canvas.style.height) ===
            Math.min(360, Math.max(180, Math.round((w * 9) / 16)))
        );
      },
      null,
      { timeout: 15000 },
    );
    const measured = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="cinema-canvas"]');
      const camera = window.__yamakanCinema.getScene().camera;
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const expectedFov = Math.round(
        (2 *
          Math.atan(
            camera.sensorWidthMm / aspect / (2 * camera.focalLengthMm),
          ) *
          180) /
          Math.PI,
      );
      const shown = Number(
        /(\d+)°/.exec(
          document.querySelector('[data-testid="cinema-lens-fov"]').textContent,
        )?.[1],
      );
      const overflowing = [
        ...document.querySelectorAll(
          '[data-testid="cinema-viewport"] button, [data-testid="cinema-viewport"] select',
        ),
      ].filter((el) => {
        const box = el.getBoundingClientRect();
        // Either edge: a right-to-left page overflows on the left.
        return box.right > innerWidth + 0.5 || box.left < -0.5;
      }).length;
      return {
        canvas: { width: canvas.clientWidth, height: canvas.clientHeight },
        scrollWidth: document.documentElement.scrollWidth,
        expectedFov,
        shown,
        overflowing,
      };
    });
    assert.ok(
      measured.scrollWidth <= width,
      `no sideways scroll at ${width}px: ${measured.scrollWidth}`,
    );
    assert.ok(measured.canvas.width <= width, JSON.stringify(measured));
    assert.equal(measured.overflowing, 0, `controls fit at ${width}px`);
    assert.equal(
      measured.shown,
      measured.expectedFov,
      JSON.stringify(measured),
    );
    if (shots) {
      mkdirSync(shots, { recursive: true });
      await page
        .getByTestId("cinema-viewport")
        .screenshot({ path: join(shots, `cinema-${width}.png`) });
    }
    return measured;
  };
  // Narrowed and widened again: widening is what a CSS clamp alone cannot hide.
  const desktop = await layout(1440, 1050);
  const phone = await layout(390, 844);
  const widened = await layout(1440, 1050);
  assert.notEqual(
    desktop.canvas.width,
    phone.canvas.width,
    "the preview resized",
  );
  assert.deepEqual(widened.canvas, desktop.canvas, "and back when widened");

  assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
  result.passed = true;
  result.layout = { desktop, phone };
  result.before = before;
  result.afterPose = after;
  result.contentHash = contentHash;
  result.projectScene = {
    ...reloaded,
    reopened: true,
    reloaded: true,
    afterUndo: undone,
  };
  result.pageErrors = pageErrors;
  result.detail =
    "Cinema mounted; lens, object moves and an added box saved to the project from the page, reopened, reloaded and undone; orbit interaction; scene.save/open/list across reload; AI camera disabled.";
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
