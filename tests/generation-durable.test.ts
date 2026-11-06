// A generation running elsewhere outlives a restart of this service: it is followed
// again from the job record, and never sent again. A real store and job supervisor, and
// a stand-in for Kaggle's CLI that remembers what it was sent. "Restart" here is closing
// them and opening new ones on the same folder.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor, REMOTE_GENERATION } from "../core/jobs.ts";
import {
  KAGGLE_RECIPES,
  cliWords,
  createKaggleEngine,
  kaggleRecipes,
  ledgerOptions,
  type KaggleCli,
} from "../core/engines/kaggle.ts";
import {
  createGenerationService,
  type GenerationRecipe,
} from "../core/engines/generation.ts";
import { mediaTools } from "../core/process/workers.ts";
import { backupWorkspace, restoreWorkspace } from "../core/recovery.ts";

const wan = KAGGLE_RECIPES[0];
const SCRIPT = "BRIEF = {}  # yamakan:brief\n";
const roots: string[] = [];
after(() => {
  for (const r of roots)
    try {
      rmSync(r, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    } catch {
      // Windows can still hold a folder: tidying up is not what this tests.
    }
});

// One small real video, so that the store's own import accepts it.
const videoRoot = mkdtempSync(path.join(tmpdir(), "generation-durable-video-"));
roots.push(videoRoot);
const VIDEO_FILE = path.join(videoRoot, "made.mp4");
execFileSync(
  mediaTools().ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=64x48:rate=24:duration=0.5",
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    VIDEO_FILE,
  ],
  { windowsHide: true },
);
const VIDEO = readFileSync(VIDEO_FILE);
const HASH = createHash("sha256").update(VIDEO).digest("hex");

const BLOCKED = /still being followed|few minutes ago/;
const MISSING = "Cannot access kernel (Permission 'kernels.get' was denied).";

// Kaggle: outlives the service, and remembers every push.
function kaggle() {
  const world = {
    state: "RUNNING",
    pushes: [] as { runId: string; prompt: string }[],
    // What a push does: "ok", or lands but its answer is lost, or is refused.
    pushMode: "ok" as
      "ok" | "lost-after-landing" | "lost-before-landing" | "refused",
    downloads: 0,
    down: false,
    onPush: null as null | ((runId: string) => void),
    pushError: "Timed out waiting for an answer",
    calls: 0,
    downloadFails: false,
    garble: null as null | "video" | "receipt" | "error-body" | "empty-video",
    // Kaggle refuses any question about the notebook, though it exists.
    denied: false,
    listFails: false,
    listOutput: null as null | string,
    privateAnswer: true,
    pushStdout: "successfully pushed",
    beforeStatus: null as null | (() => Promise<void>),
    beforePush: null as null | (() => Promise<void>),
  };
  const cli: KaggleCli = async (args) => {
    world.calls++;
    if (world.down) throw new Error("connection reset");
    if (args[1] === "list") {
      if (world.listFails) throw new Error("Authentication required");
      return {
        stdout:
          world.listOutput ??
          (world.pushes.length || world.denied
            ? `ref,title\nsomeone/${wan.slug},${wan.slug}\n`
            : "Not found\n"),
      };
    }
    if (args[1] === "status") {
      await world.beforeStatus?.();
      if (world.denied || world.pushes.length === 0) throw new Error(MISSING);
      return { stdout: `has status "KernelWorkerStatus.${world.state}"` };
    }
    if (args[1] === "pull") {
      writeFileSync(
        path.join(args[4], "kernel-metadata.json"),
        JSON.stringify({ is_private: world.privateAnswer }),
      );
      return { stdout: "" };
    }
    if (args[1] === "push") {
      await world.beforePush?.();
      if (world.pushMode === "refused") throw new Error("Maximum GPU quota");
      if (world.pushMode === "lost-before-landing")
        throw new Error(world.pushError);
      const script = readFileSync(path.join(args[3], "run.py"), "utf8");
      const brief = JSON.parse(
        Buffer.from(
          /b64decode\("([^"]+)"\)/.exec(script)![1],
          "base64",
        ).toString(),
      );
      world.onPush?.(brief.runId);
      world.pushes.push({ runId: brief.runId, prompt: brief.prompt });
      if (world.pushMode === "lost-after-landing")
        throw new Error(world.pushError);
      return { stdout: world.pushStdout };
    }
    throw new Error(`unexpected ${args}`);
  };
  const download = async (_r: unknown, folder: string) => {
    world.downloads++;
    world.calls++;
    const last = world.pushes.at(-1)!;
    if (world.downloadFails) {
      writeFileSync(path.join(folder, "part.log"), last.prompt);
      throw new Error("connection reset");
    }
    writeFileSync(
      path.join(folder, wan.output),
      world.garble === "video" ? "<html>503</html>" : VIDEO,
    );
    if (world.garble === "receipt") {
      writeFileSync(path.join(folder, "receipt.json"), "<html>503</html>");
      return;
    }
    if (world.garble === "error-body") {
      writeFileSync(
        path.join(folder, "receipt.json"),
        '{"code":403,"message":"Forbidden"}',
      );
      return;
    }
    if (world.garble === "empty-video")
      writeFileSync(path.join(folder, wan.output), "");
    writeFileSync(
      path.join(folder, "receipt.json"),
      JSON.stringify({
        runId: last.runId,
        stage: "done",
        verified: true,
        frames: wan.frames,
        sha256: HASH,
        prompt: last.prompt,
      }),
    );
  };
  return { world, cli, download };
}

