import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREATE_MODELS,
  licenceOpenWords,
  composePrompt,
  emptyBrief,
  outcomeLines,
  parseReceipt,
  readBrief,
  sha256Of,
  choiceOf,
  mayStart,
  startRequest,
  GATE_PROPOSAL,
  approvalLines,
  approvalRequests,
  gateReasons,
  gatesOpen,
  approvalsInForce,
  contactOpen,
  type GateKind,
  type GateRouteInfo,
  type GateStateName,
  startingStills,
  validSeed,
} from "../src/create/create-model.ts";
import { FailureClass } from "../core/engines/contract-v2.ts";
import { FAILURE_CLASSES } from "../core/engines/failures.ts";
import { translate } from "../src/i18n.ts";
import { ShotIntentSchema } from "../core/story.ts";
import { draftToIntent } from "../src/story/story-text.ts";

const receipt = {
  format: "yamakan.generation-receipt/v1",
  stage: "done",
  verified: true,
  model: "zai-org/CogVideoX-2b",
  revision: "1137dac",
  prompt: "A boat.",
  seed: 42,
  steps: 50,
  license: "apache-2.0",
  sha256: "a".repeat(64),
};

test("the prompt given to a model is exactly the words shown", () => {
  const brief = emptyBrief();
  assert.equal(composePrompt(brief), "");
  brief.prompt = "  A boat on a stream.  ";
  assert.equal(composePrompt(brief), "A boat on a stream.");
  brief.direction = { shot: "wide", movement: "pan" };
  assert.equal(
    composePrompt(brief),
    "A boat on a stream. wide shot, slow pan.",
  );
  brief.prompt = "";
  assert.equal(composePrompt(brief), "wide shot, slow pan");
});

test("a direction not on the list adds nothing", () => {
  const brief = emptyBrief();
  brief.prompt = "A boat";
  brief.direction = { shot: "constructor", lens: "made-up" };
  assert.equal(composePrompt(brief), "A boat");
});

test("a kept brief is read as untrusted", () => {
  assert.deepEqual(readBrief(null), emptyBrief());
  assert.deepEqual(readBrief("not json"), emptyBrief());
  const brief = readBrief(
    JSON.stringify({
      prompt: "x".repeat(5000),
      modelId: "paid/other-model",
      seed: -1,
      direction: { shot: "wide", lens: "made-up", other: "x" },
    }),
  );
  assert.equal(brief.prompt.length, 2000);
  assert.equal(brief.modelId, CREATE_MODELS[0].id);
  assert.equal(brief.seed, 42);
  assert.deepEqual(brief.direction, { shot: "wide" });
});

test("a hostile stored draft is read as one that a shot's intent accepts", () => {
  for (const stored of [
    JSON.stringify({
      prompt: "\u{1F600}".repeat(5000),
      direction: { shot: "wide", lens: "made-up", __proto__: "x", light: 7 },
    }),
    // Cut in the middle of a character.
    JSON.stringify({ prompt: `x${"\u{1F600}".repeat(5000)}` }),
    JSON.stringify({ prompt: { toString: "x" }, direction: "wide" }),
    JSON.stringify({ prompt: "x", direction: { movement: "../../secret" } }),
    JSON.stringify([1]),
    "null",
    "{",
  ]) {
    const intent = draftToIntent(readBrief(stored));
    if (Object.keys(intent).length > 0)
      assert.ok(
        ShotIntentSchema.safeParse(intent).success,
        stored.slice(0, 80),
      );
    assert.ok(!("modelId" in intent) && !("seed" in intent));
    assert.doesNotMatch(
      intent.action ?? "",
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/,
      stored.slice(0, 80),
    );
  }
  assert.deepEqual(
    draftToIntent(
      readBrief(
        JSON.stringify({
          prompt: "x",
          direction: { shot: "wide", lens: "no" },
        }),
      ),
    ),
    { action: "x", direction: { shot: "wide" } },
  );
});

