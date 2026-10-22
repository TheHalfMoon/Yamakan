# P10 residual PRs — security / correctness review (exact heads)

**Date:** 2026-10-22  
**Base:** `5d023c605292f0686cdc533700d2ff35fde8cbf0`  
**Public release:** NO-GO

## #70 Animation (`b5cd13d`)

- Commands gated by `ANIMATION_ENABLED`; no new spawn/filtergraph surface beyond plan compiler.
- Keyframe field renamed to `channel` (forbids executable/`path` schema names).
- Opacity/volume filters use shared sampler; transform channels stored-only.
- **Must-fix:** none.

## #71 Unsigned RC (`6f4563c`)

- Explicitly unlabeled as release; refuses Program Files; no signing claimed.
- Install roots are per-user / temp; marker required.
- **Must-fix:** none. Signing / Profile A remain open.

## #72 Reviews tooling (`1bafca8`)

- Docs-only evidence of tool availability.
- **Must-fix:** none.

## #73 JASSUB eng (`ea7a657`)

- `JASSUB_ENABLED=false`; production CSP unchanged (no `wasm-unsafe-eval`).
- Pin + notices + provenance present; Q11 budgets not met (honest fallback).
- Font isolation: `queryFonts:false`, pinned fonts only.
- **Must-fix:** none. Enablement blocked on H1 + CSP review + Q11 budgets.
