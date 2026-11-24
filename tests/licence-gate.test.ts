// MPR-208: every model that is offered carries a whole licence block that code checks, and one that
// is unknown, incomplete or not for commercial use is not offered (docs/MODEL_LICENCE_GATE.md).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Scopes, execute } from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { ProjectStore } from "../core/store.ts";
import {
  LICENCE_FIELDS,
  LicenceBlockSchema,
  PRE_GATE_EXCEPTIONS,
  licenceGate,
  openLicenceFields,
  recipeLicence,
  type LicenceBlock,
  type LicenceRefusal,
  type LicenceUse,
} from "../core/engines/licence.ts";
import { MODEL_CATALOG, catalogOfferFor } from "../core/engines/catalog.ts";
import { PINNED_COMFY_RECIPES } from "../core/engines/comfyui.ts";
import { PINNED_MODEL_MANIFESTS } from "../core/engines/manifests.ts";
import {
  KAGGLE_RECIPES,
  kaggleLicence,
  offeredKaggleRecipes,
} from "../core/engines/kaggle.ts";
import { MESSAGES } from "../src/i18n.ts";
import { licenceTerm, wholeLicence } from "./fixtures/licence-block.ts";

const HOSTED: LicenceUse = { run: "hosted" };
const LOCAL: LicenceUse = { run: "local" };
const term = licenceTerm;
const whole = wholeLicence;
const block = (over: object) => ({ ...whole(), ...over });
const refused = (value: unknown, use: LicenceUse = HOSTED) => {
  const gate = licenceGate(value, use);
  return gate.offered ? [] : gate.reasons;
};

test("a whole block that allows it is offered, hosted and local", () => {
  for (const use of [HOSTED, LOCAL])
    assert.deepEqual(licenceGate(whole(), use), { offered: true });
  // A mark that is known, and a credit that is asked for, are no refusals.
  for (const over of [
    { watermark: { kind: "invisible", note: "In every frame." } },
    { attribution: { kind: "required", text: "Keep its notice." } },
    { baseModel: term({ name: "MIT", spdx: "MIT" }) },
    { weights: term({ spdx: "apache-2.0" }) },
    { bundled: [] },
  ])
    assert.deepEqual(refused(block(over)), [], JSON.stringify(over));
});

