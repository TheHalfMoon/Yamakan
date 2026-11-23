# Roadmap

> Status: ADOPTED — the current frontier by founder instruction. Each card stays gated by its state and founder decisions.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document orders the 56 cards of the revision into seven stages, says what
each stage is for, what ends it, and which gates and founder decisions stand in
front of it. The cards themselves are in [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md)
and in [TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json); this document
does not restate them. The decisions are in
[FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md). The build
order inside a stage, pull request by pull request, is in
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md).

The roadmap states order and exit conditions only. It contains no calendar
dates and no effort estimates, because none were measured.

## 1. How to read it

- A **stage** is an ordering group with an exit condition. A **track** is a
  subject area. Every card has one stage and one track. The two do not always
  agree: MPR-804 is in the benchmark and qualification track but belongs to
  Stage 0, and MPR-303 and MPR-305 are Director cards that belong to Stage 2.
- A stage number says when a card is expected, not when it is allowed. A card
  may start when its own dependencies are verified and the order of FD-11
  permits it. Section 7 lists the cards that are expected to start earlier
  than their stage number suggests.
- MPR-001 recorded the adoption on 2026-11-23 and a later entry that day records
  the founder's word to build; the cards are built under it, each behind its own
  gates and founder decisions.
- Card states at the planning baseline: 14 `QUALIFICATION_READY`, 33
  `WAITING_DEPENDENCIES`, 7 `EXTERNAL_BLOCKED`, 2 `DEFERRED`. MPR-003 added the
  two completion states (`REVIEW_PENDING`, `VERIFIED`); the registry holds each
  card's current state.
- Every card obeys the common contract printed at the top of
  [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md). Its first rule is that step 0 of a
  card re-checks live `main`; a gap that is already closed is recorded
  ALREADY_SATISFIED and not rebuilt.

## 2. Relation to the plan already in force

This roadmap extends the System Supremacy programme. It does not replace it.

- The programme's open cards keep their ids, states and order. The mapping of
  every earlier item to this revision is in
  [LEGACY_RECONCILIATION_ADDENDUM.json](LEGACY_RECONCILIATION_ADDENDUM.json).
- Three cards of this revision depend on a programme card: MPR-104, MPR-105
  and MPR-303 depend on SS-006, which is verified. MPR-702 completes the
  remaining items of SS-015 and lists it as an earlier item, not as a
  dependency; SS-015 stays open and closes on its own qualification.
- Several programme cards are served by cards here and are not closed by them:
  SS-011 (take comparison in the editor) by MPR-104, SS-016 (selective revision
  measure) by MPR-107 and MPR-802, SS-013 and X-01 (Arabic review) by MPR-606.
  Each of those programme cards still closes on its own qualification.
- The seven founder-directed streams merged since 2026-11-05 are kept as built.
  The Blender stream is still in motion: pull request #279 was open and not
  merged when the baseline was re-verified on 2026-11-22.

## 3. Order of work

FD-11 asks the founder to confirm this order. The default, if it is not
decided, is that the implementation owner continues the current streams.

0. Finish the in-flight Blender pull requests, #279 included. No card of this
   revision assumes #279 is merged; step 0 of each card finds out.
1. Merge the planning pull request, on the founder's explicit word. MPR-001 needs the
   package on `main`.
2. Stage 0, so the written record and the checks are true before feature work.
3. Stage 1, before any new feature stream is opened.
4. Stage 2 and Stage 3, which can interleave by lane (section 6).
5. Stage 4, then Stage 5. MPR-801 is the exception: it is written early
   (section 7).
6. Stage 6 only as each founder decision is recorded.

Why this order. Stage 1 has the highest ratio of effect to cost: it needs no
new model, provider or hardware, and it turns records the product already
holds into the thing the thesis promises. Stage 2 comes next because nothing
that leaves the computer, and no agent, should gain reach before the gates and
the honest tool list exist. Stage 3 is cheap for what it shows, because most
of its editing commands already exist and only lack a place in the browser.
Stage 4 needs the take record of Stage 1 and the capability report of Stage 2.
Stage 5 measures what the earlier stages built. Stage 6 is everything that
waits for a decision only the founder can make.

## 4. The stages

### Stage 0 — Truth and frontier

