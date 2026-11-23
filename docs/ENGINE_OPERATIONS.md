# Engine operations

What each operation of the engine contract means: what goes in, what comes out, and what an adapter may never approximate. The content is that of `EngineRequestV2Schema` in `core/engines/contract-v2.ts`, which decides where the two differ; `tests/engine-conformance.test.ts` holds the operations' names and order here to the contract's. Every adapter must pass the checks in `tests/fixtures/engine-conformance.ts`.

# Operations

## textToVideo

- **Purpose:** a video made from words.
- **Prompt:** required, 1 to 4000 characters.
- **Inputs:** none, but up to four `reference` pictures (PNG or JPEG): what to look like, and no frame of the video. No engine honours a reference yet, so every one refuses it.
- **Output:** a video.
- **Never approximated:**
  - a prompt is not cut, rewritten or translated;
  - a reference is not left out or put into the prompt as words;
  - a size, frame rate, length or sound other than the declared one is not returned.

## imageToVideo

- **Purpose:** a video that starts from a still, and may end at another.
- **Prompt:** optional, 1 to 4000 characters.
- **Inputs:** `firstFrame` alone, or `firstFrame` then `lastFrame`, each one PNG or JPEG; then up to four `reference` pictures (PNG or JPEG). No engine honours a reference yet, so every one refuses it.
- **Output:** a video.
- **Never approximated:**
  - a last frame that the model ignores is refused, not dropped;
  - a frame is not used as a reference, nor a reference as a frame;
  - a still is not swapped for a description of it;
  - a size, frame rate, length or sound other than the declared one is not returned.

## videoEdit

- **Purpose:** a video changed by words, the whole picture or the part a mask names.
- **Prompt:** required, 1 to 4000 characters.
- **Inputs:** `source` as one MP4 alone, or `source` then `mask` as one PNG.
- **Output:** a video.
- **Never approximated:**
  - a mask that the model ignores is refused, not dropped;
  - a new video that only resembles the source is not an edit of it;
  - a size, frame rate, length or sound other than the declared one is not returned.

## transcribe

- **Purpose:** the words of a recording.
- **Prompt:** the request has no prompt field.
- **Inputs:** one `audio`, as WAV or MP4.
- **Output:** a transcript, with an optional language.
- **Never approximated:**
  - a translation is not a transcript;
  - a language that was asked for and is not supported is refused, not guessed.

## enhance

- **Purpose:** the same video, better: sharper, larger or cleaner.
- **Prompt:** the request has no prompt field.
- **Inputs:** one `source`, as MP4.
- **Output:** a video.
- **Never approximated:**
  - a new video that only resembles the source is not an enhancement of it;
  - a size, frame rate, length or sound other than the declared one is not returned.

# Common to every operation

- **Which contract and operation:** `contract`, the contract's name, and `operation`, one of those above.
- **Who runs it:** `recipeId`, `recipeHash` and `modelManifestHash`, a recipe the service owns and the exact manifest it was qualified with.
- **How:** an optional `seed` (0 to 4,294,967,295) and at most 32 named `controls`, each a number within a million of zero, a yes or no, or a short choice. A control is never a path, an address or the name of code.
- **Which attempt:** `attemptKey` and `leaseGeneration`. The same attempt and generation is one run, sent once.
- **For how long and within what:** `deadlineMs` (at most six hours) and `resourcePolicyHash`.
- **A video output** declares its width and height (16 to 8192, even), its frame rate as a fraction, its length in ticks and whether it has audio.
- **Nothing else:** a request with any other field is refused. No graph, model class, plugin, address or file path crosses it. An input names a version of the project's own media by id, SHA-256 and media type, and its `role`; one that is not a `reference` may say where in the video it stands (`atTicks`).

# Nothing is approximated

An adapter that cannot honour a role, a control, a media type or the declared output answers `{ refused }` with `INPUT_UNSUPPORTED`, `CONTROL_UNSUPPORTED` or `OUTPUT_UNSUPPORTED` before anything is started or sent. It never drops an input, clamps or ignores a control, answers one operation with another, or returns a size, rate or length other than the declared one without failing the run.

# Adding an operation

Five steps, in order. The operation is offered nowhere until the last is done.

1. A written definition in this document, under Operations.
2. A strict branch in `EngineRequestV2Schema` and the name in `Operation`. `ENGINE_CONTRACT_V2` stays as it is only if no existing branch changes.
3. Support in `createFakeEngineV2`, and a passing run of the conformance kit for it.
4. At least one real adapter that claims it in `capabilities()` and passes the kit.
5. Qualification evidence under `docs/evidence/`, and an offer in the model catalog (`core/engines/catalog.ts`) that passed the [intake checklist](MODEL_INTAKE.md).

# Proposed, not in the contract

The other operations that [the earlier proposal](MODEL_CAPABILITIES.md) names. None has a branch in the contract, an adapter or evidence, and none is accepted by the contract or offered by any command. `textToVideo` and `imageToVideo`, which it names too, are defined above.

| Operation | Status |
|---|---|
| `textToImage` | PROPOSED |
| `imageToImage` | PROPOSED |
| `inpaint` | PROPOSED |
| `outpaint` | PROPOSED |
| `videoToVideo` | PROPOSED |
| `extendVideo` | PROPOSED |
| `audioToVideo` | PROPOSED |
| `lipSync` | PROPOSED |
| `upscale` | PROPOSED |
| `interpolateFrames` | PROPOSED |
| `generate3D` | PROPOSED |
