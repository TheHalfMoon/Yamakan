# 03 - Professional/prosumer editors, Blender, and open-source building blocks for AI video production

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Access date for every source: **2026-11-11**. Analyst role: desk research only. No product was installed, run, signed into, or tested; nothing here is a hands-on observation.

## 0. Method, evidence labels, and what could not be fetched

Labels (exactly one per factual claim):

- `[DOC]` official documentation, pricing page, release notes, readme, or license text that was fetched directly (URL given).
- `[CLAIM]` vendor marketing, press release, or vendor blog.
- `[IND]` independent third-party observation (URL given).
- `[ASSUMED]` my inference or synthesis.
- `[UNKNOWN]` could not be determined.

Extra marker: `(snippet)` means the statement was read only from a search-result summary and the underlying page was not opened. Where the underlying page is an official document that I could not open, I label the statement `[IND] (snippet)` rather than `[DOC]`, because I did not see the official text myself.

Fetch failures that shape confidence:

- **helpx.adobe.com returned HTTP 403 for every URL tried.** Adobe facts below come from adobe.com product pages, developer.adobe.com, community.adobe.com announcements, blog.adobe.com, and third parties. Help-centre details (Generative Extend limits, per-model credit rates, system requirements, OTIO status) are therefore snippet-grade or unknown.
- **blender.org and projects.blender.org returned 403 / a Cloudflare challenge** (not bypassed). The official license page, FAQ, hardware requirements page, and the Blender Lab MCP repository were not read. Blender facts come from developer.blender.org release notes, docs.blender.org, pypi.org, opendata.blender.org, and gnu.org.
- **Blackmagic "DaVinci Resolve Studio 21 Features" PDF** came back as binary and could not be read. The exact free-vs-Studio gating of each AI tool is only partly verified (from the readmes and the Studio product page).
- **The shared web-search budget ran out part-way through.** Later gaps were filled only by direct page fetches; a few items that needed a search (noted in Open Questions) were left unresolved rather than guessed.
- pypi.org's OpenTimelineIO page, higgsfield.ai/pricing, and news.adobe.com returned no usable content.

Nothing in this report is legal advice. Licensing verdicts are an engineer's reading of the published texts and should be confirmed by counsel before shipping.

---

## 1. Decision-relevant findings in brief