Purpose: make the record match the code. Adopt the revision, date the stale
documents, wire the plan check, settle one consent rule, and widen Windows CI.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-001 | Adoption recorded; one current frontier; PRs #85 and #86 settled | VERIFIED | none | FD-1 |
| MPR-003 | Plan check in npm and CI; completion states; stream records verified | VERIFIED | MPR-001 | none |
| MPR-002 | Dated status banners and one current-state index | VERIFIED | none | none |
| MPR-010 | The pinned-take path past consent revocation is closed, with a test | REVIEW_PENDING | none | none |
| MPR-804 | Full suite, Studio tests, native build and safe qualifiers on Windows CI | EXTERNAL_BLOCKED | none | FD-8 |

Exit: MPR-001 recorded; MPR-002, MPR-003 and MPR-010 verified; MPR-804 verified
or recorded blocked on FD-8.

Order (kept as planned): the planning pull request was merged first, on the founder's word;
then MPR-001, MPR-003, and MPR-002 and MPR-010. Before MPR-003 the package check refused any
card's listed new file, so no card that creates one could merge before it.

Gates: qualification evidence becomes checkable (MPR-003, MPR-804); the consent
undo path is closed (MPR-010). MPR-010 is decided under the existing delegation
of 2026-11-07 and needs no new founder decision; the card states both rules and
which one it recommends.

### Stage 1 — The Revisable Shot

Purpose: the shortest path to the thesis. Every take carries its request as a
hashed record, a generation lands on the shot it was made for, a take can be
revised from its own record, and the history of a shot can be read.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-101 | An immutable, hashed record of how each take was made | VERIFIED | none | FD-2 |
| MPR-102 | A generation targets a story shot and appends its take on import | VERIFIED | MPR-101 | none |
| MPR-103 | A revision draft read from a take; what changed between takes is recorded | REVIEW_PENDING | MPR-101, MPR-102 | FD-2 |
| MPR-104 | Shot cards with the take stack and a 'Revise this shot' entry | WAITING_DEPENDENCIES | MPR-102, MPR-103, SS-006 | none |
| MPR-105 | A shot's take stays replaceable after its clip is split or trimmed | REVIEW_PENDING | SS-006 | none |
| MPR-106 | Brief, scene scripts and shot intent stored in the story document | VERIFIED | MPR-101 | none |
| MPR-107 | A bounded history of one shot: takes, attempts, replacements, totals | VERIFIED | MPR-101, MPR-102 | none |

Exit: MPR-101 to MPR-107 verified. One shot is generated or rendered onto its
shot, revised from its own record, compared and replaced, and its history read,
on the founder host with the stand-in route. Measure: in that demonstration
nothing outside the revised shot changes (project collateral change, M6p in
[10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md), is zero).
Observation: at least three working editors or creative leads invited by the
founder run the demonstration on the founder host and their remarks are
recorded; if this is not arranged it is recorded BLOCKED, never PASS.

Gates: none new. FD-2 must be answered before MPR-101 stores request text. With
the default answer (no prompt in the take record) Stage 1 still completes, but a revision draft
cannot refill the prompt and the person types it again.

Section 5 describes this stage as a demonstration.

### Stage 2 — Governed execution

