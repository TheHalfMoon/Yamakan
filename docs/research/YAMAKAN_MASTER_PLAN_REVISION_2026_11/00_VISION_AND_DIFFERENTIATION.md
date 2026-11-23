# Vision and differentiation

> Status: ADOPTED — the current frontier by founder instruction. Each card stays gated by its state and founder decisions.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document states what Yamakan should be, where it can lead and where it cannot, and how that
will be measured. Evidence for every external statement is in
[01_COMPETITIVE_CAPABILITY_MATRIX.md](01_COMPETITIVE_CAPABILITY_MATRIX.md); source keys such as
HF-S7 resolve in its section 9 and in [SOURCES.md](SOURCES.md). Evidence labels are `[DOC]`
(vendor documentation), `[CLAIM]` (vendor marketing), `[IND]` (independent third party),
`[ASSUMED]` (our inference) and `[UNKNOWN]`. No competitor was tested hands-on, so no statement
here is a measured comparison.

## 1. Thesis

> Yamakan is the production system of record for AI filmmaking: every shot stays a revisable,
> attributable object with a stated cost in time and data, inside one local project that the
> creator owns — whichever model, renderer or agent produced it.

Until a paid route is authorised (FD-5), the stated cost is estimated time, quota seconds and bytes
leaving the PC. No money figure is shown.

Four properties are the product:

| Property | Meaning in the product | Built today | Cards that complete it |
|---|---|---|---|
| Revisable | One shot can be regenerated, re-rendered or replaced without touching any other shot, and the change is one undo step | Take compare, propose and apply exist (SS-006); a generation cannot target a shot; a split shot refuses replacement | MPR-102, MPR-103, MPR-104, MPR-105 |
| Attributable | Every take records what made it: model, version, route, licence, inputs, request and who approved it | Output hash and input pins only; seed and model sit in a free-text label | MPR-101, MPR-107, MPR-506, MPR-701 |
| With a stated cost | Before anything runs, the person sees the estimated time, the quota seconds and the bytes leaving the PC, and nothing spends without a recorded approval. A money figure is added only with a paid route (FD-5, MPR-222) | Expected minutes and an egress notice; zero spend holds because no paid code exists | MPR-203, MPR-204, MPR-505 |
| Owned | The project, its media and its history live on the creator's PC, restore on another PC, and export with their lineage | SQLite workspace, content-addressed media, verified backup and restore; export carries no manifest | MPR-701, MPR-702, SS-015 |

## 2. What Yamakan is, and is not

Yamakan is a local production tool with one canonical project and timeline, typed commands shared
by the browser, SDK, CLI and MCP, durable jobs, and human approvals
([02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md)). Models and
renderers are replaceable suppliers of takes.

Yamakan is not:

- **A model company.** It trains nothing and ships no weights.
- **A model marketplace.** Aggregators add models most weeks [DOC] HF-S14 and advertise more than
  a thousand [CLAIM] FA-1. Counting integrations is not the measure of success here.
- **A hosted service.** There is no Yamakan cloud, account or credit wallet. Generation runs where
  the customer authorises it: today their own Kaggle account; later, if the founder decides
  (FD-4, FD-5), a local runtime or a provider under the customer's own credentials.
- **A replacement for Premiere or Resolve.** The plan is honest interchange (SS-015, MPR-702), not
  parity with a full finishing suite.
- **An autonomous film-maker.** Yamakan ships no language model. The Director is a plan and a set
  of approval points that the customer's own agent or the person works through.

## 3. What is measured

The thesis is tested on seven measures. Each has a protocol in
[10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md). None has been measured against
any competitor; every head-to-head result is NOT TESTED. Project recoverability, export reliability,
cost predictability, lineage completeness and supervised agent completion are checks of Yamakan
alone; they do not compare it with any product.

| Measure | Definition | Why Yamakan can affect it |
|---|---|---|
| Generations to accept | Attempts needed before a reviewer accepts a requested revision of one shot | A revision starts from the previous take's full record and changes one field (MPR-103) |
| Collateral change rate | Share of untouched shots whose exported frames differ after a one-shot revision | Other shots are separate clips re-rendered deterministically from unchanged media |
| Project recoverability | A backup restores on a clean PC and exports the same film; the project still opens after a provider or model disappears | Local store, immutable revisions, content-addressed media (`core/recovery.ts`) |
| Export reliability | Share of exports that finish and pass an independent probe | Owned FFmpeg build, deterministic render plan (`core/render/plan.ts`) |
| Cost predictability | Difference between the figure shown before a run and what the run consumed; count of spend events with no prior approval, which must be zero | Preflight (MPR-203) and default-deny gates (MPR-204) |
| Lineage completeness | Share of generated clips on the timeline whose take has a complete record that survives export and restore | The record is project content, not a log (MPR-101, MPR-701) |
| Supervised agent completion | Share of a fixed task set an agent completes over MCP within a budget, with approvals, including after a forced restart | Durable jobs, scoped tokens, hash-bound approvals; budgets and waits to add (MPR-502, MPR-504, MPR-505) |

