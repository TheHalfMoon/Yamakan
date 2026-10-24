# Current codebase audit

Audit date: 2026-10-23 (Asia/Riyadh). Source baseline: `a3c3ce91815aee35ce5b91b4a483dd85766a4429`. This is a source inspection and planning review, independent of the prior implementation authors. It is not a release security certification. Public release remains **NO-GO**; providers, real engines and JASSUB remain disabled.

## Finding that should drive the plan

Yamakan has a substantial offline editing foundation: transactional snapshots, checked timeline operations, streamed media storage, fenced media jobs, owned Windows workers and a shared reference/export renderer. Preserve these investments. The principal expansion risk is integration: enabled creative modules do not yet share the editing foundation's persistence, revision, recovery and execution guarantees. Studio drawing is session-local; Cinema and Director keep mutable JSON sidecars; Quality Lab summarizes supplied records; Router returns rejections; the engine is a fake. Enablement flags and prior harness passes must not be converted into claims of a complete creative production platform.

The shortest credible next step is to join the creative documents and workflow receipts to the existing authority, then qualify one complete offline creative journey. Adding an inference backend before this work would multiply the places where assets, approvals and outcomes can become inconsistent.

## Scope and evidence discipline

Read `AGENTS.md`, `specs/CURRENT.md`, `docs/IMPLEMENTATION_PLAN.md`, the operational contracts, activation matrix, release proposal, workflow configuration, package manifest, selected qualification receipts, and the runtime entrypoints and critical paths below. Inventoried all files under `core/`, `server/`, `native/`, `src/`, `cli/`, `mcp/`, `sdk/` and tests; machine-readable path/hash inventory and explicitly sampled source paths are in `evidence/codebase-review.json`.

**Coverage limit:** the initial source-root inventory contains 500 files. Inventory is not line-by-line inspection. Large modules such as `core/store.ts`, `core/jobs.ts`, `core/render.ts`, the inherited preview/timeline components and the Rust supervisor were inspected through signatures, targeted implementations and callsites. The full inherited canvas renderer, every donor utility and every test body were not independently read. No exhaustive vulnerability claim or whole-codebase runtime pass is made. Remaining review must target these uninspected areas before enabling new behavior.

Evidence labels used here:

- **SOURCE INSPECTED:** actual implementation or callsite read at the baseline.
- **HISTORICAL EXECUTION RECORD:** committed receipt or report from its own recorded head; this review did not rerun that workload.
- **CURRENT EXECUTION:** a command actually run during this review.
- **ENGINEERING INFERENCE:** consequence inferred from source, requiring the named regression/negative fixture.

Current environment: Node `v24.19.0`; no repository `node_modules`; no built `native/procd/target/release/yamakan-procd.exe`. The vendor FFmpeg path exists, but its executable bytes were not independently authenticated or launched here. No dependencies installed, model calls made, weights downloaded, services released or production code changed.

Current execution:

| Command | Actual result | What it establishes |
|---|---|---|
| `rtk node --test tests/time.test.ts` | Exit 1; `ERR_MODULE_NOT_FOUND` for `zod` from `core/time.ts`; 0 passing tests | Runtime qualification blocked at module loading, not evidence of a time arithmetic regression |
| `rtk node --test tests/brand-ui.test.ts` | Exit 0; 2 pass, 0 fail, 0 skip | Static source checks for Yamakan Y branding and localized preview label ownership only |

No browser, FFmpeg, backup, worker containment, installer, live API or native Windows scenario was executed in this audit.

## Implemented ownership and important call graphs

### Editing transaction

`src/main.tsx App/save` or `cli/main.ts` or `mcp/main.ts handle` → `sdk/client.ts YamakanClient.call` → HTTP `server/main.ts` authentication/envelope → `server/api.ts CreativeAPI.execute` → `core/command/registry.ts execute/authorize` → `ProjectStore.applyOperations/save` → `core/store.ts #commit` → SQLite snapshots/revisions/head/receipt/outbox in one `BEGIN IMMEDIATE` transaction.

