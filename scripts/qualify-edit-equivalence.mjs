/**
 * SS-014: the same edits by pointer and by keyboard, on identical copies of a
 * project at 30 and 24000/1001 fps, in a real browser against the real service.
 * The canonical clips must match exactly, and survive undo, redo and a reopen.
 * A locked track refuses both.
 *
 * Usage: node scripts/qualify-edit-equivalence.mjs [receipt.json]
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

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const receipt = process.argv[2] ?? null;
const root = mkdtempSync(join(tmpdir(), "yamakan-equivalence-"));
const port = 24395;
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

const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const FLICKS = 705_600_000;
const video = join(root, "source.mp4");
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
      "testsrc=size=320x180:rate=30:duration=20",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      video,
    ],
    { windowsHide: true },
  );
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), origin);
  browser = await chromium.launch({
    channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1900, height: 1800 },
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
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
  const uploadAsset = async (projectId) => {
    const bytes = await readFile(video);
    return page.evaluate(
      async ([projectId, base64]) => {
        const stored = JSON.parse(
          sessionStorage.getItem("yamakan.session") ?? "null",
        );
        const headers = {
          "Content-Type": "video/mp4",
          "X-Asset-Name": "source.mp4",
        };
        if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const res = await fetch(`/api/v1/projects/${projectId}/assets`, {
          method: "POST",
          headers,
          body: binary,
        });
        return res.json();
      },
      [projectId, bytes.toString("base64")],
    );
  };

  const ids = { a: crypto.randomUUID(), b: crypto.randomUUID() };
  const build = async (name, frameRate) => {
    const project = await service("yamakan.project.create", {
      name,
      frameRate,
    });
    const uploaded = await uploadAsset(project.id);
    const asset = uploaded.result?.asset ?? uploaded.asset ?? uploaded;
    assert.ok(asset.id, JSON.stringify(uploaded).slice(0, 300));
    const FRAME = Math.round((FLICKS * frameRate.den) / frameRate.num);
    const open = await service("yamakan.project.open", {
      projectId: project.id,
    });
    const track = open.tracks.find((t) => t.kind === "video").id;
    const clip = (clipId, start, frames) => ({
      type: "clip.add",
      clipId,
      trackId: track,
      assetId: asset.id,
      title: null,
      startTicks: start * FRAME,
      durationTicks: frames * FRAME,
      sourceStartTicks: 30 * FRAME,
    });
    await service("yamakan.project.applyBatch", {
      projectId: project.id,
      expectedRevision: open.revision,
      operations: [clip(ids.a, 0, 90), clip(ids.b, 150, 90)],
    });
    return { id: project.id, name, FRAME };
  };
  const canonical = async (projectId) => {
    const { clips } = await service("yamakan.project.open", { projectId });
    return clips
      .map((c) => ({
        id: c.id,
        startFrame: c.startFrame,
        durationFrames: c.durationFrames,
        sourceFrame: c.sourceFrame,
      }))
      .sort((x, y) => x.id.localeCompare(y.id));
  };
  const openProject = async (name) => {
    await page.goto(new URL("/", page.url()).href);
    await page.getByRole("button", { name, exact: false }).first().click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await page
      .locator(`[data-clip-id="${ids.a}"]`)
      .waitFor({ timeout: 15_000 });
    // Zoomed in, so a frame is more than a pixel, as for an edit to the frame.
    const zoom = page.getByLabel("Timeline zoom", { exact: true });
    await zoom.evaluate((input) => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      set.call(input, String(Math.log(90)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator(`[data-clip-id="${ids.a}"]`).scrollIntoViewIfNeeded();
  };
  const settle = async (projectId, expect) => {
    for (let i = 0; i < 100; i++) {
      if (JSON.stringify(await canonical(projectId)) !== expect) return;
      await page.waitForTimeout(100);
    }
  };
  const committed = async (projectId, previous) => {
    await settle(projectId, previous);
    await page.waitForTimeout(700);
    return canonical(projectId);
  };
  // The reference preview grows as it renders, so the timeline moves: measure
  // only once the clip has stopped moving.
  const clipBox = async (id) => {
    const clip = page.locator(`[data-clip-id="${id}"]`);
    let last = null;
    for (let i = 0; i < 40; i++) {
      await clip.scrollIntoViewIfNeeded();
      const box = await clip.boundingBox();
      if (last && box && last.x === box.x && last.y === box.y) return box;
      last = box;
      await page.waitForTimeout(250);
    }
    return last;
  };
  // Pixels per frame, from the clip as drawn: 90 frames wide at the start.
  // A real drag, pressed only with that clip under the pointer. The preview above
  // grows when it finishes rendering, which moves the timeline at any moment.
  const dragClip = async (id, where, dx) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const box = await clipBox(id);
      const x =
        where === "end"
          ? box.x + box.width - 2
          : where === "start"
            ? box.x + 2
            : box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      // A clip's trim handles appear once the pointer rests on it.
      await page.waitForTimeout(200);
      const under = await page.evaluate(
        ([x, y]) =>
          document
            .elementFromPoint(x, y)
            ?.closest("[data-clip-id]")
            ?.getAttribute("data-clip-id"),
        [x, y],
      );
      if (under !== id) continue;
      await page.mouse.down();
      await page.mouse.move(x + dx / 2, y, { steps: 3 });
      await page.mouse.move(x + dx, y, { steps: 3 });
      await page.mouse.up();
      return;
    }
    throw new Error(`Clip ${id} never came under the pointer.`);
  };

  for (const [label, frameRate] of [
    ["30 fps", { num: 30, den: 1 }],
    ["24000/1001", { num: 24000, den: 1001 }],
  ]) {
    const pointer = await build(`Pointer ${label}`, frameRate);
    const keyboard = await build(`Keyboard ${label}`, frameRate);
    assert.deepEqual(await canonical(pointer.id), await canonical(keyboard.id));

    // Edit 1, by pointer: drag A's end to just short of B's start; it snaps.
    await openProject(pointer.name);
    let before = JSON.stringify(await canonical(pointer.id));
    const a = await clipBox(ids.a);
    const pxPerFrame = a.width / 90;
    await dragClip(ids.a, "end", 60 * pxPerFrame - 2);
    await settle(pointer.id, before);
    await page.waitForTimeout(700);
    // Edit 2, by pointer with snapping off: B's end 7 frames shorter.
    await page.locator(`[data-clip-id="${ids.a}"]`).focus();
    await page.keyboard.press("n");
    await page.getByTitle("Snapping off (N)").waitFor();
    before = JSON.stringify(await canonical(pointer.id));
    await dragClip(ids.b, "end", Math.round(-7 * pxPerFrame));
    await settle(pointer.id, before);
    await page.waitForTimeout(700);
    // Edit 3: B moved 11 frames later.
    before = JSON.stringify(await canonical(pointer.id));
    await dragClip(ids.b, "middle", Math.round(11 * pxPerFrame));
    await settle(pointer.id, before);
    await page.waitForTimeout(700);
    // Edit 4: B's start 5 frames later, which moves its source frame too.
    before = JSON.stringify(await canonical(pointer.id));
    await dragClip(ids.b, "start", Math.round(5 * pxPerFrame));
    const byPointer = await committed(pointer.id, before);

    // The same, by keyboard.
    await openProject(keyboard.name);
    await page.locator(`[data-clip-id="${ids.a}"]`).focus();
    // To B's start, the second edit point after 0, then A's end to the playhead.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    before = JSON.stringify(await canonical(keyboard.id));
    await page.keyboard.press("BracketRight");
    await settle(keyboard.id, before);
    await page.waitForTimeout(700);
    await page.locator(`[data-clip-id="${ids.b}"]`).focus();
    before = JSON.stringify(await canonical(keyboard.id));
    for (let i = 0; i < 7; i++) await page.keyboard.press("Shift+ArrowLeft");
    await settle(keyboard.id, before);
    await page.waitForTimeout(700);
    before = JSON.stringify(await canonical(keyboard.id));
    for (let i = 0; i < 11; i++) await page.keyboard.press("Alt+ArrowRight");
    await settle(keyboard.id, before);
    await page.waitForTimeout(700);
    before = JSON.stringify(await canonical(keyboard.id));
    for (let i = 0; i < 5; i++) await page.keyboard.press("Period");
    const byKeyboard = await committed(keyboard.id, before);

    assert.deepEqual(byKeyboard, byPointer);
    const b1 = byKeyboard.find((c) => c.id === ids.b);
    const a1 = byKeyboard.find((c) => c.id === ids.a);
    assert.equal(a1.durationFrames, 150, "A's end reached B's start");
    assert.equal(b1.durationFrames, 78, "B lost 7 and then 5 frames");
    assert.equal(
      b1.startFrame,
      166,
      "B moved 11 frames and lost 5 at its start",
    );
    assert.equal(b1.sourceFrame, 35, "B's source moved with its start");
    step(`${label}: pointer and keyboard give identical clips`, {
      a: a1,
      b: b1,
    });

    // Undo and redo by the toolbar, on the keyboard's copy.
    const undoButton = page.getByRole("button", { name: "Undo", exact: true });
    const redoButton = page.getByRole("button", { name: "Redo", exact: true });
    let edited = JSON.stringify(byKeyboard);
    await undoButton.click();
    await settle(keyboard.id, edited);
    assert.notEqual(JSON.stringify(await canonical(keyboard.id)), edited);
    await page.waitForTimeout(300);
    const undone = JSON.stringify(await canonical(keyboard.id));
    await redoButton.click();
    await settle(keyboard.id, undone);
    assert.equal(JSON.stringify(await canonical(keyboard.id)), edited);
    await openProject(keyboard.name);
    assert.equal(JSON.stringify(await canonical(keyboard.id)), edited);
    step(`${label}: undo, redo and a reopen keep the result`);

    // The keys do nothing away from the timeline, here or in another workspace.
    await page.locator(`[data-clip-id="${ids.b}"]`).focus();
    await page.getByRole("tab", { name: "Finish", exact: true }).click();
    await page.getByRole("tab", { name: "Finish", exact: true }).focus();
    for (const key of [
      "BracketRight",
      "Shift+ArrowLeft",
      "Alt+ArrowRight",
      "Comma",
    ])
      await page.keyboard.press(key);
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
    await page.waitForTimeout(900);
    assert.equal(JSON.stringify(await canonical(keyboard.id)), edited);
    step(`${label}: the keys do nothing with focus away from the timeline`);

    // The playhead is at 0 after the reopen, before clip B: "]" would collapse it.
    await page.locator(`[data-clip-id="${ids.b}"]`).focus();
    await page.keyboard.press("BracketRight");
    await page.waitForTimeout(900);
    assert.equal(JSON.stringify(await canonical(keyboard.id)), edited);
    step(`${label}: trimming to a playhead outside the clip does nothing`);

    // A real click on the ruler keeps the keys working: the playhead placed by
    // mouse, then both edges trimmed to it, then a start trim by key.
    const ruler = page.locator(".tl-ruler");
    await ruler.scrollIntoViewIfNeeded();
    let b = await clipBox(ids.b);
    const shown = await canonical(keyboard.id);
    const bNow = shown.find((c) => c.id === ids.b);
    const rulerBox = await ruler.boundingBox();
    await page.locator(`[data-clip-id="${ids.b}"]`).click({
      position: { x: b.width / 2, y: b.height / 2 },
    });
    const framePx = b.width / bNow.durationFrames;
    await page.mouse.click(
      b.x + 30 * framePx,
      rulerBox.y + rulerBox.height / 2,
    );
    before = JSON.stringify(shown);
    await page.keyboard.press("BracketRight");
    await settle(keyboard.id, before);
    await page.waitForTimeout(700);
    const afterEnd = (await canonical(keyboard.id)).find((c) => c.id === ids.b);
    assert.ok(
      Math.abs(afterEnd.durationFrames - 30) <= 2,
      `] after a ruler click: ${afterEnd.durationFrames}`,
    );
    before = JSON.stringify(await canonical(keyboard.id));
    b = await clipBox(ids.b);
    await page.mouse.click(
      b.x + 15 * framePx,
      rulerBox.y + rulerBox.height / 2,
    );
    await page.keyboard.press("BracketLeft");
    await settle(keyboard.id, before);
    await page.waitForTimeout(700);
    const afterStart = (await canonical(keyboard.id)).find(
      (c) => c.id === ids.b,
    );
    assert.ok(
      Math.abs(afterStart.durationFrames - afterEnd.durationFrames + 15) <= 2,
      `[ after a ruler click: ${afterStart.durationFrames}`,
    );
    before = JSON.stringify(await canonical(keyboard.id));
    await page.keyboard.press("Comma");
    await settle(keyboard.id, before);
    await page.waitForTimeout(700);
    const afterComma = (await canonical(keyboard.id)).find(
      (c) => c.id === ids.b,
    );
    assert.equal(afterComma.durationFrames, afterStart.durationFrames + 1);
    step(`${label}: the keys work after a real click on the ruler`);
    edited = JSON.stringify(await canonical(keyboard.id));

    // A locked track refuses both.
    await page.getByRole("button", { name: /lock/i }).first().click();
    await page.waitForTimeout(700);
    await page.locator(`[data-clip-id="${ids.b}"]`).focus();
    for (const key of ["Shift+ArrowLeft", "Alt+ArrowRight", "Period"])
      await page.keyboard.press(key);
    await dragClip(ids.b, "middle", 40);
    await page.waitForTimeout(900);
    assert.equal(JSON.stringify(await canonical(keyboard.id)), edited);
    step(`${label}: a locked track refuses both inputs`);
  }

  assert.deepEqual(pageErrors, []);
  step("no page errors");
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
          task: "SS-014",
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
console.log(passed ? "EDIT EQUIVALENCE PASS" : "EDIT EQUIVALENCE FAIL");
process.exit(passed ? 0 : 1);
