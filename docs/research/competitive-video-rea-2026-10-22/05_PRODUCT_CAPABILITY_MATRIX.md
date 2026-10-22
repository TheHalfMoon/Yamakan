# Product capability matrix (evidence-graded)

**Research date:** 2026-10-22  
**Grades:** TESTED | DOCUMENTED | INFERRED | BLOCKED | UNKNOWN  
**Rule:** Vendor marketing alone never becomes TESTED. Paid API outputs were **not** executed (no spend).

## Legend — Yamakan columns

- **Y-now:** current main baseline `a3c3ce9` behavior  
- **Y-target:** intended architecture after F/E-SEC (plan only)

---

## A. Generation

| Capability | Higgsfield | Runway | Kling | Luma | Y-now | Y-target | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Text-to-video | DOCUMENTED Cinema Studio 4.0 API: prompt-only when refs empty; duration 4–30; 480p/720p | DOCUMENTED Gen-4.5 + multi-lab catalog | DOCUMENTED Kling 3.0/4.0 family; Omni multimodal | DOCUMENTED Ray-2 / ray-flash-2; 540p–4k listed | BLOCKED (`ENGINE_ENABLED=false`) | Local Wan TI2V-5B or CogVideoX-2B behind adapter | No Yamakan T2V TESTED |
| Image-to-video | DOCUMENTED refs `image_urls` ≤30 | DOCUMENTED Gen-4.5 I2V; catalog peers | DOCUMENTED I2V endpoints; first/last varies by model | DOCUMENTED keyframes frame0/frame1 | BLOCKED | I2V template when model supports | |
| Video-to-video / edit | DOCUMENTED separate Seedance 2.5 for edit/extend; Genjutsu motion-transfer example | DOCUMENTED Aleph 2.0 in-context edit | DOCUMENTED Omni ref + multi-element edit | DOCUMENTED extend / interpolate / reverse extend | Deterministic edit TESTED; generative UNKNOWN | Generative V2V deferred | |
| Native audio in generation | DOCUMENTED `audio_urls` refs ≤10 on Cinema 4.0 | DOCUMENTED many catalog models with native audio | DOCUMENTED native audio on select models (capability map 2026-10-20) | UNKNOWN for Ray-2 API (docs emphasize video assets) | Deterministic audio mix TESTED | LTX deferred; providers off | |
| Multi-shot storytelling | DOCUMENTED creative controls / pacing enums | INFERRED via Agent + multi-call | DOCUMENTED multi-shot on Kling 3.0/4.0 (not all Omni modes) | INFERRED via multiple generations | Director manual TESTED | Shot graph + timeline stitch | |
| 4K output | UNKNOWN/varies by HF model; Cinema 4.0 API enum is 480p/720p only | DOCUMENTED Kling 4K SKUs in catalog; Ruby HDR | DOCUMENTED 4K on Kling 3.0/4.0/Omni rows | DOCUMENTED resolution includes 4k | Export 1280×720 TESTED | No 4K badge without proven native path | |

### Official API anchors (DOCUMENTED)

| Vendor | Anchor URL | Verified facts |
| --- | --- | --- |
| Higgsfield | https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate | `POST .../cinema-studio/4.0`; duration 4–30 default 5; resolution 480p\|720p; refs ≤30 img / ≤10 vid / ≤10 audio / ≤50 total; creative enums for era/genre/light/pacing/lens/camera/color |
| Higgsfield platform | https://docs.higgsfield.ai/ | Async request_id + status/cancel URLs; outputs retained ≥7 days |
| Runway | https://dev.runwayml.com/models/catalog | 58 models listed; Gen-4.5, Aleph 2.0, Seedance, Kling, WAN 3.0, Veo, audio suite |
| Kling | https://kling.ai/document-api/guides/capability-map/video.md | Updated 2026-10-20; models 2.5–4.0; Omni ref limits; motion control on 3.0 & 2.6 |
| Luma | https://docs.lumalabs.ai/docs/video-generation | Models `ray-2`, `ray-flash-2`; concepts; camera_motion list; keyframe extend |

---

## B. Cinematic / character / agent

| Capability | Competitors (grade) | Y-now | Gap |
| --- | --- | --- | --- |
| Optical / style controls conditioned into model | HF Cinema enums DOCUMENTED; Luma concepts/camera motions DOCUMENTED | Cinema **metadata** TESTED; conditioning BLOCKED | Compiler + measured adherence |
| Character / Soul / Elements | HF Soul API example DOCUMENTED; Kling Elements DOCUMENTED | Asset store only; AI consistency UNKNOWN | Refs + model path |
| Agent / MCP / CLI | HF CLI/MCP DOCUMENTED; Runway Agent/plugins DOCUMENTED; Kling Skills DOCUMENTED | Typed MCP/REST TESTED; no inference | End-to-end agent jobs UNKNOWN |
| Multi-model marketplace | Runway catalog DOCUMENTED; HF multi-model console DOCUMENTED | Router providers OFF | Optional after F |

---

## C. Editing, ownership, security (Yamakan strength zone)

| Capability | Competitors | Y-now | Grade |
| --- | --- | --- | --- |
| Offline editable project | Cloud-first products; local NLE separate | Full local project | TESTED (short Windows campaign) |
| Durable jobs / recovery | Varies | Yes | TESTED in product suite |
| Deterministic export H.264/AAC | Common | 1280×720 path | TESTED |
| Arabic RTL automation | Varies | Automated RTL | TESTED; native H1 NOT RUN |
| Closed-by-default egress / explain deny | Rare as product story | Router deny/explain | TESTED in unit/dev profile |
| Provenance / import policy | Rare | Ledger + import guard | DOCUMENTED + engineering TESTED |
| Long real-media NLE stress | Resolve/CapCut stronger | Short clips only | UNKNOWN / NOT TESTED |
| Profile A / multi-user hard security | Enterprise SKUs | Open residuals H1–H5 | BLOCKED / NOT RUN |

---

## D. Open-source candidates (not products)

| Component | Pin | Role | Grade |
| --- | --- | --- | --- |
| ComfyUI | `1a82e6d…` | Sidecar orchestrator | DOCUMENTED interface; NOT integrated |
| Wan2.2 | `1ea34ff…` | Open T2V/I2V/TI2V | DOCUMENTED code; weights NOT loaded |
| Diffusers | `48cdbae…` | Inference library | DOCUMENTED |
| LTX-2 | `e98f6d9…` | A/V candidate | DOCUMENTED; DEFER |
| VBench | `fd18b3d…` | Eval | DOCUMENTED; NOT RUN |
| CogVideo | `7a1af71…` | Alternate small model | DOCUMENTED pin; license per-tier |

---

## E. Cells that remain UNKNOWN / BLOCKED by policy

- Any head-to-head blind preference score  
- Any VBench numeric score  
- Real Higgsfield/Runway/Kling/Luma paid output quality on matched prompts  
- Local GPU inference latency/quality  
- Whether Yamakan Cinema enums can match HF Cinema adherence  

**Do not fill these with guesses.**
