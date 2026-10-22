# Yamakan — Reproducible Competitor Benchmark and REA Continuation Protocol
**Status:** research protocol PROPOSED; no independent model-vs-model experiment run.  
**Date:** 2026-10-22.  
**Baseline:** a3c3ce91815aee35ce5b91b4a483dd85766a4429.  
**Read first:** [01_COMPETITOR_AND_SOURCE_REA.md](01_COMPETITOR_AND_SOURCE_REA.md).

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

## 2. Deep source REA backlog — ready for Cursor/Opus investigation, NOT implementation
R = Research exact source, E = Extract qualified narrow algorithm/contract, A = Adapt to Yamakan if authorized later.

### REA-01: Product reality map
- Freeze Higgsfield Cinema Studio, Soul ID, Canvas, Supercomputer, Marketing Studio, CLI/MCP; Runway Agent/Aleph/catalog/MCP; Kling video/motion/Canvas; Luma Ray3 Modify; one conventional NLE baseline.
- For every feature record: confirmed official docs URL/date, what the feature actually does, inputs/outputs, paid/free/offline availability, exact tested version, evidence grade (documentation, demo, independently executed).
- No reliance on contradictory marketing counts such as "30 seconds" vs "one minute" without version-specific resolution.
- Deliver: PRODUCT_CAPABILITY_MATRIX.csv and PRODUCT_EVIDENCE.md; unresolved cells explicit.

### REA-02: ComfyUI engine contract, code-level closure
- Pin currently checked source 1a82e6d01f395b43275c77acd289af1eb7090bb9.
- Inspect server.py: prompt submission, job history/status/cancel, uploads/views, WS; execution.py scheduler/cache, node graph schema; nodes.py/related validators; security boundaries of custom nodes, paths and authentication.
- Trace call graph for one allowed request; identify exact source files, dependency closure, entrypoints and ability to run WITHOUT shared state in Yamakan.
- Compare against core/engines/contract.ts: job IDs, typed inputs, sha256 checks, allowlisted class_type, cancel/idempotency/fencing, output verification/quarantine.
- Deliver exact file/line/function transplant candidate matrix + threat model + red/green tests, not a whole-app copy proposal. **Do not run arbitrary Comfy custom nodes.**

### REA-03: Open video-model candidate qualification
- Start with Wan2.2 TI2V-5B/T2V-A14B/I2V-A14B; compare Diffusers wrapper and official generate.py; inspect config, schedulers, VAE, memory management, runtime and model-card licenses.
- Independently review LTX-2.5 audio-video and keyframe capabilities; note LTX Community licenses and >20B model resource needs.
- Optionally consider HunyuanVideo-1.5 and Wan-Animate for character motions only after resource and license evaluation.
- For each: repo+pin+code path, license including WEIGHTS, inference hardware minima, memory/disk, sample commands, reproducible prompt/seed/output fields, supported controls, latency, test plan and blockers.
- NO assumption that proprietary Wan3.0 API/catalog item is an available open-source checkpoint. Public Wan GitHub source reviewed here was Wan2.2.
- Deliver MODEL_SELECTION_MATRIX, WEIGHT_RESOURCE_BUDGET, DATA_AND_RIGHTS_LEDGER. No checkpoint downloads.

### REA-04: Cinema control and consistency gap
- Trace the exact Yamakan camera and Director metadata flow; differentiate editable optics metadata from conditioned AI video generation.
- REA candidates for shot-by-shot references, first/last frame, pose/depth/control, consistent character and location, audio and shot stitching.
- Build prototype TEST FIXTURES ONLY after research permission; no generative model activation.
- Require measured reference adherence and output fidelity, not "camera field exists" PASS.

### REA-05: Fully automated editorial agent
- Research competitor brief-to-storyboard-to-multi-shot pipeline, human approvals, resumable retry and corrections.
- Reuse Yamakan's typed command registry, durable jobs and project revisions. Define planning/approval/shot/media registry without new authority.
- Evaluate full brief→editable-scene/timeline→export→reopen journey, with counters for intervention and evidence.

### REA-06: Benchmarks and independent review
- Standard prompts + ethically sourced reference assets, blinded matchups, VBench-2.0 18 dims (where feasible), human scores, anti-cherry-picking.
- Every evidence cell labels TESTED / DOCUMENTED / INFERRED / BLOCKED / UNKNOWN.
- Run static REA and architecture/security review with local D1, Alibaba OCR if actually configured, PStack, Graft, E2E as appropriate; never fabricate a result.
- Deliver reproducible harness SPEC and compact 3-way scorecard, not competitive ranking claims.

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
**Current verdict:** Research can start now; **not a GO for real inference model deployment or a public release**.

Recommended priorities:
- R1: full **product comparison** and verified feature matrix (high value, no spending).
- R2: ComfyUI **engine-adapter** closure + E-SEC preflight against current Yamakan contracts.
- R3: Wan2.2 **first open checkpoint candidate** + LTX2.5 alternate; resource and license feasibility. No automatic downloads.
- R4: a **matched benchmark protocol** with reliable consent-safe samples and blind scoring.
- R5: REA findings → engineering milestones with actual acceptance and release gates; seek explicit founder F/G/model-weight authorization before implementing generation.

After these, if research proves feasibility, open a **separate engineering plan PR** for founder approval. Do not reopen closed P10 or claim release is ready. Report hard NO-GO if quality/hardware/resource limitations cannot be overcome under the no-cost constraint.

## 6. Definition of done for REA
- Every current first-party product capability and non-feature is represented without hype.
- All competitor claims have dated links, limitations and evidence levels.
- At least ComfyUI, Wan2.2, LTX-2, Diffusers, VBench have pinned source plans and module-level import/reuse decision, with binary/weights/license boundaries.
- Concrete architecture diff and risks tied to Yamakan code files.
- Same-task fair benchmark plan + optional consent-safe real tests if available at **zero authorized cost**.
- Exactly what would prove a win, what remains UNKNOWN, and what cannot currently be compared.
- Reproducible code/commands/fixtures only if actually run; no fabricated metrics or reviews.
- A plan ready for a separate explicit implementation decision; zero unwanted feature activation or public deployment.

## Current baseline references
- https://github.com/TheHalfMoon/Yamakan/blob/main/core/engines/contract.ts
- https://github.com/TheHalfMoon/Yamakan/blob/main/core/engines/fake.ts
- https://github.com/TheHalfMoon/Yamakan/blob/main/core/router/explain.ts
- https://github.com/TheHalfMoon/Yamakan/blob/main/docs/FOUNDER_DECISION_RECORD.md
- https://github.com/TheHalfMoon/Yamakan/issues/77
- https://github.com/TheHalfMoon/Yamakan/blob/main/docs/evidence/qualification/windows-ux-qa-final-report.md
