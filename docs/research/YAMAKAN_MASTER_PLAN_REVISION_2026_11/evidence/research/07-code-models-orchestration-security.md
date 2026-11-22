# 07 - Code assessment: model adapters, AI orchestration, resource governance, security boundaries, licensing/provenance

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Repository: `a local read-only worktree` (worktree of github.com/TheHalfMoon/Yamakan, HEAD `0284ba8334a25303487b08d0981c85235dbac2db`, "Merge pull request #276 from TheHalfMoon/feat/blender-matchmove").

## Method and caveats

- Read-only assessment using Read/Grep/Glob and read-only git commands. Nothing was built, run, installed, downloaded, or modified. No test was executed.
- All citations are repo-relative `path:line` at commit `0284ba8`. Line numbers will drift after any later commit.
- Status classes:
  - **IMPLEMENTED+TESTED**: code exists and a matching test file exists in `tests/`. I read only three test file heads (`tests/engine-absence.test.ts`, `tests/kaggle-engine.test.ts`, `tests/generation-durable.test.ts`); for the rest, "+TESTED" means "a dedicated test file exists", not "I confirmed what it asserts" and not "it passes".
  - **IMPLEMENTED**: code exists, no dedicated test file found or tests thin.
  - **STUB/SCAFFOLD**: interface, schema, flag, or placeholder only; cannot do the real thing at run time.
  - **DOC-ONLY**: described in docs, no code.
  - **ABSENT**: neither.
- Documents were read to learn intent, never as evidence of implementation. Every status below rests on code.
- Files not read are listed in section (h).

## Headline findings

1. **There is exactly one live generative route on main: Kaggle.** It is fully wired from the browser UI to a verified asset import, is durable across restarts, and is independent of `ENGINE_ENABLED`. It supports two operations only: text-to-video and image-to-video (first frame). Everything else generative (ComfyUI generation, local weights, hosted providers, transcription, router, cost quotes) is unreachable, a stub, or absent.
2. **The Kaggle route is approved in `docs/FOUNDER_DECISION_RECORD.md:147-173` but contradicted by the top-level docs** (`README.md:22`, `specs/CURRENT.md`, `docs/OPERATIONAL_CONTRACTS.md:210`, `docs/SECURITY.md`), none of which mention Kaggle and several of which say nothing leaves the machine and nothing routes v2 requests.
3. **There is one job authority (`JobSupervisor`), one command registry, one permission function, one project store.** They are real, durable, and tested. A new plan must extend them, not add siblings.
4. **"Zero unapproved spending" and "no unapproved model downloads" are enforced by absence, not by a gate.** There is no quote, reservation, budget, spend ledger, credential store, download-approval object, or VRAM budget in code. The guarantees hold today only because no paid-provider code and no downloader code exist, plus two constants asserted false by scripts.
5. **Windows containment is real and strong (procd: Job Object, restricted low-integrity token, AppContainer without network), but the one live AI route bypasses it**: the Kaggle CLI runs via plain `execFile` with network and the person's Kaggle credentials. Containment tests are not run in CI on Windows.
6. **Third-party code provenance tooling is mature and CI-gated; model provenance tooling is not.** The SBOM omits Rust crates, Blender, Kaggle-side Python packages, and model weights.

---

## (a) Module map

### Model adapters and provider integrations

| Path | Lines | Role |
|---|---|---|
| `core/engines/contract.ts` | - | v1 graph-based `EngineAdapter` (67-74); `ENGINE_CONTRACT` (6); `export const ENGINE_ENABLED = false;` (77) |
| `core/engines/contract-v2.ts` | 546 | v2 operation-based `EngineAdapterV2` (359-382); `Operation` enum (34-40); `EngineRequestV2Schema` (156-209); `RefusalReason` (212-225); `CapabilityV2Schema` (251-269); `CancellationSchema` (329-339); `ArtifactSchema` (343-350); `AttemptFence` (420-481); `underClaim` (486-498); `readArtifactVerified` (504-530); `ENGINE_V2_LIMITS` (19-29) |
| `core/engines/generation.ts` | 625 | `createGenerationService` (159-625): the single service in front of any v2 adapter. `GenerationRecipe` (28-33), `GenerationLineage` (52-61), `GenerationRecord` (63-97), `GenerationLedger` (99-109), `memoryLedger()` (123-141) |
| `core/engines/kaggle.ts` | 1385 | Kaggle adapter `createKaggleEngine` (509-1385); `KAGGLE_RECIPES` (63-126); `kaggleCli` (270-304); `kaggleCliEnvironment` (232-238); `ledgerOptions` (491-507) |
| `core/engines/comfyui.ts` | 1050 | ComfyUI adapter `createComfyEngine` (374-1050); `PINNED_COMFY_RECIPES` empty (96); `comfyBaseUrl` loopback-only (99-117); `probeComfy` (296-360) |
| `core/engines/manifests.ts` | 411 | `ModelManifestSchema` (59-98); `ACCEPTED_MODEL_LICENSES` (35-40); `PINNED_MODEL_MANIFESTS` empty (108); `discoverEngineCapabilities` (367-411) |
| `core/engines/reasons.ts` | 20 | `ENGINE_REASON_MESSAGES` (6-15) |
| `core/engines/v1-bridge.ts` | 339 | `bridgeV1` (159); `SERVER_RECIPES` fake-only (76-135) |
| `core/engines/fake.ts` | 395 | `createFakeEngine` (50), `createFakeEngineV2` (248); tests only |
| `core/engines/candidates.ts` | 646 | YU-043 evidence-validation schema for engine candidates; not runtime routing |
| `core/engines/clean-image.ts` | 308 | Re-encodes a first-frame still from decoded pixels (strips metadata) via contained FFmpeg |
| `core/router/explain.ts` | 83 | `ROUTER_PROVIDERS_ENABLED = false` (10); `explainRoutes` (39-83) always returns `eligible: []` |
| `core/audio/transcription.ts` | - | YU-070 contract; `WHISPER_CPP` pin (45-51); silencedetect stand-in (36); always refuses real transcription (9-12) |
| `core/quality/lab.ts` | - | `QUALITY_LAB_ENABLED = true` (13); blinded A/B rating schemas |
| `scripts/kaggle/wan22-ti2v-5b/run.py` | 305 | The script that runs ON Kaggle (also `scripts/kaggle/cogvideox-2b/`, `scripts/kaggle/wan22-ti2v-5b-first-frame/`) |
| `docs/evidence/yamakan/provider-registry.json` | - | Research snapshot of hosted providers; `"status": "research snapshot; not a runnable provider registry"` (4) |

### AI orchestration

| Path | Lines | Role |
|---|---|---|
| `core/command/registry.ts` | 3078 | The one typed command registry: `commands`, `execute` (2944-2973), `authorize` (2930-2942), `catalog` (2975-2984), `resolveOperation` (2919-2928), `generationOf` (309-359), `CommandContext` (264-283) |
| `core/command/envelope.ts` | - | `EnvelopeSchema` (13-20), `LegacySchema` (23-28), `parseEnvelope` (38-59) |
| `core/command/errors.ts` | - | 14 `ErrorCodes` (3-18); retryable only BUSY and UNAVAILABLE (21-36); `CommandError` (55-65) |
| `core/jobs.ts` | 2377 | `class JobSupervisor` (261): the one durable job authority |
| `core/jobs/rules/yamakan-transitions.ts` | 88 | `YAMAKAN_LEGAL_TRANSITIONS` (19-75), `transitionYamakanJob` (78-88) |
| `core/jobs/rules/jobs.ts` | 209 | Donor (Gomrey) job rules; only `IllegalTransition` is used |
| `core/progress.ts` | 128 | `readProgress` polling view with hash cursor (114-125) |
| `server/api.ts` | 90 | `class CreativeAPI` (20-90); owns the single `JobSupervisor` (35) |
| `server/main.ts` | 776 | HTTP service, transport auth, route table |
| `sdk/client.ts` | 392 | Client used by UI, CLI, MCP: `call()` (133-160), `catalog()` (366-391) |
| `cli/main.ts` | 69 | CLI front-end |
| `mcp/main.ts` | 367 | stdio MCP server |
| `src/main.tsx` | - | UI wiring of generation commands (2506-2674) |
| `src/create/*` | - | Create workspace UI (GeneratePanel, PeoplePanel, create-model.ts, etc.) |

### Resource governance

