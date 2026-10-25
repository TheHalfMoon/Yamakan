# Ultimate master plan — execution ledger

Durable continuation record for the YU task program (plan: Draft PR #86, `docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/TASK_REGISTRY.json` on branch `research/ultimate-master-plan-2026-10-23`; authorization: [FOUNDER_DECISION_RECORD](../../FOUNDER_DECISION_RECORD.md#2026-10-25-ultimate-master-plan-autonomous-execution)). Planning PRs #85/#86 stay open and unmerged; the registry there is not edited by implementation PRs — task state lives here and in `receipts/`.

States: PLANNED → IMPLEMENTED (code + tests on a branch) → MERGED (exact-head CI green, reviewed, merged) → VERIFIED (post-merge main re-checked; receipt complete). BLOCKED names its blocker and owner.

## Task state

| Task                                                               | State                       | PR              | Receipt                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YU-000 baseline evidence                                           | VERIFIED                    | #88 → `01ccbe5` | [receipts/YU-000.json](receipts/YU-000.json)                                                                                                              |
| YU-001 environment reproduction                                    | VERIFIED                    | #88 → `01ccbe5` | [receipts/YU-001.json](receipts/YU-001.json)                                                                                                              |
| YU-002 Quality Lab evidence                                        | VERIFIED                    | #87 → `b5c3372` | [receipts/YU-002.json](receipts/YU-002.json)                                                                                                              |
| YU-003 MCP bounds                                                  | VERIFIED                    | #90 → `0fe9a18` | [receipts/YU-003.json](receipts/YU-003.json)                                                                                                              |
| (unplanned) zod GHSA-mrhx-c7xc-m3w5                                | MERGED                      | #89 → `cfc6cd7` | security dependency fix that unblocked CI's `npm audit` gate                                                                                              |
| YU-010a v5 refs, schema v8, store commit/get/list (flag off)       | MERGED, post-merge verified | #91 → `fc4913e` | flag-off slice                                                                                                                                            |
| YU-010b staged upload route + `yamakan.document.commit` (flag off) | MERGED, post-merge verified | #92 → `a468345` | flag-off slice                                                                                                                                            |
| YU-010c SDK / CLI / MCP document clients (flag off)                | MERGED, post-merge verified | #93 → `49f1a9e` | flag-off slice; main `49f1a9e` on Windows: 448/450 (0 fail), Edge E2E pass, YU-010 tests 32/32; push CI success                                           |
| YU-010 overall                                                     | VERIFIED (flag-off scope)   | #91, #92, #93   | AG-DOCS activation still needs the YU-010…015 group receipt                                                                                               |
| YU-011 Studio canvas persistence                                   | VERIFIED (flag-off scope)   | #94 → `ccdde01` | [receipts/YU-011.json](receipts/YU-011.json); main `ccdde01` on Windows: 460/462 (0 fail), Studio 1975/1975, Edge E2E and TesterArmy journey pass         |
| YU-016 waveform peak tiles                                         | VERIFIED                    | #95 → `69118c0` | [receipts/YU-016.json](receipts/YU-016.json); main `69118c0` on Windows: 475/477 (0 fail), Studio 1975/1975, Edge E2E (tiles) and TesterArmy journey pass |
| YU-012 legacy Cinema sidecar migration (flag off)                  | IMPLEMENTED (this PR)       | —               | —                                                                                                                                                         |
| YU-013…YU-015, YU-017…YU-101                                       | PLANNED                     | —               | —                                                                                                                                                         |

## Development tool status (Windows 11, this PC)

- **PStack** v2.3.1 (`~/.tooling/pstack`, skills not installed into the agent; ps-review procedure applied through fresh-context subagent judges). Ran: ps-review light panel on YU-000/001 and YU-002.
- **Graft** 0.21.1, local deterministic build only (`graft build .`: 515 files parsed), telemetry off; no `--deep`/LLM pass.
- **Liquid AI d1-omni-600M** (local llama-server, `127.0.0.1:18775`, CPU): advisory triage only; never a gate.
- **Alibaba Open Code Review** 1.13.3: `ocr review --preview` runs locally. **Full AI review is BLOCKED**: the configured provider is a cloud ChatGPT account, so code would leave the machine; no local generative backend is configured.
- **TesterArmy e2e**: integrated with YU-011 as `e2e/testerarmy/` (own lockfile; `e2e@0.20.0`, `@e2e-dev/web@0.14.0`, zod overridden to 4.6.7 because e2e pins vulnerable 4.6.1; `npm audit` 0). Installed Edge over CDP, no model, telemetry off, no browser download. `npm run test:e2e:studio` (after `npm ci --ignore-scripts` in that folder). The existing Edge E2E (`npm run test:e2e`) stays the general browser gate.
- **Local generative model for OCR**: `D:\tmp\mesc-local-ocr-review\Qwen3-4B-Q4_K_M.gguf` (SHA-256 `7485fe6f…dfa5`, matches its earlier record) with a llama.cpp Vulkan runtime was found from an earlier project. Usable for full OCR review without downloads, but only with ≥4 GB free RAM; on 2026-10-25 the host had 1.7 GB free (other applications), so full OCR review stays `OCR_FULL_REVIEW_BLOCKED (insufficient RAM)`. Never point OCR at the configured cloud provider.

## Environment findings (2026-10-25)

1. `%LOCALAPPDATA%\Yamakan\worker-tools` had been turned into a junction to `D:\CleanupPreserved\YamakanWorkerTools_20261024` by a disk cleanup. procd cannot create its container-granted tools folder through it, so every sandboxed worker launch failed (112/380 unit tests; Edge E2E failed at media import; one test hung forever). The junction was replaced with a real folder (the D: copy is untouched). The environment capture now reports `WORKER_TOOLS_REDIRECTED` as BLOCKED, and the hanging fixture fails fast.
2. The main clone's `node_modules` predates the `jassub` pin (5 packages missing). The capture now checks every lockfile package for this OS/CPU and reports drift as BLOCKED; worktrees install with CI's own `npm ci --ignore-scripts`.
3. Disk: C: ≈7.8 GB free, D: ≈4.8 GB free. Keep generated media small; no weights.

4. 2026-10-25 afternoon: C: fell to under 1 GB free, driven by other workloads (a growing WSL `ext4.vhdx`, another project's Rust builds). Yamakan work now keeps test temp files and the TesterArmy workspace on D: (`TEMP`/`TMP`, `YAMAKAN_E2E_ROOT`). `scripts/browser-e2e.mjs` and an overlap test leak `yamakan-browser-*` / `yamakan-overlap-*` temp folders (about 15 MB per run); 443 MB had accumulated. Follow-up: clean them up in the scripts.
5. `npm run qualify:q8` fails on main: it asserts `data-studio-enabled === "false"`, untrue since Studio activation (#61). Its receipt predates activation. Follow-up: update the harness (a separate change that regenerates its receipt).

## Known flaky tests

- `tests/resource-policy.test.ts` "a worker over its Job Object memory limit fails rather than grows": failed once on main `a468345` while another suite ran servers concurrently; passed 3/3 alone. Load-sensitive; not caused by YU-010b. Re-run alone before treating as a regression. Repeatability: 3/3 alone at `a468345`; 0 failures in the full suites at `49f1a9e` and on the YU-011 branch. Resource contention is plausible: the host had 1.7 GB of 15.7 GB RAM free (other applications) when it failed. Not yet reproduced under controlled memory pressure.
- 2026-10-25, YU-016 branch `6f80273`, with the shared host at about 53% CPU and 3.1 GB RAM free (other sessions and applications):
  - **Failed in the full suite, all hitting their 60 s limit:** `tests/jobs.test.ts` "a service killed mid-render…", `tests/timeline.test.ts` "audio gain and fades…" and `tests/typography.test.ts` "the title capability probe…".
  - **Also failed:** the Studio vitest `documentModel.fuzz.test.ts` depth-boundary case, at 5.4 s against vitest's 5 s.
  - **Alone, all pass:** jobs 34 s, timeline 17 s, typography 7.6 s, fuzz file 163/163.
  - **Earlier full run:** the preview-route (`tests/http.test.ts`) and MCP stdio tests failed while another worktree's `tsc` ran concurrently, and passed alone (8.5 s against 34 s under load).
  - **Reading:** these are wall-clock-bound tests on a loaded host, not regressions from the change. Exact-head CI is the clean-machine check.
  - **Follow-up:** run gates only on an idle host, and consider per-test budgets that scale with measured load.

## Next eligible

YU-010 and YU-011 are VERIFIED flag-off (AG-DOCS activation needs the YU-010…015 group receipt); YU-016 is VERIFIED. YU-012 (Cinema sidecar migration into documents) is in review. Then YU-013 (Director in SQLite), YU-015 (canonical browser operations/undo) and YU-014 (complete backup/restore, including documents and Studio bitmaps), in DAG order.

## Continuation instructions

1. Re-verify live main, open PRs and this ledger; never redo a VERIFIED task.
2. Worktrees: `C:\Users\Shehr\Yamakan-yu*` (one per task). Install with `npm ci --ignore-scripts --no-audit --no-fund`, or junction to a drift-free install — but never run `npm ci` through a junction (npm replaces it and empties the shared target).
3. Before trusting a failing sandbox test run, run `npm run qualify:ultimate-environment` (BLOCKED codes explain environment faults).
