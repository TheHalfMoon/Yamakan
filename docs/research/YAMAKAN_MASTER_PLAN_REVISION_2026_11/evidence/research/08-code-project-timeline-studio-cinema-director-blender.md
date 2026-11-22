# 08 - Code assessment: project, timeline, Studio, Cinema, Director, Blender

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Repository: `a local read-only worktree` (git worktree of github.com/TheHalfMoon/Yamakan), HEAD `0284ba8` = merge of PR #276 `feat/blender-matchmove` on origin/main. Assessment date: 2026-11-11.

Method: read-only. Intent documents were read first (AGENTS.md, README.md, specs/CURRENT.md, docs/PROJECT_DATA_MODEL.md, docs/adr/0001-0003, docs/SECURITY.md, docs/FOUNDER_DECISION_RECORD.md, NOTICE), then every claim below was checked against code in `core/`, `src/`, `scripts/`, `native/`, `tests/`, `e2e/`. Nothing in the repository was modified, built, run or downloaded. `git status --short` was empty at the end.

How to read the status classes:

- IMPLEMENTED+TESTED: code path read, and a dedicated test file exists by name under `tests/` (139 files match `tests/*.test.ts`). Tests were NOT run (not allowed), and most test bodies were not read; "TESTED" means "has dedicated automated tests in the tree", not "observed passing".
- IMPLEMENTED (thin/no tests): code path read; no dedicated test identified, or only a narrow one.
- STUB/SCAFFOLD: contract, flag or placeholder exists; no working behaviour for a person.
- DOC-ONLY: stated in a document; not found in code.
- ABSENT: not in code and not meaningfully documented as shipped.

A recurring pattern matters more than any single row: **many capabilities are implemented and tested at the command layer (REST/CLI/MCP/SDK) but have no browser control.** The table in section (c) separates "model/command" status from "UI" status for that reason.

---

## (a) Module map

### Core (Node service, single authority)

| Area | Path | What it is |
|---|---|---|
| Canonical project | `core/canonical.ts` (761 lines) | `yamakan.project` format, zod strict schema, upgrades, canonical/edit-view conversion |
| Edit view | `core/project.ts` (284) | Frame-based projection of the same project for the editor (`ProjectSchema`, `createProject`) |
| Typed operations | `core/timeline/operations.ts` (1139) | `OperationSchema` (30 op types), `BatchSchema` (1-64 ops), reducers |
| Animation | `core/timeline/animation-schema.ts` (66), `core/animation/*` | Keyframe channel schema; interpolation/sampling (bodies not read) |
| Effects | `core/effects/registry.ts` (172), `core/effects/color.ts` | Transform/crop effect, LUT effect, FFmpeg filter fragments |
| Transitions | `core/transitions.ts` (171) | `centeredDissolve/v1`, dissolve only |
| Creative documents | `core/document-ref.ts` (87), `core/documents.ts` (339) | Immutable content-addressed side documents referenced from a project revision |
| Story, takes, packs | `core/story.ts` (495), `core/takes.ts` (373), `core/continuity.ts` (685), `core/identity.ts` (197) | Story document, shot/take model, reference packs, consent, continuity resolution |
| Cinema | `core/scene3d.ts` (356), `core/cinema-store.ts` (172), `core/cinema/control-compiler.ts`, `core/cinema/glb.ts` | `yamakan.scene3d` v1, legacy file store, shot-intent control compiler, .glb checker |
| Studio | `core/studio.ts` (215) | `yamakan.studio-document` v1 validation and hashing |
| Director | `core/director/stages.ts`, `manifest.ts`, `runtime.ts` (827), `cinema-pipeline.ts`, `cinema-shot.ts`, `core/director-flags.ts` | Stage ledger, pipeline manifests, deterministic Blender shot planner |
| Blender | `core/blender/runtime.ts`, `scene.ts`, `track.ts`, `worker.ts`; `scripts/blender/yamakan_render.py`, `yamakan_track.py`; `scripts/blender-install.ts`; `scripts/qualify-blender-e2e.mjs` | Pinned runtime, scene translation, camera track format, fixed Python scripts, install and qualification |
| Render/export | `core/render.ts` (1049), `core/render/plan.ts` (474), `core/render/animation-filters.ts`, `core/render/parity.ts` (148), `core/render/{segments,preview,fonts,ass,capability}` | Immutable render plan, FFmpeg filtergraph, reference preview, parity list |
| Interchange | `core/interchange/otio.ts` (561) | OTIO JSON export, loss report, import-as-proposal |
| Captions | `core/captions.ts` (494) | SRT/WebVTT import, cue editing, export, burn-in |
| Generation | `core/engines/generation.ts` (625), `core/engines/{kaggle,comfyui,candidates,contract-v2,manifests,clean-image}` | Generation service, ledger, Kaggle route (another agent covers this in depth) |
| Jobs | `core/jobs.ts` | Job kinds `export`, `blender-render`, `blender-track`, `cfr-derivative` |
| Store | `core/store.ts` (4025) | SQLite workspace DB (`WORKSPACE_SCHEMA_VERSION = 18`), snapshots, revisions, documents, history |
| Recovery | `core/recovery.ts` (1575) | Online backup, restore into a new root, verification, quarantine |
| Commands | `core/command/registry.ts` (3078) | About 115 `yamakan.*` commands, single entry for REST/CLI/MCP/SDK/browser |
| Native containment | `native/procd/src/container.rs` | AppContainer / Job Object worker profile |

### Browser (same-origin client of the command registry)

| Area | Path | What it is |
|---|---|---|
| App | `src/main.tsx` (2804) | One `App` component holding all state, panels and all four workspaces |
| Shell | `src/workspaces/ProjectShell.tsx` (161) | `WORKSPACES = ["create","story","edit","finish"]`, tabs, kept-mounted panels, classic shell flag |
| Edit plumbing | `src/edit-ops.ts` (326), `src/edit-diff.ts` (341), `src/adapter.ts` (110) | Local edit helpers, edit-to-operations diff, project-to-donor-editor adapter |
| Timeline (donor) | `src/editor/components/Timeline.tsx` (1487), `Waveform.tsx`, `icons.tsx`, `src/editor/types.ts` (2038), `src/editor/utils/*`, `src/editor/editor.css` (1704) | Imported timeline UI and its types |
| Preview | `src/editor/components/PreviewPlayer.tsx` (1271), `src/reference.tsx` (228) | Interactive Canvas 2D preview; server-rendered reference preview |
| Create | `src/create/CreateWorkspace.tsx` (749), `GeneratePanel.tsx` (534), `ElementsPanel.tsx` (310), `PeoplePanel.tsx` (479), `PromptLibrary`, `PromptPresets`, `create-story.ts`, `create-elements.ts`, `create-model.ts`, `create-people.ts` | Prompt-first workspace |
| Cinema | `src/cinema/CinemaViewport.tsx` (1064), `BlenderRender.tsx` (401), `blenderRender.ts` (102), `cinemaProject.ts`, `cinemaModels`, `cinemaObjects`, `camera/*` | three.js previs viewport and Blender render panel |
| Director | `src/director/DirectorPanel.tsx` (408), `CinemaShot.tsx` (491), `TakeReview.tsx` (293) | Director panel, cinema-blender shot flow, take review |
| Studio | `src/studio/StudioCanvas.tsx` (446), `src/studio/canvas-engine/*`, `src/studio/host/*`, `src/studio/workbench/*` | InvokeAI-derived canvas engine and host |
| Captions | `src/captions.tsx` (468) | Caption import/edit/burn-in/export panel |
| i18n / style | `src/i18n.ts` (1557), `src/style.css` (1136) | EN/AR messages, tokens |
| Unused | `src/flow/FlowView.tsx` (40) | Defined, never rendered |

Tracked file counts: `src` 419, `core` 136, `server`+`native`+`sdk`+`cli`+`mcp` 19, `tests/*.test.ts` 139, `e2e/testerarmy/tests` 2 (both Studio).

---

## (b) The canonical project/timeline schema as it exists

### One authority, two shapes, plus side documents

There is exactly **one canonical project authority**: the `yamakan.project` body defined in `core/canonical.ts`, stored as immutable canonical-JSON snapshots addressed by SHA-256 in SQLite. The frame-based "edit view" in `core/project.ts` is a lossless projection of it (`fromEditView` `core/canonical.ts:539-631`, `toEditView` `:649-759`), not a second model. Larger creative state lives in **creative documents**: immutable, content-addressed JSON side documents that the project revision references by `DocumentRef {id, kind, schemaVersion, contentHash}` (`core/document-ref.ts:79-86`). A project revision therefore pins the whole creative closure.

There is **one implicit timeline per project**. There is no `Sequence`/`Timeline` entity: `tracks` and `clips` are flat arrays on the project body (`core/canonical.ts:200-205`).

