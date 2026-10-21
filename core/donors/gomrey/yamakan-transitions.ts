/**
 * Yamakan job-state transition table in the Gomrey closed-machine style.
 * Extends the donor pattern with preparing/validating/cancelRequested/
 * reconciliationRequired/succeeded (CLAUDE_INDEPENDENT_REVIEW draft note).
 */
import { IllegalTransition } from "./jobs.ts";

export type YamakanJobState =
  | "queued"
  | "preparing"
  | "running"
  | "validating"
  | "succeeded"
  | "cancelRequested"
  | "cancelled"
  | "failed"
  | "reconciliationRequired";

export const YAMAKAN_LEGAL_TRANSITIONS: Readonly<
  Record<YamakanJobState, ReadonlySet<YamakanJobState>>
> = Object.freeze({
  queued: Object.freeze(
    new Set<YamakanJobState>([
      "preparing",
      "cancelled",
      "cancelRequested",
      // Too many crash interruptions set the job aside without claiming.
      "reconciliationRequired",
    ]),
  ),
  preparing: Object.freeze(
    new Set<YamakanJobState>([
      "running",
      "cancelRequested",
      "cancelled",
      "failed",
      "reconciliationRequired",
      "queued",
    ]),
  ),
  running: Object.freeze(
    new Set<YamakanJobState>([
      "validating",
      "cancelRequested",
      "cancelled",
      "failed",
      "reconciliationRequired",
      "queued",
    ]),
  ),
  validating: Object.freeze(
    new Set<YamakanJobState>([
      "succeeded",
      "cancelRequested",
      "cancelled",
      "failed",
      "reconciliationRequired",
      "queued",
    ]),
  ),
  cancelRequested: Object.freeze(
    new Set<YamakanJobState>([
      "cancelled",
      "failed",
      "reconciliationRequired",
      "queued",
    ]),
  ),
  reconciliationRequired: Object.freeze(
    new Set<YamakanJobState>(["queued", "cancelled"]),
  ),
  succeeded: Object.freeze(new Set<YamakanJobState>()),
  cancelled: Object.freeze(new Set<YamakanJobState>()),
  failed: Object.freeze(new Set<YamakanJobState>()),
});

/** Return toState when legal for Yamakan jobs; else IllegalTransition. */
export function transitionYamakanJob(
  jobId: string,
  fromState: string,
  toState: YamakanJobState,
): YamakanJobState {
  const allowed = YAMAKAN_LEGAL_TRANSITIONS[fromState as YamakanJobState];
  if (allowed === undefined || !allowed.has(toState)) {
    throw new IllegalTransition(jobId, fromState, toState);
  }
  return toState;
}