const recipe = (): GenerationRecipe => {
  const [r] = kaggleRecipes();
  return r;
};

// The service as it starts: a store, a supervisor, and what they remember.
const open = (root: string, k: ReturnType<typeof kaggle>, now: () => number) =>
  openAt(path.join(root, "workspace"), root, k, now);

async function openAt(
  workspace: string,
  root: string,
  k: ReturnType<typeof kaggle>,
  now: () => number,
) {
  const store = new ProjectStore(workspace);
  await store.initialize();
  const queue = new JobSupervisor(store);
  await queue.start();
  const ledger = queue.generationLedger();
  const service = createGenerationService({
    adapter: createKaggleEngine({
      cli: k.cli,
      username: "someone",
      folderRoot: path.join(root, "tmp"),
      scriptFor: async () => SCRIPT,
      download: k.download as never,
      now,
      ...ledgerOptions(ledger),
    }),
    store,
    resourcePolicyHash: "c".repeat(64),
    ledger,
    now,
  });
  return {
    store,
    queue,
    ledger,
    service,
    close: async () => {
      await queue.close();
      await store.close();
    },
  };
}

async function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "generation-durable-"));
  roots.push(root);
  mkdirSync(path.join(root, "tmp"));
  const k = kaggle();
  let time = Date.now();
  const clock = {
    now: () => time,
    pass: (ms: number) => {
      time += ms;
    },
  };
  let s = await open(root, k, clock.now);
  const project = await s.store.create("Durable");
  const start = (prompt = "A kite.") =>
    s.service.start({
      projectId: project.id,
      recipe: recipe(),
      prompt,
      seed: 7,
      width: wan.width,
      height: wan.height,
      durationFrames: 100,
    });
  return {
    root,
    k,
    clock,
    project,
    start,
    get s() {
      return s;
    },
    restart: async () => {
      await s.close();
      s = await open(root, k, clock.now);
    },
  };
}

const row = (f: Awaited<ReturnType<typeof fixture>>, id: string) =>
  f.s.store.read(
    (db) =>
      db
        .prepare(
          "SELECT kind, state, artifact, error FROM jobs WHERE job_id = ?",
        )
        .get(id) as {
        kind: string;
        state: string;
        artifact: string | null;
        error: string | null;
      },
  );

test("a run is recorded before anything leaves, in the job table", async () => {
  const f = await fixture();
  let atPush: { state: string; phase: string } | null = null;
  f.k.world.onPush = (runId) => {
    atPush = {
      state: row(f, runId).state,
      phase: f.s.ledger.read(runId)!.phase,
    };
  };
  const { generationId } = await f.start();
  assert.deepEqual(atPush, { state: "preparing", phase: "sending" });
  assert.equal(row(f, generationId).kind, REMOTE_GENERATION);
  assert.equal(row(f, generationId).state, "running");
  assert.equal(f.k.world.pushes[0].runId, generationId, "the receipt's name");
  await f.s.close();
});

test("after a restart the run is followed, and never sent again", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  await f.restart();
  // Several restarts: the old requeue limit must not apply either.
  await f.restart();
  await f.restart();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(f.k.world.pushes.length, 1, "not sent again");
  assert.equal(row(f, id).state, "running");
  assert.equal((await f.s.service.status(id)).state, "running");
  f.k.world.state = "COMPLETE";
  assert.equal((await f.s.service.status(id)).state, "succeeded");
  assert.equal(row(f, id).state, "validating");
  const made = await f.s.service.importResult(id);
  assert.equal(made.lineage.outputHash, HASH);
  assert.equal(row(f, id).state, "succeeded");
  assert.equal(row(f, id).artifact, `asset:${made.assetId}`);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a project keeps its run in the list across a restart, with what it asked", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start("A red kite.");
  await f.restart();
  const [listed] = f.s.service.list(f.project.id);
  assert.equal(listed.generationId, id);
  assert.equal(listed.prompt, "A red kite.");
  assert.equal(listed.seed, 7);
  assert.equal(listed.phase, "sent");
  f.s.service.dismiss(id);
  assert.deepEqual(f.s.service.list(f.project.id), []);
  await f.s.close();
});

test("a finished video needs no second download after a restart", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  assert.equal((await f.s.service.status(id)).state, "succeeded");
  const downloads = f.k.world.downloads;
  // Kaggle's latest is now something else: its output could not be fetched again.
  await f.restart();
  f.k.world.down = true;
  const made = await f.s.service.importResult(id);
  assert.equal(made.lineage.outputHash, HASH);
  assert.equal(f.k.world.downloads, downloads);
  await f.s.close();
});

