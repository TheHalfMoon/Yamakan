// W15 / M11: identity contracts, consent, formatters.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectStore } from "../core/store.ts";
import {
  DIRECTOR_ENABLED,
  assertConsentForEncoding,
  assertReferenceIsImageAsset,
  parseCharacterAsset,
  revokeConsent,
  type ConsentRecord,
} from "../core/identity.ts";
import {
  formatCharacterIdentity,
  formatEnvironmentIdentity,
  validateIdentityPayload,
} from "../core/identity-format.ts";
import {
  execute,
  browserScopes,
  cliScopes,
  type CommandContext,
} from "../core/command/registry.ts";
import {
  grantConsent,
  recordEncoding,
  revokeConsentRecord,
} from "../core/director/runtime.ts";

const HASH = "ab".repeat(32);
const CHAR = "char_1";

async function withStore(fn: (store: ProjectStore) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "yamakan-id-"));
  const store = new ProjectStore(root);
  await store.initialize();
  try {
    await fn(store);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
}

test("DIRECTOR_ENABLED is true after manual Director UI attaches", () => {
  assert.equal(DIRECTOR_ENABLED, true);
});

test("formatters are deterministic", () => {
  const text = formatCharacterIdentity({
    name_or_role: "the cartographer",
    approx_age: "40",
    gender_presentation: "woman",
    hair: "silver",
    wardrobe: "wool coat",
  });
  assert.equal(
    text,
    "the cartographer, 40 woman, silver hair, wearing wool coat",
  );
  assert.equal(
    formatEnvironmentIdentity({
      architecture: "stone hall",
      color_palette: "amber, grey",
    }),
    "stone hall, color palette: amber, grey",
  );
});

test("identity payload validation rejects wrong shapes", () => {
  assert.throws(
    () =>
      validateIdentityPayload({
        has_recurring_character: "true",
        environment_identity: { architecture: "x" },
      }),
    /boolean/,
  );
  assert.throws(
    () =>
      validateIdentityPayload({
        has_recurring_character: true,
        character_identity: { name_or_role: "" },
        environment_identity: { architecture: "x" },
      }),
    /name_or_role/,
  );
});

test("non-image reference is refused", () => {
  assert.throws(() => assertReferenceIsImageAsset("wav"), /image/);
  assertReferenceIsImageAsset("png");
});

test("character asset schema requires asset ids", () => {
  const asset = parseCharacterAsset({
    format: "yamakan.character",
    formatVersion: 1,
    characterId: CHAR,
    bibleRevision: 0,
    description: { name_or_role: "A" },
    referenceImages: [
      {
        assetId: "11111111-1111-4111-8111-111111111111",
        view: "front",
      },
    ],
    clothingAssetIds: [],
    accessoryAssetIds: [],
    embeddingAssetIds: [],
  });
  assert.equal(asset.referenceImages[0]!.view, "front");
});

test("missing expired revoked wrong-purpose consent refuse encoding", async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () =>
        recordEncoding(store, {
          characterId: CHAR,
          purpose: "identity-encode",
          consentId: "11111111-1111-4111-8111-111111111111",
          provider: "none",
          method: "test",
          payloadHash: HASH,
        }),
      /Consent not found|required|not found/i,
    );

    const consent = await grantConsent(store, {
      characterId: CHAR,
      purpose: "identity-encode",
      version: "1",
      ttlMs: 60_000,
      principalId: "browser-ui",
      nowMs: 1_000,
    });

    await assert.rejects(
      () =>
        recordEncoding(store, {
          characterId: CHAR,
          purpose: "voice-clone",
          consentId: consent.id,
          provider: "none",
          method: "test",
          payloadHash: HASH,
          nowMs: 1_500,
        }),
      /purpose/,
    );

    await assert.rejects(
      () =>
        recordEncoding(store, {
          characterId: CHAR,
          purpose: "identity-encode",
          consentId: consent.id,
          provider: "none",
          method: "test",
          payloadHash: HASH,
          nowMs: consent.expiresAtMs + 1,
        }),
      /expired/,
    );

    const live = await grantConsent(store, {
      characterId: CHAR,
      purpose: "identity-encode",
      version: "1",
      ttlMs: 3_600_000,
      principalId: "browser-ui",
    });
    const enc = await recordEncoding(store, {
      characterId: CHAR,
      purpose: "identity-encode",
      consentId: live.id,
      provider: "none",
      method: "test",
      payloadHash: HASH,
    });
    assert.equal(enc.invalidated, false);
    const revoked = await revokeConsentRecord(store, live.id);
    assert.ok(revoked.encodings.every((e) => e.invalidated));
    await assert.rejects(
      () =>
        recordEncoding(store, {
          characterId: CHAR,
          purpose: "identity-encode",
          consentId: live.id,
          provider: "none",
          method: "test",
          payloadHash: HASH,
        }),
      /revoked/,
    );
  });
});

test("agent principal cannot grant or revoke consent", async () => {
  await withStore(async (store) => {
    const agentCtx = {
      store,
      queue: {} as CommandContext["queue"],
      principal: {
        id: "agent:11111111-1111-4111-8111-111111111111",
        scopes: cliScopes(),
      },
    } satisfies CommandContext;
    await assert.rejects(
      () =>
        execute(agentCtx, "yamakan.consent.grant", {
          characterId: CHAR,
          purpose: "identity-encode",
          version: "1",
          ttlMs: 60_000,
        }),
      /browser session|SCOPE_DENIED|lacks scope/i,
    );

    const humanCtx = {
      store,
      queue: {} as CommandContext["queue"],
      principal: { id: "browser-ui", scopes: browserScopes() },
    } satisfies CommandContext;
    const granted = await execute(humanCtx, "yamakan.consent.grant", {
      characterId: CHAR,
      purpose: "identity-encode",
      version: "1",
      ttlMs: 60_000,
    });
    const consent = (granted.result as ConsentRecord).id;
    await assert.rejects(
      () => execute(agentCtx, "yamakan.consent.revoke", { consentId: consent }),
      /browser session|SCOPE_DENIED|lacks scope/i,
    );
  });
});

test("assertConsentForEncoding pure checks", () => {
  const base: ConsentRecord = {
    format: "yamakan.likeness-consent",
    formatVersion: 1,
    id: "11111111-1111-4111-8111-111111111111",
    characterId: CHAR,
    purpose: "identity-encode",
    version: "1",
    grantedAtMs: 0,
    expiresAtMs: 10_000,
    revokedAtMs: null,
    grantorPrincipalId: "browser-ui",
  };
  assertConsentForEncoding(base, {
    characterId: CHAR,
    purpose: "identity-encode",
    nowMs: 1,
  });
  assert.throws(
    () =>
      assertConsentForEncoding(revokeConsent(base, 5), {
        characterId: CHAR,
        purpose: "identity-encode",
        nowMs: 6,
      }),
    /revoked/,
  );
});
