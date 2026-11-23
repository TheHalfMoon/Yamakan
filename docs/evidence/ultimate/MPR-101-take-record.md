# Every take can name the record of how it was made (MPR-101)

Part a (PR 291, merged as `6b9fb8e`) is the record, its storage, story version 2, generation and declared records, and Create. Part b is the Blender record and the recovery check; its section is at the end. **The card is not complete:** none of its browser and end-to-end checks has run.

## What was found (step 0)

By reading the head this branch starts from:

- `TakeSchema` had no record field, `DOCUMENT_SCHEMA_VERSIONS.story` was 1, `DocumentKind` had no `takeRecord`, and no `yamakan.take.record` command existed. The gap is as the card says.
- **FD-2 is not recorded as decided** (`docs/FOUNDER_DECISION_RECORD.md`), so `RECORD_HOLDS_PROMPT` is false.
- `verifyStory` is called by `yamakan.story.save`, `yamakan.story.assemble` and `yamakan.take.apply`. A document revert refuses a story, and a project restore does not call it. So the rule that a take keeps its record is in the save command.
- The `asset_ids` of a document row are read only for documents a project names (`#assertDocumentAssets`). A record is never one, so its list protects nothing; it is kept for the reader.
- `verifyStoryContinuity` reads only continuity references, and is unchanged.
- `documentsPerProject` is enforced on the project's document references (`core/canonical.ts`), so records do not count against it.

## What was built

- **`core/take-record.ts`:** the schema, limits, hash, and the generation and declared builders.
- **Storage:** `commitDocument` takes at most 8 records with a story and writes them in the same transaction and budget check: one `creative_documents` row and one `story_document_versions` row each. No SQL schema step.
- **Story version 2:** `recordHash` on a take, and MPR-106's `brief`, `sceneText` and `intent` as schema and validation, with the text budget. A stored version 1 story is read and never rewritten; its next save is version 2. Every reader the card names reads both.
- **Commands:** `records` on `yamakan.story.save`, `yamakan.take.record`, `recordHash` on `yamakan.take.list`, `kinds` on `yamakan.document.capability`.
- **Ledger:** `endedAt`, set once when a run is first known to have ended. A run nobody asked about for a day therefore has a day in `wallMs`.
- **Create:** a brought-in run or receipt asks for its record, and the story is read back, so that a later save keeps it.

### Where this differs from the card

