// MPR-206: the conformance kit over the in-process fake, adapters made wrong on purpose, which
// adapters run the kit, and the written operations against the contract's. It starts no process,
// opens no socket and waits on no clock.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { CommandError } from "../core/command/errors.ts";
import {
  ENGINE_CONTRACT_V2,
  Operation,
  constraintsHash,
  parseRequestV2,
  type AssetRef,
  type Cancellation,
  type EngineAdapterV2,
  type EngineContextV2,
  type EngineRequestV2,
  type ExecutionStatus,
} from "../core/engines/contract-v2.ts";
import {
  createGenerationService,
  memoryLedger,
} from "../core/engines/generation.ts";
import {
  createFakeEngineV2,
  createFakeWorld,
  type FakeEngineV2Options,
} from "../core/engines/fake.ts";
import type { ProjectStore } from "../core/store.ts";
import {
  CONFORMANCE_CHECKS,
  SCENARIOS,
  engineConformance,
  runConformance,
  type ConformanceCheck,
  type ConformanceHarness,
} from "./fixtures/engine-conformance.ts";
import {
  ADAPTER_SUITES,
  NOT_ADAPTERS,
  PENDING,
} from "./fixtures/engine-suites.ts";

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
const context = {
  async *openAsset() {
    yield bytes;
  },
};
// Something more is sent, as by one that takes silence for a run that never left.
const sendsAgain = (a: EngineAdapterV2) => a.submit(request(), context);
type Wrong = (adapter: EngineAdapterV2, nth: number) => EngineAdapterV2;
const withoutReference: Wrong = (a) => ({
  ...a,
  submit: (r, c) =>
    a.submit(
      {
        ...r,
        inputs: (r.inputs as { role: string }[]).filter(
          (i) => i.role !== "reference",
        ),
      } as EngineRequestV2,
      c,
    ),
});
const status =
  (of: (s: ExecutionStatus, nth: number) => object): Wrong =>
  (a, nth) => {
    const told = async (ref: string) =>
      of(await a.status(ref), nth) as ExecutionStatus;
    return { ...a, status: told, reconcile: told };
  };
const stop =
  (over: Partial<Cancellation>): Wrong =>
  (a) => ({
    ...a,
    requestCancel: async (ref) => ({
      ...(await a.requestCancel(ref)),
      ...over,
    }),
  });
const output1280 = (r: EngineRequestV2) =>
  (r.output.kind === "video"
    ? {
        ...r,
        output: { ...r.output, width: Math.min(r.output.width, 1280) },
      }
    : r) as EngineRequestV2;
