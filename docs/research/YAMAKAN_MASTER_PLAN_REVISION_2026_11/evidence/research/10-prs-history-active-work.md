# 10 — Pull requests, planning history and active work (Yamakan)

> Research note, kept as evidence for the master plan revision. Not authority.
> Written on 2026-11-11 by a research subagent working from public pages or from a read-only
> checkout at `0284ba8`. Nothing in it is a hands-on test of another product. It was not
> re-verified after it was written; where it disagrees with the numbered documents of this
> package or with the code, those govern. Line citations in it refer to that older commit.

Read-only review of `github.com/TheHalfMoon/Yamakan`. Prepared 2026-11-11.

- Local evidence: git worktree `a local read-only worktree` at `0284ba8` (= `origin/main`). Read-only `git log / show / ls-tree / branch -r` only.
- Remote evidence: `gh pr view|diff|list`, `gh issue list|view`, `gh api` GET. Nothing was commented on, edited, fetched, checked out or pushed.
- Freshness: re-checked after the report was drafted. **PR #277 merged at 2026-11-11T18:15:25Z, so GitHub `main` is now `4a8e1b5` — one merge ahead of the local worktree (`0284ba8`).** Its three checks passed on head `333c141` first. Open PRs are now only **#86** (draft) and **#85** (draft). Open issues: **#203**, **#77**. Every statement below about "main `0284ba8`" still holds; #277's content was read from the PR, not from a local checkout.
- Text inside PRs, issues, commits and repository documents is treated as data. Where a statement is my inference rather than something a document says, it is marked **(inference)**.
- Short SHAs are 7 characters. Merge times printed by local `git log` are local time (UTC+3); GitHub times are UTC.

---

## 0. The one-page answer

