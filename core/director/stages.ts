// M12 / W15: Stage prerequisite / approval rules translated from OpenMontage
// lib/checkpoint.py @ 9327439 (_enforce_stage_prerequisites, get_next_stage,
// get_completed_stages, _stage_requires_approval). Checkpoints become durable
// stage receipts bound to an output hash.
import { z } from "zod";
import { Id } from "../project.ts";
import { CommandError } from "../command/errors.ts";
import {
  type PipelineManifest,
  stageNames,
  stageRequiresApproval,
} from "./manifest.ts";

export const StageStatusSchema = z.enum([
  "pending",
  "in_progress",
  "awaiting_human",
  "completed",
  "failed",
]);
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const StageReceiptSchema = z
  .object({
    format: z.literal("yamakan.stage-receipt"),
    formatVersion: z.literal(1),
    projectId: Id,
    pipelineName: z.string().min(1).max(80),
    stage: z.string().min(1).max(80),
    status: StageStatusSchema,
    outputHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    humanApproved: z.boolean().default(false),
    approvalExpiresAtMs: z.number().int().positive().nullable().default(null),
    approvedOutputHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .default(null),
  })
  .strict();
export type StageReceipt = z.infer<typeof StageReceiptSchema>;

export const DirectorRunSchema = z
  .object({
    format: z.literal("yamakan.director-run"),
    formatVersion: z.literal(1),
    id: Id,
    projectId: Id,
    pipelineName: z.string().min(1).max(80),
    receipts: z.array(StageReceiptSchema).max(64),
  })
  .strict();
export type DirectorRun = z.infer<typeof DirectorRunSchema>;

export type NextStageResult =
  | { kind: "stage"; stage: string }
  | { kind: "blocked"; reasons: string[] }
  | { kind: "done" };

export function getCompletedStages(run: DirectorRun): string[] {
  return run.receipts
    .filter((r) => r.status === "completed")
    .map((r) => r.stage);
}

export function enforceStagePrerequisites(
  manifest: PipelineManifest,
  run: DirectorRun,
  stage: string,
  status: StageStatus,
  nowMs = Date.now(),
): void {
  if (status !== "awaiting_human" && status !== "completed") return;
  const order = stageNames(manifest);
  if (!order.includes(stage))
    throw new CommandError(
      "VALIDATION",
      `Stage ${stage} is not in pipeline ${manifest.name}.`,
    );
  const incomplete: string[] = [];
  const unapproved: string[] = [];
  for (const predecessor of order.slice(0, order.indexOf(stage))) {
    const receipt = run.receipts.find((r) => r.stage === predecessor);
    if (!receipt || receipt.status !== "completed") {
      incomplete.push(predecessor);
      continue;
    }
    if (stageRequiresApproval(manifest, predecessor)) {
      try {
        if (!receipt.outputHash)
          throw new CommandError(
            "VALIDATION",
            "Approved predecessor is missing an output hash.",
          );
        assertApprovalStillValid(receipt, receipt.outputHash, nowMs);
      } catch {
        unapproved.push(predecessor);
      }
    }
  }
  if (incomplete.length || unapproved.length) {
    const details: string[] = [];
    if (incomplete.length)
      details.push(`incomplete or missing: ${incomplete.join(",")}`);
    if (unapproved.length)
      details.push(
        `completed without required approval: ${unapproved.join(",")}`,
      );
    throw new CommandError(
      "VALIDATION",
      `PREREQUISITE VIOLATION: stage ${stage} cannot advance; ${details.join("; ")}.`,
    );
  }
}

export function nextStage(
  manifest: PipelineManifest,
  run: DirectorRun,
  nowMs = Date.now(),
): NextStageResult {
  const order = stageNames(manifest);
  const completed = new Set(getCompletedStages(run));
  for (const stage of order) {
    if (completed.has(stage)) {
      const receipt = run.receipts.find((r) => r.stage === stage);
      if (
        receipt &&
        stageRequiresApproval(manifest, stage) &&
        receipt.outputHash
      ) {
        try {
          assertApprovalStillValid(receipt, receipt.outputHash, nowMs);
        } catch (error) {
          if (error instanceof CommandError)
            return {
              kind: "blocked",
              reasons: [
                `Stage ${stage} approval is no longer valid: ${error.message}`,
              ],
            };
          throw error;
        }
      }
      continue;
    }
    const receipt = run.receipts.find((r) => r.stage === stage);
    if (
      receipt?.status === "awaiting_human" &&
      stageRequiresApproval(manifest, stage) &&
      !receipt.humanApproved
    ) {
      return {
        kind: "blocked",
        reasons: [`Stage ${stage} requires human approval.`],
      };
    }
    if (
      receipt?.humanApproved &&
      receipt.outputHash &&
      stageRequiresApproval(manifest, stage)
    ) {
      try {
        assertApprovalStillValid(receipt, receipt.outputHash, nowMs);
      } catch (error) {
        if (error instanceof CommandError)
          return {
            kind: "blocked",
            reasons: [
              `Stage ${stage} approval is no longer valid: ${error.message}`,
            ],
          };
        throw error;
      }
    }
    try {
      enforceStagePrerequisites(
        manifest,
        run,
        stage,
        receipt?.status === "awaiting_human" ? "awaiting_human" : "completed",
        nowMs,
      );
    } catch (error) {
      if (error instanceof CommandError)
        return { kind: "blocked", reasons: [error.message] };
      throw error;
    }
    return { kind: "stage", stage };
  }
  return { kind: "done" };
}

/**
 * Bind a human approval to an exact output hash with expiry. A changed hash
 * requires a new approval.
 */
export function applyApproval(
  receipt: StageReceipt,
  opts: {
    outputHash: string;
    nowMs: number;
    expiresAtMs: number;
  },
): StageReceipt {
  if (!/^[a-f0-9]{64}$/.test(opts.outputHash))
    throw new CommandError("VALIDATION", "Approval output hash is invalid.");
  if (receipt.outputHash && receipt.outputHash !== opts.outputHash)
    throw new CommandError(
      "VALIDATION",
      "Approval output hash does not match the stage output.",
    );
  if (opts.expiresAtMs <= opts.nowMs)
    throw new CommandError(
      "VALIDATION",
      "Approval expiry must be in the future.",
    );
  return {
    ...receipt,
    humanApproved: true,
    approvedOutputHash: opts.outputHash,
    approvalExpiresAtMs: opts.expiresAtMs,
    outputHash: opts.outputHash,
    status: receipt.status === "awaiting_human" ? "completed" : receipt.status,
  };
}

export function assertApprovalStillValid(
  receipt: StageReceipt,
  outputHash: string,
  nowMs: number,
): void {
  if (!receipt.humanApproved)
    throw new CommandError("VALIDATION", "Stage has no human approval.");
  if (receipt.approvedOutputHash !== outputHash)
    throw new CommandError(
      "VALIDATION",
      "Approval was for a different output hash.",
    );
  if (
    receipt.approvalExpiresAtMs !== null &&
    nowMs >= receipt.approvalExpiresAtMs
  )
    throw new CommandError("VALIDATION", "Stage approval has expired.");
}
