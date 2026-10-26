// YU-090: the benchmark harness on synthetic records. Known results are
// recomputed, clustering by prompt is respected, and incomplete or
// dishonest records never earn a comparison label.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CommandError } from "../core/command/errors.ts";
import {
  BENCHMARK_OBSERVATIONS_FORMAT,
  analyse,
  blind,
  holm,
  normalQuantile,
  parseObservations,
  parseProtocol,
  prng,
  wilson,
  type Observations,
} from "../core/quality/benchmark.ts";

const protocolText = await readFile(
  new URL("../docs/evidence/ultimate/benchmark-protocol.json", import.meta.url),
  "utf8",
);
const { protocol, sha256: protocolSha256 } = parseProtocol(protocolText);
const hash = (n: number) => n.toString(16).padStart(64, "0");

// A preference cohort: `prompts` prompts, `raters` votes per prompt, each
// vote preferring the product with probability `p` (seeded, so known).
function preferenceCohort(
  id: string,
  prompts: number,
  raters: number,
  p: number,
  seed: number,
  extra: Partial<Observations["cohorts"][number]> = {},
) {
  const random = prng(seed);
  const promptIds = Array.from({ length: prompts }, (_, i) => `${id}-p${i}`);
  const trials = promptIds.flatMap((promptId, i) =>
    ["yamakan", "rival"].map((product, k) => ({
      trialId: `${promptId}-${product}`,
      promptId,
      product,
      seed: 0,
      attempt: 1,
      status: "ok" as const,
      modality: "silent" as const,
      inputSha256: hash(i),
      outputSha256: hash(1e6 + i * 2 + k),
    })),
  );
  const pairs = promptIds.map((promptId, i) => ({
    pairId: `${promptId}-pair`,
    promptId,
    left: i % 2 ? "yamakan" : "rival",
    right: i % 2 ? "rival" : "yamakan",
  }));
  const votes = pairs.flatMap((pair, i) =>
    Array.from({ length: raters }, (_, r) => {
      const prefersProduct = random() < p;
      const productSide = pair.left === "yamakan" ? "left" : "right";
      const otherSide = productSide === "left" ? "right" : "left";
      return {
        pairId: pair.pairId,
        raterId: `rater-${(i + r) % 50}-${r}`,
        choice: (prefersProduct ? productSide : otherSide) as "left" | "right",
        attentionPassed: true,
      };
    }),
  );
  return {
    id,
    category: "B" as const,
    modality: "silent" as const,
    product: "yamakan",
    comparator: "rival",
    expected: { prompts: promptIds, seedsPerPrompt: 1 },
    trials,
    pairs,
    votes,
    ...extra,
  };
}
const observations = (cohorts: Observations["cohorts"]): Observations => ({
  format: BENCHMARK_OBSERVATIONS_FORMAT,
  protocolSha256,
  cohorts,
});
const run = (cohorts: Observations["cohorts"]) =>
  analyse(observations(cohorts), protocol, protocolSha256);

test("the frozen protocol defines categories A to L, labels and statistics", () => {
  assert.deepEqual(
    protocol.categories.map((c) => c.id).join(""),
    "ABCDEFGHIJKL",
  );
  assert.deepEqual(protocol.labels, [
    "WINS",
    "MATCHES",
    "LOSES",
    "INCONCLUSIVE",
    "NOT TESTED",
  ]);
  assert.equal(protocol.statistics.multipleComparisons, "holm");
  // A different protocol byte is a different protocol.
  assert.notEqual(parseProtocol(`${protocolText}\n`).sha256, protocolSha256);
});

test("with nothing recorded, every category is NOT TESTED", () => {
  const report = run([]);
  assert.equal(report.categories.length, 12);
  assert.ok(report.categories.every((c) => c.labels.join() === "NOT TESTED"));
  const empty = run([
    {
      ...preferenceCohort("b", 0, 0, 0.5, 1),
      trials: [],
      pairs: [],
      votes: [],
    },
  ]);
  assert.equal(empty.cohorts[0]!.label, "NOT TESTED");
});

test("known synthetic results are recomputed: a true 0.7 preference wins, 0.3 loses", () => {
  const report = run([
    preferenceCohort("win", 240, 3, 0.7, 11),
    preferenceCohort("lose", 240, 3, 0.3, 12),
  ]);
  const [win, lose] = report.cohorts;
  assert.equal(win!.label, "WINS");
  // Within three standard errors of the truth (720 votes).
  assert.ok(Math.abs(win!.estimate! - 0.7) < 0.05, String(win!.estimate));
  assert.ok(win!.interval!.lower > 0.5);
  assert.equal(lose!.label, "LOSES");
  // Deterministic: the same records give the same report, bit for bit.
  assert.deepEqual(
    run([
      preferenceCohort("win", 240, 3, 0.7, 11),
      preferenceCohort("lose", 240, 3, 0.3, 12),
    ]),
    report,
  );
});

