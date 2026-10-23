# Atomic implementation tasks

Canonical machine-readable registry: [TASK_REGISTRY.json](TASK_REGISTRY.json). All tasks are future specifications. PLANNED does not authorize implementation; BLOCKED identifies an additional resource/authorization condition. No task is MERGED or VERIFIED by this research. Shared exact source baseline: `a3c3ce91815aee35ce5b91b4a483dd85766a4429`. Every task inherits existing release prohibitions and source provenance, but its concrete tests/rollback/interfaces are stated below. Donor current source pins do not prove bundled binary correspondence; validate every module/closure before copying. Existing-source refs are checked mechanically; proposed targets are labeled NEW.

## YU-000 — Freeze artifact-bound baseline and capability evidence

Phase 0; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Source flags/receipts exist; narrative heads differ. User value: Avoid repeating completed work or promoting stale evidence.

- **Exact source:** `specs/CURRENT.md`, `docs/IMPLEMENTATION_PLAN.md`, `core/command/registry.ts`, `core/qualification-policy.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `specs/CURRENT.md`, `docs/IMPLEMENTATION_PLAN.md`, `core/command/registry.ts`, `core/qualification-policy.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/baseline.json`, NEW `scripts/qualify-ultimate-baseline.mjs`.
- **Dependencies:** None; separate implementation authorization still required.
- **Interfaces:** Versioned capability evidence manifest only.
- **Data:** No production schema change.

**Implementation instructions**

1. Capture main/open PR/issues and exact candidate SHA; preserve PR85 separately.
2. Extract flags/catalog/profile/compiler/native/font hashes and bind each historical receipt to its own commit.
3. Record unsupported source areas and baseline failures; no blanket rewrite of old receipts.

**Security:** Strip secrets/local tokens from public receipts.

**Performance:** Small metadata-only capture; no media/model downloads.

**Tests:** Manifest detects historical-head mismatch and disabled engines; Existing completed W1–W18/P10 receipts preserved.

**Negative tests:** Malformed/stale receipt cannot produce current-head PASS.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-000 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Manifest detects historical-head mismatch and disabled engines; Evidence demonstrates: Existing completed W1–W18/P10 receipts preserved; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Remove new report generator; preserve all historical evidence.

## YU-001 — Reproduce dependency/native/browser baseline in an isolated test workspace

Phase 0; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Fresh clone missing zod and native helper. User value: Make later regression claims meaningful.

- **Exact source:** `package.json`, `package-lock.json`, `scripts/browser-e2e.mjs`, `native/procd/Cargo.toml` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `package.json`, `package-lock.json`, `scripts/browser-e2e.mjs`, `native/procd/Cargo.toml`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/environment.json`.
- **Dependencies:** YU-000.
- **Interfaces:** No API change.
- **Data:** None.

**Implementation instructions**

1. Use existing approved pinned runtime and lockfile; inspect lifecycle scripts before isolated install if needed.
2. Build qualified native helper only under later implementation scope; capture hashes.
3. Run existing typecheck/lint/tests/build/provenance/brand and affected Edge E2E; record real disk budget.

**Security:** No unapproved lifecycle downloads; no weights or provider keys.

**Performance:** Reserve dependency/build/staging space; abort before disk exhaustion.

**Tests:** Required existing scripts have exact logs and environment profile; Failures/skips are retained with reason.

**Negative tests:** Missing helper/FFmpeg or dependency produces BLOCKED, never pass.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-001 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Required existing scripts have exact logs and environment profile; Evidence demonstrates: Failures/skips are retained with reason; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Discard isolated test environment only; no user-workspace deletion.

## YU-002 — Make Quality Lab evidence validation and digest complete

Phase 0; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Duplicate A/B slots allowed; summary omits output identity. User value: Prevent invalid summaries and evidence equivalence.

- **Exact source:** `core/quality/lab.ts`, `tests/w17-quality-agents.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/quality/lab.ts`, `tests/w17-quality-agents.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/quality/lab.ts`, `tests/w17-quality-agents.test.ts`.
- **Dependencies:** YU-001.
- **Interfaces:** Versioned full evidence digest and blinded result.
- **Data:** Version comparison evidence format; backward read policy.

**Implementation instructions**

1. Require exactly one A and one B, failures<=attempts and declared rater/rubric uniqueness.
2. Version a complete private evidence digest binding systems/models/output/input/latency/consent; keep blinded presentation separate.
3. Migrate accepted v1 summaries explicitly; do not relabel historical data.

**Security:** Do not leak system identity in blinded view.

**Performance:** Bounded arrays, no model evaluator invoked.

**Tests:** A/B comparison roundtrip and changed output changes evidence hash.

**Negative tests:** A/A,B/B,duplicate rater,invalid counts -> structured VALIDATION.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-002 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: A/B comparison roundtrip and changed output changes evidence hash; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep v1 reader and reject new writes if rolled back; preserve evidence.

## YU-003 — Bound MCP frames and concurrent requests

Phase 0; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Complete newline frame can evade current buffer bound. User value: Keep local automation responsive under hostile input.

- **Exact source:** `mcp/main.ts`, `tests/mcp.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `mcp/main.ts`, `tests/mcp.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `mcp/main.ts`, `tests/mcp.test.ts`.
- **Dependencies:** YU-001.
- **Interfaces:** Document frame/concurrency limits and refusal codes.
- **Data:** None.

**Implementation instructions**

1. Check UTF8 bytes of every complete line before JSON.parse.
2. Add bounded admission for in-flight requests/responses and explicit backpressure/errors.
3. Preserve protocol shutdown and registry parity.

**Security:** Authorize each command after parse; no unbounded retained responses.

**Performance:** Peak RSS bounded by declared frame+queue caps under flood.

**Tests:** Valid multi-frame stream and clean shutdown work at limits.

**Negative tests:** Oversized newline-terminated JSON,many lines/chunk,10k concurrent calls remain bounded.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-003 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Valid multi-frame stream and clean shutdown work at limits; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Revert transport change; clients continue existing schema.

## YU-010 — Add immutable creative document references to canonical v5

Phase 1; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Project v4 omits creative documents. User value: One recoverable creative project.

- **Exact source:** `core/canonical.ts`, `core/store.ts`, `core/studio.ts`, `core/scene3d.ts`, `core/command/registry.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/canonical.ts`, `core/store.ts`, `core/studio.ts`, `core/scene3d.ts`, `core/command/registry.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/canonical.ts`, `core/store.ts`, `core/command/registry.ts`, NEW `core/documents.ts`, NEW `tests/creative-documents.test.ts`.
- **Dependencies:** YU-001.
- **Interfaces:** yamakan.document.get/list/commit; revision/hash/CAS return.
- **Data:** Canonical v5 + creative_documents + snapshot_document_refs; derive media closure.

**Implementation instructions**

1. Implement10 document tables/ref schema in existing DB; strict byte and nested-reference validators.
2. Commit document bytes/ref index/head/history/receipt/outbox atomically through ProjectStore.
3. Define document.get/list/commit with project ownership and expected document hash; no disk await in transaction.

**Security:** Project-scoped refs,ready-object validation,receipt digest and transactional outbox.

**Performance:** Measure dedup/write/backup costs at8MiB bounded canvas; retain existing snapshot cap.

**Tests:** Two writers -> one commit/one conflict; replay returns exact receipt; undo creates new revision; Crash before/after commit retains only acknowledged complete document.

**Negative tests:** Unknown schema,huge UTF8/depth,foreign asset,hash mismatch reject.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-010 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Two writers -> one commit/one conflict; replay returns exact receipt; undo creates new revision; Evidence demonstrates: Crash before/after commit retains only acknowledged complete document; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Restore verified pre-v5 workspace copy; old reader refuses v5 rather than drops docs.

## YU-011 — Persist Studio canvas and bitmap assets through document commands

Phase 1; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Canvas and Blob map are session-local. User value: Drawing survives reload and backup.

- **Exact source:** `core/studio.ts`, `src/studio/StudioCanvas.tsx`, `src/studio/host/assetStore.ts`, `src/studio/host/documentStore.ts`, `src/studio/host/port.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/studio.ts`, `src/studio/StudioCanvas.tsx`, `src/studio/host/assetStore.ts`, `src/studio/host/documentStore.ts`, `src/studio/host/port.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/studio.ts`, `src/studio/StudioCanvas.tsx`, `src/studio/host/assetStore.ts`, `src/studio/host/documentStore.ts`, NEW `tests/studio-persistence.test.ts`.
- **Dependencies:** YU-010.
- **Interfaces:** Host async load/commit and managed bitmap resolver.
- **Data:** Studio doc refs and snapshot media-index closure.

