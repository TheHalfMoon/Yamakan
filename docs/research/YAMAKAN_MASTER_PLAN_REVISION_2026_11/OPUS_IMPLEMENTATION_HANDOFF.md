# Implementation Handoff

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document is written for the implementation owner. It says what to build,
in what order, and how to establish that each feature really works. It does
not replace the cards. The card is the specification; this document is the
order of work and the rules that span cards.

- The cards: [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md), rendered from
  [TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json).
- The stages and their exits: [08_ROADMAP.md](08_ROADMAP.md).
- The decisions that open cards:
  [FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md).
- The target shape: [05_TARGET_ARCHITECTURE.md](05_TARGET_ARCHITECTURE.md).

If this document and a card disagree, the card wins and the disagreement is
reported in the pull request. If a card and live `main` disagree, live `main`
wins and step 0 of the card records what was found.

## 1. Roles and limits

- The planning reviewer wrote this package and built nothing. The
  implementation owner builds, tests and opens the pull requests. This
  package does not change who decides anything.
- Nothing here is authorised until MPR-001 records the founder's answer to
  FD-1. Until then the System Supremacy programme is the only task authority,
  and this handoff is a proposal to read, not an instruction to act on.
- Adoption authorises the order and the cards in their states. It opens no
  gate. A card that needs a founder decision still waits for that decision.
- Not authorised by any card: a public release, an installer, signing, paid
  infrastructure, a production model or provider switched on, a model
  download, a change of the frozen resource policy or qualification policy.
  Cards in Stage 6 describe how such a thing would be qualified after a
  decision; they do not grant it.
- Yamakan ships no language model. The Director cards build a planner and
  proposer over typed commands. No card adds a bundled chat model or calls
  one.

## 2. Before the first card

1. Finish the in-flight Blender pull requests. Pull request #279 was open and
   not merged when this baseline was re-verified on 2026-11-22. No card
   assumes it is merged. FD-11 asks the founder to confirm this order.
2. Wait for FD-1. If the answer is yes, MPR-001 is the first pull request: it
   records the adoption, points `specs/CURRENT.md` at the new frontier and
   settles draft pull requests #85 and #86. Their branches are kept as
   evidence; nothing in them is deleted.
3. Re-run both plan checks on the head you start from (section 10). If the
   package check fails on a path that has since appeared or moved, fix the
   registry in a documentation pull request first. Do not build against a
   registry that fails its own check.

## 3. Rules for every card

The common contract is printed at the top of
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md) and is part of every card. In
working terms:

1. **Step 0 is not optional.** Check out live `main`, reproduce the gap the
   card describes, and write down what you saw. If the gap is already closed,
   record ALREADY_SATISFIED with the evidence for that part and build only
   what remains. The baseline text of a card was true at the baseline commit
   and may be stale by the time you read it.
2. **One authority.** No new store, scheduler, project format or permission
   authority. Stored formats move only by an additive version step that still
   reads every older version. Original media, old receipts and each writer's
   history are preserved.
3. **The command surface keeps its rules.** Existing scopes and the human-only
   rule stay. Every command input is strict, bounded and free of file-system
   paths. Every mutation keeps a receipt or refuses a request id.
   `tests/parity.test.ts` and `tests/request-id-refusal.test.ts` hold for REST
   and MCP after every card.
4. **Nothing is imported without closure.** `npm run provenance:check` and
   `npm run brand:check` pass. A new file under a donor root is declared in
   `docs/provenance/import-policy.json` in the same pull request.
5. **The standing checks pass.** `npm run typecheck`, `npm run lint`,
   `npm run format:check` and `npm test`; `npm run test:studio` when Studio
   code is touched; `npm run test:e2e` when browser interface code is touched.
6. **Real qualification leaves evidence.** Under `docs/evidence/`, with the
   head commit and the host. A missing tool or a skipped step is recorded
   BLOCKED. It is never recorded PASS, and a failed scan is never rewritten
   as a pass.
