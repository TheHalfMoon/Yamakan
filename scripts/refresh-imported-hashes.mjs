import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const path = "docs/provenance/imports.json";
const ledger = JSON.parse(readFileSync(path, "utf8"));
const note =
  "Yamakan complete rebrand: relocated under first-party path; update imports and importedSha256.";
let updated = 0;
for (const entry of ledger) {
  const hash = createHash("sha256")
    .update(readFileSync(entry.imported))
    .digest("hex");
  if (hash === entry.importedSha256) continue;
  entry.importedSha256 = hash;
  if (!Array.isArray(entry.modifications)) entry.modifications = [];
  if (!entry.modifications.includes(note)) entry.modifications.push(note);
  updated++;
  console.log(entry.imported);
}
writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`Updated ${updated} ledger entries.`);
