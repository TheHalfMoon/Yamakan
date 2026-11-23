import assert from "node:assert/strict";
import test from "node:test";
import { STORY_LIMITS, StoryDocumentSchema } from "../core/story.ts";
import {
  addMadeVideo,
  madeRecords,
  recordRequests,
} from "../src/create/create-story.ts";
import { parseReceipt } from "../src/create/create-model.ts";

let counter = 0;
const newId = () =>
  `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const hash = "a".repeat(64);
const copy = "b".repeat(64);
const receipt = {
  model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
  revision: "r",
  prompt: "A red kite.",
  seed: 7,
  steps: 30,
  sha256: hash,
  licence: "Apache-2.0",
};
const add = (...[story, v]: [any, any]) => {
  const out = addMadeVideo(story, v, newId);
  assert.equal(typeof out, "object");
  return out as Exclude<typeof out, string>;
};
const video = {
  assetId: newId(),
  assetHash: hash,
  durationTicks: 1000,
  receipt,
};

test("what is written is a story the project accepts", () => {
  const story = add(null, video);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  const shot = story.scenes[0].shots[0];
  assert.equal(shot.selectedTakeId, shot.takes[0].id);
  assert.equal(shot.takes[0].lineage.outputHash, hash);
  assert.equal(shot.durationTicks, 1000);
});

test("the extreme of what a receipt can hold is accepted too", () => {
  const story = add(null, {
    ...video,
    assetHash: copy,
    receipt: {
      ...receipt,
      prompt: `${"\u{1F600}".repeat(5000)}\nsecond line`,
      model: "m".repeat(200),
    },
  });
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  const take = story.scenes[0].shots[0];
  assert.match(take.takes[0].lineage.label, /^seed 7, steps 30, m+/);
  // No emoji is cut in half.
  assert.equal(take.intent!.action!.length, 2_000);
  assert.ok(!/[\uD800-\uDBFF]$/.test(take.intent!.action!));
  assert.ok(!/[\uD800-\uDBFF]…$/.test(take.name));
  // A blank first line still names the shot.
  const blank = add(null, { ...video, receipt: { ...receipt, prompt: "   " } });
  assert.doesNotThrow(() => StoryDocumentSchema.parse(blank));
});

test("a made video's prompt is written as the shot's action", () => {
  const shot = add(null, video).scenes[0].shots[0];
  assert.deepEqual(shot.intent, { action: "A red kite." });
  assert.equal(shot.notes, "");
  // A receipt that names an empty prompt leaves no intent behind.
  const silent = add(null, { ...video, receipt: { ...receipt, prompt: "" } });
  assert.doesNotThrow(() => StoryDocumentSchema.parse(silent));
  assert.ok(!("intent" in silent.scenes[0].shots[0]));
  assert.equal(madeRecords(silent)[hash].prompt, "");
});

test("made records read the action, and for older shots the note, which stays what it was", () => {
  const story = add(null, video);
  const [shot] = story.scenes[0].shots;
  const told = (over: object) =>
    madeRecords({
      ...story,
      scenes: [{ ...story.scenes[0], shots: [{ ...shot, ...over }] }],
    })[hash].prompt;
  assert.equal(told({}), "A red kite.");
  assert.equal(told({ intent: undefined, notes: "Before." }), "Before.");
  assert.equal(
    told({ intent: { framing: "wide" }, notes: "Before." }),
    "Before.",
  );
  // Words kept for an older shot do not take its prompt's place in the list.
  assert.equal(
    told({ intent: { action: "Kept since." }, notes: "Before." }),
    "Before.",
  );
  // A newer shot's action is the shot's own text, whoever wrote it last: the page says so.
  assert.equal(told({ intent: { action: "Edited." } }), "Edited.");
  for (const odd of [
    { intent: 7, notes: 7 },
    { intent: { action: 7 }, notes: null },
  ])
    assert.equal(told(odd), "");
});

test("a record reads back by the stored file's hash", () => {
  const story = addMadeVideo(null, video, newId);
  assert.deepEqual(madeRecords(story)[hash], {
    label: "seed 7, steps 30, Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    prompt: "A red kite.",
    converted: false,
  });
});

test("a converted copy says so, under its own hash", () => {
  const story = add(null, { ...video, assetHash: copy });
  const records = madeRecords(story);
  assert.equal(records[hash], undefined);
  assert.equal(records[copy].converted, true);
  assert.ok(!records[copy].label.includes("converted"));
});

test("videos add to one story, and the same one only once", () => {
  const first = add(null, video);
  assert.equal(addMadeVideo(first, video, newId), "already-there");
  const second = add(first, {
    ...video,
    assetId: newId(),
    assetHash: copy,
    receipt: { ...receipt, sha256: copy },
  });
  assert.equal(second.scenes.length, 1);
  assert.equal(second.scenes[0].shots.length, 2);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(second));
  assert.equal(first.scenes[0].shots.length, 1, "the earlier one is unchanged");
});

// Unique shots up to a count, in full scenes.
const filled = (count: number) => {
  let story: any = null;
  for (let i = 0; i < count; i++)
    story = add(story, { ...video, assetId: newId() });
  return story;
};

test("a full scene starts another, and the earlier ones stay", () => {
  const story = filled(STORY_LIMITS.shotsPerScene + 1);
  assert.equal(story.scenes.length, 2);
  assert.equal(story.scenes[0].shots.length, STORY_LIMITS.shotsPerScene);
  assert.equal(story.scenes[1].shots.length, 1);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  const more = add(story, { ...video, assetId: newId() });
  assert.equal(more.scenes[0].shots.length, STORY_LIMITS.shotsPerScene);
  assert.equal(more.scenes[1].shots.length, 2);
});

test("a story with no room says so, at the real limit", () => {
  const story = filled(STORY_LIMITS.shots);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  assert.equal(
    addMadeVideo(story, { ...video, assetId: newId() }, newId),
    "full",
  );
});

test("anything else reads as no records", () => {
  for (const other of [null, 7, "x", {}, { scenes: 3 }, { scenes: [{}] }])
    assert.deepEqual(madeRecords(other), {});
  assert.deepEqual(
    madeRecords({
      scenes: [{ shots: [{ takes: [{ lineage: { label: 1 } }, {}] }] }],
    }),
    {},
  );
});

// So the project's record of it does not read as if made from the prompt alone.
test("a take made from a picture names it as its input, and the project accepts it", () => {
  const still = { assetId: newId(), assetHash: "c".repeat(64) };
  const story = add(null, {
    ...video,
    assetId: newId(),
    receipt: { ...receipt, inputs: [still] },
  });
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  assert.deepEqual(story.scenes[0].shots[0].takes[0].lineage.inputs, [still]);
  // One from a prompt, or brought in by hand, names none.
  const plain = add(null, { ...video, assetId: newId() });
  assert.deepEqual(plain.scenes[0].shots[0].takes[0].lineage.inputs, []);
});

test("a run from a picture is pinned to the version the page knows, and one without none", async () => {
  const { picturePins } = await import("../src/create/create-model.ts");
  const find = (id: string) =>
    id === "still" ? { hash: "c".repeat(64) } : undefined;
  assert.deepEqual(picturePins({ id: "still" }, find), [
    { assetId: "still", assetHash: "c".repeat(64) },
  ]);
  assert.deepEqual(picturePins({ id: "gone" }, find), []);
  assert.deepEqual(picturePins(undefined, find), []);
});

test("a made video asks for its run's record, or declares its receipt", () => {
  const story = add(null, video);
  const takeId = story.scenes[0].shots[0].takes[0].id;
  assert.deepEqual(recordRequests(story, video.assetId, receipt, "run"), [
    { takeId, from: { generationId: "run" } },
  ]);
  assert.deepEqual(recordRequests(story, video.assetId, receipt), [
    {
      takeId,
      from: {
        declared: {
          model: receipt.model,
          revision: "r",
          prompt: "A red kite.",
          seed: 7,
          steps: 30,
          licence: "Apache-2.0",
        },
      },
    },
  ]);
  // What a receipt leaves empty is left out, and without a model there is nothing to declare.
  const [bare] = recordRequests(story, video.assetId, {
    ...receipt,
    revision: "",
    licence: null,
  });
  assert.deepEqual(bare!.from, {
    declared: {
      model: receipt.model,
      prompt: "A red kite.",
      seed: 7,
      steps: 30,
    },
  });
  assert.deepEqual(
    recordRequests(story, video.assetId, { ...receipt, model: "" }),
    [],
  );
  // One already recorded, or not in the story, asks for nothing.
  assert.deepEqual(recordRequests(story, newId(), receipt), []);
  story.scenes[0].shots[0].takes[0].recordHash = hash;
  assert.deepEqual(recordRequests(story, video.assetId, receipt), []);
});

test("a prompt this page cuts is declared whole, or not at all", () => {
  const read = (prompt: string) =>
    parseReceipt(
      JSON.stringify({
        ...receipt,
        format: "yamakan.generation-receipt/v1",
        stage: "done",
        verified: true,
        prompt,
      }),
    );
  const declared = (prompt: string) => {
    const r = read(prompt);
    const [request] = recordRequests(
      add(null, { ...video, receipt: r }),
      video.assetId,
      r,
    );
    return request && "declared" in request.from
      ? request.from.declared.prompt.length
      : null;
  };
  assert.deepEqual(
    [2000, 2001, 4000, 4001].map((n) => declared("x".repeat(n))),
    [2000, 2001, 4000, null],
  );
  assert.equal(read("x".repeat(3000)).prompt.length, 2000);
});

test("a story of the older form is written in the newer one", () => {
  const older = { ...add(null, video), formatVersion: 1 };
  const next = add(older, { ...video, assetId: newId() });
  assert.doesNotThrow(() => StoryDocumentSchema.parse(next));
});
