# Competitive capability matrix

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document places what surveyed products document about themselves beside what Yamakan's code
does today. It supports the thesis and hypotheses in
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md); provider choices are in
[07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md), measurement in
[10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md), and the cards named here in
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md). The existing `docs/COMPETITOR_MATRIX.md` (retrieved
2026-10-11) is older; MPR-002 gives it a dated status banner instead of editing it.

## 1. How to read this

**What the research was.** Desk research in November 2026: external sources accessed on 2026-11-11
through an automated fetch-and-summarise tool; Yamakan code re-checked on 2026-11-12. Unreadable
pages (Higgsfield and Kling pricing, Adobe's help centre, blender.org) leave `[UNKNOWN]` cells. The
search budget ran out part-way, so independent coverage of Luma, Pika and newer platforms is thin.

**What it was not.** No hands-on test of any competitor was performed: no account, sign-in,
download or purchase. Every Yamakan-versus-competitor outcome is **NOT TESTED**.

**Evidence labels.** Each external fact carries one label and a source key from section 9.

| Label | Meaning |
|---|---|
| `[DOC]` | Vendor documentation or other first-party page (docs, help, pricing, terms, changelog, repository README or licence) |
| `[CLAIM]` | Vendor marketing, launch blog, press release or founder statement |
| `[IND]` | Independent third party (press, reviews, forums); competitor or affiliate authors are still `[IND]` |
| `[ASSUMED]` | Our inference or arithmetic from labelled facts |
| `[UNKNOWN]` | Not established from the sources reached |
| `[TESTED]` | Hands-on observation. **No cell carries it**; section 8 lists what would be needed |

`[DOC]` means "the vendor says so", not "it works". Something missing from documentation is
`[UNKNOWN]` unless a vendor page states the absence.

**Yamakan rows.** "Yamakan today" cells are code facts at the baseline commit; the file and symbol
behind each is in section 2.11. Tests were not run for this document. "Yamakan target" cells name
the MPR- or SS- cards that would change the cell: a plan, never an outcome against a competitor.

**Volatility.** Prices, plans and models changed monthly in 2026; re-read a source before relying
on a number.

## 2. The matrix

Rows: five AI-native generators, four incumbents (Adobe means Firefly with Premiere), the three
newer platforms report 04 ranks most relevant (Google Flow; Lightricks, meaning LTX Studio and LTX
Desktop; Flora), then Yamakan today and target. ComfyUI, a back end, is in section 4. Rows whose
cells would all be `[UNKNOWN]` or n/a are omitted and named under the table.

### 2.1 (a) Generation breadth and model access

| Product | First-party models | Third-party models | Local or open-weight path | Media generated |
|---|---|---|---|---|
| Higgsfield | Soul 2.0, Soul Cinema, DoP, Genjutsu [DOC] HF-S6; what they are built on [UNKNOWN] | Seedance, Kling, Veo, Wan and more, added most weeks [DOC] HF-S14 | None; cloud only [DOC] HF-S6 | Video, image, audio [DOC] HF-S14 |
| Runway | Gen-4.5 (2–10 s, 720p-class), Aleph 2.0, Act-Two [DOC] R-GEN45, R-EDIT | About 25 video models, Model Routers [DOC] R-API-MODELS | None found [UNKNOWN] | Video, image; audio via hosted models [DOC] R-CHG |
| Kling | Kling 4.0 (3–30 s), 3.0 family [DOC] K-BLOG40, K-CAP | None found [UNKNOWN] | None found [UNKNOWN] | Video, image, audio [DOC] K-CAP |
| Luma | Ray3.2 (5 or 10 s, ≤1080p), Uni-1 [DOC] L-AG-VID, L-NEWS | Seedance 2.5, MiniMax H3, Kling 4.0 [DOC] L-NEWS | None found [UNKNOWN] | Video, image; native audio [UNKNOWN] |
| Pika | Pika 2.5 (silent); H3 Flex, a post-trained MiniMax H3 [DOC] P-25, P-H3 | Seedance, Kling 4.0, Wan 3.0 and more [DOC] P-HOME | H3 Flex weights published; vendor ran them on H100 80 GB [DOC] P-HF | Video, image, speech, music, effects [DOC] P-BLOG |
| Adobe | Firefly models [CLAIM] AD-8 | Veo, Kling, Runway, Luma inside Premiere [IND] AD-9 | None; Adobe cloud [ASSUMED] | Video and sound effects [DOC] AD-1 |
| DaVinci Resolve | No pixel generator in 21.x lists [ASSUMED] from DR-2, DR-7 | None found [ASSUMED] | AI tools described as local [IND] DR-7 | AI voice generation reported [IND] DR-7 |
| CapCut | Seedance via ByteDance's AI workspace [CLAIM] CC-4, CC-5 | None found [UNKNOWN] | None; ByteDance cloud [CLAIM] CC-5 | Video; other media [UNKNOWN] |
| Blender | None; a renderer [ASSUMED] | Community add-ons, e.g. Pallaidium [IND] BL-12 | Fully local [DOC] BL-3 | Rendered frames only |
| Google Flow | Veo 3.1, Gemini Omni Flash [CLAIM] GF-1 | None [ASSUMED] | None; cloud [ASSUMED] | Video with audio [IND] GF-2 |
| Lightricks | LTX family; 2.5 Pro and 2.3 Pro API-only [DOC] LX-1 | Studio's list not verified [UNKNOWN] | LTX Desktop runs locally; Windows needs NVIDIA 24 GB+ VRAM [DOC] LX-1 | Video; audio-to-video [DOC] LX-1 |
| Flora | Style LoRA training only [DOC] FL-1 | 50+ aggregated models [IND] FL-6 | None [DOC] FL-3 | Image, video [IND] FL-6 |
| **Yamakan today** | None | None | No weights on the PC; three Apache-2.0 open-weight recipes run on the person's own Kaggle account | Video only: text-to-video and first-frame image-to-video |
| **Yamakan target** | None by design | MPR-210, MPR-222 (FD-5) | MPR-201, MPR-202, MPR-206; local stills MPR-220 (FD-4) | Captions and voice MPR-221 (FD-4) |

### 2.2 (b) Shot and take structure; revising one shot

| Product | Shot or take object | Revise one shot, rest untouched | History and comparison | Parameters kept with the result |
|---|---|---|---|---|
| Higgsfield | Per-shot engine; multi-shot clips arrive with cuts baked in [DOC] HF-S7 | Regional Edit Video; every change is a cloud pass [DOC] HF-S4, HF-S8 | Canvas autosaves versions; restore not described [DOC] HF-S15 | No Canvas or Popcorn export [DOC] HF-S5, HF-S12 |
| Runway | Agent assembles multi-shot output [DOC] R-AGENT | Edits are new generations [DOC] R-EDIT | "Versions" feed [DOC] R-EDIT | Prompt in metadata on Enterprise [DOC] R-ENT |
| Kling | Director Mode, 6 shots (3.0); 4.0 splits shots inside one clip [DOC] K-DIRECTOR, K-USE40 | Per-shot re-render [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| Luma | Scenes keyframe storyboard [DOC] L-SCENES | Keyframes regenerate before render [DOC] L-SCENES; after render, a new generation [ASSUMED] | [UNKNOWN] | [UNKNOWN] |
| Pika | Video Studio multi-shot ≤30 s [DOC] P-FAQ | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| Adobe | Generated clip is an ordinary sequence clip [DOC] AD-1 | Manual replacement; pixels flattened [ASSUMED] | [UNKNOWN] | Content Credentials API [DOC] AD-5; prompt or seed [UNKNOWN] |
| Blender | Storyboard template: a scene per shot [DOC] BL-13 | Re-render one shot's scene [ASSUMED] | [UNKNOWN] | The scene file [ASSUMED] |
| Google Flow | Scenebuilder sequencing [IND] GF-3 | Insert or remove an object [IND] GF-3; instruction edits [CLAIM] GF-1 | [UNKNOWN] | [UNKNOWN] |
| Lightricks | Studio timeline clips [IND] LX-4 | Studio replaces a regenerated clip in place [IND] LX-4; Desktop Retake [DOC] LX-1 | Take history [UNKNOWN] | [UNKNOWN] |
| Flora | Canvas nodes; no shots [DOC] FL-1 | Re-run one node [DOC] FL-1 | No version-history page in the docs [DOC] FL-1 | Inputs visible on the canvas [ASSUMED] |
| **Yamakan today** | Story shots with ≤8 takes, one selected | Compare, propose, apply a take as one undo step; refused if the shot spans more than one clip; a generation cannot target a shot | Take list per shot; no per-shot record of attempts | Lineage keeps output hash and input pins; seed, steps and model in a free-text label; prompt in shot notes |
| **Yamakan target** | MPR-102, MPR-106 | MPR-103, MPR-104, MPR-105, SS-011 | MPR-107; SS-016 measures | MPR-101 (FD-2) |

Omitted: DaVinci Resolve (no generator), CapCut (all `[UNKNOWN]`).

### 2.3 (c) Timeline, editing and finishing

| Product | Multitrack timeline | Deterministic finishing | Delivery formats |
|---|---|---|---|
| Higgsfield | None described in its documentation [DOC] HF-S7; plugins into Resolve and Premiere [DOC] HF-S9 | Upscale, reframe, relight as cloud passes [DOC] HF-S8 | Codec specification [UNKNOWN]; no ProRes per a review [IND] HF-S38 |
| Runway | Multi-track in the Agent; no image clips [DOC] R-TL | Trim, stitch, reorder [DOC] R-CHG | ProRes, EXR, HDR, chosen at generation time [DOC] R-API-PRO, R-GEN45 |
| Kling | "One timeline" announced; detail [UNKNOWN] K-BLOG40 | [UNKNOWN] | 10-bit HDR "coming soon" [DOC] K-BLOG40 |
| Luma | Keyframe timing in Scenes [DOC] L-SCENES | Reframe, Modify, as generations [DOC] L-RAY32 | HDR, 16-bit ACES EXR [DOC] L-RAY32 |
| Pika | [UNKNOWN] | Color Grade, Relight apps [DOC] P-HOME | [UNKNOWN] |
| Adobe | Full NLE [DOC] AD-1 | Color Mode, captions [CLAIM] AD-3, AD-7 | Professional formats [ASSUMED] |
| DaVinci Resolve | Full NLE [DOC] DR-1 | Studio: 10-bit, HDR, Dolby Vision [DOC] DR-1 | Free edition capped at 8-bit, UHD 60 fps [DOC] DR-1 |
| CapCut | Desktop editor [CLAIM] CC-5 | Pro features on the timeline block export [DOC] CC-7 | [UNKNOWN] |
| Blender | Sequencer with ripple edit (5.3) [DOC] BL-1 | Compositor, exact text strips [DOC] BL-1 | Multilayer EXR [DOC] BL-10 |
| Lightricks | Studio: 2 video, 5 audio channels [IND] LX-4; Desktop editor "legacy" [DOC] LX-3 | Voiceover, music, captions [IND] LX-8 | XML for Premiere [IND] LX-4 |
| Flora | No timeline [DOC] FL-1 | n/a | Export node writes files [DOC] FL-1 |
| **Yamakan today** | One timeline, ≤16 tracks, ≤200 clips, ≤10 min; trim, split, move in the UI; ripple, insert, group move as commands only | Transform, crop, LUT, dissolve, title strings, SRT/VTT captions with burn-in, EBU R128 loudness on export | H.264 MP4, SDR 8-bit 4:2:0, ≤1920×1080; no HDR, ProRes or alpha |
| **Yamakan target** | MPR-601 | MPR-602, SS-012, SS-013, SS-014 | MPR-603; no HDR or ProRes card |

Omitted: Google Flow (all `[UNKNOWN]`).

### 2.4 (d) Character and world consistency tooling

| Product | Reference mechanism | Persistent entities | Limits and measurement |
|---|---|---|---|
| Higgsfield | ≤50 references in Cinema Studio 4.0 [DOC] HF-S4 | Soul ID (20–80 photos, not exportable), Elements, Soul Cast [DOC] HF-S11, HF-S14 | Vendor: drift past about 30 s [CLAIM] HF-S20; a journalist found likeness not kept [IND] HF-S31 |
| Runway | Image, video, audio, 3D references [DOC] R-REF | Saved references, Brand Kits [DOC] R-REF, R-PRICE | Reviewers report drift [IND] T-RUNWAY |
| Kling | 4.0: 15 assets, 7 subjects [DOC] K-BLOG40 | Elements, voice profiles [DOC] K-USE40 | Independent tests not found [UNKNOWN] |
| Luma | Character reference in Modify [DOC] L-MODIFY | @character tag [DOC] L-HELP-SNIP (low confidence) | Help says faces can still change [DOC] L-HELP-SNIP |
| Pika | ≤12 references (H3 Flex), 50 attachable [DOC] P-H3, P-VS | Character Studio app [DOC] P-HOME | Vendor: multi-scene consistency needs work [DOC] P-H3R |
| Adobe | Frames as references [DOC] AD-1 | [UNKNOWN] | [UNKNOWN] |
| Blender | Exact geometry and materials [ASSUMED] | Scene assets; USD import [DOC] BL-10 | Same scene, same character [ASSUMED] |
| Google Flow | Ingredients [IND] GF-2 | Character and voice consistency [CLAIM] GF-1 | Forum reports drift [IND] GF-5 |
| Flora | Style LoRA [DOC] FL-1 | Techniques (packaged workflows) [DOC] FL-1 | [UNKNOWN] |
| **Yamakan today** | Reference packs with roles, pinned to shots by hash; only one first-frame still reaches a model | Characters only as pack entries; likeness consent records (grant, revalidate, revoke) | Continuity status is always "unmeasured" |
| **Yamakan target** | MPR-402 | MPR-401 | MPR-405 (measured, with date and n) |

Omitted: DaVinci Resolve (n/a), CapCut, Lightricks (all `[UNKNOWN]`).

### 2.5 (e) Camera and 3D control

| Product | Camera control | 3D scene or previs | Exact reproduction of the camera |
|---|---|---|---|
| Higgsfield | Camera, lens, aperture presets [CLAIM] HF-S3 | 3D Jutsu; Blender add-on [DOC] HF-S14, HF-S9 | Prompted; adherence [UNKNOWN] |
| Runway | Gen-4.5 camera parameters [UNKNOWN] | 3D-model references [DOC] R-REF | [UNKNOWN] |
| Kling | ≤10 keyframes; motion control on 3.0 and 2.6 [DOC] K-CAP | n/a | [UNKNOWN] |
| Luma | ≤64 keyframes in the API [DOC] L-AG-VID | n/a | Keyframe-conditioned, not a path [ASSUMED] |
| Pika | Camera Director app [DOC] P-HOME | n/a | [UNKNOWN] |
| DaVinci Resolve | Camera tracker (Studio) [DOC] DR-2 | Not researched [UNKNOWN] | n/a |
| Blender | Animated cameras; depth, normal, Cryptomatte passes [DOC] BL-2 | Full 3D; USD, Alembic, glTF [DOC] BL-10 | A camera is numeric data [ASSUMED] |
| **Yamakan today** | Scene camera fields are labelled intent; Blender moves and an aerial view are chosen per render and not stored | three.js previs; contained Blender 5.3.0, Cycles on CPU, ≤1280×720, ≤120 frames, one slot; camera tracking command | Blender renders from the stored scene; no camera reaches a generator |
| **Yamakan target** | MPR-403 | MPR-403, MPR-507 | MPR-404 (DEFERRED) |

Omitted: Adobe, CapCut, Google Flow, Lightricks, Flora (all `[UNKNOWN]` or n/a).

### 2.6 (f) Audio, voice, lip sync and captions

| Product | Generated audio | Voice and lip sync | Captions, transcription | Stems and mixing |
|---|---|---|---|---|
| Higgsfield | Native audio in Cinema Studio 4.0; audio models [DOC] HF-S4, HF-S14 | Lipsync Studio, Intone, dubbing in 18 languages [DOC] HF-S6, HF-S8 | Burned-in captions, per a competitor [IND] HF-S45 | Stems [UNKNOWN] |
| Runway | Seed Audio, ElevenLabs V4, Veo 3.1 [DOC] R-CHG | Act-Two replaced Lip Sync [DOC] R-DEPR | [UNKNOWN] | Audio split to its own track [DOC] R-TL |
| Kling | Stereo audio on by default (4.0) [DOC] K-BLOG40 | Lip-sync endpoint [DOC] K-CAP | [UNKNOWN] | [UNKNOWN] |
| Luma | Add-audio endpoint (legacy API) [DOC] L-API-OLD | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] |
| Pika | Speech, music, SFX models [DOC] P-BLOG | [UNKNOWN] | Dynamic Captions app [DOC] P-HOME | Five-stem separation, hosted [DOC] P-H3 |
| Adobe | Generate SFX; music beta [IND] AD-9 | Dialogue enhancement [CLAIM] AD-3 | Transcription, captions, translation [CLAIM] AD-3 | Full mixing [ASSUMED] |
| DaVinci Resolve | AI voice generation [IND] DR-7 | Voice isolation (Studio) [DOC] DR-2 | Transcription with speakers [DOC] DR-3 | Full mixing [ASSUMED] |
| Blender | n/a | n/a | n/a | Sequencer audio strips [ASSUMED] |
| Google Flow | Veo 3.1 audio [IND] GF-2 | Voice consistency [CLAIM] GF-1 | [UNKNOWN] | [UNKNOWN] |
| Lightricks | Audio-to-video [DOC] LX-1 | [UNKNOWN] | Captions in Studio [IND] LX-8 | 5 audio channels [IND] LX-4 |
| **Yamakan today** | None; generation runs with audio off | None | Caption import, edit, burn-in, export; transcription refuses | Gain and sound on/off in the UI; fades, unlink/relink, loudness in the model; no mixer |
| **Yamakan target** | No card | MPR-221 (FD-4) | MPR-221, SS-013 | MPR-602, SS-012 |

Omitted: CapCut, Flora (all `[UNKNOWN]`).

### 2.7 (g) Agents, API, MCP, CLI and automation

| Product | In-product agent | API and SDK | MCP and CLI | Spend control and approvals |
|---|---|---|---|---|
| Higgsfield | Supercomputer; routes models itself [DOC] HF-S10 | API, Python and TypeScript SDKs, estimate endpoint [DOC] HF-S25 | Hosted MCP; CLI and skills [DOC] HF-S22, HF-S23 | MCP has no native credit cap [DOC] HF-S22 |
| Runway | Agent; generates automatically by default [DOC] R-AGENT | API, Node and Python SDKs, Task Cost API [DOC] R-API, R-CHG | MCP on Pro [DOC] R-PRICE | "Ask before generating" option [DOC] R-AGENT; Enterprise project caps [DOC] R-CHG |
| Kling | Agent named; behaviour [UNKNOWN] K-BLOG40 | API, signed webhooks [DOC] K-CALLBACK | Reachable via Runway's MCP [DOC] R-CHG | [UNKNOWN] |
| Luma | Luma Agents, Skills [DOC] L-SKILLS | Agents API, SDKs, CLI [DOC] L-AG | MCP for Claude, ChatGPT [DOC] L-MCP | Scenes waits for sign-off [DOC] L-SCENES |
| Pika | Production agent not found [UNKNOWN] | API Club, signed webhooks [DOC] P-DEV | MCP, ChatGPT app [CLAIM] P-BLOG | [UNKNOWN] |
| Adobe | AI Assistant (beta) [DOC] AD-13; plan shown first [CLAIM] AD-6 | UXP; no generative API [DOC] AD-5 | First-party MCP in preview [CLAIM] AD-7 | [UNKNOWN] |
| DaVinci Resolve | None found [ASSUMED] | Advanced scripting needs Studio [DOC] DR-3 | Native MCP server (Studio 21.1) [DOC] DR-3 | No documented permission model [IND] DR-6 |
| Blender | None | `bpy`, headless CLI [DOC] BL-3 | Blender Lab MCP [IND] BL-9; community server CVE [DOC] BL-8 | n/a |
| Google Flow | Flow Agent [CLAIM] GF-1; turns reportedly free [IND] GF-6 | Veo via Google APIs [IND] GF-2 | [UNKNOWN] | [UNKNOWN] |
| Lightricks | Desktop Assistant; cannot edit the timeline [DOC] LX-2 | LTX API [DOC] LX-1 | No MCP [DOC] LX-2 | No spending cap on the Gemini path [DOC] LX-2 |
| Flora | FAUNA [IND] FL-6 | REST API, idempotency keys, webhooks [DOC] FL-1 | Remote MCP; CLI [DOC] FL-1 | Quotes, admin caps; canvas runs start unconfirmed [DOC] FL-2 |
| **Yamakan today** | None by design; the customer's agent uses MCP | 116 typed `yamakan.*` commands; in-repo SDK; no wait or events | stdio MCP, tools only; thin CLI | Scoped agent tokens; 13 human-only commands incl. generation start; hash-bound Director approvals; no budgets |
| **Yamakan target** | MPR-301, MPR-302, MPR-304, MPR-305 | MPR-502, MPR-503 | MPR-501, MPR-503 | MPR-303, MPR-504, MPR-505, MPR-506 |

Omitted: CapCut (all `[UNKNOWN]`).

### 2.8 (h) Cost model and predictability

| Product | Pricing unit | Estimate before the run | Failed or moderated jobs | Expiry, "unlimited" |
|---|---|---|---|---|
| Higgsfield | Plan credits; prepaid USD API [DOC] HF-S17, HF-S25 | Price on the button; API estimate [DOC] HF-S6, HF-S25 | Failed returned; blocked returned for most models [DOC] HF-S17, HF-S29 | Credits expire at renewal; packs 90 days; Unlimited web-only, throttled [DOC] HF-S17, HF-S21a |
| Runway | Credits, $0.01 each on the API [DOC] R-API-PRICE | Task Cost API [DOC] R-CHG | Moderated API jobs charged in full [DOC] R-API-MOD | Unlimited withdrawn [DOC] R-UNL1 |
| Kling | Credits; API per second [DOC] K-APIPRICE | [UNKNOWN] | [UNKNOWN] | Credits expire [IND] T-KLING |
| Luma | Credits [DOC] L-PRICE | Cost table in API docs [DOC] L-APIPRICE | Moderated API jobs not refunded [DOC] L-AG-FAQ | No rollover [IND] EESEL-L |
| Pika | Credits; prepaid API [DOC] P-PRICE, P-DEV | [UNKNOWN] | Support "investigates" [DOC] P-FAQ | No unlimited; top-ups 365 days [DOC] P-PRICE |
| Adobe | Generative credits; 25 a month with Premiere alone [DOC] AD-3 | [UNKNOWN] | Users report charges on failure [IND] AD-15 | [UNKNOWN] |
| DaVinci Resolve | One-off licence; no credits [DOC] DR-1 | n/a | n/a | n/a |
| CapCut | Subscription plus credits; trackers conflict [IND] CC-8 | [UNKNOWN] | [UNKNOWN] | CapCut and Dreamina credits separate [CLAIM] CC-6 |
| Blender | Free [DOC] BL-4 | n/a | n/a | n/a |
| Google Flow | Google AI plan credits [IND] GF-4 | [UNKNOWN] | Lost-credit reports [IND] GF-5 | Veo 3.1 Lite unlimited on Ultra [IND] GF-8 |
| Lightricks | Desktop free with own keys [DOC] LX-1; Studio credits [IND] LX-5 | Studio: not shown first [IND] LX-5 | [UNKNOWN] | [UNKNOWN] |
| Flora | Dollar usage per seat [DOC] FL-5 | Quote valid 5 minutes [DOC] FL-2 | Failures free; cancelling may still charge [DOC] FL-2 | [UNKNOWN] |
| **Yamakan today** | No code path spends money; Kaggle runs use the person's free GPU quota | Expected minutes and what leaves the PC; no money or quota estimate | No paid route exists | n/a |
| **Yamakan target** | MPR-204, MPR-505 | MPR-203 | MPR-207 | MPR-205 (quota display) |

### 2.9 (i) Project ownership, portability, interchange and offline use

| Product | Where the project lives | Interchange out | Offline use |
|---|---|---|---|
| Higgsfield | Vendor cloud; API outputs kept ≥7 days [DOC] HF-S24 | None described; plugins push clips [DOC] HF-S5, HF-S9 | Resolve plugin needs internet, per a review [IND] HF-S36 |
| Runway | Vendor cloud; projects capped by plan [DOC] R-PRICE | No OTIO/EDL/XML in the timeline article [DOC] R-TL | None found [UNKNOWN] |
| Kling | Vendor cloud; API results kept 30 days [DOC] K-I2V40 | [UNKNOWN] | None found [UNKNOWN] |
| Luma | Vendor cloud; API links expire in 1 hour [DOC] L-AG-VID | [UNKNOWN] | None found [UNKNOWN] |
| Pika | Vendor cloud; old site being retired [DOC] P-NEW | [UNKNOWN] | None found [UNKNOWN] |
| Adobe | Local project, cloud generation [ASSUMED] | OTIO, AAF [DOC] AD-4, AD-5; FCP7 XML [IND] AD-16 | Generation needs a connection [ASSUMED] |
| DaVinci Resolve | Local [ASSUMED] | FCPXML, DRT [DOC] DR-2; OTIO, AAF, EDL (18.6 manual) [IND] DR-10 | Local search without cloud [IND] DR-7 |
| CapCut | Content may upload at import [DOC] CC-2 | No third-party project import or export [DOC] CC-1 | [UNKNOWN] |
| Blender | Local files [ASSUMED] | OTIO "initial" (5.3); USD, Alembic [DOC] BL-1, BL-10 | Fully local; `--offline-mode` [DOC] BL-3 |
| Google Flow | Vendor cloud [ASSUMED] | Structured export [UNKNOWN] | None found [UNKNOWN] |
| Lightricks | Studio cloud; Desktop local [DOC] LX-1 | Studio XML [IND] LX-4; Desktop format [UNKNOWN] | Desktop starts with no key [DOC] LX-1 |
| Flora | Vendor cloud [DOC] FL-3 | Files via Export node [DOC] FL-1 | No [DOC] FL-3 |
| **Yamakan today** | SQLite workspace and content-addressed media on the PC; immutable revisions; verified backup, restore into a new root | Project JSON; OTIO JSON with a loss report; OTIO import as a proposal; no OTIO UI; no EDL, FCPXML, AAF | Editing and export offline; generation needs Kaggle |
| **Yamakan target** | MPR-701 | MPR-603, MPR-702, SS-015 | MPR-204 (egress as recorded approval) |

### 2.10 (j) Privacy, licensing, provenance and output rights

| Product | Training on customer content | Output rights | Provenance and labelling |
|---|---|---|---|
| Higgsfield | Yes; Enterprise Agreement excluded [DOC] HF-S1 | Commercial use allowed (API) [DOC] HF-S25 | Watermark on some plans [DOC] HF-S30a; C2PA [UNKNOWN] |
| Runway | Yes; no consumer opt-out [DOC] R-TOS | Unrestricted; perpetual licence to Runway [DOC] R-TOS | Prompt in metadata (Enterprise) [DOC] R-ENT |
| Kling | Consumer yes, email opt-out; API no [DOC] K-POLICY, K-APITOS | Consumer clause needs checking; API unrestricted [DOC] K-POLICY, K-APITOS | Labelling requested [DOC] K-POLICY |
| Luma | Consumer yes; API FAQ no [DOC] L-TOS, L-AG-FAQ | Commercial only during a subscription [DOC] L-TOS | API output unwatermarked [DOC] L-API-FAQ |
| Pika | Yes, anonymised; no opt-out [DOC] P-TOS | Paid plans only [DOC] P-TOS | No watermark on any plan [DOC] P-FAQ |
| Adobe | Says no training on customer content [CLAIM] AD-8 | Enterprise indemnity [CLAIM] AD-8 | Content Credentials in UXP 26.5 [DOC] AD-5 |
| DaVinci Resolve | No statement found [UNKNOWN] | n/a | [UNKNOWN] |
| CapCut | ML training listed; no opt-out described [DOC] CC-2 | Broad perpetual licence to the vendor [DOC] CC-3 | [UNKNOWN] |
| Blender | n/a | GPL covers the program, not the artwork [DOC] BL-4 | n/a |
| Lightricks | [UNKNOWN] | LTX-2 weights under a community licence [IND] LX-6 | [UNKNOWN] |
| Flora | Not used for training [DOC] FL-4 | Outputs belong to the user [DOC] FL-4 | Retention not stated [DOC] FL-4 |
| **Yamakan today** | Hosts no model; only a Kaggle run the person starts sends anything, and the run screen says what Kaggle keeps | Recipes carry a licence field; code provenance and SBOM checked in CI | Take lineage plus a ledger record; no export manifest; no C2PA |
| **Yamakan target** | FD-2 | MPR-208, MPR-209 | MPR-101, MPR-506, MPR-701 |

Omitted: Google Flow (all `[UNKNOWN]`).

### 2.11 Yamakan today: code references

Read at `4a8e1b5`; the one later merge in the baseline, pull request #278 (an item moves to one end
pose in a Blender render), was re-read and is reflected in (e). UI reachability comes from
[the code note 08](evidence/research/08-code-project-timeline-studio-cinema-director-blender.md)
and was not re-traced control by control. In this document "report NN" means the research note
with that number under [evidence/research/](evidence/research/).

