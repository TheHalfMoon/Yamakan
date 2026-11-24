// MPR-206: what must be written down of a model before a route of it is qualified or offered
// (docs/MODEL_INTAKE.md), read from the catalog. It checks that a thing is there, not that it is
// right: a licence that was read is not a licence that is acceptable (MPR-208).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Operation,
  type EngineRequestV2,
} from "../core/engines/contract-v2.ts";
import {
  MODEL_CATALOG,
  ROUTES,
  type CatalogEntry,
  type CatalogOffer,
} from "../core/engines/catalog.ts";
import { kaggleRecipes } from "../core/engines/kaggle.ts";
import { ADAPTER_SUITES, PENDING } from "./fixtures/engine-suites.ts";

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p: string) =>
  readFileSync(root(p), "utf8").replaceAll("\r\n", "\n");
const fileAt = (p: string) => existsSync(root(p)) && statSync(root(p)).isFile();

// The adapter that each route runs on.
const ADAPTER_OF: Record<(typeof ROUTES)[number], string> = {
  kaggle: "kaggle.ts",
  comfyui: "comfyui.ts",
  local: "v1-bridge.ts",
};
type Role = EngineRequestV2["inputs"][number]["role"];
const ROLES_OF: Record<Operation, readonly Role[]> = {
  textToVideo: ["reference"],
  imageToVideo: ["firstFrame", "lastFrame", "reference"],
  videoEdit: ["source", "mask"],
  transcribe: ["audio"],
  enhance: ["source"],
};
const REQUIRED: Record<Operation, readonly Role[]> = {
  textToVideo: [],
  imageToVideo: ["firstFrame"],
  videoEdit: ["source"],
  transcribe: ["audio"],
  enhance: ["source"],
};
const startable = (offer: CatalogOffer) =>
  offer.route === "kaggle" &&
  kaggleRecipes().some(
    (r) => r.id === offer.recipeId && r.operation === offer.operation,
  );

// What each machine-checked item asks of an offer; null when it has it.
const MACHINE: Record<
  string,
  (entry: CatalogEntry, offer: CatalogOffer) => string | null
> = {
  identity: ({ identity: i }) =>
    i &&
    i.host &&
    /^[^/]+\/[^/]+$/.test(i.model) &&
    i.variant &&
    /^[0-9a-f]{40}$/.test(i.revision)
      ? null
      : "no full identity with an exact revision",
  licence: ({ licence: l }) =>
    l && l.weights.name && l.sourceUrl.startsWith("https://") && l.verifiedAt
      ? null
      : "no licence with its page and date",
  route: (_, offer) =>
    ROUTES.includes(offer.route) &&
    offer.recipeId !== null &&
    (offer.lifecycle !== "offered" || startable(offer))
      ? null
      : "no route that can start its recipe",
  operation: (_, offer) =>
    Operation.options.includes(offer.operation) &&
    offer.limits.roles.every((r) =>
      ROLES_OF[offer.operation].includes(r as Role),
    ) &&
    REQUIRED[offer.operation].every((r) => offer.limits.roles.includes(r))
      ? null
      : "no operation of the contract with the roles it takes",
  limits: (_, { limits: l }) =>
    [l.width, l.height, l.frames, l.fps, l.steps].every((n) => n > 0) &&
    l.durationFrames.min <= l.durationFrames.max &&
    typeof l.audioOut === "boolean"
      ? null
      : "no limits",
  evidence: (_, offer) =>
    offer.evidence.length > 0 &&
    offer.evidence.every(
      (p) => p.startsWith("docs/evidence/") && !p.includes("..") && fileAt(p),
    )
      ? null
      : "no existing evidence",
  conformance: (_, offer) =>
    Object.hasOwn(ADAPTER_SUITES, ADAPTER_OF[offer.route]) ||
    PENDING.includes(ADAPTER_OF[offer.route])
      ? null
      : "its route's adapter does not run the conformance kit",
};
const WRITTEN = ["egress", "spend", "download", "withdrawal"] as const;
const INTAKE_ITEMS = [...Object.keys(MACHINE), ...WRITTEN];

