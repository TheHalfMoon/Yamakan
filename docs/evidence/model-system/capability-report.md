# MPR-202: what each route can do with each model

`yamakan.engines.capabilities` gains `report`: one cell for each model of the catalog (MPR-201), each of the three routes and each of the five operations. Today that is 30 cells: 3 supported (the Kaggle recipes), 3 unverified (the local candidates) and 24 unsupported, and 1 refused model. `yamakan.generation.options` is now chosen by that report and answers what it answered before. `capability-report.json` is the receipt of `npm run qualify:capability-report`, with its commit and host.

## What was found (step 0)

At `b8c9f3b`, by reading: `core/engines/catalog.ts` is there; `yamakan.engines.capabilities` returned only `operations`, and `yamakan.generation.options` was built inline. The SDK, the CLI and the MCP adapter declare no output fields of either command, and by reading none of them bounds the size of a command's result; the report has its own bound.

## Where each date and sample size comes from (OA-17)

| Cell | Evidence | Measured | Samples |
|---|---|---|---|
| Wan, text to video, Kaggle | `kaggle-page-run-receipt.json` | 2026-11-06, the day its run finished (UTC) | 1 |
| Wan, image to video, Kaggle | `kaggle-first-frame-page-run-receipt.json` | 2026-11-08 | 1 |
| CogVideoX, text to video, Kaggle | `kaggle-cogvideox-page-run-receipt.json` | 2026-11-07 | 1 |

A test reads each date and each model from its file. **One run is one sample:** it says that the recipe ran with its limits, not how often it does.

## What OA-15 adds

- `durationFrames` and `audioOut` in each offer's limits. Every recipe here makes one length and no sound: that is what its script fixes, and nothing measured other lengths.
- `reference` as an input role of a text or image request, in the catalog's words and in a take's record. No engine or recipe honours it, the Kaggle and ComfyUI routes refuse it before anything is sent, and no command takes one.

## What to know when reading it

- **`unsupported` with `OPERATION_NOT_OFFERED` is about Yamakan,** not the model: there is no recipe for it.
- **A route's configuration changes no cell.** A supported Kaggle cell on a service with no Kaggle route says what the route can do; `routes` says it is not set up here.
- **One place, one cell.** Where a model has more than one offer for a route and an operation, the cell is the furthest along (supported, then unverified, then unsupported), and then the first.
- **A refused model's reason is `MODEL_REFUSED`,** which has a message; `because` is the catalog's own word. The card's shape had no `because`; its text does now.
- **An offer takes references and says which, or neither:** a catalog rule beyond the card.
- **`core/router/explain.ts` keeps its three codes,** a separate and older vocabulary.
- A build before this one refuses a take record that names a `reference` input. Nothing writes one.
- The 12 new Arabic messages are unreviewed, and no page shows them yet.

## What was not done

No model was run, downloaded or looked up, and nothing was sent to Kaggle: its stand-in leaves a mark if it is ever started, and it was not. The page reads the same fields as before. What a publisher says was not checked again.
