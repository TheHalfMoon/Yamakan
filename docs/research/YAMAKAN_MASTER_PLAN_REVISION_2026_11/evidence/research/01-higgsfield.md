# Higgsfield (higgsfield.ai): competitive research

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Research date: 2026-11-11. Method: public web search and read-only page fetches. No account was created, nothing was signed in to, no file was downloaded and no form was submitted. The product was not used; nothing below is a hands-on observation by the author.

## Evidence labels

Every factual claim carries exactly one label.

| Label | Meaning |
|---|---|
| [DOC] | Stated on an official Higgsfield product, help-center, docs, changelog, terms or privacy page |
| [CLAIM] | Vendor marketing, press release, vendor blog, founder statement, or vendor-run SEO site (geo.higgsfield.ai); not independently confirmed |
| [IND] | Independent third-party observation (press, review, forum, review site). Caveats are added where the third party is a competitor, an affiliate, or did not use the product |
| [ASSUMED] | The author's inference or arithmetic |
| [UNKNOWN] | Proprietary or could not be determined from public sources |

Labelling rules applied here:

- Higgsfield blog posts and press releases are [CLAIM], even when specific, unless the same fact appears in the help center, docs, changelog or terms.
- Facts seen only in a search-result snippet, with the page itself not fetched, are marked "snippet only".
- Source-number shorthand such as (S12) refers to the source list in section (j).

---

## (a) Summary

Higgsfield is a cloud-only, credit-metered aggregator of third-party image, video, audio and language models (Seedance, Kling, Veo, Sora, Wan, Nano Banana, GPT Image, FLUX and others) wrapped in its own direction, character and marketing tooling, plus a small set of proprietary models (Soul 2.0, Soul Cinema, Soul Cast, DoP, Genjutsu) [DOC] (S6, S9, S14). Its 2026 trajectory is breadth and agents: Cinema Studio 4.0 for directed multi-shot clips, Canvas for node workflows, the Supercomputer agent workspace, Marketing Studio and Ads Studio, a standalone pay-per-generation API, a hosted MCP server, a CLI, and plugins for DaVinci Resolve, Premiere Pro, After Effects, Photoshop, Figma and Blender [DOC] (S5, S9, S10, S13, S14). It does not offer an editable multitrack timeline: its own Cinema Studio landing page uses the phrase "No timeline, no post" [DOC] (S7), every documented post-generation change is another cloud generation pass on a flattened clip [DOC] (S4, S8), and final assembly is delegated to the agent or to an external editor through plugins [DOC] (S10, S13). The company is well capitalised, with a reported $400M Series B at a $5.4B valuation in August 2026 [IND] (S40). Its recurring weaknesses in independent sources are billing and refund friction, credit expiry, throttled Unlimited access, opaque layered moderation, and default training on user content with no opt-out below an Enterprise Agreement [IND] (S30, S31, S32, S34) and [DOC] (S1, S2).

---

## (b) Feature-by-feature table

### Creation and direction surfaces

| Feature | What is established | Label | Source |
|---|---|---|---|
| Cinema Studio (versions) | A version selector offers 2.0 through 4.0, with 4.0 the default | [DOC] | S4 |
| Cinema Studio 4.0 engine | 4.0 runs on Seedance 2.5 | [DOC] | S4 |
| Cinema Studio 4.0 clip length | Up to 30 seconds per generation | [DOC] | S4 |
| Cinema Studio 4.0 length, conflicting statement | The Cinema Studio landing page says up to one minute per generation | [DOC] | S7 |
| Cinema Studio 4.0 resolution | The launch blog FAQ gives a 1080p ceiling | [CLAIM] | S3 |
| Cinema Studio 4.0 resolution, conflicting statement | The landing page and the Enterprise page describe native 4K | [DOC] | S7, S16 |
| Cinema Studio 4.0 references | Up to 50 reference images | [DOC] | S4 |
| Cinema Studio 4.0 controls | Director's Panel with film setup (genre, era, tempo), camera settings (camera, lens, aperture) and character direction (emotion, palette, lighting) | [CLAIM] | S3 |
| Cinema Studio 4.0 modes | References, Forward/Backward Extend (accepts an uploaded video up to 30 seconds), and Edit Video for regional edits | [DOC] | S4 |
| Native audio | Audio is generated in the same pass as picture in Cinema Studio 4.0 | [DOC] | S4 |
| Multi-shot output | Scenes are described as arriving pre-assembled with cuts inside a single generation | [DOC] | S7 |
| Script breakdown assistant | An assistant (named Mr. Higgs on the landing page, Personal Assistant in the blog, Claude Chat AI Director in 3.5) splits a script into shots | [DOC] | S4, S7 |
| Cinema Studio workspace | Cinema Studio received its own workspace with projects and Elements in June 2026 | [DOC] | S14 |
| Canvas | Node-based infinite board; text prompt, generation and reference nodes; every Higgsfield model available as a node; nodes run individually or in sequence | [DOC] | S5 |
| Canvas templates and autosave | A canvas can be saved as a template; work autosaves | [DOC] | S5 |
| Canvas export | No file, project or JSON export is described on the help article or the intro page | [DOC] | S5, S15 |
| Canvas timeline | No timeline, clip sequencing or final-video assembly step is described | [DOC] | S15 |
| Soul ID | Trained identity for one person; 20 to 80 photos; training described as taking a few minutes | [DOC] | S11 |
| Soul ID portability | The identity is not exportable as a standalone file | [DOC] | S11 |
| Soul ID scope | The help article says the identity is not tied to one model and can be used in Seedance through Elements | [DOC] | S11 |
| Soul ID photo count, conflicting statements | Other Higgsfield pages give 5+ or 10+ photos (snippet only) | [CLAIM] | S26 |
| Soul ID limits | One Soul ID represents one person; multi-character scenes need Elements; results are described as recognisably the same person, not pixel-identical | [DOC] | S11 |
| Soul Cast / AI Cast | AI Cast places up to three actors in a keyframe (March 2026); a virtual casting studio sets look, era and archetype | [DOC] | S14 |
| Elements | Library of reusable characters, locations and props invoked with @ (February 2026); project-scoped but can be pulled from other projects | [DOC] | S4, S14 |
| Popcorn (storyboard) | Up to 8 images per sequence; sequences can be chained by reusing the last image as the next reference | [DOC] | S12 |
| Popcorn export | No PDF, image-set or structured export is specified on the product page | [DOC] | S12 |
| Moodboards | Carry tone and palette into a generation; replaced Presets (February 2026) | [DOC] | S14 |
| 3D Jutsu | 3D workspace that turns a prompt or reference into an editable scene, then video (September 2026) | [DOC] | S14 |
| Draw to Edit / Draw to Video | Listed as tools in the official site index; Draw to Edit is tied to Seedance 2.5 Edit on the AI Video Editor page | [DOC] | S6, S8 |
| Keyframes, Animate, Mixed Media | Listed in the official site index | [DOC] | S6 |
| Apps directory | Roughly 100 one-click apps (for example Angles, Shots, Relight, Recast, Character Swap, Face Swap, Transitions) | [DOC] | S6 |

### Marketing, ads and automated content

