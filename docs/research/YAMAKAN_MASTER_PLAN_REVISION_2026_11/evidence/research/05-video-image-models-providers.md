# 05 — Video and Image Generation Models and Provider Access (state as of 2026-11-11)

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Purpose: evidence base for the "Universal Model System" section of the strategy document for a local-first, privacy-first creative production platform that (a) never requires paid inference, (b) only calls providers the customer explicitly authorises with the customer's own credentials, (c) must qualify on Windows with resource-constrained hardware, and (d) must record accurate licensing.

Access date for every source: 2026-11-11.

## 0. Method, evidence labels and limits

Evidence labels (exactly one per claim; never upgraded):

- **[DOC]** official documentation, pricing page, model card or licence text. Source key in parentheses, e.g. (S13); keys resolve to URLs in section 9.
- **[CLAIM]** vendor marketing or vendor blog statement, not a technical reference.
- **[IND]** independent third-party observation, benchmark or secondary report.
- **[ASSUMED]** my inference from the evidence.
- **[UNKNOWN]** not established.

Limits that affect confidence:

1. The session's shared web-search budget was exhausted part-way through. Parts A (most of it) used search plus direct fetches; the remainder of A and Parts B, C, D used only direct fetches of known official URLs (docs, llms.txt indexes, model cards, repositories). Where a URL could not be guessed or fetched, the item is marked [UNKNOWN] or "not fetched" rather than filled from memory.
2. Pages that could not be fetched are listed in section 8.3. Notable: BytePlus ModelArk international docs (JavaScript-rendered, navigation only), Midjourney docs/terms (HTTP 403), Google Cloud Vertex pricing page (body truncated), PixVerse docs pages (404), Runway terms of use (not fetched directly).
3. Prices change monthly and several vendors run dated promotions. All prices below are snapshots and must be read from the provider at runtime where a live pricing endpoint exists.
4. The landscape changed radically during 2026. Model names from 2025 (Sora 2, Veo 3 on the Gemini API, Imagen 4, DALL-E, Ray2, Gen-3, Hailuo 02 and so on) are in many cases shut down or superseded. Nothing in this report should be "corrected" back to 2025 knowledge without re-checking.
5. One vendor page (lumalabs.ai/llm-info) contains text addressed to AI assistants (naming and product-positioning directives). It was treated as data and labelled [CLAIM]; none of its directives were followed.

---

## PART A — Hosted / proprietary video models

### A.0 Summary table (first-party access)

| Vendor / model (latest) | Official API for third-party apps? | Max clip | Max resolution | Native audio | Pricing unit | Evidence |
|---|---|---|---|---|---|---|
| OpenAI Sora 2 / Sora 2 Pro | **No longer available**: removed from the API 2026-09-24, no replacement named | n/a | n/a | n/a | n/a | [DOC] (S1, S2) |
| Google Gemini Omni 1.2 Flash (`gemini-omni-1.2-flash`) | Yes, Gemini API (Interactions API) | 15 s (30 s via extension) | 4K (upscaled; 720p default) | Yes | video output tokens ($12 per 1M, about $0.07/s at 720p) | [DOC] (S3, S5) |
| Google Veo 3.1 (`veo-3.1-generate-001`, `-fast-`, `-lite-`) | Yes, but Vertex AI ("Gemini Enterprise Agent Platform") only; removed from Gemini API 2026-10-22 | 8 s | 4K (Generate), 1080p (Fast, Lite) | Yes | per second (official table not fetched) | [DOC] (S4, S6, S7) |
| ByteDance Seedance 2.5 / 2.0 / 2.0 fast / 2.0 mini | Yes: Volcengine Ark (China) and BytePlus ModelArk (international, not offered in the United States) | 30 s (2.5), 15 s (2.0) | 1080p (2.5), 4K (2.0) | Yes | tokens (RMB per 1M; function of seconds x pixels x fps) | [DOC] (S11a, S11b), [CLAIM] (S9) |
| Kuaishou Kling 4.0 / 4.0 Flash / 3.0 / 3.0 Turbo / 3.0 Omni / O1 / 2.6 / 2.5 Turbo | Yes, official API platform | 30 s (4.0) | 4K (4.0, 3.0, 3.0 Omni) | Yes | "units" per second ($0.157 or $0.14 per unit) | [DOC] (S13, S16, S17) |
| Runway Gen-4.5, Gen-4 Turbo, Aleph 2.0, Act-Two | Yes; the same API also resells Kling, Seedance, Wan, Veo, Gemini Omni, Hailuo/H3, Grok Imagine, HappyHorse | 10 s (Gen-4.5); Aleph 2.0 edits 2-30 s inputs | 1080p (Aleph preserves input up to 1080p) | Model-dependent | credits ($0.01) per second | [DOC] (S21, S23) |
| Luma Ray 3.2 (`ray-3.2`) | Yes, "Agents API" | 10 s per generation (extend available) | 1080p, HDR/EXR option | Not mentioned in docs | credits per 5 s / 10 s block; USD value of a credit depends on plan | [DOC] (S26, S27) |
| MiniMax H3 (`MiniMax-H3`, `-Highspeed`, `-Lite`, `-Max`), legacy Hailuo 2.3 / 02 | Yes | 15 s | 2K | [UNKNOWN] from fetched pages | USD per second (H3); per video (Hailuo legacy) | [DOC] (S29, S30) |
| Shengshu Vidu Q4 Preview, Q3 Pro/Turbo/Mix, Q2 | Yes | 16 s | 4K (Q4 Preview) | [UNKNOWN] from fetched pages | credits per second (1 credit = 0.03125 RMB), off-peak discounts | [DOC] (S31) |
| PixVerse V6, C1 | Yes, but terms forbid commercial profit-making use and third-party app integration "for resale or sharing" without written authorisation | 15 s | 1080p | Yes | credits per second | [DOC] (S33), [IND] (S34) |
| Pika | First-party developer API at dev.pika.art now exists but its documented catalogue is **other vendors' models** (Seedance 2.5, Gemini Omni 1.1 Flash, Wan 3.0, MiniMax H3); Pika-branded model endpoints not shown on the fetched page | n/a | n/a | n/a | prepaid, micro-USD quotes | [DOC] (S49) |
| Moonvalley Marey | **API discontinued** ("The Moonvalley API service is no longer available.") | n/a | n/a | n/a | n/a | [DOC] (S46) |
| Lightricks LTX-2.5 / LTX-2.3 (fast, pro) | Yes | 20 s (2.5 fast at 720p/1080p, 24/25 fps) | 4K | Yes (default on) | USD per second | [DOC] (S39, S42) |
| Alibaba Wan 3.0 (`wan3.0-video`, `-prime`), Wan 2.7, 2.6, 2.5 | Yes, Alibaba Cloud Model Studio (DashScope) | 30 s (3.0) | 1080p | Yes | CNY per second by resolution and region | [DOC] (S35, S36) |
| xAI Grok Imagine Video 1.5 / 1.5 Lite | Yes | 15 s | 1080p native (1.5) | Yes, lip-synced speech | USD per second | [DOC] (S37, S38) |
| Midjourney video (V1; "V8.x" image-to-video listed by resellers) | **No official public API**; first-party app only; resold through unofficial or third-party hosts | 21 s with extensions (V1) | SD/HD | [UNKNOWN] | subscription GPU time | [IND] (S45-note) |
| Alibaba "HappyHorse 1.0/1.1" | Hosted on Alibaba Bailian and resellers (Runway lists `happyhorse_1_0`); open-weights claims unverified | [UNKNOWN] | 1080p | [UNKNOWN] | Runway: 15/30 credits per second (720p/1080p) | [DOC] (S21) for Runway price; [IND] (S48) for the rest |

Ranking context: the Artificial Analysis text-to-video arena (blind votes) listed, in an undated late-2026 snapshot, HappyHorse-1.0, Dreamina Seedance 2.0, Kling 3.0 Pro, Grok Imagine Video and Kling 3.0 Omni at the top of the no-audio board, and Seedance 2.0 at the top of the with-audio board; August 2026 third-party snapshots instead put Gemini Omni Flash and MiniMax H3 first. [IND] (S47). Snapshot conflicts mean ranking must not drive architecture; treat all of these as "frontier class".

### A.1 OpenAI — Sora (video)

- The Videos API and `sora-2`, `sora-2-pro` (and dated snapshots) were notified for deprecation 2026-03-24 and removed from the API on 2026-09-24; the deprecations table gives no recommended replacement. [DOC] (S1)
- The current models page lists no video model. [DOC] (S2)
- The Sora consumer web/app experience closed on 2026-04-26; Azure Foundry kept a Sora preview only until mid-October 2026; successor rumours are speculative. [IND] (S1-ind)
- Historical pricing before shutdown was reported as $0.10/s (sora-2, 720p) and $0.30-$0.70/s (sora-2-pro). [IND] (S1-ind)
- Consequence: an adapter for Sora must be shipped (if at all) as "retired"; any aggregator still listing Sora should be treated as stale until proven live. [ASSUMED]

### A.2 Google — Gemini Omni Flash and Veo

Gemini Omni (Gemini API):

- Current model `gemini-omni-1.2-flash`; `gemini-omni-1.1-flash` routes to 1.2 and is billed at 1.2 rates from 2026-12-03. [DOC] (S3, S6)
- API surface is the Interactions API (`POST /v1beta/interactions`), with a synchronous option, SSE streaming, and URI delivery via the Files resource (poll until ACTIVE) for outputs over about 4 MB. Webhooks, a cancel call and a seed parameter are not mentioned. [DOC] (S5)
- Operations: text-to-video; image-to-video; first/last-frame interpolation (two images, 3-10 s only); up to 6 reference images (up to 3 per character, up to 2 characters); reference videos up to 3 s each; multi-turn conversational editing via `previous_interaction_id` or uploaded video up to 15 s; extension (uses final 10 s of input, adds 3-10 s, up to 30 s total, end-of-clip only); native synchronised audio. Audio inputs and voice editing are not supported. [DOC] (S5)
- Limits: duration 3-15 s (whole seconds, default 10); 360p, 720p (default), 1080p and 4K (both upscaled); aspect 16:9 and 9:16 only; no negative prompt, temperature or system instruction. FPS not stated. [DOC] (S5)
- Pricing: $12.00 per 1M video output tokens, which the page equates to about $0.023/s (360p), $0.07/s (720p), $0.104/s (1080p upscaled), $0.209/s (4K upscaled). No free tier. [DOC] (S3)
- Provenance and moderation: "All generated videos include SynthID watermarking"; C2PA not mentioned on the Omni page. Uploading or editing recognisable people is not supported; images of minors are not supported in the EEA, Switzerland and the UK; editing/extending uploaded video is unavailable in EEA/CH/UK; safety filtering varies by region. [DOC] (S5)
- Output retention is not stated; `store=false` makes the result non-editable later. [DOC] (S5)

Veo:

- On the Gemini API, `veo-2.0-generate-001`, `veo-3.0-*` were shut down 2026-06-30 and the `veo-3.1-*-preview` IDs on 2026-10-22; Google directs users to Gemini Omni Flash or to GA Veo on the "Gemini Enterprise Agent Platform" (the renamed Vertex AI). [DOC] (S4, S6)
- On Vertex: `veo-3.1-generate-001` and `veo-3.1-fast-generate-001` are GA, `veo-3.1-lite-generate-001` is Preview. All three support text-to-video, image-to-video, first+last frame and extension; reference ("asset") images are supported on Generate and Fast only; audio generation supported; durations 4/6/8 s; 720p/1080p (+4K on Generate); 24 fps; 16:9 and 9:16; region `us-central1` only; Content Credentials (C2PA) supported; retirement "May 4, 2027 or later". Seed is not mentioned on that page. [DOC] (S7)
- Vertex Veo prices: the official pricing page body could not be retrieved. Third parties report Standard $0.40/s (720p/1080p) and $0.60/s (4K); Fast $0.10-$0.30/s; Lite $0.05-$0.08/s. [IND] (S8-ind)
- No "Veo 4" exists in the fetched Google documentation; "Gemini Omni" is the brand of the newer generation. [DOC] (S3, S6)
- BYO-credential implication: Vertex uses Google Cloud project credentials (service account or OAuth), a single US region, and cloud-storage style outputs, which is materially heavier for a desktop customer than pasting an API key. [ASSUMED]

### A.3 ByteDance — Seedance (Volcengine Ark / BytePlus ModelArk)

Fetch status: BytePlus international docs returned navigation only on every attempt, so parameter-level facts below come from the equivalent Volcengine (China-mainland) documentation, which did fetch. Parity of the BytePlus international endpoint with Volcengine is [ASSUMED]; BytePlus docs navigation does list matching pages (create / retrieve / list / "cancel or delete" video generation tasks; Seedance 2.5 and 2.0 tutorials; "online inference (flex)"). [DOC] (S11b)

- Models: Seedance 2.5 (example ID `doubao-seedance-2-5-260628`), 2.0, 2.0 fast, 2.0 mini, and 1.0 pro / 1.0 pro fast. [DOC] (S11a). International IDs reported as `dreamina-seedance-2-5-260628`, `dreamina-seedance-2-0-260128` and variants. [IND] (S11-ind)
- API: `POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks` creates an asynchronous task; poll the query endpoint; `callback_url` receives POSTs with the same structure as the query response and failed deliveries are retried up to three times. Statuses: queued, running, succeeded, failed, expired (plus cancelled). [DOC] (S11a, S11c)
- Cancel/delete: `DELETE .../tasks/{id}` cancels a **queued** task; a **running** task cannot be cancelled or deleted; succeeded/failed/cancelled/expired tasks can only have their record deleted. Billing of cancelled tasks is not stated. [DOC] (S11c)
- Parameters: resolution 480p/720p/1080p/4k (4k on Seedance 2.0 only; fast and mini lack 1080p); ratio 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 or adaptive (2.5 editing, extension and first-frame tasks accept only adaptive); duration 4-30 s for 2.5, 4-15 s for 2.0, 2-12 s for 1.0 pro, or -1 for model-chosen; `generate_audio` default true (stereo on 2.0+); `watermark` default false; `return_last_frame`; `execution_expires_after` default 48 h; `priority` 0-9. [DOC] (S11a)
- **Seed is supported only by the 1.0 pro models, not by Seedance 2.0 or 2.5**; even there "same seed yields similar, not guaranteed identical" output. `camera_fixed` likewise only on 1.0 pro. [DOC] (S11a)
- Flex (offline, 50% price) tier is not available for 2.0/2.5. [DOC] (S11a)
- Task IDs valid 7 days (draft task IDs 14 days from 2026-10-28). Output URL validity is not stated on the fetched page. [DOC] (S11a)
- Pricing (Volcengine, RMB per 1M tokens): Seedance 2.5 70 (480p/720p) or 77 (1080p) without input video, 42/46 with input video; Seedance 2.0 46/51 (28/31 with video; 4K 26/16); 2.0 fast 37 (22); 2.0 mini 23 (14). Tokens are approximately (input video seconds + output seconds) x width x height x fps / 1024; actual usage is returned in `usage.completion_tokens`; a minimum applies when input contains video. Worked examples for 5 s, 16:9, no input video: Seedance 2.5 = 3.36 RMB (480p), 7.56 (720p), 18.71 (1080p); Seedance 2.0 = 2.31 / 4.97 / 12.39 / 25.27 (4K). Only successful generations are billed. [DOC] (S11d)
- BytePlus international USD prices could not be fetched; third parties report roughly $0.10/s (480p) to $0.57/s (1080p). [IND] (S11-ind)
- Capabilities of 2.5 per vendor posts: up to 30 s audio+video in one pass; up to 50 multimodal references (reported split: up to 30 images, 10 video clips, 10 audio clips); timestamp-level secondary edits, green-screen editing, camera-perspective editing, multi-round extension. [CLAIM] (S9, S10)
- Availability and safety: offered via BytePlus ModelArk "in supported markets globally"; BytePlus is not available in the United States; outputs carry visible watermarks plus C2PA Content Credentials; technical controls restrict generation from images/videos containing real faces, with a vetted real-person verification route for approved clients. [CLAIM] (S9)
- Resale: Seedance 2.5/2.0 are resold by Runway (credits per second, see A.5) and Pika's developer API. [DOC] (S21, S49)

### A.4 Kuaishou — Kling

- Official API with fetchable Markdown docs; index at (S12). Base URL `https://api-singapore.klingai.com`, bearer key auth. [DOC] (S13)
- Kling 4.0 (launched 2026-10-15 [IND] (S20-ind)): text-to-video, image-to-video, first/middle/last frame keyframes, up to 7 "elements", up to 10 reference images, up to 5 reference videos (30 s combined), voice reference, lip sync, native audio, multi-shot; 720p/1080p/4K; 3-30 s; no motion control. Kling 4.0 Flash: first frame only, 720p, 3-20 s. [DOC] (S17)
- Kling 4.0 "omni" endpoint (`POST /omni-video/kling-4.0`) unifies reference generation, video editing (`base_video`) and keyframe generation; combined inputs capped at 15; aspect 21:9, 16:9, 9:16, 1:1, adaptive; audio `native` or `original`. [DOC] (S14)
- Kling 3.0 family: 3.0 (start/end frame, motion control, native audio, multi-shot, up to 4K, 3-15 s), 3.0 Turbo (first frame only, motion control, 720p/1080p), 3.0 Omni (elements, one reference video, up to 4K), O1, 2.6, 2.5 Turbo; separate endpoints for Motion Control, Multi-element Video Editing, Avatar, Lip Sync, video-to-audio, Effects. A standalone "extend" endpoint and explicit camera-control parameters are not listed in the current index. [DOC] (S12, S17)
- Async model: create returns a task; poll `GET /tasks?task_ids=...` or by `external_task_ids`; optional `callback_url`; `external_task_id` must be unique per account (usable as a client idempotency/correlation key, though duplicate-suppression semantics are not documented). Webhooks carry HMAC-SHA256 signature headers with a 5-minute tolerance; retry policy not described. [DOC] (S13, S15)
- **No cancel endpoint and no seed parameter are documented** for Kling 4.0. [DOC] (S13, S14)
- Retention: "Generated results are retained for 30 days; save them promptly." Prompt/response logs kept 30 days; no training on customer data. [DOC] (S13, S18)
- Watermark: `options.watermark_info.enabled`, default false. [DOC] (S13)
- Pricing in "units" per second (1 unit = $0.157 for 4.0/4.0 Flash, $0.14 otherwise): Kling 4.0 1.0 unit/s at 720p ($0.157) and 1.5 at 1080p ($0.235) without input video; 0.6/0.9 with input video, billed on (input + output) seconds; 4.0 Flash 0.6 unit/s; Kling 3.0 with audio 0.9 / 1.2 / 3.0 (4K) units/s; Kling 2.6 0.3-1.2; Lip Sync 0.5 unit per 5 s; Avatar 0.4/0.8 per s. Billing uses the returned `usage.output_duration`. [DOC] (S16, S13)
- Concurrency is per account per model version and shared across keys; error 1303 on overflow; no QPS limit. [DOC] (S19)
- Terms: keys "can only be used for the authorized your Client Application" and must not be transferred or disclosed to third parties; API services may not be resold or sublicensed; outputs: "the intellectual property rights of the AI-generated content still belong to you", commercial use "not restricted"; prepaid balance non-refundable; licence limited to an unspecified "geographical scope of business". [DOC] (S18)
- BYO-key reading: a customer who holds their own Kling account and pastes their own key into a desktop app that they operate is using the key themselves; the clause is aimed at vendors redistributing one key. Whether a third-party-authored desktop client counts as "your Client Application" is not addressed. [ASSUMED]

### A.5 Runway

