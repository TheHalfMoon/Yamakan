// MPR-207: a generation that ends without a usable video says which kind of end it was, whether
// it may still have used the person's quota, and what trying again takes. The kinds come from the
// real adapters with their stand-ins; nothing is ever sent again for a run that ended.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  RESOURCE_POLICY_HASH,
  Scopes,
  execute,
  type CommandContext,
} from "../core/command/registry.ts";
import { CommandError, ErrorCodes } from "../core/command/errors.ts";
import {
  FAILURE_CLASSES,
  effectiveBilling,
  failureClassOf,
  refusedSubmit,
} from "../core/engines/failures.ts";
import {
  FailureClass,
  type EngineAdapterV2,
  type ExecutionStatus,
} from "../core/engines/contract-v2.ts";
import {
  createGenerationService,
  memoryLedger,
  outcomeOf,
  type GenerationRecord,
} from "../core/engines/generation.ts";
import {
  KAGGLE_RECIPES,
  createKaggleEngine,
  kaggleRecipes,
  type KaggleCli,
} from "../core/engines/kaggle.ts";

const roots: string[] = [];
const handles: { close(): unknown }[] = [];
after(async () => {
  for (const h of handles.reverse()) await h.close();
  for (const r of roots)
    rmSync(r, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
});
const temp = (name: string) => {
  const root = mkdtempSync(path.join(tmpdir(), name));
  roots.push(root);
  return root;
};
const wan = KAGGLE_RECIPES[0]!;
const VIDEO = Buffer.from("a video");
const HASH = createHash("sha256").update(VIDEO).digest("hex");
const SCRIPT = "BRIEF = {}  # yamakan:brief\nprint(BRIEF)\n";
const HOUR = 3_600_000;

// A Kaggle that answers as it is told to, and what it was sent.
function kaggle() {
  const world = {
    state: "RUNNING",
    push: "ok" as "ok" | string,
    ask: null as string | null,
    leave: (_runId: string, _folder: string) => {},
    sent: 0,
    runId: "",
    now: 1_000_000,
  };
  const cli: KaggleCli = async (args) => {
    if (args[1] === "list") return { stdout: "Not found\n" };
    if (args[1] === "status") {
      if (world.ask) throw new Error(world.ask);
      if (world.sent === 0)
        throw new Error("Permission 'kernels.get' was denied");
      return { stdout: `has status "KernelWorkerStatus.${world.state}"` };
    }
    if (args[1] === "push") {
      world.sent++;
      const script = readFileSync(path.join(args[3]!, "run.py"), "utf8");
      const encoded = /b64decode\("([^"]+)"\)/.exec(script)![1]!;
      world.runId = JSON.parse(Buffer.from(encoded, "base64").toString()).runId;
      if (world.push !== "ok") throw new Error(world.push);
      return { stdout: "Kernel version 1 successfully pushed." };
    }
    if (args[1] === "pull") {
      writeFileSync(
        path.join(args[4]!, "kernel-metadata.json"),
        JSON.stringify({ is_private: true }),
      );
      return { stdout: "" };
    }
    throw new Error(`unexpected ${args}`);
  };
  return { world, cli };
}

async function workspace(
  adapterOf?: (root: string) => EngineAdapterV2,
  ledger = memoryLedger(),
  now = () => Date.now(),
) {
  const root = temp("generation-class-");
  const store = new ProjectStore(path.join(root, "workspace"));
  handles.push(store);
  await store.initialize();
  const queue = new JobSupervisor(store);
  handles.push(queue);
  const project = await store.create("Classes");
  const service = createGenerationService({
    adapter: adapterOf?.(root) ?? ({} as EngineAdapterV2),
    store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
    now,
  });
  const ctx = {
    store,
    queue,
    principal: { id: "browser-ui", scopes: new Set(Scopes) },
    generation: { service, recipes: kaggleRecipes() },
  } as unknown as CommandContext;
  return { root, store, queue, project, service, ledger, ctx };
}

