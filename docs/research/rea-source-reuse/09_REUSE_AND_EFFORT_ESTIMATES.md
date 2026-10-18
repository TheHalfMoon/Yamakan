# 09 — Reuse and effort estimates

**Everything here is an estimate.**

- Donor line counts are `wc -l` of the pinned files ([02](02_REA_DEEP_INVESTIGATIONS.md)).
- New-line ranges and builder days are the agent's per-module estimates from [04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md).
- A builder day assumes one experienced builder, as in the [implementation plan](../../IMPLEMENTATION_PLAN.md).
- Nothing here is a measured speedup.
- The arithmetic was checked with a small script (the totals below are its output).

## Three different measures (do not mix them)

- **Copied source lines** are a count of donor lines at the pins. They describe how much code arrives, not how much work it saves.
- **Reuse share** is copied lines ÷ (copied + new lines). It is a ratio of estimated code volumes, not of time.
- **Time savings** compare two separate estimates of builder days: reuse path against reimplementation. They do not follow from the share. M7 carries about 85% of the copied lines but about two thirds (64–67%) of the estimated savings.

None of the three is measured. Each is re-estimated after its task's first qualification test.

## Per module

| Module                                                           | Phase | Donor lines reused | New lines   | B-path days (reuse) | E-path days (reimplement) |
| ---------------------------------------------------------------- | ----- | ------------------ | ----------- | ------------------- | ------------------------- |
| M3 ripple                                                        | P05   | 377                | 300–500     | 1.5–2               | 3–4                       |
| M4 group move                                                    | P05   | 820                | 350–550     | 2–3                 | 4–6                       |
| M5 retime (source only)                                          | P05   | 306                | 450–700     | 2.5–4               | 4–6                       |
| M14 Mediabunny (dependency)                                      | P05   | 0 copied           | 250–400     | 1–2                 | 3–5                       |
| M15 JASSUB (dependency)                                          | P05   | 0 copied           | 200–350     | 1–1.5               | 2–3                       |
| M16 OTIO writer                                                  | P05   | 0                  | 500–800     | 1–1.5               | 1–1.5                     |
| M7 Studio canvas engine (engine, platform closure, reducer seam) | P06   | 36,835             | 2,500–4,000 | 10–15               | 40–60                     |
| M8 camera math                                                   | P06   | 196                | 80–150      | 0.5                 | 1–1.5                     |
| M9 scene schema                                                  | P06   | 34                 | 200–300     | 1–1.5               | 1–1.5                     |
| M10 camera controller                                            | P06   | 345                | 150–250     | 1–1.5               | 1.5–2                     |
| M13 engine contract and ComfyUI                                  | P06   | 147                | 900–1,400   | 1.5–2.5             | 2–3                       |
| M11 identity                                                     | P07   | 318                | 300–450     | 2–3                 | 2.5–3.5                   |
| M12 stages                                                       | P07   | 638                | 700–1,000   | 4–6                 | 6–9                       |
| M6 keyframes                                                     | P08   | 2,961              | 1,200–1,800 | 5–8                 | 9–13                      |
| P08 other, W18 (unlink sound, loudness, Flow view)               | P08   | 0                  | 500–800     | 2–3                 | 2–3                       |
| M17 founder rules                                                | P09   | ~300 (estimate)    | 250–400     | 1.5–2.5             | 2–3                       |
| P09 other (Quality Lab, Router explain, lineage views)           | P09   | 0                  | 700–1,200   | 3.5–5.5             | 3.5–5.5                   |

## Totals

| Phase                      | Reuse path (days) | Reimplementation (days) | New lines        |
| -------------------------- | ----------------- | ----------------------- | ---------------- |
| P05 Edit+ and interchange  | 9–14              | 17–25.5                 | 2,050–3,300      |
| P06 Studio and Cinema      | 14–21             | 45.5–68                 | 3,830–6,100      |
| P07 Director               | 6–9               | 8.5–12.5                | 1,000–1,450      |
| P08 Motion, Audio and Flow | 7–11              | 11–16                   | 1,700–2,600      |
| P09 Agents and Quality     | 5–8               | 5.5–8.5                 | 950–1,600        |
| **Expansion total**        | **41–63**         | **87.5–130.5**          | **9,530–15,050** |

- **Donor lines reused:** 43,277 (source lines; imported test and test-support lines are not counted; the M17 row is an estimate because Gomrey was not re-measured at the freeze). Their share of the expansion code is 43,277 / (43,277 + new) = **74.2%–82.0%**.
- **Estimated savings:** **about 46–68 builder days**, from 46.5 (87.5 − 41) to 67.5 (130.5 − 63). About two thirds of it comes from M7, the canvas engine.
- **Biggest uncertainty:** M7's host adapter. The Studio ADR is its first step and re-estimates it before any import.

## MVP work (Track 1; not counted above)

| Work                                                              | New lines       | Days          |
| ----------------------------------------------------------------- | --------------- | ------------- |
| W1 video sound (M1)                                               | 350–600         | 2–3           |
| W2 backup/restore replay and reconciliation commands              | 300–500         | 2–3           |
| W3 overlap validation, VFR original GC, quarantine repair         | 400–700         | 2.5–4         |
| W4 per-agent principals                                           | 300–500         | 2–3           |
| W5 bundle, installer/update/rollback/uninstall, font substitution | 800–1,400       | 5–8           |
| W6 provenance and brand tooling (M2)                              | 200–350         | 1–1.5         |
| W7 release evidence bundle, hygiene                               | 300–600         | 2–3           |
| **MVP total**                                                     | **2,650–4,650** | **16.5–25.5** |

Contingency for Windows findings and review latency: plus 5–10 days, as in the existing plan.

## Reuse budget per workspace

| Workspace                              | Donor lines          | Share of its code (estimate)                                     |
| -------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| Edit                                   | 1,503 + dependencies | ~31–42% (algorithms reused; UI and plan compile original)        |
| Studio                                 | 36,835               | ~90–94%                                                          |
| Cinema                                 | 575                  | ~45–57%                                                          |
| Director                               | 956                  | ~40–49%                                                          |
| Motion                                 | 2,961                | ~62–71%                                                          |
| Audio, Flow, Smart Router, Quality Lab | ~0                   | Original (no qualifying donor; FFmpeg filters do the media work) |
| Agents                                 | ~300 (estimate)      | ~43–55%                                                          |

Each budget is a ceiling, not a goal: a module whose import fails validation falls back to C (original) for that module only.
