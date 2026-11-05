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

- **Stories and reference packs:** undo must not bring one back past the check made when it is committed. So this defect remains for them: a timeline edit before a story save cannot be undone after it.
- **Legacy migrations:** the record outlives a snapshot, so undo would leave a recorded migration with no document.
- **A save with no named writer,** which nobody could undo.
- **Asset import and whole-project save,** which were not part of this request. **After a timeline edit then an import, Undo is still refused.**

**Tests:** `tests/undo-across-documents.test.ts`, 10 tests through commands and the store: the step-by-step sequence with redo, an undone edit restoring its version and the hash check following it, a Studio save, another writer refused, a retried save adding no second step, a reopen, an unnamed save, a pack and a story each ending the history, and the rollback switch. Six of the first eight were seen to fail before the change. `tests/cinema-migration.test.ts` covers a migration ending it. `npm run qualify:captions-keyboard` adds the sequence in real Edge with the real Undo and Redo buttons, and the panel showing the old time. An existing test that timeline undo keeps document references still passes.

**An independent review ran two checks on safety, and neither failed.** A story's hash held through undo and redo, because among history steps only undo, redo and document commits write document references. And a step restoring a clip whose take has continuity references under a revoked consent was refused at the commit. Studio, Cinema, captions and LUTs have no commit-time consent check to bypass. It also found the missing story and migration tests and the rollback switch gap, fixed above.

**A related question, since run:** a take with a pinned pack and no continuity references does return through undo after its consent is revoked. But an ordinary `clip.add` of the same media is accepted too, so undo is no bypass of its own. This is the documented rule: only a take made with continuity references is gated on the timeline, and a reference entry's own media is not. `tests/story-packs.test.ts` pins it. **This leaves a question for the founder, unchanged here:** an imported photo of the person, and a take that merely pins their pack, can still be placed and exported after revocation; dropping a pin and saving the story then allows assembly; and the gate is per project and per exact hash, so a re-encode or an import into another project is not caught. A review had read this as a possible gap, and the contract's "undo and redo do not check consents again" was wrong for continuity takes; it is corrected.

**Open, for a follow-up:**

- **A save with identical content adds a step** whose Undo shows no change; run. Undoing a save from a workspace that does not show it also changes nothing on screen, by reading.

**Full suite at `bd13818405c0e4630d8e7b5521ddaf85445d4c71`,** on AC with nothing else running: 811 tests, 808 passed, 3 skipped, 0 failed. Log `undo2-test.log`, `7e5e8515e2e58020a791bd395bd92bdec37118fb5761478d32844f42ee479ca8`. An earlier run at `cf19dae` with a reviewer active had 1 failure, `a service killed mid-render`, which timed out and passed 3 of 3 alone.

**Unsaved work and toolbar Undo.** With undo able to change documents, one person could strand unsaved work: a toolbar Undo left Studio showing the undone version, the next Save conflicted, and that state offers only Reload, which discards the strokes. A caption draft was dropped with a message saying the track changed elsewhere. Now an Undo, Redo or Restore in the service waits while a caption draft or unsaved strokes exist, says so, and changes nothing. A clean Studio canvas re-reads when the stored version moves, so it shows what is stored. A caption draft whose track has gone is dropped, so it cannot block Undo with no way to discard it. A failed Studio save offers a reload, so it cannot block Undo either, though that reload discards the strokes.

`npm run qualify:undo-unsaved` runs a caption draft against Undo and Restore, strokes against Undo, undo and redo of a first save keeping one document, and a stroke saved after an undo, in real Edge. It failed before the change, at a step not recorded. CI does not run it. It checks hashes, not pixels. **Not run:** a local undo of an uncommitted timeline edit, which still works by reading, and an orphaned draft or a failed save.

**Known limits, by reading:** a Redo landing just after an Undo's reload has read the list leaves a clean view on an empty session, and the next save creates a second Studio document; narrow, and no data is lost. The reload offered after a failed save discards strokes in one click, and its label does not say so. a stroke counts as unsaved only once its bitmap is dispatched, up to about 1.5 s after release, so an Undo in that window can reload the canvas and lose it; a stroke drawn while a Save is in flight can have its unsaved mark cleared, as before; a stroke during an in-flight Undo leads to a conflict. A timeline undo is also held back by an unrelated draft, which is over-cautious. The re-read costs one list call per revision. The Arabic text of the new message has had no native review (X-01). Cinema was not changed: by reading, nothing in the browser saves a `cinemaScene` document.

Studio and Cinema editors were not otherwise checked in a browser after an undo. The refusal under the rollback switch is tested for undo only; redo shares its path. `project.restore` still changes documents with the switch on, as it did before. LUT and Cinema saves share the path but have no sequence of their own. An actual rollback was not run.

Rollback: revert this change. Nothing is corrupted, by reading: older code undoes to a step's snapshot but keeps the head's documents, so an undo over a document step uses up a press and changes nothing, and a redo into a clip whose LUT is absent at the head is refused.

## Not done

- **Focus still falls to the page in one keyboard path:** a first edit in a Start field followed by Shift+Tab, because the previous row's Split button is disabled as the draft starts. A review saw this; it predates this change.
- **After a reload no track is selected,** so a user picks the track again. Left as it is.
- **Native Arabic judgment remains blocked on X-01.** The review packet exists at `docs/evidence/h1-arabic-review-packet`, and its caption fixtures parse by an existing test. No human has reviewed anything here. Direction was read from computed style, not judged by a reader of Arabic.
- Screen readers were not run. Focus was read from `document.activeElement`.
- Long text was checked only by `maxLength` and existing limits, not for layout.

## Full suite

At `5f253cb555b6f89053cca0e5afdac5546dde9171`, on AC power: 799 tests, 796 passed, 3 skipped, 0 failed. Log `s13c-test.log`, `fc9671d6f040be2783be0b8de48411173b5787309a900f37485f810dc498b3dd`.

Two earlier runs, at `be332c3` and `5f253cb`, had 8 and 14 failures on battery at high load, with 0.7 GB free in the first, taking 727 s and 855 s. Logs `s13-test.log`, `022f770e08955b2b5b05c2be55e25272cecd215151acc880a92aa26096ed2d3a`; `s13b-test.log`, `9a89f31b672ecf6e5fd8ab337dd43f63e86967a16d4abd13ac2ded569a0c2603`. They are not evidence about this change, and three of those tests passed alone during them. **So timed render tests in this suite fail on a loaded machine on battery**, which is a limit of the suite.

Rollback: revert this change. No stored data is affected.
