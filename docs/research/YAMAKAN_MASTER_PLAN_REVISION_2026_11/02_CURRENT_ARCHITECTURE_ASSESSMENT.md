# Current architecture assessment

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

What the code on `main` does today, as the starting point for
[03_GAP_AND_DEPENDENCY_ANALYSIS.md](03_GAP_AND_DEPENDENCY_ANALYSIS.md),
[05_TARGET_ARCHITECTURE.md](05_TARGET_ARCHITECTURE.md) and [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md).
It was written by reading code at the baseline; no test, build or qualification script was run.
Research notes written one merge before the drafting head (at `0284ba8`; kept under
[evidence/research/](evidence/research/)) were re-checked, and the code wins where they disagree. Two corrections matter: `yamakan.scene.migrate` is not human-only, but its `run` refuses
every `agent:` principal ("Agents cannot assign legacy scenes to projects"); and PR #277 (aerial
view) is in the baseline, so the Director planner now follows every direction word Create offers.
The documents were drafted at `4a8e1b5` (PR #277); `main` then moved by one merge, PR #278 (item
motion in Blender renders), whose six changed files were re-read and are reflected below.

Maturity terms: **QUALIFIED** — a `qualify:*` script exists and its evidence file is committed
under `docs/evidence/`; **IN CODE** — implemented with tests, enabled, reachable where a person
would expect it; **COMMAND ONLY** — a tested command that no browser code calls (found by searching
`src/` for the operation name); **FLAG OFF** — code behind a gate that is off at head; **STUB** —
answers "unavailable" or empty by design; **ABSENT** — no code. "Tested" means a test file naming
the behaviour exists; nothing was observed passing.

## 1. Summary

1. The authorities are real, single and tested: one SQLite workspace store (`core/store.ts`
   `ProjectStore`), one registry of 116 commands (`core/command/registry.ts`), one job
   authority (`core/jobs.ts` `JobSupervisor`), one process owner over `native/procd`, one
   content-addressed media store and immutable creative documents.
2. Browser, REST, SDK, CLI and MCP all reach the registry through `POST /api/v1/call` and the same
   `authorize`; 13 commands are human-only (they need the `browser-ui` principal).
3. Generation is real but narrow: one remote route, the person's own Kaggle notebook, with three
   offered recipes and two operations (text-to-video, first-frame image-to-video), durable across
   restarts and never resent. Two environment variables enable it; `ENGINE_ENABLED` is still
   `false` and does not gate it.
4. The Blender worker (pinned 5.3.0, Cycles on CPU, contained) renders Cinema scenes,
   Director-planned shots, stored `.glb` models, camera tracks, match-move plates and an aerial
   view; it is the most actively changing code.
5. The editor engine is deeper than its interface: ripple, insert, group move, speed, sound
   unlink, loudness, batch and OTIO export, take compare and match-move are tested commands with no
   browser control.
6. A generated take does not carry its generation parameters into the project: `core/story.ts`
   `TakeLineageSchema` is `{label?, outputHash, inputs, continuity?}`, and Create writes seed, steps
   and model into `label` and the prompt into shot `notes` (`src/create/create-story.ts`
   `addMadeVideo`). This is the largest gap against the thesis.
7. Generation cannot target an existing shot (`GenerationRequest` has no shot id), and a take
   cannot replace a shot shown by more than one clip (`core/takes.ts` `shotClip`).
8. Thin areas: SDK (no wait or events), CLI (always the all-scopes local client), MCP (tools only,
   cancellation ignored, list not filtered by scope), transcription (always unavailable), router
   (always `eligible: []`), model licence handling (one string per recipe).
9. Spending, egress, download, licence and secret guarantees hold because code is absent, not
   because a gate refuses (section 7).
10. Windows, the release platform, is the least tested in CI: three test selections and a font
    probe; containment and native tests run only on the founder's machine.
11. The Blender, Cinema-model, prompt-library and Director-to-Blender `qualify:*` scripts write
    receipts only where `YAMAKAN_QUALIFY_RECEIPT` points, "never into the repository", so none of
    that stream is QUALIFIED by this document's rule.
12. Top-level documents are wrong in both directions: several describe a product with no
    generation and engines off; others describe quotes, reservations, MCP resources and a Python
    SDK that do not exist (section 6).

## 2. System map

### 2.1 Single authorities

| Authority | File and symbol | Notes at head |
|---|---|---|
| Workspace store | `core/store.ts` `ProjectStore` (`WORKSPACE_SCHEMA_VERSION = 18`, `SNAPSHOT_FORMAT = "yamakan.project/2"`, `MAX_REVISION` 10,000); `core/service-lock.ts` `acquireServiceLock` | snapshots, revisions, receipts, outbox, jobs, consents, agent tokens, documents, Cinema models |
| Canonical project | `core/canonical.ts` (`FORMAT_VERSION = 5`, latest 7) | one implicit timeline; `core/project.ts` is a projection |
| Command registry | `core/command/registry.ts` `commands`, `execute`, `authorize`, `catalog` | 61 mutations, 13 human-only, 20 `NO_REPLAY`, 2 `RETRY_WITH_KEY`; `catalog` has no `humanOnly` field |
| Principals and scopes | `Scopes`, `HumanOnlyScopes`, `assertAgentScopeCeiling`; `server/main.ts` `authenticate`; `core/agents.ts` `hashAgentToken` | `browser-ui`, `local-client`, `agent:<uuid>` |
| Jobs | `core/jobs.ts` `JobSupervisor` (one, built in `server/api.ts` `CreativeAPI`); `core/jobs/rules/yamakan-transitions.ts` | kinds `export`, `blender-render`, `blender-track`, `cfr-derivative`, `remote-generation`; one sequential pump |
| Process boundary | `core/process/owner.ts` `ProcessOwner`; `native/procd/src/main.rs`, `native/procd/src/container.rs`; `core/process/workers.ts` | every FFmpeg and Blender worker; the Kaggle CLI (`execFile`) is the one exception |
| Media store | `core/storage/storage.ts` `LocalContentAddressedStorage` | SHA-256 addressed |
| Creative documents | `core/documents.ts`; `core/document-ref.ts` `DocumentKind` | `studio`, `cinemaScene`, `story`, `referencePack`, `captions`, `lut`, `promptPresets` |
| Generation service | `core/engines/generation.ts` `createGenerationService`; `JobSupervisor.generationLedger()` | chosen by `generationOf` (Kaggle, else ComfyUI) |
| Consent | `core/director/runtime.ts` `grantConsent`, `assertConsentUsable`; `core/continuity.ts` `assertMaySend` | gate at the store's one commit point |
| Frozen policies | `core/command/policy.ts` `RESOURCE_POLICY` (v3); `core/qualification-policy.ts` (v1) | never adjusted to pass |
| Code provenance | `docs/provenance/imports.json`, `docs/provenance/import-policy.json`; `scripts/provenance.mjs`, `scripts/import-guard.mjs`, `scripts/sbom.mjs` | `core/engines` is a donor root |

