# H1 — Caption tracks (YU-024): native Arabic review (unsigned)

**Status:** OPEN — engineering fixtures for a human native Arabic reviewer.
**Approval:** **NOT granted.** Automated tests check timing, escaping and that the reference preview and export draw the same pixels; they cannot judge Arabic reading quality. Do not treat this folder as an H1 pass.

## Fixtures

| File                   | What it exercises                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arabic-bilingual.srt` | Five cues: greeting, two lines, mixed Arabic/Latin with digits and parentheses, Arabic-Indic and Western digits with guillemets, diacritics (tashkeel) with an italic tag (removed on import). |
| `arabic-bilingual.vtt` | The same cues as WebVTT, with a NOTE block.                                                                                                                                                    |

## Procedure (human)

1. Open a project of at least 12 seconds, go to **Finish → Captions**, import each fixture (language Arabic), and turn on **Burn into the picture**.
2. Look at the reference preview and an export at each cue (0.5 s, 2.6 s, 5.1 s, 7.6 s, 10.0 s).
3. Download the track as SRT and WebVTT and re-import each; the cues should come back unchanged.
4. Fill the table. Record the exact git SHA and the pinned font hashes from `docs/evidence/h1-arabic-review-packet/CHECKLIST.md`.

## Pass criteria (all required)

| #   | Criterion                                                                      | Pass? | Initials | Notes |
| --- | ------------------------------------------------------------------------------ | ----- | -------- | ----- |
| 1   | Each cue reads right to left as a native reader expects                        |       |          |       |
| 2   | Mixed Arabic/Latin and parentheses (cue 3) are ordered correctly               |       |          |       |
| 3   | Arabic-Indic and Western digits and guillemets (cue 4) render correctly        |       |          |       |
| 4   | Diacritics (cue 5) are placed correctly; the italic tag is gone, its text kept |       |          |       |
| 5   | Two-line cue (cue 2) breaks where written                                      |       |          |       |
| 6   | Reference preview and export show the same text in the same place              |       |          |       |
| 7   | SRT and WebVTT downloads re-import with identical times and text               |       |          |       |

| Reviewer name | Date (UTC) | Git SHA | Signature |
| ------------- | ---------- | ------- | --------- |
|               |            |         |           |