| Feature | What is established | Label | Source |
|---|---|---|---|
| Marketing Studio | Creates ad videos from a product photo or link (April 2026); ad-reference recreation added May 2026 | [DOC] | S14 |
| Ads Studio | Static ads from a website link with brand setup and batches of up to 20 (30 Sep 2026); video-ad agent with brand kits and avatars (9 Nov 2026) | [DOC] | S14 |
| Ad Multiplier | Recreates a video ad with the user's cast, products and locations (6 Oct 2026) | [DOC] | S14 |
| Product placement (Ads 2.0) | Announced in a September 2025 blog post (snippet only) | [CLAIM] | S26 |
| Shorts Studio | Vertical 9:16 reels with an AI host (3 Nov 2026) | [DOC] | S14 |
| Content Factory | Turns a topic into a faceless video with script, voiceover and edit, 15 seconds to 5 minutes (22 Oct 2026) | [DOC] | S14 |
| Faceless channel | In Supercomputer; YouTube videos up to 15 minutes with script, voiceover, 2D animation, music and subtitles | [DOC] | S10 |
| Mangaka | Manga, comics and webtoons with PDF, CBZ and PNG export (2 Nov 2026) | [DOC] | S14 |
| AI Influencer | Character builder with five free generations (2 Oct 2026) | [DOC] | S14 |
| Playable | Browser games from a description; Playable Ads is an Enterprise product (26 Oct 2026) | [DOC] | S14 |

### Audio, lipsync, finishing

| Feature | What is established | Label | Source |
|---|---|---|---|
| Lipsync Studio | Listed as a current product in the official index | [DOC] | S6 |
| Intone | Lip-synced talking characters with up to 30 seconds of speech per generation (30 Oct 2026) | [DOC] | S14 |
| AI Dubbing | 18 languages | [DOC] | S8 |
| Audio models | Seed Audio 1.0 (speech, sound, music; June 2026), Seed Speech (April 2026), Eleven v4 text-to-speech (28 Sep 2026) | [DOC] | S14 |
| Upscale | Outputs 1080p, 2K or 4K at 24 to 120 fps; engines include FLUX 3 Video Upscaler, a ByteDance engine and Topaz workflows | [DOC] | S8, S14 |
| Reframe | Adapts video to 16:9, 9:16 or 1:1 without cropping (May 2026) | [DOC] | S8, S14 |
| Relight and Color Palette | Standalone tools (August 2026) | [DOC] | S14 |
| Genjutsu | Proprietary video-edit model: object swap, motion transfer, whole-video restyle; Lite variant added October 2026 | [DOC] | S14 |
| Layers | Splits an image into editable elements and edits text (August 2026) | [DOC] | S14 |
| AI Video Editor | Prompt-based editing of uploaded or generated footage: object removal or replacement, background change, restyle, frame interpolation, deflicker, extend | [DOC] | S8 |
| AI Video Editor scope | Trimming, cutting, captions and a timeline are not described on the page | [DOC] | S8 |

### Agents and assistants

| Feature | What is established | Label | Source |
|---|---|---|---|
| Supercomputer | Chat-driven agent workspace on the web; plans steps, routes generation models automatically, returns results in chat; refinement re-runs only changed parts | [DOC] | S10 |
| Supercomputer features | Memory between chats, connectors (Telegram, Slack, TikTok, Gmail, Google Drive, Notion), skills, apps, games, workspace storage | [DOC] | S10 |
| Supercomputer availability | Paid plans | [DOC] | S13 |
| Supercomputer storage | Default quota raised to 20 GB in July 2026; more is bought with credits monthly | [DOC] | S14 |
| Supercomputer LLM choice | Model selector includes models from Anthropic, OpenAI, Google, xAI, DeepSeek and others | [DOC] | S10 |
| Supercomputer billing | Every generation step deducts credits; complex tasks cost more than a single generation | [DOC] | S10 |
| Supercomputer assembly | The help article does not describe how multi-clip videos are stitched, any editor, or export formats | [DOC] | S10 |
| Parallel Chats | Limited by plan to 1, 3 or 10 | [CLAIM] | S20 |
| Supercomputer 2.0 (enterprise) | Positioned as enterprise marketing agents; an auditability layer was described as roadmap, not shipped, in June 2026 | [IND] | S41 |
| Scaffold | Reported as built on the open-source Hermes agent scaffold (snippet only) | [IND] | S44 |

### Apps, desktop and host integrations

| Feature | What is established | Label | Source |
|---|---|---|---|
| Web app | Primary surface at higgsfield.ai | [DOC] | S6 |
| Mobile | A changelog entry dated 24 Sep 2026 describes a mobile interface redesign | [DOC] | S14 |
| Native mobile app | Whether that entry refers to a native app or the mobile web could not be determined | [UNKNOWN] | n/a |
| App Store listing | A search result shows an iOS app named Diffuse with Higgsfield Inc. as provider; the US listing URL returned HTTP 404 when fetched, and no rating was retrieved | [IND] | S46 |
| Look-alike apps | Several third-party apps use the Higgsfield name in the App Store (snippet only) | [IND] | S46 |
| Standalone desktop app | None found; the official site index lists no desktop application | [DOC] | S6 |
| DaVinci Resolve plugin | Generation, Edit Video, Draw to Video, Reframe, Remove Background, Upscale to 4K, Color Match/LUT, import to Media Pool or Timeline | [DOC] | S9 |
| Premiere Pro / After Effects plugin | Generate video or image to the timeline, Reframe, Remove Background, Upscale, Draw to Edit, Edit Video | [DOC] | S9 |
| Photoshop plugin | Realtime AI, Layer Decompose, Shots, Character Swap, Upscale and others | [DOC] | S9 |
| Figma / FigJam plugin | Generation and editing on the canvas, including Canvas nodes | [DOC] | S9 |
| Blender add-on | Scene Builder, 3D Model, Animation and Camera tools, plus a Blender Bridge MCP | [DOC] | S9, S14 |
| Production Skills Bundle | 11 MCP workflows that run inside Blender, Adobe apps, TouchDesigner and DaVinci Resolve (23 Sep 2026) | [DOC] | S14 |
| ChatGPT plugin | Image, video, ads, sites and games inside ChatGPT (30 Sep 2026) | [DOC] | S14 |
| Plugin billing | All integrations use plan credits; Unlimited and free generations do not apply in plugins | [DOC] | S9 |
| Resolve plugin connectivity | A third-party spec review states the Resolve plugin needs an internet connection | [IND] | S36 (not hands-on) |

### Models exposed

| Item | What is established | Label | Source |
|---|---|---|---|
| Third-party video models | Model pages or changelog entries exist for Sora 2, Veo 3.1, Kling 3.0 and 4.0, Wan 2.6/2.7/3.0, Seedance 2.0 and 2.5, Grok Imagine Video, MiniMax H3, Gemini Omni Flash, HappyHorse | [DOC] | S6, S14 |
| Third-party image models | Nano Banana Pro/2/2.1, FLUX 2 and 3, GPT Image 1.5 through 2.6, Seedream 5.x, Ideogram 4.5, Recraft | [DOC] | S6, S14 |
| Proprietary models | Soul 2.0, Soul Cinema, Soul Cast, DoP, Genjutsu, Marketing Studio Image | [DOC] | S6, S14, S21 |
| Native Cinema Studio models | The launch blog refers to native Cinema Studio models alongside Soul Cinema and third-party engines | [CLAIM] | S3 |
| What the native models are | Architecture, training data and whether they are fine-tunes of third-party models | [UNKNOWN] | n/a |
| Model presentation | Models are named openly with per-model pages; the per-generation credit price appears on the Generate button | [DOC] | S6, S17 |
| Per-shot engine choice | Cinema Studio lets the user pick the engine per shot | [DOC] | S7 |
| Automatic routing | Supercomputer and the CLI choose a model automatically unless one is specified | [DOC] | S10, S23 |
| Onboarding cadence | The changelog shows multiple new third-party models added most weeks from August to November 2026 | [DOC] | S14 |
| Wrapper criticism | Press coverage of a February 2026 backlash reports critics describing the service as largely a wrapper around other vendors' models | [IND] | S33 |

