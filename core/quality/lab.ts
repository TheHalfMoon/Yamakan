/**
 * Quality Lab harness (original): shared consented inputs, blinded ratings,
 * failure and attempt accounting. Flag stays off until enablement.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { CommandError } from "../command/errors.ts";

/**
 * Deterministic Quality Lab (blinded compare / summarize) enabled after P10-05.
 * Paid/provider ranking stays off via ROUTER_PROVIDERS_ENABLED.
 */
export const QUALITY_LAB_ENABLED = true;

export const QUALITY_LAB_FORMAT = "yamakan.quality-lab/v1";

const Sha256Hex = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "content hash must be sha256 hex");

export const BlindedRatingSchema = z
  .object({
    raterId: z.string().min(1).max(80),
    /** Blind slot label; never the system under test name. */
    slot: z.enum(["A", "B"]),
    score: z.number().int().min(1).max(5),
    rubricVersion: z.string().min(1).max(40),
  })
  .strict();

export const QualityComparisonSchema = z
  .object({
    format: z.literal(QUALITY_LAB_FORMAT),
    comparisonId: z.string().uuid(),
    /** Shared consented input content hash. */
    inputHash: Sha256Hex,
    consentPurpose: z.string().min(1).max(80),
    systems: z
      .array(
        z
          .object({
            slot: z.enum(["A", "B"]),
            systemId: z.string().min(1).max(80),
            outputHash: Sha256Hex,
            attemptCount: z.number().int().min(1).max(100),
            failureCount: z.number().int().min(0).max(100),
            latencyMs: z.number().int().min(0).max(86_400_000),
          })
          .strict(),
      )
      .length(2),
    ratings: z.array(BlindedRatingSchema).max(64),
  })
  .strict();

export type QualityComparison = z.infer<typeof QualityComparisonSchema>;

export function qualityLabCapability(): {
  id: string;
  available: boolean;
  reason?: string;
} {
  if (!QUALITY_LAB_ENABLED) {
    return {
      id: "quality-lab",
      available: false,
      reason:
        "Quality Lab is imported but disabled until acceptance tests pass on this head.",
    };
  }
  return {
    id: "quality-lab",
    available: true,
    reason:
      "Deterministic blinded compare enabled; generative/provider quality claims remain out of scope.",
  };
}

/** Deterministic blinded summary: slot averages only; system ids omitted. */
export function summarizeBlindedComparison(raw: unknown): {
  comparisonId: string;
  inputHash: string;
  slotAverages: { A: number | null; B: number | null };
  attemptTotals: { A: number; B: number };
  failureTotals: { A: number; B: number };
  contentHash: string;
  qualityLabEnabled: boolean;
} {
  const parsed = QualityComparisonSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CommandError(
      "VALIDATION",
      parsed.error.issues.map((i) => i.message).join("; ") ||
        "Invalid quality comparison.",
    );
  }
  const doc = parsed.data;
  const slots = {
    A: doc.systems.find((s) => s.slot === "A")!,
    B: doc.systems.find((s) => s.slot === "B")!,
  };
  const avg = (slot: "A" | "B"): number | null => {
    const scores = doc.ratings
      .filter((r) => r.slot === slot)
      .map((r) => r.score);
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };
  const summary = {
    comparisonId: doc.comparisonId,
    inputHash: doc.inputHash,
    slotAverages: { A: avg("A"), B: avg("B") },
    attemptTotals: {
      A: slots.A.attemptCount,
      B: slots.B.attemptCount,
    },
    failureTotals: {
      A: slots.A.failureCount,
      B: slots.B.failureCount,
    },
    qualityLabEnabled: QUALITY_LAB_ENABLED,
  };
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        inputHash: summary.inputHash,
        slotAverages: summary.slotAverages,
        attemptTotals: summary.attemptTotals,
        failureTotals: summary.failureTotals,
        ratings: doc.ratings
          .map((r) => ({
            slot: r.slot,
            score: r.score,
            rubric: r.rubricVersion,
          }))
          .sort((a, b) =>
            `${a.slot}${a.score}${a.rubric}`.localeCompare(
              `${b.slot}${b.score}${b.rubric}`,
            ),
          ),
      }),
    )
    .digest("hex");
  return { ...summary, contentHash };
}
