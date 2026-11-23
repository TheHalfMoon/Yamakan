# Current state index

This page says what the code does today and where to check it. It adds no authority: on any conflict the ledger, the founder record, `specs/CURRENT.md` and the operational contracts win.

## Verified against

Main commit `16d2175`, 2026-11-23, on the founder's Windows PC. Rows on consent and the pinned take were updated by MPR-010 at `45b142d` and, with the status row of `specs/CURRENT.md`, by the status update after it. Every row was checked by reading the named file or running the named grep; nothing here was run in a browser, with a model, or with Blender. A row that could not be confirmed says "not verified".

## Where authority lives

- `specs/CURRENT.md`: the current frontier, in one place.
- `docs/FOUNDER_DECISION_RECORD.md`: what the founder decided, in the founder's words.
- `docs/AGENT_DECISION_RECORD.md`: choices made by the builder under a delegation.
- `docs/OPERATIONAL_CONTRACTS.md`: the protocols code must keep.
- `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json` and `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md`: the earlier programme's tasks and its running ledger.
- `docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/TASK_REGISTRY_ADDENDUM.json`: the adopted plan's cards and their states.
- `AGENTS.md`: engineering instructions.

## What the code does today

| Area | What exists | Where to verify | Evidence | Limits |
| --- | --- | --- | --- | --- |
| Generation contract | five operations: textToVideo, imageToVideo, videoEdit, transcribe, enhance | `core/engines/contract-v2.ts`, `Operation` | reading | the Kaggle route runs textToVideo and imageToVideo through this contract; `ENGINE_ENABLED` gates ComfyUI and local manifests only; the other three operations are enabled nowhere found by reading |
| Engine switch | local engines off | `core/engines/contract.ts`, `ENGINE_ENABLED` is `false` | reading | it does not gate the Kaggle route; a qualified model is a separate founder decision |
| Model pins | none | `core/engines/manifests.ts`, `PINNED_MODEL_MANIFESTS` is empty | reading | no weights pinned |
| ComfyUI adapter | an adapter with an empty recipe list | `core/engines/comfyui.ts`, `PINNED_COMFY_RECIPES` is empty, `comfyGeneration` | `docs/evidence/ultimate/comfyui-engine.md`, `npm run qualify:comfyui` | no recipe is pinned, so it generates nothing |
| Kaggle route | generation on the person's own Kaggle account, founder-directed | `core/engines/kaggle.ts`, `KAGGLE_RECIPES` | `docs/evidence/ultimate/kaggle-page-run-receipt.json`, `npm run qualify:kaggle` | offered only when `server/main.ts` has both `YAMAKAN_KAGGLE_CLI` and `YAMAKAN_KAGGLE_USERNAME`; three recipes, one image-to-video; sends the prompt, seed and, for that one, a picture that stays in the notebook's history; Yamakan cannot stop a sent run; not release-qualified |
| Router | no network route is eligible | `core/router/explain.ts`, `ROUTER_PROVIDERS_ENABLED` is `false`, `explainRoutes` | reading | the Kaggle route does not pass through it |
| Create workspace | a page to write a brief and ask for a generation | `src/create/CreateWorkspace.tsx`, `src/create/create-model.ts` `CREATE_MODELS` | `docs/evidence/ultimate/create-workspace.md`, `npm run qualify:create` | not in CI |
| People and consent | consent grant, revoke and a panel | `src/main.tsx` `yamakan.consent.grant` and `yamakan.consent.revoke`; `src/create/PeoplePanel.tsx` | `docs/evidence/ultimate/consent-gate.md`, `npm run qualify:consent-gate` | the commit point refuses a new use of a take pinned to, or made from, a revoked person's references (MPR-010, `docs/evidence/ultimate/consent-undo-pinned-take.md`); its browser run is BLOCKED |
| Cinema | 3D scene page (`CINEMA_ENABLED` is true), lens preview, saved scenes, 3D models | `core/scene3d-flags.ts`, `src/cinema/CinemaViewport.tsx`, `core/cinema/glb.ts` `checkGlb`, `yamakan.cinema.compileControls` in `core/command/registry.ts` | `npm run qualify:cinema-model` | the page's view and surface choices are in open PR 279, and an object-motion control is not built |
| Blender | a sandboxed worker, off unless the pinned build is installed by a person | `core/blender/worker.ts` `blenderWorkers`, `yamakan.blender.render` and `yamakan.blender.track` (tracking; match-move over a plate) in `core/command/registry.ts`, `npm run blender:install` | `npm run qualify:blender-slice` | one render at a time; real runs are BLOCKED on the founder host since 2026-11-12 (ledger 12) |
| Director | records pipelines and their approvals; a Cinema shot planner; a pipeline that renders a story shot with Blender, waits for a person's approval and places the take | `core/director/manifest.ts` `registerBuiltinManifest`, `core/director/cinema-shot.ts` `planCinemaShot`, `core/director/cinema-pipeline.ts`, `core/director-flags.ts` `DIRECTOR_ENABLED` | `npm run qualify:director-cinema` | it runs no language model and no agent |
| Prompt library | a local library and presets | `core/prompts/library.ts`, `yamakan.prompt.search` in `core/command/registry.ts` | `npm run qualify:prompt-library` | Yamakan-written templates; YouMind's category list only |
| Agent access and MCP | MCP server, scoped agent tokens, TypeScript SDK | `mcp/main.ts`, `sdk/client.ts`, `yamakan.agent.create` in `core/command/registry.ts` | `npm run qualify:agent-access` | no Python SDK in the repository |
| Release state | public release NO-GO | `specs/CURRENT.md` | `docs/FOUNDER_DECISION_RECORD.md` | unqualified: native Arabic review (X-01), the Windows signing, second-account and Profile A steps, disk-full, JASSUB and CSP, operating-system presence, founder ship authorisation, M export; nothing here is release-qualified |

