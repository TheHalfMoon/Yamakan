# Every ended generation says which kind of end it was (MPR-207)

## What was found (step 0)

By reading main `c7c9929`:

- `GenerationRecord` had no `failureClass`. It had `endedAt`, which MPR-101 added and this card reuses, as both cards say. `ExecutionStatusSchema` had no class, `ErrorCodes` has 14 names, a refused start is stored failed, dismissed and unlisted, and `generationLedger()` still spreads the stored JSON.
- A run that failed on Kaggle and a job ComfyUI stopped reporting both answered `failed` and words only, by reading; no failing test was run first.
- Every failure message the card lists is still made where it says.

## What was built

- **`core/engines/failures.ts`:** the table, billing and the refusal's carrier. Eleven classes: the card's eight and the three of OA-18, which the founder accepted ([record](../../FOUNDER_DECISION_RECORD.md#2026-11-23-three-more-kinds-of-generation-failure)).
- **Adapters** name the class where each message is made. Messages are unchanged.
- **The service** has one writer of how a run ended. The first end stands, a stop is an end, and a row from before this card gains nothing and reads as `unknown`.
- **`yamakan.generation.status` and `yamakan.generation.list`** gain `failureClass`, `mayStillBeBilled`, `billedIn`, `retry` and `endedAt`.
- **The Create page** shows a line with the kind, the billing and the advice, in English and Arabic. The Arabic is unreviewed.

## The mapping, as the tests run it

| Where it ends                                                                                    | Class                | May still be billed        | Advice          |
| ------------------------------------------------------------------------------------------------ | -------------------- | -------------------------- | --------------- |
| Refused by Yamakan or the adapter before anything is sent                                        | `refusedByPolicy`    | no                         | `afterChange`   |
| Kaggle refused the push: quota words, a maximum batch, GPU, number or session, or 429            | `quotaExhausted`     | no                         | `afterWaiting`  |
| Kaggle answered 401 or "Authentication required", at the question before the push or at the push | `credentialRejected` | no                         | `afterChange`   |
| Kaggle refused the push for another reason                                                       | `providerRejected`   | no, refused as it was sent | `afterChange`   |
| The run failed on Kaggle, was killed there, or said another error                                | `providerRejected`   | yes                        | `afterChange`   |
| The same, past the run's time limit                                                              | `timeout` [ASSUMED]  | yes                        | `afterChange`   |
| The run's receipt names an out-of-memory error                                                   | `resourceExhausted`  | yes                        | `afterChange`   |
| Kaggle's latest run is not this one                                                              | `lostJob`            | yes                        | `afterChecking` |
| A finished run failed its checks, or its length, size, hash or result is not usable              | `invalidArtifact`    | yes                        | `whenWanted`    |
| Stopped on Kaggle, or by the person                                                              | `cancelled`          | yes                        | `whenWanted`    |
| ComfyUI: past its deadline                                                                       | `timeout`            | no, it is local            | `afterChange`   |
| ComfyUI: no longer or never reported                                                             | `lostJob`            | no                         | `afterChecking` |
| ComfyUI: an error                                                                                | `providerRejected`   | no                         | `afterChange`   |
| ComfyUI: an error whose type is an out-of-memory error                                           | `resourceExhausted`  | no                         | `afterChange`   |
| ComfyUI: interrupted                                                                             | `cancelled`          | no                         | `whenWanted`    |
| Ended with no class named, or a row from before this card                                        | `unknown`            | if it left this computer   | `afterChecking` |

`contentRefused` has no route that reports it yet.

### Where this differs from the card, or goes past it

- **A killed run stays `providerRejected`,** as the card has it: its log shows that it was killed, and memory is the likely reason and not a known one. Only a run's own name for its error (`OutOfMemoryError`, `MemoryError`) is `resourceExhausted`, never its words.
- **A credential refused at the question before a push** is `credentialRejected`. The card's rule for what is thrown before the push is `refusedByPolicy`; OA-18 came after it.
- **A run that had succeeded and is then stopped** is `cancelled`, and keeps the time of its own end.
- **`endedAt` of a stopped run** is the time of the stop. MPR-101 recorded only an end its engine reported; no such row can be recorded in a take, since a stopped run is not imported.

- **This file is written by hand.** The card has `scripts/qualify-kaggle-screens.mjs` write it, and that script does not read what the host has first (common contract rule 6); neither is done, since it has not run.

## Evidence

- **On the founder host:** all 15 tests of `tests/generation-failure-class.test.ts` pass, over the real Kaggle adapter with its stand-in CLI (no network), with those of `tests/kaggle-engine.test.ts`, `tests/comfyui-engine.test.ts`, `tests/engines.test.ts` and `tests/create-model.test.ts`. `typecheck`, `lint`, `format:check`, `plan:check`, `provenance:check` and `brand:check` pass.
- **In GitHub CI only** (the native helpers are not built in this checkout): `tests/generation-service.test.ts`, and the parts of `tests/generation-durable.test.ts` that need media.

## Not run, and not claimed

- **`npm run qualify:kaggle-screens`,** whose scenes `failed` and `stop-running` now check the line, is syntax-checked and was not run: it needs the native helpers, a browser and a C# compiler. Its scenes' observations are therefore not here, and **the card is not complete.**
- The optional look at a real Kaggle run was not made. **[ASSUMED]** items stay so: how Kaggle reports a run it ended at its time limit, so `timeout` there is taken from the clock; and that Kaggle counts a failed or stopped run's GPU time, so the wording says "may".
- `npm run test:studio` and `npm run test:e2e` were not run here.
