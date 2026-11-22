# Benchmark and evaluation methodology

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

The proposed protocol for the workflow benchmark (card MPR-801). It contains no result and
authorises no run, purchase, recruitment or download. Labels: `[DOC]` first-party documentation,
`[CLAIM]` vendor marketing, `[IND]` independent third party, `[ASSUMED]` this document's inference
or arithmetic, `[UNKNOWN]` not established; nothing is `[TESTED]`. Code was read, not run. Related:
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md),
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md), [FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md).

## 1. Present position

**Nothing has been benchmarked against any competitor**; no one in this project has used a
competitor product hands-on, and every Yamakan-versus-competitor outcome is `NOT TESTED`. **No paid
run is authorised** (FD-3 and FD-6 are open). `docs/evidence/ultimate/` holds no benchmark
observations file (checked by listing); its Kaggle receipts record single runs, not comparisons.

| What exists | What it measures | Limit here |
|---|---|---|
| `docs/evidence/ultimate/benchmark-protocol.json`, format `yamakan.benchmark-protocol/1`, version 1.1.0, frozen 2026-10-26 | Nothing by itself; its status line authorises no run, provider call, download or paid generation. It fixes the labels WINS, MATCHES, LOSES, INCONCLUSIVE, NOT TESTED; alpha 0.05, Holm across cohorts, a prompt-cluster bootstrap (2000 resamples, seed 20261026), Wilson for success intervals, 240 prompts per definitive cohort, 3 raters per pair, at most 3 attempts with seven cause codes, categories A–L | Its unit is a prompt slot of a model cohort. Not edited by this plan |
| `core/quality/benchmark.ts` (`parseProtocol`, `parseObservations`, `integrity`, `analyse`, `blind`, `holm`, `wilson`, `prng`); `scripts/benchmark-ultimate.ts` (`npm run benchmark:ultimate`) | Turns recorded v1 trials and votes into labels. Defects such as `MISSING_TRIALS`, `RETRY_AFTER_OK` or `EXCESS_VOTES` cap a cohort at INCONCLUSIVE; an empty cohort, or a category without one, is NOT TESTED; credential-like values are refused | Runs no model; v1 records only |
| `core/quality/lab.ts` Quality Lab (`summarizeBlindedComparison`; commands `yamakan.quality.capability`, `yamakan.quality.compare`; `npm run qualify:quality-lab`) | 1–5 scores per rater for two blinded slots, with attempt, failure and latency counts; slot averages without system names | Rating scales are secondary: pilots and regression only |
| `scripts/benchmark-production.ts` (`npm run benchmark`) | Renders a 30-second, three-shot project of FFmpeg test patterns and a sine tone with `renderRevision`, reopens it, writes a receipt (elapsed ms, hash, hardware) that says it is not AI generation | One fixture; not run here, so whether it still runs is not verified |
| `scripts/bench-edit.ts` (no npm script) | p95 of 40 runs of `timeline.rippleDelete` (proposed 50 ms) and `timeline.groupMove` (16 ms) on 16 tracks and 200 clips | Proposed targets, not gates |
| `core/qualification-policy.ts` `QUALIFICATION_POLICY` v1, frozen | p95 gates on the i5-13420H host: cold launch 5,000 ms, reopen 2,000 ms, reference still 1,000/3,000 ms warm/cold, 2 s segment 6,000 ms | Read, never adjusted |
| `docs/E2E_ACCEPTANCE.md` | Rows 8 (export), 10 (interruption), 11 (reopen), 12 (recovery), 13 (backup) give pass conditions reused for H-D; it says no target is achieved today | Conditions, not results |
| SS-016 (`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json`), WAITING_DEPENDENCIES on SS-004b, SS-011 | Full rebuild versus selected-shot revision, at least three paired trials, benefit or explicit no-benefit; no competitor | Feeds H-A |
| X-03 (same registry), EXTERNAL_BLOCKED | Real-model and comparative audio-visual quality only after separate founder authority and a pinned model-specific protocol | Gates every comparative quality question |

One inconsistency inside version 1 (read, not run): the file names Wilson for success intervals,
but `analyse` computes the success lower bound by prompt-cluster bootstrap (`successRates`);
`wilson` is used only in `tests/benchmark-harness.test.ts`. v2 names one method and tests it.

## 2. What is being tested

The thesis is tested on revision cost, recoverability, export reliability, cost predictability, lineage completeness and supervised-agent completion, not raw model quality. A **Yamakan-only
result** (Arm 0 or Arm 1 alone) is a measured value with an interval against a threshold fixed in
advance. A **comparative result** (a declared pair, section 3) gets a frozen label; INCONCLUSIVE means
"not supported", never "falsified" or "equal". All five hypotheses are `NOT TESTED`.

| Hypothesis | Measures; where tested | Falsifying outcome |
|---|---|---|
| **H-A Revision locality** | M6, M6p, M6h. Yamakan-only on Arms 0 and 1 (MPR-802, SS-016); comparative in P1, P2 | Any Yamakan-arm revision changing a shot, clip, audio region or title outside its named target; LOSES on M6 |
| **H-B Same model, better production** | M8, M7, M5. P1 only (P2 uses different models) | LOSES on M8 in P1. Without P1, H-B stays NOT TESTED; P2 never stands in |
| **H-C No surprise spend** | M9, receipts. Yamakan-only. An offline egress capture is not planned in any card; MPR-204 proves refusals by tests and a call log | One connection, download or charge without a recorded approval; once MPR-203 is live, one run without a displayed estimate, or an actual above the stated worst case without a recorded cause |
| **H-D A finished project remains yours** | M10, M11, M13. Yamakan-only; Arm 2 descriptive | Any failed reopen, restore or export; any broken lineage chain (after MPR-701) |
| **H-E An agent you can supervise and resume** | M14, run by MPR-805. Yamakan-only, imported assets first (frozen category H); needs MPR-502, MPR-503, MPR-504, MPR-505, MPR-506 and MPR-801 | Any budget overrun, unapproved human-only operation or lost acknowledged work; completion lower bound below the floor |

