import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  QUALITY_EVIDENCE_FORMAT,
  comparisonEvidence,
  summarizeBlindedComparison,
} from "../core/quality/lab.ts";
import { z } from "zod";
import { CommandError } from "../core/command/errors.ts";

const hex = (c: string) => c.repeat(64);
const base = () => ({
  format: "yamakan.quality-lab/v1" as const,
  comparisonId: "6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7",
  inputHash: hex("a"),
  consentPurpose: "quality-lab-pilot",
  systems: [
    {
      slot: "A" as const,
      systemId: "fixture-a",
      outputHash: hex("1"),
      attemptCount: 3,
      failureCount: 1,
      latencyMs: 10,
    },
    {
      slot: "B" as const,
      systemId: "fixture-b",
      outputHash: hex("2"),
      attemptCount: 2,
      failureCount: 0,
      latencyMs: 12,
    },
  ],
  ratings: [
    { raterId: "r1", slot: "A" as const, score: 4, rubricVersion: "v1" },
    { raterId: "r1", slot: "B" as const, score: 3, rubricVersion: "v1" },
    { raterId: "r2", slot: "A" as const, score: 5, rubricVersion: "v1" },
  ],
});

const refused = (doc: unknown, pattern: RegExp) =>
  assert.throws(
    () => summarizeBlindedComparison(doc),
    (e: unknown) =>
      e instanceof CommandError &&
      e.code === "VALIDATION" &&
      pattern.test(e.message),
  );

test("A/B roundtrip: evidence is reproducible and versioned", () => {
  const one = comparisonEvidence(base());
  const two = comparisonEvidence(structuredClone(base()));
  assert.equal(one.format, QUALITY_EVIDENCE_FORMAT);
  assert.equal(QUALITY_EVIDENCE_FORMAT, "yamakan.quality-evidence/v2");
  assert.match(one.sha256, /^[a-f0-9]{64}$/);
  assert.equal(one.sha256, two.sha256);
  // Order of systems and ratings in the document does not matter.
  const shuffled = base();
  shuffled.systems.reverse();
  shuffled.ratings.reverse();
  assert.equal(comparisonEvidence(shuffled).sha256, one.sha256);
});

test("every bound field changes the evidence digest", () => {
  const original = comparisonEvidence(base()).sha256;
  const mutations: Array<(d: ReturnType<typeof base>) => void> = [
    (d) => (d.systems[0]!.outputHash = hex("3")),
    (d) => (d.systems[1]!.systemId = "fixture-c"),
    (d) => (d.systems[0]!.latencyMs = 11),
    (d) => (d.systems[0]!.attemptCount = 4),
    (d) => (d.systems[0]!.failureCount = 0),
    (d) => (d.inputHash = hex("b")),
    (d) => (d.consentPurpose = "other-purpose"),
    (d) => (d.comparisonId = randomUUID()),
    (d) => (d.ratings[0]!.raterId = "r9"),
    (d) => (d.ratings[0]!.score = 2),
    // r2 rates once, so a different rubric keeps the document valid.
    (d) => (d.ratings[2]!.rubricVersion = "v2"),
    (d) => (d.ratings.pop(), undefined),
  ];
  for (const [i, mutate] of mutations.entries()) {
    const doc = base();
    mutate(doc);
    assert.notEqual(
      comparisonEvidence(doc).sha256,
      original,
      `mutation ${i} left the digest unchanged`,
    );
  }
});

test("swapping which system sits in which slot changes the evidence", () => {
  const doc = base();
  const [a, b] = doc.systems;
  doc.systems = [
    { ...b!, slot: "A" },
    { ...a!, slot: "B" },
  ];
  assert.notEqual(
    comparisonEvidence(doc).sha256,
    comparisonEvidence(base()).sha256,
  );
});

test("the v1 blinded content hash is unchanged for valid documents", () => {
  // Computed by the v1 implementation at a3c3ce9 for this exact document;
  // historical summaries are neither recomputed nor relabelled.
  const summary = summarizeBlindedComparison(base());
  assert.equal(
    summary.contentHash,
    "49302230410d13540c3c9a693221a40780adf1f09e0f63ee2e715c8fd7b4bab2",
  );
});

test("the blinded summary carries no system identity or outputs", () => {
  const summary = summarizeBlindedComparison(base());
  const text = JSON.stringify(summary);
  for (const secret of ["fixture-a", "fixture-b", hex("1"), hex("2")])
    assert.ok(!text.includes(secret), `blinded summary leaks ${secret}`);
  assert.ok(!("evidence" in summary));
});

test("A/A and B/B comparisons are refused", () => {
  const aa = base();
  aa.systems[1]!.slot = "A";
  refused(aa, /exactly one system in slot A and one in slot B/);
  const bb = base();
  bb.systems[0]!.slot = "B";
  refused(bb, /exactly one system in slot A and one in slot B/);
});

test("more failures than attempts are refused", () => {
  const doc = base();
  doc.systems[1]!.failureCount = 3;
  refused(doc, /failureCount cannot exceed attemptCount/);
});

test("a rater rating one slot twice is refused", () => {
  const doc = base();
  doc.ratings.push({ raterId: "r1", slot: "A", score: 1, rubricVersion: "v1" });
  refused(doc, /rater r1 rated slot A more than once/);
});

test("a rater mixing rubric versions is refused", () => {
  const doc = base();
  doc.ratings[1]!.rubricVersion = "v2";
  refused(doc, /rater r1 used more than one rubric version/);
});

test("the same system in both slots is refused", () => {
  const doc = base();
  doc.systems[1]!.systemId = "fixture-a";
  refused(doc, /two different systems/);
});

test("evidence validation refuses what the summary refuses", () => {
  const doc = base();
  doc.systems[1]!.slot = "A";
  assert.throws(
    () => comparisonEvidence(doc),
    (e: unknown) => e instanceof CommandError && e.code === "VALIDATION",
  );
});

test("the blinded compare command never returns the private digest", async () => {
  const { commands, execute } = await import("../core/command/registry.ts");
  assert.ok(!("yamakan.quality.evidence" in commands));
  const ctx = {
    store: {},
    queue: {},
    principal: { id: "local-client", scopes: new Set(["project:read"]) },
  } as never;
  const compared = await execute(ctx, "yamakan.quality.compare", {
    comparison: base(),
  });
  const text = JSON.stringify(compared.result);
  assert.ok(!text.includes(comparisonEvidence(base()).sha256));
  assert.ok(!text.includes("fixture-a"));
  // The registry rejects invalid input with the schema's own error, which
  // the service maps to VALIDATION like every other command.
  const aa = base();
  aa.systems[1]!.slot = "A";
  await assert.rejects(
    execute(ctx, "yamakan.quality.compare", { comparison: aa }),
    (e: unknown) =>
      e instanceof z.ZodError &&
      /exactly one system in slot A and one in slot B/.test(e.message),
  );
});

test("rater order is by code unit, so look-alike IDs keep one digest", () => {
  // Distinct to the duplicate check, but equal under locale collation.
  const look = ["r1", "r\u200b1", "e\u0301", "\u00e9"];
  const doc = base();
  doc.ratings = look.map((raterId, i) => ({
    raterId,
    slot: "A" as const,
    score: i + 1,
    rubricVersion: "v1",
  }));
  const forward = comparisonEvidence(doc).sha256;
  doc.ratings.reverse();
  assert.equal(comparisonEvidence(doc).sha256, forward);
});
