// MPR-202: what each route can do with each model. The commands are the real ones, on the real
// catalog; the rules are tried on catalogs that today's is not.
import "./fixtures/own-temp.ts";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { toCommandError } from "../core/command/errors.ts";
import {
  CAPABILITY_REPORT_LIMITS,
  buildCapabilityReport,
  projectGenerationOptions,
  type CapabilityReport,
  type LocalDiscovery,
} from "../core/engines/capability-report.ts";
import {
  MODEL_CATALOG,
  OPERATIONS,
  ROUTES,
  parseModelCatalog,
  type CatalogOffer,
  type ModelCatalog,
} from "../core/engines/catalog.ts";
import {
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  EngineRequestV2Schema,
  Operation,
  RefusalReason,
  refusal,
} from "../core/engines/contract-v2.ts";
import { createFakeEngineV2 } from "../core/engines/fake.ts";
import {
  createKaggleEngine,
  kaggleLicence,
  notebookUrl,
  offeredKaggleRecipes,
} from "../core/engines/kaggle.ts";
import { ENGINE_REASON_MESSAGES } from "../core/engines/reasons.ts";
import { MESSAGES } from "../src/i18n.ts";
import { ProjectStore } from "../core/store.ts";
import { TakeRecordSchema } from "../core/take-record.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { wholeLicence } from "./fixtures/licence-block.ts";

const bases: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  for (const b of bases)
    await rm(b, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
});
const OFF: LocalDiscovery[] = OPERATIONS.map((operation) => ({
  operation,
  available: false,
  reason: "ENGINE_DISABLED",
}));
const build = (
  over: Partial<Parameters<typeof buildCapabilityReport>[0]> = {},
) =>
  buildCapabilityReport({
    catalog: MODEL_CATALOG,
    discovery: OFF,
    kaggleConfigured: false,
    comfyConfigured: false,
    localConfigured: false,
    ...over,
  });
const catalogWith = (change: (c: ModelCatalog) => void): ModelCatalog => {
  const copy = structuredClone(MODEL_CATALOG);
  change(copy);
  return copy;
};
const cell = (
  report: CapabilityReport,
  route: string,
  operation: string,
  catalogId = "wan2.2-ti2v-5b-diffusers",
) =>
  report.cells.find(
    (c) =>
      c.route === route &&
      c.operation === operation &&
      c.catalogId === catalogId,
  )!;
const offerOf = (c: ModelCatalog, route: string, operation: string) =>
  c.entries[0].offers.find(
    (o) => o.route === route && o.operation === operation,
  ) as { -readonly [K in keyof CatalogOffer]: CatalogOffer[K] };

async function context(over: Partial<CommandContext> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "yamakan-report-"));
  bases.push(root);
  const store = new ProjectStore(root);
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  return {
    store,
    queue,
    principal: { id: "local-client", scopes: new Set(Scopes) },
    ...over,
  } as CommandContext;
}
const ask = async (ctx: CommandContext, operation: string, input = {}) =>
  (await execute(ctx, operation, input)).result as any;
// A program that is not there: neither command may start one.
const KAGGLE = {
  cli: path.join(tmpdir(), "no-such-folder", "kaggle.exe"),
  username: "someone",
};

// What main answered before the report (b8c9f3b), written out; since MPR-208 with what is not
// known of a model's licence.
const OPERATIONS_BEFORE = Operation.options.map((operation) => ({
  operation,
  available: false,
  verified: false,
  reason: "ENGINE_DISABLED",
  message: ENGINE_REASON_MESSAGES.ENGINE_DISABLED,
  version: null,
  expiresAt: null,
}));
const OPTIONS_BEFORE = {
  route: "kaggle",
  models: offeredKaggleRecipes().map((r) => ({
    recipeId: r.id,
    name: r.name,
    operation: r.operation ?? "textToVideo",
    model: r.model,
    revision: r.revision,
    licence: r.licence,
    licenceOpen: kaggleLicence(r.id).open,
    width: r.width,
    height: r.height,
    frames: r.frames,
    fps: r.fps,
    steps: r.steps,
    expectedSeconds: r.expectedSeconds,
    timeoutSeconds: r.timeoutSeconds,
    notebook: notebookUrl("someone", r),
  })),
};