7. **Models and providers stay off.** No spend and no download unless the
   card's gate and a recorded founder decision allow it.
8. **Review and merge.** Each pull request gets a fresh independent review,
   CI on its exact head and a normal merge. No force-push. No merge of a pull
   request whose checks did not run.

A card is one pull request unless the card says it has parts (section 6).
Do not combine two cards in one pull request, and do not add work to a card
because it is nearby. Work that is found and is not in a card is reported, not
built.

## 4. Order of work

The order below satisfies every dependency in the registry, keeps one schema
step in review at a time, and puts the shortest path to a usable product
first. Items on one line may be built side by side.

### Stage 0 — Truth and frontier

| Order | Card | Notes |
| --- | --- | --- |
| 1 | MPR-001 | After FD-1. Documentation and record only. |
| 2 | MPR-002, MPR-010 | Independent of each other. |
| 3 | MPR-003 | Adds the npm script `plan:check`, the CI step and the two completion states. |
| 4 | MPR-804 | After FD-8. If FD-8 is not answered, record the card blocked and go on. |

### Stage 1 — The Revisable Shot

| Order | Card | Notes |
| --- | --- | --- |
| 1 | MPR-101 | Built with the prompt switch off; FD-2 only decides whether it is turned on. Ships story format version 2, including the fields MPR-106 uses. |
| 2 | MPR-102 | Extends the qualifier MPR-101 added. |
| 3 | MPR-103, MPR-106, MPR-107 | Any order. All three touch files MPR-101 and MPR-102 changed; rebase between them. |
| 4 | MPR-104 | The browser entry points. |
| any | MPR-105 | Depends only on the verified SS-006. Take-proposal format version 2; version 1 proposals stay readable. |

Stage 1 ends with the six-step demonstration in section 5 of
[08_ROADMAP.md](08_ROADMAP.md), run on the founder host with the stand-in
route. Two things close the stage. The measure: in that demonstration nothing
outside the revised shot changes (M6p in
[10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) is zero). The
observation: at least three working editors or creative leads invited by the
founder run the demonstration on the founder host and their remarks are
recorded. If the founder has not arranged that, record the exit BLOCKED, never
PASS, and go on with Stage 2.

### Stage 2 — Governed execution

| Order | Card | Notes |
| --- | --- | --- |
| 1 | MPR-201, MPR-207, MPR-501 | No dependency; no schema step. |
| 1 | MPR-204 | Schema step. Two pull requests; the first alone changes no behaviour. |
| 1 | MPR-507 | The measurement is its own pull request and comes first. A later part carries a schema step. |
| 1 | MPR-303 | Schema step if the token-mode column needs one. |
| 2 | MPR-202, MPR-206, MPR-208 | After MPR-201. |
| 2 | MPR-205 | After MPR-204 and MPR-207. Part b only after FD-10. |
| 2 | MPR-502, MPR-503, MPR-504 | After MPR-501. MPR-504 carries a schema step. |
| 3 | MPR-203 | After MPR-201, MPR-202, MPR-204, MPR-205, MPR-207. |
| 3 | MPR-209, MPR-305 | MPR-209 part a waits for nothing and is the first pull request of Stage 2; part b after MPR-208. MPR-305 after MPR-202. |
| 3 | MPR-505 | Part a (tables and commands; the schema step) after MPR-504. Part b after MPR-203, MPR-204 and MPR-507. |
| 3 | MPR-506 | Part a (the schema step) after MPR-502 and after the step of MPR-505; part b after MPR-101. |
| 4 | MPR-210 | Last. A loopback fake only; no real service is contacted. |

### Stage 3 — Editor depth and interchange