- (a) `core/engines/kaggle.ts` `KAGGLE_RECIPES` (three Apache-2.0 recipes; 704×480 or 720×480;
  `expectedSeconds` about 1,130); `core/engines/contract-v2.ts` `Operation`;
  `PINNED_COMFY_RECIPES`, `PINNED_MODEL_MANIFESTS` (empty); `ENGINE_ENABLED = false`.
- (b) `core/story.ts` `STORY_LIMITS`, `TakeLineageSchema`; `core/takes.ts` `shotClip`;
  `yamakan.take.compare`, `proposeReplace`, `apply`; `yamakan.generation.start` (no shot field);
  `src/create/create-story.ts` `addMadeVideo`.
- (c) `core/canonical.ts`; `yamakan.timeline.rippleDelete`, `rippleTrim`, `insert`, `groupMove`;
  `yamakan.lut.import`; `yamakan.captions.*`; `core/audio/loudnorm.ts`; `core/render/plan.ts`.
- (d) `src/create/ElementsPanel.tsx` header; `core/continuity.ts` (`"unmeasured"`);
  `yamakan.consent.grant`, `revalidate`, `revoke`.
- (e) `core/blender/runtime.ts` (`5.3.0`); `core/blender/scene.ts` `BLENDER_SCENE_LIMITS`,
  `AERIAL_DIRECTION` (pull request #277); optional `motion` on a scene item in `core/scene3d.ts`
  (pull request #278; no page control yet); `yamakan.blender.render`, `yamakan.blender.track`.
- (f) `core/engines/generation.ts` (`audio: false`); `yamakan.audio.transcribe`.
- (g) `core/command/registry.ts` (116 commands, 13 `humanOnly`); `mcp/main.ts`; `cli/main.ts`;
  `sdk/client.ts`.
- (h) `src/create/GeneratePanel.tsx`; `src/i18n.ts`; no estimate or budget type in `core/engines`.
- (i) `core/recovery.ts`; `yamakan.workspace.backup`, `restore`; `yamakan.project.export`,
  `exportOtio`, `proposeOtio`; `core/interchange/otio.ts` `otioLossReport`.
- (j) `core/engines/clean-image.ts`; `.github/workflows/qualify.yml` (`provenance:check`,
  `sbom:check`); no C2PA code under `core/`, `src/`, `server/`, `sdk/`, `mcp/`, `cli/`.

## 3. Competitor profiles

"Weakest point for professional production" is our reading of the cited facts `[ASSUMED]`.

**Higgsfield.** Cloud aggregator of third-party models with its own direction, character and
marketing tools [DOC] HF-S6. *Strongest:* model breadth and distribution (NLE and Blender plugins,
MCP, CLI, API) [DOC] HF-S9, HF-S22. *Weakest:* no timeline of its own; every change a metered cloud
pass; Soul ID not exportable; no MCP cap [DOC] HF-S7, HF-S8, HF-S11, HF-S22. *Pricing:* expiring
credits, prepaid API; plan prices disputed [UNKNOWN]. *Evidence:* good on features and terms; its
own pages disagree on clip length and resolution [DOC] HF-S4, HF-S7.

**Runway.** Own and about 25 resold models, a chat Agent with a thin timeline, NLE plugins [DOC]
R-CHG, R-TL. *Strongest:* shipped breadth, professional outputs [DOC] R-API-PRO. *Weakest:* edits
are new generations; moderated API jobs charged [DOC] R-EDIT, R-API-MOD. *Pricing:* $15–$95
monthly credits [DOC] R-PRICE. *Evidence:* documentation good; no independent hands-on reached.

**Kling.** Kling 4.0 (up to 30 s, stereo audio), also wholesaled to Runway, Luma and Pika [DOC]
K-BLOG40, L-NEWS, P-HOME. *Strongest:* capability per dollar on its API [DOC] K-APIPRICE.
*Weakest:* shots split inside one clip by default [DOC] K-USE40; timeline and agent undocumented
[UNKNOWN]. *Pricing:* credits; API per second [DOC] K-CREDIT. *Evidence:* good for the API only.

**Luma.** Ray3.2 and Uni-1 behind Agents, Scenes, Skills and MCP [DOC] L-RAY32, L-MCP.
*Strongest:* HDR and ACES EXR; approval before Scenes renders [DOC] L-SCENES. *Weakest:*
commercial use tied to an active subscription [DOC] L-TOS. *Pricing:* credits from $30 a month
[DOC] L-PRICE. *Evidence:* documentation good, independent coverage thin.

**Pika.** Relaunched app platform with Pika 2.5 and open-weight H3 Flex [DOC] P-NEW, P-H3.
*Strongest:* low price per clip, published weights [DOC] P-PRICE, P-HF. *Weakest:* no documented
timeline or export [UNKNOWN]; concedes multi-scene consistency gaps [DOC] P-H3R. *Pricing:* credits
from $10 a month [DOC] P-PRICE. *Evidence:* documentation good, independent coverage thin.

**Adobe (Firefly, Premiere).** An NLE generating video and sound inside the sequence [DOC] AD-1.
*Strongest:* full editor with OTIO, AAF and Content Credentials [DOC] AD-4, AD-5. *Weakest:*
generated clips are flattened, parameters not exposed [ASSUMED]; MCP preview only [CLAIM] AD-7.
*Pricing:* subscriptions with monthly credits [DOC] AD-2. *Evidence:* weak on limits (help centre
blocked); MAX 2026 news one day old.

**DaVinci Resolve.** NLE and colour suite whose AI analyses rather than generates [ASSUMED] from
DR-2. *Strongest:* finishing depth; one-off licence; MCP in Studio 21.1 [DOC] DR-1, DR-3.
*Weakest:* no generator; MCP without a documented permission model [IND] DR-6. *Pricing:* free;
Studio $236 as shown [DOC] DR-1. *Evidence:* moderate.

**CapCut.** Consumer editor with Seedance in a browser workspace [CLAIM] CC-5. *Strongest:* social
reach [ASSUMED]. *Weakest:* no project interchange; broad content licence [DOC] CC-1, CC-3.
*Pricing:* subscription plus credits, conflicting [IND] CC-8. *Evidence:* weak.

**Blender.** GPL 3D suite; 5.3 added ripple edit and initial OTIO [DOC] BL-1. *Strongest:* exact
cameras and render passes [DOC] BL-2. *Weakest:* no generation; CPU-only Cycles roughly 12–18
times slower than a laptop GPU [ASSUMED] from BL-7. *Pricing:* free. *Evidence:* release notes
good; blender.org blocked.

**Google Flow.** Cloud filmmaking tool on Veo and Gemini Omni with Flow Agent [CLAIM] GF-1.
*Strongest:* owned models, bundles, distribution [IND] GF-4. *Weakest:* single vendor, cloud only,
structured export [UNKNOWN]. *Pricing:* Google AI plan credits [IND] GF-4. *Evidence:* vendor blog
and aggregators only.

**Lightricks (LTX Studio, LTX Desktop).** Hosted storyboard-to-timeline studio and an Apache-2.0
local app [IND] LX-4; [DOC] LX-7. *Strongest:* regenerate one clip and keep the edit, with Premiere
XML [IND] LX-4; local Retake with user keys [DOC] LX-1. *Weakest:* the Desktop assistant cannot edit
the timeline and has no MCP or spending cap [DOC] LX-2; Studio hides cost before generation [IND]
LX-5. *Pricing:* Studio credits; Desktop free [DOC] LX-1. *Evidence:* good for Desktop, thin for
Studio.

**Flora.** Cloud node canvas with 50+ models, agent, API, CLI and MCP [DOC] FL-1. *Strongest:*
agent cost governance (quotes, budgets, caps, failures free) [DOC] FL-2. *Weakest:* no timeline,
local path or user keys [DOC] FL-1, FL-3. *Pricing:* $18–$200 per seat [DOC] FL-5. *Evidence:*
documentation good; complaints not researched.

## 4. Newly identified competitors and open-source projects worth tracking

Star counts as displayed on 2026-11-11; whether they are organic is `[UNKNOWN]`. "Why" is our
reading `[ASSUMED]`.

| Name | Evidence | Why it matters, or does not |
|---|---|---|
| ComfyUI | Local node runtime; closed models only via paid Partner Nodes, no user keys; official MCP and CLI [DOC] CU-1, CU-2, CU-4 | Default local, model-independent substrate; a back end to integrate, not a production product |
| OpenChatCut (AGPL, 3.1k) | Local timeline editor; agent and clients share tools via localhost MCP; edits commit as one undo step; FCPXML [DOC] OC-1 | Nearest open "timeline plus MCP plus local-first"; no shots, takes or lineage; see [04_SOURCE_REUSE_DECISIONS.md](04_SOURCE_REUSE_DECISIONS.md) |
| ChatCut | Agent edits are ordinary, undoable timeline edits; save a version first [DOC] CH-1 | "Agent output stays editable" is table stakes |
| Palmier Pro | macOS editor with localhost MCP; GPL only to v0.7.6, then proprietary [DOC] PA-1 | A demonstrated open-to-closed licence change |
| OpenMontage (AGPL, 79.6k) | Coding assistant as orchestrator; schema-checked checkpoints; enforced approval gates; hard budget cap; no timeline [DOC] OM-1 | The governance pattern an AI creative director needs |
| HyperFrames (Apache-2.0, 82.7k) | HTML compositions rendered deterministically; agent skills [DOC] HY-1 | "Project as files an agent writes" at scale; motion graphics only |
| ViMax (MIT, 12.9k) | Multi-agent idea-to-video; a vision model picks keyframes [DOC] VM-1 | Cheap automated candidate selection |
| VibeFrame (MIT, 185) | CLI and MCP; project as files; per-beat rebuild; maximum-cost flag [DOC] VF-1 | Same idea without an editing surface; low adoption |
| Kapwing (Kai) | Estimated credits approved before the agent proceeds; "Recreate" shows an asset's prompt [DOC] KP-1 | Cheap trust features that set a floor |
| Invideo | Agent reasoning reported as over 30% of spend in some sessions [IND] IV-1 | Agent overhead becomes a complaint of its own |
| ElevenLabs Studio | Timeline with voice, music, effects, captions; agent chat costs credits [DOC] EL-1 | Owns the audio layer Yamakan lacks |
| Seedance 2.5 | Up to 30 s per pass; timestamp-level editing [CLAIM] SD-1; studio letters over 2.0 [IND] SD-2 | Partial revision moving into models; route to it, do not rebuild it |
| fal, WaveSpeed | MCP over 1,000+ models [CLAIM] FA-1; desktop app and shot tool [CLAIM] WS-1 | Model access is a commodity; suppliers that may move up |
| Mosaic | Branching variants and XML export [CLAIM] MO-1; commenters questioned determinism [IND] MO-1 | Near the "take history" idea; founder claims only |

Status changes: OpenAI removed the Sora 2 models and Videos API on 2026-09-24 with no replacement
[DOC] OA-1. Freepik became Magnific, Weavy became Figma Weave, Captions became Mirage, and Cloudflare
is acquiring Replicate [IND] ST-1, ST-2, ST-3, ST-4.

Open-source building blocks (report 03): OpenTimelineIO (Apache-2.0) [DOC] OS-1 is read or written
by Premiere [DOC] AD-4, Blender 5.3 [DOC] BL-1 and Resolve [IND] DR-10, and carries cuts, not looks
[DOC] OS-2. Remotion is source-available with a paid company licence [DOC] OS-5; Revideo and Motion
Canvas are MIT [DOC] OS-6, OS-7; OpenCut (MIT) is mid-rewrite with MCP not shipped [DOC] OS-8.

## 5. Where Yamakan cannot win and should not try

1. **Raw model quality.** Yamakan ships no model; its one route runs small open-weight models at
   about 704×480 for 3 to 6 seconds (`KAGGLE_RECIPES`). Kling documents up to 30 s with audio
   [DOC] K-BLOG40; public rankings disagree between snapshots [IND] MD-1. Quality is whatever the
   customer's route delivers, reported only as a measurement (MPR-405, MPR-803).
2. **Model count and onboarding speed.** Higgsfield adds models most weeks [DOC] HF-S14; fal
   advertises 1,000+ [CLAIM] FA-1. MPR-206 makes each model a reviewed data change, slower by design.
3. **Cloud GPU scale and latency.** A Kaggle run is expected to take about 1,130 seconds, one per
   notebook at a time; the founder host has no discrete GPU, and CPU-only video generation is
   impractical for every surveyed model [ASSUMED] (no vendor publishes CPU timings).
4. **Mobile, social templates and marketing verticals.** Higgsfield's ad and shorts products
   [DOC] HF-S14 and Pika's 25+ apps [DOC] P-NEW serve audiences a desktop project tool does not.
5. **Distribution inside assistants and bundles.** Runway, Luma and Higgsfield run hosted MCP
   servers [DOC] R-CHG, L-MCP, HF-S22; Google and Adobe bundle generation into plans [IND] GF-4;
   [DOC] AD-3. Yamakan's MCP is a local server for the customer's own agent, not a channel.
6. **Full NLE and colour depth.** Premiere and Resolve [DOC] AD-1, DR-1. Yamakan exports SDR 8-bit
   H.264 at up to 1080p; the plan is interchange (MPR-603, MPR-702, SS-015), not replacement.
7. **Native audio, voice and lip sync.** Kling, Higgsfield and Pika generate audio with picture
   [DOC] K-BLOG40, HF-S4, P-H3. Yamakan has no audio card, and the open LTX-2.5 model with audio
   states a 32 GB VRAM minimum [DOC] MD-2.
8. **Real-time generation and world models.** Krea [DOC] KR-1, Decart [DOC] DC-1 (snippet),
   Odyssey [CLAIM] OD-1. Nothing in Yamakan's hardware envelope points there.
9. **Enterprise compliance packages.** SOC 2, ISO 27001, SSO and indemnity [DOC] R-SEC, HF-S16;
   [CLAIM] AD-8. Yamakan runs no hosted service to certify.
10. **Editing inside an existing clip.** Higgsfield documents a regional video edit [DOC] HF-S4,
    HF-S8, Google Flow is reported to insert or remove an object [IND] GF-3, and Lightricks
    documents a retake [DOC] LX-1 (section 2.2). Yamakan's engine contract names a `videoEdit`
    operation, but no adapter provides it and no card adds a route that edits a region or an
    object inside a clip. A route that offers one would enter through the intake rules of MPR-206.

## 6. White space

Observations about the surveyed products: things the research looked for and did not find. "Not
found" in desk research is weaker than "documented as absent". None of these is a Yamakan win, and
most are not built in Yamakan either.

1. **Versioned, diffable shot and take history with lineage that survives export.** Not found
   [UNKNOWN] (report 04, section 6c). Nearest: OpenChatCut drafts [DOC] OC-1, ChatCut versions
   [DOC] CH-1, Runway's versions feed [DOC] R-EDIT, Kapwing prompt recall [DOC] KP-1, LTX Studio
   replace-in-place [IND] LX-4. *Yamakan today:* takes and revisions exist; a take records no
   request; OTIO export drops documents. *Cards:* MPR-101, MPR-103, MPR-107, MPR-701, MPR-702.
2. **Generation parameters travelling with the edit.** Beyond Adobe's Content Credentials this is
   [UNKNOWN]; no tool was found exporting lineage in OTIO [UNKNOWN]. *Yamakan today:* the record
   lives in the job ledger (`core/engines/generation.ts` `GenerationRecord`). *Cards:* MPR-101
   (FD-2), MPR-702.
3. **Local ownership with the cost shown before the run.** Pre-run figures were found only in cloud
   products [DOC] FL-2, HF-S25, R-CHG, KP-1; the local-first app surveyed has no spending cap on its
   cloud path [DOC] LX-2. The combination was not found [ASSUMED]. *Yamakan today:* local project,
   minutes shown, no estimate. *Cards:* MPR-203, MPR-204.
4. **An agent on an editable timeline under a hard budget, with approval points, surviving a
   restart.** OpenMontage has caps but no timeline [DOC] OM-1; Flora has caps but no timeline
   [DOC] FL-2; Higgsfield's MCP has no cap [DOC] HF-S22; LTX Desktop's assistant cannot edit the
   timeline [DOC] LX-2. Not found together [ASSUMED]. *Yamakan today:* durable jobs, scoped
   tokens, approvals; no budgets. *Cards:* MPR-501 to MPR-506.
5. **One structured project from brief to edit.** None found [ASSUMED]. *Yamakan today:* story,
   packs and timeline in one project; the brief is in browser `localStorage`
   (`src/create/CreateWorkspace.tsx`). *Cards:* MPR-106, MPR-301.
6. **A project that outlives its provider.** Sora's removal [DOC] OA-1; Runway's tool retirements
   [DOC] R-DEPR; resale inside vendor wallets under no-compete terms [DOC] R-TOS, K-APITOS, L-TOS,
   P-TOS. No provider-neutral per-shot record was found [ASSUMED]. *Cards:* MPR-201, MPR-101.
7. **Honest failure and billing classes.** Charging rules differ [DOC] R-API-MOD, L-AG-FAQ, FL-2;
   charges for failures recur across vendors [IND] GF-5, AD-15, CP-1. A per-failure "may still be
   billed" class shown to users was not found [UNKNOWN]. *Yamakan today:* `core/engines/contract-v2.ts`
   `CancellationSchema` has `billingOutcome`. *Card:* MPR-207.

## 7. Claims Yamakan must not make today

Reasons: **not built**, **not measured**, **not tested** (no competitor comparison). Release
remains NO-GO (`specs/CURRENT.md`).

| Claim to avoid | Reason | What is true, and what would change it |
|---|---|---|
| "Revise one shot, nothing else changes" | Not built end to end; not measured | Take replace is one undo step, but generation cannot target a shot and split shots refuse. MPR-102, MPR-103, MPR-105; SS-016 |
| "Fewer generations to an accepted cut" | Not measured; not tested | H-B NOT TESTED. MPR-801 to MPR-803 (FD-6) |
| "Zero surprise spend, enforced" | Not built as a gate | Holds by absence of paid code. MPR-204 |
| "See the cost first" | Not built | Only minutes and egress shown. MPR-203 |
| "Full lineage through export" | Not built | Output hash and input pins only. MPR-101, MPR-701 |
| "Consistent characters" | Not built; not measured | Packs reach no model. MPR-401, MPR-402, MPR-405 |
| "Any model" | Not built | One route, three recipes. MPR-201, MPR-222 (FD-5) |
| "Local AI generation" | Not built | Models run on Kaggle. MPR-220 (FD-4), stills only |
| "Nothing leaves your computer" (unqualified) | Untrue during a Kaggle run | Prompt, seed and optional still go to a private notebook that keeps them; add "unless you start a Kaggle run" |
| "Captions from speech", "voice", "lip sync" | Not built | Transcription refuses. MPR-221 (FD-4) |
| "Camera control of generated shots" | Not built | Camera fields are labelled intent. MPR-403, MPR-404 |
| "Your agent makes the film end to end" | Not built | Generation is human-only; MCP has no wait or events. MPR-501 to MPR-505 |
| "Agents are contained" | Limited | `docs/SECURITY.md` limits the human-only rule to processes that cannot read or write the workspace folder. MPR-508 (FD-9) |
| "Round-trips with Premiere and Resolve" | Not tested | OTIO commands, stated losses, no UI. MPR-603, MPR-702, SS-015 |
| "HDR, ProRes, 4K delivery" | Not built | SDR 8-bit H.264 ≤1920×1080 |
| "Better, faster or cheaper than" any product here | Not tested | Section 8 |
| "Qualified on Windows", "release-ready" | Not qualified | NO-GO; Windows CI runs three test selections. MPR-804 (FD-8), SS-018, SS-019 |

## 8. Hands-on testing needed to raise evidence to [TESTED]

All of it needs founder authorisation (FD-6): accounts, accepted terms, paid generations, perhaps
volunteer raters. Agents may not create accounts, sign in or pay, so a person operates the
competitor side, under the pre-registered protocol (MPR-801) as the competitor arm (MPR-803) beside
the Yamakan baseline (MPR-802); see [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md).
Fictional characters only.

1. **Revision locality** (b): a fixed multi-shot task; revise one shot; record generations to
   acceptance, charges, and frame hashes of untouched shots (Higgsfield, Runway, Luma, LTX Studio,
   Kling, Flow).
2. **Cost predictability** (h): each pre-run figure (Higgsfield estimate, Runway Task Cost, Flora
   quote, Kapwing estimate) against the recorded charge, with one failure and one cancellation.
3. **Interchange round-trip** (c, i): LTX Studio XML, Premiere, Resolve and Blender OTIO, and
   `yamakan.project.exportOtio`, imported into each other; count surviving cuts, ranges and names.
   Local installs also need approval on a host with little free disk.
4. **Recoverability** (i): export everything allowed, remove the cloud copy where possible, reopen.
5. **Agent spend control** (g): through each hosted MCP, a task that would exceed a stated budget;
   does a hard limit stop it, is approval requested?
6. **Consistency** (d): one fictional character across five shots, rated blind (MPR-405 method),
   reported with date and n.
7. **Failure billing** (h): failed and moderated attempts and their charges over a fixed run count.
8. **Delivery formats** (c): request ProRes, EXR or HDR where documented; probe the files.
9. **Terms** (j): legal review of current provider terms, the precondition of FD-5 (not a hands-on
   test).

Until these run, competitor cells stay `[DOC]`, `[CLAIM]`, `[IND]`, `[ASSUMED]` or `[UNKNOWN]`.

## 9. Sources

All accessed 2026-11-11; URLs copied from the research notes. "(snippet)": only a search summary
was seen. The full list is in [SOURCES.md](SOURCES.md).

**Higgsfield** (report 01 numbering)
- HF-S1 https://higgsfield.ai/terms
- HF-S3 https://higgsfield.ai/blog/cinema-studio-4-0
- HF-S4 https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-cinema-studio
- HF-S5 https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-canvas
- HF-S6 https://higgsfield.ai/llms.txt
- HF-S7 https://higgsfield.ai/cinematic-video-generator
- HF-S8 https://higgsfield.ai/ai-video-editor
- HF-S9 https://higgsfield.ai/creator-hub/help-center/integrations/external-integrations-higgsfield
- HF-S10 https://higgsfield.ai/creator-hub/help-center/tools-and-workflows/how-do-i-use-supercomputer
- HF-S11 https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-create-and-use-a-soul-id-character
- HF-S12 https://higgsfield.ai/storyboard-generator
- HF-S14 https://higgsfield.ai/creator-hub/changelog
- HF-S15 https://higgsfield.ai/canvas-intro
- HF-S16 https://higgsfield.ai/enterprise
- HF-S17 https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work.md
- HF-S20 https://higgsfield.ai/blog/ai-short-film-pipeline
- HF-S21a https://higgsfield.ai/creator-hub/help-center/credits/what-are-unlimited-models-and-which-plans-include-them
- HF-S22 https://higgsfield.ai/creator-hub/help-center/integrations/how-do-i-connect-higgsfield-to-ai-agent
- HF-S23 https://higgsfield.ai/creator-hub/help-center/mcp-cli/how-do-i-access-higgsfield-via-cli
- HF-S24 https://docs.higgsfield.ai/docs/help/faq.md
- HF-S25 https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api
- HF-S29 https://higgsfield.ai/creator-hub/help-center/troubleshooting/content-flagged-as-nsfw
- HF-S30a https://higgsfield.ai/creator-hub/help-center/account-and-privacy/who-owns-my-generations-and-can-i-use-them-commercially
- HF-S31 https://www.usermag.co/p/my-journey-into-the-slop-factory
- HF-S36 https://thepostflow.com/ai/higgsfield-ai-review/
- HF-S38 (affiliate) https://aifunnelinsider.com/higgsfield-ai-review-2026/
- HF-S45 (competitor) https://chatcut.io/compare/chatcut-vs-higgsfield

**Runway**
- R-CHG https://runway.com/changelog · R-PRICE https://runway.com/pricing · R-TOS https://runway.com/terms-of-use
- R-GEN45 https://help.runwayml.com/hc/en-us/articles/46974685288467 · R-EDIT https://help.runwayml.com/hc/en-us/articles/51683104370451
- R-DEPR https://help.runwayml.com/hc/en-us/articles/40213860628371 · R-TL https://help.runwayml.com/hc/en-us/articles/52685547867667
- R-AGENT https://help.runwayml.com/hc/en-us/articles/51601639579667 · R-REF https://help.runwayml.com/hc/en-us/articles/52963720640275
- R-UNL1 https://help.runwayml.com/hc/en-us/articles/52068047744019 · R-SEC https://help.runwayml.com/hc/en-us/articles/24300377879827
- R-ENT https://help.runwayml.com/hc/en-us/articles/48625698573075 · R-API https://docs.dev.runwayml.com/
- R-API-PRICE https://docs.dev.runwayml.com/guides/pricing/ · R-API-MODELS https://docs.dev.runwayml.com/guides/models/
- R-API-PRO https://docs.dev.runwayml.com/guides/professional-outputs/ · R-API-MOD https://docs.dev.runwayml.com/api-details/moderation/
- T-RUNWAY https://www.trustpilot.com/review/runwayml.com

**Kling**
- K-BLOG40 https://kling.ai/blog/kling-4-ai-video-model · K-DIRECTOR https://kling.ai/blog/kling-video-3-director-mode-multi-shot-tutorial
- K-CREDIT https://kling.ai/blog/kling-video-3-0-credit-cost-guide · K-POLICY https://kling.ai/docs/user-policy
- K-CAP https://kling.ai/document-api/guides/capability-map/video.md · K-USE40 https://kling.ai/document-api/api/usage-guide/kling-4-0.md
- K-I2V40 https://kling.ai/document-api/api/video/4-0/image-to-video.md · K-CALLBACK https://kling.ai/document-api/api/get-started/callbacks.md
- K-APIPRICE https://kling.ai/document-api/pricing/base/video.md · K-APITOS https://kling.ai/document-api/guides/protocols/paid-service.md
- T-KLING https://www.trustpilot.com/review/kling.ai

**Luma**
- L-NEWS https://lumalabs.ai/news · L-PRICE https://lumalabs.ai/pricing · L-RAY32 https://lumalabs.ai/news/introducing-ray-3-2
- L-MODIFY https://lumalabs.ai/news/ray3-modify · L-SCENES https://lumalabs.ai/news/introducing-luma-scenes · L-SKILLS https://lumalabs.ai/news/luma-skills
- L-MCP https://lumalabs.ai/news/new-luma-mcp · L-TOS https://lumalabs.ai/legal/tos · L-APIPRICE https://lumalabs.ai/api/pricing
- L-API-OLD https://docs.lumalabs.ai/ · L-API-FAQ https://docs.lumalabs.ai/docs/faq.md · L-AG https://docs.agents.lumalabs.ai/
- L-AG-VID https://docs.agents.lumalabs.ai/guides/videos/generation/ · L-AG-FAQ https://docs.agents.lumalabs.ai/guides/faq/
- L-HELP-SNIP (snippet) https://lumaai-help.freshdesk.com/support/solutions/articles/151000220904 · EESEL-L https://eesel.ai/blog/luma-ai-pricing

**Pika**
- P-HOME https://pika.art/ · P-PRICE https://pika.art/pricing · P-FAQ https://pika.art/faq · P-TOS https://pika.art/terms-of-service
- P-BLOG https://pika.art/blog · P-NEW https://pika.art/blog/welcome-to-the-new-pika · P-H3 https://pika.art/blog/pika-h3-flex
- P-H3R https://pika.art/blog/pika-h3-flex-research · P-VS https://create.pika.art/apps/create-video · P-25 https://create.pika.art/apps/pika-2-5
- P-DEV https://dev.pika.art/ · P-HF https://huggingface.co/Pika-Labs/Pika-H3-Flex

**Adobe**
- AD-1 https://community.adobe.com/announcements-727/what-s-new-in-adobe-premiere-26-5-september-2026-1641187
- AD-2 https://www.adobe.com/products/firefly/plans.html · AD-3 https://www.adobe.com/products/premiere.html
- AD-4 https://community.adobe.com/announcements-732/now-released-otio-import-and-export-311699
- AD-5 https://developer.adobe.com/premiere-pro/uxp/changelog
- AD-6 https://blog.adobe.com/en/publish/2026/11/10/adobe-firefly-premiere-mobile-ways-create-videos-edit-content-perfect-soundtrack-stories
- AD-7 https://blog.adobe.com/en/publish/2026/11/10/explore-new-ways-create-across-creative-cloud-adobe-firefly-while-advancing-craft-precision-choice-control
- AD-8 https://www.adobe.com/ai/overview/firefly/gen-ai-approach.html · AD-9 https://nofilmschool.com/adobe-generative-media-tool
- AD-13 https://community.adobe.com/announcements-727/meet-your-new-assistant-editor-ai-assistant-in-premiere-pro-is-now-in-public-beta-1629317
- AD-15 https://community.adobe.com/t5/adobe-firefly-bugs/credits-are-being-deducted-even-when-video-generation-fails/idi-p/15659871
- AD-16 https://community.adobe.com/bug-reports-728/premiere-xml-exports-semantically-suspicious-transition-ratio-values-for-ol-cross-dissolve-1556968

**DaVinci Resolve**
- DR-1 https://www.blackmagicdesign.com/products/davinciresolve/studio
- DR-2 https://www.blackmagicdesign.com/support/content/readme/6aefbffe870f4ba686e61ecb83b19ec0
- DR-3 https://www.blackmagicdesign.com/support/content/readme/baf7c071c0524fbf8ccc961925c9f443
- DR-6 https://digitalproduction.com/2026/09/08/resolve-21-1-adds-mcp-and-finally-gets-presets/
- DR-7 https://www.cined.com/davinci-resolve-21-hands-on-at-nab-2026-photo-page-intellisearch-and-cinefocus-in-action/
- DR-10 (snippet) https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1411.htm

**CapCut**
- CC-1 https://www.capcut.com/help/how-to-export-pro-project · CC-2 https://www.capcut.com/clause/privacy · CC-3 https://www.capcut.com/clause/terms-of-service
- CC-4 https://www.capcut.com/ideas/seedance-2-0-for-pc · CC-5 https://capcut.com/resource/is-capcut-pc-free-for-ai-video-editing
- CC-6 https://www.capcut.com/features/dreamina-seedance-price · CC-7 https://www.capcut.com/help/join-capcut-pro-for-exporting
- CC-8 https://bigvu.tv/blog/capcut-free-vs-pro-what-2026s-restructure-actually-gives-you/

**Blender**
- BL-1 https://developer.blender.org/docs/release_notes/5.3/sequencer/ · BL-2 https://docs.blender.org/manual/en/latest/render/layers/passes.html
- BL-3 https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- BL-4 https://docs.blender.org/manual/en/latest/getting_started/about/license.html · BL-7 https://opendata.blender.org
- BL-8 https://nvd.nist.gov/vuln/detail/CVE-2026-10688 · BL-9 https://www.cgchannel.com/?p=175735
- BL-10 https://developer.blender.org/docs/release_notes/5.3/pipeline_io/ · BL-12 https://github.com/tin2tin/Pallaidium
- BL-13 https://docs.blender.org/manual/en/dev/video_editing/storyboarding/app_template.html

**Google Flow**
- GF-1 https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates
- GF-2 https://venturebeat.com/ai/google-releases-new-ai-video-model-veo-3-1-in-flow-and-api-what-it-means-for
- GF-3 https://yourstory.com/ai-story/google-veo-31-flow-ai-editing-tool · GF-4 https://aitoolsatlas.ai/tools/flow
- GF-5 https://discuss.ai.google.dev/t/veo-flow-generation-issues-lost-credits-consistency-problems-and-excessive-failed-generations/147374
- GF-6 https://rar.design/posts/google-flow-omni-agent-tools-complete-guide · GF-8 https://design-offset.com/202604-google-flow-updates/

**Lightricks**
- LX-1 https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/README.md
- LX-2 https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/desktop-assistant.md
- LX-3 https://raw.githubusercontent.com/Lightricks/LTX-Desktop/main/docs/gen-space-and-video-editor.md
- LX-4 https://www.cined.com/ltx-studio-takes-its-next-big-step-editing/ · LX-5 https://stacksheriff.com/ai-tools/ltx-studio-review/
- LX-6 https://the-decoder.com/lightricks-open-sources-ai-video-model-ltx-2-challenges-sora-and-veo/
- LX-7 https://github.com/Lightricks/LTX-Desktop · LX-8 https://dupple.com/reviews/ltx-studio

**Flora**
- FL-1 https://docs.flora.ai/llms.txt · FL-2 https://docs.flora.ai/mcp/cost-and-limits.md · FL-3 https://docs.flora.ai/mcp/security.md
- FL-4 https://docs.flora.ai/legal/data-security-and-ip.md · FL-5 https://docs.flora.ai/plans-and-billing/pricing
- FL-6 https://www.testingcatalog.com/flora-launches-fauna-ai-design-agent-for-teams

**ComfyUI**
- CU-1 https://docs.comfy.org/tutorials/partner-nodes/overview · CU-2 https://docs.comfy.org/development/cloud/mcp-server
- CU-4 (snippet) https://docs.comfy.org/agent-tools/comfy-cli

**Other products and projects**
- OC-1 https://raw.githubusercontent.com/0xsline/OpenChatCut/main/README.md · CH-1 https://chatcut.io/docs/what-is-chatcut.md
- PA-1 https://github.com/palmier-io/palmier-pro · OM-1 https://github.com/calesthio/OpenMontage
- HY-1 https://github.com/heygen-com/hyperframes · VM-1 https://github.com/HKUDS/ViMax · VF-1 https://github.com/vericontext/vibeframe
- KP-1 https://www.kapwing.com/help/release-notes-august-2026-2/ · IV-1 https://www.trustpilot.com/review/invideo.io ; https://aireiter.com/blog/invideo-ai-review
- EL-1 https://elevenlabs.io/docs/creative-platform/products/studio · KR-1 https://www.krea.ai/docs/llms.txt
- SD-1 https://seed.bytedance.com/blog/one-take-creation-flexible-referencing-introducing-seedance-2-5
- SD-2 https://www.nbcnews.com/tech/tech-news/seedance-2-bytedance-copyright-infringement-concerns-hollywood-rcna259173
- FA-1 https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server · WS-1 https://wavespeed.ai/
- MO-1 https://news.ycombinator.com/item?id=45980760 · DC-1 (snippet) https://docs.platform.decart.ai/getting-started/pricing · OD-1 https://odyssey.ml/
- OA-1 https://developers.openai.com/api/docs/deprecations
- ST-1 https://thenextweb.com/news/freepik-rebrands-as-magnific · ST-2 https://www.fastcompany.com/91431691/figma-weave-weavy-acquisition
- ST-3 https://techcrunch.com/2025/09/04/captions-rebrands-as-mirage-expands-beyond-creator-tools-to-ai-video-research
- ST-4 https://www.helpnetsecurity.com/2025/11/17/cloudflare-to-acquire-replicate/
- CP-1 https://dev.to/smophyai/the-real-cost-of-ai-video-in-2026-why-credit-systems-cost-more-than-the-sticker-price-j6h
- MD-1 (snippet) https://artificialanalysis.ai/video/leaderboard/text-to-video · MD-2 https://docs.ltx.io/open-source-model/getting-started/system-requirements.md
- OS-1 https://github.com/AcademySoftwareFoundation/OpenTimelineIO · OS-2 https://www.remotion.dev/docs/export-opentimeline
- OS-5 https://www.remotion.dev/docs/license/pricing · OS-6 https://github.com/redotvideo/revideo
- OS-7 https://github.com/motion-canvas/motion-canvas · OS-8 https://github.com/OpenCut-app/OpenCut
