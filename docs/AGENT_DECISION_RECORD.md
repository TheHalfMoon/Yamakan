# Agent decision record

Decisions the implementing agent (Claude, Claude Code) made under authority the founder delegated. They are **not** founder approvals and are never attributed to one. Each records its authority, rationale, evidence and how to change it. Founder decisions are in the [founder decision record](FOUNDER_DECISION_RECORD.md).

## 2026-10-13: resource policy v2 frozen

- **Authority:** the founder's continuation directive of 2026-10-13 ("Choose and freeze a measurable resource policy"; [founder decision record](FOUNDER_DECISION_RECORD.md#2026-10-13-continuation-to-verified-completion)).
- **Decision:** `RESOURCE_POLICY` in [`core/command/policy.ts`](../core/command/policy.ts) becomes `yamakan.resource-policy/v2`, adding a frozen `qualification` section:
  - **Import service peak:** 300 MiB.
    - **Scope:** the service process alone, during a streamed HTTP import of at least 2 GiB.
    - **Method:** the larger of 200 ms working-set samples and Windows' exact `PeakWorkingSet64`.
    - **Enforcement:** none at run time; a breach fails `qualify-large-import`.
  - **Worker peaks, measured:**
    - **Method:** each worker's peak committed Job Object memory, read by procd when the worker exits. A peak procd could not read is reported as unmeasured and fails the run.
    - **Rule:** every worker the corpus starts must peak at no more than 87.5% of the Job Object limit it ran under, and that limit must be an enforced one: 1 GiB for probes and capability checks, 2 GiB for renders, conversions and previews.
    - **Corpus:** every accepted container; 4096x4096 stills and video; 4K H.264; 4K and 4096x2160 10-bit HEVC; AV1; VP9; ProRes; ten-minute WAV, MP3 and Ogg; a 60 s 1080p variable-frame-rate conversion; a 720p reference export with an Arabic/Latin title; a 1080p export cutting between six heavy sources (three runs); reference previews.
    - **Threads:** every decoder and encoder runs with two threads, so memory does not grow with the host's cores.
  - **Worst-case concurrent memory:**
    - **Includes:** the service, one job worker, one preview renderer, two import probes and one engine check, each at its limit: 7,468 MiB.
    - **Limit:** half of the machine's RAM (8,052 MiB on the 16 GiB qualification profile).
  - **Enforced values carried forward, unchanged:**
    - **Disk:** 256 MiB disk reserve after staging plus publication; 4 GiB import size.
    - **Concurrency:** 2 concurrent imports; 128 active jobs; 4 conversions per project.
    - **Time limits:** probe 10 s; render 180 s; conversion 900 s; preview 30 s.
    - **Threads:** 2 per decoder and encoder.
- **Rationale:**
  - The kernel limit is the real bound on an external FFmpeg process; a service RSS ceiling does not constrain it. So workers are bounded by their Job Object limit and qualified against a fixed share of it.
  - The 12.5% headroom keeps every supported codec in the corpus clear of allocation failure. The heaviest case, a 1080p export from six heavy sources, peaked at 985 MiB (48.1% of its limit), with under 1% spread over three runs.
  - The 300 MiB service ceiling keeps the existing proposal. The measurements (154 MiB at T4b; 163 MiB now) are evidence for that fixture only, not proof that every input stays bounded.
- **Found while qualifying:** `-threads` is a per-input FFmpeg option, so multi-clip exports decoded with one thread per core and conversions encoded without a limit. Both are fixed in the same change; the heavy export's peak fell from 1,522 to 985 MiB.
- **Failure behaviour, tested:**
  - At its limit, a worker's allocations fail and it exits non-zero. A probe then reports MEDIA_INVALID, and a job ends FAILED.
  - Committed memory may overshoot the limit by a few MiB: up to 7.5 MiB was seen at limits of 32–192 MiB, so the test allows 16 MiB.
- **Evidence:** `scripts/qualify-resources.ts` writes `docs/evidence/qualification/resource-policy.json`, and `tests/resource-policy.test.ts` covers the behaviour above.
- **Change rule:** a value changes only with a new policy version, a new entry here and a re-measurement. A threshold is never raised to make a run pass.

## 2026-10-21: W18 Audio unlink, loudnorm, and Flow

