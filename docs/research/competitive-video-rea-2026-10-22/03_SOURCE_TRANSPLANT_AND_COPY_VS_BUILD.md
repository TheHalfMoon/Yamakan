# Source transplant matrix — pins, modules, copy-vs-build

**Date:** 2026-10-22  
**Constraint:** research only; **no code copied into Yamakan production paths**; **no weights downloaded**  
**Pins re-verified via GitHub API on 2026-10-22**

## Decision legend

| Decision | Meaning |
| --- | --- |
| **ADAPTER** | Keep upstream out-of-process; Yamakan talks only through `EngineAdapter` |
| **BUILD** | Implement Yamakan-native logic; do not transplant |
| **EVAL-ONLY** | Use as benchmark recipe/corpus; never ship as product dependency without separate approval |
| **COMPARE** | Study API/UX behavior; do not vendor |
| **DEFER** | Attractive but blocked by license, VRAM, disk, or founder gates |
| **REJECT** | Do not use under current rights/gates |

---

## 1. ComfyUI — orchestration sidecar (ADAPTER)

| Field | Value |
| --- | --- |
| Repo | https://github.com/Comfy-Org/ComfyUI |
| Pin | `1a82e6d01f395b43275c77acd289af1eb7090bb9` (master, 2026-10-22T03:43:22Z) |
| License | GPL-3.0 |
| Yamakan target | Future `core/engines/comfyui.ts` implementing `EngineAdapter` in `core/engines/contract.ts` (**file does not exist today**; only `fake.ts` + `contract.ts`) |
| Copy-vs-build | **ADAPTER** — do **not** vendor ComfyUI into the Yamakan tree; spawn/contain as sibling process |

### Module / function map (inspected surfaces)

| Upstream | Role | Yamakan mapping |
| --- | --- | --- |
| `server.py` | HTTP: `/prompt`, `/history`, `/view`, `/upload/image`, `/ws`; job APIs `/api/jobs`, cancel | `submit` / `status` / `cancel` / `outputs` |
| `execution.py` | Graph schedule, cache, node run | Opaque; never import into Node |
| `nodes.py` + custom nodes | `class_type` registry | **Strict allowlist** only; refuse unknown nodes |
| `folder_paths.py` | Model/input/output roots | Pin job-scoped dirs; no shared global model root writable by browser |
| `main.py` | Process entry | Launch under E-SEC containment |

### Dependency closure (high level)

Python 3 + PyTorch + CUDA (or CPU — impractical for video) + aiohttp websocket stack + optional custom-node packages. **Any custom-node install is a supply-chain event** and is out of scope until separately approved.

### Qualification tests (when E-SEC + F authorized)

1. Adapter refuses submit when `ENGINE_ENABLED=false`.
2. Unknown `class_type` → hard fail before network call.
3. Input `sha256` mismatch → reject; output probe fail → quarantine flag on status.
4. Cancel fences concurrent retry with same `attemptKey`.
5. Process killed mid-job → durable Yamakan job remains recoverable; no orphan shared state in project DB.
6. Network egress from sidecar default-deny except localhost loopback to adapter.

### GPL note

Out-of-process HTTP avoids direct Python linking but does **not** automatically remove GPL, attribution or distribution obligations. Evaluate the actual bundled/released combination and keep required provenance and notices.

---

## 2. Wan2.2 — first open video model family (ADAPTER / DEFER weights)

| Field | Value |
| --- | --- |
| Repo | https://github.com/Wan-Video/Wan2.2 |
| Pin | `1ea34ff48f87168174e12956e200b1d908b1c5ff` |
| License (code) | Apache-2.0 |
| Weights | Separate Hugging Face checkpoints; **not downloaded this REA** |
| Entry | `generate.py` task modes: `t2v-A14B`, `i2v-A14B`, `ti2v-5B`, `animate`, `s2v-14B` |
| Copy-vs-build | **ADAPTER** via Diffusers *or* official CLI under EngineGraph; **do not reimplement diffusion** |

### Recommended first candidate (when hardware + F exist)

| Mode | Why |
| --- | --- |
| **`ti2v-5B`** | Smallest documented Wan2.2 video path in this family; Apache code path; lower VRAM than A14B |
| `t2v-A14B` / `i2v-A14B` | Quality ceiling candidates; **DEFER** until GPU with sufficient VRAM and disk |
| `s2v-14B` / animate | Character/motion — **DEFER** until base T2V/I2V qualified |

### Integration target

Map one pinned pipeline to a single allowlisted EngineGraph template, e.g. `yamakan.wan22.ti2v5b/v1`, with fixed seed, resolution, duration bounds, and content-hashed I/O. Outputs land in content-addressed media store, then attach via typed timeline ops — never mutate project authority inside the Python process.

### Qualification tests

1. License + model-card rights ledger entry before any download.
2. Dry-run graph validation without weights present → clear `BLOCKED` capability reason.
3. After authorized download on capable host: fixed prompt/seed → bit-stable or metric-stable within documented tolerance.
4. OOM / cancel paths mirror fake-engine fencing tests.

---

## 3. Hugging Face Diffusers — inference library (ADAPTER)

| Field | Value |
| --- | --- |
| Repo | https://github.com/huggingface/diffusers |
| Pin | `48cdbaef5ee3d718aaee392b44f2099ae511c4a5` |
| License | Apache-2.0 |
| Docs inspected | Wan pipeline docs under `docs/source/en/api/pipelines/wan.md` |
| Copy-vs-build | **ADAPTER** — prefer Diffusers sidecar **or** Comfy, **not both as dual authorities** |

