# Yamakan Master Plan Revision, 2026-11

> Status: ADOPTED — the current frontier by founder instruction. Each card stays gated by its state and founder decisions.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This directory revises the Yamakan master plan. The founder adopted it as the
frontier on 2026-11-23 and, in a separate entry the same day ('Building the
master plan revision's cards'), authorised building its cards, each behind its
own gates (`docs/FOUNDER_DECISION_RECORD.md`); FD-2 to FD-11 are not decided. The earlier
programme (`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json`) keeps
its registry. The documents below describe the package as it was proposed on its
baseline; a card's current state is in its registry.

## 1. What the revision says, in one page

**Thesis.** Yamakan is the production system of record for AI filmmaking: every
shot stays a revisable, attributable object with a stated cost in time and
data, inside one local project that the creator owns — whichever model,
renderer or agent produced it. Until a paid route is authorised (FD-5), the
stated cost is estimated time, quota seconds and bytes leaving the PC. No money
figure is shown.

**What that means for the plan.** Yamakan does not try to win on model quality,
on the number of integrations or on hosted compute. It tries to be the place
where a production survives revision: where the request behind every take is
kept, a take can be regenerated from its own record, the cost and the route are
stated before anything runs, and the whole project can be opened, audited and
exported without the tool that made it. Five hypotheses carry this
([00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md)). All
five are marked NOT TESTED. Nothing in this package claims a result against any
other product.

**The shortest path.** Stage 1, "The Revisable Shot", is seven cards (MPR-101
to MPR-107). It needs no new model, no provider, no download and no hardware.
When it is done, one shot can be generated or rendered onto its place in the
story, revised from its own record, compared, replaced after an edit, and its
history read back. The stage
exits on a recorded observation: at least three working editors or creative
leads invited by the founder run that demonstration on the founder host. If
that is not arranged, the exit is recorded BLOCKED, never PASS.

**Size.** 56 task cards in seven stages and nine tracks. Eleven founder
decisions are requested. 14 cards have no unmet dependency, 33 wait for other
cards, 7 wait for a founder decision or an outside input, and 2 are deferred.

**Relation to earlier plans.** The revision extends the System Supremacy
programme and does not replace it. All 44 tasks of the Ultimate Master Plan
(draft pull requests #85 and #86), all 31 System Supremacy items and the seven
founder-directed streams that merged after 2026-11-05 are reconciled, one row
each, in [LEGACY_RECONCILIATION_ADDENDUM.json](LEGACY_RECONCILIATION_ADDENDUM.json).
No earlier evidence, ledger or receipt is edited.

## 2. Who should read what

**The founder.** This page, then
[FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md), then
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md),
[08_ROADMAP.md](08_ROADMAP.md) and
[13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md). The last one lists what
the plan rejects and where it is still weak.

**The implementation owner.**
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md) first. It gives
the order of work, the rules that span cards and the real run that proves each
card. Then the cards themselves in [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md),
with [05_TARGET_ARCHITECTURE.md](05_TARGET_ARCHITECTURE.md) and
[11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md)
beside them.

**A reviewer.** Any document below, each of which stands on its own, and
[SOURCES.md](SOURCES.md) for where each outside fact comes from.

## 3. Contents

| File | What it holds |
| --- | --- |
| [00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md) | Thesis, five hypotheses, the editability ladder, answers to the ten strategic questions. |
| [01_COMPETITIVE_CAPABILITY_MATRIX.md](01_COMPETITIVE_CAPABILITY_MATRIX.md) | What other products document or claim, with an evidence label on every cell. |
| [02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md) | What the code on `main` does today, read from the code. |
| [03_GAP_AND_DEPENDENCY_ANALYSIS.md](03_GAP_AND_DEPENDENCY_ANALYSIS.md) | The gaps between today's code and the thesis, and what each depends on. |
| [04_SOURCE_REUSE_DECISIONS.md](04_SOURCE_REUSE_DECISIONS.md) | Copy, adapt, wrap, build, defer or reject, with source and licence evidence. |
| [05_TARGET_ARCHITECTURE.md](05_TARGET_ARCHITECTURE.md) | The target shape, built on the existing store, jobs and permissions. |
| [06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md](06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md) | Five kinds of user, their journeys, and interface recommendations. |
| [07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md) | The model system, the routes that exist, and what each model family permits. |
| [08_ROADMAP.md](08_ROADMAP.md) | Stages, order, exits, lanes and the shortest path. |
| [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md) | All 56 cards in full. Rendered from the registry; do not edit by hand. |
| [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) | The benchmark method, the measures and the thresholds set before any run. |
| [11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md) | The gates every card passes through. |
| [12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md) | What the founder host can and cannot do, and what each route costs. |
| [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md) | The review from ten points of view, what was fixed, what was rejected, and the results of the checks. |
| [OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md) | What to build, in what order, and how to show that each feature works. |
| [FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md) | Eleven questions, each with facts, options, a recommendation and a default. |
| [SOURCES.md](SOURCES.md) | The outside sources used, by key family. |
| [TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json) | The cards as data. This is the source the task program is rendered from. |
| [LEGACY_RECONCILIATION_ADDENDUM.json](LEGACY_RECONCILIATION_ADDENDUM.json) | Every earlier plan item and stream, and where it went. |
| `evidence/research/` | Ten research notes. "Research note 05" in any document means the file there whose name starts with `05`. |
| `tools/` | Two scripts: one renders the task program, one checks the package. |

