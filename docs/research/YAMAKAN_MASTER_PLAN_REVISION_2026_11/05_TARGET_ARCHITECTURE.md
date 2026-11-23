# Target architecture

> Status: ADOPTED — the current frontier by founder instruction. Each card stays gated by its state and founder decisions.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

## 1. What this document is

This document describes the system as it would stand once the 56 cards of
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md) are built. The target is today's architecture, as assessed
in [02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md), plus the
additions listed below. Nothing is replaced. There is still exactly one project store, one job
supervisor, one command registry, one permission model and one canonical project and timeline.
Every name and figure here comes from a card in
[TASK_REGISTRY_ADDENDUM.json](TASK_REGISTRY_ADDENDUM.json). The cards are the truth. Where the cards
leave something open, this document says so and names the card; it designs nothing of its own.
Cards that are DEFERRED or EXTERNAL_BLOCKED (MPR-211, MPR-220, MPR-221, MPR-222, MPR-404, MPR-508)
belong to the target only if their founder decisions allow them.

## 2. Invariants that do not change

| Invariant | Owner on main today | What the cards do |
|---|---|---|
| One project store | `core/store.ts` (`ProjectStore`, one SQLite workspace at `WORKSPACE_SCHEMA_VERSION` 18); one service per workspace by `core/service-lock.ts` | Add tables and columns by additive version steps (section 8.3). No second database. One stated exception outside SQLite: the credential files of MPR-211 (section 9). |
| One job supervisor on one serial pump | `core/jobs.ts` (`JobSupervisor`, `BLENDER_RENDERS_AT_ONCE = 1`); legal transitions in `core/jobs/rules/yamakan-transitions.ts`; worker processes through `core/process/owner.ts` | Add two job kinds (section 8.4). MPR-507 changes Blender admission from refuse to a bounded waiting line on the same pump. No second scheduler. |
| One typed command registry | `core/command/registry.ts` (116 commands; `execute` and `authorize` live there); fourteen error codes in `core/command/errors.ts` | Add 41 commands (section 8.6) and widen some inputs and outputs (section 8.5). No card names a new error code; new refusals reuse the fourteen and add reason codes. |
| Scopes and the human-only rule | `authorize` in `core/command/registry.ts`; agent tokens in `core/agents.ts`; eleven scopes and 13 human-only commands on main | Every new command uses an existing scope. Ten new commands are human-only. No card removes the mark from a command. MPR-504 adds the one path by which a person approves a named agent request for four human-only generation commands. |
| One canonical project and timeline format | `core/canonical.ts`, `core/project.ts`; documents in `core/document-ref.ts` and `core/documents.ts` | No card moves the canonical project format version. Document formats step forward (section 8.1) and four document kinds join the closed `DocumentKind` list. |
| Loopback only | `server/main.ts` (listens on 127.0.0.1 and checks the Host header); routes in `server/api.ts` | No card opens another listener. Outbound calls leave from the service only, behind the gates of MPR-204. The browser content policy stays `connect-src 'self'` (MPR-222). |
| Models and providers off until a recorded gate approval | `ENGINE_ENABLED = false` in `core/engines/contract.ts`; `ROUTER_PROVIDERS_ENABLED = false` in `core/router/explain.ts` | Both stay false under the common contract. MPR-210 adds `PROVIDER_PROFILE_ENABLED = false`. MPR-204 adds the approval record. Its download gate always refuses. |
| Frozen resource policy | `RESOURCE_POLICY` (`yamakan.resource-policy/v3`) in `core/command/policy.ts`, pinned by `tests/resource-policy.test.ts`; `ENGINE_WORKER_PROFILE` in `core/process/owner.ts` | Not edited. New limits are module constants in their own files (MPR-502, MPR-504, MPR-507). |
| Frozen qualification policy | `core/qualification-policy.ts` (`yamakan.qualification-policy/v1`) | Not edited. |
| One surface for every client | `tests/parity.test.ts` runs the same calls over REST (through the SDK client) and over MCP against one service and requires the same results | Kept. Each new command is registered once and reaches REST, SDK, CLI and MCP through the registry. |
| Third-party provenance | `docs/provenance/import-policy.json` | Kept. New files under donor roots are declared there (section 10). |

The layers, top to bottom, with what is added to each:

1. Clients: browser page, SDK, CLI, MCP server. Added: shot cards and the revise banner (MPR-104),
   the production plan (MPR-302), proposal review (MPR-303), the approval inbox (MPR-504), first run
   (MPR-604), the about panel (MPR-209), MCP prompts and resources (MPR-304), CLI `wait`, `help` and
   `import` (MPR-502, MPR-503).
2. Loopback HTTP service. Unchanged.
3. Command registry: parse, authorise, execute. Added: 41 commands, the propose-only mode
   (MPR-303), approved requests (MPR-504), budgets (MPR-505), the audit write (MPR-506) and, in
   Stage 6, the presence check (MPR-508). All of these sit inside `authorize` or `execute`.
4. Domain modules under `core`. Added: take records, shot history, gates, proposals, entities, shot
   setup, export manifest and the modules named in sections 3 to 7.
5. Project store and content-addressed storage. Added: up to six additive schema steps and four
   document kinds.
6. Job supervisor, one serial pump. Added: two job kinds and the Blender waiting line.
7. Worker processes under the native process owner (FFmpeg, Blender). Added in Stage 6 only: a
   vault helper (MPR-211) and a presence helper (MPR-508).
8. Generation adapters behind the engine contract. Added: catalogue, capability report, preflight,
   gates, failure classes and the licence gate. Stage 6 only: local image, local speech and the
   first hosted provider.

## 3. The revisable shot (Pillar B)

Stage 1 (MPR-101 to MPR-107) turns a take from an asset reference into an object with a record.

