import { z } from "zod";
import { ProjectSchema, Id } from "../project.ts";
import { BatchSchema } from "../timeline/operations.ts";
import {
  AnimationPathSchema,
  ClipAnimationSchema,
} from "../timeline/animation-schema.ts";
import { Ticks } from "../time.ts";
import { SNAPSHOT_FORMAT } from "../store.ts";
import type { ProjectStore, RequestReceipt } from "../store.ts";
import { canonicalJson, sha256Hex } from "../hash/canonical.ts";
import type { JobSupervisor } from "../jobs.ts";
import { CommandError } from "./errors.ts";
import { RESOURCE_POLICY } from "./policy.ts";
import {
  BackupId,
  backupWorkspace,
  backupWorkspaceIdempotent,
  defaultRecoveryHome,
  listBackups,
  restoreFromHome,
  restoreFromHomeIdempotent,
} from "../recovery.ts";
import { Scene3DSchema, cinemaCapability, saveScene3D } from "../scene3d.ts";
import {
  listCinemaScenes,
  loadCinemaScene,
  persistCinemaScene,
} from "../cinema-store.ts";
import { directorCapability } from "../director-flags.ts";
import {
  StudioDocumentSchema,
  createEmptyStudioDocument,
  saveStudioDocument,
  studioCapability,
} from "../studio.ts";
import { ConsentPurposeSchema } from "../identity.ts";
import {
  advanceStage,
  approveStage,
  directorNext,
  grantConsent,
  loadRun,
  recordEncoding,
  revokeConsentRecord,
  startDirectorRun,
} from "../director/runtime.ts";
import { builtinManifest } from "../director/manifest.ts";
import { FLOW_ENABLED, flowSnapshot } from "../flow/snapshot.ts";
import {
  QualityComparisonSchema,
  comparisonEvidence,
  qualityLabCapability,
  summarizeBlindedComparison,
} from "../quality/lab.ts";
import { explainRoutes } from "../router/explain.ts";
import {
  evaluateReviewIndependenceV1,
  type ReviewLineageV1,
} from "../agents/lineage.ts";

export const RESOURCE_POLICY_HASH = sha256Hex(canonicalJson(RESOURCE_POLICY));

export const API_VERSION = 1;

export const Scopes = [
  "project:read",
  "project:write",
  "project:recover",
  "render:execute",
  "job:read",
  "job:control",
  "agent:create",
  "agent:revoke",
  "director:approve",
  "consent:grant",
  "consent:revoke",
] as const;
export type Scope = (typeof Scopes)[number];

export const HumanOnlyScopes = [
  "agent:create",
  "agent:revoke",
  "director:approve",
  "consent:grant",
  "consent:revoke",
] as const satisfies readonly Scope[];
export type HumanOnlyScope = (typeof HumanOnlyScopes)[number];

const humanOnly = new Set<Scope>(HumanOnlyScopes);

export function assertAgentScopeCeiling(scopes: ReadonlySet<Scope>) {
  for (const scope of scopes)
    if (humanOnly.has(scope))
      throw new CommandError(
        "VALIDATION",
        `Scope ${scope} is reserved for the browser session.`,
      );
}

export function browserScopes(): ReadonlySet<Scope> {
  return new Set(Scopes);
}

export function cliScopes(): ReadonlySet<Scope> {
  return new Set(Scopes.filter((s) => !humanOnly.has(s))) as ReadonlySet<Scope>;
}

// Principals are derived from the authenticated transport, never from the request.
export type Principal = {
  id: "browser-ui" | "local-client" | `agent:${string}`;
  scopes: ReadonlySet<Scope>;
};

export type CommandContext = {
  store: ProjectStore;
  queue: JobSupervisor;
  principal: Principal;
  requestId?: string;
  // Where backups and restored roots go: chosen by the service, never by a
  // request (default: a "-recovery" folder beside the workspace).
  recoveryHome?: string;
};
type RunContext = CommandContext & { receipt?: RequestReceipt };

type Definition<S extends z.ZodType, R> = {
  scope: Scope;
  mutation: boolean;
  humanOnly?: boolean;
  summary: string;
  input: S;
  run: (ctx: RunContext, input: z.output<S>) => Promise<R> | R;
};
const define = <S extends z.ZodType, R>(d: Definition<S, R>) => d;

