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
import { parseEngineCandidates } from "../core/engines/candidates.ts";
import {
  CHECKED_LISTS,
  MODEL_CATALOG,
  catalogDisagreements,
} from "../core/engines/catalog.ts";
import { PINNED_COMFY_RECIPES } from "../core/engines/comfyui.ts";
import { KAGGLE_RECIPES } from "../core/engines/kaggle.ts";
import { PINNED_MODEL_MANIFESTS } from "../core/engines/manifests.ts";
import { CREATE_MODELS } from "../src/create/create-model.ts";
import { readHost } from "./qualify-host.mjs";

// Before anything runs.
const host = readHost();
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain") !== "";

const EVIDENCE = "docs/evidence/ultimate/engine-candidate-manifests.json";
const bytes = readFileSync(new URL(`../${EVIDENCE}`, import.meta.url));
const { candidates } = parseEngineCandidates(
  JSON.parse(bytes.toString("utf8")),
);
const lists = {
  kaggleRecipes: KAGGLE_RECIPES,
  comfyRecipes: PINNED_COMFY_RECIPES,
  modelPins: PINNED_MODEL_MANIFESTS,
  candidates,
  createModels: CREATE_MODELS,
};
const disagreements = catalogDisagreements(lists);
const passed = disagreements.length === 0;
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
    },
    null,
    2,
  )}\n`,
);
for (const line of disagreements) console.error(line);
console.log(passed ? "PASS" : "FAIL", receiptOut);
process.exitCode = passed ? 0 : 1;
