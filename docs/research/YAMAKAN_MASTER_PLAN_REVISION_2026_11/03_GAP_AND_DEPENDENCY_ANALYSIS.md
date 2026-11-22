# Gap and dependency analysis

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document measures the distance between Yamakan at the baseline and what the thesis in
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md) needs. It names the card that
closes each gap, says what stays open after every card, and gives the order the work depends on.
The current state is taken from
[02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md). The cards are in
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md) and [TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json).

## 1. Method and vocabulary

Each gap has one class.

| Class | Meaning |
|---|---|
| ABSENT | No code for it on `main`. |
| PARTIAL | Some code exists; a stub, a flag that is off, or a record that is too thin. |
| COMMAND-ONLY | Built and reachable by command; no control in the browser. |
| UNQUALIFIED | Built, but not proven on the founder host or by a real run with a committed receipt. |
| STALE-DOC | The code moved and a top-level document did not. |

Document 02's STUB and FLAG OFF rows are PARTIAL here. Its QUALIFIED rows are not gaps.
"02 §3.4" below means section 3.4 of document 02.

- Evidence is document 02 and the repository at the baseline. Nothing was run for this analysis.
  The receipts and tests that document 02 cites were not opened again.
- Card facts come from the registry: 56 cards, 94 card-to-card dependency edges and 4 edges to
  earlier-plan items. Every count in sections 5 and 6 was computed from it with a read-only script.
- Command facts: 116 commands are registered in `core/command/registry.ts` and the cards propose
  41 more. Of the 116, 62 are not named in any file under `src/` and 28 are named by no card. That
  is a text search. It does not prove that the browser cannot reach a feature another way, so it
  was used only as a prompt to read the cards.
- A statement that a card closes a gap means the card's text says so. No card is built.

## 2. What is not a gap any more

### 2.1 Blockers that older plans still describe and `main` has removed

Seven founder-directed streams merged after the earlier plan's handoff. All are kept as built
([LEGACY_RECONCILIATION_ADDENDUM.json](LEGACY_RECONCILIATION_ADDENDUM.json)). No card rebuilds
any row below. MPR-003 gives the streams identifiers a card can cite.

