/**
 * SS-006: the Director take review in a real browser against the real service.
 * Real media, a three-shot story, the exact proposal shown and applied, a stale
 * review refused, unsaved edits protected, keyboard, Arabic and undo. The review
 * must call only the existing take commands and never a Director approval.
 *
 * Usage: node scripts/qualify-take-review.mjs [SS-006 receipt.json] [MPR-105 receipt.json]
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
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const receipt = process.argv[2] ?? null;
// The split arm's own receipt (MPR-105), beside SS-006's.
const splitReceiptFile = process.argv[3] ?? null;
let ssSteps = null;
let ssServerError = null;
let splitPassed = false;
const splitSteps = [];

// MPR-105: a shot whose clip was split and whose first part was trimmed keeps its take
// replaceable, as one revision and one undo, and a refusal names the clip. It uses footage,
// so that each piece's place in the take is seen.
async function splitArm(page, call) {
  const mark = (name, detail = {}) => {
    splitSteps.push({ name, ...detail });
    console.log(`ok - ${name}`);
  };
  const footage = (name, source) => {
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
        `${source}=size=320x180:rate=30:duration=4`,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        file,
      ],
      { windowsHide: true },
    );
    return file;
  };
  const created = await call("yamakan.project.create", {
    name: "Split takes",
  });
  const id = created.id;
  const open = async () =>
    (await call("yamakan.project.open", { projectId: id })).project ??
    (await call("yamakan.project.open", { projectId: id }));
  const upload = async (file, name) => {
    const answer = await page.evaluate(
      async ([id, base64, name]) => {
        const stored = JSON.parse(
          sessionStorage.getItem("yamakan.session") ?? "null",
        );
        const headers = { "Content-Type": "video/mp4", "X-Asset-Name": name };
        if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
        const res = await fetch(`/api/v1/projects/${id}/assets`, {
          method: "POST",
          headers,
          body: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
        });
        return res.json();
      },
      [id, (await readFile(file)).toString("base64"), name],
    );
    return answer.result?.asset ?? answer.asset ?? answer;
  };
  const first = await upload(footage("split-a.mp4", "testsrc"), "split-a.mp4");
  const second = await upload(
    footage("split-b.mp4", "smptebars"),
    "split-b.mp4",
  );
  assert.ok(first.id && second.id, "both footage files are in the project");
  const takeA = {
    id: crypto.randomUUID(),
    assetId: first.id,
    sourceStartTicks: 15 * FRAME,
  };
  const takeB = {
    id: crypto.randomUUID(),
    assetId: second.id,
    sourceStartTicks: 0,
  };
  const shotId = crypto.randomUUID();
  const storyDocument = crypto.randomUUID();
  const at = await open();
  await call("yamakan.story.save", {
    projectId: id,
    expectedRevision: at.revision,
    documentId: storyDocument,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 1,
      title: "Split",
      scenes: [
        {
          id: crypto.randomUUID(),
          name: "Scene",
          shots: [
            {
              id: shotId,
              name: "Only",
              durationTicks: 60 * FRAME,
              notes: "",
              referencePacks: [],
              takes: [takeA, takeB],
              selectedTakeId: takeA.id,
            },
          ],
        },
      ],
    },
  });
  await call("yamakan.story.assemble", {
    projectId: id,
    expectedRevision: (await open()).revision,
    documentId: storyDocument,
    trackId: at.tracks.find((t) => t.kind === "video").id,
  });
  const whole = (await open()).clips.find((c) => c.assetId === first.id);
  const pieceId = crypto.randomUUID();
  await call("yamakan.project.applyBatch", {
    projectId: id,
    expectedRevision: (await open()).revision,
    operations: [
      {
        type: "clip.split",
        clipId: whole.id,
        atTicks: (whole.startFrame + 30) * FRAME,
        newClipId: pieceId,
      },
      // The first piece starts ten frames into what it showed.
      {
        type: "clip.trim",
        clipId: whole.id,
        startTicks: (whole.startFrame + 10) * FRAME,
      },
    ],
  });
  const before = await open();
  const pieces = (p) =>
    [whole.id, pieceId].map((x) => p.clips.find((c) => c.id === x));
  assert.deepEqual(
    pieces(before).map((c) => c.sourceFrame),
    [25, 45],
  );
  const openReview = async () => {
    await page.evaluate(() => localStorage.setItem("yamakan.lang", "en"));
    await page.reload();
    await page
      .getByRole("button", { name: /Split takes Revision/ })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Split takes", exact: true })
      .waitFor();
    await page.getByRole("tab", { name: "Story", exact: true }).click();
    await page.locator("details.director > summary").click();
    await page
      .getByTestId("take-review")
      .locator(`li[data-take="${takeB.id}"] [data-testid="take-review-open"]`)
      .click();
  };
  await openReview();
  await page.getByTestId("take-proposal").waitFor();
  assert.equal(await page.getByTestId("take-proposal-clip").count(), 2);
  assert.match(await page.getByTestId("take-proposal-count").innerText(), /2/);
  mark("a split and trimmed shot's proposal has a row per clip");
  await page.getByTestId("take-proposal-apply").click();
  await page.getByTestId("take-notice-applied").waitFor();
  const after = await open();
  assert.equal(after.revision, before.revision + 1);
  assert.deepEqual(
    pieces(after).map((c) => [c.assetId, c.startFrame, c.sourceFrame]),
    [
      [second.id, whole.startFrame + 10, 10],
      [second.id, whole.startFrame + 30, 30],
    ],
  );
  mark("apply is one revision and each piece keeps its place in the new take");
  await call("yamakan.project.undo", {
    projectId: id,
    expectedRevision: after.revision,
  });
  assert.deepEqual(
    pieces(await open()).map((c) => [c.assetId, c.sourceFrame]),
    [
      [first.id, 25],
      [first.id, 45],
    ],
  );
  mark("one undo brings both pieces back");
  await call("yamakan.project.applyBatch", {
    projectId: id,
    expectedRevision: (await open()).revision,
    operations: [
      {
        type: "clip.setSpeed",
        clipId: pieceId,
        speed: { num: 1, den: 2 },
      },
    ],
  });
  await openReview();
  await page.getByTestId("take-notice-refused").waitFor();
  assert.match(
    await page.getByTestId("take-notice-refused").innerText(),
    /Clip 2 of 2 of this shot: Reset the clip's speed before replacing its take\./,
  );
  mark("a refusal names the clip");
}

const root = mkdtempSync(join(tmpdir(), "yamakan-take-review-"));
const port = 24381;
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

const FRAME = 23_520_000;
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
  const operations = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url()))
      external.push(r.url());
    if (r.url().endsWith("/api/v1/call"))
      operations.push(JSON.parse(r.postData() ?? "{}").operation);
  });

  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  await page.getByLabel("Project name", { exact: true }).fill("Takes");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name: "Takes", exact: true }).waitFor();

  // The harness's own calls do not pass through the panel's client, and are
  // left out of the record of what the panel asked for.
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
    operations.splice(operations.lastIndexOf(operation), 1);
    return body.result;
  };

  for (const [name, colour] of [
    ["red.png", "red"],
    ["green.png", "green"],
    ["blue.png", "blue"],
    ["yellow.png", "yellow"],
  ]) {
    await page
      .getByLabel("Import local media")
      .setInputFiles(still(name, colour));
    await page.getByText(name, { exact: false }).first().waitFor();
  }
  const projects = await call("yamakan.project.list", {});
  const project = (projects.projects ?? projects).find(
    (p) => p.name === "Takes",
  );
  const head = async () =>
    (await call("yamakan.project.open", { projectId: project.id })).project ??
    (await call("yamakan.project.open", { projectId: project.id }));
  const start = await head();
  assert.equal(start.assets.length, 4);
  const asset = (name) => start.assets.find((a) => a.name === name);
  const take = (name) => ({
    id: crypto.randomUUID(),
    assetId: asset(name).id,
    sourceStartTicks: 0,
  });
  const middleOld = take("green.png");
  const middleNew = take("yellow.png");
  const shot = (name, takes) => ({
    id: crypto.randomUUID(),
    name,
    durationTicks: 30 * FRAME,
    notes: "",
    referencePacks: [],
    takes,
    selectedTakeId: takes[0].id,
  });
  const storyId = crypto.randomUUID();
  const shots = [
    shot("First", [take("red.png")]),
    shot("Middle", [middleOld, middleNew]),
    shot("Last", [take("blue.png")]),
  ];
  const saved = await call("yamakan.story.save", {
    projectId: project.id,
    expectedRevision: start.revision,
    documentId: storyId,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 1,
      title: "Three shots",
      scenes: [{ id: crypto.randomUUID(), name: "Scene", shots }],
    },
  });
  await call("yamakan.story.assemble", {
    projectId: project.id,
    expectedRevision: saved.project.revision,
    documentId: storyId,
    trackId: start.tracks.find((t) => t.kind === "video").id,
  });
  // The host opens the assembled project as a person would, so it knows the head.
  await page.reload();
  await page
    .getByRole("button", { name: /Takes Revision/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Takes", exact: true }).waitFor();
  const assembled = await head();
  assert.equal(assembled.clips.length, 3);
  const clipShowing = (p, name) =>
    p.clips.filter((c) => c.assetId === asset(name).id);
  const others = (p) =>
    p.clips
      .filter((c) => c.assetId !== asset("green.png").id)
      .filter((c) => c.assetId !== asset("yellow.png").id);
  const untouched = JSON.stringify(others(assembled));
  step("real stills imported and a three-shot story assembled");

  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await page.locator("details.director > summary").click();
  const panel = page.getByTestId("take-review");
  await panel.waitFor();
  const rows = panel.locator("li");
  assert.equal(await rows.count(), 4);
  assert.equal(
    await panel
      .locator(`li[data-take="${middleOld.id}"]`)
      .getAttribute("data-current"),
    "true",
  );
  step("takes listed with the one shown marked");

  // Keyboard: the review opens from the keyboard alone.
  const open = panel.getByTestId("take-review-open");
  assert.equal(await open.count(), 1);
  await open.focus();
  await page.keyboard.press("Enter");
  const shown = page.getByTestId("take-proposal");
  await shown.waitFor();
  const hash = await page.getByTestId("take-proposal-hash").innerText();
  const direct = await call("yamakan.take.proposeReplace", {
    projectId: project.id,
    documentId: storyId,
    shotId: shots[1].id,
    takeId: middleNew.id,
  });
  assert.equal(hash, direct.proposalHash);
  assert.equal(
    await page.getByTestId("take-proposal-clip").innerText(),
    direct.mappings[0].clipId,
  );
  assert.match(
    await page.getByTestId("take-proposal-from").innerText(),
    new RegExp(asset("green.png").hash.slice(0, 12)),
  );
  assert.match(
    await page.getByTestId("take-proposal-to").innerText(),
    new RegExp(asset("yellow.png").hash.slice(0, 12)),
  );
  assert.deepEqual(await head().then((p) => p.revision), assembled.revision);
  step("review shows the exact proposal and changes nothing", { hash });

  // Another writer moves the project on after the review.
  const moved = await call("yamakan.project.applyBatch", {
    projectId: project.id,
    expectedRevision: assembled.revision,
    operations: [
      {
        type: "track.add",
        trackId: crypto.randomUUID(),
        name: "Other writer",
        kind: "video",
      },
    ],
  });
  await page.getByTestId("take-proposal-apply").click();
  await page.getByTestId("take-notice-stale").waitFor();
  assert.equal(await shown.count(), 0, "a refused proposal must not stay up");
  let now = await head();
  assert.equal(now.revision, moved.revision);
  assert.equal(clipShowing(now, "yellow.png").length, 0);
  step("a stale review is refused, dropped and changes nothing");

  // A fresh review of the new head applies, and only the middle clip changes.
  await page.reload();
  await page
    .getByRole("button", { name: /Takes Revision/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Takes", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await page.locator("details.director > summary").click();
  await panel.waitFor();
  await panel.getByTestId("take-review-open").click();
  await shown.waitFor();
  assert.notEqual(
    await page.getByTestId("take-proposal-hash").innerText(),
    hash,
  );
  await page.getByTestId("take-proposal-apply").click();
  await page.getByTestId("take-notice-applied").waitFor();
  now = await head();
  assert.equal(clipShowing(now, "yellow.png").length, 1);
  assert.equal(clipShowing(now, "green.png").length, 0);
  assert.equal(JSON.stringify(others(now)), untouched);
  const appliedAt = now.revision;
  step("a fresh review applies and changes only the middle clip", {
    revision: appliedAt,
  });

  // Undo returns the previous take through the ordinary editor control.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-testid="take-review"] li[data-take="${id}"]`)
        ?.getAttribute("data-current") === "true",
    middleOld.id,
  );
  now = await head();
  assert.equal(clipShowing(now, "green.png").length, 1);
  assert.equal(JSON.stringify(others(now)), untouched);
  step("undo returns the previous take");

  // A real local edit; its commit moves the revision.
  let opacity = 0.2;
  const localEdit = async () => {
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await page.getByTitle(/^red\.png · /).click();
    await page.getByTestId("clip-animation-panel").waitFor();
    opacity += 0.05;
    await page.locator("#anim-start-opacity").fill(opacity.toFixed(2));
    await page.locator("#anim-end-opacity").fill("0.8");
    await page
      .getByRole("button", { name: "Apply opacity keyframes", exact: true })
      .click();
    await page.getByRole("tab", { name: "Story", exact: true }).click();
  };
  const isCall = (request, operation) =>
    request.url().endsWith("/api/v1/call") &&
    JSON.parse(request.postData() ?? "{}").operation === operation;

  // A review still being made when the project moves on leaves the panel usable.
  let releaseReview;
  const reviewHeld = new Promise((r) => (releaseReview = r));
  await page.route("**/api/v1/call", async (route) => {
    if (isCall(route.request(), "yamakan.take.proposeReplace"))
      await reviewHeld;
    await route.fallback();
  });
  const movedFrom = (await head()).revision;
  await panel.getByTestId("take-review-open").click();
  await localEdit();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="take-notice-stale"]'),
  );
  assert.ok((await head()).revision > movedFrom);
  const lateAnswer = page.waitForResponse((r) =>
    isCall(r.request(), "yamakan.take.proposeReplace"),
  );
  releaseReview();
  await lateAnswer;
  await page.waitForTimeout(100);
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await shown.count(), 0, "a late proposal must be dropped");
  assert.equal(await panel.getByTestId("take-review-open").isEnabled(), true);
  step("a review overtaken by a save is dropped and the panel stays usable");

  // Unsaved edits hold the apply back; their commit makes the review stale.
  await panel.getByTestId("take-review-open").click();
  await shown.waitFor();
  let releaseCommit;
  const commitHeld = new Promise((r) => (releaseCommit = r));
  await page.route("**/api/v1/call", async (route) => {
    if (isCall(route.request(), "yamakan.project.applyBatch")) await commitHeld;
    await route.fallback();
  });
  await localEdit();
  await page.getByTestId("take-save-first").waitFor();
  assert.equal(
    await page.getByTestId("take-proposal-apply").isDisabled(),
    true,
  );
  releaseCommit();
  await page.getByTestId("take-notice-stale").waitFor();
  assert.equal(await shown.count(), 0);
  await page.unrouteAll({ behavior: "wait" });
  step(
    "applying is refused while edits are unsaved, and their save needs a fresh review",
  );

  // While an apply runs, the editor neither edits nor switches project.
  await panel.getByTestId("take-review-open").click();
  await shown.waitFor();
  let releaseApply;
  const applyHeld = new Promise((r) => (releaseApply = r));
  await page.route("**/api/v1/call", async (route) => {
    if (isCall(route.request(), "yamakan.take.apply")) await applyHeld;
    await route.fallback();
  });
  const undoButton = page.getByRole("button", { name: "Undo", exact: true });
  const projectRow = page
    .getByRole("button", { name: /Takes Revision/ })
    .first();
  await page.getByTestId("take-proposal-apply").click();
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="take-proposal"]'),
  );
  assert.equal(await undoButton.isDisabled(), true);
  assert.equal(await projectRow.isDisabled(), true);
  releaseApply();
  await page.getByTestId("take-notice-applied").waitFor();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await undoButton.isDisabled(), false);
  assert.equal(clipShowing(await head(), "yellow.png").length, 1);
  await undoButton.click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-testid="take-review"] li[data-take="${id}"]`)
        ?.getAttribute("data-current") === "true",
    middleOld.id,
  );
  step("while an apply runs, undo and project switching are disabled");

  // A lost response is asked again under the same request id: one revision.
  await panel.getByTestId("take-review-open").click();
  await shown.waitFor();
  const shownHash = await page.getByTestId("take-proposal-hash").innerText();
  const sent = [];
  await page.route("**/api/v1/call", async (route) => {
    const request = route.request();
    if (!isCall(request, "yamakan.take.apply")) return route.fallback();
    sent.push(JSON.parse(request.postData()));
    if (sent.length > 1) return route.fallback();
    await route.fetch();
    return route.abort("connectionreset");
  });
  const beforeLost = (await head()).revision;
  await page.getByTestId("take-proposal-apply").click();
  await page.getByTestId("take-notice-applied").waitFor();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].requestId, sent[1].requestId);
  assert.equal(sent[0].parameters.proposal.proposalHash, shownHash);
  now = await head();
  assert.equal(now.revision, beforeLost + 1);
  assert.equal(clipShowing(now, "yellow.png").length, 1);
  step(
    "a lost response is replayed under one request id: the shown proposal, once",
    {
      revision: now.revision,
    },
  );

  // Lost twice, the panel says it does not know. It may have been applied.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`[data-testid="take-review"] li[data-take="${id}"]`)
        ?.getAttribute("data-current") === "true",
    middleOld.id,
  );
  await panel.getByTestId("take-review-open").click();
  await shown.waitFor();
  const beforeUnknown = (await head()).revision;
  let tries = 0;
  await page.route("**/api/v1/call", async (route) => {
    if (!isCall(route.request(), "yamakan.take.apply")) return route.fallback();
    if (tries++ === 0) await route.fetch();
    return route.abort("connectionreset");
  });
  await page.getByTestId("take-proposal-apply").click();
  await page.getByTestId("take-notice-unknown").waitFor();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await page.getByTestId("take-notice-applied").count(), 0);
  assert.equal(await page.getByTestId("take-notice-refused").count(), 0);
  assert.equal((await head()).revision, beforeUnknown + 1);
  step(
    "a response lost twice says the outcome is not known, not that it failed",
  );

  await page.reload();
  await page
    .getByRole("button", { name: /Takes Revision/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Takes", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Story", exact: true }).click();
  await page.locator("details.director > summary").click();
  await panel.waitFor();
  await panel.getByTestId("take-review-open").click();
  await shown.waitFor();

  // Arabic: the panel is translated and right to left, values stay left to right.
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.waitForFunction(() => document.dir === "rtl");
  await page
    .getByRole("heading", { name: "مراجعة اللقطة", exact: true })
    .waitFor();
  if ((await shown.count()) === 0)
    await panel.getByTestId("take-review-open").click();
  await shown.waitFor();
  assert.equal(
    await page.getByTestId("take-proposal-hash").getAttribute("dir"),
    "ltr",
  );
  step("Arabic labels, right-to-left page, left-to-right identifiers");

  const allowed = new Set([
    "yamakan.document.list",
    "yamakan.take.list",
    "yamakan.take.proposeReplace",
    "yamakan.take.apply",
  ]);
  const asked = [...new Set(operations)];
  assert.deepEqual(
    asked.filter((o) => /director\.(approve|advance|next|start)/.test(o)),
    [],
  );
  assert.ok(asked.includes("yamakan.take.apply"));
  assert.ok(
    asked
      .filter((o) => o.startsWith("yamakan.take."))
      .every((o) => allowed.has(o)),
  );
  step("no Director approval or stage command was called", {
    takeCommands: asked.filter((o) => o.startsWith("yamakan.take.")),
  });
  assert.deepEqual(external, []);
  assert.deepEqual(pageErrors, []);
  step("no external requests and no page errors");

  // SS-006's result stands as it is from here: the split arm below has its own steps,
  // flag and receipt.
  passed = true;
  ssSteps = [...steps];
  ssServerError = serverError;
  await splitArm(page, call);
  assert.deepEqual(external, []);
  assert.deepEqual(pageErrors, []);
  splitPassed = true;
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  if (receipt)
    writeFileSync(
      receipt,
      `${JSON.stringify(
        {
          task: "SS-006",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          host,
          passed,
          steps: ssSteps ?? steps,
          serverError: (ssServerError ?? serverError).slice(-1000),
        },
        null,
        2,
      )}\n`,
    );
  if (splitReceiptFile)
    writeFileSync(
      splitReceiptFile,
      `${JSON.stringify(
        {
          task: "MPR-105",
          head: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          host,
          passed: splitPassed,
          steps: splitSteps,
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
console.log(passed && splitPassed ? "TAKE REVIEW PASS" : "TAKE REVIEW FAIL");
process.exit(passed && splitPassed ? 0 : 1);
