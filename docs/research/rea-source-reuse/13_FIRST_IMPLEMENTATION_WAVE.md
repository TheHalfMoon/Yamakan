# 13 — First implementation wave

The first ten PRs, in the order they become eligible. The full task cards (instructions, acceptance tests, checks, definition of done, rollback, next task) are in [08](08_IMPLEMENTATION_TASKS.md). This page is the quick-start view.

**Implementation has not started.** It begins only on the founder's start authorization ([START_HERE_WHEN_READY](../../START_HERE_WHEN_READY.md)).

## First task when development begins

**W1 — a video clip's own sound.** It has no prerequisites, needs no founder decision, imports no donor code and closes a confirmed MVP defect.

- **Branch:** `fix/video-clip-sound`.
- **First action:** run Q1, comparing the import probe's `hasAudio` with the render-time probe over the media corpus.
- **Starting files:** `core/canonical.ts`, `core/project.ts`, `core/migrate.ts`, `core/media.ts`, `core/render/plan.ts`, `core/timeline/operations.ts`, `core/command/registry.ts`, `src/donors/film-editor/components/PreviewPlayer.tsx`, `src/edit-ops.ts`, `src/main.tsx`, `src/i18n.ts`, `tests/export-golden.test.ts`, `tests/migrate.test.ts`, `tests/render-plan.test.ts` and `tests/parity.test.ts`.

If W1 is already merged when development starts, take the next eligible task in the order below.

## The first ten PRs

| Order | PR                                 | Branch                                         | Eligible when                 | Starting files (summary)                                                                                                                                                                      | Extra validation                                                                                                       |
| ----- | ---------------------------------- | ---------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1     | W1 Video clip's own sound          | `fix/video-clip-sound`                         | Now                           | See above                                                                                                                                                                                     | `npm run qualify:av-sync`                                                                                              |
| 2     | W6 Provenance and brand tooling    | `chore/provenance-brand`                       | Now (exempt from the M-gate)  | `scripts/provenance.mjs`, `scripts/import-guard.mjs`, `scripts/brand-check.mjs` (new), `docs/provenance/*`, `.github/workflows/qualify.yml`, `tests/provenance.test.ts` (new)                 | `node scripts/brand-check.mjs`                                                                                         |
| 3     | W2 Replay-safe recovery            | `fix/recovery-replay`                          | PR #24 merged                 | `core/recovery.ts`, `core/jobs.ts`, `core/command/registry.ts`, `core/store.ts`, `tests/recovery.test.ts`, `tests/backup.test.ts`, `tests/jobs.test.ts`                                       | Kill-between-effect-and-response replay                                                                                |
| 4     | W3 Canonical integrity             | `fix/canonical-integrity`                      | W2                            | `core/canonical.ts`, `core/media.ts`, `core/recovery.ts`, `tests/canonical.test.ts`, `tests/derivative.test.ts`, `tests/streaming-import.test.ts`                                             | `npm run qualify:large-import`                                                                                         |
| 5     | W4 Transport-bound principals      | `feat/agent-principals`                        | W3                            | `core/command/registry.ts`, `server/api.ts`, `server/main.ts`, `mcp/main.ts`, `cli/main.ts`, `core/timeline/operations.ts`, `tests/parity.test.ts`, `tests/http.test.ts`, `tests/mcp.test.ts` | Parity replay with distinct principals                                                                                 |
| 6     | W5 Distributable bundle            | `feat/bundle`                                  | PR #29 merged                 | `scripts/bundle.ts` (new), `package.json`, `NOTICE`, `notices/`, `core/render/fonts.ts`, `core/render/ass.ts`, `tests/bundle.test.ts` (new), `tests/typography.test.ts`                       | Install/update/rollback/uninstall on a scratch profile; `npm run qualify:typography` with the substituted-font control |
| 7     | W7 Release evidence                | `chore/release-evidence`                       | W1–W5, PRs #24 and #19 merged | `scripts/qualify-release.ts`, `scripts/qualify-*.ts`, `docs/RELEASE_PROPOSAL.md`, `specs/CURRENT.md`                                                                                          | `npm run qualify:release` at the exact head                                                                            |
| 8     | W8 Ripple and group move           | `feat/edit-ripple`                             | M-gate passed, W6             | `core/donors/opencut/{ripple,group-move}/*`, `core/timeline/operations.ts`, `tests/ripple.test.ts` and `tests/group-move.test.ts` (new)                                                       | `node scripts/provenance.mjs --diff OpenCut-app/opencut-classic`                                                       |
| 9     | W9 Mediabunny and retime           | `feat/media-retime`                            | W8                            | `package.json`, `src/media/demux.ts` (new), `src/donors/film-editor/components/Waveform.tsx`, `core/donors/opencut/retime/*`, `core/render/plan.ts`, `tests/retime.test.ts` (new)             | `npm run qualify:playback`, `npm run qualify:av-sync`                                                                  |
| 10    | W10 Studio ADR and engine contract | `docs/studio-adr`, then `feat/engine-contract` | M-gate passed, W6             | `docs/adr/0003-studio-canvas-engine.md` (new), `core/engines/{contract,fake}.ts` (new), `tests/engines.test.ts` (new)                                                                         | Q7–Q10 recorded in the ADR; engine-absent journey                                                                      |

**Sequencing:**

- The order follows the [dependency graph](08_IMPLEMENTATION_TASKS.md#dependency-graph) with its tie-break rule.
- W6 is placed second because it has no prerequisites and protects every later import.
- **If PR #24 is still open,** take W6 before W2.
- **If PR #29 is still open** when W4 merges, W5 waits and W7 cannot start.

**Common validation** for every PR is in [08, rule 6](08_IMPLEMENTATION_TASKS.md#rules-for-every-task).

## External dependencies this plan cannot remove

1. **PR #29** (containment) belongs to another session. W5 and the M-gate wait for it.
2. **PRs #24 and #19** belong to other sessions. W2 waits for #24, and W7 waits for both.
3. **Human gates H1–H5:** native Arabic review, a clean profile, a second account, a packet capture and disk-full runs. They block the release; W12 also waits for H1.
4. **Real engines** (ComfyUI with weights) need security gate E-SEC ([04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md) M13), founder decision F (hardware, weights) and, for any paid route, founder decision G. This plan requests none of these decisions.
5. **Disk:** D: had about 10 GiB free at the freeze. The bundle and media qualification may need space freed.

## Readiness

- W1–W7 are fully specified against main `6e471088`. None needs a founder decision beyond the start authorization, and none imports donor code.
- W8–W18 are fully specified and gated on the M-gate (and, where noted, on Q tests, H1 or E-SEC).
- The release verdict remains **NO-GO** until the M-gate and H1–H5 pass.
