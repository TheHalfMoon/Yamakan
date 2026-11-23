// W10 / M13: fake engine — cancel, crash retry with fencing, probe quarantine.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ENGINE_CONTRACT,
  ENGINE_ENABLED,
  engineAbsentCapability,
} from "../core/engines/contract.ts";
import {
  createFakeEngine,
  createFakeEngineV2,
  createFakeWorld,
} from "../core/engines/fake.ts";
import {
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  absentCapabilitiesV2,
  diagnostic,
  readArtifactVerified,
  parseRequestV2,
  type AssetRef,
  type EngineAdapterV2,
  type EngineContextV2,
  type EngineRequestV2,
  ExecutionStatusSchema,
} from "../core/engines/contract-v2.ts";
import {
  SERVER_RECIPES,
  bridgeV1,
  recipeHash,
} from "../core/engines/v1-bridge.ts";
import type { EngineAdapter, EngineStatus } from "../core/engines/contract.ts";
import type { ProjectStore } from "../core/store.ts";
import { engineConformance } from "./fixtures/engine-conformance.ts";

const graph = {
  nodes: {
    "1": { class_type: "YamakanFakeLoad", inputs: {} },
    "2": { class_type: "YamakanFakeSave", inputs: { image: ["1", 0] } },
  },
};

test("engine feature flag stays off until E-SEC and founder decision F", () => {
  assert.equal(ENGINE_ENABLED, false);
  const absent = engineAbsentCapability();
  assert.equal(absent.available, false);
  assert.match(absent.reason ?? "", /E-SEC/);
});

test("fake engine refuses nodes outside the allowlist", async () => {
  const engine = createFakeEngine();
  await assert.rejects(
    () =>
      engine.submit({
        graph: {
          nodes: { "1": { class_type: "EvilNode", inputs: {} } },
        },
        inputs: [],
        attemptKey: "deny-node",
      }),
    /not allowlisted/,
  );
});

test("cancel ends a queued or running attempt", async () => {
  const crashKeys = new Set(["cancel-me"]);
  const engine = createFakeEngine({ crashAttemptKeys: crashKeys });
  const { id } = await engine.submit({
    graph,
    inputs: [],
    attemptKey: "cancel-me",
  });
  // Crash path leaves the job running until status; cancel first.
  const cancelled = await engine.cancel(id);
  assert.equal(cancelled.state, "cancelled");
  assert.equal((await engine.status(id)).state, "cancelled");
});

test("crash mid-job retries with the same attempt key (fencing)", async () => {
  const crashKeys = new Set(["fence-1"]);
  const engine = createFakeEngine({ crashAttemptKeys: crashKeys });
  const first = await engine.submit({
    graph,
    inputs: [],
    attemptKey: "fence-1",
  });
  const crashed = await engine.status(first.id);
  assert.equal(crashed.state, "failed");
  assert.match(crashed.error ?? "", /crash/i);

  const second = await engine.submit({
    graph,
    inputs: [],
    attemptKey: "fence-1",
  });
  assert.notEqual(second.id, first.id);
  const done = await engine.status(second.id);
  assert.equal(done.state, "completed");
  const outs = await engine.outputs(second.id);
  assert.equal(outs.length, 1);
  assert.equal(
    outs[0]!.sha256,
    createHash("sha256").update(outs[0]!.bytes).digest("hex"),
  );

  // Re-submit of a finished attempt replays the same job id.
  const replay = await engine.submit({
    graph,
    inputs: [],
    attemptKey: "fence-1",
  });
  assert.equal(replay.id, second.id);
});

test("an output that fails the probe is quarantined", async () => {
  const engine = createFakeEngine({ failProbe: true });
  const { id } = await engine.submit({
    graph,
    inputs: [],
    attemptKey: "bad-probe",
  });
  const status = await engine.status(id);
  assert.equal(status.state, "completed");
  assert.equal(status.quarantined, true);
  await assert.rejects(() => engine.outputs(id), /quarantined/);
});

test("engine-absent capability disables the feature with a reason", () => {
  const engine = createFakeEngine();
  assert.equal(engine.contract, ENGINE_CONTRACT);
  assert.equal(engine.capabilities().available, true);
  const absent = engineAbsentCapability("no hardware");
  assert.equal(absent.available, false);
  assert.equal(absent.reason, "no hardware");
});