- **Authority:** frozen plan W18 / P08 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W1 + W15 + M-gate prerequisites satisfied; W16 merged at `320c4a5`.
- **Decision:** Bump canonical project to **format v4** so a video asset with `hasAudio` may sit on an audio track (unlinked sound). Register `yamakan.clip.{unlinkSound,relinkSound}` and timeline ops; `AUDIO_UNLINK_ENABLED = true`. Two-pass FFmpeg `loudnorm` on export when `normalizeLoudness: true` (measured values stored on the render plan); `LOUDNORM_ENABLED = true`. Read-only Flow projection `yamakan.flow.snapshot` + `src/flow/FlowView.tsx`; `FLOW_ENABLED = true`. Film-editor remote mastering provider stays excluded (local `loudnorm` only).
- **Evidence:** `tests/w18-audio-flow.test.ts` (unlink/relink restores `planHash`; Flow read-only); `npm run qualify:w18-loudnorm` → `docs/evidence/qualification/w18-loudnorm.json` (±1 LU of −16 LUFS).
- **Change rule:** changing the loudnorm target or unlink schema needs a new format version or ADR entry.

## 2026-10-21: W16 Keyframe animation (M6)

- **Authority:** frozen plan W16 / M6 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W9 prerequisite satisfied; W15 merged at `53f6dab`.
- **Decision:** Port OpenCut Classic `cf5e79e9` animation modules (excluding effect/graphic/transform) into `core/animation/` with flick `MediaTime`. Map `@/params` onto `core/timeline/properties.ts` (Q14 pass). Shared sampler `sampleScalarChannelsAtTime` for preview/export. **Q13 selects expression-based** FFmpeg compilation (`colorchannelmixer`/`volume` constants from the sampler); sendcmd deferred. Optional clip `animation` map on canonical/edit view; `ANIMATION_ENABLED = false` until UI/render wiring lands.
- **Evidence:** `npm run qualify:q13` / `qualify:q14`; `tests/animation-params.test.ts`; receipts under `docs/evidence/qualification/q13-animation-compile.json` and `q14-animation-params.json`.
- **Change rule:** enabling `ANIMATION_ENABLED` requires plan/preview filters and a new ADR.

## 2026-10-22: P10-02 Animation UI→render enablement

- **Authority:** P10-02 ([TASKS](plans/P10-qualification-activation/TASKS.md)); W16 modules + Q13/Q14 already on main.
- **Decision:** Wire `clip.setAnimation` / `clip.upsertAnimationKeyframe` (commands + reducer, gated by `ANIMATION_ENABLED`), attach `animation` on render-plan video/audio, apply opacity (`colorchannelmixer`) and volume piecewise filters via the shared sampler, add the main-editor Animation panel. Set **`ANIMATION_ENABLED = true`** after `qualify:animation-e2e` plus unit wiring tests. Transform position/scale/rotate remain stored-only (no FFmpeg compile) as an explicit residual.
- **Evidence:** `tests/animation-wiring.test.ts`; `npm run qualify:animation-e2e` → `docs/evidence/qualification/p10-02-animation-e2e.json`; refreshed Q13/Q14 receipts.
- **Change rule:** compiling transform filters or changing the sampler/filter contract needs a new ADR entry.

## 2026-10-21: W15 Director identity and stages (M11–M12)

- **Authority:** frozen plan W15 / M11–M12 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W14 merged at `498cf45`; W4/W10 prerequisites satisfied.
- **Decision:** Translate OpenVideoStudio `175da996` identity contracts to `core/identity.ts` + `core/identity-format.ts` (asset ids, consent with purpose/expiry/revocation and encoding invalidation). Translate OpenMontage `9327439` stage rules to `core/director/{manifest,stages,runtime}.ts` with output-hash-bound human approvals. Register `yamakan.consent.{grant,revoke}`, `yamakan.identity.encode`, `yamakan.director.{start,advance,approve,next}`; keep `DIRECTOR_ENABLED = false`.
- **Evidence:** `tests/identity.test.ts`, `tests/director-stages.test.ts` (journey 5 agent block); AGPL/Apache notices.
- **Change rule:** enabling Director UI or real encoding providers needs a new ADR and E-SEC/F gates as applicable.

## 2026-10-21: W14 Cinema camera and scene3d (M8–M10)

