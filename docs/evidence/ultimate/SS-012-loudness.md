# SS-012: measured loudness and audio controls

Started 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Base main `1c33c34e1efe0d75ab294b1fc3d117777a84093b`. **The card stays open:** items under "Not done" remain.

## Real results before the change

Real two-pass exports through the job queue on AC power, target −16 LUFS, read back with `ebur128`. A 3-second 440 Hz tone over a grey still. Log `ss012-probe.jsonl` stays local.

| Case                           | Result                     | Output I, LUFS | Note                                                |
| ------------------------------ | -------------------------- | -------------- | --------------------------------------------------- |
| −30 dB tone, normalized        | Completed                  | −15.6          | Within 1 LU                                         |
| −30 dB tone, not normalized    | Completed                  | −51.3          | Unchanged by normalizing, as expected               |
| 0 dB tone, normalized          | Completed                  | −15.6          |                                                     |
| Silence, normalized            | **Failed**                 | —              | "Loudnorm measure missing input_i."                 |
| Silence, not normalized        | Completed                  | below gate     |                                                     |
| −85 dB tone, normalized        | **Failed**                 | —              | Same message                                        |
| −20 dB tone at 2 s, normalized | Completed                  | −15.7          | First sound at 2.005 s                              |
| Muted track, normalized        | Completed, no audio stream | —              | Nothing tells the caller that nothing was measured  |
| Same revision twice            | Completed, identical       | −15.6          | Same plan hash; the output files are byte-identical |

So normalizing already worked, and the qualifier's tone result held. **The defects were reporting:** an internal message for silence, and no way to learn afterward whether an export's sound was measured.

## Change

- **Silence or sound below FFmpeg's gate is refused in plain words:** "This sound is too quiet to measure, so it cannot be normalized. Export without normalizing loudness." FFmpeg reports it as `-inf`. Other bad values keep their named refusal.
- **A job now says what its loudness request came to.** `loudness` on the job view, additive: `off`, `pending`, `measured` with `inputI` and `targetI`, `unmeasured`, or `unknown` for a normalized job finished before this was recorded. `null` for a job that is not an export. The measured values come from the render plan and are kept in the attempt's existing `receipt` column, so there is no schema change.

The source sound is untouched, and no DSP or limit changed.

## Tests

`tests/loudness-export.test.ts` uses real exports: a measured export lands within 1 LU and reports it; a repeat gives the same plan, report and bytes; an export that did not ask says `off`; silence and a −85 dB tone are refused and export fine unnormalized; a muted track is `unmeasured`; delayed sound keeps its start within 50 ms; the report survives a reopen; solo silences the other track; and a fade rises in the decoded output. Five of the first six tests were seen to fail before the change. `tests/w18-audio-flow.test.ts` covers the parser's refusals, and `tests/jobs.test.ts` pins the new receipt field.

## Not done

- **No interface sets `normalizeLoudness`:** the browser's export button does not offer it, so this reaches SDK, CLI and MCP callers only, and the browser shows no loudness state.
- Peak after normalizing was read from `ebur128` on pure tones only. Real programme material was not tested, so clipping is not qualified.
- A cancel during the measure pass is covered only by the older segment tests, and `unmeasured` for a cancelled job by reading.
- Unlink is covered at plan level by `tests/w18-audio-flow.test.ts`, not by decoded output. Undo is exercised only in that the project reopens with its source.

Rollback: revert this change. A job's receipt keeps an extra field, which older code ignores.
