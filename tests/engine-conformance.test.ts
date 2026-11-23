// MPR-206: the conformance kit over the in-process fake, adapters made wrong on purpose, which
// adapters run the kit, and the written operations against the contract's. It starts no process,
// opens no socket and waits on no clock.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  ENGINE_CONTRACT_V2,
  Operation,
  parseRequestV2,
  type AssetRef,
  type EngineAdapterV2,
  type EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import {
  createFakeEngineV2,
  createFakeWorld,
  type FakeEngineV2Options,
} from "../core/engines/fake.ts";
import type { ProjectStore } from "../core/store.ts";
import {
  CONFORMANCE_CHECKS,
  engineConformance,
  runConformance,
  type ConformanceCheck,
  type ConformanceHarness,
} from "./fixtures/engine-conformance.ts";
import { ADAPTER_SUITES, PENDING } from "./fixtures/engine-suites.ts";

const zeros = "0".repeat(64);
const TICKS = 705_600_000;
const bytes = Buffer.from("an input of the project");
const asset = (mediaType: AssetRef["mediaType"]): AssetRef => ({
  assetVersionId: `asset-${mediaType.replace("/", "-")}`,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  mediaType,
});
const output = {
  kind: "video" as const,
  width: 640,
  height: 360,
  fps: { num: 30, den: 1 },
  durationTicks: 2 * TICKS,
  audio: false,
};
const OF: Record<Operation, object> = {
  textToVideo: { prompt: "A lighthouse at dusk", inputs: [], output },
  imageToVideo: {
    inputs: [{ role: "firstFrame", asset: asset("image/png") }],
    output,
  },
  videoEdit: {
    prompt: "At night",
    inputs: [{ role: "source", asset: asset("video/mp4") }],
    output,
  },
  transcribe: {
    inputs: [{ role: "audio", asset: asset("audio/wav") }],
    output: { kind: "transcript" },
  },
  enhance: {
    inputs: [{ role: "source", asset: asset("video/mp4") }],
    output,
  },
};
let attempts = 0;
const request = (
  over: { operation?: Operation } & object = {},
): EngineRequestV2 => {
  const operation = over.operation ?? "textToVideo";
  return parseRequestV2({
    contract: ENGINE_CONTRACT_V2,
    operation,
    recipeId: "fake.v2",
    recipeHash: zeros,
    modelManifestHash: zeros,
    attemptKey: `attempt-${++attempts}`,
    leaseGeneration: 1,
    deadlineMs: 60_000,
    resourcePolicyHash: zeros,
    ...OF[operation],
    ...over,
  });
};

