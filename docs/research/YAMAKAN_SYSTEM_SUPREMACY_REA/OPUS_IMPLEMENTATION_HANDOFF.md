# Opus implementation handoff — execution held

Updated 2026-11-03, Asia/Riyadh. **Astro's planning qualification is complete. Claude Opus is the implementation lead after founder handoff.** Independent architecture/correctness/security reviews, exact-head CI, normal merge and post-main verification passed. [Actual evidence](23_FINAL_POST_MERGE_VERIFICATION.md). The founder has not yet handed over execution authority; do not begin the engineering program.

Authoritative plan: [README](README.md), [31 complete contracts](TASK_REGISTRY.json), [16 subsystem decisions](SUBSYSTEM_DECISIONS.json), [architecture](19_FINAL_ARCHITECTURE_ASSESSMENT.md), [readiness gates](PLANNING_GATES.json), [continuation](20_FINAL_PLANNING_CHECKPOINT.md). Task IDs are stable; SS-004/005 are aggregates, not separate implementation PRs.

## Exact starting point and authority

Verified implementation baseline is **`c129a50c9e6bf9657f404c919c3cf6dbb8273697`**. Final planning PR [#155](https://github.com/TheHalfMoon/Yamakan/pull/155) merged normally at **`4835cdfe19da9272956629b797d0d989eb9e251f`**; its post-main CI passed in [run41637577370](https://github.com/TheHalfMoon/Yamakan/actions/runs/41637577370). Opus starts from that final planning merge, or a separately reviewed and CI-verified descendant after checking intervening changes. The follow-up receipt describes this existing merge; it does not claim to verify its own future publication.

Founder precedence: the final-planning directive overrides earlier autonomous engineering language until handoff. PRs [#85](https://github.com/TheHalfMoon/Yamakan/pull/85) and [#86](https://github.com/TheHalfMoon/Yamakan/pull/86) remain historical research. Their old PLANNED flags do not reopen verified YU work. The [44-task reconciliation](LEGACY_RECONCILIATION.json) and merged receipts govern preservation. Existing operational/resource/release restrictions still apply. No directive here authorizes models, spending, expanded limits, packaging or release.

## Target architecture to implement after approval

Use one SQLite project/job authority, one typed registry and canonical integer-time operations. Keep existing take proposals/CAS and per-writer undo. Human-only Director approval remains distinct from authorized agent `project:write`; do not add a blanket approval requirement to ordinary mutations. Shared render-plan compilation feeds trusted FFmpeg export and reference preview. Interactive proxies are disposable presentation. Current jobs/leases/epochs own execution and publication; handoff summaries and creative memory are bounded project documents, not new stores.

Preserve SS-001/002/003. Improve review/progress/recovery, exact editing interactions, preview disposal/cache behavior, measured audio controls and honest portability. Measure M before a single graph optimization; record NO-GO if no safe improvement qualifies. No new scheduler, vector memory, GPU/native decoder, browser renderer or archive extractor is selected. [19](19_FINAL_ARCHITECTURE_ASSESSMENT.md) resolves alternatives and [18](18_FINAL_SUBSYSTEM_DECISIONS.md) maps all subsystems.

## First five tasks after all planning gates and founder handoff

No task below is executable during the current hold. After R-01–R-05 are VERIFIED and the founder hands the plan to Opus, these five have no unfinished engineering prerequisite beyond the stated verified baseline:

| Rank | Task                                                | Why ready after planning                                                 | First concrete action                                                                                                                                                          |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | SS-004a — qualify and land existing command journey | SS-003 already merged; implementation exists separately in draft PR #157 | Review exact `5388eed9033af9185919367440e385e93290cf83` or its current successor; retain prior CI but obtain fresh required review. Merge separately only after qualification. |
| 2    | SS-005a — profile M                                 | SS-002 merged; R-03 planning prerequisite resolved before handoff        | Reserve media slot; pin runtime/fixture/policy/host; retain baseline failures and measure redundant decode/scale hypothesis.                                                   |
| 3    | SS-017 — reproducible development/evidence setup    | SS-002 merged; no media result dependency                                | Verify owned checkout/dependency/native/temp roots and execute documented environment diagnostics.                                                                             |
| 4    | SS-006 — existing take-proposal review              | SS-003 merged; R-02/R-04 resolved before handoff                         | Trace existing proposeReplace/apply and render its exact impact/hash in Director review without changing global scope semantics.                                               |
| 5    | SS-009 — preview/cache/lifetime qualification       | SS-002 merged; R-03 resolved before handoff                              | Exercise cache identity, shared-waiter cancellation, stale project-switch response and browser disposal against reference preview.                                             |

Read-only inspection of PR #157 may occur during the hold, but its engineering changes and landing remain reserved for Opus after founder handoff and separate qualification. It is not part of PR #155.

Then follow registry dependencies: SS-007 → SS-008 → SS-004b; SS-009 → SS-010; SS-006 → SS-011; SS-004b+011 → SS-016. SS-012/013/014/015 are independent qualification cards once global research gates pass, but share media/UI ownership. SS-005b requires SS-005a baseline profiles and its hypothesis-or-REJECTED decision. SS-018 consolidates affected gates; SS-019 publishes engineering evidence without shipping. X-01/02/03 remain external.

## Source selections and rights

Retain exact imported pins/hashes/notices from `docs/provenance/imports.json`, not upstream default heads. Key retained sources are OpenCut Classic `cf5e79e919144200294fb9fed22a222592a0aeea` (MIT timeline helpers), Filmmaker `752cd43d3af6421d2bd6d4ce27f2d9815f7acba3` (GPL-3.0-or-later UI adaptations), OpenMontage `9327439db69021ab4b0e2776729bf3b58fdb5a87` (AGPL prerequisite translation), Gomrey `5f299a7a6174ad3a1180f827778db5f4400a4d71` (Apache-2.0 transition rules) and Ascout `ca6b6f514e5a8881e2cfa2789b5e5ea43e3aaaad` (Apache-2.0 lineage concepts). Retain all other existing imports and restrictions, including source-specific grants and do-not-import paths.

The fresh Kinewright/OpenFilm/OpenEdit/Temporal/Orcel/MLT/libass/SpecGrain observations select boundary or test ideas, **not new copied runtime code**. Research pins and closures are in 14–17. WePLD/Zain/private source is not licensed for transplantation by this planning decision. Remotion and model/weight/service terms require separate rights. Existing FFmpeg 7.1.1/libass0.17.3 r8 bytes/DLLs and lockfile packages stay pinned. No automatic upgrade, remote script execution or donor test execution is required to start these tasks.

## Module ownership and concurrency

| Owner lane        | Paths                                                                        | Coordination rule                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Authority/harness | `core/store.ts`, `core/command`, `core/director`, `core/jobs*`, SDK/CLI/MCP  | One builder for overlapping registry/transaction changes; fresh reviewer is not builder.                           |
| Media             | `core/render*`, `core/audio`, `core/process`, preview/browser media adapters | One heavy media qualification process at a time; coordinate cache/renderer versions and runtime hashes.            |
| Editor/product    | `src/editor`, `src/director`, `src/captions.tsx`, project shell              | Shared command interfaces agreed before parallel UI changes; no direct store writes.                               |
| Evidence/tooling  | `scripts`, planning/evidence docs, e2e harness                               | Disjoint documentation work may proceed alongside one media workload; do not change active fixtures beneath a run. |

Each task PR records builder, branch, base/head, exact touched paths, owned worktree, native target, temp/artifact root and media-slot ownership. Never share writable node_modules, Cargo targets or temporary roots between active builders. Read-only use of an unchanged installed tool is distinct from rebuilding it. Never force-push, reset another branch, clean shared paths or absorb PR #157 into planning.

## Local setup and commands

Read `AGENTS.md`, `specs/CURRENT.md`, `docs/OPERATIONAL_CONTRACTS.md`, this handoff and the chosen registry card. All shell commands use RTK. Inspect each script's actual CLI before adding arguments. Example commands from an owned checkout:

```powershell
rtk proxy git status --short --branch
rtk proxy git fetch origin main
rtk proxy git worktree list
rtk proxy node --version
rtk proxy npm ci --ignore-scripts
rtk proxy npm run qualify:ultimate-environment
rtk proxy node docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/tools/validate-plan.mjs
rtk proxy npm run provenance:check
rtk proxy npm run brand:check
rtk proxy npm run typecheck
rtk proxy npm run lint
rtk proxy npm run format:check
rtk proxy npm test
rtk proxy npm run build
```

Node must satisfy `package.json` (>=24.11.0). Retrieve already-authorized repository LFS assets only if needed; do not download a model/browser or alternate media stack. Native builds require an owned `CARGO_TARGET_DIR`. TesterArmy uses its own lockfile under `e2e/testerarmy`. Preserve missing/corrupt DLL/LFS and insufficient-disk failures instead of calling setup ready.

Focused examples, selected by changed boundary rather than run indiscriminately:

```powershell
rtk proxy node --test tests/director-durability.test.ts tests/director-stages.test.ts
rtk proxy node --test tests/preview.test.ts tests/preview-parity.test.ts
rtk proxy node --test tests/otio.test.ts tests/creative-recovery.test.ts
rtk proxy npm run test:e2e
rtk proxy npm run test:e2e:studio
rtk proxy npm run qualify:preview
rtk proxy npm run qualify:w18-loudnorm
rtk proxy npm run qualify:av-sync
rtk proxy npm run benchmark:ultimate
```

PStack supplies spec/review/close discipline; use deterministic Graft for affected call paths. Local D1 may advise bounded triage but cannot approve correctness/security/release. Alibaba OCR may run local rules/preview only unless an authorized local backend is verified; do not invoke cloud review. TesterArmy/browser execution is required for changed UX and forced recovery workflows, not for merely writing research. Missing review capacity blocks merge; it does not become a D1 substitute.

## Evidence, acceptance and normal merge

For each task: reproduce a real gap or record ALREADY_SATISFIED with exact evidence; implement one bounded correction if needed; run meaningful success/negative/security/media tests; retain all failed attempts/skips; record source/runtime/fixture/policy hashes and measured results. Do not label a referenced historical test as rerun. Keep private raw source, machine paths, tokens and customer footage out of public evidence.

Obtain fresh independent correctness and security review appropriate to the boundary. Resolve must-fix findings, rerun affected checks and obtain delta review. Require exact-head CI, merge normally pinned to that qualified head, then verify post-merge main and update the task/continuation receipt. CI green alone cannot close research, reviewer or external gates. For a security rollback, disable the affected operation or retain an equivalent reviewed guard before reverting.

Resource policy v3 and qualification policy v1 are frozen. M remains unqualified. Preserve 480-second M limit, current worker/process/queue/memory/disk bounds and required run counts. Models/providers OFF; no weights/training, paid inference, credits, resource expansion, installers or release. Native Arabic H1, administrator/clean-profile/second-account/disk/signing/CSP/presence and founder ship decision remain external. These do not prevent model-free engineering after handoff, but they prevent the corresponding qualification/release claims.

## Durable continuation

Update [12](12_EXECUTION_AND_CONTINUATION_LEDGER.md) and each task receipt after a substantial wave. Record completed work, immutable head, exact checks/reviews, failed attempts, remaining blockers and the next eligible card. If an execution limit occurs, checkpoint and stop truthfully; no background activity claim without a running process. Planning is qualified; use [20](20_FINAL_PLANNING_CHECKPOINT.md) for the held founder-to-Opus transition. No further research cycle is required.
