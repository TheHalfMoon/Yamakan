# SS-017: worker access list race across process owners

Found 2026-11-04 (Asia/Riyadh) by Claude Opus while qualifying a clean checkout under SS-017, on main `364e041e0f9308f0563e752a74e5e8f8e92b234e`. Windows, pinned `vendor/ffmpeg-win64-r8`. This is a demonstrated defect found during SS-017, fixed in one bounded change.

## Defect

`set_access` in `native/procd/src/container.rs` reads an object's access list, adds or removes one worker's entry and writes the list back. Its own comment warns that concurrent cycles would drop each other's entries, but its lock was a `static Mutex`, which only covers threads inside one process. Separate process owners updating one object could lose an entry, leaving a worker unable to read its input: `MEDIA_INVALID`, "the file is unreadable or unsupported". The same read-modify-write could equally drop another worker's entry on revoke.

A single service has one process owner, so this needs two owners at once: `npm test`, or two running Yamakan instances on one account sharing an object. How often product use meets it is not measured. The usual symptom is a refused worker. The same lost update can also restore an entry another owner just revoked, and this change makes a timed-out revoke possible. A surviving entry names a dead, unique capability, and review found no route to use it. Failed revokes at shutdown and during launch unwinding are silently ignored, as before.

## Change

`set_access` now holds a named mutex around each update, named by the object's file identity: `Local\Yamakan.WorkerAccessList.<volume>.<index>`. It replaces the in-process lock and covers threads and process owners alike. Waiting is bounded at 30 s per acquisition, and not acquiring it refuses the update, so a worker is not started without its grant. An abandoned mutex counts as acquired, because the next holder rereads the list. An update that would change nothing no longer writes, so launches stop rewriting the shared tools folder. No limit, schema, scope or dependency changes.

The lock is per object because of a measured stall. A process holding an oplock on an object can stall access-list work on it: reviews measured the open blocking on an exclusive oplock and `SetKernelObjectSecurity` blocking on a read-handle oplock until the holder closed, and two earlier versions of this change held one lock across those calls. With one lock, that holder could stop every owner in the session. Now a stall holds up only updates of that same object, Under a read-handle oplock, the no-op check took 355 µs where a real write stalled 5.2 s. An exclusive oplock stalls the open, and so a no-op update too.

**Who can do this.** A review probed from inside the real AppContainer on this Windows build: every oplock level was denied on a granted input, the tools folder and the staged executable, and an exclusive open did not block other readers. So on this build a contained worker did **not** reproduce the stall. These oplocks were held from outside the container, so the exposure shown is another process of the same user, who can already change these lists. Other Windows builds were not tested.

**Remaining limits.** Only a wait on the lock is bounded at 30 s and then refused. The open and the write have no timeout: a review measured an update blocked for 45 s under an exclusive oplock, until the holder closed, when it succeeded. An earlier review traced that such a stall also blocks that owner's command loop. A shared media folder used as a working folder still takes a real write on each launch, since each worker has its own capability. `staged_tool` also opens the staged executable and DLLs on every launch to compare bytes, with no lock or timeout: an oplock held outside the container delayed another owner's launch by 7.2 s, until the holder exited. That predates this change and is not fixed by it.

The name is per session, so owners of another session do not share it; objects shared across sessions are not covered. Other access-list writers do not take this lock: `grant_owner_full` and `reset_access` in `native/procd/src/main.rs`, and the `yamakan-acl` helper. Label references are also per process owner, so one owner's tree reset can strip another's grants. Those predate this change and remain open.

## Results

| Stress: 150 children, 4 launches each, one shared file | Launches | `MEDIA_INVALID` | Launch error 2 |
| ------------------------------------------------------ | -------- | --------------- | -------------- |
| Pre-fix, one owner at a time                           | 600      | 0               | 0              |
| Pre-fix, 12 owners at once, 2 rounds                   | 1200     | 26              | 6              |
| Earlier single-lock versions, 12 owners, 10 rounds     | 6000     | **0**           | 29             |
| This version at `50a76c7`, 12 owners, 4 rounds         | 2400     | **0**           | 8              |

Seven of the ten earlier rounds used a build with diagnostic code at the launch error. Pre-fix, 1500 launches at concurrency 1, 8 and 24 from a single owner: 0 failures.

`tests/process-owner-shared-access.test.ts` runs 72 owners, 12 at a time, on one file. It refuses any failure except the tracked launch error, and requires most probes to succeed. With the pre-fix binary, selected through `YAMAKAN_PROCD`, it **failed**; with the lock it **passed**: 3 of 3 each on the first version, and 2 of 2 each on the next two, including this one. CI does not run it: the Ubuntu job skips it, and the Windows job runs only bundle and typography tests, so this evidence is local.

Full `npm test` on Windows:

| Native code                                                             | Runs | Failing tests by run | Note                                                                             |
| ----------------------------------------------------------------------- | ---- | -------------------- | -------------------------------------------------------------------------------- |
| Pre-fix, heads `f4b3808` and `0162825`, no native differences from main | 4    | 0, 10, 1, 3          | Launch error 2 and `MEDIA_INVALID`. The 10 was read from a log later overwritten |
| Lock held across the open, uncommitted tree                             | 2    | 0, 0                 | 748 tests, without the new test                                                  |
| Lock taken after the open, head `abbfc03`                               | 2    | 0, 0                 | 749 tests, 746 passed, 3 skipped                                                 |
| This version, head `50a76c7`                                            | 2    | 0, 0                 | 749 tests, 746 passed, 3 skipped, including the new test                         |