| Object | What it is | Where it lives | Who may write it | Card |
|---|---|---|---|---|
| Shot | An entry in the story document (`ShotSchema` in `core/story.ts`) | Document kind `story`; one project document reference | Any principal with `project:write`, through `yamakan.story.save` | On main; fields added by MPR-101, MPR-106, MPR-402, MPR-403 |
| Take | An entry on a shot that names an asset. `TakeSchema` gains optional `recordHash` | Inside the story document | `yamakan.story.save`; the service appends a generated take at import (`appendGeneratedTake` in `core/takes.ts`) | MPR-101, MPR-102 |
| Take record | Immutable, content-addressed document of kind `takeRecord` (format `yamakan.take-record`, version 1, at most 40,960 canonical bytes). Origin is `generation`, `render` or `declared` | One `creative_documents` row per record, held by a `story_document_versions` row written in the same transaction as the story. Not a project document reference | The service only. A caller supplies `{jobId}` or `{declared}` and the service builds the record (`core/take-record.ts`). `yamakan.document.commit` refuses the kind | MPR-101 |
| Derived-from chain | `derivedFromTakeId`, `derivedFromRecordHash` and `changedFields` inside the record; `derivedFrom` on the generation ledger row | Inside the take record and the existing ledger row (no new column) | The service. It computes the changed fields itself when `yamakan.generation.start` carries `derivedFromTakeId` | MPR-101, MPR-103 |
| Generation ledger row | The existing `GenerationRecord` of `core/engines/generation.ts` gains `target`, `take`, `derivedFrom` | The existing ledger; no schema step | The service | MPR-102, MPR-103 |
| Replacement record | Immutable document of kind `takeReplacement` (format `yamakan.take-replacement`, version 1, at most 512 bytes) naming shot, old take, new take, clips, revision and principal | Held through a `story_document_versions` row, the way take records are held | Only the apply path of `yamakan.take.apply`, in the same transaction as the timeline change | MPR-107 |
| Take proposal, format 2 | A derived answer with 1 to 64 clip mappings. Not stored | Returned by `yamakan.take.proposeReplace`; consumed by `yamakan.take.apply` as one batch | Nobody; it is computed | MPR-105 |
| Revision draft | A derived read: the base record, a draft request and whether it can start | Not stored; `yamakan.take.revisionDraft` | Nobody | MPR-103 |
| Shot history | A derived read built from take records, replacement records and job attempt rows (`core/shot-history.ts`). It reports `gaps` for attempts made before these cards | Not stored; `yamakan.shot.history` | Nobody | MPR-107 |

How the objects map to the editability ladder of
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md):

| Level | Object in this architecture | Revision path | Card |
|---|---|---|---|
| L0 Flattened pixels | A clip on the canonical timeline that points at an asset. A take with no record, or with a `declared` record, is at this level | Timeline operations only: trim, split, move, speed, transform, crop, LUT, keys, replace | Built |
| L1 Regenerable | A take with a `generation` record and its derived-from chain | Change fields in a revision draft, start a new generation, compare, replace across the timeline, read the history | MPR-101, MPR-102, MPR-103, MPR-104, MPR-105, MPR-107 |
| L2 Deterministic layers | Titles, captions, colour, transitions, transforms and sound levels stored in the project and re-rendered by owned FFmpeg at export | Edit the stored values | Built; controls in MPR-601, MPR-602, MPR-603 |
| L3 Structured scene | A shot's stored `setup` (scene, camera, render) and a take record of origin `render` | Change the numbers and render again in Blender | MPR-403 (record by MPR-101) |
| L4 Hybrid | Control passes from a Blender render used as inputs to a generative route | Not available: no route on main accepts control inputs | MPR-404, DEFERRED |

What a revision draft can offer depends on the record's origin (MPR-103): `generation` gives a full
draft; `declared` (a receipt file) gives only the fields the receipt holds and is marked incomplete;
`render` gives no draft, because a rendered shot is revised through its setup.

What stays flattened pixels, stated plainly:

- Everything inside the frame of a generated or imported clip: subject, camera, light. Source
  models do not supply layers, and no card claims to recover layers, relight a clip or move its
  camera after the fact.
- A clip with cuts baked into it is one L0 object.
- Audio that a model generated with the picture is one mixed asset.
- A revision at L1 is a new sample, not an edit. The same seed need not give the same frames on a
  different route.
- A take made before MPR-101 has no record. The history shows a gap; nothing is reconstructed.
- Prompt text is held in the record only if FD-2 allows it. Under the default, records hold hashes
  and a revision draft cannot refill the prompt.

## 4. The model system (Pillar A)

The chain a request passes, in order. Strategy and candidates are in
[07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md).

| Step | Box | What it is | Card |
|---|---|---|---|
| 1 | Catalogue | `core/engines/catalog.ts`. A code constant (`yamakan.model-catalog/v1`), not stored data. Route is `kaggle`, `comfyui` or `local`. Lifecycle is `candidate`, `qualified`, `offered`, `retired` | MPR-201 |
| 2 | Capability report | `yamakan.engines.capabilities` gains `report` (`yamakan.capability-report/v1`). Each cell is `supported`, `unsupported` or `unverified`. `yamakan.generation.options` is projected from it | MPR-202 |
| 3 | Router explanation | See section 5. A pure function of the report | MPR-305 |
| 4 | Preflight | `yamakan.generation.preflight`, a read. Returns the request, refusals, an estimate in seconds (no currency), quota, egress, reference delivery, gate state and a `preflightHash` that `yamakan.generation.start` accepts | MPR-203; delivery report by MPR-402 |
| 5 | Gates | `core/gates.ts`. Kinds `egress`, `spend`, `download`. Approvals are rows in the workspace database. Two choke points: the Kaggle CLI call in `core/engines/kaggle.ts` and the generation service in `core/engines/generation.ts`. The download gate always refuses | MPR-204; Kaggle containment by MPR-205 |
| 6 | Adapter contract | Five operations: `textToVideo`, `imageToVideo`, `videoEdit`, `transcribe`, `enhance`, written down in `docs/ENGINE_OPERATIONS.md`. `EngineAdapterV2` in `core/engines/contract-v2.ts` is not changed. The conformance kit is `tests/fixtures/engine-conformance.ts` with `tests/engine-conformance.test.ts`; intake rules are in `docs/MODEL_INTAKE.md` | MPR-206 |
| 7 | Typed failure | `core/engines/failures.ts`: a closed list of eight failure classes. Ledger rows gain `failureClass`, `mayStillBeBilled`, `billedIn`, `retry`, `endedAt`. Nothing is resent automatically | MPR-207 |
| 8 | Licence gate | `core/engines/licence.ts` (`yamakan.model-licence/v1`). A Kaggle run counts as a hosted run. A refusal uses the existing reason `RIGHTS_UNQUALIFIED` of `core/engines/reasons.ts`. The notices are shown by `yamakan.about.notices` | MPR-208, MPR-209 |
| 9 | Provider profile | `core/engines/provider-profile.ts` (`yamakan.provider-profile/v1`), flag off, proven against a loopback fake only. No command | MPR-210, Stage 2 |
| 10 | Credential vault | A Windows DPAPI helper and `core/credentials.ts`; three credential commands | MPR-211, Stage 6, DEFERRED (FD-5) |
| 11 | First hosted provider | `core/engines/hosted-provider.ts`; every call passes the egress gate and every submit the spend gate | MPR-222, Stage 6, EXTERNAL_BLOCKED (FD-5) |
| 12 | Local routes | `core/engines/local-image.ts`; `core/audio/whisper.ts` and `core/audio/speech.ts` | MPR-220, MPR-221, Stage 6, EXTERNAL_BLOCKED (FD-4) |