### Format and versioning

- `FORMAT` `core/canonical.ts:30`; `FORMAT_VERSION = 5` `:34`; `EFFECTS_FORMAT_VERSION = 6` `:39`; `TRANSITIONS_FORMAT_VERSION = 7` `:42`.
- Written version is the **oldest version that can hold the content** (`versionFor` `:50-57`), so projects without effects/transitions keep their bytes and hash.
- Versions 1-3 are upgraded on read (`upgradeV1` `:405-430`, `upgradeV2` `:434-488`, `upgradeV3` `:511-513`); a newer-than-known version returns `RECOVERY_REQUIRED` rather than being guessed at (`parseCanonical` `:490-508`, `inspectFormat` `:377-399`).
- Time is integer flicks (705,600,000 per second) with rational fps. The edit view supports only 30 and 24000/1001 fps (`core/canonical.ts:652-656`, `core/project.ts:19-22`).

### Project body (`ProjectBody`, `core/canonical.ts:166-212`)

| Field | Type / limits | Line |
|---|---|---|
| `format`, `formatVersion` | literal + one of four versions | `:168-174` |
| `id`, `name` | Id, 1-120 chars | `:175-176` |
| `revision` | integer 0..10000 | `:177` |
| `language` | `en` or `ar` | `:178` |
| `output` | width 16..1920 even, height 16..1080 even, `fps` rational | `:179-195` |
| `assets` | `CanonicalAsset[]` | `:196-198` |
| `scenes` | `CanonicalScene[]`, max 100 | `:199` |
| `tracks` | `CanonicalTrack[]`, max 16 | `:200-202` |
| `clips` | `CanonicalClip[]`, max 200 | `:203-205` |
| `documents` | `DocumentRef[]` | `:207-210` |

Timeline length is capped at ten minutes (`MAX_TIMELINE_TICKS` `:60`).

### Entities

| Entity | Fields | Evidence |
|---|---|---|
| Asset | `id, name, kind (image/video/audio), hash (sha256), extension, bytes, width, height, durationTicks, timebase, hasAudio` | `core/canonical.ts:62-93` |
| Track | `id, name, kind (video/audio), muted, locked, solo, targeted` | `:102-112` |
| Clip | `id, trackId, assetId (nullable), startTicks, durationTicks, sourceStartTicks, title (<=500, nullable), gainDb, fadeInTicks, fadeOutTicks, sound, speed?, animation?, effects?, transition?` | `:113-140` |
| Clip sound | `enabled, gainDb (-60..12), fadeInTicks, fadeOutTicks` (embedded audio of a video clip) | `:94-101` |
| Timeline shot | `id, name, clipIds (<=200)` | `:142-148` |
| Timeline scene | `id, name, referenceAssetId, camera {focalLengthMm 8-300, shotScale wide/medium/close, movement static/dolly/pan/orbit}, shots (<=100)`. Comment `:154`: "Camera values are labelled intent, not an applied-conditioning receipt." | `:149-164` |
| Animation | channels `transform.positionX/Y`, `transform.scaleX/Y`, `transform.rotate`, `opacity`, `volume`; scalar keys, <=512 per channel | `core/timeline/animation-schema.ts:15-63` |
| Effects | `TransformEffectSchema` (position, scale, crop), `LutEffectSchema`; limits in `EFFECT_LIMITS` | `core/effects/registry.ts:22-75` |
| Transition | `kind: "dissolve"` only; audio `equalPower` or `cut`; policy `centeredDissolve/v1` | `core/transitions.ts:23-44` |
| Document ref | `id, kind, schemaVersion, contentHash`; kinds `studio, cinemaScene, story, referencePack, captions, lut, promptPresets` | `core/document-ref.ts:53-86` |

### Side documents (referenced by the project revision)

| Document | Fields | Evidence |
|---|---|---|
| Story (`yamakan.story` v1) | `title, scenes[] {id, name, shots[]}`; limits 50 scenes, 100 shots/scene, 200 shots, 8 takes/shot, 4 packs/shot | `core/story.ts:22-34`, `:104-142` |
| Story shot | `id, name, durationTicks, notes (<=2000), referencePacks[] (pinned by document id + content hash), takes[] (<=8), selectedTakeId` | `core/story.ts:92-102` |
| Take | `id, assetId, sourceStartTicks, lineage?` | `core/story.ts:75-83` |
| Take lineage | `label?, outputHash, inputs[] {assetId, assetHash}, continuity?[]`. **No prompt, model, seed, recipe or parameter fields.** | `core/story.ts:63-73` |
| Reference pack (`yamakan.reference-pack` v1) | `name, entries[] {id, role, label, assetId, assetHash, characterId, consentId}`; roles `character, environment, prop, wardrobe, style, camera, voice, fictional-character`; `character` and `voice` require a character id and a consent | `core/story.ts:145-196` |
| Cinema scene (`yamakan.scene3d` v1) | items (boxes, models) with transforms; camera **intrinsics only** (`focalLengthMm, sensorWidthMm, near, far`). No camera transform, path, keyframes, lights or timing. | `core/scene3d.ts:12-20`, `:43-61`, `:64-108` |
| Studio (`yamakan.studio-document` v1) | canvas document validated and hashed; bitmaps by digest | `core/studio.ts:9-48`, `core/documents.ts:161-248` |
| Captions | cues (<=2000, <=500 chars, <=4 lines), `srt` or `vtt` | `core/captions.ts:26-45` |
| LUT, prompt presets | document kinds | `core/document-ref.ts:53-77` |

### What is NOT in the persisted model

Checked against `core/canonical.ts:62-212`, `core/timeline/operations.ts:65-308` and the document kinds:

- Multiple sequences/timelines, nested sequences: ABSENT.
- Markers: ABSENT (the only occurrences of "marker" in `core/` are OTIO keys the importer declines to read, `core/interchange/otio.ts:397`, `:406`, `:435`, and unrelated .glb/JPEG code).
- Characters / "elements" as first-class project entities: ABSENT. They exist only as entries of reference-pack documents. `CharacterAssetSchema` (`core/identity.ts:60-73`) is referenced only by `core/identity.ts` and `tests/identity.test.ts:100`.
- Camera paths / camera keyframes: ABSENT (see section d).
- Generation records / provenance inside the project: ABSENT. They live in the generation job ledger (`GenerationRecord`, `core/engines/generation.ts:63-97`).
- Narration, TTS, lipsync, voice tracks: ABSENT (no matches in `core/` for narration, lipsync or text-to-speech).
- Title styling (font, size, colour, position, motion): ABSENT; a title is a string on a clip (`core/canonical.ts:122`).
- Per-clip take stack: ABSENT on the clip; takes hang off a story shot in a separate document.

### Persistence, autosave, recovery, undo

- **Store**: SQLite workspace database, `SNAPSHOT_FORMAT = "yamakan.project/2"` `core/store.ts:180`, `MAX_REVISION = 10000` `:182`, `WORKSPACE_SCHEMA_VERSION = 18` `:183`. Tables include `asset_objects` `:190`, `asset_versions` `:198`, `jobs` `:212`, `creative_documents` `:280`, `studio_bitmaps` `:322`, `director_runs` `:364`, `director_attempts` `:372`, `likeness_consents` `:385`, `identity_encodings` `:407`, `cinema_models` `:436`, `asset_replacements` `:464`, `story_document_versions` `:556`, `edit_history` `:565`, `edit_cursor` `:573`, `snapshots` `:580`, `projects` `:586`, `command_receipts` `:591`, `revisions` `:600`, `outbox` `:609`. Media objects are content-addressed files on disk. There is **no generations/provenance table**.
- **No browser-side project authority**: no OPFS/IndexedDB store. The browser keeps a local past/present/future history (`src/main.tsx:160-176`), a draft Create brief in `localStorage` (`src/create/CreateWorkspace.tsx:73-81`) and UI preferences (`src/workspaces/ProjectShell.tsx:16-17`).
- **Autosave**: each finished gesture is committed 400 ms after pointer release (`commitSoon`, `src/main.tsx:507-518`) as a typed-operation batch computed by `operationsBetween` (`src/edit-diff.ts:144-179`) and sent as `yamakan.project.applyBatch` with `expectedRevision` (`src/main.tsx:416-421`). On `REVISION_CONFLICT` it merges only when the touched ids are disjoint (`:445-474`); otherwise the unapplied change is offered as a download (`:476-482`). A change no operation can express stays a draft (`:405-408`) and falls back to whole-project `save` (`:547-566`). `beforeunload` guards unsaved work (`:598-607`).
- **Creative documents are explicit-save**: Cinema scene, Studio canvas, captions, story, packs and presets are committed against the head revision by their own Save actions; an unsaved-document registry (`src/main.tsx:197-205`) blocks undo/restore while they are dirty.
- **Undo/redo**: server-side, revision-bound, per principal (`core/store.ts:3248-3356`, commands `:1634`, `:1648` in `core/command/registry.ts`), plus the local history driving the toolbar buttons (`src/main.tsx:737-792`). Known debt: each undo/redo writes a full snapshot and consumes the 10,000-revision budget (`specs/CURRENT.md:248`).
- **Revision history and restore**: `history` `core/store.ts:3093-3139`, `restore` `:3140-3182`; UI panel `src/main.tsx:2253-2333`.
- **Backup/recovery**: online workspace backup (database copy, every ready content object re-hashed, manifest written last), restore only into a new root, verification, quarantine of what cannot be verified (`core/recovery.ts:1-12`, `:44-45`); commands `workspace.backup/backups/restore/collectGarbage` (`core/command/registry.ts:1674-1719`); UI `src/main.tsx:2094-2191`.

