# P10 release gate matrix

Public release remains **NO-GO** until every mandatory row passes **and** the founder gives artifact-bound ship authorization (H5).

| Gate | Owner | Pre-P10 | P10 engineering action | Blocks |
| --- | --- | --- | --- | --- |
| M-gate (R1–R8 eng) | Engineering | pass @ `eaeaf1b` | Preserve; do not regress | Already passed for Track 1 |
| R6 residuals | Engineering | partial | P10-08 | Release artifact |
| R7 residuals | Engineering | partial | P10-09 | Release evidence |
| Worker read containment on **release artifact** | Engineering + Profile A | shown on dev | P10-08/09/10 | Release |
| H1 native Arabic | Founder/delegate | open | P10-07 packet only | Release; JASSUB |
| H2 clean Profile A + offline capture | Administrator | open | Escalation packet | Release |
| H3 second account + clean restore | Administrator | open | Escalation packet | Release |
| H4 constrained-volume disk-full | Administrator | open | Escalation packet | Release |
| H5 ship decision | Founder | open | Exact SHA + hashes ready | Release |
| E-SEC | Security + founder F | open | Keep engines off | Real generative run |
| F local AI / G paid | Founder | deferred | No activation in P10 | Engines / paid routes |
| Code signing certs | Founder | not authorized | Out of scope | Signed installers |

## Evidence binding

Every P10 receipt must record: git SHA, artifact hashes (when applicable), machine profile, exact commands, and pass/fail without converting skips into passes.
