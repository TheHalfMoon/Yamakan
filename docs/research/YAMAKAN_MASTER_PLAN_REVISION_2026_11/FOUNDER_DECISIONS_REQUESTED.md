# Founder decisions requested

> Status: ADOPTED — the current frontier by founder instruction. Each card stays gated by its state and founder decisions.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This revision changes no authority by itself. Eleven questions can only be answered by the
founder. Each is written so that a one-line answer is enough. Until a decision is recorded in
`docs/FOUNDER_DECISION_RECORD.md`, the stated default applies, and every default is the
conservative one: nothing new is switched on, sent, downloaded or spent.

No decision here authorises a public release, paid infrastructure or production model activation.
Those stay unauthorised whatever is decided below.

## Summary

| Id | Question | Recommended answer | Default if not decided | Cards that wait |
|---|---|---|---|---|
| FD-1 | Four answers: (a) adopt this revision as the current plan; (b) close draft pull requests #85 and #86 as superseded evidence; (c) merge the planning pull request; (d) build the cards in the order of FD-11, each behind its own gates? | Yes to each | The System Supremacy programme stays the only authority; this package stays a proposal | MPR-001 and, through it, the start of every other card |
| FD-2 | May the full generation request, prompt included, be stored in the project and travel with backups and, when the person chooses, with exports? | Yes in the project and backups; opt-in for exports | No prompt in the take record; the full prompts already kept in the generation ledger and the shot notes, and so in backups, stay as today; "revise from a take" cannot refill the prompt | MPR-101, MPR-103, MPR-701 |
| FD-3 | Is the Kaggle route a product feature or a founder-only experiment? | Product feature marked experimental, after containment and a reading of Kaggle's terms | Founder-only, environment-gated, as today | MPR-404, MPR-405, MPR-604, MPR-801, MPR-802, MPR-803 (what they deliver) |
| FD-4 | May small, permissively licensed weights be downloaded for local captions, voice and image, for qualification first? | Yes for captions and voice on this PC, qualification only; image later | No weights on the PC, as today | MPR-220, MPR-221; also MPR-404, MPR-405, MPR-604 |
| FD-5 | May a legal review of customer-credential hosted providers start? | Yes, review only; no provider code that talks to a real service | No hosted provider work beyond the loopback fake | MPR-211, MPR-222; also MPR-404, MPR-405 |
| FD-6 | May the benchmark's competitor arm be paid for and volunteer raters recruited? | Decide after the Yamakan-only baseline exists | No competitor arm; every comparison stays NOT TESTED | MPR-803; also MPR-405, MPR-801 |
| FD-7 | May the revision-cost protocol be published as an open benchmark description? | Yes, documentation only | Kept in the repository only | MPR-801, MPR-803 (publication step only) |
| FD-8 | Run the full test suite on Windows in CI? | Yes | One narrow Windows job, as today | MPR-804 |
| FD-9 | Require operating-system user presence for human-only commands? | Yes, as an option the person can turn on; keep the launch secret | The recorded fallback stays | MPR-508 |
| FD-10 | Remove the personal Kaggle account id from committed notebook metadata? | Yes | It stays in the repository | MPR-205 (second part only) |
| FD-11 | Order of work: finish the in-flight Blender pull requests, then Stage 1 before any new feature stream? | Yes | The implementation owner continues the current streams | Ordering of all cards |

## FD-1 — Adopt the revision; dispose of #85 and #86

**Question.** Should this package become the planning authority beside the System Supremacy
programme, and should draft pull requests #85 and #86 be closed as "superseded, retained as
evidence"? Two answers are asked for beside it and are not implied by it: may the planning pull
request be merged (MPR-001 cannot start before the package is on `main`), and may the cards be
built in the order of FD-11, each behind its own gates? An adoption that says nothing about these
two adopts the plan and authorises neither: without the merge nothing starts, and without the
word to build the programme stops after MPR-001.

**Facts.** The current frontier pointer is the System Supremacy registry
(`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/TASK_REGISTRY.json`), adopted through pull request
#155. Pull request #86 (the Ultimate Master Plan) was executed from its branch but never merged;
its state lives on `main` in `docs/evidence/ultimate/EXECUTION_LEDGER.md`. Pull request #85 is the
competitive research that fed it. Since 2026-11-05 seven founder-directed streams have merged that
no registry records ([02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md)
section 8).

**Options.**