---

## (c) Capability status table

"Model/command" = schema + command + reducer/worker. "UI" = a control a person can reach in the browser. Line numbers in `core/command/registry.ts` are abbreviated "reg".

### Project and data

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Canonical project format and validation | IMPLEMENTED+TESTED | `core/canonical.ts:166-342`; `tests/canonical.test.ts`, `tests/canonical-store.test.ts` | Strict zod, canonical JSON, SHA-256 |
| Format upgrades (v1-3 read, v4-7 written, newer refused) | IMPLEMENTED+TESTED | `core/canonical.ts:377-513`; `tests/migrate.test.ts`, `tests/migrate-audio-preservation.test.ts` | Oldest-version-that-fits writes |
| Edit-view projection | IMPLEMENTED+TESTED | `core/canonical.ts:539-759`; `core/project.ts:139-232`; `tests/rational-fps.test.ts`, `tests/time.test.ts` | Only 30 and 23.976 fps |
| SQLite snapshots, revisions, receipts | IMPLEMENTED+TESTED | `core/store.ts:180-183`, `:580-609`; `tests/workspace-db.test.ts` | |
| Typed operation batches with compare-and-swap | IMPLEMENTED+TESTED | `core/timeline/operations.ts:65-310`; `core/store.ts:3184-3226`; reg `:1608`; `tests/timeline.test.ts` | 1-64 ops, atomic |
| Per-gesture autosave | IMPLEMENTED+TESTED | `src/main.tsx:369-518`; `src/edit-diff.ts:144-341`; `tests/browser-command-history.test.ts` | Disjoint-id merge only |
| Undo/redo | IMPLEMENTED+TESTED | `core/store.ts:3248-3356`; `src/main.tsx:737-792`; `tests/undo-across-documents.test.ts` | Consumes revision budget |
| Revision history / restore | IMPLEMENTED+TESTED | `core/store.ts:3093-3182`; `src/main.tsx:2253-2333` | |
| Backup, restore, quarantine | IMPLEMENTED+TESTED | `core/recovery.ts:1-45`; reg `:1674-1719`; `tests/recovery.test.ts`, `tests/backup.test.ts`, `tests/creative-recovery.test.ts` | Restore into a new root only |
| Creative documents (immutable, hash-pinned) | IMPLEMENTED+TESTED | `core/document-ref.ts:53-86`; `core/documents.ts:274-330`; `core/store.ts:1509`, `:1610`; `tests/creative-documents.test.ts`, `tests/creative-revision-journey.test.ts`, `tests/document-staging.test.ts` | |
| Multiple sequences per project | ABSENT | `core/canonical.ts:200-205` | `primaryTimelineId` is DOC-ONLY (`docs/PROJECT_DATA_MODEL.md:41`) |
| Markers | ABSENT | `core/timeline/operations.ts:65-308` | |
| Provenance records in the project | ABSENT | `core/engines/generation.ts:50-61` | Ledger only |

### Timeline editing

| Capability | Model/command | UI | Evidence |
|---|---|---|---|
| Trim | IMPLEMENTED+TESTED (`clip.trim`) | Yes (drag, Shift+arrow) | ops `:98-106`; `Timeline.tsx:859-869`; `tests/timeline.test.ts` |
| Split | IMPLEMENTED+TESTED (`clip.split`) | Yes | ops `:107-114`; `Timeline.tsx:1077-1085`; `src/main.tsx:1871` |
| Move with snapping | IMPLEMENTED+TESTED (`clip.move`) | Yes | ops `:115-125`; `Timeline.tsx:853-857`, `:1086-1093`; `tests/timeline-placement.test.ts` |
| Multi-track (<=16; mute/lock/solo/target) | IMPLEMENTED+TESTED | Add track, basic toggles | ops `:66-85`; `core/canonical.ts:102-112`; `Timeline.tsx:1100-1107` |
| Ripple delete / ripple trim | IMPLEMENTED+TESTED (`timeline.rippleDelete`, `timeline.rippleTrim`) | **No** | ops `:267-280`; reg `:1483`, `:1503`; `tests/ripple.test.ts`. `rippleDeleteClip` exists at `src/edit-ops.ts:239` but is not imported by `src/main.tsx:53-65` |
| Insert edit | IMPLEMENTED+TESTED (`timeline.insert`) | **No** | ops `:281-292`; reg `:1532` |
| Group move | IMPLEMENTED+TESTED (`timeline.groupMove`) | **No** | ops `:293-307`; reg `:1569`; `tests/group-move.test.ts`; `groupMoveClips` `src/edit-ops.ts:246` unused |
| Slip / slide / roll | **ABSENT** | Unreachable donor code | No op type in ops `:65-308`. Donor branches at `Timeline.tsx:431`, `:492`, `:502`, `:567` are dead: `trimMode="normal"` is hard-coded with no `onTrimModeChange` (`src/main.tsx:1860`) |
| Constant speed / retime | IMPLEMENTED+TESTED (`clip.setSpeed`) | **No** | ops `:190-202`; reg `:1252`; `tests/set-speed.test.ts`, `tests/retime.test.ts`; `setClipSpeed` `src/edit-ops.ts:172` unused |
| Keyframes, 7 channels | Schema IMPLEMENTED+TESTED | Start/end opacity and volume only | `core/timeline/animation-schema.ts:41-63`; ops `:203-222`; `src/main.tsx:1626-1803`; `tests/animation-*.test.ts` |
| Keyframes rendered | **Opacity and volume only** | n/a | `core/render/animation-filters.ts:9-11`: "Transform channels are not rendered (yet): a plan that has them is refused before rendering"; refusal at `:252-256` (`CAPABILITY_UNAVAILABLE`, "remove it to export") |
| Transform (position/scale) and crop | IMPLEMENTED+TESTED (`clip.setEffects`) | Yes (transform panel) | `core/effects/registry.ts:22-43`, `:150-172`; `src/main.tsx:1476-1625`; `tests/effect-parity.test.ts` |
| LUT / colour | IMPLEMENTED+TESTED (LUT effect, `lut.import`) | **No** | `core/effects/registry.ts:49-56`; reg `:1022`; `tests/color-pipeline.test.ts`. No grading, wheels or scopes anywhere in the model |
| Transitions | Dissolve only, IMPLEMENTED+TESTED | Yes (dissolve panel) | `core/transitions.ts:23-44`, `:111-171`; `src/main.tsx:1419-1475`; `tests/transitions.test.ts`, `tests/dissolve-edit.test.ts` |
| Audio: gain, fades, sound on/off, volume keys, mute/solo | IMPLEMENTED+TESTED | Gain and on/off; fades are zeroed, not editable | `core/canonical.ts:94-101`, `:124-128`; `src/main.tsx:1357-1418` (fades zeroed `:1378-1379`, also `:672-673`) |
| Sound unlink / relink | IMPLEMENTED+TESTED | Not found in `src/main.tsx` | ops `:223-237`; reg `:1426`, `:1456`; `tests/w18-audio-flow.test.ts` |
| Loudness normalisation on export | IMPLEMENTED+TESTED | **No** | `core/audio/loudnorm.ts:5`; `tests/loudness-export.test.ts` |
| Mixer, pan, buses, meters | ABSENT | ABSENT | Not in schema |
| Titles | IMPLEMENTED+TESTED (string) | Add title only; each add creates a new "Titles" track; no styling | `core/canonical.ts:122`; ops `:127`; `src/main.tsx:1804-1845`; `src/adapter.ts:81-99` (hard-coded `textConfig`); `tests/typography.test.ts` |
| Captions (SRT/VTT import, cue edit, split, burn-in, export) | IMPLEMENTED+TESTED | Yes (Finish) | `core/captions.ts:1-45`; reg `:1070-1184`; `src/captions.tsx:1-80`; `tests/captions.test.ts` |
| Transcription | STUB/SCAFFOLD | No | reg `:2329-2363` always throws `CAPABILITY_UNAVAILABLE` (":2354-2355 the recognizer worker is not implemented yet"); `tests/transcription-contract.test.ts` |
| Scene-cut analysis | Command exists | No | reg `:1781` (body not read) |
| Proxies | IMPLEMENTED | Yes | reg `:1801-1823`; `src/proxies.ts:125`; `src/adapter.ts:34-38` (`core/media/proxies.ts` not read) |