/** The fake in every state, with a stop that is of no remote, ends it there, or does not. */
function fakeHarness(
  remote: ConformanceHarness["remote"] = "none",
  wrap: (adapter: EngineAdapterV2) => EngineAdapterV2 = (a) => a,
): ConformanceHarness {
  let world = createFakeWorld();
  let options: FakeEngineV2Options = {};
  let imported = 0;
  const base: FakeEngineV2Options = {
    artifactBytes: 4096,
    ...(remote === "stoppable" ? { cancelOutcome: "stopped" } : {}),
    ...(remote === "unstoppable" ? { cancelOutcome: "continuing" } : {}),
  };
  const set = (over: FakeEngineV2Options) => () => {
    options = { ...base, ...over };
  };
  // What the service asks of a store before it starts a run, and where a video would join it.
  const store = {
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
  } as unknown as ProjectStore;
  return {
    reset: () => {
      world = createFakeWorld();
      imported = 0;
      options = base;
    },
    adapter: () => wrap(createFakeEngineV2({ ...options, world })),
    request,
    refusedRequests: () => [
      {
        request: {
          ...request(),
          inputs: [{ role: "reference", asset: asset("image/png") }],
        },
        reason: "INPUT_UNSUPPORTED",
      },
      {
        request: { ...request(), controls: { cameraYaw: 1 } },
        reason: "CONTROL_UNSUPPORTED",
      },
      {
        request: { ...request(), output: { ...output, audio: true } },
        reason: "OUTPUT_UNSUPPORTED",
      },
      {
        request: { ...request(), graph: { nodes: {} } },
        reason: "INVALID_REQUEST",
      },
    ],
    context: () => ({
      async *openAsset() {
        yield bytes;
      },
    }),
    sends: () => world.sends,
    remote,
    arrange: {
      succeeded: set({}),
      running: set({ stayRunning: true }),
      failed: set({ failExecutions: true, failureClass: "resourceExhausted" }),
      uncertainLanded: set({ uncertainSubmit: "landed" }),
      uncertainNeverLanded: set({ uncertainSubmit: "neverLanded" }),
      lost: set({ lostExecutions: true }),
      corruptArtifact: set({ corruptArtifact: true }),
    },
    unavailable: {},
    service: {
      store,
      request: {
        projectId: "p",
        recipe: {
          id: "fake.v2",
          hash: zeros,
          operation: "textToVideo",
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
}

engineConformance("fake", fakeHarness());
engineConformance("fake, stopped elsewhere", fakeHarness("stoppable"));
engineConformance("fake, going on elsewhere", fakeHarness("unstoppable"));

test("the fake passes every check, with none unavailable", async () => {
  for (const remote of ["none", "stoppable", "unstoppable"] as const) {
    const results = await runConformance(fakeHarness(remote));
    assert.deepEqual(
      results.map((r) => r.check),
      [...CONFORMANCE_CHECKS],
    );
    assert.deepEqual(
      results.filter((r) => !r.ok || r.unavailable),
      [],
      remote,
    );
  }
});

// Each is wrong in one way, and the check for that way finds it.
const failing = async (h: ConformanceHarness) =>
  (await runConformance(h)).filter((r) => !r.ok).map((r) => r.check);
const broken: [
  ConformanceCheck,
  ConformanceHarness["remote"],
  (adapter: EngineAdapterV2) => EngineAdapterV2,
][] = [
  [
    "restart-reconciles-without-sending",
    "none",
    (a) => ({
      ...a,
      reconcile: async (ref) => {
        await a.submit(request(), {
          async *openAsset() {
            yield bytes;
          },
        });
        return a.reconcile(ref);
      },
    }),
  ],
  [
    "cancel-never-overclaims",
    "unstoppable",
    (a) => ({
      ...a,
      requestCancel: async (ref) => ({
        ...(await a.requestCancel(ref)),
        remoteOutcome: "stopped",
      }),
    }),
  ],
  [
    "refusal-sends-nothing",
    "none",
    (a) => ({
      ...a,
      submit: (r, context) =>
        a.submit(
          {
            ...r,
            inputs: (r.inputs as { role: string }[]).filter(
              (i) => i.role !== "reference",
            ),
          } as EngineRequestV2,
          context,
        ),
    }),
  ],
  [
    "unlisted-role-refused",
    "none",
    (a) => ({
      ...a,
      submit: (r, context) =>
        a.submit(
          {
            ...r,
            inputs: (r.inputs as { role: string }[]).filter(
              (i) => i.role !== "reference",
            ),
          } as EngineRequestV2,
          context,
        ),
    }),
  ],
  [
    "limits-held",
    "none",
    (a) => ({
      ...a,
      submit: (r, context) =>
        a.submit(
          r.output.kind === "video"
            ? ({
                ...r,
                output: {
                  ...r.output,
                  width: Math.min(r.output.width, 1280),
                },
              } as EngineRequestV2)
            : r,
          context,
        ),
    }),
  ],
  [
    "status-parses",
    "none",
    (a) => ({
      ...a,
      status: async (ref) => ({ ...(await a.status(ref)), eta: 3 }) as never,
    }),
  ],
  [
    "ended-failure-has-class",
    "none",
    (a) => ({
      ...a,
      status: async (ref) => {
        const { failureClass: _, ...rest } = (await a.status(ref)) as {
          failureClass?: string;
        };
        return rest as never;
      },
    }),
  ],
  [
    "ref-usable-at-once",
    "none",
    (a) => {
      let asked = false;
      return {
        ...a,
        status: async (ref) => {
          asked = true;
          return a.status(ref);
        },
        enumerateArtifacts: async (ref) => {
          if (!asked) throw new Error("Ask how it is first.");
          return a.enumerateArtifacts(ref);
        },
      };
    },
  ],
  [
    "same-attempt-never-sent-twice",
    "none",
    (a) => ({
      ...a,
      submit: (r, context) =>
        a.submit(
          { ...r, attemptKey: `attempt-${++attempts}` } as EngineRequestV2,
          context,
        ),
    }),
  ],
  [
    "uncertain-sends-nothing-more",
    "none",
    (a) => ({
      ...a,
      submit: async (r, context) => {
        const answer = await a.submit(r, context);
        return "refused" in answer
          ? answer
          : { executionRef: answer.executionRef };
      },
    }),
  ],
  [
    "unknown-ref-answered-honestly",
    "none",
    (a) => ({
      ...a,
      status: async (ref) =>
        ref.startsWith("never")
          ? { executionRef: ref, state: "succeeded" }
          : a.status(ref),
    }),
  ],
  [
    "artifact-verified",
    "none",
    (a) => ({
      ...a,
      enumerateArtifacts: async (ref) =>
        (await a.enumerateArtifacts(ref)).map((x) => ({
          ...x,
          byteLength: x.byteLength + 1,
        })),
    }),
  ],
  [
    "diagnostic-bounded",
    "none",
    (a) => ({
      ...a,
      status: async (ref) =>
        ({
          ...(await a.status(ref)),
          diagnostic: `It is in ${process.cwd()}`,
        }) as never,
    }),
  ],
  [
    "location-declared",
    "unstoppable",
    (a) => ({ ...a, location: undefined }) as EngineAdapterV2,
  ],
];
for (const [check, remote, wrap] of broken)
  test(`an adapter that is wrong fails ${check}`, async () => {
    assert.ok((await failing(fakeHarness(remote, wrap))).includes(check));
  });

test("bytes that are not the declared ones fail two checks when an adapter declares them anyway", async () => {
  // It serves whatever was declared, whatever was asked for.
  const h = fakeHarness();
  const honest = fakeHarness();
  const found = await failing({
    ...h,
    arrange: { ...h.arrange, corruptArtifact: h.arrange.succeeded },
  });
  assert.ok(found.includes("corrupt-artifact-rejected"));
  assert.ok(found.includes("corrupt-result-not-imported"));
  assert.deepEqual(await failing(honest), []);
});

test("a service check fails where the service's adapter is wrong", async () => {
  // A run that has not ended when it is asked to be brought in, and a row written after the send.
  const h = fakeHarness("unstoppable");
  const store = h.service!.store;
  const early = await failing({
    ...h,
    service: {
      ...h.service!,
      store: {
        ...store,
        // Before its row exists, something of this run leaves.
        exportProject: async (...a: [string]) => {
          await h.adapter().submit(request(), h.context());
          return store.exportProject(...a);
        },
      } as unknown as ProjectStore,
    },
  });
  assert.ok(early.includes("row-before-send"));
});

test("a harness that leaves out a state, or gives no reason for it, is refused before anything is asked", async () => {
  const h = fakeHarness();
  let asked = 0;
  const counting = {
    ...h,
    adapter: () => {
      asked++;
      return h.adapter();
    },
  };
  const { lost: _lost, ...arrange } = h.arrange;
  const { service: _service, ...without } = counting;
  for (const [why, bad] of [
    ["left out", { ...counting, arrange }],
    ["an empty reason", { ...counting, arrange, unavailable: { lost: "" } }],
    ["both", { ...counting, unavailable: { lost: "It cannot be." } }],
    ["no service", without],
  ] as [string, ConformanceHarness][]) {
    await assert.rejects(
      runConformance(bad),
      /arranges "(lost|service)" or says why/,
      why,
    );
    assert.throws(() => engineConformance("never", bad), /or says why/, why);
  }
  assert.equal(asked, 0);
  // With a reason it is not asked, and that is not a pass.
  const told = await runConformance({
    ...counting,
    arrange,
    unavailable: { lost: "It forgets nothing." },
  });
  const one = told.find((r) => r.check === "unknown-ref-answered-honestly")!;
  assert.deepEqual(
    [one.ok, one.unavailable, one.detail],
    [false, true, "It forgets nothing."],
  );
});

const ENGINES = new URL("../core/engines/", import.meta.url);
const makesAdapter = (text: string) =>
  /^\s*contract: ENGINE_CONTRACT_V2,$/m.test(text) &&
  /EngineAdapterV2\b/.test(text) &&
  /\brequestCancel\b[^;]*[{(]/.test(text) &&
  /\breconcile\b/.test(text);
const unregistered = (files: readonly string[]) =>
  files.filter(
    (f) => !Object.hasOwn(ADAPTER_SUITES, f) && !PENDING.includes(f),
  );

test("every adapter file is registered with the conformance kit or named as pending", () => {
  const adapters = readdirSync(ENGINES)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => makesAdapter(readFileSync(new URL(f, ENGINES), "utf8")));
  assert.deepEqual(
    [...adapters].sort(),
    [...Object.keys(ADAPTER_SUITES), ...PENDING].sort(),
  );
  assert.deepEqual(unregistered(adapters), []);
  assert.deepEqual(unregistered([...adapters, "another.ts"]), ["another.ts"]);
  assert.equal(
    PENDING.some((f) => Object.hasOwn(ADAPTER_SUITES, f)),
    false,
  );
});

test("a registered test file calls the kit", () => {
  for (const file of new Set(Object.values(ADAPTER_SUITES)))
    assert.match(
      readFileSync(new URL(file, import.meta.url), "utf8"),
      /^engineConformance\(/m,
      file,
    );
});

const OPERATIONS_DOC = readFileSync(
  new URL("../docs/ENGINE_OPERATIONS.md", import.meta.url),
  "utf8",
);
// The lines of one first-level section.
const section = (doc: string, name: string) => {
  const lines = doc.split(/\r?\n/);
  const from = lines.indexOf(`# ${name}`);
  assert.ok(from >= 0, `No section "${name}".`);
  const to = lines.findIndex((l, i) => i > from && l.startsWith("# "));
  return lines.slice(from + 1, to < 0 ? undefined : to);
};
const defined = (doc: string) =>
  section(doc, "Operations")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));
const differs = (written: readonly string[], contract: readonly string[]) =>
  JSON.stringify(written) === JSON.stringify(contract)
    ? null
    : `written: ${written.join(", ")}; contract: ${contract.join(", ")}`;

test("the written operations are the contract's operations, in order", () => {
  const written = defined(OPERATIONS_DOC);
  assert.equal(differs(written, Operation.options), null);
  assert.equal(new Set(written).size, 5);
  // Each says the same things of itself.
  const text = section(OPERATIONS_DOC, "Operations").join("\n");
  for (const part of text.split("\n## ").slice(1))
    for (const said of [
      "**Purpose:**",
      "**Prompt:**",
      "**Inputs:**",
      "**Output:**",
      "**Never approximated:**",
    ])
      assert.equal(part.split(said).length, 2, `${part.slice(0, 20)} ${said}`);
  for (const name of [
    "Common to every operation",
    "Nothing is approximated",
    "Adding an operation",
    "Proposed, not in the contract",
  ])
    assert.ok(section(OPERATIONS_DOC, name).join("").length > 100, name);
  // One missing, one more, and two the other way round are seen.
  assert.match(
    differs(
      defined(OPERATIONS_DOC.replace("## enhance\n", "enhance\n")),
      Operation.options,
    )!,
    /written: .*transcribe; contract: .*enhance/,
  );
  assert.ok(differs(written, [...Operation.options, "textToImage"]));
  assert.ok(differs([...written].reverse(), Operation.options));
});

test("a proposed operation is not in the contract", () => {
  const proposed = section(OPERATIONS_DOC, "Proposed, not in the contract")
    .map((l) => /^\| `([A-Za-z0-9]+)` \| PROPOSED \|$/.exec(l)?.[1])
    .filter((name) => name !== undefined);
  // As the earlier proposal names them, but for the two that are defined.
  const named = /^Operations: (.+?)\. /m
    .exec(
      readFileSync(
        new URL("../docs/MODEL_CAPABILITIES.md", import.meta.url),
        "utf8",
      ),
    )![1]!
    .split(/, | and /);
  assert.equal(named.length, 13);
  assert.deepEqual(
    proposed,
    named.filter((n) => !(Operation.options as string[]).includes(n)),
  );
  for (const operation of proposed)
    assert.throws(
      () => parseRequestV2({ ...request(), operation }),
      /operation/,
      operation,
    );
});
