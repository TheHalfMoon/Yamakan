/**
 * P10-05 — Deterministic Quality Lab activation evidence.
 * Enables QUALITY_LAB_ENABLED path; never enables paid providers.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import {
  QUALITY_LAB_ENABLED,
  qualityLabCapability,
  summarizeBlindedComparison,
} from "../core/quality/lab.ts";
import {
  ROUTER_PROVIDERS_ENABLED,
  explainRoutes,
} from "../core/router/explain.ts";
import { execute } from "../core/command/registry.ts";

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

assert.equal(QUALITY_LAB_ENABLED, true);
assert.equal(qualityLabCapability().available, true);
assert.equal(ROUTER_PROVIDERS_ENABLED, false);

const digestA = "a".repeat(64);
const outA = "1".repeat(64);
const outB = "2".repeat(64);
const comparison = {
  format: "yamakan.quality-lab/v1",
  comparisonId: randomUUID(),
  inputHash: digestA,
  consentPurpose: "p10-05-deterministic",
  systems: [
    {
      slot: "A",
      systemId: "fixture-a",
      outputHash: outA,
      attemptCount: 1,
      failureCount: 0,
      latencyMs: 10,
    },
    {
      slot: "B",
      systemId: "fixture-b",
      outputHash: outB,
      attemptCount: 1,
      failureCount: 0,
      latencyMs: 12,
    },
  ],
  ratings: [
    { raterId: "r1", slot: "A", score: 4, rubricVersion: "v1" },
    { raterId: "r1", slot: "B", score: 3, rubricVersion: "v1" },
  ],
};

const summary = summarizeBlindedComparison(comparison);
assert.equal(summary.qualityLabEnabled, true);
assert.match(summary.contentHash, /^[a-f0-9]{64}$/);

const ctx = {
  store: {},
  queue: {},
  principal: {
    id: "local-client",
    scopes: new Set(["project:read"]),
  },
};

const cap = await execute(ctx, "yamakan.quality.capability", {});
assert.equal(cap.result.available, true);

const cmp = await execute(ctx, "yamakan.quality.compare", { comparison });
assert.equal(cmp.result.contentHash, summary.contentHash);

const explain = explainRoutes({ operation: "generate" });
assert.equal(explain.providersEnabled, false);
assert.equal(explain.eligible.length, 0);
assert.ok(
  explain.rejected.some((r) => r.reasonCode === "PROVIDERS_DISABLED"),
);

const routerCmd = await execute(ctx, "yamakan.router.explain", {
  operation: "generate",
});
assert.equal(routerCmd.result.providersEnabled, false);

const receipt = {
  qualification: "P10-05-quality-lab",
  module: "M17",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  qualityLabEnabled: true,
  routerProvidersEnabled: false,
  capabilityAvailable: true,
  compareContentHash: summary.contentHash,
  routerExplain: {
    providersEnabled: false,
    rejectionCodes: explain.rejected.map((r) => r.reasonCode),
  },
  passed: true,
  detail:
    "Deterministic Quality Lab enabled; router explain rejects with PROVIDERS_DISABLED; no paid routes.",
};

const path = join(outDir, "p10-05-quality-lab.json");
writeFileSync(path, JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify({
    wrote: path,
    sha256: createHash("sha256").update(JSON.stringify(receipt)).digest("hex"),
    passed: true,
  }),
);
