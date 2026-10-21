import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { checkImports, checkExcludedContentHashes } from "./import-guard.mjs";

const ledger = JSON.parse(readFileSync("docs/provenance/imports.json", "utf8"));
const policy = JSON.parse(
  readFileSync("docs/provenance/import-policy.json", "utf8"),
);
const denied = JSON.parse(
  readFileSync("docs/provenance/excluded-content-hashes.json", "utf8"),
);

const errors = [];
for (const entry of ledger) {
  if (!/^[a-f0-9]{40}$/.test(entry.sha))
    errors.push(`Unpinned source: ${entry.imported}`);
  const hash = createHash("sha256")
    .update(readFileSync(entry.imported))
    .digest("hex");
  if (hash !== entry.importedSha256)
    errors.push(`Unrecorded source change: ${entry.imported}`);
  if (!entry.modifications.length && hash !== entry.sha256)
    errors.push(`Unreported modification: ${entry.imported}`);
  for (const test of entry.tests ?? [])
    if (!existsSync(test))
      errors.push(`Ledger test file missing: ${test} (${entry.imported})`);
}

for (const file of [
  "LICENSE",
  "NOTICE",
  "notices/ai-video-production-editor-LICENSE",
  "notices/Ninerr-LICENSE",
  "notices/OpenCut-LICENSE",
])
  if (!existsSync(file)) errors.push(`Missing notice: ${file}`);

const sources = new Set(ledger.map((e) => e.source));
for (const row of policy.sourceNotices ?? []) {
  if (!sources.has(row.source)) continue;
  for (const notice of row.notices)
    if (!existsSync(notice))
      errors.push(`Missing source notice for ${row.source}: ${notice}`);
}
for (const entry of ledger) {
  if (entry.authorization !== "public-licence") continue;
  const row = (policy.sourceNotices ?? []).find(
    (r) => r.source === entry.source,
  );
  if (!row?.notices?.length)
    errors.push(
      `public-licence ledger entry lacks sourceNotices mapping: ${entry.source}`,
    );
}

const fonts = JSON.parse(readFileSync("docs/provenance/fonts.json", "utf8"));
let fontFiles = 0;
for (const family of fonts) {
  if (!existsSync(family.licenseFile))
    errors.push(`Missing font license: ${family.licenseFile}`);
  for (const file of family.files) {
    const hash = createHash("sha256")
      .update(readFileSync(file.imported))
      .digest("hex");
    if (hash !== file.sha256) errors.push(`Font changed: ${file.imported}`);
    fontFiles++;
  }
}
const pinned = new Set(
  readFileSync("core/render/fonts.ts", "utf8").match(/[a-f0-9]{64}/g) ?? [],
);
const ledgered = new Set(fonts.flatMap((f) => f.files.map((x) => x.sha256)));
if (
  pinned.size !== ledgered.size ||
  [...pinned].some((hash) => !ledgered.has(hash))
)
  errors.push("Font hashes in core/render/fonts.ts differ from the ledger.");

const skip = new Set([
  ".git",
  "node_modules",
  "dist",
  "work",
  ".yamakan",
  ".darzain",
  "graft",
]);
const files = readdirSync(".", { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) =>
    `${d.parentPath}/${d.name}`.replaceAll("\\", "/").replace(/^\.\//, ""),
  )
  .filter((f) => !skip.has(f.split("/")[0]))
  .filter((f) => !f.startsWith("native/procd/target/"));

const readText = (f) => readFileSync(f, "utf8");
const hashFile = (f) =>
  createHash("sha256").update(readFileSync(f)).digest("hex");

const hashScanFiles = files.filter(
  (f) => !f.startsWith("tests/fixtures/provenance/"),
);
errors.push(
  ...checkImports({ files, read: readText, ledger, policy }),
  ...checkExcludedContentHashes({
    files: hashScanFiles,
    readBytes: hashFile,
    denied,
    excludedPaths: policy.excludedPaths,
  }),
);

if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `Verified ${ledger.length} pinned source records, ${denied.length} excluded content hashes, ${fontFiles} pinned font files, required notices and import guard over ${files.length} files.`,
);
