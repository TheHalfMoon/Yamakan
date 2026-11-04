# SS-017: worker access list race across process owners

Found 2026-11-04 (Asia/Riyadh) by Claude Opus while qualifying a clean checkout under SS-017, on main `364e041e0f9308f0563e752a74e5e8f8e92b234e`. Windows, pinned `vendor/ffmpeg-win64-r8`. This is a demonstrated defect found during SS-017, fixed in one bounded change.

## Defect

`set_access` in `native/procd/src/container.rs` reads an object's access list, adds or removes one worker's entry and writes the list back. Its own comment warns that concurrent cycles would drop each other's entries, but its lock was a `static Mutex`, which only covers threads inside one process. Separate process owners updating one object could lose an entry, leaving a worker unable to read its input: `MEDIA_INVALID`, "the file is unreadable or unsupported". The same read-modify-write could equally drop another worker's entry on revoke.

A single service has one process owner, so this needs two owners at once: `npm test`, or two running Yamakan instances on one account sharing an object. How often product use meets it is not measured. The failure direction is a refused worker, not wider access: a lost entry removes a grant.

## Change

`set_access` also holds a named mutex, `Local\Yamakan.WorkerAccessList`, for the whole update. Waiting is bounded at 30 s, and not acquiring it refuses the update, so a worker is not started without its grant. An abandoned mutex counts as acquired, because the next holder rereads the list. No limit, schema, scope or dependency changes. The name is per session, so owners of another session do not share it; per-user objects across sessions are not covered.

## Results

| Stress: 150 children, 4 launches each, one shared file | Launches | `MEDIA_INVALID` | Launch error 2 |
| ------------------------------------------------------ | -------- | --------------- | -------------- |
| Pre-fix, one owner at a time                           | 600      | 0               | 0              |
| Pre-fix, 12 owners at once, 2 rounds                   | 1200     | 26              | 6              |
| Lock, 12 owners at once, 10 rounds                     | 6000     | **0**           | 29             |

Pre-fix, 1500 launches at concurrency 1, 8 and 24 from a single owner: 0 failures.

`tests/process-owner-shared-access.test.ts` runs 72 owners, 12 at a time, on one file. With the pre-fix binary, selected through `YAMAKAN_PROCD`, it **failed 3 of 3 runs**. With the lock it **passed 3 of 3 runs**, about 12.6 s each.

Full `npm test` on Windows, each at a clean head:

| Binary  | Runs | Failing tests by run | Note                                            |
| ------- | ---- | -------------------- | ----------------------------------------------- |
| Pre-fix | 4    | 0, 10, 1, 3          | Failures were launch error 2 or `MEDIA_INVALID` |
| Lock    | 2    | 0, 0                 | 748 tests, 745 passed, 3 skipped                |

Two clean runs are encouraging and do not prove the suite is stable.

## Still open: launch error 2

`Worker launch failed: CreateProcess failed (Windows error 2)` is **not explained or fixed**. With the lock it occurred 29 times in 6000 stress launches, 28 of them in one round. It never appeared in single-owner stress or with owners run one at a time, though those samples are smaller. Ruled out: a dangling AppContainer SID (the pointer is `&'static`), and a freshly rebuilt binary (0 in 1800 launches right after a rebuild). A diagnostic that reports whether the executable and working folder exist at the failure was built, but that session produced no failures, so it reported nothing. No retry was added, because that would hide the cause. Its test deliberately ignores this code, so this test staying green says nothing about error 2.

Rollback: revert this change and its test. The race returns; there is no stored data or format change.

## Receipts

Raw logs stay local; SHA-256 binds them.

| Log                       | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `ss017-stress.log`        | `53ddc92e1aeb0ecce0d5cb44d42257a4c0b43847af64a6df2970b29f6baa2bfc` |
| `ss017-stress-procs.log`  | `7ab8591bea9672d6fcee2a0d1f2546692a84320aef16b2d991695bf52f5351fc` |
| `ss017a-stress-after.log` | `647a8a2aafbfcbe435ef6d9bb6cdf51a3620cfbc6f0c0497a97c5b9747bd2912` |
| `ss017a-stress-diag.log`  | `972346f743cc1b705090fe022d5082ba2464b5ca96bff9b05df080420e85ff2e` |
| `ss017a-stress-diag2.log` | `19e1a765aabc098eec51ed583de95205beae714651208647505662940502bd65` |
| `ss017a-red1.log`         | `aa91d38e967caaab40183fe2884c20f3241ce369bb2e54df38170dd31967c431` |
| `ss017a-green1.log`       | `8146282bfc1da0a244cd63f0a4c118ffb94b9f735ff4d12c5330f8ae3c55caed` |
| `ss017a-test1.log`        | `61ea4f59141487b0834ab67676fd07d25e3819436ac148d8bcd9ca7df8b88d9b` |
| `ss017a-test2.log`        | `99017608d050be695086d62cd4b90e82d1cb1dacd96e14d20ec1f4e91ef8fd9f` |
