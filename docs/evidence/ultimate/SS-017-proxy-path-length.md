# SS-017: edit proxies fail on long workspace paths

Found 2026-11-04 (Asia/Riyadh) by Claude Opus while chasing the browser E2E failure in the environment capture. Base main `e1aca99d62a02adaf49d8363aa80c65456106eea`. Windows.

## Defect

A proxy build runs in a folder named `{64-character key}.{uuid}.partial`, deep in the workspace. Once its path, with `proxy.mp4`, reached 260 characters, the process owner could not restore the worker's folder afterward. The owner reported `RECOVERY_REQUIRED`, and the proxy module, which hides other errors by design, showed only "The proxy could not be made from this video." The interface then stopped asking, and the service forgot the failure a minute later. A workspace root of 80 characters was enough. Which call in the restore fails at that length was not isolated; review points to `GetNamedSecurityInfoW` in `inherits_only`, with an unprefixed path. By arithmetic, from a root of about 90 the old folder name itself reaches 260 and the failure should move to the launch grant, which was not confirmed at runtime.

This explains the E2E timeout at `scripts/browser-e2e.mjs:873`. The qualifier sets `TEMP` inside the checkout, so the path grew with the checkout's name. The E2E workspace root in `Yamakan-opus-clean` is exactly 80 characters, and 74 in `Yamakan-opus`, where a capture passed that step by the builder's record.

## Change

The folder is now `{uuid}.partial`, 65 characters shorter. The cleanup that runs on a proxy status check recognizes both forms, so interrupted builds from earlier versions are still removed. No schema, limit or stored-format change: published proxies are unchanged.

## Results

Direct build of the real E2E video at a chosen workspace root length:

| Root length | Before       | After            |
| ----------- | ------------ | ---------------- |
| 75          | ready        | ready            |
| 80          | **failed**   | ready            |
| 85 to 100   | **failed**   | not measured     |
| 110         | **failed**   | ready            |
| 140 to 160  | not measured | **still failed** |

`tests/proxy-timing.test.ts` adds a build at an 85-character root and cleanup of the new form. Both were seen to fail without the change, and after it all 13 tests in that file pass. CI does not exercise this: Windows CI runs only bundle and typography tests, and Linux has no such limit, so the evidence is local. The table's rows other than the 80-character boundary come from a console run with no saved log.

## Limits

- **The limit moved and did not go away, and other workers have lower ones.** By arithmetic from reading the code, not measured: a LUT preview's read grant fails from a root of about 81, a LUT export's from about 88 to 94, a titled preview's font grant from about 120, a preview's output from 130, any source object's read grant from 131, and the new proxy from 145. A root of 140 failed here, which fits the 131 limit. **The fix for all of them is extended-length paths in the process owner**, as `yamakan-acl` already does, and it is a follow-up. Roots this long fail closed: a failed restore rejects the build before publishing.
- The owner's restore failure stays hidden behind that message, and the interface does not retry.
- The qualifier's in-checkout `TEMP` makes the checkout's name part of these limits, so a checkout a few characters longer could fail again with LUT work.
- After a rollback, the old cleanup would not remove an orphaned `{uuid}.partial` folder.

A full environment capture at `d70cbb1a3c7f21a85639b8b38f69c3b2b124f27a`, on AC power from a clean tree in the `Yamakan-opus-clean` clone, recorded `RECORDED`, `pass: true`: all eight stages passed, with 764 tests, 761 passed, 3 skipped and 0 failed, and browser E2E. This is one run, in a clone already used for earlier work. Receipt: `capture2-environment.json`, `dd833334a29566c1ffdc80367a3c34414d1277413293db100ab33b6469718b6b`.

Rollback: revert this change. Long-path builds fail again; no data is affected. Raw logs are local: `ss017c-red.log`, `ss017c-green.log`.
