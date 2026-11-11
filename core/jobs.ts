// Durable jobs (plan T5, contract "Durable jobs and owned processes").
// Jobs hold intent (project, frozen revision, idempotency key, payload);
// attempts hold execution identity (generation, worker PID, outcome). Every
// transition is a compare-and-swap inside one SQLite transaction, attempts
// are fenced by the supervisor generation, and a restart reconciles attempts
// from an earlier generation: their Job Object workers died with that service,
// so they are marked failed and their jobs re-queued (local work only, never
// a paid resubmission). Partial outputs are never registered.
import {
  mayHaveLeft,
  type GenerationLedger,
  type GenerationRecord,
} from "./engines/generation.ts";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  statfs,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import { ProjectStore } from "./store.ts";
import { AssetSchema, Id, frameRateOf, framesToSeconds } from "./project.ts";
import type { Asset } from "./project.ts";
import {
  durationFramesAt,
  MEDIA_DECODERS,
  MEDIA_FORMATS,
  probe,
  PROGRESS_LINE_LIMIT,
} from "./media.ts";
import { mediaTools, workers } from "./process/workers.ts";
import { ENGINE_WORKER_PROFILE } from "./process/owner.ts";
import {
  BLENDER_SCENE_LIMITS,
  BlenderSceneSchema,
  blenderSceneModels,
} from "./blender/scene.ts";
import { checkGlb } from "./cinema/glb.ts";
import { DOCUMENT_LIMITS } from "./document-ref.ts";
import {
  BLENDER_PIN,
  BLENDER_SCRIPT,
  BLENDER_TRACK_SCRIPT,
  blenderRuntime,
  verifyBlenderForRun,
} from "./blender/runtime.ts";
import {
  BLENDER_TRACK_LIMITS,
  CameraTrackSchema,
  TrackLensSchema,
  type CameraTrack,
} from "./blender/track.ts";
import { blenderWorkers } from "./blender/worker.ts";
import { createReadStream } from "node:fs";
import { keepMainStream, renderRevision } from "./render.ts";
import type { RenderJob } from "./render.ts";
import { CommandError, toCommandError } from "./command/errors.ts";
import { RESOURCE_POLICY } from "./command/policy.ts";
import { IllegalTransition } from "./jobs/rules/jobs.ts";
import {
  YAMAKAN_LEGAL_TRANSITIONS,
  transitionYamakanJob,
  type YamakanJobState,
} from "./jobs/rules/yamakan-transitions.ts";

/** Assert Gomrey-style legal transition, then run the UPDATE inside the caller transaction. */
function assertAndApplyJobState(
  db: DatabaseSync,
  jobId: string,
  to: YamakanJobState,
  apply: () => void,
): void {
  const row = db
    .prepare("SELECT state FROM jobs WHERE job_id = ?")
    .get(jobId) as { state: string } | undefined;
  if (!row) {
    throw new CommandError("NOT_FOUND", "Job not found.");
  }
  try {
    transitionYamakanJob(jobId, row.state, to);
  } catch (e) {
    if (e instanceof IllegalTransition) {
      throw new CommandError("VALIDATION", e.message);
    }
    throw e;
  }
  apply();
}

export type JobState =
  | "queued"
  | "preparing"
  | "running"
  | "validating"
  | "succeeded"
  | "cancelRequested"
  | "cancelled"
  | "failed"
  | "reconciliationRequired";
const TERMINAL = ["succeeded", "cancelled", "failed", "reconciliationRequired"];
// A generation running somewhere else, recorded here so that it outlives a restart.
// It enters at "preparing" and is never "queued", so the pump can never claim it, and
// has no attempts, so start() has nothing to requeue: it is followed, and never sent
// again without a person.
export const REMOTE_GENERATION = "remote-generation";
const generationPayloads = (db: DatabaseSync) =>
  (
    db
      .prepare("SELECT payload FROM jobs WHERE kind = ?")
      .all(REMOTE_GENERATION) as {
      payload: string;
    }[]
  ).map((row) => safeJson(row.payload) as GenerationRecord);
const generationJobState = (r: GenerationRecord): YamakanJobState => {
  if (r.imported) return "succeeded";
  if (r.cancelled || r.state === "cancelled") return "cancelled";
  if (r.state === "failed") return "failed";
  if (r.state === "succeeded") return "validating";
  return r.phase === "sending" ? "preparing" : "running";
};
const terminalSql = TERMINAL.map((s) => `'${s}'`).join(", ");
// Attempts interrupted by a crash (not a graceful stop) are retried locally
// at most this many times; the job is then set aside for reconciliation.
const MAX_INTERRUPTIONS = 3;
const INTERRUPTED = "Interrupted by a service restart.";

type Row = {
  job_id: string;
  kind: string;
  project_id: string;
  frozen_revision: number;
  idempotency_key: string;
  payload: string;
  state: JobState;
  cancel_requested: number;
  progress: number;
  error: string | null;
  artifact: string | null;
  plan_hash?: string | null;
};

// The only payload this build executes; anything else is quarantined.
// YU-025: an export variant renders the same revision at another output
// size (an aspect variant), with the same contain fit; its plan and
// profile are frozen by the revision and the size.
export const ExportVariant = z
  .object({
    name: z.string().regex(/^[a-z0-9-]{1,16}$/),
    width: z
      .number()
      .int()
      .min(16)
      .max(1920)
      .refine((x) => x % 2 === 0, "Width is even."),
    height: z
      .number()
      .int()
      .min(16)
      .max(1080)
      .refine((x) => x % 2 === 0, "Height is even."),
  })
  .strict();
export type ExportVariant = z.infer<typeof ExportVariant>;
export const BATCH_LIMITS = Object.freeze({
  variants: 4,
  // The free space a batch needs per output, above the disk reserve.
  outputBytes: 512 * 1024 * 1024,
});

const ExportPayload = z
  .object({
    format: z.literal("export/1"),
    /** W18: optional two-pass loudnorm on the mixed audio bus. */
    normalizeLoudness: z.boolean().optional(),
    /** YU-025: the variant's output size, and the batch it belongs to. */
    variant: ExportVariant.optional(),
    batchId: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
  })
  .strict();
// A Blender render (Blender integration, first slice): the scene the fixed script renders and
// the name the made video joins the project under.
const BlenderPayload = z
  .object({
    format: z.literal("blender/1"),
    scene: BlenderSceneSchema,
    name: z.string().min(1).max(120),
    // The project video a plate's footage comes from (the tracked one), when the scene has one.
    plateAssetId: Id.optional(),
  })
  .strict()
  .refine(
    (p) => !!p.scene.plate === !!p.plateAssetId,
    "A plate comes with its footage, and footage only with a plate.",
  );
// A camera track of one of the project's videos (core/blender/track.ts).
const TrackPayload = z
  .object({
    format: z.literal("blender-track/1"),
    assetId: Id,
    lens: TrackLensSchema,
  })
  .strict();
// Cycles on the CPU uses every core it is given: one render at a time, across all projects.
const BLENDER_RENDERS_AT_ONCE = 1;

const DerivativePayload = z
  .object({
    format: z.literal("cfr/1"),
    asset: AssetSchema,
    frameRate: z
      .object({
        num: z.number().int().positive().max(1_000_000),
        den: z.number().int().positive().max(1_000_000),
      })
      .strict(),
  })
  .strict();

export type JobFault =
  "after-claim" | "before-publish" | "after-publish" | "before-succeed";
export type SupervisorOptions = {
  fault?: (point: JobFault, jobId: string) => void | Promise<void>;
};

// Job states as the editor and agents see them (RenderJob), plus the exact state.
const publicState = (s: JobState): RenderJob["state"] => {
  if (s === "succeeded") return "COMPLETED";
  if (s === "cancelled") return "CANCELLED";
  if (s === "failed" || s === "reconciliationRequired") return "FAILED";
  if (s === "queued") return "QUEUED";
  return "RUNNING";
};

export class JobSupervisor {
  readonly store: ProjectStore;
  readonly #options: SupervisorOptions;
  #generation = 0;
  #loop: Promise<void> | null = null;
  #closing = false;
  #controllers = new Map<string, AbortController>();
  #progress = new Map<string, number>();
  #setAside: string[] = [];
  // Set once a newer service run has taken the queue; this one never claims again.
  #superseded = false;

  constructor(store: ProjectStore, options: SupervisorOptions = {}) {
    this.store = store;
    this.#options = options;
  }

  // Takes a new generation, fences and reconciles earlier attempts, and starts
  // running queued work.
  async start() {
    // A second start would fence out this supervisor's own live attempts.
    if (this.#generation) return;
    const interrupted = this.store.transaction((db) => {
      db.prepare(
        "UPDATE supervisor SET generation = generation + 1 WHERE id = 1",
      ).run();
      this.#generation = (
        db.prepare("SELECT generation FROM supervisor WHERE id = 1").get() as {
          generation: number;
        }
      ).generation;
      const stale = db
        .prepare(
          "SELECT a.job_id, a.attempt_no, j.kind, j.project_id, j.cancel_requested FROM attempts a JOIN jobs j ON j.job_id = a.job_id WHERE a.state IN ('preparing', 'running', 'validating') AND a.generation < ?",
        )
        .all(this.#generation) as {
        job_id: string;
        attempt_no: number;
        kind: string;
        project_id: string;
        cancel_requested: number;
      }[];
      for (const a of stale) {
        db.prepare(
          "UPDATE attempts SET state = 'failed', error = ? WHERE job_id = ? AND attempt_no = ?",
        ).run(INTERRUPTED, a.job_id, a.attempt_no);
        const next: YamakanJobState = a.cancel_requested
          ? "cancelled"
          : "queued";
        assertAndApplyJobState(db, a.job_id, next, () => {
          db.prepare(
            "UPDATE jobs SET state = ?, progress = 0 WHERE job_id = ?",
          ).run(next, a.job_id);
        });
      }
      return stale;
    });
    // Unregistered outputs of interrupted attempts are removed, including an
    // export published just before its success could commit.
    for (const a of interrupted) {
      if (a.kind === "export" || a.kind === "blender-track")
        await unlink(
          await this.store.file(
            a.project_id,
            "exports",
            a.job_id,
            a.kind === "export"
              ? `render-${a.attempt_no}.mp4`
              : `track-${a.attempt_no}.json`,
          ),
        ).catch(() => {});
      await this.#cleanup(a.project_id, a.job_id, a.attempt_no);
      await this.#release(a.job_id);
    }
    this.#pump();
  }