Support needs zero violations for the absolute hypotheses and WINS for the comparative ones. H-C has
no comparative label: frozen category K says zero disabled inference is not a win.

## 3. Arms

| Arm | What it is | Can start | Unlocked by |
|---|---|---|---|
| **Arm 0** | Yamakan with no generative model: imported footage, Blender renders (`core/blender/worker.ts`), deterministic editing. New pixels come from the brief's pre-made alternates, so Arm 0 never enters a pair | Today, no spend | MPR-801, MPR-802 |
| **Arm 0-X** | Arm 0 finishing and revision, every generated clip made in the competitor's product (Arm 2's account and surface) and imported as a take | After FD-6 | FD-6 |
| **Arm 1** | Yamakan with the Kaggle route: `core/engines/kaggle.ts` `KAGGLE_RECIPES` offers Wan2.2-TI2V-5B (text or first frame; 704×480, 81 frames at 24 fps) and CogVideoX-2b (720×480, 49 frames at 8 fps), revision-pinned | After FD-3 | FD-3; X-03 |
| **Arm 2** | The competitor: Higgsfield first; Runway, Kling or Pika optional, each its own arm | After FD-6 | FD-6 |

- **P1 = Arm 0-X vs Arm 2, labelled "same model"**: same competitor model, different production
  workflow; the only route to H-B. Higgsfield's documented catalogue lists Wan 2.6, 2.7 and 3.0 but
  not Wan 2.2 or CogVideoX [DOC] (report 01), so the Kaggle models are not reachable from Arm 2
  ([ASSUMED] from that list; rechecked at FD-6). P1 compares finishing and revision, not generation
  ergonomics [ASSUMED].
- **P2 = Arm 1 vs Arm 2, labelled "workflow with each product's best available model"** on every
  result. Its preference results will largely reflect the model gap [ASSUMED]; they are published
  whatever they show.
- **Default for v2: P1 is the only pair in the Holm family.** P2 joins only if FD-3 and FD-6 are both
  granted, declared before any run; each optional competitor adds a pair. Arm 0 vs Arm 2 is no pair.
- **Arm 2 configuration.** Higgsfield documents no timeline in its own product and routes assembly to
  its agent or to DaVinci Resolve and Adobe plugins [DOC] (report 01, S7, S9, S10). 2-W is the web
  product alone; 2-R adds the documented Resolve plugin and is recommended, as the strongest
  documented workflow, if it runs on the study host (free-edition support and Resolve on integrated
  graphics are [UNKNOWN]). The pilot decides; v2 names one, unchanged mid-study; what it cannot
  make is a rubric failure. The configuration is named in the protocol and reported with every
  result.
- **Other competitors.** Luma's terms restrict publishing benchmarks [DOC] (report 02), so Luma is
  excluded without written permission; Higgsfield's position is [UNKNOWN] and checked before FD-6
  spending (section 10).

## 4. Task families

Six families. Six briefs each give the minimum of 36; nine each give the recommended 54 (section 6).
Briefs, input packs, specifications, rubrics and revision scripts are hashed in v2 before the first
counted run. Pilot briefs are separate and their data are discarded.

**Held constant on every arm.** Identical brief text and input pack (SHA-256 per file). Fictional
characters, products, brands and places only, with references licensed for upload to every arm's
service; Higgsfield may train on user content below an Enterprise Agreement [DOC] (report 01, S1),
so nothing confidential or personal is used, and with no real likeness no consent record is needed.
Sound from the pack only: Yamakan has no authorised voice or music route (MPR-221 is blocked on
FD-4), and native audio would reveal the tool. Deliverable: 1280×720, 16:9, 24000/1001 fps
constant (the supported project rate nearest 24 fps), H.264 MP4, AAC stereo 48 kHz, the brief's loudness target, every shot at most 3 s (the Wan2.2 recipe gives
about 3.4 s); product upscalers allowed and recorded. Caps (proposed [ASSUMED], set by the pilot,
then frozen): first cut at most 24 generations per brief and 6 per shot (below `core/story.ts`
`STORY_LIMITS.takesPerShot`, which is 8) and 4 hours of operator active time; revision script at
most 8 generations and 1 hour; failed, cancelled and moderated attempts count. One operator pool with
equal training per product. One operator produces both arms of a brief, in an order counterbalanced
across briefs by the seeded plan. Carry-over from the first arm of a brief to the second is a
stated limit of the design, reported with the result.

**The operator may** use every documented feature of the arm's declared configuration, including
presets, prompt library and agent; **may not** use other tools.

**Stopping rule.** Stop when the operator's own check passes every rubric item, or at a cap (best
version delivered, flagged "at cap"). An acceptance reviewer not told the arm then scores the
rubric; a failed item makes the brief "not accepted", a loss for that side (frozen intention to treat).

**Revision script.** After first-cut acceptance, two requests with identical text on every arm: R1
needs new pixels in one named shot; R2 is deterministic. Both follow the stopping rule.