test("what a person approves is said and asked for as one (MPR-204)", () => {
  const route: GateRouteInfo = {
    route: "kaggle",
    host: "kaggle.com",
    account: "someone",
    network: { proxyConfigured: false, certificateOverride: false },
    run: { bytes: 1_000_000, seconds: 5_401 },
    gates: [
      { kind: "egress", state: "missing", runsLeft: 0, follows: false },
      { kind: "spend", state: "missing", runsLeft: 0, follows: false },
    ],
  };
  assert.deepEqual(GATE_PROPOSAL, { runs: 1, hours: 1 });
  const base = {
    route: "kaggle",
    host: "kaggle.com",
    account: "someone",
    purpose: "generation",
    ttlMs: 2 * 3_600_000,
    // As the person was shown them.
    network: { proxyConfigured: false, certificateOverride: false },
  };
  assert.deepEqual(approvalRequests(route, { runs: 3, hours: 2 }), [
    { ...base, kind: "egress", limit: { runs: 3, units: 3_000_000 } },
    { ...base, kind: "spend", limit: { runs: 3, units: 16_203 } },
  ]);
  // To follow a run, contacting alone.
  assert.deepEqual(approvalRequests(route, { runs: 1, hours: 2 }, ["egress"]), [
    // With no bytes: no run can be sent under it.
    { ...base, kind: "egress", limit: { runs: 1, units: 0 } },
  ]);
  for (const bad of [
    { runs: 0, hours: 1 },
    { runs: 1_001, hours: 1 },
    { runs: 1.5, hours: 1 },
    { runs: Number.NaN, hours: 1 },
    { runs: 1, hours: 0 },
    { runs: 1, hours: 8_785 },
    { runs: 1, hours: 0.5 },
  ])
    assert.throws(() => approvalRequests(route, bad), /out of its range/);
  const says = (r: GateRouteInfo, lang: "en" | "ar") =>
    approvalLines(r, { runs: 3, hours: 2 }).map(({ key, vars }) =>
      translate(lang, key, vars),
    );
  const english = says(route, "en").join(" ");
  for (const part of [
    "kaggle.com",
    "someone",
    "the picture",
    "1 MB for each of 3",
    "allowance: 3",
    "91",
    "Hours from now: 2",
  ])
    assert.ok(english.includes(part), part);
  assert.ok(english.includes("The Kaggle CLI chooses the hosts it contacts."));
  assert.equal(says(route, "en").length, 5);
  const follow = approvalLines(route, { runs: 1, hours: 1 }, ["egress"]).map(
    ({ key, vars }) => translate("en", key, vars),
  );
  assert.equal(follow.length, 4);
  assert.match(follow.join(" "), /to ask how your run goes.*No other run\./);
  assert.ok(!/allowance/.test(follow.join(" ")));
  for (const [network, key] of [
    [{ proxyConfigured: true, certificateOverride: false }, "create.gateProxy"],
    [
      { proxyConfigured: false, certificateOverride: true },
      "create.gateCertificate",
    ],
  ] as const)
    assert.ok(says({ ...route, network }, "en").includes(translate("en", key)));
  for (const line of says(route, "ar"))
    assert.match(line, /[\u0600-\u06ff]/, line);
  // Open only when both are; why not is said once each.
  const gates = (a: GateStateName, b: GateStateName) => ({
    ...route,
    gates: [
      { kind: "egress" as const, state: a, runsLeft: 1, follows: false },
      { kind: "spend" as const, state: b, runsLeft: 1, follows: false },
    ],
  });
  assert.equal(gatesOpen(gates("approved", "approved")), true);
  for (const state of [
    "missing",
    "expired",
    "revoked",
    "exhausted",
    "voided",
    "changed",
  ] as const) {
    assert.equal(gatesOpen(gates("approved", state)), false);
    assert.equal(gatesOpen(gates(state, "approved")), false);
    assert.deepEqual(gateReasons(gates(state, state)), [
      `create.gateState.${state}`,
    ]);
    for (const lang of ["en", "ar"] as const)
      assert.ok(translate(lang, `create.gateState.${state}`).length > 5);
  }
  // What still lets a run be followed, and which approvals can be taken back.
  for (const [egress, spend, open] of [
    [true, false, true],
    [false, true, false],
    [false, false, false],
  ] as const)
    assert.equal(
      contactOpen({
        ...route,
        gates: [
          { kind: "egress", state: "exhausted", runsLeft: 0, follows: egress },
          { kind: "spend", state: "approved", runsLeft: 1, follows: spend },
        ],
      }),
      open,
    );
  const row = (
    id: string,
    kind: GateKind,
    state: GateStateName,
    over: object = {},
  ) => ({
    id,
    kind,
    state,
    host: "kaggle.com",
    account: "someone",
    expiresAt: 1,
    runsLeft: 0,
    ...over,
  });
  const inForce = (...approvals: ReturnType<typeof row>[]) =>
    approvalsInForce({ approvals, route }).map((a) => a.id);
  assert.deepEqual(
    inForce(
      row("1", "spend", "exhausted"),
      row("2", "egress", "exhausted"),
      row("3", "egress", "approved"),
      row("4", "spend", "approved"),
    ),
    ["2", "1"],
    "the newest of each, also used up",
  );
  assert.deepEqual(
    inForce(row("1", "egress", "revoked"), row("2", "egress", "approved")),
    [],
    "an older one never counts again",
  );
  assert.deepEqual(
    inForce(
      row("1", "egress", "approved", { account: "another" }),
      row("2", "egress", "changed"),
      row("3", "spend", "expired"),
    ),
    ["2"],
  );
  assert.deepEqual(approvalsInForce({ approvals: [], route: null }), []);
  assert.equal(gatesOpen({ ...route, gates: [] }), false);
  assert.deepEqual(gateReasons(gates("approved", "approved")), []);
});

