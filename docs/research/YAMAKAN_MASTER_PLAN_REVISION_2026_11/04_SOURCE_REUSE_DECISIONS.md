# Copy, reuse, integrate or build: decisions and licence evidence

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document decides, for every card in [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md), whether
Yamakan copies, adapts, wraps, combines or builds, and records licence evidence for every model
and runtime the research notes assess. It is an engineer's reading of published texts and
repository records. **It is not legal advice**; legal questions are in section 7 (FD-5).
Routing is in [07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md); gates are
in [11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md).

Labels: `[DOC]` first-party page or licence text, `[CLAIM]` vendor marketing, `[IND]` third
party, `[ASSUMED]` our inference, `[UNKNOWN]` not established. R03, R05, R06, R07, R10 are the
research notes `03-pro-editors-blender-oss.md`, `05-video-image-models-providers.md`,
`06-audio-lipsync-consistency-eval.md`, `07-code-models-orchestration-security.md`,
`10-prs-history-active-work.md` (accessed 2026-11-11), kept with this package under
[evidence/research/](evidence/research/). Repository facts were read in a worktree at the
baseline; nothing was built or run.

## 1. Decision vocabulary

| Decision | Meaning | Record it carries |
|---|---|---|
| COPY | Third-party source enters the tree unchanged, under its licence. | Per file in `docs/provenance/imports.json`: `source`, 40-hex `sha`, `original`, `imported`, `sha256`, `importedSha256`, empty `modifications`, `license`, `authorization`, `owner`, `tests`; a `sourceNotices` row in `docs/provenance/import-policy.json`; licence text in `notices/`; a line in `NOTICE`. |
| ADAPT | Third-party source copied and modified. In the card table below, also an existing Yamakan module changed in place. | Third-party source: as COPY, with each change in `modifications` and `importedSha256` updated. Editing an already-ledgered file is ADAPT. Yamakan's own code: ordinary review. |
| WRAP | An unmodified external tool or runtime called across a process boundary (child process, CLI, loopback HTTP) with fixed arguments. In the card table below, also a browser control over an existing Yamakan command or operation; that use carries no pin and takes ordinary review. | Version and SHA-256 pin in code (`core/process/workers.ts` `PINNED_SHA256`, `core/blender/runtime.ts` `BLENDER_PIN`), a `NOTICE` entry, SBOM coverage if redistributed, a `processSpawnAllowlist` entry. |
| COMBINE | Join existing Yamakan modules. | Ordinary review. |
| BUILD | New Yamakan code; no suitable donor, or donors rejected. | Ordinary review; `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/03_SOURCE_QUALIFICATION.md` asks for a written comparison before BUILD replaces a qualified donor. |
| DEFER | Not now. | The trigger that reopens it. |
| REJECT | Not adopted. | The reason; an `excludedPaths` pattern or excluded hash where a path could be copied by accident. |

Rules for every card:

1. **No import without provenance and licence closure**: the licence of every copied file and
   its transitive dependencies is known and compatible with Yamakan's GPL-3.0-or-later
   distribution (`package.json` `license`; `NOTICE`). Unknown or conflicting means DEFER or
   REJECT, never an untracked copy. `npm run provenance:check` (`scripts/provenance.mjs`)
   enforces pins, hashes, reported modifications, ledger tests, required notices,
   `sourceNotices` mappings and the import guard.
2. **Donor roots are 14 directories**, not only `core/engines`: `core/animation`,
   `core/retime`, `core/timeline`, `core/jobs/rules`, `core/hash`, `core/storage`, `src/audio`,
   `src/editor`, `src/studio/canvas-engine`, `src/studio/workbench`, `src/studio/platform`,
   `src/cinema`, `core/director`, `core/engines` (`docs/provenance/import-policy.json` `donorRoots`). A new
   Yamakan file in any of them needs a `localFilesInDonorRoots` entry (31 exist today).
3. **No model weight is downloaded without a recorded founder decision (FD-4).** None is on the
   PC: `PINNED_MODEL_MANIFESTS` and `PINNED_COMFY_RECIPES` are empty
   (`core/engines/manifests.ts`, `core/engines/comfyui.ts`) and `yamakan.audio.transcribe`
   always throws `CAPABILITY_UNAVAILABLE` (`core/command/registry.ts`). CANDIDATE in section 4
   means "may be qualified after FD-4", not approved.
4. **A model needs its own closure**: weights, base model and bundled components (encoders,
   face detectors, VAEs) must all pass `ACCEPTED_MODEL_LICENSES` (`core/engines/manifests.ts`:
   `apache-2.0`, `mit`, `bsd-2-clause`, `bsd-3-clause`) (R06 §8; R05 E.6).

## 2. What Yamakan already reuses

From `docs/provenance/imports.json` (404 entries, 11 sources), `docs/provenance/import-policy.json`, `NOTICE`,
`notices/` (23 files), `vendor/ffmpeg-win64-r8/`, `docs/provenance/fonts.json`, `package.json`.

