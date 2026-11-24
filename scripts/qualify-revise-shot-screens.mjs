/**
 * MPR-104, part a: a story's shots as cards, in a real browser against the real service, with the
 * keyboard alone, in English and in Arabic. The takes of a shot and how one was made; what was
 * tried for it, a run that failed and one refused before it was sent among them; and from a card
 * to the one take review, where a take is applied and undone. The workspace is made beforehand:
 * its videos are rows and ten bytes that no decoder is asked about, and its runs are rows. No
 * engine, no model, no network and no spend.
 *
 * Usage: node scripts/qualify-revise-shot-screens.mjs [receipt.json] [folder for pictures]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { Scopes, execute } from "../core/command/registry.ts";
import { diagnostic } from "../core/engines/contract-v2.ts";
import { sha256Hex } from "../core/hash/canonical.ts";
import { translate } from "../src/i18n.ts";
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();

execFileSync("npm", ["run", "build"], {
  stdio: "inherit",
  windowsHide: true,
  shell: true,
});

const receipt =
  process.argv[2] ??
  fileURLToPath(
    new URL(
      "../docs/evidence/ultimate/MPR-104-revise-shot-screens-receipt.json",
      import.meta.url,
    ),
  );
// Where pictures of the cards go, when a person wants to look at them.
const pictures = process.argv[3] ?? null;
const FRAME = 23_520_000;
const steps = [];
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const root = mkdtempSync(join(tmpdir(), "yamakan-revise-shot-"));
const workspace = join(root, "workspace");
const port = 24387;
const origin = `http://127.0.0.1:${port}`;
let child = null;
let serverError = "";
let browser;
let passed = false;
let blocked = null;
let failure = null;
const pageErrors = [];
const external = [];
let calls = [];
const everyCall = [];
const PROMPT = "words of a prompt no screen of a card repeats";
const recipe = {
  id: "qualify-recipe",
  hash: "a".repeat(64),
  operation: "textToVideo",
  modelManifestHash: "b".repeat(64),
};

// The workspace, as this build makes one: a story of two shots, the first with three takes of
// which one is a revision of another, and the runs that were tried for it.
async function seed() {
  const store = new ProjectStore(workspace);
  await store.initialize();
  const queue = new JobSupervisor(store);
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
  };
  const call = async (operation, parameters) =>
    (await execute(ctx, operation, parameters)).result;
  const projectId = (await call("yamakan.project.create", { name: "Cards" }))
    .id;
  const head = async () =>
    (await call("yamakan.project.open", { projectId })).revision;
  const video = async (name, of = projectId) => {
    const bytes = Buffer.from(name.padEnd(10).slice(0, 10));
    const asset = {
      id: randomUUID(),
      name: `${name}.mp4`,
      kind: "video",
      hash: sha256Hex(bytes),
      extension: "mp4",
      bytes: 10,
      durationFrames: 90,
      width: 64,
      height: 36,
      hasAudio: false,
    };
    const folder = join(workspace, "projects", of, "assets");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${asset.hash}.mp4`), bytes);
    await store.attachAsset(of, asset, (db) => {
      db.prepare(
        "INSERT INTO asset_objects(project_id, digest, byte_length, state, generation) VALUES (?, ?, 10, 'ready', 1)",
      ).run(of, asset.hash);
      db.prepare(
        "INSERT INTO asset_versions(version_id, project_id, digest, probe) VALUES (?, ?, ?, '{}')",
      ).run(asset.id, of, asset.hash);
    });
    return asset;
  };
  const [one, two, three] = [
    await video("first"),
    await video("second"),
    await video("third"),
  ];
  const documentId = randomUUID();
  const shotId = randomUUID();
  const emptyId = randomUUID();
  const ledger = queue.generationLedger();
  const run = (over) => {
    const row = {
      generationId: randomUUID(),
      projectId,
      recipe,
      prompt: PROMPT,
      seed: 7,
      width: 704,
      height: 480,
      durationFrames: 90,
      firstFrameAssetId: null,
      inputs: [],
      target: { documentId, shotId },
      executionRef: "run",
      phase: "sent",
      startedAt: Date.parse("2026-11-24T06:00:00Z"),
      endedAt: Date.parse("2026-11-24T06:02:00Z"),
      state: "succeeded",
      diagnostic: null,
      videoSha256: null,
      imported: null,
      cancelled: false,
      dismissed: false,
      ...over,
    };
    ledger.begin(row);
    ledger.update(row.generationId, { state: row.state });
    return row;
  };
  const made = (asset, over = {}) =>
    run({
      videoSha256: asset.hash,
      importedAt: Date.parse("2026-11-24T06:03:00Z"),
      imported: {
        assetId: asset.id,
        lineage: {
          outputHash: asset.hash,
          inputs: [],
          recipeId: recipe.id,
          recipeHash: recipe.hash,
          modelManifestHash: recipe.modelManifestHash,
          seed: over.seed ?? 7,
          promptHash: sha256Hex(PROMPT),
        },
      },
      ...over,
    });
  const takes = [one, two, three].map((asset) => ({
    id: randomUUID(),
    assetId: asset.id,
    sourceStartTicks: 0,
  }));
  const shot = (id, name, its) => ({
    id,
    name,
    durationTicks: 60 * FRAME,
    notes: "",
    referencePacks: [],
    takes: its,
    selectedTakeId: its[0]?.id ?? null,
  });
  const save = async (its, records, contentHash) =>
    call("yamakan.story.save", {
      projectId,
      expectedRevision: await head(),
      documentId,
      expectedContentHash: contentHash,
      story: {
        format: "yamakan.story",
        formatVersion: 2,
        title: "Harbour film",
        scenes: [
          {
            id: sceneId,
            name: "One",
            shots: [
              shot(shotId, "Harbour at dawn", its),
              shot(emptyId, "Nothing yet", []),
            ],
          },
        ],
      },
      records,
    });
  const sceneId = randomUUID();
  const base = made(one);
  const first = await save(
    [takes[0]],
    [{ takeId: takes[0].id, from: { generationId: base.generationId } }],
    null,
  );
  const revised = made(two, {
    seed: 8,
    derivedFrom: {
      takeId: takes[0].id,
      recordHash: first.records[0].recordHash,
      revisionNote: "The harbour was too dark.",
    },
  });
  const withFirst = { ...takes[0], recordHash: first.records[0].recordHash };
  await save(
    [withFirst, takes[1], takes[2]],
    [{ takeId: takes[1].id, from: { generationId: revised.generationId } }],
    first.document.contentHash,
  );
  run({
    state: "failed",
    diagnostic: "It failed, for this check.",
    startedAt: Date.parse("2026-11-24T06:10:00Z"),
    endedAt: undefined,
  });
  run({
    state: "failed",
    phase: "sending",
    executionRef: null,
    dismissed: true,
    diagnostic: "It was refused, for this check.",
  });
  // One made for no shot, which the history names as a gap.
  run({ target: undefined, state: "failed" });
  await call("yamakan.story.assemble", {
    projectId,
    expectedRevision: await head(),
    documentId,
    trackId: (await call("yamakan.project.open", { projectId })).tracks.find(
      (t) => t.kind === "video",
    ).id,
  });
  // A long story: 200 shots of 8 takes.
  const long = (await call("yamakan.project.create", { name: "Long" })).id;
  const asset = await video("long", long);
  await call("yamakan.story.save", {
    projectId: long,
    expectedRevision: (await call("yamakan.project.open", { projectId: long }))
      .revision,
    documentId: randomUUID(),
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "Long",
      scenes: Array.from({ length: 4 }, (_, n) => ({
        id: randomUUID(),
        name: `Scene ${n}`,
        shots: Array.from({ length: 50 }, (_, m) =>
          shot(
            randomUUID(),
            `Shot ${n}-${m}`,
            Array.from({ length: 8 }, () => ({
              id: randomUUID(),
              assetId: asset.id,
              sourceStartTicks: 0,
            })),
          ),
        ),
      })),
    },
  });
  await queue.close();
  await store.close();
  return { projectId, documentId, shotId, emptyId, takes };
}

async function serve() {
  child = fork(
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
  child.stderr.on("data", (c) => (serverError += String(c)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The service did not start.")),
      60_000,
    );
    child.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("Yamakan is running")) return;
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`The service exited ${code}.`));
    });
  });
}

async function flow(lang, made) {
  const t = (key, vars) => translate(lang, key, vars);
  const rtl = lang === "ar";
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(workspace, origin);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  // A slow host is slow, not wrong.
  context.setDefaultTimeout(120_000);
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url()))
      external.push(r.url());
    if (r.url().endsWith("/api/v1/call")) {
      const { operation } = JSON.parse(r.postData() ?? "{}");
      calls.push(operation);
      everyCall.push(operation);
    }
  });
  await page.addInitScript(
    (l) => localStorage.setItem("yamakan.lang", l),
    lang,
  );
  await page.goto(
    (await readFile(join(workspace, "launch"), "utf8")).split("\n")[0].trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  await page.waitForFunction(() => sessionStorage.getItem("yamakan.session"));
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
    if (body.error) throw new Error(body.error.message);
    return body.result;
  };
  await page.reload();
  await page.getByRole("button", { name: /Cards/ }).first().click();
  await page.locator("#workspace-tab-story").click();
  const cards = page.getByTestId("shot-card");
  await cards.first().waitFor();
  assert.equal(await cards.count(), 2);
  const card = page.locator(`[data-shot="${made.shotId}"]`).first();
  assert.equal(
    await card.getByTestId("shot-card-name").innerText(),
    "Harbour at dawn",
  );
  const stack = card.getByTestId("shot-take");
  assert.equal(await stack.count(), 3);
  assert.equal(await card.locator('[aria-current="true"]').count(), 1);
  assert.equal(
    await card.locator('[aria-current="true"]').getAttribute("data-take"),
    made.takes[0].id,
  );
  const empty = page
    .getByTestId("shot-card")
    .filter({ has: page.getByText("Nothing yet") });
  assert.equal(
    await empty.getByTestId("shot-no-takes").innerText(),
    t("shot.take.none"),
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.dir),
    rtl ? "rtl" : "ltr",
  );
  // What no one opened was not read.
  assert.ok(!calls.includes("yamakan.take.record"));
  assert.ok(!calls.includes("yamakan.shot.history"));
  step(`${lang}: each shot is a card, with the take the cut shows marked`);

  // The keyboard alone from here, from the top of the page.
  const at = () =>
    page.evaluate(() => {
      const e = document.activeElement;
      return {
        test: e?.getAttribute("data-testid") ?? null,
        take: e?.getAttribute("data-take") ?? null,
        shot: e?.closest("[data-shot]")?.getAttribute("data-shot") ?? null,
      };
    });
  const tabTo = async (test) => {
    for (let n = 0; n < 200; n++) {
      await page.keyboard.press("Tab");
      const now = await at();
      if (now.test === test) return now;
    }
    throw new Error(`The keyboard does not reach ${test}.`);
  };
  await page.locator("#workspace-tab-story").focus();
  assert.equal((await tabTo("shot-take")).take, made.takes[0].id);
  const [next, back] = rtl
    ? ["ArrowLeft", "ArrowRight"]
    : ["ArrowRight", "ArrowLeft"];
  const press = async (key, wanted) => {
    await page.keyboard.press(key);
    assert.equal((await at()).take, wanted, key);
  };
  await press(next, made.takes[1].id);
  await press(back, made.takes[0].id);
  await press(back, made.takes[0].id);
  await press("End", made.takes[2].id);
  await press("Home", made.takes[0].id);
  await press(next, made.takes[1].id);
  step(`${lang}: arrows, Home and End walk a shot's takes in reading order`);

  await page.keyboard.press("Enter");
  const facts = card.getByTestId("shot-take-facts");
  await facts.getByTestId("shot-take-level").waitFor();
  const said = await facts.innerText();
  for (const words of [
    t("shot.take.level.L1"),
    t("shot.take.origin.generation"),
    "qualify-recipe",
    "The harbour was too dark.",
  ])
    assert.ok(said.includes(words), `${words} in ${said}`);
  assert.match(
    (await facts.getByTestId("shot-take-changed").innerText()).trim(),
    /^seed$/,
  );
  assert.equal(
    (await facts.getByTestId("shot-take-derived").innerText()).trim(),
    t("shot.take.name", { n: rtl ? "١" : "1" }).trim(),
  );
  assert.ok(!said.includes(PROMPT));
  await page.keyboard.press("Escape");
  assert.equal(await facts.count(), 0);
  assert.equal((await at()).take, made.takes[1].id);
  // A take with no record says so.
  await press("End", made.takes[2].id);
  await page.keyboard.press(" ");
  await facts.getByText(t("shot.take.noRecord")).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    calls.filter((c) => c === "yamakan.take.record").length,
    1,
    "one record, of the take that was opened and has one",
  );
  step(
    `${lang}: how a take was made is read when it is opened, and Escape goes back to it`,
  );

  await tabTo("shot-attempts-open");
  await page.keyboard.press("Enter");
  const tried = card.getByTestId("shot-attempts");
  await tried.waitFor();
  const attempts = tried.getByTestId("shot-attempt");
  assert.equal(await attempts.count(), 4);
  assert.deepEqual(
    await attempts.evaluateAll((all) =>
      all.map((a) => [a.dataset.outcome, a.dataset.sent]),
    ),
    [
      ["failed", "false"],
      ["failed", "true"],
      ["succeeded", "true"],
      ["succeeded", "true"],
    ],
  );
  const words = await tried.innerText();
  for (const each of [
    t("shot.attempt.refused"),
    t("shot.attempt.failed"),
    "It failed, for this check.",
    t("shot.attempt.useUnknown"),
    t("shot.attempt.gap.untargeted-attempts"),
  ])
    assert.ok(words.includes(each), `${each} in ${words}`);
  for (const use of await tried
    .getByTestId("shot-attempt-used")
    .allInnerTexts())
    assert.equal(use.trim(), t("shot.attempt.notKnown"));
  assert.ok(!words.includes(PROMPT));
  step(
    `${lang}: what was tried is listed, failed and refused ones too, and what is not known is said`,
  );

  if (pictures)
    await page
      .getByTestId("shot-cards")
      .screenshot({ path: join(pictures, `cards-${lang}.png`) });

  // Narrow: nothing of the cards goes past the side.
  await page.setViewportSize({ width: 375, height: 800 });
  const over = await page.evaluate(() => {
    const section = document.querySelector('[data-testid="shot-cards"]');
    return {
      cards: section.scrollWidth - section.clientWidth,
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  assert.ok(over.cards <= 0, `the cards scroll by ${over.cards}`);
  if (pictures)
    await page
      .getByTestId("shot-cards")
      .screenshot({ path: join(pictures, `cards-${lang}-375.png`) });
  await page.setViewportSize({ width: 1280, height: 1000 });
  step(`${lang}: the cards fit 375 pixels`, { pageBeyond: over.page });

  // To the one review, and back.
  await page.locator("#workspace-tab-story").focus();
  await tabTo("shot-review");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("data-testid") ===
      "take-review-open",
  );
  assert.equal((await at()).shot, made.shotId);
  await page.keyboard.press("Enter");
  await page.getByTestId("take-proposal").waitFor();
  const before = (
    await call("yamakan.project.open", { projectId: made.projectId })
  ).revision;
  await tabTo("take-proposal-apply");
  await page.keyboard.press("Enter");
  await page.getByTestId("take-notice-applied").waitFor();
  await page.waitForFunction(
    ([shot, take]) =>
      document
        .querySelector(`[data-testid="shot-card"][data-shot="${shot}"]`)
        ?.querySelector('[aria-current="true"]')
        ?.getAttribute("data-take") === take,
    [made.shotId, made.takes[1].id],
  );
  const applied = await call("yamakan.project.open", {
    projectId: made.projectId,
  });
  assert.equal(applied.revision, before + 1);
  const undone = await call("yamakan.project.undo", {
    projectId: made.projectId,
    expectedRevision: applied.revision,
  });
  assert.equal(undone.revision, applied.revision + 1);
  step(
    `${lang}: a card leads to the one take review, where a take is applied and undone`,
    {
      applied: applied.revision,
      undone: undone.revision,
    },
  );

  await page.reload();
  await page.getByRole("button", { name: /Long/ }).first().click();
  calls = [];
  const began = Date.now();
  await page.locator("#workspace-tab-story").click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="shot-take"]').length === 1600,
  );
  const shownMs = Date.now() - began;
  assert.equal(await page.getByTestId("shot-card").count(), 200);
  for (const each of ["yamakan.take.record", "yamakan.shot.history"])
    assert.ok(!calls.includes(each), each);
  step(`${lang}: 200 cards of 8 takes are shown and no card asks for its own`, {
    shownMs,
    takeLists: calls.filter((c) => c === "yamakan.take.list").length,
  });
  await context.close();
}

try {
  const made = await seed();
  await serve();
  try {
    browser = await chromium.launch({
      channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
      headless: true,
    });
  } catch {
    blocked = "Microsoft Edge does not start on this host.";
    throw new Error(blocked);
  }
  for (const lang of ["en", "ar"]) {
    calls = [];
    await flow(lang, made);
  }
  assert.deepEqual(external, []);
  assert.deepEqual(pageErrors, []);
  assert.ok(!everyCall.includes("yamakan.generation.start"));
  step("no external requests, no page errors, and nothing was started");
  passed = true;
} catch (e) {
  // This receipt may be committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
  for (const e of pageErrors) console.error(`page: ${e}`);
  if (serverError) console.error(serverError.slice(-2000));
} finally {
  await browser?.close().catch(() => {});
  if (child && child.exitCode === null) {
    const gone = new Promise((r) => child.once("exit", r));
    child.kill();
    await gone;
  }
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
  writeFileSync(
    receipt,
    `${JSON.stringify(
      {
        task: "MPR-104",
        part: "a",
        head: git("rev-parse", "HEAD"),
        dirty: git("status", "--porcelain") !== "",
        host,
        outcome: passed ? "PASS" : blocked ? "BLOCKED" : "FAIL",
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
console.log(
  passed
    ? "REVISE SHOT SCREENS PASS"
    : blocked
      ? `REVISE SHOT SCREENS BLOCKED: ${blocked}`
      : "REVISE SHOT SCREENS FAIL",
);
process.exit(passed ? 0 : 1);