The brief asked for fifteen deliverables. Documents 00 to 08 are deliverables 1
to 9 in order. Deliverables 10 and 11, the tasks and their acceptance criteria,
are the cards in document 09. Deliverables 12, 13 and 14 are documents 10, 11
and 12. Deliverable 15 is the handoff.

## 4. The baseline, and how it was checked

- The package was drafted against `main` at `4a8e1b5` (the merge of pull
  request #277). `main` then moved to `7b1ca46` (the merge of pull request
  #278). The planning branch was fast-forwarded, the changed files were read
  again, and every baseline statement was moved to the new head.
- On 2026-11-22 the head of `main` on the remote was read again and was still
  `7b1ca46`. Pull request #279, of the Blender stream, was open and not merged.
  No card assumes it has merged.
- If `main` has moved when this is read, the cards still hold as written
  because step 0 of every card is to verify live `main` and reproduce the gap
  before building. A card whose gap has closed is recorded ALREADY_SATISFIED.

## 5. What was verified and what was not

Verified:

- Statements about the repository were read from the code, tests, documents
  and git history at the baseline, not from earlier plans.
- Every path a card names as a target exists at the baseline. Every path a
  card names as new does not. Every command a card names is either registered
  at the baseline or listed by a card as an interface it adds. The package
  check enforces this.
- Every dependency between cards points at a real card or a real earlier item,
  and no dependency runs backwards through the stages. The package check
  exempts parked cards (deferred or externally blocked) from that rule; no
  card needs the exemption.

Not verified:

- **No other product was used or tested.** Every statement about another
  product comes from its documentation, its own claims or third-party
  reports, and is labelled as such. No comparison has been run.
- **No card has been built.** The implementation instructions are a design
  read against the code. They have not been compiled or run. Where a card
  rests on a judgement, the card says so under risks.
- **The test suite was not run for this package.** The package adds no code.
  The checks that were run, and their results, are in
  [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md).
- **Prices, quotas and terms of outside services** were read on the dates
  given in the research notes. They change. A card that depends on one reads
  it again.
- **The research notes** quote line positions in the code as of the drafting
  head. Those positions may have shifted. The package documents themselves
  give paths without line positions.
- **The review in document 13** was done by five automated reviewers
  covering ten points of view, two each. It is not ten human reviews.
- **Professional user satisfaction and a comparative total cost** have no
  card. The usability study is a method only, and cost is reported for
  Yamakan alone
  ([10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md)).

## 6. How to check the package

From the repository root:

```
node docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/tools/validate-plan.mjs
node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/validate-addendum.mjs
node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/render-task-program.mjs --check
npm run provenance:check
npm run brand:check
```

The first is the existing check of the plan in force and must still pass
unchanged. The second checks this package: the registry, the reconciliation,
that the task program matches the registry, and that every path, command, id
and link in every document is real. The third compares the task program on
disk with a fresh rendering. These are structural checks. They do not judge
whether the plan is right.

To change a card, change it in the registry, run the renderer without
`--check`, and run the package check. The task program is never edited by
hand. MPR-003 wired these checks into the repository's own scripts
(`npm run plan:check`) and its workflow.

## 7. What this pull request does and does not do

It adds this directory and nothing else. It does not:

- change `specs/CURRENT.md`, the founder decision record, the implementation
  plan, the earlier registry, ledger 12 or any evidence file;
- close, edit or rebase pull requests #85, #86 or #279;
- authorise implementation, a release, spending, a download, a model or a
  provider;
- change the resource policy or the qualification policy.

Adoption is MPR-001, and MPR-001 waits for FD-1.