**Implementation instructions**

1. Bind selected project/document lifecycle to registry; open committed document rather than always empty.
2. Import bitmap bytes into existing managed storage before doc attach; translate engine IDs deterministically.
3. Show pending/committed/conflict states; dispose only caches, never acknowledged assets.

**Security:** Reject unlisted nested external media/URLs and oversized canvas.

**Performance:** No duplicate bitmap upload for same digest; rerun Q8–Q10 affected fixtures.

**Tests:** Draw+import+commit+restart yields exact canvas/bitmap hashes; Undo/reopen and two-window conflict preserve committed state.

**Negative tests:** Worker/browser dies between bitmap import and doc commit; no phantom ready doc.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-011 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Draw+import+commit+restart yields exact canvas/bitmap hashes; Evidence demonstrates: Undo/reopen and two-window conflict preserve committed state; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Retain imported assets and v5 snapshot; rollback UI does not erase documents.

## YU-012 — Migrate Cinema sidecars with explicit project assignment

Phase 1; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Mutable workspace/cinema JSON lacks project CAS. User value: Scenes become recoverable project content.

- **Exact source:** `core/cinema-store.ts`, `core/scene3d.ts`, `core/command/registry.ts`, `src/cinema/CinemaViewport.tsx` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/cinema-store.ts`, `core/scene3d.ts`, `core/command/registry.ts`, `src/cinema/CinemaViewport.tsx`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/cinema-store.ts`, `core/command/registry.ts`, NEW `core/documents-legacy.ts`, NEW `tests/cinema-migration.test.ts`.
- **Dependencies:** YU-010.
- **Interfaces:** scene commands gain projectId/expectedRevision/document hash; explicit legacy import.
- **Data:** Cinema doc kind and migration receipt map in same DB.

**Implementation instructions**

1. Inventory sidecars read-only with hashes and validate UUID/schema/bytes.
2. Stage unassigned scenes; require explicit project selection; never infer ownership.
3. Import idempotently to canonical document refs; preserve originals and migration receipts.

**Security:** No new absolute client paths; project ownership checks.

**Performance:** Bound inventory and imports; no automatic large asset loading.

**Tests:** Scene save/reopen/undo and migration retry preserve exact content; Two simultaneous scene saves conflict safely.

**Negative tests:** Truncated/duplicate/reparse/case alias/foreign IDs cannot overwrite originals.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-012 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Scene save/reopen/undo and migration retry preserve exact content; Evidence demonstrates: Two simultaneous scene saves conflict safely; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Restore pre-migration workspace; retained sidecars remain original.

## YU-013 — Move Director attempts and consent/revocations into existing SQLite

Phase 1; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: JSON read-modify-write state has no uniform CAS. User value: Reliable approvals and no consent resurrection.

- **Exact source:** `core/director/runtime.ts`, `core/director/stages.ts`, `core/identity.ts`, `core/store.ts`, `core/command/registry.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/director/runtime.ts`, `core/director/stages.ts`, `core/identity.ts`, `core/store.ts`, `core/command/registry.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/director/runtime.ts`, `core/store.ts`, `core/command/registry.ts`, NEW `tests/director-durability.test.ts`.
- **Dependencies:** YU-010.
- **Interfaces:** Versioned run CAS; approvals bind revision/proposal/output/expiry.
- **Data:** Run/attempt/security ledger tables; story data remains canonical documents.

**Implementation instructions**

1. Add run/version/stage attempt and append-only consent/revocation/encoding ledger tables in same DB.
2. Use receipts/CAS for every mutation; verify actual managed outputs instead of trusting hashes.
3. Map legacy runs by existing project IDs; restored consents require revalidation; integrate JobSupervisor references.

**Security:** Human-only grants,revocation monotonicity,immutable effects receipts.

**Performance:** Bound run history queries; no second queue or scheduler.

**Tests:** Concurrent advance/approve and lost-response replay retain one result; Revoke and dependent invalidation atomic; old project restore cannot un-revoke.

**Negative tests:** Missing output,stale approval,agent human-scope,revocation race refuse.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-013 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Concurrent advance/approve and lost-response replay retain one result; Evidence demonstrates: Revoke and dependent invalidation atomic; old project restore cannot un-revoke; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Restore verified DB backup under fail-closed consent policy; no permissive sidecar fallback.

## YU-014 — Prove complete creative backup/restore closure

Phase 1; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Backup currently DB+managed media only. User value: Recover complete film not only timeline.

- **Exact source:** `core/recovery.ts`, `core/store.ts`, `tests/backup.test.ts`, `tests/recovery.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/recovery.ts`, `core/store.ts`, `tests/backup.test.ts`, `tests/recovery.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/recovery.ts`, `tests/backup.test.ts`, `tests/recovery.test.ts`, NEW `tests/creative-recovery.test.ts`.
- **Dependencies:** YU-011, YU-012, YU-013.
- **Interfaces:** Version manifest to declare complete creative scope and limitations.
- **Data:** Backup manifest version; no second DB.

**Implementation instructions**

1. Derive backup refs from destination snapshot including all creative docs and nested media.
2. Seal security/run state with explicit restore/revalidation policy; retain backup pins/barrier invariants.
3. Add concurrent edit/import/GC and kill-seam restoration fixtures.

**Security:** No credentials exported; old artistic snapshot cannot restore authorization.

**Performance:** Measure barrier duration/bytes and restore latency on S/M; no weakened existing policy.

**Tests:** Canvas pixels,scene,story,run and revoked-consent state survive verified restore; Destination-snapshot closure stable during concurrent live edits.

**Negative tests:** Missing blob,corrupt doc,ENOSPC,junction,partial publication -> safe failure.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-014 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Canvas pixels,scene,story,run and revoked-consent state survive verified restore; Evidence demonstrates: Destination-snapshot closure stable during concurrent live edits; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep old backups readable with explicit incomplete-creative label; retain source workspace.

## YU-015 — Route browser editing through canonical operations and durable undo

Phase 1; P0; state **PLANNED**; resource **CAN BUILD NOW**; approach **ADAPT**.

Current: Local UI drafts/full save differ from per-writer DB undo. User value: Same edits through humans and agents.

- **Exact source:** `src/main.tsx`, `src/edit-ops.ts`, `src/adapter.ts`, `core/timeline/operations.ts`, `core/store.ts`, `sdk/client.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/OpenCut-app/opencut-classic @ `cf5e79e919144200294fb9fed22a222592a0aeea`; `apps/web/src/animation/interpolation.ts`, `apps/web/src/ripple/shift.ts`, `apps/web/src/timeline/snapping/resolve.ts`.
- **Targets:** `src/main.tsx`, `src/edit-ops.ts`, `sdk/client.ts`, `tests/parity.test.ts`, NEW `tests/browser-command-history.test.ts`.
- **Dependencies:** YU-010.
- **Interfaces:** Typed operation coverage and stable request IDs in browser.
- **Data:** No new authority; document history joins edit history.

**Implementation instructions**

1. Map each edit gesture to bounded existing/new typed operation; keep drag preview ephemeral.
2. Commit on gesture completion and reconcile server head; preserve unsaved draft UX during migration.
3. Use server writer-scoped undo/redo for committed edits; explicit conflict recovery, not overwrite.

**Security:** No bypass via project.save; scoped expected revision checked.

**Performance:** Candidate edit feedback/ack budgets in12; measure before optimize.

**Tests:** UI/CLI/MCP edit sequences yield equal canonical hashes; Undo after restart cannot undo another writer;100gestures produce expected receipts.

**Negative tests:** Lost response,replay mismatch,concurrent agent edit,crash mid-drag safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-015 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: UI/CLI/MCP edit sequences yield equal canonical hashes; Evidence demonstrates: Undo after restart cannot undo another writer;100gestures produce expected receipts; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Feature-gated migration can retain old draft workflow with honest limitations; no lost acknowledged edits.

## YU-016 — Generate bounded immutable waveform peak tiles

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **WRAP**.

Current: Browser fetches full media on revision changes. User value: Large media remains responsive.

- **Exact source:** `src/main.tsx`, `src/editor/components/Waveform.tsx`, `core/jobs.ts`, `core/media.ts`, `src/media/demux.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/FFmpeg/FFmpeg @ `1da057110ff19b7ea33273f9cf209b2c963cb3cf`; `fftools/ffmpeg_filter.c`, `libavfilter/af_loudnorm.c`. These inspected graph/audio entrypoints establish the wrapper boundary, not every proposed filter. Each new filter/codec kernel and actual binary/build closure must be inspected/qualified before use; current upstream pin does not prove bundled binary correspondence.
- **Targets:** `src/main.tsx`, `src/editor/components/Waveform.tsx`, `core/jobs.ts`, NEW `core/audio/peaks.ts`, NEW `tests/waveform-cache.test.ts`.
- **Dependencies:** YU-001.
- **Interfaces:** Read-only peak-tile API plus derivative job kind.
- **Data:** Derivative provenance/cache keys using existing jobs/store.

