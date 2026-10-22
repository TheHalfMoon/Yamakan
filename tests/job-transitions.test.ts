/**
 * Port of Gomrey `servers/fastapi/tests/test_gomrey_jobs.py` (8 tests)
 * @ pin 5f299a7a6174ad3a1180f827778db5f4400a4d71.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DurableJob,
  IdempotencyLedger,
  IllegalTransition,
  backoffSeconds,
  classifyFailure,
  shouldRetry,
  transition,
} from "../core/jobs/rules/jobs.ts";
import { transitionYamakanJob } from "../core/jobs/rules/yamakan-transitions.ts";

describe("gomrey jobs (inherited)", () => {
  it("legal transitions pass and illegal raise", () => {
    assert.equal(transition("j-1", "queued", "running"), "running");
    assert.throws(
      () => transition("j-1", "queued", "complete"),
      IllegalTransition,
    );
    assert.throws(
      () => transition("j-1", "complete", "running"),
      IllegalTransition,
    );
    assert.throws(
      () => transition("j-1", "nope", "running"),
      IllegalTransition,
    );
  });

  it("terminal states have no outgoing transitions", () => {
    for (const state of ["complete", "partial", "failed", "cancelled"]) {
      assert.throws(
        () => transition("j-1", state, "running"),
        IllegalTransition,
      );
    }
  });

  it("failure classification and bounded retry", () => {
    assert.equal(classifyFailure("timeout"), "transient");
    assert.equal(classifyFailure("worker_crashed"), "transient");
    assert.equal(classifyFailure("bad_input"), "permanent");
    assert.equal(classifyFailure("auth_denied"), "permanent");
    assert.equal(shouldRetry("timeout", 1, 3), true);
    assert.equal(shouldRetry("timeout", 3, 3), false);
    assert.equal(shouldRetry("bad_input", 1, 3), false);
  });

  it("backoff is deterministic and capped", () => {
    assert.equal(backoffSeconds(1), 1.0);
    assert.equal(backoffSeconds(2), 2.0);
    assert.equal(backoffSeconds(3), 4.0);
    assert.equal(backoffSeconds(1), backoffSeconds(1));
    assert.equal(backoffSeconds(100), 300.0);
    assert.throws(() => backoffSeconds(0), /attempt starts at 1/);
  });

  it("idempotency replay returns stored outcome", () => {
    const ledger = new IdempotencyLedger();
    assert.equal(ledger.claim("k-1"), true);
    assert.equal(ledger.claim("k-1"), false);
    assert.equal(ledger.outcome("k-1"), "unknown");
    ledger.record("k-1", "success");
    assert.equal(ledger.claim("k-1"), false);
    assert.equal(ledger.outcome("k-1"), "success");
    assert.equal(ledger.outcome("never-claimed"), "unknown");
    assert.throws(() => ledger.record("never-claimed", "success"));
    assert.throws(() => ledger.record("k-1", "maybe" as "success"));
  });

  it("job checkpoint resume skips completed stages", () => {
    const job = new DurableJob("j-1", ["parse", "index", "verify"]);
    job.start();
    job.completeStage("parse");
    const token = job.checkpointToken();
    const resumed = new DurableJob("j-1", ["parse", "index", "verify"]);
    resumed.restore(token);
    assert.deepEqual(resumed.pendingStages(), ["index", "verify"]);
    resumed.start();
    resumed.completeStage("index");
    resumed.completeStage("verify");
    assert.deepEqual(resumed.pendingStages(), []);
    resumed.finish();
    assert.equal(resumed.state, "complete");
  });

  it("job cancel and deadline", () => {
    const job = new DurableJob("j-1", ["parse"]);
    job.cancel();
    assert.equal(job.state, "cancelled");
    assert.throws(() => job.start(), IllegalTransition);
    assert.equal(
      job.isExpired("2026-10-08T00:00:00Z", "2026-10-07T00:00:00Z"),
      true,
    );
    assert.equal(
      job.isExpired("2026-10-06T00:00:00Z", "2026-10-07T00:00:00Z"),
      false,
    );
    assert.equal(job.isExpired("2026-10-08T00:00:00Z", null), false);
  });

  it("checkpoint rejects unknown stages", () => {
    const job = new DurableJob("j-1", ["parse"]);
    assert.throws(() => job.restore("parse\x1fhack"));
    assert.throws(() => job.completeStage("hack"));
  });
});

describe("yamakan job transitions (closed machine)", () => {
  it("refused transition does not invent a next state", () => {
    assert.throws(
      () => transitionYamakanJob("j-1", "succeeded", "queued"),
      IllegalTransition,
    );
    assert.equal(
      transitionYamakanJob("j-1", "queued", "preparing"),
      "preparing",
    );
  });
});
