# Yamakan — Reproducible Competitor Benchmark and REA Continuation Protocol
**Status:** research protocol **LOCKED** for future runs; REA-01–06 **CLOSED as research deliverables** in this package; **no** independent model-vs-model experiment run.  
**Date:** 2026-10-22.  
**Baseline:** a3c3ce91815aee35ce5b91b4a483dd85766a4429.  
**Read first:** [00_INDEX.md](00_INDEX.md), [01_COMPETITOR_AND_SOURCE_REA.md](01_COMPETITOR_AND_SOURCE_REA.md).

## Principle: superiority is a test result, not a build target
There is no rational meaning of "100% better than Higgsfield and every other tool" without defining tasks, versions, sample generation, time/cost budget, and quality metrics. Higgsfield, Runway and Kling sell different products and aggregate multiple model backends. **Never fill missing scores with guesses or assign points for a feature based solely on a vendor marketing statement.** All currently unverified AI-generation cells are UNKNOWN/NOT TESTED.

## 1. Freeze matched benchmark categories
For each competitor and Yamakan, measure the same job to completion on the same source inputs and documented output constraints.

| Category | Test tasks / reproducible artifacts | Measures | Present Yamakan status |
| --- | --- | --- | --- |
| A: Offline deterministic editing | 20 varied 10–60 s projects; multi-track trims/retime/audio, titles and Arabic RTL, animate opacity+volume, relaunch, backup restore, export | Task success, edit correctness, frame/audio sync, CPU/RAM, cold/warm latency, faults, bytes and reproducible provenance | Existing short Windows campaign PASS, broader long-real-media workload NOT TESTED |
| B: Text-to-video | 60 consent-safe prompts balanced across motion, camera, scene, faces, physics, Arabic text; fixed duration/resolution and allowed aspect | Blind human win/loss, prompt adherence, motion/identity/physics, artifacts, seeds, time-to-first-preview, compute and API cost | NOT TESTED; real engine disabled |
| C: Image/reference-to-video | Matched reference images/pose/camera move across 30 scenarios; first/last frame and motion controls only where each supports them | Identity consistency, input adherence, temporal stability, control error, edits/retries, artifact reproducibility | NOT TESTED; real engine disabled |
| D: Video-to-video editing | 20 source clips; keep-person/edit-environment, style/retime, text change, mask edits, character/reference changes | Source preservation, perceptual fidelity, audio continuity, edit locality, correction success | Deterministic editing partially qualified; generative editing NOT TESTED |
| E: Agent-directed production | 20 end-to-end user briefs: choose references, create 3–8 shots, revise one bad shot, insert on editable timeline, render subtitle/audio, export and reopen | Entire job success, interventions, rerun/resume quality, tool errors, total operator minutes, paid credits | Typed MCP/manual Director exist; model-generation end-to-end NOT TESTED |
| F: Safety, autonomy and ownership | Multi-user permission tests, offline no-egress, asset hashes, native sandbox, recovery, audit, consent, secrets | reproducible pass/fail and threat-model boundaries, not a single additive vanity metric | Yamakan dev-profile controls qualified; real Profile A H1–H5 remain open |
| G: Localization, editing UX | Native Arabic evaluator; RTL, shaping, mixed script, captions, learnability, editor discoverability | Human-signoff, task completion, errors, median time and satisfaction | Automated RTL passed; native Arabic H1 NOT EXECUTED |