| Donor (pin) | Licence as recorded | Taken | Where | Obligation |
|---|---|---|---|---|
| invoke-ai/InvokeAI (`ffe9e1a9`) | Apache-2.0 | 333 files, 3 modified | `src/studio/canvas-engine`, `src/studio/workbench`, `src/studio/platform` | Licence and NOTICE (`notices/InvokeAI-*`). **Root `NOTICE` does not name InvokeAI**, the largest donor. |
| OpenCut-app/opencut-classic (`cf5e79e9`) | MIT | 34 files, all modified | `core/timeline`, `core/animation`, `core/retime`, `src/audio` | Copyright and licence; in `NOTICE`. |
| LudwigKienle/ai-video-production-editor (`752cd43d`) | GPL-3.0-or-later | 18 files, 6 modified | `src/editor/**`, `core/render.ts` | Source with the combined work; in `NOTICE`. |
| calesthio/OpenMontage (`9327439d`) | AGPL-3.0 | 4 files, translated | `core/director/manifest.ts`, `core/director/stages.ts`, `core/director/runtime.ts`; `assets/pipelines/framework-smoke.yaml` | AGPL source offer; promised in `NOTICE`, absent from the UI (section 6). |
| storytold/artcraft (`28a39a0d`) | Apache-2.0 OR MIT | 4 files | `src/cinema/camera/*`, `src/cinema/types/*` | Licences and NOTICE; marks not licensed. |
| mne03005-png/OpenVideoStudio (`175da996`) | Apache-2.0 | 3 files, translated | `core/identity.ts`, `core/identity-format.ts` | Licence and NOTICE; in `NOTICE`. |
| TheHalfMoon/Ninerr (`bec85aa7`) | Apache-2.0 | 2 files | `core/hash/*` | Licence; in `NOTICE`. |
| TheHalfMoon/Skelet (`5d477863`) | `LicenseRef-NoUpstreamLicenseFile`, founder-attested | 2 files | `core/storage/storage.ts`, a test | Rests on founder authorisation. |
| TheHalfMoon/Gomrey (`5f299a7a`) | Apache-2.0, founder-attested | 2 files, translated | `core/jobs/rules/jobs.ts`, a test | Licence and NOTICE. Only `IllegalTransition` is used; `classifyFailure`, `shouldRetry` are unused. |
| TheHalfMoon/Ascout (`ca6b6f51`) | Apache-2.0, founder-attested | 1 file, concepts | `core/agents/lineage.ts` | Licence and NOTICE. |
| ThaUnknown/jassub (`dea3d2d3`) | LGPL-2.1-or-later AND (FTL OR GPL-2.0-or-later) AND others | Licence file; npm 2.5.20 unmodified | `notices/jassub-*` | LGPL replaceability; GPL-2.0-or-later elected for FreeType. |
| npm runtime packages | mediabunny MPL-2.0; soundtouchjs LGPL-2.1; most MIT; transitive `rvfc-polyfill` GPL-3.0 | Unmodified | build output | mediabunny, soundtouchjs, jassub are in `NOTICE`; three, react, zod, ag-psd, perfect-freehand and `rvfc-polyfill` are only in the SBOM. |
| D3voz/openjutsu (`7fe118bb`) | MIT | No file; setup check rewritten | `core/engines/comfyui.ts` | `notices/openjutsu-LICENSE` mapped; not in `NOTICE`. |
| YouMind ai-image-prompts-skill (`7a1233b5`) | MIT | 11 category slugs and titles | `core/prompts/library.ts` | Licence file; in `NOTICE`. |
| IBM Plex Sans Arabic (npm 0.4.2) | OFL-1.1 | 2 fonts, hash-pinned | `assets/fonts/*` | `notices/IBM-Plex-Sans-Arabic-OFL.txt`; hashes match `core/render/fonts.ts`. |
| **FFmpeg 7.1.5, vendored** | GPL-3.0-or-later build (`--enable-gpl --enable-version3`, libx265) per `vendor/ffmpeg-win64-r8/README.md`, `vendor/ffmpeg-win64-r8/BUILD.json` | `ffmpeg.exe`, `ffprobe.exe`, 24 DLLs incl. `libx264-165.dll`, `libx265-217.dll`; libass 0.17.3 | `vendor/ffmpeg-win64-r8/` | GPL source or written offer (section 6). Recorded: tarball hash, signer key, `scripts/vendor/build-ffmpeg-win64-r8-msys2.sh`, MSYS2 versions; the notice's component list is "non-exhaustive". Pinned by `assertPinned` (`core/process/workers.ts`) and `EXTERNAL_BINARY_PINS` (`scripts/bundle.ts`). |
| **Blender 5.3.0, pinned, not redistributed** | GPL-3.0-or-later as distributed (`NOTICE`) | Nothing; the person runs `npm run blender:install` | `BLENDER_PIN` (zip, exe, listing, code, tree hashes); `scripts/blender/yamakan_render.py`, `scripts/blender/yamakan_track.py` | Trademark wording "Rendered with Blender" (`src/i18n.ts`); `bpy` scripts must be GPL-compatible, which Yamakan is (R03 §4.8). 5.2 is the LTS line to July 2028 [DOC] R03 §4.1. |
| whisper.cpp 1.9.5 (`d1be6fde`) | MIT per `core/audio/transcription.ts` `WHISPER_CPP` | Output format inspected; nothing shipped | Contract only | None yet; WRAP candidate (MPR-221). |
| OpenTimelineIO 0.18.1, CI only | Apache-2.0 [DOC] R03 §7 | Hash-pinned wheel as read-only oracle | `scripts/ci/otio-requirements.txt`, `scripts/otio-oracle.py`, job `otio-oracle` | Not shipped. |
| Kaggle-route models | Apache-2.0 per `KAGGLE_RECIPES` (`core/engines/kaggle.ts`) and `docs/evidence/ultimate/engine-candidate-manifests.json` | Wan2.2-TI2V-5B-Diffusers `b8fff731`, CogVideoX-2b `1137dacf`, downloaded on Kaggle | `scripts/kaggle/*/run.py` | Kaggle-side packages version-pinned (`==`), not hash-pinned; outside the SBOM. |

Rejected donor paths stay excluded: 17 `excludedPaths` patterns (unsafe Electron shells,
cookie and session clients, TLS spoofing, silent model downloaders, aggregator proxies, second
authorities) and 26 hashes in `docs/provenance/excluded-content-hashes.json`.

## 3. Decision per task card

Most cards join or extend Yamakan's own modules, and the table says so. "Yamakan" means
Yamakan-authored, GPL-3.0-or-later. As in the cards' `sourceDecision` fields, ADAPT here also
covers extending an existing Yamakan module or pattern in place, and WRAP also covers page
controls over existing operations; the records of section 1 apply only where third-party
source or an external tool is involved. Editing a ledgered donor file needs the ADAPT record
of section 1 whatever the decision word; the licence cell names each such file.

