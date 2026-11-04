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
  // As last committed: a running job's live figure is on yamakan.job.status.
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

export const PROGRESS_LIMITS = {
  runs: 5,
  attemptsPerRun: 20,
  jobs: 20,
} as const;

const SETTLED = new Set(["succeeded", "cancelled", "failed"]);

// What the read shows, then what only the held view knows, within the limit.
function union<T>(
  read: T[],
  held: T[],
  key: (item: T) => string,
  limit: number,
) {
  const seen = new Set(read.map(key));
  return [...read, ...held.filter((item) => !seen.has(key(item)))].slice(
    0,
    limit,
  );
}

/**
 * Combines two reads of one project that may arrive twice or out of order, and
 * stays within the view's limits. Attempts are append-only, so they join by run
 * and sequence. A run or job only the held view knows stays, an older revision
 * never replaces a newer one, and a settled job stays settled. Jobs and runs
 * carry no version, so between unsettled states, or for a run's `version`, a
 * late answer at the same revision can show an older value until the next read.
 * Joined attempts can have a gap between windows, which `truncated` marks. After
 * a restore to a lower revision, drop the held view: this function cannot tell.
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
  const readRuns = read.runs.map((run) => {
    const before = heldRuns.get(run.runId);
    if (!before) return run;
    const attempts = new Map(
      [...before.attempts, ...run.attempts].map((a) => [a.seq, a]),
    );
    const sorted = [...attempts.values()].sort((a, b) => a.seq - b.seq);
    const kept = sorted.slice(-PROGRESS_LIMITS.attemptsPerRun);
    const contiguous = kept.every(
      (a, i) => i === 0 || a.seq === kept[i - 1]!.seq + 1,
    );
    return {
      ...run,
      attempts: kept,
      truncated:
        run.truncated ||
        before.truncated ||
        sorted.length > kept.length ||
        !contiguous,
    };
  });
  const heldJobs = new Map(held.jobs.map((j) => [j.jobId, j]));
  const readJobs = read.jobs.map((job) => {
    const before = heldJobs.get(job.jobId);
    return before && SETTLED.has(before.state) ? before : job;
  });
  return {
    ...read,
    runs: union(readRuns, held.runs, (r) => r.runId, PROGRESS_LIMITS.runs),
    // A reader that lost job:read keeps seeing none.
    jobs: read.jobsVisible
      ? union(readJobs, held.jobs, (j) => j.jobId, PROGRESS_LIMITS.jobs)
      : [],
  };
}
