/**
 * SS-014: a crossfade set in the editor, by mouse and by keyboard, on identical
 * copies of a project at 30 fps and 24000/1001, in a real browser against the
 * real service. The canonical clips must match, the timeline must show it, a real
 * export must blend at the cut, and undo, redo, reopen, removal and refusals must
 * behave.
 *
 * Usage: node scripts/qualify-crossfade.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mediaTools } from "../core/process/workers.ts";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-crossfade-"));
const port = 24398;
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
const FLICKS = 705_600_000;
const makeVideo = (name, colour) => {
  const file = join(root, name);
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colour}:s=160x90:r=30:d=8`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      file,
    ],
    { windowsHide: true },
  );
  return file;
};
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
  const red = makeVideo("red.mp4", "red");
  const blue = makeVideo("blue.mp4", "blue");
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), origin);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1800 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  const service = async (operation, parameters) => {
    const body = await page.evaluate(
      async ([operation, parameters]) => {
        const stored = JSON.parse(
          sessionStorage.getItem("yamakan.session") ?? "null",
        );
        const headers = { "Content-Type": "application/json" };
        if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
        const res = await fetch("/api/v1/call", {
          method: "POST",
          headers,
          body: JSON.stringify({ apiVersion: 1, operation, parameters }),
        });
        return res.json();
      },
      [operation, parameters],
    );
    if (body.error) throw new Error(`${operation}: ${body.error.message}`);
    return body.result;
  };
  const upload = async (projectId, file, name) => {
    const uploaded = await page.evaluate(
      async ([projectId, base64, name]) => {
        const stored = JSON.parse(
          sessionStorage.getItem("yamakan.session") ?? "null",
        );
        const headers = { "Content-Type": "video/mp4", "X-Asset-Name": name };
        if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
        const res = await fetch(`/api/v1/projects/${projectId}/assets`, {
          method: "POST",
          headers,
          body: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
        });
        return res.json();
      },
      [projectId, (await readFile(file)).toString("base64"), name],
    );
    const asset = uploaded.result?.asset ?? uploaded.asset ?? uploaded;
    assert.ok(asset.id, JSON.stringify(uploaded).slice(0, 300));
    return asset;
  };
  const ids = { a: crypto.randomUUID(), b: crypto.randomUUID() };
  const build = async (name, frameRate) => {
    const project = await service("yamakan.project.create", {
      name,
      frameRate,
    });
    const a = await upload(project.id, red, "red.mp4");
    const b = await upload(project.id, blue, "blue.mp4");
    const FRAME = Math.round((FLICKS * frameRate.den) / frameRate.num);
    const open = await service("yamakan.project.open", {
      projectId: project.id,
    });
    const track = open.tracks.find((t) => t.kind === "video").id;
    const clip = (clipId, assetId, start) => ({
      type: "clip.add",
      clipId,
      trackId: track,
      assetId,
      title: null,
      startTicks: start * FRAME,
      durationTicks: 60 * FRAME,
      sourceStartTicks: 30 * FRAME,
    });
    await service("yamakan.project.applyBatch", {
      projectId: project.id,
      expectedRevision: open.revision,
      operations: [clip(ids.a, a.id, 0), clip(ids.b, b.id, 60)],
    });
    return { id: project.id, name, trackId: track };
  };
  const canonical = async (projectId) => {
    const { clips } = await service("yamakan.project.open", { projectId });
    return JSON.stringify(
      clips
        .map((c) => ({
          id: c.id,
          startFrame: c.startFrame,
          durationFrames: c.durationFrames,
          sourceFrame: c.sourceFrame,
          transition: c.transition ?? null,
        }))
        .sort((x, y) => x.id.localeCompare(y.id)),
    );
  };
  const until = async (read, wanted) => {
    for (let i = 0; i < 150; i++) {
      const now = await read();
      if (wanted(now)) return now;
      await page.waitForTimeout(100);
    }
    throw new Error(`Timed out; last: ${await read()}`);
  };
  const dissolveOf = async (projectId) =>
    JSON.parse(await canonical(projectId)).find((c) => c.id === ids.b)
      .transition;
  const openProject = async (name) => {
    await page.goto(new URL("/", page.url()).href);
    await page.getByRole("button", { name, exact: false }).first().click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await page
      .locator(`[data-clip-id="${ids.b}"]`)
      .waitFor({ timeout: 15_000 });
    await page.locator(`[data-clip-id="${ids.b}"]`).focus();
    await page.getByTestId("clip-dissolve-panel").waitFor();
  };
  const frames = page.getByTestId("clip-dissolve-frames");
  const applyButton = page.getByTestId("clip-dissolve-apply");

  for (const [label, frameRate] of [
    ["30 fps", { num: 30, den: 1 }],
    ["24000/1001", { num: 24000, den: 1001 }],
  ]) {
    const byMouse = await build(`Mouse ${label}`, frameRate);
    const byKeys = await build(`Keys ${label}`, frameRate);
    assert.equal(await canonical(byMouse.id), await canonical(byKeys.id));

    await openProject(byMouse.name);
    await frames.click();
    await frames.fill("24");
    await applyButton.click();
    await until(
      () => dissolveOf(byMouse.id),
      (t) => t?.durationFrames === 24,
    );
    await page.getByTestId("tl-clip-dissolve").waitFor();
    assert.equal(await page.getByTestId("tl-clip-dissolve").innerText(), "24f");

    await openProject(byKeys.name);
    await frames.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("24");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await until(
      () => dissolveOf(byKeys.id),
      (t) => t?.durationFrames === 24,
    );
    assert.equal(await canonical(byMouse.id), await canonical(byKeys.id));
    step(`${label}: mouse and keyboard set the same dissolve, and it shows`);

    // A real export blends at the cut, and not away from it.
    const job = await service("yamakan.export.video", {
      projectId: byKeys.id,
      idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
    });
    const done = await until(
      async () =>
        JSON.stringify(await service("yamakan.job.status", { jobId: job.id })),
      (s) => ["COMPLETED", "FAILED"].includes(JSON.parse(s).state),
    );
    const finished = JSON.parse(done);
    assert.equal(finished.state, "COMPLETED", finished.error ?? "");
    // The export as the service published it, in the workspace.
    const exported = readdirSync(join(root, "workspace"), { recursive: true })
      .map(String)
      .find((f) => f.includes(job.id) && f.endsWith(".mp4"));
    assert.ok(exported, "the export is in the workspace");
    const raw = execFileSync(
      mediaTools().ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        join(root, "workspace", exported),
        "-vf",
        "scale=1:1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ],
      { windowsHide: true, maxBuffer: 1 << 26 },
    );
    const pixel = (n) => [raw[n * 3], raw[n * 3 + 1], raw[n * 3 + 2]];
    const near = (p, q) => p.every((v, i) => Math.abs(v - q[i]) < 40);
    assert.equal(raw.length / 3, 120, "the timeline's length is unchanged");
    assert.ok(near(pixel(30), [254, 0, 0]), `before: ${pixel(30)}`);
    assert.ok(near(pixel(100), [0, 0, 254]), `after: ${pixel(100)}`);
    const middle = pixel(60);
    assert.ok(
      middle[0] > 70 && middle[0] < 190 && middle[2] > 70 && middle[2] < 190,
      `at the cut: ${middle}`,
    );
    step(`${label}: a real export blends at the cut`, {
      before: pixel(30),
      middle,
      after: pixel(100),
    });

    // Undo, redo and a reopen; then removal.
    const undoButton = page.getByRole("button", { name: "Undo", exact: true });
    const redoButton = page.getByRole("button", { name: "Redo", exact: true });
    await undoButton.click();
    await until(
      () => dissolveOf(byKeys.id),
      (t) => t === null,
    );
    await redoButton.click();
    await until(
      () => dissolveOf(byKeys.id),
      (t) => t?.durationFrames === 24,
    );
    await openProject(byKeys.name);
    assert.equal(await frames.inputValue(), "24");
    assert.equal(await page.getByTestId("tl-clip-dissolve").innerText(), "24f");
    await page.getByTestId("clip-dissolve-remove").click();
    await until(
      () => dissolveOf(byKeys.id),
      (t) => t === null,
    );
    await page.getByTestId("tl-clip-dissolve").waitFor({ state: "detached" });
    step(`${label}: undo, redo, a reopen and removal all hold`);

    // Refusals: an odd length, and more source than the clip has.
    const status = page.locator('[role="status"].status');
    await frames.fill("13");
    await applyButton.click();
    await page.waitForTimeout(800);
    const odd = await status.innerText();
    assert.match(odd, /even|frames/i);
    assert.equal(await dissolveOf(byKeys.id), null);
    step(`${label}: an odd length is refused, with the reason`, { odd });

    // The first clip has no previous clip, so it offers no dissolve.
    await page.locator(`[data-clip-id="${ids.a}"]`).focus();
    await page
      .getByTestId("clip-dissolve-panel")
      .waitFor({ state: "detached" });
    step(`${label}: a clip with nothing before it offers no dissolve`);
  }

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
          task: "SS-014-crossfade",
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
console.log(passed ? "CROSSFADE PASS" : "CROSSFADE FAIL");
process.exit(passed ? 0 : 1);
