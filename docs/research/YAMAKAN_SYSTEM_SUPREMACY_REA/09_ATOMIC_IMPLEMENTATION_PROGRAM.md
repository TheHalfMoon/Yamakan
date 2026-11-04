# Atomic implementation program

This is the schedule for the [full plan](README.md). The [task registry](TASK_REGISTRY.json) is authoritative for task fields; this index is derived from it. Preserve SS-001–005 identities. SS-004/005 are outcome aggregates with explicit child slices; new work uses fresh IDs.

## Contract inherited by every task

Each registry card specifies objective, priority, state, dependencies, existing target files/directories, source decision, positive acceptance, negative cases, rollback and legacy YU mapping. Directory targets mean inspect that boundary and list exact changed files in the PR before implementation; they do not authorize broad refactoring. Mark new files as proposed. Complete donor function/dependency/pin qualification under [03](03_SOURCE_QUALIFICATION.md) before any transplant.

1. Verify live main, active ownership, flags, receipts and call sites. Reproduce the gap; close as ALREADY_SATISFIED with evidence if no gap remains.
2. Compare candidates and record COPY, ADAPT, WRAP, COMBINE, BUILD, DEFER or REJECT. Satisfy research dependencies before implementation.
3. Pin scope and define interface/schema changes, compatibility, policy and fixtures. Default: no new schema or authority. An additive migration requires a backup/read/restore contract first.
4. Implement one coherent improvement with meaningful positive/negative tests. Use real media, browser interaction and failure seams where required. Preserve notices and working behavior.
5. Record base/code/donor/runtime/fixture hashes, commands, all actual outcomes including failures/skips, measurements and findings under `docs/evidence/ultimate/`.
6. Obtain fresh independent correctness/security review appropriate to the boundary; fix findings, rerun affected gates, obtain delta review and exact-head CI, merge normally at the qualified head, then verify main and update state.
7. Apply the rollback without resetting others' branches, destroying original data, dropping notices or enabling gated features.

Research cards require source/coverage validation and independent review, not unnecessary production media suites. Externally blocked cards permit preparing concrete evidence, not the gated action.

Security-fix rollback must not reopen a known bypass. Before reverting SS-001/003 or any other security fix, disable the affected operation or retain an independently reviewed equivalent guard; verify denial cases again. A code-only revert is subject to this rule.

## State, ownership and sizing

VERIFIED requires acceptance, review, exact-head merge and post-main evidence. During the planning hold only research/review may execute. After founder handoff, QUALIFICATION_READY can start when its dependencies and all global research gates pass. WAITING_DEPENDENCIES needs prerequisite receipts. REVIEW_PENDING cannot merge. EXTERNAL_BLOCKED needs named authority/capability. AGGREGATE is not a PR.

An experiment may end REJECTED or DEFERRED with evidence. That satisfies an investigation dependency only if the dependent task handles that outcome; it never satisfies a required product PASS. SS-005 may close investigation with M still unqualified; SS-018/019 must report that blocker.

One builder claims each task in its PR; fresh reviewers own review. Disjoint research can proceed in parallel; serialize media workloads. If a card exceeds one coherent PR, append bounded child cards and interface dependencies before implementation. No calendar promise precedes discovery.

## Dependency index

Every non-research implementation card also requires all five global research gates and founder handoff. The dependency list below is not permission to bypass that hold.

| ID      | Priority | State                | Depends on                                                              | Scope                                                                                        |
| ------- | -------- | -------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| SS-001  | P0       | VERIFIED             | —                                                                       | Revalidate Director approval atomically                                                      |
| SS-002  | P5       | VERIFIED             | —                                                                       | Verify the production-selected media runtime before probes                                   |
| SS-003  | P0       | VERIFIED             | SS-001                                                                  | Invalidate stale downstream approvals                                                        |
| SS-004  | P2       | AGGREGATE            | SS-004a, SS-004b                                                        | Qualify the complete model-free creative journey                                             |
| SS-004a | P2       | VERIFIED             | SS-003                                                                  | Land the real-media command journey                                                          |
| SS-004b | P2       | WAITING_DEPENDENCIES | SS-004a, SS-006, SS-008                                                 | Complete browser review, crossfade and forced recovery journey                               |
| SS-005  | P1       | AGGREGATE            | SS-005a, SS-005b                                                        | Resolve M export under frozen resource policy                                                |
| SS-005a | P1       | VERIFIED             | SS-002, R-03                                                            | Profile M and select a bounded hypothesis                                                    |
| SS-005b | P1       | QUALIFICATION_READY  | SS-005a, R-03                                                           | Implement one measured renderer improvement                                                  |
| R-01    | P3       | VERIFIED             | —                                                                       | Complete professional editor capability coverage                                             |
| R-02    | P2       | VERIFIED             | —                                                                       | Complete generative and agent-native workflow coverage                                       |
| R-03    | P1       | VERIFIED             | —                                                                       | Qualify media, editor and interchange source candidates                                      |
| R-04    | P2       | VERIFIED             | —                                                                       | Qualify accessible harness and developer sources                                             |
| R-05    | P0       | VERIFIED             | R-01, R-02, R-03, R-04                                                  | Independently finalize architecture from completed source research and retained measurements |
| SS-006  | P2       | QUALIFICATION_READY  | SS-003, R-02, R-04                                                      | Expose and qualify existing revision-bound take proposals in Director review                 |
| SS-007  | P2       | WAITING_DEPENDENCIES | SS-006                                                                  | Unify request, progress and handoff semantics                                                |
| SS-008  | P0       | WAITING_DEPENDENCIES | SS-007                                                                  | Prove cancellation and recovery across creative attempts                                     |
| SS-009  | P1       | QUALIFICATION_READY  | R-03, SS-002                                                            | Qualify preview cache and audio-clock behavior                                               |
| SS-010  | P1       | WAITING_DEPENDENCIES | SS-009                                                                  | Qualify long-session and large-timeline stability                                            |
| SS-011  | P4       | WAITING_DEPENDENCIES | R-01, SS-006                                                            | Expose safe take comparison and replacement in the editor                                    |
| SS-012  | P3       | QUALIFICATION_READY  | R-01, R-03                                                              | Qualify measured loudness and coherent existing audio controls                               |
| SS-013  | P3       | QUALIFICATION_READY  | R-01                                                                    | Qualify exact cue timing and bilingual keyboard editing                                      |
| SS-014  | P3       | QUALIFICATION_READY  | R-01, R-03                                                              | Qualify keyboard/pointer trim, snap and crossfade equivalence                                |
| SS-015  | P0       | QUALIFICATION_READY  | R-03                                                                    | Qualify portable project and honest interchange loss                                         |
| SS-016  | P6       | WAITING_DEPENDENCIES | SS-004b, SS-011                                                         | Measure selective revision as a product advantage                                            |
| SS-017  | P5       | QUALIFICATION_READY  | SS-002                                                                  | Make setup, impact checks and evidence reproducible                                          |
| SS-018  | P0       | WAITING_DEPENDENCIES | SS-004b, SS-005, SS-010, SS-011, SS-012, SS-013, SS-014, SS-015, SS-017 | Consolidate affected Windows qualification                                                   |
| SS-019  | P0       | WAITING_DEPENDENCIES | SS-018, SS-016, R-05                                                    | Publish the final engineering frontier and release evidence packet                           |
| X-01    | P4       | EXTERNAL_BLOCKED     | —                                                                       | Complete native Arabic and human usability qualification                                     |
| X-02    | P0       | EXTERNAL_BLOCKED     | —                                                                       | Complete external release/profile/signing decisions                                          |
| X-03    | P6       | EXTERNAL_BLOCKED     | —                                                                       | Qualify real models and comparative A/V quality only after authorization                     |

