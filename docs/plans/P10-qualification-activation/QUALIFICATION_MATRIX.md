# P10 qualification matrix

Statuses: `not-started` | `in-progress` | `pass` | `fail` | `blocked-external` | `n/a`.

Baseline head at plan creation: `c6d10f7a82fc17c0d39e1536331b6287b2dfa99e`.

| Qual / gate | Capability | Frozen criteria (summary) | Pre-P10 status | P10 target |
| --- | --- | --- | --- | --- |
| Q7a proper | Studio | tsc+vite production engine | **pass** (webv2) | Preserve |
| Q7b | Studio | Reducer seam | partial (host port) | Close if gaps |
| Q8 | Studio | Real React host stroke | scaffolded / **fail** | **pass** or keep flag off |
| Q9 | Studio | ≥90% inherited node tests | partial | **pass** or keep flag off |
| Q10 | Studio | App chunk ≤2.5 MiB gz; stroke p95 ≤16 ms | not-run | **pass** or keep flag off |
| Q11 | JASSUB | ≤4 ms/frame; SSIM ≥0.95 | not-run | eng prep; enable blocked on H1 |
| Q13 | Animation | Expression vs sampler parity | pass (W16) | Re-verify after wiring |
| Q14 | Animation | Params closure | pass (W16) | Re-verify after wiring |
| Q15 | Presence | OS confirmation | **fallback** | Do not fake; residual stays |
| M-gate | Track 1 | R1–R8 eng | pass @ `eaeaf1b` | Preserve |
| H1 | Arabic | Native review goldens+UI | open | Packet only in P10 |
| H2 | Profile A offline | Admin + packet capture | open | External |
| H3 | Second account / clean restore | Admin | open | External |
| H4 | Constrained volume | Admin | open | External |
| H5 | Ship decision | Founder | open | External |
| E-SEC / F / G | Real engines / paid | Founder | deferred | Stay deferred |
| R6 | Bundle install lifecycle | Install/update/rollback | partial | Close achievable |
| R7 | Release evidence | Exact-head matrix | partial | Refresh |

## Binding rules

- A failed Q never becomes a pass by threshold raise or exclusion of required tests.
- Skipped/blocked scans are not passes.
- Enablement flags flip only after their named quals pass on an exact head with receipts.
