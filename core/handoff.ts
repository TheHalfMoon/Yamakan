// SS-007: a bounded handoff document, so a person or agent taking over can see
// where a project stands and check later that nothing moved. It is derived from
// committed state on each read and stored nowhere. It names hashes and a next
// action only: presenting one grants nothing, and every command still checks
// the caller's own scopes and the project's current revision.
import { z } from "zod";
import {
  directorNext,
  loadManifestFromAssets,
  loadRun,
} from "./director/runtime.ts";
import { canonicalJson, sha256Hex } from "./hash/canonical.ts";
import type { ProgressView } from "../sdk/progress.ts";
import { readProgress } from "./progress.ts";
import type { ProjectStore } from "./store.ts";

export const HANDOFF_LIMITS = {
  documents: 16,
  reasons: 4,
  reasonLength: 240,
} as const;

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Name = z.string().min(1).max(120);
const DocumentHash = z.object({ documentId: Name, contentHash: Hash }).strict();

// Strict: a field outside this document is refused, so a token or a scope
// cannot travel inside one.
export const HandoffSchema = z
  .object({
    format: z.literal("yamakan.handoff"),
    formatVersion: z.literal(1),
    projectId: Name,
    revision: z.number().int().nonnegative(),
    stories: z.array(DocumentHash).max(HANDOFF_LIMITS.documents),
    references: z.array(DocumentHash).max(HANDOFF_LIMITS.documents),
    documentsTruncated: z.boolean(),
    run: z
      .object({
        runId: Name,
        pipelineName: Name,
        briefHash: Hash.nullable(),
        latestAttempt: z
          .object({
            seq: z.number().int().positive(),
            stage: Name,
            status: Name,
            outputHash: Hash.nullable(),
          })
          .strict()
          .nullable(),
        nextAction: z
          .object({
            kind: Name,
            stage: Name.nullable(),
            reasons: z
              .array(z.string().max(HANDOFF_LIMITS.reasonLength))
              .max(HANDOFF_LIMITS.reasons),
          })
          .strict(),
      })
      .strict()
      .nullable(),
    handoffHash: Hash,
  })
  .strict();
export type Handoff = z.infer<typeof HandoffSchema>;

const BRIEF_ARTIFACT = "research_brief";

export async function readHandoff(
  store: ProjectStore,
  projectId: string,
): Promise<Handoff> {
  // Jobs are left out: a handoff shows what any project reader may see.
  const progress = readProgress(
    store,
    { principalId: "", jobsVisible: false },
    { projectId },
  ) as ProgressView;
  const documents = store.listDocuments(projectId);
  const ofKind = (kind: string) =>
    documents
      .filter((d) => d.kind === kind)
      .slice(0, HANDOFF_LIMITS.documents)
      .map((d) => ({ documentId: d.id, contentHash: d.contentHash }));
  const count = (kind: string) =>
    documents.filter((d) => d.kind === kind).length;
  const newest = progress.runs[0];
  let run: Handoff["run"] = null;
  if (newest) {
    const [loaded, manifest, next] = await Promise.all([
      loadRun(store, newest.runId),
      loadManifestFromAssets(newest.pipelineName),
      directorNext(store, newest.runId),
    ]);
    const briefStage = manifest.stages.find((s) =>
      s.produces?.includes(BRIEF_ARTIFACT),
    );
    const brief = loaded.receipts.find((r) => r.stage === briefStage?.name);
    const last = newest.attempts.at(-1);
    run = {
      runId: newest.runId,
      pipelineName: newest.pipelineName,
      briefHash: brief?.outputHash ?? null,
      latestAttempt: last
        ? {
            seq: last.seq,
            stage: last.stage,
            status: last.status,
            outputHash: last.outputHash,
          }
        : null,
      nextAction: {
        kind: next.kind,
        stage: "stage" in next ? next.stage : null,
        reasons: ("reasons" in next ? next.reasons : [])
          .slice(0, HANDOFF_LIMITS.reasons)
          .map((r) => r.slice(0, HANDOFF_LIMITS.reasonLength)),
      },
    };
  }
  const body = {
    format: "yamakan.handoff" as const,
    formatVersion: 1 as const,
    projectId,
    revision: progress.revision,
    stories: ofKind("story"),
    references: ofKind("referencePack"),
    documentsTruncated:
      count("story") > HANDOFF_LIMITS.documents ||
      count("referencePack") > HANDOFF_LIMITS.documents,
    run,
  };
  return { ...body, handoffHash: sha256Hex(canonicalJson(body)) };
}

// What a person resuming from a handoff needs to know: does it still describe
// the project? A document that fails its own hash was edited, and is not trusted.
export async function checkHandoff(store: ProjectStore, handoff: Handoff) {
  const { handoffHash, ...body } = handoff;
  const intact = sha256Hex(canonicalJson(body)) === handoffHash;
  const now = await readHandoff(store, handoff.projectId);
  const moved = (
    ["revision", "stories", "references", "documentsTruncated", "run"] as const
  ).filter((k) => canonicalJson(handoff[k]) !== canonicalJson(now[k]));
  return {
    intact,
    current: intact && moved.length === 0,
    moved,
    revision: now.revision,
    handoffHash: now.handoffHash,
  };
}