- Own models and prices (1 credit = $0.01): `gen4.5` 12 credits/s; `gen4_turbo` 5; `aleph2` 28 (56-credit minimum); `act_two` 5; ProRes/PNG-sequence +5/s; HDR/10-bit +20/s. Images: `gen4_image` 5 (720p) / 8 (1080p), `gen4_image_turbo` 2, `muse_image` 1. [DOC] (S21)
- Gen-4.5: text-to-video (1280:720 and 720:1280 only) and image-to-video (more ratios), 2-10 s. Aleph 2.0: in-context video editing with keyframe guidance; input video 2-30 s, 30 fps or lower; output preserves input resolution up to 1080p. Act-Two: performance/motion capture transfer. [DOC] (S23)
- Runway's API is also a **multi-vendor reseller**: Kling 2.5 Turbo / 3.0 / O3 / 4.0 / 4.0 Flash, Wan 3.0 and 3.0 Prime, Seedance 2.5 / 2.0 / fast / mini, Grok Imagine 1.5 and Lite, MiniMax H3 Max and Hailuo 3, Veo 3.1 and 3.1 Fast, HappyHorse 1.0, Gemini Omni Flash 1.1/1.2, plus image models (Seedream 5, Nano Banana, Ideogram, GPT Image, Bria Fibo, Grok Imagine Image) and a "Model Router" (`/v1/generate/video`) that picks a model by cost, latency or quality. [DOC] (S21, S22)
- Example reseller rates (credits per output second): Seedance 2.5 20 / 30 / 68 (480p/720p/1080p) plus 10/15/34 per second of input/reference video, 80-credit minimum; Kling 4 list 15.7 (720p) / 23.5 (1080p) with a 20% promotion to 2026-11-30; Wan 3.0 5 / 10 / 20; Veo 3.1 40 with audio; Gemini Omni Flash 1.2 2 / 7 / 10 / 21 (360p-4K). [DOC] (S21)
- Async model: `POST /v1/image_to_video`, `/v1/text_to_video`, `/v1/video_to_video`, `/v1/character_performance`, upscalers; poll `GET /v1/tasks/{id}`; statuses include PENDING, THROTTLED ("stored on our servers but has not been enqueued"), RUNNING, SUCCEEDED, FAILED, CANCELED; **`DELETE /v1/tasks/{id}` cancels or deletes**; aborting the SDK wait does not cancel. Webhooks are not documented in the fetched text. [DOC] (S22, S23)
- Seed: optional on some models; maximum value 4294967295; determinism guarantee not described. [DOC] (S23)
- Outputs: URLs are "ephemeral" and "will expire within 24-48 hours"; do not hotlink. [DOC] (S24)
- Moderation: default `auto`; optional `contentModeration.publicFigureThreshold`; **moderated requests are charged the same as successful ones**. [DOC] (S23)
- Usage tiers: per-model concurrency, rolling 24-hour generation caps and monthly spend caps (Tier 1 $100/month to Tier 5 $100,000/month). [DOC] (S23)
- Branding: docs instruct integrators to show "Powered by Runway" with a link. [DOC] (S23). A terms-monitoring service reports the Terms of Use require prominent "Powered by Runway" display for applications made available to end users, forbid using outputs to train competing models, and vest ownership of accounts and API keys in Runway. [IND] (S25). Runway's Terms of Use were not fetched directly.
- BYO-key reading: the branding duty attaches to applications built on the API; a desktop tool where the customer brings their own Runway key would still plausibly need the attribution string wherever Runway generation is offered. [ASSUMED]

### A.6 Luma — Ray 3.2

- Model IDs: video `ray-3.2`; images `uni-1`, `uni-1-max`. `POST /v1/generations`, `GET /v1/generations/{id}` ("submit-poll-download"). [DOC] (S26)
- Operations: text-to-video; image-to-video via `video.start_frame` / `video.end_frame`; multi-keyframe (`video.keyframes`, docs say up to 64 anchors; vendor marketing says 16 [CLAIM] (S28)); `video_edit`; `video_reframe`; extend by passing a generation ID as start/end frame; HDR (`video.hdr`), EXR export; loop. Durations 5 s or 10 s; 540p/720p/1080p (360p draft appears in pricing); six aspect ratios. [DOC] (S26, S27)
- Webhooks, cancel, seed, audio, watermark: not mentioned in the fetched model guide; a "Generation deletion" page exists in navigation. [DOC] (S26)
- Outputs are presigned URLs that "expire after 1 hour". [DOC] (S26)
- Pricing in credits: video generation 20 / 50 / 100 / 400 credits per 5 s at 360p-draft / 540p / 720p / 1080p and 60 / 150 / 300 / 1,200 per 10 s (10 s is 3x, not 2x, the 5 s price); HDR doubles and HDR+EXR triples the 5 s price and is 5 s only; video edit 180-720 per 5 s; reframe 10-120 per second; `uni-1` 14 credits per text-to-image, `uni-1-max` 34, +1 per extra reference image (up to 9). "The dollar value of a credit depends on your plan or contract." "Video rates are subject to change ahead of general availability." Moderated or failed asynchronous generations are refunded. [DOC] (S27)
- Third parties equate 100 credits to about $0.30 (720p 5 s). [IND] (S27-ind)

### A.7 MiniMax — H3 (successor to Hailuo)

- `MiniMax-H3`: text-to-video; image-to-video with first frame, last frame or both; reference generation with up to 9 images, 3 videos and 3 audio clips (12-file cap); "video regeneration" to 2K; 4-15 s; 768P or 2K. `POST /v2/video_generation`, poll `GET /v2/query/video_generation/{task_id}` (10 s interval recommended); "Cancel a queued task or delete a succeeded or failed task record." Seed, callback URL, watermark and URL expiry are not covered on the fetched guide. [DOC] (S30)
- Pricing per output second: H3 $0.13 (2K) / $0.08 (768P), input video billed at the same rate; H3-Highspeed $0.06 / $0.04 (768P/480P); H3-Lite $0.04 / $0.025; H3-Max $0.08 / $0.05; legacy Hailuo 2.3 per clip $0.28 (768P 6 s) to $0.56. [DOC] (S29)
- The guide calls H3 "an open, general-purpose multimodal video model". [DOC] (S30). **Open weights are confirmed**: `MiniMaxAI/MiniMax-H3` (33B) is published on Hugging Face under the "MiniMax H3 Community License Agreement" dated 2026-08-02; the open release is the 768p base model only, and the licence excludes the EU, UK, South Korea and the United States. [DOC] (S85, S86). Details in C.3.

### A.8 Shengshu — Vidu

- Models and prices (credits per second; 1 credit = 0.03125 RMB): Vidu Q4 Preview (reference-to-video and image-to-video, 3-16 s) 9 (540p) / 19 (720p) / 24 (1080p) / 38 (2K) / 78 (4K); viduq3-pro (I2V, T2V, first-last frame; 1-16 s) 20 at 720p with off-peak 10; viduq3-turbo 7-13; viduq3-mix (reference-to-video) 24-29; lip sync 20 credits per 5 s. Failed generations, including moderation rejections, are not charged. [DOC] (S31)
- Task API: base `https://api.vidu.com`; `Authorization: Token {key}`; `POST /ent/v2/tasks/{id}/cancel` (an example shows that a task in state "scheduled" cannot be cancelled; the cancellable states are not enumerated); `callback_url` with HMAC-SHA256 signed POST callbacks; callback retries not described. [DOC] (S32, S32b)
- Seed, output URL validity and terms were not retrieved. [UNKNOWN]

### A.9 PixVerse

- Official platform docs pages returned 404 on fetch; a search-indexed summary of the V6 docs page gives credits per second of 5 / 7 / 9 / 18 at 360p / 540p / 720p / 1080p without audio (7 / 9 / 12 / 23 with audio), 1-15 s, with text-to-video, image-to-video, reference ("fusion"), transitions, extension, native audio and multi-shot. [IND] (S34)
- Credit-to-USD conversion is reported inconsistently by third parties. [UNKNOWN]
- Platform Terms of Service (updated 2026-09-04): "it is prohibited to use the API for any commercial profit-making activities" without written authorisation (s.1.4); users may not integrate the API into third-party applications "for resale or sharing" (s.3.1); applicants must "submit necessary qualification certification documents" (s.1.1); the key must not be disclosed to any third party (s.2.4); AI identifiers must not be removed (s.3.3(8)); governing law is that of "the country where the platform is located". [DOC] (S33)
- Assessment: PixVerse first-party API is the most restrictive of the set for a third-party desktop product; treat as not qualified without written authorisation. [ASSUMED]

### A.10 Pika

- `pika.art/api` redirects to `dev.pika.art`, a first-party developer API with its own accounts, keys and prepaid billing (base `api.dev.pika.art`). The page's recommended catalogue is other vendors' models (video: Seedance 2.5, Gemini Omni 1.1 Flash, Wan 3.0, MiniMax H3; image: Seedream 5.0 Pro, Nano Banana Pro, GPT Image 2; plus speech, music, transcription and LLMs). Jobs are asynchronous with polling or signed webhooks; prices are quoted in micro-USD against a live catalogue; no free tier. [DOC] (S49)
- Pika-branded video models (2.2, Pikaframes, Pikascenes and so on) were, per earlier search results, offered through fal.ai as inference partner; this was not re-verified on a primary page. [IND] (S49-ind)

### A.11 Moonvalley — Marey

- ComfyUI's partner-node page is titled "(Deprecated)" and states "The Moonvalley API service is no longer available." [DOC] (S46)
- A single secondary source reports the research team joined another company in mid-2026; some aggregators still list Marey endpoints. [IND] (S46-ind). Treat as retired. [ASSUMED]

### A.12 Lightricks — LTX hosted API

- Models `ltx-2-5-fast`, `ltx-2-5-pro`, `ltx-2-3-fast`, `ltx-2-3-pro`. [DOC] (S39)
- LTX-2.5: text-to-video, image-to-video (with `last_frame_uri`), audio-to-video, native multi-shot, automatic duration (`duration: null`), `camera_motion` parameter, audio on by default (`generate_audio: false` to disable); 720p / 1080p / 1440p / 4K; 24, 25, 48, 50 fps; up to 20 s on fast at 720p/1080p and 24/25 fps, otherwise 10 s; retake and extend are **not** supported on 2.5 (they are on LTX-2.3 at 1080p). Seed and watermark not mentioned. [DOC] (S42, S40)
- Async: `POST /v2/{endpoint}` returns 202 and a job ID; poll `GET /v2/{endpoint}/{id}` no faster than every 5 s; statuses pending, processing, completed, failed. Job status is retained "up to 24 hours" after a terminal state; output URLs expire separately. Webhooks, cancellation and idempotency keys are not documented. [DOC] (S41)
- Pricing USD per second (T2V/I2V): ltx-2-5-fast 0.09 / 0.13 / 0.19 / 0.30 (720p / 1080p / 1440p / 4K); ltx-2-5-pro 0.12 / 0.17 / 0.25 / 0.39; ltx-2-3-fast 0.03 / 0.06 / 0.12 / 0.24; ltx-2-3-pro 0.04 / 0.08 / 0.16 / 0.32; retake and extend $0.10 per second; a live pricing endpoint exists at `https://api.ltx.video/pricing`. [DOC] (S39)
- LTX is the only frontier-class family here that is simultaneously a hosted API and (per vendor docs) open weights; see Part C. [DOC] (S44)

### A.13 Alibaba — Wan (hosted)

- `wan3.0-video` and `wan3.0-video-prime`: text, image, video and audio inputs; text-to-video, image-to-video (first frame and first+last frame), reference-based generation; up to 30 s; 480P/720P/1080P; CNY per second 0.3 / 0.6 / 1.2 in Beijing and the "Global" (Tokyo, Frankfurt, Virginia) deployment, 0.37471 / 0.74942 / 1.49884 in Singapore (International). [DOC] (S35)
- Earlier hosted generations on the same service: wan2.7 (`wan2.7-t2v`, 2-15 s, 720P/1080P), wan2.6, wan2.5 preview, wan2.2 plus, wan2.1. [DOC] (S36)
- Async protocol (documented for 2.7 and earlier; assumed similar for 3.0 [ASSUMED]): header `X-DashScope-Async: enable` is mandatory; create then poll `GET /api/v1/tasks/{task_id}` about every 15 s; statuses PENDING, RUNNING, SUCCEEDED, FAILED, CANCELED, UNKNOWN; `task_id` and `video_url` are each valid for 24 hours; no cancel endpoint and no webhook are documented on the page. [DOC] (S36)
- Parameters: `seed` 0-2147483647 ("a fixed seed aids reproducibility but doesn't guarantee identical output"); `watermark` boolean default false (adds an "AI Generated" label); `prompt_extend` default true (LLM prompt rewriting, which itself defeats reproducibility unless disabled); `audio_url` for supplied audio, otherwise automatic audio on 2.5+. [DOC] (S36)
- Endpoints are workspace- and region-specific (`{WorkspaceId}.{region}.maas.aliyuncs.com`), and model availability differs by region. [DOC] (S36)
- Wan 3.0 has no published open weights according to secondary reports; the open line is covered in Part C. [IND] (S35-ind)

### A.14 xAI — Grok Imagine Video

- Models `grok-imagine-video-1.5` (aliases `-preview`, `-2026-05-30`) and `grok-imagine-video-1.5-lite`; older `grok-imagine-video`. [DOC] (S37, S38)
- Endpoints: `POST https://api.x.ai/v1/videos/generations`, `/v1/videos/edits`, `/v1/videos/extensions`; poll `GET /v1/videos/{request_id}`; statuses pending, done, failed. Cancel, webhooks and seed are not mentioned. [DOC] (S38)
- Operations: text-to-video; image-to-video; reference-to-video (reference images, and on 1.5 voice references for up to 3 speakers); first/last frame pinning and up to 4 timestamped keyframes; video editing and extension (documented for the older `grok-imagine-video`). Duration 1-15 s (default 8); 480p default, 720p, 1080p (native on 1.5 for T2V/I2V; reference-to-video capped at 720p; edits capped at 720p and 8.7 s); nine aspect ratios; audio on by default with lip-synced speech. [DOC] (S38)
- Output delivered as "temporary URLs" (expiry not stated); moderation failures return `invalid_argument`. [DOC] (S38)
- Price: "$0.080 per second" on the model page (resolution breakdown not shown there); 10 requests/s; US regions; Batch API supported. [DOC] (S37). A search-indexed summary gave $0.08 / $0.14 / $0.25 per second for 480p/720p/1080p. [IND] (S37-ind)

### A.15 Midjourney

- Midjourney documentation and terms pages returned HTTP 403 to automated fetch; nothing below is [DOC].
- No official public API was available as of late September 2026; the terms and community guidelines prohibit automation and unauthorised third-party clients; third-party "Midjourney API" wrappers operate against those terms. [IND] (S45-note)
- Image models V8 (alpha 2026-03-17), V8.1 (default 2026-04-30), V8.2 reported later; video: the V1 video model animates images in 5 s clips extendable four times to 21 s, with loop and SD/HD modes; a newer V8-era video pipeline is described inconsistently by secondary sources. [IND] (S45-note)
- Assessment: Midjourney cannot be a qualified provider in a product that only calls providers lawfully with customer credentials; support at most "import a file the customer exported from Midjourney". [ASSUMED]

### A.16 Other frontier or adjacent hosted models (not researched to the same depth)

- HappyHorse 1.0 / 1.1 (attributed to an Alibaba unit): top-ranked on the no-audio arena board in one snapshot; hosted on Alibaba's Bailian platform and resellers; reseller listings claim an Apache-2.0 open release with weights on GitHub, about 15B parameters, but other secondary sources say the Hugging Face release was incomplete. [IND] (S47, S48). Open-weight status: [UNKNOWN].
- Higgsfield and DreamBench are named by BytePlus as Seedance 2.5 distribution partners; they are application-layer products rather than model vendors. [CLAIM] (S9)
- Amazon Nova Reel reached end of life on 2026-09-30 and is no longer available on Bedrock. [DOC] (S68)
- Black Forest Labs now has a hosted video line: "FLUX 3 video" (text-to-video, image-to-video, video-to-video, billed per second by resolution tier), "FLUX 3 Max" (served and billed through fal), "FLUX Video Edit" and "FLUX Video Upscale". Numeric prices were not present in the fetched text. [DOC] (S106, S107). Not researched further.
- Ideogram's API also resells third-party video (Kling, MiniMax H3, Seedance 2.0 / 2.5). [DOC] (S121)
- Adobe Firefly video, Tencent Hunyuan hosted video, Hedra, Decart, HeyGen and Krea realtime were not researched (search budget exhausted). [UNKNOWN]

### A.17 Cross-vendor job-semantics table (first-party APIs)

| Vendor | Create / poll | Webhook | Cancel | Client correlation / idempotency | Seed | Output retention | Charged when moderated? |
|---|---|---|---|---|---|---|---|
| Gemini Omni | Interactions API; sync, SSE or Files polling [DOC] (S5) | not mentioned | not mentioned | not mentioned | not mentioned | not stated | [UNKNOWN] |
| Vertex Veo 3.1 | long-running operation [ASSUMED] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | not on model page | [UNKNOWN] | [UNKNOWN] |
| Seedance (Volcengine) | task + poll [DOC] (S11a) | `callback_url`, 3 retries | queued only; running cannot be cancelled [DOC] (S11c) | not documented | 1.0 pro only; not 2.0/2.5 | task ID 7 days; URL validity not stated | "only successfully generated videos are billed" [DOC] (S11d) |
| Kling | task + poll [DOC] (S13) | signed `callback_url` | none documented | `external_task_id` unique per account | none documented (4.0) | 30 days | [UNKNOWN] |
| Runway | task + poll [DOC] (S23) | not documented | `DELETE /v1/tasks/{id}` | not documented | optional on some models, up to 2^32-1 | URLs 24-48 h | **Yes, charged** [DOC] (S23) |
| Luma | generation + poll [DOC] (S26) | not mentioned | deletion page exists; cancel semantics not fetched | not mentioned | not mentioned | presigned URL 1 hour | refunded [DOC] (S27) |
| MiniMax H3 | task + poll [DOC] (S30) | not on fetched page | queued only | not mentioned | not mentioned | not stated | [UNKNOWN] |
| Vidu | task + poll [DOC] (S32) | signed `callback_url` | `POST .../cancel`, state-dependent | not mentioned | [UNKNOWN] | [UNKNOWN] | not charged [DOC] (S31) |
| LTX | job + poll (>= 5 s) [DOC] (S41) | not documented | not documented | not documented | not mentioned | status 24 h; URLs expire separately | [UNKNOWN] |
| Wan (Model Studio) | async header + poll [DOC] (S36) | not documented | status exists, endpoint not documented | "don't create duplicate tasks" (no key) | yes, not guaranteed identical | task ID and URL 24 h | [UNKNOWN] |
| xAI | request + poll [DOC] (S38) | not mentioned | not mentioned | not mentioned | not mentioned | "temporary URLs" | [UNKNOWN] |
| Pika dev API | job + poll or signed webhook [DOC] (S49) | yes | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |

---

## PART B — Aggregators, routers and cloud marketplaces

All of Part B was researched by direct fetch only (no search). Catalogue lists are what the fetched page showed on 2026-11-11; absence from a fetched page is reported as "not shown", not as "not offered".

### B.0 Summary table

