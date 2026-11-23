# 06 — Voice/audio, lip sync, restoration, consistency methods and evaluation

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

State of the field as observed on **2026-11-11** (access date for every source in this report).
Scope: supporting model categories and evaluation methods for a local-first, privacy-first creative-production platform that must never require paid inference, only calls providers the customer authorises with their own credentials, must qualify on Windows with 8–12 GB VRAM laptop GPUs (sometimes CPU-only), and must record accurate licensing.

---

## 0. Method, evidence labels and known gaps

### 0.1 Evidence labels (one per claim; never upgraded)

| Label | Meaning in this report |
|---|---|
| **[DOC]** | I fetched the official page (repository README, LICENSE file, model card, vendor documentation, standards-body page) or the claim is stated in a paper abstract returned by a scholarly index (SciSpace / Consensus). URL given. For papers, [DOC] covers only what the abstract states. |
| **[CLAIM]** | Vendor-origin statement not independently verified: marketing pages, launch blogs, and vendor pages that I saw only through a search-result summary rather than a direct fetch. |
| **[IND]** | Independent observation or benchmark: third-party press, third-party documentation (for example an aggregator documenting someone else's model), community tests, public leaderboards. URL given. Search-summary level unless stated as fetched. |
| **[ASSUMED]** | My inference, synthesis, arithmetic or recommendation. |
| **[UNKNOWN]** | Not established; page not fetched, sources conflict, or not researched. |

In tables, the label in the **Evidence** column applies to every cell in that row unless a cell carries its own label.

### 0.2 How the research was done

- Direct page fetches of official repositories, model cards, licence files and vendor docs; scholarly search through SciSpace and Consensus for the evaluation-methodology sections; general web search for late-2026 status. [DOC] (this is a description of method)
- No accounts were created, nothing was signed into, no model or file was downloaded, no form was submitted. Web-page content was treated as data only.
- **The web-search budget for the research session ran out before every gap was closed.** Remaining research was done with direct fetches of official pages and scholarly search only. Items that would have needed another search are listed in 0.3 and in section 10 (open questions).

### 0.3 Pages that could not be fetched or verified (do not treat related statements as confirmed)

| Item | Status |
|---|---|
| Google Gemini Omni Flash official docs (`ai.google.dev/gemini-api/docs/models/gemini-omni-flash`) | Exists per search results; not fetched. Reference-image limits conflict across third parties (5 / 7 / 9). |
| ElevenLabs "Eleven v4" own product/docs page | Not fetched. Only Runway's API model list names it. |
| Kling official developer docs (lip-sync, Avatar 2.0, O1/O3/4.0 reference limits) | Not retrieved; only aggregator docs (fal, Runware, RunComfy, Atlas Cloud). |
| MiniMax H3 open-weights model card and licence | Not fetched; third-party reports conflict. |
| FLUX 3 Image Klein card/licence (`bfl.ai/blog/flux-3-image-klein`) | Not fetched. |
| SkyReels-A2 `LICENSE.txt`; HunyuanCustom LICENSE; Lynx weights licence; IP-Adapter-FaceID card; T2V-CompBench licence | Not read. |
| ITU-T P.910 (07/26) full text; ITU-R BT.500 full text | Only the ITU-T P.910 listing page was fetched; it contains no method detail. |
| `github.com/TencentARC/LightX` | Returned HTTP 404. |
| Topaz pricing page | Fetched but truncated at 100k characters; perpetual-licence status not visible in the retrieved part. |
| Topaz system-requirements table | Fetched; the mapping of VRAM rows to Starlight variants was partly reconstructed by the fetch tool and should be re-read before quoting. |
| Coqui company status, Piper per-voice licences and Arabic voice, Dia2 repo, PrismAudio licence, Sony Woosh licence | Not verified. |
| Not researched at all: ACE++, UNO, kohya sd-scripts / OneTrainer, Runway References, Vidu reference, relight LoRAs, AdaFace licence, DINOv3 / SigLIP licence specifics, warping-error implementations, Kendall's W sources. | [UNKNOWN] throughout. |

---

## 1. Decision summary

1. **The model names in most 2025 plans are stale.** Sora 2 and its API are gone, Wan's open weights stop at 2.2, Chatterbox is retired, Higgs Audio v3 is non-commercial, Suno has been sued a second time, and the lip-sync and TTS leaders have new version numbers (section 2). A platform that hard-codes model names will be wrong within a quarter; a registry with per-entry licence, date-verified and source URL is the durable design. [ASSUMED]
2. **Licences, not quality, are the main selection constraint for a product that must "record accurate licensing".** At least fifteen commonly recommended open models carry non-commercial weights, revenue caps, territorial exclusions or a non-commercial dependency hidden inside an otherwise permissive repository (section 8). The most frequent hidden trap is the InsightFace model pack. [ASSUMED]
3. **A fully permissive, 8–12 GB or CPU-feasible stack exists for most categories**: Kokoro / Chatterbox / Pocket TTS for speech, faster-whisper + WhisperX for captions and timing, ACE-Step 1.5 for music, MuseTalk 1.5 and LatentSync 1.5 for lip sync, Real-ESRGAN + RIFE + SeedVR2 (GGUF) for restoration, Wan 2.1/2.2-based adapters (VACE, Phantom) and FramePack for consistency. The gaps are **permissively licensed video-to-audio foley** and **permissively licensed Arabic voice cloning that is still maintained** (section 9). [ASSUMED]
4. **No video model was found that exports separate dialogue, music and effects stems.** Native audio is delivered as a mixed track; the only route to stems is post-hoc separation, whose open option (Demucs) has disputed weight licensing. A production tool should generate dialogue, music and effects as separate local tracks whenever it needs to edit them independently. [ASSUMED]
5. **"Reference management" is a product feature; "consistency" is a model behaviour, and the two are routinely conflated.** Hosted models now accept many references (Seedance 2.5 reportedly 50), but independent tests still report wardrobe drift and consistency loss after a few shots. Reference slots are not evidence of consistency (section 6). [ASSUMED]
6. **No automatic metric is a safe gate for "tool A is better than tool B".** Published work shows metrics disagreeing with each other and with people, FVD being content-biased and sample-hungry, smoothness metrics rewarding static video, global identity similarity being confounded by background and copy-paste, and VLM judges missing artifacts. Public arena rankings disagree with each other at the top (section 7.1). [ASSUMED]
7. **A small team can still run a defensible comparison**: blind, forced-choice, pairwise, two tools only, on a pre-registered task set, analysed at the task level with exact binomial tests, plus a small within-subject task-based usability study. Concrete numbers are in section 7.4: with 36 tasks, one tool must win 25 to be declared better; detecting a 70/30 true preference with 80% power needs about 54 tasks. [ASSUMED]

---

## 2. What changed since the names in the brief

| Name in brief | State observed 2026-11-11 | Evidence |
|---|---|---|
| Sora 2 | Discontinuation announced 24 Mar 2026; Videos API removed 24 Sep 2026. | [IND] https://techjacksolutions.com/ai-brief/openai-videos-api-sora-2-deprecated-september-2026/ ; https://techinformed.com/openais-sora-shutdown-adds-to-signs-of-a-harder-ai-phase/ |
| Veo 3.x | Veo 3.1 and 3.1 Fast still listed in Runway's API model list alongside "Gemini Omni Flash 1.1 / 1.2". | [DOC] https://docs.dev.runwayml.com/guides/models/ |
| Veo label | Reported as being replaced by Gemini Omni Flash in Google's own app (announced Google I/O, 19 May 2026). | [IND] https://www.buildfastwithai.com/blogs/gemini-omni-flash-review-google-ai-video-model-2026 |
| Kling | Kling 4.0, 4.0 Flash, 3.0 and O3 are listed by Runway's API. | [DOC] https://docs.dev.runwayml.com/guides/models/ |
| Seedance | Seedance 2.5, 2.0, Fast and Mini listed by Runway's API. | [DOC] https://docs.dev.runwayml.com/guides/models/ |
| Wan 2.5+ | Wan 2.5 to 3.0 are API-only; open weights stop at Wan 2.2. | [IND] https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2 ; https://www.atlascloud.ai/blog/tips/is-wan-3.0-open-source |
| LTX-2 | LTX-2.5 (22B, joint audio+video, native multishot) under the LTX-2.x Community License. | [DOC] https://huggingface.co/Lightricks/LTX-2.5 |
| ElevenLabs v3 | Runway lists both "Eleven v3" and "Eleven v4 (from $0.022 per 1k characters)". ElevenLabs' own v4 page was not fetched. | [DOC] https://docs.dev.runwayml.com/guides/models/ (Runway's listing only) |
| Sync Labs lipsync-2 / react-1 | A newer `sync-3` model (4K native) is documented alongside lipsync-2, lipsync-2-pro and react-1. | [DOC] https://sync.so/docs/models/lipsync |
| Chatterbox | Repository states that as of August 2026 Chatterbox is retired research and no longer maintained; archive remains MIT. | [DOC] https://github.com/resemble-ai/chatterbox |
| Higgs Audio | v3 (4B, 100+ languages) released under a research and non-commercial licence. | [DOC] https://github.com/boson-ai/higgs-audio |
| VibeVoice | TTS code removed from the repository on 2025-09-05 citing misuse; ASR and a 0.5B realtime model remain. | [DOC] https://github.com/microsoft/VibeVoice |
| Suno / Udio | Settlements with majors in late 2025; UMG and Sony filed a second suit against Suno on 18 Sep 2026 over v6. | [IND] https://www.musicbusinessworldwide.com/universal-and-sony-sue-suno-for-a-second-time-claiming-platforms-v6-models-are-the-fruit-of-the-same-poisoned-tree/ |
| FILM | Google's frame-interpolation repository was archived on 14 Oct 2025. | [DOC] https://github.com/google-research/frame-interpolation |
| FLUX Kontext | Followed by FLUX.2 (klein 4B Apache-2.0) and FLUX 3 (23 Jul 2026; image, video and audio). | [IND] https://venturebeat.com/technology/black-forest-labs-launches-flux-3-capable-of-generating-images-and-20-second-video-with-audio-but-in-limited-release-to-start |
| LMArena video | `lmarena.ai` redirects to `arena.ai`; leaderboard updated 8 Nov 2026. | [IND] https://arena.ai/leaderboard/text-to-video (fetched) |
| ITU-T P.910 | A 07/26 edition is "In force (prepublished)". | [DOC] https://www.itu.int/rec/T-REC-P.910 |

---

## 3. PART A — Voice and audio

### 3.1 Open-weight TTS and voice cloning

| Model | Licence (code / weights) | Languages; Arabic | Cloning | Hardware and CPU feasibility | Evidence |
|---|---|---|---|---|---|
| **Kokoro-82M** v1.0 | Apache-2.0 | 8 languages, 54 voices (US/UK English, Japanese, Mandarin, Spanish, French, Hindi, Italian, Brazilian Portuguese). **No Arabic.** | None (fixed voices) | 82M parameters. CPU real-time use is reported only by third parties, see below. | [DOC] https://huggingface.co/hexgrad/Kokoro-82M ; https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md |
| **Chatterbox** family (Turbo 350M, Nano 110M, Multilingual V3 500M) | MIT. **Retired, unmaintained since Aug 2026.** | Turbo and Nano: English. Multilingual V3: 23+ languages **including Arabic (`ar`)**. | Zero-shot | Nano targets CPU/on-device, about 3x real time on 8 CPU cores; devices cuda / cpu / mps. Every output carries a PerTh watermark. | [DOC] https://github.com/resemble-ai/chatterbox |
| **F5-TTS** | Code MIT; **pretrained weights CC-BY-NC** (because of the Emilia training data) | Not recorded | Zero-shot | Not recorded | [DOC] https://github.com/SWivid/F5-TTS |
| **XTTS-v2** (Coqui) | Coqui Public Model License | 17 languages **including Arabic** | Zero-shot | Not recorded | [DOC] https://huggingface.co/coqui/XTTS-v2 |
| **Dia** 1.6B | Apache-2.0 | English only | Audio-prompt cloning | About 4.4 GB VRAM (fp16/bf16), 7.9 GB (fp32). README says CPU support is "to be added soon". | [DOC] https://github.com/nari-labs/dia |
| **Orpheus** | Apache-2.0 | English plus a multilingual research release; Arabic not mentioned | Zero-shot | Llama-3B backbone; a llama.cpp path without GPU is documented | [DOC] https://github.com/canopyai/Orpheus-TTS |
| **Higgs Audio v3** (4B) | **Boson Higgs Audio v3 Research and Non-Commercial License** (repository sidebar still shows Apache-2.0) | 100+ languages | Yes | v2 README recommends a GPU with at least 24 GB | [DOC] https://github.com/boson-ai/higgs-audio ; https://github.com/boson-ai/higgs-audio/blob/main/README_V2.md |
| **VibeVoice** | Repository MIT; "intended for research and development purposes only" | ASR-7B covers 50+ languages | TTS code removed 2025-09-05 | ASR-BitNet runs on CPU; Realtime-0.5B remains | [DOC] https://github.com/microsoft/VibeVoice |
| **IndexTTS-2 / 2.5** | **bilibili Model Use License Agreement**; commercial enquiries by email | 2.5: Chinese, English, Japanese, Spanish **and Arabic** | Zero-shot; precise duration control "not yet enabled in this release" (IndexTTS-2) | Not recorded | [DOC] https://github.com/index-tts/index-tts |
| **Fish Speech / OpenAudio S2** | **Fish Audio Community License v1.0**: commercial use only under USD 500,000 annual revenue; **no licence to offer a hosted service**; attribution required; S2-Pro weights under a Research License | About 100 languages; Arabic not individually verified | Zero-shot; licence forbids imitating an identifiable person without consent | Not recorded | [DOC] https://github.com/fishaudio/fish-speech ; https://github.com/fishaudio/fish-speech/blob/main/LICENSE |
| **CosyVoice 3** (Fun-CosyVoice3-0.5B-2512) | Apache-2.0 | 9 languages plus 18 Chinese dialects. **No Arabic.** | Zero-shot | Not recorded | [DOC] https://github.com/FunAudioLLM/CosyVoice |
| **Piper** (piper1-gpl) | **GPL-3.0** | Per-voice; Arabic voice and per-voice licences not verified | None | Designed for CPU use | [DOC] https://github.com/OHF-Voice/piper1-gpl (licence only); language and CPU cells [UNKNOWN] / [ASSUMED] |
| **Qwen3-TTS** (0.6B / 1.7B) | Apache-2.0 | 10 languages, no Arabic | Yes | VRAM estimates conflict between third parties | [IND] https://gigazine.net/gsc_news/en/20260123-qwen3-tts-family-opensource ; https://arxiv.org/pdf/2601.15621v1 |
| **Habibi-TTS** (Arabic dialects, F5-based) | Code MIT. **Checkpoints split**: unified / SAU / UAE are CC-BY-NC-SA-4.0; ALG / EGY / IRQ / MAR / MSA are Apache-2.0 | Arabic (MSA and dialects) | Zero-shot | Not recorded | [IND] https://github.com/SWivid/Habibi-TTS ; https://arxiv.org/html/2601.13802v2 (search-level; repository not fetched) |
| **Pocket TTS** (Kyutai, 100M) | Code MIT; per-voice licences | English | Yes | About 6x real time on 2 cores of a MacBook Air M4 | [IND] https://dev.to/andrew-ooo/pocket-tts-review-kyutais-100m-cpu-voice-cloner-2026-40lb ; https://pypi.org/project/pocket-tts/1.0.0/ |
| **Supertonic 2 / 3** | Code MIT; model OpenRAIL-M | 31 languages claimed | Not recorded | On-device | [IND] https://huggingface.co/Supertone/supertonic-2 (search-level) |
| **NeuTTS Air**, **KittenTTS**, **VoxCPM2**, **OmniVoice** | Reported Apache-2.0 for the first three; OmniVoice licence unverified | VoxCPM2 30 languages (Arabic unverified); OmniVoice 600+ languages | Varies | Small / CPU-oriented (first two) | [IND] https://github.com/neuphonic/neuTTS ; https://localclaw.io/tts/kitten-tts ; https://pypi.org/project/voxcpm ; https://arxiv.org/html/2604.00688v2 |

Additional points:

- Kokoro running usefully on CPU is reported by a third-party comparison only. [IND] https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox
- XTTS-v2's CPML is described by third parties as non-commercial; whether Coqui the company is still able to grant commercial licences was not confirmed from the model card. [UNKNOWN]
- Third-party blogs describe Higgs Audio v2 as Apache-2.0 while the repository now leads with the v3 non-commercial licence; which licence covers which checkpoint must be read from the LICENSE files before use. [UNKNOWN]
- On the Artificial Analysis TTS leaderboard, Fish S2 Pro is the top open-weights TTS entry (Elo 1123). [IND] https://artificialanalysis.ai/text-to-speech/leaderboard
- **Arabic, permissive licence, local**: the confirmed candidates are Chatterbox Multilingual V3 (MIT but retired) and the Apache-2.0 Habibi-TTS dialect/MSA checkpoints (not yet verified by direct fetch). XTTS-v2, IndexTTS-2.5 and Higgs v3 support Arabic but under restrictive licences. [ASSUMED]

### 3.2 Hosted TTS (bring-your-own-key candidates)

| Provider / model | What was found | Arabic | Evidence |
|---|---|---|---|
| ElevenLabs Eleven v3 (`eleven_v3`) | Generally available in 2026 (sources disagree on the date: 2 Feb vs 14 Mar); 70+ languages claimed. | Not individually verified | [CLAIM] https://elevenlabs.io/blog/eleven-v3-is-now-generally-available |
| ElevenLabs "Eleven v4" | Listed by Runway's API at "from $0.022 per 1k characters". | [UNKNOWN] | [DOC] https://docs.dev.runwayml.com/guides/models/ (Runway's listing only) |
| OpenAI `gpt-4o-mini-tts-2025-12-15` | 13 built-in voices; Custom Voices require a consent recording. | Not verified | [CLAIM] https://developers.openai.com/api/docs/guides/text-to-speech ; https://developers.openai.com/api/docs/guides/custom-voices (official docs seen via search summary only) |
| Google Gemini 3.1 Flash TTS (preview) | 70+ languages claimed; SynthID watermark; voice replication API reported. | Unconfirmed | [IND] https://datanorth.ai/news/google-gemini-3-1-flash-tts-release ; https://thenewstack.io/gemini-tts-voice-replication-api/ |
| Cartesia Sonic 3.5 / 3.6 | Low-latency TTS. | **Yes** | [CLAIM] https://cartesia.ai/blog/sonic-3.6/ ; https://docs.cartesia.ai/build-with-cartesia/tts-models/latest |
| Hume Octave 2 | 11 languages. | **Yes** | [CLAIM] https://hume.ai/blog/octave-2-launch |
| MiniMax Speech 2.8 | About 40 languages. | **Yes** | [CLAIM] https://www.minimax.io/news/minimax-speech-28 |
| Leaderboard context | Artificial Analysis Speech Arena leaders: Simba 3.2 (about 1229), Fun-Realtime-TTS (1224), Gemini 3.1 Flash TTS (1222). | n/a | [IND] https://artificialanalysis.ai/text-to-speech/leaderboard |

Implication: hosted TTS quality leaders change every few months and several publish Arabic support, so hosted TTS fits the "customer-authorised provider" slot well, but none can be a required dependency. [ASSUMED]

### 3.3 Voice-clone consent and safety

- OpenAI's Custom Voices flow requires a consent recording from the voice owner. [CLAIM] https://developers.openai.com/api/docs/guides/custom-voices
- Chatterbox embeds a PerTh watermark in every generated file. [DOC] https://github.com/resemble-ai/chatterbox
- Google's hosted TTS and Lyria outputs are reported to carry SynthID watermarks. [IND] https://datanorth.ai/news/google-gemini-3-1-flash-tts-release
- Dia's README lists prohibited uses (identity misuse, deceptive content). [DOC] https://github.com/nari-labs/dia
- The Fish Audio licence forbids imitating an identifiable person without consent. [DOC] https://github.com/fishaudio/fish-speech/blob/main/LICENSE
- Microsoft removed VibeVoice's TTS code citing misuse, which shows that an open voice model can be withdrawn after a platform has integrated it. [DOC] https://github.com/microsoft/VibeVoice
- A third-party legal overview tracks voice-likeness consent laws across jurisdictions. [IND] https://vorplabs.com/ai-regulatory-updates/deepfake-laws/voice-likeness-consent
- Product consequence: local cloning has no provider-side consent gate, so the platform itself should store a consent artefact (who, what recording, scope, date) with each cloned voice, keep it in provenance metadata, and preserve any model-emitted watermark through the export path. [ASSUMED]

### 3.4 Music generation

