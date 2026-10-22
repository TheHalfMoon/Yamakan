import assert from "node:assert/strict";
import test from "node:test";
// prettier-ignore
// @ts-expect-error Plain .mjs modules without declarations.
import { checkBrand } from "../scripts/brand-check.mjs";
import { readFileSync } from "node:fs";

const brand = JSON.parse(
  readFileSync("docs/provenance/brand-terms.json", "utf8"),
);

test("brand check rejects reintroduced OpenCut product branding", () => {
  const violations = checkBrand({
    files: ["src/i18n.ts"],
    read: () => 'export const x = "Powered by OpenCut";',
    config: brand,
  });
  assert.ok(violations.some((v: string) => /OpenCut/.test(v)));
});

test("brand check rejects Darzain in product UI strings", () => {
  const violations = checkBrand({
    files: ["src/About.tsx"],
    read: () => 'export const title = "Welcome to Darzain";',
    config: brand,
  });
  assert.ok(violations.some((v: string) => /Darzain/.test(v)));
});

test("brand check rejects donor path segments under src/", () => {
  const violations = checkBrand({
    files: ["src/donors/opencut/overlap.ts"],
    read: () => "export const ok = 1;",
    config: brand,
  });
  assert.ok(violations.some((v: string) => /path/.test(v) && /OpenCut/i.test(v)));
});

test("brand check allows NOTICE attribution content", () => {
  assert.deepEqual(
    checkBrand({
      files: ["NOTICE"],
      read: (f: string) => readFileSync(f, "utf8"),
      config: brand,
    }),
    [],
  );
});

test("brand check allows legacy darzain. command prefix literals", () => {
  assert.deepEqual(
    checkBrand({
      files: ["core/command/registry.ts"],
      read: () => 'export const LEGACY = "darzain.project.create";',
      config: brand,
    }),
    [],
  );
});
