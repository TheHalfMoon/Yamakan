/**
 * The local engine panel in a real browser against the real service: with no
 * engine configured, with one that does not answer, and with a real ComfyUI started
 * safely and unsafely. In every state it must say generation is not available. It
 * generates nothing and no output here is AI.
 *
 * Usage: YAMAKAN_COMFYUI_DIR=<folder holding ComfyUI and venv> \
 *   node scripts/qualify-engine-panel.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { comfyLaunchArguments } from "../core/engines/comfyui.ts";

const dir = process.env.YAMAKAN_COMFYUI_DIR;
if (!dir) {
  console.error(
    "Set YAMAKAN_COMFYUI_DIR to the folder holding ComfyUI and venv.",
  );
  console.log("ENGINE PANEL NOT RUN");
  process.exit(2);
}
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});
const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-engine-panel-"));
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const comfyPort = 18193;
const comfyUrl = `http://127.0.0.1:${comfyPort}`;

const stopTree = (child) => {
  if (!child?.pid) return;
  try {
    execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } catch {
    child.kill();
  }
};
let comfy;
const startComfy = async (filter = (a) => a) => {
  const child = (comfy = spawn(
    join(dir, "venv", "Scripts", "python.exe"),
    [
      join(dir, "ComfyUI", "main.py"),
      "--cpu",
      ...filter(
        comfyLaunchArguments({
          port: comfyPort,
          baseDirectory: join(root, "comfy"),
        }),
      ),
    ],
    { windowsHide: true, stdio: "ignore" },
  ));
  for (let i = 0; i < 240; i++) {
    assert.equal(child.exitCode, null, "ComfyUI exited");
    const up = await fetch(`${comfyUrl}/system_stats`, {
      redirect: "error",
    }).then(
      (r) => r.ok,
      () => false,
    );
    if (up) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("ComfyUI did not start");
};

let browser;
let service;
let passed = false;
let portNow = 24410;
const serve = async (extra = {}) => {
  const folder = join(root, `workspace-${portNow}`);
  const port = portNow++;
  const child = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    {
      env: {
        ...process.env,
        YAMAKAN_WORKSPACE: folder,
        YAMAKAN_PORT: String(port),
        YAMAKAN_COMFYUI_URL: "",
        ...extra,
      },
      silent: true,
      windowsHide: true,
    },
  );
  let log = "";
  const logged = (c) => (log += String(c));
  child.stderr.on("data", logged);
  await new Promise((ready, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${log}`)),
      60_000,
    );
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Yamakan is running")) {
        clearTimeout(timer);
        ready();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${log}`));
    });
  });
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(folder, `http://127.0.0.1:${port}`);
  return {
    child,
    log: () => log,
    link: (await readFile(join(folder, "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
    stop: () =>
      new Promise((done) => {
        if (child.exitCode !== null) return done();
        child.once("exit", done);
        child.kill();
      }),
  };
};

try {
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1400 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const read = async () => {
    await page.getByTestId("engine-check").click();
    await page.getByTestId("engine-result").waitFor();
    await page.waitForTimeout(400);
    const text = async (id) =>
      (await page.getByTestId(id).count())
        ? (await page.getByTestId(id).innerText()).replace(/[⁦-⁩]/g, "")
        : null;
    return {
      connection: await text("engine-connection"),
      start: await text("engine-start"),
      generation: await text("engine-generation"),
    };
  };
  const visit = async (extra) => {
    service = await serve(extra);
    await page.goto(service.link);
    await page.waitForFunction(() => location.hash === "");
    await page.getByTestId("engine-panel").waitFor();
  };
  const notGenerating = async (seen) => {
    assert.match(seen.generation, /^Generation is not available in this build/);
    // In this state too, nothing on the page offers to generate.
    assert.equal(
      await page
        .locator("button, a, [role=button], [role=menuitem]")
        .filter({ hasText: /generat|توليد/i })
        .count(),
      0,
      "nothing offers to generate",
    );
  };

  await visit({});
  const none = await read();
  assert.match(none.connection, /No engine is configured/);
  assert.equal(none.start, null);
  await notGenerating(none);
  step(
    "with no engine configured, it says so, and that generation is unavailable",
    none,
  );
  await service.stop();

  await visit({ YAMAKAN_COMFYUI_URL: comfyUrl });
  const absent = await read();
  assert.match(absent.connection, /did not answer/);
  assert.equal(absent.start, null);
  await notGenerating(absent);
  step("with one that does not answer, it says so", absent);
  await service.stop();

  await startComfy();
  await visit({ YAMAKAN_COMFYUI_URL: comfyUrl });
  const safe = await read();
  assert.match(safe.connection, /The engine answered: version \d/);
  assert.match(safe.start, /reports a safe start/);
  await notGenerating(safe);
  step(
    "a real ComfyUI started safely is described, and generation stays unavailable",
    safe,
  );
  await service.stop();
  stopTree(comfy);
  await new Promise((r) => setTimeout(r, 1500));

  await startComfy((args) => args.filter((a) => a !== "--offline"));
  await visit({ YAMAKAN_COMFYUI_URL: comfyUrl });
  const unsafe = await read();
  assert.match(unsafe.start, /will not use it as started/);
  assert.match(unsafe.start, /Start it with: --offline/);
  await notGenerating(unsafe);
  step("a real ComfyUI started without --offline is called out", unsafe);
  await service.stop();

  await visit({ YAMAKAN_COMFYUI_URL: "http://example.com:8188" });
  const bad = await read();
  assert.match(bad.connection, /No engine is configured/);
  assert.equal(bad.start, null);
  await notGenerating(bad);
  assert.match(service.log(), /YAMAKAN_COMFYUI_URL was not used/);
  step(
    "an address off this machine is not used, and the editor still opens",
    bad,
  );
  await service.stop();
  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  service?.child.kill();
  stopTree(comfy);
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "engine-panel",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          passed,
          aiGenerated: false,
          steps,
        },
        null,
        2,
      )}\n`,
    );
  await new Promise((r) => setTimeout(r, 1500));
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
console.log(passed ? "ENGINE PANEL PASS" : "ENGINE PANEL FAIL");
process.exit(passed ? 0 : 1);
