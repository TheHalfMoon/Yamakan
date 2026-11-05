// SS-007: a request ID promises that a retry is safe. A mutation that keeps no
// receipt cannot keep that promise, so it refuses the ID instead of ignoring it.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { commands, execute, Scopes } from "../core/command/registry.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { SCENE3D_FORMAT, SCENE3D_FORMAT_VERSION } from "../core/scene3d.ts";
import { ProjectStore } from "../core/store.ts";
import { createEmptyStudioDocument } from "../core/studio.ts";

const id = randomUUID();
const validInput: Record<string, unknown> = {
  "yamakan.generation.start": {
    projectId: id,
    recipeId: "x",
    width: 64,
    height: 36,
    durationFrames: 24,
  },
  "yamakan.generation.cancel": { generationId: id },
  "yamakan.generation.import": { generationId: id },
  "yamakan.workspace.collectGarbage": {},
  "yamakan.asset.repair": { projectId: id, assetId: id },
  "yamakan.export.video": { projectId: id, idempotencyKey: "k" },
  "yamakan.export.batch": {
    projectId: id,
    idempotencyKey: "k",
    variants: [{ name: "wide", width: 1280, height: 720 }],
  },
  "yamakan.export.batchCancel": { projectId: id, batchId: "a".repeat(32) },
  "yamakan.job.cancel": { jobId: id },
  "yamakan.job.retry": { jobId: id },
  "yamakan.job.discard": { jobId: id },
  "yamakan.scene.save": {
    scene: {
      format: SCENE3D_FORMAT,
      formatVersion: SCENE3D_FORMAT_VERSION,
      id,
      units: "metres",
      eulerOrder: "XYZ",
      camera: { focalLengthMm: 35, sensorWidthMm: 36, near: 0.1, far: 1000 },
      items: [],
    },
  },
  "yamakan.studio.open": {},
  "yamakan.studio.commit": {
    document: createEmptyStudioDocument({ id: randomUUID(), name: "Board" }),
  },
  "yamakan.consent.revalidate": { consentId: id },
  "yamakan.director.importLegacy": {},
  "yamakan.agent.create": { scopes: ["project:read"] },
  "yamakan.agent.revoke": { agentId: `agent:${randomUUID()}` },
};

const definitions = Object.entries(commands) as Array<
  [
    keyof typeof commands,
    {
      mutation: boolean;
      refusesRequestId?: string;
      run: (...args: never[]) => unknown;
    },
  ]
>;

test("every mutation either keeps a receipt or refuses a request id", () => {
  const refusing = [];
  for (const [name, command] of definitions) {
    if (!command.mutation) {
      assert.equal(command.refusesRequestId, undefined, name);
      continue;
    }
    const keepsReceipt = /\breceipt\b/.test(command.run.toString());
    assert.notEqual(
      keepsReceipt,
      Boolean(command.refusesRequestId),
      `${name} must do exactly one of these`,
    );
    if (command.refusesRequestId) refusing.push(name);
  }
  assert.deepEqual(refusing.sort(), Object.keys(validInput).sort());
});

test("a refused request id has no effect, and the call works without one", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-refusal-"));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui" as const, scopes: new Set(Scopes) },
  };
  try {
    for (const [name, input] of Object.entries(validInput)) {
      await assert.rejects(
        execute({ ...ctx, requestId: "retry.1" }, name, input),
        (e: { code: string; message: string }) => {
          assert.equal(e.code, "VALIDATION", name);
          assert.match(e.message, /cannot replay a request ID/, name);
          return true;
        },
      );
    }
    const tokens = () =>
      (
        store.read((db) =>
          db.prepare("SELECT COUNT(*) AS n FROM agent_tokens").get(),
        ) as { n: number }
      ).n;
    const args = validInput["yamakan.agent.create"];
    // Each retry of this one would mint another live credential.
    assert.equal(tokens(), 0);
    await execute(ctx, "yamakan.agent.create", args);
    assert.equal(tokens(), 1);

    // The scope check comes first, so a refusal tells a caller nothing extra.
    const reader = {
      id: `agent:${randomUUID()}` as const,
      scopes: new Set(["project:read"]),
    } as unknown as typeof ctx.principal;
    await assert.rejects(
      execute(
        { ...ctx, principal: reader, requestId: "scope.1" },
        "yamakan.job.cancel",
        { jobId: id },
      ),
      { code: "SCOPE_DENIED" },
    );

    // The advice to retry with no id holds for a job being cancelled.
    const project = await store.create("P");
    const jobId = randomUUID();
    store.transaction((db) =>
      db
        .prepare(
          "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'export', ?, 0, ?, '{}', 'running')",
        )
        .run(jobId, project.id, jobId),
    );
    const cancel = () => execute(ctx, "yamakan.job.cancel", { jobId });
    await cancel();
    assert.equal(
      ((await cancel()).result as { detail: string }).detail,
      "cancelRequested",
    );

    // Commands that keep a receipt still replay.
    const made = await execute(
      { ...ctx, requestId: "create.1" },
      "yamakan.project.create",
      { name: "Kept" },
    );
    const again = await execute(
      { ...ctx, requestId: "create.1" },
      "yamakan.project.create",
      { name: "Kept" },
    );
    assert.equal(
      (again.result as { id: string }).id,
      (made.result as { id: string }).id,
    );
  } finally {
    await queue.close();
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