test("repeated imports are one asset, across a restart and at once", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  await f.s.service.status(id);
  const [a, b] = await Promise.all([
    f.s.service.importResult(id),
    f.s.service.importResult(id),
  ]);
  assert.equal(a.assetId, b.assetId);
  await f.restart();
  const c = await f.s.service.importResult(id);
  assert.equal(c.assetId, a.assetId);
  const { assets } = await f.s.store.exportProject(f.project.id);
  assert.equal(assets.length, 1);
  await f.s.close();
});

test("an import interrupted before it was recorded finds its asset, not a second one", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  await f.s.service.status(id);
  const first = await f.s.service.importResult(id);
  // The store has the asset; the record of having imported it never got written.
  f.s.ledger.update(id, { imported: null });
  await f.restart();
  const again = await f.s.service.importResult(id);
  assert.equal(again.assetId, first.assetId);
  assert.equal((await f.s.store.exportProject(f.project.id)).assets.length, 1);
  await f.s.close();
});

test("a crash while sending leaves a record, found if it arrived", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  // As if the service died between recording and hearing the push's answer.
  f.s.ledger.update(id, { phase: "sending", executionRef: null });
  await f.restart();
  assert.equal(f.s.service.list(f.project.id)[0].phase, "sending");
  assert.equal(f.k.world.pushes.length, 1, "not sent again");
  f.k.world.state = "COMPLETE";
  assert.equal((await f.s.service.status(id)).state, "succeeded");
  assert.equal(f.s.ledger.read(id)!.phase, "sent");
  await f.s.close();
});

test("a crash while sending, if it never arrived, ends plainly and is not resent", async () => {
  const f = await fixture();
  const earlier = await f.start("An earlier run.");
  f.k.world.state = "COMPLETE";
  await f.s.service.status(earlier.generationId);
  await f.s.service.importResult(earlier.generationId);
  // A record for a second run whose push never landed.
  f.s.ledger.begin({
    ...f.s.ledger.read(earlier.generationId)!,
    generationId: crypto.randomUUID(),
    phase: "sending",
    executionRef: null,
    state: "queued",
    imported: null,
    videoSha256: null,
    cancelled: false,
  });
  const [lost] = f.s.service.list(f.project.id);
  const id = lost.generationId;
  await f.restart();
  f.clock.pass(10 * 60 * 1000);
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /not this one/);
  assert.equal(f.k.world.pushes.length, 1, "not sent again");
  await f.s.close();
});

test("a lost answer to a push is uncertain, not failed, and is not sent twice", async () => {
  const f = await fixture();
  f.k.world.pushMode = "lost-after-landing";
  const { generationId: id } = await f.start();
  const record = f.s.ledger.read(id)!;
  assert.equal(record.phase, "sending");
  assert.match(record.diagnostic!, /may or may not have reached/);
  assert.equal(f.k.world.pushes.length, 1);
  await f.restart();
  f.k.world.pushMode = "ok";
  assert.equal((await f.s.service.status(id)).state, "running");
  assert.equal(
    f.s.ledger.read(id)!.phase,
    "sending",
    "a notebook's state could be another run's",
  );
  assert.match(f.s.ledger.read(id)!.diagnostic!, /may or may not/);
  await assert.rejects(f.start("Another."), BLOCKED);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a push Kaggle refused is a failure with nothing to follow", async () => {
  const f = await fixture();
  f.k.world.pushMode = "refused";
  await assert.rejects(f.start(), /did not take the run: Maximum GPU quota/);
  // Nothing was sent, so it is not offered to the page as a run that failed there.
  assert.deepEqual(f.s.service.list(f.project.id), []);
  const failed = f.s.store.read(
    (db) =>
      db
        .prepare("SELECT state FROM jobs WHERE kind = ?")
        .all(REMOTE_GENERATION) as { state: string }[],
  );
  assert.deepEqual(
    failed.map((r) => r.state),
    ["failed"],
  );
  await f.s.close();
});

const PAST_LIMIT_MS = (wan.timeoutSeconds + 21 * 60) * 1000;

test("past its limit, a run still shown running is not ended by the clock", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  await f.restart();
  f.clock.pass(PAST_LIMIT_MS);
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "running");
  assert.match(answer.diagnostic!, /past its time limit/);
  // Its own result still counts: the queue may have taken the time.
  f.k.world.state = "COMPLETE";
  assert.equal((await f.s.service.status(id)).state, "succeeded");
  const made = await f.s.service.importResult(id);
  assert.equal(made.lineage.outputHash, HASH);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("past its limit, another run's result ends it plainly", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  f.clock.pass(PAST_LIMIT_MS);
  // Started elsewhere: this service had no part in it.
  f.k.world.pushes.push({ runId: "someone-else", prompt: "Theirs." });
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /not this one/);
  await f.s.close();
});