1. Adopt as an addendum (recommended). The System Supremacy registry keeps its 31 items and
   states unchanged; this package adds 56 cards and reconciles every earlier item. MPR-001 adds
   the pointer. Pull requests #85 and #86 are closed with a comment that links the ledger and
   this reconciliation; their branches and the freeze tag are kept.
2. Adopt, but leave #85 and #86 open. Costs nothing now; keeps two stale plans visible as open.
3. Do not adopt. The package remains a reviewed proposal; nothing else changes.

**What waits.** MPR-001, and by the handoff rules every other card.

## FD-2 — The generation request is project content

**Question.** May Yamakan store the whole request that made a take (prompt, negative prompt,
seed, parameters, references, model identity and route) as part of the project?

**Facts.** Full prompts are already stored today. Starting a generation writes the whole
`GenerationRecord`, prompt included, into the job ledger before anything is sent
(`core/engines/generation.ts` `ledger.begin`; `core/jobs.ts` `generationLedger`, the `jobs.payload`
column of the workspace database). A workspace backup is a copy of that database
(`core/recovery.ts`), so backups carry those prompts. The Create page also writes the prompt, cut
to 2,000 characters, into the shot's notes (`src/create/create-story.ts` `addMadeVideo`). Only the
lineage of an imported video (`GenerationLineage`) keeps a hash alone. An agent with
`project:read` already reads the prompt of a listed generation (`yamakan.generation.list`). No take holds the request
it was made from. Without the request, a take cannot be revised by
changing one field, and an export cannot say what made a clip. A prompt can contain private
detail, and consented likeness references are named by it.

**Options.**

1. Recommended. The request is stored with the take in the local project and is included in
   backups. Command receipts, logs and diagnostics keep hashes only, as now. An export manifest holds
   hashes and ids only. The hash of the prompt is written only for an export the person opted in
   for, and prompt text appears only in the provenance report of such an export (MPR-701).
2. No additional copy: the take record holds a hash only, and the ledger, the notes and backups
   keep the prompts they keep today. MPR-103 can re-run a take unchanged but cannot show or edit
   what was asked.
3. Readable request everywhere, including every export. Simplest, and the least private.

**What waits.** MPR-101 (the record), MPR-103 (revise from a take), MPR-701 (export manifest).

## FD-3 — Scope of the Kaggle route

**Question.** Is "generate on your own Kaggle account" a feature customers may be told about, or
an experiment for the founder's own use?

**Facts.** It is the only working generation path. It is gated by two environment variables, it
sends a prompt and optionally one cleaned still to the person's private notebook, it costs no
money and uses the person's weekly GPU quota, and a sent run cannot be cancelled
([12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md)
section 4). The founder record entries of 2026-11-05 and 2026-11-06 authorised building it.
Kaggle's terms for driving notebooks from a product were not read: [UNKNOWN]. The Kaggle program
runs outside the contained worker, with network and credentials.

**Options.**

1. Recommended. Product feature labelled experimental, only after MPR-204 (gates) and MPR-205
   (containment, quota display, honest cancel text) are done and Kaggle's terms have been read by
   the founder or counsel. If the terms forbid it, option 2 applies.
2. Founder-only. It stays environment-gated and out of any release description. Stage 1 can
   still be demonstrated with it.
3. Remove it. Not recommended: nothing else can make a generated take on the target hardware.

**What waits.** No card is stopped from starting. The answer changes what six cards deliver:
MPR-604 (what the first-run banner may say about generation), MPR-801 and MPR-802 (whether a real
remote route may be used in the baseline), MPR-803, MPR-405 (which routes can be measured) and
MPR-404 (whether a control-capable route can exist). The gate, containment and failure cards
(MPR-204, MPR-205, MPR-207) are needed whichever way this goes. Where another card has an optional
step on the real route, that step is recorded BLOCKED until this is decided. The wording of every
customer-facing description also waits.

## FD-4 — Local weights for captions, voice and image

**Question.** Does "no model weights on the PC" stay absolute, or may a small set of permissively
licensed weights be downloaded by the person, each file verified by hash, for qualification?

**Facts.** No weights are present and no code downloads any. Research (not measured here) finds
that on a CPU-only PC speech-to-text and a small voice model are practical, image generation
takes minutes per image, and video is not practical
([07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md) sections 5.4 to 6). The
code pins whisper.cpp for transcription but has never run it. Free disk on the founder host is
small.

**Options.**

