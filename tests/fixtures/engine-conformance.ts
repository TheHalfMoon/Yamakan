// MPR-206: what every adapter of the engine contract must do, whatever it runs. Each check says
// which sentence of core/engines/contract-v2.ts ("contract") or core/engines/generation.ts
// ("service") it holds an adapter to. It asks an adapter only through the contract, and what it
// cannot know that way (how often anything was really sent) its harness counts. A check is never
// weakened, and never called unavailable, so that an adapter passes.
import test from "node:test";
import assert from "node:assert/strict";
import { homedir, tmpdir } from "node:os";
import {
  CancellationSchema,
  ENGINE_V2_LIMITS,
  ExecutionStatusSchema,
  readArtifactVerified,
  type Artifact,
  type CapabilityV2,
  type EngineAdapterV2,
  type EngineContextV2,
  type EngineRequestV2,
  type ExecutionStatus,
  type Operation,
  type RefusalReason,
} from "../../core/engines/contract-v2.ts";
import {
  createGenerationService,
  memoryLedger,
  type GenerationLedger,
  type GenerationRequest,
} from "../../core/engines/generation.ts";
import type { ProjectStore } from "../../core/store.ts";

export const ADAPTER_CHECKS = [
  "refusal-sends-nothing",
  "unlisted-role-refused",
  "limits-held",
  "status-parses",
  "ended-failure-has-class",
  "ref-usable-at-once",
  "same-attempt-never-sent-twice",
  "uncertain-sends-nothing-more",
  "restart-reconciles-without-sending",
  "unknown-ref-answered-honestly",
  "cancel-never-overclaims",
  "artifact-verified",
  "corrupt-artifact-rejected",
  "diagnostic-bounded",
  "location-declared",
] as const;
export const SERVICE_CHECKS = [
  "row-before-send",
  "ref-before-poll",
  "uncertain-row-not-resent",
  "continuing-stop-blocks-import",
  "corrupt-result-not-imported",
] as const;
export const CONFORMANCE_CHECKS = [
  ...ADAPTER_CHECKS,
  ...SERVICE_CHECKS,
] as const;
export type ConformanceCheck = (typeof CONFORMANCE_CHECKS)[number];

