# Final subsystem decisions — review candidate

These 16 decisions are the author's proposed target architecture, pending the required independent assessment. They are not permission to implement. Exact modules, functions, dependency closure, rights, interfaces, tests, compatibility, security, performance, rollback and ownership are in [SUBSYSTEM_DECISIONS.json](SUBSYSTEM_DECISIONS.json). External candidate pins and rejection rationale are in [16](16_MEDIA_SOURCE_QUALIFICATION.md) and [17](17_HARNESS_AND_ACCESSIBLE_SOURCE_REA.md); retained imports remain in the existing provenance ledger.

| ID  | Subsystem                           | Choice  | Disposition | Concrete boundary                                                                                                                      |
| --- | ----------------------------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Canonical project engine            | WRAP    | PRESERVE    | SQLite remains the sole project authority. No donor store or delta migration.                                                          |
| D02 | Timeline editor                     | ADAPT   | IMPROVE     | Qualify keyboard/pointer snapping, trim and crossfade through the existing operation boundary.                                         |
| D03 | Video renderer                      | WRAP    | IMPROVE     | Keep FFmpeg reference output; profile redundant decode/scale work before one bounded graph experiment.                                 |
| D04 | Preview engine                      | COMBINE | IMPROVE     | Qualify cache identity, stale response suppression, frame disposal and A/V playback with reference fallback.                           |
| D05 | Audio engine                        | WRAP    | IMPROVE     | Qualify loudness measurements and audio-state presentation; no new DSP or bus engine.                                                  |
| D06 | Effects and compositing             | COMBINE | PRESERVE    | Keep current supported effect set; qualify boundary controls and explicit unsupported fallback.                                        |
| D07 | Creative asset management           | WRAP    | PRESERVE    | Expose safe comparison/replacement and retain every referenced source in backup closure.                                               |
| D08 | Agent Harness                       | COMBINE | IMPROVE     | Typed progress/handoff reads committed state; no external workflow runtime.                                                            |
| D09 | Durable execution and recovery      | ADAPT   | IMPROVE     | Extend forced-interruption evidence; no second queue or automatic uncertain-effect replay.                                             |
| D10 | Creative memory and context         | BUILD   | PRESERVE    | Use a small versioned handoff document referencing existing brief/revision/assets/evidence; it grants no authority.                    |
| D11 | Agent permissions and approvals     | WRAP    | PRESERVE    | Preserve human-only Director approval and existing scoped project:write take.apply semantics. New review UI cannot grant capabilities. |
| D12 | Developer environment               | COMBINE | IMPROVE     | Document and verify owned checkout setup, missing-runtime diagnostics and exact-head evidence.                                         |
| D13 | Testing and benchmarking harness    | COMBINE | IMPROVE     | Reuse matched fixtures and exact receipts; independent reviewers remain mandatory.                                                     |
| D14 | Professional UX                     | COMBINE | IMPROVE     | Review existing take proposal, keyboard edit/cue workflow, visible stale/cancel/recovery states.                                       |
| D15 | Project portability                 | WRAP    | IMPROVE     | Add explicit interchange loss report and qualify existing portable backup closure. No new archive extractor.                           |
| D16 | Future model integration boundaries | DEFER   | DEFER       | Keep model execution disabled until separate rights, compute/cost/resource and founder authorization.                                  |

No authority core is selected for replacement. Replacement is limited to demonstrably defective interaction/adapter logic inside the existing boundaries, backed by a failing case and independent review. A rejected experiment does not qualify M or a release. No source transplant, runtime update, new database, provider or resource increase is authorized here.
