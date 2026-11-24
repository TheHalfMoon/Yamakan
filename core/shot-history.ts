// What was tried for one shot and what it cost (MPR-107): the takes it holds and how each was
// made, every generation or render attempted for it, the take replacements applied to it, and
// totals. Read from rows and documents that other things write; nothing here is estimated, and
// what a row does not say is null or a named gap. It takes no words from a run's or a record's
// prompt; a shot's name, a take's label and an engine's own message are given as they are, and a
// person or an engine may have put some there.
import type { DatabaseSync } from "node:sqlite";
import { CommandError } from "./command/errors.ts";
import { diagnostic as safeDiagnostic } from "./engines/contract-v2.ts";
import type { GenerationRecord } from "./engines/generation.ts";
import type { CanonicalProject } from "./canonical.ts";
import type { DocumentRef } from "./document-ref.ts";
import type { StoryDocument } from "./story.ts";
import {
  TAKE_REPLACEMENT_BYTES,
  TakeReplacementSchema,
  type TakeRecord,
  type TakeReplacement,
} from "./take-record.ts";
import { Id } from "./project.ts";
import { listTakes } from "./takes.ts";
import { canonicalJson } from "./hash/canonical.ts";
import { shotAttemptRows, type AttemptRow } from "./jobs.ts";

export const SHOT_HISTORY_LIMITS = Object.freeze({
  attempts: 100,
  defaultAttempts: 50,
  replacements: 32,
  answerBytes: 128 * 1024,
  jobRowsScanned: 5000,
  notesScanned: 2000,
  noteBytes: TAKE_REPLACEMENT_BYTES,
  diagnosticChars: 200,
});

export { TakeReplacementSchema, type TakeReplacement };

export type Outcome =
  "running" | "succeeded" | "failed" | "cancelled" | "uncertain";

/** How a generation stands, from its row. One that may have left and says no more is uncertain. */
export function generationOutcome(
  row: Pick<GenerationRecord, "state" | "phase" | "cancelled" | "imported"> & {
    executionRef?: string | null;
    held?: boolean;
  },
): Outcome {
  if (row.imported || row.state === "succeeded") return "succeeded";
  if (row.cancelled || row.state === "cancelled") return "cancelled";
  if (row.state === "failed") return "failed";
  if (
    row.held ||
    row.phase !== "sent" ||
    !row.executionRef ||
    row.state === "unknown"
  )
    return "uncertain";
  return "running";
}

const RENDER_OUTCOME: Readonly<Record<string, Outcome>> = {
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
  reconciliationRequired: "uncertain",
};

const whole = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const text = (v: unknown) => (typeof v === "string" ? v : null);
const idOf = (v: unknown) => {
  const read = Id.safeParse(v);
  return read.success ? read.data : null;
};
// By whole characters.
const short = (v: string, most: number) => {
  let out = "";
  for (const point of v) {
    if (out.length + point.length > most) break;
    out += point;
  }
  return out;
};
const said = (v: unknown) => {
  const told = safeDiagnostic(text(v) ?? undefined);
  return told === undefined
    ? null
    : short(told, SHOT_HISTORY_LIMITS.diagnosticChars);
};

type Attempt = {
  seq: number;
  kind: "generation" | "render";
  id: string;
  route: string | null;
  outcome: Outcome;
  sent: boolean;
  imported: boolean;
  recipeId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  wallMs: number | null;
  quotaSeconds: number | null;
  takeId: string | null;
  takeInShot: boolean;
  derivedFromTakeId: string | null;
  diagnostic: string | null;
};

// The take that each run or render of the shot's present takes made, by its record.
type MadeBy = ReadonlyMap<string, { takeId: string; record: TakeRecord }>;

