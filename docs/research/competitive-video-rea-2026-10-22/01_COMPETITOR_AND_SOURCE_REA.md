# Yamakan — Competitive Video REA (implementation-ready evidence)

**Research date:** 2026-10-22  
**Package:** see [00_INDEX.md](00_INDEX.md)  
**Scope:** evidence-based product reconnaissance and source-first architecture research; **NOT a claim of product superiority, implementation authorization, performance benchmark, or release approval**.  
**Baseline:** Yamakan main a3c3ce91815aee35ce5b91b4a483dd85766a4429; P10 and Windows UX QA complete, public release NO-GO.

## Executive conclusion
Yamakan is a tested offline-first media editor/production workspace, with canonical SQLite history, typed operations, real Windows Edge editing/export acceptance, Studio drawing, Cinema camera/scene metadata, manual Director workflows, deterministic Quality Lab, supported animation, audio processing, and MCP/REST support. **Local generative engine is disabled** (`ENGINE_ENABLED=false`; only `contract.ts` + `fake.ts` exist — no `comfyui.ts` yet), as are paid/cloud providers. Thus there is *no supported evidence* that Yamakan currently matches or beats Higgsfield/Runway/Kling/Luma in AI-video output. Windows 6-second synthetic clip export is not a T2V/I2V benchmark. Universal "100% better" is not a verifiable scientific promise; benchmark specified jobs-to-be-done and publish failures honestly.

Recommended differentiated product: **offline-first, agent-native, reproducible cinematic production studio**, unifying generation (when legitimately enabled), deterministic timeline editing, exact projects, Arabic-first workflows, export, privacy, and inspectable quality evidence. Compete against closed providers by controlling the *complete editable outcome* and true cost, not by pretending a free model beats every proprietary video model.

**Architecture recommendation (detail in [04](04_TARGET_ARCHITECTURE_AND_ROADMAP.md)):** keep Yamakan as sole project authority; out-of-process **Diffusers-first** sidecar (ComfyUI as qualified fallback) behind `EngineAdapter`; first open checkpoint **Wan2.2 TI2V-5B** (Apache code) with **CogVideoX-2B** alternate; LTX/14B deferred; providers off until F.

## 1. Verified competitor capability map
Unless marked **TESTED**, rows below are **DOCUMENTED** from official APIs/docs on 2026-10-22, not independently generated outputs.

