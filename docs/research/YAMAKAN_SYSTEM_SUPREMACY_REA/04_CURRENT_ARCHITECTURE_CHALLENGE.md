# Current architecture challenge

Review date: 2026-10-28. Scope: read-only architecture, source specimens and failure boundaries. Implementation remains separately tested and reviewed under the founder's autonomous authorization.
Baseline: Yamakan `ad5b12b` plus SS001 `b87f3720781ba691e16b5cba23733a91599e9c9e` (observed engineering HEAD).
Decision: preserve the authority core, improve its dependency semantics, and import narrow capabilities only after comparative evidence.
Models remain OFF; release remains NO-GO. This review ran no tests, donor applications, installs, providers or resource-policy changes.

## Evidence vocabulary and boundaries

- **[S] SOURCE INSPECTED:** code inspected at the named pin; proves structure, not successful execution.
- **[R] DOCUMENTED:** a repository contract reports a result; not independently rerun here and not an exact-current-head PASS.
- **[I] INFERRED:** conclusion from inspected structure, requiring targeted validation before a product claim.
- **[P] INFERRED proposal:** a recommended change or experiment; unimplemented and unqualified.
- **[U] UNKNOWN:** evidence absent from this bounded review. No donor execution, platform certification or whole-repository security assurance is implied.
- Source paths below are relative to the engineering checkout; specimens are under `work/research/<owner--repo>/<SHA>/`.
- OpenMontage's index advertises `e01dbf433f46eeb91d39bf905e194162921019a3`; the inspected checkpoint specimen is the older, imported pin `9327439db69021ab4b0e2776729bf3b58fdb5a87`. Do not conflate them.

## What the current architecture actually earns

| Area | Evidence | Judgment |
|---|---|---|
| Canonical commit | [S] `core/store.ts:1047` checks request replay before revision; snapshot, CAS head, receipt, revision and outbox commit together through line 1265. | Preserve this atomic boundary. A donor UI or worker must not bypass it. |
| Snapshot economics | [S] The commit reconstructs/validates an editing view and serializes the complete canonical snapshot inside its transaction. | [I] Full snapshots can amplify CPU, lock time and retained bytes; no measured bottleneck here justifies a delta-store rewrite. |
| Durable jobs | [S] `core/jobs.ts:615` claims queued work transactionally; `#fenced` at 688 checks supervisor and attempt generations. | Preserve one job authority; a task runner's local status cannot declare durable success. |
| Owned processes | [S] `core/process/workers.ts` verifies pinned Windows FFmpeg/ffprobe and returns one `ProcessOwner`. | A new worker needs this ownership/allowlist boundary, not direct subprocess launch. |
| Director durability | [S] `core/director/runtime.ts:393` derives latest stage receipts from append-only attempts; approval validity uses execution epoch and ready project objects. | Durable audit is stronger than folder checkpoints; dependency identity is still incomplete. |
| Backup / storage | [R] `docs/OPERATIONAL_CONTRACTS.md:33-45` distinguishes SQLite commit from external-object durability and mandates pinned consistent backup. | Keep NTFS qualification and verified restore; atomic rename is not proof of power-loss durability. |
| Product reach | [R] `specs/CURRENT.md` records manual Director, Studio, Cinema and deterministic quality capabilities, with providers disabled and release blocked. | Product breadth does not qualify an unmeasured renderer, generative workflow or installer. |

## Two objections that must survive the recommendation

**Director approval lineage: follow-up required.**
[S] SS001 adds predecessor revalidation inside `approveStage`'s transaction (`runtime.ts:651`) and rejects approval of a nonreviewable output (`stages.ts:213`).
[I] This closes the observed approval-time prerequisite gap; it does not establish which predecessor outputs produced a downstream artifact.
[S] `appendAttempt` stores stage, output hash, epoch and status, but no consumed predecessor attempt IDs, input digest, project snapshot hash or manifest digest.
[S] `runFrom` selects the latest attempt separately for each stage; `advanceStage` can replace an approved stage when its output hash changes.
[I] Sequence requiring a new regression: approve A1; complete/approve B1 from A1; replace A with A2; approve A2; ask whether B1 still counts as current. Latest-stage checks can accept current A2 alongside stale B1 without demonstrating that B1 consumed A2.
[P] Bind each stage result to its exact input bundle: predecessor attempt/output identities, relevant canonical snapshot, manifest/version and execution epoch. Derive downstream staleness when those bindings change.
[P] Preserve old attempts for audit; do not silently delete approvals or rewrite artifacts. Revalidation must require explicit acceptance of the correct dependency bundle, or regeneration where content depends on changed input.
[P] Validate unchanged-input renewal, changed predecessor, restore/import epoch, concurrent approval, same-request replay, and stale downstream export before claiming closure.
[U] This is source-supported follow-up, not an executed exploit or a failing-test claim. SS001 remains a bounded improvement, not complete lineage qualification.

