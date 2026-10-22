# Q11 JASSUB investigation (budgets still unmet)

**Date:** 2026-10-22  
**Base main:** `d917ac297e20748916ba0c67e0f40a700167d93b`  
**Flag:** `JASSUB_ENABLED=false` (unchanged)  
**Thresholds:** ≤4 ms/frame and SSIM ≥0.95 — **not weakened**  
**Receipt:** [`../q11-jassub-eng.json`](../q11-jassub-eng.json)

## HTTP 404

Observed console: `Failed to load resource: the server responded with a status of 404 (Not Found)`.

Instrumented harness `http404Paths` showed the only miss was **`/favicon.ico`** (browser chrome). Not a missing JASSUB wasm/worker/font asset. Harness now answers `/favicon.ico` with 204; re-run reports `http404Paths: null` and no console errors. Production CSP still has no `wasm-unsafe-eval`.

Separately: `jassub@2.5.20` selects `modernWasmUrl` when SIMD validates (`simdEnabled: true` on Edge). Harness now pins both `wasmUrl` and `modernWasmUrl` explicitly.

## Performance (≤4 ms/frame)

| Run | Mean ms/frame | Notes |
| --- | --- | --- |
| Prior (#73) | 15.62 | No warmup; cold frames dominate |
| Intermediate (modernWasm + warmup) | 34.22 | High variance (max 122.5) |
| After favicon 204 + warmup | **9.28** | Still **> 4 ms** budget |

Budgets remain unmet; no pass claim. Occasional frames are under 4 ms; mean is not.

## SSIM (punctuation 0.4003 vs ≥0.95)

| Fixture | SSIM |
| --- | --- |
| punctuation | **0.4003** |
| bidi-isolates | 0.9951 |
| diacritics | 0.9966 |
| mixed-lines | 0.9978 |
| latin-only | 0.9982 |

Visual inspection of `shots/punctuation.png`: **entirely blank black frame** (no glyphs). T7 reference `typography/landscape-01-punctuation.png` shows the expected Arabic+punctuation line. Other JASSUB shots (e.g. `latin-only.png`) render text. Failure mode is **missing render for the punctuation cue**, not a small mirroring delta.

Shots: [`shots/`](./shots/).

## Enablement still blocked on

1. H1 native Arabic review (unsigned packet)  
2. CSP `wasm-unsafe-eval` security review (production)  
3. Q11 perf **and** SSIM budgets  

Fallback remains server libass reference stills. Public release **NO-GO**.
