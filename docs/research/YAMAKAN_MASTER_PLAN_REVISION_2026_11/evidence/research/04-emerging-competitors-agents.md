# 04 — Emerging competitors and agentic creation tools

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Research date: 2026-11-11. Scope: AI-native video and creative-production platforms and agentic creation tools **beyond** Higgsfield, Runway, Kling, Luma, Pika, Adobe Firefly/Premiere, DaVinci Resolve, Blender and CapCut (covered by other reports).

Reference thesis being tested: a local-first, model-independent, editable-timeline AI production platform with CLI/SDK/MCP agent surfaces and an AI creative director.

---

## 0. How to read this report

### Evidence labels

Every factual claim carries exactly one label.

| Label | Meaning |
|---|---|
| [DOC] | Official documentation, pricing page, changelog, terms, licence file or the project's own repository page. URL given. |
| [CLAIM] | Vendor marketing, launch blog, press release or founder statement. |
| [IND] | Independent third-party observation (press, reviewer, forum, directory). URL given. |
| [ASSUMED] | My inference or background knowledge, not sourced in this research pass. |
| [UNKNOWN] | Could not be determined. |

Labels were never upgraded. A vendor's launch blog is [CLAIM] even when it is the only authoritative source for a feature. Where an official page was seen only as a search-result excerpt and not fetched in full, the label is followed by "(snippet)".

### Method and limitations

- Web search plus direct page fetches. No accounts were created, nothing was signed in to, downloaded or submitted. No product was tested hands-on, so nothing here is a first-hand usability finding.
- Page fetches are summarised by an automated reader. Numbers taken from them (stars, prices, limits) are as displayed on the access date and may contain transcription errors.
- The shared web-search budget for this session ran out before the last verification batch. Items that were queued but not searched are marked [UNKNOWN]: Videotok, the Gemini app's video features, Kapwing MCP details, a Hailuo agent app, Tencent Yuanbao video, a dedicated Alibaba Wan consumer app, and Invideo's official price page.
- Direct Reddit content was thin in search results. Complaint evidence leans on Trustpilot, G2, vendor community forums, Hacker News, Product Hunt and review blogs. Treat the complaint section as directional.
- Third-party aggregators disagree on prices and GitHub star counts. Where a primary page was fetched, that figure is used; otherwise the conflict is stated.
- GitHub pages did not expose last-commit or release dates in the fetched view. Activity is reported as commit counts and open issues only; recency is [UNKNOWN] unless stated.
- GitHub star counts for several 2026 projects are very high for their age (see section 5). Whether they are organic is [UNKNOWN].

---

## 1. Headline findings