// ---------------------------------------------------------------------------
// YU-040: EngineAdapter v2 — operation requests, handles, the v1 bridge.
// ---------------------------------------------------------------------------
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const TICKS = 705_600_000;
const zeros = "0".repeat(64);
const textToVideo = (extra: Record<string, unknown> = {}): EngineRequestV2 =>
  parseRequestV2({
    contract: ENGINE_CONTRACT_V2,
    operation: "textToVideo",
    recipeId: "fake.textToVideo.v1",
    recipeHash: recipeHash(SERVER_RECIPES[0]!),
    modelManifestHash: zeros,
    prompt: "A lighthouse at dusk",
    inputs: [],
    output: {
      kind: "video",
      width: 640,
      height: 360,
      fps: { num: 30, den: 1 },
      durationTicks: 2 * TICKS,
      audio: false,
    },
    attemptKey: "attempt-1",
    leaseGeneration: 1,
    deadlineMs: 60_000,
    resourcePolicyHash: zeros,
    ...extra,
  });
const imageToVideo = (extra: Record<string, unknown> = {}) =>
  parseRequestV2({
    ...textToVideo(),
    operation: "imageToVideo",
    recipeId: "fake.imageToVideo.v1",
    recipeHash: recipeHash(SERVER_RECIPES[1]!),
    inputs: [{ role: "firstFrame", asset: imageRef }],
    ...extra,
  });
const video = (over: Record<string, unknown>) => ({
  kind: "video",
  width: 640,
  height: 360,
  fps: { num: 30, den: 1 },
  durationTicks: TICKS,
  audio: false,
  ...over,
});
// The service side: assets resolved to bounded streams by handle.
const image = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 251));
const imageRef: AssetRef = {
  assetVersionId: "asset-1",
  sha256: sha(image),
  mediaType: "image/png",
};
const context = (
  assets = new Map([[imageRef.assetVersionId, image]]),
): EngineContextV2 & { opened: number } => {
  const ctx = {
    opened: 0,
    async *openAsset(asset: AssetRef) {
      ctx.opened++;
      const bytes = assets.get(asset.assetVersionId);
      if (!bytes) throw new Error("Unknown asset.");
      for (let i = 0; i < bytes.length; i += 1024)
        yield bytes.subarray(i, i + 1024);
    },
  };
  return ctx;
};
async function drain(adapter: EngineAdapterV2, ref: string, handle: string) {
  const hash = createHash("sha256");
  let bytes = 0;
  let largest = 0;
  for await (const chunk of adapter.readArtifact(ref, handle)) {
    bytes += chunk.byteLength;
    largest = Math.max(largest, chunk.byteLength);
    hash.update(chunk);
  }
  return { bytes, largest, sha256: hash.digest("hex") };
}

test("v2 requests are strict per operation: no graph, URL, path, class or plugin", () => {
  const base = textToVideo();
  for (const extra of [
    { graph: { nodes: {} } },
    { url: "https://example.com/model" },
    { path: "C:/models/x.safetensors" },
    { class_type: "KSampler" },
    { plugin: "custom_nodes/evil" },
  ])
    assert.throws(() => parseRequestV2({ ...base, ...extra }));
  // Inputs are immutable assets by id and hash, never paths.
  assert.throws(() =>
    imageToVideo({
      inputs: [
        {
          role: "firstFrame",
          asset: { ...imageRef, assetVersionId: "../../etc/passwd" },
        },
      ],
    }),
  );
  // Roles and media are exact per operation.
  assert.throws(() =>
    parseRequestV2({
      ...base,
      inputs: [{ role: "firstFrame", asset: imageRef }],
    }),
  );
  assert.throws(() =>
    imageToVideo({
      inputs: [
        { role: "firstFrame", asset: { ...imageRef, mediaType: "video/mp4" } },
      ],
    }),
  );
  assert.throws(() =>
    parseRequestV2({ ...base, operation: "transcribe", output: base.output }),
  );
});

test("an engine-less build reports every operation disabled and runs nothing", async () => {
  assert.equal(ENGINE_ENABLED, false);
  const caps = absentCapabilitiesV2();
  assert.equal(caps.length, 5);
  assert.ok(caps.every((c) => !c.available && c.reason === "ENGINE_DISABLED"));
  const engine = createFakeEngineV2({
    unavailable: { textToVideo: "WEIGHTS_ABSENT" },
  });
  const ctx = context();
  assert.deepEqual(await engine.submit(textToVideo(), ctx), {
    refused: "WEIGHTS_ABSENT",
  });
  assert.equal(engine.spawned(), 0);
  assert.equal(ctx.opened, 0);
});

