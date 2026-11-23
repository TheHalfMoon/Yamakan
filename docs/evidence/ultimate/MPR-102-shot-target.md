# A generation made for a story shot (MPR-102)

## What was found (step 0)

At `f6f11f4`: `yamakan.generation.start` had no `target`, `GenerationRecord` had none, and an import answered `{assetId, lineage}`. MPR-101 is merged (`core/take-record.ts`, story version 2, attachments on `commitDocument`). The job table keeps a run as JSON, so the two optional fields need no step, and a row without them reads as a run made for no shot.

## What was built

- **`target` at the start,** checked against the head before `ledger.begin` (`assertGenerationTarget` in `core/takes.ts`), and kept in the run's row.
- **`appendGeneratedTake`** (`core/takes.ts`): reads the story as it is at the import, adds the take with its record in one `commitDocument`, checked as a story's own save is. `yamakan.generation.import` calls it after the import, keeps its outcome on the row and answers with it.
- **`target` and `take`** in the answers of `yamakan.generation.list` and `yamakan.generation.status`.

**Every reason, and what a person reads:**

| `reason` | Text |
|---|---|
| `story-gone` | This project has no such story. |
| `shot-gone` | The story has no such shot. |
| `shot-full` | The shot already holds 8 takes; remove one before generating another. |
| `take-too-short` | The shot lasts 2 s and this take lasts 1 s; ask for a longer take or shorten the shot. |
| `story-refused` | The refusal's own words: a reference whose consent ended, media a restore took away, a damaged record in the shot, a story past its size, the project's history or the disk full, creative documents turned off |
| `busy` | The story kept changing while the take was added; bring it in again. Or the store's own words when it is busy |

**No screen sends a target until MPR-104,** and so no page yet says before an import that the undo history ends, which the card expects of the page; that is MPR-104's too. The contract says it.

## Where this differs from the card

- **At the start, creative documents turned off** is a fifth refusal, `CAPABILITY_UNAVAILABLE`, as every story command has it; at the import it is `story-refused`.
- **`busy` is also the store's own "busy",** which the card does not speak of, since it passes and no check refused anything.
- **A damaged record in the shot is `story-refused`,** because it may be this run's own, and adding another could be adding it twice. It stays so until that take is removed or a backup restored.
- **What is no refusal of the take** (a disk error, or a story document that is itself damaged) is not turned into a reason: the import fails with it, after the video is in the project, and importing again tries again.
- **The tests of the start's refusals and of the restart** are in `tests/generation-target.test.ts` with the rest, and not in `tests/generation-service.test.ts` and `tests/generation-durable.test.ts`: those need a decoder, and this file runs on every host.
- **The card expects the page to say before the import that the undo history ends.** No page sends a target yet, so that is MPR-104's; the contract says it.

## What to know when reading it

- **Which check is the authority:** the start compares the frames asked for with the shot; the import compares the video that came.
- **One take for one run:** the row remembers that it was added, so importing again adds nothing, also after a person took it out. Until that is on the row (a stop between the story and the row, two imports at once), the run's take is looked for in the target shot by the run's id. If a person moved or removed it in exactly that window, importing again adds it there.
- **A run cancelled after its import** is still added by importing again, as a save by hand could.
- **After a restore to before the take,** importing again still answers that it was added, as the card has it, though the take is not in the story any more.

## Evidence

- **On the founder host, against the real store, job table and commands:** the 13 tests of `tests/generation-target.test.ts` pass, among them a real refusal by a consent that ended, a version 1 story, and a stop and restart in the middle. The engine is a double whose video is already the project's, as its rows and ten bytes; no decoder is asked.
- **`npm run qualify:revisable-shot`,** extended with a shot-target arm and its own receipt: see the section below.
- No real browser reads this path: that is MPR-104's.

## Not covered by a test

- That the append checks the other takes' continuity references (`verifyStoryContinuity`): an added take has none, and the review's mutation that removes the call is not caught.

## The real check

`npm run qualify:revisable-shot` needs ffmpeg through the native helpers, which the founder host's sandbox does not start (ledger 12), so it ran on GitHub's Linux machine: **PASS at `29a170a`** (run 45228582330, `ubuntu-24.04`, no sandbox), with the MPR-101 steps before it. Its receipt is `MPR-102-shot-target-receipt.json`: five steps, each with the hash of the assembled cut before and after the import, which is one and the same. It is not evidence of the founder host.
