# What was tried for one shot (MPR-107)

## What was found (step 0)

At `b8c9f3b`, by reading: no `yamakan.shot.*` command, and a take replacement left only a `project.applyBatch` revision. MPR-101 and MPR-102 are merged with the fields this reads (`source` in a take's record, `endedAt`, `target` and `take` on the run's row, `shot` in a render's payload). Also:

- `jobs` has a text primary key and no `WITHOUT ROWID`, so each row has a number of its own; no code in `core`, `server` or `scripts` deletes job rows or runs `VACUUM`. The order of the attempts is that number.
- Every reader of `story_document_versions` in `core` joins the document's kind, so no table is needed.
- Which commits are undo steps goes by their operation and their writer (`EDIT_HISTORY_OPERATIONS`), so the apply keeps its name, `project.applyBatch`. The render job's kind is `blender-render`.

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
- **A restored copy's run is `uncertain`** while it is unfinished and not dismissed: it belongs to the workspace it was copied from. A dismissed one is `cancelled`, as anywhere.
- **"No prompt text" in the card's acceptance** is met for the prompt fields: no words are read from a run's or a record's prompt. A shot's name, a take's label and an engine's message are given as they are, and may hold some (below).
- **Scan:** `shotAttemptRows` takes how many rows to read and no `before`: totals are over all of them, so a page is cut from what was read. The index finds the newest rows and only those payloads are read, one at a time.
- **A job row whose payload does not read** is skipped, is not counted, and does not make `complete` false.
- **The head's project is loaded,** where the card's performance text says no snapshot is: the card's own `current` (which take the cut shows, and its clips) cannot be read without it.
- **With more than 2,000 notes** the oldest one read stands for the first, so `earlier-replacements` is always said.
- **`route` of a run that made no take** is `kaggle` when its row says it left this computer, and null otherwise.
- **A damaged take record** refuses the answer, as reading that take does; it is not shown as a take without one.

## What to know when reading it

- **The notes are kept for good,** like records, and count against the workspace's document space. An apply is refused when that is full, which it was not before.
- **Words of a prompt can still be in an answer,** though none are read from a run's or a record's prompt: Create names a shot by the first line of its prompt, a label is a person's, and an engine's message is its own.
- **A note that is damaged** (its bytes do not read as one) is left out and nothing says so, and a backup's check does not look at notes.
- **`core/shot-history.ts` cannot be the first module a program imports,** nor can `core/jobs.ts`, which it reads (they and the command registry read each other). The service and the tests import the store first.
- **Nothing here says how good a take is,** and no cost in money exists in this build.

## Evidence

- **On the founder host, against the real store, job table and commands:** the 17 tests of `tests/shot-history.test.ts` pass. The engine is a double and its video is the project's as its rows and ten bytes.
- **`npm run qualify:revisable-shot`** is extended with a ledger arm, a volume arm and the same call over REST and MCP; see the section below.

## The real check

`npm run qualify:revisable-shot` needs ffmpeg through the native helpers, which the founder host's sandbox does not start (ledger 12), so it ran on GitHub's Linux machine: **PASS at `dc47876`** (run 45245057467, `ubuntu-24.04`, no sandbox), with the MPR-101 and MPR-102 steps before it. Its receipt is `MPR-107-shot-history-receipt.json`. It is not evidence of the founder host. Its engine is a double, which runs nothing: the two videos are test patterns, and the times are this check's, not a model's.

The demonstration shot's history, as the command gave it (ids by their first characters; the times are in milliseconds from the first run's start):

| Attempt | Outcome | Started | Ended | Took | Quota | Take it made |
|---|---|---|---|---|---|---|
| 17 `c1428457` | cancelled ("No longer followed here. The engine was not told to stop, and anything running there goes on until it ends.") | 458 | 567 | 109 | not known | none |
| 16 `e600cb79` | failed ("It failed, for this check.") | 335 | 457 | 122 | not known | none |
| 15 `a3a4097d` | succeeded, imported | 133 | 273 | 140 | not known | `daf06447` |
| 14 `34295191` | succeeded, imported | 0 | 127 | 127 | not known | `4a403b3f` |

| Take | How it was made | Record | Added at revision | Shown now |
|---|---|---|---|---|
| `4a403b3f` | a generation, recipe `qualify-pattern`, seed 7, 704x480, 60 frames | `61bbe8c8` | 21 | yes |
| `daf06447` | the same | `213577e8` | 23 | no |

| Replacement | By | From | To | Clips |
|---|---|---|---|---|
| revision 26, then undone | browser-ui | `4a403b3f` | `daf06447` | 1 |

Totals: 4 attempts (2 succeeded, 1 failed, 1 cancelled), 2 takes, 1 replacement, 498 ms in all with none unknown, quota unknown for all 4, complete. Gaps: `untargeted-attempts` (the MPR-101 steps made a run for no shot) and `earlier-replacements` (an assembly is a batch edit).

The volume arm, 2,000 runs of which 250 are the shot's and 300 notes: the slowest of 20 calls took 25.8 ms (criterion 250) and the largest answer is 56,330 bytes (criterion 131,072), in pages of 100, 100 and 50. The service gave the same answer over REST and over MCP.

## Not covered by a test

- A page cut to the size bound is tested with text of the widest characters, not with every field at its longest.
- `tests/take-replace.test.ts` is unchanged: that the apply's result, receipt and undo step are as they were is in `tests/shot-history.test.ts` and in that file's own tests, which need media and run in CI.
- The note's 512-byte ceiling is reached by no note with an ordinary id (a writer's id is at most 64 characters, as in the workspace's own table, and is plain letters, digits and marks; one of 64 control characters would pass the schema, make 686 bytes and be refused), so no test but the one that pins its value would fail with a larger one.
- How long a scan takes with large payloads is held by no test. On the founder host, in memory, `shotAttemptRows` took 44 ms for 5,000 rows of 8 KB, 49 ms for 20,000 and 142 ms for 5,000 of 40 KB, where the query it had before (found by the review) took 207, 321 and 1,548 ms before any row was looked at.