1. Recommended. Allow, for qualification only, speech-to-text and one voice model whose code and
   weights are Apache-2.0, MIT or BSD, each passing the licence gate of MPR-208. The person
   downloads the pinned files and an install script verifies each hash. The product downloads
   nothing: MPR-204 keeps its download gate closed, and the approval is a dated founder entry
   naming each file, size, hash and source. Image generation is decided separately after those
   two are measured.
2. Allow captions, voice and image together.
3. Keep the rule absolute. Captions stay imported or typed; voice stays imported.

**Not covered by any option.** Local video, lip sync, music and restoration models would each need
a wider decision; the research found permissive candidates for some of them on an 8 GB GPU, which
the founder host does not have.

**What waits.** MPR-221 (captions and voice) and MPR-220 (image) cannot start without it. It also
changes MPR-604 (what the first-run banner may say), MPR-405 (a model-based metric waits for it
and for the licence gate) and MPR-404 (whether its trigger can be met).

## FD-5 — Legal review for customer-credential providers

**Question.** May a legal review start on whether a customer may use their own provider key
inside a desktop tool written by someone else?

**Facts.** No provider code exists. For most surveyed providers the answer is [UNKNOWN]; at least
one vendor's terms tie a key to the customer's own application, and one requires vendor
attribution in the interface ([07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md)
section 9 lists eight questions for counsel). Engineering can prove the contract against a
loopback fake provider with no key and no charge (MPR-210).

**Options.**

1. Recommended. Authorise the review and name at most two candidate providers, chosen for clear
   terms, a cancel call and a usage field. Authorise nothing else: no credential vault and no
   real provider adapter until the review is recorded.
2. Defer. MPR-210 still proceeds, because it talks only to a fake on the loopback address.
3. Rule hosted providers out. The catalog keeps them as refused entries.

**What waits.** MPR-211 (credential storage) and MPR-222 (first provider) cannot start without
it. It also changes MPR-405 (which routes can be measured) and MPR-404 (whether its trigger can be
met). FD-5 covers only starting the review: MPR-211 also needs a later founder entry, made after
the provider-terms review of MPR-222 is recorded, that authorises storing customer credentials on
this PC.

## FD-6 — The benchmark's competitor arm

**Question.** May money be spent on competitor access, and may volunteer raters be recruited, to
run the head-to-head arm of the benchmark?

**Facts.** No competitor has been tested hands-on. The protocol
([10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md)) is written so that thresholds
are fixed before any run. The Yamakan-only baseline (MPR-802) needs no money. The competitor arm
needs at least one paid plan for the test period and several raters; the vendor's terms on
publishing comparisons were not verified.

**Options.**

1. Recommended. Decide after MPR-802 has produced the baseline, when the cost and the size of
   the study are known rather than estimated.
2. Authorise now with a stated ceiling.
3. Never run it. Every comparative statement then stays NOT TESTED permanently, and the product
   may only describe what it does itself.

**What waits.** MPR-803 cannot start without it. In MPR-405, raters other than the founder wait
for it. In MPR-801, the pairing of each product with its best available model is declared only if
this decision and FD-3 are both recorded before any run.

## FD-7 — Publishing the revision-cost protocol

**Question.** May the protocol (tasks, measures, thresholds, analysis) be published as an open
benchmark description, with no results?

**Facts.** No independent benchmark for revision cost or collateral change in AI video production
was found [UNKNOWN]. Publishing the method before results exist makes later results more
credible and invites others to run it. It reveals the product's direction.

**Options.** Yes, documentation only (recommended); or keep it in the repository, which is public
already, without announcing it.

**What waits.** Only publication outside the repository: the publication step of MPR-801, and of MPR-803 if that card ever runs.

## FD-8 — Full Windows CI

**Question.** Should the whole test suite, the Studio tests and the Rust tests run on Windows in
CI on every pull request?

**Facts.** The product is qualified Windows-first, yet the suite, the build and the browser tests
run in CI only on Linux; the one Windows job runs three test files and a probe
(`.github/workflows/qualify.yml`). Windows behaviour is therefore proven only on the founder host,
which is also where the implementation owner builds. The repository is public, so hosted runners
cost CI time and no money as far as was read; the pricing page was not re-checked.

**Options.** Yes (recommended), with the real-Blender tests staying on the founder host unless the
pinned archive may be fetched by the runner; or stay as today.

**What waits.** MPR-804.

## FD-9 — Operating-system user presence

