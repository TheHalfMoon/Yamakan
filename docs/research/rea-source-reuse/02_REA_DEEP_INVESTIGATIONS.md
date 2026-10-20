# 02 — REA deep investigations

Date: 2026-10-18. Every claim below comes from a retained evidence file in [`docs/evidence/rea/source-reuse-2026-10-18/`](../../evidence/rea/source-reuse-2026-10-18/) or from an earlier receipt linked in [REA findings](../../REA_FINDINGS.md).

## Method and tools

| Tool                 | Version / mode                                                                                                                    | Used for                                                                                   | Limitation                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REA (`rea-agents`)   | 6.3.0, local install, `analyze-javascript-application <dir> --json`                                                               | Import graphs, external specifiers and parse integrity of JavaScript/TypeScript subsystems | Static and inert. No execution and no native engine (Hopper/Ghidra/IDA). Specifiers are as written, type-only imports included. Large raw graphs were summarized and then deleted. Evidence ids are kept. |
| git                  | Blob-less partial clones (`--filter=blob:none --depth 1`) at the catalog's full 40-character pins, sparse checkouts per subsystem | Reading exact donor files and line counts                                                  | `git ls-tree --long` fetches blobs and was avoided                                                                                                                                                        |
| `git show` / `wc -l` | —                                                                                                                                 | Python donors (ComfyUI, OpenMontage, OpenVideoStudio), licences, notices                   | REA 6.3.0 has no Python analyzer, so the result is a static reading only                                                                                                                                  |
| Jev                  | Not run in this session                                                                                                           | —                                                                                          | Recorded in [engineering tooling](../../ENGINEERING_TOOLING.md). No Jev review is claimed for this plan.                                                                                                  |
| Alibaba OCR          | 1.12.13, delegate mode only                                                                                                       | Not used. No screenshots or scanned documents were needed.                                 | No model-backed review is claimed from delegate mode                                                                                                                                                      |
| Graft                | 0.21.1                                                                                                                            | Not used for this plan                                                                     | Its `build` edits the repository's `.gitignore`. It would be run with `--dir` outside the repository if needed.                                                                                           |
| PStack               | Playbook                                                                                                                          | Applied manually as the review checklist for [10](10_BENCHMARKS_AND_E2E.md)                | Not an automated check                                                                                                                                                                                    |

Nothing was installed, built or executed from any donor. No model, weight or hosted service was downloaded or contacted. No provider was activated.

## Investigations

### R1 — OpenCut Classic timeline subsystems (`cf5e79e9`, MIT)

- **Evidence:** [`opencut-subsystems.json`](../../evidence/rea/source-reuse-2026-10-18/opencut-subsystems.json).
  - Evidence id `ev_992d17ba…5573e`, root `4562e850…`.
  - 137 files, 1,555 nodes, 2,404 edges, 0 parse failures.
- **Line counts at the pin:**

| Module                 | Lines | Tests              |
| ---------------------- | ----- | ------------------ |
| `animation/`           | 3,370 | 241 lines (1 file) |
| `retime/`              | 398   | 92 lines (2 files) |
| `ripple/`              | 377   | none               |
| `timeline/group-move/` | 820   | none               |

- **External imports per subsystem:**
  - **ripple:** only `@/timeline/types`.
  - **retime:** `@/timeline`, `@/retime/rate` and `soundtouchjs` (for audio stretch).
  - **animation:** `@/animation/types`, `@/params`, `@/wasm` and `@/utils`.
  - **group-move:** `@/timeline`, `@/wasm`, snapping, placement/overlap, element update and snap sources.
  - **commands:** almost every file imports `@/core` (`EditorCore`) and the base command. The command layer is rejected.
  - **masks:** UI-coupled. Only the geometry is a later candidate.
- **The only `@/wasm` dependency is `MediaTime` arithmetic** (`apps/web/src/wasm/media-time.ts`: integer ticks at 120,000/s, branded). Yamakan already replaced it with checked integer flick ticks for `snapping` and `overlap` (`core/donors/opencut/`). One OpenCut tick is exactly 5,880 flicks, so the conversion is lossless.
- **Finding:** ripple, retime and group-move are portable with the same adapter pattern as the two modules already imported. Animation also needs `@/params` (parameter descriptors) mapped onto canonical clip properties.

### R2 — InvokeAI webv2 canvas engine (`ffe9e1a9`, Apache-2.0)

- **Evidence:** [`invokeai-canvas-engine.json`](../../evidence/rea/source-reuse-2026-10-18/invokeai-canvas-engine.json).
  - Evidence id `ev_50dd086d…7179`.
  - 5,388 nodes, 9,053 edges, 0 parse failures.