function attemptOf(
  row: AttemptRow,
  madeBy: MadeBy,
  inShot: ReadonlySet<string>,
): Attempt {
  const made = madeBy.get(row.id);
  const quotaSeconds = made?.record.usage.quotaSeconds ?? null;
  if (row.kind === "render")
    return {
      seq: row.seq,
      kind: "render",
      id: row.id,
      route: "blender",
      outcome: RENDER_OUTCOME[row.state] ?? "running",
      sent: true,
      imported: text(row.artifact)?.startsWith("asset:") ?? false,
      recipeId: null,
      // A render's job keeps no times.
      startedAt: null,
      endedAt: null,
      wallMs: null,
      quotaSeconds,
      takeId: made?.takeId ?? null,
      takeInShot: made !== undefined,
      derivedFromTakeId: null,
      diagnostic: said(row.error),
    };
  // The row as it was stored: what is in it is checked here, and nothing else is believed.
  const g = row.payload as Partial<GenerationRecord>;
  const startedAt = whole(g.startedAt);
  const endedAt = whole(g.endedAt);
  const takeId =
    (g.take?.appended === true ? idOf(g.take.takeId) : null) ??
    made?.takeId ??
    null;
  return {
    seq: row.seq,
    kind: "generation",
    id: row.id,
    route: made?.record.route ?? (g.remote ? "kaggle" : null),
    outcome: generationOutcome({
      state: g.state ?? "unknown",
      phase: g.phase === "sent" ? "sent" : "sending",
      cancelled: g.cancelled === true,
      imported: g.imported ?? null,
      executionRef: text(g.executionRef),
      held: row.state === "reconciliationRequired",
    }),
    sent: !(g.phase !== "sent" && g.state === "failed"),
    imported: Boolean(g.imported),
    recipeId: g.recipe ? short(text(g.recipe.id) ?? "", 80) || null : null,
    startedAt,
    endedAt,
    wallMs:
      startedAt !== null && endedAt !== null
        ? Math.max(0, endedAt - startedAt)
        : null,
    quotaSeconds,
    takeId,
    takeInShot: takeId !== null && inShot.has(takeId),
    derivedFromTakeId: idOf(g.derivedFrom?.takeId),
    diagnostic: said(g.diagnostic),
  };
}

const summaryOf = (record: TakeRecord) => ({
  recipeId: record.recipe?.id ?? null,
  modelId: record.model?.id ?? null,
  operation: record.operation,
  ...(record.request.kind === "generation"
    ? {
        seed: record.request.seed,
        width: record.request.width,
        height: record.request.height,
        durationFrames: record.request.durationFrames,
        fps: record.request.fps,
        steps: record.request.steps,
        promptHash: record.request.promptHash,
      }
    : {
        seed: null,
        width: record.request.width,
        height: record.request.height,
        durationFrames: record.request.frames,
        fps: record.request.fps,
        steps: null,
        promptHash: null,
      }),
});

// The story's replacement notes, newest first, and the revision of its first.
function notesOf(db: DatabaseSync, projectId: string, documentId: string) {
  const rows = db
    .prepare(
      "SELECT c.bytes AS bytes, v.revision AS revision FROM story_document_versions v JOIN creative_documents c ON c.hash = v.content_hash WHERE v.project_id = ? AND v.document_id = ? AND c.kind = 'takeReplacement' ORDER BY v.revision DESC LIMIT ?",
    )
    .all(projectId, documentId, SHOT_HISTORY_LIMITS.notesScanned + 1) as {
    bytes: Uint8Array;
    revision: number;
  }[];
  const scanned = rows.slice(0, SHOT_HISTORY_LIMITS.notesScanned);
  return {
    notes: scanned.flatMap(({ bytes }) => {
      try {
        const note = TakeReplacementSchema.safeParse(
          JSON.parse(Buffer.from(bytes).toString("utf8")),
        );
        return note.success && note.data.documentId === documentId
          ? [note.data]
          : [];
      } catch {
        return [];
      }
    }),
    first: scanned.at(-1)?.revision ?? null,
    complete: rows.length <= SHOT_HISTORY_LIMITS.notesScanned,
  };
}

