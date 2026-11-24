// MPR-104: a story's shots as cards, from what the commands answer (src/story/shot-cards.ts).
import test from "node:test";
import assert from "node:assert/strict";
import {
  attemptKey,
  attemptsPage,
  madeTake,
  morePages,
  moveFocus,
  shotCards,
  takeFacts,
  usedKey,
  type Attempt,
} from "../src/story/shot-cards.ts";
import { MESSAGES } from "../src/i18n.ts";

const take = (id: string, over: object = {}) => ({
  id,
  assetId: `asset-${id}`,
  assetHash: "a".repeat(64),
  kind: "video",
  sourceStartTicks: 0,
  lineage: null,
  recordHash: "b".repeat(64),
  ...over,
});
const list = (shots: object[]) => ({
  documentId: "d",
  contentHash: "c".repeat(64),
  revision: 3,
  orphans: [],
  orphanTotal: 0,
  shots,
});
const shot = (over: object = {}) => ({
  sceneId: "s",
  shotId: "one",
  name: "Harbour",
  durationTicks: 705_600_000,
  selectedTakeId: "t1",
  timeline: { currentTakeId: "t2" },
  problem: null,
  takes: [take("t1"), take("t2", { kind: "image" })],
  ...over,
});

test("a take list becomes cards with the shown take marked", () => {
  const [card, ...more] = shotCards(
    list([
      shot(),
      shot({ shotId: "two", timeline: null, problem: "Split.", takes: [] }),
    ]),
  )!;
  assert.deepEqual(card, {
    documentId: "d",
    shotId: "one",
    name: "Harbour",
    durationTicks: 705_600_000,
    problem: null,
    takes: [
      {
        takeId: "t1",
        kind: "video",
        assetId: "asset-t1",
        shown: false,
        recordHash: "b".repeat(64),
      },
      {
        takeId: "t2",
        kind: "image",
        assetId: "asset-t2",
        shown: true,
        recordHash: "b".repeat(64),
      },
    ],
  });
  // A shot with a problem, or with no take, is still a card.
  assert.deepEqual(
    more.map((c) => [c.shotId, c.problem, c.takes]),
    [["two", "Split.", []]],
  );
  assert.deepEqual(shotCards(list([])), []);
});

test("a list without record hashes still becomes cards", () => {
  const { recordHash: _, ...older } = take("t1");
  const [card] = shotCards(list([shot({ takes: [older] })]))!;
  // Not said is not the same as none.
  assert.equal(card!.takes[0]!.recordHash, undefined);
  const [none] = shotCards(
    list([shot({ takes: [take("t1", { recordHash: null })] })]),
  )!;
  assert.equal(none!.takes[0]!.recordHash, null);
});

test("an answer that is not of the form is not known", () => {
  for (const odd of [
    null,
    "x",
    {},
    { documentId: "d" },
    list([shot({ name: 7 })]),
    list([shot({ takes: {} })]),
    list([shot({ durationTicks: -1 })]),
    list([shot({ takes: [{ id: 7 }] })]),
  ])
    assert.equal(shotCards(odd), null);
});

test("arrow keys move one step and mirror in a right-to-left interface", () => {
  assert.equal(moveFocus(1, "ArrowRight", false, 3), 2);
  assert.equal(moveFocus(1, "ArrowLeft", false, 3), 0);
  assert.equal(moveFocus(1, "ArrowRight", true, 3), 0);
  assert.equal(moveFocus(1, "ArrowLeft", true, 3), 2);
  // They stop at the ends.
  assert.equal(moveFocus(2, "ArrowRight", false, 3), 2);
  assert.equal(moveFocus(0, "ArrowRight", true, 3), 0);
  for (const key of ["ArrowUp", "Tab", "a", "Escape"])
    assert.equal(moveFocus(1, key, false, 3), null, key);
});

test("Home and End go to the ends; a single take does not move", () => {
  assert.equal(moveFocus(1, "Home", false, 3), 0);
  assert.equal(moveFocus(1, "End", true, 3), 2);
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"])
    assert.equal(moveFocus(0, key, false, 1), 0, key);
});

const record = (over: object = {}, request: object = {}) => ({
  recordHash: "b".repeat(64),
  record: {
    origin: "generation",
    model: { id: "m/one" },
    request: {
      kind: "generation",
      seed: 7,
      width: 704,
      height: 480,
      ...request,
    },
    derivedFromTakeId: "t1",
    changedFields: ["seed"],
    revisionNote: "Too low.",
    ...over,
  },
});

test("how a take was made is its record's, with its level", () => {
  assert.deepEqual(takeFacts(record()), {
    level: "L1",
    origin: "generation",
    model: "m/one",
    seed: 7,
    width: 704,
    height: 480,
    derivedFromTakeId: "t1",
    changedFields: ["seed"],
    revisionNote: "Too low.",
  });
  for (const [origin, level] of [
    ["render", "L3"],
    ["declared", "L0"],
    ["constructor", "L0"],
  ])
    assert.equal(takeFacts(record({ origin }))!.level, level, origin);
  // What it does not hold is not known, and not nothing.
  const silent = takeFacts(
    record(
      {
        model: null,
        derivedFromTakeId: null,
        changedFields: undefined,
        revisionNote: null,
      },
      { seed: null, width: null },
    ),
  )!;
  assert.deepEqual(
    [
      silent.model,
      silent.seed,
      silent.width,
      silent.changedFields,
      silent.revisionNote,
    ],
    [null, null, null, [], null],
  );
  for (const odd of [
    null,
    {},
    { record: {} },
    { record: { origin: "generation" } },
  ])
    assert.equal(takeFacts(odd), null);
});

