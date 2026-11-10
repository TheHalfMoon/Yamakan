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