| System | Access / licence | Notes for this platform | Evidence |
|---|---|---|---|
| **Suno** | No general public API; an invite-only API partner program was announced 1 Jul 2026. Third-party "Suno API" wrappers are unofficial. Monthly download caps from 3 Sep 2026. | WMG settled with Suno in Nov 2025; **UMG and Sony filed a second suit on 18 Sep 2026 over the v6 models**. Unsuitable as an integration target while access is invite-only and litigation is open. | [IND] https://www.digitalmusicnews.com/2026/07/03/suno-is-opening-an-api-partner-program/ ; https://www.musicbusinessworldwide.com/suno-limits-subscribers-downloads-per-month/ ; https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/ ; https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/ |
| **Udio** | No API; downloads disabled since 29 Oct 2025 after the UMG settlement; WMG settlement followed. | Not usable as a production source. | [IND] https://dynamoi.com/learn/ai-music-distribution/is-udio-music-still-downloadable ; https://www.musicbusinessworldwide.com/universal-music-settles-udio-lawsuit-strikes-deal-for-licensed-ai-music-platform ; https://www.musicbusinessworldwide.com/warner-music-settles-udio-lawsuit-strikes-licensing-deal-with-ai-platform |
| **ElevenLabs Music** | Public API endpoint `POST /v1/music`; vendor says it is trained on licensed data. | Clean BYO-key candidate. | [CLAIM] https://elevenlabs.io/blog/eleven-music-now-available-in-the-api |
| **Google Lyria 3** (Clip / Pro, preview) | Via Gemini API; SynthID watermark. | BYO-key candidate; preview status. | [IND] https://cined.com/google-lyria-3-launches-in-gemini-ai-music-generation-with-lyrics-style-control-and-synthid-watermarking ; https://openrouter.ai/google/lyria-3-pro-preview-20260330 |
| **Stable Audio 2.5** | Hosted, enterprise positioning. | BYO-key candidate. | [CLAIM] https://stability.ai/news/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale |
| **Stable Audio Open 1.0** | Stability AI Community License; up to 47 s stereo at 44.1 kHz; trained on CC0 / CC-BY / CC Sampling+ data; not for realistic vocals. | Best-documented training-data provenance among open models; revenue-threshold licence must be recorded. | [DOC] https://huggingface.co/stabilityai/stable-audio-open-1.0 |
| **ACE-Step 1.5** | **MIT.** Tiers: 6 GB or less (2B turbo DiT, INT8 plus CPU offload), 6–8 GB with the 0.6B language model, XL (4B) from 12 GB with offload; Windows scripts and a portable package; CPU supported; LoRA training. | **Primary local music candidate for 8–12 GB.** The repository does not describe its training data. | [DOC] https://github.com/ace-step/ACE-Step-1.5 |
| **DiffRhythm** | Apache-2.0; minimum 8 GB VRAM. | Full-song candidate at 8 GB. | [DOC] https://github.com/ASLP-lab/DiffRhythm |
| **MusicGen** (AudioCraft) | Code MIT; **weights CC-BY-NC 4.0**. | Non-commercial weights. | [DOC] https://github.com/facebookresearch/audiocraft |
| **YuE / YuE2** | Code Apache-2.0; **weights CC BY-NC 4.0 "with additional creator permission"**; about 24 GB. | Out on both licence and hardware. | [DOC] https://github.com/multimodal-art-projection/YuE |
| "Seed Audio 1.0" | Listed in Runway's API at $0.0025 per second. | Not investigated further. | [DOC] https://docs.dev.runwayml.com/guides/models/ (listing only) |

Open-model training-data provenance is the unresolved music risk: only Stable Audio Open documents its data sources among the models checked. [ASSUMED]

### 3.5 Sound effects and video-to-audio (foley)

| System | Licence | Hardware | Notes | Evidence |
|---|---|---|---|---|
| **MMAudio** | Code MIT; **checkpoints CC-BY-NC 4.0** | About 6 GB | Technically the best fit for 8 GB, blocked for commercial use by the weights licence. | [DOC] https://github.com/hkchengrex/MMAudio |
| **ThinkSound** | **Contradictory**: Apache-2.0 header and "Commercial use is NOT permitted" in the same repository | Not recorded | Treat as non-commercial until clarified; successor PrismAudio dated 2026-03-24. | [DOC] https://github.com/FunAudioLLM/ThinkSound |
| **HunyuanVideo-Foley** | Licence tag `tencent-hunyuan-community` | XXL 20 GB (12 GB with offload); XL 16 GB (8 GB with offload) | Fits 8–12 GB with offload, but see the Tencent territorial exclusion in section 8. | [DOC] https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley |
| **Stable Audio Open 1.0** | Stability AI Community License | Not recorded | Text-to-SFX, not video-conditioned. | [DOC] https://huggingface.co/stabilityai/stable-audio-open-1.0 |
| **ElevenLabs SFX v2** (hosted) | Commercial API | n/a | 0.1–30 s, looping, 48 kHz WAV. | [DOC] https://elevenlabs.io/docs/overview/capabilities/sound-effects |
| **Sony Woosh** | Licence not verified | Not recorded | Announced SFX model (arXiv 2604.01929). | [IND] https://www.mixonline.com/post-and-broadcast/sony-ai-announces-sfx-generation-model-woosh |

There is **no confirmed permissive, commercially usable, video-conditioned foley model** in this set. The practical local route is text-to-SFX (Stable Audio Open, within its licence) placed on the timeline using detected events, with hosted SFX as the BYO-key upgrade. [ASSUMED]

### 3.6 Speech-to-text and alignment (captions and timing)

| Tool | Licence | Languages | Hardware | Evidence |
|---|---|---|---|---|
| **Whisper large-v3-turbo** | MIT | 99 languages; word timestamps | GPU or CPU through the runtimes below | [DOC] https://huggingface.co/openai/whisper-large-v3-turbo |
| **faster-whisper** (CTranslate2) | MIT | Whisper's languages | CPU int8, small model: 13 minutes of audio in 1 min 42 s on an i7-12700K; large-v2 int8 on GPU: 2,926 MB VRAM | [DOC] https://github.com/SYSTRAN/faster-whisper |
| **WhisperX** | BSD-2-Clause | wav2vec2 forced alignment per language | CPU int8 mode documented; pyannote diarization needs a Hugging Face token and acceptance of model terms | [DOC] https://github.com/m-bain/whisperX |
| **Parakeet TDT 0.6B v3** | CC-BY-4.0 | 25 European languages; **no Arabic** | Not recorded | [DOC] https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3 |
| **Qwen3-ASR / Qwen3-ForcedAligner** | Apache-2.0 | Aligner covers 11 languages (Arabic not verified) | Not recorded | [DOC] https://arxiv.org/abs/2601.21337 |
| **Cohere Transcribe (Arabic)** | Hosted | Arabic | n/a | [CLAIM] https://cohere.com/blog/transcribe-arabic |

- faster-whisper plus WhisperX is the only stack here that is permissive, CPU-feasible and covers Arabic through Whisper's multilingual model. [ASSUMED]
- WhisperX's optional diarization is the one step that requires a Hugging Face account and gated-model consent, which conflicts with a zero-account local install; make diarization optional and customer-initiated. [ASSUMED]
- Whether WhisperX ships a default Arabic alignment model was not verified. [UNKNOWN]

### 3.7 Native audio in video models, and what it means for stems

| Model | Native audio | Local availability | Evidence |
|---|---|---|---|
| Sora 2 | Discontinued (API removed 24 Sep 2026). | None | [IND] https://dev.to/mr_manushukla/sora-2-and-the-videos-api-shut-down-on-24-september-2026-the-migration-and-the-real-cost-per-second-bek |
| Wan 2.5 – 3.0 | Native audio, API-only. | Open weights stop at 2.2 (no native audio; Wan2.2-S2V is audio-driven, not audio-generating). | [IND] https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2 |
| **LTX-2.5** | Joint audio and video; "native multishot generation". | Open weights, 22B, LTX-2.x Community License (free commercial use under USD 10M revenue). Minimum VRAM not stated on the card. | [DOC] https://huggingface.co/Lightricks/LTX-2.5 |
| LTX-2.5 hardware | A third party reports about 16 GB. | Above the 8–12 GB target unless quantised builds prove otherwise. | [IND] https://medium.com/@creativeaininja/ltx-2-5-what-lightricks-open-weights-video-model-actually-does-and-how-to-run-it-a17bad9664fd |
| Hosted leaders with audio | Artificial Analysis text-to-video (with audio): 1 Wan 3.0 (1175), 2 Utopai X (1170), 3 MiniMax H3 768p (1161), 4 Seedance 2.5 (1155), 5 Gemini Omni Flash 1.2 (1154), 6 FLUX 3 Max (1153), 7 HeyGen Video 1 (1152); SkyReels V4 1137; LTX-2.5 Fast 943; Kling 3.0 1080p Pro is the anchor at 1000. | Hosted | [IND] https://artificialanalysis.ai/video/leaderboard/text-to-video |
| Native-audio comparisons | Third-party feature comparisons of dialogue, ambience and music across models. | Hosted | [IND] https://www.atlascloud.ai/blog/guides/ai-video-models-native-audio-compared ; https://www.cliprise.app/learn/comparisons/models/ai-video-models-native-audio-comparison |

Stems:

- No source was found showing any video model, hosted or open, exporting separate dialogue, music and effects stems; native audio arrives as one mixed track. [UNKNOWN] (absence of evidence after the searches run; not proof of absence)
- Post-hoc separation is the workaround: Demucs (code MIT) has weights trained on MUSDB whose licence status is disputed in the model's own discussion thread; commercial dialogue/music/effects separators exist as hosted services. [IND] https://huggingface.co/adefossez/HTDemucs/discussions/1 ; https://audioshake.ai/post/audioshake-expands-into-dialogue-music-and-effects-separation-for-production-studios-and-dubbing-services ; https://www.gaudiolab.com/products/dme-separator
- Autoregressive audio-visual continuation is reported to accumulate errors that cause "identity drift, over-smoothing, and audio-visual desynchronization". [DOC] https://scispace.com/papers/vorch-director-interactive-world-story-model-via-noise-aware-79hbdlnglzrh
- Design consequence: treat native audio as a **scratch or reference track**. Keep the editable mix as separately generated dialogue (TTS), music and effects tracks with their own provenance and licence records; when a native-audio clip is kept, store it as a single "mixed, non-separable" asset type so the timeline does not promise per-stem edits it cannot deliver. [ASSUMED]

---

## 4. PART B — Lip sync and talking characters

Two different jobs are bundled under "lip sync" and they should be separate capabilities in the product: [ASSUMED]

- **Re-dubbing existing video** (video in, new audio in, mouth region re-rendered): Sync Labs, LatentSync, MuseTalk, Wav2Lip, InfiniteTalk V2V mode.
- **Animating a still or generating a talking performance** (image plus audio in, whole frame generated): Hedra, HeyGen, Kling Avatar, EchoMimic, Hallo, OmniAvatar, MultiTalk, FantasyTalking, Wan S2V, HunyuanVideo-Avatar. LivePortrait and Runway Act-Two are **video-driven performance transfer**, not audio-driven.

### 4.1 Open models

| Model | Licence | Hardware | Quality limits and identity issues | Evidence |
|---|---|---|---|---|
| **MuseTalk 1.5** | Code MIT, "no limitation for both academic and commercial usage"; trained models "available for any purpose, even commercially". Third-party components (whisper, ft-mse-vae, dwpose, S3FD) keep their own licences. | README: tested by its authors on an RTX 3050 Ti Laptop with 4 GB (fp16; an 8-second video takes about 5 minutes); "30fps+" on a Tesla V100. | Face region is 256x256; README admits that some details of the original face, "such as mustache, lip shape and color", are not well preserved, and "some jitter" from single-frame generation. | [DOC] https://github.com/TMElyralab/MuseTalk |
| **LatentSync 1.5 / 1.6** | Code Apache-2.0; Hugging Face weights tagged **openrail++** (use restrictions). Pipeline uses InsightFace for landmarks, Whisper and SyncNet. | v1.5: minimum 8 GB. v1.6 (trained at 512x512): minimum 18 GB. | Higher guidance "may cause the video distortion or jitter". | [DOC] https://github.com/bytedance/LatentSync ; https://huggingface.co/ByteDance/LatentSync-1.6 |
| **Wav2Lip** | **Non-commercial.** "Any form of commercial use is strictly prohibited" (trained on LRS2). | Light | Old, low resolution. | [DOC] https://github.com/Rudrabha/Wav2Lip |
| **SadTalker** | Apache-2.0 (non-commercial restriction removed). Depends on facexlib and GFPGAN. | Not recorded | Last changelog entry 2023-06-12; effectively unmaintained. | [DOC] https://github.com/OpenTalker/SadTalker |
| **LivePortrait** | MIT, with a LICENSE notice: InsightFace models "are for non-commercial research purposes only"; for commercial use "you should remove and replace InsightFace's detection models". | Windows plus NVIDIA supported | Video-driven, not audio-driven. | [DOC] https://github.com/KwaiVGI/LivePortrait ; https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE |
| **EchoMimicV3** (1.3B; Flash, 2026-01-22) | Apache-2.0; base Wan2.1-Fun-V1.1-1.3B-InP | Flash: 8 steps, "12G VRAM requirement", up to 768x768; ComfyUI 16 GB; Windows one-click package for the quantised version. | AAAI 2026 paper. | [DOC] https://github.com/antgroup/echomimic_v3 |
| **EchoMimicV2** | Apache-2.0; "intended for academic research" | Tested on A100, 4090D 24 GB, V100 16 GB | Semi-body; English and Mandarin audio. | [DOC] https://github.com/antgroup/echomimic_v2 |
| **InfiniteTalk** | Apache-2.0 (code and models); base Wan2.1-I2V-14B-480P | No VRAM figure; low-VRAM flag `--num_persistent_param_in_dit 0` | "Unlimited length" video-to-video dubbing and image-to-video; README: "Beyond 1 minute, color shifts become more pronounced"; the FusionX acceleration LoRA "reduces ID preservation". | [DOC] https://github.com/MeiGen-AI/InfiniteTalk |
| **MultiTalk** | Apache-2.0; base Wan2.1-I2V-14B-480P | 8 GB only through the third-party Wan2GP runtime | Multi-person; up to 15 s (201 frames); 480p only. | [DOC] https://github.com/MeiGen-AI/MultiTalk |
| **OmniAvatar** | Apache-2.0; Wan2.1-T2V 14B and 1.3B | 14B: 36 GB, 21 GB, or **8 GB with `num_persistent_param_in_dit=0` at 22.1 s per iteration on an A800** | 480p only. At laptop-GPU speed this is a batch job, not interactive. | [DOC] https://github.com/Omni-Avatar/OmniAvatar |
| **FantasyTalking** | Apache-2.0; Wan2.1-I2V-14B-720P | 40 GB, 20 GB, or **5 GB at 42.6 s per iteration on an A100** (512x512, 81 frames) | Same caveat: feasible but very slow. | [DOC] https://github.com/Fantasy-AMAP/fantasy-talking |
| **Wan2.2-S2V-14B** | Apache-2.0 | Single-GPU example needs "at least 80GB VRAM"; no low-VRAM figures | Audio-driven plus pose; 480p / 720p. | [DOC] https://huggingface.co/Wan-AI/Wan2.2-S2V-14B |
| **HunyuanVideo-Avatar** | **Tencent Hunyuan Community License: "does not apply in the European Union, United Kingdom and South Korea"**; a separate licence is needed above 100M monthly active users; outputs may not be used to train other models; no impersonation without consent. | Minimum 24 GB (very slow), 96 GB recommended; about 10 GB via TeaCache / Wan2GP; tested on Linux only. | Territorial exclusion makes it unusable as a default for an international product. | [DOC] https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar ; https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar/blob/main/LICENSE |
| **Hallo2** | MIT; the high-resolution stage is a modified CodeFormer under **S-Lab License 1.0** (non-commercial) | Tested on A100 | English audio only; face rotation under 30 degrees. | [DOC] https://github.com/fudan-generative-vision/hallo2 |
| **Hallo3** | MIT sidebar, but "must comply with the license terms of CogVideo-5B" | Tested on H100 | English only. | [DOC] https://github.com/fudan-generative-vision/hallo3 |

The InsightFace dependency: the InsightFace repository states its code is MIT but its models and training data are "for non-commercial research purposes only", including models downloaded automatically by the library. [DOC] https://github.com/deepinsight/insightface

### 4.2 Hosted services (bring-your-own-key candidates)

| Service | Pricing and limits found | Evidence |
|---|---|---|
| **Sync Labs** | lipsync-1.9.0-beta $0.02–0.025/s; lipsync-2 $0.04–0.05/s (512x512 face); lipsync-2-pro $0.067–0.083/s; **sync-3 $0.107–0.133/s (4K native)**; react-1 $0.133–0.167/s (paid plans). Maximum duration 1 minute (Hobbyist) up to 30 minutes (Scale and above). Documented limits: needs natural speaking motion in the source, extreme profile views are sub-par, no animals or non-humanoid characters, multiple speakers and small faces are problematic. The comparison table's "identity preservation" row was blank and the page carries no consent or moderation statement. | [DOC] https://sync.so/docs/models/lipsync |
| **Runway Act-Two** (`act_two`) | $0.05/s through `/v1/character_performance`; released 2025-07-21; real-time Characters model `gwm1_avatars` also listed. Performance transfer from a driving video. | [DOC] https://docs.dev.runwayml.com/guides/models/ |
| **Hedra Character-3** | 8 credits per second; about $0.05/s at 720p through the API; no "Character-4" found. | [CLAIM] https://www.hedra.com/pricing ; https://hedra.com/docs/pages/getting_started/pricing ; https://www.hedra.com/video-models/hedra-character-3 |
| **HeyGen** | API moved to pay-as-you-go in 2026; Avatar IV about $3–6 per minute; free API credits removed in Feb 2026. | [IND] https://anam.ai/blog/heygen-pricing ; https://dev.to/2gelbuy/heygen-pricing-2026-all-plans-from-0-to-149mo-compared-2dff |
| **Kling Avatar 2.0** | Released 2025-12-04; through fal: Pro $0.115/s, Standard $0.0562/s; up to 5 minutes. | [IND] https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-ai-avatar-v2 ; https://runware.ai/models/klingai-avatar-2-0-pro |
| **Kling 3.0 lip sync** | Languages reported as Chinese, English, Japanese, Korean, Spanish; Arabic not mentioned. | [IND] https://www.atlascloud.ai/blog/tips/kling-ai-lip-sync |
| Veo / Sora native dialogue | Sora discontinued; Veo 3.1 and Gemini Omni Flash provide dialogue as part of mixed native audio (section 3.7). | [IND] https://www.atlascloud.ai/blog/guides/ai-video-models-native-audio-compared |

### 4.3 Reading across Part B

- **The only lip-sync models that are both commercially permissive and proven at or under 8 GB are MuseTalk 1.5 (4 GB laptop GPU, per its README) and LatentSync 1.5 (8 GB).** MuseTalk is the cleaner licence; LatentSync's weights carry OpenRAIL-style use restrictions and its pipeline touches InsightFace. [ASSUMED]
- MuseTalk's own stated weaknesses (256x256 face region, facial hair and lip colour not preserved, jitter) are exactly the identity-preservation failures a professional reviewer will notice in close-ups; pair it with a face-region restoration pass and reserve it for medium shots. [ASSUMED]
- Wan-2.1-based talking models (InfiniteTalk, MultiTalk, OmniAvatar, FantasyTalking) are all Apache-2.0 and can be forced into 5–8 GB, but the vendors' own timing figures on data-centre GPUs (22–43 s per iteration) imply very long renders on a laptop GPU. They qualify as "overnight batch", not as an interactive feature. [ASSUMED]
- No open model in this set documents Arabic lip-sync quality; Hallo2/3 and EchoMimicV2 explicitly limit audio languages. Arabic visemes should be a named item in qualification tests. [ASSUMED]
- Hosted lip sync is priced per second ($0.02–0.17), so a 60-second dialogue scene costs roughly $1.20–$10 per take before retries. That matters for "revision cost" comparisons in Part E. [ASSUMED] (arithmetic on the [DOC] Sync Labs prices)

---

## 5. PART C — Upscaling, interpolation and restoration

### 5.1 Topaz

| Item | Finding | Evidence |
|---|---|---|
| General local requirements | Dedicated GPU with at least 6 GB VRAM (8 GB for the Aion, Hyperion and Rhea models); CPU with AVX; on integrated graphics "very few processes will run at a usable speed". | [DOC] https://docs.topazlabs.com/topaz-video/system-requirements |
| Starlight models run locally (Windows, 32 GB RAM) | Starlight Mini: NVIDIA 10 GB minimum (16 GB strongly recommended), AMD 20 GB. Starlight HQ: 10 GB minimum (12 recommended). Starlight Precise 2.5: 12 GB minimum (16 recommended). Starlight Sharp: 16 GB minimum. Starlight Fast 2: 16 GB minimum (32 recommended). **Row-to-model mapping partly reconstructed by the fetch tool; re-read before quoting.** | [DOC] https://docs.topazlabs.com/topaz-video/system-requirements |
| Pricing (retrieved portion of the page) | Subscription plans only were visible: Topaz Video $59/month or $299/year ($254 first year); Pro $699/year; Studio $79/month or $499/year; Topaz for Web – Video $29/month (200 cloud credits); Astra listed at $39/month Personal and $299/month Pro. Desktop plans give unlimited local rendering; cloud credits expire monthly. | [DOC] https://www.topazlabs.com/pricing (page truncated) |
| Licence scope | Personal plans: "Personal and commercial use for orgs under $1M USD annual revenue"; Pro for full commercial rights. | [DOC] https://www.topazlabs.com/pricing |
| Astra | A third party suggests Astra is being consolidated into "Topaz for Web". | [IND] https://kwaflux.com/blog/topaz-starlight-models-explained |
| Perpetual licences | Not visible in the retrieved portion of the pricing page. | [UNKNOWN] |

