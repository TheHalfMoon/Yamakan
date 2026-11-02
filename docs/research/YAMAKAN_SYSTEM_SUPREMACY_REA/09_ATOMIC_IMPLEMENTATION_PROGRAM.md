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

VERIFIED requires acceptance, review, exact-head merge and post-main evidence. RESEARCH_READY and QUALIFICATION_READY can start within scope. WAITING_DEPENDENCIES needs prerequisite receipts. REVIEW_PENDING cannot merge. EXTERNAL_BLOCKED needs named authority/capability. AGGREGATE is not a PR.

An experiment may end REJECTED or DEFERRED with evidence. That satisfies an investigation dependency only if the dependent task handles that outcome; it never satisfies a required product PASS. SS-005 may close investigation with M still unqualified; SS-018/019 must report that blocker.

One builder claims each task in its PR; fresh reviewers own review. Disjoint research can proceed in parallel; serialize media workloads. If a card exceeds one coherent PR, append bounded child cards and interface dependencies before implementation. No calendar promise precedes discovery.

## Dependency index

| ID | Priority | State | Depends on | Scope |
| --- | --- | --- | --- | --- |
| SS-001 | P0 | VERIFIED | — | Revalidate Director approval atomically |
| SS-002 | P5 | VERIFIED | — | Verify the production-selected media runtime before probes |
| SS-003 | P0 | VERIFIED | SS-001 | Invalidate stale downstream approvals |
| SS-004 | P2 | AGGREGATE | SS-004a, SS-004b | Qualify the complete model-free creative journey |
| SS-004a | P2 | REVIEW_PENDING | SS-003 | Land the real-media command journey |
| SS-004b | P2 | WAITING_DEPENDENCIES | SS-004a, SS-006, SS-008 | Complete browser review, crossfade and forced recovery journey |
| SS-005 | P1 | AGGREGATE | SS-005a, SS-005b | Resolve M export under frozen resource policy |
| SS-005a | P1 | QUALIFICATION_READY | SS-002 | Profile and compare M algorithm candidates |
| SS-005b | P1 | WAITING_DEPENDENCIES | SS-005a, R-03 | Implement one measured renderer improvement |
| R-01 | P3 | RESEARCH_READY | — | Complete professional editor capability coverage |
| R-02 | P2 | RESEARCH_READY | — | Complete generative and agent-native workflow coverage |
| R-03 | P1 | RESEARCH_READY | — | Qualify media, editor and interchange source candidates |
| R-04 | P2 | RESEARCH_READY | — | Qualify accessible harness and developer sources |
| R-05 | P0 | WAITING_DEPENDENCIES | R-01, R-02, R-03, R-04, SS-005a | Reassess architecture against completed research and measurements |
| SS-006 | P2 | WAITING_DEPENDENCIES | SS-003, R-04 | Qualify revision-bound reviewable creative proposals |
| SS-007 | P2 | WAITING_DEPENDENCIES | SS-006 | Unify request, progress and handoff semantics |
| SS-008 | P0 | WAITING_DEPENDENCIES | SS-007 | Prove cancellation and recovery across creative attempts |
| SS-009 | P1 | WAITING_DEPENDENCIES | R-03, SS-002 | Qualify preview cache and audio-clock behavior |
| SS-010 | P1 | WAITING_DEPENDENCIES | SS-009 | Qualify long-session and large-timeline stability |
| SS-011 | P4 | WAITING_DEPENDENCIES | R-01, SS-006 | Expose safe take comparison and replacement in the editor |
| SS-012 | P3 | WAITING_DEPENDENCIES | R-01, R-03 | Close one evidenced audio workflow gap |
| SS-013 | P3 | WAITING_DEPENDENCIES | R-01 | Close caption editing and bilingual interaction gaps |
| SS-014 | P3 | WAITING_DEPENDENCIES | R-01, R-03 | Close one precise timeline/effect interaction gap |
| SS-015 | P0 | WAITING_DEPENDENCIES | R-03 | Qualify portable project and honest interchange loss |
| SS-016 | P6 | WAITING_DEPENDENCIES | SS-004b, SS-011 | Measure selective revision as a product advantage |
| SS-017 | P5 | QUALIFICATION_READY | SS-002 | Make setup, impact checks and evidence reproducible |
| SS-018 | P0 | WAITING_DEPENDENCIES | SS-004b, SS-005, SS-010, SS-011, SS-012, SS-013, SS-014, SS-015, SS-017 | Consolidate affected Windows qualification |
| SS-019 | P0 | WAITING_DEPENDENCIES | SS-018, SS-016, R-05 | Publish the final engineering frontier and release evidence packet |
| X-01 | P4 | EXTERNAL_BLOCKED | — | Complete native Arabic and human usability qualification |
| X-02 | P0 | EXTERNAL_BLOCKED | — | Complete external release/profile/signing decisions |
| X-03 | P6 | EXTERNAL_BLOCKED | — | Qualify real models and comparative A/V quality only after authorization |

