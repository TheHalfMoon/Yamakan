# Developer environment and test harness

Use an owned checkout and preserve other agents' work. Inspect `AGENTS.md`, current frontier, active PRs, worktrees and task ownership before execution. Run all shell commands through RTK.

## Repeatable Windows setup

The following commands are run from a newly owned checkout with Node satisfying `package.json` and Git LFS available. Replace example workspace paths deliberately; never run installation through a shared node_modules junction.

```powershell
rtk proxy git status --short --branch
rtk proxy git fetch origin main
rtk proxy git worktree list
rtk proxy node --version
rtk proxy npm --version
rtk proxy git lfs pull
rtk proxy npm ci --ignore-scripts
rtk proxy npm run qualify:ultimate-environment
```

Inspect qualifier arguments/output in `scripts/qualify-ultimate-environment.mjs`; keep its complete report, including BLOCKED fields. SS-002 checks the same selected media runtime as production, including companion DLLs and LFS pointers, before bounded executable probes. A usable EXE alone is insufficient.

Native work requires an owned `CARGO_TARGET_DIR`; then run `rtk proxy npm run build:native`. Do not rebuild/clean a shared native target. TesterArmy has its own `e2e/testerarmy` lockfile/install; install there with scripts disabled only when it is an owned directory. Do not download another browser/model merely because an optional tool is absent.

Use task-owned TEMP/TMP and artifact directories on a volume with adequate free space. If Git metadata shares a full volume, create an isolated clone instead of pretending a worktree relocates metadata. Preserve failed logs. No recursive cleanup of shared caches, other checkouts or unverified paths.

## Verification commands and selection

```powershell
rtk proxy npm run typecheck
rtk proxy npm run lint
rtk proxy npm run format:check
rtk proxy npm run provenance:check
rtk proxy npm run brand:check
rtk proxy npm test
rtk proxy npm run build
rtk proxy npm run test:e2e
rtk proxy npm run test:e2e:studio
```

Run focused regression tests first; then affected repository gates. For media work select the existing qualification script for preview, A/V sync, playback, typography, resources or ultimate benchmarks. Read its CLI before running it. Do not overlap FFmpeg qualification suites. Full Studio tests apply to Studio changes; broader repetition requires a new delta, failure or unresolved concern. A documented platform skip is not a pass on that platform.

For a defect, record the genuine failing case before the fix when feasible. Tests must assert product behavior, not mirror implementation. Use real files/decoding for media, actual browser interaction for UX and owned-process interruption for recovery.

## Local tool roles and limits

| Tool            | Required use when relevant                                                                | Gate meaning                                                               |
| --------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| PStack          | Resume/spec/build/review/close procedures available in this environment                   | Fresh-context review is required; routine authorization is already granted |
| Graft           | Deterministic graph/call-site and dependency impact analysis                              | Structural evidence, not runtime correctness                               |
| D1 local        | Typed bounded prioritization/triage, confidence retained                                  | Advisory only; never independent security/release approval                 |
| Alibaba OCR     | Local diff/rule/coverage preview; full review only with verified authorized local backend | Preview is not full AI review; no unapproved cloud transfer                |
| Edge/Playwright | Actual offline editor, permissions, recovery and interaction journeys                     | Keep network/process evidence and failed attempts                          |
| TesterArmy      | Additional real-browser Studio/recovery journey                                           | Complements existing deterministic tests                                   |

Discover installed binaries/skills and local endpoints before invoking them. Do not invent command-line switches or report a tool “run” merely because installed. Current receipts in [12](12_EXECUTION_AND_CONTINUATION_LEDGER.md) distinguish actual use and blocked features.

## Concurrency, reviews and CI

One task owns each overlapping production boundary. Independent docs/source inspection may run alongside one resource-heavy media suite. Record owner, branch, base/head, touched paths, native target and media slot in durable PR evidence. Rebase/merge current main normally when needed; never force push or overwrite another agent's changes.

Fresh independent correctness and security review examine an immutable diff and its acceptance evidence. Fix must-fix findings, rerun affected checks, obtain delta review and exact-head CI. Merge through normal repository controls pinned to the qualified head, then verify post-merge main and affected behavior. Record both SHAs; branch results are not main results.

When reviewers are unavailable, continue local verification/research and leave unreviewed PRs in draft. A local advisory or green CI cannot replace review. SS-017 improves onboarding, impact-based test selection, bounded logging and reproducible evidence only after measuring actual friction; no new build orchestration platform is presumed.
