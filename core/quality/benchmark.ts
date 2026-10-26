// Benchmark recording and analysis (YU-090). Reads a frozen protocol
// (docs/evidence/ultimate/benchmark-protocol.json) and recorded
// observations, and computes per-cohort decision labels with intervals
// that respect clustering by prompt (raters and seeds are nested within a
// prompt, never extra independent samples). It makes no provider or model
// call and downloads nothing: it only reads records someone else produced.
//
// A label stronger than INCONCLUSIVE needs complete, honest records: every
// declared prompt, product and seed attempted; attempts numbered 1..n;
// every comparable slot presented to the declared number of raters, once
// each; one modality; consent where the category needs it. Otherwise the
// cohort is INCONCLUSIVE with the reason. An empty cohort is NOT TESTED.
// Every failed output stays in the analysis (intention to treat): a slot
// where one side produced nothing usable counts as that side losing.
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
  // JSON nesting the observations format ever needs (refused before parse).
  depth: 8,
  // Bootstrap draws across all cohorts (resamples × clusters).
  bootstrapDraws: 2_000_000_000,
  consents: 10_000,
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
const Status = z.enum([
  "ok",
  "failed",
  "refused",
  "moderated",
  "timeout",
  "unsupported",
  "network",
]);

export const ProtocolSchema = z
  .object({
    format: z.literal(BENCHMARK_PROTOCOL_FORMAT),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    frozenAt: z.string(),
    source: z.string(),
    status: z.string(),
    labels: z
      .array(Label)
      .length(5)
      .refine((l) => new Set(l).size === 5),
    statistics: z
      .object({
        alpha: z.number().gt(0).lt(0.5),
        multipleComparisons: z.literal("holm"),
        bootstrapResamples: z.number().int().min(200).max(100_000),
        bootstrapSeed: z.number().int().nonnegative(),
      })
      .passthrough(),
    sampling: z
      .object({
        ratersPerPair: z.number().int().min(1).max(32),
        maxSeedsPerPrompt: z.number().int().min(1).max(16),
      })
      .passthrough(),
    retries: z
      .object({
        maxAttempts: z.number().int().min(1).max(16),
        // The cause codes the records may use: exactly the trial statuses.
        causeCodes: z
          .array(Status)
          .refine((c) => new Set(c).size === Status.options.length),
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

const Modality = z.enum(["silent", "audio", "none"]);
const TrialSchema = z
  .object({
    trialId: RefId,
    promptId: RefId,
    product: RefId,
    seed: z.number().int().nonnegative().max(15),
    attempt: z.number().int().positive().max(64),
    status: Status,
    modality: Modality,
    inputSha256: Sha256,
    outputSha256: Sha256.nullable().optional(),
    consentId: RefId.nullable().optional(),
    costMicros: z.number().int().nonnegative().max(1e15).optional(),
    interventionSeconds: z.number().nonnegative().max(1e7).optional(),
  })
  .strict()
  // A usable output is one with bytes to show.
  .refine((t) => t.status !== "ok" || Boolean(t.outputSha256), {
    message: "An ok trial names its output.",
  });
// One pair per comparable slot (prompt and seed): the two products' outputs.
const PairSchema = z
  .object({
    pairId: RefId,
    promptId: RefId,
    seed: z.number().int().nonnegative().max(15),
    left: RefId,
    right: RefId,
  })
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
    // Which outcome decides a slot: its first attempt, or the best within
    // the protocol's attempt budget. The two are separate cohorts.
    analysis: z.enum(["firstAttempt", "bestWithinBudget"]),
    // Declared before analysis: every prompt, and seeds 0..seedsPerPrompt-1.
    expected: z
      .object({
        prompts: z
          .array(RefId)
          .max(BENCHMARK_LIMITS.promptsPerCohort)
          .refine(
            (p) => new Set(p).size === p.length,
            "Prompts are listed once each.",
          ),
        seedsPerPrompt: z.number().int().min(1).max(16),
      })
      .strict(),
    // MATCHES is possible only with a margin declared here, in advance, on
    // the endpoint's own scale (a preference probability, or a difference
    // in success rate).
    equivalenceMargin: z.number().gt(0).lt(0.5).optional(),
    // A win also needs the product's success rate (lower bound over prompt
    // clusters) at or above this floor, when declared.
    successFloor: z.number().min(0).max(1).optional(),
    trials: z.array(TrialSchema).max(BENCHMARK_LIMITS.trials),
    pairs: z.array(PairSchema).max(BENCHMARK_LIMITS.votes),
    votes: z.array(VoteSchema).max(BENCHMARK_LIMITS.votes),
  })
  .strict();
// Consents the records rely on: what each covers and when its media must
// be deleted. A trial in a category that needs consent names one of these.
const ConsentSchema = z
  .object({
    consentId: RefId,
    categories: z.array(CategoryId).min(1).max(12),
    grantedAt: z.iso.date(),
    deleteBy: z.iso.date(),
  })
  .strict();
export const ObservationsSchema = z
  .object({
    format: z.literal(BENCHMARK_OBSERVATIONS_FORMAT),
    protocolSha256: Sha256,
    consents: z.array(ConsentSchema).max(BENCHMARK_LIMITS.consents).default([]),
    cohorts: z.array(CohortSchema).max(BENCHMARK_LIMITS.cohorts),
  })
  .strict();
export type Observations = z.input<typeof ObservationsSchema>;
type Parsed = z.output<typeof ObservationsSchema>;
type Cohort = z.output<typeof CohortSchema>;

// Secrets never belong in benchmark evidence: refused before parsing.
const SECRET_KEY =
  /token|secret|password|passwd|api[-_]?key|authorization|cookie|credential/i;
const SECRET_VALUE =
  /\bsk-[A-Za-z0-9_-]{16,}|\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}|\bBearer\s+[A-Za-z0-9._~+/-]{8,}|\bBasic\s+[A-Za-z0-9+/=]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}|\bxox[bpas]-[A-Za-z0-9-]{10,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
// A long run of mixed-case letters and digits reads as a key; hashes and
// ids in the records are lower-case hex or carry separators.
const looksLikeKey = (s: string) =>
  /[A-Za-z0-9+/_]{32,}/.test(s) &&
  /[a-z]/.test(s) &&
  /[A-Z]/.test(s) &&
  /[0-9]/.test(s);
const secretLike = (s: string) => SECRET_VALUE.test(s) || looksLikeKey(s);
function assertNoSecrets(value: unknown, at = "$", depth = 0): void {
  if (depth > 32)
    throw new CommandError(
      "VALIDATION",
      "Benchmark records are nested too deeply.",
    );
  if (typeof value === "string") {
    if (secretLike(value))
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
      if (SECRET_KEY.test(k) || secretLike(k))
        throw new CommandError(
          "VALIDATION",
          `A field at ${at} would hold a credential; benchmark evidence never holds one.`,
        );
      assertNoSecrets(v, `${at}.${k.slice(0, 20)}`, depth + 1);
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

export function parseObservations(text: string): Parsed {
  if (Buffer.byteLength(text) > BENCHMARK_LIMITS.bytes)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "The observations file is too large to analyse.",
    );
  // Nesting is bounded before the parser builds anything.
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 92)
        i++; // backslash: skip the escaped character
      else if (c === 34) inString = false;
    } else if (c === 34) inString = true;
    else if (c === 91 || c === 123) {
      if (++depth > BENCHMARK_LIMITS.depth)
        throw new CommandError(
          "VALIDATION",
          "The observations are nested too deeply.",
        );
    } else if (c === 93 || c === 125) depth--;
  }
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
    // Every cluster holds at least one observation, so n > 0.
    out[r] = sum / n;
  }
  return Array.from(out).sort((x, y) => x - y);
}
const quantile = (sorted: readonly number[], q: number) => {
  // Linear interpolation between order statistics.
  const at = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const lo = Math.floor(at);
  const hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
};

