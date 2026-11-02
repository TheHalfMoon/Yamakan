# Yamakan full system improvement plan

Planning baseline: 2026-11-02, Asia/Riyadh. Repository: [TheHalfMoon/Yamakan](https://github.com/TheHalfMoon/Yamakan). Verified implementation main: `c129a50c9e6bf9657f404c919c3cf6dbb8273697`.

This is the complete execution plan for the founder's system engineering directive. It specifies research coverage, implementation contracts, dependencies, tests, rollback, ownership and external gates. **Plan coverage is complete; the research and engineering program is not complete.** New plan changes still require independent review before merge. Product release remains **NO-GO**.

The founder's latest instruction, “i need the full plan ready in repo. go ahead”, authorizes this consolidated planning deliverable. The earlier directive continues to authorize bounded non-model, non-release engineering. Neither instruction activates models, expands resource limits, purchases services, approves irreversible migrations or permits release.

## Read in this order

| Document | Purpose / requested deliverable |
| --- | --- |
| [00 Strategy](00_EXECUTIVE_SYSTEM_STRATEGY.md) | Evidence-supported product direction (00) |
| [01 Findings](01_COMPETITOR_AND_SOURCE_REA.md) | Existing competitor observations, source pins and transplant decisions (01–03) |
| [02 Research coverage](02_RESEARCH_EXECUTION_PLAN.md) | Complete competitor/source discovery schedule and evidence standard (01–02) |
| [03 Source qualification](03_SOURCE_QUALIFICATION.md) | Required donor contracts and decision gates (03) |
| [04 Architecture](04_CURRENT_ARCHITECTURE_CHALLENGE.md) | Options A–D and retained architecture (04) |
| [05 Media](05_MEDIA_ENGINE_IMPROVEMENT_PLAN.md) | Rendering, preview, audio, cache and professional media work (05) |
| [06 Agent harness](06_AGENT_HARNESS_ARCHITECTURE.md) | Durable tools, proposals, progress, handoff and recovery (06) |
| [07 Development](07_DEVELOPER_ENVIRONMENT_AND_TEST_HARNESS.md) | Setup, tests, local tools, concurrency and integration gates (07) |
| [08 Product workflows](08_PRODUCT_UX_AND_CREATIVE_WORKFLOWS.md) | Complete filmmaker journey and interaction acceptance (08) |
| [09 Task contracts](09_ATOMIC_IMPLEMENTATION_PROGRAM.md) | Dependency-ordered work and inherited implementation contracts (09) |
| [Task registry](TASK_REGISTRY.json) | Machine-readable tasks, states, dependencies and acceptance |
| [10 Benchmarks](10_PERFORMANCE_AND_BENCHMARK_PROGRAM.md) | Frozen policies, workload matrix and performance decisions (10) |
| [11 Security](11_SECURITY_AND_SOURCE_PROVENANCE.md) | Threats, source obligations, risks and external gates (11) |
| [12 Execution ledger](12_EXECUTION_AND_CONTINUATION_LEDGER.md) | Actual merged work, receipts and continuation (12) |
| [13 Readiness and report](13_PLAN_READINESS_AND_ENGINEERING_REPORT.md) | Directive traceability, current results and unfinished gates (13) |

## Sequence and dependency rules

1. **Preserve and verify:** SS-001/002/003 are verified. Recheck live main and ownership; retain delivered YU work. Finish independent review of SS-004a in PR #157 when available.
2. **Research and measure:** R-01/02/03/04 establish complete source coverage; SS-005a profiles M without altering policy. These can progress independently, subject to one media test slot.
3. **Integrity and harness:** SS-006 scopes reviewable proposals; SS-007 adds transport-consistent progress and handoff; SS-008 proves cancellation/restart semantics. SS-004b completes the integrated browser/forced-interruption journey after proposals are available.
4. **Media and professional workflows:** SS-005b follows a defensible profile; SS-009/010 qualify preview/long sessions; SS-011 exposes take comparison; SS-012/013/014 improve audio, captions and precise editing only where current behavior is insufficient.
5. **Portability and differentiation:** SS-015 qualifies archives/interchange; SS-016 measures selective revision; SS-017 closes developer reproducibility gaps.
6. **Consolidate:** R-05 revisits architecture with measured evidence; SS-018 refreshes affected Windows qualification; SS-019 assembles the final engineering/release evidence without shipping. X-01/02/03 remain externally gated.

Task-specific dependencies in the registry take precedence over this wave summary. A research prerequisite must reach VERIFIED for its bounded scope before its dependent implementation begins. EXTERNAL_BLOCKED is not eligible. QUALIFICATION_READY means inspect existing tests/source and implement within the stated contract; it is not permission to skip REA. No elapsed-time estimate substitutes for a gate.

## Authority and reconciliation

This plan is the current system-improvement entry point. [CURRENT](../../../specs/CURRENT.md), [operational contracts](../../OPERATIONAL_CONTRACTS.md), [release proposal](../../RELEASE_PROPOSAL.md), existing resource policies and [security policy](../../SECURITY.md) retain their authority. The frozen T1–T10/W1–W18 and P10 plans remain historical baselines.

The [YU execution ledger](../../evidence/ultimate/EXECUTION_LEDGER.md) and individual receipts establish delivered capabilities. Its broad trailing PLANNED range is stale where a specific verified receipt exists; do not reopen those tasks. [PR #86](https://github.com/TheHalfMoon/Yamakan/pull/86) was reconciled read-only at `caec7d9c225d430e1a42f8af8fd8eebc17c5317d`; PRs #85/#86 remain untouched.

A task owner claims a bounded scope in its PR before editing. The implementing agent owns code and evidence; a fresh reviewer owns correctness/security review; the founder or qualified human owns explicit external gates. Owners are roles until a live agent claims work; no fictitious assignment or unattended background execution is implied.
