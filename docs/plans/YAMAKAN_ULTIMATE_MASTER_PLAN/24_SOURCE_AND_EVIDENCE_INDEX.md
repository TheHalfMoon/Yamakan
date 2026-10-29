# Source and evidence index

Research date2026-10-23, Asia/Riyadh. Local source baseline `a3c3ce91815aee35ce5b91b4a483dd85766a4429`; PR85 `7472a14e2eecea0620e0bb2d4422db8852421491`. Capture timestamps may be UTC; convert only for presentation. Fetch time is not publication/model release time. All evidence is scoped to the stated source/path/version.

## Evidence grades

EXECUTION VERIFIED means an actual named check ran and has a receipt; OFFICIAL DOCUMENTATION covers first-party pages/API schemas, including explicitly attributed marketing; SOURCE INSPECTED means actual implementation read at an immutable pin/version; COMMUNITY REPORTED is attributed experience, not independent verification; ENGINEERING INFERENCE is proposed reasoning; UNKNOWN is inaccessible/uninspected/unmeasured. Historical execution retains its original head and cannot qualify current head.

## GitHub and Yamakan

- [Live repository](https://github.com/TheHalfMoon/Yamakan), [PR85](https://github.com/TheHalfMoon/Yamakan/pull/85), [release issue77](https://github.com/TheHalfMoon/Yamakan/issues/77). Raw normalized metadata: `evidence/github-*.json`.
- `evidence/codebase-review.json`:563-file hash inventory,62 explicitly sampled source/test paths, commands/results and limitations. Inventory-only is not line-by-line audit.
- Prior research: all8 files under `docs/research/competitive-video-rea-2026-10-22/` read from PR85 using immutable ref; preserved as upstream evidence, not merged/copied to main. Their module/path/decision claims are reassessed in01/08–10.

## Mandatory competitor reports

- [Cuty](03_CUTY_DEEP_REA.md): `evidence/competitor-cuty.json`; official public pages and statically inspected npm CLI0.2.1.
- [Higgsfield](04_HIGGSFIELD_DEEP_REA.md): `evidence/competitor-higgsfield.json`; API/product docs, pinned SDK and CLI tree.
- [Runway](05_RUNWAY_DEEP_REA.md): `evidence/competitor-runway.json`; model/help/API pages and pinned SDK implementation.
- Combined103 captured-source entries. No authenticated creative workflow/generation/quality execution. Raw copyrighted page/package captures remain outside Git; public ledgers contain bounded excerpts/hashes/URLs, never keys.

## Other official pages

Capture receipt fields: id,original/final URL,status,time,HTML SHA256,bytes/title,grade and access limitations. HTTP200 shell is UNKNOWN for feature evidence. [Official web receipts](evidence/official-web-receipts.json).

| ID | URL | Status | Capture grade |
|---|---|---:|---|
| luma-prices | [source](https://docs.agents.lumalabs.ai/guides/pricing/) | 200 | OFFICIAL DOCUMENTATION |
| luma-edit | [source](https://docs.agents.lumalabs.ai/guides/videos/editing/) | 200 | OFFICIAL DOCUMENTATION |
| luma-generation | [source](https://docs.agents.lumalabs.ai/guides/videos/generation/) | 200 | OFFICIAL DOCUMENTATION |
| kling-map | [source](https://kling.ai/document-api/guides/capability-map/video.md) | 200 | OFFICIAL DOCUMENTATION |
| veo-api | [source](https://ai.google.dev/gemini-api/docs/video) | 200 | OFFICIAL DOCUMENTATION |
| seedance25 | [source](https://seed.bytedance.com/en/seedance2_5) | 200 | OFFICIAL DOCUMENTATION |
| veo | [source](https://deepmind.google/models/veo/) | 200 | OFFICIAL DOCUMENTATION |
| seedance-paper | [source](https://seed.bytedance.com/en/public_papers/seedance-1-5-pro-a-native-audio-visual-joint-generation-foundation-model) | 200 | OFFICIAL DOCUMENTATION |
| pika | [source](https://pika.art/) | 200 | OFFICIAL DOCUMENTATION |
| flow-help | [source](https://support.google.com/flow/answer/16353334?hl=en) | 200 | OFFICIAL DOCUMENTATION |
| pixverse | [source](https://pixverse.ai/en) | 200 | OFFICIAL DOCUMENTATION |
| pika-pricing | [source](https://pika.art/pricing) | 200 | OFFICIAL DOCUMENTATION |
| pixverse-api | [source](https://docs.platform.pixverse.ai/) | 200 | OFFICIAL DOCUMENTATION |
| minimax | [source](https://www.minimax.io/) | 200 | OFFICIAL DOCUMENTATION |
| vidu-api | [source](https://platform.vidu.com/docs) | 200 | UNKNOWN |
| vidu | [source](https://www.vidu.com/) | 200 | OFFICIAL DOCUMENTATION |
| premiere | [source](https://www.adobe.com/products/premiere.html) | 200 | UNKNOWN |
| firefly | [source](https://www.adobe.com/products/firefly.html) | 200 | OFFICIAL DOCUMENTATION |
| after-effects | [source](https://www.adobe.com/products/aftereffects.html) | 200 | UNKNOWN |
| minimax-api | [source](https://platform.minimax.io/docs/guides/video-generation) | 200 | OFFICIAL DOCUMENTATION |
| resolve | [source](https://www.blackmagicdesign.com/products/davinciresolve) | 200 | OFFICIAL DOCUMENTATION |
| resolve-color | [source](https://www.blackmagicdesign.com/products/davinciresolve/color) | 200 | OFFICIAL DOCUMENTATION |
| resolve-edit | [source](https://www.blackmagicdesign.com/products/davinciresolve/edit) | 200 | OFFICIAL DOCUMENTATION |
| capcut | [source](https://www.capcut.com/tools/desktop-video-editor) | 200 | OFFICIAL DOCUMENTATION |
| finalcut | [source](https://www.apple.com/final-cut-pro/) | 200 | OFFICIAL DOCUMENTATION |
| shotcut | [source](https://www.shotcut.org/features/) | 200 | OFFICIAL DOCUMENTATION |
| descript | [source](https://www.descript.com/) | 200 | OFFICIAL DOCUMENTATION |
| kdenlive | [source](https://kdenlive.org/features/) | 404 | UNKNOWN |
| aa-method | [source](https://artificialanalysis.ai/methodology/video) | 200 | OFFICIAL DOCUMENTATION |
| colab | [source](https://research.google.com/colaboratory/faq.html) | 200 | OFFICIAL DOCUMENTATION |
| kaggle | [source](https://www.kaggle.com/docs/notebooks) | 200 | UNKNOWN |
| puget-bench | [source](https://www.pugetsystems.com/pugetbench/creators/) | 200 | OFFICIAL DOCUMENTATION |

Additional official documentation read through free web search/open: Adobe Premiere proxy/color help, After Effects mask tracking, Kdenlive26.08 editing/preview manuals and Descript features; exact claim URLs in06/07. Search result snippets were discovery only; consequential claims use opened docs or direct captures. Free search results/raw extracted text are scratch, not public source licenses.

## Donor source snapshots

[Master matrix](08_SOURCE_DONOR_MASTER_MATRIX.md), [capture hashes](evidence/donor-public-source-captures.json), [discovery-only ledger](evidence/donor-discovery-only.json), [static observations](evidence/donor-review-findings.json). Fourteen scoped implementation inspections,72 capture entries (including a failed path),10 discovery/license-only candidates. Full transitive closures and runtime qualification remain explicit import gates.

| Candidate | Repository | Exact inspected pin |
|---|---|---|
| opencut | [OpenCut-app/opencut-classic](https://github.com/OpenCut-app/opencut-classic) | `cf5e79e919144200294fb9fed22a222592a0aeea` |
| openvideostudio | [mne03005-png/OpenVideoStudio](https://github.com/mne03005-png/OpenVideoStudio) | `175da9960411fbe740932b0a08d57e32a4a36a18` |
| openmontage | [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | `c8066452325cb57c8fc1ba8c2a71b6e8842e6b65` |
| ffmpeg | [FFmpeg/FFmpeg](https://github.com/FFmpeg/FFmpeg) | `1da057110ff19b7ea33273f9cf209b2c963cb3cf` |
| otio | [AcademySoftwareFoundation/OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) | `eee67fdcdce388696e39f4176d89a61ee9fdc790` |
| mlt | [mltframework/mlt](https://github.com/mltframework/mlt) | `8f605c9486d8c1d0f8283d9baf5e94592a10bd6c` |
| comfyui | [Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI) | `9fe7ef764d0452dcc9dcb925efd076d4e68eece1` |
| diffusers | [huggingface/diffusers](https://github.com/huggingface/diffusers) | `48cdbaef5ee3d718aaee392b44f2099ae511c4a5` |
| whispercpp | [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | `231638a0717b7822784297e5980965ffcec05810` |
| fasterwhisper | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) | `9e472ae9de8bb374552f531f752654554b76b2d6` |
| realesrgan | [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) | `a4abfb2979a7bbff3f69f58f58ae324608821e27` |
| rife | [hzwer/ECCV2022-RIFE](https://github.com/hzwer/ECCV2022-RIFE) | `5d8adbdd40e12c2c8f91930eff838aebe561c086` |
| kdenlive | [KDE/kdenlive](https://github.com/KDE/kdenlive) | `a1990cc80ddc5f8f28e79960968911f21475f7ef` |
| shotcut | [mltframework/shotcut](https://github.com/mltframework/shotcut) | `34dde4fce394652c00d8f7af9ac2ce37dab1ed92` |

## Current-session checks and review

Additional evaluation source: [VBench five-file capture ledger](evidence/vbench-source.json), immutable pin `fd18b3d055cb0fc6f066ca90fe2c3c8cbb698490`; functions/methodology and limitations in16. This supplements14 scoped donor studies and does not claim a VBench2 full audit or executed score.

- Git ls-remote/gh metadata: live main/PR85/issue/open PR and historical workflow receipts captured.
- Source reviewer: branding source checks2/2 passed; time test failed module loading (zod missing); no full native/media/browser/release run.
- d1: initial400 plus actual advisory result in `evidence/d1-advisory*.json`; no approval.
- Graft structural103files/1034nodes/2642edges and caller traces, no deep LLM pass.
- Plan validator/report, immutable plan review findings and final continuation ledger are stored beside the plan. They validate planning consistency, not future feature functionality.

No paid retrieval/model/API call, video inference, weight download, donor build, new production dependency, Plume training, Paradigm edit, production code change, public release or planning PR merge belongs to this assignment.
