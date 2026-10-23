# Security, cost, hardware and release gates

Current authority: founder directive2026-10-23, `AGENTS.md`, `docs/FOUNDER_DECISION_RECORD.md`, `docs/SECURITY.md`, `docs/OPERATIONAL_CONTRACTS.md`, [issue77](https://github.com/TheHalfMoon/Yamakan/issues/77). The directive authorizes this planning branch and Draft PR only. No public release, merge, production implementation, training, model weights, paid services or video inference.

## Feasibility classes

| Work | Class | Conditions |
|---|---|---|
| Canonical document/backup/undo cohesion, bounded media, UI/tests | CAN BUILD NOW | Technically no video weights needed; separate implementation authorization still required |
| Engine schemas, fake adapters, missing-weights behavior, stand-in containment | CAN QUALIFY WITHOUT WEIGHTS | Actual Windows tests/native helper/dependency environment still needed |
| Frontier open video inference/conditioning/native A-V | REQUIRES CAPABLE GPU | Exact manifest/RAM/VRAM/disk/runtime and model rights must be qualified |
| Checkpoint access, hosted account, likeness/voice disclosure | REQUIRES EXTERNAL AUTHORIZATION | F/consent/privacy/entitlement tied to exact scope |
| Paid provider bake-off, sustained hosted inference, signing certificate | REQUIRES PAID RESOURCES | Current budget0; do not purchase or activate |
| Local large models on scarce disks/unverified GPU; guaranteed free production GPU | BLOCKED OR INFEASIBLE UNDER CURRENT CONSTRAINTS | No proof of compatible allocation/entitlement; no workaround downloads |

Measured filesystem free space at initial inspection: C about5.12GB,D about8.17GB decimal (volatile); existing source receipts describe a16GiB Intel UHD Windows QA host, not a freshly verified CUDA machine. This session did not certify GPU capability. No model/checkpoint or GPU resource was acquired. Source/HTML captures are small and kept outside production; user-facing public evidence contains summaries/hashes.

[Colab FAQ](https://research.google.com/colaboratory/faq.html) explains dynamic availability/limits; a free slot is not guaranteed production capacity. Kaggle docs retrieval yielded a thin shell and did not establish current GPU specifications/quota. No free compute entitlement, storage retention, commercial-use fit or network/model-download quota was verified. Do not plan a business around assumed free GPUs. Remote infrastructure must include object storage, ingress/egress, output retention and teardown costs as well as GPU seconds.

## Preserve and extend security boundaries

- One canonical DB and command registry; derived principals/scopes and human-only ceilings remain. No privileged agent endpoint.
- Input files, project JSON, scripts, prompts, captions, model output and donor code are untrusted. Bounded schemas/bytes/depth/frames/duration before decode or compute.
- Import/asset paths reject traversal, symlinks/reparse/case-alias escapes; workers get private staging, read-only approved inputs, no credentials and no DB write access.
- Job Object lifetime/resource containment and AppContainer/token filesystem/network restrictions are different mechanisms. Qualify new Python/GPU descendants and inherited handles independently.
- Offline mode denies egress at a tested OS boundary. Environment flags prevent accidental fetches but are not a sandbox. No browser-direct provider/Comfy ports.
- Worker completion is only a candidate artifact: reopen/probe/hash/limits, then attempt-generation/cancel CAS, then publication. Quarantine partial/mismatched output; preserve diagnostic uncertainty.
- Creative document restore includes all bitmap/media refs. Consent/approval state has stronger rules than artistic undo; revocation cannot be resurrected by a project restore.
- Model formats/loading are a supply-chain boundary. Reject arbitrary pickle/plugin execution; verify approved safe manifests and package closure. Never install custom nodes at run time.

Negative tests and threat boundaries are specified in01,10,13,14,18 and20. No full security scanner/vulnerability certification ran in this research. Source-observed hazards are candidates for independent validation, not fabricated exploits.

## Provider and budget gate

Current spending ceiling **0**. No paid web-retrieval credits, model generations, hosted infrastructure or API keys used. Future quote schema includes provider/account/model/operation/currency, integer upper bound, expiry, request digest and policy version. Reserve under all workspace/user/project/day caps atomically before submit. Unknown/unbounded quotes keep the route disabled unless a separately approved soft-cap policy exists. Do not promise a hard cap on a service without a bounded contract.

Record planned/reserved/charged/refunded/uncertain amounts separately. Cuty estimated max-credit checks, SDK cancel methods and locally interrupted polling do not guarantee provider-side stop/refund. Idempotency is provider/endpoint-specific; timeout after acceptance requires reconcile. Preserve provider request IDs and final ledger receipts; secrets stay in an approved vault and never in project/evidence logs.

## Source and redistribution

Founder source grants are accepted; do not repeatedly question them. For each imported module identify the applicable grant or public license, exact SHA/path/hash, dependencies, modifications, notices and redistribution obligations. Source permission does not supply private backends, weights, trademarks or paid entitlements. GPL process separation is not an automatic license exemption. Custom/source-available licenses and weight terms need exact scope review. No code was transplanted into production by this assignment.

## Release gates remain independent

| Gate | Required evidence | Present status |
|---|---|---|
| H1 | Native Arabic reviewer on actual fonts/title/subtitle/UI fixtures | OPEN; automated RTL is insufficient |
| H2 | Clean Profile A install/launch/offline connection capture | OPEN |
| H3 | Real second Windows account ACL/secret/media denial | OPEN |
| H4 | Actual constrained-volume ENOSPC and recovery | OPEN |
| H5 | Founder ship decision bound to exact artifact | OPEN |
| Signing/installer/update | Authenticode authorization, pinned bundle, update/rollback and artifact hashes | OPEN; unsigned RC does not close it |
| JASSUB | H1 plus production CSP wasm-unsafe-eval review and relevant parity | DISABLED |
| E-SEC | New worker isolation, supply-chain, file/network/process negative tests plus independent review | OPEN for real inference |
| F | Exact model/provider/host/data/cost authorization | DEFERRED |
| G | Applicable final release authorization | NO-GO |

No documentation phase can mark these passed. CI green on a docs-only commit does not sign an installer, validate a model or substitute for human/OS/account tests.
