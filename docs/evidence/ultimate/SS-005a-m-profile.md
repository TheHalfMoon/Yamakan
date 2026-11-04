# SS-005a: profile of the maximum M export

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Measured on main `9cad22b5b49af5ff56c22e9598c340cf00313981`, renderer version 6. Runtime `vendor/ffmpeg-win64-r8/ffmpeg.exe` SHA-256 `9378168c8ab648d25156001910c1f25ccee4c989b731f94ceaa1972ef1f5bb6b`. Resource policy v3 and qualification policy v1 unchanged. Host: Windows 11, Intel i5-13420H (8 cores, 12 threads), Balanced power plan, on AC power. Measurement only: no production code, limit or fixture changed.

**Decision:** one bounded hypothesis is selected for SS-005b, culling layers proven hidden. The planned redundant-decode/scale hypothesis is **REJECTED** for this fixture. **M remains export-unqualified.**

## Unchanged baseline, three attempts

`scripts/qualify-editor-scale.mjs --profiles M`, through the process owner, 200 clips, 16 tracks, 18000 frames, 1920x1080, 480 s limit.

| Attempt | Host CPU before | Outcome                              | Wall    | Workers | Peak worker | Concurrent load                                         |
| ------- | --------------- | ------------------------------------ | ------- | ------- | ----------- | ------------------------------------------------------- |
| 1       | 27%             | **FAILED** `LIMIT_EXCEEDED`          | 479.8 s | 15      | 421 MiB     | Builder ran typecheck, lint and format checks during it |
| 2       | 1%              | **PASSED**, 18000 frames, 13 windows | 357.6 s | 29      | 421 MiB     | None known from the builder                             |
| 3       | 17%             | **FAILED** `LIMIT_EXCEEDED`          | 479.9 s | 17      | 421 MiB     | Not recorded; other applications ran on the host        |

Window times reached 73–97 s in the slow attempts and 17–47 s in the passing one. One pass is not qualification, and these attempts do not meet the required run count.

Two analysis errors are retained. The first reading of these runs used `docs/evidence/ultimate/editor-scale.json` and showed three identical failures; that was wrong, because the script leaves that file alone on a partial run, so those were older figures. The results above come from each run's own output. The first version of the profile tool captured a 1280x720 window because it skipped the project size step; those timings were discarded, and the tool now refuses a window that is not at M's size.

## Attribution of one window

`scripts/profile-m-export.mjs` captures the exact command production would run for window 6 of 13: 37.5 s of output, 28 picture chains, 1 input. It replays variants outside the process owner, three times each. Medians from the quieter run:

| Variant                     | Wall   | CPU    | Peak RSS |
| --------------------------- | ------ | ------ | -------- |
| Production graph, encode    | 37.8 s | 65.8 s | 415 MiB  |
| Production graph, no encode | 31.0 s | 30.7 s | 200 MiB  |
| Top track only, encode      | 7.6 s  | 22.0 s | 290 MiB  |
| Top track only, no encode   | 2.3 s  | 2.2 s  | 57 MiB   |

The single-threaded filter graph limits wall time: about 31 of 38 s. Almost all of that is compositing the stacked layers, since the same window with only the top track takes 2.3 s. Encoding runs in parallel and adds about 6.5 s of wall time. A second run overlapped other work; its wall times were 44–146 s for the full-graph variants and are retained, while its CPU medians stayed closer, at 67.5, 40.5, 25.2 and 2.4 s. These times are for one window and are not a prediction for a whole export.

Decoded output of the production and top-track graphs over the whole window has equal MD5, `a98146368861fe2b7e017fe30989f2a0`.

Negative controls, whole window, with the top layer's chain changed in both graphs:

| Control                | Decoded MD5, all layers            | Decoded MD5, top track only        | Result  |
| ---------------------- | ---------------------------------- | ---------------------------------- | ------- |
| Alpha top layer        | `72b2e5e17dd42725859d2432cd0fb2ec` | `2b22bfec0d7c6faa7702e452c45247ff` | Differs |
| Non-covering top layer | `bf415e71a7e260758125974871c6fbff` | `8c12363cfba4a51e39a0c5c37d8516d8` | Differs |

