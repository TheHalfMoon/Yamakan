// Benchmark recording and analysis (YU-090). Reads a frozen protocol
// (docs/evidence/ultimate/benchmark-protocol.json) and recorded
// observations, and computes per-cohort decision labels with intervals
// that respect clustering by prompt (raters and seeds are nested within a
// prompt, never extra independent samples). It makes no provider or model
// call and downloads nothing: it only reads records someone else produced.
//
// A label stronger than INCONCLUSIVE needs complete, honest records: a
// missing expected trial, a removed retry, a rater voting twice on one pair
// or a trial of another modality makes the cohort INCONCLUSIVE with the
// reason; an empty cohort is NOT TESTED.
import { createHash } from "node:crypto";
import { z } from "zod";
import { CommandError } from "../command/errors.ts";

export const BENCHMARK_PROTOCOL_FORMAT = "yamakan.benchmark-protocol/1";
export const BENCHMARK_OBSERVATIONS_FORMAT = "yamakan.benchmark-observations/1";
export const BENCHMARK_REPORT_FORMAT = "yamakan.benchmark-report/1";

// Bounds on what one analysis reads.
export const BENCHMARK_LIMITS = Object.freeze({
  cohorts: 64,
  trials: 200_000,
  votes: 500_000,
  promptsPerCohort: 10_000,
  bytes: 64 * 1024 * 1024,
});

const Label = z.enum([
  "WINS",
  "MATCHES",
  "LOSES",
  "INCONCLUSIVE",
  "NOT TESTED",
]);
export type Label = z.infer<typeof Label>;
const CategoryId = z.enum([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
]);
const Text = z.string().min(1).max(200);
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const RefId = z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/);

export const ProtocolSchema = z
  .object({
    format: z.literal(BENCHMARK_PROTOCOL_FORMAT),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    frozenAt: z.string(),
    source: z.string(),
    status: z.string(),
    labels: z.array(Label).length(5),
    statistics: z
      .object({
        alpha: z.number().gt(0).lt(0.5),
        multipleComparisons: z.literal("holm"),
        bootstrapResamples: z.number().int().min(200).max(100_000),
        bootstrapSeed: z.number().int().nonnegative(),
      })
      .passthrough(),
    sampling: z
      .object({ maxSeedsPerPrompt: z.number().int().min(1).max(16) })
      .passthrough(),
    retries: z
      .object({
        maxAttempts: z.number().int().min(1).max(16),
        causeCodes: z.array(z.string()).min(1),
      })
      .passthrough(),
    categories: z
      .array(
        z
          .object({
            id: CategoryId,
            name: Text,
            primaryEndpoint: z.enum(["preference", "taskSuccess"]),
            requiresConsent: z.boolean(),
          })
          .passthrough(),
      )
      .length(12),
  })
  .passthrough();
export type Protocol = z.infer<typeof ProtocolSchema>;

const Status = z.enum([
  "ok",
  "failed",
  "refused",
  "moderated",
  "timeout",
  "unsupported",
  "network",
]);
const Modality = z.enum(["silent", "audio", "none"]);
const TrialSchema = z
  .object({
    trialId: RefId,
    promptId: RefId,
    product: RefId,
    seed: z.number().int().nonnegative().max(1_000_000),
    attempt: z.number().int().positive().max(64),
    status: Status,
    modality: Modality,
    inputSha256: Sha256,
    outputSha256: Sha256.nullable().optional(),
    consentId: RefId.nullable().optional(),
    costMicros: z.number().int().nonnegative().max(1e15).optional(),
    interventionSeconds: z.number().nonnegative().max(1e7).optional(),
  })
  .strict();
const PairSchema = z
  .object({ pairId: RefId, promptId: RefId, left: RefId, right: RefId })
  .strict();
const VoteSchema = z
  .object({
    pairId: RefId,
    raterId: RefId,
    choice: z.enum(["left", "right", "tie"]),
    attentionPassed: z.boolean(),
  })
  .strict();
