# Test, review and acceptance matrix

This is future implementation QA selection. Actual research-session checks are separately listed in23 and evidence; nothing in this matrix claims a test ran. All44 atomic tasks include positive/negative tests, evidence, review, rollback and merge conditions in18/TASK_REGISTRY.json.

## Selection by changed surface

| Surface / tasks | Existing test anchors | New acceptance and fault evidence | Independent review |
|---|---|---|---|
| Baseline/catalog/Quality Lab/MCP YU000–003 | `tests/{command,mcp,w17-quality-agents,brand-ui}.test.ts` | Stale-head rejection; complete digest; duplicate slots; newline-byte and admission floods | Correctness/product; security for ingress/evidence claims |
| Canonical/docs YU010–015 | `tests/{canonical-store,workspace-db,canonical,backup,recovery,parity,studio,cinema,director-stages}.test.ts` | Concurrent CAS/replay, draw+bitmap+scene+run→kill→reopen→backup→restore; revocation monotonicity; per-writer undo | Separate correctness and security/native-data reviewers |
| Media/preview YU016–018 | `tests/{streaming-import,derivative,preview,probe,jobs,interruption}.test.ts`; preview/playback scripts | No full browser refetch across100edits; proxy PTS; cache invalidation; scrub/cancel; A/V drift; process death | Media correctness/performance; security on worker/file changes |
| Time/effects/finish YU019–026 | `tests/{time,render-plan,retime,set-speed,animation-params,export-golden,typography,otio}.test.ts` | Rational boundary oracle, effect/transition/color/subtitle golden frames, sample alignment, unsupported profile rejection, scale harness | Media engineer + product; security for parsers/filter compilers |
| UX/story/takes YU030–032 | Browser E2E and affected Studio/Cinema/Director activation scripts | Six journeys, keyboard/RTL/focus/200% zoom, take-local edits, unsaved/conflict states | Fresh product/UX review; actual native language reviewer separately |
| Engines YU040–043 | `tests/engines.test.ts`, process-owner/containment/sandbox tests | Strict v2/v1 compatibility, fake/absent/no-network, file sentinels, real Windows process-tree seams, no auto-download | Independent E-SEC/native review; d1 insufficient |
| Cinema/continuity YU050–051 | cinema/identity/director-stage tests | Unsupported controls explicit, reference/consent races; measured pixel adherence deferred | AI/media correctness + consent security |
| Agent YU060–062 | command/agent-principals/MCP/parity/jobs tests | Hash-bound proposals, imported three-shot production, interruption at every effect, resume/reconcile, no duplicate attach | Separate correctness/product and security |
| ASR/repair YU070–072 | media/probe/process/job tests and captions fixtures | Stand-in contracts before weights; full timing/audio preservation; no unsafe upstream shell/pickle/temp orchestration | Media/source/supply-chain security; actual language quality later |
| Differentiation/evaluation YU080–093 | OTIO/recovery/Quality Lab plus new harness | Archive hostile corpus, loss reports, A–L recording, valid statistical analysis, exact Windows artifact, human study | Methods/product reviewer; safety evidence reviewed independently |
| Release YU100–101 | `qualify:release`, `qualify:release-evidence`, bundle/unsigned RC scripts | H1–H5, signing/install/update/rollback/ProfileA/account/disk evidence on exact artifact | Actual security/native reviewer + founder artifact ship decision |

## Mechanical gates and evidence

Use actual `package.json` scripts and lockfile on the authorized implementation checkout: typecheck, lint, format check, tests, build, provenance/import policy and brand checks; Studio/Vitest or targeted native/media/browser gates when affected. Existing environment absent dependencies/native helper cannot supply those passes here. A script name is a selection, not evidence of success. Never install or upgrade packages merely to make a docs planning gate green.

Every implementation receipt includes task ID, branch/base/head/tree hashes, dirty status, dependency/runtime/native/FFmpeg/font/browser versions, fixture hashes, exact commands, exit codes, stdout/stderr retained location+hash, passed/failed/skipped counts, measurements, reviewer identity/context and findings disposition. A skipped/failed/unsupported scenario cannot be normalized to pass. CI is required on the exact reviewed head and verified post-merge main; changed code after review invalidates affected review/evidence.

AG-DOCS activation requires YU010–015 group evidence before any default v5/user persistence promotion; individual flag-off task verification does not satisfy it. Test actual legacy project.save/edit-view/import paths for lossless preservation or explicit refusal. Restore fault matrix must prove new execution epoch/hold is checked before stale-job requeue and produces zero external/local effects or reservation releases until explicit authorized reconciliation/restart.

Cross-client parity compares substantive canonical bytes or declared deterministic ID mappings. Do not remove relevant fields merely to obtain equal hashes. Reference/render parity compares full prescribed frame ranges/ROIs/audio, including source-rate conversion and titles; one attractive frame is insufficient. Crash tests assert acknowledged state, process exit and artifact roots, not only a successful HTTP response.

## Review execution policy

Use PStack bars: correctness, parsimony, product, and separate security when auth/files/raw input/processes/cost are touched. Reviewer receives immutable diff and only necessary contracts/fixtures; record fresh context and actual provider. Specialized unavailable agents degrade visibly to session-model reviewers; do not invent Alibaba/independent expert results. Graft's free graph is structural evidence only. d1 can prioritize routine findings but cannot approve a merge, release, compliance or security gate.

For this planning assignment, reviewers may challenge and repair planning artifacts autonomously within scope. Future implementation review follows repository/skill/founder authorization; any change requiring approval must be concrete and reviewable. No review authorizes model downloads, billing, production release or a planning PR merge.