Purpose: default-deny gates for egress, spend and download; a model catalog
with three-state capability cells, preflight and typed failures; an honest
agent surface with waits, approvals, budgets and an audit feed.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-201 | One model catalog; every existing model list checked against it | VERIFIED | none | none |
| MPR-202 | Capabilities as supported, unsupported or unverified cells | VERIFIED | MPR-201 | none |
| MPR-203 | Preflight: estimate, egress disclosure and a hash that start checks | WAITING_DEPENDENCIES | MPR-201, MPR-202, MPR-204, MPR-205, MPR-207 | none |
| MPR-204 | Default-deny gates with recorded human approvals | QUALIFICATION_READY | none | none |
| MPR-205 | The Kaggle command-line route contained; quota facts stated | WAITING_DEPENDENCIES | MPR-204, MPR-207 | FD-10 (second part only) |
| MPR-206 | Five engine operations defined; a conformance kit for every adapter | REVIEW_PENDING | MPR-201 | none |
| MPR-207 | A typed failure class and end time on every ended generation | REVIEW_PENDING | none | none |
| MPR-208 | Every offered model gated on a complete, machine-checked licence block | QUALIFICATION_READY | MPR-201 | none |
| MPR-209 | Notices, the source offer and the route licence shown; wider SBOM | WAITING_DEPENDENCIES | MPR-208 | none |
| MPR-210 | The hosted-provider profile, proven on a loopback fake only | WAITING_DEPENDENCIES | MPR-203, MPR-204, MPR-206, MPR-207 | none |
| MPR-303 | Hash-bound edit proposals; a propose-only agent mode | QUALIFICATION_READY | SS-006 | none |
| MPR-305 | A deterministic, reasoned route order from the router | QUALIFICATION_READY | MPR-202 | none |
| MPR-501 | An honest MCP tool list: scope filter, mutation flags, cancellation | VERIFIED | none | none |
| MPR-502 | A bounded job wait and a revision event cursor | QUALIFICATION_READY | MPR-501 | none |
| MPR-503 | CLI and SDK act as an agent; generated CLI help; media import helpers | QUALIFICATION_READY | MPR-501 | none |
| MPR-504 | Hash-bound approval requests for human-only commands | QUALIFICATION_READY | MPR-501 | none |
| MPR-505 | Per-agent budget envelopes enforced at approvals and gates | WAITING_DEPENDENCIES | MPR-504, MPR-203, MPR-204, MPR-507 | none |
| MPR-506 | An append-only audit feed and a provenance trace | WAITING_DEPENDENCIES | MPR-502, MPR-101 | none |
| MPR-507 | Blender worker in the memory budget; a fair queue; rerun from failed | QUALIFICATION_READY | none | none |

Exit: every card of the stage verified. Nothing leaves the computer, spends or
downloads without a recorded approval. The catalog, the capability report,
preflight and typed failures are the only source of model facts. An agent can wait, ask, be budgeted and be audited. Measure: zero
unapproved spend, egress or download across the stage's qualification runs
(M9 in document 10).

Gates: egress, spend, download, licence, containment and agent authority
(MPR-203 to MPR-208, MPR-501 to MPR-507). The first part of MPR-209 (notices, the source offer, the SBOM) has no
dependency and is the first pull request of Stage 2. MPR-210 talks to a loopback fake and
to no real service; a real provider is MPR-222 in Stage 6.

### Stage 3 — Editor depth and interchange

Purpose: put the existing command-only editing into the browser, add first run
and the continuity journey, register the production pipeline in the Director,
and write a provenance manifest beside every export.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-301 | The nine-stage production pipeline as a built-in Director manifest | WAITING_DEPENDENCIES | MPR-106, MPR-303, MPR-305, MPR-701 | none |
| MPR-302 | A production plan view in place of the debug Director controls | WAITING_DEPENDENCIES | MPR-301 | none |
| MPR-304 | Static MCP prompts and read-only, scope-filtered resources | WAITING_DEPENDENCIES | MPR-301, MPR-202, MPR-501 | none |
| MPR-601 | Ripple delete, ripple trim, insert and group move in the timeline | QUALIFICATION_READY | none | none |
| MPR-602 | Speed, LUT and sound unlink and relink in the clip inspector | WAITING_DEPENDENCIES | MPR-601 | none |
| MPR-603 | An export panel: loudness, size presets, batch status, OTIO losses | QUALIFICATION_READY | none | none |
| MPR-604 | First run: a locally built sample project and a capability banner | QUALIFICATION_READY | none | FD-3, FD-4 (banner wording only) |
| MPR-605 | A continuity journey test through Create, Story, Edit, Finish and back | QUALIFICATION_READY | none | none |
| MPR-606 | Arabic interface strings frozen; an unsigned review packet | WAITING_DEPENDENCIES | MPR-601, MPR-602, MPR-603, MPR-604 | none |
| MPR-701 | A provenance manifest beside every export and a readable report | QUALIFICATION_READY | MPR-101, MPR-201 | FD-2 |
| MPR-702 | Clip lineage in OTIO metadata; the OTIO import proposal appliable | WAITING_DEPENDENCIES | MPR-101, MPR-303, MPR-701 | none |

