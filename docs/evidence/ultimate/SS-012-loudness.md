# SS-012: measured loudness and audio controls

Started 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Base main `1c33c34e1efe0d75ab294b1fc3d117777a84093b`. **The card stays open:** items under "Not done" remain.

## Real results before the change

Real two-pass exports through the job queue on AC power, target −16 LUFS, read back with `ebur128`. A 3-second 440 Hz tone over a grey still. Log `ss012-probe.jsonl` stays local.

| Case                           | Result                     | Output I, LUFS   | Note                                                |
| ------------------------------ | -------------------------- | ---------------- | --------------------------------------------------- |
| −30 dB tone, normalized        | Completed                  | −15.6            | Within 1 LU                                         |
| −30 dB tone, not normalized    | Completed                  | −51.3            | No normalizing asked for                            |
| 0 dB tone, normalized          | Completed                  | −15.6            |                                                     |
| Silence, normalized            | **Failed**                 | —                | "Loudnorm measure missing input_i."                 |
| Silence, not normalized        | Completed                  | −70.0, its floor |                                                     |
| −85 dB tone, normalized        | **Failed**                 | —                | Same message                                        |
| −20 dB tone at 2 s, normalized | Completed                  | −15.7            | First sound at 2.005 s                              |
| Muted track, normalized        | Completed, no audio stream | —                | Nothing tells the caller that nothing was measured  |
| Same revision twice            | Completed, identical       | −15.6            | Same plan hash; the output files are byte-identical |

So normalizing already worked, and the qualifier's tone result held. **The defects were reporting:** an internal message for silence, and no way to learn afterward whether an export's sound was measured.

## Change

- **Sound FFmpeg cannot measure is refused in plain words:** "This sound is too quiet or too short to measure, so it cannot be normalized. Export without normalizing loudness." FFmpeg reports `-inf` for silence, for sound below its gate, which was −49 dB and under on a tone, and for sound shorter than one 400 ms block however loud. So a loud 0.2 s clip is refused, as it was before with an internal message. Other bad values keep their named refusal.
- **A job now says what its loudness request came to.** `loudness` on the job view, additive: `off`, `pending`, `measured` with `inputI` and `targetI`, `unmeasured`, or `unknown` for a normalized job finished before this was recorded. `null` for a job that is not an export. The measured values come from the render plan and are kept in the attempt's existing `receipt` column, so there is no schema change.

The source sound is untouched, and no DSP or limit changed.

## Tests

`tests/loudness-export.test.ts` uses real exports: a measured export lands within 1 LU and reports it; a repeat gives the same plan, report and bytes; an export that did not ask says `off`; silence and a −85 dB tone are refused and export fine unnormalized; a muted track is `unmeasured`; delayed sound keeps its start within 50 ms; the report survives a reopen; solo silences the other track; and a fade rises in the decoded output. A cancel caught during the measure pass ends `CANCELLED` with no artifact and `unmeasured`. A receipt the job cannot read is `unknown`, and a job set aside for reconciliation is `unmeasured`. The first version's tests were seen to fail before the change. `tests/w18-audio-flow.test.ts` covers the parser's refusals, and `tests/jobs.test.ts` pins the new receipt field.

## Qualifiers at this change

On AC power, with another review running on the machine. `qualify:w18-loudnorm` passed: −9.75 to −16.05 LUFS against −16. `qualify:av-sync` passed, with its negative control detected. Its timing receipt was not committed, because the machine was not quiet. Local logs: `s12-w18.log`, `02d215ef7b6677ba9193b7ddda5ebca01c2d4b96a792c8a721171c3c03cc7b83`; `s12-av.log`, `03900dd34cf0e08961539f87336f89a8f1f3b9dadc1717b0f754e38feac11be2`; `ss012-probe.jsonl`, `a19b8f3d0e5525cf04dd9d7827e07b10ccae2483070b578d48094a2c74d04b6f`.

## Independent review

Nothing blocking. By its runs, batch variants and a segmented 34-clip export report correctly, and `job.list` of 500 such rows took 36 to 54 ms. It found the false "too quiet" on short sound, a false line here saying older tests covered a cancel during the measure pass, and three untested branches, all fixed above, plus the on-target point below.

## Not done

- **No interface sets `normalizeLoudness`:** the browser's export button does not offer it, so this reaches SDK, CLI and MCP callers only, and the browser shows no loudness state.
- Peak after normalizing was read from `ebur128` on pure tones only. Real programme material was not tested, so clipping is not qualified.
- **`measured` means measured, not on target.** The card asks to record actual values, not the linear-mode request alone, and output loudness is not recorded. A review's extreme source of 1 ms impulses over a very quiet bed reported `measured` with input −27.01 and target −16, and its output was −29.0 LUFS, 13 LU off. Its pink noise and claps over a quiet bed landed at −15.5 to −15.6. FFmpeg's normalization type for the apply pass is not recorded either.
- Unlink is covered at plan level by `tests/w18-audio-flow.test.ts`, not by decoded output. Undo is exercised only in that the project reopens with its source.

Rollback: revert this change. A job's receipt keeps an extra field, which older code ignores.
