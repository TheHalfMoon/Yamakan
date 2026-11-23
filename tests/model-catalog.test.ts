// MPR-201: the model catalog. Every other list of models in the repository agrees with it, each
// rule that says so fires on a list that does not, and the catalog refuses what is no identity.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { parseEngineCandidates } from "../core/engines/candidates.ts";
import {
  CHECKED_LISTS,
  MODEL_CATALOG,
  MODEL_CATALOG_LIMITS,
  CatalogOfferSchema,
  catalogDisagreements,
  catalogEntryFor,
  catalogOfferFor,
  parseModelCatalog,
  type CheckedLists,
  type ModelCatalog,
} from "../core/engines/catalog.ts";
import { PINNED_COMFY_RECIPES } from "../core/engines/comfyui.ts";
import {
  EngineRequestV2Schema,
  Operation,
} from "../core/engines/contract-v2.ts";
import { KAGGLE_RECIPES } from "../core/engines/kaggle.ts";
import { PINNED_MODEL_MANIFESTS } from "../core/engines/manifests.ts";
import { CREATE_MODELS } from "../src/create/create-model.ts";

const at = (path: string) => new URL(`../${path}`, import.meta.url);
const EVIDENCE = "docs/evidence/ultimate/engine-candidate-manifests.json";
// The frozen evidence as this card found it.
const FROZEN =
  "51bd31621c07423c12b83ed2dfd39e2a0e120a2c4cbe79d28d5144dd07f93152";
// As Git holds it, whatever line endings a checkout gives it.
const raw = readFileSync(at(EVIDENCE), "utf8").replaceAll("\r\n", "\n");
const evidence = parseEngineCandidates(JSON.parse(raw));
const REAL: CheckedLists = {
  kaggleRecipes: KAGGLE_RECIPES,
  comfyRecipes: PINNED_COMFY_RECIPES,
  modelPins: PINNED_MODEL_MANIFESTS,
  candidates: evidence.candidates,
  createModels: CREATE_MODELS,
};
type Loose<T> = { -readonly [K in keyof T]: Loose<T[K]> };
const catalogLike = (change: (c: ModelCatalog) => void) => {
  const copy = structuredClone(MODEL_CATALOG);
  change(copy);
  return copy;
};
const listsLike = (change: (l: Loose<CheckedLists>) => void) => {
  const copy = structuredClone(REAL) as Loose<CheckedLists>;
  change(copy);
  return copy as CheckedLists;
};
const refused = (change: (c: ModelCatalog) => void, why: RegExp) =>
  assert.throws(() => parseModelCatalog(catalogLike(change)), why);
const only = (found: string[], ...parts: string[]) => {
  assert.equal(found.length, 1, found.join("\n"));
  for (const part of parts) assert.ok(found[0].includes(part), found[0]);
};

test("the catalog parses, is frozen and stays inside its bounds", () => {
  const parsed = parseModelCatalog(structuredClone(MODEL_CATALOG));
  assert.deepEqual(parsed, MODEL_CATALOG);
  const frozen = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    assert.ok(Object.isFrozen(value));
    for (const inner of Object.values(value)) frozen(inner);
  };
  frozen(MODEL_CATALOG);
  frozen(parsed);
  assert.equal(MODEL_CATALOG.entries.length, 2);
  assert.equal(MODEL_CATALOG.refused.length, 1);
  assert.ok(
    Buffer.byteLength(JSON.stringify(MODEL_CATALOG)) <=
      MODEL_CATALOG_LIMITS.bytes,
  );
  for (const e of [...MODEL_CATALOG.entries, ...MODEL_CATALOG.refused]) {
    const { host, model, revision } = e.identity;
    assert.equal(e.sourceUrl, `https://${host}/${model}/tree/${revision}`);
    assert.equal(
      "refusedAt" in e ? e.refusedAt : e.verifiedAt,
      evidence.inspectedAt,
    );
  }
  for (const e of MODEL_CATALOG.entries) {
    assert.equal(e.licence.sourceUrl, e.sourceUrl);
    assert.equal(e.licence.verifiedAt, evidence.inspectedAt);
    for (const o of e.offers) {
      // Nothing is qualified or retired yet, and no recipe takes a reference.
      assert.equal(o.lifecycle, o.route === "kaggle" ? "offered" : "candidate");
      assert.equal(o.limits.references, null);
      assert.deepEqual(
        o.limits.roles,
        o.operation === "imageToVideo" ? ["firstFrame"] : [],
      );
    }
    // A local candidate says what its model's recipe does, until it has been run here.
    for (const o of e.offers.filter((x) => x.route === "local"))
      assert.deepEqual(
        o.limits,
        e.offers.find(
          (x) => x.route === "kaggle" && x.operation === o.operation,
        )!.limits,
      );
  }
});

