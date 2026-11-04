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
| Old replay                                              | Satisfied for receipt-backed commands                                                 | —     |
| Cross-project read                                      | Missing: reads check scope only, and `job.status` and `director.next` take no project | C     |
| Oversized MCP frame                                     | Satisfied, `tests/mcp-transport.test.ts`                                              | —     |
| Secret or path logging                                  | Partly: unit checks only; a GC warning logs an unredacted message                     | C     |

**Riskiest finding, slice B:** a heuristic scan found 14 of 53 mutations that accept a request id and ignore it, including `job.cancel`, `scene.save` and `studio.commit`, which were spot-checked. A caller who retries after a lost response believes it is protected, and is not. Slice B must make each one enforce the id or refuse it.

## Slice A: request ids and errors reach callers

Additive: old fields and result text are unchanged.

- **CLI:** `npm run cli -- <operation> <json> [requestId]` passes an id for replay, and errors now print `retryable` and `requestId`.
- **MCP:** a supplied id, and the one `yamakan_document_save` generates, returns in `_meta["yamakan/requestId"]` on success and failure. Before, a generated save id was never revealed, so a lost response could not be retried under it.
- **Stage route:** a refusal names the caller's valid `X-Request-Id`; a malformed one is not echoed.

Tests, in `tests/mcp.test.ts` and `tests/http.test.ts`, with `tests/parity.test.ts` and `tests/document-clients.test.ts` unchanged and passing: 8 of 8. They cover replay through MCP and the CLI, the same id with other input through MCP, and refusals carrying the id. `yamakan_document_save`'s generated id is not asserted in a new test.

**Not done in this slice:** the SDK still drops the id on success, and JSON-RPC errors for unknown tools remain outside the code set, to keep old clients working.

Rollback: revert this slice; durable receipts are untouched.