**Implementation instructions**

1. Key peak derivatives by asset hash/decode version/profile; generate with owned bounded worker.
2. Expose bounded tiles/ranges; abort superseded browser requests; reuse across edits.
3. Retain source and evict only rebuildable cache.

**Security:** Server-selected paths and quotas; hostile decoder under existing containment.

**Performance:** Browser RSS scales with visible tiles; bounded response bytes; record p95.

**Tests:** 100edits of same media cause no repeated full original fetch; Long file tile/zoom fidelity and peak extrema match reference.

**Negative tests:** Fetch timeout,cancel,invalid stream,cache corruption,ENOSPC safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-016 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: 100edits of same media cause no repeated full original fetch; Evidence demonstrates: Long file tile/zoom fidelity and peak extrema match reference; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Drop peak cache and use bounded placeholder; never delete originals.

## YU-017 — Add indexed thumbnails and proxy policy

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **WRAP**.

Current: CFR derivatives exist; general proxy workflow incomplete. User value: Smooth edit on ordinary Windows host.

- **Exact source:** `core/jobs.ts`, `core/media.ts`, `core/store.ts`, `src/editor/components/PreviewPlayer.tsx` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/FFmpeg/FFmpeg @ `1da057110ff19b7ea33273f9cf209b2c963cb3cf`; `fftools/ffmpeg_filter.c`, `libavfilter/af_loudnorm.c`. These inspected graph/audio entrypoints establish the wrapper boundary, not every proposed filter. Each new filter/codec kernel and actual binary/build closure must be inspected/qualified before use; current upstream pin does not prove bundled binary correspondence.
- **Targets:** `core/jobs.ts`, `core/store.ts`, `src/editor/components/PreviewPlayer.tsx`, NEW `core/media/proxies.ts`, NEW `tests/proxy-timing.test.ts`.
- **Dependencies:** YU-016.
- **Interfaces:** Proxy capability/profile/status and bounded thumbnail reads.
- **Data:** Derivative manifest/source-time mapping.

**Implementation instructions**

1. Reuse durable derivatives with source/profile/compiler keys; record exact sourcePTS mapping.
2. Select proxy for interactive preview; final/reference export resolves original/qualified CFR source.
3. Budget disk and request cancellation; immutable original retained.

**Security:** Cache GC cannot collect retained original or active derivative.

**Performance:** S/M playback and disk reserve measurements; no4K promise from thumbnail.

**Tests:** Proxy toggle preserves trims/PTS/audio and final render source; Restart completes or quarantines partial proxy.

**Negative tests:** Missing proxy,relinked wrong source,VFR rotation/corruption refuse misleading preview.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-017 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Proxy toggle preserves trims/PTS/audio and final render source; Evidence demonstrates: Restart completes or quarantines partial proxy; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable proxy selection; regenerate caches from retained source.

## YU-018 — Qualify preview cache/audio clock and visible parity subset

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Canvas and reference renderer differ. User value: Trust playback while editing.

- **Exact source:** `core/render/preview.ts`, `src/reference.tsx`, `src/editor/components/PreviewPlayer.tsx`, `scripts/qualify-playback.mjs` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/render/preview.ts`, `src/reference.tsx`, `src/editor/components/PreviewPlayer.tsx`, `scripts/qualify-playback.mjs`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/render/preview.ts`, `src/reference.tsx`, `src/editor/components/PreviewPlayer.tsx`, `scripts/qualify-playback.mjs`.
- **Dependencies:** YU-017, YU-015.
- **Interfaces:** Preview status/qualified effect subset metadata.
- **Data:** Cache key version only.

**Implementation instructions**

1. Key segment caches by full plan/assets/fonts/profile versions.
2. Cancel stale preview work and synchronize audio clock diagnostics.
3. Expose unsupported/stale parity explicitly; preserve reference-view access.

**Security:** Bound queue/cache bytes and owned worker lifetimes.

**Performance:** Preserve frozen still/segment/playback budgets; report frame drops.

**Tests:** Reference/interactive parity on supported fixtures; revision invalidates stale frame; Audio drift and minimum-window playback recorded under background export.

**Negative tests:** Rapid scrubs,cache eviction,cancel/restart,missing font show honest state.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-018 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Reference/interactive parity on supported fixtures; revision invalidates stale frame; Evidence demonstrates: Audio drift and minimum-window playback recorded under background export; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Revert optimization and evict new cache keys; keep reference path.

## YU-019 — Qualify rational project fps across view/edit/render

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Canonical rational core projects through30fps view. User value: Correct cinematic and broadcast timing.

- **Exact source:** `core/time.ts`, `core/canonical.ts`, `core/project.ts`, `core/render/plan.ts`, `src/adapter.ts`, `core/interchange/otio.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/time.ts`, `core/canonical.ts`, `core/project.ts`, `core/render/plan.ts`, `src/adapter.ts`, `core/interchange/otio.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/project.ts`, `core/canonical.ts`, `core/render/plan.ts`, `src/adapter.ts`, `core/time.ts`, `tests/time.test.ts`, `tests/otio.test.ts`.
- **Dependencies:** YU-015, YU-018.
- **Interfaces:** Versioned editing view/rate-aware commands and render profile.
- **Data:** Rate-aware view format migration; canonical v5 preserved.

**Implementation instructions**

1. Introduce24000/1001 profile first with explicit rounding at view boundary.
2. Audit every frame conversion,retime/trim/title/audio/output path with BigInt rational intermediates.
3. Retain old30fps projects exactly; expand other rates only by same qualification.

**Security:** Strict schema; no silent frame rounding or source reinterpretation.

**Performance:** No O(duration) arithmetic expansion; S/M baseline comparison.

**Tests:** Boundary frames at long timestamps and mixed source rates roundtrip; Video/audio duration and title cues match rational golden fixtures.

**Negative tests:** Unsafe integer,invalid rationals,unsupported rate or lossy old view refuse.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-019 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Boundary frames at long timestamps and mixed source rates roundtrip; Evidence demonstrates: Video/audio duration and title cues match rational golden fixtures; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Old projects remain supported; new unsupported-rate projects read-only in rollback.

## YU-020 — Implement a typed transform/crop effect with preview/export parity

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **WRAP**.

Current: Effects UI utilities are not canonical/export stack. User value: Reliable basic finishing.

- **Exact source:** `core/canonical.ts`, `core/render/plan.ts`, `core/render.ts`, `src/adapter.ts`, `src/editor/utils/effects.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/FFmpeg/FFmpeg @ `1da057110ff19b7ea33273f9cf209b2c963cb3cf`; `fftools/ffmpeg_filter.c`, `libavfilter/af_loudnorm.c`. These inspected graph/audio entrypoints establish the wrapper boundary, not every proposed filter. Each new filter/codec kernel and actual binary/build closure must be inspected/qualified before use; current upstream pin does not prove bundled binary correspondence.
- **Targets:** `core/canonical.ts`, `core/render/plan.ts`, `core/render.ts`, `src/adapter.ts`, NEW `core/effects/registry.ts`, NEW `tests/effect-parity.test.ts`.
- **Dependencies:** YU-019.
- **Interfaces:** Typed effect registry and clip effect operations.
- **Data:** Versioned clip effect stack; unsupported effect fail preflight.

**Implementation instructions**

1. Add bounded versioned transform/crop schema to canonical clip.
2. Compile same semantics to reference/export and qualified interactive subset.
3. Expose only supported controls and persistent undo; retain source notices.

**Security:** No raw filters/JS or user-selected filesystem path.

**Performance:** Bound effect count/filter complexity; S/M parity/latency.

**Tests:** Persist/undo/reopen/export transform matches golden ROIs; Preview identity/noop preserves old project output.

**Negative tests:** NaN/huge scale/unknown effect/ASS-filter injection refused.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-020 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Persist/undo/reopen/export transform matches golden ROIs; Evidence demonstrates: Preview identity/noop preserves old project output; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable new effect writes; preserve versioned read/preflight, never silently drop effects.

## YU-021 — Add one frame-exact crossfade transition

Phase 1; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **WRAP**.

Current: No qualified transition contract. User value: Polished cuts without hidden effects.

- **Exact source:** `core/timeline/operations.ts`, `core/render/plan.ts`, `core/render.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/FFmpeg/FFmpeg @ `1da057110ff19b7ea33273f9cf209b2c963cb3cf`; `fftools/ffmpeg_filter.c`, `libavfilter/af_loudnorm.c`. These inspected graph/audio entrypoints establish the wrapper boundary, not every proposed filter. Each new filter/codec kernel and actual binary/build closure must be inspected/qualified before use; current upstream pin does not prove bundled binary correspondence.
- **Targets:** `core/timeline/operations.ts`, `core/render/plan.ts`, `core/render.ts`, NEW `tests/transitions.test.ts`.
- **Dependencies:** YU-020.
- **Interfaces:** transition.set/remove typed commands.
- **Data:** Bounded transition refs between clips.