export type Problem =
  | "MISSING_TRIALS"
  | "RETRIES_REMOVED"
  | "TOO_MANY_ATTEMPTS"
  | "UNDECLARED_SEED"
  | "SEEDS_OVER_PROTOCOL"
  | "DUPLICATE_ID"
  | "DUPLICATE_PAIR"
  | "DUPLICATE_RATER"
  | "MISSING_VOTES"
  | "PAIR_WITHOUT_OUTPUTS"
  | "MODALITY_MIXED"
  | "UNKNOWN_PRODUCT"
  | "UNDECLARED_PROMPT"
  | "UNKNOWN_PAIR"
  | "CONSENT_MISSING";

const slotKey = (prompt: string, seed: number) => `${prompt}\u0000${seed}`;

// Each slot's outcome per product under the cohort's analysis: the first
// attempt, or success if any attempt within the budget succeeded.
function slotOutcomes(cohort: Cohort, protocol: Protocol) {
  const outcome = new Map<string, boolean>();
  for (const t of cohort.trials) {
    const key = `${slotKey(t.promptId, t.seed)}\u0000${t.product}`;
    const counts =
      cohort.analysis === "firstAttempt"
        ? t.attempt === 1
        : t.attempt <= protocol.retries.maxAttempts;
    if (!counts) continue;
    outcome.set(key, (outcome.get(key) ?? false) || t.status === "ok");
  }
  return (prompt: string, seed: number, product: string) =>
    outcome.get(`${slotKey(prompt, seed)}\u0000${product}`);
}

