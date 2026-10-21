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
        throw new Error(`Node class_type is not allowlisted: ${node.class_type}`);
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