**Renderer M: performance is still a gate.**
[R] `docs/OPERATIONAL_CONTRACTS.md:809-827` records M as 200 clips, 16 tracks, ten minutes, 1080p; optimized export completed only 2/5 runs at 424 s and 469 s against 480 s.
[R] Three runs timed out; the dense probe's roughly sevenfold median gain does not qualify M. A pixel-equivalent still recipe covers that recipe, not all media/effects.
[I] Retaining FFmpeg is justified by shared reference/export semantics and ownership, not by claiming the performance problem solved.
[P] First profile actual repeated decode/filter/segment costs and test conservative opaque-layer elimination. Refuse uncertain cases: partial coverage, alpha, blend modes, masks, transforms, transitions or animated visibility.
[P] Keep fixed policy and identical output fixtures. Parallel segments, extra threads and longer deadlines are separately reviewed resource decisions; none is assumed here.
[U] No donor renderer was executed or shown faster, safer, Arabic-correct or equivalent on M.

## Alternative comparison

All four alternatives retain one canonical project database and one job authority. A whole-product donor replacement is excluded unless it independently earns those contracts and a new decision.

| Dimension | A: preserve + optimize | B: narrow donor replacement | C: bounded workers | D: dependency-bound proposals and derived read models |
|---|---|---|---|---|
| Correctness | Lowest semantic disturbance; leaves current gaps until fixed. | Adapter can reuse strong logic but mismatched time/identity semantics can corrupt edits. | Immutable input/output protocol contains faults; host validates every result. | Explicit base/input identity addresses stale work before commit; no second project truth. |
| Performance | Measure transaction, preview and render hot paths; no promised speedup. | Wins only where matched fixtures demonstrate improvement. | Can isolate CPU/memory but startup/serialization may outweigh benefit. | Cache immutable observations; invalidate by dependencies; write path stays conservative. |
| Recovery | Reuses receipts, generations, backups and retained revisions. | Replacement requires compatibility and recovery fixture parity. | Kill/restart cleanup, attempt fencing and orphan reconciliation mandatory. | Proposals are discardable; accepted edits use existing receipts; caches rebuild from canonical data. |
| Reuse | Current investment retained; fewer import surfaces. | Highest direct source reuse for isolated pure algorithms. | Reuse engines as execution components, not schedulers/stores. | Reuse donor dependency/proof ideas through Yamakan contracts. |
| Maintainability | Lowest immediate integration cost; large store/job modules still need clear seams. | Upstream drift and translation tests are continuing costs. | Adds protocol versions and Windows packaging/diagnostics. | Adds one explicit provenance envelope, avoiding bespoke lineage formats per feature. |
| Product / agent UX | Keeps existing UI/API parity; stale outputs may remain confusing. | Targeted editing ergonomics can improve quickly. | Progress/cancel can improve; worker internals should remain invisible. | Show observed revision, affected objects and stale reason before applying a proposal. |
| Windows / offline | Existing local NTFS and owned FFmpeg baseline. | Language/runtime portability is unqualified until tested. | Requires owned process-tree, ACL, path/reparse, quota and offline qualification. | Pure service/schema change can remain offline; no new runtime required initially. |
| Security | Familiar boundary; existing correctness/security gates remain necessary. | Each import expands supply-chain/parser surface. | Isolation reduces some blast radius; process separation alone is not a sandbox. | Typed commands and bounded evidence exclude executable agent patches from project authority. |
| Cost | Lowest near-term engineering cost; optimize only measured waste. | Translation, notices and maintenance can exceed saved coding time. | Extra runtime/RAM and deployment cost; no paid capacity authorized. | Moderate schema/API cost; reduces stale recomputation, benefit still unmeasured. |
| Migration / rollback | Lowest risk; feature fallback usually enough. | Keep original implementation until semantic parity; restore pre-migration backup if schema changes. | Disable worker adapter; preserve accepted outputs and attempts; original path remains. | Additive versioned records first; disable proposal entry point; schema downgrade uses verified backup. |

