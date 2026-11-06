// Text-to-video on the person's own free Kaggle GPU, through the Kaggle CLI they
// already set up. A person starts each run; only its prompt and seed leave this
// machine, for their private notebook. Yamakan never reads their token, and no
// weights come here. A push replaces what "latest" means on Kaggle, so a result
// counts only if its receipt names this run.
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CommandError } from "../command/errors.ts";
import {
  ENGINE_CONTRACT_V2,
  ENGINE_V2_LIMITS,
  diagnostic,
  type Artifact,
  type EngineAdapterV2,
  type ExecutionStatus,
} from "./contract-v2.ts";
import type { GenerationRecipe } from "./generation.ts";

export type KaggleRecipe = {
  id: string;
  name: string;
  model: string;
  revision: string;
  licence: string;
  // Fixed by its script, and what has really been run.
  width: number;
  height: number;
  frames: number;
  fps: number;
  steps: number;
  // Kaggle stops a run after this long, whatever Yamakan does.
  timeoutSeconds: number;
  // Loading and generating, from a real run.
  expectedSeconds: number;
  folder: string;
  slug: string;
  output: string;
};

export const KAGGLE_RECIPES: readonly KaggleRecipe[] = Object.freeze([
  {
    id: "kaggle-wan22-ti2v-5b",
    name: "Wan2.2-TI2V-5B",
    model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    revision: "b8fff7315c768468a5333511427288870b2e9635",
    licence: "Apache-2.0",
    width: 704,
    height: 480,
    frames: 41,
    fps: 24,
    steps: 30,
    timeoutSeconds: 3600,
    expectedSeconds: 639,
    folder: "wan22-ti2v-5b",
    slug: "yamakan-run-wan22-ti2v-5b",
    output: "wan-video.mp4",
  },
  {
    id: "kaggle-cogvideox-2b",
    name: "CogVideoX-2b",
    model: "zai-org/CogVideoX-2b",
    revision: "1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01",
    licence: "Apache-2.0",
    width: 720,
    height: 480,
    frames: 49,
    fps: 8,
    steps: 50,
    timeoutSeconds: 3600,
    expectedSeconds: 1125,
    folder: "cogvideox-2b",
    slug: "yamakan-run-cogvideox-2b",
    output: "first-video.mp4",
  },
]);

const SCRIPTS = fileURLToPath(
  new URL("../../scripts/kaggle/", import.meta.url),
);
const scriptOf = (r: KaggleRecipe) => path.join(SCRIPTS, r.folder, "run.py");
// The one line of a script that a run's prompt and seed replace.
const BRIEF_LINE = "BRIEF = {}  # yamakan:brief";

const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

export function kaggleRecipes(): GenerationRecipe[] {
  return KAGGLE_RECIPES.filter((r) => existsSync(scriptOf(r))).map((r) => ({
    id: r.id,
    hash: sha256(readFileSync(scriptOf(r))),
    operation: "textToVideo" as const,
    modelManifestHash: sha256(`${r.model}@${r.revision}`),
  }));
}

// The script as this run sends it. The brief travels as base64 of JSON, so nothing
// in a prompt can become Python.
export function scriptWithBrief(
  script: string,
  brief: { prompt: string; seed: number; runId: string },
) {
  const lines = script.split("\n");
  const at = lines.findIndex((l) => l.trimEnd() === BRIEF_LINE);
  if (at < 0) throw new Error("This script takes no brief.");
  const encoded = Buffer.from(JSON.stringify(brief), "utf8").toString("base64");
  lines[at] =
    `BRIEF = __import__("json").loads(__import__("base64").b64decode("${encoded}"))`;
  return lines.join("\n");
}

export type KaggleCli = (
  args: string[],
  timeoutMs: number,
) => Promise<{ stdout: string }>;

export function kaggleCli(file: string): KaggleCli {
  return (args, timeout) =>
    new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        {
          timeout,
          windowsHide: true,
          maxBuffer: 4 * 1024 * 1024,
          env: { ...process.env, PYTHONUTF8: "1" },
        },
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve({ stdout });
        },
      );
    });
}

const REMOTE_STATES = /KernelWorkerStatus\.([A-Z_]+)/;
// How long a finished earlier run may still answer for this one, just after a push.
const PUSH_SETTLE_MS = 3 * 60 * 1000;

