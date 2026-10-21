// W10 / M13: fake engine — cancel, crash retry with fencing, probe quarantine.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ENGINE_CONTRACT,
  ENGINE_ENABLED,
  engineAbsentCapability,
} from "../core/engines/contract.ts";
import { createFakeEngine } from "../core/engines/fake.ts";

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
