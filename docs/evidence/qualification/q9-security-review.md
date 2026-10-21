# Q9 independent security review (PR #59)

**Head:** `6546794ab95ee727ba5c512ee6f6b7470f3e44c9`  
**Base:** `72bc193bba6eab97f8e4ba7e0cc1be9ffeee393d`  
**Reviewed:** 2026-10-21  
**Verdict:** **PASS** for merge with `STUDIO_ENABLED=false`

## Scope

Host shims, tsconfig/vitest exclusion honesty, canvas-engine production boundary, provenance, no premature Studio enablement.

## Findings

1. **Engine network/node boundary retained.** `src/studio/boundaries.test.ts` still forbids `fetch` / `XMLHttpRequest` / `WebSocket` / `node:` in non-test engine sources and forbids `canvas-operations` imports. Production engine files were not opened to network by this PR.
2. **`STUDIO_ENABLED` remains false.** Force-mount (`?studioQ8=1`) is measurement-only; production flag gate unchanged.
3. **tsconfig excludes do not hide production code.** Excludes are limited to browser tests, golden harness, Q9 denominator exclusions, and two documented residual known-fail tests. Production `src/studio/canvas-engine/**/*.ts` (non-test) still typechecks.
4. **Host shims are test/session scaffolding, not auth bypass.** `workbenchState` / `workbenchState.testing` / loose `WorkbenchAction` do not expose remote APIs or elevate privileges.
5. **Asset path.** Host `assetStore` / `imageResolver` remain the only image I/O path from the engine (no raw URL fetch in engine). Staging candidate contracts continue to use asset names, not free-form remote URLs in production types.
6. **Provenance.** Inherited tests are ledgered in `docs/provenance/imports.json`; exclusions are recorded in `q9-exclusions.json` without claiming passes.
7. **Tooling note.** Alibaba OpenCodeReview CLI is installed (`opencodereview-windows-amd64.exe`) but local provider `chatgpt` is not configured — LLM-backed OCR blocked; this manual review + boundary tests substitute for this head. Delegate-only OCR was not used as a substitute for model-backed review.

## Residual (non-blocking for Q9)

- Two residual failing files covering kept code remain excluded from CI/vitest and from pass counts — must be ported before claiming full surface closure at Studio enablement.
- Q10 latency/chunk not yet run; enablement blocked until Q10 passes.

## Merge recommendation

Approve Q9 merge on green exact-head CI. Do **not** flip `STUDIO_ENABLED`.
