# Competitive research 02: Runway, Kling, Luma, Pika (state as of 2026-11-11)

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Prepared for: product strategy for a local-first AI creative production platform.
Access date for every source: 2026-11-11.

## 0. How to read this report

### Evidence labels

Every factual claim carries exactly one label.

- **[DOC]** stated on an official product, docs, pricing, changelog or terms page. The source ID after the label resolves to a URL in section 9.
- **[CLAIM]** vendor marketing or PR that is not independently confirmed.
- **[IND]** independent third-party observation (press, review site, user-review aggregator).
- **[ASSUMED]** my inference or arithmetic from labelled facts.
- **[UNKNOWN]** could not be determined from the sources reached.

Citation form: `[DOC: R-PRICE]` means label DOC, source ID R-PRICE in section 9.

### Method limits that affect confidence

1. **Nothing here is hands-on.** No product was used, no account was created, nothing was signed in to, downloaded or submitted. All statements about behaviour come from documents or third-party reports.
2. **Pages were read through an automated fetch-and-extract tool**, which returns a machine summary of each page rather than the raw text. Short quoted phrases are as returned by that tool. Before any quote or number is published externally, re-open the cited URL and confirm the wording.
3. **The web-search budget for this session ran out part-way through** (after the Runway and Kling passes, during Luma, before Pika). From that point only direct fetches of known URLs were possible. Consequence: independent coverage of Luma and Pika, and independent hands-on reviews of Runway's 2026 features, is thinner than intended. Where an independent view is missing it is marked [UNKNOWN] rather than filled with vendor text.
4. **Pages that could not be fetched** are listed in section 8 and are never guessed at.
5. **Trustpilot data is a biased sample.** All four profiles are unclaimed or uninvited, Trustpilot does not fact-check reviews, and only the first page of reviews was read. Treat it as evidence of what complaint themes exist, not of how common they are.
6. Many "2026 review" pages for these products are affiliate or reseller content. They are used sparingly and labelled [IND] with the caveat stated.

---

## 1. Runway (runway.com; runwayml.com redirects there)

### 1.1 Flagship models and modalities

- Gen-4.5 is the current first-party generation model: released 2025-12-11 to all paid plans; image-to-video added 2026-01-21. [DOC: R-CHG]
- Gen-4.5 supports text-to-video and image-to-video only; the help article says support for additional inputs is "coming soon". [DOC: R-GEN45]
- Gen-4.5 limits: 2 to 10 s, 720p-class output (16:9 1280x720, 9:16, 1:1 960x960, 4:3 1104x832, 3:4, 21:9 1584x672), 24 or 25 fps, 12 credits per second. [DOC: R-GEN45]
- Aleph 2.0 with "Edit Studio" (2026-05-21) is the video-to-video editing model. Input clip 2 to 30 s (longer is auto-trimmed), 480p to 1080p, 24 to 30 fps, at most 10 cuts, conventional aspect ratios only. [DOC: R-EDIT]
- Edit Studio works by editing a still keyframe and propagating the edit through the clip ("Single edit" mode, with optional extra motion and ranged edit). "Multi-edit and Expand modes coming soon." [DOC: R-EDIT]
- Act-Two is the performance-capture model: a driving performance video plus a character image or video; up to 30 s, 24 fps, 720p-class, 5 credits per second with a 3 s minimum; gesture control and voice change. [DOC: R-ACT2]
- The standalone Lip Sync tool was retired in favour of Act-Two (2026-05-27). [DOC: R-DEPR]
- Standalone Inpainting, Frame Interpolation, Super-Slow-Mo, Motion Tracking and Remove Background tools were deprecated on 2026-04-10; Gen-3 Alpha and Turbo are retired. [DOC: R-DEPR]
- Replacement utilities arrived as models: SAM3 video segmentation with transparent WebM output (2026-07-28), Enhance Frame Rate up to 4K and 5 minutes on Max and above (2026-09-17), "Runway Ruby" SDR-to-HDR grading model (2026-08-20). [DOC: R-CHG]
- Upscaling: 4K upscaling on Standard and above, "unlimited" 4K upscaling on Pro. [DOC: R-PRICE]
- Audio: "Seed Audio 1.0" (2026-06-29) and ElevenLabs V4 (2026-09-29) were added; Veo 3.1 with audio is hosted. [DOC: R-CHG]
- Whether Gen-4.5 itself generates native audio. [UNKNOWN]
- Dedicated camera-control parameters, multi-keyframe (first/last frame) input, or extend for Gen-4.5. [UNKNOWN] The Gen-4.5 article lists only text and a single image as inputs. [DOC: R-GEN45]
- References: image, video, audio and 3D-model references with @-mention syntax; saved references are reusable across sessions and shareable within a workspace. [DOC: R-REF]
- Runway now hosts many third-party models next to its own: Kling 3.0 and 4.0, Seedance 2.0 and 2.5, Veo 3.1, Wan 3.0, Sora 2 Pro, Gemini Omni Flash and others, plus "Model Routers" (2026-07-21). [DOC: R-CHG]
- GWM-1 "general world model" (Worlds, Avatars, Robotics) was announced 2025-12-11. [CLAIM: R-GWM] Real-time "Runway Characters" avatars shipped 2026-03-09 (API plus web demo). [DOC: R-CHG]

### 1.2 Product workflow

- The primary creation surface is now a chat-based Agent; a multi-track timeline lives in the Agent panel's "Final Cut" tab. [DOC: R-TL]
- Timeline capabilities documented: multiple tracks, drag and drop video, split, trim, move between tracks, split audio to its own track, Detect Shots, minimum clip about 0.1 s. [DOC: R-TL]
- "Images are not currently supported in the timeline." [DOC: R-TL]
- Export from the timeline is a download of a finished video. The article mentions no XML, EDL, AAF or OTIO export. [DOC: R-TL]
- Whether any interchange export (OTIO/EDL/XML) exists elsewhere in the product. [UNKNOWN]
- A Runway help article recommends a local video editor for larger projects and gives a 35 GB export ceiling. [DOC: R-HELP-SNIP] Low confidence: seen only as a search-result snippet of a help.runwayml.com article; the article itself was not opened.
- "Studio" (2026-06-18) added trim, stitch, reorder and export. [DOC: R-CHG]
- Node-based Workflows (2025-10-24), compositing nodes in Workflows (2026-08-18), Workflows publishable as Apps (2025-12-04), "App Studio" to build and host custom creative apps from a description (2026-10-26). [DOC: R-CHG]
- NLE integration is by plugin, not interchange: a Premiere Pro and After Effects panel that places Aleph 2 results into the host timeline (2026-09-08) and a DaVinci Resolve plugin (2026-09-23). [DOC: R-CHG]
- Professional outputs: ProRes 4444 and PNG-sequence export for Gen-4.5 and Aleph 2 (2026-08-10). [DOC: R-CHG]
- Conflict: the changelog lists that export as "Pro+", while help articles say Max, Unlimited Legacy or Enterprise. [DOC: R-CHG, R-GEN45] The pricing page puts "studio-grade generations (HDR, ProRes, image sequences)" on Max. [DOC: R-PRICE]
- ProRes or PNG-sequence output must be chosen at generation time and costs 5 extra credits per second. [DOC: R-GEN45]
- Via the API: H.264 MP4, ProRes 422 Proxy through 4444 XQ, PNG sequence zip, 10-bit Rec.709, HDR10, HLG, 12-bit PQ master, 16-bit PNG sequence, half-float OpenEXR in linear BT.2020, and ACEScg EXR. Native HDR is Gen-4.5 only. [DOC: R-API-PRO]
- Alpha channel on generated video is not described; alpha appears only as SAM3 transparent WebM and Ruby alpha passthrough. [DOC: R-API-PRO, R-CHG]
- Project structure: number of projects is capped by plan (3 on Standard, 5 on Pro, 10 on Max). [DOC: R-PRICE] Projects inside Agent are Enterprise-only. [DOC: R-AGENT]
- Collaboration: Team plan (2026-09-04; 2 to 9 seats, 6,900 shared credits per seat, 1 TB), comments on assets (Enterprise, 2026-08-07), Agent callable from asset comments (2026-09-15), per-project credit caps (Enterprise, 2026-10-09). [DOC: R-CHG]
- What stays editable versus flattened: generations are discrete rendered clips; edits are new generations kept in a "versions" feed. [DOC: R-EDIT] Node Workflows built by the Agent can be inspected and edited. [DOC: R-CHG] There is no documented parametric re-render of a shot from a stored recipe on the timeline. [ASSUMED]

### 1.3 Character and world consistency

- Mechanisms offered: saved multi-modal References, Agent-produced character sheets and storyboards, Act-Two for performance onto a fixed character, Brand Kits on Pro and Max. [DOC: R-REF, R-AGENT, R-PRICE]
- A "Custom Elements" help article exists and an "ML Lab Deprecation" article indicates the older custom-model training feature was retired; neither was read. [UNKNOWN]
- Independent view: Trustpilot reviewers in late 2026 report inconsistent characters and ignored prompts among their complaints. [IND: T-RUNWAY]
- Independent hands-on evaluation of Gen-4.5 or Agent multi-shot consistency. [UNKNOWN] (search budget exhausted before this pass)

### 1.4 Agentic and assistant features

