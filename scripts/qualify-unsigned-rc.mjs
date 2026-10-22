/**
 * P10-08 residual — Unsigned RC packaging qualification (safe test roots only).
 * Does not claim Profile A, signing, or public release.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const outDir = resolve("docs/evidence/qualification");
mkdirSync(outDir, { recursive: true });
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const receiptPath = join(outDir, "p10-08-unsigned-rc.json");

let testOk = false;
let testOutput = "";
try {
  testOutput = execFileSync(
    process.execPath,
    ["--test", "tests/unsigned-rc.test.ts"],
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
  qualification: "P10_08_UNSIGNED_RC",
  task: "P10-08-residual",
  checkedAt: new Date().toISOString(),
  gitHead: head,
  passed: testOk,
  suite: "tests/unsigned-rc.test.ts",
  assessment: "docs/evidence/qualification/p10-08-unsigned-rc-assessment.md",
  covered: [
    "assessment: unsigned RC without signing cert is feasible for internal/test",
    "packUnsignedRc layout + UNSIGNED-RC.txt marker (+ zip on Windows)",
    "safe install root refuses Program Files",
    "install → launch-verify → update → rollback → uninstall",
    "zip install round-trip (Windows)",
    "refuse install without marker",
  ],
  claims: {
    release: false,
    signed: false,
    profileA: false,
    publicShip: false,
  },
  residuals: [
    "Windows release installer / Authenticode code signing — open (cert not authorized)",
    "Clean Profile A install (H2) — external",
    "Public release / H5 founder ship — NO-GO",
    "Auto-update servers — out of scope",
  ],
  profileAClaimed: false,
  detail: testOk
    ? "Unsigned RC pack/install lifecycle PASS on safe test roots; signing, Profile A, and public release remain open."
    : "Unsigned RC suite FAILED — see testOutput.",
  testOutputTail: testOutput.slice(-4000),
};

writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(readFileSync(receiptPath, "utf8"));
if (!testOk) process.exit(1);
console.log(`UNSIGNED RC ENG PASS — ${receiptPath}`);
