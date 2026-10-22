# Yamakan complete rebranding inventory

**Base:** `46ebf0d0e58ee178abea134ffcea8d5b68c90f60`  
**Date:** 2026-10-22  
**Authorization:** Founder directive — complete source rebranding under Yamakan identity.  
**Public release:** NO-GO

## Disposition codes

| Code | Meaning |
| --- | --- |
| R1 | Rebrandable Yamakan product identity (active surfaces) |
| R2 | Rebrandable first-party implementation path/symbol |
| X1 | External dependency/protocol id (must stay exact) |
| C1 | Mandatory copyright/license/attribution |
| H1 | Historical evidence / immutable provenance |

## Path migrations (R2)

| From | To |
| --- | --- |
| `core/donors/opencut/animation/*` | `core/animation/*` |
| `core/donors/opencut/retime/*` | `core/retime/*` |
| `core/donors/opencut/ripple/*` | `core/timeline/ripple/*` |
| `core/donors/opencut/group-move/*` | `core/timeline/group-move/*` |
| `core/donors/opencut/{overlap,snapping,adapters,timeline-types}.ts` | `core/timeline/` |
| `core/donors/gomrey/*` | `core/jobs/rules/` |
| `core/donors/ninerr/*` | `core/hash/` |
| `core/donors/skelet/storage.ts` | `core/storage/storage.ts` |
| `src/donors/opencut/audio-stretch.ts` | `src/audio/audio-stretch.ts` |
| `src/donors/film-editor/*` | `src/editor/*` |

Empty `core/donors/` and `src/donors/` removed after migration.

## Symbol migrations (R2)

| From | To |
| --- | --- |
| `ArtCraftObject3DJson` / `ArtCraftSceneStateJson` | `CinemaObject3DJson` / `CinemaSceneStateJson` |
| `scene3dFromArtCraft` / `artCraftItemsFromScene3D` | `scene3dFromCinemaJson` / `cinemaItemsFromScene3D` |
| `tests/donor-opencut.test.ts` | `tests/timeline-placement.test.ts` |
| `tests/gomrey-jobs.test.ts` | `tests/job-transitions.test.ts` |

## Product branding (R1)

| Item | Action |
| --- | --- |
| `NOTICE` intro “Darzain integrates…” | → Yamakan |
| Active `DARZAIN_*` env aliases | Keep as transitional read aliases where present; prefer `YAMAKAN_*` |
| `darzain.` command prefix | Keep as `LEGACY_PREFIX` alias only (compatibility) |
| README “formerly Darzain” | One historical sentence OK; product name Yamakan |
| UI / About / package name | Already Yamakan |

## Must remain (C1 / X1 / H1)

| Area | Disposition |
| --- | --- |
| `notices/*` license texts | C1 |
| `docs/provenance/imports.json` `source` / SHA fields | H1 (update `imported` paths on rename) |
| `docs/history/darzain/**` | H1 |
| `docs/research/**`, frozen REA evidence | H1 |
| npm package ids (`jassub`, `mediabunny`, …) | X1 |
| Brand-check allowlist for C1/H1 paths | Explicit narrow exclusions |

## Brand-check improvements

- Scan `core`, `src`, `cli`, `mcp`, `server`, `sdk`, `scripts`, `tests`.
- No blanket `src/donors/` skip (paths removed).
- Exclude only: `notices/`, `docs/history/`, `docs/evidence/`, `docs/research/`, `docs/review/`, provenance ledger JSON, `tests/fixtures/provenance/`, `vendor/`, `node_modules/`.
- Negative tests in `tests/brand-check.test.ts` prove OpenCut/Darzain/path reintroduction fails.
