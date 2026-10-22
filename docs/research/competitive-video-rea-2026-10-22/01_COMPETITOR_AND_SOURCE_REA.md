# Yamakan — Competitive Video REA, first evidence tranche
**Research date:** 2026-10-22  
**Scope:** evidence-based product reconnaissance and source-first architecture research; **NOT a claim of product superiority, implementation authorization, performance benchmark, or release approval**.  
**Baseline:** Yamakan main a3c3ce91815aee35ce5b91b4a483dd85766a4429; P10 and Windows UX QA complete, public release NO-GO.

## Executive conclusion
Yamakan is a tested offline-first media editor/production workspace, with canonical SQLite history, typed operations, real Windows Edge editing/export acceptance, Studio drawing, Cinema camera/scene metadata, manual Director workflows, deterministic Quality Lab, supported animation, audio processing, and MCP/REST support. **Local generative engine is disabled**, as are paid/cloud providers. Thus there is *no supported evidence* that Yamakan currently matches or beats Higgsfield/Runway/Kling/Luma in AI-video output. Windows 6-second synthetic clip export is not a T2V/I2V benchmark. Universal "100% better" is not a verifiable scientific promise; benchmark specified jobs-to-be-done and publish failures honestly.

Recommended differentiated product: **offline-first, agent-native, reproducible cinematic production studio**, unifying generation (when legitimately enabled), deterministic timeline editing, exact projects, Arabic-first workflows, export, privacy, and inspectable quality evidence. Compete against closed providers by controlling the *complete editable outcome* and true cost, not by pretending a free model beats every proprietary video model.

## 1. Verified competitor capability map
Source types below are **vendor feature claims**, not independently tested performance or access.

