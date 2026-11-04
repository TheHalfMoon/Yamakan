// SS-007: one read view of committed progress. A reconnect reads a fresh
// snapshot; nothing is subscribed to, and nothing here carries authority.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { execute, Scopes } from "../core/command/registry.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { ProjectStore } from "../core/store.ts";
import {
  mergeProgress,
  PROGRESS_LIMITS,
  type ProgressJob,
  type ProgressView,
} from "../sdk/progress.ts";

const everything = { id: "browser-ui" as const, scopes: new Set(Scopes) };

async function workspace(t: test.TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-progress-"));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  t.after(async () => {
    await queue.close();
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  const read = async (
    projectId: string,
    principal: {
      id: "browser-ui" | `agent:${string}`;
      scopes: ReadonlySet<never> | Set<string>;
    } = everything,
    after?: string,
  ) =>
    (
      await execute(
        { store, queue, principal: principal as typeof everything },
        "yamakan.progress.read",
        { projectId, ...(after ? { after } : {}) },
      )
    ).result as ProgressView;
  return { root, store, queue, read };
}

const addJob = (
  store: ProjectStore,
  projectId: string,
  state: string,
  fields: { error?: string; artifact?: string } = {},
) => {
  const jobId = randomUUID();
  store.transaction((db) =>
    db
      .prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state, error, artifact) VALUES (?, 'export', ?, 0, ?, '{}', ?, ?, ?)",
      )
      .run(
        jobId,
        projectId,
        jobId,
        state,
        fields.error ?? null,
        fields.artifact ?? null,
      ),
  );
  return jobId;
};

const addRun = (store: ProjectStore, projectId: string, attempts: number) => {
  const runId = randomUUID();
  store.transaction((db) => {
    db.prepare(
      "INSERT INTO director_runs(id, project_id, pipeline_name, version, created_at, created_by) VALUES (?, ?, 'p', 1, 1, 'browser-ui')",
    ).run(runId, projectId);
    for (let seq = 1; seq <= attempts; seq++)
      db.prepare(
        "INSERT INTO director_attempts(run_id, seq, stage, kind, status, epoch, principal_id, recorded_at) VALUES (?, ?, 's', 'advance', 'succeeded', 1, 'browser-ui', 1)",
      ).run(runId, seq);
  });
  return runId;
};

test("the view shows this project's committed work and nothing of another", async (t) => {
  const { store, read } = await workspace(t);
  const a = await store.create("A");
  const b = await store.create("B");
  const runA = addRun(store, a.id, 2);
  const jobA = addJob(store, a.id, "queued");
  addRun(store, b.id, 1);
  const jobB = addJob(store, b.id, "queued");

  const view = await read(a.id);
  assert.equal(view.format, "yamakan.progress");
  assert.equal(view.formatVersion, 1);
  assert.equal(view.revision, a.revision);
  assert.deepEqual(
    view.runs.map((r) => [r.runId, r.attempts.map((x) => x.seq)]),
    [[runA, [1, 2]]],
  );
  assert.deepEqual(
    view.jobs.map((j) => j.jobId),
    [jobA],
  );
  assert.ok(!JSON.stringify(view).includes(jobB));

  await assert.rejects(read(randomUUID()), { code: "NOT_FOUND" });
});

test("a cursor says unchanged only for the same view of the same project", async (t) => {
  const { store, read } = await workspace(t);
  const a = await store.create("A");
  const b = await store.create("B");
  const first = await read(a.id);
  const same = await read(a.id, everything, first.cursor);
  assert.equal("unchanged" in same, true);
  assert.equal(same.cursor, first.cursor);
  // Another project's read with this cursor is a full view.
  assert.equal(
    "unchanged" in (await read(b.id, everything, first.cursor)),
    false,
  );
  // Committed work moves the cursor, and the stale cursor gets a full view.
  addJob(store, a.id, "queued");
  const moved = await read(a.id, everything, first.cursor);
  assert.equal("unchanged" in moved, false);
  assert.notEqual(moved.cursor, first.cursor);
});

test("errors, artifacts and payloads stay out of the view", async (t) => {
  const { store, read } = await workspace(t);
  const a = await store.create("A");
  addJob(store, a.id, "failed", {
    error: "C:\\Users\\someone\\secret.mp4",
    artifact: "C:\\Users\\someone\\out.mp4",
  });
  const text = JSON.stringify(await read(a.id));
  assert.ok(!text.includes("someone"));
  assert.ok(text.includes("failed"));
});

