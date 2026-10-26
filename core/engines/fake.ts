// M13 / W10: in-process fake engine for cancel, crash-retry fencing, and
// probe-failure quarantine. No network, no Python, no weights.
import { createHash } from "node:crypto";
import type {
  EngineAdapter,
  EngineCapability,
  EngineOutput,
  EngineStatus,
  EngineSubmitRequest,
} from "./contract.ts";
import { ENGINE_CONTRACT } from "./contract.ts";
import {
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  EngineRequestV2Schema,
  Operation,
  constraintsHash,
  refusal,
} from "./contract-v2.ts";
import type {
  Artifact,
  AssetRef,
  Constraints,
  EngineAdapterV2,
  EngineRequestV2,
  ExecutionStatus,
  RefusalReason,
} from "./contract-v2.ts";

type Internal = {
  request: EngineSubmitRequest;
  status: EngineStatus;
  outputs: EngineOutput[];
  /** When set, the next status() after submit simulates a mid-job crash. */
  crashOnce?: boolean;
};

export type FakeEngineOptions = {
  /** Node class_types allowed in submitted graphs. */
  allowlistedNodes?: string[];
  /** If true, completed outputs fail the "probe" and are quarantined. */
  failProbe?: boolean;
  /** Crash the first attempt for a given attemptKey once, then succeed on retry. */
  crashAttemptKeys?: Set<string>;
};

export function createFakeEngine(
  options: FakeEngineOptions = {},
): EngineAdapter {
  const allowlisted = new Set(
    options.allowlistedNodes ?? ["YamakanFakeSave", "YamakanFakeLoad"],
  );
  const jobs = new Map<string, Internal>();
  const finishedAttempts = new Set<string>();
  const crashedAttempts = new Set<string>();
  let seq = 0;

  const capabilities = (): EngineCapability => ({
    id: "fake",
    available: true,
    reason: "In-process fake engine for tests.",
    maxUploadBytes: 16 * 1024 * 1024,
    allowlistedNodes: [...allowlisted],
  });

  const validate = (request: EngineSubmitRequest) => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(request.attemptKey))
      throw new Error("Invalid attempt key.");
    for (const node of Object.values(request.graph.nodes)) {
      if (!allowlisted.has(node.class_type))
        throw new Error(
          `Node class_type is not allowlisted: ${node.class_type}`,
        );
    }
  };

  return {
    contract: ENGINE_CONTRACT,
    capabilities,
    async submit(request) {
      validate(request);
      // Fencing: only a successful completed attempt is replayed. Failed or
      // cancelled attempts may be retried with the same key (new job id).
      for (const [id, job] of jobs) {
        if (
          job.request.attemptKey === request.attemptKey &&
          job.status.state === "completed" &&
          !job.status.quarantined
        )
          return { id };
      }
      const id = `fake-${++seq}`;
      const crashOnce =
        options.crashAttemptKeys?.has(request.attemptKey) === true &&
        !crashedAttempts.has(request.attemptKey) &&
        !finishedAttempts.has(request.attemptKey);
      const job: Internal = {
        request,
        status: { id, state: crashOnce ? "running" : "queued" },
        outputs: [],
        crashOnce,
      };
      jobs.set(id, job);
      if (!crashOnce) {
        // Immediate complete (or quarantine) for the happy path.
        finish(job, options.failProbe === true);
        finishedAttempts.add(request.attemptKey);
      }
      return { id };
    },
    async status(id) {
      const job = jobs.get(id);
      if (!job) throw new Error("Unknown engine job.");
      if (job.crashOnce && job.status.state === "running") {
        job.crashOnce = false;
        crashedAttempts.add(job.request.attemptKey);
        job.status = {
          id,
          state: "failed",
          error: "Simulated engine crash (retry with the same attempt key).",
        };
        return job.status;
      }
      return { ...job.status };
    },
    async cancel(id) {
      const job = jobs.get(id);
      if (!job) throw new Error("Unknown engine job.");
      if (
        job.status.state === "completed" ||
        job.status.state === "failed" ||
        job.status.state === "cancelled"
      )
        return { ...job.status };
      job.status = { id, state: "cancelled" };
      job.outputs = [];
      finishedAttempts.add(job.request.attemptKey);
      return { ...job.status };
    },
    async outputs(id) {
      const job = jobs.get(id);
      if (!job) throw new Error("Unknown engine job.");
      if (job.status.state !== "completed")
        throw new Error("Outputs are only available for completed jobs.");
      if (job.status.quarantined)
        throw new Error("Outputs were quarantined after a failed probe.");
      return job.outputs.map((o) => ({
        name: o.name,
        bytes: o.bytes.slice(),
        sha256: o.sha256,
      }));
    },
  };
}

