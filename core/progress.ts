// SS-007: one read view of a project's committed progress, derived from the
// tables that already hold it. It adds no store and reads only this project.
// Job errors, artifacts and payloads stay out: they can name host paths.
import { PROGRESS_LIMITS } from "../sdk/progress.ts";
import type {
  ProgressAttempt,
  ProgressJob,
  ProgressRead,
  ProgressRun,
} from "../sdk/progress.ts";
import { CommandError } from "./command/errors.ts";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import type { ProjectStore } from "./store.ts";

export function readProgress(
  store: ProjectStore,
  reader: { principalId: string; jobsVisible: boolean },
  input: { projectId: string; after?: string },
): ProgressRead {
  const { projectId } = input;
  return store.read((db) => {
    const head = db
      .prepare("SELECT revision FROM projects WHERE project_id = ?")
      .get(projectId) as { revision: number } | undefined;
    if (!head) throw new CommandError("NOT_FOUND", "Project not found.");
    // A request id is only useful to the principal it replays for.
    const receipt = db
      .prepare(
        "SELECT r.request_id FROM revisions v JOIN command_receipts r ON v.receipt_id = r.id WHERE v.project_id = ? AND v.revision = ? AND r.principal_id = ?",
      )
      .get(projectId, head.revision, reader.principalId) as
      { request_id: string } | undefined;
    const runRows = db
      .prepare(
        "SELECT id, pipeline_name, version FROM director_runs WHERE project_id = ? ORDER BY rowid DESC LIMIT ?",
      )
      .all(projectId, PROGRESS_LIMITS.runs + 1) as Array<{
      id: string;
      pipeline_name: string;
      version: number;
    }>;
    const runs: ProgressRun[] = runRows
      .slice(0, PROGRESS_LIMITS.runs)
      .map((run) => {
        const rows = db
          .prepare(
            "SELECT seq, stage, kind, status, output_hash, recorded_at FROM director_attempts WHERE run_id = ? ORDER BY seq DESC LIMIT ?",
          )
          .all(run.id, PROGRESS_LIMITS.attemptsPerRun + 1) as Array<{
          seq: number;
          stage: string;
          kind: string;
          status: string;
          output_hash: string | null;
          recorded_at: number;
        }>;
        const attempts: ProgressAttempt[] = rows
          .slice(0, PROGRESS_LIMITS.attemptsPerRun)
          .reverse()
          .map((a) => ({
            seq: a.seq,
            stage: a.stage,
            kind: a.kind,
            status: a.status,
            outputHash: a.output_hash,
            recordedAt: a.recorded_at,
          }));
        return {
          runId: run.id,
          pipelineName: run.pipeline_name,
          version: run.version,
          attempts,
          truncated: rows.length > PROGRESS_LIMITS.attemptsPerRun,
        };
      });
    const jobRows = reader.jobsVisible
      ? (db
          .prepare(
            "SELECT j.job_id, j.kind, j.frozen_revision, j.state, j.progress, j.plan_hash, (SELECT COALESCE(MAX(a.attempt_no), 0) FROM attempts a WHERE a.job_id = j.job_id) AS attempt FROM jobs j WHERE j.project_id = ? ORDER BY j.rowid DESC LIMIT ?",
          )
          .all(projectId, PROGRESS_LIMITS.jobs + 1) as Array<{
          job_id: string;
          kind: string;
          frozen_revision: number;
          state: string;
          progress: number;
          plan_hash: string | null;
          attempt: number;
        }>)
      : [];
    const jobs: ProgressJob[] = jobRows
      .slice(0, PROGRESS_LIMITS.jobs)
      .map((j) => ({
        jobId: j.job_id,
        kind: j.kind,
        revision: j.frozen_revision,
        state: j.state,
        attempt: j.attempt,
        progress: j.progress,
        planHash: j.plan_hash,
      }));
    const body = {
      format: "yamakan.progress" as const,
      formatVersion: 1 as const,
      projectId,
      revision: head.revision,
      requestId: receipt?.request_id ?? null,
      runs,
      runsTruncated: runRows.length > PROGRESS_LIMITS.runs,
      jobsVisible: reader.jobsVisible,
      jobs,
      jobsTruncated: jobRows.length > PROGRESS_LIMITS.jobs,
    };
    // Equal only for an equal view of this project, so a cursor from another
    // project or a reader with other scopes never reads as unchanged.
    const cursor = sha256Hex(canonicalJson(body));
    if (input.after === cursor)
      return {
        format: body.format,
        formatVersion: body.formatVersion,
        projectId,
        revision: head.revision,
        unchanged: true as const,
        cursor,
      };
    return { ...body, cursor };
  });
}