| Order | Card | Notes |
| --- | --- | --- |
| 1 | MPR-601, MPR-603, MPR-604, MPR-605 | No dependency. May be built earlier, FD-11 permitting. |
| 1 | MPR-701 | After MPR-101 and MPR-201. Three later cards wait for it. |
| 2 | MPR-602 | After MPR-601. |
| 2 | MPR-702 | After MPR-303 and MPR-701. SS-015 stays open in the earlier programme and is not a dependency. |
| 2 | MPR-301 | After MPR-106, MPR-303, MPR-305 and MPR-701. |
| 3 | MPR-302, MPR-304 | After MPR-301. |
| 4 | MPR-606 | Last in the stage: it freezes interface strings, so every card that adds strings lands first. |

### Stage 4 — Consistency and control

| Order | Card | Notes |
| --- | --- | --- |
| 1 | MPR-401 | Reference pack schema version 2; version 1 packs stay readable. |
| 1 | MPR-403 | Edits the story document; see section 5.2. |
| 2 | MPR-402 | After MPR-103, MPR-203 and MPR-401. Edits the story document; see section 5.2. |
| 3 | MPR-405 | Measures; claims nothing about any route it did not run. |
| — | MPR-404 | Deferred. Do not build until a qualified route accepts a control input; it then also needs MPR-203, MPR-204 and MPR-507. |

### Stage 5 — Qualification and benchmark

| Order | Card | Notes |
| --- | --- | --- |
| 1 | MPR-801 | Write as soon as Stage 1 ends. Runs nothing. |
| 2 | MPR-802 | The founder names the operator and the rubric reviewer before the run. |
| 3 | MPR-805 | After MPR-802 and the agent cards of Stage 2. Twenty runs; all must pass. |
| — | MPR-803 | Only after FD-6 and a terms check. Until then every comparison stays NOT TESTED. |

### Stage 6 — Gated expansions

Each card opens on its own decision and has no place in the order until then:
MPR-508 on FD-9; MPR-220 and MPR-221 on FD-4; MPR-211, then MPR-222, on FD-5.

## 5. Rules that span cards

### 5.1 Workspace schema steps

`WORKSPACE_SCHEMA_VERSION` is 18 at the baseline. A database newer than the
build is refused, so two pull requests that each add "the next version" cannot
both be right.

- Six cards add a step: MPR-204, MPR-507, MPR-303, MPR-504, MPR-505, MPR-506. MPR-303 adds one only
  if its new token column needs a version step. Build and merge them in that order unless a
  dependency forces otherwise. MPR-222 adds one more, for a money cap, in Stage 6. This list is the
  authority for the order; documents 03, 05 and 08 repeat it and point here.
- Only one schema pull request is in review at a time. The next one is
  rebased after the previous one merges and takes the next free number then.
- No card owns a number. Where a card's text names one, read it as "the next
  free version at merge".
- Each step is additive, is tested against a workspace written by every older
  version, and leaves old receipts readable.
- These cards add no schema step and must not grow one: MPR-101, MPR-107,
  MPR-201, MPR-206, MPR-207, MPR-208, MPR-502. If one seems to need a table,
  stop and report it; the design in the card was chosen to avoid that.
- A restored workspace is a new copy with a raised epoch. Gate approvals
  (MPR-204) and pending approval requests (MPR-504) in it are void, and the
  reservation of a void request stops counting (MPR-505). Spent budget rows
  and audit rows are those of the backup (MPR-505, MPR-506).

### 5.2 Document formats

- The story document moves to format version 2 in MPR-101. That step adds the
  record hash on takes and also carries the brief, scene script and shot
  intent fields that MPR-106 fills. One version has one meaning: if MPR-101
  merged without those fields, MPR-106 takes version 3 and says so.
- MPR-402 and MPR-403 also edit `core/story.ts`. Each moves the format by its
  own additive step and keeps reading every earlier version. Merge them one
  at a time.
- The reference pack moves to schema version 2 in MPR-401.
- The map of readable versions per document kind is introduced by MPR-101.
  Later cards extend that map; they do not add a second one.
