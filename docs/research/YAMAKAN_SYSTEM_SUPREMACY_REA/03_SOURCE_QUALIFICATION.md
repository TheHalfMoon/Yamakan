# Source qualification and transplant contract

[01](01_COMPETITOR_AND_SOURCE_REA.md) is the retained pin/function evidence. This document defines how new opportunities become implementation-ready. A registry task listing a donor is a research direction until its qualification record is complete.

## Mandatory record for each serious candidate

Record: repository URL; immutable commit; license and notices; module; function/class; runtime entrypoint and callers; dependency closure; platform/native requirements; memory/CPU/disk/network requirements; upstream tests; known defects; trust boundaries; Yamakan destination; required adaptations; behavior preserved; performance implications; provenance obligations; acceptance; rollback; and maintenance owner/cost.

Trace the relevant call graph through invalid input, cancellation, cleanup, crash/restart and concurrent execution. Capture file hashes for imported material. Separate inspected functions from merely retrieved files. Compare multiple suitable candidates; if only one is credible, state the search and why alternatives were rejected.

The required chain is:

**Upstream → commit → file → function → dependencies → Yamakan target → tests → performance evidence → definition of done.**

Performance evidence may initially be UNKNOWN for research; implementation readiness then requires an explicit bounded experiment and a conservative fallback. It cannot support a performance claim until measured.

## Present decisions and future boundaries

| Opportunity | Current defensible choice | Work still required before new import |
| --- | --- | --- |
| Approval prerequisite checks | ADAPT existing OpenMontage translation; SS-001 shipped | Preserve existing provenance; no new Python checkpoint store |
| Downstream stale approval | ADAPT Kinewright exact-base principle; SS-003 shipped | New proposal/take work must map identity to Yamakan CAS and epochs |
| Per-writer undo | DEFER OpenFilm transplant | Compare touched-field inverse semantics to current canonical undo; reject index-based identity assumptions |
| Submission/recovery | ADAPT OpenEdit negative cases; REJECT second ledger | Trace existing jobs/external-request reconciliation; no paid submission experiment |
| Progress/cancellation | DEFER Remocn code; ADAPT Temporal test concepts | Inspect complete effect/store closure; bounded cleanup deadlines belong to Yamakan policy |
| Proxy/decoder work | Compare Kdenlive, MLT/Shotcut, Mediabunny and current FFmpeg | Kdenlive selected proxy source is inspected; full import closure is not qualified |
| Interchange/archive | WRAP existing OTIO adapter, compare pinned OTIO | Explicit loss map; hostile archive gates before adding parser/publication surface |
| Fast trim | DEFER LosslessCut smart-cut until workload justifies it | Rational/VFR/B-frame/audio seams, license closure, fallback to reference export |
| Native grants | DEFER Orcel policy reuse | Protected state/native dependencies and second-account qualification |
| Developer/agent reuse | R-04 first | Gomrey/Skilit metadata and private samples do not establish transplant rights |

Do not relabel conceptual adaptation as copied implementation. BUILD requires a written comparison showing why existing code/donors are unsuitable, too costly, incompatible or less reliable.

## Acceptance of a qualified opportunity

All twelve conditions must be answered: competing behavior investigated; Yamakan implementation inspected; alternatives considered; chosen functions/dependencies inspected; pin recorded; licensing understood; boundary defined; resources assessed; risks documented; tests and rollback defined; choice defended; task executable. The fresh reviewer evaluates the record with the code.

Before importing, update [imports](../../provenance/imports.json), [import policy](../../provenance/import-policy.json) and the [reuse ledger](../../SOURCE_REUSE_LEDGER.md) as applicable. Keep notices and exact modifications. License conflict or inaccessible closure means DEFER/REJECT, not a “temporary” untracked copy.

For replacement experiments, retain the reference implementation and existing project format; compare the same inputs behind a bounded adapter. Migrate only with compatibility, backup and rollback evidence. A second database, scheduler, general plugin host or major irreversible migration is not preapproved by this plan.
