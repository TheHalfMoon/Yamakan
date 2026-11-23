/**
 * MPR-106: the brief, the scene scripts and the shot intents, in a real browser against the real
 * service. A Create draft offered once and kept by the person's own choice; text typed in English
 * and in Arabic, saved, reloaded, read back through the command and in a fresh browser profile; a
 * save against a story that moved on; and a story too full refused by the page, and by the
 * service with its byte counts. No model, no network and no spend.
 *
 * Usage: node scripts/qualify-story-brief.mjs [receipt.json]
 */
import { chromium } from "playwright-core";
import { execFileSync, fork } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { diagnostic } from "../core/engines/contract-v2.ts";
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
      "../docs/evidence/ultimate/MPR-106-story-brief-receipt.json",
      import.meta.url,
    ),
  );
const FRAME = 23_520_000;
const ARABIC = "طائرة ورقية حمراء فوق أسطح المدينة عند الغروب";
const UNDO_WAITS = translate("en", "status.documentUnsaved");
const DRAFT = "A red kite over the roofs at dusk.";
const steps = [];
const measured = {};
const step = (name, detail = {}) => {
  steps.push({ name, ...detail });
  console.log(`ok - ${name}`);
};
const root = mkdtempSync(join(tmpdir(), "yamakan-story-brief-"));
const port = 24385;
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
let browser;
let passed = false;
let blocked = null;
let failure = null;
const pageErrors = [];
const external = [];
let sent = [];

