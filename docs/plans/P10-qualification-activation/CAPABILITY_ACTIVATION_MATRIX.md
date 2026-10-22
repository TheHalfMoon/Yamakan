# P10 capability activation matrix

Distinguish: code merged ≠ integration tested ≠ E2E ≠ security reviewed ≠ performance ≠ **enabled** ≠ release qualified.

| Capability | Flag | Code | Integration | E2E | Security | Perf | Enabled (pre-P10) | P10 enable rule |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Studio canvas | `STUDIO_ENABLED` | merged | host mount | Q8+activation E2E | Q8/Q9/activation reviews | Q10 pass | **true** (activation PR) | Q8+Q9+Q10 pass |
| Generative engine | `ENGINE_ENABLED` | fake only | n/a | n/a | E-SEC open | n/a | **false** | Founder F + E-SEC (out of P10) |
| Animation | `ANIMATION_ENABLED` | modules | plan+ops | animation-e2e | plan compiler | Q13/Q14 | **true** (opacity+volume) | UI+render E2E pass; transform filters residual |
| Cinema | `CINEMA_ENABLED` | camera/scene | viewport+store | activation E2E (#64) | asset-id only | n/a | **true** (supported scope) | Preview/persist pass; AI camera stays off |
| Director | `DIRECTOR_ENABLED` | identity/stages | panel | activation E2E (#64) | human-only | n/a | **true** (manual) | Manual path E2E; no model stages |
| Quality Lab | `QUALITY_LAB_ENABLED` | lab+lineage | unit | command E2E | no paid egress | n/a | **true** (deterministic) | Deterministic subset only |
| Router providers | `ROUTER_PROVIDERS_ENABLED` | explain | unit | explain E2E | no paid routes | n/a | **false** (explain qualified) | Stays false; explain may stay available |
| JASSUB titles | (W12 flag/path) | not complete | open | open | CSP TBD | Q11 | **false** | H1 + Q11 |
| Audio unlink | `AUDIO_UNLINK_ENABLED` | merged | yes | yes | — | — | **true** | Preserve |
| Loudnorm | `LOUDNORM_ENABLED` | merged | yes | yes | — | — | **true** | Preserve |
| Flow view | `FLOW_ENABLED` | merged | yes | yes | — | — | **true** | Preserve |

## Reporting rule

Capability status in PROGRESS.md and CURRENT.md must use the columns above. Never report “finished” from a merge alone.
