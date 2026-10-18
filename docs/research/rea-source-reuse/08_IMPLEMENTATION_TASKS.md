# 08 — Implementation tasks

Each task is one PR. Every PR follows the standing merge discipline:

- a dedicated branch;
- fresh combined and security reviewers;
- CI success at the exact head;
- `gh pr merge N --merge --match-head-commit <sha>`;
- a post-merge check that `origin/main^{tree}` equals `<sha>^{tree}`;
- normal merges only;
- no force push.

Module details are in [04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md); the first ten PRs, with starting files and commands, are in [13](13_FIRST_IMPLEMENTATION_WAVE.md).

## Track 1 — MVP (wave 1)

| Task | Scope                                                                                                                                                                  | Depends on                    | Done when                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| W1   | Video clip's own sound (M1)                                                                                                                                            | main                          | Sound goldens, migration keeps old output, preview/export agree, A/V receipt                                                |
| W2   | Backup/restore replay-safe by request id; retry/discard for `reconciliationRequired` jobs                                                                              | main                          | Replayed request returns the original result; retry is fenced; discard leaves the revision unchanged                        |
| W3   | Canonical track-overlap validation; hidden VFR originals collected; quarantined-media repair                                                                           | W2                            | Overlap refused by the schema itself; GC removes only unreferenced hidden originals; repair re-probes and releases          |
| W4   | Per-agent principals (CLI and each MCP agent) with per-writer undo                                                                                                     | W3                            | Parity replay distinguishes principals; undo never reverts another principal's edit                                         |
| W5   | Pinned distributable bundle (Node runtime, FFmpeg/ffprobe, fonts, notices, SBOM, hashes); install, update, rollback, uninstall; fontconfig limited to the pinned fonts | PR #29 merged                 | Clean install and uninstall on Profile A; rollback restores the previous version; a substituted-font negative control fails |
| W6   | Provenance and brand tooling (M2)                                                                                                                                      | main (exempt from the M-gate) | Missing ledger fields, excluded paths and donor names in UI strings all fail CI                                             |
| W7   | Release evidence bundle and `qualify:release` at the exact head; `taskkill /T` harness hygiene                                                                         | W1–W5, PRs #24 and #19        | Receipt committed; the M-gate can be declared                                                                               |

## Track 2 — expansion (waves 2–5, after the M-gate)

| Task | Module                                                                     | Depends on                |
| ---- | -------------------------------------------------------------------------- | ------------------------- |
| W8   | M3 ripple and M4 group move                                                | M-gate, W6                |
| W9   | M14 Mediabunny waveform and demux, plus M5 retime                          | W8                        |
| W10  | Studio ADR (first step of M7) and M13 engine contract with the fake engine | M-gate, W6                |
| W11  | M7 canvas engine import and host adapter                                   | W10 ADR accepted          |
| W12  | M15 JASSUB preview titles                                                  | Native Arabic review (H1) |
| W13  | M16 OTIO writer and oracle job                                             | W8                        |
| W14  | M8–M10 Cinema camera and scene                                             | W10                       |
| W15  | M11 identity, M12 stages                                                   | W10                       |
| W16  | M6 keyframes                                                               | W9                        |
| W17  | M17 founder rules; Quality Lab harness; Router explain                     | W4                        |

Every Track 2 PR starts by adding its ledger and policy entries (W6 tooling) and ends with the module's capability flag on, but only if its validation passed.
