# Cinema + Director independent security review

**Head (pre-fix):** `20b5360` on `feat/p10-03-cinema-docs` (base `7472a06`)  
**Reviewer mode:** Manual fresh review (security-review subagent usage-limited; not claimed as agent approval)  
**Verdict:** **PASS_WITH_RESIDUALS** (path gate fixed before merge)

## Findings

1. **Auth.** Scene commands use registry scopes (`project:read` / `project:write`); qualify scripts send `X-Yamakan-Session` from launch exchange — no cookies.
2. **Asset-id only.** Scene3D schema and viewport `assertLocalScene` refuse `http(s)` / `://` in item `assetId`; capability lists `remote-media-url-fetch` unsupported.
3. **Human-only approve.** `yamakan.director.approve` remains `humanOnly: true` with `director:approve` scope; panel does not call approve; probe returns structured error.
4. **No paid egress.** No provider/engine flags flipped; Director unsupported includes `paid-inference`.
5. **Workspace files.** cinema dir `0700`, scene files `0600` on write (POSIX modes; Windows ACL still from workspace root policy).
6. **Must-fix (addressed):** list/open previously joined `sceneId` from directory names without UUID parse — path-segment risk. Follow-up: `Id.parse` / `Id.safeParse` before join; resolve equality check.

## Residual

- `__yamakanCinema` test handle is local-browser only (same class as Studio Q8 measurement handle).
- Generative/AI camera and engines stay disabled.
- Release remains **NO-GO** (H1–H5, R6/R7, E-SEC).

## Merge recommendation

Merge with path-hardening commit after exact-head CI. Fresh automated security agent when quota returns; investigate any material findings via forward-fix PRs.
