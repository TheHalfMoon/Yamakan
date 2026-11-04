/**
 * SS-013: the caption editor by keyboard in a real browser against the real
 * service. Times and text are edited from the keyboard, an emptied time keeps
 * its value, focus survives a save, a refusal and a discard, mixed-script text
 * reads in its own direction, and the edit survives a reopen.
 *
 * Usage: node scripts/qualify-captions-keyboard.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-captions-"));
const port = 24394;
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

const SRT = [
  "1\n00:00:01,000 --> 00:00:02,000\nمرحبا بالعالم",
  "2\n00:00:03,000 --> 00:00:04,000\nHello world",
  "3\n00:00:05,000 --> 00:00:06,000\nالنص mixed 123 نهاية",
].join("\n\n");

const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
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
  const external = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url()))
      external.push(r.url());
  });

  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill("Captions");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name: "Captions", exact: true }).waitFor();
  const openFinish = async () => {
    await page.getByRole("tab", { name: "Finish", exact: true }).click();
    await page.getByTestId("captions-panel").waitFor();
  };
  await openFinish();
  await page.getByTestId("captions-file").setInputFiles({
    name: "cues.srt",
    mimeType: "application/x-subrip",
    buffer: Buffer.from(SRT),
  });
  await page.getByTestId("captions-editor").waitFor({ timeout: 15_000 });

  const start = (n) => page.getByLabel(`Start of cue ${n}`, { exact: true });
  const end = (n) => page.getByLabel(`End of cue ${n}`, { exact: true });
  const save = page.getByTestId("captions-save");
  const focused = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        tag: a?.tagName,
        label: a?.getAttribute("aria-label"),
        testId: a?.getAttribute("data-testid"),
        text: a?.textContent?.trim().slice(0, 40),
      };
    });
  const typeInto = async (field, value) => {
    await field.focus();
    await page.keyboard.press("Control+A");
    if (value === "") await page.keyboard.press("Delete");
    else await page.keyboard.type(value);
    await page.keyboard.press("Tab");
  };
  // A command has finished: the panel's fields are enabled again.
  const settled = () =>
    page.waitForFunction(
      () => !document.querySelector('[data-testid="captions-text"]')?.disabled,
    );

  await typeInto(start(2), "3.25");
  assert.equal(await start(2).inputValue(), "3.250");
  assert.equal((await focused()).label, "End of cue 2");
  await page.keyboard.press("Shift+Tab");
  assert.equal((await focused()).label, "Start of cue 2");
  step("a time is edited and left by keyboard, in order", {
    value: "3.250",
  });

  await typeInto(start(1), "");
  assert.equal(await start(1).inputValue(), "1.000");
  await typeInto(start(1), "-5");
  assert.equal(await start(1).inputValue(), "1.000");
  step("an emptied or negative time keeps the time it had");

  await typeInto(end(1), "3.5");
  await save.focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("captions-error").waitFor();
  await settled();
  const refused = await page.getByTestId("captions-error").innerText();
  assert.match(refused, /overlap/);
  assert.equal((await focused()).testId, "captions-save");
  assert.equal(await end(1).inputValue(), "3.500");
  step("a refused save says why, keeps the edit and keeps focus", { refused });

  await typeInto(end(1), "2");
  await save.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector('[data-testid="captions-save"]')?.disabled,
  );
  await settled();
  await page.waitForFunction(() => document.activeElement !== document.body);
  assert.equal((await focused()).tag, "H3");
  assert.equal(await page.getByTestId("captions-error").count(), 0);
  step("a saved edit returns focus to the panel, not the page");

  const texts = await page
    .getByTestId("captions-text")
    .evaluateAll((all) =>
      all.map((e) => [e.value, getComputedStyle(e).direction]),
    );
  assert.deepEqual(
    texts.map(([, d]) => d),
    ["rtl", "ltr", "rtl"],
  );
  step("Arabic, Latin and mixed text each read in their own direction", {
    texts,
  });

  const text = page.getByTestId("captions-text").nth(1);
  await text.focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" again");
  assert.equal((await focused()).label, "Text of cue 2");
  assert.equal(await text.inputValue(), "Hello world again");
  const discard = page.getByRole("button", {
    name: "Discard edits",
    exact: true,
  });
  await discard.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement !== document.body);
  assert.equal(await text.inputValue(), "Hello world");
  assert.equal((await focused()).tag, "H3");
  step("text is edited by keyboard, and a discard keeps focus in the panel");

  // Arabic and mixed cues take typed text at the caret, in their own direction.
  for (const [n, typed] of [
    [0, " جديد"],
    [2, " new نص"],
  ]) {
    const field = page.getByTestId("captions-text").nth(n);
    const before = await field.inputValue();
    await field.focus();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(typed);
    assert.equal(await field.inputValue(), `${before}${typed}`);
    assert.equal(
      await field.evaluate((e) => getComputedStyle(e).direction),
      "rtl",
    );
  }
  await discard.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement !== document.body);
  step("Arabic and mixed text take typed text in their own direction");

  await page.reload();
  await page
    .getByRole("button", { name: /Captions/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Finish", exact: true }).click();
  await page.getByTestId("captions-panel").waitFor();
  await page.getByTestId("captions-track").selectOption({ index: 1 });
  await page.getByTestId("captions-editor").waitFor();
  assert.equal(await start(2).inputValue(), "3.250");
  step("the saved time survives a reopen");

  await page.locator(".language").first().click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  const label = await page
    .locator("[data-testid=captions-editor] input[type=number]")
    .first()
    .getAttribute("aria-label");
  assert.ok(/[؀-ۿ]/.test(label), label);
  step("the time fields are named in Arabic when the interface is Arabic", {
    label,
  });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(external, []);
  step("no page errors and no external requests");
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
          task: "SS-013",
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
console.log(passed ? "CAPTIONS KEYBOARD PASS" : "CAPTIONS KEYBOARD FAIL");
process.exit(passed ? 0 : 1);
