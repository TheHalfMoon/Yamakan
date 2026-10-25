# Ultimate master plan — execution ledger

Durable continuation record for the YU task program (plan: Draft PR #86, `docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/TASK_REGISTRY.json` on branch `research/ultimate-master-plan-2026-10-23`; authorization: [FOUNDER_DECISION_RECORD](../../FOUNDER_DECISION_RECORD.md#2026-10-25-ultimate-master-plan-autonomous-execution)). Planning PRs #85/#86 stay open and unmerged; the registry there is not edited by implementation PRs — task state lives here and in `receipts/`.

States: PLANNED → IMPLEMENTED (code + tests on a branch) → MERGED (exact-head CI green, reviewed, merged) → VERIFIED (post-merge main re-checked; receipt complete). BLOCKED names its blocker and owner.

## Task state

| Task | State | PR | Receipt |
| ---- | ----- | -- | ------- |
| YU-000 baseline evidence | VERIFIED | #88 → `01ccbe5` | [receipts/YU-000.json](receipts/YU-000.json) |
| YU-001 environment reproduction | VERIFIED | #88 → `01ccbe5` | [receipts/YU-001.json](receipts/YU-001.json) |
| YU-002 Quality Lab evidence | VERIFIED | #87 → `b5c3372` | [receipts/YU-002.json](receipts/YU-002.json) |
| YU-003 MCP bounds | VERIFIED | #90 → `0fe9a18` | [receipts/YU-003.json](receipts/YU-003.json) |
| (unplanned) zod GHSA-mrhx-c7xc-m3w5 | MERGED | #89 → `cfc6cd7` | security dependency fix that unblocked CI's `npm audit` gate |
| YU-010a v5 refs, schema v8, store commit/get/list (flag off) | MERGED, post-merge verified | #91 → `fc4913e` | flag-off slice |
| YU-010b staged upload route + `yamakan.document.commit` (flag off) | MERGED, post-merge verified | #92 → `a468345` | flag-off slice |
| YU-010c SDK / CLI / MCP document clients (flag off) | IMPLEMENTED | (this PR) | after merge |
| YU-011…YU-101 | PLANNED | — | — |

## Development tool status (Windows 11, this PC)

- **PStack** v2.3.1 (`~/.tooling/pstack`, skills not installed into the agent; ps-review procedure applied through fresh-context subagent judges). Ran: ps-review light panel on YU-000/001 and YU-002.
- **Graft** 0.21.1, local deterministic build only (`graft build .`: 515 files parsed), telemetry off; no `--deep`/LLM pass.
- **Liquid AI d1-omni-600M** (local llama-server, `127.0.0.1:18775`, CPU): advisory triage only; never a gate.
- **Alibaba Open Code Review** 1.13.3: `ocr review --preview` runs locally. **Full AI review is BLOCKED**: the configured provider is a cloud ChatGPT account, so code would leave the machine; no local generative backend is configured.
- **TesterArmy e2e**: not yet integrated into Yamakan (existing Edge E2E `scripts/browser-e2e.mjs` is the browser gate). A pinned `e2e@0.20.0` + `@e2e-dev/web@0.14.0` harness pattern exists on this PC from another project; integration is scheduled with the first UI task (YU-011/YU-015).

## Environment findings (2026-10-25)

1. `%LOCALAPPDATA%\Yamakan\worker-tools` had been turned into a junction to `D:\CleanupPreserved\YamakanWorkerTools_20261024` by a disk cleanup. procd cannot create its container-granted tools folder through it, so every sandboxed worker launch failed (112/380 unit tests; Edge E2E failed at media import; one test hung forever). The junction was replaced with a real folder (the D: copy is untouched). The environment capture now reports `WORKER_TOOLS_REDIRECTED` as BLOCKED, and the hanging fixture fails fast.
2. The main clone's `node_modules` predates the `jassub` pin (5 packages missing). The capture now checks every lockfile package for this OS/CPU and reports drift as BLOCKED; worktrees install with CI's own `npm ci --ignore-scripts`.
3. Disk: C: ≈7.8 GB free, D: ≈4.8 GB free. Keep generated media small; no weights.

## Known flaky tests

- `tests/resource-policy.test.ts` "a worker over its Job Object memory limit fails rather than grows": failed once on main `a468345` while another suite ran servers concurrently; passed 3/3 alone. Load-sensitive; not caused by YU-010b. Re-run alone before treating as a regression.

## Next eligible

After YU-010a–c merge, YU-010 is implementation-complete flag-off; its VERIFIED receipt is flag-off scope only (AG-DOCS activation needs the YU-010…015 group receipt). Then YU-011 (Studio canvas persistence through documents: engine image-id translation, canvas-internal refs ⊆ bitmapAssetIds, UI load/commit, TesterArmy e2e), YU-012 (Cinema), YU-013 (Director), YU-015 (canonical browser operations/undo), YU-014 (complete backup/restore incl. documents). YU-016 (waveforms/thumbnails/proxies) can proceed in parallel.

## Continuation instructions

1. Re-verify live main, open PRs and this ledger; never redo a VERIFIED task.
2. Worktrees: `C:\Users\Shehr\Yamakan-yu*` (one per task). Install with `npm ci --ignore-scripts --no-audit --no-fund`, or junction to a drift-free install — but never run `npm ci` through a junction (npm replaces it and empties the shared target).
3. Before trusting a failing sandbox test run, run `npm run qualify:ultimate-environment` (BLOCKED codes explain environment faults).