test("seeds are whole numbers a model can take", () => {
  assert.ok(validSeed(0));
  assert.ok(validSeed(2 ** 32 - 1));
  for (const bad of [-1, 1.5, 2 ** 32, Number.NaN]) assert.ok(!validSeed(bad));
});

test("a finished receipt is read", () => {
  const read = parseReceipt(JSON.stringify(receipt));
  assert.equal(read.sha256, receipt.sha256);
  assert.equal(read.seed, 42);
  assert.equal(read.licence, "apache-2.0");
});

test("the repository's real receipts are readable", () => {
  for (const name of ["first-ai-video-receipt", "wan22-first-video-receipt"]) {
    let text: string;
    try {
      text = readFileSync(`docs/evidence/ultimate/${name}.json`, "utf8");
    } catch {
      continue; // The Wan receipt arrives with its own change.
    }
    assert.match(parseReceipt(text).sha256, /^[a-f0-9]{64}$/);
  }
});

test("anything else is refused, and says why", () => {
  assert.throws(() => parseReceipt("nope"), /not-json/);
  assert.throws(() => parseReceipt("{}"), /not-receipt/);
  assert.throws(
    () => parseReceipt(JSON.stringify({ ...receipt, stage: "failed" })),
    /not-finished/,
  );
  // A run can finish and fail its own checks.
  assert.throws(
    () => parseReceipt(JSON.stringify({ ...receipt, verified: false })),
    /not-finished/,
  );
  for (const change of [
    { sha256: "short" },
    { sha256: "A".repeat(64) },
    { seed: "42" },
    { seed: -1 },
    { steps: 0 },
    { prompt: 7 },
  ])
    assert.throws(
      () => parseReceipt(JSON.stringify({ ...receipt, ...change })),
      /not-receipt/,
    );
});