### 2.2 Surfaces

| Surface | Files | Principal | Notes |
|---|---|---|---|
| Browser | `src/main.tsx` (one `App`, 2,804 lines); `src/workspaces/ProjectShell.tsx`; `src/create/`, `src/director/`, `src/cinema/`, `src/studio/`, `src/editor/` | `browser-ui`, from a single-use launch secret (`core/launch.ts`) | the only principal for human-only commands |
| REST | `server/main.ts`, `server/api.ts` `CreativeAPI.execute`, `server/document-stage.ts` | any | binds `127.0.0.1`; upload routes call `authorize`; imports `scripts/bundle.ts` |
| SDK | `sdk/client.ts` `YamakanClient` (8 public methods), `sdk/service-proof.ts`, `sdk/progress.ts` | the given token | in-repo, unversioned |
| CLI | `cli/main.ts`; offline `cli/recovery.ts`, `cli/migrate.ts`, `cli/open.ts` | `local-client` | no agent token, wait or help |
| MCP | `mcp/main.ts`, `mcp/framing.ts` | `agent:<uuid>`; `local-client` only with `YAMAKAN_MCP_LOCAL_CLIENT=1` | stdio; 117 tools (116 + `yamakan_document_save`) |

Invariants under test: REST/MCP parity (`tests/parity.test.ts`), receipt or request-id refusal
(`tests/request-id-refusal.test.ts`), strict path-free input (`tests/command.test.ts`).

## 3. Subsystem assessment

### 3.1 Project, timeline and editor

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Canonical project, typed batches, autosave, undo, redo, history, restore | IN CODE | `core/canonical.ts`; `yamakan.project.applyBatch`, `project.undo`, `project.restore`; `tests/timeline.test.ts`, `tests/undo-across-documents.test.ts` | each undo spends one of 10,000 revisions |
| Trim, split, move, tracks, transform and crop, dissolve, plain titles | IN CODE | `core/timeline/operations.ts`; `yamakan.clip.setEffects`, `transition.set`; `tests/effect-parity.test.ts`, `tests/transitions.test.ts` | titles have no style |
| Ripple delete and trim, insert, group move, speed | COMMAND ONLY | `yamakan.timeline.rippleDelete`, `rippleTrim`, `insert`, `groupMove`, `clip.setSpeed`; `tests/ripple.test.ts`, `tests/set-speed.test.ts` | `src/edit-ops.ts` helpers are not imported by `src/main.tsx` |
| Slip, slide, roll | ABSENT | `src/main.tsx` passes `trimMode="normal"` | |
| Keyframes | IN CODE for opacity and volume | `core/render/animation-filters.ts` refuses a plan that animates a transform channel | |
| Preview and 720p playback | QUALIFIED | `src/reference.tsx`, `core/render/parity.ts`; `qualify:playback`, `docs/evidence/qualification/playback.json` | |
| Export | QUALIFIED at an old commit | `yamakan.export.video` (`projectId`, `idempotencyKey`, `normalizeLoudness?`); `core/render.ts`; `qualify:release`, `docs/evidence/qualification/t10-release.json` | one profile (libx264, CRF 20); no settings |
| Batch export | COMMAND ONLY | `yamakan.export.batch` | |
| Limits | IN CODE | `core/canonical.ts`: 200 clips, 16 tracks, ten minutes | M export unqualified (SS-005b) |
| Workspace shell | IN CODE | `src/workspaces/ProjectShell.tsx` `WORKSPACES` | default Edit; Story has no brief or shot-card editor |

### 3.2 Story, shots and takes

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Story document (up to 8 takes per shot) | IN CODE | `core/story.ts` `STORY_LIMITS` (`documentBytes` 256 KiB), `formatVersion` 1; `yamakan.story.save` | called only from Create and Director |
| Take lineage | IN CODE, thin | `core/story.ts` `TakeLineageSchema` | no prompt, seed, model or recipe (MPR-101) |
| Take list, propose replace, apply | QUALIFIED | `core/takes.ts`; `src/director/TakeReview.tsx`; `qualify:take-review`, `docs/evidence/ultimate/SS-006-take-review.md` | inside the collapsed Director section |
| Take compare | COMMAND ONLY | `yamakan.take.compare` | SS-011 |
| Replace on a split or trimmed shot | ABSENT | `shotClip` throws when `clipIds.length !== 1` | MPR-105 |
| Reference packs, roles, pins | IN CODE | `yamakan.pack.save` (Create Elements and People); `tests/story-packs.test.ts` | "no model receives them" (`src/create/ElementsPanel.tsx`) |
| Continuity check | COMMAND ONLY | `yamakan.continuity.check`; `core/continuity.ts` returns `status: "unmeasured"` | |
| Identity encoding | STUB | `yamakan.identity.encode` records a caller-supplied `payloadHash` | |
| Brief, script, shot intent in the project | ABSENT | Create keeps its brief in `localStorage` (`src/create/CreateWorkspace.tsx`) | MPR-106 |