// Record integrity: each finding blocks any label stronger than
// INCONCLUSIVE for the cohort.
export function integrity(
  cohort: Cohort,
  protocol: Protocol,
  consents: Parsed["consents"] = [],
) {
  const problems = new Map<Problem, number>();
  const add = (p: Problem) => problems.set(p, (problems.get(p) ?? 0) + 1);
  const products = [cohort.product, cohort.comparator];
  const prompts = new Set(cohort.expected.prompts);
  const seeds = cohort.expected.seedsPerPrompt;
  if (seeds > protocol.sampling.maxSeedsPerPrompt) add("SEEDS_OVER_PROTOCOL");
  const category = protocol.categories.find((c) => c.id === cohort.category)!;
  const covering = new Map(consents.map((c) => [c.consentId, c]));
  const trialIds = new Set<string>();
  // Per slot and product: how many attempts, which numbers, the highest.
  const attempts = new Map<
    string,
    { n: number; seen: Set<number>; max: number }
  >();
  for (const t of cohort.trials) {
    if (trialIds.has(t.trialId)) add("DUPLICATE_ID");
    trialIds.add(t.trialId);
    if (!products.includes(t.product)) add("UNKNOWN_PRODUCT");
    if (!prompts.has(t.promptId)) add("UNDECLARED_PROMPT");
    if (t.seed >= seeds) add("UNDECLARED_SEED");
    if (t.modality !== cohort.modality) add("MODALITY_MIXED");
    if (category.requiresConsent) {
      const consent = t.consentId ? covering.get(t.consentId) : undefined;
      if (!consent || !consent.categories.includes(cohort.category))
        add("CONSENT_MISSING");
    }
    const key = `${slotKey(t.promptId, t.seed)}\u0000${t.product}`;
    const a = attempts.get(key) ?? { n: 0, seen: new Set<number>(), max: 0 };
    a.n++;
    a.seen.add(t.attempt);
    a.max = Math.max(a.max, t.attempt);
    attempts.set(key, a);
  }
  for (const a of attempts.values()) {
    // Attempts 1..max, each exactly once.
    if (a.n !== a.max || a.seen.size !== a.n) add("RETRIES_REMOVED");
    if (a.n > protocol.retries.maxAttempts) add("TOO_MANY_ATTEMPTS");
  }
  for (const prompt of prompts)
    for (let seed = 0; seed < seeds; seed++)
      for (const product of products)
        if (!attempts.has(`${slotKey(prompt, seed)}\u0000${product}`))
          add("MISSING_TRIALS");
  const pairsBySlot = new Map<string, string>();
  const pairIds = new Set<string>();
  const outcome = slotOutcomes(cohort, protocol);
  for (const p of cohort.pairs) {
    if (pairIds.has(p.pairId)) add("DUPLICATE_ID");
    pairIds.add(p.pairId);
    if (!prompts.has(p.promptId)) add("UNDECLARED_PROMPT");
    if (p.seed >= seeds) add("UNDECLARED_SEED");
    const sides = new Set([p.left, p.right]);
    if (sides.size !== 2 || ![...sides].every((s) => products.includes(s)))
      add("UNKNOWN_PRODUCT");
    const slot = slotKey(p.promptId, p.seed);
    if (pairsBySlot.has(slot)) add("DUPLICATE_PAIR");
    pairsBySlot.set(slot, p.pairId);
    if (
      !outcome(p.promptId, p.seed, cohort.product) ||
      !outcome(p.promptId, p.seed, cohort.comparator)
    )
      add("PAIR_WITHOUT_OUTPUTS");
  }
  const votesPerPair = new Map<string, number>();
  const seen = new Set<string>();
  for (const v of cohort.votes) {
    if (!pairIds.has(v.pairId)) add("UNKNOWN_PAIR");
    const key = `${v.pairId}\u0000${v.raterId}`;
    if (seen.has(key)) add("DUPLICATE_RATER");
    seen.add(key);
    votesPerPair.set(v.pairId, (votesPerPair.get(v.pairId) ?? 0) + 1);
  }
  // Preference cohorts: every slot where both products produced an output
  // was shown to the declared number of raters (attention failures count
  // as recorded; dropped votes do not).
  if (category.primaryEndpoint === "preference")
    for (const prompt of prompts)
      for (let seed = 0; seed < seeds; seed++) {
        if (
          !outcome(prompt, seed, cohort.product) ||
          !outcome(prompt, seed, cohort.comparator)
        )
          continue;
        const pair = pairsBySlot.get(slotKey(prompt, seed));
        if (
          !pair ||
          (votesPerPair.get(pair) ?? 0) < protocol.sampling.ratersPerPair
        )
          add("MISSING_VOTES");
      }
  return [...problems].map(([problem, count]) => ({ problem, count }));
}

