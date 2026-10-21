// Q15 (W4): Windows user-presence confirmation for human-only commands.
// When no native helper is available, record the binding fail decision and
// the transport-bound fallback documented in docs/SECURITY.md.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RECEIPT = "docs/evidence/qualification/q15-user-presence.json";
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", ".", `:!${RECEIPT}`);
if (dirty)
  throw new Error(`Commit or stash changes before qualifying:\n${dirty}`);
const commit = git("rev-parse", "HEAD");

const outcome =
  process.platform === "win32"
    ? {
        decision: "fallback" as const,
        reason:
          "No native UserConsentVerifier helper is wired in native/procd yet; human-only commands rely on the single-use launch secret (60 s TTL) with residual same-account risk recorded in docs/SECURITY.md.",
        probes: [] as { method: string; result: string }[],
      }
    : {
        decision: "fallback" as const,
        reason:
          "Q15 probes run on Profile A (Windows). This host is not Windows; the launch-secret fallback applies until a Windows receipt passes.",
        probes: [] as { method: string; result: string }[],
      };

const receipt = {
  receipt: "yamakan.qualification/q15-user-presence/1",
  commit,
  measuredAt: new Date().toISOString(),
  qualification: "q15-user-presence",
  outcome: outcome.decision,
  bindingFailApplied: outcome.decision === "fallback",
  documentation: [
    "docs/SECURITY.md (W4 / Q15 residual)",
    "tests/agent-principals.test.ts (launch secret single-use and expire)",
    "tests/http.test.ts (launch exchange consumes the link)",
  ],
  ...outcome,
};

await mkdir(path.dirname(RECEIPT), { recursive: true });
await writeFile(RECEIPT, JSON.stringify(receipt, null, 2) + "\n", "utf8");
console.log(JSON.stringify(receipt, null, 2));