## Donor pressure test: what is worth importing

| Pinned specimen and observed mechanism | Reuse judgment | Boundary that prevents architectural regression |
|---|---|---|
| [S] Kinewright `0b353397845c52fba9c34bfd64700d381ce721cb`, `crates/kinewright-agent/src/durable_branch.rs`: freezes durable base/checkpoint identity, retains applied delta and pins base; `crates/kinewright-project/src/editing_session/durable.rs`: `BranchBinding` and `FrozenTaskResult`. | Strong design reference for proposals and dependency-bound review. Translation/design adaptation preferred to importing Rust ownership/store stack. | Preserve Yamakan project revision + snapshot identity; do not import `ProjectBundle`, actor authority or a competing branch store. GPL-3.0 source reuse needs the existing rights/provenance decision, not an assumed MIT status. |
| [S] Kinewright `docs/M30-PERCEPTION-REVISION-SAFETY.md` specifies revision-bound atomic edits and bounded storyboard proof; it explicitly says the runtime revision resets on reopen. | Useful bounded perception contract; document claims are not execution evidence. | Durable Yamakan identity must include snapshot/project/epoch; an actor-local counter alone is insufficient across restart. |
| [S] OpenFilm `97bc98b9d2d9585ea917b24abc9742c68b5f0a27`, `packages/openfilm/studio/ui/src/editor/undo.ts`: derives inverses by clip ID and infers tracks from remaining clip anchors. | Candidate for conflict-aware undo behavior and adversarial fixtures, not wholesale replacement. MIT notice present. | Yamakan has explicit canonical identities and revision-bound undo; retain those. Reject ambiguous track/field conflicts instead of importing positional heuristics as authoritative. |
| [S] open-edit `1d3b75b7f46280061bae5ab4cb47b9538276d8fb`, `cli/src/providers/queue-ledger.ts`: claimed/submitting/uncertain/accepted states; records possible purchase before network send. | Strong future provider ambiguity/reconciliation pattern; Apache-2.0 license present. Providers stay OFF. | Translate states into existing SQLite jobs/attempts; never adopt `assets/jobs` as another authority or retry an uncertain paid request automatically. |
| [S] Same donor `exclusive-files.ts`: hard-link/exclusive-create fallback and temp rename; no explicit fsync in inspected functions. | Concurrency pattern only; no power-loss durability claim. | Do not replace the DB transaction or qualified object publication with these helpers; do not assume PID liveness substitutes for a supervisor generation. |
| [S] Remocn `fe21cf3db88e0036afea80716abd12d4373a2dd7`, `sidecar/agent/turn-tools.ts`: scoped turn tools, progress signals, pipeline stream, save-time preview attachment; comments reject delayed preview backfill. | Useful UX pattern: preview evidence belongs to the saved composition, not whatever is current later. MIT specimen present. | Translate tool intent into registered Yamakan commands and immutable snapshot proof; do not import the project-code, stock/provider or sidecar authority surface. |
| [S] OpenMontage `9327439db69021ab4b0e2776729bf3b58fdb5a87`, `lib/checkpoint.py`: prerequisite/manifest approval checks and superseded checkpoint archival. | Already informed Yamakan stage rules; reuse additional fixtures/concepts only where they improve current semantics. AGPL-3.0 specimen. | Folder checkpoints and caller approval booleans cannot replace append-only DB attempts, authenticated human approval or the new dependency-binding requirement. |

License labels above describe inspected/indexed sources, not a legal conclusion about combining or distributing them. Any import still needs exact SHA, path, hash, modifications and notices in the provenance ledger.

## D: a better next move than selecting another application core

