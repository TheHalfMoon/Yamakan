# Yamakan system engineering strategy

**Current authority (2026-11-03): planning only.** Astro owns final research/qualification; Opus implements after founder handoff. See [handoff](OPUS_IMPLEMENTATION_HANDOFF.md) and [checkpoint](20_FINAL_PLANNING_CHECKPOINT.md). The source reports 14–17 and decisions 18–19 supersede older coverage gaps below. Independent final reviews remain blocked by reviewer-service account limits.

Date: 2026-11-02 (Asia/Riyadh). The [full execution plan](README.md) is prepared with research coverage, task contracts, dependencies and gates. The investigation and engineering program remain incomplete; planning completeness is not completed REA or product qualification. Public release remains **NO-GO**; generation providers and product model execution remain gated.

## Verified starting frontier

Live main began at `9bc15d49e03eff82f50727074fc09aeec3e0af80`. Implementation PR #152 was the only open implementation PR; #85 and #86 were research drafts. Open issue #77 held external release gates. Existing worktrees were inventoried before edits. No existing branch was reset or overwritten. New work uses isolated branches/checkouts.

PR #152 was independently reviewed for correctness and security/resources, checked with real Windows still rendering at 30 and 24000/1001 fps, and merged at its CI-passing head `4d810e0b2726da67c865ead5892f440ed30d5f89`. Merge main: `ad5b12bc94f1236a52c43a76e51d6827acb23df8`; push CI run `40700797962` succeeded. The optimization is delivered; **M export remains unqualified**.

SS-001 approval revalidation is merged as PR #153 at main `79fc86fe1cc215cf091135c114822ea3e35c9e72`. Its Windows suite, Edge and TesterArmy journeys passed. The continuation ledger distinguishes exact-head results from post-merge verification and records later main movement.

SS-002 media preflight (#154) and SS-003 downstream approval invalidation (#156) are also merged. Current main `c129a50c9e6bf9657f404c919c3cf6dbb8273697` passed post-merge CI and 56 combined regression tests. SS-004a's new command journey passes locally in draft #157; its independent review remains pending. Earlier account limits interrupted reviews; fresh review of this plan has now resumed. The broader UI/interruption and competitive-research program remains open.

## Product strategy supported by inspected code

1. Preserve the one SQLite project and job authority. Human edits, agent edits, media and recovery already converge there. Replacing it with donor JSON histories would surrender existing concurrency, receipt and restore guarantees.
2. Make agent evidence precise: identify the project revision, source artifact and approval being acted upon; recheck them when committing. Source inspection found a concrete approval revalidation gap and produced SS-001, rather than another agent framework.
3. Optimize unnecessary media work before changing resource policy. Still-chain hoisting in #152 is the current demonstrated example. It does not establish performance for translucent worst-case compositions.
4. Treat reproducible developer setup as part of correctness. The session found a real mismatch between preflight's PATH FFmpeg and the pinned runtime used by production; SS-002 addresses that diagnostic gap.
5. Deliver cohesive creator journeys through canonical commands. The next useful integration target is a model-free three-shot edit, a targeted revision, restart and export, with preserved unaffected clips and audited history.

## Scope and evidence discipline

`EXECUTION VERIFIED` means the named check ran here or is explicitly linked to a retained execution receipt. `SOURCE INSPECTED` means named implementation code was read; it is not runtime qualification. `DOCUMENTED` identifies product documentation only. `INFERRED`, `UNKNOWN`, `BLOCKED`, and `COMMUNITY REPORTED` must remain explicit.

This pass inspected five agent/video source systems, Orcel policy source, LosslessCut boundary/keyframe logic and Temporal cancellation/determinism code; it inventoried additional public donors and checked accessible private-repository metadata. It did **not** run competitors, benchmark them against Yamakan, or finish professional-editor and generative-platform coverage. It makes no world-leading quality claim.

## Document map

Use the [full plan entry point](README.md) for all fourteen deliverable topics and the dependency sequence. [01](01_COMPETITOR_AND_SOURCE_REA.md) retains observed source findings; [02](02_RESEARCH_EXECUTION_PLAN.md) schedules the remaining coverage; [03](03_SOURCE_QUALIFICATION.md) defines transplant qualification. Documents 04–11 specify architecture, media, harness, development, UX, tasks, benchmarks and security. [12](12_EXECUTION_AND_CONTINUATION_LEDGER.md) records actual work; [13](13_PLAN_READINESS_AND_ENGINEERING_REPORT.md) records readiness and directive traceability.

Research stays separate from implementation PRs. Existing drafts #85/#86 remain unchanged.
