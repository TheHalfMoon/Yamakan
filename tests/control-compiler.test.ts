// YU-050: cinematic intent compiles to explicitly supported conditioning.
// A recipe that declares some controls and roles gets exactly those, from
// a fixed table, deterministically and named by hash; what it does not
// declare stays previs metadata; an unsupported guide (depth, pose, end
// frame) refuses unless accepted as dropped, and nothing ever becomes
// prompt text.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import {
  compileControls,
  type RecipeCapability,
} from "../core/cinema/control-compiler.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  await Promise.all(
    bases.map((b) =>
      rm(b, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
    ),
  );
});
const failure = (fn: () => unknown) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    const err = toCommandError(e);
    return `${err.code}: ${err.message}`;
  }
};
const endFrame = crypto.randomUUID();
const depth = crypto.randomUUID();
const intent = {
  format: "yamakan.shot-intent",
  formatVersion: 1,
  camera: { shotScale: "close", movement: "dolly" },
  lens: { focalLengthMm: 35 },
  light: { timeOfDay: "night" },
  guides: { endFrame },
};
// A fake recipe that takes two controls and an end frame.
const recipe: RecipeCapability = {
  recipeId: "fake.guided.v1",
  recipeHash: "a".repeat(64),
  controls: ["cameraMovement", "focalLengthMm"],
  roles: ["endFrame"],
};

test("a supported recipe gets exactly its controls and roles, deterministically, with provenance", () => {
  const out = compileControls(intent, recipe);
  assert.equal(out.compiler, "yamakan.controls-compiler/v1");
  assert.deepEqual(out.controls, {
    cameraMovement: "dolly",
    focalLengthMm: 35,
  });
  assert.deepEqual(out.inputs, [{ role: "endFrame", assetId: endFrame }]);
  assert.deepEqual(
    out.report.map((r) => [r.path, r.status, r.to]),
    [
      ["camera.shotScale", "metadata", null],
      ["camera.movement", "applied", "cameraMovement"],
      ["lens.focalLengthMm", "applied", "focalLengthMm"],
      ["light.timeOfDay", "metadata", null],
      ["guides.endFrame", "applied", "endFrame"],
    ],
  );
  assert.deepEqual(out.metadataOnly, ["camera.shotScale", "light.timeOfDay"]);
  // The same intent, written in another key order, gives the same hashes.
  const again = compileControls(
    {
      guides: { endFrame },
      light: { timeOfDay: "night" },
      lens: { focalLengthMm: 35 },
      camera: { movement: "dolly", shotScale: "close" },
      formatVersion: 1,
      format: "yamakan.shot-intent",
    },
    recipe,
  );
  assert.equal(again.intentHash, out.intentHash);
  assert.equal(again.loweredControlsHash, out.loweredControlsHash);
  // A changed intent changes its hash; a metadata-only change leaves the
  // lowered controls (and their hash) as they were.
  const night = compileControls(
    { ...intent, light: { timeOfDay: "day" } },
    recipe,
  );
  assert.notEqual(night.intentHash, out.intentHash);
  assert.equal(night.loweredControlsHash, out.loweredControlsHash);
});

test("an unsupported depth, pose or end frame refuses, or is recorded as dropped, and never becomes text", () => {
  const plain: RecipeCapability = { ...recipe, controls: [], roles: [] };
  const guided = {
    ...intent,
    guides: { endFrame, depth, pose: crypto.randomUUID() },
  };
  assert.match(
    failure(() => compileControls(guided, plain)),
    /^CAPABILITY_UNAVAILABLE: .*guides\.endFrame, guides\.depth, guides\.pose/,
  );
  const dropped = compileControls(guided, plain, [
    "guides.endFrame",
    "guides.depth",
    "guides.pose",
  ]);
  assert.deepEqual(dropped.dropped, [
    "guides.endFrame",
    "guides.depth",
    "guides.pose",
  ]);
  assert.deepEqual(dropped.controls, {});
  assert.deepEqual(dropped.inputs, []);
  // No field of the output is prompt text, and no intent value leaked in.
  assert.equal("prompt" in dropped, false);
  assert.doesNotMatch(JSON.stringify(dropped.controls), /night|dolly|close/);
  // Free text, code or unknown fields are refused by the schema.
  for (const bad of [
    { ...intent, camera: { movement: "slow push into her eyes" } },
    { ...intent, prompt: "cinematic" },
    { ...intent, lens: { focalLengthMm: 1e9 } },
    { ...intent, guides: { depth: "../../etc/passwd" } },
  ])
    assert.match(
      failure(() => compileControls(bad, recipe)),
      /^VALIDATION/,
    );
});

test("the command lowers against this build's own recipes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-controls-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const ctx = {
    store,
    queue,
    principal: {
      id: "browser-ui" as const,
      scopes: new Set(Scopes) as ReadonlySet<Scope>,
    },
  };
  const call = async (args: object) => {
    try {
      return (await execute(ctx, "yamakan.cinema.compileControls", args))
        .result as ReturnType<typeof compileControls>;
    } catch (e) {
      const err = toCommandError(e);
      return `${err.code}: ${err.message}`;
    }
  };
  // The shipped fake text-to-video recipe declares no controls or roles:
  // the camera and light stay previs metadata.
  const noGuide = { ...intent, guides: {} };
  const out = await call({ recipeId: "fake.textToVideo.v1", intent: noGuide });
  assert.ok(typeof out !== "string");
  assert.deepEqual(out.controls, {});
  assert.deepEqual(out.metadataOnly, [
    "camera.shotScale",
    "camera.movement",
    "lens.focalLengthMm",
    "light.timeOfDay",
  ]);
  assert.match(out.recipeHash, /^[a-f0-9]{64}$/);
  assert.match(
    String(await call({ recipeId: "fake.textToVideo.v1", intent })),
    /^CAPABILITY_UNAVAILABLE/,
  );
  assert.match(
    String(await call({ recipeId: "no.such.recipe", intent })),
    /^NOT_FOUND/,
  );
  assert.match(
    String(
      await call({
        recipeId: "fake.textToVideo.v1",
        intent,
        acceptDropped: ["prompt"],
      }),
    ),
    /^VALIDATION/,
  );
});
