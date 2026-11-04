// SS-007: the versioned read view of a project's committed progress, and how a
// client combines two reads. There are no notifications: a client reads, and
// after a reconnect reads again. Nothing here carries authority.
export type ProgressAttempt = {
  seq: number;
  stage: string;
  kind: string;
  status: string;
  outputHash: string | null;
  recordedAt: number;
};
export type ProgressRun = {
  runId: string;
  pipelineName: string;
  version: number;
  // The newest attempts, oldest first; `truncated` says earlier ones exist.
  attempts: ProgressAttempt[];
  truncated: boolean;
};
export type ProgressJob = {
  jobId: string;
  kind: string;
  revision: number;
  state: string;
  attempt: number;
  progress: number;
  planHash: string | null;
};
export type ProgressView = {
  format: "yamakan.progress";
  formatVersion: 1;
  projectId: string;
  revision: number;
  // The caller's own request that made this revision, when it named one.
  requestId: string | null;
  runs: ProgressRun[];
  runsTruncated: boolean;
  // False when the caller lacks job:read; `jobs` is then empty.
  jobsVisible: boolean;
  jobs: ProgressJob[];
  jobsTruncated: boolean;
  cursor: string;
};
// A read whose `after` is still current: nothing newer to show.
export type ProgressUnchanged = {
  format: "yamakan.progress";
  formatVersion: 1;
  projectId: string;
  revision: number;
  unchanged: true;
  cursor: string;
};
export type ProgressRead = ProgressView | ProgressUnchanged;

const SETTLED = new Set(["succeeded", "cancelled", "failed"]);

/**
 * Combines two reads of one project that may arrive twice or out of order.
 * Attempts are append-only, so they join by run and sequence. An older revision
 * never replaces a newer one, and a settled job stays settled. Between unsettled
 * job states a late answer can show an older state until the next read.
 */
export function mergeProgress(
  held: ProgressView | null,
  read: ProgressRead,
): ProgressView | null {
  if ("unchanged" in read) return held;
  if (!held) return read;
  if (held.projectId !== read.projectId)
    throw new Error("Progress reads of different projects do not combine.");
  if (read.revision < held.revision) return held;
  const heldRuns = new Map(held.runs.map((r) => [r.runId, r]));
  const runs = read.runs.map((run) => {
    const before = heldRuns.get(run.runId);
    if (!before) return run;
    const attempts = new Map(
      [...before.attempts, ...run.attempts].map((a) => [a.seq, a]),
    );
    return {
      ...run,
      attempts: [...attempts.values()].sort((a, b) => a.seq - b.seq),
    };
  });
  const heldJobs = new Map(held.jobs.map((j) => [j.jobId, j]));
  const jobs = read.jobs.map((job) => {
    const before = heldJobs.get(job.jobId);
    return before && SETTLED.has(before.state) ? before : job;
  });
  return { ...read, runs, jobs };
}