## Complete task contracts

Verified baseline prerequisites and source records are machine-readable in the registry. A prerequisite source read is not a passing runtime test.

### SS-001 — Revalidate Director approval atomically

Objective: Revalidate Director approval atomically

Targets: `core/director/runtime.ts`, `core/director/stages.ts`. Owner: Completed; Opus preserves verified behavior.

Source: ADAPT existing pinned OpenMontage prerequisite translation; retained source record 01.

Interfaces: approveStage(requestId, runVersion, outputHash) inside ProjectStore transaction; no signature change.

Sequence:

1. Read merged PR153 receipt and current shared prerequisite guard.
2. Preserve unchanged-output renewal and historical idempotent response semantics.
3. Only reopen on a new failing regression; do not implement the same fix twice.

Acceptance: Approval checks prerequisites and reviewable output inside its transaction; renewal/replay controls pass.

Negative/security: Expired predecessor, unfinished attempt and missing output refuse without mutation.

Performance: Bounded manifest scan only; no media/subprocess work.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Code-only revert preserving history.

Definition of Done: Approval checks prerequisites and reviewable output inside its transaction; renewal/replay controls pass. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Preserve merged result; no duplicate implementation.

### SS-002 — Verify the production-selected media runtime before probes

Objective: Verify the production-selected media runtime before probes

Targets: `scripts/media-runtime-preflight.mjs`, `scripts/qualify-ultimate-environment.mjs`. Owner: Completed; Opus preserves verified behavior.

Source: WRAP production resolver and repository trust manifests.

Interfaces: Production mediaTools resolver -> EXE/DLL trust manifest -> bounded probe result.

Sequence:

1. Read PR154 receipt and resolver selection rules.
2. Verify selected binary and companion closure before diagnostic execution.
3. Preserve installed/renamed EXE behavior and explicit missing-LFS refusal.

Acceptance: Selected EXEs and companion DLLs verified; installed layout/renamed EXEs supported; bounded probes.

Negative/security: Missing/corrupt DLL or LFS pointer blocks before execution.

Performance: Keep existing probe deadline/output limits; no runtime download.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert diagnostic scripts; no runtime/resource changes.

Definition of Done: Selected EXEs and companion DLLs verified; installed layout/renamed EXEs supported; bounded probes. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Preserve merged result; no duplicate implementation.

### SS-003 — Invalidate stale downstream approvals

Objective: Invalidate stale downstream approvals

Targets: `core/director/runtime.ts`, `tests/director-durability.test.ts`. Owner: Completed; Opus preserves verified behavior.

Source: ADAPT Kinewright exact-base principle; keep append-only Yamakan attempts.

Interfaces: advanceStage output replacement -> append-only downstream invalidation; old attempts remain readable.

Sequence:

1. Read PR156 receipt and its stale-downstream regression.
2. Retain same-output renewal and unrelated-run controls.
3. Only extend lineage if a distinct acceptance case fails.

Acceptance: Replacing upstream output invalidates dependent results; unrelated runs and same-output renewal preserved.

Negative/security: Replay cannot revive invalidated work; unknown legacy pipelines stay readable.

Performance: Bounded pipeline/attempt metadata processing, no re-render on read.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Code-only revert with retained audit and regression fixture.

Definition of Done: Replacing upstream output invalidates dependent results; unrelated runs and same-output renewal preserved. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Preserve merged result; no duplicate implementation.

### SS-004 — Qualify the complete model-free creative journey

Objective: Qualify the complete model-free creative journey

Targets: `core/director`, `src/director`, `e2e/testerarmy`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE canonical commands and real UI; acceptance is union of children.

Interfaces: Aggregate receipt references SS-004a and SS-004b exact merged heads and fixture identities.

Sequence:

1. Verify both child outcomes against the same supported journey.
2. Record command coverage separately from browser/crossfade/hard-interruption coverage.
3. Close aggregate only when both children pass; otherwise retain specific blockers.

Acceptance: Both child receipts verified; brief-to-three-shot-export-to-selective-revision-to-forced-recovery complete.

Negative/security: No model execution, graceful-close-only or transform-only substitute for required crossfade/crash.

Performance: Use child measured results; no invented aggregate score.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert journey-specific changes; preserve previous receipts.

Definition of Done: Both child receipts verified; brief-to-three-shot-export-to-selective-revision-to-forced-recovery complete. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-004a — Land the real-media command journey

Objective: Land the real-media command journey

Targets: `tests`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE existing commands; tests-only PR #157 already implemented.

Interfaces: Existing three-shot command fixture and real H.264/AAC outputs in separate PR157.

Sequence:

1. After founder handoff, inspect PR157 exact diff/head and current main for conflicts.
2. Obtain fresh correctness/security review of test assumptions and media assertions.
3. Rerun only affected gates after any fix, exact-head CI, normal separate merge and post-main verification.

Acceptance: Real H.264/AAC three-shot exports; 12 sampled frames, captions/audio/transform, one-shot change, undo/redo, graceful reopen/replay.

Negative/security: Stale CAS and agent approval denied; unaffected frames preserved; retain first failed ROI assertion.

Performance: Existing fixture/limits; preserve first failed ROI assertion and subsequent repair evidence.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert new test/evidence only.

Definition of Done: Real H.264/AAC three-shot exports; 12 sampled frames, captions/audio/transform, one-shot change, undo/redo, graceful reopen/replay. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-004b — Complete browser review, crossfade and forced recovery journey

Objective: Complete browser review, crossfade and forced recovery journey