test("unsupported controls and outputs fail before any worker is spawned", async () => {
  const engine = createFakeEngineV2();
  const ctx = context();
  const cases: [EngineRequestV2, string][] = [
    [textToVideo({ controls: { cameraOrbit: 1 } }), "CONTROL_UNSUPPORTED"],
    [
      textToVideo({ output: video({ width: 1920, height: 1080 }) }),
      "OUTPUT_UNSUPPORTED",
    ],
    [
      textToVideo({ output: video({ fps: { num: 25, den: 1 } }) }),
      "OUTPUT_UNSUPPORTED",
    ],
    [textToVideo({ output: video({ audio: true }) }), "OUTPUT_UNSUPPORTED"],
    [
      textToVideo({ output: video({ durationTicks: 11 * TICKS }) }),
      "OUTPUT_UNSUPPORTED",
    ],
  ];
  for (const [request, reason] of cases)
    assert.deepEqual(await engine.submit(request, ctx), { refused: reason });
  assert.equal(engine.spawned(), 0);
  // A supported control runs.
  const ran = await engine.submit(
    textToVideo({ controls: { guidance: 3 } }),
    ctx,
  );
  assert.ok("executionRef" in ran);
  assert.equal(engine.spawned(), 1);
});

test("an answer that a run failed or was stopped names which kind of end it was, and no other answer does", () => {
  for (const state of ["failed", "cancelled"])
    for (const [failureClass, ok] of [
      ["timeout", true],
      ["unknown", true],
      ["cancelled", true],
      [undefined, false],
      ["no such kind", false],
      [null, false],
    ] as const)
      assert.equal(
        ExecutionStatusSchema.safeParse({
          executionRef: "r",
          state,
          ...(failureClass === undefined ? {} : { failureClass }),
        }).success,
        ok,
        `${state} ${failureClass}`,
      );
  for (const state of ["queued", "running", "succeeded", "unknown"]) {
    const answer = { executionRef: "r", state, progress: 0.5 };
    assert.ok(ExecutionStatusSchema.safeParse(answer).success, state);
    assert.ok(
      !ExecutionStatusSchema.safeParse({ ...answer, failureClass: "unknown" })
        .success,
      state,
    );
  }
  assert.ok(
    !ExecutionStatusSchema.safeParse({ executionRef: "r", state: "lost" })
      .success,
  );
});

test("a failed execution names the kind it is given, and says unknown when it is given none", async () => {
  for (const failureClass of [undefined, "timeout"] as const) {
    const engine = createFakeEngineV2({
      failExecutions: true,
      ...(failureClass ? { failureClass } : {}),
    });
    const ran = await engine.submit(textToVideo(), context());
    assert.ok("executionRef" in ran);
    const status = await engine.status(ran.executionRef);
    assert.equal(status.state, "failed");
    assert.equal(
      "failureClass" in status && status.failureClass,
      failureClass ?? "unknown",
    );
    ExecutionStatusSchema.parse(status);
  }
});

test("artifacts are read through bounded handles, and inputs are hash-checked streams", async () => {
  const engine = createFakeEngineV2({
    artifactBytes: 3 * ENGINE_V2_LIMITS.chunkBytes + 17,
  });
  const ctx = context();
  const submitted = await engine.submit(imageToVideo(), ctx);
  assert.ok("executionRef" in submitted);
  assert.equal(ctx.opened, 1);
  const [artifact] = await engine.enumerateArtifacts(submitted.executionRef);
  assert.equal(artifact!.handle, "output.mp4");
  const read = await drain(engine, submitted.executionRef, artifact!.handle);
  assert.equal(read.bytes, artifact!.byteLength);
  assert.equal(read.sha256, artifact!.sha256);
  assert.ok(read.largest <= ENGINE_V2_LIMITS.chunkBytes, String(read.largest));
  // An input whose bytes do not match its recorded hash never runs.
  const tampered = context(
    new Map([[imageRef.assetVersionId, Buffer.from("other bytes")]]),
  );
  assert.deepEqual(
    await engine.submit(imageToVideo({ attemptKey: "attempt-2" }), tampered),
    { refused: "INVALID_REQUEST" },
  );
  // Handles never name anything else.
  await assert.rejects(
    drain(engine, submitted.executionRef, "../workspace.sqlite"),
  );
});

test("stale attempts are fenced; the same generation replays its execution", async () => {
  for (const engine of [createFakeEngineV2(), bridgeV1(createFakeEngine())]) {
    const ctx = context();
    const first = await engine.submit(textToVideo({ leaseGeneration: 2 }), ctx);
    assert.ok("executionRef" in first);
    assert.deepEqual(
      await engine.submit(textToVideo({ leaseGeneration: 2 }), ctx),
      first,
    );
    assert.deepEqual(
      await engine.submit(textToVideo({ leaseGeneration: 1 }), ctx),
      { refused: "STALE_ATTEMPT" },
    );
  }
});