const attempt = (seq: number, over: Partial<Attempt> = {}): Attempt => ({
  seq,
  id: `run-${seq}`,
  kind: "generation",
  outcome: "succeeded",
  sent: true,
  imported: true,
  startedAt: 1_000,
  wallMs: 2_000,
  quotaSeconds: null,
  takeId: `t${seq}`,
  takeInShot: true,
  diagnostic: null,
  ...over,
});
const history = (attempts: object[], over: object = {}) => ({
  attempts,
  next: null,
  gaps: [],
  totals: {
    attempts: attempts.length,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    running: 0,
    uncertain: 0,
    takes: 0,
    replacements: 0,
    wallMs: 0,
    wallMsUnknown: 0,
    quotaSeconds: 0,
    quotaUnknown: attempts.length,
    complete: true,
  },
  ...over,
});

test("an attempt whose use is not known says so, and is never zero", () => {
  const page = attemptsPage(
    history([
      attempt(3, { quotaSeconds: 0 }),
      attempt(2),
      {
        ...attempt(1),
        kind: "render",
        startedAt: undefined,
        wallMs: undefined,
        quotaSeconds: "x",
      },
    ]),
  )!;
  assert.deepEqual(
    page.attempts.map((a) => [a.quotaSeconds, a.startedAt, a.wallMs]),
    [
      [0, 1_000, 2_000],
      [null, 1_000, 2_000],
      [null, null, null],
    ],
  );
  assert.equal(usedKey(null), "shot.attempt.notKnown");
  assert.equal(usedKey(0), "shot.attempt.seconds");
});

test("each outcome is told apart, and one refused before it was sent from one that failed", () => {
  const keys = (
    ["running", "succeeded", "failed", "cancelled", "uncertain"] as const
  ).map((outcome) => attemptKey(attempt(1, { outcome })));
  assert.equal(new Set(keys).size, 5);
  const refused = attemptKey(attempt(1, { outcome: "failed", sent: false }));
  assert.equal(refused, "shot.attempt.refused");
  assert.ok(!keys.includes(refused));
  // Not sent, and not failed, is no refusal.
  assert.equal(
    attemptKey(attempt(1, { outcome: "cancelled", sent: false })),
    "shot.attempt.cancelled",
  );
  for (const lang of ["en", "ar"] as const) {
    const words: string[] = [...keys, refused].map(
      (k): string => MESSAGES[lang][k],
    );
    assert.equal(new Set(words).size, 6, lang);
  }
});

test("a page of attempts goes on from `next`, newest first", () => {
  const first = attemptsPage(history([attempt(9), attempt(8)], { next: 8 }))!;
  assert.equal(first.next, 8);
  const second = attemptsPage(
    history([attempt(8), attempt(7)], {
      next: null,
      gaps: ["scan-limit", "another"],
    }),
  )!;
  const both = morePages(first, second);
  assert.deepEqual(
    both.attempts.map((a) => a.seq),
    [9, 8, 7],
  );
  assert.equal(both.next, null);
  // One the page has no words for is still said.
  assert.deepEqual(both.gaps, ["scan-limit", "other"]);
});

test("a history that is not of the form is not known", () => {
  for (const odd of [
    null,
    {},
    history([{ ...attempt(1), outcome: "odd" }]),
    history([{ ...attempt(1), sent: undefined }]),
    history([{ ...attempt(1), kind: "other" }]),
    { ...history([]), totals: { attempts: 0 } },
    // An incomplete history would look like a whole one.
    history([], { gaps: undefined }),
    history([], { gaps: "scan-limit" }),
    history([], { next: undefined }),
    history([], { next: "8" }),
    history([], { next: -1 }),
  ])
    assert.equal(attemptsPage(odd), null);
});

test("the take an attempt made is named, and none is told from not known", () => {
  const [card] = shotCards(list([shot()]))!;
  const made = (over: Partial<Attempt>) =>
    madeTake(attempt(1, over), card!.takes);
  assert.deepEqual(made({ takeId: "t2" }), { n: 2 });
  assert.equal(made({ takeId: "t9", takeInShot: false }), "shot.take.gone");
  // The history was read after the card, and has a take that the card has not.
  assert.equal(made({ takeId: "t9" }), "shot.attempt.takeLater");
  assert.equal(made({ takeId: null, imported: false }), "shot.attempt.noTake");
  // What came in may have been a take, taken out again since.
  for (const imported of [true, null])
    assert.equal(made({ takeId: null, imported }), "shot.attempt.notKnown");
  const read = attemptsPage(
    history([
      attempt(2, { takeId: null, imported: false }),
      { ...attempt(1), imported: "no" },
    ]),
  )!;
  assert.deepEqual(
    read.attempts.map((a) => a.imported),
    [false, null],
  );
});

test("a moment no date can hold is not known", () => {
  const [last, past] = attemptsPage(
    history([
      attempt(2, { startedAt: 8_640_000_000_000_000 }),
      attempt(1, { startedAt: 8_640_000_000_000_001 }),
    ]),
  )!.attempts;
  assert.equal(last!.startedAt, 8_640_000_000_000_000);
  assert.equal(past!.startedAt, null);
});