Targets: `e2e/testerarmy`, `scripts/browser-e2e.mjs`, `src/director`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE existing crossfade, story/take and recovery contracts; no new renderer.

Interfaces: Browser registry adapter -> Director review/take apply -> preview/export -> existing recovery flow.

Sequence:

1. Reuse PR157 media fixture and current browser harness in an owned root.
2. Drive brief, references, three shots, crossfade, captions, sound and human review through visible controls.
3. Export and decode before/after only the middle-shot replacement; verify unaffected regions.
4. Interrupt the owned service/worker at a recorded pre-publication seam; restart and inspect attempts/history.
5. Verify stale/cancel/two-writer refusals and export again without duplicate mutation.

Acceptance: Execute all ten steps of 08 with actual UI approval/revise; export before/after middle-shot change; force owned-service interruption; reopen current state/history and export.

Negative/security: Two writers, revoked input, old request replay, cancel-before-publication, wrong-project selection; no orphan worker or duplicate mutation.

Performance: Existing 720 p playback/reference policy and resource ceilings; record wall times, frames, audio onset and owned-process cleanup.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert bounded UI/test delta; preserve canonical data and earlier command receipt.

Definition of Done: Execute all ten steps of 08 with actual UI approval/revise; export before/after middle-shot change; force owned-service interruption; reopen current state/history and export. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-005 — Resolve M export under frozen resource policy

Objective: Resolve M export under frozen resource policy

Targets: `core/render.ts`, `core/render`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: Profiling and a single qualified optimization; children define closure.

Interfaces: Aggregate investigation verdict distinguishes candidate rejected, M still unqualified, and actual M PASS.

Sequence:

1. Collect SS005a profile and SS005b accepted or rejected experiment.
2. Compare all baseline/candidate runs at identical policy/fixture/host.
3. Record investigation closed separately from product qualification; propagate NO-GO to SS018/019.

Acceptance: Candidate either consistently qualifies M or records a defensible unresolved blocker; never label rejected experiment as M PASS.

Negative/security: No raised time/memory/concurrency ceiling or easier fixture.

Performance: M PASS requires every required candidate run within480s; historical2/5 is not PASS.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Restore reference renderer; retain failure evidence.

Definition of Done: Candidate either consistently qualifies M or records a defensible unresolved blocker; never label rejected experiment as M PASS. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-005a — Profile M and select a bounded hypothesis

Objective: Profile M and select a bounded hypothesis

Targets: `core/render.ts`, `core/render/plan.ts`, `core/render/segments.ts`, `scripts/benchmark-ultimate.ts`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: Compare current FFmpeg graph and R-03 candidate concepts; BUILD only measurement instrumentation if existing harness insufficient.

Interfaces: Benchmark records: source/head, runtime hash, fixture hash, policy, stage timings, wall time, process-tree peak and outcome.

Sequence:

1. Verify trusted runtime and reserve the single media slot.
2. Reproduce frozen M baseline and retain failures/timeouts with host load context.
3. Instrument current compile/decode/scale/overlay/encode/segment boundaries without changing behavior.
4. Measure at least three unchanged baseline attempts, retaining failures/timeouts and instrumentation overhead; use these profiles to assess the bounded redundant-decode/scale hypothesis in 16 without implementing it.
5. Emit one exact graph-change hypothesis with costs and guards, or reject the experiment if no safe win is supported.

Acceptance: Pin policy/fixture/host; retain at least three baseline attempts including failures/timeouts; attribute decode/scale/overlay/encode and process-tree resources; select one bounded hypothesis or reject all. Candidate implementation and paired comparison belong to SS-005b.

Negative/security: Alpha/transform/LUT/animation/segment seam controls; retain timeout, load and failed-run data.

Performance: No deadline/thread/memory/concurrency increase; fixture unchanged; diagnostic overhead measured separately.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Remove diagnostic instrumentation; never modify production limits.

Definition of Done: Pin policy/fixture/host; retain at least three baseline attempts including failures/timeouts; attribute decode/scale/overlay/encode and process-tree resources; select one bounded hypothesis or reject all. Candidate implementation and paired comparison belong to SS-005b. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-005b — Implement one measured renderer improvement

Objective: Implement one measured renderer improvement

Targets: `core/render.ts`, `core/render/plan.ts`, `core/render/segments.ts`, `tests`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: Choose COPY/ADAPT/WRAP/COMBINE/BUILD only from SS-005a and qualified R-03 record; no preselected speculative algorithm.

Interfaces: Same RenderPlan input and validated artifact output; renderer/cache version changes together if pixels or recipe identity change.

Sequence:

1. Require SS005a baseline profiles and reference fixtures; if it rejects all hypotheses, record REJECTED with M NO-GO and close this investigation without implementing a candidate.
2. Implement only the supported graph change; retain reference path and conservative fallback.
3. Refuse optimization for uncertain alpha, transform, animation, transition or segment/loudness semantics.
4. Run decoded visual/audio equivalence and at least three interleaved baseline/candidate pairs under identical policy/fixture/host; retain every failed attempt. Complete the qualification policy repetitions separately before claiming M PASS.
5. Land only a demonstrated bounded improvement; otherwise revert candidate and publish REJECTED with M NO-GO.

Acceptance: Decoded output and audio equivalence across 10 matrix; all required M candidate runs within 480 s and existing ceilings to claim qualification; otherwise record no-go.

Negative/security: Translucency, partial coverage, animated transforms, rational/VFR timing, cancellation and resource pressure. Run a segment-seam control across real culled windows; identity fixtures use different content per layer and production LUTs.

Performance: Use all required repeated M runs <=480 s and frozen ceilings for M qualification; no best-run selection.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert algorithm/version together; preserve reference path/cache-version separation.

Definition of Done: Decoded output and audio equivalence across 10 matrix; all required M candidate runs within 480 s and existing ceilings to claim qualification; otherwise record no-go. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### R-01 — Complete professional editor capability coverage