test("v1 parity: the bridge lowers only server recipes and reports what the v2 fake reports", async () => {
  const bridged = bridgeV1(createFakeEngine());
  const native = createFakeEngineV2();
  const ctx = context();
  const viaBridge = await bridged.submit(textToVideo(), ctx);
  const viaNative = await native.submit(textToVideo(), ctx);
  assert.ok("executionRef" in viaBridge && "executionRef" in viaNative);
  assert.equal(
    (await bridged.status(viaBridge.executionRef)).state,
    "succeeded",
  );
  assert.equal(
    (await native.status(viaNative.executionRef)).state,
    "succeeded",
  );
  const [artifact] = await bridged.enumerateArtifacts(viaBridge.executionRef);
  const read = await drain(bridged, viaBridge.executionRef, artifact!.handle);
  assert.equal(read.sha256, artifact!.sha256);
  assert.equal(read.bytes, artifact!.byteLength);
  // The image recipe reads its input through the handle into the v1 job.
  const viaImage = await bridged.submit(
    imageToVideo({ attemptKey: "img" }),
    ctx,
  );
  assert.ok("executionRef" in viaImage);
  // An unknown recipe, a changed recipe hash, or a recipe of another
  // operation is refused; a raw graph has no way in.
  for (const request of [
    textToVideo({ recipeId: "fake.unknown.v1" }),
    textToVideo({ recipeHash: zeros }),
    textToVideo({
      recipeId: "fake.imageToVideo.v1",
      recipeHash: recipeHash(SERVER_RECIPES[1]!),
    }),
  ])
    assert.deepEqual(await bridged.submit(request, ctx), {
      refused: "RECIPE_UNKNOWN",
    });
  // Cancel and reconcile are bounded observations, not job state.
  assert.deepEqual(await bridged.requestCancel(viaBridge.executionRef), {
    requested: true,
    localProcessExited: true,
    billingOutcome: "notApplicable",
  });
  assert.equal(
    (await bridged.reconcile(viaBridge.executionRef)).state,
    "succeeded",
  );
  // A quarantined v1 output is a failed execution with no artifacts.
  const probe = bridgeV1(createFakeEngine({ failProbe: true }));
  const failed = await probe.submit(textToVideo(), ctx);
  assert.ok("executionRef" in failed);
  // Which kind, a version 1 engine does not say.
  assert.deepEqual(
    ((s) => [s.state, "failureClass" in s && s.failureClass])(
      await probe.status(failed.executionRef),
    ),
    ["failed", "unknown"],
  );
  assert.deepEqual(await probe.enumerateArtifacts(failed.executionRef), []);
  // One that a version 1 engine says was stopped is that.
  const v1 = createFakeEngine();
  const stopping = bridgeV1({
    ...v1,
    status: async (id: string) => ({ id, state: "cancelled" }) as never,
  });
  const stopped = await stopping.submit(textToVideo(), context());
  assert.ok("executionRef" in stopped);
  const said = await stopping.status(stopped.executionRef);
  assert.deepEqual(
    [said.state, "failureClass" in said && said.failureClass],
    ["cancelled", "cancelled"],
  );
});

test("concurrent submits: an older generation never replaces a newer one, and one generation runs once", async () => {
  // Generation 2 and generation 1 race; generation 1's input is slower.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const engine = createFakeEngineV2({
    beforeInput: (r) => (r.leaseGeneration === 1 ? held : Promise.resolve()),
  });
  const ctx = context();
  const one = engine.submit(imageToVideo({ leaseGeneration: 1 }), ctx);
  const two = engine.submit(imageToVideo({ leaseGeneration: 2 }), ctx);
  release();
  const [r1, r2] = await Promise.all([one, two]);
  assert.ok("executionRef" in r2);
  // Generation 1 claimed first but finished after generation 2 went live:
  // it is stale, and its execution was cancelled.
  assert.deepEqual(r1, { refused: "STALE_ATTEMPT" });
  assert.deepEqual(
    await engine.submit(imageToVideo({ leaseGeneration: 1 }), ctx),
    {
      refused: "STALE_ATTEMPT",
    },
  );
  assert.deepEqual(
    await engine.submit(imageToVideo({ leaseGeneration: 2 }), ctx),
    r2,
  );
  // Two submits of one generation at once: one execution.
  const fresh = createFakeEngineV2();
  const [a, b] = await Promise.all([
    fresh.submit(imageToVideo({ attemptKey: "same" }), ctx),
    fresh.submit(imageToVideo({ attemptKey: "same" }), ctx),
  ]);
  assert.deepEqual(a, b);
  assert.equal(fresh.spawned(), 1);
});