test("each model's identity, and the evidence of each offer, are what the repository holds", () => {
  const receipt = (name: string) => `docs/evidence/ultimate/${name}.json`;
  assert.deepEqual(
    MODEL_CATALOG.entries.map((e) => [
      e.id,
      e.name,
      ...Object.values(e.identity),
      ...e.offers.map((o) => [o.route, o.recipeId, o.operation, ...o.evidence]),
    ]),
    [
      [
        "wan2.2-ti2v-5b-diffusers",
        "Wan2.2-TI2V-5B",
        "huggingface.co",
        "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
        "b8fff7315c768468a5333511427288870b2e9635",
        "diffusers",
        [
          "kaggle",
          "kaggle-wan22-ti2v-5b",
          "textToVideo",
          receipt("kaggle-page-run-receipt"),
        ],
        [
          "kaggle",
          "kaggle-wan22-ti2v-5b-first-frame",
          "imageToVideo",
          receipt("kaggle-first-frame-page-run-receipt"),
        ],
        ["local", null, "textToVideo", EVIDENCE],
        ["local", null, "imageToVideo", EVIDENCE],
      ],
      [
        "cogvideox-2b-diffusers",
        "CogVideoX-2b",
        "huggingface.co",
        "zai-org/CogVideoX-2b",
        "1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01",
        "diffusers",
        [
          "kaggle",
          "kaggle-cogvideox-2b",
          "textToVideo",
          receipt("kaggle-cogvideox-page-run-receipt"),
        ],
        ["local", null, "textToVideo", EVIDENCE],
      ],
    ],
  );
  assert.deepEqual(MODEL_CATALOG.refused, [
    {
      id: "wan2.2-ti2v-5b-native",
      identity: {
        host: "huggingface.co",
        model: "Wan-AI/Wan2.2-TI2V-5B",
        revision: "921dbaf3f1674a56f47e83fb80a34bac8a8f203e",
        variant: "native",
      },
      refusedAt: "2026-10-27",
      reason: "REMOTE_SERVICE_REFERENCE",
      note: "Its own source names a remote service (dashscope) for extending a prompt.",
      evidence: [EVIDENCE],
      sourceUrl:
        "https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B/tree/921dbaf3f1674a56f47e83fb80a34bac8a8f203e",
    },
  ]);
  for (const entry of MODEL_CATALOG.entries)
    for (const offer of entry.offers.filter((o) => o.route === "kaggle"))
      for (const path of offer.evidence) {
        const run = JSON.parse(readFileSync(at(path), "utf8"));
        assert.equal(run.passed, true, path);
        assert.equal(run.model, entry.identity.model, path);
        assert.equal(
          Boolean(run.picture),
          offer.operation === "imageToVideo",
          path,
        );
      }
});

test("the catalog's words for operations and roles are the contract's", () => {
  const { properties } = z.toJSONSchema(CatalogOfferSchema) as any;
  assert.deepEqual(properties.operation.enum, Operation.options);
  const roles = new Set<string>();
  const visit = (value: any): void => {
    if (typeof value !== "object" || value === null) return;
    for (const role of [
      value.properties?.role?.const,
      ...(value.properties?.role?.enum ?? []),
    ])
      if (role !== undefined) roles.add(role);
    Object.values(value).forEach(visit);
  };
  visit(
    z.toJSONSchema(EngineRequestV2Schema, {
      io: "input",
      unrepresentable: "any",
    }),
  );
  assert.deepEqual(
    [...properties.limits.properties.roles.items.enum].sort(),
    [...roles].sort(),
  );
});

