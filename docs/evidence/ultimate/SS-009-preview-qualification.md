# SS-009: preview cache, sharing and frame lifetime

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Measured at `5503a9b8c9af8e1b548bd45bdc5af428dfd23eb2`, base main `6bbb68f323ef51cdf38d89291245c45d9d4af171`. Test and journey only: **no defect was found in cache identity, sharing or frame lifetime, and no production code changed.**

**This card stays open.** The frozen 720p playback gate of at least 24 fps was not met on this host, in conditions that do not allow a conclusion either way. See below.

## Results

| Item                                                                                                                      | Result                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cache identity: plan hash changes with media version, LUT version, font, snapshot, size, title, gain, source offset, mute | Pass, `tests/render-plan.test.ts`; media, LUT and font cases are new                         |
| Renderer version and engine identity in the cache key                                                                     | Read from `core/render/preview.ts`; not varied in a test, because both are fixed for a build |
| Seeks in reverse and random order give each frame the same bytes as a forward pass                                        | Pass, new, `tests/preview-order.test.ts`                                                     |
| A waiter leaving does not stop a render another still waits for                                                           | Pass, new                                                                                    |
| When the last waiter leaves, the render stops, and asking again starts afresh                                             | Pass, new                                                                                    |
| An already cancelled request does not render                                                                              | Pass, new                                                                                    |
| Bounded queue, abandoned requests, eviction under pressure                                                                | Existing tests in `tests/preview.test.ts`, pass in the full suite                            |

Browser journey, `npm run qualify:preview-lifetime`, real service, Edge, one run, passed:

- Nine random and reverse seeks made 9 decoded frames, and exactly one object URL was alive after each.
- A frame of the first project was held back while the second opened. The second's colour stayed on screen after the late answer was released, measured from the frame's pixels.
- A refused frame shows its reason and no stale picture.
- No page errors.

## Policy measurements

Qualification policy v1 thresholds, unchanged. The tracked receipts were not overwritten; their results are recorded here.

| Measurement                                                      | Target    | Result                                     |
| ---------------------------------------------------------------- | --------- | ------------------------------------------ |
| Warm frame, p95, 10 runs                                         | ≤ 1000 ms | 80 ms, met                                 |
| Cold frame, p95, 10 runs                                         | ≤ 3000 ms | 1502 ms, met                               |
| Cold 2 s segment, p95, 5 runs                                    | ≤ 6000 ms | 1680 ms, met                               |
| A/V sync, 10-minute export, click within 20 ms and limited drift | as frozen | Passed, with the negative control detected |
| Sustained 720p playback                                          | ≥ 24 fps  | **Not met: 10.9 and 8.1 fps**              |

## Playback: not a conclusion

Both playback runs failed, each with its required negative control. The retained receipt, measured 2026-10-26 at `aba1c6f`, was 27.3 fps. These runs do **not** establish a regression, and they do not clear one:

- The first overlapped the builder's typecheck, with host CPU at 91% before it started.
- The second overlapped no builder work, with host CPU at 75% before it started.
- Measured right after: the laptop was **on battery** at 81%, the CPU at 1468 MHz and 70% of nominal performance, 1.2 of 15.7 GiB memory free, with `rustc` and `python` processes that were not the builder's using CPU. Earlier in the program the same host reported AC power.

The frozen policy names a hardware profile but not these conditions. No other work was stopped to obtain a number, since it was not the builder's. **Required to close this card:** rerun `npm run qualify:playback` on AC power with the host quiet. If it still falls below 24 fps, treat it as a regression and bisect from `aba1c6f`.

## Not run

- Missing-proxy and unsupported-codec fallback through the interactive preview: `src/proxies.ts` was read, and it plays the original until a proxy is ready, but no new test exercised this.
- Audio-clock behaviour was only reported by the playback runs above, under the same conditions: mean drift 97.6 and 180.3 ms.
- Cold and warm preview ran with host CPU at 77% before start, so those figures are not a best case.

Rollback: remove the two tests' additions, the journey and this file.

## Receipts

Raw logs stay local; SHA-256 binds them.

| File                               | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `ss009-focused.log`                | `5b75539f7f9e60067fee1fbe0dc4bdb1cc9652482ac123faf0c82992eb2661de` |
| `ss009-lifetime.json`              | `bb900143c3612a350516dbac87928e15e8dfd0f42c1228cd9c73e9bab6e62aca` |
| `ss009-t8-preview.json`            | `ec6b949575fbc8773cc54a36fcf29ebc18d0efcb6415a44548dc59d757bb1d03` |
| `ss009-av-sync.json`               | `029b6297b3c43325bb9a0f5ed39831b4122cb165893a37fdf2a5743a109c003b` |
| `ss009-playback.json`, first run   | `28bfc1e14434c6a0a0986b7c27df8a48b9e1e49c40e5320c60da2cce1ecbd86b` |
| `ss009-playback2.json`, second run | `db8dcde35644ff1af9d37bf35a5b2c9a22d538d798eee9cb3d12308c33fd4983` |