**Implementation instructions**

1. Define adjacency/overlap/source-handle semantics explicitly.
2. Compile one video dissolve and audio equal-power option under named policy.
3. Enforce exact duration and undo/reopen behavior.

**Security:** Finite enums/parameters; no arbitrary xfade expressions.

**Performance:** Compact filter graph and parity at supported rates.

**Tests:** Cut/dissolve boundaries and audio duration golden tests.

**Negative tests:** Insufficient handles,locked tracks,negative overlap,missing clip reject.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-021 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Cut/dissolve boundaries and audio duration golden tests; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Clear only through explicit undo or migration; rollback reader refuses unsupported transition.

## YU-022 — Replace frame-sized animation filter chains with bounded compilation

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **ADAPT**.

Current: Opacity/volume chain cost grows per frame. User value: Usable animated long clips.

- **Exact source:** `core/animation/interpolation.ts`, `core/render/animation-filters.ts`, `core/render/plan.ts`, `tests/animation-params.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/OpenCut-app/opencut-classic @ `cf5e79e919144200294fb9fed22a222592a0aeea`; `apps/web/src/animation/interpolation.ts`, `apps/web/src/ripple/shift.ts`, `apps/web/src/timeline/snapping/resolve.ts`.
- **Targets:** `core/render/animation-filters.ts`, `core/render/plan.ts`, `tests/animation-params.test.ts`, NEW `tests/animation-complexity.test.ts`.
- **Dependencies:** YU-019.
- **Interfaces:** Versioned animation compiler/profile capability.
- **Data:** No curve schema change unless explicit versioned migration.

**Implementation instructions**

1. Compile bounded piecewise curves or bounded segments with explicit tolerance.
2. Preserve exact hold/linear/Bezier semantics against current sampler.
3. Add transform channels only after020 parity and complexity gate.

**Security:** Generated expressions server-owned and bounded.

**Performance:** K profile filter size scales with keys/segments not frames; measure render startup/RSS.

**Tests:** Sampled curve/video/audio matches reference over keys,steps and ends.

**Negative tests:** Duplicate/nonfinite keys,oversized graph,unsupported channel fail early.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-022 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Sampled curve/video/audio matches reference over keys,steps and ends; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Retain old compiler for old bounded profiles and version receipts.

## YU-023 — Qualify SDR color metadata and bounded LUT import

Phase 1; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: No canonical color pipeline/LUT parity. User value: Predictable finishing colors.

- **Exact source:** `core/render/plan.ts`, `core/render.ts`, `src/editor/utils/lut.ts`, `src/editor/utils/colorGrading.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/render/plan.ts`, `core/render.ts`, `src/editor/utils/lut.ts`, `src/editor/utils/colorGrading.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/render/plan.ts`, `core/render.ts`, NEW `core/effects/color.ts`, NEW `tests/color-pipeline.test.ts`.
- **Dependencies:** YU-020.
- **Interfaces:** Typed color profile/LUT reference operations.
- **Data:** Color policy/version and immutable LUT object refs.

**Implementation instructions**

1. Freeze SDR Rec709/range/transfer/profile policy; metadata capture and explicit unsupported HDR refusal.
2. Add bounded parsed LUT asset format; no file references from LUT.
3. Compare test charts across reference/export/preview display path.

**Security:** Parser complexity limits and color/profile integrity.

**Performance:** Measure per-frame overhead and retain cache version keys.

**Tests:** Legal/full range and known color chart roundtrip within frozen tolerance.

**Negative tests:** Malformed/huge LUT,unknown transfer/HDR,external include refuses.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-023 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Legal/full range and known color chart roundtrip within frozen tolerance; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Revert to qualified SDR defaults; unsupported edits remain visible/read-only.

## YU-024 — Add editable imported caption tracks

Phase 1; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: ASS titles exist; subtitle editor/ASR absent. User value: Bilingual finishing without model inference.

- **Exact source:** `core/render/ass.ts`, `core/canonical.ts`, `src/i18n.ts`, `tests/typography.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/render/ass.ts`, `core/canonical.ts`, `src/i18n.ts`, `tests/typography.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/canonical.ts`, `core/render/ass.ts`, NEW `core/captions.ts`, NEW `src/editor/components/Captions.tsx`, NEW `tests/captions.test.ts`.
- **Dependencies:** YU-019, YU-015.
- **Interfaces:** Caption import/edit/split/export commands.
- **Data:** Versioned timed-text document/cue refs in canonical project.

**Implementation instructions**

1. Bound SRT/VTT parser into timed canonical cues; preserve original text/offsets.
2. Editable caption track and export/burn-in options through same typography path.
3. Native Arabic fixture packet independent of automated tests.

**Security:** Plain text escaping/fonts pinned; H1 required for language quality.

**Performance:** Bound cues and parser bytes; no full audio/model needed.

**Tests:** Cue times/escaping/mixed-script roundtrip and preview/export golden frames.

**Negative tests:** Malformed timestamps,huge cues,ASS markup/URL injection,overlap policy rejects.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-024 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Cue times/escaping/mixed-script roundtrip and preview/export golden frames; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep original subtitle asset and cue document; rollback read-only rather than drops.

## YU-025 — Implement verified relink and batch aspect/export variants

Phase 1; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Repair exists; polished relink/batch journey incomplete. User value: Finish deliverables without rebuilding edits.

- **Exact source:** `core/store.ts`, `core/jobs.ts`, `core/command/registry.ts`, `core/render/plan.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/store.ts`, `core/jobs.ts`, `core/command/registry.ts`, `core/render/plan.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/store.ts`, `core/jobs.ts`, `core/command/registry.ts`, NEW `tests/relink-variants.test.ts`.
- **Dependencies:** YU-014, YU-020.
- **Interfaces:** Relink proposal/apply and bounded exportBatch.
- **Data:** Source-replacement provenance and batch manifest refs.

**Implementation instructions**

1. Relink by hash/probe compatibility or explicit approved source replacement revision.
2. Freeze one plan/profile per batch variant; reuse source pins safely.
3. Show per-output errors,actual profiles and no success for partial batch.

**Security:** No client paths or silent original replacement.

**Performance:** Bound batch queue/disk; interactive latency under one active render.

**Tests:** Missing-media repair and three aspect variants reopen/re-export deterministically.

**Negative tests:** Same filename wrong bytes,partial relink,late cancel,ENOSPC safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-025 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Missing-media repair and three aspect variants reopen/re-export deterministically; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Undo source replacement; cancel batch leaves old exports and source untouched.

## YU-026 — Qualify scale profiles before raising project limits

Phase 1; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: 200clips/16tracks/10min/1080p output bounds. User value: Credible long/highres editing scope.

- **Exact source:** `core/command/policy.ts`, `core/qualification-policy.ts`, `core/project.ts`, `core/canonical.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/command/policy.ts`, `core/qualification-policy.ts`, `core/project.ts`, `core/canonical.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `scripts/qualify-editor-scale.mjs`, `core/command/policy.ts`, `core/project.ts`, `core/canonical.ts`.
- **Dependencies:** YU-018, YU-019, YU-022, YU-016.
- **Interfaces:** Named supported profile matrix.
- **Data:** Any limit expansion versioned,old bounds/history preserved.

**Implementation instructions**

1. Run S/M plus expected-refusal L/H/A/K profiles from12.
2. Measure full snapshots,history,UI virtualization,decode/cache/export and recovery costs.
3. Only propose a new reviewed policy/version once measured; do not simply increase limits.

**Security:** No weakening admission/worker caps to meet a benchmark.

**Performance:** Frozen candidate budgets selected before qualifying; include p95/RSS/disk.

**Tests:** Named profiles pass or refuse exactly; no hidden clamp; Backup/open/edit/restore under stress retain acknowledged state.

**Negative tests:** Oversized unsupported projects and exhausted disk fail safely.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-026 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Named profiles pass or refuse exactly; no hidden clamp; Evidence demonstrates: Backup/open/edit/restore under stress retain acknowledged state; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Revert profile availability; preserve new projects for safe read/explicit migration.

