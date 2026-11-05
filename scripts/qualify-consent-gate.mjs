/**
 * A person's photo after their consent is revoked, in a real browser against the
 * real service: the clip on the timeline stays, Undo of its removal is refused
 * with the reason on screen, and the project and file are kept.
 *
 * Usage: node scripts/qualify-consent-gate.mjs [receipt.json]
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
const root = mkdtempSync(join(tmpdir(), "yamakan-consent-gate-"));
const port = 24397;
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
const still = join(root, "person.png");
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
      "color=c=teal:s=320x180",
      "-frames:v",
      "1",
      still,
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
    viewport: { width: 1600, height: 1400 },
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
  const project = await service("yamakan.project.create", { name: "Consent" });
  const projectId = project.id;
  const uploaded = await page.evaluate(
    async ([projectId, base64]) => {
      const stored = JSON.parse(
        sessionStorage.getItem("yamakan.session") ?? "null",
      );
      const headers = {
        "Content-Type": "image/png",
        "X-Asset-Name": "person.png",
      };
      if (stored?.session) headers["X-Yamakan-Session"] = stored.session;
      const res = await fetch(`/api/v1/projects/${projectId}/assets`, {
        method: "POST",
        headers,
        body: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      });
      return res.json();
    },
    [projectId, (await readFile(still)).toString("base64")],
  );
  const asset = uploaded.result?.asset ?? uploaded.asset ?? uploaded;
  assert.ok(asset.id, JSON.stringify(uploaded).slice(0, 300));
  const consent = await service("yamakan.consent.grant", {
    characterId: "lead",
    purpose: "likeness-generate",
    version: "v1",
    ttlMs: 86_400_000,
  });
  const head = () => service("yamakan.project.open", { projectId });
  await service("yamakan.pack.save", {
    projectId,
    expectedRevision: (await head()).revision,
    documentId: crypto.randomUUID(),
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Lead",
      entries: [
        {
          id: crypto.randomUUID(),
          role: "character",
          label: "Lead",
          assetId: asset.id,
          assetHash: asset.hash,
          characterId: "lead",
          consentId: consent.id,
        },
      ],
    },
  });
  const clipId = crypto.randomUUID();
  const opened = await head();
  const video = opened.tracks.find((t) => t.kind === "video").id;
  await service("yamakan.project.applyBatch", {
    projectId,
    expectedRevision: opened.revision,
    operations: [
      {
        type: "clip.add",
        clipId,
        trackId: video,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: 705_600_000,
        sourceStartTicks: 0,
      },
    ],
  });
  await service("yamakan.project.applyBatch", {
    projectId,
    expectedRevision: (await head()).revision,
    operations: [{ type: "clip.remove", clipId }],
  });
  await service("yamakan.consent.revoke", { consentId: consent.id });
  const revokedAt = (await head()).revision;

  await page.reload();
  await page
    .getByRole("button", { name: /Consent/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Consent", exact: true }).waitFor();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const status = page.locator('[role="status"].status');
  await page.waitForFunction(() =>
    document
      .querySelector('[role="status"].status')
      ?.textContent?.includes("consent was revoked"),
  );
  const shown = await status.innerText();
  assert.match(shown, /record a new consent/);
  const after = await head();
  assert.equal(after.revision, revokedAt);
  assert.equal(after.clips.length, 0);
  assert.ok(after.assets.some((a) => a.id === asset.id));
  step(
    "Undo of the removal is refused, with the reason and the way back shown",
    {
      shown,
    },
  );

  // The way back: a new consent and a pack with it. Undo then works.
  const renewed = await service("yamakan.consent.grant", {
    characterId: "lead",
    purpose: "likeness-generate",
    version: "v2",
    ttlMs: 86_400_000,
  });
  await service("yamakan.pack.save", {
    projectId,
    expectedRevision: revokedAt,
    documentId: crypto.randomUUID(),
    expectedContentHash: null,
    pack: {
      format: "yamakan.reference-pack",
      formatVersion: 1,
      name: "Lead again",
      entries: [
        {
          id: crypto.randomUUID(),
          role: "character",
          label: "Lead",
          assetId: asset.id,
          assetHash: asset.hash,
          characterId: "lead",
          consentId: renewed.id,
        },
      ],
    },
  });
  await service("yamakan.project.applyBatch", {
    projectId,
    expectedRevision: (await head()).revision,
    operations: [
      {
        type: "clip.add",
        clipId: crypto.randomUUID(),
        trackId: video,
        assetId: asset.id,
        title: null,
        startTicks: 0,
        durationTicks: 705_600_000,
        sourceStartTicks: 0,
      },
    ],
  });
  assert.equal((await head()).clips.length, 1);
  step("A new consent saved in a pack lets the photo be placed again");

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
          task: "consent-gate",
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
console.log(passed ? "CONSENT GATE PASS" : "CONSENT GATE FAIL");
process.exit(passed ? 0 : 1);