test("the 95% interval covers the true preference in about 95% of synthetic studies", () => {
  let covered = 0;
  const studies = 60;
  for (let seed = 100; seed < 100 + studies; seed++) {
    const { interval } = run([preferenceCohort(`c${seed}`, 120, 3, 0.65, seed)])
      .cohorts[0]!;
    if (interval!.lower <= 0.65 && interval!.upper >= 0.65) covered++;
  }
  // 95% nominal; at least 50 of 60 (a binomial lower tail far below 1%).
  assert.ok(covered >= 50, `covered ${covered} of ${studies}`);
});

test("raters within a prompt are not independent samples", () => {
  // 10 prompts, 60 raters each: 600 votes, but only 10 independent prompts.
  // Each prompt carries its own leaning, so votes within a prompt agree.
  const random = prng(5);
  const base = preferenceCohort("clustered", 10, 60, 0.5, 7);
  const leaning = new Map(
    base.expected.prompts.map((p) => [p, random() < 0.7 ? 0.95 : 0.05]),
  );
  const pairs = new Map(base.pairs.map((p) => [p.pairId, p]));
  const votes = base.votes.map((v) => {
    const pair = pairs.get(v.pairId)!;
    const productSide = pair.left === "yamakan" ? "left" : "right";
    const other = productSide === "left" ? "right" : "left";
    return {
      ...v,
      choice: (random() < leaning.get(pair.promptId)! ? productSide : other) as
        "left" | "right",
    };
  });
  const report = run([{ ...base, votes }]);
  const cohort = report.cohorts[0]!;
  // A naive binomial interval over 600 votes would be about ±0.04 wide; the
  // prompt-clustered interval is far wider, and no win is claimed.
  const naive = wilson(
    Math.round(cohort.estimate! * votes.length),
    votes.length,
  );
  const clusteredWidth = cohort.interval!.upper - cohort.interval!.lower;
  assert.ok(
    clusteredWidth > 3 * (naive.upper! - naive.lower!),
    String(clusteredWidth),
  );
  assert.notEqual(cohort.label, "WINS");
});

test("missing trials, removed retries, duplicate raters and mixed modality block a win", () => {
  const good = preferenceCohort("good", 240, 3, 0.7, 21);
  assert.equal(run([good]).cohorts[0]!.label, "WINS");
  const cases: [string, Observations["cohorts"][number], string][] = [
    ["missing", { ...good, trials: good.trials.slice(2) }, "MISSING_TRIALS"],
    [
      "retries",
      {
        ...good,
        // The recorded attempt is 2: attempt 1 (a failure) was removed.
        trials: good.trials.map((t, i) => (i === 0 ? { ...t, attempt: 2 } : t)),
      },
      "RETRIES_REMOVED",
    ],
    [
      "duplicate",
      { ...good, votes: [...good.votes, good.votes[0]!] },
      "DUPLICATE_RATER",
    ],
    [
      "modality",
      {
        ...good,
        trials: good.trials.map((t, i) =>
          i === 3 ? { ...t, modality: "audio" as const } : t,
        ),
      },
      "MODALITY_MIXED",
    ],
  ];
  for (const [name, cohort, problem] of cases) {
    const report = run([cohort]).cohorts[0]!;
    assert.equal(report.label, "INCONCLUSIVE", name);
    assert.ok(
      report.reasons.some((r) => r.startsWith(problem)),
      `${name}: ${report.reasons.join("; ")}`,
    );
  }
});

test("every failed attempt stays in the denominator", () => {
  const cohort = preferenceCohort("success", 40, 3, 0.5, 3, {
    category: "H",
  });
  // Half of the product's prompts fail first, then succeed on a retry; a
  // fifth fail for good. The final attempt decides each slot.
  const trials = cohort.trials.flatMap((t, i) => {
    if (t.product !== "yamakan") return [t];
    if (i % 10 === 0) return [{ ...t, status: "failed" as const }];
    if (i % 4 === 0)
      return [
        { ...t, status: "timeout" as const },
        { ...t, trialId: `${t.trialId}-2`, attempt: 2 },
      ];
    return [t];
  });
  const report = run([{ ...cohort, trials }]).cohorts[0]!;
  assert.equal(report.endpoint, "taskSuccess");
  const failed = trials.filter(
    (t) => t.product === "yamakan" && t.status === "failed",
  ).length;
  assert.equal(report.success.product.estimate, (40 - failed) / 40);
  assert.equal(report.success.comparator.estimate, 1);
  assert.equal(report.label, "LOSES");
});