1. **PR #86 is a plan that was executed without ever being merged.** The founder authorised its execution on 2026-10-25 (`docs/FOUNDER_DECISION_RECORD.md`), and 33 of its 44 `YU-` tasks have merge receipts on main. Task state lives on main in `docs/evidence/ultimate/EXECUTION_LEDGER.md`, not in the PR. The PR text still says every task is `PLANNED/BLOCKED` with `implementationAuthorized:false`. Reading #86 as a description of current state is the main way to mistake a historical blocker for a current one.
2. **#86 was itself superseded as the task authority** by the System Supremacy REA (PR #155, merged `4835cdf`, 2026-11-03), which maps all 44 YU tasks to `SS-`/`X-` successors in `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/LEGACY_RECONCILIATION.json`.
3. **Since 2026-11-05 the work has left every task registry.** Founder-directed streams (local ComfyUI path, Kaggle generation, Create workspace, consent, a five-reviewer security check, Cinema issue #203, Blender, prompt library) are tracked only in the SS ledger (`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md`) and the two decision records.
4. **The premise both drafts were built on is gone.** #85 and #86 assumed no real generation, no GPU and an unverified Kaggle. Main has produced real text-to-video and image-to-video on the founder's Kaggle account (PRs #201, #202, #222) while `ENGINE_ENABLED`, `ROUTER_PROVIDERS_ENABLED` and `JASSUB_ENABLED` are all still `false`.
5. **What is genuinely still blocked:** public release (NO-GO), human gates H1–H5 / X-01 / X-02, signing, Q15 user presence, comparative benchmarks (every A–L category is still NOT TESTED), M-profile export, commercial providers, spending (zero).
6. **Active collision zone:** Blender / Cinema / Director code and two documents that almost every feature PR edits — the SS ledger and `docs/OPERATIONAL_CONTRACTS.md`. PR #277 (`feat/blender-aerial`) merged at 18:15Z as `4a8e1b5`, after the local worktree was cut. No feature PR is open at this moment, but they have been arriving about once an hour.
7. **Governance constraint on any new plan:** the founder record says merging or discarding #85/#86 requires "a deliberate reconciliation decision". A new plan revision should propose that disposition explicitly, not silently replace them.

---

## 1. Draft PR #85 — competitive video REA

| Field | Value |
|---|---|
| Title | "research: complete competitive video REA (implementation-ready plan; engines OFF)" |
| State | OPEN, Draft. Author TheHalfMoon. Created and last updated 2026-10-22 (15:43:36Z) |
| Branch | `research/competitive-video-rea-2026-10-22`, head `7472a14`, merge-base with main `a3c3ce9`, 13 commits |
| Size | +847 lines, 8 files, all under `docs/research/competitive-video-rea-2026-10-22/` |
| Discussion | One issue comment by the author (2026-10-22T15:34:49Z, "Independent review of REA package @ 6b94ae9", six points). No reviews, no inline comments |

### 1.1 Files (branch `research/competitive-video-rea-2026-10-22`)

| File | Lines | Content |
|---|---|---|
| `00_INDEX.md` | 51 | Status, baseline, evidence grades, definition-of-done checklist, non-goals |
| `01_COMPETITOR_AND_SOURCE_REA.md` | 100 | Competitor capability map, the engine seam inspected in Yamakan, donor-source matrix with pins |
| `02_BENCHMARK_AND_CONTINUATION_PLAN.md` | 93 | Benchmark categories A–G, ten experimental rules, the REA-01..06 backlog, hardware note |
| `03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md` | 192 | Exact pins, modules, dependencies, copy-versus-build decisions and Yamakan targets |
| `04_TARGET_ARCHITECTURE_AND_ROADMAP.md` | 158 | Product thesis, hard rules, generation-to-edit pipeline, E-SEC checklist, roadmap R0..G |
| `05_PRODUCT_CAPABILITY_MATRIX.md` | 87 | Feature by evidence-grade matrix for Higgsfield, Runway, Kling, Luma, Yamakan-now, Yamakan-target |
| `06_OUTPERFORM_GAPS_AND_PATH.md` | 101 | The draft's own view of where Yamakan wins today and where it cannot match, paths P0–P3, founder decisions recommended |
| `07_ENGINE_DECISION_AND_E0_E2_GATES.md` | 65 | "Diffusers first, ComfyUI fallback", budget table, worker contract, gates E0–E4, risk register |

### 1.2 Competitor conclusions

- All competitor rows are **DOCUMENTED** from official API documentation dated 2026-10-22. None is **TESTED**. No paid generation was run.
- Higgsfield Cinema Studio 4.0 API: 4–30 s, 480p or 720p, up to 30 image / 10 video / 10 audio references, enumerated era, genre, light, pacing, lens, camera and palette controls. Edit and extend go through separate Seedance 2.5 endpoints.
- Runway: Gen-4.5, Aleph 2.0 and a multi-lab catalog whose displayed count changed between snapshots (57, 58, 59) — the PR says never to freeze that number.
- Kling: capability map updated 2026-10-20; Kling 4.0 at 3–30 s and 720p–4K; Elements; Motion Control on 3.0 and 2.6.
- Luma: legacy `ray-2` / `ray-flash-2`; the newer Agents API documents `ray-3.2`.
- Higgsfield's public GitHub organisation has a CLI, SDK, skills and templates; its `higgsfield` repository is an old training framework and is **not** the Cinema Studio backend.
- Stated conclusion: there is "no supported evidence" that Yamakan matches or beats any of them in AI-video output, and "superiority is a test result, not a build target".

### 1.3 Proposals

- **Thesis:** "Offline-first, agent-native, reproducible cinematic production studio", competing on "complete editable outcome ownership, privacy, cost transparency, and agent reliability".
- **Engine:** an out-of-process **Diffusers-first** sidecar behind the existing `EngineAdapter`, ComfyUI as gated fallback. First checkpoint Wan2.2 TI2V-5B, CogVideoX-2B as alternate, LTX-2 / Wan 14B / Hunyuan deferred. Budget: at least 24 GB VRAM and about 34.2 GB of checkpoint.
- **Hard rules:** one project and timeline model; the sidecar is never a second persistence owner; providers are a separate disabled router path; Cinema metadata is not optical conditioning until a measured compiler exists; no unrestricted ComfyUI custom-node graphs.
- **Roadmap:** R0 (this package) → R1 engineering-plan PR → E0 adapter skeleton behind flag → E1 containment under E-SEC → E2 no-weights dry run → **F** founder decision → E3 pin one checkpoint → E4 local smoke with three seeds → B1 Category A expansion ("can start now") → B2 blind text-to-video subset → P provider adapters → **G** release decision ("NO-GO until G").
- **Paths:** P0 without F (editing depth, H1–H5 residuals, control-compiler and character-pack schemas as fixtures); P1 with F and a capable GPU; P2 optional providers, off by default; P3 things not to prioritise.
- **Explicitly outside the roadmap:** enabling engines on the Intel UHD QA machine, downloading 14B / 32 GB-class weights, vendoring ComfyUI or competitor UIs, claiming Cinema metadata as generation control, "beats Higgsfield" as a release goal, fabricating review passes.

### 1.4 Task list

| ID | Subject | Status inside #85 |
|---|---|---|
| REA-01 | Product reality map | CLOSED (research) |
| REA-02 | ComfyUI ↔ EngineAdapter | CLOSED (research; no code integration) |
| REA-03 | Open model qualification | CLOSED (Wan TI2V-5B first; no downloads) |
| REA-04 | Cinema / consistency gap | CLOSED ("metadata ≠ conditioning; control compiler planned") |
| REA-05 | Editorial agent | CLOSED (reuse command registry) |
| REA-06 | Benchmarks and reviews | "PROTOCOL LOCKED; runs NOT EXECUTED" |

Benchmark categories: A offline deterministic editing, B text-to-video, C image/reference-to-video, D video-to-video editing, E agent-directed production, F safety/autonomy/ownership, G localisation and editing UX. A win needs more than 50% blind preference with the 95% lower bound above 50%, at least 60 matched tasks and three raters per pair.

### 1.5 Verified versus assumed

| Verified in #85 | Assumed or not run |
|---|---|
| Baseline main `a3c3ce9`; engines and providers off; only `contract.ts` and `fake.ts` exist in `core/engines/` | Any paid competitor output |
| Donor pins re-checked through the GitHub API (ComfyUI `1a82e6d`, Wan2.2 `1ea34ff`, Diffusers `48cdbae`, LTX-2 `e98f6d9`, VBench `fd18b3d`, CogVideo `7a1af71`) | Any local model inference (no CUDA host; downloads forbidden) |
| Yamakan short Windows edit/export campaign (earlier receipts) | Any VBench score or blind human study |
| QA host: Intel UHD, no `nvidia-smi`, C: about 1.9 GB and D: about 12.7 GB free | "Zero-cost capable GPU slot NOT CONFIRMED"; Kaggle/Colab free compute explicitly not assumed |
| — | D1 / Alibaba / Graft reviews: "NOT AVAILABLE in this session (not invented)" |

### 1.6 What has overtaken #85 on main

- Its **Diffusers-first local spine was never built.** #86 already downgraded it to "a candidate". Main then took a different route: a ComfyUI adapter (PR #188, `b6f2581`) and a Kaggle-driven recipe path (PRs #200–#235).
- Its **24 GB local GPU premise is moot.** The founder ruled on 2026-11-05 that Kaggle is the zero-cost GPU and that no weights go on the founder's PC.
- Its **first-model order was reversed** by founder decision: CogVideoX-2B first (#201, `e35babb`), Wan2.2 TI2V-5B second (#202, `6e224b3`).
- Still valid: the "metadata is not conditioning" rule, the no-superiority-claim rule, the benchmark protocol (never run), release NO-GO.

---

## 2. Draft PR #86 — the Ultimate Master Plan

| Field | Value |
|---|---|
| Title | "research: founder master plan with verified gaps and gated Cursor roadmap" |
| State | OPEN, Draft. Author TheHalfMoon. Created 2026-10-23T19:43Z, last updated 2026-10-24T02:24:59Z |
| Branch | `research/ultimate-master-plan-2026-10-23`, head `caec7d9`, merge-base `a3c3ce9`, 7 commits (`790c583`, `d34bd4c`, `3e15bab`, `135a797`, `f1e716f`, `58f030b`, `caec7d9`) |
| Size | +18,575 lines, 55 files |
| PR description | Verdict "PLAN PARTIALLY READY — EXPLICIT RESOURCE OR RESEARCH BLOCKERS"; "Draft: do not merge this planning PR automatically." |
| Discussion | **Zero** comments, zero reviews, zero inline comments (checked twice). The only review record is inside the package itself (`evidence/plan-review-*.json`, doc 21) |

### 2.1 Every file

`docs/adr/0004-canonical-creative-project-and-qualified-execution.md` (20 lines) — ADR choosing Architecture D; "accepted as a planning recommendation"; not on main (main has ADR 0001–0003 only).

Under `docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/`:

| File | Lines | One-line description |
|---|---|---|
| `00_EXECUTIVE_STRATEGY.md` | 38 | Decision, verified frontier, verified gaps, six-point winning strategy, shortest path |
| `01_CURRENT_CODEBASE_AUDIT.md` | 182 | Source audit at `a3c3ce9`: call graphs, 49 subsystem statuses, findings AUD-01..12, negative-test packet |
| `02_COMPETITOR_MASTER_MATRIX.md` | 46 | Cross-competitor capability matrix with evidence grades |
| `03_CUTY_DEEP_REA.md` | 56 | Cuty: task-focused model forms, source-inspected CLI lifecycle |
| `04_HIGGSFIELD_DEEP_REA.md` | 70 | Higgsfield: cinematic/reference/motion/agent workflows; private backend not a donor |
| `05_RUNWAY_DEEP_REA.md` | 97 | Runway: model breadth, Agent/Workflows, timeline iteration, SDK lifecycle |
| `06_OTHER_COMPETITORS_REA.md` | 61 | Kling, Luma, Seedance, Flow, Pika, PixVerse, Vidu |
| `07_PROFESSIONAL_EDITORS_REA.md` | 38 | Professional editors as the finishing benchmark |
| `08_SOURCE_DONOR_MASTER_MATRIX.md` | 261 | Donor decisions: OpenCut/OpenVideoStudio/OpenMontage ADAPT; FFmpeg/OTIO/whisper.cpp WRAP; ComfyUI/Diffusers WRAP candidates; MLT/faster-whisper DEFER; Kdenlive/Shotcut REJECT transplant; Blender discovery-only DEFER |
| `09_ARCHITECTURE_OPTIONS.md` | 56 | Options A–D, weighted matrix, sensitivity analysis, ten-perspective adversarial table |
| `10_FINAL_TARGET_ARCHITECTURE.md` | 112 | Authority map, canonical v5 documents, staged upload, AG-DOCS, `restoreHold`, EngineAdapter v2 |
| `11_PRODUCT_UX_MASTER_PLAN.md` | 44 | Story / Edit / Finish information architecture, six journeys, accessibility, UX qualification |
| `12_PROFESSIONAL_EDITING_ROADMAP.md` | 56 | Delivery order, workload profiles S/M/L/H/A/K, measurement budgets, MLT escalation gate |
| `13_GENERATIVE_ENGINE_INTEGRATION_PLAN.md` | 44 | Candidate workers, sequence E0–E4, manifest and input policy, Plume compatibility |
| `14_AGENTIC_PRODUCTION_ARCHITECTURE.md` | 42 | Ten-step editable-outcome pipeline, durable workflow semantics, transport parity |
| `15_DIFFERENTIATION_AND_FEATURE_PRIORITIES.md` | 42 | Capability decision table (priority and approach), four differentiation hypotheses |
| `16_BENCHMARK_AND_EVALUATION_PLAN.md` | 58 | Categories A–L, sampling and statistics, sources |
| `17_SECURITY_COST_AND_RESOURCE_GATES.md` | 59 | Feasibility classes, security boundaries, budget ceiling 0, release gate table |
| `18_ATOMIC_IMPLEMENTATION_TASKS.md` | 1649 | Full contract for each of the 44 YU tasks |
| `19_TASK_DEPENDENCY_GRAPH.md` | 192 | DAG, 14 waves, critical spine, safe parallelism, activation groups |
| `20_TEST_REVIEW_AND_ACCEPTANCE_MATRIX.md` | 35 | Test selection by changed surface, receipt contents, review policy |
| `21_RISK_REGISTER_AND_DECISION_LOG.md` | 69 | Risks R01–R18, decisions D01–D08, review ledger and repairs |
| `22_CURSOR_IMPLEMENTATION_PROMPT.md` | 67 | Future implementation prompt, "DO NOT EXECUTE IN THIS RESEARCH" |
| `23_FINAL_READINESS_REPORT.md` | 55 | Verdict, 22-item validation table, six unresolved blocks, recommended handoff |
| `24_SOURCE_AND_EVIDENCE_INDEX.md` | 94 | Donor pins and web receipts index |
| `CONTINUATION_LEDGER.md` | 32 | Resume notes; "Continue the existing Draft PR86/branch rather than opening a duplicate. Do not merge." |
| `DEPENDENCY_GRAPH.json` | 523 | 44 vertices, 95 edges |
| `FOUNDER_REPORT.md` | 35 | Answers to 25 founder questions |
| `TASK_REGISTRY.json` | 4397 | Machine-readable registry; `implementationAuthorized:false`, baseline `a3c3ce9` |
| `validate-plan.mjs` | 75 | Planning validator (see 2.9) |
| `evidence/codebase-review.json` | 3939 | 563-file hash inventory and 62 sampled paths |
| `evidence/competitor-cuty.json` | 517 | Cuty captures |
| `evidence/competitor-higgsfield.json` | 1933 | Higgsfield captures |
| `evidence/competitor-runway.json` | 1459 | Runway captures |
| `evidence/current-session-gates.json` | 15 | Gates as observed in the research session |
| `evidence/d1-advisory.json`, `d1-advisory-retry.json` | 12, 11 | d1 advisory results (first call returned 400; retry scored 0.46465 — advisory only) |
| `evidence/donor-discovery-only.json` | 120 | Ten discovery-only donor candidates |
| `evidence/donor-public-source-captures.json` | 711 | 72 raw donor file captures with pins |
| `evidence/donor-review-findings.json` | 244 | 17 static adaptation observations |
| `evidence/github-*.json` (six one-line files) | 6 | Live ref, PR and issue metadata snapshots |
| `evidence/graft-structural.json` | 17 | Graft graph: 103 files, 1034 nodes, 2642 edges (structural only) |
| `evidence/official-web-receipts.json` | 422 | Official web page receipts (Kaggle docs recorded as UNKNOWN) |
| `evidence/plan-review-correctness.json`, `-correctness-delta.json` | 168, 76 | Correctness review and re-review |
| `evidence/plan-review-security.json`, `-security-delta.json` | 122, 100 | Security review and re-review |
| `evidence/plan-validation.json` | 42 | Validator output, `PASS_WITH_EXPLICIT_LIMITATIONS` |
| `evidence/vbench-source.json` | 56 | Five-file VBench source inspection |

### 2.2 Product thesis

Verbatim decision (doc 00): "Build **a dependable, editable film workspace for bilingual solo creators**, with professional editing as the foundation and qualified generation as an optional source of media. The first customer promise should be: finish, revise, reopen and recover a complete short film on an ordinary Windows computer. An AI marketplace is neither a defensible first product nor feasible on the current unverified GPU and zero-spend budget."

Four differentiation **hypotheses** (doc 15), each explicitly unproven:
1. "A finished project remains yours."
2. "Revise one shot without losing the edit."
3. "Bilingual finishing with professional precision."
4. "An agent you can supervise and resume."

The plan adds: "A zero-inference-cost disabled feature is not a creative quality advantage."

### 2.3 "Verified gaps"

From doc 00 and the audit (doc 01). The plan calls them "new findings outside the completed W1–W18/P10 scope, not a reopening".

| ID | Finding at `a3c3ce9` |
|---|---|
| AUD-01 | Creative state (Studio, Cinema, Director) is not protected by canonical recovery or backup |
| AUD-02 | Sidecar writes lack transactional concurrency and idempotency |
| AUD-03 | Studio loses session state on dispose or reload |
| AUD-04 | Quality Lab schema allows duplicate A/B slots; evidence hash under-binds |
| AUD-05 | MCP ingress bounds incomplete (oversized complete lines; no admission cap) |
| AUD-06 | Waveform work re-fetches and re-decodes whole assets on every revision |
| AUD-07 | Editing envelope narrow: 30 fps, 200 assets/clips, 16 tracks, ten minutes, 1080p |
| AUD-08 | Animation filter graph grows with frame count (up to 18k stages) |
| AUD-09 | Effects UI code is not a canonical or export capability |
| AUD-10 | Evidence and frontier narratives diverge (`specs/CURRENT.md` holds an older head) |
| AUD-11 | Cinema and Director activation overstates the creator journey (cube proxies, smoke controls) |
| AUD-12 | Uniform job extensibility not demonstrated (export and CFR only; fake engine) |

Plus one environment finding: a fresh checkout had no dependencies and no native helper, so `tests/time.test.ts` failed at a missing `zod` — recorded as "environment failure, not a passing test or proven source regression".

### 2.4 Architecture proposals

- **Architecture D** — "one canonical creative project, one durable execution service, several qualified media tools". Weighted scores: A narrow extensions 3.77, B modular professional editor (MLT/FFmpeg native) 3.29, C unified agent-native system 2.74, **D 4.30**. Weights 15, 15, 12, 12, 14, 10, 10, 7, 5.
- **Stated reversal conditions:** if editing depth carries 60% of the weight, B overtakes D (about 4.20 versus 4.14). If D's reliability and maintenance scores each fall two points, D falls to 3.72, below A — "Stop the migration expansion rather than hiding that failure."
- **Canonical v4 → v5**: a bounded `documents` list of `{id, kind, schemaVersion, contentHash}`; kinds `studio`, `cinemaScene`, `story`; immutable `creative_documents` and `snapshot_document_refs` tables in the existing database.
- **Streamed staging route** `POST /v1/projects/:projectId/documents/stage` (8 MiB document ceiling) so the 2 MiB general command limit stays unchanged. Commands `yamakan.document.{get,list,commit,importLegacy}`.
- **Activation group AG-DOCS**: YU-010..015 must qualify together before v5 persistence is switched on.
- **Consent is workspace security state**, not undoable artistic history. Restoring a revision cannot resurrect a revoked grant.
- **Restore is not execution authorisation**: a restored workspace gets a fresh execution epoch and a durable `restoreHold`; zero worker spawns or provider requests on open.
- **EngineAdapter v2**: typed operations (`textToVideo`, `imageToVideo`, `videoEdit`, `transcribe`, `enhance`) with immutable asset references and capability reasons (`ENGINE_DISABLED`, `WEIGHTS_ABSENT`, `HARDWARE_UNQUALIFIED`, `RIGHTS_UNQUALIFIED`, `CONTROL_UNSUPPORTED`); v1 kept behind a bridge. "Select **one** first real worker only after rights, supported operation, hardware, containment and artifact tests."
- **Change to #85**: "Replace the unconditional Diffusers-first recommendation in PR #85 with a capability-driven qualification decision; Diffusers remains a serious candidate, not a product dependency or selected checkpoint."
- **UX**: three workspaces — Story, Edit, Finish — sharing one asset library, selection, revision stream and job tray. Six journeys (idea to film, footage to export, consistent sequence, agent commercial, Arabic/English production, repair footage).
- **Agentic production**: brief → plan shots → resolve references → propose → human approve → execute → attach → evaluate → revise → finish. Approval binds exact proposal and output hashes; no "agent execute" endpoint.
- **Native preview escalation gate**: a bounded MLT spike only if profiles S/M miss the approved policy; "A failed spike is a valid result."

### 2.5 The gated roadmap

Task states: `PLANNED → READY → IN_PROGRESS → TESTING → REVIEW → MERGED → VERIFIED` (plus BLOCKED / DEFERRED / REJECTED). Approaches: COPY / ADAPT / WRAP / COMBINE / BUILD / DEFER / REJECT.

| Phase | Theme | Tasks |
|---|---|---|
| 0 | Baseline and hygiene | YU-000, 001, 002, 003 |
| 1 | Integrity, bounded media, editing | YU-010..026 |
| 2 | Shell, story, takes | YU-030, 031, 032 |
| 3 | Engine contracts (no model) | YU-040, 041, 042, 043 |
| 4 | Cinematic controls and continuity | YU-050, 051 |
| 5 | Agentic production | YU-060, 061, 062 |
| 6 | Audio and repair | YU-070, 071, 072 |
| 7 | Portability and selective revision | YU-080, 081 |
| 8 | Benchmark and qualification | YU-090, 091, 092, 093 |
| 9 | Release gates | YU-100, 101 |

- **DAG**: 44 vertices, 95 edges, 14 waves. Full dependency list per task is in section 3.
- **Critical spine**: `YU-000 → 001 → 010 → 015 → 018 → 019 → 020 → 032 → 060 → 061 → 081 → 093 → 100 → 101`. The plan says this is "not a duration-weighted schedule".
- **Blocked at authoring time**: YU-072, YU-092, YU-093, YU-101.
- **Gates**: E0 contract → E1 containment → E2 no-weights qualification → E-SEC → **F** (immutable code/runtime/weight manifest, exact host, allowed data, maximum spend, retention) → E3 first real qualification (three fixed-seed smoke attempts — "operational smoke, not a quality benchmark") → E4 applied controls. Release gates table: H1–H5 OPEN, signing OPEN, JASSUB DISABLED, E-SEC OPEN for real inference, F DEFERRED, **G NO-GO**.
- **Recommended first authorisation**: YU-000/001, then YU-010..015; YU-002, 003 and 016 as disjoint fixes after baseline.
- **First creator milestone**: "manually create/import three shots, persist Studio/scene/story, edit, export, kill/reopen and restore exact project without any model."
- **Early product checkpoint**: after the integrity group, freeze one bilingual short-film finishing brief and run a small formative walkthrough before expanding later phases.

### 2.6 Benchmark and evaluation proposals

- Categories: A professional editing, B text-to-video, C image-to-video, D generative editing, E cinematic control, F character/scene continuity, G audio/video synchronisation, H agentic production, I privacy/recovery, J UX/task completion, K cost per finished video, L hardware/resource efficiency.
- Outcomes: YAMAKAN WINS / MATCHES / LOSES / INCONCLUSIVE / NOT TESTED. **Every head-to-head category is NOT TESTED.**
- Sampling: 60-task creative pilot plus a 5–8 person formative UX study; about 196 independent pairs to detect 0.60 versus 0.50 at alpha 0.05 and 80% power; 240 prompts per definitive cohort; three raters per pair; Wilson intervals, paired bootstrap, clustered confidence intervals, Holm adjustment. MATCHES needs an equivalence margin.
- Workload profiles: S (30 s 720p30), M (5 min 1080p30, 100 clips), L (30 min, 1000 clips), H (60 s 4K with proxy), A (10 min, 16 audio tracks), K (100 animated clips).
- Rules: "zero disabled inference not a win"; "metadata-only fails applied-control claim"; native Arabic raters for Arabic content; VBench pinned `fd18b3d` as evaluation-only. "No benchmark download, evaluator weights or paid sample generation is authorized now."

### 2.7 Decisions requested from the founder

- FOUNDER_REPORT Q24: "Approve a bounded implementation scope after reading; later choose supported profile/customer priorities, qualified humans/admin resources and artifact release actions. GPU/model/provider/spend authorization remains separate and optional."
- Doc 23: separately authorise YU-000/001, then YU-010..015.
- Implied by the gates: decision F (weights, host, spend), decision G (release), and supplying the people for H1–H5.

Decision log D01–D08 (already taken inside the plan): D01 preserve the existing main foundation and completed P10; D02 Architecture D; D03 operation-based engine v2 with a v1 bridge; D04 conditional worker qualification, not unconditional Diffusers-first; D05 editing and recovery before inference; D06 whisper.cpp first for transcription; D07 no whole-editor or ComfyUI marketplace merger; D08 public release NO-GO, no Plume training, no Paradigm edits.

### 2.8 Explicitly rejected or deferred

- **REJECT:** unrestricted custom-node or plugin execution; whole donor applications, databases or queues; a new model-training program or Paradigm changes; hidden browser-only edits; invented camera adherence; automatic paid retries; Kdenlive/Shotcut transplants.
- **DEFER:** hosted model marketplace; first checkpoint and Plume inference; camera/depth/pose/identity conditioning; diarisation, dubbing, voice cloning, lip sync; neural upscale, interpolation, restoration; native MLT or GPU preview replacement; HDR/ACES, deep compositing, multicam; team and cloud collaboration; Blender (discovery-only).
- **Competitor claims the review rejected:** that Runway has no timeline; that Cuty's Runway marketing page proves Runway model access; that Higgsfield's public CLI repository contains its backend.

### 2.9 What #86 says about its own limits

- Six unresolved blocks (doc 23): (1) current runtime environment; (2) whole-source depth — 563 files inventoried, 62 sampled; (3) donor closure — 14 scoped, 10 discovery-only; (4) generative resources and rights; (5) competitor execution — no authenticated product task; (6) human and external release gates.
- Review ledger: reviews were done by session-model reviewers on heads `3e15bab` and `135a797`. The ten-perspective table is "a deliberate adversarial analysis, not ten independent human reviews". d1 "did not determine architecture or approve any gate". Alibaba OCR: no LLM-backed run.
- Repairs made during review: 8 MiB document versus 2 MiB ingress → streamed staging; AG-DOCS group evidence; restored execution authority → fresh epoch and `restoreHold`; sandbox positive controls; YU-022 limited to opacity and volume; frozen bilingual finishing brief.
- `validate-plan.mjs` enforces: 25 numbered documents, required task fields, 40-hex donor pins, no task authorised or advanced, an acyclic DAG matching the registry, AG-DOCS with exactly six tasks, link resolution, score arithmetic, a **docs-only changed-file scope** (only its own directory and ADR 0004), and that the three disabled flags are still `false` in source.
- Doc 22: "The plan does not supersede later verified engineering." and "Do not merge or replace PR85 automatically."

---

## 3. Status of every #86 task on main `0284ba8`

Sources: `docs/evidence/ultimate/EXECUTION_LEDGER.md` (YU receipts), `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/LEGACY_RECONCILIATION.json` (successor mapping), `.../TASK_REGISTRY.json` (SS states), `.../12_EXECUTION_AND_CONTINUATION_LEDGER.md` (live record). The four status labels are mine; where a YU task has no YU receipt and I judge it by its SS successor, that is **(inference)** and flagged.

| Task | Objective (from #86) | Depends on | Status on main | Evidence |
|---|---|---|---|---|
| YU-000 | Freeze artifact-bound baseline | — | DONE-ON-MAIN | #88 → `01ccbe5` |
| YU-001 | Reproduce environment baseline | 000 | DONE-ON-MAIN | #88 → `01ccbe5`. Successors SS-002 (#154 `495f76d`, verified), SS-017 (open) |
| YU-002 | Quality Lab evidence complete | 001 | DONE-ON-MAIN | #87 → `b5c3372` |
| YU-003 | Bound MCP frames and requests | 001 | DONE-ON-MAIN | #90 → `0fe9a18` |
| YU-010 | Immutable creative document refs, canonical v5 | 001 | DONE-ON-MAIN | #91 `fc4913e`, #92 `a468345`, #93 `49f1a9e` |
| YU-011 | Persist Studio canvas and bitmaps | 010 | DONE-ON-MAIN | #94 → `ccdde01` |
| YU-012 | Migrate Cinema sidecars | 010 | DONE-ON-MAIN | #96 → `b49721b` |
| YU-013 | Director attempts and consent into SQLite | 010 | DONE-ON-MAIN | #97 `8747694`, #101 `432b863`. Hardened by SS-001 (#153 `79fc86f`), SS-003 (#156 `c129a50`) |
| YU-014 | Complete creative backup/restore | 011, 012, 013 | DONE-ON-MAIN | #101 → `432b863` |
| YU-015 | Browser editing via canonical ops, durable undo | 010 | DONE-ON-MAIN | #99 → `dbf787f`. Later #177 `22d7bb6` (undo across document saves) |
| **AG-DOCS** | Activation group for YU-010..015 | — | **ACTIVATED** | #102 → `75921bc`; rollback switch `YAMAKAN_AG_DOCS_OFF=1` |
| YU-016 | Waveform peak tiles | 001 | DONE-ON-MAIN | #95 → `69118c0` |
| YU-017 | Thumbnails and proxy policy | 016 | DONE-ON-MAIN | #111 → `c44d041` |
| YU-018 | Preview cache, audio clock, parity subset | 017, 015 | DONE-ON-MAIN | #113 → `dc483c9`. Successor SS-009 (#165 `596a20c`, open: 25 fps on AC), SS-010 waiting |
| YU-019 | Rational project fps | 015, 018 | DONE-ON-MAIN (24000/1001 only) | #117 → `83bfa54` |
| YU-020 | Typed transform/crop effect | 019 | DONE-ON-MAIN | #121 → `021ccdd` |
| YU-021 | One frame-exact crossfade | 020 | DONE-ON-MAIN | #129 → `4b6d652` |
| YU-022 | Bounded animation compilation | 019 | DONE-ON-MAIN (opacity and volume) | #123 → `5e51b28` |
| YU-023 | SDR colour metadata and bounded LUT | 020 | DONE-ON-MAIN | #130 → `7cdfa86` |
| YU-024 | Editable imported caption tracks | 019, 015 | DONE-ON-MAIN, human review pending | #125 → `c408bbe`; H1 pending. Successor SS-013 (#175 `987dcd2`, open on X-01) |
| YU-025 | Verified relink, batch variants | 014, 020 | DONE-ON-MAIN | #133 → `5eadedf` (workspace schema 15) |
| YU-026 | Qualify scale profiles before raising limits | 018, 019, 022, 016 | **PARTIALLY DONE** | #135 `4cb19e3`, #136 `52b744a`, #147 `4d3cc2d`, #150 `68f74b6`, #152 `ad5b12b`. S and T export-qualified; "M stays unqualified under policy v3". SS-005a verified (#160 `e534106`); SS-005b pending |
| YU-030 | Story/Edit/Finish navigation | 011, 012, 013, 015 | DONE-ON-MAIN | #115 → `bfe61e5`. Create, Cinema and Blender surfaces were added later outside this task |
| YU-031 | Story/shot/reference pack lifecycle | 010, 013, 030 | DONE-ON-MAIN | #119 → `905f81a` |
| YU-032 | Non-destructive take compare/replace | 031, 020, 002 | **PARTIALLY DONE** | #127 → `95906ac` ("no editor UI yet"). Director review via SS-006 (#164 `26c4c4d`). Editor UI = SS-011, waiting |
| YU-040 | EngineAdapter v2 with artifact handles | 010, 003 | DONE-ON-MAIN | #105 → `71a727d` |
| YU-041 | Worker profile with no-model stand-ins | 040, 001 | DONE-ON-MAIN | #107 → `0b50a43` |
| YU-042 | Missing-weights discovery without downloads | 040, 041 | DONE-ON-MAIN | #109 → `a4b0278` |
| YU-043 | First-engine manifests and qualification choice | 042 | DONE-ON-MAIN as scoped; **premise SUPERSEDED** | #143 → `037cc7a` (native Wan2.2 blocked, two Diffusers candidates eligible, no winner). In practice the first engines arrived through Kaggle recipes, not this choice (inference) |
| YU-050 | Cinematic intent → supported conditioning | 031, 040 | **PARTIALLY DONE** | #139 → `61c0012`; depth and pose unsupported |
| YU-051 | Continuity references and consent checks | 031, 013, 040 | DONE-ON-MAIN | #144 `fdfffcc`, #149 `9f2c401`. Extended by #181 `223bc2d` (consent gate), #237 `8175764` (People and consent) |
| YU-060 | Revision-bound creative proposals with human review | 015, 013, 032 | **PARTIALLY DONE** (inference) | No YU receipt. Successor SS-006 verified (#164 `26c4c4d`) but covers take proposals in Director review only |
| YU-061 | Resumable three-shot imported-media production | 060, 014, 031 | **PARTIALLY DONE** | No YU receipt. SS-004a verified (#157 `9281002`, receipt `docs/evidence/ultimate/SS-004-creative-journey.md`). SS-004b and SS-008 waiting |
| YU-062 | Stable request IDs and progress parity | 003, 060, 061 | **PARTIALLY DONE** | No YU receipt. SS-007 slices #169 `aaaf799`, #170 `ac8385a`, #172 `1c33c34`; card open |
| YU-070 | Transcription contract stand-in before weights | 024, 041, 042 | DONE-ON-MAIN as scoped (stand-in only) | #145 → `0322049`. No real speech recognition exists |
| YU-071 | Deterministic repair/analysis operations | 017, 040 | **PARTIALLY DONE** | #138 → `7f17434`; scene-cut detection only |
| YU-072 | Neural enhancement/interpolation (was BLOCKED) | 043, 019, 071 | NOT STARTED | Mapped to X-03 (EXTERNAL_BLOCKED) |
| YU-080 | Portable project, explicit interchange loss | 014, 025, 031 | **PARTIALLY DONE** | No YU receipt. SS-015 slices #184 `32187fe`, #185 `3a06b40`, #189 `335f21b`; card open |
| YU-081 | Selective revision as a product advantage | 032, 061, 080 | NOT STARTED | SS-016 waiting on SS-004b and SS-011 |
| YU-090 | Benchmark recording/analysis harness | 002, 000 | DONE-ON-MAIN | #104 → `2baa695` |
| YU-091 | Windows editor/recovery/performance qualification | 026, 014, 030, 024, 025, 062, 090 | NOT STARTED as a consolidated run | SS-018 waiting |
| YU-092 | Real engine and comparative quality with F (was BLOCKED) | 043, 050, 051, 090, 041 | **SUPERSEDED in part, NOT STARTED in part** | Real engines now run through Kaggle (#201, #202, #222). The comparative-quality half is untouched → X-03 |
| YU-093 | Native Arabic and usability evaluation (was BLOCKED) | 030, 024, 081, 090 | NOT STARTED (external) | X-01 EXTERNAL_BLOCKED; SS-013 |
| YU-100 | Exact-artifact release gates | 091, 093 | NOT STARTED | SS-019 waiting |
| YU-101 | External clean-profile/account/disk/signing/founder gates (was BLOCKED) | 100 | NOT STARTED (external) | X-02 EXTERNAL_BLOCKED; issue #77 |

Count (44 tasks): 24 done as written, 5 done as scoped or with a caveat (YU-019, 022, 024, 043, 070), 8 partial (YU-026, 032, 050, 060, 061, 062, 071, 080), 7 not started (YU-072, 081, 091, 092 comparative half, 093, 100, 101). 33 tasks have a YU ledger row; the ledger has **no row or receipt** for the other 11 — YU-060, 061, 062, 072, 080, 081, 091, 092, 093, 100, 101.

### 3.1 Gaps #86 listed as open that are now closed

The AUD-to-task mapping below is **(inference)** from task objectives; the merge evidence is from the ledger.

| #86 gap | Now | Closed by |
|---|---|---|
| AUD-01 creative state outside recovery | **Closed** | YU-010..014, AG-DOCS #102 `75921bc` |
| AUD-02 sidecar concurrency | **Closed** | #96, #97, #101; hardened by #153, #156 |
| AUD-03 Studio session-local | **Closed** | #94 `ccdde01` |
| AUD-04 Quality Lab schema and hash | **Closed** | #87 `b5c3372` |
| AUD-05 MCP ingress bounds | **Closed** | #90 `0fe9a18`; MCP now also needs an agent token (#252 `c8ef4fa`) |
| AUD-06 waveform re-fetch | **Closed** | #95 `69118c0` |
| AUD-07 narrow editing envelope | **Partly closed** | 24000/1001 (#117); profiles S and T qualified; M export not; resource limits remain frozen |
| AUD-08 animation graph growth | **Closed** for opacity and volume | #123 `5e51b28` |
| AUD-09 effects not canonical | **Partly closed** | transform/crop #121, crossfade #129, SDR colour/LUT #130; no general effect stack |
| AUD-10 stale frontier narrative | Closed at the time (#88); **has recurred** (inference) | `specs/CURRENT.md` top section is dated 2026-11-04 and does not describe the Kaggle, Create, Cinema or Blender streams |
| AUD-11 Cinema/Director overstated | **Largely closed** | #243–#248 (Cinema), #259, #263, #264 (Director → Blender → timeline). "The AI camera stays off." |
| AUD-12 job extensibility | **Closed** | #105, #107; then real job kinds: Kaggle runs (#209), `blender-render` (#256), `blender-track` (#275) |
| "No real enabled generation" | **Overtaken** | #201 `e35babb` (first real AI video), #202 `6e224b3`, #222 `777d56e` (first image-to-video) |
| "Kaggle unverified / no free GPU" | **Overtaken** | Founder decision 2026-11-05; durable Kaggle runs #209 `160823e` |
| "Fresh checkout cannot run tests" | **Closed** | #88; setup diagnostics #162; preflight #154 |
| "Blender DEFER, discovery-only" | **Overtaken** | Founder decision 2026-11-10; #256 onward |

### 3.2 Gaps #86 listed as open that are still open

- All release gates: H1, H2, H3, H4, H5, signing/installer/update, G (issue #77).
- JASSUB disabled pending CSP `wasm-unsafe-eval` review. Q15 OS user presence not built.
- `ENGINE_ENABLED` and `ROUTER_PROVIDERS_ENABLED` still `false`; no local recipe; commercial providers off.
- Every benchmark category A–L: NOT TESTED. No competitor head-to-head run.
- M-profile export. Profiles L, H, A, K never attempted (inference: no receipt found).
- Depth/pose/identity conditioning; real speech recognition; neural enhancement; dubbing and lip sync.
- Selective revision (YU-081), consolidated Windows qualification (YU-091), release evidence packet (YU-100).
- The "early product checkpoint" (frozen bilingual finishing brief plus formative walkthrough): no evidence found that it was run **(inference from absence)**.

---

## 4. History since `d1936f7` (85 commits, 19 merged PRs: #258–#276)

`d1936f7` is the merge of PR #257 (`npm run qualify:blender-slice`). Everything since is the Blender / Cinema / Director / prompt-library stream authorised by the founder entry "2026-11-10: Blender integration, and YouMind OpenLab as its extension". All 19 PRs merged on 2026-11-11 (local time), roughly one every 60 minutes.

| Theme | PRs (merge SHA) | Capability delivered |
|---|---|---|
| Blender worker hardening | #258 (`17c7388`), #265 (`91baa32`) | Still-render negative control; fixes for the second security review's Lows |
| Cinema page drives Blender | #259 (`e3733b0`), #268 (`ccca7c6`) | The Cinema page renders the saved scene with Blender and places it on the timeline; panel offers camera moves and lights. `npm run qualify:cinema-blender` |
| Local prompt library (the "YouMind" extension) | #261 (`e22cf22`), #262 (`eec1887`) | `core/prompts/library.ts`: 21 templates in English and Arabic, searchable offline; `yamakan.prompt.search` / `fill`; presets kept with the project as a `promptPresets` document (`yamakan.prompt.savePresets`, up to 50 presets, up to 32 documents per project). No YouMind or community prompt text was copied; only a category list from an MIT-licensed skill pinned `7a1233b5` |
| Director → Cinema → Blender → timeline | #263 (`39ad5be`), #264 (`cea7159`) | `core/director/cinema-shot.ts` plans a story shot as a Cinema scene; `core/director/cinema-pipeline.ts` and `yamakan.director.renderShot` carry it to the timeline. `npm run qualify:director-cinema` |
| Shot craft in Blender | #266 (`08e611c`), #267 (`15c330e`), #269 (`e72665a`) | Camera moves (push, pull, pan, handheld); lighting (morning, golden, night, studio); compositing finishes (glow, vignette, film) |
| 3D model import | #270 (`eba977b`), #271 (`08a59ec`), #272 (`d364530`), #273 (`d6b2d6f`) | Strict check of untrusted `.glb` (`core/cinema/glb.ts` `checkGlb`); model store (`cinema_models` table, **workspace schema 18**, SDK `uploadCinemaModel`); Blender renders stored models; Cinema page "Add 3D model (.glb)" with fitted preview. `npm run qualify:cinema-model` |
| Camera tracking and match-move | #274 (`8f87770`), #275 (`9fdd33f`), #276 (`0284ba8`) | Detail surface for tracking; job `blender-track`, `yamakan.blender.track`, `yamakan.track.read`, result `yamakan.camera-track/1`; Cinema objects rendered over tracked footage (`plate: {trackJobId, metresPerUnit}`) |
| Ledger | #260 (`0609493`) | Ledger entry for the Cinema-page Blender control |

Test count at #276: 1,429 tests, 1,426 pass, 0 fail, 3 POSIX skips (on AC power, at `6a69db9`, per the ledger).

Ledger's "Not yet" after #276: "placement against tracked points (floor and origin from features), lighting matched to the footage, a page control, aerial views, object animation."

**Merged after the worktree was cut — PR #277** (`feat/blender-aerial`, head `333c141`, opened 2026-11-11T18:00Z, merged 18:15:25Z as `4a8e1b5`, +190/−15, 7 files; not in the local worktree): render setting `view: "aerial"` (camera 70 degrees above the subject); a view over tracked footage is refused as VALIDATION; the Director planner follows "aerial view". All three checks (`qualify`, `qualify-windows-r8`, `otio-oracle`) passed. Its "Not done": a Cinema page control for the view; object animation.

---

## 5. Broader timeline (PRs #1–#277) and task-ID schemes

277 numbers are used: 274 pull requests — 270 merged, 2 closed unmerged (#56, #204), 2 open drafts (#85, #86) — and 3 issues (#77, #82, #203). Main had 1,233 commits at `0284ba8`. All dates are 2026.

### 5.1 Chronological narrative

| Phase | Dates | PRs | What happened |
|---|---|---|---|
| 0. Prototype | 10-11 | #1 `12c321c`, #2 `0d3bdac` | Earlier "Darzain" prototype; preserved under `docs/history/` |
| 1. First master plan and reviews | 10-11 | #3 `4e2f4b2`, #4 `237518e`, #5 `559ac7f` | Master plan (+7,710 lines), an independent review, a final optimisation pass |
| 2. Offline MVP, tasks T1–T10 | 10-11 → 10-13 | #6–#20 | Boundary, database, canonical model, streamed assets, jobs, edit reducers, shared render and Arabic, preview and UI, recovery and security, Windows MVP |
| 3. MVP qualification follow-ups | 10-13 → 10-21 | #21–#29 | Frozen performance policy, journey fixtures, resource policy v2, MCP/REST parity replay, export goldens, 720p playback, AppContainer and hostile-media corpus |
| 4. Frozen reuse-first plan | 10-18 → 10-21 | #30 `c19a95b`, #31 `4a96b02` | "Frozen Yamakan implementation plan" (tag `plan-freeze-2026-10-18`), then founder start authorisation |
| 5. Tasks W1–W18 and residuals | 10-21 | #32–#55 | Track 1 (W1–W7, MVP) and Track 2 (W8–W18), R6 bundle, R8 fontconfig FFmpeg; M-gate passed at `eaeaf1b` (#42) |
| 6. P10 qualification and activation | 10-21 → 10-22 | #57–#79 (#56 closed) | P10-00..P10-10: Studio, Cinema, Director, Quality Lab, Animation activated; release evidence |
| 7. Rebrand and Windows UX QA | 10-22 | #80, #81, #83 `e8bb8dd`, #84 `a3c3ce9` | Rebrand to Yamakan; Windows UX QA (issue #82, closed); issue #77 opened for the remaining release gates |
| 8. Research drafts | 10-22 → 10-24 | **#85, #86** (open) | Competitive REA, then the Ultimate Master Plan |
| 9. YU execution | 10-25 → 10-28 | #87–#152 | 33 of 44 YU tasks; AG-DOCS activated; receipts in `docs/evidence/ultimate/` |
| 10. System Supremacy plan and handoff | 10-29 → 11-04 | #153, #154, #156 (first three fixes), **#155** `4835cdf`, #158 `9cad22b`, #159 `364e041` | 31-task SS program planned, verified, handed to Claude Opus |
| 11. SS execution | 11-04 → 11-05 | #157, #160–#187, #189, #193 | SS-001..007, 009, 012..015, 017 slices |
| 12. Local AI path | 11-05 | #188, #191, #192, #194–#198 | ComfyUI adapter (off, no recipe), generation path proven end to end with no model, Managed ComfyUI Mode design |
| 13. Kaggle generation and Create workspace | 11-05 → 11-09 | #200–#202, #205–#224, #232–#237 | First real AI video; Create page; durable Kaggle runs; first image-to-video; People and consent |
| 14. Security check | 11-08 → 11-10 | #225–#231, #238–#242, #249–#255 | Five-reviewer check at `c178610`: one High, Mediums, four Low batches, P1 residuals, SBOM |
| 15. Cinema workflow (issue #203) | 11-09 → 11-10 | #243–#248 (#204 closed) | Lens preview, `cinemaScene` document, Arabic |
| 16. Blender and prompt library | 11-10 → 11-11 | #256–#277 | Section 4 |

Two process notes recorded in the ledger itself: "#201 was merged before its independent review, against `AGENTS.md`"; and SS-005a was marked VERIFIED "with builder's ruling" on a CPU-attribution gap, "for the founder to overrule".

### 5.2 Task-ID schemes

| Scheme | Meaning | Defined in | PRs |
|---|---|---|---|
| **P00–P09** | Phases of the first plan (P00 approval, P01 authority, P02 media/runtime, P03 offline film, P04 MVP release, P05 desktop/interchange, P06 Studio/Cinema/router, P07 Director, P08 Motion/Audio/Ads/Flow, P09 Agents/Quality/Collaboration) | `docs/IMPLEMENTATION_PLAN.md`; `specs/CURRENT.md`. P05–P09 are stated there as superseded by the reuse-first plan | — |
| **T1–T10** | The first ten implementation PRs (offline MVP) | `docs/IMPLEMENTATION_PLAN.md`, "First ten implementation PRs"; `docs/ROADMAP.md` | #6–#20 |
| **W1–W18** | Tasks of the frozen reuse-first plan. W1–W7 Track 1 (MVP), W8–W18 Track 2; "Architecture B" | `docs/research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md` (+ `07`, `13_FIRST_IMPLEMENTATION_WAVE.md`, `06_FINAL_ARCHITECTURE.md`) | #32–#54 |
| **M1–M17** | Modules of that plan | same package | — |
| **Q1–Q15** | Qualification tests of that plan (Q7a/Q7b; Q15 = OS user presence, still not built) | same package | — |
| **R1–R8** | Residuals of that plan (R6 bundle install-dev, R7 release evidence, R8 fontconfig FFmpeg) | same package | #40, #41 |
| **M-gate** | R1–R8 merged plus `qualify:release` | same package | passed at `eaeaf1b` (#42) |
| **P10, P10-00..P10-10** | "Qualification, Activation, and Release Readiness" | `docs/plans/P10-qualification-activation/TASKS.md` (+ `MASTER_PLAN.md`, `RELEASE_GATE_MATRIX.md`) | #57–#79 |
| **H1–H5** | Human gates: H1 native Arabic, H2 clean Profile A install/offline, H3 second Windows account, H4 constrained-volume disk-full, H5 founder ship | `docs/PLAN_FREEZE_MANIFEST.md` "External gates"; P10 `RELEASE_GATE_MATRIX.md`; issue #77 | — |
| **E-SEC, F, G** (and D) | E-SEC engine security review; F local AI hardware/weights; G paid providers/release. `AGENTS.md`: "D/F/G stay deferred" | freeze manifest; `docs/FOUNDER_DECISION_RECORD.md` | — |
| **REA-01..06; R0, R1, E0–E4, B1, B2, P; P0–P3 (paths)** | #85's research backlog, roadmap gates and paths | unmerged PR #85 only | — |
| **YU-000..YU-101; AG-DOCS** | "Yamakan Ultimate" — 44 tasks, phases 0–9 | **unmerged PR #86 only** (`TASK_REGISTRY.json`, `18_ATOMIC_IMPLEMENTATION_TASKS.md`). State on main: `docs/evidence/ultimate/EXECUTION_LEDGER.md`, `receipts/`, `baseline.json` | #87–#152 |
| **AUD-01..12; R01–R18; D01–D08** | #86 audit findings, risks, decisions | unmerged PR #86 only | — |
| **SS-001..SS-019** (+004a/b, 005a/b) | "System Supremacy" tasks | `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json`; contracts `09_ATOMIC_IMPLEMENTATION_PROGRAM.md`; live ledger `12_EXECUTION_AND_CONTINUATION_LEDGER.md`; handoff `OPUS_IMPLEMENTATION_HANDOFF.md` | #153 onward |
| **R-01..R-05** | SS research prerequisites (all VERIFIED). Not the same as R1–R8 above | same SS registry | — |
| **X-01..X-03** | SS external blocks: X-01 native Arabic/usability, X-02 release/profile/signing, X-03 real models and comparative quality | same SS registry | — |
| Informal labels | "Lows batch 1–4", "P1 residual", "(#203)" Cinema slices, "3D import step 1 / 2a / 2b / 2c" | SS ledger prose only | #238–#255, #243–#248, #270–#273 |

**Naming hazards for a new plan.** `P0–P3` means priority in #86, paths in #85 and (as `P00–P09`) phases in the first plan. `R` means residuals (R1–R8), research prerequisites (R-01..05), risks (R01–R18) and roadmap steps (R0, R1). `E0–E4` are engine gates in both drafts. A new plan should use a fresh, unambiguous prefix.

### 5.3 Vocabulary in force on main

- YU ledger states: `PLANNED → IMPLEMENTED → MERGED → VERIFIED`.
- SS registry states: VERIFIED / AGGREGATE / QUALIFICATION_READY / WAITING_DEPENDENCIES / EXTERNAL_BLOCKED.
- SS registry snapshot (it may lag the ledger): VERIFIED — SS-001, 002, 003, 004a, 005a, 006, R-01..05. QUALIFICATION_READY — SS-005b, 007, 009, 012, 013, 014, 015, 017. WAITING — SS-004b, 008, 010, 011, 016, 018, 019. EXTERNAL_BLOCKED — X-01, X-02, X-03.

---

## 6. Active engineering work a planning PR must not collide with

### 6.1 What is open or moving

| Item | State | Evidence |
|---|---|---|
| PR #277 `feat/blender-aerial` | MERGED 2026-11-11T18:15:25Z as `4a8e1b5` (15 minutes after it was opened) | head `333c141`; touched `core/blender/scene.ts`, `core/command/registry.ts`, `core/director/cinema-shot.ts`, `docs/OPERATIONAL_CONTRACTS.md`, the SS ledger, two test files |
| PR #86, PR #85 | OPEN drafts, untouched since 10-24 and 10-22 | branches `research/ultimate-master-plan-2026-10-23`, `research/competitive-video-rea-2026-10-22` |
| Issue #203 | OPEN | Cinema workflow; slices #243–#248 merged |
| Issue #77 | OPEN | Release gates |

Remote branches: about 264 exist because merged branches are not deleted, so branch presence is not a sign of activity. Unmerged branches: the two research drafts and three stale ones — `feat/cinema-workflow-203-20261106` (tip `e8d783e`, closed draft #204, superseded by #243), `feat/yu-026-scale-profiles` (tip `73d26f1`, superseded by its `-v2`, #135), `fix/p10-q11-prettier` (tip `bdae5da`, 10-22) **(the "stale" judgement is inference)**. In the last ten days the only unmerged branch with new commits is the abandoned Cinema draft; every other recent branch has merged, `feat/blender-aerial` (#277) most recently. The practical consequence: there is no long-lived feature branch to coordinate with — the risk is the hourly merge stream into main.

### 6.2 What the implementation owner is doing now and next

- **Now:** finishing the Blender integration. PR #277's body opens with "The founder's priorities (2026-11-11) include finishing the Blender integration." **That statement is not corroborated by the founder record**: `docs/FOUNDER_DECISION_RECORD.md` ends at the 2026-11-10 entry (last commit to that file is `1f62349`, 2026-11-10T19:56Z, still true after #277 merged) and #277 did not touch it. Treat it as an unrecorded claim until a founder entry exists.
- **Next (inference from the ledger's "Not yet" lists):** a Cinema page control for the aerial view and for match-move; object animation; placement against tracked points; lighting matched to footage.
- **Behind that (inference):** the open SS cards — SS-005b, 007 → 008, 009 → 010, 011, 012, 013, 014, 015, 004b, 016, 017, 018, 019 — which have not moved since about 2026-11-05.
- **Cadence:** 20 first-parent commits on 2026-11-11 alone; feature PRs merge roughly hourly.
- **Authority the owner works under:** founder entry "2026-11-07: Claude chooses on open product decisions" ("from now chose the best, you have my approval."), bounded by standing rules: spending zero, no paid services, release NO-GO, no engine enabled without its own qualification, consent rules, no weights on the PC, Plume deferred, frozen resource limits. Arabic review and UX acceptance stay human; irreversible or outward-facing steps are still asked.

### 6.3 Do-not-touch list for a docs-only planning PR

Highest conflict risk (edited by nearly every feature PR, including #277):

- `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md` — 46 commits since `d1936f7`.
- `docs/OPERATIONAL_CONTRACTS.md` — 26 commits since `d1936f7`.
- `docs/provenance/import-policy.json` (5), `docs/provenance/imports.json` (2), `docs/SECURITY.md` (1).

Authority records a plan should not write to:

- `docs/FOUNDER_DECISION_RECORD.md` (founder instructions only) and `docs/AGENT_DECISION_RECORD.md` ("They are **not** founder approvals").
- `specs/CURRENT.md`, `AGENTS.md`, `docs/IMPLEMENTATION_PLAN.md`.
- `docs/evidence/ultimate/EXECUTION_LEDGER.md` and `receipts/`; the SS `TASK_REGISTRY.json` and `LEGACY_RECONCILIATION.json`.
- Files hashed in `docs/PLAN_FREEZE_MANIFEST.md`, and the tag `plan-freeze-2026-10-18` ("do not move").
- The #85 and #86 branches.

Code areas in motion: `core/blender/`, `core/cinema/`, `core/director/`, `core/prompts/`, `core/command/registry.ts`, `scripts/blender/`, the Cinema and Create pages, `tests/blender-*`, `tests/cinema-*`.

Other traps:

- **ADR numbering.** Main has 0001–0003. Number 0004 is claimed by unmerged #86. A new ADR must either wait for the #86 disposition or take 0005 and say why.
- **Workspace schema** is at 18 and moves often (15 → 16 → 17 → 18 within three weeks). Do not hard-code a schema number in a plan.
- **`docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/`** exists only on the #86 branch. Reusing that directory name on main would collide with any later merge of #86.
- Issue #203's own constraint: "Avoid changing ongoing Opus/Kaggle notebooks and PRs. Small independently testable PRs; no release or provider enablement without existing gates".

---

## 7. Open GitHub issues

Only two issues are open. #82 (Windows UX QA) is closed.

| Theme | Issue | Content | Current state |
|---|---|---|---|
| Release readiness and external gates | **#77** "External release gates remaining (post P10 engineering)" — last updated 2026-10-22 | H1–H5; Authenticode signing; CSP `wasm-unsafe-eval` review before JASSUB; Q15 user presence; E-SEC / F / G. "Public release remains NO-GO" | Nothing on it has closed. The founder record forbids closing it without its criteria. F has been exercised in part (local AI authorised 2026-11-05; Kaggle as GPU) without the issue being updated **(inference)** |
| Cinema product workflow | **#203** "feat: implement Yamakan cinema workflow from Higgsfield clean-room study" — last updated 2026-11-05 | Five deliverables; small independently testable PRs; no release or provider enablement | Slices #243–#248 merged. The Blender stream (#256–#277) extends the same surface. "The AI camera stays off." The issue has not been updated to reflect any of this |

Not tracked as issues at all **(inference)**: the open SS cards, the still-open security Lows, Kaggle operational limits, the Arabic-review backlog. They live only in the SS ledger.

---

## 8. Planning-history conventions and the precedent to follow

### 8.1 Where things live on main

| Location | Holds |
|---|---|
| `specs/CURRENT.md` | The declared current frontier. Three stacked sections: handoff (2026-11-04), "Final planning qualified — held" (2026-11-03), "Historical frontier — retained as evidence" |
| `AGENTS.md` | Working rules: read `specs/CURRENT.md` and `docs/IMPLEMENTATION_PLAN.md`; "Keep one canonical project/timeline model and one current frontier"; bounded branches, independent review, exact-head CI, pinned-head merge commits, "Never force push" |
| `docs/IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md` | First plan (P00–P09, T1–T10). ROADMAP: "IMPLEMENTATION_PLAN is the sole task authority" — historically true, now overtaken |
| `docs/PLAN_FREEZE_MANIFEST.md` + tag `plan-freeze-2026-10-18` (→ `651733a`) | The only freeze. Freeze date 2026-10-18; main at freeze `6e47108`; SHA-256 block over the frozen files; plan size (18 tasks, 17 modules, 15 qualification tests); external gates table. The only tag in the repository |
| `docs/research/rea-source-reuse/` | The frozen reuse-first plan (documents 01–13) |
| `docs/plans/P10-qualification-activation/` | P10 plan (`MASTER_PLAN.md`, `TASKS.md`, `RELEASE_GATE_MATRIX.md`) |
| `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/` | SS package: documents 00–23, `TASK_REGISTRY.json`, `LEGACY_RECONCILIATION.json`, `PLANNING_GATES.json`, `SUBSYSTEM_DECISIONS.json`, `SOURCE_RETRIEVAL_MANIFEST.json`, `OPUS_IMPLEMENTATION_HANDOFF.md`, `tools/validate-plan.mjs` |
| `docs/evidence/` | Receipts: `ultimate/` (YU ledger and receipts), `qualification/`, `rea/`, `sbom/` |
| `docs/history/` | The Darzain prototype documents; `README.md` points to current authority |
| `docs/review/` | `CLAUDE_INDEPENDENT_REVIEW.md`, `FINAL_OPTIMIZATION_REVIEW.md`, `claude-2026-10-11/`, `final-2026-10-11/` — reviews of the **first** plan only |
| `docs/adr/` | 0001 qualified editor foundation, 0002 Yamakan modular foundation, 0003 Studio canvas engine |
| `docs/FOUNDER_DECISION_RECORD.md` | Dated founder instructions — the authorisation trail |
| `docs/AGENT_DECISION_RECORD.md` | Decisions the implementing agent took under delegated authority |
| Top-level `docs/` | `START_HERE_WHEN_READY`, `FUTURE_CLAUDE_EXECUTION_PROMPT`, `FOUNDER_DECISION_PACKET`, `MANAGED_COMFYUI_MODE`, `OPERATIONAL_CONTRACTS`, `SECURITY`, `RELEASE_PROPOSAL`, `COMPETITOR_MATRIX`, `COMPETITOR_RESEARCH` |

Observation **(inference)**: the freeze manifest's hash block includes the two decision records, which have been appended many times since. The hashes therefore verify only at the tagged commit, not on current main. I did not recompute them.

### 8.2 How earlier plan revisions were proposed

| Plan | PR | Branch | Location | Outcome |
|---|---|---|---|---|
| First master plan | #3 (+7,710, 81 files) | `docs/yamakan-master-plan` | `docs/` top level | Merged 10-11 |
| Independent review | #4 (+1,383) | `review/claude-independent-419bc356` | `docs/review/` | Merged |
| Final optimisation | #5 (+2,184) | `docs/yamakan-final-optimization` | `docs/review/` | Merged |
| Frozen reuse-first plan | #30 (+3,150, 24 files), "docs: frozen Yamakan implementation plan (planning only; do not merge without founder approval)" | `docs/rea-source-reuse` | `docs/research/rea-source-reuse/` | Merged after founder approval; then tagged |
| Start authorisation | #31 (+24, 3 files) | `docs/founder-start-authorization` | decision record | Merged |
| P10 plan | #58 (+465, 10 files); #56 closed first | `docs/p10-qualification-plan` | `docs/plans/P10-qualification-activation/` | Merged |
| Competitive REA | #85 | `research/competitive-video-rea-2026-10-22` | `docs/research/<name-date>/` | Open draft |
| Ultimate Master Plan | #86 | `research/ultimate-master-plan-2026-10-23` | `docs/plans/<NAME>/` + ADR | Open draft; executed unmerged |
| System Supremacy REA | #155 (+6,518, 33 files), "docs: complete final research, task contracts and held Opus handoff" | `research/system-supremacy-20261028` | `docs/research/<NAME>/` | Merged 11-03 |
| Planning verification | #158 | `docs/final-planning-verification-20261103` | — | Merged |
| Handoff record | #159 | `docs/record-opus-handoff` | decision record | Merged 11-04 |
| Design note | #196 | `docs/managed-comfyui-design` | `docs/MANAGED_COMFYUI_MODE.md` | Merged |

### 8.3 The convention, distilled

1. Branch `research/<topic>-<YYYY-MM-DD>` (research and plans) or `docs/<topic>` (records and designs).
2. One docs-only package directory under `docs/research/<NAME>/` or `docs/plans/<NAME>/`: numbered documents, a `TASK_REGISTRY.json`, a dependency graph, a validator script, an `evidence/` folder.
3. Open as **Draft**, titled or described as planning-only, "do not merge without founder approval".
4. Independent review receipts stored inside the package. A missing tool is recorded as BLOCKED, never as PASS.
5. Merge only after a founder instruction is recorded in `docs/FOUNDER_DECISION_RECORD.md`.
6. A small follow-up `docs/…` PR records the authorisation or handoff and points `specs/CURRENT.md` at the new frontier.
7. Execution state goes in ledgers and receipts. The plan registry is never edited by implementation PRs.
8. A successor plan carries a machine-readable reconciliation of the predecessor's tasks (`LEGACY_RECONCILIATION.json` is the model).

### 8.4 Recommendation for the new docs-only plan revision (inference)

- Follow the **#155 pattern**, not the #86 pattern: #155 is the only large plan after the freeze that was merged, and it shows the full path — research branch → draft → verification PR → handoff PR.
- New branch `research/<topic>-2026-11-11`; new directory, for example `docs/research/<NEW_NAME>/`. Do not reuse `docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/` and do not push to the #86 branch, despite its ledger's "continue the existing Draft PR86" note — that note predates the 2026-10-25 execution directive and #155.
- Include a reconciliation file mapping **all 44 YU tasks, all 31 SS/R/X items, and the unregistered post-11-05 streams** to the new plan's tasks. The third group is the real gap: today nothing structured describes Kaggle, Create, consent, Cinema #203, Blender or the prompt library.
- State a proposed disposition for #85 and #86 as a **decision requested from the founder** (the record requires "a deliberate reconciliation decision"). The lowest-risk option is to close both as "superseded, retained as evidence" once the new plan merges, citing the branches and head SHAs so the evidence stays addressable. That is a recommendation for the founder, not something a planning PR may do itself.
- Add **no edits** to the files in 6.3. Propose the `specs/CURRENT.md` pointer and any founder-record entry as follow-up PRs after approval.
- Baseline: main is already `4a8e1b5` (#277). The local worktree at `0284ba8` is one merge behind. Either re-baseline on `4a8e1b5` or state the one-merge gap explicitly, and expect further merges within hours.
- If the plan ships a validator, do not copy #86's check that all three flags are `false` as an invariant without thought: that check still passes on main today, but it no longer means "no generation".

---

## 9. Historical blockers versus current blockers

| Statement in #85 / #86 | Status on main `0284ba8` |
|---|---|
| "No real enabled generation"; text-to-video BLOCKED | **Historical.** Real CogVideoX-2b and Wan2.2 text-to-video and image-to-video through Kaggle (#201, #202, #222, #235) |
| Budget 0 means no GPU; "Zero-cost capable GPU slot NOT CONFIRMED" | **Historical.** Kaggle is the zero-cost GPU (founder 2026-11-05). New limits replace it: "Maximum weekly GPU quota of 30.00 hours reached." (2026-11-06); Kaggle cannot cancel a run |
| At least 24 GB local VRAM needed | **Moot.** No weights on the founder's PC by decision; the laptop "has no discrete GPU" |
| Diffusers-versus-ComfyUI choice must precede any engine | **Historical.** ComfyUI adapter exists (off, no recipe); Kaggle recipes are the working path |
| Studio session-local; Cinema/Director sidecars outside backup | **Closed** (YU-010..015, AG-DOCS #102) |
| UI history diverges from server history | **Closed** (#99, #177) |
| MCP ingress unbounded | **Closed** (#90), and MCP now requires an agent token (#252) |
| Fixed 30 fps | **Partly closed** — 24000/1001 added (#117) |
| Fresh clone cannot run tests | **Closed** (#88, #154, #162) |
| Blender deferred, discovery-only | **Historical.** Pinned Blender 5.3.0 worker, render, track, match-move (#256–#276) |
| Cinema is cube proxies and metadata | **Largely historical.** Lens preview, `cinemaScene`, 3D models, Blender render. AI camera still off |
| Director is a smoke UI | **Largely historical.** `yamakan.director.renderShot` goes story shot → timeline (#264) |
| `ENGINE_ENABLED = false`, `ROUTER_PROVIDERS_ENABLED = false`, `JASSUB_ENABLED = false` | **Still true** — but no longer equivalent to "no generation" |
| Public release NO-GO; G | **Current** |
| H1 native Arabic review | **Current, and growing**: captions, Create (people, picture), Cinema, 21 prompt templates and the Blender panel all added Arabic strings with no native review |
| H2–H5, signing, installer/update | **Current** (issue #77, X-02) |
| Q15 OS user presence; JASSUB CSP review | **Current** |
| All benchmark categories NOT TESTED; no competitor head-to-head | **Current** (X-03). The harness exists (#104) but no comparative run |
| M-profile export unqualified | **Current** (SS-005b pending) |
| Commercial providers off; spending zero | **Current** (standing founder rules) |
| Metadata is not conditioning | **Current.** Places and props are "records only: no model receives them" (#212); depth and pose unsupported (#139) |
| No speech recognition, denoise, stabilise, neural enhancement, dubbing, lip sync | **Current** |
| Resource limits frozen | **Current** (policy v3, agent decision 2026-10-28) |

New constraints that neither draft anticipated:

- `qualify:create`, `qualify:kaggle` and `qualify:kaggle-screens` are not in CI.
- Timing-sensitive tests are flaky on battery; results are quoted "on AC".
- The founder PC's disk is nearly full: C: 0.85 GB free caused 8 test failures (noted in #277); 645 leftover `yamakan-*` temp folders were removed.
- Open security Lows after the five-reviewer check: proof key equals stored token hash; browser keys never rotate; exports have no size cap; shared AppContainer profile; FFmpeg build not reproducible; bundle SBOM lacks hashes and Node; Kaggle scripts pin only top-level packages.
- Blender limits: one render or track at a time; no tracked-point placement, footage-matched lighting or object animation.
- Kaggle scripts have a 1,000,000-byte limit; reference images leave the PC for the founder's private notebook under a `likeness-send` consent.

---

## 10. Limits of this review

- I did not re-read every line of #86's `18_ATOMIC_IMPLEMENTATION_TASKS.md` (1,649 lines) or the large evidence JSON files; task objectives and dependencies come from `TASK_REGISTRY.json` and `19_TASK_DEPENDENCY_GRAPH.md`.
- The SS registry states in 5.3 are the file's values on main; the ledger is more current and I did not reconcile every card line by line.
- The AUD-to-YU mapping in 3.1, the "stale" branch labels, the owner's "next" list and the recommendation in 8.4 are inference.
- Nothing was run: no tests, no validator, no build. Test counts are quoted from the ledger.
- No local advisory classifier was used or needed; no review, approval or security judgement is claimed here.
- PR #277 merged while this report was being finished (main `4a8e1b5`). Its diff was read from the PR, not from a local checkout, and the section 3 status table was assessed at `0284ba8`; #277 changes no row in it. Re-check `main` again before baselining a plan.