function finish(job: Internal, failProbe: boolean) {
  const payload = Buffer.from(
    JSON.stringify({
      attemptKey: job.request.attemptKey,
      nodes: Object.keys(job.request.graph.nodes).sort(),
    }),
    "utf8",
  );
  const sha256 = createHash("sha256").update(payload).digest("hex");
  if (failProbe) {
    job.status = {
      id: job.status.id,
      state: "completed",
      quarantined: true,
      error: "Output failed the media probe and was quarantined.",
    };
    job.outputs = [];
    return;
  }
  job.outputs = [{ name: "fake-output.bin", bytes: payload, sha256 }];
  job.status = { id: job.status.id, state: "completed" };
}

// ---------------------------------------------------------------------------
// EngineAdapter v2 fake (YU-040): native operation requests, no graph. It
// counts the workers it would spawn, so a refusal "before spawn" is
// observable, and serves its artifact from a generator in bounded chunks
// (never one whole-file array).
// ---------------------------------------------------------------------------

export type FakeEngineV2Options = {
  // Operations the fake reports unavailable, with this reason.
  unavailable?: Partial<Record<Operation, RefusalReason>>;
  // Artifact size the fake produces (bytes).
  artifactBytes?: number;
  // Fail the execution after spawning (an engine-side failure).
  failExecutions?: boolean;
};

export const FAKE_V2_CONSTRAINTS: Constraints = {
  maxWidth: 1280,
  maxHeight: 720,
  fps: [
    { num: 30, den: 1 },
    { num: 24000, den: 1001 },
  ],
  minDurationTicks: 1,
  maxDurationTicks: 705_600_000 * 10,
  audio: false,
  controls: ["guidance"],
};

// Deterministic artifact bytes, generated chunk by chunk.
function* fakeBytes(seed: string, length: number, chunk: number) {
  let produced = 0;
  let block = createHash("sha256").update(seed).digest();
  while (produced < length) {
    const size = Math.min(chunk, length - produced);
    const out = Buffer.alloc(size);
    for (let i = 0; i < size; i += 32) {
      block.copy(out, i, 0, Math.min(32, size - i));
      block = createHash("sha256").update(block).digest();
    }
    produced += size;
    yield new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  }
}

// Reads an asset stream to its end, bounded, verifying its hash.
export async function verifyAsset(
  stream: AsyncIterable<Uint8Array>,
  asset: AssetRef,
  maxBytes: number,
) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) return false;
    hash.update(chunk);
  }
  return hash.digest("hex") === asset.sha256;
}

