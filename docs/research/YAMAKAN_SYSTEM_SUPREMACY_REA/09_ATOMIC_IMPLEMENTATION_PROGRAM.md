# Bounded implementation, media and qualification program

This extends the existing execution ledger; it does not supersede verified YU work or the release gates.

## Ready work and acceptance

| ID / priority | Problem and target | Source-first decision | Acceptance and rollback |
| --- | --- | --- | --- |
| SS-001 / P0 | Director approval skips prerequisite revalidation; `core/director/runtime.ts`, `stages.ts` | ADAPT existing OpenMontage-derived function | Expiry, unfinished attempt and absent output negative tests; unchanged failed-request state; renewal/replay positives; fresh split reviews, CI, merge and post-merge. Code-only revert. |
| SS-002 / P5 enabling P0 | Environment preflight probes PATH FFmpeg instead of the complete pinned Windows runtime | WRAP/ADAPT existing resolver and manifest/hash patterns | Missing DLL, corrupt DLL, LFS pointer and valid bundle fixtures; BLOCKED before expensive qualification; same selected executable as production; no binary downloads or sandbox weakening. Revert scripts only. |
| SS-003 / P0 | Old downstream completion may survive upstream artifact replacement | ADAPT Kinewright's exact-base principle to the existing append-only Director attempts | Reproduce complete research→script→timeline, replace research, require dependent re-execution/review, survive restart. Preserve audit history, unrelated runs and matching-output approval renewal. Decide derived invalidation versus explicit dependency receipt only after fixture. No second store. |
| SS-004 / P2 | Full model-free brief-to-revision journey lacks one integrated receipt | COMBINE existing commands and tested fixtures | Import real media, build three shots, add captions/audio/transition, export, change only one shot, restart, verify hashes/frame timing/history and unaffected clips; injected interruption and denied agent approval. No recognition/generation claims. |
| SS-005 / P1 | M exports remain variable under policy v3 | BUILD only if pinned donor/algorithm comparison justifies it | Profile decoding/scaling/overlay cost; frozen 200-clip/16-track/10-minute/1080p recipe. At least three interleaved baseline/candidate runs; every failure retained. Same decoded output, audio, limits and host controls. Roll back renderer version/change together. |

## Media and benchmark discipline

Retained PR #152 evidence reports dense-probe median **66.133 s → 9.187 s** over three baseline/candidate pairs; the fixture was 16 clips/tracks, 30 s at 1080p. Retained peak-worker measurements were 421 MiB baseline and 351–354 MiB candidate. These are earlier recorded measurements, not rerun measurements from this session, and the host was intermittently loaded.

M baseline finished 0/3; optimized finished 2/5 (approximately 424 s and 469 s), with three time-limit failures. M remains unqualified at 480 s. One favorable run cannot change that verdict. No resource limit, concurrency or thread count changed here.

New algorithm candidates must include transparent/transformed/LUT/animated layers and segment boundaries. Opaque-layer culling is only valid after alpha/coverage evidence exists and must not be advertised as solving all translucent workloads. A loop retains `yuva420p`, approximately 4.94 MiB per unaligned 1080p frame; #152's 3 MiB comment undercounts alpha and should be corrected without changing its dimension bound.

Record source/build hashes, policy, decoder and encoder versions, input/output hashes, all runs, p50/p95 where supported by sample size, peak process-tree memory, CPU/load, temporary bytes, frame count/rational timestamps and decoded fidelity. Keep preview and export measurements separate. No new M run is authorized to overlap another FFmpeg suite on this host.

## Agent harness and creator experience

Use command registry scopes, revision/CAS, request digests, execution epochs, approved outputs and existing durable jobs. Add no independent scheduler. Before making a change, agents inspect the current project and create a bounded plan; after committing, they verify the actual current state, not a historical replay response.

A future progress UI should say what changed, what awaits review, and what can resume after failure. It should not expose database tables, filter graphs or donor machinery to creators. A changed upstream shot should clearly mark dependent work needing review while preserving the rest of the production. Validate this through keyboard/browser interaction and accessible Arabic/English labels; native Arabic typography remains the external H1 gate.

## Developer environment and tool evidence

- PStack resume/doctor/build/review procedures are applied with the founder's explicit autonomous authorization overriding routine confirmation pauses. Independent review uses fresh contexts and separates correctness from approval-boundary security review.
- RTK wraps shell operations. GitHub connector calls failed with missing `link_id`; authenticated `gh` was the successful fallback.
- Graft's deterministic local graph parsed 690 files and traced approval callers through the registry. No LLM/deep graph pass. Generated graph/cache files remain local.
- Local D1 was installed but initially offline; a typed yes/no advisory call subsequently succeeded. The earlier choice call returned HTTP 400. D1 did not approve a PR or replace any gate.
- Alibaba OCR preview ran and identified the changed reviewable files. Full generative OCR did not run; its configured cloud provider remains outside this session's permitted execution. Preview is not a completed code review.
- Existing deterministic Edge and TesterArmy journeys remain applicable; report executed checks separately from availability. No browser/model installation is needed to rerun the existing setup.

C: exhausted free space during setup. New source/artifacts and test TEMP/TMP were placed on D:. The initial worktree retained shared Git metadata on C:, so an isolated clone with metadata on D: was required. Existing user files were not deleted. The initial full qualification attempt failed on unhydrated FFmpeg companion DLLs, with a stuck owned jobs test terminated; that failed receipt was retained locally. It is not a passing baseline.

Use `npm ci --ignore-scripts` only on an actual owned install directory. Never run it through a shared node_modules junction. Hydrate/verify the entire pinned media runtime; matching EXE hashes alone do not establish a usable Windows toolchain. Never rebuild or clean another agent's native target during concurrent work; use an isolated target where native changes are needed.

## Release and external blockers

No change here authorizes paid/cloud inference, training, weights, model activation, release publishing, visibility changes, signing purchases, large migrations or higher resource budgets. H1 native Arabic and other issue #77 human/profile/signing gates stay open. Continue independent non-model engineering while those are blocked.