| Path | Role |
|---|---|
| `core/command/policy.ts` (156 lines) | `RESOURCE_POLICY` `yamakan.resource-policy/v3` (13-104); `SCALE_PROFILES` (112-145) |
| `core/qualification-policy.ts` (57 lines) | `QUALIFICATION_POLICY` `yamakan.qualification-policy/v1`, founder-approved thresholds; "freezes no memory or resource ceiling" (7) |
| `core/engines/manifests.ts:110, 397` | `HostProfile`; default `{ memoryBytes: totalmem(), gpu: false }` |
| `core/process/owner.ts:30-96` | `WorkerProfile`, `ENGINE_WORKER_PROFILE`, `checkProfile` |
| `core/store.ts:618-621` | Agents limited to half of workspace byte budgets |
| statfs disk preflights | `core/jobs.ts:617, 1312, 1836, 1996`; `core/store.ts:1159-1167, 2031-2036, 2154-2157, 2326-2329, 3520-3528`; `core/engines/kaggle.ts:591-660`; `core/audio/peaks.ts:378`; `core/render/preview.ts:199`; `core/media/proxies.ts:514, 830`; `core/recovery.ts:296` |

### Security boundaries

| Path | Role |
|---|---|
| `native/procd/src/main.rs` (1410 lines) | `yamakan-procd`: suspended create in own Job Object, kill-on-close, restricted low-integrity token, AppContainer with no network capability (header 1-44) |
| `native/procd/src/container.rs` (671 lines) | AppContainer "Yamakan.MediaWorker"; `capability_sid` (185); `staged_tool` (431) |
| `native/procd/src/bin/yamakan-acl.rs`, `worker-probe.rs` | ACL tool and probe (not read) |
| `core/process/owner.ts` (531 lines) | `class ProcessOwner` (203-531); `run()` (308-335); POSIX fallback `#runPosix` (467-507) |
| `core/process/workers.ts` (148 lines) | Vendored FFmpeg pin checks: `PINNED_SHA256` (20-23), `assertPinned` (69-78), `mediaTools()` (96-134) |
| `core/process/access.ts` (91 lines) | `restrictToOwner` (59-73) |
| `core/paths.ts` | `safePath` (3-27), `initializeRoot` (45-53) |
| `core/service-lock.ts` | `acquireServiceLock` |
| `core/launch.ts` | Single-use launch secret, `LAUNCH_TTL_MS = 60_000` (5) |
| `core/agents.ts` | `hashAgentToken` (11-13), `newAgentToken` (15-17), scope encoding (23-39) |
| `sdk/service-proof.ts` (67 lines) | HMAC service proof |
| `core/director/runtime.ts`, `core/continuity.ts`, `core/identity.ts` | Likeness consent and send-consent |
| `core/blender/runtime.ts` (207 lines), `scripts/blender-install.ts` (114 lines) | Hash-pinned, person-downloaded Blender |
| `server/main.ts:342-349, 708-728, 736` | Host/Origin checks, CSP, loopback bind |

### Licensing and provenance tooling

| Path | Role |
|---|---|
| `scripts/import-guard.mjs` (217 lines) | Deny-by-default source import guard |
| `scripts/provenance.mjs` (162 lines) | Ledger, notice, and font verification |
| `scripts/provenance-drift.mjs` (122 lines) | Optional upstream diff/drift (network use only here) |
| `scripts/sbom.mjs` (115 lines) | CycloneDX 1.5 SBOM generate/check |
| `scripts/brand-check.mjs` (102 lines) | Brand-term scan |
| `docs/provenance/imports.json` (6267 lines) | 404-entry import ledger |
| `docs/provenance/import-policy.json` (333 lines) | Donor roots, source notices, excluded paths, process spawn allowlist |
| `docs/provenance/{excluded-content-hashes,fonts,donor-clones,brand-terms}.json` | Supporting ledgers (not read) |
| `NOTICE` (75 lines), `notices/` (23 files) | Third-party notices |
| `vendor/ffmpeg-win64-r8/` (30 files) | Vendored, hash-pinned FFmpeg 7.1.5 |
| `docs/evidence/sbom/yamakan-runtime.cdx.json` | Committed SBOM |
| `.github/workflows/qualify.yml` (138 lines), `provenance-security-monthly.yml` (39 lines) | CI gates |
| `manifest.json` (811 lines), `validation.json` (16 lines) | Stale planning-package integrity artifacts, not code/model provenance |

---

## (b) Request -> job -> adapter -> result flow

### Flow 1: generation (the only AI flow that runs today)

Precondition (service start-up):

1. `server/main.ts:168-186` reads `YAMAKAN_KAGGLE_CLI` and `YAMAKAN_KAGGLE_USERNAME`. Requires an absolute, existing file path that is not `.cmd`/`.bat`, and a username matching `^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$`. Comment: "The person's own Kaggle CLI, for runs they start: never its token."
2. `server/main.ts:187` constructs `new CreativeAPI(store, { recoveryHome, comfyUrl, kaggle })`; `server/api.ts:35` constructs the single `JobSupervisor`; `server/main.ts:189` `await api.queue.start()`.

Request path:

3. UI: `src/main.tsx:2506-2508` calls `yamakan.generation.options` to learn route and offered models. The user sees the egress disclosure (`src/i18n.ts:29`, `:31`) and starts a run: `src/main.tsx:2639-2643` calls `yamakan.generation.start`.
4. SDK: `sdk/client.ts:133-160` `call()`; before any token-bearing request it verifies the service proof (`sdk/client.ts:69-74, 84-126`; `sdk/service-proof.ts:37-52`).
5. HTTP: `POST /api/v1/call` at `server/main.ts:408-424`. Host/Origin/sec-fetch-site checks at `server/main.ts:342-349`. `authenticate(req, url)` at `server/main.ts:229-262` derives the `Principal` from the transport (`browser-ui` | `local-client` | `agent:<uuid>`; `core/command/registry.ts:259-262`; `server/api.ts:15-18`).
6. `CreativeAPI.execute` (`server/api.ts:62-81`) builds the `CommandContext` with `store`, `queue`, `principal`, `requestId`, `recoveryHome`, `comfyUrl`, `kaggle`. It never passes `modelRoot`.
7. `execute` (`core/command/registry.ts:2944-2973`): `resolveOperation` (2919-2928, accepts `darzain.*` aliases) -> `authorize` (2930-2942; `humanOnly` requires `principal.id === "browser-ui"`, then scope check) -> zod `input.parse` (2952) -> request-ID refusal for non-replayable commands (2953-2954) -> receipt digest for replayable mutations (2957-2971) -> `command.run`.
8. `yamakan.generation.start` (`core/command/registry.ts:2387-2421`): scope `project:write`, `humanOnly: true`, `refusesRequestId: NO_REPLAY`. Calls `generationOf(ctx)` (309-359). With `ctx.kaggle` set, it lazily builds one service per store: `createGenerationService({ adapter: createKaggleEngine({ cli: kaggleCli(ctx.kaggle.cli), username, ...ledgerOptions(ledger) }), store, resourcePolicyHash, ledger })` where `ledger = ctx.queue.generationLedger()` (311-331).

Service and job record:

9. `createGenerationService.start` (`core/engines/generation.ts:371-557`):
   - image-to-video requires `firstFrameAssetId` and `noUnconsentedPerson === true` (377-387); `permittedToSend([asset.hash])` (393); PNG/JPEG only (394-399).
   - one-run-per-notebook guard using `ledger.following` (413-439).
   - `ledger.begin(...)` "Recorded before anything leaves" (447-472), phase `sending`, state `queued`.
10. `JobSupervisor.generationLedger().begin` (`core/jobs.ts:349-375`) inserts a `jobs` row with kind `remote-generation` (`REMOTE_GENERATION`, `core/jobs.ts:116`), state `preparing`, `job_id = idempotency_key = generationId`, after the `activeJobs` admission check.

Adapter:

11. `adapter.submit` is called with `attemptKey: id`, `leaseGeneration: 1` (hard-coded, `core/engines/generation.ts:483`), `deadlineMs: ENGINE_V2_LIMITS.deadlineMs` (484), `audio: false` (498); `openAsset` re-checks `permittedToSend` (502-508).
12. Kaggle `submit` (`core/engines/kaggle.ts:1184-1352`): `assertFree` (1067-1133) refuses if a run may still be in flight, if the remote notebook is RUNNING/QUEUED/NEW_SCRIPT/CANCEL_REQUESTED, or if Kaggle does not report the notebook private. `readFirstFrame` (1135-1175) and `core/engines/clean-image.ts` produce a metadata-free still. `scriptWithBrief` (175-191) embeds the brief into the notebook script. Kernel metadata sets `is_private: true, enable_gpu: true, enable_internet: true` (1271-1287). `kaggle kernels push` (1289-1292) runs through `kaggleCli` (270-304): plain `execFile` with an allow-listed environment (202-238), timeout, and whole-tree kill (`endTree`, 253-268).
13. Outcome handling in the service: refusal before send marks failed and dismissed (`core/engines/generation.ts:511-538`); an uncertain send stays `sending` and "is followed, not resent" (539-552).

Status, result, import:

14. UI polls `yamakan.generation.status` (`src/main.tsx:2644-2645`; `core/command/registry.ts:2492-2499`) -> `statusOf` (`core/engines/generation.ts:315-367`) -> adapter `status`/`reconcile` (`core/engines/kaggle.ts:1353-1354`) -> `ledger.update` (`core/jobs.ts:376-422`), which rewrites the payload and walks legal transitions.
15. On completion the adapter downloads output with a byte bound and disk reserve check (`core/engines/kaggle.ts:591-660`), validates the run receipt `yamakan.generation-receipt/v1` (691-811), and exposes it through `enumerateArtifacts` (1371-1374) and `readArtifact` (1375-1383).
16. Import: `yamakan.generation.import` (`core/command/registry.ts:2510-2519`, human-only) -> `importResult` (`core/engines/generation.ts:613-623`) -> `bringIn` (197-313): consent re-checked (211, 292); exactly one `video/mp4` (218-225); byte count and SHA-256 verified while streaming into a temp directory (253-285); `store.importAsset(projectId, "generated-<id8>.mp4", ...)` (297-302); `GenerationLineage` written to the ledger (227-245); dedupe (248-252).
17. The asset reaches the timeline only when the person places it (summary text at `core/command/registry.ts:2516`).

Restart and cancel:

18. After a service restart, the Kaggle adapter `adopt`s runs from the ledger (`core/engines/kaggle.ts:957-1000`) using `ledger.following` (`core/jobs.ts:423-462`, `remembersEnded: true`). A generation is never resent.
19. Cancel: `yamakan.generation.cancel` (`core/command/registry.ts:2500-2509`) -> `service.cancel` (`core/engines/generation.ts:561-589`) -> `requestCancel` (`core/engines/kaggle.ts:1357-1370`), which returns `requested: false, remoteAcknowledged: false, remoteOutcome: "continuing" | "unknown", billingOutcome: "notApplicable"` because "Kaggle's public interface offers no way to stop a run". The UI states this (`src/i18n.ts:117`).

### Flow 2: durable local job (export, Blender render, derivative)

1. Command, for example `yamakan.export.video` (`core/command/registry.ts:1976`) or `yamakan.blender.render` (1856), enters through the same steps 4-7.
2. `JobSupervisor.submit` (`core/jobs.ts:512-559`), idempotent by project / kind / frozen_revision / idempotency_key; batch variant `submitBatch` (566-665); Blender `submitBlenderRender` (1576-1662, single slot, second request refused at 1636-1647).
3. `#pump()` (850-882) is a single sequential loop; `#claim()` (891-942) takes jobs FIFO by rowid; a job interrupted 3 times (`MAX_INTERRUPTIONS`, 135) goes to `reconciliationRequired`.
4. `#execute` (1100-1180) dispatches to `#runExport` (1203-1254), `#runBlender` (1260-1572), `#runBlenderTrack` (1802-1967), `#runDerivative` (1969-2133). Each state write goes through `#fenced` (964-983) using the supervisor generation.
5. Work runs in an owned process: `ProcessOwner.run()` (`core/process/owner.ts:308-335`) -> `#runOwned` (337-462) -> `yamakan-procd` (`native/procd/src/main.rs`).
6. `#markValidating` (1049-1062), `#succeedIn` (1066-1098, cancel wins before success), `#finish` (985-1006).
7. Client reads `yamakan.job.status` (`core/command/registry.ts:2034`), `job.list` (2049), and the polling view `readProgress` (`core/progress.ts:114-125`). Control: `job.cancel` (2041), `job.retry` (2056), `job.discard` (2065).

### Entry surfaces (all converge on step 5-7 of Flow 1)

- **Browser UI**: session established with a single-use launch secret (`core/launch.ts:14-28, 53-74`; `server/main.ts:371-399`); principal `browser-ui`.
- **CLI**: `cli/main.ts:23` reads `<workspace>/token`; loopback only (19-21); principal `local-client`; cannot run `humanOnly` commands.
- **MCP**: `mcp/main.ts` stdio JSON-RPC; requires `YAMAKAN_AGENT_TOKEN` or `YAMAKAN_AGENT_TOKEN_FILE` unless `YAMAKAN_MCP_LOCAL_CLIENT=1` (19-35); tools generated from `client.catalog()` (114-145); `tools/call` (263-283); principal `agent:<uuid>`; `notifications/cancelled` is ignored (171-173).
- **SDK**: `sdk/client.ts`.

---

## (c) Capability status table

### Area 1: model adapters and provider integrations

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Adapter contract v1 (graph-based) | IMPLEMENTED+TESTED | `core/engines/contract.ts:67-74`; `tests/engines.test.ts` | Reachable only through the v1 bridge with fake recipes |
| Adapter contract v2 (operation-based) | IMPLEMENTED+TESTED | `core/engines/contract-v2.ts:359-382`; `tests/generation-service.test.ts` | Methods: `capabilities`, `location?`, `submit`, `status`, `requestCancel`, `enumerateArtifacts`, `readArtifact`, `reconcile`. No `quote`/`estimate`/`validate` method |
| v2 operation enum | STUB/SCAFFOLD for 3 of 5 | `core/engines/contract-v2.ts:34-40` | `textToVideo`, `imageToVideo` have adapters; `videoEdit`, `transcribe`, `enhance` have none |
| Generation service (consent, record-before-send, never-resend, verified import) | IMPLEMENTED+TESTED | `core/engines/generation.ts:159-625`; `tests/generation-service.test.ts`, `tests/generation-durable.test.ts` | Recipe type limited to `textToVideo` and `imageToVideo` (28-33) |
| Kaggle adapter: text-to-video | IMPLEMENTED+TESTED | `core/engines/kaggle.ts:509-1385`; recipes `kaggle-wan22-ti2v-5b`, `kaggle-cogvideox-2b` (63-126); `tests/kaggle-engine.test.ts`, `tests/kaggle-run-script.test.ts`, `tests/kaggle-cogvideox-script.test.ts` | Tests use a stand-in CLI function; real runs evidenced by receipts in `docs/evidence/ultimate/` |
| Kaggle adapter: image-to-video (first frame) | IMPLEMENTED+TESTED | recipe `kaggle-wan22-ti2v-5b-first-frame` (`core/engines/kaggle.ts:63-126`); `readFirstFrame` (1135-1175); `tests/kaggle-first-frame.test.ts`, `tests/clean-image.test.ts` | First frame capped at 4 MiB (139); video at 512 MiB (137) |
| Kaggle route gated by `ENGINE_ENABLED` | ABSENT (by design) | no `ENGINE_ENABLED` reference in `core/engines/kaggle.ts`; enablement is env only (`server/main.ts:168-186`) | Founder-approved exception (`docs/FOUNDER_DECISION_RECORD.md:154-159`) |
| ComfyUI adapter (generation) | IMPLEMENTED+TESTED, unreachable | `core/engines/comfyui.ts:374-1050`; `tests/comfyui-engine.test.ts`; gate at `core/command/registry.ts:332-337` | `PINNED_COMFY_RECIPES` is empty (96) and `ENGINE_ENABLED` is false; uses `memoryLedger()` not the durable ledger (341-345) |
| ComfyUI read-only probe | IMPLEMENTED+TESTED | `yamakan.engines.comfyui` (`core/command/registry.ts:2364`); `probeComfy` (`core/engines/comfyui.ts:296-360`); UI `src/main.tsx:141, 2054` | Loopback URL only (99-117); person-started; reports `vram_total` informationally (309, 349-352) |
| Managed ComfyUI mode (Yamakan starts/installs ComfyUI) | DOC-ONLY | `docs/MANAGED_COMFYUI_MODE.md` ("Status: proposed, not built or approved.") | `server/main.ts:160-167` comment: "this service never starts one" |
| Fake engines | IMPLEMENTED+TESTED | `core/engines/fake.ts:50, 248` | Test-only |
| v1-to-v2 bridge | IMPLEMENTED+TESTED | `core/engines/v1-bridge.ts:159`; `SERVER_RECIPES` (76-135) | Only `fake.textToVideo.v1` and `fake.imageToVideo.v1` |
| Hosted commercial providers (any) | ABSENT in code; DOC-ONLY | `docs/PROVIDER_MATRIX.md:3` ("No inference requests were made"); `docs/evidence/yamakan/provider-registry.json:4` | No HTTP client, key handling, or adapter for any commercial provider |
| Local model runtime (weights on this PC) | STUB/SCAFFOLD | `core/engines/manifests.ts:59-98, 108`; `CommandContext.modelRoot` declared (`core/command/registry.ts:272-273`) but never set (`server/api.ts:62-81`) | `PINNED_MODEL_MANIFESTS` empty |
| Capability discovery (`engines.capabilities`) | IMPLEMENTED+TESTED as honest absence | `discoverEngineCapabilities` (`core/engines/manifests.ts:367-411`); command at `core/command/registry.ts:2606`; `tests/engine-absence.test.ts` | Always returns the `ENGINE_DISABLED` branch (380-383) on main |
| Capability descriptor for the live route | IMPLEMENTED (ad hoc) | `capabilities: () => []` (`core/engines/kaggle.ts:1179`); `yamakan.generation.options` (`core/command/registry.ts:2423-2453`) | The live adapter reports no v2 capabilities; a bespoke command describes it instead |
| Model registry / manifest / versioning | STUB/SCAFFOLD (local); IMPLEMENTED (Kaggle constants) | `ModelManifestSchema` (`core/engines/manifests.ts:59-98`); `KAGGLE_RECIPES` (`core/engines/kaggle.ts:63-126`) with `model`, `revision`, `licence` | No unified registry; see duplicated abstractions in (g) |
| Engine candidate evidence (YU-043) | IMPLEMENTED+TESTED as validation only | `core/engines/candidates.ts:14`; `tests/engine-candidates.test.ts`; data `docs/evidence/ultimate/engine-candidate-manifests.json` | Not consulted at run time |
| Transcription | STUB/SCAFFOLD | `core/audio/transcription.ts:9-16, 35-51`; `yamakan.audio.transcribe` (`core/command/registry.ts:2329`) always `CAPABILITY_UNAVAILABLE`; `tests/transcription-contract.test.ts` | Contract plus silencedetect stand-in; no whisper.cpp binary, no model |
| Image generation, video-to-video, upscaling, TTS, lip-sync, music, reference conditioning | ABSENT | no adapter in `core/engines/`; not in `Operation` enum beyond `videoEdit`/`enhance` | `docs/MODEL_CAPABILITIES.md:7` lists 13 operations; code has 5 |
| Credentials / BYOK / key storage | ABSENT | no credential store in `core/`; `docs/SECURITY.md:11` "keys later use a qualified secret service" | Kaggle uses the person's own CLI configuration; Yamakan passes `KAGGLE_*` env through (`core/engines/kaggle.ts:232-238`) and never reads the token file itself |
| Customer authorisation for egress (send consent) | IMPLEMENTED+TESTED | `permittedToSend` (`core/engines/generation.ts:179-184`); `assertMaySend` (`core/continuity.ts:535-576`); `send_consent_covers` (`core/store.ts:455-459`); `tests/continuity-consent.test.ts`; UI `src/main.tsx:2571-2618` | `leavesThisComputer: Boolean(adapter.location)` |
| Egress disclosure to the user | IMPLEMENTED | `src/i18n.ts:29, 31, 117, 129` (English and Arabic) | Explicit per-run statement that the prompt leaves the computer |
| Cost / resource estimate shown to user | STUB/SCAFFOLD | `expectedSeconds`, `timeoutSeconds` in `generation.options` (`core/command/registry.ts:2446-2447`); UI text `src/i18n.ts:29, 129` | Time only; no money, credits, quota, or VRAM estimate |
| Cost router | STUB/SCAFFOLD | `core/router/explain.ts:10, 39-83`; `yamakan.router.explain` (`core/command/registry.ts:2824`) | `remainingBudgetMinor` parsed and unused; always `eligible: []` |
| Provenance recording for generated media | IMPLEMENTED+TESTED (partial) | `GenerationLineage` (`core/engines/generation.ts:52-61`), written at 227-245; receipt validation `core/engines/kaggle.ts:691-811`; `scripts/kaggle/wan22-ti2v-5b/run.py:44-61` | Lineage lives in the `remote-generation` job payload and the import result. No asset-level "AI-generated" flag (grep of `core/project.ts` found none), no C2PA, no watermark, no embedded metadata |
| Blinded quality lab | IMPLEMENTED | `core/quality/lab.ts:13, 15`; `tests/quality-evidence.test.ts` | Local rating only; provider ranking off |

