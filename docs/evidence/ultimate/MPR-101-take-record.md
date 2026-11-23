# Every take can name the record of how it was made (MPR-101, part a)

Part a is the record, its storage, story version 2, generation and declared records, and Create. Part b (the Blender record and the recovery check) is not in this change, so **the card is not complete.**

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
- **Story version 2:** `recordHash` on a take, and MPR-106's `brief`, `script` and `intent` as schema and validation, with the text budget. A stored version 1 story is read and never rewritten; its next save is version 2. Every reader the card names reads both.
- **Commands:** `records` on `yamakan.story.save`, `yamakan.take.record`, `recordHash` on `yamakan.take.list`, `kinds` on `yamakan.document.capability`.
- **Ledger:** `endedAt`, set once when a run is first known to have ended. A run nobody asked about for a day therefore has a day in `wallMs`.
- **Create:** a brought-in run or receipt asks for its record, and the story is read back, so that a later save keeps it.

### Where this differs from the card

- **`importedAt` on the ledger row** is one field more than the card's `endedAt`. The record has an `importedAt` time, and no row held one. A record has to come out the same on a retry of the request, so it cannot use the time of the save.
- **`{jobId}` is not accepted yet.** It is part b's, with the Blender builder.
- **A model no recipe fact names** takes the recipe's id, so that the manifest hash the row does hold is kept.
- **A declared record's operation** is read from the take: image to video when its lineage names inputs, else text to video. A receipt file does not say.
- **A declared prompt may be empty,** as a receipt's may. Create declares a receipt's whole prompt up to 4,000 characters, and asks for no record of a longer one. A converted copy's record holds the stored file's hash, not the one its receipt was checked against.
- **The record row's `asset_ids` hold the inputs only.** The card says the output's id too, and a record holds the output by hash.
- **A take's promise lasts while it stays in the story.** A save compares with the head, so a take removed, then added again under its id, can be given other media and another record. The card allows removal and does not speak of the id's reuse. The contract says so.
- **`yamakan.story.save` finds an earlier commit of its request id first** and replays it, also one made by a build that stored version 1.
- **`core/engines/kaggle.ts`** gains `kaggleRecipeFacts` and the reading above, and `core/engines/contract-v2.ts` the report's schema; neither is in the card's file list. A run of a recipe whose model version this build does not know records its facts as unknown, and one of another script of it records its frame rate and steps as unknown.
- **Downgrade:** an older build refuses a version 2 story at read; it does not misread it.
- **Extra files:** `tests/ag-docs-group.test.ts` compared the whole capability answer, which the card extends, so it now compares its two fields. `tests/consent-undo-pinned-take.test.ts`, `tests/continuity-consent.test.ts`, `tests/creative-revision-journey.test.ts`, `tests/take-replace.test.ts` and `tests/director-cinema-shot.test.ts` name the written version in their fixtures. `docs/OPERATIONAL_CONTRACTS.md` describes the new behaviour.
- **OA-5 and OA-16, accepted by the founder on 2026-11-23** ([record](../../FOUNDER_DECISION_RECORD.md#2026-11-23-a-takes-record-also-holds-a-revision-note-and-what-the-run-reported)): `revisionNote`, empty until MPR-103, and `reported`. A Kaggle run's receipt already named its model, revision, seed, packages, Python and torch, and they were dropped when it was read; they are now kept with the run from when it is first known to have succeeded, so a restart before the import loses nothing, and recorded. A run already known to have succeeded before this change has none. A local engine reports nothing, so its record says null. No run was made to check this: the reading is tested with a stand-in CLI and with literal values, and across a restart in CI (`tests/generation-durable.test.ts`). The shot card's list of attempts (the other half of OA-5) was not put to the founder and is open.
- **`buildGenerationRecord` takes the import time from the row,** not as an argument, and an input that is not the first frame has the role `source`.

## Evidence

- **On the founder host, against the real store and commands:** all 27 tests of `tests/take-record.test.ts` pass, and all of `tests/create-story.test.ts`, `tests/create-model.test.ts` and `tests/kaggle-engine.test.ts` (a stand-in CLI, no network), among them a story stored as version 1 by an older build, opened, listed, assembled and saved as version 2. Their media are rows and ten bytes; no decoder is asked. `typecheck`, `lint`, `format:check`, `plan:check`, `provenance:check` and `brand:check` pass.
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
- **The Blender arm** belongs to part b: not built, so not run.