test("one attempt and generation means one request; a failed execution replays as failed", async () => {
  for (const engine of [createFakeEngineV2(), bridgeV1(createFakeEngine())]) {
    const ctx = context();
    assert.ok(
      "executionRef" in
        (await engine.submit(textToVideo({ attemptKey: "k" }), ctx)),
    );
    assert.deepEqual(
      await engine.submit(
        textToVideo({ attemptKey: "k", prompt: "Something else" }),
        ctx,
      ),
      { refused: "ATTEMPT_CONFLICT" },
    );
  }
  const failing = createFakeEngineV2({ failExecutions: true });
  const ctx = context();
  const failed = await failing.submit(
    textToVideo({ attemptKey: "f", leaseGeneration: 3 }),
    ctx,
  );
  assert.ok("executionRef" in failed);
  assert.equal((await failing.status(failed.executionRef)).state, "failed");
  assert.deepEqual(await failing.enumerateArtifacts(failed.executionRef), []);
  // The same generation replays the failed execution; an older one is stale.
  assert.deepEqual(
    await failing.submit(
      textToVideo({ attemptKey: "f", leaseGeneration: 3 }),
      ctx,
    ),
    failed,
  );
  assert.deepEqual(
    await failing.submit(
      textToVideo({ attemptKey: "f", leaseGeneration: 2 }),
      ctx,
    ),
    {
      refused: "STALE_ATTEMPT",
    },
  );
  // A refusal frees its generation for a retry, but never lowers the
  // fence: an older generation stays stale.
  const options: { unavailable: Record<string, "WEIGHTS_ABSENT"> } = {
    unavailable: { textToVideo: "WEIGHTS_ABSENT" },
  };
  const later = createFakeEngineV2(options as never);
  assert.deepEqual(
    await later.submit(
      textToVideo({ attemptKey: "r", leaseGeneration: 5 }),
      ctx,
    ),
    {
      refused: "WEIGHTS_ABSENT",
    },
  );
  delete options.unavailable.textToVideo;
  assert.deepEqual(
    await later.submit(
      textToVideo({ attemptKey: "r", leaseGeneration: 4 }),
      ctx,
    ),
    {
      refused: "STALE_ATTEMPT",
    },
  );
  assert.ok(
    "executionRef" in
      (await later.submit(
        textToVideo({ attemptKey: "r", leaseGeneration: 5 }),
        ctx,
      )),
  );
});

test("a submit that throws frees its claim: the retry runs instead of waiting forever", async () => {
  for (const engine of [createFakeEngineV2(), bridgeV1(createFakeEngine())]) {
    let down = true;
    const flaky: EngineContextV2 = {
      async *openAsset(asset) {
        if (down) throw new Error("asset store down");
        yield* context().openAsset(asset);
      },
    };
    const request = imageToVideo({ attemptKey: "flaky" });
    await assert.rejects(engine.submit(request, flaky), /asset store down/);
    down = false;
    const retried = await Promise.race([
      engine.submit(request, flaky),
      new Promise((r) => setTimeout(() => r("hung"), 2000)),
    ]);
    assert.ok(
      typeof retried === "object" && retried && "executionRef" in retried,
      String(retried),
    );
  }
});

