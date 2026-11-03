# Durable creative agent harness

Agents use the same canonical commands, revisions, assets, durable jobs and project history as the human editor. Retain one SQLite authority. A model is an optional planner/media producer; the complete reference journey runs with deterministic imported media.

## Existing guarantees to preserve

SS-001 checks prerequisites and reviewable output inside approval. SS-003 invalidates downstream attempts after upstream replacement without deleting audit history. YU-013/014 provide durable attempts, consent and restore fencing; YU-051/051b enforce consent at attachment and timeline commit. Existing scopes, request digests, CAS, execution epochs and per-writer undo remain mandatory.

## Planned behavior

| Step                   | Contract                                                                                                                                    | Failure / authority rule                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Inspect                | Typed snapshot of project/revision, available assets, supported operations and unresolved work                                              | Never infer current state from an old replay response                                                          |
| Propose, SS-006        | Render existing TakeProposalSchema/proposeReplace result with exact revision/story hash, mapping and proposalHash; no second proposal store | Stale base, missing asset, revoked consent or unsupported operation prevents apply; no partial commit          |
| Review                 | Human-readable proposal before/after; existing scoped apply action remains separate from human-only stage approval                          | Proposal view grants no approval; human-only stage approval binds managed media outputHash, never proposalHash |
| Execute                | Canonical transaction/batch; durable request identity and bounded resources                                                                 | Same request/digest replays receipt; changed digest conflicts; uncertain side effects require reconciliation   |
| Observe, SS-007        | Progress from committed attempts/jobs with project, request and current revision identity                                                   | Reconnect restores state; no fabricated percentage; redact paths/tokens                                        |
| Cancel/recover, SS-008 | Persist cancellation intent, terminate owned work, validate or discard partial outputs, fence stale completions                             | Timeout/kill cannot create approval or publish an incomplete artifact                                          |
| Revise                 | New proposal changes selected shot and declared dependents                                                                                  | Unaffected clips, audio/captions and history stay intact; dependent approval becomes stale                     |
| Handoff                | Durable summary references brief, accepted decisions, current revision, pending items and evidence                                          | A handoff carries no secret/token and grants no authority; receiving agent re-inspects current state           |

Creative memory is versioned project content or references to it, not a second agent database. Corrections to the brief/reference pack create new versions; deletion and consent revocation must invalidate affected pending work. Short conversation summaries are navigation aids, never authority.

Parallel independent reads are safe within budgets. Parallel mutations require disjoint scope analysis and still commit through CAS; conflict produces a reviewable retry, never silent overwrite. No external scheduler, arbitrary shell tool or raw FFmpeg-filter input is exposed to agents.

## Reference journey and tests

SS-004a in PR #157 already tests command-level three-shot production, captions/audio/transform, one-shot replacement, stale denial, undo/redo, graceful reopen and replay using real H.264/AAC outputs. It is unmerged pending independent review.

SS-006/007/008 close proposal, progress and cancellation gaps. SS-004b then exercises actual UI approval/revision, crossfade and a forced owned-service interruption with restart. Include a second writer between proposal and apply, a revoked input, a cancelled worker, an old request replay and a successful unchanged proposal. Verify the current project after each result.

The acceptance artifact contains the brief/storyboard identity, before/after canonical hashes, reviewed proposal and separate stage-approval receipts, affected IDs, real exports/probes/frame/audio comparisons, history/attempt rows and interruption seam. No synthetic recognition or generated video result may be presented as model execution. A stand-in qualifies the interface only.

## API and schema discipline

SS-006 wraps the already inspected take proposal/apply surfaces. Director approval remains human-only; existing scoped project:write take.apply remains available to authorized agents. The derived proposal panel binds the exact existing payload to take.apply; it is not a persisted approval or a stage output. Never send proposalHash as outputHash or widen assertManagedOutput. A review artifact grants no new scope. If a command/schema is absent, write a versioned contract and compatibility test before implementation. Do not rename an existing public command merely to fit this document. SDK, CLI, MCP and browser surfaces must agree on errors, request IDs, scopes and cancellation. Every additive field has an old-client/read-path test; schema changes require an explicit migration/restore plan within the task.
