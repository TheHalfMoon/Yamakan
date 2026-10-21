// W15 / M12: Director stage gates and human-only approval (journey 5).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ProjectStore } from "../core/store.ts";
import {
  FRAMEWORK_SMOKE_MANIFEST,
  builtinManifest,
  parsePipelineManifest,
} from "../core/director/manifest.ts";
import {
  applyApproval,
  assertApprovalStillValid,
  enforceStagePrerequisites,
  nextStage,
  type DirectorRun,
  type StageReceipt,
} from "../core/director/stages.ts";
import {
  advanceStage,
  approveStage,
  directorNext,
  startDirectorRun,
} from "../core/director/runtime.ts";
import {
  execute,
  browserScopes,
  cliScopes,
  type CommandContext,
} from "../core/command/registry.ts";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function withStore(fn: (store: ProjectStore) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "yamakan-dir-"));
  const store = new ProjectStore(root);
  await store.initialize();
  try {
    await fn(store);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
}

function emptyRun(id = "22222222-2222-4222-8222-222222222222"): DirectorRun {
  return {
    format: "yamakan.director-run",
    formatVersion: 1,
    id,
    projectId: PROJECT,
    pipelineName: "framework-smoke",
    receipts: [],
  };
}

test("framework-smoke manifest refuses tool names", () => {
  assert.equal(builtinManifest("framework-smoke").name, "framework-smoke");
  assert.throws(
    () =>
      parsePipelineManifest({
        ...FRAMEWORK_SMOKE_MANIFEST,
        stages: [
          {
            name: "evil",
            tools_available: ["ffmpeg"],
          },
        ],
      }),
    /cannot name tools|Invalid pipeline/,
  );
});

test("prerequisites and approval gate advancement", () => {
  const manifest = FRAMEWORK_SMOKE_MANIFEST;
  const run = emptyRun();
  assert.throws(
    () => enforceStagePrerequisites(manifest, run, "script", "completed"),
    /PREREQUISITE/,
  );
  const research: StageReceipt = {
    format: "yamakan.stage-receipt",
    formatVersion: 1,
    projectId: PROJECT,
    pipelineName: "framework-smoke",
    stage: "research",
    status: "completed",
    outputHash: hash("research"),
    humanApproved: false,
    approvalExpiresAtMs: null,
    approvedOutputHash: null,
  };
  assert.throws(
    () =>
      enforceStagePrerequisites(
        manifest,
        { ...run, receipts: [research] },
        "script",
        "completed",
      ),
    /without required approval/,
  );
  const approved = applyApproval(research, {
    outputHash: hash("research"),
    nowMs: 1,
    expiresAtMs: 10_000,
  });
  enforceStagePrerequisites(
    manifest,
    { ...run, receipts: [approved] },
    "script",
    "completed",
    5,
  );
  assertApprovalStillValid(approved, hash("research"), 5);
  assert.throws(
    () => assertApprovalStillValid(approved, hash("other"), 5),
    /different output/,
  );
});

test("nextStage blocks agents without approval (journey 5)", async () => {
  await withStore(async (store) => {
    const started = await startDirectorRun(store, {
      projectId: PROJECT,
      pipelineName: "framework-smoke",
    });
    const nxt = await directorNext(store, started.id);
    assert.equal(nxt.kind, "stage");
    if (nxt.kind !== "stage") return;
    assert.equal(nxt.stage, "research");

    const out = hash("brief-1");
    await advanceStage(store, {
      runId: started.id,
      stage: "research",
      status: "awaiting_human",
      outputHash: out,
    });
    const blocked = await directorNext(store, started.id);
    assert.equal(blocked.kind, "blocked");
    if (blocked.kind === "blocked")
      assert.match(blocked.reasons.join(" "), /approval/i);

    const agentCtx = {
      store,
      queue: {} as CommandContext["queue"],
      principal: {
        id: "agent:33333333-3333-4333-8333-333333333333",
        scopes: cliScopes(),
      },
    } satisfies CommandContext;
    await assert.rejects(
      () =>
        execute(agentCtx, "yamakan.director.approve", {
          runId: started.id,
          stage: "research",
          outputHash: out,
          ttlMs: 60_000,
        }),
      /browser session|SCOPE_DENIED|lacks scope/i,
    );

    const humanCtx = {
      store,
      queue: {} as CommandContext["queue"],
      principal: { id: "browser-ui", scopes: browserScopes() },
    } satisfies CommandContext;
    await execute(humanCtx, "yamakan.director.approve", {
      runId: started.id,
      stage: "research",
      outputHash: out,
      ttlMs: 60_000,
    });
    const after = await directorNext(store, started.id);
    assert.equal(after.kind, "stage");
    if (after.kind === "stage") assert.equal(after.stage, "script");
  });
});

test("changed output hash refuses stale approval", async () => {
  await withStore(async (store) => {
    const run = await startDirectorRun(store, {
      projectId: PROJECT,
      pipelineName: "framework-smoke",
    });
    const first = hash("a");
    await advanceStage(store, {
      runId: run.id,
      stage: "research",
      status: "awaiting_human",
      outputHash: first,
    });
    await approveStage(store, {
      runId: run.id,
      stage: "research",
      outputHash: first,
      ttlMs: 60_000,
    });
    await assert.rejects(
      () =>
        approveStage(store, {
          runId: run.id,
          stage: "research",
          outputHash: hash("b"),
          ttlMs: 60_000,
        }),
      /does not match/,
    );
  });
});

test("nextStage pure helper reports done when complete", () => {
  const manifest = FRAMEWORK_SMOKE_MANIFEST;
  const receipts: StageReceipt[] = manifest.stages.map((s) => ({
    format: "yamakan.stage-receipt" as const,
    formatVersion: 1 as const,
    projectId: PROJECT,
    pipelineName: "framework-smoke",
    stage: s.name,
    status: "completed" as const,
    outputHash: hash(s.name),
    humanApproved: true,
    approvalExpiresAtMs: 9e15,
    approvedOutputHash: hash(s.name),
  }));
  const result = nextStage(manifest, { ...emptyRun(), receipts }, 1);
  assert.equal(result.kind, "done");
});

test("expired approval blocks nextStage", () => {
  const manifest = FRAMEWORK_SMOKE_MANIFEST;
  const research: StageReceipt = {
    format: "yamakan.stage-receipt",
    formatVersion: 1,
    projectId: PROJECT,
    pipelineName: "framework-smoke",
    stage: "research",
    status: "completed",
    outputHash: hash("research"),
    humanApproved: true,
    approvalExpiresAtMs: 100,
    approvedOutputHash: hash("research"),
  };
  const blocked = nextStage(
    manifest,
    { ...emptyRun(), receipts: [research] },
    200,
  );
  assert.equal(blocked.kind, "blocked");
});