[P] Use a versioned proposal/evidence envelope around the current core: `{projectId, baseRevision, snapshotHash, executionEpoch, manifestHash, inputRefs, commandBatch, evidenceRefs}`.
[P] `inputRefs` name exact consumed objects or stage-attempt identities; `evidenceRefs` name bounded storyboard/analysis artifacts and their compiler/profile versions.
[P] Admission validates the envelope and budget before expensive work. A proposal never advances the canonical head until the existing command service accepts its typed atomic batch.
[P] A stale base returns a conflict and a useful change summary. It must not silently apply a patch planned against a different film; any rebase becomes a new reviewable proposal.
[P] Review/approval binds the dependency digest and proposed batch, then commit rechecks that binding inside the transaction. Export and downstream stage admission must reject stale dependency bundles.
[P] Read models (timeline summaries, search indexes, contact sheets and dependency summaries) are immutable or rebuildable projections keyed by canonical identity; they are never editable alternate project records.
[P] Reuse the job supervisor for expensive derivations; start with in-process pure logic or existing owned FFmpeg. Add a worker only after the measured workload justifies its boundary.
[I] D is superior for the observed lineage/review problem because it targets the missing invariant directly, while A alone leaves it implicit and B/C alone merely change implementation location.
[U] D is not proven faster and does not qualify renderer M. It is an architectural recommendation, not a finished generic workflow engine.
[P] Keep the first implementation small: Director input-binding plus stale-state projection. Generalize to agent proposals only after that bounded path demonstrates value.

## Decision and rejection criteria

1. **Choose A as the substrate and a bounded D as the first structural improvement.** [P] Preserve receipts, exact time, the canonical DB, process ownership, resource policy and one job authority.
2. **Use B opportunistically for pure capabilities or test ideas.** [P] A donor wins only after matched semantic, resource, Windows, recovery and product fixtures outperform or simplify the current implementation.
3. **Use C only for demonstrated isolation or runtime needs.** [P] It cannot multiply concurrent workers, memory, threads or runtime budgets without a separate reviewed decision.
4. **Reject whole donor product adoption at this evidence level.** [I] The inspected specimens demonstrate useful mechanisms; none demonstrates superior complete offline Windows recovery, Arabic rendering, canonical migration and agent parity.
5. **Do not replace SQLite because of repository size or source novelty.** [P] First measure lock duration, snapshot serialization, retained-byte growth, command latency and actual contention on the named profile.
6. **Do not replace the renderer based on a demo or feature list.** [P] Require identical timeline/media fixtures, declared visual tolerance, Arabic/Latin typography review, cancellation/fault recovery and repeated M completion under unchanged limits.

## Review gates and rollback, without expanding today's scope

| Proposed change | Evidence required before activation | Rollback |
|---|---|---|
| Director dependency binding | Changed-parent/reapproved-parent stale-child fixture; restore/epoch behavior; concurrent CAS and replay; UI/API/MCP stale reason; independent correctness/security review. | Disable new entry points; retain append-only records and old artifacts. Versioned DB migration requires verified pre-upgrade backup for old-binary rollback. |
| Proposal / proof API | Atomic stale rejection, bounded image/text evidence, no secret/path leaks, agent scope enforcement and exact snapshot proof; canonical save/reopen parity. | Disable proposal feature; existing typed edits continue; proposal projections can be rebuilt or discarded. |
| Narrow donor algorithm | Current + donor differential fixtures, stable identities/time semantics, import guard/provenance/notices, negative/limit cases; no donor store dependency. | Retain original adapter path and dispatch flag until accepted; do not rewrite historical canonical bytes. |
| Worker integration | Windows launch/death seams, cancellation, stale-attempt publish rejection, ENOSPC, output validation, offline run and total resource envelope. | Disable adapter and stop owned workers; retain audit; reconcile partial artifacts through existing authority. |
| Render optimization | Fixed profile and repeated samples, frame/audio comparison where defined, mixed-script titles, transitions/alpha/animation refusal cases, cancellation and cache-key correctness. | Fall back to prior compiler/render strategy; compiler version separates caches and prevents stale artifact reuse. |

[U] None of these gates was executed in this read-only review; the host qualification suite is separate evidence. No test result has been inferred from a test filename.
[P] Acceptance artifacts should state exact head, fixture/media hashes, profile, policy, runtime/compiler versions, observed distributions and failures. Independent review must inspect the immutable change, not trust an advisory local classifier or lineage label.
[I] The defensible advantage is dependable shared project state plus explicit proof of what agents and stages observed. Preserving that while fixing stale dependencies is a stronger next investment than acquiring a second application core.