const CohortSchema = z
  .object({
    id: RefId,
    category: CategoryId,
    modality: Modality,
    // The system under test and the one it is compared with.
    product: RefId,
    comparator: RefId,
    // Declared before analysis: every prompt and how many seeds each gets.
    expected: z
      .object({
        prompts: z.array(RefId).max(BENCHMARK_LIMITS.promptsPerCohort),
        seedsPerPrompt: z.number().int().min(1).max(16),
      })
      .strict(),
    // MATCHES is possible only with a margin declared here, in advance.
    equivalenceMargin: z.number().gt(0).lt(0.5).optional(),
    // A win also needs the product's success rate (Wilson lower bound) at
    // or above this floor, when declared.
    successFloor: z.number().min(0).max(1).optional(),
    trials: z.array(TrialSchema).max(BENCHMARK_LIMITS.trials),
    pairs: z.array(PairSchema).max(BENCHMARK_LIMITS.votes),
    votes: z.array(VoteSchema).max(BENCHMARK_LIMITS.votes),
  })
  .strict();
export const ObservationsSchema = z
  .object({
    format: z.literal(BENCHMARK_OBSERVATIONS_FORMAT),
    protocolSha256: Sha256,
    cohorts: z.array(CohortSchema).max(BENCHMARK_LIMITS.cohorts),
  })
  .strict();
export type Observations = z.infer<typeof ObservationsSchema>;
type Cohort = z.infer<typeof CohortSchema>;

// Secrets never belong in benchmark evidence: refused before parsing.
const SECRET_KEY =
  /token|secret|password|passwd|api[-_]?key|authorization|cookie|credential/i;
const SECRET_VALUE =
  /\bsk-[A-Za-z0-9_-]{16,}|\bBearer\s+[A-Za-z0-9._~+/-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[bpas]-[A-Za-z0-9-]{10,}/;
function assertNoSecrets(value: unknown, at = "$", depth = 0): void {
  if (depth > 32)
    throw new CommandError(
      "VALIDATION",
      "Benchmark records are nested too deeply.",
    );
  if (typeof value === "string") {
    if (SECRET_VALUE.test(value))
      throw new CommandError(
        "VALIDATION",
        `A value at ${at} looks like a credential; benchmark evidence never holds one.`,
      );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoSecrets(v, `${at}[${i}]`, depth + 1));
    return;
  }
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k))
        throw new CommandError(
          "VALIDATION",
          `Field ${at}.${k.slice(0, 40)} would hold a credential; benchmark evidence never holds one.`,
        );
      assertNoSecrets(v, `${at}.${k.slice(0, 40)}`, depth + 1);
    }
}

export const sha256 = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export function parseProtocol(text: string): {
  protocol: Protocol;
  sha256: string;
} {
  const protocol = ProtocolSchema.parse(JSON.parse(text));
  const ids = protocol.categories.map((c) => c.id).join("");
  if (ids !== "ABCDEFGHIJKL")
    throw new CommandError(
      "VALIDATION",
      "The protocol must define categories A to L once each, in order.",
    );
  return { protocol, sha256: sha256(text) };
}

export function parseObservations(text: string): Observations {
  if (Buffer.byteLength(text) > BENCHMARK_LIMITS.bytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "The observations file is too large to analyse.",
    );
  const value: unknown = JSON.parse(text);
  assertNoSecrets(value);
  return ObservationsSchema.parse(value);
}

// Deterministic PRNG (mulberry32): the same seed gives the same resamples
// and assignments on every machine.
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wilson score interval for a simple independent proportion.
export function wilson(successes: number, n: number, alpha = 0.05) {
  if (n === 0) return { estimate: null, lower: null, upper: null };
  const z = normalQuantile(1 - alpha / 2);
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    estimate: p,
    lower: Math.max(0, centre - half),
    upper: Math.min(1, centre + half),
  };
}

// Acklam's rational approximation of the standard normal quantile.
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError("p must be in (0, 1)");
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269,
    -30.66479806614716, 2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996,
    3.754408661907416,
  ];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

