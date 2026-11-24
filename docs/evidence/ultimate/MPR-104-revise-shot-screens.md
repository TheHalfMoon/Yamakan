# A story's shots as cards (MPR-104)

**Part a only:** the cards, the take stack, how a take was made, what was tried, and the way to the take review. Part b (Create: the revise banner, the target of a run, `shot-revise`, `create-revise`) is not here, so a revision cannot be started from a card yet and the card stays open.

## What was found (step 0)

At `e2ffb4a`, by reading:

- No `ShotCards`, no `shot-revise` or `create-revise` test id, and `GeneratePanel` has no `target`. `src/story` exists since MPR-106 and is already in the `lint` script.
- MPR-102, MPR-103 and SS-006 are verified.
- **FD-11** is undecided. Its condition is that the Blender pull requests in flight that touch `src/create` and `src/main.tsx` merge first. One is open, pull request 279; of the files here it touches `src/i18n.ts` only, as added lines.
- `TakeReview` shows every story of the project and a row for each take, so `focusShot` needs no change of what it shows: the shot's rows are found by document and shot, and the first with a button gives it the focus.

## How it was read where the card leaves room

- **`shot-review`** opens the Director's section and moves the focus to the first `take-review-open` of the shot; the person opens it. Nothing is proposed or applied on the way. When no take of the shot can be reviewed, its first row takes the focus instead, and else the review itself.
- **A shot with no take** shows that it has none, its review button and what was tried. `shot-revise` is part b's.
- **"not known"** is said for anything the service did not give or that is not well formed, and never as zero: a time, the allowance used (which no route reports today), a take's record, or the whole list. An answer that is not well formed shows no card from it.
- **The level** is the record's origin: L1 for a generation, L3 for a render, L0 otherwise and for an origin the page does not know.
- **The prompt** is on no card.
- **The attempts** are the history as it was when it was opened; a project that moved on reads it again from the first page.
- **The details of the Director's section** are now held by the page (`open` with `onToggle`), so that a card can open it. A person's own click works as before.

## What to know when reading it

- `yamakan.take.list` is asked for once per story and revision by the cards, and once more by the take review beside them, as before.
- The Arabic words are unreviewed.
- SS-011 is to reuse the intent setter of part b; part a adds nothing under `src/editor`.

## Evidence

- **Tests:** `tests/shot-cards.test.ts`, over what the commands answer, and `tests/i18n.test.ts`.
- **In real Edge on the founder host (Windows), against the real service:** `npm run qualify:revise-shot-screens`. Its receipt, `MPR-104-revise-shot-screens-receipt.json`, names the commit and says that the checkout was clean. Once in English and once in Arabic, by the keyboard alone from the tab to the review: the cards and the take the cut shows; arrows, Home and End; a take's record read only when it is opened; Escape; what was tried, with one that failed and one refused before it was sent and dismissed, the gaps, and the use that is not known; 375 pixels with no sideways scroll; the review, where a take is applied, shown on its card, and undone; and 200 cards of 8 takes with no request of their own. The undo is the command, not a button. No engine, no model, no network and no spend.
- **The stand-ins:** the workspace's videos are rows and ten bytes that no decoder is asked about, and its runs are rows of the job table written by the real ledger. So this says nothing of a run or of a video, which part b's flow drives.

Three runs failed before that while the founder's computer was busy: once its opening was aborted, twice there was no session inside Playwright's 30 seconds. Why is not known for certain; the same steps passed once the check waited for up to 120 seconds and the computer was less busy.

## Not covered

- Part b, and with it the criteria that name Create.
- A render (Blender) take on a card is in the unit tests only.
- A history of more than one page is in the unit tests only.
- No screen reader was used.