// The states a stand-in is put in before a run is submitted.
export const SCENARIOS = [
  "succeeded",
  "running",
  "failed",
  "uncertainLanded",
  "uncertainNeverLanded",
  "lost",
  "corruptArtifact",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export type ConformanceHarness = {
  // Forgets everything the stand-in did. Called before each check and each scenario in one.
  reset(): void | Promise<void>;
  // A new adapter over the same stand-in, as after a restart of this service.
  adapter(): EngineAdapterV2;
  // A valid request of an operation the adapter claims, with nothing it can leave out.
  request(over?: { operation?: Operation } & object): EngineRequestV2;
  refusedRequests(): { request: unknown; reason: RefusalReason }[];
  context(): EngineContextV2;
  // How often anything was really sent or started, since the last reset.
  sends(): number;
  // Whether a run goes elsewhere, and whether a stop of it ends it there.
  remote: "none" | "stoppable" | "unstoppable";
  arrange: Partial<Record<Scenario, () => void | Promise<void>>>;
  // Why a state cannot be had with this stand-in, or why the service is not asked.
  unavailable: Partial<Record<Scenario | "service", string>>;
  // For the checks of the service over this adapter.
  service?: {
    store: ProjectStore;
    request: GenerationRequest;
    ledger?(): GenerationLedger;
    // How many media this store was given.
    imports(): number;
  };
};

export type ConformanceResult = {
  check: ConformanceCheck;
  ok: boolean;
  detail: string;
  // Not a pass: nothing was asked.
  unavailable: boolean;
};

class Unavailable extends Error {}

function assertWhole(h: ConformanceHarness) {
  for (const scenario of [...SCENARIOS, "service"] as const) {
    const given =
      scenario === "service"
        ? h.service !== undefined
        : h.arrange[scenario] !== undefined;
    const reason = h.unavailable[scenario];
    if (given === (reason !== undefined) || reason === "")
      throw new Error(
        `A harness arranges "${scenario}" or says why it cannot: one of the two.`,
      );
  }
}

type Submitted = {
  executionRef: string;
  uncertain?: string;
  notice?: string;
};
async function submitted(
  h: ConformanceHarness,
  adapter: EngineAdapterV2,
  request: EngineRequestV2 = h.request(),
): Promise<Submitted> {
  const answer = await adapter.submit(request, h.context());
  assert.ok(
    !("refused" in answer),
    `A valid request was refused: ${JSON.stringify(answer)}`,
  );
  return answer;
}
async function arranged(h: ConformanceHarness, scenario: Scenario) {
  await h.reset();
  const arrange = h.arrange[scenario];
  if (!arrange) throw new Unavailable(h.unavailable[scenario]);
  await arrange();
}
const available = (h: ConformanceHarness) =>
  SCENARIOS.filter((s) => h.arrange[s] !== undefined);

// Refused before anything is sent: an answer that says so, and a count that does not move.
async function refuses(
  h: ConformanceHarness,
  request: unknown,
  reason: RefusalReason | null,
  what: string,
) {
  const before = h.sends();
  const answer = await h
    .adapter()
    .submit(request as EngineRequestV2, h.context());
  assert.ok("refused" in answer, `${what} was accepted.`);
  if (reason !== null) assert.equal(answer.refused, reason, what);
  assert.equal(h.sends(), before, `${what} was refused, and something sent.`);
}

const ENDS: ReadonlySet<ExecutionStatus["state"]> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);
// Every answer about one run, until it ends or has been asked often enough.
async function followed(adapter: EngineAdapterV2, ref: string) {
  const seen: ExecutionStatus[] = [];
  for (let n = 0; n < 10; n++) {
    seen.push(await adapter.status(ref));
    seen.push(await adapter.reconcile(ref));
    if (ENDS.has(seen.at(-1)!.state)) break;
  }
  return seen;
}
// Everything an adapter says in every state this stand-in has, a stop included.
async function everythingSaid(h: ConformanceHarness) {
  const statuses: ExecutionStatus[] = [];
  const texts: string[] = [];
  for (const scenario of available(h)) {
    await arranged(h, scenario);
    const adapter = h.adapter();
    const answer = await submitted(h, adapter);
    texts.push(answer.uncertain ?? "", answer.notice ?? "");
    statuses.push(...(await followed(adapter, answer.executionRef)));
    await adapter.requestCancel(answer.executionRef);
    statuses.push(await adapter.status(answer.executionRef));
    statuses.push(await h.adapter().reconcile(answer.executionRef));
  }
  texts.push(...statuses.map((s) => s.diagnostic ?? ""));
  return { statuses, texts: texts.filter(Boolean) };
}

const EXTRA = {
  assetVersionId: "another-asset",
  sha256: "0".repeat(64),
  mediaType: "image/png" as const,
};
// What may follow the inputs a request of each operation must have.
const FURTHER_ROLES: Record<Operation, readonly string[]> = {
  textToVideo: ["reference"],
  imageToVideo: ["lastFrame", "reference"],
  videoEdit: ["mask"],
  transcribe: [],
  enhance: [],
};
const claimed = (h: ConformanceHarness): CapabilityV2[] => {
  const of = h
    .adapter()
    .capabilities()
    .filter((c) => c.available);
  assert.ok(of.length, "The adapter claims nothing, so nothing can be asked.");
  return of;
};

