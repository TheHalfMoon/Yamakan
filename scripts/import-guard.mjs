// Deny-by-default source import guard. Pure: callers supply the file list and
// a text reader so tests can exercise negative fixtures without touching disk.
// This is a tripwire over source text, not a sandbox: the enforcement boundary
// is the command registry, whose strict schemas accept no executable input.
const REQUIRED = [
  "source",
  "sha",
  "original",
  "imported",
  "sha256",
  "importedSha256",
  "license",
  "authorization",
  "owner",
];
const AUTHORIZATION = new Set(["public-licence", "founder-attested"]);
// Any route to process creation, module loading by computed name or code
// evaluation. Allowlisted spawn modules may only use the named imports below.
const PROCESS_ACCESS =
  /child_process|spawn_sync|getBuiltinModule|process\.binding|createRequire|["'](?:node:)?(?:vm|worker_threads|cluster)["']/;
// Named spawn/execFile imports, or type-only imports (erased at runtime).
const ALLOWED_PROCESS_IMPORT =
  /^import\s*(?:\{\s*((?:spawn|execFile)(?:\s*,\s*(?:spawn|execFile))*)\s*,?\s*\}|type\s*\{\s*\w+(?:\s*,\s*\w+)*\s*,?\s*\})\s*from\s*["']node:child_process["'];?$/;
const FORBIDDEN = [
  [
    /\bexecSync\b|\bspawnSync\b|\bexecFileSync\b/,
    "synchronous process execution",
  ],
  [/(?<![\w$.])exec\s*\(/, "shell-interpreting exec"],
  [/["']?\bshell["']?\s*:\s*(?!false\b)/, "shell option"],
  [/\beval\b\s*[(),]|(?<![\w$])Function\s*\(/, "dynamic code evaluation"],
  // Module specifiers must be one complete string literal.
  [/\bimport\s*\(\s*(?!(["'])[^"'`]*\1\s*\))/, "computed dynamic import"],
  [/\brequire\s*\(\s*(?!(["'])[^"'`]*\1\s*\))/, "computed require"],
];
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_SPEC =
  /\b(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g;

function normalizePath(path) {
  const parts = [];
  for (const seg of path.replaceAll("\\", "/").split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

function resolveRelativeImport(fromFile, spec) {
  if (!spec.startsWith(".")) return [];
  const base = fromFile.includes("/")
    ? fromFile.slice(0, fromFile.lastIndexOf("/"))
    : "";
  const raw = normalizePath(`${base}/${spec}`);
  if (/\.(?:[cm]?[jt]sx?|mjs)$/.test(spec)) return [raw];
  return [
    raw,
    `${raw}.ts`,
    `${raw}.tsx`,
    `${raw}.js`,
    `${raw}.mjs`,
    `${raw}/index.ts`,
    `${raw}/index.tsx`,
  ];
}

function collectImportSpecs(text) {
  if (typeof text !== "string") return [];
  const specs = [];
  for (const match of text.matchAll(IMPORT_SPEC)) {
    specs.push(match[1] ?? match[2]);
  }
  return specs;
}

export function checkImports({ files, read, ledger, policy }) {
  const violations = [];
  const excluded = policy.excludedPaths.map((e) => ({
    ...e,
    regex: new RegExp(e.pattern, "i"),
  }));
  const ledgered = new Set();
  const fileSet = new Set(files);
  for (const entry of ledger) {
    for (const key of REQUIRED)
      if (typeof entry[key] !== "string" || !entry[key])
        violations.push(`Ledger entry is missing ${key}: ${entry.imported}`);
    if (!AUTHORIZATION.has(entry.authorization))
      violations.push(
        `Ledger entry has invalid authorization: ${entry.imported}`,
      );
    if (!Array.isArray(entry.tests) || !entry.tests.length)
      violations.push(`Ledger entry lacks tests: ${entry.imported}`);
    else
      for (const test of entry.tests)
        if (typeof test !== "string" || !test)
          violations.push(`Ledger entry has invalid tests: ${entry.imported}`);
    if (!Array.isArray(entry.modifications))
      violations.push(`Ledger entry lacks modifications: ${entry.imported}`);
    for (const e of excluded)
      if (
        e.regex.test(entry.original ?? "") ||
        e.regex.test(entry.imported ?? "")
      )
        violations.push(
          `Excluded donor path in ledger: ${entry.original} (${e.reason})`,
        );
    ledgered.add(entry.imported);
  }
  const local = new Set(policy.localFilesInDonorRoots.map((f) => f.path));
  for (const file of files) {
    for (const e of excluded)
      if (e.regex.test(file))
        violations.push(`Excluded donor path present: ${file} (${e.reason})`);
    if (
      policy.donorRoots.some((r) => file.startsWith(`${r}/`)) &&
      !ledgered.has(file) &&
      !local.has(file)
    )
      violations.push(`Unrecorded file in donor root: ${file}`);
    const production =
      policy.productionRoots.some((r) => file.startsWith(`${r}/`)) &&
      SOURCE.test(file) &&
      !/\.test\.[cm]?[jt]sx?$/.test(file);
    if (!production) continue;
    const text = read(file);
    if (typeof text !== "string") {
      violations.push(`Unreadable production file: ${file}`);
      continue;
    }
    const allowed = policy.processSpawnAllowlist.includes(file);
    // Formatters wrap long named imports; judge each import as one statement.
    const statements = text.replace(
      /import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g,
      (m) => m.replace(/\s+/g, " "),
    );
    if (allowed && /\bshell\b/.test(text))
      violations.push(`Shell reference in a process module: ${file}`);
    for (const line of statements.split("\n")) {
      if (!PROCESS_ACCESS.test(line)) continue;
      if (!allowed || !ALLOWED_PROCESS_IMPORT.test(line.trim())) {
        violations.push(
          allowed
            ? `Process access other than a named spawn/execFile import: ${file}`
            : `Process execution outside the allowlist: ${file}`,
        );
        break;
      }
    }
    for (const [pattern, label] of FORBIDDEN)
      if (pattern.test(text)) violations.push(`Forbidden ${label}: ${file}`);
  }
  for (const file of ledgered)
    if (!files.includes(file))
      violations.push(`Ledger references a missing file: ${file}`);

  for (const file of ledgered) {
    if (!policy.donorRoots.some((r) => file.startsWith(`${r}/`))) continue;
    const text = read(file);
    if (typeof text !== "string") continue;
    for (const spec of collectImportSpecs(text)) {
      const candidates = resolveRelativeImport(file, spec);
      if (!candidates.length) continue;
      const resolved = candidates.find((c) => fileSet.has(c));
      const target = resolved ?? candidates[0];
      for (const e of excluded)
        if (e.regex.test(target))
          violations.push(
            `Ledger import closure hits excluded path: ${file} -> ${target} (${e.reason})`,
          );
      if (
        resolved &&
        policy.donorRoots.some((r) => resolved.startsWith(`${r}/`)) &&
        !ledgered.has(resolved) &&
        !local.has(resolved)
      )
        violations.push(
          `Ledger import closure hits unrecorded donor file: ${file} -> ${resolved}`,
        );
    }
  }
  return violations;
}

export function checkExcludedContentHashes({
  files,
  readBytes,
  denied,
  excludedPaths,
}) {
  const violations = [];
  const byHash = new Map(denied.map((d) => [d.sha256, d]));
  const patterns = excludedPaths.map((e) => ({
    ...e,
    regex: new RegExp(e.pattern, "i"),
  }));
  for (const entry of denied) {
    const mapped = patterns.some((e) => e.regex.test(entry.original));
    if (!mapped)
      violations.push(
        `Excluded content hash is not mapped to import-policy excludedPaths: ${entry.original}`,
      );
  }
  for (const file of files) {
    const hash = readBytes(file);
    const hit = byHash.get(hash);
    if (hit)
      violations.push(
        `Excluded donor content present (${hit.original} under ${file}): ${hit.reason}`,
      );
  }
  return violations;
}