- **Authority:** frozen plan W14 / M8–M10 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W13 merged at `a6f287d`; W10 prerequisite satisfied.
- **Decision:** Import ArtCraft `28a39a0d` `cameraMath.ts` and EditorStateJSON types byte-identical under `src/cinema/`; adapt `CameraController.ts` with callbacks (no event bus / `@storyteller/*`); pin `three@0.171.0`; define `core/scene3d.ts` (metres, Euler order, camera intrinsics, asset ids, M9 limits; no `media_file_token`); register `yamakan.scene.save`; keep `CINEMA_ENABLED = false` until Cinema UI attaches.
- **Evidence:** `tests/cinema.test.ts`; notices `notices/ArtCraft-*` + root `NOTICE`; provenance ledger rows for the four donor paths. Security review must-fix closed (M9 `maxDepth` + 4 MiB bounds before receipt hash). PStack checklist applied manually. Graft keyless build/ask with `--dir` outside the repo. Alibaba OCR not installed locally (delegate-only; no model-backed OCR claimed).
- **Change rule:** turning `CINEMA_ENABLED` on requires Cinema UI wiring and a new ADR entry.

## 2026-10-21: W17 Agents and Quality

- **Authority:** frozen plan W17 / M17 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W4, M-gate, W11 prerequisites on main.
- **Decision:** Translate Gomrey `5f299a7a` job kernel to `core/jobs/rules/jobs.ts` (8 inherited tests); apply Yamakan JobState table inside SQLite transitions. Ascout `ca6b6f51` independence lineage under `core/agents/lineage.ts`. Original Quality Lab (`QUALITY_LAB_ENABLED = false`) and router explain (`ROUTER_PROVIDERS_ENABLED = false` — ranks nothing). Commands `yamakan.quality.*`, `yamakan.router.explain`, `yamakan.lineage.evaluate`.
- **Merged:** PR #54 at main `03ddee4` (exact head `7c27fbc`; CI run `39614105234` green). Architecture + security: APPROVE_WITH_RESIDUALS (flags off). Alibaba OCR not installed (delegate-only).
- **Change rule:** enabling Quality Lab or providers needs acceptance receipts and a new ADR. Track 2 W-cards are otherwise complete; W12 still needs H1.

## 2026-10-21: W11 Studio canvas engine (primary selected)

- **Authority:** frozen plan W11 / M7 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); ADR `0003` amendment; W10 contract already on main.
- **Decision:** Preserve original Q7a fail receipt (`q7a-studio-tsc.json`, 742 errors). Classification showed 711/742 were test files and missing-deps cascades. Proper production-only Q7a at pin `ffe9e1a` **passed** (`q7a-studio-tsc-proper.json`: `tsc` 0, vite lib build 119.71 KiB gzip). webv1 `controlLayers` evaluated at the same pin (**fail**, 396 errors) and not selected. Import webv2 `canvas-engine` + closure under `src/studio/**` behind Yamakan host port; register `yamakan.studio.{capability,open,commit,export}`; keep `STUDIO_ENABLED = false` until Q8–Q10 targets land on this head. Generative `ENGINE_ENABLED` stays false (E-SEC/F).
- **Merged:** PR #52 at main `0f76220` (exact head `4e8194b`; CI run `39605948618` qualify / windows-r8 / otio-oracle green). Prettier host/config fix and vitest `4.1.12` audit bump on the PR branch. Independent architecture + security reviews: **APPROVE_WITH_RESIDUALS** (no must-fix for flag-off merge). Alibaba OCR CLI not installed (delegate-only; no model-backed review claimed). Graft wiring consulted; Jev advisory only.
- **Residuals (not W11 product-complete):** Q8 stroke browser proof, full Q9 inherited suite, Q10 Studio chunk/latency; Studio round-trip E2E journey 4 deferred. Do **not** enable Studio or claim Q8–Q10 pass from green CI alone.
- **Evidence:** `docs/evidence/qualification/q7a-webv2-error-classification.json`, `q7a-studio-tsc-proper.json`, `q8-q10-studio-status.json`, `w11-import-ledger.json`; `tests/studio.test.ts`; `src/studio/boundaries.test.ts`; notices `notices/InvokeAI-*`; provenance ledger rows for InvokeAI pin; PR #52 review comment.
- **Change rule:** turning `STUDIO_ENABLED` on requires Q8 stroke mount, Q9 ≥90% inherited node tests, and Q10 chunk/latency receipts at an exact head.

## 2026-10-21: W10 Studio ADR and engine contract

