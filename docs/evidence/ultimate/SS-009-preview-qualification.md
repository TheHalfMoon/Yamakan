# SS-009: preview cache, sharing and frame lifetime

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Base main `6bbb68f323ef51cdf38d89291245c45d9d4af171`. Tests and journey at `0cf2fc5957a3605e2052961b9ffb52b3e3ecca9a`; policy measurements at `5503a9b8c9af8e1b548bd45bdc5af428dfd23eb2`, which has the same preview code except the segment fix below. **No defect was found in cache identity, sharing or the reference preview's object URL lifetime. One defect was found and fixed: a refused segment left a dead player.**

**This card stays open** for the items under "Not run". The frozen 720p playback gate passed at 25 fps once the host was on AC power and quiet; two earlier runs in poor host conditions are retained below.

## Results

| Item                                                                                                                                   | Result                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Cache identity: plan hash changes with media version, between two LUT versions, font, snapshot, size, title, gain, source offset, mute | Pass, `tests/render-plan.test.ts`; media, LUT and font cases are new. Frame rate is not varied |
| Renderer version and engine identity in the cache key                                                                                  | Read from `core/render/preview.ts`; not varied in a test, because both are fixed for a build   |
| Seeks in reverse and random order give each frame the same bytes as a forward pass                                                     | Pass, new, `tests/preview-order.test.ts`                                                       |
| With a render running, a waiter leaving does not stop it for another still waiting                                                     | Pass, new                                                                                      |
| With a render running, when the last waiter leaves it stops and leaves no frame, and asking again renders afresh                       | Pass, new                                                                                      |
| An already cancelled request is not counted as waiting, and the next request renders                                                   | Pass, new                                                                                      |
| Bounded queue, abandoned requests, eviction under pressure, and reference frames at 30, 25 and 24000/1001 fps                          | Existing tests in `tests/preview.test.ts`, passing with the above: 19 of 19                    |

The first versions of two sharing tests aborted before any render began, so they could not fail; independent review proved this by mutation, and they now wait for a running render. The review's mutants were not rerun against the final tests.

Browser journey, `npm run qualify:preview-lifetime`, real service, Edge, at `0cf2fc5`, passed:

- Nine random and reverse seeks made 9 decoded frames, and exactly one object URL was alive at rest after each. This counts object URLs at rest, not decoded memory, and every seek waited for its frame.
- A frame of the first project was held back while the second opened. The fetch is aborted when the project changes, so this exercises the abort rather than a delivered late answer. The second's colour stayed on screen, read from the frame's pixels, and the check can only tell red from not red.
- A refused segment shows its failure and the frame stays up. Before the fix, the player stayed over the frame and hid the failure. This is a small change to `src/reference.tsx`; a segment also now closes when the playhead rests on another frame.
- A refused frame shows its reason and no stale picture.
- No page errors.

The interactive preview has no `VideoFrame` handling in this code, so the card's closed-frame case does not apply to this path. "Frame lifetime" here means the reference preview's object URLs.

## Policy measurements

Qualification policy v1 thresholds, unchanged. The tracked receipts were not overwritten; their results are recorded here.

| Measurement                                                      | Target    | Result                                                                                          |
| ---------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| Warm frame, p95, 10 runs                                         | ≤ 1000 ms | 80 ms, met                                                                                      |
| Cold frame, p95, 10 runs                                         | ≤ 3000 ms | 1502 ms, met                                                                                    |
| Cold 2 s segment, p95, 5 runs                                    | ≤ 6000 ms | 1680 ms, met                                                                                    |
| A/V sync, 10-minute export, click within 20 ms and limited drift | as frozen | Passed, with the negative control detected                                                      |
| Sustained 720p playback                                          | ≥ 24 fps  | **25 fps, met**, on AC power and quiet. Two earlier runs: 10.9 and 8.1 fps, on a contended host |

## Playback

The third run, at `2ea4f74f3043080392c2392221119bc1ac195d6d` on AC power with host CPU at 23% before it started, **passed the gate**, and its negative control measured 0.3 fps. The retained receipt, measured 2026-10-26 and added in `a463247`, was 27.3 fps sustained. This is one run close to the threshold, with drift higher than the retained receipt, so it clears this gate and does not show the margin is unchanged. The two earlier runs failed:

| Run                 | Sustained | Seek | Under export | Mean drift | p95 drift | Max drift |
| ------------------- | --------- | ---- | ------------ | ---------- | --------- | --------- |
| First               | 10.9      | 8.2  | 12.3         | 97.6 ms    | 323 ms    | 748.8 ms  |
| Second              | 8.1       | 13.1 | 22.9         | 180.3 ms   | 239.7 ms  | 329.4 ms  |
| Third, AC and quiet | 25        | 23.4 | 24           | 122.1 ms   | 153.8 ms  | 178.7 ms  |
| Prior receipt       | 27.3      | 25   | 27           | 94.2 ms    | 124 ms    | 144.7 ms  |

The first two runs' negative control carried no information, because they were already below 24 fps. The seek figure is reported and not gated. In the second run playback under an export beat sustained playback, and animation frames ran at about 17 to 22 Hz against 39 Hz before; both point to host contention. Edge also moved from 156.0.4314.42 to 156.0.4314.58 between the receipts.

- The first overlapped the builder's typecheck, with host CPU at 91% before it started, from a console reading with no bound receipt.
- The second overlapped no heavy builder work by the builder's account, with host CPU at 75% before it started, also a console reading.
- Measured right after, in a console check with no bound receipt: the laptop was **on battery** at 81%, the CPU at 1468 MHz and 70% of nominal performance, 1.2 of 15.7 GiB memory free, with `rustc` and `python` processes that were not the builder's using CPU. Earlier in the program the same host reported AC power.

The frozen policy names a hardware profile but not power state or load. No other work was stopped to obtain a number, since it was not the builder's. This matters for every timing result on this host, including SS-005a's, where power state during the slow runs was not recorded: the same build here measured about a third of its AC speed on battery under load. **Measure on AC power with the host quiet, and record both.**

**Required to close this card:** exercise or explicitly waive each card item under "Not run".

## Not run

- Missing-proxy, unsupported-codec and unsupported-browser fallback through the interactive preview: `src/proxies.ts` was read, and it plays the original until a proxy is ready, but no new test exercised this.
- A frame answer that arrives after a seek, in the same project, through `src/reference.tsx`: the journey waits for each frame.
- The object URL release on unmount.
- A segment that plays successfully: no script clicks Play and sees it play.
- Varying renderer identity in the cache key, which the card asks for.
- Frame rate as a cache identity input.
- Cold and warm preview ran with host CPU at 77% before start by console reading, so those figures are not a best case.

Found by reading and not fixed, because it is not demonstrated: `evictPreviews` could delete a file just returned as a cache hit if a listing goes stale once the cache is over its bound. A request would then fail once.

Rollback: remove the test additions, the journey, this file and the small change in `src/reference.tsx`.

## Receipts

Raw logs stay local; SHA-256 binds them.

| File                               | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `ss009-v2-focused.log`             | `d93f2a3ce160216e7041acda08e90a4e3f4af4f2e43bdc82c59c473bafd1914b` |
| `ss009-v2-lifetime.json`           | `b243284a4e979cacbc79d20c09d3da33f2b31ed08ffc15019acdc36208061339` |
| `ss009-t8-preview.json`            | `ec6b949575fbc8773cc54a36fcf29ebc18d0efcb6415a44548dc59d757bb1d03` |
| `ss009-av-sync.json`               | `029b6297b3c43325bb9a0f5ed39831b4122cb165893a37fdf2a5743a109c003b` |
| `ss009-playback.json`, first run   | `28bfc1e14434c6a0a0986b7c27df8a48b9e1e49c40e5320c60da2cce1ecbd86b` |
| `ss009-playback2.json`, second run | `db8dcde35644ff1af9d37bf35a5b2c9a22d538d798eee9cb3d12308c33fd4983` |
| `ss009-playback3.json`, third run  | `2327c60020f7b44c8275eaace4d099f09e9b2fdf60bff239055c0085fe9408b5` |
| `ss009-playback3-host.txt`         | `c5d2fa9ea79312eb86b4169da21b2fbc41bc6ceac80d7bce9e102762dd136903` |
