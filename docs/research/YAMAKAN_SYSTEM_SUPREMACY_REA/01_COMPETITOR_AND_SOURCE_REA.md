# Competitor systems and source decisions

Observed 2026-10-28 through 2026-10-29. Pins below refer to code actually retrieved, not floating default branches. No competitor application was executed. No new donor source has been imported by this research PR.

## Capability-to-source matrix

| Competitor/system | Capability and evidence | Why it matters | Source candidate / decision | Yamakan target | Acceptance tests |
| --- | --- | --- | --- | --- | --- |
| Kinewright | **SOURCE INSPECTED**: durable specialist branches bind base head, document hash and checkpoint reference; reopen verifies their identities | An agent must not silently apply work planned against a different project | `durable_branch.rs`; **ADAPT concepts / DEFER transplant** | Director dependency lineage and existing revision-bound proposals | Replace an upstream result, reopen, refuse stale approval/merge; preserve unaffected edits |
| OpenFilm | **SOURCE INSPECTED**: `inverse`, `trackNow`, `reopenTracks` construct undo operations for touched clip fields and recover removed tracks | Human undo should preserve unrelated agent work | `undo.ts` and its tests; **DEFER** until mapped to canonical IDs/CAS | `core/timeline` and existing per-writer history | Interleaved users/agents, deleted tracks, changed flags, same-field conflicts |
| VEED OpenEdit | **SOURCE INSPECTED**: canonical request key, exclusive attempt claims and explicit uncertain-submission state | A lost response must not cause an irreversible action to be repeated | `queue-ledger.ts`, `exclusive-files.ts`; **ADAPT recovery cases, REJECT second ledger** | Existing jobs/attempts/external-request reconciliation | Kill before submit, after acceptance, before recording response; no duplicate action |
| Remocn Studio | **SOURCE INSPECTED**: turn-scoped tool binding, pipeline events and cancellation propagation | Creators need progress tied to their project, with useful cancellation | `turn-tools.ts`; **DEFER** pending full store/execution trace | Existing MCP and Director progress surfaces | Wrong-project rejection, cancellation, restart, progress from committed state |
| OpenMontage | **SOURCE INSPECTED**: checkpoint writes enforce prerequisites for both awaiting-human and completed transitions | Approval must not complete a stage after its prerequisites become invalid | Existing pinned `checkpoint.py`; **ADAPT existing Yamakan translation** | `approveStage` and `applyApproval` (SS-001) | Expired predecessor refused without writes; request remains retryable; unfinished/output-less attempts refused |
| Orcel | **SOURCE INSPECTED, limited**: protected authority store separates state schema/epoch from lease, authenticates persisted state and fails closed | Recovery must not manufacture authority | `full_control_store.rs`; **DEFER** native grant reuse | Existing principals, execution epoch and release-gated native presence | Corrupt/missing state refuses; restored approval requires revalidation; native second-account tests remain external |
| LosslessCut | **SOURCE INSPECTED**: distinguishes exact-keyframe cuts from a short re-encode boundary; probes a wider keyframe window only when needed | Avoiding unnecessary encoding can improve simple trim workflows | `smartcut.ts`, `useKeyframes.ts`; **DEFER**, not a general compositor replacement | A future restricted no-effects export profile | Exact/rational/VFR boundaries, B frames, missing next keyframe, decoder/encoder continuity, audio sync |
| Temporal TypeScript SDK | **SOURCE INSPECTED**: structured cancellation scopes, shielded cleanup and deterministic workflow clocks/timers | Cancellation and recovery must have specified semantics | `cancellation-scope.ts`, `global-overrides.ts`; **ADAPT test concepts, REJECT whole runtime** | Existing durable jobs and Director interruption tests | Cancel during work/cleanup, restart, lease fencing, no replayed irreversible side effect |

## Exact source boundaries