// A project with a Kaggle engine over its stand-in, and one run started from it.
async function onKaggle() {
  const k = kaggle();
  const w = await workspace(
    (root) =>
      createKaggleEngine({
        cli: k.cli,
        username: "someone",
        folderRoot: root,
        scriptFor: async () => SCRIPT,
        download: async (_r, folder) => k.world.leave(k.world.runId, folder),
        now: () => k.world.now,
        watchMs: 10,
        stopGraceMs: 1000,
      }),
    memoryLedger(),
    () => k.world.now,
  );
  const ask = {
    projectId: w.project.id,
    recipe: kaggleRecipes()[0]!,
    prompt: "go",
    seed: 1,
    width: wan.width,
    height: wan.height,
    durationFrames: 100,
  };
  return { ...w, ...k, ask, start: () => w.service.start(ask) };
}
const receipt = (folder: string, content: object) =>
  writeFileSync(path.join(folder, "receipt.json"), JSON.stringify(content));
const rowsOf = (w: {
  service: { list(id: string): GenerationRecord[] };
  ledger: { list(id: string): GenerationRecord[] };
  project: { id: string };
}) => w.ledger.list(w.project.id);

test("every class has a meaning, a billing answer and advice", () => {
  assert.deepEqual(
    Object.keys(FAILURE_CLASSES).sort(),
    [...FailureClass.options].sort(),
  );
  // The eight of the card, and the three the founder added (OA-18).
  assert.equal(FailureClass.options.length, 11);
  for (const entry of Object.values(FAILURE_CLASSES)) {
    assert.ok(entry.meaning.length > 10);
    assert.equal(typeof entry.mayStillBeBilled, "boolean");
    assert.match(
      entry.retry,
      /^(afterChange|afterWaiting|afterChecking|whenWanted)$/,
    );
  }
  const never = Object.entries(FAILURE_CLASSES)
    .filter(([, e]) => !e.mayStillBeBilled)
    .map(([k]) => k);
  assert.deepEqual(never.sort(), [
    "credentialRejected",
    "quotaExhausted",
    "refusedByPolicy",
  ]);
  assert.throws(() => {
    (FAILURE_CLASSES as Record<string, unknown>).timeout = null;
  });
});

test("a local run is never billed, nor one that did not leave or was refused as it was sent", () => {
  const base = {
    failureClass: "timeout" as const,
    remote: "kaggle:someone",
    left: true,
    refusedAtSubmit: false,
  };
  assert.deepEqual(effectiveBilling(base), {
    mayStillBeBilled: true,
    billedIn: "providerQuota",
  });
  for (const over of [
    { remote: null },
    { remote: undefined },
    { left: false },
    { refusedAtSubmit: true },
    { failureClass: "quotaExhausted" as const },
  ])
    assert.deepEqual(effectiveBilling({ ...base, ...over }), {
      mayStillBeBilled: false,
      billedIn: "none",
    });
});

test("a refusal carries its class behind the same public error", () => {
  const error = refusedSubmit("quotaExhausted", "Words.");
  assert.equal(error.code, "CAPABILITY_UNAVAILABLE");
  assert.equal(error.message, "Words.");
  assert.equal(failureClassOf(error), "quotaExhausted");
  assert.equal(failureClassOf(new CommandError("BUSY", "x")), undefined);
  assert.equal(failureClassOf(new Error("x")), undefined);
  // Nothing of it reaches the wire.
  assert.ok(!JSON.stringify(error).includes("quotaExhausted"));
});

test("a refused start is stored with its class, unlisted, and not billed", async () => {
  for (const [set, kind] of [
    [
      { push: "Maximum weekly GPU quota of 30.00 hours reached." },
      "quotaExhausted",
    ],
    [
      { push: "429 Client Error: Too Many Requests for url: x" },
      "quotaExhausted",
    ],
    [{ push: "Maximum batch GPU session count reached" }, "quotaExhausted"],
    [
      { push: "401 Client Error: Unauthorized for url: x" },
      "credentialRejected",
    ],
    [
      { push: "Authentication required to call the Kaggle API." },
      "credentialRejected",
    ],
    [{ push: "403 Client Error: Forbidden for url: x" }, "providerRejected"],
    [{ push: "Kernel push error: The title is taken" }, "providerRejected"],
    [
      { ask: "401 Client Error: Unauthorized for url: x" },
      "credentialRejected",
    ],
    [{ ask: "network down" }, "refusedByPolicy"],
  ] as const) {
    const w = await onKaggle();
    Object.assign(w.world, set);
    const sent = w.world.sent;
    await assert.rejects(w.start(), (e: CommandError) => {
      assert.equal(e.code, "CAPABILITY_UNAVAILABLE", JSON.stringify(set));
      return true;
    });
    assert.deepEqual(w.service.list(w.project.id), []);
    const [row] = rowsOf(w);
    assert.equal(row!.failureClass, kind, JSON.stringify(set));
    assert.equal(row!.mayStillBeBilled, false);
    assert.equal(row!.endedAt, w.world.now);
    assert.equal(row!.dismissed, true);
    assert.ok(w.world.sent - sent <= 1);
  }
});