Objective: Complete professional editor capability coverage

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`. Owner: Astro research; independent reviewers own verdict.

Source: Inspect primary sources for every professional system in 02; compare current Yamakan before proposing additions.

Interfaces: Dated product evidence -> observed/unknown capability -> current Yamakan boundary -> task/test decision.

Sequence:

1. Validate all 15 professional product rows in 14 against primary documents.
2. Keep hands-on/runtime UNKNOWN where not executed; distinguish proxy, reference render, backup and interchange.
3. Map useful workflow changes to existing code and16/18 decisions.
4. Resolve independent review findings before recording VERIFIED.

Acceptance: Each named product has dated evidence across required professional dimensions; map worthwhile gaps to donors, target paths, tests and keep/defer/reject decisions.

Negative/security: Unsupported, inaccessible and non-tested claims stay UNKNOWN/BLOCKED; no paid access or private upload.

Performance: No competitor performance estimate from manuals; no paid/runtime access required for bounded decisions.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Withdraw unsupported conclusions with correction history; no product mutation.

Definition of Done: All required cohort names/decisions have source evidence or an explicit bounded UNKNOWN/DEFER/REJECT. No unsupported runtime, license, performance or private-source claim. Fresh independent review resolves must-fix findings; planning validation/exact-head CI/normal merge/post-main receipt recorded.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Planning-only research and review permitted.

### R-02 — Complete generative and agent-native workflow coverage

Objective: Complete generative and agent-native workflow coverage

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`. Owner: Astro research; independent reviewers own verdict.

Source: Document platform mechanics separately from model quality; inspect public agent code where available.

Interfaces: All 16 generative groups and11 agent-native systems; twenty dimensions with explicit unknowns.

Sequence:

1. Validate15 product/source rows and immutable agent source pins.
2. Separate model quality from editing/project/revision/recovery contracts.
3. Preserve inaccessible Kling and closed-backend limits; no invented pricing or provider run.
4. Resolve independent review findings and task mappings before VERIFIED.

Acceptance: Every named generative and agent-native product in 02 has coverage; twenty workflow dimensions addressed; proposals, revision and recovery opportunities compared.

Negative/security: No closed-backend donor claims, fabricated pricing, competitor execution or generated output.

Performance: No generation, paid tools or model benchmark; documented limits are not measured Yamakan targets.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Correct evidence rows and retain limitations; no model/provider enablement.

Definition of Done: All required cohort names/decisions have source evidence or an explicit bounded UNKNOWN/DEFER/REJECT. No unsupported runtime, license, performance or private-source claim. Fresh independent review resolves must-fix findings; planning validation/exact-head CI/normal merge/post-main receipt recorded.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Planning-only research and review permitted.

### R-03 — Qualify media, editor and interchange source candidates

Objective: Qualify media, editor and interchange source candidates

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`, `docs/provenance`. Owner: Astro research; independent reviewers own verdict.

Source: Compare all media/professional source targets in 02; inspect chosen functions and full relevant dependency/license closure.

Interfaces: Pinned source/function/dependency/rights -> selected current boundary or explicit DEFER/REJECT.

Sequence:

1. Validate16 sources and production-version distinction against local pinned specimens.
2. Check exact functions, current imported notices and all 16 subsystem records.
3. Confirm selected tasks need no new donor runtime; record unqualified closure as rejected/deferred.
4. Independently review resources, acceptance and rollback; no production import in research.

Acceptance: For each selected opportunity complete all 20 source fields and 12 REA conditions from 03; exact pins, call graph, tests, platform/resource costs and maintenance decision.

Negative/security: README-only or metadata-only candidate cannot be implementation-qualified; incompatible/unknown rights block import.

Performance: Retain M/preview policy and runtime hashes; no unmeasured speedup or decoder parity claim.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: No code imported by research; replace rejected candidate records without deleting evidence.

Definition of Done: All required cohort names/decisions have source evidence or an explicit bounded UNKNOWN/DEFER/REJECT. No unsupported runtime, license, performance or private-source claim. Fresh independent review resolves must-fix findings; planning validation/exact-head CI/normal merge/post-main receipt recorded.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Planning-only research and review permitted.

### R-04 — Qualify accessible harness and developer sources

Objective: Qualify accessible harness and developer sources

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`. Owner: Astro research; independent reviewers own verdict.

Source: Inspect Orcel/Wepld/Skilit/Flind/Gomrey, Temporal/Vercel and additional accessible candidates narrowly; reject duplicate stores/schedulers absent measured need.

Interfaces: Paginated accessible inventory -> metadata screening -> selective code/license/test inspection -> privacy-safe decision.

Sequence:

1. Record58 accessible repositories and authentication scope, plus truncated private-tree limit.
2. Validate17 public source pins/functions and private no-transfer decisions.
3. Reject second project/job/memory authority; retain tests for identity, uncertain work and ownership.
4. Resolve independent review and privacy checks; private archive stays ignored and local.

Acceptance: Paginated inventory scope and failures recorded; chosen functions/dependencies/license/authority/recovery mapped to current commands/jobs; safe public summaries only.

Negative/security: Truncated tree is not exhaustive; private license ambiguity and unapproved source transfer block copying.

Performance: No remote inference, donor execution, clone of huge trees or new service; only bounded source retrieval.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Keep private captures local; remove unsupported public conclusions without altering donor repos.

Definition of Done: All required cohort names/decisions have source evidence or an explicit bounded UNKNOWN/DEFER/REJECT. No unsupported runtime, license, performance or private-source claim. Fresh independent review resolves must-fix findings; planning validation/exact-head CI/normal merge/post-main receipt recorded.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Planning-only research and review permitted.

### R-05 — Independently finalize architecture from completed source research and retained measurements