## YU-030 — Unify Story/Edit/Finish navigation and project selection

Phase 2; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Creative panels disconnected from full lifecycle. User value: Cohesive accessible workspace.

- **Exact source:** `src/main.tsx`, `src/style.css`, `src/editor/editor.css`, `src/director/DirectorPanel.tsx`, `src/studio/StudioCanvas.tsx` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `src/main.tsx`, `src/style.css`, `src/editor/editor.css`, `src/director/DirectorPanel.tsx`, `src/studio/StudioCanvas.tsx`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `src/main.tsx`, `src/style.css`, `src/director/DirectorPanel.tsx`, NEW `src/workspaces/ProjectShell.tsx`.
- **Dependencies:** YU-011, YU-012, YU-013, YU-015.
- **Interfaces:** Projection state only; commands unchanged.
- **Data:** Persist UI preference only,not another project model.

**Implementation instructions**

1. Implement11 workspace shell with shared project/selection/history/job tray.
2. Consolidate existing design tokens before new visual styling.
3. Contextual Studio/Cinema/Director/Quality tools; no duplicate project selector.

**Security:** No model/backend implementation details exposed as user-flow clutter.

**Performance:** No regression in current startup bundle/interaction fixtures.

**Tests:** Six journeys reach same project/assets; reload preserves selection policy; Keyboard/focus/RTL/zoom/error/empty states reviewed.

**Negative tests:** Unsaved/conflicted doc navigation cannot silently discard work.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-030 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Six journeys reach same project/assets; reload preserves selection policy; Evidence demonstrates: Keyboard/focus/RTL/zoom/error/empty states reviewed; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep prior shell behind bounded UI flag; canonical docs unchanged.

## YU-031 — Add story/shot/reference pack lifecycle

Phase 2; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Scenes/shots metadata exist; reusable packs incomplete. User value: Plan repeatable cinematic sequences.

- **Exact source:** `core/canonical.ts`, `core/identity.ts`, `core/director/manifest.ts`, `src/director/DirectorPanel.tsx` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/canonical.ts`, `core/identity.ts`, `core/director/manifest.ts`, `src/director/DirectorPanel.tsx`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/story.ts`, `src/director/DirectorPanel.tsx`, `core/command/registry.ts`, NEW `tests/story-packs.test.ts`.
- **Dependencies:** YU-010, YU-013, YU-030.
- **Interfaces:** story/shot/referencePack typed commands.
- **Data:** Story document schema and pack versions.

**Implementation instructions**

1. Persist story document with stable scene/shot/take IDs and timings.
2. Reference packs use role-tagged immutable media versions and purpose/consent links.
3. Manual storyboard works with imported stills/footage and unavailable generator.

**Security:** Security ledger separate from artistic undo; no claim of identity fidelity.

**Performance:** Bound shot/ref counts and payload bytes.

**Tests:** Three-shot manual storyboard->timeline->reopen preserves refs and timings.

**Negative tests:** Missing media,revoked consent,duplicate IDs or unsupported refs refuse.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-031 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Three-shot manual storyboard->timeline->reopen preserves refs and timings; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Retain story documents and existing scenes; new writes can be disabled.

## YU-032 — Implement non-destructive take compare/replace

Phase 2; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: No coherent take-to-timeline revision workflow. User value: Revise one shot without losing edit.

- **Exact source:** `core/timeline/operations.ts`, `core/store.ts`, `core/quality/lab.ts`, `src/adapter.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/timeline/operations.ts`, `core/store.ts`, `core/quality/lab.ts`, `src/adapter.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/takes.ts`, `core/timeline/operations.ts`, `core/command/registry.ts`, NEW `tests/take-replace.test.ts`.
- **Dependencies:** YU-031, YU-020, YU-002.
- **Interfaces:** take.list/compare/proposeReplace/apply.
- **Data:** Take/version refs in story doc.

**Implementation instructions**

1. Store alternative take metadata and immutable input/output lineage.
2. Compare takes without mutating timeline; propose exact replacement clip mappings.
3. Apply one revision-bound batch preserving original takes and unrelated clips.

**Security:** Output probes and expected revision required before attach.

**Performance:** Comparison thumbnails/proxies bounded,not full originals.

**Tests:** Replace one of three shots; unrelated project bytes/semantics preserved; Undo/reopen returns exact old take.

**Negative tests:** Stale proposal,wrong duration/missing artifact,revoked ref refuse.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-032 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Replace one of three shots; unrelated project bytes/semantics preserved; Evidence demonstrates: Undo/reopen returns exact old take; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Undo creates new revision; old media remains rooted.

## YU-040 — Introduce operation-based EngineAdapter v2 with artifact handles

Phase 3; P1; state **PLANNED**; resource **CAN QUALIFY WITHOUT WEIGHTS**; approach **BUILD**.

Current: v1 graph/class_type and whole byte arrays. User value: Portable future local/hosted/Plume integration.

- **Exact source:** `core/engines/contract.ts`, `core/engines/fake.ts`, `core/jobs.ts`, `tests/engines.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/engines/contract.ts`, `core/engines/fake.ts`, `core/jobs.ts`, `tests/engines.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/engines/contract-v2.ts`, NEW `core/engines/v1-bridge.ts`, `core/engines/fake.ts`, `tests/engines.test.ts`.
- **Dependencies:** YU-010, YU-003.
- **Interfaces:** EngineAdapter/v2 plus reason codes,reconcile/artifact observations.
- **Data:** Immutable recipe/model/qualification manifest refs; no second scheduler.

**Implementation instructions**

1. Implement strict per-operation schema/capability constraints from10.
2. Keep v1 fake compatibility via server-owned recipe lowering only.
3. Stream/handle media; durable service owns job/attempt/cancel publication.

**Security:** No real engines enabled; schema validation before resource access.

**Performance:** Bound control frame/diagnostics and avoid media-sized arrays.

**Tests:** Fake/absent/v1 parity and bounded handle IO; Unsupported controls fail before spawn.

**Negative tests:** Raw graph,URL,path,class/plugin input,stale attempt reject.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-040 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Fake/absent/v1 parity and bounded handle IO; Evidence demonstrates: Unsupported controls fail before spawn; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep v1 reader/fake tests; disable v2 routes without data loss.

## YU-041 — Qualify new worker profile using no-model stand-ins

Phase 3; P1; state **PLANNED**; resource **CAN QUALIFY WITHOUT WEIGHTS**; approach **BUILD**.

Current: Existing single-process policy not Python tree proof. User value: Safe future media/engine workers.

- **Exact source:** `native/procd/src/main.rs`, `native/procd/src/container.rs`, `core/process/owner.ts`, `tests/containment.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `native/procd/src/main.rs`, `native/procd/src/container.rs`, `core/process/owner.ts`, `tests/containment.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `native/procd/src/main.rs`, `native/procd/src/container.rs`, `core/process/owner.ts`, NEW `tests/engine-worker-profile.test.ts`.
- **Dependencies:** YU-040, YU-001.
- **Interfaces:** Versioned process profile/hash requested by job policy.
- **Data:** No project schema change.

**Implementation instructions**

1. Specify allowed descendant/process/GPU needs before changing limits.
2. Use stand-in child tree for owned spawn/cancel/death/publication seams.
3. Test actual Windows file/network/handle escape negatives and cleanup; fail closed if unsupported.

**Security:** Independent security/native FFI review mandatory; no privilege relaxation fallback.

**Performance:** Enforce declared memory/wall/process/disk/diagnostic budgets.

**Tests:** Service/helper/worker death leaves no live/suspended orphan; Read sentinels and outbound DNS/TCP/HTTP denied on target profile.

**Negative tests:** WMI/task scheduler/foreign file/junction/inherited handle/AV lock fail safely.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-041 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Service/helper/worker death leaves no live/suspended orphan; Evidence demonstrates: Read sentinels and outbound DNS/TCP/HTTP denied on target profile; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable new profile and retain existing FFmpeg profile; quarantine incomplete attempts.

## YU-042 — Prove missing-weights and qualification discovery without downloads

Phase 3; P1; state **PLANNED**; resource **CAN QUALIFY WITHOUT WEIGHTS**; approach **BUILD**.

Current: Absent capability exists only at scaffold. User value: Honest no-engine experience.

- **Exact source:** `core/engines/contract.ts`, `core/router/explain.ts`, `core/command/registry.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/engines/contract.ts`, `core/router/explain.ts`, `core/command/registry.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/engines/manifests.ts`, `core/router/explain.ts`, NEW `tests/engine-absence.test.ts`.
- **Dependencies:** YU-040, YU-041.
- **Interfaces:** Operation capability discovery with version/qualification expiry.
- **Data:** Manifest schema only.

