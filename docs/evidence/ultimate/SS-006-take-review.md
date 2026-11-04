# SS-006: revision-bound take review in the Director panel

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Base main `21fba72652841a1964a6efa96ec0b1c9c49ee349`. Windows, Microsoft Edge, pinned media runtime. No model, provider, limit, schema, dependency or stored-format change.

## Gap reproduced

The take commands existed and were well tested at the command layer, but nothing in the interface called them: `src` had no `yamakan.take.*` call. A person could not see or apply a proposal. `yamakan.take.apply` already recomputes the whole proposal inside its commit and refuses any difference, so no backend change was needed.

## Change

`src/director/TakeReview.tsx` lists a story's shots and takes, calls `yamakan.take.proposeReplace` for the one chosen, shows the affected clip, timing, old and new media version, revision and proposal hash, and sends that same payload to `yamakan.take.apply`.

The review is derived and held only in the panel: there is no new store, no durable approval and no stage output. It is dropped when the project's revision changes, including while it is still being made.

The host sends the apply under its own busy state, so no edit or project switch runs beside it, and an answer for a project no longer open does not replace the editor. A lost response, or one the service did not write such as an unreadable body, is asked again under the same request id. If that fails too, the panel says the outcome is not known, rather than that it failed. While the editor has unsaved changes or holds a rejected draft, Apply is disabled with a message. Only plain refusals are shown as the service wrote them, capped at 200 characters; anything else shows a general message.

Decision: WRAP existing commands. Compare and thumbnails were not added: the panel uses `take.list` metadata only and decodes no original media. The single-clip-shot limitation stays, and a shot that cannot be replaced shows its reason.

## Results

Browser journey, `npm run qualify:take-review`, real stills, real service, Edge, at the head named in the PR. An earlier 10-step version passed on its first run, and independent review then found three panel defects it could not see: a superseded review left every button disabled; Apply ran outside the editor's busy state, so an edit or project switch could be lost; and a lost response was reported as "not applied". All three are fixed and now covered:

1. Four real stills imported through the interface and a three-shot story assembled.
2. Takes listed, with the one shown marked.
3. Review opened by keyboard. The hash, clip and media shown equal a direct `proposeReplace`; the project revision did not move.
4. Another writer changed the project: Apply was refused as stale, the proposal was dropped, nothing changed.
5. A fresh review had a different hash, applied, and changed only the middle clip.
6. The editor's Undo returned the previous take.
7. A review held back while a local edit committed: the stale notice shows, the late proposal is dropped, and the buttons stay enabled.
8. With a commit held back, Apply is disabled with its message; when the commit lands, the review is stale and gone.
9. While an apply is held back, Undo and the project row are disabled; when it lands they return.
10. A response dropped after the service answered: asked again under the same request id, the request carries the hash shown, and the revision moves by one.
11. A response lost twice: the panel says the outcome is not known, and the project did change.
12. Arabic labels and right-to-left page, identifiers left to right.
13. The panel called only `take.proposeReplace` and `take.apply` among take-changing commands, and no Director approve, advance, next or start. Calls made by the harness are excluded from that record.
14. No external requests and no page errors.

Command tests, `tests/take-replace.test.ts`, `tests/take-review.test.ts` and `tests/i18n.test.ts`: 21 of 21. New cases:

- A proposal hash given as a stage output is refused by `advanceStage` as not stored. With a real stored output under review, `approveStage` refuses the proposal hash for that reason and not because the stage is unfinished; an earlier version of this check could not tell the two apart. The run stays unchanged, and applying a proposal leaves it unchanged.
- Internal errors and over-long reasons are not shown as written.
- A proposal sent to another project is refused.
- An agent cannot undo through another writer's later edit: the refusal changes nothing. After that writer undoes its own edit, the agent can undo the take. My first version of this test wrongly expected the undo to succeed; the product's stricter rule is correct, and the test was changed to assert it.
- A malformed `take.list` answer shows "not known", never a partial list.

Existing tests retained for the other negatives, not new: forged mapping, stale revision and story change, missing and unprobed media, revoked consent and scopes in `tests/take-replace.test.ts`. Agent self-approval is refused in `tests/director-durability.test.ts` and `tests/director-stages.test.ts`, which pass in the full suite at this head. That run was not green: 754 of 759 passed, 3 skipped, and 2 failed outside this change. One is a probe timeout under load in `tests/process-owner-shared-access.test.ts`, addressed separately; the other is `cancellation terminates the worker's job` in `tests/process-owner.test.ts`, which passed in every other run and is unexplained. An earlier run on battery had 7 timing failures. A lost response replayed after reopen is covered by `tests/creative-revision-journey.test.ts`.

## Limits

- TesterArmy was not used; the journey uses Playwright with real Edge. No forced crash during an apply was run here: an interrupted apply relies on the existing transaction, and SS-004b and SS-008 own forced interruption.
- The Arabic strings are the builder's own, with no native Arabic review; that remains X-01.
- The panel does not watch the story or consent. A change by another client that the editor has not seen is found when Apply is refused, which is safe but means the card's refresh on story or input change happens only for changes the editor knows of.
- An editor whose project head is stale after another client's write learns this only when Apply is refused, or on reopening.
- The panel reads the take list on each revision, even while the Director section is closed.
- `accept` on apply resets the playhead and selection, as opening a project does.
- CI runs neither this journey nor Windows media tests for it, so that evidence is local.

Rollback: remove `TakeReview`, `take-review.ts`, their messages, the props and the journey. Commands and stored projects are unaffected.