// What each limit accepts at its bound, and the least it refuses.
function boundsOf(c: CapabilityV2, base: EngineRequestV2) {
  const bounds: [string, unknown, unknown][] = [];
  const bound = (name: string, at: object, over: object) =>
    bounds.push([
      `${c.operation} ${name}`,
      { ...base, ...at },
      { ...base, ...over },
    ]);
  if ("prompt" in base)
    bound(
      "prompt",
      { prompt: "x".repeat(ENGINE_V2_LIMITS.promptChars) },
      { prompt: "x".repeat(ENGINE_V2_LIMITS.promptChars + 1) },
    );
  bound("seed", { seed: 2 ** 32 - 1 }, { seed: 2 ** 32 });
  bound(
    "deadlineMs",
    { deadlineMs: ENGINE_V2_LIMITS.deadlineMs },
    { deadlineMs: ENGINE_V2_LIMITS.deadlineMs + 1 },
  );
  const constraints = c.constraints!;
  for (const control of constraints.controls)
    bound(
      `control ${control}`,
      { controls: { [control]: 1e6 } },
      { controls: { [control]: 1e6 + 1 } },
    );
  const out = base.output;
  if (out.kind === "video") {
    // A size is even: one more than its bound is two.
    const even = (n: number) => n - (n % 2);
    const output = (over: object) => ({ output: { ...out, ...over } });
    const { maxWidth, maxHeight, minDurationTicks, maxDurationTicks } =
      constraints;
    bound(
      "width",
      output({ width: even(maxWidth) }),
      output({ width: even(maxWidth) + 2 }),
    );
    bound(
      "height",
      output({ height: even(maxHeight) }),
      output({ height: even(maxHeight) + 2 }),
    );
    bound(
      "longest",
      output({ durationTicks: maxDurationTicks }),
      output({ durationTicks: maxDurationTicks + 1 }),
    );
    bound(
      "shortest",
      output({ durationTicks: minDurationTicks }),
      output({ durationTicks: minDurationTicks - 1 }),
    );
  }
  return bounds;
}

