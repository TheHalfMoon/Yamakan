# Founder decision record

This records the founder's implementation authorization against the [decision packet](FOUNDER_DECISION_PACKET.md). The packet and earlier review evidence remain unchanged historical records.

## Source of authorization

- **Source:** written founder instruction titled "YAMAKAN — FOUNDER IMPLEMENTATION AUTHORIZATION & AUTONOMOUS ENGINEERING EXECUTION", delivered to the implementing agent (Claude, Claude Code) in an interactive session on the founder's Windows device `Abdulaziz` on 2026-10-11, followed by a confirming instruction in the same session.
- **Bound plan commit:** `edbaba6c4f5f2f42e968b4ab2273c8e11620d9af` (PR #5 head; PR #3 `419bc356…`, PR #4 `73910ba9…`).
- **Form:** chat instruction only. There is no separate signed approval and no founder GitHub review; none is claimed.

Approval line in the packet's format:

`Final plan edbaba6c4f5f2f42e968b4ab2273c8e11620d9af: A/B/C/E/I/J approved as preferred; D/F/G deferred; H superseded by completed repository rename; founder (repository owner TheHalfMoon), 2026-10-11.`

## Decisions

| Choice               | Recorded decision                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A architecture       | Approved: final refined D′.                                                                                                                                                                                                                             |
| B MVP scope          | Approved: offline local-web Windows MVP, Arabic/English, durable projects, editing, rendering, recovery, core API/MCP.                                                                                                                                  |
| C migration          | Approved: checked Flicks/BigInt timing, source timestamp preservation, migration into a new root, byte-identical originals.                                                                                                                             |
| D desktop            | Deferred: packaging/installers wait for separate qualification. MVP Windows process-lifecycle requirements stay mandatory.                                                                                                                              |
| E reuse/distribution | Approved: qualified source reuse with precise provenance, legal notices and the mandatory security exclusions.                                                                                                                                          |
| F local AI           | Deferred until qualified hardware, models, weights and runtime exist.                                                                                                                                                                                   |
| G providers          | Deferred: no paid API activation or cloud spend; future-compatible contracts only.                                                                                                                                                                      |
| H naming             | The founder states the repository was renamed `TheHalfMoon/Darzain` → `TheHalfMoon/Yamakan`; verified live on 2026-10-11. Yamakan is the canonical identity; historical Darzain provenance is preserved and active product-facing branding is migrated. |
| I release gates      | Approved without weakening: full technical acceptance criteria and independent verification.                                                                                                                                                            |
| J residual risks     | Accepted as planning assumptions, not as acceptance of implementation defects.                                                                                                                                                                          |

## Additional founder statements

- **Planning integration.** The founder directed integration of the stacked planning PRs. They were merged in dependency order with normal merge commits at their exact reviewed heads: #3 → `4e2f4b2b`, #4 → `237518ef`, #5 → `559ac7f7`. The resulting main tree is identical to `edbaba6`.
- **Source reuse.** The founder states: "I have official legal permission to copy, use, modify, combine, adapt, integrate, and rebrand the source code of all the donor projects previously identified and discussed for Yamakan." This is the founder's statement; no separate written grant is held in this repository. It does not extend to model weights, datasets, trademarks, proprietary media, hosted capacity or third-party services. AGPL and other notice or source-offer obligations still apply.
- **Repository writes.** The founder directed that authorized GitHub write operations use the `TheHalfMoon` credentials per command, without switching the machine's active GitHub account.
- **Autonomy.** Routine, reversible engineering work under the plan proceeds without per-step approval. This does not waive security, financial, rights or release gates, and it does not authorize paid purchases or a public release.

## 2026-10-13: performance targets frozen (approval I)

- **Source and form:** chat instruction only, in the same interactive session on the founder's device. The founder replied "approve, continue." to the T10 release proposal, which listed three open founder items. The agent asked which items the approval covered; the founder's answer covered only freezing the proposed performance targets. There is no signed approval and no founder GitHub review; none is claimed.
- **Scope:** the plan's proposed performance targets, frozen as hard thresholds in [`core/qualification-policy.ts`](../core/qualification-policy.ts) (`yamakan.qualification-policy/v1`):
  - cold launch p95 ≤ 5 s;
  - reopen p95 ≤ 2 s;
  - reference still p95 ≤ 1 s warm and ≤ 3 s cold;
  - 2 s reference segment p95 ≤ 6 s cold;
  - 720p playback ≥ 24 fps.

  The approval also covers the hardware profile and the fixtures stated in that file.

- **Offered but not selected** in the founder's answer, so not approved:
  - treating worker read containment as ship-blocking;
  - the proposed engineering order.
- **Not covered** by the question or the answer: any memory or resource ceiling. The 300 MiB large-import ceiling in `scripts/qualify-large-import.mjs` is a proposed value, not part of policy v1.
- **Change rule:** a threshold is never adjusted to pass. A change needs a new policy version and a new founder approval.

## 2026-10-13: continuation to verified completion

- **Source and form:** chat instruction only, in the same interactive session, titled "YAMAKAN — AUTONOMOUS CONTINUATION TO VERIFIED PROJECT COMPLETION". There is no signed approval and no founder GitHub review; none is claimed.
- **Key sentences, verbatim:**
  - "Treat hostile-media read containment as release-blocking."
  - "Prefer a correctly implemented Windows AppContainer when feasible. Otherwise use a fully restricted token with restricting SIDs on every relevant access and brokered inputs."
  - "A write-restricted or low-integrity token alone does not satisfy read containment."
  - "If containment cannot be demonstrated, leave the affected worker feature disabled and retain NO-GO for release."
  - "Choose and freeze a measurable resource policy", covering import-service peak RSS, decoder/probe memory and runtime, render memory, disk admission and reserve, and active job/resource budgets.
  - "Do not falsely attribute an agent-selected policy to an earlier founder decision."
  - "Do not publish a public release, deploy paid infrastructure, enable paid AI providers, or incur charges without the corresponding explicit authorization."
- **Scope, summarized by the agent:** continue autonomously through the remaining MVP gates and then the roadmap approved with the plan ([ROADMAP.md](ROADMAP.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), plan `edbaba6c`), without routine approval; the engineering order is the agent's.
- **Attribution:** values the agent chooses under this delegation are recorded as agent decisions, with their rationale, and are not attributed to approval I or any earlier founder decision.
- **Not authorized without a further explicit authorization:** purchases, paid services or inference, cloud spend, and a public release. Human- and administrator-only gates stay open until they genuinely run: native Arabic review, clean profiles, a second account, packet capture and disk-full runs.

## 2026-10-18: source reuse planning mission

- **Source:** written founder instruction titled "YAMAKAN — DEEP REA, MAXIMUM AUTHORIZED SOURCE REUSE & IMPLEMENTATION-READY MASTER PLAN", delivered to the implementing agent (Claude, Claude Code) in an interactive session on 2026-10-18. Chat instruction only; no signed document is claimed.
- **Requested:** a reuse-first, implementation-ready plan with REA evidence, delivered as one planning PR that is not merged automatically. Production changes, paid provider activation and public release are not authorized by it.
- **Source authorization statement:** the founder stated that legal permission covers source-code reuse (copying, modifying, adapting, combining, deriving, rebranding, renaming, distributing and commercial use) for the named donor sources and those covered by existing authorizations, and that the underlying agreements are confidential and will not be provided. The agent has not seen or verified them and records no clause, date, signature or licensor. The minimal record and how the plan uses it are in [source provenance and branding](research/rea-source-reuse/11_SOURCE_PROVENANCE_AND_BRANDING.md).

## 2026-10-18: finalize and freeze the plan (no implementation)

- **Source:** written founder instruction titled "YAMAKAN — FINALIZE, VERIFY AND FREEZE THE IMPLEMENTATION PLAN", delivered to the implementing agent (Claude, Claude Code) in an interactive session on 2026-10-18. Chat instruction only.
- **Recorded statements:** "The founder does NOT want to start implementation now." "I am not authorizing implementation today." "Do not merge the planning PR without my approval." The planning package is to be completed and frozen so that a future agent can start the first executable task without repeating research or planning.
- **Effect:** PR #30 is updated with the final planning package and is not merged. No production code, implementation PR, model install, paid service or task W1–W18 is started. Implementation begins only on a later written start authorization ([START_HERE_WHEN_READY.md](START_HERE_WHEN_READY.md)).

## 2026-10-21: start authorization for frozen plan (Track 1 and Track 2)

- **Source and form:** written founder instruction titled "YAMAKAN — AUTONOMOUS ENGINEERING EXECUTION UNTIL VERIFIED COMPLETION", delivered to the implementing agent (Cursor) in an interactive session on the founder's Windows device `Abdulaziz` on 2026-10-21. Chat instruction only. There is no separate signed approval and no founder GitHub review; none is claimed.
- **Bound freeze:** plan content commit `651733ab7f83ccb178523741b887016a12df6d4f`; freeze manifest at PR #30 head `d42b32b5003c4427fe31f2a6e7ee278e67e0fb87`; immutable tag `plan-freeze-2026-10-18` on the content commit. Main before merge was `6e471088a56b6bdda4fef29c747167827958a224`.
- **Authorized scope:**
  - Finalize and merge planning PR #30 through normal GitHub process.
  - Track 1 MVP engineering W1–W7 and Track 2 reuse-first expansion W8–W18 under Architecture B.
  - Qualify and merge dependency PRs #19, #24 and #29 (or recorded successors) when gates pass.
  - Ordinary merges after independent review, exact-head CI and repository merge discipline.
- **Still not authorized without a further explicit instruction:** purchases, paid cloud services, paid inference, paid API usage, model-weight downloads, public production deployment, and an artifact-bound public ship decision.
- **Gates that remain execution-time requirements:** H1–H5, E-SEC, founder decisions F and G, and any genuine external resource the plan already names. Blocked capabilities stay disabled; independent authorized work continues.
- **Effect:** implementation of the frozen plan is authorized per [START_HERE_WHEN_READY.md](START_HERE_WHEN_READY.md). PR #30 merged as a normal merge commit; engineering begins at W1.

## 2026-10-21: P10 qualification, activation, and release readiness

- **Source and form:** written founder instruction titled "YAMAKAN — P10 AUTONOMOUS QUALIFICATION, ACTIVATION & RELEASE ENGINEERING", delivered to the implementing agent (Cursor) in an interactive session on the founder's Windows device on 2026-10-21. Chat instruction only. There is no separate signed approval and no founder GitHub review; none is claimed.
- **Baseline main at authorization:** `c6d10f7a82fc17c0d39e1536331b6287b2dfa99e` (W17 frontier record merged; Track 1 and Track 2 engineering merged; W12 H1-blocked; release **NO-GO**).
- **Authorized scope:**
  - Create and merge the P10 implementation-ready plan under `docs/plans/P10-qualification-activation/`.
  - Qualify and, where gates pass, activate already-merged capabilities (Studio Q8–Q10, Animation, Cinema, Director, Quality Lab deterministic paths, Smart Router explain, W12 engineering prerequisites, Windows bundle residuals, release evidence, achievable Windows security tests).
  - Independent reviews, test infrastructure, release-candidate packaging, ordinary merges after exact-head CI and repository discipline.
  - Autonomous continuation without routine per-step approval for ordinary engineering under this phase.
- **Still not authorized without a further explicit instruction:** purchases, paid cloud services, paid inference, paid API usage, model-weight downloads, public production deployment, bypassing security gates, fabricating human sign-offs (including native Arabic review), and an artifact-bound public ship decision (H5).
- **Gates that remain execution-time requirements:** H1–H5, E-SEC, founder decisions F and G, Profile A / second-account / constrained-volume runs that need an administrator, and Q15 OS user-presence where still fallback. Blocked capabilities stay disabled; independent authorized work continues.
- **Effect:** P10 engineering is authorized. Plan package: [docs/plans/P10-qualification-activation/MASTER_PLAN.md](plans/P10-qualification-activation/MASTER_PLAN.md). Release remains **NO-GO** until mandatory release checks pass and the founder gives artifact-bound ship authorization.

## 2026-10-25: Ultimate Master Plan autonomous execution

- **Source and form:** written founder directive titled "YAMAKAN — FULL AUTONOMOUS ENGINEERING EXECUTION", delivered in chat to the implementing agent (Claude Opus, Claude Code) on 2026-10-25. Chat instruction only. There is no separate signed approval and no founder GitHub review; none is claimed.
- **Planning reference:** Draft PR #86 head `caec7d9c225d430e1a42f8af8fd8eebc17c5317d` (`docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/`, read from that branch; PR #85 retained as research evidence). Live main at authorization: `a3c3ce91815aee35ce5b91b4a483dd85766a4429`.
- **Authorized scope:** implement the YU-000…YU-101 tasks of that plan in dependency order: focused branches and PRs, tests including real Windows/E2E, independent review, exact-head CI, and ordinary merges of fully qualified work under branch protection.
- **Still not authorized:** merging or discarding planning PRs #85/#86 without a deliberate reconciliation decision; AG-DOCS activation without its group receipt; generative model/provider activation; model-weight downloads; Plume training; any spending (budget $0) including paid inference, review, GPU, browser or storage services; signing certificates; public release, deployment or package publication; closing issue #77 without its criteria; bypassing branch protection or force-pushing.
- **Tool policy:** use PStack, TesterArmy e2e, Graft, local Liquid AI d1 and Alibaba Open Code Review where technically applicable; record genuine outcomes and blocked runs; advisory tools never satisfy a security gate.
- **Effect:** ultimate-plan engineering may proceed task by task. Engines, providers and JASSUB stay disabled. Release remains **NO-GO**.

## 2026-11-04: System Supremacy implementation handoff to Claude Opus

- **Source and form:** written founder directive titled "YAMAKAN — FOUNDER IMPLEMENTATION HANDOFF", delivered in chat to Claude Opus in Claude Code on 2026-11-04. Chat instruction only. There is no separate signed approval and no founder GitHub review; none is claimed.
- **Planning reference:** verified starting main `9cad22b5b49af5ff56c22e9598c340cf00313981`; authoritative handoff `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/OPUS_IMPLEMENTATION_HANDOFF.md`.
- **Authorized scope:** implement the qualified 31-task registry in dependency order, beginning with SS-004a, SS-005a, SS-017, SS-006 and SS-009: inspect source, implement, test, independently review, obtain exact-head CI, merge qualified PRs, verify main, record evidence and continue to the next eligible task without asking again.
- **Still not authorized:** X-01, X-02 and X-03 remain external gates, not implementation tasks: native Arabic and human usability approval, administrator, profile, signing and release decisions, and real-model qualification. Models and providers stay disabled; Plume stays deferred; resource limits stay frozen; spending stays at zero; public release stays NO-GO. Security and licensing requirements are preserved.
- **Tool policy:** use PStack, Graft, TesterArmy E2E, local D1 and authorized local Alibaba OCR where applicable; advisory tools never satisfy a review or security gate.
- **Effect:** the execution hold from final planning is lifted for this program only. Respect session limits and leave durable continuation checkpoints.

## 2026-11-05: Local AI work and donor copying authorized

- **Source and form:** chat to Claude Opus in Claude Code. Asked directly whether, in the founder's own words, local AI work and copying from five named repositories were authorized, the founder answered "Yes, I authorize it". Earlier the same day the founder had answered "No, keep the rules" and "Keep the rules" to pasted directives.
- **Authorized:** implementing and qualifying local AI generation, including local ComfyUI, and copying from `codyclack/opensfield`, `D3voz/openjutsu`, `Arfolomew/backlot`, `Anil-matcha/Open-Generative-AI` and `wide-trace/open-higgsfield` after licence and revision checks. A qualified local model may then be enabled.
- **Still in force:** each model stays disabled until its own functional, security and resource tests pass. Commercial providers stay off. Media is never silently routed to a cloud service. Plume stays deferred, limits frozen, spending zero, release NO-GO; X-01 and X-02 stay external. The builder reads this as allowing local-model qualification under X-03, which the founder's words did not name. Each model still needs its own weight, rights and resource authority and a reviewed protocol before any download or run, and this host lacks the hardware. Existing security, consent and licensing requirements hold.
- **Limit found:** `wide-trace/open-higgsfield` has no licence, so nothing may be copied from it.

## 2026-11-05: A person starts ComfyUI

- **Source and form:** chat to Claude Opus in Claude Code. Shown the trade-off, the founder chose "Yes, person starts it".
- **Decided:** Yamakan does not own ComfyUI's process, and its worker sandbox is not widened. A person starts ComfyUI, and Yamakan uses only a copy reporting a safe start.
- **Accepted with it:** such a copy has no Yamakan sandbox or memory limit, Yamakan cannot stop it or confirm it stopped, and the reported arguments are ComfyUI's own word.
- **Unchanged:** nothing is enabled by this. Each model still needs its own weight, rights and resource authority and a reviewed protocol.

## 2026-11-05: Temporary integration, and a statement about copying ComfyUI

- **Source and form:** a pasted "Founder decision clarification" with no words of the founder's own, then, asked whether it was theirs, the founder wrote: "i have full legal permission to copy and re name ComfyUI. follow the plan." The builder reads "the plan" as that clarification.
- **Recorded from the clarification:** a person starting ComfyUI is a temporary, user-controlled integration, not the final architecture. Build real read-only health checks, then the generation workflow with explicit user initiation, progress, result import and failure handling. Do not automatically start ComfyUI, download models, install custom nodes or execute arbitrary workflows under this authorization. Design a future Managed ComfyUI Mode, subject to separate security qualification and approval. Prioritize a first real AI-generated video on the timeline, then verify rendering and export.
- **The copying statement is the founder's, and its basis was not seen.** Asked what it rests on, the founder wrote: "full legal permission , i cant share it with you". ComfyUI's licence in the copy inspected is GPL-3.0, and any copy keeps those notices, the only terms the builder can see. No ComfyUI code has been copied or renamed, and the current path does not need it. If it comes to that, it belongs to Managed Mode, with its licence terms recorded first.
- **Unchanged:** local-first privacy, consent, model licensing, frozen resource limits, spending zero, release NO-GO.

## 2026-11-05: Kaggle as the zero-cost GPU environment

- **Source and form:** pasted instructions naming CogVideoX-2B first and Wan2.2-TI2V-5B after, then, asked directly whether the builder may use the founder's Kaggle account to push and run a private notebook, the founder answered "Yes, use Kaggle".
- **Authorized:** the existing Kaggle CLI and credentials, for private Yamakan notebooks on free GPUs, within quota.
- **Limits from those instructions:** no model weights on the founder's PC; no credentials, weights or large generated files in the repository; no interference with other notebooks on that account; paid services stay off; no claim of generation until real inference and export are verified.
- **Unchanged:** nothing here enables a model in Yamakan.

## 2026-11-06: The Create workspace, and Yamakan drives Kaggle

- **Source and form:** chat to Claude Opus in Claude Code. A pasted brief, "Craft Anything × Higgsfield", had no words of the founder's own. Asked whether to take it on, the founder answered "Yes, follow it". Shown that this PC cannot run the models, and two routes for running them from the app, the founder chose "Yamakan drives Kaggle".
- **Shown with that choice:** a prompt, and any reference image, leaves this PC for the founder's private Kaggle notebook. Each run states this and a person starts it. It uses the founder's free quota, about 6 to 20 minutes a clip. It was said to change the earlier "cloud off" decision for this one route.
- **Built so far, within that:** text to video only, so no media leaves. No token is read by Yamakan: the person's own Kaggle CLI uses it. No weights come to this PC.
- **Unchanged:** commercial providers stay off, spending zero, frozen resource limits, release NO-GO, consent rules for a person's media. Each model is offered only after its own run from Yamakan is tested.

## 2026-11-06: A reference image travels inside the run's brief

- **Source and form:** chat to Claude Opus in Claude Code. Asked "Should a reference image travel to Kaggle inside the run's brief?", the founder answered "Yes, in the brief".
- **Shown with that question:** this needs no new Kaggle object, and the image stays in the notebook's history, as prompts already do. A private dataset was said arguably to go beyond the recorded permission, which names a private notebook.
- **Built within that:** the path, with its recipe not offered. No image has left this PC.
- **Not shown with that question, and to be raised before this is offered:** revoking consent later cannot reach the notebook's history.
- **Decided after it, on 2026-11-07, in the same chat:** asked "Should a photo's metadata, such as location, be removed before it's sent?", the founder answered "Yes, remove it". What goes is a PNG Yamakan writes itself from the picture's decoded pixels, at the size the model takes, holding nothing else. This cannot remove what the picture itself shows, such as a street sign or a face, what transparency had hidden, or a message deliberately hidden in the pixels.
- **Decided after it, on 2026-11-07, in the same chat:** asked "Should sending a person's image to Kaggle need its own separate consent?", the founder answered "Yes, separate consent". It was shown that today's consent does not distinguish use on this computer from leaving it. This is the `likeness-send` purpose, required for an image a pack links to a character, for an engine that says it sends a run elsewhere, which today is only Kaggle.
- **Also decided, on 2026-11-07, in the same chat:** asked "Can a character marked as drawn or fictional skip a person's consent?", the founder answered "Yes, if marked". It was shown that nothing can check the mark, so someone could mark a real photo as fictional. Only a browser session can give the mark, and it does not free the same bytes already linked to someone's consent. A re-encoded or cropped copy is not the same bytes.
- **What the mark is, as built:** a statement in the record, not a gate. Beyond being refused where the record contradicts it, it changes no check: an image no pack links already passes without it, and an agent refused the mark can save the same image as a prop. If first-frame sending is ever offered, a marked real photo would leave this computer with no consent to send.
- **Also decided, on 2026-11-07, in the same chat:** asked "Should the page refuse the made-up mark on an image linked to a person's consent?", the founder answered "Yes, refuse it". The mark is refused on an image any pack version links to a consent, revoked or not. This goes by the same bytes, so another copy of the picture is not recognised. An image marked first and linked later is allowed, and held to that consent, but that element cannot then be saved again.
- **Not decided by this:** whether media with revoked consent may be kept as a place or prop. Decided afterwards by Claude, under the entry below, in the [agent decision record](AGENT_DECISION_RECORD.md#2026-11-07-revoked-media-and-an-unlinked-photo-of-a-person).
- **Unchanged:** each run states what leaves and a person starts it, each model is offered only after its own run from Yamakan is tested, commercial providers stay off, spending zero, frozen resource limits, release NO-GO.

## 2026-11-07: Claude chooses on open product decisions

- **Source and form:** chat to Claude Opus in Claude Code. The founder wrote: "from now chose the best, you have my approval."
- **Taken to mean:** Claude decides open product and design decisions in this program, builds them, records the choice and why here, and reports them. It does not lift the standing rules: spending zero, no paid services, release NO-GO, no engine enabled without its own real qualification, each model offered only after its own run from Yamakan is tested, each run stating what leaves with a person starting it, consent rules for a person's media, no weights on the founder's PC, no credentials or large generated files in the repository, Plume deferred, frozen resource limits, Kaggle's quota and other people's notebooks. Arabic review and UX acceptance stay human. Irreversible or outward-facing steps beyond this program's normal merges are still asked about.
- **Choices made under it:** those are Claude's, not the founder's, who has not seen them unless told. They are in the [agent decision record](AGENT_DECISION_RECORD.md), which never attributes them to the founder.

## 2026-11-10: Blender integration, and YouMind OpenLab as its extension

- **Source and form:** two directives pasted to Claude Opus in Claude Code: "YAMAKAN — BLENDER INTEGRATION MASTER DIRECTIVE" and "YAMAKAN — YOUMIND OPENLAB INTEGRATION".
- **Blender:** the founder authorizes researching, copying, adapting, modifying, rebranding, integrating and testing Blender source (github.com/blender/blender) within Yamakan, "subject to applicable license conditions and source provenance requirements", using a copy-first, rebrand, integrate strategy. Yamakan stays the single authority for the project, timeline, assets, jobs and rendering. Blender starts as a sandboxed, on-demand background worker with a versioned contract; arbitrary user Python is never passed to an unrestricted interpreter; add-ons and scripts never run automatically; everything stays local. The whole Blender tree is not to be copied into the repository to inflate coverage; a full runtime, if needed, is a separately versioned component with its own source, licensing, installation and update strategy.
- **YouMind OpenLab:** an extension of the Blender work, not a replacement: a local, searchable creative prompt library, prompt templates, storyboards, shot planning and prompt adaptation, copy-first where licences, content rights and attribution are verified. No mandatory YouMind account, external API or hidden network request; the hosted YouMind service is optional only; community images and video are not bundled without verified redistribution rights.
- **Still in force under both:** spending zero, no paid inference or infrastructure, no automatic model downloads, no public release, signing, deployment or installer distribution without separate authorization, frozen resource limits, existing release gates, independent review and exact-head CI for each change.
- **Downloads:** asked separately. On 2026-11-10 the founder answered "Yes, download it" to Claude's question to download the official Blender 5.3.0 Windows x64 zip (425,299,259 bytes, from download.blender.org), verify it against the published SHA-256, and unpack it into a local tools folder for the worker.

## 2026-11-23: Master plan revision adopted as the frontier

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Do you adopt the new master plan in draft PR #280 (FD-1)?", the founder wrote: "yes adopt it. and make sure , all sources i have legal permission to copy the source code and re name it to yamakan". Later that day the pending question was "May I merge the corrected plan (#281, then #280) into main once CI passes?", beside text listing building the cards (FD-1 d), drafts 85 and 86, and the order of work (FD-11) as still the founder's to answer. The founder wrote: "do not wait for me to tell you continue, you have all my approvals , go ahead". That message names none of them. Chat instruction only: no signed approval and no founder GitHub review.
- **Planning reference:** main after the package merged `f584e4e150eb166aa48411e7203443c00d6643eb`; package `docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11`, corrected by PR #281 before that merge.
- **Authorized scope:** adoption of the revision, in the words "yes adopt it"; and "you have all my approvals , go ahead".
- **Taken to mean:** by the builder, not the founder's words: "go ahead" answers the pending question, so the plan is merged. The words about sources are the founder's statement, not a licence: licence terms, notices and attribution stay, and renaming follows the existing provenance and branding rules. The builder has seen no grant.
- **Pull requests #85 and #86:** disposition not decided. Both stay open drafts, branches untouched: #85 `research/competitive-video-rea-2026-10-22` at `7472a14e2eecea0620e0bb2d4422db8852421491`, #86 `research/ultimate-master-plan-2026-10-23` at `caec7d9c225d430e1a42f8af8fd8eebc17c5317d`. The 2026-10-25 limit on discarding them stands.
- **Still not authorized:** building the cards is not stated in the founder's own words, so card MPR-003 is not met by this entry and the founder is asked first. FD-2 to FD-11 are not decided by this entry; FD-11's default applies. Models and providers stay off, spending zero, frozen resource limits stand, and no public release, installer, signing, weight download or human-only gate (Arabic review, UX acceptance, the Stage 1 editors) is authorized. Release stays NO-GO.
- **Effect:** the revision is the frontier named in `specs/CURRENT.md`; the earlier programme's cards keep their registry and states. The package's documents keep their proposed status line until card MPR-003.
- **Gap flagged, not filled:** founder statements after 2026-11-10, such as those of 2026-11-11 on Blender and YouMind, have no entry here. They are not written from memory.

## 2026-11-23: Building the master plan revision's cards

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "May I build the plan's cards, each behind its own gates?", the founder answered "Yes, build the cards". This is the answer the entry above records as missing. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** building the cards of `docs/research/YAMAKAN_MASTER_PLAN_REVISION_2026_11`, each as its own dependencies, gates and founder decisions allow.
- **Still not authorized:** FD-2 to FD-11 are not decided by this entry, and the disposition of drafts 85 and 86 is still not decided. Models and providers stay off, spending zero, frozen resource limits stand, release NO-GO, and no weight download, installer, signing or human-only gate is authorized.
- **Effect:** the founder's-words condition of card MPR-003 (its step 4) is met by this entry; its dependency on MPR-001 is unchanged. It opens no gate: a card that needs a founder decision still waits for it.

## 2026-11-23: Drafts 85 and 86 retired as superseded

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Should drafts #85 and #86 be retired as superseded, branches kept?", after being told that retiring means a comment on each and shutting it with the branches kept, the founder answered "Yes, retire them". Chat instruction only: no signed approval and no founder GitHub review.
- **Disposition:** ("superseded by" follows MPR-001's recommended wording, not the founder's words) both are to be closed as superseded by the System Supremacy package and the master plan revision, both are retained as evidence, neither branch is deleted, and neither is merged: #85 `research/competitive-video-rea-2026-10-22` at `7472a14e2eecea0620e0bb2d4422db8852421491`, #86 `research/ultimate-master-plan-2026-10-23` at `caec7d9c225d430e1a42f8af8fd8eebc17c5317d`. They are acted on only after this entry merges.
- **Effect:** this is the disposition the two entries above record as not decided, and the deliberate reconciliation decision the 2026-10-25 entry asked for. FD-2 to FD-11 are not decided by it.

## 2026-11-23: A revoked consent covers every new use of the same file

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "May the revoked-consent rule cover every new use of the same file?", the founder answered "Yes, cover it". It was shown that an older test let a shot that pins nothing switch to a file which another shot's take pins, that the cost is that a file shared with another shot becomes unavailable there too until a newer consent is recorded, and that a narrower rule could be got round by placing the file directly. Chat instruction only: no signed approval and no founder GitHub review.
- **Taken to mean:** by the builder, not the founder's words: after a person's consent is revoked, a new use of a file on this project's timeline is refused when any take of that file, in any story version the project ever committed, has a shot that pins a pack linked to that consent, or recorded inputs linked to it, whichever shot or command asks. A new use includes a further copy and a longer clip. What is already on the timeline stays, and can be moved, split or shortened. After a restore the consent must be revalidated first, as for the person's own media. One step of lineage is followed, so a take made from such a take is not found. Other projects' timelines, scene references and canvas bitmaps, and use as a generation's input are not covered by this. Not put to the founder: a pin removed from a later story version still counts; the revalidation after a restore, which also holds up a consent nobody revoked; that copies and longer clips count as new uses; that a pinned pack which is missing or damaged refuses the take; that the image's newest consent is checked for every character it is linked to anywhere in the workspace, so another person's revoked consent on the same image refuses too; and that a take with only continuity references can still be copied or lengthened after a revocation, as before this card.
- **Effect:** card MPR-010 may change the rule an earlier pull request kept on purpose, and the one test that refused it. The builder's choice and its reasons are in the [agent decision record](AGENT_DECISION_RECORD.md#2026-11-23-a-take-made-with-a-revoked-persons-references-does-not-return).

## 2026-11-23: A take's record also holds a revision note and what the run reported

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Should a take also record a revision note, runtime, model and seed (OA-5, OA-16)?", with the builder recommending both because a record cannot be edited once written, the founder answered "Yes, record both". Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** the take record of MPR-101 gains the fields of open amendments OA-5 and OA-16 of the master plan revision.
- **Taken to mean:** by the builder, not the founder's words: `revisionNote`, and `reported` with the runtime lock, the provider's model id and version and the seed the run reported. The note is empty until MPR-103 writes it. What a run reports is the engine's claim, kept beside what was asked for and never in its place.
- **Not put to the founder:** the other half of OA-5 (the shot card lists a shot's attempts), so it stays open; that the note's words are kept in the record, while a prompt's are not (FD-2 is not decided); the limits (500 characters, 32 packages); that a part without the form of such a name is recorded as not known; that only a generation's record reports, not a declared or rendered take's; that only Kaggle runs do today; that a run already known to have succeeded has none; and that what a Kaggle run reports is its script's own (the packages it asks for, its model and the seed it was sent), so it does not prove how a take was made.
- **Still not authorized:** FD-2 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.

## 2026-11-23: Three more kinds of generation failure

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Should MPR-207's list of failure kinds include three more (OA-18)?", after being told the three (the provider refused the credential, the provider refused the content, it ran out of resources) and that the builder recommended them because the list is fixed and other cards read it, the founder answered "Yes, add three". The founder was also told that no route here could report a refused credential on its own; that was wrong, since Kaggle's 401 and "Authentication required" answers are told apart from others, and it was corrected to the founder the same day, after the answer. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** open amendment OA-18 of the master plan revision, `credentialRejected`, `contentRefused` and `resourceExhausted`, in MPR-207.
- **Not put to the founder:** what each says of billing and of trying again, and which answers are read as which; those are the builder's, in the card's text and the evidence file. Nor OA-17, which asks that an adapter must name a kind and is to be decided before MPR-207 (answered below). No route reports `contentRefused` yet.
- **Still not authorized:** FD-2 to FD-11 are not decided by this entry.

## 2026-11-23: Blocked real checks may run on GitHub's own machines

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "May I run the blocked real checks on GitHub's own machines, at no cost?", the founder answered "Yes, use GitHub". The founder was told that GitHub's machines are free for a public repository; that it would be a small addition to the CI setup, through the usual review, with no existing check removed or loosened; that the results would come from a GitHub machine and not the founder's; that it might unblock the checks of MPR-010, MPR-101 and MPR-105, none tried there yet; and that the Blender check would still be blocked, so MPR-101 might still not count as verified. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** running the real checks that are blocked on the founder's computer on GitHub's machines, at no cost.
- **Taken to mean:** by the builder, not the founder's words: a workflow of its own beside the existing one, started by a person or by a pull request that changes one of the checks; a receipt names the commit and what the machine had; and a pass there is evidence for that host.
- **Not put to the founder:** whether a card may be marked VERIFIED on a GitHub host's receipt where its text names no host (answered in the next entry). A card whose text names the founder host or a Windows host, the stage's demonstration and its observers among them, is not met by it. Also not put to the founder: that GitHub's Windows machine was tried and failed, so its Linux one is used, where a media worker runs without a sandbox; that the checks repeat when a pull request changes them, one from a fork included, with no secret and a read-only token; and that the receipts are committed to the public repository. The founder was told that it might unblock MPR-010. It did not: that card names the Windows host.
- **Still not authorized:** FD-2 to FD-11 are not decided by this entry. No model, weights, paid service, secret or Blender download on that machine; the founder's tools folder stays as it is; spending zero, release NO-GO.

## 2026-11-23: A card that names no computer may be verified on GitHub's results

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "May a card be marked verified on GitHub's results, where it names no computer?", the founder answered "Yes, they count". The founder was told that the four checks had passed on GitHub's Linux machine and what that does not show (the Windows sandbox, the founder's computer, Blender, an AI model, the Arabic); that the builder recommended yes with the Windows and Blender gaps kept on record; that cards naming the founder's computer, and Stage 1's final demonstration, would still wait for it; and that each card's own requirements had not been checked against the results yet. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** a card whose text names no computer may be VERIFIED on results from GitHub's machine.
- **What it does not do:** it verifies no card by itself. Each card's own list must be met, and its evidence names the GitHub host.
- **Taken to mean:** by the builder, not the founder's words: a card that names "the Windows host" names a computer, so MPR-010 is not covered. A card may say that a host without something is BLOCKED (Edge for MPR-105, Blender for MPR-101) without naming a computer.
- **Not put to the founder:** that reading of "the Windows host"; that on Linux a media worker runs with no sandbox and no job object (the founder was told only that the Windows sandbox is not shown); and what each of the three cards still waits for, which was found after the answer and told to the founder then.
- **Still not authorized:** FD-2 to FD-11 are not decided by this entry. Stage 0's and Stage 1's exits are unchanged.

## 2026-11-23: A take's record keeps the full prompt (FD-2)

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "May a take's record keep the full prompt, in the project and its backups (FD-2)?", with the choices "Yes, keep prompts" and "No, hash only", the founder answered "Yes, keep prompts". The founder was told that the builder recommended yes for the project and its backups, with exports asked separately; that it was the last thing MPR-101 waited for, and that MPR-102, 103, 104, 106 and 107 could start once that card is verified; and that a yes meant work first, since the record's size limit had to grow to hold a prompt. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** FD-2's first option as far as it was asked: the prompt is stored with a take in the local project and goes with its backups. MPR-101 sets `RECORD_HOLDS_PROMPT`.
- **Taken to mean:** by the builder, not the founder's words: the rest of the request (seed, size, model, inputs), which the record already held and the question did not name, stays as it is; a declared receipt's prompt is kept as a run's is, whole, up to 4,000 characters, where the project held at most 2,000 of it in a shot's notes; a run made before the answer, whose take gets its record after it, has its words kept; and a record made before this keeps its hash alone.
- **Not put to the founder:** that an agent whose token may read projects can read a record's prompt, as it already can read a listed generation's; that records are never pruned, so a prompt stays in the project's records after its take is taken out of the story (these two were told to the founder the same day, after the answer); that no command removes a prompt from a record, also if this answer changes later; FD-2's own point that a prompt can hold private detail and name a consented likeness; and the new size limit itself: 40 KiB for one record, where it was 16, at most 62.5 MiB for the records of one story version, and over time as much as the workspace's document budget (4 GiB) allows.
- **Still not authorized:** prompt text or its hash in an export, which stays a choice of its own (MPR-701) and was not asked; a negative prompt, which no record holds. FD-3 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.

## 2026-11-23: Every engine names a failure kind, and measured facts carry a date and a sample size

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Must every engine name a failure kind, and measured facts carry a date and sample size (OA-17)?", with the choices "Yes, require both" and "No, leave as is", the founder answered "Yes, require both". The founder was told that the builder recommended yes to both, since today a failure without a kind is recorded as "unknown" and a date and a sample size stop one old measurement from passing as a general fact; and that a yes meant a small addition to MPR-207 for the kinds, while the measured facts come with MPR-202. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** open amendment OA-17 of the master plan revision, in MPR-207 and MPR-202.
- **Taken to mean:** by the builder, not the founder's words: the kind is required of an engine's answer that a run failed or was stopped, and refused in any other; an engine that does not know says "unknown"; and an answer that breaks this is still read as "unknown" and not turned into an error of its own.
- **Not put to the founder:** where MPR-202 puts the date and the sample size and what it counts as one measured fact, which are the builder's, in the card's text; and that the engine contract keeps its name although an answer now needs the kind.
- **Still not authorized:** FD-3 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.

## 2026-11-23: The brief form shows fullness, and proposals show names and timecodes

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Should the brief form show fullness, not bytes, and proposals show names and timecodes (OA-10)?", with the choices "Yes, show names" and "No, leave as is", the founder answered "Yes, show names". The founder was told that the builder recommended yes, since people read how full something is and shot names more easily than bytes and ids; that it held MPR-106; and that it costs some interface text, whose Arabic would be unreviewed. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** open amendment OA-10 of the master plan revision, in MPR-106 and MPR-303.
- **Taken to mean:** by the builder, not the founder's words: the form says how full the story is in whole percents of the nearer of its two limits, its text and the whole story; the service's own refusal keeps its byte counts; and a proposal's page looks up the names, while what is stored keeps ids and numbers.
- **Still not authorized:** FD-3 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.

## 2026-11-23: Engine reports say sound and lengths, and a request may name references

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "May engine reports add audio and length ranges, and requests name references (OA-15)?", with the choices "Yes, add them" and "No, leave as is", the founder answered "Yes, add them". The founder was told that the builder recommended yes, since without it the app cannot tell beforehand that an engine lacks these; that it held MPR-202; that a report could say whether an engine makes sound and what range of lengths it allows, and a request could mark a picture as a reference; and that it adds fields only and turns nothing on. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** open amendment OA-15 of the master plan revision, in MPR-202, MPR-203 and the take record of MPR-101.
- **Taken to mean:** by the builder, not the founder's words: a recipe that makes one length says it twice; a reference is a PNG or JPEG, at most four in a request, beside text or the frames; and a request with one is refused wherever no engine honours it, which is everywhere today.
- **Not put to the founder:** which engine should take references first, and what consent a reference picture of a person needs; no command takes one, so nothing can be sent.
- **Still not authorized:** FD-3 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.

## 2026-11-23: An approval remembers the network settings it was given under

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-23. Asked "Must an approval record proxy and certificate settings, and block a start if they change (OA-20)?", with the choices "Yes, record them" and "No, leave as is", the founder answered "Yes, record them". The founder was told that the builder recommended yes; that an approval names Kaggle as the place, but the Kaggle program may go through a proxy or a replaced certificate; that the approval would remember whether either was set and a start would be refused if that changed; that it held MPR-204; and that the cost is to approve again after changing those settings. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** open amendment OA-20 of the master plan revision, in MPR-204 and MPR-205.
- **Taken to mean:** by the builder, not the founder's words: whether a proxy or a certificate setting is there, never its value; that a setting which comes or goes closes the approval for every contact, following a run included, and not for a start only; and that putting the setting back opens it again.
- **Not put to the founder:** what these facts do not see: a proxy set in Windows itself or in the Kaggle program's own settings file, one proxy or certificate replaced by another, and a setting that says which places need no proxy.
- **Still not authorized:** FD-3 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.

## 2026-11-24: A landed database step is pinned by its text

- **Source and form:** chat to Claude Opus in Claude Code on 2026-11-24. Asked "May each landed database schema step's text be pinned by hash in a test (OA-22)?", with the choices "Yes, pin them" and "No, leave as is", the founder answered "Yes, pin them". The founder was told that the builder recommended yes; that it protects existing workspaces against an accidental change to a released database step; that it adds one line to that test for each new step; and that it was due before MPR-204 and held its two pull requests and the work behind them. Chat instruction only: no signed approval and no founder GitHub review.
- **Authorized scope:** open amendment OA-22 of the master plan revision, in MPR-204 and the later cards that add a step.
- **Taken to mean:** by the builder, not the founder's words: the text of each of the nineteen steps as it is in the code now, MPR-204's own included, which lands with this; and that a line once there is not changed to make the test pass.
- **Not put to the founder:** what the pins do not see: whether a step was changed between its first release and today, and the code around the steps (two steps that rebuild a table run with foreign keys off and are checked after, and what is done for a table that already has a column).
- **Still not authorized:** FD-3 to FD-11 are not decided by this entry. Models and providers stay off, spending zero, release NO-GO.