Exit: every card of the stage verified. The editing commands named in the cards
are reachable in the browser, the continuity journey passes, the Director shows
the production pipeline, and every export has a manifest. Measure: export reliability (M11) and
lineage completeness (M13), as document 10 defines them, are both 100% on the
stage's qualification runs.

Gates: the privacy defaults of the export manifest (MPR-701): what an export
carries about prompts follows FD-2 and is off unless the person chooses it.
MPR-606 prepares the Arabic review and does not sign it; the human review
stays with X-01.

### Stage 4 — Consistency and control

Purpose: entities with approved anchors, per-shot reference delivery reports,
one camera and render record per shot, and a consistency measurement harness.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-401 | An entity, an approved anchor and variants on each reference pack | QUALIFICATION_READY | MPR-101 | none |
| MPR-402 | Entities scheduled per shot; a report of what a route will receive | WAITING_DEPENDENCIES | MPR-101, MPR-102, MPR-103, MPR-202, MPR-203, MPR-401 | none |
| MPR-403 | One camera and render record per shot; the legacy scene store read-only | QUALIFICATION_READY | MPR-101, MPR-106 | none |
| MPR-404 | Blender depth and normal control passes for control-capable routes | DEFERRED | MPR-202, MPR-203, MPR-204, MPR-206, MPR-403, MPR-507 | FD-3, FD-4, FD-5 |
| MPR-405 | A consistency measurement harness with a local blind study | WAITING_DEPENDENCIES | MPR-201, MPR-202, MPR-401, MPR-402 | FD-3, FD-4, FD-5, FD-6 |

Exit: MPR-401, MPR-402, MPR-403 and MPR-405 verified; MPR-404 stays deferred
until its trigger is claimed.

Gates: none new. This stage manages references and measures consistency. It
does not demonstrate that any model keeps a character consistent; that is a
result MPR-405 may or may not produce, and only for routes a founder decision
has opened. MPR-404 has no consumer until some qualified route accepts a
control input, which is why it is deferred.

### Stage 5 — Qualification and benchmark

Purpose: pre-register the workflow benchmark, run the Yamakan-only baseline
and the supervised-agent measure, and only then decide the competitor arm.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-801 | Benchmark protocol version 2 and its exact analysis; nothing is run | QUALIFICATION_READY | MPR-101, MPR-107 | FD-3, FD-6, FD-7 |
| MPR-802 | The protocol frozen after a discarded pilot; the Yamakan-only baseline | WAITING_DEPENDENCIES | MPR-801, MPR-107, MPR-701 | FD-3 |
| MPR-803 | The competitor arm, after FD-6 and a terms check | EXTERNAL_BLOCKED | MPR-801, MPR-802, MPR-405 | FD-3, FD-6, FD-7 |
| MPR-805 | The supervised-agent measure with a scripted agent and a forced restart | WAITING_DEPENDENCIES | MPR-801, MPR-802, MPR-502, MPR-503, MPR-504, MPR-505, MPR-506 | none |

Exit: MPR-801, MPR-802 and MPR-805 verified, with every comparison still
NOT TESTED unless MPR-803 ran after FD-6.

Gates: no competitor spend and no rater recruitment before FD-6. The method is
in [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md). Until
MPR-803 has run, no document of this repository may state that Yamakan is
better than, equal to or worse than any named product.

### Stage 6 — Gated expansions

Purpose: cards that stay shut until a founder decision is recorded.

| Card | What it delivers | State | Depends on | Decision |
| --- | --- | --- | --- | --- |
| MPR-211 | A Windows DPAPI credential vault for customer provider keys | DEFERRED | MPR-201, MPR-210 | FD-5 |
| MPR-220 | A local still-image runtime qualified on the CPU-only founder host | EXTERNAL_BLOCKED | MPR-201, MPR-204, MPR-206, MPR-208 | FD-4 |
| MPR-221 | Local speech-to-text for Arabic and English captions; one local voice | EXTERNAL_BLOCKED | MPR-201, MPR-204, MPR-206, MPR-208 | FD-4 |
| MPR-222 | The first customer-authorised hosted provider, behind legal review | EXTERNAL_BLOCKED | MPR-201, MPR-204, MPR-208, MPR-210, MPR-211 | FD-5 |
| MPR-508 | Operating-system user presence for human-only commands | EXTERNAL_BLOCKED | none | FD-9 |

