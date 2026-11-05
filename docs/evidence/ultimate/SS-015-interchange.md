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

**What a proposal counts as left out:** transitions, clip, track and stack effects and markers, source ranges on tracks and stacks, a disabled clip or track, the timeline's global start, media references of other kinds, and non-track entries in a stack. **What it refuses rather than guess:** a track holding anything but `Clip.1`, `Gap.1` and `Transition.1`, since later clips' places would be unknown, and a track kind other than Video or Audio.

**Size:** HTTP and MCP cap a request at 2 MiB, and a real oversize request gets `LIMIT_EXCEEDED`, so `proposeOtio` reads less through them than the 16 MiB its reader and catalog schema allow.

## Evidence

`tests/otio.test.ts` and `tests/otio-commands.test.ts`, the second against a real store and real media:

- At 30 fps and 24000/1001, an export proposed back gives the clip's exact start, duration and source start, resolves its media, and leaves the revision alone.
- The report is the same whatever order the project's lists are in, and matches between the two commands.
- Refused as validation errors: malformed JSON, a future schema, too deep, too large, wrong shapes, negative, fractional and unsafe times, a foreign rate, overflow through gaps and at a clip's end, a non-string address, a start that is not plain digits, invalid effects. A project's export is identical afterwards.
- The report's tests cover unused media, scenes, documents, animation and every track state.
- Nine address forms, including `HTTP://`, `FILE:`, drive, UNC, rooted and relative paths, stay unresolved and are marked ignored.

CI's `otio-oracle` job reads Yamakan's output with OpenTimelineIO itself; its fixture was not changed here.

## Restore to a new root

`tests/portable-closure.test.ts`, with a real store, real media, and a project at 24000/1001 holding two videos, a story with takes of both, captions, a LUT and a clip:

- The backup reports its creative scope complete with no gaps, and the restore finds all three documents.
- From the new root, the canonical project is byte-identical, every document has the same hash and bytes, the clip's start, duration and source start are exact, each video's file hashes to its asset hash, and an OTIO export is the same file.
- A backup with a truncated database is refused, and leaves no restored folder. The original's files and project are unchanged, and the same backup restores once the database is put back.

This found no defect in the backup path; it is qualification of what `core/recovery.ts` already did.

The original's unchanged state holds largely by construction, since a restore is never given its path, and the OTIO comparison follows from the canonical one. The evidence that matters is the restored root's own bytes.

**Fonts** are not project data: titles and burned-in captions use fonts pinned in the build, and so does Studio text. A saved canvas can name a `fontRef` by content hash, which the backup does not treat as a dependency; no runtime in the app was found that loads such a face, but whether anything can write one was not checked.

## Restore in the real browser

`npm run qualify:browser-restore`, real Edge against the real service. The project is at 24000/1001, with footage, a variable-rate clip converted on import, a reference pack and a clip.

| Step                                                | Result                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| **Back up now**, then **Restore to a new folder**   | Both work from the browser's own controls, and the message names the folder |
| Yamakan started on that folder, as the message says | Starts, and the project opens in the browser                                |
| The project there                                   | Canonical bytes identical; the converted asset and the pack are present     |
| An edit made there with the keyboard                | Holds                                                                       |
| A real export there                                 | Completes and decodes, last frame red                                       |
| The original                                        | Its `projects` folder is unchanged by hash, and no page errors              |

**A restore killed partway found a real defect, now fixed.** A process killed while copying left a folder that opened as a normal workspace with zero or one projects and no warning, so a person following the message could believe their work was gone, or work in a broken copy. A restore now marks its folder `restore.unfinished` first and clears the mark last, and `restore.json` is what commits it. A marked folder without that file refuses to open, and Yamakan exits saying so and naming the folder. On a failed restore the mark goes last, and only with nothing else left.

Kills are timed from the folder appearing. The qualifier fails unless Yamakan itself, started on a folder holding more than the mark, refuses it. An earlier version of this check used fixed delays and landed no kill during a copy at all, so it proved nothing. The original's project files and canonical project were unchanged afterwards, and the same backup restored.

## Not done

- **A proposal cannot be applied.** No command turns it into edits, so importing still ends at a report.
- **The browser shows no OTIO view.** The card asks to return or display a report; this returns it.
- **Not checked through a restore:** an export variant, and an asset's hidden original compared by hash: the browser run shows a converted asset and a pack present, but did not decode the converted asset or re-check the pack against its media. Exports are left out of backups by design, and proxies are not backed up and are rebuilt only on request; neither was exercised. Revoked consent through a restore is covered in `tests/creative-recovery.test.ts` for Director encodings, not for the pack gate, whose receipt sets the new epoch directly rather than by a real restore.
- **A restore killed partway** leaves its unfinished folder for a person to delete; nothing removes it. A kill in the moment before the mark is written leaves an empty folder, which would open as a new empty workspace; a person could still be misled, though it holds nothing. Power loss was not tried, and the mark is not flushed to disk. `diagnoseWorkspace` does not report the mark. Windows locks during cleanup were reasoned about, not provoked.
- **Archive hazards:** there is no new archive parser, so traversal, symlink, bomb and name-collision cases belong to the backup path, and were not rerun here.
- **A file written by another tool is, in practice, refused.** The reader takes `Clip.1` at the flick rate only. As far as recalled, and not checked here, current OpenTimelineIO writes `Clip.2`, so even a Yamakan export re-saved through it is refused, naming the schema. The refusal is honest, but this is Yamakan's own round trip, not interchange with other editors yet. CI's oracle only reads Yamakan's output with OpenTimelineIO; nothing feeds its output back.
- An animation with no keys is reported as a loss, though it animates nothing.
- A proposal's transition names `fromClipId`, which the proposal has no way to resolve, and a LUT's document is not checked against the project. Both matter once a proposal can be applied.
- A timeline with no usable `tracks` gives an empty proposal rather than a refusal, and a gap's effects or markers are not counted.
- Effects near the 4,096-character metadata limit were not tried: an export could write one that its own import refuses.
