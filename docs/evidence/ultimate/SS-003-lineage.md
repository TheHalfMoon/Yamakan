# SS-003: Director dependency invalidation

Date: 2026-10-29. Base: `b87f372` (includes reviewed SS-001). Status: implemented and mechanically checked; independent review and landing belong to the parent orchestrator.

## Source-first decision

**ADAPT the exact-base principle, not the donor architecture.** Read the local source specimens from `CanadaApollo6/Kinewright` at `0b353397845c52fba9c34bfd64700d381ce721cb` before implementation:

| Source path                                                | SHA-256                                                            | Relevant contract                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crates/kinewright-agent/src/durable_branch.rs`            | `203b8a0608fbffcd5c63e5ef593c81f7423c7e9a703f88db49959d455cf12f49` | Reopen verifies the frozen checkpoint's branch/head/document hash; `bind` refuses a changed durable base. `merge` checks the original receipt before rebinding for idempotent replay. |
| `crates/kinewright-project/src/editing_session/durable.rs` | `6c0492a73390d6f98b65db644ceb1b6ca3891f62e9c4afb73f7a047fed20ab56` | `BranchBinding` carries exact durable identity; `FrozenTaskResult` retains base/source bindings. Runtime revision alone is insufficient.                                              |

The existing OpenMontage-derived ordered prerequisite rule in `core/director/stages.ts` treats every earlier stage as a predecessor. Yamakan already records ordered advance/approve events in its one canonical SQLite database. Selecting the latest event per stage discarded the dependency relationship: after research A, script A and timeline A completed, replacing and approving research B still reported the whole run done.

Adaptation is a conservative fold of the existing ordered attempts. Every live advance invalidates already-seen later stages, including when it only starts work or reports failure. An approval event never clears invalidation; only a new advance of that stage can do so. Invalidated receipts expose pending/no output/no approval, while every original audit row remains intact. This also prevents a pre-fix stale approval row from resurrecting an invalidated output. The existing prerequisite check still prevents submitting a reviewable descendant before its predecessors complete. Reusing identical upstream bytes after an intervening attempt does not restore dependent work; explicit resubmission is required.

Approval-only renewal does not represent a changed base and preserves descendants. Existing request replay remains lookup-first and returns the historical result without appending another event. No Rust code, donor store, scheduler, schema, provider, persistent invalidation flag or new authority is introduced. This is a principle adaptation; existing OpenMontage attribution is retained and its runtime hash is refreshed in the provenance ledger.

**Legacy import exception:** `core/director-legacy.ts` stores a file's receipts in their supplied array order at epoch zero, including approval-only receipts. That array is a snapshot, not a chronological attempt log. Epoch-zero rows therefore seed the baseline without invalidating one another. Their approvals still require renewal in pipeline order. All later live advances follow the normal invalidation rule. The importer itself is unchanged.

An imported unknown pipeline remains readable, as before; without its manifest, dependency order cannot be inferred. Only the manifest's `NOT_FOUND` error is handled for this read compatibility. Execution still refuses the unknown pipeline. A sixth regression test caught this incidental load regression during self-review before the narrow guard was added.

## RED evidence

Before the runtime change, five new focused tests ran with TEMP/TMP under `D:/yk-system-lineage/work/tmp`:

`rtk powershell -NoProfile -Command '$env:TEMP="D:/yk-system-lineage/work/tmp"; $env:TMP=$env:TEMP; node --test --test-name-pattern="ancestor|upstream|same-output|unordered legacy" tests/director-durability.test.ts'`

Result: **4 failed, 1 passed**. Completed descendants remained `completed` instead of `pending`; approval of the waiting old script succeeded; an early in-progress descendant stayed in-progress after its ancestor advanced; a reapproved imported run still reported done after replacing research. The approval-renewal/replay control passed. The preceding shell invocation had incorrectly quoted TEMP assignments; it produced the same failures but is not the D-drive RED evidence above. Its disposable fixtures were cleaned by the test teardown.

## GREEN and checks

- The same five focused tests: **5/5 passed** after the runtime change.
- `tests/director-durability.test.ts`, `tests/director-stages.test.ts`, `tests/identity.test.ts`, `tests/story-packs.test.ts`: **39/39 passed**, zero skips, including unknown legacy pipeline read compatibility. Real stored WAV fixtures use the existing owned FFprobe path. Media execution was coordinated with the parent; native binaries were not rebuilt.
- Tests explicitly cover database close/reopen; immutable prior audit rows and unrelated runs; waiting-output refusal without mutation; a pre-fix stale approval row; upstream in-progress work and early descendant starts; returning to the original upstream bytes; explicit downstream rebuild; approval-only renewal/replay; reversed mixed legacy receipt snapshots and idempotent reimport.
- Scoped Prettier check, `npm run typecheck`, and `npm run lint`: **passed**.
- `npm run provenance:check`: **passed**, 404 pinned source records, 26 excluded content hashes, 2 pinned font files, required notices and import guard over 1,117 files.
- `npm run brand:check`: **passed**, 673 Yamakan surface files.

No paid service, model download, resource-policy change or public release was involved. No full release qualification is claimed.
