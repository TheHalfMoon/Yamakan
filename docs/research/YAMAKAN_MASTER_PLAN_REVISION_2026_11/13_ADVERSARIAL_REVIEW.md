# Adversarial Review, Remaining Weaknesses and Rejected Ideas

> Status: ADOPTED — the current frontier by founder instruction. Each card stays gated by its state and founder decisions.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document records how the plan was attacked before it was offered for review, what the
attacks found, what was changed, what was left open, and which ideas were considered and
rejected. It is where the package states its own weaknesses. A reader who has time for one
section should read section 5.

## 1. What this review is and is not

What was done:

- **Code verification.** Seven automated read-only passes compared the statements in the task
  cards with the code, tests, documents and history at the baseline. Each pass read a group of
  cards and reported every statement it could not confirm. Section 4 gives the counts.
- **Review from ten points of view.** Five automated reviewers each took two points of view and
  read the cards and documents as that reader would: professional filmmaker and video editor;
  creative director and product strategist; AI model engineer and systems architect; security
  engineer and resource-constrained Windows user; open-source maintainer and competitive product
  reviewer. Each was asked for reasons to refuse the plan, with evidence and a concrete fix, and
  for a list of ideas the plan should go on rejecting. Section 3 gives every finding.
- **Reconciliation by script.** Scripts compared the documents with the registry: dependency
  lists, founder-decision card lists, counts of cards per shared file, source decisions, stage
  membership and state counts.
- **Structural checks.** The package check, the rendering check, the check of the plan in force
  and the repository's provenance and brand checks were run. Section 2 gives the results.
- **Advisory triage.** A small text classifier that runs on the planning PC was asked once whether
  each of seven open amendments (OA-1 to OA-7 in section 5.1) must be decided before Stage 1
  starts. It scored every one below 0.03, which reads as no. The planner disagrees on OA-5 for the
  reason given there. A second question in another form failed with an error and was not retried.
  The classifier is advisory. It approved nothing and cleared no gate.

What this is not:

- It is not ten human reviews. No person took part. The reviewers, the verification passes and
  the author are instances of one model family, so their mistakes may be shared. A human reviewer
  may find what all of them missed.
- The reviewers read the package while it was still being edited, and they did not read the
  corrected text. Each fix recorded below was checked by the planner against the rebuilt registry
  or the edited document, not by the reviewer who raised it.
- No competitor was tested. Every statement about another product comes from its documents, its
  own claims or third-party reports, as labelled in
  [01_COMPETITIVE_CAPABILITY_MATRIX.md](01_COMPETITIVE_CAPABILITY_MATRIX.md).
- No generation was run, no card was built, and no figure in this package is a measured result
  of this plan. Measured figures quoted from the repository are existing evidence and are cited
  where they appear.
- A check that could not run is recorded as BLOCKED, never as a pass.

## 2. Results of the checks

All commands were run from the repository root in the planning worktree, on the planning branch,
with the package present and no other change.

| Check | Command | Result |
|---|---|---|
| Plan in force, unchanged | `node docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/tools/validate-plan.mjs` | Exit 0. Readiness READY, no missing gate, no error. |
| This package | `node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/validate-addendum.mjs` | Exit 0. 56 cards, 44 Ultimate plan tasks and 31 System Supremacy cards reconciled. |
| Task program is the rendering of the registry | `node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/render-task-program.mjs --check` | Exit 0. |
| Provenance | `npm run provenance:check` | Exit 0. 404 pinned source records verified; import guard passed. |
| Brand | `npm run brand:check` | Exit 0. |
| Head of `main` on the remote | `git ls-remote origin refs/heads/main` | `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, the baseline. |
| Text hygiene (planner's script, not part of the package) | scan of the documents, the registry and the research notes for unbalanced quotation, quotation longer than fourteen words, control characters, and wording that claims a result or first-hand use of another product | No finding in the eighteen documents or the registry. The research notes hold fourteen longer quoted spans: twelve quote this repository's own documents, pull requests and code comments, and two are a note's own example wording. None quotes an outside source at that length. |

Not run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm run test:e2e`, `npm run build` and the `qualify:` scripts. The package adds documents, two
data files and two small scripts under its own `tools` directory. It changes no product code, and
`docs/` is outside the lint and format scope. Nothing here is evidence that the product's tests
pass at this head; that evidence is the repository's own.

The package check is structural. It shows that every path, command, card id and link is real
and that the dependency data is consistent. It does not show that a card is right.

## 3. Findings by point of view

The five reviewers raised 85 findings. Nine were marked as blockers by the reviewer who raised
them. Severity is the reviewer's own. The words in the last column mean:

- **FIXED**: the text of a card or document was changed as asked, or to the same effect.
- **PARTLY FIXED**: part was changed; the rest is named, and is an open amendment where one is
  given.
- **STATED AS LIMIT**: the plan was not changed; the limit is now written where the reader meets
  it.
- **LEFT OPEN**: nothing was changed; a concrete amendment is proposed in section 5.1 for the
  founder to accept or refuse.
- **ALREADY IN CARD**: the card already said it.
- **REJECTED**: not adopted, with the reason in section 6.

| Disposition | Findings | Of which blockers |
|---|---|---|
| FIXED | 50 | 6 |
| PARTLY FIXED | 21 | 1 |
| STATED AS LIMIT | 5 | 1 |
| LEFT OPEN | 7 | 1 |
| ALREADY IN CARD | 1 | 0 |
| REJECTED | 1 | 0 |
| Total | 85 | 9 |

Three blockers are therefore not closed: CD-1 (no send-back with a note), FM-1 (Stage 1 revises
the request, not the picture) and OM-1 (existing licence defects are not fixed first). The founder
should read those three before adopting the plan.

