// SS-007: a handoff says where a project stands. It stores nothing, grants
// nothing, and a person resuming from one can check that nothing moved.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { execute, Scopes } from "../core/command/registry.ts";
import { startDirectorRun, advanceStage } from "../core/director/runtime.ts";
import { HANDOFF_LIMITS, type Handoff } from "../core/handoff.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { ProjectStore } from "../core/store.ts";

const hash = "a".repeat(64);
// A small stored WAV: a Director stage may only name an object the project holds.
function wav() {
  const samples = Buffer.alloc(4800 * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + samples.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(48000, 24);
  header.writeUInt32LE(96000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}
const person = { id: "browser-ui" as const, scopes: new Set(Scopes) };

async function workspace(t: test.TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-handoff-"));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  t.after(async () => {
    await queue.close();
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  const run = async (
    operation: string,
    input: unknown,
    principal: { id: string; scopes: Set<string> } = person,
  ) =>
    (
      await execute(
        { store, queue, principal: principal as typeof person },
        operation,
        input,
      )
    ).result;
  const read = async (projectId: string) =>
    (await run("yamakan.handoff.read", { projectId })) as Handoff;
  const check = async (handoff: unknown) =>
    (await run("yamakan.handoff.check", { handoff })) as {
      intact: boolean;
      current: boolean;
      moved: string[];
      revision: number;
    };
  return { store, run, read, check };
}

const pipeline = "framework-smoke";

test("a handoff names the project, its run and what comes next", async (t) => {
  const { store, read } = await workspace(t);
  const project = await store.create("A");
  const empty = await read(project.id);
  assert.equal(empty.format, "yamakan.handoff");
  assert.equal(empty.formatVersion, 1);
  assert.equal(empty.revision, project.revision);
  assert.deepEqual(empty.stories, []);
  assert.equal(empty.run, null);

  const started = await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: pipeline,
  });
  const fresh = await read(project.id);
  assert.equal(fresh.run!.runId, started.id);
  assert.equal(fresh.run!.briefHash, null);
  assert.equal(fresh.run!.latestAttempt, null);
  assert.equal(fresh.run!.nextAction.kind, "stage");

  const { asset } = await store.importAsset(project.id, "brief.wav", wav());
  await advanceStage(store, {
    runId: started.id,
    stage: fresh.run!.nextAction.stage!,
    status: "awaiting_human",
    outputHash: asset.hash,
  });
  const worked = await read(project.id);
  assert.equal(worked.run!.briefHash, asset.hash);
  assert.equal(worked.run!.latestAttempt!.outputHash, asset.hash);
  assert.equal(worked.run!.nextAction.kind, "blocked");
  assert.match(worked.run!.nextAction.reasons[0]!, /human approval/);
  // Stored nowhere: reading it twice moves nothing.
  assert.deepEqual(await read(project.id), worked);
});

test("a handoff holds no grants, secrets or people", async (t) => {
  const { store, read } = await workspace(t);
  const project = await store.create("A");
  await startDirectorRun(store, {
    projectId: project.id,
    pipelineName: pipeline,
    principalId: "agent:someone",
  });
  const text = JSON.stringify(await read(project.id));
  for (const word of ["token", "scope", "grant", "principal", "someone"])
    assert.ok(!text.toLowerCase().includes(word), word);
});

test("resuming shows what moved, and an edited handoff is not trusted", async (t) => {
  const { store, run, read, check } = await workspace(t);
  const created = await store.create("A");
  const handoff = await read(created.id);
  assert.deepEqual(await check(handoff), {
    intact: true,
    current: true,
    moved: [],
    revision: created.revision,
    handoffHash: handoff.handoffHash,
  });

  // An edit that claims the current state is still caught by its own hash.
  const edited = { ...handoff, revision: handoff.revision + 5 };
  const claim = await check(edited);
  assert.equal(claim.intact, false);
  assert.equal(claim.current, false);

  await run("yamakan.project.save", {
    project: created,
    expectedRevision: created.revision,
  });
  const later = await check(handoff);
  assert.equal(later.intact, true);
  assert.equal(later.current, false);
  assert.deepEqual(later.moved, ["revision"]);
  assert.equal(later.revision, created.revision + 1);
});

test("a handoff carries no extra field and stays within its limits", async (t) => {
  const { store, check } = await workspace(t);
  const project = await store.create("A");
  const base = {
    format: "yamakan.handoff",
    formatVersion: 1,
    projectId: project.id,
    revision: 0,
    stories: [],
    references: [],
    documentsTruncated: false,
    run: null,
    handoffHash: hash,
  };
  await assert.rejects(check({ ...base, token: "secret" }));
  await assert.rejects(check({ ...base, scopes: ["project:write"] }));
  await assert.rejects(
    check({
      ...base,
      stories: Array.from({ length: HANDOFF_LIMITS.documents + 1 }, () => ({
        documentId: "d",
        contentHash: hash,
      })),
    }),
  );
  await assert.rejects(check({ ...base, projectId: randomUUID() }), {
    code: "NOT_FOUND",
  });
});

test("presenting a handoff grants nothing, and reads need the reader's own scope", async (t) => {
  const { store, run, read } = await workspace(t);
  const project = await store.create("A");
  const handoff = await read(project.id);
  const agent = (...scopes: string[]) => ({
    id: `agent:${randomUUID()}`,
    scopes: new Set(scopes),
  });
  await assert.rejects(
    run("yamakan.handoff.read", { projectId: project.id }, agent("job:read")),
    { code: "SCOPE_DENIED" },
  );
  const reader = agent("project:read");
  await run("yamakan.handoff.check", { handoff }, reader);
  await assert.rejects(run("yamakan.project.create", { name: "No" }, reader), {
    code: "SCOPE_DENIED",
  });
});
