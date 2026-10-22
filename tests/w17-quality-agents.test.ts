import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  QUALITY_LAB_ENABLED,
  summarizeBlindedComparison,
  qualityLabCapability,
} from "../core/quality/lab.ts";
import {
  ROUTER_PROVIDERS_ENABLED,
  explainRoutes,
} from "../core/router/explain.ts";
import {
  evaluateReviewIndependenceV1,
  isIndependentReviewV1,
} from "../core/agents/lineage.ts";
import { commands } from "../core/command/registry.ts";

const digestA =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const digestB =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const outA = "1111111111111111111111111111111111111111111111111111111111111111";
const outB = "2222222222222222222222222222222222222222222222222222222222222222";

describe("W17 Quality Lab and router explain", () => {
  it("enables deterministic Quality Lab while providers stay off", () => {
    assert.equal(QUALITY_LAB_ENABLED, true);
    assert.equal(ROUTER_PROVIDERS_ENABLED, false);
    assert.equal(qualityLabCapability().available, true);
  });

  it("blinded comparison summary is reproducible", () => {
    const comparison = {
      format: "yamakan.quality-lab/v1" as const,
      comparisonId: randomUUID(),
      inputHash: digestA,
      consentPurpose: "quality-lab-pilot",
      systems: [
        {
          slot: "A" as const,
          systemId: "studio-take",
          outputHash: outA,
          attemptCount: 2,
          failureCount: 1,
          latencyMs: 1200,
        },
        {
          slot: "B" as const,
          systemId: "export-baseline",
          outputHash: outB,
          attemptCount: 1,
          failureCount: 0,
          latencyMs: 800,
        },
      ],
      ratings: [
        {
          raterId: "r1",
          slot: "A" as const,
          score: 4,
          rubricVersion: "v1",
        },
        {
          raterId: "r2",
          slot: "A" as const,
          score: 2,
          rubricVersion: "v1",
        },
        {
          raterId: "r1",
          slot: "B" as const,
          score: 5,
          rubricVersion: "v1",
        },
      ],
    };
    const once = summarizeBlindedComparison(comparison);
    const twice = summarizeBlindedComparison(comparison);
    assert.equal(once.contentHash, twice.contentHash);
    assert.equal(once.slotAverages.A, 3);
    assert.equal(once.slotAverages.B, 5);
    assert.equal(once.attemptTotals.A, 2);
    assert.equal(once.failureTotals.A, 1);
    assert.equal(once.qualityLabEnabled, true);
  });

  it("router explain ranks nothing when providers are disabled", () => {
    const result = explainRoutes({ operation: "image.generate" }, [
      { routeId: "wan", operation: "image.generate" },
    ]);
    assert.deepEqual(result.eligible, []);
    assert.ok(
      result.rejected.some((r) => r.reasonCode === "PROVIDERS_DISABLED"),
    );
    assert.equal(result.providersEnabled, false);
  });

  it("lineage independence detects self-review", () => {
    const author = {
      model_family: "composer",
      provider_identity: "cursor",
      context_digest: digestA,
    };
    const same = evaluateReviewIndependenceV1(author, { ...author });
    assert.equal(same.verdict, "SELF_REVIEW");
    assert.equal(isIndependentReviewV1(same), false);
    const independent = evaluateReviewIndependenceV1(author, {
      model_family: "sonnet",
      provider_identity: "anthropic",
      context_digest: digestB,
    });
    assert.equal(independent.verdict, "INDEPENDENT");
    assert.equal(isIndependentReviewV1(independent), true);
  });

  it("registers W17 commands", () => {
    assert.ok(commands["yamakan.quality.capability"]);
    assert.ok(commands["yamakan.quality.compare"]);
    assert.ok(commands["yamakan.router.explain"]);
    assert.ok(commands["yamakan.lineage.evaluate"]);
  });
});
