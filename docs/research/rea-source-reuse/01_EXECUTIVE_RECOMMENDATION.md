# 01 — Executive recommendation

Date: 2026-10-18. Planning base: `origin/main` `6e471088a56b6bdda4fef29c747167827958a224` (PR #28 merged). This is a planning document. It changes no production code and authorizes no merge, release, purchase, paid inference or model download.

## Recommendation

**Adopt architecture B, "Balanced reuse on the existing D′ foundation"** ([05](05_ARCHITECTURE_ALTERNATIVES.md), [06](06_FINAL_ARCHITECTURE.md)). Yamakan keeps one SQLite authority, one canonical project and timeline, one typed command registry, one durable job system, one FFmpeg render-plan compiler and one process owner (procd). Donor code enters at three depths:

- **Copied and adapted source (ladder B)** where a donor has pure, tested, low-coupling logic:
  - OpenCut Classic: ripple, retime, keyframe animation and group move.
  - ArtCraft: camera math and the scene schema.
  - OpenVideoStudio: identity contracts.
  - OpenMontage: stage manifests and prerequisite rules.
  - InvokeAI: the webv2 canvas engine, as the Studio canvas core.
- **Pinned dependencies (ladder A):**
  - Mediabunny for browser demux and waveform.
  - JASSUB for live title preview, later, as an upgrade over the existing server reference still.
  - soundtouchjs for retimed audio preview.
- **Wrapped engines (ladder D)** behind Yamakan's job and process boundary:
  - ComfyUI, run as a contained local engine, disabled until local-AI hardware and weights are qualified.
  - FFmpeg and libass, which remain in place.

**No second database, scheduler, renderer, history store or editor state engine is imported.** Whole-app donors (OpenCut's `EditorCore`, the film editor's app shell, ArtCraft's save manager, OpenMontage's file checkpoint store, InvokeAI's `canvas-operations`) are rejected. Each of them would become a competing authority.

## MVP first

The MVP is not qualified yet. The release verdict stays **NO-GO**. Major integrations wait for the **M-gate** ([07](07_OPTIMIZED_MASTER_PLAN.md#m-gate)). The M-gate requires:

1. Worker read containment merged (PR #29, owned by another session).
2. **A video clip's own sound exported.** This is a confirmed defect: `core/render/plan.ts` creates sound only for sound-track clips.
3. The interruption and recovery defects closed.
4. The pinned distributable bundle built.
5. `qualify:release` passing at an exact main head.

The human-only gates (native Arabic review, a clean profile, a second account, packet capture, disk-full) do not block integration work from starting. They do block release.

## Expected effect (estimate, not measurement)

Across the expansion workspaces in this plan, about **42,000 donor source lines** are reused directly or by adaptation, against an estimated **9,500–15,000 new Yamakan lines** of adapters, schema, commands, UI and tests ([09](09_REUSE_AND_EFFORT_ESTIMATES.md)). The planned expansion effort falls from an estimated 88–131 builder days (reimplementation) to **41–63 builder days**. These figures come from donor line counts at the pins and from this document's per-module estimates. They are not measured speedups.

## Verdict

See [13](13_FIRST_IMPLEMENTATION_WAVE.md#verdict). In short, the plan is ready for implementation of wave 1 (PRs W1–W7: the MVP work plus the provenance tooling). The expansion PRs W8–W10 are fully specified and stay gated on the M-gate.