### Playback, render, interchange

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Interactive preview | IMPLEMENTED (thin tests) | `src/editor/components/PreviewPlayer.tsx:541` (Canvas 2D), `:387-411` (HTMLVideoElement/Image/Audio per clip), `:346-349` (AudioContext) | No WebCodecs, WebGL or WebGPU. Clock is a 33 ms `setInterval` (`src/main.tsx:573-584`). Approximate by design |
| Preview parity list | IMPLEMENTED+TESTED | `core/render/parity.ts:16-48`, `:71-131`; `src/main.tsx:1323-1340`; `tests/preview-parity.test.ts` | Canvas does not show fades, animation, crop, dissolve (shown as cut), LUT, gain above unity |
| Reference preview (server-rendered frame / 60-frame segment of saved revision) | IMPLEMENTED+TESTED | `src/reference.tsx:1-5`, `:24`, `:54-65`, `:172-181`; `core/render/plan.ts:1-6`; `tests/preview.test.ts`, `tests/render-segments.test.ts` | Same compiler, filtergraph, ASS titles and fonts as export |
| Export | IMPLEMENTED+TESTED | `core/render.ts:789-860`; `core/render/plan.ts:49-63`; reg `:1976-1993`; `tests/export-golden.test.ts`, `tests/render-plan.test.ts` | H.264 libx264 `veryfast` CRF 20 yuv420p Rec.709 limited + AAC 192k 48 kHz in MP4 `+faststart`, or `.m4a`; FFmpeg in a contained worker; partial then final file |
| Export settings (codec, bitrate, container) | ABSENT | `src/main.tsx:803-825` | Finish exposes output size and seconds only (`:2750-2763`) |
| Batch export (<=4 sizes) | IMPLEMENTED (command only) | reg `:1994-2033` | No UI caller |
| HDR, 10-bit, ProRes/DNx, HEVC/AV1, image sequences, alpha | ABSENT | `core/render/plan.ts:54-63` | "MVP output profile: SDR 8-bit 4:2:0" |
| OTIO export + loss report + import as proposal | IMPLEMENTED+TESTED (command only) | `core/interchange/otio.ts:131-270`, `:345`; reg `:454-474`; `tests/otio.test.ts`, `tests/otio-commands.test.ts` | No UI caller. Titles, gain, fades, speed, animation, scenes, documents dropped on export (`:209-270`) |
| EDL, FCPXML, AAF | ABSENT | | |

### Shell, Studio, i18n

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Workspace shell (Create / Story / Edit / Finish) | IMPLEMENTED | `src/workspaces/ProjectShell.tsx:13`, `:70-161`; `src/main.tsx:2353-2791` | Classic shell behind `?shell=classic` (`:21-32`) |
| Studio document format, persistence, CAS save | IMPLEMENTED+TESTED | `core/studio.ts:34-48`, `:145-171`; `src/studio/StudioCanvas.tsx:142-280`; `tests/studio.test.ts`, `tests/studio-persistence.test.ts`; `e2e/testerarmy/tests/studio-save.e2e.ts`, `studio-reopen.e2e.ts` | |
| Studio as a usable image editor | STUB/SCAFFOLD | `src/studio/StudioCanvas.tsx:341-445` | Two 1024x1024 canvases, save state, reload/discard, Save. No tool palette, layer panel, brush or colour controls rendered |
| EN/AR localisation with RTL | IMPLEMENTED+TESTED | `src/i18n.ts:749-751` (compile-time key parity), `:1538`; `src/main.tsx:107-115`; `tests/i18n.test.ts` | Gaps in section (f) |
| Onboarding | ABSENT | `src/main.tsx:1911-1920` | Empty state is three text lines |
| Simple vs advanced mode | Partial | `src/main.tsx:2707-2712`, `:2786-2789` | Only `<details>` disclosure; no explicit mode |

### Cinema

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Scene3D format and validation | IMPLEMENTED+TESTED | `core/scene3d.ts:43-108`, `:318-356`; `tests/cinema.test.ts`, `tests/cinema-objects.test.ts`, `tests/cinema-optics.test.ts` | |
| three.js viewport (orbit, add box, add .glb, nudge/turn/scale buttons, lens presets) | IMPLEMENTED+TESTED | `src/cinema/CinemaViewport.tsx:2-3`, `:800-944`, `:946-1063`; `tests/cinema-model-page.test.ts` | No gizmo, numeric fields, lights or camera placement seen |
| Scene saved as project document | IMPLEMENTED+TESTED | `src/cinema/cinemaProject.ts:127-173`; `tests/cinema-project.test.ts` | |
| Legacy workspace-file scene store | IMPLEMENTED+TESTED, still writable | `core/cinema-store.ts:44-85`; reg `:2081-2099` (`scene.save` writes via `persistCinemaScene`), `:2122-2151` (`scene.migrate`); `tests/cinema-migration.test.ts` | Second persistence path, see (h) |
| .glb model store by digest, strict check | IMPLEMENTED+TESTED | `core/store.ts:436`; `core/cinema/glb.ts`; `tests/cinema-model-store.test.ts`, `tests/glb-check.test.ts` | <=8 models per render |
| Shot-intent control compiler | IMPLEMENTED+TESTED (command only) | `core/cinema/control-compiler.ts:23-257`; reg `:1742-1780`; `tests/control-compiler.test.ts` | Input and output are not persisted; no UI caller; no generator consumes it |
| Camera path / keyframes / lights in the scene | ABSENT | `core/scene3d.ts:43-108` | |
| AI-conditioned camera, generative video from scene | ABSENT (declared) | `src/cinema/CinemaViewport.tsx:79-83`, `:951` | |

### Director

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Durable stage ledger with prerequisites | IMPLEMENTED+TESTED | `core/director/stages.ts:14-55`, `:69-194`; `core/director/runtime.ts:678-819`; `core/store.ts:364-372`; `tests/director-stages.test.ts`, `tests/director-durability.test.ts` | |
| Human approval bound to output hash with expiry | IMPLEMENTED+TESTED | `core/director/stages.ts:200-255`; reg `:2700-2734` (humanOnly, ttl <= 30 days) | UI uses 24 h (`src/director/CinemaShot.tsx:47`) |
| Pipeline manifests as data | IMPLEMENTED+TESTED | `core/director/manifest.ts:7-50` | `tools_available` max 0: a manifest cannot name tools |
| `framework-smoke` pipeline | STUB/SCAFFOLD | `core/director/manifest.ts:91-129`; `src/director/DirectorPanel.tsx:357-395` | Stage bookkeeping only; no executors |
| `cinema-blender` pipeline | IMPLEMENTED+TESTED | `core/director/cinema-pipeline.ts:26-160`; `core/director/cinema-shot.ts:138-218`; `tests/director-cinema.test.ts`, `tests/director-cinema-shot.test.ts`, `tests/blender-render.test.ts:408` | Deterministic: four choices become coloured boxes at 320x180, 8 samples (`:199-203`) |
| Model-driven stages (script, shot list, generation, review) | ABSENT | `core/director-flags.ts:28-32` lists "model-dependent-stages", "paid-inference", "agent-human-approval" as unsupported | |
| Director UI | IMPLEMENTED (thin) | `src/director/DirectorPanel.tsx:260-408`; `src/director/CinemaShot.tsx:209-269` | Collapsed `<details>` in Story; two English debug buttons and raw JSON |