A lead is **not** sought on raw model quality, model count, cloud speed, mobile and social
templates, full NLE depth, native audio and lip sync, real-time generation, or enterprise
compliance packages. Section 5 of the matrix gives the evidence for each.

## 4. Hypotheses

Each hypothesis is a bet. Each is NOT TESTED. A hypothesis that fails its pre-registered threshold
is reported as failed and the plan changes; the threshold does not. No hypothesis that gives a
professional a reason to switch can be tested before FD-6 authorises a comparison; until then the
thesis is unvalidated.

### H-A — Revision locality

*Changing one shot in Yamakan leaves every other shot identical, and takes fewer attempts than
regenerating a flattened multi-shot clip.*

- Why it may hold: surveyed generators treat an edit as a new metered generation [DOC] R-EDIT,
  HF-S8, and several deliver multi-shot clips with the cuts baked in [DOC] HF-S7, K-USE40. A
  project that keeps shots as separate clips can replace one and re-render the rest unchanged.
- Why it may not: Lightricks' hosted studio already replaces a regenerated clip in place [IND]
  LX-4, and Seedance 2.5 claims timestamp-level editing inside a clip [CLAIM] SD-1. Locality alone
  may be table stakes soon; the record and the history are the durable part.
- Built today: take replacement as one undo step (`core/takes.ts`); no shot-targeted generation.
- Cards: MPR-102, MPR-103, MPR-105; measured for Yamakan alone by SS-016 and MPR-802. A comparison
  needs MPR-803 (FD-6). Document 10 recommends the competitor configuration with its documented
  Resolve plugin (2-R); a result against the web product alone (2-W) names that configuration.
  Against Lightricks' studio H-A is NOT TESTED, and no arm covers it.

### H-B — Same model, better production

*With the same model and the same budget, a production made in Yamakan reaches an accepted cut
with fewer generations, because attempts are kept, compared and revised rather than re-prompted.*

- Why it may hold: no surveyed product was found to keep a per-shot history of attempts with the
  parameters of each [UNKNOWN]; nearest are version feeds and prompt recall [DOC] R-EDIT, KP-1.
- Why it may not: the effect could be small next to model variance, and a same-model comparison
  needs a route to the same model on both sides, which today exists only for open-weight models
  on rented or free GPUs.
- Built today: up to eight takes per shot with one selected (`core/story.ts` `STORY_LIMITS`).
- Cards: MPR-101, MPR-103, MPR-107; measured by MPR-802 and, with authorisation, MPR-803 (FD-6).
  The same-model pair compares finishing and revision around one generator. It cannot show that
  keeping and revising attempts is the cause; that part is NOT TESTED, and no card tests it.

### H-C — No surprise spend

*Nothing in Yamakan consumes money, quota or network without a figure shown first and a recorded
approval, including when an agent is driving.*

- Why it may hold: it is an engineering property, not a quality contest. Competing agents have
  uneven controls: one hosted MCP documents no native credit cap [DOC] HF-S22; one agent generates
  automatically unless told to ask [DOC] R-AGENT; one canvas starts runs unconfirmed [DOC] FL-2.
- Why it may not: Flora already documents quotes, caps and free failures [DOC] FL-2, and Runway
  has a cost endpoint [DOC] R-CHG. Yamakan must match that floor before it claims more.
- Built today: zero spend holds by absence of code, not by a gate
  ([02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md) section 7).
- Cards: MPR-203, MPR-204, MPR-207, MPR-505.

### H-D — A finished project remains yours

*A Yamakan project restores on another PC, exports with its lineage, and stays usable after the
provider or model that made its shots is gone.*

- Why it may hold: cloud tools keep the project on the vendor's side, and several keep API
  outputs for days or hours [DOC] HF-S24, K-I2V40, L-AG-VID. OpenAI removed its video models and
  API with no replacement [DOC] OA-1.
- Why it may not: interchange formats carry cuts, not looks or lineage [DOC] OS-2, so "portable"
  outside Yamakan means a stated loss report, not a round trip.
- Built today: backup, restore into a new root, repair; OTIO export with a loss report.
- Cards: MPR-701, MPR-702, SS-015.

### H-E — An agent you can supervise and resume

*An external agent can do real production work in Yamakan through MCP, under scopes, budgets and
approvals, and pick up after a restart without repeating paid or slow steps.*

- Why it may hold: the pieces that are hard to retrofit exist: one command registry for every
  surface, durable jobs, scoped expiring tokens, and human-only operations.
