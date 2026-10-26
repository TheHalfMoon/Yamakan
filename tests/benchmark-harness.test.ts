// YU-090: the benchmark harness on synthetic records. Known results are
// recomputed, clustering by prompt is respected, failures stay in the
// analysis, and incomplete or dishonest records never earn a label.
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
const RATERS = protocol.sampling.ratersPerPair;
const hash = (n: number) => n.toString(16).padStart(64, "0");
type CohortInput = Observations["cohorts"][number];
type TrialInput = CohortInput["trials"][number];

// A preference cohort: `prompts` prompts, one seed, `raters` votes per
// pair, each preferring the product with probability `p` (seeded).
function preferenceCohort(
  id: string,
  prompts: number,
  p: number,
  seed: number,
  extra: Partial<CohortInput> = {},
  raters = RATERS,
): CohortInput {
  const random = prng(seed);
  const promptIds = Array.from({ length: prompts }, (_, i) => `${id}-p${i}`);
  const trials: TrialInput[] = promptIds.flatMap((promptId, i) =>
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
    seed: 0,
    left: i % 2 ? "yamakan" : "rival",
    right: i % 2 ? "rival" : "yamakan",
    leftTrialId: `${promptId}-${i % 2 ? "yamakan" : "rival"}`,
    rightTrialId: `${promptId}-${i % 2 ? "rival" : "yamakan"}`,
  }));
  const votes = pairs.flatMap((pair, i) =>
    Array.from({ length: raters }, (_, r) => {
      const productSide = pair.left === "yamakan" ? "left" : "right";
      const otherSide = productSide === "left" ? "right" : "left";
      return {
        pairId: pair.pairId,
        raterId: `rater-${(i + r) % 50}-${r}`,
        choice: (random() < p ? productSide : otherSide) as "left" | "right",
        attentionPassed: true,
      };
    }),
  );
  return {
    id,
    category: "B",
    modality: "silent",
    product: "yamakan",
    comparator: "rival",
    analysis: "bestWithinBudget",
    expected: { prompts: promptIds, seedsPerPrompt: 1 },
    successFloor: 0,
    trials,
    pairs,
    votes,
    ...extra,
  };
}
const observations = (
  cohorts: CohortInput[],
  consents: Observations["consents"] = [],
): Observations => ({
  format: BENCHMARK_OBSERVATIONS_FORMAT,
  protocolSha256,
  consents,
  cohorts,
});
const run = (cohorts: CohortInput[], consents?: Observations["consents"]) =>
  analyse(observations(cohorts, consents), protocol, protocolSha256);
const one = (cohort: CohortInput) => run([cohort]).cohorts[0]!;
const hasReason = (report: { reasons: string[] }, problem: string) =>
  report.reasons.some((r) => r.startsWith(problem));
const promptOf = (pairId: string) => pairId.replace(/-pair$/, "");

test("the frozen protocol defines categories A to L, labels and statistics", () => {
  assert.equal(protocol.categories.map((c) => c.id).join(""), "ABCDEFGHIJKL");
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
  const empty = one({
    ...preferenceCohort("b", 3, 0.5, 1),
    trials: [],
    pairs: [],
    votes: [],
  });
  assert.equal(empty.label, "NOT TESTED");
});

test("a small hand-computed cohort gives its exact estimate", () => {
  // Two prompts: 3 of 3 votes for the product, then 1 of 3; each slot
  // weighs one, so the estimate is (1 + 1/3) / 2, whatever the bootstrap does.
  const cohort = preferenceCohort("exact", 2, 0.5, 2);
  cohort.votes = cohort.votes.map((v, i) => {
    const pair = cohort.pairs.find((p) => p.pairId === v.pairId)!;
    const productSide = pair.left === "yamakan" ? "left" : "right";
    const other = productSide === "left" ? "right" : "left";
    return { ...v, choice: (i < 4 ? productSide : other) as "left" | "right" };
  });
  assert.equal(one(cohort).estimate, 4 / 6);
});

