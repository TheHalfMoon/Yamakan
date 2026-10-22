/**
 * Translated from TheHalfMoon/Gomrey `servers/fastapi/gomrey/jobs.py`
 * @ pin 5f299a7a6174ad3a1180f827778db5f4400a4d71 (founder-attested, Apache-2.0).
 * Pure deterministic job rules: no database, no network.
 */

export const TERMINAL_STATES = Object.freeze(
  new Set(["complete", "partial", "failed", "cancelled"]),
);

export const LEGAL_TRANSITIONS: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    queued: Object.freeze(new Set<string>(["running", "cancelled"])),
    running: Object.freeze(
      new Set<string>([
        "checkpointed",
        "complete",
        "partial",
        "failed",
        "cancelled",
      ]),
    ),
    checkpointed: Object.freeze(
      new Set<string>([
        "running",
        "complete",
        "partial",
        "failed",
        "cancelled",
      ]),
    ),
    suspended: Object.freeze(new Set<string>(["running", "cancelled"])),
    complete: Object.freeze(new Set<string>()),
    partial: Object.freeze(new Set<string>()),
    failed: Object.freeze(new Set<string>()),
    cancelled: Object.freeze(new Set<string>()),
  });

export const TRANSIENT_ERRORS = Object.freeze(
  new Set([
    "timeout",
    "rate_limited",
    "worker_crashed",
    "connection_reset",
    "service_unavailable",
  ]),
);

export class IllegalTransition extends Error {
  readonly jobId: string;
  readonly fromState: string;
  readonly toState: string;

  constructor(jobId: string, fromState: string, toState: string) {
    super(`Illegal job transition for ${jobId}: ${fromState} -> ${toState}`);
    this.name = "IllegalTransition";
    this.jobId = jobId;
    this.fromState = fromState;
    this.toState = toState;
  }
}

/** Return toState when legal, else raise IllegalTransition. */
export function transition(
  jobId: string,
  fromState: string,
  toState: string,
): string {
  const allowed = LEGAL_TRANSITIONS[fromState];
  if (allowed === undefined) {
    throw new IllegalTransition(jobId, fromState, toState);
  }
  if (!allowed.has(toState)) {
    throw new IllegalTransition(jobId, fromState, toState);
  }
  return toState;
}

/** Classify a failure as transient (retryable) or permanent. */
export function classifyFailure(errorCode: string): "transient" | "permanent" {
  return TRANSIENT_ERRORS.has(errorCode) ? "transient" : "permanent";
}

/** Deterministic exponential backoff without jitter (testability first). */
export function backoffSeconds(
  attempt: number,
  base = 1.0,
  cap = 300.0,
  factor = 2.0,
): number {
  if (attempt < 1) throw new Error("attempt starts at 1");
  return Math.min(cap, base * factor ** (attempt - 1));
}

/** Retry only transient failures within the bounded attempt budget. */
export function shouldRetry(
  errorCode: string,
  attempt: number,
  maxAttempts: number,
): boolean {
  return classifyFailure(errorCode) === "transient" && attempt < maxAttempts;
}

export type IdempotencyOutcome = "success" | "failed" | "unknown";

/** Memoize mutation outcomes by idempotency key. */
export class IdempotencyLedger {
  readonly #outcomes = new Map<string, IdempotencyOutcome>();

  /** Return true when this call owns the key, false on replay. */
  claim(key: string): boolean {
    if (this.#outcomes.has(key)) return false;
    this.#outcomes.set(key, "unknown");
    return true;
  }

  record(key: string, outcome: IdempotencyOutcome): void {
    if (!this.#outcomes.has(key)) {
      throw new Error(`idempotency key was never claimed: ${key}`);
    }
    if (
      outcome !== "success" &&
      outcome !== "failed" &&
      outcome !== "unknown"
    ) {
      throw new Error(`invalid outcome: ${String(outcome)}`);
    }
    this.#outcomes.set(key, outcome);
  }

  outcome(key: string): IdempotencyOutcome {
    return this.#outcomes.get(key) ?? "unknown";
  }
}

/** In-memory durable job with stage checkpoints. */
export class DurableJob {
  readonly jobId: string;
  readonly stages: readonly string[];
  completed: string[] = [];
  state = "queued";
  attempts = 0;

  constructor(jobId: string, stages: readonly string[]) {
    this.jobId = jobId;
    this.stages = stages;
  }

  start(): void {
    this.state = transition(this.jobId, this.state, "running");
  }

  completeStage(stage: string): void {
    if (!this.stages.includes(stage)) {
      throw new Error(`unknown stage: ${stage}`);
    }
    if (this.state !== "running" && this.state !== "checkpointed") {
      throw new IllegalTransition(this.jobId, this.state, "checkpointed");
    }
    if (!this.completed.includes(stage)) this.completed.push(stage);
    this.state = "checkpointed";
  }

  /** Opaque resume token: ordered completed stages joined by unit separator. */
  checkpointToken(): string {
    return this.completed.join("\x1f");
  }

  /** Resume from a checkpoint token without redoing completed stages. */
  restore(token: string): void {
    const wanted = token ? token.split("\x1f").filter(Boolean) : [];
    const unknown = wanted.filter((s) => !this.stages.includes(s));
    if (unknown.length) {
      throw new Error(
        `checkpoint references unknown stages: ${unknown.join(",")}`,
      );
    }
    this.completed = [...wanted];
    if (this.state === "checkpointed") {
      this.state = transition(this.jobId, this.state, "running");
    }
  }

  pendingStages(): string[] {
    return this.stages.filter((s) => !this.completed.includes(s));
  }

  finish(complete = true): void {
    this.state = transition(
      this.jobId,
      this.state,
      complete ? "complete" : "partial",
    );
  }

  fail(): void {
    this.state = transition(this.jobId, this.state, "failed");
  }

  cancel(): void {
    this.state = transition(this.jobId, this.state, "cancelled");
  }

  /** Deadline comparison on ISO-8601 strings (lexicographic = chronological). */
  isExpired(nowIso: string, deadlineIso: string | null): boolean {
    if (deadlineIso === null) return false;
    return nowIso > deadlineIso;
  }
}