- Why it may not: today the agent surface is thin. There is no wait, no event feed, no budget and
  no way to request an approval; generation itself is human-only
  ([02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md) section 3.11).
- Cards: MPR-501 to MPR-507, measured by MPR-805; the human-presence question is FD-9.

## 5. The editability ladder

"Fully editable AI production" is defined by levels, so that the product never promises
editability a source model cannot supply.

| Level | What it is | What stays editable | What is fixed | Status |
|---|---|---|---|---|
| L0 Flattened pixels | A generated or imported clip | Trim, split, move, speed, transform, crop, LUT, opacity and volume keys, replace | Everything inside the frame: subject, camera, light, baked-in cuts, audio generated with the picture | Built |
| L1 Regenerable | A take with its full generation record | Change one field (prompt, seed, reference, duration, model) and make a new take; compare; revert | The result is a new sample, not an edit of the old one; the same seed need not reproduce the same frames on a different route; a take from a hosted or unpinned model is attributable, not reproducible | MPR-101, MPR-102, MPR-103 |
| L2 Deterministic layers | Titles, captions, colour, transitions, transforms, sound levels, loudness | Re-rendered from the project by the owned FFmpeg build on every export | Title styling and keyframed transforms are limited today | Built; controls in MPR-601 to MPR-603 |
| L3 Structured scene | A shot rendered by Blender from a stored scene | Camera, lens, light, objects and their motion are numbers; change one and re-render that shot | Photoreal quality and render time on a CPU-only PC: 1280×720, 120 frames, 32 samples, one render at a time | Built per render; stored per shot in MPR-403 |
| L4 Hybrid | A Blender camera path, depth or mask conditioning a generative model | The 3D layer stays exact; the generated layer is regenerable | Needs a model route that accepts control inputs; none of today's three recipes does | MPR-404 (DEFERRED) |

Rules that follow:

1. A generated clip is L0 or L1. Yamakan does not claim layers, relighting or camera changes
   inside generated pixels unless the model returned them as separate outputs.
2. A clip with cuts baked in is one L0 object. Shot-level revision needs one shot per generation,
   which is why MPR-102 makes the shot the target of a generation.
3. Blender gives exact control within today's limits: camera moves from a fixed list, product
   geometry, placement of objects, and one end pose per moving object, at most 1280×720, 120 frames
   and 32 samples per render, one render at a time. Tracking and match-move are commands with no
   browser control, and no card adds one.
4. The interface names the level of each clip, so a person knows what "revise" will do before
   they press it (MPR-104).

Limits that hold while this plan is built:

- Stage 1 revises the fields of the stored request only. Framing, camera and performance are stored
  text until Stage 4.
- Without FD-2 a revision keeps seed, size, length and model; the person retypes the prompt.
- A generated shot is short: about 3.4 seconds (Wan2.2) or about 6.1 seconds (CogVideoX-2B) on the
  Kaggle route. A Blender render is at most 120 frames.
- No lip sync, and no sound generated with the picture. Speech arrives only with MPR-221, behind
  FD-4: English, fixed built-in voices, no cloning. Until then a shot's dialogue (MPR-106) is a
  stored note.
- A take from a hosted or unpinned model is attributable, not reproducible.

## 6. The ten strategic questions

**1. Why would a professional leave Higgsfield?** Not for better pictures: Yamakan cannot win on
model breadth or quality. The reasons are structural. Higgsfield has no timeline of its own [DOC] HF-S7, though it documents plugins into Resolve and
Premiere [DOC] HF-S9, so its users already finish in a professional editor; every change is another metered cloud pass [DOC] HF-S8; its character identities are
not exportable [DOC] HF-S11; the canvas has no export [DOC] HF-S5; credits expire at renewal
[DOC] HF-S17; customer content may train models outside an enterprise agreement [DOC] HF-S1; and
its agent connection has no native credit cap [DOC] HF-S22. A professional with client work,
confidentiality duties or a fixed budget has reasons to want the project on their own PC. More
likely than "leaving", they would use Yamakan as the place where shots from any generator are
assembled, revised and kept. That makes generator import and provider routes (MPR-210, MPR-222)
matter more than out-generating anyone.

**2. What does Yamakan do better?** Not shown: no comparison has run. By construction, today: the project
is local and restorable; edits are typed, undoable and revision-pinned; takes are replaced as one
undo step; every surface shares one command registry with scopes and human-only operations; jobs
survive restarts. After Stage 1 and Stage 2 of [08_ROADMAP.md](08_ROADMAP.md): the per-shot record,
revise-from-take, and cost shown before a run.

**3. What outperforms with the same model?** Not shown: no comparison has run. The hypothesis is
the production around the model: fewer wasted
attempts because each attempt is kept with its parameters (H-B); no collateral change (H-A);
no lost work on restart; a finished cut that can still be revised next month. This is a
hypothesis until MPR-802 and MPR-803 run.