The provider profile contract (MPR-210) is a Stage 2 card with its flag off. Only the vault and the
first real provider are Stage 6. A refused or unknown request stops at the earliest box that can
refuse it; no box later in the chain can turn a route on.

## 5. The Director (Pillar C)

Yamakan ships no language model. Planning text (brief, script, storyboard notes, shot list) comes
from the person, or from an outside agent that the person runs, through typed commands. Yamakan
checks bounds, computes totals and hashes, binds approvals and records what happened.

| Part | What is added | Card |
|---|---|---|
| Manifest | `PipelineStageSchema` in `core/director/manifest.ts` gains optional `output_kind`. `core/director/production-pipeline.ts` defines one pipeline of nine stages. `core/director/outputs.ts` computes each stage output and its hash, read by `yamakan.director.stageOutput`. The `director_runs` and `director_attempts` tables do not change | MPR-301 |
| Plan view | The flow snapshot of `core/flow/snapshot.ts` moves to format 2. It is derived and never stored. `yamakan.flow.snapshot` gains optional `projectId` | MPR-302 |
| Edit proposals | Document kind `editProposal`; five proposal commands; a propose-only mode for agent tokens | MPR-303 |
| Router explanation | `yamakan.router.explain` returns `yamakan.router-explain/v2`: eligible and rejected routes with reasons, `providersEnabled: false`, and a fixed order (location, expected seconds, route id, recipe id). Quality and price are not in the order | MPR-305 |
| MCP prompts and resources | Ten fixed English prompts (`mcp/prompts.ts`) that read no project text. Resources (`mcp/resources.ts`) are thin reads through the SDK client, so `authorize` decides, and each carries a trust label of `product` or `project-data`. `yamakan.director.contract` returns the stage contract | MPR-304 |

The nine stages, and who supplies what:

| Stage | Content comes from | What Yamakan does | Depends on a model |
|---|---|---|---|
| `brief` | Person or agent, through `yamakan.story.save` | Bounds, hashes | No |
| `script` (approval) | Person or agent, through `yamakan.story.save` | Bounds, hashes, approval binding | No |
| `storyboard` (approval) | Person or agent, through `yamakan.story.save` and `yamakan.pack.save` | Bounds, hashes, approval binding | No |
| `shot_list` (approval) | Person or agent, through `yamakan.story.save` | Totals, hashes, approval binding | No |
| `model_selection` | Nobody; it is the router explanation | Records the available routes. It does not choose | No |
| `generation` | Human-only `yamakan.generation.start`, an import, or `yamakan.director.renderShot` | Preflight, gates, ledger, take record | Yes for a generated clip; no for a Blender render |
| `editing` | Typed timeline operations and `yamakan.story.assemble` | Applies them to the one timeline | No |
| `sound` (approval before export) | Person; `yamakan.audio.transcribe` still refuses until a local route exists | Levels and loudness at export | Only captions and speech, and only after MPR-221 |
| `export` | `yamakan.export.video` | Owned FFmpeg render; manifest of MPR-701 | No |

Deterministic, with no model involved: bounds checks, totals, hashes, stage outputs, approval
binding, the router explanation, the plan view, proposal description and apply, assembly, export and
the export manifest. Dependent on a model: the pixels of a generated clip, and captions or speech
on a local route. An outside agent's planning text depends on that agent's model, which Yamakan
neither ships nor calls.

Edit proposals (MPR-303): a pending proposal is an `editProposal` document referenced from the
project head, with at most 4 pending per project, 640 operations and 196,608 bytes each. An agent
cannot apply its own proposal. A propose-only token is refused every mutation except
`yamakan.proposal.create` and `yamakan.proposal.discard`. A direct agent with `project:write` can
still edit without review; the card requires `docs/AGENT_PLATFORM.md` to say so.

## 6. Consistency and camera (Pillar D)