Document names below are short: document 06 is
[06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md](06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md), and so on by
number; the handoff is [OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md).

### 3.1 Creative director

Verdict: would adopt with fixes. Without CD-1 and CD-2 the reviewer calls the approval step an
approval log, not a review tool.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| CD-1 | BLOCKER | A stage can be approved or left waiting. It cannot be sent back with a note. | LEFT OPEN: OA-4. |
| CD-2 | MAJOR | The approval shows a hash, not the content or what changed since the last approval. | LEFT OPEN: OA-8. |
| CD-3 | MAJOR | Four of nine stages ask for approval, and no approval binds a command. | STATED AS LIMIT in MPR-301 and in Journey 4 of document 06. Asking for approval at the generation and editing stages was rejected (section 6). |
| CD-4 | MAJOR | With no language model, the director types every planning stage. | FIXED as a statement: document 00 section 2, Journey 4 of document 06 and a risk in MPR-604 say so. |
| CD-5 | MAJOR | The shot list is approved with no cost figure beside it. | LEFT OPEN: OA-9. |
| CD-6 | MAJOR | The marketing journey implies a team review that the product cannot hold. | FIXED: Journey 5 is retitled, and document 00 section 7 says there is one human principal and no second approver. |
| CD-7 | MAJOR | The reason for a revision is not recorded. | PARTLY FIXED: OA-5, its record part accepted 2026-11-23 and the field in MPR-101; MPR-103 writes it. |
| CD-8 | MINOR | Some surfaces speak to an engineer: byte counts, ids, hashes. | PARTLY FIXED: MPR-104 shows a level word and says before a save that undo history ends. Byte counts and ids in proposals are OA-10. |

### 3.2 Product strategist

Verdict: yes, with fixes.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| PS-1 | BLOCKER | No user touches the product at any stage exit. | FIXED: the exit of Stage 1 now needs at least three working editors or creative leads, invited by the founder, to run the demonstration on the founder host. If that is not arranged the exit is BLOCKED, never PASS. |
| PS-2 | MAJOR | The case for Stage 1 asserted an advantage the plan's own matrix does not show. | FIXED: FD-11 now says that whether other products offer the same is [UNKNOWN]. |
| PS-3 | MAJOR | The Stage 1 demonstration is weak beside a hosted generator. | PARTLY FIXED: document 08 section 5 says it shows record-keeping, not generation, and that one clip takes about nineteen minutes on the free route. Making the recommended answer to FD-2 a condition of the exit was not adopted (section 6). |
| PS-4 | MAJOR | A person with existing footage has no early way in. | ALREADY IN CARD: MPR-101 has a `declared` record for a take made elsewhere, and MPR-103 gives such a take a partial draft marked `complete: false`. |
| PS-5 | MAJOR | The hypotheses can fail only as internal checks. | FIXED: document 00 section 4 says that no hypothesis that gives a professional a reason to switch can be tried before FD-6, and that until then the thesis is unvalidated. |
| PS-6 | MAJOR | Stage 2 should be restructured: fewer contract cards, earlier editor cards, no currency fields. | REJECTED (section 6). |
| PS-7 | MAJOR | The thesis said every shot is priced, and no money figure exists. | FIXED: the thesis now says a stated cost in time and data, and that no money figure is shown until a paid route is authorised. |
| PS-8 | MAJOR | Defaults for unanswered founder decisions were chosen by the plan. | PARTLY FIXED: FD-3 names who reads Kaggle's terms and what follows if they forbid the use. The other defaults stand as written and are the founder's to change. |
| PS-9 | MINOR | Stage exits counted outputs, not effects. | FIXED for Stages 1 to 3: each exit now names a measure or an observation. |

### 3.3 Professional filmmaker

Verdict: yes with fixes, for previsualisation and short silent pieces. Not for dialogue or
performance-led work.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| FM-1 | BLOCKER | Stage 1 revises the parameters of a request. It does not revise the shot: framing, camera and performance are not controlled. | STATED AS LIMIT in document 00 section 5. Moving MPR-403 into Stage 1 was rejected (section 6). |
| FM-2 | MAJOR | Without FD-2 a revision cannot refill the prompt. | STATED AS LIMIT: with hashes alone the draft has no prompt text and says so. |
| FM-3 | MAJOR | Sound, dialogue and lip sync are absent. | STATED AS LIMIT in document 00 section 5 and Journey 1 of document 06. |
| FM-4 | MAJOR | A shot does not say how editable it is. | FIXED: the shot card in MPR-104 shows a level word taken from the record's origin. |
| FM-5 | MAJOR | A clip is about 3.4 or 6.1 seconds long and the plan did not say so to the person. | PARTLY FIXED: both documents above state the lengths. Showing the route's maximum on the shot card is OA-11. |
| FM-6 | MAJOR | The Blender camera is a preset rig, and a repeated render is not shown to be the same. | FIXED: MPR-403 requires equal frame hashes for two renders of one story version on the founder host, or the difference recorded. Document 00 and Journey 4 state the rig's limits. |
| FM-7 | MAJOR | References are stored but may not reach the model. | FIXED: MPR-402 reports for each reference whether it was sent and, if not, why. Document 06 says a reference to a real person is the person's own responsibility to clear. |
| FM-8 | MAJOR | The first ten minutes show test bars, not a film. | LEFT OPEN: OA-12. |

### 3.4 Video editor

