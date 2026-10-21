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