| Thing | What it is | Card |
|---|---|---|
| Entity, anchor, variants | Reference-pack format 2 adds an `entity` block: kind, description, anchor and up to 16 variants (`core/entity.ts`). An anchor change is refused unless the principal is the browser. `yamakan.entity.list` reads them | MPR-401 |
| Per-shot schedule | The existing `referencePacks` list on a shot; order is priority; a pin gains optional `variantId` | MPR-402 |
| Delivery report | `core/reference-delivery.ts` builds `yamakan.reference-delivery/1`, returned by preflight and covered by `preflightHash`. Nine reason codes say what was not sent and why. Nothing is resized or merged to fit. A hop count tracks references that are themselves generated; the limits (warn at 1, cap at 3) are [ASSUMED] | MPR-402 |
| Placement consent | The commit-point check in `core/continuity.ts` is extended. No new command, table or format | MPR-010 |
| Per-shot camera and render record | One optional `setup` on the story shot (`core/shot-setup.ts`). `yamakan.director.renderShot` takes the run, the story document and the shot, and returns a `setupHash`. The older scene store becomes read-only: `yamakan.scene.save` stays registered and always refuses | MPR-403 |
| Control passes | Proposed depth and normal passes (at most 2) on the same Blender job and the same single slot. Needs four triggers first. Encoding and polarity are [UNKNOWN] | MPR-404, DEFERRED |
| Measurement harness | Task set `yamakan.consistency-tasks/1`, document kind `consistencyStudy`, five study commands, result `yamakan.consistency-result/1`. It runs with no model | MPR-405 |

Two things must not be confused.

Reference management is what Yamakan does: it stores entities and their anchors, orders the
references for each shot, sends what a route accepts, and reports exactly what was sent and what
was left out. This is deterministic and testable without a model.

Demonstrated consistency is a property of a model's output. Yamakan cannot assert it. It can only
be measured, and the only card that measures it is MPR-405. Until a complete result file exists
under `docs/evidence/consistency`, the capability cell says `unmeasured` and
`yamakan.continuity.check` keeps its `unmeasured` status. Real clips for a study wait for FD-3,
FD-4 or FD-5, and raters beyond the founder wait for FD-6. No consistency claim is made in this
plan.

## 7. Agentic production (Pillar E)

| Thing | What is added | Lives in | Card |
|---|---|---|---|
| Honest tool list | The catalogue a principal sees lists what it may call and what is withheld; entries gain `humanOnly`, `destructive`, `requestId`. `yamakan.proxy.build` and `yamakan.proxy.cancel` become mutations. MCP cancellation in `mcp/cancellation.ts` | Registry and MCP server | MPR-501 |
| Wait and event cursor | `yamakan.job.wait` (at most 25 seconds; 32 waiters, 4 per principal) and `yamakan.events.read` (pages of at most 200 from a scan of at most 5,000 rows). They read `outbox` and `jobs` as they are | Registry; `sdk/wait.ts`; CLI `wait` | MPR-502 |
| Agent identity in CLI and SDK | One credential rule (`YAMAKAN_AGENT_TOKEN`, else `YAMAKAN_AGENT_TOKEN_FILE`) in `sdk/credentials.ts`; CLI `help` and `import`; MCP import tools | SDK, CLI, MCP | MPR-503 |
| Edit proposals, propose-only mode | See section 5 | Document store; `agent_tokens` | MPR-303 |
| Approval requests | An agent files a request for one of four generation commands; a person approves or declines in the browser; the approved command runs through the unchanged `execute` with `onBehalfOf` set. Nine commands are never eligible, and the default is never | Table `approval_requests`; `core/approvals.ts` | MPR-504 |
| Budgets | A per-agent envelope (generations, quota seconds, currency, egress bytes, optional wall seconds) with a usage ledger. Over-limit use is refused `LIMIT_EXCEEDED`. Set by a person only | Tables `agent_budgets`, `agent_budget_usage`; `core/agents/budget.ts` | MPR-505 |
| Audit feed and provenance trace | An append-only log of mutations and denials, written by `execute` only; reads are not recorded. `yamakan.provenance.trace` walks stored lineage (at most 500 nodes, depth 8) and reports gaps; nothing is inferred | Table `audit_log`; `core/audit.ts`; `core/provenance-trace.ts` | MPR-506 |
| Blender queue and memory budget | A waiting line of 4 (2 per principal), fair claim order by submitter, `yamakan.job.rerun`, and a measured memory limit per job kind. One Blender job at a time stays true | `jobs` table and the pump in `core/jobs.ts` | MPR-507 |
| User presence | Option A: an operating-system presence check before human-only commands, with `yamakan.presence.status`. Option B: no code | `core/presence.ts`; helper crate `native/presence` | MPR-508, Stage 6 (FD-9) |
| Supervised agent benchmark | A receipt format and a script. No command, schema step or job kind | Scripts | MPR-805 |

## 8. Change tables

### 8.1 Stored formats

| Format | Change | Version the card gives | Card |
|---|---|---|---|
| Story document | Take `recordHash`; optional `brief`, scene `sceneText`, shot `intent` | 2 | MPR-101 |
| Story document | Uses the version 2 text fields. If MPR-101 merged without them, this card adds them | 2, or 3 as the fallback | MPR-106 |
| Story document | Optional `variantId` on a shot's reference pin | "moves by one"; no number | MPR-402 |
| Story document | Optional `setup` on a shot | "moves by one"; no number | MPR-403 |
| Reference pack | `entity` block | 2 | MPR-401 |
| New document kind `takeRecord` | Format `yamakan.take-record` | 1 | MPR-101 |
| New document kind `takeReplacement` | Format `yamakan.take-replacement` | 1 | MPR-107 |
| New document kind `editProposal` | Format `yamakan.edit-proposal` | 1 | MPR-303 |
| New document kind `consistencyStudy` | Format `yamakan.consistency-study`, at most 512 KiB | 1 | MPR-405 |
| Take proposal | 1 to 64 mappings. Derived, not stored; a version 1 proposal is refused `REVISION_CONFLICT` | 2 | MPR-105 |
| Reader map `DOCUMENT_READ_VERSIONS` in `core/document-ref.ts` | Names every version a build can read. Not on main today | — | MPR-101 and MPR-401 each say they add it |
| Canonical project | No change | — | — |

Rule: a stored format moves only by an additive step, and the build reads every older version.
Each card takes the next free number when it merges, and there is one reader map. An older build
refuses a newer story at read with its version error (MPR-101).

### 8.2 Derived and receipt formats

None of these is a project format. Each is computed on read or written as a receipt.