Objective: Independently finalize architecture from completed source research and retained measurements

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/19_FINAL_ARCHITECTURE_ASSESSMENT.md`, `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/SUBSYSTEM_DECISIONS.json`. Owner: Astro research; independent reviewers own verdict.

Source: Compare A preserve, B narrow replacements, C bounded workers, D evidence-discovered alternative.

Interfaces: Independent architecture verdict on immutable research head,16 decisions and current baseline code.

Sequence:

1. Require R01–04 evidence reviewed for the bounded claims.
2. Compare A–D using19 and actual canonical/take/Director/render/job interfaces.
3. Challenge preservation as well as replacement; record concrete must-fix findings and resolutions.
4. Confirm future M profiling is an implementation gate, not a pre-planning execution prerequisite.
5. Obtain independent architecture/correctness/security verdicts before final plan merge.

Acceptance: Score correctness/performance/recovery/reuse/maintenance/cohesion/agents/Windows/offline/security/complexity/cost/migration; fresh independent architecture review; ADR only for actual changed decision.

Negative/security: No unsupported superiority, whole-app transplant or irreversible migration without separate authority.

Performance: No new performance promise; retained measurements constrain choices; new profiling belongs to Opus.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Retain existing architecture if no alternative wins on measured criteria.

Definition of Done: All required cohort names/decisions have source evidence or an explicit bounded UNKNOWN/DEFER/REJECT. No unsupported runtime, license, performance or private-source claim. Fresh independent review resolves must-fix findings; planning validation/exact-head CI/normal merge/post-main receipt recorded.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Planning-only research and review permitted.

### SS-006 — Expose and qualify existing revision-bound take proposals in Director review

Objective: Expose and qualify existing revision-bound take proposals in Director review

Targets: `core/takes.ts`, `core/command/registry.ts`, `core/director`, `src/director/DirectorPanel.tsx`, `tests`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: WRAP existing TakeProposalSchema/proposeReplace/take.apply CAS; ADAPT exact-base/conflict tests; preserve scoped agent project:write and human-only Director approval.

Interfaces: Reuse TakeProposalSchema v1: projectId, revision, documentId/storyHash, shotId/takeId, exact mapping and proposalHash. The review artifact is a derived UI view of the exact TakeProposalSchema payload, not a Director stage output or approval token. Keep proposalHash separate from managed media outputHash; existing take.apply project:write authorization and human-only Director media approval remain unchanged.

Sequence:

1. Read existing proposeReplace/take.apply CAS and tests; preserve single-clip-shot limitation.
2. Present affected clip, old/new media, timing and observed revision through current Director UI.
3. Bind the review panel and apply action to the exact existing proposal payload; refresh on project/story/input change. Do not persist a proposal approval, pass proposalHash to advanceStage/approveStage, widen assertManagedOutput, or create another proposal store.
4. Recompute/read current proposal before apply; on stale input show refusal and require fresh review.
5. Test successful unchanged apply, changed payload/revision/story/consent, interleaved writer undo and agent Director approval refusal.

Acceptance: Show exact affected clip/media/timing and proposalHash in a derived Director review panel; submit that unchanged TakeProposalSchema payload to existing take.apply with recomputation/CAS/media/continuity checks. The panel creates no durable approval or stage output. Unchanged proposal succeeds, stale proposal requires fresh review, unrelated writer changes survive undo; no second proposal store or blanket human-only mutation rule.

Negative/security: Stale base, missing asset, revoked consent, agent self-approval, changed payload, wrong project and interrupted apply; successful unchanged control. A proposalHash supplied as stage output stays rejected; viewing a proposal confers no approval or new scope.

Performance: Bounded metadata/thumbnail work only; compareTakes cap8; no original-media decode in review UI.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Disable new proposal writes/UI; keep existing commands/history readable; add migration rollback only if a schema change proves necessary.

Definition of Done: Show exact affected clip/media/timing and proposalHash in a derived Director review panel; submit that unchanged TakeProposalSchema payload to existing take.apply with recomputation/CAS/media/continuity checks. The panel creates no durable approval or stage output. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-007 — Unify request, progress and handoff semantics

Objective: Unify request, progress and handoff semantics

Targets: `core/director`, `core/jobs`, `sdk`, `cli`, `mcp`, `src/director`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: ADAPT qualified Remocn/OpenEdit lifecycle concepts to existing attempts; typed transport adapters only.

Interfaces: Versioned read-only progress view: project/run/request/attempt IDs, committed state, current revision and cursor. Versioned bounded handoff document: project/revision, brief/story/reference hashes, latest attempt/evidence and next action; no grants or secrets.

Sequence:

1. Inventory current SDK/CLI/MCP/browser request/error/progress fields and preserve old responses.
2. Derive one typed read view from committed attempts/jobs, with project authorization on every read.
3. Map adapters to that view; reconnect reads a fresh snapshot and deduplicates by committed identity.
4. Add handoff document through existing document storage, validating references and budgets on resume.
5. Test lost response, duplicate/out-of-order notification, cross-project read, oversized MCP input and redaction.

Acceptance: SDK/CLI/MCP/browser agree on stable request IDs/errors/progress; reconnect resumes committed state; handoff references brief/revision/evidence without granting authority.

Negative/security: Lost response, duplicate/out-of-order event, old replay, cross-project subscription, oversized MCP frame, secret/path logging.

Performance: No unbounded subscriptions/history/context; existing transport/document budgets and queue limits apply.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert presentation/adapter delta; leave durable receipts intact and old clients compatible.

Definition of Done: SDK/CLI/MCP/browser agree on stable request IDs/errors/progress; reconnect resumes committed state; handoff references brief/revision/evidence without granting authority. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-008 — Prove cancellation and recovery across creative attempts

Objective: Prove cancellation and recovery across creative attempts

Targets: `core/director`, `core/jobs`, `core/process`, `tests`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: ADAPT Temporal cancellation and OpenEdit uncertain-result test concepts; preserve existing leases, epochs and restore hold.

Interfaces: Cancellation request -> owned worker stopped -> terminal job/attempt state; lease/epoch check before publication.

Sequence:

1. List existing cancel/cleanup/recovery seams and document allowed state transitions.
2. Use controlled fixture hooks to stop only owned processes before/after worker completion and commit.
3. Restart through current recovery protocol and inspect leases, epochs, staged files and committed artifacts.
4. Fix only demonstrated publication/cleanup gaps in shared boundary.
5. Verify uncertain side effect is held for reconciliation and stale worker cannot publish.

Acceptance: Cancel before/during/after worker completion; kill owned service at commit seams; restart/reconcile; no partial artifact or orphan; stale worker cannot commit; bounded cleanup.

Negative/security: Cancel/complete race, lease expiry, restore, lost response and uncertain side effect; no automatic repeat of irreversible action.

Performance: Existing cancel/cleanup deadlines and process limits; capture actual elapsed cleanup and orphan count0.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert narrow runtime changes, preserve failure receipts; use existing recovery flow for affected roots.

Definition of Done: Cancel before/during/after worker completion; kill owned service at commit seams; restart/reconcile; no partial artifact or orphan; stale worker cannot commit; bounded cleanup. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-009 — Qualify preview cache and audio-clock behavior

Objective: Qualify preview cache and audio-clock behavior

Targets: `core/render/preview.ts`, `src/preview`, `src/reference.tsx`, `src/proxies.ts`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: WRAP current reference preview/cache and pinned browser packages; ADAPT ownership/eviction/cancellation tests. No new decoder or package upgrade.

Interfaces: Existing preview(projectId,revision,kind,startFrame,frames,signal) and Preview identity; unchanged reference contract.

Sequence:

1. Freeze current plan/cache/engine key and browser ownership behavior.
2. Add fixtures changing asset, revision, font, LUT/profile and renderer identity one at a time.
3. Exercise shared waiters, final-waiter cancel, reverse/random seeks and stale response after project switch.
4. Close/dispose decoded buffers deterministically; fix only a demonstrated leak/invalidation error.
5. Measure policy cold/warm/segment latency and playback; retain unsupported codec fallback.

Acceptance: Cold/warm seek policy, rational-frame parity, A/V clock and cache invalidation across asset/revision/font/LUT/profile changes; bounded frame/buffer lifetime.

Negative/security: Out-of-order response, reverse/random seek, cache pressure, missing proxy, closed frame and unsupported browser fallback.

Performance: Qualification v1 warm<=1000ms,cold<=3000ms,segment<=6000ms at required counts;720 p>=24fps; frozen cache bytes.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Keep reference preview available; invalidate new cache version without deleting sources.

Definition of Done: Cold/warm seek policy, rational-frame parity, A/V clock and cache invalidation across asset/revision/font/LUT/profile changes; bounded frame/buffer lifetime. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-010 — Qualify long-session and large-timeline stability

Objective: Qualify long-session and large-timeline stability

Targets: `src/editor`, `src/preview`, `core/render/preview.ts`, `tests`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE existing S/M/T and repeatable browser workloads; optimize only an observed leak/algorithmic cost.

Interfaces: Repeatable long-session workload and bounded memory/cache observations keyed to exact project/host.

Sequence:

1. Run60-minute owned-session workload: repeat10-minute seek/edit/reopen/project-switch cycle6times on frozen S/M/T fixtures.
2. Sample process-tree/browser memory and cache occupancy every minute; retain all errors.
3. Verify sources/revisions/history after each cycle and final reopen.
4. Fix only observed retained-resource or algorithmic cost; compare identical pre/post runs.
5. Report distributions and no sustained unbounded growth; fail on resource cap or correctness breach.

Acceptance: Record long-session seek/edit/reopen distributions and memory/cache plateau at frozen sizes; same project remains responsive and correct after pressure.

Negative/security: Project switching, removed/relinked media, background job completion and stale buffers; all failures retained.

Performance: Diagnostic plateau criterion: final3 cycles peak-memory linear slope<=1MiB/min after warmup, within existing caps; this is proposed soak acceptance, not a relaxed policy or measured result.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert specific buffer/cache/view change; retain soak fixture and original data.

Definition of Done: Record long-session seek/edit/reopen distributions and memory/cache plateau at frozen sizes; same project remains responsive and correct after pressure. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-011 — Expose safe take comparison and replacement in the editor

Objective: Expose safe take comparison and replacement in the editor

Targets: `core/takes.ts`, `src/editor`, `src/workspaces/ProjectShell.tsx`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: WRAP verified YU-032 take commands; borrow interaction principles only after product study.

Interfaces: listTakes/compareTakes/proposeReplace/take.apply via current registry; no new take schema.

Sequence:

1. Expose existing take list and bounded comparison in editor selected-shot context.
2. Show old/new identity, timing, affected clip and precise refusal reason before apply.
3. Use SS006 exact proposal and current canonical undo/redo.
4. Exercise keyboard/pointer, project switch and two-writer edits.
5. Decode unaffected shot controls and verify source objects unchanged after replace/revert/reopen.

Acceptance: Compare takes, review affected region, replace/revert with keyboard and pointer, preserve unrelated clips and selected project across views.

Negative/security: Stale selection, incompatible timing, locked track, revoked take and two writers; no silent ripple.

Performance: Cap comparison8; use indexed thumbnails/proxies, no original decode or unbounded take preload.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Remove new UI entry; canonical takes and old commands remain readable.

Definition of Done: Compare takes, review affected region, replace/revert with keyboard and pointer, preserve unrelated clips and selected project across views. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-012 — Qualify measured loudness and coherent existing audio controls

Objective: Qualify measured loudness and coherent existing audio controls

Targets: `core/audio`, `src/audio`, `core/render.ts`, `src/editor`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: WRAP current W18 loudnorm/gain/fade/unlink/peaks and atempo/soundtouch; DEFER new DSP.

Interfaces: Current LoudnormSpec target/measured values and canonical gain/fade/mute/solo/unlink controls.

Sequence:

1. Read existing W18/Q6/audio-flow receipts and current control state; do not recreate normalization.
2. Expose or verify measured-versus-unmeasured loudness state and clear refusal for unavailable stats.
3. Qualify two-pass output with current W18 loudness and A/V sync scripts.
4. Test silence, nonfinite stats, repeated normalize, delayed audio, mute/solo/fades, cancellation and undo/reopen.
5. Repair only observed state/reporting or decoded-output defect; preserve source sound.

Acceptance: Measured/unmeasured loudness state is truthful; current W18 and A/V sync fixtures pass; mute/solo/fade/unlink/undo/reopen retain correct audio and originals.

Negative/security: Clipping, silence, delayed audio, cancelled export, repeated normalize and undo/reopen; reject unsupported bus/DSP claims.

Performance: Existing W18 tolerance/targets and AV-sync policy; record actual values, not linear-mode request alone.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert chosen UI/operation delta; keep original sound refs and stored values compatible.

Definition of Done: Measured/unmeasured loudness state is truthful; current W18 and A/V sync fixtures pass; mute/solo/fade/unlink/undo/reopen retain correct audio and originals. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-013 — Qualify exact cue timing and bilingual keyboard editing

Objective: Qualify exact cue timing and bilingual keyboard editing

Targets: `core/captions.ts`, `src/captions.tsx`, `core/render/ass.ts`, `src/i18n.ts`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: WRAP current imported caption contract; compare documented professional cue-edit workflows.

Interfaces: CaptionDocument validation, splitCue/exportCaptions/burnedInCaptions and current cue-edit commands.

Sequence:

1. Reuse current caption import/edit/export; enumerate exact frame/tick cue boundary fixtures.
2. Verify keyboard timing/text edit and focus across Arabic/Latin/mixed-script cues.
3. Fix only demonstrated controls/escaping/timing defects, retaining original document.
4. Decode exported cue start/end and verify undo/reopen; prepare native H1 packet.
5. Keep native Arabic judgment blocked until X01 reviewer evidence exists.

Acceptance: Precise cue timing and keyboard editing, readable mixed-script controls, export boundaries/undo/reopen; prepare exact H1 evidence.

Negative/security: Malformed imported cue, overlap, ASS injection, long text, bidi/focus issues and rational fps edge.

Performance: No new subtitle engine; bounded cue/string limits; reference timing and existing typography policy.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert new controls/conversion delta; preserve original caption document and reference rendering.

Definition of Done: Precise cue timing and keyboard editing, readable mixed-script controls, export boundaries/undo/reopen; prepare exact H1 evidence. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-014 — Qualify keyboard/pointer trim, snap and crossfade equivalence

Objective: Qualify keyboard/pointer trim, snap and crossfade equivalence

Targets: `core/timeline`, `core/transitions.ts`, `core/effects`, `core/animation`, `src/editor`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: ADAPT existing OpenCut Classic integer-time helpers; WRAP existing timeline/transition operations; no new effect engine.

Interfaces: Existing integer-tick snapping/trim and TransitionSchema crossfade; same command operations for keyboard and drag.

Sequence:

1. Record equivalent keyboard and pointer trim/snap/crossfade edit sequences on identical project copies.
2. Compare exact canonical resulting ticks/IDs and reference frames at boundaries.
3. Exercise locked tracks, zero length, overlaps, VFR and concurrent revisions.
4. Fix only demonstrated adapter/control discrepancy; preserve existing pure algorithms/notices.
5. Verify undo/redo/reopen and preview/export parity.

Acceptance: Equivalent keyboard and pointer trim/snap/crossfade sequences produce identical canonical ticks/IDs and matching reference frames; undo/reopen preserves result.

Negative/security: Locked tracks, overlaps, VFR, zero-length spans, crossfade boundary, unsupported effect and concurrent edit.

Performance: Frozen preview/render limits; no new effect set, GPU backend or track-count policy.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert bounded operation/UI; retain compatible reads and previous renderer.

Definition of Done: Equivalent keyboard and pointer trim/snap/crossfade sequences produce identical canonical ticks/IDs and matching reference frames; undo/reopen preserves result. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-015 — Qualify portable project and honest interchange loss

Objective: Qualify portable project and honest interchange loss

Targets: `core/interchange/otio.ts`, `core/recovery.ts`, `core/relink.ts`, `core/storage`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: WRAP existing OTIO JSON proposal mapping and backup/creativeClosure/restore; add deterministic loss report, no new archive parser.

Interfaces: Existing OtioProposal plus additive export loss report; existing backup manifest/creativeClosure and restore-to-new-root.

Sequence:

1. Enumerate supported OTIO subset and title/effect/transition/overlap/rate losses from current adapter.
2. Return/display a deterministic loss report before conversion; preserve existing JSON schema compatibility.
3. Qualify backup closure includes original/variant/story/take/reference/caption/font dependencies used by the project.
4. Restore into a separate owned root and compare hashes/timing/references; never modify original on failure.
5. Test malformed/deep/oversized JSON, inert URLs, path/reparse/case hazards and corrupt/missing objects.

Acceptance: Supported roundtrip preserves rational timing/refs; explicit unsupported-effect loss report before conversion; portable media manifest hashes; interrupted import leaves original intact.

Negative/security: Traversal, absolute/UNC paths, symlink/junction, bomb/size limits, duplicate/case-colliding names, corrupt/missing assets and unsupported versions.

Performance: Existing16MiB/50000-object/depth32 OTIO limits and backup disk reserve; no new archive extractor.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Disable new archive/interchange write path; restore into new root, never destructive downgrade.

Definition of Done: Supported roundtrip preserves rational timing/refs; explicit unsupported-effect loss report before conversion; portable media manifest hashes; interrupted import leaves original intact. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-016 — Measure selective revision as a product advantage

Objective: Measure selective revision as a product advantage

Targets: `scripts/benchmark-ultimate.ts`, `docs/evidence/ultimate`, `e2e/testerarmy`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE existing benchmark recorder and complete creative journey; no generative or paid competitor execution.

Interfaces: Benchmark record extends existing recorder with reused artifacts, unaffected hashes, user actions and paired outcomes.

Sequence:

1. Freeze three-shot full rebuild and middle-shot-only revision procedures from verified journey.
2. Run at least3 paired trials with stated cache conditions, same host/runtime/fixture and idle media slot.
3. Compare wall/process resources, operations/user actions, reused work and decoded unaffected regions.
4. Change timing/reference/consent in negative controls to require real invalidation.
5. Publish benefit, no-benefit or blocked result without competitor/model superiority claim.

Acceptance: Matched full rebuild versus selected-shot revision: work reused, unaffected hashes, elapsed/resources, user actions and failures; useful benefit or explicit no-benefit result.

Negative/security: Changed timing/reference/consent must invalidate real dependents; no cache-hit-only or single-best-run comparison.

Performance: Report medians/distributions and all failures; no single best run or warm-vs-cold bias.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Retain measurements; withdraw unsupported advantage claim; no runtime rollback needed unless a bounded defect fix is added separately.

Definition of Done: Matched full rebuild versus selected-shot revision: work reused, unaffected hashes, elapsed/resources, user actions and failures; useful benefit or explicit no-benefit result. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-017 — Make setup, impact checks and evidence reproducible

Objective: Make setup, impact checks and evidence reproducible

Targets: `scripts/ultimate-environment.mjs`, `scripts/qualify-ultimate-environment.mjs`, `docs`, `e2e/testerarmy`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: Reuse current lockfiles/preflight/Graft/testing tools; new infrastructure only for observed setup/test friction.

Interfaces: Existing environment/preflight JSON plus owned-root diagnostic receipt and documented command sequence.

Sequence:

1. Create/claim isolated checkout and verify dependency/native/temp paths are not shared write targets.
2. Follow07 setup using pinned lockfiles and existing trusted runtime without optional downloads.
3. Run environment diagnostics with missing dependency/DLL/LFS/disk fixtures.
4. Use deterministic Graft impact and local OCR preview; record unavailable tools/reviewers explicitly.
5. Improve only observed setup/evidence friction; capture exact commands/output and clean-checkout success or blocker.

Acceptance: New owned checkout follows 07; diagnose missing dependencies/native runtime without downloads; preserve graph/test selection rationale, bounded logs and exact-head evidence.

Negative/security: Shared node_modules/native target, insufficient disk, stale manifest and unavailable reviewer/backend do not yield ready/PASS.

Performance: Bounded diagnostics/logs and current disk reserve; no model/browser/native runtime auto-download.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Revert diagnostics/docs/tool wrappers; do not clean shared paths or remove historical evidence.

Definition of Done: New owned checkout follows 07; diagnose missing dependencies/native runtime without downloads; preserve graph/test selection rationale, bounded logs and exact-head evidence. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-018 — Consolidate affected Windows qualification

Objective: Consolidate affected Windows qualification

Targets: `scripts/qualify-release.ts`, `scripts/qualify-release-evidence.ts`, `docs/evidence/ultimate`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE existing deterministic, media, browser and recovery gates; scoped evidence refresh rather than rewriting qualification.

Interfaces: Current qualification evidence schema keyed by source/artifact/runtime/fixture/policy and explicit blockers.

Sequence:

1. Collect verified child receipts and current main flags.
2. Choose affected deterministic/media/browser/recovery/security suites; serialize heavy work.
3. Run supported Windows checks on owned roots and preserve skips/failures.
4. Obtain fresh independent review, exact-head CI and post-main verification.
5. Report M or external failures without promoting release; do not rerun unchanged suites without reason.

Acceptance: Artifact-bound current flags/recipes/runtime; affected unit/integration/browser/security/resource/backup/restore checks; explicit unresolved M/host/external limits; fresh reviews and post-main verification.

Negative/security: Stale/wrong-head receipt, platform skip, transient rerun or failed external gate cannot become blanket PASS.

Performance: All existing frozen policy thresholds; M unresolved remains explicit NO-GO.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Leave previous qualified behavior and receipts intact; regressions block promotion.

Definition of Done: Artifact-bound current flags/recipes/runtime; affected unit/integration/browser/security/resource/backup/restore checks; explicit unresolved M/host/external limits; fresh reviews and post-main verification. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### SS-019 — Publish the final engineering frontier and release evidence packet

Objective: Publish the final engineering frontier and release evidence packet

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`, `docs/RELEASE_PROPOSAL.md`, `specs/CURRENT.md`. Owner: Claude Opus after founder handoff; one named builder per task PR.

