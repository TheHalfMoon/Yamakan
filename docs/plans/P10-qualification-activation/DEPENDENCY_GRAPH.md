# P10 dependency graph

```mermaid
flowchart TD
  A[P10-00 Plan + authorization] --> B[P10-01 Studio Q8-Q10]
  A --> C[P10-02 Animation]
  A --> D[P10-03 Cinema]
  A --> E[P10-04 Director]
  A --> F[P10-05 Quality Lab]
  A --> G[P10-06 Smart Router]
  A --> H[P10-07 W12 JASSUB eng]
  A --> I[P10-08 Windows bundle]
  B --> J[P10-09 Release evidence]
  C --> J
  D --> J
  E --> J
  F --> J
  G --> J
  I --> J
  I --> K[P10-10 Security tests]
  J --> L[Final engineering verdict]
  K --> L
  H -.H1 native Arabic.-> L
```

## Hard dependencies

| Card | Blocks |
| --- | --- |
| P10-00 | All implementation cards |
| P10-01 enablement | Studio rows in release evidence |
| P10-08 | Artifact-bound security/release rows |
| H1 (external) | W12 / JASSUB enablement |
| H2–H5 (external) | Release GO |

## Parallelism

After P10-00, P10-01 through P10-08 may proceed in parallel on isolated branches/worktrees. Prefer completing P10-01 first when capacity is serial. P10-09 should re-run after any enablement merge. P10-10 may start on achievable unit/containment tests anytime; artifact-bound rows wait for P10-08.

## Tie-break (serial)

1. P10-00  
2. P10-01 Studio  
3. P10-02 Animation  
4. P10-05 Quality Lab + P10-06 Router (small, independent)  
5. P10-03 Cinema  
6. P10-04 Director  
7. P10-07 JASSUB eng + H1 packet  
8. P10-08 Bundle  
9. P10-10 Achievable security  
10. P10-09 Release evidence refresh  
11. Verdict