| Aggregator | Frontier video models shown on the fetched catalogue | Uniform schema across models? | Price transparency | Job model | Cancel | Output retention | Key ToS point for a desktop app using the customer's own key |
|---|---|---|---|---|---|---|---|
| fal.ai | Kling 4.0 / v3 Pro / 2.5 Turbo, "Seedance 2.5 US", Seedance 2.0 Fast, MiniMax H3 / H3 Max, Wan 3.0 Prime, PixVerse V6 Max, LTX-2.5 Fast, Grok Imagine 1.5; nav also names Veo 3.1, Gemini Omni, LTX 2.3, Happy Horse 1.1 [DOC] (S53) | No. Uniform *queue* envelope, per-model input schema [DOC] (S51) | Pricing API per model [DOC] (S50); explore page shows no prices | queue submit, status, SSE stream, `fal_webhook` [DOC] (S51) | `cancel_url`; queued removed, running gets a signal and "the model app decides how to stop" [DOC] (S51) | controllable per request via `X-Fal-Object-Lifecycle-Preference` [DOC] (S51) | "You may not share or permit others to use your individual account credentials"; client "will not expose any of the Services APIs directly to any End Users" [DOC] (S52) |
| Replicate | Veo 3.1 family, Gemini Omni 1.2 Flash, Kling v4.0 / v4 Flash / v3 / v3 Omni / O1, Seedance 2.0 / 2.0 Fast / 1.5 Pro, Wan 3 / 2.7 / 2.5, HappyHorse 1.0 / 1.1, MiniMax H3, Grok Imagine Video 1.5, PixVerse V6 Max, Runway Gen-4.5, Luma Ray 3.2, Vidu Q3, plus open models [DOC] (S56) | No. Uniform *prediction* envelope, per-model input schema [ASSUMED] from the model-page design | per-model page (not fetched per model) | prediction + poll or webhook [DOC] (S54) | cancel supported; cancelled runs billed for time used; `aborted` not billed [DOC] (S54) | API inputs, outputs, files and logs removed after **1 hour** by default [DOC] (S55) | credentials limited to the specific authorised user; no "service bureau, software as a service" re-provision; rights are "non-sublicensable" [DOC] (S57) |
| OpenRouter | Seedance 2.5 / 2.0 family, Veo 3.1 family, Kling v3.0 Pro/Std and O1, Runway Aleph 2 and Gen-4.5, Wan 3.0 / 3.0 Prime / 2.7 / 2.6, HappyHorse 1.0 / 1.1, Hailuo 3 / 3 Max, Grok Imagine Video 1.5, "flux-3-video", HeyGen [DOC] (S58) | **Partly yes**: normalised `model, prompt, duration, resolution, aspect_ratio, generate_audio`; everything else through `provider.options` passthrough [DOC] (S58) | `GET /api/v1/videos/models` returns `pricing_skus`, but "Pricing SKU units can differ by provider" [DOC] (S58) | `POST /api/v1/videos`, poll `polling_url`, signed webhooks [DOC] (S58) | status `cancelled` exists; no cancel endpoint described [DOC] (S58) | status `expired` exists; period not stated | BYOK is a workspace feature for provider keys (5 % fee after an included monthly allowance); video BYOK not confirmed; video endpoints are "treated as retaining data" [DOC] (S59) |
| Runware | 469 hosted models; IDs seen include `klingai:kling-video@3-4k`, `minimax:h3@0`, Wan 3.0 [DOC] (S60) | Uniform *task* envelope (`videoInference`) plus **machine-readable JSON Schema per model** at `/docs/models/<model>/schema.json` [DOC] (S60) | price in schema `info["x-pricing"]`; `includeCost: true` returns the charge per task [DOC] (S60) | sync (up to 120 s) or `deliveryMethod: "async"` + `getResponse`; `webhookURL` with retries [DOC] (S60) | not described | output URLs 7 days by default (`ttl`) [DOC] (S60) | terms not fetched [UNKNOWN] |
| Vercel AI Gateway | Veo 3.1 / 3.0, Kling v3.0, Wan v2.5 / v2.6 / 3.0, Seedance 2.5, Grok Imagine Video, MiniMax H3 named in docs and changelog [DOC] (S69) | **Most uniform seen**: `prompt, duration, aspectRatio, resolution, generateAudio, frameImages, inputReferences`, with documented per-provider fallbacks [DOC] (S69) | models page (not fetched); BYOK "no added markup" [DOC] (S70) | single long request, or `poll`, or `startVideo` / `getVideoStatus`, plus signed webhooks [DOC] (S69) | webhook event `video.generation.cancelled` exists; no cancel call documented on the fetched page | `result.expiresAt` reported per job [DOC] (S69) | BYOK needs the paid tier and purchased credits; BYOK credential shapes documented only for Anthropic, OpenAI, Azure, Vertex AI and Bedrock [DOC] (S70) |
| Together AI | page names `minimax/video-01-director`, `minimax/hailuo-02` only (full list elsewhere) [DOC] (S65) | SDK-level `videos.create` / `videos.retrieve` | `outputs.cost` returned per job [DOC] (S65) | create + retrieve; statuses queued, in_progress, completed, failed, cancelled | no cancel method documented | URLs expire, period not stated | terms not fetched [UNKNOWN] |
| DeepInfra | Seedance 2.0 and 1.5 Pro, LTX-2.5 Fast/Pro, LTX-2.3 Fast/Pro, PixVerse 6, p-video, FastWan [DOC] (S66) | [UNKNOWN] | **prices on the list page** (per second or per 1M tokens) [DOC] (S66) | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | terms not fetched [UNKNOWN] |
| WaveSpeedAI | Kling, Veo, Luma, Seedance, MiniMax, Wan 3.0 named [DOC] (S72) | Uniform submit/result envelope, per-model body [DOC] (S72) | separate pricing pages (not fetched) | `POST /api/v3/{model-path}`, `GET /api/v3/predictions/{id}/result`; webhooks documented on separate pages [DOC] (S72) | "Delete Task" endpoint exists; whether it cancels a running task is not stated | outputs "generally expire within 7 days" [DOC] (S72) | terms pages exist, not fetched [UNKNOWN] |
| Hugging Face Inference Providers | open models only on the text-to-video task page (Wan2.2-TI2V-5B via fal-ai, WaveSpeed provider) [DOC] (S61) | Uniform task parameters (`num_frames`, `guidance_scale`, `negative_prompt`, `num_inference_steps`, `seed`) [DOC] (S61) | provider pass-through, "no markup from Hugging Face" [DOC] (S62) | synchronous; returns raw video bytes [DOC] (S61) | none | n/a (bytes returned) | "Custom Provider Key" mode: billed directly by the provider [DOC] (S62) |
| ComfyUI partner nodes | BFL FLUX 3 video, Seedance 2.0, Veo 3.1 Lite, Gemini Omni Flash 1.1, HappyHorse 1.0, Kling v3, LTX-2.5 Fast, Luma Ray 3.2, MiniMax H3 Max, PixVerse V6, Runway gen4_turbo, Vidu Q4 preview, Wan 2.5, Grok Imagine Video, Higgsfield motion transfer and more [DOC] (S64) | No. One node type per vendor/model | credits per second or per run, per node; no general credit-to-USD rate on the page [DOC] (S64) | runs inside a ComfyUI graph | graph interrupt [ASSUMED] | n/a | **"Bring your own provider keys: Not currently supported"**; needs a Comfy account and prepaid Comfy credits [DOC] (S63) |
| Amazon Bedrock | **None current.** Nova Reel reached end of life 2026-09-30; Luma **Ray2** is the only video-generation model on the "models at a glance" table [DOC] (S67, S68) | n/a | AWS pricing page | `StartAsyncInvoke` to the customer's S3 bucket [DOC] (S68) | [UNKNOWN] | customer's own S3 | customer's own AWS credentials; standard AWS terms [ASSUMED] |
| Azure AI Foundry | Sora 2 documented as "(preview)" on a page last updated 2026-06-05; live status after OpenAI's 2026-09-24 API removal not confirmed [DOC] (S71), [UNKNOWN] | OpenAI-compatible video jobs | per-second billing page (not fetched) | job + poll (`queued, preprocessing, running, processing, succeeded`) [DOC] (S71) | [UNKNOWN] | [UNKNOWN] | customer's own Azure resource [ASSUMED] |
| Google Vertex Model Garden | the fetched overview names no third-party video or image generation model; first-party Veo is covered in A.2 [DOC] (S75) | n/a | n/a | n/a | n/a | n/a | customer's own Google Cloud project [ASSUMED] |
| AIMLAPI | fetched page shows MiniMax `video-01` only; a full list exists but was not in the fetched content [DOC] (S73) | per-vendor endpoint paths (`/v2/generate/video/<vendor>/generation`) [DOC] (S73) | not on the fetched page | create returns `generation_id`; `GET` with `generation_id` [DOC] (S73) | not mentioned | not mentioned | terms not fetched [UNKNOWN] |
| Segmind | Seedance 2.0 shown as the example; catalogue in a gallery not fetched [DOC] (S74) | per-model path under `https://api.segmind.com/v1/` [DOC] (S74) | "billing units", not defined on the fetched page | sync example; "Async inference & webhooks" listed as a feature [DOC] (S74) | [UNKNOWN] | [UNKNOWN] | terms not fetched [UNKNOWN] |
| Novita | docs index returned HTTP 404 on the redirected URL; **not fetched** | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| Runway API (as reseller) | Kling, Seedance, Wan, Veo, Gemini Omni, Hailuo/H3, Grok Imagine, HappyHorse through one Runway key [DOC] (S21, S23) | Runway task envelope, per-model body | credits per second per model [DOC] (S21) | see A.5 / A.17 | `DELETE /v1/tasks/{id}` | 24-48 h | "Powered by Runway" display requirement reported [IND] (S25) |
| Pika developer API (as reseller) | Seedance 2.5, Gemini Omni 1.1 Flash, Wan 3.0, MiniMax H3 [DOC] (S49) | [UNKNOWN] | micro-USD quotes | job + poll or signed webhook | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |

### B.1 fal.ai

- Queue API: `POST https://queue.fal.run/{owner}/{app}` with `Authorization: Key $FAL_KEY`; response returns `request_id`, `status_url`, `response_url`, `cancel_url`, `queue_position`. Statuses are `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`; failed and cancelled requests also surface as `COMPLETED`, so the adapter must read the result payload to distinguish success from failure. [DOC] (S51)
- Webhook: `fal_webhook` query parameter; payload format, retries and signature are on a separate page that was not fetched. [DOC] (S51)
- Request headers of interest: `X-Fal-Queue-Priority`, `X-Fal-Request-Start-Timeout`, `X-Fal-No-Retry`, `X-Fal-Object-Lifecycle-Preference` (for example `{"expiration_duration_seconds": 86400}`). [DOC] (S51)
- Idempotency keys are not documented; platform-side automatic retries exist and can be disabled with `X-Fal-No-Retry`. [DOC] (S51)
- A model pricing API and a "delete request payloads" API are listed in the docs index. [DOC] (S50)
- Terms (last updated 2026-09-08): a customer may "allow End Users to access and use the Services through the Customer Solution" but must not expose the APIs directly to End Users; credentials must not be shared; no resale or sublicensing; fal does not claim IP in Output Content; third-party materials "may be subject to additional terms". [DOC] (S52)
- Reading for this product: an end customer who creates their own fal account and pastes their own key into a desktop application is the "Client" using their own credentials, which is a different fact pattern from a developer sharing one key or proxying fal to end users. The terms do not explicitly bless or forbid a third-party desktop client acting as the customer's local tool. [ASSUMED]; requires legal confirmation.
- A geo-specific listing ("Seedance 2.5 US") indicates regional variants of the same model family with separate endpoints. [DOC] (S53); the meaning of "US" (US-hosted inference versus US-eligible terms) is [UNKNOWN].

### B.2 Replicate

- Prediction statuses: `starting`, `processing`, `succeeded`, `failed`, `canceled`, `aborted`; 30-minute run limit; optional deadline. Cancelled predictions are billed for the time they ran; aborted ones are not. [DOC] (S54)
- Data retention: for API-created predictions, inputs, outputs, files and logs are "automatically removed after one hour by default". The application must download outputs immediately. [DOC] (S55)
- No `openai/sora-*` model appears in the text-to-video collection; Seedance 2.5 was not shown either. [DOC] (S56)
- Terms (last update 2026-04-01): outputs are assigned to the customer "subject to any Third Party Terms"; the customer must comply with the model licence referenced on each model page; additional terms apply to Stability AI models (direct licence required), FLUX models (Flux Model API Agreement) and Ideogram models. [DOC] (S57)
- Consequence: on Replicate the effective licence of an output is the union of Replicate's terms and each model's own licence. A per-model licence field is mandatory in the registry. [ASSUMED]

### B.3 OpenRouter (video API)

- OpenRouter now exposes a dedicated asynchronous video API: `POST /api/v1/videos`, poll the returned `polling_url` (about every 30 s recommended), download with `GET /api/v1/videos/{id}/content?index=0`. Statuses: `pending`, `in_progress`, `completed`, `failed`, `cancelled`, `expired`. [DOC] (S58)
- Capability discovery: `GET /api/v1/videos/models` returns `supported_durations`, `supported_resolutions`, `supported_aspect_ratios`, `supported_frame_images`, `allowed_passthrough_parameters`, `pricing_skus`. This is the closest thing found to a machine-readable cross-vendor capability catalogue, together with Runware's per-model JSON Schema. [DOC] (S58, S60)
- Provider-specific controls travel in `provider.options` keyed by provider slug; "Only the options for the matched provider are forwarded". Seeds are not part of the normalised field set. [DOC] (S58)
- BYOK: provider keys are stored in the OpenRouter workspace; fee is 5 % of the equivalent OpenRouter cost after an included monthly allowance; named BYOK providers are text-model clouds (OpenAI, Azure, Bedrock, Vertex AI, Anthropic, Fireworks). Whether BYOK applies to video providers is not stated. [DOC] (S59)
- Privacy note: video endpoints are "treated as retaining data", and the zero-data-retention guardrail blocks video models. [DOC] (S59)

### B.4 Runware

- One endpoint, array-of-tasks request; `videoInference` task type; results via `getResponse` polling by `taskUUID` or `webhookURL` (retries with backoff; deduplicate on `taskUUID`). [DOC] (S60)
- Synchronous mode waits up to 120 s, and re-sending the request creates a second billed generation. For video the adapter must always use async delivery. [DOC] (S60)
- Failed generations are not charged; `includeCost: true` returns the actual charge. [DOC] (S60)
- Cancellation is not described. [DOC] (S60)

### B.5 Vercel AI Gateway

- Video generation is exposed through AI SDK functions (`experimental_generateVideo`, `experimental_startVideo`, `experimental_getVideoStatus`), flagged experimental. [DOC] (S69)
- It documents concrete cross-provider divergences, which are useful as independent confirmation of non-uniform semantics: it states that Veo, KlingAI and Seedance honour `last_frame` while Grok Imagine Video and Wan ignore it with a warning; that Wan and Seedance 2.5 accept video references while Veo, KlingAI and Grok Imagine Video accept image references only; reference tokens in the prompt differ per provider (`character1` for Wan, `<IMAGE_1>` for Grok, `[Image 1]` for Seedance; none for Kling and Veo). [DOC] (S69)
- It is the only surveyed gateway that documents an **idempotency key** for video start requests (the SDK sends a stable `idempotency-key` header on the start request, and the gateway "deduplicates on it"). [DOC] (S69)
- Webhooks are HMAC-SHA256 signed (`x-ai-gateway-signature`, `t=...,v1=...`), carry no URLs or bytes, and retries share an `x-ai-gateway-idempotency-key`. [DOC] (S69)
- BYOK: "no added markup", but only on the paid tier with purchased credits, and failed BYOK requests fall back to Vercel system credentials billed to the team. That fallback conflicts with a strict "only the customer's own provider credentials" rule unless it can be disabled; the fetched page says a provider restriction "doesn't disable fallback". [DOC] (S70)
- The gateway is designed for server-side use with a Vercel team; suitability for a local desktop application is [ASSUMED] poor (webhooks need a public receiver; the SDK targets Node/serverless).

### B.6 Hugging Face Inference Providers

- Routes a uniform task API to third-party providers; for text-to-video only open models were shown. Frontier closed models are not routed. [DOC] (S61)
- Two billing modes: routed by Hugging Face (billed to the HF account, no markup) or "Custom Provider Key" (billed by the provider). PRO accounts receive $2.00 of monthly credits; free users must purchase credits. [DOC] (S62)
- The text-to-video task is synchronous and returns bytes, which is fragile for long generations. [ASSUMED]

### B.7 ComfyUI partner nodes (and ComfyUI as a local runtime)

- Partner nodes are optional API nodes inside ComfyUI that call hosted models. They require a Comfy account login and prepaid Comfy credits; bring-your-own provider keys is "Not currently supported". Flags `--disable-partner-nodes` and `--offline` exist. [DOC] (S63)
- Consequence: if this product embeds or drives ComfyUI as its local runtime, partner nodes must be disabled or clearly separated, because they are a paid path that does not use the customer's own provider credentials. [ASSUMED]
- The partner-node price list doubles as a current catalogue of what is commercially live in late 2026 (see B.0 row). The page notes that some listed models are deprecated or retired and several prices are approximate. [DOC] (S64)

### B.8 Hyperscaler marketplaces

