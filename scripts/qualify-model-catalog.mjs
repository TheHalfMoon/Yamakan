/**
 * MPR-201: the model catalog against the five lists it must agree with, and the frozen
 * candidates evidence's hash. No network, no Kaggle CLI, no ComfyUI, no model: it reads files
 * of this repository, and starts git to name the commit and what reads the host's power.
 *
 * What this host has is recorded first. What the run needs is unmeasured.
 *
 * Usage: node scripts/qualify-model-catalog.mjs [receipt.json]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain") !== "";

const EVIDENCE = "docs/evidence/ultimate/engine-candidate-manifests.json";
// Loaded here, so that a catalog that does not parse is in the receipt as well.
let failure = null;
let checked = { passed: false };
try {
  const [
    { parseEngineCandidates },
    { CHECKED_LISTS, MODEL_CATALOG, catalogDisagreements },
    { PINNED_COMFY_RECIPES },
    { KAGGLE_RECIPES },
    { PINNED_MODEL_MANIFESTS },
    { CREATE_MODELS },
  ] = await Promise.all([
    import("../core/engines/candidates.ts"),
    import("../core/engines/catalog.ts"),
    import("../core/engines/comfyui.ts"),
    import("../core/engines/kaggle.ts"),
    import("../core/engines/manifests.ts"),
    import("../src/create/create-model.ts"),
  ]);
  const bytes = readFileSync(new URL(`../${EVIDENCE}`, import.meta.url));
  const lists = {
    kaggleRecipes: KAGGLE_RECIPES,
    comfyRecipes: PINNED_COMFY_RECIPES,
    modelPins: PINNED_MODEL_MANIFESTS,
    candidates: parseEngineCandidates(JSON.parse(bytes.toString("utf8")))
      .candidates,
    createModels: CREATE_MODELS,
  };
  const disagreements = catalogDisagreements(lists);
  for (const line of disagreements) console.error(line);
  checked = {
    passed: disagreements.length === 0,
    entries: MODEL_CATALOG.entries.length,
    refusals: MODEL_CATALOG.refused.length,
    lists: Object.entries(CHECKED_LISTS).map(([key, list]) => ({
      list,
      items: lists[key].length,
      disagreements: disagreements.filter((d) => d.startsWith(`${list}: `)),
    })),
    evidence: {
      path: EVIDENCE,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error(failure);
}
const { passed, ...results } = checked;
const receiptOut =
  process.argv[2] ??
  fileURLToPath(
    new URL(
      "../docs/evidence/model-system/model-catalog.json",
      import.meta.url,
    ),
  );
mkdirSync(path.dirname(receiptOut), { recursive: true });
writeFileSync(
  receiptOut,
  `${JSON.stringify(
    {
      task: "MPR-201",
      head,
      dirty,
      host,
      outcome: passed ? "PASS" : "FAIL",
      passed,
      failure,
      ...results,
    },
    null,
    2,
  )}\n`,
);
console.log(passed ? "PASS" : "FAIL", receiptOut);
process.exitCode = passed ? 0 : 1;