test("every Kaggle recipe has one catalog offer with the same facts, and every kaggle offer has a recipe", () => {
  assert.deepEqual(catalogDisagreements(REAL), []);
  const list = CHECKED_LISTS.kaggleRecipes;
  const [wan] = KAGGLE_RECIPES;
  const set = (over: Partial<CheckedLists["kaggleRecipes"][number]>) =>
    catalogDisagreements(
      listsLike((l) => {
        l.kaggleRecipes[0] = { ...wan, ...over };
      }),
    );
  for (const [field, value] of [
    ["model", "Someone/Else"],
    ["revision", "0".repeat(40)],
    ["licence", "MIT"],
    ["operation", "imageToVideo"],
    ["width", 1],
    ["height", 1],
    ["frames", 1],
    ["fps", 1],
    ["steps", 1],
    ["offered", false],
  ] as const)
    only(set({ [field]: value }), list, wan.id, `${field} is `);
  assert.deepEqual(set({ licence: "apache-2.0" }), []);
  only(
    catalogDisagreements(
      listsLike((l) => {
        l.kaggleRecipes.push({ ...wan, id: "kaggle-new" });
      }),
    ),
    list,
    "kaggle-new",
    "0 Kaggle offers",
  );
  only(
    catalogDisagreements(
      listsLike((l) => {
        l.kaggleRecipes.push(wan);
      }),
    ),
    list,
    wan.id,
    "more than once",
  );
  only(
    catalogDisagreements(
      listsLike((l) => {
        l.kaggleRecipes.shift();
      }),
    ),
    list,
    wan.id,
    "not in this list",
  );
  // Neither can the catalog say one twice, or hold a Kaggle offer of nothing.
  only(
    catalogDisagreements(
      REAL,
      catalogLike((c) => {
        c.entries[1].offers.push(c.entries[0].offers[1]);
      }),
    ),
    list,
    KAGGLE_RECIPES[1].id,
    "2 Kaggle offers",
  );
  only(
    catalogDisagreements(
      REAL,
      catalogLike((c) => {
        c.entries[0].offers.push({
          ...c.entries[0].offers[0],
          recipeId: null,
          lifecycle: "candidate",
        });
      }),
    ),
    list,
    MODEL_CATALOG.entries[0].id,
    "no recipe",
  );
});