test("known synthetic results are recomputed: a true 0.7 preference wins, 0.3 loses", () => {
  const cohorts = [
    preferenceCohort("win", 240, 0.7, 11),
    preferenceCohort("lose", 240, 0.3, 12),
  ];
  const report = run(cohorts);
  const [win, lose] = report.cohorts;
  assert.equal(win!.label, "WINS");
  assert.ok(Math.abs(win!.estimate! - 0.7) < 0.05, String(win!.estimate));
  // The adjusted interval agrees with the label.
  assert.ok(win!.adjustedInterval!.lower > 0.5);
  assert.equal(lose!.label, "LOSES");
  assert.ok(lose!.adjustedInterval!.upper < 0.5);
  // Deterministic: the same records give the same report, bit for bit.
  assert.deepEqual(run(cohorts), report);
});

test("the 95% interval covers the true preference in about 95% of synthetic studies", () => {
  let covered = 0;
  const studies = 60;
  for (let seed = 100; seed < 100 + studies; seed++) {
    const { interval } = one(preferenceCohort(`c${seed}`, 120, 0.65, seed));
    if (interval!.lower <= 0.65 && interval!.upper >= 0.65) covered++;
  }
  // 95% nominal; at least 50 of 60 (a binomial lower tail far below 1%).
  assert.ok(covered >= 50, `covered ${covered} of ${studies}`);
});