test("a refusal before sending is refused by policy, and an error that is no refusal is unknown", async () => {
  for (const [submit, kind] of [
    [async () => ({ refused: "WEIGHTS_ABSENT" as const }), "refusedByPolicy"],
    [
      async () => {
        throw new CommandError("VALIDATION", "No.");
      },
      "refusedByPolicy",
    ],
    [
      async () => {
        throw new Error("Something broke.");
      },
      "unknown",
    ],
  ] as const) {
    const w = await workspace(
      () =>
        ({
          submit,
          location: () => "kaggle:someone",
        }) as unknown as EngineAdapterV2,
    );
    await assert.rejects(
      w.service.start({
        projectId: w.project.id,
        recipe: { ...kaggleRecipes()[0]! },
        prompt: "go",
        width: 64,
        height: 36,
        durationFrames: 24,
      }),
    );
    const [row] = w.ledger.list(w.project.id);
    assert.equal(row!.failureClass, kind);
    assert.equal(row!.mayStillBeBilled, false);
  }
});

test("an uncertain send has no class until it ends", async () => {
  const w = await onKaggle();
  w.world.push = "Timed out.";
  const { generationId } = await w.start();
  assert.equal(w.service.row(generationId)!.failureClass, undefined);
  assert.equal(w.service.row(generationId)!.endedAt, undefined);
  assert.deepEqual(outcomeOf(w.service.row(generationId)!), {});
});

test("every way a Kaggle run ends without a video has its class, and may still be billed", async () => {
  const files = (folder: string, content: object) => {
    writeFileSync(path.join(folder, wan.output), VIDEO);
    receipt(folder, content);
  };
  const done = (runId: string) => ({
    runId,
    stage: "done",
    verified: true,
    frames: wan.frames,
    sha256: HASH,
  });
  for (const [name, state, leave, kind, retry, later] of [
    [
      "the run's own error",
      "ERROR",
      (r: string, f: string) =>
        receipt(f, { runId: r, stage: "failed", error: "ValueError: no" }),
      "providerRejected",
      "afterChange",
      0,
    ],
    ["no words", "ERROR", () => {}, "providerRejected", "afterChange", 0.2],
    [
      "past its limit",
      "ERROR",
      (r: string, f: string) =>
        receipt(f, { runId: r, stage: "failed", error: "ValueError: no" }),
      "timeout",
      "afterChange",
      2,
    ],
    [
      "out of memory, by its own name",
      "ERROR",
      (r: string, f: string) =>
        receipt(f, {
          runId: r,
          stage: "failed",
          error: "OutOfMemoryError: CUDA out of memory.",
        }),
      "resourceExhausted",
      "afterChange",
      0,
    ],
    [
      "words about memory that are not the name",
      "ERROR",
      (r: string, f: string) =>
        receipt(f, {
          runId: r,
          stage: "failed",
          error: "RuntimeError: CUDA out of memory.",
        }),
      "providerRejected",
      "afterChange",
      0,
    ],
    [
      "another run in its place, finished",
      "COMPLETE",
      (_r: string, f: string) => receipt(f, { ...done("another") }),
      "lostJob",
      "afterChecking",
      0.2,
    ],
    [
      "another run in its place, failed",
      "ERROR",
      (_r: string, f: string) =>
        receipt(f, { runId: "another", stage: "failed", error: "x" }),
      "lostJob",
      "afterChecking",
      0.2,
    ],
    [
      "failed its own checks",
      "COMPLETE",
      (r: string, f: string) => files(f, { ...done(r), verified: false }),
      "invalidArtifact",
      "whenWanted",
      0,
    ],
    [
      "its own error, though Kaggle says complete",
      "COMPLETE",
      (r: string, f: string) =>
        receipt(f, { runId: r, stage: "failed", error: "OutOfMemoryError: x" }),
      "invalidArtifact",
      "whenWanted",
      0,
    ],
    [
      "the wrong length",
      "COMPLETE",
      (r: string, f: string) => files(f, { ...done(r), frames: 3 }),
      "invalidArtifact",
      "whenWanted",
      0,
    ],
    [
      "no readable result",
      "COMPLETE",
      (_r: string, f: string) => writeFileSync(path.join(f, "odd.txt"), "x"),
      "invalidArtifact",
      "whenWanted",
      0.2,
    ],
    [
      "stopped there",
      "CANCEL_ACKNOWLEDGED",
      () => {},
      "cancelled",
      "whenWanted",
      0.2,
    ],
  ] as const) {
    const w = await onKaggle();
    w.world.leave = leave as typeof w.world.leave;
    const { generationId } = await w.start();
    w.world.now += later * HOUR;
    w.world.state = state;
    const answer = await w.service.status(generationId);
    assert.ok(
      ["failed", "cancelled"].includes(answer.state),
      `${name}: ${answer.state}`,
    );
    assert.deepEqual(
      [
        answer.failureClass,
        answer.mayStillBeBilled,
        answer.billedIn,
        answer.retry,
      ],
      [kind, true, "providerQuota", retry],
      name,
    );
    assert.equal(answer.endedAt, w.world.now, name);
    // Read and listed again and again, then dismissed: nothing is ever sent.
    for (let i = 0; i < 100; i++) await w.service.status(generationId);
    assert.equal(w.service.list(w.project.id).length, 1);
    await assert.rejects(w.service.importResult(generationId));
    w.service.dismiss(generationId);
    assert.equal(w.world.sent, 1, name);
    assert.equal(w.service.row(generationId)!.endedAt, answer.endedAt);
    assert.equal(w.service.row(generationId)!.failureClass, kind);
  }
});

