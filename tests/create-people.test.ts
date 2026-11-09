import assert from "node:assert/strict";
import test from "node:test";
import { ReferencePackSchema } from "../core/story.ts";
import {
  asPersonPack,
  characterLinks,
  newestSends,
  sendTtl,
  withLink,
  consentState,
  grantable,
  peopleOf,
  personPack,
  sendFor,
  type ListedConsent,
} from "../src/create/create-people.ts";

const NOW = 1_000_000;
const consent = (over: Partial<ListedConsent>): ListedConsent => ({
  id: crypto.randomUUID(),
  characterId: "lead",
  purpose: "likeness-generate",
  version: "form A",
  grantedAtMs: NOW - 10,
  expiresAtMs: NOW + 10_000,
  revokedAtMs: null,
  current: true,
  coversConsentId: null,
  linkedAssetHashes: [],
  ...over,
});

test("a consent's state, as the page says it", () => {
  assert.equal(consentState(consent({}), NOW), "standing");
  assert.equal(consentState(consent({ revokedAtMs: NOW - 1 }), NOW), "revoked");
  assert.equal(consentState(consent({ expiresAtMs: NOW }), NOW), "expired");
  assert.equal(consentState(consent({ current: false }), NOW), "revalidate");
  // Revoked is said first: it is for good.
  assert.equal(
    consentState(
      consent({ revokedAtMs: 1, expiresAtMs: 1, current: false }),
      NOW,
    ),
    "revoked",
  );
});

test("people are grouped by name, newest consent first, other purposes left out", () => {
  const older = consent({ grantedAtMs: 1 });
  const newer = consent({ grantedAtMs: 2 });
  const voice = consent({ purpose: "voice-clone" });
  const other = consent({ characterId: "another" });
  const people = peopleOf([older, voice, other, newer]);
  assert.deepEqual(
    people.map((p) => p.characterId),
    ["another", "lead"],
  );
  assert.deepEqual(
    people[1].generate.map((c) => c.id),
    [newer.id, older.id],
  );
});

// As the service judges it: the newest consent to send naming that consent counts, alone.
test("the consent to send that counts is the newest naming that consent", () => {
  const generate = consent({});
  const elsewhere = consent({});
  const older = consent({
    purpose: "likeness-send",
    coversConsentId: generate.id,
    grantedAtMs: 1,
  });
  const newer = consent({
    purpose: "likeness-send",
    coversConsentId: generate.id,
    grantedAtMs: 2,
  });
  const [person] = peopleOf([generate, elsewhere, older, newer]);
  assert.equal(sendFor(person, generate.id, NOW)?.id, newer.id);
  assert.equal(sendFor(person, elsewhere.id, NOW), null);
  // The newest revoked: an older one standing does not count instead.
  const [revoked] = peopleOf([
    generate,
    older,
    { ...newer, revokedAtMs: NOW - 1 },
  ]);
  assert.equal(sendFor(revoked, generate.id, NOW), null);
  // One that covers nothing counts for nothing.
  const [bare] = peopleOf([
    generate,
    consent({ purpose: "likeness-send", coversConsentId: null }),
  ]);
  assert.equal(sendFor(bare, generate.id, NOW), null);
});

test("a grant needs a name, what was agreed and the person's tick", () => {
  const ok = { name: "Lead", version: "form A", attested: true };
  assert.equal(grantable(ok), true);
  assert.equal(grantable({ ...ok, attested: false }), false);
  assert.equal(grantable({ ...ok, name: "  " }), false);
  assert.equal(grantable({ ...ok, version: "" }), false);
  assert.equal(grantable({ ...ok, name: "x".repeat(81) }), false);
  assert.equal(grantable({ ...ok, version: "x".repeat(41) }), false);
});

test("linking a still makes a pack the project accepts, and reads back", () => {
  const consentId = crypto.randomUUID();
  const still = { id: crypto.randomUUID(), hash: "a".repeat(64) };
  const pack = personPack("Lead", still, consentId, () => crypto.randomUUID());
  assert.doesNotThrow(() => ReferencePackSchema.parse(pack));
  assert.deepEqual(characterLinks(pack), [{ consentId, assetId: still.id }]);
  // Places, props and anything else link no one.
  assert.deepEqual(
    characterLinks({
      entries: [
        { role: "environment", consentId: null, assetId: still.id },
        { role: "fictional-character", consentId: null, assetId: still.id },
      ],
    }),
    [],
  );
  assert.deepEqual(characterLinks(null), []);
});