- **Size:** `workbench/canvas-engine` has about 35,589 source lines plus 145 test files (56,394 test lines, Vitest, some in browser mode). The commit date is 2026-10-10.
- **Self-contained:** canvas-engine subsystems import almost only within canvas-engine. External specifiers are:
  - `@workbench/mediaReferences` and `@workbench/controlAdapters`;
  - `@platform/browser/sha256` and `@platform/browser/downloadBlob`;
  - npm `ag-psd` and `perfect-freehand`.
- **Boundary enforcement:**
  - InvokeAI's dependency policy (`src/architecture/dependencyPolicy.ts`, 305 lines, with `dependencyPolicy.test.ts` and `canvasSeamOwnership.test.ts`) enforces canvas seam ownership, but it lives **outside** the subtree and would not come with an import of `canvas-engine/`.
  - `ARCHITECTURE.md` mentions an `importBoundaries.test.ts`, but no such file exists at the pin.
  - REA independently finds no React, backend or socket import inside canvas-engine. React 19 in webv2 does not reach the engine, so Yamakan's React 18.3.1 is not a conflict.
- **`ARCHITECTURE.md`** (219 lines) states the ownership split. The workbench reducer owns the serializable `CanvasDocumentContractV3`; the engine owns pixels, rendering, history and transient state.
  - The contract has four stack forests (raster, control, regional guidance, inpaint mask) and groups up to 10 deep.
  - It allows at most 10,000 nodes and refuses older versions.
  - `PersistenceController` flushes dirty bitmaps behind barriers.
- **`canvas-operations`** imports `@platform/state/accountLifecycle`, `@features/gallery` and the backend. It is rejected.
- **Finding:** the engine's own boundary matches Yamakan's: a serializable document owned outside, and pixels owned by the engine. A host adapter can map the document contract onto a canonical revision and the dirty bitmaps onto content-addressed assets. No second store is needed.

### R3 — ArtCraft scene engine (`28a39a0d`, Apache-2.0 / MIT)

- **Evidence:** [`artcraft-scene-engine.json`](../../evidence/rea/source-reuse-2026-10-18/artcraft-scene-engine.json).
  - Evidence id `ev_344cd98f…d609`.
  - 64 source files, 448 nodes, 856 edges, 0 parse failures.
- **External imports across the engine:**
  - `three` (100) and three addons (controls, postprocessing, loaders).
  - `@sparkjsdev/spark` (11) and `mediabunny` (7).
  - `@storyteller/common` (8), `@storyteller/keybinds` (7) and `@storyteller/ui-viewer-3d` (3).
  - `react-hot-toast` and `lucide-react`.
- **Per-file reading:**

| File                                                                    | Lines      | Coupling                                                                                                      | Decision                                |
| ----------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `cameraMath.ts`                                                         | 196        | Imports only `three` (`MathUtils`, `Vector3`, `PerspectiveCamera`): free-camera move, rotate, pan, zoom, lerp | Direct candidate                        |
| `EditorState/EditorStateJSON/object_3d_json.ts` + `scene_state_json.ts` | 27 + small | Pure schema `{version, sceneItems: Object3DJSON[]}`                                                           | Adapt (see below)                       |
| `editor/CameraController.ts`                                            | 345        | three, PointerLockControls and the event bus                                                                  | Adapt                                   |
| `save_manager.ts`                                                       | 372        | `StoryTellerProxyScene` / `@storyteller/common`                                                               | Reject                                  |
| `HistoryManager.ts`                                                     | 105        | —                                                                                                             | Reject: canonical revisions own history |

- **The scene schema gaps:** it lacks camera intrinsics, units and Euler order. Its `media_file_token` is a hosted-service token, which maps to a Yamakan asset id.
- **Finding:** camera math and the schema are reusable. The rest is coupled to ArtCraft's hosted platform. The do-not-import list in the [source reuse ledger](../../SOURCE_REUSE_LEDGER.md) still applies to ArtCraft's browser-emulation and consumer-session crates.

### R4 — Mediabunny (`9d36fc57`, MPL-2.0, package 1.61.3)

- **Evidence:** [`mediabunny-src.json`](../../evidence/rea/source-reuse-2026-10-18/mediabunny-src.json).
  - Evidence id `ev_01b9c52f…2bb7`.
  - 66 source files, 1,063 nodes, 3,217 edges, 0 parse failures.
- **The only external import is `node:fs/promises`,** in its Node entry. The browser build has no third-party dependency.
- **It includes HLS and segmented input.** Yamakan must use only file and `Blob` sources and never a URL or playlist source. This keeps the same subresource rule as the FFmpeg probe.
- **ArtCraft already depends on it** (7 imports), which is independent evidence of production use.
- **Finding:** use it as a pinned npm dependency (ladder A), unmodified, so the MPL-2.0 file-level obligations stay trivial.

