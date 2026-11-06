// What Create writes for a reusable element must be a pack and a story the project itself
// accepts, and must never be a person's likeness, which needs consent this does not ask.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ReferencePackSchema,
  STORY_LIMITS,
  StoryDocumentSchema,
} from "../core/story.ts";
import {
  ELEMENT_ROLES,
  asElement,
  newElementPack,
  pinElement,
  unpinElement,
  validElementName,
  withImage,
} from "../src/create/create-elements.ts";
import { addMadeVideo } from "../src/create/create-story.ts";

const hash = "a".repeat(64);
const other = "b".repeat(64);
const image = { assetId: randomUUID(), assetHash: hash, name: "Harbour.png" };

const receipt = {
  model: "m",
  revision: "r",
  prompt: "A kite.",
  seed: 7,
  steps: 30,
  sha256: hash,
  licence: "Apache-2.0",
} as never;
const story = () => {
  const made = addMadeVideo(
    null,
    { assetId: randomUUID(), assetHash: hash, durationTicks: 1000, receipt },
    randomUUID,
  );
  assert.equal(typeof made, "object");
  return made as Exclude<typeof made, string>;
};

test("every kind of element is a pack the project accepts", () => {
  for (const role of ELEMENT_ROLES) {
    const pack = newElementPack("The harbour", role, image, randomUUID);
    assert.doesNotThrow(() => ReferencePackSchema.parse(pack), role);
    assert.equal(pack.entries[0].consentId, null);
    assert.equal(pack.entries[0].characterId, null);
  }
});

test("no element can be a person's likeness or voice", () => {
  for (const role of ["character", "voice"])
    assert.ok(!(ELEMENT_ROLES as readonly string[]).includes(role));
  // Another tool's pack with a likeness in it is not shown here as an element.
  const likeness = {
    format: "yamakan.reference-pack",
    formatVersion: 1,
    name: "Someone",
    entries: [
      {
        id: randomUUID(),
        role: "character",
        label: "Someone",
        assetId: randomUUID(),
        assetHash: hash,
        characterId: "someone",
        consentId: randomUUID(),
      },
    ],
  };
  assert.equal(asElement(likeness), null);
  assert.equal(asElement({ format: "yamakan.story" }), null);
  assert.equal(asElement(null), null);
  const made = newElementPack("The harbour", "prop", image, randomUUID);
  assert.deepEqual(asElement(made), made);
});

test("a name is what it says, within what a pack can hold", () => {
  assert.equal(validElementName("   "), false);
  assert.equal(validElementName(" A "), true);
  const long = newElementPack("x".repeat(500), "prop", image, randomUUID);
  assert.doesNotThrow(() => ReferencePackSchema.parse(long));
  assert.equal(newElementPack("  A  ", "prop", image, randomUUID).name, "A");
  const unnamed = newElementPack(
    "A",
    "prop",
    { ...image, name: "   " },
    randomUUID,
  );
  assert.doesNotThrow(() => ReferencePackSchema.parse(unnamed));
});

test("an element takes more images, up to what a pack can hold", () => {
  let pack = newElementPack("A", "prop", image, randomUUID);
  for (let i = 1; i < STORY_LIMITS.entriesPerPack; i++) {
    const next = withImage(pack, "prop", image, randomUUID);
    assert.notEqual(next, "full");
    pack = next as typeof pack;
  }
  assert.equal(pack.entries.length, STORY_LIMITS.entriesPerPack);
  assert.doesNotThrow(() => ReferencePackSchema.parse(pack));
  assert.equal(withImage(pack, "prop", image, randomUUID), "full");
});

test("a shot pins an element's version, and the story is still one the project accepts", () => {
  const start = story();
  const shot = start.scenes[0].shots[0];
  const documentId = randomUUID();
  const pinned = pinElement(start, shot.id, {
    documentId,
    contentHash: hash,
  });
  assert.notEqual(pinned, "full");
  const kept = pinned as typeof start;
  assert.doesNotThrow(() => StoryDocumentSchema.parse(kept));
  assert.deepEqual(kept.scenes[0].shots[0].referencePacks, [
    { documentId, contentHash: hash },
  ]);
  // The take the video came from is untouched.
  assert.deepEqual(kept.scenes[0].shots[0].takes, shot.takes);
  assert.deepEqual(start.scenes[0].shots[0].referencePacks, []);
});