for (const trouble of ["down", "downloadFails"] as const)
  test(`past its limit, ${trouble} does not lose a finished video`, async () => {
    const f = await fixture();
    const { generationId: id } = await f.start("A SECRET kite.");
    f.k.world.state = "COMPLETE";
    await f.restart();
    f.clock.pass(PAST_LIMIT_MS);
    f.k.world[trouble] = true;
    const answer = await f.s.service.status(id);
    assert.equal(answer.state, "unknown");
    assert.match(answer.diagnostic!, /past its time limit/);
    assert.match(answer.diagnostic!, /Could not get an answer/);
    assert.equal(row(f, id).state, "running");
    // No part of a failed download stays, with the prompt in it.
    const left = readdirSync(path.join(f.root, "tmp"), {
      recursive: true,
      withFileTypes: true,
    }).filter((e) => e.isFile());
    assert.deepEqual(left, []);
    f.k.world[trouble] = false;
    assert.equal((await f.s.service.status(id)).state, "succeeded");
    assert.equal((await f.s.service.importResult(id)).lineage.outputHash, HASH);
    await f.s.close();
  });

test("a failure stays a failure across a restart, with its reason", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "ERROR";
  f.clock.pass(10 * 60 * 1000);
  const first = await f.s.service.status(id);
  assert.equal(first.state, "failed");
  await f.restart();
  const again = await f.s.service.status(id);
  assert.equal(again.state, "failed");
  assert.equal(again.diagnostic, first.diagnostic);
  // A later answer about the notebook is not about this run.
  f.k.world.state = "COMPLETE";
  await f.restart();
  const downloads = f.k.world.downloads;
  assert.equal((await f.s.service.status(id)).state, "failed");
  await assert.rejects(f.s.service.importResult(id), /Only a finished/);
  assert.equal(f.k.world.downloads, downloads, "and it was not asked");
  await f.s.close();
});

test("not being able to ask after a restart is not the run failing", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  await f.restart();
  f.k.world.down = true;
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "unknown");
  assert.match(answer.diagnostic!, /Could not get an answer/);
  assert.equal(row(f, id).state, "running");
  f.k.world.down = false;
  assert.equal((await f.s.service.status(id)).state, "running");
  await f.s.close();
});

test("stopping following says the run goes on, across a restart, and does not import", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  const stopped = await f.s.service.cancel(id);
  assert.equal(stopped.requested, false, "Kaggle has no way to be asked");
  assert.equal(stopped.remoteOutcome, "continuing");
  assert.equal(stopped.remoteAcknowledged, false);
  assert.equal(row(f, id).state, "cancelled");
  assert.match(
    row(f, id).error!,
    /not told to stop/,
    "what the job list shows",
  );
  await f.restart();
  assert.equal(f.s.ledger.read(id)!.cancelled, true);
  f.k.world.state = "COMPLETE";
  await assert.rejects(f.s.service.importResult(id), /cancelled/);
  await f.s.close();
});

test("the job commands cannot resend or pretend to stop a generation", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  assert.throws(() => f.s.queue.cancel(id), /yamakan\.generation\.cancel/);
  f.s.store.transaction((db) => {
    db.prepare(
      "UPDATE jobs SET state = 'reconciliationRequired' WHERE job_id = ?",
    ).run(id);
  });
  assert.throws(() => f.s.queue.retry(id), /never sent again automatically/);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a really restored copy does not follow, import, cancel or resend the original's run", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  const home = path.join(f.root, "home");
  const backup = await backupWorkspace(f.s.store, home);
  await f.s.close();
  const copy = path.join(f.root, "copy");
  await restoreWorkspace(path.join(home, "backups", backup.backupId), copy);
  const c = await openAt(copy, f.root, f.k, f.clock.now);
  try {
    assert.equal(c.ledger.read(id)!.held, true);
    f.k.world.state = "COMPLETE";
    const calls = f.k.world.calls;
    const answer = await c.service.status(id);
    assert.equal(answer.state, "unknown");
    assert.match(answer.diagnostic!, /restored from a backup/);
    assert.equal(f.k.world.calls, calls, "Kaggle was not asked");
    await assert.rejects(c.service.importResult(id), /restored from a backup/);
    const stop = await c.service.cancel(id);
    assert.equal(stop.requested, false);
    assert.throws(() => c.queue.retry(id), /never sent again automatically/);
    assert.throws(() => c.queue.discard(id), /belongs to the original/);
    assert.equal(c.ledger.read(id)!.held, true, "and it stays held");
    assert.equal(f.k.world.pushes.length, 1);
  } finally {
    await c.close();
  }
});

test("a restored copy does not import the original's run that had failed", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "ERROR";
  f.clock.pass(10 * 60 * 1000);
  assert.equal((await f.s.service.status(id)).state, "failed");
  const home = path.join(f.root, "home");
  const backup = await backupWorkspace(f.s.store, home);
  await f.s.close();
  const copy = path.join(f.root, "copy");
  await restoreWorkspace(path.join(home, "backups", backup.backupId), copy);
  const c = await openAt(copy, f.root, f.k, f.clock.now);
  try {
    f.k.world.state = "COMPLETE";
    await assert.rejects(c.service.importResult(id), /Only a finished/);
  } finally {
    await c.close();
  }
});