test("today's catalog gives thirty cells in three states", async () => {
  const { operations, report } = await ask(
    await context(),
    "yamakan.engines.capabilities",
  );
  assert.deepEqual(operations, OPERATIONS_BEFORE);
  assert.equal(report.format, "yamakan.capability-report/v1");
  assert.equal(report.cells.length, 30);
  const states = report.cells.map((c: any) => c.state);
  const count = (s: string) => states.filter((x: string) => x === s).length;
  assert.deepEqual(
    [count("supported"), count("unverified"), count("unsupported")],
    [3, 3, 24],
  );
  // In order of the models' ids, then the routes and the contract's own operations.
  assert.deepEqual([...OPERATIONS], Operation.options);
  assert.ok(Object.isFrozen(OPERATIONS) && Object.isFrozen(ROUTES));
  assert.deepEqual(
    report.cells.map((c: any) => [c.catalogId, c.route, c.operation]),
    ["cogvideox-2b-diffusers", "wan2.2-ti2v-5b-diffusers"].flatMap((id) =>
      ["kaggle", "comfyui", "local"].flatMap((route) =>
        Operation.options.map((operation) => [id, route, operation]),
      ),
    ),
  );
  assert.deepEqual(cell(report, "kaggle", "textToVideo"), {
    route: "kaggle",
    catalogId: "wan2.2-ti2v-5b-diffusers",
    identity: MODEL_CATALOG.entries[0].identity,
    recipeId: "kaggle-wan22-ti2v-5b",
    operation: "textToVideo",
    state: "supported",
    reasons: [],
    source: {
      kind: "evidence",
      ref: "docs/evidence/ultimate/kaggle-restart-run-receipt.json",
      samples: 1,
    },
    asOf: "2026-11-07",
    limits: MODEL_CATALOG.entries[0].offers[0].limits,
  });
  assert.deepEqual(cell(report, "local", "imageToVideo"), {
    route: "local",
    catalogId: "wan2.2-ti2v-5b-diffusers",
    identity: MODEL_CATALOG.entries[0].identity,
    recipeId: null,
    operation: "imageToVideo",
    state: "unverified",
    reasons: ["NOT_QUALIFIED", "ENGINE_DISABLED"],
    source: {
      kind: "catalog",
      ref: "wan2.2-ti2v-5b-diffusers",
      samples: null,
    },
    asOf: "2026-10-27",
    limits: MODEL_CATALOG.entries[0].offers[3].limits,
  });
  assert.deepEqual(report.refused, [
    {
      catalogId: "wan2.2-ti2v-5b-native",
      identity: MODEL_CATALOG.refused[0].identity,
      reason: "MODEL_REFUSED",
      because: "REMOTE_SERVICE_REFERENCE",
      refusedAt: "2026-10-27",
      evidence: MODEL_CATALOG.refused[0].evidence,
    },
  ]);
  assert.deepEqual(report.routes, [
    { route: "kaggle", configured: false, reason: "ROUTE_NOT_CONFIGURED" },
    { route: "comfyui", configured: false, reason: "ROUTE_NOT_CONFIGURED" },
    { route: "local", configured: false, reason: "ENGINE_DISABLED" },
  ]);
  assert.ok(Buffer.byteLength(JSON.stringify(report)) < 32 * 1024);
  // What it is of is not its reader's to change.
  for (const c of report.cells)
    for (const p of c.source.kind === "evidence" ? [c.source.ref] : [])
      assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), p);
});

test("an offer without evidence is unverified, never supported", () => {
  for (const change of [
    (o: any) => (o.evidence = []),
    (o: any) => (o.measured = null),
    (o: any) => (o.lifecycle = "candidate"),
  ]) {
    const catalog = catalogWith((c) =>
      change(offerOf(c, "kaggle", "textToVideo")),
    );
    const report = build({ catalog });
    const found = cell(report, "kaggle", "textToVideo");
    assert.deepEqual(
      [found.state, found.reasons, found.source.kind, found.source.samples],
      ["unverified", ["NOT_QUALIFIED"], "catalog", null],
    );
    const options = projectGenerationOptions(report, {
      recipes: offeredKaggleRecipes(),
      modelOf: (r) => r.id,
    });
    assert.deepEqual(
      options.models,
      offeredKaggleRecipes()
        .map((r) => r.id)
        .filter((id) => id !== "kaggle-wan22-ti2v-5b"),
    );
  }
  // Qualified counts as offered does.
  const qualified = build({
    catalog: catalogWith(
      (c) => (offerOf(c, "kaggle", "textToVideo").lifecycle = "qualified"),
    ),
  });
  assert.equal(cell(qualified, "kaggle", "textToVideo").state, "supported");
});