### 3.3 Create workspace and generation

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Create workspace | QUALIFIED | `src/create/CreateWorkspace.tsx`; `qualify:create`, `docs/evidence/ultimate/create-workspace.md` | not in CI |
| Wan2.2-TI2V-5B text-to-video | QUALIFIED | `KAGGLE_RECIPES` `kaggle-wan22-ti2v-5b`; `qualify:kaggle`, `docs/evidence/ultimate/kaggle-page-run-receipt.json` | needs `YAMAKAN_KAGGLE_CLI`, `YAMAKAN_KAGGLE_USERNAME` |
| CogVideoX-2b text-to-video | QUALIFIED | `kaggle-cogvideox-2b`; `qualify:kaggle-cogvideox`, `docs/evidence/ultimate/kaggle-cogvideox-page-run-receipt.json` | |
| First-frame image-to-video | QUALIFIED | `kaggle-wan22-ti2v-5b-first-frame`; `core/engines/clean-image.ts`; `qualify:kaggle-first-frame`, `docs/evidence/ultimate/kaggle-first-frame-page-run-receipt.json` | `noUnconsentedPerson` per run; send consent for pack-linked images |
| Record before send, follow after restart, never resend | QUALIFIED | `JobSupervisor.generationLedger()`; `tests/generation-durable.test.ts`; `qualify:create-durable`, `docs/evidence/ultimate/kaggle-restart-run-receipt.json` | which script wrote that receipt: not verified |
| Stop a Kaggle run | STUB by necessity | `requestCancel` returns `remoteAcknowledged: false`; `job.cancel` refuses `remote-generation` | quota is used until the run ends |
| Bring in a generated video | IN CODE | `yamakan.generation.import`; `bringIn` checks size and SHA-256 | the lineage keeps the prompt only as an unsalted hash; the generation ledger row in `jobs.payload` keeps the full prompt |
| Generate into an existing shot | ABSENT | `generation.start` input has no shot id; Create adds a shot to the "Made in Create" story | MPR-102 |
| Prompt library and presets | IN CODE | `core/prompts/library.ts`, `core/prompts/presets.ts`; `yamakan.prompt.search`, `prompt.fill`, `prompt.savePresets`; `tests/prompt-library.test.ts` | `qualify:prompt-library` receipt not committed |
| Estimate | STUB | `yamakan.generation.options` gives `expectedSeconds`, `timeoutSeconds` only | MPR-203 |

### 3.4 Engines, catalog and router

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Adapter contract v2 | IN CODE | `core/engines/contract-v2.ts` `EngineAdapterV2`, `Operation` (5 values); `tests/generation-service.test.ts` | no quote or validate; `videoEdit`, `transcribe`, `enhance` have no adapter |
| ComfyUI probe | IN CODE | `yamakan.engines.comfyui`; `probeComfy`, loopback-only `comfyBaseUrl` | a person starts ComfyUI |
| ComfyUI generation | FLAG OFF | `comfyGeneration` refuses while `ENGINE_ENABLED` is false and `PINNED_COMFY_RECIPES` is empty; no-model run in `docs/evidence/ultimate/comfyui-engine.md` | in-memory ledger, not durable |
| Local weights | STUB | `PINNED_MODEL_MANIFESTS` empty; `CommandContext.modelRoot` never set | |
| Capability report | STUB | `yamakan.engines.capabilities` answers `ENGINE_DISABLED`; Kaggle `capabilities: () => []`; the live route is described by `yamakan.generation.options` | MPR-202 |
| One model catalog | ABSENT | `KAGGLE_RECIPES`, `PINNED_COMFY_RECIPES`, `PINNED_MODEL_MANIFESTS`, `SERVER_RECIPES`, `core/engines/candidates.ts`, `src/create/create-model.ts` `CREATE_MODELS`, two evidence JSON files | MPR-201 |
| Router | STUB | `core/router/explain.ts` `explainRoutes` | MPR-305 |
| Hosted providers, credentials | ABSENT | no client, key store or adapter | MPR-210, MPR-211 |
| Model licence gate | STUB | `ACCEPTED_MODEL_LICENSES` is used by `core/engines/manifests.ts` and `core/engines/candidates.ts`, not by `KAGGLE_RECIPES` | MPR-208 |

### 3.5 Studio

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Studio document, bitmaps, save and reopen | QUALIFIED | `core/studio.ts`; `src/studio/StudioCanvas.tsx`; `qualify:studio-activation`, `docs/evidence/qualification/studio-activation.json` | debug handle `__yamakanStudioQ8` on `window` |
| Studio editing tools; Studio output used elsewhere | not verified | `src/studio/canvas-engine/` not re-read | |

### 3.6 Cinema

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Cinema scene, viewport, lens presets | QUALIFIED | `core/scene3d.ts`; `src/cinema/CinemaViewport.tsx`; `qualify:cinema-activation`, `docs/evidence/qualification/cinema-activation.json` | intrinsics only; no camera transform or path |
| Legacy Cinema file store | IN CODE, still written | `yamakan.scene.save` calls `persistCinemaScene` (`core/cinema-store.ts`) | second persistence path (MPR-403) |
| `.glb` check, model store, page upload | IN CODE | `core/cinema/glb.ts` `checkGlb`; `tests/glb-check.test.ts`, `tests/cinema-model-store.test.ts` | `qualify:cinema-model` receipt not committed |
| Blender panel (moves, lights, finish) | IN CODE | `src/cinema/BlenderRender.tsx`; `tests/cinema-blender-panel.test.ts` | no control for aerial view or match-move |
| Control compiler | COMMAND ONLY | `yamakan.cinema.compileControls` | nothing consumes it |