const home = (ctx: CommandContext) =>
  ctx.recoveryHome ?? defaultRecoveryHome(ctx.store.root);

const revisionFingerprint = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .nullable();

// Every parameter is a strict, bounded schema. No command accepts executable
// text, filtergraphs, shell arguments or host filesystem paths.
export const commands = {
  "yamakan.project.create": define({
    scope: "project:write",
    mutation: true,
    summary: "Create an empty project.",
    input: z.object({ name: z.string().min(1).max(120) }).strict(),
    run: ({ store, receipt }, a) => store.create(a.name, receipt),
  }),
  "yamakan.project.open": define({
    scope: "project:read",
    mutation: false,
    summary: "Read the current head of a project.",
    input: z.object({ projectId: Id }).strict(),
    run: ({ store }, a) => store.load(a.projectId),
  }),
  "yamakan.project.list": define({
    scope: "project:read",
    mutation: false,
    summary: "List projects in the workspace.",
    input: z.object({}).strict(),
    run: ({ store }) => store.list(),
  }),
  "yamakan.project.export": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Export the current revision as canonical project JSON (no host paths or credentials).",
    input: z.object({ projectId: Id }).strict(),
    run: ({ store }, a) => store.exportProject(a.projectId),
  }),
  "yamakan.project.history": define({
    scope: "project:read",
    mutation: false,
    summary: "List the newest retained revisions and verify them.",
    input: z
      .object({
        projectId: Id,
        limit: z.number().int().min(1).max(500).optional(),
        // Page older revisions: list only revisions below this one.
        beforeRevision: z.number().int().min(1).max(10001).optional(),
      })
      .strict(),
    run: ({ store }, a) =>
      store.history(a.projectId, a.limit, a.beforeRevision),
  }),
  "yamakan.project.restore": define({
    scope: "project:recover",
    mutation: true,
    summary: "Restore an older revision as a new head revision.",
    input: z
      .object({
        projectId: Id,
        revision: z.number().int().min(0).max(10000),
        expectedHeadFingerprint: revisionFingerprint,
      })
      .strict(),
    run: ({ store, receipt }, a) =>
      store.restore(
        a.projectId,
        a.revision,
        a.expectedHeadFingerprint,
        receipt,
      ),
  }),
  "yamakan.clip.setSound": define({
    scope: "project:write",
    mutation: true,
    summary: "Toggle or adjust embedded sound on a video clip.",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        enabled: z.boolean().optional(),
        gainDb: z.number().min(-60).max(12).optional(),
        fadeInTicks: Ticks.optional(),
        fadeOutTicks: Ticks.optional(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "clip.setSound",
            clipId: a.clipId,
            enabled: a.enabled,
            gainDb: a.gainDb,
            fadeInTicks: a.fadeInTicks,
            fadeOutTicks: a.fadeOutTicks,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.clip.setSpeed": define({
    scope: "project:write",
    mutation: true,
    summary: "Set a clip's constant retime rate (rational).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        speed: z
          .object({
            num: z.number().int().positive().max(1_000_000),
            den: z.number().int().positive().max(1_000_000),
          })
          .strict(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [{ type: "clip.setSpeed", clipId: a.clipId, speed: a.speed }],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.clip.setAnimation": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Replace or clear a clip's animation channel map (gated by ANIMATION_ENABLED).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        animation: ClipAnimationSchema.nullable(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "clip.setAnimation",
            clipId: a.clipId,
            animation: a.animation,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.clip.upsertAnimationKeyframe": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Insert or update one scalar keyframe on a clip animation path (gated by ANIMATION_ENABLED).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        channel: AnimationPathSchema,
        timeTicks: Ticks,
        value: z.number().finite(),
        easing: z.enum(["step", "linear", "bezier"]).optional(),
        keyId: z.string().min(1).max(80).optional(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "clip.upsertAnimationKeyframe",
            clipId: a.clipId,
            channel: a.channel,
            timeTicks: a.timeTicks,
            value: a.value,
            easing: a.easing,
            keyId: a.keyId,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.clip.unlinkSound": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Unlink a video clip's embedded sound onto an audio track (format v4).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        audioTrackId: Id,
        audioClipId: Id,
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "clip.unlinkSound",
            clipId: a.clipId,
            audioTrackId: a.audioTrackId,
            audioClipId: a.audioClipId,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.clip.relinkSound": define({
    scope: "project:write",
    mutation: true,
    summary: "Relink an unlinked audio clip back into the video clip's sound.",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        audioClipId: Id,
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "clip.relinkSound",
            clipId: a.clipId,
            audioClipId: a.audioClipId,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.timeline.rippleDelete": define({
    scope: "project:write",
    mutation: true,
    summary: "Delete a clip and close the gap (ripple).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [{ type: "timeline.rippleDelete", clipId: a.clipId }],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.timeline.rippleTrim": define({
    scope: "project:write",
    mutation: true,
    summary: "Trim a clip and close the gap (ripple).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        startTicks: Ticks.optional(),
        endTicks: Ticks.optional(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "timeline.rippleTrim",
            clipId: a.clipId,
            startTicks: a.startTicks,
            endTicks: a.endTicks,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.timeline.insert": define({
    scope: "project:write",
    mutation: true,
    summary: "Insert a clip, shifting later clips on the track.",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        clipId: Id,
        trackId: Id,
        assetId: Id.nullable(),
        title: z.string().max(500).nullable(),
        startTicks: Ticks,
        durationTicks: Ticks.min(1),
        sourceStartTicks: Ticks,
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "timeline.insert",
            clipId: a.clipId,
            trackId: a.trackId,
            assetId: a.assetId,
            title: a.title,
            startTicks: a.startTicks,
            durationTicks: a.durationTicks,
            sourceStartTicks: a.sourceStartTicks,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.timeline.groupMove": define({
    scope: "project:write",
    mutation: true,
    summary: "Move a multi-clip selection with optional edge snapping.",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        anchorClipId: Id,
        clipIds: z.array(Id).min(1).max(64),
        anchorStartTicks: Ticks,
        targetTrackId: Id,
        snapTicks: Ticks.max(705_600_000).optional(),
        playheadTicks: Ticks.optional(),
        newTrackIds: z.array(Id).min(1).max(16).optional(),
        anchorInsertIndex: z.number().int().min(0).max(32).optional(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        [
          {
            type: "timeline.groupMove",
            anchorClipId: a.anchorClipId,
            clipIds: a.clipIds,
            anchorStartTicks: a.anchorStartTicks,
            targetTrackId: a.targetTrackId,
            snapTicks: a.snapTicks,
            playheadTicks: a.playheadTicks,
            newTrackIds: a.newTrackIds,
            anchorInsertIndex: a.anchorInsertIndex,
          },
        ],
        principal.id,
        receipt,
      ),
  }),
  "yamakan.project.applyBatch": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Apply up to 64 typed timeline operations atomically as one revision.",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
        operations: BatchSchema,
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.applyOperations(
        a.projectId,
        a.expectedRevision,
        a.operations,
        principal.id,
        receipt,
      ),
  }),
  "yamakan.project.undo": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Undo the last applied batch as a new revision (only from the head it produced).",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.undo(a.projectId, a.expectedRevision, principal.id, receipt),
  }),
  "yamakan.project.redo": define({
    scope: "project:write",
    mutation: true,
    summary: "Redo the last undone batch as a new revision.",
    input: z
      .object({
        projectId: Id,
        expectedRevision: z.number().int().nonnegative(),
      })
      .strict(),
    run: ({ store, receipt, principal }, a) =>
      store.redo(a.projectId, a.expectedRevision, principal.id, receipt),
  }),
  "yamakan.project.save": define({
    scope: "project:write",
    mutation: true,
    summary: "Commit a complete project snapshot at an expected revision.",
    input: z
      .object({
        project: ProjectSchema,
        expectedRevision: z.number().int().nonnegative(),
      })
      .strict(),
    run: ({ store, receipt }, a) =>
      store.save(a.project, a.expectedRevision, receipt),
  }),
  "yamakan.workspace.backup": define({
    scope: "project:recover",
    mutation: true,
    summary:
      "Back up the workspace (database and verified media) into the service's recovery folder while work continues.",
    input: z.object({}).strict(),
    run: (ctx, _a) =>
      ctx.receipt
        ? backupWorkspaceIdempotent(ctx.store, home(ctx), ctx.receipt)
        : backupWorkspace(ctx.store, home(ctx)),
  }),
  "yamakan.workspace.backups": define({
    scope: "project:read",
    mutation: false,
    summary: "List workspace backups, newest first.",
    input: z.object({}).strict(),
    run: (ctx) => listBackups(home(ctx)),
  }),
  "yamakan.workspace.restore": define({
    scope: "project:recover",
    mutation: true,
    summary:
      "Restore a backup into a new workspace folder (the current workspace is not changed).",
    input: z.object({ backupId: BackupId }).strict(),
    run: (ctx, a) =>
      ctx.receipt
        ? restoreFromHomeIdempotent(
            ctx.store,
            home(ctx),
            a.backupId,
            ctx.receipt,
            { reservedBytes: ctx.store.reservedBytes },
          )
        : restoreFromHome(home(ctx), a.backupId, {
            reservedBytes: ctx.store.reservedBytes,
          }),
  }),
  "yamakan.workspace.collectGarbage": define({
    scope: "project:recover",
    mutation: true,
    summary:
      "Remove crash leftovers older than an hour (unregistered media objects, temporary and staging files).",
    input: z.object({}).strict(),
    run: ({ store }) => store.collectGarbage(),
  }),
  "yamakan.asset.repair": define({
    scope: "project:recover",
    mutation: true,
    summary:
      "Re-probe a quarantined asset object and release it when verification passes.",
    input: z
      .object({
        projectId: Id,
        assetId: Id,
      })
      .strict(),
    run: ({ store }, a) => store.repairAsset(a.projectId, a.assetId),
  }),
  "yamakan.export.video": define({
    scope: "render:execute",
    mutation: true,
    summary: "Queue an MP4 export of the current project revision.",
    input: z
      .object({
        projectId: Id,
        idempotencyKey: z.string().min(1).max(80),
        /** W18: two-pass loudnorm on the mixed audio bus. */
        normalizeLoudness: z.boolean().optional(),
      })
      .strict(),
    run: ({ queue }, a) =>
      queue.submit(a.projectId, a.idempotencyKey, {
        normalizeLoudness: a.normalizeLoudness === true,
      }),
  }),
  "yamakan.job.status": define({
    scope: "job:read",
    mutation: false,
    summary: "Read a render job.",
    input: z.object({ jobId: Id }).strict(),
    run: ({ queue }, a) => queue.status(a.jobId),
  }),
  "yamakan.job.cancel": define({
    scope: "job:control",
    mutation: true,
    summary: "Request cancellation of a render job.",
    input: z.object({ jobId: Id }).strict(),
    run: ({ queue }, a) => queue.cancel(a.jobId),
  }),
  "yamakan.job.list": define({
    scope: "job:read",
    mutation: false,
    summary: "List render jobs of this service session.",
    input: z.object({}).strict(),
    run: ({ queue }) => queue.list(),
  }),
  "yamakan.job.retry": define({
    scope: "job:control",
    mutation: true,
    summary:
      "Re-queue a job that needs reconciliation after too many interruptions.",
    input: z.object({ jobId: Id }).strict(),
    run: ({ queue }, a) => queue.retry(a.jobId),
  }),
  "yamakan.job.discard": define({
    scope: "job:control",
    mutation: true,
    summary:
      "Cancel a job that needs reconciliation without changing project revisions.",
    input: z.object({ jobId: Id }).strict(),
    run: ({ queue }, a) => queue.discard(a.jobId),
  }),
  "yamakan.scene.capability": define({
    scope: "project:read",
    mutation: false,
    summary: "Report Cinema availability and unsupported generative surfaces.",
    input: z.object({}).strict(),
    run: () => cinemaCapability(),
  }),
  "yamakan.scene.save": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Validate, content-hash, and (when Cinema is enabled) persist a scene3d document.",
    input: z
      .object({
        scene: Scene3DSchema,
      })
      .strict(),
    run: async ({ store }, a) => {
      const saved = saveScene3D(a.scene);
      if (saved.cinemaEnabled) {
        await persistCinemaScene(store, saved.scene);
      }
      return saved;
    },
  }),
  "yamakan.scene.open": define({
    scope: "project:read",
    mutation: false,
    summary: "Load a persisted Cinema scene3d by id.",
    input: z.object({ sceneId: Id }).strict(),
    run: ({ store }, a) => loadCinemaScene(store, a.sceneId),
  }),
  "yamakan.scene.list": define({
    scope: "project:read",
    mutation: false,
    summary: "List persisted Cinema scene ids and content hashes.",
    input: z.object({}).strict(),
    run: ({ store }) => listCinemaScenes(store).then((scenes) => ({ scenes })),
  }),
  "yamakan.studio.capability": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Report Studio canvas availability (STUDIO_ENABLED / Q8–Q10 gate).",
    input: z.object({}).strict(),
    run: () => studioCapability(),
  }),
  "yamakan.studio.open": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Create an empty Studio document (durable project attach behind STUDIO_ENABLED).",
    input: z
      .object({
        name: z.string().min(1).max(120).optional(),
        width: z.number().int().positive().max(16384).optional(),
        height: z.number().int().positive().max(16384).optional(),
      })
      .strict(),
    run: (_ctx, a) => {
      const document = createEmptyStudioDocument({
        id: crypto.randomUUID(),
        name: a.name ?? "Untitled studio",
        width: a.width,
        height: a.height,
      });
      return saveStudioDocument(document);
    },
  }),
  "yamakan.studio.commit": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Validate and content-hash a Studio document revision (attach behind STUDIO_ENABLED).",
    input: z
      .object({
        document: StudioDocumentSchema,
      })
      .strict(),
    run: (_ctx, a) => saveStudioDocument(a.document),
  }),
  "yamakan.studio.export": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Return Studio document JSON and content hash for host-controlled export naming.",
    input: z
      .object({
        document: StudioDocumentSchema,
      })
      .strict(),
    run: (_ctx, a) => {
      const saved = saveStudioDocument(a.document);
      return {
        contentHash: saved.contentHash,
        format: saved.document.format,
        canvasSchemaVersion: saved.document.canvasSchemaVersion,
        studioEnabled: saved.studioEnabled,
      };
    },
  }),
  "yamakan.consent.grant": define({
    scope: "consent:grant",
    mutation: true,
    humanOnly: true,
    summary:
      "Grant likeness consent (version, purpose, expiry). Browser session only.",
    input: z
      .object({
        characterId: z.string().min(1).max(80),
        purpose: ConsentPurposeSchema,
        version: z.string().min(1).max(40),
        ttlMs: z.number().int().positive(),
      })
      .strict(),
    run: ({ store, principal }, a) =>
      grantConsent(store, {
        characterId: a.characterId,
        purpose: a.purpose,
        version: a.version,
        ttlMs: a.ttlMs,
        principalId: principal.id,
      }),
  }),
  "yamakan.consent.revoke": define({
    scope: "consent:revoke",
    mutation: true,
    humanOnly: true,
    summary:
      "Revoke likeness consent and invalidate derived encodings. Browser session only.",
    input: z.object({ consentId: Id }).strict(),
    run: ({ store }, a) => revokeConsentRecord(store, a.consentId),
  }),
  "yamakan.identity.encode": define({
    scope: "project:write",
    mutation: true,
    summary:
      "Record an identity encoding only when matching unexpired consent exists.",
    input: z
      .object({
        characterId: z.string().min(1).max(80),
        purpose: ConsentPurposeSchema,
        consentId: Id,
        provider: z.string().min(1).max(64),
        method: z.string().min(1).max(64),
        payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    run: ({ store }, a) =>
      recordEncoding(store, {
        characterId: a.characterId,
        purpose: a.purpose,
        consentId: a.consentId,
        provider: a.provider,
        method: a.method,
        payloadHash: a.payloadHash,
      }),
  }),
  "yamakan.director.capability": define({
    scope: "project:read",
    mutation: false,
    summary: "Report Director availability and unsupported model stages.",
    input: z.object({}).strict(),
    run: () => directorCapability(),
  }),
  "yamakan.director.start": define({
    scope: "project:write",
    mutation: true,
    summary: "Start a Director run for a named pipeline manifest.",
    input: z
      .object({
        projectId: Id,
        pipelineName: z.string().min(1).max(80),
      })
      .strict(),
    run: ({ store }, a) =>
      startDirectorRun(store, {
        projectId: a.projectId,
        pipelineName: a.pipelineName,
      }),
  }),
  "yamakan.director.advance": define({
    scope: "project:write",
    mutation: true,
    summary: "Write a stage receipt (gates on prerequisites and approvals).",
    input: z
      .object({
        runId: Id,
        stage: z.string().min(1).max(80),
        status: z.enum([
          "pending",
          "in_progress",
          "awaiting_human",
          "completed",
          "failed",
        ]),
        outputHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
      })
      .strict(),
    run: ({ store }, a) =>
      advanceStage(store, {
        runId: a.runId,
        stage: a.stage,
        status: a.status,
        outputHash: a.outputHash,
      }),
  }),
  "yamakan.director.approve": define({
    scope: "director:approve",
    mutation: true,
    humanOnly: true,
    summary:
      "Human approval bound to a stage output hash and expiry. Browser session only.",
    input: z
      .object({
        runId: Id,
        stage: z.string().min(1).max(80),
        outputHash: z.string().regex(/^[a-f0-9]{64}$/),
        ttlMs: z
          .number()
          .int()
          .positive()
          .max(30 * 24 * 60 * 60 * 1000),
      })
      .strict(),
    run: ({ store }, a) =>
      approveStage(store, {
        runId: a.runId,
        stage: a.stage,
        outputHash: a.outputHash,
        ttlMs: a.ttlMs,
      }),
  }),
  "yamakan.director.next": define({
    scope: "project:read",
    mutation: false,
    summary: "Return the next Director stage, blocked reasons, or done.",
    input: z.object({ runId: Id }).strict(),
    run: ({ store }, a) => directorNext(store, a.runId),
  }),
  "yamakan.flow.snapshot": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Read-only Flow projection of a Director run (or builtin manifest). Issues no commands.",
    input: z
      .object({
        pipelineName: z.string().min(1).max(80).optional(),
        runId: Id.optional(),
      })
      .strict(),
    run: async ({ store }, a) => {
      if (!FLOW_ENABLED)
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          "Flow view is disabled.",
        );
      const run = a.runId ? await loadRun(store, a.runId) : null;
      const name = a.pipelineName ?? run?.pipelineName ?? "framework-smoke";
      return flowSnapshot(builtinManifest(name), run);
    },
  }),
  "yamakan.quality.capability": define({
    scope: "project:read",
    mutation: false,
    summary: "Report Quality Lab availability (QUALITY_LAB_ENABLED gate).",
    input: z.object({}).strict(),
    run: () => qualityLabCapability(),
  }),
  "yamakan.quality.compare": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Summarize a blinded Quality Lab comparison (reproducible content hash).",
    input: z
      .object({
        comparison: QualityComparisonSchema,
      })
      .strict(),
    run: (_ctx, a) => summarizeBlindedComparison(a.comparison),
  }),
  "yamakan.quality.evidence": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Private evidence digest of a Quality Lab comparison (binds systems, outputs, input, consent, latency and raters); never show it to raters.",
    input: z
      .object({
        comparison: QualityComparisonSchema,
      })
      .strict(),
    run: (_ctx, a) => comparisonEvidence(a.comparison),
  }),
  "yamakan.router.explain": define({
    scope: "project:read",
    mutation: false,
    summary:
      "Hard-filter routes before ranking; with providers disabled returns only rejections.",
    input: z
      .object({
        operation: z.string().min(1).max(80),
        region: z.string().min(1).max(40).optional(),
        remainingBudgetMinor: z.number().int().nonnegative().optional(),
      })
      .strict(),
    run: (_ctx, a) => explainRoutes(a),
  }),
  "yamakan.lineage.evaluate": define({
    scope: "project:read",
    mutation: false,
    summary: "Evaluate review lineage independence (concepts only).",
    input: z
      .object({
        author: z
          .object({
            model_family: z.string().min(1).max(64),
            provider_identity: z.string().min(1).max(128).nullable(),
            context_digest: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
        reviewer: z
          .object({
            model_family: z.string().min(1).max(64),
            provider_identity: z.string().min(1).max(128).nullable(),
            context_digest: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      })
      .strict(),
    run: (_ctx, a) =>
      evaluateReviewIndependenceV1(
        a.author as ReviewLineageV1,
        a.reviewer as ReviewLineageV1,
      ),
  }),
  "yamakan.agent.create": define({
    scope: "agent:create",
    mutation: true,
    humanOnly: true,
    summary:
      "Create a scoped agent token (shown once). Requires the browser session.",
    input: z
      .object({
        label: z.string().min(1).max(80).optional(),
        scopes: z.array(z.enum(Scopes)).min(1).max(Scopes.length),
      })
      .strict(),
    run: ({ store }, a) => {
      const scopes = new Set(a.scopes) as ReadonlySet<Scope>;
      assertAgentScopeCeiling(scopes);
      return store.createAgentToken(scopes, a.label);
    },
  }),
  "yamakan.agent.revoke": define({
    scope: "agent:revoke",
    mutation: true,
    humanOnly: true,
    summary: "Revoke an agent token. Requires the browser session.",
    input: z
      .object({ agentId: z.string().regex(/^agent:[0-9a-f-]{36}$/) })
      .strict(),
    run: ({ store }, a) => store.revokeAgentToken(a.agentId),
  }),
};

export type Operation = keyof typeof commands;
export type OperationInput<O extends Operation> = z.input<
  (typeof commands)[O]["input"]
>;
export type OperationResult<O extends Operation> = Awaited<
  ReturnType<(typeof commands)[O]["run"]>
>;

// Pre-Yamakan clients used the darzain.* names; they remain accepted aliases.
const LEGACY_PREFIX = "darzain.";
export function resolveOperation(name: unknown): Operation {
  if (typeof name !== "string" || name.length > 80)
    throw new CommandError("VALIDATION", "Unknown operation.");
  const canonical = name.startsWith(LEGACY_PREFIX)
    ? `yamakan.${name.slice(LEGACY_PREFIX.length)}`
    : name;
  if (!Object.hasOwn(commands, canonical))
    throw new CommandError("VALIDATION", "Unknown operation.");
  return canonical as Operation;
}

export function authorize(principal: Principal, operation: Operation) {
  const command = commands[operation];
  if (command.humanOnly && principal.id !== "browser-ui")
    throw new CommandError(
      "SCOPE_DENIED",
      "This command requires the browser session.",
    );
  if (!principal.scopes.has(command.scope))
    throw new CommandError(
      "SCOPE_DENIED",
      `Principal ${principal.id} lacks scope ${command.scope}.`,
    );
}

export async function execute(
  ctx: CommandContext,
  name: unknown,
  parameters: unknown,
) {
  const operation = resolveOperation(name);
  authorize(ctx.principal, operation);
  const command = commands[operation] as Definition<z.ZodType, unknown>;
  const input = command.input.parse(parameters ?? {});
  // A mutation with a request ID is replayable: the same ID and input return
  // the original result; the same ID with different input is rejected.
  const receipt =
    command.mutation && ctx.requestId
      ? {
          principalId: ctx.principal.id,
          requestId: ctx.requestId,
          digest: sha256Hex(
            canonicalJson({
              apiVersion: API_VERSION,
              format: SNAPSHOT_FORMAT,
              operation,
              input,
            }),
          ),
        }
      : undefined;
  return { operation, result: await command.run({ ...ctx, receipt }, input) };
}

export function catalog() {
  return Object.entries(commands).map(([name, c]) => ({
    name,
    scope: c.scope,
    mutation: c.mutation,
    summary: c.summary,
    legacyAlias: name.replace(/^yamakan\./, LEGACY_PREFIX),
    inputSchema: z.toJSONSchema(c.input),
  }));
}