test("scopes are the commands' own: no job read, no jobs; no project read, no view", async (t) => {
  const { store, read } = await workspace(t);
  const a = await store.create("A");
  const job = addJob(store, a.id, "queued");
  const agent = (...scopes: string[]) => ({
    id: `agent:${randomUUID()}` as const,
    scopes: new Set(scopes),
  });
  const limited = await read(a.id, agent("project:read"));
  assert.equal(limited.jobsVisible, false);
  assert.deepEqual(limited.jobs, []);
  assert.ok(!JSON.stringify(limited).includes(job));
  // A view with jobs and one without never share a cursor.
  assert.equal(
    "unchanged" in
      (await read(a.id, agent("project:read", "job:read"), limited.cursor)),
    false,
  );
  await assert.rejects(read(a.id, agent("job:read")), {
    code: "SCOPE_DENIED",
  });
});

test("the caller's own request is named, and another caller's is not", async (t) => {
  const { store, queue, read } = await workspace(t);
  const created = await store.create("A");
  const { result: saved } = await execute(
    { store, queue, principal: everything, requestId: "saved.1" },
    "yamakan.project.save",
    { project: created, expectedRevision: created.revision },
  );
  const a = saved as { id: string; revision: number };
  assert.equal((await read(a.id)).requestId, "saved.1");
  const other = {
    id: `agent:${randomUUID()}` as const,
    scopes: new Set(["project:read"]),
  };
  assert.equal((await read(a.id, other)).requestId, null);
});

test("a reconnect reads the same committed state", async (t) => {
  const { root, store, read } = await workspace(t);
  const a = await store.create("A");
  addRun(store, a.id, 1);
  addJob(store, a.id, "succeeded");
  const before = await read(a.id);
  const again = new ProjectStore(root);
  await again.initialize();
  const queue = new JobSupervisor(again);
  try {
    const { result } = await execute(
      { store: again, queue, principal: everything },
      "yamakan.progress.read",
      { projectId: a.id },
    );
    assert.deepEqual(result, before);
  } finally {
    await queue.close();
    again.close();
  }
});

test("the view is bounded and says so", async (t) => {
  const { store, read } = await workspace(t);
  const a = await store.create("A");
  for (let i = 0; i < PROGRESS_LIMITS.runs; i++) addRun(store, a.id, 1);
  const newest = addRun(store, a.id, PROGRESS_LIMITS.attemptsPerRun + 3);
  for (let i = 0; i <= PROGRESS_LIMITS.jobs; i++)
    addJob(store, a.id, "succeeded");
  const view = await read(a.id);
  assert.equal(view.runs.length, PROGRESS_LIMITS.runs);
  assert.equal(view.runsTruncated, true);
  assert.equal(view.runs[0]!.runId, newest);
  assert.equal(view.runs[0]!.truncated, true);
  assert.equal(view.runs[0]!.attempts.length, PROGRESS_LIMITS.attemptsPerRun);
  assert.equal(
    view.runs[0]!.attempts.at(-1)!.seq,
    PROGRESS_LIMITS.attemptsPerRun + 3,
  );
  assert.equal(view.jobs.length, PROGRESS_LIMITS.jobs);
  assert.equal(view.jobsTruncated, true);
});

const job = (state: string): ProgressJob => ({
  jobId: "j",
  kind: "export",
  revision: 1,
  state,
  attempt: 1,
  progress: 0,
  planHash: null,
});
const attempt = (seq: number) => ({
  seq,
  stage: "s",
  kind: "advance",
  status: "succeeded",
  outputHash: null,
  recordedAt: 1,
});
const snapshot = (
  revision: number,
  seqs: number[],
  state: string,
): ProgressView => ({
  format: "yamakan.progress",
  formatVersion: 1,
  projectId: "p",
  revision,
  requestId: null,
  runs: [
    {
      runId: "r",
      pipelineName: "p",
      version: 1,
      attempts: seqs.map(attempt),
      truncated: false,
    },
  ],
  runsTruncated: false,
  jobsVisible: true,
  jobs: [job(state)],
  jobsTruncated: false,
  cursor: `${revision}.${seqs.join()}.${state}`,
});