test("raters within a prompt are not independent samples", () => {
  // 10 prompts, 60 raters each: 600 votes, but only 10 independent prompts.
  // Each prompt carries its own leaning, so votes within a prompt agree.
  const random = prng(5);
  const base = preferenceCohort("clustered", 10, 0.5, 7, {}, 60);
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
  const sixty = {
    ...protocol,
    sampling: { ...protocol.sampling, ratersPerPair: 60 },
  };
  const cohort = analyse(
    observations([{ ...base, votes }]),
    sixty,
    protocolSha256,
  ).cohorts[0]!;
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

test("missing trials, removed retries, duplicates, missing votes and mixed modality block a win", () => {
  const good = preferenceCohort("good", 240, 0.7, 21);
  assert.equal(one(good).label, "WINS");
  const cases: [string, CohortInput, string][] = [
    ["missing", { ...good, trials: good.trials.slice(2) }, "MISSING_TRIALS"],
    [
      "retries",
      // The recorded attempt is 2: attempt 1 (a failure) was removed.
      {
        ...good,
        trials: good.trials.map((t, i) => (i === 0 ? { ...t, attempt: 2 } : t)),
      },
      "RETRIES_REMOVED",
    ],
    [
      "duplicate rater",
      { ...good, votes: [...good.votes, good.votes[0]!] },
      "DUPLICATE_RATER",
    ],
    [
      // Every vote the rival won was dropped.
      "dropped votes",
      {
        ...good,
        votes: good.votes.filter((v) => {
          const pair = good.pairs.find((p) => p.pairId === v.pairId)!;
          return v.choice === (pair.left === "yamakan" ? "left" : "right");
        }),
      },
      "MISSING_VOTES",
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
    [
      // More seeds were run than declared (the best one kept as seed 0).
      "undeclared seed",
      {
        ...good,
        trials: [
          ...good.trials,
          { ...good.trials[0]!, trialId: "extra", seed: 4 },
        ],
      },
      "UNDECLARED_SEED",
    ],
    [
      "duplicate pair id",
      { ...good, pairs: [...good.pairs, good.pairs[0]!] },
      "DUPLICATE_ID",
    ],
    [
      "extra votes",
      {
        ...good,
        votes: [...good.votes, { ...good.votes[0]!, raterId: "extra-rater" }],
      },
      "EXCESS_VOTES",
    ],
    ["no floor", { ...good, successFloor: undefined }, "FLOOR_UNDECLARED"],
    [
      // The pair shows a re-run of the product, not its deciding trial.
      "pair shows another output",
      {
        ...good,
        trials: [
          ...good.trials,
          ...good.trials
            .filter(
              (t) =>
                t.product === "yamakan" &&
                t.promptId === good.expected.prompts[0],
            )
            .map((t) => ({
              ...t,
              trialId: "rerun",
              attempt: 2,
              outputSha256: hash(999),
            })),
        ],
        pairs: good.pairs.map((p, i) =>
          i === 0
            ? {
                ...p,
                ...(p.left === "yamakan"
                  ? { leftTrialId: "rerun" }
                  : { rightTrialId: "rerun" }),
              }
            : p,
        ),
      },
      "PAIR_NOT_DECIDING",
    ],
  ];
  for (const [name, cohort, problem] of cases) {
    const report = one(cohort);
    assert.equal(report.label, "INCONCLUSIVE", name);
    assert.ok(
      hasReason(report, problem),
      `${name}: ${report.reasons.join("; ")}`,
    );
    assert.equal(
      report.interval,
      null,
      `${name}: no interval for blocked records`,
    );
  }
});

test("a failed output loses its comparison: failures never leave the denominator", () => {
  const good = preferenceCohort("itt", 240, 0.7, 22);
  // Half the product's outputs fail; their pairs were never shown.
  const failed = new Set(good.expected.prompts.filter((_, i) => i % 2 === 0));
  const cohort: CohortInput = {
    ...good,
    trials: good.trials.map((t) =>
      t.product === "yamakan" && failed.has(t.promptId)
        ? { ...t, status: "failed" as const, outputSha256: null }
        : t,
    ),
    pairs: good.pairs.filter((p) => !failed.has(p.promptId)),
    votes: good.votes.filter((v) => !failed.has(promptOf(v.pairId))),
  };
  const report = one(cohort);
  // 0.7 on the shown half, 0 on the failed half: about 0.35.
  assert.ok(Math.abs(report.estimate! - 0.35) < 0.05, String(report.estimate));
  assert.equal(report.label, "LOSES");
  // A pair shown for a failed slot is itself an integrity problem.
  assert.ok(
    hasReason(
      one({ ...cohort, pairs: good.pairs, votes: good.votes }),
      "PAIR_WITHOUT_OUTPUTS",
    ),
  );
});

test("a retry after a success is a choice between outputs, never counted", () => {
  const good = preferenceCohort("reroll", 240, 0.7, 24);
  const rerolled = {
    ...good,
    trials: [
      ...good.trials,
      {
        ...good.trials[0]!,
        trialId: `${good.trials[0]!.trialId}-2`,
        attempt: 2,
      },
    ],
  };
  assert.ok(hasReason(one(rerolled), "RETRY_AFTER_OK"));
});

test("first attempt and best within budget are separate analyses", () => {
  const cohort = preferenceCohort("attempts", 60, 0.5, 23, {
    category: "H",
    pairs: [],
    votes: [],
  });
  // The product fails every first attempt and succeeds on its retry.
  const trials = cohort.trials.flatMap((t) =>
    t.product === "yamakan"
      ? [
          { ...t, status: "timeout" as const, outputSha256: null },
          { ...t, trialId: `${t.trialId}-2`, attempt: 2 },
        ]
      : [t],
  );
  const best = one({ ...cohort, trials, analysis: "bestWithinBudget" });
  const first = one({ ...cohort, trials, analysis: "firstAttempt" });
  assert.equal(best.success.product, 1);
  assert.equal(first.success.product, 0);
  assert.equal(first.label, "LOSES");
  assert.notEqual(best.label, "LOSES");
});

test("task success keeps every failure and reports the difference in success rate", () => {
  const cohort = preferenceCohort("success", 40, 0.5, 3, {
    category: "H",
    pairs: [],
    votes: [],
  });
  const trials = cohort.trials.map((t, i) =>
    t.product === "yamakan" && i % 10 === 0
      ? { ...t, status: "failed" as const, outputSha256: null }
      : t,
  );
  const report = one({ ...cohort, trials });
  assert.equal(report.endpoint, "taskSuccess");
  const failed = trials.filter(
    (t) => t.product === "yamakan" && t.status === "failed",
  ).length;
  assert.equal(report.success.product, (40 - failed) / 40);
  assert.equal(report.success.comparator, 1);
  assert.ok(
    Math.abs(report.estimate! + failed / 40) < 1e-12,
    String(report.estimate),
  );
  assert.equal(report.label, "LOSES");
});

test("MATCHES needs a declared margin, and a significant difference is never a match", () => {
  const even = preferenceCohort("even", 240, 0.5, 31);
  assert.equal(one(even).label, "INCONCLUSIVE");
  assert.equal(one({ ...even, equivalenceMargin: 0.08 }).label, "MATCHES");
  // Too small a sample for the margin: still INCONCLUSIVE.
  assert.equal(
    one(preferenceCohort("small", 12, 0.5, 32, { equivalenceMargin: 0.08 }))
      .label,
    "INCONCLUSIVE",
  );
  // A clear loss inside a generous margin is a loss.
  assert.equal(
    one(preferenceCohort("loss", 240, 0.35, 33, { equivalenceMargin: 0.2 }))
      .label,
    "LOSES",
  );
});

test("the Holm family is every cohort with records, blocked ones included", () => {
  const strong = preferenceCohort("strong", 240, 0.7, 41);
  const blocked = { ...preferenceCohort("blocked", 240, 0.7, 42), votes: [] };
  const report = run([strong, blocked]);
  assert.equal(report.holmFamily, 2);
  assert.equal(
    report.cohorts[0]!.adjustedPValue,
    Math.min(1, 2 * report.cohorts[0]!.pValue!),
  );
});

test("a declared success floor holds back a preference win", () => {
  const preferred = preferenceCohort("floor", 240, 0.8, 43, {
    successFloor: 0.9,
  });
  const failed = new Set(
    preferred.expected.prompts.filter((_, i) => i % 10 === 0),
  );
  const cohort = {
    ...preferred,
    trials: preferred.trials.map((t) =>
      t.product === "yamakan" && failed.has(t.promptId)
        ? { ...t, status: "failed" as const, outputSha256: null }
        : t,
    ),
    pairs: preferred.pairs.filter((p) => !failed.has(p.promptId)),
    votes: preferred.votes.filter((v) => !failed.has(promptOf(v.pairId))),
  };
  // Still preferred overall, but 90% success has a lower bound below 0.9.
  const held = one(cohort);
  assert.ok(held.estimate! > 0.6, String(held.estimate));
  assert.equal(held.label, "INCONCLUSIVE");
  assert.ok(held.reasons.some((r) => /floor/.test(r)));
  assert.equal(one({ ...cohort, successFloor: 0.8 }).label, "WINS");
});

test("consent must be listed once, in date order, and not past its deletion date", () => {
  const cohort = preferenceCohort("kept", 30, 0.5, 53, { category: "F" });
  const withConsent = {
    ...cohort,
    trials: cohort.trials.map((t) => ({ ...t, consentId: "c-1" })),
  };
  const entry = {
    consentId: "c-1",
    categories: ["F" as const],
    grantedAt: "2026-01-01",
    deleteBy: "2026-06-30",
  };
  const expired = analyse(
    observations([withConsent], [entry]),
    protocol,
    protocolSha256,
    {
      analysedAt: "2026-10-26",
    },
  ).cohorts[0]!;
  assert.ok(hasReason(expired, "CONSENT_EXPIRED"));
  const inTime = analyse(
    observations([withConsent], [entry]),
    protocol,
    protocolSha256,
    {
      analysedAt: "2026-05-01",
    },
  ).cohorts[0]!;
  assert.ok(!hasReason(inTime, "CONSENT_EXPIRED"));
  assert.throws(() =>
    run([withConsent], [entry, { ...entry, categories: ["C", "F"] }]),
  );
  assert.throws(() =>
    run([withConsent], [{ ...entry, deleteBy: "2025-12-31" }]),
  );
});

test("consent must come from the registry and cover the category", () => {
  const cohort = preferenceCohort("faces", 30, 0.5, 51, { category: "F" });
  const withConsent = {
    ...cohort,
    trials: cohort.trials.map((t) => ({ ...t, consentId: "consent-1" })),
  };
  assert.ok(
    hasReason(one(withConsent), "CONSENT_MISSING"),
    "no registry entry",
  );
  const registry = (categories: ("C" | "F")[]) => [
    {
      consentId: "consent-1",
      categories,
      grantedAt: "2026-10-01",
      deleteBy: "2099-10-01",
    },
  ];
  assert.ok(
    !hasReason(
      run([withConsent], registry(["F"])).cohorts[0]!,
      "CONSENT_MISSING",
    ),
  );
  assert.ok(
    hasReason(
      run([withConsent], registry(["C"])).cohorts[0]!,
      "CONSENT_MISSING",
    ),
    "another category",
  );
});

test("Holm, Wilson and the normal quantile are exact; attention failures are excluded", () => {
  assert.deepEqual(
    holm([0.01, 0.04, 0.03]).map((p) => +p.toFixed(6)),
    [0.03, 0.06, 0.06],
  );
  assert.ok(Math.abs(normalQuantile(0.975) - 1.959964) < 1e-5);
  const w = wilson(7, 10);
  assert.ok(
    Math.abs(w.lower! - 0.3968) < 1e-3 && Math.abs(w.upper! - 0.8922) < 1e-3,
  );
  const cohort = preferenceCohort("attention", 240, 0.7, 52);
  cohort.votes[0] = { ...cohort.votes[0]!, attentionPassed: false };
  assert.equal(one(cohort).excludedVotes, 1);
});

test("blinding: sides and order are randomised from one seed and raters never see products", () => {
  const pairs = Array.from({ length: 1000 }, (_, i) => ({
    pairId: `pair-${i}`,
    promptId: `prompt-${i}`,
    a: { product: "yamakan", outputSha256: hash(i) },
    b: { product: "rival", outputSha256: hash(5000 + i) },
  }));
  const blinded = blind(pairs, 99);
  assert.deepEqual(blind(pairs, 99), blinded);
  assert.notDeepEqual(blind(pairs, 100).raterView, blinded.raterView);
  const left = blinded.assignments.filter((a) => a.left === "yamakan").length;
  assert.ok(left > 440 && left < 560, String(left));
  const shown = JSON.stringify(blinded.raterView);
  assert.ok(!shown.includes("yamakan") && !shown.includes("rival"));
  assert.notDeepEqual(
    blinded.raterView.map((v) => v.pairId),
    pairs.map((p) => p.pairId),
  );
});

test("records are bounded, strict, bound to the protocol, and never hold credentials", () => {
  const cohort = preferenceCohort("strict", 4, 0.5, 61);
  const text = (o: unknown) => JSON.stringify(o);
  const refused = (value: unknown, code = "VALIDATION") =>
    assert.throws(
      () => parseObservations(typeof value === "string" ? value : text(value)),
      (e: unknown) =>
        (e instanceof CommandError && e.code === code) ||
        (code === "VALIDATION" && (e as Error).name === "ZodError"),
    );
  refused({ ...observations([cohort]), cohorts: [{ ...cohort, apiKey: "x" }] });
  for (const secret of [
    "sk-abcdefghijklmnopqrstuv",
    "AIzaSyA1234567890abcdefghijklmnopqrstu",
    "eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0",
    "aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xYz",
    "aB3dE5fG7hJ9kL1mN3pQ5rS7-tU9vW1xYz4Q",
  ])
    refused({
      ...observations([cohort]),
      cohorts: [
        { ...cohort, trials: [{ ...cohort.trials[0]!, trialId: secret }] },
      ],
    });
  refused({ ...observations([cohort]), cohorts: [{ ...cohort, unknown: 1 }] });
  // An ok trial must name its output.
  refused({
    ...observations([cohort]),
    cohorts: [
      { ...cohort, trials: [{ ...cohort.trials[0]!, outputSha256: null }] },
    ],
  });
  // Nesting is refused before parsing.
  refused(`${"[".repeat(100)}${"]".repeat(100)}`);
  assert.throws(
    () =>
      analyse(
        { ...observations([cohort]), protocolSha256: hash(1) },
        protocol,
        protocolSha256,
      ),
    /another protocol version/,
  );
  // A parsed file round-trips; lower-case hashes are not mistaken for keys.
  assert.deepEqual(
    parseObservations(text(observations([cohort]))),
    observations([cohort]),
  );
});
