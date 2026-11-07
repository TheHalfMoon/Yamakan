# Architecture options and adversarial choice

Status: engineering recommendation, **ENGINEERING INFERENCE**, 2026-10-23. Scores express judgment under this founder's constraints, not measured product performance. Source basis: [audit](01_CURRENT_CODEBASE_AUDIT.md), [donors](08_SOURCE_DONOR_MASTER_MATRIX.md), `core/store.ts`, `core/canonical.ts`, `core/engines/contract.ts`, `core/recovery.ts`, `core/command/registry.ts` at baseline `a3c3ce91815aee35ce5b91b4a483dd85766a4429`.

## Alternatives

- **A — narrow extensions:** retain every current subsystem boundary and add small donor transplants. Least immediate migration, but sidecar creative state and browser-local command semantics remain expensive to reason about.
- **B — modular professional editor:** adopt a reusable native editing engine and build Yamakan product workflows around it. MLT/FFmpeg and mature editors offer deeper semantics, but native build closure, Windows packaging, timeline mapping and render parity are substantial changes.
- **C — unified agent-native system:** make orchestration/planning the main surface, with model-independent adapters. Strong automation potential; risks prioritizing generated demos over editing quality and making every user a workflow designer.
- **D — canonical creative project with qualified media execution:** retain A's proven core, explicitly migrate all durable creative documents into its revision/backup closure, keep security/run state in the same SQLite authority, and qualify B's media techniques and C's typed tools independently. No microservices, second database, general plugin platform or new scheduler.

## Weighted matrix

Scores 1–5, higher better. A score of 5 means best fit among these options for the stated constraints, not certainty. Reliability includes crash consistency; performance is feasibility pending measurements. Compatibility/offline/privacy are properties to prove with tests.

| Criterion | Weight | A | B | C | D | Evidence and uncertainty |
|---|---:|---:|---:|---:|---:|---|
| Reliability/recovery | 15 | 3 | 4 | 3 | 5 | Current sidecars source-inspected; D migration unbuilt |
| Editing depth/performance potential | 15 | 3 | 5 | 2 | 4 | Mature donor implementations; integration unmeasured |
| Cohesive usability | 12 | 3 | 4 | 3 | 4 | Product workflow inference; no user study |
| Windows/offline suitability | 12 | 5 | 3 | 3 | 5 | Existing Windows receipts; new workers unqualified |
| Solo-founder maintenance | 14 | 4 | 2 | 2 | 4 | Dependency-boundary assessment |
| Agent/AI extensibility | 10 | 3 | 3 | 5 | 4 | Existing command surface vs graph-shaped adapter |
| Zero-cost practicality | 10 | 5 | 3 | 2 | 5 | Editing possible; no GPU entitlement established |
| Migration difficulty (easy=high) | 7 | 5 | 1 | 2 | 3 | D has real migration work; no rewrite |
| Security/source provenance | 5 | 4 | 3 | 3 | 4 | Existing controls retained; imported closure reviewed |
| **Weighted mean /5** | **100** | **3.77** | **3.29** | **2.74** | **4.30** | Recomputed by plan validator |

## Sensitivity and falsification

Double editing depth to weight 30 and rescale other weights proportionately: D remains preferred under the declared scores. If editing depth alone carries 60% and the remaining criteria preserve relative weights, B overtakes D (B about 4.20, D about 4.14). This is a meaningful reversal: a funded professional NLE rewrite is a different objective. If D's reliability and maintenance each fall two points during the migration spike, D falls to 3.72, below A's 3.77. Stop the migration expansion rather than hiding that failure.

Evidence that changes the choice: measured native-engine integration giving materially better preview on the target PC with a bounded build/license closure; a canonical-document migration that cannot satisfy recovery or memory budgets; or founder-funded hardware and a different primary customer. Source availability alone does not justify a migration.

## Engine decision independently reconsidered

PR #85's narrow Diffusers worker has a reasonable smaller-surface hypothesis, but no same-host inference, cancellation/containment, quality or memory evidence proves it wins. The current `EngineAdapter` accepts Comfy-shaped `class_type` graphs and whole byte arrays. That is insufficient as the final model-independent product contract. Adopt a typed operation and immutable asset references in v2; maintain a bounded compatibility bridge for v1 fake tests. Diffusers, official model CLI and locked Comfy graphs become implementation candidates below that boundary. Select **one** first real worker only after rights, supported operation, hardware, containment and artifact tests. No new default engine or weights are selected by documentation.

Do not require Plume readiness or alter Paradigm. A future Plume implementation must satisfy precisely the same request, output, safety and evidence contracts.

## Challenges and disposition

| Perspective | Strong objection | Disposition |
|---|---|---|
| Product strategist | Ownership is useful but may not attract creators without quality models | Test finishing/revision journeys first; retain optional provider design; no superiority claim |
| Senior editor | Fixed30fps, sparse effects and short fixtures are far from professional | Rational-time and bounded preview tasks precede a professional badge |
| Media engineer | FFmpeg filtergraphs may not scale to interactive compositing | Benchmark cache/proxy path; native-engine decision only after identical workload spike |
| AI engineer | Neutral contracts can become an abstract lowest common denominator | Per-operation discriminated capabilities and explicit unsupported controls; no silent loss |
| Source integrator | Donor schedulers and project shapes conflict | Import algorithms/worker outputs, never donor authorities |
| Security architect | Windows low integrity is not proof of network denial | Python/network/filesystem containment gets a separate E-SEC qualification |
| Windows engineer | Restricted GPU workers may fail under driver/runtime constraints | Fail closed, preserve offline editor; no untested fallback privilege escalation |
| UX researcher | Multiple creative modes can still overwhelm | Three primary workspaces, shared selection and history; observe task completion |
| Performance engineer | New document blobs can bloat SQLite and history | Immutable dedup, bounded document sizes, migration/backup benchmarks |
| Founder execution | This is still too much for one maintainer | First implementation slice contains baseline, recovery and undo only; optional phases remain gated |

Independent review records and actual findings are in [21](21_RISK_REGISTER_AND_DECISION_LOG.md); this table is a deliberate adversarial analysis, not ten independent human reviews.
