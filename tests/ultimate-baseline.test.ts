import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { BASELINE_FORMAT, DISABLED_CAPABILITIES, REQUIRED_HISTORICAL_RECEIPTS, boundCommitField, claimCurrentHeadPass, evaluateBaseline, extractBoundCommit, extractNarrativeHeads, hashFile, listQualificationReceipts, receiptsPreserved, redactSecrets } from "../scripts/ultimate-baseline.mjs";

const LIVE = "a3c3ce91815aee35ce5b91b4a483dd85766a4429";
const HISTORICAL = "e8bb8dd20fdbb87c520c948222cd44abffb5ed0d";
const STALE = "5c6658d589ac36bd08725fef9233872865a7030e";

const disabledFlags = {
  ENGINE_ENABLED: false,
  ROUTER_PROVIDERS_ENABLED: false,
  JASSUB_ENABLED: false,
  STUDIO_ENABLED: true,
};

function receipt(path: string, json: unknown, extra = {}) {
  const text = JSON.stringify(json);
  return {
    path,
    sha256: createHash("sha256").update(text).digest("hex"),
    json,
    ...extra,
  };
}

test("baseline format is the versioned capability evidence manifest", () => {
  assert.equal(BASELINE_FORMAT, "yamakan.ultimate-baseline/v1");
  assert.equal(DISABLED_CAPABILITIES.ENGINE_ENABLED, false);
  assert.equal(DISABLED_CAPABILITIES.JASSUB_ENABLED, false);
  assert.equal(DISABLED_CAPABILITIES.ROUTER_PROVIDERS_ENABLED, false);
});

test("extractBoundCommit reads commit, gitHead, and environment.commit", () => {
  assert.equal(extractBoundCommit({ commit: STALE }), STALE);
  assert.equal(extractBoundCommit({ gitHead: HISTORICAL }), HISTORICAL);
  assert.equal(extractBoundCommit({ environment: { commit: LIVE } }), LIVE);
  assert.equal(extractBoundCommit({ passed: true }), null);
  assert.equal(extractBoundCommit("not-json"), null);
});

test("extractNarrativeHeads records CURRENT.md verified-main claims", () => {
  const heads = extractNarrativeHeads(
    "**Verified main:** `e8bb8dd20fdbb87c520c948222cd44abffb5ed0d` (Windows UX QA #83)",
  );
  assert.ok(heads.some((h: { sha: string }) => h.sha === HISTORICAL));
});

test("manifest detects historical-head mismatch and keeps currentHeadPass false", () => {
  const result = evaluateBaseline({
    liveMain: LIVE,
    candidateSha: LIVE,
    flags: disabledFlags,
    narrativeHeads: [{ source: "specs/CURRENT.md", sha: HISTORICAL }],
    receipts: [
      receipt("docs/evidence/qualification/t10-release.json", {
        receipt: "yamakan.release-qualification/3",
        environment: { commit: STALE },
        tests: { pass: 356 },
      }),
    ],
  });
  assert.equal(result.format, BASELINE_FORMAT);
  assert.equal(result.enginesDisabled, true);
  assert.equal(result.currentHeadPass, false);
  assert.ok(
    result.mismatches.some(
      (m: { code: string }) => m.code === "NARRATIVE_HEAD_MISMATCH",
    ),
  );
  assert.ok(
    result.mismatches.some(
      (m: { code: string }) => m.code === "HISTORICAL_RECEIPT_HEAD",
    ),
  );
  assert.equal(result.preservedReceipts.length, 1);
  assert.equal(result.preservedReceipts[0].boundCommit, STALE);
  assert.notEqual(result.preservedReceipts[0].boundCommit, LIVE);
});

test("disabled engines are required on the recorded baseline", () => {
  const enabled = evaluateBaseline({
    liveMain: LIVE,
    candidateSha: LIVE,
    flags: { ...disabledFlags, ENGINE_ENABLED: true },
    narrativeHeads: [],
    receipts: [],
  });
  assert.equal(enabled.enginesDisabled, false);
  assert.equal(enabled.currentHeadPass, false);
  assert.ok(
    enabled.violations.some(
      (v: { code: string }) => v.code === "ENGINE_ENABLED",
    ),
  );
});

test("existing completed receipts stay bound to their own commits", () => {
  const listed = listQualificationReceipts("docs/evidence/qualification");
  assert.ok(listed.length >= REQUIRED_HISTORICAL_RECEIPTS.length);
  for (const required of REQUIRED_HISTORICAL_RECEIPTS) {
    assert.ok(existsSync(required), required);
    const found = listed.find((r: { path: string }) => r.path === required);
    assert.ok(found, `missing from inventory: ${required}`);
    const json = JSON.parse(readFileSync(required, "utf8"));
    const bound = extractBoundCommit(json);
    if (bound) assert.notEqual(bound, "current");
  }
  const before = Object.fromEntries(
    listed.map((r: { path: string; sha256: string }) => [r.path, r.sha256]),
  );
  evaluateBaseline({
    liveMain: LIVE,
    candidateSha: LIVE,
    flags: disabledFlags,
    narrativeHeads: [{ source: "specs/CURRENT.md", sha: HISTORICAL }],
    receipts: listed.map((r: { path: string; sha256: string; json: unknown }) =>
      receipt(r.path, r.json),
    ),
  });
  const after = Object.fromEntries(
    listQualificationReceipts("docs/evidence/qualification").map(
      (r: { path: string; sha256: string }) => [r.path, r.sha256],
    ),
  );
  assert.deepEqual(receiptsPreserved(before, after), {
    preserved: true,
    changed: [],
  });
});