### Area 2: AI orchestration

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Single typed command registry shared by REST/CLI/MCP/SDK | IMPLEMENTED+TESTED | `core/command/registry.ts:2944-2984`; `server/main.ts:406-424`; `tests/command.test.ts`, `tests/http.test.ts`, `tests/mcp.test.ts` | About 120 `yamakan.*` operations with `darzain.*` aliases |
| Durable job model | IMPLEMENTED+TESTED | `class JobSupervisor` (`core/jobs.ts:261`); tables `jobs`, `attempts`, `supervisor` (`core/store.ts:212-241`); `tests/jobs.test.ts` | SQLite-backed |
| Job states and legal transitions | IMPLEMENTED+TESTED | `JobState` (`core/jobs.ts:101-110`); `YAMAKAN_LEGAL_TRANSITIONS` (`core/jobs/rules/yamakan-transitions.ts:19-75`); `assertAndApplyJobState` (`core/jobs.ts:78-99`); `tests/job-transitions.test.ts` | Closed transition table |
| Queue / scheduler | IMPLEMENTED+TESTED (minimal) | `#pump()` (`core/jobs.ts:850-882`), `#claim()` (891-942) | One sequential FIFO loop; no priorities, fairness, per-kind concurrency, or resource-aware scheduling |
| Supervisor-generation fencing | IMPLEMENTED+TESTED | `start()` (`core/jobs.ts:280-336`); `#fenced` (964-983) | Prevents a stale supervisor writing state |
| Resumability after crash/restart | IMPLEMENTED+TESTED | `MAX_INTERRUPTIONS = 3` (`core/jobs.ts:135`); `#claim` (891-942); `tests/interruption.test.ts` | After 3 interruptions -> `reconciliationRequired`; no checkpoint/resume inside a job |
| Remote generation survives restart | IMPLEMENTED+TESTED | `adopt` (`core/engines/kaggle.ts:957-1000`); `tests/generation-durable.test.ts` | Followed again, never resent |
| Cancellation (local jobs) | IMPLEMENTED+TESTED | `cancel` (`core/jobs.ts:818-848`); cancel-wins in `#succeedIn` (1066-1098); `ProcessOwner` kill via Job Object | |
| Cancellation (remote generation) | IMPLEMENTED (local stop-following only) | `core/engines/kaggle.ts:1357-1370`; `job.cancel` refuses `remote-generation` (`core/jobs.ts:818-848`) | Remote run cannot be stopped; it runs to its timeout (up to 3600 s) using quota |
| Retries | IMPLEMENTED (manual only) | `retry` (`core/jobs.ts:754-779`) only from `reconciliationRequired`; `#execute` (1100-1180) has no automatic retry | Refuses `remote-generation`: "A generation is never sent again automatically." |
| Automatic retry / backoff / transient classification | ABSENT in use | `TRANSIENT_ERRORS`, `classifyFailure` exist in `core/jobs/rules/jobs.ts:39-47, 80` but are not imported by `core/jobs.ts` (only `IllegalTransition`, line 70) | Unused donor code |
| Idempotency keys (jobs) | IMPLEMENTED+TESTED | `submit` (`core/jobs.ts:512-559`) | Keyed by project/kind/frozen_revision/idempotency_key |
| Idempotent command replay (request IDs) | IMPLEMENTED+TESTED | `core/command/registry.ts:2953-2971`; `command_receipts` (`core/store.ts:591`, replay 1127, insert 1307); `tests/request-id-refusal.test.ts` | Generation commands refuse request IDs (`NO_REPLAY`, 361) |
| Timeouts / wall limits | IMPLEMENTED+TESTED | `RESOURCE_POLICY.enforced` wall limits (`core/command/policy.ts:13-104`); procd wall loop (`native/procd/src/main.rs:1279-1295`); `WALL_EXIT_CODE` (`core/process/owner.ts:60`); Kaggle recipe `timeoutSeconds`; `ENGINE_V2_LIMITS.deadlineMs` | |
| Progress reporting | IMPLEMENTED+TESTED (polling) | `readProgress` (`core/progress.ts:114-125`); `tests/progress-view.test.ts`; ComfyUI websocket progress inside the adapter | No server push (SSE/WebSocket) to clients; MCP gets no progress notifications |
| Failure recovery / backup / restore | IMPLEMENTED+TESTED | `core/recovery.ts`; `recovery_receipts` (`core/store.ts:255-263`); `tests/recovery.test.ts`, `tests/backup.test.ts` | Restore into a new root; quarantine of unverifiable objects |
| MCP cancellation | ABSENT | `mcp/main.ts:171-173` | `notifications/cancelled` ignored |
| Job listing scoped to project | ABSENT | `list(limit=100)` (`core/jobs.ts:742-750`) is global, max 500 | |
| Blender render queueing | ABSENT (refuses) | `submitBlenderRender` (`core/jobs.ts:1636-1647`); `BLENDER_RENDERS_AT_ONCE = 1` (231) | Second render refused, not queued |

