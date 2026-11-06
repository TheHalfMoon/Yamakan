import assert from "node:assert/strict";
import test from "node:test";
import { StoryDocumentSchema } from "../core/story.ts";
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
const video = {
  assetId: newId(),
  assetHash: hash,
  durationTicks: 1000,
  receipt,
};

test("what is written is a story the project accepts", () => {
  const story = addMadeVideo(null, video, newId)!;
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  const shot = story.scenes[0].shots[0];
  assert.equal(shot.notes, "A red kite.");
  assert.equal(shot.selectedTakeId, shot.takes[0].id);
  assert.equal(shot.takes[0].lineage.outputHash, hash);
});

test("the extreme of what a receipt can hold is accepted too", () => {
  const story = addMadeVideo(
    null,
    {
      ...video,
      assetHash: copy,
      receipt: {
        ...receipt,
        prompt: `${"م".repeat(5000)}\nsecond line`,
        model: "m".repeat(200),
      },
    },
    newId,
  )!;
  assert.doesNotThrow(() => StoryDocumentSchema.parse(story));
  // A blank first line still names the shot.
  const blank = addMadeVideo(
    null,
    { ...video, receipt: { ...receipt, prompt: "   " } },
    newId,
  )!;
  assert.doesNotThrow(() => StoryDocumentSchema.parse(blank));
});

test("a record reads back by the stored file's hash", () => {
  const story = addMadeVideo(null, video, newId);
  assert.deepEqual(madeRecords(story)[hash], {
    label: "Wan-AI/Wan2.2-TI2V-5B-Diffusers, seed 7, steps 30",
    prompt: "A red kite.",
    converted: false,
  });
});

test("a converted copy says so, under its own hash", () => {
  const story = addMadeVideo(null, { ...video, assetHash: copy }, newId);
  const records = madeRecords(story);
  assert.equal(records[hash], undefined);
  assert.equal(records[copy].converted, true);
  assert.ok(!records[copy].label.includes("converted"));
});

test("videos add to one story, and the same one only once", () => {
  const first = addMadeVideo(null, video, newId)!;
  assert.equal(addMadeVideo(first, video, newId), null);
  const second = addMadeVideo(
    first,
    {
      ...video,
      assetId: newId(),
      assetHash: copy,
      receipt: { ...receipt, sha256: copy },
    },
    newId,
  )!;
  assert.equal(second.scenes.length, 1);
  assert.equal(second.scenes[0].shots.length, 2);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(second));
  assert.equal(first.scenes[0].shots.length, 1, "the earlier one is unchanged");
});

test("a story with no room says so", () => {
  let story = addMadeVideo(null, video, newId)!;
  story = {
    ...story,
    scenes: [
      {
        ...story.scenes[0],
        shots: Array.from({ length: 200 }, () => story.scenes[0].shots[0]),
      },
    ],
  };
  assert.equal(
    addMadeVideo(story, { ...video, assetId: newId() }, newId),
    null,
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
