# Media engine improvement plan

Preserve the current canonical timeline → render plan → owned FFmpeg worker path. Media work must improve actual editing or delivery under the existing policy. No default GPU/backend replacement is selected.

## Delivered baseline and remaining gaps

YU-017/018/019 already provide proxies/thumbnails, preview diagnostics and rational fps. YU-020/021/022/023/024 provide transform/crop, crossfade, bounded opacity/volume animation, SDR/LUT policy and editable captions. YU-025 supports verified relink and export variants. YU-026c/d and PR #152 provide segmented export, boundary/loudness/queue fixes and still-chain hoisting. They do not establish general professional-editor parity or M export qualification.

| Area / task | Engineering hypothesis and boundary | Acceptance / fallback |
| --- | --- | --- |
| M profiling, SS-005a | Attribute decode, scale, loop, overlay, audio and encode work in `core/render.ts`, `core/render/plan.ts`, `core/render/segments.ts` | Preserve all failed runs; classify CPU/memory/disk costs before selecting one change |
| M optimization, SS-005b | Eliminate measured redundant work; test reusable immutable intermediates, bounded graph representation or proven coverage culling only if profile supports it | Same policy/output; alpha, transforms, LUTs, animation and segment seams included; revert to reference path if fidelity/resource checks fail |
| Preview, SS-009 | Inspect reference frame/segment cache and client proxy clock; compare WebCodecs/Mediabunny/native alternatives only at a narrow boundary | Keys include all rendering dependencies; stale results never display as current; close frames/buffers; seek/audio parity and cache pressure pass |
| Long sessions, SS-010 | Repeated seek/edit/reopen and asset replacement on large timelines | Stable bounded buffers/cache, no cumulative leak, no cross-project frames; no new ceilings |
| Audio, SS-012 | Expose current gain/fade/unlink/loudness coherently before adding buses or DSP | Sample/onset sync, clipping, silence, mute/solo, segment joins and loudness fixtures; preserve original assets |
| Captions/typography, SS-013 | Integrate existing editable captions with timing/RTL review and precise keyboard controls | Frame-boundary checks, mixed script, overlapping cues, sanitization and recovery; native Arabic review remains external |
| Precision/effects, SS-014 | Improve existing crossfade/transform/keyframe editing after interaction study | Rational-fps edit/export parity, no accidental ripple or unlocked-track writes; advanced effects remain unsupported until separately specified |
| Interchange, SS-015 | Extend existing OTIO boundary with explicit loss and safe portable media closure | Roundtrip supported subset; unsupported effects reported before conversion; hostile inputs and interrupted import cannot corrupt original |

Cache identity must bind asset content, source timing, render plan, profile, renderer/runtime version, fonts, LUTs and effect parameters as relevant. A mutable filename or job ID alone is insufficient. Cache eviction never deletes original assets or durable history; cache loss must be recoverable by recomputation.

Preview optimizations must advertise their supported subset and provide a reference fallback. Browser GPU availability is capability detection, not permission to change the export renderer. Hardware acceleration requires a bounded experiment, measured output compatibility and explicit resource review.

## Scope control

Professional audio buses, multicam, advanced retiming/masks, HDR, new motion-graphics runtimes and generalized GPU composition are research decisions under R-01/R-03. The initial build scope is existing capability integration plus one measured gap per task. If a new capability is justified, append a bounded child card with exact schema/command and tests before coding; do not silently turn an existing card into a rewrite.

For all media changes, validate real decoding, rational frame counts/timestamps, VFR source mapping, output codecs and audio synchronization. [10](10_PERFORMANCE_AND_BENCHMARK_PROGRAM.md) defines matched measurements. Worker crash/cancel/disk-full tests belong to integrity qualification, not optional performance testing.
