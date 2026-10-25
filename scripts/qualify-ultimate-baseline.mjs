/**
 * YU-000 capture: write docs/evidence/ultimate/baseline.json.
 * Does not rewrite historical qualification receipts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_FORMAT,
  evaluateBaseline,
  extractNarrativeHeads,
  fontPins,
  listQualificationReceipts,
  nativeHashes,
  parseCommandNames,
  readFlags,
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
    pr86ApprovedReference: "58f030bf9370044ce9c26ea346b7606d2deed4d7",
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
  historicalReceiptsPreserved: true,
  notes: [
    "Historical W1–W18/P10 receipts keep their original bound commits.",
    "This manifest is not a current-head product PASS.",
    "Engines, providers and JASSUB remain disabled.",
    "Planning PRs #85 and #86 stay open and are not merged by this task.",
  ],
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n");
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
if (!manifest.enginesDisabled || manifest.currentHeadPass) {
  process.exit(1);
}