`#commit` checks receipt replay before revision conflict, validates bounded snapshot bytes, inserts the immutable snapshot, CASes head, inserts revision and outbox, then acknowledges after `COMMIT`. Snapshot reads rehash stored bytes. Foundation dependencies: Node 24 `node:sqlite`, Zod, SHA-256 canonical JSON, NTFS/path/access helpers. Tests: `workspace-db`, `canonical-store`, `canonical`, `time`, `command`, `timeline`, `agent-principals`, `parity`.

**UI qualification caveat:** `App.edit` uses local `createHistoryState/pushHistoryState` and local reducers; `save` sends a complete `yamakan.project.save`. Persistent per-writer undo belongs to `applyOperations/#travel`. `#commit` clears edit history for operations outside `EDIT_HISTORY_OPERATIONS`, so a full save ends that persistent undo chain. Sharing pure reducers does not make the UI's unsaved draft history the database's acknowledged history. Cursor must preserve the visible draft/save contract or explicitly migrate it with conflict and crash fixtures.

### Media to export/reference

Raw HTTP asset upload → `ProjectStore.importAsset/stageAsset` → `LocalContentAddressedStorage` streamed SHA-256 staging/no-overwrite publication → `core/media.ts probe` → `workers().run` → pinned FFmpeg/ffprobe via `ProcessOwner` → asset/object/version DB registration → canonical attachment.

Export command → `JobSupervisor.submit` freezes revision → supervisor generation/attempt claim → `#runExport` → `compilePlan` → `renderPlan` → output probe/hash/validation → fenced terminal publication. `core/render/preview.ts preview` calls the same plan compiler and renderer for frames/segments, with bounded queue, deduplication and cache eviction. Reference preview is the semantic baseline; Canvas playback is a separate fast implementation and needs subset parity.

Windows `ProcessOwner` → `native/procd/src/main.rs` line protocol → atomic `PROC_THREAD_ATTRIBUTE_JOB_LIST` assignment + suspended process + restricted token/AppContainer → recorded worker identity → resume → exit/cleanup/ACL restoration. `native/procd/src/container.rs` manages capability grants and executable staging; `yamakan-acl.rs` owns workspace DACL setup. The current Job Object allows **one process**. A Python inference process that launches FFmpeg/other descendants requires a new qualified worker profile; it cannot simply reuse this restriction unchanged.

### Creative state (material exception to authority)

- Studio: `StudioCanvas` → `newStudioSession` → local mutation port/canvas engine; bitmap bytes live in `createStudioAssetStore`'s `Map<string, Blob>` and clear on dispose. Registry `studio.open/commit` calls `saveStudioDocument`, which validates and hashes; it does not write a project revision or asset object.
- Cinema: `scene.save` → `saveScene3D` → `persistCinemaScene` → mutable `<workspace>/cinema/<uuid>.json`; no expected revision, transactional receipt or project attachment.
- Director/consent/encodings: registry → `core/director/runtime.ts` → direct `writeJson/writeFile` in `<workspace>/director/`; no DB CAS or atomic multi-record update. `DirectorPanel` exposes Start `framework-smoke` and Next stage; it is not an autonomous script-to-film executor.
- Backup: `backupWorkspace` → online DB copy + ready content objects + sealed manifest. Neither creative sidecar directory is enumerated in `core/recovery.ts`. Studio session pixels are not in this backup graph.

These are source-observed integration boundaries, not a request to introduce another document database or scheduler.

## Foundation status matrix

Each row has exactly one founder-defined status. “WORKING WITH LIMITATIONS” relies on source plus the named historical execution and does not imply a fresh exact-head rerun. Release-sensitive guarantees remain unqualified here.

