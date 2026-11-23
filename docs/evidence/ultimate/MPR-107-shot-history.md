# What was tried for one shot (MPR-107)

## What was found (step 0)

At `b8c9f3b`, by reading: no `yamakan.shot.*` command, and a take replacement left only a `project.applyBatch` revision. MPR-101 and MPR-102 are merged with the fields this reads (`source` in a take's record, `endedAt`, `target` and `take` on the run's row, `shot` in a render's payload). Also:

- `jobs` has a text primary key and no `WITHOUT ROWID`, so each row has a number of its own; no code in `core`, `server` or `scripts` deletes job rows or runs `VACUUM`. The order of the attempts is that number.
- Every reader of `story_document_versions` in `core` joins the document's kind, so no table is needed.
- An undo step is recorded for a commit named `project.applyBatch` with a writer, and any other operation ends the undo history (`EDIT_HISTORY_OPERATIONS`), so the apply keeps that name. The render job's kind is `blender-render`.

## Every field, and where it is read from

| Field | From |
|---|---|
| `documentId`, `shotId`, `sceneId`, `name`, `contentHash`, `revision`, `current` | the story and the timeline at the head, as `yamakan.take.list` reads them |
| `takes`: `takeId`, `kind`, `label`, `selected`, `shown`, `recordHash` | the same |
| `takes`: `addedAtRevision` | the `story_document_versions` row that holds the record for this story |
| `takes`: `origin`, `route`, `source`, `summary`, `timings`, `usage`, `derivedFromTakeId`, `changedFields` | the take's record (MPR-101), read by its hash |
| `attempts`: `seq`, `kind`, `id` | the job row's number, kind and id |
| `attempts`: `outcome`, `sent`, `imported`, `recipeId`, `startedAt`, `endedAt`, `diagnostic` | a generation's row payload; a render's `state`, `artifact` and `error` |
| `attempts`: `wallMs` | `endedAt` less `startedAt`, when the row has both |
| `attempts`: `route`, `quotaSeconds` | the record of the take it made, when the shot holds it; a generation that left this computer is `kaggle` |
| `attempts`: `takeId`, `takeInShot` | the row's `take` (MPR-102), else the record of a take the shot holds |
| `attempts`: `derivedFromTakeId` | the row, when it has it (MPR-103 writes it) |
| `replacements`, `replacementTotal` | the notes that `yamakan.take.apply` writes |
| `totals`, `next`, `gaps` | counted over all of the above |

## The gaps, in plain words

- **Runs made before shots could be named** (MPR-102), or started without one, belong to no shot: `untargeted-attempts`.
- **Renders before the shot link** (MPR-101), or asked for outside a story shot: `unlinked-renders`.
- **Replacements before the notes**: any earlier batch edit may have been one, so `earlier-replacements` is said when the project has a batch revision older than the story's first note. An assembly is such a batch too.
- **A take that was removed from the shot** and did not come from a run made for the shot is not in the history: only earlier story versions know it.
- **Quota** is reported by no adapter today, so it is null and counted as unknown.
- A project with more than 5,000 runs and renders, or a story with more than 2,000 notes, is read from the newest: `scan-limit`, and `complete` is false.

## Where this differs from the card

- **The note's schema is in `core/take-record.ts`,** which the document checks read, and `core/shot-history.ts` exports it: the other way round the modules would read each other.
- **`takeId` of a run or render whose row names none** is the take whose record says it made it, so a take saved by hand or a render placed on the shot is not lost.
- **A render is always `sent`.** Nothing of it leaves this computer, so the question does not arise.
- **A restored copy's run is `uncertain`:** it belongs to the workspace it was copied from.
- **`route` of a run that made no take** is `kaggle` when its row says it left this computer, and null otherwise.
- **A damaged take record** refuses the answer, as reading that take does; it is not shown as a take without one.

## What to know when reading it

- **The notes are kept for good,** like records, and count against the workspace's document space. An apply is refused when that is full, which it was not before.
- **Nothing here says how good a take is,** and no cost in money exists in this build.

## Evidence

- **On the founder host, against the real store, job table and commands:** the 14 tests of `tests/shot-history.test.ts` pass. The engine is a double and its video is the project's as its rows and ten bytes.
- **`npm run qualify:revisable-shot`** is extended with a ledger arm, a volume arm and the same call over REST and MCP; see the section below.

## Not covered by a test

- A page cut to the size bound is tested with text of the widest characters, not with every field at its longest.
- `tests/take-replace.test.ts` is unchanged: that the apply's result, receipt and undo step are as they were is in `tests/shot-history.test.ts` and in that file's own tests, which need media and run in CI.
- The note's 512-byte ceiling is reached by no note the schema allows, so a larger ceiling would fail no test; its value is pinned.
