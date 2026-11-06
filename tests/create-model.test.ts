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