Topaz is paid software and so can only ever be an optional, customer-owned external tool for this platform; its Starlight diffusion models start at 10 GB, which excludes 8 GB laptops. [ASSUMED]

### 5.2 Open models

| Model | Licence | Hardware feasibility | Limits | Evidence |
|---|---|---|---|---|
| **SeedVR2** (one-step, 3B / 7B) | Apache-2.0 | Official figure: one H100-80G handles 100 frames at 720x1280. | "Not robust to heavy degradations and very large motions"; "oversharpened results occasionally". | [DOC] https://github.com/ByteDance-Seed/SeedVR |
| **ComfyUI-SeedVR2_VideoUpscaler** (community runtime) | Apache-2.0 | "Low VRAM systems (8GB or less with proper optimization)" using GGUF Q4_K_M, BlockSwap and VAE tiling; batch size of 4n+1 frames for temporal consistency; VAE stage is slow; CPU only as an offload target. | Community runtime, not the vendor's. | [DOC] https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler |
| **FlashVSR** v1.1 (Nov 2025) | Apache-2.0 | About 17 FPS for 768x1408 on a single A100; VRAM not stated; RTX 40/50 compatibility "currently unknown"; designed for 4x. | Laptop feasibility unproven. | [DOC] https://github.com/OpenImagingLab/FlashVSR ; https://huggingface.co/JunhaoZhuang/FlashVSR-v1.1 |
| **STAR** | I2VGen-XL-based weights MIT; CogVideoX-5B-based weights under the CogVideoX licence | About 39 GB by default for 72 frames at 426x240 upscaled 4x; 24 GB or more recommended. | Not feasible on 8–12 GB. | [DOC] https://github.com/NJU-PCALab/STAR |
| **Real-ESRGAN** | BSD-3-Clause | Portable ncnn-Vulkan executables for Windows on Intel, AMD or NVIDIA GPUs with "no CUDA or PyTorch environment" needed; includes the `realesr-animevideov3` video model. | Frame-by-frame, so no temporal modelling; tiling "may introduce block inconsistency"; CPU inference not addressed. | [DOC] https://github.com/xinntao/Real-ESRGAN |
| **SUPIR** | **Custom non-commercial licence**; commercial use needs written permission | Low-VRAM mode: 12 GB for diffusion, 16 GB for the LLaVA captioner; depends on SDXL and LLaVA. | Image restoration; licence blocks commercial use. | [DOC] https://github.com/Fanghua-Yu/SUPIR |
| **RIFE** (Practical-RIFE) | MIT (code and models) | No VRAM figures; v4.25 is the recommended default, v4.26 dated 2024-09-21, plus a 4.25 lite model. | Flow-based; fails on large occlusions and very large motion. The limit is [ASSUMED]; the rest is documented. | [DOC] https://github.com/hzwer/Practical-RIFE |
| **GIMM-VFI** | **S-Lab License 1.0 (non-commercial)** | About 7.9 GB for 2K and 10.9 GB for 4K at 8x on a V100, with downscale factors. | Licence blocks commercial use. | [DOC] https://github.com/GSeanCDAT/GIMM-VFI ; https://github.com/GSeanCDAT/GIMM-VFI/blob/main/LICENSE |
| **FILM** | Apache-2.0 | TensorFlow 2 | **Repository archived 14 Oct 2025.** | [DOC] https://github.com/google-research/frame-interpolation |

Hosted alternatives in the same slot, visible in Runway's API list: Magnific Video Upscaler (from $0.007 per frame), "Enhance Frame Rate", and "Ruby". [DOC] https://docs.dev.runwayml.com/guides/models/

### 5.3 Reading across Part C

- **Default local chain for 8–12 GB: Real-ESRGAN (ncnn-Vulkan) for fast spatial upscale, RIFE for interpolation, SeedVR2 GGUF as the slow "quality" restoration option.** All three are permissive. [ASSUMED]
- Real-ESRGAN's Vulkan build is the only upscaler here documented to run on integrated or non-NVIDIA GPUs, which makes it the realistic CPU-only-laptop fallback (via the integrated GPU); true CPU-only upscaling of video was not documented by any source and should be treated as impractical. [ASSUMED]
- One-step diffusion restorers can change faces and texture ("oversharpened", not robust to large motion), so restoration is an **identity-altering step** and should be recorded in provenance and included in identity-consistency checks, not treated as a neutral export option. [ASSUMED]
- SUPIR, GIMM-VFI and the Hallo2 super-resolution stage share non-commercial terms; they should be absent from any default install. [ASSUMED]

---

## 6. PART D — Character, product, world and style consistency methods

### 6.0 Two things that must not be confused

| | Reference management in the product | Demonstrated model consistency |
|---|---|---|
| What it is | Storing, naming, versioning and attaching reference assets (character sheets, product packshots, style frames, voices) to shots; passing them into whichever model slot exists. | The measured probability that a model, given those references, returns the same identity, wardrobe, product geometry, logo, palette and set across shots and revisions. |
| Who controls it | The platform. Deterministic. | The model. Stochastic, version-dependent. |
| How it is evidenced | Feature exists and round-trips. | Only by tests on a fixed task set with human review (section 7). |
| Typical over-claim | "Supports up to N references" presented as "keeps characters consistent". | A single cherry-picked demo presented as a property. |

All statements in this table are [ASSUMED] (framing for the report). The rest of Part D keeps the two columns apart: vendor-stated reference slots are tagged [CLAIM] or [IND] and are never used as evidence of consistency.

### 6.1 Hosted multi-reference and subject-to-video

| System | Reference capability reported | Independent observations of where it fails | Evidence |
|---|---|---|---|
| **Kling O1** reference-to-video | Maximum of 7 total inputs (elements, reference images and start image) according to aggregator docs. O3 is described as its evolution. | Not found. | [IND] https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-o1-reference-to-video ; https://www.runcomfy.com/models/kling/kling-video-o1/image-to-video/reference |
| **Kling 4.0 / O3** | Models exist in Runway's API list; reference limits not found. | Not found. | [DOC] https://docs.dev.runwayml.com/guides/models/ (existence only) |
| **Seedance 2.5** (about June 2026) | Up to 50 references (30 images, 10 videos, 10 audio) with typed `@Image` / `@Video` / `@Audio` handles; 30 s per generation; native 4K; prompt-driven multi-shot ("Shot 1: / Shot 2:"). | A hands-on reviewer saw **wardrobe drift** (a studded leather jacket became a bomber jacket). Real human faces in first frames may be blocked by policy. | [IND] https://runware.ai/docs/models/bytedance-seedance-2-5/guides/multi-reference-production ; https://docs.together.ai/docs/seedance2.5-quickstart ; https://www.kapwing.com/resources/is-seedance-2-5-actually-better-than-2-0-heres-what-i-found/ |
| **Gemini Omni Flash 1.1 / 1.2** (successor branding to Veo "ingredients") | 3–10 s clips, up to 4K, native audio, reference images; the reference limit is reported inconsistently as 5, 7 or 9. | One independent test: "multi-shot character consistency drops past shot four". | [IND] https://runware.ai/docs/models/google-gemini-omni-flash/guides/reference-driven-video ; https://www.buildfastwithai.com/blogs/gemini-omni-flash-review-google-ai-video-model-2026 ; https://definable.ai/blog/google-gemini-omni-the-complete-guide-what-it-is-what-actually-works-and-what-doesnt/ |
| **Runway References**, **Vidu reference** | Not researched. | Not researched. | [UNKNOWN] |

Cost and privacy: every option above is paid inference on a third-party cloud and can only be an opt-in, customer-keyed path. Reference images of real people leave the machine when used this way, and at least one provider reportedly blocks real faces, so the product needs a visible "this reference will be uploaded to provider X" step. [ASSUMED]

### 6.2 Open multi-reference and subject-to-video (mostly on Wan 2.1 / 2.2)

| Model | Licence | Base and hardware | Stated limits | Evidence |
|---|---|---|---|---|
| **VACE** | Apache-2.0 for code and for Wan2.1-VACE-1.3B / 14B weights | 1.3B at about 81 frames 480x832; 14B at about 81 frames 720x1280; VRAM not stated | Reference-to-video, video-to-video (depth and other controls), masked video-to-video in one model. | [DOC] https://github.com/ali-vilab/VACE |
| **Phantom** | Apache-2.0 | Wan2.1 1.3B and 14B | "Number of reference images should be within 4"; 14B less stable at 720p and above; vertical formats less stable. | [DOC] https://github.com/Phantom-video/Phantom |
| **Stand-In** | Apache-2.0 | Wan2.1-14B-T2V (plus a Wan2.2 version); 153M added parameters | Downloads `antelopev2` (an InsightFace model pack; the page does not flag the non-commercial terms); face swap experimental; best on frontal medium and close-up shots. | [DOC] https://github.com/WeChatCV/Stand-In |
| **MAGREF** | Apache-2.0 | Wan2.1 14B; "inference consumes around 70 GB of VRAM" | Multi-subject; community FP8 builds exist. | [DOC] https://github.com/MAGREF-Video/MAGREF |
| **Lynx** | Code Apache-2.0; weights licence not stated | Wan2.1-T2V-14B; VRAM not stated | n/a | [DOC] https://github.com/bytedance/lynx |
| **HunyuanCustom** | Licence not shown on the page fetched | Minimum 24 GB (very slow), 80 GB recommended; 8 GB via the third-party WanGP runtime; tested on Linux | Single-subject, audio-driven and video-driven modes released; multi-subject not released. | [DOC] https://github.com/Tencent-Hunyuan/HunyuanCustom |
| **SkyReels-A2** | In `LICENSE.txt`, not read | A2-Wan2.1-14B-Preview only; RTX 4090 with offload | Preview. | [DOC] https://github.com/SkyworkAI/SkyReels-A2 (licence cell [UNKNOWN]) |
| **FramePack** | Apache-2.0 repository | "At least 6GB GPU memory"; 60 s at 30 fps with a 13B model in about 6 GB; Windows one-click package; RTX 30/40/50 required; laptop 3070 Ti / 3060 "about 4x to 8x slower" than a 4090 (2.5 s per frame on the 4090); more than 30 GB of downloads | Image-to-video with long-duration anti-drift design. | [DOC] https://github.com/lllyasviel/FramePack |
| **Wan2.2-TI2V-5B** | Apache-2.0 | 720p 24 fps text- and image-to-video; card says "at least 24GB VRAM" with offload flags; 5 s 720p in under 9 minutes | The smallest current official Wan model; community quantisation for 8–12 GB was not verified. | [DOC] https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B |
| **LTX-2.5** | LTX-2.x Community License (free commercial under USD 10M revenue) | 22B; minimum VRAM not stated | Native multishot and joint audio. | [DOC] https://huggingface.co/Lightricks/LTX-2.5 |
| **MiniMax H3** open weights | Custom licence reportedly **excluding the US, EU, UK and South Korea** for local deployment; base model only | About 18 GB peak on a 24 GB 4090 with INT8 and offload; a WanGP release from Oct 2026 claims 480p in 5–6 GB and 1080p in 11 GB | Reports conflict; the model card was not fetched. | [IND] https://www.atlascloud.ai/blog/tips/minimax-h3-open-source-weights ; https://kingy.ai/news/minimax-h3-benchmarks-specs-hardware-review/ ; https://www.mindstudio.ai/blog/minimax-h3-run-locally-guide ; https://willitrunai.com/video-models/minimax-h3 |

- HunyuanCustom most likely falls under the same Tencent Hunyuan Community License as HunyuanVideo-Avatar, with the EU / UK / South Korea exclusion; FramePack's base model is HunyuanVideo-derived, so the same question applies to its weights even though the FramePack repository is Apache-2.0. [ASSUMED]
- For 8–12 GB, the documented open options are FramePack (6 GB) and the 1.3B variants of VACE and Phantom; everything based on Wan 14B needs community quantisation or a block-swapping runtime and will be slow. [ASSUMED]
- A stress-test benchmark of multi-subject generation reports that models hold up at 2–4 subjects and then collapse, and that global CLIP metrics are "insensitive to local identity collapse". [DOC] https://scispace.com/papers/when-identities-collapse-a-stress-test-benchmark-for-multi-sn4ncf4jdvuw

### 6.3 Image-first pipelines (make the keyframe consistent, then animate)

| Component | Licence / access | Hardware | Notes | Evidence |
|---|---|---|---|---|
| **Nano Banana 2.1 / Pro** (hosted) | Google API | n/a | Up to 14 reference images and roughly 4–5 consistent people reported. | [IND] https://runware.ai/docs/models/google-nano-banana-2-1/guides/subject-consistency |
| **Seedream 5.0 Pro / Lite** (hosted) | ByteDance API | n/a | 10 or 14 references (sources conflict). | [IND] https://runware.ai/docs/models/bytedance-seedream-5-0-pro ; https://evolink.ai/blog/how-to-use-seedream-5-0-pro-multi-reference-image-generation |
| **Qwen-Image-2.0** (hosted) | Closed-weight API | n/a | 10 reference images; 2.1 status unclear. | [IND] https://wavespeed.ai/blog/posts/blog-what-is-qwen-image-2-0-features-benchmarks ; https://runtimewire.com/article/alibaba-qwen-image-2-1-character-storyboard-editing-preview |
| **Qwen-Image-Edit-2511** (open) | Apache-2.0 | GGUF Q4 about 11–12 GB; 8 GB only with heavy offload | Multi-image input; improved character consistency reported. | [IND] https://huggingface.co/Qwen/Qwen-Image-Edit-2511 ; https://the-decoder.com/qwen-updates-image-editing-model-with-better-character-consistency/ ; https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF (search-level) |
| **FLUX.1 Kontext [dev]** (open weights) | **FLUX.1 [dev] Non-Commercial License**; the card states that generated outputs may be used commercially; the licence requires content filters or manual review | 12B | Running the model inside a commercial product is the restricted act, not the outputs. That reading is [ASSUMED]; the licence facts are documented. | [DOC] https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev |
| **FLUX.2 [klein] 4B** | Apache-2.0; klein 9B and FLUX.2 [dev] 32B are non-commercial | About 13 GB, about 8 GB quantised | The permissive member of the FLUX family. | [CLAIM] https://bfl.ai/blog/flux2-klein-towards-interactive-visual-intelligence |
| **FLUX 3 Image Klein** (5.6B) | Reported: open weights, free commercial use under USD 5M revenue | Reported INT8 on 8 GB | Up to 10 reference images. Vendor card not fetched. | [IND] https://www.digitalapplied.com/blog/flux-3-image-klein-open-weights-8gb-gpu |
| **OmniGen2** | Apache-2.0 | About 17 GB natively; under 3 GB with sequential CPU offload (very slow) | README admits it "sometimes does not follow instructions" and that in-context generation "sometimes produces objects that differ from the original ones". | [DOC] https://github.com/VectorSpaceLab/OmniGen2 |

Where image-first fails: the keyframe can be perfect and the image-to-video model still redraws the identity during motion, turns or occlusion; consistency is then bounded by the video model, not the image model. A training-free method paper makes the same point from the other side: the first clear appearance of an entity sets the ceiling for later consistency. [DOC] https://scispace.com/papers/groundshot-visually-consistent-multi-shot-long-video-o2b28s1n5m4d

### 6.4 Identity, subject and style adapters

| Adapter | Licence | Hardware | Limits and hidden dependencies | Evidence |
|---|---|---|---|---|
| **IP-Adapter** | Apache-2.0 | Light | FaceID variants' licence note was not read. | [DOC] https://github.com/tencent-ailab/IP-Adapter |
| **InstantID** | Code Apache; checkpoints "for research purposes only"; uses InsightFace `antelopev2` (non-commercial) | SDXL class | No multi-person support. | [DOC] https://github.com/instantX-research/InstantID |
| **PuLID** (incl. PuLID-FLUX) | Apache-2.0 | PuLID-FLUX on 16 GB; Gradio path 12 GB | "ID fidelity is not high enough for some male inputs" (v0.9.0). InsightFace dependency not confirmed from the page. | [DOC] https://github.com/ToTheBeginning/PuLID |
| **InfiniteYou** | Code Apache-2.0; **model CC BY-NC 4.0, "for academic research purposes only"**; uses InsightFace | 43 GB peak, 16 GB with 8-bit and offload | FLUX.1-dev base. | [DOC] https://github.com/bytedance/InfiniteYou |
| **USO** (subject + style) | Apache-2.0 | fp8 with offload peaks at 16–18 GB | FLUX-dev based. | [DOC] https://github.com/bytedance/USO |
| **DreamO** | Apache-2.0 | 24 GB default; 16 GB with int8 and offload; **6.5–8 GB GPUs via Nunchaku plus offload** (about 20 s per 1024px image on an RTX 3080 per a user report quoted in the README) | Style mode unstable; more ID contamination than PuLID by the authors' own account. | [DOC] https://github.com/bytedance/DreamO |
| **ACE++**, **UNO** | Not researched | Not researched | Not researched | [UNKNOWN] |

- PuLID-FLUX, USO, DreamO and InfiniteYou sit on FLUX.1-dev, so the FLUX.1 [dev] non-commercial model licence governs running them regardless of the adapter's own Apache-2.0 licence. [ASSUMED]
- Research on identity adapters reports a "copy-paste" failure where the reference face is reproduced rigidly rather than re-posed, which inflates similarity scores while looking wrong. [DOC] https://scispace.com/papers/withanyone-towards-controllable-and-id-consistent-image-al5fjksl3xrt

### 6.5 LoRA training for identity, style and product

| Trainer | Licence | Supports | Hardware | Evidence |
|---|---|---|---|---|
| **ai-toolkit** (Ostris) | MIT | FLUX.1-dev, Wan 2.1/2.2, Qwen-Image, Z-Image, LTX-2; Windows launcher `run_windows.bat`; local web UI | Example config is named for 24 GB; no minimum VRAM stated | [DOC] https://github.com/ostris/ai-toolkit |
| **musubi-tuner** (kohya-ss) | Apache-2.0 (some bundled directories keep upstream licences) | HunyuanVideo, Wan 2.1/2.2, FramePack, FLUX.1 Kontext, FLUX.2, Qwen-Image, Z-Image, MiniMax-H3 and others; Windows confirmed | "12GB or more recommended for image training, 24GB or more for video training"; 64 GB system RAM recommended | [DOC] https://github.com/kohya-ss/musubi-tuner |
| kohya sd-scripts, OneTrainer | Not researched | Not researched | Not researched | [UNKNOWN] |

- **Maturity**: LoRA is the most established route to a specific face, product or style in open models. [ASSUMED]
- **Hardware**: image LoRA training is at the edge of feasibility on a 12 GB laptop and video LoRA training is outside the 8–12 GB envelope by the trainer's own recommendation. [ASSUMED] (reading of the [DOC] musubi-tuner figures)
- **Time and money**: no source with measured training times or cloud costs was captured before the search budget ran out. [UNKNOWN]
- **Licence**: the trainer's licence does not determine the LoRA's; a LoRA is a derivative of its base model's weights and inherits that model's licence terms (so a FLUX.1-dev LoRA is bound by the non-commercial model licence, a Wan 2.x LoRA by Apache-2.0). This is a common reading, not legal advice. [ASSUMED]
- **Where it fails**: overfitting to the training poses and lighting, concept bleed between two LoRAs in the same shot, and the consent problem of training on a real person's images. [ASSUMED]
- A "no paid inference" platform cannot assume cloud LoRA training; where the customer's GPU is too small, the fallback is reference-based adapters (6.2, 6.4), not a hidden cloud job. [ASSUMED]

### 6.6 First-last-frame chaining and drift

Published evidence on why extending or chaining clips degrades (all from paper abstracts on autoregressive or sliding-window long-video generation):

- Errors during self-rollout "accumulate over long horizons, manifesting as color drift, motion stagnation, and eventual visual collapse". [DOC] https://scispace.com/papers/freqforcing-autoregressive-long-video-generation-via-meoa0ty2ryw3
- The cause is described as exposure bias: the model trains on clean contexts but infers from its own generated frames, so errors compound and quality drifts over time. [DOC] https://scispace.com/papers/bagger-backwards-aggregation-for-mitigating-drift-in-lmmzkuh8kdav
- Sliding-window conditioning creates "an irreversible generation trajectory": once the active window holds appearance errors, later generations condition only on that degraded trajectory and drift further. [DOC] https://scispace.com/papers/longlive-rag-a-general-retrieval-augmented-framework-for-fqpqa4mjaryy
- Drift is described as "colors and textures shift, and motion dynamics decay". [DOC] https://scispace.com/papers/in-distribution-forcing-for-long-video-generation-at-test-udxhktpt5whu
- Mitigations in the literature anchor to the initial frame or to retrieved earlier frames. [DOC] https://scispace.com/papers/pathwise-test-time-correction-for-autoregressive-long-video-xy6px2no33vp
- Hand-crafted anti-drift (modified noise schedules, frame anchoring) is described as limited to single-prompt extrapolation. [DOC] https://scispace.com/papers/stable-video-infinity-infinite-length-video-generation-with-adkvyfbnplj0
- Beyond colour drift, long-horizon generation shows continuity failures such as object permanence errors. [DOC] https://scispace.com/papers/goodbye-drift-anchored-tree-sampling-for-long-horizon-video-2rvnrreibgqf
- Product-level confirmation from a vendor README: "Beyond 1 minute, color shifts become more pronounced". [DOC] https://github.com/MeiGen-AI/InfiniteTalk
- Further method papers on the same problem: Rolling Forcing, MemoryPack, TokenTrim, TetherCache, Cycle-World and "Towards Error-Free Long Video Generation". [DOC] https://scispace.com/papers/rolling-forcing-autoregressive-long-video-diffusion-in-real-jlnav08ps6b2 ; https://scispace.com/papers/pack-and-force-your-memory-long-form-and-consistent-video-2nddb96uxqp1 ; https://scispace.com/papers/tokentrim-inference-time-token-pruning-for-autoregressive-1irlphvoi3xd ; https://scispace.com/papers/tethercache-stabilizing-autoregressive-long-form-video-z5poo0mku3q0 ; https://scispace.com/papers/cycle-world-mitigating-error-accumulation-in-long-term-video-l96ro5a6w0wu ; https://scispace.com/papers/towards-error-free-long-video-generation-ylfxczfjx2c3