test("each reason refuses, alone where it can be", () => {
  const unknownTerm = term({ commercialUse: "unknown" });
  const bundled = (t: object) => ({
    bundled: [{ name: "x", role: "part", term: t }],
  });
  const cases: [LicenceRefusal[], object, LicenceUse?][] = [
    [["FIELD_UNKNOWN"], { weights: unknownTerm }],
    [["FIELD_UNKNOWN"], { code: unknownTerm }],
    [["FIELD_UNKNOWN"], { baseModel: unknownTerm }],
    [["FIELD_UNKNOWN"], bundled(unknownTerm)],
    [["FIELD_UNKNOWN"], { revenueCap: { kind: "unknown" } }],
    [["FIELD_UNKNOWN"], { territorialExclusions: { kind: "unknown" } }],
    [["FIELD_UNKNOWN"], { outputUse: { kind: "unknown" } }],
    [["FIELD_UNKNOWN"], { watermark: { kind: "unknown" } }],
    [["FIELD_UNKNOWN"], { gated: "unknown" }],
    [["FIELD_UNKNOWN"], { attribution: { kind: "unknown" } }],
    [
      ["FIELD_UNKNOWN", "HOSTED_RUN_NOT_ALLOWED"],
      { hostedServiceRight: "unknown" },
    ],
    [["HOSTED_RUN_NOT_ALLOWED"], { hostedServiceRight: "notAllowed" }],
    [[], { hostedServiceRight: "unknown" }, LOCAL],
    [[], { hostedServiceRight: "notAllowed" }, LOCAL],
    [["NOT_READ_AT_SOURCE"], { evidence: "IND" }],
    [["NOT_READ_AT_SOURCE"], { evidence: "ASSUMED" }],
    [["NOT_READ_AT_SOURCE"], { evidence: "CLAIM" }],
    [["NOT_READ_AT_SOURCE"], { evidence: "UNKNOWN" }],
    [["LICENCE_UNACCEPTED"], { weights: term({ spdx: "MPL-2.0" }) }],
    [["LICENCE_UNACCEPTED"], { weights: term({ spdx: null }) }],
    [["LICENCE_UNACCEPTED"], { baseModel: term({ spdx: "openrail" }) }],
    [["LICENCE_UNACCEPTED"], { code: term({ spdx: "GPL-3.0-only" }) }],
    [["LICENCE_UNACCEPTED"], bundled(term({ spdx: "LGPL-2.1-only" }))],
    [["LICENCE_UNACCEPTED"], bundled(term({ spdx: null }))],
    // Accepted for a package and not for a model.
    [[], bundled(term({ spdx: "MPL-2.0 AND (MIT OR ISC)" }))],
    [["NON_COMMERCIAL"], { weights: term({ commercialUse: "notAllowed" }) }],
    [["NON_COMMERCIAL"], { code: term({ commercialUse: "notAllowed" }) }],
    [["NON_COMMERCIAL"], { baseModel: term({ commercialUse: "notAllowed" }) }],
    [["NON_COMMERCIAL"], bundled(term({ commercialUse: "notAllowed" }))],
    [
      ["REVENUE_CAP"],
      { revenueCap: { kind: "cap", amount: 1_000_000, currency: "USD" } },
    ],
    [
      ["TERRITORY_EXCLUDED"],
      { territorialExclusions: { kind: "excluded", regions: ["EU"] } },
    ],
    [
      ["OUTPUT_USE_RESTRICTED"],
      { outputUse: { kind: "restricted", note: "Not to train a model." } },
    ],
    [["GATED"], { gated: "yes" }],
  ];
  for (const [reasons, over, use] of cases)
    assert.deepEqual(
      refused(block(over), use),
      reasons,
      `${JSON.stringify(over)} ${use?.run}`,
    );
});

test("a block that is absent or not of the form is refused, and every reason is said", () => {
  assert.deepEqual(refused(undefined), ["BLOCK_MISSING"]);
  assert.deepEqual(refused(null), ["BLOCK_MISSING"]);
  for (const odd of ["Apache-2.0", 7, [], {}])
    assert.deepEqual(refused(odd), ["BLOCK_INVALID"]);
  for (const key of Object.keys(whole())) {
    const { [key as keyof LicenceBlock]: _, ...rest } = whole();
    assert.deepEqual(refused(rest), ["BLOCK_INVALID"], `without ${key}`);
  }
  for (const over of [
    { extra: 1 },
    { code: { ...term(), extra: 1 } },
    { code: { name: "x", spdx: null } },
    { weights: term({ name: "" }) },
    { weights: term({ name: "x".repeat(81) }) },
    { weights: term({ commercialUse: "yes" }) },
    { baseModel: { kind: "none", name: "x" } },
    { bundled: [{ name: "x", role: "y", term: term(), extra: 1 }] },
    {
      bundled: Array.from({ length: 2 }, () => ({
        name: "x",
        role: "y",
        term: term(),
      })),
    },
    {
      bundled: Array.from({ length: 17 }, (_, n) => ({
        name: `x${n}`,
        role: "y",
        term: term(),
      })),
    },
    { bundledReviewed: false },
    { revenueCap: { kind: "cap" } },
    { revenueCap: { kind: "cap", amount: 1, currency: "dollars" } },
    { territorialExclusions: { kind: "excluded", regions: [] } },
    { outputUse: { kind: "restricted" } },
    { watermark: { kind: "visible" } },
    { attribution: { kind: "required" } },
    { gated: "maybe" },
    { sourceUrl: "http://example.com/a" },
    { sourceUrl: "https://example.com/a?b=c" },
    { sourceUrl: "https://127.0.0.1/a" },
    { sourceUrl: `https://example.com/${"a".repeat(300)}` },
    { verifiedAt: "24 November" },
    { evidence: "READ" },
  ])
    assert.deepEqual(
      refused(block(over)),
      ["BLOCK_INVALID"],
      JSON.stringify(over),
    );
  assert.equal(
    LicenceBlockSchema.safeParse(
      block({
        bundled: Array.from({ length: 16 }, (_, n) => ({
          name: `x${n}`,
          role: "y",
          term: term(),
        })),
      }),
    ).success,
    true,
  );
  // As most of what refuses a model is together.
  assert.deepEqual(
    refused(
      block({
        weights: term({ spdx: "other", commercialUse: "notAllowed" }),
        revenueCap: { kind: "cap", amount: 0, currency: "EUR" },
        territorialExclusions: { kind: "excluded", regions: ["EU", "KR"] },
        hostedServiceRight: "notAllowed",
        outputUse: { kind: "restricted", note: "No." },
        watermark: { kind: "unknown" },
        gated: "yes",
        evidence: "IND",
      }),
    ),
    [
      "FIELD_UNKNOWN",
      "NOT_READ_AT_SOURCE",
      "LICENCE_UNACCEPTED",
      "NON_COMMERCIAL",
      "REVENUE_CAP",
      "TERRITORY_EXCLUDED",
      "HOSTED_RUN_NOT_ALLOWED",
      "OUTPUT_USE_RESTRICTED",
      "GATED",
    ],
  );
});

