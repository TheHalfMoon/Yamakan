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
| Lost response                                           | Partly: core covered; a browser take apply now covered through SS-006                 | B2    |
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
- **`_meta` carries ids that do not all replay:** the trace id on a refusal with no supplied id, in the CLI too, and an id on a read. Mutations that ignore their id are slice B, which narrows the MCP field's promise of replay; the gaps left after slice B are listed there.

Rollback: revert this slice; durable receipts are untouched.

## Slice B: a mutation with no receipt refuses a request id

The inventory's heuristic scan said 14 of 53. Reading each `run` from the imported registry gives **15**. All 15 now refuse a client's request id with `VALIDATION` before any effect, in `execute`, so every transport gets the same answer. The same call with no id is unchanged. The browser sends no id on any of them, and no test in the repository did.

Refusal rather than a receipt: their retries differ, so one mechanism would not be honest for all of them, and a stored result for `yamakan.agent.create` would hold a live credential.

| Mutation                                   | What a retry does, by source unless marked                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent.create`                             | **Mints another live token**, and no read finds or revokes the orphan after a lost reply                                                                                           |
| `studio.open`                              | New document id each time; persists nothing. Run by the review                                                                                                                     |
| `studio.commit`                            | Same hash; persists nothing                                                                                                                                                        |
| `export.video`, `export.batch`             | Own `idempotencyKey`, at the same project revision only. With other `normalizeLoudness`, `export.video` returns the old job; with other variants, `export.batch` makes a new batch |
| `job.cancel`                               | **Returned an error while a job was being cancelled**; fixed below. Otherwise returns the job as it is                                                                             |
| `export.batchCancel`                       | Skips outputs already being cancelled                                                                                                                                              |
| `job.retry`, `job.discard`, `agent.revoke` | One effect; the second call is refused, so a caller who lost the reply sees an error. Run by the review                                                                            |
| `asset.repair`                             | Refused once released; probes again if the first call did not release it                                                                                                           |
| `consent.revalidate`                       | Converges within an epoch: the insert ignores a duplicate. Run by the review                                                                                                       |
| `scene.save`                               | Whole-file overwrite with no revision check: an identical retry converges, but after another save it overwrites newer work                                                         |
| `workspace.collectGarbage`                 | Deletes only stale unregistered files, so it converges; a lost reply loses the report                                                                                              |
| `director.importLegacy`                    | Converges: inserts ignore duplicates. One run for consents; run files read only                                                                                                    |

`tests/request-id-refusal.test.ts` fails if any mutation neither reads a receipt nor refuses, and pins the list of 15. It was seen to fail before the change. Its check reads the `run` function's source text for `receipt`: a command that names a receipt and ignores it would pass. It runs all 15 with valid input, confirms a refused `agent.create` leaves no token and that the same call with no id creates one, and confirms a receipt command still replays. Only `agent.create` is checked for no effect; the other 14 share the same check before `run`. `job.cancel` is also refused through the CLI and through MCP, in `tests/http.test.ts` and `tests/mcp.test.ts`.

### Independent review of slice B

Nothing blocking in the refusal: it runs after the scope check, and by a scan of 80 call sites only the new tests send an id to these commands. The reviewer's 9 test mutations caught 7. Two rows of the first version of the table above were false. Fixed after it: `job.cancel` on a job being cancelled, which the refusal's advice would have hit, now returns the job; the scope order now has a test; and the refusal no longer tells a caller to read state that has no read.

Found and left open, in a follow-up slice:

- **Three commands named a receipt and did not always replay;** closed in slice B2 below.
- **`proxy.build` and `proxy.cancel` change state but are marked `mutation: false`,** so they ignore an id and advertise `readOnlyHint: true`. Their retries converge.
- **The catalog does not say which mutations refuse,** so a client learns by being refused, and every MCP tool still lists `requestId`.

**A behaviour change:** a client that sent an id on one of these now gets `VALIDATION` and must drop it. None in this repository does; outside clients were not surveyed. Rollback: revert this slice; no data changes.

Full suite, on AC power: 766 tests, 763 passed, 3 skipped, 0 failed, log `b-test2.log`, `9c1d057ac2dd8b78343b376eb3b770b48c81f78f65100d1f459c382e400346b6`. The run before it had 2 failures, both launch error 2. That checkout's helper held no worker profile lock string, and probably was a pre-lock binary left from the A/B comparison; its hash was not kept. Rebuilding from source gave the green run. One failing run and one passing run are consistent with the A/B result and prove nothing further. Both logs predate the final commit of this slice, which then changed tests, docs and the items below. Log `b-test.log`, `4e47e73c4e23ebba81ab94b279aedd8f10f0e30c04d5872923cd536284ba2dba`.

## Slice B2: three commands that did not always replay

Each built its content from the head before the replay check, so a retry after a lost reply saw different content. `captions.split` reported that a cue is split inside its time; `captions.save` after a later edit got `IDEMPOTENCY_MISMATCH`; `scene.migrate` said `migrated: false`, and accepted another source under the same id. None applied twice.

A retry of a committed request now rebuilds from what it first saw: the captions commands read the track by `expectedContentHash` rather than the head, and `scene.migrate` continues to its commit, where the digest check returns the original or refuses. Other input under the same id gets `IDEMPOTENCY_MISMATCH`. A request not yet committed takes the old path unchanged. Tests are in `tests/captions.test.ts` and `tests/cinema-migration.test.ts`. The old behaviour was reproduced by the slice B review, not by a red run of these tests.

**Limits:** the read by hash does not check that the track belongs to this project, as document content is addressed by hash. Only the commit's result returns, never the bytes, so a wrong hash ends in a refusal. If a migrated sidecar file later changes, the retry gets `IDEMPOTENCY_MISMATCH`, and if it is deleted, `NOT_FOUND`, not the original result. Other receipt commands were checked by reading only, not each by a retry.

## Slice C: one read view of committed progress

`yamakan.progress.read`, scope `project:read`, returns format `yamakan.progress` version 1: head revision, the caller's own request id for that revision, the newest 5 Director runs with their newest 20 attempts each, the newest 20 jobs when the caller holds `job:read`, truncation flags, and a cursor. It is derived in one synchronous read from existing tables, with no schema change, new store or subscription. As a registry command it reaches the SDK, CLI and MCP with no adapter code. **The browser can call it through the same SDK but does not yet; its panels still poll their own reads, so browser agreement is not shown.**

- **Cursor:** a hash of the whole view, so it says only "same or different". Passing it as `after` returns `unchanged: true` while the view is the same. It cannot order two reads.
- **Reconnect:** a client simply reads again. A test reopens the workspace and gets the identical view. There is no session to resume.
- **Duplicate or out-of-order reads:** `mergeProgress` in `sdk/progress.ts` joins attempts by run and sequence, keeps runs and jobs only the held view knows, refuses an older revision, keeps a settled job settled, and stays within the view's limits. **No caller uses it yet.** **At the same revision, a late answer can show an older unsettled job state or run version until the next read**, because those have no version to compare. After a restore to a lower revision a client must drop its held view, since this function cannot tell. The inventory's "no events" was too broad: `outbox` records revisions and is readable, but not jobs or attempts, so it cannot order them either.
- **Cross-project read:** the view reads only its project, and an unknown project is `NOT_FOUND`. A cursor from another project is not treated as unchanged. **The older `job.status`, `director.next` and `flow.snapshot` still take no project.** Tokens here hold workspace-wide scopes with no project restriction, so there is no per-project authority for those reads to bypass; they are unchanged.
- **Redaction:** the view omits job errors, artifacts and payloads, which can name host paths; a test plants a path and checks it stays out. The GC warning no longer logs its raw message. This covers those two places, not all logging. **Legacy text is not filtered:** a stage or pipeline name planted in a legacy file reaches readers of both views, though live paths refuse an unknown stage.
- **What `project:read` gains:** run ids per project, attempt history, superseded output hashes and times, where `flow.snapshot` showed the latest per stage only to a caller already holding a run id. No authority comes with these: advancing needs `project:write` and approving is human-only.
- **Job `progress` is as last committed,** which for a running job is usually 0; the live figure is on `yamakan.job.status`.

Tests: `tests/progress-view.test.ts`, 8 tests with planted rows rather than real renders, and `tests/mcp.test.ts`, where MCP, SDK and CLI return a deep-equal view. No live render was watched through the view. Real attempts were not exercised.

**The save replay limit stays:** making the retry work past 15 minutes would change the commit digest and break old receipts. It remains a documented limit: the retry is refused and applies nothing, and a caller reads the head to see what committed. Rollback: revert this slice; no stored data changes.

## Slice D: a bounded handoff that grants nothing

`yamakan.handoff.read` returns format `yamakan.handoff` version 1: project, revision, story and reference hashes (16 of each at most, with a truncation flag), and for the newest run its brief hash, latest attempt and next action. `yamakan.handoff.check` takes a handoff and says whether it is intact, whether it is current, and which fields moved. Both need `project:read`.

**A departure from the card, for the founder to overrule.** The card says to add the handoff "through existing document storage". This slice stores nothing and derives it on each read. Reasons: committing a document makes a new revision, so storing a handoff moves the head, and every holder of an `expectedRevision` then gets a conflict for a note that changed nothing; a stored one could only name the revision before its own commit. And `DocumentKind` is a closed enum read by `DocumentRefSchema`, so by reading, a build reverted past a `handoff` kind should refuse snapshots holding one, which conflicts with the card's rollback of reverting a presentation delta; this was not run. The table itself would accept a new kind since `SCHEMA_V14`: a first version of this note wrongly said it needed a rebuild, and review caught that. Everything a handoff holds is already committed. **What is lost:** a person cannot leave free-text notes in a handoff, and an old handoff exists only if the caller kept it.

- **No authority:** the schema is strict, so a `token` or `scopes` field is refused; a test also scans a real handoff for those words and for the run's principal, and shows an agent presenting one still cannot create a project. Jobs are left out, so a handoff shows only what any project reader may see.
- **Checks on resume:** `handoffHash` catches a handoff edited to claim the current state. It is a plain hash, so it detects accidents and casual edits, not a forger, who can recompute it. That costs nothing, because `check` compares against fresh state and a handoff grants nothing.
- **Limits:** a run whose pipeline this build does not know, as an import can bring, reads with `nextAction.kind: "unknown"` rather than failing. Only the `framework-smoke` manifest exists to test with. "Brief" means the output of the stage that produces `research_brief`, and "evidence" is the latest attempt's `outputHash`. The browser does not show a handoff yet.

Tests: `tests/handoff.test.ts`, 8 tests; its document cases plant the document list rather than committing 17 stories, which the review did separately. Rollback: revert this slice; no stored data changes.