### 3.7 Director

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Director stages, hash-bound approval | QUALIFIED | `core/director/stages.ts`; `yamakan.director.approve`; `qualify:director-activation`, `docs/evidence/qualification/director-activation.json` | manifests cannot name tools |
| `cinema-blender` pipeline | IN CODE | `core/director/cinema-pipeline.ts`; `planCinemaShot`; `yamakan.director.renderShot`; `tests/director-cinema.test.ts` | approval not checked when the take is placed; `qualify:director-cinema` receipt not committed |
| Planner reads the project's Cinema scene | ABSENT | `planCinemaShot` builds a fixed `SET` of boxes | |
| Model-driven stages | ABSENT | `core/director-flags.ts` lists them unsupported | Yamakan ships no language model |

### 3.8 Blender

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Pinned runtime, person-run install | IN CODE | `core/blender/runtime.ts` `BLENDER_PIN`; `scripts/blender-install.ts` | Windows x64 only |
| Contained render; moves, light, finish, detail, aerial, models, item motion to one end pose | IN CODE | `core/blender/scene.ts` (`BLENDER_SCENE_LIMITS`, `view: "aerial"`); `core/scene3d.ts` (optional `motion` on a scene item, PR #278); `scripts/blender/yamakan_render.py`; `tests/blender-render.test.ts` | per-render choices, not project state; item motion has no Cinema page control and no path of more than two poses; `qualify:blender-slice` receipt not committed |
| Tracking and match-move | COMMAND ONLY | `yamakan.blender.track`, `yamakan.track.read`, `plate`; `core/blender/track.ts` | |
| Queueing; re-follow after reload | ABSENT | `BLENDER_RENDERS_AT_ONCE = 1`; `src/cinema/BlenderRender.tsx` keeps renders in a module-level `Map` | MPR-507 (queue and rerun); no card plans re-follow after reload |

### 3.9 Audio and captions

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Gain, sound on and off, volume keys | IN CODE | `yamakan.clip.setSound` | |
| Sound unlink and relink | COMMAND ONLY | `yamakan.clip.unlinkSound`, `relinkSound`; `tests/w18-audio-flow.test.ts` | |
| Loudness normalisation | COMMAND ONLY | `normalizeLoudness`; `qualify:w18-loudnorm`, `docs/evidence/qualification/w18-loudnorm.json` | the command path is qualified; no control |
| Captions (import, edit, split, burn-in, export) | IN CODE | `src/captions.tsx`; `tests/captions.test.ts`; `docs/evidence/ultimate/SS-013-captions.md` | SS-013 open on X-01 |
| Transcription | STUB | `yamakan.audio.transcribe` throws `CAPABILITY_UNAVAILABLE` | MPR-221 |
| Narration, TTS, lip sync, music | ABSENT | generation requests `audio: false` | |

### 3.10 Quality lab

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Quality lab | COMMAND ONLY | `yamakan.quality.compare`; `qualify:quality-lab`, `docs/evidence/qualification/p10-05-quality-lab.json` | |
| Benchmark harness | IN CODE | `core/quality/benchmark.ts`; `docs/evidence/ultimate/benchmark-protocol.json` | no comparative run |
| `yamakan.lineage.evaluate` | STUB | `core/agents/lineage.ts` | review independence, not asset lineage |

### 3.11 SDK, CLI, MCP and agents

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| SDK, service proof | IN CODE | `sdk/client.ts`; `tests/service-proof.test.ts` | `call` drops the request id on success |
| CLI | IN CODE, thin | `cli/main.ts` | no dedicated test file |
| MCP tools | IN CODE | `mcp/main.ts`; `tests/mcp.test.ts` | `{tools: {listChanged: false}}` only |
| MCP cancellation, progress, resources, prompts | ABSENT | `notifications/cancelled` returns; other methods `-32601` | MPR-501 (cancellation), MPR-502 (progress), MPR-304 (resources, prompts) |
| Honest tool list | ABSENT | no `humanOnly` in `catalog`; `proxy.build`, `proxy.cancel` are `mutation: false`, so `readOnlyHint: true` | MPR-501 |
| Agent tokens | IN CODE | `yamakan.agent.create`, `list`, `revoke`; `src/agent-access.tsx`; `tests/agent-token-lifecycle.test.ts` | `qualify:agent-access` receipt not committed |
| Progress view, handoff | COMMAND ONLY | `yamakan.progress.read`, `handoff.read`; `core/handoff.ts` | SS-007 open |
| Event cursor | ABSENT on every surface | `ProjectStore.events` has no caller outside tests | MPR-502 |
| Agent approval requests, budgets | ABSENT | agents get `SCOPE_DENIED` | MPR-504, MPR-505 |

### 3.12 Security and process containment

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Worker containment (Job Object, low-integrity token, AppContainer without network) | IN CODE, Windows only | `native/procd/src/container.rs`; `tests/containment.test.ts`; `docs/evidence/qualification/appcontainer-strict-2026-10-13.md` | not run in CI; POSIX unqualified |
| Pinned FFmpeg 7.1.5, decoder allow-list | IN CODE | `core/process/workers.ts`; `core/media.ts` `MEDIA_DECODERS`; `tests/media-decoders.test.ts` | |
| Owner-only workspace, loopback, Origin checks, CSP | IN CODE | `core/process/access.ts` `restrictToOwner`; `server/main.ts`; `tests/http.test.ts` | |
| Human-only rule | IN CODE | `authorize` | not an OS boundary; Q15 fallback in `docs/evidence/qualification/q15-user-presence.json` |
| Kaggle CLI containment | ABSENT | `kaggleCli` uses `execFile`, outside procd; `kaggleCliEnvironment` passes an allow-list of names, eleven proxy and CA variables among them, and every variable whose name starts with `KAGGLE_` | MPR-205 narrows the lists and the working folder; it does not sandbox the CLI, and it keeps the eleven proxy and CA variables as a written, tested and disclosed exception |

### 3.13 Backup, recovery and storage

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Backup, restore into a new root, repair, garbage collection | IN CODE | `core/recovery.ts` `backupWorkspaceIdempotent`, `restoreFromHome`; `yamakan.workspace.backup`, `restore` (browser), `asset.repair`, `workspace.collectGarbage`; `cli/recovery.ts`; `tests/backup.test.ts`, `tests/portable-closure.test.ts` | no committed `qualify:browser-restore` receipt found |
| Content-addressed media store | IN CODE | `core/storage/storage.ts`; `tests/media-repair.test.ts` | |
| Generation lineage inside backups and exports | not verified | lineage lives in the `remote-generation` job payload, not the project | MPR-101 |

### 3.14 Interchange

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| OTIO export, loss report, import proposal | COMMAND ONLY | `yamakan.project.exportOtio`, `otioLosses`, `proposeOtio`; `core/interchange/otio.ts`; CI job `otio-oracle` | proposal cannot be applied (MPR-702) |
| EDL, FCPXML, AAF, export manifest | ABSENT | | MPR-701 (export manifest only); no card plans EDL, FCPXML or AAF |

### 3.15 Tests, CI and release

| Capability | Maturity | Evidence | Note |
|---|---|---|---|
| Test suite and Linux CI | IN CODE | 139 `tests/*.test.ts`; `.github/workflows/qualify.yml` job `qualify` | distribution FFmpeg, not the pin |
| Windows CI | thin | job `qualify-windows-r8`: two test files, `Q3:` typography tests, a font probe | no `qualify:*`, `test:studio`, `cargo test` in CI (MPR-804) |
| Unsigned bundle | QUALIFIED | `scripts/bundle.ts`; `qualify:unsigned-rc`, `docs/evidence/qualification/p10-08-unsigned-rc.json` | no signing, no release workflow; release NO-GO |

## 4. Feature flags and environment gates

| Name | File | Value at head | Effect |
|---|---|---|---|
| `ENGINE_ENABLED` | `core/engines/contract.ts` | `false` | ComfyUI generation and engine discovery refuse; does **not** gate Kaggle |
| `ROUTER_PROVIDERS_ENABLED` | `core/router/explain.ts` | `false` | `eligible: []` |
| `JASSUB_ENABLED` | `core/preview/jassub-flags.ts` | `false` | browser subtitle renderer off pending H1 and CSP review |
| `STUDIO_ENABLED`, `CINEMA_ENABLED`, `DIRECTOR_ENABLED`, `QUALITY_LAB_ENABLED`, `ANIMATION_ENABLED`, `FLOW_ENABLED`, `LOUDNORM_ENABLED`, `AUDIO_UNLINK_ENABLED`, `CREATIVE_DOCUMENTS_ENABLED` | `core/studio.ts`, `core/scene3d-flags.ts`, `core/director-flags.ts`, `core/quality/lab.ts`, `core/animation/flags.ts`, `core/flow/snapshot.ts`, `core/audio/loudnorm.ts`, `core/audio/unlink.ts`, `core/documents.ts` | `true` | P10 and AG-DOCS activations |
| `YAMAKAN_KAGGLE_CLI` + `YAMAKAN_KAGGLE_USERNAME` | `server/main.ts` | unset | both valid: the Kaggle route exists for this run |
| `YAMAKAN_COMFYUI_URL` | `server/main.ts` | unset | loopback ComfyUI for the probe only |
| `YAMAKAN_AG_DOCS_OFF`, `YAMAKAN_EFFECTS_OFF`, `YAMAKAN_TRANSITIONS_OFF` | `core/documents.ts`, `core/effects/registry.ts`, `core/transitions.ts` | unset | `=1` refuses new writes; stored data stays |
| `YAMAKAN_ANIMATION_COMPILER` | `core/render/animation-filters.ts` | unset | `=1` selects reference compiler v1 |
| `YAMAKAN_MCP_LOCAL_CLIENT`; `YAMAKAN_AGENT_TOKEN`, `_FILE` | `mcp/main.ts` | unset | `=1` makes MCP the all-scopes local client |
| `YAMAKAN_FFMPEG`, `YAMAKAN_FFPROBE`, `YAMAKAN_BUNDLE_INSTALL`, `YAMAKAN_PROCD`, `YAMAKAN_ACL` | `core/process/workers.ts`, `server/main.ts`, `core/process/owner.ts`, `core/process/access.ts` | unset | tool and helper overrides |
| `YAMAKAN_WORKSPACE`, `_RECOVERY`, `_PORT`, `_URL` | `server/main.ts`, `cli/main.ts`, `mcp/main.ts` | defaults | locations; URL must be `127.0.0.1` |
| `YAMAKAN_QUALIFY_RECEIPT` | `scripts/qualify-*.mjs` | unset | receipt destination, never the repository |
| `?shell=classic` | `src/workspaces/ProjectShell.tsx` `classicShell` | off | pre-workspace shell |
| `DARZAIN_*` | every `env()` helper | — | legacy aliases of the `YAMAKAN_*` names |

## 5. Historical blockers that are no longer current

| Earlier statement | Now | Evidence at head |
|---|---|---|
| No real generation (#85, #86) | Kaggle text-to-video and first-frame image-to-video | `KAGGLE_RECIPES`; three page-run receipts in `docs/evidence/ultimate/` |
| No zero-cost GPU; 24 GB local VRAM needed (#85) | Kaggle is the founder-authorised GPU; no weights on the PC | `docs/FOUNDER_DECISION_RECORD.md` entry 2026-11-05 |
| Diffusers-versus-ComfyUI choice first (#85, #86) | ComfyUI adapter exists (off); Kaggle recipes work | `core/engines/comfyui.ts`; `core/engines/kaggle.ts` |
| Creative state outside backup (#86 AUD-01..03) | immutable, revision-pinned documents in backups | `core/documents.ts`; `tests/creative-recovery.test.ts`; `docs/evidence/ultimate/receipts/AG-DOCS.json` |
| MCP unbounded, acting as the local client (#86 AUD-05) | bounded framing; agent token required | `mcp/framing.ts`; `mcp/main.ts` exits 2 without a token |
| One shared `local-client` for agents (`docs/RELEASE_PROPOSAL.md`) | scoped, expiring agent tokens | `ProjectStore.createAgentToken`, `principalForAgentToken` |
| Blender discovery-only (#86) | contained worker: render, models, track, match-move, aerial | `core/blender/`; `core/jobs.ts` |
| Cinema is cube proxies; Director is a smoke UI (#86 AUD-11) | `cinemaScene`, `.glb` models, Blender from the page; story shot to timeline with approval | `src/cinema/BlenderRender.tsx`; `core/director/cinema-pipeline.ts` |
| No browser consent control (`docs/evidence/ultimate/product-matrix.md`) | grant, revoke, revalidate, save packs | `src/main.tsx` (PR #237) |
| Image-to-video: No (same file) | offered, metadata stripped, send consent | `core/engines/clean-image.ts`; `assertMaySend` |
| Fixed 30 fps (#86 AUD-07) | 24000/1001 too | `tests/rational-fps.test.ts` |
| Host FFmpeg; DirectWrite build (R8) | vendored, pinned 7.1.5 with fontconfig | `vendor/ffmpeg-win64-r8/` |
| No bundle, installer, update, rollback | unsigned lifecycle | `scripts/bundle.ts`; `tests/unsigned-rc.test.ts` |
| No retry or discard for `reconciliationRequired` | commands exist | `yamakan.job.retry`, `job.discard` |
| Fresh checkout cannot run tests (#86) | preflight and setup capture | `docs/evidence/ultimate/SS-017-setup.md` |

Still true and not historical: the three `false` flags; release NO-GO; H1–H5, signing and Q15
open; every comparative benchmark NOT TESTED; M export unqualified; providers off; spending zero.

## 6. Implemented features still described as plans or absent in top-level documents

Input for MPR-002. None of these files is hashed in `docs/PLAN_FREEZE_MANIFEST.md`. Quotes are at
most 14 words. MPR-002 marks the first eight files, down to the P10 gate matrix, and writes an
index. `specs/CURRENT.md` belongs to MPR-001 and the `NOTICE` row to MPR-209. No card names the
`docs/OPERATIONAL_CONTRACTS.md` sentence or the comment above `generationOf`.

| Document | Stale statement | Code fact at head |
|---|---|---|
| `README.md` | "Phase: implementation (P01)." | 116 commands, schema 18, four workspaces, Kaggle route, Blender worker |
| `README.md` | "No paid inference, cloud account or model weights are used." | the person's Kaggle account is used when configured; weights load on Kaggle |
| `README.md` | "the master plan is the sole task authority" | live truth is code plus ledger 12 (section 8) |
| `docs/MODEL_CAPABILITIES.md` | "Adapter interface: describe → validate → quote → submit → poll/cancel/reconcile → collectOutputs." | `EngineAdapterV2` has no describe, validate or quote; live Kaggle recipes unmentioned |
| `docs/MODEL_CAPABILITIES.md` | "Operations: textToImage, imageToImage, inpaint, outpaint, textToVideo, imageToVideo …" | `Operation` has 5 values, 2 with an adapter |
| `docs/PROVIDER_MATRIX.md` | "No inference requests were made." | real Kaggle runs with receipts; no Kaggle row |
| `docs/COST_ROUTER.md` | "The offline MVP has no network-eligible route." | `generationOf` selects a network route the router never sees |
| `docs/LOCAL_INFERENCE.md` | "First AI qualification should use one existing supported user-owned ComfyUI backend" | first AI qualification ran on Kaggle |
| `docs/LOCAL_INFERENCE.md` | "Node 24.19.0/FFmpeg 8.1.1 support the existing offline slice" | vendored FFmpeg 7.1.5; Blender 5.3.0 on CPU |
| `docs/AGENT_MCP_ARCHITECTURE.md` | "granular scopes/full MCP are proposed work." | scopes, scoped agent tokens, MCP with replay exist (its Python SDK, quote and pause tools and five extra error codes do not) |
| `docs/COMPETITOR_MATRIX.md` | "native/applied generation U; Cinema P" | Cinema and Blender render IN CODE |
| `docs/COMPETITOR_MATRIX.md` | "Legacy REST/CLI I; complete MCP/registry/revision proposal contract P" | registry, MCP, take proposals IN CODE |
| `docs/COMPETITOR_MATRIX.md` | "Catalog/documented operations only; actual adapters U" | Kaggle adapter QUALIFIED |
| `docs/plans/P10-qualification-activation/RELEASE_GATE_MATRIX.md` | E-SEC: "Keep engines off"; F: "No activation in P10" | real runs via Kaggle under founder entries of 2026-11-05/06, outside these rows |
| `specs/CURRENT.md` | "Models and providers disabled" | same Kaggle fact; top section dated 2026-11-04 |
| `docs/OPERATIONAL_CONTRACTS.md` | "nothing routes v2 requests from the command surface yet." | `generation.start` routes to Kaggle |
| `NOTICE` | "About view will carry the AGPL source-offer link when Director UI lands." | Director UI exists; no source offer in `src/` (MPR-209) |
| comment above `generationOf` | "only when this build has a qualified recipe and a person named a ComfyUI" | the Kaggle branch needs neither |

The banners must say which way each file is wrong: `docs/AGENT_MCP_ARCHITECTURE.md`,
`docs/COST_ROUTER.md` and `docs/MODEL_CAPABILITIES.md` also describe protocols a reader could take
as shipped.

## 7. Guarantees that hold today by absence of code

Input for MPR-204 and MPR-208. Each is true at head; none is enforced by a gate a future change
must pass.

| Guarantee | Why it holds | Missing | What would silently break it |
|---|---|---|---|
| Zero spending | no paid adapter or key handling; `ROUTER_PROVIDERS_ENABLED = false`, asserted by `scripts/ultimate-baseline.mjs` and `scripts/qualify-quality-lab.mjs` (not in CI) | quote, reservation, budget, spend ledger, Kaggle quota accounting | a new adapter branch in `generationOf` |
| Nothing leaves without a person | loopback bind; workers without network; only egress is the Kaggle CLI, started by the human-only `generation.start` after a per-run tick (`src/create/GeneratePanel.tsx`) and `assertMaySend` | egress policy, destination allow-list, approval record; `scripts/import-guard.mjs` restricts spawning but has no rule for `fetch` or `node:http(s)` | a `fetch` to a remote host in `core/` passes `provenance:check`; the CLI inherits proxy and CA variables |
| No unapproved download | no downloader; `core/engines/reasons.ts` "Yamakan never downloads them"; `scripts/blender-install.ts` uses a zip the person fetched | download-approval object; `PINNED_MODEL_MANIFESTS` empty | any worker that fetches weights; the Kaggle scripts already download weights and unhashed packages remotely |
| Only permissive licences offered | the three recipes say `Apache-2.0` | `ACCEPTED_MODEL_LICENSES` applied to `KAGGLE_RECIPES`; structured licence fields | a recipe with any `licence` string and `offered: true` |
| Secrets safe | Yamakan never reads the Kaggle token; workspace tokens owner-only (`writeSecret`); agent tokens hashed | OS credential store (DPAPI), credential reference type | a first provider key; `docs/SECURITY.md`: "keys later use a qualified secret service" |

## 8. Planning lineage and identifier schemes

| Plan | Identifiers | Where | Status at head |
|---|---|---|---|
| First master plan (PRs #3–#5) | P00–P09, T1–T10, B1–B6, A–J | `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md` | T1–T10 merged; still says "Implementation of the frozen plan has not started." (hashed, so not edited) |
| Frozen reuse-first plan (PR #30; tag `plan-freeze-2026-10-18` → `651733a`) | W1–W18, M1–M17, Q1–Q15, R1–R8, M-gate, H1–H5, E-SEC/F/G | `docs/research/rea-source-reuse/`, `docs/PLAN_FREEZE_MANIFEST.md` | W1–W18 merged; Q15 open; hashed decision records changed since, so hashes verify only at the tag |
| P10 (PR #58) | P10-00..P10-10 | `docs/plans/P10-qualification-activation/` | merged; gate matrix still the gate table |
| Draft PR #85 | REA-01..06; R0, R1, E0–E4, B1, B2, P; P0–P3 | branch `research/competitive-video-rea-2026-10-22` | open draft; premise overtaken |
| Draft PR #86 | YU-000…YU-101, AG-DOCS, AUD-01..12, R01–R18, D01–D08 | branch `research/ultimate-master-plan-2026-10-23`; state on main in `docs/evidence/ultimate/EXECUTION_LEDGER.md` | executed unmerged; the PR text still says nothing is authorised |
| System Supremacy (PR #155) | SS-001..SS-019, R-01..R-05, X-01..X-03 | `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json`, `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/LEGACY_RECONCILIATION.json` | 11 VERIFIED, 2 AGGREGATE, 8 QUALIFICATION_READY, 7 WAITING, 3 EXTERNAL_BLOCKED; lags ledger 12 |
| Founder-directed streams since 2026-11-05 | none | ledger 12; decision records | ComfyUI (#188–#198), Kaggle and Create (#200–#236), consent (#181, #237), security check (#225–#255 batches), Cinema (#243–#248, issue #203), Blender (#256–#278), prompt library (#261, #262) |

Live truth: the code, then
`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md` ("ledger 12"),
then `docs/FOUNDER_DECISION_RECORD.md` and `docs/AGENT_DECISION_RECORD.md` (entries since
2026-11-07 are Claude's choices under delegated authority, not founder decisions).
`specs/CURRENT.md` and the SS task registry lag.

Overloaded names: `R` (residuals, research prerequisites, #86 risks, #85 steps); `P` (phases,
#85 paths, priorities, P10); `E0–E4` (both drafts); `Q` (Q1–Q15 and `qualify:q*`); "lineage"
(`GenerationLineage` versus `yamakan.lineage.evaluate`); "qualification" (at least seven
meanings). This revision therefore uses the fresh prefix `MPR-` and `FD-n`
([FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md)), references `SS-`, `R-`, `X-`
cards without editing them, and registers the unnamed streams in MPR-003.

## 9. Collision zones

`git log --oneline d1936f7..HEAD -- <path>` (the Blender stream, 2026-11-11, 00:06 to 21:15
+0300):

| Path | Commits |
|---|---|
| ledger 12 | 50 |
| `docs/OPERATIONAL_CONTRACTS.md` | 28 |
| `tests/blender-render.test.ts` | 22 |
| `core/blender/`, `scripts/blender/` | 14 each |
| `core/command/registry.ts` | 13 |
| `src/main.tsx` | 11 |
| `src/cinema/`, `core/jobs.ts` | 10 each |
| `core/director/`, `core/cinema/` | 9 each |
| `core/prompts/` | 6 |
| `src/create/`, `src/director/`, `docs/provenance/import-policy.json` | 5 each |
| `core/takes.ts`, `core/story.ts`, `core/engines/`, `mcp/`, `cli/` | 0 |

The owner's stated next steps (ledger 12 "Not yet"): a Cinema page control for the aerial view and
match-move, placement against tracked points and footage-matched light. Object animation landed
in PR #278 as one end pose per item; its "Not yet" list is a Cinema page control for motion,
motion along a path, and the Director planning item motion from words.

Consequences: Track 1 and agent-surface cards sit in quiet files (MPR-101, MPR-105, MPR-106 in
`core/story.ts` and `core/takes.ts`; MPR-201, MPR-205 in `core/engines/`; MPR-501..503 in `mcp/`,
`sdk/`, `cli/`). Nearly every card touches `core/command/registry.ts`, so registry changes must be
small and rebased just before review. MPR-102 and MPR-104 change `src/create/` and `src/main.tsx`
and should follow the Blender pull requests (FD-11); MPR-403 waits for that stream. Planning PRs
must not write to ledger 12, `docs/OPERATIONAL_CONTRACTS.md`, `docs/provenance/*`,
`specs/CURRENT.md`, the decision records or the SS task registry (MPR-001 follows FD-1). The
workspace schema went from 15 (PR #133) to 18 (PR #271); no card should hard-code it.

## 10. Ledger-12 open findings re-verified at head

"By reading" means code read at head; nothing was run.

| Finding (paraphrased) | Status at head | Evidence |
|---|---|---|
| The browser cannot record a consent, save a pack or revoke | closed by later work | `src/main.tsx` calls `consent.grant`, `consent.revoke`, `consent.revalidate`, `pack.save` (PR #237, 2026-11-09). Removing media stays absent: no such command |
| After a restore, no browser control to revalidate | control closed; the rule stands for the founder to overrule | `consent.revalidate` from `src/main.tsx` |
| A take with reference pins and no continuity references could return through undo after revocation ("by reading, not run") | still open, unreproduced | the gate (#181) matches bytes linked by a pack; `docs/evidence/ultimate/consent-gate.md` lists "A take that only pins a pack" as open; no test names the case. MPR-010 |
| SDK `call` drops the request id on success | still open | `sdk/client.ts` returns `value.result` |
| MCP unknown tool answers `-32602`, outside the 14 codes | still open | `mcp/main.ts` |
| `proxy.build`, `proxy.cancel` are `mutation: false` | still open | registry definitions |
| Handoff derived not stored; browser uses neither progress view nor handoff (SS-007) | still open | no `src/` caller |
| `cinema-blender` approval not enforced at placing | still open by reading | `core/takes.ts`, `yamakan.take.apply` |
| A render running at page reload is not followed again | still open by reading | module-level `Map` in `src/cinema/BlenderRender.tsx` |
| Match-move frame-rate and shape refusals untested | not verified | `tests/blender-render.test.ts` not re-read |
| No test of the service's Cinema model routes | closed by a qualify script only | `qualify:cinema-model` (receipt not committed) |
| A Kaggle CLI that never returns blocks the model until restart | closed by later work, with a stand-in | commit `8486f56`; `tests/kaggle-cli-stop.test.ts`; the real CLI on Windows: not verified |
| Stale-tab stop during import; a new start replacing an uncollected result; picture preparation outside the send window | not verified | |
| `qualify:create`, `qualify:kaggle`, `qualify:kaggle-screens` not in CI; Windows CI lacks journey, shared-access and native tests | still open | `.github/workflows/qualify.yml` |
| Any same-account process can become the browser user (Medium; Q15) | still open | `docs/SECURITY.md`; FD-9, MPR-508 |
| Proof key is the stored token hash; one shared AppContainer profile (Lows) | still open by reading | `sdk/service-proof.ts`; `native/procd/src/container.rs` |
| Personal account id in committed Kaggle metadata | still open | `scripts/kaggle/*/kernel-metadata.json` (two files); FD-10 |
| Unhashed Kaggle Python packages; no export size cap; keys never rotate; bundle SBOM incomplete (Lows) | not verified | |
| Media worker near 3 GiB against a 2 GiB limit | not verified | |
| M export 1 of 6 within 480 s | still open | SS-005b QUALIFICATION_READY; no receipt after `docs/evidence/ultimate/SS-005a-m-profile.md` |
| Flaky timing tests on battery or load | not verified | quote results only on AC power |

## 11. What this means for the plan

1. Extend the authorities; add none. Every target fits `ProjectStore`, the registry,
   `JobSupervisor` and creative documents. The MPR-101 record is a new immutable document kind
   through `core/documents.ts`, named from the take by its hash; the card rejects keeping it
   inside the story document, on size.
2. Track 1 is the shortest path and its files are quiet: MPR-101, MPR-102, MPR-103, MPR-105,
   MPR-106, MPR-107 close 3.2 and 3.3 on top of the QUALIFIED take path (SS-006) and Kaggle route.
3. Wire before building: ripple, insert, group move, speed, loudness, sound unlink, batch and OTIO
   export and take compare get controls (MPR-601..603, SS-011, MPR-104). Match-move stays a
   command; no card adds a control.
4. Make absent gates explicit before any new route: MPR-204, MPR-208, MPR-205 (FD-10), and
   MPR-201 and MPR-202. MPR-201 puts one catalog over the model lists and checks them against it;
   it replaces none. MPR-202 adds one report built from the catalog; both existing commands keep
   their fields.
5. Truth first: MPR-002 (section 6 and the closed rows of section 10), MPR-003 (unregistered
   streams), MPR-010 (consent-undo reproduction).
6. Agent honesty: MPR-501, MPR-502, MPR-503; MPR-508 stays on FD-9.
7. Evidence: commit receipts for anything later called QUALIFIED, and full Windows CI (MPR-804,
   FD-8), before Stage 5 claims
   ([10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md)).
8. Ordering: in-flight Blender work first (FD-11); MPR-403 after it; keep registry changes small.
9. `RESOURCE_POLICY` v3, `QUALIFICATION_POLICY` v1, release NO-GO and NOT TESTED comparative
   status are unchanged
   ([11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md)).
