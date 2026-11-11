/**
 * The local prompt library (YouMind integration, Phase B), end to end against the real service
 * and in a real browser:
 *
 *   the service's yamakan.prompt.search and yamakan.prompt.fill through the SDK → the Create
 *   page's library: search in Arabic and English, a template's fields filled, its prompt put
 *   into the brief, another added, one written in Arabic replacing it, an over-long addition
 *   refused → the filled template kept as a project preset → the page in Arabic → after a
 *   reload, the preset still there, the brief's own words kept as a second, one used and one
 *   removed, and the project's presets document read back through the SDK → no request leaves this
 *   computer.
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
import { PROMPT_TEMPLATES } from "../core/prompts/library.ts";

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

const root = mkdtempSync(join(tmpdir(), "yamakan-prompt-library-"));
const workspace = join(root, "workspace");
const port = 24393;
const base = `http://127.0.0.1:${port}`;
const child = fork(
  fileURLToPath(new URL("../server/main.ts", import.meta.url)),
  [],
  {
    env: {
      ...process.env,
      YAMAKAN_WORKSPACE: workspace,
      YAMAKAN_PORT: String(port),
    },
    silent: true,
    windowsHide: true,
  },
);
let serverError = "";
child.stderr.on("data", (c) => (serverError += String(c)));

let browser;
const receipt = {
  qualification: "PROMPT_LIBRARY",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  clean,
  steps,
  passed: false,
};
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`startup: ${serverError}`)),
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
      reject(new Error(`exited ${code}: ${serverError}`));
    });
  });
  const token = readFileSync(join(workspace, "token"), "utf8").trim();
  const client = new YamakanClient({ baseUrl: base, token });

  // The service's own commands, as the CLI, an agent or MCP reach them.
  const searched = await client.call("yamakan.prompt.search", {
    query: "مطر",
  });
  assert.equal(searched.templates[0].id, "yamakan.rain-night-street");
  assert.match(searched.credit, /YouMind OpenLab/);
  const all = await client.call("yamakan.prompt.search", { limit: 100 });
  assert.equal(all.templates.length, PROMPT_TEMPLATES.length);
  const filled = await client.call("yamakan.prompt.fill", {
    templateId: "yamakan.rain-night-street",
    language: "ar",
    values: [{ field: "place", value: "حي قديم" }],
  });
  assert.match(filled.prompt, /^مطر يهطل على حي قديم ليلاً/);
  await assert.rejects(
    client.call("yamakan.prompt.fill", {
      templateId: "yamakan.rain-night-street",
      language: "en",
      values: [{ field: "nope", value: "x" }],
    }),
    /no field nope/,
  );
  step("service search and fill", {
    templates: all.templates.length,
    arabic: filled.prompt.slice(0, 40),
  });

  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(workspace, base);
  const launch = readFileSync(join(workspace, "launch"), "utf8")
    .split("\n")[0]
    .trim();
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const outside = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) &&
      !["data:", "blob:"].includes(url.protocol)
    )
      outside.push(url.origin);
  });

  await page.goto(launch);
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill("Library");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name: "Library", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Create", exact: true }).click();
  const library = page.getByTestId("prompt-library");
  await library.locator("summary").click();
  const count = () =>
    page.getByTestId("prompt-library-count").getAttribute("data-count");
  assert.equal(await count(), String(PROMPT_TEMPLATES.length));

  // Searched in Arabic; the best match first.
  await page.getByTestId("prompt-library-search").fill("المطر");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="prompt-library-list"] button')
        ?.getAttribute("data-template-id") === "yamakan.rain-night-street",
  );
  await page.locator('[data-template-id="yamakan.rain-night-street"]').click();
  await page.getByTestId("prompt-library-field-place").fill("a harbour road");
  const preview = page.getByTestId("prompt-library-preview");
  assert.match(await preview.textContent(), /^Rain falling on a harbour road/);
  await page.getByTestId("prompt-library-use").click();
  const prompt = page.getByTestId("create-prompt");
  const first = await prompt.inputValue();
  assert.equal(first, await preview.textContent());
  step("found in Arabic, filled, used", { prompt: first.slice(0, 50) });

  // Another template, by English words and a category, added to it.
  await page.getByTestId("prompt-library-search").fill("orbit");
  await page.getByTestId("prompt-library-category").selectOption("camera-move");
  await page.locator('[data-template-id="yamakan.orbit-hero"]').click();
  await page.getByTestId("prompt-library-add").click();
  const added = await prompt.inputValue();
  assert.ok(
    added.startsWith(first.replace(/[.,;:\s]+$/, "") + ". The camera orbits"),
  );
  step("another added", { length: added.length });

  // Written in Arabic, replacing the prompt.
  await page.getByTestId("prompt-library-language-ar").check();
  assert.match(
    await preview.textContent(),
    /^تدور الكاميرا ببطء حول تمثال في فناء/,
  );
  assert.equal(await preview.getAttribute("dir"), "rtl");
  await page.getByTestId("prompt-library-use").click();
  assert.equal(await prompt.inputValue(), await preview.textContent());
  step("written in Arabic, replaced");
  if (shots) await library.screenshot({ path: join(shots, "library-en.png") });

  // The filled template kept with the project, by name; a second of the same name is refused.
  const presets = page.getByTestId("prompt-presets");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="prompt-presets"]')
        ?.getAttribute("data-state") === "ready",
  );
  await page.getByTestId("prompt-preset-name").fill("Orbit, Arabic");
  await page.getByTestId("prompt-preset-save").click();
  await presets.locator('[data-preset-name="Orbit, Arabic"]').waitFor();
  await page.getByTestId("prompt-preset-name").fill("orbit, ARABIC");
  assert.equal(await page.getByTestId("prompt-preset-save").isDisabled(), true);
  await page.getByTestId("prompt-preset-name").fill("");
  const orbitArabic = await preview.textContent();
  step("a filled template kept as a preset; a same-named one refused");

  // Too long together: refused, the prompt unchanged.
  const long = "x".repeat(1990);
  await prompt.fill(long);
  await page.getByTestId("prompt-library-add").click();
  await page.getByTestId("create-problem").waitFor();
  assert.match(
    await page.getByTestId("create-problem").textContent(),
    /longer than 2,000 characters/,
  );
  assert.equal(await prompt.inputValue(), long);
  step("an over-long addition refused");

  // The page in Arabic: the library's words and titles are Arabic.
  await prompt.fill("A paper boat on a pond.");
  await page.getByRole("button", { name: "العربية" }).click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  assert.match(await library.locator("summary").textContent(), /مكتبة الأوصاف/);
  assert.match(
    await page
      .locator('[data-template-id="yamakan.orbit-hero"] strong')
      .textContent(),
    /دوران حول الموضوع/,
  );
  assert.match(
    await page
      .getByTestId("prompt-library-category")
      .locator("option:checked")
      .textContent(),
    /حركة الكاميرا/,
  );
  assert.match(
    await page.getByTestId("prompt-library-credit").textContent(),
    /YouMind OpenLab/,
  );
  if (shots) await library.screenshot({ path: join(shots, "library-ar.png") });
  step("shown in Arabic");

  // The brief is kept across a reload, as before.
  await page.reload();
  await page.waitForFunction(() => location.hash === "");
  await page.locator(".project-list button", { hasText: "Library" }).click();
  await page.getByRole("tab", { name: "إنشاء", exact: true }).click();
  await page.getByTestId("create-prompt").waitFor();
  assert.equal(
    await page.getByTestId("create-prompt").inputValue(),
    "A paper boat on a pond.",
  );
  step("brief kept across a reload");

  // The preset is still there; the brief's own words are kept as a second; one is used, the
  // other removed.
  await library.locator("summary").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="prompt-presets"]')
        ?.getAttribute("data-state") === "ready",
  );
  await presets.locator('[data-preset-name="Orbit, Arabic"]').waitFor();
  assert.equal(
    await page.getByTestId("prompt-preset-name").getAttribute("placeholder"),
    "وصفي",
  );
  await page.getByTestId("prompt-preset-name").fill("Boat");
  await page.getByTestId("prompt-preset-save").click();
  await presets.locator('[data-preset-name="Boat"]').waitFor();
  await presets
    .locator('[data-preset-name="Orbit, Arabic"]')
    .getByTestId("prompt-preset-use")
    .click();
  assert.equal(
    await page.getByTestId("create-prompt").inputValue(),
    orbitArabic,
  );
  // The brief's words kept as written: no template, and English (its first letter's language).
  {
    const project = (await client.call("yamakan.project.list", {})).find(
      (x) => x.name === "Library",
    );
    const ref = (
      await client.call("yamakan.document.list", { projectId: project.id })
    ).find((d) => d.kind === "promptPresets");
    const boat = (
      await client.call("yamakan.document.get", {
        projectId: project.id,
        documentId: ref.id,
      })
    ).content.presets.find((x) => x.name === "Boat");
    assert.deepEqual(
      [boat.templateId, boat.language, boat.values, boat.prompt],
      [null, "en", [], "A paper boat on a pond."],
    );
  }
  await presets
    .locator('[data-preset-name="Boat"]')
    .getByTestId("prompt-preset-remove")
    .click();
  await page.waitForFunction(
    () => !document.querySelector('[data-preset-name="Boat"]'),
  );
  if (shots) await library.screenshot({ path: join(shots, "presets-ar.png") });

  // Undo takes back the last presets save; the panel follows, and saves again against it.
  await page.getByTestId("prompt-preset-name").fill("Undone");
  await page.getByTestId("prompt-preset-save").click();
  await presets.locator('[data-preset-name="Undone"]').waitFor();
  await page
    .getByRole("button", {
      name: "\u062a\u0631\u0627\u062c\u0639",
      exact: true,
    })
    .first()
    .click();
  await page.waitForFunction(
    () => !document.querySelector('[data-preset-name="Undone"]'),
    null,
    { timeout: 30000 },
  );
  await page.getByTestId("prompt-preset-name").fill("After undo");
  await page.getByTestId("prompt-preset-save").click();
  await presets.locator('[data-preset-name="After undo"]').waitFor();
  assert.equal(await page.getByTestId("prompt-presets-problem").count(), 0);
  step("an undo of a presets save is followed, and saving goes on");

  // Read back from the service: one presets document, as the page left it.
  const project = (await client.call("yamakan.project.list", {})).find(
    (x) => x.name === "Library",
  );
  const documents = await client.call("yamakan.document.list", {
    projectId: project.id,
  });
  const kept = documents.filter((d) => d.kind === "promptPresets");
  assert.equal(kept.length, 1);
  const read = await client.call("yamakan.document.get", {
    projectId: project.id,
    documentId: kept[0].id,
  });
  assert.deepEqual(
    read.content.presets.map((x) => [x.name, x.templateId, x.language]),
    [
      ["Orbit, Arabic", "yamakan.orbit-hero", "ar"],
      // Kept from the brief, which then held the Arabic orbit prompt.
      ["After undo", null, "ar"],
    ],
  );
  assert.equal(read.content.presets[0].prompt, orbitArabic);
  step("presets kept across a reload, used, removed, and read back", {
    presets: read.content.presets.length,
  });

  assert.deepEqual(pageErrors, []);
  assert.deepEqual([...new Set(outside)], [], "requests left this computer");
  step("no page errors, no outside requests");

  // Evidence comes from a committed head only.
  receipt.passed = clean || process.env.YAMAKAN_QUALIFY_ALLOW_DIRTY === "1";
  if (!receipt.passed) receipt.error = "the working tree is not clean";
} catch (e) {
  receipt.error = e instanceof Error ? e.message : String(e);
} finally {
  await browser?.close().catch(() => {});
  child.kill();
}
if (!receipt.passed) process.exitCode = 1;
const text = JSON.stringify(receipt, null, 2) + "\n";
if (process.env.YAMAKAN_QUALIFY_RECEIPT)
  writeFileSync(process.env.YAMAKAN_QUALIFY_RECEIPT, text);
console.log(text);
console.log(receipt.passed ? "PROMPT LIBRARY PASS" : "FAILED");