test("on a tie, consent to send counts only if every tied one stands, as the service asks", () => {
  const generate = consent({});
  const a = consent({
    purpose: "likeness-send",
    coversConsentId: generate.id,
    grantedAtMs: 5,
  });
  const b = { ...a, id: crypto.randomUUID() };
  const [both] = peopleOf([generate, a, b]);
  assert.equal(newestSends(both, generate.id).length, 2);
  assert.notEqual(sendFor(both, generate.id, NOW), null);
  const [one] = peopleOf([generate, a, { ...b, revokedAtMs: NOW - 1 }]);
  assert.equal(sendFor(one, generate.id, NOW), null);
});

test("consent to send lasts no longer than the consent it covers, and never under a minute", () => {
  const day = 86_400_000;
  const standing = consent({ expiresAtMs: NOW + 10 * day });
  assert.equal(sendTtl(standing, 30 * day, NOW), 10 * day);
  assert.equal(sendTtl(standing, 5 * day, NOW), 5 * day);
  // Within a minute of its end, nothing the service would take.
  assert.equal(sendTtl(consent({ expiresAtMs: NOW + 59_999 }), day, NOW), null);
  // An expired one says who its linked stills show: the time chosen.
  assert.equal(
    sendTtl(consent({ expiresAtMs: NOW - 1 }), 30 * day, NOW),
    30 * day,
  );
});

test("one pack per person: a link is added to it, once, up to the pack's limit", () => {
  const newId = () => crypto.randomUUID();
  const all = () => true;
  const consentId = crypto.randomUUID();
  const first = { id: crypto.randomUUID(), hash: "a".repeat(64) };
  const second = { id: crypto.randomUUID(), hash: "b".repeat(64) };
  const pack = personPack("Lead", first, consentId, newId);
  assert.equal(asPersonPack(pack), pack);
  const more = withLink(pack, second, consentId, newId, all);
  assert.ok(typeof more === "object");
  assert.doesNotThrow(() => ReferencePackSchema.parse(more));
  assert.deepEqual(
    characterLinks(more).map((l) => l.assetId),
    [first.id, second.id],
  );
  assert.equal(withLink(pack, first, consentId, newId, all), "already");
  // The same still on another consent of theirs is a link of its own.
  assert.ok(
    typeof withLink(pack, first, crypto.randomUUID(), newId, all) === "object",
  );
  let full: ReturnType<typeof withLink> = pack;
  for (let i = 1; i < 64; i++)
    full = withLink(
      full as typeof pack,
      { id: crypto.randomUUID(), hash: "c".repeat(64) },
      consentId,
      newId,
      all,
    );
  assert.equal(
    withLink(full as typeof pack, second, consentId, newId, all),
    "full",
  );
  // A pack of places, or of two people, is not one person's.
  assert.equal(
    asPersonPack({
      ...pack,
      entries: [...pack.entries, { ...pack.entries[0], characterId: "Other" }],
    }),
    null,
  );
  assert.equal(
    asPersonPack({ ...pack, entries: [{ ...pack.entries[0], role: "prop" }] }),
    null,
  );
});

// Saving checks every consent in the pack, so a link whose consent no longer stands would
// stop the person's pack being saved at all. It is left out; the service still counts it.
test("links whose consent no longer stands are left out of the next version", () => {
  const newId = () => crypto.randomUUID();
  const gone = crypto.randomUUID();
  const renewed = crypto.randomUUID();
  const still = { id: crypto.randomUUID(), hash: "a".repeat(64) };
  const pack = personPack("Lead", still, gone, newId);
  const next = withLink(pack, still, renewed, newId, (id) => id === renewed);
  assert.ok(typeof next === "object");
  assert.deepEqual(characterLinks(next), [
    { consentId: renewed, assetId: still.id },
  ]);
  assert.doesNotThrow(() => ReferencePackSchema.parse(next));
  // And a pack full only of ones that no longer stand has room again.
  let full: ReturnType<typeof withLink> = pack;
  for (let i = 1; i < 64; i++)
    full = withLink(
      full as typeof pack,
      { id: crypto.randomUUID(), hash: "c".repeat(64) },
      gone,
      newId,
      () => true,
    );
  const after = withLink(
    full as typeof pack,
    still,
    renewed,
    newId,
    (id) => id === renewed,
  );
  assert.ok(typeof after === "object");
  assert.equal(after.entries.length, 1);
});
