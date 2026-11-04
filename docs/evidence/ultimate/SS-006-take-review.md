# SS-006: revision-bound take review in the Director panel

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Base main `21fba72652841a1964a6efa96ec0b1c9c49ee349`. Windows, Microsoft Edge, pinned media runtime. No model, provider, limit, schema, dependency or stored-format change.

## Gap reproduced

The take commands existed and were well tested at the command layer, but nothing in the interface called them: `src` had no `yamakan.take.*` call. A person could not see or apply a proposal. `yamakan.take.apply` already recomputes the whole proposal inside its commit and refuses any difference, so no backend change was needed.

## Change

`src/director/TakeReview.tsx` lists a story's shots and takes, calls `yamakan.take.proposeReplace` for the one chosen, shows the affected clip, timing, old and new media version, revision and proposal hash, and sends that same payload to `yamakan.take.apply`.

The review is derived and held only in the panel: there is no new store, no durable approval and no stage output. It is dropped when the project's revision changes. A refused apply drops it and asks for a fresh review. While the editor has unsaved changes, Apply is disabled with a message, because applying replaces what the editor holds; this matches how restoring a revision treats unsaved edits.

Decision: WRAP existing commands. Compare and thumbnails were not added: the panel uses `take.list` metadata only and decodes no original media. The single-clip-shot limitation stays, and a shot that cannot be replaced shows its reason.

## Results

Browser journey, `npm run qualify:take-review`, real stills, real service, Edge, passed on its first run:

1. Four real stills imported through the interface and a three-shot story assembled.
2. Takes listed, with the one shown marked.
3. Review opened by keyboard. The hash, clip and media shown equal a direct `proposeReplace`; the project revision did not move.
4. Another writer changed the project: Apply was refused, the proposal was dropped, nothing changed.
5. A fresh review had a different hash, applied, and changed only the middle clip.
6. The editor's Undo returned the previous take.
7. With a real unsaved edit, Apply was disabled with its message; undoing that edit re-enabled it.
8. Arabic labels and right-to-left page, identifiers left to right.
9. The panel called only `take.proposeReplace` and `take.apply` among take-changing commands, and no Director approve, advance, next or start. Calls made by the harness are excluded from that record.
10. No external requests and no page errors.

Command tests, `tests/take-replace.test.ts`, `tests/take-review.test.ts` and `tests/i18n.test.ts`: 20 of 20. New cases:

- A proposal hash given as a stage output is refused by `advanceStage` and `approveStage`, with the run unchanged, and applying a proposal leaves a run unchanged.
- A proposal sent to another project is refused.
- An agent cannot undo through another writer's later edit: the refusal changes nothing. After that writer undoes its own edit, the agent can undo the take. My first version of this test wrongly expected the undo to succeed; the product's stricter rule is correct, and the test was changed to assert it.
- A malformed `take.list` answer shows "not known", never a partial list.

Existing tests retained for the other negatives, not new: forged mapping, stale revision and story change, missing and unprobed media, revoked consent and scopes in `tests/take-replace.test.ts`. A lost response replayed after reopen is covered by `tests/creative-revision-journey.test.ts`.

## Limits

- TesterArmy was not used; the journey uses Playwright with real Edge. No forced crash during an apply was run here: an interrupted apply relies on the existing transaction, and SS-004b and SS-008 own forced interruption.
- The Arabic strings are the builder's own, with no native Arabic review; that remains X-01.
- An editor whose project head is stale after another client's write learns this only when Apply is refused, or on reopening.
- `accept` on apply resets the playhead and selection, as opening a project does.
- CI runs neither this journey nor Windows media tests for it, so that evidence is local.

Rollback: remove `TakeReview`, `take-review.ts`, their messages, the props and the journey. Commands and stored projects are unaffected.
