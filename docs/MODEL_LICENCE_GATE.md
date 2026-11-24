# Model licence gate

Every model the [catalog](../core/engines/catalog.ts) holds carries a licence block (`yamakan.model-licence/v1`, `LicenceBlockSchema` in `core/engines/licence.ts`), and `licenceGate()` says whether it may be offered. `tests/licence-gate.test.ts` fails, naming the recipe and the field, when one that is offered has no whole block. What must be known of a model besides its licence is in [Model intake](MODEL_INTAKE.md).

A block says what a person or an agent read, where and when, and no more than that. It is not legal advice, and no lawyer has read these.

## The fields

Every one is required. `unknown` is an answer, and refuses.

- `code`: the licence of the pipeline library the weights are run with.
- `weights`: the licence of the weights, by the name the publisher gives it. The interface shows this name.
- `baseModel`: the licence of the model it was made from, or none when the publisher names none.
- `bundled`, `bundledReviewed`: what else a run loads (text encoder, video autoencoder, packages, programs), each with its own licence. An empty list says that there is nothing else.
- `revenueCap`, `territorialExclusions`: a limit by revenue, or countries left out.
- `hostedServiceRight`: whether the weights may be run on a hosted service. A Kaggle run is one, under the person's own account. A local run does not ask.
- `outputUse`: whether what it makes is limited in use.
- `watermark`: whether it marks what it makes. A mark that is known does not refuse.
- `gated`: whether its files are behind a form or an agreement.
- `attribution`: a credit it asks for. One that is known does not refuse.
- `sourceUrl`, `verifiedAt`: the page that was read, and the day.
- `evidence`: `DOC` when the licence's own text was read at `sourceUrl`; otherwise `CLAIM` (the publisher's words about it), `IND`, `ASSUMED` or `UNKNOWN`.

A licence is a name, its SPDX expression or null, and whether commercial use is allowed.

## The rule

A model is offered only when no reason applies. All that apply are given.

| Reason                                                                | When                                                                                                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOCK_MISSING`, `BLOCK_INVALID`                                      | there is no block, or it is not of the form                                                                                                                       |
| `FIELD_UNKNOWN`                                                       | a field is `unknown` (the hosted right only for a hosted run)                                                                                                     |
| `NOT_READ_AT_SOURCE`                                                  | `evidence` is not `DOC`                                                                                                                                           |
| `LICENCE_UNACCEPTED`                                                  | the weights or the base model are not under Apache-2.0, MIT, BSD-2-Clause or BSD-3-Clause, or the code or a bundled part is not under an accepted package licence |
| `NON_COMMERCIAL`                                                      | a part does not allow commercial use                                                                                                                              |
| `REVENUE_CAP`, `TERRITORY_EXCLUDED`, `OUTPUT_USE_RESTRICTED`, `GATED` | as they say: Yamakan knows no one's revenue or country, and accepts no licence for anyone                                                                         |
| `HOSTED_RUN_NOT_ALLOWED`                                              | a hosted run without the right to one                                                                                                                             |

A refused Kaggle recipe is in no list of what can be started and cannot be started or sent; on any route, its place in the capability report is `unsupported` with `RIGHTS_UNQUALIFIED`. The ComfyUI and local lists are empty, and the test holds whatever is put in them to the gate before it can be merged; nothing more stops them at run time. A run already sent is still followed, brought in and recorded. Create's own list of models, for a notebook run by hand, is not filtered: it shows what is not known of each.

## The recipes from before the gate

Three recipes were offered before this, by the founder's direction: `kaggle-wan22-ti2v-5b`, `kaggle-wan22-ti2v-5b-first-frame` and `kaggle-cogvideox-2b`. They are in a closed list (`PRE_GATE_EXCEPTIONS`, 2026-11-24). They stay offered with what is not known of them shown, on Create and in `yamakan.generation.options` (`licenceOpen`), until the founder closes the fields or withdraws a recipe. It excuses a field that is not known, a licence of which neither the name nor the use is known, and a text that was not read at its source; and nothing else. With a gated file, a limit, a licence that is named and not accepted, or a right to a hosted run that is not known, such a recipe is refused like any other. Each is in the list at its model's revision, so another model under its id is not. A test refuses a new entry.

What is not known, and why (read on 2026-11-24):

| Field                                                  | Wan2.2-TI2V-5B                                                                                                                                                                                                     | CogVideoX-2b                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `bundled`: FFmpeg in imageio-ffmpeg 0.6.0              | The package does not state its licence. It names the build of a site that says it is under the GPL, version 3; that it is that build is inferred. It runs on Kaggle's machine and Yamakan passes on no copy of it. | the same                                                        |
| `bundled`: torch, NumPy and Pillow on Kaggle's machine | The versions there are not known. The releases that were looked at are BSD-3-Clause, BSD-3-Clause and MIT-CMU.                                                                                                     | the same                                                        |
| `bundled`: what these packages install and use in turn | Not looked at.                                                                                                                                                                                                     | the same                                                        |
| `bundled`: T5 text encoder                             | known: the page puts all models of the repository under Apache-2.0                                                                                                                                                 | Its page names the transformer and the VAE and not the encoder. |
| `outputUse`                                            | The page claims no rights in what is made, and asks that some of it not be shared, pointing to a list that its licence has not. What that binds is not known.                                                      | known: the licence and the page limit none                      |
| `watermark`                                            | The pipelines add none. Whether the weights learned one is not known.                                                                                                                                              | the same                                                        |
| `evidence`                                             | The page names Apache-2.0; the repository holds no licence file. `CLAIM`.                                                                                                                                          | `DOC`: its `LICENSE` was read                                   |

Two readings a person may see otherwise. Wan's text encoder and autoencoder are put under Apache-2.0 by one sentence of the page about all models of its repository; neither has a licence of its own there, and where the encoder came from is inferred. That `outputUse` of Wan is not known, and not `restricted`, is a choice: as `restricted` the gate would refuse it, even as one of the three.

## Adding or reading again

1. Read the licence's own text at the model's pinned revision, and that of each part the run loads. Reading is development work; the product fetches nothing.
2. Write the block in `core/engines/catalog.ts`. What was not read is `unknown`.
3. `node --test tests/licence-gate.test.ts tests/model-catalog.test.ts`, and `npm run qualify:licence-gate`, whose receipt says how old each reading is. The gate itself knows no clock.