| Format string | Where it appears | Card |
|---|---|---|
| `yamakan.model-catalog/v1` | Code constant | MPR-201 |
| `yamakan.capability-report/v1` | Capability read | MPR-202 |
| `yamakan.generation-preflight/v1` | Preflight read | MPR-203 |
| `yamakan.model-licence/v1` | Licence block | MPR-208 |
| `yamakan.provider-profile/v1` | Provider contract | MPR-210 |
| `yamakan.credential/v1` | Vault file | MPR-211 |
| `yamakan.stage-output`, version 1 | Stage output hash | MPR-301 |
| Flow snapshot, format 2 | Plan view read | MPR-302 |
| `yamakan.stage-contract` and `yamakan.mcp-resource`, version 1 | Contract read; MCP resource envelope | MPR-304 |
| `yamakan.router-explain/v2` | Router read | MPR-305 |
| `yamakan.reference-delivery/1` | Inside preflight | MPR-402 |
| `yamakan.consistency-tasks/1`, `yamakan.consistency-result/1` | Study task set and result | MPR-405 |
| `yamakan.events`, version 1 | Event read | MPR-502 |
| `yamakan.agent-budget`, version 1 | Budget read | MPR-505 |
| `yamakan.audit` and `yamakan.provenance-trace`, version 1 | Audit and trace reads | MPR-506 |
| `yamakan.presence`, version 1; receipt `yamakan.qualification/q15-user-presence/1` | Presence read; qualification receipt | MPR-508 |
| `yamakan.export-manifest`, version 1 | A file beside the export artifact, `exports/<jobId>/manifest-<attempt>.json`; its hash goes on the attempt receipt | MPR-701 |
| Nested `yamakan` lineage dictionary | OTIO metadata | MPR-702 |
| `yamakan.benchmark-protocol/2`, `yamakan.benchmark-observations/2`, `yamakan.benchmark-report/2`; `yamakan.benchmark-production-log`, version 1 | Benchmark files | MPR-801 |
| `yamakan.benchmark-briefs` and `yamakan.workflow-baseline-receipt`, version 1 | Benchmark inputs and receipt | MPR-802 |
| `yamakan.ci-not-run`, version 1 | CI list of tests not run | MPR-804 |
| `yamakan.supervised-agent-receipt`, version 1 | Agent benchmark receipt | MPR-805 |

### 8.3 Workspace SQLite schema steps beyond version 18

| Suggested order | Card | What it adds | What the card says about the number |
|---|---|---|---|
| 1 | MPR-204 | Tables `gate_approvals`, `gate_approval_revocations`, `gate_approval_uses` | Names `SCHEMA_V19` (18 to 19 on this baseline); next free number at merge |
| 2 | MPR-507 | Columns `jobs.submitted_by` and `jobs.retry_of`, one partial index | Next free version at rebase; "moves one version" |
| 3 | MPR-303 | Nullable column `agent_tokens.mode` | Conditional: added the way `expires_at` was; a version step only if that pattern needs one |
| 4 | MPR-504 | Table `approval_requests` | "19 unless another card took it" |
| 5 | MPR-505 | Tables `agent_budgets`, `agent_budget_usage` | Next free version at rebase |
| 6 | MPR-506 | Table `audit_log`, append-only by triggers | Next free version at rebase |
| 7 | MPR-222 | A money cap on a spend approval, in Stage 6 after FD-5 | "adds one SQLite schema step"; no number named |

Rules. Each step is additive: old rows are not rewritten and old databases gain empty tables or
null columns. Each card takes the next free version number when it merges. Only one schema-step
pull request is open at a time. The order is that of section 5.1 of
[OPUS_IMPLEMENTATION_HANDOFF.md](OPUS_IMPLEMENTATION_HANDOFF.md), which is the authority. It follows the
dependencies: MPR-505 reads
`submitted_by` from MPR-507 and the approval id from MPR-504. A schema step cannot be undone by
reverting code (MPR-204).

Possible further steps, neither certain: a
`take_records` table (MPR-101) or a `take_replacements` table (MPR-107), each only if the card's
first step finds a reader of `story_document_versions` that does not filter by kind. Cards that
state they need no schema step: MPR-101, MPR-102, MPR-107, MPR-207, MPR-502, MPR-604, MPR-701,
MPR-805.

### 8.4 Job kinds

| Kind | Status | Card |
|---|---|---|
| `export`, `blender-render`, `blender-track`, `cfr-derivative`, `remote-generation` | On main in `core/jobs.ts` | — |
| `sample-media` | New; submitted by `submitSample`; adds no table and no scheduler | MPR-604 |
| A measure job for consistency alarms | New; the card says it adds a job kind and gives no name | MPR-405 |

Every kind runs on the existing supervisor and its one serial pump. MPR-507 changes Blender
admission: today a second Blender submission is refused `LIMIT_EXCEEDED`; after the card it is
accepted and waits, and a full line answers `BUSY`. MPR-402, MPR-404 and MPR-805 state that they add
no job kind.

### 8.5 Existing commands that change

