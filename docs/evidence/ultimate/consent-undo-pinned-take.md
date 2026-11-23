# A take made with a revoked person's references does not return (MPR-010)

Outcome: the fix, not ALREADY_SATISFIED and not the accepted limit. The founder answered the one question the rule raised (founder decision record, 2026-11-23: "Yes, cover it").

## What was found

- Step 0, by reading main `4cd4bc0`: `assertPlacementConsent` matched a take only by `lineage.outputHash`, and only for takes with continuity references. The test "a take with only a pinned pack can return after revocation" in `tests/story-packs.test.ts` pinned that behaviour on purpose (PR #179).
- The old rule also let `tests/take-replace.test.ts` switch a shot that pins nothing to a file which another shot's take pins. The commit point sees files, not shots, so the rule covers every new use of the file. The founder was shown this before choosing.

## Failing first, then passing (GitHub CI, Linux)

The head at which each result was read is the commit named. Sandbox media tools do not start on the founder host, so no test that needs media ran on Windows; the eleven `commit point` tests, which need none, ran there and pass.

- **`cfba77c`, tests only, run 45143721906:** the four return cases ended "accepted" where `VALIDATION` was expected: placing it directly, then undo, for a take in a shot that pins a pack linked to the revoked consent, and for a take whose lineage inputs are linked to it. The control for an expired consent failed because the test asked for an 8-second lifetime (the minimum is 60 seconds); it was corrected. Overall 1,371 tests passed, 6 failed, 66 skipped: the four return cases, the expired control, and the newer-consent control, which first asserts the refusal the fix adds. Each failing test stopped at its first assertion, so redo, media swap, restore and the agent were not seen failing in that run.
- **`662ab88`, with the fix:** all nine tests of `tests/consent-undo-pinned-take.test.ts` passed, and so did the renamed test in `tests/story-packs.test.ts`. 1,376 passed, 1 failed: the `tests/take-replace.test.ts` case above, stopped on and then changed to the founder's rule.
- **`cff72f9`, reviewed:** CI passed. The independent review then found two ways round it, confirmed against this commit on a synthetic database: a take with no lineage was freed by restoring to before its import and importing the file again, and copies or a longer clip were accepted while one clip stayed. Both are closed after it, with tests that do not need media and pass on the founder host; run against `cff72f9`'s function, 4 of the 10 new tests fail, and against main's, 7.
- **The final head:** its CI result is in the pull request.

## Commands

- `node --test tests/consent-undo-pinned-take.test.ts`, `node --test tests/story-packs.test.ts`, `node --test tests/continuity-consent.test.ts` ran only inside CI's `npm test`. `tests/continuity-consent.test.ts` is not edited.
- On the founder host: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run provenance:check`, `npm run plan:check` and `npm run brand:check` pass.

## Not run, and not claimed

- **`npm run qualify:consent-gate`: BLOCKED.** The scenario for a pinned take is in `scripts/qualify-consent-gate.mjs` and passes `node --check`, but it has never run. Media and render tests failed on the founder host at `3de9b10` with the native helpers built (ledger 12 lists them; the cause is likely, not proven). In the checkout this change was made in the helpers are not built, so its media tests stop earlier, at `The process owner is not built`, and say nothing about that block. The card is not complete.
- **The Windows time of the two test files: BLOCKED** for the same reason. On Linux CI each new test took under one second.
- Not covered by a test here: trimming, unmuting, soloing, `take.apply` and assembly through this rule, and revoke staying human-only (existing tests cover that command).
