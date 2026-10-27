// YU-050: cinematic intent compiles to explicitly supported conditioning,
// checked against the real engine contract (core/engines/contract-v2.ts):
// every lowered value is a valid contract control, the end frame becomes
// the contract's `lastFrame` input as a project AssetRef, and a request
// built from the output passes the contract's own schema and refusal()
// check. What a recipe does not declare stays previs metadata; depth and
// pose (no contract role) always refuse unless accepted as dropped; nothing
// ever becomes prompt text; the lowered hash is bound to compiler and
// recipe.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { execute, Scopes, type Scope } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { mediaTools } from "../core/process/workers.ts";
import {
  ENGINE_CONTRACT_V2,
  ControlsSchema,
  EngineRequestV2Schema,
  constraintsHash,
  refusal,
  type AssetRef,
  type CapabilityV2,
  type Constraints,
} from "../core/engines/contract-v2.ts";
import {
  ShotIntentSchema,
  compileControls,
  type RecipeCapability,
} from "../core/cinema/control-compiler.ts";
import type { Project } from "../core/project.ts";

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
const still = crypto.randomUUID();
const STILL: AssetRef = {
  assetVersionId: still,
  sha256: "b".repeat(64),
  mediaType: "image/png",
};
const resolve = (id: string): AssetRef | null => (id === still ? STILL : null);
const intent = {
  format: "yamakan.shot-intent",
  formatVersion: 1,
  camera: { shotScale: "extreme_close", movement: "dolly" },
  lens: { focalLengthMm: 35 },
  light: { timeOfDay: "night" },
  guides: { endFrame: still },
};
// Every style control the table can lower to, and the contract's end-frame
// role: a recipe that takes them all.
const ALL_CONTROLS = [
  "shotScale",
  "cameraMovement",
  "focalLengthMm",
  "depthOfField",
  "lightKey",
  "timeOfDay",
  "subjectMotion",
];
const constraints: Constraints = {
  maxWidth: 1280,
  maxHeight: 720,
  fps: [{ num: 30, den: 1 }],
  minDurationTicks: 1,
  maxDurationTicks: 705_600_000 * 10,
  audio: false,
  controls: ["cameraMovement", "focalLengthMm"],
  roles: ["firstFrame", "lastFrame"],
};
const recipe: RecipeCapability = {
  recipeId: "fake.guided.v1",
  recipeHash: "a".repeat(64),
  controls: constraints.controls,
  roles: constraints.roles,
};
const capability = (c: Constraints): CapabilityV2 => ({
  operation: "imageToVideo",
  available: true,
  constraints: c,
  constraintsHash: constraintsHash(c),
});
// A full contract request from the compiler's output (first frame added).
const request = (out: ReturnType<typeof compileControls>) =>
  EngineRequestV2Schema.parse({
    contract: ENGINE_CONTRACT_V2,
    recipeId: recipe.recipeId,
    recipeHash: recipe.recipeHash,
    modelManifestHash: "c".repeat(64),
    controls: out.controls,
    attemptKey: "attempt-1",
    leaseGeneration: 1,
    deadlineMs: 60_000,
    resourcePolicyHash: "d".repeat(64),
    operation: "imageToVideo",
    inputs: [{ role: "firstFrame", asset: STILL }, ...out.inputs],
    output: {
      kind: "video",
      width: 1280,
      height: 720,
      fps: { num: 30, den: 1 },
      durationTicks: 705_600_000,
      audio: false,
    },
  });

test("a recipe gets exactly its declared controls and the contract's lastFrame input, accepted by the contract", () => {
  const out = compileControls(intent, recipe, resolve);
  assert.equal(out.compiler, "yamakan.controls-compiler/v1");
  assert.deepEqual(out.controls, {
    cameraMovement: "dolly",
    focalLengthMm: 35,
  });
  assert.deepEqual(out.inputs, [{ role: "lastFrame", asset: STILL }]);
  assert.deepEqual(
    out.report.map((r) => [r.path, r.status, r.to]),
    [
      ["camera.shotScale", "metadata", null],
      ["camera.movement", "applied", "cameraMovement"],
      ["lens.focalLengthMm", "applied", "focalLengthMm"],
      ["light.timeOfDay", "metadata", null],
      ["guides.endFrame", "applied", "lastFrame"],
    ],
  );
  // The real contract accepts the request and does not refuse it.
  assert.equal(refusal(request(out), capability(constraints)), null);
});