test("a result that comes down broken each time is an invalid artifact", async () => {
  const w = await onKaggle();
  w.world.leave = (runId, folder) => {
    writeFileSync(path.join(folder, wan.output), Buffer.from("half"));
    receipt(folder, {
      runId,
      stage: "done",
      verified: true,
      frames: wan.frames,
      sha256: HASH,
    });
  };
  const { generationId } = await w.start();
  w.world.state = "COMPLETE";
  let answer = await w.service.status(generationId);
  for (let i = 0; i < 20 && answer.state !== "failed"; i++) {
    assert.equal(answer.failureClass, undefined, "not while it is tried again");
    w.world.now += HOUR;
    answer = await w.service.status(generationId);
  }
  assert.equal(answer.state, "failed");
  assert.equal(answer.failureClass, "invalidArtifact");
});

test("a run that worked has an end and no class", async () => {
  const w = await onKaggle();
  w.world.leave = (runId, folder) => {
    writeFileSync(path.join(folder, wan.output), VIDEO);
    receipt(folder, {
      runId,
      stage: "done",
      verified: true,
      frames: wan.frames,
      sha256: HASH,
    });
  };
  const { generationId } = await w.start();
  w.world.state = "COMPLETE";
  const answer = await w.service.status(generationId);
  assert.equal(answer.state, "succeeded");
  assert.equal(answer.endedAt, w.world.now);
  for (const field of ["failureClass", "mayStillBeBilled", "billedIn", "retry"])
    assert.ok(!(field in answer), field);
});

test("a stopped run that goes on may still be billed, and the first end wins", async () => {
  const w = await onKaggle();
  const { generationId } = await w.start();
  const stoppedAt = (w.world.now += 1000);
  await w.service.cancel(generationId);
  const said = {
    failureClass: "cancelled",
    mayStillBeBilled: true,
    billedIn: "providerQuota",
    retry: "whenWanted",
    endedAt: stoppedAt,
  };
  assert.deepEqual(outcomeOf(w.service.row(generationId)!), said);
  // It goes on there and reports a failure, then a result: the stop stands.
  for (const state of ["ERROR", "COMPLETE"]) {
    w.world.now += 1000;
    w.world.state = state;
    await w.service.status(generationId);
    assert.deepEqual(outcomeOf(w.service.row(generationId)!), said);
  }
  await assert.rejects(w.service.importResult(generationId), /cancelled/i);
  // Dismissed while it went on is stopped too.
  const other = await onKaggle();
  const run = await other.start();
  other.service.dismiss(run.generationId);
  assert.equal(other.service.row(run.generationId)!.failureClass, "cancelled");
});