### Area 3: resource governance

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Hardware detection | STUB/SCAFFOLD | `core/engines/manifests.ts:397` (`{ memoryBytes: totalmem(), gpu: false }`); `HostProfile` (110) | No GPU, VRAM, CPU, or disk-class detection. ComfyUI `vram_total` is display-only |
| VRAM budget | ABSENT | no VRAM field in `core/command/policy.ts` | `ENGINE_WORKER_PROFILE.gpu: "none"` (`core/process/owner.ts:49-59`) |
| RAM / process limits per worker | IMPLEMENTED+TESTED | `ENGINE_WORKER_PROFILE` (`core/process/owner.ts:49-59`); `checkProfile` (78-96); Job Object limits (`native/procd/src/main.rs:1037-1044`); `tests/engine-worker-profile.test.ts`, `tests/bounded-output.test.ts` | Windows only |
| Enforced resource policy | IMPLEMENTED+TESTED | `RESOURCE_POLICY.enforced` (`core/command/policy.ts:13-104`); hash exposed (`core/command/registry.ts:211`; `server/api.ts:40-61`); `tests/resource-policy.test.ts` | Header 5-12: "not a founder approval" |
| Qualification memory budget | STUB/SCAFFOLD | `core/command/policy.ts:90` (`serviceMiB: 300, maxShareOfRam: 0.5`) | Marked "Not enforced at run time" |
| Founder-approved qualification thresholds | IMPLEMENTED | `core/qualification-policy.ts:16-55` | Performance thresholds only; "freezes no memory or resource ceiling" (7) |
| Disk reserve | IMPLEMENTED+TESTED | `diskReserveBytes` 256 MiB; statfs preflights (see module map) | Consistent across store, jobs, proxies, peaks, preview, recovery, Kaggle download |
| Concurrency limits | IMPLEMENTED+TESTED | `activeJobs` 128, `activeRenderWorkers` 1, `activeConversionsPerProject` 4 (`core/command/policy.ts:13-104`); admission at `core/jobs.ts:349-375` | |
| Agent budget ceiling | IMPLEMENTED | `budgetFor` (`core/store.ts:618-621`) | Agents get half the workspace byte budgets |
| Download approval gate ("no unapproved model downloads") | ABSENT as a mechanism | No downloader in the service. `WEIGHTS_ABSENT` message "Yamakan never downloads them" (`core/engines/reasons.ts:10-11`); `scripts/blender-install.ts:2-3` | Holds by absence. Excluded donor downloaders: `docs/provenance/import-policy.json:284-287`. Weights for the live route download on Kaggle, not locally (`scripts/kaggle/wan22-ti2v-5b/run.py:218-223`) |
| Spending gate ("zero unapproved spending") | ABSENT as a mechanism | `ROUTER_PROVIDERS_ENABLED = false` (`core/router/explain.ts:10`); asserted by `scripts/ultimate-baseline.mjs:12-13, 18-19, 379` and `scripts/qualify-quality-lab.mjs:29` | Holds by absence of paid-provider code. No quote, reservation, budget, or spend ledger |
| Remote quota accounting (Kaggle GPU hours) | ABSENT | push-refusal regex detects quota/401/403/429 (`core/engines/kaggle.ts:308-312`) | No pre-run quota check; one run per notebook guard only (`assertFree`, 1067-1133) |

### Area 4: security boundaries

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Worker process isolation (Windows) | IMPLEMENTED+TESTED (locally) | `native/procd/src/main.rs:1-44, 922-927, 1037-1044, 1113-1136, 1157, 1358-1361`; `native/procd/src/container.rs:51-59, 160-165`; `tests/containment.test.ts`, `tests/process-owner.test.ts`, `tests/sandbox.test.ts`, `tests/hostile-media.test.ts` | Not run on Windows in CI (`.github/workflows/qualify.yml:88-114`, comment at 89) |
| Worker process isolation (POSIX) | STUB/SCAFFOLD | `#runPosix` (`core/process/owner.ts:467-507`); ownership mode "posix-unqualified" | CI main job runs on ubuntu-24.04 |
| Executable allowlist and hash pinning | IMPLEMENTED+TESTED | `core/process/workers.ts:20-29, 39-78`; `tests/ffmpeg-companions.test.ts`, `tests/bundle.test.ts` | FFmpeg and companion DLLs checked at run time |
| Kaggle CLI containment | ABSENT | `kaggleCli` uses `execFile` (`core/engines/kaggle.ts:270-304`); allowlisted in `docs/provenance/import-policy.json:319-324` | Runs outside procd with network and the person's credentials; environment allow-list only (202-238) |
| Path / filesystem policy | IMPLEMENTED+TESTED | `safePath` (`core/paths.ts:3-27`); `restrictToOwner` (`core/process/access.ts:59-73`; `server/main.ts:103-115`); per-worker capability SID grants revoked after run (`native/procd/src/main.rs:1358-1361`); `tests/access.test.ts` | Kaggle work folders live under OS temp (`core/engines/kaggle.ts:551, 943-944`) |
| Network egress policy | IMPLEMENTED (structural, no policy engine) | Service binds `127.0.0.1` (`server/main.ts:736`); AppContainer without network capability; CSP (`server/main.ts:708-728`); ComfyUI loopback-only (`core/engines/comfyui.ts:99-117`) | The only egress is the Kaggle CLI. No allowlist of destinations, no per-route egress record beyond the generation ledger |
| Transport authentication | IMPLEMENTED+TESTED | `authenticate` (`server/main.ts:229-262`); Host/Origin checks (342-349); launch secret (`core/launch.ts`); `tests/http.test.ts`, `tests/server-body.test.ts` | |
| Service proof (client verifies service before sending a token) | IMPLEMENTED+TESTED | `sdk/service-proof.ts:37-52`; `sdk/client.ts:69-74, 84-126`; `GET /api/v1/hello` (`server/main.ts:353-368`); `tests/service-proof.test.ts` | |
| Secrets storage | IMPLEMENTED (file + ACL only) | `randomBytes(32)` tokens (`server/main.ts:128-130`); `writeSecret("token", cliToken)` (132-140) | No OS keychain/DPAPI. Residual: any same-account process can read the token (`docs/SECURITY.md:31`) |
| Agent tokens | IMPLEMENTED+TESTED | `agent_tokens` (`core/store.ts:266-273, 428-431`); `createAgentToken` (3884-3910), `revokeAgentToken` (3988-3997), `principalForAgentToken` (3998-4024); `core/agents.ts:11-39`; `tests/agent-access.test.ts`, `tests/agent-principals.test.ts`, `tests/agent-token-lifecycle.test.ts` | Hashed at rest, scoped, expiring, revocable; UI `src/agent-access.tsx:75, 106, 119` |
| Scope model and human-only commands | IMPLEMENTED+TESTED | `Scopes` (`core/command/registry.ts:215-227`); `HumanOnlyScopes` (230-236); `assertAgentScopeCeiling` (241-248); `authorize` (2930-2942) | Agents cannot start, cancel, import, or dismiss a generation, grant consent, or create agents |
| Per-action approval of agent requests by a human | ABSENT | no approval-queue table or command found | Human-only is a hard refusal, not an approve-then-run flow |
| Likeness consent | IMPLEMENTED+TESTED | `likeness_consents`, `consent_revocations`, `consent_revalidations` (`core/store.ts:385-406`); `grantConsent` (`core/director/runtime.ts:243-307`), `assertConsentUsable` (170-185); `tests/continuity-consent.test.ts`, `tests/identity.test.ts`; `consent.grant` browser-only (`core/command/registry.ts:2216`) | |
| Send consent | IMPLEMENTED+TESTED | `assertMaySend` (`core/continuity.ts:535-576`); `send_consent_covers` (`core/store.ts:455-459`) | Checked before send, before import, after copy. Hash-based: "cannot tell who a still shows" (`core/continuity.ts:473-474`) |
| MCP permission model | IMPLEMENTED+TESTED | `mcp/main.ts:15-35, 114-145, 263-283`; `tests/mcp.test.ts`, `tests/mcp-transport.test.ts` | Bypass env `YAMAKAN_MCP_LOCAL_CLIENT=1` grants local-client scopes |
| Blender worker | IMPLEMENTED+TESTED | `BLENDER_PIN` (`core/blender/runtime.ts:12-31`); `verifyBlenderForRun` (180-207); `tests/blender-render.test.ts` | Residual noted at `core/blender/runtime.ts:177-178` |
| SBOM | IMPLEMENTED+TESTED (partial coverage) | `scripts/sbom.mjs:28-74, 97-110`; CI `.github/workflows/qualify.yml:48` | npm runtime deps and vendored FFmpeg only |
| Third-party notices | IMPLEMENTED+TESTED | `NOTICE`; `notices/` (23 files); required-notice check `scripts/provenance.mjs:73-100` | |
| Dependency audit | IMPLEMENTED | `npm audit --audit-level=high` (`.github/workflows/qualify.yml:52-73`); monthly (`provenance-security-monthly.yml:36`) | FFmpeg CVE review is a manual echo step (37-39) |

