# SS-014: keyboard and pointer edit equivalence

Started 2026-11-05 (Asia/Riyadh). Builder Claude Opus. Base main `22d7bb6e61877070c5d948a6dae0f40cc2039bf0`. **The card stays open:** reference frames were not compared across the copies, and a crossfade cannot be dragged on the timeline.

## What was found

The card asks that equivalent keyboard and pointer sequences give identical results. **That could not hold, because the timeline had no keyboard way to trim or move a clip, and a clip could not take keyboard focus.** The toolbar also advertised `N` for snapping with nothing behind it. In the browser code, a search finds no control that sets a crossfade; `src/edit-diff.ts` only carries one.

## Change

`src/editor/components/Timeline.tsx` keeps the pointer's trim and move logic, moved into two functions both inputs call, so the guards are shared: neighbours, source length, the minimum clip length and track collisions. With focus in the timeline and a clip selected:

| Keys          | Effect                                                              |
| ------------- | ------------------------------------------------------------------- |
| `Shift+Arrow` | Trim the end by one frame                                           |
| `,` and `.`   | Trim the start by one frame                                         |
| `Alt+Arrow`   | Move by one frame                                                   |
| `[` and `]`   | Trim the start or end to the playhead, as a pointer snap to it does |
| `N`           | Snapping on or off                                                  |

Clips take focus by Tab, and focusing one selects it. The keys are matched by physical key, so they work on an Arabic layout, and time runs left to right in every language. A step is one project frame, passed as a new `frameSeconds` prop. No command, schema or stored format changed. **The `aria-label` on a clip, "Clip" and its name, is English only.**

## Results

`npm run qualify:edit-equivalence` drives real Edge against the real service, on two copies of a project with the same clip ids, at 30 fps and at 24000/1001. The pointer copy uses real mouse drags at about 3 pixels per frame; the keyboard copy uses keys.

| Edit                                                     | Result on both copies                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| A's end to B's start, by snap, or `]` at that edit point | A is 150 frames                                                         |
| B's end 7 frames shorter, snapping off                   | B loses 7 frames                                                        |
| B moved 11 frames later                                  | B moves 11 frames                                                       |
| B's start 5 frames later                                 | B starts at 166, is 78 frames, and its source frame moves from 30 to 35 |

Canonical `startFrame`, `durationFrames` and `sourceFrame` match exactly at both rates. Undo, redo and a reopen keep the result on the keyboard's copy. A reopen was read through the service, not from the editor's own display. A locked track refuses both inputs, and the same keys do change an unlocked one. The keys do nothing with focus on a tab or in another workspace, and `]` does nothing with the playhead before the clip. `N` was checked by the toolbar's title changing.

**Pointer precision has a limit.** A drag is pixels turned into seconds, then rounded to a frame, so it matches only where a frame is more than a pixel. At the default zoom one frame was under a pixel here, so a pointer cannot reach every frame there, and the keyboard can.

## Crossfade

A person could not set a crossfade in the browser at all. The clip inspector now has one: with a clip selected on a video track that starts where another ends, a length in frames, **Set dissolve**, and **Remove dissolve**. It uses the same `clip.setTransition` operation and rules as `yamakan.transition.set`, with `audio: "equalPower"` always, so no audio choice is offered. The timeline shows the length on the clip, in its own marker, since a clip's label hides at narrow widths; the qualifier caught that.

`npm run qualify:crossfade`, real Edge against the real service, on two copies with the same clip ids, at 30 fps and 24000/1001:

| Step                                                             | Result                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set a 24-frame dissolve by mouse, and by keyboard                | Identical canonical clips, including the transition; the marker shows `24f`                                                                             |
| Real export, frames decoded to one pixel, the same at both rates | `253,0,0` before the cut, `189,1,62` a quarter in, `127,0,125` at it, `64,2,191` a quarter out, `0,0,253` after; 120 frames, so the length is unchanged |
| Undo, redo, a reopen, removal                                    | All hold, and the marker follows                                                                                                                        |
| An odd or empty length                                           | Refused with the reason on screen, and nothing stored                                                                                                   |
| Removing or setting one on a locked track                        | Refused at once, naming the lock, and nothing stored                                                                                                    |
| A clip with nothing before it                                    | Offers no dissolve                                                                                                                                      |

A review found that an edit breaking a dissolve was not refused when made, and led to a dead end with a false "kept as a draft" message, and that a duplicate copied the transition. Both are fixed: such an edit is refused at once, naming the reason, a duplicate follows nothing, and Remove works even when the dissolve no longer draws. A second review found that this fix let Remove skip the track lock, bringing the dead end back, and that the frame checks would have passed most other lengths, down to 2 frames. Remove now refuses a locked track, and the export is checked at frames 47, 54, 60, 66 and 72, with the fading colour within 3 of a quarter at frames 54 and 66. Scaled from the measured values, a 22- or 26-frame dissolve falls outside that; neither was exported.

In this qualifier, "by mouse" selects the clip with a programmatic focus and only clicks **Set dissolve**. Both paths run the same handler, so their equality shows little beyond that. Reaching the panel from the timeline by Tab, equal-power audio, and the canvas preview, which shows a cut and says so, were not run.

**Not done for crossfade:** it cannot be dragged on the timeline, as the card's "pointer" sequence might mean; pointer here is clicking the inspector. Too long a dissolve for the source was not run in the browser, though the operation refuses it by its existing tests. The Arabic text has had no native review (X-01). The reference preview was not compared at the cut here; existing tests in `tests/transitions.test.ts` cover its parity with export. The timeline stretches a clip shorter than half a second whenever its track is edited, older behaviour that, next to a dissolve without enough source, now refuses every edit on that track until the dissolve is removed; found by reading, not run.

## Not done

- **Reference frames were not compared across the copies.** Equal canonical values should compile to the same plan, but that was not run for this card. Existing tests cover preview and export parity in general.
- Zero length, overlaps and VFR were covered only through the shared guards. Concurrent revisions were not run here.
- `core/timeline/snapping.ts` holds integer-tick snapping, but this timeline snaps in floating seconds by pixels, as it did before. Rounding hides that in the cases above; replacing it was not attempted.
- Trim modes other than normal have no keyboard path. The main editor passes `trimMode="normal"`, so they are not reachable there either.
- **The timeline jumps when the reference preview finishes rendering.** It moved about 690 px down in this qualifier, between measuring a clip and pressing on it, so a real press could land on the preview. The qualifier was flaky until it waited for the clip to be under the pointer. No drag was lost, but the jump itself is a real, open usability defect.
- Screen readers were not run. CI does not run this qualifier.

## Independent review

By reading only. It confirmed the pointer's behaviour was preserved line for line. It found a blocker, fixed above: the keys edited clips while the timeline was hidden in another workspace, because panels stay mounted. It also found `]` collapsing a clip with the playhead outside it, the keys dying after a click on the ruler, a test of `N` that could not fail, and a claim that `Alt+Arrow` stays on the page which the qualifier could not show; that claim is removed. Start trim moved off `Alt+Shift`, which switches the keyboard language on Windows.

**Left as it is:** a move to the right pushes the next clip and those after it, and any edit stretches a clip under 0.5 s on that track, both as the pointer does, so one press is not always one frame there. Every clip is a Tab stop, its `aria-label` has no time or track and sits on a div with no role. `Alt+ArrowLeft` in a real browser was not tested by hand: with focus away from the timeline, or no clip selected, the handler does not stop it from going back. Older `Ctrl+V`, `Ctrl+X` and `Ctrl+D` still fire with the timeline hidden.

Rollback: revert this change. No stored data is affected.