| Family | Brief and inputs | Rubric items (examples) | R1 | R2 |
|---|---|---|---|---|
| **F1 Cinematic commercial** | 4 shots, ~11 s, fictional brand; mood stills, locations, end-card art, music | Order, framing, time of day; end-card text exact; product in shot 4; duration ±2 frames | Shot 3 dusk to night | Shot 1 12 frames shorter; end card 0.5 s later |
| **F2 Character-consistent short film** | 5 shots, ~14 s; two fictional characters with front, side and wardrobe sheets; one recorded line | Characters match their sheets (hair, wardrobe, colours); action per shot; line on shot 3 | Shot 4 restores a missing wardrobe item (re-anchoring) | Swap shots 2 and 3 |
| **F3 Product advertisement** | 3 shots, ~9 s; fictional product photos, label art, simple 3D model (Blender in Arm 0) | Label identical to the art; shape and colour match; price card exact | Shot 2 three-quarter to front view | New price text |
| **F4 Multi-scene narrative** | 2 scenes, 6 shots, ~17 s; recurring character and location | Continuity across the boundary (layout, time of day, wardrobe); order; transition | Scene 2 shot 1 wide to medium close-up | Insert a supplied 1 s cutaway |
| **F5 Modification of an existing video** | Licensed 10–15 s clip; grade reference; English and Arabic transcript | Trim to 8 s; grade matches; timed English and Arabic captions; one sign's text replaced | Second sign wording | One caption 10 frames later |
| **F6 Targeted revision inside a finished edit** | Finished 6-shot, ~17 s edit: a coordinator-built project for Yamakan arms (hash recorded); shot clips and edit file for Arm 2 | Only shot 4 changes as asked (character turns left); all else unchanged | Darker sky in shot 2 | New title on shot 1 |

Arm 1 cannot edit a region inside a clip (its recipes start from text or a first frame), so F5's sign
item is regenerated as a whole shot where the rubric allows, or recorded as failed; a generated
clip's interior is flattened pixels.

## 5. Measures

Captured: **log** = production log and observer records (section 8); **auto** = deterministic
harness tool; **blind** = blind raters or reviewer (section 6). "Comparative rule" = the label rule
of section 6.2: exact two-sided sign test over briefs, Holm-adjusted p < 0.05, plus, for WINS, the
minimum wins counted over all declared briefs and the success floor (sources: report 06
section 7.4.2 for the test and 25 of 36; the frozen protocol for alpha, Holm and the floor). Values
are proposals until v2 is hash-pinned, then never change.

| ID | Measure | Definition | Captured; unit | Threshold set in advance |
|---|---|---|---|---|
| M1 | Visual quality | Q4 "Which has better picture quality within frames?" | blind; briefs won | Comparative rule (25–27 of 36 by Holm rank) |
| M2 | Temporal consistency | Q5 "Which has fewer flicker, warping and motion artefacts?" | blind; briefs won | Comparative rule |
| M3 | Prompt (brief) adherence | Q2 "Which follows the brief more closely?"; rubric pass rate as support | blind; briefs won | Comparative rule on Q2 |
| M4 | Character and product consistency | Q3 with the approved reference shown (every brief has a recurring fictional entity) | blind; briefs won | Comparative rule; Yamakan-only values from the MPR-405 harness with date and n |
| M5 | Overall preference | Q1 "Which would you deliver to the client?" | blind; briefs won | Comparative rule |
| M6 | Editing precision: collateral-change rate | Per revision step, confirmed changed shots outside the target ÷ shots outside it. A frame and audio difference against a pilot-measured noise floor (an unchanged edit exported twice per arm) flags shots; every flagged shot and a random tenth of the rest go side by side to the reviewer, who confirms or rejects | auto + blind reviewer | Yamakan arms: zero confirmed changes in every step. Comparative rule (fewer wins; equal ties) |
| M6p | Project collateral change | Canonical-hash comparison of clips, asset versions, timing and parameters outside the target | auto; Yamakan only | Zero |
| M6h | Human locality check | "Change achieved: yes, partly, no" and "which preserved everything else better?" (report 06 section 7.3.2) | blind | Descriptive |
| M7 | Time to acceptable delivery | Operator active minutes to the stop, observer-logged against a screen recording; elapsed time beside it | log; minutes | Comparative rule on active minutes (under one minute apart ties [ASSUMED]); geometric-mean ratio reported; elapsed descriptive |
| M8 | Generations to accept | Attempts per brief, failed, cancelled and moderated included; a capped brief counts cap plus one | log; attempts | Comparative rule; median, distribution, share capped per arm |
| M9 | Total inference and compute cost | Currency micro-units from receipts or vendor usage history (credits at the plan price, labelled and dated); credits; Kaggle quota seconds; local wall-clock and process time; energy **not measured** | log | Yamakan arms: zero unapproved spend, egress or download; after MPR-203, every actual within the stated worst case. No comparative label |
| M10 | Project recoverability | One hard kill per brief per Yamakan arm at a seeded seam (save, render, generation import, backup; on Arm 0 the generation-import seam is the import of an alternate take from the pack), then reopen; one `yamakan.workspace.backup` and `yamakan.workspace.restore` to a new root per project; `docs/E2E_ACCEPTANCE.md` rows 10, 11, 13 | log, auto; trials | Zero failures, Wilson interval reported (0 of 36 gives an upper bound of 9.6% [ASSUMED arithmetic]); Arm 2 descriptive |
| M11 | Export reliability | ffprobe check of every export: dimensions, rational frame rate, duration ±1 frame, codecs (row 8) | auto; exports | 100% on Yamakan arms |
| M12 | Professional user satisfaction | SUS or UMUX-LITE, Raw NASA-TLX (six subscales), interviews (section 7) | usability study | Descriptive; never a win |
| M13 | Lineage completeness | Shots whose chain export → revision → clip → take → generation record → inputs resolves (MPR-701, MPR-506) | auto; shots | 100% |
| M14 | Supervised agent completion | A fixed scripted agent (MPR-805; no language model) produces an F4 brief from imported media, with stand-in generation, under a budget with approval points and a forced restart; 20 runs first (frozen category H pilot size) | log; runs | Zero overruns, unapproved human-only operations or lost work; Wilson lower bound ≥ 0.8 [ASSUMED], i.e. 20 of 20 (0.839); 19 of 20 gives 0.764 and fails |