### Area 5: licensing and provenance tooling

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Source import ledger | IMPLEMENTED+TESTED | `docs/provenance/imports.json` (404 entries); verified by `scripts/provenance.mjs:59-70`; `tests/provenance.test.ts`; CI `qualify.yml:46` | Each entry: source, pinned 40-hex sha, original, imported, sha256, importedSha256, license, authorization, owner, tests |
| Deny-by-default import guard | IMPLEMENTED+TESTED | `scripts/import-guard.mjs:80-187` | Self-described "tripwire over source text, not a sandbox" (1-4); regex-based |
| Process-spawn allowlist | IMPLEMENTED+TESTED | `docs/provenance/import-policy.json:319-324`; `scripts/import-guard.mjs:19-35, 125-156` | Only `core/process/owner.ts`, `core/process/access.ts`, `core/render.ts`, `core/engines/kaggle.ts` |
| Excluded paths / content hashes | IMPLEMENTED+TESTED | `docs/provenance/import-policy.json:232-318`; `checkExcludedContentHashes` (`scripts/import-guard.mjs:189-217`) | Explicitly excludes donor provider proxies, silent downloaders, second persisted authorities |
| Font ledger | IMPLEMENTED+TESTED | `scripts/provenance.mjs:102-123` | Hashes must equal those in `core/render/fonts.ts` |
| Upstream drift | IMPLEMENTED (report-only) | `scripts/provenance-drift.mjs`; monthly workflow with `|| true` (`provenance-security-monthly.yml:24-35`) | Never fails the build |
| Brand check | IMPLEMENTED+TESTED | `scripts/brand-check.mjs`; `tests/brand-check.test.ts`; CI `qualify.yml:49` | |
| SBOM for Rust crates (`native/procd`) | ABSENT | `scripts/sbom.mjs:28-74` | `Cargo.lock` not included |
| SBOM / notices for Blender | ABSENT in SBOM; noted in `NOTICE:56-65` | | Not redistributed |
| SBOM for Kaggle-side Python packages | ABSENT | `scripts/kaggle/wan22-ti2v-5b/run.py:34-42, 200-202` | Version-pinned, not hash-pinned; recorded only in the run receipt |
| Model licence gate | STUB/SCAFFOLD (local); IMPLEMENTED (Kaggle constants) | `ACCEPTED_MODEL_LICENSES` (`core/engines/manifests.ts:35-40`); recipe `licence` field (`core/engines/kaggle.ts:63-126`); `RIGHTS_UNQUALIFIED` reason (`core/engines/reasons.ts`) | No model notices file, no model SBOM, no per-output licence record beyond receipt |
| AGPL source-offer in UI | DOC-ONLY | `NOTICE:43-46` promises an About-view link "when Director UI lands"; grep for `AGPL|source-offer` in `src` found nothing | 4 AGPL-3.0 ledger entries (`docs/provenance/imports.json:1089, 1107, 1124, 1152`) |
| `manifest.json` / `validation.json` | Stale planning artifacts | `manifest.json` (`planningBranch`, `status: "final planning proposal; founder approval pending"`); `validation.json:6, 11-12` | Base commits differ from HEAD; `manifestFilesVerified: 0`; not checked in CI; not code or model provenance |

---

## (d) Existing authorities a new plan must NOT duplicate

| Authority | Owner type / file | Entry points | Why it is the authority |
|---|---|---|---|
| **Project and workspace store** | `ProjectStore`, `core/store.ts` (4025 lines); schema `WORKSPACE_SCHEMA_VERSION = 18`, `SNAPSHOT_FORMAT = "yamakan.project/2"` (180-183) | `importAsset`; `registerDerivative` (3723-3737); `events()` (3872-3883); revisions (600), outbox (609); `asset_objects`/`asset_versions` (190-204); `asset_replacements` (464-475) | Sole writer of the workspace SQLite DB; content-addressed media via `core/storage/storage.ts` (`StorageProvider`, `LocalContentAddressedStorage`). `core/legacy-store.ts` is a migration source, not a peer |
| **Job authority** | `JobSupervisor`, `core/jobs.ts:261`; constructed once at `server/api.ts:35`; started at `server/main.ts:189` | `submit` (512-559), `submitBatch` (566-665), `submitBlenderRender` (1576-1662), `submitBlenderTrack` (1666-1752), `submitDerivative` (2214-2287), `generationLedger()` (339-463), `status` (736-740), `list` (742-750), `retry` (754-779), `discard` (781-816), `cancel` (818-848), `close()` (2326-2330) | Only component that writes `jobs`/`attempts`/`supervisor`; owns fencing and the transition table. Generation runs are already rows here (`remote-generation`) |
| **Command registry** | `commands`, `core/command/registry.ts` | `execute` (2944-2973), `catalog` (2975-2984), `resolveOperation` (2919-2928); HTTP `GET /api/v1/tools`, `POST /api/v1/call` (`server/main.ts:406-424`) | REST, CLI, MCP, and SDK all dispatch through it. `scripts/import-guard.mjs:1-4` names it "the enforcement boundary" |
| **Permission authority** | `authorize` (`core/command/registry.ts:2930-2942`); `Scopes` (215-227); `HumanOnlyScopes` (230-236); `assertAgentScopeCeiling` (241-248) | Transport: `authenticate` (`server/main.ts:229-262`); tokens: `createAgentToken`/`revokeAgentToken`/`principalForAgentToken` (`core/store.ts:3884-4024`) | Principal derives from transport, "never from the request" (258) |
| **Consent authority** | `core/director/runtime.ts` (`grantConsent` 243-307, `revokeConsentRecord` 313-335, `revalidateConsent` 338-373, `assertConsentUsable` 170-185); `core/continuity.ts` (`assertMaySend` 535-576, `assertLinkedMediaGeneratable` 482-531) | Commands `consent.grant` (2216), `consent.list` (2248), `consent.revalidate` (2265), `consent.revoke` (2276) | Append-only revocations/revalidations; `director_epoch` |
| **Process authority** | `ProcessOwner` (`core/process/owner.ts:203`); `yamakan-procd`; `workers()` (`core/process/workers.ts:136-142`) | `run()` (308-335) with a `WorkerProfile` | Only sanctioned way to spawn a contained worker. Kaggle CLI is the one deliberate exception |
| **Generation service and ledger** | `createGenerationService` (`core/engines/generation.ts:159-625`); `GenerationLedger` (99-109); durable implementation `JobSupervisor.generationLedger()` | `start`, `status`, `cancel`, `list`, `dismiss`, `importResult`; selection in `generationOf` (`core/command/registry.ts:309-359`) | Holds the egress, consent, never-resend, and verified-import rules in one place |
| **Resource policy** | `RESOURCE_POLICY` (`core/command/policy.ts:13-104`); `RESOURCE_POLICY_HASH` (`core/command/registry.ts:211`) | Advertised in catalog (`server/api.ts:40-61`) | Single source for enforced limits |
| **Code provenance ledger** | `docs/provenance/imports.json`, `import-policy.json`; `scripts/provenance.mjs`, `scripts/import-guard.mjs` | `npm run provenance:check` (`package.json:24`) | CI gate for any imported third-party source |
| **Render plan** | Canonical render plan with `plan_hash` and attempt `receipt` (`core/store.ts:249-252`) | via export/job commands | Out of this report's scope; noted because `docs/provenance/import-policy.json:314-316` excludes competing export authorities |

---

## (e) Extension points

### Operation-based adapter contract

- **Attach at**: `EngineAdapterV2` (`core/engines/contract-v2.ts:359-382`) and the `Operation` enum (34-40).
- **Already there**: request schema with limits, typed refusals (`RefusalReason`, 212-225), execution status, cancellation with `remoteOutcome` and `billingOutcome`, artifact enumeration and verified read (`readArtifactVerified`, 504-530), `reconcile`, optional `location()` used to decide whether data leaves the computer.
- **Missing**: `quote`/`estimate`, `validate` (dry run), per-operation input/output descriptors beyond video, async webhooks, streaming partials. `GenerationRecipe` (`core/engines/generation.ts:28-33`) and `bringIn` (218-225, "exactly one video/mp4") are hard-wired to video output; any new operation (image, audio, upscale) needs both widened.
- **Selection point**: `generationOf` (`core/command/registry.ts:309-359`) is an if/else over Kaggle then ComfyUI, with one `WeakMap` per adapter. A multi-adapter plan needs an adapter registry here; this function is where it goes.

### Capability discovery