test("a status without a class is unknown, never guessed from its words, and one with a class it should not have is not believed", async () => {
  const answer: { now: Partial<ExecutionStatus> } = { now: {} };
  const w = await workspace(
    () =>
      ({
        submit: async () => ({ executionRef: "r" }),
        status: async () => ({ executionRef: "r", ...answer.now }),
        enumerateArtifacts: async () => [],
      }) as unknown as EngineAdapterV2,
  );
  const start = async () =>
    (
      await w.service.start({
        projectId: w.project.id,
        recipe: { ...kaggleRecipes()[0]! },
        prompt: "go",
        width: 64,
        height: 36,
        durationFrames: 24,
      })
    ).generationId;
  for (const state of ["running", "queued", "unknown"] as const) {
    const id = await start();
    answer.now = { state, failureClass: "timeout" };
    const said = await w.service.status(id);
    assert.ok(!("failureClass" in said), state);
    assert.equal(w.service.row(id)!.failureClass, undefined);
  }
  const worked = await start();
  answer.now = { state: "succeeded", failureClass: "timeout" };
  assert.ok(!("failureClass" in (await w.service.status(worked))));
  const id = await start();
  answer.now = {
    state: "failed",
    diagnostic: "The quota ran out of memory and timed out.",
  };
  const said = await w.service.status(id);
  assert.equal(said.failureClass, "unknown");
  assert.equal(said.retry, "afterChecking");
  // No engine here says it sends off this computer.
  assert.equal(said.mayStillBeBilled, false);
  assert.equal(said.billedIn, "none");
});

test("a row stored before failure classes reads as unknown, and one with a word that is none too", async () => {
  const w = await workspace();
  const row = (over: Partial<GenerationRecord>): GenerationRecord => ({
    generationId: crypto.randomUUID(),
    projectId: w.project.id,
    recipe: kaggleRecipes()[0]!,
    prompt: "go",
    seed: 1,
    width: 64,
    height: 36,
    durationFrames: 24,
    firstFrameAssetId: null,
    inputs: [],
    executionRef: "r",
    phase: "sent",
    startedAt: 1,
    state: "failed",
    diagnostic: "The run failed on Kaggle.",
    videoSha256: null,
    imported: null,
    remote: "kaggle:someone",
    cancelled: false,
    dismissed: false,
    ...over,
  });
  const ledger = w.queue.generationLedger();
  const rows = [
    row({}),
    row({ failureClass: "somethingElse" as never }),
    row({ state: "running", cancelled: true }),
    row({ state: "succeeded" }),
    row({ state: "running" }),
  ];
  for (const r of rows) ledger.begin(r);
  const service = createGenerationService({
    adapter: {} as EngineAdapterV2,
    store: w.store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
  });
  const ctx = { ...w.ctx, generation: { service, recipes: [] } };
  const listed = (
    await execute(ctx as CommandContext, "yamakan.generation.list", {
      projectId: w.project.id,
    })
  ).result as Record<string, unknown>[];
  const of = (r: GenerationRecord) =>
    listed.find((x) => x.generationId === r.generationId)!;
  for (const r of rows.slice(0, 3)) {
    assert.deepEqual(
      [of(r).failureClass, of(r).retry, of(r).mayStillBeBilled, of(r).billedIn],
      ["unknown", "afterChecking", true, "providerQuota"],
    );
    assert.ok(!("endedAt" in of(r)));
  }
  for (const r of rows.slice(3))
    for (const field of [
      "failureClass",
      "mayStillBeBilled",
      "retry",
      "endedAt",
    ])
      assert.ok(!(field in of(r)), field);
  // Reading changed nothing.
  assert.equal(ledger.read(rows[0]!.generationId)!.failureClass, undefined);
  // The status answer says the same.
  const said = (
    await execute(ctx as CommandContext, "yamakan.generation.status", {
      generationId: rows[0]!.generationId,
    })
  ).result as Record<string, unknown>;
  assert.equal(said.failureClass, "unknown");
  assert.equal(said.state, "failed");
});

test("a held copy says nothing of an end that is not its own", async () => {
  assert.deepEqual(
    outcomeOf({
      state: "failed",
      failureClass: "timeout",
      endedAt: 5,
      held: true,
    } as GenerationRecord),
    {},
  );
});

test("the error code list is unchanged", () => {
  assert.equal(ErrorCodes.length, 14);
});

test("no generation code imports the transient retry rules", () => {
  const engines = new URL("../core/engines/", import.meta.url);
  const files = [
    ...readdirSync(engines)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => new URL(f, engines)),
    new URL("../core/jobs.ts", import.meta.url),
  ];
  assert.ok(files.length > 10);
  for (const file of files)
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /classifyFailure|shouldRetry|TRANSIENT_ERRORS/,
      String(file),
    );
});