**Automatic metrics are regression alarms only**: they never set a label or replace a question, and
an alarm is investigated and reported. Report 06 section 7.1 documents metrics disagreeing with each
other and with people, smoothness rewarding static video, identity similarity confounded by
background and copy-paste, and VLM judges missing artefacts [DOC via report 06]. Alarms (report 06
section 7.4.4): VBench's six custom-video dimensions, smoothness read beside dynamic degree (CUDA
required by its README [DOC], so not expected on the founder host [ASSUMED]; Apache-2.0 with
separately licensed dependencies [DOC]); masked-crop similarity against a noise floor and impostor
band, never with InsightFace packs, whose weights are non-commercial [DOC]; drift per chained hop;
difference maps (the M6 detector); caption error against a hand-corrected set including Arabic. Not
used: a VLM judge (frames would leave the PC; 65–86% agreement with people at best [DOC via report
06]); lip-sync scores; Quality Lab ratings outside pilots.

## 6. Blind human assessment

### 6.1 Procedure

- **Stimuli.** Each arm's final accepted deliverable per brief, re-encoded by the harness to one
  specification (codec, bitrate cap, container), metadata stripped, never upscaled, loudness
  normalised with one fixed gain (the Artificial Analysis arena uses −18 LUFS [DOC via report 06]).
  Arm 2 uses a plan with watermark-free downloads, as Higgsfield watermarks others [DOC] (report 01,
  S30a); any remaining mark is masked identically on both sides. No captions or titles in rated
  stimuli where the products allow; those are rubric items.
- **Presentation.** Two-alternative forced choice, no tie button; Q1 to Q5 asked separately, Q1
  first; brief shown, and the reference for Q3; voting unlocks after both clips play in full;
  replays allowed; headphones. Side randomised per pair and per rater, order per rater, from one
  recorded seed (v1 `blind` randomises sides once per pair; v2 extends it). Product, provider, model
  and cost hidden, as in the frozen `blinding.hidden`.
- **Raters.** 5 or 7 (odd, fixed in v2), each judging every brief: professionals in editing,
  cinematography or colour, animation or effects, sound or producing, with at least two years of
  paid work, self-declared [ASSUMED]; not Yamakan contributors or operators; competitor ties
  disclosed; fifteen minutes' training on pairs outside the test; volunteers under FD-6;
  pseudonymous ids.
- **Checks.** About one trial in five is an identical pair, a degraded pair or a side-swapped repeat
  (report 06, after the arena). A rater failing more than 25% of degraded-pair checks is excluded,
  decided before analysis; every vote carries the frozen `attentionPassed` flag. If exclusions leave
  an even number, the most recently enrolled remaining rater is set aside [ASSUMED rule].
- **Pilot.** About four briefs and two raters under the draft; data discarded (report 06 section 7.4.6).

### 6.2 Analysis

- **Unit: the brief.** The majority of retained raters decides each brief and question; a side whose
  brief was not accepted loses it.
- **Test.** Exact two-sided sign test over briefs; win share with a 95% Wilson interval. Blind
  questions cannot tie; for M6, M7 and M8 ties are excluded from the test and reported.
- **Holm.** One family holds every declared measure of every declared pair: by default P1 with
  M1–M8, so m = 8. Adding P2 doubles m; v2 prints its table for its actual m before any run.
- **Labels** (the rule MPR-801 implements). WINS needs all of: a declared pair; at least 36 declared
  briefs with complete records; Holm-adjusted p < 0.05 for the Yamakan arm; wins at least the
  unadjusted minimum (`minimumWins`) counted over all declared briefs, so excluded ties cannot
  lower the bar (25 of 36, 35 of 54); and a Wilson lower bound of at least 0.8 on the Yamakan arm's
  acceptance rate (success floor [ASSUMED]; 34 of 36 gives 0.8186 and 33 gives 0.7817; 49 of 54).
  LOSES: a declared pair, at least 36 declared briefs with complete records, and Holm-adjusted
  p < 0.05 for the other arm. NOT TESTED: not run. INCONCLUSIVE: everything
  else, including fewer than 36 declared briefs and any pair in which a declared brief was not run.
  MATCHES is never emitted: v2 declares no equivalence margin (none useful is reachable at 36–54
  briefs [ASSUMED]). Yamakan-only measures report `PASS`, `FAIL`, `BLOCKED` or `NOT TESTED`.
  A LOSES label withdraws the clause of the thesis that the measure tests; INCONCLUSIVE leaves that
  clause not shown.
- **Secondary, descriptive.** Bootstrap with the frozen constants (2000 resamples, seed 20261026)
  over briefs and raters; per-family breakdowns; Krippendorff's alpha with an interval and no
  threshold; per-rater win shares.