- **MPR-106's scene field is `sceneText`, not `script`.** CI found it at `30be0f2`: `tests/command.test.ts` forbids `script` in any command's input, and story version 2 is one. That test guards security, so the field was renamed, in both cards and the code, and the test was not touched. Nothing writes the field yet. Three reviews before that run had not noticed it.
- **With FD-2 on, a largest-case record would not fit.** As the reviewer measured it, a 4,000-character CJK prompt with a full report and note is about 19.6 KB against 16,384 bytes (about 14.9 KB without those two). Today, with no prompt, the largest is about 9 KB. It must be settled before `RECORD_HOLDS_PROMPT` is turned on.
- **`importedAt` on the ledger row** is one field more than the card's `endedAt`. The record has an `importedAt` time, and no row held one. A record has to come out the same on a retry of the request, so it cannot use the time of the save.
- **A model no recipe fact names** takes the recipe's id, so that the manifest hash the row does hold is kept.
- **A declared record's operation** is read from the take: image to video when its lineage names inputs, else text to video. A receipt file does not say.
- **A declared prompt may be empty,** as a receipt's may. Create declares a receipt's whole prompt up to 4,000 characters, and asks for no record of a longer one. A converted copy's record holds the stored file's hash, not the one its receipt was checked against.
- **The record row's `asset_ids` hold the inputs only.** The card says the output's id too, and a record holds the output by hash.
- **A take's promise lasts while it stays in the story.** A save compares with the head, so a take removed, then added again under its id, can be given other media and another record. The card allows removal and does not speak of the id's reuse. The contract says so.
- **`yamakan.story.save` finds an earlier commit of its request id first** and replays it, also one made by a build that stored version 1.
- **`core/engines/kaggle.ts`** gains `kaggleRecipeFacts` and the reading above, and `core/engines/contract-v2.ts` the report's schema; neither is in the card's file list. A run of a recipe whose model version this build does not know records its facts as unknown, and one of another script of it records its frame rate and steps as unknown.
- **Downgrade:** an older build refuses a version 2 story at read; it does not misread it.
- **Extra files:** `tests/ag-docs-group.test.ts` compared the whole capability answer, which the card extends, so it now compares its two fields. `tests/consent-undo-pinned-take.test.ts`, `tests/continuity-consent.test.ts`, `tests/creative-revision-journey.test.ts`, `tests/take-replace.test.ts` and `tests/director-cinema-shot.test.ts` name the written version in their fixtures. `docs/OPERATIONAL_CONTRACTS.md` describes the new behaviour.
- **OA-5 and OA-16, accepted by the founder on 2026-11-23** ([record](../../FOUNDER_DECISION_RECORD.md#2026-11-23-a-takes-record-also-holds-a-revision-note-and-what-the-run-reported)): `revisionNote`, empty until MPR-103, and `reported`. A Kaggle run's receipt already named its model, revision, seed, packages, Python and torch, and they were dropped when it was read; they are now kept with the run from when it is first known to have succeeded, so a restart before the import loses nothing, and recorded. A run already known to have succeeded before this change has none. These are its script's own: the packages it asks for, not all that was installed, its model, and the seed it was sent, so they do not prove how a take was made. A local engine reports nothing, so its record says null. No run was made to check this: the reading is tested with a stand-in CLI and with literal values, and across a restart in CI (`tests/generation-durable.test.ts`). The shot card's list of attempts (the other half of OA-5) was not put to the founder and is open.
- **`buildGenerationRecord` takes the import time from the row,** not as an argument, and an input that is not the first frame has the role `source`.

## Evidence

- **On the founder host, against the real store and commands:** the 28 tests that `tests/take-record.test.ts` had at `870cb5f` pass, with the catalog test of `tests/command.test.ts`, and all of `tests/create-story.test.ts`, `tests/create-model.test.ts` and `tests/kaggle-engine.test.ts` (a stand-in CLI, no network), among them a story stored as version 1 by an older build, opened, listed, assembled and saved as version 2. Their media are rows and ten bytes; no decoder is asked. `typecheck`, `lint`, `format:check`, `plan:check`, `provenance:check` and `brand:check` pass.
- **Measured:** in 262,144 bytes fit 109 shots of 8 takes without record hashes and 86 with. A record hash is 80 bytes of a take, as the card estimated. The card estimated 94 shots.
- **Media tests, in GitHub CI only:** a run started, followed, imported and saved with its record (`tests/generation-service.test.ts`), and a story saved in each form assembled (`tests/story-packs.test.ts`). Their result is the pull request's CI run at its head.

The card's `document.commit` and `kinds` cases for `tests/creative-documents.test.ts` are in `tests/take-record.test.ts`.

## Not covered by a test

- That no log line holds a prompt, and the budget check of a record (4 GiB).
- `tests/parity.test.ts` is unchanged: it compares the two transports' tools from the one registry, which both new inputs are in.
- `yamakan.document.commit` and the store refuse a record in the same words, and the store is tested directly, so the command's own refusal could be removed without a test failing.
- A run kept only in this machine's memory (ComfyUI, which this build cannot start: it has no qualified recipe) is gone after a restart, and a save that asks for its record is then refused each time.

## Not run, and not claimed

- **`npm run qualify:revisable-shot`** (new) and **`npm run qualify:create-durable`** (extended) pass `node --check` and have never run. On Linux the first always ends BLOCKED, since it looks for the Windows helper (unless `YAMAKAN_PROCD` names one). They need ffmpeg and the native helpers, which are not built in this checkout; media tests failed on the founder host at `3de9b10` with them built (ledger 12 lists them; the cause is likely, not proven). `MPR-101-take-record-receipt.json` is not written.
- `npm run test:e2e` was not run here.
- **The Blender arm** is part b's, below.

## Part b: the Blender record and the recovery check

### What was built

- **The job's payload** may name the story shot and the direction a render was planned from; `renderStoryShot` sets both. A payload without them, as every earlier one, still reads.
- **`{jobId}`** in a story save's `records`: the job must be this project's, a finished Blender render, and have made the take's media. `buildRenderRecord` takes its facts from the job's row: the Blender version, the scene's format and hash, its size, frames and samples, the camera, the moves, and the direction.
- **The Cinema panel** passes its render's job id, and placing the take asks for its record.
- **`creativeClosure`** (a backup's and a restore's check; `diagnose` does not call it) reports every record that a retained story names and that is missing, is not held for that story, or does not match its hash. The card asks for presence and hash; a record that is stored but not held would let no save of its story through.

### Where it differs from the card

- **The record does not name the shot.** A render planned for one shot can be recorded on a take of another in the same project, as its video can be used there. The payload's `shot` is kept and not read yet, as the card has it.
- **Which renders are the same one:** the shot and direction are part of a job's key, so a second request for the same scene from another shot or direction, while the first runs, is now refused as already running instead of returning the first.
- **`sceneHash` is of the scene as the job row stores it,** not as this build reads it, so a later default does not change it.
- **The moves always hold `dolly`, `panDegrees` and `shake`,** since the scene holds them (0 when there is none). The card has them optional.
- **`lighting` and `view` are read from the direction,** as the planner reads it, because the scene holds the light and camera they became. A render that no shot asked for has neither.
- **The Blender version is this build's pin** when the record is made. A render made under an earlier pin and first recorded under a later one would name the later one; there has been one pin.
- **A render placed before this change** has a take without a record, and its take can still be given one by a save that names its job.
- **An older build** does not read a queued render whose payload has the new fields, and sets it aside as failed. This matters only when going back to it with a render waiting.
- `tests/blender-render.test.ts` and `tests/creative-recovery.test.ts` are not changed: the payload without the new fields and the recovery check are tested in `tests/take-record.test.ts`.

### Evidence

- **On the founder host:** all 35 tests of `tests/take-record.test.ts` pass. The renders are planned by the Director's own code and submitted to the real job table, where each is claimed and goes no further; their end is written to the row.
- **Not run: `npm run qualify:director-cinema`,** extended with the placed takes' records and syntax-checked. It needs the pinned Blender, whose sandboxed start is BLOCKED on the founder host (ledger 12); the script now says BLOCKED for that status (3221225506) and records what the host has first. **The Blender arm is BLOCKED, not PASS.**