test("the page's models agree with the catalog", () => {
  const list = CHECKED_LISTS.createModels;
  const [page] = CREATE_MODELS;
  const set = (over: Partial<CheckedLists["createModels"][number]>) =>
    catalogDisagreements(
      listsLike((l) => {
        l.createModels[0] = { ...page, ...over };
      }),
    );
  for (const [field, value] of [
    ["name", "Another"],
    ["licence", "MIT"],
    ["width", 1],
    ["height", 1],
    ["frames", 1],
    ["fps", 1],
    ["steps", 1],
    ["readsAboutWords", 5],
  ] as const)
    only(set({ [field]: value }), list, page.id, `${field} is `);
  assert.deepEqual(set({ licence: "apache-2.0" }), []);
  only(
    catalogDisagreements(
      listsLike((l) => {
        l.createModels.push({ ...page, id: "Someone/Else" });
      }),
    ),
    list,
    "Someone/Else",
    "model has no Kaggle text offer",
  );
  // What is offered from text is on the page, and each offer of it agrees.
  only(
    catalogDisagreements(
      listsLike((l) => {
        l.createModels.shift();
      }),
    ),
    list,
    page.id,
    "not in this list",
  );
  const twice = catalogDisagreements(
    REAL,
    catalogLike((c) => {
      c.entries[0].offers.push({
        ...c.entries[0].offers[0],
        recipeId: "kaggle-second",
        limits: { ...c.entries[0].offers[0].limits, width: 1 },
      });
    }),
  );
  assert.equal(twice.length, 2);
  assert.ok(twice.some((t) => t.startsWith(list) && t.includes("width is ")));
  // The page is checked against what is offered, where a retired revision is kept too.
  const older = catalogLike((c) => {
    const old = structuredClone(c.entries[0]);
    old.id = "older";
    old.identity.revision = "0".repeat(40);
    old.offers = [
      {
        ...old.offers[0],
        recipeId: "kaggle-older",
        lifecycle: "retired",
        limits: { ...old.offers[0].limits, width: 1 },
      },
    ];
    c.entries.unshift(old);
  });
  only(
    catalogDisagreements(REAL, older),
    CHECKED_LISTS.kaggleRecipes,
    "kaggle-older",
  );
  // A model that is not offered need not be on the page.
  only(
    catalogDisagreements(
      REAL,
      catalogLike((c) => {
        c.entries.push({
          ...c.entries[0],
          id: "gone",
          identity: { ...c.entries[0].identity, model: "Someone/Gone" },
          offers: [
            {
              ...c.entries[0].offers[0],
              recipeId: "kaggle-gone",
              lifecycle: "retired",
            },
          ],
        });
      }),
    ),
    CHECKED_LISTS.kaggleRecipes,
    "kaggle-gone",
  );
  // And against its own offer: not another operation's, nor another route's.
  for (const [route, operation, checked] of [
    ["kaggle", "imageToVideo", "kaggleRecipes"],
    ["local", "textToVideo", "modelPins"],
  ] as const)
    only(
      catalogDisagreements(
        REAL,
        catalogLike((c) => {
          c.entries[0].offers.unshift({
            ...c.entries[0].offers[0],
            route,
            operation,
            recipeId: "another",
            limits: { ...c.entries[0].offers[0].limits, width: 1 },
          });
        }),
      ),
      CHECKED_LISTS[checked],
      "another",
      "not in this list",
    );
});

test("every candidate in the frozen evidence is a local candidate offer or a refusal, by repository and commit", () => {
  assert.equal(createHash("sha256").update(raw).digest("hex"), FROZEN);
  const list = CHECKED_LISTS.candidates;
  const place = (status: string) => {
    const i = evidence.candidates.findIndex((c) => c.status === status);
    assert.ok(i >= 0, status);
    return i;
  };
  const eligible = place("eligibleForQualification");
  const blocked = place("blocked");
  const model = (
    i: number,
    over: { commit?: string; repo?: string; license?: string },
  ) =>
    catalogDisagreements(
      listsLike((l) => {
        Object.assign(l.candidates[i].model, over);
      }),
    );
  const id = evidence.candidates[eligible].id;
  const blockedId = evidence.candidates[blocked].id;
  const commit = "0".repeat(40);
  only(model(eligible, { commit }), list, id, `revision ${commit}`);
  only(model(eligible, { repo: "Some/Other" }), list, id, "model Some/Other");
  only(model(eligible, { license: "mit" }), list, id, "licence is ");
  only(
    model(blocked, { commit }),
    list,
    blockedId,
    `revision ${commit}`,
    "not refused",
  );
  only(
    model(blocked, { repo: "Some/Other" }),
    list,
    blockedId,
    "model Some/Other",
    "not refused",
  );
  const change = (i: number, over: object) =>
    catalogDisagreements(
      listsLike((l) => {
        Object.assign(l.candidates[i], over);
      }),
    );
  for (const [i, kind] of [
    [eligible, "native"],
    [blocked, "diffusers"],
  ] as const)
    only(
      change(i, { runtime: { ...evidence.candidates[i].runtime, kind } }),
      list,
      evidence.candidates[i].id,
      "variant is ",
    );
  // One that is refused and one that is not are never the other as well.
  for (const status of ["blocked", "eligibleForQualification"] as const) {
    const i = place(status);
    const found = catalogDisagreements(
      REAL,
      catalogLike((c) => {
        const from = evidence.candidates[i].model;
        const identity = {
          host: "huggingface.co",
          model: from.repo,
          revision: from.commit,
          variant: "another",
        };
        if (status === "blocked")
          c.entries.push({
            ...c.entries[0],
            id: "another",
            identity,
            offers: [],
          });
        else c.refused.push({ ...c.refused[0], id: "another", identity });
      }),
    );
    only(found, list, evidence.candidates[i].id, `status is ${status}`);
  }
  const roles = change(eligible, {
    operations: evidence.candidates[eligible].operations.map((o) =>
      o.operation === "imageToVideo"
        ? { ...o, roles: ["firstFrame", "lastFrame"] }
        : o,
    ),
  });
  only(roles, list, id, "roles of imageToVideo is ");
  only(
    change(eligible, {
      operations: evidence.candidates[eligible].operations.filter(
        (o) => o.operation !== "imageToVideo",
      ),
    }),
    list,
    id,
    "imageToVideo",
    "not its own",
  );
  for (const altered of [
    (c: ModelCatalog) => {
      c.entries[0].offers = c.entries[0].offers.filter(
        (o) => o.route !== "local" || o.operation !== "imageToVideo",
      );
    },
    (c: ModelCatalog) => {
      for (const o of c.entries[0].offers)
        if (o.route === "local" && o.operation === "imageToVideo")
          o.lifecycle = "retired";
    },
    (c: ModelCatalog) => {
      for (const o of c.entries[0].offers)
        if (o.route === "local" && o.operation === "imageToVideo")
          o.route = "comfyui";
    },
  ])
    only(
      catalogDisagreements(REAL, catalogLike(altered)),
      list,
      "imageToVideo",
      "not a local candidate",
    );
});