test("just after a restart, a run just sent still blocks another", async () => {
  const f = await fixture();
  await f.start();
  f.k.world.state = "COMPLETE";
  await f.restart();
  // Kaggle may not show it yet, and this service has no memory of having sent it.
  await assert.rejects(f.start("Another."), BLOCKED);
  assert.equal(f.k.world.pushes.length, 1);
  // Its push may have taken six minutes to land, and three more to show.
  f.clock.pass(8 * 60 * 1000);
  await assert.rejects(f.start("Another."), BLOCKED);
  f.clock.pass(2 * 60 * 1000);
  await f.start("Another.");
  assert.equal(f.k.world.pushes.length, 2, "once settled");
  await f.s.close();
});

test("after a restart, an earlier run does not answer for one that may still be landing", async () => {
  const f = await fixture();
  const earlier = await f.start("An earlier run.");
  f.k.world.state = "COMPLETE";
  await f.s.service.status(earlier.generationId);
  f.clock.pass(10 * 60 * 1000);
  f.k.world.pushMode = "lost-before-landing";
  const { generationId: id } = await f.start("Sent, with no answer.");
  await f.restart();
  // Its push may have landed as late as six minutes on, with three more to show.
  f.clock.pass(5 * 60 * 1000);
  assert.equal((await f.s.service.status(id)).state, "queued");
  f.clock.pass(5 * 60 * 1000);
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /not this one/);
  await f.s.close();
});

test("stopping following does not lift the wait for a run just sent", async () => {
  const f = await fixture();
  f.k.world.pushMode = "lost-after-landing";
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  await f.s.service.cancel(id);
  await f.restart();
  f.k.world.pushMode = "ok";
  await assert.rejects(f.start("Another."), BLOCKED);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a run another project left unwatched is collected before a new one replaces it", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start("Left behind.");
  f.k.world.state = "COMPLETE";
  f.clock.pass(10 * 60 * 1000);
  await f.restart();
  const other = await f.s.store.create("Elsewhere");
  await f.s.service.start({
    projectId: other.id,
    recipe: recipe(),
    prompt: "The new one.",
    seed: 8,
    width: wan.width,
    height: wan.height,
    durationFrames: 100,
  });
  assert.equal(f.k.world.pushes.length, 2);
  assert.equal(f.s.ledger.read(id)!.videoSha256, HASH);
  f.k.world.down = true;
  assert.equal((await f.s.service.importResult(id)).lineage.outputHash, HASH);
  await f.s.close();
});

