# SS-017: edit proxies fail on long workspace paths

Found 2026-11-04 (Asia/Riyadh) by Claude Opus while chasing the browser E2E failure in the environment capture. Base main `e1aca99d62a02adaf49d8363aa80c65456106eea`. Windows.

## Defect

A proxy build runs in a folder named `{64-character key}.{uuid}.partial`, deep in the workspace. Once its path, with `proxy.mp4`, reached 260 characters, the process owner could not restore the worker's folder afterward. The owner reported `RECOVERY_REQUIRED`, and the proxy module, which hides other errors by design, showed only "The proxy could not be made from this video." The interface then stopped asking, and the service forgot the failure a minute later. A workspace root of about 80 characters was enough. Which call in the restore fails at that length was not isolated.

This explains the E2E timeout at `scripts/browser-e2e.mjs:873`. The qualifier sets `TEMP` inside the checkout, so the path grew with the checkout's name. `Yamakan-opus-clean` is 6 characters longer than `Yamakan-opus`, where that step passed.

## Change

The folder is now `{uuid}.partial`, 65 characters shorter. Startup cleanup recognizes both forms, so interrupted builds from earlier versions are still removed. No schema, limit or stored-format change: published proxies are unchanged.

## Results

Direct build of the real E2E video at a chosen workspace root length:

| Root length | Before       | After            |
| ----------- | ------------ | ---------------- |
| 75          | ready        | ready            |
| 80          | **failed**   | ready            |
| 85 to 100   | **failed**   | not measured     |
| 110         | **failed**   | ready            |
| 140 to 160  | not measured | **still failed** |

`tests/proxy-timing.test.ts` adds a build at a 110-character root and cleanup of the new form: both failed before the change. After it, all 13 tests in that file pass.

## Limits

- **The limit moved and did not go away.** Roots somewhere between 110 and 140 characters still fail, with the same generic message. Other worker folders have not been measured at these lengths.
- The owner's restore failure stays hidden behind that message, and the interface does not retry.
- The root cause in the restore path, and extended-length paths as a fix, were not explored.

A full environment capture at `d70cbb1a3c7f21a85639b8b38f69c3b2b124f27a`, on AC power from a clean tree in the `Yamakan-opus-clean` clone, recorded `RECORDED`, `pass: true`: all eight stages passed, with 764 tests, 761 passed, 3 skipped and 0 failed, and browser E2E. This is one run, in a clone already used for earlier work. Receipt: `capture2-environment.json`, `dd833334a29566c1ffdc80367a3c34414d1277413293db100ab33b6469718b6b`.

Rollback: revert this change. Long-path builds fail again; no data is affected. Raw logs are local: `ss017c-red.log`, `ss017c-green.log`.