| Subsystem | Status | Source/functions/dependencies and evidence | Explicit limits / next gate |
|---|---|---|---|
| Overall architecture | WORKING WITH LIMITATIONS | `server/main.ts`; `CreativeAPI`; `ProjectStore`; command registry; React/Node/SQLite; historical T10/product-pass | Creative sidecars and session canvas break complete-workspace ownership; no remote tenancy |
| Frontend framework | WORKING WITH LIMITATIONS | `src/main.tsx App`; React 18.3.1, Vite 8.3.4, TypeScript 5.9.3; historical Edge E2E | Local web app, not a qualified desktop distribution |
| UI components/navigation | WORKING WITH LIMITATIONS | `src/editor/components/{Timeline,PreviewPlayer,Waveform}.tsx`, Studio/Cinema/Director panels; product-pass report | Large inherited controls exceed connected canonical features; limited creative workflow UI; no fresh visual/accessibility run |
| State management | WORKING WITH LIMITATIONS | `App.edit/save/accept`; `src/editor/utils/historyState.ts`; SDK; pure `edit-ops.ts` | Local unsaved drafts, full saves and server revisions are distinct; no durable draft recovery guarantee |
| SQLite database | WORKING WITH LIMITATIONS | `core/store.ts ProjectStore.initialize/#commit`, schema v7, `node:sqlite`; workspace-db tests | Synchronous DB/full snapshots; bounded size/history; no power-cut guarantee or remote filesystems |
| Canonical project | WORKING WITH LIMITATIONS | `core/canonical.ts parseCanonical/fromEditView/toEditView`, format v4, strict Zod, `core/time.ts` | 30fps editing projection; 200 assets/clips, 16 tracks, ten-minute horizon; no creative documents in snapshot |
| Timeline structures/reducers | WORKING WITH LIMITATIONS | `core/timeline/operations.ts applyBatch`, overlap/snapping/group-move/ripple adapters; operation tests | Cuts/basic multilayer; professional transitions/compositing are not implemented end to end |
| Revision history | WORKING WITH LIMITATIONS | `ProjectStore.#commit/history/loadRevision`, snapshot SHA/revision rows | `MAX_REVISION=10000`, full snapshots retained; storage growth must be measured |
| Undo/redo | WORKING WITH LIMITATIONS | `ProjectStore.applyOperations/#travel/undo/redo`; local UI history; timeline/parity tests | Per-writer persisted batch undo is distinct from unsaved UI undo; full save invalidates DB chain |
| Project recovery/diagnosis | WORKING WITH LIMITATIONS | `core/recovery.ts diagnoseWorkspace`, WAL inspection, quarantine; recovery tests | Does not recover session Studio or include Cinema/Director sidecars; power loss/real Profile A open |
| Durable jobs | WORKING WITH LIMITATIONS | `core/jobs.ts JobSupervisor.start/submit/cancel/retry/#fenced/#succeed`, Gomrey transition rules; jobs/interruption tests | Only export and CFR derivative execution; not a provider or creative workflow scheduler |
| Process ownership | REQUIRES INDEPENDENT VALIDATION | `core/process/owner.ts ProcessOwner.run`; `main.rs` atomic Job Object/exit paths; process-owner tests and historical records | Current helper missing; exact release service/owner/pre-resume death and child-tree fixtures required |
| Command registry | WORKING WITH LIMITATIONS | `core/command/registry.ts commands/execute/authorize/catalog`; Zod, scope ceiling | Not every `mutation:true` consumes receipt; workspace-wide scopes; no uniform events for sidecar mutations |
| Content-addressed asset storage | WORKING WITH LIMITATIONS | `core/storage/storage.ts LocalContentAddressedStorage`; `ProjectStore.stageAsset/attachAsset/collectGarbage`; streaming-import tests | Per-project object namespace; OS/AV sharing and power-loss evidence bounded; browser copies separate |
| Native Windows helpers | REQUIRES INDEPENDENT VALIDATION | `native/procd/src/{main,container}.rs`, `bin/{yamakan-acl,worker-probe}.rs`; no Rust crates | Security-sensitive FFI; no local compiled helper or new native tests; real second account open |
| File security | REQUIRES INDEPENDENT VALIDATION | `core/paths.ts safePath/initializeRoot`, `process/access.ts restrictToOwner`; AppContainer grant cleanup; access/containment tests | Same-account trust, administrators, previously open handles, ACL rollback and sidecar paths require exact artifact review |
| Media import/probe | WORKING WITH LIMITATIONS | `ProjectStore.importAsset/stageAsset`; `mediaHeader/probe`; byte/signature/demuxer/protocol/stream/dimension budgets; large-import receipt | Supported families only; ten-minute source; 4096px dimension; hostile decode release corpus still required |
| FFmpeg rendering | WORKING WITH LIMITATIONS | `core/render.ts renderPlan/renderRevision`; `render/plan.ts compilePlan`; pinned Windows FFmpeg hash | Only 30fps SDR yuv420p, <=1920x1080 project output, limited effects, serial media queue |
| Libass subtitles/titles | WORKING WITH LIMITATIONS | `render/ass.ts compileTitles/escapeAssText`, `render/capability.ts titleCapability`; pinned IBM Plex Arabic/fontconfig | Titles only, not ASR/captions editor/dubbing; H1 native Arabic review and visual parity open |
| Export pipeline | WORKING WITH LIMITATIONS | `JobSupervisor.#runExport/#succeed`, plan receipt/output probe; historical 6s H264/AAC product-pass | Bounded fixture and dev profile; no pro codecs/HDR/long project/release artifact claim |
| Preview architecture | WORKING WITH LIMITATIONS | `render/preview.ts preview/evictPreviews`; `src/reference.tsx`; fast `PreviewPlayer` | Two rendering implementations; parity subset must be explicit; browser decode/color/text differ |
| Backup/restoration | WORKING WITH LIMITATIONS | `backupWorkspace/restoreWorkspace/copyVerified`, idempotent wrappers, DB/object manifest; backup tests | Creative state absent; real disk-full/second-profile restore open; manifest hash is not adversarial authenticity |
| REST/local service | WORKING WITH LIMITATIONS | `server/main.ts authenticate/body`; exact loopback Host/Origin/session headers; `CreativeAPI.execute`; HTTP tests | Local trusted account only; no internet-exposed auth or multi-tenant grants |
| CLI | WORKING WITH LIMITATIONS | `cli/{main,open,recovery,migrate}.ts`; `YamakanClient`; launch-token/recovery tests | Main CLI uses shared local-client token; no main-command requestId flag; not every service journey is a first-class CLI workflow |
| MCP | WORKING WITH LIMITATIONS | `mcp/main.ts tools/handle`; registry-derived tools, newline JSON-RPC, optional requestId; MCP/parity tests | Import bytes use REST; default shared bearer; protocol cancellation notification does not cancel media jobs; ingress/admission negatives needed |
| TypeScript SDK | WORKING WITH LIMITATIONS | `sdk/client.ts YamakanClient.call/catalog`, typed registry inputs/results | Thin local HTTP client; no streaming upload/event or reconnect/progress client API; no published broad SDK |
| OTIO interchange | WORKING WITH LIMITATIONS | `core/interchange/otio.ts toOtio/fromOtio`; bounded JSON, URLs ignored, Python oracle CI | Proposal/matching subset; not full effect/media interchange or licensed media resolver |
| Branding source checks | TESTED AND WORKING | Current `tests/brand-ui.test.ts`: 2 pass | Static branding/localization ownership only; not a whole-product UX pass |