- Runway Agent launched 2026-05-13; Agent 2.0 on 2026-06-25; Agent Skills 2026-07-02; Custom Agent Skills 2026-07-08; Timeline in Agent 2026-07-09; Agent Workflows 2026-07-23. [DOC: R-CHG]
- The Agent plans, produces and edits images, single and multi-shot video, audio, music, voiceover, storyboards, character sheets and scripts, choosing a model per step; multi-shot output is auto-assembled in the Final Cut tab. [DOC: R-AGENT]
- Default generation mode is "Automatically generate"; the alternative is "Ask before generating media". Users can optimise for speed, cost, quality or custom. [DOC: R-AGENT]
- The Agent's underlying LLM is user-selectable and some choices cost credits per message (24, 40 or 60 credits per message for the larger models listed). [DOC: R-AGENT]
- Runway's own caveat: "Agent's plan describes its intent, not a guaranteed outcome". [DOC: R-AGENT]
- Runway MCP: Aleph 2.0 in MCP (2026-07-14), Workflows in MCP (2026-08-20), HDR conversion via MCP (2026-08-28), Kling models on MCP (2026-09-18), Cursor support (2026-09-23). MCP access is a Pro-plan feature. [DOC: R-CHG, R-PRICE]

### 1.5 Pricing and credits

- Free: $0, 125 one-time credits, 5 GB. [DOC: R-PRICE]
- Standard: $15/month ($12 on annual), 625 credits, 5 parallel generations, up to 3 projects, no watermark, 20 GB. [DOC: R-PRICE]
- Pro: $35/month ($28 annual), 2,250 credits, 15 parallel, 5 projects, credit top-ups, MCP, 100 GB. [DOC: R-PRICE]
- Max: $95/month ($76 annual), 9,500 credits, 20 parallel, 10 projects, early model access, HDR/ProRes/image sequences, 500 GB, unused credits roll over one month. [DOC: R-PRICE]
- Credit costs: Gen-4.5 60 credits per 5 s; Aleph 2.0 140 per 5 s; Kling 4.0 1080p 118 per 5 s; Seedance 2.0 Pro 1080p 160 per 4 s. [DOC: R-PRICE]
- Implied cost of a 5 s Gen-4.5 clip: about $1.44 on Standard monthly ($15/625 = $0.024 per credit) and about $0.60 on Max ($95/9,500 = $0.01 per credit). [ASSUMED]
- **Unlimited is gone.** Max rolled out 2026-06-01; the Unlimited plan is no longer sold; legacy Unlimited is extended to 2026-11-30 and then auto-moves to Max at $95/month; Explore Mode does not exist on Max. [DOC: R-UNL1, R-UNL2]
- Runway's stated reason: Unlimited's relaxed speeds "often led to queuing". Unlimited mode also excluded Veo 3 and 3.1. [DOC: R-UNL1]
- The current pricing page shows no unlimited or relaxed mode. [DOC: R-PRICE]

### 1.6 Official API

- Public self-serve API with documentation at docs.dev.runwayml.com; SDKs for Node and Python; also on AWS Marketplace. [DOC: R-API]
- Price is $0.01 per credit. gen4.5 12 credits/s; gen4_turbo 5/s; aleph2 28/s (56 minimum); act_two 5/s; veo3.1 with audio 40/s; kling_4 12.56/s at 720p and 18.8/s at 1080p; ProRes or PNG sequence +5/s; 10-bit or HDR +20/s (40/s above 4 MP). [DOC: R-API-PRICE]
- The API hosts roughly 25 third-party video models plus Model Routers, and "Recipes" such as multi_shot_video. [DOC: R-API-MODELS]
- Job model: asynchronous tasks with a task ID, polled (SDK helper waits for output); status THROTTLED when over the concurrency limit. [DOC: R-API-USE]
- Webhooks: the docs navigation lists no webhooks page. [DOC: R-API-MOD] Whether callbacks exist under another name. [UNKNOWN]
- Rate limits are by usage tier 1 to 5: concurrency from 1 to 2 up to 20, generations per day from 50 to 200 up to 25,000 to 30,000, monthly spend caps $100 / $500 / $2,000 / $20,000 / $100,000; no requests-per-minute limit; the daily limit is a rolling 24 h window returning HTTP 429. [DOC: R-API-TIERS]
- Moderation: all elements of a request are evaluated; a moderated task returns FAILED with a failure code. "Moderated generations have the same credit cost as successful generations." Too many moderated requests leads to account suspension. [DOC: R-API-MOD]
- Third-party apps are allowed; apps must display "Powered by Runway"; resale is prohibited "except as permitted through the APIs". [DOC: R-TOS, R-API-ATTR]
- A Task Cost API and capacity fallbacks were added 2026-07-30. [DOC: R-CHG]

### 1.7 Limits (summary)

- Gen-4.5: 10 s max, 720p native, 24/25 fps. [DOC: R-GEN45] Aleph 2.0: 30 s input, 1080p. [DOC: R-EDIT] Act-Two: 30 s. [DOC: R-ACT2] Enhance Frame Rate: 5 min. [DOC: R-CHG]
- Higher resolution than 720p for Gen-4.5 comes from upscaling, not native generation. [ASSUMED]
- Consumer-app moderation: Runway "may pre-screen, refuse or remove content". [DOC: R-TOS] Whether moderated generations are charged in the consumer app. [UNKNOWN]

### 1.8 Recurring user complaints

