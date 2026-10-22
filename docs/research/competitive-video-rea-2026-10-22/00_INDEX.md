# Competitive Video REA — Implementation-ready package

**Status:** RESEARCH COMPLETE for planning — **NOT** implementation authorization  
**Date:** 2026-10-22  
**Baseline main:** `a3c3ce91815aee35ce5b91b4a483dd85766a4429`  
**PR:** [#85](https://github.com/TheHalfMoon/Yamakan/pull/85)  
**Public release:** **NO-GO**  
**Engines / providers / weight downloads:** still **OFF** / not authorized

## Documents in this package

| # | File | Purpose |
| --- | --- | --- |
| 00 | This index | DoD, evidence grades, reading order |
| 01 | [01_COMPETITOR_AND_SOURCE_REA.md](01_COMPETITOR_AND_SOURCE_REA.md) | Competitor map + open-source pins (updated with official API evidence) |
| 02 | [02_BENCHMARK_AND_CONTINUATION_PLAN.md](02_BENCHMARK_AND_CONTINUATION_PLAN.md) | Fair head-to-head protocol; REA-01–06 closure status |
| 03 | [03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md](03_SOURCE_TRANSPLANT_AND_COPY_VS_BUILD.md) | Exact pins, modules, dependencies, copy-vs-build, Yamakan targets |
| 04 | [04_TARGET_ARCHITECTURE_AND_ROADMAP.md](04_TARGET_ARCHITECTURE_AND_ROADMAP.md) | Strongest achievable architecture preserving Yamakan authority |
| 05 | [05_PRODUCT_CAPABILITY_MATRIX.md](05_PRODUCT_CAPABILITY_MATRIX.md) | Feature × evidence-grade matrix |
| 06 | [06_OUTPERFORM_GAPS_AND_PATH.md](06_OUTPERFORM_GAPS_AND_PATH.md) | What Yamakan can/cannot match; shortest credible path |

## Evidence grades (mandatory)

| Grade | Meaning |
| --- | --- |
| **TESTED** | Yamakan or this research run executed the check and recorded artifacts |
| **DOCUMENTED** | Official vendor/API/docs or pinned public source inspected on the stated date |
| **INFERRED** | Reasonable engineering inference; not a measured result |
| **BLOCKED** | Cannot proceed under current gates (no GPU, no paid API, engine off, license) |
| **UNKNOWN** | Not inspected |

Marketing pages alone never upgrade a cell to TESTED.

## Definition of done (this package)

- [x] Competitor capabilities dated with official docs URLs (Higgsfield Cinema Studio 4.0 API, Runway Dev catalog, Kling API map, Luma Ray-2 API)
- [x] Open candidates pinned (ComfyUI, Wan2.2, Diffusers, LTX-2, VBench, CogVideoX as alternate)
- [x] Module/function/dependency maps + copy-vs-build decisions
- [x] Architecture that preserves canonical project, durable jobs, security, completed P10 work
- [x] Fair benchmark protocol separating claims vs tests
- [x] Compute/licensing constraints explicit; no paid services or weight downloads performed
- [x] Outperform / gap / path document
- [ ] Live paid competitor outputs — **NOT RUN** (no paid API)
- [ ] Local model inference — **NOT RUN** (no CUDA host; downloads forbidden)
- [ ] Independent human blind study — **NOT RUN**
- [ ] D1 / Alibaba / Graft live reviews — **NOT AVAILABLE** in this session (not invented)

## Non-goals

No production code changes that enable engines. No `ENGINE_ENABLED=true`. No provider keys. No weight downloads. No public release. No claim of global superiority.
