import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREATE_MODELS,
  composePrompt,
  emptyBrief,
  parseReceipt,
  readBrief,
  sha256Of,
  choiceOf,
  mayStart,
  startRequest,
  startingStills,
  validSeed,
} from "../src/create/create-model.ts";

const receipt = {
  format: "yamakan.generation-receipt/v1",
  stage: "done",
  verified: true,
  model: "zai-org/CogVideoX-2b",
  revision: "1137dac",
  prompt: "A boat.",
  seed: 42,
  steps: 50,
  license: "apache-2.0",
  sha256: "a".repeat(64),
};

test("the prompt given to a model is exactly the words shown", () => {
  const brief = emptyBrief();
  assert.equal(composePrompt(brief), "");
  brief.prompt = "  A boat on a stream.  ";
  assert.equal(composePrompt(brief), "A boat on a stream.");
  brief.direction = { shot: "wide", movement: "pan" };
  assert.equal(
    composePrompt(brief),
    "A boat on a stream. wide shot, slow pan.",
  );
  brief.prompt = "";
  assert.equal(composePrompt(brief), "wide shot, slow pan");
});

test("a direction not on the list adds nothing", () => {
  const brief = emptyBrief();
  brief.prompt = "A boat";
  brief.direction = { shot: "constructor", lens: "made-up" };
  assert.equal(composePrompt(brief), "A boat");
});

test("a kept brief is read as untrusted", () => {
  assert.deepEqual(readBrief(null), emptyBrief());
  assert.deepEqual(readBrief("not json"), emptyBrief());
  const brief = readBrief(
    JSON.stringify({
      prompt: "x".repeat(5000),
      modelId: "paid/other-model",
      seed: -1,
      direction: { shot: "wide", lens: "made-up", other: "x" },
    }),
  );
  assert.equal(brief.prompt.length, 2000);
  assert.equal(brief.modelId, CREATE_MODELS[0].id);
  assert.equal(brief.seed, 42);
  assert.deepEqual(brief.direction, { shot: "wide" });
});

test("seeds are whole numbers a model can take", () => {
  assert.ok(validSeed(0));
  assert.ok(validSeed(2 ** 32 - 1));
  for (const bad of [-1, 1.5, 2 ** 32, Number.NaN]) assert.ok(!validSeed(bad));
});

test("a finished receipt is read", () => {
  const read = parseReceipt(JSON.stringify(receipt));
  assert.equal(read.sha256, receipt.sha256);
  assert.equal(read.seed, 42);
  assert.equal(read.licence, "apache-2.0");
});

test("the repository's real receipts are readable", () => {
  for (const name of ["first-ai-video-receipt", "wan22-first-video-receipt"]) {
    let text: string;
    try {
      text = readFileSync(`docs/evidence/ultimate/${name}.json`, "utf8");
    } catch {
      continue; // The Wan receipt arrives with its own change.
    }
    assert.match(parseReceipt(text).sha256, /^[a-f0-9]{64}$/);
  }
});

test("anything else is refused, and says why", () => {
  assert.throws(() => parseReceipt("nope"), /not-json/);
  assert.throws(() => parseReceipt("{}"), /not-receipt/);
  assert.throws(
    () => parseReceipt(JSON.stringify({ ...receipt, stage: "failed" })),
    /not-finished/,
  );
  // A run can finish and fail its own checks.
  assert.throws(
    () => parseReceipt(JSON.stringify({ ...receipt, verified: false })),
    /not-finished/,
  );
  for (const change of [
    { sha256: "short" },
    { sha256: "A".repeat(64) },
    { seed: "42" },
    { seed: -1 },
    { steps: 0 },
    { prompt: 7 },
  ])
    assert.throws(
      () => parseReceipt(JSON.stringify({ ...receipt, ...change })),
      /not-receipt/,
    );
});

