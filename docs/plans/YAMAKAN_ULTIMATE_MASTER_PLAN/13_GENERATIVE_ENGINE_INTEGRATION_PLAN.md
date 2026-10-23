# Model-independent generative integration plan

No weights, inference, training, paid calls or engine activation are authorized by this package. `ENGINE_ENABLED=false` and provider flags remain false. Paradigm is unchanged; Plume is deferred. Engine contracts are in [10](10_FINAL_TARGET_ARCHITECTURE.md), inspected donor code in [08](08_SOURCE_DONOR_MASTER_MATRIX.md).

## Revise the old decision without discarding its safety work

PR #85 selects Diffusers-first/Wan2.2 TI2V5B. Its small fixed worker surface is plausible, but no matched runtime evidence selects it over an official model CLI or a locked Comfy recipe. Retain its missing-weights, no-network, containment, resource and publication gates. Supersede the unconditional backend/checkpoint preference with a bounded qualification decision. Do not force a current top model into an unsafe existing graph API.

| Candidate | Source evidence | Main benefit | Main risk | Current disposition |
|---|---|---|---|---|
| Diffusers worker | Pinned pipeline implementation inspected in08 | Narrow operation wrapper, library-level control | Dependency/torch/CUDA closure; cancellation may still decode/output; model/version compatibility | WRAP candidate, real execution BLOCKED |
| Official model CLI | Native Wan is discovery/license-only in this pass; prior PR85 inspected entry surfaces | Potential upstream reference behavior | Requires fresh implementation/closure inspection; runtime downloads,descendants and paths | DEFER source selection until native entry is inspected |
| Locked Comfy workflow | Server/execution/node loading inspected | Rich existing conditioning graphs | Python custom-node execution, graph/server attack surface, competing scheduler | WRAP only if strict allowlist and containment prove value |
| LTX/CogVideo/Hunyuan/current alternatives | Exact sampled modules or explicitly deferred discovery in08 | Alternative controls/A-V/memory tradeoffs | Code/weight terms, large hardware/storage and platform closure | DEFER activation; source qualification varies |
| Hosted Higgsfield/Runway/Kling/Luma/etc | Versioned API docs and sampled SDK source | Optional frontier model access | Money, privacy, egress, entitlements and uncertain cancellation | DEFER execution until separate scope/budget |
| Future Plume | Interface compatibility only | Founder checkpoint plugs into same adapter | Readiness/hardware/rights/quality unknown | DEFER model; no training dependency |

## Qualification sequence

**E0 contract:** v2 strict operation/capability schema, artifact handles, v1 fake bridge, bounded control/diagnostic frames, no raw graph/public paths. Deterministic adapter fixtures exercise capability absence, unsupported controls and output quarantine. No actual model package required.

**E1 containment:** a dependency-free stand-in worker exercises restricted files, network denial, process ownership, timeout/cancel, output validation and restart fencing on actual Windows. Existing single-process Job Object policy cannot accommodate arbitrary Python descendants. Specify a reviewed worker-tree profile; fail closed if unsupported. File read sentinels, DNS/TCP/HTTP negative controls and service/helper death must actually run. OS isolation is proven by denial tests, not merely by environment variables like offline mode.

**E2 no-weights qualification:** local discovery uses only approved pinned manifest metadata; no import that auto-downloads, no HF/cache/pip updates and no arbitrary model plugins. Absent/corrupt/unsupported checkpoint returns a reason code before spawn/inference. Stub output is labeled test data and never shown as generated video. These engineering milestones can be built without weights after implementation authorization.

**E-SEC:** independent security review and actual worker containment evidence on the proposed supported configuration. AppContainer/restricted-token/native executable policy and GPU driver access need specific tests. Passing FFmpeg containment does not automatically qualify torch/Python.

**F:** founder explicitly authorizes an immutable code/runtime/model-weight manifest, exact host/GPU/RAM/disk, allowed operation/data, maximum spend and retention. No free service entitlement assumed; no approval inferred from planning or repository rights.

**E3 first real qualification:** verify each weight/source/license/hash and runtime closure on that host; three fixed-seed T2V/I2V smoke attempts minimum, complete clip validation, resource/cost/cancel/OOM/restart tests. Three attempts are operational smoke, not a quality benchmark. Run candidate comparison only on common supported operations; retain failures. Decide the first worker with a signed evidence record.

**E4 applied controls:** measure actual camera/reference/identity/first-last/native-audio behavior separately. Unsupported controls stay unavailable; approximate prompt-based control is explicitly labeled. Model manifest includes qualification dataset/protocol hash and supported profile constraints. A new checkpoint/quantization/attention backend/driver invalidates affected results.

## Manifest and input policy

Record code commit and module hashes, interpreter/package lock/hash, model weight list+hashes+license text, tokenizer/encoder/VAE dependencies, pipeline/recipe version, device/precision/offload policy, approved profiles and expected disk/RAM/VRAM. A metadata-only qualification is **CAN QUALIFY WITHOUT WEIGHTS**, not MODEL READY. Quantization reduces precision and may require additional code/weight terms; do not advertise it as a measured low-memory solution until run.

Reference assets carry purpose, immutable media version/hash, consent link and role (identity/scene/motion/pose/depth/start/end/audio). Explicitly map supported roles through a compiler. The job records both user intent and exact lowered conditioning digest. It never silently drops a role, installs a custom node or substitutes a model. Model directories read-only; worker writes only private staging; service validates every artifact and owns publication.

## Plume compatibility

Future Plume contributes a manifest and an EngineAdapter implementation or a recipe on an already qualified backend. It must report its true capabilities, hardware requirements and unsupported operations, obey the same job/consent/artifact contracts, and pass the same comparison corpus. No Yamakan database, timeline, tool name or UI workflow depends on a Plume architecture or training completion. No Paradigm training files are edited or task-planned here.
