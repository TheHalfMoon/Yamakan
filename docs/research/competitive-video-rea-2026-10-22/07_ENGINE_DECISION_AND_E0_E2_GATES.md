# 07 — Engine choice, resources and executable E0–E2 gates

**Decision status:** qualified planning choice, not an active engine, model install, spending permission, production release or inference pass.
**Reviewed:** 2026-10-22. **Evidence baseline:** PR #85 at 6b94ae9.

## Choice: Diffusers first, ComfyUI fallback

Choose a **single, narrowly scoped Python Diffusers worker** for the first proposed Wan2.2 TI2V-5B implementation. Use **ComfyUI only as a fallback research route** if a pinned Diffusers version cannot meet required T2V/I2V controls, operational safety or quality after real smoke tests. Do not run both as authorities. This is a design decision, **not a proof** that the Python worker will be lower memory, faster, safer or supported by current hardware.

**Evidence:** official Diffusers Wan pipeline documentation explicitly lists Wan 2.2 TI2V 5B; official checkpoint is `Wan-AI/Wan2.2-TI2V-5B-Diffusers`. For first-frame I2V, verify the distinct `WanImageToVideoPipeline` path rather than assuming the T2V pipeline accepts image inputs. Sources: https://huggingface.co/docs/diffusers/en/api/pipelines/wan , https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B-Diffusers , https://github.com/huggingface/diffusers/issues/13258 .

**Why first:** a single pinned model and pipeline permit a small, fixed input schema and a simpler no-network job-specific worker protocol; avoid ComfyUI's general node graph, custom-node loading and unauthenticated API/WS risk. This is an architectural hypothesis awaiting implementation measurement.

**Comfy fallback trigger:** demonstrable Diffusers incompatibility at the pinned model, failure to implement necessary cancellation or recovery inside the agreed safety boundary, or a qualified Comfy integration achieving better scope/performance under the same restrictions. Require decision receipt and comparative E0/E1 tests. Do not automatically replace the primary because another tool has a richer GUI.

## Machine/weights budget — reality, not estimates disguised as tests

| Resource | Confirmed / proposed limit | Evidence |
| --- | --- | --- |
| Model | Wan2.2 TI2V-5B: T2V + first-frame I2V, 1280x704, 24 fps reference path | Official Wan2.2 README and Diffusers model card |
| Reference inference GPU | Official Wan2.2 single-GPU offload command specifies **at least 24GB VRAM**; *not* validated yet with Yamakan or Diffusers | https://github.com/Wan-Video/Wan2.2 |
| Checkpoint storage | Official Diffusers HF repository lists approximately **34.2 GB** total repository content; actual chosen snapshot and runtime cache usage must be measured, not assumed equal | https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B-Diffusers/tree/main |
| Extra CPU RAM / temp / cache | UNKNOWN; must be measured on the actual pinned environment with bounded job artifacts, disk reservations, and free-space guard | No inference run |
| Runtime/clip latency | UNKNOWN; benchmark cold and warm latency, VRAM peaks, full 121-frame output, 3 seeds, no cherry-picking | No inference run |
| Existing Windows test host | Intel UHD, no detected NVIDIA GPU, C: ~1.9GB and D: ~12.7GB available at prior check | Earlier authorized Windows QA; these are changing measurements |
| Zero-cost capable GPU slot | **NOT CONFIRMED**. Do not assume free Kaggle/Colab resources offer ≥24GB VRAM or 34GB+ free disk; verify quotas, hardware, terms and retention before provisioning | No reservation or entitlement proven |

**STOP condition:** zero authorized cost plus no verified capable GPU + disk + model-weight authorization = remain at E0–E2 / Category-A editing. Do not download weights on the founder Windows PC or use paid APIs to unblock a check.

## Proposed worker contract (freeze before production implementation)