type Interval = { lower: number; upper: number };
type CohortReport = {
  cohort: string;
  category: string;
  endpoint: "preference" | "taskSuccess";
  analysis: "firstAttempt" | "bestWithinBudget";
  label: Label;
  reasons: string[];
  prompts: number;
  trials: number;
  votes: number;
  excludedVotes: number;
  // On the endpoint's scale: the probability of preferring the product, or
  // the product's success rate minus the comparator's.
  estimate: number | null;
  interval: Interval | null;
  // The interval at this cohort's Holm step level: WINS/LOSES exactly when
  // it excludes no difference.
  adjustedInterval: Interval | null;
  pValue: number | null;
  adjustedPValue: number | null;
  success: {
    product: number | null;
    comparator: number | null;
    productLower: number | null;
  };
};

// Per-prompt scores on [0, 1] around 0.5, so both endpoints share one rule.
function promptScores(
  cohort: Cohort,
  protocol: Protocol,
  report: CohortReport,
) {
  const outcome = slotOutcomes(cohort, protocol);
  const prompts = cohort.expected.prompts;
  const seeds = cohort.expected.seedsPerPrompt;
  const clusters = new Map<string, { sum: number; n: number }>();
  const add = (prompt: string, score: number, weight = 1) => {
    const c = clusters.get(prompt) ?? { sum: 0, n: 0 };
    c.sum += score * weight;
    c.n += weight;
    clusters.set(prompt, c);
  };
  if (report.endpoint === "preference") {
    const declared = new Set(prompts);
    const pairs = new Map(cohort.pairs.map((p) => [p.pairId, p]));
    for (const v of cohort.votes) {
      const pair = pairs.get(v.pairId);
      if (!pair || !declared.has(pair.promptId)) continue;
      if (!v.attentionPassed) {
        report.excludedVotes++;
        continue;
      }
      const productSide = pair.left === cohort.product ? "left" : "right";
      add(
        pair.promptId,
        v.choice === "tie" ? 0.5 : v.choice === productSide ? 1 : 0,
      );
    }
    // Intention to treat: a slot one side failed counts as that side losing
    // every rater's vote; a slot both failed, as ties.
    const raters = protocol.sampling.ratersPerPair;
    for (const prompt of prompts)
      for (let seed = 0; seed < seeds; seed++) {
        const mine = outcome(prompt, seed, cohort.product);
        const theirs = outcome(prompt, seed, cohort.comparator);
        if (mine === undefined || theirs === undefined || (mine && theirs))
          continue;
        add(prompt, mine ? 1 : theirs ? 0 : 0.5, raters);
      }
  } else
    for (const prompt of prompts) {
      let mine = 0;
      let theirs = 0;
      let n = 0;
      for (let seed = 0; seed < seeds; seed++) {
        const a = outcome(prompt, seed, cohort.product);
        const b = outcome(prompt, seed, cohort.comparator);
        if (a === undefined || b === undefined) continue;
        mine += a ? 1 : 0;
        theirs += b ? 1 : 0;
        n++;
      }
      if (n) add(prompt, 0.5 + (mine - theirs) / n / 2);
    }
  return [...clusters.values()];
}