test("stale receipt cannot produce current-head PASS", () => {
  const claim = claimCurrentHeadPass({
    liveMain: LIVE,
    receipt: {
      commit: STALE,
      passed: true,
      tests: { fail: 0 },
    },
  });
  assert.equal(claim.currentHeadPass, false);
  assert.equal(claim.reason, "HISTORICAL_HEAD_MISMATCH");
});

test("malformed receipt cannot produce current-head PASS", () => {
  assert.equal(
    claimCurrentHeadPass({ liveMain: LIVE, receipt: null }).currentHeadPass,
    false,
  );
  assert.equal(
    claimCurrentHeadPass({ liveMain: LIVE, receipt: "PASS" }).currentHeadPass,
    false,
  );
  assert.equal(
    claimCurrentHeadPass({
      liveMain: LIVE,
      receipt: { passed: true },
    }).currentHeadPass,
    false,
  );
  assert.equal(
    claimCurrentHeadPass({
      liveMain: LIVE,
      receipt: { commit: "not-a-sha", passed: true },
    }).currentHeadPass,
    false,
  );
});

test("positive control: live-main receipt may claim current-head PASS", () => {
  const claim = claimCurrentHeadPass({
    liveMain: LIVE,
    receipt: { commit: LIVE, passed: true },
  });
  assert.equal(claim.currentHeadPass, true);
  assert.equal(claim.boundCommit, LIVE);
});

test("redactSecrets strips token-like fields from public receipts", () => {
  const redacted = redactSecrets({
    commit: LIVE,
    authorization: "Bearer secret",
    nested: { apiKey: "abc", ok: 1 },
  });
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.nested.apiKey, "[REDACTED]");
  assert.equal(redacted.nested.ok, 1);
  assert.equal(redacted.commit, LIVE);
});

test("hashFile is stable for an existing historical receipt", () => {
  const path = "docs/evidence/qualification/q1-has-audio.json";
  assert.equal(hashFile(path), hashFile(path));
  assert.match(hashFile(path), /^[a-f0-9]{64}$/);
});

test("qualification inventory does not rewrite nested diagnose files as current", () => {
  const nested = join(
    "docs/evidence/qualification",
    "q11-jassub-investigation",
    "diagnose",
    "report.json",
  );
  if (!existsSync(nested) || !statSync(nested).isFile()) return;
  const json = JSON.parse(readFileSync(nested, "utf8"));
  const bound = extractBoundCommit(json);
  if (bound) assert.notEqual(bound, LIVE);
  assert.ok(
    readdirSync("docs/evidence/qualification").includes("t10-release.json"),
  );
});

test("receipts bound by head/base fields record which field bound them; donor pins never bind", () => {
  assert.deepEqual(boundCommitField({ head: HISTORICAL }), {
    field: "head",
    sha: HISTORICAL,
  });
  assert.deepEqual(boundCommitField({ baseMain: STALE }), {
    field: "baseMain",
    sha: STALE,
  });
  // A receipt's own commit wins over a base it was measured against.
  assert.equal(
    boundCommitField({ commit: LIVE, gitHeadBase: STALE })?.field,
    "commit",
  );
  assert.equal(boundCommitField({ pin: HISTORICAL }), null);
});

test("unbound and malformed receipts are flagged, never silently accepted", () => {
  const result = evaluateBaseline({
    liveMain: LIVE,
    flags: disabledFlags,
    receipts: [
      receipt("docs/evidence/qualification/no-commit.json", { passed: true }),
      {
        path: "docs/evidence/qualification/bad.json",
        sha256: "0".repeat(64),
        json: null,
        parseError: "Unexpected token",
      },
      receipt("docs/evidence/qualification/live.json", {
        commit: LIVE,
        passed: true,
      }),
    ],
  });
  const codes = result.mismatches.map(
    (m: { code: string; path?: string }) => `${m.code}:${m.path}`,
  );
  assert.ok(
    codes.includes(
      "UNBOUND_RECEIPT:docs/evidence/qualification/no-commit.json",
    ),
  );
  assert.ok(
    codes.includes("MALFORMED_RECEIPT:docs/evidence/qualification/bad.json"),
  );
  const rows = Object.fromEntries(
    result.preservedReceipts.map((r: { path: string }) => [r.path, r]),
  );
  assert.equal(
    rows["docs/evidence/qualification/no-commit.json"].currentHeadPass,
    false,
  );
  assert.equal(
    rows["docs/evidence/qualification/no-commit.json"].reason,
    "UNBOUND_RECEIPT",
  );
  assert.equal(
    rows["docs/evidence/qualification/live.json"].currentHeadPass,
    true,
  );
  // The manifest itself is never a product PASS.
  assert.equal(result.currentHeadPass, false);
});

test("every real historical receipt is either bound to a commit or flagged", () => {
  const receipts = listQualificationReceipts("docs/evidence/qualification");
  const result = evaluateBaseline({
    liveMain: LIVE,
    flags: disabledFlags,
    receipts,
  });
  for (const row of result.preservedReceipts) {
    const flagged = result.mismatches.some(
      (m: { path?: string }) => m.path === row.path,
    );
    assert.ok(
      row.boundCommit || flagged,
      `${row.path} is neither bound nor flagged`,
    );
    assert.notEqual(
      row.currentHeadPass,
      true,
      `${row.path} claims a live-head PASS`,
    );
  }
});