test("every intent value lowers to a valid contract control", () => {
  const every: RecipeCapability = { ...recipe, controls: ALL_CONTROLS };
  const shape = ShotIntentSchema.shape;
  const values = {
    shotScale: shape.camera.unwrap().shape.shotScale.unwrap().options,
    movement: shape.camera.unwrap().shape.movement.unwrap().options,
    depthOfField: shape.lens.unwrap().shape.depthOfField.unwrap().options,
    key: shape.light.unwrap().shape.key.unwrap().options,
    timeOfDay: shape.light.unwrap().shape.timeOfDay.unwrap().options,
    subject: shape.motion.unwrap().shape.subject.unwrap().options,
  };
  for (const shotScale of values.shotScale)
    for (const movement of values.movement)
      for (const focalLengthMm of [8, 300]) {
        const out = compileControls(
          {
            format: "yamakan.shot-intent",
            formatVersion: 1,
            camera: { shotScale, movement },
            lens: { focalLengthMm, depthOfField: values.depthOfField[0] },
            light: { key: values.key[1], timeOfDay: values.timeOfDay[4] },
            motion: { subject: values.subject[3] },
          },
          every,
          resolve,
        );
        assert.ok(ControlsSchema.safeParse(out.controls).success, shotScale);
        assert.equal(Object.keys(out.controls).length, ALL_CONTROLS.length);
        assert.equal(
          refusal(
            request(out),
            capability({ ...constraints, controls: ALL_CONTROLS }),
          ),
          null,
        );
      }
});

test("the output is deterministic and the lowered hash is bound to compiler and recipe", () => {
  const out = compileControls(intent, recipe, resolve);
  const reordered = compileControls(
    {
      guides: { endFrame: still },
      light: { timeOfDay: "night" },
      lens: { focalLengthMm: 35 },
      camera: { movement: "dolly", shotScale: "extreme_close" },
      formatVersion: 1,
      format: "yamakan.shot-intent",
    },
    recipe,
    resolve,
  );
  assert.equal(reordered.intentHash, out.intentHash);
  assert.equal(reordered.loweredControlsHash, out.loweredControlsHash);
  // A metadata-only change keeps the lowered hash; a different intent hash.
  const day = compileControls(
    { ...intent, light: { timeOfDay: "day" } },
    recipe,
    resolve,
  );
  assert.notEqual(day.intentHash, out.intentHash);
  assert.equal(day.loweredControlsHash, out.loweredControlsHash);
  // The same controls under another recipe are another lowered hash.
  const other = compileControls(
    intent,
    { ...recipe, recipeHash: "e".repeat(64) },
    resolve,
  );
  assert.deepEqual(other.controls, out.controls);
  assert.notEqual(other.loweredControlsHash, out.loweredControlsHash);
});

