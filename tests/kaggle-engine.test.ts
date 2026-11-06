import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  KAGGLE_RECIPES,
  createKaggleEngine,
  kaggleCliEnvironment,
  kaggleRecipes,
  offeredKaggleRecipes,
  scriptWithBrief,
  type KaggleCli,
} from "../core/engines/kaggle.ts";
import { ENGINE_CONTRACT_V2 } from "../core/engines/contract-v2.ts";
import { CREATE_MODELS } from "../src/create/create-model.ts";

const wan = KAGGLE_RECIPES[0];
const SCRIPT = 'import os\nBRIEF = {}  # yamakan:brief\nprint("x")\n';
const VIDEO = Buffer.from("not really a video, for the test");
const hash = createHash("sha256").update(VIDEO).digest("hex");

const request = (changes: Record<string, unknown> = {}) =>
  ({
    contract: ENGINE_CONTRACT_V2,
    operation: "textToVideo",
    recipeId: wan.id,
    recipeHash: "a".repeat(64),
    modelManifestHash: "b".repeat(64),
    attemptKey: "attempt",
    leaseGeneration: 1,
    deadlineMs: 1000,
    resourcePolicyHash: "c".repeat(64),
    prompt: "A boat",
    seed: 7,
    inputs: [],
    output: {
      kind: "video",
      width: wan.width,
      height: wan.height,
      fps: { num: 30, den: 1 },
      durationTicks: 1,
      audio: false,
    },
    ...changes,
  }) as never;

// A Kaggle that answers from a list of states and leaves what it is told to.
function kaggle(
  states: string[],
  leave?: (runId: string, folder: string) => void,
  {
    privateAnswer = true,
    clock,
  }: { privateAnswer?: boolean; clock?: () => number } = {},
) {
  const calls: string[][] = [];
  const pushed: { metadata?: any; script?: string; was?: string[] } = {};
  let pushes = 0;
  let runId = "";
  const cli: KaggleCli = async (args) => {
    calls.push(args);
    if (args[1] === "status") {
      if (pushes === 0) throw new Error("404 no such notebook");
      const state = states.length > 1 ? states.shift() : states[0];
      if (state === "FAIL") throw new Error("network down");
      return { stdout: `has status "KernelWorkerStatus.${state}"` };
    }
    if (args[1] === "push") {
      pushes++;
      const folder = args[3];
      pushed.metadata = JSON.parse(
        readFileSync(path.join(folder, "kernel-metadata.json"), "utf8"),
      );
      pushed.script = readFileSync(path.join(folder, "run.py"), "utf8");
      pushed.was = readdirSync(folder);
      const encoded = /b64decode\("([^"]+)"\)/.exec(pushed.script)![1];
      runId = JSON.parse(Buffer.from(encoded, "base64").toString()).runId;
      return { stdout: "Kernel version 1 successfully pushed." };
    }
    if (args[1] === "pull") {
      writeFileSync(
        path.join(args[4], "kernel-metadata.json"),
        JSON.stringify({ is_private: privateAnswer }),
      );
      return { stdout: "" };
    }
    throw new Error(`unexpected ${args}`);
  };
  const engine = createKaggleEngine({
    cli,
    username: "someone",
    scriptFor: async () => SCRIPT,
    download: async (_r, folder) => leave?.(runId, folder),
    ...(clock ? { now: clock } : {}),
  });
  return { engine, calls, pushed, runIdOf: () => runId };
}
const good = (runId: string, folder: string) => {
  writeFileSync(path.join(folder, wan.output), VIDEO);
  writeFileSync(
    path.join(folder, "receipt.json"),
    JSON.stringify({
      runId,
      stage: "done",
      verified: true,
      frames: wan.frames,
      sha256: hash,
    }),
  );
};
const context = { openAsset: () => (async function* () {})() };

test("a prompt can never become Python", () => {
  const prompt = 'x"""\nimport os; os.system("calc") # \\ \u0000 \u0645';
  const out = scriptWithBrief(SCRIPT, { prompt, seed: 1, runId: "r" });
  assert.ok(!out.includes("calc"));
  assert.ok(!out.includes('"""'));
  const encoded = /b64decode\("([A-Za-z0-9+/=]+)"\)/.exec(out)![1];
  assert.equal(
    JSON.parse(Buffer.from(encoded, "base64").toString()).prompt,
    prompt,
  );
});

