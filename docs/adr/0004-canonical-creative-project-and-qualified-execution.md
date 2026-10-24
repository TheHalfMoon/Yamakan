# 0004. Canonical creative project and qualified execution

Status: accepted as a planning recommendation (2026-10-23); implementation and enablement require separate founder instruction.

## Context

At main `a3c3ce91815aee35ce5b91b4a483dd85766a4429`, timeline snapshots/jobs are transactional, but Studio is session-local and Cinema/Director persist mutable sidecars outside the backup closure. EngineAdapter v1 exposes graph node classes and media byte arrays. PR #85 proposes Diffusers-first without an executed cross-engine qualification.

## Decision

Choose Architecture D in `docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/09_ARCHITECTURE_OPTIONS.md`: retain the existing database, command registry, jobs, asset store, owned processes and reference renderer; extend their coverage to immutable creative documents, workflow/security records and complete backup references. Use operation-based, versioned engine contracts with immutable artifact handles. Select the first real worker by later rights/hardware/containment/capability evidence. Diffusers is a candidate, not the product authority. This supplements ADRs 0001–0003 and changes the planning recommendation in unmerged PR #85; it does not rewrite those historical records.

## Consequences

+ Preserves completed work and makes recovery/agent behavior coherent without depending on Plume or a GPU.
+ Keeps donor engines and future providers replaceable below one canonical project and execution service.
- Requires explicit legacy-sidecar ownership mapping, Studio bitmap ingestion, consent-revocation semantics and migration/backup tests.
- Full professional editing and generative quality remain unqualified. Engines/providers/JASSUB remain off and public release remains NO-GO.

Revisit if the migration cannot meet bounded resource/recovery criteria or a native preview spike provides a demonstrably better maintainable route under the same contracts.