// An absolute path, or a folder of this computer in any form.
const FOLDERS = [homedir(), tmpdir(), process.cwd()].flatMap((f) => [
  f.toLowerCase(),
  f.toLowerCase().replaceAll("\\", "/"),
]);
const holdsPath = (text: string) =>
  /[A-Za-z]:[\\/]/.test(text) ||
  /(^|[\s"'(=])\/[^\s/"']+\/[^\s"']/.test(text) ||
  FOLDERS.some((f) => f.length > 3 && text.toLowerCase().includes(f));

const notFound = (e: unknown) =>
  e instanceof Error && (e as { code?: unknown }).code === "NOT_FOUND";
// Never issued, so nothing may be known of it.
const NEVER_ISSUED = "never-issued-1";

const ADAPTER: Record<
  (typeof ADAPTER_CHECKS)[number],
  (h: ConformanceHarness) => Promise<void>
> = {
  // contract: "the reason it cannot run (decided before any worker exists)".
  "refusal-sends-nothing": async (h) => {
    const refused = h.refusedRequests();
    assert.ok(refused.length, "A harness names a request that is refused.");
    for (const { request, reason } of refused) {
      await h.reset();
      await refuses(h, request, reason, `A request (${reason})`);
    }
  },

  // contract: "The input roles this engine honours (a request using another refuses)."
  "unlisted-role-refused": async (h) => {
    for (const c of claimed(h))
      for (const role of FURTHER_ROLES[c.operation]) {
        if (c.constraints!.roles.includes(role)) continue;
        await h.reset();
        const base = h.request({ operation: c.operation });
        await refuses(
          h,
          { ...base, inputs: [...base.inputs, { role, asset: EXTRA }] },
          "INPUT_UNSUPPORTED",
          `${c.operation} with a ${role}`,
        );
      }
  },

  // contract: "a request is checked against them before any worker is spawned".
  "limits-held": async (h) => {
    for (const c of claimed(h))
      for (const [name, at, over] of boundsOf(
        c,
        h.request({ operation: c.operation }),
      )) {
        await h.reset();
        await refuses(h, over, null, `${name} past its bound`);
        await h.reset();
        await submitted(h, h.adapter(), at as EngineRequestV2).catch((e) => {
          throw new Error(`${name} at its bound: ${e.message}`);
        });
      }
  },

  // contract: "Observations an adapter reports: bounded".
  "status-parses": async (h) => {
    const { statuses } = await everythingSaid(h);
    assert.ok(statuses.length);
    for (const s of statuses) ExecutionStatusSchema.parse(s);
  },

  // contract: "An adapter that says a run failed or was stopped names which kind of end it was".
  "ended-failure-has-class": async (h) => {
    await arranged(h, "failed");
    const { statuses } = await everythingSaid(h);
    const ended = statuses.filter(
      (s) => s.state === "failed" || s.state === "cancelled",
    );
    assert.ok(ended.length, "No run of this stand-in ended in a failure.");
    for (const s of statuses)
      assert.equal(
        "failureClass" in s && typeof s.failureClass === "string",
        ended.includes(s),
        JSON.stringify(s),
      );
  },

  // contract: "An external execution reference tied to the durable attempt".
  "ref-usable-at-once": async (h) => {
    for (const ask of [
      (a, ref) => a.status(ref),
      (a, ref) => a.reconcile(ref),
      (a, ref) => a.requestCancel(ref),
      (a, ref) => a.enumerateArtifacts(ref),
    ] as ((a: EngineAdapterV2, ref: string) => Promise<unknown>)[]) {
      await arranged(h, "succeeded");
      const adapter = h.adapter();
      const { executionRef } = await submitted(h, adapter);
      await ask(adapter, executionRef);
    }
  },

  // contract: "the current generation replays its first result for the same request".
  "same-attempt-never-sent-twice": async (h) => {
    for (const atOnce of [false, true]) {
      await arranged(h, "succeeded");
      const adapter = h.adapter();
      const before = h.sends();
      const request = h.request();
      const again = () => adapter.submit(request, h.context());
      const answers = atOnce
        ? await Promise.allSettled([again(), again()])
        : [await settled(again()), await settled(again())];
      assert.equal(h.sends(), before + 1, "Sent other than once.");
      const refs = answers.flatMap((a) =>
        a.status === "fulfilled" && "executionRef" in a.value
          ? [a.value.executionRef]
          : [],
      );
      assert.ok(refs.length, "Neither was accepted.");
      assert.equal(new Set(refs).size, 1, "One attempt is two runs.");
    }
  },

  // contract: "the send's answer was lost, so it may have arrived. Said, not resent."
  "uncertain-sends-nothing-more": async (h) => {
    for (const [scenario, lands] of [
      ["uncertainLanded", true],
      ["uncertainNeverLanded", false],
    ] as const) {
      await arranged(h, scenario);
      const adapter = h.adapter();
      const { executionRef, uncertain } = await submitted(h, adapter);
      assert.ok(uncertain, `${scenario}: an uncertain send is not said.`);
      const sent = h.sends();
      const seen = [
        ...(await followed(adapter, executionRef)),
        ...(await followed(h.adapter(), executionRef)),
      ];
      assert.equal(h.sends(), sent, `${scenario}: sent again.`);
      assert.equal(
        seen.some((s) => s.state === "succeeded"),
        lands,
        `${scenario}: ${seen.map((s) => s.state).join(", ")}`,
      );
      if (!lands)
        assert.equal(
          (await adapter.enumerateArtifacts(executionRef).catch(() => []))
            .length,
          0,
        );
    }
  },

  // contract: "After a restart: what is known about an execution, never a resubmit."
  "restart-reconciles-without-sending": async (h) => {
    for (const scenario of ["succeeded", "running"] as const) {
      await arranged(h, scenario);
      const { executionRef } = await submitted(h, h.adapter());
      const sent = h.sends();
      const after = h.adapter();
      const answer = await after.reconcile(executionRef);
      ExecutionStatusSchema.parse(answer);
      assert.equal(answer.executionRef, executionRef);
      await after.status(executionRef);
      assert.equal(h.sends(), sent, `${scenario}: sent after a restart.`);
    }
  },

  // contract: "Observations an adapter reports", of a run it never heard of and one it lost.
  "unknown-ref-answered-honestly": async (h) => {
    await h.reset();
    const adapter = h.adapter();
    for (const ask of [adapter.status, adapter.reconcile]) {
      const answer = await ask.call(adapter, NEVER_ISSUED).catch((e) => {
        if (!notFound(e)) throw e;
        return null;
      });
      if (answer) assert.equal(answer.state, "unknown");
    }
    const left = await adapter.enumerateArtifacts(NEVER_ISSUED).catch((e) => {
      if (!notFound(e)) throw e;
      return [];
    });
    assert.deepEqual(left, []);
    assert.equal(h.sends(), 0);
    await arranged(h, "lost");
    const losing = h.adapter();
    const { executionRef } = await submitted(h, losing);
    for (const s of await followed(losing, executionRef))
      assert.notEqual(s.state, "succeeded");
  },

  // contract: Cancellation's remoteAcknowledged, remoteOutcome and billingOutcome.
  "cancel-never-overclaims": async (h) => {
    for (const scenario of ["running", "uncertainLanded"] as const) {
      if (scenario !== "running" && !h.arrange[scenario]) continue;
      await arranged(h, scenario);
      const adapter = h.adapter();
      const { executionRef } = await submitted(h, adapter);
      const sent = h.sends();
      const answer = await adapter.requestCancel(executionRef);
      CancellationSchema.parse(answer);
      assert.equal(h.sends(), sent, "A stop started something.");
      if (h.remote === "unstoppable") {
        assert.notEqual(answer.remoteOutcome, "stopped");
        assert.notEqual(answer.remoteAcknowledged, true);
        // Nor afterwards: what goes on there is not said to have been stopped.
        assert.notEqual(
          (await adapter.status(executionRef)).state,
          "cancelled",
        );
      }
      if (h.remote === "none")
        assert.ok(
          answer.billingOutcome === undefined ||
            answer.billingOutcome === "notApplicable",
          `billingOutcome ${answer.billingOutcome}`,
        );
    }
  },

  // contract: "named artifacts the service reads back in bounded chunks, re-hashing".
  "artifact-verified": async (h) => {
    await arranged(h, "succeeded");
    const adapter = h.adapter();
    const { executionRef } = await submitted(h, adapter);
    const seen = await followed(adapter, executionRef);
    assert.equal(seen.at(-1)!.state, "succeeded");
    const artifacts = await adapter.enumerateArtifacts(executionRef);
    assert.ok(artifacts.length, "A succeeded run left nothing.");
    assert.ok(artifacts.length <= ENGINE_V2_LIMITS.artifacts);
    for (const artifact of artifacts)
      await readArtifactVerified(adapter, executionRef, artifact);
  },

  // contract: "An artifact does not match its declared length and hash."
  "corrupt-artifact-rejected": async (h) => {
    await arranged(h, "corruptArtifact");
    const adapter = h.adapter();
    const { executionRef } = await submitted(h, adapter);
    await followed(adapter, executionRef);
    // One that finds it itself names no artifact, or says why.
    let artifacts: Artifact[] = [];
    try {
      artifacts = await adapter.enumerateArtifacts(executionRef);
    } catch {
      return;
    }
    for (const artifact of artifacts)
      await assert.rejects(
        readArtifactVerified(adapter, executionRef, artifact),
        "Bytes that were not declared were taken.",
      );
  },

  // contract: "Diagnostics leave an adapter bounded and without paths or URLs."
  "diagnostic-bounded": async (h) => {
    const { texts } = await everythingSaid(h);
    for (const text of texts) {
      assert.ok(
        text.length <= ENGINE_V2_LIMITS.diagnosticChars,
        `${text.length} characters`,
      );
      assert.ok(!holdsPath(text), `It holds a path: ${text}`);
    }
  },

  // contract: "An engine that sends a run off this computer must have this".
  "location-declared": async (h) => {
    await h.reset();
    const adapter = h.adapter();
    assert.equal(
      typeof adapter.location === "function",
      h.remote !== "none",
      `remote: ${h.remote}`,
    );
    const { recipeId } = h.request();
    if (adapter.location)
      assert.equal(typeof adapter.location(recipeId), "string");
  },
};

async function settled<T>(p: Promise<T>): Promise<PromiseSettledResult<T>> {
  return (await Promise.allSettled([p]))[0]!;
}

// The service over this adapter, with its ledger watched.
function watched(h: ConformanceHarness, ledger: GenerationLedger) {
  const { store } = h.service!;
  const seen = {
    sendsAtBegin: [] as number[],
    refAtStatus: [] as (string | null)[],
  };
  const held = h.adapter();
  const adapter: EngineAdapterV2 = {
    ...held,
    status: async (ref) => {
      seen.refAtStatus.push(ledger.read(current)?.executionRef ?? null);
      return held.status(ref);
    },
  };
  let current = "";
  const service = createGenerationService({
    adapter,
    store,
    resourcePolicyHash: "0".repeat(64),
    ledger: {
      ...ledger,
      begin: (record) => {
        current = record.generationId;
        seen.sendsAtBegin.push(h.sends());
        ledger.begin(record);
      },
    },
  });
  return { service, seen };
}
const ledgerOf = (h: ConformanceHarness) =>
  h.service!.ledger?.() ?? memoryLedger();
async function served(h: ConformanceHarness, scenario: Scenario) {
  if (!h.service) throw new Unavailable(h.unavailable.service);
  await arranged(h, scenario);
  const ledger = ledgerOf(h);
  return { ledger, ...watched(h, ledger), request: h.service.request };
}
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
};