test("a newer generation cancels the execution it replaces; unknown executions are answered honestly", async () => {
  const bridged = bridgeV1(createFakeEngine());
  const ctx = context();
  const old = await bridged.submit(
    textToVideo({ attemptKey: "gen", leaseGeneration: 1 }),
    ctx,
  );
  const fresh = await bridged.submit(
    textToVideo({ attemptKey: "gen", leaseGeneration: 2 }),
    ctx,
  );
  assert.ok("executionRef" in old && "executionRef" in fresh);
  assert.notEqual(old.executionRef, fresh.executionRef);
  // A refused generation in between does not lose the older live one.
  const engine = createFakeEngineV2();
  const one = await engine.submit(
    textToVideo({ attemptKey: "live", leaseGeneration: 1 }),
    ctx,
  );
  assert.ok("executionRef" in one);
  assert.deepEqual(
    await engine.submit(
      textToVideo({
        attemptKey: "live",
        leaseGeneration: 2,
        controls: { nope: 1 },
      }),
      ctx,
    ),
    { refused: "CONTROL_UNSUPPORTED" },
  );
  const three = await engine.submit(
    textToVideo({ attemptKey: "live", leaseGeneration: 3 }),
    ctx,
  );
  assert.ok("executionRef" in three);
  // Finished executions keep their outcome: only unfinished ones cancel.
  assert.equal((await engine.status(one.executionRef)).state, "succeeded");
  assert.equal((await engine.status(three.executionRef)).state, "succeeded");
  // A long-running older execution is cancelled when a newer one runs.
  const long = createFakeEngineV2({ stayRunning: true });
  const first = await long.submit(
    textToVideo({ attemptKey: "long", leaseGeneration: 1 }),
    ctx,
  );
  assert.ok("executionRef" in first);
  assert.equal((await long.status(first.executionRef)).state, "running");
  const second = await long.submit(
    textToVideo({ attemptKey: "long", leaseGeneration: 2 }),
    ctx,
  );
  assert.ok("executionRef" in second);
  const replaced = await long.status(first.executionRef);
  assert.equal(replaced.state, "cancelled");
  ExecutionStatusSchema.parse(replaced);
  assert.equal((await long.status(second.executionRef)).state, "running");
  // Stopped on request, it says so too.
  const asked = createFakeEngineV2({ stayRunning: true });
  const running = await asked.submit(textToVideo({ attemptKey: "ask" }), ctx);
  assert.ok("executionRef" in running);
  await asked.requestCancel(running.executionRef);
  const halted = await asked.status(running.executionRef);
  assert.deepEqual(
    [halted.state, "failureClass" in halted && halted.failureClass],
    ["cancelled", "cancelled"],
  );
  // A stuck older generation never holds up the newer one.
  const stuck = createFakeEngineV2({
    beforeInput: (r) =>
      r.leaseGeneration === 1 ? new Promise(() => {}) : Promise.resolve(),
  });
  void stuck.submit(
    imageToVideo({ attemptKey: "stuck", leaseGeneration: 1 }),
    ctx,
  );
  const newer = await Promise.race([
    stuck.submit(
      imageToVideo({ attemptKey: "stuck", leaseGeneration: 2 }),
      ctx,
    ),
    new Promise((r) => setTimeout(() => r("hung"), 2000)),
  ]);
  assert.ok(
    typeof newer === "object" && newer && "executionRef" in newer,
    String(newer),
  );
  assert.deepEqual(await bridged.requestCancel("never-submitted"), {
    requested: false,
    localProcessExited: false,
    remoteOutcome: "unknown",
  });
  await assert.rejects(bridged.status("../not-a-ref"));
});

test("control values are numbers, booleans or short choices, never paths, URLs or prototype names", () => {
  for (const controls of [
    { lora: "C:/m/x.safetensors" },
    { plugin: "https://evil.example" },
    { constructor: 1 },
    { toString: true },
    { guidance: Number.POSITIVE_INFINITY },
    { guidance: 1e9 },
  ])
    assert.throws(() => textToVideo({ controls }), JSON.stringify(controls));
  assert.doesNotThrow(() =>
    textToVideo({ controls: { guidance: 3, style: "film-noir", loop: false } }),
  );
  assert.throws(() => textToVideo({ leaseGeneration: 1e300 }));
});

test("the bridge refuses raw graphs, unlowered inputs and an absent engine before running anything", async () => {
  const bridged = bridgeV1(createFakeEngine());
  const ctx = context();
  assert.deepEqual(
    await bridged.submit(
      { ...textToVideo(), graph: { nodes: {} } } as unknown as EngineRequestV2,
      ctx,
    ),
    { refused: "INVALID_REQUEST" },
  );
  // The image recipe lowers a first frame only, so a last frame is refused.
  assert.deepEqual(
    await bridged.submit(
      imageToVideo({
        attemptKey: "two-frames",
        inputs: [
          { role: "firstFrame", asset: imageRef },
          { role: "lastFrame", asset: imageRef },
        ],
      }),
      ctx,
    ),
    { refused: "INPUT_UNSUPPORTED" },
  );
  // The text recipe lowers no controls, so it offers none.
  assert.deepEqual(
    await bridged.submit(
      textToVideo({ attemptKey: "ctl", controls: { guidance: 2 } }),
      ctx,
    ),
    { refused: "CONTROL_UNSUPPORTED" },
  );
  assert.equal(ctx.opened, 0);
  // A v1 engine that is not available behind the bridge.
  const absent = bridgeV1({
    ...createFakeEngine(),
    capabilities: () => ({ id: "none", available: false, reason: "off" }),
  });
  assert.ok(
    absent
      .capabilities()
      .every((c) => !c.available && c.reason === "ENGINE_DISABLED"),
  );
  assert.deepEqual(await absent.submit(textToVideo(), ctx), {
    refused: "ENGINE_DISABLED",
  });
  // An execution this bridge never ran is unknown, not an error.
  assert.equal((await bridged.reconcile("never-submitted")).state, "unknown");
  assert.deepEqual(await bridged.enumerateArtifacts("never-submitted"), []);
});

