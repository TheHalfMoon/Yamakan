/**
 * The Create workspace in a real browser against the real service: a shot written
 * and kept across a reload, nothing offering to run a model while nothing can, a
 * wrong receipt refused, the right one accepted, the video placed, opened in Edit
 * and exported through the real pipeline.
 *
 * Its default clip is a test pattern with a receipt written here: this qualifies
 * the path, and no output of it is AI-generated unless a real video is given.
 *
 * Usage: node scripts/qualify-create-workspace.mjs [out-folder] [video receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mediaTools } from "../core/process/workers.ts";

const [out, givenVideo, givenReceipt] = process.argv.slice(2);
execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});
const root = mkdtempSync(join(tmpdir(), "yamakan-create-"));
if (out) mkdirSync(out, { recursive: true });
const port = 24432;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
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
let log = "";
child.stderr.on("data", (c) => (log += String(c)));

const made = join(root, "test-pattern.mp4");
const video = givenVideo ?? made;
if (!givenVideo)
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=704x480:rate=24:duration=6",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      made,
    ],
    { windowsHide: true },
  );
const sha = createHash("sha256").update(readFileSync(video)).digest("hex");
const receiptPath = join(root, "receipt.json");
if (givenReceipt) writeFileSync(receiptPath, readFileSync(givenReceipt));
else
  writeFileSync(
    receiptPath,
    JSON.stringify({
      format: "yamakan.generation-receipt/v1",
      stage: "done",
      model: "test-pattern",
      revision: "none",
      prompt: "A test pattern, not a generated video.",
      seed: 1,
      steps: 1,
      sha256: sha,
      verified: true,
    }),
  );
const wrongPath = join(root, "wrong.json");
writeFileSync(
  wrongPath,
  JSON.stringify({
    ...JSON.parse(readFileSync(receiptPath, "utf8")),
    sha256: "0".repeat(64),
  }),
);
const failedPath = join(root, "failed.json");
writeFileSync(
  failedPath,
  JSON.stringify({
    ...JSON.parse(readFileSync(receiptPath, "utf8")),
    stage: "failed at generating",
  }),
);

let browser;
let passed = false;
try {
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
  await writeLaunchLink(join(root, "workspace"), `http://127.0.0.1:${port}`);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(
    readFileSync(join(root, "workspace", "launch"), "utf8")
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  const shot = async (name) => {
    if (out) await page.screenshot({ path: join(out, `${name}.png`) });
  };
  // Pixels against a picture kept in the repository, one set per system since fonts draw
  // differently. A check that it has not moved, not that it reads or looks right: only a
  // person can say that. YAMAKAN_UPDATE_BASELINES=1 replaces the picture.
  const BASELINES = fileURLToPath(
    new URL(`../docs/evidence/baselines/${process.platform}/`, import.meta.url),
  );
  const matchesBaseline = async (name, locator) => {
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
    });
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForFunction(() =>
      [...document.images].every((image) => image.complete),
    );
    const now = await locator.screenshot();
    const kept = join(BASELINES, `${name}.png`);
    if (process.env.YAMAKAN_UPDATE_BASELINES === "1") {
      mkdirSync(BASELINES, { recursive: true });
      writeFileSync(kept, now);
      step(`replaced ${name}`);
      return;
    }
    // A system with no pictures at all is not compared, and says so without a pass. One
    // that has them must have this one: losing a picture must not turn the check off.
    if (!existsSync(BASELINES)) {
      console.log(`skip - no ${process.platform} pictures to compare ${name}`);
      return;
    }
    assert.ok(existsSync(kept), `no picture of ${name}`);
    const { different, total, sameSize } = await page.evaluate(
      async ([a, b]) => {
        const read = async (base64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, canvas.width, canvas.height);
        };
        const [one, two] = [await read(a), await read(b)];
        if (one.width !== two.width || one.height !== two.height)
          return { different: 0, total: 0, sameSize: false };
        let count = 0;
        for (let i = 0; i < one.data.length; i += 4)
          if (
            Math.abs(one.data[i] - two.data[i]) > 8 ||
            Math.abs(one.data[i + 1] - two.data[i + 1]) > 8 ||
            Math.abs(one.data[i + 2] - two.data[i + 2]) > 8
          )
            count++;
        return {
          different: count,
          total: one.data.length / 4,
          sameSize: true,
        };
      },
      [readFileSync(kept).toString("base64"), now.toString("base64")],
    );
    const share = sameSize ? different / total : 1;
    // Runs here match to the pixel, so this can be tight: a changed word must show.
    if (share > 0.0001) {
      if (out) writeFileSync(join(out, `${name}-now.png`), now);
      assert.fail(
        `${name} has moved from its picture: ${sameSize ? `${different} of ${total} pixels` : "another size"}`,
      );
    }
    step(`${name} matches its picture, ${different} of ${total} pixels apart`);
  };

  const noSideways = async (where) => {
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    assert.ok(scroll <= client, `${where}: ${scroll} wide in ${client}`);
  };

  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  const panel = page.getByTestId("create-panel");
  await panel.waitFor();
  step("the Create workspace opens on a project");

  const prompt = page.getByTestId("create-prompt");
  await prompt.fill("A paper boat floats slowly along a calm stream.");
  await page.getByTestId("create-direction-shot").selectOption("wide");
  await page.getByTestId("create-direction-movement").selectOption("pan");
  await page.getByTestId("create-model").selectOption("zai-org/CogVideoX-2b");
  await page.getByTestId("create-seed").fill("7");
  const final = page.getByTestId("create-final-prompt");
  assert.equal(
    await final.textContent(),
    "A paper boat floats slowly along a calm stream. wide shot, slow pan.",
  );
  assert.match(
    await page.getByTestId("create-model-facts").textContent(),
    /720x480, 49 frames at 8 fps/,
  );
  assert.match(await panel.textContent(), /only add words to the prompt/);
  step("what a model would be given is shown, with what direction really does");

  const engine = page.getByTestId("create-engine");
  await engine.getByText("cannot run a model").waitFor();
  const offers = await page
    .locator("button, a, [role=button], [role=menuitem]")
    .filter({ hasText: /generate/i })
    .count();
  assert.equal(offers, 0, "nothing offers to generate");
  step("while nothing can run, it says so and nothing offers to");

  await page.reload();
  await page.waitForFunction(() => location.hash === "");
  await page
    .getByRole("button", { name: /revision/i })
    .first()
    .click();
  await page.getByTestId("create-panel").waitFor();
  assert.equal(
    await page.getByTestId("create-prompt").inputValue(),
    "A paper boat floats slowly along a calm stream.",
  );
  assert.equal(await page.getByTestId("create-seed").inputValue(), "7");
  assert.equal(
    await page.getByTestId("create-direction-movement").inputValue(),
    "pan",
  );
  step("the shot is still there after a reload");
  await shot("create-1440-empty");
  await noSideways("1440");

  const videoCount = () => page.getByTestId("create-video").count();
  const bringIn = async (receipt) => {
    await page
      .getByTestId("create-receipt")
      .setInputFiles(receipt ? receipt : []);
    await page.getByTestId("create-video-file").setInputFiles(video);
  };
  await bringIn(wrongPath);
  await page.getByRole("alert").getByText("not the file").waitFor();
  assert.equal(await videoCount(), 0);
  await page.getByTestId("create-receipt-clear").click();
  assert.equal(await page.getByRole("alert").count(), 0, "cleared with it");
  assert.equal(await page.getByTestId("create-receipt").inputValue(), "");
  step("a video that is not the receipt's file is refused");
  await bringIn(failedPath);
  await page.getByRole("alert").getByText("did not finish").waitFor();
  assert.equal(await videoCount(), 0);
  step("a receipt from an unfinished run is refused");

  await bringIn(receiptPath);
  await page.getByTestId("create-video").first().waitFor({ timeout: 60_000 });
  await page
    .getByTestId("create-notice")
    .getByText("matches its receipt")
    .waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "the refusal cleared");
  assert.match(
    await page.getByTestId("create-receipt-facts").textContent(),
    /hash matched its receipt when it came in/,
  );
  step("the right video comes in, with what its receipt says", {
    file: basename(video),
    sha256: sha,
  });
  await shot("create-1440-video");

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

  // What a receipt says is in the project, not this browser.
  await page.waitForTimeout(1000);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => location.hash === "");
  await page
    .getByRole("button", { name: /revision/i })
    .first()
    .click();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-video").first().waitFor();
  assert.match(
    await page.getByTestId("create-receipt-facts").textContent(),
    /hash matched its receipt when it came in/,
  );
  step(
    "what the receipt showed stays with the project, with this browser's storage cleared",
  );

  await page.getByTestId("create-place").click();
  await page.getByTestId("create-open-edit").click();
  assert.equal(
    await page.locator('[role="tab"][aria-selected="true"]').textContent(),
    "Edit",
  );
  const clip = page.locator("[data-clip-id]").first();
  await clip.waitFor({ timeout: 30_000 });
  step("placed, it shows on the Edit timeline");

  // The toolbar's own export, and what it really wrote.
  const listed = await service("yamakan.project.list", {});
  const projectId = (listed.projects ?? listed)[0].id;
  let project;
  for (let i = 0; i < 50; i++) {
    project = await service("yamakan.project.open", { projectId });
    if (project.clips.length === 1) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(project.clips.length, 1, "the clip is saved in the project");
  // Placed whole: a clip placed from the media list stops at 5 seconds.
  const source = project.assets.find((a) => a.id === project.clips[0].assetId);
  assert.equal(project.clips[0].durationFrames, source.durationFrames);
  if (!givenVideo) assert.ok(source.durationFrames > 150, "longer than 5 s");
  step("the whole video is placed", { frames: source.durationFrames });
  await page
    .getByRole("button", { name: /^Export/ })
    .first()
    .click();
  let job;
  for (let i = 0; i < 600; i++) {
    const listed = await service("yamakan.job.list", {});
    job = (listed.jobs ?? listed).find((j) => j.projectId === projectId);
    if (job && ["COMPLETED", "FAILED"].includes(job.state)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(job?.state, "COMPLETED", job?.error ?? "no export job");
  const exported = readdirSync(join(root, "workspace"), { recursive: true })
    .map(String)
    .find((f) => f.replaceAll("\\", "/").endsWith(job.artifact));
  assert.ok(exported, "the export is in the workspace");
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
        join(root, "workspace", exported),
      ],
      { windowsHide: true, encoding: "utf8" },
    ),
  ).streams[0];
  assert.equal(probe.codec_name, "h264");
  assert.ok(Number(probe.nb_read_frames) > 0);
  step("the toolbar's export finishes, a decodable H.264 file", {
    width: probe.width,
    height: probe.height,
    frames: Number(probe.nb_read_frames),
  });

  // A file that is converted on the way in: the stored copy is not what was checked.
  const vfr = join(root, "variable.mp4");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x240:rate=30:duration=1",
      "-vf",
      "select='not(mod(n,5))+gt(n,20)',setpts='if(lt(N,5),N*6,N*2)/30/TB'",
      "-fps_mode",
      "vfr",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      vfr,
    ],
    { windowsHide: true },
  );
  const vfrReceipt = join(root, "variable.json");
  writeFileSync(
    vfrReceipt,
    JSON.stringify({
      format: "yamakan.generation-receipt/v1",
      stage: "done",
      verified: true,
      model: "test-pattern",
      revision: "none",
      prompt: "A variable-rate test pattern.",
      seed: 2,
      steps: 1,
      sha256: createHash("sha256").update(readFileSync(vfr)).digest("hex"),
    }),
  );
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  await page.getByTestId("create-receipt").setInputFiles(vfrReceipt);
  await page.getByTestId("create-video-file").setInputFiles(vfr);
  await page
    .getByTestId("create-notice")
    .getByText("was then converted")
    .waitFor({ timeout: 120_000 });
  const cards = page.getByTestId("create-video");
  assert.equal(await cards.count(), 2);
  const converted = cards.filter({ hasText: "variable.mp4" });
  await converted.getByText("This is a converted copy").waitFor();
  step("a converted file says the original matched, not that this copy did");
  await page.reload();
  await page.waitForFunction(() => location.hash === "");
  await page
    .getByRole("button", { name: /revision/i })
    .first()
    .click();
  await page.getByTestId("create-video").first().waitFor();
  await page
    .getByTestId("create-video")
    .filter({ hasText: "variable.mp4" })
    .getByText("This is a converted copy")
    .waitFor({ timeout: 30_000 });
  step("that stays true after a reload");

  // Everything in the panel can be reached by keyboard, in a sensible order.
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  // The draft went with this browser's storage, and Copy needs something to copy.
  await page.getByTestId("create-prompt").fill("A paper boat.");
  await page.getByTestId("create-prompt").focus();
  const reached = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    reached.push(
      await page.evaluate(() => document.activeElement?.dataset?.testid ?? ""),
    );
  }
  for (const id of [
    "create-direction-shot",
    "create-direction-movement",
    "create-direction-lens",
    "create-direction-light",
    "create-model",
    "create-seed",
    "create-copy",
    "create-receipt",
    "create-bring-in",
  ])
    assert.ok(reached.includes(id), `${id} by keyboard: ${reached}`);
  assert.ok(
    reached.indexOf("create-model") < reached.indexOf("create-bring-in"),
    "reading order",
  );
  step("the main controls are reached by keyboard, in order");

  const unnamed = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-testid="create-panel"] :is(input,select,textarea)',
      ),
    ]
      .filter(
        (el) =>
          !el.hidden && !el.labels?.length && !el.getAttribute("aria-label"),
      )
      .map((el) => el.dataset.testid),
  );
  assert.deepEqual(unnamed, [], "every field has a name");
  step("every field has a name");

  // Places and props: kept and pinned, and said not to reach a model.
  const stillOf = (name, colour) => {
    const file = join(root, name);
    execFileSync(
      mediaTools().ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        `color=c=${colour}:s=320x200`,
        "-frames:v",
        "1",
        file,
      ],
      { windowsHide: true },
    );
    return file;
  };
  const elements = page.getByTestId("create-elements");
  // The kind a person chooses to say a character is made up.
  assert.equal(
    await page
      .getByTestId("create-element-role")
      .locator('option[value="fictional-character"]')
      .textContent(),
    "Drawn or made-up character",
  );
  assert.match(
    await page.getByTestId("create-elements-note").textContent(),
    /not sent to a model/,
  );
  assert.equal(await page.getByTestId("create-element-add").isDisabled(), true);
  await page.getByTestId("create-element-name").fill("The harbour");
  const notAnImage = join(root, "not-an-image.txt");
  writeFileSync(notAnImage, "words");
  // Through the button a person presses, then the picker.
  const pick = async (control, file) => {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      control.click(),
    ]);
    await chooser.setFiles(file);
  };
  await pick(page.getByTestId("create-element-add"), notAnImage);
  assert.match(await elements.getByRole("alert").textContent(), /PNG or JPEG/);
  assert.equal(await page.getByTestId("create-element").count(), 0);
  await pick(
    page.getByTestId("create-element-add"),
    stillOf("harbour.png", "navy"),
  );
  const element = page.getByTestId("create-element").first();
  await element.waitFor({ timeout: 60_000 });
  assert.match(await element.textContent(), /The harbour/);
  step("a place is kept from an image, and something else is refused");

  await page.getByTestId("create-element-pin").first().click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-element-pin"]')?.checked &&
      !document.querySelector('[data-testid="create-element-pin"]')?.disabled,
  );
  const reopen = async () => {
    await page.reload();
    await page.waitForFunction(() => location.hash === "");
    await page
      .getByRole("button", { name: /revision/i })
      .first()
      .click();
    await page.getByRole("tab", { name: "Create", exact: true }).click();
    await element.waitFor({ timeout: 30_000 });
  };
  await reopen();
  await page.getByTestId("create-element-pin").first().waitFor();
  assert.equal(
    await page.getByTestId("create-element-pin").first().isChecked(),
    true,
  );
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-testid="create-element"] img');
    return image?.complete && image.naturalWidth > 0;
  });
  step("it and its pin on a shot stay after a reload, with its image shown");

  await pick(
    page.getByTestId("create-element-more").first(),
    stillOf("harbour-2.jpg", "teal"),
  );
  await page
    .getByTestId("create-element-older")
    .first()
    .waitFor({ timeout: 60_000 });
  assert.equal(await element.locator("img").count(), 2);
  step(
    "another image makes a new version, and the shot says it holds an older one",
  );

  await page.getByTestId("create-element-pin").first().click();
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-testid="create-element-pin"]')?.checked &&
      !document.querySelector('[data-testid="create-element-pin"]')?.disabled,
  );
  await page.getByTestId("create-element-pin").first().click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-element-pin"]')?.checked &&
      !document.querySelector('[data-testid="create-element-pin"]')?.disabled,
  );
  assert.equal(await page.getByTestId("create-element-older").count(), 0);
  step("it comes off a shot, and pinned again holds the newest version");
  await matchesBaseline("create-elements-1440", elements);
  const unnamedHere = await elements.evaluate((panel) =>
    [...panel.querySelectorAll(":is(input,select)")]
      .filter(
        (el) =>
          !el.hidden && !el.labels?.length && !el.getAttribute("aria-label"),
      )
      .map((el) => el.dataset.testid),
  );
  assert.deepEqual(unnamedHere, [], "every field here has a name");
  await shot("create-elements");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("create-panel").waitFor();
  await noSideways("390");
  await shot("create-390");
  step("at phone width it fits, with no sideways scroll");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("button.language").click();
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  await noSideways("Arabic");
  await matchesBaseline("create-elements-1440-arabic", elements);
  await shot("create-1440-arabic");
  step("in Arabic it lays out right to left");

  assert.deepEqual(pageErrors, []);
  step("no page errors");
  passed = true;
} catch (e) {
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  if (out)
    writeFileSync(
      join(out, "receipt.json"),
      `${JSON.stringify(
        {
          task: "create-workspace",
          videoSource: givenVideo ? "supplied" : "test pattern",
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
  // The service must be gone before its folder can be. A folder Windows still holds
  // is left behind and said so: tidying up does not change what was found above.
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
console.log(passed ? "CREATE PASS" : "CREATE FAIL");
process.exit(passed ? 0 : 1);
