import { readFileSync, readdirSync } from "node:fs";

const SOURCE = /\.(?:[cm]?[jt]sx?|mjs)$/;

function listFiles(roots, skipPrefixes) {
  const skip = new Set([
    ".git",
    "node_modules",
    "dist",
    "work",
    ".yamakan",
    ".darzain",
    "graft",
  ]);
  return readdirSync(".", { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) =>
      `${d.parentPath}/${d.name}`.replaceAll("\\", "/").replace(/^\.\//, ""),
    )
    .filter((f) => !skip.has(f.split("/")[0]))
    .filter((f) => roots.some((r) => f === r || f.startsWith(`${r}/`)))
    .filter((f) => !(skipPrefixes ?? []).some((p) => f.startsWith(p)))
    .filter((f) => SOURCE.test(f));
}

function extractStringLiterals(text) {
  const literals = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)(\1)/gs;
  for (const match of text.matchAll(re)) literals.push(match[2]);
  return literals;
}

export function checkBrand({ files, read, config }) {
  const violations = [];
  const terms = config.terms.map((t) => ({ ...t, re: new RegExp(t.pattern) }));
  for (const file of files) {
    const text = read(file);
    for (const literal of extractStringLiterals(text)) {
      for (const term of terms) {
        if (term.re.test(literal))
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
  const files = listFiles(config.scanRoots, config.skipPathPrefixes ?? []);
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