| Card | Decision | Source to reuse | Licence evidence | Why |
|---|---|---|---|---|
| MPR-001 | BUILD | Entry format of `docs/FOUNDER_DECISION_RECORD.md`; section pattern of `specs/CURRENT.md` | Yamakan | Documentation after FD-1; nothing imported. |
| MPR-002 | BUILD | Listed `docs/*.md`; `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md` | Yamakan | Banners and an index, written from the repository's own files. |
| MPR-003 | ADAPT | `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/tools/validate-plan.mjs`; `.github/workflows/qualify.yml` | Yamakan | The existing validator's states and self-test pattern are reused; nothing from outside. |
| MPR-010 | ADAPT | `core/continuity.ts` `assertPlacementConsent`, `assertLinkedMediaNotRevoked`, `linksOf`; test patterns of `tests/story-packs.test.ts`, `tests/continuity-consent.test.ts` | Yamakan | Extends the existing commit-point check; `core/identity.ts` is not a target, and nothing comes from outside. |
| MPR-101 | BUILD | `core/documents.ts`; `core/story.ts` `TakeLineageSchema`; `core/engines/generation.ts` lineage | Yamakan | No donor models a generation record. |
| MPR-102 | ADAPT | `core/engines/generation.ts` `createGenerationService`; `core/jobs.ts` `generationLedger`; `core/store.ts` `commitDocument`; `yamakan.generation.start`, `yamakan.generation.import` | Yamakan | One optional target field and one append step on existing commands; no new command. |
| MPR-103 | BUILD | MPR-101 records; `yamakan.take.proposeReplace`, `yamakan.take.apply` (`core/takes.ts`), reused unchanged | Yamakan | A small read command and one diff function; the existing compare-and-apply path places the take. |
| MPR-104 | BUILD | `src/create/GeneratePanel.tsx`, `src/director/TakeReview.tsx`; SS-011 | Yamakan | Thin views over existing read commands; no SS-011 duplicate. |
| MPR-105 | ADAPT | `core/takes.ts` `shotClip`, `proposeReplace`; `core/timeline/operations.ts`, unchanged | Yamakan | Generalise in place. |
| MPR-106 | BUILD | `core/story.ts`, `STORY_LIMITS`; `yamakan.story.save` | Yamakan | Bounded fields in the one story; no new command or document kind. |
| MPR-107 | BUILD and COMBINE | `core/takes.ts` `listTakes`; MPR-101 take records; the job ledger in `core/jobs.ts`; `core/store.ts` `revisions`, `command_receipts` | Yamakan | Read projection, joined with one small addition to the take-apply path. |
| MPR-201 | BUILD | New file (does not exist yet) `core/engines/catalog.ts`, declared in `localFilesInDonorRoots`; seed data only from `KAGGLE_RECIPES`, the receipts under `docs/evidence/ultimate/` and `docs/evidence/ultimate/engine-candidate-manifests.json`; schema pattern of `core/engines/candidates.ts` | Yamakan; fields R06 §8, R05 E.7 [ASSUMED] | Existing lists are checked against the catalog, not derived from it. Aggregator catalogues (OpenRouter, Runware [DOC] R05 B.9) are neither code nor seed data here. |
| MPR-202 | BUILD | MPR-201 catalog; `yamakan.engines.capabilities`, `core/engines/reasons.ts`, `yamakan.generation.options` | Yamakan | A pure projection of the catalog; both commands keep their present fields. |
| MPR-203 | BUILD | Estimate tiers R05 E.4 | Yamakan | No donor gives dated estimates with egress. |
| MPR-204 | ADAPT | Consent-ledger pattern of `core/director/runtime.ts` (`grantConsent`, `revokeConsentRecord`, `once`); table shapes in `core/store.ts`; human-only rule in `core/command/registry.ts` | Yamakan pattern; `core/director/runtime.ts` is AGPL-3.0 (OpenMontage, ledger), and the card updates its `modifications` entry | A third-party policy engine would be a second authority; no third-party code is taken. |
| MPR-205 | BUILD | The existing wrapper in `core/engines/kaggle.ts`, changed in place; the Kaggle CLI stays the person's own external tool, started only from the file already on `processSpawnAllowlist` | Kaggle CLI licence [UNKNOWN]; terms open (R07 §h q7) | Contain the existing call; terms to counsel. |
| MPR-206 | BUILD | `core/engines/contract-v2.ts` `Operation`, `core/engines/fake.ts`, `tests/engines.test.ts` | Yamakan | Kit over existing contract; no third-party test kit. |
| MPR-207 | BUILD | `core/engines/reasons.ts`; **REJECT** Gomrey `classifyFailure`/`shouldRetry` | Gomrey Apache-2.0, founder-attested | Donor rules retry automatically; retry must be a new attempt. |
| MPR-208 | BUILD | `ACCEPTED_MODEL_LICENSES` (`core/engines/manifests.ts`); `packageLicenseAccepted()` and `ACCEPTED_PACKAGE_LICENSES` (`core/engines/candidates.ts`); `RIGHTS_UNQUALIFIED` for display | Yamakan; fields R06 §8, R05 E.6 | A schema and a pure function apply the gate to every route; `KAGGLE_RECIPES` licence strings are not checked today. |
| MPR-209 | BUILD | `NOTICE`, `LICENSE`, `notices/` as the only text sources; `docs/provenance/imports.json` for the AGPL modules; `scripts/sbom.mjs`, `scripts/bundle.ts` | Yamakan; FFmpeg checklist [DOC] R03 §7.1 | One read command (`yamakan.about.notices`) and one panel. See section 6. |
| MPR-210 | BUILD | `core/engines/fake.ts`; job facts R05 B.9 | Yamakan | Loopback fake only. |
| MPR-211 | BUILD (deferred until FD-5) | Windows DPAPI through a new helper beside `yamakan-acl` in `native/procd`, with hand-declared bindings (its `Cargo.toml` has no dependencies) | OS API; not in the research notes [UNKNOWN] | Trigger FD-5; no keychain crate; PowerShell and a third-party Node native module are rejected. |
| MPR-220 | WRAP (blocked on FD-4) | stable-diffusion.cpp as an unmodified, hash-pinned executable inside the existing worker boundary; Z-Image-Turbo, then FLUX.2 [klein] 4B. A person-started ComfyUI (`core/engines/comfyui.ts`) is a recorded alternative, not the route | MIT [DOC] R05 C.6; Apache-2.0 [DOC] R05 D.2; encoder, decoder and quantised-file licences [UNKNOWN] | Trigger FD-4; no GPU on the founder host, so CPU time is measured. |
| MPR-221 | WRAP (blocked on FD-4) | whisper.cpp CLI (contract in `core/audio/transcription.ts`), Whisper weights; Kokoro-82M | whisper.cpp MIT (repository record); Whisper MIT, faster-whisper MIT, WhisperX BSD-2 [DOC] R06 §3.6; Kokoro Apache-2.0 [DOC] R06 §3.1 | Trigger FD-4; no Python runtime; "whisper.cpp first" is an earlier plan decision (R10 §2.7 D06). No maintained permissive Arabic voice (R06 §10 q1). |
| MPR-222 | DEFER, then BUILD | One thin transport on the MPR-210 profile to one provider's HTTPS API, with the customer's key from the MPR-211 vault | Terms R05 E.6, §8.1 | Trigger FD-5, MPR-204, MPR-210, MPR-211. An aggregator and a vendor kit are recorded alternatives, not taken. |
| MPR-301 | ADAPT | `core/director/manifest.ts`, `core/director/stages.ts`, `core/director/runtime.ts` (OpenMontage); `core/director/cinema-pipeline.ts` | AGPL-3.0 (ledger, `notices/OpenMontage-LICENSE`) | Extends AGPL-derived files: record `modifications`; source offer (MPR-209) first; new `core/director` files declared. |
| MPR-302 | BUILD | `core/flow/snapshot.ts` `flowSnapshot` and `yamakan.flow.snapshot`, extended; `core/director/stages.ts` `nextStage`; the plan view is added beside the disclosure of `src/director/DirectorPanel.tsx`, which stays | Yamakan; `core/director/runtime.ts` (AGPL-3.0, ledger) changes, and the card updates its `modifications` entry | UI over Director data; mounting `src/flow/FlowView.tsx` as it is was rejected. |
| MPR-303 | COMBINE | `core/takes.ts` proposal; `core/timeline/operations.ts` | Yamakan (declared local file) | Generalise a pattern. |
| MPR-304 | BUILD | `mcp/`; registry schemas | Yamakan | Prompts and resources are Yamakan text. |
| MPR-305 | COMBINE | `core/router/explain.ts` (`eligible: []` today); MPR-201 | Yamakan | Fixed-rule ordering. |
| MPR-401 | ADAPT | `core/story.ts` `PackEntrySchema`, `verifyReferencePack`; `core/continuity.ts`; `src/create/create-people.ts`, `src/create/create-elements.ts` | Yamakan; no third-party code and no model | One optional block on the existing reference pack; reviving `CharacterAssetSchema` (`core/identity.ts`) is rejected. |
| MPR-402 | ADAPT | `core/story.ts` `PackPinSchema`, `ContinuityRefSchema`; `core/continuity.ts` `resolveContinuity`; `core/entity.ts` (MPR-401) | Yamakan | Re-anchoring practice R06 §6.6 [ASSUMED]; no code donor. |
| MPR-403 | ADAPT | `core/blender/scene.ts` `BlenderRenderSettingsSchema`; `core/director/cinema-shot.ts` `planCinemaShot`; `core/director/cinema-pipeline.ts`; new `core/shot-setup.ts`, outside the donor roots | Yamakan; no ArtCraft-ledgered file is a target | Waits for the Blender stream; the stored record reuses fields that exist today. |
| MPR-404 | DEFER | Blender's own render passes [DOC] R03 §4.4: depth (from the Mist pass) and normal; `core/cinema/control-compiler.ts`; VACE as a possible consumer | VACE Apache-2.0 [DOC] R06 §6.2; no model or workflow file is copied | Trigger: an authorised control route. A pose pass is not offered while `checkGlb` refuses rigged models. |
| MPR-405 | BUILD | Protocol R06 §7.4; `core/quality/lab.ts`, `core/quality/benchmark.ts`; **REJECT** InsightFace metrics | InsightFace models non-commercial [DOC] R06 §8 #1 | No permissive face embedding confirmed (R06 §10 q13); a learned identity metric is rejected. |
| MPR-501 | BUILD | `mcp/`; scopes; `yamakan.proxy.build`, `yamakan.proxy.cancel` | Yamakan | Corrections. |
| MPR-502 | BUILD | `core/jobs.ts` `JobSupervisor`; `core/store.ts` `events`; `sdk/`; `cli/` | Yamakan | A long poll in the existing HTTP service and cursor reads; no socket server. |
| MPR-503 | ADAPT | The token rule of `mcp/main.ts`, moved into one shared module; the existing REST upload route; `sdk/`, `cli/` | Yamakan | Same token model. |
| MPR-504 | BUILD | Hash-bound proposal pattern; human-only rule | Yamakan; adds one exported read to `core/director/runtime.ts` (AGPL-3.0, ledger) | No donor fits this authority. |
| MPR-505 | BUILD | MPR-204 gates; `RESOURCE_POLICY` frozen | Yamakan | Budgets are Yamakan policy. |
| MPR-506 | BUILD | Store records, receipts, generation records | Yamakan; leave Ascout-derived `core/agents/lineage.ts` and `yamakan.lineage.evaluate` alone | Avoids ADAPT on a founder-attested file. |
| MPR-507 | ADAPT | `core/jobs.ts` `JobSupervisor`: the existing `jobs` table and serial pump; the peak-memory reading of `native/procd` | Yamakan | No new scheduler. |
| MPR-508 | DEFER | `scripts/qualify-q15-user-presence.ts`; option A only: the Windows API through Microsoft's `windows` crate | Yamakan; `windows` crate licence [ASSUMED] MIT or Apache-2.0, not verified | Trigger FD-9. Option A is BUILD with that WRAP; option B is documentation only. |
| MPR-601 | ADAPT | Reducer operations for ripple delete, ripple trim, insert and group move (`core/timeline/operations.ts`), sent through `yamakan.project.applyBatch`; `src/editor/components/Timeline.tsx` | GPL-3.0-or-later (ai-video-production-editor, ledger): `src/editor/components/Timeline.tsx`, `src/editor/editor.css`. Reducer helpers are OpenCut Classic, MIT, unchanged | UI over existing operations; ledgered files change. |
| MPR-602 | WRAP | Reducer cases in `core/timeline/operations.ts`; `core/audio/unlink.ts`; `core/effects/color.ts`. The donor parser `src/editor/utils/lut.ts` is not used to validate | Yamakan; no ledgered file is a target | Controls over existing operations. A per-clip loudness control is rejected: normalisation is an export flag in `core/audio/loudnorm.ts`. |
| MPR-603 | WRAP | `yamakan.export.batch`, `yamakan.project.exportOtio`, `yamakan.project.otioLosses`; `core/interchange/otio.ts` `OtioLossReport` | Yamakan; no ledgered file is a target | Surface existing export and losses. The donor options in `src/editor/utils/exportSettings.ts` (codec, bitrate, container) are rejected: no command accepts them. |
| MPR-604 | BUILD | A sample built on this PC from FFmpeg test patterns, through the existing process owner and queue | No third-party media (section 5); no media is committed | Keeps media rights out of the installer. |
| MPR-605 | BUILD | Pattern of the existing qualify scripts, such as `scripts/qualify-create-workspace.mjs` and `scripts/qualify-take-review.mjs` | Yamakan | One journey test in a new script; `scripts/browser-e2e.mjs` is not lengthened. |
| MPR-606 | BUILD | `src/i18n.ts` `MESSAGES`; the layout of the existing review packet (`docs/evidence/h1-arabic-review-packet/README.md`) | Yamakan | A deterministic exporter, a freeze manifest and one test; no translation tool, no model and no new font. |
| MPR-701 | BUILD | `core/render.ts` export; MPR-101 records | Yamakan; C2PA libraries not assessed [UNKNOWN] | Sidecar is Yamakan data; C2PA deferred. |
| MPR-702 | ADAPT | `core/interchange/otio.ts` `toOtio`, `fromOtio`, `otioLossReport`, extended; the MPR-701 resolver and the MPR-303 batch; OpenTimelineIO as CI oracle only | Apache-2.0 [DOC] R03 §7; runtime dependency rejected in `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/16_MEDIA_SOURCE_QUALIFICATION.md` | OTIO carries cuts, not effects [IND] R03 §1. Completes the remaining items of SS-015; not a dependency. |
| MPR-801 | BUILD | Methods R06 §7.2–7.4; new file beside `docs/evidence/ultimate/benchmark-protocol.json` | Methods only | No revision-cost benchmark exists (R06 §7.3.3). |
| MPR-802 | BUILD | `scripts/benchmark-ultimate.ts`; MPR-801 | Yamakan | Yamakan-only run. |
| MPR-803 | DEFER | MPR-801 | Competitor terms for benchmarking not read [UNKNOWN] | Trigger FD-6. |
| MPR-804 | COMBINE | `.github/workflows/qualify.yml` (Windows job runs bundle, FFmpeg companion, typography tests today) | Yamakan | Trigger FD-8. |
| MPR-805 | BUILD | Commands of MPR-502 to MPR-506 through the unchanged MCP server; `scripts/qualify-approvals.mjs` (MPR-504), `scripts/qualify-agent-access.mjs`; statistics of `core/quality/benchmark.ts` | Yamakan | No agent production run exists to copy; no dependency is added. |