### Experimental rules
1. Fix each version, operation, account tier, machine/environment, resolution, clip length, seed/prompt, reference assets, and the exact review date.
2. Where tiers/capabilities differ, evaluate a supported common baseline and label higher tiers separately; do not pretend same model or same cost.
3. Distinguish a model-provider result from a platform/product result (e.g. a hosted Kling model inside Higgsfield is not proof that Higgsfield developed that model).
4. Save input prompts, eligibility/refusal reasons, metadata, output videos, preview video, logs, attempts, timing, effective price, external requests, hashes, and operator actions.
5. Human raters are blinded to provider/model and randomized left/right; default study proposal: at least 60 matched creative tasks, three independent raters per pair, with quality checks. Report uncertainty bounds and missing responses. This sample is a PROPOSAL; statistical power must be justified and measured.
6. Publish separate measures for T2V-with-audio, I2V-with-audio, editing-with-audio, and silent modalities. Never combine cross-modality Elo rankings.
7. Use [Artificial Analysis video methodology](https://artificialanalysis.ai/methodology/video) as a design reference (paired blind votes, same prompt, capability category, standardized presentation, 10-second outputs, equal audio level). Do not claim Artificial Analysis certification.
8. Evaluate intrinsic fidelity with VBench-2.0 *only if the actual evaluator dependencies and full prompt sets run*. Lighter proxy metrics are labeled LOCAL PROXIES, not official VBench.
9. Propose win declaration per category only when Yamakan achieves required thresholds and superiority with confidence, supported by same-task matched evidence. For example: >50% blind preference with conservative 95% lower bound >50% on specified population. Other dimensions have separately stated pass/fail. Never infer a global 100% win from a subset.
10. Avoid API spend and model downloads until budget/hardware/source approvals. Public demo artifacts may inform capability mapping but cannot serve as matched blind benchmark evidence.

## 2. Deep source REA backlog — closure status (research deliverables)

| ID | Topic | Status | Deliverable in this package |
| --- | --- | --- | --- |
| REA-01 | Product reality map | **CLOSED (research)** | [05_PRODUCT_CAPABILITY_MATRIX.md](05_PRODUCT_CAPABILITY_MATRIX.md) + §1 of [01](01_COMPETITOR_AND_SOURCE_REA.md); API-verified HF Cinema 4.0 / Runway catalog / Kling map 2026-10-20 / Luma Ray-2 |
| REA-02 | ComfyUI ↔ EngineAdapter | **CLOSED (research)** | [03](03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md) §1; pin `1a82e6d…`; adapter tests listed; **no code integration** |
| REA-03 | Open model qualification | **CLOSED (research)** | [03](03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md) §§2–7; first candidate Wan **ti2v-5B**; CogVideoX-2B alternate; LTX/Hunyuan DEFER; **no downloads** |
| REA-04 | Cinema / consistency gap | **CLOSED (research)** | [04](04_TARGET_ARCHITECTURE_AND_ROADMAP.md) §§4–5; metadata ≠ conditioning; control compiler planned |
| REA-05 | Editorial agent | **CLOSED (research)** | [04](04_TARGET_ARCHITECTURE_AND_ROADMAP.md) §7; reuse command registry; no new authority |
| REA-06 | Benchmarks / reviews | **PROTOCOL LOCKED; runs NOT EXECUTED** | Categories A–G below; D1/Alibaba/PStack/Graft **NOT RUN** (honest absence) |

**Still open (require compute/spend/F):** live paid competitor generations; local weight inference; blind human study; official VBench GPU evaluators.

## 3. Proposed architecture if founder later authorizes implementation
1. **Yamakan Studio/Timeline remains canonical**. A user creates a script and scene, chooses source assets and allowed engine capability; generates into a separate immutable content-addressed media object, attaches via typed operations, then edits/exports deterministically.
2. One **local sidecar generative engine** with narrow allowlisted graph capability; adapter boundary wraps ComfyUI or Diffusers, never exposes open arbitrary graph/function to the browser or agent, and never becomes a second timeline/persistence owner.
3. Capability registry distinguishes NO_ENGINE, ENGINE_PRESENT_UNQUALIFIED, LOCAL_APPROVED, PROVIDER_REQUIRES_AUTH, and REFUSED; no ranker returns success with zero eligible engines.
4. Keep output/weights/consent review and real Win AppContainer, network and GPU safety within E-SEC. No published version claims real-generation until it actually passes tests.
5. Optional remote provider marketplace remains separate and **disabled**, requires founder budget/authorization, per-provider terms, SSRF controls and user opt-in.
6. Avoid adding 4K badges unless actual native model supports it and output provenance proves it.

## 4. Hardware, spend and rights constraints (checked)
Founder-authorized Windows QA machine reported Intel UHD Graphics, no nvidia-smi, Windows C: ~1.9 GB and D: ~12.7 GB free on 2026-10-22. This is suitable for Yamakan's present editing UI and E2E, **not** practical for downloading/training/running massive video-diffusion checkpoints. Propose remote no-cost research slots only after confirming quota, terms, current entitlement and GPU suitability; do not state that Kaggle/Colab free compute is guaranteed. No incidental paid API requests.

Rights: the founder attests permission to copy/adapt/rebrand source code, but that does not automatically grant access to a closed platform's private backend, weights, paid compute or waive mandatory open-source attribution. Preserve license records and source notice hashes when integrating.

## 5. Decision and sequencing
**Current verdict:** Competitive REA **research package complete**; **not a GO** for real inference deployment or public release.

Completed in #85 (this package):
- R1 product comparison + graded matrix  
- R2 ComfyUI adapter research closure (no integration)  
- R3 Wan TI2V-5B first candidate + CogVideoX-2B alternate; LTX deferred  
- R4 matched benchmark protocol locked  
- R5 architecture/roadmap + outperform/gap/path  

**Next (separate PR, still flag-off until F):** E0–E2 adapter + containment design under E-SEC; Category A edit expansion (no engine). Do not reopen closed P10. Public release **NO-GO**.

## 6. Definition of done for REA
- [x] First-party capabilities represented without hype ([05](05_PRODUCT_CAPABILITY_MATRIX.md), [06](06_OUTPERFORM_GAPS_AND_PATH.md)).
- [x] Competitor claims dated with official API links and evidence grades ([01](01_COMPETITOR_AND_SOURCE_REA.md), [05](05_PRODUCT_CAPABILITY_MATRIX.md)).
- [x] ComfyUI, Wan2.2, LTX-2, Diffusers, VBench, CogVideo pinned with copy-vs-build ([03](03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md)).
- [x] Architecture tied to `core/engines/contract.ts` and authority rules ([04](04_TARGET_ARCHITECTURE_AND_ROADMAP.md)).
- [x] Fair benchmark protocol locked (Categories A–G above).
- [x] Win/UNKNOWN/cannot-compare explicit ([06](06_OUTPERFORM_GAPS_AND_PATH.md)).
- [x] No fabricated metrics/reviews; D1/Alibaba/Graft recorded as NOT RUN.
- [x] Zero engine enablement; public release NO-GO.
- [ ] Live paid or local model benchmarks — **deferred** pending F/compute/spend.

## Current baseline references
- https://github.com/TheHalfMoon/Yamakan/blob/main/core/engines/contract.ts
- https://github.com/TheHalfMoon/Yamakan/blob/main/core/engines/fake.ts
- https://github.com/TheHalfMoon/Yamakan/blob/main/core/router/explain.ts
- https://github.com/TheHalfMoon/Yamakan/blob/main/docs/FOUNDER_DECISION_RECORD.md
- https://github.com/TheHalfMoon/Yamakan/issues/77
- https://github.com/TheHalfMoon/Yamakan/blob/main/docs/evidence/qualification/windows-ux-qa-final-report.md
