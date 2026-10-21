# Q10 correctness review

**Harness head (receipt):** `fbf14141f501ddf1edb5f4e1d37d281f7d922aae`  
**Verdict:** **PASS**

## Evidence

- Fixture: `loadQ10Fixture()` → 4096×4096, 20 raster paint layers (asserted in harness).
- Brush stroke p95: **7.7 ms** (budget ≤16 ms); epoch advanced (40 strokes).
- Studio application chunk gzip: **0.111 MiB** (budget ≤2.5 MiB); measurement excludes demux worker / main shell — not InvokeAI-engine-only.
- Undo/redo flags exercised after strokes.
- `STUDIO_ENABLED` still false; forceMount measurement only.

## Residual

Save/reopen/export full product flows remain covered by Q8 host asset path + later activation E2E; Q10 DoD is chunk + latency on 4096×20.