## Acceptance index

Complete source decisions and evidence are in the registry.

### SS-001 — Revalidate Director approval atomically

Targets: `core/director/runtime.ts`, `core/director/stages.ts`. Legacy coverage: YU-013.

Acceptance: Approval checks prerequisites and reviewable output inside its transaction; renewal/replay controls pass.

Negative cases: Expired predecessor, unfinished attempt and missing output refuse without mutation.

Rollback: Code-only revert preserving history.

### SS-002 — Verify the production-selected media runtime before probes

Targets: `scripts/media-runtime-preflight.mjs`, `scripts/qualify-ultimate-environment.mjs`. Legacy coverage: YU-001.

Acceptance: Selected EXEs and companion DLLs verified; installed layout/renamed EXEs supported; bounded probes.

Negative cases: Missing/corrupt DLL or LFS pointer blocks before execution.

Rollback: Revert diagnostic scripts; no runtime/resource changes.

### SS-003 — Invalidate stale downstream approvals

Targets: `core/director/runtime.ts`, `tests/director-durability.test.ts`. Legacy coverage: YU-013, YU-051.

Acceptance: Replacing upstream output invalidates dependent results; unrelated runs and same-output renewal preserved.

Negative cases: Replay cannot revive invalidated work; unknown legacy pipelines stay readable.

Rollback: Code-only revert with retained audit and regression fixture.

### SS-004 — Qualify the complete model-free creative journey

Targets: `core/director`, `src/director`, `e2e/testerarmy`. Legacy coverage: YU-061, YU-081.

Acceptance: Both child receipts verified; brief-to-three-shot-export-to-selective-revision-to-forced-recovery complete.

Negative cases: No model execution, graceful-close-only or transform-only substitute for required crossfade/crash.

Rollback: Revert journey-specific changes; preserve previous receipts.

### SS-004a — Land the real-media command journey

Targets: `tests`. Legacy coverage: YU-061.

Acceptance: Real H.264/AAC three-shot exports; 12 sampled frames, captions/audio/transform, one-shot change, undo/redo, graceful reopen/replay.

Negative cases: Stale CAS and agent approval denied; unaffected frames preserved; retain first failed ROI assertion.

Rollback: Revert new test/evidence only.

### SS-004b — Complete browser review, crossfade and forced recovery journey

Targets: `e2e/testerarmy`, `scripts/browser-e2e.mjs`, `src/director`. Legacy coverage: YU-061, YU-091.

Acceptance: Execute all ten steps of 08 with actual UI approval/revise; export before/after middle-shot change; force owned-service interruption; reopen current state/history and export.

Negative cases: Two writers, revoked input, old request replay, cancel-before-publication, wrong-project selection; no orphan worker or duplicate mutation.

Rollback: Revert bounded UI/test delta; preserve canonical data and earlier command receipt.

### SS-005 — Resolve M export under frozen resource policy

Targets: `core/render.ts`, `core/render`. Legacy coverage: YU-026.

Acceptance: Candidate either consistently qualifies M or records a defensible unresolved blocker; never label rejected experiment as M PASS.

Negative cases: No raised time/memory/concurrency ceiling or easier fixture.

Rollback: Restore reference renderer; retain failure evidence.

### SS-005a — Profile and compare M algorithm candidates

Targets: `core/render.ts`, `core/render/plan.ts`, `core/render/segments.ts`, `scripts/benchmark-ultimate.ts`. Legacy coverage: YU-026, YU-090.

Acceptance: Pin policy/fixture/host; attribute decode/scale/overlay/encode and process-tree resources; retain at least three matched pairs for a candidate experiment; choose one bounded change or reject all.