### Collaboration and persistence

| Item | What is established | Label | Source |
|---|---|---|---|
| Canvas collaboration | Real-time multi-user editing via a share link; comments attach to nodes | [DOC] | S5, S15 |
| Canvas versions | Every version is saved automatically; browsing or restoring versions is not described | [DOC] | S15 |
| Cinema Studio team features | Live co-directing, comments, shared Elements, project brief, subfolders | [DOC] | S7 |
| Supercomputer Projects | Shares context and instructions across a team (August 2026) | [DOC] | S14 |
| Assets library | Generations from web, MCP and CLI land in one Assets library, tagged by source | [DOC] | S22, S23 |
| Enterprise projects | Projects have name, slug, description, cover and Private/Shared visibility (snippet only) | [DOC] | S26 |
| Retention after deletion | Removed content may stay on active servers for 30 days plus backups | [DOC] | S2 |
| API output retention | API outputs are kept for at least 7 days and may be removed afterwards | [DOC] | S24, S25 |

---

## (c) Pricing and credits

### Plan prices: sources conflict, and the live pricing page could not be read

The live pricing page (https://higgsfield.ai/pricing) returned only a JavaScript shell on two attempts; no plan data was retrieved from it [DOC] (S18). The table below therefore shows what each secondary source reported, without choosing a winner.

| Plan | Vendor blog, prices stated as verified 11 Sep 2026 [CLAIM] (S19) | Krea capture, 31 Aug 2026 [IND, competitor] (S37) | The Post Flow, updated 7 Nov 2026 [IND, not hands-on] (S36) | AI Funnel Insider, 31 Oct 2026 [IND, affiliate, not hands-on] (S38) |
|---|---|---|---|---|
| Free | not stated | $0, 0 credits | $0, watermark, 0 credits | says there is no free plan |
| One-time pass | not stated | not stated | not stated | $3, 40 credits, two days of unlimited Soul 2.0 |
| Starter | $15/mo, 200 credits | $19/mo, 270 credits | $19/mo, 270 credits | $19/mo, 270 credits |
| Plus | $49/mo or $39/mo annual, 1,000 credits | $59/mo or $47/mo annual, 1,200 credits | $59/mo or $47/mo annual, 1,200 credits | $59/mo or $47/mo annual, 1,200 credits |
| Ultra | $129/mo or $99/mo annual, 3,000 credits | $129/mo or $99/mo annual, 3,000 credits | $129/mo or $99/mo annual, 3,000 credits | reports the Ultra card no longer shown on 31 Oct |
| Team | not stated | 2 to 9 seats | from $65/seat, 1,000 pooled credits per seat, 2 to 15 seats | not stated |
| Scale | not stated | 5 to 15 seats, SSO | not stated | not stated |
| Enterprise | not stated | custom | not stated | not stated |

Additional points on plans:

- A vendor blog dated 11 Nov 2026 names plan variants Ultra 3K and Ultra 9K and advertises up to 60% off annual plans, without stating dollar prices [CLAIM] (S27).
- One third-party review notes that regional catalogues can show different prices [IND, affiliate, not hands-on] (S38). This may explain part of the conflict [ASSUMED].
- Business tiers are Team, Scale and Enterprise; Scale adds priority queue, SSO and admin spend controls; Enterprise adds custom credits, rollover credits, dedicated capacity and compliance [DOC] (S28).
- Enterprise is sold on annual contracts with pooled credits and no public price [DOC] (S16).
- Without a subscription only a small set of models is available and no credits are granted [DOC] (S28).
- The official Team page URL (https://higgsfield.ai/team) returned HTTP 404 when fetched [DOC] (S18).

### Credit rules

| Rule | Detail | Label | Source |
|---|---|---|---|
| Subscription credits | Expire at each renewal; no rollover | [DOC] | S1, S17 |
| Annual plans | Credits still reset every 30 days | [DOC] | S17 |
| Credit packs, auto-refill, boost packs | Expire after 90 days | [DOC] | S1, S17 |
| Cash value | Credits have no cash value and are non-transferable | [DOC] | S1 |
| Forfeiture | Credits may be forfeited on cancellation or on termination for cause | [DOC] | S1 |
| Spend order | Subscription credits first, then the soonest-expiring | [DOC] | S17 |
| Where credits are consumed | Web, MCP, CLI, Canvas, Supercomputer and plugins, including re-rolls and upscales | [DOC] | S9, S17 |
| Failed generations | Usage history shows credit returns for failed generations | [DOC] | S17 |
| Blocked generations | Credits are returned automatically for most models, not all | [DOC] | S29 |
| Credit-pack prices | 80 for $5, 170 for $10, 380 for $20, 840 for $40, 1,700 for $80; an active subscription is required | [IND, competitor] | S37 |
| Auto-refill | $1 per 20 credits on Plus and above | [IND, competitor] | S37 |
| Enterprise credits | Structured data on the Enterprise page says pooled credits roll over and do not expire; the visible page text does not repeat this | [DOC] | S16 |

### Published or reported credit costs per generation

| Generation | Credits | Label | Source |
|---|---|---|---|
| Cinema Studio 4.0, 10 s, 720p, with audio | 70 | [CLAIM] | S39 |
| Cinema Studio 4.0, 30 s, 1080p | 480 (360 under a limited-time discount) | [CLAIM] | S39 |
| Seedance 2.5, 8 s, 1080p | 72 (vendor equates this to about $3.60) | [CLAIM] | S19 |
| Kling 3.0, 8 s, 1080p | 20 (vendor equates this to about $1.00) | [CLAIM] | S19 |
| Seedance 2.5, 5 s, 1080p | 60 | [IND, not hands-on] | S36 |
| Seedance 2.5, 8 s, 720p | 52 | [IND, competitor] | S37 |
| Seedance 2.0, 5 s 720p / 5 s 1080p / 10 s 720p / 10 s 1080p | 23 / 45 / 45 / 90 | [IND, competitor] | S37 |
| Kling 3.0, same four configurations | 10 / 12.5 / 20 / 25 | [IND, competitor] | S37 |
| Cinema Studio (version not stated), same four configurations | 25 / 50 / 50 / 100 | [IND, competitor] | S37 |
| Wan 2.7, same four configurations | 8 / 13 / 15 / 25 | [IND, competitor] | S37 |
| Nano Banana Pro image | about 2, or 4 at 4K | [IND, competitor] | S37 |
| Veo 3.1, 4 s | about 11 on Fast, about 29 standard | [IND, affiliate, not hands-on] | S38 |
| Sora 2, 4 s, 720p | about 10 | [IND, affiliate, not hands-on] | S38 |

Derived arithmetic: at the third-party-reported Plus price of $59 for 1,200 credits, one 30-second 1080p Cinema Studio 4.0 generation at 480 credits would consume 40% of the month's allowance, roughly $23.60 of plan value [ASSUMED]. A vendor blog estimates about $150 to $160 for a five-minute short [CLAIM] (S20).

### Unlimited: what it means and its caveats

| Point | Detail | Label | Source |
|---|---|---|---|
| Definition | Model-specific windows during which generations on that model do not deduct credits | [DOC] | S21a |
| Duration | Most included models have 365-day windows; newest flagship models may have short windows such as 7 days; some models get a one-time pool of free generations | [DOC] | S17, S21a |
| Surface restriction | Applies only on the higgsfield.ai web surface; MCP, CLI, Canvas, Supercomputer and plugins always deduct credits | [DOC] | S5, S9, S21a |
| Queue | Unlimited generations run in the standard queue; credit generations run in the priority queue | [DOC] | S21a |
| Peak behaviour | Unlimited speed and concurrency may vary at peak hours | [DOC] | S21a |
| Terms | Unlimited is subject to fair-use limits; automated or excessive use may be throttled or queued; speed and concurrency are not guaranteed | [DOC] | S1 |
| Fair use | Personal human use only; automation, scripting, credential sharing and reselling are prohibited; access can be paused for manual review | [DOC] | S21a |
| Subscription dependency | Purchased Unlimited windows work only while a subscription is active and do not restart at renewal | [DOC] | S21a |
| Marketplace bundles | Per-model bundles are sold separately; concurrency is 1 video (up to 15 seconds) or 2 images at a time, or 2 images plus 1 video for the all-models bundle | [DOC] | S21a |
| Marketplace pricing | Passes of 1, 3 or 7 days priced from $7 to $1,035 (7-day, all models) | [CLAIM] | S19 |
| Plan-level concurrency under Unlimited | One vendor blog says 1 image, 1 video and 1 audio at a time (snippet only); the help article gives figures only for bundles | [CLAIM] | S26 |
| Capped settings | The 11 Nov 2026 promotion caps Unlimited Seedance 2.5 at 20 s 480p on Plus monthly and 30 s 1080p on Ultra annual | [CLAIM] | S27 |
| Cinema Studio and Unlimited, statement 1 | The help article says web Cinema Studio generations do not deduct credits when its models are in the plan's Unlimited list | [DOC] | S4 |
| Cinema Studio and Unlimited, statement 2 | The October 2026 press release says Cinema Studio generations are billed separately from unlimited model access | [CLAIM] | S39 |
| MCP trial and Unlimited | The 11 Nov 2026 blog advertises a $0, 3-day MCP trial with Unlimited access to all models that auto-renews to Ultra 3K; the help center says Unlimited never applies through MCP | [CLAIM] | S27 (conflicts with S22) |

### Refunds, cancellation and renewal

| Point | Detail | Label | Source |
|---|---|---|---|
| Initial purchase refund | Within 7 days, only if no credits were used, less a service fee of up to 6% | [DOC] | S1 |
| Renewals | Generally non-refundable | [DOC] | S1 |
| Credit packs | Same rule as initial purchases; access add-ons are non-refundable once granted | [DOC] | S1 |
| EEA/UK | 14-day withdrawal right | [DOC] | S1 |
| Renewal and price changes | Auto-renewal; 30 days' email notice of price increases; no proration | [DOC] | S1 |
| Trials | Convert to paid plans unless cancelled | [DOC] | S1 |
| Termination | Fees are non-refundable and credits forfeited on termination for violation; banned users may not re-register | [DOC] | S1 |

---

## (d) API and developer access

### Standalone API (launched 16 September 2026)

| Point | Detail | Label | Source |
|---|---|---|---|
| Product shape | Separate developer product with a prepaid US-dollar balance; no subscription; does not touch plan credits | [DOC] | S25 |
| Launch date | 16 Sep 2026 | [DOC] | S14 |
| Minimum top-up | $5 | [DOC] | S25 |
| Balance expiry | Funds expire one year after being added | [DOC] | S25 |
| Catalogue | 50+ video and image models (Seedance, Kling, Wan, MiniMax, PixVerse, LTX, Grok, Ideogram, Recraft, Qwen) plus Soul 2, Soul Cinema, DoP and Marketing Studio Image; curated and may differ from the website | [DOC] | S25 |
| Audio | No standalone audio models in the API | [DOC] | S25 |
| Notable absences | Sora and Veo are not named in the API model list | [DOC] | S25 |
| Flow | Asynchronous: request ID, then polling or webhook | [DOC] | S25 |
| Failed and moderated requests | Not charged | [DOC] | S24 |
| Cost estimate | An estimate endpoint returns the cost before running | [DOC] | S25 |
| SDKs | Python and TypeScript | [DOC] | S25 |
| Base URL | The help article gives api.higgsfield.ai and a console at open.higgsfield.ai | [DOC] | S25 |
| Base URL, conflicting statement | Earlier search results for the docs gave platform.higgsfield.ai and cloud.higgsfield.ai (snippet only) | [IND] | S26 |
| Teams | Accounts start as a personal organisation; team organisations can be created | [DOC] | S25 |
| Commercial use | Outputs may be used commercially, including client work | [DOC] | S25 |
| Reselling and third-party product terms | Not addressed on the API help article or the docs FAQ | [DOC] | S24, S25 |
| General restriction | The Terms prohibit reselling access to the Service, scraping, reverse engineering and training competing models | [DOC] | S1 |
| Training on API data | Not addressed on the API pages; the general Terms training grant excludes only Enterprise Agreement customers | [DOC] | S1, S25 |
| Promotions | 1:1 cashback on API spend up to $200,000 per verified business until 30 Sep 2026; later a $15 bonus after $100 of spend plus tiered cashback up to 20% | [DOC] | S14 |

### API prices from the launch blog

All rows are [CLAIM] (S21) because the figures were read from the vendor blog, not from a docs price list.

| Model | Price |
|---|---|
| Soul 2, Soul Cinema | $0.0032 per image |
| Marketing Studio Image | $0.0059 per image |
| DoP | $0.125 per generation |
| Kling 2.5 | $0.042 per second |
| Kling 2.6 | $0.07 per second |
| Seedance 2.5 | $0.0738 per second |
| Kling 3.0 | $0.112 per second |
| PixVerse 6 | $0.115 per second |
| MiniMax H3 | $0.13 per second |
| LTX 2.5 Pro | $0.17 per second |
| Wan 3.0 | $0.20 per second |
| Seedance 2.0 | $0.9332 per second |

The Seedance 2.0 figure is more than twelve times the Seedance 2.5 figure. It may reflect a specific configuration or a typographical error; it is reported as read and has not been corrected [ASSUMED].

### Rate limits

| Point | Detail | Label | Source |
|---|---|---|---|
| Primary limit | Concurrency, by account and model, shown in the console | [DOC] | S24a |
| Starting concurrency | 20 concurrent requests on key creation, growing with top-up volume | [DOC] | S25 |
| Over-limit behaviour | Requests queue; a full queue returns HTTP 429 with Retry-After (`account_queue_full`) | [DOC] | S24a |
| Admission errors | HTTP 503 `admission_control_unavailable` exists | [DOC] | S24a |
| Idempotency | Idempotency-Key header supported | [DOC] | S24a |
| Capacity headers | No remaining-capacity headers yet | [DOC] | S24a |
| Raising limits | By contacting the team on Discord | [DOC] | S24a |

### MCP server

| Point | Detail | Label | Source |
|---|---|---|---|
| Endpoint | https://mcp.higgsfield.ai/mcp | [DOC] | S22 |
| Auth | Browser sign-in to the Higgsfield account; no API key | [DOC] | S22 |
| Requirement | An active paid subscription | [DOC] | S22 |
| Clients | Claude, ChatGPT (official plugin), Cursor, Claude Code, OpenClaw, Hermes, other MCP clients | [DOC] | S22 |
| Capabilities | Image and video generation on all models, upscaling, background removal, outpaint and reframe, Kling Motion Control, Soul characters and Elements, voiceover, voice cloning, dubbing, balance and listing tools, skills bundles | [DOC] | S22 |
| Billing | Every generation deducts plan credits regardless of plan; Unlimited does not apply | [DOC] | S22 |
| Spend control | No native credit cap; only a prompt-level instruction, which the help article says is not a hard limit | [DOC] | S22 |
| File input | The agent cannot read images attached to the chat; files go through a separate upload window | [DOC] | S22 |
| Complete tool-name list | Not published in the pages fetched | [UNKNOWN] | n/a |

### CLI and Agent Skills

| Point | Detail | Label | Source |
|---|---|---|---|
| Install | `npm i -g @higgsfield/cli`, `higgsfield auth login`, `npx skills add higgsfield-ai/skills` | [DOC] | S22, S23 |
| Skills installed | generate, soul, product-photoshoot | [DOC] | S23 |
| Agents | Claude Code, Cursor, Codex and others that support Skills or MCP | [DOC] | S23 |
| Billing | Plan credits at MCP rates; no separate API balance; Unlimited does not apply | [DOC] | S23 |
| Output | Up to 4K; results land in Assets on the website | [DOC] | S23 |
| Responsibility | The user is responsible for content a coding agent generates through the account | [DOC] | S1, S23 |

---

## (e) Editability analysis: what can change after generation without regenerating

### The short answer

Nothing documented changes a generated clip without a further cloud generation or processing pass. Each of the operations below takes a rendered clip as input and returns a new rendered clip [ASSUMED], based on how the operations are described in [DOC] sources (S4, S8, S9). Whether any of them is a non-destructive, re-editable adjustment stored with the project could not be determined [UNKNOWN].

### Operations available on an existing clip

| Operation | What changes | Regeneration scope | Label | Source |
|---|---|---|---|---|
| Edit Video (Cinema Studio 4.0) | A selected region of the clip | Regional; described as not regenerating the whole clip | [DOC] | S4 |
| Forward / Backward Extend | Adds footage before or after | New generation appended; source up to 30 s | [DOC] | S4 |
| Color Grading | Temperature, contrast, saturation, sharpness, grain, highlights, exposure | Described as post-generation sliders | [CLAIM] | S3 |
| Color Grading, cost and reversibility | Whether sliders cost credits or remain editable later | not determined | [UNKNOWN] | n/a |
| Genjutsu | One element (object, location, product, character), motion transfer, or full restyle | New model pass on the clip | [DOC] | S14 |
| Prompt edits (AI Video Editor) | Object removal or replacement, background, style | New model pass per edit | [DOC] | S8 |
| Draw to Edit | Region marked by drawing | New model pass (Seedance 2.5 Edit) | [DOC] | S8 |
| Relight, Color Palette | Lighting and palette | New pass | [DOC] | S14 |
| Reframe | Aspect ratio | New pass | [DOC] | S8 |
| Upscale, frame interpolation, deflicker | Resolution, frame rate, stability | New pass | [DOC] | S8 |
| Dubbing and lipsync | Language and mouth movement | New pass | [DOC] | S8 |
| Background removal | Alpha or background | New pass | [DOC] | S9 |
| Seedance 2.5 Draft Mode | Lets a user pick among 480p previews before the 1080p render | Reduces, but does not remove, regeneration cost | [DOC] | S14 |

Credits are consumed by re-rolls and upscales [DOC] (S17), so iteration on any of the above is metered [ASSUMED].

### What is flattened

| Aspect | Status | Label | Source |
|---|---|---|---|
| Cuts inside a multi-shot generation | Delivered already assembled within one clip | [DOC] | S7 |
| Re-timing or reordering shots inside a generated multi-shot clip | No tool for this is described | [DOC] | S4, S7 |
| Native audio | Generated in the same pass as picture | [DOC] | S4 |
| Separate audio stems (dialogue, music, effects) | Not described anywhere fetched | [UNKNOWN] | n/a |
| Camera, lens, lighting and character parameters | Set before generation in the Director's Panel; no documented way to alter them on an existing clip other than regenerating or prompt-editing | [ASSUMED] | S3, S4 |
| Captions | A competitor comparison says captions are burned in | [IND, competitor] | S45 |
| Layered or parametric project export | None described for Cinema Studio, Canvas or Popcorn | [DOC] | S5, S12, S15 |
| Timeline interchange (EDL, XML, OTIO) | Not mentioned in any source fetched | [UNKNOWN] | n/a |

### How a multi-shot piece is actually assembled

1. Script breakdown into shots, by the user or an assistant [DOC] (S4, S7).
2. Character identities via Soul ID or Soul Cast and reusable Elements [DOC] (S11, S14).
3. Optional Popcorn storyboard of up to 8 frames per sequence [DOC] (S12).
4. Cinema Studio generation per shot or per multi-shot scene of up to 30 seconds [DOC] (S4).
5. Audio through native generation or the audio models [DOC] (S4, S14).
6. Assembly: the vendor's short-film guide assigns the shot list and assembly to Supercomputer and describes no timeline, mix, grade or export format [CLAIM] (S20).
7. Alternative assembly: generate inside DaVinci Resolve or Premiere Pro through plugins and edit on the host application's timeline [DOC] (S9).

The vendor's own guide says consistency degrades past about 30 seconds on most models and recommends chaining short clips [CLAIM] (S20). A journalist's hands-on account concluded that editing an AI video in practice meant regenerating it [IND] (S31). Two third-party reviews state there is no built-in timeline and that finishing happens in an external editor [IND, not hands-on] (S36, S38), and a competitor comparison says the same [IND, competitor] (S45).

### Export formats

| Point | Detail | Label | Source |
|---|---|---|---|
| Official export specification | No page fetched states container, codec, bitrate or frame rate for standard downloads | [UNKNOWN] | n/a |
| Preferred input format | MP4 with H.264 is recommended for upscale sources (snippet only) | [DOC] | S26 |
| Bitrate option | A Standard or High bitrate setting was added to Seedance models in June 2026 | [DOC] | S14 |
| Reported output | MP4, 1080p by default, 4K on the top plan; no ProRes, alpha channel or timeline export | [IND, affiliate, not hands-on] | S38 |
| Reported output, conflicting | One guide said downloads were MP4 downscaled to 720p; another gave about 8 Mbps at 720p and 15 Mbps at 1080p (snippets only) | [IND] | S26 |
| Non-video exports | Mangaka exports PDF, CBZ and PNG; vector tools export SVG; Playable Ads exports HTML; GPT Image 2.6 can output GIF and SVG | [DOC] | S14 |
| LUT | The Resolve plugin offers Color Match with LUT output | [DOC] | S9 |
| Watermark | Applied on plans without watermark-free downloads | [DOC] | S30a |

---

## (f) Top recurring user complaints

All items are paraphrased. Trustpilot's aggregate is positive overall (4.0 from 5,420 reviews, 62% five-star and 19% one-star, read on 11 Nov 2026) [IND] (S30); the complaints below describe the negative tail and the press coverage, not the median user.

| # | Complaint | Representative evidence | Label | Source |
|---|---|---|---|---|
| 1 | Billing, cancellation and refund friction | Reviewers report charges after cancelling, duplicate charges and refused refunds | [IND] | S30 |
| 1a | Same theme, press | A journalist reports cancellation presented as a downgrade and refunds unavailable after a single test generation | [IND] | S31 |
| 1b | Same theme, forum | A Reddit poster reports upgrade pop-ups after signup, default auto-renewal and credits lost on cancelling | [IND] | S35b |
| 2 | Unlimited that is throttled | Reviewers report queues or cooldowns after a few generations and say the limits were not clearly disclosed | [IND] | S30 |
| 2a | Same theme, press | Reports of unlimited-plan bans for heavy use and waits of 4 to 10 hours cited from Discord | [IND] | S33 |
| 2b | Same theme, forum | Subreddit posts perceive lower quality in Unlimited mode than in credit mode | [IND] | S35a |
| 3 | Credits burn faster than expected | Reviewers say prompts are not followed, so retries exhaust credits | [IND] | S30 |
| 3a | Same theme, press | A journalist used about 79% of a plan's credits on roughly two dozen clips | [IND] | S31 |
| 3b | Credit expiry | Subreddit complaints about 90-day expiry and failed generations consuming credits | [IND] | S35a |
| 4 | Support quality | Templated replies and requests for excessive information; the company had replied to 96% of negative reviews | [IND] | S30 |
| 4a | Same theme | Discord reports of moderator-dependent support and credits restored only after public complaint | [IND, competitor] | S34b |
| 5 | Moderation and account bans | A reviewer reports permanent suspension for NSFW content without specific explanation (snippet only) | [IND] | S30 |
| 5a | Same theme | Subreddit reports of inconsistent IP flagging and character eligibility blocks | [IND] | S35a |
| 5b | Same theme | A journalist was blocked by an identity check when creating a reusable character, with no clear path forward | [IND] | S31 |
| 6 | Consistency failures | Likeness not preserved in a journalist's test | [IND] | S31 |
| 6a | Same theme | Clothing and character drift reported with Nano Banana 2 and Soul 2.0; Soul ID struggles with stylised or non-human characters | [IND] | S35a, S35c |
| 7 | Quality regressions and outages | Subreddit reports of a Seedream 4.5 regression | [IND] | S35a |
| 7a | Same theme, official record | At least seven changelog notices of provider-side generation failures between 1 Sep and 2 Nov 2026, each with refunds | [DOC] | S14 |
| 8 | Licensing and training terms | A July 2026 terms update drew a widely viewed critical thread; the revision removed the perpetual licence but kept the training grant | [IND, competitor] | S34a |
| 8a | Same theme | A newsletter advised against client or confidential work without an enterprise agreement | [IND] | S34c |
| 9 | Marketing conduct and trust | Press reports of a deleted post about ending creative jobs, astroturfing allegations, an X account suspension in February 2026 and creator-payment disputes | [IND] | S32, S33 |
| 9a | Same theme | Secondary coverage of a Forbes investigation describes marketing kits using stock clips and weak enforcement against abusive content | [IND] | S42 |
| 10 | Affiliate payments | Reviewers report unpaid affiliate commissions | [IND] | S30 |
| 11 | Agent credit consumption | Early reports of high credit use by Supercomputer (snippet only) | [IND] | S44 |

Caveats on this evidence:

- Review-site scores differ by source and date: the live Trustpilot page showed 4.0, while other sources cited 3.2 and 3.7 [IND] (S30, S26).
- The Reddit evidence comes from a third-party archive of subreddit snapshots; post dates computed from the snapshots were inconsistent with product launch dates, so individual post dates are unreliable [ASSUMED].
- Several complaint round-ups are published by competitors (MindStudio, Krea, ChatCut, Creatify) or by affiliate sites [ASSUMED].
- The original Forbes article was not fetched; only secondary coverage was read [IND] (S42).

---

## (g) Weaknesses a local-first, editable-timeline competitor could exploit

| # | Weakness | Why it is exploitable | Evidence |
|---|---|---|---|
| 1 | No editable timeline in the product | A competitor with a real multitrack timeline owns assembly, pacing and revision, which Higgsfield pushes to an agent or to third-party editors | [DOC] S7, S8, S10; [IND] S31, S45 |
| 2 | Every revision is a metered cloud pass | Local, non-destructive edits (trim, reorder, regrade, remix) cost nothing per iteration; Higgsfield charges credits for re-rolls and upscales | [DOC] S17; [IND] S31 |
| 3 | Flattened output | Cuts and audio are baked into one clip; no stems or layers are documented; a competitor that keeps shots, audio and grades as separate editable objects is differentiated | [DOC] S4, S7; [UNKNOWN] for stems |
| 4 | Credit expiry and forfeiture | No rollover, 90-day pack expiry, forfeiture on cancellation; a local-first product can price without expiring balances | [DOC] S1, S17; [IND] S30, S35a |
| 5 | Unlimited is narrow | Web surface only, standard queue, variable speed, capped settings, excluded from Canvas, Supercomputer, MCP, CLI and plugins | [DOC] S5, S9, S21a; [CLAIM] S27 |
| 6 | Default training on user content | Inputs and outputs may train Higgsfield's models; only Enterprise Agreement customers are excluded; already-trained content cannot be removed; local processing avoids the question | [DOC] S1, S2, S30a |
| 7 | No data-residency commitment below Enterprise | Processing in the US and other countries including Kazakhstan; EU residency appears only in Enterprise structured data | [DOC] S2, S16 |
| 8 | Cloud and provider dependency | Repeated provider-side failures in the official changelog; queue complaints; a plugin that reportedly requires internet; API outputs kept only 7 days | [DOC] S14, S24; [IND] S33, S36 |
| 9 | Opaque layered moderation | Third-party filters Higgsfield says it cannot see into; false positives acknowledged; no formal appeal; credits returned for most, not all, models | [DOC] S29 |
| 10 | Non-portable creative assets | Soul ID cannot be exported; no export described for Canvas or Popcorn; a competitor with open project files and interchange formats reduces lock-in | [DOC] S5, S11, S12, S15 |
| 11 | Unpublished export specifications | No official codec, bitrate or frame-rate statement found; third-party reports of no ProRes or alpha | [UNKNOWN]; [IND] S38 |
| 12 | Pricing opacity | The live pricing page is script-rendered, secondary sources disagree on prices and credits, per-generation prices appear only at the Generate button | [DOC] S17, S18; [CLAIM] S19; [IND] S36, S37 |
| 13 | No hard spend cap for agents | MCP has no native credit cap; a competitor can offer budgeted, auditable agent runs | [DOC] S22 |
| 14 | Inconsistent first-party documentation | Official pages disagree on Cinema Studio length and resolution, Soul ID photo counts, API host and whether Unlimited covers Cinema Studio | [DOC] S4, S7, S11, S25; [CLAIM] S3, S39 |
| 15 | Trust deficit with professionals | Billing complaints, the terms backlash, the Forbes-reported marketing practices and the X suspension | [IND] S30, S32, S33, S34a, S42 |
| 16 | Arbitration and termination terms | Binding arbitration with class waiver; termination without cause on notice; credits forfeited on termination for violation | [DOC] S1 |
| 17 | Short clip horizon | 30-second generations and vendor-acknowledged drift beyond about 30 seconds mean long-form work is many stitched clips, which favours a tool built around a shot timeline | [DOC] S4; [CLAIM] S20 |

A caution on weakness 1: Higgsfield already reaches professional timelines through its Resolve and Adobe plugins [DOC] (S9), so the gap is in its own product, not in its reach into editors [ASSUMED].

---

## (h) Strengths that would be hard to beat

| # | Strength | Evidence |
|---|---|---|
| 1 | Model breadth and speed of onboarding: new third-party image, video, audio and language models added most weeks | [DOC] S14 |
| 2 | Capital: $400M Series B at a $5.4B valuation in August 2026, after a January 2026 Series A extension at $1.3B | [IND] S40 |
| 3 | Scale of audience: 30M+ users reported in August and 40M+ in October 2026 | [CLAIM] S39, S40 |
| 4 | Distribution into host applications: Resolve, Premiere Pro, After Effects, Photoshop, Figma, Blender, plus ChatGPT, Claude and Cursor | [DOC] S9, S14, S22 |
| 5 | Developer surface: API, two SDKs, hosted MCP, CLI and skills, with aggressive cashback to seed adoption | [DOC] S14, S22, S23, S25 |
| 6 | Direction vocabulary in Cinema Studio: camera, lens, genre, tempo, palette and lighting presets with up to 50 references | [DOC] S4; [CLAIM] S3 |
| 7 | Character tooling: Soul ID, Soul Cast and Elements, which independent users credit for cross-shot consistency | [DOC] S11; [IND] S35c |
| 8 | Vertical marketing products: Marketing Studio, Ads Studio, Ad Multiplier, Shorts Studio, Content Factory | [DOC] S14 |
| 9 | Marketing Studio adoption: 68,000 marketers in its first 30 days | [CLAIM] S41 |
| 10 | Enterprise package: SOC 2 and GDPR statements, SSO/SAML, role-based access, contractual no-training, IP indemnification, dedicated GPU capacity | [DOC] S16 |
| 11 | Enterprise reach: 430 of the Fortune 500 per the Enterprise page (390 and 360 in earlier reports) | [CLAIM] S16, S40, S41 |
| 12 | Aggregated per-second API pricing across many vendors under one key | [CLAIM] S21 |
| 13 | Community flywheel: contests, a $1,000,000 film festival, grants, an academy and an affiliate programme paying up to 25% | [DOC] S14 |
| 14 | Low entry friction for non-editors: one prompt to an assembled multi-shot clip with audio | [DOC] S4, S7 |
| 15 | Positive aggregate sentiment despite the negative tail: 74% of Trustpilot reviews at four or five stars; G2 at 4.5 from 78 reviews (snippet only) | [IND] S30, S26 |

---

## (i) Open questions not resolved

1. Current plan prices and credit allowances. The live pricing page could not be read, and secondary sources disagree [UNKNOWN].
2. Whether an Ultra plan card is still offered, and what Ultra 3K and Ultra 9K cost [UNKNOWN].
3. Whether Cinema Studio 4.0 tops out at 30 seconds and 1080p or at one minute and 4K. Official pages conflict [UNKNOWN].
4. Whether Unlimited ever covers Cinema Studio generations. The help center and the press release conflict [UNKNOWN].
5. Official download container, codec, bitrate and frame rate, and whether any professional intermediate format is offered [UNKNOWN].
6. Whether audio can be exported as separate stems [UNKNOWN].
7. Whether Cinema Studio colour grading is non-destructive and free to re-adjust [UNKNOWN].
8. How Supercomputer physically assembles multi-clip videos and whether the result is re-editable [UNKNOWN].
9. Whether a native Higgsfield-branded mobile app exists, its store ratings, and the status of the Diffuse app [UNKNOWN].
10. Team and Scale seat ranges, per-seat prices and concurrency. Third-party sources conflict and the Team page returned 404 [UNKNOWN].
11. Plan-level concurrency under Unlimited. Vendor pages give different figures [UNKNOWN].
12. Whether API inputs and outputs are used for training, and the API's terms on building products for third parties [UNKNOWN].
13. The correct API host (api.higgsfield.ai versus platform.higgsfield.ai) [UNKNOWN].
14. What the native Cinema Studio models are and how Soul models were trained [UNKNOWN].
15. Scope and auditor of the SOC 2 statement, and whether EU data residency and no-retention mode are generally available [UNKNOWN].
16. Current revenue. Reported run-rate figures range from $300M to $700M across sources [UNKNOWN].
17. The year of the terms backlash in one MindStudio article (2025 in one fetch summary, 2026 in the other and in the contemporaneous newsletter). July 2026 is better supported [ASSUMED].
18. Which non-Enterprise tiers, if any, are excluded from training. The Terms say Enterprise Agreement only; one review says Team is excluded [UNKNOWN].
19. Whether Soul ID characters are model-specific. The help article says no; earlier search snippets said separate training per model [UNKNOWN].
20. Real queue times by plan. Only anecdotal reports were found [UNKNOWN].

Pages that could not be fetched: the live pricing page (script shell only); https://higgsfield.ai/team (404); https://higgsfield.ai/terms-of-use (404, replaced by /terms); a Canvas blog post (404); https://higgsfield.ai/creator-hub/help-center/mcp-cli (404); the US App Store listing for Diffuse (404); the original Forbes investigation (not retrieved); https://aireiter.com/blog/higgsfield-free-unlimited-explained (404). The changelog and its RSS feed were read only for their first 100,000 characters, which covered January to November 2026.

---

## (j) Source list

All sources accessed 2026-11-11.

### Official Higgsfield pages

| ID | Source | URL |
|---|---|---|
| S1 | Terms of Use (last updated 23 Oct 2026) | https://higgsfield.ai/terms |
| S2 | Privacy Policy (last updated 31 Oct 2026) | https://higgsfield.ai/privacy-policy |
| S3 | Blog: Cinema Studio 4.0 (12 Aug 2026) | https://higgsfield.ai/blog/cinema-studio-4-0 |
| S4 | Help: How do I use Cinema Studio | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-cinema-studio |
| S5 | Help: How do I use Canvas | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-canvas |
| S6 | Official site index | https://higgsfield.ai/llms.txt |
| S7 | Cinema Studio 4.0 landing page | https://higgsfield.ai/cinematic-video-generator |
| S8 | AI Video Editor page | https://higgsfield.ai/ai-video-editor |
| S9 | Help: External integrations | https://higgsfield.ai/creator-hub/help-center/integrations/external-integrations-higgsfield |
| S10 | Help: How do I use Supercomputer (modified 26 Oct 2026) | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-supercomputer |
| S11 | Help: Create and use a Soul ID character | https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character |
| S12 | Popcorn storyboard page | https://higgsfield.ai/storyboard-generator |
| S13 | Help: Which Higgsfield tool should I use | https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/which-higgsfield-tool-should-i-use |
| S14 | Changelog and RSS feed | https://higgsfield.ai/creator-hub/changelog and https://higgsfield.ai/creator-hub/changelog/rss.xml |
| S15 | Canvas intro page | https://higgsfield.ai/canvas-intro |
| S16 | Enterprise page | https://higgsfield.ai/enterprise |
| S17 | Help: How credits work | https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work.md |
| S18 | Pricing page (script shell only) and Team page (404) | https://higgsfield.ai/pricing and https://higgsfield.ai/team |
| S19 | Blog: Credits vs Unlimited (15 Sep 2026) | https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation |
| S20 | Blog: AI short film pipeline (29 Jul 2026) | https://higgsfield.ai/blog/ai-short-film-pipeline |
| S21 | Blog: Higgsfield API (16 Sep 2026) | https://higgsfield.ai/blog/higgsfield-api |
| S21a | Help: What are Unlimited models | https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them |
| S22 | Help: Connect Higgsfield to an AI agent (MCP) | https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent ; also https://higgsfield.ai/mcp and https://higgsfield.ai/enterprise-help-center/platform/integrations |
| S23 | Help: Access Higgsfield via CLI | https://higgsfield.ai/creator-hub/help-center/mcp-cli/how-do-i-access-higgsfield-via-cli |
| S24 | API docs FAQ | https://docs.higgsfield.ai/docs/help/faq.md |
| S24a | API docs: rate limits | https://docs.higgsfield.ai/docs/concepts/rate-limits.md |
| S25 | Help: What is the Higgsfield API | https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api |
| S26 | Search-result snippets only, pages not fetched (Soul ID blog, Ads 2.0 blog, upscale troubleshooting, enterprise projects help, All Unlimited blog, Kapwing, Flowith, G2, review round-ups, docs index) | Representative: https://higgsfield.ai/blog/keep-ai-character-consistent ; https://higgsfield.ai/blog/higgsfield-all-unlimited-explained ; https://higgsfield.ai/creator-hub/help-center/troubleshooting/my-video-upscale-is-stuck-or-failed-what-should-i-do ; https://higgsfield.ai/enterprise-help-center/manage-account/projects ; https://www.g2.com/sellers/higgsfield ; https://docs.higgsfield.ai/llms.txt |
| S27 | Blog: 11.11 deals (11 Nov 2026) | https://higgsfield.ai/blog/higgsfield-11-11-deals |
| S28 | Help: How do Higgsfield plans work | https://higgsfield.ai/creator-hub/help-center/plans/how-do-higgsfield-plans-work.md |
| S29 | Help: Content flagged as NSFW; Trust page | https://higgsfield.ai/creator-hub/help-center/troubleshooting/content-flagged-as-nsfw and https://higgsfield.ai/trust |
| S30a | Help: Who owns my generations | https://higgsfield.ai/creator-hub/help-center/account-and-privacy/who-owns-my-generations-and-can-i-use-them-commercially |
| S39 | Press release, Cinema Studio 4.0 (PR Newswire copy, 28 Oct 2026) | https://www.webull.com/news/15825991486301184 |

### Independent and third-party sources

| ID | Source | Nature | URL |
|---|---|---|---|
| S30 | Trustpilot, Higgsfield AI | Review site, read 11 Nov 2026 | https://uk.trustpilot.com/review/higgsfield.ai |
| S31 | Taylor Lorenz, User Mag (30 Jul 2026) | Journalist hands-on | https://www.usermag.co/p/my-journey-into-the-slop-factory |
| S32 | PiunikaWeb (11 Feb 2026) | Press | https://piunikaweb.com/2026/02/11/higgsfield-ai-ceo-speaks-up-after-x-account-suspension-negative-pr/ |
| S33 | The Register (6 Feb 2026) | Press | https://www.theregister.com/2026/02/06/higgsfield_ai_job_loss/ |
| S34a | MindStudio: terms of service backlash (28 Jul 2026) | Competitor blog | https://mindstudio.ai/blog/higgsfield-terms-of-service-backlash |
| S34b | MindStudio: subscription cancellation complaints | Competitor blog | https://www.mindstudio.ai/blog/higgsfield-subscription-cancellation-complaints |
| S34c | X DOT AI newsletter (24 Jul 2026) | Newsletter | https://xdotai.beehiiv.com/p/higgsfield-has-updated-its-terms-creators-should-read-them-before-clicking-accept |
| S34d | AI Tool Curator: terms and privacy update | Guide site | https://www.aitoolcurator.com/learn/higgsfield-guide/terms-privacy-policy-update/ |
| S35a | r/HiggsfieldAI subreddit snapshot (archive, 25 Apr 2026) | Forum archive | https://reddit.sentinel-team.org/subreddits/HiggsfieldAI/snapshots/2026-04-25T00%3A11%3A40.375255Z |
| S35b | r/generativeAI post on a bad experience (archive snapshot 20 May 2026) | Forum archive | https://reddit.sentinel-team.org/posts/1ti8536/snapshots/2026-05-20T18%3A21%3A40.772808Z |
| S35c | r/HiggsfieldAI user review post (archive snapshot 3 Jun 2026) | Forum archive | https://reddit.sentinel-team.org/posts/1tu8a80/snapshots/2026-06-03T21%3A12%3A01.444315Z |
| S36 | The Post Flow review (updated 7 Nov 2026) | Review, not hands-on | https://thepostflow.com/ai/higgsfield-ai-review/ |
| S37 | Krea: Higgsfield pricing explained (data captured 31 Aug 2026) | Competitor blog | https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs |
| S38 | AI Funnel Insider review (updated 31 Oct 2026) | Affiliate site, not hands-on | https://aifunnelinsider.com/higgsfield-ai-review-2026/ |
| S40 | SiliconANGLE: $400M raise (17 Aug 2026) | Press | https://siliconangle.com/2026/08/17/higgsfield-raises-400m-at-5-4-billion-valuation-to-scale-video-and-image-generation-platform/ |
| S41 | TNW: Supercomputer enterprise marketing (19 Jun 2026) | Press | https://thenextweb.com/news/higgsfield-supercomputer-enterprise-marketing-nvidia |
| S42 | Secondary coverage of the Forbes investigation (Feb 2026); original not fetched | Press, secondary | Forbes regional editions and digests found via search; original article URL not confirmed |
| S43 | Sacra analysis note on moderation and enterprise sales | Analyst note | https://sacra.com/chat/h/78077664-0525-4adb-8d9a-234f6f551e38/ |
| S44 | Supercomputer launch coverage (snippets only) | Press and blogs | https://runtimewire.com/article/higgsfield-schedules-no-code-ai-video-production ; https://neuronfeed.com/news/higgsfield-supercomputer-launch |
| S45 | ChatCut vs Higgsfield (checked 7 Nov 2026) | Competitor comparison | https://chatcut.io/compare/chatcut-vs-higgsfield |
| S46 | App Store search results for Higgsfield and Diffuse (snippets only; US listing returned 404) | Store listing | https://apps.apple.com/il/app/diffuse-ai-video-generator/id6474068152 |

### Strategy and funding notes not placed in the tables above

- Supercomputer launched in May 2026 [DOC] (S14).
- The Series B was led by DST Global, with Tribe Capital, Goldman Sachs Alternatives, Smash Capital, Fifth Wall, Valor Capital and Intel Capital [IND] (S40).
- Agentic usage was reported up 42 times in three months, with more than 20M generations a month [CLAIM] (S40).
- Supercomputer 2.0 was reported as built on NVIDIA's agent toolkit, with a WPP relationship described as exploratory only [IND] (S41).
- A Sacra note reports annual recurring revenue of $11M in May 2025, $100M in November 2025 and $230M in January 2026, and argues that moderation failures are a sales risk with brand buyers [IND] (S43).
- The Trust page metadata still describes a valuation of over $1.3B, which predates the reported Series B [DOC] (S29).
- No published forward roadmap was found; direction is inferred from the changelog as agents, ads and marketing automation, host-application plugins, the API and enterprise controls [ASSUMED].
