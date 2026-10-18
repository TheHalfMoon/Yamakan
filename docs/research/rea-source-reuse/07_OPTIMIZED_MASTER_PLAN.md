# 07 — Optimized master plan

This **amends** the [implementation plan](../../IMPLEMENTATION_PLAN.md) and does not replace it. T1–T10 are merged (PRs #1–#28); main is `6e471088`. The plan now has two tracks: **MVP release** (unchanged gates, release stays NO-GO until they pass) and **reuse-first expansion** (phases P05–P09 re-based on [04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md)).

## Track 1 — MVP release

| #     | Work                                                                                                                                                                                           | Owner                    | Status 2026-10-18                                         | PR                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------- | ------------------------------ |
| R1    | Worker read containment (AppContainer) and the hostile-media corpus                                                                                                                            | another session          | PR #29 open at `6b56bfa5`                                 | #29 (not touched by this plan) |
| R2    | **A video clip's own sound exported** (M1)                                                                                                                                                     | runtime builder          | Defect confirmed (`core/render/plan.ts`)                  | W1                             |
| R3    | Interruption and recovery defects: backup/restore replay-safe by request id; retry/discard for `reconciliationRequired`; hidden VFR originals collected; quarantined-media repair              | runtime builder          | Open in the [release proposal](../../RELEASE_PROPOSAL.md) | W2, W3                         |
| R4    | Canonical track-overlap validation; per-agent principals                                                                                                                                       | storage builder          | Open                                                      | W3, W4                         |
| R5    | Mid-render kill window and test temp cleanup                                                                                                                                                   | other sessions           | PRs #24, #19 open                                         | #24, #19                       |
| R6    | Pinned distributable bundle (Node, FFmpeg/ffprobe, fonts, notices, SBOM, hashes) with install, update, rollback and uninstall                                                                  | release builder          | Open                                                      | W5                             |
| R7    | Release evidence bundle and `qualify:release` at the exact head; harness hygiene (`taskkill /T`)                                                                                               | release builder          | Open                                                      | W7                             |
| R8    | Title-font substitution excluded (fontconfig limited to the pinned fonts)                                                                                                                      | media builder            | Open (PR #27 review)                                      | W5                             |
| H1–H5 | Native Arabic review; clean Profile A run with network off and a packet capture; a second Windows account and a restore on a second profile; real disk-full runs; artifact-bound ship decision | founder or administrator | Not run                                                   | —                              |

### M-gate

Major integrations (Track 2 modules M3–M17) may start when **all** of the following hold. This is an agent decision ([agent decision record](../../AGENT_DECISION_RECORD.md)):

1. R1–R8 are merged on main with exact-head CI.
2. `npm run qualify:release` passes on that main head, with its receipt committed.
3. No open release-blocking defect remains in `specs/CURRENT.md`.

The human gates H1–H5 are **not** part of the M-gate. They block the release, not integration work. **W6 (provenance and brand tooling) is exempt from the M-gate** because it imports nothing and protects every later import.

**Rationale:** donor imports change the canonical schema (speed, animation, studioDocument). Starting them before the MVP schema stabilizes would multiply migrations and invalidate release evidence.

## Track 2 — Reuse-first expansion (after the M-gate)

| Phase                      | Modules ([04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md))                          | Exit evidence                                                      | Est. builder days |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------- |
| P05 Edit+ and interchange  | M3 ripple, M4 group move, M5 retime, M14 Mediabunny, M15 JASSUB, M16 OTIO    | Goldens, parity, property tests, OTIO round trip                   | 9–14              |
| P06 Studio and Cinema      | M7 canvas engine, M8–M10 camera and scene, M13 engine contract (fake engine) | Host round trip, kill during flush, 145 inherited test files green | 14–21             |
| P07 Director               | M11 identity, M12 stages                                                     | Resume/fence/approval tests; manual storyboard works without AI    | 6–9               |
| P08 Motion, Audio and Flow | M6 animation, M1 follow-ups (unlink, loudness), Flow over manifests          | Animated goldens; preview/export sample equality                   | 7–11              |
| P09 Agents and Quality     | M17, per-agent undo, Quality Lab (original)                                  | Refused transitions safe; blinded comparison harness               | 5–8               |
| **Total**                  |                                                                              |                                                                    | **41–63**         |

These are estimates, not measurements. Re-estimate after M7's first step (Studio ADR), which carries the most uncertainty.

### Ordering logic

- **P05 first.** It has the smallest imports, the highest user value for an editor and reuses the proven OpenCut adapter pattern.
- **M7 is the critical-path risk.** Its ADR runs in parallel with P05.
- **The real ComfyUI engine stays disabled** until founder decision F (hardware and weights). The engine contract and fake engine still land, so Studio and Director are testable.
- **Each module ships behind its capability flag** and flips on only when its validation passes at an exact head.

## What changed from the previous plan

| Before                                    | Now                                                                              | Why                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P06 named the "InvokeAI canvas candidate" | InvokeAI webv2 canvas engine is the selected primary, with a host adapter        | REA: self-contained, 145 test files, ownership model matches (R2) |
| P07 "OpenMontage manifests/gates"         | Manifest schema and prerequisite/approval rules only; the file store is rejected | Second authority (R7)                                             |
| Mediabunny "candidate"                    | Selected as a pinned dependency for demux and waveform                           | Zero third-party imports (R4)                                     |
| JASSUB postponed                          | After the native Arabic review, as preview parity                                | Same ASS and fonts as export                                      |
| No OTIO decision                          | Original JSON writer validated by the OTIO library in tests                      | Native build unqualified                                          |
| Video sound not planned                   | M1 is an MVP blocker                                                             | Defect found 2026-10-13                                           |