test("a hash is of the bytes", async () => {
  assert.equal(
    await sha256Of(new TextEncoder().encode("abc").buffer),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("a model that reads only part of a prompt says so, in both languages", async () => {
  const reads = Object.fromEntries(
    CREATE_MODELS.map((m) => [m.name, m.readsAboutWords]),
  );
  assert.deepEqual(reads, { "Wan2.2-TI2V-5B": null, "CogVideoX-2b": 150 });
  const { MESSAGES } = await import("../src/i18n.ts");
  for (const language of Object.values(MESSAGES) as Record<string, string>[])
    assert.match(language["create.readsLittle"], /\{words\}/);
});

test("a model's licence, and what is not known of it, are the catalog's, in both languages", async () => {
  const { MODEL_CATALOG } = await import("../core/engines/catalog.ts");
  const { openLicenceFields } = await import("../core/engines/licence.ts");
  const { MESSAGES, translate } = await import("../src/i18n.ts");
  for (const model of CREATE_MODELS) {
    const entry = MODEL_CATALOG.entries.find(
      (e) => e.identity.model === model.id,
    )!;
    assert.equal(model.licence, entry.licence.weights.name);
    assert.deepEqual(
      model.licenceOpen,
      openLicenceFields(entry.licence, { run: "hosted" }),
    );
    for (const lang of ["en", "ar"] as const) {
      const said = licenceOpenWords(model.licenceOpen, (key, vars) =>
        translate(lang, key, vars),
      );
      assert.equal(
        said.split(MESSAGES[lang]["create.licenceOpenAnd"]).length,
        model.licenceOpen.length,
      );
      for (const { part } of model.licenceOpen)
        if (part) assert.ok(said.includes(`\u2068${part}\u2069`), said);
      assert.doesNotMatch(said, /[{}]/);
    }
  }
});

test("a run from a picture is offered only the project's PNG and JPEG stills", () => {
  assert.deepEqual(
    startingStills([
      { id: "a", kind: "image", name: "boat.png" },
      { id: "b", kind: "image", name: "kite.JPG" },
      { id: "c", kind: "image", name: "hill.jpeg" },
      { id: "d", kind: "image", name: "sky.webp" },
      { id: "e", kind: "video", name: "clip.png" },
      { id: "f", kind: "image", name: "png" },
    ]),
    [
      { id: "a", name: "boat.png" },
      { id: "b", name: "kite.JPG" },
      { id: "c", name: "hill.jpeg" },
    ],
  );
});

test("a run from a picture says the picture leaves, in both languages", async () => {
  const { MESSAGES } = await import("../src/i18n.ts");
  const [english, arabic] = [MESSAGES.en, MESSAGES.ar] as Record<
    string,
    string
  >[];
  assert.match(english["create.agreePicture"], /picture leave this computer/);
  assert.match(english["create.agreePicture"], /withdrawing consent later/);
  assert.match(english["create.noRealPerson"], /no real person/);
  for (const language of [english, arabic]) {
    assert.match(language["create.agreePicture"], /\{minutes\}/);
    for (const key of [
      "create.picture",
      "create.pictureNone",
      "create.pictureNote",
      "create.noRealPerson",
    ])
      assert.ok(language[key], key);
  }
});

// The page sends what the person chose, and only with their word about who it shows.
test("a start from a picture carries the still and the person's word, and needs both ticks", () => {
  const model = {
    recipeId: "kaggle-wan22-ti2v-5b-first-frame",
    name: "Wan2.2-TI2V-5B",
    operation: "imageToVideo" as const,
    model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    revision: "r",
    licence: "Apache-2.0",
    width: 704,
    height: 480,
    frames: 81,
    fps: 24,
    steps: 30,
    expectedSeconds: 1200,
    timeoutSeconds: 3600,
    notebook: "https://www.kaggle.com/code/someone/notebook",
  };
  const base = { model, prompt: "A boat.", seed: 7, projectFps: 30 };
  assert.deepEqual(
    startRequest({ ...base, picture: { id: "still" }, noPerson: true }),
    {
      recipeId: model.recipeId,
      prompt: "A boat.",
      seed: 7,
      width: 704,
      height: 480,
      durationFrames: 101,
      firstFrameAssetId: "still",
      noUnconsentedPerson: true,
    },
  );
  assert.throws(() =>
    startRequest({ ...base, picture: { id: "still" }, noPerson: false }),
  );
  const fromPrompt = startRequest({
    ...base,
    picture: undefined,
    noPerson: true,
  });
  assert.equal("firstFrameAssetId" in fromPrompt, false);
  assert.equal("noUnconsentedPerson" in fromPrompt, false);
  assert.equal(
    mayStart({ agreed: true, picture: undefined, noPerson: false }),
    true,
  );
  assert.equal(
    mayStart({ agreed: false, picture: undefined, noPerson: true }),
    false,
  );
  assert.equal(
    mayStart({ agreed: true, picture: { id: "s" }, noPerson: false }),
    false,
  );
  assert.equal(
    mayStart({ agreed: false, picture: { id: "s" }, noPerson: true }),
    false,
  );
  assert.equal(
    mayStart({ agreed: true, picture: { id: "s" }, noPerson: true }),
    true,
  );
});

// A tick counts only for what it was given on, so switching away and back asks again.
test("a tick given for one model or picture does not count for another", () => {
  const given = choiceOf("first-frame", "still-a");
  assert.equal(given, choiceOf("first-frame", "still-a"));
  for (const other of [
    choiceOf("first-frame", "still-b"),
    choiceOf("first-frame"),
    choiceOf("text", "still-a"),
    choiceOf("text"),
  ])
    assert.notEqual(given, other);
  // Names cannot run together into another choice's.
  assert.notEqual(choiceOf("a|b"), choiceOf("a", "b"));
});

test("how a run ended is worded for every kind, in both languages", () => {
  for (const failureClass of FailureClass.options)
    for (const { retry } of Object.values(FAILURE_CLASSES))
      for (const mayStillBeBilled of [true, false]) {
        const lines = outcomeLines({ failureClass, retry, mayStillBeBilled });
        assert.equal(lines.length, 3);
        // Only a run that may still be going may still use it.
        assert.equal(
          outcomeLines({ failureClass, retry, mayStillBeBilled }, true)[1],
          mayStillBeBilled ? "create.billStill" : "create.billNot",
        );
        assert.equal(
          lines[1],
          mayStillBeBilled ? "create.billMay" : "create.billNot",
        );
        for (const lang of ["en", "ar"] as const)
          for (const key of lines) assert.ok(translate(lang, key).length > 5);
      }
  // Each kind has its own words.
  const first = FailureClass.options.map((failureClass) => {
    // Where the billing is not known, nothing is said of it.
    const lines = outcomeLines({ failureClass, retry: "whenWanted" });
    assert.equal(lines.length, 2);
    return lines[0];
  });
  assert.equal(new Set(first).size, FailureClass.options.length);
  // Nothing of a run that has no kind, and an unknown word is not shown as one.
  assert.deepEqual(outcomeLines({}), []);
  assert.deepEqual(outcomeLines({ failureClass: "toString", retry: "odd" }), [
    "create.failUnknown",
    "create.retryAfterChecking",
  ]);
});