// A page of a browser profile of its own, signed in with the launch link.
async function profile() {
  const { writeLaunchLink } = await import("../core/launch.ts");
  await writeLaunchLink(join(root, "workspace"), origin);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !/^(data|blob):/.test(r.url()))
      external.push(r.url());
    if (r.url().endsWith("/api/v1/call")) {
      const body = JSON.parse(r.postData() ?? "{}");
      if (body.operation === "yamakan.story.save") sent.push(body.parameters);
    }
  });
  await page.addInitScript(() => localStorage.setItem("yamakan.lang", "en"));
  await page.goto(
    (await readFile(join(root, "workspace", "launch"), "utf8"))
      .split("\n")[0]
      .trim(),
  );
  await page.waitForFunction(() => location.hash === "");
  // The harness's own calls, which are no save of the page's.
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
    if (operation === "yamakan.story.save") sent.pop();
    if (body.error)
      throw Object.assign(new Error(body.error.message), {
        code: body.error.code,
      });
    return body.result;
  };
  const openProject = async (name) => {
    await page.reload();
    await page
      .getByRole("button", { name: new RegExp(`${name} Revision`) })
      .first()
      .click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  };
  const tab = (name) => page.getByRole("tab", { name, exact: true }).click();
  return { context, page, call, openProject, tab };
}
const shot = (name, intent) => ({
  id: crypto.randomUUID(),
  name,
  durationTicks: 60 * FRAME,
  notes: "",
  referencePacks: [],
  takes: [],
  selectedTakeId: null,
  ...(intent ? { intent } : {}),
});

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
  try {
    browser = await chromium.launch({
      channel: process.env.YAMAKAN_BROWSER_CHANNEL || "msedge",
      headless: true,
    });
  } catch {
    blocked = "The browser does not start on this host.";
    throw new Error(blocked);
  }
  const { page, call, openProject, tab, context } = await profile();
  const { id: projectId } = await call("yamakan.project.create", {
    name: "Words",
  });
  const head = async () =>
    (await call("yamakan.project.open", { projectId })).revision;
  const documentId = crypto.randomUUID();
  const scenes = [
    {
      id: crypto.randomUUID(),
      name: "Roofs",
      shots: [shot("Kite", { framing: "wide" }), shot("Hands")],
    },
    { id: crypto.randomUUID(), name: "Street", shots: [shot("Corner")] },
  ];
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "Kite",
      scenes,
    },
  });
  const held = () => call("yamakan.document.get", { projectId, documentId });
  const shotIn = async (id) =>
    (await held()).content.scenes
      .flatMap((s) => s.shots)
      .find((s) => s.id === id);

  // Create's offer.
  const draftKey = `yamakan.create.brief.${projectId}`;
  const marker = `yamakan.create.brief.offered.${projectId}`;
  const store = (key, value) =>
    page.evaluate(
      ([key, value]) =>
        value === null
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, value),
      [key, value],
    );
  const stored = (key) => page.evaluate((k) => localStorage.getItem(k), key);
  const draft = JSON.stringify({
    prompt: DRAFT,
    modelId: "zai-org/CogVideoX-2b",
    seed: 99,
    direction: { shot: "wide" },
  });
  const offer = page.getByTestId("create-draft-offer");
  const openCreate = async () => {
    await openProject("Words");
    await tab("Create");
    await page.getByTestId("create-panel").first().waitFor();
  };
  await store(draftKey, "not json");
  await openCreate();
  await page.waitForTimeout(1_500);
  assert.equal(await offer.count(), 0);
  await store(draftKey, draft);
  await openCreate();
  await offer.waitFor();
  assert.equal(await page.getByTestId("create-draft-text").innerText(), DRAFT);
  await page.getByTestId("create-draft-later").click();
  assert.equal(await offer.count(), 0);
  assert.equal(await stored(marker), null);
  await tab("Story");
  await openCreate();
  await offer.waitFor();
  await page.getByTestId("create-draft-keep").click();
  assert.equal(
    await page.getByTestId("create-draft-save").isDisabled(),
    true,
    "no shot is chosen for the person",
  );
  assert.match(await offer.innerText(), /model and the seed are not kept/);
  assert.deepEqual(sent, [], "nothing is saved before the person says so");
  step("a draft is offered, and opening, reading and leaving it save nothing");

  // The story moves on under the offer: nothing is written, and it stays.
  const [kite] = scenes[0].shots;
  await page.getByTestId("create-draft-shot").selectOption(kite.id);
  const before = await held();
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: before.contentHash,
    story: {
      ...before.content,
      scenes: before.content.scenes.map((s) =>
        s.id === scenes[1].id ? { ...s, sceneText: "A street." } : s,
      ),
    },
  });
  await page.getByTestId("create-draft-save").click();
  await page.getByTestId("create-draft-said").waitFor();
  assert.equal(sent.length, 1);
  assert.equal((await held()).content.scenes[1].sceneText, "A street.");
  assert.deepEqual((await shotIn(kite.id)).intent, { framing: "wide" });
  assert.equal(await stored(marker), null);
  assert.equal(JSON.parse(await stored(draftKey)).prompt, DRAFT);
  step("a save against a story that moved on writes nothing and asks again");

  assert.match(
    await page.getByTestId("create-draft-said").innerText(),
    /changed elsewhere/,
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="create-draft-shot"]')?.value === "",
  );
  // Once the project has been reopened.
  await page.waitForTimeout(1_500);
  await page.getByTestId("create-draft-shot").selectOption(kite.id);
  await page.getByTestId("create-draft-save").click();
  await offer.waitFor({ state: "detached" });
  await page.getByTestId("create-draft-saved").waitFor();
  assert.deepEqual((await shotIn(kite.id)).intent, {
    framing: "wide",
    action: DRAFT,
    direction: { shot: "wide" },
  });
  assert.ok(!JSON.stringify(await held()).includes("CogVideoX"));
  assert.notEqual(await stored(marker), null);
  assert.equal(JSON.parse(await stored(draftKey)).prompt, DRAFT);
  await openCreate();
  await page.waitForTimeout(1_500);
  assert.equal(await offer.count(), 0);
  assert.equal((await held()).content.scenes[1].sceneText, "A street.");
  step("the kept draft is the shot's action and direction, once");

  // "Do not ask again" is an answer too.
  await store(marker, null);
  await openCreate();
  await offer.waitFor();
  const saves = sent.length;
  await page.getByTestId("create-draft-never").click();
  assert.equal(await offer.count(), 0);
  await openCreate();
  await page.waitForTimeout(1_500);
  assert.equal(await offer.count(), 0);
  assert.equal(sent.length, saves);
  step("after never it is not offered again");

  // The Story page.
  const at = (id) => page.getByTestId(id);
  const openStory = async () => {
    await openProject("Words");
    await tab("Story");
    await at("story-brief-logline").waitFor();
  };
  const script = (scene) =>
    page.locator(`[data-scene="${scene}"] [data-testid="story-scene-script"]`);
  const open = (scene) =>
    page.locator(`[data-scene="${scene}"] [data-testid="story-scene-open"]`);
  await openStory();
  assert.equal(await at("story-shot-action").count(), 0);
  const typedAt = sent.length;
  const english = {
    "story-brief-audience": "Families",
    "story-brief-format": "A two-minute short",
    "story-brief-languages": "ar, en-GB",
    "story-brief-tone": "Quiet <b>not bold</b> https://example.invalid/x",
  };
  for (const [id, text] of Object.entries(english)) await at(id).fill(text);
  await at("story-brief-logline").fill(ARABIC);
  await script(scenes[0].id).fill(`The kite rises.\n${ARABIC}`);
  await open(scenes[0].id).click();
  assert.equal(await at("story-shot-action").count(), 2);
  const handsAction = page.locator(
    `[data-shot="${scenes[0].shots[1].id}"] [data-testid="story-shot-action"]`,
  );
  await handsAction.fill(ARABIC);
  await page
    .locator(
      `[data-shot="${scenes[0].shots[1].id}"] [data-testid="story-shot-dialogue"]`,
    )
    .fill("Higher!");
  const directionOf = (locator) =>
    locator.evaluate((el) => getComputedStyle(el).direction);
  assert.equal(await directionOf(at("story-brief-logline")), "rtl");
  assert.equal(await directionOf(at("story-brief-audience")), "ltr");
  assert.equal(sent.length, typedAt, "typing sends nothing");
  // The open scene's shots are the only ones there.
  await open(scenes[1].id).click();
  assert.equal(await at("story-shot-action").count(), 1);
  assert.match(
    await at("story-text").innerText(),
    /ends the timeline's undo history/,
  );
  assert.match(
    await at("story-text-used").innerText(),
    /^The story is \d+% full\.$/,
  );
  await at("story-text-save").click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="story-text-save"]').disabled,
  );
  await page.waitForTimeout(1_000);
  assert.equal(sent.length, typedAt + 1);
  const check = (content) => {
    assert.equal(content.formatVersion, 2);
    assert.deepEqual(content.brief, {
      logline: ARABIC,
      audience: english["story-brief-audience"],
      format: english["story-brief-format"],
      languages: ["ar", "en-GB"],
      tone: english["story-brief-tone"],
    });
    assert.equal(content.scenes[0].sceneText, `The kite rises.\n${ARABIC}`);
    assert.equal(content.scenes[1].sceneText, "A street.");
    assert.deepEqual(content.scenes[0].shots[0].intent, {
      framing: "wide",
      action: DRAFT,
      direction: { shot: "wide" },
    });
    assert.deepEqual(content.scenes[0].shots[1].intent, {
      action: ARABIC,
      dialogue: "Higher!",
    });
  };
  check((await held()).content);
  step(
    "a brief, a script and an intent, in English and Arabic, are in the story",
  );

  const shows = async (view) => {
    const of = (id) => view.getByTestId(id);
    assert.equal(await of("story-brief-logline").inputValue(), ARABIC);
    assert.equal(
      await of("story-brief-tone").inputValue(),
      english["story-brief-tone"],
    );
    assert.equal(await of("story-brief-languages").inputValue(), "ar, en-GB");
    assert.equal(
      await view
        .locator(`[data-scene="${scenes[0].id}"] textarea`)
        .first()
        .inputValue(),
      `The kite rises.\n${ARABIC}`,
    );
    await view
      .locator(
        `[data-scene="${scenes[0].id}"] [data-testid="story-scene-open"]`,
      )
      .click();
    assert.equal(
      await view
        .locator(
          `[data-shot="${scenes[0].shots[1].id}"] [data-testid="story-shot-action"]`,
        )
        .inputValue(),
      ARABIC,
    );
    assert.match(
      await of("story-shot-direction").first().innerText(),
      /wide shot/,
    );
    assert.equal(await view.locator(".story-words b").count(), 0);
  };
  await openStory();
  await shows(page);
  step("all of it shows after a reload, as plain text");

  const fresh = await profile();
  assert.equal(
    await fresh.page.evaluate((k) => localStorage.getItem(k), draftKey),
    null,
  );
  await fresh.openProject("Words");
  await fresh.tab("Story");
  await fresh.page.getByTestId("story-brief-logline").waitFor();
  await shows(fresh.page);
  check(
    (await fresh.call("yamakan.document.get", { projectId, documentId }))
      .content,
  );
  await fresh.context.close();
  step("and in a fresh browser profile");

  // The story changes elsewhere while the person types.
  await at("story-brief-audience").fill("Everyone");
  const elsewhere = await held();
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: elsewhere.contentHash,
    story: {
      ...elsewhere.content,
      brief: {
        ...elsewhere.content.brief,
        audience: "Adults",
        tone: "Loud",
      },
    },
  });
  await at("story-text-save").click();
  await at("story-text-refused").waitFor();
  assert.equal(
    await at("story-text-refused").getAttribute("data-why"),
    "conflict",
  );
  assert.match(
    await at("story-text-refused").innerText(),
    /^The story changed elsewhere\. Reload it; your text is kept here until you leave\.$/,
  );
  assert.equal(await at("story-brief-audience").inputValue(), "Everyone");
  assert.equal((await held()).content.brief.audience, "Adults");
  await at("story-text-reload").click();
  await at("story-text-refused").waitFor({ state: "detached" });
  // The typed text stays; what the person did not touch is the story's, and the other text shows.
  assert.equal(await at("story-brief-audience").inputValue(), "Everyone");
  assert.equal(await at("story-brief-tone").inputValue(), "Loud");
  assert.match(await at("story-text-under").innerText(), /Adults/);
  await page.waitForTimeout(500);
  await at("story-text-save").click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="story-text-save"]').disabled,
  );
  await page.waitForTimeout(1_000);
  const merged = (await held()).content;
  assert.equal(merged.brief.audience, "Everyone");
  assert.equal(merged.brief.tone, "Loud");
  assert.equal(merged.scenes[0].sceneText, `The kite rises.\n${ARABIC}`);
  step(
    "a stale save writes nothing, keeps the text, and saves on top after a reload",
  );

  // A second save without a reload, of what was typed after the first. The person types on while
  // it runs: the focus stays with them and the text stays.
  await at("story-brief-audience").fill("Everyone, twice");
  let release;
  const held1 = new Promise((r) => (release = r));
  await page.route("**/api/v1/call", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.operation === "yamakan.story.save") await held1;
    await route.continue();
  });
  await at("story-text-save").click();
  // The one being saved is put back as it was, and another is typed in.
  const audienceBefore = merged.brief.audience;
  await at("story-brief-audience").fill(audienceBefore);
  await at("story-brief-format").click();
  await page.keyboard.type("Typed ");
  release();
  await at("story-text-done").waitFor();
  await page.keyboard.type("on");
  await page.unroute("**/api/v1/call");
  assert.match(await at("story-brief-format").inputValue(), /Typed on/);
  assert.equal(await at("story-brief-audience").inputValue(), audienceBefore);
  assert.equal(await at("story-text-save").isDisabled(), false);
  await at("story-text-discard").click();
  assert.equal((await held()).content.brief.audience, "Everyone, twice");
  step("a second save follows the first, and the page says it is saved");

  // The service saves, and the answer is lost: the page asks again for the same request.
  let lose = 1;
  await page.route("**/api/v1/call", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.operation !== "yamakan.story.save" || lose-- <= 0)
      return route.continue();
    await route.fetch();
    await route.abort("connectionreset");
  });
  const revisionBefore = await head();
  await at("story-brief-tone").fill("Louder");
  await at("story-text-save").click();
  await at("story-text-done").waitFor();
  assert.equal(await head(), revisionBefore + 1, "it was saved once");
  assert.equal((await held()).content.brief.tone, "Louder");
  step("a save whose answer is lost is saved once and said as saved");
  lose = 2;
  await at("story-brief-tone").fill("Loudest");
  await at("story-text-save").click();
  await at("story-text-refused").waitFor();
  assert.equal(
    await at("story-text-refused").getAttribute("data-why"),
    "unknown",
  );
  assert.equal(await at("story-brief-tone").inputValue(), "Loudest");
  await page.unroute("**/api/v1/call");
  await at("story-text-reload").click();
  await at("story-text-done").waitFor();
  await at("story-text-refused").waitFor({ state: "detached" });
  assert.equal(await at("story-text-save").isDisabled(), true, "it was saved");
  assert.equal((await held()).content.brief.tone, "Loudest");
  step(
    "one lost twice is said as not known, and a reload shows that it is there",
  );

  // Undo waits for typed text, and text for a shot that is gone is kept and not saved.
  await at("story-brief-tone").fill("Not saved");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByText(UNDO_WAITS, { exact: true }).waitFor();
  assert.equal(await at("story-brief-tone").inputValue(), "Not saved");
  assert.equal((await held()).content.brief.tone, "Loudest");
  await at("story-text-discard").click();
  assert.equal(await at("story-brief-tone").inputValue(), "Loudest");
  if ((await at("story-shot-action").count()) !== 2)
    await open(scenes[0].id).click();
  await handsAction.fill("For a shot that will be gone");
  const whole = await held();
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: whole.contentHash,
    story: {
      ...whole.content,
      scenes: whole.content.scenes.map((s) =>
        s.id === scenes[0].id ? { ...s, shots: [s.shots[0]] } : s,
      ),
    },
  });
  await at("story-text-save").click();
  await at("story-text-refused").waitFor();
  await at("story-text-reload").click();
  await at("story-text-done").waitFor();
  assert.match(
    await at("story-text-under").innerText(),
    /no longer in the story[^]*For a shot that will be gone/,
  );
  assert.equal(await at("story-text-save").isDisabled(), true);
  const revisionGone = await head();
  await at("story-text-discard").click();
  await at("story-text-under").waitFor({ state: "detached" });
  assert.equal(await head(), revisionGone);
  const back = await held();
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: back.contentHash,
    story: whole.content,
  });
  await openStory();
  step(
    "undo waits for typed text, and text for a shot that is gone is kept, not saved",
  );

  // A second story of the project is a story of its own.
  const otherId = crypto.randomUUID();
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId: otherId,
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "Other",
      scenes: [
        { id: crypto.randomUUID(), name: "Only", shots: [shot("Only")] },
      ],
    },
  });
  await openStory();
  await at("story-text-which").selectOption(otherId);
  assert.equal(await at("story-brief-tone").inputValue(), "");
  await at("story-brief-tone").fill("Of the other");
  assert.equal(await at("story-text-which").isDisabled(), true);
  await at("story-text-save").click();
  await at("story-text-done").waitFor();
  assert.equal(
    (await call("yamakan.document.get", { projectId, documentId: otherId }))
      .content.brief.tone,
    "Of the other",
  );
  assert.equal((await held()).content.brief.tone, "Loudest");
  await openStory();
  await at("story-text-which").selectOption(documentId);
  step("each of two stories is read and saved as itself");

  await at("story-brief-languages").fill("ar, ar");
  const atLanguages = sent.length;
  await at("story-text-save").click();
  assert.equal(
    await at("story-text-refused").getAttribute("data-why"),
    "languages",
  );
  assert.equal(sent.length, atLanguages);
  await at("story-text-discard").click();
  step("a repeated language is said, and nothing is sent");

  // Nearly full, then pasted over.
  const tight = await held();
  const long = (n) => "ك".repeat(n);
  const fullStory = {
    ...tight.content,
    scenes: tight.content.scenes.map((s, i) =>
      i === 1
        ? {
            ...s,
            shots: Array.from({ length: 23 }, (_, n) =>
              shot(`Long ${n}`, { action: long(2_000) }),
            ),
          }
        : s,
    ),
  };
  await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: tight.contentHash,
    story: fullStory,
  });
  await openStory();
  await at("story-text-which").selectOption(documentId);
  const nearly = Number(
    await at("story-text-used").getAttribute("data-percent"),
  );
  assert.ok(nearly > 90 && nearly <= 100, `${nearly}`);
  const atFull = sent.length;
  await script(scenes[1].id).fill(long(4_000));
  const over = Number(await at("story-text-used").getAttribute("data-percent"));
  assert.ok(over > 100, `${over}`);
  await at("story-text-save").click();
  const said = await at("story-text-refused").innerText();
  assert.match(said, new RegExp(`${over}% full`));
  assert.ok(!/byte|98304/.test(said));
  assert.equal(sent.length, atFull);
  const kept = await held();
  assert.equal(kept.content.scenes[1].sceneText, "A street.");
  assert.equal(await script(scenes[1].id).inputValue(), long(4_000));
  const refusedByService = await call("yamakan.story.save", {
    projectId,
    expectedRevision: await head(),
    documentId,
    expectedContentHash: kept.contentHash,
    story: {
      ...kept.content,
      scenes: kept.content.scenes.map((s, i) =>
        i === 1 ? { ...s, sceneText: long(4_000) } : s,
      ),
    },
  }).then(
    () => null,
    (e) => e,
  );
  assert.equal(refusedByService?.code, "LIMIT_EXCEEDED");
  assert.match(
    refusedByService.message,
    /hold \d+ bytes of text; the limit is 98304\.$/,
  );
  assert.equal((await held()).contentHash, kept.contentHash);
  measured.percentNearlyFull = nearly;
  measured.percentOver = over;
  step(
    "text over the budget is refused in percents, and by the service in bytes",
    {
      said,
      service: refusedByService.message,
    },
  );

  // Typing in a story of 200 shots.
  const { id: bigId } = await call("yamakan.project.create", { name: "Big" });
  await call("yamakan.story.save", {
    projectId: bigId,
    expectedRevision: (await call("yamakan.project.open", { projectId: bigId }))
      .revision,
    documentId: crypto.randomUUID(),
    expectedContentHash: null,
    story: {
      format: "yamakan.story",
      formatVersion: 2,
      title: "Big",
      scenes: Array.from({ length: 2 }, (_, s) => ({
        id: crypto.randomUUID(),
        name: `Scene ${s + 1}`,
        sceneText: "Words of the scene. ".repeat(20),
        shots: Array.from({ length: 100 }, (_, n) =>
          shot(`Shot ${n + 1}`, {
            framing: "wide",
            action: "Something happens here. ".repeat(10),
          }),
        ),
      })),
    },
  });
  await openProject("Big");
  await tab("Story");
  await at("story-scene-open").first().click();
  assert.equal(await at("story-shot-action").count(), 100);
  // From each key's input event to the page as redrawn by it.
  measured.typingMs = await at("story-shot-action")
    .first()
    .evaluate(async (el) => {
      const set = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set;
      const used = document.querySelector('[data-testid="story-text-used"]');
      const took = [];
      for (let n = 0; n < 30; n++) {
        const began = performance.now();
        set.call(el, `${el.value}x`);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        // React draws an input event's change before the event's task ends.
        used.getBoundingClientRect();
        await Promise.resolve();
        used.getBoundingClientRect();
        took.push(performance.now() - began);
        // Drawn by then: the first key has made the story one to save.
        if (document.querySelector('[data-testid="story-text-save"]').disabled)
          throw new Error("The page was not drawn when the time was taken.");
        await new Promise((r) => requestAnimationFrame(r));
      }
      took.sort((a, b) => a - b);
      return {
        middle: Math.round(took[15] * 10) / 10,
        worst: Math.round(took.at(-1) * 10) / 10,
      };
    });
  measured.typingWithin50Ms = measured.typingMs.worst <= 50;
  step("typing in a 200-shot story is measured", measured.typingMs);

  // Arabic, right to left.
  await page.evaluate(() => localStorage.setItem("yamakan.lang", "ar"));
  await context.addInitScript(() => localStorage.setItem("yamakan.lang", "ar"));
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dir === "rtl" || document.dir === "rtl",
  );
  step("the page turns right to left in Arabic, whose words are unreviewed");
  assert.deepEqual(external, []);
  assert.deepEqual(pageErrors, []);
  step("no external requests and no page errors");
  passed = true;
} catch (e) {
  // The receipt may be committed, and an error can hold a local path naming the user.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  child.kill();
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
  writeFileSync(
    receipt,
    `${JSON.stringify(
      {
        task: "MPR-106",
        head: git("rev-parse", "HEAD"),
        dirty: git("status", "--porcelain") !== "",
        host,
        outcome: passed ? "PASS" : blocked ? "BLOCKED" : "FAIL",
        passed,
        failure,
        measured,
        steps,
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
console.log(`STORY BRIEF ${passed ? "PASS" : blocked ? "BLOCKED" : "FAIL"}`);
process.exit(passed ? 0 : 1);