type Run = {
  recipe: KaggleRecipe;
  runId: string;
  startedAt: number;
  folder: string;
  ended?: ExecutionStatus["state"];
  endedWith?: string;
  video?: { file: string; artifact: Artifact };
};

export function notebookUrl(username: string, recipe: KaggleRecipe) {
  return `https://www.kaggle.com/code/${username}/${recipe.slug}`;
}

export function createKaggleEngine(options: {
  cli: KaggleCli;
  username: string;
  // Tests only.
  scriptFor?: (recipe: KaggleRecipe) => Promise<string>;
  download?: (recipe: KaggleRecipe, folder: string) => Promise<void>;
  now?: () => number;
}): EngineAdapterV2 {
  const { cli, username } = options;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(username))
    throw new Error("That is not a Kaggle username.");
  const now = options.now ?? Date.now;
  const runs = new Map<string, Run>();
  const scriptFor =
    options.scriptFor ?? ((r: KaggleRecipe) => readFile(scriptOf(r), "utf8"));
  const remote = (r: KaggleRecipe) => `${username}/${r.slug}`;
  const download =
    options.download ??
    (async (r: KaggleRecipe, folder: string) => {
      await cli(["kernels", "output", remote(r), "-p", folder], 5 * 60 * 1000);
    });
  const remoteState = async (r: KaggleRecipe) => {
    const { stdout } = await cli(["kernels", "status", remote(r)], 90_000);
    const state = REMOTE_STATES.exec(stdout)?.[1];
    if (!state) throw new Error("Kaggle gave no state for this run.");
    return state;
  };
  const end = (
    run: Run,
    state: ExecutionStatus["state"],
    message?: string,
  ): ExecutionStatus => {
    run.ended = state;
    run.endedWith = message;
    return status(run);
  };
  const status = (run: Run): ExecutionStatus => ({
    executionRef: run.runId,
    state: run.ended ?? "unknown",
    ...(run.endedWith ? { diagnostic: diagnostic(run.endedWith) } : {}),
  });

  // What the finished run left. Only a receipt naming this run counts.
  async function collect(run: Run) {
    const folder = path.join(run.folder, "output");
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });
    await download(run.recipe, folder);
    const receipt = JSON.parse(
      await readFile(path.join(folder, "receipt.json"), "utf8"),
    );
    return { folder, receipt };
  }

  async function finish(run: Run): Promise<ExecutionStatus | null> {
    const { folder, receipt } = await collect(run);
    // An earlier run's answer, before this one's has replaced it.
    if (receipt.runId !== run.runId) {
      if (now() - run.startedAt < PUSH_SETTLE_MS) return null;
      return end(run, "failed", "Kaggle's latest run is not this one.");
    }
    if (receipt.stage !== "done" || receipt.verified !== true)
      return end(
        run,
        "failed",
        typeof receipt.error === "string"
          ? receipt.error
          : "The run ended without a video that passed its own checks.",
      );
    const file = path.join(folder, run.recipe.output);
    const bytes = await readFile(file);
    const hash = sha256(bytes);
    if (hash !== receipt.sha256)
      return end(run, "failed", "The video is not the one its receipt names.");
    run.video = {
      file,
      artifact: {
        handle: run.recipe.output.toLowerCase(),
        mediaType: "video/mp4",
        byteLength: (await stat(file)).size,
        sha256: hash,
      },
    };
    return end(run, "succeeded");
  }

  const check = async (run: Run): Promise<ExecutionStatus> => {
    if (run.ended) return status(run);
    try {
      const state = await remoteState(run.recipe);
      if (state === "QUEUED" || state === "NEW_SCRIPT")
        return { executionRef: run.runId, state: "queued" };
      if (state === "RUNNING")
        return { executionRef: run.runId, state: "running" };
      if (state === "COMPLETE") {
        return (
          (await finish(run)) ?? { executionRef: run.runId, state: "queued" }
        );
      }
      if (state === "ERROR") {
        const left = await collect(run).catch(() => null);
        if (left && left.receipt.runId !== run.runId) {
          if (now() - run.startedAt < PUSH_SETTLE_MS)
            return { executionRef: run.runId, state: "queued" };
          return end(run, "failed", "Kaggle's latest run is not this one.");
        }
        return end(
          run,
          "failed",
          typeof left?.receipt.error === "string"
            ? left.receipt.error
            : "The run failed on Kaggle.",
        );
      }
      if (state === "CANCEL_REQUESTED" || state === "CANCEL_ACKNOWLEDGED")
        return end(run, "cancelled", "The run was stopped on Kaggle.");
      return {
        executionRef: run.runId,
        state: "unknown",
        diagnostic: diagnostic(`Kaggle says ${state}.`),
      };
    } catch (e) {
      // Being unable to ask is not the run failing: it may well still be going.
      return {
        executionRef: run.runId,
        state: "unknown",
        diagnostic: diagnostic(
          `Could not get an answer from Kaggle: ${(e as Error).message}`,
        ),
      };
    }
  };

  const runOf = (ref: string) => {
    const run = runs.get(ref);
    if (!run)
      throw new CommandError("NOT_FOUND", "That run is not known here.");
    return run;
  };

  return {
    contract: ENGINE_CONTRACT_V2,
    capabilities: () => [],
    async submit(request) {
      const recipe = KAGGLE_RECIPES.find((r) => r.id === request.recipeId);
      if (!recipe || request.operation !== "textToVideo")
        return { refused: "ENGINE_DISABLED" as const };
      if (request.inputs.length > 0)
        return { refused: "INPUT_UNSUPPORTED" as const };
      const out = request.output;
      if (
        out.kind !== "video" ||
        out.width !== recipe.width ||
        out.height !== recipe.height ||
        out.audio
      )
        return { refused: "OUTPUT_UNSUPPORTED" as const };
      if (!request.prompt)
        throw new CommandError("VALIDATION", "A run needs a prompt.");
      // Its notebook has one latest run: starting another hides this one's result.
      const going = await remoteState(recipe).catch(() => null);
      if (going === "RUNNING" || going === "QUEUED")
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          "This model's notebook is still running. Wait for it to finish, or stop it on Kaggle.",
        );
      const runId = randomUUID();
      const folder = await mkdtemp(path.join(tmpdir(), "yamakan-kaggle-"));
      try {
        await writeFile(
          path.join(folder, "run.py"),
          scriptWithBrief(await scriptFor(recipe), {
            prompt: request.prompt,
            seed: request.seed ?? 42,
            runId,
          }),
        );
        await writeFile(
          path.join(folder, "kernel-metadata.json"),
          JSON.stringify({
            id: remote(recipe),
            title: recipe.slug,
            code_file: "run.py",
            language: "python",
            kernel_type: "script",
            is_private: true,
            enable_gpu: true,
            enable_internet: true,
            enable_tpu: false,
            dataset_sources: [],
            competition_sources: [],
            kernel_sources: [],
          }),
        );
        const { stdout } = await cli(
          [
            "kernels",
            "push",
            "-p",
            folder,
            "-t",
            String(recipe.timeoutSeconds),
          ],
          3 * 60 * 1000,
        );
        if (!/successfully pushed/i.test(stdout))
          throw new Error(stdout.slice(0, ENGINE_V2_LIMITS.diagnosticChars));
      } catch (e) {
        await rm(folder, { recursive: true, force: true }).catch(() => {});
        if (e instanceof CommandError) throw e;
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          diagnostic(`Kaggle did not take the run: ${(e as Error).message}`) ??
            "Kaggle did not take the run.",
        );
      }
      runs.set(runId, { recipe, runId, startedAt: now(), folder });
      return { executionRef: runId };
    },
    status: (ref) => check(runOf(ref)),
    reconcile: (ref) => check(runOf(ref)),
    // Kaggle's public interface offers no way to stop a run. This stops following it,
    // and says so: it goes on until it ends or reaches its time limit.
    async requestCancel(ref) {
      runOf(ref);
      return {
        requested: true,
        localProcessExited: true,
        remoteAcknowledged: false,
        remoteOutcome: "continuing" as const,
        billingOutcome: "notApplicable" as const,
      };
    },
    async enumerateArtifacts(ref) {
      const { video } = runOf(ref);
      return video ? [video.artifact] : [];
    },
    async *readArtifact(ref, handle) {
      const { video } = runOf(ref);
      if (!video || video.artifact.handle !== handle)
        throw new CommandError("NOT_FOUND", "That output is not known here.");
      for await (const chunk of createReadStream(video.file, {
        highWaterMark: ENGINE_V2_LIMITS.chunkBytes,
      }))
        yield chunk as Uint8Array;
    },
  };
}