Negative cases: Alpha/transform/LUT/animation/segment seam controls; retain timeout, load and failed-run data.

Rollback: Remove diagnostic instrumentation; never modify production limits.

### SS-005b — Implement one measured renderer improvement

Targets: `core/render.ts`, `core/render/plan.ts`, `core/render/segments.ts`, `tests`. Legacy coverage: YU-026.

Acceptance: Decoded output and audio equivalence across 10 matrix; all required M candidate runs within 480 s and existing ceilings to claim qualification; otherwise record no-go.

Negative cases: Translucency, partial coverage, animated transforms, rational/VFR timing, cancellation and resource pressure.

Rollback: Revert algorithm/version together; preserve reference path/cache-version separation.

### R-01 — Complete professional editor capability coverage

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`.

Acceptance: Each named product has dated evidence across required professional dimensions; map worthwhile gaps to donors, target paths, tests and keep/defer/reject decisions.

Negative cases: Unsupported, inaccessible and non-tested claims stay UNKNOWN/BLOCKED; no paid access or private upload.

Rollback: Withdraw unsupported conclusions with correction history; no product mutation.

### R-02 — Complete generative and agent-native workflow coverage

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`.

Acceptance: Every named generative and agent-native product in 02 has coverage; twenty workflow dimensions addressed; proposals, revision and recovery opportunities compared.

Negative cases: No closed-backend donor claims, fabricated pricing, competitor execution or generated output.

Rollback: Correct evidence rows and retain limitations; no model/provider enablement.

### R-03 — Qualify media, editor and interchange source candidates

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`, `docs/provenance`.

Acceptance: For each selected opportunity complete all 20 source fields and 12 REA conditions from 03; exact pins, call graph, tests, platform/resource costs and maintenance decision.

Negative cases: README-only or metadata-only candidate cannot be implementation-qualified; incompatible/unknown rights block import.

Rollback: No code imported by research; replace rejected candidate records without deleting evidence.

### R-04 — Qualify accessible harness and developer sources

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`.

Acceptance: Paginated inventory scope and failures recorded; chosen functions/dependencies/license/authority/recovery mapped to current commands/jobs; safe public summaries only.

Negative cases: Truncated tree is not exhaustive; private license ambiguity and unapproved source transfer block copying.

Rollback: Keep private captures local; remove unsupported public conclusions without altering donor repos.