Verdict: yes with fixes, as a short-form assembly and hand-off tool. Not a finishing tool.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| VE-1 | BLOCKER | The way out to a finishing tool is unproven, and media is not included. | FIXED as a statement: the export panel in MPR-603 says 'Other editors: NOT TESTED. Media is not included.' and Journey 3 of document 06 says the same. |
| VE-2 | MAJOR | The way back is additive, capped and command-only. | STATED AS LIMIT in Journey 3 of document 06. |
| VE-3 | MAJOR | The plan did not say which work is done elsewhere. | FIXED: document 06 has a paragraph on work done elsewhere. It does not list animated position or scale, because keyframe animation exists at the baseline. |
| VE-4 | MAJOR | Replacing a take after the clip has been split is not covered end to end. | PARTLY FIXED: MPR-105 refuses by clip and gives the reason. MPR-605 records that its journey does not cover the case and that whichever card merges second extends it. |
| VE-5 | MAJOR | Undo has no key, and saving the story ends undo history without warning. | FIXED: MPR-601 adds a key map; MPR-104 and MPR-102 say before the save that undo history ends. |
| VE-6 | MAJOR | Ripple leaves other tracks out of step; relink discards position without asking. | FIXED: MPR-601 states before a ripple edit how many clips on other tracks will not move; relink in MPR-602 needs a second press. |
| VE-7 | MAJOR | Preview of a LUT or a retime, and the effect on pitch, are not pinned. | FIXED: MPR-602 pins the effect on pitch by a test before the control ships. |
| VE-8 | MINOR | The manifest cannot be saved from the page. | FIXED: MPR-603 adds the link `export-manifest-save` once MPR-701 is on `main`. |

### 3.5 Open-source maintainer

Verdict: yes with fixes. The reviewer would refuse the merge while OM-1 and OM-4 stand.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| OM-1 | BLOCKER | Existing licence defects (notices, source offer, SBOM) wait behind feature cards. | PARTLY FIXED: part a of MPR-209 has no dependency and is the first pull request of Stage 2 in the handoff. It was not moved to Stage 0. Making MPR-301 wait for MPR-209 is OA-13. |
| OM-2 | MAJOR | The decisions in document 04 disagree with the cards. | FIXED: a script compared them. 55 of 56 agree. The difference is MPR-222, which document 04 calls DEFER, then BUILD and the card calls DEFER. |
| OM-3 | MAJOR | Several licences are assumed, not read. | PARTLY FIXED: cards that name an unread licence read it at step 0. The licence of the `windows` crate in MPR-508 is still [ASSUMED]. |
| OM-4 | MAJOR | The package check would fail on the first implementing merge, because new files would then exist. | FIXED: in MPR-003 the rule that new files must not exist applies to cards in a planning state alone. This holds only when MPR-003 lands before any card that creates a listed file, which is the handoff's Stage 0 order. Rendering the task program in CI was not adopted (section 6). |
| OM-5 | MAJOR | A few files are edited by dozens of cards. | PARTLY FIXED: handoff section 5.3 sends every pull request that edits one of them through one merge queue, and document 08 section 6 points there. Its premise about parity counts was wrong (section 6). |
| OM-6 | MAJOR | The order of schema steps was stated three ways. | FIXED: handoff section 5.1 is the authority, and documents 03, 05 and 08 point to it. |
| OM-7 | MAJOR | Many cards are larger than one pull request. | LEFT OPEN: OA-14. |
| OM-8 | MAJOR | Windows CI has no budget. | FIXED: MPR-804 cancels superseded runs and caches LFS objects. The LFS quota and the free runner minutes are still [UNKNOWN] and are checked by the founder under FD-8. |
| OM-9 | MINOR | Small contradictions between documents. | FIXED: the record size in document 11 and the sentence on parked cards in the README. The index kept by MPR-002 stays hand-kept, and the card says so. |

### 3.6 Competitive product reviewer

Verdict: yes with fixes. CR-1 to CR-5 must be settled before MPR-803 is unblocked.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| CR-1 | BLOCKER | The thesis claimed a priced shot. | FIXED, as PS-7. |
| CR-2 | MAJOR | The choice of competitor configuration tilts the comparison. | PARTLY FIXED: H-A in document 00 names configuration 2-R as recommended, a result against 2-W names its configuration, and Lightricks' studio is NOT TESTED. Allowing comparative labels against 2-R alone is OA-3. |
| CR-3 | MAJOR | The protocol is not fixed before outcomes exist, because the briefs are reused. | PARTLY FIXED: document 10 section 11 names the reuse as a threat. A fresh brief set is OA-2. |
| CR-4 | MAJOR | Pair P1 does not exercise the mechanism H-B claims. | FIXED: H-B now says its cause is NOT TESTED. |
| CR-5 | MAJOR | Some evidence labels in the matrix break the matrix's own rule. | PARTLY FIXED: the rows named were corrected. The whole matrix was not audited again (section 5.4). |
| CR-6 | MAJOR | Editing inside a clip, which competitors offer, was understated. | FIXED: document 01 section 5 item 10. |
| CR-7 | MAJOR | The word leadership was used for measures with no comparison. | FIXED: document 00 section 3 is now a plain list of what is measured. |
| CR-8 | MAJOR | Answers to the strategic questions read as results. | FIXED: answers 2 and 3 open with the words Not shown, and plugins are named in answer 1. |
| CR-9 | MAJOR | Some measures have no comparative plan, and M14 is not run by an agent. | FIXED: MPR-805 is titled as a scripted agent, document 00 answer 6 says a model-driven agent is NOT TESTED, and M12 is stated to have no card. |
| CR-10 | MINOR | A loss has no consequence. | FIXED: MPR-801 defines the label LOSES, and document 10 section 11 states the scope of any result. |

### 3.7 AI model engineer