Source: COMBINE exact receipts, source decisions and gate matrix; documents only, no release action.

Interfaces: Final engineering packet links exact main, task outcomes, gates, donor notices and unresolved external owners.

Sequence:

1. Reconcile all 31 states and44 legacy tasks against exact merged receipts.
2. Collect18 final-report dimensions and current security/resource/product limits.
3. Prepare concrete human/release gate evidence without packaging/publishing.
4. Review all claims against source/fixture/artifact hashes and independent verdicts.
5. Publish current frontier and continuation ledger with no implied ship approval.

Acceptance: All eighteen final-report dimensions addressed; each task VERIFIED/REJECTED/DEFERRED/BLOCKED with evidence; current main and product limits explicit; human gate packet concrete.

Negative/security: No false exhaustive REA, competitor superiority, signed build, model qualification or release approval.

Performance: Report measurements only; no new performance or quality target.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Correct documentation with retained audit; no packaging/publishing side effects.

Definition of Done: All eighteen final-report dimensions addressed; each task VERIFIED/REJECTED/DEFERRED/BLOCKED with evidence; current main and product limits explicit; human gate packet concrete. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: None beyond global planning/implementation authority and task dependency receipts.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### X-01 — Complete native Arabic and human usability qualification

Objective: Complete native Arabic and human usability qualification