test("depth, pose and an untaken end frame refuse or are dropped, guides must be the project's stills, and nothing becomes text", () => {
  const plain: RecipeCapability = { ...recipe, controls: [], roles: [] };
  const guided = {
    ...intent,
    guides: { endFrame: still, depth: still, pose: still },
  };
  assert.match(
    failure(() => compileControls(guided, plain, resolve)),
    /^CAPABILITY_UNAVAILABLE: .*guides\.endFrame, guides\.depth, guides\.pose/,
  );
  // Depth and pose have no contract role: even a recipe declaring roles
  // named so cannot take them.
  assert.match(
    failure(() =>
      compileControls(
        guided,
        { ...recipe, roles: ["lastFrame", "depth", "pose"] },
        resolve,
      ),
    ),
    /^CAPABILITY_UNAVAILABLE: .*guides\.depth, guides\.pose/,
  );
  const dropped = compileControls(guided, plain, resolve, [
    "guides.endFrame",
    "guides.depth",
    "guides.pose",
  ]);
  assert.deepEqual(dropped.dropped, [
    "guides.endFrame",
    "guides.depth",
    "guides.pose",
  ]);
  assert.deepEqual([dropped.controls, dropped.inputs], [{}, []]);
  assert.equal("prompt" in dropped, false);
  // A guide from elsewhere is refused even when it would only be dropped.
  assert.match(
    failure(() =>
      compileControls(
        { ...intent, guides: { depth: crypto.randomUUID() } },
        plain,
        resolve,
        ["guides.depth"],
      ),
    ),
    /^VALIDATION: .*guides.depth guide is not media of this project/,
  );
  // A guide that is not this project's still is refused.
  assert.match(
    failure(() =>
      compileControls(
        { ...intent, guides: { endFrame: crypto.randomUUID() } },
        recipe,
        resolve,
      ),
    ),
    /^VALIDATION: .*guides.endFrame guide is not media of this project/,
  );
  assert.match(
    failure(() =>
      compileControls(intent, recipe, () => ({
        ...STILL,
        mediaType: "video/mp4",
      })),
    ),
    /^VALIDATION: .*still of this project/,
  );
  // Free text, unknown fields and out-of-range values are refused.
  for (const bad of [
    { ...intent, camera: { movement: "slow push into her eyes" } },
    { ...intent, camera: { shotScale: "extremeWide" } },
    { ...intent, prompt: "cinematic" },
    { ...intent, lens: { focalLengthMm: 1e9 } },
    { ...intent, guides: { depth: "../../etc/passwd" } },
  ])
    assert.match(
      failure(() => compileControls(bad, recipe, resolve)),
      /^VALIDATION/,
    );
});

test("the command resolves guides in the given project and lowers against this build's recipes", async () => {
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
  const project = (
    await execute(ctx, "yamakan.project.create", { name: "Controls" })
  ).result as Project;
  const other = (
    await execute(ctx, "yamakan.project.create", { name: "Other" })
  ).result as Project;
  const png = path.join(root, "end.png");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=red:s=64x64",
      "-frames:v",
      "1",
      png,
    ],
    { windowsHide: true },
  );
  const { asset } = await store.importAsset(
    other.id,
    "end.png",
    await readFile(png),
  );
  const call = async (args: object) => {
    try {
      return (await execute(ctx, "yamakan.cinema.compileControls", args))
        .result as ReturnType<typeof compileControls>;
    } catch (e) {
      const err = toCommandError(e);
      return `${err.code}: ${err.message}`;
    }
  };
  // The shipped fake text-to-video recipe declares no controls or roles.
  const out = await call({
    projectId: project.id,
    recipeId: "fake.textToVideo.v1",
    intent: { ...intent, guides: {} },
  });
  assert.ok(typeof out !== "string", String(out));
  assert.deepEqual(out.controls, {});
  assert.deepEqual(out.metadataOnly, [
    "camera.shotScale",
    "camera.movement",
    "lens.focalLengthMm",
    "light.timeOfDay",
  ]);
  // Another project's still is refused as a guide of this project.
  assert.match(
    String(
      await call({
        projectId: project.id,
        recipeId: "fake.imageToVideo.v1",
        intent: { ...intent, guides: { endFrame: asset.id } },
      }),
    ),
    /^VALIDATION: .*guides.endFrame guide is not media of this project/,
  );
  assert.match(
    String(
      await call({
        projectId: crypto.randomUUID(),
        recipeId: "fake.textToVideo.v1",
        intent,
      }),
    ),
    /^(NOT_FOUND|VALIDATION|INTERNAL)/,
  );
  assert.match(
    String(
      await call({ projectId: project.id, recipeId: "no.such.recipe", intent }),
    ),
    /^NOT_FOUND/,
  );
  assert.match(
    String(
      await call({
        projectId: project.id,
        recipeId: "fake.textToVideo.v1",
        intent,
        acceptDropped: ["prompt"],
      }),
    ),
    /^VALIDATION/,
  );
});