### Blender

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Pinned runtime, hash verification per run | IMPLEMENTED+TESTED | `core/blender/runtime.ts:12-31`, `:75-112`, `:180-207` | Blender 5.3.0 Windows x64 |
| Install from a zip the person downloaded | IMPLEMENTED | `scripts/blender-install.ts:1-10` ("Yamakan never downloads it itself"), `:49-54`, `:86-92` | |
| Contained render job | IMPLEMENTED+TESTED | `core/jobs.ts:1260-1572` (args `:1377-1396`, receipt `:1439-1462`, FFmpeg `:1484-1522`, attach asset `:1556-1571`); `native/procd/src/container.rs:427-461`; `tests/blender-render.test.ts` (17 named cases), `tests/containment.test.ts`, `tests/engine-worker-profile.test.ts` | AppContainer, no network, no GPU, Cycles CPU |
| Scene translation from Cinema | IMPLEMENTED+TESTED | `core/blender/scene.ts:71-178`, `:270-365` | Limits `:17-31`: 1280x720, 120 frames, 32 samples, 200 objects, 8 models |
| Camera moves, lighting presets, finishes | IMPLEMENTED+TESTED | `core/blender/scene.ts:214-258`, `:278-323`; `src/cinema/blenderRender.ts:9-54` | Per-render choices; not stored in the project |
| Camera tracking and match-move | IMPLEMENTED+TESTED (command only) | `core/jobs.ts:1666-1740`, `:1802-1934`; `core/blender/track.ts:40-85`; `core/blender/scene.ts:372-404`; reg `:1948-1975`; `scripts/blender/yamakan_track.py:130-163`; `tests/blender-render.test.ts` | No browser caller for `yamakan.blender.track` / `yamakan.track.read` |
| End-to-end qualification script | IMPLEMENTED (not run here) | `scripts/qualify-blender-e2e.mjs:1-11` ("Nothing here is mocked.") | |
| macOS/Linux, GPU (EEVEE/Workbench/Cycles GPU) | ABSENT | `docs/SECURITY.md:41-48` | |
| .blend import/export, round-trip, live link, add-on | ABSENT | | Output is only an MP4 asset |
| Concurrency | One global slot | `core/jobs.ts:1639-1646`; `docs/SECURITY.md:41-48` | A second render is refused, not queued |

### Consistency, generation, takes

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Reference packs ("elements"), roles, pin per story shot | IMPLEMENTED+TESTED | `core/story.ts:145-196`, `:85-102`; reg `:629-683`; `src/create/ElementsPanel.tsx`, `src/create/create-elements.ts:131-151`; `tests/create-elements.test.ts`, `tests/story-packs.test.ts` | "They are records for now: no model receives them" (`ElementsPanel.tsx:1-2`) |
| Likeness consent (grant, list, revalidate, revoke) | IMPLEMENTED+TESTED | reg `:2216-2291`; `core/continuity.ts:345-667`; `src/create/PeoplePanel.tsx:35-55`; `tests/continuity-consent.test.ts`, `tests/create-people.test.ts` | Human-only |
| Fictional-character declaration | IMPLEMENTED+TESTED | `core/story.ts:154-157`; reg `:629-683` | Browser session only |
| Continuity resolution | IMPLEMENTED+TESTED as traceability; **no measurement** | `core/continuity.ts:108-207`; `:200-205` returns `score: null, status: "unmeasured"` | `continuity.check` (reg `:990`) has no UI caller |
| Identity encoding | STUB/SCAFFOLD | reg `:2292-2321` records a caller-supplied `payloadHash`; no encoder runs | `core/identity.ts` header excludes provider implementations |
| Character asset entity | STUB/SCAFFOLD (contract only) | `core/identity.ts:60-73`; only `tests/identity.test.ts:100` uses it | |
| First-frame image-to-video | IMPLEMENTED+TESTED | `core/engines/generation.ts:35-48`; reg `:2387-2421`; `tests/kaggle-first-frame.test.ts`; `scripts/qualify-kaggle-first-frame.mjs` | Requires the "no unconsented person" declaration per run |
| Image metadata stripping before send | IMPLEMENTED+TESTED | `core/engines/clean-image.ts`; `tests/clean-image.test.ts` | |
| "Memory" (creative/world memory) | ABSENT | No module by that name under `core/` or `src/`; matches for "memory" are RAM-related | |
| Style consistency | Role label only | `core/story.ts:145-158` (`style` role) | Nothing consumes it |
| Take list / propose replace / apply | IMPLEMENTED+TESTED | `core/takes.ts:121-172`, `:248-318`, `:324-373`; reg `:841-989`; `src/director/TakeReview.tsx:91`, `:145`; `src/main.tsx:245-286`; `tests/take-replace.test.ts`, `tests/take-review.test.ts` | One undoable revision per swap |
| Take compare | IMPLEMENTED (command only) | `core/takes.ts:181-245`; reg `:852` | No UI caller |
| Regenerate one shot with its stored parameters | ABSENT | `core/engines/generation.ts:35-48` (request has no shot/take id) | See (d) |
| Generation service (start, status, cancel, import) | IMPLEMENTED+TESTED | `core/engines/generation.ts:159-625`; reg `:2387-2519`; `tests/generation-service.test.ts`, `tests/generation-durable.test.ts` | Covered in depth by another agent; `ENGINE_ENABLED = false` at `core/engines/contract.ts:77` |

---

## (d) Editability audit

For each item: can the data model represent it, does the UI expose it, what is missing.

### Shot

- **Model**: yes, twice. (1) Timeline shot `CanonicalShot {id, name, clipIds}` inside `CanonicalScene` (`core/canonical.ts:142-164`), edited with `scene.*` / `shot.*` operations (`core/timeline/operations.ts:238-266`). (2) Story shot `{id, name, durationTicks, notes, referencePacks, takes, selectedTakeId}` in the story document (`core/story.ts:92-102`). They are joined only by sharing an id when `assembleOperations` builds the timeline from a story (`core/story.ts:442-495`).
- **UI**: timeline scenes/shots are editable in `scenesPanel` (`src/main.tsx:830-962`, shown in Story at `:2700`). Story shots have **no authoring UI**: `yamakan.story.save` is called only by the Director cinema-shot host (`src/main.tsx:1134`) and by Create (`:2484`). `StoryPacks` is a read-only list (`src/director/DirectorPanel.tsx:146-242`).
- **Missing**: a shot card editor; structured shot intent (prompt, negative prompt, camera, duration target, model) as fields rather than free-text `notes`; a rule for shots split across clips (a shot shown by more than one clip cannot take a replacement, `core/takes.ts:90-93`).

### Take

- **Model**: yes. Up to 8 takes per story shot, one selected (`core/story.ts:30`, `:75-83`, `:99-100`).
- **UI**: `TakeReview` lists takes and proposes a swap (`src/director/TakeReview.tsx:91`, `:145`), applied as one revision by `applyTake` (`src/main.tsx:245-286`). It lives inside the collapsed Director `<details>` in Story (`src/main.tsx:2707-2712`).
- **Missing**: take stack on the clip in the timeline; side-by-side compare UI (`take.compare` has no caller); more than 8 takes or archival; any link from a take to re-runnable parameters.

### Reference

- **Model**: yes. Reference pack entries pinned by asset hash with roles (`core/story.ts:163-196`), pinned to story shots by document hash (`:85-102`); timeline scene has one `referenceAssetId` (`core/canonical.ts:153`).
- **UI**: `ElementsPanel` and `PeoplePanel` in Create; scene reference in `scenesPanel`.
- **Missing**: any consumer. No generation recipe receives a pack (`src/create/ElementsPanel.tsx:1-2`); only a single first-frame still reaches a model. Resemblance is "unmeasured" (`core/continuity.ts:200-205`). There are two reference mechanisms (scene `referenceAssetId` and shot `referencePacks`) with no relation between them.

### Camera path

- **Model**: **no persisted camera path exists anywhere.** Five partial representations, none editable as a path:
  1. Timeline scene `camera {focalLengthMm, shotScale, movement}` - "labelled intent" (`core/canonical.ts:154-161`).
  2. Scene3D camera intrinsics only (`core/scene3d.ts:43-61`).
  3. `ShotIntentSchema` for the control compiler - command input, not persisted (`core/cinema/control-compiler.ts:27-83`).
  4. Blender camera computed per render from the scene centre and a named move (`core/blender/scene.ts:278-323`; moves still/orbit/push/pull/pan/handheld, `src/cinema/blenderRender.ts:22-24`) - a render setting, discarded after the job.
  5. Solved `CameraTrack` from footage (`core/blender/track.ts:40-85`) - kept as a job result file (`core/jobs.ts:1920-1923`) and read by `yamakan.track.read` (reg `:1968-1975`), not a project document.
- **UI**: lens presets in the Cinema viewport (`src/cinema/CinemaViewport.tsx:959-986`); move/light/finish selects in `BlenderRender`; four selects in Director `CinemaShot` (`src/director/CinemaShot.tsx:228-252`).
- **Missing**: a camera object with transform in Scene3D; keyframed path; a persisted per-shot camera that Cinema, Director, Blender and a generator all read; UI for match-move.

### Timing

- **Model**: yes, precise. Clip `startTicks, durationTicks, sourceStartTicks, speed` in integer flicks (`core/canonical.ts:118-130`); story shot `durationTicks` (`core/story.ts:96`).
- **UI**: drag move/trim, split, keyboard nudge and trim (`src/editor/components/Timeline.tsx:834-903`).
- **Missing in UI**: speed, ripple, insert, group move (all exist as commands). **Missing in model**: slip/slide/roll operations, markers, a per-shot duration target that survives re-generation, limits above 200 clips / ten minutes.