## 4. Models and runtimes licence table

**CANDIDATE**: may enter qualification after FD-4 (FD-5 for hosted); never offered before
MPR-208 passes. **REFUSED**: negative catalog entry only (MPR-201). **NEEDS COUNSEL**: licence
unread, conditional or unclear; read it, get a legal reading where not plain; not offered
meanwhile. Tiers are VRAM unless marked CPU (founder host class, no discrete GPU) or iGPU
(Vulkan on integrated graphics); they are the notes' [DOC] figures or [ASSUMED]
extrapolations, never our measurements. Keys U1–U60 are in section 8.

| Model or runtime | Code / weights licence | Commercial | Notable restrictions | Tier | Disposition | Evidence |
|---|---|---|---|---|---|---|
| Wan 2.2 TI2V-5B; Wan 2.1 T2V-1.3B | Apache-2.0 | Yes | None found | 8 GB with offload; CPU impractical | CANDIDATE (TI2V-5B runs on Kaggle) | [DOC] R05 C.0, C.7; U1–U3 |
| Wan 14B family (A14B, S2V, Animate-2, VACE 14B), MAGREF, InfiniteTalk, MultiTalk, OmniAvatar, FantasyTalking | Apache-2.0 | Yes | Wan derivative licences unchecked | 16–24 GB; 5–8 GB at 22–43 s/iteration; MAGREF ~70 GB | CANDIDATE (GPU batch) | [DOC] R05 C.0; R06 §4.1, §6.2; U1, U2, U6, U7 |
| VACE 1.3B, Phantom 1.3B | Apache-2.0 | Yes | Phantom ≤4 references | VRAM unstated | CANDIDATE (MPR-404) | [DOC] R06 §6.2; U4, U5 |
| CogVideoX-2B | Apache-2.0 | Yes | None found | 3.6–4 GB | CANDIDATE (Kaggle recipe) | [DOC] R05 C.0; U8 |
| CogVideoX-5B, 1.5-5B | "CogVideoX License", unread | [UNKNOWN] | — | 4.4–10 GB | NEEDS COUNSEL | [DOC] name, R05 E.6; U8 |
| Mochi 1, MAGI-1 4.5B, LongCat-Video, Self-Forcing | Apache-2.0; LongCat MIT | Yes | None found | 12–24 GB+ | CANDIDATE (not founder host) | [DOC] R05 C.0; U9 |
| FramePack | Apache-2.0 code; HunyuanVideo-derived weights, licence not restated | [UNKNOWN] | Tencent exclusion may attach [ASSUMED] | 6 GB | NEEDS COUNSEL | [DOC] R05 C.5; U10 |
| LTX-2.5, LTX-2.3 | Apache-2.0 / LTX-2.x Community (text unread) | Under USD 10M revenue | Gated; fine-tune transfer may need paid licence | 32 GB official minimum | NEEDS COUNSEL | [DOC] R05 C.2; U11 |
| MiniMax H3 (open) | MiniMax H3 Community | Under USD 20M; not EU, UK, South Korea, USA | UI must display the name; outputs may not improve other models | 33B + 32B encoder | REFUSED | [DOC] R05 C.3; U12 |
| HunyuanVideo 1.5, -Avatar, -Foley, HunyuanCustom, HunyuanImage 3.0 | Tencent Hunyuan Community (Custom, Image 3.0 unread) | Not EU, UK, South Korea | 100M MAU cap; outputs may not train other models | 14 GB+; Image 3.0 3×80 GB | REFUSED | [DOC] R05 C.4; R06 §4.1, §8 #3–4; U13 |
| SkyReels-V3/A2; Lynx weights | skywork-license / not stated | [UNKNOWN] | — | 14B+ | NEEDS COUNSEL | R05 C.5; R06 §6.2; U14 |
| HoloCine | CC BY-NC-SA 4.0 | No | Academic only | Wan 14B | REFUSED | [DOC] R06 §6.9; U15 |
| Stand-In | Apache-2.0; downloads InsightFace `antelopev2` | No | Non-commercial dependency | Wan 14B | REFUSED | [DOC] R06 §6.2; U16 |
| Z-Image / Z-Image-Turbo | Apache-2.0 | Yes | None found | ~4 GB quantised [IND]; CPU minutes per image [ASSUMED] | CANDIDATE | [DOC] R05 D.2, D.3; U17 |
| FLUX.2 [klein] 4B | Apache-2.0 | Yes | None found | ~13 GB; ~8 GB quantised [ASSUMED] | CANDIDATE | [DOC] R05 D.2; U18 |
| Qwen-Image 2025 line (Edit, -2509, -2511, Layered, 2512) | Apache-2.0 | Yes | Name shared with non-commercial 2.1 | Edit-2511 GGUF ~11–12 GB [IND] | CANDIDATE | [DOC] R05 D.2; U19 |
| OmniGen2; IP-Adapter (not FaceID) | Apache-2.0 | Yes | IP-Adapter inherits base model; FaceID unread | 17 GB; <3 GB very slow | CANDIDATE | [DOC] R06 §6.3–6.4; U20 |
| FLUX.1 Kontext [dev], FLUX.2 [dev], FLUX.2 [klein] 9B; PuLID-FLUX, USO, DreamO, InfiniteYou | FLUX non-commercial; InfiniteYou CC BY-NC | No | Cards allow commercial outputs; filter duty | 12B–32B | REFUSED | [DOC] R05 D.2; R06 §6.4; U21 |
| Qwen-Image-2.1 | Qwen Research Licence | No | Attribution | 7B | REFUSED | [DOC] R05 D.2; U22 |
| FLUX 3 Image Klein | FLUX Kommunity v1.0 | Under USD 5M | Gated; no blanket redistribution | 25–31 GB peak | NEEDS COUNSEL | [DOC] R05 D.2; U23 |
| SD 3.5 Large; Stable Audio Open 1.0 | Stability Community | Under USD 1M (SD 3.5) | Gated; revenue threshold | — | NEEDS COUNSEL | [DOC] R05 D.2; R06 §3.4; U24 |
| HiDream-I1/E1 | MIT weights + gated Llama-3.1-8B encoder | Meta terms govern | Most restrictive part governs | 17B | NEEDS COUNSEL | [DOC] R05 D.2; U25 |
| Krea-2; Ideogram 4.0 open; MiniMax-H3-Image | Custom unread / not stated | [UNKNOWN] | H3-Image probably territorial [ASSUMED] | 12B–33B | NEEDS COUNSEL | R05 D.2; U26 |
| InstantID | Apache-2.0 code; research-only checkpoints; InsightFace | No | — | SDXL | REFUSED | [DOC] R06 §6.4; U27 |
| Whisper large-v3-turbo and smaller | MIT | Yes | None found | CPU via a runtime | CANDIDATE (MPR-221) | [DOC] R06 §3.6; U28 |
| whisper.cpp 1.9.5 | MIT (repository record) | Yes | Not in research notes; re-read at intake | CPU | CANDIDATE | `core/audio/transcription.ts` `WHISPER_CPP` |
| faster-whisper; WhisperX | MIT; BSD-2-Clause | Yes | Diarization needs gated pyannote and an account | CPU int8 | CANDIDATE (no diarization) | [DOC] R06 §3.6; U29 |
| Qwen3-ASR / ForcedAligner | Apache-2.0 | Yes | Arabic alignment unverified | — | CANDIDATE | [DOC] abstract, R06 §3.6; U30 |
| Parakeet TDT 0.6B v3 | CC-BY-4.0 | Yes, attribution | Fails the code gate; no Arabic | — | NEEDS COUNSEL | [DOC] R06 §3.6; U31 |
| Kokoro-82M | Apache-2.0 | Yes | No Arabic, no cloning | CPU [IND] | CANDIDATE (MPR-221) | [DOC] R06 §3.1; U32 |
| Chatterbox (Turbo, Nano, Multilingual V3) | MIT | Yes | Retired Aug 2026; PerTh watermark | Nano CPU | CANDIDATE (only permissive Arabic voice; unmaintained) | [DOC] R06 §3.1; U33 |
| Dia 1.6B; CosyVoice 3 | Apache-2.0 | Yes | No Arabic | Dia 4.4 GB | CANDIDATE | [DOC] R06 §3.1; U34 |
| Orpheus | Apache-2.0 code | [UNKNOWN] | Llama-3B backbone licence unassessed | llama.cpp CPU | NEEDS COUNSEL | [DOC] R06 §3.1; U35 |
| Qwen3-TTS, NeuTTS Air, KittenTTS, VoxCPM2, OmniVoice, Pocket TTS, Supertonic | Reported Apache-2.0/MIT; per-voice; OpenRAIL-M; unverified | Not read directly | — | Small, CPU | NEEDS COUNSEL | [IND] R06 §3.1; U36 |
| Habibi-TTS | MIT code; split checkpoints | Apache-2.0 dialect/MSA only | Unified, SAU, UAE CC-BY-NC-SA | — | NEEDS COUNSEL (Apache); REFUSED (NC) | [IND] R06 §3.1; U37 |
| F5-TTS, XTTS-v2, Higgs Audio v3, VibeVoice | CC-BY-NC; Coqui CPML; research NC; research-only | No | VibeVoice TTS withdrawn | — | REFUSED | [DOC] R06 §8 #7–9, #14; U38 |
| Fish Speech / OpenAudio S2; IndexTTS-2/2.5 | Fish Community; bilibili | Under USD 500k; by enquiry | Fish: no hosted-service right | — | REFUSED | [DOC] R06 §8 #10–11; U39 |
| Piper (piper1-gpl) | GPL-3.0 | Yes | Per-voice licences unverified; GPL-3.0-only (section 5) | CPU | NEEDS COUNSEL | [DOC] R06 §8 #13; U40 |
| ACE-Step 1.5 | MIT | Yes | Training data undocumented | ≤6 GB; CPU slow | CANDIDATE | [DOC] R06 §3.4; U41 |
| DiffRhythm | Apache-2.0 | Yes | None found | 8 GB | CANDIDATE | [DOC] R06 §3.4; U42 |
| MusicGen, YuE, MMAudio, ThinkSound | CC-BY-NC weights; ThinkSound contradictory | No | — | — | REFUSED | [DOC] R06 §8 #15–18; U43 |
| Demucs weights; Sony Woosh; PrismAudio | Disputed; unverified | [UNKNOWN] | — | — | NEEDS COUNSEL | [IND] R06 §3.5, §3.7; U44 |
| MuseTalk 1.5 | MIT code and weights | Yes | whisper, ft-mse-vae, dwpose, S3FD licences unread | 4 GB | NEEDS COUNSEL (components) | [DOC] R06 §4.1; U45 |
| EchoMimicV3; SadTalker | Apache-2.0; bases and dependencies unread | [UNKNOWN] | SadTalker unmaintained | 12 GB (V3-Flash) | NEEDS COUNSEL | [DOC] R06 §4.1; U46 |
| LatentSync 1.5/1.6; LivePortrait as shipped | Apache-2.0 + openrail++; MIT; both use InsightFace | No | — | 8 GB; 18 GB | REFUSED | [DOC] R06 §8 #2, #22; U47 |
| Wav2Lip; Hallo2; Hallo3 | Non-commercial; S-Lab NC stage; CogVideoX-5B terms | No | — | — | REFUSED | [DOC] R06 §8 #6, #23–24; U48 |
| InsightFace packs (`buffalo_l`, `antelopev2`, `inswapper`); metrics on them; LRS2-trained SyncNet | Non-commercial models | No | — | — | REFUSED | [DOC] R06 §8 #1; #37 [ASSUMED]; U49 |
| Real-ESRGAN (ncnn-Vulkan) | BSD-3-Clause | Yes | Frame by frame | iGPU | CANDIDATE | [DOC] R06 §5.2; U50 |
| RIFE 4.25; SeedVR2 (+ community GGUF runtime); FlashVSR | MIT; Apache-2.0; Apache-2.0 | Yes | Restoration alters identity [ASSUMED] | 8 GB (SeedVR2 runtime) | CANDIDATE | [DOC] R06 §5.2; U51 |
| SUPIR; GIMM-VFI; STAR (CogVideoX variant); FILM | Non-commercial; S-Lab NC; CogVideoX terms; archived | No / mixed | — | STAR 39 GB | REFUSED | [DOC] R06 §5.2; U52 |
| IC-Light | Apache-2.0 code | Yes, without BRIA RMBG 1.4 (NC) | — | Light | CANDIDATE (replace matting) | [DOC] R06 §6.8; U53 |
| Topaz Video | Proprietary, paid | Personal plans under USD 1M | Paid | 6–16 GB | REFUSED (as bundled or required) | [DOC] R06 §5.1; U54 |
| stable-diffusion.cpp; LightX2V | MIT; Apache-2.0 | Yes | — | CPU, Vulkan, CUDA | CANDIDATE (runtimes) | [DOC] R05 C.6; U55 |
| ComfyUI (the person's install), WanGP, diffusers | Not checked in the notes | [UNKNOWN] | Partner nodes need Comfy credits, no customer keys | — | WRAP only, as today; NEEDS COUNSEL before bundling | [DOC] R05 B.7, C.6; U56 |

Hosted routes:

| Route | Finding | Disposition | Evidence |
|---|---|---|---|
| Sora 2 API; Moonvalley Marey API; Amazon Nova Reel | Removed 2026-09-24; discontinued; end of life 2026-09-30 | REFUSED (negative entries) | [DOC] R05 A.1, A.11, B.8; U57 |
| PixVerse API; Midjourney; Suno, Udio | Integration needs written authorisation; no official API; litigation, downloads disabled | REFUSED | [DOC]/[IND] R05 A.9, A.15; R06 §3.4; U58 |
| ComfyUI partner nodes; Vercel AI Gateway BYOK | No customer keys; falls back to Vercel credentials | REFUSED unless fallback can be disabled | [DOC] R05 B.5, B.7; U56, U59 |
| fal, Replicate, Kling, Runway, Google, OpenAI images, BFL, Luma, MiniMax, Vidu, Alibaba, xAI, LTX API, ElevenLabs, Sync Labs, Hedra | Credential-sharing and end-user clauses; attribution duties; output terms mostly unread | NEEDS COUNSEL (FD-5) | [DOC] R05 E.6, §8.1; R06 §3.2, §4.2; U60 |

## 5. Things not to copy or bundle

1. **InsightFace model packs and anything that pulls them in** (LivePortrait as shipped,
   Stand-In, InstantID, InfiniteYou, LatentSync landmarks): MIT code, non-commercial models,
   often downloaded silently [DOC] R06 §8 #1–2. This also bars them from MPR-405.
2. **Territorially excluded weights**: Tencent Hunyuan (not EU, UK, South Korea), MiniMax H3
   (also not USA; UI-branding duty) [DOC] R05 C.3–C.4.
3. **Non-commercial weights**, however permissive the code: F5-TTS, XTTS-v2, Higgs v3,
   MusicGen, YuE, MMAudio, Wav2Lip, SUPIR, GIMM-VFI, HoloCine, the Hallo2 SR stage, FLUX
   dev-class and adapters on it, Qwen-Image-2.1. A quantised copy keeps the licence [ASSUMED]
   R05 E.6.
4. **Revenue-capped or hosting-restricted weights** (Fish, LTX-2.x, FLUX 3 Klein, SD 3.5,
   Stable Audio Open, Topaz Personal) are never bundled; they fail `ACCEPTED_MODEL_LICENSES`.
5. **Gated weights** are never pre-accepted or shipped; the customer accepts under their own
   account [ASSUMED] on [DOC] gating, R05 E.6.
6. **GPL, read for Yamakan.** R06 §8 #13 flags GPL-3.0 runtimes for a *non-GPL* product.
   Yamakan is GPL-3.0-or-later, so GPL-3.0 code is compatible. Two limits stay: linking
   GPL-3.0-only code (for example `piper1-gpl`) would pin the combined work to GPL-3.0 and
   drop "or later" [ASSUMED], so such tools stay behind a process boundary; and `bpy` is never
   imported into a Yamakan process nor Blender shipped (R03 §4.8 [ASSUMED] on the [DOC] GPL
   FAQ). An FFmpeg `--enable-nonfree` build is not redistributable at all [DOC] R03 §7.1.
7. **Source-available or unclear editor code**: Remotion (company licence, per-render fees;
   already rejected in
   `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/16_MEDIA_SOURCE_QUALIFICATION.md`) [DOC] R03 §7.2; Diffusion Studio
   core, Twick, OpenVideo (licence conflicts or unfetched) [IND]/[UNKNOWN] R03 §7.
8. **Competitors' proprietary designs, prompts and assets**: no screens, presets, prompt
   text, sample media or marks from Higgsfield, Runway, Kling, CapCut, Adobe or others. Guards
   stay: `npm run brand:check` (`docs/provenance/brand-terms.json`), ArtCraft marks unlicensed,
   YouMind categories only (`NOTICE`), excluded cookie and session clients.
9. **Disputed outputs and data**: Suno or Udio outputs [IND] R06 §3.4; Demucs weights [IND]
   R06 §3.7; "uncensored" community fine-tunes [IND]/[ASSUMED] R05 C.2.
10. **Paid paths that bypass customer keys**: ComfyUI partner nodes (a Yamakan-started ComfyUI
    would use `--disable-partner-nodes`) and gateways with credential fallback [DOC] R05 B.5,
    B.7.

## 6. Obligations, some of which apply already

Release stays NO-GO. These bind any future candidate, and some bind now: the public repository
already publishes the GPL FFmpeg build and its companion libraries through Git LFS, and the
Director already runs AGPL-translated modules. Counsel decides whether a duty is breached (section
7). MPR-209 owns the parts its card names; each row says what no card in this plan closes. A
founder's statement of permission is recorded as the founder's word; it is not a licence, and it
does not remove another project's notice, source or attribution terms.

| Obligation | Present state (verified) | Gap |
|---|---|---|
| **Attribution and notices in the product** | `NOTICE` and `notices/` exist and are checked by `scripts/provenance.mjs`; no view in `src` or route in `server` shows them. `scripts/bundle.ts` `scaffoldDevBundle` (also behind `packUnsignedRc`) copies `NOTICE` only, not `LICENSE` or `notices/`, and writes a one-line placeholder if the copy fails. `NOTICE` omits InvokeAI, openjutsu, the Node.js runtime the bundle ships (`resolvePinnedNode` copies the running `node.exe`) and most npm packages. | MPR-209 adds the About panel, the read command `yamakan.about.notices` and bundle copies of `LICENSE`, `NOTICE` and `notices/`. It re-saves `NOTICE` as UTF-8, keeps its existing wording and adds the entries missing today (InvokeAI, openjutsu, the Node.js runtime). Not in this plan's cards: a provenance check that `NOTICE` names every ledger source and shipped binary, entries for most npm packages, and a bundle that refuses when the copy fails. Apache-2.0 NOTICE files shipped [ASSUMED]. The FFmpeg credit [DOC] R03 §7.1 is shown through the notices files the panel lists. |
| **AGPL and GPL source availability** | `NOTICE` promises an About-view AGPL link "when Director UI lands"; the Director UI exists (`src/director/DirectorPanel.tsx`) and no source-offer text exists in `src` or `server`. FFmpeg and its GPL DLLs: hashes, build script and versions recorded; no source archive or written offer. | MPR-209 shows a source offer in the About panel: the AGPL-derived modules from `docs/provenance/imports.json`, the combined licence, and the Yamakan source location. That location needs a founder-supplied `repository` value in `package.json`; until then the panel states that none is configured. Part a also adds corresponding source or a written offer for the vendored FFmpeg build. Not in this plan's cards: the same for each GPL companion library, matched to `vendor/ffmpeg-win64-r8/BUILD.json`. AGPL §13 on loopback goes to counsel. |
| **SBOM coverage** | `docs/evidence/sbom/yamakan-runtime.cdx.json` (CycloneDX 1.5; `npm run sbom:check` in CI): 20 npm libraries with licences; 26 FFmpeg files with SHA-256 but **no licence or version**. The bundle's own SBOM (`sbomFromPackageLock`) lists every lockfile package, dev ones included, without licences, FFmpeg or `node.exe`. Blender is in neither. `native/procd/Cargo.toml` has no dependencies. | MPR-209: one generator shared by `scripts/sbom.mjs` and `scripts/bundle.ts`; FFmpeg 7.1.5 and libass 0.17.3 as components with licence and version (hashes from `vendor/ffmpeg-win64-r8/BUILD.json`), linked to the vendored files; Blender as an external, not-redistributed component with its pin; `yamakan-procd`. It lists the bundled `node.exe` with its version and hash. Not in its component list: each weight file once FD-4 allows one. |
| **Licence of a generation route at generation time** | Partly present: Create's `create.modelFacts` (`src/i18n.ts`, shown in `src/create/CreateWorkspace.tsx`) names the licence from `CREATE_MODELS`; receipts carry `licence` (`src/create/GeneratePanel.tsx`). `ACCEPTED_MODEL_LICENSES` is not applied to `KAGGLE_RECIPES`. No revenue cap, territory, output limit or watermark is shown. ComfyUI routes have none (`PINNED_COMFY_RECIPES` empty). | The terms of the MPR-208 licence block, shown in Create before a start through `yamakan.generation.options` (MPR-209, part b), and the licence on the generation record (MPR-101). A route the MPR-208 gate refuses is not offered. The MPR-203 preflight carries no licence field. |
| **Skelet: no upstream licence** | Two ledger entries (`core/storage/storage.ts` and its test) are `LicenseRef-NoUpstreamLicenseFile`, founder-attested. | No card. The owner can add a licence file to `TheHalfMoon/Skelet`; until then counsel question 11. |
| **Trademark and attribution duties** | "Rendered with Blender" without logo; ArtCraft marks unlicensed; `brand:check`. | Provider attribution duties (for example "Powered by Runway" [IND] R05 E.6) in the catalog (the attribution field of the MPR-208 block) before any hosted route. |

## 7. Questions for counsel (FD-5)

They block MPR-211 and MPR-222 and shape MPR-208 and MPR-209. The authorising decision is in
[FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md).

1. **Bring-your-own-key desktop client**: inside or outside the credential-sharing and "do not
   expose the API to end users" clauses of fal, Replicate, Kling, Runway (R05 §8.1 q1, B.1–B.2)?
2. **Attribution on a BYOK client**, such as Runway's reported "Powered by Runway" (R05 §8.1 q2).
3. **Storing a customer's provider credential** (MPR-211): disclosure, liability, and whether
   any provider forbids keys in a third-party client.
4. **Redistribution of outputs**: output terms unread for Google, OpenAI, Luma, BFL, Ideogram,
   Recraft, Vidu, xAI, Runway (R05 §8.1 q6); obligations when an export carries prompts with
   personal data (FD-2); preserving SynthID or PerTh watermarks; who bears MiniMax and Tencent
   disclosure duties for public machine-generated content [DOC] R05 C.3–C.4.
5. **Facilitating gated or territorial downloads** the customer accepted, and what to check or
   record (R05 §8.1 q3).
6. **Non-commercial weights whose cards allow commercial outputs**, run on the customer's
   machine in a commercial product (R06 §10 q16).
7. **"Do not use outputs to improve other models"** and a customer's LoRA on their own output
   (R05 §8.1 q8).
8. **Unread texts**: LTX-2.x, Krea 2, MiniMax-H3-Image, skywork-license, CogVideoX License,
   Ideogram 4.0 open, FLUX.1 Krea [dev], Wan derivatives, FramePack weights (R05 §8.1 q4–q5),
   and every NEEDS COUNSEL row in section 4.
9. **Voice and likeness consent law** by jurisdiction (R06 §10 q17), and what
   `core/identity.ts` `ConsentRecordSchema` must hold.
10. **Kaggle terms** for driving a person's private notebooks and for output use (R07 §h q7; FD-3).
11. **Founder attestation** as the basis for Skelet (no upstream licence), Gomrey and Ascout.
12. **AGPL §13 on a loopback service** reached only by the same person's browser, and how the
    combined work is described: GPL-3.0-or-later Yamakan code combined with AGPL-3.0 modules under
    GPLv3 section 13.
13. **Codec patents** for H.264/HEVC via x264/x265, separate from copyright [DOC] R03 §7.1.
14. **Music models with undocumented training data** (ACE-Step 1.5 [DOC] R06 §3.4) given open
    litigation against Suno [IND] R06 §3.4.

## 8. Sources

URLs copied from the research notes (accessed 2026-11-11); the label at the point of use
governs. Repository paths are cited inline. Full lists: [SOURCES.md](SOURCES.md).

- U1 https://github.com/Wan-Video/Wan2.2
- U2 https://github.com/Wan-Video/Wan2.1
- U3 https://docs.comfy.org/tutorials/video/wan/wan2_2.md
- U4 https://github.com/ali-vilab/VACE
- U5 https://github.com/Phantom-video/Phantom
- U6 https://github.com/MAGREF-Video/MAGREF
- U7 https://github.com/MeiGen-AI/InfiniteTalk ; https://github.com/MeiGen-AI/MultiTalk ; https://github.com/Omni-Avatar/OmniAvatar ; https://github.com/Fantasy-AMAP/fantasy-talking ; https://huggingface.co/Wan-AI/Wan2.2-S2V-14B
- U8 https://github.com/zai-org/CogVideo
- U9 https://github.com/genmoai/mochi ; https://github.com/SandAI-org/MAGI-1 ; https://github.com/meituan-longcat/LongCat-Video ; https://github.com/guandeh17/Self-Forcing
- U10 https://github.com/lllyasviel/FramePack
- U11 https://huggingface.co/Lightricks/LTX-2.5 ; https://docs.ltx.io/open-source-model/getting-started/system-requirements.md
- U12 https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE
- U13 https://huggingface.co/tencent/HunyuanVideo-1.5/blob/main/LICENSE ; https://github.com/Tencent-Hunyuan/HunyuanVideo-Avatar/blob/main/LICENSE ; https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley ; https://github.com/Tencent-Hunyuan/HunyuanCustom ; https://github.com/Tencent-Hunyuan/HunyuanImage-3.0
- U14 https://github.com/SkyworkAI/SkyReels-V3 ; https://github.com/SkyworkAI/SkyReels-A2 ; https://github.com/bytedance/lynx
- U15 https://github.com/yihao-meng/HoloCine
- U16 https://github.com/WeChatCV/Stand-In
- U17 https://github.com/Tongyi-MAI/Z-Image ; https://github.com/leejet/stable-diffusion.cpp
- U18 https://huggingface.co/black-forest-labs/FLUX.2-klein-4B
- U19 https://github.com/QwenLM/Qwen-Image ; https://huggingface.co/Qwen/Qwen-Image-Edit-2511
- U20 https://github.com/VectorSpaceLab/OmniGen2 ; https://github.com/tencent-ailab/IP-Adapter
- U21 https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev ; https://huggingface.co/black-forest-labs/FLUX.2-dev ; https://github.com/ToTheBeginning/PuLID ; https://github.com/bytedance/USO ; https://github.com/bytedance/DreamO ; https://github.com/bytedance/InfiniteYou
- U22 https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE
- U23 https://docs.bfl.ml/flux_3/flux3_image_klein.md ; https://huggingface.co/black-forest-labs/flux-3-image-klein
- U24 https://huggingface.co/stabilityai/stable-diffusion-3.5-large ; https://huggingface.co/stabilityai/stable-audio-open-1.0
- U25 https://github.com/HiDream-ai/HiDream-I1
- U26 https://huggingface.co/krea/Krea-2-Turbo ; https://docs.comfy.org/tutorials/image/ideogram/ideogram-v4.md ; https://huggingface.co/MiniMaxAI/MiniMax-H3-Image
- U27 https://github.com/instantX-research/InstantID
- U28 https://huggingface.co/openai/whisper-large-v3-turbo
- U29 https://github.com/SYSTRAN/faster-whisper ; https://github.com/m-bain/whisperX
- U30 https://arxiv.org/abs/2601.21337
- U31 https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- U32 https://huggingface.co/hexgrad/Kokoro-82M ; https://localaimaster.com/blog/kokoro-vs-xtts-vs-chatterbox
- U33 https://github.com/resemble-ai/chatterbox
- U34 https://github.com/nari-labs/dia ; https://github.com/FunAudioLLM/CosyVoice
- U35 https://github.com/canopyai/Orpheus-TTS
- U36 https://gigazine.net/gsc_news/en/20260123-qwen3-tts-family-opensource ; https://github.com/neuphonic/neuTTS ; https://localclaw.io/tts/kitten-tts ; https://pypi.org/project/voxcpm ; https://arxiv.org/html/2604.00688v2 ; https://pypi.org/project/pocket-tts/1.0.0/ ; https://huggingface.co/Supertone/supertonic-2
- U37 https://github.com/SWivid/Habibi-TTS
- U38 https://github.com/SWivid/F5-TTS ; https://huggingface.co/coqui/XTTS-v2 ; https://github.com/boson-ai/higgs-audio ; https://github.com/microsoft/VibeVoice
- U39 https://github.com/fishaudio/fish-speech/blob/main/LICENSE ; https://github.com/index-tts/index-tts
- U40 https://github.com/OHF-Voice/piper1-gpl
- U41 https://github.com/ace-step/ACE-Step-1.5
- U42 https://github.com/ASLP-lab/DiffRhythm
- U43 https://github.com/facebookresearch/audiocraft ; https://github.com/multimodal-art-projection/YuE ; https://github.com/hkchengrex/MMAudio ; https://github.com/FunAudioLLM/ThinkSound
- U44 https://huggingface.co/adefossez/HTDemucs/discussions/1 ; https://www.mixonline.com/post-and-broadcast/sony-ai-announces-sfx-generation-model-woosh
- U45 https://github.com/TMElyralab/MuseTalk
- U46 https://github.com/antgroup/echomimic_v3 ; https://github.com/OpenTalker/SadTalker
- U47 https://github.com/bytedance/LatentSync ; https://huggingface.co/ByteDance/LatentSync-1.6 ; https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE
- U48 https://github.com/Rudrabha/Wav2Lip ; https://github.com/fudan-generative-vision/hallo2 ; https://github.com/fudan-generative-vision/hallo3
- U49 https://github.com/deepinsight/insightface
- U50 https://github.com/xinntao/Real-ESRGAN
- U51 https://github.com/hzwer/Practical-RIFE ; https://github.com/ByteDance-Seed/SeedVR ; https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler ; https://github.com/OpenImagingLab/FlashVSR
- U52 https://github.com/Fanghua-Yu/SUPIR ; https://github.com/GSeanCDAT/GIMM-VFI/blob/main/LICENSE ; https://github.com/NJU-PCALab/STAR ; https://github.com/google-research/frame-interpolation
- U53 https://github.com/lllyasviel/IC-Light
- U54 https://www.topazlabs.com/pricing ; https://docs.topazlabs.com/topaz-video/system-requirements
- U55 https://github.com/leejet/stable-diffusion.cpp ; https://github.com/ModelTC/LightX2V
- U56 https://docs.comfy.org/tutorials/partner-nodes/overview ; https://github.com/deepbeepmeep/Wan2GP
- U57 https://developers.openai.com/api/docs/deprecations ; https://docs.comfy.org/tutorials/partner-nodes/moonvalley/moonvalley-video-generation ; https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html
- U58 https://pixverse.ai/de/pixverse-platform-terms-of-service ; https://www.atlascloud.ai/models/midjourney ; https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/ ; https://dynamoi.com/learn/ai-music-distribution/is-udio-music-still-downloadable
- U59 https://vercel.com/docs/ai-gateway/authentication-and-byok/byok
- U60 https://fal.ai/terms ; https://replicate.com/terms ; https://kling.ai/document-api/guides/protocols/paid-service.md ; https://conductatlas.com/platform/runway/runway-terms-of-service/api-use-requires-prominent-powered-by-runway-display/ ; https://aistudio.google.com/docs/omni ; https://developers.openai.com/api/docs/guides/image-generation ; https://sync.so/docs/models/lipsync ; https://elevenlabs.io/docs/overview/capabilities/sound-effects

Sections 1–3 and 5–7:

- FFmpeg licensing: https://www.ffmpeg.org/legal.html ; https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
- Blender and GPL: https://docs.blender.org/manual/en/latest/getting_started/about/license.html ; https://www.gnu.org/licenses/gpl-faq.en.html ; https://pypi.org/project/bpy/ ; https://developer.blender.org/docs/release_notes/5.2/ ; https://docs.blender.org/manual/en/latest/render/layers/passes.html
- OpenTimelineIO and OTIO loss: https://github.com/AcademySoftwareFoundation/OpenTimelineIO ; https://www.remotion.dev/docs/export-opentimeline
- Remotion, Diffusion Studio: https://www.remotion.dev/docs/license/pricing ; https://github.com/diffusionstudio/core
- Aggregator catalogues: https://openrouter.ai/docs/llms.txt ; https://runware.ai/docs/llms.txt
- Community fine-tune example: https://huggingface.co/SulphurAI/Sulphur-2-base
- Voice-likeness consent overview: https://vorplabs.com/ai-regulatory-updates/deepfake-laws/voice-likeness-consent
