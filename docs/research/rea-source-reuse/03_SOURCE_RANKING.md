# 03 — Source ranking

## Scoring method

| Criterion                  | Weight | What earns a high score (0–5)                                                                                         |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Compatibility              | 25     | Fits D′ unchanged: TypeScript or a process boundary, one authority, integer time, React 18 tolerated, Windows offline |
| Maturity                   | 20     | Tests at the pin, a stated architecture, recent maintained history, used by others                                    |
| Coverage                   | 20     | Share of the target subsystem's needed behaviour that the donor supplies                                              |
| Integration cost (inverse) | 15     | Few external imports (REA), little adapter code, no build toolchain change                                            |
| Security                   | 10     | No network, credentials, dynamic code or hosted-service coupling inside the reused part                               |
| Maintainability            | 10     | Small surface, clear licence obligations, ability to diff against upstream                                            |

Score = Σ(criterion score × weight) / 5, so the maximum is 100. **Scores are the agent's assessment against the cited evidence**. They are not measurements. Where an input is unknown, it scores 2 and the reason says "unmeasured".

### Hard gates (fail = not eligible as primary, whatever the score)

- **H1 licence.** Yamakan is GPL-3.0-or-later, so the reused code's public licence must be compatible with distributing it.
  - The founder's attested source authorization is recorded ([11](11_SOURCE_PROVENANCE_AND_BRANDING.md)). The agreements behind it are confidential and not independently verified.
  - **No primary choice in this plan depends on them.** Every primary is eligible under its public licence alone.
  - Company-size licences (Remotion, OpenVideo/React Video Editor) therefore stay reference-only.
- **H2 one authority.** The donor brings no second database, scheduler, renderer, history or project state.
- **H3 no hosted or evasion coupling** in the imported part: tokens, consumer sessions, TLS impersonation or account lifecycle.
- **H4 offline Windows.** The imported part runs without network on Windows 11, or as a contained worker.
- **H5 pinned.** The exact source is pinned in the [catalog](../../SOURCE_CATALOG.md) and readable.

## Per-subsystem ranking (primary and fallback)

| Subsystem                             | Candidate (pin)                                                     | C25 | M20 | Cv20 | I15 | S10 | Mt10 | Score | Gates                                            | Role                                                                       |
| ------------------------------------- | ------------------------------------------------------------------- | --- | --- | ---- | --- | --- | ---- | ----- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Edit: ripple / group move / retime    | OpenCut Classic `cf5e79e9`                                          | 5   | 3   | 4    | 4   | 5   | 4    | 83    | pass                                             | **Primary**                                                                |
|                                       | AI Video Production Editor `752cd43d` (already imported timeline)   | 4   | 3   | 2    | 4   | 4   | 4    | 68    | pass                                             | Fallback                                                                   |
|                                       | Kdenlive / MLT                                                      | 1   | 5   | 4    | 1   | 4   | 2    | 56    | H2 fail (MLT model)                              | Reference                                                                  |
| Keyframe animation                    | OpenCut `animation/`                                                | 4   | 3   | 4    | 3   | 5   | 3    | 73    | pass                                             | **Primary**                                                                |
|                                       | Remotion `interpolate`                                              | 3   | 5   | 2    | 3   | 5   | 3    | 68    | H1 fail                                          | Reference                                                                  |
|                                       | Yamakan original (E)                                                | 5   | 1   | 2    | 2   | 5   | 4    | 61    | pass                                             | Fallback                                                                   |
| Studio canvas                         | InvokeAI webv2 `canvas-engine` `ffe9e1a9`                           | 4   | 5   | 5    | 2   | 4   | 3    | 80    | pass                                             | **Primary**                                                                |
|                                       | tldraw `7937be36`                                                   | 3   | 5   | 3    | 3   | 4   | 2    | 68    | H1 unresolved (commercial terms)                 | Reference                                                                  |
|                                       | InvokeAI webv1 `controlLayers` (Konva)                              | 3   | 4   | 4    | 2   | 4   | 2    | 65    | pass                                             | Fallback                                                                   |
| Cinema camera / 3D scene              | ArtCraft `cameraMath.ts` + scene schema `28a39a0d`                  | 4   | 3   | 3    | 4   | 4   | 4    | 72    | pass (excluded crates stay excluded)             | **Primary**                                                                |
|                                       | Blender `754ebe3c` (headless worker)                                | 2   | 5   | 5    | 1   | 3   | 2    | 63    | H4 unqualified                                   | Fallback (later)                                                           |
| Director pipeline / gates             | OpenMontage `9327439d` manifests and rules                          | 3   | 3   | 4    | 3   | 4   | 3    | 66    | pass (AGPL-3.0 combines with GPL-3.0, §13)       | **Primary**                                                                |
|                                       | StoryMind `00f9a0c7`                                                | 2   | 2   | 3    | 2   | 2   | 2    | 44    | H3 (default third-party LLM endpoint)            | Reference                                                                  |
| Identity / character bible            | OpenVideoStudio `175da996` contracts                                | 4   | 3   | 3    | 5   | 5   | 5    | 79    | pass                                             | **Primary**                                                                |
|                                       | OpenMontage artifacts                                               | 3   | 3   | 2    | 3   | 4   | 3    | 58    | pass                                             | Fallback                                                                   |
| Local generative engine               | ComfyUI `7f7fd918` wrapped (D)                                      | 4   | 5   | 5    | 3   | 2   | 3    | 79    | pass as a contained process; custom nodes pinned | **Primary** (disabled until F)                                             |
|                                       | Wan2GP `6479db36`                                                   | 2   | 3   | 3    | 2   | 2   | 2    | 48    | H1 (community licence), H4 unqualified           | Fallback for Motion only                                                   |
| Browser demux / waveform / thumbnails | Mediabunny `9d36fc57` (A)                                           | 5   | 4   | 4    | 5   | 4   | 4    | 88    | pass (file and Blob sources only)                | **Primary**                                                                |
|                                       | FFmpeg-derived server proxies (existing)                            | 5   | 5   | 3    | 4   | 4   | 4    | 85    | pass                                             | Fallback (present today)                                                   |
| Live title preview                    | JASSUB `dea3d2d3` (A)                                               | 4   | 3   | 5    | 4   | 4   | 4    | 80    | pass                                             | Planned upgrade (after the native Arabic review and preview/export parity) |
|                                       | Server-rendered reference still (existing)                          | 5   | 4   | 3    | 5   | 5   | 5    | 88    | pass                                             | **Primary** (present today; highest score)                                 |
| Interchange                           | OTIO JSON subset writer (E) validated by OTIO `00c22fa3` in tests   | 5   | 4   | 3    | 4   | 5   | 4    | 83    | pass                                             | **Primary**                                                                |
|                                       | OTIO Python in a contained worker (D)                               | 3   | 5   | 5    | 2   | 4   | 3    | 75    | H4 native build unqualified                      | Fallback                                                                   |
| Render engine                         | FFmpeg + libass (existing, D)                                       | 5   | 5   | 5    | 5   | 4   | 4    | 96    | pass                                             | **Primary** (unchanged)                                                    |
|                                       | MLT                                                                 | 2   | 5   | 4    | 1   | 4   | 2    | 61    | H2 (second render model)                         | Reference                                                                  |
|                                       | Remotion                                                            | 2   | 5   | 3    | 2   | 3   | 2    | 58    | H1, H2                                           | Reject                                                                     |
| Agents / governance                   | Ascout lineage, Gomrey transition rules, Ninerr transport (founder) | 4   | 2   | 2    | 4   | 4   | 4    | 64    | pass                                             | **Primary** (concepts and rules only)                                      |
|                                       | Orcel / Aly routing                                                 | 2   | 2   | 1    | 3   | 2   | 3    | 41    | H3 (inherited shell authority)                   | Reject                                                                     |
| Retimed audio preview                 | soundtouchjs (via OpenCut `retime/audio-stretch.ts`)                | 4   | 3   | 4    | 4   | 5   | 3    | 76    | pass (LGPL-2.1, as a dependency)                 | **Primary** (preview only; export uses FFmpeg `atempo`)                    |