Targets: `docs/evidence/qualification`, `src/i18n.ts`. Owner: External gate owner; Opus prepares evidence only.

Source: Qualified native human review of exact candidate; automated RTL checks are supporting evidence.

Interfaces: Native human review packet: reviewer identity/language, exact artifact, tasks, findings and acceptance.

Sequence:

1. Prepare existing H1 packet and real bilingual workflows.
2. Wait for qualified native human reviewer; no automated substitute.
3. Record findings against exact artifact; implement any defect only as a bounded authorized follow-up.
4. Repeat affected human checks after fixes before closing H1.

Acceptance: H1 and YU-093 reviewer identity/artifact/task results; confirmed defects become bounded engineering cards.

Negative/security: Screenshot-only or automated layout pass cannot stand in for native language judgment.

Performance: Human task results; automated layout/screenshot metrics are supporting evidence only.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Keep unqualified typography/feature activation gated.

Definition of Done: H1 and YU-093 reviewer identity/artifact/task results; confirmed defects become bounded engineering cards. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: Qualified native Arabic human reviewer and exact-artifact H1 evidence.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### X-02 — Complete external release/profile/signing decisions

Objective: Complete external release/profile/signing decisions

Targets: `docs/RELEASE_PROPOSAL.md`, `docs/evidence/qualification`. Owner: External gate owner; Opus prepares evidence only.

