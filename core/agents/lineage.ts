/**
 * Review-lineage independence contracts from Ascout
 * `src/assurance/review/independence-policy.ts`
 * @ pin ca6b6f514e5a8881e2cfa2789b5e5ea43e3aaaad (founder-attested, Apache-2.0).
 * Concepts only — not independent review execution.
 */

export const INDEPENDENCE_POLICY_SCHEMA_VERSION = 1 as const;

export const INDEPENDENCE_VERDICTS = ["INDEPENDENT", "SELF_REVIEW"] as const;

export type IndependenceVerdictV1 = (typeof INDEPENDENCE_VERDICTS)[number];

export const LINEAGE_DIMENSIONS = [
  "model_family",
  "provider_identity",
  "context_digest",
] as const;

export type LineageDimensionV1 = (typeof LINEAGE_DIMENSIONS)[number];

export interface ReviewLineageV1 {
  readonly model_family: string;
  readonly provider_identity: string | null;
  readonly context_digest: string;
}

export interface IndependenceEvaluationV1 {
  readonly schema_version: 1;
  readonly verdict: IndependenceVerdictV1;
  readonly differing_dimensions: readonly LineageDimensionV1[];
  readonly matching_dimensions: readonly LineageDimensionV1[];
  readonly reasons: readonly string[];
}

export interface IndependenceCheckV1 {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

const MODEL_FAMILY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;

function assertLineageShape(lineage: ReviewLineageV1, role: string): string[] {
  const reasons: string[] = [];
  if (typeof lineage !== "object" || lineage === null) {
    return [role + " lineage not an object"];
  }
  if (
    typeof lineage.model_family !== "string" ||
    !MODEL_FAMILY.test(lineage.model_family)
  ) {
    reasons.push(role + " model family invalid");
  }
  if (
    lineage.provider_identity !== null &&
    (typeof lineage.provider_identity !== "string" ||
      !OPAQUE_ID.test(lineage.provider_identity))
  ) {
    reasons.push(role + " provider identity invalid");
  }
  if (
    typeof lineage.context_digest !== "string" ||
    !SHA256_HEX.test(lineage.context_digest)
  ) {
    reasons.push(role + " context digest invalid");
  }
  return reasons;
}

export function assertReviewLineagePairV1(
  author: ReviewLineageV1,
  reviewer: ReviewLineageV1,
): IndependenceCheckV1 {
  const reasons: string[] = [
    ...assertLineageShape(author, "author"),
    ...assertLineageShape(reviewer, "reviewer"),
  ];
  return { ok: reasons.length === 0, reasons };
}

export function evaluateReviewIndependenceV1(
  author: ReviewLineageV1,
  reviewer: ReviewLineageV1,
): IndependenceEvaluationV1 {
  const check = assertReviewLineagePairV1(author, reviewer);
  if (!check.ok) {
    throw new TypeError(
      "invalid independence input: " + check.reasons.join("; "),
    );
  }
  const differing: LineageDimensionV1[] = [];
  const matching: LineageDimensionV1[] = [];
  if (author.model_family === reviewer.model_family) {
    matching.push("model_family");
  } else {
    differing.push("model_family");
  }
  if (author.provider_identity === reviewer.provider_identity) {
    matching.push("provider_identity");
  } else {
    differing.push("provider_identity");
  }
  if (author.context_digest === reviewer.context_digest) {
    matching.push("context_digest");
  } else {
    differing.push("context_digest");
  }
  const verdict: IndependenceVerdictV1 =
    differing.length === 0 ? "SELF_REVIEW" : "INDEPENDENT";
  const reasons: string[] =
    verdict === "SELF_REVIEW"
      ? [
          "self-review: author and reviewer share model family, provider identity, and context digest; independence refused",
        ]
      : differing.map(
          (dimension) =>
            "independent via " + dimension + ": reviewer lineage differs",
        );
  return Object.freeze({
    schema_version: INDEPENDENCE_POLICY_SCHEMA_VERSION,
    verdict,
    differing_dimensions: Object.freeze([...differing]),
    matching_dimensions: Object.freeze([...matching]),
    reasons: Object.freeze(reasons),
  });
}

export function isIndependentReviewV1(
  evaluation: IndependenceEvaluationV1,
): boolean {
  return evaluation.verdict === "INDEPENDENT";
}