### Layer / composite

- **Model**: track order is layer order (<=16 tracks); per clip transform + crop + LUT effects, opacity, one dissolve.
- **UI**: transform panel; opacity start/end.
- **Missing**: blend modes, masks, mattes, adjustment layers, nested sequences, text layers with style, tracking data applied to layers, alpha export. Animated transform channels validate but make the project unexportable (`core/render/animation-filters.ts:252-256`). The interactive preview does not draw crop, animation, dissolve or LUT (`core/render/parity.ts:28-48`). Blender "finish" (glow/vignette/film, `core/blender/scene.ts:252-258`) is baked into the rendered MP4. Whether a Studio canvas can be placed on the timeline as a layer was not found in `src/main.tsx:1002-1017` (the panel only mounts the canvas).

### Scene description

- **Model**: thin. Timeline scene has `name`, one reference asset and a three-field camera label (`core/canonical.ts:149-164`). Story scene has `name` and shots (`core/story.ts:104-110`); the story has only a `title` (`:116`). Scene3D holds geometry only.
- **UI**: `scenesPanel`.
- **Missing**: script/brief text, setting, time of day, mood, characters present, dialogue. The entities `Script`, `Character`, `BrandKit` in `docs/PROJECT_DATA_MODEL.md:7-21` are DOC-ONLY. The Create brief lives in browser `localStorage` (`src/create/CreateWorkspace.tsx:73-81`), not in the project.

### Audio / narration

- **Model**: audio tracks; clip gain and fades; embedded sound of video clips; volume keyframes; mute/solo; unlink/relink; loudness normalisation on export; captions as documents.
- **UI**: gain and sound on/off; captions panel.
- **Missing**: narration/voice-over entity, TTS, lipsync, music generation, ducking, pan, buses, meters; transcription refuses (`reg :2329-2363`); generated video is declared `audio: false` (`core/engines/generation.ts:498`); fades not editable in the UI and not played in the canvas preview (`core/render/parity.ts`).

### Generated media revision

- **Model**: partial. Media is content-addressed and immutable; a story shot keeps up to 8 takes with `outputHash` and input pins; `clip.replaceMedia` (`core/timeline/operations.ts:161-170`) swaps a clip's media in place and is undoable; `asset_replacements` records relinks (`core/store.ts:464`).
- **UI**: take review; Create "Place / Place again".
- **Missing**: parent/child relation between generations; "revise this take" (same seed, changed prompt); a take created by Create is always a **new shot with one take** in a separate story titled "Made in Create" (`src/create/create-story.ts:1-3`, `:92-116`), never a new take on an existing shot. The only flow that adds a take to an existing shot and swaps it on the timeline is the Director `cinema-blender` flow (`src/main.tsx:1144-1163`).

### Model settings / provenance

- **Model**: split and lossy at the project boundary.
  - Generation ledger: `GenerationRecord` holds `recipe {id, hash, operation, modelManifestHash}`, `prompt`, `seed`, `width`, `height`, `durationFrames`, `firstFrameAssetId`, `inputs`, `videoSha256` (`core/engines/generation.ts:63-97`); `GenerationLineage` holds recipe id/hash, manifest hash, seed and prompt **hash** (`:52-61`).
  - Project: the story take lineage cannot hold any of that. The code says so: "A story's take can hold its output and inputs, not the recipe, seed or prompt hash; a run elsewhere keeps these in its job record." (`core/engines/generation.ts:50-51`).
  - Create works around it by writing `"seed N, steps N, model"` into the free-text `lineage.label` and the prompt into shot `notes` (`src/create/create-story.ts:90`, `:96`, `:104`), and parses them back as display text (`:133-152`).
  - Blender: a receipt `yamakan.blender-receipt/1` is checked at job time (`core/jobs.ts:1439-1462`); the render settings are not attached to the resulting asset in the project.
- **UI**: Create shows receipt facts for made videos (`src/create/CreateWorkspace.tsx:668-737`).
- **Missing**: structured, machine-readable generation parameters in the project (so a backup, an export or another machine can re-run or modify a shot); linkage generation -> shot/take/clip; provenance for Blender renders; C2PA or any exported provenance manifest.

### Summary matrix

| Item | Model can represent | UI exposes | Biggest gap |
|---|---|---|---|
| Shot | Yes (two structures) | Timeline shots only | No story shot editor; no structured intent |
| Take | Yes (<=8, in story doc) | Yes, buried | No link to parameters; not on the clip |
| Reference | Yes (packs + consent) | Yes (Create) | Nothing consumes it |
| Camera path | No | Presets only | No persisted camera object |
| Timing | Yes | Partly | Speed/ripple not in UI; no slip/slide/roll/markers |
| Layer/composite | Basic | Basic | Animated transforms block export |
| Scene description | Names only | Names only | No script/brief in project |
| Audio/narration | Audio yes, narration no | Gain only | No narration/TTS/lipsync |
| Generated media revision | Partly (takes) | Partly | No regenerate-in-place |
| Model settings/provenance | In job ledger only | Read-only text | Not in the project; free-text workaround |

---

## (e) How Cinema, Director, Timeline, Studio and Blender connect through the one canonical project

### What works today

All five surfaces write through the same command registry and the same revision counter; none of them keeps a competing project file. That is the strongest architectural fact in the codebase.

```
                         yamakan.project revision N  (core/canonical.ts)
                         +-- assets, tracks, clips, scenes->shots->clipIds
                         +-- documents[] (hash-pinned)
                               |        |          |            |         |
                             story   referencePack cinemaScene studio  captions/lut/presets
                               |                    |
   Create --generation ledger--+ (new shot, 1 take) |
                               |                    v
   Director cinema-blender ----+---> planCinemaShot -> BlenderScene -> blender-render job
        (stage ledger in SQLite)                                           |
                               ^                                           v
                               +---- take (asset hash) <---- MP4 asset attached to project
                               |
                     take.proposeReplace / story.assemble -> clip on timeline -> export job
```

- **Timeline <-> project**: direct; typed operations (`core/timeline/operations.ts`).
- **Cinema -> project**: the scene is a `cinemaScene` document saved against the head revision (`src/cinema/cinemaProject.ts:151-173`).
- **Cinema -> Blender -> timeline**: `blenderSceneFromCinema` (`core/blender/scene.ts:270-365`) -> `blender-render` job -> frames encoded by Yamakan's FFmpeg -> probed -> attached as an ordinary video asset (`core/jobs.ts:1484-1571`) -> "Place on timeline" is an explicit, separate step (`src/cinema/BlenderRender.tsx:43-47`, `src/main.tsx:1041-1065`).
- **Director -> Blender -> story -> timeline**: `director.start` -> `director.renderShot` (`core/director/cinema-pipeline.ts:100-160`) -> human approval bound to the video hash -> the video becomes a take of the story shot -> `story.assemble` (first time) or `take.proposeReplace` + `take.apply` (later) (`src/main.tsx:1070-1178`). This is the **only complete "make a shot, approve it, place it, re-make it, swap it" loop on main**, and it is proven by `tests/blender-render.test.ts:408`.
- **Create -> generation -> story -> timeline**: the generation service imports the result as an asset (`core/engines/generation.ts:613-623`); Create records it as a new shot in the "Made in Create" story and places the whole video (`src/create/create-story.ts:64-129`, `src/main.tsx:684-697`).
- **Studio -> project**: the canvas is a `studio` document with bitmaps by digest (`src/studio/StudioCanvas.tsx:142-280`).
- **Founder rule honoured in code**: "Yamakan stays the single authority for the project, timeline, assets, jobs and rendering" (`docs/FOUNDER_DECISION_RECORD.md:181-187`). Blender never writes project state; it returns frames and a receipt.

### Where the connections fail or duplicate

