/**
 * A real generation started from Yamakan's own page: a person's steps in a real
 * browser against the real service, a real model on the person's private Kaggle
 * notebook, its video back through the checks, placed, and exported. Costs free GPU
 * quota and takes minutes. Set YAMAKAN_KAGGLE_CLI and YAMAKAN_KAGGLE_USERNAME.
 *
 * Usage: node scripts/qualify-kaggle-generation.mjs <out-folder> [model-index] [prompt]
 * With YAMAKAN_QUALIFY_READY_ONLY=1 it stops before sending anything, for the page.
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mediaTools } from "../core/process/workers.ts";

const [out, modelIndex = "0", givenPrompt] = process.argv.slice(2);
if (
  !out ||
  !process.env.YAMAKAN_KAGGLE_CLI ||
  !process.env.YAMAKAN_KAGGLE_USERNAME
) {
  console.error(
    "Set YAMAKAN_KAGGLE_CLI and YAMAKAN_KAGGLE_USERNAME, and name an out folder.",
  );
  console.log("KAGGLE GENERATION NOT RUN");
  process.exit(2);
}
const PROMPT =
  givenPrompt ?? "A red kite flies above a green hill under a clear blue sky.";
const SEED = 7;
const READY_ONLY = Boolean(process.env.YAMAKAN_QUALIFY_READY_ONLY);
const MAX_WAIT_MS = 45 * 60 * 1000;
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});
mkdirSync(out, { recursive: true });
const root = mkdtempSync(join(tmpdir(), "yamakan-kaggle-run-"));
const port = 24433;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail, at: new Date().toISOString() });
  console.log(`ok - ${name}`);
};
// With YAMAKAN_QUALIFY_RESTART=1 the service is killed while the run is on Kaggle.
const RESTART = Boolean(process.env.YAMAKAN_QUALIFY_RESTART);
let log = "";
const spawnService = () => {
  const made = fork(
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
  made.stderr.on("data", (c) => (log += String(c)));
  return made;
};
let child = spawnService();
const running = (service) =>
  new Promise((ready, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${log}`)),
      120_000,
    );
    service.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Yamakan is running")) {
        clearTimeout(timer);
        ready();
      }
    });
    service.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${log}`));
    });
  });
const signInLink = async () => {
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), `http://127.0.0.1:${port}`);
  return readFileSync(join(root, "workspace", "launch"), "utf8")
    .split("\n")[0]
    .trim();
};

let browser;
let generationId = null;
let modelChosen = null;
let passed = false;
let failure = null;
try {
  await running(child);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
  await page.goto(await signInLink());
  await page.waitForFunction(() => location.hash === "");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-panel").waitFor();
  await page.getByTestId("create-prompt").fill(PROMPT);
  await page
    .getByTestId("create-model")
    .selectOption({ index: Number(modelIndex) });
  modelChosen = await page.getByTestId("create-model").inputValue();
  await page.getByTestId("create-seed").fill(String(SEED));

  const start = page.getByTestId("create-generate-start");
  await start.waitFor();
  assert.ok(await start.isDisabled(), "nothing starts until it is agreed to");
  await page.getByTestId("create-agree").check();
  await shot("1-ready");
  // The agreement is read in place: inside its panel, on more than a sliver of it.
  const fits = await page.evaluate(() => {
    const text = document
      .querySelector(".create-agree span")
      .getBoundingClientRect();
    const panel = document
      .querySelector(".create-composer")
      .getBoundingClientRect();
    return {
      inside: text.left >= panel.left && text.right <= panel.right,
      share: text.width / panel.width,
    };
  });
  assert.ok(fits.inside && fits.share > 0.5, JSON.stringify(fits));
  step("the agreement is readable in its place");
  if (READY_ONLY) throw new Error("Stopped before sending anything, as asked.");
  await start.click();
  const state = page.getByTestId("create-run-state");
  await state.waitFor({ timeout: 300_000 });
  step("started from the page, after agreeing the prompt leaves this computer");
  await shot("2-started");

  const began = Date.now();
  let last = "";
  let restarted = false;
  for (;;) {
    const now = await state.getAttribute("data-state");
    if (now !== last) {
      step(`Kaggle says ${now}`, { afterSeconds: (Date.now() - began) / 1000 });
      if (now === "running") await shot("3-running");
      last = now;
    }
    if (RESTART && now === "running" && !restarted) {
      restarted = true;
      const ask = (operation, parameters) =>
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
      const projects = await ask("yamakan.project.list", {});
      const projectId = (projects.projects ?? projects)[0].id;
      const before = await ask("yamakan.generation.list", { projectId });
      assert.equal(before.length, 1);
      generationId = before[0].generationId;
      // Killed outright, with the run under way on Kaggle.
      await new Promise((done) => {
        child.once("exit", done);
        child.kill("SIGKILL");
      });
      step("the service is killed while the run is on Kaggle", {
        generationId,
      });
      child = spawnService();
      await running(child);
      // A link differing only by its fragment would not load the page again.
      await page.goto("about:blank");
      await page.goto(await signInLink());
      await page.waitForFunction(() => location.hash === "");
      await page
        .getByRole("button", { name: /revision/i })
        .first()
        .click();
      await page.getByRole("tab", { name: "Create", exact: true }).click();
      await state.waitFor({ timeout: 120_000 });
      const after = await ask("yamakan.generation.list", { projectId });
      assert.equal(after.length, 1, "no second run");
      assert.equal(after[0].generationId, generationId, "the same run");
      step("after the restart the page has the same run, and is following it");
      await shot("3b-after-restart");
      continue;
    }
    if (["succeeded", "failed", "cancelled"].includes(now)) break;
    assert.ok(Date.now() - began < MAX_WAIT_MS, "it took too long");
    await page.waitForTimeout(10_000);
  }
  await shot("4-ended");
  if (last !== "succeeded") {
    const note = await page.getByTestId("create-run-note").textContent();
    throw new Error(`The run ended ${last}: ${note}`);
  }
  step("the run finished, and its video passed its receipt", {
    seconds: (Date.now() - began) / 1000,
  });

  await page.getByTestId("create-run-bring-in").click();
  const card = page.getByTestId("create-video").first();
  await card.waitFor({ timeout: 180_000 });
  const facts = await page.getByTestId("create-receipt-facts").textContent();
  assert.ok(facts.includes(PROMPT), `its prompt: ${facts}`);
  assert.ok(facts.includes(`seed ${SEED}`), `its seed: ${facts}`);
  step("it came into the project, with this prompt and seed");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => location.hash === "");
  await page
    .getByRole("button", { name: /revision/i })
    .first()
    .click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-video").first().waitFor();
  await page
    .getByText(PROMPT, { exact: true })
    .first()
    .waitFor({ timeout: 30_000 });
  step(
    "its record stays with the project, with this browser's storage cleared",
  );
  await page.waitForTimeout(2000);
  await shot("5-brought-in");

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

  await page.getByTestId("create-place").click();
  await page.getByTestId("create-open-edit").click();
  await page.locator("[data-clip-id]").first().waitFor({ timeout: 30_000 });
  const listed = await service("yamakan.project.list", {});
  const projectId = (listed.projects ?? listed)[0].id;
  let project;
  for (let i = 0; i < 50; i++) {
    project = await service("yamakan.project.open", { projectId });
    if (project.clips.length === 1) break;
    await page.waitForTimeout(200);
  }
  const asset = project.assets.find((a) => a.id === project.clips[0].assetId);
  assert.equal(project.clips[0].durationFrames, asset.durationFrames);
  step("placed whole on the Edit timeline", { frames: asset.durationFrames });
  await shot("6-edit");

  await page
    .getByRole("button", { name: /^Export/ })
    .first()
    .click();
  let job;
  for (let i = 0; i < 1200; i++) {
    const jobs = await service("yamakan.job.list", {});
    // The run's own job is in this list too, naming its asset rather than a file.
    job = (jobs.jobs ?? jobs).find(
      (j) => j.projectId === projectId && !j.artifact?.startsWith("asset:"),
    );
    if (job && ["COMPLETED", "FAILED"].includes(job.state)) break;
    await page.waitForTimeout(200);
  }
  assert.equal(job?.state, "COMPLETED", job?.error ?? "no export job");
  const exported = readdirSync(join(root, "workspace"), { recursive: true })
    .map(String)
    .find((f) => f.replaceAll("\\", "/").endsWith(job.artifact));
  const file = join(root, "workspace", exported);
  const probe = JSON.parse(
    execFileSync(
      mediaTools().ffprobe,
      [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,nb_read_frames",
        "-of",
        "json",
        file,
      ],
      { windowsHide: true, encoding: "utf8" },
    ),
  ).streams[0];
  assert.equal(probe.codec_name, "h264");
  assert.equal(Number(probe.nb_read_frames), asset.durationFrames);
  copyFileSync(file, join(out, "export.mp4"));
  const generated = project.assets.find((a) => a.kind === "video");
  step("exported from the toolbar, every frame", {
    width: probe.width,
    height: probe.height,
    frames: Number(probe.nb_read_frames),
    assetHash: generated.hash,
    exportHash: createHash("sha256").update(readFileSync(file)).digest("hex"),
  });
  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} catch (e) {
  failure = String(e?.message ?? e).slice(0, 1000);
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  writeFileSync(
    join(out, "receipt.json"),
    `${JSON.stringify(
      {
        model: await modelChosen,
        restarted: RESTART,
        generationId,
        task: READY_ONLY
          ? "the-page-before-a-run-only"
          : "generation-from-yamakan-on-kaggle",
        prompt: PROMPT,
        seed: SEED,
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
  await new Promise((r) => {
    if (child.exitCode !== null) return r();
    child.once("exit", r);
    setTimeout(r, 10_000);
  });
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
console.log(
  READY_ONLY && failure?.startsWith("Stopped before sending")
    ? "NOTHING SENT: only the page before a run was looked at"
    : passed
      ? "KAGGLE GENERATION PASS"
      : "KAGGLE GENERATION FAIL",
);
process.exit(passed ? 0 : 1);
