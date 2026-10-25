/**
 * YU-000 capture: write docs/evidence/ultimate/baseline.json.
 * Does not rewrite historical qualification receipts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { redactLocalPaths } from "./ultimate-environment.mjs";
import {
  BASELINE_FORMAT,
  REQUIRED_HISTORICAL_RECEIPTS,
  evaluateBaseline,
  extractNarrativeHeads,
  fontPins,
  listQualificationReceipts,
  nativeHashes,
  parseCommandNames,
  readFlags,
  receiptsPreserved,
  redactSecrets,
  sourceHashes,
  unsupportedAreas,
} from "./ultimate-baseline.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repo, "docs/evidence/ultimate");
const outFile = path.join(outDir, "baseline.json");

function git(...args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function ghJson(args) {
  try {
    const text = execFileSync("gh", args, {
      cwd: repo,
      encoding: "utf8",
      windowsHide: true,
    });
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message.split("\n")[0] : String(error),
    };
  }
}

const candidateSha = git("rev-parse", "HEAD");
const tree = git("rev-parse", "HEAD^{tree}");
const dirty = git("status", "--porcelain");
const currentMd = readFileSync(path.join(repo, "specs/CURRENT.md"), "utf8");
const { flags, sources } = readFlags(repo);
const receipts = listQualificationReceipts(
  path.join(repo, "docs/evidence/qualification"),
);

const live = ghJson([
  "api",
  "repos/TheHalfMoon/Yamakan/commits/main",
  "--jq",
  "{sha:.sha,date:.commit.committer.date,message:.commit.message}",
]);
const prs = ghJson([
  "pr",
  "list",
  "--repo",
  "TheHalfMoon/Yamakan",
  "--state",
  "open",
  "--json",
  "number,title,headRefOid,isDraft,url",
]);
const issues = ghJson([
  "issue",
  "list",
  "--repo",
  "TheHalfMoon/Yamakan",
  "--state",
  "open",
  "--json",
  "number,title,url",
]);

const liveMain = live.ok ? live.value.sha : null;
const github = redactSecrets({
  capturedAt: new Date().toISOString(),
  liveMain: live.ok ? live.value : { error: live.error },
  openPullRequests: prs.ok ? prs.value : { error: prs.error },
  openIssues: issues.ok ? issues.value : { error: issues.error },
  planning: {
    pr86Head: prs.ok
      ? (prs.value.find((pr) => pr.number === 86)?.headRefOid ?? null)
      : null,
    pr85PreservedSeparately: true,
    doNotMergePlanningPrs: [85, 86],
  },
});

const evaluation = evaluateBaseline({
  liveMain,
  candidateSha,
  flags,
  narrativeHeads: extractNarrativeHeads(currentMd).map((h) => ({
    ...h,
    source: "specs/CURRENT.md",
  })),
  receipts,
  github,
});

// Historical receipts are compared, as git blobs, with the same paths on the
// base branch: any rewrite of an existing receipt shows up here.
const base = process.env.YAMAKAN_BASELINE_BASE || "origin/main";
const blob = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};
const before = {};
const after = {};
for (const row of receipts) {
  const atBase = blob("rev-parse", `${base}:${row.path}`);
  if (atBase === null) continue; // added on this branch, not historical
  before[row.path] = atBase;
  after[row.path] = blob("hash-object", path.join(repo, row.path));
}
const preservation = receiptsPreserved(before, after);
const missingRequired = REQUIRED_HISTORICAL_RECEIPTS.filter(
  (rel) => !existsSync(path.join(repo, rel)),
);

const registryFile = path.join(repo, "core/command/registry.ts");
const manifest = {
  ...evaluation,
  format: BASELINE_FORMAT,
  capturedAt: new Date().toISOString(),
  candidate: {
    sha: candidateSha,
    tree,
    dirty: dirty.length > 0,
    dirtyStatus: dirty || "",
  },
  flagSources: sources,
  catalog: existsSync(registryFile)
    ? parseCommandNames(readFileSync(registryFile, "utf8"))
    : [],
  qualificationPolicy: "yamakan.qualification-policy/v1",
  renderPlan: "yamakan.render-plan/v1",
  renderCompiler: "yamakan.render-compiler/1",
  fonts: fontPins(repo),
  native: nativeHashes(repo),
  sourceHashes: sourceHashes(repo),
  unsupportedAreas: unsupportedAreas(),
  historicalReceiptsPreserved: {
    base,
    compared: Object.keys(before).length,
    preserved: preservation.preserved,
    changed: preservation.changed,
    missingRequired,
  },
  notes: [
    "Historical W1–W18/P10 receipts keep their original bound commits.",
    "This manifest is not a current-head product PASS.",
    "Engines, providers and JASSUB remain disabled.",
    "Planning PRs #85 and #86 stay open and are not merged by this task.",
  ],
};

mkdirSync(outDir, { recursive: true });
const publicManifest = redactLocalPaths(manifest, [
  { path: repo, label: "<repo>" },
  { path: os.homedir(), label: "~" },
]);
writeFileSync(outFile, JSON.stringify(publicManifest, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      wrote: path.relative(repo, outFile).replaceAll("\\", "/"),
      liveMain,
      candidateSha,
      currentHeadPass: manifest.currentHeadPass,
      enginesDisabled: manifest.enginesDisabled,
      mismatchCount: manifest.mismatches.length,
      preserved: manifest.preservedReceipts.length,
    },
    null,
    2,
  ),
);
// Without live GitHub state the baseline is not bound to anything: BLOCKED.
if (!liveMain) {
  console.error("BLOCKED: live main could not be read from GitHub.");
  process.exit(2);
}
if (
  !manifest.enginesDisabled ||
  manifest.currentHeadPass ||
  !preservation.preserved ||
  missingRequired.length > 0
) {
  process.exit(1);
}