test("a stop still being carried out on Kaggle counts as busy", async () => {
  const f = await fixture();
  await f.start();
  f.k.world.state = "CANCEL_REQUESTED";
  f.clock.pass(10 * 60 * 1000);
  await assert.rejects(f.start("Another."), /still running/);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("stopping following an uncertain send does not say it is running", async () => {
  const f = await fixture();
  f.k.world.pushMode = "lost-before-landing";
  const { generationId: id } = await f.start();
  assert.equal((await f.s.service.cancel(id)).remoteOutcome, "unknown");
  await f.s.close();
});

for (const message of [
  "504 Gateway Time-out",
  "500 Internal Server Error",
  "The Kaggle CLI failed (1).",
  "SSL: UNEXPECTED_EOF_WHILE_READING",
  'File "kaggle/api.py", line 404, in push\nConnectionResetError',
  "Timed out. 403 Forbidden",
  "Maximum retries in urllib3",
]) {
  test(`after a push is tried, "${message}" is uncertain, not a refusal`, async () => {
    const f = await fixture();
    f.k.world.pushMode = "lost-after-landing";
    f.k.world.pushError = message;
    const { generationId: id } = await f.start();
    assert.equal(f.s.ledger.read(id)!.phase, "sending");
    assert.notEqual(f.s.ledger.read(id)!.state, "failed");
    await f.s.close();
  });
}

for (const message of [
  "403 Client Error: Forbidden for url: https://www.kaggle.com/api/v1/kernels/push",
  "429 Too Many Requests",
  "Maximum batch GPU session count of 2 reached",
  "Permission 'kernels.save' was denied",
  "Authentication required to call the Kaggle API.",
])
  test(`after a push is tried, "${message}" is a refusal`, async () => {
    const f = await fixture();
    f.k.world.pushMode = "lost-before-landing";
    f.k.world.pushError = message;
    await assert.rejects(f.start(), /did not take the run/);
    await f.s.close();
  });

test("an uncertain send that never landed can be given up on, and then started again", async () => {
  const f = await fixture();
  f.k.world.pushMode = "lost-before-landing";
  const { generationId: id } = await f.start();
  assert.equal(f.k.world.pushes.length, 0);
  assert.equal(f.s.ledger.read(id)!.phase, "sending");
  // Kaggle says what it says of a notebook that does not exist.
  assert.equal((await f.s.service.status(id)).state, "unknown");
  await assert.rejects(f.start("Too soon."), BLOCKED);
  await f.s.service.cancel(id);
  await assert.rejects(f.start("Still too soon."), /few minutes ago/);
  f.clock.pass(10 * 60 * 1000);
  f.k.world.pushMode = "ok";
  await f.start("Started again by a person.");
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a dismissed run stops counting as work, and says nothing to Kaggle", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  await f.s.service.status(id);
  assert.equal(row(f, id).state, "validating");
  const calls = f.k.world.calls;
  f.s.service.dismiss(id);
  assert.equal(f.k.world.calls, calls);
  assert.equal(row(f, id).state, "cancelled");
  assert.deepEqual(f.s.service.list(f.project.id), []);
  await f.s.close();
});

test("a push Kaggle refused does not count as a notebook existing", async () => {
  const f = await fixture();
  f.k.world.pushMode = "refused";
  await assert.rejects(f.start(), /Maximum GPU quota/);
  f.k.world.pushMode = "ok";
  await f.start("Started again by a person.");
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a video waiting to come in survives the sweep of old folders", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  await f.s.service.status(id);
  const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const folder = path.join(f.root, "tmp", `yamakan-kaggle-work-${id}`);
  utimesSync(folder, old, old);
  await f.restart();
  await new Promise((r) => setTimeout(r, 200));
  f.k.world.down = true;
  const made = await f.s.service.importResult(id);
  assert.equal(made.lineage.outputHash, HASH);
  await f.s.close();
});

for (const end of ["imported", "dismissed"] as const)
  test(`a video ${end} leaves with the sweep of old folders`, async () => {
    const f = await fixture();
    const { generationId: id } = await f.start();
    f.k.world.state = "COMPLETE";
    await f.s.service.status(id);
    if (end === "imported") await f.s.service.importResult(id);
    else f.s.service.dismiss(id);
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const folder = path.join(f.root, "tmp", `yamakan-kaggle-work-${id}`);
    utimesSync(folder, old, old);
    await f.restart();
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(existsSync(folder), false);
    await f.s.close();
  });

test("a refusal is not read as a new notebook while the account lists it", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.s.service.dismiss(id);
  await f.restart();
  f.clock.pass(10 * 60 * 1000);
  f.k.world.denied = true;
  await assert.rejects(f.start("Another."), /Could not ask Kaggle/);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a notebook deleted on Kaggle can be made again", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.s.service.dismiss(id);
  await f.restart();
  f.clock.pass(10 * 60 * 1000);
  const before = f.k.world.pushes;
  f.k.world.pushes = [];
  await f.start("Made again.");
  assert.equal(f.k.world.pushes.length, 1);
  assert.equal(before.length, 1);
  await f.s.close();
});

for (const [what, output] of [
  [
    "more pages than were read",
    `ref,title\nsomeone/other,o\nNext Page Token = abc\n`,
  ],
  ["no list at all", "Something else entirely\n"],
] as const)
  test(`a refusal is not read as a new notebook with ${what}`, async () => {
    const f = await fixture();
    f.k.world.listOutput = output;
    await assert.rejects(f.start(), /Could not ask Kaggle/);
    assert.equal(f.k.world.pushes.length, 0);
    await f.s.close();
  });

test("the list is asked for enough of a search to hold the notebook", async () => {
  const f = await fixture();
  const asked: string[][] = [];
  const { cli } = f.k;
  f.k.cli = (async (args: string[], ms: number) => {
    asked.push(args);
    return cli(args, ms);
  }) as typeof cli;
  await f.restart();
  await f.start();
  const list = asked.find((a) => a[1] === "list")!;
  assert.equal(list[list.indexOf("--page-size") + 1], "100");
  await f.s.close();
});

test("with no working credentials, nothing is sent on a first run", async () => {
  const f = await fixture();
  f.k.world.listFails = true;
  await assert.rejects(f.start(), /Could not ask Kaggle/);
  assert.equal(f.k.world.pushes.length, 0);
  assert.deepEqual(f.s.service.list(f.project.id), []);
  await f.s.close();
});

for (const trouble of ["a failed download", "a run still going"] as const)
  test(`with ${trouble}, a new run does not replace an uncollected one`, async () => {
    const f = await fixture();
    const { generationId: id } = await f.start("Left behind.");
    f.clock.pass(10 * 60 * 1000);
    await f.restart();
    if (trouble === "a failed download") {
      f.k.world.state = "COMPLETE";
      f.k.world.downloadFails = true;
    }
    const other = await f.s.store.create("Elsewhere");
    await assert.rejects(
      f.s.service.start({
        projectId: other.id,
        recipe: recipe(),
        prompt: "The new one.",
        seed: 8,
        width: wan.width,
        height: wan.height,
        durationFrames: 100,
      }),
      /still being followed in "Durable"/,
    );
    assert.equal(f.k.world.pushes.length, 1);
    f.k.world.downloadFails = false;
    f.k.world.state = "COMPLETE";
    assert.equal((await f.s.service.status(id)).state, "succeeded");
    await f.s.close();
  });

for (const garble of ["video", "receipt", "error-body", "empty-video"] as const)
  test(`an error page saved as the ${garble} is fetched again, not the run's end`, async () => {
    const f = await fixture();
    const { generationId: id } = await f.start("A SECRET kite.");
    f.k.world.state = "COMPLETE";
    f.clock.pass(10 * 60 * 1000);
    f.k.world.garble = garble;
    const answer = await f.s.service.status(id);
    assert.equal(answer.state, "unknown");
    assert.match(answer.diagnostic!, /fetched again/);
    assert.deepEqual(
      readdirSync(path.join(f.root, "tmp"), {
        recursive: true,
        withFileTypes: true,
      }).filter((e) => e.isFile()),
      [],
    );
    f.k.world.garble = null;
    const downloads = f.k.world.downloads;
    assert.equal((await f.s.service.status(id)).state, "unknown");
    assert.equal(f.k.world.downloads, downloads, "not on every poll");
    f.clock.pass(6 * 60 * 1000);
    assert.equal((await f.s.service.status(id)).state, "succeeded");
    await f.s.close();
  });

test("a result that never comes readable ends, and says so", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.k.world.state = "COMPLETE";
  f.clock.pass(10 * 60 * 1000);
  f.k.world.garble = "receipt";
  let answer = await f.s.service.status(id);
  for (let i = 0; i < 3; i++) {
    assert.equal(answer.state, "unknown");
    f.clock.pass(6 * 60 * 1000);
    answer = await f.s.service.status(id);
  }
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /missing or cannot be read/);
  assert.match(answer.diagnostic!, /still on its notebook/);
  await assert.rejects(f.s.service.importResult(id), /Only a finished/);
  await f.s.close();
});