test("nothing is pinned today, and a pin without a catalog offer is reported", () => {
  assert.equal(PINNED_COMFY_RECIPES.length, 0);
  assert.equal(PINNED_MODEL_MANIFESTS.length, 0);
  for (const [key, route, elsewhere] of [
    ["comfyRecipes", "comfyui", "local"],
    ["modelPins", "local", "comfyui"],
  ] as const) {
    const pin = { id: "pin-one", operation: "textToVideo" as const };
    const lists = { ...REAL, [key]: [pin] };
    const list = CHECKED_LISTS[key];
    only(catalogDisagreements(lists), list, pin.id, `0 ${route} offers`);
    const offering = (
      on: "comfyui" | "local",
      operation: "textToVideo" | "imageToVideo" = "textToVideo",
    ) =>
      catalogLike((c) => {
        c.entries[0].offers.push({
          ...c.entries[0].offers[0],
          route: on,
          recipeId: pin.id,
          operation,
          lifecycle: "qualified",
        });
      });
    assert.deepEqual(catalogDisagreements(lists, offering(route)), []);
    only(
      catalogDisagreements(lists, offering(route, "imageToVideo")),
      list,
      pin.id,
      "operation is ",
    );
    only(
      catalogDisagreements(REAL, offering(route)),
      list,
      pin.id,
      "not in this list",
    );
    // The right id on another route is no offer of it.
    assert.equal(catalogDisagreements(lists, offering(elsewhere)).length, 2);
  }
});

test("every evidence path the catalog names exists in the repository", () => {
  const named = [
    ...MODEL_CATALOG.entries.flatMap((e) => e.offers),
    ...MODEL_CATALOG.refused,
  ].flatMap((x) => x.evidence);
  assert.equal(named.length, 7);
  for (const path of named) assert.ok(existsSync(at(path)), path);
});