  // The generation service's record of its runs, in the jobs table.
  generationLedger(): GenerationLedger {
    const parse = (row: Row): GenerationRecord => ({
      ...(safeJson(row.payload) as GenerationRecord),
      held: row.state === "reconciliationRequired",
    });
    const read = (db: DatabaseSync, id: string) =>
      db
        .prepare("SELECT * FROM jobs WHERE job_id = ? AND kind = ?")
        .get(id, REMOTE_GENERATION) as Row | undefined;
    return {
      begin: (record) =>
        this.store.transaction((db) => {
          const active = (
            db
              .prepare(
                `SELECT count(*) AS n FROM jobs WHERE state NOT IN (${terminalSql})`,
              )
              .get() as { n: number }
          ).n;
          if (active >= RESOURCE_POLICY.enforced.activeJobs)
            throw new CommandError("LIMIT_EXCEEDED", "Too many active jobs.");
          const head = (
            db
              .prepare("SELECT revision FROM projects WHERE project_id = ?")
              .get(record.projectId) as { revision: number } | undefined
          )?.revision;
          db.prepare(
            "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, ?, ?, ?, ?, ?, 'preparing')",
          ).run(
            record.generationId,
            REMOTE_GENERATION,
            record.projectId,
            head ?? 0,
            record.generationId,
            JSON.stringify(record),
          );
        }),
      update: (id, change) =>
        this.store.transaction((db) => {
          const row = read(db, id);
          if (!row)
            throw new CommandError("NOT_FOUND", "Generation not found.");
          const next: GenerationRecord = {
            ...(safeJson(row.payload) as GenerationRecord),
            ...change,
          };
          db.prepare(
            "UPDATE jobs SET payload = ?, error = ?, artifact = ? WHERE job_id = ?",
          ).run(
            JSON.stringify(next),
            // A held copy keeps saying why it is held.
            row.state === "reconciliationRequired"
              ? row.error
              : (next.diagnostic ?? null),
            next.imported ? `asset:${next.imported.assetId}` : null,
            id,
          );
          // Through each legal step. A held copy stays held, and an ended job stays as
          // it ended: neither has a way out to these states.
          const target = generationJobState(next);
          const path: YamakanJobState[] = [
            "preparing",
            "running",
            "validating",
            "succeeded",
          ];
          let at = row.state as YamakanJobState;
          while (at !== target && at !== "reconciliationRequired") {
            const along = path[path.indexOf(at) + 1];
            const step = YAMAKAN_LEGAL_TRANSITIONS[at]?.has(target)
              ? target
              : path.indexOf(at) >= 0 && path.indexOf(target) > path.indexOf(at)
                ? along
                : null;
            if (!step) break;
            assertAndApplyJobState(db, id, step, () => {
              db.prepare("UPDATE jobs SET state = ? WHERE job_id = ?").run(
                step,
                id,
              );
            });
            at = step;
          }
        }),
      read: (id) =>
        this.store.read((db) => {
          const row = read(db, id);
          return row ? parse(row) : null;
        }),
      list: (projectId) =>
        this.store.read((db) =>
          (
            db
              .prepare(
                "SELECT * FROM jobs WHERE kind = ? AND project_id = ? ORDER BY rowid DESC LIMIT 50",
              )
              .all(REMOTE_GENERATION, projectId) as Row[]
          ).map(parse),
        ),
      lastSentAt: (recipeId, except) =>
        this.store.read((db) => {
          const times = generationPayloads(db)
            .filter((r) => mayHaveLeft(r, recipeId, except))
            .map((r) => r.startedAt);
          return times.length ? Math.max(...times) : undefined;
        }),
      // A held copy's run is the original's, and an ended one has nothing to collect.
      following: (recipeId, except) =>
        this.store.read((db) =>
          (
            db
              .prepare(
                "SELECT job_id, payload FROM jobs WHERE kind = ? AND state IN ('preparing', 'running')",
              )
              .all(REMOTE_GENERATION) as { job_id: string; payload: string }[]
          )
            .filter((row) => {
              const r = safeJson(row.payload) as GenerationRecord;
              return r.recipe?.id === recipeId && row.job_id !== except;
            })
            .map((row) => row.job_id),
        ),
      remembersEnded: true,
    };
  }

