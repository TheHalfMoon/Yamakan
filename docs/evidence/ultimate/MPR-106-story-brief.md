# The brief, the scene scripts and the shot intents in the story (MPR-106)

## What was found (step 0)

At `b8c9f3b`, by reading:

- `core/story.ts` has the fields in story format version 2 exactly as the card states them (MPR-101 shipped them as schema and validation): `brief`, `sceneText`, `intent` with `direction`, `textBytes` 98,304, `briefLanguages` 8, `storyTextBytes` and the refusal with both numbers. So the version 3 fallback is not used, and `core/story.ts` is not changed here.
- Nothing wrote or showed them. Create's draft was only in `localStorage`, and `addMadeVideo` wrote a made video's prompt to the shot's `notes`.
- In `src` and `core`, `shot.notes` is read in one place, `madeRecords` in `src/create/create-story.ts`. A check read it too (`scripts/qualify-create-durable.mjs`), which the first search missed.
- A story commit ends the undo history (`commitDocument`, `tests/undo-across-documents.test.ts`).
- The browser's writers of a story are: Create's made videos and its element pins (one save in `src/main.tsx`), the Director's Cinema placement, and now Create's offer and the Story page, which share `src/story/save-story.ts`. One test covers that the first three keep the words they do not set; the last two write what `src/story/story-text.ts` builds, which has its own.
- FD-11 (how this work follows the in-flight Blender pull requests) is undecided. Pull request 279 is open and shares only `src/i18n.ts`, as added lines.

## Which story format holds the fields, and the room that is left

**Format version 2.** A version 1 story is read as before, and saving text into it stores version 2 with every scene, shot and take unchanged (tested on a stored version 1 story that holds a take; a version 1 story has no take records).

A story with its whole text budget of 98,304 bytes used, by the test: **161,594 bytes are left for structure and takes with Latin text, 162,638 with Arabic**. The canonical form does not escape Arabic, so a byte of text costs about a byte. The number 96 KiB stays.

## What Create's offer does not bring in

The model and the seed. They are said, before the save, not to be kept; a made video's take record (MPR-101) holds them. The draft's direction choices become the intent's `direction`. The draft stays in the browser as Create's working text; nothing is deleted. Whether there is a draft to offer is what the browser held when Create was opened; the text shown, and written, is the working text as it is now.

## How it was read where the card leaves room

- **The fifth intent field, `direction`,** is kept, as Create's choice ids. The Story page shows it in words and does not edit it; a choice no longer on the list is shown as it is. The reviewer accepts or removes it.
- **Fullness (OA-10)** is whole percents of the nearer of the two limits. The page counts the whole story as it would send it, without the hashes the service may add, so a story can be refused by the service a little before the page says 100; it is then said as too full.
- **A field is saved on its own.** What was typed is kept beside what the story said when the typing began. After a reload the typed text goes on top of the story as it now is, every other field is the other writer's, and where both changed the same field the page shows what the story says now.
- **Text typed for a scene or shot that is gone** is shown with the reason and is not saved, and a button discards what is not saved.
- **Two props more than the card's:** `onReload` (the editor goes on from the project as it is) and `registerUnsaved` (an undo in the service is refused while text is unsaved, as for the other panels).
- **The marker and the offer are per browser.** Another browser with a draft of its own is asked too.
- **Create's list of made videos** shows an older shot's notes, which stay what they were, and a newer shot's `intent.action`. The card's order is the action first; the notes come first here so that words kept for an older shot do not take its prompt's place. A newer shot's action can be edited, so the list no longer says that the receipt says it: it stands under "The shot's text", and the receipt's line names the model, seed and steps. What a video was really made with is in its take's record.
- **The offer saves through `src/story/save-story.ts`,** not through the page's older save for Create, which cannot say why a save was refused and goes on after an editor conflict. That older path, and its `reopenProject`, are unchanged; that they go on after a conflict and drop the editor's unapplied change is reported, not changed here.
- **A save whose answer is lost** is asked for again under the same request id; lost twice, the page says that it is not known and offers a reload.
- **A project with no story** shows a sentence and no form. Making an empty story from this page is not in the card.
- **A field's length** is held by the input itself; the languages are checked when Save is pressed.

## What to know when reading it

- A story full of text can refuse a new take (`story-refused`); the page's percent is how a person sees it coming.
- A made video's prompt may already hold the direction words that Create appended, so an intent can repeat them. It is stored as received.
- Shots made before this keep their prompt in `notes`; nothing moves it, and Create's list reads both.
- Typed text that is not saved is lost without a warning on a project switch or when the page is left or reloaded, as the card's "until you leave" allows. An undo, a redo or a restore waits for it.
- The conflict sentence is the card's; it also shows when only the project moved.
- The Arabic words of the page are unreviewed.

## Evidence

- **Tests:** `tests/story-text.test.ts`, and the additions to `create-story`, `create-model` and `i18n`. The store, the commands and the schema are the real ones.
- **In real Edge on the founder host, against the real service:** see the section below. No model, no network and no spend.

## The real check

`npm run qualify:story-brief`, in real Edge on the founder host (Windows) against the real service: **PASS at `9802ac4`**, with a clean checkout. Its receipt is `MPR-106-story-brief-receipt.json`, 18 steps: the offer (nothing sent until the person says so, refused against a story that moved on, kept once, "never"), the form in English and Arabic with the direction of each field, after a reload and in a fresh browser profile, a story changed elsewhere, two saves in a row with typing in between, an answer lost once and twice, Undo and a shot that is gone, two stories, and a story over its budget. It also runs on GitHub's Linux machine (`real-checks.yml`).

- **A nearly full story:** 93 percent; over by the paste: 103 percent, refused by the page in percents and by the service with its byte counts.
- **Typing in a 200-shot story with 100 shots shown:** 8 ms in the middle of 30 keys and 36.7 ms at worst, from the key to the page as redrawn (criterion 50 ms).

Two earlier runs failed and are kept in mind here. At `782e1fe`, after a reload, a reading that had begun with the same revision could still compare with the story from before it, and say again that the story changed: the page was corrected, not the check. On GitHub at `7d1efeb`, `qualify:create-durable` still read a made video's prompt from the shot's notes, the place this card moves it from; it now reads `intent` and that the notes are empty.

The server step is in `npm run qualify:revisable-shot`, on GitHub's Linux machine: a take added to a shot keeps its intent, and a new intent keeps the take's record.

## Not covered

- The offer and the form in Arabic are only checked to turn the page right to left.
- In the timing of 30 keys, only the first is checked to be drawn when its time is taken.
- A story taken out of the project while text is typed is not driven in the browser.
- The Story page is not driven with a screen reader.