| Repository | Pin | License inspected/metadata | Files read | Integration decision |
| --- | --- | --- | --- | --- |
| [Kinewright](https://github.com/CanadaApollo6/Kinewright) | `0b353397845c52fba9c34bfd64700d381ce721cb` | GPL-3.0 license file | `crates/kinewright-agent/src/durable_branch.rs`; `crates/kinewright-project/src/editing_session/durable.rs` retrieved for review; `docs/M30-PERCEPTION-REVISION-SAFETY.md` | Do not import its Rust project store/Core actor. Inspect registered editing-session paths before any reuse claim. |
| [OpenFilm](https://github.com/openfilm/openfilm) | `97bc98b9d2d9585ea917b24abc9742c68b5f0a27` | MIT license file | `packages/openfilm/studio/ui/src/editor/undo.ts`, `undo.test.ts`, README | Clip/track structure differs: index-based tracks versus Yamakan identities. No safe drop-in transplant. |
| [OpenEdit](https://github.com/veedstudio/open-edit) | `1d3b75b7f46280061bae5ab4cb47b9538276d8fb` | Apache-2.0 license file | `cli/src/providers/queue-ledger.ts` (selected lifecycle sections), `exclusive-files.ts`, README | Filesystem claims/leases are not Yamakan's authority. Keep paid provider integrations disabled. |
| [Remocn Studio](https://github.com/Remocn/remocn-studio) | `fe21cf3db88e0036afea80716abd12d4373a2dd7` | MIT license file | `sidecar/agent/turn-tools.ts`, README | Effect runtime, project store, library and preview supervisor are a large dependency closure; not qualified for copying. |
| [OpenMontage](https://github.com/calesthio/OpenMontage) | `9327439db69021ab4b0e2776729bf3b58fdb5a87` | AGPL-3.0 license file; existing Yamakan provenance retained | `lib/checkpoint.py`: `_enforce_stage_prerequisites`, `write_checkpoint` | Reuse the already translated prerequisite function; no Python/filesystem checkpoint system imported. New upstream discovery head `e01dbf433f46eeb91d39bf905e194162921019a3` is not this qualified pin. |
| [Orcel](https://github.com/TheHalfMoon/Orcel) | `ef9500a136dd3245df34fdf75be9f798628a18f7` | Apache-2.0 repository metadata; full reuse license closure not qualified | `crates/orcel-policy/src/full_control_store.rs` selected functions; `full_control.rs` and crate manifest retrieved | Rust/platform/protected-state dependencies require further review. No keys, grants or private runtime data read. |

## SS-001 qualified source-first decision

**Upstream → commit → file → function:** OpenMontage → `9327439db69021ab4b0e2776729bf3b58fdb5a87` → `lib/checkpoint.py` → `_enforce_stage_prerequisites`, called by `write_checkpoint` before recording completion.

**Yamakan call graph:** command registry human-only `yamakan.director.approve` → `approveStage` → `store.transaction` → request replay/CAS → existing `enforceStagePrerequisites` → `applyApproval` → managed-output check → append attempt/version → request receipt. The gap was that only `advanceStage` invoked the prerequisite function.

**Decision: ADAPT.** Kinewright's stronger durable base identity suggests a separate lineage task; copying its Rust bundle machinery would create a new storage authority. OpenFilm's UI undo and OpenEdit's external queue ledger solve different problems. The smallest suitable implementation already exists inside Yamakan.

**Dependency closure / runtime:** existing TypeScript, zod, command errors, manifest and SQLite transaction; no dependency added. Works without a model or provider. No new workers, network access, native runtime or resource-policy allowance.

**Invalid inputs, failure and concurrency:** current stage must contain an output and be awaiting review or completed for renewal; the requested hash must match. Predecessors must still be completed with valid required approvals. Rejections occur before writes; a rejected request can retry after prerequisites are repaired. The transaction and run-version check retain serialization. Successful old requests replay their recorded response; that response is not a fresh validity assertion.

**Preserved behavior:** matching-output renewal, request idempotency, current execution epoch, project-owned assets, human-only boundary, immutable attempt history and one workspace authority. No database migration.

**Performance:** adds a bounded manifest/predecessor scan (builtin pipeline has three stages, schema permits 32); no media decode or subprocess. No measured speedup claimed.

**Security/provenance:** existing donor notices remain; imported file hashes and modification notes updated. Fresh independent correctness and security reviewers found no must-fix issue. Output dependency invalidation after upstream replacement remains an explicit separate gap.

**Acceptance / rollback / maintenance:** regression must fail before fix and pass after; refusal changes neither version nor attempts/receipt; later corrected retry works; both Director suites and broader gates pass. Rollback is an ordinary code revert, without data migration, but restores the known approval gap. Maintain the guard in the shared approval boundary rather than each client.

## Accessible ecosystem discovery

The authenticated account is TheHalfMoon. Its accessible repository listing returned 51 repositories spanning public and private projects; private source, credentials and business data are not reproduced here. Flind was reachable as private with an unclassified license (`NOASSERTION`), so no transplant is qualified. Wepld returned no match in the scoped account search; this is not proof of global nonexistence or inaccessible-account availability.

Additional metadata/tree inventories (not deep REA): Gomrey `5f299a7a6174ad3a1180f827778db5f4400a4d71` (Apache-2.0), Skilit `157ace7fc57aae9e135a368b7bbe1829ae7111ae` (Apache-2.0), Mediabunny `3a8807f9b88e11bca376447727717bbc36148b3a` (MPL-2.0), OpenCut `e668010778568641babef2cc40be4703ae6916d6` (MIT). Revalidate repository contents and package/version-specific licenses before selecting any; metadata is not qualification.

## Two additional source traces (2026-10-29)

**LosslessCut**, `mifi/lossless-cut` at `7ce24a5f5c1ab9cd31b72055562a6ded4013d732`, GPL-2.0 license retrieved. `src/renderer/src/smartcut.ts::needsSmartCut` asks `readKeyframesAroundTime` for a 10-second window, returns a lossless boundary when `findKeyframeAtExactTime` succeeds, expands to 60 seconds for the next keyframe, and throws a user-facing error when none exists. `getCodecParams` rejects zero or multiple real video streams, maps AV1 to libsvtav1, estimates missing bitrate from file size/duration and adds 20 percent headroom. These are source observations, not a measured quality guarantee. The helpers depend on FFprobe parsing, stream classification, file size and i18n; the full `ffmpeg.ts`/concat path has not been traced or qualified.

`hooks/useKeyframes.ts` debounces neighboring-frame reads by 500 ms, avoids simultaneous reads, suppresses a superseded result, resets its cache on media/stream change and prunes older entries. Its explicit read-all action can retain all found keyframes; this is not proof of a strict global memory ceiling. Yamakan should preserve exact rational timing and its owned probe/job boundary, not copy floating-time UI state as authority. A restricted stream-copy/smart-boundary profile would need source PTS, codec extradata, timebase, audio and error fixtures before implementation. It cannot accelerate composited/effected frames by skipping their render. **DEFER** until a concrete eligible-export profile and measured workload justify the added encoder/concat complexity. Rollback would disable that optional profile while preserving existing export.

**Temporal**, `temporalio/sdk-typescript` at `8cfb3c1b50e983552251c7a2b552f9186b1d55f9`, MIT license retrieved. `packages/workflow/src/cancellation-scope.ts` binds children through AsyncLocalStorage, separates a cancellation request from effective cancellation, and uses SDK compatibility flags to preserve old propagation behavior. `runInContext` cancels its timeout scope in `finally` under the applicable flag; noncancellable scopes support bounded cleanup semantics. `global-overrides.ts::overrideGlobals` routes Date/timeouts/randomness through the workflow activator and rejects WeakRef/FinalizationRegistry because observable GC is nondeterministic. This requires the activator, workflow timers, failure types, flags and replay machinery: it is not a standalone helper to paste into the server.

**Decision:** preserve Yamakan's SQLite job/attempt leases and execution epochs. Import no Temporal service or second scheduler. Adapt its distinction between requested cancellation and completed cleanup to interruption tests, keeping current process ownership. Workflow replay is a different contract from Yamakan request-response replay; neither permits old approvals to certify current state. Runtime benchmarks, server dependency closure and donor tests remain unexecuted. No performance win or source transplant is claimed.

Additional metadata-only discoveries: MLT `640940607fa8f8d58c582250dca4dc5d816f6078` (LGPL-2.1 metadata), OTIO `4524367491df94841cbf48ade184b818d2dc6354` (Apache-2.0 metadata), Motion Canvas `7b91435c301d530351dcf5ebb91dd139c002e405` (MIT metadata), Vercel Workflow `c07a6a395fef897602f9d99cf5aff46affd1ae7a` (Apache-2.0 metadata). These pins are inventory, not qualified import decisions.

## Coverage still open

Higgsfield, Runway, Cuty, LTX, Kling, Luma, Flow, Firefly, Krea, Freepik, OpenArt, Kaiber, Pika, PixVerse, Vidu and Dreamina/Seedance have not received a fresh primary-source pass in this checkpoint. Their earlier research is historical evidence, not a current verification.

Resolve, Premiere, After Effects, Final Cut, CapCut, Filmora, PowerDirector, Descript, VEED, Kapwing, Canva, Riverside, Shotcut, Kdenlive and Olive remain to be compared on concrete workflows. MLT, OTIO, FFmpeg, GStreamer, WebCodecs/WebGPU, Temporal and Vercel Workflow still need opportunity-specific source traces. This list is coverage accounting, not a competitor feature assessment.

No paid research tool, inference, model weights or competitor backend access was used. All public source fetches were read-only GitHub API calls; private discovery was bounded and no private source was published.
