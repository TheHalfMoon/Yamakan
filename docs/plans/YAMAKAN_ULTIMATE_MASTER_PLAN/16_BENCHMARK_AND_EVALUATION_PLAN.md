# Scientific and product evaluation protocol

Protocol proposal, not benchmark results. **All head-to-head outcome categories currently NOT TESTED.** A historical Yamakan fixture pass is neither a matched comparison nor current-head qualification. Outputs: **YAMAKAN WINS / MATCHES / LOSES / INCONCLUSIVE / NOT TESTED**, per predeclared population, version, operation and profile; never a universal score.

## Methodological sources and limits

[Artificial Analysis video methodology](https://artificialanalysis.ai/methodology/video), captured2026-10-23, separates silent/audio and generation/editing pools, uses blind same-prompt preferences and accounts for endpoint settings, queueing and download. Borrow those principles, not its ratings or certification. Its own vote-independence caveat motivates clustering by prompt and rater here. [VBench source](08_SOURCE_DONOR_MASTER_MATRIX.md) is an optional pinned evaluation harness; metrics require evaluator weights/dependencies and full protocol. A few proxy scores are never an official VBench result. [PugetBench](https://www.pugetsystems.com/pugetbench/creators/) provides professional application workload context; scores across unrelated hardware/apps are not a Yamakan performance claim.

## Common frozen experiment record

Before any run, freeze protocol/corpus SHA, exact input hashes and consent/license, prompts/negative prompts, supported controls, product build/model/API/account tier, output duration/resolution/fps/audio, seed policy, retry cap, operator instructions, hardware/OS/drivers/power/disk, budget and endpoint date. Capture every attempted submission, refusal, timeout, failed output, charged amount, human intervention and artifact hash. Retain full clips; do not cherry-pick frames or the best of undisclosed rerolls.

Use a common supported baseline plus explicitly separate high-capability cohorts. When a product lacks a requested operation, count it as unsupported for the complete-product task and exclude it only from a clearly named common-capability quality cohort. No silent substitution. Match output presentation without adding enhancement to only one product. Preserve original files and document any transcode/loudness normalization applied for blinded viewing.

## Categories A–L

Every row inherits the record, uncertainty, seed/retry and failure rules below.

| Category | Frozen tasks/inputs | Objective / human measures | Proposed gate, not result |
|---|---|---|---|
| A Professional editing | S/M/L/H/A/K profiles in12; deterministic edit scripts and human finishing briefs | Canonical expected edits, frame/sample boundaries, export decode, task time/errors, professional editor rubric | No data loss or silent effect loss; fixed policy passes on claimed profile; comparative time/preference CI |
| B Text-to-video |240 balanced prompts after pilot, common duration/resolution, audio/silent separately | Prompt fulfillment, motion/physics/artifacts proxies, blind preference, usable-take rate | Quality win only with adjusted95% lower preference bound>0.5 and safety/task success floor |
| C Image-to-video |Matched licensed reference images, poses, first/last constraints across240 scenarios if powered | Reference preservation, motion/control adherence, temporal artifacts; blind comparison | Same quality rule; unsupported controls scored separately |
| D Generative editing |Source clips with edit-locality masks/instructions; person/background/object/style tasks | Source preservation outside edit, semantic success, temporal/audio continuity, human review | No unrelated edit accepted silently; matched task-quality CI |
| E Cinematic control |Camera/lens/light intents, fixed reference scenes and trajectories where supported | Target framing/trajectory error, optical proxies labeled proxies, blinded cinematographer judgment | Intent-to-control compiler agreement plus measured output adherence; metadata-only fails applied-control claim |
| F Character/scene continuity |Repeated consented subjects/environments over3–8shots, held-out poses/light | Identity/scene embedding proxies, human same-identity and continuity ratings | Pack/version correctness mandatory; pixel identity claim requires human CI and failure rate |
| G A/V synchronization |Speech/percussion/action clips with known onsets; silent/native audio distinct | Frame/sample onset offsets, lip/audio alignment proxies, listening/viewing rubric | Profile drift bound in12; dubbing intelligibility/native language review; no universal sync claim |
| H Agentic production |20pilot briefs then powered matched projects; imported assets first, generated later | Editable project completion, tool failures, retries, intervention minutes, restart/revision success | Every accepted action authorized; no fake completion/double billing;95% task-success interval and comparative human workload |
| I Privacy/recovery |Fault injection matrix: crash/kill/ENOSPC/reparse/ACL/backup/restore, offline egress capture | Exact acknowledged state/assets, denied unauthorized access, no orphan, restore completeness | All required negative controls pass on actual supported Windows artifact; no average score hides safety failure |
| J UX/task completion |Six journeys in11, Arabic/English and novice/editor cohorts | Completion/errors/time, accessibility, workload/satisfaction, qualitative observations | No critical data-loss/accessibility issue; powered counterbalanced comparison before superiority |
| K Cost per finished video |Same accepted deliverable incl rejected takes/audio/upscale/export/storage | Currency micro-units, credits+conversion, operator time and compute costs; actual receipts | No unapproved spend; report cost/accepted minute with uncertainty; zero disabled inference not a win |
| L Hardware/resource efficiency |Same media/model/precision/settings and host; cold/warm cohorts | Process-tree peak RAM/VRAM, disk/cache, energy if meter available, wall-time/finished minute | Approved resource policy and cleanup passes; no inferred cross-hardware speedup |

## Sampling, statistical uncertainty and retries

Begin with a60-task creative pilot and5–8-person formative UX study to estimate variance and failure rates. They locate defects; they do not establish broad superiority. For a simple independent binary preference, detecting0.60 versus0.50 at two-sidedalpha0.05 and80% power needs roughly196 independent pairs by normal approximation. Propose240 independent prompts/scenarios per definitive creative cohort, with three raters per pair and up to three fixed seeds nested within prompt. Repeated raters/seeds are **not** additional independent prompts. Use pilot-measured design effects, prompt/rater-cluster bootstrap or a predeclared hierarchical model; increase sample size or report INCONCLUSIVE if power is inadequate. Do not reduce the corpus after inspecting outcomes.

Report Wilson intervals for simple independent success proportions, paired bootstrap/permutation intervals for matched task times, and clustered confidence intervals for preference/repeated measures. Predeclare primary endpoint per category; use Holm adjustment for multiple claimed category wins or label exploratory results. Publish tie/refusal/missing-response policy. MATCHES requires a predeclared equivalence/noninferiority margin and an adequately powered interval within that margin; failure to detect difference is INCONCLUSIVE, not a match.

For APIs without reproducible seeds, record seed unsupported and run randomized request order with repeated attempts. For models with seeds, freeze them; seed equality across architectures does not mean identical stochastic conditions. First attempt and best-within-budget results are separate analyses. Retry maximum and reason are predeclared; every failure and charge remains in the intention-to-treat denominator. Moderation/unsupported/transient network failures receive separate cause codes but cannot disappear from end-to-end completion rates. Human rescue time is part of workflow cost.

## Blinding and retention

Randomize left/right and task order, hide provider metadata from raters, normalize presentation only by declared protocol, include attention/consistency checks, and document exclusions before analyzing results. Raters must understand the requested language and domain; use native Arabic raters for Arabic speech/text. Public vendor demos and repeated press releases cannot be matched benchmark samples.

Retain protocol manifest, input/output hashes, original media, complete logs stripped of secrets, snapshots, receipt/cost records, rater assignment/version, raw votes and analysis code. Private likeness/reference media stays in an approved private evidence store; public reports use allowed summaries/hashes. Record retention and deletion consent. No benchmark download, evaluator weights or paid sample generation is authorized now.

## Decision labels

WINS means predeclared category criterion passed with statistical and operational evidence. LOSES means the predeclared adverse comparison is supported. MATCHES requires equivalence evidence. INCONCLUSIVE covers underpowered/conflicting/unavailable comparison. NOT TESTED means no valid matched run. Safety/recovery failures block the relevant product claim even if quality preference is high. A model-quality win cannot establish editor quality; a better editor cannot establish generative fidelity.
