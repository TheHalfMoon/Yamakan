# SS-007: request, progress and handoff semantics

Started 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Base main `e8663502d471695d35220e4f22d3654f77a45b81`. This card exceeds one coherent PR, so it lands in slices. **It stays open.** The registry keeps its 31 stable task identities, so slices are recorded here rather than as new cards.

## Inventory

Read from source at the base, not run. Durable replay is solid: receipts key on principal, project and request; replay is checked before the revision check; the same id with other input is `IDEMPOTENCY_MISMATCH`.

| Card item                                               | At the base                                                                           | Slice |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----- |
| Stable request ids agree across SDK, CLI, MCP, browser  | Partly                                                                                | A, B  |
| Errors agree                                            | Partly: MCP and CLI drop fields; JSON-RPC errors sit outside the code set             | A     |
| Progress agrees, in a versioned read view with a cursor | Missing: only separate per-resource reads, all polled                                 | C     |
| Reconnect resumes committed state                       | Partly: replay and polling exist; no snapshot or session recovery                     | C     |
| Bounded handoff document, no authority                  | Missing                                                                               | D     |
| Lost response                                           | Partly: core covered; a browser take apply now covered through SS-006                 | C     |
| Duplicate or out-of-order event                         | Missing: there are no events                                                          | C     |
| Old replay                                              | Satisfied except saves: see the review findings in slice A                            | C     |
| Cross-project read                                      | Missing: reads check scope only, and `job.status` and `director.next` take no project | C     |
| Oversized MCP frame                                     | Satisfied, `tests/mcp-transport.test.ts`                                              | —     |
| Secret or path logging                                  | Partly: unit checks only; a GC warning logs an unredacted message                     | C     |

**Riskiest finding, slice B:** a heuristic scan found 14 of 53 mutations that accept a request id and ignore it, including `job.cancel`, `scene.save` and `studio.commit`, which were spot-checked. For most, a caller who retries after a lost response believes it is protected, and is not; `studio.commit` persists nothing, so its retry is harmless. Slice B must make each one enforce the id or refuse it.

## Slice A: request ids and errors reach callers

Old fields and result text are unchanged. Four things do change: the CLI's usage text, its third positional, the stage route's refusal, which now names the caller's id rather than a generated one, and the message for a save id of 122 to 128 characters, which is now the general `Invalid command envelope.` with the same code. The browser checks the stage refusal's id only for null, so it is unaffected.

- **CLI:** `npm run cli -- <operation> <json> [requestId]` passes an id for replay, and errors now print `retryable` and `requestId`.
- **MCP:** a supplied id, and the one `yamakan_document_save` generates, returns in `_meta["yamakan/requestId"]` on success and on a tool refusal. A refused save returns its own id rather than the `.stage` or `.commit` id the service echoes, because retrying under those replays nothing. Other refused calls with no id return the service's trace id, which is for reporting and cannot replay. **This does not make a generated id safe after a lost response:** if the connection fails, or the reply to the MCP client is lost, no id arrives. Lost-response safety needs the caller to supply the id.
- **Stage route:** a refusal names the caller's valid `X-Request-Id`; a malformed one is not echoed.

Tests, in `tests/mcp.test.ts`, `tests/http.test.ts`, `tests/document-clients.test.ts` and `tests/ag-docs-group.test.ts`, with `tests/parity.test.ts` unchanged and passing. They cover replay through MCP and the CLI, the same id with other input through MCP, refusals carrying the id, a refused save returning its root id, and a malformed id not being echoed. A review reproduced the suffixed-id defect against a stubbed service before this was fixed. `tests/ag-docs-group.test.ts` asserts the generated id on a save that succeeds.

The CLI's third positional argument was ignored before and is now the request id; no invocation outside these tests passes one. **Not done in this slice:** the SDK still drops the id on success, and JSON-RPC errors for unknown tools remain outside the code set, to keep old clients working.

### Independent review at `d6fdfb5`

Nothing blocking and no security defect; the reviewer applied 11 mutations to the tests, and 10 were caught. It ran probes against a real local service. Fixed after it:

- A refused first tool list replaced a supplied id with the service's, the path that bypassed the rule above.
- A save id of 122 to 128 characters was echoed although a save cannot use it.
- `--verbose` as the CLI's third positional became a request id and silently replayed. A CLI id may no longer start with `-`.
- The trace-id fallback had no test, and two comments said the wrong thing.

Found and left open:

- **A save's retry stops replaying up to 15 minutes after staging.** A consumed upload is forgotten after `uploadTtlMs`, counted from the stage rather than the commit, so a retry stages anew, gets a new upload id, and is refused as `IDEMPOTENCY_MISMATCH` instead of returning the original result. A second review reproduced this by expiring the row and saw no new revision. The bytes of that refused retry stay sealed for up to 15 minutes and hold one of 2 upload slots per principal, as any save refused at commit does; with both held, a save or late retry gets `LIMIT_EXCEEDED`. This predates the slice, which does make the id more visible. Real 15-minute waits were not run. Slice C owns it.
- **`_meta` carries ids that do not all replay:** the trace id on a refusal with no supplied id, in the CLI too, and an id on a read. Mutations that ignore their id are slice B, which is also when the MCP field's promise of replay becomes true.

Rollback: revert this slice; durable receipts are untouched.

## Slice B: a mutation with no receipt refuses a request id

The inventory's heuristic scan said 14 of 53. Reading each `run` from the imported registry gives **15**. All 15 now refuse a client's request id with `VALIDATION` before any effect, in `execute`, so every transport gets the same answer. The same call with no id is unchanged. The browser sends no id on any of them, and no test in the repository did.

Refusal rather than a receipt: their retries differ, so one mechanism would not be honest for all of them, and a stored result for `yamakan.agent.create` would hold a live credential.

| Mutation                                                   | What a retry does, read from source, not run                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `agent.create`                                             | **Mints another live token**                                                                           |
| `studio.open`                                              | New document id each time; persists nothing                                                            |
| `export.video`, `export.batch`                             | Own `idempotencyKey`, but only at the same project revision. The refusal says so                       |
| `job.cancel`                                               | Converges; a terminal job returns as it is                                                             |
| `export.batchCancel`                                       | Converges                                                                                              |
| `job.retry`, `job.discard`, `asset.repair`, `agent.revoke` | One effect; the second call is refused, so a caller who lost the reply sees an error                   |
| `consent.revalidate`                                       | Adds another revalidation row                                                                          |
| `scene.save`, `studio.commit`                              | Not traced past the command: `studio.commit` persists nothing; `scene.save` persists when Cinema is on |
| `workspace.collectGarbage`, `director.importLegacy`        | Not traced                                                                                             |

`tests/request-id-refusal.test.ts` fails if any mutation neither reads a receipt nor refuses, and pins the list of 15. It was seen to fail before the change. Its check reads the `run` function's source text for `receipt`: a command that names a receipt and ignores it would pass. It runs all 15 with valid input, confirms a refused `agent.create` leaves no token and that the same call with no id creates one, and confirms a receipt command still replays. Only `agent.create` is checked for no effect; the other 14 share the same check before `run`. `job.cancel` is also refused through the CLI and through MCP, in `tests/http.test.ts` and `tests/mcp.test.ts`.

**A behaviour change:** a client that sent an id on one of these now gets `VALIDATION` and must drop it. None in this repository does; outside clients were not surveyed. Rollback: revert this slice; no data changes.

Full suite, on AC power: 766 tests, 763 passed, 3 skipped, 0 failed, log `b-test2.log`, `9c1d057ac2dd8b78343b376eb3b770b48c81f78f65100d1f459c382e400346b6`. The run before it had 2 failures, both launch error 2. That checkout's helper turned out to lack the worker profile lock, because the builder had left a pre-lock binary there during the A/B comparison. Rebuilding it from source gave the green run. One failing run and one passing run are consistent with the A/B result and prove nothing further. Log `b-test.log`, `4e47e73c4e23ebba81ab94b279aedd8f10f0e30c04d5872923cd536284ba2dba`.