### Reasons behind the decisive scores

- **OpenCut compatibility 5:** REA shows ripple importing only `@/timeline/types`. The `@/wasm` usage is `MediaTime` arithmetic, already adapted twice (`core/donors/opencut/`).
- **OpenCut maturity 3:** only 3 test files cover these modules at the pin, and none covers ripple or group move.
- **InvokeAI maturity 5:** 145 test files, an architecture document, and an enforced dependency policy. The policy lives outside the subtree, so Yamakan must port its rules. The commit is from 2026-10-10.
- **InvokeAI integration cost 2:** about 35,600 source lines; tests in Vitest (Yamakan uses `node:test`); two npm dependencies; a host adapter for documents, bitmaps and media references.
- **ComfyUI security 2:** custom nodes run arbitrary Python, and the server is a network service. Containment and a pinned node set are mandatory.
- **Mediabunny integration cost 5:** REA finds no third-party import in the browser build.
- **Wan2GP and StoryMind** fail a hard gate on their public terms or default network coupling. They are kept as references.
- **tldraw and Remotion** have commercial or company-size terms. They are not primaries, so no choice relies on unverified private grants.

## Top ten repositories by reuse value

| Rank | Repository @ pin                                   | Why                                                                                                      |
| ---- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | invoke-ai/InvokeAI `ffe9e1a9`                      | Largest well-tested, self-contained subsystem (the canvas engine) aligned with Yamakan's ownership model |
| 2    | OpenCut-app/opencut-classic `cf5e79e9`             | Pure timeline algorithms in TypeScript; adapter pattern already proven in Yamakan                        |
| 3    | Vanilagy/mediabunny `9d36fc57`                     | Zero-dependency browser demux and decode; used unmodified                                                |
| 4    | FFmpeg `b5902e69` + libass `f61db567`              | Existing render and typography engines; unchanged                                                        |
| 5    | storytold/artcraft `28a39a0d`                      | Pure camera math and scene schema for Cinema                                                             |
| 6    | ThaUnknown/jassub `dea3d2d3`                       | libass in WebAssembly for live preview parity with export                                                |
| 7    | Comfy-Org/ComfyUI `7f7fd918`                       | The local engine API boundary for Studio and Motion                                                      |
| 8    | mne03005-png/OpenVideoStudio `175da996`            | Small identity contracts and a ComfyUI client shape                                                      |
| 9    | calesthio/OpenMontage `9327439d`                   | Stage manifests and prerequisite and approval rules for Director                                         |
| 10   | LudwigKienle/ai-video-production-editor `752cd43d` | Already-integrated editing UI; remaining modules are candidates                                          |

AcademySoftwareFoundation/OpenTimelineIO `00c22fa3` ranks 11th. It is the interchange oracle in tests rather than shipped code.