Verdict: yes with fixes. ME-1 must be settled before any Stage 6 local card.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| ME-1 | BLOCKER | Image and speech operations had no owning card. | FIXED: MPR-220 adds `textToImage` and MPR-221 adds `textToSpeech`, each by the five intake steps of MPR-206. |
| ME-2 | MAJOR | The capability report and preflight cannot describe references, audio output, controls or extension. | PARTLY FIXED: `limits` in MPR-202 has a `references` entry, and, by OA-15 (accepted on 2026-11-23), sound and a range of lengths; a request may name references. Controls and extension are still not described, as MPR-202's risks say. |
| ME-3 | MAJOR | The worst-case figure is a waiting time used as a unit of spend. | LEFT OPEN: OA-1. MPR-203 states the limit under risks. |
| ME-4 | MAJOR | The preflight hash changes when the run does not. | FIXED: the hash in MPR-203 covers the parts that define the run. |
| ME-5 | MAJOR | The stored identity cannot reproduce or attribute a take. | PARTLY FIXED: OA-16, accepted 2026-11-23 and the fields in MPR-101. A Kaggle run reports its script's own pins, model and the seed it was sent, not all that was installed, so a take still cannot be reproduced from its record. |
| ME-6 | MAJOR | A capability cell's state follows paperwork, not measurement. | PARTLY FIXED: the conformance kit has more cases. OA-17 was accepted on 2026-11-23: an adapter must name a failure class (MPR-207), and MPR-202's text asks for a date and a sample size of each measured fact. |
| ME-7 | MAJOR | The consistency study can pass on the anchor frame. | PARTLY FIXED: MPR-405 does not show or score frames before one quarter of the clip, and each task asks for a change of framing. The unit of analysis must be stated before any run. |
| ME-8 | MINOR | The failure classes are too few. | FIXED: OA-18, accepted 2026-11-23: MPR-207 has eleven classes, and MPR-210 classifies a 401 answer as `credentialRejected`. |
| ME-9 | MINOR | Thresholds for local weights had no measurement rule. | FIXED: MPR-220 and MPR-221 state how each figure is measured, and record BLOCKED otherwise. |

### 3.8 Systems architect

Verdict: no second scheduler, store or project format was found. SA-1 to SA-4 must be settled
before the schema cards of Stage 2.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| SA-1 | MAJOR | Schema steps had no single order and no protection once landed. | PARTLY FIXED: handoff section 5.1 is the single list, and MPR-507 adds both of its columns in one part. Pinning each landed step by hash is OA-22. |
| SA-2 | MAJOR | Creating the sample project was not idempotent. | FIXED: MPR-604 takes an idempotency key, and the same key returns the same project and job. |
| SA-3 | MAJOR | What a restore does to approvals, budgets and audit rows was not stated. | FIXED: handoff section 5.1 states the rule. |
| SA-4 | MAJOR | Gate, budget and approval met at the start of a run with no stated order. | FIXED: MPR-505 reserves at filing, checks again at approval and commits at the gate before any connection opens. |
| SA-5 | MAJOR | Take capacity inside the story's size limit was not worked out. | FIXED: MPR-101 gives the figures, and document 12 section 7.1 repeats them. |
| SA-6 | MAJOR | Take records ride on the story's version table; a reader without a kind filter would break. | PARTLY FIXED: a test in MPR-101 fails when a query of that table lacks a kind filter. A dedicated table stays a rejected alternative that review may reopen; the handoff rule is to stop and report. |
| SA-7 | MAJOR | The revisions and undo history one take spends were not counted. | FIXED: MPR-101 counts them against `MAX_REVISION`. |
| SA-8 | MINOR | The audit row for an approved request was not specified. | PARTLY FIXED: MPR-506 writes one row carrying the approval request id. A row cap and a list of routes outside `execute` are OA-6. |
| SA-9 | MINOR | The consistency measurement had no job kind. | FIXED: kind `consistency-measure`, with `core/jobs.ts` among the card's targets. |
| SA-10 | MINOR | Some cards are too large. | LEFT OPEN, with OM-7: OA-14. |

### 3.9 Security engineer

Verdict: yes, with fixes.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| SE-1 | BLOCKER | MPR-101 stored prompt text unless the founder declined. | FIXED: the card builds with storage off and turns it on after FD-2 is recorded as accepted. |
| SE-2 | MAJOR | Nothing checked that the person sees what will run. | FIXED: a negative test in MPR-504 covers direction-override, invisible and control characters, and clipping. |
| SE-3 | MAJOR | A budget could be overshot by queued jobs. | FIXED: MPR-505 counts reserved rows in `agent_budget_usage`. |
| SE-4 | MAJOR | The approved host is a label; the Kaggle CLI chooses its hosts and inherits proxy settings. | PARTLY FIXED: the page says so, MPR-205 depends on MPR-204, and the options answer and the preflight show whether a proxy or a certificate override is set. Storing that state on the approval and refusing a start when it differs is OA-20, accepted on 2026-11-23 (MPR-204). |
| SE-5 | MAJOR | One standing approval could last a year. | FIXED: the page in MPR-204 proposes one run and one hour, and larger values are typed by the person. Document 11 states how strong an approval is before MPR-508. |
| SE-6 | MAJOR | The export sidecar carried an unsalted prompt hash. | FIXED: in MPR-701 the hash is written for an export the person opted in for, under FD-2. |
| SE-7 | MAJOR | Injected text was checked in two fields. | FIXED: a negative test in MPR-304 covers an asset name, a caption line and an OTIO clip name. |
| SE-8 | MINOR | The audit log is append-only, not tamper-evident. | FIXED as a statement in document 11 section 4.3. |

### 3.10 Resource-constrained Windows user

