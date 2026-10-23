# Agent-native creative production

Design only. Current MCP/REST/CLI tools and manually recorded Director stages are not a demonstrated autonomous film producer. Preserve registry authorization, canonical reducers and JobSupervisor. No model-generated text can grant a scope, consent, budget or human approval.

## A complete editable outcome

An external or future embedded agent receives a bounded project view and command catalog, proposes a script/shot plan, resolves managed references, requests typed media operations only when qualified, proposes timeline edits, validates reference output and asks for revision-bound human acceptance where needed. Importing licensed footage is the no-engine path. The outcome is a canonical editable project plus export, not a folder of clips or a fabricated stage-completed hash.

| Step | Persistent input/output | Command/job owner | Failure behavior |
|---|---|---|---|
| Brief | Story document and constraints hash | document.commit via registry | Invalid/oversized untrusted text rejected; no execution |
| Plan shots | Shot IDs, timings, refs, requested capabilities | typed story operations | Missing capability returns blocked/manual option |
| Resolve refs | Managed asset versions and consent purpose | existing import/asset commands | No arbitrary file/URL from model; missing/refused assets stay explicit |
| Propose actions | baseRevision, operationListHash, required scopes, expiry | proposed `yamakan.proposal.create` | Changed plan invalidates prior approval |
| Approve | Human principal and exact proposal/output digest | browser-only approval | Agent cannot call/grant human-only scope |
| Execute | Existing durable jobs/attempts with frozen inputs | JobSupervisor handlers | Timeout/crash -> reconcile/quarantine; no blind resubmit |
| Attach | Output asset refs, exact target clips/shot/take | applyBatch at expected revision | Concurrent edit yields conflict and a new proposal, not overwrite |
| Evaluate | Probe/decode, reference parity, rubric and failure counts | typed deterministic checks / Quality Lab | Unknown quality cannot be called passed |
| Revise | One take/shot replacement proposal | same operations | Only affected scope changes; keep old take and audit history |
| Finish | Frozen render plan, export and backup receipt | existing export/recovery | Partial output never attached as success |

## Durable workflow semantics

Run graph nodes are bounded stage records linked to canonical story versions and existing job IDs. A stage attempt is never reused after failure; retries create numbered attempts with an explicit cause. A successful stage requires actual registered immutable outputs and validated input/recipe hashes. CAS a run version and monotonic job lease before publication. Persist pending intent before external effects. Unknown provider outcomes remain reconciliation-required; stopping a local MCP process does not prove a provider stopped or refunded.

Human checkpoints cover likeness/voice use, changed budget, external disclosure, destructive recovery and final proposal as defined by existing security policy. Pure manual editing need not introduce an approval at every click. Approval expiry or revocation racing submission must fail closed before a new effect. Security ledger state cannot be undone by restoring an older story.

## Tools and transport parity

Extend the existing catalog, rather than creating a privileged 'agent execute' endpoint. REST, CLI, MCP and SDK map to identical schemas, scopes, receipt semantics and errors. CLI exposes stable request IDs and JSON outputs; SDK supports bounded streaming upload, progress cursor and reconnect/resync. MCP enforces bytes **per complete newline frame**, bounded concurrency and output; protocol cancellation is distinct from explicit job cancellation.

Commands proposed: document lifecycle; story/shot/take operations; proposal create/get/apply; workflow start/status/resume/cancel; deterministic media-check operations. New commands require negative authorization/size/replay/conflict tests. Every tool description states whether it reads, commits, starts a job or needs a human grant. No arbitrary shell, JS/Python execution, raw FFmpeg filtergraph, provider URL or plugin installation tool.

Progress is a projection from committed outbox and jobs. Event cursors reconnect with bounded replay; expired cursors yield resync-required. UI, agent and CLI see the same run. Flow visualizes that state and cannot mutate another hidden graph.

## Evaluation and control of loops

Start with a deterministic imported-media three-shot workflow, interrupt at every command/job seam, reopen, revise one shot and export. Then test an external agent with bounded tool count, wall time, operation budget and revision conflicts. A retry policy must have finite attempts and a named escalation; failed quality checks never trigger unlimited generation. Later LLM/paid provider calls need separate authorization and budget. No autonomous success claim until complete editable-project evaluation in category H, including failures and human interventions.

Reference packs, scripts, model outputs and imported project metadata are untrusted content. Prompt injection cannot change tool policies. Model review-lineage labels do not establish independent review; record actual reviewer identity/context and immutable diff. Local d1 is advisory triage only.
