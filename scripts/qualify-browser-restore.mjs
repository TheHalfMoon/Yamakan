/**
 * SS-015: restore as a person meets it. A project with footage, a converted
 * variable-rate clip and a reference pack is backed up and restored through the
 * real browser, Yamakan is started on the restored folder, and the project is
 * opened, edited and exported there. A restore process is also killed partway,
 * more than once, to see what it leaves.
 *
 * Usage: node scripts/qualify-browser-restore.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes } from "../core/command/registry.ts";
import { mediaTools } from "../core/process/workers.ts";
import { backupWorkspace } from "../core/recovery.ts";

// A restore in a process of its own, to be killed.
if (process.argv[2] === "--restore-child") {
  const { restoreWorkspace } = await import("../core/recovery.ts");
  await restoreWorkspace(process.argv[3], process.argv[4]);
  process.exit(0);
}

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-browser-restore-"));
const workspace = join(root, "workspace");
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const FRAME = 29_429_400;
const ffmpeg = (args) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { windowsHide: true },
  );
// A project's own files; a running service also keeps a token and logs beside them.
const tree = (workspaceDir) => {
  const dir = join(workspaceDir, "projects");
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile())
    .map((f) => join(f.parentPath, f.name))
    .map((f) => [relative(dir, f), sha(readFileSync(f))])
    .sort(([x], [y]) => (x < y ? -1 : 1));
};

// The project, built before any service holds the workspace.
const red = join(root, "red.mp4");
ffmpeg([
  "-f",
  "lavfi",
  "-i",
  "color=c=red:s=160x90:r=24000/1001:d=6",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-pix_fmt",
  "yuv420p",
  red,
]);
const vfr = join(root, "vfr.mp4");
ffmpeg([
  "-f",
  "lavfi",
  "-i",
  "testsrc=size=160x90:rate=30:duration=4",
  "-vf",
  "select='not(mod(n\\,3))+eq(n\\,1)'",
  "-fps_mode",
  "vfr",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-pix_fmt",
  "yuv420p",
  vfr,
]);
const still = join(root, "still.png");
ffmpeg(["-f", "lavfi", "-i", "color=c=blue:s=64x36", "-frames:v", "1", still]);

const clipId = crypto.randomUUID();
const packId = crypto.randomUUID();
let projectId;
let assets;
{
  const store = new ProjectStore(workspace);
  await store.initialize();
  const queue = new JobSupervisor(store);
  await queue.start();
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  };
  const run = async (operation, args = {}) =>
    (await execute(ctx, operation, { projectId, ...args })).result;
  const project = (
    await execute(ctx, "yamakan.project.create", {
      name: "Restore me",
      frameRate: { num: 24000, den: 1001 },
    })
  ).result;
  projectId = project.id;
  const redAsset = (
    await store.importAsset(projectId, "red.mp4", await readFile(red))
  ).asset;
  const stillAsset = (
    await store.importAsset(projectId, "still.png", await readFile(still))
  ).asset;
  const staged = await store.stageAsset(
    projectId,
    "vfr.mp4",
    await readFile(vfr),
  );
  assert.equal(staged.probe.variableFrameRate, true);
  const job = await queue.submitDerivative(projectId, staged);
  for (let i = 0; i < 600; i++) {
    const s = (await execute(ctx, "yamakan.job.status", { jobId: job.id }))
      .result;
    if (s.state === "COMPLETED") break;
    assert.ok(!["FAILED", "CANCELLED"].includes(s.state), JSON.stringify(s));
    await new Promise((r) => setTimeout(r, 100));
  }
  const open = () => run("yamakan.project.open");
  let head = await open();
  const converted = head.assets.find((a) => a.name.startsWith("vfr"));
  assert.ok(converted, "the converted asset joined the project");
  assets = { red: redAsset, still: stillAsset, converted };
  const track = head.tracks.find((t) => t.kind === "video").id;
  await run("yamakan.project.applyBatch", {
    expectedRevision: head.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: track,
        assetId: redAsset.id,
        title: null,
        startTicks: 0,
        durationTicks: 60 * FRAME,
        sourceStartTicks: 0,
      },
    ],
  });
  head = await open();
  await run("yamakan.pack.save", {
    expectedRevision: head.revision,
    documentId: packId,
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Room",
      entries: [
        {
          id: crypto.randomUUID(),
          role: "environment",
          label: "Room",
          assetId: stillAsset.id,
          assetHash: stillAsset.hash,
          characterId: null,
          consentId: null,
        },
      ],
    },
  });
  await queue.close?.();
  await store.close();
}
step("a project with footage, a converted clip and a pack is built", {
  converted: assets.converted.name,
});

const serve = async (folder, port) => {
  const child = fork(
    fileURLToPath(new URL("../server/main.ts", import.meta.url)),
    [],
    {
      env: {
        ...process.env,
        YAMAKAN_WORKSPACE: folder,
        YAMAKAN_PORT: String(port),
      },
      silent: true,
      windowsHide: true,
    },
  );
  let log = "";
  child.stderr.on("data", (c) => (log += String(c)));
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
    link: (await readFile(join(folder, "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
    stop: () =>
      new Promise((done) => {
        child.once("exit", done);
        child.kill();
      }),
  };
};

let browser;
let passed = false;
const live = [];
try {
  const before = tree(workspace);
  assert.ok(before.length >= 3, "the project's media files are compared");
  const a = await serve(workspace, 24401);
  live.push(a);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1400 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(a.link);
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
  const original = JSON.stringify(
    await service("yamakan.project.export", { projectId }),
  );

  // By the browser's own controls.
  await page.getByRole("button", { name: "Back up now" }).click();
  await page.waitForFunction(() =>
    /Backup created/.test(document.body.innerText),
  );
  step("a backup is made with the browser's control");
  await page.getByRole("button", { name: "Restore to a new folder" }).click();
  await page.waitForFunction(() =>
    /Restored into a new workspace folder/.test(document.body.innerText),
  );
  // The folder is held in bidirectional isolates, for the Arabic layout.
  const said = (await page.evaluate(() => document.body.innerText)).replace(
    /[⁦-⁩]/g,
    "",
  );
  const restoredRoot = /new workspace folder: (.+?)\. Start Yamakan/.exec(
    said,
  )?.[1];
  assert.ok(restoredRoot && existsSync(restoredRoot), said.slice(0, 300));
  step("a restore is made with the browser's control, and names its folder");
  await a.stop();
  live.pop();
  assert.deepEqual(
    tree(workspace),
    before,
    "the original's files are as they were",
  );

  // Yamakan on the restored folder, as the message says to do.
  const b = await serve(restoredRoot, 24402);
  live.push(b);
  await page.goto(b.link);
  await page.waitForFunction(() => location.hash === "");
  assert.equal(
    JSON.stringify(await service("yamakan.project.export", { projectId })),
    original,
    "the project is the same, byte for byte",
  );
  await page
    .getByRole("button", { name: "Restore me", exact: false })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Restore me", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  const clip = page.locator(`[data-clip-id="${clipId}"]`);
  await clip.waitFor({ timeout: 30_000 });
  step(
    "Yamakan starts on the restored folder, and the project opens in the browser",
  );

  const docs = await service("yamakan.document.list", { projectId });
  assert.ok(
    docs.some((d) => d.id === packId && d.kind === "referencePack"),
    JSON.stringify(docs),
  );
  const head = await service("yamakan.project.export", { projectId });
  assert.ok(head.assets.some((x) => x.id === assets.converted.id));
  const said2 = JSON.parse(
    readFileSync(join(restoredRoot, "restore.json"), "utf8"),
  );
  assert.deepEqual(said2.quarantined, []);
  assert.equal(said2.creative, "complete");
  assert.equal(said2.closure.gaps, 0);
  step("the converted clip and the pack came through", {
    documents: docs.length,
    assets: head.assets.length,
  });

  // It is a working project: an edit holds, and a real export comes out.
  await clip.focus();
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForFunction(
    async ([projectId, clipId]) => {
      const stored = JSON.parse(
        sessionStorage.getItem("yamakan.session") ?? "null",
      );
      const res = await fetch("/api/v1/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(stored?.session ? { "X-Yamakan-Session": stored.session } : {}),
        },
        body: JSON.stringify({
          apiVersion: 1,
          operation: "yamakan.project.export",
          parameters: { projectId },
        }),
      });
      const { result } = await res.json();
      return result.clips.find((c) => c.id === clipId).startTicks > 0;
    },
    [projectId, clipId],
    { polling: 300, timeout: 20_000 },
  );
  step("an edit made in the browser holds in the restored project");
  const job = await service("yamakan.export.video", {
    projectId,
    idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
  });
  let done;
  for (let i = 0; i < 600; i++) {
    done = await service("yamakan.job.status", { jobId: job.id });
    if (["COMPLETED", "FAILED"].includes(done.state)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(done.state, "COMPLETED", done.error ?? "");
  const exported = readdirSync(restoredRoot, { recursive: true })
    .map(String)
    .find((f) => f.replaceAll("\\", "/").endsWith(done.artifact));
  assert.ok(exported, "the export is in the restored folder");
  const raw = execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      join(restoredRoot, exported),
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
  const last = raw.subarray(raw.length - 3);
  assert.ok(last[0] > 200 && last[2] < 50, `last frame ${[...last]}`);
  step("a real export comes out of the restored project", {
    frames: raw.length / 3,
    lastFrame: [...last],
  });
  assert.deepEqual(pageErrors, []);
  await b.stop();
  live.pop();
  assert.deepEqual(tree(workspace), before, "the original is still as it was");
  {
    const reopened = new ProjectStore(workspace);
    await reopened.initialize();
    assert.equal(
      JSON.stringify(await reopened.exportProject(projectId)),
      original,
      "the original project has no edit from the restored one",
    );
    await reopened.close();
  }
  step("the original never changed, and the browser saw no page errors");

  // A restore killed partway, at several points.
  const backupRoot = join(root, "kill-home");
  const store = new ProjectStore(workspace);
  await store.initialize();
  const backup = await backupWorkspace(store, backupRoot);
  await store.close();
  const backupDir = join(backupRoot, "backups", backup.backupId);
  const self = fileURLToPath(import.meta.url);
  const kills = [];
  // Timed from the folder appearing, since a fixed delay misses the copy entirely.
  for (const delay of [0, 2, 5, 10, 20, 40, 80, 160]) {
    const target = join(root, `killed-${delay}`);
    const child = fork(self, ["--restore-child", backupDir, target], {
      silent: true,
      windowsHide: true,
    });
    for (let i = 0; i < 6000 && child.exitCode === null; i++) {
      if (existsSync(target)) break;
      await new Promise((r) => setTimeout(r, 1));
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const exitedFirst = child.exitCode !== null;
    child.kill("SIGKILL");
    await new Promise((r) => {
      if (child.exitCode !== null) r();
      else child.once("exit", r);
    });
    const left = existsSync(target) ? readdirSync(target) : [];
    const finished = left.includes("restore.json");
    kills.push({
      delay,
      exitedFirst,
      finished,
      leftFolder: existsSync(target),
      hasDatabase: left.includes("workspace.sqlite"),
      left,
    });
    // Yamakan itself, started on what was left, must refuse and name the folder.
    // A kill before the mark leaves an empty folder, which would open as a new
    // empty workspace; it holds nothing, but a person could still be misled.
    if (left.length && !finished) {
      const opened = new ProjectStore(target);
      await assert.rejects(opened.initialize(), (e) => {
        kills.at(-1).startingThere = e.code;
        return e.code === "RECOVERY_REQUIRED";
      });
      const started = fork(
        fileURLToPath(new URL("../server/main.ts", import.meta.url)),
        [],
        {
          env: {
            ...process.env,
            YAMAKAN_WORKSPACE: target,
            YAMAKAN_PORT: "24403",
          },
          silent: true,
          windowsHide: true,
        },
      );
      let said = "";
      started.stderr.on("data", (c) => (said += String(c)));
      const code = await new Promise((r) => started.once("exit", r));
      assert.equal(code, 1, said);
      assert.ok(said.includes("did not finish") && said.includes(target), said);
      kills.at(-1).serverRefused = true;
    }
  }
  assert.deepEqual(tree(workspace), before, "kills leave the original alone");
  assert.ok(
    // A refusal seen on a folder holding something beyond the mark itself.
    kills.some((k) => k.serverRefused && k.left.length > 1),
    `no kill landed during a restore: ${JSON.stringify(kills)}`,
  );
  const again = fork(
    self,
    ["--restore-child", backupDir, join(root, "after-kills")],
    { silent: true, windowsHide: true },
  );
  const code = await new Promise((r) => again.once("exit", r));
  assert.equal(code, 0, "the same backup still restores after the kills");
  assert.ok(existsSync(join(root, "after-kills", "restore.json")));
  step(
    "restores killed partway leave the original alone, and the backup still restores",
    {
      kills,
    },
  );
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  for (const s of live) s.child.kill();
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "SS-015-browser-restore",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          passed,
          steps,
        },
        null,
        2,
      )}\n`,
    );
  await new Promise((r) => setTimeout(r, 1000));
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  });
}
console.log(passed ? "RESTORE PASS" : "RESTORE FAIL");
process.exit(passed ? 0 : 1);