Verdict: yes, with fixes.

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| WU-1 | BLOCKER | The measurement Stage 2 rests on may not finish, and the card had no branch for that. | FIXED: MPR-507 part a records the peak and the stop when a run meets the wall limit, repeats at the largest scene that completes, and records free disk first. |
| WU-2 | MAJOR | There is no total disk figure and no way to reclaim space. | PARTLY FIXED: document 12 section 8 says nothing in Stages 0 to 3 frees disk. A worst-case table for one project is OA-21. |
| WU-3 | MAJOR | The sample project contradicted document 12 on disk. | FIXED: MPR-604 needs the reserve plus twice the sample's size, and says before the press that the sample cannot be removed. |
| WU-4 | MAJOR | Memory is limited per process and never measured together. | FIXED: the receipt of MPR-605 records free memory at the start and the peak of each Yamakan process. Document 12 says the budget excludes the browser. |
| WU-5 | MAJOR | The first screen did not say that nothing generates on this PC. | FIXED: MPR-604 shows 'Video generation is not set up on this PC. It needs a route you set up and approve.' when no route is set. |
| WU-6 | MAJOR | Qualifiers need disk and conditions this host often lacks. | FIXED: the common contract makes each qualifier record free disk, free memory and power state first, and end BLOCKED below its need. |

## 4. What the code-verification passes found

Seven passes read the cards against the code before the reviewers saw them. They reported 182
statements that the code did not support or that they could not confirm: 17, 30, 30, 29, 29, 21
and 26 by pass. Each was either corrected to what the code shows, or kept and marked in the card
as assumed or not verified with an instruction to read it at step 0.

The registry is built from the cards as first drafted plus a logged list of corrections. The
build applies 533 corrections to card text, from the verification passes, the dependency check,
the reviewers and the planner's own decisions. It also renumbers 51 step references in 17 cards
that were drafted with steps counted from one, so that every card counts from step 0.

Examples of facts taken from the code and not from earlier plans:

- The story has no dialogue field at the baseline. MPR-106 adds it.
- The engine contract names five operations; three of them have no adapter.
- `.github/workflows/qualify.yml` has no `concurrency` key.
- `tests/parity.test.ts` holds no counts. It compares the MCP tool list with the REST list at run
  time. (An earlier version of this line said it held the counts as literals; that was wrong.)
- The service never reads free memory.

The dependency check and its eleven findings are in section 6 of
[03_GAP_AND_DEPENDENCY_ANALYSIS.md](03_GAP_AND_DEPENDENCY_ANALYSIS.md), with the 77 mentions of a
card outside the mentioning card's dependencies, each of which was read, and the seven pieces that
two cards share under a rule that the second to merge re-reads the first.

Limit: the passes read code. They ran nothing. A statement in a card about behaviour at run time
is a reading of the code, and step 0 of every card reproduces the gap before building.

## 5. Weaknesses that remain

### 5.1 Open amendments

Each row is a change to card text that a reviewer or a check asked for and that this package
does not make, but for the parts marked as accepted. The founder accepts or refuses each one. An accepted amendment is made in the
registry, the task program is rendered again, and the package check is run.

| Id | Cards | Proposed amendment | Raised by | Decide before |
|---|---|---|---|---|
| OA-1 | MPR-203 | The generation row records what the run used beside what preflight estimated, with a flag `exceededWorst`. | ME-3 | MPR-203 |
| OA-2 | MPR-802, MPR-803 | Protocol v2.1 uses a fresh brief set, pinned by hash, that no operator has worked. | CR-3 | MPR-802 part a |
| OA-3 | MPR-801, MPR-803 | A comparative label is allowed against configuration 2-R alone; a run against 2-W is descriptive. | CR-2 | MPR-803 |
| OA-4 | MPR-302, MPR-104 | A stage can be sent back with a note of at most 240 characters, kept in the story. No new table. | CD-1 | MPR-302 |
| OA-5 | MPR-101, MPR-103, MPR-104 | The take record gains `revisionNote` (accepted by the founder on 2026-11-23), and the shot card lists attempts from `yamakan.shot.history` (not put to the founder; open). | CD-7 | MPR-104 |
| OA-6 | MPR-506 | The audit log has a row cap with a stated behaviour at the cap, and the card lists every mutating route that does not pass through `execute`. | SA-8 | MPR-506 |
| OA-7 | MPR-402, MPR-403 | The order in which the two cards raise the story version is carried by a dependency, not kept by hand. | Dependency check, finding 3 | The second of the two starts |
| OA-8 | MPR-302, MPR-301 | The approval prompt shows the stage's text and, when an approval is stale, the scene and shot ids that differ. | CD-2 | MPR-302 |
| OA-9 | MPR-302 | The shot-list approval shows the summed estimated seconds; MPR-302 then depends on MPR-203. | CD-5 | MPR-302 |
| OA-10 | MPR-106, MPR-303 | The brief form shows a plain fullness measure, not bytes, and a proposal shows shot names and timecode, not ids. | CD-8 | MPR-106 |
| OA-11 | MPR-104 | The shot card shows the route's maximum clip length and marks a shot that is longer. | FM-5 | MPR-104 |
| OA-12 | MPR-604, MPR-101 | The sample story has two shots with declared takes, so the first screen shows the revisable shot; MPR-604 then depends on MPR-101. | FM-8 | MPR-604 |
| OA-13 | MPR-301 | MPR-301 depends on MPR-209, so that no Director work ships before the notices are right. | OM-1 | MPR-301 starts |
| OA-14 | MPR-003 and every card with parts | The registry carries a state and an acceptance list for each part of a card. | OM-7, SA-10 | MPR-003 |
| OA-15 | MPR-202, MPR-101, MPR-203 | The capability report gains `audioOut` and a range for `durationFrames`; requests gain a `reference` role (accepted by the founder on 2026-11-23). | ME-2 | accepted |
| OA-16 | MPR-101, MPR-201 | The take record gains the runtime lock, the provider's model id and version, and the seed the run reported (accepted by the founder on 2026-11-23; the amendment does not say what MPR-201 changes, so its text is as it was). | ME-5 | accepted |
| OA-17 | MPR-207, MPR-202 | `failureClass` becomes required, and each measured fact carries a date and a sample size (accepted by the founder on 2026-11-23). | ME-6 | accepted |
| OA-18 | MPR-207 | Three more failure classes: `credentialRejected`, `contentRefused`, `resourceExhausted` (accepted by the founder on 2026-11-23). | ME-8 | accepted |
| OA-19 | MPR-203 | Preflight carries the route's licence state, so a person sees it before the run and not after. | Planner | MPR-203 |
| OA-20 | MPR-204, MPR-205 | The egress approval stores whether a proxy or a certificate override was set, and a start is refused when that differs (accepted by the founder on 2026-11-23). | SE-4 | accepted |
| OA-21 | Document 12 | Section 8 gains a table of the worst-case disk use of one project. | WU-2 | MPR-507 part a |
| OA-22 | MPR-204, MPR-507, MPR-303, MPR-504, MPR-505, MPR-506 | Each landed schema step's text is pinned by hash in `tests/workspace-db.test.ts`. | SA-1 | MPR-204 |
| OA-23 | MPR-003, MPR-209 and other cards with parts | The package check gets a part-aware rule, so a part that lands before its card's dependencies does not fail it. MPR-209 part a is the confirmed case; others were not examined. | Review of #281 | MPR-003 |
| OA-24 | MPR-209 | Acceptance, tests, files and an offer field for the new `NOTICE` entries, the FFmpeg source or written offer, and `node.exe`, whose hash is the running host's and so differs between hosts. | Review of #281 | MPR-209 part a |

