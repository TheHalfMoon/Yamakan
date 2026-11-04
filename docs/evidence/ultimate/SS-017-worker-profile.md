# SS-017: worker launch "file not found"

Found 2026-11-04 (Asia/Riyadh) by Claude Opus under SS-017, the launch error left open in `SS-017-access-lock.md`. Base main `6bbb68f323ef51cdf38d89291245c45d9d4af171`. Windows, pinned runtime. One bounded change in `native/procd/src/container.rs`, and a precision fix in one test.

**Result:** an interleaved comparison supports the change, and is suggestive rather than conclusive. The mechanism inside Windows is **not established**.

## What was observed

`Worker launch failed: CreateProcess failed (Windows error 2)` appeared intermittently with several process owners running. Then every launch failed in every checkout, including a binary from before the access-list lock: a single owner failed 20 of 20 launches, and a full suite run had 159 failures (`ss006-test.log` at that time, later overwritten; the count is from the console record).

In that state, the registry mapping for the worker's AppContainer, `yamakan.mediaworker`, was **missing** under `AppContainer\Mappings`, while its `Packages` folder still existed. Another profile, `yamakan.spike.worker`, still had its mapping.

The builder then deleted Yamakan's worker profile with `DeleteAppContainerProfile` on the founder's development machine, without separately asking, because all media work was blocked; it did this about five more times during the experiments below. The next owner recreated it, and launches passed 10 of 10 at once. Yamakan puts no state in that profile by design, but its contents were not inspected before deletion, and engine worker behaviour was not reviewed. These observations came from console commands and have no bound receipt.

So a missing mapping goes with this error. How the mapping alone was lost in that stuck case was not observed. A related loss was caught in the comparison below.

## Change

Each process owner creates the profile on its first launch, with nothing serializing those calls across owners. A named mutex, `Local\Yamakan.WorkerProfile`, now covers that step. If it is not acquired within 10 s, that launch is refused and the next launch tries again; only success is kept. Launches after the first in an owner do not take it.

## Evidence

Interleaved comparison, `ab/results.jsonl`, 12 owners at once on one file, 600 launches per round, 12 rounds of each binary, order swapped each round, same host session, on AC power. The binaries differ by this change. Each round's starting profile state and host state are recorded; host CPU before a round ranged from 4% to 85%.

| Binary              | SHA-256                                                            | Launches | Launch error 2 | Per round                            |
| ------------------- | ------------------------------------------------------------------ | -------- | -------------- | ------------------------------------ |
| A, without the lock | `68fa746742b95c60ed9e4aa1f471c20ce68a7662946ed448f5dac8257049728c` | 7200     | **43**         | 17, 0, 0, 0, 0, 0, 0, 0, 0, 21, 5, 0 |
| B, with the lock    | `5f780eebfe9f42234cba828f69e2b7feb58bf970d90b6153e597527788eb250c` | 7200     | **0**          | all 0                                |

**The profile was caught missing once.** Right after round 10 of binary A, which had 21 errors, the state read before the next round showed the mapping and the folder both gone, and the builder ran no deletion during the comparison, by the builder's account. The folder's creation time, about 17:50:01, also hints at a second loss inside that next round, which is an estimate. That next round, also A, had 5 errors, and the following state was present again. No round after binary B was preceded by a missing profile. This is one observation, and it was a read between rounds rather than during a create.

The errors come in bursts, so launches are not independent and the fair unit is rounds: 3 of 12 against 0 of 12. On its own that is suggestive, not conclusive: one-sided Fisher p is about 0.11, and two of the three rounds were adjacent, so they may be one burst. Also, an earlier 12 rounds of 240 launches with this lock had none, and five earlier stress logs on code without it had error 2 in 5 of 16 rounds of 600, including one run of seven clean rounds. Taken together this supports the change, without proving a cause.

An earlier, uncaptured console run with no receipt also gave 6 errors in 720 launches with the profile present, 0 in 960 with the profile deleted before each round, and 0 in 60 with one owner at a time. Those are weak: rounds were small, and the deleted case still has owners creating over a profile another owner just made.

## Remaining limits

- **A profile already stuck does not repair itself**, and a machine in that state keeps failing. Recovery is to stop all owners and delete that one profile with `DeleteAppContainerProfile`. Automatic repair is not added here, because deleting a profile while other workers run needs its own design and review.
- Owners built without this lock still race with those built with it.
- While another process holds the mutex, each launch waits up to 10 s on that owner's command loop, which delays its other commands, including cancels. It needs a process of the same user, and the access list lock already behaves this way.
- A launch in one owner overlapping a create in another is not covered, and any create failure still falls through when deriving the identifier works, which hides the result.
- The message "file not found" does not tell a person what is wrong.
- Other Windows builds were not tested, and the name is per session.
- CI does not exercise several owners on Windows.

Rollback: revert this change. The errors would be expected to return; no stored data or format changes.

## Receipts

Raw logs stay local; SHA-256 binds them. The stress scripts are local too and are not in the repository.

| File                                                 | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `ab/results.jsonl`                                   | `879606c7e5d9a35e59238c3c78b89768d3dc502b5421d0e8238a5cce656f3fcf` |
| `ss017b-stress.log`                                  | `691a4ead5217fede8d6be456483607756137fb281d9f3f5957af381b6ee89210` |
| `ss017b-red1.log`, shared-access test at this head   | `98beaa07fe8686843169729a96e128e2b702cf0a94819bcc9218747d7d40dd5d` |
| `ss017b-red2.log`, shared-access test at this head   | `97087977e740e13b583efcfc4c46784f33fc47e89d3d708e26f6e1ec147e0026` |
| `ss017b-green1.log`, shared-access test at this head | `8ef786fc7f6c4acb37a1db40235ff7bf4ce44988f921e3e340eb573c79882462` |
| `ss017b-green2.log`, shared-access test at this head | `26ea7f9b450679a1203b184368d40445855aff00951f3bae21f680cc734321c6` |
