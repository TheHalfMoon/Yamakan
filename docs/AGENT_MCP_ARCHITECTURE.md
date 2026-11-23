# Agent-native command platform

> **Status, 2026-11-23, main 16d2175:** a proposal; the MCP server, scoped agent tokens and the TypeScript SDK now exist, and no Python SDK does. Kept as written for history. Current state: [current-state index](CURRENT_STATE_INDEX.md).

Final proposal: [master plan](IMPLEMENTATION_PLAN.md) and [operational contracts](OPERATIONAL_CONTRACTS.md) own current scope and exact protocols. Earlier evidence remains bounded; no final implementation or founder approval is implied.

All transports use one typed command service: UI, REST, CLI, MCP and TypeScript/Python SDKs share schema validation, scopes, revision checks, audit, consent and quotas. Core production does not require browser clicks. The legacy whole-project tool surface proves a path; granular scopes/full MCP are proposed work.

| Family     | Tools                                              | Scope                                        |
| ---------- | -------------------------------------------------- | -------------------------------------------- |
| Projects   | create/open/list/history/restore/archive           | project read/write and explicit recovery     |
| Assets     | import/search/version/probe                        | asset access/import within workspace         |
| Director   | script/character/scene/shot/storyboard             | project write plus likeness grants           |
| Generation | capabilities/quote/submit/status/cancel/reconcile  | local or provider-specific network execution |
| Timeline   | add/trim/split/move/keyframe/effect/audio/subtitle | revision-bound project write                 |
| Render     | preview/export/inspect                             | resource-bounded render execution            |
| Workflows  | validate/start/pause/resume/cancel                 | approved node types and job budget           |

Mutations require requestId/expectedRevision. Structured errors: VALIDATION, REVISION_CONFLICT, CAPABILITY_UNAVAILABLE, CONSENT_REQUIRED, BUDGET_EXCEEDED, PROVIDER_RATE_LIMIT, AMBIGUOUS_SUBMISSION, MEDIA_INVALID, CANCEL_UNSUPPORTED, RECOVERY_REQUIRED. Include safe retry/reconciliation hints; no secrets. Return artifact IDs/hash receipts, not unrestricted filesystem authority.

Desktop MCP stdio binds an explicit workspace grant. Remote MCP needs independently qualified auth/tenant isolation. Resources expose schemas/evidence/project summaries under media-read grants. Progress reflects actual units/state and unknown estimates. Model/tool content cannot grant scopes.

REST OpenAPI/CLI stable JSON and generated/thin TS/Python clients use identical schema versions. Python SDK remains optional. Resume from durable stages/jobs, not chat history. Ninerr session/policy and Ascout lineage are bounded candidates; Kodac's inspected auth helper is rejected as an authority boundary.

Acceptance: an external agent creates an editable multi-scene film, imports media, adds titles/audio, renders, restarts/reopens, inspects/cancels through typed tools, with no browser clicks and the same canonical project as UI.

## Final registry and proposal refinement

Replay checks the scoped request digest before revision conflict. Atomic batches reduce all operations and commit one revision; donor BatchCommand is not transactional. Approval binds baseRevision, operation-list hash, assets, scope and expiry. Clients cannot choose principalId or gain paths/shell privileges. Use committed outbox cursors for progress/resume. UI/REST/CLI/MCP and a thin TS SDK are MVP; broader SDKs, browser WebMCP and remote multi-user auth are later. See operational contracts and the exact UI/tool fixture acceptance.

## What an agent is shown, and cancelling (MPR-501)

This section describes the code as it is, unlike the proposal above.

**The list.** `GET /api/v1/tools` and MCP `tools/list` give a caller the commands it may call, by the one rule that `authorize` uses (`mayCall` in `core/command/registry.ts`): the command's scope is held, and a human-only command is called from the browser session. REST's answer also has `withheld`, the name of each other command with why: `browser-only` or `scope`. Over MCP a withheld tool is not listed; calling it is answered by the service's own `SCOPE_DENIED`, and a name that no command has is `-32602`. `yamakan_document_save` is listed with `yamakan.document.commit`. The list is presentation: the gate is `authorize`. A command can refuse for another reason once called: `yamakan.scene.migrate` refuses every agent, and a token that holds `project:write` is still shown it.

**The marks.** Each catalog entry says `mutation`, `humanOnly`, `destructive` and `requestId` (`replayed`, `refused` or `none`). Over MCP, `readOnlyHint` is true for a read; a change also has `destructiveHint`, true where it removes, stops or overwrites something nothing here keeps a way back to. A change made as a revision is not that. `idempotentHint` and `openWorldHint` are not given, since nothing here holds the fact.

**Cancelling.** `notifications/cancelled` names a request in progress by its id. It then gets no answer, whatever happens to it. An unknown or answered id, `initialize` and a malformed notification are ignored.

| The request                                                                                                                                                      | What happens                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not sent to the service yet                                                                                                                                      | It is never sent                                                                                                                                                                       |
| A read (a tool list too)                                                                                                                                         | Its HTTP request is aborted                                                                                                                                                            |
| A start: `yamakan.export.video`, `yamakan.blender.render`, `yamakan.blender.track`, `yamakan.director.renderShot`, `yamakan.export.batch`, `yamakan.proxy.build` | It finishes, then its own cancel (`yamakan.job.cancel`, `yamakan.export.batchCancel` or `yamakan.proxy.cancel`) is called once, if the token was shown it, and one line goes to stderr |
| Any other change                                                                                                                                                 | It finishes                                                                                                                                                                            |

What a start answers with is what its cancel stops. A start that returns work already under way (the same export key, or a proxy that someone else asked for) therefore stops that work. While 16 requests are in progress the server does not read stdin, so a cancellation then waits as any message does.