const broken: [
  string,
  ConformanceCheck,
  ConformanceHarness["remote"],
  Wrong,
][] = [
  [
    "sends again in reconcile",
    "restart-reconciles-without-sending",
    "none",
    (a) => ({
      ...a,
      reconcile: async (ref) => {
        await sendsAgain(a);
        return a.reconcile(ref);
      },
    }),
  ],
  [
    "sends a failed run again after a restart",
    "restart-reconciles-without-sending",
    "none",
    (a, nth) => ({
      ...a,
      status: async (ref) => {
        const s = await a.status(ref);
        if (nth > 1 && s.state === "failed") await sendsAgain(a);
        return s;
      },
    }),
  ],
  [
    "sends a lost run again",
    "unknown-ref-answered-honestly",
    "none",
    (a) => ({
      ...a,
      status: async (ref) => {
        const s = await a.status(ref);
        if (s.state === "failed" && s.failureClass === "lostJob")
          await sendsAgain(a);
        return s;
      },
    }),
  ],
  [
    "sends a run again the third time it is asked about",
    "restart-reconciles-without-sending",
    "none",
    (a) => {
      let asked = 0;
      return {
        ...a,
        status: async (ref) => {
          if (++asked === 3) await sendsAgain(a);
          return a.status(ref);
        },
      };
    },
  ],
  [
    "sends an attempt again when its first answer was uncertain",
    "same-attempt-never-sent-twice",
    "none",
    (a) => {
      const uncertain = new Set<string>();
      return {
        ...a,
        submit: async (r, c) => {
          if (uncertain.has(r.attemptKey)) await sendsAgain(a);
          const answer = await a.submit(r, c);
          if ("uncertain" in answer) uncertain.add(r.attemptKey);
          return answer;
        },
      };
    },
  ],
  [
    "sends an attempt again when its run failed",
    "same-attempt-never-sent-twice",
    "none",
    (a) => {
      const refs = new Map<string, string>();
      return {
        ...a,
        submit: async (r, c) => {
          const ref = refs.get(r.attemptKey);
          if (ref && (await a.status(ref)).state === "failed")
            return sendsAgain(a);
          const answer = await a.submit(r, c);
          if ("executionRef" in answer)
            refs.set(r.attemptKey, answer.executionRef);
          return answer;
        },
      };
    },
  ],
  [
    "sends an attempt again while its run goes on",
    "same-attempt-never-sent-twice",
    "none",
    (a) => {
      const refs = new Map<string, string>();
      return {
        ...a,
        submit: async (r, c) => {
          const ref = refs.get(r.attemptKey);
          if (ref && (await a.status(ref)).state === "running")
            return sendsAgain(a);
          const answer = await a.submit(r, c);
          if ("executionRef" in answer)
            refs.set(r.attemptKey, answer.executionRef);
          return answer;
        },
      };
    },
  ],
  [
    "sends an attempt again when its run was stopped",
    "same-attempt-never-sent-twice",
    "none",
    (a) => {
      let stopped = false;
      return {
        ...a,
        requestCancel: async (ref) => {
          stopped = true;
          return a.requestCancel(ref);
        },
        submit: (r, c) => (stopped ? sendsAgain(a) : a.submit(r, c)),
      };
    },
  ],
  [
    "cannot be asked for the files of a run that goes on",
    "ref-usable-at-once",
    "none",
    (a) => ({
      ...a,
      enumerateArtifacts: async (ref) => {
        if ((await a.status(ref)).state === "running")
          throw new TypeError("It has no files.");
        return a.enumerateArtifacts(ref);
      },
    }),
  ],
  [
    "says it stopped a run that had finished",
    "cancel-never-overclaims",
    "stoppable",
    (a) => ({
      ...a,
      requestCancel: async (ref) => ({
        ...(await a.requestCancel(ref)),
        ...((await a.status(ref)).state === "succeeded"
          ? { remoteOutcome: "stopped" as const }
          : {}),
      }),
    }),
  ],
  [
    "says a run that never landed was refunded",
    "cancel-never-overclaims",
    "stoppable",
    (a) => ({
      ...a,
      requestCancel: async (ref) => ({
        ...(await a.requestCancel(ref)),
        ...((await a.status(ref)).state === "unknown"
          ? { billingOutcome: "refunded" as const }
          : {}),
      }),
    }),
  ],
  [
    "takes a frame rate and lists none",
    "limits-held",
    "none",
    (a) => ({
      ...a,
      capabilities: () =>
        a.capabilities().map((c) => {
          const constraints = { ...c.constraints!, fps: [] };
          return {
            ...c,
            constraints,
            constraintsHash: constraintsHash(constraints),
          };
        }),
      submit: (r, c) =>
        a.submit(
          (r.output.kind === "video"
            ? { ...r, output: { ...r.output, fps: { num: 30, den: 1 } } }
            : r) as EngineRequestV2,
          c,
        ),
    }),
  ],
  [
    "takes every submit for a new attempt",
    "same-attempt-never-sent-twice",
    "none",
    (a) => ({
      ...a,
      submit: (r, c) =>
        a.submit(
          { ...r, attemptKey: `attempt-${++attempts}` } as EngineRequestV2,
          c,
        ),
    }),
  ],
  [
    "sends again as a file is read",
    "artifact-verified",
    "none",
    (a) => ({
      ...a,
      async *readArtifact(ref, handle) {
        await sendsAgain(a);
        yield* a.readArtifact(ref, handle);
      },
    }),
  ],
  [
    "sends again as a run is stopped",
    "cancel-never-overclaims",
    "none",
    (a) => ({
      ...a,
      requestCancel: async (ref) => {
        await sendsAgain(a);
        return a.requestCancel(ref);
      },
    }),
  ],
  [
    "does not say that an answer was lost",
    "uncertain-sends-nothing-more",
    "none",
    (a) => ({
      ...a,
      submit: async (r, c) => {
        const answer = await a.submit(r, c);
        return "refused" in answer
          ? answer
          : { executionRef: answer.executionRef };
      },
    }),
  ],
  [
    "calls a run that never landed finished",
    "uncertain-sends-nothing-more",
    "none",
    status((s) => (s.state === "unknown" ? { ...s, state: "succeeded" } : s)),
  ],
  [
    "loses a landed run after a restart",
    "uncertain-sends-nothing-more",
    "unstoppable",
    (a, nth) =>
      nth > 1
        ? status((s) => ({ executionRef: s.executionRef, state: "unknown" }))(
            a,
            nth,
          )
        : a,
  ],
  [
    "calls a landed run lost after a restart",
    "states-told-as-they-are",
    "none",
    status((s, nth) =>
      nth > 1 && s.state === "succeeded"
        ? {
            executionRef: s.executionRef,
            state: "failed",
            failureClass: "lostJob",
          }
        : s,
    ),
  ],
  [
    "calls a running run finished",
    "states-told-as-they-are",
    "none",
    status((s) => (s.state === "running" ? { ...s, state: "succeeded" } : s)),
  ],
  [
    "calls a running run finished after a restart",
    "states-told-as-they-are",
    "none",
    status((s, nth) =>
      nth > 1 && s.state === "running" ? { ...s, state: "succeeded" } : s,
    ),
  ],
  [
    "calls a failed run finished",
    "states-told-as-they-are",
    "none",
    status(({ executionRef, state }) =>
      state === "failed"
        ? { executionRef, state: "succeeded" }
        : { executionRef, state },
    ),
  ],
  [
    "answers about another run",
    "status-parses",
    "none",
    status((s) => ({ ...s, executionRef: "another-run" })),
  ],
  [
    "answers with a field that is not the contract's",
    "status-parses",
    "none",
    status((s) => ({ ...s, eta: 3 })),
  ],
  [
    "names no kind of end",
    "ended-failure-has-class",
    "none",
    status((s) => {
      const { failureClass: _, ...rest } = s as { failureClass?: string };
      return rest;
    }),
  ],
  [
    "names a kind of end for a run that goes on",
    "ended-failure-has-class",
    "none",
    status((s) => ({ ...s, failureClass: "unknown" })),
  ],
  [
    "says a stop that goes on ended it",
    "cancel-never-overclaims",
    "unstoppable",
    stop({ remoteOutcome: "stopped" }),
  ],
  [
    "says a stop was acknowledged that was not",
    "cancel-never-overclaims",
    "unstoppable",
    stop({ remoteAcknowledged: true }),
  ],
  [
    "says a run that goes on was refunded",
    "cancel-never-overclaims",
    "unstoppable",
    stop({ billingOutcome: "refunded" }),
  ],
  [
    "says a stop elsewhere, where there is no elsewhere",
    "cancel-never-overclaims",
    "none",
    stop({ remoteAcknowledged: true, remoteOutcome: "stopped" }),
  ],
  [
    "says a bill where there is none",
    "cancel-never-overclaims",
    "none",
    stop({ billingOutcome: "charged" }),
  ],
  [
    "says its process ended and lets the run go on",
    "cancel-never-overclaims",
    "none",
    (a) => ({
      ...a,
      requestCancel: async () => ({
        requested: true,
        localProcessExited: true,
      }),
    }),
  ],
  [
    "says a run ended there and lets it go on",
    "cancel-never-overclaims",
    "stoppable",
    (a) => ({
      ...a,
      requestCancel: async () => ({
        requested: true,
        localProcessExited: true,
        remoteAcknowledged: true,
        remoteOutcome: "stopped",
      }),
    }),
  ],
  [
    "says it stopped a run that never landed",
    "cancel-never-overclaims",
    "stoppable",
    stop({ remoteOutcome: "stopped" }),
  ],
  [
    "says it stopped a run it never heard of",
    "unknown-ref-answered-honestly",
    "stoppable",
    (a) => ({
      ...a,
      requestCancel: async () => ({
        requested: true,
        localProcessExited: true,
        remoteOutcome: "stopped",
      }),
    }),
  ],
  [
    "calls a run it never heard of finished",
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
    "drops a role it does not take",
    "refusal-sends-nothing",
    "none",
    withoutReference,
  ],
  [
    "drops a role it does not list",
    "unlisted-role-refused",
    "none",
    withoutReference,
  ],
  [
    "takes a role it must have and does not list",
    "unlisted-role-refused",
    "none",
    (a) => ({
      ...a,
      capabilities: () =>
        a.capabilities().map((c) => {
          const constraints = { ...c.constraints!, roles: [] };
          return {
            ...c,
            constraints,
            constraintsHash: constraintsHash(constraints),
          };
        }),
    }),
  ],
  [
    "answers a size it cannot make with a smaller one",
    "limits-held",
    "none",
    (a) => ({ ...a, submit: (r, c) => a.submit(output1280(r), c) }),
  ],
  [
    "answers a frame rate it does not make with another",
    "limits-held",
    "none",
    (a) => ({
      ...a,
      submit: (r, c) =>
        a.submit(
          (r.output.kind === "video"
            ? { ...r, output: { ...r.output, fps: { num: 30, den: 1 } } }
            : r) as EngineRequestV2,
          c,
        ),
    }),
  ],
  [
    "refuses what its capabilities say it takes",
    "limits-held",
    "none",
    (a) => ({
      ...a,
      submit: async (r, c) =>
        r.output.kind === "video" && r.output.width > 1000
          ? { refused: "OUTPUT_UNSUPPORTED" }
          : a.submit(r, c),
    }),
  ],
  [
    "names constraints that are not its hash's",
    "limits-held",
    "none",
    (a) => ({
      ...a,
      capabilities: () =>
        a.capabilities().map((c) => ({ ...c, constraintsHash: zeros })),
    }),
  ],
  [
    "cannot be asked for its files before it was asked how it is",
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
    "declares a length that its file has not",
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
  ...[
    `It is in ${process.cwd()}`,
    "Kept on \\\\server\\share\\x",
    "Kept at [/data/me/x]",
    "Kept in \\Windows\\Temp",
    "x".repeat(501),
  ].map((said): (typeof broken)[number] => [
    `says "${said.slice(0, 24)}"`,
    "diagnostic-bounded",
    "none",
    status((s) => ({ ...s, diagnostic: said })),
  ]),
  [
    "does not say where it sends a run",
    "location-declared",
    "unstoppable",
    (a) => ({ ...a, location: undefined }) as EngineAdapterV2,
  ],
  [
    "says a place that is empty",
    "location-declared",
    "unstoppable",
    (a) => ({ ...a, location: () => "" }),
  ],
  [
    "says a place and sends nowhere",
    "location-declared",
    "none",
    (a) => ({ ...a, location: () => "somewhere" }),
  ],
];
for (const [what, check, remote, wrap] of broken)
  test(`an adapter that ${what} fails ${check}`, async () => {
    // Which adapter of its stand-in it is: the first sends, a later one is after a restart.
    let nth = 0;
    const h = fakeHarness(remote, (a) => wrap(a, ++nth));
    const reset = h.reset;
    const found = await failing({
      ...h,
      reset: () => {
        nth = 0;
        return reset();
      },
    });
    assert.ok(found.includes(check), found.join(", "));
  });

test("a truthful adapter passes, however it is made and however it refuses", async () => {
  // A class, whose parts are not its own properties.
  class Adapter {
    readonly #of: EngineAdapterV2;
    constructor(of: EngineAdapterV2) {
      this.#of = of;
    }
    get contract() {
      return this.#of.contract;
    }
    capabilities() {
      return this.#of.capabilities();
    }
    submit(r: EngineRequestV2, c: EngineContextV2) {
      return this.#of.submit(r, c);
    }
    status(ref: string) {
      return this.#of.status(ref);
    }
    reconcile(ref: string) {
      return this.#of.reconcile(ref);
    }
    requestCancel(ref: string) {
      return this.#of.requestCancel(ref);
    }
    enumerateArtifacts(ref: string) {
      return this.#of.enumerateArtifacts(ref);
    }
    readArtifact(ref: string, handle: string) {
      return this.#of.readArtifact(ref, handle);
    }
  }
  assert.deepEqual(
    await failing(fakeHarness("none", (a) => new Adapter(a))),
    [],
  );
  // One whose parts cannot be put in place of.
  assert.deepEqual(
    await failing(fakeHarness("none", (a) => Object.freeze({ ...a }))),
    [],
  );
  // A stop that was taken, and whose end is not known yet, on this computer and elsewhere.
  assert.deepEqual(
    await failing(
      fakeHarness("none", (a) => ({
        ...a,
        requestCancel: async (ref) => {
          const { state } = await a.status(ref);
          const there = state === "running" || state === "succeeded";
          return {
            ...(await a.requestCancel(ref)),
            remoteAcknowledged: there,
            remoteOutcome: "unknown",
          };
        },
      })),
    ),
    [],
  );
  assert.deepEqual(
    await failing(
      fakeHarness("stoppable", (a) => {
        // Ended the second time it is asked about.
        const going = new Map<string, number>();
        return {
          ...a,
          requestCancel: async (ref) => {
            const { state } = await a.status(ref);
            if (state !== "running") return a.requestCancel(ref);
            going.set(ref, 1);
            return {
              requested: true,
              localProcessExited: true,
              remoteAcknowledged: true,
              remoteOutcome: "unknown",
            };
          },
          status: async (ref) => {
            const left = going.get(ref);
            if (left === 0) await a.requestCancel(ref);
            if (left !== undefined) going.set(ref, left - 1);
            return a.status(ref);
          },
        };
      }),
    ),
    [],
  );
  // A stand-in that does not count a send which never landed.
  const uncounted = fakeHarness();
  let never = false;
  assert.deepEqual(
    await failing({
      ...uncounted,
      reset: () => {
        never = false;
        return uncounted.reset();
      },
      sends: () => uncounted.sends() - (never ? 1 : 0),
      arrange: {
        ...uncounted.arrange,
        uncertainNeverLanded: () => {
          never = true;
          return uncounted.arrange.uncertainNeverLanded!();
        },
      },
      context: () => uncounted.context(),
    }),
    [],
  );
  // A control that takes a narrow range of the contract's.
  assert.deepEqual(
    await failing(
      fakeHarness("none", (a) => ({
        ...a,
        submit: async (r, c) =>
          Number(r.controls?.guidance ?? 7) > 20
            ? { refused: "CONTROL_UNSUPPORTED" }
            : a.submit(r, c),
      })),
    ),
    [],
  );
  // A request past a limit, refused by an error of a command's own kind.
  assert.deepEqual(
    await failing(
      fakeHarness("none", (a) => ({
        ...a,
        submit: async (r, c) => {
          if (r.seed === 2 ** 32)
            throw new CommandError("VALIDATION", "That seed is too large.");
          return a.submit(r, c);
        },
      })),
    ),
    [],
  );
});

test("a stand-in that is not in the state it says fails", async () => {
  const h = fakeHarness();
  for (const [scenario, as] of [
    ["running", "succeeded"],
    ["failed", "succeeded"],
    ["corruptArtifact", "failed"],
    ["lost", "succeeded"],
    ["uncertainNeverLanded", "uncertainLanded"],
    ["succeeded", "running"],
  ] as const)
    assert.ok(
      (
        await failing({
          ...h,
          arrange: { ...h.arrange, [scenario]: h.arrange[as] },
        })
      ).includes("states-told-as-they-are"),
      `${scenario} as ${as}`,
    );
});

test("bytes that are not the declared ones fail two checks when an adapter declares them anyway", async () => {
  const h = fakeHarness();
  // It serves whatever was declared, whatever was asked for.
  const found = await failing({
    ...h,
    arrange: { ...h.arrange, corruptArtifact: h.arrange.succeeded },
  });
  assert.ok(found.includes("corrupt-artifact-rejected"));
  assert.ok(found.includes("corrupt-result-not-imported"));
});

// The service, wrong in one way over an adapter that is not.
type Service = ReturnType<typeof createGenerationService>;
const wrongServices: [
  string,
  ConformanceCheck,
  (service: Service, h: ConformanceHarness) => Service,
][] = [
  [
    "forgets that a run was stopped",
    "continuing-stop-blocks-import",
    (s) => ({ ...s, cancel: async () => ({}) as Cancellation }),
  ],
  [
    "brings in a stopped run that finished",
    "continuing-stop-blocks-import",
    (s) => ({
      ...s,
      importResult: async (id) => {
        // As it would be without the stop: only a run that has not ended is refused.
        if ((await s.status(id)).state !== "succeeded")
          return s.importResult(id);
        return {} as Awaited<ReturnType<Service["importResult"]>>;
      },
    }),
  ],
  [
    "sends an uncertain run again when it is asked about",
    "uncertain-row-not-resent",
    (s, h) => ({
      ...s,
      status: async (id) => {
        await sendsAgain(await h.adapter());
        return s.status(id);
      },
    }),
  ],
  [
    "sends before it records",
    "row-before-send",
    (s, h) => ({
      ...s,
      start: async (r) => {
        await sendsAgain(await h.adapter());
        return s.start(r);
      },
    }),
  ],
  [
    "brings in a file that is not the declared one",
    "corrupt-result-not-imported",
    (s) => ({
      ...s,
      importResult: async () =>
        ({}) as Awaited<ReturnType<Service["importResult"]>>,
    }),
  ],
];
for (const [what, check, wrap] of wrongServices)
  test(`a service that ${what} fails ${check}`, async () => {
    const h = fakeHarness("unstoppable");
    const found = await failing({
      ...h,
      service: {
        ...h.service!,
        make: (options) => wrap(createGenerationService(options), h),
      },
    });
    assert.ok(found.includes(check), found.join(", "));
  });

test("a service that asks before it has kept a run's name fails ref-before-poll", async () => {
  const h = fakeHarness();
  const found = await failing({
    ...h,
    service: {
      ...h.service!,
      ledger: () => {
        const ledger = memoryLedger();
        return {
          ...ledger,
          update: (id, { executionRef: _ref, ...change }) =>
            ledger.update(id, change),
        };
      },
    },
  });
  assert.ok(found.includes("ref-before-poll"));
});

test("what can be asked is asked, though a part of it cannot", async () => {
  const h = fakeHarness("none", (a) => ({
    ...a,
    status: async (ref) => {
      const s = await a.status(ref);
      return s.state === "unknown"
        ? { executionRef: ref, state: "succeeded" }
        : s;
    },
  }));
  const { uncertainLanded: _, ...arrange } = h.arrange;
  const results = await runConformance({
    ...h,
    arrange,
    unavailable: { uncertainLanded: "It always answers." },
  });
  const of = (check: ConformanceCheck) =>
    results.find((r) => r.check === check)!;
  assert.deepEqual(
    [
      of("uncertain-sends-nothing-more").ok,
      of("uncertain-sends-nothing-more").unavailable,
    ],
    [false, false],
  );
  // Nothing to arrange is nothing asked, of the checks that take any state too.
  const none = await runConformance({
    ...fakeHarness(),
    arrange: {},
    unavailable: Object.fromEntries(SCENARIOS.map((s) => [s, "No stand-in."])),
  });
  assert.deepEqual(
    none.filter((r) => r.ok).map((r) => r.check),
    [
      "refusal-sends-nothing",
      "unlisted-role-refused",
      "limits-held",
      "location-declared",
    ],
  );
  assert.deepEqual(
    none.filter((r) => !r.ok && !r.unavailable),
    [],
  );
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
    [false, true, "lost: It forgets nothing."],
  );
});

