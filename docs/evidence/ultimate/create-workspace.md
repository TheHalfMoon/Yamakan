# The Create workspace

First slice of issue #203. **It does not start a model.** Generation inside Yamakan is still off, and while it is off this workspace says so and nothing in it offers to generate.

## What works now

`npm run qualify:create`, real Edge against the real service, by the interface unless noted:

- Write a shot and choose a model and seed. Shot, movement, lens and light add words to the prompt, and the exact text a model would be given is shown. The page says these are only words: neither model has camera settings, and it may not follow them.
- The shot stays across a reload, per project. **It is kept in this browser's storage, not in the project,** so it does not move with a backup and is lost if site data is cleared.
- Bring a video in, with its run receipt. A video that is not the receipt's file, a receipt from a run that did not finish or did not pass its own checks, and a video over 512 MiB with a receipt, are refused and nothing is imported. **A match shows only that the file is the one the receipt describes.** Anyone can write a receipt, so its model, seed and prompt are its claims.
- Add it to the timeline, open it in Edit, and export with the toolbar's button: a decodable H.264 file.
- A file converted to a constant frame rate on the way in says its original matched the receipt, not this copy. A placed video keeps its whole length.
- Keyboard: the panel's main controls are reached by Tab, model before bring-in. Every field has a name. No sideways scroll at 390 px. Arabic lays out right to left. **The Arabic wording has had no native review.**

The check's default video is a test pattern with a receipt written by the check, so it qualifies the path and is not AI output. The check takes a real video and receipt as arguments. Its screenshots were looked at by the builder; **no pixel comparison against a saved baseline exists yet.**

## Not done

Starting, following or cancelling a generation from here; image-to-video; reference images and reusable elements in this workspace; a receipt kept with the project rather than in this browser, and it is not recorded as lineage; refusing a placement on a locked track is written but not exercised by the check; a person's check of how this reads and feels.

Model facts on the page are what has been run, from `first-ai-video.md`: sizes, frames, rates and times, not everything each model can do.

## What was studied

Higgsfield, signed out, 2026-11-06. Nothing was signed into, generated or paid for, and no optional cookies were accepted. Its code, copy, assets and brand are not in Yamakan; screenshots stay outside this repository.

**Seen, on public pages, with Craft Anything 0.3.0 in clean-room mode and then the app's built-in browser, because the tool's scripted walkthrough is not offered in clean-room mode:**

- Generation pages are one composer: a prompt with a row of controls showing their current value, including model, resolution, ratio, length and count.
- Above Cinema Studio's prompt, chips for references with a counter, film setup, camera, colour palette and lighting, each showing "Auto" by default.
- Generate shows its price on the button, before anyone signs in.
- Film setup opens a panel with Genre, Era and Tempo sections.
- The Camera chip opens a sign-in screen, so that is where this stopped.

**Not seen:** the Camera panel; Era and Tempo's contents; the model list; a generation's progress, failure or result; the editor; export. Anything said about those would be assumption. Keyboard behaviour was not tested there.

**What Yamakan took from this:** the idea that a person should see every setting's current value beside the prompt, and the cost before they commit. Yamakan's cost is time on a free GPU. It did not take the look, and no control here claims more than adding words to a prompt.