// The shapes of the research notes' negative cases, each as a made block: no model is named, since
// nothing here was read for it.
test("the licence of a model is that of its most restrictive part", () => {
  // Weights that allow everything, with a text encoder behind a gate under a licence not accepted.
  assert.deepEqual(
    refused(
      block({
        bundled: [
          {
            name: "a text encoder",
            role: "text encoder",
            term: term({ name: "a community licence", spdx: null }),
          },
        ],
        gated: "yes",
      }),
    ),
    ["LICENCE_UNACCEPTED", "GATED"],
  );
  // A revenue limit and excluded countries refuse whatever the licence is called.
  assert.deepEqual(
    refused(
      block({ revenueCap: { kind: "cap", amount: 1e6, currency: "USD" } }),
    ),
    ["REVENUE_CAP"],
  );
  assert.deepEqual(
    refused(
      block({ territorialExclusions: { kind: "excluded", regions: ["EU"] } }),
    ),
    ["TERRITORY_EXCLUDED"],
  );
});

test("the open fields are those that are not known, by name", () => {
  assert.deepEqual(openLicenceFields(whole(), HOSTED), []);
  const unknown = term({ commercialUse: "unknown" });
  const open = LicenceBlockSchema.parse(
    block({
      code: unknown,
      weights: unknown,
      baseModel: unknown,
      bundled: [
        { name: "known", role: "r", term: term() },
        { name: "not known", role: "r", term: unknown },
      ],
      revenueCap: { kind: "unknown" },
      territorialExclusions: { kind: "unknown" },
      hostedServiceRight: "unknown",
      outputUse: { kind: "unknown" },
      watermark: { kind: "unknown" },
      gated: "unknown",
      attribution: { kind: "unknown" },
      evidence: "ASSUMED",
    }),
  );
  const found = openLicenceFields(open, HOSTED);
  assert.deepEqual(
    found.map((o) => o.field),
    [...LICENCE_FIELDS],
  );
  assert.deepEqual(
    found.filter((o) => o.part !== null),
    [{ field: "bundled", part: "not known" }],
  );
  assert.ok(
    !openLicenceFields(open, LOCAL).some(
      (o) => o.field === "hostedServiceRight",
    ),
  );
  for (const lang of ["en", "ar"] as const)
    for (const field of LICENCE_FIELDS)
      assert.ok(MESSAGES[lang][`create.licenceField.${field}`], field);
});

