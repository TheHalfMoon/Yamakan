/**
 * The Cinema page's Blender control, end to end in a real browser against the real service
 * (Windows, with the pinned Blender installed by `npm run blender:install`):
 *
 *   a box saved to the project's Cinema scene → Render, with live progress → Cancel → the
 *   service's own refusal shown while another render holds the one slot → a full render →
 *   "Rendered with Blender" → Place on timeline → saved, and read back through the SDK.
 *
 * Then a second service with no Blender install shows why rendering is unavailable.
 *
 * Nothing here is mocked. The receipt is printed, and written only where
 * YAMAKAN_QUALIFY_RECEIPT points; screenshots go only where YAMAKAN_QUALIFY_SHOTS points
 * (never into the repository).
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { YamakanClient } from "../sdk/client.ts";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const clean =
  execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim() === "";
const shots = process.env.YAMAKAN_QUALIFY_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const steps = [];
const step = (name, detail) => {
  steps.push(detail ? { name, ...detail } : { name });
  console.log(`- ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const children = [];
async function start(port, env = {}) {
  const root = mkdtempSync(join(tmpdir(), "yamakan-cinema-blender-"));
  const workspace = join(root, "workspace");
  const child = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    {
      env: {
        ...process.env,
        ...env,
        YAMAKAN_WORKSPACE: workspace,
        YAMAKAN_PORT: String(port),
      },
      silent: true,
      windowsHide: true,
    },
  );
  children.push(child);
  let errors = "";
  child.stderr.on("data", (c) => (errors += String(c)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`startup: ${errors}`)),
      30000,
    );
    child.stdout.on("data", (c) => {
      if (String(c).includes("Yamakan is running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`exited ${code}: ${errors}`));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(workspace, url);
  const launch = readFileSync(join(workspace, "launch"), "utf8")
    .split("\n")[0]
    .trim();
  const token = readFileSync(join(workspace, "token"), "utf8").trim();
  return { launch, client: new YamakanClient({ baseUrl: url, token }) };
}

async function openProject(page, launch, name) {
  await page.goto(launch);
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await page.getByTestId("cinema-viewport").waitFor();
}

const attr = (page, id, name) => page.getByTestId(id).getAttribute(name);
const waitAttr = (page, id, name, value, timeout = 30000) =>
  page.waitForFunction(
    ([i, n, v]) =>
      document.querySelector(`[data-testid="${i}"]`)?.getAttribute(n) === v,
    [id, name, value],
    { timeout },
  );
const shot = async (page, name) => {
  if (shots)
    await page
      .getByTestId("cinema-blender")
      .screenshot({ path: join(shots, `${name}.png`) });
};

let browser;
const receipt = {
  qualification: "CINEMA_BLENDER_CONTROL",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  clean,
  steps,
  passed: false,
};
try {
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  const { launch, client } = await start(24391);
  const capability = await client.call("yamakan.blender.capability", {});
  assert.equal(
    capability.available,
    true,
    `Blender is not installed here: ${capability.message}`,
  );
  await openProject(page, launch, "Blender page");
  await waitAttr(page, "cinema-project-state", "data-state", "new");

  // Only a saved scene is rendered.
  await page.getByTestId("cinema-blender").waitFor();
  assert.equal(
    await page.getByTestId("cinema-blender-render").isDisabled(),
    true,
  );
  await page.getByTestId("cinema-blender-save-first").waitFor();
  step("render waits for a saved scene");

  await page.getByTestId("cinema-objects-add").click();
  await page.getByTestId("cinema-move-right").click();
  await page.getByTestId("cinema-move-right").click();
  await page.getByTestId("cinema-project-save").click();
  await waitAttr(page, "cinema-project-state", "data-state", "saved");
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-testid="cinema-blender-render"]')
        ?.disabled,
  );
  const project = (await client.call("yamakan.project.list", {}))[0];
  step("scene saved; render offered", { projectId: project.id });

  // A render, cancelled once it has made progress.
  await page.getByTestId("cinema-blender-render").click();
  await page.getByTestId("cinema-blender-cancel").waitFor();
  await page.waitForFunction(
    () => {
      const t = document.querySelector(
        '[data-testid="cinema-blender-state"]',
      )?.textContent;
      const n = Number(/(\d+)%/.exec(t ?? "")?.[1] ?? 0);
      return n > 0;
    },
    null,
    { timeout: 180000 },
  );
  const cancelledAt = await page
    .getByTestId("cinema-blender-state")
    .textContent();
  await shot(page, "1-working");
  await page.getByTestId("cinema-blender-cancel").click();
  await waitAttr(
    page,
    "cinema-blender-state",
    "data-state",
    "cancelled",
    60000,
  );
  const afterCancel = await client.call("yamakan.project.open", {
    projectId: project.id,
  });
  assert.equal(
    afterCancel.assets.length,
    0,
    "a cancelled render made no asset",
  );
  step("progress shown, then cancelled", { at: cancelledAt.trim() });

  // The service's own refusal, shown: another render holds the one slot.
  const other = await client.call("yamakan.blender.render", {
    projectId: project.id,
    settings: {
      width: 320,
      height: 180,
      fps: 24,
      frames: 24,
      samples: 8,
      orbitDegrees: 45,
    },
  });
  await page.getByTestId("cinema-blender-render").click();
  await page.getByTestId("cinema-blender-error").waitFor();
  const refusal = await page.getByTestId("cinema-blender-error").textContent();
  assert.match(refusal, /already running/);
  await shot(page, "2-refused");
  await client.call("yamakan.job.cancel", { jobId: other.id });
  for (let i = 0; i < 120; i++) {
    const s = await client.call("yamakan.job.status", { jobId: other.id });
    if (["CANCELLED", "FAILED", "COMPLETED"].includes(s.state)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  step("refusal shown", { error: refusal.trim() });

  // A full render, with its progress seen as it runs.
  await page.getByTestId("cinema-blender-render").click();
  const seen = new Set();
  const started = Date.now();
  for (;;) {
    const state = await attr(page, "cinema-blender-state", "data-state");
    if (state !== "working") break;
    const t = await page.getByTestId("cinema-blender-state").textContent();
    const n = /(\d+)%/.exec(t ?? "")?.[1];
    if (n) seen.add(Number(n));
    assert.ok(Date.now() - started < 600000, "render took over 10 minutes");
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(await attr(page, "cinema-blender-state", "data-state"), "done");
  const done = await page.getByTestId("cinema-blender-state").textContent();
  assert.match(done, /Rendered with Blender/);
  const progress = [...seen].sort((a, b) => a - b);
  assert.ok(
    progress.some((n) => n > 0 && n < 100),
    `no progress was seen: ${progress}`,
  );
  await shot(page, "3-done");
  step("rendered", {
    seconds: Math.round((Date.now() - started) / 1000),
    progress,
  });

  // Placed on the timeline, saved, and read back from the service.
  const clipsBefore = await page.locator("[data-clip-id]").count();
  await page.getByTestId("cinema-blender-place").click();
  await page.waitForFunction(() =>
    /on the timeline/.test(
      document.querySelector('[data-testid="cinema-blender-state"]')
        ?.textContent ?? "",
    ),
  );
  await shot(page, "4-placed");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  let saved;
  for (let i = 0; i < 60; i++) {
    saved = await client.call("yamakan.project.open", {
      projectId: project.id,
    });
    if (saved.clips.length) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const asset = saved.assets.find((a) => a.name === "Blender render.mp4");
  assert.ok(asset, "the render joined the project as an asset");
  assert.equal(asset.kind, "video");
  assert.deepEqual([asset.width, asset.height], [320, 180]);
  assert.ok(asset.durationFrames > 0);
  const clip = saved.clips.find((c) => c.assetId === asset.id);
  assert.ok(clip, "the render is on the saved timeline");
  assert.equal(
    clip.durationFrames,
    asset.durationFrames,
    "the whole video is placed",
  );
  step("placed on the timeline and saved", {
    clipsOnPageBefore: clipsBefore,
    asset: {
      id: asset.id,
      kind: asset.kind,
      width: asset.width,
      height: asset.height,
      durationFrames: asset.durationFrames,
    },
    clip: { id: clip.id, durationFrames: clip.durationFrames },
  });
  assert.deepEqual(pageErrors, []);

  // A service with no Blender install says why.
  const bare = mkdtempSync(join(tmpdir(), "yamakan-no-blender-"));
  const second = await start(24392, { LOCALAPPDATA: bare });
  const page2 = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  await openProject(page2, second.launch, "No Blender");
  await page2.getByTestId("cinema-project-state").waitFor();
  await page2.getByTestId("cinema-blender-unavailable").waitFor();
  const why = await page2
    .getByTestId("cinema-blender-unavailable")
    .textContent();
  assert.match(why, /not available/);
  assert.equal(await page2.getByTestId("cinema-blender-render").count(), 0);
  await shot(page2, "5-unavailable");
  step("unavailable reason shown", { text: why.trim() });

  receipt.passed = true;
} catch (e) {
  receipt.error = e instanceof Error ? e.message : String(e);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  for (const c of children) c.kill();
}
const text = JSON.stringify(receipt, null, 2) + "\n";
if (process.env.YAMAKAN_QUALIFY_RECEIPT)
  writeFileSync(process.env.YAMAKAN_QUALIFY_RECEIPT, text);
console.log(text);
console.log(receipt.passed ? "CINEMA BLENDER CONTROL PASS" : "FAILED");