1. **Every commercial editor now treats generated video as an ordinary clip on a timeline; none of them keeps it "live".** Premiere's Generative Media tool places generated video and sound as editable clips in the sequence `[DOC]` (https://community.adobe.com/announcements-727/what-s-new-in-adobe-premiere-26-5-september-2026-1641187). The clip can be trimmed, graded, and replaced, but its pixels are flattened. `[ASSUMED]`
2. **Agent/MCP control of a professional editor ships today only in DaVinci Resolve Studio.** Resolve 21.1 Studio lists a native MCP server in its readme `[DOC]` (https://www.blackmagicdesign.com/support/content/readme/baf7c071c0524fbf8ccc961925c9f443). Adobe's MCP integrations are described as a preview reaching Creative Cloud customers in early 2027 `[CLAIM]` (https://blog.adobe.com/en/publish/2026/11/10/explore-new-ways-create-across-creative-cloud-adobe-firefly-while-advancing-craft-precision-choice-control).
3. **Resolve moved advanced scripting to the paid Studio edition in 21.1.** `[DOC]` (same readme). Free-tier automation that worked through 21.0 no longer does `[IND]` (https://www.pugetsystems.com/blog/2026/09/10/how-davinci-resolve-free-v21-1-scripting-changes-affect-puget-bench/).
4. **OpenTimelineIO (Apache-2.0) is the one interchange format that all the serious tools now touch**: Premiere `[DOC]` (https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699), Resolve `[IND] (snippet)`, Kdenlive `[DOC]` (https://kdenlive.org/news/2026/state-2026/), and, as of Blender 5.3 released 2026-11-10, Blender's sequencer in an "initial" form `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/sequencer/). It carries cuts, not looks: effects, titles, and animation do not survive `[IND]` (https://www.remotion.dev/docs/export-opentimeline).
5. **Blender is safe to drive as a separate process and unsafe to link.** The Blender manual states the GPL covers the application and not the artwork made with it `[DOC]` (https://docs.blender.org/manual/en/latest/getting_started/about/license.html); the GNU GPL FAQ treats pipes, sockets, and command-line arguments as mechanisms normally used between separate programs `[DOC]` (https://www.gnu.org/licenses/gpl-faq.en.html). Importing `bpy` into a proprietary process, or shipping non-GPL-compatible scripts that import `bpy`, is the thing to avoid `[ASSUMED]`.
6. **A mid-range laptop GPU is roughly 12-18x faster than a mid-range laptop CPU in Cycles** (Blender Open Data medians, Blender 5.2.0: RTX 4060 Laptop 2933 vs. typical H-class CPUs 165-230) `[ASSUMED]` from `[DOC]` data (https://opendata.blender.org). CPU-only Cycles is workable for low-sample conditioning passes, not for final-quality animation.
7. **Remotion is not open source.** Its license requires a paid Company License for for-profit organisations above three employees, and prompt-to-video apps fall under a per-render plan with a monthly minimum `[DOC]` (https://www.remotion.dev/docs/license/pricing). MIT alternatives exist (Revideo, Motion Canvas) `[DOC]` (https://github.com/redotvideo/revideo, https://github.com/motion-canvas/motion-canvas).
8. **CapCut is a dead end for interchange and a risk for content terms.** CapCut's own help page says it does not support import/export of third-party project files `[DOC]` (https://www.capcut.com/help/how-to-export-pro-project); its privacy policy lists training and improving machine-learning models among uses of collected information, with no specific AI-training opt-out described `[DOC]` (https://www.capcut.com/clause/privacy).

---

## 2. Adobe Firefly and Adobe Premiere

### 2.1 Current state (November 2026)

- Adobe MAX 2026 is running 10-12 November 2026 in Miami Beach and online `[CLAIM]` (https://blog.adobe.com/en/publish/2026/11/10/adobe-firefly-premiere-mobile-ways-create-videos-edit-content-perfect-soundtrack-stories). Announcements are one day old; independent verification does not exist yet `[ASSUMED]`.
- Firefly is now positioned as an "AI creative studio" combining Adobe tools, third-party models, and a "Creative Agent" `[CLAIM]` (same URL). Named surfaces: Firefly Video, Firefly Design (beta), Firefly Image, Quick Actions (generally available), Firefly Graph (beta), Firefly Builder (private beta preview) `[CLAIM]` (both MAX posts above).
- The Creative Agent lets a user review the assistant's plan before it runs and either pick a model or let Firefly choose `[CLAIM]` (first MAX post). "Always-on agents" for recurring background tasks were previewed, with a beta planned for early 2027 `[CLAIM]` (same).
- Latest Premiere desktop release found: 26.5 (September 2026) `[DOC]` (https://community.adobe.com/announcements-727/what-s-new-in-adobe-premiere-26-5-september-2026-1641187). The UXP changelog already lists an API version 27.0.0 `[DOC]` (https://developer.adobe.com/premiere-pro/uxp/changelog). Whether a Premiere 27 desktop build shipped at MAX is `[UNKNOWN]`; the MAX posts fetched give no version number.

### 2.2 AI features that actually ship

Premiere desktop:

- **Generative Media tool** (26.5): generates video and sound effects from text prompts; results are editable clips in the sequence; uses Firefly or partner models; existing frames can be used as references `[DOC]` (26.5 announcement URL above).
- Generate Video fills gaps on the timeline using reference frames; Generate SFX can be voice-guided; Soundscape and Music were beta at launch; launch models were Firefly, Veo, Kling, Runway, and Luma `[IND]` (https://nofilmschool.com/adobe-generative-media-tool). The MAX post names the same partner set (Google, Kling, Runway, Luma) `[CLAIM]` (second MAX post).
- **Generative Extend** now supports 360p up to 4K UHD, any aspect ratio, and interlaced or non-square-pixel footage `[DOC]` (26.5 announcement).
- Generative Extend limits: about 2 seconds of video and 10 seconds of audio per extension; it does not extend spoken dialogue; it fails on music; it is unavailable in some countries; it consumes credits `[IND] (snippet)` (Adobe help FAQ, page not fetched - 403).
- **Paper Edit**, Object Mask Sharp/Smooth modes, and new camera-format support (Sony X-OCN, ProRes RAW, ARRICORE) arrived in 26.5 `[DOC]` (26.5 announcement).
- **AI Assistant in Premiere** entered public beta on 18 June 2026 `[DOC]` (https://community.adobe.com/announcements-727/meet-your-new-assistant-editor-ai-assistant-in-premiere-pro-is-now-in-public-beta-1629317) and is still described as beta at MAX `[CLAIM]` (second MAX post). Advertised tasks: organise bins, rename, find interview questions, build rough cuts `[CLAIM]` (https://www.adobe.com/products/premiere.html).
- **Color Mode** went from beta (NAB, April 2026) `[IND]` (https://www.cined.com/adobe-reinvents-color-grading-in-premiere-expands-firefly-with-kling-3-0-and-debuts-frame-io-drive/) to generally available at MAX `[CLAIM]` (second MAX post). **Generative Remove** is beta `[CLAIM]` (same).
- Non-generative AI utilities advertised: transcription, captions, caption translation, auto reframe, dialogue enhancement, separating overlapping voices, subject isolation `[CLAIM]` (https://www.adobe.com/products/premiere.html).

Firefly web:

- **Firefly Boards** is still labelled beta in its own FAQ; it is an infinite canvas with image and video generation, collaboration, and partner models (Gemini, GPT Image, FLUX 1.1, FLUX.1 Kontext, Runway are named) `[DOC]` (https://www.adobe.com/products/firefly/features/moodboard.html).
- **Firefly video editor** (browser timeline) was beta when independently reviewed; the reviewer noted that 4K export is not native 4K, that transparent generated video is not fully supported, and that migration of a full editable timeline to Premiere is not documented `[IND]` (https://josephnilo.com/blog/adobe-firefly-video-editor/). The MAX post says the new tools are in beta apart from Quick Actions `[CLAIM]` (first MAX post).
- Kling 3.0 was added to Firefly in April 2026 `[IND]` (CineD URL above).

Premiere mobile:

- Licensed music from UMG and WMG on iPhone, for personal non-commercial videos only; Android to follow `[CLAIM]` (first MAX post). An AI Assistant with "Quick Cut" is a coming private beta `[CLAIM]` (same).

### 2.3 How generated media enters an editable timeline

- Inside Premiere: the Generative Media tool writes clips straight into the sequence `[DOC]` (26.5 announcement). Generative Extend adds frames/audio at a clip edge `[DOC]` (same).
- From Firefly Boards: Premiere 26.3 (June 2026) added import of a board as a ready-to-edit sequence `[IND] (snippet)`.
- From the Firefly web video editor: a "Send to apps" route to Premiere desktop exists, with some elements unsupported `[IND] (snippet)` (Adobe help page not fetched - 403).
- Net effect: the clip is a normal media file on a track. No evidence was found that prompt, seed, or model parameters travel with the clip in a way an external tool can read, other than Content Credentials metadata `[UNKNOWN]`. The UXP API gained a `C2PAService` in 26.5 `[DOC]` (https://developer.adobe.com/premiere-pro/uxp/changelog).

### 2.4 Interchange

- **OTIO**: import/export was announced in Premiere beta on 23 October 2024, covering clip names, cuts, source in/out, timecode, frame rate, multiple tracks, linear speed changes, and markers; OTIOZ/OTIOD were "under consideration" and After Effects had no plans `[DOC]` (https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699). A third-party doc states Premiere 25.6 or later imports OTIO directly `[IND]` (https://www.remotion.dev/docs/export-opentimeline). The current GA status and feature coverage per Adobe's own help pages is `[UNKNOWN]` (helpx blocked).
- **Final Cut Pro 7 XML (xmeml)** export exists and is still receiving bug reports in 2026 `[IND]` (https://community.adobe.com/bug-reports-728/premiere-xml-exports-semantically-suspicious-transition-ratio-values-for-ol-cross-dissolve-1556968).
- **AAF** export exists and is exposed to plugins from UXP 26.3 `[DOC]` (UXP changelog).
- Native **FCPXML** (the modern Final Cut format): no evidence found `[UNKNOWN]`.
- **EDL** export is long-standing `[ASSUMED]` (not re-verified this session).

### 2.5 Scripting, plugins, agents

- **UXP** is the current plugin platform: public beta at API 25.2.0 (December 2024), official release at 25.6.0, Hybrid Plugins with native `.uxpaddon` components at 26.2.0, breaking changes at 26.3.0 (`Sequence.setSelection` became synchronous, actions must run inside `lockedAccess`), new `EncoderManager`, `ObjectMaskUtils`, AAF export and transcript methods at 26.3.0, `C2PAService`, `MediaManager`, `WorkAreaUtils` at 26.5.0, and 27.0.0 as the newest entry (removes the `Application` class) `[DOC]` (https://developer.adobe.com/premiere-pro/uxp/changelog).
- The changelog contains no API for invoking generative features, no OTIO API, and no MCP surface `[DOC]` (same; this is an absence observed on the fetched page).
- CEP/ExtendScript panels are promised support for at least one more major release cycle `[CLAIM]` (https://www.adobevideopartner.com/customer-stories/extensibility-update/).
- **First-party MCP**: described as "in preview", reaching Creative Cloud customers in early 2027 `[CLAIM]` (second MAX post). Adobe connectors for ChatGPT and Claude exist for some Adobe services `[IND]` (https://www.redsharknews.com/anthropic-claude-creative-connectors-adobe-blender-autodesk). No first-party MCP server for Premiere desktop was found shipping today `[UNKNOWN]`.
- Community MCP servers for Premiere exist (example: https://github.com/leancoderkavy/premiere-pro-mcp) `[IND]`; their quality and safety were not assessed `[UNKNOWN]`.

### 2.6 Pricing and generative credits

Firefly plans `[DOC]` (https://www.adobe.com/products/firefly/plans.html):

| Plan | Price (US, monthly) | Monthly credits | Video guidance on page |
|---|---|---|---|
| Free | $0 | limited daily generations | - |
| Standard | $9.99 | 2,000 | up to 20 five-second videos |
| Pro | $19.99 (promo $9.99 for 6 months) | 4,000 | up to 40 |
| Pro Plus | $49.99 (promo $19.99) | 10,000 | up to 100; Firefly Graph (beta) |
| Pro for teams | $19.99 per license | 4,000 | - |
| Pro Plus for teams | $49.99 per license | 10,000 | - |
| Premium for teams | $199.99 per license | 50,000 | unlimited Firefly Video Model in Generate Video |

- The page's own arithmetic (2,000 credits for up to 20 five-second clips) implies about 100 credits per five-second clip, i.e. about 20 credits per second, for the Firefly video model at whatever resolution the page assumes `[ASSUMED]`.
- Premiere single-app: $22.99/month with 25 generative credits per month; Creative Cloud Pro: $69.99/month (promo $34.99 for three months) with 4,000 credits `[DOC]` (https://www.adobe.com/products/premiere.html).
- 25 credits per month is not enough for meaningful video generation; practical use of Generative Media needs Creative Cloud Pro or a Firefly plan `[ASSUMED]`.
- Partner-model rates read from search summaries: Luma Ray2 Flash 10/25/50/75 credits per second at 540p/720p/1080p/4K; Kling 3.0 about 35 credits per second at 1080p; credits do not roll over `[IND] (snippet)`. Another secondary source gives about 100 credits per second for Firefly video at 1080p, which conflicts with the plan-page arithmetic above; the true per-model table is `[UNKNOWN]` (helpx blocked).
- Trial-and-error generation consumes credits `[IND]` (https://itbrief.com.au/story/adobe-adds-ai-video-tools-to-premiere-after-effects).

### 2.7 Hardware

- Premiere 26.0 minimums as summarised in search results: Windows 11 24H2, AVX2 CPU, 8 GB RAM minimum (16 GB for HD, 32 GB or more for 4K), GPU with 4 GB VRAM minimum (8 GB recommended) `[IND] (snippet)` (Adobe help page not fetched).
- Generative features run in Adobe's cloud, so they need connectivity and credits rather than local GPU `[ASSUMED]`.
- 26.5 added hardware-accelerated 4:2:2 10-bit decode on NVIDIA Blackwell GPUs `[DOC]` (26.5 announcement).

### 2.8 Privacy and training terms

- Adobe states that it does not train Firefly on customer content, that partner-model agreements bar partners from training on customer content, that Firefly models are trained on Adobe Stock, licensed, and public-domain material, and that enterprise plans carry IP indemnification `[CLAIM]` (https://www.adobe.com/ai/overview/firefly/gen-ai-approach.html).
- The binding text (General Terms, generative AI terms, partner-model terms) was not read `[UNKNOWN]`. Whether indemnification extends to partner-model output was not confirmed `[UNKNOWN]`.

### 2.9 Recurring complaints (independent)

- Generative Extend stuck at "Preparing 1%" `[IND]` (https://community.adobe.com/bug-reports-728/generative-extend-stuck-at-preparing-1-1331889).
- "Cancel all" for Generative Extend greyed out in 26.3 `[IND]` (https://community.adobe.com/bug-reports-728/the-cancel-all-button-for-generative-extend-is-greyed-out-and-not-working-1629851).
- Generative Extend rejecting audio it believes contains music `[IND]` (https://community.adobe.com/questions-729/generative-extend-can-t-process-your-audio-check-that-your-audio-clip-doesn-t-contain-music-1558689).
- Clip names reverting on OTIO round trip (user report, March 2026) `[IND] (snippet)`.
- Credit burn from iteration `[IND]` (itbrief URL above).
- Subscription-only pricing remains the structural complaint `[ASSUMED]`.

---

## 3. Blackmagic DaVinci Resolve

### 3.1 Current version

- Resolve 21 was announced at NAB in April 2026 and adds a Photo page `[IND]` (https://www.provideocoalition.com/davinci-resolve-21-announced-with-new-ai-features-and-a-new-photo-page/).
- 21.1 shipped 8 September 2026 `[CLAIM]` (https://www.blackmagicdesign.com/media/partial/release/20260908-03); 21.1.1 on 6 October `[IND]` (https://digitalproduction.com/2026/10/06/davinci-resolve-21-1-1/); 21.1.2 on 27 October `[IND]` (https://digitalproduction.com/2026/10/27/davinci-resolve-21-1-2-ai-ograf-scripting/); 21.2 on 4 November 2026 `[IND]` (https://www.newsshooter.com/2026/11/04/blackmagic-design-davinci-resolve-21-2/).

### 3.2 AI / Neural Engine features that ship

- Resolve 21 AI additions reported from the show floor: IntelliSearch (local media search), CineFocus, IntelliTrack AI, AI voice generation, UltraSharpen, de-aging, slate reading `[IND]` (https://www.cined.com/davinci-resolve-21-hands-on-at-nab-2026-photo-page-intellisearch-and-cinefocus-in-action/).
- IntelliSearch is described as running without cloud dependency `[IND]` (same).
- The free edition's readme lists multiple AI-based tools, voice isolation, and the camera tracker among Studio-only features `[DOC]` (https://www.blackmagicdesign.com/support/content/readme/6aefbffe870f4ba686e61ecb83b19ec0).
- 21.1 adds clip transcriptions with speaker and timing data accessible to scripting `[DOC]` (https://www.blackmagicdesign.com/support/content/readme/baf7c071c0524fbf8ccc961925c9f443).
- No text-to-video or image-to-video generator was found in any Resolve 21.x feature list reviewed `[ASSUMED]` (absence across the pages fetched). Resolve's AI is analysis, restoration, tracking, audio, and assistive editing rather than pixel generation `[ASSUMED]`.

### 3.3 How generated media enters the timeline

- As ordinary imported media. No native generator integration was found `[ASSUMED]`.
- With Studio 21.1+, an external agent can drive the application through the built-in MCP server or the scripting API `[DOC]` (21.1 Studio readme). The press release says assistants can analyse projects, organise media, adjust settings, and batch render `[CLAIM]` (21.1 press release). 21.2 lets assistants download extras and export frames `[IND]` (newsshooter URL above).

### 3.4 Interchange

- Resolve 21 adds import and export of Final Cut Pro 12 FCPXML and DRT timeline import with link/conform options `[DOC]` (free readme URL above).
- OTIO import/export (timeline only or with media) and import of XML, AAF, FCP XML, and EDL are documented in the 18.6 manual `[IND] (snippet)` (mirror: https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1411.htm). The Resolve 21 manual itself was not fetched `[UNKNOWN]` for any 21-specific changes.
- User-reported behaviour (2025): AAF keeps clips linked but loses most effects; FCPXML keeps transitions but leaves clips unlinked; OTIO keeps most metadata but leaves clips unlinked `[IND]` (https://forum.blackmagicdesign.com/viewtopic.php?p=1152861).

### 3.5 Scripting and agent APIs

- 21.1 Studio readme: native MCP server for AI assistants; built-in Python for console scripting; advanced scripting now requires Studio; Python 2 dropped; 20 new scripting APIs per the press release `[DOC]` (21.1 Studio readme) / `[CLAIM]` (press release, for the count).
- Blackmagic's stated reason for the restriction, as relayed by Puget: the API was being used to unlock Studio features in the free edition `[IND]` (Puget URL above). Workarounds: stay on Free 21.0 or buy Studio `[IND]` (same).
- MCP is Studio-only, configured through a "Setup AI Assistants" menu item, with no documented permission model, safeguards, or logging; the free edition keeps console scripting, while Workflow Integrations, UIManager, and external scripting need Studio `[IND]` (https://digitalproduction.com/2026/09/08/resolve-21-1-adds-mcp-and-finally-gets-presets/).
- 21.1.1 adds asynchronous APIs for Quick Export, transcription, scene-cut detection, Smart Reframe, and subtitles `[IND]` (digitalproduction 21.1.1 URL above).
- Security posture of the MCP server (what an agent may delete, overwrite, or render without confirmation) is `[UNKNOWN]`.

### 3.6 Free vs Studio, pricing

- Free: up to 60 fps at UHD, 8-bit. Studio: up to 120 fps and 32K, Neural Engine exclusives, temporal and AI noise reduction, multi-GPU, Python/Lua plus remote scripting and workflow plugins, 10-bit, hardware-accelerated H.264/H.265, Dolby Vision and HDR10+ `[DOC]` (https://www.blackmagicdesign.com/products/davinciresolve/studio).
- The Studio page displayed US$236 with a previous price of $295 when fetched `[DOC]` (same). Other 2026 sources quote $295 `[IND] (snippet)`. Whether $236 is a promotion or a regional rendering is `[UNKNOWN]`.
- It is a one-off licence, not a subscription, and there are no generative credits because there is no cloud generation `[ASSUMED]`.

### 3.7 Hardware

- Free 21 readme, Windows minimums: Windows 10 Creators Update, 16 GB RAM (32 GB when using Fusion), integrated GPU or discrete GPU with at least 4 GB VRAM, OpenCL 1.2 or CUDA 12.8, NVIDIA Studio driver 581.57 or newer `[DOC]` (free readme URL above).
- 21.1 Studio readme: at least 16 GB VRAM for advanced AI tools; at least 32 GB RAM and 12 GB VRAM for background rendering `[DOC]` (21.1 Studio readme).
- Consequence: the advanced AI tools are out of reach on a typical 8 GB mid-range laptop GPU `[ASSUMED]`.

### 3.8 Privacy

- No Blackmagic statement about training on customer media was found `[UNKNOWN]`.
- Third-party coverage describes the Neural Engine tools as local `[IND]` (CineD URL above). When an external assistant is connected over MCP, whatever project data the assistant reads goes to that assistant's provider under that provider's terms `[ASSUMED]`.

### 3.9 Recurring complaints

- Scripting pulled from the free edition in 21.1, breaking existing automation `[IND]` (Puget URL above).
- MCP shipped without documented safeguards `[IND]` (digitalproduction 21.1 URL above).
- Free-tier caps (8-bit, 60 fps UHD, limited H.264/H.265 acceleration) `[IND] (snippet)`.
- A run of point releases with stability and installer fixes after 21.0; projects opened in 21.x not opening in 20.3.x `[IND] (snippet)`.
- High VRAM floor for AI tools `[DOC]` (21.1 Studio readme) - the complaint framing is `[ASSUMED]`.

---

## 4. Blender (deep dive)

### 4.1 Versions

- 5.1 released 17 March 2026; 5.2 LTS released 14 July 2026 and maintained until July 2028; **5.3 released 10 November 2026** `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/, https://developer.blender.org/docs/release_notes/5.2/).
- For a contained worker, 5.2 LTS is the conservative pin; 5.3 is one day old `[ASSUMED]`.

### 4.2 Video Sequence Editor (VSE)

- 5.0: per-workspace sequencer scene, Compositor strip modifier, slip tool `[DOC]` (https://developer.blender.org/docs/release_notes/5.0/sequencer/).
- 5.1: box and ripple options for Blade; strip-timing API renamed, with old names deprecated until 6.0 (`frame_final_duration` to `duration`, `frame_final_start` to `left_handle`, `frame_final_end` to `right_handle`, `frame_offset_start/end` to `left/right_handle_offset`, `frame_duration` to `content_duration`, `frame_start` to `content_start`, `animation_offset_start/end` to `content_trim_start/end`; new `content_end`) `[DOC]` (https://developer.blender.org/docs/release_notes/5.1/sequencer/).
- 5.2: Compositor effect strip, GPU compositor modifiers, text style presets, HDR scopes `[DOC]` (https://developer.blender.org/docs/release_notes/5.2/sequencer/).
- 5.3: ripple editing framework (Ripple Trim, Ripple Delete), Blade 2.0, **initial OpenTimelineIO import and export**, initial hardware decoding (off by default) `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/sequencer/).
- Reading: the VSE is now a credible scriptable assembly timeline, but ripple editing and OTIO are first-release features and the Python strip API is mid-rename, so scripts must target one version `[ASSUMED]`.
- What "initial" OTIO covers (transitions, speed, markers, nested scenes) is `[UNKNOWN]`.

### 4.3 Compositor, EEVEE, Cycles, pipeline

- Compositor 5.3: effects stack in the Properties editor, default tree Group Input to Group Output, File Output default name uses `{blend_name}`, playback caching, Bloom asset, 17 nodes shared with Geometry Nodes `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/compositor/).
- EEVEE 5.3: Vulkan is the default backend on Windows (not ARM) and Linux; minimum Vulkan 1.1; panoramic cameras supported `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/eevee/).
- Cycles 5.3: dispersion in Principled BSDF, DLSS denoiser for viewport (NVIDIA driver 620+), viewport pauses during final renders `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/cycles/).
- Pipeline 5.3: USD collection importer, Gaussian splat import through USD and glTF, Alembic point-cloud export, better multilayer EXR with DWA compression `[DOC]` (https://developer.blender.org/docs/release_notes/5.3/pipeline_io/).
- Geometry Nodes specifics for 5.x were not researched in depth this session `[UNKNOWN]`; the only verified point is the node sharing with the compositor above.

### 4.4 Deterministic controls useful for AI video production

- **Render passes** available as conditioning or compositing inputs: Depth (Cycles, EEVEE, Workbench; not anti-aliased), Mist, Position, Normal, Vector (Cycles and EEVEE; disabled when Cycles motion blur is on), UV / Object Index / Material Index (Cycles only), Grease Pencil, Denoising Data, Cryptomatte (object, material, asset), shader AOVs (EEVEE limit: 16 colour and 16 value), light groups (Cycles only) `[DOC]` (https://docs.blender.org/manual/en/latest/render/layers/passes.html).
- The manual warns that Depth is noisy with depth of field or motion blur and points to Mist as the alternative `[DOC]` (same). For depth-conditioned video models that means: disable DoF and motion blur in the conditioning pass, or use Mist `[ASSUMED]`.
- Cryptomatte gives per-object mattes, which is the deterministic substitute for a segmentation model `[ASSUMED]`.
- **Camera paths, blocking, previs**: animated cameras and proxy geometry are core Blender features `[ASSUMED]` (not separately sourced). A published workflow feeds Blender depth, outline, and pose passes into Wan 2.1 VACE `[CLAIM]` (https://www.runcomfy.com/comfyui-workflows/blender-to-comfyui-ai-renderer-2-0-workflow-cinematic-video-output); ComfyUI documents VACE control inputs `[DOC]` (https://docs.comfy.org/tutorials/video/wan/vace).
- Community sentiment (Reddit, May 2026) treated Blender layout to image to Seedance 2 as previs-grade rather than final `[IND] (snippet)`.
- **Storyboards**: a Storyboarding application template exists in the development manual: each shot is its own scene with a Grease Pencil object and camera, an "Edit" scene is the master timeline, shots default to two seconds `[DOC]` (https://docs.blender.org/manual/en/dev/video_editing/storyboarding/app_template.html). Which stable release first includes it is `[UNKNOWN]`; no export options are described on that page `[DOC]`.
- **Titles and motion graphics**: VSE text strips gained style presets in 5.2 `[DOC]` (5.2 sequencer notes). Text rendered by Blender is exact, which generators cannot guarantee `[ASSUMED]`.
- **Match-move / camera tracking**: 5.2 changes were minor (mask layer move, faster high-resolution playback, timecode files removed) `[DOC]` (https://developer.blender.org/docs/release_notes/5.2/motion_tracking/). A GLOMAP-based "Global" solver exists as a feedback build with mixed tester reports `[IND]` (https://devtalk.blender.org/t/vfx-global-camera-solver-feedback/44802); its release status is `[UNKNOWN]`. Community view is that the built-in tracker is basic next to dedicated tools `[IND] (snippet)`.
- **Compositing**: the compositor can be used as a VSE strip modifier (5.0) and effect strip (5.2), so pass-based comps can sit directly on the edit timeline `[DOC]` (5.0 and 5.2 sequencer notes).

### 4.5 Python API, CLI, headless

- Command-line options documented: `-b` background, `-P` run script, `--python-expr`, `-a`/`-f` render, `-s`/`-e` frame range, `-o` output path, `-E` engine, `-F` format, `-t` threads, `--factory-startup`, `-y`/`-Y` script auto-execution (disabled by default), `--python-exit-code`, `--offline-mode`, `-noaudio`, `--gpu-backend vulkan|opengl|metal`, and after `--`: `--cycles-device CPU|CUDA|OPTIX|HIP|ONEAPI|METAL` `[DOC]` (https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html).
- Arguments execute in the order given, so `-f`/`-a` must come last; options are case-sensitive `[DOC]` (https://docs.blender.org/manual/en/latest/advanced/command_line/render.html).
- `bpy` is published on PyPI: 5.3.0 dated 10 November 2026, GPL-3.0, Python 3.13 only, Windows x86-64 wheel about 356 MB `[DOC]` (https://pypi.org/project/bpy/).

### 4.6 EEVEE vs Cycles on modest hardware, with render-time evidence

Blender Open Data, Blender 5.2.0, median benchmark score (estimated samples per minute summed over the benchmark scenes; higher is better; n = submissions) `[DOC]` (https://opendata.blender.org/about/ and the query endpoint https://opendata.blender.org/benchmarks/query/ with `blender_version=5.2.0`):

| Device | Median score | n |
|---|---|---|
| RTX 3050 Laptop | 970.6 | 66 |
| RTX 3060 Laptop | 1950.8 | 47 |
| RTX 4050 Laptop | 2405.1 | 80 |
| **RTX 4060 Laptop** | **2933.1** | 126 |
| RTX 4070 Laptop | 3425.5 | 42 |
| RTX 5050 Laptop | 2567.5 | 111 |
| RTX 5060 Laptop | 3268.7 | 154 |
| RTX 5070 Laptop | 3994.5 | 71 |
| RTX 4090 (desktop) | 11553.1 | 118 |
| Ryzen 7 5800H (CPU) | 162.6 | 16 |
| Core i7-12700H (CPU) | 176.8 | 21 |
| Core i7-13650HX (CPU) | 210.4 | 21 |
| Ryzen 7 7840HS (CPU) | 217.1 | 8 |
| Ryzen 7 8845HS (CPU) | 231.8 | 14 |
| Core Ultra 7 155H (CPU) | 167.1 | 16 |
| Ryzen AI 9 HX 370 (CPU) | 297.6 | 20 |
| Core i5-12450H (CPU) | 113.6 | 15 |

What that means in practice (all `[ASSUMED]`; derived from the table, not measured):

- An RTX 4060 Laptop GPU is about 12-18x faster than a typical H-class laptop CPU in Cycles.
- Spreading the score over three benchmark scenes gives very roughly 1,000 samples per minute per scene on the 4060 Laptop and 55-75 on the CPUs. At 128 samples plus denoising on a scene of benchmark complexity, expect on the order of 8-15 seconds per frame on the GPU and 2-3 minutes per frame on the CPU.
- A 5-second shot at 24 fps (120 frames) at that quality is therefore about 15-30 minutes on the laptop GPU and 4-6 hours CPU-only.
- Conditioning passes (depth, normal, Cryptomatte, flat-shaded previs) need few samples; at 4-16 samples the same shot is plausibly a few minutes on GPU and tens of minutes on CPU, dominated by per-frame scene sync rather than sampling.
- Laptop thermals and 8 GB VRAM ceilings will pull long jobs below these numbers.

Other data points:

- Notebookcheck lists the RTX 4060 Laptop at about 21-23 seconds for the Classroom scene with OptiX on an older Blender `[IND]` (https://www.notebookcheck.net/NVIDIA-GeForce-RTX-4060-Laptop-GPU-Benchmarks-and-Specs.675692.0.html).
- A retailer blog reports a 250-frame 1080p 128-sample Cycles animation in about 68 minutes on an RTX 4060 (about 16 s/frame) `[IND]` (https://evezone.evetech.co.za/performance-pulse/rtx-5060-blender-performance-benchmark-real-world-test-2026) - low reliability, but consistent with the estimate above `[ASSUMED]`.
- A render-farm vendor quotes about 12 s/frame for a 1080p EEVEE previz example `[CLAIM]` (https://www.superrendersfarm.com/article/eevee-vs-cycles-cloud-render-farm-comparison-2026).
- No trustworthy EEVEE seconds-per-frame measurement on a mid-range laptop was found `[UNKNOWN]`. EEVEE is a rasteriser and is expected to be much faster than Cycles for previs-grade frames, but it needs a working GPU graphics context `[ASSUMED]`.
- Official minimum hardware requirements were not read (blender.org blocked) `[UNKNOWN]`.

Engine choice for a contained worker `[ASSUMED]`: Cycles with `--cycles-device CPU` is the only path that is certain to work with no GPU and no desktop session; Cycles on OptiX is the fast path when an NVIDIA GPU is present; EEVEE is the fast previs path but is the one most likely to fail in a headless Windows context (next section).

### 4.7 Pitfalls of running Blender headless as a contained worker on Windows

- **EEVEE without a display session.** Historical bug reports show EEVEE failing in background mode without a GPU context (https://developer.blender.org/T102845, https://projects.blender.org/blender/blender/issues/85336) `[IND] (snippet)`. A render-farm vendor states EEVEE needs Vulkan or OpenGL 4.3+ and fails without an active desktop session on Windows, that Windows services in Session 0 lack GPU access, and that RDP sessions can hide the GPU `[CLAIM]` (https://irendering.net/eevee-next-headless-dilemma-cloud-render-farm-guide/). Whether EEVEE under the new Vulkan default in 5.3 renders with `-b` from a non-interactive Windows context is `[UNKNOWN]` and must be tested on the target machine.
- **Cycles needs no display.** The manual says rendering from the command line needs no graphical display `[DOC]` (render page URL above); it does not say which engines that covers `[DOC]` (same; absence).
- **Argument order.** `-f`/`-a` placed before `-o`, `-E`, or `-P` silently renders with the wrong settings, because arguments are executed in sequence `[DOC]` (render page).
- **Cycles device selection.** In background mode the compute device is not taken from saved preferences unless a script sets it or `--cycles-device` is passed `[IND] (snippet)` (issue #60618, older). Pass the device explicitly `[ASSUMED]`.
- **`-E` scope.** `-E CYCLES` applies to the active scene only `[IND] (snippet)`; multi-scene files (such as the storyboard template's shot scenes) need the engine set per scene in script `[ASSUMED]`.
- **Exit codes.** Without `--python-exit-code`, a Python exception in the worker script can still leave Blender exiting with success `[ASSUMED]` from `[DOC]` (the option exists for this purpose, arguments page).
- **Auto-execution.** Script auto-execution in .blend files is disabled by default (`-y` enables) `[DOC]` (arguments page). Keep it disabled for untrusted files `[ASSUMED]`.
- **User configuration leakage.** `--factory-startup` avoids user add-ons and preferences changing behaviour `[DOC]` (arguments page; the hygiene recommendation is `[ASSUMED]`).
- **Network.** `--offline-mode` exists to keep the worker from reaching online services such as extensions `[DOC]` (arguments page).
- **Pipes.** A parent that does not drain the child's stdout/stderr can deadlock on a full pipe buffer `[ASSUMED]` (general Windows process behaviour, not Blender-specific).
- **Console.** The Windows `-con` option is ignored with `-b` `[DOC]` (arguments page).
- **Grease Pencil.** Older reports describe Grease Pencil breaking background renders `[IND] (snippet)` (issues #75952, T85546); current status `[UNKNOWN]`.
- **Shader cache and first-frame latency.** GPU shader caches live under the user's local application data, so a fresh sandbox pays compilation on first render `[IND] (snippet)`.
- **API drift.** The 5.1 strip API renames and the 5.3 compositor default-tree change mean a worker script should be pinned to one Blender version `[ASSUMED]` from `[DOC]` (release notes above).

### 4.8 GPL implications: separate process vs linking/bundling

- Blender is GPL; the manual states the license applies to the application and not to artwork created with it, and that a GPL program may not be turned into a proprietary product `[DOC]` (https://docs.blender.org/manual/en/latest/getting_started/about/license.html). The `bpy` wheel is declared GPL-3.0 `[DOC]` (https://pypi.org/project/bpy/). "Version 3 or later" for the application is `[IND] (snippet)` (blender.org license page blocked).
- GNU GPL FAQ: pipes, sockets, and command-line arguments are mechanisms normally used between two separate programs; modules sharing an address space are almost surely a combined work; but exchanging complex internal data structures intimately can still make two processes one program; output of a program is generally not covered; a program written against GPL-covered bindings must be released GPL-compatibly `[DOC]` (https://www.gnu.org/licenses/gpl-faq.en.html).
- Blender's own position that add-ons and scripts using the Blender Python API must be GPL-compatible when distributed is `[IND] (snippet)` (blender.org FAQ blocked).

Verdicts (all `[ASSUMED]`, engineer's reading):

| Pattern | Verdict |
|---|---|
| Host app launches `blender -b -P worker.py -- args`, exchanges JSON/files/CLI arguments, reads rendered frames back | Separate programs. Host app can stay under its own license. Rendered output is not GPL. |
| The `worker.py` that imports `bpy` | Treat as GPL-compatible and publish it if distributed. Keep it thin: data in, frames out. |
| `pip install bpy` and `import bpy` inside the host application's own Python process | Combined work. The distributed host process would need a GPL-compatible license. Avoid for a proprietary or permissively licensed core. |
| Shipping Blender binaries inside your installer | Allowed as aggregation, with GPL obligations for the Blender part: license text and corresponding-source availability. Simpler: detect or download the user's own Blender. |
| Copying Blender source into the project | Makes that code GPL. Do not. |
| Talking to Blender over an MCP socket | Same analysis as pipes/sockets: separate programs, provided the protocol is a narrow command interface and not a dump of internal structures. |

### 4.9 AI add-ons and MCP servers

- An official Blender Lab MCP server was announced alongside Anthropic's Blender connector on 28 April 2026 `[IND]` (https://www.cgchannel.com/?p=175735); Anthropic publishes a tutorial for the connector `[CLAIM]` (https://claude.com/resources/tutorials/using-the-blender-connector-in-claude). A third-party comparison lists versions 1.0.0 (27 April 2026) through 1.0.3 (11 September 2026) and gives conflicting Blender version requirements `[IND]` (https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026). The repository itself was not readable `[UNKNOWN]` for license and exact capabilities.
- The community server (ahujasid/blender-mcp, renamed "MCP for Blender") has a published vulnerability, CVE-2026-10688: code injection through its `execute_blender_code` tool, published 2 June 2026, CVSS v3 5.5 `[DOC]` (https://nvd.nist.gov/vuln/detail/CVE-2026-10688).
- Lesson for any agent-drives-Blender design: an "execute arbitrary Python" tool is the attack surface; a contained worker should accept a declarative job description and not free-form code `[ASSUMED]`.
- Generative add-ons that exist: Pallaidium (generative media inside the VSE; https://github.com/tin2tin/Pallaidium), ComfyUI-BlenderAI-node (https://www.github.com/AIGODLIKE/ComfyUI-BlenderAI-node), StableGen 0.4.0 released 28 October 2026 (https://comfyui-wiki.com/en/news/2026-10-28-stablegen-0-4-0) `[IND]`. Their licenses and maintenance levels were not verified `[UNKNOWN]`.

### 4.10 Interchange summary for Blender

- Scene/asset side: USD, Alembic, glTF, multilayer OpenEXR `[DOC]` (5.3 pipeline notes).
- Edit side: OTIO import/export, initial, from 5.3 `[DOC]` (5.3 sequencer notes). No native FCPXML, AAF, or EDL was seen in the release notes read `[UNKNOWN]`.

---

## 5. CapCut

### 5.1 AI features and Dreamina/Seedance integration

- CapCut's own resource pages describe Seedance 2.0 on PC through a browser AI workspace / AI Design flow, with export capped at HD for desktop workflows `[CLAIM]` (https://www.capcut.com/ideas/seedance-2-0-for-pc, dated 14 May 2026).
- A later page says Pro and Ultra members use Seedance 2.5, billed per second, and that the desktop app is free to download `[CLAIM]` (https://capcut.com/resource/is-capcut-pc-free-for-ai-video-editing, dated 7 August 2026).
- CapCut states that Seedance pricing varies by plan, region, and model, and that Dreamina and CapCut subscriptions and credits do not carry over to each other `[CLAIM]` (https://www.capcut.com/features/dreamina-seedance-price).
- Rollout began March 2026 in Brazil, Indonesia, Malaysia, Mexico, the Philippines, Thailand, and Vietnam, reached the US around April 2026, and was briefly paused over studio copyright complaints `[IND] (snippet)`.
- How a generated clip lands on the CapCut desktop timeline (direct insert vs download and re-import) is not specified on the pages read `[UNKNOWN]`.

### 5.2 Interchange and automation

- CapCut does not support direct import or export of third-party project files, Premiere included; the suggested workaround is to export rendered video or rebuild the edit `[DOC]` (https://www.capcut.com/help/how-to-export-pro-project).
- No XML, AAF, EDL, or OTIO export was found `[IND] (snippet)`.
- No official scripting or automation API was found `[UNKNOWN]`.

### 5.3 Pricing

- Third-party trackers conflict. Reported figures: Pro about $19.99/month with 1,200 AI credits (raised from 550 in April 2026); Ultra about $79/month with 8,645 or 6,830 credits; a Standard tier at $9.99 reportedly not valid on app/PC; a 5-second 9:16 clip costing 60 credits on Seedance 2.0 Fast or 75 on standard; credits usable on web and desktop but not mobile `[IND]` (https://bigvu.tv/blog/capcut-free-vs-pro-what-2026s-restructure-actually-gives-you/, https://www.hooked.so/guides/capcut-updates, https://costbench.com/changelog/capcut-plan-removed-2026-04/, https://www.eesel.ai/en/blog/capcut-pricing).
- No official, region-neutral price table was obtained `[UNKNOWN]`.

### 5.4 Terms and privacy

- Terms of Service (last updated 15 April 2026), section 10: the licence granted on user content is non-exclusive, royalty-free, transferable, sub-licensable, perpetual, and worldwide, for operating, developing, and providing the services, subject to platform settings; it survives termination; it includes use of username, image, and likeness, including in sponsored content; publicity rights are waived `[DOC]` (https://www.capcut.com/clause/terms-of-service).
- The same ToS does not explicitly mention AI training, does not describe an opt-out, and does not settle ownership of AI output; the default contracting entity is Bytedance Pte. Ltd. under Singapore law; US users fall under a separate US ToS `[DOC]` (same). The US ToS was not fetched `[UNKNOWN]`.
- Privacy Policy (15 April 2026): collects user content, prompts, and AI outputs; content may be pre-uploaded at creation or import whether or not it is saved or published; lists training, testing, and improving machine-learning models among uses; describes no specific AI-training opt-out; lists servers in Malaysia, Singapore, and the US `[DOC]` (https://www.capcut.com/clause/privacy).
- Critical readings of these terms come mainly from competitors with a commercial interest `[IND]` (https://async.com/blog/capcut-terms-of-service/, https://podcastle.ai/blog/capcut-terms-of-service).

### 5.5 Regional availability

- Removed from US app stores in January 2025 and later restored; the TikTok USDS Joint Venture closed 22 January 2026 and is reported to cover CapCut `[IND]` (https://www.socialmediatoday.com/news/tiktok-confirms-joint-venture-to-comply-with-us-law/810318/, https://www.hooked.so/guides/is-capcut-getting-banned).
- Banned in India since 29 June 2020 `[IND]` (https://www.miracamp.com/learn/capcut/ban).

### 5.6 Hardware, desktop vs web

- No official system-requirements page was found; third-party guides say Windows 10/11, 4-8 GB RAM, integrated graphics `[IND] (snippet)` (low reliability).
- Generation runs in ByteDance's cloud; the desktop app is the editor and the AI workspace is browser-based `[CLAIM]` (CapCut resource pages above).

### 5.7 Recurring complaints

- Features moving behind Pro, price rises, and an outage in January 2026 `[IND]` (https://piunikaweb.com/2026/01/27/capcut-pro-price-increase-100-dollars-outage/).
- Billing and cancellation trouble `[IND]` (https://ca.trustpilot.com/review/www.capcut.com).
- Export blocked when a Pro feature is on the timeline, which CapCut's own help page confirms as designed behaviour `[DOC]` (https://www.capcut.com/help/join-capcut-pro-for-exporting).

---

## 6. Editors vs pure AI generators

Reference point for a generator: Runway lists Free (125 one-time credits), Standard $15/month (625 credits), Pro $35/month (2,250), Max $95/month (9,500; HDR, ProRes, and image-sequence export on Max); Gen-4.5 at 60 credits per 5 seconds; it also resells third-party models such as Kling and Seedance `[DOC]` (https://runway.com/pricing). Higgsfield's pricing page returned no content `[UNKNOWN]`; both are covered in depth in companion reports.

What a professional editor gets from Premiere/Resolve/Blender that a generator does not (synthesis, `[ASSUMED]` unless a source is cited above):

- A frame-accurate, multi-track, non-destructive timeline in which a generated clip is one source among camera footage, graphics, and audio.
- Interchange with other departments (OTIO, AAF, FCPXML, EDL) - sections 2.4, 3.4.
- Colour management, HDR and 10-bit pipelines, delivery codecs - section 3.6.
- Audio post: dialogue cleanup, voice isolation, mixing, ducking.
- Deterministic, repeatable renders and scriptable batch output - sections 3.5, 4.5.
- Local processing options (Resolve, Blender) where no media leaves the machine.
- Exact text, exact timing, exact camera.

What generators give that editors do not:

- The pixels themselves. Resolve has no generator; Premiere's are metered partner calls - sections 2.2, 3.2.
- Earliest access to new models and model-specific controls (references, character consistency, camera presets); an editor's partner list lags and exposes fewer parameters `[ASSUMED]`.
- No local hardware requirement.
- API-first access. Premiere's UXP has no generative API - section 2.5.

Strategic reading `[ASSUMED]`: the incumbents are converging on "generator as a clip source inside a timeline" (Adobe) and "agent as an operator of the editor" (Blackmagic). Neither yet offers an open, inspectable record that ties a clip on the timeline to the prompt, model, seed, and references that produced it. That provenance-plus-editability layer is the gap.

---

## 7. Open-source building blocks

Verdict vocabulary: **Vendor** = safe to copy source into a proprietary or permissive project with notices; **Link** = safe to link (conditions noted); **Invoke-only** = run as a separate process, do not link or copy; **Avoid/verify** = licensing unclear or commercial. All verdicts are `[ASSUMED]` readings of license texts that are themselves `[DOC]` at the URL given unless marked otherwise. Star counts are as displayed on the access date.

| Name | Purpose | License | Maturity | Verdict | Notes and source |
|---|---|---|---|---|---|
| OpenTimelineIO | Editorial timeline interchange format and API (C++ core, Python binding) | Apache-2.0 | README calls it mature with stable API, yet releases are still labelled "Beta 18.1" (Nov 2025); ASWF project; 2.1k stars | Vendor / Link | Core formats .otio/.otioz/.otiod. FCP XML, AAF, and CMX3600 EDL adapters live in separate repos / plugin package since v0.16; check each adapter's license. `[DOC]` https://github.com/AcademySoftwareFoundation/OpenTimelineIO |
| MLT | Multitrack media framework behind Shotcut and Kdenlive; `melt` CLI | LGPL-2.1 core; some modules and `melt` are GPL | Mature; 1.9k stars | Link (dynamic, GPL modules excluded) or Invoke-only (`melt`) | GPL-flagged modules include melt, movit, plusgpl, qt, resample, rubberband, vid.stab, xine. `[DOC]` https://github.com/mltframework/mlt , https://www.mltframework.org/docs/install/ |
| Shotcut | Desktop NLE on Qt 6 + MLT | GPL-3.0 | Mature, frequent 2026 releases; 15.7k stars | Invoke-only / reference | 26.6 added experimental OpenFX and HDR `[IND] (snippet)`. `[DOC]` https://github.com/mltframework/shotcut |
| Kdenlive | Desktop NLE on MLT + KDE Frameworks 6 | GPL-3.0 | Mature; small team (8 core members, 2 developers); 26.08 released Aug 2026 | Invoke-only / reference | OTIO import/export rewritten in C++ (25.04); SAM2 object segmentation. `[DOC]` https://github.com/KDE/kdenlive , https://kdenlive.org/news/2026/state-2026/ |
| Olive | Node-based NLE | GPL-3.0 | README says alpha and unstable; last commits Dec 2024; 9.2k stars | Avoid as dependency | Effectively stalled `[ASSUMED]`. `[DOC]` https://github.com/olive-editor/olive , https://github.com/olive-editor/olive/commits/master |
| FFmpeg | Decode/encode/filter/mux | LGPL-2.1+ by default; GPL-2+ when built with `--enable-gpl`; unredistributable with `--enable-nonfree` | Mature, ubiquitous | Link dynamically to an LGPL build, or Invoke-only | See 7.1. `[DOC]` https://www.ffmpeg.org/legal.html , https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md |
| GStreamer + GES | Pipeline framework; GES adds timeline/layers/clips and `ges-launch-1.0` | LGPL (core and GES); some plugins link GPL libraries | Mature | Link (dynamic), audit plugin set | OTIO support not mentioned on pages read `[UNKNOWN]`. `[DOC]` https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html , https://gstreamer.freedesktop.org/documentation/gst-editing-services/index.html |
| Remotion | React-based programmatic video | **Remotion License (source-available, not open source)** | Mature, commercial | Do not vendor or fork; use only under its license | See 7.2. `[DOC]` https://github.com/remotion-dev/remotion/blob/main/LICENSE.md , https://www.remotion.dev/docs/license/pricing |
| Revideo | Programmatic video in TypeScript, headless `renderVideo()` | MIT | Active; repo now redirects to a "midrender" org; 4.2k stars | Vendor / Link | Motion Canvas lineage is `[ASSUMED]` (not stated on current README). `[DOC]` https://github.com/redotvideo/revideo |
| Motion Canvas | Generator-based TypeScript animation library with editor | MIT | Mature for animation; 19.8k stars | Vendor / Link | `[DOC]` https://github.com/motion-canvas/motion-canvas |
| OpenFX | Visual-effects plug-in API standard | BSD-3-Clause | Mature standard (ASWF); 588 stars | Vendor / Link | Individual plug-ins carry their own licenses. `[DOC]` https://github.com/AcademySoftwareFoundation/openfx |
| OpenColorIO | Colour management | BSD-3-Clause | Mature (ASWF); 2.1k stars | Vendor / Link | `[DOC]` https://github.com/AcademySoftwareFoundation/OpenColorIO |
| OpenEXR | HDR multilayer image format | BSD-3-Clause | Mature (ASWF); 1.9k stars | Vendor / Link | `[DOC]` https://github.com/AcademySoftwareFoundation/openexr |
| OpenUSD | Scene description and composition | Tomorrow Open Source Technology License 1.0 (Apache-2.0 text with a modified trademark section) | Mature; v26.11 branch; 7.6k stars | Link with notices | Bundles third-party code under Apache/MIT/BSD/Boost terms. `[DOC]` https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt |
| Natron | Node compositor with Python and batch rendering | GPL-2.0 ("or later" not confirmed) | Low maintenance; README asks for maintainers; latest full release 2.5.0; 5.7k stars | Invoke-only; do not depend on | `[DOC]` https://github.com/NatronGitHub/Natron , https://github.com/NatronGitHub/Natron/releases |
| Editly | Declarative Node.js video assembly over ffmpeg | MIT | Single maintainer; 5.6k stars | Vendor | FFmpeg rules still apply to the binary it calls. `[DOC]` https://github.com/mifi/editly |
| Etro | Browser TypeScript video-editing library with GLSL effects | GPL-3.0 | Small; 1.2k stars | Do not link into non-GPL code | A browser bundle that includes it is a combined work `[ASSUMED]`. `[DOC]` https://github.com/etro-js/etro |
| Diffusion Studio core | Browser compositing engine on WebCodecs | LICENSE file is MPL-2.0, but README describes a watermark removed by a purchased license key | Active; 1.3k stars | Avoid/verify | A search summary says v2.x source is under a separate commercial/non-commercial license `[IND] (snippet)`; conflict unresolved `[UNKNOWN]`. `[DOC]` https://github.com/diffusionstudio/core , https://raw.githubusercontent.com/diffusionstudio/core/main/LICENSE |
| Omniclip | Browser video editor on WebCodecs | MIT | Active, 2.0 in development; 1.5k stars | Vendor | `[DOC]` https://github.com/omni-media/omniclip |
| OpenCut | Open-source CapCut-style editor | MIT | In flux: being rewritten around a Rust core; classic repo is the usable one; not taking outside contributions yet; 98.1k stars | Vendor (license), unstable target | Roadmap mentions editor API, plugins, MCP server, headless mode - none shipped `[DOC]`. https://github.com/OpenCut-app/OpenCut |
| libopenshot | C++ video editing library with Python/Ruby bindings | LGPL-3.0-or-later; commercial licenses offered | Mature; 1.6k stars | Link (dynamic, LGPLv3 terms) or Invoke | `[DOC]` https://github.com/OpenShot/libopenshot |
| mp4box.js | MP4 parsing and segmentation in JS | BSD-3-Clause | Mature; 2.5k stars | Vendor / Link | `[DOC]` https://github.com/gpac/mp4box.js |
| Mediabunny | TypeScript mux/demux/convert on WebCodecs; server package for Node/Bun/Deno | MPL-2.0 | Active; 7.5k stars | Link / Vendor with care | File-level copyleft: modified Mediabunny files must stay MPL and be published. `[DOC]` https://github.com/Vanilagy/mediabunny |
| WebAV | WebCodecs clip/canvas/recorder libraries | MIT | Active; commercial "Pro" edition exists; 2.1k stars | Vendor | `[DOC]` https://github.com/WebAV-Tech/WebAV |
| OpenReel Video | Browser editor (React, Mediabunny, WebCodecs, WebGPU) | MIT | Young; desktop alpha; 5.6k stars | Vendor | `[DOC]` https://github.com/Augani/openreel-video |
| Twick | React timeline/editor SDK | Sustainable Use License (source-available) | - | Avoid/verify | `[IND] (snippet)`; license not fetched. |
| OpenVideo | Browser video editor | Unclear; AGPL-3.0 reported | - | Avoid/verify | `[IND] (snippet)`; not fetched. |
| Blender (as a component) | 3D, compositor, VSE, renderers | GPL (bpy wheel declares GPL-3.0) | Mature; 5.3 current, 5.2 LTS | Invoke-only | See 4.8. `[DOC]` https://pypi.org/project/bpy/ |

### 7.1 FFmpeg: LGPL vs GPL build implications

- Default FFmpeg is LGPL-2.1-or-later; enabling GPL parts makes the whole build GPL `[DOC]` (https://www.ffmpeg.org/legal.html).
- `--enable-gpl` is required for libx264, libx265, libxvid, libvidstab, librubberband, frei0r, and a list of filters (delogo, eq, hqdn3d, boxblur, cropdetect, perspective, and others) `[DOC]` (https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md).
- `--enable-version3` upgrades to LGPLv3/GPLv3 for certain libraries; `--enable-nonfree` (for example fdk-aac) produces a binary that may not be redistributed `[DOC]` (same).
- FFmpeg's LGPL compliance checklist: build without `--enable-gpl` and `--enable-nonfree`; link dynamically; publish the exact source and configure line; credit FFmpeg in the about box and EULA; do not forbid reverse engineering; do not rename the libraries to hide them `[DOC]` (legal page).
- No commercial license is sold; patent licensing for codecs is a separate question from copyright licensing `[DOC]` (legal page).
- Practical consequences `[ASSUMED]`:
  - An LGPL build has no libx264/libx265. H.264/HEVC encoding then has to come from OS or hardware encoders (Media Foundation, NVENC, QSV, AMF) or from a permissively licensed encoder.
  - Many "full" Windows builds found online are GPL builds. Shipping one makes the shipped FFmpeg GPL (fine as a separate executable, with source offer), but it must not be linked into non-GPL code.
  - Invoking `ffmpeg.exe` as a child process keeps the host application's license independent under either build; the redistribution obligations for the FFmpeg binary still apply.
  - Recording the exact build configuration in the product's third-party notices is the simplest way to stay accurate.

### 7.2 Remotion license terms

- Free for individuals, for-profit organisations with up to three employees, non-profits, and evaluation `[DOC]` (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
- Otherwise a Company License: "Automators" at $0.01 per render with a $100/month minimum (the tier that covers video editors, prompt-to-video apps, and embedding the Player); "Creators" at $25 per seat per month; Enterprise from $500/month `[DOC]` (https://www.remotion.dev/docs/license/pricing).
- Prohibited: copying or modifying Remotion code to sell or license a derivative of Remotion itself; letting end users upload their own Remotion code to your service; contractor and client head-counts aggregate; the license is expected to change slightly in 5.0 `[DOC]` (https://www.remotion.dev/docs/license/faq).
- Remotion's own OTIO page says deterministic export to OTIO is not possible: an agent skill reconstructs a timeline; only video, audio, and image elements become native clips; text, shapes, animations, effects, transitions, playback-rate changes, and volume curves need pre-rendered fallbacks (transparent ProRes 4444 overlays, WAV stems) `[DOC]` (https://www.remotion.dev/docs/export-opentimeline).
- Consequence for an accurately licensed project `[ASSUMED]`: Remotion can be an optional, user-licensed renderer behind an adapter; it cannot be vendored, and a product whose core depends on it inherits a metered third-party fee.

---

## 8. Where deterministic editing beats model quality

All items are `[ASSUMED]` judgments; the supporting facts are cited where they exist.

1. **Text on screen.** Titles, captions, lower thirds, legal lines, prices, and product names must be exact and re-editable. VSE text strips, Premiere captions, and any HTML/canvas renderer produce exact glyphs every time; a generator may misspell or drift between frames. Fixing one character deterministically is a re-render of a layer, not a re-roll of a shot.
2. **Cut timing and ripple.** Moving an edit by two frames, tightening a pause, or re-ordering shots is a timeline operation with a guaranteed result. Blender 5.3 added ripple trim/delete `[DOC]` (5.3 sequencer notes); Premiere and Resolve have long had it. No model re-generation is needed, and nothing else in the programme changes.
3. **Extending by a few frames vs regenerating.** Generative Extend exists precisely because editors need a handful of extra frames; it is capped at about 2 seconds `[IND] (snippet)`. A slip, a speed ramp, or a freeze frame is deterministic and free; use generation only when those fail.
4. **Camera motion.** A Blender camera path is a curve with numbers: the same dolly speed and focal length on every take, and across shots that must match. Prompted camera moves are approximate and vary per seed. Rendering depth/normal/outline passes from that camera and using them as conditioning carries the determinism into the generated shot (section 4.4).
5. **Masks and segmentation.** Cryptomatte from a 3D scene is exact per object `[DOC]` (passes page). A segmentation model on generated footage is an estimate that flickers at edges.
6. **Colour.** A LUT, an OCIO transform, or a node grade applies identically to every frame and every version. Asking a model to "make it warmer" changes content along with colour.
7. **Audio.** Level, ducking under dialogue, crossfades, loudness normalisation, and sync are arithmetic. Generated music and effects should arrive as stems and be mixed deterministically. Premiere's partner music and Premiere mobile's licensed catalogue have usage restrictions that are metadata problems, not model problems `[CLAIM]` (first MAX post).
8. **Versioning and reframing.** 16:9, 9:16, and 1:1 deliverables, language versions, and cut-downs are conform operations on one master timeline. Re-prompting per aspect ratio yields different shots.
9. **Compositing and clean-up.** Logo placement, screen replacement, and product packshots composited over generated plates stay pixel-exact; brand assets should never pass through a diffusion model.
10. **Repeatability and audit.** A deterministic render from a saved project gives the same output next month. A generator with a changed model version does not. For regulated or client-approved work, the approved pixels have to be reproducible.
11. **Cost control.** Deterministic operations cost local compute. Every generative retry spends credits `[IND]` (itbrief URL above).
12. **Conform of mixed sources.** Camera footage, screen recordings, stock, and generated clips at different frame rates and colour spaces are reconciled by the editor's conform engine, not by a model.

Rule of thumb: generate the pixels that cannot be shot or built; do everything that can be expressed as a parameter (time, position, colour, level, text) in a deterministic layer above them.

---

## 9. What must remain flattened media regardless of tooling

All items are `[ASSUMED]` conclusions drawn from the cited behaviour.

1. **Generated video pixels.** Lighting, performance, camera motion, and physics inside a generated clip are baked. No editor exposes them as parameters after the fact. The only "edits" are re-generation, video-to-video passes, or 2D operations on top.
2. **Generative Extend and generative fill/remove results.** They are rendered media attached to a clip; they cannot be re-derived offline or in another application.
3. **Generated audio.** Music, soundscapes, voice, and SFX arrive as rendered waveforms. Keep them as separate stems; they do not become MIDI or multitrack sessions.
4. **Model-internal state.** Seeds, latents, and reference embeddings are not portable across vendors, and often not across versions of the same model. Store prompt, model name and version, seed (if exposed), and reference assets as sidecar metadata, and expect it to be documentation, not a guarantee of reproduction.
5. **Anything crossing an interchange boundary with effects on it.** OTIO, AAF, FCPXML, and EDL carry cuts, source ranges, and simple transitions; effects and looks are lost or approximated `[IND]` (Blackmagic forum URL in 3.4). Titles, animated graphics, and composites must be pre-rendered (with alpha where needed) before hand-off - the same conclusion Remotion documents for its own OTIO export `[DOC]` (https://www.remotion.dev/docs/export-opentimeline).
6. **Web-rendered motion graphics.** React/canvas/WebGL compositions (Remotion, Revideo, Motion Canvas) are code in their own runtime and frames everywhere else.
7. **3D renders.** Once out of Blender, a shot is frames. Multilayer EXR passes preserve some re-lighting and re-grading latitude, but geometry and camera are gone unless USD/Alembic travels alongside.
8. **CapCut projects.** With no project interchange `[DOC]` (CapCut help URL in 5.2), anything made in CapCut leaves only as a rendered file.
9. **Third-party plug-in effects.** OpenFX or vendor-specific effects do not translate between hosts; render them in.
10. **Licensed or restricted assets.** Premiere mobile's UMG/WMG music is limited to personal non-commercial use `[CLAIM]` (first MAX post). Such assets should be flattened only into deliverables whose use matches the licence, and tracked.

Design implication: treat every generated or externally rendered element as an immutable media asset with a provenance record, and keep the editable representation (timeline, text, timing, colour, mix, camera data) in an open structure above it.

---

## 10. Open questions

1. Is OTIO import/export generally available in current Premiere releases, and what exactly round-trips? (helpx blocked) `[UNKNOWN]`
2. Did a Premiere 27 desktop build ship at MAX 2026, and what does Adobe's MCP preview expose (read-only project inspection or timeline mutation)? `[UNKNOWN]`
3. Adobe's authoritative per-model credit table for video, and whether IP indemnification covers partner-model output. `[UNKNOWN]`
4. Does any metadata identifying prompt/model/seed travel with a Premiere-generated clip beyond Content Credentials? `[UNKNOWN]`
5. Resolve 21: the exact list of AI tools available in the free edition, and the current interchange list in the 21 manual. `[UNKNOWN]`
6. Resolve MCP server: permission model, confirmation prompts, logging, and whether it can be bound to localhost only. `[UNKNOWN]`
7. Resolve Studio price: is $236 a promotion, and for how long? `[UNKNOWN]`
8. Blackmagic's position on training with customer media. `[UNKNOWN]`
9. Blender 5.3: does EEVEE render with `-b` under the Vulkan default from a non-interactive Windows process (service, scheduled task, sandbox)? Needs a test on the target machine. `[UNKNOWN]`
10. Blender 5.3 OTIO: coverage of the "initial" implementation. `[UNKNOWN]`
11. Blender Lab MCP server: license, tool list, and whether it exposes arbitrary code execution like the community server. `[UNKNOWN]`
12. EEVEE seconds-per-frame on a mid-range laptop for previs scenes; official Blender minimum hardware. `[UNKNOWN]`
13. Release status of the GLOMAP-based camera solver. `[UNKNOWN]`
14. CapCut: official price table, the US Terms of Service text, and how Seedance output reaches the desktop timeline. `[UNKNOWN]`
15. Diffusion Studio core: which license actually governs the current source. `[UNKNOWN]`
16. Licenses of the OTIO adapter plugins (AAF in particular) and whether GES reads or writes OTIO. `[UNKNOWN]`
17. Natron: "GPL-2.0-or-later" vs "only", and whether maintenance has resumed. `[UNKNOWN]`

---

## 11. Sources (all accessed 2026-11-11)

Adobe
- https://www.adobe.com/products/firefly/plans.html
- https://www.adobe.com/products/premiere.html
- https://www.adobe.com/products/firefly/features/moodboard.html
- https://www.adobe.com/ai/overview/firefly/gen-ai-approach.html
- https://community.adobe.com/announcements-727/what-s-new-in-adobe-premiere-26-5-september-2026-1641187
- https://community.adobe.com/announcements-727/meet-your-new-assistant-editor-ai-assistant-in-premiere-pro-is-now-in-public-beta-1629317
- https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699
- https://community.adobe.com/bug-reports-728/generative-extend-stuck-at-preparing-1-1331889
- https://community.adobe.com/bug-reports-728/the-cancel-all-button-for-generative-extend-is-greyed-out-and-not-working-1629851
- https://community.adobe.com/questions-729/generative-extend-can-t-process-your-audio-check-that-your-audio-clip-doesn-t-contain-music-1558689
- https://community.adobe.com/bug-reports-728/premiere-xml-exports-semantically-suspicious-transition-ratio-values-for-ol-cross-dissolve-1556968
- https://developer.adobe.com/premiere-pro/uxp/changelog
- https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development
- https://www.adobevideopartner.com/customer-stories/extensibility-update/
- https://blog.adobe.com/en/topics/adobe-max
- https://blog.adobe.com/en/publish/2026/11/10/adobe-firefly-premiere-mobile-ways-create-videos-edit-content-perfect-soundtrack-stories
- https://blog.adobe.com/en/publish/2026/11/10/explore-new-ways-create-across-creative-cloud-adobe-firefly-while-advancing-craft-precision-choice-control
- https://nofilmschool.com/adobe-generative-media-tool
- https://itbrief.com.au/story/adobe-adds-ai-video-tools-to-premiere-after-effects
- https://josephnilo.com/blog/adobe-firefly-video-editor/
- https://www.cined.com/adobe-reinvents-color-grading-in-premiere-expands-firefly-with-kling-3-0-and-debuts-frame-io-drive/
- https://venturebeat.com/technology/adobes-new-firefly-ai-assistant-wants-to-run-photoshop-premiere-illustrator-and-more-from-one-prompt
- https://www.redsharknews.com/anthropic-claude-creative-connectors-adobe-blender-autodesk
- https://github.com/leancoderkavy/premiere-pro-mcp
- Not fetchable: helpx.adobe.com (HTTP 403 on all URLs); news.adobe.com (no content)

DaVinci Resolve
- https://www.blackmagicdesign.com/products/davinciresolve/studio
- https://www.blackmagicdesign.com/support/content/readme/6aefbffe870f4ba686e61ecb83b19ec0 (Resolve 21 free readme)
- https://www.blackmagicdesign.com/support/content/readme/baf7c071c0524fbf8ccc961925c9f443 (Resolve Studio 21.1 readme)
- https://www.blackmagicdesign.com/media/partial/release/20260908-03
- https://www.pugetsystems.com/blog/2026/09/10/how-davinci-resolve-free-v21-1-scripting-changes-affect-puget-bench/
- https://digitalproduction.com/2026/09/08/resolve-21-1-adds-mcp-and-finally-gets-presets/
- https://digitalproduction.com/2026/10/06/davinci-resolve-21-1-1/
- https://digitalproduction.com/2026/10/27/davinci-resolve-21-1-2-ai-ograf-scripting/
- https://www.newsshooter.com/2026/11/04/blackmagic-design-davinci-resolve-21-2/
- https://www.cgchannel.com/2026/09/blackmagic-design-releases-resolve-21-1/
- https://www.cined.com/davinci-resolve-21-hands-on-at-nab-2026-photo-page-intellisearch-and-cinefocus-in-action/
- https://www.provideocoalition.com/davinci-resolve-21-announced-with-new-ai-features-and-a-new-photo-page/
- https://forum.blackmagicdesign.com/viewtopic.php?p=1152861
- https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1411.htm (snippet only)
- Not readable: "DaVinci Resolve Studio 21 Features" PDF (binary, no text extraction available)

Blender
- https://developer.blender.org/docs/release_notes/5.3/ and /5.2/
- https://developer.blender.org/docs/release_notes/5.0/sequencer/ , /5.1/sequencer/ , /5.2/sequencer/ , /5.3/sequencer/
- https://developer.blender.org/docs/release_notes/5.3/compositor/ , /5.3/eevee/ , /5.3/cycles/ , /5.3/pipeline_io/
- https://developer.blender.org/docs/release_notes/5.2/motion_tracking/
- https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- https://docs.blender.org/manual/en/latest/advanced/command_line/render.html
- https://docs.blender.org/manual/en/latest/render/layers/passes.html
- https://docs.blender.org/manual/en/latest/getting_started/about/license.html
- https://docs.blender.org/manual/en/dev/video_editing/storyboarding/app_template.html
- https://pypi.org/project/bpy/
- https://opendata.blender.org/about/ and https://opendata.blender.org/benchmarks/query/ (Blender 5.2.0, grouped by device, JSON response)
- https://www.gnu.org/licenses/gpl-faq.en.html
- https://nvd.nist.gov/vuln/detail/CVE-2026-10688
- https://devtalk.blender.org/t/vfx-global-camera-solver-feedback/44802
- https://claude.com/resources/tutorials/using-the-blender-connector-in-claude
- https://www.cgchannel.com/?p=175735
- https://www.strayspark.studio/blog/official-blender-mcp-server-comparison-2026
- https://www.notebookcheck.net/NVIDIA-GeForce-RTX-4060-Laptop-GPU-Benchmarks-and-Specs.675692.0.html
- https://evezone.evetech.co.za/performance-pulse/rtx-5060-blender-performance-benchmark-real-world-test-2026
- https://www.superrendersfarm.com/article/eevee-vs-cycles-cloud-render-farm-comparison-2026
- https://irendering.net/eevee-next-headless-dilemma-cloud-render-farm-guide/
- https://docs.comfy.org/tutorials/video/wan/vace
- https://www.runcomfy.com/comfyui-workflows/blender-to-comfyui-ai-renderer-2-0-workflow-cinematic-video-output
- https://github.com/tin2tin/Pallaidium
- https://www.github.com/AIGODLIKE/ComfyUI-BlenderAI-node
- https://comfyui-wiki.com/en/news/2026-10-28-stablegen-0-4-0
- Not fetchable: blender.org (license, FAQ, requirements, lab pages) and projects.blender.org (403 / Cloudflare challenge, not bypassed); developer.blender.org/docs/handbook/guidelines/license/ (404)

CapCut
- https://www.capcut.com/clause/terms-of-service
- https://www.capcut.com/clause/privacy
- https://www.capcut.com/help/how-to-export-pro-project
- https://www.capcut.com/help/join-capcut-pro-for-exporting
- https://www.capcut.com/ideas/seedance-2-0-for-pc
- https://capcut.com/resource/is-capcut-pc-free-for-ai-video-editing
- https://www.capcut.com/features/dreamina-seedance-price
- https://bigvu.tv/blog/capcut-free-vs-pro-what-2026s-restructure-actually-gives-you/
- https://www.hooked.so/guides/capcut-updates
- https://www.hooked.so/guides/is-capcut-getting-banned
- https://costbench.com/changelog/capcut-plan-removed-2026-04/
- https://www.eesel.ai/en/blog/capcut-pricing
- https://www.socialmediatoday.com/news/tiktok-confirms-joint-venture-to-comply-with-us-law/810318/
- https://www.miracamp.com/learn/capcut/ban
- https://piunikaweb.com/2026/01/27/capcut-pro-price-increase-100-dollars-outage/
- https://ca.trustpilot.com/review/www.capcut.com
- https://async.com/blog/capcut-terms-of-service/
- https://podcastle.ai/blog/capcut-terms-of-service

Open-source components
- https://github.com/AcademySoftwareFoundation/OpenTimelineIO
- https://github.com/mltframework/mlt and https://www.mltframework.org/docs/install/
- https://github.com/mltframework/shotcut
- https://github.com/KDE/kdenlive and https://kdenlive.org/news/2026/state-2026/
- https://github.com/olive-editor/olive and https://github.com/olive-editor/olive/commits/master
- https://www.ffmpeg.org/legal.html and https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
- https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html
- https://gstreamer.freedesktop.org/documentation/gst-editing-services/index.html
- https://gstreamer.freedesktop.org/documentation/tools/ges-launch.html
- https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
- https://www.remotion.dev/docs/license/pricing
- https://www.remotion.dev/docs/license/faq
- https://www.remotion.dev/docs/export-opentimeline
- https://github.com/redotvideo/revideo
- https://github.com/motion-canvas/motion-canvas
- https://github.com/AcademySoftwareFoundation/openfx
- https://github.com/AcademySoftwareFoundation/OpenColorIO
- https://github.com/AcademySoftwareFoundation/openexr
- https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt
- https://github.com/NatronGitHub/Natron and https://github.com/NatronGitHub/Natron/releases
- https://github.com/mifi/editly
- https://github.com/etro-js/etro
- https://github.com/diffusionstudio/core and https://raw.githubusercontent.com/diffusionstudio/core/main/LICENSE
- https://github.com/omni-media/omniclip
- https://github.com/OpenCut-app/OpenCut
- https://github.com/OpenShot/libopenshot
- https://github.com/gpac/mp4box.js
- https://github.com/Vanilagy/mediabunny
- https://github.com/WebAV-Tech/WebAV
- https://github.com/Augani/openreel-video

Generators (baseline only)
- https://runway.com/pricing
- Not fetchable: higgsfield.ai/pricing (no content returned)
