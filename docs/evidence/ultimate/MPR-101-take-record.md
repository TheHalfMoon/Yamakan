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
- **Ledger:** `endedAt`, set once when a run is first known to have ended.
- **Create:** a brought-in run or receipt asks for its record, and the story is read back, so that a later save keeps it.

### Where this differs from the card

- **`importedAt` on the ledger row** is one field more than the card's `endedAt`. The record has an `importedAt` time, and no row held one. A record has to come out the same on a retry of the request, so it cannot use the time of the save.
- **`{jobId}` is not accepted yet.** It is part b's, with the Blender builder.
- **A model no recipe fact names** takes the recipe's id, so that the manifest hash the row does hold is kept.
- **A declared record's operation** is read from the take: image to video when its lineage names inputs, else text to video. A receipt file does not say.
- **A declared prompt may be empty,** as a receipt's may.
- **`core/engines/kaggle.ts`** gains `kaggleRecipeFacts`, and is not in the card's file list. A run of a recipe whose model version this build does not know records those facts as unknown.
- **Downgrade:** an older build refuses a version 2 story at read; it does not misread it.
- **Extra files:** `tests/ag-docs-group.test.ts` compared the whole capability answer, which the card extends, so it now compares its two fields. `tests/consent-undo-pinned-take.test.ts`, `tests/continuity-consent.test.ts`, `tests/creative-revision-journey.test.ts`, `tests/take-replace.test.ts` and `tests/director-cinema-shot.test.ts` name the written version in their fixtures. `docs/OPERATIONAL_CONTRACTS.md` describes the new behaviour.
- **OA-5 and OA-16** (a revision note; the runtime lock, the provider's model id and version, and the seed the run reported) are not decided, and would change this record. They are not in it.

## Evidence

- **On the founder host, against the real store and commands:** all 16 tests of `tests/take-record.test.ts` pass, among them a story stored as version 1 by an older build, opened, listed, assembled and saved as version 2. Their media are rows and ten bytes; no decoder is asked. `typecheck`, `lint`, `format:check`, `plan:check`, `provenance:check` and `brand:check` pass.
- **Measured:** in 262,144 bytes fit 109 shots of 8 takes without record hashes and 86 with. A record hash is 80 bytes of a take. The card estimated 94.
- **Media tests, in GitHub CI only:** a run started, followed, imported and saved with its record (`tests/generation-service.test.ts`). Their result is the pull request's CI run at its head.

## Not run, and not claimed

- **`npm run qualify:revisable-shot`** (new) and **`npm run qualify:create-durable`** (extended) pass `node --check` and have never run. They need ffmpeg and the native helpers, which are not built in this checkout; media tests failed on the founder host at `3de9b10` with them built (ledger 12 lists them; the cause is likely, not proven). `MPR-101-take-record-receipt.json` is not written.
- `npm run test:e2e` was not run here.
- **The Blender arm** belongs to part b: not built, so not run.
