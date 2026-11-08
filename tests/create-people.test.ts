import assert from "node:assert/strict";
import test from "node:test";
import { ReferencePackSchema } from "../core/story.ts";
import {
  characterLinks,
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