- New document kinds: the take record (MPR-101), the take replacement note
  (MPR-107), the edit proposal (MPR-303) and the study record of MPR-405. All
  live inside the existing limits: 32 documents per project, 8 MiB per
  document, and 256 KiB for the story document. A card that would pass a
  limit stops and reports it; it does not raise the limit.

### 5.3 Files many cards edit

Counted from the cards' own lists of existing files:

| File | Cards | What to do |
| --- | --- | --- |
| `package.json` | 39 | Script entries only; one line per card; rebase, never resolve by replacing the block. |
| `core/command/registry.ts` | 38 | Add each card's commands in one contiguous block; re-read the file at step 0. |
| `src/i18n.ts` | 29 | Every new string in English and Arabic in the same pull request. |
| `tests/parity.test.ts` | 25 | Take the live command count as the starting number, not the number printed in a card. |
| `src/main.tsx` | 18 | Smallest possible touch; new screens live in their own files. |
| `core/engines/generation.ts` | 13 | Order of cards in section 4 is the merge order for this file. |
| `docs/SECURITY.md` | 13 | Append the card's section; see section 5.5. |
| `core/store.ts` | 11 | Schema rule of section 5.1. |
| `core/jobs.ts` | 11 | No new job authority; see section 5.4. |
| `core/story.ts` | 8 | Format rule of section 5.2. |

The command count is 116 at the baseline and the MCP tool count is 117. Both
move as cards land. A card's test asserts the count it finds plus what it
adds.

The lanes of section 6 of [08_ROADMAP.md](08_ROADMAP.md) are reviewed in
parallel and merged through one queue: a pull request that edits a file in
this table is rebased on the latest merge before its final review. Deriving
the two counts in `tests/parity.test.ts` from the registry was considered and
rejected; the reason is in
[13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md).

### 5.4 Files in motion

The Blender stream is still editing `core/command/registry.ts`,
`src/main.tsx`, `core/jobs.ts`, `core/blender/runtime.ts`,
`core/blender/scene.ts`, `src/cinema/BlenderRender.tsx` and the Director
files under `core/director/`. A card that touches one of them:

- starts only after the in-flight pull request for that file has merged, or
  is rebased on it before review;
- re-reads the file at step 0 and corrects its own plan where the file moved;
- does not reformat, reorder or rename anything it was not asked to change.

`core/jobs.ts` holds the one job supervisor. MPR-507 queues Blender jobs
inside it, and MPR-604 and MPR-405 each add one job kind to it (the sample
build and `consistency-measure`). None adds a second queue,
timer loop or worker owner. If the only way to finish a card seems to be a
second scheduler, stop and report it.

### 5.5 Record files

Some cards append to documents that are records, not ordinary prose:
`docs/SECURITY.md`, `docs/OPERATIONAL_CONTRACTS.md`,
`docs/FOUNDER_DECISION_RECORD.md`, `docs/AGENT_DECISION_RECORD.md`,
`docs/provenance/import-policy.json` and `docs/provenance/imports.json`.

- Append; do not rewrite history in them.
- The founder decision record holds only what the founder decided, in the
  founder's words, with a date. The implementation owner records a decision
  there; it does not write one.
- Where an existing check guards one of these files, the card satisfies the
  check. If the check refuses the change, stop and report the refusal. Do not
  edit the check to pass.
- The frozen plan files, the freeze tag and the earlier programme's own
  folder are not edited by any card except where MPR-001 or MPR-003 says so
  by name.

### 5.6 Donor roots and provenance

Fourteen directories are donor roots. A new file under one of them is
declared in `docs/provenance/import-policy.json` under the list of local
files, in the same pull request, or `npm run provenance:check` fails. Eleven
cards do this. No card copies outside code. Where a card's source decision
says ADAPT or WRAP, the source and its licence are named on the card and in
[04_SOURCE_REUSE_DECISIONS.md](04_SOURCE_REUSE_DECISIONS.md); anything not
named there is not cleared.

### 5.7 Interface strings