- **Transport:** spawn a version-pinned, isolated Python worker with a *framed local stdio protocol* (bounded JSON control messages plus input/output files in a unique per-job directory). Never expose an HTTP service or arbitrary Python execution from browser/CLI/agent. Confirm compatibility with Windows process ownership in design review.
- **Authority:** Yamakan SQLite project/timeline, typed commands, durable jobs, sha256 asset store and FFmpeg export stay canonical. Python never writes Yamakan SQLite or project revisions.
- **Request fields:** schema version, approved model id, declared operation (`t2v` or `i2v`), prompt/ref sha256s, fixed resolution/frame count/fps limits, seed, attemptKey, deadline and resource ceilings. All validated before worker spawn.
- **Result fields:** state (`queued`, `running`, `completed`, `failed`, `cancelled`, `quarantined`), output path within job root, complete bytes/sha256, FFprobe media details, execution-time/resource receipt and error code. Validate sha256 and probe before attaching asset.
- **Paths:** no traversals, junction/symlink escapes, arbitrary URLs, other users' files or implicit Hugging Face network fetches. Approved pre-pinned model directory read-only; writable area only the per-job root. Exclude secrets and tokens.
- **Process:** fail closed on missing helper, missing weights, unsupported model, resource cap or containment. Enforce bounded stdout/stderr, deadline and FFprobe; cancellation terminates whole process tree; concurrent same-attempt retries are fenced; interrupted outputs quarantined and not attached.
- **Network:** test outbound denial under actual supported Windows containment (including DNS/HTTP negative controls). No *automatic* Hugging Face/pip/update/model downloads during job execution. Define whether offline Python packages can load successfully.
- **Compatibility:** implement exactly the existing `EngineAdapter` contract. If strict contract changes are necessary, version explicitly and add fake- and absent-engine regression tests. Feature flags stay false until independently qualified.
- **Licensing:** ComfyUI GPLv3 as a separate process is not a blanket exemption from attribution, source and packaging duties. Retain required license notices and obtain distribution-scope review if bundling it or a worker. For Wan verify exact *checkpoint* license/model card separately from inference code.

## Engineering gates — acceptance-grade and flag-off

| Gate | Deliverable | Passing evidence / negative controls |
| --- | --- | --- |
| **E0: safe adapter skeleton** | DiffusersWorker implements EngineAdapter against a deterministic stub (NO weights); candidate paths pinned | Fake parity: capability blocked/available; strict schema; allowed model only; bad class_type/path/hash rejected; no project changes, no network, no worker when ENGINE_ENABLED=false; exact-head unit and adversarial tests |
| **E1: containment** | Restricted Python subprocess supervisor + job dir lifecycle + correct operating-system isolation | Real Windows child process proof, denied outbound egress and foreign file access, kills on timeout/cancel, crash/restart fencing, symlink/reparse rejection, no leftovers; independent security review; no relaxations of existing AppContainer tests |
| **E2: honest no-weights mode** | Offline capability discovery and user-facing reason codes | With model absent: reports BLOCKED/WEIGHTS_ABSENT, refuses inference, emits no fake video, does not install or reach network; with invalid model files: hash/manifest refusal; benchmark Category A still works |
| **F: external founder decision** | Artifact-, budget-, host- and weights-scoped authorization | Founder explicitly approves exact checkpoint, resource environment and scope; no implied approval from REA |
| **E3–E4: real smoke** | One pinned checkpoint on approved capable hardware | 3 seeded T2V and I2V attempts, entire video duration, memory + timings, FFprobe/FFmpeg validation, cancel/OOM/restart controls, retained hashes and runtime receipts; no capability turned on from a single demo |

**Risk register:** (1) Diffusers pipeline/version differences in T2V vs I2V; (2) GPU quota/VRAM absent; (3) Windows Python containment may differ from existing FFmpeg workers; (4) checkpoint and model-card rights; (5) unbounded runtime/cache; (6) compromised prompts/inputs and arbitrary sidecar path resolution; (7) duplicated project/job authority; (8) misleading head-to-head claims. Each requires a recorded passing gate or explicit BLOCKED status.

## Volatile competitor reference corrections

- **Runway:** its live catalog count is mutable. During different checks the page surfaced 58, 59 and 57; **do not freeze a number as a capability**. Refer to the catalog with date/access and actual task/model IDs: https://dev.runwayml.com/models/catalog .
- **Luma:** older Dream Machine endpoint exposes `ray-2`/`ray-flash-2`, but their developer guide points to the newer **Agents API**. Current Agents quickstart documents `ray-3.2` and unified asynchronous request handling: https://docs.lumalabs.ai/docs/welcome ; https://docs.agents.lumalabs.ai/ . Treat old and new API capabilities as different versions.

## Win claims and evaluation

A–G benchmarks remain a **locked study design**. No paid peer generation, open model smoke render, blinded human study or official VBench run happened. Categories A/F/G are stronger Yamakan opportunities but not proof of universal competitive superiority. Include uncertainty bounds and comparative source/quality evidence before public advantage language.

## Handoff

This record selects a *research-backed proposed* path and exact engineering acceptance criteria. It authorizes **no engine implementation, model download, key use, billable provider call or release**. Engineering work beyond documentation requires the existing founder/E-SEC decision process; E0–E2 can be independently planned and scoped before F.