## Creative subsystem status matrix

| Subsystem | Status | Actual implementation and evidence | Product gap |
|---|---|---|---|
| Studio | PARTIALLY IMPLEMENTED | `core/studio.ts` enabled; `StudioCanvas`, canvas engine/host; Q8/Q9/Q10 historical receipts | Real drawing/session history, but no durable document+bitmap commit/reopen path |
| Canvas | WORKING WITH LIMITATIONS | `src/studio/canvas-engine/engine.ts`; `host/port.ts`; 4096²×20 Q10 fixture in historical report | Session pixel engine; imported engine tests are not complete application persistence tests |
| Cinema | PARTIALLY IMPLEMENTED | `scene3d.ts` schema/hash; `cinema-store.ts` sidecars; Three.js `CinemaViewport`; activation receipt | Cube proxies, orbit and focal-length metadata; no actual asset scene renderer, exported camera motion or generation conditioning |
| Director | PARTIALLY IMPLEMENTED | `director/{manifest,stages,runtime}.ts`, prerequisites/hash+expiry approvals; activation receipt | Manual stage receipt system, smoke UI; no durable execution/real script-to-takes-to-timeline loop |
| Animation | WORKING WITH LIMITATIONS | `core/animation/*`, timeline channel schemas, `render/animation-filters.ts`; animation E2E historical receipt | Only opacity/volume rendered; transform/effect channels residual; frame-sized FFmpeg graph growth |
| Audio | WORKING WITH LIMITATIONS | Embedded sound, `audio/unlink.ts`, gain/fades/atempo, `audio/loudnorm.ts`, Mediabunny peaks; W18/Q6 receipts | No ASR, diarization, dubbing, lip sync, advanced buses/restoration; browser speed path differs from offline stretch |
| Timeline editor | WORKING WITH LIMITATIONS | Typed cuts/trim/split/ripple/group-move, scene/shot ops, donor Timeline; product-pass | Fixed 30fps, limited size/output/profile; deeper editing cannot be inferred from donor type definitions |
| Effects/color/compositing | PARTIALLY IMPLEMENTED | Preview utilities `effects.ts`, `lut.ts`, `colorGrading.ts`; donor preview rendering | `src/adapter.ts editorView` sets `effect:null`; canonical clip/plan lacks general effect stack/LUT/transition contract; no export parity |
| Quality Lab | PARTIALLY IMPLEMENTED | `quality/lab.ts summarizeBlindedComparison`, strict supplied-record schema; P10 deterministic receipt | Summary only; no durable run/artifact/charge collection, genuine randomization/blind-rater workflow or validated model ranking |
| Smart Router | DISABLED | `router/explain.ts ROUTER_PROVIDERS_ENABLED=false`, `eligible:never[]`; rejection explanation tested historically | No actual selection/execution/quotes/budget reservation/ranking |
| Existing engine adapters | SCAFFOLD ONLY | `engines/contract.ts`, `fake.ts createFakeEngine`; fake outputs JSON in `.bin` | No ComfyUI/Diffusers/real generative adapter exists in inventoried engine directory; source comment mentioning `comfyui.ts` is not an implementation |
| Cloud/provider interfaces | DISABLED | No-provider Router + engine contract; no enabled route in registry | No qualified hosted submit/poll/cancel/reconcile or transactional charged-cost integration |
| Scenes/shots | WORKING WITH LIMITATIONS | `CanonicalScene/CanonicalShot`, camera intent, references, clip membership; pure reducer tests | Organizational structures; no proof of identity/environment continuity or applied lens/camera conditioning |
| Agent access | WORKING WITH LIMITATIONS | Scoped hashed agent tokens; registry human-only ceiling; `agents/lineage.ts` | Useful tool access; lineage comparison is supplied metadata, not independent review execution or autonomous planning |
| Agent workflows | PARTIALLY IMPLEMENTED | MCP commands, Director receipts, `flowSnapshot` read-only projection | No durable agent executor/checkpointed tool calls, artifact verification, model loop or proposal approval contract end to end |
| Flow | WORKING WITH LIMITATIONS | `core/flow/snapshot.ts flowSnapshot`, `src/flow/FlowView.tsx` | Read-only projection; `FlowView` has no import in active App, so source component existence is not exposed navigation |
| Text/image/video generation | MISSING | No real engine/provider executable call path in reviewed implementation | Fake adapter and capability flags are not generation |
| Identity/continuity execution | SCAFFOLD ONLY | `identity.ts` consent/encoding metadata, Director hash gates | `identity.encode` records a caller-supplied payload hash; no embedding/model identity enforcement or continuity evaluation |
| Transcription/subtitle editing/dubbing/lip sync | MISSING | Existing ASS titles and basic audio only | Needs separate operations, assets, language QA and entitled runtime |
| Upscaling/interpolation/restoration/tracking | MISSING | No registered canonical operations/qualified worker path found | Donor candidates belong to future plan; avoid claiming shipped enhancement |
| Desktop distribution | PARTIALLY IMPLEMENTED | Bundle scripts, installer-dev/unsigned RC harness and receipts | Signed installer, update/rollback, clean Profile A and H1–H5 remain release gates |