test("MATCHES needs a margin declared in advance; without one it is INCONCLUSIVE", () => {
  const even = preferenceCohort("even", 240, 3, 0.5, 31);
  assert.equal(run([even]).cohorts[0]!.label, "INCONCLUSIVE");
  const matched = run([{ ...even, equivalenceMargin: 0.08 }]).cohorts[0]!;
  assert.equal(matched.label, "MATCHES");
  // Too small a sample for the margin: still INCONCLUSIVE.
  const small = preferenceCohort("small", 12, 3, 0.5, 32, {
    equivalenceMargin: 0.08,
  });
  assert.equal(run([small]).cohorts[0]!.label, "INCONCLUSIVE");
});

test("a declared success floor holds back a preference win", () => {
  const preferred = preferenceCohort("floor", 240, 3, 0.7, 41, {
    successFloor: 0.9,
  });
  const trials = preferred.trials.map((t, i) =>
    t.product === "yamakan" && i % 4 === 0
      ? { ...t, status: "failed" as const }
      : t,
  );
  const report = run([{ ...preferred, trials }]).cohorts[0]!;
  assert.equal(report.label, "INCONCLUSIVE");
  assert.ok(report.reasons.some((r) => /floor/.test(r)));
});

test("Holm adjusts across cohorts; Wilson and the normal quantile are exact", () => {
  assert.deepEqual(
    holm([0.01, 0.04, 0.03]).map((p) => +p.toFixed(6)),
    [0.03, 0.06, 0.06],
  );
  assert.ok(Math.abs(normalQuantile(0.975) - 1.959964) < 1e-5);
  const w = wilson(7, 10);
  assert.ok(
    Math.abs(w.lower! - 0.3968) < 1e-3 && Math.abs(w.upper! - 0.8922) < 1e-3,
  );
  // Attention-check failures are excluded and counted.
  const cohort = preferenceCohort("attention", 240, 3, 0.7, 51);
  cohort.votes[0] = { ...cohort.votes[0]!, attentionPassed: false };
  assert.equal(run([cohort]).cohorts[0]!.excludedVotes, 1);
});

test("blinding: sides and order are randomised from one seed and raters never see products", () => {
  const pairs = Array.from({ length: 1000 }, (_, i) => ({
    pairId: `pair-${i}`,
    promptId: `prompt-${i}`,
    a: { product: "yamakan", outputSha256: hash(i) },
    b: { product: "rival", outputSha256: hash(5000 + i) },
  }));
  const one = blind(pairs, 99);
  assert.deepEqual(blind(pairs, 99), one);
  assert.notDeepEqual(blind(pairs, 100).raterView, one.raterView);
  const left = one.assignments.filter((a) => a.left === "yamakan").length;
  assert.ok(left > 440 && left < 560, String(left));
  const shown = JSON.stringify(one.raterView);
  assert.ok(!shown.includes("yamakan") && !shown.includes("rival"));
  assert.notDeepEqual(
    one.raterView.map((v) => v.pairId),
    pairs.map((p) => p.pairId),
  );
});

test("records are bounded, strict, bound to the protocol, and never hold credentials", () => {
  const cohort = preferenceCohort("strict", 4, 1, 0.5, 61);
  const text = (o: unknown) => JSON.stringify(o);
  const refused = (value: unknown, code = "VALIDATION") =>
    assert.throws(
      () => parseObservations(text(value)),
      (e: unknown) =>
        (e instanceof CommandError && e.code === code) ||
        (code === "VALIDATION" && (e as Error).name === "ZodError"),
    );
  refused({ ...observations([cohort]), cohorts: [{ ...cohort, apiKey: "x" }] });
  refused({
    ...observations([cohort]),
    cohorts: [
      {
        ...cohort,
        trials: [
          { ...cohort.trials[0]!, trialId: "sk-abcdefghijklmnopqrstuv" },
        ],
      },
    ],
  });
  refused({ ...observations([cohort]), cohorts: [{ ...cohort, unknown: 1 }] });
  assert.throws(
    () =>
      analyse(
        { ...observations([cohort]), protocolSha256: hash(1) },
        protocol,
        protocolSha256,
      ),
    /another protocol version/,
  );
  // A parsed file round-trips.
  assert.deepEqual(
    parseObservations(text(observations([cohort]))),
    observations([cohort]),
  );
});