test("a lookup finds the one entry or offer, and none it does not hold", () => {
  for (const r of KAGGLE_RECIPES) {
    const entry = catalogEntryFor(r.model, r.revision)!;
    assert.equal(entry.identity.model, r.model);
    assert.equal(entry.identity.revision, r.revision);
    const found = catalogOfferFor(r.id)!;
    assert.equal(found.entry, entry);
    assert.equal(found.offer.recipeId, r.id);
  }
  const [wan] = KAGGLE_RECIPES;
  assert.equal(catalogEntryFor(wan.model, "0".repeat(40)), undefined);
  assert.equal(catalogEntryFor("Someone/Else", wan.revision), undefined);
  // A refused model is no entry.
  const { model, revision } = MODEL_CATALOG.refused[0].identity;
  assert.equal(catalogEntryFor(model, revision), undefined);
  assert.equal(catalogOfferFor("kaggle-none"), undefined);
  // One of two variants would be a guess.
  const both = parseModelCatalog(
    catalogLike((c) => {
      c.entries.push({
        ...c.entries[0],
        id: "another",
        identity: { ...c.entries[0].identity, variant: "another" },
        offers: [],
      });
    }),
  );
  assert.equal(both.entries.length, 3);
  assert.equal(catalogEntryFor(wan.model, wan.revision, both), undefined);
});

test("a catalog with no exact identity, a double, or a refusal without its reason is refused", () => {
  for (const revision of [
    "main",
    "v1.0",
    "0".repeat(39),
    "0".repeat(41),
    "A".repeat(40),
    undefined,
  ])
    refused((c) => {
      c.entries[0].identity.revision = revision as string;
    }, /revision/);
  refused((c) => {
    c.entries[1].identity = { ...c.entries[0].identity };
  }, /identity once/);
  refused((c) => {
    c.entries[1].identity = {
      ...c.entries[0].identity,
      model: c.entries[0].identity.model.toUpperCase(),
    };
  }, /identity once/);
  refused((c) => {
    c.refused[0].identity = { ...c.entries[0].identity };
  }, /identity once/);
  refused((c) => {
    c.refused[0].id = c.entries[0].id;
  }, /id once/);
  refused((c) => {
    c.refused[0].evidence = [];
  }, /evidence/);
  refused((c) => {
    c.refused[0].reason = undefined as never;
  }, /reason/);
  refused((c) => {
    c.entries[0].offers[0].evidence = [];
  }, /evidence/);
  refused((c) => {
    c.entries[0].offers[0].recipeId = null;
  }, /no recipe/);
  refused((c) => {
    c.entries[1].offers[0].recipeId = c.entries[0].offers[0].recipeId;
  }, /recipe in one offer/);
  refused((c) => {
    c.entries[0].offers.push(c.entries[0].offers[2]);
  }, /candidate without a recipe/);
});

