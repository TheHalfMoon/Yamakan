import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { checkExcludedContentHashes, checkImports } from "../scripts/import-guard.mjs";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { checkBrand } from "../scripts/brand-check.mjs";

const policy = JSON.parse(
  readFileSync("docs/provenance/import-policy.json", "utf8"),
);
const denied = JSON.parse(
  readFileSync("docs/provenance/excluded-content-hashes.json", "utf8"),
);
const brand = JSON.parse(
  readFileSync("docs/provenance/brand-terms.json", "utf8"),
);

const baseEntry = {
  source: "owner/repo",
  sha: "a".repeat(40),
  original: "src/a.ts",
  imported: "src/editor/x/a.ts",
  sha256: "b".repeat(64),
  importedSha256: "b".repeat(64),
  modifications: [],
  license: "MIT",
  authorization: "public-licence",
  owner: "editing builder",
  tests: ["tests/core.test.ts"],
};

const excludedFixture = readFileSync(
  "tests/fixtures/provenance/excluded-main.js",
);
const excludedHash = createHash("sha256").update(excludedFixture).digest("hex");

test("provenance ledger rejects missing extended fields", () => {
  const { license: _, ...incomplete } = baseEntry;
  const violations = checkImports({
    files: [baseEntry.imported],
    read: () => "export const ok = 1;",
    ledger: [incomplete],
    policy,
  });
  assert.ok(violations.some((v: string) => /missing license/.test(v)));
});

test("excluded path and renamed excluded content fail", () => {
  const scratch = "scratch/excluded/electron/main.js";
  const renamed = "scratch/renamed-shell.js";
  const readBytes = () => excludedHash;
  assert.ok(
    checkImports({
      files: [scratch],
      read: () => "",
      ledger: [baseEntry],
      policy,
    }).some((v: string) => /Excluded donor path present/.test(v)),
  );
  const hashViolations = checkExcludedContentHashes({
    files: [scratch, renamed],
    readBytes,
    denied,
    excludedPaths: policy.excludedPaths,
  });
  assert.equal(
    hashViolations.filter((v: string) =>
      /Excluded donor content present/.test(v),
    ).length,
    2,
  );
});

test("ledger import closure rejects excluded dependency", () => {
  const allowed = "src/editor/x/allowed.ts";
  const violations = checkImports({
    files: [allowed],
    read: (f: string) =>
      f === allowed ? 'import "./electron/main.js";' : "export const ok = 1;",
    ledger: [{ ...baseEntry, imported: allowed }],
    policy,
  });
  assert.ok(
    violations.some((v: string) => /closure hits excluded path/.test(v)),
  );
});

test("ledger closure tolerates unreadable ledger paths", () => {
  const allowed = "src/editor/x/missing-on-disk.ts";
  assert.doesNotThrow(() =>
    checkImports({
      files: [],
      read: () => undefined,
      ledger: [{ ...baseEntry, imported: allowed }],
      policy,
    }),
  );
});

test("brand check rejects donor strings and allows NOTICE", () => {
  const violations = checkBrand({
    files: ["src/i18n.ts"],
    read: () => 'export const x = "Powered by OpenCut";',
    config: brand,
  });
  assert.ok(violations.some((v: string) => /OpenCut/.test(v)));
  assert.deepEqual(
    checkBrand({
      files: ["NOTICE"],
      read: (f: string) => readFileSync(f, "utf8"),
      config: brand,
    }),
    [],
  );
});
