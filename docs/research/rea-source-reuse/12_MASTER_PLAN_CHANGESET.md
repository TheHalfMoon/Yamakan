# 12 — Master plan changeset

This is what this planning PR changes and what it deliberately leaves alone.

## Added

| File                                                                                                | Purpose                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/research/rea-source-reuse/01_EXECUTIVE_RECOMMENDATION.md` – `13_FIRST_IMPLEMENTATION_WAVE.md` | The 13 deliverables                                                            |
| `docs/evidence/rea/source-reuse-2026-10-18/opencut-subsystems.json`                                 | REA summary, OpenCut timeline subsystems                                       |
| `docs/evidence/rea/source-reuse-2026-10-18/invokeai-canvas-engine.json`                             | REA summary, InvokeAI canvas engine and operations                             |
| `docs/evidence/rea/source-reuse-2026-10-18/artcraft-scene-engine.json`                              | REA summary, ArtCraft scene engine                                             |
| `docs/evidence/rea/source-reuse-2026-10-18/mediabunny-src.json`                                     | REA summary, Mediabunny source                                                 |
| `docs/evidence/rea/source-reuse-2026-10-18/python-and-license-inspection.json`                      | Static reading of the Python donors, licences, and the Yamakan defect location |

## Added in the freeze (2026-10-18)

| File                                     | Purpose                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `docs/START_HERE_WHEN_READY.md`          | The single starting point when development is authorized                    |
| `docs/FUTURE_CLAUDE_EXECUTION_PROMPT.md` | The prompt the founder pastes to start development                          |
| `docs/PLAN_FREEZE_MANIFEST.md`           | Frozen commit, source pins, document hashes, external gates and assumptions |

The freeze also completed [08](08_IMPLEMENTATION_TASKS.md): 18 task cards, the dependency graph and qualification tests Q1–Q14 (W18 was added for the P08 follow-ups that had no task). It also froze the selection summary and the Studio integration boundary in [04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md).

## Amended

| File                                       | Change                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `docs/FOUNDER_DECISION_RECORD.md`          | 2026-10-18 entry: the planning instruction and the minimal source-authorization statement (no confidential content)  |
| `docs/AGENT_DECISION_RECORD.md`            | 2026-10-18 entry: the M-gate, and the video-sound migration default                                                  |
| `docs/IMPLEMENTATION_PLAN.md`              | A canonical entry-point section at the top (reading order and order of authority); the historical plan below is kept |
| `docs/FOUNDER_DECISION_RECORD.md` (freeze) | 2026-10-18 entry for the freeze instruction (no implementation authorized)                                           |

## Not changed

- **Production code, tests, the provenance ledger and import policy** (`docs/provenance/*`). No donor file is imported by this PR.
- **`docs/SOURCE_CATALOG.md`.** The pins are unchanged; every pin used here is already catalogued.
- **`docs/RELEASE_PROPOSAL.md`.** The release verdict stays NO-GO.
- **`specs/CURRENT.md`.** The defect it records is unchanged, and W1 will close it.
- **PRs #29, #24 and #19 and their branches.** They are owned by other sessions.

## Superseded statements in older plans

| Older statement                                         | Now                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| IMPLEMENTATION_PLAN P06 "InvokeAI canvas candidate"     | Selected primary: webv2 canvas engine with a host adapter ([04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md) M7) |
| IMPLEMENTATION_PLAN "Postpone … JASSUB fast path"       | After the native Arabic review, as preview parity (W12)                                                  |
| SOURCE_CATALOG "Mediabunny … candidate"                 | Selected dependency for demux and waveform (W9)                                                          |
| SOURCE_IMPORT_MATRIX OpenMontage row (checkpoint files) | Manifest schema and rules only; the checkpoint store is rejected (M12)                                   |

Older documents are kept as historical records. The pointer paragraph makes the order of authority explicit: the implementation plan's MVP gates stay authoritative, and this set replaces only the expansion phases P05–P09.