### R5 — ComfyUI (`7f7fd918`, GPL-3.0), Python, static reading

- **Evidence:** [`python-and-license-inspection.json`](../../evidence/rea/source-reuse-2026-10-18/python-and-license-inspection.json).
- **Size:** `server.py` is 1,568 lines and `execution.py` 1,464.
- **The routes include:**
  - `POST /prompt`, `GET /history/{prompt_id}`, `POST /interrupt` and `POST /free`;
  - `POST /api/jobs/{job_id}/cancel`, `GET /view` and `POST /upload/image`;
  - 27 routes in total, including the `GET /ws` WebSocket.
- **Finding:** the integration boundary is the HTTP API, so Yamakan wraps the engine rather than copying code. Custom nodes run arbitrary Python, so only a pinned node set is allowed and the server runs as a contained worker (procd, ephemeral loopback port). An authenticated channel and outbound-network denial are not in place today, so no real engine runs before gate E-SEC ([04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md) M13).

### R6 — OpenVideoStudio (`175da996`, Apache-2.0 + NOTICE), Python, static reading

- **Identity contracts** (`studio/identity/models.py`, 46 lines) are four frozen dataclasses:
  - `ReferenceImage`;
  - `CharacterAsset` (character id, description, references, clothing, accessories, embeddings, bible version);
  - `IdentityEncoding`;
  - `IdentityApplication`.
- **`assets.py`** (66 lines) loads a character bible from disk.
- **`_comfy_client.py`** (147 lines) defines `is_available`, `upload_input_image`, `submit`, `wait_for_result` (polling), `cancel`, `output_path` and `free`.
- **Finding:** port the contracts to zod, keyed by canonical asset ids instead of paths. Use the client's shape as the reference for Yamakan's ComfyUI engine adapter, with polling replaced by job attempts and output lookup by content-addressed import.

### R7 — OpenMontage (`9327439d`, AGPL-3.0), Python, static reading

- **Sizes:**
  - `lib/checkpoint.py`: 633 lines;
  - `lib/pipeline_loader.py`: 240;
  - `lib/delivery_promise.py`: 247;
  - 13 pipeline definitions.
- **The manifest** declares stages with `required_artifacts_in`, `produces`, `checkpoint_required`, `human_approval_default` and `success_criteria`.
- **The checkpoint store** is file-per-stage under `PROJECTS_DIR`, validated by JSON Schema.
- **Finding:** the manifest format and prerequisite/approval rules are the value. The file store would be a second authority and is rejected. Six original prerequisite and gate tests were already run in an earlier session ([ledger](../../SOURCE_REUSE_LEDGER.md)).

### R8 — AI Video Production Editor (`752cd43d`, GPL-3.0-or-later)

- **18 files are already imported** ([ledger](../../provenance/imports.json)).
- **No donor module renders a video clip's own sound.** The remaining audio modules are `audioMastering/*` (local and remote providers) and `audioRemasterService.ts`.
  - The remote provider is a hosted service and is excluded.
  - The local provider is a later Audio-workspace candidate pending inspection.
- **`TRADEMARK.md`:** the GPL grants code rights, not the right to present a fork as the official project. Yamakan never shows the donor's name as product branding.

### R9 — Yamakan itself (main `6e471088`)

- **Confirmed defect:** in `core/render/plan.ts`, an `AudioInstruction` is created only when the clip's track is a sound track or its asset is audio. Video assets add only picture layers.
- **Prevention in the schema:** the canonical schema forbids a video asset on a sound track (`core/canonical.ts`). Imported camera sound therefore never reaches the export.
- **Masking in the preview:** the imported `PreviewPlayer.tsx` mutes embedded video sound to match the export, so the defect is invisible in preview too.

## Proprietary products (DaVinci Resolve, Paper, Figma, Higgsfield, LTX Studio, Runway, Kling, Premiere, After Effects)

No proprietary product was inspected in this session beyond the public, already-recorded comparison in the [competitor matrix](../../COMPETITOR_MATRIX.md). No authentication, DRM, licence check or access control was bypassed or attempted. No binary was analysed, and nothing was decompiled.

Workflow ideas taken from these products are behaviour-level only: for example, Resolve's linked audio, Figma's frame/canvas model and Runway/Kling's take-and-variant pattern. They are reimplemented as Yamakan's own design and never copied.

## Uncertainty

- REA's graphs show import coupling, not runtime behaviour.
- Inherited test counts are counts of donor test files. They have not been run in Yamakan.
- The Python donors were read, not executed.
- Every "Finding" is a planning decision to be confirmed by the validation listed for that module in [04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md).