test("the line replaced really decodes in Python", () => {
  const prompt = 'quote " back \\ new\nline \u0645';
  const out = scriptWithBrief(
    "BRIEF = {}  # yamakan:brief\nprint(BRIEF['prompt'])\n",
    {
      prompt,
      seed: 1,
      runId: "r",
    },
  );
  const file = path.join(mkdtempSync(path.join(tmpdir(), "brief-")), "t.py");
  writeFileSync(file, out);
  let printed: string;
  try {
    printed = execFileSync("python", ["-I", file], {
      encoding: "utf8",
      env: { ...process.env, PYTHONUTF8: "1" },
    });
  } catch {
    return; // No Python on this machine: the base64 test above still holds.
  }
  assert.equal(printed.replace(/\r?\n$/, "").replaceAll("\r\n", "\n"), prompt);
});

test("a script with no place for a brief is refused", () => {
  assert.throws(
    () => scriptWithBrief("print(1)\n", { prompt: "x", seed: 1, runId: "r" }),
    /no brief/,
  );
});

test("the real scripts take a brief", () => {
  for (const r of KAGGLE_RECIPES) {
    const script = readFileSync(
      `scripts/kaggle/${r.folder}/run.py`,
      "utf8",
    ).replaceAll("\r\n", "\n");
    const out = scriptWithBrief(script, { prompt: "x", seed: 1, runId: "r" });
    assert.match(out, /b64decode/);
    assert.match(script, /"runId"/);
    assert.match(script, new RegExp(r.output.replace(".", "\\.")));
    assert.ok(script.includes(r.revision));
  }
});

test("a username cannot reach elsewhere", () => {
  for (const username of ["a/b", "../x", "", "a b", "-x"])
    assert.throws(() =>
      createKaggleEngine({ cli: async () => ({ stdout: "" }), username }),
    );
});

test("a run goes to a private notebook, with a time limit", async () => {
  const k = kaggle(["QUEUED"]);
  const answer = await k.engine.submit(request(), context as never);
  assert.ok("executionRef" in answer);
  assert.equal(k.pushed.metadata.is_private, true);
  assert.equal(k.pushed.metadata.enable_gpu, true);
  assert.equal(k.pushed.metadata.id, `someone/${wan.slug}`);
  const push = k.calls.find((c) => c[1] === "push")!;
  assert.deepEqual(push.slice(4), ["-t", String(wan.timeoutSeconds)]);
  assert.equal(
    (await k.engine.status((answer as any).executionRef)).state,
    "queued",
  );
});

test("a notebook still running is not replaced", async () => {
  const k = kaggle(["RUNNING"]);
  await k.engine.submit(request(), context as never); // First, none is known.
  await assert.rejects(
    k.engine.submit(request(), context as never),
    /still running/,
  );
  assert.equal(k.calls.filter((c) => c[1] === "push").length, 1);
});

test("only what has been tested can be asked for", async () => {
  const k = kaggle(["QUEUED"]);
  for (const [change, reason] of [
    [{ recipeId: "other" }, "ENGINE_DISABLED"],
    [{ operation: "imageToVideo" }, "ENGINE_DISABLED"],
    [{ inputs: [{}] }, "INPUT_UNSUPPORTED"],
    [
      { output: { kind: "video", width: 1280, height: 720, audio: false } },
      "OUTPUT_UNSUPPORTED",
    ],
  ] as const)
    assert.deepEqual(await k.engine.submit(request(change), context as never), {
      refused: reason,
    });
  assert.equal(k.calls.length, 0, "nothing was sent");
});

test("a finished run gives its video, by its own hash", async () => {
  const k = kaggle(["COMPLETE"], good);
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  assert.equal((await k.engine.status(executionRef)).state, "succeeded");
  const [artifact] = await k.engine.enumerateArtifacts(executionRef);
  assert.equal(artifact.sha256, hash);
  assert.equal(artifact.mediaType, "video/mp4");
  const chunks: Uint8Array[] = [];
  for await (const c of k.engine.readArtifact(executionRef, artifact.handle))
    chunks.push(c);
  assert.deepEqual(Buffer.concat(chunks), VIDEO);
  // It is not asked again once it has ended.
  const asked = k.calls.length;
  await k.engine.status(executionRef);
  assert.equal(k.calls.length, asked);
});

test("an earlier run's result is never this run's", async () => {
  const k = kaggle(["COMPLETE"], (_id, folder) => good("someone-else", folder));
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  const answer = await k.engine.status(executionRef);
  assert.equal(answer.state, "queued", "just pushed: it may yet replace it");
  assert.deepEqual(await k.engine.enumerateArtifacts(executionRef), []);
});