## Documents and their status

- `README.md`: CURRENT, corrected with this index.
- `AGENTS.md`: NOT REVIEWED, not edited here.
- `specs/CURRENT.md`: OWNED ELSEWHERE (MPR-001); its sentences on the drafts and the package's status line were corrected after MPR-003.
- [P10 release gate matrix](plans/P10-qualification-activation/RELEASE_GATE_MATRIX.md): BANNER ADDED.

| Document | Status | Reason |
| --- | --- | --- |
| [docs/CURRENT_STATE_INDEX.md](CURRENT_STATE_INDEX.md) | CURRENT | this page |
| [docs/AGENT_DECISION_RECORD.md](AGENT_DECISION_RECORD.md) | CURRENT | hashed in the freeze manifest, but a live append-only record |
| [docs/AGENT_MCP_ARCHITECTURE.md](AGENT_MCP_ARCHITECTURE.md) | BANNER ADDED | a dated line under the title says what is out of date |
| [docs/AGENT_PLATFORM.md](AGENT_PLATFORM.md) | NOT REVIEWED | not read for this index |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | NOT REVIEWED | not read for this index |
| [docs/ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md) | NOT REVIEWED | not read for this index |
| [docs/ARCHITECTURE_OPTIONS.md](ARCHITECTURE_OPTIONS.md) | NOT REVIEWED | not read for this index |
| [docs/CLAUDE_REVIEW_HANDOFF.md](CLAUDE_REVIEW_HANDOFF.md) | NOT REVIEWED | not read for this index |
| [docs/COMPETITOR_MATRIX.md](COMPETITOR_MATRIX.md) | BANNER ADDED | a dated line under the title says what is out of date |
| [docs/COMPETITOR_RESEARCH.md](COMPETITOR_RESEARCH.md) | NOT REVIEWED | not read for this index |
| [docs/COST_ROUTER.md](COST_ROUTER.md) | BANNER ADDED | a dated line under the title says what is out of date |
| [docs/CREATIVE_WORKFLOWS.md](CREATIVE_WORKFLOWS.md) | NOT REVIEWED | not read for this index |
| [docs/E2E_ACCEPTANCE.md](E2E_ACCEPTANCE.md) | NOT REVIEWED | not read for this index |
| [docs/ENGINEERING_TOOLING.md](ENGINEERING_TOOLING.md) | NOT REVIEWED | not read for this index |
| [docs/FEATURE_MATRIX.md](FEATURE_MATRIX.md) | NOT REVIEWED | not read for this index |
| [docs/FOUNDER_DECISION_PACKET.md](FOUNDER_DECISION_PACKET.md) | NOT REVIEWED | not read for this index |
| [docs/FOUNDER_DECISION_RECORD.md](FOUNDER_DECISION_RECORD.md) | CURRENT | hashed in the freeze manifest, but a live append-only record |
| [docs/FUTURE_CLAUDE_EXECUTION_PROMPT.md](FUTURE_CLAUDE_EXECUTION_PROMPT.md) | FROZEN - NOT EDITED | hashed in the freeze manifest |
| [docs/IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | FROZEN - NOT EDITED | hashed in the freeze manifest |
| [docs/LOCAL_INFERENCE.md](LOCAL_INFERENCE.md) | BANNER ADDED | a dated line under the title says what is out of date |
| [docs/MANAGED_COMFYUI_MODE.md](MANAGED_COMFYUI_MODE.md) | NOT REVIEWED | not read for this index |
| [docs/MODEL_CAPABILITIES.md](MODEL_CAPABILITIES.md) | BANNER ADDED | a dated line under the title says what is out of date |
| [docs/MODEL_INTEGRATIONS.md](MODEL_INTEGRATIONS.md) | NOT REVIEWED | not read for this index |
| [docs/OPERATIONAL_CONTRACTS.md](OPERATIONAL_CONTRACTS.md) | NOT REVIEWED | not read for this index |
| [docs/PERFORMANCE.md](PERFORMANCE.md) | NOT REVIEWED | not read for this index |
| [docs/PLAN_FREEZE_MANIFEST.md](PLAN_FREEZE_MANIFEST.md) | FROZEN - NOT EDITED | the freeze manifest itself; it carries the hashes of 23 files |
| [docs/PRODUCT.md](PRODUCT.md) | NOT REVIEWED | not read for this index |
| [docs/PRODUCT_VISION.md](PRODUCT_VISION.md) | NOT REVIEWED | not read for this index |
| [docs/PROJECT_DATA_MODEL.md](PROJECT_DATA_MODEL.md) | NOT REVIEWED | not read for this index |
| [docs/PROVIDER_MATRIX.md](PROVIDER_MATRIX.md) | BANNER ADDED | a dated line under the title says what is out of date |
| [docs/REA_FINDINGS.md](REA_FINDINGS.md) | NOT REVIEWED | not read for this index |
| [docs/REA_TARGET_MATRIX.md](REA_TARGET_MATRIX.md) | NOT REVIEWED | not read for this index |
| [docs/RELEASE.md](RELEASE.md) | NOT REVIEWED | not read for this index |
| [docs/RELEASE_PROPOSAL.md](RELEASE_PROPOSAL.md) | NOT REVIEWED | not read for this index |
| [docs/RESEARCH_REPORT.md](RESEARCH_REPORT.md) | NOT REVIEWED | not read for this index |
| [docs/ROADMAP.md](ROADMAP.md) | NOT REVIEWED | not read for this index |
| [docs/SECURITY.md](SECURITY.md) | NOT REVIEWED | not read for this index |
| [docs/SOURCE_CATALOG.md](SOURCE_CATALOG.md) | NOT REVIEWED | not read for this index |
| [docs/SOURCE_IMPORT_MATRIX.md](SOURCE_IMPORT_MATRIX.md) | NOT REVIEWED | not read for this index |
| [docs/SOURCE_REUSE_LEDGER.md](SOURCE_REUSE_LEDGER.md) | NOT REVIEWED | not read for this index |
| [docs/START_HERE_WHEN_READY.md](START_HERE_WHEN_READY.md) | FROZEN - NOT EDITED | hashed in the freeze manifest |
| [docs/TESTING.md](TESTING.md) | NOT REVIEWED | not read for this index |
| [docs/TEST_STRATEGY.md](TEST_STRATEGY.md) | NOT REVIEWED | not read for this index |

## Ledger 12 open findings, re-verified

Checked by reading only. CLOSED needs a path a reviewer can open; no row is CLOSED.

| Checkpoint | Finding | Status | Evidence |
| --- | --- | --- | --- |
| Opus implementation continuation, 2026-11-04 | Windows launch error 2 without the profile lock | NOT RE-VERIFIED | needs a timed stress run; the recorded comparison is in `docs/evidence/ultimate/SS-017-worker-profile.md` |
| same | `qualify:ultimate-environment` did not reach RECORDED | CHANGED | later ledger checkpoints record a RECORDED capture at `ee910bc` (`docs/evidence/ultimate/SS-017-setup.md`) and at `ae55852` (PR #193); not re-run here |
| same | `cancellation terminates the worker's job` failed once | CHANGED | a later checkpoint ('SS-007 slices landed, cancellation test explained') explains a cancellation test (PR #173); the test's behaviour was not re-run |
| same | M export unqualified, 1 of 6 attempts | OPEN | `specs/CURRENT.md` still says M export unqualified |
| same | Windows CI does not run the journey, shared-access or native unit tests | OPEN | `.github/workflows/qualify.yml` runs one Windows job (`qualify-windows-r8`); MPR-804 waits on FD-8 |
| same | Timing results need AC power and a quiet machine | OPEN | a standing condition, not a defect that can be closed |
| SS-012, SS-013 and undo, 2026-11-05 | Toolbar Undo can strand unsaved canvas or caption work | CHANGED | PR #180 (merged) makes it wait; `npm run qualify:undo-unsaved` and the receipt in `docs/evidence/ultimate/SS-013-captions.md` (read) describe real-Edge runs; CI does not run them, so not CLOSED |
| same | Undo ends at a story, pack, migration, import or whole-project save | NOT RE-VERIFIED | the undo boundary rules in `src/main.tsx` and the store were not traced; a run is needed |
| same | A take could return through undo after consent was revoked | CHANGED | PR #179 pinned the opposite with a test in `tests/story-packs.test.ts`, which MPR-010 inverted on the founder's word of 2026-11-23, with `tests/consent-undo-pinned-take.test.ts` (its browser run is BLOCKED) |
| same | Timed render tests fail on a loaded machine on battery | OPEN | a standing condition |
| Undo, consent gate, keyboard editing, 2026-11-05 | `process owners sharing an input` failed once | NOT RE-VERIFIED | the cause was never established |
| same | Timeline jumps by about 690 px when the preview finishes | NOT RE-VERIFIED | needs a browser |
| same | The browser cannot record a consent, save a pack, revoke, or remove media | CHANGED | consent grant and revoke are called in `src/main.tsx` (`yamakan.consent.grant`, `yamakan.consent.revoke`) and shown in `src/create/PeoplePanel.tsx`; saving a pack is called from the People panel (`src/main.tsx`, `yamakan.pack.save`); no asset-remove command was found in the registry, so removing media stays OPEN |
| same | Timed render tests fail on a loaded machine on battery | OPEN | a standing condition |
| Local AI, ComfyUI, restore, 2026-11-05 | `no descendant outlives an exiting worker` failed under load, and `killing the process owner mid-render` failed again | NOT RE-VERIFIED | a timing test; later failures are recorded in the generation checkpoint |
| same | A suite on battery had 15 failures, all time limits | OPEN | a standing condition |
| same | ComfyUI's CreateVideo writes 2997/125 for 24000/1001 | NOT RE-VERIFIED | needs a ComfyUI run; a generated clip's timing needs conforming |
| same | EBUSY in `process owners sharing an input` has retries only | NOT RE-VERIFIED | the cause was never established |
| The generation path, 2026-11-05 | A suite at `af0fa16` had 19 failures | NOT RE-VERIFIED | recorded as unexplained |
| same | `burned-in captions draw the same` hit its time limit twice | NOT RE-VERIFIED | a timing test |
| same | `3196b43`'s main run was cancelled | NOT RE-VERIFIED | its log was not read then or here |
| same | A chained command pushed past a failed brand check once | NOT RE-VERIFIED | a practice note, not a code fact |
| Real AI video, 2026-11-06 | Exports sat darker than their sources | CHANGED | PR #208 (merged) reduces it; the ledger and `docs/evidence/ultimate/export-color.md` say under 1 of 255 remains on one clip; not re-measured |
| same | One of five 81-frame runs was killed while decoding | NOT RE-VERIFIED | needs GPU runs |
| same | Wan at 41 frames snapped to another picture | NOT RE-VERIFIED | needs GPU runs |
| same | Kaggle's public interface cannot stop a run | OPEN | `core/engines/kaggle.ts` `requestCancel` answers that the remote is not acknowledged; the run itself is not stopped |
| same | `qualify:create` and `qualify:kaggle` are not in CI | OPEN | `.github/workflows/qualify.yml` has no such step |
| same | `apt-get` hanging cancels CI runs | NOT RE-VERIFIED | an outside-service fault |
| same | Native Arabic review, X-01, open for the new text | OPEN | X-01 is an external gate in the System Supremacy registry |
| Generation hardening | Three Lows from PR #209's last review | NOT RE-VERIFIED | stale-tab cases that need two browser tabs; not traced by reading |
| same | A new start can replace an uncollected result in three cases | NOT RE-VERIFIED | `core/engines/generation.ts` asks first before a new run; the three cases were not traced |
| same | Preparing a picture can exceed the send's allowance | OPEN | `core/engines/kaggle.ts` `SEND_BOUND_MS` counts two questions and the push, and its own comment says preparing the image 'can take minutes'; the ledger said to fix this before image-to-video was offered, and the first-frame recipe is `offered: true` |
| same | An empty notebook told from a missing one by one status question | OPEN | `core/engines/kaggle.ts` (`EMPTY_NOTEBOOK`) still tells them by the refusal text and the account's list |
| same | A Kaggle CLI that never returns blocks that model until restart | CHANGED | `core/engines/kaggle.ts` `endTree` in `kaggleCli` ends the whole process tree on the time limit (commit 8486f56); `tests/kaggle-cli-stop.test.ts` exists and was not run here |
| same | The failure and stop screens ran only with a stand-in CLI | OPEN | `npm run qualify:kaggle-screens` exists and is not in `.github/workflows/qualify.yml` |
| same | `create.runFailed` and `create.runCancelled` changed in Arabic | OPEN | X-01 is an external gate |
| Registry | The System Supremacy registry lags the ledger | OPEN | its last change is dated 2026-11-04; the ledger has later checkpoints (MPR-003 settles the current ones in its own registry, not this one) |

## How this index is kept

A pull request that changes a fact in the table updates its row in the same pull request. The ledger is appended only by the implementation lead in reviewed updates, as `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/OPUS_IMPLEMENTATION_HANDOFF.md` sets out. On any conflict the ledger, the founder record, `specs/CURRENT.md` and the operational contracts win over this index.
