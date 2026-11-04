# SS-013: exact cue timing and keyboard editing

Started 2026-11-05 (Asia/Riyadh). Builder Claude Opus. Base main `da209315784d330e7247a375dedccc00f14a0ff2`. **The card stays open:** caption edits cannot be undone, and native Arabic judgment stays blocked on X-01.

## What was already right

Read or run before any change, in a real Edge browser or through commands:

- Tab and Shift+Tab move through a cue's fields in order, and a typed time reads back to the millisecond.
- A refused overlap names the cues in a `role="alert"` message and keeps the edit.
- `dir="auto"` gives Arabic and mixed cues right-to-left and Latin cues left-to-right. In an Arabic interface the fields are named in Arabic.
- SRT and WebVTT write exact times, and a time off the millisecond grid or an end before its start is refused.
- `{\…}` override markup is refused at import, and existing tests cover malformed and overlapping input.

**A suspicion that turned out wrong:** most frames at 30 fps and 24000/1001 fall off the millisecond grid, so "Split at playhead" looked likely to be refused. It is not: `src/main.tsx` rounds the playhead to a whole millisecond first. No change was made there.

## Defects fixed

Both were seen in the browser first.

- **An emptied time field became 0.000.** `Number("")` is 0, so clearing a field silently moved the cue to the start of the timeline. An emptied field now keeps its time.
- **Keyboard focus fell to the page** after Save, after a refused Save and after Discard, because the control was disabled or hidden while focused. Focus now returns to the control if it can still take it, and otherwise to the panel's heading. The change is in `src/captions.tsx`, with no change to commands or stored data.

## Results

- `npm run qualify:captions-keyboard`, a new real-browser qualifier, runs the steps above plus a reopen. It failed at the emptied field before the fix and passed after. Receipt `ss013-receipt.json` stays local.
- `tests/captions.test.ts` adds a real export at 24000/1001, whose frames fall on no whole millisecond, with a cue from 1.000 s to 2.000 s burned in. Decoded frames show ink on exactly frames 24 to 47, of 72: frame 23 is at 0.959 s and frame 48 at 2.002 s. It also checks that braces and a backslash that pass import reach the ASS line escaped, with no override or line break formed. This test passed the first time it could run, so it records behaviour that was already right rather than a fix.

## Not done

- **Caption edits cannot be undone.** `yamakan.project.undo` after a caption save answers "Nothing to undo at this revision". Reverting needs a change to per-writer history, which this card does not ask to redesign, so it is reported, not fixed. Reopen does keep the edit.
- **After a reload no track is selected,** so a user picks the track again. Left as it is.
- **Native Arabic judgment remains blocked on X-01.** The review packet exists at `docs/evidence/h1-arabic-review-packet`, and its caption fixtures parse by an existing test. No human has reviewed anything here. Direction was read from computed style, not judged by a reader of Arabic.
- Screen readers were not run. Focus was read from `document.activeElement`.
- Long text was checked only by `maxLength` and existing limits, not for layout.

Rollback: revert this change. No stored data is affected.