## Specific findings and atomic follow-up proposals

These findings are source observations or explicitly labeled inferences. They are not claims that security exploits were executed.

| ID / priority | Finding and source | Required atomic task and meaningful acceptance |
|---|---|---|
| AUD-01 / P1 | **Creative state not protected by canonical recovery.** Studio only hashes; Cinema/Director write sidecars. `core/command/registry.ts` studio/scene/director commands; `core/recovery.ts backupWorkspace`. | Define creative document/version/asset-ref tables in the existing DB (or immutable document blobs referenced transactionally by it). Migrate sidecars preserving originals; persist Studio bitmaps as managed objects. Save/draw/import → kill → reopen → online backup → restore must recover exact documents, referenced pixels and approvals. No second DB. |
| AUD-02 / P1 | **Sidecar writes lack transactional concurrency and idempotency.** `director/runtime.ts writeJson`, read-modify-write `advanceStage/approveStage/revokeConsentRecord`; `cinema-store.ts persistCinemaScene`; registry receipt not consumed. | Route each mutation through expected revision/CAS + same DB receipt/outbox. Two writers at one base produce one commit/one conflict; lost-response retry returns original ID/result; request hash mismatch refused; kill at every boundary preserves last acknowledged record. Revocation + dependent invalidation atomic. |
| AUD-03 / P1 | **Studio UI loses session state on dispose/reload.** `StudioCanvas` calls fresh `newStudioSession`; `assetStore.dispose` clears map; no client commit/save callback. | Add explicit document lifecycle UX bound to project revision/managed bitmap IDs. Draw/import + save + restart equals exact asset/document hashes; unsaved indicator and draft recovery accurately distinguish acknowledged from pending work. |
| AUD-04 / P2 | **Quality Lab schema permits duplicate slots, and content hash underbinds evidence.** `QualityComparisonSchema.systems.length(2)` has no A/B uniqueness; `summarizeBlindedComparison` dereferences missing B. Hash body omits output hashes/system identities/latency/consent purpose. | Add distinct A/B invariant, failures<=attempts, unique rater/rubric policy, versioned full evidence digest plus separately blinded summary. Negative `[A,A]`/`[B,B]` returns structured VALIDATION; changing output bytes/system version/latency changes evidence hash. Current TypeError and hash-equivalence consequences are source inferences, not executed here. |
| AUD-05 / P2 | **MCP ingress bounds incomplete.** `mcp/main.ts` rejects oversized buffer only when no newline exists; complete oversized lines pass that check, and `inFlight` has no admission cap. | Enforce byte length per complete frame before parse and bounded pending requests/response bytes. Test oversized newline-terminated UTF-8 JSON, many lines in one chunk, malformed frames and 10k concurrent read calls. Expect bounded memory and structured refusal; authenticated local DoS threat, no remote exploit claimed. |
| AUD-06 / P1 | **Waveform work can copy/redecode full large assets every revision.** `src/main.tsx` waveform effect fetches all audio-bearing objects to `Blob` on dependencies including revision; `openAssetPeaks` timeout begins after fetch. | Cache peaks by immutable asset+decode version; bounded service-generated peaks or bounded range decode, AbortSignal for superseded fetch, browser byte admission. Import large file then 100 edits: no repeated full fetches, bounded browser RSS and responsive editing. Streamed server import memory is not this proof. |
| AUD-07 / P1 | **Professional editing envelope is narrower than general product ambition.** `canonical.ts` 200/200/16 bounds; `compilePlan` 30fps check; 1080p output; ten-minute cap. | Benchmark representative larger real projects before policy/schema changes. Add one rational-rate path (e.g. 24000/1001) across reducers/view/time/probe/export; prove frame/audio boundaries, then separately qualify 4K/color and scaling. Never merely raise limits. |
| AUD-08 / P2 | **Animation graph cost scales with frames.** `opacityFilterChain/volumeFilterChain` produce up to18k serial filter stages, sampling each frame. | Benchmark worst-case keyframes×clips×duration; compile bounded piecewise expressions/segment schedules or retain fail-closed limits. Compare output frames/audio to existing reference with memory/startup/render budgets. Don't assume scalar expression portability. |
| AUD-09 / P1 | **Effects UI code is not a canonical/export capability.** `src/adapter.ts effect:null`; canonical schema and render plan have no general stack. | Define typed versioned effect registry and compiler support before exposing controls. First narrow crop/transform/color operation: persisted edit → preview/reference/export ROI comparison → undo/reopen; unsupported effects refused, not silently dropped. |
| AUD-10 / P2 | **Evidence/frontier narratives diverge.** `CURRENT.md`, implementation plan and release proposal contain older verified heads/measurements; product-pass receipt binds different source than report headline. | Produce artifact-bound capability manifest from flags, command catalog, plan/compiler/native/font hashes and actual receipt heads. Detect stale claims automatically; preserve old receipts. Exact release head reruns remain separate. |
| AUD-11 / P1 | **Cinema/Director activation overstates full creator journey if presented without limits.** viewport uses BoxGeometry proxies/sample scene; Director UI has start+next smoke controls. | Bind Cinema to selected project/scene, actual imported assets and typed camera intent; bind Director to real managed script/storyboard/take artifacts and editable timeline proposal. Accept one manual storyboard-to-edit round trip before model execution. |
| AUD-12 / P1 | **Uniform job extensibility is not yet demonstrated.** `JobSupervisor.#execute` dispatches export/CFR only; `EngineAdapter` uses graphs and in-memory byte arrays, fake job maps. | Introduce one versioned artifact-handle task adapter behind existing jobs/attempts; separate trusted operation specification from engine-specific graph lowering. Validate process/file/network budgets; fail if child workers exceed existing single-process policy. Test cancel/death/reconciliation on fake before real engine. |

