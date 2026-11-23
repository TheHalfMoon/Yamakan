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
  CapabilityV2Schema,
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
import { CommandError } from "../../core/command/errors.ts";
import type { ProjectStore } from "../../core/store.ts";

export const ADAPTER_CHECKS = [
  "refusal-sends-nothing",
  "unlisted-role-refused",
  "limits-held",
  "status-parses",
  "states-told-as-they-are",
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
  // How often anything was sent or started, since the last reset, as the stand-in counts it: one
  // that is lost before it lands may not be among them.
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
    // The kit's own tests only: another service over the same adapter.
    make?: typeof createGenerationService;
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

const sentOnce = (scenario: Scenario, sent: number) =>
  sent === 1 || (scenario === "uncertainNeverLanded" && sent === 0);

// Each of these states that the stand-in has, with a run submitted in it. Whatever is then asked,
// nothing more is sent: contract, "After a restart: what is known about an execution, never a
// resubmit", and "Said, not resent". A state it has not is told after the others were asked.
async function each(
  h: ConformanceHarness,
  scenarios: readonly Scenario[],
  ask: (
    scenario: Scenario,
    run: {
      adapter: EngineAdapterV2;
      request: EngineRequestV2;
      answer: Submitted;
      ref: string;
    },
  ) => Promise<void>,
) {
  const missing: string[] = [];
  for (const scenario of scenarios) {
    const arrange = h.arrange[scenario];
    if (!arrange) {
      missing.push(`${scenario}: ${h.unavailable[scenario]}`);
      continue;
    }
    await h.reset();
    await arrange();
    const adapter = h.adapter();
    const request = h.request();
    const answer = await submitted(h, adapter, request);
    const sent = h.sends();
    assert.ok(sentOnce(scenario, sent), `${scenario}: sent ${sent} times.`);
    await ask(scenario, {
      adapter,
      request,
      answer,
      ref: answer.executionRef,
    });
    assert.equal(h.sends(), sent, `${scenario}: sent again.`);
  }
  if (missing.length) throw new Unavailable(missing.join(" "));
}
// Every part is asked, and what one could not ask is told after the others.
async function whole(...parts: (() => Promise<void>)[]) {
  const missing: string[] = [];
  for (const part of parts)
    try {
      await part();
    } catch (e) {
      if (!(e instanceof Unavailable)) throw e;
      missing.push(e.message);
    }
  if (missing.length) throw new Unavailable(missing.join(" "));
}
// The states this stand-in has, for what is asked of any: with none, nothing is asked.
const had = (h: ConformanceHarness) => {
  const scenarios = SCENARIOS.filter((s) => h.arrange[s] !== undefined);
  if (!scenarios.length) throw new Unavailable("No state can be had.");
  return scenarios;
};

// Refused before anything is sent: an answer that says so, or where no reason is asked for an
// error of a command's own kind, and a count that does not move.
async function refuses(
  h: ConformanceHarness,
  request: unknown,
  reason: RefusalReason | null,
  what: string,
) {
  await h.reset();
  let answer: Awaited<ReturnType<EngineAdapterV2["submit"]>> | null = null;
  try {
    answer = await h.adapter().submit(request as EngineRequestV2, h.context());
  } catch (e) {
    if (reason !== null || !(e instanceof CommandError)) throw e;
  }
  if (answer !== null) {
    assert.ok("refused" in answer, `${what} was accepted.`);
    if (reason !== null) assert.equal(answer.refused, reason, what);
  }
  assert.equal(h.sends(), 0, `${what} was refused, and something sent.`);
}

const ENDS: ReadonlySet<ExecutionStatus["state"]> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);
const GOING: ReadonlySet<ExecutionStatus["state"]> = new Set([
  "queued",
  "running",
]);
// Every answer about one run, until it ends or has been asked often enough.
async function followed(adapter: EngineAdapterV2, ref: string) {
  const seen: ExecutionStatus[] = [];
  for (let n = 0; n < 10; n++) {
    seen.push(await adapter.status(ref));
    seen.push(await adapter.reconcile(ref));
    if (ENDS.has(seen.at(-1)!.state)) break;
  }
  for (const s of seen)
    assert.equal(s.executionRef, ref, "An answer about another run.");
  return seen;
}
// Everything an adapter says in every state this stand-in has, a stop included.
async function everythingSaid(h: ConformanceHarness) {
  const statuses: ExecutionStatus[] = [];
  const texts: string[] = [];
  await each(h, had(h), async (_, { adapter, answer, ref }) => {
    texts.push(answer.notice ?? "");
    statuses.push(...(await followed(adapter, ref)));
    statuses.push(...(await followed(h.adapter(), ref)));
    await adapter.requestCancel(ref);
    statuses.push(await adapter.status(ref));
    statuses.push(await h.adapter().reconcile(ref));
  });
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
// contract: "Available means measured constraints", and their hash is theirs.
const claimed = (h: ConformanceHarness): CapabilityV2[] => {
  const of = h
    .adapter()
    .capabilities()
    .map((c) => CapabilityV2Schema.parse(c))
    .filter((c) => c.available);
  assert.ok(of.length, "The adapter claims nothing, so nothing can be asked.");
  return of;
};

// What is accepted at each bound (nothing, where only the engine could say), and the least that
// is refused past it.
function boundsOf(c: CapabilityV2, base: EngineRequestV2) {
  const bounds: [string, object | null, object][] = [];
  const bound = (name: string, at: object | null, over: object) =>
    bounds.push([
      `${c.operation} ${name}`,
      at && { ...base, ...at },
      { ...base, ...over },
    ]);
  if ("prompt" in base) {
    bound(
      "longest prompt",
      { prompt: "x".repeat(ENGINE_V2_LIMITS.promptChars) },
      { prompt: "x".repeat(ENGINE_V2_LIMITS.promptChars + 1) },
    );
    bound("shortest prompt", { prompt: "x" }, { prompt: "" });
  }
  bound("greatest seed", { seed: 2 ** 32 - 1 }, { seed: 2 ** 32 });
  bound("least seed", { seed: 0 }, { seed: -1 });
  bound(
    "longest deadline",
    { deadlineMs: ENGINE_V2_LIMITS.deadlineMs },
    { deadlineMs: ENGINE_V2_LIMITS.deadlineMs + 1 },
  );
  bound("shortest deadline", null, { deadlineMs: 0 });
  bound("least lease", { leaseGeneration: 1 }, { leaseGeneration: 0 });
  const constraints = c.constraints!;
  // Which values of its own a control takes is the engine's: only the contract's range is asked.
  for (const control of constraints.controls)
    for (const value of [1e6 + 1, -1e6 - 1])
      bound(`control ${control}`, null, { controls: { [control]: value } });
  bound("a control it does not list", null, {
    controls: { notAControlOfAny: 1 },
  });
  const out = base.output;
  if (out.kind === "video") {
    // A size is even: one more than its bound is two.
    const even = (n: number) => n - (n % 2);
    const output = (over: object) => ({ output: { ...out, ...over } });
    const { maxWidth, maxHeight, minDurationTicks, maxDurationTicks } =
      constraints;
    for (const [name, most] of [
      ["width", maxWidth],
      ["height", maxHeight],
    ] as const) {
      bound(
        `greatest ${name}`,
        output({ [name]: even(most) }),
        output({ [name]: even(most) + 2 }),
      );
      // How small a model goes is the engine's: the contract's least is asked past only.
      bound(`least ${name}`, null, output({ [name]: 14 }));
    }
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
    const rate = { num: 7919, den: 997 };
    bound("a frame rate it does not list", null, output({ fps: rate }));
    for (const fps of constraints.fps)
      bound(
        `${fps.num}/${fps.den} frames a second`,
        output({ fps }),
        output({ fps: rate }),
      );
    if (!constraints.audio)
      bound("sound it does not make", null, output({ audio: true }));
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
  /\\\\[^\\\s]+\\/.test(text) ||
  /(^|[^A-Za-z0-9.\\:/])[\\/][^\s\\/"']+[\\/][^\s"']/.test(text) ||
  FOLDERS.some((f) => f.length > 3 && text.toLowerCase().includes(f));

const notFound = (e: unknown) =>
  e instanceof Error && (e as { code?: unknown }).code === "NOT_FOUND";
// Never issued, so nothing may be known of it.
const NEVER_ISSUED = "never-issued-1";

// What a run in each state may be said to be, by the adapter that sent it and by a new one, which
// may know nothing of it; and what one of its answers must be.
const states = (...of: ExecutionStatus["state"][]) => new Set(of);
const TOLD: Record<
  Scenario,
  {
    may: ReadonlySet<ExecutionStatus["state"]>;
    // One of these is told, by the adapter that sent it.
    must: ReadonlySet<ExecutionStatus["state"]>;
  }
> = {
  succeeded: {
    may: states("queued", "running", "unknown", "succeeded"),
    must: states("succeeded"),
  },
  running: {
    may: states("queued", "running", "unknown"),
    must: states("queued", "running"),
  },
  failed: {
    may: states("queued", "running", "unknown", "failed"),
    must: states("failed"),
  },
  uncertainLanded: {
    may: states("queued", "running", "unknown", "succeeded"),
    must: states("succeeded"),
  },
  uncertainNeverLanded: {
    may: states("queued", "running", "unknown", "failed"),
    must: states("queued", "running", "unknown", "failed"),
  },
  lost: {
    may: states("queued", "running", "unknown", "failed"),
    must: states("unknown", "failed"),
  },
  corruptArtifact: {
    may: states("queued", "running", "unknown", "succeeded", "failed"),
    must: states("succeeded", "failed"),
  },
};

const ADAPTER: Record<
  (typeof ADAPTER_CHECKS)[number],
  (h: ConformanceHarness) => Promise<void>
> = {
  // contract: "the reason it cannot run (decided before any worker exists)".
  "refusal-sends-nothing": async (h) => {
    const refused = h.refusedRequests();
    assert.ok(refused.length, "A harness names a request that is refused.");
    for (const { request, reason } of refused)
      await refuses(h, request, reason, `A request (${reason})`);
  },

  // contract: "The input roles this engine honours (a request using another refuses)."
  "unlisted-role-refused": async (h) => {
    let asked = 0;
    for (const c of claimed(h)) {
      const { roles } = c.constraints!;
      const base = () => h.request({ operation: c.operation });
      const refused = async (inputs: unknown[], role: string) => {
        asked++;
        await refuses(
          h,
          { ...base(), inputs },
          "INPUT_UNSUPPORTED",
          `${c.operation} with a ${role}`,
        );
      };
      // One it must have and does not list: it claims what it cannot take.
      for (const { role } of base().inputs)
        if (!roles.includes(role)) await refused([...base().inputs], role);
      for (const role of FURTHER_ROLES[c.operation])
        if (!roles.includes(role))
          await refused([...base().inputs, { role, asset: EXTRA }], role);
    }
    if (!asked)
      throw new Unavailable("It lists every role its operations have.");
  },

  // contract: "a request is checked against them before any worker is spawned".
  "limits-held": async (h) => {
    for (const c of claimed(h))
      for (const [name, at, over] of boundsOf(
        c,
        h.request({ operation: c.operation }),
      )) {
        await refuses(h, over, null, `${name}, past it,`);
        if (at === null) continue;
        await h.reset();
        await submitted(h, h.adapter(), at as EngineRequestV2).catch((e) => {
          throw new Error(`${name}: ${e.message}`);
        });
      }
  },

  // contract: "Observations an adapter reports: bounded".
  "status-parses": async (h) => {
    const { statuses } = await everythingSaid(h);
    for (const s of statuses) ExecutionStatusSchema.parse(s);
  },

  // contract: "Observations an adapter reports", of a run in a state that is known here.
  "states-told-as-they-are": async (h) => {
    await each(h, SCENARIOS, async (scenario, { adapter, ref }) => {
      const { may, must } = TOLD[scenario];
      const before = await followed(adapter, ref);
      const after = await followed(h.adapter(), ref);
      for (const s of [...before, ...after])
        assert.ok(may.has(s.state), `${scenario} is told as ${s.state}.`);
      assert.ok(
        before.some((s) => must.has(s.state)),
        `${scenario} is not told: ${before.map((s) => s.state).join(", ")}`,
      );
      // What goes on elsewhere outlives this service, and so does what became of it.
      if (h.remote !== "none" && scenario !== "lost")
        assert.ok(
          after.some((s) => must.has(s.state)),
          `${scenario} is not told after a restart: ${after.map((s) => s.state).join(", ")}`,
        );
      // A file that is found not to be the declared one is that kind of failure.
      if (scenario === "corruptArtifact")
        for (const s of before)
          if (s.state === "failed")
            assert.equal(s.failureClass, "invalidArtifact");
    });
  },

  // contract: "An adapter that says a run failed or was stopped names which kind of end it was".
  "ended-failure-has-class": (h) =>
    whole(
      // With no failure there is nothing to name the kind of.
      () =>
        each(h, ["failed"], async (_, { adapter, ref }) => {
          const last = (await followed(adapter, ref)).at(-1)!;
          assert.equal(last.state, "failed");
          assert.equal(typeof last.failureClass, "string");
        }),
      async () => {
        const { statuses } = await everythingSaid(h);
        for (const s of statuses)
          assert.equal(
            "failureClass" in s && typeof s.failureClass === "string",
            s.state === "failed" || s.state === "cancelled",
            JSON.stringify(s),
          );
      },
    ),

  // contract: "An external execution reference tied to the durable attempt".
  "ref-usable-at-once": async (h) => {
    for (const ask of [
      (a, ref) => a.status(ref),
      (a, ref) => a.reconcile(ref),
      (a, ref) => a.requestCancel(ref),
      (a, ref) => a.enumerateArtifacts(ref),
    ] as ((a: EngineAdapterV2, ref: string) => Promise<unknown>)[])
      await each(h, ["succeeded", "running"], async (_, { adapter, ref }) => {
        await ask(adapter, ref);
      });
  },

  // contract: "the current generation replays its first result for the same request", and
  // "Said, not resent" of one whose answer was lost.
  "same-attempt-never-sent-twice": (h) =>
    whole(
      () =>
        each(
          h,
          [
            "succeeded",
            "running",
            "failed",
            "uncertainLanded",
            "uncertainNeverLanded",
          ],
          async (scenario, { adapter, request, ref }) => {
            // At once, when it was asked about as a service would, and when it was stopped.
            for (const before of [
              async () => {},
              () => followed(adapter, ref),
              () => adapter.requestCancel(ref),
            ]) {
              await before();
              const again = await settled(adapter.submit(request, h.context()));
              if (again.status === "fulfilled" && "executionRef" in again.value)
                assert.equal(
                  again.value.executionRef,
                  ref,
                  `${scenario}: one attempt is two runs.`,
                );
            }
          },
        ),
      async () => {
        if (!h.arrange.succeeded)
          throw new Unavailable(h.unavailable.succeeded);
        await h.reset();
        await h.arrange.succeeded();
        const adapter = h.adapter();
        const request = h.request();
        const answers = await Promise.allSettled([
          adapter.submit(request, h.context()),
          adapter.submit(request, h.context()),
        ]);
        assert.equal(h.sends(), 1, "Sent other than once, both at once.");
        const refs = answers.flatMap((a) =>
          a.status === "fulfilled" && "executionRef" in a.value
            ? [a.value.executionRef]
            : [],
        );
        assert.ok(refs.length, "Neither was accepted.");
        assert.equal(new Set(refs).size, 1, "One attempt is two runs.");
      },
    ),

  // contract: "the send's answer was lost, so it may have arrived. Said, not resent."
  "uncertain-sends-nothing-more": async (h) => {
    const scenarios = ["uncertainLanded", "uncertainNeverLanded"] as const;
    await each(h, scenarios, async (scenario, { adapter, answer, ref }) => {
      assert.ok(answer.uncertain, `${scenario}: it is not said.`);
      const lands = scenario === "uncertainLanded";
      for (const asked of [adapter, h.adapter()]) {
        const seen = (await followed(asked, ref)).map((s) => s.state);
        if (!lands) {
          assert.ok(!seen.includes("succeeded"), "It never arrived.");
          const left = await asked.enumerateArtifacts(ref).catch(() => []);
          assert.deepEqual(left, []);
        } else if (asked === adapter || h.remote !== "none")
          assert.equal(seen.at(-1), "succeeded", seen.join(", "));
      }
    });
  },

  // contract: "After a restart: what is known about an execution, never a resubmit."
  "restart-reconciles-without-sending": async (h) => {
    for (const first of ["reconcile", "status"] as const)
      await each(h, had(h), async (_, { ref }) => {
        const after = h.adapter();
        ExecutionStatusSchema.parse(await after[first](ref));
        await followed(after, ref);
        await after.enumerateArtifacts(ref).catch(() => []);
        // And after another, which is stopped.
        const last = h.adapter();
        await last.requestCancel(ref).catch(() => null);
        await followed(last, ref);
      });
  },

  // contract: "Observations an adapter reports", of a run it never heard of and one it lost.
  "unknown-ref-answered-honestly": async (h) => {
    await h.reset();
    const adapter = h.adapter();
    const unlessNotFound = <T>(p: Promise<T>) =>
      p.catch((e) => {
        if (!notFound(e)) throw e;
        return null;
      });
    for (const ask of ["status", "reconcile"] as const) {
      const answer = await unlessNotFound(adapter[ask](NEVER_ISSUED));
      if (answer) assert.equal(answer.state, "unknown");
    }
    const left = await unlessNotFound(adapter.enumerateArtifacts(NEVER_ISSUED));
    assert.deepEqual(left ?? [], []);
    const stop = await unlessNotFound(adapter.requestCancel(NEVER_ISSUED));
    if (stop) {
      assert.notEqual(stop.remoteOutcome, "stopped");
      assert.notEqual(stop.remoteAcknowledged, true);
    }
    assert.equal(h.sends(), 0);
    await each(h, ["lost"], async (_, { adapter: losing, ref }) => {
      for (const s of await followed(losing, ref))
        assert.notEqual(s.state, "succeeded");
      const kept = await losing.enumerateArtifacts(ref).catch(() => []);
      assert.deepEqual(kept, []);
    });
  },

  // contract: what a Cancellation's remoteAcknowledged, remoteOutcome and billingOutcome say: that
  // a stop was taken is not that it ended anything, and "unknown" claims nothing. That a later
  // status does not say otherwise is the card's "a stop never claims more than happened".
  "cancel-never-overclaims": async (h) => {
    const scenarios = [
      "succeeded",
      "running",
      "failed",
      "uncertainLanded",
      "uncertainNeverLanded",
      "lost",
    ] as const;
    await each(h, scenarios, async (scenario, { adapter, ref }) => {
      const answer = await adapter.requestCancel(ref);
      CancellationSchema.parse(answer);
      const later = (await adapter.status(ref)).state;
      const said = `${scenario}: ${JSON.stringify(answer)}, then ${later}`;
      const there = scenario !== "uncertainNeverLanded" && scenario !== "lost";
      // It ended there: only where a stop can end it, it was there, and it is not told otherwise.
      if (answer.remoteOutcome === "stopped")
        assert.ok(
          h.remote === "stoppable" &&
            there &&
            (later === "cancelled" || later === "unknown"),
          said,
        );
      if (h.remote === "unstoppable" || !there)
        assert.notEqual(answer.remoteAcknowledged, true, said);
      if (h.remote === "unstoppable" || !there || GOING.has(later))
        assert.notEqual(answer.billingOutcome, "refunded", said);
      if (h.remote === "unstoppable") assert.notEqual(later, "cancelled", said);
      if (h.remote === "none") {
        assert.ok(
          answer.billingOutcome === undefined ||
            answer.billingOutcome === "notApplicable",
          said,
        );
        if (GOING.has(later))
          assert.equal(answer.localProcessExited, false, said);
      }
    });
  },

  // contract: "named artifacts the service reads back in bounded chunks, re-hashing".
  "artifact-verified": async (h) => {
    await each(h, ["succeeded"], async (_, { adapter, ref }) => {
      assert.equal((await followed(adapter, ref)).at(-1)!.state, "succeeded");
      const artifacts = await adapter.enumerateArtifacts(ref);
      assert.ok(artifacts.length, "A succeeded run left nothing.");
      assert.ok(artifacts.length <= ENGINE_V2_LIMITS.artifacts);
      for (const artifact of artifacts)
        await readArtifactVerified(adapter, ref, artifact);
    });
  },

  // contract: "An artifact does not match its declared length and hash."
  "corrupt-artifact-rejected": async (h) => {
    await each(h, ["corruptArtifact"], async (_, { adapter, ref }) => {
      await followed(adapter, ref);
      // One that finds it itself names no artifact, or says why.
      let artifacts: Artifact[] = [];
      try {
        artifacts = await adapter.enumerateArtifacts(ref);
      } catch {
        return;
      }
      for (const artifact of artifacts)
        await assert.rejects(
          readArtifactVerified(adapter, ref, artifact),
          "Bytes that were not declared were taken.",
        );
    });
  },

  // contract: "Diagnostics leave an adapter bounded and without paths or URLs." Their length and
  // the paths are asked about, as the card has it.
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
    if (adapter.location) assert.ok(adapter.location(recipeId), "It is empty.");
  },
};

async function settled<T>(p: Promise<T>): Promise<PromiseSettledResult<T>> {
  return (await Promise.allSettled([p]))[0]!;
}

// The service over this adapter, with its ledger watched.
function watched(h: ConformanceHarness, ledger: GenerationLedger) {
  const { store, make = createGenerationService } = h.service!;
  const seen = {
    sendsAtBegin: [] as number[],
    refAtStatus: [] as (string | null)[],
  };
  const held = h.adapter();
  let current = "";
  // Whatever the adapter is made as.
  const adapter = new Proxy({} as EngineAdapterV2, {
    has: (_, name) => Reflect.has(held, name),
    get: (_, name) => {
      const value: unknown = Reflect.get(held, name, held);
      if (name === "status")
        return async (ref: string) => {
          seen.refAtStatus.push(ledger.read(current)?.executionRef ?? null);
          return held.status(ref);
        };
      return typeof value === "function" ? value.bind(held) : value;
    },
  });
  const service = make({
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
// A service in each of these states that the stand-in has; one it has not is told afterwards.
async function servedIn(
  h: ConformanceHarness,
  scenarios: readonly Scenario[],
  ask: (
    scenario: Scenario,
    of: ReturnType<typeof watched> & {
      ledger: GenerationLedger;
      request: GenerationRequest;
    },
  ) => Promise<void>,
) {
  if (!h.service) throw new Unavailable(h.unavailable.service);
  const missing: string[] = [];
  for (const scenario of scenarios) {
    const arrange = h.arrange[scenario];
    if (!arrange) {
      missing.push(`${scenario}: ${h.unavailable[scenario]}`);
      continue;
    }
    await h.reset();
    await arrange();
    const ledger = ledgerOf(h);
    await ask(scenario, {
      ledger,
      ...watched(h, ledger),
      request: h.service.request,
    });
    assert.ok(
      sentOnce(scenario, h.sends()),
      `${scenario}: sent ${h.sends()} times.`,
    );
  }
  if (missing.length) throw new Unavailable(missing.join(" "));
}
async function refusedImport(p: Promise<unknown>, why?: RegExp) {
  const e = await p.then(
    () => assert.fail("It was brought in."),
    (error: unknown) => error,
  );
  assert.equal((e as { code?: string }).code, "VALIDATION", String(e));
  if (why) assert.match((e as Error).message, why);
}

const SERVICE: Record<
  (typeof SERVICE_CHECKS)[number],
  (h: ConformanceHarness) => Promise<void>
> = {
  // service: "Recorded before anything leaves: a crash from here on leaves a record."
  "row-before-send": (h) =>
    servedIn(h, ["succeeded"], async (_, { service, seen, request }) => {
      await service.start(request);
      assert.deepEqual(seen.sendsAtBegin, [0], "Sent before its row.");
      assert.equal(h.sends(), 1);
    }),

  // service: "The engine's name for it, once known. Before that, the attempt key is."
  "ref-before-poll": (h) =>
    servedIn(h, ["succeeded"], async (_, { service, seen, request }) => {
      const { generationId } = await service.start(request);
      await service.status(generationId);
      assert.ok(seen.refAtStatus.length, "The adapter was not asked.");
      assert.ok(seen.refAtStatus[0], "Asked before the row held its name.");
    }),

  // service: "it is followed, not resent".
  "uncertain-row-not-resent": (h) =>
    servedIn(
      h,
      ["uncertainLanded", "uncertainNeverLanded"],
      async (scenario, { service, ledger, request }) => {
        const { generationId } = await service.start(request);
        const sent = h.sends();
        assert.equal(ledger.read(generationId)?.phase, "sending", scenario);
        const { service: next } = watched(h, ledger);
        assert.deepEqual(
          next.list(request.projectId).map((g) => g.generationId),
          [generationId],
        );
        for (let n = 0; n < 5; n++) await next.status(generationId);
        assert.equal(h.sends(), sent, `${scenario}: sent again.`);
        if (scenario === "uncertainNeverLanded")
          assert.equal(ledger.read(generationId)?.phase, "sending");
      },
    ),

  // service: "Asked to stop: whatever the engine then does, this is not imported".
  "continuing-stop-blocks-import": (h) =>
    whole(
      () =>
        servedIn(h, ["running"], async (_, { service, ledger, request }) => {
          const { generationId } = await service.start(request);
          await service.cancel(generationId);
          const row = ledger.read(generationId)!;
          assert.equal(row.cancelled, true);
          if (h.remote === "unstoppable")
            assert.match(
              row.diagnostic ?? "",
              /The engine was not told to stop/,
            );
          await refusedImport(service.importResult(generationId));
          assert.equal(h.service!.imports(), 0);
        }),
      // One that finished there all the same: only the stop keeps it out.
      () =>
        servedIn(h, ["succeeded"], async (_, { service, ledger, request }) => {
          const { generationId } = await service.start(request);
          await service.cancel(generationId);
          assert.equal(ledger.read(generationId)!.cancelled, true);
          await refusedImport(service.importResult(generationId), /cancelled/);
          assert.equal(h.service!.imports(), 0);
        }),
    ),

  // service: "checked by its declared length and hash".
  "corrupt-result-not-imported": (h) =>
    servedIn(h, ["corruptArtifact"], async (_, { service, request }) => {
      const { generationId } = await service.start(request);
      await service.status(generationId);
      await refusedImport(service.importResult(generationId));
      assert.equal(h.service!.imports(), 0);
    }),
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

/**
 * One test of each check. One that its stand-in cannot arrange whole is skipped, with the reason,
 * after the rest of it was asked. An adapter whose layers are in two files names the checks of
 * each, under one name.
 */
export function engineConformance(
  name: string,
  make: ConformanceHarness | (() => Promise<ConformanceHarness>),
  checks: readonly ConformanceCheck[] = CONFORMANCE_CHECKS,
) {
  if (typeof make !== "function") assertWhole(make);
  for (const check of checks)
    test(`${name}: ${check}`, async (t) => {
      const harness = typeof make === "function" ? await make() : make;
      const [result] = await runConformance(harness, [check]);
      if (result!.unavailable) return t.skip(result!.detail);
      assert.ok(result!.ok, result!.detail);
    });
}
