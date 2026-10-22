/**
 * P10-07 — W12/Q11 engineering gate (not a performance pass).
 * Confirms JASSUB stays disabled and title preview construction refuses.
 * Does not claim ≤4 ms/frame or SSIM; those require a pinned build + H1.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  JASSUB_ENABLED,
  jassubCapability,
} from "../core/preview/jassub-flags.ts";
import { createTitlePreview } from "../src/preview/titles.ts";

assert.equal(JASSUB_ENABLED, false);
const cap = jassubCapability();
assert.equal(cap.available, false);
assert.ok(cap.unsupported?.includes("live-jassub-preview"));

let refused = false;
try {
  await createTitlePreview({
    canvas: /** @type {any} */ ({}),
    ass: "[Script Info]\n",
    fonts: [],
  });
} catch {
  refused = true;
}
assert.equal(refused, true, "createTitlePreview must refuse while disabled");

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const receiptPath = join(outDir, "q11-jassub-eng.json");
const receipt = {
  qualification: "Q11_JASSUB_ENG",
  task: "P10-07",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  jassubEnabled: false,
  performanceClaimed: false,
  ssimClaimed: false,
  h1Signed: false,
  npmPinStatus: "not-installed-pending-notices",
  targetPin: "jassub@2.5.20 (dea3d2d3)",
  cspWasmUnsafeEval: "not-applied",
  passed: true,
  detail:
    "Engineering gate only: flag false, preview construction refuses, H1 unsigned, no Q11 perf/SSIM claim.",
};
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(readFileSync(receiptPath, "utf8"));
console.log(`Q11 JASSUB ENG PASS (disabled) — ${receiptPath}`);