test("a retired offer and a missing offer are unsupported, each with its own reason", () => {
  const report = build({
    catalog: catalogWith(
      (c) => (offerOf(c, "kaggle", "textToVideo").lifecycle = "retired"),
    ),
  });
  const retired = cell(report, "kaggle", "textToVideo");
  assert.deepEqual(
    [retired.state, retired.reasons, retired.recipeId, retired.source.kind],
    ["unsupported", ["OFFER_RETIRED"], "kaggle-wan22-ti2v-5b", "catalog"],
  );
  assert.ok(retired.limits);
  const missing = cell(report, "kaggle", "enhance");
  assert.deepEqual(
    [missing.state, missing.reasons, missing.recipeId, missing.limits],
    ["unsupported", ["OPERATION_NOT_OFFERED"], null, null],
  );
});

test("a local offer also needs this build's discovery, whose reason it says", () => {
  const catalog = catalogWith((c) => {
    c.entries[0].licence = wholeLicence();
    const local = offerOf(c, "local", "textToVideo");
    local.lifecycle = "qualified";
    local.recipeId = "local-wan";
    local.measured = { at: "2026-11-20", samples: 4 };
  });
  const discovered = (over: Partial<LocalDiscovery>) =>
    OFF.map((d) => (d.operation === "textToVideo" ? { ...d, ...over } : d));
  const found = (over: Partial<LocalDiscovery>) =>
    cell(
      build({ catalog, discovery: discovered(over) }),
      "local",
      "textToVideo",
    );
  assert.deepEqual(
    [found({}).state, found({}).reasons, found({}).source],
    [
      "unsupported",
      ["ENGINE_DISABLED"],
      { kind: "build", ref: "local-discovery", samples: null },
    ],
  );
  assert.deepEqual(found({ reason: "WEIGHTS_ABSENT" }).reasons, [
    "WEIGHTS_ABSENT",
  ]);
  const there = found({ available: true, reason: null });
  assert.deepEqual(
    [there.state, there.reasons, there.asOf, there.source.samples],
    ["supported", [], "2026-11-20", 4],
  );
  // An unanswered one is as good as off.
  assert.equal(
    cell(build({ catalog, discovery: [] }), "local", "textToVideo").state,
    "unsupported",
  );
  // A candidate's own reason comes first, and says nothing of discovery when there is none.
  assert.deepEqual(
    cell(
      build({ discovery: discovered({ available: true, reason: null }) }),
      "local",
      "textToVideo",
    ).reasons,
    ["NOT_QUALIFIED"],
  );
});

test("an offer its licence does not allow is unsupported, and is no choice", () => {
  const report = (change: (c: ModelCatalog) => void) =>
    build({ catalog: catalogWith(change), kaggleConfigured: true });
  const text = (r: CapabilityReport) => {
    const { state, reasons, source } = cell(r, "kaggle", "textToVideo");
    return [state, reasons, source.kind];
  };
  const no = ["unsupported", ["RIGHTS_UNQUALIFIED"], "catalog"];
  // A recipe of after the gate, with the same open fields.
  const renamed = report((c) => {
    offerOf(c, "kaggle", "textToVideo").recipeId = "kaggle-new";
  });
  assert.deepEqual(text(renamed), no);
  assert.equal(
    renamed.reasonMessages.RIGHTS_UNQUALIFIED,
    ENGINE_REASON_MESSAGES.RIGHTS_UNQUALIFIED,
  );
  // One of before it, with a term that is known and against it.
  assert.deepEqual(
    text(
      report((c) => {
        c.entries[0].licence = { ...c.entries[0].licence, gated: "yes" };
      }),
    ),
    no,
  );
  // A hosted run needs the right to one; a local run of the same model does not.
  const local = report((c) => {
    c.entries[0].licence = {
      ...wholeLicence(),
      hostedServiceRight: "notAllowed",
    };
    const offer = offerOf(c, "local", "textToVideo");
    offer.lifecycle = "qualified";
    offer.recipeId = "local-wan";
  });
  assert.deepEqual(text(local), no);
  assert.deepEqual(cell(local, "local", "textToVideo").reasons, [
    "NOT_QUALIFIED",
    "ENGINE_DISABLED",
  ]);
  const choices = projectGenerationOptions(renamed, {
    recipes: offeredKaggleRecipes(),
    modelOf: (r) => r.id,
  });
  assert.deepEqual(choices.models, [
    "kaggle-wan22-ti2v-5b-first-frame",
    "kaggle-cogvideox-2b",
  ]);
});