test("pinning a newer version moves the pin, and a shot pins an element once", () => {
  const start = story();
  const shot = start.scenes[0].shots[0];
  const documentId = randomUUID();
  const once = pinElement(start, shot.id, { documentId, contentHash: hash });
  const twice = pinElement(once as typeof start, shot.id, {
    documentId,
    contentHash: other,
  }) as typeof start;
  assert.doesNotThrow(() => StoryDocumentSchema.parse(twice));
  assert.deepEqual(twice.scenes[0].shots[0].referencePacks, [
    { documentId, contentHash: other },
  ]);
});

test("a shot holds no more elements than it can, and an older pin still moves", () => {
  let held = story();
  const shot = held.scenes[0].shots[0];
  const ids: string[] = [];
  for (let i = 0; i < STORY_LIMITS.packsPerShot; i++) {
    const documentId = randomUUID();
    ids.push(documentId);
    held = pinElement(held, shot.id, {
      documentId,
      contentHash: hash,
    }) as typeof held;
  }
  assert.doesNotThrow(() => StoryDocumentSchema.parse(held));
  assert.equal(
    pinElement(held, shot.id, {
      documentId: randomUUID(),
      contentHash: hash,
    }),
    "full",
  );
  assert.notEqual(
    pinElement(held, shot.id, { documentId: ids[0], contentHash: other }),
    "full",
  );
});

test("an element comes off a shot, and other shots keep theirs", () => {
  const second = addMadeVideo(
    story(),
    {
      assetId: randomUUID(),
      assetHash: other,
      durationTicks: 1000,
      receipt: { ...(receipt as object), sha256: other } as never,
    },
    randomUUID,
  );
  assert.equal(typeof second, "object");
  const start = second as ReturnType<typeof story>;
  const shot = start.scenes[0].shots[0];
  const elsewhere = start.scenes[0].shots[1];
  const documentId = randomUUID();
  const keep = randomUUID();
  let held = pinElement(start, shot.id, {
    documentId,
    contentHash: hash,
  }) as typeof start;
  held = pinElement(held, shot.id, {
    documentId: keep,
    contentHash: hash,
  }) as typeof start;
  held = pinElement(held, elsewhere.id, {
    documentId,
    contentHash: hash,
  }) as typeof start;
  const off = unpinElement(held, shot.id, documentId);
  assert.deepEqual(off.scenes[0].shots[1].referencePacks, [
    { documentId, contentHash: hash },
  ]);
  assert.deepEqual(off.scenes[0].shots[0].referencePacks, [
    { documentId: keep, contentHash: hash },
  ]);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(off));
});

test("a later video leaves a shot's pins as they were", () => {
  const start = story();
  const documentId = randomUUID();
  const pinned = pinElement(start, start.scenes[0].shots[0].id, {
    documentId,
    contentHash: hash,
  }) as typeof start;
  const later = addMadeVideo(
    pinned,
    {
      assetId: randomUUID(),
      assetHash: other,
      durationTicks: 1000,
      receipt: { ...(receipt as object), sha256: other } as never,
    },
    randomUUID,
  ) as typeof start;
  assert.deepEqual(later.scenes[0].shots[0].referencePacks, [
    { documentId, contentHash: hash },
  ]);
  assert.deepEqual(later.scenes[0].shots[1].referencePacks, []);
  assert.doesNotThrow(() => StoryDocumentSchema.parse(later));
});

test("a pack this cannot show or add to is not offered as an element", () => {
  const made = newElementPack("A", "prop", image, randomUUID);
  assert.equal(asElement({ ...made, entries: [] }), null);
  const mixed = withImage(made, "style", image, randomUUID);
  assert.equal(asElement(mixed), null);
});

// Text, on purpose: it stops the first step of sending these anywhere, which nothing else
// would notice, since a model's input is otherwise free to take them.
test("nothing that starts a generation reads an element or a pin", () => {
  for (const file of [
    "core/engines/generation.ts",
    "core/engines/kaggle.ts",
    "src/create/GeneratePanel.tsx",
    "src/create/create-model.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    for (const word of ["referencePack", "create-elements", "ElementPack"])
      assert.ok(!source.includes(word), `${file} reads ${word}`);
  }
});

test("a shot not in the story changes nothing", () => {
  const start = story();
  const documentId = randomUUID();
  assert.deepEqual(
    pinElement(start, randomUUID(), { documentId, contentHash: hash }),
    start,
  );
});