test("artifacts verify: bounded chunks, declared length and hash, for both adapters", async () => {
  const ctx = context();
  for (const engine of [
    createFakeEngineV2({ artifactBytes: 2 * ENGINE_V2_LIMITS.chunkBytes + 5 }),
    bridgeV1(createFakeEngine()),
  ]) {
    const submitted = await engine.submit(
      textToVideo({ attemptKey: "verify" }),
      ctx,
    );
    assert.ok("executionRef" in submitted);
    const [artifact] = await engine.enumerateArtifacts(submitted.executionRef);
    const { bytes } = await readArtifactVerified(
      engine,
      submitted.executionRef,
      artifact!,
    );
    assert.equal(bytes, artifact!.byteLength);
    // A declared hash or length the bytes do not match is refused.
    await assert.rejects(
      readArtifactVerified(engine, submitted.executionRef, {
        ...artifact!,
        sha256: zeros,
      }),
    );
    await assert.rejects(
      readArtifactVerified(engine, submitted.executionRef, {
        ...artifact!,
        byteLength: artifact!.byteLength - 1,
      }),
    );
  }
});

test("diagnostics are bounded and carry no paths or URLs", () => {
  const text = diagnostic(
    `Failed loading C:\\models\\secret.safetensors from https://host.example/x and /home/u/x ${"é".repeat(600)}`,
  )!;
  assert.ok(!/models|https|home\/u/.test(text), text);
  assert.ok(Array.from(text).length <= ENGINE_V2_LIMITS.diagnosticChars);
});

// MPR-206: what the fake can stand for, beside what it does with no option.
const accepted = async (engine: EngineAdapterV2, extra = {}) => {
  const answer = await engine.submit(textToVideo(extra), context());
  assert.ok("executionRef" in answer, JSON.stringify(answer));
  return answer;
};

test("an uncertain submit that landed can be followed", async () => {
  const world = createFakeWorld();
  const engine = createFakeEngineV2({ world, uncertainSubmit: "landed" });
  const { executionRef, uncertain } = await accepted(engine);
  assert.match(uncertain ?? "", /may have arrived/);
  assert.equal((await engine.status(executionRef)).state, "succeeded");
  const [artifact] = await engine.enumerateArtifacts(executionRef);
  await readArtifactVerified(engine, executionRef, artifact!);
  // The same attempt is the same answer, and sent once.
  assert.deepEqual(await accepted(engine), { executionRef, uncertain });
  assert.deepEqual([world.sends, engine.spawned()], [1, 1]);
});

test("an uncertain submit that never landed never succeeds", async () => {
  const world = createFakeWorld();
  const engine = createFakeEngineV2({ world, uncertainSubmit: "neverLanded" });
  const { executionRef, uncertain } = await accepted(engine);
  assert.ok(uncertain);
  for (let n = 0; n < 3; n++)
    assert.deepEqual(await engine.status(executionRef), {
      executionRef,
      state: "unknown",
    });
  assert.deepEqual(await engine.enumerateArtifacts(executionRef), []);
  // It was sent, and nothing started.
  assert.deepEqual([world.sends, engine.spawned()], [1, 0]);
});

test("a second fake over the same world knows the first one's executions and starts nothing", async () => {
  const world = createFakeWorld();
  const first = createFakeEngineV2({ world });
  const { executionRef } = await accepted(first);
  const second = createFakeEngineV2({ world });
  assert.deepEqual(
    await second.reconcile(executionRef),
    await first.status(executionRef),
  );
  const [artifact] = await second.enumerateArtifacts(executionRef);
  await readArtifactVerified(second, executionRef, artifact!);
  assert.deepEqual([world.sends, second.spawned()], [1, 0]);
  // Its next run is another one, and one of another world is not known.
  assert.notEqual(
    (await accepted(second, { attemptKey: "attempt-2" })).executionRef,
    executionRef,
  );
  await assert.rejects(
    createFakeEngineV2().status(executionRef),
    (e: { code?: string }) => e.code === "NOT_FOUND",
  );
});

test("a run the engine lost says so, and leaves nothing", async () => {
  const world = createFakeWorld();
  const { executionRef } = await accepted(createFakeEngineV2({ world }));
  const after = createFakeEngineV2({ world, lostExecutions: true });
  const status = ExecutionStatusSchema.parse(await after.status(executionRef));
  assert.deepEqual(
    [status.state, "failureClass" in status && status.failureClass],
    ["failed", "lostJob"],
  );
  assert.deepEqual(await after.enumerateArtifacts(executionRef), []);
});

test("a corrupt artifact fails verification", async () => {
  const engine = createFakeEngineV2({ corruptArtifact: true });
  const { executionRef } = await accepted(engine);
  const [artifact] = await engine.enumerateArtifacts(executionRef);
  await assert.rejects(
    readArtifactVerified(engine, executionRef, artifact!),
    /does not match its declared length and hash/,
  );
});

