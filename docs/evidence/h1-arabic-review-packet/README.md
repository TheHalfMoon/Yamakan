# H1 — Native Arabic review packet (unsigned)

**Status:** Engineering packet for a human native Arabic reviewer.  
**Approval:** **NOT granted.** Do not treat this folder as H1 pass.  
**JASSUB / W12 enablement:** blocked until a reviewer signs the checklist below.  
**Primary preview today:** server libass reference stills (`Encoding: -1`, pinned OFL fonts).

## Scope for the reviewer

1. Compare **export** (FFmpeg `subtitles` / libass) vs **preview** (current server reference still) for the T7 Arabic/Latin title fixtures.
2. Check RTL punctuation, mixed Arabic+Latin, digits, and diacritics on representative lines.
3. Confirm no silent LTR-only drawtext path is used for titles.
4. After engineering lands JASSUB behind `JASSUB_ENABLED`, re-check live preview vs export; keep flag false until then.

## Checklist (reviewer fills)

| Item | Pass? | Initials | Date | Notes |
| --- | --- | --- | --- | --- |
| Export Arabic titles read correctly (base direction) | | | | |
| Preview reference stills match export for fixtures | | | | |
| Mixed Arabic/Latin and digits acceptable | | | | |
| Diacritics / punctuation placement acceptable | | | | |
| Font substitution negatives understood (pinned fonts only) | | | | |
| **Sign-off to enable JASSUB preview** | | | | **Leave blank until ready** |

## Engineering attachments

- Flag: `core/preview/jassub-flags.ts` (`JASSUB_ENABLED=false`)
- Stub: `src/preview/titles.ts` (refuses construction while disabled)
- Q11 eng receipt: `docs/evidence/qualification/q11-jassub-eng.json` (not a performance pass)
- Typography / ASS contract: `core/render/ass.ts`, `core/render/capability.ts`

## Explicit non-claims

- No native Arabic reviewer has signed this packet in-repo.
- Q11 ≤4 ms/frame and SSIM ≥0.95 are **not** claimed until measured with a pinned JASSUB build.
- CSP `'wasm-unsafe-eval'` / COOP/COEP changes are **not** applied until a dedicated security-reviewed commit.
