# SS-015: portable project and honest interchange loss

Builder: Claude Opus. Models and providers disabled, Plume deferred, limits frozen, spending zero, release NO-GO. **The card stays open.**

## What was wrong

- OTIO export and import existed only as a library. No command, browser control or agent could reach them.
- An export dropped titles, gain, fades, disabled sound, speed, animation, track states, scenes and documents, and said nothing.
- An import skipped OTIO transitions, nested stacks and anything else it did not read, and said nothing.
- Some malformed files crashed the reader with a raw error rather than being refused: a missing source range, a non-list of children, a time of the wrong shape.
- `HTTP://`, host paths and UNC paths were not marked as ignored addresses, though none was ever opened.

## What now holds

| Command                       | What it does                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yamakan.project.otioLosses`  | Before any conversion, lists what an export would not carry, in a fixed order, and the media it refers to by content hash and size                                                                                        |
| `yamakan.project.exportOtio`  | The OTIO JSON at the flick rate, with the same report. It holds no media and no host paths                                                                                                                                |
| `yamakan.project.proposeOtio` | A proposal against this project's media, changing nothing. Media matches by Yamakan asset id or content hash; no address in the file is opened, and what the file holds that the proposal leaves out is counted by schema |

All three read only, under `project:read`. A loss is either `dropped`, or `yamakanOnly` for effects and transitions, which travel as metadata that only Yamakan reads back. The existing JSON shape is unchanged; `ignored` is an added field of the proposal, and `remoteUrlIgnored` now means any address that is not Yamakan's own, where it meant only web and `file:` addresses. It stays false when a clip's metadata resolved the media, whatever its address says.

**What a proposal counts as left out:** transitions, clip, track and stack effects and markers, source ranges on tracks and stacks, a disabled clip, the timeline's global start, media references of other kinds, and non-track entries in a stack. **What it refuses rather than guess:** a track holding anything but clips, gaps and transitions, since later clips' places would be unknown, and a track kind other than Video or Audio.

**Size:** HTTP and MCP cap a request at 2 MiB, and a real oversize request gets `LIMIT_EXCEEDED`, so `proposeOtio` reads less through them than the 16 MiB its reader and catalog schema allow.

## Evidence

`tests/otio.test.ts` and `tests/otio-commands.test.ts`, the second against a real store and real media:

- At 30 fps and 24000/1001, an export proposed back gives the clip's exact start, duration and source start, resolves its media, and leaves the revision alone.
- The report is the same whatever order the project's lists are in, and matches between the two commands.
- Refused as validation errors: malformed JSON, a future schema, too deep, too large, wrong shapes, negative, fractional and unsafe times, a foreign rate, overflow through gaps and at a clip's end, a non-string address, a start that is not plain digits, invalid effects. A project's export is identical afterwards.
- The report's tests cover unused media, scenes, documents, animation and every track state.
- Nine address forms, including `HTTP://`, `FILE:`, drive, UNC, rooted and relative paths, stay unresolved and are marked ignored.

CI's `otio-oracle` job reads Yamakan's output with OpenTimelineIO itself; its fixture was not changed here.

## Not done

- **A proposal cannot be applied.** No command turns it into edits, so importing still ends at a report.
- **The browser shows none of this.** The card asks to return or display a report; this returns it.
- **Backup closure and restore,** the card's steps 3 and 4, were not qualified: originals, variants, stories, takes, references, captions and fonts used by a project, compared by hash and timing after a restore to a new root, and an interrupted restore. Existing tests in `tests/creative-recovery.test.ts` cover documents and objects, not this list.
- **Archive hazards:** there is no new archive parser, so traversal, symlink, bomb and name-collision cases belong to the backup path, and were not rerun here.
- A file written by another tool was not read here. An animation with no keys is reported as a loss, though it animates nothing.
- A proposal's transition names `fromClipId`, which the proposal has no way to resolve, and a LUT's document is not checked against the project. Both matter once a proposal can be applied.
- Effects near the 4,096-character metadata limit were not tried: an export could write one that its own import refuses.
