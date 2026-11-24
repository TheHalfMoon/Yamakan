// A temporary folder of this test file's own, in place of the computer's. A Kaggle engine tidies
// the one it is given and removes old run folders it does not know, so one made with the
// computer's could remove a person's own video that has not been brought in. Import it first.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const own = mkdtempSync(path.join(tmpdir(), "yamakan-test-temp-"));
for (const name of ["TEMP", "TMP", "TMPDIR"]) process.env[name] = own;
process.on("exit", () => {
  try {
    rmSync(own, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    // Something still holds it: it is the system's to tidy.
  }
});