Every card with a browser surface adds its strings in both languages and
keeps `tests/i18n.test.ts` passing. Arabic strings added by a card are
unreviewed until the human review of X-01. MPR-606 prepares that review and
does not sign it. No card describes Arabic text as reviewed.

## 6. Cards with parts

More than half of the cards write their implementation sequence in parts
(a, b, and in one card c). A part is a reviewable unit. Whether the parts go
up as one pull request or several is stated on the card; where the card
allows a split, split when one pull request would be too large to review.
Every part is merged under the card's id, and the card is complete only when
its last part is verified.

Some parts can start before the whole card can, or are safe to merge alone.
These are the cases that change the order of work:

| Card | What the card says about its parts |
| --- | --- |
| MPR-101 | Part a alone delivers the generation record. |
| MPR-104 | Part a is useful alone. |
| MPR-106 | Two pull requests when one is too large; part a alone already stores Create's text in the story. |
| MPR-107 | Two pull requests; part a alone answers with no replacements and names the gap. |
| MPR-203 | Two pull requests under one id. |
| MPR-204 | Two pull requests; part a alone changes no behaviour. |
| MPR-205 | Part b only after FD-10 is decided. |
| MPR-209 | Part a has no dependency and is the first pull request of Stage 2; part b follows MPR-208. |
| MPR-221 | Part a is captions; part b is the voice. |
| MPR-504 | Part a (store and commands) is safe to merge alone; part b is the inbox and the qualification. |
| MPR-505 | Part a needs MPR-504 only; part b needs MPR-203, MPR-204 and MPR-507. |
| MPR-506 | Part a, the feed, needs MPR-502 only; part b, the trace, needs MPR-101. |
| MPR-507 | Part a, the measurement, is its own pull request and comes first; part b, the queue, starts after part a has landed or been reported and answered; part c is rerun. |
| MPR-508 | Two pull requests: the helper with its licence and provenance closure, then the gate, the status command, the panel and the interactive qualification. |
| MPR-604 | Part a is the service; part b is the browser. |
| MPR-606 | Two pull requests; part a alone gives the reviewer the full list. |
| MPR-701 | Part a needs no other card; part b follows MPR-101 and MPR-201. |
| MPR-702 | Part a, export, needs MPR-701 only; part b, import, needs MPR-303. |
| MPR-801 | Part a needs no other card; part b needs MPR-107. |
| MPR-802 | Two pull requests: part a ends with the freeze commit; part b is the counted run and its evidence. |
| MPR-803 | Two pull requests: part a spends nothing; part b is the arm itself. |

A part that lands early does not make the card complete, and a card's state
does not change until its last part is verified. The exact content of each
part is on the card. Where this table and a card differ, the card is right.

## 7. How each feature is shown to work

Every card has four sections that together are its proof: Test plan, Negative
tests, Real end-to-end qualification, and Definition of Done. A card is not
complete on unit tests alone. The table names the real run for each card. The
steps, the evidence file and the limits are on the card.