The planner's view on timing (OA-1 to OA-22): OA-5 and OA-16 both change the take record that MPR-101 creates.
The record is versioned and a later additive step is possible, but each is cheapest before
MPR-101 merges. OA-4 and OA-8 answer the creative director's blocker and both land in MPR-302.
OA-18 changes a closed list, so it was cheapest before MPR-207 fixed that list, and it was accepted
before it. The rest can wait for the card named.

### 5.2 Gaps with no owning card

No card in this plan does the following. Each is stated so that nobody assumes otherwise.

- Following a render again after the page reloads.
- Correcting three stale texts in the repository: the two process counts in `docs/SECURITY.md`,
  of which the code supports the lower; the `playback720p` fixture text in
  `core/qualification-policy.ts`; and the comment above `generationOf`.
- Stating in the generation preflight how much disk a run will take.
- Removing the sample project. No project delete command exists, and MPR-604 says so before the
  press.
- Export to EDL, FCPXML or AAF. Interchange is OTIO.
- Running the usability study (measure M12). Document 10 section 7 is a method with no card.
- A match-move control on the Cinema page. Tracking and match-move stay commands
  (`yamakan.blender.track`, `yamakan.track.read`).
- A decision on the preview flag `JASSUB_ENABLED` in `core/preview/jassub-flags.ts`. No card names
  it, and this plan leaves its state as it is.
- Collecting a project's media into a folder for another tool.
- Editing inside an existing clip: inpainting, object removal, extension. The operation
  `videoEdit` has no adapter, and no card adds one.
- Freeing disk held by registered objects, and any retention policy for old takes.
- An agent test driven by a language model. MPR-805 uses a fixed script.
- A second human approver. There is one human principal.
- Generated sound, performed dialogue and lip sync. MPR-221 is the one audio card; it is speech,
  it is in Stage 6, and it waits for FD-4.

### 5.3 Figures that are not measured

- The largest Blender render the input schema admits, against the wall limit. Document 12
  section 5 extrapolates it, labelled [ASSUMED]. Part a of MPR-507 measures it.
- Time and peak memory for local image and speech weights on a CPU (MPR-220, MPR-221).
- The combined memory of the browser, the service, FFmpeg and Blender on the founder host.
  MPR-605 records it for the first time.
- The disk one real project takes (OA-21).
- Kaggle's quota behaviour and terms. The terms have not been read by the founder or counsel
  (FD-3).
- Windows CI minutes and the LFS quota: [UNKNOWN] (FD-8).
- Every hypothesis, H-A to H-E: NOT TESTED.

### 5.4 Limits of the evidence

- **The competitive matrix was not audited again in full.** The labels a reviewer named were
  corrected. Other rows may still carry a label stronger than their source.
- **Sources were not opened again at consolidation.** [SOURCES.md](SOURCES.md) holds 476 keys
  copied from the research notes by a script. Its own section 6 lists the known defects, among
  them 81 addresses that carry more than one key and two keys cited without a label. A page may
  have changed since the note that cites it was written.
- **Research notes quote line positions as of the drafting head.** `main` moved once during
  drafting. The numbered documents give paths without line positions.
- **The verification passes read code and ran no test** (section 4).
- **One model family wrote, verified and reviewed the plan** (section 1).
- **Prices, quotas and terms of outside services change.** A card that depends on one reads it
  again at step 0.

### 5.5 Judgement calls inside cards

Each of these is a choice the planner made where the code or the record did not settle the
matter. Each is written in the card under risks or compatibility. A reviewer may reverse any of
them.

- **MPR-010** reverses a consent rule that pull request 179 kept on purpose. If the reviewer
  judges that a change of consent rule needs the founder, the card stops after step 3 and waits.
- **MPR-101** keeps take records in the story's version table, by kind. A dedicated table was
  rejected and stays reopenable (SA-6).
