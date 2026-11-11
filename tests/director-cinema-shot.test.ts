// The Director's Cinema shot on the page: which shots are offered, and the story with an
// approved render as the shot's selected take, which the service accepts as a story.
import test from "node:test";
import assert from "node:assert/strict";
import {
  shotChoices,
  withRenderedTake,
  type KeptStory,
} from "../src/director/cinemaShot.ts";
import { StoryDocumentSchema, type StoryDocument } from "../core/story.ts";

const shot = (id: string, name: string, takes = 0) => ({
  id,
  name,
  durationTicks: 705_600_000,
  notes: "",
  referencePacks: [],
  takes: Array.from({ length: takes }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    assetId: "11111111-1111-4111-8111-111111111111",
    sourceStartTicks: 0,
  })),
  selectedTakeId: null,
});
const story = (
  title: string,
  shots: ReturnType<typeof shot>[],
): StoryDocument =>
  StoryDocumentSchema.parse({
    format: "yamakan.story",
    formatVersion: 1,
    title,
    scenes: [
      { id: "22222222-2222-4222-8222-222222222222", name: "Scene", shots },
    ],
  });
const A = "33333333-3333-4333-8333-333333333333";
const B = "44444444-4444-4444-8444-444444444444";
const kept = (documentId: string, s: StoryDocument): KeptStory => ({
  documentId,
  contentHash: "a".repeat(64),
  story: s,
});

test("every shot of every story is offered, labelled by story, scene and shot", () => {
  const choices = shotChoices([
    kept("d1", story("First", [shot(A, "Opening"), shot(B, "Closing")])),
    kept("d2", story("Second", [])),
  ]);
  assert.deepEqual(choices, [
    { documentId: "d1", shotId: A, label: "First › Scene › Opening" },
    { documentId: "d1", shotId: B, label: "First › Scene › Closing" },
  ]);
});

test("an approved render becomes the shot's selected take, and the story stays valid", () => {
  const before = story("First", [shot(A, "Opening", 1), shot(B, "Closing")]);
  const take = {
    id: "55555555-5555-4555-8555-555555555555",
    assetId: "66666666-6666-4666-8666-666666666666",
    outputHash: "b".repeat(64),
    label: "Blender: shot medium, movement orbit",
  };
  const after = withRenderedTake(before, A, take);
  assert.ok(!("refused" in after));
  const opened = (after as StoryDocument).scenes[0].shots[0];
  assert.equal(opened.takes.length, 2);
  assert.equal(opened.selectedTakeId, take.id);
  assert.deepEqual(opened.takes[1].lineage, {
    label: take.label,
    outputHash: take.outputHash,
    inputs: [],
  });
  // The other shot is untouched; the story is still one the service accepts.
  assert.deepEqual(
    (after as StoryDocument).scenes[0].shots[1],
    before.scenes[0].shots[1],
  );
  StoryDocumentSchema.parse(after);
});

test("a missing shot, or one with all its takes, is refused", () => {
  const s = story("First", [shot(A, "Opening", 8)]);
  const take = {
    id: "55555555-5555-4555-8555-555555555555",
    assetId: "66666666-6666-4666-8666-666666666666",
    outputHash: "b".repeat(64),
    label: "x".repeat(300),
  };
  assert.deepEqual(withRenderedTake(s, A, take), { refused: "full" });
  assert.deepEqual(withRenderedTake(s, B, take), { refused: "noShot" });
  // A long label is cut to what a take's label may hold.
  const fits = withRenderedTake(story("First", [shot(A, "Opening")]), A, take);
  StoryDocumentSchema.parse(fits);
});
