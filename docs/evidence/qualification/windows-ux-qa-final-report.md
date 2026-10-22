# Windows product quality — final report (#82)

**Date:** 2026-10-22  
**Engineering head:** `e8bb8dd20fdbb87c520c948222cd44abffb5ed0d` (PR #83)  
**Post-merge CI:** SUCCESS run `39792739808`  
**Prior QA baseline:** `252b449d04034eaf78258951c7dd33e835c97c20`  
**Release verdict:** **NO-GO** (unchanged)

## Mission outcome

Issue [#82](https://github.com/TheHalfMoon/Yamakan/issues/82) verified defects are fixed and merged. A bounded Windows product-pass campaign on the isolated D: QA root passed.

## Fixes shipped (#83)

| Defect | Fix |
| --- | --- |
| Legacy `D` brand glyph | Yamakan `Y` monogram in header + empty state |
| Hard-coded English preview status | `preview.clipStatus` EN/AR via i18n |
| English default scene names | `t("scene.default", { n })` |
| Native “Choose File” in Arabic UI | Localized button + accessible hidden `<input type="file">` |
| Footer honesty | Still engineering preview; clarifies “Not a public release” |

Tests: `tests/brand-ui.test.ts`, existing `tests/i18n.test.ts`. Provenance updated for `PreviewPlayer.tsx`.

## Windows product-pass campaign

- **Harness:** `scripts/qualify-windows-product-pass.ts`
- **Root:** `D:\yamakan-qa-product-pass\2026-10-22T13-45-53-023Z`
- **Receipt:** `docs/evidence/qualification/windows-product-pass.json`
- **Artifacts (host D:):** `evidence/export.mp4`, `export-frame-1s.png`, `preview-frame-1s.png`, `receipt.json`

### Results

| Check | Result |
| --- | --- |
| Multi-clip import (2× video + audio) | PASS |
| Trim/split via typed batch | PASS (5 clips after split) |
| Opacity animation (flag on) | PASS |
| Arabic title on titles track | PASS |
| Export H.264 1280×720 + AAC 48 kHz stereo | PASS |
| FFmpeg full decode | PASS |
| Preview frame + export frame written | PASS |
| Duration ≥ 5 s | PASS (6.0 s) |
| Export SHA256 | `ebf7a0d2293fc768ffaa45cd6fd4b81805d0ea73a64c8d5741ae9dead545f4c1` |
| Elapsed | ~21 s |

Prior founder QA at `252b449` already recorded Edge E2E PASS, 361 unit tests PASS, and a decoded export (separate SHA).

## Local verification on #83 head

- `npm run typecheck` / `format:check` / `brand:check` / `provenance:check`
- Focused i18n + brand-ui tests
- Edge `npm run test:e2e` — 0 page errors, 0 external requests
- Exact-head CI on PR #83 — SUCCESS

## Limitations / remaining blockers

- **H1** native Arabic human sign-off — not executed
- **H2** clean Profile A offline capture — not this D: QA root
- **H3** second-account ACL — open
- **H4** constrained disk-full — open
- **H5** / Authenticode / public release — open
- Preview vs export is a presence check (bytes written), not a full SSIM campaign
- JASSUB / providers / engines remain gated off
- Public release remains **NO-GO**

## Screenshots / evidence locations

- Founder QA screenshots (baseline): `D:\yamakan-qa-20261022\evidence\browser\` (host-local; not committed)
- Product-pass frames/MP4: `D:\yamakan-qa-product-pass\2026-10-22T13-45-53-023Z\evidence\` (host-local)
- Committed receipt JSON: `docs/evidence/qualification/windows-product-pass.json`