Exit: none. Each card opens only when its founder decision is recorded, and
closes on its own qualification.

Gates: B4 qualification for local weights (MPR-220, MPR-221); E-SEC and
provider terms (MPR-222); user presence (MPR-508). The gate definitions are in
[11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md).
Nothing in this stage is authorised by adopting the plan. FD-1 adopts the
order; it does not open a gate.

## 5. The shortest path to a usable product

Stage 1 is that path. It is seven cards, it needs no decision except FD-1 and
FD-2, and it runs on the founder host as it is today.

The demonstration that ends the stage, in the order a person would do it:

1. Write a brief, a scene script and a shot intent, close the browser, open
   another one, and find them still there (MPR-106).
2. Start a generation for a shot that already exists; bring the result in and
   see it appear in that shot's take stack, not as a loose file (MPR-102).
3. Open the take and read how it was made: route, model identity, request,
   inputs, timings (MPR-101).
4. Choose 'Revise this shot' on the shot card, change one field of the draft,
   and generate again; the new take's record names the take it came from and
   the field that changed (MPR-103, MPR-104).
5. Split the shot's clip on the timeline, then replace the take in one step,
   each piece keeping its own place (MPR-105).
6. Read the shot's history: every attempt, failed ones included, every
   replacement, and the totals of time and quota that were reported (MPR-107).

What this demonstration shows is the thesis sentence and nothing more: a shot
that stays revisable and attributable, with a stated cost in time and data,
inside one local project. It shows record-keeping, not generation: on the
stand-in route no model runs, and on the Kaggle route a clip arrives after
about nineteen minutes at the recipe's expected run time (1,132 seconds for
Wan2.2). It
does not show model quality, character consistency or speed against any other
product, and it must not be described as if it did. With no real route
configured it runs on the stand-in route; a real route is used only where the
environment already provides one and the person starts it.

The order inside the stage is MPR-101 first; then MPR-102; then MPR-103,
MPR-106 and MPR-107 in any order; then MPR-104. MPR-105 depends only on the
verified SS-006 and can be built at any point.

## 6. Lanes and collisions

Cards in different lanes can be built side by side. Cards in one lane are
built in the order shown. Lanes share the files listed in section 5.3 of
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md); a pull
request that edits one of them merges through one queue.

Stage 2:

- Model lane: MPR-201, then MPR-202, MPR-206 and MPR-208 in any order; MPR-305
  after MPR-202; MPR-209 after MPR-208. MPR-204 and MPR-207 have no dependency; MPR-205 after both. MPR-203 after MPR-201, MPR-202, MPR-204, MPR-205 and MPR-207.
  MPR-210 last.
- Agent lane: MPR-501, then MPR-502, MPR-503 and MPR-504 in any order. MPR-507
  has no dependency. MPR-505 after MPR-504, MPR-203, MPR-204 and MPR-507.
  MPR-506 after MPR-502 and MPR-101.
- Proposal lane: MPR-303 alone.

Stage 3:

- Editor lane: MPR-601, then MPR-602. MPR-603, MPR-604 and MPR-605 have no
  dependency. MPR-606 after the first four.
- Interchange lane: MPR-701, then MPR-702 once MPR-303 is verified.
- Director lane: MPR-301 after MPR-106, MPR-303, MPR-305 and MPR-701; then MPR-302;
  MPR-304 after MPR-301, MPR-202 and MPR-501.

Lanes are not free of collisions, because a few files are touched by many
cards. Counted from the cards' own lists of existing files:

| File | Cards that edit it |
| --- | --- |
| `package.json` | 39 |
| `core/command/registry.ts` | 38 |
| `src/i18n.ts` | 29 |
| `tests/parity.test.ts` | 25 |
| `src/main.tsx` | 18 |
| `core/engines/generation.ts` | 13 |
| `core/store.ts` | 11 |
| `core/jobs.ts` | 11 |
| `core/story.ts` | 8 |

Three rules follow. They are stated in full in
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md).

