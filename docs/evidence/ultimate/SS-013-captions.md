# SS-013: exact cue timing and keyboard editing

Started 2026-11-05 (Asia/Riyadh). Builder Claude Opus. Base main `da209315784d330e7247a375dedccc00f14a0ff2`. **The card stays open:** native Arabic judgment stays blocked on X-01.

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

## Undo across document saves

At the founder's instruction. Any document save used to delete the project's edit history, so after a timeline edit then a caption edit, Undo answered "Nothing to undo at this revision" and those timeline edits could never be undone. Undo restores whole snapshots along a linear stack, so the deletion was only needed because document saves were outside that stack.

**Change:** a save of a caption track, LUT, Studio canvas or Cinema scene by a named writer is now a step in that writer's history, and undo and redo restore the documents of the revision they return to. Another writer's save refuses as "made by another client", as a timeline edit does. No schema change; existing rows are read as before.

**Still ends the history, on purpose:**

- **Stories and reference packs:** they are checked against the consent ledger only when committed, and undo must not bring one back past that check. So this defect remains for them: a timeline edit before a story save cannot be undone after it.
- **Legacy migrations:** the record outlives a snapshot, so undo would leave a recorded migration with no document. By reading; no new test.
- **A save with no named writer,** which nobody could undo.
- **Asset import and whole-project save,** which were not part of this request. **After a timeline edit then an import, Undo is still refused.**

**Tests:** `tests/undo-across-documents.test.ts`, 8 tests through commands and the store: the step-by-step sequence with redo, an undone edit restoring its version and the hash check following it, a Studio save, another writer refused, a retried save adding no second step, a reopen, an unnamed save, and a pack ending the history. Six were seen to fail before the change. `npm run qualify:captions-keyboard` adds the sequence in real Edge with the real Undo and Redo buttons, and the panel showing the old time. An existing test that timeline undo keeps document references still passes.

**Not checked:** the Studio and Cinema editors in a browser after an undo, including a draft held open across one; only the caption panel was seen re-reading. LUT and Cinema saves share the path but have no test of their own here.

Rollback: revert this change. Steps already recorded stay harmless to older code, which undoes to their snapshot but keeps the head's documents, so after a rollback an undo across a document save would not take the document back.

## Not done

- **Focus still falls to the page in one keyboard path:** a first edit in a Start field followed by Shift+Tab, because the previous row's Split button is disabled as the draft starts. A review saw this; it predates this change.
- **After a reload no track is selected,** so a user picks the track again. Left as it is.
- **Native Arabic judgment remains blocked on X-01.** The review packet exists at `docs/evidence/h1-arabic-review-packet`, and its caption fixtures parse by an existing test. No human has reviewed anything here. Direction was read from computed style, not judged by a reader of Arabic.
- Screen readers were not run. Focus was read from `document.activeElement`.
- Long text was checked only by `maxLength` and existing limits, not for layout.

## Full suite

**The one full run at `be332c311abdef3fac8eb744ebe34737d2f5a9ac` had 8 failures and is not valid evidence either way:** the machine was on battery at 88% load with 0.7 GB of memory free, and the suite took 727 s against about 405 s normally. Log `s13-test.log`, `022f770e08955b2b5b05c2be55e25272cecd215151acc880a92aa26096ed2d3a`. They were FFmpeg probes and renders timing out, an interruption test, and an MCP load test. A review found no link to this diff, by reading. It also found that `core/render/capability.ts` reports a timed-out probe as "Titles need FFmpeg with libass 0.17 or newer", a wrong reason on a starved machine. **A run on a healthy host is still owed.**

Rollback: revert this change. No stored data is affected.