- **Not allowed.** Elo or Bradley–Terry for two arms; pooled votes treated as independent; any
  question, measure or pair added after generation starts; dropping briefs or failures after
  outcomes; non-significance read as equivalence.

Wins needed (exact two-sided sign test, Holm with m = 8; rank 1 is the smallest p, tested first;
Holm stops at the first failure) [ASSUMED arithmetic, computed for this document]:

| Briefs | Rank 1 (α/8) | 2 (α/7) | 3 (α/6) | 4 (α/5) | 5 (α/4) | 6 (α/3) | 7 (α/2) | 8 (α) |
|---|---|---|---|---|---|---|---|---|
| 36 | 27 | 27 | 27 | 27 | 26 | 26 | 26 | 25 |
| 54 | 38 | 38 | 38 | 37 | 37 | 37 | 36 | 35 |

The last column reproduces report 06: 25 of 36 (two-sided p = 0.029) and 35 of 54. At a true 70/30
split, unadjusted power is 0.61 at 36 briefs and 0.84 at 54; exact power is saw-toothed (50 and 53
fall below 0.80) and 54 is the smallest size from which it stays at or above 0.80, matching report
06. Clearing α/8 has power 0.33 at 36 briefs and 0.54 at 54, so INCONCLUSIVE is a likely,
reportable outcome.

### 6.3 Where report 06 and the frozen protocol differ, and which governs

v2 governs the workflow benchmark once hash-pinned; 1.1.0 keeps governing what was recorded under
it, and no v1 result is relabelled. Where version 1 fixes a rule, v2 follows it: it is the frozen
repository rule set, and report 06 is research advice. Where version 1 has no rule for a
brief-level design, v2 follows report 06.

| Topic | Report 06 | Frozen 1.1.0 | v2, and why |
|---|---|---|---|
| Unit, size | Task; 36 minimum, 54 for power | Prompt slot; 240 per definitive cohort; a 60-task pilot shows no superiority | Brief; 36 minimum, 54 recommended. A brief is a whole production, so v1 sizes do not transfer; v2 labels say "workflow benchmark v2, n briefs" |
| Test, interval | Exact sign test; Wilson | Cluster-bootstrap p-value; percentile interval; Wilson named for success (code uses bootstrap) | Exact sign test and Wilson; bootstrap secondary, since it is coarse with one outcome per brief |
| Raters, ties | 5–7, majority; ties excluded | Exactly 3, extra votes block a label; mean vote; a tie is half a vote | 5 or 7, majority; no ties in blind questions; ties excluded and reported in log measures (a half vote has no exact form) |
| Retries | Operator may choose between seeds | Retry only after a failure; a retry after success blocks a label | Every attempt counts; choosing among takes is the workflow under test (v1 rule stays for v1 cohorts) |
| Multiplicity, floor, constants, attention | No correction stated; no floor; one check in five, exclude above 25% failures | Holm over cohorts; floor required; 2000 resamples, seed 20261026; checks and pre-set exclusions | Version 1 governs: Holm over every declared measure and pair, floor 0.8 [ASSUMED], same constants, both check rules |
| Equivalence | Never | MATCHES inside a pre-declared margin at α/m | No margin, so no MATCHES; agrees with both |

## 7. Usability study (formative)

Small-n and task-based. **Findings are qualitative and never reported as a comparative win**; the
frozen protocol says the same of its 5–8 person formative study. **No card in this plan runs this
study**: it is a method only, not planned work, and M12 stays `NOT TESTED`. Human usability
qualification stays with X-01 (EXTERNAL_BLOCKED in the earlier plan).

- **Participants.** Professional editors and beginners (frozen category J cohorts), five each to
  start; five users find most problems in one iteration, though that rule underestimates [DOC via
  report 06]. Arabic and English speakers in each cohort where possible.
- **Design.** Yamakan-only first (Arm 0, runnable now). A within-subject comparison with the
  competitor needs FD-6, with counterbalanced order and matched task variants.
- **Tasks** (report 06 section 7.4.3): a three-shot scene with a consistent fictional character; one
  client revision to one shot only; change and re-time a caption; export with captions and a
  provenance report.
- **Observed.** Checklist success judged afterwards by a reviewer not told the product where
  possible; time on task; generations to accept; assists, errors, think-aloud notes; SUS or
  UMUX-LITE; Raw NASA-TLX with six subscales.
- **Reported.** Problems with severity; per-participant paired differences; completion with
  small-sample intervals. No comparative p-value (five unanimous participants give p = 0.0625), and
  no test of a five-person SUS mean against 68.
- **H1 and X-01.** Arabic findings feed MPR-606's review packet. The study cannot close H1: X-01
  needs a qualified native Arabic reviewer on the exact candidate artefact; automated or screenshot
  checks cannot stand in.

## 8. Production log

An audit must be able to rebuild every number in sections 5 and 6 from records.