test("a stop pressed during the send outlasts the send's answer", async () => {
  const f = await fixture();
  let id = "";
  let release = () => {};
  let reached = () => {};
  const atPush = new Promise<void>((done) => {
    reached = done;
  });
  f.k.world.beforePush = () =>
    new Promise<void>((done) => {
      reached();
      release = done;
    });
  const first = f.start();
  await atPush;
  [{ generationId: id }] = f.s.service.list(f.project.id);
  await f.s.service.cancel(id).catch(() => {});
  release();
  await first;
  assert.equal(row(f, id).state, "cancelled");
  assert.match(row(f, id).error!, /not told to stop/);
  await f.s.close();
});

test("an earlier run's answer, read while settling, does not stay on disk", async () => {
  const f = await fixture();
  f.k.world.pushes.push({ runId: "older", prompt: "A SECRET older one." });
  f.k.world.state = "COMPLETE";
  f.k.world.pushMode = "lost-before-landing";
  const { generationId: id } = await f.start();
  f.k.world.state = "ERROR";
  assert.equal((await f.s.service.status(id)).state, "queued");
  assert.deepEqual(
    readdirSync(path.join(f.root, "tmp"), {
      recursive: true,
      withFileTypes: true,
    }).filter((e) => e.isFile()),
    [],
  );
  await f.s.close();
});

test("a run from another account does not hold this account's notebook", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.s.ledger.update(id, { remote: `another/${wan.slug}` });
  f.clock.pass(10 * 60 * 1000);
  await f.restart();
  f.k.world.state = "COMPLETE";
  await f.start("From this account.");
  assert.equal(f.k.world.pushes.length, 2);
  await f.s.close();
});

test("past its limit, stopping following does not say it is still running", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  f.clock.pass(PAST_LIMIT_MS);
  assert.equal((await f.s.service.cancel(id)).remoteOutcome, "unknown");
  await f.s.close();
});

test("the CLI's words are all kept, not only those on stderr", () => {
  assert.equal(
    cliWords("A version warning.\n", "Authentication required.\n"),
    "A version warning. Authentication required.",
  );
  assert.equal(cliWords("", ""), "");
});

// As real Kaggle answered, with the weekly quota used up.
test("Kaggle's real answer on quota reaches the person, past the CLI's advice", async () => {
  const f = await fixture();
  f.k.world.pushStdout =
    "Warning: Looks like you're using an outdated `kaggle` version (installed: 2.2.4), please consider upgrading to the latest version (2.2.5)\r\nKernel push error: Maximum weekly GPU quota of 30.00 hours reached.\r\n";
  await assert.rejects(
    f.start(),
    /did not take the run: Kernel push error: Maximum weekly GPU quota/,
  );
  assert.deepEqual(f.s.service.list(f.project.id), []);
  assert.equal(
    f.k.world.pushes.length,
    1,
    "what the stand-in records of a try",
  );
  await f.s.close();
});

test("a kill during a send leaves no script behind, once the run is found again", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start("A SECRET kite.");
  const folder = path.join(f.root, "tmp", `yamakan-kaggle-work-${id}`);
  for (const name of ["push", "pulled"]) {
    mkdirSync(path.join(folder, name), { recursive: true });
    writeFileSync(path.join(folder, name, "run.py"), "A SECRET kite.");
  }
  await f.restart();
  f.k.world.state = "COMPLETE";
  assert.equal((await f.s.service.status(id)).state, "succeeded");
  const left = readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
  assert.deepEqual(left, [wan.output]);
  await f.s.close();
});