test("a place with more than one offer shows the furthest along", () => {
  const retired = { lifecycle: "retired" as const, recipeId: "kaggle-old" };
  for (const order of [1, -1]) {
    const report = build({
      catalog: catalogWith((c) => {
        const offer = offerOf(c, "kaggle", "textToVideo");
        const pair = [{ ...offer, ...retired }, { ...offer }];
        c.entries[0].offers.splice(
          0,
          1,
          ...(order === 1 ? pair : pair.reverse()),
        );
      }),
    });
    const found = cell(report, "kaggle", "textToVideo");
    assert.deepEqual(
      [found.state, found.recipeId],
      ["supported", "kaggle-wan22-ti2v-5b"],
    );
    assert.equal(report.cells.length, 30);
  }
  // Unverified is further along than unsupported, and the first of two alike is the one.
  const two = (change: (a: any, b: any) => void) =>
    cell(
      build({
        catalog: catalogWith((c) => {
          c.entries[0].licence = wholeLicence();
          const offer = offerOf(c, "kaggle", "textToVideo");
          const a = { ...offer, recipeId: "kaggle-a" };
          const b = { ...offer, recipeId: "kaggle-b" };
          change(a, b);
          c.entries[0].offers.splice(0, 1, a, b);
        }),
      }),
      "kaggle",
      "textToVideo",
    );
  const unverified = two((a, b) => {
    a.lifecycle = "retired";
    b.measured = null;
  });
  assert.deepEqual(
    [unverified.state, unverified.recipeId],
    ["unverified", "kaggle-b"],
  );
  assert.equal(two(() => {}).recipeId, "kaggle-a");
  // Two current offers in one place would hide one: the catalog takes no such pair.
  for (const lifecycle of ["offered", "qualified"] as const)
    assert.throws(
      () =>
        parseModelCatalog(
          catalogWith((c) => {
            const offer = offerOf(c, "kaggle", "textToVideo");
            c.entries[0].offers.push({
              ...offer,
              recipeId: "kaggle-wan-fast",
              lifecycle,
            });
          }),
        ),
      /at a time/,
    );
  for (const lifecycle of ["candidate", "retired"] as const)
    parseModelCatalog(
      catalogWith((c) => {
        const offer = offerOf(c, "kaggle", "textToVideo");
        c.entries[0].offers.push({
          ...offer,
          recipeId: "kaggle-wan-fast",
          lifecycle,
        });
      }),
    );
});

test("a route that is not configured changes no cell", async () => {
  const none = build();
  const all = build({
    kaggleConfigured: true,
    comfyConfigured: true,
    localConfigured: true,
  });
  assert.deepEqual(all.cells, none.cells);
  assert.deepEqual(
    all.routes.map((r) => [r.configured, r.reason]),
    [
      [true, null],
      [true, null],
      [true, null],
    ],
  );
  // Engines on, and no folder of models.
  assert.equal(
    build({
      discovery: OFF.map((d) => ({ ...d, reason: "WEIGHTS_ABSENT" as const })),
    }).routes[2].reason,
    "ROUTE_NOT_CONFIGURED",
  );
  for (const [over, configured] of [
    [{ kaggle: KAGGLE }, [true, false, false]],
    [{ comfyUrl: "http://127.0.0.1:9" }, [false, true, false]],
    // Engines are off in this build, whatever folder of models there is.
    [{ modelRoot: tmpdir() }, [false, false, false]],
  ] as const) {
    const { report } = await ask(
      await context(over as Partial<CommandContext>),
      "yamakan.engines.capabilities",
    );
    assert.deepEqual(report.cells, none.cells);
    assert.deepEqual(
      report.routes.map((r: any) => r.configured),
      configured,
    );
  }
});