**Updated proposed choice:** Prefer exactly one implementation spine; see [07](07_ENGINE_DECISION_AND_E0_E2_GATES.md). This is not proof of real inference or safety.

1. **PRIMARY Path A:** Diffusers + Wan2.2 TI2V-5B as a pinned Python worker behind bounded stdio and job-scoped files; CogVideoX-2B only after independent qualification.  
2. **FALLBACK Path B:** ComfyUI with one allowlisted workflow JSON, port/WS isolation and no unreviewed custom nodes; adopt only with a reasoned decision.

Do not ship both as simultaneous production authorities. Official Wan TI2V-5B offload reference requires **at least 24GB VRAM**, and the Diffusers checkpoint repository lists **~34.2GB**. No GPU slot/disk allocation has been confirmed and no inference has run.

---

## 4. LTX-2 — audio-video secondary (DEFER)

| Field | Value |
| --- | --- |
| Repo | https://github.com/Lightricks/LTX-2 |
| Pin | `e98f6d927d83c92ef2be6aec76c8440b19306e39` |
| License | LTX Community License (commercial threshold ~$10M ARR per upstream terms — verify before any commercial use) |
| Why interesting | Synchronized audio-video, keyframe conditioning |
| Blockers | Large VRAM (~32GB+ class per upstream guidance for full models); community license review; not first ship candidate |
| Copy-vs-build | **DEFER** until Wan/Cog path proven and license counsel/founder OK |

---

## 5. CogVideoX — alternate small open model (ADAPTER candidate)

| Field | Value |
| --- | --- |
| Repo | https://github.com/THUDM/CogVideo (org may show as zai-org redirect) |
| Pin | `7a1af7154511e0ce4e4be8d62faa8c5e5a3532d2` (main, 2026-10-22) |
| Note | **CogVideoX-2B** historically Apache-2.0; **5B** uses a custom/community license — treat tiers separately |
| Copy-vs-build | **ADAPTER** as fallback if Wan TI2V-5B unavailable or fails qualification |
| Status | Source pin only; **no weights**; verify current LICENSE file per checkpoint before any download |

---

## 6. VBench-2.0 — evaluation only (EVAL-ONLY)

| Field | Value |
| --- | --- |
| Repo | https://github.com/Vchitect/VBench |
| Pin | `fd18b3d055cb0fc6f066ca90fe2c3c8cbb698490` |
| License | Apache-2.0 |
| Use | Prompt corpus + dimension definitions; optional GPU evaluators later |
| Copy-vs-build | **EVAL-ONLY** — never embed evaluator weights into product runtime |
| Rule | Partial local proxies must be labeled **LOCAL PROXY**, not “VBench score” |

---

## 7. HunyuanVideo-1.5 — (DEFER)

Tencent community license + CUDA Linux orientation + multi-GB weights. Useful comparison later on capable GPU hosts. **Not** viable on founder Intel UHD Windows QA machine. **DEFER**.

---

## 8. Closed platforms — (COMPARE / REJECT transplant)

| Source | Decision | Reason |
| --- | --- | --- |
| Higgsfield Cinema Studio / Soul / Canvas backends | **REJECT** transplant | Private; public GitHub is training framework/CLI/SDK only |
| Higgsfield JS SDK / CLI / skills | **COMPARE** | Inform async job UX; optional future provider adapter behind F — **disabled** |
| Runway Dev API catalog | **COMPARE** | Multi-model marketplace pattern; paid |
| Kling document-api | **COMPARE** | Capability map dated 2026-10-20; paid |
| Luma Dream Machine API | **COMPARE** | Ray-2 / ray-flash-2; paid |
| Higgsfield `app-templates` | **REJECT** until license verified | Repo license metadata incomplete at inspection |

---

## 9. Yamakan-native (BUILD — already exists or must stay native)

| Component | Decision | Notes |
| --- | --- | --- |
| Canonical project / timeline / revisions | **BUILD** (keep) | Single authority |
| Durable jobs + attemptKey fencing | **BUILD** (keep) | Align adapter to existing job model |
| Content-addressed media + quarantine | **BUILD** (keep) | Generation outputs are assets, not project mutations |
| Command registry / MCP / REST | **BUILD** (keep) | Agentic surface without new authority |
| Cinema camera/scene metadata | **BUILD** (keep) | Metadata ≠ model conditioning until mapped |
| FFmpeg export / AV sync | **BUILD** (keep) | Deterministic edit path |
| Quality Lab | **BUILD** (keep) | Deterministic checks; not generative Elo |
| Prompt→conditioning compiler (era/lens/light → engine inputs) | **BUILD** when engines on | Do not pretend Cinema UI already conditions models |
| Character identity store (refs, hashes, consent) | **BUILD** | Model adherence still UNKNOWN until tested |
| Provider marketplace router | **BUILD** scaffold only; **OFF** | `ROUTER_PROVIDERS_ENABLED=false` |

---

## 10. What this REA explicitly did **not** do

- No `git clone` of donors into the Yamakan working tree for production use  
- No weight downloads  
- No paid API calls  
- No enabling `ENGINE_ENABLED`  
- No claim that ComfyUI or Wan “works” inside Yamakan  

Pins and maps above are **implementation-ready research artifacts** for a future engineering PR after founder F / E-SEC / compute approval.
