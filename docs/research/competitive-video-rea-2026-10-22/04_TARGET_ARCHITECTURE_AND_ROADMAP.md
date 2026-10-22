# Target architecture and roadmap (implementation-ready plan)

**Status:** RESEARCH PLAN — not implementation authorization  
**Date:** 2026-10-22  
**Preserve:** canonical project, durable jobs, security boundaries, completed P10 / Windows UX QA  
**Gates:** `ENGINE_ENABLED=false`, E-SEC, founder F/G, public release **NO-GO**

## 1. Product thesis (evidence-backed)

Yamakan should not try to out-market Runway/Higgsfield/Kling/Luma on raw hosted model leaderboards while engines are off and the founder host has no CUDA. The strongest achievable product is:

> **Offline-first, agent-native, reproducible cinematic production studio** — generation (when legitimately enabled) feeds **immutable content-addressed media** into a **single editable project authority**, with deterministic export, recovery, Arabic/RTL support, and inspectable quality evidence.

Compete on **complete editable outcome ownership, privacy, cost transparency, and agent reliability**, not on claiming a free local model beats every proprietary T2V.

## 2. Authority diagram (must not break)

```
┌─────────────────────────────────────────────────────────────┐
│  Yamakan (canonical)                                         │
│  Project / Timeline / Revisions / Command registry / MCP     │
│  Durable jobs · Asset store (sha256) · FFmpeg export         │
│  Cinema metadata · Director stages · Quality Lab             │
└───────────────┬─────────────────────────────┬───────────────┘
                │ typed ops only              │ EngineAdapter
                ▼                             ▼
        Attach / edit / export      ┌─────────────────────┐
                                    │ Sidecar (optional)  │
                                    │ Diffusers first
                                    │ ComfyUI fallback only  │
                                    │ allowlisted graphs  │
                                    │ local loopback only │
                                    └─────────────────────┘
                                              │
                                              ▼
                                    Content-addressed media
                                    (never writes project DB)
```

**Hard rules**

1. One project/timeline model; one current frontier.  
2. Sidecar never becomes a second persistence owner.  
3. Providers remain a separate, disabled router path.  
4. Cinema metadata does not equal optical model conditioning until a measured compiler exists.  
5. No unrestricted Comfy custom-node graph from browser or agent.

## 3. Generation → edit pipeline

| Stage | Owner | Contract |
| --- | --- | --- |
| Brief / scene / refs | Yamakan Director + Cinema | Typed, versioned |
| Capability check | `EngineAdapter.capabilities()` | `available:false` with reason until F |
| Submit | Durable job + `attemptKey` | Idempotent fencing |
| Run | Sidecar | Allowlisted `class_type` / pipeline id |
| Probe | Adapter | sha256 + media probe; quarantine on fail |
| Attach | Typed timeline op | User/agent approval optional |
| Edit / animate / audio | Yamakan NLE | Already qualified path |
| Export | FFmpeg | Provenance receipt |
| Reopen / recover | Project revisions | Existing recovery |

## 4. Cinematic control architecture

**Today (TESTED as metadata UI, not as generation conditioning):** camera, lens, scene saves.

**Target (when engines on):**

1. **Control compiler** (Yamakan-owned): maps Cinema enums → prompt fragments and/or ControlNet/reference bindings for the active pipeline.  
2. **Reference budget**: enforce Yamakan-side caps independent of vendor marketing (e.g. start with ≤4 images, ≤1 video ref for open models).  
3. **Shot graph**: Director stages produce N shot requests; each is a job; stitch on timeline, not inside the model.  
4. **Fairness:** Higgsfield Cinema Studio 4.0 API documents real conditioned enums (`camera_lens`, `light`, `pacing`, `era`, …) on `POST /higgsfield/cinema-studio/4.0` with duration 4–30s and 480p/720p — Yamakan must not claim parity until the compiler + model path measures adherence.

## 5. Character consistency

| Layer | Approach |
| --- | --- |
| Asset | Character pack: consent, refs, hashes, voice refs (store only) |
| Generation | Prefer models with element/ref APIs when providers on; open path via I2V / first-last frame / IP-Adapter-class tools when licensed |
| Edit | Timeline replaces bad shots without regenerating whole film |
| Measure | Blind identity preference + face/embedding proxy labeled LOCAL PROXY |

Do not equate Soul ID marketing with Yamakan having character AI.

## 6. Audio architecture

