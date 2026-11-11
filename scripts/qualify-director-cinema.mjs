/**
 * The Creative Director's Cinema pipeline, end to end in a real browser against the real service
 * and the pinned Blender (Windows, after `npm run blender:install`):
 *
 *   a story shot, chosen on the Director panel with a direction → planned as a Cinema scene and
 *   rendered by Blender (what it cannot follow is said) → the person asks for approval and
 *   approves → the video becomes the shot's selected take and the story goes on the timeline →
 *   the run is done. Then the same shot again: the new render replaces the shot's clip, without
 *   a second copy of the story. Read back through the SDK each time.
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
import { randomUUID } from "node:crypto";
import { YamakanClient } from "../sdk/client.ts";

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

const root = mkdtempSync(join(tmpdir(), "yamakan-director-cinema-"));
const workspace = join(root, "workspace");
const port = 24395;
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
  qualification: "DIRECTOR_CINEMA_PIPELINE",
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
  const capability = await client.call("yamakan.blender.capability", {});
  assert.equal(capability.available, true, capability.message);

  // A project with a one-shot story, made through the SDK.
  const project = await client.call("yamakan.project.create", {
    name: "Director shot",
  });
  const storyDocumentId = randomUUID();
  const shotId = randomUUID();
  const saved = await client.call("yamakan.story.save", {
    projectId: project.id,
    expectedRevision: project.revision,
    documentId: storyDocumentId,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 1,
      title: "Harbour",
      scenes: [
        {
          id: randomUUID(),
          name: "Morning",
          shots: [
            {
              id: shotId,
              name: "Opening",
              durationTicks: 705_600_000,
              notes: "",
              referencePacks: [],
              takes: [],
              selectedTakeId: null,
            },
          ],
        },
      ],
    },
  });
  assert.ok(saved.document);

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
  await page
    .locator(".project-list button", { hasText: "Director shot" })
    .click();
  await page
    .getByRole("heading", { name: "Director shot", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  // The Director's section of the Story workspace, closed until opened.
  await page.locator("details.director > summary").click();
  const panel = page.getByTestId("director-cinema");
  await panel.waitFor();
  const value = `${storyDocumentId}/${shotId}`;
  await page.waitForFunction(
    (v) =>
      [
        ...(document.querySelector('[data-testid="director-cinema-story-shot"]')
          ?.options ?? []),
      ].some((o) => o.value === v),
    value,
    { timeout: 30000 },
  );
  // Until the panel reaches a step; if it does not, what it says instead.
  const waitStep = async (want, timeout = 30000) => {
    try {
      await page.waitForFunction(
        (w) =>
          document
            .querySelector('[data-testid="director-cinema"]')
            ?.getAttribute("data-step") === w,
        want,
        { timeout },
      );
    } catch {
      const at = await panel.getAttribute("data-step");
      const problem = await page
        .locator(
          '[data-testid="director-cinema-problem"], [data-testid="director-cinema-failed"]',
        )
        .allTextContents();
      throw new Error(
        `The panel did not reach ${want}: it is at ${at}. ${problem.join(" ")}`,
      );
    }
  };

  // One pass: choose, plan and render, ask for approval, approve, place.
  const pass = async (direction) => {
    await page.getByTestId("director-cinema-story-shot").selectOption(value);
    for (const [kind, choice] of Object.entries(direction))
      await page.getByTestId(`director-cinema-${kind}`).selectOption(choice);
    const started = Date.now();
    await page.getByTestId("director-cinema-render").click();
    await page.getByTestId("director-cinema-planned").waitFor();
    const planned = (
      await page.getByTestId("director-cinema-planned").textContent()
    ).trim();
    await waitStep("rendered", 600000);
    const seconds = Math.round((Date.now() - started) / 1000);
    const runId = await panel.getAttribute("data-run");
    await page.getByTestId("director-cinema-review").click();
    await waitStep("awaiting");
    // Not done before a person approves.
    assert.equal(
      (await client.call("yamakan.director.next", { runId })).kind,
      "blocked",
    );
    await page.getByTestId("director-cinema-approve").click();
    await waitStep("approved");
    await page.getByTestId("director-cinema-place").click();
    await waitStep("placed", 60000);
    assert.equal(
      (await client.call("yamakan.director.next", { runId })).kind,
      "done",
    );
    return { planned, seconds, runId };
  };

  const first = await pass({
    shot: "medium",
    movement: "orbit",
    light: "golden",
  });
  // Values come wrapped in direction isolates (U+2068, U+2069).
  assert.match(
    first.planned,
    /Followed: \u2068?shot:medium, movement:orbit\u2069?\./,
  );
  assert.match(first.planned, /Not followed .*\u2068?light:golden\u2069?\./);
  if (shots)
    await panel.screenshot({ path: join(shots, "director-placed.png") });
  const read = async () => {
    const story = await client.call("yamakan.document.get", {
      projectId: project.id,
      documentId: storyDocumentId,
    });
    const opened = await client.call("yamakan.project.open", {
      projectId: project.id,
    });
    const s = story.content.scenes[0].shots[0];
    const selected = s.takes.find((x) => x.id === s.selectedTakeId);
    const asset = opened.assets.find((a) => a.id === selected?.assetId);
    return { s, selected, asset, opened };
  };
  const one = await read();
  assert.equal(one.s.takes.length, 1);
  assert.equal(one.selected.lineage.outputHash, one.asset.hash);
  assert.match(one.selected.lineage.label, /^Blender: shot medium/);
  const clipsOf = (opened, assetId) =>
    opened.clips.filter((c) => c.assetId === assetId).length;
  assert.equal(clipsOf(one.opened, one.asset.id), 1);
  step("first render approved and placed", {
    seconds: first.seconds,
    planned: first.planned,
    clips: one.opened.clips.length,
  });

  // The same shot again, closer and still: its clip shows the new take; no second copy.
  const second = await pass({ shot: "close", movement: "still" });
  const two = await read();
  assert.equal(two.s.takes.length, 2);
  assert.notEqual(two.asset.id, one.asset.id);
  assert.equal(clipsOf(two.opened, two.asset.id), 1);
  assert.equal(clipsOf(two.opened, one.asset.id), 0);
  assert.equal(two.opened.clips.length, one.opened.clips.length);
  step("second render replaced the shot's clip", {
    seconds: second.seconds,
    takes: two.s.takes.length,
    clips: two.opened.clips.length,
  });

  // The panel in Arabic.
  await page.getByRole("button", { name: "العربية" }).click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  assert.match(
    await page.locator("#director-cinema-title").textContent(),
    /[؀-ۿ]/,
  );
  if (shots) await panel.screenshot({ path: join(shots, "director-ar.png") });
  step("shown in Arabic");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual([...new Set(outside)], [], "requests left this computer");
  step("no page errors, no outside requests");
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
console.log(receipt.passed ? "DIRECTOR CINEMA PIPELINE PASS" : "FAILED");