test("generation options are a projection and equal what they were", async () => {
  assert.deepEqual(
    await ask(await context({ kaggle: KAGGLE }), "yamakan.generation.options"),
    OPTIONS_BEFORE,
  );
  assert.ok(OPTIONS_BEFORE.models.length > 0);
  assert.deepEqual(await ask(await context(), "yamakan.generation.options"), {
    route: null,
    models: [],
  });
  // Fail closed: a recipe whose cell is not supported is not a choice.
  const report = build();
  const some = (change: (c: CapabilityReport["cells"][number]) => void) => {
    const copy = structuredClone(report);
    copy.cells.forEach(change);
    return projectGenerationOptions(copy, {
      recipes: offeredKaggleRecipes(),
      modelOf: (r) => r.id,
    }).models;
  };
  assert.equal(some(() => {}).length, OPTIONS_BEFORE.models.length);
  for (const state of ["unverified", "unsupported"] as const)
    assert.deepEqual(
      some((c) => (c.state = state)),
      [],
    );
  assert.deepEqual(
    some((c) => (c.route = "comfyui")),
    [],
  );
});

test("every reason in a report has a message", () => {
  const codes = [
    ...RefusalReason.options,
    "NOT_QUALIFIED",
    "OPERATION_NOT_OFFERED",
    "OFFER_RETIRED",
    "ROUTE_NOT_CONFIGURED",
    "MODEL_REFUSED",
  ];
  assert.equal(codes.length, 16);
  assert.deepEqual(Object.keys(ENGINE_REASON_MESSAGES).sort(), codes.sort());
  for (const code of codes) {
    const key = `engine.reason.${code}` as keyof typeof MESSAGES.en;
    assert.equal(MESSAGES.en[key], ENGINE_REASON_MESSAGES[code], code);
    assert.ok(MESSAGES.ar[key] && MESSAGES.ar[key] !== MESSAGES.en[key], code);
  }
  for (const report of [
    build(),
    build({ kaggleConfigured: true, comfyConfigured: true }),
  ]) {
    const said = new Set<string>([
      ...report.cells.flatMap((c) => c.reasons),
      ...report.routes.flatMap((r) => r.reason ?? []),
      ...report.refused.map((r) => r.reason),
    ]);
    assert.deepEqual(
      Object.keys(report.reasonMessages).sort(),
      [...said].sort(),
    );
    for (const [code, text] of Object.entries(report.reasonMessages))
      assert.equal(text, ENGINE_REASON_MESSAGES[code]);
    for (const c of report.cells) {
      assert.equal(c.reasons.length === 0, c.state === "supported");
      assert.ok(c.reasons.length <= CAPABILITY_REPORT_LIMITS.reasons);
    }
  }
});

test("the report stays inside its bounds and refuses past them", () => {
  const many = (n: number) =>
    catalogWith((c) => {
      const [first] = c.entries;
      c.entries = Array.from({ length: n }, (_, i) => ({
        ...first,
        id: `e${i}`,
      }));
    });
  assert.equal(build({ catalog: many(64) }).cells.length, 960);
  const over = (catalog: ModelCatalog) =>
    assert.throws(
      () => build({ catalog }),
      (e) => toCommandError(e).code === "LIMIT_EXCEEDED",
    );
  over(many(65));
  over(
    catalogWith((c) => {
      c.refused = Array.from({ length: 33 }, () => c.refused[0]);
    }),
  );
  // Few cells, and too many bytes.
  over(
    catalogWith((c) => {
      (c.entries[0].identity as any).host = "h".repeat(
        CAPABILITY_REPORT_LIMITS.bytes / 10,
      );
    }),
  );
  // Counted in bytes, not in characters: each of these is three.
  over(
    catalogWith((c) => {
      (c.entries[0].identity as any).host = "漢".repeat(
        CAPABILITY_REPORT_LIMITS.bytes / 40,
      );
    }),
  );
});