const lacks = (entry: CatalogEntry, offer: CatalogOffer) =>
  Object.entries(MACHINE).flatMap(([item, of]) => {
    const why = of(entry, offer);
    return why === null ? [] : [`${item}: ${why}`];
  });
const taken = MODEL_CATALOG.entries.flatMap((entry) =>
  entry.offers
    .filter((o) => o.lifecycle === "qualified" || o.lifecycle === "offered")
    .map((offer) => ({ entry, offer })),
);

test("the checklist in the document is the checklist in the test", () => {
  const doc = read("docs/MODEL_INTAKE.md");
  const ids = [...doc.matchAll(/^- `([a-z]+)`: /gm)].map((m) => m[1]);
  assert.deepEqual(ids, INTAKE_ITEMS);
  const [machine, written] = doc.split("## Written, in the offer's evidence");
  for (const item of Object.keys(MACHINE))
    assert.ok(machine!.includes(`- \`${item}\`:`), item);
  for (const item of WRITTEN)
    assert.ok(written!.includes(`- \`${item}\`:`), item);
});

assert.ok(taken.length, "No offer is checked.");
for (const { entry, offer } of taken)
  test(`intake of ${offer.recipeId}: every qualified or offered offer passes the machine-checked items`, () => {
    assert.deepEqual(lacks(entry, offer), []);
  });

test("an offer that lacks an item fails it, and only it", () => {
  const { entry, offer } = taken[0]!;
  for (const [item, badEntry, badOffer] of [
    ["identity", { identity: { ...entry.identity, revision: "main" } }, {}],
    ["licence", { licence: { ...entry.licence, verifiedAt: "" } }, {}],
    ["route", {}, { recipeId: "kaggle-not-there" }],
    ["route", {}, { recipeId: null }],
    ["operation", {}, { limits: { ...offer.limits, roles: ["mask"] } }],
    ["limits", {}, { limits: { ...offer.limits, width: 0 } }],
    // An empty list, and a path that is not there, or is a folder.
    ["evidence", {}, { evidence: [] }],
    ["evidence", {}, { evidence: ["docs/evidence/not-there.json"] }],
    ["evidence", {}, { evidence: ["docs/evidence/ultimate"] }],
    ["evidence", {}, { evidence: ["package.json"] }],
  ] as [string, object, object][])
    assert.deepEqual(
      lacks(
        { ...entry, ...badEntry } as CatalogEntry,
        { ...offer, ...badOffer } as CatalogOffer,
      ).map((l) => l.split(":")[0]),
      [item],
      item,
    );
  // An image-to-video that names no first frame.
  const image = taken.find((t) => t.offer.operation === "imageToVideo")!;
  assert.deepEqual(
    lacks(image.entry, {
      ...image.offer,
      limits: { ...image.offer.limits, roles: [] },
    }).map((l) => l.split(":")[0]),
    ["operation"],
  );
});

test("an offer's evidence paths exist", () => {
  const paths = new Set(
    MODEL_CATALOG.entries.flatMap((e) => e.offers.flatMap((o) => o.evidence)),
  );
  for (const p of paths) assert.ok(fileAt(p), p);
});

test("an offer's route has an adapter that runs the kit", () => {
  for (const { offer } of taken) {
    const adapter = ADAPTER_OF[offer.route];
    assert.ok(fileAt(`core/engines/${adapter}`), adapter);
    assert.equal(MACHINE.conformance!(taken[0]!.entry, offer), null);
  }
});

test("each route an offer uses has its written answers", () => {
  const doc = read("docs/evidence/model-system/engine-conformance.md");
  const intake = doc.split("\n## Intake\n")[1]?.split("\n## ")[0];
  assert.ok(intake, "No Intake section.");
  for (const route of new Set(taken.map((t) => t.offer.route))) {
    const part = intake.split(`\n### ${route}\n`)[1]?.split("\n### ")[0];
    assert.ok(part, route);
    for (const item of WRITTEN)
      assert.match(part, new RegExp(`^- \`${item}\`: \\S.{20,}`, "m"), item);
  }
});