const ENGINES = new URL("../core/engines/", import.meta.url);
// Anything that could make an adapter names the contract or one of its parts, or takes one from
// a file that makes it (its types aside).
const makers = [...Object.keys(ADAPTER_SUITES), ...PENDING]
  .map((f) => f.replace(".", "\\."))
  .join("|");
const takesMaker = new RegExp(
  `^(import|export)(?! type\\b)[^;]*?from "[^"]*/(${makers})"`,
  "m",
);
const namesContract = (text: string) =>
  /EngineAdapterV2|ENGINE_CONTRACT_V2|engine-adapter\/v2|\brequestCancel\b/.test(
    text,
  ) || takesMaker.test(text);
const classified = (file: string) =>
  [
    Object.hasOwn(ADAPTER_SUITES, file),
    PENDING.includes(file),
    Object.hasOwn(NOT_ADAPTERS, file),
  ].filter(Boolean).length;

test("every adapter file is registered with the conformance kit or named as pending", () => {
  const engines = readdirSync(ENGINES, { recursive: true, encoding: "utf8" })
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => /\.[cm]?[jt]sx?$/.test(f));
  const naming = engines.filter((f) =>
    namesContract(readFileSync(new URL(f, ENGINES), "utf8")),
  );
  // Each in one list, and every list of files that are there.
  assert.deepEqual(
    naming.filter((f) => classified(f) !== 1),
    [],
  );
  assert.deepEqual(
    [
      ...Object.keys(ADAPTER_SUITES),
      ...PENDING,
      ...Object.keys(NOT_ADAPTERS),
    ].sort(),
    [...naming].sort(),
  );
  for (const why of Object.values(NOT_ADAPTERS)) assert.ok(why.length > 20);
  // One more, in whatever way it is written, is in none.
  assert.equal(classified("another.ts"), 0);
  assert.equal(classified("providers/another.ts"), 0);
  for (const text of [
    "class A implements EngineAdapterV2 {}",
    "const a = { contract: ENGINE_CONTRACT_V2 as const };",
    "const contract = ENGINE_CONTRACT_V2; export const a = { contract };",
    'const a = { contract: "yamakan.engine-adapter/v2" };',
    "const a = { contract: ENGINE_CONTRACT_V2, // the contract",
    "export const a = (b: Base) => ({ ...b, requestCancel: async () => {} });",
    'import { createKaggleEngine } from "./kaggle.ts";\nexport const a = (o: O) => ({ ...createKaggleEngine(o), submit });',
    'export {\n  bridgeV1 as a,\n} from "../v1-bridge.ts";',
  ])
    assert.ok(namesContract(text), text);
});

