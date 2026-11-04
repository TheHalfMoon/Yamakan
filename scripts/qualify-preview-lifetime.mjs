/**
 * SS-009: the reference preview's frame lifetime in a real browser against the
 * real service. Random and reverse seeks keep at most one decoded frame alive,
 * a late answer for another project is never shown, and leaving releases it.
 *
 * Usage: node scripts/qualify-preview-lifetime.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
const root = mkdtempSync(join(tmpdir(), "yamakan-preview-life-"));
const port = 24383;
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

const FRAME = 23_520_000;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const still = (name, colour) => {
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
      `color=c=${colour}:s=320x180`,
      "-frames:v",
      "1",
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
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), origin);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  // Every object URL the page makes for an image, alive until it is revoked.
  await page.addInitScript(() => {
    const live = new Set();
    let made = 0;
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      if (blob?.type?.startsWith("image/")) {
        live.add(url);
        made++;
      }
      return url;
    };
    URL.revokeObjectURL = (url) => {
      live.delete(url);
      revoke(url);
    };
    window.__frames = () => ({ live: live.size, made });
  });
  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");

  const call = async (operation, parameters) => {
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
    if (body.error) throw new Error(`${operation}: ${body.error.code}`);
    return body.result;
  };
  const open = async (name) => {
    await page
      .getByRole("button", { name: new RegExp(`${name} Revision`) })
      .first()
      .click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  };
  // A project showing one colour on the whole timeline.
  const project = async (name, colour) => {
    await page.getByLabel("Project name", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await page
      .getByLabel("Import local media")
      .setInputFiles(still(`${colour}.png`, colour));
    await page.getByText(`${colour}.png`).first().waitFor();
    const listed = await call("yamakan.project.list", {});
    const id = (listed.projects ?? listed).find((p) => p.name === name).id;
    const opened = await call("yamakan.project.open", { projectId: id });
    const head = opened.project ?? opened;
    await call("yamakan.project.applyBatch", {
      projectId: id,
      expectedRevision: head.revision,
      operations: [
        {
          type: "clip.add",
          clipId: crypto.randomUUID(),
          trackId: head.tracks.find((t) => t.kind === "video").id,
          assetId: head.assets[0].id,
          title: null,
          startTicks: 0,
          durationTicks: 300 * FRAME,
          sourceStartTicks: 0,
        },
      ],
    });
    return id;
  };
  const first = await project("First", "red");
  const second = await project("Second", "blue");
  await page.reload();
  await open("First");

  const frames = () => page.evaluate(() => window.__frames());
  const rested = () =>
    page.waitForFunction(
      () =>
        document.querySelector(".reference img")?.getAttribute("data-state") ===
        "ready",
    );
  // The colour on screen, read from the frame shown.
  const shownColour = () =>
    page.evaluate(() => {
      const img = document.querySelector(".reference img");
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const c = canvas.getContext("2d");
      c.drawImage(img, 0, 0);
      const [r, , b] = c.getImageData(10, 10, 1, 1).data;
      return r > b ? "red" : "blue";
    });

  await rested();
  assert.equal(await shownColour(), "red");
  let peak = 0;
  const made = (await frames()).made;
  for (const seconds of [9, 0.5, 7, 0.1, 5, 8.5, 2, 9, 0.5]) {
    await page.getByLabel("Playhead").fill(String(seconds));
    await page.waitForTimeout(500);
    await page.waitForFunction(
      (s) =>
        document.querySelector(".reference img")?.getAttribute("data-src") &&
        document
          .querySelector(".reference img")
          .getAttribute("data-src")
          .includes(`start=${Math.round(s * 30)}`) &&
        document.querySelector(".reference img").getAttribute("data-state") ===
          "ready",
      seconds,
    );
    const now = await frames();
    peak = Math.max(peak, now.live);
    assert.equal(now.live, 1, `after seeking to ${seconds} s`);
  }
  const after = await frames();
  assert.ok(after.made > made, "the seeks made new frames");
  step("random and reverse seeks keep one decoded frame alive", {
    framesMade: after.made - made,
    peakLive: peak,
  });

  // A frame of the first project is held back until the second is open.
  let release;
  const held = new Promise((r) => (release = r));
  let heldBack = 0;
  await page.route(
    (url) => url.href.includes(first) && url.href.includes("kind=frame"),
    async (route) => {
      heldBack++;
      await held;
      await route.continue().catch(() => {});
    },
  );
  await page.getByLabel("Playhead").fill("3");
  await page.waitForTimeout(600);
  assert.ok(heldBack >= 1, "a frame of the first project was held back");
  await open("Second");
  await page.waitForFunction((id) => {
    const src = document
      .querySelector(".reference img")
      ?.getAttribute("data-src");
    return src?.includes(id);
  }, second);
  await rested();
  assert.equal(await shownColour(), "blue");
  release();
  await page.waitForTimeout(1500);
  assert.equal(await shownColour(), "blue", "a late answer replaced the frame");
  assert.equal((await frames()).live, 1);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  step("a late answer for another project is never shown");

  // A refused frame shows no stale picture and keeps nothing extra alive.
  await page.route(/\/preview\?.*kind=frame/, (route) =>
    route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({
        apiVersion: 1,
        error: {
          code: "CAPABILITY_UNAVAILABLE",
          message: "Refused for this check.",
          retryable: false,
        },
      }),
    }),
  );
  await page.getByLabel("Playhead").fill("4");
  await page
    .locator(".reference [role=alert]")
    .filter({ hasText: "Refused for this check." })
    .waitFor();
  assert.equal(await page.locator(".reference img").count(), 0);
  assert.ok((await frames()).live <= 1);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  step("a refused frame shows no stale picture");

  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "SS-009",
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
console.log(passed ? "PREVIEW LIFETIME PASS" : "PREVIEW LIFETIME FAIL");
process.exit(passed ? 0 : 1);