test("attempts and job order are read from committed rows", async (t) => {
  const { store, read } = await workspace(t);
  const a = await store.create("A");
  const older = addJob(store, a.id, "failed");
  const newer = addJob(store, a.id, "running");
  store.transaction((db) =>
    db
      .prepare(
        "INSERT INTO attempts(job_id, attempt_no, generation, state) VALUES (?, 1, 1, 'failed'), (?, 2, 1, 'running')",
      )
      .run(newer, newer),
  );
  const view = await read(a.id);
  assert.deepEqual(
    view.jobs.map((j) => [j.jobId, j.attempt]),
    [
      [newer, 2],
      [older, 0],
    ],
  );
  // A new Director attempt moves the cursor with no revision change.
  const run = addRun(store, a.id, 1);
  const withRun = await read(a.id);
  store.transaction((db) =>
    db
      .prepare(
        "INSERT INTO director_attempts(run_id, seq, stage, kind, status, epoch, principal_id, recorded_at) VALUES (?, 2, 's', 'advance', 'succeeded', 1, 'browser-ui', 1)",
      )
      .run(run),
  );
  const moved = await read(a.id, everything, withRun.cursor);
  assert.equal("unchanged" in moved, false);
  assert.equal(moved.revision, withRun.revision);
});

test("a late read at the same revision loses nothing and stays bounded", () => {
  const first = snapshot(2, [1], "running");
  const newRun = {
    ...first.runs[0]!,
    runId: "newer",
    attempts: [attempt(1)],
  };
  const newJob = { ...job("queued"), jobId: "k" };
  const fuller = {
    ...first,
    runs: [newRun, ...first.runs],
    jobs: [newJob, ...first.jobs],
  };
  const merged = mergeProgress(fuller, first)!;
  assert.deepEqual(merged.runs.map((r) => r.runId).sort(), ["newer", "r"]);
  assert.deepEqual(merged.jobs.map((j) => j.jobId).sort(), ["j", "k"]);
  // Reads with new attempts each time never grow past the limit.
  let held: ProgressView | null = null;
  for (let i = 1; i <= 10; i++) {
    const seqs = Array.from(
      { length: PROGRESS_LIMITS.attemptsPerRun },
      (_, n) => i * 100 + n,
    );
    held = mergeProgress(held, snapshot(2, seqs, "running"));
  }
  const run = held!.runs[0]!;
  assert.equal(run.attempts.length, PROGRESS_LIMITS.attemptsPerRun);
  assert.equal(run.attempts.at(-1)!.seq, 1019);
  // A gap between windows is marked.
  const gap = mergeProgress(
    snapshot(2, [1, 2], "running"),
    snapshot(2, [50, 51], "running"),
  )!;
  assert.equal(gap.runs[0]!.truncated, true);
});

test("duplicate and out-of-order reads combine by committed identity", () => {
  const older = snapshot(1, [1], "running");
  const newer = snapshot(2, [1, 2], "succeeded");
  const inOrder = mergeProgress(mergeProgress(null, older), newer);
  assert.deepEqual(inOrder, newer);
  // The older answer arrives last: nothing moves backward.
  assert.deepEqual(mergeProgress(inOrder, older), newer);
  // The same answer twice changes nothing.
  assert.deepEqual(mergeProgress(inOrder, newer), newer);
  // Same revision, attempts join by sequence with no duplicate.
  const joined = mergeProgress(
    snapshot(2, [2, 3], "running"),
    snapshot(2, [1, 2], "running"),
  )!;
  assert.deepEqual(
    joined.runs[0]!.attempts.map((a) => a.seq),
    [1, 2, 3],
  );
  // A settled job stays settled against a late answer at the same revision.
  assert.equal(
    mergeProgress(snapshot(2, [1], "succeeded"), snapshot(2, [1], "running"))!
      .jobs[0]!.state,
    "succeeded",
  );
  // An unchanged read keeps what is held; other projects do not combine.
  assert.deepEqual(
    mergeProgress(newer, {
      format: "yamakan.progress",
      formatVersion: 1,
      projectId: "p",
      revision: 2,
      unchanged: true,
      cursor: newer.cursor,
    }),
    newer,
  );
  assert.throws(() => mergeProgress(newer, { ...older, projectId: "other" }));
});
