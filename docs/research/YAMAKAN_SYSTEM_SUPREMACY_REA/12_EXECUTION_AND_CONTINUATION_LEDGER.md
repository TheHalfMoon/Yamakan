# Execution checkpoint and continuation

Updated 2026-10-29, Asia/Riyadh. This ledger combines requested deliverables 12 and 13. The whole competitive/system program remains incomplete. Continue authorized engineering; this is not a new approval request.

## Verified frontier

Latest verified main: `79fc86fe1cc215cf091135c114822ea3e35c9e72`. [Post-merge CI 40860328200](https://github.com/TheHalfMoon/Yamakan/actions/runs/40860328200) completed SUCCESS. Public release remains **NO-GO**, models/providers remain gated, issue #77 external gates remain open. Research drafts #85 and #86 were not modified.

| Work | Exact code and disposition | Verification |
| --- | --- | --- |
| Existing still-chain render optimization | [PR #152](https://github.com/TheHalfMoon/Yamakan/pull/152), head `4d810e0b2726da67c865ead5892f440ed30d5f89`, merged main `ad5b12bc94f1236a52c43a76e51d6827acb23df8` | Fresh correctness and security/resource reviews; 2 real still-render checks at 30 and 24000/1001 fps; exact-head CI; post-main CI 40700797962 SUCCESS. M remains unqualified. |
| SS-001 atomic approval revalidation | [PR #153](https://github.com/TheHalfMoon/Yamakan/pull/153), head `b87f3720781ba691e16b5cba23733a91599e9c9e`, merged main `79fc86f` | Two regression cases RED before fix. 18 Director tests GREEN. Windows full suite 724 total: 721 pass, 0 fail, 3 skip. Typecheck, lint, formatting, provenance 404 records, brand, build, real Edge and TesterArmy journeys passed. Fresh combined and security reviews: no must-fix. Exact-head CI 40766733323 SUCCESS. Post-main Director durability 12/12 and stages 6/6; post-main CI SUCCESS. |
| SS-002 selected media runtime preflight | [PR #154](https://github.com/TheHalfMoon/Yamakan/pull/154), head `f4e70f5143726bbf3bf5d29e59e5bb8975623ac7`, draft pending CI | Focused 32/32; typecheck, lint, provenance, brand and changed formatting pass. Fresh combined/security reviews: no must-fix; optional symlink fixture suggested. Real pointer checkout blocked without probes; hydrated selection verified 24 files without executing binaries. No full environment qualification claim. |
| SS-003 downstream approval lineage | Implementation in progress on `fix/director-dependency-invalidation`, based on SS-001 | Five new scenarios: initial 4 failures plus renewal control pass; current targeted 5/5 green. Broader regression, independent reviews, CI and merge not yet complete. |

## What changed and what has not been demonstrated

**Architecture/harness:** SS-001 rechecks predecessors and reviewable output inside the existing approval transaction. No new database, scheduler or schema. Independent review exposed the separate downstream lineage gap; SS-003 is addressing it with append-only attempt interpretation. Source concepts came from OpenMontage's prerequisite boundary and Kinewright's exact-base identity.

**Developer setup:** restored lockfile-pinned dependencies into owned directories after an external shared dependency path disappeared; install scripts disabled. SS-002 aligns preflight with production media selection and verifies companion DLLs, avoiding the observed false-ready state. Version probes are bounded. An initial failed qualifier and a failed missing-dependency build are retained as failures, not silently replaced with pass claims.

**Media:** #152 is delivered. Retained historical dense-probe results were 66.133 s to 9.187 s median across three pairs, with peak memory 421 MiB to 351–354 MiB. This session did not rerun those benchmarks. The M fixture completed 0/3 baseline and 2/5 optimized under a 480 s limit: still unqualified. No new limits, concurrency or resource-policy changes.

**UX:** no new UX implementation in SS-001/002. Existing Edge interaction verified import/edit/export, Arabic layout, session isolation, revision recovery and zero external page requests. TesterArmy verified Studio save/conflict, forced service crash/reopen and backup restoration, including independent workspace inspection. Native Arabic approval is still external. The integrated three-shot targeted-revision journey remains SS-004.

**Research:** source inspected Kinewright, OpenFilm, VEED OpenEdit, Remocn, OpenMontage, selected Orcel policy code, LosslessCut keyframe/boundary logic and Temporal cancellation/determinism. Additional metadata inventories include MLT, OTIO, Motion Canvas, Vercel Workflow, Mediabunny, OpenCut, Gomrey and Skilit. Account discovery returned 51 accessible repository metadata entries; private source transplant qualification remains incomplete. No competitor runtime or matched competitor benchmark was executed. See the source matrix for exact pins, scope and deferred decisions.

**Security/provenance:** SS-001 fixes an approval-boundary defect, keeps human-only authority and updates existing donor hashes. SS-002 trusts repository manifests rather than selected-directory metadata. No private source, credentials or donor runtime grants were published. Approval lineage remains the next security/correctness task; same-account executable replacement is outside the preflight threat claim. Release/worker sandbox assurance is not inferred from diagnostic hashes.

## Tool execution, limitations and local receipts

RTK, PStack workflows, fresh independent review agents, Git/GitHub CLI, Node tests, real Microsoft Edge, TesterArmy, deterministic Graft and a local D1 advisory were used. GitHub plugin calls failed with missing link_id; authenticated CLI supplied the verified frontier. Graft parsed 690 files; no generative graph pass. D1 answered one advisory after an earlier request-format failure; never a gate. Alibaba OCR preview ran, but full cloud-configured review did not run. No paid inference, model execution, weight download or public release.

Local log paths are relative to the isolated engineering checkout and not committed raw captures. SHA-256 binds the saved results:

| Log | SHA-256 |
| --- | --- |
| `work/unit-full.log` | `c8e189b1602bab11e9924e4bbae7f1246671d8e3ab94d54a9dbf1224f64c3d6c` |
| `work/build-ss001.log` | `9eed3f5a64edd0acc93572d23ad6c8e64b4ee74b3db2c1749b28886b7e87817d` |
| `work/e2e-ss001.log` | `07547583186f9dcde6a41cc673f352e0ea1fcfdc23b59e3d0cfdd8a76122e245` |
| `work/testerarmy-ss001.log` | `7a45b7488d9d5faeea5d96e63f2aca935b34ec79bf3748a771eda092d9996c85` |
| `work/ss001-postmerge.log` (12 durability tests) | `bf15c7321900237e9cc967cc6fc477c4a04f9f20d9482a338022641e5bfda305` |

The separate post-main stage test command passed 6/6. Historical failed environment capture is `work/environment-failed-before-lfs-repair.json`; raw logs may contain local paths and stay local. C: filled during initial setup; task metadata and temporary files moved to owned D: paths. No unrelated user files were deleted. A shared native target was used only for unchanged source; do not rebuild it concurrently.

## Exact continuation order

1. Re-read live main and PR #154 exact head/checks. Complete its normal pinned-head merge only after all checks pass; verify post-merge CI and focused tests. Do not confuse SS-001 browser results with SS-002 head results.
2. Finish SS-003 in its isolated branch. Check legacy epoch-0 snapshot ordering, renewal/replay, restart, stale approval rejection, early in-progress descendants and unrelated runs. Preserve immutable attempts. Run fresh combined and security review, required gates, exact-head CI, normal merge and post-main verification.
3. Commit the separate research checkpoint and review it for accuracy, private-data boundaries and current dispositions. Keep #85/#86 unchanged. This checkpoint is explicitly incomplete.
4. Execute SS-004's model-free three-shot journey through existing commands, actual preview/export and restart; use failures to prioritize small product fixes. Investigate professional editor/generative platform primary sources in parallel with independent non-media work; retain evidence labels.
5. Profile SS-005 under frozen policy only with an idle media test slot. Do not extrapolate the still optimization to transparent/animated workloads or claim M qualified from one successful run. Fix the nonblocking yuva420p memory comment separately when touching that code.

External blockers: native Arabic review, human/security/profile/signing gates in #77, paid/provider/model activation and public release. None blocks the independent source research, deterministic journey tests or bounded correctness work above.
