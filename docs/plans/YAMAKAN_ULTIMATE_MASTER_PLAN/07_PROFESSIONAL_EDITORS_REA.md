# Professional editing: product standard and source lessons

Research2026-10-23. This compares documented workflows and inspected source seams, not current application benchmarks. Exact application installed builds are UNKNOWN; documentation versions are stated where visible. [08](08_SOURCE_DONOR_MASTER_MATRIX.md) contains immutable donor pins and implementation details.

| Product | Documented workflow/value | Lesson for Yamakan | Limits of this review |
|---|---|---|---|
| Resolve21 | Integrated Edit/Cut, Color, Fusion, Fairlight, media and finishing; [official](https://www.blackmagicdesign.com/products/davinciresolve), [Edit](https://www.blackmagicdesign.com/products/davinciresolve/edit), [Color](https://www.blackmagicdesign.com/products/davinciresolve/color) | One project with coherent specialized workspaces; finishing/color/audio depth is a real competitive requirement | No installed run, no current hardware benchmark or free-vs-Studio entitlement test; do not copy private code |
| Premiere | [Proxy creation](https://helpx.adobe.com/premiere/desktop/organize-media/ingest-proxy-workflow/create-proxies.html) and [color-managed sequences](https://helpx.adobe.com/premiere/desktop/correct-color/set-up-color-management/how-color-management-works.html) | Proxies are derivatives of originals; color metadata and output transforms must be explicit | Current main marketing page is a fragment shell; use help docs, not unsupported version claims |
| After Effects | [Mask tracking](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/track-mask/rigid-mask-tracking.html) produces editable mask-path keyframes | Distinguish masks, tracking data and compositor rendering; preserve editable intermediate state | No full compositor parity, tracker quality or GPU behavior measured |
| CapCut | [Desktop](https://www.capcut.com/tools/desktop-video-editor) presents fast accessible editing, AI and generation integration | Caption/short-video workflow clarity and templates can outweigh a longer feature list | Exact installed build, free/export availability and Arabic quality unverified |
| Final Cut Pro | [Official](https://www.apple.com/final-cut-pro/) Mac/iPad editing, timeline, graphics/audio/color | Connected clip organization, keyboard efficiency and background work | Apple-specific implementation not portable Windows source; exact app version unknown |
| Descript | [Features](https://www.descript.com/features) links transcript editing, Underlord and translated/dubbed workflows | Transcript selection should propose precise media edits with reversible timing | Human Arabic accuracy and dubbing quality untested; hosted functions not local donors |
| Kdenlive26.08 manual | [Editing](https://docs.kdenlive.org/en/cutting_and_assembling/editing.html), [timeline preview](https://docs.kdenlive.org/en/tips_and_tricks/tips_and_tricks/timeline_preview_rendering.html) | Keyboard/source-monitor workflow, segment preview caching and proxies | Qt/MLT model and undo coupling require adaptation; no whole-app transplant |
| Shotcut | [Features](https://www.shotcut.org/features/) describe MLT media/format/filter/editor integration | Native media-profile handling and preview are mature comparison candidates | Source job stop/queue semantics cannot replace Yamakan ownership without proof |
| Olive | Public editor source candidate | Node compositing and cache design worth deeper study if needed | Deferred source selection; no current stable/maturity claim |
| Blender | Public compositor/VSE candidate | Rich scene/compositing/render pipeline valuable for optional asset production | Heavy runtime/UI/scene authority; no core engine adoption justified here |

## Minimum defensible professional editing floor

Before claiming professional editing quality, finish a bounded **short-form professional workflow**, not an all-format Resolve replacement:

1. Canonical multitrack trims, split, ripple, insert/overwrite, linked sound, grouping, lock/mute/solo, writer-safe undo, relink, autosave and complete recovery.
2. Qualified rational rates24/25/30 and24000/1001,30000/1001,60000/1001 in declared profiles; source PTS/proxy mapping and retime/audio synchronization proven.
3. Responsive proxy playback with accurate reference rendering; background jobs cannot make editing unusable. Long/multitrack limits rise only after a measured profile qualifies.
4. Typed transforms/crop/opacity, at least a qualified crossfade transition, keyframe curves, audio gain/fades/loudness and caption tracks. Masks/tracking are a separately gated extension.
5. Explicit SDR Rec.709 color handling and bounded LUT import; no HDR/ACES claim until source/output/preview transforms and display path qualify.
6. Reliable presets, preflight, frame/audio validated export, batch variants, original-preserving derivatives and understandable unsupported-media errors.
7. Keyboard-first editing, accessible panels, Arabic/English text and native language review. A clean unsigned RC on a developer profile is not a released desktop application.

The floor is a future acceptance scope. Existing main proves a smaller subset; do not rewrite those completed receipts as failing to implement requirements that did not exist then.

## Copy-first comparison

**OpenCut** supplies narrow reusable timing/keyframe/timeline interaction ideas already partially imported; keep exact imported provenance and avoid blind upstream synchronization. **OpenVideoStudio** provides inherited UI utilities but many controls are not connected to canonical/export semantics. Adapt only after typed plan support exists. **MLT/Kdenlive/Shotcut** offer richer preview/profile machinery but C++/Qt/native closure and a different timeline authority make them poor immediate whole-editor donors. **FFmpeg** remains the render/reference baseline. **OpenTimelineIO** is interchange, not playback or an editing authority. **Remotion** can inform deterministic scripted scenes but a second React/Chromium renderer would need explicit parity/packaging justification. **GStreamer** is a streaming graph candidate, not a shortcut around timeline semantics.

## Prioritization

First fix recovery/persistence, canonical browser commands and large-media waveform behavior. Then proxies/preview and rational time. Then a small typed effects/audio/captions stack. Only after measured demand consider advanced compositing/tracking, native GPU preview, HDR or multicam. Each stage must improve a complete creator task and preserve old projects. [12](12_PROFESSIONAL_EDITING_ROADMAP.md) gives concrete performance scenarios and [18](18_ATOMIC_IMPLEMENTATION_TASKS.md) gives atomic acceptance criteria.