| Command | What changes | Card |
|---|---|---|
| `yamakan.story.save` | Accepts story format 1 or 2 and stores 2; optional `records` (at most 8 per save); later steps accept the pin `variantId` and the shot `setup` | MPR-101, MPR-106, MPR-402, MPR-403 |
| `yamakan.take.list` | Rows gain `recordHash`; result gains `timeline.clips`, `orphans`, `orphanTotal` | MPR-101, MPR-105 |
| `yamakan.document.capability` | Gains `kinds` | MPR-101 |
| `yamakan.document.commit` | Refuses the kinds `takeRecord`, `takeReplacement`, `editProposal` | MPR-101, MPR-107, MPR-303 |
| `yamakan.generation.start` | Optional `target`, `derivedFromTakeId`, `preflightHash`; passes the gates; refuses `LIMIT_EXCEEDED` at the reference hop cap; can run for an agent under an approved request; checks the agent's budget | MPR-102, MPR-103, MPR-203, MPR-204, MPR-402, MPR-504, MPR-505 |
| `yamakan.generation.import` | Returns `take` | MPR-102 |
| `yamakan.generation.list`, `yamakan.generation.status` | Rows gain `target`, `take`, then `failureClass`, `mayStillBeBilled`, `billedIn`, `retry`, `endedAt` | MPR-102, MPR-207 |
| `yamakan.generation.options` | Models come from the capability report; gains `quota`, `remoteCancel: false`, `network`, and `licenceTerms` per model | MPR-202, MPR-205, MPR-209 |
| `yamakan.engines.capabilities` | Gains `report`; a cell later gains `consistency` | MPR-202, MPR-405 |
| `yamakan.router.explain` | Returns the version 2 explanation | MPR-305 |
| `yamakan.take.proposeReplace`, `yamakan.take.apply` | Proposal format 2, applied as one batch; apply also stores the replacement record | MPR-105, MPR-107 |
| `yamakan.flow.snapshot` | Optional `projectId`; snapshot format 2 | MPR-302 |
| `yamakan.agent.create`, `yamakan.agent.list` | Optional `mode` and `budget` on create; list reports mode, budget and use | MPR-303, MPR-505 |
| `yamakan.pack.save` | Accepts pack format 1 or 2; anchor change only by the browser principal | MPR-401 |
| `yamakan.director.renderShot` | Input becomes run, story document and shot; returns `setupHash`. Proposed `passes` if MPR-404 is un-deferred | MPR-403, MPR-404 |
| `yamakan.scene.save`, `yamakan.scene.capability` | Save always refuses `CAPABILITY_UNAVAILABLE`; capability reports the legacy store as read-only | MPR-403 |
| `yamakan.blender.render` | Proposed `passes` | MPR-404, DEFERRED |
| `yamakan.proxy.build`, `yamakan.proxy.cancel` | Become mutations and refuse a request id; build gains optional `retry` | MPR-501, MPR-507 |
| `yamakan.job.status`, `yamakan.export.batchStatus` | Gain `manifestSha256`; the job view gains `queuePosition` and `retryOf` | MPR-701, MPR-507 |
| `yamakan.project.exportOtio`, `yamakan.project.proposeOtio` | Export returns a manifest and lineage; propose gains `offset` and returns a batch filed through the proposal commands | MPR-702 |
| `yamakan.audio.transcribe` | Input and scope unchanged; stops refusing only when a local route is installed | MPR-221, Stage 6 |

### 8.6 New commands

Only names that appear in a card's `interfaces`. "Read" means not a mutation.

| Command | Scope | Kind | Card |
|---|---|---|---|
| `yamakan.take.record` | `project:read` | Read | MPR-101 |
| `yamakan.take.revisionDraft` | `project:read` | Read | MPR-103 |
| `yamakan.shot.history` | `project:read` | Read | MPR-107 |
| `yamakan.generation.preflight` | `project:read` | Read | MPR-203 |
| `yamakan.gates.approve` | `consent:grant` | Mutation, human-only | MPR-204 |
| `yamakan.gates.revoke` | `consent:revoke` | Mutation, human-only | MPR-204 |
| `yamakan.gates.list` | `consent:grant` | Read, human-only | MPR-204 |
| `yamakan.about.notices` | `project:read` | Read | MPR-209 |
| `yamakan.credentials.add` | `consent:grant` | Mutation, human-only | MPR-211 |
| `yamakan.credentials.remove` | `consent:revoke` | Mutation, human-only | MPR-211 |
| `yamakan.credentials.list` | `project:read` | Read | MPR-211 |
| `yamakan.director.stageOutput` | `project:read` | Read | MPR-301 |
| `yamakan.proposal.create`, `yamakan.proposal.apply`, `yamakan.proposal.discard` | `project:write` | Mutation | MPR-303 |
| `yamakan.proposal.list`, `yamakan.proposal.read` | `project:read` | Read | MPR-303 |
| `yamakan.director.contract` | `project:read` | Read | MPR-304 |
| `yamakan.entity.list` | `project:read` | Read | MPR-401 |
| `yamakan.study.save` | `project:write` | Mutation | MPR-405 |
| `yamakan.study.vote` | `project:write` | Mutation, human-only | MPR-405 |
| `yamakan.study.measure` | `render:execute` | Mutation; refuses a request id; starts one job | MPR-405 |
| `yamakan.study.plan`, `yamakan.study.result` | `project:read` | Read | MPR-405 |
| `yamakan.job.wait` | `job:read` | Read | MPR-502 |
| `yamakan.events.read` | `project:read` | Read | MPR-502 |
| `yamakan.approval.request`, `yamakan.approval.withdraw` | `project:write` | Mutation | MPR-504 |
| `yamakan.approval.status` | `project:read` | Read | MPR-504 |
| `yamakan.approval.list` | `agent:revoke` | Read, human-only | MPR-504 |
| `yamakan.approval.approve` | `agent:create` | Mutation, human-only | MPR-504 |
| `yamakan.approval.decline` | `agent:revoke` | Mutation, human-only | MPR-504 |
| `yamakan.agent.setBudget` | `agent:create` | Mutation, human-only | MPR-505 |
| `yamakan.budget.read` | `project:read` | Read | MPR-505 |
| `yamakan.audit.read`, `yamakan.provenance.trace` | `project:read` | Read | MPR-506 |
| `yamakan.job.rerun` | `render:execute` | Mutation; refuses a request id | MPR-507 |
| `yamakan.presence.status` | `project:read` | Read; option A only | MPR-508 |
| `yamakan.project.createSample` | `project:write` | Mutation; refuses a request id; takes an idempotency key | MPR-604 |
| `yamakan.export.manifest`, `yamakan.export.provenanceReport` | `project:read` | Read | MPR-701 |

That is 41 commands, so 157 if every card is built, Stage 6 included. Cards that add no registry
command include MPR-010, MPR-104, MPR-106, MPR-210, MPR-220, MPR-221, MPR-222, MPR-501, MPR-503,
MPR-601, MPR-602, MPR-603, MPR-801 and MPR-805.

### 8.7 New environment variables and npm scripts