Applying this to product-level "use the last frame of clip N as the first frame of clip N+1" chaining: the same mechanism applies, because each hop conditions on a generated, re-encoded frame. Practical rules that follow: always re-anchor each shot to the original approved reference rather than only to the previous clip's last frame; colour-match each hop to the anchor; cap the number of hops and measure identity and colour distance to the anchor at every hop; prefer cuts over continuous extension. [ASSUMED]

### 6.7 3D-anchored approaches and world models

| Approach | State | Evidence |
|---|---|---|
| **Blender (or any DCC) blocking → depth / pose / edge control → VACE or ControlNet** | VACE documents depth-conditioned video-to-video, which is the hook for this pipeline. No dedicated benchmark or vendor guide for the Blender route was captured. | [DOC] https://github.com/ali-vilab/VACE (depth control only); pipeline maturity [ASSUMED] |
| **World Labs Marble** | Exports Gaussian splats (`.spz` / `.ply`); metered World API ($1 = 1,250 credits); static environments; commercial rights reportedly tied to the Pro plan; splat creation from posed images in beta since 30 Oct 2026. | [IND] https://docs.worldlabs.ai/marble/export/gaussian-splat ; https://radiancefields.com/world-labs-introduces-world-api-for-marble ; https://radiancefields.com/world-labs-opens-gaussian-splat-creation-in-marble (search-level) |
| **Genie 3 / Project Genie** | No API; Project Genie available to Google AI Ultra subscribers in the US ($249.99/month). | [CLAIM] https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/ |
| **Odyssey-2 Pro / Max** | Pro has an API (Jan 2026); Max in private beta (Apr 2026). | [CLAIM] https://odyssey.ml/introducing-odyssey-2 ; https://odyssey.ml/introducing-odyssey-2-max ; https://documentation.api.odyssey.ml/ |

- A 3D scene is the only method in this section whose consistency is **guaranteed by construction** for layout, camera and scale, because the geometry is the user's own asset; the generative model then only has to keep texture and identity. It is also fully local and free up to the control-conditioned render. [ASSUMED]
- It fails where the generative pass re-interprets surfaces between shots (materials, faces, text) and it costs artist time for blocking. [ASSUMED]
- World models are hosted, paid and (Genie) region- and subscription-locked; they are not candidates for a local-first default and are useful mainly as an importable asset source (Marble splats). [ASSUMED]

### 6.8 Relighting

| Tool | Licence | Notes | Evidence |
|---|---|---|---|
| **IC-Light** | Apache-2.0 code | The demo uses BRIA RMBG 1.4, which "is for non-commercial use"; replace it with a permissive matting model. V2 is not described on the page. | [DOC] https://github.com/lllyasviel/IC-Light |
| **LightX** | Not verified | Repository URL returned 404. | [UNKNOWN] |
| Relight LoRAs | Not researched | n/a | [UNKNOWN] |

Relighting an image changes skin tone, material response and sometimes facial structure, so it is another identity-altering step that needs an after-check. Video relighting with temporal stability was not evidenced by any source here. [ASSUMED]

### 6.9 Continuity across shots

Native multi-shot generation:

| Model | Multi-shot capability | Evidence |
|---|---|---|
| Seedance 2.5 | Prompt-driven multi-shot within a 30 s generation. | [IND] https://runware.ai/docs/models/bytedance-seedance-2-5/guides/multi-reference-production |
| LTX-2.5 | "Native multishot generation" (open weights, community licence). | [DOC] https://huggingface.co/Lightricks/LTX-2.5 |
| HoloCine | Per-shot captions with `shot_cut_frames`, 241 frames (about 15 s), Wan 2.2 14B base. **CC BY-NC-SA 4.0, "academic research purposes only".** 5B and longer variants "to be released". | [DOC] https://github.com/yihao-meng/HoloCine |
| Gemini Omni Flash | Multi-shot use reported with consistency dropping after about four shots. | [IND] https://www.buildfastwithai.com/blogs/gemini-omni-flash-review-google-ai-video-model-2026 |
| Kling 4.0 multi-shot | Not established. | [UNKNOWN] |

Research methods for "shot memory" (paper-abstract level; none is a shipped product feature):

- StoryMem (memory of keyframes across shots). [DOC] https://scispace.com/papers/storymem-multi-shot-long-video-storytelling-with-memory-487cgye4dxwb
- VideoMemory. [DOC] https://scispace.com/papers/videomemory-toward-consistent-video-generation-via-memory-lvlotdesanr1
- GroundShot (training-free; first clear appearance sets the consistency ceiling). [DOC] https://scispace.com/papers/groundshot-visually-consistent-multi-shot-long-video-o2b28s1n5m4d
- EvoState (closed-loop visual state management). [DOC] https://scispace.com/papers/evostate-closed-loop-visual-state-management-for-long-form-2jj4mha3nq13
- CANVAS, MVAgent, STAGE, VideoGen-of-Thought (agentic and storyboard-anchored pipelines). [DOC] https://scispace.com/papers/canvas-continuity-aware-narratives-via-visual-agentic-iyzljtnodkyv ; https://scispace.com/papers/mvagent-multi-agent-video-generation-via-consistent-fj3wu3ate790 ; https://scispace.com/papers/stage-storyboard-anchored-generation-for-cinematic-multi-tmdwcid10ptj ; https://scispace.com/papers/videogen-of-thought-a-collaborative-framework-for-multi-shot-onucdzbeiwbi
- UnityShots (memory-driven multi-shot audio-video on LTX-2.3). [DOC] https://scispace.com/papers/unityshots-memory-driven-multi-shot-audio-video-generation-v83pwjt8vs3q
- A 2026 multi-shot benchmark concludes that "current models primarily behave as visual interpolators" rather than maintaining narrative state. [DOC] https://scispace.com/papers/msvbench-towards-human-level-evaluation-of-multi-shot-video-dckboms5utww

What these papers have in common is an explicit, structured state outside the model: an entity list, the approved first appearance of each entity, per-shot schedules of who and what is on screen, and a retrieval step that feeds the right references to each shot. That is reference management, and it is the part a platform can own deterministically regardless of which model renders. [ASSUMED]

### 6.10 Maturity matrix

All rows are synthesis; each row's evidence is in the subsection named. [ASSUMED]

| Method | Maturity | Where it fails | Hardware / cost | Licence position |
|---|---|---|---|---|
| Hosted multi-reference video (6.1) | Productised, fast-moving | Wardrobe and prop drift, loss after about four shots, real-face policy blocks, model version changes under you | Paid cloud only | Provider terms; customer key |
| Open subject-to-video on Wan (6.2) | Usable research code | Few references (about 4), frontal bias, 14B memory needs | 1.3B variants and FramePack on 6–12 GB; 14B needs quantised community runtimes | Mostly Apache-2.0; watch InsightFace, Tencent and MiniMax territory terms |
| Image-first then image-to-video (6.3) | Most common working practice | Video model redraws identity under motion and occlusion | Qwen-Image-Edit GGUF about 11–12 GB; FLUX.2 klein 4B quantised about 8 GB | Apache-2.0 options exist; FLUX dev-class models non-commercial |
| ID / style adapters (6.4) | Mature for stills | Copy-paste rigidity, weak on some faces, no multi-person in several | 8–16 GB with quantisation | Adapter licences permissive, base models and InsightFace often not |
| LoRA training (6.5) | Mature | Overfit, bleed, consent, time | Image LoRA at 12 GB or more; video LoRA 24 GB or more | Inherits base-model licence |
| First-last-frame chaining (6.6) | Universal, fragile | Colour and identity drift compounding per hop | Same as the underlying model | Same as the underlying model |
| 3D-anchored control (6.7) | Dependable for layout and camera | Texture and identity re-interpretation; artist time | Local; Blender is free; control pass as per 6.2 | Permissive (VACE Apache-2.0) |
| World models (6.7) | Early, hosted | Static scenes or no API | Paid cloud | Provider terms |
| Relighting (6.8) | Stills only evidenced | Identity and material shift; video stability unproven | Light | IC-Light Apache-2.0 after replacing the matting model |
| Native multi-shot (6.9) | New in 2026 | Short horizon; consistency decays over shots | Hosted, or LTX-2.5 above 12 GB | LTX community licence; HoloCine non-commercial |
| External shot memory (6.9) | Research | Not productised; depends on retrieval quality | Negligible (metadata) | The platform's own |

---

## 7. PART E — Evaluation

Consensus-indexed papers are cited as **[C-n]** and listed with their exact URLs in section 11.6; SciSpace-indexed papers are cited by their SciSpace URL.

### 7.1 Automatic metrics and their weaknesses

#### 7.1.1 Benchmark suites

| Suite | What it measures | What limits its use for comparing two production tools | Evidence |
|---|---|---|---|
| **VBench** (2023) | Hierarchical, disentangled dimensions for text-to-video, validated against human preference annotations. | Designed to rank models on its own prompt suite. For **your own videos** (`mode=custom_input`) only six dimensions are supported: subject consistency, background consistency, motion smoothness, dynamic degree, aesthetic quality, imaging quality. Temporal flickering requires running a static-video filter first. Detectron2 "is working only with CUDA 12.1 or 11.X". No VRAM figures are given. Repository Apache-2.0; depends on UMT, RAM, CLIP, RAFT, GRiT, ViCLIP and the LAION aesthetic predictor, each with its own licence. | [DOC] https://github.com/Vchitect/VBench ; https://scispace.com/papers/vbench-comprehensive-benchmark-suite-for-video-generative-4htd0upxrc |
| **VBench-2.0** | "Intrinsic faithfulness": commonsense, physics, human motion, composition; five categories and 18 fine-grained dimensions. | A 2026 benchmark paper argues that binary VQA-based benchmarks such as VBench 2.0 are prone to yes-bias and rely on "low-resolution auditors that miss temporal failures". | [DOC] https://github.com/Vchitect/VBench ; https://scispace.com/papers/worldjen-an-end-to-end-multi-dimensional-benchmark-for-hdhh4ezsy8bl |
| **VBench++** (TPAMI 2025) | Adds image-to-video, long video and trustworthiness tracks. | Same structural limits. | [DOC] https://scispace.com/papers/vbench-comprehensive-and-versatile-benchmark-suite-for-video-7ejktg7xsrhc ; [C-6] |
| **EvalCrafter** (CVPR 2024) | 700 prompts, 17 objective metrics, aligned to user opinion. | Prompt-suite-bound. | [DOC] https://scispace.com/papers/evalcrafter-benchmarking-and-evaluating-large-video-24nvnzfevz ; [C-2] |
| **T2V-CompBench** | Compositionality: 1,400 prompts in 7 categories of 200; MLLM-based (LLaVA), detection-based (GroundingDINO; Depth Anything with GroundingSAM) and tracking-based metrics; "verified by correlation with human evaluations". | Heavy model stack; licence not stated on the page. | [DOC] https://github.com/KaiyueSun98/T2V-CompBench |
| **FETV** (2023) | Fine-grained categories with human evaluation of several models. | Its finding is itself the caveat: "existing automatic metrics (e.g., CLIPScore and FVD) correlate poorly with human evaluation". | [DOC] https://scispace.com/papers/fetv-a-benchmark-for-fine-grained-evaluation-of-open-domain-1xwzagl7u9 ; [C-9] |
| **VideoScore / VideoScore2** | Learned scorers trained on human ratings; VideoScore2 adds reasoning before scoring. | Learned on older models' failure distribution; transfer to new models is not guaranteed. The limit is [ASSUMED]. | [DOC] https://scispace.com/papers/videoscore-building-automatic-metrics-to-simulate-fine-14ngtc681q ; https://scispace.com/papers/videoscore2-think-before-you-score-in-generative-video-h9nt5p5r2s7k |
| Others | DynamicEval, EVBench (e-commerce product consistency), World Consistency Score, GAIA (action quality), VideoGen-Eval, T2VTextBench, T2VCountBench. | Narrow-purpose. | [DOC] https://scispace.com/papers/dynamiceval-rethinking-evaluation-for-dynamic-text-to-video-wrwhn4rx1b33 ; https://scispace.com/papers/evbench-a-comprehensive-benchmark-of-video-generative-models-1ltrl4fuhzyl ; https://scispace.com/papers/world-consistency-score-a-unified-metric-for-video-46tnfhs7173f ; https://scispace.com/papers/gaia-rethinking-action-quality-assessment-for-ai-generated-399cnourp7 ; https://scispace.com/papers/videogen-eval-agent-based-system-for-video-generation-fgzs4vnabukz ; [C-5] ; [C-8] |

A 2026 reliability study reports that CLIP similarity, FVD and VBench "often produce conflicting rankings and are sensitive to dataset characteristics". [DOC] https://scispace.com/papers/evaluating-the-evaluators-metric-reliability-and-agreement-utfjj06rruz6

#### 7.1.2 Metric families

| Metric family | Documented weakness | Evidence |
|---|---|---|
| **FVD** | Content-biased: "FVD increases only slightly with large temporal corruption". | [DOC] https://scispace.com/papers/on-the-content-bias-in-fr-echet-video-distance-53vhnumdjv |
| FVD (continued) | Non-Gaussian I3D feature space, insensitivity to temporal distortions and impractically large sample sizes; an alternative (JEDi) is proposed. | [DOC] https://scispace.com/papers/beyond-fvd-enhanced-evaluation-metrics-for-video-generation-5awgzfe8u3w4 |
| FVD (continued) | FVD "favors distributional textures over physical plausibility". | [DOC] https://scispace.com/papers/worldjen-an-end-to-end-multi-dimensional-benchmark-for-hdhh4ezsy8bl |
| FVD, IS, CLIP Score together | Described as "unreliable indicators of true video quality". | [DOC] https://scispace.com/papers/towards-a-better-metric-for-text-to-video-generation-25mzldcwmj |
| **CLIP / ViCLIP text-video alignment** | Poor correlation with human judgement (FETV above); a 2025 hierarchical alignment benchmark reports about 69% Pearson correlation with human judgement for its proposed metric. | [DOC] https://scispace.com/papers/evaluating-text-to-video-alignment-a-hierarchical-benchmark-tkqmcuq88aru |
| SigLIP-specific evidence | Not researched. | [UNKNOWN] |
| **DINO / CLIP-I subject similarity** | Global CLIP-I, DINO and CLIP-T "correlate poorly with human perception" because they attend to the whole image and do not separate the concept subject from the background; a masked alternative is proposed. | [DOC] https://scispace.com/papers/masc-a-masked-similarity-metric-for-evaluating-concept-gj9bndeunhcc |
| Subject similarity over changing casts | Benchmarks now evaluate consistency over dynamic subject sets rather than a single subject. | [DOC] https://scispace.com/papers/towards-subject-consistency-over-dynamic-subject-sets-in-4m707zzv4eex |
| DINOv3 specifics and licence | Not researched. | [UNKNOWN] |
| **Face-identity similarity (ArcFace and similar)** | Similarity to a neutral reference can fall under strong expressions "even for real images of the same person". | [DOC] https://scispace.com/papers/expression-diverse-references-for-identity-preserving-video-n45lz87wwjpv |
| Face identity (continued) | Identity preservation is "not solved by frontal-face similarity alone" (multi-view). | [DOC] https://scispace.com/papers/argus-stacked-multi-view-identity-mosaic-injection-for-wdat5qkq49y9 |
| Face identity (continued) | High similarity can come from "copy-paste" of the reference rather than a re-posed identity. | [DOC] https://scispace.com/papers/withanyone-towards-controllable-and-id-consistent-image-al5fjksl3xrt |
| Face identity (continued) | A video "may appear globally consistent while identity-critical human details still drift". | [DOC] https://scispace.com/papers/vera-identity-faithful-human-subject-to-video-generation-rf4i31cxcb34 |
| Face identity: good practice | A 2026 audit reports ArcFace results against measured noise floors and impostor bands, with 96 cells per configuration and two seeds. | [DOC] https://scispace.com/papers/auditing-the-face-condition-port-in-diffusion-based-video-gntx74zyyr9a |
| Face identity: licence | The standard open ArcFace model packs (`buffalo_l`, `antelopev2`) are InsightFace models, "for non-commercial research purposes only". | [DOC] https://github.com/deepinsight/insightface |
| AdaFace licence | Not researched. | [UNKNOWN] |
| Other identity metrics | ID-Sim, Visual Semantic Matching ("Mind-the-Glitch"), DiffSim, a Face Consistency Benchmark for generated video. | [DOC] https://scispace.com/papers/id-sim-an-identity-focused-similarity-metric-8gs2qkxgd466 ; https://scispace.com/papers/mind-the-glitch-visual-correspondence-for-detecting-1ywsn9u47cfm ; https://scispace.com/papers/diffsim-taming-diffusion-models-for-evaluating-visual-3wmq9ug5pism ; https://scispace.com/papers/face-consistency-benchmark-for-genai-video-8832t7dhsfq5 |
| **Motion smoothness, flicker, temporal consistency** | Temporal metrics either need large sample populations (FVD) or reward smooth-to-static motion (VBench-style flickering and smoothness), which the paper calls "a documented failure mode". | [DOC] https://scispace.com/papers/temporal-distance-predictability-a-reference-free-per-video-4chte8tjna27 |
| Dynamics | A dynamics-centred protocol (DEVIL) was proposed because existing protocols under-weight how much actually moves. | [DOC] [C-4] |
| Warping error, optical-flow consistency, CLIP frame-to-frame consistency | Not researched in dedicated sources. They share the "static video scores best" failure mode by construction, since a frozen frame has zero warping error and perfect frame-to-frame similarity. | [ASSUMED] |
| **Aesthetic predictors** | VBench uses the LAION aesthetic predictor. On an expert-annotated aesthetic benchmark, frontier models reached 26.5% against 68.9% for experts. | [DOC] https://github.com/Vchitect/VBench ; https://scispace.com/papers/visual-aesthetic-benchmark-can-frontier-models-judge-beauty-dw400riayikl |

#### 7.1.3 VLM-as-judge

| Finding | Evidence |
|---|---|
| Across 19 multimodal LLMs, "substantial limitations in artifact perception and reasoning" on generated video. | [DOC] https://scispace.com/papers/artifact-bench-evaluating-mllms-on-detecting-and-assessing-9i616m1xn9dl |
| Pointwise (absolute) VLM scoring is limited by "stochastic inconsistency and poor alignment with human perception"; a pairwise protocol reached Spearman 0.86 with a human arena ranking. | [DOC] https://scispace.com/papers/genarena-how-can-we-achieve-human-aligned-evaluation-for-2a3pwi0cecqh |
| On long-video pairwise judgement, humans scored 84.7%–96.8% and automatic systems fell short in 9 of 10 aspects. | [DOC] [C-3] |
| A video-language judge benchmark reports 75.4% pairwise accuracy. | [DOC] https://scispace.com/papers/playlisteval-can-video-language-judges-be-trusted-at-day-rtfvcfv0534i |
| Multimodal LLMs agreed with design-expert consensus in 65–69% of pairwise comparisons. | [DOC] https://scispace.com/papers/can-multimodal-large-language-models-evaluate-ai-generated-9u8b93tsh2pc |
| LLM-judge biases (position, verbosity, judge severity, self-enhancement) are systematic errors "that no volume of additional data can eliminate". | [DOC] https://scispace.com/papers/accounting-for-bias-enables-sustainable-llm-evaluation-z37irxtyzngu |
| Reporting guidance for judge-human agreement, and the effect of human uncertainty on such correlations. | [DOC] https://scispace.com/papers/agreement-metrics-for-llm-as-judge-evaluation-what-to-report-2c3huyyw6ln8 ; https://scispace.com/papers/beyond-correlation-the-impact-of-human-uncertainty-in-732bkgz0c9fy |
| Further judge frameworks: MLLM-as-a-Judge, Q-Bench-Video, K-Sort Eval, RAVEN-Eval, VideoArgus, AIGVE-MACS, JudgeFit, VideoHallu. | [DOC] https://scispace.com/papers/mllm-as-a-judge-assessing-multimodal-llm-as-a-judge-with-43nozs8wip ; https://scispace.com/papers/q-bench-video-benchmarking-the-video-quality-understanding-2uk57jt7guaa ; https://scispace.com/papers/k-sort-eval-efficient-preference-evaluation-for-visual-451dm64y9u9y ; https://scispace.com/papers/raven-eval-rubric-guided-automatic-evaluation-for-ai-video-geh3cfmnpt3d ; https://scispace.com/papers/videoargus-agentic-rubric-grounded-unified-evaluation-for-mux8w5hzvudx ; https://scispace.com/papers/aigve-macs-unified-multi-aspect-commenting-and-scoring-model-uln0gw7k7hrf ; https://scispace.com/papers/each-judge-its-own-yardstick-discovering-per-vlm-taxonomies-5lsw8d4g5wtg ; https://scispace.com/papers/videohallu-evaluating-and-mitigating-multi-modal-qc3cj4q1hvgb |