So culling is safe only when guarded. LUT, animation and segment-seam controls were **not** run here, because no renderer behaviour changed; they are SS-005b acceptance requirements.

## Run-to-run swing

The same command, alternating process owner and direct, four pairs in one session:

| Pair | Owner  | Direct |
| ---- | ------ | ------ |
| 1    | 21.5 s | 43.6 s |
| 2    | 36.6 s | 33.0 s |
| 3    | 43.3 s | 37.8 s |
| 4    | 37.1 s | 39.4 s |

The process owner does not explain the swing: both paths vary widely, with no consistent winner. An earlier version of this comparison failed two owner runs with exit `-13` in under 300 ms; the likely cause is the direct run's leftover output file, since giving the direct run its own output and removing the owner's file before each run stopped the failure. Those runs are retained in the log and excluded here. CPU time stays nearly constant while wall time moves, which is consistent with host scheduling, power or thermal state. **The cause is not established.** On this host a single M result is weak evidence, so SS-005b must alternate paired runs and report CPU time beside wall time.

## Hypotheses

**REJECTED: reducing redundant decode and scale.** On this fixture each still is already read as one input and split (YU-026b), and its fit and colour conversion run once per chain on its single frame before the loop (YU-026e). With only the top track, those steps and everything else in the window take 2.3 s, so little remains for this change in the 28-chain graph, whose time is in compositing. This fixture has no footage, so the result says nothing about footage-heavy timelines.

**SELECTED for SS-005b: do not composite a layer proven hidden.** In a render window, omit a picture chain whose whole time range is covered by a higher layer proven opaque and fully covering. Cost: a coverage pass in the render plan, and a new asset fact, because the plan does not currently record whether a source has alpha. Guards required before a layer may act as an occluder:

- the source is known to have no alpha, from the recorded probe; unknown means not an occluder
- no transform, opacity animation or dissolve, and the fit fills the frame exactly
- its enable window covers the hidden layer's for the whole span, checked in integer ticks
- output is identical to the uncombined graph across alpha, transform, LUT, animation and segment-seam fixtures

**The main limit is applicability.** The M fixture is a synthetic stack of 16 opaque full-frame stills, the best possible case for this change. Timelines whose upper layers are smaller or translucent gain nothing, and this profile does not measure how common stacked opaque layers are. SS-005b may therefore qualify M without making typical exports faster, and it must say so. If the guards cannot be met or paired runs show no safe win, SS-005b ends REJECTED and M stays unqualified. No deadline, thread, memory or concurrency increase is proposed.

## Receipts

Raw logs stay local under `work/ss005a/`; SHA-256 binds them. Machine paths in them are not published.

| File                          | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `attempt-1.log`               | `d0f4adb17275bf68de9e5500d5abbc9e385c3edef031583f3050b2b33023c225` |
| `attempt-2.log`               | `55bca6a43a93ee516d1e35b19dab62afbc6e160c27059cf8f26a7255067535c1` |
| `attempt-3.log`               | `f475cf82971fb896ef6822daf7eea4e1cb31f67d312caea0290454bf44573b19` |
| `profile-w6-attribution.json` | `2e6670617d712053eba92f56159454f3a169cf26854edd5b19c63d4d0a98e15f` |
| `profile-w6.json`             | `bcf7d61e1df3d9b888e70389a3fe021523d8d24cca68be937d9cabd8c60a0ddb` |
| `profile-w6-compare.json`     | `c57a8ce4676a422300abf2e041e2a3983476fb7c73877ec4b0b8c1d50e245cb2` |
| `m-window-graph.txt`          | `9a88576d94c137f7147faaa86f5e685417c342eb9ebb49740b28acbec417612e` |

Rollback: remove `scripts/profile-m-export.mjs` and this file. Production and stored projects are unaffected.
