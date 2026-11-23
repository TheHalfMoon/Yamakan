# MPR-206: the engine operations, and the conformance kit

Part a: the five operations written down, the kit, the in-process fake run through it, and the intake checklist. The three real adapters are not registered yet (part b): until then nothing here says that ComfyUI's, Kaggle's or the bridge's adapter passes.

## What was found (step 0)

At `6e0b5b6`, by reading: `Operation` has five names; neither document, kit nor checklist existed; `createFakeEngineV2` was used by `tests/engines.test.ts`, `tests/capability-report.test.ts` and `scripts/qualify-revisable-shot.mjs` (the card says the first only); the four files are the only ones under `core/engines` that make an `EngineAdapterV2`, and `reconcile` is `status` in each; `docs/MODEL_CAPABILITIES.md` names thirteen operations, two of them the contract's. MPR-201 and MPR-207 are merged, so `ended-failure-has-class` is here.

## What a check is

Each is in `tests/fixtures/engine-conformance.ts` beside the sentence of the contract or the service that it holds an adapter to. A stand-in is put in a state, a run is submitted, and the adapter is asked only through the contract; how often anything was really sent is counted by the harness. One that a stand-in cannot arrange is not asked, is shown as UNAVAILABLE with its reason, and is not a pass. A state with no reason, or with both, is refused before anything is asked.

| Check | What fails it |
|---|---|
| `refusal-sends-nothing` | a request that must be refused is accepted, refused with another reason, or something is sent |
| `unlisted-role-refused` | an input role its capabilities do not list is accepted, one it must have included, or something is sent |
| `limits-held` | a prompt, seed, deadline, size, length or listed frame rate refused at its bound, or one past it accepted; a control that is not listed or is past the contract's range, sound it does not make, or a capability whose hash is not its own |
| `status-parses` | an answer that is not of the contract's form, or is about another run |
| `states-told-as-they-are` | a run told as something it is not in the state it was put in, before a restart or after it |
| `ended-failure-has-class` | a failed or stopped run that names no kind of end, or another answer that names one |
| `ref-usable-at-once` | a run's name that cannot be asked about before anything else |
| `same-attempt-never-sent-twice` | one attempt and generation sent other than once: one after the other, both at once, while its run goes on, after an uncertain answer, a failure or a stop |
| `uncertain-sends-nothing-more` | an uncertain send that is not said, is sent again, is lost when it landed, or is called finished when it did not |
| `restart-reconciles-without-sending` | a new adapter that sends, however often it is asked and in whatever state the run is |
| `unknown-ref-answered-honestly` | a run never issued, or lost, that is called finished or stopped |
| `cancel-never-overclaims` | a stop that claims what did not happen there: that it ended what goes on or was never there, that it was refunded, or anything of a remote where there is none |
| `artifact-verified` | a finished run whose files do not read as declared |
| `corrupt-artifact-rejected` | files that are not the declared ones, taken |
| `diagnostic-bounded` | a message that is too long or holds a path |
| `location-declared` | an adapter that sends elsewhere and does not say where, or the other way round |
| `row-before-send` | a send before the run's row |
| `ref-before-poll` | a question before the row has the run's name |
| `uncertain-row-not-resent` | an uncertain run sent again by a new service over the same rows |
| `continuing-stop-blocks-import` | a stopped run brought in, one that finished there all the same included |
| `corrupt-result-not-imported` | a file that is not the declared one brought in |

**In every one of them nothing is sent after the run was:** the count is compared at the end of each state, whatever was asked in it. What a stand-in cannot arrange is told after the rest of the check was asked: a failure of the rest is a failure.

The tests of the kit hold it to this: adapters wrong in one way each, made from the fake, and services wrong in one way each over an adapter that is not, fail the check for that way; a stand-in that is not in the state it says fails; and an adapter made as a class, one whose control takes a narrow range, and one that refuses by an error of a command's kind pass.

## Where this differs from the card