- **Amazon Bedrock**: Nova Reel (`amazon.nova-reel-v1:0`) "reached end of life on September 30, 2026 and is no longer available". The only video generator on the current model table is Luma Ray2 (two generations behind Luma's own API). Image generation: Nova Canvas and the Stability AI family (Stable Image Ultra/Core, SD 3.5 Large and editing tools). [DOC] (S67, S68)
- **Azure AI Foundry**: the Sora 2 page is still published as preview documentation; supported sizes listed include 720x1280 and 1280x720 with 4/8/12 s durations, and content rules include "Only content suitable for audiences under 18" and rejection of copyrighted characters and music. [DOC] (S71). Whether the deployment still works after OpenAI's own removal is [UNKNOWN]; a secondary report in A.1 says it ended in mid-October 2026 [IND] (S1-ind).
- **Google Vertex AI**: first-party Veo 3.1 only (A.2). The Model Garden overview fetched names no partner video or image generators. [DOC] (S75)
- Net: hyperscaler marketplaces are **not** a viable route to frontier video models in late 2026, except Veo on Vertex. [ASSUMED] from the above.

### B.9 Observations that matter for the adapter design

1. Every aggregator normalises the **job envelope** (submit, status, result, sometimes webhook); none normalises the **model parameters** beyond prompt, duration, resolution, aspect ratio and audio on/off. [DOC] (S51, S58, S60, S69)
2. Machine-readable capability data exists at OpenRouter (`/videos/models`) and Runware (per-model JSON Schema with pricing). Both could seed a capability registry, but both describe the aggregator's view, not the vendor's. [DOC] (S58, S60)
3. Retention windows are short and inconsistent (1 hour at Replicate and Luma, 24 hours at Wan, 7 days at Runware and WaveSpeed, 30 days at Kling). A local-first application must download every output immediately on completion and never store a provider URL as the asset reference. [DOC] (S55, S60, S72); [ASSUMED] for the design rule.
4. Idempotency is essentially absent. Only Vercel AI Gateway documents an idempotency key; Kling offers a unique `external_task_id`; Runware and Alibaba explicitly warn that re-sending creates a duplicate billed job. The job system must therefore persist the provider job ID before any retry and must never auto-retry a submit after an ambiguous network failure. [DOC] (S13, S36, S60, S69); [ASSUMED] for the design rule.
5. Aggregators frequently lag or differ from first-party versions (Replicate showed no Seedance 2.5; Bedrock has Luma Ray2 only; fal lists a "US" Seedance variant). Model identity must be recorded as (host, model slug, version), not just a family name. [DOC] (S53, S56, S67)
6. Terms differ on credential use. For the "customer supplies their own key" pattern the application developer is not the contracting party, but several terms restrict credential sharing and re-exposure of the API (fal, Replicate), and one path (ComfyUI partner nodes) cannot use customer provider keys at all. [DOC] (S52, S57, S63)

---

## PART C — Open-weight video models for local inference

All of Part C was researched by direct fetch of repositories, model cards, licence files and ComfyUI documentation (no search). Three caveats apply to the whole part:

1. **Official timing data for 8, 12 and 16 GB GPUs essentially does not exist.** Vendors publish figures for RTX 4090 / data-centre cards. Every 8-16 GB timing below is therefore either [UNKNOWN] or an [ASSUMED] extrapolation and must be replaced by in-house measurements on the qualification hardware before any customer-facing claim is made.
2. Low-VRAM operation in late 2026 comes from **community packaging** (int8 "convrot", fp8-scaled, NVFP4, GGUF quantisations; 4/8-step distillation LoRAs; block offloading to system RAM), not from the reference repositories. The reference repositories mostly target Linux and 24-80 GB cards. [DOC] (S76, S88, S91)
3. Download sizes are given as [DOC] where a page stated them. Otherwise they are [ASSUMED] from parameter count (about 2 bytes per parameter for fp16/bf16, about 1 byte for fp8/int8, about 0.5-0.6 byte for 4-bit GGUF/NVFP4), plus text encoder and VAE.

### C.0 Summary table

| Model (weights) | Licence of weights | Commercial use | Parameters | Lowest documented VRAM | Reference timing (documented) | Windows route | Evidence |
|---|---|---|---|---|---|---|---|
| Wan 2.1 T2V-1.3B | Apache-2.0 | Yes | 1.3B | 8.19 GB | 5 s 480p in about 4 min on RTX 4090, no optimisation | ComfyUI, WanGP, stable-diffusion.cpp | [DOC] (S81) |
| Wan 2.1 14B family (T2V, I2V 480p/720p, FLF2V, VACE 1.3B/14B) | Apache-2.0 | Yes | 14B (VACE also 1.3B) | not extractable (table is an image) | not extractable | same | [DOC] (S81) |
| Wan 2.2 TI2V-5B | Apache-2.0 | Yes | 5B | "should fit well on 8GB vram" with ComfyUI native offloading; README says at least 24 GB for the reference script | 5 s 720p/24 fps in under 9 min on one consumer GPU | ComfyUI, WanGP, stable-diffusion.cpp | [DOC] (S76, S77) |
| Wan 2.2 T2V-A14B / I2V-A14B | Apache-2.0 | Yes | two 14B experts (27B total; one active at a time) | README: reference command needs "at least 80GB VRAM" without offload; community fp8/GGUF + 4-step LoRA lower this ([UNKNOWN] figure) | not extractable | same | [DOC] (S76, S77) |
| Wan 2.2 S2V-14B, Animate-14B; Wan2.2-Animate-2-14B (2026-08-07, plus distilled 10-step); Wan-Dancer-14B | Apache-2.0 (S2V, Animate, Animate-2 confirmed; Dancer not checked) | Yes | 14B | Animate-2 defaults tuned for 8x A800 at 720p; no single-GPU figure | none | ComfyUI native tutorials | [DOC] (S76, S78, S79, S80) |
| LTX-2.5 (and legacy LTX-2.3) | "LTX-2.x Community License Agreement" (code Apache-2.0) | Free under USD 10M annual revenue (entity incl. affiliates); paid agreement above | 22B | **official minimum 32 GB VRAM**; int8 (ComfyUI), NVFP4 (Blackwell GPUs), `fp8-cast` + offload, community GGUF | none | ComfyUI (ComfyUI-LTXVideo and native), WanGP, stable-diffusion.cpp; `ltx-pipelines` runs on Windows with one Linux-only extra skipped | [DOC] (S43, S88, S89, S90) |
| MiniMax H3 (open base) | "MiniMax H3 Community License Agreement" (2026-08-02) | Yes below USD 20M yearly product revenue, **but not in the EU, UK, South Korea or USA**; UI must display "MiniMax H3" | 33B (about 13B skippable at inference; pruned 20B community builds) | not stated (card examples use 4 GPUs) | none | ComfyUI native, WanGP, stable-diffusion.cpp, LightX2V | [DOC] (S85, S86, S87) |
| HunyuanVideo 1.5 | "Tencent Hunyuan Community License Agreement" (2025-11-21) | Yes, **but territory excludes the EU, UK and South Korea**; separate licence above 100M MAU | 8.3B | 14 GB with model offloading | step-distilled 480p I2V "within 75 seconds" on RTX 4090 | ComfyUI, WanGP, LightX2V (README lists Linux only) | [DOC] (S91, S92, S93) |
| FramePack / FramePack-F1 (image-to-video on HunyuanVideo) | Apache-2.0 (code); underlying "13B" model licence not restated | see note C.5 | 13B | **6 GB** | RTX 4090 2.5 s/frame (1.5 with TeaCache); laptop 3070 Ti / 3060 "about 4x to 8x slower" | Windows one-click package | [DOC] (S95) |
| CogVideoX-2B / 5B / 1.5-5B | 2B Apache-2.0; 5B "CogVideoX License"; 1.5 not stated | 2B yes; 5B and 1.5 [UNKNOWN] | 2B / 5B | 3.6-4 GB (2B), 4.4-5 GB (5B), 7-10 GB (1.5-5B) with diffusers optimisations | data-centre only: 5B 5 s clip about 90 s (A100); 1.5-5B about 1000 s (A100) | diffusers, ComfyUI | [DOC] (S100) |
| Mochi 1 | Apache-2.0 | Yes | 10B | about 60 GB reference; "less than 20GB" in ComfyUI | none | ComfyUI | [DOC] (S102) |
| MAGI-1 4.5B / 24B, MAGI-1.1 24B (2026-06-17) | Apache-2.0 | Yes | 4.5B / 24B | 4.5B: 24 GB; 12 GB with distill + fp8 and `window_size=1`; 24B: 8x H100 or 8x RTX 4090 | none | not stated | [DOC] (S103) |
| SkyReels-V3 (R2V 14B, video extension 14B, talking avatar 19B; 2026-01-29) | "skywork-license" (text not fetched) | [UNKNOWN] | 14B / 19B | `--low_vram` suggested "under 24GB" at 480p/540p | none | not stated | [DOC] (S101) |
| LongCat-Video (+ Avatar 1.5, 2026-05-21) | MIT | Yes | 13.6B | not stated | "within minutes" for 720p/30 fps | WanGP | [DOC] (S104) |
| Self-Forcing (on Wan 2.1 T2V-1.3B) | Apache-2.0 | Yes | 1.3B | 24 GB VRAM, 64 GB RAM, Linux | real-time streaming on RTX 4090 | ComfyUI "Causal Forcing" tutorial for Wan 2.1 exists | [DOC] (S98, S83) |

### C.1 Wan (Alibaba) open line

- The open line stops at **Wan 2.2** plus derivatives. The official repository and Hugging Face organisation show no open Wan 2.5, 2.6, 2.7 or 3.0 weights; those generations are hosted-only (A.13). [DOC] (S76, S78). A Hugging Face repository named `wanvideo/wan-3-0-video` (36 downloads) is not under the official `Wan-AI` organisation and must be treated as unofficial. [DOC] (S99) for its existence; provenance [UNKNOWN].
- Wan 2.2 variants: T2V-A14B and I2V-A14B (mixture of two 14B experts for high-noise and low-noise stages, 480p and 720p); TI2V-5B (dense 5B, text- and image-to-video, 720p at 24 fps); S2V-14B (speech/audio-driven video); Animate-14B (character animation and replacement). Runtimes named by the repository: ComfyUI, Diffusers, DiffSynth-Studio, Kijai's ComfyUI-WanVideoWrapper. No Windows notes in the README. [DOC] (S76)
- Wan-Animate-2 (weights 2026-08-07): animates a reference character directly from a driving video without a separate pose-extraction model, adds text-driven viewpoint control and prompt-described backgrounds; base and 10-step distilled checkpoints; ComfyUI ships int8-convrot builds and runs 81 frames per iteration (about 3.4 s at 24 fps) with a looping subgraph (needs ComfyUI 0.36.0+). A "Lite" real-time variant is described but its weights are not listed. [DOC] (S79, S80)
- Wan 2.1 remains the base for the control ecosystem: VACE (reference-to-video, video-to-video editing, masked video-to-video), FLF2V-14B (first/last frame, 720p), and, per ComfyUI's tutorial index, Fun Control / Fun Camera / Fun InP, InfiniteTalk lip-sync, Causal Forcing (1-4 step), Wan-Move, Wan-Alpha (alpha-channel video) and ATI. [DOC] (S81, S83). Licences of the third-party derivatives (Fun, InfiniteTalk, Wan-Move and others) were not checked individually. [UNKNOWN]
- Distillation: the LightX2V project publishes 4-step LoRAs/checkpoints (for example `Wan2.2-T2V-A14B-4steps-lora-rank64-V1`, Wan2.2 I2V A14B 4-step 720p) and quantised builds (INT8/FP8, NVFP4, GGUF), and ships a Windows deployment guide. [DOC] (S77, S97). Its ">50x" speed-up figure for "Wan2.2 NVFP4 4-NFE" on an RTX 5090 is a project claim. [CLAIM] (S97)
- Community GGUF sizes for Wan 2.2 TI2V-5B: Q2_K 1.85 GB, Q4_K_M 3.43 GB, Q6_K 4.21 GB, Q8_0 5.4 GB (transformer only; text encoder and VAE extra). [IND] (S82)
- ComfyUI's native files: `wan2.2_ti2v_5B_fp16`, `wan2.2_vae`, `umt5_xxl_fp8_e4m3fn_scaled`, and for 14B `wan2.2_t2v_high_noise_14B_fp8_scaled` / `..._low_noise_...`. [DOC] (S77). Estimated sizes: 5B fp16 about 10 GB; each 14B fp8 expert about 14 GB (two needed); text encoder about 5-7 GB. [ASSUMED]

### C.2 LTX-2.5 / LTX-2.3 (Lightricks)

- LTX-2.5 is the recommended open model; LTX-2.3 is "legacy" and its files are not interchangeable. 22B DiT with joint audio; Gemma 4 12B text encoder (LTX-2.3 used a Gemma 3 encoder under Google's own licence terms); components: dev transformer (bf16), distilled transformer, video VAE (diffusion decoder or lighter convolutional decoder), audio VAE, x2 spatial and temporal upscalers, distilled LoRA, IC-LoRAs (detailing, HDR and others), duration head. [DOC] (S88, S89)
- Pipelines in the official repository: distilled text/image-to-video; "DFR" (default 1024x1536 at 24 fps); IC-LoRA video-to-video; DubIt (re-dub with lip match); audio-conditioned video (A2Vid); Retake (regenerate a time region); keyframe interpolation; native multi-shot (new in 2.5); UHD 3840x2176; ComfyUI docs describe native 4K HDR up to 50 fps. [DOC] (S88, S89, S90)
- Hardware: official system requirements are a minimum 32 GB VRAM NVIDIA GPU, 32 GB RAM, 100 GB disk (A100 80 GB / H100 recommended); the full quick-start download is "roughly 66 GiB". Low-memory options: `--quantization fp8-cast` with `--offload {cpu, disk}`; int8 (ComfyUI only); NVFP4 (RTX 50-series "Blackwell"). `ltx-pipelines` needs Python 3.12+ and CUDA 12.7+; the `natten` extra is Linux+CUDA only and is skipped on Windows with a fallback. [DOC] (S43, S88, S89)
- Hugging Face repositories are **gated** ("Model downloads will fail without access"), so an application cannot silently auto-download; the customer must accept the licence under their own Hugging Face account. [DOC] (S90)
- Licence: the model card summarises the "LTX-2.x Community License Agreement" as free for commercial use below USD 10M annual revenue measured across the entity and affiliates, with a paid Commercial Use Agreement above that, and notes that transferring fine-tunes may need a paid licence. The licence file itself returned HTTP 404 at the guessed URL and was not read. [DOC] (S89) for the summary; full terms (hosting, safety-filter, competing-use clauses) [UNKNOWN].
- Community: `Abiray/LTX-2.5-Distilled-GGUF` exists; a 9B-labelled "uncensored" fine-tune of LTX-2.3 (`SulphurAI/Sulphur-2-base`) is trending. [IND] (S99, S105). Fine-tunes that remove safety behaviour inherit the base licence and its acceptable-use terms and should never be bundled or recommended by the product. [ASSUMED]

### C.3 MiniMax H3 (open base model)

- `MiniMaxAI/MiniMax-H3`: 33B dense single-stream "Omni-Transformer" (about 13B in AdaLN branches that can be skipped at inference); encoder built on Qwen3-VL-32B; video VAE and a 32 kHz stereo audio VAE. Tasks: text-to-video-with-audio, first/last-frame (0, 1 or 2 images), reference generation (up to 9 images, 3 videos, 3 audio clips), video editing through the reference path. 4-15 s, 768 px shorter side, 24 fps. [DOC] (S85)
- The open release is the **768p base only**; the hosted pipeline's context-enhancement and 2K regeneration stages and the native sparse-attention implementation are not open. Hosted and local outputs are therefore not equivalent even with identical prompts. [DOC] (S85)
- Runtimes: SGLang, vLLM, diffusers (ModularPipeline), ComfyUI. ComfyUI native files are pruned int8-convrot transformers (separate first/last-frame and reference checkpoints), an NVFP4 Qwen3-VL-32B text encoder, 8-step and 4-step turbo LoRAs; native frame 1344x768, frame count 17k+5, base 20 steps; inpainting and extension through a guide node and latent noise masks. An `alibaba-pai/MiniMax-H3-Fun-Controlnet-Union` (pose/depth/canny) and a "FastH3" accelerated variant exist. [DOC] (S83, S87)
- Licence (read in full): worldwide **excluding the European Union, the United Kingdom, the Republic of Korea and the United States of America**; commercial products above USD 20M yearly revenue need prior written authorisation; products must "prominently display" the model name in the UI; outputs may not be used to improve other AI models; machine-generated public content must be disclosed; no military use; Hong Kong law; MiniMax "claims no rights over the Outputs". [DOC] (S86)
- VRAM, speed and file sizes are not stated for the video model. The companion image model's ComfyUI package is documented at about 54.8 GB (21 GB pruned int8 transformer + 25.28 GB int8 text encoder + extras), which is a reasonable proxy for the video package. [DOC] (S119) for the image figures; [ASSUMED] for the proxy.

### C.4 HunyuanVideo 1.5 (Tencent)

- 8.3B parameters; text-to-video and image-to-video at 480p/720p with a super-resolution network to 1080p; 5-10 s clips; released 2025-11-20; step-distilled 480p I2V (8 or 12 steps recommended) and FP8 support added December 2025. No HunyuanVideo 2.0 is mentioned. [DOC] (S91, S93)
- "Minimum GPU Memory: 14 GB (with model offloading enabled)"; ComfyUI's page positions it for "consumer GPUs (24GB VRAM)"; the README lists Linux as the only supported operating system. [DOC] (S91, S93)
- Licence (read in full): territory is worldwide **except the European Union, the United Kingdom and South Korea**, and use outside the territory is prohibited; above 100M monthly active users a separate licence is needed; outputs may not be used to improve other AI models; machine-generated public content must be labelled; no military use; Tencent claims no rights in outputs. [DOC] (S92)
- The original HunyuanVideo (13B), HunyuanCustom and HunyuanVideo-Avatar repositories were not fetched. [UNKNOWN]; they are expected to carry the same licence family. [ASSUMED]

### C.5 Other open models

- **FramePack** (image-to-video, long clips with constant memory): at least 6 GB VRAM on RTX 30/40/50-series; Windows one-click package; a 60 s (1,800 frames at 30 fps) example; last project news 2025-07-14, so it is unmaintained relative to the 2026 models. The code is Apache-2.0; it runs "13B" HunyuanVideo-derived weights, whose own licence the README does not restate. [DOC] (S95). If those weights carry the Tencent community licence, the EU/UK/South Korea exclusion applies. [ASSUMED]
- **CogVideoX** (Zhipu/Z.ai): newest model is CogVideoX1.5-5B from 2024-11-08; 720x480 at 8 fps for 6 s (2B/5B) or 1360x768 at 16 fps for 5-10 s (1.5). Very low VRAM with diffusers optimisations, at the cost of speed; without them peak memory is about 3x higher. Dated quality; useful only as a small-footprint fallback. [DOC] (S100)
- **Mochi 1** (Genmo): Apache-2.0, 10B, 480p; last news 2024-11-26. [DOC] (S102)
- **MAGI-1 / MAGI-1.1** (Sand AI): Apache-2.0 autoregressive models; the 4.5B variant is the only one within single-GPU reach. [DOC] (S103)
- **SkyReels-V3**: reference-to-video (5 s, 720p, 24 fps), video extension (5-30 s single shot) and audio-driven talking avatar (audio up to 200 s); pipeline class is `WanPipeline` and it credits Wan 2.1. Licence tag "skywork-license"; text not read, so commercial terms are [UNKNOWN]. SkyReels V2 and A2 were not fetched. [DOC] (S101)
- **LongCat-Video** (Meituan): MIT; text/image-to-video, continuation, minutes-long generation, interactive generation, audio-driven avatar. [DOC] (S104)
- **Self-Forcing / Causal Forcing**: few-step autoregressive distillation of Wan 2.1 1.3B aimed at real-time streaming on a 24 GB card. [DOC] (S98)
- Also listed as local video tutorials in ComfyUI but not researched: Kandinsky 5.0, Cosmos Predict2 Video2World, SCAIL-2, Bernini-R (in-context editing), VOID (video inpainting), Pika H3 Flex. [DOC] (S83) for existence; licences and requirements [UNKNOWN].
- Not fetched at all: Open-Sora, Pyramid Flow, CausVid, HappyHorse open weights, Vimoo-1.0 (12B, seen in trending). [UNKNOWN]

### C.6 Local runtimes on Windows

| Runtime | Licence | What it covers | Windows status | Low-VRAM claims | Evidence |
|---|---|---|---|---|---|
| ComfyUI (native nodes) | not checked here | Wan 2.1/2.2/Animate-2, MiniMax H3, LTX-2/2.3/2.5, HunyuanVideo/1.5, plus image models in Part D | Desktop app (Windows 10+) and Windows portable build with bundled Python and CUDA PyTorch; NVIDIA, AMD (ROCm builds, RDNA 2-4 on Windows), Intel Arc (`torch.xpu`), CPU via `--cpu` ("slower") | automatic offloading; Wan 2.2 5B "should fit well on 8GB vram"; no general VRAM table | [DOC] (S77, S83, S84) |
| WanGP / Wan2GP | LICENSE.txt linked, type not shown on the page | Wan 2.1/2.2 and derivatives, MiniMax H3 (33B and pruned 20B), LTX-2/2.3/2.5, HunyuanVideo 1/1.5, LongCat, Kandinsky; image: FLUX, Qwen Image, Z-Image, Krea 2, Ideogram 4, HiDream and others | experimental Windows manager app, `.bat` scripts, Pinokio, Docker | "8 GB of VRAM is enough to get started"; select models can run with about 6 GB of VRAM, which the page says "is not a promise for every model or every setting"; no per-model table | [DOC] (S94) |
| stable-diffusion.cpp | MIT | Wan 2.1/2.2 (incl. VACE), MiniMax H3, LTX-2.3/2.5, HunyuanVideo 1.5; images SD1.x to SD3.5, FLUX.1/2/3 Klein, Qwen Image (+2.1, Edit), Z-Image, Krea 2, Ideogram 4, HiDream-O1 | pre-built Windows binaries; backends CPU (AVX/AVX2/AVX512), CUDA, Vulkan, Metal, OpenCL, SYCL; GGUF and safetensors | no memory figures | [DOC] (S96) |
| LightX2V | Apache-2.0 | distilled and quantised inference for Wan 2.1/2.2, HunyuanVideo 1.5, LTX-2.x, MiniMax H3, Qwen-Image, FLUX.2, Z-Image | Windows deployment guide and `requirements_win.txt` | INT8/FP8, NVFP4, GGUF; 4-step models | [DOC] (S97) |
| diffusers | not checked here | Wan 2.2, Wan-Animate, HunyuanVideo 1.5, LTX-2.5, MiniMax H3 (modular), CogVideoX | Python library | `enable_model_cpu_offload` and similar | [DOC] (S76, S85, S89, S91, S100) |
| FramePack app | Apache-2.0 | FramePack only | Windows one-click | 6 GB | [DOC] (S95) |

Design implication: a C/C++ runtime (stable-diffusion.cpp, MIT, Vulkan/CUDA/CPU back ends, Windows binaries) is the only surveyed option that avoids shipping a Python environment and that also reaches AMD/Intel GPUs through Vulkan; ComfyUI is the option with the fastest day-one support for new models. Which of the two the product should embed is a qualification question, not something this research can settle. [ASSUMED]

### C.7 Feasibility by hardware class

Legend: "doc" = a vendor or runtime page states it [DOC]; "est." = my extrapolation [ASSUMED]; "?" = [UNKNOWN]. Clip = roughly 5 s.

| Model / configuration | 8 GB GPU | 12 GB GPU | 16 GB GPU | 24 GB GPU | CPU only |
|---|---|---|---|---|---|
| Wan 2.1 T2V-1.3B, 480p | Fits by a narrow margin (8.19 GB peak, doc S81); quantise or offload to be safe (est.). Time ? | Fits (doc). Time ? | Fits. Time ? | about 4 min per clip on RTX 4090 unoptimised (doc S81) | Runs in stable-diffusion.cpp (doc S96, CPU backend); **not practical** (est., tens of minutes to hours per clip) |
| Wan 2.2 TI2V-5B, 720p/24 fps | "should fit well" with ComfyUI offloading (doc S77); GGUF Q4 3.4 GB (S82). Time ?; expect well over 10 min per clip (est.) | Fits. Time ? | Fits. Time ? | under 9 min per clip (doc S76) | **Not practical** (est.) |
| Wan 2.2 A14B T2V/I2V with 4-step LoRA and fp8/GGUF | Possible only with GGUF Q3-Q4, 480p, heavy offload to at least 32 GB system RAM (est.); not a supported configuration; time ? | Feasible at 480p (est.); time ? | Feasible at 480p-720p (est.); time ? | Reference consumer configuration (est.); time ? | **Not practical** |
| Wan Animate / Animate-2 / S2V / VACE 14B | As the 14B row, with extra memory for control inputs (est.) | est. feasible at 480p | est. feasible | est. feasible | **Not practical** |
| LTX-2.5 22B (distilled, int8 / NVFP4 / GGUF) | Below official minimum (32 GB, doc S43). Community quantised builds exist; viability ? | ? | ? | est. feasible with int8/NVFP4 and offload; time ? | **Not practical** |
| MiniMax H3 (pruned int8 + 32B text encoder) | **Not practical** (est.: text encoder alone exceeds VRAM; requires sequential offload and about 64 GB RAM) | **Not practical** (est.) | ? | est. possible with sequential offload; time ? | **Not practical** |
| HunyuanVideo 1.5 (8.3B; distilled 480p I2V) | Below documented minimum of 14 GB (doc S91); WanGP's generic 8 GB claim not verified for this model | Below documented minimum; ? | Fits with offloading (doc S91); time ? | 75 s for distilled 480p I2V on RTX 4090 (doc S91) | **Not practical** |
| FramePack (I2V, 30 fps) | Fits (6 GB minimum, doc S95). Laptop 3060/3070 Ti: about 10-20 s per frame, so 25-50 min per 5 s clip (est. from doc figures) | est. 15-30 min | est. 10-20 min | 2.5 s/frame, about 6 min per 5 s clip; about 4 min with TeaCache (est. from doc figures) | **Not practical** |
| CogVideoX-2B / 5B (diffusers optimisations) | Fits (3.6-5 GB, doc S100); slow with sequential offload; time ? | Fits | Fits | Fits | **Not practical** |
| MAGI-1 4.5B distill + fp8 | No | Fits with `window_size=1` (doc S103); time ? | Fits (est.) | Fits (doc) | **Not practical** |

Reading: on an 8-12 GB Windows laptop GPU the defensible local video options are Wan 2.2 TI2V-5B (Apache-2.0, text and image to video), Wan 2.1 1.3B, FramePack (image-to-video), and, with caveats, quantised 14B Wan with 4-step LoRAs. Everything with native audio (LTX-2.5, MiniMax H3), 1080p+ output, multi-reference conditioning at frontier quality, or sub-minute turnaround needs either a 24-32 GB+ desktop GPU or external compute. No video model is practical on CPU only. [ASSUMED] from the table.

---

## PART D — Image generation and editing models (hosted and open)

All of Part D was researched by direct fetch only. Two long official pages (OpenAI image-generation guide, Google Gemini pricing) were truncated at the fetch size limit, so facts in their tails (for example Imagen pricing, C2PA statements, moderation parameters) are not covered and are marked where relevant.

Naming drift to be aware of: the 2025 names in the brief have successors. FLUX.1 Kontext and FLUX.2 are now behind "FLUX 3 Image"; Qwen-Image has a 2.1 open release and a hosted 3.0; Seedream is at 5.0; "Nano Banana" is at 2.1 with a Pro tier under `gemini-3-pro-image`; GPT Image is at 2.6; Hunyuan Image has a hosted 3.5 preview; Midjourney is at V8.x. [DOC] (S3, S11d, S64, S106, S116, S123); [IND] (S45-note) for Midjourney.

### D.1 Hosted image APIs

| Vendor / models | First-party API usable with the customer's own key? | Pricing unit and snapshot | Reference / edit operations documented | Job model, retention | Notes | Evidence |
|---|---|---|---|---|---|---|
| Black Forest Labs: FLUX 3 Image, FLUX 3 Image Klein, FLUX.2 [max] / [pro] / [flex] / [klein] 9B and 4B, FLUX.1 Kontext [pro] / [max], FLUX1.1 [pro] / Ultra / Raw, Fill, Expand, tools (outpaint, erase, deblur, virtual try-on) | Yes (`api.bfl.ai`, plus `api.eu.bfl.ai` and `api.us.bfl.ai` regional endpoints) | Credits (1 credit = USD 0.01). FLUX 3 Image / Klein per image by resolution tier (768 px square, 1K, 1.5K, 2K, 4K); FLUX.2 per megapixel with a separate editing rate; Kontext and 1.1 per image. **Numeric prices were blank in the fetched text.** | Text-to-image, multi-reference editing (FLUX.2 / FLUX 3), in-context editing (Kontext; docs steer new work to FLUX.2), inpaint (Fill), outpaint (Expand), erase, deblur, try-on | Async: submit returns `id` and `polling_url` (must use the returned URL); webhooks supported; **result URLs expire 10 minutes after generation**; no CORS on result URLs; up to 24 concurrent requests (6 for Kontext max); HTTP 402 on insufficient credits | FLUX.2 [dev] has no hosted BFL endpoint. Seed, cancel, moderation and C2PA were not covered on the fetched pages. | [DOC] (S106, S107, S108) |
| OpenAI: `gpt-image-2.6-sunburst` / `-flare`, `gpt-image-2.5-*`, `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini` | Yes, but the organisation must pass **API Organization Verification** before image models can be used | Tokens. GPT Image 2 / 2.5 / 2.6: text input USD 5, image input USD 8, image output USD 30 per 1M tokens; 1.5: image output USD 32; mini: USD 2 / 2.50 / 8. Batch is half price where listed. | Generate; edit with mask (prompt-guided, not pixel-exact); "markup" edits (2.5 / 2.6); multiple input images (example shows 4); transparent background; quality tiers low to max; streaming partial images (0-3) | Synchronous Image API or as a tool inside the Responses API | Per-image price estimates, the moderation parameter and provenance statements sit in the truncated tail. Seed is not in the fetched portion. | [DOC] (S123, S124) |
| Google: `gemini-nano-banana-2.1`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image` ("Nano Banana Pro") | Yes (Gemini API key); **no free tier for image models** | Per image by size. Nano Banana 2.1: USD 0.0336 (1K) / 0.0504 (2K) / 0.113 (4K); 3.1 Flash Image: USD 0.045-0.151 (0.5K-4K); 3.1 Flash-Lite Image: USD 0.0336 (1K); 3 Pro Image: USD 0.134 (1K/2K) / 0.24 (4K); batch half price. `gemini-2.5-flash-image` (USD 0.039) is deprecated with shutdown 2027-03-15. | Not on the pricing page; the capability guide was not fetched | Synchronous generateContent-style calls [ASSUMED] | Imagen line and SynthID / C2PA statements for images are in the truncated tail or unfetched pages. [UNKNOWN] | [DOC] (S3) |
| ByteDance Seedream 5.0 pro / flash / lite, 4.5, 4.0 | Yes via Volcengine Ark (China) and BytePlus ModelArk (international, not offered in the United States) | Per image, RMB: 5.0 pro 0.30 (0.60 for the larger tier), 5.0 flash 0.12, 5.0 lite 0.22, 4.5 0.25, 4.0 0.20 | Not fetched this session | Not fetched | Also resold by Runway, Pika developer API and ComfyUI partner nodes | [DOC] (S11d, S21, S49, S64); operations [UNKNOWN] |
| Alibaba Qwen-Image (hosted `qwen-image-3.0`) and Wan image models | Yes via Alibaba Cloud Model Studio | Not fetched | Not fetched | Not fetched | Existence of the hosted 3.0 model observed only in ComfyUI's partner price list | [DOC] (S64); details [UNKNOWN] |
| Ideogram 4.5 / 4.0 / 3.0 / 2a / 2.0 | Yes (developer.ideogram.ai) | Not fetched | Generate, "precise edit" (4.5), remix, inpaint, reframe, upscale, replace or remove background, remove objects, describe, layerize, vector output, transparent output, character consistency (3.0), custom models (4.0) | Polling endpoint and webhooks are documented pages | The same API resells GPT Image 2 / 2.5, Nano Banana 2 / 2.1 / Pro, Z-Image, Topaz upscalers and third-party video. Terms and URL expiry not fetched. | [DOC] (S121) |
| Recraft V4.1 / V4.1 Flash / V4 / V4 Styles / V3 / V2 vector | Yes (`https://external.api.recraft.ai/v1/images/generations`; OpenAI-SDK compatible) | Per image: V4.1 Flash USD 0.007; V4.1 from 0.035; V4 Styles from 0.035; V4 and V3 from 0.04; V2 vector from 0.022; vectorise 0.01 | Generate (raster and vector), edit, inpaint, outpaint, erase, background removal/replacement, upscale, custom styles from 1-10 reference images | Synchronous; result URLs valid about 24 hours | Output ownership terms not on the fetched page | [DOC] (S127) |
| Tencent Hunyuan Image ("HY Image 3.5 Preview") | Hosted model exists; first-party API not fetched | Not fetched | Not fetched | Not fetched | Seen only in ComfyUI's partner price list | [DOC] (S64); details [UNKNOWN] |
| Runway `gen4_image`, `gen4_image_turbo`; Luma `uni-1`, `uni-1-max`; xAI `grok-imagine-image`; Kling image (`kling-image-o1`); Krea 2; Meta "Muse Image"; Microsoft `mai-image-2.6` | Runway, Luma, xAI and Kling: yes, same accounts as their video APIs. Others seen only through resellers. | Runway 5-8 credits per image (2 for turbo); Luma 14 / 34 credits plus 1 per extra reference (up to 9) | Luma: up to 9 reference images. Others not fetched. | As in Part A | Listed for registry completeness, not researched in depth | [DOC] (S21, S27, S64) |
| Midjourney V8.x | **No official public API** | Subscription | n/a | n/a | Cannot be a qualified provider; see A.15 | [IND] (S45-note) |
| Stability AI (Stable Image Ultra / Core, SD 3.5) | First-party API not fetched; available on Amazon Bedrock under the customer's AWS account | Not fetched | Bedrock lists editing tools | Bedrock invocation | Replicate requires the customer to hold a direct Stability licence | [DOC] (S57, S67) |

Observations:

- The shortest output-retention window found anywhere in this report is BFL's **10 minutes**. A client must download inside the polling loop. [DOC] (S108)
- OpenAI's organisation-verification gate means "paste a key" is not sufficient for image generation; the adapter needs a distinct, explained error state for an unverified organisation. [DOC] (S123); the error-handling consequence is [ASSUMED].
- Three different billing bases exist for one conceptual operation ("make one image"): per image by size tier (Google, BFL FLUX 3, Seedream, Recraft), per megapixel (FLUX.2), and tokens (OpenAI). [DOC] (S3, S107, S124, S127)
- Ideogram, Runway, Pika and ComfyUI all resell other vendors' image models, so the same model can reach the customer under four different terms of service and price lists. [DOC] (S21, S49, S64, S121)

### D.2 Open-weight image models

| Model | Licence of weights | Commercial use | Parameters | Edit / reference abilities | Documented memory guidance | Gated download? | Evidence |
|---|---|---|---|---|---|---|---|
| FLUX.2 [klein] 4B | Apache-2.0 | Yes | 4B | Text-to-image and multi-reference editing in one model; 4 steps | about 13 GB VRAM (RTX 3090 / 4070 class) | not noted | [DOC] (S113) |
| FLUX.2 [klein] 9B | FLUX Non-Commercial License | No (weights) | 9B | as above | not fetched | [UNKNOWN] | [DOC] (S113) |
| FLUX.2 [dev] | FLUX Non-Commercial License | Weights non-commercial; the card says outputs may be used commercially | 32B | Single- and multi-reference editing | 4-bit build runs on an RTX 4090 | Yes | [DOC] (S112) |
| FLUX.1 Kontext [dev] | FLUX.1 [dev] Non-Commercial License | Weights non-commercial; outputs usable commercially per card | 12B | Instruction-based image editing | not fetched | Yes | [DOC] (S114) |
| FLUX 3 Image Klein (distilled and base) | "FLUX Kommunity License v1.0" | Commercial output generation only for "Qualifying Users" under USD 5M gross annualised revenue (incl. affiliates); not a blanket right to commercial fine-tuning or redistribution | 5.6B (text encoder Qwen3-VL-4B, Apache-2.0) | Up to 10 reference images, bounding-box layout control, up to 4K | Peak at 1024x1024 on a B200: 31 GB (BF16) / 26 GB (FP8) / 25 GB (NVFP4), including encoder; "down to an RTX 3090"; optional 9B prompt upsampler adds about 28 GB | Yes | [DOC] (S109, S110) |
| FLUX.1 Krea [dev], FLUX.1 [dev], FLUX.1 [schnell] | Not fetched this session | [UNKNOWN] (from earlier knowledge, schnell is Apache-2.0 and dev / Krea dev are non-commercial; unverified today [ASSUMED]) | 12B [ASSUMED] | Fill / ControlNet tutorials exist for FLUX.1 | not fetched | [UNKNOWN] | [DOC] (S83) for tutorial existence only |
| Qwen-Image (20B, 2025-08), Qwen-Image-2512, Qwen-Image-Edit, -Edit-2509, -Edit-2511, -Layered | Apache-2.0 (repository statement) | Yes | 20B | Edit: single image; 2509: multi-image; 2511: multi-person consistency; Layered: RGBA layer decomposition | DiffSynth-Studio offloading "within 4GB VRAM" (slow) | not noted | [DOC] (S115) |
| **Qwen-Image-2.1** | **"Qwen Research License Agreement" (2026-09-20)** | **No. Non-commercial research and evaluation only; commercial use needs a separate licence**; "Built with Qwen" attribution; PRC law | 7B | Text-to-image plus editing with up to 10 reference images; 2048x2048; native RGBA; 8-step Turbo | about 6 s per iteration at 3000x4000 on RTX 5090 | not noted | [DOC] (S116, S117) |
| Z-Image / Z-Image-Turbo | Apache-2.0 | Yes | 6B | Text-to-image only; Edit and Omni variants "to be released"; community ControlNet-union patch | Turbo (8 steps) "fits within 16GB VRAM"; stable-diffusion.cpp reports about 4 GB with quantisation | not noted | [DOC] (S118); the 4 GB figure is [IND] (S96) |
| HiDream-I1 (Full / Dev / Fast), HiDream-E1 / E1.1 (editing) | MIT | Yes for the HiDream weights; **requires Meta Llama-3.1-8B-Instruct as a text encoder, which is gated under Meta's licence** | 17B | E1 / E1.1 instruction editing | not stated | Llama encoder: yes | [DOC] (S128) |
| Stable Diffusion 3.5 Large | Stability Community License | Free including commercial under USD 1M annual revenue; enterprise licence above | 8B | Text-to-image (ControlNets not checked) | not fetched | Yes | [DOC] (S126) |
| Krea-2 (RAW 52 steps, Turbo 8 steps; 2026-06-22) | "Krea 2 Community License Agreement" | Terms not read (licensing page failed to load); card says deployers must implement content filtering | 12B | Style reference with 1-2 images; 1K-2K | not stated | Yes | [DOC] (S122); thresholds [UNKNOWN] |
| Ideogram 4.0 open-source model | **Not stated on the fetched page** | [UNKNOWN] | not stated; about 38 GB of files in the ComfyUI package | Text-to-image with structured JSON prompts; editing not mentioned | not stated | not noted | [DOC] (S120) |
| MiniMax-H3-Image | "MiniMax-H3-Image Community License Agreement" (text not read; territorial terms [UNKNOWN], likely similar to the video licence [ASSUMED]) | [UNKNOWN] | 33.1B | Text-to-image and editing in one checkpoint; up to 16 reference images; about 16 MP native output | ComfyUI package about 54.8 GB (21 GB int8 transformer, 25.28 GB int8 text encoder); listed hardware is H200 / RTX PRO 6000 Blackwell class | not noted | [DOC] (S119) |
| HunyuanImage 3.0 (+ Instruct, Instruct-Distil) | tencent-hunyuan-community (text not read; the video licence of the same family excludes EU / UK / South Korea) | [UNKNOWN] for this model | 80B mixture-of-experts | Multi-image fusion up to 3 images | **at least 3x 80 GB GPUs** (8x 80 GB for Instruct) | not noted | [DOC] (S125) |
| Other open image models with native ComfyUI tutorials, not researched: OmniGen2, Bria FIBO 2.0, Ovis-Image (7B), Boogu-Image (10B), Lens (3.8B), ERNIE-Image, Anima, NewBie, PixelDiT, MOSS-Image, HiDream-O1, ByteDance USO, Mage-Flow, Ming Image | [UNKNOWN] | [UNKNOWN] | as named | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [DOC] (S83) for existence only |

### D.3 Local feasibility for images

| Hardware class | Defensible options | Evidence |
|---|---|---|
| 8 GB GPU | Z-Image-Turbo quantised (about 4 GB reported in stable-diffusion.cpp); FLUX.2 [klein] 4B quantised (card figure is 13 GB unquantised, so 8 GB needs fp8/GGUF and encoder offload); Qwen-Image / Qwen-Image-Edit only with aggressive offloading (very slow); SD 1.x / SDXL-class legacy models | [IND] (S96) for Z-Image; [DOC] (S113, S115) for the base figures; fit at 8 GB is [ASSUMED] |
| 12 GB GPU | As above with fewer compromises; FLUX.2 [klein] 4B close to its documented requirement | [ASSUMED] from (S113) |
| 16 GB GPU | Z-Image-Turbo as documented; FLUX.2 [klein] 4B as documented; quantised 12B-20B models (Kontext dev, Qwen-Image-Edit, Krea-2) plausible | [DOC] (S113, S118); the 12B-20B statement is [ASSUMED] |
| 24 GB GPU | FLUX 3 Image Klein (FP8 / NVFP4), FLUX.2 [dev] 4-bit, Qwen-Image family, HiDream-I1 quantised | [DOC] (S109, S112); HiDream fit is [ASSUMED] |
| External compute required | HunyuanImage 3.0 (3-8x 80 GB), MiniMax-H3-Image (about 55 GB package), FLUX.2 [dev] at full precision | [DOC] (S119, S125); FLUX.2 [dev] full precision is [ASSUMED] from 32B parameters |
| CPU only | stable-diffusion.cpp has a CPU backend with AVX/AVX2/AVX512 and supports these models in GGUF form. Expect minutes per image for few-step 4B-6B models and impractical times for 12B+ models. | [DOC] (S96) for the backend; timings [ASSUMED]; no official CPU timings found [UNKNOWN] |

Unlike video, a credible **fully local, commercially usable image path exists at 8 GB**: Z-Image-Turbo (Apache-2.0) for generation and FLUX.2 [klein] 4B (Apache-2.0) or the 2025 Qwen-Image-Edit line (Apache-2.0) for reference-based editing. [ASSUMED] from D.2 and D.3; needs measured qualification on Windows.

### D.4 Reference and edit abilities compared

| Ability | Hosted, documented | Open weights, documented | Not established |
|---|---|---|---|
| Multi-image reference (count) | Luma uni-1: up to 9 (S27); OpenAI: multiple inputs (S123); Ideogram character consistency (S121); Recraft style from 1-10 images (S127) | FLUX 3 Klein: 10 (S109); Qwen-Image-2.1: 10 (S116); MiniMax-H3-Image: 16 (S119); HunyuanImage 3.0: 3 (S125); FLUX.2 klein/dev: multi-reference, count not captured (S112, S113); Krea-2: 1-2 style images (S122) | Gemini image, Seedream 5.0 and BFL hosted reference counts [UNKNOWN] |
| Mask inpainting | OpenAI (prompt-guided mask), Ideogram inpaint, Recraft inpaint, BFL Fill | FLUX.1 Fill tutorial exists (S83) | Pixel-exact preservation outside the mask is not guaranteed by OpenAI's description; others not checked [UNKNOWN] |
| Outpaint / reframe | BFL Expand, Ideogram reframe, Recraft outpaint | not checked | |
| Instruction editing without mask | OpenAI, Ideogram precise edit, BFL Kontext / FLUX.2 | Kontext dev, Qwen-Image-Edit line, HiDream-E1.1, FLUX.2 klein | |
| Transparent / layered output | OpenAI transparent background, Ideogram transparent and layerize, Recraft background removal | Qwen-Image-2.1 native RGBA, Qwen-Image-Layered | |
| Vector output | Recraft, Ideogram vectors | none found | |
| Layout / bounding-box control | not checked | FLUX 3 Image Klein | |

Every cell above is [DOC] for the cited source where one is given; uncited cells summarise the D.1 / D.2 rows.

---

## PART E — Cross-cutting conclusions

### E.1 Capability matrix

Cell legend (each cell carries exactly one evidence class):

- **Y** = documented as supported on the official page cited in the column header. [DOC]
- **N** = documented as not supported, or documented on a sibling model only. [DOC]
- **C** = asserted only in vendor marketing. [CLAIM]
- **nm** = not mentioned on the official pages that were fetched; status is [UNKNOWN], not "no".
- **?** = page not fetched. [UNKNOWN]
- Text in a cell qualifies the letter; a source key in a cell overrides the column source for that cell.

#### E.1a Hosted video models, group 1

| Operation | Gemini Omni 1.2 Flash (S5) | Veo 3.1 on Vertex (S7) | Seedance 2.5 (S11a) | Kling 4.0 (S13, S14, S17) | Runway Gen-4.5 / Aleph 2.0 / Act-Two (S23) | Luma Ray 3.2 (S26) |
|---|---|---|---|---|---|---|
| Text-to-video | Y | Y | Y | Y | Y (Gen-4.5, two aspect ratios) | Y |
| Image-to-video (first frame) | Y | Y | Y | Y | Y | Y |
| First + last frame | Y (3-10 s only) | Y | Y, last frame honoured (S69) | Y | nm | Y |
| Multi-keyframe (middle / timestamped) | nm | nm | nm | Y (first / middle / last) | Y for Aleph 2.0 "keyframe guidance" | Y (docs: up to 64 anchors) |
| Reference images (max) | Y, 6 (3 per character, 2 characters) | Y on Generate and Fast, not Lite; count not captured | C, "up to 30" (S9, S10) | Y, 10 plus up to 7 "elements"; 15 inputs combined | nm for video models | nm |
| Reference video | Y, up to 3 s each | N, image references only (S69) | Y (S69); C for the count of 10 (S9) | Y, up to 5 (30 s combined) | Y as the edit source for Aleph 2.0 (2-30 s) | nm |
| Reference audio / voice | N ("audio inputs ... not supported") | nm | C, "up to 10 audio clips" (S9) | Y, voice reference | nm | nm |
| Video-to-video edit | Y, conversational; not in EEA / CH / UK | nm | Y (editing tasks) | Y (`base_video` on the omni endpoint) | Y (Aleph 2.0) | Y (`video_edit`, `video_reframe`) |
| Motion / performance transfer | nm | nm | nm | N on 4.0 (motion control exists on 3.0) | Y (Act-Two) | nm |
| Extend | Y, end only, +3-10 s to 30 s total | Y | Y (extension tasks) | nm (no extend endpoint in the current index) | nm | Y (generation ID as start/end frame) |
| Inpaint / retake a region or time span | nm | nm | C, "timestamp-level" edits (S9) | nm | nm | nm |
| Lip-sync / audio-driven | N (no audio input) | nm | nm | Y (lip sync) | nm | nm |
| Native audio output | Y | Y | Y (default on) | Y | nm for own models | nm |
| Explicit camera parameter | nm | nm | N on 2.x (`camera_fixed` exists on 1.0 pro only) | nm | nm | nm |
| Multi-shot | nm | nm | nm | Y | nm | nm |
| Max duration | 15 s (30 s by extension) | 8 s | 30 s | 30 s | 10 s (Gen-4.5) | 10 s |
| Max resolution | 4K upscaled (720p native default) | 4K (Generate) | 1080p (4K on 2.0 only) | 4K | 1080p | 1080p, HDR / EXR |
| Frame rate | nm | 24 fps | nm | nm | nm (Aleph input 30 fps or lower) | nm |
| Seed | nm | nm | **N** (1.0 pro only) | **N** (none documented) | Y, optional on some models | nm |
| Cancel | nm | ? | Y, queued tasks only (S11c) | N (none documented) | Y (`DELETE /v1/tasks/{id}`) | deletion page exists; cancel semantics ? |
| Webhook | nm | ? | Y (`callback_url`, 3 retries) | Y (signed) | nm | nm |

#### E.1b Hosted video models, group 2

| Operation | MiniMax H3 (S30) | Vidu Q4 Preview / Q3 (S31, S32) | LTX-2.5 API (S42, S41) | Wan 3.0 (S35, S36) | Grok Imagine Video 1.5 (S38) |
|---|---|---|---|---|---|
| Text-to-video | Y | Y (Q3) | Y | Y | Y |
| Image-to-video (first frame) | Y | Y | Y | Y | Y |
| First + last frame | Y | Y (Q3 Pro) | Y (`last_frame_uri`) | Y first-party; a gateway reports the last frame is ignored (S69) | Y first-party; a gateway reports the last frame is ignored (S69) |
| Multi-keyframe | nm | nm | nm | nm | Y, up to 4 timestamped |
| Reference images (max) | Y, 9 | Y (reference-to-video; count not captured) | nm | Y (count not captured) | Y (count not captured; output capped at 720p) |
| Reference video | Y, 3 | nm | nm | Y (video input; S69 confirms) | N, image references only (S69) |
| Reference audio / voice | Y, 3 audio clips | nm | Y (audio-to-video) | Y (audio input; `audio_url` on 2.7 and earlier) | Y, voice references for up to 3 speakers |
| Video-to-video edit | Y as "video regeneration"; editing through the reference path on the open model (S85) | nm | nm | nm | Y on the older `grok-imagine-video` (720p, 8.7 s cap) |
| Motion / performance transfer | nm | nm | nm | nm | nm |
| Extend | nm | nm | **N** on 2.5 (Y on LTX-2.3) | nm | Y on the older model |
| Inpaint / retake | nm | nm | **N** on 2.5 (retake Y on LTX-2.3) | nm | nm |
| Lip-sync / audio-driven | nm | Y (separate lip-sync product) | Y (audio-to-video) | Y (supplied audio) | Y (native lip-synced speech) |
| Native audio output | nm on the hosted guide; Y for the open model (S85) | ? | Y (default on) | Y | Y (default on) |
| Explicit camera parameter | nm | nm | Y (`camera_motion`) | nm | nm |
| Multi-shot | nm | nm | Y | nm | nm |
| Max duration | 15 s | 16 s | 20 s (fast, 720p/1080p, 24/25 fps), else 10 s | 30 s | 15 s |
| Max resolution | 2K | 4K (Q4 Preview) | 4K | 1080p | 1080p |
| Frame rate | nm | nm | 24, 25, 48, 50 fps | nm | nm |
| Seed | nm | ? | nm | Y, "doesn't guarantee identical output" | nm |
| Cancel | Y, queued tasks only | Y, state-dependent | nm | N (status exists, no endpoint documented) | nm |
| Webhook | nm | Y (signed) | nm | nm | nm |

Not in the matrix because no qualified first-party route exists: Sora (API removed), Moonvalley Marey (API discontinued), Midjourney (no official API), PixVerse (terms prohibit the use case without written authorisation), Pika (own-model endpoints not shown). See A.1, A.9-A.11, A.15.

#### E.1c Local open-weight video models

Column sources: Wan 2.2 (S76, S77); Wan 2.1 ecosystem (S81, S83); Animate-2 / S2V (S76, S79, S80); LTX-2.5 (S88, S89, S90); MiniMax H3 (S85, S87, S83); HunyuanVideo 1.5 (S91, S93); FramePack (S95).

| Operation | Wan 2.2 A14B / TI2V-5B | Wan 2.1 ecosystem (VACE, FLF2V, Fun, InfiniteTalk) | Wan Animate-2 / Wan 2.2 S2V | LTX-2.5 open | MiniMax H3 open base | HunyuanVideo 1.5 | FramePack |
|---|---|---|---|---|---|---|---|
| Text-to-video | Y | Y (T2V 1.3B / 14B) | N | Y | Y | Y | N (image-to-video tool) |
| Image-to-video | Y | Y | Y (reference image plus driving video or audio) | Y | Y | Y | Y |
| First + last frame | Y through "Fun InP" tutorial (S83) | Y (FLF2V-14B) | nm | Y | Y (0, 1 or 2 images) | nm | nm |
| Multi-keyframe | nm | nm | nm | Y (keyframe interpolation) | Y ("multiframe reference" tutorial) | nm | nm |
| Reference images | nm | Y (VACE reference-to-video) | Y (one character reference) | Y through IC-LoRA "Ingredients" | Y, up to 9 | nm | nm |
| Reference video | nm | Y (VACE video-to-video) | Y (driving video) | Y (IC-LoRA video-to-video) | Y, up to 3 | nm | nm |
| Reference audio | nm | Y (InfiniteTalk lip-sync) | Y (S2V) | Y (audio-conditioned pipeline) | Y, up to 3 | nm | nm |
| Video-to-video edit | nm | Y (VACE) | Y (character replacement) | Y (IC-LoRA) | Y (reference path) | nm | nm |
| Motion / performance transfer | Y through "Fun Control" tutorial (S83) | Y (Fun Control; Wan-Move; ATI) | Y | nm | Y through Fun ControlNet Union (pose / depth / canny) | nm | nm |
| Extend | nm | nm | Y by looping 81-frame segments | nm as a named pipeline | Y (guide node and noise masks) | nm | Y (long clips are the design goal; 60 s example) |
| Inpaint / retake | nm | Y (VACE masked video-to-video) | nm | Y (Retake pipeline, time region) | Y (latent noise masks) | nm | nm |
| Lip-sync / audio-driven | nm | Y (InfiniteTalk) | Y (S2V) | Y (DubIt re-dub; audio-to-video) | Y (audio references) | nm | nm |
| Native audio output | nm | nm | nm | Y | Y | nm | nm |
| Camera control | Y through "Fun Camera" tutorial (S83) | Y (Fun Camera) | Y (Animate-2 text-driven viewpoint) | nm for the open pipelines | nm | nm | nm |
| Multi-shot | nm | nm | nm | Y | nm | nm | nm |
| Clip length | about 5 s reference | about 5 s reference | 81 frames per pass, looped | not captured for open pipelines | 4-15 s | 5-10 s | 60 s example at 30 fps |
| Max resolution | 720p | 720p | 720p | 3840x2176 | 768p (hosted 2K stage is not open) | 720p, 1080p with SR | not captured |
| Seed | Y (runtime parameter) [ASSUMED]; see E.3 | same | same | same | same | same | same |
| Cancel | local process interrupt [ASSUMED] | same | same | same | same | same | same |
| Licence headline | Apache-2.0 | Apache-2.0 base; derivative licences not checked | Apache-2.0 | USD 10M revenue threshold; gated | Excludes EU / UK / South Korea / USA; USD 20M; UI branding | Excludes EU / UK / South Korea | Apache-2.0 code; weights licence not restated |

Reading of the three tables:

- The only operations that are close to universal are text-to-video, image-to-video from a first frame, and (hosted) native audio. Everything else is partial. [ASSUMED] from the tables.
- The widest single hosted surface is Kling 4.0; the widest single open surface is MiniMax H3, which is also the least deployable (33B, territorial licence). The widest *permissively licensed* open surface is the Wan 2.1 / 2.2 family taken as a set of separate checkpoints. [ASSUMED] from the tables.
- "nm" cells dominate. A capability registry must have a third state ("unverified") in addition to supported / unsupported, with the evidence source and date attached to each cell. [ASSUMED]

### E.2 Operations with no uniform semantics across providers

1. **Last frame.** Veo, Kling and Seedance honour a last frame; a gateway reports that Grok Imagine Video and Wan ignore it with a warning, while xAI's and Alibaba's own pages describe first/last-frame support for their current models. The same request therefore succeeds silently with different meaning depending on route and model version. [DOC] (S69, S35, S38)
2. **Reference addressing in the prompt.** Reference tokens differ: `character1` (Wan), `<IMAGE_1>` (Grok), `[Image 1]` (Seedance), none (Kling, Veo). Prompts are not portable. [DOC] (S69)
3. **Reference types and counts.** Images only (Veo, Kling through gateways, Grok); images plus video (Gemini Omni, Wan); images plus video plus audio (MiniMax H3 9 / 3 / 3; Kling 4.0 10 images, 5 videos, voice; Seedance 2.5 per vendor posts). Per-character limits exist at Gemini Omni (3 images per character, 2 characters). [DOC] (S5, S17, S30, S69); [CLAIM] (S9) for Seedance counts.
4. **Extend.** A continuation of an uploaded or prior clip from its end only (Gemini Omni, with a 10 s context window); a parameter on the same endpoint (Luma, by generation ID, so only for clips made on that account); a separate endpoint (xAI, older model only); absent (Kling 4.0 index, LTX-2.5); a local looping subgraph (Wan Animate-2). [DOC] (S5, S26, S38, S12, S42, S79)
5. **Edit.** Means conversational multi-turn editing with server-side state (Gemini Omni `previous_interaction_id`), in-context video-to-video (Runway Aleph), `base_video` on an omni endpoint (Kling), "regeneration" to a higher resolution (MiniMax), time-region retake (LTX-2.3 hosted and LTX open pipeline), or masked video-to-video (Wan VACE). These are different operations that share a name. [DOC] (S5, S23, S14, S30, S42, S81, S88)
6. **Audio.** Default on (Seedance, LTX, Grok) versus opt-in or absent; audio as an input is unsupported at Gemini Omni but supported at Wan, MiniMax, LTX and Kling (voice); turning audio off changes the price at some vendors and not others. [DOC] (S5, S11a, S16, S36, S42, S38)
7. **Duration and resolution vocabularies.** Enumerated values (Veo 4 / 6 / 8 s; Luma 5 / 10 s) versus ranges (Kling 3-30 s; Seedance 4-30 s or -1 for model-chosen; LTX `null` for automatic). Resolution is a named tier at most vendors, pixel dimensions at Runway, and "upscaled" tiers at Gemini Omni; the maximum duration depends on resolution and frame rate at LTX. [DOC] (S5, S7, S11a, S17, S23, S26, S42)
8. **Cancellation.** Queued-only (Seedance, MiniMax); any state by DELETE (Runway); state-dependent POST (Vidu); none documented (Kling, LTX, Wan, xAI, Gemini Omni); at aggregators, fal sends a signal that the model may ignore and Replicate bills for time already used. A uniform "cancel" button cannot promise that billing stops. [DOC] (S11c, S30, S23, S32, S51, S54)
9. **Charging for failed or moderated requests.** Charged in full (Runway); refunded or not charged (Luma, Vidu, Seedance, Runware); not stated (most others). [DOC] (S23, S27, S31, S11d, S60)
10. **Output delivery and retention.** From 10 minutes (BFL) and 1 hour (Luma, Replicate) to 30 days (Kling); raw bytes (Hugging Face); customer-owned bucket (Bedrock); Files resource polling (Gemini). [DOC] (S108, S26, S55, S13, S61, S68, S5)
11. **Region-dependent behaviour.** Gemini Omni disables video editing and extension in the EEA, Switzerland and the UK; Veo on Vertex is single-region; BytePlus is not offered in the United States; Wan prices and model availability differ by region; BFL exposes EU and US endpoints. The same adapter call can be unavailable depending on where the customer's account lives. [DOC] (S5, S7, S35, S36, S108); [CLAIM] (S9) for BytePlus availability.
12. **Hosted versus open variants of the same named model.** MiniMax H3 open weights are the 768p base without the hosted enhancement and 2K stages; LTX-2.5 hosted lacks retake and extend, which the open pipelines have; Wan 3.0 is hosted-only while "Wan" locally means 2.1 / 2.2. A model family name is not a capability identity. [DOC] (S85, S42, S88, S76)

### E.3 Reproducibility: is a seed honoured?

| Provider / runtime | Seed parameter | Guarantee | Evidence |
|---|---|---|---|
| Seedance 2.0 / 2.5 | **Not supported** (1.0 pro only) | none; even on 1.0 pro "similar, not guaranteed identical" | [DOC] (S11a) |
| Kling 4.0 | none documented | none | [DOC] (S13, S14) |
| Gemini Omni, Veo 3.1 (model page), Luma, MiniMax H3, LTX API, xAI | not mentioned on fetched pages | [UNKNOWN] | [DOC] (S5, S7, S26, S30, S42, S38) for the absence on those pages |
| Wan (Model Studio) | yes, 0-2147483647 | "aids reproducibility but doesn't guarantee identical output"; `prompt_extend` (default true) rewrites the prompt with an LLM | [DOC] (S36) |
| Runway | optional on some models, up to 4294967295 | not described | [DOC] (S23) |
| Vidu, PixVerse, Pika | not retrieved | [UNKNOWN] | - |
| OpenRouter video API | not part of the normalised fields; provider passthrough only | none at the router level | [DOC] (S58) |
| Hugging Face Inference Providers (open models) | `seed` is a standard task parameter | not described | [DOC] (S61) |
| Hosted image APIs (BFL, OpenAI, Google, Ideogram, Recraft) | not captured in the fetched portions | [UNKNOWN] | - |
| Local runtimes (ComfyUI, WanGP, stable-diffusion.cpp, diffusers) | yes, as a sampler input | Repeatable on the same machine, runtime version, weights file, quantisation, attention backend and resolution; **not** expected to be bit-identical across GPU vendors, driver or library versions, quantisation formats, or when acceleration options (caching, compiled or sparse attention, tiling, offload order) change | [ASSUMED]; no official statement was found |

Conclusions:

- Seed-level reproducibility cannot be a platform-wide guarantee. The two most capable hosted families (Seedance 2.x, Kling 4.0) have no seed at all. [DOC] (S11a, S13)
- What *is* reproducible everywhere is the **request**: exact model identifier and version, host, every parameter sent (including provider defaults that were left implicit), input asset hashes, any prompt rewriting flag, and the returned job ID and usage. The product should promise "reproducible request, recorded provenance", and offer "reproducible output" only as a per-model capability flag that is true for local runs under a pinned configuration. [ASSUMED]
- Server-side prompt enhancement (Wan `prompt_extend`, LTX and BFL prompt upsamplers, MiniMax context enhancement) should be disabled where the API allows, or the rewritten prompt captured when the API returns it; otherwise the record is incomplete. [DOC] (S36, S85, S109) for the existence of these features; the rule is [ASSUMED].
- Hosted model aliases move (for example `gemini-omni-1.1-flash` now routes to 1.2). A dated or versioned model ID must be stored, and "same model ID" must not be treated as "same model". [DOC] (S3, S6)

### E.4 Customer-visible cost estimation by pricing unit

Principle: the application never pays, so the estimate exists to stop the customer from being surprised by their own provider bill. It must be labelled as an estimate, carry the currency and the date of the price snapshot, and be replaced by the provider-reported actual after the job. [ASSUMED]

| Pricing unit | Who uses it | Estimation formula | Pitfalls | Worked example (snapshot 2026-11-11) |
|---|---|---|---|---|
| Currency per output second | LTX, MiniMax H3, xAI, Wan (CNY), Veo | seconds x rate(model, resolution, tier, audio) | Rate depends on resolution and sometimes frame rate; input video seconds may be billed too (MiniMax bills input video at the same rate); regional price lists (Wan) | LTX-2.5 fast, 1080p, 10 s = 10 x 0.13 = USD 1.30. Wan 3.0, 720p, 10 s = CNY 6.00 (Beijing / Global) or about CNY 7.49 (Singapore). MiniMax H3, 768p, 10 s = USD 0.80. [DOC] (S39, S35, S29) |
| Provider "units" or credits with a fixed currency value | Kling (unit = USD 0.157 or 0.14), Runway and BFL (credit = USD 0.01), Vidu (credit = RMB 0.03125) | seconds x units-per-second x unit value | Unit value differs by model generation (Kling); minimum charges (Runway Aleph 56 credits; Seedance through Runway 80 credits); input-plus-output billing when a source video is supplied (Kling 4.0); promotions with end dates | Kling 4.0, 1080p, 10 s, no input video = 10 x 1.5 x 0.157 = USD 2.36. Runway Gen-4.5, 10 s = 120 credits = USD 1.20. Vidu Q4 Preview, 1080p, 10 s = 240 credits = RMB 7.50. [DOC] (S16, S21, S31) |
| Credits with **no** fixed currency value | Luma ("depends on your plan or contract"), ComfyUI partner credits, PixVerse | Show credits only; convert only if the customer enters their own rate | 10 s costs 3x (not 2x) the 5 s price at Luma; HDR multipliers | Luma Ray 3.2, 720p, 10 s = 300 credits; currency value not derivable. [DOC] (S27) |
| Video tokens | Seedance (RMB per 1M), Gemini Omni (USD 12 per 1M output tokens) | Seedance: tokens = (input video s + output s) x width x height x fps / 1024, then x rate / 1,000,000. Gemini: use the documented per-second equivalents | Rate drops when an input video is present but the token count rises; minimum token charge with video input; exact pixel dimensions per aspect ratio must come from the provider table; model-chosen duration (-1) cannot be estimated before the job | Seedance 2.5, 1280x720, 24 fps, 5 s, no input video: 1280 x 720 x 24 x 5 / 1024 = 108,000 tokens x 70 / 1M = RMB 7.56, matching the vendor example. Gemini Omni 720p, 10 s = about USD 0.70. [DOC] (S11d, S3) |
| Image tokens | OpenAI GPT Image | (text input tokens x 5 + image input tokens x 8 + image output tokens x 30) / 1M for GPT Image 2.x | Output token count depends on size and quality tier and was not captured from the truncated page; reference images add input-token cost | Not computed: tokens-per-image table not captured. [DOC] (S124) for rates; table [UNKNOWN] |
| Per image by size tier | Google image models, BFL FLUX 3, Seedream, Recraft, Runway image | count x rate(tier) | Tier boundaries differ by vendor; batch discounts need a different (asynchronous) API | 4 images at 2K with Nano Banana 2.1 = 4 x 0.0504 = USD 0.20. [DOC] (S3) |
| Per megapixel | BFL FLUX.2 | megapixels x rate, with a separate rate for editing | Rounding rule and whether input megapixels count were not captured | Not computed: numeric rates blank in the fetched page. [UNKNOWN] |
| Compute time | Replicate (community / open models), any customer-rented GPU | wall-clock seconds x hardware rate | Unknown before the run; cold starts; cancelled runs billed for time used | Not estimated; show a historical median once the customer has run the model. [DOC] (S54) for cancel billing |
| Local inference | all Part C / D open models | no provider charge | Time and energy, not money; the honest pre-run figure is a duration estimate from the customer's own previous runs | - |

Three tiers of estimate, in increasing trust:

1. **Static snapshot**: a signed, dated price table shipped with (or fetched by) the application, per (host, model, version). Always shown with its date. Adequate for per-second and per-image units. [ASSUMED]
2. **Live quote** where the provider exposes one with the customer's own key: LTX pricing endpoint, fal model pricing API, OpenRouter `pricing_skus`, Runware `x-pricing` in each model schema, Pika's micro-USD catalogue. [DOC] (S39, S50, S58, S60, S49)
3. **Post-hoc actual** from the job result: Seedance `usage.completion_tokens`, Kling `usage.output_duration`, Together `outputs.cost`, Runware `includeCost`. Where no usage field exists the application can only record its own estimate and say so. [DOC] (S11d, S13, S65, S60)

Additional rules that follow from the evidence: show the worst case when duration is model-chosen; show that a moderated request may still be charged at Runway; show that cancelling may not stop billing; never auto-retry a submit, because a duplicate is a second charge (B.9 item 4). [DOC] (S23, S54, S60, S36) for the underlying facts; the rules are [ASSUMED].

### E.5 What is feasible locally, and what definitely needs external compute

Details and evidence are in C.7 and D.3; this is the decision summary.

**8-12 GB Windows laptop GPU (NVIDIA), feasible:**

- Images: text-to-image and reference editing with 4B-6B few-step models (Z-Image-Turbo, FLUX.2 [klein] 4B), both Apache-2.0. [DOC] (S113, S118) for licence and size; fit at 8 GB [ASSUMED].
- Video: Wan 2.2 TI2V-5B (text and image to video, 720p / 24 fps; ComfyUI says it "should fit well on 8GB vram" with offloading); Wan 2.1 T2V-1.3B at 480p (8.19 GB peak); FramePack image-to-video from 6 GB at roughly 25-50 minutes per 5 s clip on a laptop 3060-class GPU; CogVideoX as a dated fallback. [DOC] (S77, S81, S95, S100); the FramePack per-clip time is [ASSUMED] from documented per-frame figures.
- With heavy caveats: 14B Wan checkpoints (A14B, VACE, Animate, S2V) through 4-bit GGUF or fp8 with 4-step LoRAs at 480p and at least 32 GB of system RAM. No official figure supports this; treat as experimental until measured. [ASSUMED]

**Not feasible at 8-12 GB; needs a 24-32 GB+ desktop GPU or external compute:**

- Any open model with native audio (LTX-2.5: official minimum 32 GB; MiniMax H3: 33B plus a 32B text encoder). [DOC] (S43, S85)
- 1080p-4K native video, multi-shot, multi-reference with video and audio references at frontier quality. [ASSUMED] from E.1.
- HunyuanVideo 1.5 (documented minimum 14 GB). [DOC] (S91)
- Large image models: FLUX 3 Image Klein (25-31 GB peak measured by the vendor), FLUX.2 [dev] full precision, MiniMax-H3-Image, HunyuanImage 3.0 (3-8x 80 GB). [DOC] (S109, S119, S125)

**CPU only:**

- Video generation: not practical for any surveyed model. [ASSUMED]; no vendor publishes CPU timings.
- Images: possible through stable-diffusion.cpp's CPU backend for small few-step models, at minutes per image; suitable as a "works without a GPU" fallback, not as a production path. [DOC] (S96) for the backend; timing [ASSUMED].
- Therefore a CPU-only or integrated-graphics customer who wants video has exactly two honest options: bring their own provider credentials, or bring their own remote GPU. The product must say so rather than degrade silently. [ASSUMED]

**Non-NVIDIA GPUs on Windows:** ComfyUI documents AMD (ROCm builds for RDNA 2-4) and Intel Arc paths; stable-diffusion.cpp offers Vulkan. None of the model vendors publish figures for these, and several accelerations (NVFP4, Triton-based sparse attention, `natten`) are NVIDIA- or Linux-only. Qualification must treat each GPU vendor as a separate target. [DOC] (S84, S96, S89, S94, S88); the qualification rule is [ASSUMED].

**What only in-house measurement can settle:** real generation times at 8, 12 and 16 GB; system-RAM floor for offloading (32 GB versus 64 GB); behaviour on laptop thermal limits; disk footprint per model set (single models range from about 2 GB quantised to 66 GiB for the full LTX-2.5 set). [UNKNOWN]

### E.6 Licence red flags

Open weights:

| Item | Red flag | Evidence |
|---|---|---|
| **Qwen-Image-2.1** | Research licence: non-commercial research and evaluation only, although it ships as a first-class ComfyUI tutorial and in other runtimes. The 2025 Qwen-Image / Edit line is Apache-2.0, so the family name hides a licence change. | [DOC] (S116, S115) |
| **FLUX.2 [dev], FLUX.2 [klein] 9B, FLUX.1 Kontext [dev]** | Non-commercial weight licences (cards state outputs may be used commercially, which is a distinction customers routinely misread); gated downloads. | [DOC] (S112, S113, S114) |
| **FLUX 3 Image Klein** | "Kommunity" licence: commercial output generation only below USD 5M revenue; no blanket right to commercial fine-tuning or redistribution; gated. | [DOC] (S109) |
| **LTX-2.5 / LTX-2.3** | Free commercial use only below USD 10M revenue across affiliates; gated repositories; LTX-2.3 additionally depends on a Gemma encoder under Google's terms; licence full text not read. | [DOC] (S88, S89, S90) |
| **MiniMax H3 (and probably H3-Image)** | Territory excludes the EU, UK, South Korea **and the United States**; USD 20M product-revenue threshold; mandatory prominent "MiniMax H3" display in the UI; outputs may not be used to improve other models; disclosure duty for public machine-generated content. | [DOC] (S86); H3-Image terms [UNKNOWN] |
| **HunyuanVideo 1.5, HunyuanImage 3.0, probably FramePack's underlying weights** | Tencent community licence territory excludes the EU, UK and South Korea, and use outside the territory is prohibited; 100M MAU threshold; outputs may not be used to improve other models. | [DOC] (S92) for HunyuanVideo 1.5; [ASSUMED] for the others (licence texts not read) |
| **Stable Diffusion 3.5** | Free only below USD 1M revenue; gated; Replicate requires a direct Stability licence. | [DOC] (S126, S57) |
| **Krea-2** | Custom community licence with a content-filtering duty on deployers; thresholds not read. | [DOC] (S122); terms [UNKNOWN] |
| **Ideogram 4.0 open model, SkyReels-V3 ("skywork-license"), CogVideoX-5B ("CogVideoX License"), CogVideoX1.5** | Licence not stated or not read. Must not be offered until the text is reviewed. | [DOC] (S120, S101, S100) for the licence names; terms [UNKNOWN] |
| **HiDream-I1** | MIT weights but a mandatory Llama-3.1-8B text encoder under Meta's gated licence. The effective licence is the most restrictive component. | [DOC] (S128) |
| **Community derivatives** (quantised re-uploads, "uncensored" fine-tunes, pruned variants, distillation LoRAs, ControlNets) | Inherit the upstream licence and acceptable-use policy; often omit the licence file; may strip safety behaviour that the upstream licence requires. A GGUF of a research-only model is still research-only. | [IND] (S82, S99, S105) for existence; the legal reading is [ASSUMED] |
| **Gated downloads generally** | An application cannot lawfully pre-accept a licence for the customer; the customer must accept under their own Hugging Face account, and bundling such weights in an installer would be redistribution. | [DOC] (S90, S109, S112) for gating; the reading is [ASSUMED] |

Permissively licensed set found (Apache-2.0 or MIT, no territorial or revenue terms in the fetched text): Wan 2.1, Wan 2.2 (T2V / I2V / TI2V / S2V / Animate), Wan-Animate-2, FLUX.2 [klein] 4B, Z-Image / Z-Image-Turbo, Qwen-Image 2025 line (20B, Edit, Edit-2509, Edit-2511, Layered, 2512), CogVideoX-2B, Mochi 1, MAGI-1, LongCat-Video, FramePack code, Self-Forcing, HiDream-I1 (weights only), and the runtimes stable-diffusion.cpp (MIT) and LightX2V (Apache-2.0). [DOC] (S76, S80, S81, S113, S118, S115, S100, S102, S103, S104, S95, S98, S128, S96, S97)

Hosted services:

| Item | Red flag | Evidence |
|---|---|---|
| PixVerse first-party API | Commercial profit-making use and third-party app integration "for resale or sharing" prohibited without written authorisation; qualification documents required. | [DOC] (S33) |
| Kling | Key may be used only for "your Client Application" and not disclosed to third parties; no resale; unspecified geographic scope. | [DOC] (S18) |
| Runway | "Powered by Runway" attribution; moderated requests charged; a monitoring service reports account and key ownership vesting in Runway and a ban on training competing models. | [DOC] (S23); [IND] (S25) |
| fal, Replicate | Credentials may not be shared; APIs may not be exposed directly to end users or re-provided as a service; on Replicate the model's own licence applies in addition. | [DOC] (S52, S57) |
| ComfyUI partner nodes | Customer's own provider keys are not supported; requires Comfy account and prepaid credits. Violates the "customer's own credentials" rule if left enabled. | [DOC] (S63) |
| Vercel AI Gateway | BYOK requests can fall back to Vercel system credentials billed to the team. | [DOC] (S70) |
| OpenRouter | Video endpoints treated as retaining data; zero-data-retention guardrail blocks video. | [DOC] (S59) |
| OpenAI images | Organisation verification required. Sora API removed. | [DOC] (S123, S1) |
| Google | Veo requires a Google Cloud project in one US region; Gemini Omni disables editing and extension in the EEA, Switzerland and the UK and restricts recognisable people; SynthID watermark always on. | [DOC] (S5, S7) |
| BytePlus (Seedance, Seedream) | Not offered in the United States; real-face inputs restricted; visible watermark plus C2PA per vendor post. | [CLAIM] (S9) |
| Midjourney | No official API; automation prohibited per secondary sources. | [IND] (S45-note) |
| Output ownership | Stated as the customer's at Kling, fal (no claim), Replicate (assigned, subject to third-party terms), MiniMax and Tencent open licences (no claim). Not read for Runway, Luma, Google, OpenAI, BFL, Ideogram, Recraft, Vidu, xAI. | [DOC] (S18, S52, S57, S86, S92); the rest [UNKNOWN] |

### E.7 Implications for the Universal Model System

All items below are my inferences from Parts A-E. [ASSUMED]

1. **Identity is (host, model slug, version, variant), never a family name.** The same family differs by host (first-party, reseller, aggregator), by version alias, by hosted versus open variant, and by region.
2. **Capabilities are per-identity data with three states** (supported, unsupported, unverified), each with a source and a date, and with typed limits (counts, durations, resolutions, regions) rather than booleans. Seeding the registry from machine-readable catalogues (OpenRouter `/videos/models`, Runware per-model JSON Schema) is possible but those describe the aggregator's view.
3. **Operations must be defined by the platform, not borrowed from vendor names.** "Edit", "extend" and "reference" each cover several incompatible behaviours. An adapter either implements the platform's definition exactly or declares the operation unsupported; it must never silently approximate (for example by dropping a last frame).
4. **The job contract is the portable layer**: submit, persist provider job ID before anything else, poll (webhooks are unusable for a desktop application without a public receiver), download immediately, verify, record usage. Cancel is "best effort, may still bill". Submit is never retried automatically.
5. **Licence is a first-class, machine-checked field on every model and every derivative file**: licence name, commercial flag, revenue threshold, territorial exclusions, attribution or UI-branding duty, gating, output restrictions, dependency licences (text encoders). The customer's declared territory and commercial status should gate what the application offers, and unknown licences should default to "not offered".
6. **Local video is a tiered promise.** Guaranteed tier: images at 8 GB. Supported tier: 5B-class video at 8-12 GB with measured timings. Enthusiast tier: 14B-class video at 16-24 GB. Everything else is "bring your own compute or provider". No tier depends on a paid service.
7. **Cost display follows E.4**, and credit-denominated providers with no currency conversion are shown in credits.
8. **Retired and prohibited routes stay in the registry as explicit negative entries** (Sora, Marey, Nova Reel, Midjourney, PixVerse without authorisation, ComfyUI partner nodes), so that they are not re-added from stale 2025 knowledge.

---

## 8. Open questions and gaps

### 8.1 Legal and commercial questions (need counsel or vendor confirmation)

1. Does a third-party desktop application, run locally by a customer with the customer's own account and key, fall inside or outside the credential-sharing and "do not expose the API to end users" clauses of fal, Replicate, Kling and Runway? The terms address developers who share one key; none addresses this pattern explicitly.
2. Does Runway's "Powered by Runway" duty attach to a bring-your-own-key client, and if so where must the mark appear?
3. Can the application lawfully *facilitate* the download of gated or territorially restricted weights (MiniMax H3, Tencent Hunyuan, LTX-2.5, FLUX non-commercial models) when the customer accepts the licence under their own account, and what must the application check or record (territory, revenue band, commercial intent)?
4. What exactly do the unread licence texts say: LTX-2.x Community License, Krea 2 Community License, MiniMax-H3-Image Community License, skywork-license, CogVideoX License, the Ideogram 4.0 open model's licence, FLUX.1 Krea [dev], and the licences of third-party Wan derivatives (Fun, InfiniteTalk, Wan-Move, VACE repository)?
5. Is FramePack's underlying model under the Tencent community licence (which would import the EU / UK / South Korea exclusion)?
6. Output ownership and commercial-use terms for Google, OpenAI, Luma, BFL, Ideogram, Recraft, Vidu, xAI and Runway were not read.
7. Is BytePlus ModelArk's unavailability in the United States an account-eligibility rule, an endpoint-location rule, or both, and what is fal's "Seedance 2.5 US" listing in that context?
8. Do the MiniMax and Tencent "do not use outputs to improve other AI models" clauses constrain a customer who later trains a LoRA on their own generated footage?

### 8.2 Technical questions (need in-house qualification or further fetching)

1. Measured generation time, peak VRAM, peak system RAM and failure modes on Windows for each candidate local model at 8, 12, 16 and 24 GB, on NVIDIA, AMD and Intel GPUs, per runtime (ComfyUI, stable-diffusion.cpp, WanGP). No official data exists below 24 GB.
2. Whether 14B Wan checkpoints are usable at 8 GB in practice, and the minimum system RAM for offloading.
3. Whether quantised community builds of LTX-2.5 and MiniMax H3 are usable at 16-24 GB, and their quality loss.
4. Output determinism of each local runtime under a pinned configuration (same seed, same machine; same seed, different GPU).
5. Seed, cancel, webhook and idempotency behaviour for the vendors where the fetched pages were silent (Gemini Omni, Veo, Luma, MiniMax, LTX, xAI, Vidu) and for all hosted image APIs.
6. Numeric BFL prices; OpenAI tokens-per-image table; Vertex Veo official prices; BytePlus USD prices; PixVerse and Luma credit values.
7. Reference-image limits and edit operations for Gemini image models and Seedream 5.0.
8. Whether HappyHorse has a genuine, complete open-weight release and under what licence.
9. Status of models not researched: Open-Sora, Pyramid Flow, CausVid, original HunyuanVideo / Custom / Avatar, SkyReels V2 / A2, Kandinsky 5, Cosmos Predict2, Vimoo-1.0, Adobe Firefly video, Hedra, Decart, HeyGen, Imagen.
10. Which embedded runtime the product should standardise on (Python-based ComfyUI versus C++ stable-diffusion.cpp), given day-one model coverage versus footprint and non-NVIDIA support.

### 8.3 Pages that could not be fetched or were only partly read

| Page | Result | Effect on the report |
|---|---|---|
| docs.byteplus.com (ModelArk international docs) | JavaScript-rendered; navigation only | Seedance parameters taken from Volcengine docs; international parity [ASSUMED]; USD prices [IND] only |
| docs.midjourney.com and Midjourney terms | HTTP 403 | Nothing about Midjourney is [DOC] |
| Google Cloud Vertex AI pricing page | Body truncated | Veo prices are [IND] only |
| PixVerse platform docs (docs.platform.pixverse.ai) | HTTP 404 | Capabilities and credits from a search-indexed summary [IND] |
| docs.agents.lumalabs.ai/llms.txt | HTTP 404 | Luma webhook / cancel pages not located |
| Runway Terms of Use; Vidu terms | Not fetched | Runway terms known through a monitoring service [IND]; Vidu terms [UNKNOWN] |
| fal webhook page; fal per-model pages | Not fetched | Webhook signature and per-model prices not recorded |
| Runware, Together, DeepInfra, WaveSpeed, AIMLAPI, Segmind terms and full catalogues | Not fetched | Terms [UNKNOWN] in B.0 |
| Novita docs index | HTTP 404 | Not covered |
| Wan 2.1 and Wan 2.2 computational-efficiency tables | Published as images | Per-GPU VRAM and time for the 14B models not extracted |
| Hugging Face organisation pages | Only the first models of each list returned | Organisation inventories may be incomplete |
| huggingface.co/Lightricks/LTX-2.5/blob/main/LICENSE | HTTP 404 (guessed URL) | LTX licence known only from the model-card summary |
| krea.ai/krea-2-licensing | Fetch error ("Header overflow") | Krea-2 thresholds [UNKNOWN] |
| developer.ideogram.ai/llms.txt | Stub; `/v2/llms.txt` gave an index only | Ideogram prices, terms and URL expiry not recorded |
| bfl.ai/pricing (calculator) | Not fetched; docs pricing page had blank numeric cells | BFL numeric prices [UNKNOWN] |
| OpenAI image-generation guide; Google Gemini pricing page | Truncated at the fetch size limit | Tails not read (per-image token tables, moderation, provenance, Imagen) |
| MiniMax-H3-Image licence; skywork-license; HunyuanImage 3.0 licence; CogVideoX License; FLUX.1 Krea [dev] card | Not fetched | Marked [UNKNOWN] / [ASSUMED] in C and D |
| Open-Sora, Pyramid Flow, CausVid, HunyuanVideo (original), HunyuanCustom, HunyuanVideo-Avatar, SkyReels V2 / A2, VACE repository, alibaba-pai Fun repositories, Kandinsky 5, Cosmos Predict2 | Not fetched (search budget exhausted; direct fetches prioritised elsewhere) | Listed as not researched |

---

## 9. Sources

Access date for all entries: **2026-11-11**. "Search result" means the item was seen in web-search output earlier in the session and not necessarily fetched in full; such items are only ever used with the [IND] label.

### 9.1 Hosted video vendors (Part A)

- S1 — OpenAI API deprecations: https://developers.openai.com/api/docs/deprecations
- S1-ind — third-party Sora shutdown reports (search results): https://dev.to/mr_manushukla/sora-2-and-the-videos-api-shut-down-on-24-september-2026-the-migration-and-the-real-cost-per-second-bek ; https://wavespeed.ai/blog/ai-guides/sora-2-api-shutdown-migration-guide/ ; https://benchlm.ai/media-pricing/sora
- S2 — OpenAI models: https://developers.openai.com/api/docs/models
- S3 — Google Gemini API pricing: https://aistudio.google.com/docs/pricing
- S4 — Google Gemini API video (Veo) page: https://aistudio.google.com/docs/video
- S5 — Google Gemini Omni guide: https://aistudio.google.com/docs/omni
- S6 — Google Gemini API deprecations: https://aistudio.google.com/docs/deprecations
- S7 — Vertex AI Veo 3.1 model page: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate
- S8-ind — third-party Veo price reports (search results): https://the-decoder.com/googles-veo-3-1-lite-cuts-video-generation-costs-by-more-than-half/ ; https://benchlm.ai/media-pricing/veo
- S9 — BytePlus blog, Seedance 2.5: https://byteplus.com/en/blog/dreamina-seedance2-5
- S10 — ByteDance Seed blog, Seedance 2.5: https://seed.bytedance.com/en/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5
- S11a — Volcengine Ark video generation API (create task): https://docs.volcengine.com/docs/82379/1520757
- S11b — BytePlus ModelArk docs (navigation only): https://docs.byteplus.com/
- S11c — Volcengine Ark cancel / delete task: https://docs.volcengine.com/docs/82379/1521720
- S11d — Volcengine Ark pricing: https://docs.volcengine.com/docs/82379/1099320
- S11-ind — third-party Seedance identifiers and prices (search results): https://www.atlascloud.ai/blog/seedance-2.0-pricing-full-cost-breakdown-2026 ; https://the-decoder.com/bytedances-seedance-2-5-generates-30-second-video-clips-with-built-in-audio/
- S12 — Kling API docs index: https://kling.ai/document-api/llms.txt
- S13 — Kling 4.0 image-to-video: https://kling.ai/document-api/api/video/4-0/image-to-video.md
- S14 — Kling 4.0 omni video: https://kling.ai/document-api/api/video/4-0/video-omni.md
- S15 — Kling callbacks: https://kling.ai/document-api/api/get-started/callbacks.md
- S16 — Kling video pricing: https://kling.ai/document-api/pricing/base/video.md
- S17 — Kling video capability map: https://kling.ai/document-api/guides/capability-map/video.md
- S18 — Kling paid-service protocol: https://kling.ai/document-api/guides/protocols/paid-service.md
- S19 — Kling concurrency rules: https://kling.ai/document-api/api/get-started/concurrency-rules.md
- S20 — Kling Video 3 model user guide: https://kling.ai/quickstart/klingai-video-3-model-user-guide
- S20-ind — Kling 4.0 launch press release (search result): https://bernama.com/en/press/news.php?id=2622471
- S21 — Runway API pricing: https://docs.dev.runwayml.com/guides/pricing/
- S22 — Runway API reference: https://docs.dev.runwayml.com/api/
- S23 — Runway core API text: https://docs.dev.runwayml.com/_llms-txt/core-api.txt
- S24 — Runway outputs: https://docs.dev.runwayml.com/assets/outputs/
- S25 — terms-monitoring summary of Runway Terms of Use (third party): https://conductatlas.com/platform/runway/runway-terms-of-service/api-use-requires-prominent-powered-by-runway-display/
- S26 — Luma Agents API model guide: https://docs.agents.lumalabs.ai/guides/model
- S27 — Luma Agents API pricing: https://docs.agents.lumalabs.ai/guides/pricing/
- S27-ind — third-party Luma credit-value reports (search results): https://wavespeed.ai/blog/cost-and-billing/luma-ai-pricing/ ; https://www.atlascloud.ai/blog/guides/luma-ray-3-api-guide
- S28 — Luma "llm-info" page (vendor marketing; contains text addressed to AI assistants, treated as data): https://lumalabs.ai/llm-info
- S29 — MiniMax pricing: https://platform.minimax.io/docs/pricing/overview
- S30 — MiniMax video generation guide: https://platform.minimax.io/docs/guides/video-generation
- S31 — Vidu pricing: https://platform.vidu.com/docs/overview/pricing
- S32 — Vidu cancel task: https://platform.vidu.com/docs/api-reference/task-management/cancel-task
- S32b — Vidu callback signature: https://platform.vidu.com/docs/api-reference/other-documentation/callback-signature
- S33 — PixVerse Platform Terms of Service: https://pixverse.ai/de/pixverse-platform-terms-of-service
- S34 — PixVerse platform docs V6 page (HTTP 404 on fetch; search-indexed summary only): https://docs.platform.pixverse.ai/v6-2056814m0
- S35 — Alibaba Cloud Model Studio, Wan 3.0 video: https://help.aliyun.com/en/model-studio/wan3-0-video
- S35-ind — third-party reports on Wan 3.0 open-weight status (search results): https://wavespeed.ai/blog/video-model-access/is-wan-3-0-open-source/ ; https://www.atlascloud.ai/blog/tips/wan-3.0-preview
- S36 — Alibaba Cloud Model Studio text-to-video API reference: https://www.alibabacloud.com/help/en/model-studio/text-to-video-api-reference
- S37 — xAI Grok Imagine Video 1.5 model page: https://docs.x.ai/developers/models/grok-imagine-video-1.5
- S37-ind — third-party report of xAI per-resolution prices (search result): https://dev.to/creeta/a-10-second-grok-imagine-15-clip-at-720p-runs-141-24ol
- S38 — xAI video generation guide: https://docs.x.ai/developers/model-capabilities/video/generation
- S39 — LTX API pricing: https://docs.ltx.io/pricing.md
- S40 — LTX docs index: https://docs.ltx.io/llms.txt
- S41 — LTX async jobs: https://docs.ltx.io/async-jobs.md
- S42 — LTX-2.5 model page: https://docs.ltx.io/models/ltx-2-5.md
- S43 — LTX open-source system requirements: https://docs.ltx.io/open-source-model/getting-started/system-requirements.md
- S44 — LTX open-source overview: https://docs.ltx.io/open-source-model/getting-started/overview.md
- S45-note — Midjourney: official docs returned HTTP 403; secondary sources only (search results): https://wavespeed.ai/blog/posts/what-is-midjourney-v8-features-pricing-how-to-use-2026 ; https://dev.to/_37bbf0c253c0b3edec531e/midjourney-v1-video-price-and-compare-to-competitors-2l35 ; https://www.atlascloud.ai/models/midjourney
- S46 — ComfyUI Moonvalley partner-node page: https://docs.comfy.org/tutorials/partner-nodes/moonvalley/moonvalley-video-generation
- S46-ind — secondary reports on Moonvalley / Marey (search results; one exact URL not retained): https://infer.reka.ai/leaderboards
- S47 — Artificial Analysis text-to-video leaderboard (search snippet): https://artificialanalysis.ai/video/leaderboard/text-to-video
- S48 — third-party HappyHorse reports and listings (search results): https://www.atlascloud.ai/blog/ai-updates/happyHorse-hits-1-api-coming-soon ; https://302.ai/product/detail/tongyi-happyhorse-1.0-i2v
- S49 — Pika developer API: https://dev.pika.art/
- S49-ind — earlier search results describing Pika models served through fal.ai (exact URLs not retained)

### 9.2 Aggregators and marketplaces (Part B)

- S50 — fal docs index: https://fal.ai/docs/llms.txt
- S51 — fal queue submit reference: https://fal.ai/docs/api-reference/inference-api/queue/submit.md
- S52 — fal terms: https://fal.ai/terms
- S53 — fal model explorer (text-to-video): https://fal.ai/explore/models?categories=text-to-video
- S54 — Replicate prediction lifecycle: https://replicate.com/docs/topics/predictions/lifecycle
- S55 — Replicate data retention: https://replicate.com/docs/topics/predictions/data-retention
- S56 — Replicate text-to-video collection: https://replicate.com/collections/text-to-video
- S57 — Replicate terms: https://replicate.com/terms
- S58 — OpenRouter docs index and video cookbook: https://openrouter.ai/docs/llms.txt ; https://openrouter.ai/docs/cookbook/video-generation/text-to-video.md ; https://openrouter.ai/docs/cookbook/video-generation/choose-video-model.md ; https://openrouter.ai/docs/cookbook/video-generation/provider-specific-video-options.md
- S59 — OpenRouter BYOK: https://openrouter.ai/docs/guides/overview/auth/byok
- S60 — Runware docs index: https://runware.ai/docs/llms.txt
- S61 — Hugging Face Inference Providers, text-to-video task: https://huggingface.co/docs/inference-providers/tasks/text-to-video
- S62 — Hugging Face Inference Providers pricing: https://huggingface.co/docs/inference-providers/pricing
- S63 — ComfyUI partner nodes overview: https://docs.comfy.org/tutorials/partner-nodes/overview
- S64 — ComfyUI partner nodes pricing: https://docs.comfy.org/tutorials/partner-nodes/pricing
- S65 — Together AI videos overview: https://docs.together.ai/docs/videos-overview
- S66 — DeepInfra text-to-video models: https://deepinfra.com/models/text-to-video
- S67 — Amazon Bedrock model cards: https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html
- S68 — Amazon Bedrock Nova Reel model card: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html
- S69 — Vercel AI Gateway video generation: https://vercel.com/docs/ai-gateway/modalities/video-generation
- S70 — Vercel AI Gateway BYOK: https://vercel.com/docs/ai-gateway/authentication-and-byok/byok
- S71 — Azure AI Foundry video generation: https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/video-generation
- S72 — WaveSpeedAI docs: https://wavespeed.ai/docs ; https://wavespeed.ai/docs/rest-api ; https://wavespeed.ai/docs/data-retention-policy
- S73 — AIMLAPI video models: https://docs.aimlapi.com/api-references/video-models
- S74 — Segmind docs: https://docs.segmind.com/
- S75 — Vertex AI Model Garden overview: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models

### 9.3 Open-weight video models and runtimes (Part C)

- S76 — Wan 2.2 repository: https://github.com/Wan-Video/Wan2.2
- S77 — ComfyUI Wan 2.2 tutorial: https://docs.comfy.org/tutorials/video/wan/wan2_2.md
- S78 — Wan-AI organisation on Hugging Face: https://huggingface.co/Wan-AI
- S79 — ComfyUI Wan Animate 2 tutorial: https://docs.comfy.org/tutorials/video/wan/wan-animate-2.md
- S80 — Wan2.2-Animate-2-14B model card: https://huggingface.co/Wan-AI/Wan2.2-Animate-2-14B
- S81 — Wan 2.1 repository: https://github.com/Wan-Video/Wan2.1
- S82 — community GGUF of Wan 2.2 TI2V-5B (third party): https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF
- S83 — ComfyUI tutorials index: https://docs.comfy.org/_llms/en/tutorials.txt
- S84 — ComfyUI system requirements: https://docs.comfy.org/installation/system_requirements.md
- S85 — MiniMax on Hugging Face and MiniMax-H3 model card: https://huggingface.co/MiniMaxAI ; https://huggingface.co/MiniMaxAI/MiniMax-H3
- S86 — MiniMax H3 Community License Agreement: https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE
- S87 — ComfyUI MiniMax H3 native tutorial: https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native.md
- S88 — LTX-2 repository: https://github.com/Lightricks/LTX-2
- S89 — LTX-2.5 model card and Lightricks organisation: https://huggingface.co/Lightricks/LTX-2.5 ; https://huggingface.co/Lightricks
- S90 — ComfyUI LTX-2.5 tutorial: https://docs.comfy.org/tutorials/video/ltx/ltx-2-5.md
- S91 — HunyuanVideo 1.5 repository and model card: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5 ; https://huggingface.co/tencent/HunyuanVideo-1.5
- S92 — Tencent Hunyuan Community License Agreement (HunyuanVideo 1.5): https://huggingface.co/tencent/HunyuanVideo-1.5/blob/main/LICENSE
- S93 — ComfyUI HunyuanVideo 1.5 tutorial: https://docs.comfy.org/tutorials/video/hunyuan/hunyuan-video-1-5.md
- S94 — WanGP / Wan2GP repository and model notes: https://github.com/deepbeepmeep/Wan2GP ; https://github.com/deepbeepmeep/Wan2GP/blob/main/docs/MODELS.md
- S95 — FramePack repository: https://github.com/lllyasviel/FramePack
- S96 — stable-diffusion.cpp repository: https://github.com/leejet/stable-diffusion.cpp
- S97 — LightX2V repository: https://github.com/ModelTC/LightX2V
- S98 — Self-Forcing repository: https://github.com/guandeh17/Self-Forcing
- S99 — Hugging Face trending text-to-video models: https://huggingface.co/models?pipeline_tag=text-to-video&sort=trending
- S100 — CogVideo repository: https://github.com/zai-org/CogVideo
- S101 — SkyReels-V3 repository and model card: https://github.com/SkyworkAI/SkyReels-V3 ; https://huggingface.co/Skywork/SkyReels-V3-R2V-14B
- S102 — Mochi repository: https://github.com/genmoai/mochi
- S103 — MAGI-1 repository: https://github.com/SandAI-org/MAGI-1
- S104 — LongCat-Video repository: https://github.com/meituan-longcat/LongCat-Video
- S105 — community fine-tune example (third party): https://huggingface.co/SulphurAI/Sulphur-2-base

### 9.4 Image models (Part D)

- S106 — Black Forest Labs docs index: https://docs.bfl.ai/llms.txt
- S107 — BFL pricing (docs): https://docs.bfl.ml/quick_start/pricing.md
- S108 — BFL integration guidelines: https://docs.bfl.ml/api_integration/integration_guidelines.md
- S109 — FLUX 3 Image Klein docs and model card: https://docs.bfl.ml/flux_3/flux3_image_klein.md ; https://huggingface.co/black-forest-labs/flux-3-image-klein
- S110 — ComfyUI FLUX 3 Klein tutorial: https://docs.comfy.org/tutorials/flux/flux-3-klein.md
- S111 — Black Forest Labs organisation on Hugging Face: https://huggingface.co/black-forest-labs
- S112 — FLUX.2 [dev] model card: https://huggingface.co/black-forest-labs/FLUX.2-dev
- S113 — FLUX.2 [klein] 4B model card: https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- S114 — FLUX.1 Kontext [dev] model card: https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev
- S115 — Qwen-Image repository: https://github.com/QwenLM/Qwen-Image
- S116 — Qwen-Image-2.1 model card and licence: https://huggingface.co/Qwen/Qwen-Image-2.1 ; https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE
- S117 — ComfyUI Qwen-Image-2.1 tutorial: https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1.md
- S118 — Z-Image repository and ComfyUI tutorial: https://github.com/Tongyi-MAI/Z-Image ; https://docs.comfy.org/tutorials/image/z-image/z-image-turbo.md
- S119 — MiniMax-H3-Image model card and ComfyUI tutorial: https://huggingface.co/MiniMaxAI/MiniMax-H3-Image ; https://docs.comfy.org/tutorials/image/minimax/minimax-h3-image.md
- S120 — ComfyUI Ideogram 4.0 open-source model tutorial: https://docs.comfy.org/tutorials/image/ideogram/ideogram-v4.md
- S121 — Ideogram developer docs index: https://developer.ideogram.ai/v2/llms.txt
- S122 — Krea-2 ComfyUI tutorial and model card: https://docs.comfy.org/tutorials/image/krea/krea-2.md ; https://huggingface.co/krea/Krea-2-Turbo
- S123 — OpenAI image generation guide (truncated on fetch): https://developers.openai.com/api/docs/guides/image-generation
- S124 — OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- S125 — HunyuanImage 3.0 repository and model card: https://github.com/Tencent-Hunyuan/HunyuanImage-3.0 ; https://huggingface.co/tencent/HunyuanImage-3.0
- S126 — Stable Diffusion 3.5 Large model card: https://huggingface.co/stabilityai/stable-diffusion-3.5-large
- S127 — Recraft API docs: https://www.recraft.ai/docs
- S128 — HiDream-I1 repository: https://github.com/HiDream-ai/HiDream-I1

End of report.