**Implementation instructions**

1. Discover only pinned local manifest metadata with byte/hash/rights checks.
2. Return WEIGHTS_ABSENT/HARDWARE_UNQUALIFIED/ENGINE_DISABLED distinctly.
3. No import/install/network fallback; wire plain user reason into operation UI.

**Security:** OS offline boundary plus no-download code path; flags unchanged.

**Performance:** Bound manifest IO and no recursive large scans.

**Tests:** Absent/corrupt files refuse before inference; offline editor remains usable.

**Negative tests:** HF/pip/update attempt,unapproved model path/symlink/hash mismatch denied.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-042 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Absent/corrupt files refuse before inference; offline editor remains usable; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable discovery; engineAbsentCapability remains safe fallback.

## YU-043 — Close first-engine source/runtime manifest and qualification choice

Phase 3; P2; state **PLANNED**; resource **CAN QUALIFY WITHOUT WEIGHTS**; approach **BUILD**.

Current: Some native model repos discovery-only; no executed bake-off. User value: Avoid backend lock-in and unsupported resource promises.

- **Exact source:** `core/engines/contract.ts`, `docs/provenance/import-policy.json` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/engines/contract.ts`, `docs/provenance/import-policy.json`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/engine-candidate-manifests.json`.
- **Dependencies:** YU-042.
- **Interfaces:** Versioned recipe and qualification manifest design.
- **Data:** No runtime model install.

**Implementation instructions**

1. Source-inspect exact native CLI/pipeline/model loading closure for finalist candidates,not README-only.
2. Freeze interpreter/package/model dependency manifests and safe loading policy; no weights.
3. Predeclare same-operation comparison and resource/rights criteria; choose no winner before evidence.

**Security:** Dependency review,model loading format,egress and provenance audit.

**Performance:** Actual hardware/model resource demand UNKNOWN until authorized run.

**Tests:** All selected source paths/pins/licenses/transitive closure validated; Document unsupported controls and cancellation semantics.

**Negative tests:** Mutable revision,missing license,remote-code download or undefined requirements blocks selection.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-043 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: All selected source paths/pins/licenses/transitive closure validated; Evidence demonstrates: Document unsupported controls and cancellation semantics; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Retain candidate records; no production dependency to roll back.

## YU-050 — Compile cinematic intent to explicitly supported conditioning

Phase 4; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Camera/lens metadata is not applied model control. User value: Honest controllable shot requests.

- **Exact source:** `core/scene3d.ts`, `src/cinema/camera/cameraMath.ts`, `core/canonical.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/scene3d.ts`, `src/cinema/camera/cameraMath.ts`, `core/canonical.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/cinema/control-compiler.ts`, `core/command/registry.ts`, NEW `tests/control-compiler.test.ts`.
- **Dependencies:** YU-031, YU-040.
- **Interfaces:** Versioned controls compiler/capability report.
- **Data:** Shot control refs/qualification evidence.

**Implementation instructions**

1. Define camera/light/lens/motion intent schema and recipe-specific lowering.
2. Record intentHash/loweredControlsHash and unsupported/approximate controls.
3. Keep previs as editable metadata; no applied optics claim without E evaluation.

**Security:** No executable expressions or arbitrary model nodes.

**Performance:** Bound trajectory samples and ref preprocessing budgets.

**Tests:** Supported fake recipe maps deterministically with provenance.

**Negative tests:** Unsupported depth/pose/end-frame cannot silently become prompt suffix.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-050 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Supported fake recipe maps deterministically with provenance; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Retain intent; disable specific compiler recipe without changing shots.

## YU-051 — Version continuity references and consent checks at attempt/attach

Phase 4; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Identity encoding hashes not fidelity proof. User value: Reusable subjects/scenes with traceable revisions.

- **Exact source:** `core/identity.ts`, `core/director/stages.ts`, `core/command/registry.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/identity.ts`, `core/director/stages.ts`, `core/command/registry.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/continuity.ts`, `core/command/registry.ts`, NEW `tests/continuity-consent.test.ts`.
- **Dependencies:** YU-031, YU-013, YU-040.
- **Interfaces:** Continuity pack references and per-stage consent validation.
- **Data:** Pack/consent links and immutable attempt references.

**Implementation instructions**

1. Bind character/environment/voice references to immutable pack versions.
2. Validate purpose/expiry/revocation before submission and attachment.
3. Separate metadata validity from measured continuity score.

**Security:** Sensitive reference retention and non-undoable revocation.

**Performance:** Bound reference count/bytes by exact operation capability.

**Tests:** Pack update leaves old takes traceable; revoked grant blocks new effect.

**Negative tests:** Revocation race,foreign refs,forged encodingHash,old approval fail.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-051 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Pack update leaves old takes traceable; revoked grant blocks new effect; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable new use; retain authorized historical artifact records under retention policy.

## YU-060 — Add revision-bound creative proposals with human review

Phase 5; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Manual stage approvals lack full action-list proposal. User value: Supervise agents without hidden edits.

- **Exact source:** `core/command/registry.ts`, `core/director/stages.ts`, `core/store.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/command/registry.ts`, `core/director/stages.ts`, `core/store.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `core/proposals.ts`, `core/command/registry.ts`, NEW `tests/proposals.test.ts`.
- **Dependencies:** YU-015, YU-013, YU-032.
- **Interfaces:** proposal.create/get/apply and human approval integration.
- **Data:** Proposal/approval receipts in same DB.

**Implementation instructions**

1. Hash bounded operation list,baseRevision,assets,scope,cost intent and expiry.
2. Reuse browser human-only grant boundary for restricted approvals.
3. Apply approved batch exactly once with current revision check.

**Security:** Prompt content never grants scope; changed plan invalidates approval.

**Performance:** Bound op count/bytes and no expensive work inside transaction.

**Tests:** Approved exact plan applies once; UI/MCP see same result.

**Negative tests:** Changed op/hash,stale revision,expired grant,agent approval/cost widening refused.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-060 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Approved exact plan applies once; UI/MCP see same result; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Expire/disable pending proposals; committed edits undone by normal revisions.

## YU-061 — Execute resumable three-shot imported-media production

Phase 5; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Director manual receipts only; no real executor. User value: Complete editable project without inference.

- **Exact source:** `core/director/runtime.ts`, `core/jobs.ts`, `core/director/manifest.ts`, `core/flow/snapshot.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/director/runtime.ts`, `core/jobs.ts`, `core/director/manifest.ts`, `core/flow/snapshot.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `core/director/runtime.ts`, `core/jobs.ts`, `core/flow/snapshot.ts`, NEW `tests/agent-production.test.ts`.
- **Dependencies:** YU-060, YU-014, YU-031.
- **Interfaces:** workflow.start/status/resume/cancel using existing command boundary.
- **Data:** Run attempts/job refs; no competing scheduler.

**Implementation instructions**

1. Map approved manual/import stages to existing jobs and registered artifact validation.
2. Persist command intent/result per stage attempt; checkpoint after committed effects.
3. Interrupt/restart at every stage; revise one shot and export through canonical path.

**Security:** No arbitrary tools/code or automatic paid/model step.

**Performance:** Finite stages/tool/attempt/wall limits and bounded queue.

**Tests:** Three-shot storyboard->editable timeline->export->backup->restore succeeds; Resume never duplicates clips/assets/approval/effect.

**Negative tests:** Missing artifact,forged completion,stale lease,cancel/publication race safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-061 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Three-shot storyboard->editable timeline->export->backup->restore succeeds; Evidence demonstrates: Resume never duplicates clips/assets/approval/effect; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Stop new runs; retain committed stages/outputs and normal edit history.

## YU-062 — Expose stable request IDs and progress parity across transports

Phase 5; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: CLI/SDK progress and cancellation semantics incomplete. User value: Reliable external agent automation.

- **Exact source:** `cli/main.ts`, `sdk/client.ts`, `mcp/main.ts`, `server/main.ts`, `tests/parity.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `cli/main.ts`, `sdk/client.ts`, `mcp/main.ts`, `server/main.ts`, `tests/parity.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `cli/main.ts`, `sdk/client.ts`, `mcp/main.ts`, `server/main.ts`, `tests/parity.test.ts`.
- **Dependencies:** YU-003, YU-060, YU-061.
- **Interfaces:** Versioned request/progress transport additions.
- **Data:** Existing outbox retention policy only.

**Implementation instructions**

1. Add CLI stable requestId JSON option and bounded SDK streaming/progress cursor.
2. Resume committed outbox/job events; explicit resync for expired cursors.
3. Distinguish wait cancellation from job cancel; same schemas/scopes on all clients.

**Security:** No transport can invent principal/human approval or read foreign project.