test("each field has its form and its bound", () => {
  const [entry] = MODEL_CATALOG.entries;
  const [refusal] = MODEL_CATALOG.refused;
  const x = (n: number) => "x".repeat(n);
  const url = "https://huggingface.co/";
  const path = "docs/evidence/";
  const urls = [
    "",
    "http://huggingface.co/a/b",
    "https://user@huggingface.co/a/b",
    "https://huggingface.co/a?b",
    "https://huggingface.co/a#b",
    "https://../a",
    "https://a..b/a",
    "https://127.0.0.1/a",
    "https://localhost/a",
    "https://huggingface.co/../a",
    "https://huggingface.co//a",
    "https://huggingface.co/",
    url + x(301 - url.length),
  ];
  const paths = [
    "",
    "docs/evidence/",
    "docs/evidence/folder",
    "docs/evidence/x.",
    "docs/evidence/a./x.json",
    "docs/evidence/../secret.json",
    "docs/evidence/a/./x.json",
    "docs/evidence//x.json",
    "docs/evidence/a//x.json",
    "/docs/evidence/x.json",
    "docs/other/x.json",
    `${path}${x(196 - path.length)}.json`,
  ];
  const ids = ["", "Upper", "-x", "a b", "a/b", x(65)];
  const texts = (max: number) => ["", " ", " a", "a ", x(max + 1)];
  const dates = ["", "2026-13-01", "27-10-2026", "2026-10-27T00:00:00Z"];
  const counts = [0, -1, 1.5, "1", 1_000_001, NaN];
  const bad: [string, readonly unknown[], (c: ModelCatalog, v: any) => void][] =
    [
      ["format", ["yamakan.model-catalog/v2"], (c, v) => (c.format = v)],
      ["id", ids, (c, v) => (c.entries[0].id = v)],
      ["id", ids, (c, v) => (c.refused[0].id = v)],
      ["recipeId", ids, (c, v) => (c.entries[0].offers[0].recipeId = v)],
      ["name", texts(80), (c, v) => (c.entries[0].name = v)],
      ["note", texts(300), (c, v) => (c.refused[0].note = v)],
      [
        "host",
        [
          "",
          "HuggingFace.co",
          "https://huggingface.co",
          "localhost",
          "127.0.0.1",
          "a..b",
          "-a.co",
          "a-.co",
          `${x(64)}.co`,
          `${Array(5).fill(x(60)).join(".")}.co`,
        ],
        (c, v) => (c.entries[0].identity.host = v),
      ],
      [
        "model",
        [
          "",
          "Family",
          "a/b/c",
          "/b",
          "a/",
          "a b/c",
          `${x(65)}/b`,
          `a/${x(97)}`,
        ],
        (c, v) => (c.entries[0].identity.model = v),
      ],
      [
        "variant",
        ["", "Diffusers", "a b", "-a", x(33)],
        (c, v) => (c.entries[0].identity.variant = v),
      ],
      [
        "weightsLicence",
        ["", "a b", x(41)],
        (c, v) => (c.entries[0].licence.weightsLicence = v),
      ],
      ["sourceUrl", urls, (c, v) => (c.entries[0].licence.sourceUrl = v)],
      ["sourceUrl", urls, (c, v) => (c.entries[0].sourceUrl = v)],
      ["sourceUrl", urls, (c, v) => (c.refused[0].sourceUrl = v)],
      ["verifiedAt", dates, (c, v) => (c.entries[0].licence.verifiedAt = v)],
      ["verifiedAt", dates, (c, v) => (c.entries[0].verifiedAt = v)],
      ["refusedAt", dates, (c, v) => (c.refused[0].refusedAt = v)],
      ["reason", ["", "OTHER"], (c, v) => (c.refused[0].reason = v)],
      ["evidence", paths, (c, v) => (c.refused[0].evidence = [v])],
      [
        "evidence",
        [["docs/evidence/a.json", "docs/evidence/A.json"]],
        (c, v) => (c.entries[0].offers[0].evidence = v),
      ],
      ["route", ["hosted"], (c, v) => (c.entries[0].offers[0].route = v)],
      ["lifecycle", ["live"], (c, v) => (c.entries[0].offers[0].lifecycle = v)],
      ["operation", ["sing"], (c, v) => (c.entries[0].offers[0].operation = v)],
      [
        "roles",
        [["firstFrame", "firstFrame"], ["frame"]],
        (c, v) => (c.entries[0].offers[0].limits.roles = v),
      ],
      ...(["width", "height", "frames", "fps", "steps", "promptWordsRead"].map(
        (field) => [
          field,
          counts,
          (c: ModelCatalog, v: any) => {
            Object.assign(c.entries[0].offers[0].limits, { [field]: v });
          },
        ],
      ) as any),
      ...([
        ["count", counts],
        ["maxBytes", [0, -1, 1.5]],
        [
          "mediaTypes",
          [[], [" "], ["image"], ["image/png", "image/png"], [`a/${x(40)}`]],
        ],
      ].map(([field, values]) => [
        field,
        values,
        (c: ModelCatalog, v: any) => {
          c.entries[0].offers[0].limits.references = {
            count: 1,
            mediaTypes: ["image/png"],
            maxBytes: 1,
            [field as string]: v,
          };
        },
      ]) as any),
    ];
  for (const [field, values, set] of bad)
    for (const value of values)
      refused((c) => set(c, value), new RegExp(`"${field}"`));
  // Nothing more than these fields, at any depth.
  for (const inner of [
    (c: ModelCatalog) => c,
    (c: ModelCatalog) => c.entries[0],
    (c: ModelCatalog) => c.entries[0].identity,
    (c: ModelCatalog) => c.entries[0].licence,
    (c: ModelCatalog) => c.entries[0].offers[0],
    (c: ModelCatalog) => c.entries[0].offers[0].limits,
    (c: ModelCatalog) => c.refused[0],
  ])
    refused((c) => {
      Object.assign(inner(c), { extra: 1 });
    }, /extra/);
  // The longest and the plainest of each do pass.
  parseModelCatalog(
    catalogLike((c) => {
      c.entries[0].name = x(80);
      c.refused[0].note = x(300);
      c.entries[0].identity.host = "models.example.co";
      c.entries[0].identity.variant = x(32);
      c.entries[0].sourceUrl = url + x(300 - url.length);
      c.entries[0].offers[0].evidence = [`${path}${x(195 - path.length)}.json`];
      c.entries[0].offers[0].limits.references = {
        count: 1_000_000,
        mediaTypes: ["image/png", "image/jpeg"],
        maxBytes: 1,
      };
    }),
  );
  for (const reason of [
    "REMOTE_SERVICE_REFERENCE",
    "LICENCE_UNACCEPTED",
    "ROUTE_RETIRED",
    "ROUTE_PROHIBITED",
    "INTERFACE_UNSUPPORTED",
  ] as const)
    parseModelCatalog(
      catalogLike((c) => {
        c.refused[0].reason = reason;
      }),
    );
  // Another host, revision or variant is another identity.
  for (const over of [
    { host: "example.co" },
    { revision: "0".repeat(40) },
    { variant: "another" },
  ])
    parseModelCatalog(
      catalogLike((c) => {
        c.refused.push({
          ...refusal,
          id: "another",
          identity: { ...entry.identity, ...over },
        });
      }),
    );
});