  #view(row: Row): RenderJob & { detail: JobState } {
    return {
      id: row.job_id,
      projectId: row.project_id,
      revision: row.frozen_revision,
      state: publicState(row.state),
      detail: row.state,
      progress: this.#progress.get(row.job_id) ?? row.progress,
      error: row.error,
      artifact: row.artifact,
      planHash: row.plan_hash ?? null,
      loudness: this.#loudness(row),
    };
  }
  // What an export's loudness request came to. A job finished before this was
  // recorded is unknown, never assumed either way.
  #loudness(row: Row): RenderJob["loudness"] {
    const payload = ExportPayload.safeParse(safeJson(row.payload));
    if (row.kind !== "export" || !payload.success) return null;
    if (!payload.data.normalizeLoudness) return { state: "off" };
    if (row.state === "succeeded") {
      const done = this.store.read((db) =>
        db
          .prepare(
            "SELECT receipt FROM attempts WHERE job_id = ? AND state = 'succeeded' ORDER BY attempt_no DESC",
          )
          .get(row.job_id),
      ) as { receipt: string | null } | undefined;
      const receipt = done?.receipt
        ? (safeJson(done.receipt) as { loudness?: unknown })
        : null;
      const measured = receipt?.loudness;
      if (measured === null) return { state: "unmeasured" };
      const { inputI, targetI } = (measured ?? {}) as Record<string, unknown>;
      return typeof inputI === "number" && typeof targetI === "number"
        ? { state: "measured", inputI, targetI }
        : { state: "unknown" };
    }
    return ["failed", "cancelled", "reconciliationRequired"].includes(row.state)
      ? { state: "unmeasured" }
      : { state: "pending" };
  }
  #row(db: DatabaseSync, jobId: string) {
    return db.prepare("SELECT * FROM jobs WHERE job_id = ?").get(jobId) as
      Row | undefined;
  }

  async submit(
    projectId: string,
    key: string,
    options: { normalizeLoudness?: boolean } = {},
  ) {
    if (this.#closing) throw new Error("Render queue is closing.");
    this.#current();
    if (!this.#generation) await this.start();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key))
      throw new Error("Invalid idempotency key.");
    const project = await this.store.load(projectId);
    if (this.#closing) throw new Error("Render queue is closing.");
    const row = this.store.transaction((db) => {
      this.#currentIn(db);
      const existing = db
        .prepare(
          "SELECT * FROM jobs WHERE project_id = ? AND kind = 'export' AND frozen_revision = ? AND idempotency_key = ?",
        )
        .get(projectId, project.revision, key) as Row | undefined;
      if (existing) return existing;
      // Admission counts active work only; finished history never blocks it.
      const active = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (active >= RESOURCE_POLICY.enforced.activeJobs)
        throw new CommandError("LIMIT_EXCEEDED", "Too many active jobs.");
      const jobId = randomUUID();
      db.prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'export', ?, ?, ?, ?, 'queued')",
      ).run(
        jobId,
        projectId,
        project.revision,
        key,
        JSON.stringify({
          format: "export/1",
          normalizeLoudness: options.normalizeLoudness === true,
        }),
      );
      return this.#row(db, jobId)!;
    });
    this.#pump();
    return this.#view(row);
  }

  /**
   * YU-025: one export per variant of the current revision, admitted
   * together or not at all (the active-job limit counts the whole batch).
   * A retry with the same key returns the same batch.
   */
  async submitBatch(
    projectId: string,
    key: string,
    variants: ExportVariant[],
    options: { normalizeLoudness?: boolean } = {},
  ) {
    if (this.#closing) throw new Error("Render queue is closing.");
    this.#current();
    if (!this.#generation) await this.start();
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(key))
      throw new Error("Invalid idempotency key.");
    const parsed = z
      .array(ExportVariant)
      .min(1)
      .max(BATCH_LIMITS.variants)
      .parse(variants);
    const names = new Set(parsed.map((v) => v.name));
    const sizes = new Set(parsed.map((v) => `${v.width}x${v.height}`));
    if (names.size !== parsed.length || sizes.size !== parsed.length)
      throw new CommandError(
        "VALIDATION",
        "Each variant of a batch has its own name and size.",
      );
    const project = await this.store.load(projectId);
    if (this.#closing) throw new Error("Render queue is closing.");
    // The batch is named by what it asks for too: a retry with the same key
    // but other variants or settings is another batch, never the old one.
    const batchId = createHash("sha256")
      .update(
        JSON.stringify([
          projectId,
          project.revision,
          key,
          [...parsed].sort((a, b) => a.name.localeCompare(b.name)),
          options.normalizeLoudness === true,
        ]),
      )
      .digest("hex")
      .slice(0, 32);
    // A batch already admitted is returned as it is (an idempotent retry).
    const known = this.store.read(
      (db) =>
        db
          .prepare(
            "SELECT 1 FROM jobs WHERE project_id = ? AND kind = 'export' AND json_valid(payload) AND json_extract(payload, '$.batchId') = ? LIMIT 1",
          )
          .get(projectId, batchId) !== undefined,
    );
    if (known) return this.batchStatus(projectId, batchId);
    // Room for every output above the disk reserve (a bound per output, as
    // the render's own size check), before any is admitted.
    const space = await statfs(this.store.root);
    const free = Number(space.bavail) * Number(space.bsize);
    if (
      free <
      RESOURCE_POLICY.enforced.diskReserveBytes +
        parsed.length * BATCH_LIMITS.outputBytes
    )
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Not enough free disk space for this batch's exports.",
      );
    this.store.transaction((db) => {
      this.#currentIn(db);
      const existing = db
        .prepare(
          "SELECT count(*) AS n FROM jobs WHERE project_id = ? AND kind = 'export' AND json_valid(payload) AND json_extract(payload, '$.batchId') = ?",
        )
        .get(projectId, batchId) as { n: number };
      if (existing.n) return;
      const active = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (active + parsed.length > RESOURCE_POLICY.enforced.activeJobs)
        throw new CommandError("LIMIT_EXCEEDED", "Too many active jobs.");
      for (const variant of parsed)
        db.prepare(
          "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'export', ?, ?, ?, ?, 'queued')",
        ).run(
          randomUUID(),
          projectId,
          project.revision,
          // "." is outside a single export's key alphabet, so a batch
          // output's key never matches (or collides with) one.
          `b.${batchId}.${variant.name}`,
          JSON.stringify({
            format: "export/1",
            normalizeLoudness: options.normalizeLoudness === true,
            variant,
            batchId,
          }),
        );
    });
    this.#pump();
    return this.batchStatus(projectId, batchId);
  }

  /**
   * A batch's outputs: each variant's job, its error and verified profile.
   * The batch succeeds only when every output did; one failure fails it.
   */
  batchStatus(projectId: string, batchId: string) {
    if (!/^[a-f0-9]{32}$/.test(batchId))
      throw new CommandError("VALIDATION", "Invalid batch id.");
    const rows = this.store.read(
      (db) =>
        db
          .prepare(
            "SELECT * FROM jobs WHERE project_id = ? AND kind = 'export' AND json_valid(payload) AND json_extract(payload, '$.batchId') = ? ORDER BY rowid",
          )
          .all(projectId, batchId) as Row[],
    );
    if (!rows.length) throw new CommandError("NOT_FOUND", "Batch not found.");
    const outputs = rows.map((row) => {
      const payload = ExportPayload.safeParse(safeJson(row.payload));
      if (!payload.success || !payload.data.variant)
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "A batch output's record is damaged.",
        );
      const { variant } = payload.data;
      const view = this.#view(row);
      return {
        ...view,
        variant: variant!,
        // A render's output is verified against its plan's profile, so a
        // finished output is exactly this size.
        profile:
          view.state === "COMPLETED"
            ? { width: variant!.width, height: variant!.height }
            : null,
      };
    });
    // A job set aside for reconciliation counts as failed until it is
    // resolved (it may be queued again); one being cancelled, as running.
    const states = outputs.map((o) => o.state);
    // One state for the batch: COMPLETED only when every output is.
    let state: "COMPLETED" | "RUNNING" | "FAILED" | "CANCELLED" = "CANCELLED";
    if (states.every((s) => s === "COMPLETED")) state = "COMPLETED";
    else if (states.some((s) => s === "QUEUED" || s === "RUNNING"))
      state = "RUNNING";
    else if (states.some((s) => s === "FAILED")) state = "FAILED";
    return {
      batchId,
      projectId,
      revision: rows[0]!.frozen_revision,
      state,
      outputs,
    };
  }

  /** Cancels a batch's unfinished outputs; finished ones are kept. */
  cancelBatch(projectId: string, batchId: string) {
    for (const o of this.batchStatus(projectId, batchId).outputs) {
      // An output already being cancelled (or finished) is left as it is.
      if (o.detail === "cancelRequested") continue;
      if (o.state !== "QUEUED" && o.state !== "RUNNING") continue;
      try {
        this.cancel(o.id);
      } catch {
        // It finished meanwhile; the status below says how.
      }
    }
    return this.batchStatus(projectId, batchId);
  }

  status(jobId: string) {
    const row = this.store.read((db) => this.#row(db, jobId));
    if (!row) throw new Error("Job not found.");
    return this.#view(row);
  }

  list(limit = 100) {
    return (
      this.store.read((db) =>
        db
          .prepare("SELECT * FROM jobs ORDER BY rowid DESC LIMIT ?")
          .all(Math.min(Math.max(1, limit), 500)),
      ) as Row[]
    ).map((r) => this.#view(r));
  }

  // Queued jobs cancel at once. Running ones are marked, their worker's job is
  // terminated, and the terminal state follows once the worker has exited.
  retry(jobId: string) {
    this.#current();
    const row = this.store.transaction((db) => {
      const row = this.#row(db, jobId);
      if (!row) throw new Error("Job not found.");
      if (row.state !== "reconciliationRequired")
        throw new CommandError(
          "VALIDATION",
          "Only jobs awaiting reconciliation can be retried.",
        );
      // It may have reached the engine: only a person can decide to send it again.
      if (row.kind === REMOTE_GENERATION)
        throw new CommandError(
          "VALIDATION",
          "A generation is never sent again automatically. Start a new one if it is wanted.",
        );
      assertAndApplyJobState(db, jobId, "queued", () => {
        db.prepare(
          "UPDATE jobs SET state = 'queued', error = NULL, progress = 0 WHERE job_id = ? AND state = 'reconciliationRequired'",
        ).run(jobId);
      });
      return this.#row(db, jobId)!;
    });
    this.#pump();
    return this.#view(row);
  }

  discard(jobId: string) {
    this.#current();
    const row = this.store.transaction((db) => {
      const row = this.#row(db, jobId);
      if (!row) throw new Error("Job not found.");
      if (
        ["preparing", "running", "validating", "cancelRequested"].includes(
          row.state,
        )
      )
        throw new CommandError(
          "VALIDATION",
          "A running job cannot be discarded; cancel it first.",
        );
      if (row.state !== "reconciliationRequired")
        throw new CommandError(
          "VALIDATION",
          "Only jobs awaiting reconciliation can be discarded.",
        );
      // Held means the run belongs to the workspace this was restored from.
      if (row.kind === REMOTE_GENERATION)
        throw new CommandError(
          "VALIDATION",
          "A generation held in a restored copy stays as it is: its run belongs to the original.",
        );
      assertAndApplyJobState(db, jobId, "cancelled", () => {
        db.prepare(
          "UPDATE jobs SET state = 'cancelled', error = NULL, progress = 0 WHERE job_id = ? AND state = 'reconciliationRequired'",
        ).run(jobId);
      });
      return this.#row(db, jobId)!;
    });
    // A discarded conversion gives up its staged original, as a cancel does.
    void this.#release(jobId);
    return this.#view(row);
  }

  cancel(jobId: string) {
    const row = this.store.transaction((db) => {
      const row = this.#row(db, jobId);
      if (!row) throw new Error("Job not found.");
      if (row.kind === REMOTE_GENERATION)
        throw new CommandError(
          "VALIDATION",
          "A generation is followed with yamakan.generation.cancel, which says what it can and cannot stop.",
        );
      // Already being cancelled: a retry asks for what is already under way.
      if (TERMINAL.includes(row.state) || row.state === "cancelRequested")
        return row;
      if (row.state === "queued") {
        assertAndApplyJobState(db, jobId, "cancelled", () => {
          db.prepare(
            "UPDATE jobs SET state = 'cancelled' WHERE job_id = ? AND state = 'queued'",
          ).run(jobId);
        });
      } else {
        assertAndApplyJobState(db, jobId, "cancelRequested", () => {
          db.prepare(
            "UPDATE jobs SET state = 'cancelRequested', cancel_requested = 1 WHERE job_id = ?",
          ).run(jobId);
        });
      }
      return this.#row(db, jobId)!;
    });
    this.#controllers.get(jobId)?.abort();
    if (row.state === "cancelled") void this.#release(jobId);
    return this.#view(row);
  }

  #pump() {
    if (this.#loop || this.#closing || this.#superseded || !this.#generation)
      return;
    this.#loop = (async () => {
      // One active render worker at a time (policy activeRenderWorkers).
      for (;;) {
        if (this.#closing) break;
        const claimed = this.#claim();
        for (const jobId of this.#setAside.splice(0))
          await this.#release(jobId);
        if (!claimed) break;
        await this.#execute(claimed.row, claimed.attempt);
      }
    })()
      // A store error (BUSY, for example) ends this pass; it is retried after
      // a pause rather than in a tight loop.
      .then(
        () => false,
        () => true,
      )
      .then((failed) => {
        this.#loop = null;
        if (failed) {
          if (!this.#closing) setTimeout(() => this.#pump(), 1000).unref();
          return;
        }
        let more = false;
        try {
          more = !this.#closing && this.#hasQueued();
        } catch {}
        if (more) this.#pump();
      });
  }
  #hasQueued() {
    return Boolean(
      this.store.read((db) =>
        db.prepare("SELECT 1 FROM jobs WHERE state = 'queued' LIMIT 1").get(),
      ),
    );
  }

  #claim() {
    return this.store.transaction((db) => {
      const current = (
        db.prepare("SELECT generation FROM supervisor WHERE id = 1").get() as {
          generation: number;
        }
      ).generation;
      // A newer service run owns the queue; this one stops claiming.
      if (current !== this.#generation) {
        this.#superseded = true;
        return null;
      }
      for (;;) {
        const row = db
          .prepare(
            "SELECT * FROM jobs WHERE state = 'queued' ORDER BY rowid LIMIT 1",
          )
          .get() as Row | undefined;
        if (!row) return null;
        const attempt =
          (
            db
              .prepare(
                "SELECT coalesce(max(attempt_no), 0) AS n FROM attempts WHERE job_id = ?",
              )
              .get(row.job_id) as { n: number }
          ).n + 1;
        const interruptions = (
          db
            .prepare(
              "SELECT count(*) AS n FROM attempts WHERE job_id = ? AND error = ?",
            )
            .get(row.job_id, INTERRUPTED) as { n: number }
        ).n;
        if (interruptions >= MAX_INTERRUPTIONS) {
          assertAndApplyJobState(
            db,
            row.job_id,
            "reconciliationRequired",
            () => {
              db.prepare(
                "UPDATE jobs SET state = 'reconciliationRequired', error = 'The job was interrupted too many times.' WHERE job_id = ?",
              ).run(row.job_id);
            },
          );
          this.#setAside.push(row.job_id);
          continue;
        }
        return this.#claimIn(db, row, attempt);
      }
    });
  }

  #claimIn(db: DatabaseSync, row: Row, attempt: number) {
    try {
      transitionYamakanJob(row.job_id, row.state, "preparing");
    } catch (e) {
      if (e instanceof IllegalTransition) return null;
      throw e;
    }
    const moved = db
      .prepare(
        "UPDATE jobs SET state = 'preparing', error = NULL WHERE job_id = ? AND state = 'queued'",
      )
      .run(row.job_id);
    if (moved.changes !== 1) return null;
    db.prepare(
      "INSERT INTO attempts(job_id, attempt_no, generation, state) VALUES (?, ?, ?, 'preparing')",
    ).run(row.job_id, attempt, this.#generation);
    return { row: { ...row, state: "preparing" as JobState }, attempt };
  }

  // Fenced transition: only this generation's attempt may move the job.
  #fenced(jobId: string, attempt: number, fn: (db: DatabaseSync) => void) {
    this.store.transaction((db) => {
      const current = (
        db.prepare("SELECT generation FROM supervisor WHERE id = 1").get() as {
          generation: number;
        }
      ).generation;
      const own = db
        .prepare(
          "SELECT generation FROM attempts WHERE job_id = ? AND attempt_no = ?",
        )
        .get(jobId, attempt) as { generation: number } | undefined;
      if (current !== this.#generation || own?.generation !== this.#generation)
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "This attempt belongs to an earlier service run.",
        );
      fn(db);
    });
  }

  #finish(
    jobId: string,
    attempt: number,
    state: "cancelled" | "failed" | "queued",
    error: string | null,
  ) {
    this.#fenced(jobId, attempt, (db) => {
      assertAndApplyJobState(db, jobId, state, () => {
        db.prepare(
          "UPDATE attempts SET state = ?, error = ? WHERE job_id = ? AND attempt_no = ?",
        ).run(state === "queued" ? "failed" : state, error, jobId, attempt);
        db.prepare(
          "UPDATE jobs SET state = ?, error = ?, progress = ? WHERE job_id = ?",
        ).run(
          state,
          state === "queued" ? null : error,
          state === "queued" ? 0 : (this.#progress.get(jobId) ?? 0),
          jobId,
        );
      });
    });
  }

  async #cleanup(projectId: string, jobId: string, attempt: number) {
    await rm(
      await this.store.file(projectId, "exports", jobId, `attempt-${attempt}`),
      { recursive: true, force: true, maxRetries: 3 },
    ).catch(() => {});
  }

  // The worker's identity is durable before it may run.
  #markRunning(jobId: string, attempt: number, pid: number) {
    this.#fenced(jobId, attempt, (db) => {
      // CAS is authoritative when cancel wins the race; do not assert first.
      const moved = db
        .prepare(
          "UPDATE jobs SET state = 'running' WHERE job_id = ? AND state = 'preparing' AND cancel_requested = 0",
        )
        .run(jobId);
      if (moved.changes === 1)
        transitionYamakanJob(jobId, "preparing", "running");
      else {
        // YU-026d: a later worker of the same attempt (a segmented export
        // starts one per window, the sound and the join) starts only while
        // the job is still running and no cancel was asked for.
        const job = db
          .prepare("SELECT state, cancel_requested FROM jobs WHERE job_id = ?")
          .get(jobId) as
          { state: string; cancel_requested: number } | undefined;
        if (!job || job.cancel_requested) throw new Error("Cancelled.");
        if (job.state !== "running")
          throw new Error("The export attempt is no longer running.");
      }
      // The attempt records the worker running now; an attempt that already
      // ended (a late worker of an earlier attempt) starts nothing.
      const recorded = db
        .prepare(
          "UPDATE attempts SET state = 'running', pid = ? WHERE job_id = ? AND attempt_no = ? AND state IN ('preparing', 'running')",
        )
        .run(pid, jobId, attempt);
      if (recorded.changes !== 1)
        throw new Error("The export attempt is no longer running.");
    });
  }
  #markValidating(jobId: string, attempt: number) {
    this.#fenced(jobId, attempt, (db) => {
      const moved = db
        .prepare(
          "UPDATE jobs SET state = 'validating' WHERE job_id = ? AND state = 'running' AND cancel_requested = 0",
        )
        .run(jobId);
      if (moved.changes !== 1) throw new Error("Cancelled.");
      transitionYamakanJob(jobId, "running", "validating");
      db.prepare(
        "UPDATE attempts SET state = 'validating' WHERE job_id = ? AND attempt_no = ?",
      ).run(jobId, attempt);
    });
  }
  // Success inside a caller's transaction: fenced, and decided by the
  // database, so a cancellation that won stays won (the caller's whole
  // transaction then rolls back).
  #succeedIn(
    db: DatabaseSync,
    jobId: string,
    attempt: number,
    artifact: string,
    receipt?: { planHash?: string; [detail: string]: unknown },
  ) {
    const current = (
      db.prepare("SELECT generation FROM supervisor WHERE id = 1").get() as {
        generation: number;
      }
    ).generation;
    const own = db
      .prepare(
        "SELECT generation FROM attempts WHERE job_id = ? AND attempt_no = ?",
      )
      .get(jobId, attempt) as { generation: number } | undefined;
    if (current !== this.#generation || own?.generation !== this.#generation)
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "This attempt belongs to an earlier service run.",
      );
    const moved = db
      .prepare(
        "UPDATE jobs SET state = 'succeeded', artifact = ?, plan_hash = ?, progress = 1, error = NULL WHERE job_id = ? AND state = 'validating' AND cancel_requested = 0",
      )
      .run(artifact, receipt?.planHash ?? null, jobId);
    if (moved.changes !== 1) throw new Error("Cancelled.");
    transitionYamakanJob(jobId, "validating", "succeeded");
    db.prepare(
      "UPDATE attempts SET state = 'succeeded', receipt = ? WHERE job_id = ? AND attempt_no = ?",
    ).run(receipt ? JSON.stringify(receipt) : null, jobId, attempt);
  }

  async #execute(row: Row, attempt: number) {
    const jobId = row.job_id;
    const controller = new AbortController();
    this.#controllers.set(jobId, controller);
    const output = { published: null as string | null };
    try {
      await this.#options.fault?.("after-claim", jobId);
      const payload = safeJson(row.payload);
      const derivative = DerivativePayload.safeParse(payload);
      const blender = BlenderPayload.safeParse(payload);
      const track = TrackPayload.safeParse(payload);
      if (row.kind === "blender-render" && blender.success)
        await this.#runBlender(row, attempt, blender.data, controller.signal);
      else if (row.kind === "blender-track" && track.success)
        await this.#runBlenderTrack(
          row,
          attempt,
          track.data,
          controller.signal,
          output,
        );
      else if (
        row.kind === "export" &&
        ExportPayload.safeParse(payload).success
      )
        await this.#runExport(row, attempt, controller.signal, output);
      else if (row.kind === "cfr-derivative" && derivative.success)
        await this.#runDerivative(
          row,
          attempt,
          derivative.data,
          controller.signal,
        );
      // A bad payload never blocks other jobs: it is quarantined as failed.
      else
        this.#finish(
          jobId,
          attempt,
          "failed",
          "Job payload is invalid and was quarantined.",
        );
    } catch (e) {
      // An output that was not registered as the job's artifact, the
      // attempt's staging and an emptied job folder are removed before the
      // terminal state becomes visible.
      if (output.published) {
        await unlink(output.published).catch(() => {});
        output.published = null;
      }
      await this.#cleanup(row.project_id, jobId, attempt);
      await this.#removeEmptyJobFolder(row.project_id, jobId);
      const cancelled = this.store.read(
        (db) => this.#row(db, jobId)?.cancel_requested === 1,
      );
      try {
        if (cancelled) this.#finish(jobId, attempt, "cancelled", null);
        else if (this.#closing)
          // Graceful shutdown: the next start runs this job again.
          this.#finish(jobId, attempt, "queued", "Service stopped.");
        else
          this.#finish(
            jobId,
            attempt,
            "failed",
            toCommandError(e).message.replaceAll(
              this.store.root,
              "[workspace]",
            ),
          );
      } catch {
        // Fenced out: a newer service run owns this job now.
      }
    } finally {
      this.#controllers.delete(jobId);
      this.#progress.delete(jobId);
      await this.#cleanup(row.project_id, jobId, attempt);
      // Removed only when empty: an export's artifact keeps its folder.
      await this.#removeEmptyJobFolder(row.project_id, jobId);
      await this.#release(jobId);
    }
  }

  // A conversion that ended without success releases the staged original it
  // was holding; it never joined the project, so nothing else refers to it.
  async #release(jobId: string) {
    try {
      const row = this.store.read((db) => this.#row(db, jobId));
      if (
        row?.kind !== "cfr-derivative" ||
        !["failed", "cancelled"].includes(row.state)
      )
        return;
      const payload = DerivativePayload.safeParse(safeJson(row.payload));
      if (payload.success)
        await this.store.discardStagedVersion(
          row.project_id,
          payload.data.asset.id,
        );
    } catch {
      // Left for the T9 garbage collector.
    }
  }

  async #runExport(
    row: Row,
    attempt: number,
    signal: AbortSignal,
    output: { published: string | null },
  ) {
    const jobId = row.job_id;
    // The plan is compiled from the frozen revision's stored snapshot; the
    // render draws only what the plan says.
    const exportPayload = ExportPayload.parse(safeJson(row.payload));
    const { output: partial, receipt } = await renderRevision(
      this.store,
      row.project_id,
      row.frozen_revision,
      ["exports", jobId, `attempt-${attempt}`],
      signal,
      (value) => this.#progress.set(jobId, value),
      (pid) => this.#markRunning(jobId, attempt, pid),
      {
        normalizeLoudness: exportPayload.normalizeLoudness === true,
        output: exportPayload.variant
          ? {
              width: exportPayload.variant.width,
              height: exportPayload.variant.height,
            }
          : undefined,
      },
    );
    this.#markValidating(jobId, attempt);
    await this.#options.fault?.("before-publish", jobId);
    const target = await this.store.file(
      row.project_id,
      "exports",
      jobId,
      `render-${attempt}.mp4`,
    );
    await rename(partial, target);
    output.published = target;
    await this.#options.fault?.("after-publish", jobId);
    await this.#cleanup(row.project_id, jobId, attempt);
    await this.#options.fault?.("before-succeed", jobId);
    this.store.transaction((db) =>
      this.#succeedIn(
        db,
        jobId,
        attempt,
        `exports/${jobId}/render-${attempt}.mp4`,
        receipt,
      ),
    );
    output.published = null;
  }

  // Converts a variable-frame-rate source into a constant-rate mezzanine and
  // attaches it as the asset's selected version. The original object stays
  // retained; the derivative version records its lineage. Attachment and the
  // job's success commit in one transaction.
  async #runBlender(
    row: Row,
    attempt: number,
    payload: z.output<typeof BlenderPayload>,
    signal: AbortSignal,
  ) {
    const jobId = row.job_id;
    const scene = payload.scene;
    const runtime = await blenderRuntime();
    if (!runtime.available)
      throw new CommandError("CAPABILITY_UNAVAILABLE", runtime.message);
    // The whole install, not only blender.exe: its listing and the code Windows runs, every
    // time; every byte once a day (core/blender/runtime.ts).
    const broken = await verifyBlenderForRun(runtime.install);
    if (broken) throw new CommandError("CAPABILITY_UNAVAILABLE", broken);
    const dir = await this.store.file(
      row.project_id,
      "exports",
      jobId,
      `attempt-${attempt}`,
    );
    // Blender writes only its frames folder and FFmpeg only its own; the scene description and
    // the published copy stay in the attempt folder, which neither worker can write.
    const frames = path.join(dir, "frames");
    const encoded = path.join(dir, "encoded");
    // Blender reads "#" in an output path as a frame number.
    if (/[#{}]/.test(frames))
      throw new CommandError(
        "CAPABILITY_UNAVAILABLE",
        "The workspace folder's path holds '#', which Blender would read as a frame number; move the workspace to render with Blender.",
      );
    await mkdir(frames, { recursive: true });
    await mkdir(encoded, { recursive: true });
    const sceneFile = path.join(dir, "scene.json");
    await writeFile(sceneFile, JSON.stringify(scene));
    // Room for every frame at full size and the video, above the disk reserve.
    const frameBytes = scene.width * scene.height * 4;
    const modelDigests = blenderSceneModels(scene);
    const need =
      scene.frames * frameBytes * 2 +
      64 * 1024 * 1024 +
      modelDigests.length * DOCUMENT_LIMITS.modelBytes;
    const space = await statfs(dir);
    const free =
      Number(space.bavail) * Number(space.bsize) -
      RESOURCE_POLICY.enforced.diskReserveBytes;
    if (free < need)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Insufficient free disk space for this render.",
      );
    // Each 3D model the scene names: the project's stored copy, its bytes hashed and checked
    // again here, written beside the scene where Blender can read it but not write it.
    // The footage behind a plate, copied like a model: Blender reads it, never writes it.
    const plates = path.join(dir, "plate");
    await mkdir(plates, { recursive: true });
    if (payload.plateAssetId) {
      const { file, asset } = await this.store.assetFile(
        row.project_id,
        payload.plateAssetId,
      );
      if (asset.kind !== "video")
        throw new CommandError("VALIDATION", "A plate's footage is a video.");
      await copyFile(file, path.join(plates, `clip.${asset.extension}`));
    }
    const models = path.join(dir, "models");
    await mkdir(models, { recursive: true });
    const pixelsOf = new Map<string, number>();
    for (const digest of modelDigests) {
      const bytes = await readFile(
        await this.store.cinemaModelFile(row.project_id, digest),
      );
      if (createHash("sha256").update(bytes).digest("hex") !== digest)
        throw new CommandError(
          "RECOVERY_REQUIRED",
          "A 3D model's stored copy does not match its digest; restore a verified backup.",
        );
      pixelsOf.set(digest, checkGlb(bytes).pixels);
      await writeFile(path.join(models, `${digest}.glb`), bytes);
    }
    // Every model object is its own import, so its textures are decoded again: counted each time.
    const pixels = scene.objects.reduce(
      (sum, o) => sum + (o.shape === "model" ? pixelsOf.get(o.model)! : 0),
      0,
    );
    if (pixels > BLENDER_SCENE_LIMITS.maxModelPixels)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "This render's 3D models hold more texture than one render can decode (128 megapixels in all, each model counted every time it is placed).",
      );
    if (signal.aborted) throw new Error("Cancelled.");
    let said = "";
    let refusal = "";
    // Blender's own "Fra:" lines are buffered on a pipe and arrive only at the end; the frames
    // it has written are counted instead, once a second, while it runs. The encode takes the
    // last tenth.
    const counting = setInterval(() => {
      readdir(frames)
        .then((names) => {
          const made = names.filter((n) => /^frame_\d{4}\.png$/.test(n)).length;
          this.#progress.set(jobId, Math.min(0.9, (0.9 * made) / scene.frames));
        })
        .catch(() => {});
    }, 1000);
    const result = await blenderWorkers(runtime.executable)
      .run({
        profile: ENGINE_WORKER_PROFILE,
        executable: runtime.executable,
        args: [
          "-b",
          "--factory-startup",
          // Never run Python a .blend file carries, whatever the preferences say.
          "-Y",
          "--offline-mode",
          "-noaudio",
          "-t",
          String(RESOURCE_POLICY.enforced.renderThreads),
          // A script that cannot load or that raises ends Blender with a failure, not success.
          "--python-exit-code",
          "1",
          "--python",
          BLENDER_SCRIPT,
          "--",
          sceneFile,
          frames,
          models,
          plates,
        ],
        cwd: frames,
        writable: [frames],
        readable: [runtime.install, BLENDER_SCRIPT, sceneFile, models, plates],
        memoryBytes: ENGINE_WORKER_PROFILE.memoryBytes,
        signal,
        stderrLimit: 8000,
        onCreated: (pid) => this.#markRunning(jobId, attempt, pid),
        onStdout: (chunk) => {
          said += chunk.toString("utf8");
          const lines = said.split("\n");
          said = lines.pop() || "";
          if (said.length > PROGRESS_LINE_LIMIT) said = "";
          for (const line of lines) {
            // The script's own word for a scene it refuses, kept for the error.
            const refused = /^YAMAKAN_RENDER_ERROR ([\w .,'-]{1,120})/.exec(
              line,
            );
            if (refused) refusal = refused[1];
          }
        },
      })
      .finally(() => clearInterval(counting));
    if (signal.aborted) throw new Error("Cancelled.");
    if (result.wallExceeded)
      throw new Error("The render passed its time limit and was ended.");
    if (result.code !== 0)
      throw new Error(
        `Blender could not render the scene${refusal ? `: ${refusal}` : ""} (exit ${result.code}).`,
        {
          cause: result.stderr,
        },
      );
    // What it made is checked before anything uses it: its receipt, and exactly the frames asked.
    // Files a worker made are read only if they are plain files of their own (no link, no second
    // name) and of a sensible size.
    const plain = async (file: string, most: number) => {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > most)
        throw new Error(
          "The render left a file that is not what it should be.",
        );
    };
    const receiptFile = path.join(frames, "receipt.json");
    await plain(receiptFile, 4096);
    let receipt: {
      format?: string;
      blender?: string;
      online?: boolean;
      frames?: number;
      width?: number;
      height?: number;
    };
    try {
      receipt = JSON.parse(await readFile(receiptFile, "utf8"));
    } catch {
      throw new Error("The render's receipt does not match the scene.");
    }
    if (
      receipt.format !== "yamakan.blender-receipt/1" ||
      receipt.blender !== BLENDER_PIN.version ||
      receipt.online !== false ||
      receipt.frames !== scene.frames ||
      receipt.width !== scene.width ||
      receipt.height !== scene.height
    )
      throw new Error("The render's receipt does not match the scene.");
    const names = (await readdir(frames)).filter((n) => n !== "receipt.json");
    const expected = Array.from(
      { length: scene.frames },
      (_, i) => `frame_${String(i + 1).padStart(4, "0")}.png`,
    );
    if (
      names.length !== expected.length ||
      expected.some((n) => !names.includes(n))
    )
      throw new Error("The render did not make exactly the frames asked for.");
    // Each frame, before FFmpeg is given read on it: a plain file of its own, no larger than an
    // uncompressed frame and its PNG overhead.
    for (const name of expected)
      await plain(
        path.join(frames, name),
        scene.width * scene.height * 4 + 1024 * 1024,
      );
    const outputCap = Math.min(
      RESOURCE_POLICY.enforced.assetImportBytes,
      Math.floor(free / 2),
    );
    const encode = await workers().run({
      executable: mediaTools().ffmpeg,
      args: [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-threads",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "-protocol_whitelist",
        "file",
        "-codec_whitelist",
        "png",
        "-f",
        "image2",
        "-framerate",
        String(scene.fps),
        "-i",
        path.join(frames, "frame_%04d.png"),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-fs",
        String(outputCap),
        "encoded/render.mp4",
      ],
      cwd: dir,
      writable: [encoded],
      readable: [frames],
      memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
      signal,
      stderrLimit: 8000,
    });
    if (signal.aborted) throw new Error("Cancelled.");
    if (encode.code !== 0)
      throw new Error(
        `FFmpeg could not encode the render (exit ${encode.code}).`,
        {
          cause: encode.stderr,
        },
      );
    await plain(
      path.join(encoded, "render.mp4"),
      RESOURCE_POLICY.enforced.assetImportBytes,
    );
    const file = path.join(dir, "render.mp4");
    await rename(path.join(encoded, "render.mp4"), file);
    const probed = await probe(file);
    if (
      !probed.hasVideo ||
      probed.width !== scene.width ||
      probed.height !== scene.height ||
      // The probe counts thirtieths of a second.
      Math.abs(
        probed.durationFrames - Math.round((scene.frames / scene.fps) * 30),
      ) > 2
    )
      throw new Error("The encoded render failed verification.");
    this.#markValidating(jobId, attempt);
    const bytes = (await open(file, "r").then(async (h) => {
      try {
        return (await h.stat()).size;
      } finally {
        await h.close();
      }
    })) as number;
    const staged = await this.store.stageAsset(
      row.project_id,
      `${payload.name}.mp4`,
      createReadStream(file) as AsyncIterable<Uint8Array>,
      bytes,
    );
    await this.#cleanup(row.project_id, jobId, attempt);
    try {
      await this.#options.fault?.("before-succeed", jobId);
      await this.store.attachAsset(row.project_id, staged.asset, (db) =>
        this.#succeedIn(db, jobId, attempt, `asset:${staged.asset.id}`),
      );
    } catch (e) {
      await this.store.discardStagedVersion(row.project_id, staged.asset.id);
      throw e;
    }
  }

  // Queues a Blender render of a scene. The made video joins the project as a new asset only
  // when the render, its encode and their checks have all succeeded.
  async submitBlenderRender(
    projectId: string,
    scene: unknown,
    name: string,
    // The tracked video behind a plate (match-move), when the scene has one.
    plateAssetId?: string,
  ) {
    if (this.#closing) throw new Error("Render queue is closing.");
    if (!this.#generation) await this.start();
    this.#current();
    const project = await this.store.load(projectId);
    const payload = BlenderPayload.parse({
      format: "blender/1",
      scene,
      name,
      ...(plateAssetId ? { plateAssetId } : {}),
    });
    if (payload.plateAssetId) {
      const footage = project.assets.find((a) => a.id === payload.plateAssetId);
      if (!footage || footage.kind !== "video")
        throw new CommandError(
          "NOT_FOUND",
          "This project holds no such video for the plate.",
        );
    }
    // A model the project does not hold is refused now, not when the render starts.
    for (const digest of blenderSceneModels(payload.scene))
      await this.store.cinemaModelFile(projectId, digest);
    const key = `blender-${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32)}`;
    const row = this.store.transaction((db) => {
      this.#currentIn(db);
      const existing = db
        .prepare(
          "SELECT * FROM jobs WHERE project_id = ? AND kind = 'blender-render' AND frozen_revision = ? AND idempotency_key = ?",
        )
        .get(projectId, project.revision, key) as Row | undefined;
      // The same render asked again while it runs is that render.
      if (
        existing &&
        existing.state !== "failed" &&
        existing.state !== "cancelled" &&
        existing.state !== "succeeded"
      )
        return existing;
      const active = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (active >= RESOURCE_POLICY.enforced.activeJobs)
        throw new CommandError("LIMIT_EXCEEDED", "Too many active jobs.");
      const rendering = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE kind IN ('blender-render', 'blender-track') AND state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (rendering >= BLENDER_RENDERS_AT_ONCE)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "A Blender render is already running; wait for it or cancel it.",
        );
      const jobId = randomUUID();
      db.prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'blender-render', ?, ?, ?, ?, 'queued')",
      ).run(
        jobId,
        projectId,
        project.revision,
        existing ? `${key}-${jobId.slice(0, 8)}` : key,
        JSON.stringify(payload),
      );
      return this.#row(db, jobId)!;
    });
    this.#pump();
    return this.#view(row);
  }

  // Queues a camera track of one of the project's videos. It shares Blender's one slot with
  // renders. The result is the job's artifact, read back with trackResult.
  async submitBlenderTrack(projectId: string, assetId: string, lens: unknown) {
    if (this.#closing) throw new Error("Render queue is closing.");
    if (!this.#generation) await this.start();
    this.#current();
    const project = await this.store.load(projectId);
    const payload = TrackPayload.parse({
      format: "blender-track/1",
      assetId,
      lens,
    });
    const asset = project.assets.find((a) => a.id === payload.assetId);
    if (!asset)
      throw new CommandError("NOT_FOUND", "This project holds no such video.");
    if (asset.kind !== "video")
      throw new CommandError("VALIDATION", "Only a video can be tracked.");
    if (
      asset.width > BLENDER_TRACK_LIMITS.maxWidth ||
      asset.height > BLENDER_TRACK_LIMITS.maxHeight
    )
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `Tracking takes videos up to ${BLENDER_TRACK_LIMITS.maxWidth} x ${BLENDER_TRACK_LIMITS.maxHeight}.`,
      );
    // A video far longer than any trackable clip is refused before it is copied: by its length in
    // seconds (720 frames is 60 s even at 12 fps), whatever the project's frame rate. The script
    // counts the clip's own frames exactly.
    if (
      framesToSeconds(asset.durationFrames, frameRateOf(project)) >
      BLENDER_TRACK_LIMITS.maxFrames / 12
    )
      throw new CommandError(
        "LIMIT_EXCEEDED",
        `Tracking takes clips of at most ${BLENDER_TRACK_LIMITS.maxFrames} frames and 60 seconds.`,
      );
    const key = `blender-track-${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32)}`;
    const row = this.store.transaction((db) => {
      this.#currentIn(db);
      const existing = db
        .prepare(
          "SELECT * FROM jobs WHERE project_id = ? AND kind = 'blender-track' AND frozen_revision = ? AND idempotency_key = ?",
        )
        .get(projectId, project.revision, key) as Row | undefined;
      if (
        existing &&
        existing.state !== "failed" &&
        existing.state !== "cancelled" &&
        existing.state !== "succeeded"
      )
        return existing;
      const active = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (active >= RESOURCE_POLICY.enforced.activeJobs)
        throw new CommandError("LIMIT_EXCEEDED", "Too many active jobs.");
      const busy = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE kind IN ('blender-render', 'blender-track') AND state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (busy >= BLENDER_RENDERS_AT_ONCE)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Blender is already working; wait for it or cancel it.",
        );
      const jobId = randomUUID();
      db.prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'blender-track', ?, ?, ?, ?, 'queued')",
      ).run(
        jobId,
        projectId,
        project.revision,
        existing ? `${key}-${jobId.slice(0, 8)}` : key,
        JSON.stringify(payload),
      );
      return this.#row(db, jobId)!;
    });
    this.#pump();
    return this.#view(row);
  }

  // A finished track of the project and the video it tracked: what a plate is made from.
  async trackFootage(
    projectId: string,
    jobId: string,
  ): Promise<{ track: CameraTrack; assetId: string }> {
    const track = await this.trackResult(projectId, jobId);
    const row = this.store.transaction((db) => this.#row(db, jobId))!;
    const payload = TrackPayload.parse(safeJson(row.payload));
    return { track, assetId: payload.assetId };
  }

  // The solved camera of a finished track, checked again as it is read.
  async trackResult(projectId: string, jobId: string): Promise<CameraTrack> {
    const row = this.store.transaction((db) => this.#row(db, jobId));
    if (!row || row.kind !== "blender-track" || row.project_id !== projectId)
      throw new CommandError("NOT_FOUND", "No such camera track.");
    if (row.state !== "succeeded" || !row.artifact)
      throw new CommandError("BUSY", "This camera track has not finished.");
    if (!/^exports\/[0-9a-f-]{36}\/track-\d{1,3}\.json$/.test(row.artifact))
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "This camera track's result is not where it should be.",
      );
    const file = await this.store.file(
      row.project_id,
      ...(row.artifact.split("/") as [string, ...string[]]),
    );
    const stat = await lstat(file).catch(() => null);
    if (
      !stat?.isFile() ||
      stat.nlink !== 1 ||
      stat.size > BLENDER_TRACK_LIMITS.resultBytes
    )
      throw new CommandError(
        "RECOVERY_REQUIRED",
        "This camera track's result is missing or damaged.",
      );
    return CameraTrackSchema.parse(JSON.parse(await readFile(file, "utf8")));
  }

  // Tracks a video with the Blender worker: the project's stored file is copied into the attempt
  // folder (Blender reads it, never writes it), the fixed tracking script runs inside procd, and
  // the solved cameras it writes are checked before they become the job's artifact.
  async #runBlenderTrack(
    row: Row,
    attempt: number,
    payload: z.output<typeof TrackPayload>,
    signal: AbortSignal,
    output: { published: string | null },
  ) {
    const jobId = row.job_id;
    const runtime = await blenderRuntime();
    if (!runtime.available)
      throw new CommandError("CAPABILITY_UNAVAILABLE", runtime.message);
    const broken = await verifyBlenderForRun(runtime.install);
    if (broken) throw new CommandError("CAPABILITY_UNAVAILABLE", broken);
    const { file: source, asset } = await this.store.assetFile(
      row.project_id,
      payload.assetId,
    );
    if (asset.kind !== "video")
      throw new CommandError("VALIDATION", "Only a video can be tracked.");
    const dir = await this.store.file(
      row.project_id,
      "exports",
      jobId,
      `attempt-${attempt}`,
    );
    const input = path.join(dir, "input");
    const out = path.join(dir, "out");
    await mkdir(input, { recursive: true });
    await mkdir(out, { recursive: true });
    const space = await statfs(dir);
    const free =
      Number(space.bavail) * Number(space.bsize) -
      RESOURCE_POLICY.enforced.diskReserveBytes;
    if (free < asset.bytes + 64 * 1024 * 1024)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Insufficient free disk space for this track.",
      );
    const clip = path.join(input, `clip.${asset.extension}`);
    await copyFile(source, clip);
    const settingsFile = path.join(dir, "track-settings.json");
    await writeFile(
      settingsFile,
      JSON.stringify({
        format: "yamakan.blender-track/1",
        focalLengthMm: payload.lens.focalLengthMm,
        sensorWidthMm: payload.lens.sensorWidthMm,
        maxFrames: BLENDER_TRACK_LIMITS.maxFrames,
        maxWidth: BLENDER_TRACK_LIMITS.maxWidth,
        maxHeight: BLENDER_TRACK_LIMITS.maxHeight,
        maxErrorPixels: BLENDER_TRACK_LIMITS.maxErrorPixels,
        minTracks: BLENDER_TRACK_LIMITS.minTracks,
      }),
    );
    if (signal.aborted) throw new Error("Cancelled.");
    this.#progress.set(jobId, 0.1);
    let said = "";
    let refusal = "";
    const result = await blenderWorkers(runtime.executable).run({
      profile: ENGINE_WORKER_PROFILE,
      executable: runtime.executable,
      args: [
        "-b",
        "--factory-startup",
        "-Y",
        "--offline-mode",
        "-noaudio",
        "-t",
        String(RESOURCE_POLICY.enforced.renderThreads),
        "--python-exit-code",
        "1",
        "--python",
        BLENDER_TRACK_SCRIPT,
        "--",
        settingsFile,
        clip,
        out,
      ],
      cwd: out,
      writable: [out],
      readable: [runtime.install, BLENDER_TRACK_SCRIPT, settingsFile, input],
      memoryBytes: ENGINE_WORKER_PROFILE.memoryBytes,
      signal,
      stderrLimit: 8000,
      onCreated: (pid) => this.#markRunning(jobId, attempt, pid),
      onStdout: (chunk) => {
        said += chunk.toString("utf8");
        const lines = said.split("\n");
        said = lines.pop() || "";
        if (said.length > PROGRESS_LINE_LIMIT) said = "";
        for (const line of lines) {
          const refused = /^YAMAKAN_TRACK_ERROR ([\w .,'():;/"%-]{1,160})/.exec(
            line,
          );
          if (refused) refusal = refused[1];
        }
      },
    });
    if (signal.aborted) throw new Error("Cancelled.");
    if (result.wallExceeded)
      throw new Error("The track passed its time limit and was ended.");
    if (result.code !== 0)
      throw new Error(
        `Blender could not track the video${refusal ? `: ${refusal}` : ""} (exit ${result.code}).`,
        { cause: result.stderr },
      );
    this.#markValidating(jobId, attempt);
    // What the worker made is read only as plain files of their own, of a sensible size.
    const plain = async (file: string, most: number) => {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > most)
        throw new Error("The track left a file that is not what it should be.");
    };
    const receiptFile = path.join(out, "receipt.json");
    const trackFile = path.join(out, "track.json");
    await plain(receiptFile, 4096);
    await plain(trackFile, BLENDER_TRACK_LIMITS.resultBytes);
    const receipt = JSON.parse(await readFile(receiptFile, "utf8")) as {
      format?: string;
      blender?: string;
      online?: boolean;
    };
    if (
      receipt.format !== "yamakan.blender-receipt/1" ||
      receipt.blender !== BLENDER_PIN.version ||
      receipt.online !== false
    )
      throw new Error("The track's receipt does not match the pinned Blender.");
    let track: CameraTrack;
    try {
      track = CameraTrackSchema.parse(
        JSON.parse(await readFile(trackFile, "utf8")),
      );
    } catch {
      throw new Error("The track's result is not a valid camera track.");
    }
    const target = await this.store.file(
      row.project_id,
      "exports",
      jobId,
      `track-${attempt}.json`,
    );
    // Owned by the job until it succeeds: removed if anything after this fails or is cancelled.
    output.published = target;
    await writeFile(target, JSON.stringify(track));
    await this.#cleanup(row.project_id, jobId, attempt);
    this.store.transaction((db) =>
      this.#succeedIn(
        db,
        jobId,
        attempt,
        `exports/${jobId}/track-${attempt}.json`,
        {
          tracks: track.tracks,
          averageErrorPixels: track.averageErrorPixels,
          cameras: track.cameras.length,
        },
      ),
    );
    output.published = null;
  }

  async #runDerivative(
    row: Row,
    attempt: number,
    payload: z.output<typeof DerivativePayload>,
    signal: AbortSignal,
  ) {
    const jobId = row.job_id;
    const asset = payload.asset;
    const source = await this.store.objectFile(row.project_id, asset);
    const dir = await this.store.file(
      row.project_id,
      "exports",
      jobId,
      `attempt-${attempt}`,
    );
    // The worker writes only its own subfolder; the service keeps its copy
    // in the attempt folder, which the worker could never write.
    const work = path.join(dir, "worker");
    await mkdir(work, { recursive: true });
    // The asset counts frames at its project's rate (YU-019).
    const rate = frameRateOf(await this.store.load(row.project_id));
    const length = framesToSeconds(asset.durationFrames, rate);
    const seconds = Math.max(1, length);
    let progress = "";
    if (signal.aborted) throw new Error("Cancelled.");
    // The conversion and its published copy share the space above the
    // import reserve; FFmpeg stops writing at that size (-fs).
    const space = await statfs(dir);
    const outputCap = Math.min(
      RESOURCE_POLICY.enforced.assetImportBytes,
      Math.floor(
        (Number(space.bavail) * Number(space.bsize) -
          RESOURCE_POLICY.enforced.diskReserveBytes) /
          2,
      ),
    );
    if (outputCap < 16 * 1024 * 1024)
      throw new CommandError(
        "LIMIT_EXCEEDED",
        "Insufficient free disk space for the conversion.",
      );
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, RESOURCE_POLICY.enforced.conversionWallSeconds * 1000);
    const result = await workers()
      .run({
        executable: mediaTools().ffmpeg,
        args: [
          "-hide_banner",
          "-nostdin",
          "-y",
          "-threads",
          String(RESOURCE_POLICY.enforced.renderThreads),
          "-protocol_whitelist",
          "file",
          "-format_whitelist",
          MEDIA_FORMATS,
          "-codec_whitelist",
          MEDIA_DECODERS,
          "-i",
          source,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          // libx264 4:2:0 needs even dimensions; FFmpeg has already applied
          // any display rotation, so these are the upright dimensions.
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-fps_mode",
          "cfr",
          "-r",
          `${payload.frameRate.num}/${payload.frameRate.den}`,
          // Constant-rate filling can hold the last frame past the source's
          // recorded duration; the asset keeps the duration it was probed with.
          "-t",
          String(length),
          "-c:v",
          "libx264",
          // The decoder's thread count is set before -i; the encoder's here.
          "-threads",
          String(RESOURCE_POLICY.enforced.renderThreads),
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
          "-fs",
          String(outputCap),
          "-progress",
          "pipe:1",
          "worker/derivative.mp4",
        ],
        cwd: dir,
        writable: [work],
        // The conversion may read only its source.
        readable: [source],
        memoryBytes: RESOURCE_POLICY.enforced.renderMemoryBytes,
        signal: controller.signal,
        stderrLimit: 8000,
        onCreated: (pid) => this.#markRunning(jobId, attempt, pid),
        onStdout: (chunk) => {
          progress += chunk.toString("utf8");
          const lines = progress.split("\n");
          progress = lines.pop() || "";
          // A progress line is short: one with no end is not kept growing.
          if (progress.length > PROGRESS_LINE_LIMIT) progress = "";
          for (const line of lines) {
            const match = /^out_time_us=(\d+)/.exec(line);
            if (match)
              this.#progress.set(
                jobId,
                Math.min(0.99, Number(match[1]) / 1e6 / seconds),
              );
          }
        },
      })
      .finally(() => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
      });
    if (signal.aborted) throw new Error("Cancelled.");
    if (timedOut) throw new Error("Conversion time limit exceeded.");
    if (result.code !== 0)
      throw new Error(
        `FFmpeg failed to convert the source (exit ${result.code}).`,
        { cause: result.stderr },
      );
    // Probed and imported from the service's own copy of the main stream.
    const file = path.join(dir, "derivative.mp4");
    await keepMainStream(path.join(work, "derivative.mp4"), file);
    const probed = await probe(file);
    if (
      !probed.hasVideo ||
      probed.variableFrameRate ||
      probed.width !== even(asset.width) ||
      probed.height !== even(asset.height) ||
      // The probe counts thirtieths of a second.
      Math.abs(probed.durationFrames - Math.round(length * 30)) > 2
    )
      throw new Error("Converted output failed verification.");
    this.#markValidating(jobId, attempt);
    // Held from before the copy is written until its rows commit (or it is
    // discarded), so no concurrent discard can remove the same bytes.
    const publication = await this.store.beginPublication(row.project_id);
    try {
      await this.#publishDerivative(row, attempt, asset, file, probed, () =>
        publication(),
      );
    } finally {
      publication();
    }
  }

  async #publishDerivative(
    row: Row,
    attempt: number,
    asset: Asset,
    file: string,
    probed: Awaited<ReturnType<typeof probe>>,
    endPublication: () => void,
  ) {
    const jobId = row.job_id;
    // The handle opens eagerly and closes before the attempt folder is
    // removed, so no deferred open can race that cleanup.
    const handle = await open(file, "r");
    let stored;
    try {
      stored = await this.store.importObject(
        row.project_id,
        handle.createReadStream({
          autoClose: false,
        }) as AsyncIterable<Uint8Array>,
      );
    } finally {
      await handle.close();
    }
    // The derivative joins the project as its own version, so an asset id is
    // always the version bound to its bytes; lineage names the original.
    // Its frames are counted at the project's rate (YU-019).
    const rate = frameRateOf(await this.store.load(row.project_id));
    const derived = AssetSchema.parse({
      ...asset,
      id: randomUUID(),
      extension: "mp4",
      hash: stored.sha256,
      bytes: stored.byteLength,
      width: probed.width,
      height: probed.height,
      durationFrames: durationFramesAt(probed.durationTicks, rate),
    });
    await this.#cleanup(row.project_id, jobId, attempt);
    try {
      await this.#options.fault?.("before-succeed", jobId);
      await this.#attachDerivative(row, attempt, asset, derived, probed);
    } catch (e) {
      // Losing the commit leaves the published copy unregistered; remove it
      // unless another publication or row now shares those bytes.
      endPublication();
      await this.store.discardUnregisteredObject(row.project_id, derived.hash);
      throw e;
    }
  }

  #attachDerivative(
    row: Row,
    attempt: number,
    asset: Asset,
    derived: Asset,
    probed: Awaited<ReturnType<typeof probe>>,
  ) {
    return this.store.attachAsset(row.project_id, derived, (db) => {
      ProjectStore.registerDerivative(
        db,
        row.project_id,
        { id: derived.id, hash: derived.hash, bytes: derived.bytes },
        {
          format: probed.format,
          width: probed.width,
          height: probed.height,
          timebase: probed.timebase,
          frameRate: probed.frameRate,
          variableFrameRate: false,
          derivedFrom: { versionId: asset.id, digest: asset.hash },
          conversion: "cfr/1",
        },
      );
      this.#succeedIn(db, row.job_id, attempt, `asset:${derived.id}`);
    });
  }

  // Queues the constant-rate conversion of a staged variable-frame-rate
  // source. The asset joins the project only when the conversion succeeds.
  async submitDerivative(
    projectId: string,
    staged: {
      asset: Asset;
      probe: {
        frameRate: { num: number; den: number } | null;
        averageFrameRate?: { num: number; den: number } | null;
      };
    },
  ) {
    if (this.#closing) throw new Error("Render queue is closing.");
    if (!this.#generation) await this.start();
    this.#current();
    const project = await this.store.load(projectId);
    const payload = DerivativePayload.parse({
      format: "cfr/1",
      asset: staged.asset,
      frameRate: standardRate(
        staged.probe.frameRate,
        staged.probe.averageFrameRate ?? null,
      ),
    });
    // Each upload stages its own version, so each gets its own conversion.
    const key = `cfr-${staged.asset.id}`;
    const row = this.store.transaction((db) => {
      this.#currentIn(db);
      const existing = db
        .prepare(
          "SELECT * FROM jobs WHERE project_id = ? AND kind = 'cfr-derivative' AND idempotency_key = ?",
        )
        .get(projectId, key) as Row | undefined;
      if (
        existing &&
        existing.state !== "failed" &&
        existing.state !== "cancelled"
      )
        return existing;
      const active = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE state NOT IN (${terminalSql})`,
          )
          .get() as { n: number }
      ).n;
      if (active >= RESOURCE_POLICY.enforced.activeJobs)
        throw new CommandError("LIMIT_EXCEEDED", "Too many active jobs.");
      // Conversions are long; a few per project leave room for exports.
      const converting = (
        db
          .prepare(
            `SELECT count(*) AS n FROM jobs WHERE project_id = ? AND kind = 'cfr-derivative' AND state NOT IN (${terminalSql})`,
          )
          .get(projectId) as { n: number }
      ).n;
      if (converting >= RESOURCE_POLICY.enforced.activeConversionsPerProject)
        throw new CommandError(
          "LIMIT_EXCEEDED",
          "Too many conversions are in progress for this project.",
        );
      const jobId = randomUUID();
      db.prepare(
        "INSERT INTO jobs(job_id, kind, project_id, frozen_revision, idempotency_key, payload, state) VALUES (?, 'cfr-derivative', ?, ?, ?, ?, 'queued')",
      ).run(
        jobId,
        projectId,
        project.revision,
        existing ? `${key}-${jobId.slice(0, 8)}` : key,
        JSON.stringify(payload),
      );
      return this.#row(db, jobId)!;
    });
    this.#pump();
    return this.#view(row);
  }

  // Inside a submission transaction: a newer service run has taken the
  // queue, so this supervisor would queue work it never runs.
  #currentIn(db: DatabaseSync) {
    const { generation } = db
      .prepare("SELECT generation FROM supervisor WHERE id = 1")
      .get() as { generation: number };
    if (this.#generation && generation !== this.#generation)
      this.#superseded = true;
    this.#current();
  }
  // Removes an emptied job folder unless a newer service run owns the
  // queue: that run may be creating its own attempt folder inside it.
  async #removeEmptyJobFolder(projectId: string, jobId: string) {
    const owned = this.store.read(
      (db) =>
        (
          db
            .prepare("SELECT generation FROM supervisor WHERE id = 1")
            .get() as {
            generation: number;
          }
        ).generation === this.#generation,
    );
    if (owned)
      await rmdir(await this.store.file(projectId, "exports", jobId)).catch(
        () => {},
      );
  }
  #current() {
    if (this.#superseded)
      throw new CommandError(
        "UNAVAILABLE",
        "A newer service run owns the job queue.",
      );
  }

  // Stops claiming work, terminates running workers and waits for the loop.
  async close() {
    this.#closing = true;
    for (const controller of this.#controllers.values()) controller.abort();
    await this.#loop;
  }
}

const even = (n: number) => n - (n % 2);

// Constant-rate targets: the nearest common rate to the source's rate. The
// nominal rate is used when plausible (it keeps every frame of a source that
// pauses); a nominal above 60 is often a time base or a peak (120 for 60 fps
// phone video), so the measured average is used instead, capped at 60, and
// anything unusable becomes 30. A 90000/1 tag never becomes the output rate.
const RATES = [
  [24000, 1001],
  [24, 1],
  [25, 1],
  [30000, 1001],
  [30, 1],
  [48, 1],
  [50, 1],
  [60000, 1001],
  [60, 1],
] as const;
type Rate = { num: number; den: number } | null;
const rateValue = (rate: Rate) =>
  rate && rate.den > 0 && rate.num > 0 ? rate.num / rate.den : 0;
function standardRate(nominal: Rate, average: Rate = null) {
  const declared = rateValue(nominal);
  const measured = rateValue(average);
  const target =
    declared > 0 && declared <= 60
      ? declared
      : measured > 0 && measured <= 120
        ? Math.min(measured, 60)
        : 30;
  const [num, den] = RATES.reduce((best, r) =>
    Math.abs(r[0] / r[1] - target) < Math.abs(best[0] / best[1] - target)
      ? r
      : best,
  );
  return { num, den };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
