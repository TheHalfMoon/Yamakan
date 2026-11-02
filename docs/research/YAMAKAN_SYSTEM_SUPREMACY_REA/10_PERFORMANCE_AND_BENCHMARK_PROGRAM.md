# Performance and benchmark program

No threshold is changed by this plan. Read the live frozen [qualification policy](../../../core/qualification-policy.ts), [resource policy](../../../core/command/policy.ts) and existing S/M/T fixture definitions in [benchmark-ultimate](../../../scripts/benchmark-ultimate.ts) before every run. Record their hashes. SS-005a measures before SS-005b changes algorithms.

## Policies and retained observations

The qualification policy v1 specifies p95 cold launch ≤5000 ms (5 runs), reopen ≤2000 ms (5), warm reference still ≤1000 ms (10), cold still ≤3000 ms (10), cold 2-second reference segment ≤6000 ms (5), and 720p playback ≥24 fps. These apply only to their exact fixtures/hardware; this table is not a new qualification result.

The M export fixture is **200 clips, 16 tracks, ten minutes, 1080p**, under resource policy v3 with a 480-second time limit. Retained baseline completed 0/3; optimized completed 2/5. **M remains unqualified.** The older “M-gate passed” historical narrative is a different receipt and does not override this current export result.

PR #152 retained dense-probe median 66.133 → 9.187 seconds over three pairs, 16 clips/tracks, 30 seconds, 1080p; peak worker memory 421 → 351–354 MiB. These measurements were not rerun for this plan and cannot be generalized to translucent/animated workloads. Correct the existing yuva420p comment when touching that code: about 4.94 MiB per unaligned 1080p frame, not 3 MiB.

## Required workload matrix

| Family | Inputs / seams | Measurements and decision |
| --- | --- | --- |
| Baseline S/M/T | Existing frozen recipes, no easier substitute | Completion/failure rate, total and phase time, process-tree peak memory, CPU, temporary disk |
| Composition | Opaque/translucent still/video, transformed/cropped/LUT/animated layers, empty gaps | Decoded frame/alpha/color fidelity; optimization eligibility and fallback |
| Timing | 30, 24000/1001 and other supported rates, VFR mapping, B frames, segment seams | Exact counts/rational timestamps; no missing/duplicate frame or join drift |
| Audio | Delayed starts, silence, fades, mute/solo, loudness, segment joins | Sample/onset timing, peak/clipping, loudness and decoded continuity |
| Captions | Cue edges, overlapping text, mixed Arabic/Latin, font fallback | Frame-boundary/ROI checks plus native Arabic gate |
| Preview | Cold/warm scrubbing, reverse/random seeks, proxies, cache pressure | Latency distributions, playback clock/drift, reference/export parity |
| Long session | Repeated edits/seeks/reopens, large projects, asset/revision changes | Memory/cache plateau, stale-frame rejection, responsiveness |
| Failure | Cancel, worker/service kill, disk-full seam, lost response, restore | No leaked work, no partial publication, bounded retry and correct history |
| Selective revision | Full three-shot run versus changing one shot | Reused work, changed/unaffected hashes/frames, elapsed/resource cost and user actions |

## Protocol

1. Pin baseline/candidate code, fixtures, runtime/codec/font/LUT hashes, renderer/profile, policy, host, power mode and tool versions. Confirm idle media slot and adequate disk.
2. Define cold/warm cache state and all pass/fail thresholds before execution. Use the same compiler/codec settings and output semantics.
3. Run at least three interleaved baseline/candidate pairs for variable performance, recording every attempt, failure, timeout and exclusion reason. Additional repetitions are justified by observed variability; do not stop after a favorable candidate run.
4. Report paired differences and median/range; use p95 only with the policy's prescribed sample count and state small-sample limits. Never compare different hardware/cache/load conditions as if matched.
5. Validate real decoded output plus probes, audio and canonical-state integrity. Select per-case exact/SSIM/ROI tolerance before running; “looks similar” is insufficient.
6. For M, a candidate must complete every required qualification run within the unchanged policy and pass output/resource checks. A 2/5 result remains unqualified. Distinguish experiment evidence from formal qualification.
7. Preserve reproduction commands, all receipts and hashes. Reject an optimization that buys speed through incorrect output, weaker containment or increased failure rate.

Use existing `scripts/benchmark-ultimate.ts` and YU-090 recording infrastructure. SS-016 may establish internal selective-revision benefit without competitors. External superiority claims require separately matched competitor access, workload/settings, costs, output quality and failures; inaccessible/paid execution remains BLOCKED. No paid benchmark or model run is authorized.