### R-05 — Reassess architecture against completed research and measurements

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/04_CURRENT_ARCHITECTURE_CHALLENGE.md`.

Acceptance: Score correctness/performance/recovery/reuse/maintenance/cohesion/agents/Windows/offline/security/complexity/cost/migration; fresh independent architecture review; ADR only for actual changed decision.

Negative cases: No unsupported superiority, whole-app transplant or irreversible migration without separate authority.

Rollback: Retain existing architecture if no alternative wins on measured criteria.

### SS-006 — Qualify revision-bound reviewable creative proposals

Targets: `core/director`, `core/command`, `core/agents/lineage.ts`, `src/director`. Legacy coverage: YU-060.

Acceptance: Inspect existing YU-060 surfaces; propose/apply/reject/revise binds project revision, affected IDs, inputs and consent; one atomic command path; human-visible diff and exact proposal approval.

Negative cases: Stale base, missing asset, revoked consent, agent self-approval, changed payload, wrong project and interrupted apply; successful unchanged control.

Rollback: Disable new proposal writes/UI; keep existing commands/history readable; add migration rollback only if a schema change proves necessary.

### SS-007 — Unify request, progress and handoff semantics

Targets: `core/director`, `core/jobs`, `sdk`, `cli`, `mcp`, `src/director`. Legacy coverage: YU-062.

Acceptance: SDK/CLI/MCP/browser agree on stable request IDs/errors/progress; reconnect resumes committed state; handoff references brief/revision/evidence without granting authority.

Negative cases: Lost response, duplicate/out-of-order event, old replay, cross-project subscription, oversized MCP frame, secret/path logging.

Rollback: Revert presentation/adapter delta; leave durable receipts intact and old clients compatible.

### SS-008 — Prove cancellation and recovery across creative attempts

Targets: `core/director`, `core/jobs`, `core/process`, `tests`. Legacy coverage: YU-061, YU-062.

Acceptance: Cancel before/during/after worker completion; kill owned service at commit seams; restart/reconcile; no partial artifact or orphan; stale worker cannot commit; bounded cleanup.

Negative cases: Cancel/complete race, lease expiry, restore, lost response and uncertain side effect; no automatic repeat of irreversible action.

Rollback: Revert narrow runtime changes, preserve failure receipts; use existing recovery flow for affected roots.

### SS-009 — Qualify preview cache and audio-clock behavior

Targets: `core/render/preview.ts`, `src/preview`, `src/reference.tsx`, `src/proxies.ts`. Legacy coverage: YU-017, YU-018.

Acceptance: Cold/warm seek policy, rational-frame parity, A/V clock and cache invalidation across asset/revision/font/LUT/profile changes; bounded frame/buffer lifetime.

Negative cases: Out-of-order response, reverse/random seek, cache pressure, missing proxy, closed frame and unsupported browser fallback.

Rollback: Keep reference preview available; invalidate new cache version without deleting sources.

### SS-010 — Qualify long-session and large-timeline stability

Targets: `src/editor`, `src/preview`, `core/render/preview.ts`, `tests`. Legacy coverage: YU-018, YU-026, YU-091.

Acceptance: Record long-session seek/edit/reopen distributions and memory/cache plateau at frozen sizes; same project remains responsive and correct after pressure.

Negative cases: Project switching, removed/relinked media, background job completion and stale buffers; all failures retained.

Rollback: Revert specific buffer/cache/view change; retain soak fixture and original data.

### SS-011 — Expose safe take comparison and replacement in the editor

Targets: `core/takes.ts`, `src/editor`, `src/workspaces/ProjectShell.tsx`. Legacy coverage: YU-032, YU-030.

Acceptance: Compare takes, review affected region, replace/revert with keyboard and pointer, preserve unrelated clips and selected project across views.

Negative cases: Stale selection, incompatible timing, locked track, revoked take and two writers; no silent ripple.

Rollback: Remove new UI entry; canonical takes and old commands remain readable.

### SS-012 — Close one evidenced audio workflow gap

Targets: `core/audio`, `src/audio`, `core/render.ts`, `src/editor`. Legacy coverage: YU-016, YU-026d.

Acceptance: Select a concrete gap after audit; coherent controls plus decoded onset/sync, mute/solo/fade/loudness and segment-join checks; original assets unchanged.

Negative cases: Clipping, silence, delayed audio, cancelled export, repeated normalize and undo/reopen; reject unsupported bus/DSP claims.

Rollback: Revert chosen UI/operation delta; keep original sound refs and stored values compatible.

### SS-013 — Close caption editing and bilingual interaction gaps

Targets: `core/captions.ts`, `src/captions.tsx`, `core/render/ass.ts`, `src/i18n.ts`. Legacy coverage: YU-024, YU-093.

Acceptance: Precise cue timing and keyboard editing, readable mixed-script controls, export boundaries/undo/reopen; prepare exact H1 evidence.

Negative cases: Malformed imported cue, overlap, ASS injection, long text, bidi/focus issues and rational fps edge.

Rollback: Revert new controls/conversion delta; preserve original caption document and reference rendering.

### SS-014 — Close one precise timeline/effect interaction gap

Targets: `core/timeline`, `core/transitions.ts`, `core/effects`, `core/animation`, `src/editor`. Legacy coverage: YU-019, YU-020, YU-021, YU-022.

Acceptance: Choose one trim/snap/crossfade/keyframe control gap; exact rational time, supported preview/export parity, keyboard/drag equivalence, undo and recovery.

Negative cases: Locked tracks, overlaps, VFR, zero-length spans, crossfade boundary, unsupported effect and concurrent edit.

Rollback: Revert bounded operation/UI; retain compatible reads and previous renderer.

### SS-015 — Qualify portable project and honest interchange loss

Targets: `core/interchange/otio.ts`, `core/recovery.ts`, `core/relink.ts`, `core/storage`. Legacy coverage: YU-080.

Acceptance: Supported roundtrip preserves rational timing/refs; explicit unsupported-effect loss report before conversion; portable media manifest hashes; interrupted import leaves original intact.

Negative cases: Traversal, absolute/UNC paths, symlink/junction, bomb/size limits, duplicate/case-colliding names, corrupt/missing assets and unsupported versions.

Rollback: Disable new archive/interchange write path; restore into new root, never destructive downgrade.

### SS-016 — Measure selective revision as a product advantage

Targets: `scripts/benchmark-ultimate.ts`, `docs/evidence/ultimate`, `e2e/testerarmy`. Legacy coverage: YU-081, YU-090.

Acceptance: Matched full rebuild versus selected-shot revision: work reused, unaffected hashes, elapsed/resources, user actions and failures; useful benefit or explicit no-benefit result.

Negative cases: Changed timing/reference/consent must invalidate real dependents; no cache-hit-only or single-best-run comparison.

Rollback: Retain measurements; withdraw unsupported advantage claim; no runtime rollback needed unless a bounded defect fix is added separately.

### SS-017 — Make setup, impact checks and evidence reproducible

Targets: `scripts/ultimate-environment.mjs`, `scripts/qualify-ultimate-environment.mjs`, `docs`, `e2e/testerarmy`. Legacy coverage: YU-001, YU-090.

Acceptance: New owned checkout follows 07; diagnose missing dependencies/native runtime without downloads; preserve graph/test selection rationale, bounded logs and exact-head evidence.

Negative cases: Shared node_modules/native target, insufficient disk, stale manifest and unavailable reviewer/backend do not yield ready/PASS.

Rollback: Revert diagnostics/docs/tool wrappers; do not clean shared paths or remove historical evidence.

### SS-018 — Consolidate affected Windows qualification

Targets: `scripts/qualify-release.ts`, `scripts/qualify-release-evidence.ts`, `docs/evidence/ultimate`. Legacy coverage: YU-091.

Acceptance: Artifact-bound current flags/recipes/runtime; affected unit/integration/browser/security/resource/backup/restore checks; explicit unresolved M/host/external limits; fresh reviews and post-main verification.

Negative cases: Stale/wrong-head receipt, platform skip, transient rerun or failed external gate cannot become blanket PASS.

Rollback: Leave previous qualified behavior and receipts intact; regressions block promotion.

### SS-019 — Publish the final engineering frontier and release evidence packet

Targets: `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA`, `docs/RELEASE_PROPOSAL.md`, `specs/CURRENT.md`. Legacy coverage: YU-100.

Acceptance: All eighteen final-report dimensions addressed; each task VERIFIED/REJECTED/DEFERRED/BLOCKED with evidence; current main and product limits explicit; human gate packet concrete.

Negative cases: No false exhaustive REA, competitor superiority, signed build, model qualification or release approval.

Rollback: Correct documentation with retained audit; no packaging/publishing side effects.

### X-01 — Complete native Arabic and human usability qualification

Targets: `docs/evidence/qualification`, `src/i18n.ts`. Legacy coverage: YU-093.

Acceptance: H1 and YU-093 reviewer identity/artifact/task results; confirmed defects become bounded engineering cards.

Negative cases: Screenshot-only or automated layout pass cannot stand in for native language judgment.

Rollback: Keep unqualified typography/feature activation gated.

### X-02 — Complete external release/profile/signing decisions

Targets: `docs/RELEASE_PROPOSAL.md`, `docs/evidence/qualification`. Legacy coverage: YU-101.

Acceptance: Exact candidate, clean offline Profile A, second-account isolation, controlled disk-full, applicable signing/CSP/presence and explicit ship decision before any release.

Negative cases: Dev profile, unsigned artifact or plan readiness never closes these gates.

Rollback: Keep public release NO-GO; revert activation if a qualified gate later regresses.

### X-03 — Qualify real models and comparative A/V quality only after authorization

Targets: `core/engines`, `docs/evidence/ultimate`. Legacy coverage: YU-072, YU-092.

Acceptance: Explicit authorization precedes download/execution; then append model-specific pinned task/quality/resource protocol and independent review.

Negative cases: Source license or no-model stand-in is not weight/runtime quality approval; no paid inference/GPU.

Rollback: All unqualified engines/providers remain disabled; no model run scheduled now.


## Next eligible

Recheck main and open PRs. SS-004a has green exact-head CI and awaits independent review. R-01–04 and SS-017 can proceed without that reviewer. SS-005a can run with a free media slot after inspecting frozen policies. Do not restart SS-001/002/003 or verified YU features. [11](11_SECURITY_AND_SOURCE_PROVENANCE.md) contains external gates; [12](12_EXECUTION_AND_CONTINUATION_LEDGER.md) contains actual receipts and reviewer availability.
