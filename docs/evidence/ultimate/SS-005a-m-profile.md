# SS-005a: profile of the maximum M export

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Measured on main `9cad22b5b49af5ff56c22e9598c340cf00313981`, renderer version 6. Measurement only: no production code, limit or fixture changed.

**Decision:** one bounded hypothesis is selected for SS-005b: culling layers proven hidden. The planned redundant-decode/scale hypothesis is **REJECTED** for this fixture. **M remains export-unqualified.** One gap against the card remains: process-tree CPU was not collected; replay CPU comes from one direct FFmpeg process, whether it started children was not checked, and worker peak memory comes from the process owner. The builder ruled this sufficient for attribution and recorded that ruling in the continuation ledger, where the founder can overrule it.

## Pins

| Item                                                    | Value                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Runtime `vendor/ffmpeg-win64-r8/ffmpeg.exe`             | `9378168c8ab648d25156001910c1f25ccee4c989b731f94ceaa1972ef1f5bb6b`                  |
| Resource policy v3, `core/command/policy.ts`            | `e803f22f75279de5d5a2f496164a88fa01a16b71eebabb2f50b3f3ae55d9e1c0`                  |
| Qualification policy v1, `core/qualification-policy.ts` | `058ac7b98dbcca8fe7e3721c8ee4583d86fc8be65442e3a82fe2007b3b76c501`                  |
| Fixture still, `testsrc2` PNG                           | `85947a0a7ea1a3d9018a71198df7c5011629604c640b1a5977485d77637b03ba`                  |
| Profiled project snapshot hash                          | `8aa545fe3890be786f21333a7b33a787f61066a5346268930b51cdd97e017b47`                  |
| Window 6 graph                                          | `9a88576d94c137f7147faaa86f5e685417c342eb9ebb49740b28acbec417612e`                  |
| Host                                                    | Windows 11, Intel i5-13420H (8 cores, 12 threads), Balanced power plan, on AC power |

The fixture is built by the existing M recipe: 200 clips of one still across 15 video tracks plus the audio track, 18000 frames, 1920x1080.

## Unchanged baseline, three attempts

`scripts/qualify-editor-scale.mjs --profiles M`, through the process owner, 480 s limit.

| Attempt | Host CPU before | Outcome                              | Wall    | Workers | Peak worker | Workspace after | Concurrent load                                                                         |
| ------- | --------------- | ------------------------------------ | ------- | ------- | ----------- | --------------- | --------------------------------------------------------------------------------------- |
| 1       | 27%             | **FAILED** `LIMIT_EXCEEDED`          | 479.8 s | 15      | 421 MiB     | 3.1 MB          | Builder ran typecheck, lint and format checks during it                                 |
| 2       | 1%              | **PASSED**, 18000 frames, 13 windows | 357.6 s | 29      | 421 MiB     | 9.9 MB          | Builder's account: no heavy command; not instrumented                                   |
| 3       | 17%             | **FAILED** `LIMIT_EXCEEDED`          | 479.9 s | 17      | 421 MiB     | 3.3 MB          | Builder's account: no heavy command; not instrumented, and other host load not recorded |

By arithmetic from the 37.5 s window and the passing run's times, 10 windows cover 37.5 s and 3 cover 75 s. The passing attempt took 17–25 s for the short windows and 41–47 s for the long ones. The failing attempts took about 39–78 s for short windows and 90–98 s for completed long ones; attempt 1's last long window was stopped at the limit after 66 s, and attempt 3's last short window after 22 s. One pass is not qualification, and these attempts do not meet the required run count. Process-tree CPU was not collected; worker peak memory comes from the Job Object through the owner.

Two analysis errors are retained. The first reading of these runs used `docs/evidence/ultimate/editor-scale.json` and showed three identical failures; the script leaves that file alone on a partial run, so those were older figures. The results above come from each run's own output. The first version of the profile tool captured a 1280x720 window because it skipped the project size step; those timings were discarded, and the tool now refuses a window not at M's size.

## Later baseline on AC power