**Performance:** Bound frame/event/response/concurrency bytes.

**Tests:** Equivalent workflow commands yield canonical parity and reconnect progress.

**Negative tests:** Lost response,duplicate request,multi-byte frame,revoked token,expired cursor safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-062 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Equivalent workflow commands yield canonical parity and reconnect progress; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Backward-compatible clients can poll existing status; no new daemon.

## YU-070 — Qualify transcription contract/native stand-in before weights

Phase 6; P2; state **PLANNED**; resource **CAN QUALIFY WITHOUT WEIGHTS**; approach **WRAP**.

Current: No ASR; captions import can work now. User value: Future local bilingual transcript editing.

- **Exact source:** `core/media.ts`, `core/process/owner.ts`, `core/jobs.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/ggml-org/whisper.cpp @ `231638a0717b7822784297e5980965ffcec05810`; `examples/cli/cli.cpp`, `src/whisper.cpp`.
- **Targets:** NEW `core/audio/transcription.ts`, NEW `tests/transcription-contract.test.ts`.
- **Dependencies:** YU-024, YU-041, YU-042.
- **Interfaces:** transcribe operation and reviewable caption proposal.
- **Data:** Transcript derivative/document with model/version/language provenance.

**Implementation instructions**

1. Wrap bounded PCM extraction and transcript artifact schema/timestamps.
2. Inspect pinned whisper.cpp CLI output/closure before worker implementation; no weight download.
3. Stand-in tests propose caption edits,never claim actual recognition.

**Security:** No arbitrary CLI paths; consent/retention and decoder containment.

**Performance:** Bound chunks/PCM/staging; real CPU accuracy/latency UNKNOWN.

**Tests:** Stub word/cue timestamps roundtrip into editable captions.

**Negative tests:** Missing weights,unsupported language,malformed segments,no speech/huge audio safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-070 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Stub word/cue timestamps roundtrip into editable captions; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable ASR capability; imported captions remain fully functional.

## YU-071 — Qualify deterministic repair/analysis operations

Phase 6; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **WRAP**.

Current: No registered stabilization/scene detection workers. User value: Useful no-model footage assistance.

- **Exact source:** `core/media.ts`, `core/jobs.ts`, `core/render.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/FFmpeg/FFmpeg @ `1da057110ff19b7ea33273f9cf209b2c963cb3cf`; `fftools/ffmpeg_filter.c`, `libavfilter/af_loudnorm.c`. These inspected graph/audio entrypoints establish the wrapper boundary, not every proposed filter. Each new filter/codec kernel and actual binary/build closure must be inspected/qualified before use; current upstream pin does not prove bundled binary correspondence.
- **Targets:** NEW `core/media/repair.ts`, `core/jobs.ts`, NEW `tests/media-repair.test.ts`.
- **Dependencies:** YU-017, YU-040.
- **Interfaces:** One typed repair operation/capability.
- **Data:** Immutable derivative and operation recipe refs.

**Implementation instructions**

1. Source-inspect bounded FFmpeg scene-detect/denoise/stabilize feature closure and actual binary support.
2. Select one deterministic operation first and preserve source/PTS/audio.
3. Compare full output and derivative provenance; no neural restoration claim.

**Security:** Server-owned filter args only; plugin/filter support pinned.

**Performance:** Bound wall/memory/disk and record quality vs unchanged baseline.

**Tests:** Output decodes and preserves declared timing/audio/source; scene marks reference exact frames.

**Negative tests:** Unsupported filter,hostile stream,cancel/OOM/partial output quarantine.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-071 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Output decodes and preserves declared timing/audio/source; scene marks reference exact frames; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable repair route and retain original/take.

## YU-072 — Qualify neural enhancement/interpolation source and weights later

Phase 6; P2; state **BLOCKED**; resource **REQUIRES EXTERNAL AUTHORIZATION**; approach **BUILD**.

Current: Source inspected hazards; no model entitlement/runtime. User value: Avoid unsafe CLI transplants.

- **Exact source:** `core/engines/contract.ts`, `core/jobs.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/engines/contract.ts`, `core/jobs.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/neural-repair-qualification.json`.
- **Dependencies:** YU-043, YU-019, YU-071.
- **Interfaces:** Future enhance/interpolate operations stay unavailable.
- **Data:** Qualification manifest only until approved.

**Implementation instructions**

1. Choose one RealESRGAN/RIFE candidate only after exact checkpoint/runtime rights/resources.
2. Exclude upstream shell/shared-temp/auto-download/pickle orchestration; use owned decode and frame-pair/tile kernel.
3. Run complete clip timing/flicker/hallucination comparison only when separately authorized.

**Security:** Safe loading/supply chain,artifact validation,independent security review.

**Performance:** Requires measured hardware/RAM/disk; no presumed free GPU.

**Tests:** Authorized full-clip temporal/audio/quality and cancellation evidence retained.

**Negative tests:** Scene cut,subtitle/face hallucination,frame count drift,OOM/timeout safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-072 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Authorized full-clip temporal/audio/quality and cancellation evidence retained; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep route disabled; retain original and test evidence.

## YU-080 — Produce portable creative project with explicit interchange loss

Phase 7; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **WRAP**.

Current: OTIO subset and recovery not full portable creative export. User value: Own and transfer complete work.

- **Exact source:** `core/interchange/otio.ts`, `core/recovery.ts`, `core/store.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/AcademySoftwareFoundation/OpenTimelineIO @ `eee67fdcdce388696e39f4176d89a61ee9fdc790`; `src/opentime/rationalTime.h`, `src/py-opentimelineio/opentimelineio/adapters/otio_json.py`.
- **Targets:** `core/interchange/otio.ts`, NEW `core/interchange/portable.ts`, NEW `tests/portable-project.test.ts`.
- **Dependencies:** YU-014, YU-025, YU-031.
- **Interfaces:** portable export/inspect/import;OTIO loss report.
- **Data:** Versioned portable bundle manifest.

**Implementation instructions**

1. Export canonical docs+media+hash manifest without credentials/host paths.
2. OTIO export/import supports declared subset and a per-feature loss report.
3. Traversal/case/symlink/expansion-safe import creates separate new project proposal.

**Security:** No archive authority over scopes/consents/paths or plugin execution.

**Performance:** Streaming bounds and disk reservation before extraction.

**Tests:** Complete project roundtrip including Studio/story/media and revoked-consent revalidation policy.

**Negative tests:** Zip slip/case collision/decompression bomb/missing blob/unknown version safe.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-080 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Complete project roundtrip including Studio/story/media and revoked-consent revalidation policy; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep source project/backup; imported project is separate.

## YU-081 — Evaluate selective revision as a complete product advantage

Phase 7; P2; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Take replacements and agent journey unqualified. User value: Potential measurable differentiation.

- **Exact source:** `core/quality/lab.ts`, `core/director/runtime.ts`, `core/timeline/operations.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/quality/lab.ts`, `core/director/runtime.ts`, `core/timeline/operations.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `scripts/qualify-selective-revision.mjs`, NEW `docs/evidence/ultimate/selective-revision.json`.
- **Dependencies:** YU-032, YU-061, YU-080.
- **Interfaces:** Evaluation receipts only.
- **Data:** No new product authority.

**Implementation instructions**

1. Freeze brief with three shots and change request for exactly one.
2. Measure edits/interventions/retries/cost and unchanged project regions.
3. Compare to legitimately accessible workflows only; label no comparator NOT TESTED.

**Security:** Human review/input rights and secret-free artifacts.

**Performance:** Record total finished-task time/resource/cost; no invented speedup.

**Tests:** Selective revision preserves unrelated clips/docs and remains editable/restorable.

**Negative tests:** Agent changes unrelated shot,missing reference,unapproved inference fails task.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-081 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Selective revision preserves unrelated clips/docs and remains editable/restorable; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Remove evaluation-only harness; retain immutable evidence.

## YU-090 — Build benchmark recording and analysis harness without outputs

Phase 8; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Only plan/summary exists; no scientific comparative runner. User value: Reproducible later claims.

