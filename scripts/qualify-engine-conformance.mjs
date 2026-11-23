/**
 * MPR-206: the conformance kit over every registered adapter, and the intake of every qualified
 * or offered model, by running the tests that hold them and writing down what each said. Only the
 * in-process fake and the stand-ins that the test files have: no network but loopback, no account,
 * no download, no model, no spend. A check that a stand-in cannot arrange is UNAVAILABLE with its
 * reason, which is not a pass; one that fails ends this with FAIL.
 *
 * Usage: node scripts/qualify-engine-conformance.mjs [evidence.md]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Operation, diagnostic } from "../core/engines/contract-v2.ts";
import { readHost } from "./qualify-host.mjs";
import { ADAPTER_SUITES, PENDING } from "../tests/fixtures/engine-suites.ts";
import { CONFORMANCE_CHECKS } from "../tests/fixtures/engine-conformance.ts";

// Before anything runs.
const host = readHost();
const where = fileURLToPath(new URL("..", import.meta.url));
const git = (...args) =>
  execFileSync("git", args, {
    cwd: where,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
const head = git("rev-parse", "HEAD");
const dirty = git("status", "--porcelain") !== "";
const out =
  process.argv[2] ??
  join(where, "docs", "evidence", "model-system", "engine-conformance.md");

const files = [
  ...new Set([...Object.values(ADAPTER_SUITES), "model-intake.test.ts"]),
];
// Only the kit's own tests of a file that has others: those named by a check.
const named = new RegExp(`^(.+): (${CONFORMANCE_CHECKS.join("|")})$`);
const rows = [];
const intake = [];
const others = [];
let complete = true;
for (const file of files) {
  const whole = ["engine-conformance.test.ts", "model-intake.test.ts"];
  const ran = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=tap",
      ...(whole.includes(file)
        ? []
        : [`--test-name-pattern=/${named.source}/`]),
      join("tests", file),
    ],
    {
      cwd: where,
      encoding: "utf8",
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  let seen = 0;
  for (const line of (ran.stdout ?? "").split(/\r?\n/)) {
    const said = /^(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO)\s?(.*))?$/.exec(
      line,
    );
    if (!said) continue;
    seen++;
    const [, ok, name, skipped, why] = said;
    const outcome = ok === "not ok" ? "FAIL" : skipped ? "UNAVAILABLE" : "PASS";
    const check = named.exec(name);
    const of = /^intake of (\S+):/.exec(name);
    if (check)
      rows.push({
        adapter: check[1],
        check: check[2],
        outcome,
        why: why ?? "",
      });
    else if (of) intake.push({ offer: of[1], outcome });
    else others.push({ name, outcome });
  }
  // A file that ended another way than its tests say has not been read whole.
  if (
    !seen ||
    ran.error ||
    ran.signal ||
    ran.status === null ||
    !/^1\.\.\d+$/m.test(ran.stdout)
  ) {
    complete = false;
    console.error(diagnostic(`${file} did not run to its end.`));
  }
}
const adapters = [...new Set(rows.map((r) => r.adapter))];
// Every adapter has every check, once.
for (const adapter of adapters)
  for (const check of CONFORMANCE_CHECKS)
    if (
      rows.filter((r) => r.adapter === adapter && r.check === check).length !==
      1
    ) {
      complete = false;
      console.error(`${adapter}: ${check} was not seen once.`);
    }
const all = [...rows, ...intake, ...others];
const passed =
  complete &&
  adapters.length > 0 &&
  intake.length > 0 &&
  // Skipped is for a check of the kit, with a reason.
  all.every((r) => r.outcome !== "FAIL") &&
  [...intake, ...others].every((r) => r.outcome === "PASS") &&
  rows.every((r) => r.outcome !== "UNAVAILABLE" || r.why.trim());

const cell = (text) => text.replaceAll("|", "\\|");
const block = `## The check

\`npm run qualify:engine-conformance\`: **${passed ? "PASS" : "FAIL"}** at \`${head}\`${dirty ? ", with changes not committed" : ""}, on ${host.platform}${host.githubImage ? ` (${host.githubImage})` : ""}, with the in-process fake and the test files' own stand-ins. No network but loopback, no account, no download, no model and no spend.

Operations compared with the contract: ${Operation.options.map((o) => `\`${o}\``).join(", ")}.

Adapter files not yet registered: ${PENDING.length ? PENDING.map((p) => `\`${p}\``).join(", ") : "none"}.

| Adapter | Check | Result |
|---|---|---|
${rows.map((r) => `| ${cell(r.adapter)} | \`${r.check}\` | ${r.outcome}${r.why ? `: ${cell(diagnostic(r.why) ?? "")}` : ""} |`).join("\n")}

| Offer | Machine-checked intake |
|---|---|
${intake.map((r) => `| \`${r.offer}\` | ${r.outcome} |`).join("\n")}

The same files' other tests: ${others.filter((r) => r.outcome === "PASS").length} of ${others.length} passed.
`;
const held = readFileSync(out, "utf8");
const at = held.indexOf("\n## The check\n");
writeFileSync(
  out,
  `${(at < 0 ? held : held.slice(0, at)).trimEnd()}\n\n${block}`,
);
for (const r of all)
  if (r.outcome === "FAIL")
    console.error(
      `FAIL ${r.adapter ? `${r.adapter}: ${r.check}` : (r.name ?? r.offer)}`,
    );
console.log(`ENGINE CONFORMANCE ${passed ? "PASS" : "FAIL"}`);
process.exit(passed ? 0 : 1);