Reading: a VLM judge is at best a 65–86% proxy for people in pairwise mode and worse in absolute-score mode, and it is blind to exactly the artifact classes a professional reviewer catches. It also normally means sending frames to a hosted model, which conflicts with privacy-first defaults unless a local VLM is used. Use it for triage and regression alarms, never as an acceptance gate. [ASSUMED]

#### 7.1.4 Arena leaderboards

**Artificial Analysis Video Arena methodology** (all [DOC] https://artificialanalysis.ai/methodology/video unless tagged otherwise):

- Blind pairwise: "Evaluators watch two videos generated from the same prompt"; a vote is accepted only after each video "has played for at least 8 seconds".
- About one matchup in five per session is a consensus quality check; failing sessions are rejected and their votes removed.
- Public votes cast in the Artificial Analysis Video Arena "do not count toward any video benchmark".
- All votes are fitted at once with a Bradley-Terry model and reported "on an Elo scale", anchored on "Kling 3.0 1080p (Pro) = 1000"; ratings are recomputed hourly; each benchmark has its own pool.
- Confidence intervals "treat each vote as independent", which the page itself notes can understate uncertainty when votes share an evaluator or prompt.
- Text-to-video and image-to-video v2.1 use 1,000 prompts each (500 for the silent versions); editing v1.1 uses 145 source clips with audio. A human reviews every prompt, and prompts are retired when they stop separating models.
- Standardised conditions: 1080p or closest, 24 fps, 10 seconds, 16:9; "Videos are never upscaled"; H.264 with peaks capped at 10 Mbps; loudness normalised "toward -18 LUFS with a single fixed gain"; "silent and audio-enabled outputs are not compared directly".
- Stated limitations: some editing models decline part of the prompt set and are rated only on the prompts they completed; when a model moves to a new arena host, votes on its earlier outputs "stop counting".
- The arena interface itself tells voters "Sound on. You're judging the sound too. Use headphones in a quiet space." [DOC] https://artificialanalysis.ai/video/arena

**Arena (formerly LMArena) text-to-video leaderboard**, updated 8 Nov 2026: 891,840 votes over 50 models; top entries Gemini Omni 1.2 Flash (preliminary) 1540 ±16, Gemini Omni 1.1 Flash 1513 ±15, gemini-omni-flash 1509 ±8, FLUX 3 Video (preliminary) 1491 ±17, Grok Imagine Video 1.5 (preliminary) 1488 ±19, Seedance 2.0 720p 1483 ±8, Seedance 2.5 720p 1479 ±8, Wan 3.0 1476 ±12, SkyReels V4 1459 ±18, Muse Video 1457 ±15; intervals by bootstrapping. [IND] https://arena.ai/leaderboard/text-to-video (fetched)

What the arenas can and cannot tell a tool builder:

- The two arenas disagree on the leader (Artificial Analysis: Wan 3.0; Arena: Gemini Omni Flash), and positions 4 to 10 on Arena have overlapping intervals. Leaderboard rank is not a stable basis for choosing a default provider. [ASSUMED] (comparison of the two fetched pages)
- Research on text arenas found that dropping as little as 0.02% of votes can change the top Bradley–Terry ranking, and that expert-annotated, carefully prompted sets are more robust. [DOC] https://scispace.com/papers/dropping-just-a-handful-of-preferences-can-change-top-large-fx5y5tcp72rq
- A 2026 analysis reports that nearly two thirds of decisive votes cancel out and that top-ranked models are statistically hard to separate in a single global ranking. [DOC] https://scispace.com/papers/why-global-llm-leaderboards-are-misleading-small-portfolios-yns73dqhcj85
- Elo-style ratings are sensitive to match order and hyperparameters. [DOC] https://scispace.com/papers/elo-uncovered-robustness-and-best-practices-in-language-52a0wjotox
- Arenas "require an excessive number of comparisons" and are "vulnerable to preference noise". [DOC] https://scispace.com/papers/k-sort-arena-efficient-and-reliable-benchmarking-for-1ug8pp3cqmbj
- Arenas compare **single-shot model outputs under default settings**. They say nothing about a production tool's reference handling, revision loop, edit precision, licensing or local hardware behaviour. [ASSUMED]
- Their methodology is still the best public template for a small blind test: same prompt, forced minimum viewing time, catch trials, fixed encoding and loudness, no upscaling, audio and silent pools kept apart. [ASSUMED]

### 7.2 Human evaluation methodology for comparing two production tools

#### 7.2.1 Pairwise forced choice versus rating scales

| Finding | Evidence |
|---|---|
| Across four subjective methods, forced-choice pairwise comparison gave "the smallest measurement variance" and so the most accurate results; it was also the most time-efficient for a moderate number of compared conditions. | [DOC] [C-20] |
| "Pair Comparison (PC) is of significant advantage over ACR in terms of discriminability"; it "avoids the influence of observers' bias regarding their understanding of the quality scale"; full pair comparison is "much more time-consuming". | [DOC] [C-11] |
| A 2026 broadcast-engineering benchmark confirms "the superior discriminability of the pairwise comparison tests over the rating-based methods". | [DOC] [C-12] |
| Full pairwise cost "grows with square of the number of samples", which motivates partial, random or adaptive pair selection (HodgeRank on random partial pairs; active sampling; adaptive paired comparison; design guidance). | [DOC] [C-15] ; [C-18] ; [C-16] ; [C-13] ; [C-14] |
| Among rating methods, ACR with hidden reference gave better discriminability than a modified DCR on the 11-grade scale of ITU-R BT.500-15 while halving experimental effort. | [DOC] [C-17] |
| Crowdsourced paired comparison converted to quality scores correlated above 0.96 with laboratory ACR mean opinion scores. | [DOC] [C-19] |
| With eight expert annotators, score-derived rankings "align poorly with the same annotators' direct comparisons", while direct ranking gave substantially higher agreement between annotators. | [DOC] https://scispace.com/papers/visual-aesthetic-benchmark-can-frontier-models-judge-beauty-dw400riayikl |

Consequence for two tools: there is exactly one pair, so the quadratic cost of pairwise testing never arises and every argument above favours two-alternative forced choice (2AFC) over mean opinion scores. Use MOS-style ratings only as secondary, descriptive data. [ASSUMED]

#### 7.2.2 Standards (ITU-T P.910, ITU-R BT.500)

- The current ITU-T P.910 is the **07/26 edition**, "Subjective video quality assessment methods for multimedia applications", status "In force (prepublished)", superseding 10/23 and earlier editions. [DOC] https://www.itu.int/rec/T-REC-P.910
- The full text was not fetched, so its viewing-condition requirements, method definitions (ACR, ACR-HR, DCR, PC) and recommended subject numbers are not quoted here. [UNKNOWN]
- ITU-R BT.500 was not fetched; the only detail captured is that BT.500-15 defines an 11-grade scale used in the study above. [DOC] [C-17]
- These standards were written for codec and transmission quality with naive viewers and controlled displays. For a tool comparison they are a source of procedure (training sequences, randomisation, screening of outlier subjects, fixed viewing conditions), not of pass thresholds. Cite the edition used and state every deviation. [ASSUMED]

#### 7.2.3 Protocols designed for generated video

- T2VHE proposes a standardised human evaluation protocol for text-to-video with defined metrics, annotator training and a dynamic evaluation module that "can also reduce evaluation costs by nearly 50%". [DOC] [C-1]
- A survey of 37 text-to-image papers found human evaluation often unreported or unverifiable and proposes a reproducible protocol. [DOC] https://scispace.com/papers/toward-verifiable-and-reproducible-human-evaluation-for-text-2ri6ot0v
- Large human-labelled sets exist for calibration (HVEval+ with 60k mean-opinion scores and 60k preference pairs; CVBench with 600K pairwise comparisons). [DOC] [C-7] ; [C-10]

#### 7.2.4 Rater count, power and agreement

- Whether more ratings per item or more items is the better use of a fixed budget, and how many judgements are enough, are studied directly in recent work. [DOC] https://scispace.com/papers/how-many-ratings-per-item-are-necessary-for-reliable-5tjqhlbwy2lj ; https://scispace.com/papers/how-many-human-judgments-are-enough-feasibility-limits-of-4xw8x4un0if4 ; https://scispace.com/papers/how-many-repeated-pairwise-comparisons-are-needed-for-lkzlwutmevyk
- Thresholds on Krippendorff's alpha or kappa (commonly 0.6 after Landis and Koch) "are unreasonable for crowdsourced data ... especially on subjective topics"; cross-replication reliability is proposed instead. [DOC] https://scispace.com/papers/cross-replication-reliability-an-empirical-approach-to-1d8kr8e9pe
- With only three expert evaluators, simulation shows that the usual rule-of-thumb cutoffs are too permissive: required thresholds were "far less permissive than the typically accepted 'rule of thumb' cutoff for Krippendorff's alpha". [DOC] https://scispace.com/papers/reliability-in-evaluator-based-tests-using-simulation-3qk2upj267
- Agreement and correlation answer different questions, and the choice of coefficient matters. [DOC] https://scispace.com/papers/agreement-is-overrated-a-plea-for-correlation-to-assess-5g2s07j9qv ; https://scispace.com/papers/counting-on-consensus-selecting-the-right-inter-annotator-4srjzb2znm0t ; https://scispace.com/papers/liberal-conservative-hierarchies-of-intercoder-reliability-7ne5y0lkzrh5
- A concept-preservation metric paper reports human Krippendorff alpha of 0.471 on its task, which illustrates how low agreement on visual-consistency judgements can be even in published work. [DOC] https://scispace.com/papers/masc-a-masked-similarity-metric-for-evaluating-concept-gj9bndeunhcc
- Kendall's W (concordance of rankings across raters) was not researched in a dedicated source; it applies when raters rank three or more conditions, not to a two-tool 2AFC. [ASSUMED]

Power for a two-tool forced-choice test, exact two-sided sign test at alpha = 0.05, ties excluded, independent trials (my own calculation, run for this report): [ASSUMED]

| True preference for the better tool | Trials needed for 80% power | Wins needed at that size |
|---|---|---|
| 60 / 40 | 210 | 120 |
| 65 / 35 | 97 | 59 |
| 70 / 30 | 54 | 35 |
| 75 / 25 | 35 | 24 |
| 80 / 20 | 23 | 17 |

| Independent trials run | Wins needed to call a winner (two-sided p ≤ 0.05) | As a share |
|---|---|---|
| 12 | 10 | 83% |
| 20 | 15 | 75% |
| 24 | 18 | 75% |
| 30 | 21 | 70% |
| 36 | 25 | 69% |
| 40 | 27 | 68% |
| 48 | 32 | 67% |
| 60 | 39 | 65% |
| 100 | 61 | 61% |

Illustrative 95% Wilson intervals: 20 of 30 gives 49%–81%; 26 of 40 gives 50%–78%; 38 of 60 gives 51%–74%; 60 of 100 gives 50%–69%. [ASSUMED]

Two cautions on these numbers. First, judgements from the same rater or on the same task are correlated, so "trials" must be the independent unit: analyse at the **task level** (majority of raters per task) or use a bootstrap that resamples tasks and raters, exactly the weakness Artificial Analysis admits for its own intervals. Second, a small study can show that one tool is better; it cannot show two tools are equivalent. [ASSUMED]

#### 7.2.5 Bradley–Terry and Elo

- Artificial Analysis fits a Bradley–Terry model to all votes and reports it on an Elo scale. [DOC] https://artificialanalysis.ai/methodology/video
- Bayesian Bradley–Terry variants and uncertainty-aware ranking are available when there are many items and sparse comparisons. [DOC] https://scispace.com/papers/efficient-bayesian-inference-from-noisy-pairwise-comparisons-k8r39pkw0mqj ; https://scispace.com/papers/confidence-and-stability-of-global-and-pairwise-scores-in-re4lkf6psg7l
- An Arabic-language arena reports Bradley–Terry scores with bootstrap confidence intervals, a precedent for language-specific preference testing. [DOC] https://scispace.com/papers/haakkim-an-arena-style-platform-for-human-preference-mvdzm021wgeo
- With only two tools, a Bradley–Terry fit carries no more information than the win proportion and its confidence interval; Elo adds an arbitrary scale and order sensitivity. Report win share with an exact or Wilson interval per dimension, and move to Bradley–Terry only if a third condition (for example "tool A with LoRA") is added. [ASSUMED]

#### 7.2.6 Pre-registration, version drift and seeds

- A re-run of published human evaluations found flaws "in every single experiment" examined; recommended remedies include "pre-registration, better code development practices, increased testing and piloting, and post-publication addressing of errors". [DOC] https://scispace.com/papers/common-flaws-in-running-human-evaluation-experiments-in-nlp-49liewpn9v
- Only about 13% of surveyed human evaluations had enough information to be reproduced. [DOC] https://scispace.com/papers/missing-information-unresponsive-authors-experimental-flaws-6swgscsm
- Reporting checklists for rigorous evaluation exist and can be adopted directly. [DOC] https://scispace.com/papers/recommendations-and-reporting-checklist-for-rigorous-0lo9zymw10xy ; https://scispace.com/papers/repairing-the-cracked-foundation-a-survey-of-obstacles-in-37m6529v
- Hosted models change without notice; Artificial Analysis discards earlier votes when a model moves host, which is an admission that outputs are not comparable across serving changes. [DOC] https://artificialanalysis.ai/methodology/video
- A 2026 identity audit reports results over two seeds with explicit noise floors rather than single samples. [DOC] https://scispace.com/papers/auditing-the-face-condition-port-in-diffusion-based-video-gntx74zyyr9a

#### 7.2.7 Task-based usability measures

| Measure | What the literature supports | Evidence |
|---|---|---|
| **Problem discovery sample size** | Random sets of 5 users found between 55% and 99% of problems; 10 users found at least 80%; 20 users at least 95%. | [DOC] https://scispace.com/papers/beyond-the-five-user-assumption-benefits-of-increased-sample-3e1tla6kvl |
| Group size depends on purpose | Evaluator quality and the number of evaluators affect usability studies "more than participant group size"; five users are enough to drive one iteration. | [DOC] https://scispace.com/papers/a-critique-of-how-to-specify-the-participant-group-size-for-4eyj1y9b2n |
| The five-user rule underestimates | Reported in later sample-size work. | [DOC] https://scispace.com/papers/estimating-sample-size-for-usability-testing-4dd11pwecg ; https://scispace.com/papers/why-and-when-five-test-users-aren-t-enough-359l4u9yms |
| **Task success** | A sample counts as small unless it has "more than 15 successes and 15 failures"; use mid-probability from the binomial distribution to test against a goal. | [DOC] https://scispace.com/papers/did-we-meet-or-exceed-our-goal-3o2nsd7i53 |
| Task success against a 95% criterion | One failure requires at least 19 other successful subjects to still meet the criterion. | [DOC] https://scispace.com/papers/testing-usability-goals-with-small-samples-a-binomial-2f19z0u95v |
| **Time on task** | Distributions are skewed; in Monte Carlo work the mean was more accurate than the median for small samples, with caveats. | [DOC] https://scispace.com/papers/the-effects-of-running-fewer-subjects-on-time-on-task-4yl077977l |
| Relative versus absolute performance | Absolute performance estimates were highly variable, while "estimates of the relative advantage of the fastest interface were less variable". | [DOC] https://scispace.com/papers/estimating-the-relative-usability-of-two-interfaces-3ah6wlbvhm |
| Competitive comparison | A rank-based method combines time, completion and ratings at scenario level for two-product comparisons. | [DOC] https://scispace.com/papers/a-rank-based-method-for-the-usability-comparison-of-4cozshu1pc |
| Small-N comparative precedents | 15 participants, within-subject, two platforms: task time, success, errors and SUS with paired tests. 18 participants, between-subjects: execution time, clicks, errors, questionnaire. | [DOC] https://scispace.com/papers/comparative-ux-evaluation-of-zillow-and-zigbang-platforms-a-x83z3fr6gm6m ; https://scispace.com/papers/improved-usability-of-a-multi-infusion-setup-using-a-2xhn63mf3v |
| Generative-media workflow precedent | 20 practitioners, 10 per condition, outputs scored by five expert raters. | [DOC] https://scispace.com/papers/a-structured-kano-ahp-framework-for-ai-assisted-generative-xtvcf8sitgs4 |
| **SUS** | Widely used 10-item scale with adjective anchors and item benchmarks; a commonly cited benchmark mean is 68 (SD 12.5). | [DOC] https://scispace.com/papers/an-empirical-evaluation-of-the-system-usability-scale-1n6xcx22d8 ; https://scispace.com/papers/determining-what-individual-sus-scores-mean-adding-an-251iu29hod ; https://scispace.com/papers/item-benchmarks-for-the-system-usability-scale-41hx2c0ytb ; https://scispace.com/papers/system-usability-scale-benchmarking-for-digital-health-apps-36u3o8vk |
| SUS at small samples | A comparison of five questionnaires analysed sample sizes from 6 to 14. The abstract retrieved was truncated, so no accuracy percentage is quoted here. | [DOC] https://scispace.com/papers/a-comparison-of-questionnaires-for-assessing-website-3fnjxmisnk |
| SUS and effectiveness | The relationship between SUS scores and task effectiveness has been studied directly; SUS is a perception measure and should sit beside, not replace, task success. The second clause is [ASSUMED]. | [DOC] https://scispace.com/papers/the-relationship-between-system-effectiveness-and-subjective-4iy2n2lifz |
| Shorter alternative | UMUX-LITE corresponds to SUS and takes two items. | [DOC] https://scispace.com/papers/investigating-the-correspondence-between-umux-lite-and-sus-4kblp1mfof |
| SUS translations | A multi-language SUS toolkit exists; an Arabic version was not confirmed. | [DOC] https://scispace.com/papers/multi-language-toolkit-for-the-system-usability-scale-19dvvh7r76 |
| **NASA-TLX** | Six subscales (mental, physical and temporal demand, performance, effort, frustration), rated during or immediately after a task; weighted or unweighted scoring. | [DOC] https://scispace.com/papers/nasa-task-load-index-nasa-tlx-20-years-later-4zos9jgvch ; https://scispace.com/papers/nasa-tlx-software-for-assessing-subjective-mental-workload-3z85zguggx |
| Raw (unweighted) TLX | No differences were found between weighted and unweighted scoring; Raw TLX has been validated as reliable. | [DOC] https://scispace.com/papers/a-comparison-of-two-scoring-procedures-with-the-nasa-task-1hlbnttw81 ; https://scispace.com/papers/validation-of-the-raw-national-aeronautics-and-space-1abv4mdyci |
| TLX interpretation | Reference values exist from meta-analyses (over 1,000 global scores from more than 200 publications; 556 studies). Report each subscale, not only the global score. | [DOC] https://scispace.com/papers/how-high-is-high-a-meta-analysis-of-nasa-tlx-global-workload-3k963yykej ; https://scispace.com/papers/reference-values-and-subscale-patterns-for-the-task-load-16635c2d3a ; https://scispace.com/papers/measuring-mental-workload-with-the-nasa-tlx-needs-to-examine-i58tnr0llj |
| TLX caveats | The TLX "lacks scalar invariance", which can bias mean comparisons; a computer-administered version imposed more workload than paper. | [DOC] https://scispace.com/papers/measurement-invariance-of-the-nasa-tlx-5eef7y21hl ; https://scispace.com/papers/a-self-analysis-of-the-nasa-tlx-workload-measure-44exd268hl |

#### 7.2.8 Professional reviewer panels

- Experts and non-experts judge video quality differently; experts scrutinise localised artifacts. [DOC] https://scispace.com/papers/integrating-where-and-how-for-expertise-aware-8k-video-zbj9wxkcgy2s ; https://scispace.com/papers/a-comparison-of-non-experts-and-experts-using-dsis-method-t2ege9rl
- Published precedents use very small expert panels (three, five and eight experts in the studies cited in 7.2.1, 7.2.4 and 7.2.7), so a handful of volunteer professionals is within published practice provided the item count carries the statistical weight. [ASSUMED]
- Crowd evaluation of open-ended generation has documented quality problems, which removes most of the appeal of cheap crowd raters for this purpose. [DOC] https://scispace.com/papers/the-perils-of-using-mechanical-turk-to-evaluate-open-ended-2myit9yb36

### 7.3 Benchmarks that evaluate end-to-end production workflows

#### 7.3.1 Multi-shot and story video

| Benchmark | What it measures | Evidence |
|---|---|---|
| **MSVBench** (2026) | Multi-shot video with human-level evaluation aims; reports 94.4% Spearman agreement with humans and concludes that "current models primarily behave as visual interpolators". | [DOC] https://scispace.com/papers/msvbench-towards-human-level-evaluation-of-multi-shot-video-dckboms5utww |
| **EntityBench** (2026) | 140 episodes, 2,491 shots, with **per-shot entity schedules** (which characters and objects must appear in which shot) for long-range entity consistency. | [DOC] https://scispace.com/papers/entitybench-towards-entity-consistent-long-range-multi-shot-cgludki2q1o3 |
| **PersonaShot** (2026) | Person-centric narrative continuity. | [DOC] https://scispace.com/papers/personashot-benchmarking-person-centric-narrative-continuity-re1pant056px |
| **ViStoryBench** | Story visualisation suite across methods and styles. | [DOC] https://scispace.com/papers/vistorybench-comprehensive-benchmark-suite-for-story-kqyo18vj4a45 |
| **MovieBench** | Hierarchical movie-level dataset for long video generation. | [DOC] https://scispace.com/papers/moviebench-a-hierarchical-movie-level-dataset-for-long-video-567k2wotrf4a |
| **MuSS** (2026) | Cinematic narrative benchmark; names the "copy-paste" dilemma for subject consistency. | [DOC] https://scispace.com/papers/muss-a-large-scale-dataset-and-cinematic-narrative-benchmark-wpxougfma4go |
| **NarrativeBench (NARIA)**, **MSG score** | Narrative alignment across scenes; multi-scene generation score. | [DOC] https://scispace.com/papers/naria-information-theoretic-narrative-alignment-via-scene-7kf924c5ifz4 ; https://scispace.com/papers/msg-score-a-comprehensive-evaluation-for-multi-scene-video-2279d808a0al |
| **DynSC-Eval** (2026) | Subject consistency when the set of subjects changes from shot to shot. | [DOC] https://scispace.com/papers/towards-subject-consistency-over-dynamic-subject-sets-in-4m707zzv4eex |

#### 7.3.2 Instruction-based video editing: how locality and preservation are measured

| Benchmark | Relevant design point | Evidence |
|---|---|---|
| **OmniEdit-Bench** (2026) | Existing metrics "fail to measure instruction fidelity", so incorrect edits can score highly because of strong visual priors from the original video. An unchanged output can score well. | [DOC] https://scispace.com/papers/omniedit-bench-a-comprehensive-benchmark-for-instruction-kiuk143pqudg |
| **CoVEBench** (2026) | 416 source videos with complex instructions; failure classes are omitted edits, violated preservation constraints and introduced artifacts. | [DOC] https://scispace.com/papers/covebench-can-video-editing-models-handle-complex-p9pu32aauhzj |
| **ViTeX-Bench** | Scene-text editing with explicit **edit locality** scoring. | [DOC] https://scispace.com/papers/vitex-bench-benchmarking-high-fidelity-video-scene-text-vtriybkj9nuy |
| **PRIMEdit** (TPAMI 2026) | Multi-instance editing; names "editing leakage" into non-target instances. | [DOC] https://scispace.com/papers/primedit-probability-redistribution-for-instance-aware-multi-t0ifbore26g8 |
| **IVEBench**, **VEFX-Bench**, **V2V-Bench** | Instruction-guided editing suites; V2V-Bench reports rho = 0.905 with human judgement. | [DOC] https://scispace.com/papers/ivebench-modern-benchmark-suite-for-instruction-guided-video-ebyegvk3a9mp ; https://scispace.com/papers/vefx-bench-a-holistic-benchmark-for-generic-video-editing-aee8b6mliaqp ; https://scispace.com/papers/v2v-bench-a-comprehensive-benchmark-for-video-to-video-qpn0yzpbfd5b |
| **AVE-Compass** | Audio-video editing: 145 videos, 196 instructions, **2,688 checklist items**. | [DOC] https://scispace.com/papers/ave-compass-towards-holistic-evaluation-for-audio-video-kskgt4e1gz6l |
| **EditEval / EditScore**, **UniEditBench**, **MMLVE-Bench** (multi-shot editing), **PVIR** (instance removal), **EditBench3D** | Further editing benchmarks. | [DOC] https://scispace.com/papers/editeval-towards-comprehensive-and-automatic-evaluation-for-tmtk01ec17mw ; https://scispace.com/papers/unieditbench-a-unified-and-cost-effective-benchmark-for-vxqfkkhkhwni ; https://scispace.com/papers/thinking-on-shots-consistent-multi-shot-video-editing-with-74mfbvs44xba ; https://scispace.com/papers/physics-aware-video-instance-removal-benchmark-zje3kqel5t43 ; https://scispace.com/papers/what-makes-a-3d-scene-editable-a-factorized-benchmark-of-ecjy78ogh5am |
| Artificial Analysis editing arena | Human pairwise votes on 145 source clips; models that refuse prompts are rated only on what they completed. | [DOC] https://artificialanalysis.ai/methodology/video |

The common pattern is a **two-axis score**: (1) did the requested change happen (instruction fidelity), and (2) did everything else stay the same (preservation, locality, no leakage), with artifacts as a third check. A single similarity-to-source number rewards doing nothing; a single text-alignment number rewards redrawing everything. [ASSUMED]

#### 7.3.3 What is missing

- **No benchmark was found that measures revision cost** (attempts, time or money needed to reach an accepted result) or a full brief-to-delivery workflow across tools. [UNKNOWN]
- The closest precedent is the practitioner workflow study with expert-rated outputs cited in 7.2.7. [ASSUMED]
- This gap means a platform that measures revision cost on a fixed task set would be producing evidence that public benchmarks do not offer. [ASSUMED]

### 7.4 Recommendations for a small team with a handful of volunteer professional raters

Everything in 7.4 is a recommendation and therefore [ASSUMED]; the bracketed pointers name the evidence each item rests on.

#### 7.4.1 Principles

1. **Compare tools, not models.** The unit is "a competent operator using tool X under a fixed budget produces deliverable Y from brief Z". (Arenas already cover single-shot model output, 7.1.4.)
2. **People decide, metrics alarm.** Human forced choice is the only acceptance evidence; automatic metrics and VLM judges are regression alarms. (7.1.1 to 7.1.3)
3. **Spend the scarce resource, rater minutes, on many tasks rather than many raters per task.** Tasks are the independent unit that gives power. (7.2.4)
4. **Write the rules before generating anything.** (7.2.6)

#### 7.4.2 Study 1 — blind output comparison (two-alternative forced choice)

| Element | Recommendation | Rests on |
|---|---|---|
| Task set | **36 briefs minimum** (one tool must win 25 to be called better); **54** if a 70/30 preference should be detectable with 80% power. Stratify evenly, for example six families of six: single-shot text-to-video; image-to-video from an approved character reference; product shot with logo and geometry to preserve; three-shot dialogue scene with lip sync; targeted edit of an existing shot; five-shot continuity sequence. Include Arabic-language dialogue and captions in the dialogue family. | Power table in 7.2.4; stratified sampling in the Artificial Analysis methodology |
| Production budget | Same operator skill level on both tools; fixed cap per task per tool on wall-clock time and number of generations; operators alternate which tool they use first. Log every attempt. The operator picks one final deliverable per task per tool before any rating happens. | 7.3.3 (revision cost is otherwise unmeasured) |
| Version and seed control | Record model name, version string, provider, date, seed, sampler settings and every reference asset for each attempt. Complete all generations inside one short window (for example 14 days). Re-run three sentinel prompts on the first and last day; if a hosted model's outputs have visibly changed, discard and repeat that tool's affected tasks. Where seeds are controllable, generate with at least two seeds and let the operator choose, recording the choice. | 7.2.6 |
| Stimulus preparation | Same resolution, frame rate, container, codec and bitrate cap for both tools; no extra upscaling; loudness normalised to one target (the arena uses -18 LUFS); clips with and without audio judged in separate blocks; strip metadata and watermarks that reveal the tool where licence terms allow, otherwise mask identically on both. | Artificial Analysis methodology |
| Presentation | Randomise left/right per trial and per rater; randomise task order per rater; show the brief and, for consistency questions, the approved reference; voting unlocked only after both clips have fully played (the arena uses 8 seconds); replays allowed; headphones and the rater's own grading or editing display; no time limit. | Artificial Analysis methodology |
| Questions per pair | Strict forced choice, asked separately: (1) Which would you deliver to the client? (primary) (2) Which follows the brief more closely? (3) Which preserves the reference identity, wardrobe or product better? (4) Which has fewer motion and temporal artifacts? (5) Which has better audio and lip sync? (only where present). One optional free-text line for the reason. | 7.2.1 (forced choice beats ratings; direct comparison beats score-derived ranking) |
| Editing tasks | Two-axis scoring in addition to the forced choice: per tool, "requested change achieved: yes / partly / no", then "which preserved everything else better". Add a short checklist per task (for example "logo unchanged", "background actor unchanged", "line now says X"). | 7.3.2 |
| Quality control | About one trial in five is a check: identical pairs, pairs with one clip deliberately degraded, and repeats of earlier pairs with sides swapped. Pre-define the exclusion rule (for example, a rater who fails more than 25% of degraded-pair checks is excluded) and report intra-rater consistency on the swapped repeats. | Artificial Analysis methodology |
| Raters | Five to seven volunteer professionals from different crafts (editor, cinematographer or colourist, animator, sound, producer). Fifteen minutes of training on example pairs that are not in the test. Every rater judges every task. At roughly one minute per pair, 36 tasks plus checks is about 45–60 minutes per rater; split into two sittings. Raters must not have operated either tool for the study. | 7.2.3, 7.2.8 |
| Primary analysis | Per task, the winner on question 1 is the tool preferred by the majority of raters (use an odd number of raters). Exact two-sided sign test over tasks. Pre-registered decision rule, for example: "Tool A is better if it wins at least 25 of 36 tasks; otherwise no difference is demonstrated." Report the win share with a Wilson interval. | 7.2.4 |
| Secondary analysis | Per-question win shares with a bootstrap that resamples tasks and raters together; per-family breakdowns as descriptive only (six tasks per family cannot support a test); Krippendorff's alpha (nominal) with a bootstrap interval, reported without a pass threshold; rater-by-rater win shares to show whether one rater drives the result. | 7.2.4, 7.2.5 |
| What not to do | No Elo or Bradley–Terry for two tools; no pooled "all votes are independent" interval; no post-hoc choice of the winning dimension; no claim of equivalence. | 7.2.4, 7.2.5 |

#### 7.4.3 Study 2 — task-based usability (within-subject)

| Element | Recommendation | Rests on |
|---|---|---|
| Design | Every participant uses both tools; order counterbalanced (half start with each); matched but not identical task variants per tool to limit learning effects. | Small-N comparative precedents, 7.2.7 |
| Participants | The same handful of professionals are enough for problem discovery; add participants up to 12–16 if a quantitative claim is wanted. | Sample-size literature, 7.2.7 |
| Tasks | Three or four realistic jobs: build a three-shot scene with a consistent character from a written brief; apply one client revision to one shot without changing the others; change one line of dialogue and re-sync; export with captions and a licence/provenance report. | 7.3.3 |
| Measures | Task success against a written acceptance checklist, judged afterwards by a reviewer who does not know which tool was used; time on task; **generations-to-accept**; compute seconds and any hosted spend; assists and errors; SUS (or UMUX-LITE) per tool; Raw NASA-TLX per tool with all six subscales reported. | 7.2.7 |
| Analysis | Paired differences per participant, shown individually. Time as a ratio (tool A / tool B) per participant with the geometric mean, because times are skewed and relative advantage is more stable than absolute time. Completion rates with small-sample binomial intervals. | Cordes; Nielsen and Phillips; Sauro and Lewis (7.2.7) |
| Honest limits | With five participants, even a unanimous direction gives an exact two-sided sign-test p of 0.0625; six unanimous gives 0.031. Below that, present results as descriptive and as a list of usability problems found. Do not compare a SUS mean from five people against the 68 benchmark as if it were a test. | Own arithmetic; SUS and TLX caveats in 7.2.7 |

#### 7.4.4 Automatic checks as regression alarms

| Check | How | Caveat |
|---|---|---|
| General video quality | The six VBench dimensions available for custom videos. Always read motion smoothness together with dynamic degree so a frozen clip cannot pass. | Needs a CUDA environment the VBench README constrains; laptop feasibility unverified (7.1.1). |
| Identity and product consistency | Similarity on **masked subject crops** against the approved reference, never on whole frames. Establish a same-subject noise floor and an impostor band from known pairs first, and report scores relative to them. Flag suspiciously high similarity with low pose variation as possible copy-paste. | Global scores are background-confounded; face similarity falls with expression and angle; InsightFace-based face models are non-commercial (7.1.2). |
| Drift across chained clips | Distance in colour statistics and in identity embedding between each hop's first frame and the original anchor, plotted against hop number, with a pre-set stop threshold. | 6.6 |
| Edit locality | Difference maps outside the intended edit mask, plus the per-task checklist. | A do-nothing edit scores perfectly on preservation; pair with the fidelity axis (7.3.2). |
| Lip sync | A sync-confidence score can rank takes. | The usual SyncNet weights are trained on LRS2, the same dataset that makes Wav2Lip non-commercial; check before shipping one inside the product. |
| Captions | Word error rate and word-timing error against a small hand-corrected set in each target language, including Arabic. | Needs about an hour of hand-labelled audio per language. |
| VLM judge | Pairwise only, each pair in both orders, majority of repeated calls; a local VLM if frames must not leave the machine. Validate once against Study 1's human labels and publish the agreement rate. | 65–86% agreement with people at best; blind to many artifacts; biased by position (7.1.3). |

#### 7.4.5 A revision-cost measure (fills the gap in 7.3.3)

For every task and tool, log: number of generations until the operator accepted; wall-clock time; local compute seconds; hosted spend; and, for each revision, whether the targeted fix changed anything outside its scope ("collateral change"). Report the median generations-to-accept, the share of tasks abandoned at the cap, and the collateral-change rate. These come free from Study 1's production logs.

#### 7.4.6 Pre-registration and reporting checklist

Before generating: a dated protocol file committed to version control, containing the task list, budget rule, primary outcome, decision thresholds, exclusion rules, analysis script and the pilot plan (a pilot of about four tasks and two raters whose data are discarded). After: publish model versions and dates, seeds, attempt logs, the raw vote table, exclusions with reasons, agreement statistics with intervals, every deviation from the protocol, and the ITU edition referenced for viewing procedure if one is cited. (7.2.2, 7.2.6)

---

## 8. Licence red-flag list

| # | Item | Red flag | Evidence |
|---|---|---|---|
| 1 | **InsightFace model packs** (`buffalo_l`, `antelopev2`, `inswapper`) | Models "for non-commercial research purposes only" even though the code is MIT; pulled in automatically by many projects. | [DOC] https://github.com/deepinsight/insightface |
| 2 | Projects that depend on InsightFace | LivePortrait (says so in its LICENSE), Stand-In (downloads `antelopev2`), InstantID, InfiniteYou, LatentSync (landmarks). | [DOC] https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE ; https://github.com/WeChatCV/Stand-In ; https://github.com/instantX-research/InstantID ; https://github.com/bytedance/InfiniteYou ; https://github.com/bytedance/LatentSync |
| 3 | **Tencent Hunyuan Community License** (HunyuanVideo-Avatar; tag also on HunyuanVideo-Foley) | Does not apply in the EU, UK or South Korea; separate licence above 100M monthly active users; outputs may not train other models. | [DOC] https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar/blob/main/LICENSE ; https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley |
| 4 | HunyuanCustom and FramePack's HunyuanVideo-derived weights | Probably the same Tencent terms; not verified. | [ASSUMED] |
| 5 | **MiniMax H3 open weights** | Reported custom licence excluding the US, EU, UK and South Korea. | [IND] https://www.atlascloud.ai/blog/tips/minimax-h3-open-source-weights |
| 6 | **Wav2Lip** | Commercial use "strictly prohibited" (LRS2). | [DOC] https://github.com/Rudrabha/Wav2Lip |
| 7 | **F5-TTS** weights | CC-BY-NC (Emilia data); code is MIT, which misleads. | [DOC] https://github.com/SWivid/F5-TTS |
| 8 | **XTTS-v2** | Coqui Public Model License; commercial licensing path uncertain. | [DOC] https://huggingface.co/coqui/XTTS-v2 |
| 9 | **Higgs Audio v3** | Research and non-commercial licence; repository sidebar still shows Apache-2.0. | [DOC] https://github.com/boson-ai/higgs-audio |
| 10 | **Fish Speech / OpenAudio** | Revenue cap USD 500k; no hosted-service right; attribution; S2-Pro research licence. | [DOC] https://github.com/fishaudio/fish-speech/blob/main/LICENSE |
| 11 | **IndexTTS** | bilibili Model Use License; commercial terms by enquiry. | [DOC] https://github.com/index-tts/index-tts |
| 12 | **Habibi-TTS** | Unified, SAU and UAE checkpoints CC-BY-NC-SA; only some dialect checkpoints Apache-2.0. | [IND] https://github.com/SWivid/Habibi-TTS |
| 13 | **Piper** | GPL-3.0: bundling into a non-GPL product needs process isolation and legal review; per-voice licences vary. The bundling consequence is [ASSUMED]. | [DOC] https://github.com/OHF-Voice/piper1-gpl |
| 14 | **VibeVoice** | Research-only intent; TTS code withdrawn. | [DOC] https://github.com/microsoft/VibeVoice |
| 15 | **MusicGen** weights | CC-BY-NC 4.0. | [DOC] https://github.com/facebookresearch/audiocraft |
| 16 | **YuE / YuE2** weights | CC BY-NC 4.0 with additional creator permission. | [DOC] https://github.com/multimodal-art-projection/YuE |
| 17 | **MMAudio** checkpoints | CC-BY-NC 4.0. | [DOC] https://github.com/hkchengrex/MMAudio |
| 18 | **ThinkSound** | Self-contradictory: Apache-2.0 header and "Commercial use is NOT permitted". | [DOC] https://github.com/FunAudioLLM/ThinkSound |
| 19 | **Stable Audio Open** | Stability AI Community License (revenue threshold applies). | [DOC] https://huggingface.co/stabilityai/stable-audio-open-1.0 |
| 20 | **Demucs weights** | Trained on MUSDB; licence status disputed. | [IND] https://huggingface.co/adefossez/HTDemucs/discussions/1 |
| 21 | **Suno / Udio outputs** | Active litigation (Suno), disabled downloads (Udio), unofficial API wrappers. | [IND] https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/ ; https://dynamoi.com/learn/ai-music-distribution/is-udio-music-still-downloadable |
| 22 | **LatentSync** weights | openrail++ use restrictions on the Hugging Face weights despite Apache-2.0 code. | [DOC] https://huggingface.co/ByteDance/LatentSync-1.6 |
| 23 | **Hallo2** super-resolution stage; **GIMM-VFI** | S-Lab License 1.0 (non-commercial). | [DOC] https://github.com/fudan-generative-vision/hallo2 ; https://github.com/GSeanCDAT/GIMM-VFI/blob/main/LICENSE |
| 24 | **Hallo3**; **STAR** (CogVideoX variant) | Bound by the CogVideoX-5B licence. | [DOC] https://github.com/fudan-generative-vision/hallo3 ; https://github.com/NJU-PCALab/STAR |
| 25 | **SUPIR** | Non-commercial; written permission needed. | [DOC] https://github.com/Fanghua-Yu/SUPIR |
| 26 | **Topaz Personal plans** | Commercial use only for organisations under USD 1M annual revenue. | [DOC] https://www.topazlabs.com/pricing |
| 27 | **HoloCine** | CC BY-NC-SA 4.0, academic research only. | [DOC] https://github.com/yihao-meng/HoloCine |
| 28 | **FLUX.1 [dev] family** (Kontext dev, and adapters built on FLUX.1-dev: PuLID-FLUX, USO, DreamO, InfiniteYou) | Non-commercial model licence with filter obligations; outputs usable commercially per the card. Applicability to the adapters is [ASSUMED]. | [DOC] https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev |
| 29 | **InfiniteYou** model; **InstantID** checkpoints | CC BY-NC 4.0 academic only; research purposes only. | [DOC] https://github.com/bytedance/InfiniteYou ; https://github.com/instantX-research/InstantID |
| 30 | **LTX-2.5** | Community licence: free commercial use only under USD 10M revenue. | [DOC] https://huggingface.co/Lightricks/LTX-2.5 |
| 31 | **FLUX 3 Image Klein** | Reported revenue cap of USD 5M; unverified. | [IND] https://www.digitalapplied.com/blog/flux-3-image-klein-open-weights-8gb-gpu |
| 32 | **IC-Light** demo | Uses BRIA RMBG 1.4, non-commercial; replace the matting model. | [DOC] https://github.com/lllyasviel/IC-Light |
| 33 | **WhisperX diarization** | pyannote models need a Hugging Face token and acceptance of terms. | [DOC] https://github.com/m-bain/whisperX |
| 34 | **MuseTalk** third-party components | whisper, ft-mse-vae, dwpose and S3FD keep their own licences. | [DOC] https://github.com/TMElyralab/MuseTalk |
| 35 | **LoRAs and fine-tunes** | Inherit the base model's licence, not the trainer's. | [ASSUMED] |
| 36 | **Unverified licences** | SkyReels-A2, Lynx weights, HunyuanCustom, IP-Adapter-FaceID, T2V-CompBench, Sony Woosh, PrismAudio, OmniVoice. | [UNKNOWN] |
| 37 | **Evaluation tooling** | ArcFace/InsightFace-based identity metrics and LRS2-trained sync scorers carry the same non-commercial terms when built into a product. | [ASSUMED] |

Registry fields this implies for every model entry: code licence; weights licence; base-model licence; bundled-dependency licences; revenue cap; territorial exclusions; hosted-service right; output-use restrictions; watermark behaviour; maintenance status; source URL; date verified. [ASSUMED]

---

## 9. "Feasible on 8–12 GB / CPU-only" shortlist per category

Tiers: **CPU** = usable without a discrete GPU; **8 GB** and **12 GB** = documented or reported at that VRAM. "Clean" = permissive for commercial use with no hidden non-commercial dependency found. The whole table is a synthesis of the evidence in sections 3–6. [ASSUMED]

| Category | CPU-only | 8 GB | 12 GB | Excluded despite fitting, and why |
|---|---|---|---|---|
| **TTS (English and major languages)** | Kokoro-82M (Apache-2.0, no cloning); Chatterbox Nano (MIT, retired); Pocket TTS (MIT code, search-level); Piper (GPL-3.0) | Dia 1.6B (Apache-2.0, 4.4 GB); CosyVoice 3 (Apache-2.0); Chatterbox Turbo / Multilingual (MIT, retired) | Same | F5-TTS, XTTS-v2, Higgs v3 (non-commercial); Fish (revenue cap, no hosting); IndexTTS (custom) |
| **TTS / cloning in Arabic** | None confirmed | Chatterbox Multilingual V3 (MIT, retired); Habibi-TTS Apache-2.0 dialect/MSA checkpoints (to verify) | Same | XTTS-v2, IndexTTS-2.5, Higgs v3, Habibi unified checkpoint |
| **Music** | ACE-Step 1.5 states CPU support (expect slow) | **ACE-Step 1.5** (MIT; 6 GB or less tier, 6–8 GB with 0.6B LM); DiffRhythm (Apache-2.0, 8 GB minimum) | ACE-Step 1.5 XL with offload; Stable Audio Open (community licence) | MusicGen, YuE (non-commercial weights; YuE also 24 GB) |
| **SFX / foley** | None | Stable Audio Open text-to-SFX (community licence; VRAM unverified) | Same | MMAudio (non-commercial, though only 6 GB); HunyuanVideo-Foley XL (8 GB offload, territorial licence); ThinkSound (contradictory licence) |
| **STT and alignment** | **faster-whisper int8** (MIT); **WhisperX** CPU mode (BSD-2) | Whisper large-v3-turbo via faster-whisper; Parakeet v3 (CC-BY-4.0, European languages) | Same | None; diarization needs a gated-model account |
| **Lip sync (re-dub)** | None | **MuseTalk 1.5** (MIT, 4 GB laptop per its README); **LatentSync 1.5** (8 GB; openrail++ weights, InsightFace in pipeline) | Same | Wav2Lip (non-commercial); LatentSync 1.6 (18 GB) |
| **Talking avatar (image + audio)** | None | OmniAvatar 14B at 8 GB and FantasyTalking at 5 GB (both Apache-2.0, very slow) | **EchoMimicV3-Flash** (Apache-2.0, 12 GB) | HunyuanVideo-Avatar (territorial licence); Hallo2/3 (licence chain, large GPUs); Wan2.2-S2V (80 GB example) |
| **Performance transfer** | None | LivePortrait after replacing the InsightFace detector | Same | LivePortrait as shipped (InsightFace) |
| **Upscaling** | Real-ESRGAN ncnn-Vulkan on integrated GPU (BSD-3) | Real-ESRGAN; **SeedVR2 GGUF** via community runtime (Apache-2.0) | Same; Topaz Starlight Mini / HQ at 10 GB minimum (paid) | SUPIR (non-commercial); STAR (39 GB); FlashVSR (laptop VRAM unknown) |
| **Frame interpolation** | Unverified | **RIFE 4.25** (MIT) | Same | GIMM-VFI (non-commercial); FILM (archived) |
| **Subject / reference-to-video** | None | **FramePack** (6 GB; base-model licence to confirm); VACE 1.3B and Phantom 1.3B (Apache-2.0; VRAM unstated) | Same; Wan2.2-TI2V-5B only if community quantisation is confirmed | MAGREF (70 GB); HunyuanCustom (licence, 24 GB+); HoloCine (non-commercial); MiniMax H3 (territorial) |
| **Reference image generation and editing** | OmniGen2 with sequential offload is under 3 GB but very slow | FLUX.2 klein 4B quantised (Apache-2.0, vendor-stated); DreamO via Nunchaku (FLUX.1-dev base licence) | Qwen-Image-Edit-2511 GGUF Q4 (Apache-2.0, about 11–12 GB) | FLUX.1 Kontext dev and FLUX.1-dev adapters for commercial deployment; InfiniteYou; InstantID |
| **LoRA training** | None | None recommended | Image LoRA at the 12 GB recommendation (musubi-tuner, Apache-2.0) | Video LoRA (24 GB or more) |
| **3D-anchored control** | Blender blocking and depth export | Control pass through VACE 1.3B | Same | None |
| **Automatic evaluation** | Win-rate statistics, WER, colour drift | Masked similarity metrics with small encoders | VBench custom dimensions (unverified on laptops) | InsightFace-based identity metrics inside the product |

---

## 10. Open questions

1. **Arabic voice**: which permissively licensed, maintained open model gives acceptable Arabic TTS and cloning now that Chatterbox is retired? Habibi-TTS's Apache-2.0 checkpoints need a direct licence read and a listening test. [UNKNOWN]
2. **Arabic lip sync and alignment**: no source documents Arabic viseme quality for any lip-sync model, and WhisperX's default Arabic alignment model was not verified. [UNKNOWN]
3. **Foley**: is there any permissively licensed video-to-audio model (PrismAudio, Sony Woosh) usable commercially on 8–12 GB? [UNKNOWN]
4. **Stems**: does any current video model or API expose separate dialogue, music and effects tracks? None found. [UNKNOWN]
5. **FramePack and HunyuanCustom weights**: do the Tencent territorial terms attach? [UNKNOWN]
6. **MiniMax H3 and FLUX 3 Image Klein**: exact licence texts, territories and revenue caps; real VRAM on Windows laptops. [UNKNOWN]
7. **Wan 2.2 5B and LTX-2.5 on 12 GB**: measured Windows laptop performance with quantised builds. [UNKNOWN]
8. **Eleven v4, Kling 4.0 / O3, Gemini Omni Flash**: official reference limits, lip-sync languages, pricing and consent requirements from first-party docs. [UNKNOWN]
9. **Runway References and Vidu reference; ACE++ and UNO; kohya sd-scripts and OneTrainer; LightX and relight LoRAs**: not researched. [UNKNOWN]
10. **LoRA cost and time** on 12 GB laptops, measured. [UNKNOWN]
11. **Topaz**: whether perpetual licences still exist; exact Starlight VRAM rows; Astra's status. [UNKNOWN]
12. **ITU-T P.910 (07/26) and ITU-R BT.500**: what changed in the 2026 edition, and the recommended subject numbers and viewing conditions. [UNKNOWN]
13. **Identity metrics with clean licences**: is there a face-recognition embedding with commercial-friendly weights (AdaFace or other) and a DINOv3 licence position suitable for a shipped evaluation feature? [UNKNOWN]
14. **VBench on a Windows laptop**: does the six-dimension custom mode run in 8–12 GB given the Detectron2 CUDA constraint? [UNKNOWN]
15. **Revision-cost benchmark**: none found; is there appetite to publish the platform's own task set and protocol as one? [UNKNOWN]
16. **Legal reading** of "outputs may be used commercially" for non-commercial model licences when the model runs on the customer's own machine inside a commercial product. [UNKNOWN]
17. **Voice and likeness consent law** by jurisdiction (only one third-party overview was captured). [UNKNOWN]

---

## 11. Source list (all accessed 2026-11-11)

Every URL cited in sections 0–10 is listed once, under the part where it is used, sorted by host. Access date for every entry: **2026-11-11**. How each source was reached (page fetched; paper abstract read through SciSpace or Consensus; or seen only as a search-result summary) is given by the evidence label at the point of citation and by the gap table in section 0.3. Appearing in this list does not upgrade any label. No accounts were created, nothing was downloaded and no forms were submitted.

### 11.1 Part A — voice and audio

- https://artificialanalysis.ai/text-to-speech/leaderboard
- https://artificialanalysis.ai/video/leaderboard/text-to-video
- https://arxiv.org/abs/2601.21337
- https://arxiv.org/html/2601.13802v2
- https://arxiv.org/html/2604.00688v2
- https://arxiv.org/pdf/2601.15621v1
- https://www.atlascloud.ai/blog/guides/ai-video-models-native-audio-compared
- https://audioshake.ai/post/audioshake-expands-into-dialogue-music-and-effects-separation-for-production-studios-and-dubbing-services
- https://cartesia.ai/blog/sonic-3.6/
- https://cined.com/google-lyria-3-launches-in-gemini-ai-music-generation-with-lyrics-style-control-and-synthid-watermarking
- https://www.cliprise.app/learn/comparisons/models/ai-video-models-native-audio-comparison
- https://cohere.com/blog/transcribe-arabic
- https://datanorth.ai/news/google-gemini-3-1-flash-tts-release
- https://dev.to/andrew-ooo/pocket-tts-review-kyutais-100m-cpu-voice-cloner-2026-40lb
- https://dev.to/mr_manushukla/sora-2-and-the-videos-api-shut-down-on-24-september-2026-the-migration-and-the-real-cost-per-second-bek
- https://developers.openai.com/api/docs/guides/custom-voices
- https://developers.openai.com/api/docs/guides/text-to-speech
- https://www.digitalmusicnews.com/2026/07/03/suno-is-opening-an-api-partner-program/
- https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/
- https://docs.cartesia.ai/build-with-cartesia/tts-models/latest
- https://docs.dev.runwayml.com/guides/models/
- https://dynamoi.com/learn/ai-music-distribution/is-udio-music-still-downloadable
- https://elevenlabs.io/blog/eleven-music-now-available-in-the-api
- https://elevenlabs.io/blog/eleven-v3-is-now-generally-available
- https://elevenlabs.io/docs/overview/capabilities/sound-effects
- https://www.gaudiolab.com/products/dme-separator
- https://gigazine.net/gsc_news/en/20260123-qwen3-tts-family-opensource
- https://github.com/ace-step/ACE-Step-1.5
- https://github.com/ASLP-lab/DiffRhythm
- https://github.com/boson-ai/higgs-audio
- https://github.com/boson-ai/higgs-audio/blob/main/README_V2.md
- https://github.com/canopyai/Orpheus-TTS
- https://github.com/facebookresearch/audiocraft
- https://github.com/fishaudio/fish-speech
- https://github.com/fishaudio/fish-speech/blob/main/LICENSE
- https://github.com/FunAudioLLM/CosyVoice
- https://github.com/FunAudioLLM/ThinkSound
- https://github.com/hkchengrex/MMAudio
- https://github.com/index-tts/index-tts
- https://github.com/m-bain/whisperX
- https://github.com/microsoft/VibeVoice
- https://github.com/multimodal-art-projection/YuE
- https://github.com/nari-labs/dia
- https://github.com/neuphonic/neuTTS
- https://github.com/OHF-Voice/piper1-gpl
- https://github.com/resemble-ai/chatterbox
- https://github.com/SWivid/F5-TTS
- https://github.com/SWivid/Habibi-TTS
- https://github.com/SYSTRAN/faster-whisper
- https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley
- https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2
- https://huggingface.co/adefossez/HTDemucs/discussions/1
- https://huggingface.co/coqui/XTTS-v2
- https://huggingface.co/hexgrad/Kokoro-82M
- https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- https://huggingface.co/Lightricks/LTX-2.5
- https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- https://huggingface.co/openai/whisper-large-v3-turbo
- https://huggingface.co/stabilityai/stable-audio-open-1.0
- https://huggingface.co/Supertone/supertonic-2
- https://hume.ai/blog/octave-2-launch
- https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox
- https://localclaw.io/tts/kitten-tts
- https://medium.com/@creativeaininja/ltx-2-5-what-lightricks-open-weights-video-model-actually-does-and-how-to-run-it-a17bad9664fd
- https://www.minimax.io/news/minimax-speech-28
- https://www.mixonline.com/post-and-broadcast/sony-ai-announces-sfx-generation-model-woosh
- https://www.musicbusinessworldwide.com/suno-limits-subscribers-downloads-per-month/
- https://www.musicbusinessworldwide.com/universal-music-settles-udio-lawsuit-strikes-deal-for-licensed-ai-music-platform
- https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/
- https://www.musicbusinessworldwide.com/warner-music-settles-udio-lawsuit-strikes-licensing-deal-with-ai-platform
- https://openrouter.ai/google/lyria-3-pro-preview-20260330
- https://pypi.org/project/pocket-tts/1.0.0/
- https://pypi.org/project/voxcpm
- https://scispace.com/papers/vorch-director-interactive-world-story-model-via-noise-aware-79hbdlnglzrh
- https://stability.ai/news/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale
- https://thenewstack.io/gemini-tts-voice-replication-api/
- https://vorplabs.com/ai-regulatory-updates/deepfake-laws/voice-likeness-consent

### 11.2 Part B — lip sync and talking characters

- https://anam.ai/blog/heygen-pricing
- https://www.atlascloud.ai/blog/tips/kling-ai-lip-sync
- https://dev.to/2gelbuy/heygen-pricing-2026-all-plans-from-0-to-149mo-compared-2dff
- https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-ai-avatar-v2
- https://github.com/antgroup/echomimic_v2
- https://github.com/antgroup/echomimic_v3
- https://github.com/bytedance/LatentSync
- https://github.com/deepinsight/insightface
- https://github.com/Fantasy-AMAP/fantasy-talking
- https://github.com/fudan-generative-vision/hallo2
- https://github.com/fudan-generative-vision/hallo3
- https://github.com/KwaiVGI/LivePortrait
- https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE
- https://github.com/MeiGen-AI/InfiniteTalk
- https://github.com/MeiGen-AI/MultiTalk
- https://github.com/Omni-Avatar/OmniAvatar
- https://github.com/OpenTalker/SadTalker
- https://github.com/Rudrabha/Wav2Lip
- https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar
- https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar/blob/main/LICENSE
- https://github.com/TMElyralab/MuseTalk
- https://hedra.com/docs/pages/getting_started/pricing
- https://www.hedra.com/pricing
- https://www.hedra.com/video-models/hedra-character-3
- https://huggingface.co/ByteDance/LatentSync-1.6
- https://huggingface.co/Wan-AI/Wan2.2-S2V-14B
- https://runware.ai/models/klingai-avatar-2-0-pro
- https://sync.so/docs/models/lipsync

### 11.3 Part C — upscaling, interpolation and restoration

- https://docs.topazlabs.com/topaz-video/system-requirements
- https://github.com/ByteDance-Seed/SeedVR
- https://github.com/Fanghua-Yu/SUPIR
- https://github.com/google-research/frame-interpolation
- https://github.com/GSeanCDAT/GIMM-VFI
- https://github.com/GSeanCDAT/GIMM-VFI/blob/main/LICENSE
- https://github.com/hzwer/Practical-RIFE
- https://github.com/NJU-PCALab/STAR
- https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler
- https://github.com/OpenImagingLab/FlashVSR
- https://github.com/xinntao/Real-ESRGAN
- https://huggingface.co/JunhaoZhuang/FlashVSR-v1.1
- https://kwaflux.com/blog/topaz-starlight-models-explained
- https://www.topazlabs.com/pricing

### 11.4 Part D — consistency methods

- https://www.atlascloud.ai/blog/tips/minimax-h3-open-source-weights
- https://bfl.ai/blog/flux2-klein-towards-interactive-visual-intelligence
- https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/
- https://www.buildfastwithai.com/blogs/gemini-omni-flash-review-google-ai-video-model-2026
- https://definable.ai/blog/google-gemini-omni-the-complete-guide-what-it-is-what-actually-works-and-what-doesnt/
- https://www.digitalapplied.com/blog/flux-3-image-klein-open-weights-8gb-gpu
- https://docs.together.ai/docs/seedance2.5-quickstart
- https://docs.worldlabs.ai/marble/export/gaussian-splat
- https://documentation.api.odyssey.ml/
- https://evolink.ai/blog/how-to-use-seedream-5-0-pro-multi-reference-image-generation
- https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-o1-reference-to-video
- https://github.com/ali-vilab/VACE
- https://github.com/bytedance/DreamO
- https://github.com/bytedance/InfiniteYou
- https://github.com/bytedance/lynx
- https://github.com/bytedance/USO
- https://github.com/instantX-research/InstantID
- https://github.com/kohya-ss/musubi-tuner
- https://github.com/lllyasviel/FramePack
- https://github.com/lllyasviel/IC-Light
- https://github.com/MAGREF-Video/MAGREF
- https://github.com/ostris/ai-toolkit
- https://github.com/Phantom-video/Phantom
- https://github.com/SkyworkAI/SkyReels-A2
- https://github.com/tencent-ailab/IP-Adapter
- https://github.com/Tencent-Hunyuan/HunyuanCustom
- https://github.com/ToTheBeginning/PuLID
- https://github.com/VectorSpaceLab/OmniGen2
- https://github.com/WeChatCV/Stand-In
- https://github.com/yihao-meng/HoloCine
- https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev
- https://huggingface.co/Qwen/Qwen-Image-Edit-2511
- https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF
- https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B
- https://www.kapwing.com/resources/is-seedance-2-5-actually-better-than-2-0-heres-what-i-found/
- https://kingy.ai/news/minimax-h3-benchmarks-specs-hardware-review/
- https://www.mindstudio.ai/blog/minimax-h3-run-locally-guide
- https://odyssey.ml/introducing-odyssey-2
- https://odyssey.ml/introducing-odyssey-2-max
- https://radiancefields.com/world-labs-introduces-world-api-for-marble
- https://radiancefields.com/world-labs-opens-gaussian-splat-creation-in-marble
- https://www.runcomfy.com/models/kling/kling-video-o1/image-to-video/reference
- https://runtimewire.com/article/alibaba-qwen-image-2-1-character-storyboard-editing-preview
- https://runware.ai/docs/models/bytedance-seedance-2-5/guides/multi-reference-production
- https://runware.ai/docs/models/bytedance-seedream-5-0-pro
- https://runware.ai/docs/models/google-gemini-omni-flash/guides/reference-driven-video
- https://runware.ai/docs/models/google-nano-banana-2-1/guides/subject-consistency
- https://scispace.com/papers/bagger-backwards-aggregation-for-mitigating-drift-in-lmmzkuh8kdav
- https://scispace.com/papers/canvas-continuity-aware-narratives-via-visual-agentic-iyzljtnodkyv
- https://scispace.com/papers/cycle-world-mitigating-error-accumulation-in-long-term-video-l96ro5a6w0wu
- https://scispace.com/papers/evostate-closed-loop-visual-state-management-for-long-form-2jj4mha3nq13
- https://scispace.com/papers/freqforcing-autoregressive-long-video-generation-via-meoa0ty2ryw3
- https://scispace.com/papers/goodbye-drift-anchored-tree-sampling-for-long-horizon-video-2rvnrreibgqf
- https://scispace.com/papers/groundshot-visually-consistent-multi-shot-long-video-o2b28s1n5m4d
- https://scispace.com/papers/in-distribution-forcing-for-long-video-generation-at-test-udxhktpt5whu
- https://scispace.com/papers/longlive-rag-a-general-retrieval-augmented-framework-for-fqpqa4mjaryy
- https://scispace.com/papers/msvbench-towards-human-level-evaluation-of-multi-shot-video-dckboms5utww
- https://scispace.com/papers/mvagent-multi-agent-video-generation-via-consistent-fj3wu3ate790
- https://scispace.com/papers/pack-and-force-your-memory-long-form-and-consistent-video-2nddb96uxqp1
- https://scispace.com/papers/pathwise-test-time-correction-for-autoregressive-long-video-xy6px2no33vp
- https://scispace.com/papers/rolling-forcing-autoregressive-long-video-diffusion-in-real-jlnav08ps6b2
- https://scispace.com/papers/stable-video-infinity-infinite-length-video-generation-with-adkvyfbnplj0
- https://scispace.com/papers/stage-storyboard-anchored-generation-for-cinematic-multi-tmdwcid10ptj
- https://scispace.com/papers/storymem-multi-shot-long-video-storytelling-with-memory-487cgye4dxwb
- https://scispace.com/papers/tethercache-stabilizing-autoregressive-long-form-video-z5poo0mku3q0
- https://scispace.com/papers/tokentrim-inference-time-token-pruning-for-autoregressive-1irlphvoi3xd
- https://scispace.com/papers/towards-error-free-long-video-generation-ylfxczfjx2c3
- https://scispace.com/papers/unityshots-memory-driven-multi-shot-audio-video-generation-v83pwjt8vs3q
- https://scispace.com/papers/videogen-of-thought-a-collaborative-framework-for-multi-shot-onucdzbeiwbi
- https://scispace.com/papers/videomemory-toward-consistent-video-generation-via-memory-lvlotdesanr1
- https://scispace.com/papers/when-identities-collapse-a-stress-test-benchmark-for-multi-sn4ncf4jdvuw
- https://scispace.com/papers/withanyone-towards-controllable-and-id-consistent-image-al5fjksl3xrt
- https://the-decoder.com/qwen-updates-image-editing-model-with-better-character-consistency/
- https://wavespeed.ai/blog/posts/blog-what-is-qwen-image-2-0-features-benchmarks
- https://willitrunai.com/video-models/minimax-h3

### 11.5 Part E — evaluation (web pages and SciSpace-indexed papers)

- https://arena.ai/leaderboard/text-to-video
- https://artificialanalysis.ai/methodology/video
- https://artificialanalysis.ai/video/arena
- https://github.com/KaiyueSun98/T2V-CompBench
- https://github.com/Vchitect/VBench
- https://www.itu.int/rec/T-REC-P.910
- https://scispace.com/papers/a-comparison-of-non-experts-and-experts-using-dsis-method-t2ege9rl
- https://scispace.com/papers/a-comparison-of-questionnaires-for-assessing-website-3fnjxmisnk
- https://scispace.com/papers/a-comparison-of-two-scoring-procedures-with-the-nasa-task-1hlbnttw81
- https://scispace.com/papers/a-critique-of-how-to-specify-the-participant-group-size-for-4eyj1y9b2n
- https://scispace.com/papers/a-rank-based-method-for-the-usability-comparison-of-4cozshu1pc
- https://scispace.com/papers/a-self-analysis-of-the-nasa-tlx-workload-measure-44exd268hl
- https://scispace.com/papers/a-structured-kano-ahp-framework-for-ai-assisted-generative-xtvcf8sitgs4
- https://scispace.com/papers/accounting-for-bias-enables-sustainable-llm-evaluation-z37irxtyzngu
- https://scispace.com/papers/agreement-is-overrated-a-plea-for-correlation-to-assess-5g2s07j9qv
- https://scispace.com/papers/agreement-metrics-for-llm-as-judge-evaluation-what-to-report-2c3huyyw6ln8
- https://scispace.com/papers/aigve-macs-unified-multi-aspect-commenting-and-scoring-model-uln0gw7k7hrf
- https://scispace.com/papers/an-empirical-evaluation-of-the-system-usability-scale-1n6xcx22d8
- https://scispace.com/papers/argus-stacked-multi-view-identity-mosaic-injection-for-wdat5qkq49y9
- https://scispace.com/papers/artifact-bench-evaluating-mllms-on-detecting-and-assessing-9i616m1xn9dl
- https://scispace.com/papers/auditing-the-face-condition-port-in-diffusion-based-video-gntx74zyyr9a
- https://scispace.com/papers/ave-compass-towards-holistic-evaluation-for-audio-video-kskgt4e1gz6l
- https://scispace.com/papers/beyond-correlation-the-impact-of-human-uncertainty-in-732bkgz0c9fy
- https://scispace.com/papers/beyond-fvd-enhanced-evaluation-metrics-for-video-generation-5awgzfe8u3w4
- https://scispace.com/papers/beyond-the-five-user-assumption-benefits-of-increased-sample-3e1tla6kvl
- https://scispace.com/papers/can-multimodal-large-language-models-evaluate-ai-generated-9u8b93tsh2pc
- https://scispace.com/papers/common-flaws-in-running-human-evaluation-experiments-in-nlp-49liewpn9v
- https://scispace.com/papers/comparative-ux-evaluation-of-zillow-and-zigbang-platforms-a-x83z3fr6gm6m
- https://scispace.com/papers/confidence-and-stability-of-global-and-pairwise-scores-in-re4lkf6psg7l
- https://scispace.com/papers/counting-on-consensus-selecting-the-right-inter-annotator-4srjzb2znm0t
- https://scispace.com/papers/covebench-can-video-editing-models-handle-complex-p9pu32aauhzj
- https://scispace.com/papers/cross-replication-reliability-an-empirical-approach-to-1d8kr8e9pe
- https://scispace.com/papers/determining-what-individual-sus-scores-mean-adding-an-251iu29hod
- https://scispace.com/papers/did-we-meet-or-exceed-our-goal-3o2nsd7i53
- https://scispace.com/papers/diffsim-taming-diffusion-models-for-evaluating-visual-3wmq9ug5pism
- https://scispace.com/papers/dropping-just-a-handful-of-preferences-can-change-top-large-fx5y5tcp72rq
- https://scispace.com/papers/dynamiceval-rethinking-evaluation-for-dynamic-text-to-video-wrwhn4rx1b33
- https://scispace.com/papers/each-judge-its-own-yardstick-discovering-per-vlm-taxonomies-5lsw8d4g5wtg
- https://scispace.com/papers/editeval-towards-comprehensive-and-automatic-evaluation-for-tmtk01ec17mw
- https://scispace.com/papers/efficient-bayesian-inference-from-noisy-pairwise-comparisons-k8r39pkw0mqj
- https://scispace.com/papers/elo-uncovered-robustness-and-best-practices-in-language-52a0wjotox
- https://scispace.com/papers/entitybench-towards-entity-consistent-long-range-multi-shot-cgludki2q1o3
- https://scispace.com/papers/estimating-sample-size-for-usability-testing-4dd11pwecg
- https://scispace.com/papers/estimating-the-relative-usability-of-two-interfaces-3ah6wlbvhm
- https://scispace.com/papers/evalcrafter-benchmarking-and-evaluating-large-video-24nvnzfevz
- https://scispace.com/papers/evaluating-text-to-video-alignment-a-hierarchical-benchmark-tkqmcuq88aru
- https://scispace.com/papers/evaluating-the-evaluators-metric-reliability-and-agreement-utfjj06rruz6
- https://scispace.com/papers/evbench-a-comprehensive-benchmark-of-video-generative-models-1ltrl4fuhzyl
- https://scispace.com/papers/expression-diverse-references-for-identity-preserving-video-n45lz87wwjpv
- https://scispace.com/papers/face-consistency-benchmark-for-genai-video-8832t7dhsfq5
- https://scispace.com/papers/fetv-a-benchmark-for-fine-grained-evaluation-of-open-domain-1xwzagl7u9
- https://scispace.com/papers/gaia-rethinking-action-quality-assessment-for-ai-generated-399cnourp7
- https://scispace.com/papers/genarena-how-can-we-achieve-human-aligned-evaluation-for-2a3pwi0cecqh
- https://scispace.com/papers/haakkim-an-arena-style-platform-for-human-preference-mvdzm021wgeo
- https://scispace.com/papers/how-high-is-high-a-meta-analysis-of-nasa-tlx-global-workload-3k963yykej
- https://scispace.com/papers/how-many-human-judgments-are-enough-feasibility-limits-of-4xw8x4un0if4
- https://scispace.com/papers/how-many-ratings-per-item-are-necessary-for-reliable-5tjqhlbwy2lj
- https://scispace.com/papers/how-many-repeated-pairwise-comparisons-are-needed-for-lkzlwutmevyk
- https://scispace.com/papers/id-sim-an-identity-focused-similarity-metric-8gs2qkxgd466
- https://scispace.com/papers/improved-usability-of-a-multi-infusion-setup-using-a-2xhn63mf3v
- https://scispace.com/papers/integrating-where-and-how-for-expertise-aware-8k-video-zbj9wxkcgy2s
- https://scispace.com/papers/investigating-the-correspondence-between-umux-lite-and-sus-4kblp1mfof
- https://scispace.com/papers/item-benchmarks-for-the-system-usability-scale-41hx2c0ytb
- https://scispace.com/papers/ivebench-modern-benchmark-suite-for-instruction-guided-video-ebyegvk3a9mp
- https://scispace.com/papers/k-sort-arena-efficient-and-reliable-benchmarking-for-1ug8pp3cqmbj
- https://scispace.com/papers/k-sort-eval-efficient-preference-evaluation-for-visual-451dm64y9u9y
- https://scispace.com/papers/liberal-conservative-hierarchies-of-intercoder-reliability-7ne5y0lkzrh5
- https://scispace.com/papers/masc-a-masked-similarity-metric-for-evaluating-concept-gj9bndeunhcc
- https://scispace.com/papers/measurement-invariance-of-the-nasa-tlx-5eef7y21hl
- https://scispace.com/papers/measuring-mental-workload-with-the-nasa-tlx-needs-to-examine-i58tnr0llj
- https://scispace.com/papers/mind-the-glitch-visual-correspondence-for-detecting-1ywsn9u47cfm
- https://scispace.com/papers/missing-information-unresponsive-authors-experimental-flaws-6swgscsm
- https://scispace.com/papers/mllm-as-a-judge-assessing-multimodal-llm-as-a-judge-with-43nozs8wip
- https://scispace.com/papers/moviebench-a-hierarchical-movie-level-dataset-for-long-video-567k2wotrf4a
- https://scispace.com/papers/msg-score-a-comprehensive-evaluation-for-multi-scene-video-2279d808a0al
- https://scispace.com/papers/multi-language-toolkit-for-the-system-usability-scale-19dvvh7r76
- https://scispace.com/papers/muss-a-large-scale-dataset-and-cinematic-narrative-benchmark-wpxougfma4go
- https://scispace.com/papers/naria-information-theoretic-narrative-alignment-via-scene-7kf924c5ifz4
- https://scispace.com/papers/nasa-task-load-index-nasa-tlx-20-years-later-4zos9jgvch
- https://scispace.com/papers/nasa-tlx-software-for-assessing-subjective-mental-workload-3z85zguggx
- https://scispace.com/papers/omniedit-bench-a-comprehensive-benchmark-for-instruction-kiuk143pqudg
- https://scispace.com/papers/on-the-content-bias-in-fr-echet-video-distance-53vhnumdjv
- https://scispace.com/papers/personashot-benchmarking-person-centric-narrative-continuity-re1pant056px
- https://scispace.com/papers/physics-aware-video-instance-removal-benchmark-zje3kqel5t43
- https://scispace.com/papers/playlisteval-can-video-language-judges-be-trusted-at-day-rtfvcfv0534i
- https://scispace.com/papers/primedit-probability-redistribution-for-instance-aware-multi-t0ifbore26g8
- https://scispace.com/papers/q-bench-video-benchmarking-the-video-quality-understanding-2uk57jt7guaa
- https://scispace.com/papers/raven-eval-rubric-guided-automatic-evaluation-for-ai-video-geh3cfmnpt3d
- https://scispace.com/papers/recommendations-and-reporting-checklist-for-rigorous-0lo9zymw10xy
- https://scispace.com/papers/reference-values-and-subscale-patterns-for-the-task-load-16635c2d3a
- https://scispace.com/papers/reliability-in-evaluator-based-tests-using-simulation-3qk2upj267
- https://scispace.com/papers/repairing-the-cracked-foundation-a-survey-of-obstacles-in-37m6529v
- https://scispace.com/papers/system-usability-scale-benchmarking-for-digital-health-apps-36u3o8vk
- https://scispace.com/papers/temporal-distance-predictability-a-reference-free-per-video-4chte8tjna27
- https://scispace.com/papers/testing-usability-goals-with-small-samples-a-binomial-2f19z0u95v
- https://scispace.com/papers/the-effects-of-running-fewer-subjects-on-time-on-task-4yl077977l
- https://scispace.com/papers/the-perils-of-using-mechanical-turk-to-evaluate-open-ended-2myit9yb36
- https://scispace.com/papers/the-relationship-between-system-effectiveness-and-subjective-4iy2n2lifz
- https://scispace.com/papers/thinking-on-shots-consistent-multi-shot-video-editing-with-74mfbvs44xba
- https://scispace.com/papers/toward-verifiable-and-reproducible-human-evaluation-for-text-2ri6ot0v
- https://scispace.com/papers/towards-a-better-metric-for-text-to-video-generation-25mzldcwmj
- https://scispace.com/papers/towards-subject-consistency-over-dynamic-subject-sets-in-4m707zzv4eex
- https://scispace.com/papers/unieditbench-a-unified-and-cost-effective-benchmark-for-vxqfkkhkhwni
- https://scispace.com/papers/v2v-bench-a-comprehensive-benchmark-for-video-to-video-qpn0yzpbfd5b
- https://scispace.com/papers/validation-of-the-raw-national-aeronautics-and-space-1abv4mdyci
- https://scispace.com/papers/vbench-comprehensive-and-versatile-benchmark-suite-for-video-7ejktg7xsrhc
- https://scispace.com/papers/vbench-comprehensive-benchmark-suite-for-video-generative-4htd0upxrc
- https://scispace.com/papers/vefx-bench-a-holistic-benchmark-for-generic-video-editing-aee8b6mliaqp
- https://scispace.com/papers/vera-identity-faithful-human-subject-to-video-generation-rf4i31cxcb34
- https://scispace.com/papers/videoargus-agentic-rubric-grounded-unified-evaluation-for-mux8w5hzvudx
- https://scispace.com/papers/videogen-eval-agent-based-system-for-video-generation-fgzs4vnabukz
- https://scispace.com/papers/videohallu-evaluating-and-mitigating-multi-modal-qc3cj4q1hvgb
- https://scispace.com/papers/videoscore-building-automatic-metrics-to-simulate-fine-14ngtc681q
- https://scispace.com/papers/videoscore2-think-before-you-score-in-generative-video-h9nt5p5r2s7k
- https://scispace.com/papers/vistorybench-comprehensive-benchmark-suite-for-story-kqyo18vj4a45
- https://scispace.com/papers/visual-aesthetic-benchmark-can-frontier-models-judge-beauty-dw400riayikl
- https://scispace.com/papers/vitex-bench-benchmarking-high-fidelity-video-scene-text-vtriybkj9nuy
- https://scispace.com/papers/what-makes-a-3d-scene-editable-a-factorized-benchmark-of-ecjy78ogh5am
- https://scispace.com/papers/why-and-when-five-test-users-aren-t-enough-359l4u9yms
- https://scispace.com/papers/why-global-llm-leaderboards-are-misleading-small-portfolios-yns73dqhcj85
- https://scispace.com/papers/world-consistency-score-a-unified-metric-for-video-46tnfhs7173f
- https://scispace.com/papers/worldjen-an-end-to-end-multi-dimensional-benchmark-for-hdhh4ezsy8bl

### 11.6 Consensus-indexed papers cited as [C-n]

Abstract-level access through the Consensus index; full texts were not read.

- **[C-1]** [Rethinking Human Evaluation Protocol for Text-to-Video Models: Enhancing Reliability, Reproducibility, and Practicality](https://consensus.app/papers/details/652319a5aa7d502994036ac89c6021e2/?utm_source=claude_desktop) (Tianle Zhang et al., 2024, ArXiv, 9 citations)
- **[C-2]** [EvalCrafter: Benchmarking and Evaluating Large Video Generation Models](https://consensus.app/papers/details/5e8686725b6c5518a89bef0978df1266/?utm_source=claude_desktop) (Yao-Fang Liu et al., 2023, 2024 IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 432 citations)
- **[C-3]** [SLVMEval: Synthetic Meta Evaluation Benchmark for Text-to-Long Video Generation](https://consensus.app/papers/details/c3002c073891595ab78569ac9300e4fa/?utm_source=claude_desktop) (Ryosuke Matsuda et al., 2026, ArXiv, 2 citations)
- **[C-4]** [Evaluation of Text-to-Video Generation Models: A Dynamics Perspective](https://consensus.app/papers/details/23e9be97466e5aec98d308187999d367/?utm_source=claude_desktop) (Ming-Xiang Liao et al., 2024, ArXiv, 91 citations)
- **[C-5]** [T2VTextBench: A Human Evaluation Benchmark for Textual Control in Video Generation Models](https://consensus.app/papers/details/bb7dc03329e55777b250b9a8ee20d25f/?utm_source=claude_desktop) (Xu-Yang Guo et al., 2025, ArXiv, 13 citations)
- **[C-6]** [VBench++: Comprehensive and Versatile Benchmark Suite for Video Generative Models](https://consensus.app/papers/details/b949f78043f957958a9d1c6df3901762/?utm_source=claude_desktop) (Zi-Qi Huang et al., 2025, IEEE Transactions on Pattern Analysis and Machine Intelligence, 303 citations)
- **[C-7]** [Multi-Dimensional Quality Assessment for AI-Generated Human-Centric Videos: Dataset and Model](https://consensus.app/papers/details/712972761af755a99142cfca632cb4ee/?utm_source=claude_desktop) (Si-Jing Wu et al., 2026, IEEE Transactions on Circuits and Systems for Video Technology, 6 citations)
- **[C-8]** [Can You Count to Nine? A Human Evaluation Benchmark for Counting Limits in Modern Text-to-Video Models](https://consensus.app/papers/details/9df221136792566da28569f600c71965/?utm_source=claude_desktop) (Xu-Yang Guo et al., 2025, ArXiv, 15 citations)
- **[C-9]** [FETV: A Benchmark for Fine-Grained Evaluation of Open-Domain Text-to-Video Generation](https://consensus.app/papers/details/85e27627420f509abf0da9dd4d0554bf/?utm_source=claude_desktop) (Yuanxin Liu et al., 2023, ArXiv, 154 citations)
- **[C-10]** [CVBench: Benchmarking and Comparing Video Generation with Large Multimodal Models](https://consensus.app/papers/details/f8a1fefe454153368a6bfc32d4c90e82/?utm_source=claude_desktop) (Jia-Rui Wang et al., 2025, 2025 International Conference on Visual Communications and Image Processing (VCIP), 0 citations)
- **[C-11]** [Strategy for Boosting Pair Comparison and Improving Quality Assessment Accuracy](https://consensus.app/papers/details/6d5b92f8892e5291b71993e70e2e64f5/?utm_source=claude_desktop) (Suiyi Ling et al., 2020, ArXiv, 11 citations)
- **[C-12]** [Benchmarking Subjective Quality Assessment Methodologies for Light Field Compression](https://consensus.app/papers/details/eedefff3c6a0547d80ab29dad1439710/?utm_source=claude_desktop) (Mahmoudpour et al., 2026, IEEE Transactions on Broadcasting, 3 citations)
- **[C-13]** [Adaptive Paired-Comparison Method for Subjective Video Quality Assessment on Mobile Devices](https://consensus.app/papers/details/e3dbc6d8888f5aea83560cc6ee1ea8d6/?utm_source=claude_desktop) (Storrs et al., 2018, Picture Coding Symposium (PCS), 3 citations)
- **[C-14]** [On Designing Paired Comparison Experiments for Subjective Multimedia Quality Assessment](https://consensus.app/papers/details/b3d45f6f955f513490c9e631a186bc64/?utm_source=claude_desktop) (Jong-Seok Lee, 2014, IEEE Transactions on Multimedia, 30 citations)
- **[C-15]** [Efficient, robust and divisible paired comparison for subjective quality assessment](https://consensus.app/papers/details/b6f441dd18e353119aed42a3114f98ff/?utm_source=claude_desktop) (Rui Song et al., 2017, Multimedia Tools and Applications, 1 citation)
- **[C-16]** [Active Sampling for Subjective Video Quality Assessment](https://consensus.app/papers/details/7235258526f55764b3217319ec7aac90/?utm_source=claude_desktop) (Jiang et al., 2018, BigMM, 3 citations)
- **[C-17]** ["Discriminability–Experimental Cost" Tradeoff in Subjective Video Quality Assessment of Codec: DCR with EVP Rating Scale Versus ACR–HR](https://consensus.app/papers/details/7ff52a66073d5dde9a6223c4b495aa3e/?utm_source=claude_desktop) (Pastor et al., 2024, Picture Coding Symposium (PCS), 7 citations)
- **[C-18]** [Random partial paired comparison for subjective video quality assessment via hodgerank](https://consensus.app/papers/details/e39980eff0d05063ad181bff2e91ed00/?utm_source=claude_desktop) (Qian-Qian Xu et al., 2011, Proceedings of the 19th ACM international conference on Multimedia, 46 citations)
- **[C-19]** [Crowd workers proven useful : a comparative study of subjective video quality assessment](https://consensus.app/papers/details/c7c5ba0a59b856e7ba454f5d4c0e99ef/?utm_source=claude_desktop) (D. Saupe et al., 2016, venue not given by the index, 40 citations)
- **[C-20]** [Comparison of Four Subjective Methods for Image Quality Assessment](https://consensus.app/papers/details/0dc3c83c078a5df4a95fb90f971f2579/?utm_source=claude_desktop) (Rafał K. Mantiuk et al., 2012, Computer Graphics Forum, 323 citations)

### 11.7 Sources cited only in the framing and closing sections (0–2 and 8–10)

- https://www.atlascloud.ai/blog/tips/is-wan-3.0-open-source
- https://www.musicbusinessworldwide.com/universal-and-sony-sue-suno-for-a-second-time-claiming-platforms-v6-models-are-the-fruit-of-the-same-poisoned-tree/
- https://techinformed.com/openais-sora-shutdown-adds-to-signs-of-a-harder-ai-phase/
- https://techjacksolutions.com/ai-brief/openai-videos-api-sora-2-deprecated-september-2026/
- https://venturebeat.com/technology/black-forest-labs-launches-flux-3-capable-of-generating-images-and-20-second-video-with-audio-but-in-limited-release-to-start

---

*End of report 06. Prepared 2026-11-11. The web-search budget for the session was exhausted before every gap could be closed; unresolved items are in sections 0.3 and 10.*
