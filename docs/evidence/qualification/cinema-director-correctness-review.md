# Cinema + Director independent correctness review

**Head (pre-fix):** `20b5360` on `feat/p10-03-cinema-docs` (base `7472a06`)  
**Reviewer mode:** Manual fresh review (independent subagents hit usage limits; not claimed as agent approval)  
**Verdict:** **PASS_WITH_RESIDUALS**

## Findings

1. **Flag scope matches P10.** `CINEMA_ENABLED` / `DIRECTOR_ENABLED` true; capability objects list AI camera, generative video, remote URL fetch, model stages, and paid inference as unsupported.
2. **Persist path.** `yamakan.scene.save` validates via `saveScene3D`, then writes under `<workspace>/cinema/<uuid>.json` with content hash; open/list round-trip covered by `qualify:cinema-activation` (`cinema-activation.json` PASS).
3. **Viewport.** Local Three.js preview + orbit; `aiCameraAvailable()` hard-coded false; E2E asserts pose change and AI disabled.
4. **Director.** Panel uses session-authenticated client for `start`/`next` on `framework-smoke`; model stages not invoked; E2E PASS (`director-activation.json`).
5. **Browser/Node split.** Browser imports `scene3d-flags` / `director-flags` only (no Node `fs`); store is registry-only.
6. **Unit tests.** `node --test tests/cinema.test.ts tests/identity.test.ts` — 16/16 PASS including flag-true assertions and persist when Cinema on.
7. **Residual fixed in follow-up commit:** cinema-store now UUID-gates filenames before path join (list skips non-UUID; open/save parse `Id`).

## Merge recommendation

Merge after exact-head CI green and security receipt. Do **not** enable Animation, JASSUB, providers, or release GO.