- **Authority:** frozen plan W10 / M7 measurement + M13 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W9 merged at `33a3cdc`.
- **Decision:** Record Q7a **fail** (742 `tsc` errors on InvokeAI `ffe9e1a` webv2 canvas-engine in a throwaway TEMP tree). Do **not** select the primary engine for W11 copy. Land `core/engines/{contract,fake}.ts` with `ENGINE_ENABLED = false`; fake covers cancel, fencing retry, and probe quarantine. Q7b–Q10 not run (blocked on Q7a). ADR: `docs/adr/0003-studio-canvas-engine.md`.
- **Evidence:** `docs/evidence/qualification/q7a-studio-tsc.json`; `tests/engines.test.ts`.
- **Change rule:** a new Q7a pass (webv1 trial or reduced closure) is required before W11 copies engine sources. **Superseded for selection by the W11 proper Q7a pass above; original fail receipt remains preserved.**

## 2026-10-21: W9 Mediabunny waveform and OpenCut retime

- **Authority:** frozen plan W9 / M14–M5 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); W8 merged at `efdf591`.
- **Decision:** Pin `mediabunny@1.61.3` (MPL-2.0) and `soundtouchjs@0.3.0` (LGPL-2.1). Decode peaks in a Vite-bundled Worker (`src/media/demux{,-worker}.ts`) on Blob input only, terminated after 2 s; failures keep empty/server peaks (Q5). Port OpenCut Classic `cf5e79e9` retime into `core/retime/` with rational rates; preview pitch path via `src/audio/audio-stretch.ts`; export uses `setpts` + Yamakan `atempo` chain (no rubberband on the pinned Windows FFmpeg). Optional clip `speed` Rational on canonical/edit view; register `yamakan.clip.setSpeed`.
- **Evidence:** `npm run qualify:q5` / `qualify:q6`; `tests/retime.test.ts`, `tests/set-speed.test.ts`; notices under `notices/{mediabunny,soundtouchjs}-LICENSE`.
- **Change rule:** rate set or demux path changes require new Q5/Q6 receipts at an exact head.

## 2026-10-21: W8 OpenCut ripple and group-move

- **Authority:** frozen plan W8 / M3–M4 ([08](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)); M-gate passed at `eaeaf1b`.
- **Decision:** Import OpenCut Classic `cf5e79e9` ripple and group-move into `core/donors/opencut/{ripple,group-move}/` with flick-tick maths, Yamakan `SceneTracks` projection, and adapters for the five non-copied dependencies. Register `yamakan.timeline.{rippleDelete,rippleTrim,insert,groupMove}`. Omit the donor main-track fill-from-zero clamp (no Yamakan invariant). Q4 property tests and journey-2 undo/redo covered in `tests/ripple.test.ts`, `tests/group-move.test.ts`, `tests/timeline.test.ts`.
- **Evidence:** `docs/evidence/qualification/q4-flick-ticks.json`; `scripts/bench-edit.ts` (proposed targets).
- **Change rule:** further edit ops stay behind new task cards; animation snap points land with M6/W16.

## 2026-10-21: M-gate passed at eaeaf1b