| Path | Plan |
| --- | --- |
| Deterministic | Keep FFmpeg AAC mix, volume keyframes (already in product) |
| Generative A/V | LTX-2 deferred; native-audio closed models are paid COMPARE only |
| Speech/SFX providers | ElevenLabs-class via Runway catalog etc. — **OFF** until F + budget |
| Policy | Separate silent vs native-audio benchmarks (see doc 02) |

## 7. Agentic production

Reuse — do not replace — the command registry and durable jobs:

1. Plan brief → shot list (deterministic planner or LLM behind same deny/explain router).  
2. For each shot: generate or skip with explicit capability reason.  
3. Attach → human or policy gate → edit → export.  
4. Resume from job state; never invent success when engine absent.

MCP/REST already differentiate Yamakan from “chat-only” tools; they are not a substitute for inference.

## 8. Security boundaries (E-SEC prerequisites)

Before any real sidecar:

- [ ] AppContainer / process isolation for Python worker  
- [ ] Default-deny egress; allowlist model host only if provider path  
- [ ] Job-scoped temp dirs; wipe on complete/fail  
- [ ] Model path read-only to worker; write only to job output dir  
- [ ] Graph allowlist + size limits  
- [ ] No browser-direct Comfy port exposure  
- [ ] Secrets never in project JSON  
- [ ] Provenance ledger entries for any imported code/weights  

## 9. Roadmap (shortest credible path)

| Phase | Name | Exit criteria | Gate |
| --- | --- | --- | --- |
| **R0** | This REA package | Docs merged on research branch; NO-GO | Done in #85 |
| **R1** | Engineering plan PR (no enablement) | Founder-approved milestone list, resource budget | Founder read |
| **E0** | Adapter skeleton behind flag | `diffusers_worker` implements bounded stdio/file contract; `ENGINE_ENABLED=false`; tests vs fake/absent parity. ComfyUI only if evidence-backed fallback | E-SEC design review |
| **E1** | Containment | Sidecar launches under isolation; egress tests pass | E-SEC |
| **E2** | First model dry-run | Capability reports `BLOCKED: weights absent` cleanly | No download yet |
| **F** | Founder decision F | Explicit written authorization for exact weight files + capable GPU/storage host | **Required** |
| **E3** | Download + pin one checkpoint | Wan TI2V-5B **or** CogVideoX-2B only; ledger hash | F + disk/GPU |
| **E4** | Local generation smoke | 3 fixed seeds; artifacts hashed; quarantine paths | Capable GPU host |
| **B1** | Category A expand | Longer real-media edit suite (no AI needed) | Can start now |
| **B2** | Blind T2V subset | Only after E4; vs paid competitors only if budget approved | Separate spend auth |
| **P** | Provider adapters | Optional; default off; SSRF + key vault | F + budget |
| **G** | Release decision G | Public ship | **NO-GO until G** |

**Parallel (no engine):** deepen Category A/F/G benchmarks, Arabic H1, Profile A security — these improve the product without F.

## 10. Explicit non-roadmap (do not do next)

- Enable engines on Intel UHD Windows QA box  
- Download 14B/32GB-class weights onto scarce disks  
- Vendor entire ComfyUI or competitor UIs  
- Claim Cinema metadata as generation control  
- Turn marketing “beats Higgsfield” into a release goal  
- Fabricate D1/Alibaba/Graft review passes  

## 11. Review tooling honesty

| Tool | This session |
| --- | --- |
| Local D1 | Not invoked / not available as a completed review artifact |
| Alibaba Code Review | Not available |
| PStack / Graft | Not run as formal reviews on this doc set |
| Independent research reviewers | Human founder + this REA; no third-party blind study |

Absence is recorded as **NOT RUN**, not pass.


## Post-review engine/spend decision (2026-10-22)

**Diffusers is the proposed first sidecar** for one pinned Wan2.2 TI2V-5B path (ComfyUI is a gated fallback); a framed stdio+job-dir boundary reduces exposed network surface. This still requires actual E0–E2 isolation tests, pin compatibility, model-card checks and an independent threat assessment. Wan's offload reference needs ≥24GB VRAM; Diffusers checkpoint repo ~34.2GB files. No zero-cost GPU entitlement or inference has been demonstrated. See [07](07_ENGINE_DECISION_AND_E0_E2_GATES.md). Keep engines/providers OFF and public release NO-GO.