| Earlier statement | Where it still appears | On `main` now | Evidence | Stream |
|---|---|---|---|---|
| No real generation; no zero-cost GPU; engines stay off | draft pull requests #85 and #86; `specs/CURRENT.md`; `docs/plans/P10-qualification-activation/RELEASE_GATE_MATRIX.md` | Three offered recipes and two operations (text-to-video, first-frame image-to-video) run on the person's own Kaggle account, the founder-authorised GPU; no weights on the PC | `core/engines/kaggle.ts`; `docs/FOUNDER_DECISION_RECORD.md`; three page-run receipts in `docs/evidence/ultimate/` | Kaggle and Create (#200 to #236) |
| An engine choice must come first; no adapter exists | drafts #85, #86; `docs/LOCAL_INFERENCE.md` | A ComfyUI adapter exists behind a flag that is off | `core/engines/comfyui.ts`; `docs/evidence/ultimate/comfyui-engine.md` | ComfyUI (#188 to #198) |
| Nothing routes generation requests from the command surface | `docs/OPERATIONAL_CONTRACTS.md` | `yamakan.generation.start` routes to Kaggle | 02 §6 | Kaggle and Create |
| Image-to-video is not offered | `docs/evidence/ultimate/product-matrix.md` | Offered; metadata stripped; consent checked before sending | `core/engines/clean-image.ts` | Kaggle and Create; consent |
| No browser consent control | `docs/evidence/ultimate/product-matrix.md` | Grant, revoke, revalidate and saved packs in the page | `src/main.tsx` (PR #237) | Consent (#179 to #237) |
| Blender is discovery only | draft #86 | Contained worker: render, models, tracking, match-move, aerial view | `core/blender/`; `core/jobs.ts` | Blender (#256 to #278) |
| Cinema is cube proxies; Director is a smoke interface | draft #86; `docs/COMPETITOR_MATRIX.md` | Scene with `.glb` models, Blender render from the page, story shot to timeline with approval | `src/cinema/BlenderRender.tsx`; `core/cinema/glb.ts`; `core/director/cinema-pipeline.ts` | Cinema (#243 to #248); Blender |
| Creative state is outside backup | draft #86 | Immutable, revision-pinned documents inside backups | `core/documents.ts`; `tests/creative-recovery.test.ts`; `docs/evidence/ultimate/receipts/AG-DOCS.json` | earlier programme |
| MCP is unbounded and acts as the one local client | draft #86; `docs/RELEASE_PROPOSAL.md`; `docs/AGENT_MCP_ARCHITECTURE.md` | Bounded framing; scoped, expiring agent tokens; MCP refuses to start without one | `mcp/framing.ts`; `mcp/main.ts`; `src/agent-access.tsx` | earlier programme |
| Fixed 30 frames per second; FFmpeg comes from the host; a fresh checkout cannot run the tests | draft #86; earlier plan, R8 | 24000/1001 as well; FFmpeg vendored and pinned; preflight and setup capture | `tests/rational-fps.test.ts`; `vendor/ffmpeg-win64-r8/`; `docs/evidence/ultimate/SS-017-setup.md` | earlier programme |
| No bundle, installer, update or rollback; no retry or discard for a job that needs reconciliation | earlier plan | Unsigned lifecycle only; both job commands exist | `scripts/bundle.ts`; `tests/unsigned-rc.test.ts`; `yamakan.job.retry`, `yamakan.job.discard` | earlier programme |

Two of the seven streams removed no named blocker. The security-check stream (#225 to #255, in
batches) hardened code that already existed. The prompt-library stream (#261, #262) added a
feature no earlier plan asked for (`core/prompts/library.ts`, `tests/prompt-library.test.ts`).
A founder record entry for the security-check stream and for the Cinema stream was not verified.

Pull requests #85 and #86 are open drafts whose blockers are the first rows above. The proposal
is to close them as superseded and keep the branches as evidence; that waits for FD-1 (MPR-001).
Pull request #279 was open and not merged at the baseline. It is not part of this plan.

### 2.2 The reverse: described or looking done, found unproven

| What a document or the command list suggests | What document 02 found | Class | Card |
|---|---|---|---|
| `docs/AGENT_MCP_ARCHITECTURE.md` describes a Python SDK, quote and pause tools and extra error codes | None exists (02 §6) | STALE-DOC | MPR-002 |
| `docs/COST_ROUTER.md` describes quotes and reservations | The router is a stub; the live route is chosen outside it (02 §3.4, §6) | STALE-DOC | MPR-002, MPR-305 |
| `docs/MODEL_CAPABILITIES.md` describes an adapter with describe, validate and quote steps and a long operation list | The contract has none of the three; five operations, two with an adapter (02 §6) | STALE-DOC | MPR-002, MPR-206 |
| The earlier registry shows item states | It lags ledger 12; `specs/CURRENT.md` lags too (02 §8) | STALE-DOC | MPR-003 |
| Export is qualified | Qualified at an old commit, one profile (`docs/evidence/qualification/t10-release.json`); the M profile is unqualified (02 §3.1, §10; `docs/evidence/ultimate/SS-005a-m-profile.md`) | UNQUALIFIED | none (SS-005b). MPR-802 records export reliability on its own briefs, which is not that qualification |
| The Blender, Cinema-model, prompt-library, Director-to-Blender and agent-access qualifiers exist | Their receipts are not committed (02 §1 item 11, §3) | UNQUALIFIED | none. MPR-804 would run in CI only the qualifiers that need no GPU |
| Revoked consent blocks a take | One pinned-take path passes revocation (`docs/evidence/ultimate/consent-gate.md`) | PARTIAL | MPR-010 |
| A Kaggle run can be stopped | The stop is not acknowledged remotely (02 §3.3); the hang fix is proven on a stand-in, not on the real CLI on Windows (`tests/kaggle-cli-stop.test.ts`) | UNQUALIFIED | none proves it. MPR-205 adds limits; MPR-206 tests only that a stop never claims more than happened |
| Director approval governs the `cinema-blender` pipeline | Approval is not checked when the take is placed (02 §3.7, §10; `core/takes.ts`, `yamakan.take.apply`) | PARTIAL | none |
| `yamakan.continuity.check`, `yamakan.identity.encode` and `yamakan.lineage.evaluate` do what their names say | The first returns an unmeasured status (`core/continuity.ts`); the second records a hash the caller supplies; the third is a stub (02 §3.2, §3.10) | PARTIAL | none. MPR-405 measures consistency separately |
| Zero spending, no unapproved egress or download, permissive licences only, secrets safe | Each holds because the code is absent, not because a gate enforces it (02 §7) | PARTIAL | MPR-204, MPR-208 |
| Human-only commands need a person | The rule is not an operating-system boundary (`docs/SECURITY.md`; `docs/evidence/qualification/q15-user-presence.json`) | PARTIAL | MPR-508 (FD-9) |

Still true and not historical (02 §5): the three flags that are `false`; release NO-GO; H1 to H5,
signing and Q15 open; every comparative benchmark NOT TESTED; providers off; spending zero. No
card opens a release gate.

## 3. Gap table by pillar

One fact per card; the cards themselves are in [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md). Only
gaps that a card addresses are listed here. Gaps with no card are in section 4 and in the "none"
rows of section 2.2.

### A. Universal model system

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| No single model catalog; several lists that can disagree | ABSENT | 02 §3.4; `core/engines/candidates.ts`; `src/create/create-model.ts` | MPR-201 | One catalog and a test that the other lists agree. Nothing a person sees changes and no model is added. |
| The capability command answers that engines are disabled; the live route is described elsewhere | PARTIAL | 02 §3.4; `yamakan.engines.capabilities`; `yamakan.generation.options` | MPR-202 | Cells say supported, unsupported or unverified. A measured cell needs a result from MPR-405. |
| The estimate is two numbers; nothing shows what will leave the computer | PARTIAL | 02 §3.3 | MPR-203 | Preflight on the stand-in route. A real-route observation needs an account, quota and FD-3; without them it is recorded BLOCKED. |
| Spending, egress and download guarantees hold only by absence of code | ABSENT | 02 §7 | MPR-204 | Approvals for route, host, account and purpose. No currency column: a money approval waits for MPR-222 and FD-5. |
| The Kaggle CLI runs uncontained and inherits proxy and certificate variables | ABSENT | 02 §3.12; `core/engines/kaggle.ts` | MPR-205 | The CLI needs the network, so it stays outside `native/procd`. Proxy and certificate names stay a disclosed exception. The host the CLI contacts cannot be restricted. The account id leaves committed metadata only with FD-10. |
| No shared conformance suite for adapters | PARTIAL | 02 §3.4; `core/engines/contract-v2.ts` | MPR-206 | Definitions and one suite. Three of the five operations still have no adapter. |
| A failed generation has no typed failure class | ABSENT | MPR-207 `currentBaseline` | MPR-207 | A class, a quota flag and a retry rule. Retry is always a new attempt started by the person. |
| The licence gate is not applied to the live recipes; notices and the AGPL source offer are not in the product | PARTIAL | 02 §3.4, §6 (`NOTICE`), §7; `core/engines/manifests.ts` | MPR-208, MPR-209 | Offered entries carry a checked licence block, and the product carries notices, a source offer and SBOM entries. No lawyer reviews licence text under these cards. No release is authorised; X-02 stays blocked. |
| No hosted provider, no credential store | ABSENT | 02 §3.4, §7 | MPR-210, MPR-211, MPR-222 | MPR-210 proves the contract against a loopback fake only. MPR-211 is DEFERRED and MPR-222 is EXTERNAL_BLOCKED, both on FD-5 and a legal review. No real provider is reachable. |
| Local generation is off: `ENGINE_ENABLED` is false and no weights are pinned. Transcription is a stub; no narration or voice | PARTIAL | 02 §3.4, §3.9, §4; `core/engines/contract.ts`; `yamakan.audio.transcribe` | MPR-220, MPR-221 | Measurements after FD-4 names the files: one still-image model on a CPU-only host, and the speech routes. The flag stays false and X-01 stays blocked. Local video generation, lip sync and music have no card. |
| The router is a stub; `ROUTER_PROVIDERS_ENABLED` is false | PARTIAL | 02 §3.4; `core/router/explain.ts` | MPR-305 | A deterministic explanation from the capability report. The flag stays false; paid and hosted routes stay off. |
### B. Fully editable productions

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| A take's lineage has no prompt, seed, model or recipe; Create writes them into a label and notes | PARTIAL | 02 §1 item 6, §3.2; `core/story.ts`; `src/create/create-story.ts` | MPR-101 | New takes carry a record. Prompt text is stored only if FD-2 is accepted; the default is hashes. Takes made earlier have no record. Records are never pruned. |
| A generation cannot target an existing shot | ABSENT | 02 §3.3 | MPR-102 | By command after MPR-102. A screen sends a target only after MPR-104. |
| No revision from a take | ABSENT | 02 §1 item 7 | MPR-103, MPR-104 | A revision is a new generation from changed inputs. It does not edit the pixels of the earlier take. It needs a route that can generate. |
| A take cannot replace a shot shown by more than one clip | ABSENT | 02 §3.2; `core/takes.ts` | MPR-105 | A clip that cannot be replaced safely is refused with a reason. |
| Brief, script and shot intent live in one browser | ABSENT | 02 §3.2; `src/create/CreateWorkspace.tsx` | MPR-106 | Stored in the story document inside its 256 KiB limit, which other cards share. |
| No answer to what was tried for a shot and what it cost | ABSENT | MPR-107 `currentBaseline` | MPR-107 | A read command, `yamakan.shot.history`. No card shows it in the browser. Totals are time and quota as reported; there is no currency. SS-016 still closes on its own qualification. |
| A revoked-consent take can return through undo, redo, placing or restore | PARTIAL | 02 §10; `docs/evidence/ultimate/consent-gate.md` | MPR-010 | Closed with a test whichever way the rule is decided. The outcome may be an accepted limit, and a rule change may need the founder. |
| Ripple delete, ripple trim, insert, group move, speed, LUT, sound unlink and relink have no control | COMMAND-ONLY | 02 §3.1, §3.9; `src/edit-ops.ts` | MPR-601, MPR-602 | Slip, slide and roll are not offered: no reducer operation exists. Loudness stays a whole-export option; the inspector only says so. |
| Loudness option, batch export, OTIO export and loss report have no control | COMMAND-ONLY | 02 §3.1, §3.14; `yamakan.export.video`, `yamakan.export.batch`, `yamakan.project.exportOtio`, `yamakan.project.otioLosses` | MPR-603 | One container and codec profile. No HDR, no other codec, no size above the present limit. |

### C. AI creative director

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| Only a smoke manifest and the `cinema-blender` manifest exist; none names production stages | PARTIAL | 02 §3.7; `core/director/stages.ts` | MPR-301 | Nine stages with approval bound to project content. Yamakan ships no language model: stage content is deterministic or supplied by the person or their agent. |
| No view of a whole production plan | COMMAND-ONLY | 02 §3.11; `yamakan.progress.read` | MPR-302 | A plan view. An agent can read it and cannot approve. |
| An agent cannot prepare timeline edits for a person to review | ABSENT | MPR-303 `currentBaseline` | MPR-303 | Proposals that expire and that the writer cannot apply. |
| MCP offers no resources or prompts | ABSENT | 02 §3.11 | MPR-304 | Fixed guidance text shipped with the product. No model runs. |
| The planner builds a fixed set of boxes, not the project's scene | ABSENT | 02 §3.7 | MPR-403 | Director renders from the stored shot setup. The card waits for the Blender stream (FD-11). |

### D. Character and world consistency

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| Reference packs exist; no model receives them | PARTIAL | 02 §3.2; `src/create/ElementsPanel.tsx` | MPR-401, MPR-402 | MPR-401 stores and shows one record per entity. MPR-402 reports, image by image, what a route will receive. Neither claims that a model keeps a character consistent. |
| Consistency is not measured | ABSENT | 02 §3.2; `core/continuity.ts` | MPR-405 | A protocol and a local rating page. A real result needs an authorised route (FD-3, FD-4 or FD-5), raters (FD-6) and, for the model-based metric, FD-4. With default answers only stand-in and already-configured routes are measured. |
| A shot's camera and render settings are per-render choices, not project state; a legacy scene store is still written | PARTIAL | 02 §3.6, §3.8; `core/scene3d.ts`; `core/cinema-store.ts`; `yamakan.scene.save` | MPR-403 | One stored camera record and one render-settings record per shot. Motion along a path and planned item motion belong to the owner's stream, not to this plan. |
| The control compiler has no consumer | COMMAND-ONLY | 02 §3.6; `yamakan.cinema.compileControls` | MPR-404 (DEFERRED) | Nothing is built until an authorised route shows a control input as supported. |

### E. Agentic production

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| The tool list is not honest: no human-only mark; `yamakan.proxy.build` and `yamakan.proxy.cancel` read as non-mutating | PARTIAL | 02 §3.11, §10; `mcp/main.ts` | MPR-501 | Truthful marks per token. An unknown tool still answers `-32602`, as today. |
| MCP ignores a client's cancellation; no progress; no event cursor | ABSENT | 02 §3.11 | MPR-501, MPR-502 | Bounded wait and a revision cursor on every surface. No new scheduler or socket server. |
| CLI and SDK are thin and cannot run under an agent token by the MCP rule | PARTIAL | 02 §3.11; `cli/main.ts`; `sdk/client.ts` | MPR-503 | The SDK `call` still drops the request id on success: no card names that finding. |
| An agent cannot ask for a human-only step | ABSENT | 02 §3.11 | MPR-504 | A browser inbox. The approve command is itself human-only, so it is exactly as strong as that rule (see the MPR-508 row). |
| No per-agent budget | ABSENT | 02 §3.11, §7 | MPR-505 | An envelope enforced at approvals and gates. The currency limit is stored and not live until MPR-222. |
| No record of which principal called which mutation; no lineage read | ABSENT | MPR-506 `currentBaseline` | MPR-506 | An activity list per agent in the browser. The lineage chain is a read command, `yamakan.provenance.trace`, with no page view. The audit table has no pruning. |
| A second Blender job is refused; a failed local job cannot be run again; the Blender worker is outside the memory budget | ABSENT | 02 §3.8; `core/jobs.ts` | MPR-507 | A queue of at most four and a linked rerun. The memory limit is measured and fitted, or the card stops and reports. Following a render after a page reload is not in the card. |
| The human-only rule is not an operating-system boundary | PARTIAL | 02 §3.12, §10; `docs/SECURITY.md` | MPR-508 | EXTERNAL_BLOCKED on FD-9. Until then nothing is built and no Q15 pass is claimed. |
| The supervised-agent measure exists only as a definition | UNQUALIFIED | MPR-805 `objective` | MPR-805 | Twenty runs of a fixed scripted agent, not of a language model. A counted verdict needs the frozen protocol of MPR-802. |

### Product experience

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| Story has no shot cards; take review sits inside a collapsed Director section | PARTIAL | 02 §3.1, §3.2; `src/director/TakeReview.tsx` | MPR-104 | Shot cards with the take stack and a revise entry in Story and Create. MPR-104 waits for the Blender pull requests that touch the same files (FD-11). |
| No first-run statement of what works on this computer; no sample project | ABSENT | MPR-604 `currentBaseline` | MPR-604 | A banner built from capability commands and a locally built sample. What the banner may say depends on FD-3 and FD-4. |
| No proof that one project survives the move between simple and advanced work | UNQUALIFIED | MPR-605 `currentBaseline` | MPR-605 | An automated journey. It is not a study with people. |
| Arabic interface strings have had no native review (H1, X-01) | UNQUALIFIED | 02 §3.9, §5 | MPR-606 | The card prepares the packet. It cannot close H1 or X-01; a native reviewer does. |
| Top-level documents are wrong in both directions; the earlier registry lags ledger 12; merged streams have no identifiers | STALE-DOC | 02 §6, §8 | MPR-002, MPR-003 | Banners and one current-state index; the documents are not rewritten. The plan is checked on every pull request. MPR-003 waits for MPR-001 and FD-1. |

### Portability

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| Generation lineage lives in a job payload, not in the project | PARTIAL | 02 §3.13 | MPR-101 | The record travels with backup and restore. Whether lineage survives today was not verified by document 02. |
| No export manifest | ABSENT | 02 §3.14 | MPR-701 | A manifest beside every video export and a provenance report, both read commands. A person who downloads only the video has no manifest; the button MPR-701 assigns to MPR-603 is not in that card (section 6, finding 8). Signed content credentials wait for X-02 and are not in the card. |
| An OTIO file read back cannot be applied | COMMAND-ONLY | 02 §3.14; `core/interchange/otio.ts`; `yamakan.project.proposeOtio` | MPR-702 | Applied through the proposal path of MPR-303. Reading the file stays a command. The card completes the remaining items of SS-015, which stays open; it is not a dependency. |

### Qualification and benchmark

| Gap | Class | Evidence | Closing card(s) | What remains open after the cards |
|---|---|---|---|---|
| Windows CI runs two test files, the typography tests and a font probe | PARTIAL | 02 §3.15; `.github/workflows/qualify.yml` | MPR-804 | EXTERNAL_BLOCKED on FD-8. Runner capacity and LFS bandwidth are [UNKNOWN]. |
| No whole-production benchmark protocol; every comparison is NOT TESTED | ABSENT | 02 §5; `core/quality/benchmark.ts`; `docs/evidence/ultimate/benchmark-protocol.json` | MPR-801, MPR-802, MPR-803 | After MPR-801 and MPR-802 every comparative outcome is still NOT TESTED. MPR-803 needs FD-6, a check of the other product's terms, and people. |

## 4. Gaps no card closes

Out of scope by founder constraint:

- A bundled language model, and Director stages driven by one (02 §3.7; `core/director-flags.ts`).
- Paid inference that Yamakan sells or requires. A hosted Yamakan service, account or credit
  wallet (document 00). Live editing by several people at once; document 06 says none is planned.

Waiting for a founder decision. The card exists and cannot finish without it:

- A real hosted provider and the key store: MPR-222 and MPR-211, FD-5 with a completed legal review.
- Local weights for image, captions and voice: MPR-220 and MPR-221, FD-4.
- The Kaggle route as a product feature and not a founder-only experiment: FD-3.
- Operating-system user presence for human-only commands: MPR-508, FD-9.
- The competitor arm of the benchmark and its raters: MPR-803, FD-6. Publication: FD-7.
- The full test suite on Windows CI: MPR-804, FD-8.
- Removal of the personal account id from committed notebook metadata: part of MPR-205, FD-10.
- Prompt text inside the take record and the export manifest option that carries it: FD-2.

Blocked by hardware, or by people outside engineering:

- The founder host has no discrete GPU, 16 GiB of memory and little free disk. Local video
  generation has no card. MPR-404 needs an authorised control-capable route first. The M export
  profile misses its time limit; SS-005b stays open and no card of this plan qualifies it.
- Native Arabic review (X-01, gate H1). Signing and release decisions (X-02).

Deliberately rejected ([06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md](06_PRODUCT_EXPERIENCE_AND_JOURNEYS.md)
section 7; [01_COMPETITIVE_CAPABILITY_MATRIX.md](01_COMPETITIVE_CAPABILITY_MATRIX.md) section 5):

- A node canvas as a second project structure. A chat box that edits the project with a bundled
  model. A simple mode and an expert mode stored in the project. A credit balance or wallet.
- Controls that imply edits inside flattened generated pixels. A consistency badge without a number.
- Competing on raw model quality, model count, cloud scale, mobile templates, real-time
  generation, or full editing and colour depth.

Left for later, with no card:

- Editing: slip, slide and roll; keyframes beyond opacity and volume (02 §3.1;
  `core/render/animation-filters.ts`); titles with style.
- Output: EDL, FCPXML, AAF (02 §3.14); HDR, other codecs, larger sizes; signed content credentials.
- Generation: lip sync, music and restoration; a remote stop for a Kaggle run.
- Studio editing tools and the use of Studio output elsewhere: not verified by 02 §3.5, no card.
- Pruning or retention rules for take records and the audit table (MPR-101 and MPR-506 `risks`).
- Ledger-12 findings no card names (02 §10): `cinema-blender` approval at placing; the SDK `call`
  request id; the MCP unknown-tool code; a media worker read near 3 GiB against a 2 GiB limit,
  where MPR-507 measures the Blender worker only; following a Blender render after a page reload
  (`src/cinema/BlenderRender.tsx`; section 6, finding 10).
- Committed receipts for the five qualifiers named in section 2.2.
- The three flags stay false. `JASSUB_ENABLED` in `core/preview/jassub-flags.ts` is named by no card.

Command-only after every card. Each was checked against all 56 cards:

| Feature | Command | Why it is still command-only |
|---|---|---|
| Scene-cut analysis | `yamakan.analysis.sceneCuts` | No card mentions the command. |
| Tracking and match-move | `yamakan.blender.track`, `yamakan.track.read` | No card adds a control (02 §3.8; `core/blender/track.ts`). The owner's stream names it as a next step. MPR-403 stores the aerial view as a field of the shot's camera only. |
| Take comparison | `yamakan.take.compare` | Named only by MPR-103, as a command step. MPR-104 opens the existing take review from a shot card. A side-by-side view stays with SS-011. |
| Continuity check, quality lab | `yamakan.continuity.check`, `yamakan.quality.compare`, `yamakan.quality.capability` | No card calls them from a screen (02 §3.2, §3.10). MPR-401 reports continuity problem codes in `yamakan.entity.list`. MPR-405 adds a separate study page. |
| Hand-off report, control compiler, OTIO read-back | `yamakan.handoff.read`, `yamakan.cinema.compileControls`, `yamakan.project.proposeOtio` | In that order: MPR-304 exposes the report to agents over MCP only (02 §3.11; `core/handoff.ts`); MPR-404 is DEFERRED; MPR-702 changes no browser file. |
| New read commands of the cards | `yamakan.shot.history` (MPR-107); `yamakan.export.manifest`, `yamakan.export.provenanceReport` (MPR-701); `yamakan.provenance.trace` (MPR-506) | MPR-107 and MPR-701 change no browser file. No other card names the history command, and the export panel of MPR-603 does not name the manifest. The browser part of MPR-506 is the activity list only. |

Twenty-one registered commands are both unnamed under `src/` and unnamed by any card. Most belong
to captions, clip effects, transitions, Studio and asset repair, which the browser reaches under
other operation names or routes. Whether each has a control was not verified.

## 5. Dependency analysis

All lists come from `dependsOn` in the registry. The same order by lane is in
[08_ROADMAP.md](08_ROADMAP.md).

### 5.1 Cards with no card dependency

Seventeen cards depend on no other card.

- Stage 0: MPR-001 (waits for FD-1), MPR-002, MPR-010, MPR-804 (waits for FD-8).
- Stage 1: MPR-101, MPR-105 (depends on SS-006, which is verified).
- Stage 2: MPR-201, MPR-204, MPR-207, MPR-303 (depends on SS-006), MPR-501, MPR-507.
- Stage 3: MPR-601, MPR-603, MPR-604, MPR-605.
- Stages 4 and 5: none. Stage 6: MPR-508 (waits for FD-9).

Five of the seventeen list a founder decision: MPR-001, MPR-101 (FD-2), MPR-604 (FD-3, FD-4),
MPR-804 and MPR-508. The other twelve list none. All seventeen still wait for adoption (FD-1) by
the note on that decision; see section 6, finding 9.

### 5.2 Dependency chains

Each line reads "card: what it depends on".

- Stage 0. MPR-003: MPR-001.
- Stage 1. MPR-102: MPR-101. MPR-103: MPR-101, MPR-102. MPR-104: MPR-102, MPR-103, SS-006.
  MPR-105: SS-006. MPR-106: MPR-101. MPR-107: MPR-101, MPR-102.
- Stage 2. MPR-202: MPR-201. MPR-203: MPR-201, MPR-202, MPR-204, MPR-205, MPR-207.
  MPR-205: MPR-204, MPR-207. MPR-206: MPR-201. MPR-208: MPR-201. MPR-209: MPR-208.
  MPR-210: MPR-203, MPR-204, MPR-206, MPR-207. MPR-303: SS-006. MPR-305: MPR-202. MPR-502: MPR-501.
  MPR-503: MPR-501. MPR-504: MPR-501. MPR-505: MPR-504, MPR-203, MPR-204, MPR-507.
  MPR-506: MPR-502, MPR-101.
- Stage 3. MPR-301: MPR-106, MPR-303, MPR-305, MPR-701. MPR-302: MPR-301. MPR-304: MPR-301, MPR-202,
  MPR-501. MPR-602: MPR-601. MPR-606: MPR-601, MPR-602, MPR-603, MPR-604.
  MPR-701: MPR-101, MPR-201. MPR-702: MPR-101, MPR-303, MPR-701.
- Stage 4. MPR-401: MPR-101. MPR-402: MPR-101, MPR-102, MPR-103, MPR-202, MPR-203, MPR-401.
  MPR-403: MPR-101, MPR-106. MPR-404: MPR-202, MPR-203, MPR-204, MPR-206, MPR-403, MPR-507.
  MPR-405: MPR-201, MPR-202, MPR-401, MPR-402.
- Stage 5. MPR-801: MPR-101, MPR-107. MPR-802: MPR-801, MPR-107, MPR-701.
  MPR-803: MPR-801, MPR-802, MPR-405.
  MPR-805: MPR-801, MPR-802, MPR-502, MPR-503, MPR-504, MPR-505, MPR-506.
- Stage 6. MPR-211: MPR-201, MPR-210. MPR-220 and MPR-221: MPR-201, MPR-204, MPR-206, MPR-208.
  MPR-222: MPR-201, MPR-204, MPR-208, MPR-210, MPR-211.

The cards most others wait for, as direct and then transitive dependents: MPR-201 (10, 23),
MPR-101 (11, 20), MPR-202 (6, 14), MPR-204 (8, 13), MPR-207 (3, 11), MPR-205 (1, 10),
MPR-102 (4, 9), MPR-203 (4, 9), MPR-501 (4, 7), MPR-701 (3, 7). Nineteen cards have no dependents.

The longest chain in the programme is six cards. There are nine such chains:

1. MPR-201, MPR-202, MPR-203, MPR-210, MPR-211, MPR-222.
2. MPR-207, MPR-205, MPR-203, MPR-210, MPR-211, MPR-222.
3. MPR-204, MPR-205, MPR-203, MPR-210, MPR-211, MPR-222.
4. MPR-101, MPR-102, MPR-107, MPR-801, MPR-802, MPR-803.
5. MPR-201, MPR-202, MPR-203, MPR-402, MPR-405, MPR-803.
6. MPR-207, MPR-205, MPR-203, MPR-402, MPR-405, MPR-803.
7. MPR-204, MPR-205, MPR-203, MPR-402, MPR-405, MPR-803.
8. MPR-101, MPR-102, MPR-103, MPR-402, MPR-405, MPR-803.
9. MPR-101, MPR-102, MPR-107, MPR-801, MPR-802, MPR-805.

Eight of the nine end at a card that is EXTERNAL_BLOCKED (MPR-222 on FD-5, MPR-803 on FD-6), so
the engineering path there is shorter than the chain. The ninth ends at MPR-805, which is
WAITING_DEPENDENCIES and not externally blocked, so six cards in sequence is the longest
engineering path. No chain that ends before Stage 5 is longer than five cards; Stage 1 alone needs
four.

### 5.3 The Stage 1 critical path

The critical path is MPR-101, MPR-102, MPR-103, MPR-104. The other three cards hang off it.

| Point | What a person can do |
|---|---|
| Baseline | Make a video in Create on the Kaggle route. It becomes a new shot in a story made for Create. Seed, steps and model are text in the take's label. |
| After MPR-101 | Every new take carries a record of how it was made, readable by command. No screen shows it yet. |
| After MPR-102 | Start a generation for an existing shot and bring the result into that shot's take stack, by command. No screen sends a target yet. |
| After MPR-103 | Get a take's request back as a draft, change one field and generate a new take whose record names its origin, by command. |
| After MPR-104 | Do all of the above in the browser: shot cards with take stacks and record facts, and a revise entry in Story and Create, placed through the existing take review. |
| Off the path | MPR-105, at any time: replace the take of a shot whose clip was split or trimmed, in the take review. MPR-106, after MPR-101: keep brief, script and shot intent in the project and find them in another browser. MPR-107, after MPR-102: read a shot's history and totals by command; no card adds a screen for it. |

MPR-104 also needs the in-flight Blender pull requests that touch `src/create/` and `src/main.tsx`
to merge first. That ordering is FD-11 and is in the card's text, not in `dependsOn`.

### 5.4 Cross-stage dependencies

Fifty-two edges stay inside one stage. Forty-nine point to an earlier stage: one from Stage 2 (to
Stage 1); nine from Stage 3 (three to Stage 1, six to Stage 2); fifteen from Stage 4 (six to
Stage 1, nine to Stage 2); ten from Stage 5 (three, five, one and one to Stages 1 to 4); fourteen
from Stage 6 (all to Stage 2). Three more go to SS-006 (section 5.5), which makes 104 in all.
None points to a later stage, so no dependency forces a
reordering of the stages. The edges are the lines of section 5.2.

The one edge from Stage 2 to Stage 1 is MPR-506 needing MPR-101; only part b of MPR-506 waits.
MPR-801 can start when Stage 1 ends. Stage 2 and Stage 3 share no edge that blocks a whole lane,
so they can interleave. MPR-701 is in Stage 3 and three cards wait for it, so it is worth
building as soon as MPR-101 and MPR-201 exist. Stage 6 is gated by decisions, not by position:
every engineering dependency of its cards is in Stage 2, apart from MPR-222 needing MPR-211.

### 5.5 Dependencies on the earlier plan

One earlier item appears in `dependsOn`. SS-006 is VERIFIED; MPR-104, MPR-105 and MPR-303 depend
on it and the dependency is met. SS-015 is QUALIFICATION_READY; MPR-702 completes its remaining
items and lists it under `legacy`, not as a dependency, so SS-015 stays open and closes on its own
qualification. States here are those of the earlier registry, which lags ledger 12.

The wider reconciliation is item by item in
[LEGACY_RECONCILIATION_ADDENDUM.json](LEGACY_RECONCILIATION_ADDENDUM.json). Every earlier item
keeps its id, state and disposition. A related card builds on an item; it does not close it. Of
the 31 items of the earlier programme, eighteen have related cards:

- VERIFIED: SS-003 (MPR-301, MPR-302); SS-006 (MPR-103, MPR-104, MPR-105, MPR-301, MPR-303);
  R-01 (MPR-601 to MPR-606); R-02 (MPR-210, MPR-222); R-03 (MPR-603).
- QUALIFICATION_READY: SS-007 (MPR-203, MPR-204, MPR-206, MPR-501 to MPR-504); SS-012 (MPR-602,
  MPR-603); SS-013 (MPR-221, MPR-606); SS-014 (MPR-601); SS-015 (MPR-303, MPR-603, MPR-702);
  SS-017 (MPR-209).
- WAITING_DEPENDENCIES: SS-008 (MPR-207, MPR-805); SS-011 (MPR-104, MPR-304); SS-016 (MPR-107,
  MPR-801, MPR-802); SS-019 (MPR-001, MPR-002, MPR-209).
- EXTERNAL_BLOCKED: X-01 (MPR-221, MPR-606); X-02 (MPR-209); X-03 (MPR-208, MPR-210, MPR-211,
  MPR-220, MPR-221, MPR-222).

Thirteen have none: SS-001, SS-002, SS-004a, SS-005a, R-04 and R-05 (VERIFIED); SS-004 and SS-005
(AGGREGATE); SS-005b and SS-009 (QUALIFICATION_READY); SS-004b, SS-010 and SS-018
(WAITING_DEPENDENCIES). The 44 items of the plan before that one (YU-000 to YU-101) also keep
their dispositions. Twenty-three stand unchanged. Twenty-one stand and name 25 cards of this
revision as work that extends them.

### 5.6 Dependencies outside engineering

Founder decisions, as stated in [FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md).
"Waits behind" is computed through `dependsOn`.

| Decision | Cards that list it | Cards that wait behind those | What the wait really is |
|---|---|---|---|
| FD-1 | MPR-001 | MPR-003 | By the decision's note, every other card starts only after it. |
| FD-2 | MPR-101, MPR-103, MPR-701 | 18 more through MPR-101 | Not a block. MPR-101 proceeds with hashes only if FD-2 is declined. Only the prompt-text option waits. |
| FD-3 | MPR-404, MPR-405, MPR-604, MPR-801, MPR-802, MPR-803 | MPR-606, MPR-805 | Changes what those cards deliver. Real-route observations are recorded BLOCKED without it. |
| FD-4 | MPR-220, MPR-221, MPR-404, MPR-405, MPR-604 | MPR-606, MPR-803 | Blocks MPR-220 and MPR-221 outright. Narrows the others. |
| FD-5 | MPR-211, MPR-222, MPR-404, MPR-405 | MPR-803 | Blocks MPR-211 and MPR-222 outright, with a completed legal review. |
| FD-6 | MPR-405, MPR-801, MPR-803 | MPR-802, MPR-805 | Blocks the competitor arm (MPR-803) and the raters of MPR-405. |
| FD-7 | MPR-801, MPR-803 | MPR-802, MPR-805 | Gates publication outside the repository only. |
| FD-8, FD-9 | MPR-804 lists FD-8; MPR-508 lists FD-9 | none | Each blocks its one card. |
| FD-10 | MPR-205 | MPR-203, MPR-210, MPR-211, MPR-222, MPR-402, MPR-404, MPR-405, MPR-505, MPR-803, MPR-805 | Only the second part of MPR-205 waits; the cards behind it need the first part. |
| FD-11 | none | none | Orders every card. Named in the text of MPR-104 and MPR-403. |

External blockers of the earlier plan, all still EXTERNAL_BLOCKED. X-01 is a native Arabic
reviewer: MPR-606 prepares the packet and MPR-221 the speech route, and neither signs the review.
X-02 is release, profile and signing: MPR-209 adds the notices a release would need, and signed
content credentials for MPR-701 wait here. X-03 is authorisation of models: MPR-208, MPR-210,
MPR-211, MPR-220, MPR-221 and MPR-222 are the gated path to it, each behind its own decision.

People and accounts the cards need:

- A native Arabic reviewer (MPR-606, MPR-221). A lawyer for the provider terms (MPR-222) and a
  reader of the other product's terms (MPR-803).
- Volunteer raters (MPR-405; five or seven for MPR-803), with operators, an observer and a
  reviewer for MPR-803. A reviewer who decides whether the rule change in MPR-010 needs the founder.
- A person present with Windows Hello (MPR-508). A second Windows account (MPR-211).
- A Kaggle account and quota for any real-route observation; a provider account and key
  (MPR-222); hosted Windows runners (MPR-804); free disk (MPR-220, MPR-221). The limits are in
  [12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md).

### 5.7 Shared-file contention

Built from the cards' `targets`. The handling rules are in
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md).

Workspace schema steps. Five cards add a step and each takes the next free number at merge:
MPR-204, MPR-504, MPR-505, MPR-506, MPR-507. MPR-303 adds one only if its new token column
turns out to need a version step. All six are Stage 2 cards. `dependsOn` fixes the order of
MPR-505 only (after MPR-204, MPR-504 and MPR-507). The order among the others is set by hand:
MPR-204, MPR-507, MPR-303, MPR-504, MPR-505, MPR-506, with one schema step in review at a time.
Section 5.1 of [OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md) is the authority
for that order. MPR-222 adds one more step, for a money cap on a spend approval, in Stage 6 after
FD-5. Two more are recorded only as alternatives: a records table in MPR-101 and a replacements
table in MPR-107. The schema version has already moved from 15 to 18
(02 §9), so no card may hard-code a number.

Story document format. Four cards change it.

| Card | Change | Order fixed by `dependsOn` |
|---|---|---|
| MPR-101 | Version 1 to 2: the record hash, and the fields of MPR-106 as schema only; adds the list of readable versions | first |
| MPR-106 | Uses the version 2 fields if MPR-101 shipped them, otherwise one more version | after MPR-101 |
| MPR-402 | One more version for the entity variant | after MPR-101; not ordered against MPR-106 or MPR-403 |
| MPR-403 | One more version for the shot setup | after MPR-101 and MPR-106; not ordered against MPR-402 |

MPR-402 and MPR-403 are both Stage 4, neither depends on the other, both raise the same version
and both add to the 256 KiB story limit. Other format moves are isolated: the reference-pack
format (MPR-401), the take-proposal format (MPR-105), the derived plan snapshot (MPR-302), and
four new document kinds (MPR-101, MPR-107, MPR-303, MPR-405).

Files the implementation owner is changing. Commit counts are from the Blender stream (02 §9).

| Path | Commits in the stream | Cards that target it |
|---|---|---|
| `core/command/registry.ts` | 13 | 38: MPR-101, 102, 103, 105, 107, 202, 203, 204, 205, 207, 208, 209, 211, 220, 221, 222, 301, 302, 303, 304, 305, 401, 402, 403, 404, 405, 501, 502, 504, 505, 506, 507, 508, 601, 604, 701, 702, 802 |
| `src/main.tsx` | 11 | 18: MPR-101, 104, 106, 202, 203, 204, 207, 209, 302, 303, 405, 504, 601, 602, 603, 604, 605, 606 |
| `core/jobs.ts` | 10 | 11: MPR-101, 102, 107, 203, 205, 405, 502, 505, 507, 604, 701 |
| `core/director/` | 9 | 7: MPR-101, 204, 301, 302, 403, 504, 507 |
| `core/blender/` | 14 | 3: MPR-403, 404, 701 |
| `src/cinema/` | 10 | 2: MPR-403, 507 |
| `core/cinema/`; `scripts/blender/` | 9; 14 | 1 each: MPR-404 |
| `tests/blender-render.test.ts` | 22 | 4: MPR-101, 404, 507, 804 |
| `docs/OPERATIONAL_CONTRACTS.md` | 28 | 9: MPR-010, 401, 402, 403, 404, 405, 502, 506, 507 |
| `src/create/` | 5 | 13: MPR-101, 104, 106, 201, 203, 204, 205, 207, 208, 209, 222, 401, 402 |
| `src/director/` | 5 | 6: MPR-101, 104, 105, 202, 302, 403 |
| `docs/provenance/import-policy.json` | 5 | 11: MPR-201, 202, 203, 207, 208, 210, 211, 220, 222, 301, 304 |

The registry file and `src/main.tsx` are touched by most cards and by the owner, so every card
rebases on live `main` and reads them again at its first step. MPR-403, MPR-404 and MPR-507
reach deepest into the owner's stream. MPR-404 is DEFERRED and MPR-403 waits for the stream by
its own text. MPR-507 changes `core/jobs.ts` and `src/cinema/` with no such wait; its first part
is a measurement and can run early, but its queue should be scheduled with the owner.

Files the owner's stream did not touch, where the cards collide with each other instead:
`core/engines/generation.ts` (13 cards), `core/store.ts` (11), `core/engines/kaggle.ts` (9),
`core/story.ts` (8), `server/main.ts` (9), `core/takes.ts` (6), `core/documents.ts` (5),
`src/agent-access.tsx` (5), `src/i18n.ts` (29).

## 6. Dependency check results

What was checked: every `dependsOn` id exists; there is no cycle; no card depends on a later
stage; each founder decision's card list in the registry header matches the cards' own fields;
every mention of another card, and of a command another card proposes, inside a card's text was
compared with that card's dependency closure. The package check in `tools/validate-addendum.mjs`
covers the first three.

Findings as first recorded, before the cards were corrected. None blocked Stage 1. The last column
gives what was done; the cards and documents named now carry the corrected text.

| # | Card and field | What looks missing or wrong | Evidence | Result |
|---|---|---|---|---|
| 1 | MPR-404 `dependsOn` | Omits MPR-204 and MPR-203. The card's trigger needs a route that passes the MPR-204 gates, and its preflight step is MPR-203. It also relies on the MPR-507 queue. The card is DEFERRED, so the effect comes only when it is revived. | MPR-404 `interfaces[0]`, `interfaces[6]`, `performanceCriteria[1]` | Fixed: MPR-404 now lists MPR-203, MPR-204 and MPR-507. |
| 2 | MPR-805 `dependsOn` | Omits MPR-802. A counted verdict needs the frozen protocol of MPR-802 part a, and the card reuses `scripts/host-quiet.mjs`, a new file of MPR-802. The card says it can run as a pilot without it. | MPR-805 `blockingExternalRequirements[0]`, `interfaces[5]`, `sourceReuse[3]` | Fixed: MPR-805 now lists MPR-802. |
| 3 | MPR-402 `interfaces[1]` | Describes the story version as the one after MPR-101 and MPR-106. MPR-106 is not in MPR-402's dependencies or their closure. MPR-402 and MPR-403 raise the same version with no order between them. | MPR-402 `dependsOn`; section 5.7 | Fixed in the text: MPR-101 defines version 2 with the MPR-106 fields, and whichever of MPR-402 and MPR-403 merges second takes the next number. That order is still kept by hand. |
| 4 | MPR-801 `e2eQualification[1]` | Covers the case that MPR-107 has not landed. MPR-107 is in the card's own `dependsOn`, so the case cannot arise. One of the two is wrong. | MPR-801 `dependsOn` | Fixed: the sentence now says MPR-107 is a dependency and the history is exercised here. |
| 5 | MPR-801 `compatibilityRequirements[5]` | Places the binomial test of MPR-405 in `core/quality/consistency.ts`. MPR-405 places the one shared test in `core/quality/benchmark.ts`. MPR-405's text is the consistent one. | MPR-405 `compatibilityRequirements[4]`, `implementationSequence[1]` | Fixed: both cards now name `signTestTwoSided` in `core/quality/benchmark.ts`. |
| 6 | MPR-401 `interfaces[4]`, `implementationSequence[1]` | Calls the list of readable document versions new and tells the builder to check whether MPR-101 added it. MPR-101 is a dependency and adds it. Minor. | MPR-101 `interfaces[4]` | Fixed: MPR-401 reuses the list that MPR-101 adds. |
| 7 | MPR-205 `interfaces[3]` | States, without a condition, that the version call runs under the egress gate of MPR-204. MPR-204 is not a dependency; elsewhere the card says "if that card has merged". | MPR-205 `interfaces[2]`, `dependsOn` | Fixed: MPR-205 now depends on MPR-204. |
| 8 | MPR-701 `risks[3]` | Says the button that saves the video and its manifest together belongs to MPR-603. MPR-603 names neither MPR-701 nor a manifest. Either MPR-603 gains the button, with a rule for when MPR-701 has not merged, or the sentence goes and the manifest stays a read command. | MPR-603 (no such text in any field) | Fixed: MPR-603 adds the link `export-manifest-save` once MPR-701 is on main; whichever of the two merges second adds it. |
| 9 | Registry header, FD-1 note | Says every other card starts only after MPR-001. Only MPR-003 lists MPR-001 in `dependsOn`, so fourteen cards read as ready. The rule is real but lives outside the dependency data. The same is true of FD-11, which appears only in the text of MPR-104 and MPR-403. | header `founderDecisions`; section 5.1 | Fixed: the FD-1 and FD-11 notes now say the rule is carried by the meaning of the states and the order of work, not by a dependency on each card. |
| 10 | Document 02 §3.8 and §11 item 3 | §3.8 assigns following a render after a page reload to MPR-507. The card's text covers the queue, position, cancel and rerun, and nothing about the page's own list; document 06 section 2.4 states it correctly. §11 item 3 lists match-move among the features that get controls from MPR-601 to MPR-603, SS-011 and MPR-104. None of those adds a match-move control. | MPR-507 `objective`, `interfaces`; section 4 | Fixed in document 02: no card plans re-follow after a reload, and match-move stays a command. |
| 11 | Document 12 section 10 | The Stage 2 row names MPR-211 and MPR-222, which are Stage 6 cards. The Stage 3 row says no new decision, while MPR-604 lists FD-3 and FD-4 and MPR-701 lists FD-2. Those decisions shape the cards and do not block them. | registry `stage`, `founderDecisions` | Fixed in document 12. |

Soft references. The cards name another card that is outside their dependency closure, and that
does not depend on them, 77 times when this check was run, before the cards were corrected. Each was read. Apart from
findings 1, 2, 3, 5, 7 and 8, every one is a stated boundary or a pointer to the card that owns a limit; a conditional reuse in which
the card gives both branches (for example MPR-103 with MPR-201, MPR-107 with MPR-103 and MPR-105,
MPR-504 with MPR-203, MPR-204 and MPR-211, MPR-506 with MPR-504 and MPR-505); or the Arabic
string freeze of MPR-606. MPR-302, MPR-303, MPR-305, MPR-504 and MPR-506 add interface text and
say it lands before the freeze or follows its change rule. MPR-606 depends only on MPR-601 to
MPR-604, so that order is kept by hand, like the schema-step order of section 5.7.

Seven pieces are shared by two cards under a "whichever merges first" rule, with no order in the
data: the ledger end-time field (MPR-101, MPR-207); one conformance check in
`tests/fixtures/engine-conformance.ts` (MPR-206, MPR-207); the lineage resolver (MPR-506,
MPR-701); the canonical project hash (MPR-303 with MPR-701 or MPR-101); the binomial test
(MPR-405, MPR-801); the route switch for qualification (MPR-220, MPR-221); the public read of the
workspace epoch (MPR-502, MPR-504). Each needs the second card to re-read `main` first.

See also [05_TARGET_ARCHITECTURE.md](05_TARGET_ARCHITECTURE.md) for the shape the cards build
towards, [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) for what the benchmark
cards may claim, and [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md) for the rejected ideas.
