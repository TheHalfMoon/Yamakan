# Model intake

What must be known of a model before a route of it is `qualified` or `offered` in the model catalog (`core/engines/catalog.ts`). `tests/model-intake.test.ts` holds this list to its own, and checks the first part of it against the catalog. It checks that something is written down, not that it is right. Whether a licence is acceptable is not decided here: that is the licence gate (MPR-208).

## Checked by machine

- `identity`: the full identity, its host, owner and model, variant, and the exact revision as a full commit. A family name, a branch or a tag is not an identity.
- `licence`: the licence's name as the publisher states it, the page it was read on and the date it was read.
- `route`: one of the catalog's routes and the recipe it runs; an offered one's recipe can be started.
- `operation`: one of the operations in [Engine operations](ENGINE_OPERATIONS.md), with the input roles it honours, each of them a role of that operation.
- `limits`: the size, frames, frame rate, steps, lengths and sound that it makes.
- `evidence`: at least one existing file under `docs/evidence/`.
- `conformance`: the adapter of its route runs the conformance kit (`ADAPTER_SUITES` in `tests/fixtures/engine-suites.ts`), or is named there as pending.

## Written, in the offer's evidence

Answered under "Intake" in [the conformance evidence](evidence/model-system/engine-conformance.md), by route. A person reads the answers; a machine checks only that each route an offer uses has all of them.

- `egress`: what leaves this computer and to which host.
- `spend`: the money or quota time a run can use, or none.
- `download`: what must be put on this computer, and its size, or none.
- `withdrawal`: how the offer is retired, and what happens to runs already made.
