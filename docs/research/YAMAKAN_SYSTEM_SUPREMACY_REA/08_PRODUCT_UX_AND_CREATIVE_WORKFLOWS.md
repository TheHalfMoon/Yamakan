# Product workflows and interaction acceptance

The product should feel like one application with one project selection, history and recovery path. Story, Edit, Cinema, Studio, Audio, Director and Finish are views of that project. Keep implementation details out of ordinary creator flows; expose precise controls when they help editing.

## Model-free acceptance journey

| Step | Creator action                                                          | Required visible result and evidence                                               |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | Open/create a project and enter a brief                                 | Project identity and saved brief survive navigation/reopen                         |
| 2    | Import real video, still and audio assets                               | Reliable progress, thumbnails/proxies, timing/availability and actionable errors   |
| 3    | Build/review storyboard and organize scenes/characters/references/takes | Versioned story documents; approve/revise without losing selected assets           |
| 4    | Assemble three shots                                                    | Frame-accurate multitrack editing and consistent preview; keyboard access          |
| 5    | Add a crossfade, captions, sound and a supported effect                 | Actual decoded export matches boundaries, timing and supported preview             |
| 6    | Review an agent proposal                                                | Clear affected shots and before/after; approve/reject/revise are human actions     |
| 7    | Export, then change only the middle shot                                | New output; unaffected shots/audio/captions and history remain intact              |
| 8    | Undo/redo, save and interrupt the owned process                         | Durable committed edits survive; unfinished work is clearly recoverable            |
| 9    | Reopen/reconcile and export again                                       | Current project/attempt history is correct; no duplicate mutation or leaked worker |
| 10   | Navigate Story/Edit/Cinema/Studio/Finish                                | Same selected project, meaningful context, no disconnected save state              |

SS-004a supplies part of the command evidence. SS-004b is the required integrated browser, crossfade and forced-interruption receipt. Separate older crash tests do not by themselves prove this whole sequence.

## Bounded interaction improvements

SS-011 adds take compare/replace to the editor around the already verified take contract. Show the source/reference identity, expected changed region and reversible action. Prevent stale selection or consent changes from applying unnoticed.

SS-012/013 expose audio and caption workflows with precise time values, waveform/cue selection and undo. SS-014 improves timeline gestures/keyboard precision using established editor research; evaluate snapping, trim/split/ripple rules, locked tracks, focus and drag/drop with actual users/tasks before expanding modes.

SS-007 presents honest agent/job progress: what changed, what awaits review, what failed and what can resume. An error names a repair action without exposing raw paths, database rows or filtergraphs.

## Interaction test matrix

- Keyboard-only import, navigation, timeline selection, proposal review, export and recovery; visible focus and no traps.
- English and Arabic layout, mixed-script asset/title text, bidi isolation, long names, empty/error/loading states and narrow panels.
- Pointer drag/drop plus keyboard equivalent, locked tracks and precise rational-time entry.
- Wrong-project navigation, stale proposals and two-writer conflict with preservation of unsaved user intent.
- Cancellation, missing/relinked media, low disk, worker failure, restore and long-session responsiveness.
- Screen-reader names and status announcements, reduced motion, readable contrast and predictable focus after dialogs.

Automated RTL/layout assertions complement native Arabic review; they do not close H1. Avoid competitor visual cloning. Record completion time, error/recovery rate and task outcome for usability studies; no invented preference scores.

Multicam, HDR, advanced compositing, audio buses and generalized motion graphics need R-01/R-03 findings and appended bounded task cards if justified. Their absence is explicit; no “professional parity” marketing claim follows from this roadmap.