Source: Issue #77 owners; H2/H3/H4 administrator, H5 founder, separate signing/CSP/native-presence review.

Interfaces: Issue77 external gate receipts H2/H3/H4/H5 plus applicable signing/CSP/native-presence evidence.

Sequence:

1. Prepare exact candidate evidence and named owner requirements.
2. Wait for administrator/founder authority and qualified clean/offline/second-account/disk conditions.
3. Run only specifically authorized gate actions on owned artifacts.
4. Keep release blocked until all applicable gates and explicit ship decision pass.

Acceptance: Exact candidate, clean offline Profile A, second-account isolation, controlled disk-full, applicable signing/CSP/presence and explicit ship decision before any release.

Negative/security: Dev profile, unsigned artifact or plan readiness never closes these gates.

Performance: Frozen policy; developer-profile measurements cannot qualify clean ProfileA.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: Keep public release NO-GO; revert activation if a qualified gate later regresses.

Definition of Done: Exact candidate, clean offline Profile A, second-account isolation, controlled disk-full, applicable signing/CSP/presence and explicit ship decision before any release. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: Issue77 administrator/clean-profile/second-account/disk/signing/CSP/presence and founder ship authority.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.

### X-03 — Qualify real models and comparative A/V quality only after authorization

Objective: Qualify real models and comparative A/V quality only after authorization

Targets: `core/engines`, `docs/evidence/ultimate`. Owner: External gate owner; Opus prepares evidence only.

Source: Existing adapters/manifests/stand-ins retained; weights/license/compute/provider and cost authority remain separate.

Interfaces: Disabled engine manifest/adapter; future protocol must pin model/weights/license/host/cost/output limits.

Sequence:

1. Keep current stand-ins and refusal paths only.
2. Wait for explicit model/provider/compute/cost/resource authority and rights.
3. Append a separately reviewed model-specific protocol before any download/run.
4. Only after authorization qualify output/resources; no source-license shortcut.

Acceptance: Explicit authorization precedes download/execution; then append model-specific pinned task/quality/resource protocol and independent review.

Negative/security: Source license or no-model stand-in is not weight/runtime quality approval; no paid inference/GPU.

Performance: No model benchmark or weight download in current program authority.

Compatibility: Preserve canonical project format, original media, old receipts and per-writer history. Keep current command scopes and human-only Director approval; no new store/scheduler/runtime. Use exact pinned donor/runtime dependencies; add no import without provenance/license closure.

Rollback: All unqualified engines/providers remain disabled; no model run scheduled now.

Definition of Done: Explicit authorization precedes download/execution; then append model-specific pinned task/quality/resource protocol and independent review. All relevant negative tests have real results; failures/skips/unknowns retained. Exact source/runtime/fixture/policy receipt, fresh independent required review, exact-head CI and post-main verification; no implementation during planning hold.

External requirements: Separate founder model/provider/weight/compute/cost/resource authority and applicable rights.

Execution gate: Global planning gates and founder handoff must pass before Opus executes; dependencies must have acceptable exact receipts.