// Holm step-down adjustment of p-values (returned in input order).
export function holm(pValues: readonly number[]) {
  const order = pValues.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const adjusted: number[] = Array.from({ length: pValues.length }, () => 1);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (pValues.length - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}

// A statistic over clusters (prompts), resampled with replacement.
function clusterBootstrap(
  clusters: readonly { sum: number; n: number }[],
  resamples: number,
  seed: number,
) {
  const random = prng(seed);
  const out = new Float64Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    let n = 0;
    for (let k = 0; k < clusters.length; k++) {
      const c = clusters[Math.floor(random() * clusters.length)]!;
      sum += c.sum;
      n += c.n;
    }
    out[r] = n ? sum / n : NaN;
  }
  return Array.from(out)
    .filter((x) => !Number.isNaN(x))
    .sort((x, y) => x - y);
}
const quantile = (sorted: readonly number[], q: number) =>
  sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor(q * (sorted.length - 1))),
    )
  ]!;

export type Problem =
  | "MISSING_TRIALS"
  | "RETRIES_REMOVED"
  | "TOO_MANY_ATTEMPTS"
  | "DUPLICATE_RATER"
  | "MODALITY_MIXED"
  | "UNKNOWN_PRODUCT"
  | "UNDECLARED_PROMPT"
  | "UNKNOWN_PAIR"
  | "CONSENT_MISSING";

// Record integrity: each finding blocks any label stronger than
// INCONCLUSIVE for the cohort.
export function integrity(cohort: Cohort, protocol: Protocol) {
  const problems = new Map<Problem, number>();
  const add = (p: Problem) => problems.set(p, (problems.get(p) ?? 0) + 1);
  const products = new Set([cohort.product, cohort.comparator]);
  const prompts = new Set(cohort.expected.prompts);
  const category = protocol.categories.find((c) => c.id === cohort.category)!;
  const attempts = new Map<string, number[]>();
  for (const t of cohort.trials) {
    if (!products.has(t.product)) add("UNKNOWN_PRODUCT");
    if (!prompts.has(t.promptId)) add("UNDECLARED_PROMPT");
    if (t.modality !== cohort.modality) add("MODALITY_MIXED");
    if (category.requiresConsent && !t.consentId) add("CONSENT_MISSING");
    const key = `${t.promptId}\u0000${t.product}\u0000${t.seed}`;
    attempts.set(key, [...(attempts.get(key) ?? []), t.attempt]);
  }
  // Every declared prompt, product and seed slot has its attempts 1..n.
  const seedsOf = new Map<string, Set<number>>();
  for (const t of cohort.trials) {
    const k = `${t.promptId}\u0000${t.product}`;
    seedsOf.set(k, (seedsOf.get(k) ?? new Set()).add(t.seed));
  }
  for (const prompt of prompts)
    for (const product of products) {
      const seeds = seedsOf.get(`${prompt}\u0000${product}`)?.size ?? 0;
      if (seeds < cohort.expected.seedsPerPrompt) add("MISSING_TRIALS");
    }
  for (const list of attempts.values()) {
    const sorted = [...list].sort((a, b) => a - b);
    if (sorted.some((a, i) => a !== i + 1)) add("RETRIES_REMOVED");
    if (sorted.length > protocol.retries.maxAttempts) add("TOO_MANY_ATTEMPTS");
  }
  const pairs = new Map(cohort.pairs.map((p) => [p.pairId, p]));
  for (const p of cohort.pairs) {
    if (!prompts.has(p.promptId)) add("UNDECLARED_PROMPT");
    const sides = new Set([p.left, p.right]);
    if (sides.size !== 2 || ![...sides].every((s) => products.has(s)))
      add("UNKNOWN_PRODUCT");
  }
  const seen = new Set<string>();
  for (const v of cohort.votes) {
    if (!pairs.has(v.pairId)) add("UNKNOWN_PAIR");
    const key = `${v.pairId}\u0000${v.raterId}`;
    if (seen.has(key)) add("DUPLICATE_RATER");
    seen.add(key);
  }
  return [...problems].map(([problem, count]) => ({ problem, count }));
}

type CohortReport = {
  cohort: string;
  category: string;
  endpoint: "preference" | "taskSuccess";
  label: Label;
  reasons: string[];
  prompts: number;
  trials: number;
  votes: number;
  excludedVotes: number;
  estimate: number | null;
  interval: { lower: number; upper: number } | null;
  pValue: number | null;
  adjustedPValue: number | null;
  success: {
    product: ReturnType<typeof wilson>;
    comparator: ReturnType<typeof wilson>;
  };
};