test("a hash is of the bytes", async () => {
  assert.equal(
    await sha256Of(new TextEncoder().encode("abc").buffer),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("a model that reads only part of a prompt says so, in both languages", async () => {
  const reads = Object.fromEntries(
    CREATE_MODELS.map((m) => [m.name, m.readsAboutWords]),
  );
  assert.deepEqual(reads, { "Wan2.2-TI2V-5B": null, "CogVideoX-2b": 150 });
  const { MESSAGES } = await import("../src/i18n.ts");
  for (const language of Object.values(MESSAGES) as Record<string, string>[])
    assert.match(language["create.readsLittle"], /\{words\}/);
});

test("a run from a picture is offered only the project's PNG and JPEG stills", () => {
  assert.deepEqual(
    startingStills([
      { id: "a", kind: "image", name: "boat.png" },
      { id: "b", kind: "image", name: "kite.JPG" },
      { id: "c", kind: "image", name: "hill.jpeg" },
      { id: "d", kind: "image", name: "sky.webp" },
      { id: "e", kind: "video", name: "clip.png" },
      { id: "f", kind: "image", name: "png" },
    ]),
    [
      { id: "a", name: "boat.png" },
      { id: "b", name: "kite.JPG" },
      { id: "c", name: "hill.jpeg" },
    ],
  );
});

test("a run from a picture says the picture leaves, in both languages", async () => {
  const { MESSAGES } = await import("../src/i18n.ts");
  const [english, arabic] = [MESSAGES.en, MESSAGES.ar] as Record<
    string,
    string
  >[];
  assert.match(english["create.agreePicture"], /picture leave this computer/);
  assert.match(english["create.agreePicture"], /withdrawing consent later/);
  assert.match(english["create.noRealPerson"], /no real person/);
  for (const language of [english, arabic]) {
    assert.match(language["create.agreePicture"], /\{minutes\}/);
    for (const key of [
      "create.picture",
      "create.pictureNone",
      "create.pictureNote",
      "create.noRealPerson",
    ])
      assert.ok(language[key], key);
  }
});

// The page sends what the person chose, and only with their word about who it shows.
test("a start from a picture carries the still and the person's word, and needs both ticks", () => {
  const model = {
    recipeId: "kaggle-wan22-ti2v-5b-first-frame",
    name: "Wan2.2-TI2V-5B",
    operation: "imageToVideo" as const,
    model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    revision: "r",
    licence: "Apache-2.0",
    width: 704,
    height: 480,
    frames: 81,
    fps: 24,
    steps: 30,
    expectedSeconds: 1200,
    timeoutSeconds: 3600,
    notebook: "https://www.kaggle.com/code/someone/notebook",
  };
  const base = { model, prompt: "A boat.", seed: 7, projectFps: 30 };
  assert.deepEqual(
    startRequest({ ...base, picture: { id: "still" }, noPerson: true }),
    {
      recipeId: model.recipeId,
      prompt: "A boat.",
      seed: 7,
      width: 704,
      height: 480,
      durationFrames: 101,
      firstFrameAssetId: "still",
      noUnconsentedPerson: true,
    },
  );
  assert.throws(() =>
    startRequest({ ...base, picture: { id: "still" }, noPerson: false }),
  );
  const fromPrompt = startRequest({
    ...base,
    picture: undefined,
    noPerson: true,
  });
  assert.equal("firstFrameAssetId" in fromPrompt, false);
  assert.equal("noUnconsentedPerson" in fromPrompt, false);
  assert.equal(
    mayStart({ agreed: true, picture: undefined, noPerson: false }),
    true,
  );
  assert.equal(
    mayStart({ agreed: false, picture: undefined, noPerson: true }),
    false,
  );
  assert.equal(
    mayStart({ agreed: true, picture: { id: "s" }, noPerson: false }),
    false,
  );
  assert.equal(
    mayStart({ agreed: false, picture: { id: "s" }, noPerson: true }),
    false,
  );
  assert.equal(
    mayStart({ agreed: true, picture: { id: "s" }, noPerson: true }),
    true,
  );
});

// A tick counts only for what it was given on, so switching away and back asks again.
test("a tick given for one model or picture does not count for another", () => {
  const given = choiceOf("first-frame", "still-a");
  assert.equal(given, choiceOf("first-frame", "still-a"));
  for (const other of [
    choiceOf("first-frame", "still-b"),
    choiceOf("first-frame"),
    choiceOf("text", "still-a"),
    choiceOf("text"),
  ])
    assert.notEqual(given, other);
  // Names cannot run together into another choice's.
  assert.notEqual(choiceOf("a|b"), choiceOf("a", "b"));
});