| Product (vendor source) | Observed capability | Yamakan today | Critical gap / comparison task |
| --- | --- | --- | --- |
| [Higgsfield creative suite](https://higgsfield.ai/creator-hub/help-center/getting-started/what-is-higgsfield) | Cinema Studio / Soul ID reusable characters / Marketing Studio URL-to-UGC ads / Canvas multi-model node workflows / Supercomputer multi-step agent | Cinema stores camera/scenes, Director is manual, typed MCP/REST, edit/render offline. No real model generation or hosted collaboration | Character consistency, shot-to-shot AI output, true conditioning, automated ad workflows, orchestration and multi-model choice |
| [Higgsfield Cinema Studio](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-cinema-studio) | Camera/lens/lighting/color/pacing control, multi-shot generation and references; versioned capabilities (vendor help and marketing pages do not fully agree on limits) | Camera metadata and saved scenes are NOT model-conditioned controls | Test optical controls against rendered clips; verify real reference-count and duration per account/version, not marketing claims |
| [Higgsfield CLI/MCP](https://higgsfield.ai/creator-hub/help-center/tools/which-higgsfield-tool-should-i-use) | Agent-directed generation from coding tools | Yamakan has typed offline MCP, but no enabled inference | Must compare actual end-to-end agent task completion; merely exposing MCP is not a differentiator |
| [Runway](https://runway.com/changelog) / [model catalog](https://dev.runwayml.com/models/catalog) | Gen-4.5, Aleph editing, model marketplace, Agent, plugins/MCP; Sept–Oct 2026 changelog | Real timeline editing/export and independent projects; no generative video or model routing | Text/image/video-to-video, edit-source fidelity, agent reliability, model selection, ecosystem |
| [Kling](https://kling.ai/) | Video generation, Motion Control, Canvas / AI Agent / multishot and native-audio tools | Local timeline and camera previews only | Motion transfer, pose control, continuity and audio generation |
| [Luma Ray3](https://lumalabs.ai/ray3) / [Modify guide](https://lumalabs.ai/learning-hub/ray3-modify-user-guide) | Video-to-video transformation, character reference/keyframes, HDR and draft modes | Keyframe opacity/volume editor, no AI video transformation | Controlled reference image/video edit, HDR quality, character preservation |
| Conventional NLE controls (DaVinci Resolve, CapCut) | Professional editing and exports, not only AI model leaderboard | Yamakan tested 1280x720 H.264/AAC basic edit/export, media security and rollback | Long real timelines, performance, transitions, color, audio mixing, import format breadth, user UX; gather versioned firsthand evidence before claiming parity |

**Provenance of claims:** Higgsfield site/help dated July–August 2026; Runway changelog Oct 2 2026; Kling and Luma vendor pages viewed Oct 22 2026. Tool marketing is not proof of accurate physics, real 4K generation, or final model quality. Record conflicting limits and test actual product access if available without unauthorized charges.

### Higgsfield "source code" distinction
Verified public GitHub organization: https://github.com/higgsfield-ai. The public [higgsfield](https://github.com/higgsfield-ai/higgsfield) repository is an older distributed GPU/LLM training framework, **not the Cinema Studio generation backend**. Published [CLI](https://github.com/higgsfield-ai/cli), [skills](https://github.com/higgsfield-ai/skills), [JavaScript SDK](https://github.com/higgsfield-ai/higgsfield-js), and [app templates](https://github.com/higgsfield-ai/app-templates) can inform *documented interface and agent workflow behavior*. SDK/CLI route to hosted services; they do not grant a local video model. app-templates has no license metadata in current GitHub repo API; do not transplant its files without verifying appropriate authorization. This REA does not require or attempt to extract inaccessible private backend source.

## 2. Actual Yamakan engineering seam inspected
- core/engines/contract.ts: strict engine graph nodes / allowlisted class_type, content hash input/output, idempotency attemptKey, job submit/status/cancel/outputs; **ENGINE_ENABLED=false**.
- core/engines/fake.ts: simulated result only, with deterministic cancellations, retry fencing and quarantine; not real generation.
- core/router/explain.ts: deterministic deny/explain; **ROUTER_PROVIDERS_ENABLED=false**, eligible is empty.
- docs/FOUNDER_DECISION_RECORD.md: model-weight download, paid provider use, activation of real engines, and production release are **not** approved by prior P10 instructions; E-SEC and decisions F/G remain binding.
- Current Windows qualification: real browser import/edit/export, 361/363 unit tests passed (2 skipped) in founder QA; follow-up 6 s product campaign and UI fixes merged. This does not prove AI video or comprehensive NLE superiority.

### Avoid destructive integration
Keep one Yamakan project authority, typed command registry, project revision history, durable jobs, safe asset store, FFmpeg pipeline, closed-by-default egress and approved Windows containment. Do not vendor entire competing applications or create second queues, a second timeline database, unrestricted Comfy node imports, or duplicate project semantics.

## 3. Verified public donor-source REA matrix
Pins are snapshots checked through the GitHub API on 2026-10-22; no code copied or models downloaded in this REA.

| Rank | Source / pin | Real inspected interface | Candidate reuse / Yamakan boundary | Limitations and status |
| --- | --- | --- | --- | --- |
| 1 | [ComfyUI](https://github.com/Comfy-Org/ComfyUI) @ 1a82e6d01f395b43275c77acd289af1eb7090bb9 (GPL-3.0) | server.py: /prompt, /api/jobs, /api/jobs/{job_id}/cancel, /upload/image, /view, /history, /ws. execution.py: node scheduling, caching, execution | Out-of-process **restricted adapter** to existing core/engines/contract.ts; use per-job job IDs and output probe; no imported global persistence. Local-only and paid API nodes disabled. | Must secure API/WS, model paths, allowlist, process containment, filesystem, GPU/OOM, cancellation. Code interface inspected, **no Yamakan integration or model test yet**. |
| 2 | [Wan2.2](https://github.com/Wan-Video/Wan2.2) @ 1ea34ff48f87168174e12956e200b1d908b1c5ff (Apache-2.0) | generate.py task modes t2v-A14B / i2v-A14B / ti2v-5B / s2v-14B; seed, model checkpoint, offloading, export controls | First open-weight model candidate for T2V/I2V; map a *single pinned pipeline* into EngineGraph under E-SEC; avoid reimplementing diffusion | Check memory and licenses for each checkpoint; large weights, not suitable on present Intel UHD Windows host. **No weights loaded or videos generated yet**. |
| 3 | [Hugging Face Diffusers](https://github.com/huggingface/diffusers) @ 48cdbaef5ee3d718aaee392b44f2099ae511c4a5 (Apache-2.0) | Documented Wan2.1/2.2, VACE controllable generation and video pipelines | Interoperable Python inference/conditioning layer if cleaner than full Comfy integration | Prefer one execution authority; model-specific validation and resource contracts required. Documentation inspected, no code transplant. |
| 4 | [LTX-2](https://github.com/Lightricks/LTX-2) @ e98f6d927d83c92ef2be6aec76c8440b19306e39 (LTX community licenses) | Official README: LTX-2.5 models, synchronized audio-video, keyframe conditioning, distillation | Secondary audio+video/continuity candidate; compare blind outputs vs Wan first | Weights large; distinct community terms; no model execution, not a default unreviewed installation. |
| 5 | [HunyuanVideo-1.5](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5) (Tencent community license) | Official README: 8.3B, training/LoRA, 480p distilled, min ~14 GB VRAM with offload, Linux/CUDA requirements | Alternative controlled T2V/I2V backend for capable hardware | Current founder Windows test device showed Intel UHD Graphics, no nvidia-smi; **not viable as-is on that PC**. Additional geographic/community license restrictions demand specific review. |
| 6 | [VBench-2.0](https://github.com/Vchitect/VBench) @ fd18b3d055cb0fc6f066ca90fe2c3c8cbb698490 (Apache-2.0) | VBench-2.0/README.md and standard prompts: 18 dimensions, physics/human/creative fidelity | Evaluation recipe and prompt corpus only, coupled with human blind review and real export checks | Many metrics require GPU/evaluator weights; partial subset must not be labeled full VBench score. |
| 7 | [Higgsfield official SDK/skills](https://github.com/higgsfield-ai) | Public documented clients, CLI/skills and application templates; remote API | Behavioral/UX/API comparison; possibly optional future provider abstraction | Not local AI generation, may incur charges; **do not enable provider or copy unlicensed templates**. |

**Licenses:** Founder states source-code rebranding permission; retain accurate upstream notices/provenance and distinguish model weights, hosted access, trademarks and consent separately. ComfyUI GPLv3, Wan2.2/Diffusers/VBench Apache-2.0; LTX/Hunyuan community terms. Do not claim permissions imply unlimited model weights, compute, hosted credits or distribution rights. Record modified-file hashes and obligations before transplant.

## 4. Competitive research observations
- Core opportunity is *integrated ownership*: from script/reference → generation → editable timeline → export → revision/recovery, with offline media and deterministic evidence, rather than treating generated clips as immutable results.
- Character identity, multiple reference asset conditioning, controlled camera motion and scene consistency are **must-prove actual model capabilities**, not equivalent to the already-qualified Cinema metadata / manual Director UI.
- For AI output quality, human preference plus VBench-like metrics matter; Higgsfield and Runway are **multi-model platforms**, so "beats Higgsfield" must specify which model/operation/resolution/settings.
- True local inference is hardware-bound: observed Windows QA device: Intel UHD Graphics, no NVIDIA CUDA detected, ~1.9 GB free C: and ~12.7 GB free D: on 2026-10-22. This machine can qualify editing but **cannot reasonably serve as a frontier multi-billion-parameter video inference box** without alternative compute. Do not fill it with checkpoints. No paid infrastructure may be deployed.
- A benchmark organization cannot guarantee 100% category dominance as the field changes. Specific fixed-date confidence-backed wins are the only sound claims.

## Sources read directly
- https://higgsfield.ai/creator-hub/help-center/getting-started/what-is-higgsfield
- https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-cinema-studio
- https://higgsfield.ai/creator-hub/help-center/tools/which-higgsfield-tool-should-i-use
- https://runway.com/changelog
- https://dev.runwayml.com/models/catalog
- https://kling.ai/
- https://lumalabs.ai/ray3
- https://github.com/higgsfield-ai
- https://github.com/Comfy-Org/ComfyUI/blob/master/server.py
- https://github.com/Comfy-Org/ComfyUI/blob/master/execution.py
- https://github.com/Wan-Video/Wan2.2/blob/main/generate.py
- https://github.com/Lightricks/LTX-2
- https://github.com/huggingface/diffusers/blob/main/docs/source/en/api/pipelines/wan.md
- https://github.com/Vchitect/VBench/blob/master/VBench-2.0/README.md
- https://artificialanalysis.ai/methodology/video
- https://arena.ai/leaderboard/video/text-to-video

**Qualification of this record:** live product accounts, proprietary internal source, reproducible competitors' paid outputs, GPU execution of public models, and independent blinded human evaluation were *not performed*. Do not represent this source review as code qualification or proof of superiority.
