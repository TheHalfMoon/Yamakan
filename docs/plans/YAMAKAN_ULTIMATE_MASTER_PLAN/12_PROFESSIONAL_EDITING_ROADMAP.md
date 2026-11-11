# Editing, preview, rendering and performance roadmap

Planning targets below are not achieved results. Existing frozen policy `core/qualification-policy.ts` remains authoritative for its named fixtures; do not weaken it to pass a new workload. Current source paths, fixtures and historical measured values are detailed in [01](01_CURRENT_CODEBASE_AUDIT.md).

## Delivery order

| Milestone | Current gap | Concrete result | Primary approach / source |
|---|---|---|---|
| Integrity | Studio/Cinema/Director outside full recovery; local UI history differs | Canonical creative document lifecycle, security/run ledger, complete backup and command edits | BUILD on `ProjectStore`, registry, recovery |
| Bounded media | Full browser waveform fetch/redecode; large decode cost | Immutable waveform/thumbnail/proxy derivatives, cancellation and cache quotas | ADAPT existing media/FFmpeg and inspected donor algorithms |
| Useful preview | Fast/reference semantics differ | Explicit qualified subset, cached segments and audio clock diagnostics | ADAPT existing `render/preview.ts` and `PreviewPlayer` |
| Time and scale | 30fps projection, ten-minute/200clip limits | One non30 rational profile first, then measured profile expansion | BUILD on existing flick/rational core; OTIO oracle |
| Finishing basics | Effects largely preview-only, long keyframe graph growth | Typed transforms/crossfade/curves and SDR color with reference/export parity | ADAPT OpenCut/FFmpeg modules; no donor project model |
| Accessible production | Caption track and batch variants absent | Imported SRT/VTT captions, loudness and variant export receipts | BUILD typed tracks/jobs; WRAP existing libass/FFmpeg |
| Advanced media | Masks/tracking/stabilization/HDR unqualified | Bounded decision spikes with source/license/resource evidence | DEFER activation; no advertised capability from a prototype |

## Reproducible workloads

Use generated consent-safe fixtures where possible, separately licensed real H264/HEVC/VFR/rotation/audio samples where necessary. Hash source bytes and record duration/codec/stream counts. Do not download a massive benchmark corpus on the current disks. Fixtures exceeding current policy are expected to refuse until a separately reviewed larger profile exists.

| Profile | Frozen proposed workload | Primary measurements | Current support |
|---|---|---|---|
| S |30s720p30,10clips,3tracks,2titles,embedded+unlinked sound | Startup/open, edit-to-ack, reference still, playback/sync/export | Similar historical fixtures, fresh run required |
| M |5min1080p30,100clips,8tracks,100edits,Arabic/English titles | Browser RSS/heap, waveform requests, timeline drag p95, backup/reopen | Within selected counts; combined workload unqualified |
| L |30min1080p,1000clips,24tracks,5000revisions | Schema/DB growth, recovery, virtualized timeline, render preflight | Outside current limits; blocked until profile expansion |
| H |60s4K24/24000/1001 with720p proxy,50clips | Proxy index accuracy, scrub, full-resolution final render, disk bytes | 4K output/rate outside current support |
| A |10min48kHz,16audio-bearing tracks,retime/fades/loudnorm | Drift, peaks IO, clipping/LUFS, sample alignment, render time | Full workload unqualified |
| K |5min100animated clips,10keys each,opacity/volume then transforms | Plan/filter size, compile/start latency, RSS, sampled curve parity | Existing animation grows with frames; benchmark before widening |

## Measurement and budgets

Baseline capture uses exact Git SHA, dirty status, package-lock/native/FFmpeg/font/browser hashes, OS/build, CPU/RAM/GPU, volume type/free bytes and power mode. Five startup/open samples reproduce existing policy; new p95 latency claims need at least30 repetitions and uncertainty. Use OS-cache-warm and explicitly cold-cache cohorts; do not label a service restart a physical cold disk start. Record all failed attempts and enough raw timestamps to recompute distributions.

| Measure | Policy or candidate threshold | Selection rule |
|---|---|---|
| Startup | Existing p95<=5000ms on frozen fixture | Historical launch1087ms is not new-head pass |
| Reopen | Existing p95<=2000ms on frozen fixture | Includes authenticated project retrieval; separate browser-first-paint |
| Reference still | Existing warm p95<=1000ms,cold<=3000ms | Exact frozen preview fixture and hashes |
| Reference segment | Existing cold p95<=6000ms for2s segment | Preserve queue/cancel behavior |
| Playback | Existing min24fps target for named720p profile | Report dropped frames/minimum1s windows and A/V drift; average alone insufficient |
| Timeline input | Candidate p95<=50ms visual feedback at60Hz display; committed edit<=250ms on S | Freeze after measured baseline; stop unsupported profile rather than hide misses |
| A/V synchronization | Candidate absolute drift<=one output frame and<=20ms on the agreed audio fixture | Measure source PTS/priming and end-to-end output; choose stricter applicable bound |
| Waveform/cache | No full original refetch for unchanged hash across100edits; bounded service response | Browser memory must scale with visible peak tiles, not original file bytes |
| Memory | Keep existing worker limits; report process tree/browser/DB caches independently | New budgets based on measured host headroom; no invented fixed pro memory promise |
| Disk | Reserve original+derivative+staging+backup before work; measured free-space guard | Refuse new work without deleting acknowledged history |
| Export | Wall/clip-duration ratio per codec/profile, p50/p95; no universal fps claim | Qualification budget set before optimization experiment from measured baseline |
| Recovery | Exact acknowledged revision/document/assets; no orphan process | Zero data-loss invariant for injected process death, not untested power-loss guarantee |
| Concurrent jobs | Preserve current owned-worker policy and queue bounds | Interactive latency under one background job; raising concurrency is a separate task |

All new thresholds are candidate budgets requiring frozen policy review before they can count as release criteria. Never adjust a threshold after seeing failure without a versioned rationale and required founder policy approval.

## Native preview escalation gate

First profile existing Canvas/proxy/reference behavior, bound caches and stop repeated full-media work. If S/M cannot meet the approved playback/interaction policy, perform a **bounded MLT preview spike** using the same source/hash/time/effect fixtures, without adopting its project persistence or scheduler. Measure Windows build closure, latency, color/audio parity, memory, process shutdown and packaging/license obligations. Adopt only if the gain survives repeated equal-profile tests and the maintenance cost is acceptable. A failed spike is a valid result; retain the existing reference path. GStreamer/Blender/Remotion remain alternatives requiring the same evidence rather than automatic fallbacks.

Professional export follows the canonical plan, never browser-only effect state. Relink verifies media identity or records an explicitly approved source replacement; source path/name matching alone is insufficient. Batch exports freeze independent plan/profile hashes and share safe source pins, not mutable editor state.