// The product's and comparator's success rates over prompts (each prompt
// one cluster), and the product's lower bound by cluster bootstrap.
function successRates(cohort: Cohort, protocol: Protocol, seed: number) {
  const outcome = slotOutcomes(cohort, protocol);
  const rates = (product: string) =>
    cohort.expected.prompts.flatMap((prompt) => {
      let ok = 0;
      let n = 0;
      for (let s = 0; s < cohort.expected.seedsPerPrompt; s++) {
        const o = outcome(prompt, s, product);
        if (o === undefined) continue;
        n++;
        if (o) ok++;
      }
      return n ? [{ sum: ok, n }] : [];
    });
  const mean = (c: { sum: number; n: number }[]) => {
    const t = c.reduce((a, x) => ({ sum: a.sum + x.sum, n: a.n + x.n }), {
      sum: 0,
      n: 0,
    });
    return t.n ? t.sum / t.n : null;
  };
  const mine = rates(cohort.product);
  const { alpha, bootstrapResamples } = protocol.statistics;
  return {
    product: mean(mine),
    comparator: mean(rates(cohort.comparator)),
    productLower: mine.length
      ? quantile(clusterBootstrap(mine, bootstrapResamples, seed), alpha / 2)
      : null,
  };
}

export function analyse(
  observations: Observations,
  protocol: Protocol,
  protocolSha256: string,
) {
  const parsed: Parsed = ObservationsSchema.parse(observations);
  if (parsed.protocolSha256 !== protocolSha256)
    throw new CommandError(
      "VALIDATION",
      "These observations were recorded against another protocol version.",
    );
  const { alpha, bootstrapResamples, bootstrapSeed } = protocol.statistics;
  const draws = parsed.cohorts.reduce(
    (n, c) => n + 2 * bootstrapResamples * c.expected.prompts.length,
    0,
  );
  if (draws > BENCHMARK_LIMITS.bootstrapDraws)
    throw new CommandError(
      "LIMIT_EXCEEDED",
      "These observations need more bootstrap work than one analysis allows; split them.",
    );
  const reports: CohortReport[] = [];
  // Every cohort with records is in the Holm family, declared before any
  // label: one blocked by its records counts with p = 1.
  const family: {
    index: number;
    p: number;
    boot: number[] | null;
    direction: 1 | -1;
  }[] = [];
  parsed.cohorts.forEach((cohort, index) => {
    const category = protocol.categories.find((c) => c.id === cohort.category)!;
    const report: CohortReport = {
      cohort: cohort.id,
      category: cohort.category,
      endpoint: category.primaryEndpoint,
      analysis: cohort.analysis,
      label: "NOT TESTED",
      reasons: [],
      prompts: cohort.expected.prompts.length,
      trials: cohort.trials.length,
      votes: cohort.votes.length,
      excludedVotes: 0,
      estimate: null,
      interval: null,
      adjustedInterval: null,
      pValue: null,
      adjustedPValue: null,
      success: { product: null, comparator: null, productLower: null },
    };
    reports.push(report);
    if (cohort.trials.length === 0 && cohort.votes.length === 0) {
      report.reasons.push("No valid matched run was recorded for this cohort.");
      return;
    }
    report.label = "INCONCLUSIVE";
    const problems = integrity(cohort, protocol, parsed.consents);
    if (problems.length) {
      for (const { problem, count } of problems)
        report.reasons.push(
          `${problem} (${count}): the records cannot support a comparison label.`,
        );
      family.push({ index, p: 1, boot: null, direction: 1 });
      return;
    }
    report.success = successRates(
      cohort,
      protocol,
      bootstrapSeed + 7919 * (index + 1),
    );
    const clusters = promptScores(cohort, protocol, report);
    if (clusters.length === 0) {
      report.reasons.push("No usable comparisons were recorded.");
      family.push({ index, p: 1, boot: null, direction: 1 });
      return;
    }
    // Back to the endpoint's scale: preference as is, success difference
    // as twice the distance from 0.5.
    const scale = (x: number) =>
      report.endpoint === "preference" ? x : 2 * (x - 0.5);
    const total = clusters.reduce(
      (a, c) => ({ sum: a.sum + c.sum, n: a.n + c.n }),
      { sum: 0, n: 0 },
    );
    report.estimate = scale(total.sum / total.n);
    const boot = clusterBootstrap(
      clusters,
      bootstrapResamples,
      bootstrapSeed + index,
    );
    report.interval = {
      lower: scale(quantile(boot, alpha / 2)),
      upper: scale(quantile(boot, 1 - alpha / 2)),
    };
    const below = boot.filter((x) => x <= 0.5).length / boot.length;
    const above = boot.filter((x) => x >= 0.5).length / boot.length;
    report.pValue = Math.min(1, 2 * Math.min(below, above));
    family.push({
      index,
      p: report.pValue,
      boot,
      direction: below < above ? 1 : -1,
    });
  });
  const adjusted = holm(family.map((f) => f.p));
  // Holm's step level for each member: alpha / (m - rank).
  const ranked = family
    .map((f, k) => ({ k, p: f.p }))
    .sort((a, b) => a.p - b.p);
  const level: number[] = Array.from({ length: family.length }, () => alpha);
  ranked.forEach(({ k }, rank) => (level[k] = alpha / (family.length - rank)));
  family.forEach((f, k) => {
    const report = reports[f.index]!;
    const cohort = parsed.cohorts[f.index]!;
    report.adjustedPValue = adjusted[k]!;
    if (!f.boot) return;
    const scale = (x: number) =>
      report.endpoint === "preference" ? x : 2 * (x - 0.5);
    report.adjustedInterval = {
      lower: scale(quantile(f.boot, level[k]! / 2)),
      upper: scale(quantile(f.boot, 1 - level[k]! / 2)),
    };
    if (adjusted[k]! < alpha) {
      if (f.direction === -1) {
        report.label = "LOSES";
        report.reasons.push("The adjusted comparison favours the comparator.");
        return;
      }
      const floor = cohort.successFloor;
      const lower = report.success.productLower;
      if (floor !== undefined && (lower === null || lower < floor)) {
        report.reasons.push(
          `Preferred, but the success rate's lower bound is below the declared floor of ${floor}.`,
        );
        return;
      }
      report.label = "WINS";
      report.reasons.push("The adjusted comparison favours the product.");
      return;
    }
    // No difference established: a match only inside a declared margin,
    // tested at the cohort's adjusted level (two one-sided tests).
    if (cohort.equivalenceMargin !== undefined) {
      const m = cohort.equivalenceMargin;
      const lo = scale(quantile(f.boot, level[k]!));
      const hi = scale(quantile(f.boot, 1 - level[k]!));
      const centre = report.endpoint === "preference" ? 0.5 : 0;
      if (lo >= centre - m && hi <= centre + m) {
        report.label = "MATCHES";
        report.reasons.push(
          `The adjusted equivalence interval lies within the declared margin of ${m}.`,
        );
        return;
      }
    }
    report.reasons.push(
      "No difference was established at the adjusted level; this is not a match.",
    );
  });
  return {
    format: BENCHMARK_REPORT_FORMAT,
    protocolVersion: protocol.version,
    protocolSha256,
    analysedCohorts: reports.length,
    holmFamily: family.length,
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
