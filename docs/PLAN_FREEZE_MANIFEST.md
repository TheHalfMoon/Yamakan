# Plan freeze manifest

The frozen state of the Yamakan implementation plan. **Implementation has not started.** It begins only on the founder's written start authorization ([START_HERE_WHEN_READY.md](START_HERE_WHEN_READY.md)).

## Frozen references

| Item                                               | Value                                                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freeze date                                        | 2026-10-18                                                                                                                                                                                         |
| Main at the freeze                                 | `6e471088a56b6bdda4fef29c747167827958a224` (PR #28 merged)                                                                                                                                         |
| Planning PR                                        | [TheHalfMoon/Yamakan#30](https://github.com/TheHalfMoon/Yamakan/pull/30), branch `docs/rea-source-reuse`, not merged                                                                               |
| **Plan content commit**                            | `ce744b771ee870128e39662d19eb76834a4cb6ce`                                                                                                                                                         |
| Open PRs at the freeze (other sessions, untouched) | #29 `6b56bfa59390d52a9efd308a57a9f226d9a9fe6f` (containment), #24 `33ceb5380d2a801a32d3ed46f362c5b9411c60ed` (mid-render kill), #19 `ce047bb53596a6189ca401094a4b41a42303b48f` (test temp cleanup) |
| Release verdict                                    | NO-GO                                                                                                                                                                                              |

The plan content commit is the commit that holds the frozen documents below. This manifest was added in the commit after it, so it cannot name its own commit. The PR's final head contains both.

**Proposed tag:** `plan-freeze-2026-10-18` on the plan content commit. It is created only after the founder approves the plan. Until then, the commit SHA is the immutable reference.

## Check the frozen documents

From the repository root, either of these must report no difference:

```bash
git diff --exit-code ce744b771ee870128e39662d19eb76834a4cb6ce -- docs/IMPLEMENTATION_PLAN.md docs/START_HERE_WHEN_READY.md docs/FUTURE_CLAUDE_EXECUTION_PROMPT.md docs/FOUNDER_DECISION_RECORD.md docs/AGENT_DECISION_RECORD.md docs/research/rea-source-reuse/01_EXECUTIVE_RECOMMENDATION.md docs/research/rea-source-reuse/02_REA_DEEP_INVESTIGATIONS.md docs/research/rea-source-reuse/03_SOURCE_RANKING.md docs/research/rea-source-reuse/04_EXACT_SOURCE_IMPORT_BLUEPRINT.md docs/research/rea-source-reuse/05_ARCHITECTURE_ALTERNATIVES.md docs/research/rea-source-reuse/06_FINAL_ARCHITECTURE.md docs/research/rea-source-reuse/07_OPTIMIZED_MASTER_PLAN.md docs/research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md docs/research/rea-source-reuse/09_REUSE_AND_EFFORT_ESTIMATES.md docs/research/rea-source-reuse/10_BENCHMARKS_AND_E2E.md docs/research/rea-source-reuse/11_SOURCE_PROVENANCE_AND_BRANDING.md docs/research/rea-source-reuse/12_MASTER_PLAN_CHANGESET.md docs/research/rea-source-reuse/13_FIRST_IMPLEMENTATION_WAVE.md docs/evidence/rea/source-reuse-2026-10-18/artcraft-scene-engine.json docs/evidence/rea/source-reuse-2026-10-18/invokeai-canvas-engine.json docs/evidence/rea/source-reuse-2026-10-18/mediabunny-src.json docs/evidence/rea/source-reuse-2026-10-18/opencut-subsystems.json docs/evidence/rea/source-reuse-2026-10-18/python-and-license-inspection.json
```

```bash
sha256sum -c <<'EOF'
03ebb81e81de74ab57c5a8ef3de004eeaa71e49819184ba638731e56d9bd2ba6  docs/IMPLEMENTATION_PLAN.md
74198e1d37135846ffe42e6563f157895b67f11318a9787f74c276c43ef0252f  docs/START_HERE_WHEN_READY.md
360698ea5b3f2f03fe00b49e00509ab3befbfe809dd763a32563e1b5c2f2932d  docs/FUTURE_CLAUDE_EXECUTION_PROMPT.md
c78f37b7189cde40cc4879a12cc5bf4db2b5d3bcfb860096a5eab5a2e88eac55  docs/FOUNDER_DECISION_RECORD.md
41f6a2e3ac9212a184e6ed91b4bacc7943d28a7eade60c4cb7a35627035a7f1a  docs/AGENT_DECISION_RECORD.md
2c431d60d4a632d4b728dd51d8af995675fbd8e8a0437e19555c07b238da1f41  docs/research/rea-source-reuse/01_EXECUTIVE_RECOMMENDATION.md
ec66ae62495bebdac31e771f5f816755cff371c16807de26cce04d91b760932b  docs/research/rea-source-reuse/02_REA_DEEP_INVESTIGATIONS.md
d0fe8c35e04df2d5e6009e29d09b928f3e6ff833420638e6d9a1075f006acaba  docs/research/rea-source-reuse/03_SOURCE_RANKING.md
ad5e5f546bfdbeed2838af88cdc99339a42abc9f6f1b2526459e0c1beaad1265  docs/research/rea-source-reuse/04_EXACT_SOURCE_IMPORT_BLUEPRINT.md
d63ef2c3655d3a29610505808bd8dd7801183afd1a644f41d7e94a0e9cd3929b  docs/research/rea-source-reuse/05_ARCHITECTURE_ALTERNATIVES.md
a878229a4caeb2875977aedfeb7debb2752a8226ead5b6a7ebaeb6e65d188043  docs/research/rea-source-reuse/06_FINAL_ARCHITECTURE.md
cf224f9b8833bb78ab36e697d9ecc9331ab93a6e5d59432dabea5c4c6a15de10  docs/research/rea-source-reuse/07_OPTIMIZED_MASTER_PLAN.md
b3373c93d917d2bffbea30e69a968ac09cb51c0413d1e81a081e98dc83c58311  docs/research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md
94460629489d31cf534fdd6306951f51cfa38571bb66ddbb72bf3327ec3dc550  docs/research/rea-source-reuse/09_REUSE_AND_EFFORT_ESTIMATES.md
bffacfce0bacb7058401a8e8208a3ee2763708ad244cc6f9037175b3565a50dc  docs/research/rea-source-reuse/10_BENCHMARKS_AND_E2E.md
7c2191ba3ab18cbcb2aa657ed38f6a3dc0e59a73045089b57a01c763675dd6ce  docs/research/rea-source-reuse/11_SOURCE_PROVENANCE_AND_BRANDING.md
0b1a498824dcfbeaa79fd2192a425fc026cb1a2a2804298f54568d02bcef8562  docs/research/rea-source-reuse/12_MASTER_PLAN_CHANGESET.md
94ca39e0ffd2595ac755cf186c599a256b95f1edd41d80af101fef5c087e4a90  docs/research/rea-source-reuse/13_FIRST_IMPLEMENTATION_WAVE.md
16751b583b9a538be93cb9d8a1771596dbfe22e03d17a877228ee648b16ea017  docs/evidence/rea/source-reuse-2026-10-18/artcraft-scene-engine.json
f72b7260fbac5f6ceb7d6d51aa453bf2a6b41f9013fdcb7e33c13d3a7d124e17  docs/evidence/rea/source-reuse-2026-10-18/invokeai-canvas-engine.json
57c8e83a43d5c2c561d9c24eca936b0ec2ac2f5b3735247c071f1678cba8e612  docs/evidence/rea/source-reuse-2026-10-18/mediabunny-src.json
d803e5cd9cac684e9f9731adc7c795e20cbbb82fa0cffb63c0d00df6078b453d  docs/evidence/rea/source-reuse-2026-10-18/opencut-subsystems.json
bb7c0df3c809e2244b5a8d5baaa16fdfe7b7315f7f4283a559f073f45068587d  docs/evidence/rea/source-reuse-2026-10-18/python-and-license-inspection.json
EOF
```

The SHA-256 values are of the files as committed, with LF line endings. On a checkout with `core.autocrlf=true`, use the `git diff` check instead.

## Source pins

Every pin is also in [SOURCE_CATALOG.md](SOURCE_CATALOG.md). Exact files per module are in [04](research/rea-source-reuse/04_EXACT_SOURCE_IMPORT_BLUEPRINT.md).

| Source                                   | Commit or version                                       | Licence                                       | Used for                              |
| ---------------------------------------- | ------------------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| OpenCut-app/opencut-classic              | `cf5e79e919144200294fb9fed22a222592a0aeea`              | MIT                                           | M3–M6 (and existing snapping/overlap) |
| invoke-ai/InvokeAI                       | `ffe9e1a98b19640388d72f88ae0ecadf1bee1717`              | Apache-2.0 + NOTICE                           | M7                                    |
| storytold/artcraft                       | `28a39a0de4a2fc2eccc237df2046c24245bd12ab`              | Apache-2.0 / MIT + NOTICE                     | M8–M10                                |
| mne03005-png/OpenVideoStudio             | `175da9960411fbe740932b0a08d57e32a4a36a18`              | Apache-2.0 + NOTICE                           | M11, M13 client shape                 |
| calesthio/OpenMontage                    | `9327439db69021ab4b0e2776729bf3b58fdb5a87`              | AGPL-3.0                                      | M12                                   |
| Comfy-Org/ComfyUI                        | `7f7fd918ed0815c5d5ef2ccfe44bfc8e72cfd217`              | GPL-3.0 (wrapped, not copied)                 | M13                                   |
| Vanilagy/mediabunny                      | `9d36fc5779b254904bc609e66f2cd80ed8390b4b (npm 1.61.3)` | MPL-2.0                                       | M14                                   |
| ThaUnknown/jassub                        | `dea3d2d398569a591cf0c767d945d84e9f120484 (npm 2.5.20)` | LGPL-2.1+ AND (FTL OR GPL-2.0+) AND MIT AND … | M15                                   |
| AcademySoftwareFoundation/OpenTimelineIO | `00c22fa3a64256d8d3dcafbc7276492185dd970d`              | Apache-2.0 (test oracle)                      | M16                                   |
| TheHalfMoon/Gomrey                       | `5f299a7a6174ad3a1180f827778db5f4400a4d71`              | Founder-owned                                 | M17                                   |
| TheHalfMoon/Ascout                       | `ca6b6f514e5a8881e2cfa2789b5e5ea43e3aaaad`              | Founder-owned                                 | M17                                   |
| LudwigKienle/ai-video-production-editor  | `752cd43d3af6421d2bd6d4ce27f2d9815f7acba3`              | GPL-3.0-or-later                              | Existing imports; W18 candidate       |
| soundtouchjs (npm)                       | `0.3.0`                                                 | LGPL-2.1                                      | M5 preview                            |

New npm dependencies (`mediabunny`, `jassub`, `soundtouchjs`, `ag-psd`, `perfect-freehand`, `three`, Vitest for `src/studio/**`) are pinned to exact versions with lockfile integrity in the PR that adds them. The donor's ranges (`ag-psd ^31.0.2`, `perfect-freehand ^1.2.3`) are resolved to exact versions then.

## Plan size

- **18 tasks:** W1–W7 in Track 1 (MVP) and W8–W18 in Track 2 (expansion).
- **17 modules:** M1–M17.
- **15 bounded qualification tests:** Q1–Q15 (Q7 is split into Q7a and Q7b).
- **First task:** W1.

## External gates (execution-time requirements, not planning blockers)

| Gate                                                                          | Needs                                                                                                                                                              | Blocks                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Founder start authorization                                                   | Written instruction, recorded in the founder decision record                                                                                                       | All implementation                               |
| PR #29, #24, #19 (other sessions)                                             | Merged; or, for #24 and #19, closed by their owner with the reason recorded and a follow-up task (see the M-gate). Containment (#29 or a successor) must be merged | W5 and the M-gate (#29); W2 (#24); W7 (#24, #19) |
| M-gate                                                                        | R1–R8 merged, `qualify:release` passes at main, no release-blocking defect                                                                                         | W8–W18                                           |
| H1 native Arabic review                                                       | Founder or a named reviewer                                                                                                                                        | Release; W12                                     |
| H2–H4 clean profile and packet capture, second account and restore, disk-full | Administrator                                                                                                                                                      | Release                                          |
| H5 ship decision                                                              | Founder, after an independent release review                                                                                                                       | Release                                          |
| E-SEC engine security gate                                                    | Authenticated channel, B4 for Python descendants, enforced network denial with capture, cross-account negative test                                                | Any real engine run                              |
| Founder decisions F (local AI hardware and weights) and G (paid providers)    | Founder                                                                                                                                                            | Real engines; paid routes                        |
| Disk space                                                                    | About 10 GiB free on D: at the freeze                                                                                                                              | W5 and media qualification may need space        |

## Assumptions (each is bounded)

1. **Q1–Q15** ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md#bounded-qualification-tests-q1q15)) are untested assumptions. Each has a pass condition and a binding fail decision, and none has been run.
2. **Estimates.** All effort, line and share figures in [09](research/rea-source-reuse/09_REUSE_AND_EFFORT_ESTIMATES.md) are estimates and are re-estimated after each task's first Q test.
3. **Benchmarks.** Proposed benchmark targets in [10](research/rea-source-reuse/10_BENCHMARKS_AND_E2E.md) become thresholds only when written into the qualification policy before their module lands.
4. **Source permission.** The founder's source-code permission is accepted as attested and is not independently verified. The confidential agreements were not provided and are not described. Every third-party primary selection is also eligible under its public licence alone. The founder-owned sources (Skelet, Ninerr, Gomrey, Ascout) rely on the founder's own authorization.
5. **Inspection limits.** Donor code was inspected statically (REA 6.3.0 for JavaScript, reading for Python). Nothing was built or run, and integration is a future qualification requirement.
6. **Reviews.** Independent documentation reviews checked internal consistency, pins, cited paths and line counts by sampling and grep. They do not prove runtime integration, and a closure is proven only when Q7a compiles it.