The priority labels above guide the future plan; no code fixes are authorized by this document. AUD-01/02/03 are product integrity blockers for integrated creative workflows, not reasons to discard the existing editing database.

## Security and reliability negative-test packet

Preserve all existing media/path/auth/fencing tests. Extend only where changed behavior needs proof:

1. Creative restore completeness: include bitmap, scene, run, consent, revocation and approval in one backup; mutate concurrently; restore exact destination snapshot, not current live head. Missing creative object must produce recovery-required diagnostics.
2. Sidecar migration: duplicate IDs, malformed schemas, truncated JSON, attacker-owned junctions, UTF-16/case aliases, huge nesting, out-of-root reparse targets. No source sidecar overwritten before migration receipt commits; quarantine instead of trusting paths.
3. Workflow stale/forged approval: changed script/take hash, stale base revision, expired approval, revoked consent racing submission, caller-supplied output hash with missing object, agent requesting human-only approval. No execution/attach on unverified artifacts.
4. Process profiles: kill service, procd and worker before creation/after creation/before resume/while publishing; forbid suspended or detached leftovers. New Python worker profile tests Python→FFmpeg child trees, WMI/Task Scheduler escape, network egress, read sentinels, inherited handles and cleanup after AV locks.
5. Resource exhaustion: newline-terminated oversized MCP, many small requests, JSON depth/Unicode byte limits, 4GiB browser waveform path, 200 heavily animated clips, cache thrash during export, staging exhaustion. Busy/cancel/failure must leave bounded memory and no acknowledged phantom artifact.
6. Provider readiness (future only): tampered quote/currency, duplicate request, timeout after remote acceptance, poll outage, cancel charged later, concurrent budget reservation and late success. Preserve `reconciliationRequired`; never use fake completion as paid idempotency proof.
7. Existing boundary preservation: hostile media playlist/subresource reads, ASS injection, OTIO target URLs, cross-port session/media theft, forged principal/scopes, stale undo, unknown canonical versions, DB/WAL corruption, NTFS sharing-denial and real constrained-volume ENOSPC.

