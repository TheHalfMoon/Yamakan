# A shot's take stays replaceable after its clip is split or trimmed (MPR-105)

## What was found

- Step 0, by reading main `b0dbf50`: `shotClip` refused any shot with a clip count other than 1, with the same text when the shot had no clip at all, and `shows` asked for the take's exact in-point, so a clip trimmed at its start matched nothing. The gap is as the card says. A failing test run first was not made on the founder host, since tests that import media do not run there.
- Step 0, also by reading `core/timeline/operations.ts`: only `clip.split` adds a new clip to the list of a shot that already has one. `shot.add` and `shot.update` set the list as given, and deleting a clip removes it.
- The card names `src/main.tsx`; by reading, it needs no edit, since the page takes the proposal as the service returns it.

## What was built

- The offset rule, proposal format version 2, one batch per replacement, refusals that name the clip, `timeline.clips` and `orphans` in `yamakan.take.list`, and a row per mapping on the review page.
- **Beyond the card's file list:** `applyOne` in `core/timeline/operations.ts`, so that a refusal carries the operation's own reason without parsing the batch's text; the take passages of `docs/OPERATIONAL_CONTRACTS.md`, which described the old rule; three summaries in `core/command/registry.ts`.

### Refusals

For a shot of one clip the text is as below. For a shot of several it starts with `Clip i of n of this shot: ` where marked with a star.

| Text                                                                                                                          | When                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `The shot has no clip on the timeline; assemble it again or attach a clip.`                                                   | no clip is listed for the shot                                                                                                                                   |
| `The shot is shown by more than 64 clips; replace its takes in the editor.` (`LIMIT_EXCEEDED`)                                | more than 64 clips                                                                                                                                               |
| `The shot's title card was split; replace its clips in the editor.`                                                           | several clips, one or more of them a title card                                                                                                                  |
| `The shot's clip no longer shows one of this shot's takes; replace it in the editor.` (star)                                  | the clip has the media of no take, or starts before the only take with its media                                                                                 |
| `Two takes of this shot use the same media, so the clip's place in the take cannot be told; replace it in the editor.` (star) | two takes have the clip's media and it starts at neither's in-point; or it is a later piece at a take's in-point while another take of that media starts earlier |
| `The shot already shows this take.`                                                                                           | no clip would change                                                                                                                                             |
| the operation's own text (star)                                                                                               | the timeline refuses that clip's replacement: speed, unlinked sound, too little media, a transition                                                              |
| `This proposal was made by an older page; propose it again.` (`REVISION_CONFLICT`)                                            | a version 1 proposal is applied                                                                                                                                  |

### Where this differs from the card

- **The last ambiguity rule is stricter than the card.** The card takes an exact in-point as the take shown, always. A later piece of one take can land exactly on another take's in-point in the same file, and would then be replaced at the wrong place without a word. It is refused instead. The first clip of a shot keeps the card's rule.
- **Unlinked sound is found by its media,** so when several pieces use one file and the sound of one is unlinked, the first piece of that file is the one named. A test records this.

## Evidence

- **Media-free tests on the founder host:** thirteen in `tests/take-replace.test.ts` (by name pattern) and all seven in `tests/take-review.test.ts` pass: the offset rule, the mapping, refusals, limits, the proposal format, the list, the comparison and the page's rows.
- **Media tests, in GitHub CI only:** one revision and one undo over a real split, a proposal with a mapping dropped or changed refused, a proposal made before a further split refused, and a version 1 proposal refused in words. Their result is in the pull request.

## Not run, and not claimed

- **`npm run qualify:take-review`: BLOCKED.** The split arm is in `scripts/qualify-take-review.mjs`, in a project of its own, with its own receipt (second argument), and runs after SS-006's scenario has its result. It passes `node --check` and has never run: media cannot be probed on the founder host since 2026-11-12 (ledger 12). `docs/evidence/ultimate/MPR-105-split-shot-replace-receipt.json` is therefore not written, and **the card is not complete.**
- `npm run qualify:director-cinema` was not run, for the same reason.
- The Arabic string `take.count` is unreviewed (X-01).