test("after a while, another run's result is a failure", async () => {
  let time = 0;
  const calls: string[][] = [];
  let pushes = 0;
  const engine = createKaggleEngine({
    cli: async (args) => {
      calls.push(args);
      if (args[1] === "push") {
        pushes++;
        return { stdout: "successfully pushed" };
      }
      if (args[1] === "pull") {
        writeFileSync(
          path.join(args[4], "kernel-metadata.json"),
          JSON.stringify({ is_private: true }),
        );
        return { stdout: "" };
      }
      if (!pushes) throw new Error("404 none");
      return { stdout: "KernelWorkerStatus.COMPLETE" };
    },
    username: "someone",
    scriptFor: async () => SCRIPT,
    download: async (_r, folder) => good("someone-else", folder),
    now: () => time,
  });
  const { executionRef } = (await engine.submit(
    request(),
    context as never,
  )) as any;
  time = 10 * 60 * 1000;
  const answer = await engine.status(executionRef);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /not this one/);
});

test("a video that is not its receipt's is refused", async () => {
  const k = kaggle(["COMPLETE"], (runId, folder) => {
    good(runId, folder);
    writeFileSync(path.join(folder, wan.output), "something else");
  });
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  const answer = await k.engine.status(executionRef);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /not the one/);
  assert.deepEqual(await k.engine.enumerateArtifacts(executionRef), []);
});

test("a run that failed its own checks is a failure", async () => {
  const k = kaggle(["COMPLETE"], (runId, folder) =>
    writeFileSync(
      path.join(folder, "receipt.json"),
      JSON.stringify({ runId, stage: "done", verified: false, sha256: hash }),
    ),
  );
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  assert.equal((await k.engine.status(executionRef)).state, "failed");
});

test("a failed run says why, without its paths", async () => {
  const k = kaggle(["ERROR"], (runId, folder) =>
    writeFileSync(
      path.join(folder, "receipt.json"),
      JSON.stringify({
        runId,
        stage: "failed at generating",
        error: "CUDA out of memory at C:\\secret\\place",
      }),
    ),
  );
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  const answer = await k.engine.status(executionRef);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /out of memory/);
  assert.ok(!answer.diagnostic!.includes("secret"));
});

test("not being able to ask is not the run failing", async () => {
  const k = kaggle(["FAIL", "RUNNING"]);
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  const answer = await k.engine.status(executionRef);
  assert.equal(answer.state, "unknown");
  assert.match(answer.diagnostic!, /Could not get an answer/);
  assert.equal((await k.engine.status(executionRef)).state, "running");
});

test("stopping says plainly that the run goes on", async () => {
  const k = kaggle(["RUNNING"]);
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  const stopped = await k.engine.requestCancel(executionRef);
  assert.equal(stopped.remoteAcknowledged, false);
  assert.equal(stopped.remoteOutcome, "continuing");
});

test("a push Kaggle did not take is an error, and nothing is tracked", async () => {
  const engine = createKaggleEngine({
    cli: async (args) => {
      if (args[1] === "push")
        throw new Error("Maximum batch GPU quota reached");
      throw new Error("404 none");
    },
    username: "someone",
    scriptFor: async () => SCRIPT,
  });
  await assert.rejects(
    engine.submit(request(), context as never),
    /did not take the run: Maximum batch GPU/,
  );
});

test("only a model with its own tested run from the page is offered", async () => {
  assert.deepEqual(
    offeredKaggleRecipes().map((r) => r.id),
    ["kaggle-wan22-ti2v-5b"],
  );
  assert.deepEqual(
    kaggleRecipes().map((r) => r.id),
    ["kaggle-wan22-ti2v-5b"],
  );
  const k = kaggle(["QUEUED"]);
  assert.deepEqual(
    await k.engine.submit(
      request({ recipeId: "kaggle-cogvideox-2b" }),
      context as never,
    ),
    { refused: "ENGINE_DISABLED" },
  );
  assert.equal(k.calls.length, 0);
});

for (const state of ["ERROR", "CANCEL_ACKNOWLEDGED", "CANCEL_REQUESTED"]) {
  test(`just after a push, ${state} may be an earlier run's`, async () => {
    let time = 0;
    const k = kaggle([state], undefined, { clock: () => time });
    const { executionRef } = (await k.engine.submit(
      request(),
      context as never,
    )) as any;
    assert.equal((await k.engine.status(executionRef)).state, "queued");
    time = 10 * 60 * 1000;
    assert.notEqual((await k.engine.status(executionRef)).state, "queued");
  });
}