// What each offered entry lacks, as a person reads it: its recipe and the field.
const EXEMPT = PRE_GATE_EXCEPTIONS.recipes.map((r) => r.recipeId);
const lacking = (
  entries: typeof MODEL_CATALOG.entries,
  exempt: readonly string[] = EXEMPT,
) =>
  entries.flatMap((entry) =>
    entry.offers
      .filter((o) => o.lifecycle === "offered" || o.lifecycle === "qualified")
      .filter((o) => !exempt.includes(o.recipeId ?? ""))
      .flatMap((o) => {
        const use: LicenceUse = {
          run: o.route === "kaggle" ? "hosted" : "local",
        };
        const gate = licenceGate(entry.licence, use);
        if (gate.offered) return [];
        const parsed = LicenceBlockSchema.safeParse(entry.licence);
        const fields = parsed.success
          ? openLicenceFields(parsed.data, use).map((f) => f.field)
          : parsed.error.issues.map((i) => i.path.join("."));
        return [
          `${o.recipeId ?? entry.id}: ${gate.reasons.join(", ")} (${fields.join(", ")})`,
        ];
      }),
  );

test("every offered entry has a whole block, but for the recipes from before the gate", () => {
  assert.deepEqual(lacking(MODEL_CATALOG.entries), []);
  // Each list that could offer one, whether or not the catalog calls it offered.
  for (const recipe of KAGGLE_RECIPES)
    assert.equal(kaggleLicence(recipe).offered, true, recipe.id);
  for (const { id } of [...PINNED_COMFY_RECIPES, ...PINNED_MODEL_MANIFESTS])
    assert.deepEqual(
      licenceGate(catalogOfferFor(id)?.entry.licence, LOCAL),
      { offered: true },
      id,
    );
  // A pinned manifest has rights of its own, and none is pinned: the first one is to be held to its
  // block here.
  assert.equal(PINNED_MODEL_MANIFESTS.length, 0, "compare its rights");
  // The check can fail, and says which and what: with no exception, and with a field taken out of a
  // whole one.
  const all = lacking(MODEL_CATALOG.entries, []);
  assert.equal(all.length, 3);
  for (const id of EXEMPT)
    assert.ok(
      all.some((l) => l.startsWith(`${id}: FIELD_UNKNOWN`)),
      id,
    );
  const entry = structuredClone(MODEL_CATALOG.entries[0]!);
  entry.licence = whole();
  assert.deepEqual(lacking([entry], []), []);
  delete (entry.licence as Partial<LicenceBlock>).watermark;
  const [missing] = lacking([entry], []);
  assert.match(missing!, /^kaggle-wan22-ti2v-5b: BLOCK_INVALID \(watermark\)/);
});