**Question.** Should human-only commands be able to require Windows user presence (PIN,
fingerprint or face through Windows Hello)?

**Facts.** Human-only commands accept only the browser principal, which is established by a
single-use launch secret. The recorded qualification outcome is a fallback: no native helper is
wired, and software running under the same Windows account remains a residual risk
(`docs/evidence/qualification/q15-user-presence.json`). Approval requests from agents (MPR-504)
and budgets (MPR-505) make the human gate more valuable to defeat.

**Options.**

1. Recommended. Build it as a setting, off by default, required for spending approvals once any
   paid route exists. The launch secret stays.
2. Keep the fallback and its written residual risk.

**What waits.** MPR-508.

## FD-10 — Personal account id in committed files

**Question.** May the committed notebook metadata be changed so that it no longer names a
personal Kaggle account?

**Facts.** `scripts/kaggle/wan22-ti2v-5b/kernel-metadata.json` and
`scripts/kaggle/cogvideox-2b/kernel-metadata.json` carry an account-prefixed notebook id. The
repository is public. The running code already takes the account from an environment variable.

**Options.** Yes: template the id and fill it at run time (recommended); or leave it. History
would still contain the old value; rewriting history is not proposed.

**What waits.** The second part of MPR-205. Its first part does not wait.

## FD-11 — Order of work

**Question.** Should the implementation owner finish the in-flight Blender pull requests and then
build Stage 1 ("The Revisable Shot") before opening any other new feature stream?

**Facts.** The Blender stream is active in the same files several cards touch; pull request #279
of that stream was open and not merged when the baseline was re-verified on 2026-11-22
([02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md) section 9).
Stage 1 lives mostly in files that stream has not touched, needs no new model, hardware or
download, and is the shortest path to a shot with a kept request record and history in a
local project ([08_ROADMAP.md](08_ROADMAP.md)). Whether other products offer
the same is [UNKNOWN].

**Options.** Yes (recommended); or let Stage 2 (gates and agent surface) go first, which is safer
for later provider work but shows a user nothing new.

**What waits.** The ordering in [OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md).
The registry lists no card under this decision, because it orders all of them.

## How the lists of waiting cards were made

Each decision above names the cards the registry lists for it
([TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json), `founderDecisions`). A card is listed
when it names the decision in its own text. Two kinds of waiting are kept apart in the sections
above: a card that cannot start without the answer, and a card that can be built either way but
delivers less with the default. Only seven cards are blocked outside engineering at this baseline:
MPR-001 (FD-1), MPR-804 (FD-8), MPR-508 (FD-9), MPR-220 and MPR-221 (FD-4), MPR-222 (FD-5) and
MPR-803 (FD-6). Two more are deferred: MPR-211 (FD-5) and MPR-404, which waits for a route that
accepts a control input.

## Inputs that are not decisions

Three cards need a small input from the founder that does not change scope or authority.

- MPR-209 shows a source offer. The address of the source repository it prints is a value the
  founder supplies; the card does not guess it.
- MPR-802 needs the founder to name the operator who produces the baseline projects and the
  person who reviews the rubric, before the counted run.
- MPR-804, if FD-8 is yes and the real-Blender tests are to run in CI, needs the founder to name
  where the runner may fetch the pinned Blender archive from. Without that the Blender tests stay
  on the founder host.

## Not requested now

These were considered and are deliberately not put to the founder yet.

- **A new resource policy version.** The worst-case memory arithmetic does not include the
  Blender worker ([11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md)
  section 6). The plan is to measure first. A request to change the policy would follow only if
  measurement shows the frozen budget cannot hold.
- **A retention policy for old revisions and rejected takes.** History is kept and disk pressure
  refuses new work. Deleting history would trade recoverability for disk, and the plan does not
  propose it.
- **Release, signing and installer decisions.** These remain with the existing external items
  X-01 to X-03 of the System Supremacy programme and are unchanged by this revision.
- **Any GPU purchase or rental.** Nothing in Stages 0 to 3 needs one.
- **The pinned-take consent rule (MPR-010).** A take pinned before a consent was revoked can
  today be put back by undo. Which rule closes that path is an open product decision of the kind
  the founder record entry of 2026-11-07 delegates. MPR-010 states both rules, recommends one and
  records the choice in the decision record the delegation names. The founder can overrule it;
  no answer is needed for the card to proceed, unless its reviewer judges that the change needs
  the founder; then it waits, as the card says.
