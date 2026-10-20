# 10 — Benchmarks and E2E

**Measured** values exist only for what main already qualifies (see the [release proposal](../../RELEASE_PROPOSAL.md)). Everything new below is a **proposed target**. It becomes a hard threshold only when written into the versioned qualification policy (`core/qualification-policy.ts`) with fixtures, before the module lands. A threshold is never raised to make a run pass.

## Existing measured baselines (main, development profile)

| Measure                        | Value                                            | Source                      |
| ------------------------------ | ------------------------------------------------ | --------------------------- |
| 720p playback                  | 29.2 fps sustained (frozen threshold ≥ 24)       | `npm run qualify:playback`  |
| A/V drift over 10 minutes      | 0 ms audio, 0.1 frame video; click onset 5.02 ms | `npm run qualify:av-sync`   |
| Heavy 1080p export peak memory | 985 MiB (48.1% of its job limit)                 | `npm run qualify:resources` |

## New benchmarks per module (proposed targets, Profile A)

| Module         | Benchmark                                                    | Target                          | Harness (new)                                |
| -------------- | ------------------------------------------------------------ | ------------------------------- | -------------------------------------------- |
| M1 video sound | 10-minute drift with the video's own sound                   | ≤ 20 ms; onset as today         | extend `qualify:av-sync`                     |
| M3 ripple      | 10,000 clips × 20 tracks                                     | ≤ 50 ms p95                     | `scripts/bench-edit.ts`                      |
| M4 group move  | 100-clip group                                               | ≤ 16 ms p95                     | `scripts/bench-edit.ts`                      |
| M5 retime      | 30 s export at 2×                                            | ≤ 3× real time                  | `npm run benchmark`                          |
| M6 keyframes   | 30 s, 3 animated layers export; sampling per frame per layer | ≤ 3× real time; ≤ 1 ms          | `npm run benchmark`, `scripts/bench-edit.ts` |
| M7 canvas      | 4096² with 20 layers: stroke latency; reload                 | ≤ 16 ms p95; ≤ 2 s              | Playwright trace in `test:e2e`               |
| M14 waveform   | 10-minute WAV                                                | ≤ 1.5 s, ≤ 64 MiB in the Worker | Playwright                                   |
| M15 titles     | Overlay per frame at 1080p                                   | ≤ 4 ms                          | Playwright                                   |

## E2E journeys added to `npm run test:e2e`

1. **Camera footage keeps its sound.**
   - Steps: import a video with a tone, place it, export.
   - Check: the tone is present at its instant; muting the track removes it; the migrated project's export is unchanged (W1).
2. **Ripple edit.**
   - Steps: delete a middle clip with ripple, then undo, then redo.
   - Check: canonical snapshot bytes match the expected fixture at each step (W8).
3. **Retimed clip.**
   - Steps: set speed to 2×, preview, export.
   - Check: frame boundaries and pitch match the golden (W9).
4. **Studio round trip.**
   - Steps: open a canvas, paint, commit, reload, export a PNG.
   - Check: the document contract bytes and the bitmap hash are stable; a kill during flush publishes nothing partial (W11).
5. **Director without AI.**
   - Steps: a manual storyboard goes script → shots → timeline with an approval.
   - Check: an agent without approval is blocked (W15).
6. **Engine absent.**
   - Steps: open Studio's generate panel on a machine without the engine.
   - Check: the capability is disabled with the reason, and no network attempt appears in the capture (W10).
7. **Parity.**
   - Every new command runs through REST and MCP with identical results (the existing `tests/parity.test.ts` pattern).

## Review checklist (PStack playbook, applied manually)

For each PR:

- Inputs from untrusted files are bounded.
- No donor code opens network or `node:` APIs in browser subtrees.
- Ledger hashes match.
- The notice is present.
- No UI string names a donor.
- Every new canonical field has a migration or a version refusal.
- The capability flag defaults off until validation passes.
- Negative fixtures fail for the stated reason.