| Environment variable | Purpose | Card |
|---|---|---|
| `YAMAKAN_MCP_IMPORT_DIR` | The one folder the MCP import tools may read | MPR-503 |
| `YAMAKAN_BUILD_COMMIT` | Build commit written into the export manifest | MPR-701 |
| `YAMAKAN_VAULT` | Path of the vault helper | MPR-211 |
| `YAMAKAN_QUALIFY_ROUTE` | Set by the person; names the one catalogue id a qualification run may use | MPR-220, MPR-221 |
| `YAMAKAN_PRESENCE` | Value `fallback` forces the fallback mode at service start, for automated qualification scripts | MPR-508 |

None of the five is on main. The cards reuse variables that are: `YAMAKAN_AGENT_TOKEN`,
`YAMAKAN_AGENT_TOKEN_FILE`, `YAMAKAN_MCP_LOCAL_CLIENT` and `YAMAKAN_QUALIFY_RECEIPT`.

| New npm scripts | Card |
|---|---|
| `plan:check`; `test:report`, `test:studio:report` | MPR-003; MPR-804 |
| `qualify:revisable-shot`, `qualify:revise-shot-screens`, `qualify:story-brief` | MPR-101 (extended by MPR-107), MPR-104, MPR-106 |
| `qualify:model-catalog`, `qualify:capability-report`, `qualify:generation-preflight`, `qualify:gates`, `qualify:engine-conformance`, `qualify:licence-gate`, `qualify:compliance-surfaces`, `qualify:provider-contract` | MPR-201, MPR-202, MPR-203, MPR-204, MPR-206, MPR-208, MPR-209, MPR-210 |
| `qualify:credential-vault`, `local-image:install`, `qualify:local-image`, `local-speech:install`, `qualify:local-captions`, `qualify:hosted-provider` | MPR-211, MPR-220, MPR-221, MPR-222 |
| `qualify:production-pipeline`, `qualify:production-plan`, `qualify:edit-proposals`, `qualify:mcp-contracts`, `qualify:router-explain` | MPR-301, MPR-302, MPR-303, MPR-304, MPR-305 |
| `qualify:consistency-study` | MPR-405 |
| `qualify:agent-mcp`, `qualify:approvals` | MPR-501 (extended by MPR-502, MPR-503, MPR-506); MPR-504 (extended by MPR-505) |
| `qualify:structural-edits`, `qualify:clip-inspector`, `qualify:export-panel`, `qualify:first-run`, `qualify:continuity`, `i18n:review-packet`, `qualify:i18n-surfaces` | MPR-601, MPR-602, MPR-603, MPR-604, MPR-605, MPR-606 |
| `qualify:export-manifest`, `qualify:otio-lineage` | MPR-701, MPR-702 |
| `benchmark:workflow`, `qualify:workflow-baseline`, `benchmark:rating-bundle` with `qualify:rating-bundle`, `benchmark:agent` | MPR-801, MPR-802, MPR-803, MPR-805 |

### 8.8 Document-count budget

A project may reference at most 32 documents today (`DOCUMENT_LIMITS.documentsPerProject` in
`core/document-ref.ts`, enforced by the project schema in `core/canonical.ts`). Bytes have a
separate budget: 4 GiB of creative documents per workspace, checked in `core/store.ts`.

| Document kind | Counts against the 32 | What the card says | Card |
|---|---|---|---|
| `takeRecord` | No | A record is never a project document reference; the `documents` array and its cap are untouched. The first step confirms it | MPR-101 |
| `takeReplacement` | Not stated in words | Held the way take records are held, which implies no. The card states only the byte cost (512 bytes each). To be settled in that card's first step | MPR-107 |
| `editProposal` | Yes, while pending | A pending proposal is a document reference on the project head; at most 4 pending; applying or discarding removes the reference | MPR-303 |
| `consistencyStudy` | Not stated | The card says a study belongs in a project made for it. Whether a study is a project reference must be settled in that card's first step | MPR-405 |
| `referencePack` (existing kind) | Yes, as today | One pack per entity caps a project at about 30 entities beside one story | MPR-401 |

Take records and replacement records are never pruned, so they count against the byte budget for
the life of the workspace (MPR-101). The worst case the card computes for one story is 62.5 MiB.

## 9. Authority map

