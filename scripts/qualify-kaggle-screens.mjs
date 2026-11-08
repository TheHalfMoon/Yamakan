/**
 * The Create panel's failure, stop and restart screens, in a real browser against the real
 * service, with a stand-in for the Kaggle CLI. No network, no quota, no model. It shows what
 * this page does with each answer. It says nothing of what real Kaggle answers: its words
 * are copied from real runs where there were any.
 *
 * Usage: node scripts/qualify-kaggle-screens.mjs [out-folder]   (Windows, for now)
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { KAGGLE_RECIPES } from "../core/engines/kaggle.ts";
import { mediaTools } from "../core/process/workers.ts";

const [out] = process.argv.slice(2);
if (out) mkdirSync(out, { recursive: true });
if (process.platform !== "win32") {
  console.log("skip - this builds its stand-in with the Windows compiler");
  process.exit(0);
}
execFileSync("npm", ["run", "build"], {
  stdio: "ignore",
  shell: true,
  windowsHide: true,
});

const root = mkdtempSync(join(tmpdir(), "yamakan-kaggle-screens-"));
const wan = KAGGLE_RECIPES[0];
const USERNAME = "someone";
const step = (name) => console.log(`ok - ${name}`);

// The service needs a program it can run directly: this hands on to the script.
const launcher = join(root, "fake-kaggle.cs");
const program = join(root, "fake-kaggle.exe");
writeFileSync(
  launcher,
  `using System; using System.Diagnostics; using System.Linq;
class P { static int Main(string[] a) {
  var s = new ProcessStartInfo(Environment.GetEnvironmentVariable("KAGGLE_FAKE_NODE"));
  s.Arguments = "\\"" + Environment.GetEnvironmentVariable("KAGGLE_FAKE_SCRIPT") + "\\" " + string.Join(" ", a.Select(x => "\\"" + x + "\\""));
  s.UseShellExecute = false; s.RedirectStandardOutput = true; s.RedirectStandardError = true;
  var p = Process.Start(s);
  var e = p.StandardError.ReadToEndAsync();
  Console.Out.Write(p.StandardOutput.ReadToEnd());
  Console.Error.Write(e.Result);
  p.WaitForExit();
  return p.ExitCode;
} }`,
);
execFileSync(
  join(
    process.env.WINDIR,
    "Microsoft.NET",
    "Framework64",
    "v4.0.30319",
    "csc.exe",
  ),
  ["/nologo", `/out:${program}`, launcher],
  { windowsHide: true, stdio: "ignore" },
);

// A still made here, of no one, for the picture scene.
const stillFile = join(root, "still.png");
execFileSync(
  mediaTools().ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=64x48:rate=1:duration=1",
    "-frames:v",
    "1",
    stillFile,
  ],
  { windowsHide: true },
);

const videoFile = join(root, "made.mp4");
execFileSync(
  mediaTools().ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=64x48:rate=24:duration=0.5",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    videoFile,
  ],
  { windowsHide: true },
);
const video = {
  file: videoFile,
  output: wan.output,
  frames: wan.frames,
  sha256: createHash("sha256").update(readFileSync(videoFile)).digest("hex"),
};

let port = 24500;
let browser;
let passed = false;
let child = null;

const stopService = () =>
  new Promise((done) => {
    if (!child || child.exitCode !== null || child.signalCode !== null)
      return done();
    child.once("exit", done);
    child.kill("SIGKILL");
  });

// One scene: a workspace of its own, since a send really does hold the notebook for minutes.
async function scene(name, initial, play) {
  const folder = join(root, name);
  mkdirSync(folder);
  const file = join(folder, "scene.json");
  writeFileSync(
    file,
    JSON.stringify({
      state: "RUNNING",
      push: "ok",
      pushes: [],
      remote: `${USERNAME}/${wan.slug}`,
      video,
      ...initial,
    }),
  );
  const set = (patch) =>
    writeFileSync(
      file,
      JSON.stringify({
        ...JSON.parse(readFileSync(file, "utf8")),
        ...patch,
      }),
    );
  const read = () => JSON.parse(readFileSync(file, "utf8"));
  const scratch = join(folder, "tmp");
  mkdirSync(scratch);
  const thisPort = ++port;
  // Every push tried, whatever became of it. The engine refuses a second before the
  // stand-in could record it, so what it recorded could not show one being tried.
  const attempts = () =>
    readFileSync(`${file}.log`, "utf8")
      .split("\n")
      .filter((line) => line === "kernels push").length;
  const start = async () => {
    let log = "";
    child = fork(
      fileURLToPath(new URL("../server/main.ts", import.meta.url)),
      [],
      {
        env: {
          ...process.env,
          // Its own temporary folder: a sweep of the real one could take a real video.
          TEMP: scratch,
          TMP: scratch,
          YAMAKAN_WORKSPACE: join(folder, "workspace"),
          YAMAKAN_PORT: String(thisPort),
          YAMAKAN_KAGGLE_CLI: program,
          YAMAKAN_KAGGLE_USERNAME: USERNAME,
          KAGGLE_FAKE_NODE: process.execPath,
          KAGGLE_FAKE_SCRIPT: fileURLToPath(
            new URL("./fixtures/fake-kaggle.mjs", import.meta.url),
          ),
          KAGGLE_FAKE_SCENE: file,
        },
        silent: true,
        windowsHide: true,
      },
    );
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
  };
  const link = async () => {
    const { writeLaunchLink } = await import("../core/launch.ts");
    await writeLaunchLink(
      join(folder, "workspace"),
      `http://127.0.0.1:${thisPort}`,
    );
    return readFileSync(join(folder, "workspace", "launch"), "utf8")
      .split("\n")[0]
      .trim();
  };
  await start();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(await link());
  await page.waitForFunction(() => location.hash === "");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-panel").waitFor();
  await page.getByTestId("create-prompt").fill("A red kite.");
  const startRun = async () => {
    await page.getByTestId("create-agree").check();
    await page.getByTestId("create-generate-start").click();
  };
  const runState = page.getByTestId("create-run-state");
  const reopen = async () => {
    await page.goto("about:blank");
    await page.goto(await link());
    await page.waitForFunction(() => location.hash === "");
    await page
      .getByRole("button", { name: /revision/i })
      .first()
      .click();
    await page.getByRole("tab", { name: "Create", exact: true }).click();
    await page.getByTestId("create-panel").waitFor();
  };
  const restart = async () => {
    await stopService();
    await start();
    await reopen();
  };
  const stateIs = (state) =>
    page.waitForFunction(
      (want) =>
        document.querySelector('[data-testid="create-run-state"]')?.dataset
          .state === want,
      state,
      { timeout: 90_000 },
    );
  await play({
    page,
    set,
    read,
    attempts,
    startRun,
    runState,
    restart,
    stateIs,
    reopen,
  });
  if (out) await page.screenshot({ path: join(out, `${name}.png`) });
  assert.deepEqual(pageErrors, [], name);
  await page.close();
  await stopService();
}

try {
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });

  await scene(
    "quota",
    { push: "quota" },
    async ({ page, read, attempts, startRun, reopen }) => {
      await startRun();
      const refusal = page.locator(".create-problem");
      await refusal.waitFor({ timeout: 90_000 });
      assert.match(
        await refusal.textContent(),
        /Maximum weekly GPU quota of 30\.00 hours reached/,
      );
      assert.doesNotMatch(await refusal.textContent(), /outdated/);
      assert.equal(await page.getByTestId("create-run-state").count(), 0);
      assert.equal(read().pushes.length, 0);
      await reopen();
      await page.getByTestId("create-agree").waitFor();
      assert.equal(await page.getByTestId("create-run-state").count(), 0);
      assert.equal(attempts(), 1);
      step("a refusal shows Kaggle's own words, with nothing left to follow");
    },
  );

  for (const [name, landed] of [
    ["lost", 1],
    ["lost-before", 0],
  ])
    await scene(
      name,
      { push: name },
      async ({ page, read, attempts, runState, startRun, restart }) => {
        const UNCERTAIN = /It is not known whether this reached Kaggle/;
        await startRun();
        await runState.waitFor({ timeout: 90_000 });
        assert.match(await runState.textContent(), UNCERTAIN);
        assert.equal(read().pushes.length, landed);
        assert.equal(attempts(), 1);
        step(
          `${name}: no clear answer is said to be that, and is not sent again`,
        );

        await restart();
        await runState.waitFor({ timeout: 60_000 });
        assert.match(await runState.textContent(), UNCERTAIN);
        // Long enough for the page to have asked again, and acted on what it heard.
        await page.waitForTimeout(30_000);
        assert.match(await runState.textContent(), UNCERTAIN);
        assert.equal(attempts(), 1);
        step(
          `${name}: after a restart it says the same, and is not sent again`,
        );

        await page.getByTestId("create-run-stop").click();
        await page.getByTestId("create-run-done").waitFor();
        assert.match(
          await runState.textContent(),
          /No longer following this run/,
        );
        const said = await page.getByTestId("create-generate").textContent();
        assert.match(said, /It may still be running on Kaggle/);
        assert.equal(attempts(), 1);
        step(`${name}: Stop following does not claim Kaggle stopped`);
      },
    );

  await scene(
    "stop-running",
    {},
    async ({ page, attempts, startRun, stateIs, runState, reopen }) => {
      await startRun();
      await runState.waitFor({ timeout: 90_000 });
      await stateIs("running");
      await page.getByTestId("create-run-stop").click();
      await page.getByTestId("create-run-done").waitFor();
      // What the service recorded, not only what this page remembers.
      await page.waitForTimeout(1000);
      await reopen();
      await runState.waitFor({ timeout: 60_000 });
      assert.match(
        await runState.textContent(),
        /No longer following this run/,
      );
      assert.match(
        await page.getByTestId("create-generate").textContent(),
        /It may still be running on Kaggle/,
      );
      assert.equal(attempts(), 1);
      step(
        "a stop on a run under way stays after a reload, and says it may go on",
      );
    },
  );

  await scene(
    "failed",
    {},
    async ({ page, set, attempts, startRun, stateIs, runState }) => {
      await startRun();
      await runState.waitFor({ timeout: 90_000 });
      await stateIs("running");
      assert.equal(await page.getByTestId("create-run-stop").count(), 1);
      step("a run shows as running, with a way to stop following it");
      set({ state: "ERROR" });
      await stateIs("failed");
      assert.match(
        await page.getByTestId("create-run-note").textContent(),
        /failed on Kaggle/,
      );
      assert.match(
        await page.getByTestId("create-generate").textContent(),
        /No video came of this/,
      );
      assert.equal(await page.getByTestId("create-run-bring-in").count(), 0);
      assert.equal(
        await page
          .getByTestId("create-generate")
          .getByRole("link")
          .getAttribute("href"),
        `https://www.kaggle.com/code/${USERNAME}/${wan.slug}`,
      );
      await page.getByTestId("create-run-done").click();
      await page.getByTestId("create-generate-start").waitFor();
      await page.waitForTimeout(5000);
      assert.equal(attempts(), 1, "trying again is a person's to do");
      step(
        "a failed run says so, links its notebook, and sends nothing itself",
      );
    },
  );

  await scene(
    "finished",
    {},
    async ({ page, set, attempts, startRun, runState, stateIs, restart }) => {
      await startRun();
      await runState.waitFor({ timeout: 90_000 });
      await stateIs("running");
      await restart();
      await runState.waitFor({ timeout: 60_000 });
      await stateIs("running");
      assert.equal(attempts(), 1);
      step("a run under way survives the service being killed");
      set({ state: "COMPLETE" });
      await stateIs("succeeded");
      await page.getByTestId("create-run-bring-in").click();
      await page
        .getByTestId("create-video")
        .first()
        .waitFor({ timeout: 90_000 });
      assert.match(
        await page.getByTestId("create-receipt-facts").textContent(),
        /A red kite/,
      );
      assert.equal(attempts(), 1);
      step("once finished, its video comes in with its prompt");
    },
  );

  await scene(
    "answer-lost",
    {},
    async ({ page, attempts, startRun, runState }) => {
      // The service answers, and the page never hears it.
      let lost = 0;
      await page.route("**/api/v1/call", async (route) => {
        const body = route.request().postData() ?? "";
        if (body.includes('"yamakan.generation.start"')) {
          lost++;
          await route.fetch().catch(() => {});
          await route.abort();
        } else await route.continue();
      });
      await startRun();
      await runState.waitFor({ timeout: 90_000 });
      assert.equal(lost, 1, "its answer really was lost");
      assert.equal(attempts(), 1);
      await page.unroute("**/api/v1/call");
      assert.equal(await page.locator(".create-problem").count(), 0);
      step("a start whose answer is lost finds its run, and shows no failure");
    },
  );

  // Image-to-video is not offered, so the service lists no picture model. Only this page's
  // view of that answer is changed, to offer one: what the page then does is what is
  // checked, and the service still refuses the recipe, so nothing is sent.
  await scene("picture", {}, async ({ page, read, reopen }) => {
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await page.getByLabel("Import local media").setInputFiles(stillFile);
    await page
      .getByRole("status")
      .filter({ hasText: /Imported \W?still\.png/ })
      .waitFor();
    const starts = [];
    // What the handler found, asserted after: a throw inside it would only leave the page waiting.
    const offered = {};
    await page.route("**/api/v1/call", async (route) => {
      const body = route.request().postData() ?? "";
      if (body.includes('"yamakan.generation.start"'))
        starts.push(JSON.parse(body));
      if (!body.includes('"yamakan.generation.options"'))
        return route.continue();
      const response = await route.fetch();
      const answer = await response.json();
      const holder = (function find(o) {
        if (o && typeof o === "object") {
          if (Array.isArray(o.models)) return o;
          for (const v of Object.values(o)) {
            const found = find(v);
            if (found) return found;
          }
        }
        return null;
      })(answer);
      const text = holder?.models.find((m) => m.recipeId === wan.id);
      offered.listed = Boolean(text);
      offered.servicePicture = Boolean(
        holder?.models.some((m) => m.operation === "imageToVideo"),
      );
      if (text)
        holder.models.push({
          ...text,
          recipeId: "kaggle-wan22-ti2v-5b-first-frame",
          operation: "imageToVideo",
        });
      await route.fulfill({ response, json: answer });
    });
    await reopen();
    await page.getByTestId("create-agree").waitFor();
    assert.equal(offered.listed, true, "the text recipe is offered");
    assert.equal(
      offered.servicePicture,
      false,
      "the service itself offers no picture model",
    );
    const picture = page.getByTestId("create-picture");
    const agree = page.getByTestId("create-agree");
    const noPerson = page.getByTestId("create-no-person");
    const start = page.getByTestId("create-generate-start");
    await picture.waitFor();
    assert.equal(await noPerson.count(), 0, "no second tick without a picture");
    const stillId = await picture
      .locator("option", { hasText: "still.png" })
      .getAttribute("value");
    assert.ok(stillId, "the project's still is listed");
    await picture.selectOption(stillId);
    assert.match(
      await page.locator(".create-agree").last().textContent(),
      /picture leave this computer/,
    );
    await agree.check();
    assert.equal(await start.isDisabled(), true, "one tick is not enough");
    await noPerson.check();
    assert.equal(await start.isDisabled(), false);
    step(
      "a picture run needs both ticks, and its agreement says the picture leaves",
    );

    // Away to a model with no picture recipe, a tick there, and back.
    const model = page.getByTestId("create-model");
    const wanModel = await model.inputValue();
    const other = await model
      .locator("option")
      .evaluateAll(
        (options, current) =>
          options.map((o) => o.value).find((v) => v !== current),
        wanModel,
      );
    await model.selectOption(other);
    assert.equal(await picture.count(), 0, "no picture for that model");
    assert.equal(
      await agree.isChecked(),
      false,
      "its agreement is asked again",
    );
    await agree.check();
    await model.selectOption(wanModel);
    await picture.waitFor();
    assert.equal(await picture.inputValue(), stillId);
    assert.equal(await agree.isChecked(), false, "ticked for another choice");
    // The word about this very picture, on this very recipe, still stands.
    assert.equal(await noPerson.isChecked(), true);
    assert.equal(await start.isDisabled(), true);
    step(
      "the agreement is asked again after a switch of model, and the word about the same picture stands",
    );

    await agree.check();
    await start.click();
    const problem = page.locator(".create-problem");
    await problem.waitFor({ timeout: 90_000 });
    assert.match(await problem.textContent(), /That recipe is not available/);
    assert.equal(starts.length, 1);
    const sent = starts[0].parameters;
    assert.equal(sent.recipeId, "kaggle-wan22-ti2v-5b-first-frame");
    assert.equal(sent.firstFrameAssetId, stillId);
    assert.equal(sent.noUnconsentedPerson, true);
    assert.equal(read().pushes.length, 0, "the service sent nothing");
    assert.equal(await page.getByTestId("create-run-state").count(), 0);
    await page.unroute("**/api/v1/call");
    step(
      "the start names the still and the person's word; the service refuses the recipe",
    );
  });

  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  await stopService();
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    // Windows can still hold a folder: tidying up is not what this tests.
  }
}
console.log(passed ? "SCREENS PASS" : "SCREENS FAIL");
process.exit(passed ? 0 : 1);