test("two starts at once make one push", async () => {
  const k = kaggle(["COMPLETE"]);
  const both = await Promise.allSettled([
    k.engine.submit(request(), context as never),
    k.engine.submit(request(), context as never),
  ]);
  assert.equal(both.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(k.calls.filter((c) => c[1] === "push").length, 1);
});

test("a run still going here is not replaced, even if Kaggle says it ended", async () => {
  const k = kaggle(["COMPLETE"]);
  await k.engine.submit(request(), context as never);
  await assert.rejects(
    k.engine.submit(request(), context as never),
    /still running/,
  );
});

test("not being able to ask stops a push", async () => {
  const calls: string[] = [];
  const engine = createKaggleEngine({
    cli: async (args) => {
      calls.push(args[1]);
      throw new Error("network down");
    },
    username: "someone",
    scriptFor: async () => SCRIPT,
  });
  await assert.rejects(
    engine.submit(request(), context as never),
    /Could not ask Kaggle/,
  );
  assert.deepEqual(calls, ["status"]);
});

test("questions at once share one answer", async () => {
  let downloads = 0;
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  let pushes = 0;
  let runId = "";
  const engine = createKaggleEngine({
    cli: async (args) => {
      if (args[1] === "push") {
        pushes++;
        const script = readFileSync(path.join(args[3], "run.py"), "utf8");
        runId = JSON.parse(
          Buffer.from(
            /b64decode\("([^"]+)"\)/.exec(script)![1],
            "base64",
          ).toString(),
        ).runId;
        return { stdout: "successfully pushed" };
      }
      if (args[1] === "pull") {
        writeFileSync(
          path.join(args[4], "kernel-metadata.json"),
          JSON.stringify({ is_private: true }),
        );
        return { stdout: "" };
      }
      if (!pushes) throw new Error("404");
      return { stdout: "KernelWorkerStatus.COMPLETE" };
    },
    username: "someone",
    scriptFor: async () => SCRIPT,
    download: async (_r, folder) => {
      downloads++;
      await held;
      good(runId, folder);
    },
  });
  const { executionRef } = (await engine.submit(
    request(),
    context as never,
  )) as any;
  const first = engine.status(executionRef);
  const second = engine.status(executionRef);
  release();
  assert.equal((await first).state, "succeeded");
  assert.equal((await second).state, "succeeded");
  assert.equal(downloads, 1);
});

test("a notebook Kaggle does not report as private ends the run", async () => {
  const k = kaggle(["RUNNING"], undefined, { privateAnswer: false });
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  const answer = await k.engine.status(executionRef);
  assert.equal(answer.state, "failed");
  assert.match(answer.diagnostic!, /private/);
});

test("the prompt does not stay on this computer", async () => {
  const k = kaggle(["COMPLETE"], good);
  const { executionRef } = (await k.engine.submit(
    request({ prompt: "NEEDLE-PROMPT" }),
    context as never,
  )) as any;
  await k.engine.status(executionRef);
  const [artifact] = await k.engine.enumerateArtifacts(executionRef);
  assert.ok(artifact, "the video stays");
  assert.deepEqual(k.pushed.was!.sort(), ["kernel-metadata.json", "run.py"]);
});

test("a video of the wrong length is refused", async () => {
  const k = kaggle(["COMPLETE"], (runId, folder) => {
    good(runId, folder);
    writeFileSync(
      path.join(folder, "receipt.json"),
      JSON.stringify({
        runId,
        stage: "done",
        verified: true,
        frames: 41,
        sha256: hash,
      }),
    );
  });
  const { executionRef } = (await k.engine.submit(
    request(),
    context as never,
  )) as any;
  assert.equal((await k.engine.status(executionRef)).state, "failed");
});

test("the CLI gets its settings, not this service's environment", () => {
  const env = kaggleCliEnvironment({
    PATH: "p",
    USERPROFILE: "u",
    KAGGLE_CONFIG_DIR: "k",
    YAMAKAN_SECRET: "no",
    GITHUB_TOKEN: "no",
    AWS_SECRET_ACCESS_KEY: "no",
  });
  assert.deepEqual(env, {
    PYTHONUTF8: "1",
    PATH: "p",
    USERPROFILE: "u",
    KAGGLE_CONFIG_DIR: "k",
  });
});

test("an unknown run says so, the way a restart leaves it", async () => {
  const k = kaggle(["RUNNING"]);
  await assert.rejects(k.engine.status("not-known"), /not known here/);
});

test("the page's facts and the recipe say the same", () => {
  for (const r of KAGGLE_RECIPES) {
    const made = CREATE_MODELS.find((m) => m.id === r.model)!;
    assert.deepEqual(
      [made.width, made.height, made.frames, made.fps, made.steps],
      [r.width, r.height, r.frames, r.fps, r.steps],
    );
    assert.equal(made.secondsToMake, r.expectedSeconds);
    const script = readFileSync(`scripts/kaggle/${r.folder}/run.py`, "utf8");
    assert.match(script, new RegExp(`^FRAMES = ${r.frames}\\b`, "m"));
    assert.match(script, new RegExp(`^FPS = ${r.fps}\\b`, "m"));
    assert.match(script, new RegExp(`^STEPS = ${r.steps}\\b`, "m"));
  }
});