/** One shot's history, a page of attempts at a time. */
export function shotHistory(
  db: DatabaseSync,
  at: {
    projectId: string;
    story: StoryDocument;
    ref: DocumentRef;
    canonical: CanonicalProject;
    readRecord: (recordHash: string) => TakeRecord;
  },
  shotId: string,
  page: { limit?: number; before?: number },
) {
  const { projectId, story, ref } = at;
  const documentId = ref.id;
  const listed = listTakes(story, ref, at.canonical).shots.find(
    (s) => s.shotId === shotId,
  );
  const shot = story.scenes
    .flatMap((sc) => sc.shots)
    .find((s) => s.id === shotId);
  if (!listed || !shot)
    throw new CommandError("NOT_FOUND", "The story has no such shot.");
  const shownTakeId = listed.timeline?.currentTakeId ?? null;

  const addedAt = db.prepare(
    "SELECT min(revision) AS revision FROM story_document_versions WHERE project_id = ? AND document_id = ? AND content_hash = ?",
  );
  const madeBy = new Map<string, { takeId: string; record: TakeRecord }>();
  const takes = shot.takes.map((take, i) => {
    const record =
      take.recordHash === undefined ? null : at.readRecord(take.recordHash);
    const source = record?.source ?? null;
    if (record && source)
      madeBy.set(
        "generationId" in source ? source.generationId : source.jobId,
        { takeId: take.id, record },
      );
    return {
      takeId: take.id,
      kind: listed.takes[i]!.kind,
      label: take.lineage?.label ?? null,
      selected: shot.selectedTakeId === take.id,
      shown: shownTakeId === take.id,
      recordHash: take.recordHash ?? null,
      addedAtRevision:
        take.recordHash === undefined
          ? null
          : (
              addedAt.get(projectId, documentId, take.recordHash) as {
                revision: number | null;
              }
            ).revision,
      origin: record?.origin ?? null,
      route: record?.route ?? null,
      source,
      summary: record ? summaryOf(record) : null,
      timings: record?.timings ?? null,
      usage: record?.usage ?? null,
      derivedFromTakeId: record?.derivedFromTakeId ?? null,
      changedFields: record?.changedFields ?? null,
    };
  });

  const found = shotAttemptRows(
    db,
    projectId,
    { documentId, shotId },
    SHOT_HISTORY_LIMITS.jobRowsScanned,
  );
  const inShot = new Set(shot.takes.map((t) => t.id));
  const all = found.rows.map((row) => attemptOf(row, madeBy, inShot));
  const count = (outcome: Outcome) =>
    all.filter((a) => a.outcome === outcome).length;
  const sum = (of: "wallMs" | "quotaSeconds") =>
    all.reduce((n, a) => n + (a[of] ?? 0), 0);
  const unknown = (of: "wallMs" | "quotaSeconds") =>
    all.filter((a) => a[of] === null).length;

  const {
    notes,
    first,
    complete: notesComplete,
  } = notesOf(db, projectId, documentId);
  const mine = notes.filter((n) => n.shotId === shotId);
  const earlier = db
    .prepare(
      "SELECT 1 FROM revisions WHERE project_id = ? AND operation = 'project.applyBatch' AND revision < ? LIMIT 1",
    )
    .get(projectId, first ?? Number.MAX_SAFE_INTEGER);
  const complete = found.complete && notesComplete;

  const limit = page.limit ?? SHOT_HISTORY_LIMITS.defaultAttempts;
  const rest =
    page.before === undefined ? all : all.filter((a) => a.seq < page.before!);
  const attempts = rest.slice(0, limit);
  const answer = {
    documentId,
    shotId,
    sceneId: listed.sceneId,
    name: listed.name,
    contentHash: ref.contentHash,
    revision: at.canonical.revision,
    current: {
      selectedTakeId: shot.selectedTakeId,
      shownTakeId,
      clips: listed.timeline?.clips ?? [],
    },
    takes,
    attempts,
    next: rest.length > attempts.length ? attempts.at(-1)!.seq : null,
    replacements: mine
      .slice(0, SHOT_HISTORY_LIMITS.replacements)
      .map(({ revision, principalId, fromTakeId, toTakeId, clips }) => ({
        revision,
        principalId,
        fromTakeId,
        toTakeId,
        clips,
      })),
    replacementTotal: mine.length,
    totals: {
      attempts: all.length,
      succeeded: count("succeeded"),
      failed: count("failed"),
      cancelled: count("cancelled"),
      running: count("running"),
      uncertain: count("uncertain"),
      takes: takes.length,
      replacements: mine.length,
      wallMs: sum("wallMs"),
      wallMsUnknown: unknown("wallMs"),
      quotaSeconds: sum("quotaSeconds"),
      quotaUnknown: unknown("quotaSeconds"),
      complete,
    },
    gaps: [
      ...(found.untargeted ? (["untargeted-attempts"] as const) : []),
      ...(found.unlinkedRenders ? (["unlinked-renders"] as const) : []),
      ...(earlier ? (["earlier-replacements"] as const) : []),
      ...(complete ? [] : (["scan-limit"] as const)),
    ],
  };
  // Never more than its bound: the oldest of the page goes to the next one.
  while (
    answer.attempts.length > 1 &&
    Buffer.byteLength(canonicalJson(answer), "utf8") >
      SHOT_HISTORY_LIMITS.answerBytes
  ) {
    answer.attempts = answer.attempts.slice(0, -1);
    answer.next = answer.attempts.at(-1)!.seq;
  }
  return answer;
}