1. **The agent surface is no longer a differentiator on its own.** Hosted MCP servers, CLIs or agent skills now exist at fal, ElevenLabs, HeyGen, Flora, Krea, Descript, Magnific, ComfyUI, ChatCut, Opus Clip, Veed, Arcads, PixVerse and WaveSpeed, plus community MCP servers for Premiere and Resolve (sources in sections 3–5).
2. **Nobody found combines all four thesis pillars.** The closest are LTX Desktop (local, open source, partial regeneration, own keys, but no agent control of the timeline and no MCP), OpenChatCut (local-first timeline with a shared agent/MCP tool surface, but generation is bolted on), and ComfyUI (local, model-independent, official MCP and CLI, but no timeline or story structure).
3. **Flora has the most complete commercial agent surface on paper**: API, CLI and MCP with cost quotes before a run, dollar-denominated budgets, admin spend caps, and documented no-charge on failed runs [DOC] (https://docs.flora.ai/mcp/cost-and-limits.md). It is cloud-only and canvas-based, not a timeline.
4. **Google Flow is the largest distribution threat.** In May 2026 it added an any-input model (Gemini Omni Flash), an in-product agent and user-built tools [CLAIM] (https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates).
5. **Provider withdrawal is now a demonstrated risk.** OpenAI deprecated the Sora 2 models and Videos API on 2026-03-24 with removal on 2026-09-24 and no replacement listed [DOC] (https://developers.openai.com/api/docs/deprecations).
6. **Open-source "coding assistant as film crew" projects have large reach.** OpenMontage shows 79.6k stars [DOC] (https://github.com/calesthio/OpenMontage) and HeyGen's HyperFrames 82.7k [DOC] (https://github.com/heygen-com/hyperframes). They ship budget caps, approval gates and project-as-files, without an interactive timeline.
7. **The white space is revision control and provenance.** No tool was found that offers versioned, diffable shot and take history for agent actions together with generation lineage exported to an interchange format such as OTIO [UNKNOWN].
8. **The dominant user complaint is paying for things that did not work**: failed generations, re-rolls, moderation blocks after completion, and agent reasoning overhead (section 6b).

---

## 2. Status changes that affect the candidate list

| Candidate | Status on 2026-11-11 | Evidence |
|---|---|---|
| OpenAI Sora app / Sora 2 API | Shut down. API deprecation entry dated 2026-03-24, removal 2026-09-24, affecting sora-2 and sora-2-pro, no replacement listed. | [DOC] https://developers.openai.com/api/docs/deprecations |
| Sora consumer app and sora.com | Reported closed on 2026-04-26 after a 2026-03-24 announcement; a roughly $1B Disney arrangement reportedly fell through. | [IND] https://venturebeat.com/technology/openai-is-shutting-down-sora-its-powerful-ai-video-app ; https://decrypt.co/362243/openai-shut-down-sora-derailing-1-billion-deal-disney |
| Freepik | Rebranded to Magnific on 2026-04-28. | [IND] https://thenextweb.com/news/freepik-rebrands-as-magnific |
| Weavy | Acquired by Figma (late October 2025), now Figma Weave. | [IND] https://www.fastcompany.com/91431691/figma-weave-weavy-acquisition |
| Moonvalley (Marey) | Research team reportedly moved to Reka in June 2026; ComfyUI service deprecated. Single-source. | [IND] https://tooldirectory.ai/tools/moonvalley |
| Captions | Rebranded to Mirage (September 2025). | [IND] https://techcrunch.com/2025/09/04/captions-rebrands-as-mirage-expands-beyond-creator-tools-to-ai-video-research |
| Replicate | Acquisition by Cloudflare announced 2025-11-17. | [IND] https://www.helpnetsecurity.com/2025/11/17/cloudflare-to-acquire-replicate/ |
| Wonder Dynamics | Operating as Autodesk Flow Studio. | [DOC] https://help.wonderdynamics.com/export-scene |
| Leonardo | Part of Canva; bundled into Canva ProSuite (September 2026). | [CLAIM] https://www.canva.com/newsroom/news/canva-prosuite-launch/ |
| Palmier Pro | Open source through v0.7.6 only; later binaries proprietary. | [DOC] https://github.com/palmier-io/palmier-pro |
| Videotok | Nothing found. | [UNKNOWN] |

Name collisions to avoid in the strategy document: Luma "Weave" versus Figma Weave; Captions' "Mirage" versus Decart's "Mirage"; ChatCut (commercial) versus OpenChatCut (independent AGPL project); Comfy Org's "Comfy Agent" versus an unrelated npm package of a similar name; Google Flow versus Autodesk Flow Studio versus Flova.

---

## 3. Deep profiles

Each profile uses the same fields. "Learn / defend" is my assessment and is [ASSUMED] unless a label says otherwise.

### 3.1 Google Flow (with Gemini Omni, Flow Agent, Flow Tools; Google Vids)

- **What it is.** Google Labs' AI filmmaking workspace. [ASSUMED]
- **Models.** Google's own only. Veo 3.1 added audio across Flow features in October 2025 [IND] (https://venturebeat.com/ai/google-releases-new-ai-video-model-veo-3-1-in-flow-and-api-what-it-means-for). Gemini Omni Flash, an any-input model starting with video output, arrived in May 2026 [CLAIM] (https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates). Omni 1.1 Flash later added 1080p/4K and video references [IND] (https://androidauthority.com/google-flow-gemini-omni-1-1-flash-video-update-3704288). No third-party models [ASSUMED].
- **Editable surface.** Scenebuilder sequencing and extension, Insert and Remove object, Frames to Video, Ingredients to Video [IND] (https://yourstory.com/ai-story/google-veo-31-flow-ai-editing-tool). Omni is described as enabling precise edits to existing video by instruction [CLAIM] (Flow blog above). Whether Flow has a multitrack timeline with separate audio lanes, version history, or any structured project export (XML, EDL, OTIO) is [UNKNOWN].
- **Storyboard / script.** No dedicated script or shot-list feature confirmed [UNKNOWN].
- **Consistency.** Ingredients (reference-driven generation) [IND] (venturebeat link above); Omni claims character and voice consistency across scenes [CLAIM] (Flow blog).
- **Agent.** Flow Agent, Gemini-based, brainstorms, creates and edits, produces multiple variations, batch-edits assets, organises and renames collections; announced for all Flow users [CLAIM] (Flow blog). Agent queries reportedly do not consume credits and are limited by a daily quota [IND, single source] (https://rar.design/posts/google-flow-omni-agent-tools-complete-guide). A fuller "Agent Mode" was reported in preparation [IND] (https://www.testingcatalog.com/google-prepares-agent-mode-for-flow-to-automate-video-production/).
- **Flow Tools.** Users describe a custom tool or workflow in natural language; tools are shareable and remixable; subscribers can create them [CLAIM] (Flow blog).
- **API / MCP / SDK.** Veo is available through Google's developer APIs at roughly $0.40/s Standard and $0.15/s Fast [IND] (venturebeat link above). No API or MCP for Flow projects themselves was found [UNKNOWN].
- **Local vs cloud.** Cloud only [ASSUMED]. A Flow mobile app entered beta on Android [CLAIM] (Flow blog).
- **Pricing.** Bundled in Google AI plans. Reported figures: free starter and daily credits, AI Pro about $19.99/month with 1,000 credits, AI Ultra about $249.99/month [IND, aggregator, unverified] (https://aitoolsatlas.ai/tools/flow). Veo 3.1 Lite became unlimited for AI Ultra in April 2026 [IND] (https://design-offset.com/202604-google-flow-updates/).
- **Complaints.** A Google developer-forum thread reports lost credits, excessive failed generations and consistency problems [IND] (https://discuss.ai.google.dev/t/veo-flow-generation-issues-lost-credits-consistency-problems-and-excessive-failed-generations/147374).
- **Google Vids (adjacent).** Positioned as document-style video creation that avoids complex timelines, with AI avatars, voiceovers in 24 languages, Slides-to-video and clip generation via Gemini Omni; included in Workspace business and Google AI consumer plans; creation is desktop-only [CLAIM] (https://workspace.google.com/products/vids/). Gemini app video features were not researched [UNKNOWN].
- **Learn / defend.** Defend against bundled pricing, free agent turns and "unlimited" tiers. Learn from Flow Tools: letting users mint small reusable tools is a cheaper path to workflow depth than a node graph. Google's weak points for the thesis are single-vendor models, cloud-only operation and no evidence of structured project export.

### 3.2 LTX Studio (Lightricks, hosted)

- **What it is.** A hosted script-to-storyboard-to-timeline studio. [IND] (https://stacksheriff.com/ai-tools/ltx-studio-review/)
- **Models.** Lightricks' own LTX family plus third-party models in the hosted product [ASSUMED]; the exact current model list was not verified [UNKNOWN].
- **Editable surface.** A January 2026 update added a timeline: reorder, split, trim, duplicate and insert clips; two video channels and up to five audio channels [IND] (https://www.cined.com/ltx-studio-takes-its-next-big-step-editing/). A clip can be sent back to generation, re-prompted, and the approved result replaces the clip without rebuilding the surrounding edit [IND] (same). Projects export as XML for Premiere Pro and compatible editors, keeping track structure and linked footage [IND] (same). At that date the editor could not import camera-originated footage and was not positioned as an NLE replacement [IND] (same).
- **Storyboard / script.** Script to scenes to storyboard to timeline, with voiceover, music, sound effects and captions [IND] (https://dupple.com/reviews/ltx-studio).
- **Consistency.** Persistent characters across scenes are a core pitch [ASSUMED]; mechanism not verified in this pass [UNKNOWN].
- **Agent.** No hosted agent confirmed [UNKNOWN]. (The desktop app has one; see 3.3.)
- **API.** LTX API exists and is one of the key types accepted by LTX Desktop [DOC] (https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/README.md).
- **Local vs cloud.** Hosted.
- **Pricing.** Credit-based subscription [IND] (https://www.g2.com/products/ltx-studio/reviews); current tiers not verified [UNKNOWN].
- **Complaints.** Reviewers say cost is not shown before generation and credits drain quickly [IND] (https://stacksheriff.com/ai-tools/ltx-studio-review/).
- **Learn / defend.** This is the clearest commercial example of "regenerate one shot from the timeline and keep the edit" plus NLE hand-off. It lacks documented take history, provenance and agent control.

### 3.3 LTX Desktop and LTX-2 open weights (Lightricks, local)

- **What it is.** An open-source desktop app, in beta, that runs LTX models locally [DOC] (https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/README.md).
- **Repository.** 2.2k stars, 452 forks, 62 open issues, 82 commits on main, Apache-2.0 [DOC] (https://github.com/Lightricks/LTX-Desktop). Model weights are under separate terms [DOC] (README). LTX-2 weights were opened in January 2026 under a community licence [IND] (https://the-decoder.com/lightricks-open-sources-ai-video-model-ltx-2-challenges-sora-and-veo/). A revenue threshold of $10M for free use is reported by third parties and was not confirmed against the licence text [IND] (https://help.ltx.io — snippet; treat as unverified).
- **Models.** LTX family locally; LTX 2.5 Pro and 2.3 Pro are API-only [DOC] (README).
- **Generation features.** Text-to-video, image-to-video with optional end frame, audio-to-video, Retake (regenerate a selected part of a clip), Extend, IC-LoRA video-to-video, LoRA recipes, a persistent generation queue and an asset library [DOC] (README).
- **Editable surface.** The built-in Video Editor is now described as a legacy timeline editor kept for existing projects, with new work directed to Home-screen tools and a project gallery called Gen Space [DOC] (https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/gen-space-and-video-editor.md). Track model, project file format, take history, and XML/EDL/OTIO export are not documented there [UNKNOWN].
- **Agent.** An Assistant chat runs on Gemini with the user's key, or on a local Qwen model through an app-managed llama.cpp runtime, with no cloud fallback [DOC] (https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/desktop-assistant.md). It can queue generations, retakes, extensions and recipes, inspect and search assets, and wait on jobs [DOC] (same). It cannot edit the timeline, import files, change settings, download models or generate images, and there is no MCP layer or external agent service [DOC] (same). It cannot judge visual quality and has per-request job and tool-call limits; there is no spending cap for the Gemini path [DOC] (same). With Gemini, conversation text, asset metadata and small thumbnails are sent, not local paths [DOC] (same).
- **API / MCP / SDK.** No MCP [DOC] (assistant doc). Deep links and LAN browser access exist [DOC] (README).
- **Local vs cloud.** Local first, with optional LTX, fal and Gemini keys; an LTX key is not needed to start [DOC] (README).
- **Hardware.** Windows needs an NVIDIA GPU with 24 GB or more VRAM and 64 GB RAM; macOS needs Apple Silicon with 48 GB or more; 100 GB or more of disk [DOC] (README).
- **Pricing.** App is free; cloud paths are pay-per-use through the user's own keys [DOC] (README).
- **Complaints.** Hardware floor is the obvious barrier [ASSUMED]. Community forks exist to add other local model back ends (for example a WanGP fork) [IND] (https://github.com/Lightricks/ltx-desktop/releases — forks seen in search results), which suggests demand for model independence the official app does not serve [ASSUMED].
- **Learn / defend.** This is the nearest product to "local-first with partial regeneration and bring-your-own keys". Its gaps are exactly the thesis: single model family locally, an assistant that cannot touch the edit, no external agent surface, and a timeline the vendor is de-emphasising.

### 3.4 ComfyUI (local, Comfy Cloud, Partner Nodes, App Mode, MCP, CLI)

- **What it is.** The open-source node-graph runtime for diffusion pipelines, plus a hosted cloud. [ASSUMED]
- **Models.** Any local open-weight model; closed models through paid Partner Nodes [DOC] (https://docs.comfy.org/tutorials/partner-nodes/overview).
- **Editable surface.** A node graph. Everything stays editable as workflow JSON [ASSUMED]. No shot, scene or timeline abstraction in core [ASSUMED]. Subgraph parameter panels were mentioned in thin coverage [IND].
- **App Mode.** App Mode, App Builder, shareable app URLs and ComfyHub were announced on 2026-03-10 for Cloud and Local [CLAIM] (https://blog.comfy.org/p/from-workflow-to-app-introducing).
- **Agent.** Comfy Agent, an in-app workflow-building assistant, was in private alpha in Cloud [IND] (https://digitalproduction.com/2026/10/09/comfy-agent-ai-comfyui-workflows/).
- **API / MCP / SDK.** Official Comfy MCP: a hosted server at cloud.comfy.org/mcp using OAuth or an API key, and an open-source local `comfy-mcp` that drives a local ComfyUI [DOC] (https://docs.comfy.org/development/cloud/mcp-server). Discovery is free, cloud runs need a subscription, local runs are free except partner models [DOC] (same). Tools include template search and run, workflow submit and validate, job status and wait, app creation and billing status [DOC] (same). The page is inconsistent on whether the server is early release or generally available [DOC] (same). `comfy-cli` supports JSON output and skill installation for agents [DOC] (https://docs.comfy.org/agent-tools/comfy-cli) (snippet).
- **Bring your own keys.** Not supported for Partner Nodes; the docs say it is under consideration. Partner Nodes work in local ComfyUI only with a Comfy login and prepaid credits [DOC] (partner-nodes overview).
- **Local vs cloud.** Both. Offline and partner-node-disable flags exist [DOC] (same).
- **Pricing.** Cloud tiers reported at free, $20, $35 and $100 with credit allotments; sources conflict [IND] (https://comfy.org/cloud/pricing — snippet). Monthly credits expire and there are no refunds [DOC] (partner-nodes overview).
- **Complaints.** Complexity and fragile custom-node dependencies [ASSUMED]. Promotional partner rates ended in November 2026 [IND].
- **Learn / defend.** ComfyUI is the default substrate for local, model-independent generation, and now has first-party MCP and CLI. A thesis product should integrate with it, not compete on graph execution. Its routing of closed models through its own credit wallet, with no user keys, is a lock-in pattern to position against.

### 3.5 Flora (FLORA)

- **What it is.** A node-based infinite canvas for creative teams. [IND] (https://techcrunch.com/2026/01/27/node-based-design-tool-flora-raises-42m-from-redpoint-ventures/)
- **Funding and customers.** $42M Series A led by Redpoint, $52M total; named customers include Alibaba, Brex, Pentagram and Lionsgate [IND] (same).
- **Models.** Aggregated, 50+ third-party models [IND] (https://www.testingcatalog.com/flora-launches-fauna-ai-design-agent-for-teams). LoRA style training is offered [DOC] (https://docs.flora.ai/llms.txt).
- **Editable surface.** Canvas nodes that can be read, edited, wired, arranged and run [DOC] (https://docs.flora.ai/llms.txt). No timeline was found in the docs index [DOC] (same). Export is via an Export node to local download, Google Drive or Dropbox [DOC] (same). No general version-history page appears in the docs index [DOC] (same).
- **Storyboard / script.** Reusable "Techniques" (packaged workflows with declared inputs and a per-run price) [DOC] (same). No dedicated shot-list feature found [UNKNOWN].
- **Agent.** FAUNA is the in-canvas agent, launched 2026-03-31 [IND] (testingcatalog link above). FAUNA messages do not count against the usage budget [DOC] (https://docs.flora.ai/plans-and-billing/pricing).
- **API / MCP / SDK.** REST API with TypeScript quickstart and a `flora` command-line tool; idempotency keys, documented error codes and signed webhooks [DOC] (https://docs.flora.ai/llms.txt). Remote MCP server with OAuth or API key; agents can generate media, run Techniques, create and open projects, and edit canvas nodes; 57 loadable skills [DOC] (same; https://docs.flora.ai/mcp/security.md).
- **Cost controls.** A request can be sent as a quote first; quotes expire after five minutes and do not reserve funds [DOC] (https://docs.flora.ai/mcp/cost-and-limits.md). Admins can cap spend per member or workspace [DOC] (same). Failed runs are not charged; a retry is billed as a new run; cancelling does not reliably stop a charge once a provider has accepted the job [DOC] (same). Canvas node runs start immediately with no confirmation step [DOC] (same).
- **Data.** Outputs belong to the user; inputs and prompts are stated as not used for training by Flora or its partners [DOC] (https://docs.flora.ai/legal/data-security-and-ip.md). Retention periods and storage location are not stated there [DOC] (same).
- **Local vs cloud.** Cloud only; bring-your-own provider keys and local execution are not mentioned [DOC] (https://docs.flora.ai/mcp/security.md).
- **Pricing.** Free; Starter $18 per seat with $18 of usage; Pro $50 with $50; Max $200 with $200; usage is dollar-denominated; API and MCP from Starter [DOC] (https://docs.flora.ai/plans-and-billing/pricing).
- **Complaints.** Not researched in depth [UNKNOWN].
- **Learn / defend.** The quote-then-run pattern, dollar budgets, admin caps and no-charge-on-failure directly answer the category's biggest complaint. A thesis product needs at least parity here. Flora's gaps are no timeline, no local path, no user keys.

### 3.6 Figma Weave (formerly Weavy)

- **What it is.** A node-based generative workflow canvas owned by Figma [IND] (https://www.fastcompany.com/91431691/figma-weave-weavy-acquisition).
- **Models.** Aggregated third-party image and video models [ASSUMED]; video models are limited to paid plans [DOC] (https://help.figma.com/hc/en-us/articles/35965787376919) (snippet).
- **Editable surface.** Node graph plus layer-style editing tools [ASSUMED]. No timeline confirmed [UNKNOWN].
- **Agent / API / MCP.** Not confirmed for Weave specifically [UNKNOWN].
- **Local vs cloud.** Cloud [ASSUMED].
- **Pricing.** Billed separately from Figma. Free 150 credits and five workflows; Starter 1,500 credits; Professional 4,000 with rollover; Team 4,500 per user [DOC] (same Figma help article, snippet).
- **Learn / defend.** The threat is distribution into design teams, not capability.

### 3.7 Magnific (formerly Freepik) — Spaces

- **What it is.** A creative suite with a node canvas called Spaces [IND] (https://thenextweb.com/news/freepik-rebrands-as-magnific). About $230M ARR was reported at the rebrand [IND] (same).
- **Models.** Aggregated third-party models plus its own upscaler [ASSUMED].
- **Editable surface.** Node canvas [DOC] (https://www.freepik.com/ai/faq/spaces) (snippet). Timeline not confirmed [UNKNOWN].
- **Agent / MCP.** Custom agents and an MCP server are reported [IND] (https://www.magnific.com/ai/docs/freepik-is-now-magnific — snippet; vendor page, details not verified).
- **Pricing.** Low-priced credit plans, around €12 and €27 per month [IND] (https://www.aiarty.com/knowledge-base/freepik-reviews.htm).
- **Complaints.** Credit consumption, "unlimited" caveats and cost visibility [IND] (same).
- **Learn / defend.** Price pressure. A stock-asset business can subsidise generation.

### 3.8 Krea

- **What it is.** A generation suite with realtime canvas, node workflows and an agent [DOC] (https://www.krea.ai/docs/llms.txt).
- **Models.** Own models (Krea 2, Krea 3) plus aggregated video models including Seedance, Veo, Kling and Hailuo [DOC] (same). A reviewer counts 64+ models and says Krea 2 weights are open [IND] (https://yespress.io/krea).
- **Editable surface.** Node workflows on an infinite canvas chaining image, video and audio models [DOC] (docs index). No timeline found [UNKNOWN].
- **Agent.** Krea Agent plans multi-step jobs from one brief and selects models per step; it has a context library and skills [DOC] (same). A reviewer says the node agent drafts a plan before spending units [IND] (https://yespress.io/krea).
- **API / MCP / SDK.** REST API, an Agent API for managing sessions over HTTP, webhooks, a Zero Data Retention page, and an MCP server with OAuth or API key for model discovery and generation [DOC] (docs index). A CLI is not listed [DOC] (same).
- **Local vs cloud.** Cloud. The docs list an enterprise licence route for open-source model usage rather than a local app [DOC] (same).
- **Pricing.** Compute units for subscriptions and a prepaid balance for the API [DOC] (same).
- **Complaints.** Unpredictable unit consumption and charges after cancellation are reported, with middling Trustpilot scores [IND] (https://www.costbench.com/software/ai-image-generators/krea/hidden-costs/).
- **Learn / defend.** Realtime generation as an ideation surface, and an agent API as a product in its own right.

### 3.9 Invideo

- **What it is.** A prompt-to-video platform that now pairs an agent with a multitrack timeline [IND] (https://www.fast.io/resources/invideo-ai-review-2026.md).
- **Models.** Aggregated: Veo 3.1, Kling 3.0, Seedance 2.0 and 2.5 are named [IND] (https://tooliverse.ai/tools/invideo).
- **Editable surface.** Multitrack timeline with keyframes and version control is reported [IND] (fast.io link above). What "version control" covers was not verified [UNKNOWN].
- **Agent.** A persistent agent that plans and builds a video [IND] (same). Vendor comparison content positions it against Higgsfield [CLAIM] (https://invideo.io/blog/invideo-agent-vs-higgsfield-supercomputer/).
- **API / MCP.** Not confirmed [UNKNOWN].
- **Local vs cloud.** Cloud [ASSUMED].
- **Pricing.** Tiers reported from free up to about $900 per month [IND] (tooliverse link above); official page not fetched [UNKNOWN].
- **Complaints.** The agent consumes credits for reasoning, reportedly more than 30% of spend in some sessions; re-rolls cost credits; refunds are limited [IND] (https://www.trustpilot.com/review/invideo.io ; https://aireiter.com/blog/invideo-ai-review).
- **Learn / defend.** Evidence that agent overhead billed to the user becomes a complaint category of its own.

### 3.10 ElevenLabs (Studio, Studio Agent, MCP)

- **What it is.** An audio-first platform whose Studio now includes a video timeline [DOC] (https://elevenlabs.io/docs/creative-platform/products/studio).
- **Models.** Own audio models; five image and five video models from third parties inside Studio [DOC] (same).
- **Editable surface.** Timeline with video, voiceover, captions, music and sound-effect tracks [DOC] (same).
- **Agent.** Studio Agent for video projects, web only, with a Create mode and a Plan mode; the user can edit manually and then hand back to the agent [DOC] (same). Agent chat consumes credits and the agent is not available through the API [DOC] (same).
- **API / MCP.** Hosted MCP server covering voice, music, images and video [IND] (https://www.testingcatalog.com/elevenlabs-mcp-can-now-generate-voice-music-images-video/).
- **Local vs cloud.** Cloud.
- **Pricing.** Credit subscription [ASSUMED].
- **Learn / defend.** Audio is the layer most video tools treat as an afterthought. ElevenLabs approaches the timeline from the sound side and already owns voice, music and effects.

### 3.11 HeyGen and HyperFrames

- **What it is.** An avatar-video company that also publishes HyperFrames, an HTML-to-video framework aimed at agents [DOC] (https://github.com/heygen-com/hyperframes).
- **Repository.** 82.7k stars, 7.6k forks, 7,042 commits, Apache-2.0 [DOC] (same).
- **How it works.** A composition is an HTML file with timing and track data attributes; a paused animation timeline is seeked frame by frame in headless Chrome and encoded with FFmpeg; rendering is deterministic and local, with an AWS Lambda package for distributed renders [DOC] (same).
- **Editable surface.** The HTML project itself, plus a Studio app (desktop and browser) [DOC] (same). A Pro plan adds HeyGen's paid models [DOC] (same).
- **Agent.** Nine published skills; supported agents include Claude Code, Codex, Cursor, Gemini CLI and OpenCode [DOC] (same). A hosted MCP endpoint is documented by the vendor [CLAIM] (https://hyperframes.heygen.com/guides/mcp).
- **API.** HeyGen API with per-second avatar pricing and a Video Agent endpoint [IND] (https://www.g2.com/articles/heygen-api-pricing).
- **Learn / defend.** HyperFrames is the "project as plain files that an agent can write" idea executed at scale, under a permissive licence, by a funded vendor. It covers motion graphics and assembly, not shot-level generative revision.

### 3.12 Descript (Underlord)

- **What it is.** A transcript-based editor with an AI co-editor [DOC] (https://help.descript.com/hc/en-us/articles/36803785502221-Underlord-beta-Your-AI-co-editor-in-Descript) (snippet).
- **Models.** Mixed own and third-party [ASSUMED].
- **Editable surface.** Transcript plus timeline; agent edits land in the normal project [CLAIM] (https://www.descript.com/underlord).
- **Agent.** Underlord can watch video content to make decisions [CLAIM] (https://www.descript.com/blog/article/underlord-ai-can-watch-videos).
- **API / MCP.** Hosted MCP and an early-access API are reported [IND] (search results; official page not fetched).
- **Pricing.** Tiers reported between $16 and $65 per month [IND].
- **Learn / defend.** Strong for talking-head and recorded footage, weak for generative film work [ASSUMED].

### 3.13 ChatCut (commercial agentic editor)

- **What it is.** A video editor with an agent built into the editing workspace, available as desktop app, web app and agent plugin [DOC] (https://chatcut.io/docs/what-is-chatcut.md).
- **Editable surface.** The agent reads project context and changes the active timeline; its changes are ordinary timeline edits that can be moved, trimmed or undone; a project version can be saved before another agent pass [DOC] (same).
- **Generation.** A separate single-job video generator whose results land in the asset bin [DOC] (same). The site advertises Seedance 2.5 access with per-second pricing [CLAIM] (https://chatcut.io).
- **Export.** Video, audio, subtitles, graphics or XML [DOC] (docs page above).
- **Agent surfaces.** Plugins for ChatGPT, Claude Code and Codex [CLAIM] (https://chatcut.io/claude-code-plugin). A ChatCut MCP is listed by a third-party directory [IND] (https://aident.ai/integrations/chatcut_mcp).
- **Models, pricing, local-versus-cloud processing.** Not stated on the page fetched [UNKNOWN].
- **Learn / defend.** The key design choice is that agent output is indistinguishable from human edits and stays editable. That is table stakes for the thesis.

### 3.14 OpenChatCut (open source, local-first agentic editor)

- **What it is.** An independent AGPL desktop editor combining a multitrack timeline with conversational agents; not affiliated with ChatCut [DOC] (https://raw.githubusercontent.com/0xsline/OpenChatCut/main/README.md).
- **Repository.** 3.1k stars, 463 forks, 1,132 commits, 15 open issues, 21 open pull requests, AGPL-3.0-or-later [DOC] (https://github.com/0xsline/OpenChatCut). Earlier third-party counts were lower [IND]. It appears to be mostly one developer [IND].
- **Editable surface.** Multiple video and audio tracks, trim, split, ripple, snapping, keyframes, markers, undo and redo, transitions, effects, LUTs, chroma key, transcript editing, captions and motion graphics [DOC] (README).
- **Agent design.** The built-in agent and external clients use the same editing tools through a Streamable HTTP MCP endpoint on localhost [DOC] (README). Edits happen in isolated drafts that are reviewed in a manual mode or applied in an auto mode; an approved draft commits as one undo step; generation, export and deletion are not available inside draft sessions [DOC] (README).
- **Models.** User-supplied keys for Anthropic, OpenAI, Gemini, OpenRouter and compatible APIs; Claude subscriptions through Claude Code over MCP; fal.ai as an optional image and video provider; no local AI models are mentioned [DOC] (README).
- **Project data.** Projects and media stay on the machine by default under a home-directory folder, stored as project JSON, with full project import and export [DOC] (README).
- **Export.** MP4, audio, SRT, FCPXML, project data and a JianYing/CapCut draft format [DOC] (README).
- **Platform.** Electron, with installers for macOS (unsigned), Windows and Linux; rendering uses Remotion [DOC] (README).
- **Complaints.** A Product Hunt commenter asked for versioned, diffable agent edits [IND] (Product Hunt listing, July 2026).
- **Learn / defend.** This is the nearest open implementation of "editable timeline plus MCP plus local-first plus own keys". It does not model shots, takes, scripts or generation lineage, and its use of Remotion and AGPL constrain commercial reuse [ASSUMED].

### 3.15 Palmier Pro

- **What it is.** A Swift-native macOS video editor with built-in generative AI and an MCP server so agents can edit on the timeline [DOC] (https://github.com/palmier-io/palmier-pro).
- **Repository.** 14.7k stars, 1.2k forks, 1,096 commits, 71 open issues [DOC] (same).
- **Licence change.** Source through v0.7.6 is GPL-3.0; later binaries are proprietary, their source is unpublished, and the repository no longer accepts code contributions [DOC] (same).
- **Agent surface.** MCP over HTTP on localhost while the app is open; setup for Claude Code, Codex, Cursor and a one-click bundle for Claude Desktop [DOC] (same).
- **Models.** Seedance, Kling and Nano Banana Pro inside the timeline [DOC] (same). The generative pipeline is closed and needs a paid subscription while the editor is free without login [IND] (https://themenonlab.blog/blog/palmier-pro-ai-video-editor/).
- **Platform.** macOS 26 on Apple Silicon only [DOC] (repo page).
- **Project format and exports.** Not stated [UNKNOWN].
- **Learn / defend.** Shows demand for a native, fast editor with an agent endpoint. The move from open to closed after gaining stars is a trust pattern a local-first product can contrast itself against.

### 3.16 OpenMontage (open source, coding-assistant-driven)

- **What it is.** A repository that turns an AI coding assistant into a video studio; there is no code orchestrator, the assistant reads YAML pipeline manifests and Markdown stage skills [DOC] (https://github.com/calesthio/OpenMontage).
- **Repository.** 79.6k stars, 10.7k forks, 724 commits, AGPL-3.0 [DOC] (same). Earlier third-party reports gave far lower star counts [IND].
- **Pipeline.** Research, proposal, script, scene plan, assets, edit, compose [DOC] (same).
- **Models.** All provider keys are optional; fal, Runway, ElevenLabs, OpenAI and others are supported; free and local routes include local TTS, stock archives and local GPU video models [DOC] (same). A local LLM path is listed as coming [DOC] (same).
- **Project as data.** State is saved as JSON checkpoints validated by JSON Schemas [DOC] (same).
- **Controls.** Human approval gates at proposal, script, scene plan, assets and publish; the checkpoint writer rejects an unapproved gated stage [DOC] (same). Budget modes of observe, warn and cap, with a per-action approval threshold and a total cap [DOC] (same).
- **Editable surface.** A local storyboard board; composition through Remotion or HyperFrames and FFmpeg; output is MP4 [DOC] (same). No interactive timeline [DOC] (same).
- **Learn / defend.** The governance model (schema-validated checkpoints, enforced approval gates, hard budget caps) is what an "AI creative director" needs underneath. It is missing a human editing surface and NLE interchange.

### 3.17 ViMax (HKUDS)

- **What it is.** An open-source multi-agent pipeline for idea-, script- and novel-to-video [DOC] (https://github.com/HKUDS/ViMax).
- **Repository.** 12.9k stars, 2.0k forks, 395 commits, MIT [DOC] (same).
- **Models.** Any OpenAI-compatible LLM; image generation through Google and OpenAI image models; video through Veo, Google Omni and Seedance; keys supplied by the user in config [DOC] (same).
- **Consistency.** Reference images are coordinated across shots; two keyframe candidates are generated and a vision model selects one [DOC] (same).
- **Agent.** Agent loop with terminal and web interfaces and session resume [DOC] (same).
- **Per-shot regeneration.** Not explicitly documented [UNKNOWN].
- **Learn / defend.** Automated candidate selection by a vision model is a cheap quality gate. Permissive licence makes it easy for others to embed.

### 3.18 VibeFrame

- **What it is.** A `vibe` CLI and MCP server that take a brief through storyboard plan and assets to MP4 [DOC] (https://github.com/vericontext/vibeframe).
- **Repository.** 185 stars, 33 forks, 1,209 commits, MIT [DOC] (same).
- **Project as data.** A project is a directory of Markdown, YAML and JSON files: a storyboard file, a design file, per-scene files with front matter, config, pipeline definition, and build and review reports [DOC] (same). There is no single timeline file [DOC] (same).
- **Per-beat rebuild.** A beat selector on plan, build, preview, render and inspect commands redoes one beat [DOC] (same). What is guaranteed to be reused untouched was not established [UNKNOWN].
- **Cost controls.** Every paid step has a dry run and a maximum-cost flag; errors are machine-readable with a suggested retry [DOC] (same).
- **Models.** User keys for OpenAI, fal, Google, Runway and Kling; a zero-key local path using FFmpeg, local TTS and headless Chrome [DOC] (same).
- **Learn / defend.** Small but closest in spirit to "agentic CLI plus project as structured data plus per-shot rebuild plus own keys". Low adoption suggests the idea alone does not win without an editing surface.

### 3.19 ByteDance Seedance, Dreamina and Jimeng

- **What it is.** ByteDance's video model family and its consumer apps. [ASSUMED]
- **Seedance 2.5 (2026-07-31).** Up to 30 seconds per pass with multi-round extension to multi-minute videos; up to 30 images, 10 video clips and 10 audio clips as references in one pass; timestamp-level editing of audio and video, green screen, camera-perspective and reference-based editing; joint audio-video generation [CLAIM] (https://seed.bytedance.com/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5). The post names Jimeng and Doubao as rollout surfaces and says API access through BytePlus ModelArk is coming; it makes no provenance or safety statement [CLAIM] (same). 4K output is reported by press [IND] (https://thenextweb.com/news/bytedance-seedance-2-5-ai-video-4k-30-seconds).
- **Legal exposure.** Seedance 2.0 drew studio cease-and-desist letters and a delayed US relaunch in April 2026 [IND] (https://www.nbcnews.com/tech/tech-news/seedance-2-bytedance-copyright-infringement-concerns-hollywood-rcna259173).
- **Distribution.** Seedance 2.5 is already wired into Invideo, Kapwing, ChatCut, Manus, WaveSpeed and others (see respective profiles).
- **Pricing.** Dreamina plans reported at roughly $18 to $84 per month [IND].
- **Learn / defend.** Model-level editing at timestamp granularity moves "edit one moment without regenerating everything" into the model. A model-independent platform must be able to route to such features rather than re-implement them. Legal and availability volatility is an argument for model independence.

### 3.20 Aggregator APIs: fal, Replicate (Cloudflare), Together, WaveSpeed

- **fal.** Hosted MCP server exposing 1,000+ models [CLAIM] (https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server). Valued at about $4.5B in December 2025 [IND] (https://sacra.com/c/fal-ai/). fal is the default generation back end for many small tools in this report (OpenChatCut, OpenMontage, VibeFrame, LTX Desktop) [DOC] (their READMEs, cited above).
- **Replicate.** Being absorbed into Cloudflare [IND] (https://www.helpnetsecurity.com/2025/11/17/cloudflare-to-acquire-replicate/).
- **Together.** Added 40+ image and video models through Runware [CLAIM] (https://www.together.ai/blog/40-new-image-and-video-models).
- **WaveSpeed.** Advertises 1,000+ models with about 500 video-related endpoints, per-output pricing, a CLI/MCP option, a desktop app for non-developers and a prompt-to-cinematic-shot tool called Cinema Studio [CLAIM] (https://wavespeed.ai/).
- **Learn / defend.** Model access is a commodity that these companies will sell to anyone, including through agents. "Many models" is not a moat. Aggregators are suppliers to the thesis product and also potential upward entrants (WaveSpeed's desktop app and Cinema Studio are early signs) [ASSUMED].

### 3.21 Canva (with Leonardo, Affinity, ProSuite)

- **What it is.** A mass-market design platform with a video editor and an agentic assistant [IND] (https://siliconangle.com/2026/04/16/canva-unveils-canva-ai-2-0-recasting-platform-agentic-system-work/).
- **Models.** Aggregated. Veo 3 eight-second clips were added on paid plans in 2025 [IND] (TechRadar coverage, 2025). The current Veo version in Canva is [UNKNOWN]. Leonardo supplies generation tools and removed Sora 2 in July 2026 [IND] (https://yespress.io/leonardo-ai).
- **Editable surface.** Video 2.0 timeline editor (October 2025) [IND]. Affinity is free, with AI features requiring a paid Canva plan [IND] (https://petapixel.com/2026/09/15/affinity-3-3-powers-up-the-free-apps-raw-photo-processing/).
- **Agent.** Canva AI 2.0 with persistent memory and connectors [IND] (siliconangle link above).
- **Bundle.** ProSuite links Affinity, Cavalry, Flourish and Leonardo [CLAIM] (https://www.canva.com/newsroom/news/canva-prosuite-launch/).
- **Learn / defend.** Not a filmmaking tool, but it sets price expectations (free professional tools, paid AI) for non-specialist buyers.

### 3.22 Kapwing (Kai)

- **What it is.** A browser video editor with a chat assistant, Kai [DOC] (https://www.kapwing.com/help/release-notes-august-2026-2/).
- **Models.** Aggregated; Seedance 2.5 and MiniMax H3 were added in August 2026, with H3 as Kai's default video model [DOC] (same).
- **Agent.** An autonomous mode works from a task checklist, shows progress on the canvas and can be interrupted with unused credits returned [DOC] (same). Estimated credits must be approved before Kai proceeds [DOC] (same).
- **Lightweight provenance.** A Recreate action shows the prompt that generated an asset so it can be adjusted and re-run [DOC] (same).
- **MCP.** The release notes link to a Kapwing MCP article; its contents were not retrieved [UNKNOWN].
- **Pricing.** Pro around $16 per month annual, Business $50 [DOC] (https://www.kapwing.com/help/subscription-faq/) (snippet).
- **Learn / defend.** Credit refund on interruption and per-asset prompt recall are small, user-visible trust features that are cheap to match.

### 3.23 Utopai Studios (PAI)

- **What it is.** A long-form AI video model and production platform aimed at film and television [CLAIM] (https://www.utopaistudios.com/news/utopai-studios-opens-access-to-pai-long-form-ai-video-model).
- **Timeline.** Public release in March 2026; a Story Agent and three-minute 4K generation in April; PAI 2.0 in June with self-reported $11M ARR; a "production intelligence" platform with Production Assistants in September [CLAIM] (https://www.advanced-television.com/2026/06/02/utopai-studios-launches-pai-2-0/ — press release coverage).
- **Editable surface, API, pricing.** Not verified [UNKNOWN].
- **Learn / defend.** The only candidate claiming long-form single-pass generation plus story-level agents for professional production. Claims are unverified by independent testing in this pass.

### 3.24 PixVerse

- **What it is.** A video model vendor repositioning as a production platform [CLAIM] (https://pixverse.ai/blog/pixverse-evolves-from-creation-tool-to-production-platform).
- **Product surface.** V6 (March 2026) with native audio and multi-shot; an Agent; a node-based Canvas; an API; and a CLI and Skills package for Claude Code, Codex and other coding agents [CLAIM] (https://pixverse.ai/blog/pixverse-launches-v6-advancing-ai-video-generation ; https://app.pixverse.ai/cli).
- **Pricing.** App and API credits are separate [IND].
- **Learn / defend.** Evidence that even single-model vendors now ship canvas, agent and CLI as standard.

### 3.25 General-purpose agents with video: Manus, Genspark, Lovart

- **Manus.** Added video in June 2025 [IND] (https://www.bloomberg.com/news/articles/2025-06-04/ai-upstart-manus-starts-text-to-video-service-to-take-on-openai). Now claims research-to-script-to-video using Seedance 2.5 and a desktop Video Editor with a timeline [CLAIM] (https://manus.im/nl/features/video).
- **Genspark.** A general agent with a Media Studio [CLAIM] (https://www.genspark.ai/blog/genspark-media-studio).
- **Lovart.** A design agent on an infinite canvas covering images, video and 3D; a 2.0 release with persistent preferences and scheduled tasks is reported by one directory [IND] (https://tooldirectory.ai/tools/lovart).
- **Learn / defend.** General agents commoditise "idea to finished short video" for casual users. They do not offer shot-level control [ASSUMED].

---

## 4. Brief notes on the remaining candidates

| Product | Current characterisation | Label and source |
|---|---|---|
| Midjourney video | V1 video model launched June 2025. A V8.1 release with a 10-second mode is reported by one source. No timeline or public API known. | [IND] https://techcrunch.com/2025/06/18/midjourney-launches-its-first-ai-video-generation-model-V1 ; later details single-source; API [UNKNOWN] |
| Hedra | Character-3 talking-video model priced per second in credits; aggregates other models; an agent workspace is reported. | [CLAIM] https://www.hedra.com/video-models/hedra-character-3 ; [IND] https://usagepricing.com/blueprint/hedra |
| Synthesia | Version 3.0 with Video Agents and Veo-based B-roll. | [CLAIM] https://www.synthesia.io/post/synthesia-3-0-the-next-era-of-video |
| Mirage (ex-Captions) | Rebranded; Mirage Studio and an API with per-second pricing reported by one source. | [IND] https://techcrunch.com/2025/09/04/captions-rebrands-as-mirage-expands-beyond-creator-tools-to-ai-video-research |
| Artlist | AI toolkit and Artlist Studio; 100+ models plus an own model; large credit bundles. | [CLAIM] https://artlist.io/blog/ai-tools-pricing-plans/ |
| OpenArt | One-click story and consistent characters; credit complaints. | [IND] https://www.roborhythms.com/openart-ai-review/ |
| Leonardo | Blueprints and Flow State; part of Canva. | [IND] https://yespress.io/leonardo-ai |
| Morphic | Canvas for assets plus Compose timeline editor plus Copilot. | [CLAIM] https://morphic.com/ai-glossary/Canvas |
| Katalist | Script to storyboard with consistent characters; exports to slides and video slideshow. | [CLAIM] https://katalist.ai/ai-storyboard-generator |
| Saga | Idea to screenplay to storyboard to video; about $20 per month premium. | [CLAIM] https://www.createsagas.com/faq |
| Boords | Script to frames (a one-time snapshot; later script edits do not update frames); asset library with @-mentions for characters, locations and props; region-only Refine; animatics; exports include PDF, slides, CSV shot list and timelines for Premiere, Resolve and After Effects. No video generation described. | [CLAIM] https://boords.com/ai-storyboard-generator |
| StoryboardHero | Brief or script to storyboard for agencies; per-frame regeneration; white-label PDF; optional human artists. No video or animatic described. | [CLAIM] https://storyboardhero.ai/ |
| Showrunner (Fable) | Alpha in mid-2025; Amazon-backed; pricing unknown. | [IND] https://www.engadget.com/ai/showrunner-an-ai-powered-streaming-service-launches-in-alpha-this-week-204042241.html |
| Autodesk Flow Studio | Markerless performance capture to CG characters; USD scene export; tiers from free to about $95 per month; a node-based workspace reported in August 2026. | [DOC] https://help.wonderdynamics.com/export-scene ; [IND] https://www.usagepricing.com/blueprint/wonder-dynamics |
| Odyssey | Interactive world model with an API. | [CLAIM] https://odyssey.ml/ |
| Decart | Realtime video models with published API pricing. | [DOC] https://docs.platform.decart.ai/getting-started/pricing (snippet) |
| Genie 3 / Project Genie | Available to AI Ultra subscribers in the US; no API. | [IND] (press coverage; single source) |
| Meta Vibes / Movie Gen | Short-form AI video feed (September 2025); standalone web app tested in March 2026. | [IND] https://techcrunch.com/2025/09/25/meta-launches-vibes-a-short-form-video-feed-of-ai-slop/ ; https://www.testingcatalog.com/meta-tests-standalone-vibes-web-app-new-ai-video-creation-tool/ |
| MiniMax Hailuo / H3 | H3 released end of July 2026: up to 15 seconds, native 2K, stereo audio, multi-shot. Open-weights status disputed. | [CLAIM] https://www.minimax.io/news/imagination-is-productivity ; [IND] https://rits.shanghai.nyu.edu/ai/minimax-releases-h3-2k-video-with-native-audio-open-weights-promised/ |
| Vidu (ShengShu) | Q3 reference-to-video (April 2026); agent and app products named in press. | [IND] (press coverage) |
| Alibaba Wan / HappyHorse | Newest downloadable open weights reportedly Wan 2.2 (Apache-2.0); later versions proprietary; HappyHorse confirmed as Alibaba's in April 2026. | [IND] https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2 ; https://www.caixinglobal.com/2026-04-10/alibaba-unveils-happyhorse-after-ai-model-tops-video-rankings-under-alias-102432775.html |
| Tencent HunyuanVideo 1.5 | Open 8.3B-parameter model under a Tencent community licence that is not OSI-approved. | [DOC] https://huggingface.co/tencent/HunyuanVideo-1.5 (snippet) |
| xAI Grok Imagine | Video API; version 1.5 up to 1080p and 15 seconds. | [CLAIM] https://x.ai/news/grok-imagine-1-5 ; [DOC] https://docs.x.ai/docs/guides/video-generations (snippet) |
| Opus Clip / Agent Opus | Repurposing tool with a native MCP endpoint and an end-to-end agent callable from chat assistants. Tool counts conflict across sources. | [IND] https://mer.vin/2026/07/agent-opus-explained-opusclip-end-to-end-ai-video-agent/ |
| Veed | MCP server (April 2026); Fabric talking-video model; OpenEdit, an Apache-2.0 agent-driven HTML/CSS editing pipeline for recent Apple Silicon Macs. | [CLAIM] https://www.veed.io/tools/veed-mcp ; https://www.veed.io/newsroom/openedit-by-veed |
| Topaz | Astra creative upscaling is cloud-only; local Starlight models gated to the Pro tier; moved to subscription-only with strong backlash from perpetual-licence owners. | [DOC] https://docs.topazlabs.com/astra/astra-faq (snippet) ; [IND] https://community.topazlabs.com/t/topaz-studio-transition-questions/95039 |
| Arcads | UGC-style ad generator; no public price list; an ad-building agent; MCP and API outside the lowest tier. | [IND] https://eesel.ai/blog/arcads-ai-pricing |
| Creatify | Ad generator with API, batch mode and a published agent skill; several features reportedly discontinued in May 2026. | [DOC] https://docs.creatify.ai/introduction.md (snippet) ; discontinuations [IND, reviewer claim] |
| Mosaic (YC W25) | Node canvas of video-editing agents with branching variants and an inline timeline. Founders state XML export for Resolve, Final Cut and Premiere. HN commenters questioned output quality, browser-only delivery and determinism. | [CLAIM] and [IND] https://news.ycombinator.com/item?id=45980760 |
| Cardboard (YC W26) | Browser agentic editor for marketing teams with a "Director" agent. | [CLAIM] https://www.ycombinator.com/launches/PM3-cardboard-agentic-video-editor |
| Intangible | Browser 3D scene studio; shots generated from one 3D scene for spatial consistency. | [CLAIM] https://www.intangible.ai/technology |
| Hypernatural | Script, storyboard, scene editor and timeline in one editor. | [CLAIM] https://hypernatural.ai/editor-v3 |
| Wireflow, Raelume, Martini | Node-canvas aggregators; Wireflow exposes a workflow as a single API. | [CLAIM] (vendor sites; https://docs.martini.art/) |
| Flova | Thin coverage; aggregates third-party video models. | [IND] https://www.crunchbase.com/organization/flova-tech-inc |
| Videotok | Nothing found. | [UNKNOWN] |

---

## 5. Open-source and agentic projects (GitHub)

Figures are as displayed on the repository page on 2026-11-11 unless marked otherwise. Recency of last commit is [UNKNOWN] for all rows.

| Project | Stars | Licence | Commits | What it is | Label and source |
|---|---|---|---|---|---|
| HyperFrames (HeyGen) | 82.7k | Apache-2.0 | 7,042 | HTML-to-video framework with CLI, Studio and agent skills | [DOC] https://github.com/heygen-com/hyperframes |
| OpenMontage | 79.6k | AGPL-3.0 | 724 | Coding-assistant-driven production pipelines with gates and budgets | [DOC] https://github.com/calesthio/OpenMontage |
| ArtCraft (StoryTold) | 40.6k | MIT or Apache-2.0 | 55 | Desktop app for image and video creation with a 3D virtual set, canvas editing and a 62-model catalogue | [DOC] https://github.com/storytold/artcraft |
| Palmier Pro | 14.7k | GPL-3.0 through v0.7.6, then proprietary | 1,096 | Native macOS editor with localhost MCP | [DOC] https://github.com/palmier-io/palmier-pro |
| ViMax | 12.9k | MIT | 395 | Multi-agent idea/script/novel-to-video | [DOC] https://github.com/HKUDS/ViMax |
| OpenChatCut | 3.1k | AGPL-3.0-or-later | 1,132 | Local-first timeline editor with shared agent/MCP tools | [DOC] https://github.com/0xsline/OpenChatCut |
| LTX Desktop | 2.2k | Apache-2.0 (app) | 82 | Local LTX generation app with Retake and assistant | [DOC] https://github.com/Lightricks/LTX-Desktop |
| VibeFrame | 185 | MIT | 1,209 | CLI and MCP; project as files; per-beat rebuild | [DOC] https://github.com/vericontext/vibeframe |
| OpenCut | 45.8k–87k (sources conflict) | MIT | not fetched | CapCut-style editor; mid-rewrite; agent API and MCP are stated intent, not shipped | [IND] https://mer.vin/2026/07/opencut-explained-open-source-capcut-alternative-classic-editor-vs-ground-up-rewrite/ |
| ArcReel | about 1.3k | AGPL-3.0 | not fetched | Novel-to-video multi-agent pipeline on the Claude Agent SDK | [IND] https://themenonlab.blog/blog/arcreel-novel-to-video-multi-agent-pipeline |
| FilmAgent | about 1.1k | unconfirmed | not fetched | Multi-agent filmmaking in 3D virtual spaces | [IND] (search results) |
| OpenCinema | not verified | not verified | not fetched | Described as a local-first canvas linking storyboards, assets, previs and editing. The repository URL returned 404 when fetched. | [UNKNOWN]; wiki reference seen at https://github.com/junjamrk/OpenCinema/wiki |
| Veed OpenEdit | not verified | Apache-2.0 | not fetched | Agent-driven HTML/CSS editing pipeline | [CLAIM] https://www.veed.io/newsroom/openedit-by-veed |
| Premiere MCP (hetpatel-11) | about 810 | MIT | not fetched | Community MCP server driving Premiere through a panel | [IND] https://glama.ai/mcp/servers/@hetpatel-11/Adobe_Premiere_Pro_MCP |
| Resolve MCP (samuelgursky and others) | not verified | not verified | not fetched | Community MCP servers using Resolve's scripting API | [IND] https://chatcut.io/blog/best-video-editing-mcp-servers |
| Remotion, Diffusion Studio, Revideo | not verified | Remotion reportedly source-available with company-size thresholds | not fetched | "Video as code" frameworks used by agents | [IND] https://moda.app/blog/hyperframes-vs-remotion |

Notes:

- ArtCraft's repository page does not state bring-your-own keys, local models, a project file format or a timeline; integrations for Kling, Google, Runway and Luma are listed as planned [DOC] (https://github.com/storytold/artcraft). A third-party article describes bring-your-own-key use with fal, Replicate and Google [IND] (https://aibuilt-it.pages.dev/video-creative/artcraft-open-source-ai-film-studio-desktop). These conflict; treat the bring-your-own-key claim as unverified.
- ArtCraft shows 40.6k stars against 55 commits on main [DOC] (same). That ratio is unusual and may reflect a squashed history [ASSUMED].
- Smaller bring-your-own-key canvases seen only in third-party listings: BeefTV (MIT node canvas with on-disk projects), BeatDesign (Apache-2.0, SQLite-backed project folder), noder (Replicate key, storyboard template), Jaaz, Signal Loom (AGPL), Flowboard, and hosted tools Cutlab and AI-Flow [IND] (https://alphasignal.ai/news/beeftv-turns-ai-video-production-into-a-visual-node-graph ; https://mcpservers.org/servers/beatapi/beatdesign ; https://github.com/oshtz/noder ; https://ai-flow.net/byok/). AI-Flow markets itself as a bring-your-own-key alternative to Flora and Weave [CLAIM] (https://ai-flow.net/byok/).
- Remotion's documentation reportedly says a composition cannot be exported to OTIO deterministically [DOC] (https://www.remotion.dev/docs/export-opentimeline) (snippet). This matters because OpenChatCut, OpenMontage and VibeFrame all render through Remotion or HyperFrames [DOC] (their READMEs).

---

## 6. Synthesis

All rankings and judgements in this section are [ASSUMED]; they rest on the labelled facts in sections 3–5.

### 6a. The most dangerous competitors to the thesis

1. **Google Flow.** It combines owned frontier models, an in-product agent whose turns are reportedly free, user-built tools, mobile reach and bundle pricing. If conversational editing in Omni works as claimed, many users will not feel the need for a shot-level revision system. Its exposure: single vendor, cloud only, no evidence of structured export, and documented credit-loss complaints.
2. **Lightricks (LTX Studio plus LTX Desktop plus open weights).** The only vendor present on both sides of the thesis: a hosted storyboard-to-timeline with per-clip regeneration and Premiere XML export, and an Apache-licensed local app with Retake, own keys and a local-LLM assistant. If Lightricks connects its assistant to an editable timeline and adds an MCP endpoint, it covers most of the thesis with its own model advantage. Today the desktop timeline is labelled legacy and the assistant explicitly cannot edit it.
3. **ComfyUI.** It already owns local, model-independent generation and now has first-party MCP, CLI and App Mode. Any thesis product that tries to be the local execution layer competes with a very large community. The realistic stance is to treat ComfyUI as a back end and compete above it on story structure, timeline and revision.
4. **Flora (and the node-canvas class: Figma Weave, Magnific Spaces, Krea).** Flora's API, CLI and MCP with quotes, caps and no-charge-on-failure is the benchmark for a professional agent surface. The class is well funded and has design-team distribution. Its exposure: canvases flatten time, there is no local path, and no user keys.
5. **Agentic NLEs (ChatCut, OpenChatCut, Palmier Pro, Cardboard, Mosaic).** These overlap the thesis most directly on "agent edits a real timeline through MCP". OpenChatCut adds local-first storage, user LLM keys, draft review and FCPXML export under AGPL. Their exposure: generation is a side feature, there is no shot, take or script model, and the teams are small.
6. **Coding-assistant studios (OpenMontage, HyperFrames, ViMax, VibeFrame).** They capture the developer and agent audience with no user interface to build, and already implement approval gates, budget caps and project-as-files. They can be embedded by anyone, including rivals. Their exposure: no interactive editing, composition as code, no NLE interchange.
7. **Commercial agent-plus-timeline suites (Invideo, ElevenLabs Studio, Descript, Kapwing).** They normalise "chat with an agent, then fix it on the timeline" for mainstream users at low prices. ElevenLabs is notable because it controls the audio stack.
8. **ByteDance (Seedance 2.5 with Jimeng, Dreamina and, by extension, CapCut).** Timestamp-level editing, 30-second passes and 50 references move consistency and partial revision into the model, distributed through the largest consumer editor. Exposure: legal and regional availability risk.

Honourable mention: aggregator APIs (fal, WaveSpeed) are suppliers today but are moving up the stack with MCP servers, desktop apps and shot tools.

### 6b. Category-wide complaint patterns

| Pattern | Evidence | Label |
|---|---|---|
| Credits charged for failed generations | Google Flow forum thread; Adobe Firefly community reports; cross-vendor write-up covering Runway, Kling, Pika, Hailuo and HeyGen | [IND] https://discuss.ai.google.dev/t/veo-flow-generation-issues-lost-credits-consistency-problems-and-excessive-failed-generations/147374 ; https://community.adobe.com/t5/adobe-firefly-bugs/credits-are-being-deducted-even-when-video-generation-fails/idi-p/15659871 ; https://dev.to/smophyai/the-real-cost-of-ai-video-in-2026-why-credit-systems-cost-more-than-the-sticker-price-j6h |
| Credit burn from re-rolls, with limited refunds | Invideo reviews | [IND] https://aireiter.com/blog/invideo-ai-review ; https://www.trustpilot.com/review/invideo.io |
| Cost not visible before a run | LTX Studio, Krea and Magnific reviews | [IND] https://stacksheriff.com/ai-tools/ltx-studio-review/ ; https://www.costbench.com/software/ai-image-generators/krea/hidden-costs/ ; https://www.aiarty.com/knowledge-base/freepik-reviews.htm |
| Agent reasoning consumes paid credits | Invideo reviews; ElevenLabs documents that agent chat consumes credits | [IND] https://ie.trustpilot.com/review/ai.invideo.io ; [DOC] https://elevenlabs.io/docs/creative-platform/products/studio |
| Credits expire or do not roll over | Cross-vendor write-up; ComfyUI documents expiry and no refunds | [IND] dev.to link above ; [DOC] https://docs.comfy.org/tutorials/partner-nodes/overview |
| Moderation false positives, sometimes after the job completed and was billed | Grok guide; academic study of moderation complaints | [IND] https://www.sloane.world/guides/grok-content-moderated-2026 ; https://arxiv.org/html/2506.14018 |
| Consistency failure across shots | Google Flow forum thread | [IND] (link above) |
| Lack of revision control over agent edits | Product Hunt request on OpenChatCut for versioned, diffable agent edits; HN question on Mosaic determinism | [IND] https://news.ycombinator.com/item?id=45980760 ; Product Hunt listing |
| Flattened output (no layers or project hand-off) | Mosaic HN requests for EDL and proxy management; LTX Studio could not import camera footage | [IND] HN link above ; https://www.cined.com/ltx-studio-takes-its-next-big-step-editing/ |
| Lock-in and rug-pulls | Sora API withdrawal; Topaz move to subscription-only; Palmier Pro going closed; Creatify discontinuing features | [DOC] https://developers.openai.com/api/docs/deprecations ; [IND] https://community.topazlabs.com/t/topaz-studio-transition-questions/95039 ; [DOC] https://github.com/palmier-io/palmier-pro |
| Privacy | A mis-sent email at Mosaic prompted privacy questions; few vendors state retention periods (Flora's page does not) | [IND] HN link above ; [DOC] https://docs.flora.ai/legal/data-security-and-ip.md |
| Post-cancellation charges | Krea reviews | [IND] https://www.eesel.ai/blog/krea-3-pricing |

Limitation: direct Reddit evidence was thin, and several rows rest on one or two sources.

### 6c. Converging versus rare capabilities

**Converging or commoditising (poor differentiators)**

- Multi-model aggregation. Flora, Krea, Magnific, Invideo, Artlist, Kapwing, WaveSpeed and fal all offer dozens to hundreds of models (sections 3 and 4).
- Node canvases. Flora, Figma Weave, Magnific Spaces, Krea, ComfyUI, PixVerse Canvas, Autodesk Flow Studio, Mosaic, Wireflow, Raelume and Martini.
- In-product agents. Flow Agent, FAUNA, Krea Agent, Studio Agent, Underlord, Kai, Invideo's agent, Comfy Agent and Utopai's assistants.
- MCP servers, CLIs and agent skills (finding 1 in section 1).
- Script-to-storyboard generation with reference-based characters. LTX Studio, Katalist, Saga, Boords, StoryboardHero, OpenArt, Hypernatural.
- Native audio, multi-shot output and reference-driven consistency at the model level. Seedance 2.5, MiniMax H3, PixVerse V6, Veo 3.1 and Omni.
- Basic XML hand-off to NLEs. LTX Studio, ChatCut, Mosaic, Boords and OpenChatCut all state some form of XML or FCPXML export.

**Rare (candidate differentiators)**

- Versioned, diffable history of shots, takes and agent actions. Not found anywhere [UNKNOWN]. OpenChatCut's draft-then-commit and ChatCut's save-a-version are the nearest [DOC] (sections 3.13, 3.14).
- Generation provenance carried with the project. Only prompt recall per asset was found (Kapwing Recreate) [DOC] (section 3.22). No tool was found exporting lineage through OTIO or equivalent [UNKNOWN].
- A structured project model that spans script, shots, takes, assets and edit decisions. Pipelines have structured state (OpenMontage, VibeFrame) and editors have timelines (OpenChatCut), but no project was found doing both [ASSUMED].
- True local-first operation with model independence. LTX Desktop is local but tied to one family; ComfyUI is independent but has no production structure; OpenChatCut is local for editing but cloud for intelligence and generation.
- Bring-your-own provider keys in a commercial product. Found only in open-source tools and small hosted challengers; ComfyUI explicitly does not support it for partner models [DOC] (section 3.4); Flora does not mention it [DOC] (section 3.5).
- Hard cost governance. Quote before run, per-action approval, hard caps and no charge on failure exist at Flora, Kapwing, OpenMontage and VibeFrame but are absent or undocumented at most large platforms.
- An agent that can judge visual output. LTX Desktop documents that its assistant cannot [DOC] (section 3.3); ViMax uses a vision model to pick keyframes [DOC] (section 3.17).
- Ingesting and mixing real camera footage with generated shots in one structured project [ASSUMED]; LTX Studio could not import camera footage as of January 2026 [IND] (section 3.2).

### 6d. Products closest to the thesis claims

| Claim | Product | Precise characterisation | Label and source |
|---|---|---|---|
| Edit one shot without regenerating everything | LTX Studio | A timeline clip can be sent back to generation, re-prompted, and the approved result replaces it in place. Take history not documented. | [IND] https://www.cined.com/ltx-studio-takes-its-next-big-step-editing/ |
| | LTX Desktop | Retake regenerates a selected portion of a clip, locally or via API. It is a generation tool, not tied to a maintained timeline. | [DOC] https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/README.md |
| | Seedance 2.5 | Timestamp-level edits to existing audio and video at the model level. The vendor post does not use the phrase "edit in place". | [CLAIM] https://seed.bytedance.com/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5 |
| | Google Flow | Insert and Remove object; Omni instruction-based editing. | [IND] https://yourstory.com/ai-story/google-veo-31-flow-ai-editing-tool ; [CLAIM] Flow blog |
| | VibeFrame | A beat selector rebuilds one beat of a file-based project. Reuse guarantees not established. | [DOC] https://github.com/vericontext/vibeframe |
| | Boords | Region-only Refine on a storyboard frame. Stills only. | [CLAIM] https://boords.com/ai-storyboard-generator |
| Project as structured data | VibeFrame | Directory of Markdown, YAML and JSON; no single timeline file. | [DOC] (same repo) |
| | OpenMontage | YAML manifests and schema-validated JSON checkpoints per stage. | [DOC] https://github.com/calesthio/OpenMontage |
| | OpenChatCut | Project JSON on local disk with full project import and export, plus FCPXML. | [DOC] https://raw.githubusercontent.com/0xsline/OpenChatCut/main/README.md |
| | HyperFrames | HTML files with timing and track attributes; deterministic render. | [DOC] https://github.com/heygen-com/hyperframes |
| | ComfyUI | Workflow graph as JSON; describes a generation, not an edit. | [ASSUMED] |
| | Flora | Canvas nodes readable and writable through API and MCP; cloud-held. | [DOC] https://docs.flora.ai/llms.txt |
| Generation provenance | Kapwing | Per-asset recall of the generating prompt for re-run. | [DOC] https://www.kapwing.com/help/release-notes-august-2026-2/ |
| | C2PA | The standard can carry ingredient and parameter assertions; platforms often strip credentials. | [IND] https://c2pa.org/?p=259 ; https://ppc.land/c2pa/ |
| | Any AI video tool exporting lineage in OTIO | None found. | [UNKNOWN] |
| Bring your own key / local models | LTX Desktop | Local LTX models; optional LTX, fal and Gemini keys; local LLM assistant. | [DOC] (README and assistant doc) |
| | OpenChatCut | User keys for LLM providers and optional fal; no local AI models mentioned. | [DOC] (README) |
| | OpenMontage, ViMax, VibeFrame | User keys throughout; OpenMontage and VibeFrame have zero-key local routes for some stages. | [DOC] (repos) |
| | ComfyUI | Local models yes; own provider keys for closed models no. | [DOC] https://docs.comfy.org/tutorials/partner-nodes/overview |
| | ArtCraft | Bring-your-own-key reported by a third party; not stated on the repository page. | [IND] versus [DOC], conflicting (section 5) |
| | Flora, Krea, Google Flow, Invideo, Figma Weave, Magnific | Not offered or not mentioned. | [DOC] for Flora and Krea docs; others [UNKNOWN] |

Summary judgement [ASSUMED]: each thesis claim is individually present somewhere, usually in a small or open-source project. No single product assembles them, and none adds versioned revision history or exportable provenance.

---

## 7. Implications for the strategy document

All points here are [ASSUMED] recommendations derived from the evidence above.

1. Do not lead with "has MCP and CLI" or "many models". Lead with what the survey could not find: versioned shot and take history, diffable agent actions, and provenance that survives export.
2. Match Flora's cost governance as a floor: quote before run, hard caps, no charge on failure, and visible agent overhead.
3. Treat ComfyUI, fal and similar as back ends. Model independence should include local runtimes, user keys and the ability to route to model-native editing (such as Seedance timestamp edits).
4. Borrow OpenChatCut's draft-review-commit pattern and OpenMontage's enforced approval gates for the agent layer.
5. Plan for provider withdrawal. Sora's removal and Palmier's licence change are usable proof points for local-first and open project formats.
6. Avoid a rendering dependency that blocks interchange. Remotion-based stacks reportedly cannot round-trip to OTIO.
7. Watch Lightricks most closely. It is one product decision away from covering much of the thesis.

---

## 8. Open questions

1. Does Google Flow expose any structured project export, version history or multitrack audio timeline? What are the current official credit costs and are failed generations refunded?
2. Will Lightricks reconnect the LTX Desktop assistant to a timeline or add MCP? What exactly does the LTX-2 community licence require above the reported revenue threshold?
3. What does Invideo's "version control" cover, and does it have an API or MCP?
4. What are ChatCut's models, pricing and data-handling terms, and does its MCP expose the same tools as the in-app agent?
5. Are the very high GitHub star counts for OpenMontage, HyperFrames and ArtCraft organic? What are their release cadences and maintainer counts?
6. Does ArtCraft actually support user keys and on-disk project files, as third parties say?
7. Is OpenCinema still published, and under what licence?
8. What does the Kapwing MCP do, and can it edit a timeline?
9. Is Utopai's long-form generation independently verified, and what editing surface does it offer?
10. Has any vendor shipped C2PA assertions that include prompts, seeds and model versions, or OTIO metadata with generation lineage?
11. Status of items not reached before the search budget ran out: Videotok, Gemini app video, a Hailuo agent app, Tencent Yuanbao video, a Wan consumer app, Invideo's official pricing, Magnific Spaces MCP details.
12. Complaint evidence from Reddit and Discord was not directly sampled. A targeted pass would strengthen section 6b.

---

## 9. Sources

Access date for all sources: 2026-11-11. "Fetched" means the page was retrieved and read through an automated summariser in this research. "Snippet" means only a search-result excerpt was seen, or the fetch happened earlier in the session and was not re-verified.

### Fetched primary sources (official docs, repositories, vendor pages)

- https://developers.openai.com/api/docs/deprecations
- https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates
- https://workspace.google.com/products/vids/
- https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/README.md
- https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/gen-space-and-video-editor.md
- https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/desktop-assistant.md
- https://github.com/Lightricks/LTX-Desktop
- https://docs.comfy.org/tutorials/partner-nodes/overview
- https://docs.comfy.org/development/cloud/mcp-server
- https://docs.flora.ai/plans-and-billing/pricing
- https://docs.flora.ai/llms.txt
- https://docs.flora.ai/mcp/cost-and-limits.md
- https://docs.flora.ai/mcp/security.md
- https://docs.flora.ai/legal/data-security-and-ip.md
- https://www.krea.ai/docs/llms.txt
- https://elevenlabs.io/docs/creative-platform/products/studio
- https://chatcut.io/docs/what-is-chatcut.md
- https://raw.githubusercontent.com/0xsline/OpenChatCut/main/README.md
- https://github.com/0xsline/OpenChatCut
- https://github.com/palmier-io/palmier-pro
- https://github.com/calesthio/OpenMontage
- https://github.com/HKUDS/ViMax
- https://github.com/vericontext/vibeframe
- https://github.com/heygen-com/hyperframes
- https://github.com/storytold/artcraft
- https://seed.bytedance.com/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5
- https://www.kapwing.com/help/release-notes-august-2026-2/
- https://boords.com/ai-storyboard-generator
- https://storyboardhero.ai/
- https://wavespeed.ai/

### Fetched independent sources

- https://www.cined.com/ltx-studio-takes-its-next-big-step-editing/ (first 100,000 characters read)
- https://news.ycombinator.com/item?id=45980760
- https://themenonlab.blog/blog/palmier-pro-ai-video-editor/

### Fetch failures

- https://github.com/junjamrk/OpenCinema (HTTP 404)
- https://www.kapwing.com/help/kapwing-mcp/ (HTTP 404; guessed URL)
- https://docs.flora.ai/mcp/security-and-data (page not found; correct page located and fetched)

### Search-result or earlier-session sources (snippet level unless stated in the text)

Sora: https://venturebeat.com/technology/openai-is-shutting-down-sora-its-powerful-ai-video-app ; https://decrypt.co/362243/openai-shut-down-sora-derailing-1-billion-deal-disney ; https://9to5google.com/2026/03/24/openai-shutting-down-sora-video-generation-app-but-without-explaining-why/ ; https://www.neowin.net/news/openai-to-shut-down-sora-app-and-apis-as-it-shifts-focus-to-coding-ai/

Google Flow: https://venturebeat.com/ai/google-releases-new-ai-video-model-veo-3-1-in-flow-and-api-what-it-means-for ; https://yourstory.com/ai-story/google-veo-31-flow-ai-editing-tool ; https://design-offset.com/202604-google-flow-updates/ ; https://aitoolsatlas.ai/tools/flow ; https://androidauthority.com/google-flow-gemini-omni-1-1-flash-video-update-3704288 ; https://rar.design/posts/google-flow-omni-agent-tools-complete-guide ; https://www.testingcatalog.com/google-prepares-agent-mode-for-flow-to-automate-video-production/ ; https://9to5google.com/2026/05/19/google-flow-video-music-ai-apps/ ; https://discuss.ai.google.dev/t/veo-flow-generation-issues-lost-credits-consistency-problems-and-excessive-failed-generations/147374

Lightricks: https://the-decoder.com/lightricks-open-sources-ai-video-model-ltx-2-challenges-sora-and-veo/ ; https://ltx.io/blog/ltx-2-is-now-open-source ; https://ltx.io/blog/ltx-2-3-release ; https://www.layer3labs.io/guides/ltx-2-5-explained ; https://github.com/Lightricks/ltx-desktop/releases ; https://stacksheriff.com/ai-tools/ltx-studio-review/ ; https://www.g2.com/products/ltx-studio/reviews ; https://dupple.com/reviews/ltx-studio

ComfyUI: https://comfy.org/cloud/pricing ; https://docs.comfy.org/cloud-nodes/overview ; https://docs.comfy.org/agent-tools/comfy-cli ; https://blog.comfy.org/p/from-workflow-to-app-introducing ; https://digitalproduction.com/2026/10/09/comfy-agent-ai-comfyui-workflows/

Flora, Figma Weave, Magnific, Krea: https://techcrunch.com/2026/01/27/node-based-design-tool-flora-raises-42m-from-redpoint-ventures/ ; https://www.testingcatalog.com/flora-launches-fauna-ai-design-agent-for-teams ; https://itbrief.co.uk/story/flora-launches-fauna-for-creative-teams-with-usd-52-million ; https://www.fastcompany.com/91431691/figma-weave-weavy-acquisition ; https://help.figma.com/hc/en-us/articles/35965787376919 ; https://thenextweb.com/news/freepik-rebrands-as-magnific ; https://www.magnific.com/ai/docs/freepik-is-now-magnific ; https://www.freepik.com/ai/faq/spaces ; https://www.aiarty.com/knowledge-base/freepik-reviews.htm ; https://yespress.io/krea ; https://www.costbench.com/software/ai-image-generators/krea/hidden-costs/ ; https://www.eesel.ai/blog/krea-3-pricing

Invideo, ElevenLabs, HeyGen, Descript, Kapwing: https://www.fast.io/resources/invideo-ai-review-2026.md ; https://tooliverse.ai/tools/invideo ; https://www.trustpilot.com/review/invideo.io ; https://ie.trustpilot.com/review/ai.invideo.io ; https://aireiter.com/blog/invideo-ai-review ; https://invideo.io/blog/invideo-agent-vs-higgsfield-supercomputer/ ; https://www.testingcatalog.com/elevenlabs-mcp-can-now-generate-voice-music-images-video/ ; https://elevenlabs.io/docs/eleven-api/resources/mcp-server ; https://hyperframes.heygen.com/guides/mcp ; https://www.heygen.com/api ; https://www.g2.com/articles/heygen-api-pricing ; https://themenonlab.blog/blog/heygen-hyperframes-video-as-code ; https://help.descript.com/hc/en-us/articles/36803785502221-Underlord-beta-Your-AI-co-editor-in-Descript ; https://www.descript.com/underlord ; https://www.descript.com/blog/article/underlord-ai-can-watch-videos ; https://www.kapwing.com/help/subscription-faq/

Agentic editors and pipelines: https://chatcut.io/claude-code-plugin ; https://chatcut.io/chatgpt-plugin ; https://chatcut.io/codex-plugin ; https://aident.ai/integrations/chatcut_mcp ; https://www.producthunt.com/products/chatcut-ai-video-editor ; https://www.ycombinator.com/companies/mosaic-2 ; https://gigazine.net/gsc_news/en/20251121-mosaic-video-editor ; https://www.ycombinator.com/launches/PM3-cardboard-agentic-video-editor ; https://learn.usecardboard.com/ai-editing/ai-chat ; https://github.com/OpenCut-app/OpenCut ; https://mer.vin/2026/07/opencut-explained-open-source-capcut-alternative-classic-editor-vs-ground-up-rewrite/ ; https://glama.ai/mcp/servers/kenimo49/opencut-mcp ; https://chatcut.io/blog/best-video-editing-mcp-servers ; https://glama.ai/mcp/servers/@hetpatel-11/Adobe_Premiere_Pro_MCP ; https://themenonlab.blog/blog/arcreel-novel-to-video-multi-agent-pipeline ; https://github.com/junjamrk/OpenCinema/wiki ; https://aibuilt-it.pages.dev/video-creative/artcraft-open-source-ai-film-studio-desktop ; https://alphasignal.ai/news/beeftv-turns-ai-video-production-into-a-visual-node-graph ; https://mcpservers.org/servers/beatapi/beatdesign ; https://github.com/oshtz/noder ; https://github.com/11cafe/jaaz ; https://ai-flow.net/byok/

Video as code: https://www.tella.com/blog/how-to-use-remotion-agent-skills-with-claude-code.md ; https://moda.app/blog/hyperframes-vs-remotion ; https://autoae.online/blog/hyperframes-vs-remotion-developer-verdict ; https://www.remotion.dev/docs/export-opentimeline

Aggregators: https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server ; https://sacra.com/c/fal-ai/ ; https://www.helpnetsecurity.com/2025/11/17/cloudflare-to-acquire-replicate/ ; https://www.together.ai/blog/40-new-image-and-video-models

ByteDance and other model vendors: https://www.nbcnews.com/tech/tech-news/seedance-2-bytedance-copyright-infringement-concerns-hollywood-rcna259173 ; https://thenextweb.com/news/bytedance-seedance-2-5-ai-video-4k-30-seconds ; https://www.minimax.io/news/imagination-is-productivity ; https://rits.shanghai.nyu.edu/ai/minimax-releases-h3-2k-video-with-native-audio-open-weights-promised/ ; https://pixverse.ai/blog/pixverse-launches-v6-advancing-ai-video-generation ; https://app.pixverse.ai/cli ; https://pixverse.ai/blog/pixverse-evolves-from-creation-tool-to-production-platform ; https://howaiworks.ai/blog/alibaba-wan-open-weights-stopped-at-2-2 ; https://www.caixinglobal.com/2026-04-10/alibaba-unveils-happyhorse-after-ai-model-tops-video-rankings-under-alias-102432775.html ; https://huggingface.co/tencent/HunyuanVideo-1.5 ; https://x.ai/api/imagine ; https://x.ai/news/grok-imagine-api ; https://x.ai/news/grok-imagine-1-5 ; https://docs.x.ai/docs/guides/video-generations ; https://updates.midjourney.com/introducing-our-v1-video-model/ ; https://techcrunch.com/2025/06/18/midjourney-launches-its-first-ai-video-generation-model-V1 ; https://beginnersinai.org/?p=28865 ; https://tooldirectory.ai/tools/moonvalley

Other platforms: https://techcrunch.com/2025/09/04/captions-rebrands-as-mirage-expands-beyond-creator-tools-to-ai-video-research ; https://www.hedra.com/video-models/hedra-character-3 ; https://usagepricing.com/blueprint/hedra ; https://www.roborhythms.com/openart-ai-review/ ; https://aireiter.com/blog/openart-ai-review-2026-pricing ; https://artlist.io/blog/ai-tools-pricing-plans/ ; https://help.artlist.io/hc/en-us/articles/29558520864541-The-AI-Suite-plans-explained ; https://www.synthesia.io/post/synthesia-3-0-the-next-era-of-video ; https://yespress.io/leonardo-ai ; https://siliconangle.com/2026/04/16/canva-unveils-canva-ai-2-0-recasting-platform-agentic-system-work/ ; https://petapixel.com/2026/09/15/affinity-3-3-powers-up-the-free-apps-raw-photo-processing/ ; https://www.canva.com/newsroom/news/canva-prosuite-launch/ ; https://www.engadget.com/ai/showrunner-an-ai-powered-streaming-service-launches-in-alpha-this-week-204042241.html ; https://help.wonderdynamics.com/export-scene ; https://www.usagepricing.com/blueprint/wonder-dynamics ; https://odyssey.ml/ ; https://docs.platform.decart.ai/getting-started/pricing ; https://www.testingcatalog.com/meta-tests-standalone-vibes-web-app-new-ai-video-creation-tool/ ; https://techcrunch.com/2025/09/25/meta-launches-vibes-a-short-form-video-feed-of-ai-slop/ ; https://docs.topazlabs.com/astra/astra-faq ; https://community.topazlabs.com/t/release-3-26-2026/101667 ; https://community.topazlabs.com/t/topaz-studio-transition-questions/95039 ; https://forums.macrumors.com/threads/topaz-labs-changes.2464782 ; https://eesel.ai/blog/arcads-ai-pricing ; https://intercom.help/arcads/en/articles/10538922-arcads-ai-api-documentation ; https://docs.creatify.ai/introduction.md ; https://mer.vin/2026/07/agent-opus-explained-opusclip-end-to-end-ai-video-agent/ ; https://www.opus.pro/llms.txt ; https://www.veed.io/tools/veed-mcp ; https://www.veed.io/newsroom/openedit-by-veed

Storyboard, pro-film and general agents: https://morphic.com/ai-glossary/Canvas ; https://www.producthunt.com/products/morphic ; https://katalist.ai/ai-storyboard-generator ; https://www.createsagas.com/faq ; https://www.utopaistudios.com/news/utopai-studios-opens-access-to-pai-long-form-ai-video-model ; https://www.advanced-television.com/2026/06/02/utopai-studios-launches-pai-2-0/ ; https://en.wikipedia.org/wiki/Utopai_Studios ; https://www.intangible.ai/technology ; https://hypernatural.ai/editor-v3 ; https://docs.martini.art/ ; https://tooldirectory.ai/tools/lovart ; https://www.crunchbase.com/organization/flova-tech-inc ; https://www.genspark.ai/blog/genspark-media-studio ; https://www.bloomberg.com/news/articles/2025-06-04/ai-upstart-manus-starts-text-to-video-service-to-take-on-openai ; https://manus.im/nl/features/video

Complaints and provenance: https://community.adobe.com/t5/adobe-firefly-bugs/credits-are-being-deducted-even-when-video-generation-fails/idi-p/15659871 ; https://dev.to/smophyai/the-real-cost-of-ai-video-in-2026-why-credit-systems-cost-more-than-the-sticker-price-j6h ; https://www.sloane.world/guides/grok-content-moderated-2026 ; https://arxiv.org/html/2506.14018 ; https://c2pa.org/?p=259 ; https://ppc.land/c2pa/ ; https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699