- **Attach at**: `discoverEngineCapabilities` (`core/engines/manifests.ts:367-411`) and `CapabilityV2Schema` (`core/engines/contract-v2.ts:251-269`); command `yamakan.engines.capabilities` (`core/command/registry.ts:2606`); UI caller `src/main.tsx:2375`.
- **Already there**: honest-absence reporting with typed reasons (`core/engines/reasons.ts:6-15`), `underClaim` (`contract-v2.ts:486-498`), host profile parameter.
- **Gap to close**: the live route does not use it. Kaggle returns `capabilities: () => []` (`core/engines/kaggle.ts:1179`) and is described by a separate command, `yamakan.generation.options` (`core/command/registry.ts:2423-2453`). A new plan should unify these so one discovery call covers every adapter.

### Provenance

- **Attach at**: `GenerationLineage` (`core/engines/generation.ts:52-61`) written in `bringIn` (227-245); `store.importAsset` call (297-302); Kaggle receipt validation (`core/engines/kaggle.ts:691-811`).
- **Already there**: output hash, input asset ids and hashes, recipe id and hash, model manifest hash, seed, prompt hash; receipt with model, revision, licence, packages. Related store tables: `asset_replacements` (`core/store.ts:464-475`), derivative lineage (`registerDerivative`, 3723-3737), render `plan_hash` and attempt `receipt` (249-252).
- **Missing**: lineage is not attached to the asset record itself, so it does not travel with the asset through backup, export, or project interchange in any way I could confirm; there is no asset-level AI-generated flag; no embedded metadata or C2PA manifest.

### Estimates (time, cost, resources)

- **Attach at**: `yamakan.generation.options` (`core/command/registry.ts:2423-2453`) and `explainRoutes` (`core/router/explain.ts:39-83`); design text at `docs/OPERATIONAL_CONTRACTS.md:188-196` and `docs/COST_ROUTER.md`.
- **Already there**: `expectedSeconds` and `timeoutSeconds` per recipe; router input schema with `remainingBudgetMinor` (unused); `billingOutcome` in the cancellation schema; disk reserve checks.
- **Missing**: an adapter `quote` method, a budget/reservation/spend ledger table, any money or quota units, VRAM/RAM requirements matched against a real host profile.

### Retries

- **Attach at**: `#execute` (`core/jobs.ts:1100-1180`), `retry` (754-779), `MAX_INTERRUPTIONS` (135); error taxonomy `core/command/errors.ts:21-36` (retryable: BUSY, UNAVAILABLE).
- **Already there**: interruption counting, `reconciliationRequired` state, manual `job.retry` and `job.discard`, idempotency keys, cancel-wins compare-and-set. Unused donor rules with `TRANSIENT_ERRORS` and `classifyFailure` (`core/jobs/rules/jobs.ts:39-47, 80`) could be adopted or deleted.
- **Hard rule to preserve**: a generation that may have left the machine is never resent automatically (`core/engines/generation.ts:539-552`; `core/jobs.ts:754-779`). Any retry design for paid or remote routes must keep this, or pair retries with provider-side idempotency keys.

### Resource governance

- **Attach at**: `HostProfile` (`core/engines/manifests.ts:110, 397`), `WorkerProfile` / `checkProfile` (`core/process/owner.ts:30-96`), `RESOURCE_POLICY` (`core/command/policy.ts`).
- **Needed for local models**: a GPU-capable worker profile (current engine profile is `gpu: "none"`, `network: "none"`) with its own containment qualification; real GPU/VRAM detection; a download-approval object if weights are ever fetched locally.

### Credentials

- **Attach at**: nothing exists. `docs/SECURITY.md:11` defers this to "a qualified secret service". The only precedent is passing `KAGGLE_*` environment variables through to the person's own CLI (`core/engines/kaggle.ts:232-238`).

---

## (f) Doc-vs-code discrepancies

| # | Document claim | Code reality |
|---|---|---|
| 1 | `README.md:22`: "No paid inference, cloud account or model weights are used." | A cloud account (Kaggle) is used by the live generation route when configured (`server/main.ts:168-186`; `core/engines/kaggle.ts`). "No paid inference" remains true |
| 2 | `docs/OPERATIONAL_CONTRACTS.md:210`: "`ENGINE_ENABLED` stays false, and nothing routes v2 requests from the command surface yet" | `yamakan.generation.start` routes v2 requests to the Kaggle adapter (`core/command/registry.ts:2387-2421, 311-331`). `ENGINE_ENABLED` is still false but does not gate this route |
| 3 | `specs/CURRENT.md`: engines/providers disabled; no mention of Kaggle | Same as above. Grep found no "Kaggle" in `README.md`, `specs/CURRENT.md`, `docs/OPERATIONAL_CONTRACTS.md`, or `docs/SECURITY.md` |
| 4 | `docs/SECURITY.md:17`: provider egress/spend controls come "Before any provider activation" | An egress route is active without the described controls; it has its own consent and disclosure controls instead. The decision is recorded only in `docs/FOUNDER_DECISION_RECORD.md:147-173` |
| 5 | `core/command/registry.ts:299-302` (code comment): the generation service "is built ... only when this build has a qualified recipe and a person named a ComfyUI to use" | Stale: the Kaggle branch (311-331) is built without either |
| 6 | `docs/MODEL_CAPABILITIES.md:7, 11`: GenerationRequest v1 with 13 operations; adapter interface "describe -> validate -> quote -> submit -> poll/cancel/reconcile -> collectOutputs" | Code has v2 with 5 operations (`core/engines/contract-v2.ts:34-40`), no `describe`/`validate`/`quote` methods |
| 7 | `docs/SECURITY.md:13`: engine-worker profile "up to 8 processes" | `ENGINE_WORKER_PROFILE.maxProcesses: 4` (`core/process/owner.ts:49-59`); 8 is the `checkProfile` ceiling (78-96). `docs/SECURITY.md:43` says "at most 4" |
| 8 | `NOTICE:43-46`: the About view "will carry the AGPL source-offer link when Director UI lands" | Director UI exists (`src/director/DirectorPanel.tsx`, `src/director/CinemaShot.tsx`); no `AGPL` or source-offer string found in `src` |
| 9 | `docs/COST_ROUTER.md`, `docs/ARCHITECTURE_DECISION.md` ("Capability and cost router", "Entitled BYOK adapter") | Router is a stub returning no eligible routes (`core/router/explain.ts:39-83`); no BYOK code |
| 10 | `docs/LOCAL_INFERENCE.md`, `docs/MANAGED_COMFYUI_MODE.md` | Correctly labelled as not enabled / proposed. No discrepancy, listed for completeness |
| 11 | `manifest.json`, `validation.json` (`status: "PASS"`) | Refer to an old planning branch and base commits; `manifestFilesVerified: 0`. A reader could mistake them for a current integrity attestation |
| 12 | `docs/FOUNDER_DECISION_RECORD.md:175-179` standing rule: "no engine enabled without its own real qualification" | Kaggle recipes are all `offered: true` (`core/engines/kaggle.ts:63-126`) with receipts in `docs/evidence/ultimate/`. Consistent in spirit, but the qualification here is per-recipe evidence files, not the `PINNED_MODEL_MANIFESTS` / `candidates.ts` mechanism the contracts describe |
| 13 | `README.md:26` describes `manifest.json`/`validation.json` as the planning package | Accurate, but the package is stale relative to HEAD |

---

## (g) Risks and technical debt

### Duplicated or competing abstractions

1. **Two adapter contracts plus a bridge**: v1 `EngineAdapter` (`core/engines/contract.ts:67-74`), v2 `EngineAdapterV2` (`contract-v2.ts:359-382`), `bridgeV1` (`v1-bridge.ts:159`). Only v2 is live.
2. **Six model/recipe registries**: `PINNED_MODEL_MANIFESTS` (`manifests.ts:108`, empty), `PINNED_COMFY_RECIPES` (`comfyui.ts:96`, empty), `KAGGLE_RECIPES` (`kaggle.ts:63-126`, live), `SERVER_RECIPES` (`v1-bridge.ts:76-135`, fake), `candidates.ts` + `docs/evidence/ultimate/engine-candidate-manifests.json` (evidence), `docs/evidence/yamakan/provider-registry.json` (research). A seventh UI-side list exists in `src/create/create-model.ts` (not read in detail).
3. **Two capability reports**: `yamakan.engines.capabilities` versus `yamakan.generation.options`; the live adapter's own `capabilities()` returns `[]`.
4. **Two fencing mechanisms**: in-memory `AttemptFence` (`contract-v2.ts:420-481`, used by ComfyUI and the bridge) versus the durable supervisor generation (`core/jobs.ts:964-983`). The generation service passes `leaseGeneration: 1` as a constant (`generation.ts:483`); the Kaggle adapter uses no `AttemptFence`.
5. **Two generation ledgers**: `memoryLedger()` (`generation.ts:123-141`, used by the ComfyUI branch) versus `JobSupervisor.generationLedger()` (`core/jobs.ts:339-463`, used by Kaggle). If ComfyUI were enabled as-is, its runs would not survive a restart.
6. **Generation is a job that the job system does not drive**: `remote-generation` rows are not claimed by the pump; `job.cancel` and `job.retry` refuse them; control lives in separate `generation.*` commands. Two control vocabularies for one table.
7. **Two job state machines in the tree**: Yamakan's (`yamakan-transitions.ts`) and the donor Gomrey one (`core/jobs/rules/jobs.ts:11-47`) with checkpoint/suspend states and transient-error classification that nothing uses.
8. **Two policies with different authority**: `RESOURCE_POLICY` (enforced, "not a founder approval") and `QUALIFICATION_POLICY` (founder-approved, enforces no resource ceiling).
9. **Two things called lineage**: `GenerationLineage` (media) and `core/agents/lineage.ts` (review independence).
10. **Legacy pairs**: `legacy-store.ts`, director-legacy, documents-legacy, `LegacySchema` envelope (`core/command/envelope.ts:23-28`), `darzain.*` aliases and `DARZAIN_*` environment names.
11. **Receipts in three tables**: `command_receipts`, `recovery_receipts`, `director_requests`, plus job attempt receipts.

