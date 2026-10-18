# 13 — First implementation wave

The first ten PRs. W1–W7 are MVP or MVP-safe and may start now; W8–W10 wait for the [M-gate](07_OPTIMIZED_MASTER_PLAN.md#m-gate), except where noted.

**Common validation for every PR:**

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm run format:check
npm run provenance:check
npm test
npm run build
npm run test:e2e
```

Windows-only tests (procd, containment, sandbox) need `npm run build:native` first and run on the Windows development machine.

| PR                                 | Branch                                        | Starting files                                                                                                                                                                                                                                                           | Extra validation                                                                                                                    | Blockers                                                                                                                           |
| ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| W1 Video clip's own sound          | `fix/video-clip-sound`                        | `core/render/plan.ts` (audio from video clips), `core/canonical.ts` (clip `sound`, schema version), `core/migrate.ts`, `core/timeline/operations.ts`, `src/donors/film-editor/components/PreviewPlayer.tsx` (unmute; ledger modification), `tests/export-golden.test.ts` | `npm run qualify:av-sync`                                                                                                           | None. The migration default (disabled for migrated clips) is recorded as an agent decision.                                        |
| W2 Replay-safe recovery            | `fix/recovery-replay`                         | `core/recovery.ts`, `core/jobs.ts`, `core/command/*` (backup and restore request ids; `job.retry`, `job.discard`), `tests/recovery.test.ts`, `tests/backup.test.ts`, `tests/jobs.test.ts`                                                                                | `npm run recovery -- --help` smoke                                                                                                  | Overlaps PR #24's test file. Rebase is not allowed, so merge main after #24 lands.                                                 |
| W3 Canonical integrity             | `fix/canonical-integrity`                     | `core/canonical.ts` (overlap refinement), `core/media.ts` (hidden VFR original GC, quarantine repair), `tests/canonical.test.ts`, `tests/derivative.test.ts`                                                                                                             | `npm run qualify:large-import`                                                                                                      | W2                                                                                                                                 |
| W4 Per-agent principals            | `feat/agent-principals`                       | `core/command/*` (principal derived from the authenticated transport or token, never from MCP `clientInfo`), `mcp/main.ts`, `cli/main.ts`, `tests/parity.test.ts`                                                                                                        | parity replay                                                                                                                       | W3. The security reviewer must review the principal derivation.                                                                    |
| W5 Distributable bundle            | `feat/bundle`                                 | `scripts/bundle.ts` (new), `package.json` (`bundle` script), `notices/`, `NOTICE`, `core/render/fonts.ts` (fontconfig restricted to the pinned fonts), `tests/bundle.test.ts` (new)                                                                                      | Install, update, rollback and uninstall on a scratch profile; `npm run qualify:typography` with a substituted-font negative control | PR #29 merged (bundle includes the containment build). Disk space: about 10 GiB free on D:, so the founder may need to free space. |
| W6 Provenance and brand tooling    | `chore/provenance-brand`                      | `scripts/provenance.mjs`, `scripts/brand-check.mjs` (new), `docs/provenance/import-policy.json`, `docs/provenance/imports.json` (backfill fields for the 25 existing records), `.github/workflows/qualify.yml`                                                           | `node scripts/brand-check.mjs`                                                                                                      | None (exempt from the M-gate)                                                                                                      |
| W7 Release evidence                | `chore/release-evidence`                      | `scripts/qualify-release.ts`, harness `taskkill /T` in the `scripts/qualify-*.ts` cleanups, `docs/RELEASE_PROPOSAL.md`, `specs/CURRENT.md`                                                                                                                               | `npm run qualify:release` at the exact head; receipt committed                                                                      | W1–W5, #24, #19                                                                                                                    |
| W8 Ripple and group move           | `feat/edit-ripple`                            | `core/donors/opencut/ripple/*`, `core/donors/opencut/group-move/*` (from `apps/web/src/ripple/*`, `apps/web/src/timeline/group-move/*` @ `cf5e79e9`), `core/timeline/operations.ts`, `tests/ripple.test.ts` and `tests/group-move.test.ts` (new)                         | `node scripts/provenance.mjs --diff OpenCut-app/opencut-classic`                                                                    | M-gate, W6                                                                                                                         |
| W9 Mediabunny and retime           | `feat/media-retime`                           | `package.json` (`mediabunny@1.61.3`, `soundtouchjs@0.3.0`), `src/media/demux.ts` (new), `src/donors/film-editor/components/Waveform.tsx`, `core/donors/opencut/retime/*`, `core/render/plan.ts`, `tests/retime.test.ts` (new)                                            | `npm run qualify:playback`; `npm run qualify:av-sync`                                                                               | W8                                                                                                                                 |
| W10 Studio ADR and engine contract | `docs/studio-adr` then `feat/engine-contract` | `docs/adr/` (Studio: React 18 host, Vitest scope, bundle size, `zod` alignment), `core/engines/{contract,fake}.ts`, `tests/engines.test.ts` (new)                                                                                                                        | Engine-absent journey shows a disabled capability; no egress                                                                        | M-gate, W6. No real engine (founder decision F).                                                                                   |

## Blockers that this plan cannot remove

1. **PR #29** (containment) is owned by another session. W5 and the M-gate wait for it.
2. **PRs #24 and #19** are owned by other sessions. W7 waits for them.
3. **Human gates H1–H5** (Arabic review, clean profile, second account, packet capture, disk-full) block the release, and W12 (JASSUB) waits for H1.
4. **Real engines** (ComfyUI with weights) need:
   - security gate E-SEC: an authenticated channel, B4 for Python descendants, enforced network denial and a cross-account negative test ([04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md) M13);
   - founder decision F (hardware, weights);
   - for any paid route, founder decision G.

   This plan requests none of these decisions.

5. **Disk:** D: has about 10 GiB free, so bundle and media qualification may need space freed.

## Verdict

**READY TO IMPLEMENT** for wave 1, W1–W7.

- Each has its starting files, validation and dependency identified on main `6e471088`.
- None needs a founder decision.
- None imports donor code (W6 builds the tooling that every later import requires).

W8–W10 are fully specified and start on the M-gate. The release verdict remains **NO-GO** until the M-gate and H1–H5 pass.
