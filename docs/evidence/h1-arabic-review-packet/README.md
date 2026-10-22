# H1 — Native Arabic review packet (unsigned)

**Status:** Engineering packet for a human native Arabic reviewer.  
**Approval:** **NOT granted.** Do not treat this folder as H1 pass.  
**JASSUB / W12 enablement:** blocked until a reviewer signs the checklist below.  
**Primary preview today:** server libass reference stills (`Encoding: -1`, pinned OFL fonts).  
**JASSUB_ENABLED:** `false` (do not flip until this packet is signed and production CSP review lands).

## Scope for the reviewer

1. Compare **export** (FFmpeg `subtitles` / libass) vs **preview** (current server reference still) for the T7 Arabic/Latin title fixtures.
2. Check RTL punctuation, mixed Arabic+Latin, digits, and diacritics on representative lines.
3. Confirm no silent LTR-only drawtext path is used for titles.
4. After engineering lands JASSUB behind `JASSUB_ENABLED`, re-check live preview vs export; keep flag false until then.

## Fixture images (T7 typography goldens)

Landscape (1280×720) — open each PNG and compare to export intent:

| # | Fixture | File |
| --- | --- | --- |
| 01 | punctuation | [typography/landscape-01-punctuation.png](../qualification/typography/landscape-01-punctuation.png) |
| 02 | bidi-isolates | [typography/landscape-02-bidi-isolates.png](../qualification/typography/landscape-02-bidi-isolates.png) |
| 03 | diacritics | [typography/landscape-03-diacritics.png](../qualification/typography/landscape-03-diacritics.png) |
| 04 | arabic-indic-digits | [typography/landscape-04-arabic-indic-digits.png](../qualification/typography/landscape-04-arabic-indic-digits.png) |
| 05 | lam-alef | [typography/landscape-05-lam-alef.png](../qualification/typography/landscape-05-lam-alef.png) |
| 06 | mixed-lines | [typography/landscape-06-mixed-lines.png](../qualification/typography/landscape-06-mixed-lines.png) |
| 07 | line-wrap | [typography/landscape-07-line-wrap.png](../qualification/typography/landscape-07-line-wrap.png) |
| 08 | long-word | [typography/landscape-08-long-word.png](../qualification/typography/landscape-08-long-word.png) |
| 09 | leading-digits | [typography/landscape-09-leading-digits.png](../qualification/typography/landscape-09-leading-digits.png) |
| 10 | literal-syntax | [typography/landscape-10-literal-syntax.png](../qualification/typography/landscape-10-literal-syntax.png) |
| 11 | tatweel-and-signs | [typography/landscape-11-tatweel-and-signs.png](../qualification/typography/landscape-11-tatweel-and-signs.png) |
| 12 | latin-only | [typography/landscape-12-latin-only.png](../qualification/typography/landscape-12-latin-only.png) |

Portrait set: `docs/evidence/qualification/typography/portrait-*.png` (same fixture names; long-word omitted).

Receipt: `docs/evidence/qualification/t7-typography.json` (Arabic review pending).

## Checklist (reviewer fills)

| Item | Pass? | Initials | Date | Notes |
| --- | --- | --- | --- | --- |
| Export Arabic titles read correctly (base direction) | | | | |
| Preview reference stills match export for fixtures | | | | |
| Mixed Arabic/Latin and digits acceptable | | | | |
| Diacritics / punctuation placement acceptable | | | | |
| Font substitution negatives understood (pinned fonts only) | | | | |
| Landscape fixture table reviewed (links above) | | | | |
| **Sign-off to enable JASSUB preview** | | | | **Leave blank until ready** |

## Engineering attachments

- Flag: `core/preview/jassub-flags.ts` (`JASSUB_ENABLED=false`)
- Construction: `src/preview/titles.ts` (refuses while disabled; forced test helper checks `queryFonts:false`, pinned fonts, memory/glyph limits)
- Q11 eng receipt: `docs/evidence/qualification/q11-jassub-eng.json` (`engComplete`; perf/SSIM measured honestly; enablement blocked on H1 + CSP review)
- Typography / ASS contract: `core/render/ass.ts`, `core/render/capability.ts`
- npm pin: `jassub@2.5.20` (`dea3d2d3`) with notices under `notices/jassub-*`

## Explicit non-claims

- No native Arabic reviewer has signed this packet in-repo.
- Do not treat measured qualify-harness Q11 numbers as production enablement.
- CSP `'wasm-unsafe-eval'` / COOP/COEP changes are **not** applied to production until a dedicated security-reviewed commit.
- Public release remains **NO-GO**.