- **Four checks more than its list of ids:** `unlisted-role-refused` and `limits-held`, which its acceptance asks for without an id; `ended-failure-has-class`, which it asks for when MPR-207 is merged; and `states-told-as-they-are`, without which an adapter that calls a running run finished passed, and a stand-in that is not in the state it says.
- **Two states more,** `running` and `failed`: a stop of a run that has ended, and a kind of end that no run has, would prove nothing.
- **`reset()` on the harness,** so that each check starts with nothing sent; `request` and `imports` beside the service's store and ledger, and `make` for the kit's own tests of a wrong service; and `unavailable` in a result.
- **A stop** must also not be followed by a status that says otherwise, and not claim a run that never landed, was lost, had ended or was never issued; on this computer it must not say its process ended while the run goes on, nor that anything was stopped elsewhere; and nothing that goes on or was not there is refunded. The card names only the answer and fewer cases; its objective is that a stop never claims more than happened. That a stop was taken is not that it ended anything: only `unstoppable`, or a run that was not there, may not say so.
- **Of a control only the contract's range is asked,** past it: which values of its own it takes is the engine's, so "accepted at its bound" is not asked of it, nor of how small a size goes or how short a deadline. The other numeric limits are asked at the bound and past it.
- **A request past a limit may be refused by an error of a command's kind,** with nothing sent, as the service takes it. A role, a control, a media type or an output that cannot be honoured must be answered with its reason.
- **A size's bound plus one is plus two,** since a size is even.
- **`ADAPTER_SUITES` and `PENDING` are in `tests/fixtures/engine-suites.ts`,** which the kit's test, the intake's test and the check script read; a test file that imports another runs it. Each names what makes the adapter, its test files and the names it is called by, since an adapter may have its two layers in two files. Every file under `core/engines` that names the contract is in one of its three lists, with a reason if it makes no adapter: a text search cannot tell an adapter in every form, and a file that takes one from a file of another folder is not seen.
- **The fake's "Unknown engine execution." is a `NOT_FOUND` now,** which `unknown-ref-answered-honestly` asks for. Its words are the same.
- **The lost run of the fake** is `failed` with `lostJob`.

## What to know when reading it

- **The kit proves an adapter over its stand-in,** not over the real engine: whether a real Kaggle or ComfyUI behaves as the stand-in does is another question. The optional note on a real run is BLOCKED (FD-3, quota).
- **The fake's three runs** are of one adapter with a stop that has no remote, one that ends the run and one that does not.
- **`corrupt-artifact-rejected` is also passed by an adapter that names no file or refuses to,** which is as safe.
- **`limits-held` does not ask** about a count of controls or how long an attempt's key may be.
- **What part b is expected to find, by reading and not yet run:** Kaggle's adapter claims no capabilities, and asks about no length, prompt length or seed; it keeps no record of an attempt, so the same one after its run ended looks as if it would be sent again; and it takes no account of a frame rate, so listing the model's own would refuse what the service sends today (the project's), which is a decision and not only a fix. ComfyUI's says nothing of a lost answer, and throws an error of no kind for the files of a run it does not know. Each is to be fixed in that adapter or reported, and no check is to be loosened for it.
- **`sends()` is what the stand-in counts:** one that does not count a send which never landed cannot show such a send made again.
- **Not asked:** whether a failed run leaves files (the contract does not say), and what a run stopped elsewhere cost.
- **An uncertain answer's own words are not measured** (the card lists diagnostics and notices).
- **The written answers below are checked only to be there.**

## Intake

### kaggle

- `egress`: a run's prompt, seed, run name and script, and for a run from a still a picture made anew from it, go to the person's own private notebook at kaggle.com, by their own Kaggle CLI. The notebook has internet there, and by itself fetches the model's files from huggingface.co and the packages its script asks for.
- `spend`: no money. GPU time of the person's weekly Kaggle quota: about 20 minutes a run was seen, at most an hour by the run's own limit.
- `download`: no model file. The finished video, its receipt and the run's log come back, at most 512 MiB for the video (the runs seen left a few megabytes), and the notebook's script and metadata, to see that it is private and whose run it is. The person has installed the Kaggle CLI.
- `withdrawal`: `offered` is set to false in `KAGGLE_RECIPES` and the catalog's lifecycle to `retired`. Nothing new starts. A run already sent is followed and brought in while its recipe stays in the list, and takes and records made by it stay as they are.

### comfyui

- `egress`: nothing leaves this computer: only a loopback address is asked, and no recipe is pinned, so nothing runs today.
- `spend`: none, but this computer's own time and power.
- `download`: the model's files, put in place by a person before a recipe could be pinned. None is today, so there is no size to state.
- `withdrawal`: its recipe is taken out of `PINNED_COMFY_RECIPES`. Nothing new starts. A run already started goes on in ComfyUI, which is the person's own program and is not stopped; this service forgets it when it ends.