// What a file says outside its comments.
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a registered test file calls the kit", () => {
  for (const [adapter, { makes, tests, names }] of Object.entries(
    ADAPTER_SUITES,
  )) {
    assert.match(
      readFileSync(new URL(adapter, ENGINES), "utf8"),
      new RegExp(`^export (function|const) ${makes}\\b`, "m"),
      adapter,
    );
    const texts = tests.map((file) =>
      code(readFileSync(new URL(file, import.meta.url), "utf8")),
    );
    for (const [n, text] of texts.entries()) {
      assert.match(text, /^engineConformance\(/m, tests[n]);
      // It makes that adapter, from that file.
      assert.match(
        text,
        new RegExp(
          `\\b${makes}\\b[^;]*\\bfrom "\\.\\./core/engines/${adapter}"`,
        ),
        tests[n],
      );
      assert.match(text, new RegExp(`\\b${makes}\\(`), tests[n]);
    }
    for (const name of names)
      assert.ok(
        texts.some((text) =>
          new RegExp(`^engineConformance\\(\\s*"${name}",`, "m").test(text),
        ),
        name,
      );
  }
  assert.doesNotMatch(
    code("/*\nengineConformance(\n*/\n// engineConformance("),
    /engineConformance/,
  );
});

const OPERATIONS_DOC = readFileSync(
  new URL("../docs/ENGINE_OPERATIONS.md", import.meta.url),
  "utf8",
).replaceAll("\r\n", "\n");
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
