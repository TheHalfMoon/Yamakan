# MPR-206: the engine operations, and the conformance kit

Part a: the five operations written down, the kit, the in-process fake run through it, and the intake checklist. The three real adapters are not registered yet (part b): until then nothing here says that ComfyUI's, Kaggle's or the bridge's adapter passes.

## What was found (step 0)

At `6e0b5b6`, by reading: `Operation` has five names; neither document, kit nor checklist existed; `createFakeEngineV2` was used by `tests/engines.test.ts`, `tests/capability-report.test.ts` and `scripts/qualify-revisable-shot.mjs` (the card says the first only); the four files are the only ones under `core/engines` that make an `EngineAdapterV2`, and `reconcile` is `status` in each; `docs/MODEL_CAPABILITIES.md` names thirteen operations, two of them the contract's. MPR-201 and MPR-207 are merged, so `ended-failure-has-class` is here.

## What a check is

Each is in `tests/fixtures/engine-conformance.ts` beside the sentence of the contract or the service that it holds an adapter to. A stand-in is put in a state, a run is submitted, and the adapter is asked only through the contract; how often anything was really sent is counted by the harness. One that a stand-in cannot arrange is not asked, is shown as UNAVAILABLE with its reason, and is not a pass. A state with no reason, or with both, is refused before anything is asked.

| Check | What fails it |
|---|---|
| `refusal-sends-nothing` | a request that must be refused is accepted, refused with another reason, or something is sent |
| `unlisted-role-refused` | an input role its capabilities do not list is accepted, or something is sent |
| `limits-held` | a prompt, seed, deadline, control, size or length is refused at its bound, or accepted past it |
| `status-parses` | an answer that is not of the contract's form |
| `ended-failure-has-class` | a failed or stopped run that names no kind of end, or another answer that names one |
| `ref-usable-at-once` | a run's name that cannot be asked about before anything else |
| `same-attempt-never-sent-twice` | one attempt and generation sent other than once, one after the other or both at once |
| `uncertain-sends-nothing-more` | an uncertain send that is not said, is sent again, is lost when it landed, or is called finished when it did not |
| `restart-reconciles-without-sending` | a new adapter that sends when it is asked about a known run |
| `unknown-ref-answered-honestly` | a run never issued, or lost, that is called finished |
| `cancel-never-overclaims` | a stop that claims what did not happen there, or a bill where there is no remote |
| `artifact-verified` | a finished run whose files do not read as declared |
| `corrupt-artifact-rejected` | files that are not the declared ones, taken |
| `diagnostic-bounded` | a message that is too long or holds a path |
| `location-declared` | an adapter that sends elsewhere and does not say where, or the other way round |
| `row-before-send`, `ref-before-poll`, `uncertain-row-not-resent`, `continuing-stop-blocks-import`, `corrupt-result-not-imported` | the service over the adapter: a send before its row, a question before the row has the run's name, an uncertain run sent again, a stopped run brought in, a file that is not the declared one brought in |

Fourteen adapters that are wrong in one way each, made from the fake, fail the check for that way.

## Where this differs from the card

- **Three checks more than its list of ids:** `unlisted-role-refused` and `limits-held`, which its acceptance asks for without an id, and `ended-failure-has-class`, which it asks for when MPR-207 is merged.
- **Two states more,** `running` and `failed`: a stop of a run that has ended, and a kind of end that no run has, would prove nothing.
- **`reset()` on the harness,** so that each check starts with nothing sent.
- **A size's bound plus one is plus two,** since a size is even.
- **`ADAPTER_SUITES` and `PENDING` are in `tests/fixtures/engine-suites.ts`,** which the kit's test, the intake's test and the check script read; a test file that imports another runs it.
- **The fake's "Unknown engine execution." is a `NOT_FOUND` now,** which `unknown-ref-answered-honestly` asks for. Its words are the same.
- **The lost run of the fake** is `failed` with `lostJob`.

## What to know when reading it

- **The kit proves an adapter over its stand-in,** not over the real engine: whether a real Kaggle or ComfyUI behaves as the stand-in does is another question. The optional note on a real run is BLOCKED (FD-3, quota).
- **The fake's three runs** are of one adapter with a stop that has no remote, one that ends the run and one that does not.
- **`corrupt-artifact-rejected` is also passed by an adapter that names no file or refuses to,** which is as safe.
- **`limits-held` asks what the contract and the capabilities bound:** it does not ask about a frame rate, a count of controls or how long an attempt's key may be.
- **The written answers below are checked only to be there.**

## Intake

### kaggle

- `egress`: a run's prompt, seed, run name and script, and for a run from a still a picture made anew from it, go to the person's own private notebook at kaggle.com, by their own Kaggle CLI. The notebook has internet there and fetches the model's files from huggingface.co by itself.
- `spend`: no money. GPU time of the person's weekly Kaggle quota: about 20 minutes a run was seen, at most an hour by the run's own limit.
- `download`: no model file. The finished video and its receipt come back, at most 512 MiB for the video; the runs seen left a few megabytes. The person has installed the Kaggle CLI.
- `withdrawal`: `offered` is set to false in `KAGGLE_RECIPES` and the catalog's lifecycle to `retired`. Nothing new starts. A run already sent is followed and brought in while its recipe stays in the list, and takes and records made by it stay as they are.