| Card | The real run that proves it |
| --- | --- |
| MPR-001 | Post-merge link check on `main`; `gh pr view 85` and `gh pr view 86` outputs quoted. |
| MPR-002 | A cold read on `main` by a reviewer who did not write the index. |
| MPR-003 | The exact-head `qualify` run and the first run on `main` both show the plan check step. |
| MPR-010 | `npm run qualify:consent-gate` in a real browser on the Windows host. |
| MPR-101 | `npm run qualify:revisable-shot`: real store, job supervisor and command executor; stand-in engine. |
| MPR-102 | The same qualifier, extended with a targeted generation that lands on its shot. |
| MPR-103 | The same qualifier, extended with a revision arm. |
| MPR-104 | `npm run qualify:revise-shot-screens`: built app, real service, real browser, stand-in route. |
| MPR-105 | `scripts/qualify-take-review.mjs` extended with a split arm; SS-006's receipt unchanged. |
| MPR-106 | `npm run qualify:story-brief`: real browser; the text survives a restart. |
| MPR-107 | `npm run qualify:revisable-shot`, ledger arm: attempts, a failure and a replacement on one shot. |
| MPR-201 | `npm run qualify:model-catalog`: no network, no route; zero disagreements. |
| MPR-202 | `npm run qualify:capability-report`: the built service in three route configurations. |
| MPR-203 | `npm run qualify:generation-preflight` with the stand-in route; a real-route step only if FD-3 allows, else BLOCKED. |
| MPR-204 | `npm run qualify:gates`: nothing reaches the stand-in route without a recorded approval. |
| MPR-205 | `npm run qualify:kaggle-screens`, three added scenes against the stand-in command line. |
| MPR-206 | `npm run qualify:engine-conformance`. |
| MPR-207 | `npm run qualify:kaggle-screens`, failure scenes with the typed class shown. |
| MPR-208 | `npm run qualify:licence-gate`: REST and MCP answers and the gate over the whole catalog. |
| MPR-209 | `npm run qualify:compliance-surfaces` in a real browser. |
| MPR-210 | `npm run qualify:provider-contract`: a full job through the loopback fake with a kill and resume. |
| MPR-211 | `npm run qualify:credential-vault` on the founder host, after FD-5. |
| MPR-220 | `npm run qualify:local-image`, after FD-4, with the network state recorded. |
| MPR-221 | `npm run qualify:local-captions`, after FD-4. |
| MPR-222 | `npm run qualify:hosted-provider`; it refuses to run without the FD-5 record, the reviews and a capped approval. |
| MPR-301 | `npm run qualify:production-pipeline`: real service, real media made with the owned FFmpeg. |
| MPR-302 | `npm run qualify:production-plan`: real browser, plan controls by keyboard only. |
| MPR-303 | `npm run qualify:edit-proposals`: a propose-only token; a person applies in the browser. |
| MPR-304 | `npm run qualify:mcp-contracts`: two tokens; instruction-like story text stays data. |
| MPR-305 | `npm run qualify:router-explain` over REST and the real MCP server. |
| MPR-401 | `npm run qualify:create`, extended: entity, approved anchor, variants. |
| MPR-402 | `npm run qualify:create`, extended: the per-shot delivery report. |
| MPR-403 | `npm run qualify:director-cinema`: real service, real browser, the pinned Blender. |
| MPR-404 | `npm run qualify:blender-slice` with a depth pass. Deferred. |
| MPR-405 | `npm run qualify:consistency-study`: models off, synthetic clips, the blind study end to end. |
| MPR-501 | `npm run qualify:agent-mcp`: a read-only and a wider token against the real MCP server. |
| MPR-502 | The same qualifier, extended: wait on a real job; read events by cursor. |
| MPR-503 | The same qualifier, extended: import helper against a folder with a link pointing outside. |
| MPR-504 | `npm run qualify:approvals`: an agent asks, a person approves in the browser. |
| MPR-505 | The same qualifier, extended: the third request is refused by the budget. |
| MPR-506 | `npm run qualify:agent-mcp`, extended: two agents; each sees only its own rows. |
| MPR-507 | `npm run qualify:blender-slice` with the real pinned Blender on the founder host; peaks recorded. |
| MPR-508 | `npm run qualify:q15` with a person present, after FD-9. |
| MPR-601 | `npm run qualify:structural-edits` in a real browser, at two frame rates. |
| MPR-602 | `npm run qualify:clip-inspector`. |
| MPR-603 | `npm run qualify:export-panel`, by keyboard. |
| MPR-604 | `npm run qualify:first-run` on a fresh workspace. |
| MPR-605 | `npm run qualify:continuity`: one project through all four parts and back. |
| MPR-606 | `npm run qualify:i18n-surfaces` with the interface in Arabic. Unsigned. |
| MPR-701 | `npm run qualify:export-manifest`: a single export and a two-variant batch. |
| MPR-702 | `npm run qualify:otio-lineage`. |
| MPR-801 | `npm run benchmark:workflow` on a synthetic file. Nothing is measured. |
| MPR-802 | `npm run qualify:workflow-baseline` on the founder host, idle, on mains power. |
| MPR-803 | `npm run qualify:rating-bundle` before any spend; the arm itself only after FD-6. |
| MPR-804 | The hosted Windows runs on the exact head, repeated three times. |
| MPR-805 | `npm run benchmark:agent` from a clean checkout: real service, real MCP server, real browser. |