- **MPR-105** moves the proposal format to version 2. The note of SS-011 says no new take schema;
  the card changes the proposal format and not the story's take schema, and SS-011 must then use
  version 2 proposals.
- **MPR-106** gives text 96 KiB of the story's 256 KiB. The split is an estimate.
- **MPR-211** reuses the human-only scopes `consent:grant` and `consent:revoke` for adding and
  removing a credential. The alternative is a new human-only scope, which needs the founder.
- **MPR-221** sets word-error thresholds that are [ASSUMED] and that the founder confirms before
  the run.
- **MPR-304** takes MCP field names and error codes from memory of the published specification.
  Step 0 reads them again.
- **MPR-506** writes the audit row inside `execute`. Routes that upload bytes do not pass through
  it (OA-6).
- **MPR-603** leaves two export buttons, in the top bar and in the panel. The panel says so.
- **MPR-604** adds one command and one job kind, `sample-media`, to make a sample project without
  a download.
- **MPR-606** cannot close H1 or X-01. Both close when a human native Arabic reviewer's record is
  committed by X-01's own process.
- **MPR-802** needs an operator and a rubric reviewer named by the founder. Without them part b
  is BLOCKED.
- **MPR-222** is DEFER in the card and DEFER, then BUILD in document 04. The card is the
  authority.
- **The story format is raised by several cards** (MPR-101, MPR-402, MPR-403), each by its own
  additive step, inside one size limit. The order of the last two is kept by hand (OA-7).

## 6. Rejected ideas, with reasons

None of these is in the plan. Each stays rejected until a founder decision or new evidence
changes the reason given.

### 6.1 Product ideas

| Idea | Reason for rejection |
|---|---|
| A Yamakan cloud, a credit balance or a wallet | It makes Yamakan a reseller of inference and a holder of customer money. That conflicts with local-first and with zero unapproved spending, and FD-5 is not answered. Cost is shown as time, quota seconds and bytes leaving the PC. |
| A chat agent inside the product, with a bundled language model | Yamakan ships no language model. A bundled one is a download and a memory load the founder host cannot carry. An outside agent already has a governed route through the CLI, the SDK and MCP, and a chat box would be a second route to the same commands. |
| A built-in script or storyboard writer | The same reason. The Director proposes structure over typed commands; the words are the person's, or an outside agent's under approval. |
| A node canvas | It is a second project structure beside the one story and the one timeline, with its own save format, undo and merge rules. Comparing and branching variants is done with takes and shot history. |
| A simple mode and an expert mode stored in the project | A mode stored in the project forks what a project may contain. Simple and advanced are views of one project (document 06 section 4). |
| Training character models on customer faces | It needs GPU training, weight downloads and consent for biometric data, none of which is authorised. Identity is reference management plus a measured figure (MPR-401, MPR-402, MPR-405). |
| A model marketplace | It counts integrations, which the brief says is not success. Each route still needs the licence gate and the conformance kit, and a marketplace adds third-party code and payment. |
| Real-time generation | It needs hardware or hosted inference that is not authorised. The one route at the baseline takes about nineteen minutes for one clip. |
| A mobile app | The service listens on the local machine. A mobile client needs remote access to the command service, which is a new security boundary, while Windows qualification is not finished. |
| A new timeline or project format; a second importer; sidecar files per take | One canonical project and timeline is a founder decision. Interchange is by OTIO, which exists. Take records are documents of the existing store. |
| A second scheduler; priority or parallel job scheduling; a second worker beside Blender | The supervisor in `core/jobs.ts` is the job authority, and the memory arithmetic of the frozen resource policy assumes one render at a time. MPR-507 adds a queue inside the supervisor. |
| A separate database or file for the audit log or the budget | The workspace database is the store. A second one would need its own backup, restore and epoch rules. |
| Controls that imply edits inside generated pixels on a flattened clip | They promise editability the source cannot supply. The level word on the shot card says what can be changed. |
| A consistency badge with no number, or one drawn from automatic metrics | Storing a reference is not demonstrated consistency. MPR-405 gives a figure from blind human matching, or NOT TESTED. |
| One generic extend or edit operation across vendors | Routes differ in what they accept and return. An operation is named for what a route does, and a route that cannot do it has no cell. |
| Codec and bitrate controls | The export path is a small qualified set. Each new combination needs its own qualification on the founder host. |
| Hosted review links, or live approval by several people | Both need a hosted service and a second human principal. Neither exists, and neither is authorised. |
| Storyboard frames generated by a hosted model by default | It is egress and possibly spend without an approval for that run. |

### 6.2 Models, downloads and licences

| Idea | Reason for rejection |
|---|---|
| Bundled or hosted models to match the quality of a competitor's demonstration | An unapproved download or unapproved spending. The plan competes on what happens to a shot after it is made, and says so. |
| Bundling or fetching a lip-sync, voice, identity, face-recognition or embedding model; a small model fetched at first run | No unapproved model download. FD-4 is not answered, and MPR-220 and MPR-221 wait for it. |
| Copying AGPL editor code or weights under a non-commercial licence | The import policy forbids both. Document 04 records the decision for each source. |
| Shipping a real provider before MPR-203 and MPR-204 | A provider with no preflight and no gate could send data or spend without an approval. |
| Currency estimates or live price quotes | No paid route is authorised. MPR-505 keeps currency fields in its schema so that MPR-222 needs no second migration; no money figure is shown. |

### 6.3 Claims

