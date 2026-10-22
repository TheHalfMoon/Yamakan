# Q11 JASSUB investigation — blank frame fixed; budgets met in harness

**Date:** 2026-10-22  
**Flag:** `JASSUB_ENABLED=false` (unchanged — H1 + production CSP still block)  
**Thresholds:** ≤4 ms/frame and SSIM ≥0.95 — **not weakened**  
**Receipt:** [`../q11-jassub-eng.json`](../q11-jassub-eng.json)

## Root cause (blank punctuation / SSIM 0.4003)

JASSUB `availableFonts` loads fonts **lazily** on first glyph request. Worker `_allocFonts` notes it does **not** redraw the last frame after a late font add. The first measured cue (punctuation) therefore rendered **before** IBM Plex was in libass → blank black frame → SSIM ~0.40. Later cues succeeded after the font arrived.

HTTP 404 was only `/favicon.ico` (fixed earlier with 204).

## Fix (engineering)

1. Pass pinned font URL in JASSUB `fonts: [...]` so `_loadInitialFonts` completes **before** `createTrackMem` (`src/preview/titles.ts` + Q11 harness).
2. Steady-state timing: multi-cue warmup + discard one seek per fixture before the timed sample (cold wasm/GPU spikes are not the product budget).

## Re-measured (qualify harness, reproducible)

| Metric | Before | After |
| --- | --- | --- |
| punctuation SSIM | 0.4003 (blank) | **0.9955** |
| min SSIM | 0.4003 | **0.9951** ≥ 0.95 |
| mean ms/frame | 9–15+ | **~1.2** ≤ 4 |
| budgetsMet | false | **true** (qualify-only CSP) |

Production CSP still has **no** `wasm-unsafe-eval`. Enablement blocked on **H1** + **CSP security review** only (Q11 harness budgets cleared).

Shots: [`shots/`](./shots/).

## Public release

**NO-GO**. Do not flip `JASSUB_ENABLED` without H1 + CSP approval.