test("the list from before the gate is closed, and excuses only what is not known", () => {
  // A new entry here is a decision of the founder's, not a change of code.
  const wan = {
    model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    revision: "b8fff7315c768468a5333511427288870b2e9635",
  };
  assert.deepEqual(PRE_GATE_EXCEPTIONS, {
    at: "2026-11-24",
    recipes: [
      { recipeId: "kaggle-wan22-ti2v-5b", ...wan },
      { recipeId: "kaggle-wan22-ti2v-5b-first-frame", ...wan },
      {
        recipeId: "kaggle-cogvideox-2b",
        model: "zai-org/CogVideoX-2b",
        revision: "1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01",
      },
    ],
  });
  assert.ok(Object.isFrozen(PRE_GATE_EXCEPTIONS.recipes));
  for (const r of PRE_GATE_EXCEPTIONS.recipes) {
    assert.ok(Object.isFrozen(r));
    assert.ok(
      KAGGLE_RECIPES.some(
        (k) =>
          k.id === r.recipeId &&
          k.model === r.model &&
          k.revision === r.revision,
      ),
      r.recipeId,
    );
  }

  const [first] = PRE_GATE_EXCEPTIONS.recipes;
  const offered = (value: unknown, over: object = {}) =>
    recipeLicence({ ...first!, ...over }, value, HOSTED).offered;
  const open = block({
    bundled: [
      {
        name: "x",
        role: "y",
        term: term({ spdx: null, commercialUse: "unknown" }),
      },
    ],
    watermark: { kind: "unknown" },
    evidence: "CLAIM",
  });
  assert.equal(offered(open), true);
  assert.equal(offered(whole()), true);
  // Not for another recipe, one without a name, or another model or revision under its id.
  assert.equal(offered(open, { recipeId: "kaggle-new" }), false);
  assert.equal(offered(open, { recipeId: null }), false);
  assert.equal(offered(open, { model: "Someone/Else" }), false);
  assert.equal(offered(open, { revision: "0".repeat(40) }), false);
  // And not what is known and against it.
  for (const over of [
    { weights: term({ commercialUse: "notAllowed" }) },
    { weights: term({ spdx: "openrail" }) },
    { code: term({ spdx: "GPL-3.0-only" }) },
    { bundled: [{ name: "x", role: "y", term: term({ spdx: null }) }] },
    { revenueCap: { kind: "cap", amount: 1, currency: "USD" } },
    { territorialExclusions: { kind: "excluded", regions: ["EU"] } },
    { outputUse: { kind: "restricted", note: "No." } },
    { hostedServiceRight: "notAllowed" },
    { hostedServiceRight: "unknown" },
    { gated: "yes" },
    // A licence that is named is not one that is not known, whatever is said of its use.
    { weights: term({ spdx: "CC-BY-NC-4.0", commercialUse: "unknown" }) },
    { baseModel: term({ spdx: "openrail", commercialUse: "unknown" }) },
    { code: term({ spdx: "AGPL-3.0-only", commercialUse: "unknown" }) },
    {
      bundled: [
        {
          name: "x",
          role: "y",
          term: term({ spdx: "GPL-3.0-only", commercialUse: "unknown" }),
        },
      ],
    },
  ])
    assert.equal(offered({ ...open, ...over }), false, JSON.stringify(over));
  for (const odd of [undefined, {}, "Apache-2.0"])
    assert.equal(offered(odd), false);
});

test("today's three recipes are offered with what is not known of them", () => {
  assert.deepEqual(
    offeredKaggleRecipes().map((r) => r.id),
    EXEMPT,
  );
  const said = (id: string) => {
    const { offered, reasons, open } = kaggleLicence(
      KAGGLE_RECIPES.find((r) => r.id === id) ?? {
        id,
        model: "m",
        revision: "r",
      },
    );
    return {
      offered,
      reasons,
      open: open.map((o) => (o.part ? `${o.field}: ${o.part}` : o.field)),
    };
  };
  const run = [
    "bundled: FFmpeg in imageio-ffmpeg 0.6.0",
    "bundled: torch, NumPy and Pillow on Kaggle's machine",
    "bundled: what these packages install and use in turn",
  ];
  const wan = {
    offered: true,
    reasons: ["FIELD_UNKNOWN", "NOT_READ_AT_SOURCE", "LICENCE_UNACCEPTED"],
    open: [...run, "outputUse", "watermark", "evidence"],
  };
  assert.deepEqual(said("kaggle-wan22-ti2v-5b"), wan);
  assert.deepEqual(said("kaggle-wan22-ti2v-5b-first-frame"), wan);
  assert.deepEqual(said("kaggle-cogvideox-2b"), {
    offered: true,
    reasons: ["FIELD_UNKNOWN", "LICENCE_UNACCEPTED"],
    open: ["bundled: T5 text encoder", ...run, "watermark"],
  });
  // A recipe the catalog does not hold has no block.
  assert.deepEqual(said("kaggle-new"), {
    offered: false,
    reasons: ["BLOCK_MISSING"],
    open: [],
  });
});