- **Authority:** frozen plan M-gate ([07](research/rea-source-reuse/07_OPTIMIZED_MASTER_PLAN.md#m-gate)); founder continuation after R8.
- **Decision:** Declare **M-gate passed** on main `eaeaf1b` after R8 (#41/#42) and exact-head `npm run qualify:release` (247/249 pass, 0 fail, E2E green; receipt `docs/evidence/qualification/t10-release.json`). Track 2 W8–W18 may start. **Release remains NO-GO:** H1–H5 and R6/R7 release residuals (Profile A installer/launch verify; MCP/UI parity transcript) stay open and do not undo the M-gate.
- **Change rule:** a new entry if M-gate is revoked or re-declared at a different SHA.

## 2026-10-21: R8 closed — vendored fontconfig FFmpeg (DirectWrite off)

- **Authority:** Q3/R8 binding ([08 W5](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md#bounded-qualification-tests-q1q15)); founder continuation to close R8 correctly.
- **Decision:** Pin a free, redistributable Windows FFmpeg **7.1.1** under `vendor/ffmpeg-win64-r8/` whose **libass 0.17.3** is built with **fontconfig enabled and DirectWrite disabled** (`scripts/vendor/build-ffmpeg-win64-r8-msys2.sh` on MSYS2 mingw64). Companion MinGW DLLs are vendored beside the exes. `mediaTools()` prefers this pin on Windows; `EXTERNAL_BINARY_PINS` records exact SHA-256; procd `staged_tool` copies sibling `*.dll` into the AppContainer tools folder so workers load them. Q3 golden and negative controls (wrong style name; Segoe UI / Windows Fonts) pass without skip-as-pass; DirectWrite detection fails the test instead of returning early.
- **Evidence:** `vendor/ffmpeg-win64-r8/{BUILD.json,SHA256SUMS,README.md}`; `notices/ffmpeg-win64-r8-NOTICE.txt`; `tests/typography.test.ts` Q3 cases; runtime log `Using font provider fontconfig`.
- **Change rule:** replace the pin only with a new BUILD.json/SHA256SUMS and matching `EXTERNAL_BINARY_PINS`; re-run Q3 on the new binaries.

## 2026-10-21: Track 2 waits; close R6/R8 before W8 ripple

- **Authority:** frozen plan M-gate ([07](research/rea-source-reuse/07_OPTIMIZED_MASTER_PLAN.md#m-gate)); W7 merged at `9efa8c5` with M-gate **not passed**.
- **Decision:** Do **not** start W8–W18 donor product imports (OpenCut ripple, Studio, and other M3–M17 modules) until M-gate is declared on main with exact-head `qualify:release` and R1–R8 satisfied. W6-style provenance/brand tooling remains exempt. Next engineering is follow-up **W5.1** (pinned Node in bundle, Q3/R8 fontconfig confinement) and **W7.1** (remaining R7 evidence artifacts), then re-run `qualify:release` and update this record.
- **Note (W5.1 in progress):** Q3 plumbing (`FONTCONFIG_FILE` via procd, per-render `fonts.conf`) is in flight; the current Windows dev FFmpeg (DirectWrite provider) does **not** satisfy R8 until the pinned bundle FFmpeg is chosen and passes Q3.
- **Rationale:** M-gate is not satisfied by “qualify:release green on dev profile” alone while R6/R7/R8 remain open; starting schema-changing imports would multiply migrations and invalidate release evidence.
- **Change rule:** founder scope change or a new entry recording M-gate passed at a named SHA.

## 2026-10-21: Q3 / R8 — DirectWrite on pinned winget FFmpeg; R8 stays open

- **Authority:** W5.1 Q3 binding ([08 W5](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md#w5--pinned-distributable-bundle)); `tests/typography.test.ts` Q3 controls.
- **Decision:** The host and bundle-scaffold FFmpeg build (gyan.dev full build on Windows) selects **DirectWrite**, not fontconfig, even when `FONTCONFIG_FILE` points at a pinned `fonts.conf`. **`fontsdir=` on the libass filter is kept** for pinned font bytes, but it does **not** exclude host substitution by family name under DirectWrite (Q3 negative control still substitutes Arial without confinement). **R8 remains open** and release stays **NO-GO** for title-font substitution until a fontconfig-capable FFmpeg is pinned in the bundle without paid services (e.g. a self-built or freely redistributable Windows build that passes Q3). No libass-only workaround is frozen as satisfying R8.
- **Evidence:** Q3 tests skip the confined case when DirectWrite is detected; fontconfig plumbing merged in PR #39 (`FONTCONFIG_FILE` allowlisted in procd).
- **Change rule:** R8 closes only when Q3 passes on the bundle FFmpeg at an exact main head with committed receipts.

## 2026-10-21: R8 machine survey — no fontconfig-runtime FFmpeg on host

- **Authority:** same Q3/R8 binding as above; survey at main `00fe271`.
- **Decision:** **`mediaTools()`** resolves `YAMAKAN_FFMPEG` / `DARZAIN_FFMPEG` when set, otherwise the first `ffmpeg` / `ffprobe` on `PATH` via `resolveExecutable` ([`core/process/workers.ts`](../core/process/workers.ts), [`core/process/owner.ts`](../core/process/owner.ts)). On this machine that is winget **Gyan.FFmpeg** `8.1.1-full_build` (`--enable-fontconfig` and `--enable-libass` at compile time, **DirectWrite at runtime** in libass logs). No other `ffmpeg.exe` was found under `%LOCALAPPDATA%` (except Yamakan worker-tool copies of the same binary), `%ProgramFiles%`, `%USERPROFILE%\scoop`, or `C:\tools` / `C:\msys64`. The repo does **not** vendor FFmpeg in git; W5 copies whatever `mediaTools()` resolves into the bundle manifest. **Q3 fail path** (custom FFmpeg with libass fontconfig provider and DirectWrite disabled per [Q3](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md#bounded-qualification-tests-q1q15)) is **not satisfied** by app changes alone and was **not** attempted as an R8 close. **R8 stays open**; M-gate **not** declared.
- **Evidence:** `tests/typography.test.ts` Q3 confined case skips on DirectWrite; negative control substitutes Arial. No download of a replacement binary (hash pin slot remains `EXTERNAL_BINARY_PINS` in `scripts/bundle.ts`).
- **Change rule:** close R8 only after a pinned bundle FFmpeg passes Q3 with committed receipts.

## 2026-10-21: W6 provenance drift uses pin fetch when no local clone

- **Authority:** W6 on branch `chore/provenance-brand` ([08 task card](research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md#w6--provenance-and-brand-tooling)).
- **Decision:** `node scripts/provenance.mjs --diff <source>` and `--upstream <source>` are implemented in `scripts/provenance-drift.mjs`. `--diff` reads each ledger `original` at the pinned commit from `docs/provenance/donor-clones.json` / `YAMAKAN_DONOR_CLONE_ROOT` when present, otherwise from `raw.githubusercontent.com` at the pin (same bytes as a checkout at the pin). `--upstream` uses the GitHub compare API (`pin...main`). A scheduled workflow `.github/workflows/provenance-security-monthly.yml` runs `--upstream` for each copied donor, `npm audit --audit-level=high`, and prints a manual FFmpeg CVE review note (binary pin remains W5).
- **Deferred:** full local-clone-only drift (without network) is optional via `donor-clones.json`; automated FFmpeg CVE ingestion is not implemented in this PR.
- **Change rule:** new donor sources add clone paths or rely on pin fetch; upstream findings become their own PRs.

## 2026-10-21: W1 canonical format version 3 (not the frozen card's edit-view label)

- **Authority:** W1 implementation on branch `fix/video-clip-sound`; frozen task card assumed a single schema bump.
- **Decision:** canonical **`formatVersion` 3** adds `hasAudio` and clip `sound`. The 30 fps edit view uses **`schemaVersion` 2** (not to be confused with canonical v2, which already carried gain/fades/shots). `upgradeV1` still lands on canonical **format version 2** before `upgradeV2` reaches 3.
- **Evidence:** `tests/canonical.test.ts`, `tests/render-plan.test.ts`, Q1 receipt from `npm run qualify:q1`.
- **Change rule:** a new canonical format version and migration path; never rewrite stored v3 snapshots as v2.

## 2026-10-18: M-gate for major integrations; migrated video clips keep their export

- **Authority:** the founder's 2026-10-18 planning instruction asked the agent to "define when the MVP is qualified enough to start major integrations"; the continuation directive of 2026-10-13 delegates engineering order.
- **Decision (M-gate):** donor imports that change the canonical schema or add a workspace (modules M3–M17 in [the blueprint](research/rea-source-reuse/04_EXACT_SOURCE_IMPORT_BLUEPRINT.md)) start only after every MVP engineering item R1–R8 of the master plan is merged with exact-head CI: worker read containment, a video clip's own sound, the recovery and integrity defects, per-agent principals, PRs #24 and #19, the pinned bundle, the release evidence bundle, and title-font substitution excluded. A PR closed unmerged by its owner satisfies R5 only with its reason recorded and its purpose carried as a follow-up task; containment (R1) is satisfied only by containment merged on main. In addition, `qualify:release` passes on that main head, and no release-blocking defect remains in `specs/CURRENT.md`. Human-only gates block release, not integration work. Provenance and brand tooling is exempt. Details: [master plan](research/rea-source-reuse/07_OPTIMIZED_MASTER_PLAN.md#m-gate).
- **Decision (video sound, planned for W1):** new video clips whose asset has sound play it by default; clips migrated from the earlier schema get the sound disabled, so an existing project's export is unchanged by the migration (render intent is preserved, as the migration policy requires).
- **Rationale:** imports change the canonical schema; starting them before the MVP schema stabilizes multiplies migrations and invalidates release evidence.
- **Change rule:** a new entry here with the reason; the gate is never relaxed to let a specific import through.
