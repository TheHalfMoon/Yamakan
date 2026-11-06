/**
 * Whether a made video's record really lasts: a save that fails and is tried again,
 * with no second asset or shot and no success said too soon; cleared browser storage;
 * the service restarted; and a backup restored and started on. Real Edge, real
 * service. Its video is a test pattern with a receipt written here, so this checks
 * the record, not a model, and nothing in it is AI output.
 *
 * Usage: node scripts/qualify-create-durable.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
const receiptOut = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-create-durable-"));
const workspace = join(root, "workspace");
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};

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
      120_000,
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
  return {
    child,
    // Each is good for one sign-in.
    link: async () => {
      await writeLaunchLink(folder, `http://127.0.0.1:${port}`);
      return (await readFile(join(folder, "launch"), "utf8"))
        .split("\n")[0]
        .trim();
    },
    stop: () =>
      new Promise((done) => {
        if (child.exitCode !== null) return done();
        child.once("exit", done);
        child.kill();
      }),
  };
};

const video = join(root, "made.mp4");
execFileSync(
  mediaTools().ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=704x480:rate=24:duration=2",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    video,
  ],
  { windowsHide: true },
);
const sha = createHash("sha256").update(readFileSync(video)).digest("hex");
const runReceipt = join(root, "receipt.json");
const PROMPT = "A test pattern, not a generated video.";
writeFileSync(
  runReceipt,
  JSON.stringify({
    format: "yamakan.generation-receipt/v1",
    stage: "done",
    verified: true,
    model: "test-pattern",
    revision: "none",
    prompt: PROMPT,
    seed: 11,
    steps: 1,
    sha256: sha,
  }),
);

let browser;
let passed = false;
let failure = null;
const live = [];
try {
  let server = await serve(workspace, 24441);
  live.push(server);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  let context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  let page = await context.newPage();
  const pageErrors = [];
  const watch = (p) => p.on("pageerror", (e) => pageErrors.push(e.message));
  watch(page);
  const signIn = async (link) => {
    await page.goto(link);
    await page.waitForFunction(() => location.hash === "");
  };
  const openCreate = async () => {
    await page
      .getByRole("button", { name: /revision/i })
      .first()
      .click();
    await page.getByRole("tab", { name: "Create", exact: true }).click();
    await page.getByTestId("create-panel").waitFor();
  };
  const service = (operation, parameters) =>
    page.evaluate(
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
        const body = await res.json();
        if (body.error) throw new Error(body.error.message);
        return body.result;
      },
      [operation, parameters],
    );
  // What the service itself holds, not what the page shows.
  const held = async (projectId) => {
    const project = await service("yamakan.project.open", { projectId });
    const documents = await service("yamakan.document.list", { projectId });
    const stories = [];
    for (const d of documents)
      if (d.kind === "story")
        stories.push(
          await service("yamakan.document.get", {
            projectId,
            documentId: d.id,
          }),
        );
    const shots = stories.flatMap((s) =>
      s.content.scenes.flatMap((scene) => scene.shots),
    );
    return { project, stories, shots };
  };
  const recordShows = () =>
    page
      .getByTestId("create-video")
      .getByText(PROMPT, { exact: true })
      .first()
      .waitFor({ timeout: 30_000 });

  await signIn(await server.link());
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-panel").waitFor();
  const listed = await service("yamakan.project.list", {});
  const projectId = (listed.projects ?? listed)[0].id;

  // The save fails, once, as a service refusing or a lost answer would.
  let refused = 0;
  await page.route("**/api/v1/call", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.operation === "yamakan.story.save" && refused === 0) {
      refused++;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByTestId("create-receipt").setInputFiles(runReceipt);
  await page.getByTestId("create-video-file").setInputFiles(video);
  await page.getByTestId("create-record-retry").waitFor({ timeout: 60_000 });
  assert.equal(refused, 1, "the save was the thing that failed");
  await page.getByRole("alert").getByText("could not be saved").waitFor();
  assert.equal(
    await page.getByTestId("create-notice").textContent(),
    "",
    "no success is said while the record is not saved",
  );
  assert.equal(
    await page.getByTestId("create-receipt-facts").count(),
    0,
    "the card claims nothing",
  );
  let now = await held(projectId);
  assert.equal(now.project.assets.length, 1, "the video did come in");
  assert.equal(now.shots.length, 0, "the service holds no record");
  step("a failed save says so, claims no success, and the video is in");

  await page.getByTestId("create-record-retry").click();
  await recordShows();
  await page
    .getByTestId("create-notice")
    .getByText("matches its receipt")
    .waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "the alert has gone");
  assert.equal(await page.getByTestId("create-record-retry").count(), 0);
  now = await held(projectId);
  assert.equal(now.project.assets.length, 1, "no second asset");
  assert.equal(now.shots.length, 1, "one shot");
  assert.equal(await page.getByTestId("create-video").count(), 1);
  assert.equal(now.shots[0].notes, PROMPT);
  assert.equal(now.shots[0].takes[0].assetId, now.project.assets[0].id);
  assert.equal(now.shots[0].takes[0].lineage.outputHash, sha);
  const documentId = now.stories[0].id;
  step("trying again saves it once, with no duplicate", { documentId });
  await page.unroute("**/api/v1/call");

  // The save gets through and its answer is lost: the record exists, the page has not
  // heard, and trying again must find it rather than add it.
  const second = join(root, "second.mp4");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=704x480:rate=24:duration=1",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      second,
    ],
    { windowsHide: true },
  );
  const secondHash = createHash("sha256")
    .update(readFileSync(second))
    .digest("hex");
  const secondReceipt = join(root, "second.json");
  const SECOND_PROMPT = "A second test pattern.";
  writeFileSync(
    secondReceipt,
    JSON.stringify({
      ...JSON.parse(readFileSync(runReceipt, "utf8")),
      prompt: SECOND_PROMPT,
      sha256: secondHash,
    }),
  );
  let lost = 0;
  await page.route("**/api/v1/call", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.operation === "yamakan.story.save" && lost === 0) {
      lost++;
      await route.fetch();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByTestId("create-receipt").setInputFiles(secondReceipt);
  await page.getByTestId("create-video-file").setInputFiles(second);
  await page.getByTestId("create-record-retry").waitFor({ timeout: 60_000 });
  assert.equal(lost, 1);
  now = await held(projectId);
  assert.equal(now.shots.length, 2, "the save did get through");
  await page.getByTestId("create-record-retry").click();
  await page
    .getByTestId("create-video")
    .getByText(SECOND_PROMPT, { exact: true })
    .waitFor({ timeout: 30_000 });
  await page.getByTestId("create-record-retry").waitFor({ state: "detached" });
  now = await held(projectId);
  assert.equal(now.project.assets.length, 2, "no third asset");
  assert.equal(now.shots.length, 2, "no third shot");
  step(
    "a save whose answer was lost is found on trying again, not added twice",
  );
  await page.unroute("**/api/v1/call");
  const storyHashAfter = now.stories[0].contentHash;

  // A new browser profile: nothing of this one's storage at all.
  await context.close();
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  page = await context.newPage();
  watch(page);
  await signIn(await server.link());
  await openCreate();
  await recordShows();
  step("the record shows in a fresh browser profile");

  await server.stop();
  live.pop();
  server = await serve(workspace, 24442);
  live.push(server);
  await signIn(await server.link());
  await openCreate();
  await recordShows();
  now = await held(projectId);
  assert.equal(now.stories[0].contentHash, storyHashAfter, "the same record");
  assert.equal(now.project.assets.length, 2);
  step("the record is the same after the service restarts");

  await page.getByRole("button", { name: "Back up now" }).click();
  await page.waitForFunction(() =>
    /Backup created/.test(document.body.innerText),
  );
  await page.getByRole("button", { name: "Restore to a new folder" }).click();
  await page.waitForFunction(() =>
    /Restored into a new workspace folder/.test(document.body.innerText),
  );
  const said = (await page.evaluate(() => document.body.innerText)).replace(
    /[⁦-⁩]/g,
    "",
  );
  const restoredRoot = /new workspace folder: (.+?)\. Start Yamakan/.exec(
    said,
  )?.[1];
  assert.ok(restoredRoot && existsSync(restoredRoot), said.slice(0, 300));
  assert.notEqual(restoredRoot, workspace, "a different folder");
  step("a backup is made and restored, with the browser's controls");

  await server.stop();
  live.pop();
  server = await serve(restoredRoot, 24443);
  live.push(server);
  await signIn(await server.link());
  await openCreate();
  await recordShows();
  now = await held(projectId);
  assert.equal(now.stories.length, 1);
  assert.equal(now.stories[0].id, documentId, "the same story");
  assert.equal(now.stories[0].contentHash, storyHashAfter, "the same bytes");
  assert.deepEqual(
    now.project.assets.map((a) => a.hash).sort(),
    [sha, secondHash].sort(),
    "the same videos",
  );
  await page.getByTestId("create-place").first().click();
  await page.getByTestId("create-open-edit").click();
  await page.locator("[data-clip-id]").first().waitFor({ timeout: 30_000 });
  step("Yamakan on the restored folder has the record and can use the video");

  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} catch (e) {
  failure = String(e?.message ?? e).slice(0, 1000);
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  await Promise.all(live.map((s) => s.stop()));
  if (receiptOut)
    writeFileSync(
      receiptOut,
      `${JSON.stringify(
        {
          task: "create-record-durability",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          dirty:
            execFileSync("git", ["status", "--porcelain"], {
              encoding: "utf8",
            }).trim() !== "",
          passed,
          failure,
          steps,
        },
        null,
        2,
      )}\n`,
    );
  try {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 300,
    });
  } catch (e) {
    console.log(`note - left behind: ${root} (${e.code})`);
  }
}
console.log(passed ? "DURABLE PASS" : "DURABLE FAIL");
process.exit(passed ? 0 : 1);
