# SS-017: worker launch "file not found"

Found 2026-11-04 (Asia/Riyadh) by Claude Opus under SS-017, the launch error left open in `SS-017-access-lock.md`. Base main `6bbb68f323ef51cdf38d89291245c45d9d4af171`. Windows, pinned runtime. One bounded change in `native/procd/src/container.rs`.

## What was observed

During this program, `Worker launch failed: CreateProcess failed (Windows error 2)` appeared intermittently with several process owners running. Then every launch failed, in every checkout, including a binary from before the access-list lock: a single owner failed 20 of 20 launches, and a full suite run had 159 failures.

In that state, the registry mapping for the worker's AppContainer, `yamakan.mediaworker`, was **missing** under `AppContainer\Mappings`, while its `Packages` folder still existed. `yamakan.spike.worker` still had its mapping.

Deleting only Yamakan's worker profile with `DeleteAppContainerProfile` and letting the next owner recreate it restored launches at once: 10 of 10. This was done on the builder's own machine. It removes only that profile, and workers hold no state there.

So a missing mapping produces this error. **How the mapping was lost in that stuck case was not observed.**

## Trigger and change

Every process owner calls `CreateAppContainerProfile` when it starts, with nothing serializing those calls across owners.

| Stress, 12 owners at once on one file, same binary apart from the change | Launches | Launch error 2 |
| ------------------------------------------------------------------------ | -------- | -------------- |
| Profile already existing                                                 | 720      | 6              |
| Profile deleted before each round                                        | 960      | 0              |
| One owner at a time                                                      | 60       | 0              |
| **Change: creation serialized, profile existing**                        | **2880** | **0**          |

Earlier stress on the access-list lock recorded 29 in 6000 and 8 in 2400. The errors came in bursts, so these rates are rough, but zero in 2880 is well outside them.

The change holds a named mutex, `Local\Yamakan.WorkerProfile`, around creating or deriving the profile, using the bounded, fail-closed lock from the access-list change. Not acquiring it means no worker starts. It is taken once per owner.

**This is strong evidence, not proof.** The mechanism inside Windows is inferred from these results, and no mapping was caught changing during a concurrent create.

## Remaining limits

- **A profile already stuck does not repair itself.** This change prevents the trigger as far as measured, but a machine already in that state keeps failing. Recovery is deleting that one profile as above. Automatic repair is not added here: deleting a profile while other workers run needs its own design and review.
- The message "file not found" does not tell a person what is wrong.
- A different Windows build was not tested. The name is per session.
- CI does not exercise several owners on Windows.

Rollback: revert this change. The trigger returns; no stored data or format changes.

## Receipts

Raw logs stay local; SHA-256 binds them.

| Log                 | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `ss017b-stress.log` | `691a4ead5217fede8d6be456483607756137fb281d9f3f5957af381b6ee89210` |