### Security and privacy risks

12. **Kaggle CLI runs uncontained** with network access, the person's Kaggle credentials, and inherited proxy/CA variables (`core/engines/kaggle.ts:202-238, 270-304`). This is third-party Python code executed outside procd. The import-guard allowlist entry documents the intent (`docs/provenance/import-policy.json:108-109, 323`).
13. **Supply chain on the remote side**: the notebook `pip install`s version-pinned but not hash-pinned packages with internet enabled (`scripts/kaggle/wan22-ti2v-5b/run.py:34-42, 200-202`; `core/engines/kaggle.ts:1271-1287`). Output integrity is checked by hash against a receipt produced by the same remote environment, so the receipt proves consistency, not trustworthiness.
14. **Data that leaves cannot be recalled**: revoking consent cannot reach the Kaggle notebook history (`docs/FOUNDER_DECISION_RECORD.md:166`; disclosed at `src/i18n.ts:31`).
15. **Consent is hash-based**: media not linked to a pack passes on the person's `noUnconsentedPerson: true` attestation (`core/command/registry.ts:2409-2411`; `core/continuity.ts:473-474`); the "fictional" mark is "a statement in the record, not a gate".
16. **Remote runs cannot be cancelled** and consume quota until timeout (`core/engines/kaggle.ts:1357-1370`).
17. **Token at rest is a file readable by any same-account process** (`docs/SECURITY.md:31`); `YAMAKAN_MCP_LOCAL_CLIENT=1` bypasses agent tokens for MCP (`mcp/main.ts:19-35`).
18. **Containment is unverified in CI**: Windows job runs only bundle, FFmpeg companion, and typography tests (`.github/workflows/qualify.yml:88-114`); the main test job runs on Linux in "posix-unqualified" mode.
19. **A personal Kaggle account id is committed** in `scripts/kaggle/wan22-ti2v-5b/kernel-metadata.json` (runtime uses `YAMAKAN_KAGGLE_USERNAME` instead).
20. **Kaggle work folders are in the OS temp directory** (`core/engines/kaggle.ts:551, 943-944`), outside the ACL-restricted workspace root.

### Governance gaps

21. **Spending and download gates are properties of what is absent**, guarded by constants and scripts. The first paid adapter or downloader added would have no gate to pass through. This is the largest structural gap relative to the stated guardrails.
22. **No VRAM or GPU model**; `gpu: false` is hard-coded as the default host profile. The documented dev host has no discrete GPU (`docs/LOCAL_INFERENCE.md`; `docs/evidence/ultimate/product-matrix.md:31`), which is why the live route is remote.
23. **No quota accounting** for the free Kaggle GPU allowance.
24. **Scheduler is one sequential loop**; Blender refuses rather than queues; `job.list` is global.
25. **No automatic retry** and an error taxonomy with only two retryable codes.
26. **Progress is polling only**; MCP ignores cancellation notifications.

### Licensing risks

27. **AGPL-3.0 translated modules** (4 ledger entries) inside a GPL-3.0-or-later distribution, with the promised UI source offer not found.
28. **Skelet-derived code with no upstream licence** (`LicenseRef-NoUpstreamLicenseFile`, `docs/provenance/imports.json:372, 391`; `NOTICE:20`), resting on founder attestation. Same for Gomrey and Ascout (`NOTICE:48-54`).
29. **Unverified founder statement about ComfyUI copying rights** (`docs/FOUNDER_DECISION_RECORD.md:144`); no ComfyUI code is copied today.
30. **SBOM coverage gaps**: Rust crates, Blender, remote Python packages, model weights.
31. **Model licence handling is a string field** on a hard-coded recipe; `ACCEPTED_MODEL_LICENSES` is not applied to the live route.
32. **Upstream drift and FFmpeg CVE review are non-blocking/manual**.

### Size and maintainability

33. `core/command/registry.ts` (3078 lines), `core/store.ts` (4025), `core/jobs.ts` (2377), `core/engines/kaggle.ts` (1385) are large single files; the registry mixes dispatch, authorization, and per-command business logic.
34. `core/engines` is listed as a donor root (`docs/provenance/import-policy.json:3-18`), so every new engine file must be declared in `localFilesInDonorRoots` or the provenance check fails.

---

## (h) Questions not answerable from the code (and what was not read)

### Open questions

1. Is the omission of Kaggle from `README.md`, `specs/CURRENT.md`, `docs/OPERATIONAL_CONTRACTS.md`, and `docs/SECURITY.md` intentional (founder-only route) or documentation lag?
2. Is the Kaggle route meant for anyone other than the founder? It requires a locally installed Kaggle CLI, an account, and two environment variables; there is no in-product setup beyond a hint string (`src/i18n.ts:27`).
3. Do the Windows containment tests (`tests/containment.test.ts`, `tests/process-owner.test.ts`, `tests/sandbox.test.ts`) run anywhere automated, or only on the founder's machine?
4. Does the AGPL source offer exist somewhere outside `src` (for example a served static page or bundle script)? I searched `src` only.
5. Do all tests pass at HEAD? Nothing was executed.
6. Does `GenerationLineage` survive backup/restore and project export alongside the asset? `tests/generation-durable.test.ts` mentions backup/restore in its header, but I did not read the body.
7. What Kaggle Terms of Service constraints apply to driving private notebooks from a product, and to the outputs' commercial use? Not a code question, but the plan depends on it.
8. Was the founder's ComfyUI permission statement ever verified? The record marks it unverified.
9. What is the intended fate of the unused donor job rules (`core/jobs/rules/jobs.ts`) and the v1 contract?
10. Is `QUALITY_LAB_ENABLED = true` exposed in the UI, and to what extent? Only the file head was read.
11. Which principal is intended to approve future paid or downloading actions: is "human-only hard refusal" the final model, or is an approval queue planned?
12. Are there other draft branches with provider adapters or a credential store? Out of scope here (covered by the separate PR/history assessment).

### Not read (so not verified)

- Test bodies, except the heads of `tests/engine-absence.test.ts`, `tests/kaggle-engine.test.ts`, `tests/generation-durable.test.ts`. All other "+TESTED" marks rest on file existence and names.
- `sdk/progress.ts`; `mcp/framing.ts`; `cli/migrate.ts`, `cli/open.ts`, `cli/recovery.ts`.
- `native/procd/src/bin/yamakan-acl.rs`, `native/procd/src/bin/worker-probe.rs`; most of `native/procd/src/main.rs` and `container.rs` beyond the cited ranges.
- `scripts/bundle.ts`, `scripts/browser-e2e.mjs`, and most `scripts/qualify-*` scripts.
- `core/identity.ts` body; `core/quality/benchmark.ts`; the remainder of `core/quality/lab.ts`, `core/audio/transcription.ts`, `core/recovery.ts`, `core/durable.ts`, `core/storage/storage.ts` beyond their heads.
- `docs/provenance/excluded-content-hashes.json`, `fonts.json`, `donor-clones.json`, `brand-terms.json`, `REBRAND_INVENTORY.md`; `docs/SOURCE_REUSE_LEDGER.md`.
- `docs/OPERATIONAL_CONTRACTS.md` lines 1-83 and 364-950 (headings only).
- Remaining lines of `core/engines/fake.ts`, `v1-bridge.ts`, `candidates.ts`, `clean-image.ts`.
- `scripts/kaggle/cogvideox-2b/` and `scripts/kaggle/wan22-ti2v-5b-first-frame/` scripts.
- `src/create/*` component bodies (only their wiring in `src/main.tsx` was traced).
