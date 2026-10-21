# Q9 independent correctness review (PR #59)

**Head:** `6546794ab95ee727ba5c512ee6f6b7470f3e44c9`  
**Verdict:** **PASS_WITH_RESIDUALS**

## Findings

1. **Denominator honesty intact.** `q9-studio-inherited.json` reports 120/122 = 98.36% with six uncopied-module exclusions and two residual known failures explicitly not counted as passes (`q9-exclusions.json`).
2. **Vitest vs tsc selection aligned.** `vitest.config.ts` excludes the same residual/denominator/browser surfaces; `tsconfig.json` production exclude mirrors that set so `npm run build` cannot launder failures into green builds without deleting files.
3. **Host shims do not invent false passes for excluded suites.** Excluded files (`engine.test.ts`, `samTool.test.ts`, etc.) remain out of the default vitest run; kept passing files (e.g. `lassoTool.test.ts`, `fontReferences.engine.test.ts`) exercise engine code through host ports.
4. **Residuals documented.** `stagedResultController.test.ts` / `compositeFrame.test.ts` cover kept code, remain failing, are excluded from CI and from pass counts — correct per frozen Q9 policy.
5. **Provenance.** Imported paths recorded in `docs/provenance/imports.json` for the inherited suite.
6. **CI.** Exact-head run https://github.com/TheHalfMoon/Yamakan/actions/runs/39638171676 — qualify / qualify-windows-r8 / otio-oracle SUCCESS on `6546794`.

## Merge recommendation

Merge Q9. Keep `STUDIO_ENABLED=false` until Q10 + residual port policy for enablement.