test("a stop that goes on says so", async () => {
  const going = createFakeEngineV2({
    stayRunning: true,
    cancelOutcome: "continuing",
  });
  const { executionRef } = await accepted(going);
  assert.deepEqual(await going.requestCancel(executionRef), {
    requested: true,
    localProcessExited: true,
    remoteAcknowledged: false,
    remoteOutcome: "continuing",
    billingOutcome: "unknown",
  });
  assert.equal((await going.status(executionRef)).state, "running");
  assert.equal(going.location?.("r"), "fake/r");
  const ended = createFakeEngineV2({
    stayRunning: true,
    cancelOutcome: "stopped",
  });
  const run = await accepted(ended);
  assert.equal(
    (await ended.requestCancel(run.executionRef)).remoteOutcome,
    "stopped",
  );
  assert.equal((await ended.status(run.executionRef)).state, "cancelled");
  // With neither it is on this computer, as before.
  const here = createFakeEngineV2({ stayRunning: true });
  assert.equal(here.location, undefined);
  assert.deepEqual(
    await here.requestCancel((await accepted(here)).executionRef),
    {
      requested: true,
      localProcessExited: true,
      billingOutcome: "notApplicable",
    },
  );
});

// MPR-206: the conformance kit over the bridge. Its version 1 engine is the fake, put in each
// state by what it says; each submit it takes is one send. It outlives a bridge, which after a
// restart knows nothing of what another one started.
const bridgeHarness = () => {
  let v1 = createFakeEngine();
  let over: Partial<EngineAdapter> = {};
  let sent = 0;
  let imported = 0;
  let attempts = 0;
  const says = (state: EngineStatus["state"]) => ({
    status: async (id: string) => ({ id, state }),
    cancel: async (id: string) => ({ id, state }),
  });
  const set = (of: (engine: EngineAdapter) => Partial<EngineAdapter>) => () => {
    over = of(v1);
  };
  const make = (extra: { operation?: string } & object = {}) => {
    const { operation, ...rest } = extra;
    const of = { attemptKey: `conformance-${++attempts}`, ...rest };
    return operation === "imageToVideo" ? imageToVideo(of) : textToVideo(of);
  };
  return {
    reset: () => {
      v1 = createFakeEngine();
      over = {};
      sent = 0;
      imported = 0;
    },
    adapter: () =>
      bridgeV1({
        ...v1,
        ...over,
        submit: (r) => {
          sent++;
          return v1.submit(r);
        },
      }),
    request: make,
    refusedRequests: () => [
      {
        request: {
          ...make({ operation: "imageToVideo" }),
          inputs: [
            { role: "firstFrame", asset: imageRef },
            { role: "lastFrame", asset: imageRef },
          ],
        },
        reason: "INPUT_UNSUPPORTED" as const,
      },
      {
        request: { ...make(), controls: { guidance: 1 } },
        reason: "CONTROL_UNSUPPORTED" as const,
      },
      {
        request: { ...make(), recipeHash: zeros },
        reason: "RECIPE_UNKNOWN" as const,
      },
      {
        request: { ...make(), graph: { nodes: {} } },
        reason: "INVALID_REQUEST" as const,
      },
    ],
    context: () => context(),
    sends: () => sent,
    remote: "none" as const,
    arrange: {
      succeeded: set(() => ({})),
      running: set(() => says("running")),
      failed: set(() => says("failed")),
      corruptArtifact: set((engine) => ({
        outputs: async (id) =>
          (await engine.outputs(id)).map((o) => ({ ...o, sha256: zeros })),
      })),
    },
    unavailable: {
      uncertainLanded:
        "A version 1 engine is called in this process: its answer cannot be lost.",
      uncertainNeverLanded:
        "A version 1 engine is called in this process: its answer cannot be lost.",
      lost: "A version 1 engine keeps its jobs as long as the bridge its executions: none is lost without both.",
    },
    service: {
      store: {
        exportProject: async () => ({
          name: "Conformance",
          output: { fps: { num: 30, den: 1 } },
          assets: [],
        }),
        read: () => undefined,
        importAsset: async () => {
          imported++;
          throw new Error("Nothing of these checks joins a store.");
        },
      } as unknown as ProjectStore,
      request: {
        projectId: "p",
        recipe: {
          id: "fake.textToVideo.v1",
          hash: recipeHash(SERVER_RECIPES[0]!),
          operation: "textToVideo" as const,
          modelManifestHash: zeros,
        },
        prompt: "A lighthouse at dusk",
        width: 640,
        height: 360,
        durationFrames: 60,
      },
      imports: () => imported,
    },
  };
};
engineConformance("bridge", bridgeHarness());