| New thing | Lives in (existing module) | Why this is not a new authority |
|---|---|---|
| Take records | Creative-document rows of `core/store.ts`, written by `commitDocument` in the story-save transaction | Same store, same commit, same byte check. The service builds every record; a caller cannot author one |
| Replacement records, shot history | The same rows, written only by the apply path; history is a derived read | No new table; the history stores nothing |
| Gate approvals | Three tables in the one workspace database; consulted at two existing choke points in the generation code | Human-only commands under the existing consent scopes. A gate can only refuse; it cannot enable a route. A restore voids every approval |
| Approval requests | Table `approval_requests`; the approved command runs through the unchanged `execute` | Grants no scope. The person's approval is bound to the input hash. Nine commands are never eligible |
| Budgets | Two tables; checked at four existing choke points | A limit that can only refuse. It schedules nothing and prices nothing |
| Audit feed | Table `audit_log`, written by `execute` only | A record of decisions the registry already made. Project state is never read back from it |
| Event cursor, job wait | Reads of the existing `outbox` and `jobs` tables | No table and no subscription; bounded reads |
| Blender queue | The `jobs` table and the serial pump of `core/jobs.ts` | A relaxed admission check and one ordering rule. No new scheduler, store or state (the card's own decision) |
| Edit proposals | A document kind in the creative-document store; references on the project head | An applied proposal is an ordinary timeline revision made through the store's commit |
| Propose-only mode | One column on `agent_tokens`, enforced in `authorize` | It only narrows what a token may do |
| Sample project media | Job kind `sample-media` on the supervisor; `core/sample/spec.ts` | The result is an ordinary project and ordinary assets, made by owned FFmpeg |
| Consistency study | A document kind, a job on the supervisor, a result file under `docs/evidence/consistency` | It measures. It does not change `yamakan.continuity.check` or approve a model |
| Export manifest | A receipt file beside the export artifact (`core/export-manifest.ts`); its hash on the attempt receipt | A receipt format. The project stays the truth; the manifest is derived from it at export |
| Model catalogue, capability report, router explanation, preflight | Code and derived reads under `core/engines` and `core/router` | Nothing is stored. `yamakan.generation.start` stays the only command that starts a generation |
| Production pipeline, stage outputs | A manifest for the existing runtime in `core/director/runtime.ts` | The run and attempt tables are unchanged |
| MCP prompts and resources | The MCP server, through the SDK client | Every resource read is an ordinary command call; `authorize` decides |
| Entity and anchor; shot setup | Inside the reference-pack document; inside the story document | No new document kind. Shot setup leaves one writable place for scene data where today there are two |
| Credential vault (Stage 6) | Files in a `vault` folder under the workspace root, sealed by a native helper | The card itself calls this a second small place where state lives. It holds key material only, never project state, and is left out of backup, export and archive |
| Presence check (Stage 6) | Inside `execute`, with a native helper | It adds a condition to human-only commands. It grants nothing |

## 10. Known architecture risks

Each risk names its owning card. Items 12 to 16 were contradictions between cards when they were
first recorded. The cards have since been corrected, and each item now states the rule that holds
and what is still open.

1. Story-format stacking (MPR-101, MPR-106, MPR-402, MPR-403). Four cards move one format. Only
   MPR-101 fixes a number. The numbers of the others depend on merge order, and each must extend
   the one reader map. All four also add bytes to one document capped at 262,144 bytes; MPR-101
   estimates about 94 shots at 8 takes once hashes are stored.
2. Six schema steps (MPR-204, MPR-507, MPR-303, MPR-504, MPR-505, MPR-506), the step of MPR-303
   being conditional, plus the money-cap step of MPR-222 in Stage 6. Each wants the next free
   number, and MPR-204 says the format moves from 18 to 19 on this baseline. A step cannot be
   reverted by reverting code. The one-open-pull-request rule of section 8.3 is the control.
3. Shared files in active work. `core/jobs.ts` is in active work by the implementation owner
   (FD-11). MPR-507 changes its admission and claim order, and ten more cards list it as a target.
   `core/command/registry.ts` is a target of 38 cards and `core/engines/generation.ts` of 13.
   Additions must stay append-only and be rebased on live main.
4. Serial pump (MPR-507). An export submitted behind a full Blender line waits for up to five
   renders. Letting short jobs pass would be a new scheduling rule and is not in any card.
5. Blender memory (MPR-507). The figure is unmeasured. The card may end at stop and report. The
   Blender worker is outside the arithmetic of the frozen memory policy; see
   [11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md).
6. Donor roots. Eleven new files fall under `core/engines` (MPR-201, MPR-202, MPR-203, MPR-207,
   MPR-208, MPR-210, MPR-220, MPR-222) and `core/director` (MPR-301, MPR-304). Each needs an entry
   under `localFilesInDonorRoots` in `docs/provenance/import-policy.json`.
7. Document budget. The 32 references are shared by the story, one pack per entity (MPR-401), up
   to 4 pending proposals (MPR-303) and possibly a study (MPR-405). Section 8.8 lists what is not
   yet stated. Record bytes are never pruned (MPR-101).
8. New document kinds and older builds. `DocumentKind` is a closed list. MPR-303 states that what
   a build without the card does with a head that references an `editProposal` is not verified.
   The same question applies to `consistencyStudy` (MPR-405).
9. Human-only by approval (MPR-504). Approved requests are the one path by which a human-only
   command runs for an agent. Its safety rests on the input hash, the never-eligible list and the
   default of never. A direct agent with `project:write` still edits without review (MPR-303).
10. State outside the store. Credential files live outside SQLite and outside backups (MPR-211).
    Export manifests live under the exports folder, which backups do not carry (MPR-701).
11. Assumed and unknown figures. The reference hop limits are [ASSUMED] (MPR-402). Control-pass
    encoding is [UNKNOWN] (MPR-404). Under the FD-2 default a revision draft cannot refill the
    prompt, which weakens Stage 1 (MPR-103).
12. One reader map. MPR-101 adds the map `DOCUMENT_READ_VERSIONS` and the reader that accepts
    more than one version. MPR-401 reuses both for `referencePack`. Every later card that moves a
    document version must extend that one map; a second mechanism is a defect.
13. Operations beyond the five. MPR-206 keeps the contract at five operations and defines the five
    steps for adding one. MPR-220 adds `textToImage` and MPR-221 adds `textToSpeech` by those
    steps, and both wait on FD-4. Three of today's five operations have no adapter.
14. Currency. MPR-204 has no currency column. MPR-222 adds the schema step for a money cap on a
    spend approval. MPR-505 defines a currency dimension in the agent budget, which no route fills
    before MPR-222.
15. Parts and columns. MPR-507 lands both `jobs` columns and their index in one schema step in
    part b; part c adds none. MPR-303 leaves open whether its `mode` column needs a version step,
    so its place in the schema order is conditional.
16. The measure job (MPR-405). The card adds the job kind `consistency-measure` on the existing
    supervisor in `core/jobs.ts`. Its capability-cell field depends on the shapes that MPR-201 and
    MPR-202 fix when they are built, so the second card to merge re-reads the first.
17. Helpers that must exist exactly once, whichever card merges first: the timeline hash (MPR-303,
    MPR-701, MPR-101), the lineage resolver (MPR-506, MPR-701), the input digest (MPR-504, MPR-506),
    the two-sided sign test (MPR-405, MPR-801) and the ledger field `endedAt` (MPR-101, MPR-207).
18. Open amendments. Card text that reviewers asked to extend, and that this package leaves for
    founder review, is listed in [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md).

The order in which these risks are met is set by [08_ROADMAP.md](08_ROADMAP.md). The decisions
that open the Stage 6 parts are in [FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md).