export function createFakeEngineV2(options: FakeEngineV2Options = {}) {
  const constraintsHashValue = constraintsHash(FAKE_V2_CONSTRAINTS);
  const artifactBytes = options.artifactBytes ?? 3 * 1024 * 1024 + 17;
  type Execution = {
    request: EngineRequestV2;
    status: ExecutionStatus;
    artifact: Artifact | null;
  };
  const executions = new Map<string, Execution>();
  // Per attempt key: the highest lease generation seen, and its execution.
  const fences = new Map<string, { generation: number; ref: string }>();
  let spawned = 0;
  let seq = 0;
  const known = (ref: string) => {
    const e = executions.get(ref);
    if (!e) throw new Error("Unknown engine execution.");
    return e;
  };
  const adapter: EngineAdapterV2 & { spawned(): number } = {
    contract: ENGINE_CONTRACT_V2,
    spawned: () => spawned,
    capabilities: () =>
      Operation.options.map((operation) => {
        const reason = options.unavailable?.[operation];
        return reason
          ? {
              operation,
              available: false,
              reason,
              constraintsHash: constraintsHash(null),
            }
          : {
              operation,
              available: true,
              constraints: FAKE_V2_CONSTRAINTS,
              constraintsHash: constraintsHashValue,
            };
      }),
    async submit(raw, context) {
      const parsed = EngineRequestV2Schema.safeParse(raw);
      if (!parsed.success) return { refused: "INVALID_REQUEST" };
      const request = parsed.data;
      const fence = fences.get(request.attemptKey);
      if (fence && request.leaseGeneration < fence.generation)
        return { refused: "STALE_ATTEMPT" };
      if (fence && request.leaseGeneration === fence.generation)
        return { executionRef: fence.ref };
      const capability = adapter
        .capabilities()
        .find((c) => c.operation === request.operation);
      const refused = refusal(request, capability);
      if (refused) return { refused };
      // Inputs are read through the service's handles and checked against
      // their recorded hashes before anything runs.
      for (const { asset } of request.inputs)
        if (
          !(await verifyAsset(
            context.openAsset(asset),
            asset,
            ENGINE_V2_LIMITS.artifactBytes,
          ))
        )
          return { refused: "INVALID_REQUEST" };
      spawned++;
      const ref = `fake-v2-${++seq}`;
      fences.set(request.attemptKey, {
        generation: request.leaseGeneration,
        ref,
      });
      let artifact: Artifact | null = null;
      if (!options.failExecutions) {
        const hash = createHash("sha256");
        for (const chunk of fakeBytes(
          ref,
          artifactBytes,
          ENGINE_V2_LIMITS.chunkBytes,
        ))
          hash.update(chunk);
        artifact = {
          handle: request.output.kind === "video" ? "output.mp4" : "output.vtt",
          mediaType: request.output.kind === "video" ? "video/mp4" : "text/vtt",
          byteLength: artifactBytes,
          sha256: hash.digest("hex"),
        };
      }
      executions.set(ref, {
        request,
        status: options.failExecutions
          ? {
              executionRef: ref,
              state: "failed",
              diagnostic: "Simulated engine failure.",
            }
          : { executionRef: ref, state: "succeeded", progress: 1 },
        artifact,
      });
      return { executionRef: ref };
    },
    async status(ref) {
      return { ...known(ref).status };
    },
    async reconcile(ref) {
      // An in-process fake survives nothing: what it knows is its status.
      return { ...known(ref).status };
    },
    async requestCancel(ref) {
      const e = known(ref);
      if (e.status.state === "queued" || e.status.state === "running") {
        e.status = { executionRef: ref, state: "cancelled" };
        e.artifact = null;
      }
      return {
        requested: true,
        localProcessExited: true,
        billingOutcome: "notApplicable",
      };
    },
    async enumerateArtifacts(ref) {
      const e = known(ref);
      return e.status.state === "succeeded" && e.artifact
        ? [{ ...e.artifact }]
        : [];
    },
    async *readArtifact(ref, handle) {
      const e = known(ref);
      if (
        e.status.state !== "succeeded" ||
        !e.artifact ||
        e.artifact.handle !== handle
      )
        throw new Error("No such artifact.");
      yield* fakeBytes(ref, e.artifact.byteLength, ENGINE_V2_LIMITS.chunkBytes);
    },
  };
  return adapter;
}
