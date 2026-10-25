/**
 * YU-000 — Artifact-bound capability evidence. Metadata only.
 * Historical qualification receipts are inventoried, never rewritten.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const BASELINE_FORMAT = "yamakan.ultimate-baseline/v1";

export const DISABLED_CAPABILITIES = Object.freeze({
  ENGINE_ENABLED: false,
  ROUTER_PROVIDERS_ENABLED: false,
  JASSUB_ENABLED: false,
});

export const FLAG_SOURCES = Object.freeze({
  ENGINE_ENABLED: "core/engines/contract.ts",
  ROUTER_PROVIDERS_ENABLED: "core/router/explain.ts",
  JASSUB_ENABLED: "core/preview/jassub-flags.ts",
  STUDIO_ENABLED: "core/studio.ts",
  QUALITY_LAB_ENABLED: "core/quality/lab.ts",
  CINEMA_ENABLED: "core/scene3d-flags.ts",
  DIRECTOR_ENABLED: "core/director-flags.ts",
  ANIMATION_ENABLED: "core/animation/flags.ts",
});

export const REQUIRED_HISTORICAL_RECEIPTS = Object.freeze([
  "docs/evidence/qualification/t10-release.json",
  "docs/evidence/qualification/q1-has-audio.json",
  "docs/evidence/qualification/t4-large-import.json",
  "docs/evidence/qualification/large-import.json",
  "docs/evidence/qualification/t7-typography.json",
  "docs/evidence/qualification/t8-preview.json",
  "docs/evidence/qualification/q15-user-presence.json",
  "docs/evidence/qualification/windows-product-pass.json",
  "docs/evidence/qualification/studio-activation.json",
  "docs/evidence/qualification/cinema-activation.json",
  "docs/evidence/qualification/director-activation.json",
  "docs/evidence/qualification/p10-05-quality-lab.json",
  "docs/evidence/qualification/p10-02-animation-e2e.json",
  "docs/evidence/qualification/q8-studio-stroke.json",
  "docs/evidence/qualification/q9-studio-inherited.json",
  "docs/evidence/qualification/q10-studio.json",
  "docs/evidence/qualification/q11-jassub-eng.json",
  "docs/evidence/qualification/w18-loudnorm.json",
  "docs/evidence/qualification/playback.json",
  "docs/evidence/qualification/resource-policy.json",
  "docs/evidence/qualification/w7-release-evidence.json",
]);

const SHA = /^[0-9a-f]{40}$/;
const SECRET = /(token|secret|password|authorization|api[_-]?key|bearer)/i;

export function isSha(value) {
  return typeof value === "string" && SHA.test(value);
}

export function hashFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

// Yamakan commit fields receipts were written with, in precedence order.
// Donor "pin" fields name upstream commits and never bind a receipt.
export const BOUND_COMMIT_FIELDS = Object.freeze([
  "commit",
  "gitHead",
  "environment.commit",
  "head",
  "gitHeadAtQ8",
  "gitHeadBase",
  "baseMain",
]);

export function boundCommitField(receipt) {
  if (!receipt || typeof receipt !== "object") return null;
  for (const field of BOUND_COMMIT_FIELDS) {
    const value = field
      .split(".")
      .reduce(
        (o, k) => (o && typeof o === "object" ? o[k] : undefined),
        receipt,
      );
    if (isSha(value)) return { field, sha: value };
  }
  return null;
}

export function extractBoundCommit(receipt) {
  return boundCommitField(receipt)?.sha ?? null;
}

export function extractNarrativeHeads(text) {
  if (typeof text !== "string") return [];
  const heads = [];
  const labeled = /\*\*Verified main:\*\*\s*`([0-9a-f]{40})`/g;
  for (const match of text.matchAll(labeled)) {
    heads.push({ source: "verified-main", sha: match[1] });
  }
  return heads;
}

export function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET.test(key) ? "[REDACTED]" : redactSecrets(item);
  }
  return out;
}

export function claimCurrentHeadPass({ liveMain, receipt }) {
  if (!isSha(liveMain)) {
    return { currentHeadPass: false, reason: "LIVE_MAIN_UNBOUND" };
  }
  if (!receipt || typeof receipt !== "object") {
    return { currentHeadPass: false, reason: "MALFORMED_RECEIPT" };
  }
  const boundCommit = extractBoundCommit(receipt);
  if (!boundCommit) {
    return { currentHeadPass: false, reason: "UNBOUND_RECEIPT" };
  }
  if (boundCommit !== liveMain) {
    return {
      currentHeadPass: false,
      reason: "HISTORICAL_HEAD_MISMATCH",
      boundCommit,
      liveMain,
    };
  }
  if (receipt.passed !== true) {
    return {
      currentHeadPass: false,
      reason: "RECEIPT_NOT_PASSED",
      boundCommit,
    };
  }
  return { currentHeadPass: true, boundCommit, liveMain };
}

export function receiptsPreserved(before, after) {
  const changed = [];
  for (const [file, digest] of Object.entries(before || {})) {
    if (after?.[file] !== digest) changed.push(file);
  }
  return { preserved: changed.length === 0, changed };
}

function walkJsonFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJsonFiles(full, acc);
    else if (name.endsWith(".json")) acc.push(full);
  }
  return acc;
}

export function toRepoEvidencePath(file) {
  const posix = file.replaceAll("\\", "/");
  const marker = "docs/evidence/";
  const at = posix.lastIndexOf(marker);
  return at >= 0 ? posix.slice(at) : posix;
}

export function listQualificationReceipts(
  root = "docs/evidence/qualification",
) {
  const files = walkJsonFiles(root);
  return files.map((file) => {
    let json = null;
    let parseError = null;
    try {
      json = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
    return {
      path: toRepoEvidencePath(file),
      sha256: hashFile(file),
      json,
      parseError,
    };
  });
}

export function parseFlag(source, name) {
  if (typeof source !== "string") {
    return { name, value: null, parseError: "SOURCE_MISSING" };
  }
  const match = source.match(new RegExp(`export const ${name} = (true|false)`));
  if (!match) return { name, value: null, parseError: "FLAG_NOT_FOUND" };
  return { name, value: match[1] === "true" };
}

export function readFlags(repoRoot = ".") {
  const flags = {};
  const sources = {};
  for (const [name, rel] of Object.entries(FLAG_SOURCES)) {
    const file = path.join(repoRoot, rel);
    const text = existsSync(file) ? readFileSync(file, "utf8") : null;
    const parsed = parseFlag(text, name);
    flags[name] = parsed.value;
    sources[name] = {
      path: rel.replaceAll("\\", "/"),
      sha256: existsSync(file) ? hashFile(file) : null,
      parseError: parsed.parseError || null,
    };
  }
  return { flags, sources };
}

export function evaluateBaseline(input) {
  const liveMain = input.liveMain;
  const flags = input.flags || {};
  const receipts = Array.isArray(input.receipts) ? input.receipts : [];
  const narrativeHeads = Array.isArray(input.narrativeHeads)
    ? input.narrativeHeads
    : [];
  const mismatches = [];
  const violations = [];

  for (const [name, required] of Object.entries(DISABLED_CAPABILITIES)) {
    if (flags[name] !== required) {
      violations.push({
        code: name,
        expected: required,
        actual: flags[name] ?? null,
      });
    }
  }

  for (const head of narrativeHeads) {
    if (isSha(head.sha) && head.sha !== liveMain) {
      mismatches.push({
        code: "NARRATIVE_HEAD_MISMATCH",
        source: head.source,
        sha: head.sha,
        liveMain,
      });
    }
  }

  const preservedReceipts = receipts.map((row) => {
    const bound = boundCommitField(row.json);
    const claim = claimCurrentHeadPass({ liveMain, receipt: row.json });
    if (!bound) {
      mismatches.push({
        code: row.parseError ? "MALFORMED_RECEIPT" : "UNBOUND_RECEIPT",
        path: row.path,
      });
    } else if (bound.sha !== liveMain) {
      mismatches.push({
        code: "HISTORICAL_RECEIPT_HEAD",
        path: row.path,
        boundCommit: bound.sha,
        liveMain,
      });
    }
    return {
      path: row.path,
      sha256: row.sha256,
      boundCommit: bound?.sha ?? null,
      boundField: bound?.field ?? null,
      currentHeadPass: claim.currentHeadPass,
      reason: claim.reason ?? null,
      parseError: row.parseError || null,
    };
  });

  const enginesDisabled = violations.length === 0;
  // The manifest describes the baseline; it is never itself a product PASS.
  const currentHeadPass = false;

  return {
    format: BASELINE_FORMAT,
    liveMain: isSha(liveMain) ? liveMain : null,
    candidateSha: isSha(input.candidateSha) ? input.candidateSha : null,
    flags,
    enginesDisabled,
    currentHeadPass,
    mismatches,
    violations,
    preservedReceipts,
    github: input.github || null,
  };
}

export function fontPins(repoRoot = ".") {
  const manifest = path.join(repoRoot, "docs/provenance/fonts.json");
  if (!existsSync(manifest))
    return { path: "docs/provenance/fonts.json", files: [] };
  const listed = JSON.parse(readFileSync(manifest, "utf8"));
  const files = [];
  for (const family of listed) {
    for (const file of family.files || []) {
      const rel = file.imported;
      const full = path.join(repoRoot, rel);
      const actual = existsSync(full) ? hashFile(full) : null;
      files.push({
        path: rel,
        pinned: file.sha256,
        actual,
        verified: actual === file.sha256,
      });
    }
  }
  return {
    path: "docs/provenance/fonts.json",
    sha256: hashFile(manifest),
    files,
  };
}

export function nativeHashes(repoRoot = ".") {
  const helpers = [
    "native/procd/target/release/yamakan-procd.exe",
    "native/procd/target/release/yamakan-acl.exe",
    // The sandbox probe the process-ownership tests launch.
    "native/procd/target/release/worker-probe.exe",
  ];
  return helpers.map((rel) => {
    const full = path.join(repoRoot, rel);
    return {
      path: rel,
      present: existsSync(full),
      sha256: existsSync(full) ? hashFile(full) : null,
    };
  });
}

export function sourceHashes(repoRoot = ".") {
  const files = [
    "package-lock.json",
    "package.json",
    "core/qualification-policy.ts",
    "core/command/registry.ts",
    "core/render/plan.ts",
    "specs/CURRENT.md",
    "docs/IMPLEMENTATION_PLAN.md",
  ];
  return Object.fromEntries(
    files.map((rel) => [
      rel,
      existsSync(path.join(repoRoot, rel))
        ? hashFile(path.join(repoRoot, rel))
        : null,
    ]),
  );
}

export function parseCommandNames(registrySource) {
  if (typeof registrySource !== "string") return [];
  return [...registrySource.matchAll(/^\s{2}"(yamakan\.[^"]+)":/gm)].map(
    (m) => m[1],
  );
}

export function unsupportedAreas() {
  return [
    {
      id: "AUD-01",
      area: "Studio/Cinema/Director persistence",
      status: "UNSUPPORTED_FOR_COMPLETE_RECOVERY",
      note: "Creative sidecars and session canvas are outside backup/restore closure.",
    },
    {
      id: "AUD-10",
      area: "Frontier narrative vs live GitHub",
      status: "NARRATIVE_DIVERGES",
      note: "CURRENT.md verified-main and historical receipts keep their own heads.",
    },
    {
      id: "engines",
      area: "Generative engines and providers",
      status: "DISABLED",
      note: "ENGINE_ENABLED, ROUTER_PROVIDERS_ENABLED and JASSUB_ENABLED stay false.",
    },
    {
      id: "H1-H5",
      area: "Human and release gates",
      status: "OPEN",
      note: "Native Arabic, Profile A, second account, constrained disk, founder ship.",
    },
  ];
}