test("a catalog past its bounds is refused", () => {
  const revision = (i: number) => i.toString(16).padStart(40, "0");
  const [first] = MODEL_CATALOG.entries;
  const entries = (n: number, offers: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...first,
      id: `entry-${i}`,
      identity: { ...first.identity, revision: revision(i) },
      offers: Array.from({ length: offers }, (__, k) => ({
        ...first.offers[0],
        recipeId: `recipe-${i}-${k}`,
      })),
    }));
  refused((c) => {
    c.entries = entries(65, 1);
  }, /entries/);
  refused((c) => {
    c.entries = entries(1, 9);
  }, /offers/);
  refused((c) => {
    c.refused = Array.from({ length: 33 }, (_, i) => ({
      ...c.refused[0],
      id: `refused-${i}`,
      identity: { ...c.refused[0].identity, revision: revision(i) },
    }));
  }, /refused/);
  refused((c) => {
    c.refused[0].evidence = Array.from(
      { length: 9 },
      (_, i) => `docs/evidence/${i}.json`,
    );
  }, /evidence/);
  const bytes = (c: ModelCatalog) => Buffer.byteLength(JSON.stringify(c));
  // Inside every count, and too many bytes.
  const big = catalogLike((c) => {
    c.entries = entries(64, 8);
  });
  assert.ok(bytes(big) > MODEL_CATALOG_LIMITS.bytes);
  assert.throws(() => parseModelCatalog(big), /too large/);
  // The most entries it may hold do fit.
  const held = catalogLike((c) => {
    c.entries = entries(64, 1);
  });
  assert.ok(bytes(held) <= MODEL_CATALOG_LIMITS.bytes, `${bytes(held)}`);
  parseModelCatalog(held);
});

test("the catalog imports zod and types only", () => {
  const source = readFileSync(at("core/engines/catalog.ts"), "utf8");
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\brequire\s*\(|\bimport\s*\(|node:/);
  assert.doesNotMatch(
    code,
    /\b(fetch|WebSocket|XMLHttpRequest|EventSource|process|globalThis|readFile|spawn|execFile)\b/,
  );
  // Every way one module names another.
  const named = [...code.matchAll(/^(.*)\bfrom\s+"([^"]+)"/gm)];
  assert.ok(named.length >= 5);
  for (const [, before, from] of named)
    if (from !== "zod")
      assert.match(before, /^import type \{ [A-Za-z0-9, ]+ \} $/, from);
  assert.equal((code.match(/\bfrom\s*["']/g) ?? []).length, named.length);
  assert.doesNotMatch(code, /^import\s*["']/m);
});
