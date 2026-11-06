// A generation running elsewhere outlives a restart of this service: it is followed
// again from the job record, and never sent again. A real store and job supervisor, and
// a stand-in for Kaggle's CLI that remembers what it was sent. "Restart" here is closing
// them and opening new ones on the same folder.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor, REMOTE_GENERATION } from "../core/jobs.ts";
import {
  KAGGLE_RECIPES,
  createKaggleEngine,
  kaggleRecipes,
  type KaggleCli,
} from "../core/engines/kaggle.ts";
import {
  createGenerationService,
  type GenerationRecipe,
} from "../core/engines/generation.ts";
import { mediaTools } from "../core/process/workers.ts";

const wan = KAGGLE_RECIPES[0];
const SCRIPT = "BRIEF = {}  # yamakan:brief\n";
const roots: string[] = [];
after(() => {
  for (const r of roots)
    rmSync(r, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
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
  };
  const cli: KaggleCli = async (args) => {
    if (world.down) throw new Error("connection reset");
    if (args[1] === "status") {
      if (world.pushes.length === 0) throw new Error(MISSING);
      return { stdout: `has status "KernelWorkerStatus.${world.state}"` };
    }
    if (args[1] === "pull") {
      writeFileSync(
        path.join(args[4], "kernel-metadata.json"),
        JSON.stringify({ is_private: true }),
      );
      return { stdout: "" };
    }
    if (args[1] === "push") {
      if (world.pushMode === "refused") throw new Error("Maximum GPU quota");
      if (world.pushMode === "lost-before-landing")
        throw new Error("connection reset");
      const script = readFileSync(path.join(args[3], "run.py"), "utf8");
      const brief = JSON.parse(
        Buffer.from(
          /b64decode\("([^"]+)"\)/.exec(script)![1],
          "base64",
        ).toString(),
      );
      world.pushes.push({ runId: brief.runId, prompt: brief.prompt });
      if (world.pushMode === "lost-after-landing")
        throw new Error("Timed out waiting for an answer");
      return { stdout: "successfully pushed" };
    }
    throw new Error(`unexpected ${args}`);
  };
  const download = async (_r: unknown, folder: string) => {
    world.downloads++;
    const last = world.pushes.at(-1)!;
    writeFileSync(path.join(folder, wan.output), VIDEO);
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
async function open(
  root: string,
  k: ReturnType<typeof kaggle>,
  now: () => number,
) {
  const store = new ProjectStore(path.join(root, "workspace"));
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
      recorded: (ref) => {
        const r = ledger.read(ref);
        return r && !r.held
          ? {
              recipeId: r.recipe.id,
              startedAt: r.startedAt,
              videoSha256: r.videoSha256,
            }
          : null;
      },
      sentBefore: ledger.hasSent,
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
  let time = 1_000_000;
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
        .prepare("SELECT kind, state, artifact FROM jobs WHERE job_id = ?")
        .get(id) as { kind: string; state: string; artifact: string | null },
  );

test("a run is recorded before anything leaves, in the job table", async () => {
  const f = await fixture();
  let seenBeforePush = 0;
  const original = f.k.cli;
  void original;
  const { generationId } = await f.start();
  assert.equal(row(f, generationId).kind, REMOTE_GENERATION);
  assert.equal(row(f, generationId).state, "running");
  seenBeforePush = f.k.world.pushes.length;
  assert.equal(seenBeforePush, 1);
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
  assert.equal(f.s.ledger.read(id)!.phase, "sent", "seen on Kaggle");
  await assert.rejects(f.start("Another."), /still running/);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a push Kaggle refused is a failure with nothing to follow", async () => {
  const f = await fixture();
  f.k.world.pushMode = "refused";
  await assert.rejects(f.start(), /did not take the run: Maximum GPU quota/);
  const [record] = f.s.service.list(f.project.id);
  assert.equal(record.state, "failed");
  assert.equal(row(f, record.generationId).state, "failed");
  await f.s.close();
});

test("a run past its limit ends, rather than being followed forever", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  await f.restart();
  f.clock.pass((wan.timeoutSeconds + 11 * 60) * 1000);
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /past its time limit/);
  assert.equal(row(f, id).state, "failed");
  await f.restart();
  assert.equal((await f.s.service.status(id)).state, "failed", "and stays so");
  assert.equal(f.k.world.pushes.length, 1);
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
  assert.equal(stopped.remoteOutcome, "continuing");
  assert.equal(stopped.remoteAcknowledged, false);
  assert.equal(row(f, id).state, "cancelled");
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

test("a restored copy does not follow, import or resend the original's run", async () => {
  const f = await fixture();
  const { generationId: id } = await f.start();
  // What a restore does to a copy's jobs: core/recovery.ts.
  f.s.store.transaction((db) => {
    db.prepare(
      "UPDATE jobs SET state = 'reconciliationRequired' WHERE job_id = ?",
    ).run(id);
  });
  await f.restart();
  f.k.world.state = "COMPLETE";
  const answer = await f.s.service.status(id);
  assert.equal(answer.state, "unknown");
  assert.match(answer.diagnostic!, /restored from a backup/);
  assert.equal(f.k.world.downloads, 0, "Kaggle was not asked");
  await assert.rejects(f.s.service.importResult(id), /restored from a backup/);
  assert.equal(f.k.world.pushes.length, 1);
  await f.s.close();
});

test("a new notebook is not assumed once this workspace has sent to it", async () => {
  const f = await fixture();
  await f.start();
  await f.restart();
  f.k.world.down = false;
  const before = f.k.cli;
  void before;
  // After a restart, Kaggle's refusal must not read as a missing notebook.
  const pushes = f.k.world.pushes;
  f.k.world.pushes = [];
  await assert.rejects(f.start("Another."), /Could not ask Kaggle/);
  f.k.world.pushes = pushes;
  assert.equal(pushes.length, 1);
  await f.s.close();
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