- Trustpilot: TrustScore 1.1/5 from 395 reviews, 217 of them in the last 12 months, 93% one-star; profile unclaimed. [IND: T-RUNWAY]
- Themes in the visible late-2026 sample: credits drain fast including on failed or unusable generations and on every revision; costs unclear before starting; ignored prompts and inconsistent characters; billing surprises (one review says Pro's "unlimited" 4K upscaling still deducted credits); buried cancellation and refused or slow refunds; automated support. [IND: T-RUNWAY]
- The visible sample did not mention the Unlimited removal, queue times or moderation. [IND: T-RUNWAY] Community reaction to the Unlimited removal. [UNKNOWN]

### 1.9 Terms for professionals

- Terms last updated 2026-10-23. Runway does not claim ownership of Inputs or Outputs and does not restrict commercial use. [DOC: R-TOS, R-RIGHTS]
- The user grants Runway a "non-exclusive, irrevocable, perpetual, worldwide, royalty-free, sublicensable license". [DOC: R-TOS]
- Inputs and Outputs "may be used by the Company to train and improve its AI models"; no opt-out is described in the consumer terms. [DOC: R-TOS]
- Prohibited: using the Services or Outputs to "create, train, develop, or improve similar or competitive products or services". [DOC: R-TOS]
- Security posture: SOC 2 Type II and ISO 27001:2022; assets private by default. [DOC: R-SEC] Enterprise adds SSO, disabling external link sharing, prompt-in-metadata, Brand Kits. [DOC: R-ENT]
- Whether Enterprise contracts include a no-training commitment. [UNKNOWN]

### 1.10 Strategic direction and 2026 launches

- Direction in one line: from "model company" to a multi-model production platform with an agent on top, a thin in-app timeline, plugins into the incumbent NLEs, and a professional-output tier. [ASSUMED] Evidence: third-party models (2026-02-20 onward), Agent (May), Edit Studio (May), Max plan replacing Unlimited (June), Model Routers (July), ProRes/EXR/HDR (August), Team plan and Adobe/Resolve plugins (September), App Studio and Runway Ads (October). [DOC: R-CHG]
- Hollywood ties: expanded Lionsgate partnership with an equity investment (2026-06-11). [CLAIM: R-LGF]
- Funding: Series E of $315M at a $5.3B valuation in February 2026, per funding trackers. [IND: search results, not opened individually]
- Press describes Runway as already offering an integrated creator platform. [IND: SEMAFOR]

---

## 2. Kling (kling.ai / klingai.com; Kuaishou; contracting entity Kling AI Pte. Ltd., Singapore)

### 2.1 Flagship models and modalities

- Kling 4.0 was announced on the official blog on 2026-09-30: native generation from 3 to 30 s, two-channel stereo audio, improved lip-sync, up to 15 reference assets (at most 10 images, at most 5 videos totalling 30 s, at most 7 subjects, plus voice references), up to 10 keyframes, prompts up to 8,000 tokens, video editing with up to 5 video inputs. [DOC: K-BLOG40]
- 4K output and 21:9 are stated in the blog; 10-bit HDR at 1080p/4K and extension to 2 minutes are "coming soon". [DOC: K-BLOG40]
- Conflict inside Kling's own docs: the API capability map lists 4K for Kling 4.0, while the 4.0 usage guide offers only 720p and 1080p with 4K "coming soon". [DOC: K-CAP, K-USE40]
- Rollout: "Flash" early access on 2026-09-28 for Ultra yearly subscribers, full model "October 2026". [DOC: K-BLOG40] Press gives 2026-10-15 as launch. [IND: press coverage found in search] Sources conflict on general availability versus staged preview.
- "Smart shot-splitting is enabled by default" on Kling 4.0 and cannot be turned off through the API. [DOC: K-USE40]
- Kling 3.0 family (2026-02): Video 3.0, Video 3.0 Omni, Image 3.0, Image 3.0 Omni; up to 15 s; native multilingual audio; multi-shot storyboard ("Director Mode") of up to six shots. [CLAIM: K-PR30] [DOC: K-DIRECTOR]
- API capability map: 4.0 Flash 3 to 20 s at 720p; 3.0, 3.0 Turbo and 3.0 Omni 3 to 15 s; multi-keyframes only on 4.0; motion control only on 3.0 and 2.6; separate endpoints for Avatar, Lip Sync, Multi-element Video Editing, Video-to-Audio and Text-to-Audio. [DOC: K-CAP]
- The capability map has no camera-control or extend entry for 4.0. [DOC: K-CAP]
- Frame rate for 4.0 is not stated on pages reached. [UNKNOWN]
- Dedicated inpainting. [UNKNOWN] Multi-element editing is the closest documented feature. [DOC: K-CAP]

### 2.2 Product workflow

- The 4.0 release describes a new creation page with a single input box and "preview, editing, and asset addition on one timeline", and mentions a node Canvas and an Agent. [DOC: K-BLOG40]
- Detail of that timeline (tracks, trimming, audio, export). [UNKNOWN] No official help page describing it was reached.
- Export formats beyond standard video download; ProRes, EXR, alpha, OTIO/EDL/XML. [UNKNOWN] 10-bit HDR is "coming soon". [DOC: K-BLOG40]
- Team or collaboration features in the consumer app. [UNKNOWN]
- Published content can be reused by other users through "Recreate" depending on platform features. [DOC: K-POLICY]
- What stays editable: with shot-splitting on by default, a multi-shot 30 s result is delivered as one rendered video. [DOC: K-USE40] Per-shot re-rendering inside a delivered clip. [UNKNOWN]

### 2.3 Character and world consistency

- Mechanism: "elements" and omni references, up to 7 subjects and 15 assets per generation on 4.0, voice profiles up to 3. [DOC: K-BLOG40, K-USE40]
- Independent hands-on tests of 4.0 consistency were not found; available "reviews" were vendor or reseller content. [UNKNOWN]
- A reseller's guide mentions face change in a second shot, drift, and random cuts in Flash. [IND: reseller guide found in search; commercially interested source]
- A third-party 2026 review says Luma's cross-shot character consistency "trails Kling". [IND: search-result summary; single source]

### 2.4 Agentic and assistant features

- A Kling "Agent" and node "Canvas" are named in the 4.0 announcement. [DOC: K-BLOG40] Their capabilities, autonomy and pricing. [UNKNOWN]
- No Kling-operated MCP server was found; Kling models are reachable through Runway's MCP. [DOC: R-CHG]

### 2.5 Pricing and credits

- The live pricing/membership pages could not be fetched (empty response, redirect to home, or page timeout). Figures below come from an official blog post dated 2026-07-28 and may be stale.
- Basic $0 (no monthly credits listed); Standard $10 list with 660 credits; Pro $37 with 3,000; Premier $92 with 8,000; Ultra $180 with 26,000; promotional first-month and renewal prices are lower than list. Kling 3.0 at 4K costs 30 credits per second. [DOC: K-CREDIT]
- Conflict: a Trustpilot review dated 2026-11-01 says the 26,000-credit Ultra plan was removed and that a 30 s video rose from 405 to 450 credits. [IND: T-KLING] Single user report, unverified; it implies about 15 credits per second for 4.0. [ASSUMED]
- Third-party sites list higher tiers at roughly $545 to $619 per month and disagree with each other. [IND: search results; conflicting]
- Free tier details (daily credits, watermark, non-commercial). [IND: third-party reviews] Not confirmed on an official page.
- No unlimited or relaxed mode was found for Kling. [UNKNOWN]
- Credits expire; a reviewer reports losing 387 credits without clear warning. [IND: T-KLING]

### 2.6 Official API

- Public developer platform with documentation; Bearer auth; regional base URL (example: api-singapore.klingai.com). [DOC: K-I2V40]
- Prepaid "resource packs" or cash balance; Kling 4.0 needs a Flagship resource pack or positive balance. [DOC: K-USE40]
- Pay-as-you-go prices: Kling 4.0 $0.157 per second at 720p and $0.235 per second at 1080p; 4.0 Flash $0.094 per second; 3.0 $0.084 (720p, no audio) to $0.42 per second (4K); lip-sync $0.07 per 5 s; multi-element editing $0.42 per 5 s at 720p. [DOC: K-APIPRICE]
- A 5 s 1080p Kling 4.0 clip therefore costs about $1.18 direct. [ASSUMED] Runway and Pika both price the same clip at 118 credits. [DOC: R-PRICE, P-PRICE]
- Job model: asynchronous tasks (submitted, processing, succeeded, failed), polling, optional `callback_url` per request, and webhooks signed with the Standard Webhooks scheme with secret rotation. [DOC: K-I2V40, K-CALLBACK]
- Result URLs are retained 30 days; watermark off by default. [DOC: K-I2V40]
- Concurrency is set by the highest active resource pack; over-limit requests fail with error 1303 rather than queueing; "The system does not impose any QPS limits." [DOC: K-CONC]
- API terms (effective 2026-04-21): licence is non-transferable and revocable; no reselling, sublicensing or lending without written consent; keys only for your own "Client Application"; no competing derivative products; output IP belongs to the user; commercial use "not restricted"; Kling "will not use ... your data to train"; prompts and responses logged for 30 days; liability capped at six months' fees; 30 days' notice of service changes. [DOC: K-APITOS]

### 2.7 Limits (summary)

- 4.0: 3 to 30 s; 720p and 1080p via API today; aspect ratios 21:9, 16:9, 9:16, 1:1 and adaptive. [DOC: K-USE40] fps. [UNKNOWN]
- Moderation: Kling may remove or refuse to display content and suspend accounts. [DOC: K-POLICY] Users reported stricter moderation after 4.0. [IND: blog quoting Reddit, found in search] Political-topic censorship was reported by press in 2024. [IND: press, 2024]

### 2.8 Recurring user complaints

- Trustpilot (kling.ai profile as fetched): 1.5/5 from 34 reviews, 94% one-star, unclaimed. [IND: T-KLING] A third-party article reports 1.3/5 across 318 reviews. [IND: search result] The counts conflict; they may refer to different Trustpilot profiles. [ASSUMED]
- Themes: credits consumed on output that ignores the prompt; credit expiry; refunds refused as "virtual goods"; unwanted renewals and charges after cancellation; generic or absent support; account-access problems. [IND: T-KLING]
- Peak-time queues and "too busy" errors, and one anecdotal 30 to 40% peak failure rate. [IND: third-party reviews found in search; anecdotal]

### 2.9 Terms for professionals

- Consumer User Policy, last updated 2026-04-21, Singapore law, SIAC arbitration. [DOC: K-POLICY]
- User owns the Content; Kling gets a non-exclusive, royalty-free licence "during the operational period of its business", including licensing to third parties for promotion and product work. [DOC: K-POLICY]
- Kling may use Input and Output to train its models; the user can ask to revoke by emailing support. [DOC: K-POLICY]
- The policy says outputs may not be used commercially without Kling's written permission and that distributed outputs should carry Kling AI labelling. [DOC: K-POLICY] This needs manual verification of the clause wording, because paid plans are widely described as including commercial use. [IND: third-party reviews] The separate Terms of Paid Service were not read. [UNKNOWN]
- Users may not use the Services or outputs to train their own AI models. [DOC: K-POLICY]
- Contrast: the API terms say no training on customer data and unrestricted commercial use. [DOC: K-APITOS] So the consumer app and the API are materially different legal products. [ASSUMED]

### 2.10 Strategic direction and 2026 launches

- Kling is the revenue leader of this group on disclosed numbers: Kuaishou reported Kling revenue above RMB 650M in Q1 2026 and an annualised run-rate near US$500M in March 2026. [CLAIM: K-KS-Q1]
- Reported plan to spin Kling off toward a Hong Kong listing at a $15B to $20B valuation. [IND: press found in search, July and September 2026]
- 2026 launches: Kling 3.0 family (February), Kling 4.0 and 4.0 Flash (September to October), new single-box creation page, Canvas, Agent. [DOC: K-BLOG40] [CLAIM: K-PR30]
- Distribution strategy: Kling sells directly and also wholesales its model to rivals. Kling 4.0 is offered inside Runway, Luma and Pika. [DOC: R-PRICE, L-NEWS, P-HOME]

---

## 3. Luma (lumalabs.ai; Dream Machine, Ray models, Luma Agents)

### 3.1 Flagship models and modalities

- Ray3.2, announced 2026-06-09, is the current flagship video model: multi-keyframe control ("up to 16 keyframes within a single clip"), performance tracking of posture, gesture and facial expression for "up to eight faces simultaneously", native HDR with "16-bit EXR Export", Reframe (change aspect ratio, extend the frame, replace background), clips up to 20 s at 1080p, and first-time API availability. [DOC: L-RAY32]
- Conflicts with the API docs: the API accepts 1 to 64 keyframes, and plain generation durations are 5 s or 10 s only. [DOC: L-AG-VID] Video-to-video at 15 s and 20 s is listed as supported on the API pricing page. [DOC: L-APIPRICE] The 20 s figure therefore appears to apply to editing/modify rather than text-to-video. [ASSUMED]
- Ray3.2 API parameters: 360p, 540p, 720p (default), 1080p; aspect ratios 9:16, 3:4, 1:1, 4:3, 16:9, 21:9; start and end frames; loop; extend forward or backward from a prior generation (SDR only); HDR only at 720p/1080p and 5 s; EXR requires HDR and is encoded in ACES2065-1 (AP0); keyframe positions on a 24 fps grid. [DOC: L-AG-VID]
- Ray3.14 (2026-01-26): native 1080p, "3x cheaper and 4x faster" than Ray3 at 720p. [CLAIM: L-RAY314]
- Ray3 Modify (2025-12-18): video-to-video that preserves the original performance, with character reference, start/end frames and adjustable modify strength. Stated limits: the modification target must appear in the start or end frame; non-preset aspect ratios are cropped. [DOC: L-MODIFY]
- A reviewer states Ray3.14 does not support character reference or HDR/EXR, so those workflows need base Ray3. [IND: EESEL-L] Written 2026-06-05, before or around Ray3.2; may be outdated.
- Uni-1 image model (March 2026) and Uni-1.1 API (2026-05-05); "Layers" powered by Uni-1 (2026-07-29). [DOC: L-NEWS]
- Third-party models inside Luma: Seedance 2.5 and MiniMax H3 (2026-08-06), Kling 4.0 (2026-10-23). [DOC: L-NEWS] Press at the Agents launch listed Veo 3, Sora 2, Kling 2.6, Nano Banana Pro and ElevenLabs. [IND: press on the 2026-03-05 launch]
- Native audio in Ray3.2. [UNKNOWN] The legacy Dream Machine API has an "add audio to a generation" endpoint and an upscale endpoint (up to 4K per its changelog). [DOC: L-API-OLD]
- Lip-sync, inpainting. [UNKNOWN]
- Camera control: the legacy Ray 2 API takes camera "concepts" and camera-motion phrases. [DOC: L-API-VID] Equivalent for Ray3.2. [UNKNOWN]

### 3.2 Product workflow

- The app is now organised around Luma Agents working on boards ("Luma Canvas board"). [DOC: L-VARIANTS]
- Luma Scenes (2026-08-11) is the multi-shot tool: it builds a storyboard of editable keyframes from a brief or reference images; any keyframe can be regenerated, commented on or replaced; approved frames stay unchanged; timing is set by dragging a keyframe to where it should land; rendering waits for sign-off; render model is Ray 3.2 or Seedance 2; 9:16 or 16:9; export as a full clip, separate clips, or Ray 3.2 panels. [DOC: L-SCENES]
- Luma states scenes are "generated together, in one context" so look and spatial logic carry across the sequence. [CLAIM: L-SCENES]
- A conventional multi-track editing timeline (trim, audio tracks, titles). [UNKNOWN] None is described on pages reached.
- OTIO, EDL, XML, ProRes or alpha export. [UNKNOWN] EXR (16-bit, ACES AP0) and HDR are documented. [DOC: L-RAY32, L-AG-VID]
- Other 2026 surfaces: Pages (2026-07-28), Variants for static-ad resizing and translation (2026-10-01), Mini-Apps (2026-10-27). [DOC: L-NEWS, L-VARIANTS]
- Collaboration: guest collaborators with edit access from Plus; Team plan with member management, projects, team-wide sharing, usage analytics, shared credits and SSO; team members and admins added 2026-04-01. [DOC: L-PRICE, L-NEWS]
- What stays editable: the storyboard keyframes before render. After render, clips are discrete outputs that can be modified or reframed as new generations. [ASSUMED from L-SCENES, L-MODIFY]

### 3.3 Character and world consistency

- Mechanisms: character reference in Ray3 Modify, whole-sequence storyboard generation in Scenes, multi-keyframe conditioning in Ray3.2. [DOC: L-MODIFY, L-SCENES, L-RAY32]
- Luma's own help material acknowledges faces can still change and advises explicit prompt phrasing and an @character tag. [DOC: L-HELP-SNIP] Low confidence: seen through a search-result summary of a Luma help-centre article; not opened.
- Independent: a 2026 review says cross-shot character consistency trails Kling. [IND: search-result summary; single source] Trustpilot reviewers report altered product shapes and changed characters or voices. [IND: T-LUMA]
- Independent hands-on evaluation of Scenes. [UNKNOWN]

### 3.4 Agentic and assistant features

- Luma Agents launched 2026-03-05, positioned as carrying a project from brief to delivery and routing steps across Luma and third-party models. [IND: press on the 2026-03-05 launch]
- Luma Skills (2026-06-16): reusable instruction sets (input, tools, step-by-step instructions); the agent can build a Skill from a description and choose a Skill automatically; Skills are shareable by link and downloadable as a zip. [DOC: L-SKILLS]
- Luma MCP for Claude and ChatGPT (2026-11-03) exposes Luma Agent, Product Shots, Camera Angles, Background swap, Relight Studio and short promo clips; it "uses your Luma credits". [DOC: L-MCP]
- Scenes has an explicit approval gate before rendering. [DOC: L-SCENES] Approval behaviour of the general agent. [UNKNOWN]
- Plan tiers are expressed as agent capacity: Pro is "4x usage with Luma Agents", Ultra "15x". [DOC: L-PRICE]

### 3.5 Pricing and credits

- Plus $30/month ($25 on annual), 10,000 credits, Luma and third-party models, guest collaborators, commercial use. Pro $90 ($75), 40,000 credits. Ultra $300 ($250), 150,000 credits. Team and Enterprise by sales contact; Enterprise adds custom fine-tuning. [DOC: L-PRICE]
- The current pricing page lists no free plan and no relaxed or unlimited mode. [DOC: L-PRICE]
- Legacy Dream Machine plans (Free, Lite $9.99, Plus $29.99, Unlimited $94.99 with Relaxed Mode) were reported as still billable for existing users as of June 2026. [IND: EESEL-L] The legacy official pricing URL I tried returned 404, so current status is [UNKNOWN].
- Ray3.2 and Ray3.14 credit costs (SDR): 5 s costs 20 / 50 / 100 / 400 credits at 360p / 540p / 720p / 1080p; 10 s costs 60 / 150 / 300 / 1,200. Video-to-video costs 36 / 48 / 72 / 144 credits per second. HDR is 2x and HDR+EXR 3x. [DOC: L-PRICE]
- Implied cost on Plus ($0.003 per credit): 5 s at 1080p is about $1.20; 10 s at 1080p about $3.60; 5 s 1080p HDR+EXR about $3.60. [ASSUMED]
- Monthly credits do not roll over; top-ups cost $4 per 1,200 credits. [IND: EESEL-L]
- Failed generations are refunded automatically per Luma's billing policy and help centre; subscription refunds are discretionary. [DOC: L-HELP-SNIP] Low confidence: search-result summary. Fees are "final and non-refundable unless otherwise determined by Luma". [DOC: L-TOS]

### 3.6 Official API

- Two API surfaces exist. The legacy Dream Machine API (docs.lumalabs.ai) covers Ray 2 and Ray 2 Flash, Photon images, upscale, add-audio, reframe and modify. [DOC: L-API-OLD, L-API-VID] Its FAQ redirects users to the Luma API Platform and the Luma Agents API docs for current guidance. [DOC: L-API-FAQ]
- The current Luma Agents API (docs.agents.lumalabs.ai) exposes ray-3.2, uni-1 and uni-1-max through one asynchronous REST surface: POST a generation, poll GET until completed or failed, download from a presigned URL that expires after 1 hour. SDKs for Python, TypeScript, Go and a CLI. [DOC: L-AG, L-AG-VID]
- Webhooks: the Agents API quickstart describes polling only. [DOC: L-AG] The legacy API supports `callback_url` with up to 3 retries and a 5 s timeout. [DOC: L-API-VID] Whether the Agents API has callbacks. [UNKNOWN]
- Rate limits: requests-per-minute and concurrent-job ceilings that "depend on your plan"; excess concurrent requests return HTTP 429 and are not queued. [DOC: L-AG-RL] Legacy Build tier: 10 concurrent video generations, 20 create requests per minute, $5,000 monthly usage limit; Scale by request. [DOC: L-API-RL]
- Pricing is in credits with the same table as the app; the FAQ cost reference shows 0.30 at 720p and 1.20 at 1080p for a 5 s generation, consistent with $0.003 per credit. [DOC: L-APIPRICE] [ASSUMED for the unit]
- Moderation "is enforced on every input and output and cannot be disabled"; jobs failing with `content_moderated` are not refunded. [DOC: L-AG-FAQ]
- Training: the Agents API FAQ says Luma does not train its models on API Input or Output, on every API plan. [DOC: L-AG-FAQ] The API pricing page lists a "no-train guarantee" among Scale-plan features. [DOC: L-APIPRICE] These read inconsistently; the API Terms of Use were not reachable (guessed URL returned 404). [UNKNOWN]
- Third-party apps: the ToS lets API customers give their users access "as part of Customer's service offering"; reselling the Services as such, benchmarking publication and competing use are restricted. [DOC: L-TOS]
- The API FAQ says API outputs have no watermark and may be used commercially. [DOC: L-API-FAQ]

### 3.7 Limits (summary)

- Ray3.2 generation: 5 or 10 s; up to 1080p; HDR limited to 5 s at 720p/1080p; prompt up to 6,000 characters; input images up to 50 MB and 8,000 px per side; a 5 s 720p job "typically" finishes in under two minutes. [DOC: L-AG-VID]
- Scenes output aspect ratios: 9:16 and 16:9 only. [DOC: L-SCENES]
- 4K: upscale only, in the legacy API. [DOC: L-API-OLD] Native 4K. [UNKNOWN]

### 3.8 Recurring user complaints

- Trustpilot: 1.4/5 from 72 reviews (48 in the last 12 months), 86% one-star, unclaimed. [IND: T-LUMA]
- Themes: credits drain fast and corrections cost more than the first attempt; charges for outputs not requested (one review: one instruction produced 48 videos); quality felt lower after subscribing; slow or absent support; refunds declined; charges after cancelling a trial; stuck or failed generations. [IND: T-LUMA]
- A user report describes about 60% of a month's credits consumed in one session for a 48 s video, including the agent's own deliberation. [IND: aggregator found in search; single anecdote]
- Loss of unused credits on cancellation and lack of an unlimited tier in the new plans. [IND: EESEL-L]

### 3.9 Terms for professionals

- Terms last updated 2026-05-14; California law; arbitration with 30-day opt-out. [DOC: L-TOS]
- The customer owns Output, but may use Outputs commercially only if they were produced "during an active Subscription Term". [DOC: L-TOS]
- Licence to Luma on paid use: worldwide, non-exclusive, irrevocable, royalty-free, sublicensable, perpetual for content reflected in Output or usage data. On free use the licence widens to public display and distribution. [DOC: L-TOS]
- Input and Output may be used to "create, test, improve, train, or otherwise develop" Luma's models; no opt-out is described in the consumer terms. [DOC: L-TOS]
- Restrictions: no use "to compete with Luma", no service-bureau use, no publishing benchmarks. [DOC: L-TOS]
- Enterprise positioning includes customer IP ownership, automated content review and human-review steps. [CLAIM: press on the 2026-03-05 launch]

### 3.10 Strategic direction and 2026 launches

- Capital and compute: $900M Series C led by HUMAIN with AMD (2025-11-19) and "Project Halo", a planned 2 GW compute cluster. [CLAIM: L-SERIESC]
- Thesis: multimodal "unified intelligence" and world simulation beyond text models. [CLAIM: L-SERIESC]
- Product direction: Dream Machine as a brand is receding; 2026 product news is framed around Luma Agents, with skills, scenes, pages, variants and mini-apps aimed at advertising agencies and brand teams. [ASSUMED] Evidence: 2026 news index and agency partnerships (Publicis, Serviceplan, Dumbstruck, Mazda case study). [DOC: L-NEWS]
- Middle East expansion: Riyadh office and an Arabic interface. [DOC: L-NEWS]
- Luma also became an aggregator of rival models in 2026 (Seedance, MiniMax H3, Kling 4.0). [DOC: L-NEWS]

---

## 4. Pika (pika.art)

### 4.1 Flagship models and modalities

- Pika relaunched on 2026-09-17 as "the New Pika": a multi-model creative platform with 25+ apps across video, image and sound over third-party and in-house models. [DOC: P-NEW]
- Pika 2.5 (first-party): text-to-video (5 s at 720p or 1080p), image-to-video (5 or 10 s), and "Frames" mode with 2 to 5 ordered stills (1 to 5 s per transition, or 10 s with exactly two keyframes); renders are silent. [DOC: P-25]
- Pika H3 Flex (2026-10-29): described by Pika as "our post-trained MiniMax H3 model", distilled to six sampling steps; text-to-video, first/last frame, and multimodal reference-to-video with up to 12 reference files (images, video, audio, sketches, keyframes); up to 15 s; synchronized stereo audio; native 480p or 768p. [DOC: P-H3]
- H3 Flex weights are published: LoRA adapters plus bundled MiniMax H3 base components (about 210 GB) on Hugging Face, with inference code on GitHub, under the "minimax-h3-community-license-agreement"; durations 5 to 15 s at 24 fps, 11 aspect ratios; test requests "passed on H100 80GB". [DOC: P-HF]
- The commercial-use terms of that community licence were not read. [UNKNOWN]
- Hosted-only parts: the 1080p/2K/4K upsampler, five-stem audio separation (dialogue, score, SFX, foley, ambience) and the accelerated serving stack. [DOC: P-H3]
- "Generates faster than real time" refers to transformer compute in a controlled benchmark, not end-to-end API latency, per Pika's own footnote. [CLAIM: P-H3] "#1 among open-weights models" on a third-party leaderboard at launch. [CLAIM: P-H3]
- First-party audio models launched 2026-08-18: Pika Speech, Music, SFX and Soundtrack. [DOC: P-BLOG]
- Third-party models offered: Seedance 2.5, Kling 4.0, MiniMax H3, Wan 3.0, Gemini Omni 1.1 Flash, GPT Image 2.5, Nano Banana 2.1, Ideogram 4.5, Seedream, Grok Imagine, ElevenLabs, MiniMax Music 3.0. [DOC: P-HOME]
- Apps relevant to video: Video Studio, Extend Video, Swap Anything, Motion Transfer, Color Grade, Relight Media, Camera Director, Dynamic Captions, Character Studio, Product Ad, Pikaframes, Pikaffects. [DOC: P-HOME, P-NEW, P-FAQ]
- Pikascenes, Pikadditions and Pikaswaps do not appear on current pages. [DOC: P-HOME] Their status. [UNKNOWN] "Swap Anything" looks like the successor to Pikaswaps. [ASSUMED]
- Dedicated lip-sync and inpainting. [UNKNOWN]

### 4.2 Product workflow

- Pika describes itself as "built around self-contained tools" (apps) rather than a single editor. [DOC: P-HOME]
- Video Studio creates a short clip or a multi-shot video up to 30 s with sound; up to 50 characters, products, settings and styles can be attached and @-mentioned; apps choose a model automatically and the user can override. [DOC: P-NEW, P-VS]
- Press describes the flow as entering basic details and receiving an editable shot-by-shot list, with automatic model selection per element. [IND: SEMAFOR]
- A timeline or editor, project structure beyond a library and an "OG Pika" project for migrated work, export formats, and collaboration. [UNKNOWN] None is described on pages reached.
- ProRes, EXR, alpha, OTIO/EDL/XML. [UNKNOWN]
- The previous product remains at old.pika.art "for a few more weeks" after the relaunch; paid users' assets are being migrated. [DOC: P-NEW, P-FAQ]

### 4.3 Character and world consistency

- Mechanisms: Character Studio app and up to 50 attached references in Video Studio; up to 12 references per H3 Flex generation. [DOC: P-HOME, P-VS, P-H3]
- Pika's own research post concedes: "Physics, multi-scene consistency, and complex reference control remain areas for further improvement", and says other systems were preferred in its human study for physics, multi-scene narrative and action-heavy reference tasks. [DOC: P-H3R]
- Independent reviews of the New Pika's consistency. [UNKNOWN] (no search budget left for this pass)

### 4.4 Agentic and assistant features

- Pika MCP and "Pika for ChatGPT" (2026-10-16), marketed as 40+ creative apps and 100+ models inside ChatGPT. [CLAIM: P-BLOG]
- The developer API is described as "agent-native" with setup instructions for ChatGPT, Claude, Codex, Cursor and Lovable. [CLAIM: P-CLUB]
- "Pika Agent" / "AI Self" (April 2026) is a persona product with real-time video chat and monetisation with a profit share to Pika, not a production assistant. [DOC: P-BLOG, P-TOS]
- A chat-based production agent comparable to Runway Agent or Luma Agents. [UNKNOWN] Not found on pages reached.

### 4.5 Pricing and credits

- Free: $0, zero monthly credits (credit packs only), no commercial licence, 2 parallel video jobs. [DOC: P-PRICE, P-FAQ]
- Starter $10/month ($8 annual), 600 credits, commercial use. Creator $35 ($28), 2,600 credits, 8 parallel video jobs. "Fancy" from $95 ($76), 8,550 credits and up on a sliding scale, unlimited parallelism, priority queue; early access from $440/month. Enterprise custom. [DOC: P-PRICE]
- All individual plans include all models and apps; plans differ by credits and concurrency. [DOC: P-PRICE, P-NEW]
- Credit costs for a 5 s clip: Pika H3 Flex 768p 10; Pika 2.5 720p 20; Wan 3.0 720p 33; Seedance 2.0 Mini 40; Seedance 2.0 720p 80; Kling 4.0 1080p 118; Seedance 2.5 1080p 299. [DOC: P-PRICE]
- Top-ups: 60 credits per $1, valid 365 days; usable only on Pika Create and MCP, not on the API, iOS app or old.pika.art. Plan credits do not roll over. [DOC: P-PRICE]
- Implied cost on Starter ($0.0167 per credit): Pika 2.5 5 s about $0.33; Kling 4.0 1080p 5 s about $1.97. [ASSUMED]
- No unlimited or relaxed mode; Pika markets this as no "fake unlimited". [DOC: P-PRICE] [CLAIM: P-NEW]
- Downloads are watermark-free on all current plans including Free. [DOC: P-FAQ]
- Seedance generations claimed to cost half of "other creation platforms". [CLAIM: P-NEW]

### 4.6 Official API

- "Pika API Club" launched 2026-08-05: self-serve at dev.pika.art with no waitlist; $10/month membership unlocks member pricing; pay-as-you-go with a stated 5% platform fee; 100+ video, image, audio and LLM models through one API. [DOC: P-CLUB, P-DEV]
- Earlier Pika API access had been through partners only; that is no longer the case. [ASSUMED from prior public knowledge plus P-DEV]
- Billing is prepaid in micro-USD; a submit fails with `insufficient_balance` without funds; no free generation tier. [DOC: P-DEV]
- Job model: asynchronous; poll the job or receive a signed webhook on the terminal event. [DOC: P-DEV]
- Rate limits are not published; they "may vary by Plan" and excess usage may be queued or blocked. [DOC: P-DEVTOS]
- Per-model prices live in a machine-readable catalog that was not queried. [UNKNOWN] Pika states H3 Flex starts at $0.01 per output second. [CLAIM: P-H3R]
- Terms: developers may build products on the API but may not "expose Pika's APIs directly to third parties" or resell access; visible attribution is required unless the plan allows white-labelling (enterprise only for first-party models); no SLA for self-serve. [DOC: P-DEVTOS]
- Claims of being "up to 88% cheaper" than other aggregators. [CLAIM: P-CLUB]

### 4.7 Limits (summary)

- Video Studio: 30 s multi-shot maximum. [DOC: P-FAQ] Pika 2.5: 5 or 10 s, 720p or 1080p. [DOC: P-25] H3 Flex: 15 s, 768p native, 24 fps. [DOC: P-HF]
- Pika 2.5 fps and aspect ratios. [UNKNOWN]
- Moderation: Pika may review and remove content at its discretion and must give reasons with an appeal route "where applicable". [DOC: P-TOS] An Acceptable Use Policy exists but was not read. [UNKNOWN]

### 4.8 Recurring user complaints

- Trustpilot: 2.4/5 from 82 reviews (34 in the last 12 months), 75% one-star and 15% five-star; Pika has not replied to negative reviews. [IND: T-PIKA]
- Themes (mostly pre-relaunch and around it): credits running out or not refreshing; unanswered refund and support requests (one about 60 days); stalled or failed generations attributed to capacity; upsell pop-ups; advertised features removed. [IND: T-PIKA]
- The most recent reviews (November 2026) are mostly positive about interface, price and access to Seedance. [IND: T-PIKA]
- Official position: subscriptions and credit packs are non-refundable; for failed generations support will "investigate ... any credits charged". [DOC: P-FAQ] There is no stated automatic refund of credits for failures. [ASSUMED]

### 4.9 Terms for professionals

- Terms last updated 2026-08-04; California law; arbitration with opt-out. [DOC: P-TOS]
- Pika does not claim ownership of Inputs or Outputs. [DOC: P-TOS]
- Commercial use only where the plan permits it: paid plans yes, Free no (even with purchased credit packs). [DOC: P-TOS, P-FAQ]
- Training: Pika may use "anonymized or aggregated Content, including Inputs, Outputs" to train models under a perpetual, irrevocable, sublicensable licence, unless an enterprise agreement says otherwise; no general opt-out; on account deletion it will try to exclude content from future training. [DOC: P-TOS]
- The FAQ says Pika may use uploads and creations "to operate and improve our services, including our models"; third-party model providers' data practices may also apply. [DOC: P-FAQ]
- No use of the Service or Outputs to build AI that "competes with Pika's". [DOC: P-TOS]
- Liability cap: the greater of six months' fees or $100. [DOC: P-DEVTOS]

### 4.10 Strategic direction and 2026 launches

- Pika is the smallest of the four: valued at $470M, described by press as "playing catch-up" with Higgsfield (valued at $5.4B), with lower price as its main differentiator. [IND: SEMAFOR]
- 2026 sequence: agent personas and real-time video chat (April), API Club (August), first-party audio models (August), New Pika relaunch (September), ChatGPT app (October), open-weight H3 Flex (October). [DOC: P-BLOG]
- Direction: price-led aggregator plus a low-cost open-weight model, with distribution through ChatGPT/MCP and a developer club. [ASSUMED]

---

## 5. Cross-product comparison

Cells are a short value plus label. "n/f" means not found on pages reached.

| Capability | Runway | Kling | Luma | Pika |
|---|---|---|---|---|
| Flagship first-party video model | Gen-4.5 [DOC] | Kling 4.0 [DOC] | Ray3.2 [DOC] | Pika 2.5; H3 Flex (post-trained MiniMax H3) [DOC] |
| Max native clip length | 10 s [DOC] | 30 s [DOC] | 10 s generate; 20 s stated for Ray3.2, likely edit paths [DOC]/[ASSUMED] | 10 s (2.5), 15 s (H3 Flex), 30 s multi-shot in Video Studio [DOC] |
| Max native resolution | 720p-class; 4K by upscale [DOC] | 1080p via API today; 4K stated in blog, "coming soon" in API guide (conflict) [DOC] | 1080p [DOC] | 1080p (2.5); 768p native + hosted 4K upsampler (H3 Flex) [DOC] |
| Frame rate | 24/25 fps [DOC] | [UNKNOWN] | 24 fps grid [DOC] | 24 fps (H3 Flex); 2.5 [UNKNOWN] |
| Native audio in flagship | [UNKNOWN] for Gen-4.5; hosted audio models [DOC] | Stereo audio default on [DOC] | [UNKNOWN] | H3 Flex stereo; 2.5 silent [DOC] |
| Video-to-video editing | Aleph 2.0, 30 s input [DOC] | Multi-element / omni edit, up to 5 video inputs [DOC] | Ray3 Modify, Reframe [DOC] | Swap Anything, Relight, Camera Director apps [DOC] |
| Performance capture | Act-Two, 30 s [DOC] | Motion control on 3.0/2.6 only; Avatar [DOC] | Performance tracking up to 8 faces [DOC] | Motion Transfer app [DOC] |
| Keyframes | Single image for Gen-4.5; more "coming soon" [DOC] | Up to 10 [DOC] | 16 (news) / up to 64 (API) [DOC] | 2 to 5 (Frames) [DOC] |
| References per generation | Image/video/audio/3D refs; count n/f [DOC] | 15 assets, 7 subjects [DOC] | Character reference in Modify; count n/f [DOC] | 12 (H3 Flex); 50 attachable in Video Studio [DOC] |
| Multi-shot tooling | Agent multi-shot + Final Cut tab [DOC] | Director Mode (6 shots, 3.0); auto shot-splitting forced on in 4.0 API [DOC] | Scenes storyboard with approval gate [DOC] | Video Studio; shot list per press [DOC]/[IND] |
| In-app timeline | Multi-track, video only, no image clips [DOC] | "One timeline" on new creation page; detail [UNKNOWN] | Keyframe timing drag in Scenes; NLE-style timeline [UNKNOWN] | [UNKNOWN] |
| OTIO / EDL / XML export | n/f; export is rendered video [DOC] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| NLE integration | Premiere, After Effects, Resolve plugins [DOC] | [UNKNOWN] | [UNKNOWN] (Ray3 in Adobe Firefly [CLAIM]) | [UNKNOWN] |
| ProRes | Yes, 422 Proxy to 4444 XQ [DOC] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| HDR / EXR | HDR10, HLG, PQ, OpenEXR incl. ACEScg [DOC] | 10-bit HDR "coming soon" [DOC] | Native HDR, 16-bit EXR ACES AP0 [DOC] | [UNKNOWN] |
| Alpha output | Only via SAM3 transparent WebM [DOC] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| Agent | Runway Agent, Skills, Workflows, App Studio [DOC] | Agent and Canvas named; detail [UNKNOWN] | Luma Agents, Skills, Mini-Apps [DOC] | No production agent found; persona "Pika Agent" [DOC]/[UNKNOWN] |
| MCP / assistant distribution | Runway MCP (Cursor etc.) [DOC] | Via Runway MCP only [DOC] | Luma MCP for Claude, ChatGPT [DOC] | Pika MCP, ChatGPT app [DOC] |
| Hosts rival models | Yes, about 25 video models [DOC] | n/f [UNKNOWN] | Yes (Seedance, MiniMax H3, Kling 4.0) [DOC] | Yes (Seedance, Kling 4.0, Wan, others) [DOC] |
| Entry paid plan | $15/mo, 625 credits [DOC] | $10 list, 660 credits (July 2026 blog; live page not fetched) [DOC] | $30/mo, 10,000 credits [DOC] | $10/mo, 600 credits [DOC] |
| Top individual plan | Max $95/mo, 9,500 credits [DOC] | Ultra $180, 26,000 credits (July blog; a review says removed) [DOC]/[IND] | Ultra $300/mo, 150,000 credits [DOC] | Fancy from $95/mo sliding, 8,550+ credits [DOC] |
| Unlimited / relaxed mode | Removed; legacy ends 2026-11-30 [DOC] | n/f [UNKNOWN] | Not on current plans; legacy Unlimited reported [DOC]/[IND] | None by design [DOC] |
| Approx. cost, 5 s flagship clip at entry plan | About $1.44 (720p) [ASSUMED] | [UNKNOWN] in app; $1.18 via API at 1080p [ASSUMED] | About $1.20 (1080p) [ASSUMED] | About $0.33 (2.5, 720p) [ASSUMED] |
| Public self-serve API | Yes [DOC] | Yes [DOC] | Yes (two surfaces) [DOC] | Yes, $10/mo club [DOC] |
| API price, flagship | $0.12/s (gen4.5) [DOC] | $0.157 to $0.235/s [DOC] | About $0.06/s 720p, $0.24/s 1080p [ASSUMED] | H3 Flex from $0.01/s [CLAIM]; catalog not read |
| Webhooks | Not in docs nav [DOC]; [UNKNOWN] | Yes, signed [DOC] | Legacy API yes; Agents API not described [DOC] | Yes, signed [DOC] |
| Over-limit behaviour | Queued as THROTTLED [DOC] | Rejected, error 1303 [DOC] | Rejected, HTTP 429 [DOC] | "Queued or temporarily blocked" [DOC] |
| Charged when moderated (API) | Yes [DOC] | [UNKNOWN] | Yes, not refunded [DOC] | [UNKNOWN] |
| Trains on consumer content | Yes, no opt-out described [DOC] | Yes, email opt-out [DOC] | Yes, no opt-out described [DOC] | Yes, anonymized/aggregated, no opt-out [DOC] |
| Trains on API content | [UNKNOWN] (consumer ToS language is general) | No [DOC] | No per FAQ; pricing page inconsistent [DOC] | Yes, anonymized/aggregated unless agreed [DOC] |
| Commercial use | Not restricted [DOC] | Consumer policy requires written permission (verify); API unrestricted [DOC] | Only outputs made during an active subscription [DOC] | Paid plans only [DOC] |
| Bans building competing products | Yes [DOC] | Yes [DOC] | Yes [DOC] | Yes [DOC] |
| Trustpilot (biased sample) | 1.1/5, 395 reviews [IND] | 1.5/5, 34 reviews [IND] | 1.4/5, 72 reviews [IND] | 2.4/5, 82 reviews [IND] |

---

## 6. What none of them do well

Each gap is tied to evidence. Where the evidence is absence of documentation rather than a documented limit, that is said.

1. **No canonical, portable, editable timeline.**
   - Runway has the only documented multi-track timeline, and it cannot hold image clips, exports only a rendered video, and Runway is reported to recommend a local editor for larger projects. [DOC: R-TL, R-HELP-SNIP]
   - No OTIO, EDL, AAF or XML export was found for any of the four. [UNKNOWN for all four; documented absence on R-TL only]
   - Runway's answer to finishing is plugins that push clips into Premiere, After Effects and Resolve, which concedes that the edit of record lives elsewhere. [DOC: R-CHG] [ASSUMED for the interpretation]
   - Opportunity: a timeline that is the source of truth, round-trips through OTIO/EDL/XML, and keeps each generated shot's recipe attached so it can be re-rendered.

2. **Generated shots are flattened; iteration means paying again.**
   - Runway edits are new generations in a versions feed. [DOC: R-EDIT]
   - Kling 4.0 forces automatic shot-splitting inside one rendered clip. [DOC: K-USE40]
   - Luma Scenes keeps things editable only at the storyboard-keyframe stage, then renders. [DOC: L-SCENES]
   - User reviews across all four centre on credits consumed by corrections and unusable takes. [IND: T-RUNWAY, T-KLING, T-LUMA, T-PIKA]
   - Opportunity: per-shot provenance (prompt, seed, references, model, version) stored locally, with cheap draft tiers and selective re-render.

3. **Local ownership is absent by design.**
   - Outputs are delivered by expiring links: 1 hour for Luma API presigned URLs, 30 days for Kling API results. [DOC: L-AG-VID, K-I2V40]
   - Runway caps the number of projects by plan and meters storage. [DOC: R-PRICE]
   - Three of four consumer terms grant perpetual or irrevocable licences and allow training on user content with no described opt-out; Kling offers opt-out by email. [DOC: R-TOS, L-TOS, P-TOS, K-POLICY]
   - Luma ties commercial use to outputs made during an active subscription. [DOC: L-TOS]
   - Opportunity: project files, assets and metadata on the user's disk; cloud generation as a replaceable service; clear statement of what leaves the machine.

4. **Model independence is partial and inside each vendor's wallet.**
   - Runway, Luma and Pika all now resell rival models, including Kling 4.0 on all three. [DOC: R-PRICE, L-NEWS, P-HOME]
   - Each does so inside its own credit currency with its own markup, plan gating and terms; all four terms prohibit using the service to build competing products. [DOC: R-TOS, K-APITOS, L-TOS, P-TOS]
   - Churn is high: Runway retired Gen-3, Lip Sync, Inpainting and other tools within 2026; Luma runs a legacy API beside a new one; Pika is sunsetting its old site. [DOC: R-DEPR, L-API-FAQ, P-NEW]
   - Only Pika ships open weights, and those are adapters on another vendor's base model with the upscaler withheld. [DOC: P-HF, P-H3]
   - Opportunity: a provider-neutral abstraction with bring-your-own-key and local open-weight models, so projects survive model deprecations.

5. **Cost is hard to predict and failure risk sits with the user.**
   - Runway API charges moderated generations at full price; Luma does not refund `content_moderated` jobs. [DOC: R-API-MOD, L-AG-FAQ]
   - Runway Agent adds per-message LLM charges and generates automatically by default. [DOC: R-AGENT]
   - Runway removed its Unlimited plan, citing queuing; Luma's current plans show no relaxed mode; Pika has none. [DOC: R-UNL1, L-PRICE, P-PRICE]
   - Opportunity: pre-flight cost estimates, hard budgets, local preview models, and approval gates before spend.

6. **Consistency is still acknowledged as unsolved by the vendors themselves.**
   - Pika: multi-scene consistency and complex reference control "remain areas for further improvement". [DOC: P-H3R]
   - Luma's help material tells users faces can still change. [DOC: L-HELP-SNIP, low confidence]
   - Runway's Agent "plan describes its intent, not a guaranteed outcome". [DOC: R-AGENT]
   - User reviews report character drift on Runway and Luma. [IND: T-RUNWAY, T-LUMA]
   - Opportunity: consistency as a project-level asset system (characters, locations, looks) that is checked and enforced across shots and across models, rather than a per-generation reference slot.

7. **Professional finishing is uneven.**
   - Runway and Luma have real HDR/EXR pipelines; Kling's 10-bit HDR is "coming soon"; nothing was found for Pika. [DOC: R-API-PRO, L-RAY32, K-BLOG40] [UNKNOWN for Pika]
   - Generated-video alpha is not offered natively by any. [DOC: R-API-PRO] [UNKNOWN for the others]
   - Runway's ProRes/EXR must be chosen at generation time at extra cost, so a clip made as MP4 cannot later be re-exported at higher fidelity. [DOC: R-GEN45] [ASSUMED for the consequence]

8. **Trust and support.**
   - All four have poor user-review scores with the same themes: opaque credits, refunds, cancellation and unresponsive support. [IND: T-RUNWAY, T-KLING, T-LUMA, T-PIKA] Sample bias applies (section 0).

---

## 7. What would be hard to beat

1. **Runway's breadth and integration velocity.** In ten months it shipped an agent, an editing model, a timeline, node workflows with compositing, about 25 hosted rival models with routing, MCP, three NLE plugins, an app builder, and a full HDR/EXR/ProRes output matrix. [DOC: R-CHG, R-API-PRO] A new entrant cannot match this surface area; it has to win on structure (ownership, timeline, portability), not feature count. [ASSUMED]
2. **Runway's enterprise and studio position.** SOC 2 Type II, ISO 27001, SSO, studio partnerships. [DOC: R-SEC, R-ENT] [CLAIM: R-LGF]
3. **Kling's raw model capability per dollar and its scale.** 30 s native shots, 15 references, 10 keyframes and stereo audio at about $0.16 to $0.24 per second, backed by a business reporting roughly US$500M annualised revenue. [DOC: K-BLOG40, K-APIPRICE] [CLAIM: K-KS-Q1] Competing on model quality is not realistic; integrating Kling through its API (which has the cleanest data terms of the four) is. [ASSUMED]
4. **Luma's colour-pipeline credibility and capital.** Native HDR with 16-bit ACES EXR, dense keyframe control, eight-face performance tracking, and $900M of funding tied to dedicated compute. [DOC: L-RAY32, L-AG-VID] [CLAIM: L-SERIESC]
5. **Pika's price floor and open weights.** A 5 s clip for 10 to 20 credits and a published open-weight model claimed at $0.01 per output second set a low price anchor. [DOC: P-PRICE, P-HF] [CLAIM: P-H3R] Note for a local-first product: the same open weights are available to it, subject to the MiniMax H3 community licence and to hardware in the H100 80 GB class as tested. [DOC: P-HF]
6. **Distribution inside general assistants.** Runway, Luma and Pika are all reachable from ChatGPT, Claude or coding agents through MCP. [DOC: R-CHG, L-MCP, P-BLOG] A user who never opens a dedicated creative app is hard to reach with a desktop product. [ASSUMED]
7. **Aggregation is already commoditised.** "Many models in one place" is not a differentiator: three of the four already do it and Pika undercuts on price. [DOC: R-CHG, L-NEWS, P-CLUB]

---

## 8. Open questions

Pages that could not be fetched or were not read:

- Kling live pricing/membership pages (empty response, redirect, or timeout). Consumer plan data comes from a July 2026 official blog post and one November 2026 user review that contradicts it.
- Kling Terms of Paid Service and Credits Policy (not read); needed to resolve whether paid plans grant commercial use despite the User Policy clause.
- Luma API Terms of Use (guessed URL returned 404) and Luma's legacy pricing page (404).
- Runway help-centre articles on Custom Elements, ML Lab deprecation and "what are my credits worth" (the help centre blocks the fetch tool; earlier articles were read through a read-only browser pane).
- Pika Acceptable Use Policy and the machine-readable API price catalog.
- The MiniMax H3 Community License Agreement text.

Questions the evidence does not answer:

1. Does any of the four export OTIO, EDL, AAF or XML anywhere in the product? Not found; absence is documented only for Runway's timeline article.
2. Does Runway's API support webhooks under another name?
3. Does Gen-4.5 generate audio natively, and does it accept first/last-frame keyframes yet?
4. What exactly is the Kling 4.0 creation-page "timeline", and what do Kling's Agent and Canvas do?
5. What is Kling 4.0's frame rate and consumer credit cost per second?
6. Is the Luma "no-train" position universal on the API (FAQ) or a Scale-plan feature (pricing page)?
7. Does Luma's Agents API have callbacks, and what are the actual RPM and concurrency numbers per plan?
8. Does the New Pika have any timeline or editor, and what export formats does it support?
9. What do independent, hands-on evaluations say about multi-shot consistency for Runway Agent, Kling 4.0, Luma Scenes and Pika Video Studio? None were retrieved; vendor and reseller content dominates search results.
10. What are the commercial-use limits of the MiniMax H3 community licence that governs Pika H3 Flex weights, and what is the realistic minimum hardware?
11. How did Runway's user base react to the removal of Unlimited, and has it affected retention?
12. Do Runway Enterprise contracts exclude customer content from training?

---

## 9. Sources (all accessed 2026-11-11)

Runway

- R-CHG: https://runway.com/changelog
- R-PRICE: https://runway.com/pricing
- R-TOS: https://runway.com/terms-of-use (last updated 2026-10-23)
- R-GWM: https://runway.com/research/introducing-runway-gwm-1
- R-LGF: https://runway.com/news/runway-and-lionsgate-expand-partnership
- R-GEN45: https://help.runwayml.com/hc/en-us/articles/46974685288467
- R-EDIT: https://help.runwayml.com/hc/en-us/articles/51683104370451
- R-ACT2: https://help.runwayml.com/hc/en-us/articles/42311337895827
- R-DEPR: https://help.runwayml.com/hc/en-us/articles/40213860628371
- R-TL: https://help.runwayml.com/hc/en-us/articles/52685547867667
- R-AGENT: https://help.runwayml.com/hc/en-us/articles/51601639579667
- R-REF: https://help.runwayml.com/hc/en-us/articles/52963720640275
- R-UNL1: https://help.runwayml.com/hc/en-us/articles/52068047744019
- R-UNL2: https://help.runwayml.com/hc/en-us/articles/18053095835795
- R-RIGHTS: https://help.runwayml.com/hc/en-us/articles/18927776141715
- R-SEC: https://help.runwayml.com/hc/en-us/articles/24300377879827
- R-ENT: https://help.runwayml.com/hc/en-us/articles/48625698573075
- R-HELP-SNIP: help.runwayml.com article seen only as a search-result snippet (local-editor recommendation, 35 GB export); exact URL not captured
- R-API: https://docs.dev.runwayml.com/
- R-API-PRICE: https://docs.dev.runwayml.com/guides/pricing/
- R-API-TIERS: https://docs.dev.runwayml.com/usage/tiers/
- R-API-MODELS: https://docs.dev.runwayml.com/guides/models/
- R-API-PRO: https://docs.dev.runwayml.com/guides/professional-outputs/
- R-API-ATTR: https://docs.dev.runwayml.com/usage/attribution/
- R-API-USE: https://docs.dev.runwayml.com/guides/using-the-api/
- R-API-MOD: https://docs.dev.runwayml.com/api-details/moderation/
- T-RUNWAY: https://www.trustpilot.com/review/runwayml.com

Kling

- K-BLOG40: https://kling.ai/blog/kling-4-ai-video-model and https://kling.ai/blog/kling40-kling-visual-realism-creative-control-introducing-storytelling
- K-DIRECTOR: https://kling.ai/blog/kling-video-3-director-mode-multi-shot-tutorial
- K-CREDIT: https://kling.ai/blog/kling-video-3-0-credit-cost-guide (2026-07-28)
- K-PR30: Kling 3.0 press release, February 2026 (found via search; wire copy)
- K-POLICY: https://kling.ai/docs/user-policy (last updated 2026-04-21)
- K-CAP: https://kling.ai/document-api/guides/capability-map/video.md
- K-USE40: https://kling.ai/document-api/api/usage-guide/kling-4-0.md
- K-I2V40: https://kling.ai/document-api/api/video/4-0/image-to-video.md
- K-CALLBACK: https://kling.ai/document-api/api/get-started/callbacks.md
- K-CONC: https://kling.ai/document-api/api/get-started/concurrency-rules.md
- K-APIPRICE: https://kling.ai/document-api/pricing/base/video.md
- K-APITOS: https://kling.ai/document-api/guides/protocols/paid-service.md (effective 2026-04-21)
- K-KS-Q1: https://kuaishou.gcs-web.com/news-releases/news-release-details/kuaishou-technology-announces-first-quarter-2026-unaudited
- Docs index used: https://kling.ai/document-api/llms.txt
- T-KLING: https://www.trustpilot.com/review/kling.ai
- Not fetched: https://kling.ai/pricing , https://kling.ai/membership/membership-plan

Luma

- L-NEWS: https://lumalabs.ai/news
- L-PRICE: https://lumalabs.ai/pricing
- L-RAY32: https://lumalabs.ai/news/introducing-ray-3-2
- L-RAY314: https://lumalabs.ai/news/ray3_14
- L-MODIFY: https://lumalabs.ai/news/ray3-modify
- L-SCENES: https://lumalabs.ai/news/introducing-luma-scenes
- L-SKILLS: https://lumalabs.ai/news/luma-skills
- L-VARIANTS: https://lumalabs.ai/news/introducing-luma-variants
- L-MCP: https://lumalabs.ai/news/new-luma-mcp
- L-SERIESC: https://lumalabs.ai/news/series-c
- L-TOS: https://lumalabs.ai/legal/tos (last updated 2026-05-14)
- L-APIPRICE: https://lumalabs.ai/api/pricing
- L-API-OLD: https://docs.lumalabs.ai/
- L-API-VID: https://docs.lumalabs.ai/docs/video-generation.md
- L-API-RL: https://docs.lumalabs.ai/docs/rate-limits.md
- L-API-FAQ: https://docs.lumalabs.ai/docs/faq.md
- L-AG: https://docs.agents.lumalabs.ai/
- L-AG-VID: https://docs.agents.lumalabs.ai/guides/videos/generation/
- L-AG-RL: https://docs.agents.lumalabs.ai/guides/rate-limits/
- L-AG-FAQ: https://docs.agents.lumalabs.ai/guides/faq/
- L-HELP-SNIP: Luma help-centre and billing-policy pages seen only through search-result summaries (https://lumaai-help.freshdesk.com/support/solutions/articles/151000220904 , https://lumalabs.ai/legal/billing-policy); not opened
- EESEL-L: https://eesel.ai/blog/luma-ai-pricing (last edited 2026-06-05; publisher sells other AI tools)
- Press on the Luma Agents launch: https://techcrunch.com/2026/03/05/exclusive-luma-launches-creative-ai-agents-powered-by-its-new-unified-intelligence-models/ (read through search summary)
- T-LUMA: https://www.trustpilot.com/review/lumalabs.ai
- Returned 404: https://lumalabs.ai/legal/api-tos , https://lumalabs.ai/learning-hub/pricing

Pika

- P-HOME: https://pika.art/
- P-PRICE: https://pika.art/pricing
- P-FAQ: https://pika.art/faq
- P-TOS: https://pika.art/terms-of-service (last updated 2026-08-04)
- P-BLOG: https://pika.art/blog
- P-NEW: https://pika.art/blog/welcome-to-the-new-pika
- P-H3: https://pika.art/blog/pika-h3-flex
- P-H3R: https://pika.art/blog/pika-h3-flex-research
- P-CLUB: https://pika.art/blog/pika-api-club
- P-VS: https://create.pika.art/apps/create-video
- P-25: https://create.pika.art/apps/pika-2-5
- P-DEV: https://dev.pika.art/
- P-DEVTOS: https://dev.pika.art/terms-of-service
- P-HF: https://huggingface.co/Pika-Labs/Pika-H3-Flex
- SEMAFOR: https://www.semafor.com/article/09/17/2026/video-ai-company-pika-offers-tool-to-speed-up-ai-video-creation
- T-PIKA: https://www.trustpilot.com/review/pika.art
- Fetched but without the needed data: https://dev.pika.art/pricing (prices live in an API catalog that was not queried)

Other items referenced only through search-result listings (not opened individually, treat as weak [IND]): funding-tracker pages for Runway's Series E; press on Kling's spin-off plans (thenextweb.com 2026-07-02, thestar.com.my 2026-09-29); third-party Kling reviews and complaint roundups (eesel.ai, renderforest, aliteq, Sikayetvar); reseller guides on Kling consistency (atlascloud.ai); an aggregator anecdote on Luma credit burn (autobound.ai).
