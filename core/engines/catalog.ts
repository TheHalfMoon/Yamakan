// MPR-201: every model Yamakan offers, is considering or has refused, by exact identity. Facts
// this repository already holds, written down once; the lists the routes and the page really use
// are checked against it (catalogDisagreements), not made from it, so nothing here changes what
// runs. A licence here is what the publisher states and when it was read, not a clearance: the
// gate is MPR-208's. Data only: this file reads nothing, sends nothing and starts nothing.
import { z } from "zod";
import type { EngineCandidate } from "./candidates.ts";
import type { ComfyRecipe } from "./comfyui.ts";
import type { EngineRequestV2, Operation } from "./contract-v2.ts";
import type { KaggleRecipe } from "./kaggle.ts";
import type { ModelPin } from "./manifests.ts";

export const MODEL_CATALOG_FORMAT = "yamakan.model-catalog/v1";
export const MODEL_CATALOG_LIMITS = Object.freeze({
  entries: 64,
  offers: 8,
  refusals: 32,
  evidence: 8,
  bytes: 65_536,
});

// The engine contract's words, checked against it by the types here and by the test.
const OPERATIONS = [
  "textToVideo",
  "imageToVideo",
  "videoEdit",
  "transcribe",
  "enhance",
] as const satisfies readonly Operation[];
const ROLES = [
  "firstFrame",
  "lastFrame",
  "source",
  "mask",
  "audio",
] as const satisfies readonly EngineRequestV2["inputs"][number]["role"][];

const Id = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);
const words = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((t) => t === t.trim(), "No space around it.");
const Count = z.number().int().positive().max(1_000_000);
// Whatever their letter case: a publisher's slug is one model, and Windows has one file.
const unique = (values: readonly string[]) =>
  new Set(values.map((v) => v.toLowerCase())).size === values.length;
// A name, never an address by number: its last part begins with a letter.
const HOST =
  "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){0,8}\\.[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?";
const plainSegments = (p: string) =>
  !p.split("/").some((s) => s === "" || s === "." || s === "..");
// A page that was read, never fetched by code: no account, query or fragment in it.
const SourceUrl = z
  .string()
  .max(300)
  .regex(new RegExp(`^https://${HOST}/[A-Za-z0-9._~/-]+$`))
  .refine(
    (u) => plainSegments(u.slice("https://".length)),
    "A page's plain address.",
  );
const EvidencePath = z
  .string()
  .max(200)
  .regex(/^docs\/evidence\/[A-Za-z0-9_][A-Za-z0-9._/-]*\.[a-z0-9]+$/)
  .refine(
    (p) => plainSegments(p) && !p.split("/").some((s) => s.endsWith(".")),
    "A file under docs/evidence.",
  );
const Evidence = z
  .array(EvidencePath)
  .min(1)
  .max(MODEL_CATALOG_LIMITS.evidence)
  .refine(unique, "Each evidence file once.");

export const ModelIdentitySchema = z
  .object({
    // Where the weights are published.
    host: z
      .string()
      .max(253)
      .regex(new RegExp(`^${HOST}$`)),
    model: z
      .string()
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/,
      ),
    // Only a full commit: a family name, a branch or a tag is not an identity.
    revision: z.string().regex(/^[0-9a-f]{40}$/),
    variant: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
  })
  .strict();
export type ModelIdentity = z.infer<typeof ModelIdentitySchema>;

export const CatalogLicenceSchema = z
  .object({
    // As the publisher states it.
    weightsLicence: z.string().regex(/^[A-Za-z0-9.+-]{1,40}$/),
    sourceUrl: SourceUrl,
    verifiedAt: z.iso.date(),
  })
  .strict();
export type CatalogLicence = z.infer<typeof CatalogLicenceSchema>;

