# Risk register and decision log

Baseline `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; research2026-10-23. Risk scores are qualitative engineering judgments, not measured probabilities. Actual independent review results are appended to `evidence/plan-review-*.json`; unresolved findings are not declared closed by this template.

| ID | Risk / likelihood × impact | Mitigation / task | Remaining evidence or owner |
|---|---|---|---|
| R01 | Creative loss outside canonical backup: high×high | YU010–014, immutable docs/nested asset closure | Source confirmed gap; migration/recovery tests not executed |
| R02 | Concurrent sidecar writes/duplicate workflow effects: high×high | YU013/060/061 CAS+receipt+attempt fencing | Source observation; new transaction tests needed |
| R03 | Consent revived through artistic restore: medium×high | Security ledger outside undo; restored grant revalidation | Independent security review |
| R04 | Frontend full-media analysis exhausts memory: high×medium | YU016/017 tiled derivatives | Browser RSS/IO measurements |
| R05 | FFmpeg per-frame graph cost/interactive ceiling: high×high | YU018/022/026, conditional MLT spike | Actual same-profile benchmarks; no assumed native speedup |
| R06 | Professional claims exceed30fps/small project/export support: high×high | Named supported profiles, YU019–026 | Full rational/time/color/audio golden corpus |
| R07 | Generic engine graph enables unsafe runtime behavior: medium×high | Operation v2, server-owned lowering, no raw plugins | E-SEC; donor source hazards retained |
| R08 | Python/GPU descendants violate current containment: high×high | YU041 and actual OS negative tests | Qualified capable host; native engineer review |
| R09 | Paid retry/cancel creates uncertain charges: high×high | Durable intent/reservation/reconcile; distinct remote stop/refund | Future provider contract+budget; current spend0 |
| R10 | Model/GPU/storage unavailable: high×high | Offline editor remains independent; YU092 blocked | Founder F and verified host/rights/entitlement |
| R11 | License/weight terms/dependency closure incomplete: medium×high | Module/grant/hash/notice/closure before adoption | Native model/discovery candidates remain deferred |
| R12 | Vendor docs/models change rapidly: high×medium | Date/version/capture hash, fresh qualification per recipe | No static live model-count claims |
| R13 | Too many product modes/maintainer burden: high×high | Story/Edit/Finish; first slice integrity only | Formative UX and founder priority after review |
| R14 | Current audit not exhaustive line-by-line/runtime security review: high×high | Explicit sampled coverage; target unreviewed critical closure | Additional selected-path review and real test environment |
| R15 | Release evidence stale/incomplete: high×high | YU000/091/100; exact artifact receipts | H1–H5/ProfileA/signing remain external |
| R16 | 'Copy first' imports incompatible donor authority: medium×high | Narrow algorithms/workers; reject full stores/schedulers | Per-import provenance and regression evidence |
| R17 | Biased benchmarks/inflated sample counts: medium×high | Clustered prompt/rater analysis and failures retained | Pilot/power/authorized matched runs |
| R18 | New creative blobs bloat DB/history: medium×medium | Immutable dedup,refs/byte caps,backup benchmark | Measure before increasing policy limits |

## Decisions

| ID | Decision | Evidence / tradeoff | Revisit trigger |
|---|---|---|---|
| D01 | Preserve existing main foundation and completed P10 scope | Source+historical receipts show real bounded editor/media infrastructure | Demonstrated core invariant failure, not preference for another framework |
| D02 | Architecture D; canonical immutable creative docs in same DB | Studio/Cinema/Director persistence gap; existing transaction/recovery seams | Migration reliability/maintenance penalty exceeds matrix sensitivity |
| D03 | Operation-based engine v2, v1 bridge | Current graph/bytes bias; provider SDK lifecycle hazards | A concrete capability cannot fit strict versioned schema without loss |
| D04 | Conditional worker qualification, not unconditional Diffusers-first | No cross-engine operational/quality run; source hazards in multiple candidates | Actual authorized same-operation comparison |
| D05 | Editing/recovery before inference | Zero spend, no qualified GPU/weights, major product-integrity gaps | Founder changes customer/budget/resource objective |
| D06 | Native whisper.cpp first transcription spike; Python challenger deferred | Scoped source review and smaller proposed closure; no accuracy/runtime proof | Authorized Arabic/English benchmark favors alternative |
| D07 | No whole editor/Comfy marketplace merger | Donor project/queue/plugin boundaries conflict with canonical authority | Specific bounded replacement has measured maintenance/performance benefit |
| D08 | Public release NO-GO; no Plume training/Paradigm edits | Explicit founder scope and issue77 | Separate artifact/resource-bound founder authorization |

Formal planning ADR: `docs/adr/0004-canonical-creative-project-and-qualified-execution.md`. Earlier ADRs and PR85 are preserved; this record supplements/supersedes recommendations only in its stated scope.

## Actual review/tool ledger

- Independent source auditor:62 sampled paths,563-file hashed inventory,49 subsystem statuses; actual branding source checks2/2 passed; time test blocked missing zod. Not full Windows/media/security qualification.
- Independent donor reviewer:14 scoped implementation inspections,72 raw-file captures and17 static adaptation observations;10 discovery/license-only candidates. No donor build/test/inference.
- Independent competitor reviewer:103 captures across Cuty/Higgsfield/Runway, static SDK/CLI package inspection; no authenticated app generation.
- d1 status: installed/online local CPU. Initial choice request returned400; corrected noul request returned advisory0.46465 for prioritizing recovery. This weak/ambiguous local judgment did not determine architecture or approve any gate. Both responses retained.
- Graft: actual free structural build across103 core/server/CLI/MCP/SDK files,1034nodes/2642edges; targeted caller queries corroborate registry seams. No deep/paid LLM pass; no correctness/security approval.
- Alibaba Open Code Review: no current LLM-backed run. Graft/ADR/ps-review skills are available, but their presence is not execution evidence. Fresh plan review records specify what actually ran.

## Review disagreements and arbitration

Source and integration reviewers independently challenged a generator-first sequence and graph-shaped public engine API; adopted D02–D05. The donor reviewer prefers whisper.cpp's native CPU spike over an immediate Python ASR dependency; adopted D06 with runtime/language qualification explicitly open. Competitor review rejects old claims that Runway has no timeline, that Cuty's Runway marketing page proves Runway model access, or that Higgsfield's public CLI repository contains its backend; corrected throughout02–08. Provider SDK polling/cancel does not define durable/billing truth; contracts10/13/14 separate those outcomes.

Ten requested perspectives are addressed by source/media/competitive reviews plus deliberate adversarial passes in09. They are not ten independent human specialists. Final fresh-context correctness/product/parsimony and security plan review findings must be captured before the package readiness claim is written.

## Completed fresh-context planning panel and repairs

Initial reviewed head `3e15bab459cf2ba904926cf9e4d79fd62d729e7b`; repaired contract head `135a7979f253b0d9324536db42aade6afc0f3abf`. Actual findings and scoped re-review are retained without overwriting the initial open verdicts:

| Finding | Concrete repair | Delta disposition |
|---|---|---|
| PC01 / SEC02:8MiB document versus2MiB ingress | Project/principal/hash-bound streamed staging,raw+canonical UTF8 cap,TTL/concurrency/reservation/cleanup,small commit handle; unchanged general request/snapshot/MCP caps | Addressed in both delta reviews |
| PC02:writable-v5 activation ahead of complete recovery/legacy save | AG-DOCS requires YU010–015 group evidence; preserve opaque creative refs or reject lossy old saves; flag-off verification distinguished from activation | Addressed in correctness delta; consistent with security delta |
| SEC01:restored execution authority | Fresh execution epoch/restoreHold before startup requeue; invalidate approvals,preserve uncertain external IDs/reservations,no effects until explicit reconciliation/restart | Addressed in security delta |
| SEC03:false-positive sandbox negatives | Same-receipt authorized IO,live probe and unrestricted sentinel positive controls | Addressed in security delta |
| PC03:optional transform scope | YU022 limited to existing opacity/volume; transform animation deferred to separate scope | Addressed in correctness delta |
| PC04:product breadth | Frozen bilingual finishing brief/formative walkthrough after integrity milestone before broader expansion | Addressed in correctness delta |

No remaining must-fix was found within those repair deltas. This is a planning-contract panel on the recorded scopes, not runtime security/native/media/model certification. **Panel: full — fresh correctness/product/parsimony and separate security/native/cost (session model); specialty external reviewers/Alibaba LLM run absent; d1 advisory only; Graft structural only.** Overall verdict remains partially ready, with23's research/resource/release gaps.