test("a measured cell carries its date and sample size, which are those of its evidence file, and no other cell does", () => {
  const report = build();
  for (const c of report.cells) {
    assert.equal(c.source.samples !== null, c.source.kind === "evidence");
    if (c.source.kind !== "evidence") continue;
    const receipt = JSON.parse(
      readFileSync(new URL(`../${c.source.ref}`, import.meta.url), "utf8"),
    );
    // One run from the page, that day, of this model.
    assert.equal(receipt.passed, true);
    assert.equal(receipt.model, c.identity.model);
    const ended = receipt.steps.find((s: any) =>
      s.name.startsWith("the run finished"),
    );
    assert.equal(ended.at.slice(0, 10), c.asOf);
    assert.equal(c.source.samples, 1);
    assert.equal(receipt.picture !== undefined, c.operation === "imageToVideo");
  }
  assert.equal(
    report.cells.filter((c) => c.source.kind === "evidence").length,
    3,
  );
});

test("each limit says its lengths, its sound and its references (OA-15)", () => {
  for (const entry of MODEL_CATALOG.entries)
    for (const offer of entry.offers) {
      const { frames, durationFrames, audioOut, references, roles } =
        offer.limits;
      // Every recipe here makes one length, no sound, and takes no reference.
      assert.deepEqual(durationFrames, { min: frames, max: frames });
      assert.equal(audioOut, false);
      assert.equal(references, null);
      assert.ok(!roles.includes("reference"));
    }
  const refused = (change: (o: any) => void, why: RegExp) =>
    assert.throws(
      () =>
        parseModelCatalog(
          catalogWith((c) => change(offerOf(c, "kaggle", "textToVideo"))),
        ),
      why,
    );
  const REFERENCES = { count: 2, mediaTypes: ["image/png"], maxBytes: 9 };
  refused((o) => (o.limits.durationFrames = { min: 82, max: 90 }), /holds/);
  refused((o) => (o.limits.durationFrames = { min: 1, max: 80 }), /holds/);
  refused((o) => (o.limits.durationFrames = { min: 90, max: 80 }), /least/);
  for (const bad of [0, 1.5, "1", 1_000_001])
    refused((o) => (o.limits.durationFrames.min = bad), /"min"/);
  refused((o) => (o.limits.audioOut = "no"), /"audioOut"/);
  refused((o) => (o.limits.references = REFERENCES), /references/);
  refused((o) => (o.limits.roles = ["reference"]), /references/);
  refused((o) => (o.measured = { at: "2026-11-06", samples: 0 }), /"samples"/);
  refused((o) => (o.measured.samples = 1_001), /"samples"/);
  refused((o) => (o.measured.at = "yesterday"), /"at"/);
  refused((o) => (o.measured.extra = 1), /extra/);
  refused((o) => delete o.measured, /"measured"/);
  // Measured, and no evidence of it.
  refused((o) => (o.evidence = []), /"evidence"/);
  parseModelCatalog(
    catalogWith((c) => {
      const o = offerOf(c, "kaggle", "textToVideo") as any;
      o.limits.durationFrames = { min: 1, max: 1_000 };
      o.limits.audioOut = true;
      o.limits.roles = ["reference"];
      o.limits.references = REFERENCES;
      o.measured.samples = 1_000;
    }),
  );
});

// A request as an engine takes it.
const HASH = "c".repeat(64);
const still = (n: number, role: string) => ({
  role,
  asset: {
    assetVersionId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    sha256: HASH,
    mediaType: "image/png",
  },
});
const request = (operation: string, inputs: object[]) => ({
  contract: ENGINE_CONTRACT_V2,
  operation,
  prompt: "A red kite.",
  inputs,
  output: {
    kind: "video",
    width: 704,
    height: 480,
    fps: { num: 24, den: 1 },
    durationTicks: 705_600_000,
    audio: false,
  },
  recipeId: "t",
  recipeHash: HASH,
  modelManifestHash: HASH,
  attemptKey: "a-1",
  leaseGeneration: 1,
  deadlineMs: 1_000,
  resourcePolicyHash: HASH,
});
const reads = (operation: string, inputs: object[]) =>
  EngineRequestV2Schema.safeParse(request(operation, inputs)).success;