// The final attempt per prompt, product and seed decides that slot's
// outcome (first-attempt analyses are a separate, declared cohort).
function finalOutcomes(cohort: Cohort) {
  const last = new Map<string, z.infer<typeof TrialSchema>>();
  for (const t of cohort.trials) {
    const key = `${t.promptId}\u0000${t.product}\u0000${t.seed}`;
    const prior = last.get(key);
    if (!prior || t.attempt > prior.attempt) last.set(key, t);
  }
  return [...last.values()];
}

export function analyse(
  observations: Observations,
  protocol: Protocol,
  protocolSha256: string,
) {
  if (observations.protocolSha256 !== protocolSha256)
    throw new CommandError(
      "VALIDATION",
      "These observations were recorded against another protocol version.",
    );
  const { alpha, bootstrapResamples, bootstrapSeed } = protocol.statistics;
  const reports: CohortReport[] = [];
  const tested: { index: number; p: number; direction: 1 | -1 }[] = [];
  observations.cohorts.forEach((cohort, index) => {
    const category = protocol.categories.find((c) => c.id === cohort.category)!;
    const endpoint = category.primaryEndpoint;
    const outcomes = finalOutcomes(cohort);
    const rate = (product: string) => {
      const mine = outcomes.filter((t) => t.product === product);
      return wilson(
        mine.filter((t) => t.status === "ok").length,
        mine.length,
        alpha,
      );
    };
    const report: CohortReport = {
      cohort: cohort.id,
      category: cohort.category,
      endpoint,
      label: "NOT TESTED",
      reasons: [],
      prompts: cohort.expected.prompts.length,
      trials: cohort.trials.length,
      votes: cohort.votes.length,
      excludedVotes: 0,
      estimate: null,
      interval: null,
      pValue: null,
      adjustedPValue: null,
      success: {
        product: rate(cohort.product),
        comparator: rate(cohort.comparator),
      },
    };
    reports.push(report);
    if (cohort.trials.length === 0 && cohort.votes.length === 0) {
      report.reasons.push("No valid matched run was recorded for this cohort.");
      return;
    }
    const problems = integrity(cohort, protocol);
    // Per prompt: the product's score (preference) or success difference.
    const clusters = new Map<string, { sum: number; n: number }>();
    if (endpoint === "preference") {
      const pairs = new Map(cohort.pairs.map((p) => [p.pairId, p]));
      for (const v of cohort.votes) {
        const pair = pairs.get(v.pairId);
        if (!pair) continue;
        if (!v.attentionPassed) {
          report.excludedVotes++;
          continue;
        }
        const productSide = pair.left === cohort.product ? "left" : "right";
        const score =
          v.choice === "tie" ? 0.5 : v.choice === productSide ? 1 : 0;
        const c = clusters.get(pair.promptId) ?? { sum: 0, n: 0 };
        c.sum += score;
        c.n += 1;
        clusters.set(pair.promptId, c);
      }
    } else {
      for (const prompt of cohort.expected.prompts) {
        const of = (product: string) => {
          const mine = outcomes.filter(
            (t) => t.promptId === prompt && t.product === product,
          );
          return mine.length
            ? mine.filter((t) => t.status === "ok").length / mine.length
            : null;
        };
        const mine = of(cohort.product);
        const theirs = of(cohort.comparator);
        if (mine === null || theirs === null) continue;
        // Scored on [0, 1] around 0.5 so both endpoints share one rule:
        // 0.5 + half the success difference.
        clusters.set(prompt, { sum: 0.5 + (mine - theirs) / 2, n: 1 });
      }
    }
    const list = [...clusters.values()];
    if (list.length === 0) {
      report.label = "INCONCLUSIVE";
      report.reasons.push("No usable comparisons were recorded.");
      return;
    }
    const total = list.reduce(
      (a, c) => ({ sum: a.sum + c.sum, n: a.n + c.n }),
      { sum: 0, n: 0 },
    );
    report.estimate = total.sum / total.n;
    const boot = clusterBootstrap(
      list,
      bootstrapResamples,
      bootstrapSeed + index,
    );
    report.interval = {
      lower: quantile(boot, alpha / 2),
      upper: quantile(boot, 1 - alpha / 2),
    };
    const below = boot.filter((x) => x <= 0.5).length / boot.length;
    const above = boot.filter((x) => x >= 0.5).length / boot.length;
    report.pValue = Math.min(1, 2 * Math.min(below, above));
    if (problems.length) {
      report.label = "INCONCLUSIVE";
      for (const { problem, count } of problems)
        report.reasons.push(
          `${problem} (${count}): the records cannot support a comparison label.`,
        );
      return;
    }
    // MATCHES: the two one-sided (1 - 2·alpha) interval inside the margin.
    if (cohort.equivalenceMargin !== undefined) {
      const m = cohort.equivalenceMargin;
      const lo = quantile(boot, alpha);
      const hi = quantile(boot, 1 - alpha);
      if (lo >= 0.5 - m && hi <= 0.5 + m) {
        report.label = "MATCHES";
        report.reasons.push(
          `The ${100 * (1 - 2 * alpha)}% interval lies within the declared margin of ${m}.`,
        );
        return;
      }
    }
    report.label = "INCONCLUSIVE";
    tested.push({
      index,
      p: report.pValue,
      direction: report.estimate > 0.5 ? 1 : -1,
    });
  });
  // Holm across every cohort that could claim a direction.
  const adjusted = holm(tested.map((t) => t.p));
  tested.forEach((t, k) => {
    const report = reports[t.index]!;
    const cohort = observations.cohorts[t.index]!;
    report.adjustedPValue = adjusted[k]!;
    if (adjusted[k]! >= alpha) {
      report.reasons.push(
        "No difference was established at the adjusted level; this is not a match.",
      );
      return;
    }
    if (t.direction === 1) {
      const floor = cohort.successFloor;
      const lower = report.success.product.lower;
      if (floor !== undefined && (lower === null || lower < floor)) {
        report.reasons.push(
          `Preferred, but the success rate's lower bound is below the declared floor of ${floor}.`,
        );
        return;
      }
      report.label = "WINS";
      report.reasons.push("The adjusted comparison favours the product.");
    } else {
      report.label = "LOSES";
      report.reasons.push("The adjusted comparison favours the comparator.");
    }
  });
  return {
    format: BENCHMARK_REPORT_FORMAT,
    protocolVersion: protocol.version,
    protocolSha256,
    analysedCohorts: reports.length,
    // Categories with no cohort at all are NOT TESTED.
    categories: protocol.categories.map((c) => {
      const mine = reports.filter((r) => r.category === c.id);
      return {
        id: c.id,
        name: c.name,
        labels: mine.length
          ? mine.map((r) => r.label)
          : (["NOT TESTED"] as Label[]),
      };
    }),
    cohorts: reports,
  };
}

// Blinded presentation: each pair's sides are randomised and the order of
// pairs shuffled from one recorded seed; raters see slot labels and output
// hashes only, never the product, provider, model or cost.
export function blind(
  pairs: readonly {
    pairId: string;
    promptId: string;
    a: { product: string; outputSha256: string };
    b: { product: string; outputSha256: string };
  }[],
  seed: number,
) {
  const random = prng(seed);
  const assignments = pairs.map((p) => {
    const swap = random() < 0.5;
    const [left, right] = swap ? [p.b, p.a] : [p.a, p.b];
    return {
      pairId: p.pairId,
      promptId: p.promptId,
      left: left.product,
      right: right.product,
      leftOutput: left.outputSha256,
      rightOutput: right.outputSha256,
    };
  });
  const order = assignments.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return {
    seed,
    // Kept by the operator; the products never reach a rater.
    assignments,
    raterView: order.map((i, position) => ({
      position: position + 1,
      pairId: assignments[i]!.pairId,
      left: assignments[i]!.leftOutput,
      right: assignments[i]!.rightOutput,
    })),
  };
}