| Record | Must hold | At the baseline (by reading) | Card |
|---|---|---|---|
| Per-shot history | Takes added, generations attempted (failed and cancelled included), replacements (revision, principal), totals | Takes in story documents via `core/story.ts` `TakeLineageSchema` (`label`, `outputHash`, `inputs`, `continuity`), at most 8 per shot; `yamakan.take.list`, `.compare`, `.proposeReplace`, `.apply`; `yamakan.generation.list`. No ledger | MPR-107 (data for SS-016) |
| Generation record | Route, recipe and model identity with hashes, operation, full request with prompt and seed, input pins and roles, timings, usage, `derivedFromTakeId`, `changedFields` | `src/create/create-story.ts` `addMadeVideo` puts seed, steps and model in the free-text take `label` and the prompt in shot `notes` | MPR-101 (FD-2) |
| Receipts | Each mutation's receipt or request-id refusal | Tables `command_receipts`, `recovery_receipts` in `core/store.ts`; Kaggle receipts such as `docs/evidence/ultimate/kaggle-restart-run-receipt.json` | Exists; MPR-506 adds audit and provenance trace |
| Job attempts | Each attempt with status and cause | Tables `jobs`, `attempts` in `core/store.ts`; `yamakan.job.status`, `.list`, `.retry` | Exists locally; MPR-207 records a failure class and an end time on each generation (no card maps the classes to the frozen cause codes) |
| Estimate versus actual | Pre-run estimate (low, high, worst, basis, date), then usage | Fixed `expectedSeconds` in `KAGGLE_RECIPES` (1,132 Wan2.2; 1,125 CogVideoX); no preflight | MPR-203 (`yamakan.generation.preflight`; the estimate is in seconds, with no currency field); actual wall time in the MPR-101 record; a provider usage record exists only in the MPR-210 profile, which stays off |
| Approvals | A recorded approval per egress or spend; a download is always refused, and no approval of that kind can be recorded | Holds because no code makes such calls, not by a gate | MPR-204 |
| Export manifest | Revision, its snapshot hash and plan hash, per-asset hash, origin, record hash, model, licence, consent ids, tool versions | `yamakan.export.video`, `yamakan.export.batch`; no manifest | MPR-701 |

**Study-side records:** the observer's active-time log and screen recording; for Arm 2, usage
history and credit balance before and after each brief (it shows credit returns for failed
generations [DOC] (report 01, S17)); reviewer scores; rater assignments, votes, exclusions;
deviations. Retention follows the frozen `retention` list; keys, tokens, authorisation headers and
cookies are never captured. Media stays outside the repository; hashes go in.

**Record format.** A proposed `yamakan.benchmark-observations/2` extends the v1 trial fields
(`trialId`, `promptId` as brief id, `product` as arm, `seed`, `attempt`, `status`, `modality`,
`inputSha256`, `outputSha256`, `consentId`, `costMicros`, `interventionSeconds`) with shot id, step
(first cut, R1, R2), record hash, quota seconds, credits, estimate bounds, active and elapsed
seconds, at-cap flag and acceptance, keeping `parseObservations`'s bounds and credential refusal.

## 9. Pre-registration and reporting

- **A new file.** Proposed `docs/evidence/ultimate/benchmark-protocol-v2.json` (new), format
  `yamakan.benchmark-protocol/2` (new), beside the untouched 1.1.0 file. MPR-801 delivers it as
  version `2.0.0` with `state: 'draft'`, the analysis functions (proposed new
  `core/quality/workflow-benchmark.ts` and `tests/workflow-benchmark.test.ts`, reusing `holm`,
  `wilson` and `prng` from `core/quality/benchmark.ts`) and the script
  `scripts/benchmark-workflow.ts`. MPR-801 runs nothing.
- **Contents.** Everything sections 3 to 6 leave to v2: Arm 2 configuration, pairs, hashes of briefs,
  packs, rubrics and scripts, caps, raters, questions, check and exclusion rules, Holm family and
  wins table, success floor, noise-floor procedure and pilot values, study window and sentinel
  prompts, stimulus settings, analysis code version, pilot plan.
- **Sequence.** This is the one statement of the protocol's lifecycle; other sections refer to it.
  (1) MPR-801 writes the draft, version `2.0.0`. While the file is a draft, only pilot observations
  parse and every comparative cell stays NOT TESTED. (2) MPR-802 runs the pilot (discarded), enters
  the pilot-derived values, obtains founder review, sets `state: 'frozen'`, commits and pins the
  SHA-256, then makes the first counted run: the Yamakan-only baseline on Arm 0. After the freeze the
  file and its pin never change; an amendment is a new versioned file with its own pin. (3) MPR-803
  runs a competitor arm only after FD-6 is recorded and a written terms check allows it, under
  `docs/evidence/ultimate/benchmark-protocol-v2.1.json` (new), version `2.1.0`: a copy of the frozen
  file in which only the comparative fields differ (the Arm 2 product, plan and configuration, the
  generation window, the declared pairs, the rater count and the values the comparative pilot
  sets), frozen and pinned before its first counted generation. Observations name `protocolSha256`; analysis refuses another hash, as v1 `analyse`
  does.
- **Deviations.** Logged with date, reason and briefs in a proposed
  `docs/evidence/ultimate/benchmark-v2-deviations.md` (new). A deviation never changes a threshold;
  that needs a new version, and earlier data stay under their own version.
- **Reporting.** Everything is published, losses and INCONCLUSIVE included: per measure n, wins, ties,
  exact and Holm-adjusted p, Wilson interval, label; caps reached; model versions, dates, seeds;
  pseudonymous raw votes; exclusions; agreement; deviations; Arm 2 plan; label and date of every
  competitor price. Only the frozen vocabulary is used, each label with its pair label and "workflow
  benchmark v2, n briefs", for the measured pair and date only. Open publication of the protocol is
  FD-7 (documentation only); competitor results also need the terms check in section 10.

## 10. Costs and authorisations

Volume used for the arithmetic [ASSUMED]: 36 briefs; a "plausible" case of 10 generations per brief
(360 in all) and a "cap" case of 32 per brief (1,152). The pilot replaces these before FD-6 is asked
for an amount. See also [12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md)
and [11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md).