**4. Where does native editing beat model quality?** Wherever the change is deterministic: timing,
order, trims, titles, captions, colour, loudness, reframing, transitions, and anything rendered
from a 3D scene. Fixing a two-frame trim or a caption typo by regenerating is slow, costs money
and may change the shot. The rule for the interface is: offer the deterministic fix first, and
regeneration only for what is inside the pixels.

**5. How is regeneration cheaper or more predictable?** Cheaper per accepted shot only if H-B
holds. More predictable by design: one shot per generation, a preflight figure (MPR-203), a
budget that refuses rather than warns (MPR-505), failure classes that say whether a failed run may
still be billed (MPR-207), and no automatic retries of anything that spends.

**6. How is agent productivity measured?** By supervised agent completion (section 3) on a fixed
task set: tasks completed, human approvals needed, budget overruns (must be zero), repeated work
after a forced restart (must be zero), and wall-clock time. The protocol is fixed in MPR-801 and
run by MPR-805 with a scripted agent, so no language model varies between runs. A model-driven agent is NOT TESTED, and no card tests
one. Not by counting tools.

**7. How is lock-in avoided, including lock-in to Yamakan?** The record of a take names the model,
version, route and licence, so a project never depends on one provider's wallet (MPR-101,
MPR-201). Media is ordinary files addressed by hash. Export writes a manifest and a provenance
report (MPR-701) and interchange with a loss report (MPR-702). Adapters are data plus a small
contract (MPR-206). Yamakan itself is GPL-3.0-or-later, so the tool cannot be taken away.

**8. Which features have the best impact for their cost?** In order: the generation record
(MPR-101); generation into a shot (MPR-102); revise-from-take (MPR-103); the "Revise this shot"
control (MPR-104); controls for editor commands that already exist (MPR-601 to MPR-603); preflight
(MPR-203); the honest MCP surface, wait and events (MPR-501, MPR-502); the export manifest
(MPR-701). All extend code that exists; none needs a new model or new hardware.

**9. Which impressive features are rejected?** A Yamakan cloud or credit wallet; an in-product
chat agent with a bundled language model; a node canvas; training character models on customer
faces; a model marketplace; real-time generation; a mobile app; a new timeline or project format;
a second scheduler. Reasons are in [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md).

**10. How does the plan adapt as new models arrive?** A new model is a catalog entry and, at most,
an adapter that passes a conformance kit (MPR-201, MPR-206); it is never a product redesign. The
capability report (MPR-202) tells the interface what the model can take, so shot, take, record
and timeline do not change. Partial revision is moving into the models themselves [CLAIM] SD-1;
when a route offers it, it becomes another operation that produces a new take in the same history.
[07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md) gives the intake order.

## 7. Who it is for

| Person | What they need from the thesis | Journey |
|---|---|---|
| Beginner | Make a first clip, see what it will cost and what leaves the PC, never lose work | [06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md](06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md) journey 1 |
| Professional editor | Trust the timeline, revise one shot, hand off to their finishing tool with a stated loss report | journeys 2 and 3 |
| Filmmaker | Plan shots, keep takes, hold camera and blocking exact where it matters | journey 4 |
| Marketing team | Reuse a product and a brand look across many variants with a known budget. There is one human principal: a second approver is not supported | journey 5 |
| Agent operator | Give an agent a scoped token and a budget and get a resumable, auditable result | journey 6 |

One project serves all five. Simple and advanced views are views of the same project; nothing is
converted when a person moves between them (MPR-605).

## 8. What this revision changes in the plan

The earlier plans built and qualified a sound engine: the frozen W-plan, the P10 activation, the
executed Ultimate plan (YU-) and the System Supremacy programme (SS-). They did not state why a
filmmaker would choose the result over a generator's own website. This revision keeps all of that
work and its open items, and adds:

1. a product thesis with measures that can fail;
2. the shortest path to it, Stage 1 "The Revisable Shot", which needs no new model or hardware;
3. explicit gates for spending, egress, downloads and licences before any new route;
4. a place in the plan for the streams built since 2026-11-05 that no registry records;
5. eleven decisions only the founder can make
   ([FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md)).

It removes nothing, renumbers nothing and changes no authority. The reconciliation with every
earlier item is in `LEGACY_RECONCILIATION_ADDENDUM.json` and
[03_GAP_AND_DEPENDENCY_ANALYSIS.md](03_GAP_AND_DEPENDENCY_ANALYSIS.md).

## 9. Claims that must wait

Section 7 of the matrix lists the statements Yamakan must not make today and what would change
each one. The short form: nothing comparative, nothing about consistency, nothing about cost
shown before a run, nothing about local generation, and nothing about release readiness, until
the named card is done and its measurement is published with its date and sample size.
