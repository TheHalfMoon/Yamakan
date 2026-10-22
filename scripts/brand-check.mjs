import { readFileSync, readdirSync } from "node:fs";

const SOURCE = /\.(?:[cm]?[jt]sx?|mjs|css|html|json|md|ps1)$/;
const COMPLIANCE =
  /^(NOTICE|notices\/|docs\/provenance\/imports\.json$|docs\/provenance\/REBRAND_INVENTORY\.md$|docs\/provenance\/brand-terms\.json$|docs\/history\/|docs\/research\/|docs\/evidence\/|docs\/review\/|docs\/SOURCE_|docs\/AGENT_)/;

function listFiles(roots, skipPrefixes, skipExact) {
  const skipTop = new Set([
    ".git",
    "node_modules",
    "dist",
    "work",
    ".yamakan",
    ".darzain",
    "graft",
    "vendor",
  ]);
  const exact = new Set(skipExact ?? []);
  return readdirSync(".", { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) =>
      `${d.parentPath}/${d.name}`.replaceAll("\\", "/").replace(/^\.\//, ""),
    )
    .filter((f) => !skipTop.has(f.split("/")[0]))
    .filter((f) => roots.some((r) => f === r || f.startsWith(`${r}/`)))
    .filter((f) => !(skipPrefixes ?? []).some((p) => f.startsWith(p)))
    .filter((f) => !exact.has(f))
    .filter((f) => SOURCE.test(f));
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractStringLiterals(text) {
  const literals = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)(\1)/g;
  for (const match of stripComments(text).matchAll(re)) literals.push(match[2]);
  return literals;
}

function isAllowed(literal, allows) {
  return allows.some((a) => a.re.test(literal));
}

export function checkBrand({ files, read, config }) {
  const violations = [];
  const terms = config.terms.map((t) => ({
    ...t,
    re: new RegExp(t.pattern),
    pathRe: new RegExp(t.pattern, "i"),
  }));
  const allows = (config.allowLiteralPatterns ?? []).map((a) => ({
    ...a,
    re: new RegExp(a.pattern, "i"),
  }));
  for (const file of files) {
    // Compliance / immutable provenance surfaces may name donors truthfully.
    if (COMPLIANCE.test(file) || file === "NOTICE") continue;
    const text = read(file);
    for (const term of terms) {
      if (term.pathRe.test(file)) {
        violations.push(
          `Donor branding in path (${term.reason}): ${file} contains "${term.pattern}"`,
        );
      }
    }
    for (const literal of extractStringLiterals(text)) {
      for (const term of terms) {
        if (!term.re.test(literal)) continue;
        if (isAllowed(literal, allows)) continue;
        violations.push(
          `Donor branding in user-visible string (${term.reason}): ${file} contains "${term.pattern}"`,
        );
      }
    }
  }
  return violations;
}

function main() {
  const config = JSON.parse(
    readFileSync("docs/provenance/brand-terms.json", "utf8"),
  );
  const files = listFiles(
    config.scanRoots,
    config.skipPathPrefixes ?? [],
    config.skipExactFiles ?? [],
  );
  const violations = checkBrand({
    files,
    read: (f) => readFileSync(f, "utf8"),
    config,
  });
  if (violations.length)
    throw new Error(`Brand check failed:\n${violations.join("\n")}`);
  console.log(`Brand check passed over ${files.length} Yamakan surface files.`);
}

if (import.meta.main) main();
