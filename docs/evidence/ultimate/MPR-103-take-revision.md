# A take's request read back, and what a revision changed (MPR-103)

## What was found (step 0)

At `6e0b5b6`, by reading: no `yamakan.take.revisionDraft`, no `derivedFromTakeId` on `yamakan.generation.start`, and every builder of a take's record writes an empty `changedFields`. MPR-101 and MPR-102 are merged. Also:

- `core/shot-history.ts` (MPR-107) read a run's base from `derivedFromTakeId` at the top of its row, which nothing wrote. This card keeps it in `derivedFrom`, so it is read there now.
- A record is also built when a person saves a run's video as a take by hand (`yamakan.story.save`). It goes through the same function, so a revision put on a shot that way says the same.
- Records are kept for their story and not pruned, so the base's record is readable after the take is taken out.

## Every check

| Field | State | Message |
|---|---|---|
| `route` | `ok` | Models can be started here. |
| `route` | `unavailable` | The engine's own reason, the one a start is refused with ("Engines are off in this build.", "No qualified recipe is pinned in this build.", "No local engine is configured for this service."). |
| `route` | `unavailable` | No model is offered here. |
| `recipe` | `ok` | This model is offered with the same run script. |
| `recipe` | `changed` | The model's run script changed since this take; the same request may give a different result. |
| `recipe` | `unavailable` | This model is no longer offered here. |
| `recipe` | `unavailable` | This model no longer makes a video from a request of this kind. |
| `recipe` | `unknown` | This take's record names no model set up here. |
| `recipe` | `unknown` | Nothing can be started here, so whether this model is offered is not known. |
| `model` | `ok` | The model is the same version. |
| `model` | `changed` | The model's version changed since this take; the same request may give a different result. |
| `model` | `unknown` | Whether the model is the same version is not known. |
| `prompt` | `ok` | The prompt was kept. |
| `prompt` | `ok` | This take was made without a prompt. |
| `prompt` | `unknown` | Only a hash of this take's prompt was kept, and its words were not found. |
| `seed` | `ok` | The seed was kept. |
| `seed` | `unknown` | This take has no recorded seed; a repeat may differ. |
| `width`, `height` | `ok` | This model makes this width (height). |
| `width`, `height` | `changed` | The width (height) this model makes is now N pixels; this take was asked for M. |
| `durationFrames` | `ok` | This model makes this length. |
| `durationFrames` | `changed` | The length this model makes is now N frames of this project; this take was asked for M. |
| `width`, `height`, `durationFrames` | `unknown` | The width (height, length) this model makes is not known here. |
| `width`, `height`, `durationFrames` | `unknown` | This take's record holds no width (height, length). |
| `firstFrame` | `ok` | The still this take started from is in the project. |
| `firstFrame` | `unavailable` | The still this take started from is no longer in the project. |
| `firstFrame` | `unknown` | This take's record does not say which still it started from. |

`firstFrame` is given for a take that started from a still, and the others for every draft. Without a draft there are none, and `reason` says why: "This take has no generation record." or "This take was rendered with Blender; revise it from its shot direction."

## Where this differs from the card

- **"A repeat may differ", not "will",** for a take without a seed: a Kaggle run that was sent none uses one that its brief fixes, so "will" is not true of it. The card says so now.
- **The refusals of a wrong base are tested in `tests/take-revision.test.ts`,** not in `tests/generation-service.test.ts`, whose media this host cannot import. `tests/parity.test.ts` needed no change; the qualification makes the call over REST and over MCP.
- **A `route` with nothing to offer** is `unavailable` with "No model is offered here.", which the card now has.
- **One refusal more:** `revisionNote` without `derivedFromTakeId` is refused with "A revision note is of a run that revises a take."
- **The length is compared as the page asks for it:** the model's own seconds at this project's frame rate, in whole frames.
- **Changed and not listed by the card before:** `core/take-record.ts` (its steps name it), `core/shot-history.ts`, `tests/shot-history.test.ts`, `scripts/qualify-revisable-shot.mjs` (its qualification names it) and `docs/OPERATIONAL_CONTRACTS.md`, which its list now has, and `.github/workflows/real-checks.yml`, for one more receipt.
- **A record saved by hand from a run whose base cannot be read is refused** (`RECOVERY_REQUIRED`), since no answer of a save could say that what changed is not known; the take can be saved without a record. The card speaks of the import only.
- **What a run's row keeps of its base is read by its form.** One that is not of it (a damaged or made-up row) comes in as a take that revises none, and the answer's `notice` says so.

## What to know when reading it

- **A revision is a new generation.** The same request is not promised to give the same picture: whether these models repeat themselves was not verified.
- **`startable` is not a promise.** It is only that nothing here is missing: an approval (MPR-204), a consent to send, a busy notebook, a full shot or the engine's own limits are asked when a run is started. A Kaggle model refuses a size that is not its own, so a draft with a `changed` size has to be started at the present one.
- **Empty `changedFields` beside a base is an exact repeat,** except where the import's `notice` said that the base's record could not be read: then it is not known. The notice is in the import's answer (also when the same run is brought in again after a stop: there a base damaged since then makes it say so of a real repeat too) and on the run's row, not in the record.
- **A damaged record of a take that is still in the shot refuses the import's take** (`story-refused`), as MPR-102 does, before any base is read.
- **Where one record says a value and the other does not** (a script changed between a start and its import, so its frame rate is not known), that field counts as changed.
- **The draft holds the prompt's words,** which a reader with `project:read` can read with the record. Those in a run's row come only with a record that holds their hash.
- **The check on ComfyUI** knows no size or length, so those are `unknown` there.

## Evidence

- **On the founder host, against the real store, job table and commands:** the 15 tests of `tests/take-revision.test.ts` pass. The engine is a double and its videos are the project's as rows and ten bytes.
- **`npm run qualify:revisable-shot`** has a revision arm. It needs ffmpeg through the native helpers, which the founder host's sandbox does not start (ledger 12): there it stopped at its first import, before this arm. See the next section. Its stand-in engine gives a test pattern that does not follow the request: it proves the record and the flow, not that a model follows a changed seed or prompt. No model, no network and no quota was used.

## The real check

`npm run qualify:revisable-shot` ran on GitHub's Linux machine: **PASS at `bdafd6c`** (run 45282798893, `ubuntu-24.04`, no sandbox), with the MPR-101, MPR-102 and MPR-107 steps before and around it. Its receipt is `MPR-103-take-revision-receipt.json`. It is not evidence of the founder host.

**The stand-in engine does not vary its output with the request.** The base take's video and the revision's are two test patterns that the check chose, and nothing in either is AI output. So this proves what is recorded and how a revision is placed and taken back, not that a model follows a changed seed or prompt.

| What | Value |
|---|---|
| Base record | `d9a99f76f61c367dfa7d3d486b3263c676c908a3a84efcd8a94ef78f306bd67b` |
| Draft | recipe `qualify-pattern`, seed 7, 704x480, 60 frames, the prompt; complete and startable |
| Record of the run with seed 8 | `d20a7d25cffe837fdb7b744e52a4e158f24db3169331638c290d55ca38eb5c1b`, `changedFields` `["seed"]`, with its note |
| Record of the run as it was | `d94479a6fdcda24c5e707191058fce2a929230ff8f4b8c5a91406494f020897e`, `changedFields` `[]` |
| Placing it | revision 34 to 35, one revision |
| Undo | revision 36, the base take shown again |
| A service with no engine | the same draft over REST and over MCP, `route` unavailable ("Engines are off in this build."), not startable |