1. **Two shot hierarchies.** Timeline scenes -> shots -> clipIds (canonical) and story scenes -> shots -> takes (document) are parallel trees joined only by equal ids. A clip split in the editor breaks take replacement for that shot (`core/takes.ts:90-93`); a partly placed story is refused by the Director host (`src/main.tsx:1101-1104`). Nothing enforces the two trees staying in step after assembly.
2. **Five camera representations, none shared** (listed under "Camera path" in (d)). The Cinema scene camera, the timeline scene camera label, the control compiler's intent, the Blender per-render move and the solved track do not reference each other.
3. **Director does not read the Cinema scene.** `planCinemaShot` builds its own scene of fixed coloured boxes from four choices (`core/director/cinema-shot.ts:51-117`, `:138-218`); it does not open the project's `cinemaScene` document. The Cinema panel and the Director shot flow are two separate routes to Blender.
4. **Two persistence paths for Scene3D.** The command `yamakan.scene.save` still writes workspace-level files through `persistCinemaScene` (reg `:2081-2099`, `core/cinema-store.ts:44-85`), while the browser saves project documents. `scene.migrate` is one-way, per scene, human-only, and keeps the original (reg `:2122-2151`). An agent using `scene.save` writes a scene that is in no project revision.
5. **Generation is not attached to shots.** `GenerationRequest` carries `projectId` and an optional first-frame asset, no scene/shot/take id (`core/engines/generation.ts:35-48`). The link is made after the fact in the browser by Create, as free text.
6. **Reference packs reach no generator.** Packs are pinned to shots and checked for consent, but the generation request has no field for them.
7. **Studio output has no visible route to the timeline or to generation.** `studio.open/commit/export` only validate and hash (reg `:2160-2215`); the Edit workspace mounts the canvas (`src/main.tsx:1002-1017`) with no "use as first frame" or "place on timeline" action found. Not verified inside `src/studio/host/*`.
8. **Match-move is command-only.** `blender.track` -> `track.read` -> `plateFromTrack` -> `blender.render` works for an agent or CLI user; the browser has no caller.
9. **Per-render creative choices are not project state.** Camera move, lighting, finish, size, quality and seconds for a Blender render live in component state (`src/cinema/blenderRender.ts:45-54`) and in the job payload, so a rendered shot cannot be reopened and re-rendered with one change.

---

## (f) UI/UX assessment

### Strengths to preserve

- **Honest preview model.** A fast approximate canvas plus a server-rendered reference frame/segment that names its revision and says when it is stale (`src/reference.tsx:1-5`, `:163-171`), with a generated list of what the canvas approximates (`core/render/parity.ts:28-48`, shown at `src/main.tsx:1323-1340`). This is rare and worth keeping as a product principle.
- **Every gesture is a durable, undoable, typed command** with compare-and-swap (`src/main.tsx:369-518`). Agents and people share one history.
- **Explicit placement.** Renders and generations never change the timeline until the person chooses Place (`src/cinema/BlenderRender.tsx:43-47`).
- **Consent and honesty copy in the UI**: "no model receives them" for elements; generation needs a tick each time that the prompt may leave the machine and shows no fake percentage (`src/create/GeneratePanel.tsx:1-3`).
- **Bilingual foundation.** Compile-time EN/AR key parity (`src/i18n.ts:749-751`); direction set before paint (`src/main.tsx:107-115`); workspace tabs are a correct ARIA tablist with RTL-mirrored arrow keys, Home/End and roving tabindex (`src/workspaces/ProjectShell.tsx:85-125`); `<bdi>` isolation and `dir="auto"` on free text; logical CSS properties (`src/style.css:160`, `:179`, `:302`, `:473`); the timeline deliberately stays LTR (`src/main.tsx:1850-1908`); keyboard shortcuts use physical keys so they work on Arabic layouts (`src/editor/components/Timeline.tsx:848-852`).
- **Accessible status handling**: `role="alert"`, `role="region"`, `aria-live`, focus returned after commands (`src/captions.tsx:77-80`), `:focus-visible` styles (`src/style.css:49-52`, `:704`).
- **Workspaces stay mounted**, so switching never discards a draft, a canvas or a running stage (`src/workspaces/ProjectShell.tsx:140-161`).
- **Four-workspace narrative** (Create, Story, Edit, Finish) is a sound simple-to-advanced spine.

### Concrete usability gaps

1. **Edit workspace exposes a fraction of the engine.** No controls for speed, ripple, insert, group move, fades, LUT, loudness, batch export or OTIO, although each is an implemented, tested command (section c). Trim mode is fixed to "normal" (`src/main.tsx:1860`).
2. **Animation panel can only set start and end values for opacity and volume** (`src/main.tsx:1626-1803`); there is no keyframe editor even though the schema holds 512 keys on seven channels, and five of those channels cannot be exported.
3. **Titles**: each added title creates another "Titles" track with a fixed 3-second clip and no styling or position (`src/main.tsx:1804-1845`, `src/adapter.ts:81-99`).
4. **Story workspace has no story.** The shell comment says "Story holds the brief, scene and shot cards" (`src/workspaces/ProjectShell.tsx:3-4`); the workspace actually shows the timeline scene list, the Cinema viewport and a collapsed Director (`src/main.tsx:2691-2714`). There is no shot card, script or brief editor.
5. **Director reads as a debug panel**: hard-coded English "Start framework-smoke" and "Next stage" buttons, raw JSON in `<pre dir="ltr">`, an unsupported list first (`src/director/DirectorPanel.tsx:308-323`, `:357-400`). Take review, the most product-relevant control, is nested inside it.
6. **Cinema viewport is button-nudged**: objects move by step buttons (`src/cinema/CinemaViewport.tsx:800-944`); no drag gizmo, numeric fields, camera object, lights or timeline. Save and reopen are manual buttons (`:988-1030`).
7. **Studio shows two bare canvases** with Save/Reload (`src/studio/StudioCanvas.tsx:341-445`). The imported engine has controllers (`src/studio/canvas-engine/*`) but no tool UI is rendered. A debug handle `window.__yamakanStudioQ8` is installed in the normal page because `exposeMeasurement = STUDIO_ENABLED || forceMount` (`:197`, `:281-325`).
8. **No onboarding or empty-state guidance** (`src/main.tsx:1911-1920`); default workspace is Edit, not Create (`src/workspaces/ProjectShell.tsx:34-43`).
9. **Export has no settings and no destination choice** in the top bar (`src/main.tsx:803-825`).
10. **Localisation holes**: donor Timeline labels and tooltips are English (`src/editor/components/Timeline.tsx:1048-1133`); default track names "Picture"/"Audio" are hard-coded (`src/main.tsx:1880`); `aria-label="Cinema viewport"` (`src/cinema/CinemaViewport.tsx:952`), `aria-label="Studio canvas"` (`src/studio/StudioCanvas.tsx:347`), `aria-label="Director"` (`src/director/DirectorPanel.tsx:280`, `:306`) are literals. `specs/CURRENT.md:139` already lists non-localised residuals.
11. **Theme and motion**: one dark token set (`src/style.css:4-12`); no `prefers-color-scheme`, `prefers-reduced-motion` or `forced-colors` rules found in `src/style.css`; `src/editor/editor.css` has almost no focus-visible or RTL handling.
12. **Conflict handling is correct but blunt**: a non-mergeable conflict offers the unapplied change as a download (`src/main.tsx:476-482`); there is no visual diff or retry-on-top.
13. **Playback clock is a 33 ms interval** (`src/main.tsx:573-584`), not media- or audio-clock driven; accurate sync and long timelines will need a real transport.

---

## (g) Doc-vs-code discrepancies

| Document statement | Code reality | Evidence |
|---|---|---|
| `docs/PROJECT_DATA_MODEL.md:7-21`, `:38-56` lists Script, Character, BrandKit, Camera, Lighting, MotionPath, Timeline (`primaryTimelineId`), Workflow, GenerationRequest/Job, Model/Provider, ProvenanceRecord, Asset "selected version ID", Shot "candidate and selected take versions" | None of these are entities of the canonical project. The document itself says "No schema/protocol here is claimed implemented" (`:3`), but it is the only data-model document and reads as the target | `core/canonical.ts:62-212` |
| `docs/ARCHITECTURE.md`, `docs/CREATIVE_WORKFLOWS.md`, `docs/FEATURE_MATRIX.md` | Three-line "Historical Darzain document" stubs; there is no current architecture or feature matrix document | files themselves |
| `core/studio.ts:3` "Feature flag stays off until Q10 targets" | `STUDIO_ENABLED = true` | `core/studio.ts:16` |
| `core/director/runtime.ts:9-10` "The Director feature flag stays off for the UI" | `DIRECTOR_ENABLED = true` | `core/director-flags.ts:7` |
| `src/workspaces/ProjectShell.tsx:3-4` "Story holds the brief, scene and shot cards" | No brief or shot-card editor exists | `src/main.tsx:2691-2714` |
| Task framing: "Studio (main app shell / canvas engine)" | The shell is `ProjectShell` + `src/main.tsx`. Studio is an image-canvas panel opened from Edit (ADR 0003 concerns the imported canvas engine) | `src/main.tsx:1002-1017`, `:2715-2740` |
| `core/render/plan.ts:79-82` "Render applies opacity; transform paths are residual" | Stronger in practice: a plan with animated transform channels is refused, so the project cannot export | `core/render/animation-filters.ts:9-11`, `:252-256` |
| `core/canonical.ts:123` "MVP renders [gain and fades] on audio clips only" | Schema allows them on any clip; the UI zeroes fades on video clips | `src/main.tsx:672-673`, `:1378-1379` |
| Donor timeline advertises ripple/roll/slip/slide modes | Unreachable; no such operations exist | `src/editor/components/Timeline.tsx:19-20`; `src/main.tsx:1860` |
| README: "offline local-web engineering preview, not a release"; `specs/CURRENT.md`: models/providers disabled, release NO-GO | Consistent with code (`ENGINE_ENABLED = false`, `ROUTER_PROVIDERS_ENABLED = false`); but a generation service does run when the person's Kaggle CLI is configured | `core/engines/contract.ts:77`; `core/router/explain.ts:10`; reg `:2387-2421` |