test("a Kaggle recipe is dropped when its block is made incomplete, and needs the right to a hosted run", () => {
  const offeredWith = (change: (b: Record<string, unknown>) => void) =>
    offeredKaggleRecipes((id) => {
      const block = structuredClone(catalogOfferFor(id)!.entry.licence);
      if (id === "kaggle-cogvideox-2b") change(block);
      return block;
    }).map((r) => r.id);
  const two = EXEMPT.slice(0, 2);
  assert.deepEqual(
    offeredWith(() => {}),
    EXEMPT,
  );
  for (const key of Object.keys(whole()))
    assert.deepEqual(
      offeredWith((b) => delete b[key]),
      two,
      key,
    );
  // Runs there are hosted, so this is asked of each; a local run would not ask it.
  for (const right of ["unknown", "notAllowed"])
    assert.deepEqual(
      offeredWith((b) => (b.hostedServiceRight = right)),
      two,
      right,
    );
});

test("a licence's name can be kept in a take's record and shown on one line", async () => {
  const { TakeRecordSchema } = await import("../core/take-record.ts");
  const kept = (TakeRecordSchema as any).shape.model.unwrap().shape.licence as {
    safeParse: (v: unknown) => { success: boolean };
  };
  const block_ = (name: string) =>
    LicenceBlockSchema.safeParse(block({ weights: term({ name }) })).success;
  for (const name of ["A", "x".repeat(80), "ترخيص"]) {
    assert.equal(block_(name), true, name);
    assert.equal(kept.safeParse(name).success, true, name);
  }
  assert.equal(block_("x".repeat(81)), false);
  for (const odd of ["a\nb", "a\u2028b", "a\u202eb", "a\u0000b", "a\u2066b"])
    assert.equal(block_(odd), false, JSON.stringify(odd));
});

test("a recipe the gate refuses is in no list and cannot be started, and nothing is run", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-licence-"));
  const store = new ProjectStore(root);
  await store.initialize();
  const queue = new JobSupervisor(store);
  // A recipe whose licence was never read: the catalog holds no block for it.
  const recipe = KAGGLE_RECIPES.find((r) => r.id === "kaggle-cogvideox-2b") as {
    id: string;
  };
  t.after(async () => {
    recipe.id = "kaggle-cogvideox-2b";
    await queue.close();
    await store.close();
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  });
  recipe.id = "kaggle-not-read";
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
    // A program that is not there: none is started.
    kaggle: { cli: path.join(root, "no-kaggle.exe"), username: "someone" },
  } as never;
  const call = async (operation: string, parameters: object) =>
    (await execute(ctx, operation, parameters)).result as any;
  const { models } = await call("yamakan.generation.options", {});
  assert.deepEqual(
    models.map((m: { recipeId: string }) => m.recipeId),
    ["kaggle-wan22-ti2v-5b", "kaggle-wan22-ti2v-5b-first-frame"],
  );
  const { id: projectId } = await call("yamakan.project.create", {
    name: "P",
  });
  const start = (recipeId: string) =>
    call("yamakan.generation.start", {
      projectId,
      recipeId,
      prompt: "A kite.",
      seed: 1,
      width: 704,
      height: 480,
      durationFrames: 102,
    }).then(
      () => "started",
      (e: unknown) => {
        const { code, message } = toCommandError(e);
        return `${code} ${message}`;
      },
    );
  for (const id of ["kaggle-not-read", "kaggle-cogvideox-2b"])
    assert.equal(await start(id), "NOT_FOUND That recipe is not available.");
  // One that is offered gets past this, to the approvals it has not: the refusal is the gate's.
  assert.match(
    await start("kaggle-wan22-ti2v-5b"),
    /No one has approved contacting kaggle.com/,
  );
  assert.deepEqual(await call("yamakan.generation.list", { projectId }), []);
});

test("the gate reads no file, clock or network", () => {
  const source = readFileSync(
    new URL("../core/engines/licence.ts", import.meta.url),
    "utf8",
  );
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.deepEqual(
    [...code.matchAll(/\bfrom\s+"([^"]+)"/g)].map(([, from]) => from),
    ["zod"],
  );
  assert.doesNotMatch(code, /\brequire\s*\(|\bimport\s*\(|node:/);
  assert.doesNotMatch(
    code,
    /\b(fetch|WebSocket|XMLHttpRequest|process|globalThis|Date|performance|readFile)\b/,
  );
});
