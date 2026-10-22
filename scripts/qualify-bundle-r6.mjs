/**
 * P10-08 — Achievable R6 bundle lifecycle qualification (dev install root).
 * Runs node:test bundle suite and records honest residuals (Profile A / release installer / signing).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const receiptPath = join(outDir, "p10-08-bundle-r6.json");

let testOk = false;
let testOutput = "";
try {
  testOutput = execFileSync(
    process.execPath,
    ["--test", "tests/bundle.test.ts"],
    { encoding: "utf8", windowsHide: true },
  );
  testOk = true;
} catch (err) {
  testOutput =
    err instanceof Error && "stdout" in err
      ? String(/** @type {{ stdout?: string }} */ (err).stdout ?? err.message)
      : String(err);
  testOk = false;
}

const receipt = {
  qualification: "P10_08_BUNDLE_R6",
  task: "P10-08",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  passed: testOk,
  suite: "tests/bundle.test.ts",
  covered: [
    "manifest hashes + install pointer switch",
    "update then rollback with confirmation",
    "rollback refused without confirmation",
    "junction-safe uninstall",
    "install-dev scaffold + verifyInstalledBinaries",
    "tampered file fails verification",
  ],
  launchVerify: {
    mechanism:
      "server/main.ts calls verifyInstalledBinaries when YAMAKAN_BUNDLE_INSTALL is set",
    releaseArtifactLaunchVerify: "open",
  },
  residuals: [
    "Clean Profile A install (H2) — external",
    "Windows release installer / Authenticode signing — open (unsigned RC path: qualify:unsigned-rc; not a release)",
    "Auto-update servers — out of scope",
    "Do not claim Profile A from this dev-root suite",
  ],
  profileAClaimed: false,
  detail: testOk
    ? "Bundle lifecycle unit suite PASS in temp install roots; Profile A and release installer remain open."
    : "Bundle suite FAILED — see testOutput.",
  testOutputTail: testOutput.slice(-4000),
};

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(readFileSync(receiptPath, "utf8"));
if (!testOk) process.exit(1);
console.log(`BUNDLE R6 ENG PASS — ${receiptPath}`);