| Arm | Money | Quota and host time | People time | Unlocked by |
|---|---|---|---|---|
| Arm 0 | None | Founder host, CPU-only, inside the frozen `RESOURCE_POLICY` (`core/command/policy.ts`); render time unknown until the pilot | Operators (at most 5 h per brief, about 180 h for 36 briefs at the caps [ASSUMED]); reviewer | MPR-801, MPR-802; SS-016 also waits for SS-004b, SS-011 |
| Arm 1 | None | Kaggle quota: `docs/evidence/ultimate/kaggle-quota-refusal-receipt.json` (2026-11-06) records Kaggle naming a 30-hour weekly GPU quota. At 1,132 s per run: plausible about 113 GPU hours (3.8 weeks), cap about 362 (12 weeks) [ASSUMED arithmetic]; policy not re-checked [UNKNOWN] | As Arm 0 | FD-3, X-03 (existing permission: free GPUs within quota, `docs/FOUNDER_DECISION_RECORD.md`) |
| Arm 2 | Subscription and credits, quoted on the day with label and date | Browser; Resolve under 2-R ([UNKNOWN]) | Operators; 5–7 volunteer raters; reviewer | FD-6 |
| Arm 0-X | Same account; P1 roughly doubles competitor generation [ASSUMED] | As Arm 0 | As Arm 0 | FD-6 |
| Open publication | None | None | None | FD-7 |

**Higgsfield pricing as found on 2026-11-11** (report 01). The live pricing page returned only a
script shell [DOC] (S18). Plus is $49 a month for 1,000 credits and Ultra $129 for 3,000 [CLAIM]
(vendor blog S19, stated as checked 11 Sep 2026); third parties give Plus at $59 for 1,200 and Ultra
at $129 for 3,000 [IND] (S36, S37, S38). Credits expire at renewal and packs after 90 days [DOC]
(S1, S17); packs reportedly need a subscription [IND] (S37). Plans without watermark-free downloads add a watermark [DOC]
(S30a); which plans include it is [UNKNOWN]. Seedance 2.5 at 8 s 1080p costs 72 credits and Kling
3.0 20 [CLAIM] (S19); 3-second prices and minimum durations [UNKNOWN]. Using the 8-second figures as
a proxy at Ultra's $0.043 per credit [ASSUMED]: plausible 7,200–25,920 credits (about $310–$1,115),
cap 23,040–82,944 (about $990–$3,570); P1 roughly doubles both. That exceeds one month's Ultra
allowance and credits expire, so FD-6 must name a plan, a maximum total with a hard stop, and a
window. This is planning arithmetic, not a quote. The developer API (prepaid, $5 minimum, estimate
endpoint [DOC] (S25)) is not Arm 2: it lacks the product workflow.

**FD-6 must also cover** a terms check before any spend: publication of results (Higgsfield
[UNKNOWN]; Luma restricts it [DOC] via report 02); training on uploads ([DOC] (S1), as above); use
of outputs in another tool, which Arm 0-X needs (documented for API outputs [DOC] (S25); web-plan
terms not summarised in report 01 [UNKNOWN]); and volunteer recruitment.