export const CatalogOfferSchema = z
  .object({
    route: z.enum(["kaggle", "comfyui", "local"]),
    recipeId: Id.nullable(),
    operation: z.enum(OPERATIONS),
    lifecycle: z.enum(["candidate", "qualified", "offered", "retired"]),
    limits: z
      .object({
        width: Count,
        height: Count,
        frames: Count,
        fps: Count,
        steps: Count,
        // About how many words of a prompt it reads, or null when it reads a whole one.
        promptWordsRead: Count.nullable(),
        roles: z
          .array(z.enum(ROLES))
          .max(ROLES.length)
          .refine(unique, "Each role once."),
        // What it takes of reference images, or null when it takes none.
        references: z
          .object({
            count: Count,
            mediaTypes: z
              .array(
                z
                  .string()
                  .max(40)
                  .regex(/^[a-z]+\/[a-z0-9.+-]+$/),
              )
              .min(1)
              .max(8)
              .refine(unique, "Each media type once."),
            maxBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    evidence: Evidence,
  })
  .strict()
  .refine((o) => o.recipeId !== null || o.lifecycle === "candidate", {
    path: ["recipeId"],
    message: "Only a candidate has no recipe.",
  });
export type CatalogOffer = z.infer<typeof CatalogOfferSchema>;

export const CatalogEntrySchema = z
  .object({
    id: Id,
    name: words(80),
    identity: ModelIdentitySchema,
    licence: CatalogLicenceSchema,
    offers: z.array(CatalogOfferSchema).max(MODEL_CATALOG_LIMITS.offers),
    verifiedAt: z.iso.date(),
    sourceUrl: SourceUrl,
  })
  .strict();
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const CatalogRefusalSchema = z
  .object({
    id: Id,
    identity: ModelIdentitySchema,
    refusedAt: z.iso.date(),
    reason: z.enum([
      "REMOTE_SERVICE_REFERENCE",
      "LICENCE_UNACCEPTED",
      "ROUTE_RETIRED",
      "ROUTE_PROHIBITED",
      "INTERFACE_UNSUPPORTED",
    ]),
    note: words(300),
    evidence: Evidence,
    sourceUrl: SourceUrl,
  })
  .strict();
export type CatalogRefusal = z.infer<typeof CatalogRefusalSchema>;

const identityKey = (i: ModelIdentity) =>
  [i.host, i.model, i.revision, i.variant].join(" ");

export const ModelCatalogSchema = z
  .object({
    format: z.literal(MODEL_CATALOG_FORMAT),
    entries: z.array(CatalogEntrySchema).max(MODEL_CATALOG_LIMITS.entries),
    refused: z.array(CatalogRefusalSchema).max(MODEL_CATALOG_LIMITS.refusals),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const all = [...catalog.entries, ...catalog.refused];
    const refuse = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (!unique(all.map((e) => e.id))) refuse("Each id once.");
    if (!unique(all.map((e) => identityKey(e.identity))))
      refuse("Each model identity once, offered or refused.");
    const offers = catalog.entries.flatMap((e) => e.offers);
    if (!unique(offers.flatMap((o) => o.recipeId ?? [])))
      refuse("Each recipe in one offer.");
    for (const entry of catalog.entries)
      if (
        !unique(
          entry.offers
            .filter((o) => o.recipeId === null)
            .map((o) => `${o.route} ${o.operation}`),
        )
      )
        refuse("Each candidate without a recipe once on a route.");
    if (
      new TextEncoder().encode(JSON.stringify(catalog)).length >
      MODEL_CATALOG_LIMITS.bytes
    )
      refuse("The catalog is too large.");
  });
export type ModelCatalog = z.infer<typeof ModelCatalogSchema>;

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
};

export const parseModelCatalog = (value: unknown): ModelCatalog =>
  deepFreeze(ModelCatalogSchema.parse(value));

// The publisher's page of an identity's revision, which is where the frozen evidence's method
// says its files were read. Written from the identity; no page was opened to write it.
const pageOf = ({ host, model, revision }: ModelIdentity) =>
  `https://${host}/${model}/tree/${revision}`;

const CANDIDATES_EVIDENCE =
  "docs/evidence/ultimate/engine-candidate-manifests.json";
// When that evidence was read (its inspectedAt).
const INSPECTED = "2026-10-27";

const WAN: ModelIdentity = {
  host: "huggingface.co",
  model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
  revision: "b8fff7315c768468a5333511427288870b2e9635",
  variant: "diffusers",
};
const COGVIDEOX: ModelIdentity = {
  host: "huggingface.co",
  model: "zai-org/CogVideoX-2b",
  revision: "1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01",
  variant: "diffusers",
};
const WAN_NATIVE: ModelIdentity = {
  host: "huggingface.co",
  model: "Wan-AI/Wan2.2-TI2V-5B",
  revision: "921dbaf3f1674a56f47e83fb80a34bac8a8f203e",
  variant: "native",
};
// What each recipe's script fixes. A local candidate holds its model's, since nothing has been
// run here and it has no recipe yet: not what a local run was seen to do.
const WAN_LIMITS = {
  width: 704,
  height: 480,
  frames: 81,
  fps: 24,
  steps: 30,
  promptWordsRead: null,
  roles: [],
  references: null,
};
const WAN_FIRST_FRAME_LIMITS = { ...WAN_LIMITS, roles: ["firstFrame"] };
const COGVIDEOX_LIMITS = {
  width: 720,
  height: 480,
  frames: 49,
  fps: 8,
  steps: 50,
  promptWordsRead: 150,
  roles: [],
  references: null,
};
// Both models' licence, in the form the recipes use.
const licence = (identity: ModelIdentity) => ({
  weightsLicence: "Apache-2.0",
  sourceUrl: pageOf(identity),
  verifiedAt: INSPECTED,
});

export const MODEL_CATALOG: ModelCatalog = parseModelCatalog({
  format: MODEL_CATALOG_FORMAT,
  entries: [
    {
      id: "wan2.2-ti2v-5b-diffusers",
      name: "Wan2.2-TI2V-5B",
      identity: WAN,
      licence: licence(WAN),
      offers: [
        {
          route: "kaggle",
          recipeId: "kaggle-wan22-ti2v-5b",
          operation: "textToVideo",
          lifecycle: "offered",
          limits: WAN_LIMITS,
          evidence: ["docs/evidence/ultimate/kaggle-page-run-receipt.json"],
        },
        {
          route: "kaggle",
          recipeId: "kaggle-wan22-ti2v-5b-first-frame",
          operation: "imageToVideo",
          lifecycle: "offered",
          limits: WAN_FIRST_FRAME_LIMITS,
          evidence: [
            "docs/evidence/ultimate/kaggle-first-frame-page-run-receipt.json",
          ],
        },
        {
          route: "local",
          recipeId: null,
          operation: "textToVideo",
          lifecycle: "candidate",
          limits: WAN_LIMITS,
          evidence: [CANDIDATES_EVIDENCE],
        },
        {
          route: "local",
          recipeId: null,
          operation: "imageToVideo",
          lifecycle: "candidate",
          limits: WAN_FIRST_FRAME_LIMITS,
          evidence: [CANDIDATES_EVIDENCE],
        },
      ],
      verifiedAt: INSPECTED,
      sourceUrl: pageOf(WAN),
    },
    {
      id: "cogvideox-2b-diffusers",
      name: "CogVideoX-2b",
      identity: COGVIDEOX,
      licence: licence(COGVIDEOX),
      offers: [
        {
          route: "kaggle",
          recipeId: "kaggle-cogvideox-2b",
          operation: "textToVideo",
          lifecycle: "offered",
          limits: COGVIDEOX_LIMITS,
          evidence: [
            "docs/evidence/ultimate/kaggle-cogvideox-page-run-receipt.json",
          ],
        },
        {
          route: "local",
          recipeId: null,
          operation: "textToVideo",
          lifecycle: "candidate",
          limits: COGVIDEOX_LIMITS,
          evidence: [CANDIDATES_EVIDENCE],
        },
      ],
      verifiedAt: INSPECTED,
      sourceUrl: pageOf(COGVIDEOX),
    },
  ],
  refused: [
    {
      id: "wan2.2-ti2v-5b-native",
      identity: WAN_NATIVE,
      refusedAt: INSPECTED,
      reason: "REMOTE_SERVICE_REFERENCE",
      note: "Its own source names a remote service (dashscope) for extending a prompt.",
      evidence: [CANDIDATES_EVIDENCE],
      sourceUrl: pageOf(WAN_NATIVE),
    },
  ],
});

/** The one entry of a model at a revision; none when no entry is, or more than one variant is. */
export function catalogEntryFor(
  model: string,
  revision: string,
  catalog: ModelCatalog = MODEL_CATALOG,
): CatalogEntry | undefined {
  const found = catalog.entries.filter(
    (e) => e.identity.model === model && e.identity.revision === revision,
  );
  return found.length === 1 ? found[0] : undefined;
}

/** The offer a recipe is, and the entry it belongs to. */
export function catalogOfferFor(
  recipeId: string,
): { entry: CatalogEntry; offer: CatalogOffer } | undefined {
  for (const entry of MODEL_CATALOG.entries)
    for (const offer of entry.offers)
      if (offer.recipeId === recipeId) return { entry, offer };
  return undefined;
}

// What the lists hold of a model, in the shapes they hold it.
export type CheckedLists = {
  kaggleRecipes: readonly Pick<
    KaggleRecipe,
    | "id"
    | "model"
    | "revision"
    | "licence"
    | "offered"
    | "operation"
    | "width"
    | "height"
    | "frames"
    | "fps"
    | "steps"
  >[];
  comfyRecipes: readonly Pick<ComfyRecipe, "id" | "operation">[];
  modelPins: readonly Pick<ModelPin, "id" | "operation">[];
  candidates: readonly Pick<
    EngineCandidate,
    "id" | "status" | "model" | "operations" | "runtime"
  >[];
  createModels: readonly {
    id: string;
    name: string;
    licence: string;
    width: number;
    height: number;
    frames: number;
    fps: number;
    steps: number;
    readsAboutWords: number | null;
  }[];
};

// The names the sentences begin with, for a reader who sorts them by list.
export const CHECKED_LISTS = Object.freeze({
  kaggleRecipes: "KAGGLE_RECIPES",
  comfyRecipes: "PINNED_COMFY_RECIPES",
  modelPins: "PINNED_MODEL_MANIFESTS",
  candidates: "engine-candidate-manifests.json",
  createModels: "CREATE_MODELS",
} satisfies Record<keyof CheckedLists, string>);

const SIZES = ["width", "height", "frames", "fps", "steps"] as const;
const sameLicence = (a: string | null, b: string) =>
  a !== null && a.toLowerCase() === b.toLowerCase();

/** Every way the lists differ from the catalog, in plain sentences; empty when they agree. */
export function catalogDisagreements(
  lists: CheckedLists,
  catalog: ModelCatalog = MODEL_CATALOG,
): string[] {
  const found: string[] = [];
  const say = (list: keyof CheckedLists, item: string, what: string) =>
    found.push(`${CHECKED_LISTS[list]}: ${item}: ${what}`);
  const differs = (
    list: keyof CheckedLists,
    item: string,
    field: string,
    there: unknown,
    here: unknown,
  ) => {
    if (there !== here)
      say(
        list,
        item,
        `${field} is ${JSON.stringify(there)}, and ${JSON.stringify(here)} in the catalog.`,
      );
  };
  const licenceDiffers = (
    list: keyof CheckedLists,
    item: string,
    there: string | null,
    entry: CatalogEntry,
  ) => {
    if (!sameLicence(there, entry.licence.weightsLicence))
      differs(list, item, "licence", there, entry.licence.weightsLicence);
  };
  const offers = catalog.entries.flatMap((entry) =>
    entry.offers.map((offer) => ({ entry, offer })),
  );
  const onRoute = (route: CatalogOffer["route"], id: string) =>
    offers.filter((o) => o.offer.route === route && o.offer.recipeId === id);

  for (const [list, items] of Object.entries(lists) as [
    keyof CheckedLists,
    readonly { id: string }[],
  ][]) {
    const ids = items.map((i) => i.id);
    for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i)))
      say(list, id, "it is listed more than once.");
  }

  for (const recipe of lists.kaggleRecipes) {
    const list = "kaggleRecipes";
    const mine = onRoute("kaggle", recipe.id);
    if (mine.length !== 1) {
      say(list, recipe.id, `it has ${mine.length} Kaggle offers, not one.`);
      continue;
    }
    const { entry, offer } = mine[0];
    differs(list, recipe.id, "model", recipe.model, entry.identity.model);
    differs(
      list,
      recipe.id,
      "revision",
      recipe.revision,
      entry.identity.revision,
    );
    licenceDiffers(list, recipe.id, recipe.licence, entry);
    differs(
      list,
      recipe.id,
      "operation",
      recipe.operation ?? "textToVideo",
      offer.operation,
    );
    for (const size of SIZES)
      differs(list, recipe.id, size, recipe[size], offer.limits[size]);
    differs(
      list,
      recipe.id,
      "offered",
      recipe.offered,
      offer.lifecycle === "offered",
    );
  }

  // The other way about: an offer of something that is not there.
  const listed = {
    kaggle: ["kaggleRecipes", lists.kaggleRecipes],
    comfyui: ["comfyRecipes", lists.comfyRecipes],
    local: ["modelPins", lists.modelPins],
  } as const;
  for (const { entry, offer } of offers) {
    const [list, items] = listed[offer.route];
    const { recipeId } = offer;
    if (recipeId === null) {
      if (offer.route === "kaggle")
        say(list, entry.id, "the catalog has a Kaggle offer with no recipe.");
    } else if (!items.some((i) => i.id === recipeId))
      say(list, recipeId, "it is in the catalog and not in this list.");
  }

  for (const [list, route, items] of [
    ["comfyRecipes", "comfyui", lists.comfyRecipes],
    ["modelPins", "local", lists.modelPins],
  ] as const)
    for (const item of items) {
      const mine = onRoute(route, item.id);
      if (mine.length !== 1)
        say(list, item.id, `it has ${mine.length} ${route} offers, not one.`);
      else
        differs(
          list,
          item.id,
          "operation",
          item.operation,
          mine[0].offer.operation,
        );
    }

  for (const candidate of lists.candidates) {
    const list = "candidates";
    const { repo, commit, license } = candidate.model;
    const blocked = candidate.status === "blocked";
    const is = (e: { identity: ModelIdentity }) =>
      e.identity.model === repo && e.identity.revision === commit;
    const [mine, others, place] = blocked
      ? ([catalog.refused, catalog.entries, "refused"] as const)
      : ([catalog.entries, catalog.refused, "an entry"] as const);
    if (others.some(is))
      say(
        list,
        candidate.id,
        `its status is ${candidate.status}, and ${repo} at ${commit} is ${blocked ? "an entry" : "refused"} in the catalog.`,
      );
    const found = mine.filter(is);
    if (found.length === 0) {
      const named = mine.some((e) => e.identity.model === repo)
        ? `revision ${commit} of ${repo}`
        : `model ${repo}`;
      say(list, candidate.id, `${named} is not ${place} in the catalog.`);
      continue;
    }
    const matched = found.find(
      (e) => e.identity.variant === candidate.runtime.kind,
    );
    if (!matched) {
      differs(
        list,
        candidate.id,
        "variant",
        candidate.runtime.kind,
        found[0].identity.variant,
      );
      continue;
    }
    if (!("offers" in matched)) continue;
    licenceDiffers(list, candidate.id, license, matched);
    const offered = matched.offers.filter(
      (o) => o.route === "local" && o.lifecycle === "candidate",
    );
    for (const { operation, roles } of candidate.operations) {
      const offer = offered.find((o) => o.operation === operation);
      if (!offer)
        say(
          list,
          candidate.id,
          `operation ${operation} is not a local candidate in the catalog.`,
        );
      else
        differs(
          list,
          candidate.id,
          `roles of ${operation}`,
          [...roles].sort().join(", "),
          [...offer.limits.roles].sort().join(", "),
        );
    }
    for (const { operation } of offered)
      if (!candidate.operations.some((o) => o.operation === operation))
        say(
          list,
          candidate.id,
          `operation ${operation} is a local candidate in the catalog and not its own.`,
        );
  }

  for (const model of lists.createModels) {
    const list = "createModels";
    const mine = offers.filter(
      (o) =>
        o.entry.identity.model === model.id &&
        o.offer.route === "kaggle" &&
        o.offer.operation === "textToVideo",
    );
    // Each text offer the page stands for; a retired one only where none is offered.
    const now = mine.filter((o) => o.offer.lifecycle === "offered");
    const matches = now.length > 0 ? now : mine.slice(0, 1);
    if (matches.length === 0)
      say(list, model.id, "model has no Kaggle text offer in the catalog.");
    for (const { entry, offer } of matches) {
      differs(list, model.id, "name", model.name, entry.name);
      licenceDiffers(list, model.id, model.licence, entry);
      for (const size of SIZES)
        differs(list, model.id, size, model[size], offer.limits[size]);
      differs(
        list,
        model.id,
        "readsAboutWords",
        model.readsAboutWords,
        offer.limits.promptWordsRead,
      );
    }
  }
  for (const { entry, offer } of offers)
    if (
      offer.route === "kaggle" &&
      offer.operation === "textToVideo" &&
      offer.lifecycle === "offered" &&
      !lists.createModels.some((m) => m.id === entry.identity.model)
    )
      say(
        "createModels",
        entry.identity.model,
        "it is offered in the catalog and not in this list.",
      );
  return found;
}