Clean runs are encouraging and do not prove the suite is stable.

## Still open: launch error 2

`Worker launch failed: CreateProcess failed (Windows error 2)` is **not explained or fixed**. It occurred 29 times in 6000 stress launches on the earlier versions, 28 of them in one round, and 8 times in 2400 on this one. The access list changes did not reduce it. It never appeared in single-owner stress or with owners run one at a time, though those samples are smaller. Ruled out: a dangling AppContainer SID (the pointer is `&'static`), and, weakly, a freshly rebuilt binary (0 in 1800 launches right after a rebuild, though the failures are bursty, with 28 of 29 in one round). A diagnostic that reports whether the executable and working folder exist at the failure was built, but that session produced no failures, so it reported nothing. No retry was added, because that would hide the cause. Its test deliberately ignores this code, so this test staying green says nothing about error 2.

Native unit tests, `cargo test --release`, 2 of 2: a lock held on another thread delays updates of its own object and no other; an unchanged grant does not write, and a real revoke does. With the lock name changed to one constant, the first test **failed** as it should; an earlier same-thread version of it could not fail, because a mutex is recursive on its holding thread. CI does not run these native tests. After `50a76c7` only test code, comments and documents changed, and main was merged with no native changes; the full suite and stress were not rerun.

Rollback: revert this change and its test. The race returns; there is no stored data or format change.

## Receipts

Raw logs stay local; SHA-256 binds them.

| Log                             | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `ss017-stress.log`              | `53ddc92e1aeb0ecce0d5cb44d42257a4c0b43847af64a6df2970b29f6baa2bfc` |
| `ss017-stress-procs.log`        | `7ab8591bea9672d6fcee2a0d1f2546692a84320aef16b2d991695bf52f5351fc` |
| `ss017a-stress-after.log`       | `647a8a2aafbfcbe435ef6d9bb6cdf51a3620cfbc6f0c0497a97c5b9747bd2912` |
| `ss017a-stress-diag.log`        | `972346f743cc1b705090fe022d5082ba2464b5ca96bff9b05df080420e85ff2e` |
| `ss017a-stress-diag2.log`       | `19e1a765aabc098eec51ed583de95205beae714651208647505662940502bd65` |
| `ss017a-red1.log`               | `aa91d38e967caaab40183fe2884c20f3241ce369bb2e54df38170dd31967c431` |
| `ss017a-green1.log`             | `8146282bfc1da0a244cd63f0a4c118ffb94b9f735ff4d12c5330f8ae3c55caed` |
| `ss017a-test1.log`              | `61ea4f59141487b0834ab67676fd07d25e3819436ac148d8bcd9ca7df8b88d9b` |
| `ss017a-test2.log`              | `99017608d050be695086d62cd4b90e82d1cb1dacd96e14d20ec1f4e91ef8fd9f` |
| `ss017-test3.log`, pre-fix      | `f8a9c19c1137fdbcb0d1c023a9052977be0655b6c4621f9981de3af40ec263f7` |
| `ss017-test-rerun.log`, pre-fix | `fa77d305556cd6a6b2f905d049435c09a8f401cce2d8bf7ca299e7d4525311b2` |
| `ss017a-v2-red1.log`            | `1972c7396971622b6e59d680fbee8b3c4b77a29ec88a94cd5e9adad4d6f33d29` |
| `ss017a-v2-red2.log`            | `b2d665c01c1d731bd5b7233299c3c15a44efe2b17bdf983cb789f8ac2411aac0` |
| `ss017a-v2-green1.log`          | `317dc838fbe3dea659ce6d15401cf437e88b34124948b04a45d979fd3858fe13` |
| `ss017a-v2-green2.log`          | `3f0ca30f58b84e0ffb7f5bbe76ff5c82a02b1c1aad5e4b93e8b0505abaf5c526` |
| `ss017a-v2-test1.log`           | `cd6a69e53c4f4d87f1196e33796aa29022efffc599f57687dbd6723a49ba74e1` |
| `ss017a-v2-test2.log`           | `4b09233e155f9307f45711d27094513af2a8f589a45891894a34520df1a81ec8` |
| `ss017a-v3-red1.log`            | `1b13d26b19df1682f7a8375d111472483c9a370fb0560d350ffe57dcfd7337ff` |
| `ss017a-v3-red2.log`            | `5cd741968e6966b656b232c9c5362bd7d756a868264284155cc7b0a59f0fba07` |
| `ss017a-v3-green1.log`          | `83982de3aec8a5b91abc26730c0df3198768dab44318532f99daac0eb35b5252` |
| `ss017a-v3-green2.log`          | `ac4cd452af15f794b083c9ea05d1d3b3c49f29c270cdecec329909be317c17ea` |
| `ss017a-v3-stress.log`          | `8b3b82b2ab03432bfe66bfc0542104a60930ad909c827d378c36ee16ced84902` |
| `ss017a-v3-test1.log`           | `c1ce6b545487824abe268e4a2e43dc5668bc58dbe2a59d3a67720ddf8c575914` |
| `ss017a-v3-test2.log`           | `6cbce4f382c52b665e9d7c9a5f8de3bad64575edc842ed7bef5b7114309f9398` |
