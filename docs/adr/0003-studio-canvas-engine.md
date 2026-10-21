# 0003. Studio canvas engine path (W10 / M7 + M13)

Status: **amended 2026-10-21** (agent decision under frozen plan W10/W11; founder E-SEC and F remain separate gates).

Original acceptance dated 2026-10-21. Amendment records a properly configured Q7a reproduction and selects the primary.

## Context

W10 decides the Studio integration by Q7a, Q7b, Q8–Q10 against the frozen M7 boundary, and lands the M13 engine contract with a fake engine only. No real ComfyUI run. Primary donor: InvokeAI `ffe9e1a98b19640388d72f88ae0ecadf1bee1717` `invokeai/frontend/webv2` canvas-engine. Fallback: webv1 `controlLayers` at the same pin; else original ladder C.

## Measurements (throwaway)

| Qual | Method | Result | Binding |
| ---- | ------ | ------ | ------- |
| Q7a (original, preserved) | Sparse-cloned pin into `%TEMP%\yamakan-w10-q7a-invoke`; throwaway with only `typescript@5.9.3` + `zod@4.4.3`; `tsc` included tests. | **Fail receipt preserved:** 742 errors (`docs/evidence/qualification/q7a-studio-tsc.json`). | Historical; not rewritten. |
| Q7a classification | Re-parsed original UTF-16 `tsc-out.txt`. | **711/742 errors in `*.test.ts` / test support** (Q9 scope). Production-engine lines: 31. Dominant causes: missing `vitest`/`ag-psd`/closure modules and incomplete shims cascading into TS7006. | Original fail kept; classification at `q7a-webv2-error-classification.json`. |
| Q7a proper reproduction | New throwaway `D:\yamakan-q7a\webv2-q7a-proper`: production engine + real closure + host shims; deps `ag-psd@31.0.3`, `perfect-freehand@1.2.3`, TS 5.9.3, zod 4.4.3; tests excluded. `tsc --noEmit` then `vite build` (entry `engine.ts`). | **Pass:** 0 `tsc` errors; vite 154 modules, 444.86 kB / 119.71 kB gzip. Receipt: `q7a-studio-tsc-proper.json`. | **Primary webv2 canvas-engine selected for W11.** |
| Q7a webv1 fallback | Fetched `invokeai/frontend/webv1/src/features/controlLayers` at the same pin (present; earlier sparse checkout was webv2-only). Measured konva+store+util+text with host shims. | **Fail:** 396 `tsc` errors (Redux/API/host-type coupling). | Not selected; primary already passed. |
| Q7b | Reducer seam compile + inherited tests | **In progress with W11** (seam host types proven in the proper Q7a throwaway). | Engine stays primary; host reducer only if seam adaptation fails. |
| Q8 | Mount engine in React 18.3.1 and draw one stroke | **In progress with W11.** | Plain-container fallback available. |
| Q9 | Vitest scoped to `src/studio/**` | **In progress with W11.** | — |
| Q10 | Studio chunk ≤ 2.5 MiB gzip; stroke p95 ≤ 16 ms | **In progress with W11.** | Flag stays off until targets met. |

## Decision

1. **Studio canvas primary (InvokeAI webv2 canvas-engine) is selected for W11 copy**, based on the properly configured Q7a pass. The original fail receipt remains on record and is not weakened; it measured an incomplete toolchain and included Q9 test files.
2. **webv1 `controlLayers` is not selected.** It was evaluated at the pin and failed Q7a; primary already qualifies.
3. **Ladder C (original host) is not required.**
4. **M13 remains:** `core/engines/{contract,fake}.ts` with `ENGINE_ENABLED = false` until E-SEC + founder F. Studio canvas capability is separate from generative engine enablement.
5. W11 imports follow M7 in `04_EXACT_SOURCE_IMPORT_BLUEPRINT.md`: host owns `studioDocument` and assets; engine owns pixels and session history; no competing persistent store.

## Consequences

W11 proceeds with the primary import behind a Yamakan host adapter. Q7b and Q8–Q10 run during W11. W12 remains gated on H1 (native Arabic review). Release remains **NO-GO**.

## Change rule

Further path changes require a new ADR amendment with named throwaway measurement commits or receipts.