- **Exact source:** `core/quality/lab.ts`, `scripts/benchmark-production.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/quality/lab.ts`, `scripts/benchmark-production.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `scripts/benchmark-ultimate.mjs`, NEW `docs/evidence/ultimate/benchmark-protocol.json`.
- **Dependencies:** YU-002, YU-000.
- **Interfaces:** Benchmark evidence/analysis schema.
- **Data:** Versioned protocol and retained raw observations.

**Implementation instructions**

1. Freeze A–L tasks/versions/cost/failure/rater schema from16.
2. Use synthetic records to validate blinding/randomization and clustered analyses.
3. Report NOT TESTED for empty cohort; no automatic provider/model call.

**Security:** Consent/privacy retention and no provider key capture.

**Performance:** Bound analysis data; full GPU evaluators remain absent.

**Tests:** Synthetic known results recompute and repeated prompt/rater clustering respected.

**Negative tests:** Missing trials,retries removed,duplicate raters,modality mixing blocks win label.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-090 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Synthetic known results recompute and repeated prompt/rater clustering respected; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep old summary readable; published outcomes immutable.

## YU-091 — Run affected Windows editor/recovery/performance qualification

Phase 8; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Historical fixtures not exact new-head qualification. User value: Evidence for actual claimed profile.

- **Exact source:** `scripts/qualify-release.ts`, `scripts/qualify-preview.ts`, `scripts/qualify-playback.mjs`, `tests/interruption.test.ts` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `scripts/qualify-release.ts`, `scripts/qualify-preview.ts`, `scripts/qualify-playback.mjs`, `tests/interruption.test.ts`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/windows-qualification.json`.
- **Dependencies:** YU-026, YU-014, YU-030, YU-024, YU-025, YU-062, YU-090.
- **Interfaces:** Artifact-bound capability manifest updates.
- **Data:** No schema change.

**Implementation instructions**

1. Run approved S/M and any newly supported profiles with full receipts.
2. Inject kill/cancel/sharing-lock/cache/disk faults; retain failed cases.
3. Independent correctness/native security review of changed contracts before promotion.

**Security:** No placeholder Windows/model/human gate results.

**Performance:** Frozen policy budgets and complete resource observations.

**Tests:** All claimed editing/recovery/profile gates execute and pass or explicitly block.

**Negative tests:** Unsupported profile never reported passed; real disk/account tests not mocked.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-091 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: All claimed editing/recovery/profile gates execute and pass or explicitly block; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Disable unqualified capabilities; retain last verified artifact.

## YU-092 — Run real engine and comparative A/V quality qualification only with F

Phase 8; P2; state **BLOCKED**; resource **REQUIRES CAPABLE GPU**; approach **BUILD**.

Current: No weights/GPU/budget/entitlement authorized. User value: Evidence of actual generation capability.

- **Exact source:** `core/engines/contract.ts`, `docs/FOUNDER_DECISION_RECORD.md` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `core/engines/contract.ts`, `docs/FOUNDER_DECISION_RECORD.md`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/engine-benchmark.json`.
- **Dependencies:** YU-043, YU-050, YU-051, YU-090, YU-041.
- **Interfaces:** Qualification hash/capability promotion proposal only.
- **Data:** Engine/model qualification record.

**Implementation instructions**

1. Require F and exact capable host/model/runtime/terms plus E-SEC.
2. Run three-seed operational smoke then powered B–G/K/L as separately budgeted.
3. Retain all attempts/charges; do not call smoke quality superiority.

**Security:** Independent E-SEC; no enablement from docs or d1.

**Performance:** Preapproved actual hardware/disk/cost limits.

**Tests:** Actual complete-clip probe/quality/resource/cancel/recovery results retained.

**Negative tests:** OOM/no weights/late output/unapproved spend/identity drift handled.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-092 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Actual complete-clip probe/quality/resource/cancel/recovery results retained; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep engine disabled and preserve offline editing.

## YU-093 — Perform native Arabic and product usability evaluation

Phase 8; P1; state **BLOCKED**; resource **REQUIRES EXTERNAL AUTHORIZATION**; approach **BUILD**.

Current: Automated RTL only; no actual human study. User value: Trust bilingual workflows and simplify product.

- **Exact source:** `src/i18n.ts`, `core/render/ass.ts`, `docs/evidence/qualification/windows-ux-qa-final-report.md` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `src/i18n.ts`, `core/render/ass.ts`, `docs/evidence/qualification/windows-ux-qa-final-report.md`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/ux-native-review.md`.
- **Dependencies:** YU-030, YU-024, YU-081, YU-090.
- **Interfaces:** Reviewed UX/language acceptance packet.
- **Data:** No product schema change.

**Implementation instructions**

1. Use qualified native Arabic reviewer and consented formative cohort.
2. Run six journeys and shaping/audio fixtures on exact artifact.
3. Record failures and measured sample limits; no invented independent participants.

**Security:** Consent/participant privacy; no sensitive captures in public repo.

**Performance:** Task timing and error observations with uncertainty.

**Tests:** H1 scoped review and accessible journeys signed by actual reviewers.

**Negative tests:** Wrong bidi/diacritics/clipping/pronunciation/keyboard traps block affected claim.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-093 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: H1 scoped review and accessible journeys signed by actual reviewers; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep unresolved claims unavailable and preserve report.

## YU-100 — Collect exact-artifact release gates without shipping

Phase 9; P1; state **PLANNED**; resource **CAN BUILD NOW**; approach **BUILD**.

Current: Release NO-GO; historical RC only. User value: Concrete reviewable release decision packet.

- **Exact source:** `scripts/qualify-release.ts`, `scripts/qualify-release-evidence.ts`, `scripts/bundle.ts`, `docs/RELEASE_PROPOSAL.md` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `scripts/qualify-release.ts`, `scripts/qualify-release-evidence.ts`, `scripts/bundle.ts`, `docs/RELEASE_PROPOSAL.md`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** `scripts/qualify-release-evidence.ts`, NEW `docs/evidence/ultimate/release-readiness.json`.
- **Dependencies:** YU-091, YU-093.
- **Interfaces:** Release report schema only.
- **Data:** No schema change.

**Implementation instructions**

1. Bind all receipts to exact candidate/native/font/bundle hashes.
2. Collect H1–H5/signing/ProfileA/E-SEC/F applicability without fabricating status.
3. Public release remains blocked until separate founder artifact decision.

**Security:** Never prints credentials or activates engines to collect evidence.

**Performance:** Collector metadata bounded; no automatic signing/deploy.

**Tests:** Missing/stale/failed gate makes NO-GO; signed-off scope verifiable.

**Negative tests:** Docs CI or stub receipt cannot count as human/OS/model pass.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-100 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Missing/stale/failed gate makes NO-GO; signed-off scope verifiable; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep last known verified package and NO-GO report.

## YU-101 — Execute external clean-profile/account/disk/signing/founder gates

Phase 9; P1; state **BLOCKED**; resource **REQUIRES EXTERNAL AUTHORIZATION**; approach **BUILD**.

Current: H2–H5/AuthentiCode open. User value: Legitimate Windows release readiness.

- **Exact source:** `docs/RELEASE_PROPOSAL.md`, `docs/plans/P10-qualification-activation/RELEASE_GATE_MATRIX.md` at baseline above. Function/call-graph context: audit01 and donor08.
- **Donor:** https://github.com/TheHalfMoon/Yamakan @ `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; `docs/RELEASE_PROPOSAL.md`, `docs/plans/P10-qualification-activation/RELEASE_GATE_MATRIX.md`. Extend existing first-party infrastructure; existing donor notices remain binding.
- **Targets:** NEW `docs/evidence/ultimate/external-release-gates.json`.
- **Dependencies:** YU-100.
- **Interfaces:** No new API.
- **Data:** No schema change.

**Implementation instructions**

1. Obtain exact artifact-scoped administrator/reviewer/founder actions.
2. Run actual ProfileA/offline/second-account/constrained-volume/install-update-rollback tests.
3. Signing costs and public release need separate authorization; do not ship automatically.

**Security:** Independent security and founder ship approval.

**Performance:** Existing frozen release budgets.

**Tests:** Actual H2–H5 and applicable signing/update receipts bound to same artifact.

**Negative tests:** Unsigned/wrong head/reused account/mock ENOSPC cannot close gate.

**Required evidence:** Exact implementation commit/tree and clean status; source/donor/runtime/fixture hashes; Command logs and actual test outcomes including failures/skips; A YU-101 receipt linking code, tests, review identities and Windows/profile limitations.

**Review gates:** Fresh-context correctness/parsimony/product review over immutable implementation diff; Independent security review for changed boundary; d1 advisory cannot satisfy it.

**Merge conditions:** Separately authorized implementation scope; dependencies VERIFIED; Required targeted and repository gates pass on exact head; no unresolved must-fix; Donor provenance/import guard passes; flags stay off unless separately qualified; Normal bounded PR; no force push or implied model/spend/release authority.

**Definition of done:** Evidence demonstrates: Actual H2–H5 and applicable signing/update receipts bound to same artifact; Negative tests fail safely as specified; Review findings resolved; affected Windows E2E and post-merge verification retained.

**Rollback:** Keep NO-GO; preserve unsigned RC and prior installer rollback.