test("a name differing only by case is the same account", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  assert.equal(f.s.ledger.read(id)!.remote, `someone/${wan.slug}`);
  f.s.ledger.update(id, { remote: `SomeOne/${wan.slug}` });
  await f.restart();
  assert.equal((await f.s.service.status(id)).state, "running");
  await f.s.close();
});

test("Kaggle's own refusal printed with a clean exit is a refusal", async () => {
  const f = await fixture();
  f.k.world.pushStdout = "Kernel push error: this notebook cannot be saved";
  await assert.rejects(f.start(), /did not take the run/);
  await f.s.close();
});

test("the tool's words stay beside an uncertain send", async () => {
  const f = await fixture();
  f.k.world.pushMode = "lost-before-landing";
  f.k.world.pushError = "Server said no such thing";
  const { generationId: id } = await f.start();
  assert.match(f.s.ledger.read(id)!.diagnostic!, /Server said no such thing/);
  await f.s.close();
});

test("a second start does not ask about a run still being sent, or send", async () => {
  const f = await fixture();
  let release = () => {};
  let reached = () => {};
  const atPush = new Promise<void>((done) => {
    reached = done;
  });
  f.k.world.beforePush = () =>
    new Promise<void>((done) => {
      reached();
      release = done;
    });
  const first = f.start("The first.");
  await atPush;
  let asked = 0;
  f.k.world.beforeStatus = async () => {
    asked++;
  };
  await assert.rejects(f.start("The second."), BLOCKED);
  assert.equal(asked, 0);
  release();
  await first;
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a stop pressed while a status is being asked stands", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  let release = () => {};
  f.k.world.beforeStatus = () =>
    new Promise<void>((done) => {
      release = done;
    });
  const asked = f.s.service.status(id);
  await new Promise((r) => setTimeout(r, 20));
  await f.s.service.cancel(id);
  release();
  f.k.world.beforeStatus = null;
  assert.equal((await asked).state, f.s.ledger.read(id)!.state);
  assert.match(row(f, id).error!, /not told to stop/);
  assert.equal(row(f, id).state, "cancelled");
  await f.s.close();
});

test("a privacy warning outlasts a restart, and a stop", async () => {
  const f = await fixture();
  f.k.world.privateAnswer = false;
  const { generationId: id } = await f.start();
  await f.restart();
  assert.match((await f.s.service.status(id)).diagnostic!, /private/);
  assert.match(f.s.ledger.read(id)!.diagnostic!, /private/);
  await f.s.service.cancel(id);
  assert.match(row(f, id).error!, /private/);
  assert.match(row(f, id).error!, /not told to stop/);
  await f.s.close();
});

test("a run sent from another account is not asked about from this one", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  assert.equal(f.s.ledger.read(id)!.remote, `someone/${wan.slug}`);
  f.s.ledger.update(id, { remote: `another/${wan.slug}` });
  await f.restart();
  const calls = f.k.world.calls;
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "unknown");
  assert.match(answer.diagnostic!, /another Kaggle account/);
  assert.equal(f.k.world.calls, calls);
  assert.equal((await f.s.service.cancel(id)).remoteOutcome, "unknown");
  await f.s.close();
});

test("an uncertain send does not take on another run's stop", async () => {
  const f = await fixture();
  f.k.world.pushMode = "lost-before-landing";
  const earlier = f.k.world.pushes;
  earlier.push({ runId: "older", prompt: "Older." });
  f.k.world.state = "COMPLETE";
  const { generationId: id } = await f.start();
  f.k.world.state = "CANCEL_ACKNOWLEDGED";
  f.clock.pass(10 * 60 * 1000);
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "unknown");
  assert.match(answer.diagnostic!, /may or may not/);
  await f.s.close();
});

test("dismissing a held run leaves it held", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  const home = path.join(f.root, "home");
  const backup = await backupWorkspace(f.s.store, home);
  await f.s.close();
  const copy = path.join(f.root, "copy");
  await restoreWorkspace(path.join(home, "backups", backup.backupId), copy);
  const c = await openAt(copy, f.root, f.k, f.clock.now);
  try {
    const held = () =>
      c.store.read(
        (db) =>
          db
            .prepare("SELECT state, error FROM jobs WHERE job_id = ?")
            .get(id) as {
            state: string;
            error: string;
          },
      );
    const error = held().error;
    c.service.dismiss(id);
    assert.equal(held().state, "reconciliationRequired");
    assert.equal(held().error, error);
    assert.deepEqual(c.service.list(f.project.id), []);
  } finally {
    await c.close();
  }
});

test("no folder is left with a prompt in it", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start("A SECRET kite.");
  f.k.world.state = "COMPLETE";
  await f.s.service.status(id);
  const everything = readdirSync(path.join(f.root, "tmp"), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath, e.name));
  assert.equal(everything.length, 1, everything.join());
  assert.ok(everything[0].endsWith(wan.output));
  await f.s.close();
});