test("a request may name reference pictures, and no engine here takes one (OA-15)", async () => {
  const refs = (n: number) =>
    Array.from({ length: n }, (_, i) => still(i, "reference"));
  const first = still(90, "firstFrame");
  const last = still(91, "lastFrame");
  assert.equal(ENGINE_V2_LIMITS.references, 4);
  for (const n of [0, 1, 4]) {
    assert.ok(reads("textToVideo", refs(n)), `${n}`);
    assert.ok(reads("imageToVideo", [first, ...refs(n)]), `${n}`);
    assert.ok(reads("imageToVideo", [first, last, ...refs(n)]), `${n}`);
  }
  // It is no moment of the video.
  assert.ok(!reads("textToVideo", [{ ...refs(1)[0], atTicks: 0 }]));
  for (const [operation, inputs] of [
    ["textToVideo", refs(5)],
    ["textToVideo", [first]],
    ["textToVideo", [still(1, "style")]],
    [
      "textToVideo",
      [
        {
          ...still(1, "reference"),
          asset: { ...still(1, "x").asset, mediaType: "video/mp4" },
        },
      ],
    ],
    ["imageToVideo", refs(1)],
    ["imageToVideo", [first, ...refs(5)]],
    ["imageToVideo", [...refs(1), first]],
    ["imageToVideo", [first, ...refs(1), last]],
    ["enhance", refs(1)],
  ] as const)
    assert.ok(!reads(operation, [...inputs]), `${operation} ${inputs.length}`);
  const asked = EngineRequestV2Schema.parse(request("textToVideo", refs(1)));
  const capability = createFakeEngineV2()
    .capabilities()
    .find((c) => c.operation === "textToVideo")!;
  assert.equal(refusal(asked, capability), "INPUT_UNSUPPORTED");
  // A take's record can name one, as it can every role of a request.
  const roles = TakeRecordSchema.shape.inputs.element.shape.role.options;
  for (const role of [
    "firstFrame",
    "lastFrame",
    "source",
    "mask",
    "audio",
    "reference",
  ])
    assert.ok((roles as readonly string[]).includes(role), role);
  // The Kaggle route refuses one before anything is sent.
  const started: string[] = [];
  const kaggle = createKaggleEngine({
    cli: {
      run: async (...args: unknown[]) => {
        started.push(String(args));
        throw new Error("Nothing may be started.");
      },
    },
    username: "someone",
  } as never);
  for (const recipe of offeredKaggleRecipes()) {
    const operation = recipe.operation ?? "textToVideo";
    const given = EngineRequestV2Schema.parse({
      ...request(operation, [
        ...(operation === "imageToVideo" ? [first] : []),
        ...refs(1),
      ]),
      recipeId: recipe.id,
    });
    assert.deepEqual(await kaggle.submit(given, {} as never), {
      refused: "INPUT_UNSUPPORTED",
    });
  }
  assert.deepEqual(started, []);
});

test("both commands take nothing, need the read scope, and answer with no Kaggle CLI there", async () => {
  const ctx = await context({ kaggle: KAGGLE });
  const reason = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (e) {
      return toCommandError(e).code;
    }
  };
  for (const operation of [
    "yamakan.engines.capabilities",
    "yamakan.generation.options",
  ]) {
    assert.equal(
      await reason(ask(ctx, operation, { route: "kaggle" })),
      "VALIDATION",
    );
    assert.equal(
      await reason(
        ask(
          {
            ...ctx,
            principal: { id: "agent:x", scopes: new Set(["project:write"]) },
          } as unknown as CommandContext,
          operation,
        ),
      ),
      "SCOPE_DENIED",
    );
    assert.equal(await reason(ask(ctx, operation)), "ok");
  }
  const source = readFileSync(
    new URL("../core/engines/capability-report.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /fetch\s*\(|process\.|require\s*\(|import\s*\(/);
  // Only these, and none of them reaches further than zod.
  const imports = (text: string) =>
    [
      ...text.matchAll(
        /^(?:import|\}) (?!type)[^;]*?from "([^"]+)";|^import "([^"]+)";/gm,
      ),
    ].map((m) => m[1] ?? m[2]);
  assert.deepEqual(imports(source).sort(), [
    "../command/errors.ts",
    "./catalog.ts",
    "./licence.ts",
    "./reasons.ts",
  ]);
  for (const name of [
    "command/errors",
    "engines/catalog",
    "engines/licence",
    "engines/reasons",
  ])
    for (const from of imports(
      readFileSync(new URL(`../core/${name}.ts`, import.meta.url), "utf8"),
    ))
      assert.ok(
        from === "zod" ||
          (name === "engines/catalog" && from === "./licence.ts"),
        `${name} imports ${from}`,
      );
});