### comfyui

- `egress`: nothing leaves this computer: only a loopback address is asked, and no recipe is pinned, so nothing runs today.
- `spend`: none, but this computer's own time and power.
- `download`: the model's files, put in place by a person before a recipe could be pinned. None is today, so there is no size to state.
- `withdrawal`: its recipe is taken out of `PINNED_COMFY_RECIPES`. Nothing new starts, and a run does not outlive the service.

## The check

`npm run qualify:engine-conformance`: **PASS** at `9901bc16e9345979963c4952d6980cf1d0eac406`, on win32, with the in-process fake and the test files' own stand-ins. No network but loopback, no account, no download, no model and no spend.

Operations compared with the contract: `textToVideo`, `imageToVideo`, `videoEdit`, `transcribe`, `enhance`.

Adapter files not yet registered: `v1-bridge.ts`, `comfyui.ts`, `kaggle.ts`.

| Adapter | Check | Result |
|---|---|---|
| fake | `refusal-sends-nothing` | PASS |
| fake | `unlisted-role-refused` | PASS |
| fake | `limits-held` | PASS |
| fake | `status-parses` | PASS |
| fake | `ended-failure-has-class` | PASS |
| fake | `ref-usable-at-once` | PASS |
| fake | `same-attempt-never-sent-twice` | PASS |
| fake | `uncertain-sends-nothing-more` | PASS |
| fake | `restart-reconciles-without-sending` | PASS |
| fake | `unknown-ref-answered-honestly` | PASS |
| fake | `cancel-never-overclaims` | PASS |
| fake | `artifact-verified` | PASS |
| fake | `corrupt-artifact-rejected` | PASS |
| fake | `diagnostic-bounded` | PASS |
| fake | `location-declared` | PASS |
| fake | `row-before-send` | PASS |
| fake | `ref-before-poll` | PASS |
| fake | `uncertain-row-not-resent` | PASS |
| fake | `continuing-stop-blocks-import` | PASS |
| fake | `corrupt-result-not-imported` | PASS |
| fake, stopped elsewhere | `refusal-sends-nothing` | PASS |
| fake, stopped elsewhere | `unlisted-role-refused` | PASS |
| fake, stopped elsewhere | `limits-held` | PASS |
| fake, stopped elsewhere | `status-parses` | PASS |
| fake, stopped elsewhere | `ended-failure-has-class` | PASS |
| fake, stopped elsewhere | `ref-usable-at-once` | PASS |
| fake, stopped elsewhere | `same-attempt-never-sent-twice` | PASS |
| fake, stopped elsewhere | `uncertain-sends-nothing-more` | PASS |
| fake, stopped elsewhere | `restart-reconciles-without-sending` | PASS |
| fake, stopped elsewhere | `unknown-ref-answered-honestly` | PASS |
| fake, stopped elsewhere | `cancel-never-overclaims` | PASS |
| fake, stopped elsewhere | `artifact-verified` | PASS |
| fake, stopped elsewhere | `corrupt-artifact-rejected` | PASS |
| fake, stopped elsewhere | `diagnostic-bounded` | PASS |
| fake, stopped elsewhere | `location-declared` | PASS |
| fake, stopped elsewhere | `row-before-send` | PASS |
| fake, stopped elsewhere | `ref-before-poll` | PASS |
| fake, stopped elsewhere | `uncertain-row-not-resent` | PASS |
| fake, stopped elsewhere | `continuing-stop-blocks-import` | PASS |
| fake, stopped elsewhere | `corrupt-result-not-imported` | PASS |
| fake, going on elsewhere | `refusal-sends-nothing` | PASS |
| fake, going on elsewhere | `unlisted-role-refused` | PASS |
| fake, going on elsewhere | `limits-held` | PASS |
| fake, going on elsewhere | `status-parses` | PASS |
| fake, going on elsewhere | `ended-failure-has-class` | PASS |
| fake, going on elsewhere | `ref-usable-at-once` | PASS |
| fake, going on elsewhere | `same-attempt-never-sent-twice` | PASS |
| fake, going on elsewhere | `uncertain-sends-nothing-more` | PASS |
| fake, going on elsewhere | `restart-reconciles-without-sending` | PASS |
| fake, going on elsewhere | `unknown-ref-answered-honestly` | PASS |
| fake, going on elsewhere | `cancel-never-overclaims` | PASS |
| fake, going on elsewhere | `artifact-verified` | PASS |
| fake, going on elsewhere | `corrupt-artifact-rejected` | PASS |
| fake, going on elsewhere | `diagnostic-bounded` | PASS |
| fake, going on elsewhere | `location-declared` | PASS |
| fake, going on elsewhere | `row-before-send` | PASS |
| fake, going on elsewhere | `ref-before-poll` | PASS |
| fake, going on elsewhere | `uncertain-row-not-resent` | PASS |
| fake, going on elsewhere | `continuing-stop-blocks-import` | PASS |
| fake, going on elsewhere | `corrupt-result-not-imported` | PASS |

| Offer | Machine-checked intake |
|---|---|
| `kaggle-wan22-ti2v-5b` | PASS |
| `kaggle-wan22-ti2v-5b-first-frame` | PASS |
| `kaggle-cogvideox-2b` | PASS |

The same files' other tests: 27 of 27 passed.