Required review is fresh correctness/security review over immutable implementation diffs plus meaningful E2E and exact-head CI. Local d1 may triage; it cannot approve these gates. This audit did not run a vulnerability scanner or claim an independent security gate passed.

## Historical Windows evidence and what it means

| Evidence path | Recorded binding / result | Limitation |
|---|---|---|
| `docs/evidence/qualification/t10-release.json` | `5c6658d589ac36bd08725fef9233872865a7030e`, measured2026-10-22; Windows11/Node24.19, 356 pass/358 total, 2 skips, E2E exit0; launch p95 1087ms, reopen1012ms | Dev profile; older baseline; not current execution, not signed/Profile A |
| `windows-product-pass.json` | `fd9a51a2b62ad990533ed1fba355c2150bcf8c75`; 6s H264720p/AAC output, full decode PASS, SHA recorded | Preview/export presence check, not SSIM; report's engineering headline uses `e8bb8dd...`; preserve both bindings |
| `windows-ux-qa-final-report.md` | Report cites PR83 / `e8bb8dd...` and CI39792739808, isolated D: QA root | Narrative not a fresh GitHub verification in this subreview; H1–H5 remain open |
| `q8-studio-stroke.json`, `q9-studio-inherited.json`, `q10-studio.json` | Historical host/stroke, inherited suite and performance evidence | Session behavior and inherited unit coverage do not establish DB document/bitmap persistence |
| `cinema-activation.json`, `director-activation.json` | Historical camera/scene persistence and manual command activation | No inference, actual multi-shot generation or professional user workflow |
| `p10-02-animation-e2e.json`, `w18-loudnorm.json` | Historical opacity/volume and loudnorm qualification | No transform graph or all-audio workflow claim |
| `playback.json` | `5623a1ea...`, Windows headless Edge; sustained29.2fps; min1s window23 | Older FFmpeg hash/profile; not evidence that every clip/effect/rate sustains24fps |
| `q11-jassub-eng.json`, `q15-user-presence.json` | Historical engineering/assessment records | Flags still false for JASSUB; Q15 is fallback/assessment, not native Hello evidence |

