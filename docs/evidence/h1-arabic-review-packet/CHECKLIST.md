# H1 — Executable native Arabic review checklist

**Gate:** H1 (native Arabic review)  
**Status:** OPEN — no sign-off recorded.  
**Do not** mark pass without a named human reviewer. Engineering cannot close this gate.

## Preconditions (engineering — already prepared)

- [x] T7 landscape + portrait goldens present under `docs/evidence/qualification/typography/`
- [x] Fixture table linked from [README.md](./README.md)
- [x] `JASSUB_ENABLED=false`; production CSP has no `wasm-unsafe-eval`
- [x] Q11 eng receipt exists (`docs/evidence/qualification/q11-jassub-eng.json`); budgets not claimed
- [x] Packet remains **unsigned** until reviewer completes the table below

## Reviewer procedure (human)

1. Open each landscape PNG in the README fixture table (01–12).
2. Compare against a fresh export of the same ASS cues on the exact review artifact (git SHA + interface/fonts hashes below).
3. Also spot-check portrait set for the same fixture names.
4. Review Arabic UI strings in the editor (language switch to Arabic): navigation labels, backup panel, errors shown in the journey.
5. Fill the sign-off table. Leave JASSUB enablement blank unless you explicitly approve live preview.

## Binding (fill at review time)

| Field | Value |
| --- | --- |
| Exact git SHA | |
| Interface sha256 | |
| Font Regular sha256 | |
| Font Bold sha256 | |
| Reviewer name | |
| Date (UTC) | |
| Machine / OS | |

## Pass criteria (all required)

| # | Criterion | Pass? | Initials | Notes |
| --- | --- | --- | --- | --- |
| 1 | Export Arabic titles read correctly (base direction RTL) | | | |
| 2 | Preview reference stills match export for fixtures 01–12 | | | |
| 3 | Mixed Arabic/Latin and digits acceptable | | | |
| 4 | Diacritics / punctuation placement acceptable | | | |
| 5 | No silent LTR-only drawtext path for product titles | | | |
| 6 | Font substitution negatives understood (pinned fonts only) | | | |
| 7 | Arabic UI strings acceptable (T8b surface) | | | |
| 8 | **Sign-off to enable JASSUB preview** (optional; leave blank to keep flag false) | | | |

## After sign-off (engineering only)

- Commit the filled table (or attach a scanned signature) on a docs PR citing this SHA.
- JASSUB enablement still also requires: CSP `wasm-unsafe-eval` security approval **and** Q11 budgets met. H1 alone is insufficient.
- Public release remains **NO-GO** until H2–H5 and signed installer gates also pass.