**Rater time** [ASSUMED, from report 06's one minute per pair]: 45–60 minutes per rater for 36
briefs with checks, about 30 more for M6h, in two sittings; 6–11 rater-hours for 5–7 raters, about
1.5 times that at 54 briefs. Reviewer: about 15 minutes per deliverable, 18 hours for P1 at 36.

## 11. Threats to validity

| Threat | Mitigation |
|---|---|
| Operator skill and allegiance; learning across arms | Non-contributor operators where possible; equal logged training until each completes the pilot briefs on every product; order counterbalanced by the seeded plan and reported, with carry-over within a brief a stated limit; per-operator results |
| Model drift: hosted models change silently (the arena discards votes when a model changes host [DOC via report 06]); Higgsfield adds models most weeks and logged at least seven provider-side failure notices from September to November 2026 [DOC] (report 01, S14) | Model, version and date per attempt; Arm 2 and Arm 0-X generation in one declared window; three sentinel prompts on the first and last day, affected briefs repeated as logged deviations. Arm 1's revision is pinned in `KAGGLE_RECIPES`; the Kaggle environment is recorded per receipt |
| Prompt-tuning asymmetry | No tuning on study briefs; libraries and presets as of the start date (Yamakan's by hash); every prompt recorded |
| Competitor feature changes | Changelog captured at start and end; new features unused; a removed feature means affected briefs are repeated and logged |
| Arm 0's pre-made alternates; self-judged acceptance | Arm 0 is never in a pair; an independent reviewer not told the arm |
| Rater pool bias or model recognition | No contributors; disclosed ties; pre-set exclusions; per-rater shares and agreement reported |
| Small n: unadjusted power 0.61 at 36 briefs; at the first Holm step, 0.33 at 36 and 0.54 at 54 (70/30) [ASSUMED arithmetic] | 54 recommended; INCONCLUSIVE reported; no equivalence; nothing shrunk after outcomes |
| The founder host: i5-13420H, 16 GiB, integrated graphics, little free disk, one render slot, frozen resource policy v3; VBench cannot run, Resolve may not | Host recorded against `QUALIFICATION_POLICY.hardware`; active time is the declared time measure; recordings on existing storage; no paid infrastructure (not authorised) |
| Unblinding by watermarks, aspect ratio, resolution, frame rate, codec, captions, audio or a model's look | Watermark-free plan; one re-encode specification; metadata stripped; no captions or titles in stimuli; pack audio; identical masks. Raters guess each side's product after rating; a measure with accuracy far above chance is reported as unblinded |
| Outcome-dependent analysis | Pre-registration, hash pin, intention to treat, deviation log |
| Free-GPU latency | Active minutes declared; elapsed time descriptive |
| Scope: pack audio only, shots of at most 3 s | Results do not cover native audio, lip sync or longer shots; stated with every result |
| Briefs reused: v2.1 keeps the briefs of the Yamakan-only baseline | Operators of the competitor run have not worked those briefs before, where the pool allows; otherwise stated with the result. A fresh hash-pinned brief set for v2.1 is an open amendment ([13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md)) |

## 12. Result table

Every cell is `NOT TESTED` and names the card that would produce it, or says that no card does.
MPR-801 precedes every cell; a cell is filled only from a run under the frozen, hash-pinned protocol
(section 9).

**Comparative results** (frozen labels); every cell also needs MPR-803 (FD-6), and P2 needs FD-3.

| Measure | P1: Arm 0-X vs Arm 2 (same model) | P2: Arm 1 vs Arm 2 (best available model) |
|---|---|---|
| M1 Visual quality | `NOT TESTED` (X-03) | `NOT TESTED` (X-03) |
| M2 Temporal consistency | `NOT TESTED` (X-03) | `NOT TESTED` (X-03) |
| M3 Brief adherence | `NOT TESTED` (X-03) | `NOT TESTED` (X-03) |
| M4 Character and product consistency | `NOT TESTED` (MPR-405, X-03) | `NOT TESTED` (MPR-405, X-03) |
| M5 Overall preference | `NOT TESTED` (X-03) | `NOT TESTED` (X-03) |
| M6 Collateral-change rate | `NOT TESTED` (MPR-107) | `NOT TESTED` (MPR-107) |
| M7 Time to acceptable delivery | `NOT TESTED` (MPR-107) | `NOT TESTED` (MPR-107) |
| M8 Generations to accept | `NOT TESTED` (MPR-107) | `NOT TESTED` (MPR-107) |

**Yamakan-only results** (measured value against the section 5 threshold). Every Arm 1 cell also
needs X-03 and FD-3.

| Measure | Arm 0 | Arm 1 |
|---|---|---|
| M4 Consistency, with date and n | `NOT TESTED` (MPR-405) | `NOT TESTED` (MPR-405) |
| M6, M6p Collateral change (H-A) | `NOT TESTED` (MPR-802, SS-016, MPR-107) | `NOT TESTED` (MPR-802, SS-016, MPR-107) |
| M8 Generations to accept | `NOT TESTED` (stays so under MPR-802: the arm has no generative model) | `NOT TESTED` (MPR-802, MPR-107) |
| M9 Cost, egress, estimates (H-C) | `NOT TESTED` (MPR-802; it does not measure network egress and records that as not verified) | `NOT TESTED` (MPR-802) |
| M10 Recoverability (H-D) | `NOT TESTED` (MPR-802) | `NOT TESTED` (MPR-802) |
| M11 Export reliability (H-D) | `NOT TESTED` (MPR-802) | `NOT TESTED` (MPR-802) |
| M13 Lineage completeness (H-D) | `NOT TESTED` (MPR-802, MPR-107) | `NOT TESTED` (MPR-802, MPR-107) |
| M14 Agent completion (H-E) | `NOT TESTED` (MPR-805: a scripted agent; a model-driven agent has no card) | `NOT TESTED` (no card: MPR-805 uses stand-in generation) |
| M12 Usability (descriptive) | `NOT TESTED` (no card in this plan; X-01) | `NOT TESTED` (no card in this plan; X-01) |

Hypotheses H-A, H-B, H-C, H-D and H-E: all `NOT TESTED`.

## 13. Sources

The consolidated list is in [SOURCES.md](SOURCES.md).

- **Repository at the baseline** (read, not run): every path and symbol named above, chiefly the
  frozen protocol, `core/quality/benchmark.ts`, `core/quality/lab.ts`, the three benchmark scripts,
  `core/qualification-policy.ts`, `docs/E2E_ACCEPTANCE.md`, the SS and X cards in
  `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json`, `core/engines/kaggle.ts` and the
  Kaggle quota receipt.
- **Research notes** (written 2026-11-11, kept under [evidence/research/](evidence/research/);
  "report NN" in this document means the note with that number): report 06 sections 7.1–7.4 and
  8; report 01 sections (b)–(e), (g) and (j), whose table gives the URL of each S-number cited;
  report 02 on Luma's terms.
- **External, via those notes** (accessed 2026-11-11): Artificial Analysis video methodology
  https://artificialanalysis.ai/methodology/video [DOC]; VBench https://github.com/Vchitect/VBench
  [DOC]; InsightFace https://github.com/deepinsight/insightface [DOC]; pairwise-comparison and
  usability sample-size papers (report 06 sections 7.2.1 and 7.2.7) [DOC]; Higgsfield terms
  https://higgsfield.ai/terms and pricing https://higgsfield.ai/pricing, with S7–S38 as listed in
  report 01; Luma terms https://lumalabs.ai/legal/tos [DOC].

**Not verified:** whether `scripts/benchmark-production.ts` still runs; whether Higgsfield's terms
restrict publishing benchmarks; Higgsfield's 3-second prices and watermark-free plans; Resolve
plugin and Resolve on the founder host; Kaggle's current quota policy; whether Wan 2.2 or CogVideoX
is reachable through any competitor.