Three more unchanged attempts at main `596a20cd169bf6094be2c8bc6e5bef3334d0c8fc`, later on 2026-11-04, on AC power with no builder work running and host CPU at 13%, 27% and 2% before each: **all three failed** `LIMIT_EXCEEDED`, at 479.9, 479.2 and 479.2 s, with short windows at about 28 to 67 s. The one earlier pass, 357.6 s with windows near 22 s, has not been repeated. So battery power does not explain the failures, and the fast state behind that pass is still not understood. M completes within its limit in 1 of 6 attempts on this host. Receipts: `ac/attempts.txt` `676e65e34b2a28128e359cd6d5e87cbc2bb76bdf5882350b1fa4cba698a50c30`, `ac/attempt-1.log` `bd0cfa5d2a659de024085506e5473c71bbf18c7d696dbf3261a6fe360e0d7634`, `ac/attempt-2.log` `1cb33940aa4bf5a330ea1e4f03b81d31fc5f0b519bf48a6316507cb1dfa12821`, `ac/attempt-3.log` `e4f230a778d0474051aaa50057e834e80236673a89303c524eebb89f30b40cd8`.

## Attribution of one window

`scripts/profile-m-export.mjs` captures the exact command production would run for window 6 of 13, a short, typical window: 37.5 s of output, 28 picture chains, about 14 of them shown at once, 1 input. It replays variants outside the process owner, three times each. Results from the version of the tool with these six variants:

| Variant                     | Wall, three runs   | CPU, three runs    | Peak RSS |
| --------------------------- | ------------------ | ------------------ | -------- |
| Production graph, encode    | 68.9, 52.1, 63.0 s | 69.6, 66.8, 71.5 s | 414 MiB  |
| Production graph, no encode | 45.0, 43.8, 44.3 s | 35.9, 36.7, 36.7 s | 200 MiB  |
| Nothing drawn, no encode    | 1.2, 1.1, 1.0 s    | 1.3, 1.0, 0.9 s    | 200 MiB  |
| First frame only, no encode | 0.4, 0.5, 0.4 s    | 0.3, 0.3, 0.3 s    | 194 MiB  |
| Last track only, encode     | 8.9, 6.9, 7.1 s    | 25.3, 20.0, 19.8 s | 290 MiB  |
| Last track only, no encode  | 1.4, 2.0, 1.8 s    | 1.3, 2.0, 1.8 s    | 55 MiB   |

Attribution, in CPU, for this window:

- **Decode and scale, one still through all 28 chains:** at most about 0.3 s. This variant also composites one frame.
- **Loop, timing and frame synchronization:** at most about 1 s. With `enable='0'` the overlay passes its main input through, and this variant does not prove every chain's frames were pulled, so it is an indication only.
- **Overlay blending:** about 35 s, by subtraction, and consistent with an independent figure: about 1.3–2.0 s per active layer from the last-track variant, times about 14 layers, gives 18–28 s. That leaves 7–17 s unexplained. The 35 s also varies with host state, cause not established: the same graph with encode finished in 17.4 s wall at the end of this session, so its graph CPU was then at most about 17 s. Blending dominates the graph's cost in every measurement; its size is approximate.
- **Encode:** about 30–35 s, running on its own threads. Its CPU falls to about 18–24 s for the identical output of the last-track graph, so graph and encode costs are not additive.

Wall time is limited by the graph because production sets `-filter_complex_threads 1` (`core/render.ts`), a frozen setting this work does not change. The host can also limit wall time, as the next section shows. These times are for one window and are not a prediction for a whole export.

**Instrumentation overhead.** `-benchmark` paired against no flag, order swapped: 33.9 against 33.5 s, 21.5 against 37.1 s, 33.7 against 30.0 s. Host variation exceeds any effect, so the overhead is unresolved; no consistent cost appears. The baseline attempts above used neither this flag nor this tool. Earlier tool versions gave similar variant ordering (for example production graph with encode 37–41 s wall, 66 s CPU), and their raw results are retained.

The filter output of the production and last-track graphs over the whole window has equal MD5, `a98146368861fe2b7e017fe30989f2a0`.

Controls, whole window, with the same change to the top layer's chain in both graphs:

| Control                                                  | MD5, all layers                    | MD5, last track only               | Expected | Result      |
| -------------------------------------------------------- | ---------------------------------- | ---------------------------------- | -------- | ----------- |
| Alpha top layer                                          | `72b2e5e17dd42725859d2432cd0fb2ec` | `2b22bfec0d7c6faa7702e452c45247ff` | Differs  | As expected |
| Non-covering top layer (transform)                       | `bf415e71a7e260758125974871c6fbff` | `8c12363cfba4a51e39a0c5c37d8516d8` | Differs  | As expected |
| Fading top layer (animation)                             | `a98146368861fe2b7e017fe30989f2a0` | `dd77e723ccb5865ff12f37b6890ddb60` | Differs  | As expected |
| Graded top layer, still opaque (production `lut3d` form) | `24ed1c782daa047b0e2d303643b16f3f` | `24ed1c782daa047b0e2d303643b16f3f` | Same     | As expected |

These are graph edits that show the measurement is sensitive to unsafe culling. They do not test SS-005b's guards. The fading control's all-layers MD5 equals the unfaded one because every layer here shows the same still: a limitation of this fixture, addressed below. The LUT control is an inverting `.cube` file through the production `format=gbrap,lut3d=...:interp=tetrahedral` filter form, as a graph edit. It ran in a later `--controls-only` run, whose identity and other controls reproduced the same MD5s.

**Segment seam.** Window 7, which follows window 6 at the 300 s boundary, gives the same result: 75 s of output, 28 chains, identity MD5 `a6cb5e8cb28406128d7a53270ef81fb5` for both graphs, and all four controls as expected. Both sides of that boundary are therefore frame-identical when culled, and the windows join by stream copy without re-encoding pixels. This is a graph-level result on one boundary: decoded output of an encoded join across a real culler was not run, and remains an SS-005b test. The profile's graph hash differs per window, and its project snapshot hash differs per run because clip IDs are random; the still hash is unchanged.

## Run-to-run swing

The same production command, through the process owner and directly, is the clearest evidence.

| Session                             | Pair | Owner  | Direct |
| ----------------------------------- | ---- | ------ | ------ |
| Earlier, owner always first         | 1    | 21.5 s | 43.6 s |
|                                     | 2    | 36.6 s | 33.0 s |
|                                     | 3    | 43.3 s | 37.8 s |
|                                     | 4    | 37.1 s | 39.4 s |
| Final tool, order swapped each pair | 1    | 21.0 s | 19.3 s |
|                                     | 2    | 21.4 s | 18.7 s |
|                                     | 3    | 20.7 s | 17.4 s |

The process owner does not explain the swing. In the final session, the owner was consistently 1.7–3.3 s slower than direct, or 9–19% of direct wall time. Very roughly that is 20–45 s across 13 windows against a 480 s budget, which SS-005b should evaluate. The same production graph with encode took 52–69 s earlier in that session and 17–21 s at its end, though the earlier variant also carried `-benchmark` and wrote a different output path.

An earlier version of the comparison failed two owner runs with exit `-13` in under 300 ms; giving the direct run its own output and removing the owner's file before each run stopped this. Those runs are retained in the log and excluded here.

**The cause of the swing is not established.** The host is a hybrid CPU, and scheduling, power or thermal state are candidates that were not tested. CPU seconds are not a stable normalizer either: the same no-encode graph measured 30.7 s and 40.5 s medians in earlier runs and 36.7 s here, and window 6 completed in 21.7 s with encode in the passing baseline. On this host a single M result is weak evidence. SS-005b must alternate paired runs with swapped order and report wall and CPU time together.

## Hypotheses

**REJECTED: reducing redundant decode and scale.** On this fixture each still is already read as one input and split (YU-026b), and its fit and colour conversion run once per chain on its single frame before the loop (YU-026e). The first-frame variant bounds all of that, for all 28 chains, at about 0.3 s CPU out of about 36 s in window 6. Extending this to the planned hypothesis of work across overlapping window inputs, if other windows resemble window 6, gives very roughly 4 s across 13 windows; only window 6 was measured. This fixture has no footage, so the result says nothing about footage-heavy timelines.

**SELECTED for SS-005b: do not composite a layer proven hidden.** In a render window, omit a picture chain whose whole time range is covered by a higher layer proven opaque, fully covering and present. Cost: a coverage pass in the render plan, and a new asset fact, because the plan does not currently record whether a source has alpha. Guards before a layer may act as an occluder:

- the source is known to have no alpha, from the recorded probe; unknown means not an occluder
- no transform, opacity animation or dissolve, and the fit fills the frame exactly
- frames are present for the whole span. Overlay uses `eof_action=pass`, so an `enable` window alone does not prove this: footage that ends early or starts late would show the lower layer in production and black once culled. Restrict occluders to stills, or prove decoded-frame coverage
- the enable window covers the hidden layer's for the whole span, checked in integer ticks

Acceptance requires output identical to the uncombined graph across alpha, transform, production LUT, animation and segment-seam fixtures. Those fixtures must use **different content per layer**: here every chain shows one still, so culling a middle layer under a translucent top would not change the MD5.

**The main limit is applicability.** The M fixture is a synthetic stack of opaque full-frame stills, the best possible case for this change. Timelines whose upper layers are smaller or translucent gain nothing, and this profile does not measure how common stacked opaque layers are. SS-005b may therefore qualify M without making typical exports faster, and it must say so. If the guards cannot be met or paired runs show no safe win, SS-005b ends REJECTED and M stays unqualified. No deadline, thread, memory or concurrency increase is proposed.

## Reviews

Fresh independent review of `1f453e7` required changes: decode/scale attribution and overhead were missing; fixture and policy hashes were missing; a failed digest could read as an equal pair; the claim that CPU time was stable was wrong; frame-availability and per-layer-content guards were missing. This version addresses them, except that process-tree CPU was not collected. A delta review of `6665305` required correcting the killed-window range, this record and the LUT control. A delta review of `b1ab25f` required the SS-005b card to require a seam control, and pointed out that the seam skip was avoidable, which led to the window 7 run. Later review and CI results are recorded in the ledger.

## Receipts

Raw logs stay local; SHA-256 binds them. `run-baseline.sh` produced the attempts.

| File                                           | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `attempts.jsonl`                               | `fe035e77720a3ff508fd77d45e687032502c8032bd3f967fc57653c10fa3adfc` |
| `run-baseline.sh`                              | `1aaa11999357bf7f47e379b8a6af16de3c09b5fe32aa63a4d9a04d0e9fcf965a` |
| `attempt-1.log`                                | `d0f4adb17275bf68de9e5500d5abbc9e385c3edef031583f3050b2b33023c225` |
| `attempt-2.log`                                | `55bca6a43a93ee516d1e35b19dab62afbc6e160c27059cf8f26a7255067535c1` |
| `attempt-3.log`                                | `f475cf82971fb896ef6822daf7eea4e1cb31f67d312caea0290454bf44573b19` |
| `m-1.json`                                     | `c62849b2c9652fc0555d5105b7b134c054f85ab696ca31914791144f159adce3` |
| `m-2.json`                                     | `5689f3eaacc489118ff6761d0efa49ddf69f2c9232f7d1141e0502af84bbf2f9` |
| `m-3.json`                                     | `003cfe4e58dbcbc59593e7c1d8236aabd8ac66c0a69e630b5da35a03b32c5959` |
| `profile-w6-attribution.json`, earlier tool    | `2e6670617d712053eba92f56159454f3a169cf26854edd5b19c63d4d0a98e15f` |
| `profile-w6.json`, earlier tool                | `bcf7d61e1df3d9b888e70389a3fe021523d8d24cca68be937d9cabd8c60a0ddb` |
| `profile-w6-compare.json`, earlier tool        | `c57a8ce4676a422300abf2e041e2a3983476fb7c73877ec4b0b8c1d50e245cb2` |
| `v3/controls.json`, controls only              | `2ad368df63b0d11de02a6e3ff48fb389ba19dd4392fccc141da6832de6c41719` |
| `v4-w7/controls.json`, window 7, controls only | `649d74dd07d6bc1830ef7db7a8fb3f3f61a5d87d1198b8cbf68bf72b3ebb82cd` |
| `v2/profile-w6.json`, six variants             | `b93510a3b0b6b6f3d307ea087eeb2153cde768095fdda322f9b1177969b6b5a7` |

Rollback: remove `scripts/profile-m-export.mjs`, this file and the added SS-005b negative tests. Production and stored projects are unaffected.
