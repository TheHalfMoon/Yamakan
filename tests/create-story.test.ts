import assert from "node:assert/strict";
import test from "node:test";
import { STORY_LIMITS, StoryDocumentSchema } from "../core/story.ts";
import { addMadeVideo, madeRecords } from "../src/create/create-story.ts";

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
  assert.equal(shot.notes, "A red kite.");
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
  assert.ok(!/[\uD800-\uDBFF]$/.test(take.notes));
  assert.ok(!/[\uD800-\uDBFF]…$/.test(take.name));
  // A blank first line still names the shot.
  const blank = add(null, { ...video, receipt: { ...receipt, prompt: "   " } });
  assert.doesNotThrow(() => StoryDocumentSchema.parse(blank));
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
