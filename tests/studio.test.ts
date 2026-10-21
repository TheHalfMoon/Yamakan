import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_ENABLED,
  STUDIO_LIMITS,
  assertStudioImageLimits,
  createEmptyStudioDocument,
  hashStudioDocument,
  saveStudioDocument,
  studioCapability,
} from "../core/studio.ts";
import { execute, type CommandContext } from "../core/command/registry.ts";
import { CommandError } from "../core/command/errors.ts";

const DOC_ID = "00000000-0000-4000-8000-000000000001";

test("STUDIO_ENABLED is true after Q8–Q10 activation", () => {
  assert.equal(STUDIO_ENABLED, true);
  assert.equal(studioCapability().available, true);
});

test("createEmptyStudioDocument produces a hashable v3 canvas", () => {
  const doc = createEmptyStudioDocument({
    id: DOC_ID,
    name: "Test",
    width: 512,
    height: 512,
  });
  assert.equal(doc.canvasSchemaVersion, 3);
  assert.equal(JSON.parse(doc.canvasJson).version, 3);
  const saved = saveStudioDocument(doc);
  assert.equal(saved.contentHash.length, 64);
  assert.equal(saved.studioEnabled, true);
  assert.equal(hashStudioDocument(doc), saved.contentHash);
});

test("assertStudioImageLimits refuses oversized images", () => {
  assert.throws(
    () => assertStudioImageLimits(STUDIO_LIMITS.maxSidePx + 1, 10),
    CommandError,
  );
  assert.throws(() => assertStudioImageLimits(10000, 10000), CommandError);
  assertStudioImageLimits(1024, 1024);
});

test("yamakan.studio.open returns a validated document", async () => {
  const ctx = {
    store: {} as CommandContext["store"],
    queue: {} as CommandContext["queue"],
    principal: {
      id: "local-client",
      scopes: new Set(["project:write"]),
    },
  } satisfies CommandContext;
  const out = await execute(ctx, "yamakan.studio.open", {
    name: "Brush study",
  });
  assert.equal(out.operation, "yamakan.studio.open");
  const result = out.result as {
    studioEnabled: boolean;
    document: { name: string };
    contentHash: string;
  };
  assert.equal(result.studioEnabled, true);
  assert.equal(result.document.name, "Brush study");
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
});

test("yamakan.studio.capability reports available when flag is on", async () => {
  const ctx = {
    store: {} as CommandContext["store"],
    queue: {} as CommandContext["queue"],
    principal: {
      id: "local-client",
      scopes: new Set(["project:read"]),
    },
  } satisfies CommandContext;
  const out = await execute(ctx, "yamakan.studio.capability", {});
  assert.equal(out.operation, "yamakan.studio.capability");
  const result = out.result as { available: boolean };
  assert.equal(result.available, true);
});