No case was found where a document claims a shipped capability that the code lacks outright; the documents are generally more cautious than the code. The risk runs the other way: the code has capabilities (ripple, speed, OTIO, match-move, loudness, batch export) that neither the UI nor current docs surface.

---

## (h) Risks and technical debt

### Structural risks for an "editable AI productions" thesis

1. **Provenance is outside the project.** Recipe, model manifest hash, seed and prompt live in the generation ledger; the project holds free text. Until structured generation parameters are part of the pinned creative closure, "re-run or modify this shot" cannot be built reliably, and a restored or moved project loses the link. This is the single most consequential gap.
2. **No shot identity that every subsystem shares.** Timeline shot, story shot, generation record, Director run and Blender job each have their own id space; only the first two are joined (by equal id, by convention).
3. **No persisted camera.** Camera-controlled generation, previs-to-final and match-move all need one camera object in the project; today there are five disconnected partial ones.
4. **Hard caps** suited to short pieces: 200 clips, 16 tracks, 100 scenes, ten minutes, 1920x1080, 8 takes per shot, 10,000 revisions per project (`core/canonical.ts:60`, `:177-205`; `core/story.ts:22-34`). Undo and redo each spend a revision (`specs/CURRENT.md:248`), so an actively edited project can exhaust its budget.
5. **Data model ahead of the renderer.** Animated transform channels are accepted, stored and then refuse export. Any new editable property needs schema, operation, renderer, preview parity entry and UI together.
6. **Interactive preview ceiling.** Canvas 2D with one media element per clip will not scale to effects, many layers or frame-accurate review; there is no WebCodecs/WebGL/WebGPU path. The reference preview compensates for correctness, not for interactivity.
7. **Single fixed export profile** (H.264 8-bit 4:2:0 SDR, CRF 20, `veryfast`) with no mezzanine, alpha or image-sequence output.
8. **Interchange is one format, one direction that matters**: OTIO export drops titles, gain, fades, speed and animation; no FCPXML/EDL/AAF.

### Duplicated or competing abstractions

- Two shot trees (timeline scenes vs story scenes).
- Two Scene3D stores (workspace files vs project documents), with the command still writing the legacy one.
- Two reference mechanisms (`scene.referenceAssetId` vs shot `referencePacks`).
- Two shells (workspace shell and classic shell behind a flag, `src/main.tsx:2334-2351`).
- Two routes from the app to Blender (Cinema panel from the saved scene; Director from a generated box scene).
- Donor type universe (`src/editor/types.ts`, 2,038 lines, including provider-specific concepts such as `KLING_MOTION_CONTROL` `:445`) beside the canonical model, bridged by `src/adapter.ts`.

### Code health

- `src/main.tsx` is a single 2,804-line component owning all state for four workspaces; every new panel increases coupling and re-render cost (the playhead re-renders it each frame, noted at `src/main.tsx:623-625`).
- Dead or unused code: `src/edit-ops.ts` helpers for speed, ripple delete and group move; donor trim modes; `src/flow/FlowView.tsx`; donor utilities under `src/editor/utils/` (colour grading, colour wheels, export settings) whose use was not confirmed.
- Debug handle on `window` in the normal page (`src/studio/StudioCanvas.tsx:197`, `:281-325`).
- Stale comments about flags (section g).
- Type escapes at the command boundary in the UI (`as any` at `src/main.tsx:1140`, `:1157`, `:1162`).

### Platform and licence

- Blender worker is Windows-only, CPU-only, one global slot, 1280x720, 120 frames, 32 samples. It is a previs renderer, not a finishing renderer.
- GPL boundary is handled correctly as a process boundary: Blender is installed by the person, never shipped or downloaded by Yamakan (`NOTICE:56-65`, `scripts/blender-install.ts:1-10`); the in-repo Python scripts that import `bpy` are marked GPL-3.0-or-later (`scripts/blender/yamakan_render.py:1`). Any plan to deepen integration (add-on, shipped binaries, linking) must keep that boundary and needs a licence review.
- Director rules are translated from OpenMontage (AGPL-3.0); manifests are data only. Keep this under review if Director grows.
- The human-only rule holds only against a process that cannot read or write the workspace folder (`docs/SECURITY.md:29-39`).

### Natural next steps suggested by the code (inference, not a finding)

- Blender: persist per-shot render settings and a camera object in the project; let Director render from the project's `cinemaScene`; expose match-move in the UI; then widen platform/GPU.
- Takes: add structured generation parameters to `TakeLineageSchema` (a new story `formatVersion`), give `GenerationRequest` a shot id, and add "new take for this shot" to Create.
- Editor: wire the already-tested commands (speed, ripple, insert, group move, fades, LUT, OTIO, batch export) before adding new engine features.

---

## (i) Questions that could not be answered from code

### Not verified because the code was not read in this pass

- Reducer bodies in `core/timeline/operations.ts:330-1139` (overlap rules, snapping behaviour, ripple edge cases); `core/timeline/{properties,snapping,overlap}.ts`, `ripple/*`, `group-move/*`.
- `core/animation/*` (interpolation modes actually supported: linear only, or bezier/hold?).
- `core/effects/color.ts` (LUT formats and sizes); `core/render/{segments,preview,fonts,ass,capability}`; `core/render.ts` outside `:339-347`, `:479`, `:786-860`.
- `core/media/proxies.ts`; `core/audio/{peaks,unlink,loudnorm}`; `core/retime/*`; `core/relink.ts`; `core/migrate.ts`.
- `core/director/runtime.ts` body and `core/director-legacy.ts`; `core/cinema/glb.ts`.
- `core/interchange/otio.ts` `fromOtio` body (`:345` onward); `core/captions.ts` beyond `:75`.
- `core/quality/*`, `core/router/explain.ts`, `core/flow/snapshot.ts`, `core/agents/lineage.ts`, `core/prompts/*`.
- UI: `src/create/{PromptLibrary,PromptPresets,create-people}`, `src/cinema/{camera/*,cinemaModels,cinemaObjects}`, `src/studio/{canvas-engine,host,workbench}`, `src/agent-access.tsx`, `src/proxies.ts`, the second halves of `BlenderRender.tsx`, `CinemaShot.tsx`, `TakeReview.tsx`, `GeneratePanel.tsx`, `ElementsPanel.tsx`, `PeoplePanel.tsx`.
- `server/*` and the registry take/continuity section `:841-1021` in detail.
- Test bodies (other than test names in `tests/blender-render.test.ts`) and `scripts/browser-e2e.mjs` (1,234 lines). Tests were not run.

### Open product/engineering questions

1. Is the story document intended to become the primary shot authority, with timeline scenes/shots derived from it, or the reverse? The code supports both and commits to neither.
2. Should generation parameters live in the take (story document), in a new provenance document kind, or in the canonical project? The comment at `core/engines/generation.ts:50-51` reads as a deliberate privacy choice (prompt by hash); is storing the prompt in shot `notes` by Create consistent with that intent?
3. Is the legacy Cinema file store meant to be removed? `scene.save` still writes to it for every caller.
4. Is the classic shell still required, and for whom?
5. What is the intended use of the Studio canvas in a video workflow (first frame, plate paint, mask, storyboard frame)? No consumer exists yet.
6. Are the 200-clip / ten-minute / 1080p / 10,000-revision limits policy for the preview stage or structural assumptions (for example in render budgets and `MAX_GESTURE_OPERATIONS = 64`, `src/edit-diff.ts:40`)?
7. Is the donor Timeline component the long-term editor, given that its types, labels and modes diverge from the canonical model?
8. Which of the command-only capabilities are intentionally agent-first, and which are simply unfinished UI?
9. For Blender: is the goal previs only, or final-pixel rendering? The limits and the CPU-only profile imply previs; the match-move work implies compositing ambitions.
10. Is there an intended relation between the control compiler output (`yamakan.controls-compiler/v1`) and any generation recipe? None consumes it today.
11. How does the interactive preview behave at the stated limits (200 clips, 16 tracks)? `tests/editor-scale.test.ts` exists but was not read; no performance evidence was gathered.