Several qualifier scripts are shared, which fixes an order inside each group.
Three are new: the revisable-shot qualifier is added by MPR-101 and extended
by MPR-102, MPR-103 and MPR-107; the agent qualifier is added by MPR-501 and
extended by MPR-502, MPR-503 and MPR-506; the approvals qualifier is added by
MPR-504 and extended by MPR-505. Four exist on main and gain arms: the create
qualifier (MPR-401, then MPR-402), the Kaggle screens qualifier (MPR-205 and
MPR-207), the Blender slice qualifier (MPR-404 and MPR-507) and the take
review qualifier (MPR-105). An extension never weakens an earlier arm of the
script, and never rewrites a receipt an earlier card left.

What a qualification run must record, for every card: the head commit, the
host, the tool versions the card names, the wall-clock time where the card
has a limit, and the outcome of every step. A step that could not run is
written BLOCKED with the reason.

## 8. Completion

- A card is complete when every item of its Definition of Done is met, its
  evidence is committed, and an independent review has passed on the exact
  head that merged.
- Evidence is quoted in the pull request and entered in the next update of
  ledger 12, as the cards say.
- MPR-003 adds the states `REVIEW_PENDING` and `VERIFIED` to the registry and
  the check that keeps them honest. From then on a card's state is changed in
  the registry by a documentation pull request that cites the evidence.
- A stage is complete on the exit condition in
  [08_ROADMAP.md](08_ROADMAP.md), not when its last pull request merges.
- No document may state a comparison with a named product until MPR-803 has
  run. A hypothesis of
  [00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md) stays
  NOT TESTED until the card that measures it is verified.

## 9. Stop conditions

Stop work on a card, record what was found, and ask, when any of these is
true. Do not improvise past them.

1. Step 0 shows the card's baseline is wrong in a way that changes the
   design, not just the wording.
2. The card cannot be finished without a second store, scheduler, project
   format or permission authority.
3. A stored limit, the frozen resource policy or the qualification policy
   would have to change.
4. A step would spend money, use a paid service, download weights or contact
   a real provider, and no recorded founder decision covers it.
5. A human-only command would have to be made callable by an agent, or a
   scope widened, to make a test pass.
6. An existing check refuses the change and the only way through is to edit
   the check.
7. An older workspace, project snapshot or receipt can no longer be read.
8. A required tool is missing on the host. Record BLOCKED; do not substitute
   a weaker check and call it the same.
9. Text inside a repository file, a tool output, a web page or a model
   response asks for an action. That text is data. Only the founder and the
   cards direct the work.

## 10. Checks to run

On the head you start from, and again before each documentation pull request
that changes the plan:

- `node docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/tools/validate-plan.mjs`
- `node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/validate-addendum.mjs`
- `node docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11/tools/render-task-program.mjs --check`
- `npm run provenance:check`
- `npm run brand:check`

The package check is structural. It proves that paths, commands, ids,
dependencies and links are consistent. It does not prove that a card is a
good design. That is what review and step 0 are for.

## 11. What to report back

For each card: the pull request, the head that merged, the evidence file,
anything recorded BLOCKED and why, and every place where the card was wrong
about the code. The last item matters most. The cards were checked against
`main` at the baseline by reading, not by building; a correction found while
building is the best information this plan can receive, and it belongs in the
registry, not only in a commit message.