| Idea | Reason for rejection |
|---|---|
| Counting providers or models as progress | The brief says success is not the number of integrations. |
| Any comparative statement before MPR-803 has run | Nothing has been compared. Every comparison is NOT TESTED. |
| A quality headline from pair P2 | P2 compares workflows on one model. It says nothing about which model is stronger. |
| A label MATCHES at 36 to 54 briefs | A sample of that size cannot support equivalence. MPR-801 never emits the label. |
| An automated or vision-model judge in place of blind raters | Such a judge is not validated for these measures. Automatic scores are reported as descriptive beside the human result. |
| Automating the competitor's web product | It would breach that product's terms and makes the run depend on an interface that changes. An operator works it by hand and the session is recorded. |
| Saying a generated shot follows the Blender camera | No route at the baseline accepts a camera path. MPR-404 is deferred until one does. |
| A line that says the export works with Premiere or Resolve | NOT TESTED. The panel says so. |

### 6.4 Approvals, agents and automation

| Idea | Reason for rejection |
|---|---|
| Approval by an agent, approval that passes after a time, or automatic approval of low-risk requests | Each removes the person from a human-only command. |
| Asking for approval at the generation and editing stages of the Director plan | Generation already has a human-only start and gate approvals (MPR-204), and an edit proposed by an agent is already applied by a person (MPR-303). A third prompt would repeat the same decision, and would suggest that approving a plan binds commands started outside the plan, which it cannot. |
| Automatic retry or resubmission of a failed run | A retry spends quota and sends data again without an approval for that run. MPR-507 adds a rerun that a person starts. |
| Automatic retry of failed CI jobs | It hides an unreliable test. A failure is read. |
| Paid or self-hosted runners for outside pull requests | Paid runners are spending. A self-hosted runner executes outside code on the founder's machine. |

### 6.5 Limits, resources and security

| Idea | Reason for rejection |
|---|---|
| Raising the Blender limits, the 200-clip or ten-minute limit, `STORY_LIMITS`, `DOCUMENT_LIMITS`, `RESOURCE_POLICY` or a threshold so that the founder host passes | The policies are frozen, and a limit raised to pass a check is no longer a check. A change is a founder decision with new qualification. |
| A rented GPU | Spending, and paid infrastructure is not authorised. |
| Automatic pruning of old takes | Retention is a founder decision, and the history of a shot is what the plan sets out to keep. |
| A firewall rule or driver that pins the hosts the Kaggle CLI may reach | It changes system settings on the person's PC. The page states that the CLI chooses its hosts. |
| A remote copy or attestation of the audit log | It adds egress and breaks local-first. Document 11 states that the log does not detect an edit made outside the service. |
| Encrypting the whole store under a vault key | It is no defence against a process running as the same account, and it adds a way to lose the project. |

### 6.6 Changes to this plan that were proposed in review and refused

| Proposal | Reason for refusal |
|---|---|
| Restructure Stage 2: drop the intake card, drop currency fields from the budget, move editor cards earlier (PS-6) | MPR-206 defines the intake steps that MPR-220 and MPR-221 follow. MPR-505 keeps currency fields so that MPR-222 needs no second budget migration. The editor cards with no dependency (MPR-601, MPR-603, MPR-604, MPR-605) can already be built alongside Stage 2. |
| Move MPR-403 into Stage 1 (FM-1) | MPR-403 waits for the owner's Blender stream and depends on MPR-101 and MPR-106. Stage 1 would then wait on a stream in motion. Stage 1 stays seven cards on the story and take path, and its limit is stated. |
| Make the recommended answer to FD-2 a condition of the Stage 1 exit (PS-3) | A plan cannot make a founder decision a condition of its own stage. Stage 1 is demonstrated with whichever answer is recorded. |
| Move MPR-209 to Stage 0 (OM-1) | Part a has no dependency and is first in Stage 2. Stage 0 is kept to adoption, the package check and CI. The founder may reorder under FD-11. |
| Render the task program in CI and stop committing it (OM-4) | A reviewer reads the cards in the pull request. The committed file is compared with the registry by the rendering check, and a CI rendering would wait for MPR-804. |
| Derive the two counts in `tests/parity.test.ts` from the registry (OM-5) | There is nothing to derive: the file holds no counts, so the earlier reason (a literal tripwire) was wrong. No test pins the count. Whether to add one is open. The 25 cards that list the file check at step 0 whether they need to edit it. |
| A dedicated table for take records (SA-6) | It is a schema step that the handoff says MPR-101 must not need, and the version table already keeps documents by kind. It is reopened if a reader without a kind filter is found. |
| Editing the rendered task program by hand | The registry is the source. The rendering check fails on any hand edit. |

## 7. Questions for founder review

1. Three blockers are not closed (CD-1, FM-1, OM-1). Is each acceptable as it stands, or should
   its amendment be made first: OA-4 and OA-8 for CD-1, OA-13 for OM-1? FM-1 has no amendment; it
   is a limit of what Stage 1 is.
2. OA-5 and OA-16 change the take record. Should either be made before MPR-101 is built? Answered
   on 2026-11-23, before MPR-101 merged: both are recorded.
3. The exit of Stage 1 needs three working editors or creative leads on the founder host. Can
   that be arranged? If not, the exit stays BLOCKED.
4. MPR-010 reverses a consent rule that an earlier pull request kept on purpose. It proceeds under
   the delegation of 2026-11-07 without a new answer, unless its reviewer judges that the change
   needs the founder (section 5.5); the founder may overrule it.
5. Is Stage 1, as limited in document 00 section 5 (silent clips of a few seconds, no control of
   framing or performance, no prompt refill without FD-2), the right first deliverable under
   FD-11?
6. Should a person outside this model family review the plan before FD-1 is answered? The
   package has had no human review.

See also [00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md),
[08_ROADMAP.md](08_ROADMAP.md), [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md),
[10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md),
[11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md),
[12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md) and
[FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md).
