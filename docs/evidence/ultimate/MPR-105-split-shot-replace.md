# A shot's take stays replaceable after its clip is split or trimmed (MPR-105)

## What was found

- Step 0, by reading main `b0dbf50`: `shotClip` refused any shot with a clip count other than 1, with the same text when the shot had no clip at all, and `shows` asked for the take's exact in-point, so a clip trimmed at its start matched nothing. The gap is as the card says. A failing test run first was not made on the founder host, since tests that import media do not run there.
- Not verified: the card's note that no timeline operation other than `clip.split` makes a clip from another.

## What was built

- The offset rule, proposal format version 2, one batch per replacement, refusals that name the clip, `timeline.clips` and `orphans` in `yamakan.take.list`, and a row per mapping on the review page.
- **Beyond the card's file list:** `applyOne` in `core/timeline/operations.ts`, so that a refusal carries the operation's own reason without parsing the batch's text; three passages of `docs/OPERATIONAL_CONTRACTS.md`, which described the old rule.

## Evidence

- **Media-free tests on the founder host** (`tests/take-replace.test.ts`, by name pattern): ten tests of the offset rule, the mapping, refusals, limits, the proposal format, the list and comparison pass. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run plan:check` and `npm run provenance:check` pass.
- **Media tests, in GitHub CI only:** one revision and one undo over a real split, and a version 1 proposal refused in words. Their result is in the pull request.

## Not run, and not claimed

- **`npm run qualify:take-review`: BLOCKED.** The split arm is in `scripts/qualify-take-review.mjs` and passes `node --check`, but has never run: media cannot be probed on the founder host since 2026-11-12 (ledger 12). `docs/evidence/ultimate/MPR-105-split-shot-replace-receipt.json` is therefore not written, and the card is not complete.
- The Arabic string `take.count` is unreviewed (X-01).