| Product (vendor source) | Observed capability | Yamakan today | Critical gap / comparison task |
| --- | --- | --- | --- |
| [Higgsfield creative suite](https://higgsfield.ai/creator-hub/help-center/getting-started/what-is-higgsfield) | Cinema Studio / Soul ID / Marketing Studio / Canvas / Supercomputer (help-center) | Cinema metadata, Director manual, typed MCP/REST, offline edit | Character AI, conditioned optics, multi-model host |
| [Higgsfield Cinema Studio 4.0 API](https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate) | **DOCUMENTED:** `POST /higgsfield/cinema-studio/4.0`; duration **4–30s** (default 5); resolution **480p\|720p**; refs ≤**30** images / **10** videos / **10** audio / **50** total; enums for era, genre, light, pacing, camera_lens, camera_model, color_palette, aspect_ratio; prompt tokens `<<<image_1>>>` etc.; edit/extend via **separate Seedance 2.5** endpoints | Camera metadata ≠ model conditioning | Measure enum→pixel adherence; do not use marketing “1 minute” without API confirmation |
| [Higgsfield platform API](https://docs.higgsfield.ai/) | Async `request_id` + status/cancel; Key auth; SDKs; outputs ≥7 days | Durable jobs exist; no HF provider | Optional future provider adapter (OFF) |
| [Higgsfield CLI/MCP](https://higgsfield.ai/creator-hub/help-center/tools/which-higgsfield-tool-should-i-use) | Agent-directed generation from coding tools | Typed offline MCP, no inference | End-to-end agent task completion |
| [Runway model catalog](https://dev.runwayml.com/models/catalog) | **DOCUMENTED:** Gen-4.5, Aleph 2.0, Seedance 2.x/2.5, Kling 3.0/O3 SKUs, WAN 3.0, Veo 3.1, Gemini Omni, audio/ElevenLabs, Ruby HDR, Model Router; live model catalog (count varies) | Real timeline; no generative routing | Marketplace + generative edit fidelity |
| [Kling API capability map](https://kling.ai/document-api/guides/capability-map/video.md) (updated **2026-10-20**) | **DOCUMENTED:** Kling 4.0 (3–30s, 720P–4K), 3.0/Omni/Turbo, O1, 2.6, 2.5; Omni refs; Elements; Motion Control on 3.0 & 2.6; native audio rows vary by model | Local timeline only | Motion control, elements, native audio |
| [Luma Dream Machine API](https://docs.lumalabs.ai/docs/video-generation) | **DOCUMENTED:** legacy Dream Machine: `ray-2` / `ray-flash-2`; current **Luma Agents API: `ray-3.2`**, with separate endpoint, generation and editing controls | Opacity/volume keyframes; no AI V2V | Controlled ref edit, extend quality |
| Conventional NLE (Resolve, CapCut) | Professional editing depth | 1280×720 H.264/AAC short path TESTED | Long-timeline, color, format breadth |

**Provenance:** Official API docs fetched 2026-10-22. Help-center marketing may still conflict with API enums — **API schema wins** for engineering limits. No paid generations executed.

### Higgsfield "source code" distinction
Verified public GitHub organization: https://github.com/higgsfield-ai. The public [higgsfield](https://github.com/higgsfield-ai/higgsfield) repository is an older distributed GPU/LLM training framework, **not the Cinema Studio generation backend**. Published [CLI](https://github.com/higgsfield-ai/cli), [skills](https://github.com/higgsfield-ai/skills), [JavaScript SDK](https://github.com/higgsfield-ai/higgsfield-js), and [app templates](https://github.com/higgsfield-ai/app-templates) can inform *documented interface and agent workflow behavior*. SDK/CLI route to hosted services; they do not grant a local video model. app-templates has no license metadata in current GitHub repo API; do not transplant its files without verifying appropriate authorization. This REA does not require or attempt to extract inaccessible private backend source.

## 2. Actual Yamakan engineering seam inspected
- `core/engines/contract.ts`: `ENGINE_CONTRACT = yamakan.engine-adapter/v1`; graph nodes with allowlisted `class_type`; content-hash I/O; `attemptKey`; submit/status/cancel/outputs; **`ENGINE_ENABLED = false`**. Comment references future `comfyui.ts` — **file does not exist** (only `fake.ts` + `contract.ts`).
- `core/engines/fake.ts`: simulated result only; cancellations, retry fencing, quarantine; not real generation.
- `core/router/explain.ts`: deterministic deny/explain; providers disabled / eligible empty.
- `docs/FOUNDER_DECISION_RECORD.md`: E-SEC and founder decisions **F** and **G** remain binding; weight download, paid providers, real engines, production release not approved by prior P10 instructions.
- Windows qualification: real browser import/edit/export and product campaign on main — proves editing, **not** AI video.

### Avoid destructive integration
Keep one Yamakan project authority, typed command registry, project revision history, durable jobs, safe asset store, FFmpeg pipeline, closed-by-default egress and approved Windows containment. Do not vendor entire competing applications or create second queues, a second timeline database, unrestricted Comfy node imports, or duplicate project semantics.

## 3. Verified public donor-source REA matrix
Pins re-checked via GitHub API on 2026-10-22; no code copied into production paths; no models downloaded. Full copy-vs-build in [03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md](03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md).

| Rank | Source / pin | Real inspected interface | Candidate reuse / Yamakan boundary | Limitations and status |
| --- | --- | --- | --- | --- |
| 1 | [ComfyUI](https://github.com/Comfy-Org/ComfyUI) @ `1a82e6d01f395b43275c77acd289af1eb7090bb9` (GPL-3.0) | `server.py`: /prompt, /api/jobs, cancel, /upload/image, /view, /history, /ws. `execution.py`: schedule/cache | Out-of-process **ADAPTER** → future `comfyui.ts`; job-scoped dirs; allowlist only | Containment, OOM, WS security. **Not integrated.** |
| 2 | [Wan2.2](https://github.com/Wan-Video/Wan2.2) @ `1ea34ff48f87168174e12956e200b1d908b1c5ff` (Apache-2.0) | `generate.py`: t2v-A14B / i2v-A14B / **ti2v-5B** / animate / s2v-14B | First model candidate: **ti2v-5B**; single pinned EngineGraph | Weights large; Intel UHD host unsuitable. **No weights.** |
| 3 | [Diffusers](https://github.com/huggingface/diffusers) @ `48cdbaef5ee3d718aaee392b44f2099ae511c4a5` (Apache-2.0) | Wan pipeline docs | Prefer **one** of Diffusers **or** Comfy as authority | No transplant this REA |
| 4 | [LTX-2](https://github.com/Lightricks/LTX-2) @ `e98f6d927d83c92ef2be6aec76c8440b19306e39` (community) | A/V sync, keyframes | **DEFER** secondary | ~32GB+ class; license review |
| 5 | [CogVideo](https://github.com/THUDM/CogVideo) @ `7a1af7154511e0ce4e4be8d62faa8c5e5a3532d2` | CogVideoX family | **Alternate** small checkpoint (verify 2B Apache vs 5B custom per LICENSE) | No weights |
| 6 | [HunyuanVideo-1.5](https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5) | Community T2V/I2V | **DEFER** | CUDA Linux; community license |
| 7 | [VBench](https://github.com/Vchitect/VBench) @ `fd18b3d055cb0fc6f066ca90fe2c3c8cbb698490` (Apache-2.0) | VBench-2.0 dims/prompts | **EVAL-ONLY** | Partial ≠ official score |
| 8 | [Higgsfield GitHub](https://github.com/higgsfield-ai) | CLI/SDK/skills; old training repo ≠ Cinema backend | **COMPARE** only | No local model; no unlicensed template copy |

**Licenses:** Founder source-rebrand rights ≠ weights, hosted credits, trademarks. Comfy GPL → out-of-process only. Record SHA/path/hash before any transplant.

## 4. Competitive research observations
- Core opportunity is *integrated ownership*: from script/reference → generation → editable timeline → export → revision/recovery, with offline media and deterministic evidence, rather than treating generated clips as immutable results.
- Character identity, multiple reference asset conditioning, controlled camera motion and scene consistency are **must-prove actual model capabilities**, not equivalent to the already-qualified Cinema metadata / manual Director UI.
- For AI output quality, human preference plus VBench-like metrics matter; Higgsfield and Runway are **multi-model platforms**, so "beats Higgsfield" must specify which model/operation/resolution/settings.
- True local inference is hardware-bound: observed Windows QA device: Intel UHD Graphics, no NVIDIA CUDA detected, ~1.9 GB free C: and ~12.7 GB free D: on 2026-10-22. This machine can qualify editing but **cannot reasonably serve as a frontier multi-billion-parameter video inference box** without alternative compute. Do not fill it with checkpoints. No paid infrastructure may be deployed.
- A benchmark organization cannot guarantee 100% category dominance as the field changes. Specific fixed-date confidence-backed wins are the only sound claims.

## Package cross-links
- [00_INDEX.md](00_INDEX.md) — DoD and grades  
- [02_BENCHMARK_AND_CONTINUATION_PLAN.md](02_BENCHMARK_AND_CONTINUATION_PLAN.md) — fair protocol + REA closure  
- [03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md](03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md) — pins and decisions  
- [04_TARGET_ARCHITECTURE_AND_ROADMAP.md](04_TARGET_ARCHITECTURE_AND_ROADMAP.md) — architecture  
- [05_PRODUCT_CAPABILITY_MATRIX.md](05_PRODUCT_CAPABILITY_MATRIX.md) — feature × grade  
- [06_OUTPERFORM_GAPS_AND_PATH.md](06_OUTPERFORM_GAPS_AND_PATH.md) — win/gap/path  

## Sources read directly (2026-10-22)
- https://docs.higgsfield.ai/
- https://docs.higgsfield.ai/docs/llms.txt
- https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate
- https://higgsfield.ai/creator-hub/help-center/getting-started/what-is-higgsfield
- https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-cinema-studio
- https://dev.runwayml.com/models/catalog
- https://runway.com/changelog
- https://kling.ai/document-api/guides/capability-map/video.md
- https://kling.ai/document-api/llms.txt
- https://docs.lumalabs.ai/docs/video-generation
- https://lumalabs.ai/ray3
- https://github.com/higgsfield-ai
- https://github.com/Comfy-Org/ComfyUI (pin `1a82e6d…`)
- https://github.com/Wan-Video/Wan2.2 (pin `1ea34ff…`)
- https://github.com/huggingface/diffusers (pin `48cdbae…`)
- https://github.com/Lightricks/LTX-2 (pin `e98f6d9…`)
- https://github.com/Vchitect/VBench (pin `fd18b3d…`)
- https://github.com/THUDM/CogVideo (pin `7a1af71…`)
- https://artificialanalysis.ai/methodology/video
- https://arena.ai/leaderboard/video/text-to-video

**Qualification of this record:** live paid product accounts, proprietary backend source, reproducible competitors' paid outputs, GPU execution of public models, D1/Alibaba/Graft formal reviews, and independent blinded human evaluation were *not performed*. Do not represent this source review as code qualification or proof of superiority. Public release remains **NO-GO**.


**Follow-up 2026-10-22:** Live Runway model counts varied between snapshots (57, 58 and 59); the number is not a frozen capability. Older Luma Dream Machine docs now refer to newer Luma Agents API/Ray 3.2. Wan TI2V-5B's official offload example requires ≥24GB VRAM; the Diffusers checkpoint repository lists ~34.2GB. No compatible free GPU/storage slot has been verified. See [07](07_ENGINE_DECISION_AND_E0_E2_GATES.md).
