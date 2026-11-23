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
| `story-refused` | The refusal's own words |
| `busy` | The story kept changing while the take was added; bring it in again. |

**No screen sends a target until MPR-104,** and so no page yet says before an import that the undo history ends, which the card expects of the page; that is MPR-104's too. The contract says it.

## What to know when reading it

- **Which check is the authority:** the start compares the frames asked for with the shot; the import compares the video that came.
- **A run's record is found again by its generation's id** in the shot's takes, so a stop between the story and the run's row, or two imports at once, add one take. A take a person moved to another shot meanwhile is not looked for there.
- **An added take that a person removes is not added again** by importing again: the row holds that it was added.
- **A refusal that is not a command's** (a disk error, a damaged record) is not turned into a reason: the import fails with it after the video is in the project, and importing again tries again.
- **`story-refused` also covers** a story that would grow past its size and creative documents turned off.
- **Where the tests are:** the refusals at the start and the restart are in `tests/generation-target.test.ts` with the rest, and not in `tests/generation-service.test.ts` and `tests/generation-durable.test.ts` as the card has it, because those need a decoder and this file does not.

## Evidence

- **On the founder host, against the real store, job table and commands:** the 10 tests of `tests/generation-target.test.ts` pass. The engine is a double whose video is already the project's, as its rows and ten bytes; no decoder is asked.
- **`npm run qualify:revisable-shot`,** extended with a shot-target arm and its own receipt: see the section below.
- No real browser reads this path: that is MPR-104's.

## The real check

`npm run qualify:revisable-shot` needs ffmpeg through the native helpers, which the founder host's sandbox does not start (ledger 12), so it runs on GitHub's Linux machine with the pull request (`real-checks.yml`). Its receipt, `MPR-102-shot-target-receipt.json`, is added from that run.