Human gates remain: H1 native Arabic review; H2 clean Profile A/offline capture; H3 real second account; H4 real constrained disk; H5 founder ship on signed artifact, with Authenticode and release installer. Keep prior successful engineering evidence; rerun affected paths when implementation changes, and all required release paths on the exact release artifact.

## Architecture challenges for the master plan

1. **Keep one authority; broaden its coverage.** A modular engine architecture is defensible only if creative documents, artifact refs, workflow attempts, approvals, consent revocations and resource/cost effects join the existing transaction/recovery graph. A separate inference queue or donor store would reverse the strongest part of Yamakan.
2. **Keep the renderer but benchmark the professional ceiling.** A deterministic FFmpeg reference renderer is useful; fixed30fps/full-snapshot/serial per-frame filters are not a qualified pro editor architecture. A measured rendering abstraction may later add an optimized graph engine. Preserve the same typed semantics, artifact identity and reference comparison before considering a replacement.
3. **Use operation contracts, not raw engine graphs as the product API.** `EngineGraph` is engine-shaped and byte-array outputs are poor for large videos. Prefer immutable artifact handles, operation/conditioning schema versions, worker resource profiles and explicit adapter lowering. ComfyUI graphs can be a private allowlisted adapter detail.
4. **Separate declared intent from observed behavior.** Camera metadata, identity payload hashes, manually supplied stage completions and lineage labels are not applied conditioning, identity stability, artifact existence or independent review. Store execution receipts and measure outputs.
5. **Make integration milestones creator-visible.** First persist/reopen a canvas; then place its result in a scene/shot; stage a take; approve a revision-bound timeline proposal; export and restore it. One coherent manual journey reveals more useful defects than another enabled panel.
6. **Treat Windows engine execution as a distinct security profile.** Existing no-network/single-process worker containment is a strength. Real inference has larger dependencies, descendant processes, GPU drivers and sensitive inputs. Reuse the supervisor contract while independently qualifying the worker profile.

This evidence supports extending the foundation through a modular, agent-accessible operation layer. It does not support rewriting the editor, adopting a specific model backend as authority, claiming competitive superiority, or releasing today.
