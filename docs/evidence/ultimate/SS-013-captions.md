# SS-013: exact cue timing and keyboard editing

Started 2026-11-05 (Asia/Riyadh). Builder Claude Opus. Base main `da209315784d330e7247a375dedccc00f14a0ff2`. **The card stays open:** caption edits cannot be undone, and native Arabic judgment stays blocked on X-01.

## What was already right

- **By the new qualifier, in real Edge:** Tab from a Start field goes to its End field and Shift+Tab returns, after an edit already started the draft. A typed time reads back to the millisecond. A refused overlap names the problem and keeps the edit. `dir="auto"` gives Arabic and mixed cues right-to-left and Latin cues left-to-right, and each takes typed text. In an Arabic interface the first time field is named in Arabic.
- **By existing tests, judged by their names:** export times, an off-grid time, an end before its start, `{\…}` override markup refused at import, and malformed and overlapping input.
- **By reading only:** the alert role on the refusal message.

**A suspicion that turned out wrong:** most frames at 30 fps and 24000/1001 fall off the millisecond grid, so "Split at playhead" looked likely to be refused. It is not: `src/main.tsx` rounds the playhead to a whole millisecond first. No change was made there.

## Defects fixed

Both were seen in the browser first.

- **An emptied time field became 0.000.** `Number("")` is 0, so clearing a field silently moved the cue to the start of the timeline. An emptied field now keeps its time.
- **Keyboard focus fell to the page** after Save, after a refused Save and after Discard, because the control was disabled or hidden while focused. Focus now returns to the control if it can still take it, and otherwise to the panel's heading, without scrolling the page. A click elsewhere during a command cancels this. Those last two came from a review, which saw the page jump from y=1401 to y=51 on a mouse save with 40 cues, and a second burn-in toggle after focus was handed back; **they were fixed by reading its report and have no test of their own.** The change is in `src/captions.tsx`, with no change to commands or stored data.

## Results

- `npm run qualify:captions-keyboard`, a new real-browser qualifier, runs the keyboard steps above plus a reopen. CI does not run it, as CI runs no `qualify:` script, so nothing in CI covers these two fixes. It failed at the emptied field before the fix and passed after. Receipt `ss013-receipt.json` stays local.
- `tests/captions.test.ts` adds a real export at 24000/1001, whose frames fall on no whole millisecond, with a cue from 1.000 s to 2.000 s burned in. Decoded frames show ink on exactly frames 24 to 47, of 72: frame 23 is at 0.959 s and frame 48 at 2.002 s. The margins are 11 ms or more, so a 1 ms timing error would pass. It also calls `escapeAssText` directly on braces and a backslash that pass import, and finds no override or line break formed; ink alone cannot tell literal text from parsed text. This test passed the first time it could run, so it records behaviour that was already right rather than a fix.

## Not done

- **A caption save ends undo, not only for the caption.** Any document commit deletes the project's edit history (`core/store.ts`). After a timeline edit then a caption edit, Undo answers "Nothing to undo at this revision", changes nothing, and **the earlier timeline edits can never be undone again.** After a further timeline edit, one Undo works and the next is refused. Reopen keeps the edit, and history restore remains by reading, untested. Run through commands by a review; the Undo button itself was read, not clicked. Fixing it means changing per-writer history, which this card does not ask to redesign, so it is reported, not fixed. **This is the main open item, and it affects every document kind, not only captions.**
- **Focus still falls to the page in one keyboard path:** a first edit in a Start field followed by Shift+Tab, because the previous row's Split button is disabled as the draft starts. A review saw this; it predates this change.
- **After a reload no track is selected,** so a user picks the track again. Left as it is.
- **Native Arabic judgment remains blocked on X-01.** The review packet exists at `docs/evidence/h1-arabic-review-packet`, and its caption fixtures parse by an existing test. No human has reviewed anything here. Direction was read from computed style, not judged by a reader of Arabic.
- Screen readers were not run. Focus was read from `document.activeElement`.
- Long text was checked only by `maxLength` and existing limits, not for layout.

## Full suite

**The one full run at `be332c311abdef3fac8eb744ebe34737d2f5a9ac` had 8 failures and is not valid evidence either way:** the machine was on battery at 88% load with 0.7 GB of memory free, and the suite took 727 s against about 405 s normally. Log `s13-test.log`, `022f770e08955b2b5b05c2be55e25272cecd215151acc880a92aa26096ed2d3a`. They were FFmpeg probes and renders timing out, an interruption test, and an MCP load test. A review found no link to this diff, by reading. It also found that `core/render/capability.ts` reports a timed-out probe as "Titles need FFmpeg with libass 0.17 or newer", a wrong reason on a starved machine. **A run on a healthy host is still owed.**

Rollback: revert this change. No stored data is affected.
