# The Create workspace

Part of issue #203.

**Without Kaggle set up it does not start a model:** the page says so and nothing in it offers to generate. **With `YAMAKAN_KAGGLE_CLI` and `YAMAKAN_KAGGLE_USERNAME` set, a person can start a real run from the page,** on their own private notebook, by the founder's decision "Yamakan drives Kaggle" (`docs/FOUNDER_DECISION_RECORD.md`). `ENGINE_ENABLED` and local recipes are unchanged: this route does not turn on any engine on this machine.

## Starting a real run

- Text to video only: the prompt and seed leave this computer, no media does. A person ticks that they agree, every run, and presses the button.
- The Kaggle CLI uses its own token. Yamakan never reads it, and passes the CLI fixed arguments; the prompt travels inside a file, as base64 of JSON, so it cannot become Python or a command.
- The notebook is asked to be private, with a 60-minute limit. Kaggle's own answer on privacy is read before a push to an existing notebook, and nothing is sent if it does not say private or cannot be read. A new notebook has no answer to read, and it is asked to be private. Kaggle's words for a missing notebook are the same as for a refusal, so after a restart a real refusal could be taken for a new notebook. After a push it is read again, and because the run is then already going, a bad answer warns beside the run rather than ending it. A notebook still running is not replaced. Kaggle keeps each prompt in the notebook's history, and the page says so.
- Kaggle's latest output could be another run's, so a result counts only if its receipt names this run, passed its own checks, and matches the video's hash.
- **Yamakan cannot stop a run on Kaggle.** The CLI has no such command, and the SDK's call needs a session ID the public interface does not give, tried on 2026-11-06. So the page offers Stop following, says the run goes on using quota, and links to its notebook.
- **A restart loses a run in progress.** The page says so and links to the notebook, but that run's video cannot then be brought in from here.
- A status is what Kaggle says. There is no percentage, because it gives none; only the time so far.

- After a run, only its video stays on this computer, in a temporary folder; its script is removed once pushed. Folders over a day old are removed the next time a service first uses Kaggle, not on a timer.
- Only a model with its own tested run from the page is offered: Wan2.2-TI2V-5B. CogVideoX-2b says it has not been tested from this page.

`npm run qualify:kaggle` ran this for real, through export. Its receipt, `kaggle-page-run-receipt.json`, names the commit it ran at. Failure-path changes after that commit were tested with the stand-in only. The engine's failure, wrong-run, privacy and unknown-run paths are tested with a stand-in for Kaggle in `tests/kaggle-engine.test.ts`. **The panel itself is exercised only by that one successful real run:** its failure, Stop following and restart screens have not been run in a browser. How long a stale status lasts on Kaggle is assumed to be under three minutes, not measured. After Stop following, a new run is refused until Kaggle says the old one ended: up to its 60-minute limit, about 19 minutes for a normal run. A first run on a new notebook was not exercised on real Kaggle; what Kaggle says of a missing notebook was.

## What works now

`npm run qualify:create`, real Edge against the real service, by the interface unless noted:

- Write a shot and choose a model and seed. Shot, movement, lens and light add words to the prompt, and the exact text a model would be given is shown. The page says these are only words: neither model has camera settings, and it may not follow them.
- A shot being written stays across a reload, per project, in this browser's storage: it does not move with a backup and is lost if site data is cleared. **A made video's record is kept in the project,** as a shot and take in a story titled "Made in Create", so it survives a cleared browser and goes with a backup. It holds what the receipt said, as the receipt's claims. The page calls it the project's record, because a story can be written by hand: it is not proof. Saving it is a new revision, as any story save is, and ends undo past that point.
- Bring a video in, with its run receipt. A video that is not the receipt's file, a receipt from a run that did not finish or did not pass its own checks, and a video over 512 MiB with a receipt, are refused and nothing is imported. **A match shows only that the file is the one the receipt describes.** Anyone can write a receipt, so its model, seed and prompt are its claims.
- Add it to the timeline, open it in Edit, and export with the toolbar's button: a decodable H.264 file.
- A file converted to a constant frame rate on the way in says its original matched the receipt, not this copy. A placed video keeps its whole length, where a clip placed from the media list stops at 5 seconds.
- Keyboard: the panel's main controls are reached by Tab, model before bring-in. Every field has a name. No sideways scroll at 390 px. Arabic lays out right to left. **The Arabic wording has had no native review.**

The check's default video is a test pattern with a receipt written by the check, so it qualifies the path and is not AI output. The check takes a real video and receipt as arguments. Its screenshots were looked at by the builder; **no pixel comparison against a saved baseline exists yet.**

## Not done

Image-to-video; stopping a run on Kaggle; following a run across a restart; CogVideoX started from the page, whose script took the same change but was not run this way; reference images and reusable elements in this workspace; refusing a placement on a locked track is written but not exercised by the check; a person's check of how this reads and feels.

Model facts on the page are what has been run: sizes, frames, rates and times, not everything each model can do. CogVideoX's are from `first-ai-video.md`; Wan's 19 minutes is a real run from the page; the runs took 19 to 20.

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