const SERVICE: Record<
  (typeof SERVICE_CHECKS)[number],
  (h: ConformanceHarness) => Promise<void>
> = {
  // service: "Recorded before anything leaves: a crash from here on leaves a record."
  "row-before-send": async (h) => {
    const { service, seen, request } = await served(h, "succeeded");
    const before = h.sends();
    await service.start(request);
    assert.deepEqual(seen.sendsAtBegin, [before], "Sent before its row.");
    assert.equal(h.sends(), before + 1);
  },

  // service: "The engine's name for it, once known. Before that, the attempt key is."
  "ref-before-poll": async (h) => {
    const { service, seen, request } = await served(h, "succeeded");
    const { generationId } = await service.start(request);
    await service.status(generationId);
    assert.ok(seen.refAtStatus.length, "The adapter was not asked.");
    assert.ok(seen.refAtStatus[0], "Asked before the row held its name.");
  },

  // service: "it is followed, not resent".
  "uncertain-row-not-resent": async (h) => {
    for (const scenario of [
      "uncertainLanded",
      "uncertainNeverLanded",
    ] as const) {
      const { service, ledger, request } = await served(h, scenario);
      const { generationId } = await service.start(request);
      assert.equal(ledger.read(generationId)?.phase, "sending", scenario);
      const sent = h.sends();
      const { service: next } = watched(h, ledger);
      assert.deepEqual(
        next.list(request.projectId).map((g) => g.generationId),
        [generationId],
      );
      await next.status(generationId);
      assert.equal(h.sends(), sent, `${scenario}: sent again.`);
      if (scenario === "uncertainNeverLanded")
        assert.equal(ledger.read(generationId)?.phase, "sending");
    }
  },

  // service: "Asked to stop: whatever the engine then does, this is not imported".
  "continuing-stop-blocks-import": async (h) => {
    const { service, ledger, request } = await served(h, "running");
    const { generationId } = await service.start(request);
    await service.cancel(generationId);
    const row = ledger.read(generationId)!;
    assert.equal(row.cancelled, true);
    if (h.remote === "unstoppable")
      assert.match(row.diagnostic ?? "", /The engine was not told to stop/);
    assert.equal(
      await codeOf(service.importResult(generationId)),
      "VALIDATION",
    );
    assert.equal(h.service!.imports(), 0);
  },

  // service: "checked by its declared length and hash".
  "corrupt-result-not-imported": async (h) => {
    const { service, request } = await served(h, "corruptArtifact");
    const { generationId } = await service.start(request);
    await service.status(generationId);
    assert.equal(
      await codeOf(service.importResult(generationId)),
      "VALIDATION",
    );
    assert.equal(h.service!.imports(), 0);
  },
};

/** Every check of one adapter, one at a time: what passed, what did not, and what was not asked. */
export async function runConformance(
  h: ConformanceHarness,
  checks: readonly ConformanceCheck[] = CONFORMANCE_CHECKS,
): Promise<ConformanceResult[]> {
  assertWhole(h);
  const results: ConformanceResult[] = [];
  for (const check of checks) {
    const of = { ...ADAPTER, ...SERVICE }[check];
    try {
      await h.reset();
      await of(h);
      results.push({ check, ok: true, detail: "", unavailable: false });
    } catch (e) {
      results.push({
        check,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
        unavailable: e instanceof Unavailable,
      });
    }
  }
  return results;
}

/** One test of each check. One that its stand-in cannot arrange is skipped, with the reason. */
export function engineConformance(
  name: string,
  make: ConformanceHarness | (() => Promise<ConformanceHarness>),
) {
  if (typeof make !== "function") assertWhole(make);
  for (const check of CONFORMANCE_CHECKS)
    test(`${name}: ${check}`, async (t) => {
      const harness = typeof make === "function" ? await make() : make;
      const [result] = await runConformance(harness, [check]);
      if (result!.unavailable) return t.skip(result!.detail);
      assert.ok(result!.ok, result!.detail);
    });
}
