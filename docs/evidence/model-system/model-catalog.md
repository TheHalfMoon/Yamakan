# MPR-201: the model catalog

`core/engines/catalog.ts` names each model Yamakan offers, is considering or has refused, by host, slug, commit and variant, from facts already in this repository. The lists that routes and the page use are checked against it and are unchanged. `docs/evidence/model-system/model-catalog.json` is the receipt of `npm run qualify:model-catalog`, with its commit and host.

## What was there before

At `124d04e` there was no catalog. A model's slug or revision is written in `KAGGLE_RECIPES`, `CREATE_MODELS` (slug only), the frozen candidates evidence, each `scripts/kaggle/*/run.py` and older receipts; `PINNED_COMFY_RECIPES` and `PINNED_MODEL_MANIFESTS` are empty. `tests/kaggle-engine.test.ts` ties the page's facts to the recipes, and each recipe to its script. Nothing tied any of them to the candidates evidence. `SERVER_RECIPES` in `core/engines/v1-bridge.ts` are stand-ins and name no model.

## What to know when reading it

- **A licence is a record, not a clearance.** It is what the candidates evidence says the publisher states, on that evidence's date (2026-10-27). For the Wan model it was read from the model card, for CogVideoX from a licence file. MPR-208 owns the gate.
- **A source address was not opened for this card.** It is written from the identity, as the card says: the publisher's page of that commit. The licence's is the same page, not the file it was read from.
- **A local candidate's limits are its model's Kaggle recipe's.** The card asks for limits copied from the recipes, and nothing has been run locally, so they say nothing of what a local run would do. The frozen comparison asks for each model's own documented size, which may differ.
- **`offered` follows the recipe's `offered`.** Whether a person sees it still depends on the Kaggle CLI being set up and the script being there.

## What the checks do beyond the card's list

The page's name and `readsAboutWords`, a candidate's licence, a pin's operation, and an offer of a ComfyUI recipe or local pin that does not exist are compared too, since each is a fact held in two places. An identity is one whatever the letter case of its slug. Only a candidate may have no recipe, each offer names evidence, and a recipe is in one offer.

## What was not done

No command, page or stored format reads the catalog yet, so no person sees anything of it; MPR-202 is the first to. No model was run, downloaded or looked up, and no hosted, retired or prohibited route was added from research. What each list says was not checked against the publisher again.
