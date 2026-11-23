# The brief, the scene scripts and the shot intents in the story (MPR-106)

## What was found (step 0)

At `b8c9f3b`, by reading:

- `core/story.ts` has the fields in story format version 2 exactly as the card states them (MPR-101 shipped them as schema and validation): `brief`, `sceneText`, `intent` with `direction`, `textBytes` 98,304, `briefLanguages` 8, `storyTextBytes` and the refusal with both numbers. So the version 3 fallback is not used, and `core/story.ts` is not changed here.
- Nothing wrote or showed them. Create's draft was only in `localStorage`, and `addMadeVideo` wrote a made video's prompt to the shot's `notes`.
- `shot.notes` is read in one place, `madeRecords` in `src/create/create-story.ts`.
- A story commit ends the undo history (`commitDocument`, `tests/undo-across-documents.test.ts`).
- The browser's writers of a story are four: Create's made videos and its element pins (one save in `src/main.tsx`), the Director's Cinema placement, and now Create's offer and the Story page. One test covers that each keeps the words it does not set.
- FD-11 (how this work follows the in-flight Blender pull requests) is undecided. Pull request 279 is open and shares only `src/i18n.ts`, as added lines.

## Which story format holds the fields, and the room that is left

**Format version 2.** A version 1 story is read as before, and saving text into it stores version 2 with every scene, shot, take and record unchanged (tested).

A story with its whole text budget of 98,304 bytes used, by the test: **161,594 bytes are left for structure and takes with Latin text, 162,638 with Arabic**. The canonical form does not escape Arabic, so a byte of text costs about a byte. The number 96 KiB stays.

## What Create's offer does not bring in

The model and the seed. They are said, before the save, not to be kept; a made video's take record (MPR-101) holds them. The draft's direction choices become the intent's `direction`. The draft stays in the browser as Create's working text; nothing is deleted.

## How it was read where the card leaves room

- **The fifth intent field, `direction`,** is kept, as Create's choice ids. The Story page shows it in words and does not edit it; a choice no longer on the list is shown as it is. The reviewer accepts or removes it.
- **Fullness (OA-10)** is whole percents of the nearer of the two limits. The page counts the whole story as it would send it, without the hashes the service may add, so a story can be refused by the service a little before the page says 100; it is then said as too full.
- **A field is saved on its own.** What was typed is kept beside what the story said when the typing began. After a reload the typed text goes on top of the story as it now is, every other field is the other writer's, and where both changed the same field the page shows what the story says now.
- **Text typed for a scene or shot that is gone** is shown with the reason and is not saved.
- **Two props more than the card's:** `onReload` (the editor goes on from the project as it is) and `registerUnsaved` (an undo in the service is refused while text is unsaved, as for the other panels).
- **The marker and the offer are per browser.** Another browser with a draft of its own is asked too.
- **A draft is what the browser held when Create was opened.** What is typed after that is not a draft left behind until the next time.
- **A project with no story** shows a sentence and no form. Making an empty story from this page is not in the card.
- **A field's length** is held by the input itself; the languages are checked when Save is pressed.

## What to know when reading it

- A story full of text can refuse a new take (`story-refused`); the page's percent is how a person sees it coming.
- A made video's prompt may already hold the direction words that Create appended, so an intent can repeat them. It is stored as received.
- Shots made before this keep their prompt in `notes`; nothing moves it, and Create's list reads both.
- The Arabic words of the page are unreviewed.

## Evidence

- **Tests:** `tests/story-text.test.ts`, and the additions to `create-story`, `create-model` and `i18n`. The store, the commands and the schema are the real ones.
- **In real Edge on the founder host, against the real service:** see the section below. No model, no network and no spend.

## The real check

`npm run qualify:story-brief`, in real Edge on the founder host (Windows) against the real service: **PASS at `6b37670`**, with a clean checkout. Its receipt is `MPR-106-story-brief-receipt.json`, 13 steps: the offer (nothing sent until the person says so, refused against a story that moved on, kept once, "never"), the form in English and Arabic with the direction of each field, after a reload and in a fresh browser profile, a story changed elsewhere, and a story over its budget.

- **A nearly full story:** 93 percent; over by the paste: 103 percent, refused by the page in percents and by the service with its byte counts.
- **Typing in a 200-shot story with 100 shots shown:** 2.9 ms in the middle of 30 keys and 4.6 ms at worst, from the key to the page as redrawn (criterion 50 ms).

An earlier run at `782e1fe` failed: after a reload, a reading that had begun with the same revision could still compare with the story from before it, and say again that the story changed. The page was corrected, not the check, and five runs in a row passed after it.

The server step is in `npm run qualify:revisable-shot`, on GitHub's Linux machine: a take added to a shot keeps its intent, and a new intent keeps the take's record.

## Not covered

- The offer and the form in Arabic are only checked to turn the page right to left.
- The Story page is not driven with a screen reader.