1. One workspace schema step is in review at a time. Up to six cards of Stages 1 to 5 add a step
   (MPR-303 only if its new column needs one), and MPR-222 adds one more in Stage 6; the order is
   set in section 5.1 of
   [OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md). No card
   owns a fixed version number; each takes the next free one when it is rebased.
2. The story document changes format in one order: MPR-101 first, which also
   carries the fields of MPR-106; then MPR-402 and MPR-403, each by its own
   additive step, all inside the existing 256 KiB limit of the story document.
3. `core/command/registry.ts`, `src/main.tsx` and `core/jobs.ts` are also
   being edited by the implementation owner's Blender stream. A card that
   touches them rebases on live `main` and re-reads them at step 0.

## 7. Cards that start earlier than their stage

- MPR-801 (Stage 5) needs only MPR-101 and MPR-107. It should be written as
  soon as Stage 1 ends, because a protocol must be registered before anything
  it measures is built to pass it.
- MPR-507 (Stage 2) begins with a measurement of the Blender worker's memory on
  the founder host. That number is an input to
  [12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md)
  and can be taken as soon as the plan is adopted.
- MPR-601, MPR-603, MPR-604 and MPR-605 (Stage 3) have no dependency. They may
  be built whenever the editor lane is free, FD-11 permitting.
- MPR-401 (Stage 4) needs only MPR-101.
- MPR-701 (Stage 3) needs MPR-101 and MPR-201, and three later cards wait for
  it (MPR-301, MPR-702, MPR-802), so it is worth building early in Stage 2.

Several cards are written in parts, and a first part often needs less than the
whole card. The first part of MPR-701 (the manifest itself) and the first part
of MPR-801 (the protocol text) need no other card. The first part of MPR-505
needs only MPR-504, and the first part of MPR-506 needs only MPR-502. The
parts are listed in
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md), section 6.

No card depends on a card of a later stage. The package check refuses a
registry in which a dependency is missing, circular or points forward to a
later stage.

## 8. Founder decisions by stage

| Stage | Decision | What it changes in the stage |
| --- | --- | --- |
| 0 | FD-1 | Whether any card starts at all (MPR-001) |
| 0 | FD-8 | Whether MPR-804 runs the full suite on Windows CI |
| 0 | FD-11 | The order of every later stage |
| 1 | FD-2 | Whether a take record holds the prompt text or only its hash (the generation ledger already holds the text) |
| 2 | FD-10 | Whether the second part of MPR-205 removes the account id from notebook metadata |
| 3 | FD-2 | What the export manifest may carry (MPR-701) |
| 3 | FD-3, FD-4 | What the first-run capability banner may say (MPR-604) |
| 4 | FD-3, FD-4, FD-5 | Which routes MPR-405 can measure; whether MPR-404 has a consumer |
| 5 | FD-3 | Whether a real remote route may be used in the baseline (MPR-801, MPR-802) |
| 5 | FD-6, FD-7 | Whether the competitor arm runs and whether the protocol is published |
| 6 | FD-4, FD-5, FD-9 | Whether MPR-220, MPR-221, MPR-211, MPR-222 and MPR-508 open |

A stage does not wait for a decision that only widens it. With every default
answer, Stages 0 to 3 can still complete in their narrower form, Stage 4 can
complete with MPR-405 measuring only the stand-in and already-configured
routes, Stage 5 ends with every comparison NOT TESTED, and Stage 6 stays shut.

## 9. What this roadmap does not contain

- No public release, installer, signing or update channel. The existing
  release decision stays NO-GO until its own qualification.
- No paid infrastructure and no production model activation. Models and
  providers stay off; a card that needs one is in Stage 6 behind a decision.
- No change to the frozen resource policy or qualification policy.
- No new scheduler, store, project format or permission authority.
- No claim of a result. Every hypothesis in
  [00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md) is
  NOT TESTED at this baseline.

Ideas that were considered and left out, with reasons, are in
[13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md).

## 10. How the roadmap changes

The registry is the source. A change of order, stage or dependency is made in
[TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json), rendered into
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md), and checked by
`tools/validate-addendum.mjs`. This document is then brought into line by
hand. After adoption, a change that moves a founder decision or opens a gate
needs a new entry in the founder decision record; a change that only reorders
cards inside a stage does not.
