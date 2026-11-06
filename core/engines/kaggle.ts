// Video on the person's own free Kaggle GPU, through the Kaggle CLI they already set
// up. A person starts each run; only its prompt and seed leave this machine, and a first
// frame where a qualified recipe takes one, for their private notebook, inside the run's
// brief, where it stays in the notebook's history. Yamakan never reads their token, and no
// weights come here. A push replaces what "latest" means on Kaggle, so a result
// counts only if its receipt names this run.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
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
  type AssetRef,
  type EngineAdapterV2,
  type EngineContextV2,
  type ExecutionStatus,
} from "./contract-v2.ts";
import type { GenerationLedger, GenerationRecipe } from "./generation.ts";
import { stripImage } from "./strip-image.ts";

export type KaggleRecipe = {
  id: string;
  name: string;
  model: string;
  revision: string;
  licence: string;
  // Offered from the page only once its own run from the page has been tested.
  offered: boolean;
  // Text to video unless it says otherwise.
  operation?: "imageToVideo";
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
    offered: true,
    width: 704,
    height: 480,
    frames: 81,
    fps: 24,
    steps: 30,
    timeoutSeconds: 3600,
    expectedSeconds: 1132,
    folder: "wan22-ti2v-5b",
    slug: "yamakan-run-wan22-ti2v-5b",
    output: "wan-video.mp4",
  },
  {
    // Its own script and notebook, so that nothing here touches the text script's bytes.
    // Its time is the text run's, for now: this has not been run for real.
    id: "kaggle-wan22-ti2v-5b-first-frame",
    name: "Wan2.2-TI2V-5B, from a first frame",
    model: "Wan-AI/Wan2.2-TI2V-5B-Diffusers",
    revision: "b8fff7315c768468a5333511427288870b2e9635",
    licence: "Apache-2.0",
    offered: false,
    operation: "imageToVideo",
    width: 704,
    height: 480,
    frames: 81,
    fps: 24,
    steps: 30,
    timeoutSeconds: 3600,
    expectedSeconds: 1132,
    folder: "wan22-ti2v-5b-first-frame",
    slug: "yamakan-run-wan22-ti2v-5b-first-frame",
    output: "wan-first-frame-video.mp4",
  },
  {
    id: "kaggle-cogvideox-2b",
    name: "CogVideoX-2b",
    model: "zai-org/CogVideoX-2b",
    revision: "1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01",
    licence: "Apache-2.0",
    offered: false,
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
const FOLDER_PREFIX = "yamakan-kaggle-work-";
const RECEIPT_BYTES = 1024 * 1024;
// A first frame travels inside the script. What Kaggle accepts in one is not known, so this
// is a guess kept small, for a real run to test.
export const FIRST_FRAME_BYTES = 4 * 1024 * 1024;

const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

export const offeredKaggleRecipes = () =>
  KAGGLE_RECIPES.filter((r) => r.offered && existsSync(scriptOf(r)));

export function kaggleRecipes(): GenerationRecipe[] {
  return offeredKaggleRecipes().map((r) => ({
    id: r.id,
    hash: sha256(readFileSync(scriptOf(r))),
    operation: r.operation ?? ("textToVideo" as const),
    modelManifestHash: sha256(`${r.model}@${r.revision}`),
  }));
}

// The script as this run sends it. The brief travels as base64 of JSON, so nothing
// in a prompt can become Python.
export function scriptWithBrief(
  script: string,
  brief: {
    prompt: string;
    seed: number;
    runId: string;
    firstFrame?: {
      data: string;
      mediaType: string;
      sha256: string;
      orientation: number;
    };
  },
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

// What the CLI needs to find itself and its own settings, and nothing else of this
// service's environment.
const CLI_ENVIRONMENT = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "XDG_CONFIG_HOME",
  "windir",
  // A network the CLI works on in the person's terminal must work here too.
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "REQUESTS_CA_BUNDLE",
  "CURL_CA_BUNDLE",
  "SSL_CERT_FILE",
];
export function kaggleCliEnvironment(from: NodeJS.ProcessEnv) {
  const env: NodeJS.ProcessEnv = { PYTHONUTF8: "1" };
  for (const [name, value] of Object.entries(from))
    if (CLI_ENVIRONMENT.includes(name) || name.startsWith("KAGGLE_"))
      env[name] = value;
  return env;
}

// Its authentication help goes to stdout, beside whatever warning went to stderr. Its
// advice to upgrade comes first, and would take the room of what Kaggle really said.
export const cliWords = (...streams: string[]) =>
  streams
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Warning: Looks like you're"))
    .join(" ");

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
          env: kaggleCliEnvironment(process.env),
        },
        (error, stdout, stderr) => {
          if (error)
            reject(
              new Error(
                `${error.killed ? "Timed out. " : ""}${
                  cliWords(stderr, stdout) ||
                  `The Kaggle CLI failed (${error.code ?? "stopped"}).`
                }`,
              ),
            );
          else resolve({ stdout });
        },
      );
    });
}

const REMOTE_STATES = /KernelWorkerStatus\.([A-Z_]+)/;
// After a push is tried, only Kaggle's own refusal says it did not arrive: a status
// with its words, or a quota. Anything else may have reached Kaggle, and a second push
// would replace it: so it is uncertain, not failed. A bare number is not a refusal: a
// traceback's line numbers are in this text too.
const REFUSED_PUSH =
  /\b(?:400|401|403|404|409|413|422|429)\s+(?:Client Error|Bad Request|Unauthorized|Forbidden|Not Found|Conflict|Payload Too Large|Request Entity Too Large|Unprocessable|Too Many Requests)|\bquota\b|\bmaximum (?:batch|gpu|number|session)|Kernel push error|Permission '[^']+' was denied|Authentication required to call the Kaggle API/i;
const wasRefused = (message: string) =>
  !message.startsWith("Timed out.") && REFUSED_PUSH.test(message);
const NO_SUCH_NOTEBOOK = /Permission 'kernels\.get' was denied/;
// How long an earlier run may still answer for this one, just after a push.
const PUSH_SETTLE_MS = 3 * 60 * 1000;
// The longest a start can take to reach Kaggle, from when it was recorded: two questions,
// then the push. After a restart that record is all there is of when it was sent.
const SEND_BOUND_MS = (90 + 90 + 180) * 1000;
const FOLDER_KEEP_MS = 24 * 60 * 60 * 1000;
const EXPIRY_GRACE_SECONDS = 10 * 60;
const PAST_LIMIT =
  "This run has gone past its time limit. What Kaggle shows may be another run's, so only a result naming this run is taken.";
// All the log can show: the process was killed. Memory is the likely reason, not a
// known one, and only a flag leaves the log, which can hold the prompt.
const WAS_KILLED =
  "Kaggle killed the run before it finished, most likely because it ran out of memory. The same settings have also worked, so trying again may too.";
const LOG_TAIL_BYTES = 8 * 1024 * 1024;
// A whole output line, as a real killed run's log has it: a word in a prompt is not.
const KILLED_LINE = /"data":"Killed\\n"/;
async function logSaysKilled(folder: string) {
  const names = await readdir(folder).catch(() => [] as string[]);
  for (const name of names.filter((n) => n.endsWith(".log"))) {
    const text = await readFile(path.join(folder, name), "utf8").catch(
      () => "",
    );
    if (KILLED_LINE.test(text.slice(-LOG_TAIL_BYTES))) return true;
  }
  return false;
}

// What a finished run left cannot be read. Failing to fetch it is not this: that
// can be tried again.
class Unreadable extends Error {}
// What came down is not what the run made: the CLI saves an error page as the file it
// asked for, and exits as if all were well. Fetched again, but not on every poll.
class Garbled extends Error {}
const REFETCH_MS = 5 * 60 * 1000;
// Fetched this many times, a quarter of an hour apart in all: past that it is what the
// run left, not a bad moment, and is said to be so.
const FETCH_TRIES = 4;

type Run = {
  recipe: KaggleRecipe;
  runId: string;
  startedAt: number;
  folder: string;
  ended?: ExecutionStatus["state"];
  // Said beside every answer: the run goes on whatever this says.
  warning?: string;
  endedWith?: string;
  video?: { file: string; artifact: Artifact };
  // Sent with no answer: nothing says it is running at all.
  uncertain?: boolean;
  // Sent from another Kaggle account: its notebook is not this one's to ask about.
  foreign?: string;
  refetchAt?: number;
  fetchTries?: number;
  refetchNote?: string;
  // One question at a time: a slow one must not undo the answer to another.
  asking?: Promise<ExecutionStatus>;
};

export function notebookUrl(username: string, recipe: KaggleRecipe) {
  return `https://www.kaggle.com/code/${username}/${recipe.slug}`;
}

// Folders from earlier sessions: a run's video, or a failed push's script.
async function sweepOldFolders(
  root: string,
  now: number,
  keep: (runId: string) => boolean,
) {
  const entries = await readdir(root).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter(
        (name) =>
          name.startsWith(FOLDER_PREFIX) &&
          !keep(name.slice(FOLDER_PREFIX.length)),
      )
      .map(async (name) => {
        const folder = path.join(root, name);
        const { mtimeMs } = await stat(folder);
        if (now - mtimeMs > FOLDER_KEEP_MS)
          await rm(folder, { recursive: true, force: true });
      })
      .map((p) => p.catch(() => {})),
  );
}

// What the engine asks of the job table's record of its runs.
export const ledgerOptions = (ledger: GenerationLedger) => ({
  recorded: (ref: string) => {
    const r = ledger.read(ref);
    return r && !r.held
      ? {
          recipeId: r.recipe.id,
          startedAt: r.startedAt,
          videoSha256: r.videoSha256,
          sent: r.phase === "sent",
          remote: r.remote ?? null,
          notice: r.notice ?? null,
          finished: r.imported !== null || r.dismissed,
        }
      : null;
  },
  lastSentAt: ledger.lastSentAt,
});

export function createKaggleEngine(options: {
  cli: KaggleCli;
  username: string;
  // Tests only.
  scriptFor?: (recipe: KaggleRecipe) => Promise<string>;
  download?: (recipe: KaggleRecipe, folder: string) => Promise<void>;
  now?: () => number;
  folderRoot?: string;
  // What a run was, from the record kept before it was sent: so that one started before
  // a restart is followed again. Without it, a run is known only to this service.
  recorded?: (ref: string) => {
    recipeId: string;
    startedAt: number;
    videoSha256: string | null;
    sent: boolean;
    remote: string | null;
    notice: string | null;
    // Brought in or dismissed: its video has no further use here.
    finished: boolean;
  } | null;
  // When another run of this recipe, even one given up on, was last recorded as sent:
  // Kaggle may not yet show it.
  lastSentAt?: (recipeId: string, except: string) => number | undefined;
  // Tests only: recipes to treat as offered.
  alsoOffered?: readonly string[];
}): EngineAdapterV2 {
  const { cli, username } = options;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/.test(username))
    throw new Error("That is not a Kaggle username.");
  const now = options.now ?? Date.now;
  const folderRoot = options.folderRoot ?? tmpdir();
  // After a start, and tidying only: if the store has gone by then, it can wait.
  void sweepOldFolders(folderRoot, now(), (runId) => {
    const record = options.recorded?.(runId);
    return record?.videoSha256 != null && !record.finished;
  }).catch(() => {});
  const runs = new Map<string, Run>();
  // Between asking whether a notebook is free and having pushed to it.
  const pushing = new Set<string>();
  // Runs being sent by this service now, by their own names.
  const sendingNow = new Set<string>();
  // Asked about at once just after a restart, a run is still one run.
  const adopting = new Map<string, Promise<Run>>();
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
  const status = (run: Run): ExecutionStatus => ({
    executionRef: run.runId,
    state: run.ended ?? "unknown",
    ...(run.endedWith ? { diagnostic: diagnostic(run.endedWith) } : {}),
  });
  const end = (
    run: Run,
    state: ExecutionStatus["state"],
    message?: string,
  ): ExecutionStatus => {
    run.ended = state;
    run.endedWith = message;
    return status(run);
  };
  const settling = (run: Run) => now() - run.startedAt < PUSH_SETTLE_MS;
  const pastLimit = (run: Run) =>
    now() - run.startedAt >
    (run.recipe.timeoutSeconds + EXPIRY_GRACE_SECONDS) * 1000;
  const waiting = (run: Run): ExecutionStatus => ({
    executionRef: run.runId,
    state: "queued",
  });

  // What the finished run left. Only a receipt naming this run counts.
  async function collect(run: Run) {
    const folder = path.join(run.folder, "output");
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await download(run.recipe, folder).catch(async (e) => {
      // A part of a download can hold the prompt.
      await rm(folder, { recursive: true, force: true });
      throw e;
    });
    const file = path.join(folder, "receipt.json");
    try {
      if ((await stat(file)).size > RECEIPT_BYTES)
        throw new Unreadable("That receipt is too large to be one.");
      const receipt = JSON.parse(await readFile(file, "utf8"));
      if (receipt === null || typeof receipt !== "object")
        throw new Unreadable("That is not a receipt.");
      // A saved error body reads as JSON too, and names no run.
      if (typeof receipt.runId !== "string") throw new Error("No run named.");
      return { folder, receipt };
    } catch (e) {
      // Any of it can hold the prompt, or the answer of another run.
      await rm(folder, { recursive: true, force: true });
      if (e instanceof Unreadable) throw e;
      throw new Garbled("The run's receipt is missing or cannot be read.");
    }
  }

  const hashOf = async (file: string) => {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest("hex");
  };

  // A kill during a send can leave its script, or a pull of an earlier run's. A send
  // still going is using them.
  const clearLeftovers = async (run: Run) => {
    if (sendingNow.has(run.runId)) return;
    await Promise.all(
      ["push", "pulled"].map((name) =>
        rm(path.join(run.folder, name), { recursive: true, force: true }),
      ),
    ).catch(() => {});
  };

  // The prompt is in the receipt and the log: once read, only the video stays.
  const keepOnly = async (run: Run, kept?: string) => {
    if (!kept) return rm(run.folder, { recursive: true, force: true });
    await clearLeftovers(run);
    const folder = path.dirname(kept);
    for (const name of await readdir(folder))
      if (path.join(folder, name) !== kept)
        await rm(path.join(folder, name), { recursive: true, force: true });
  };

  async function finish(run: Run): Promise<ExecutionStatus> {
    const { folder, receipt } = await collect(run);
    if (receipt.runId !== run.runId) {
      // An earlier run's answer, before this one's has replaced it. Its receipt holds
      // that run's prompt, so it does not stay.
      await rm(folder, { recursive: true, force: true });
      if (settling(run)) return waiting(run);
      await keepOnly(run);
      return end(run, "failed", "Kaggle's latest run is not this one.");
    }
    const failed = async (message: string) => {
      await keepOnly(run);
      return end(run, "failed", message);
    };
    if (receipt.stage !== "done" || receipt.verified !== true)
      return failed(
        typeof receipt.error === "string"
          ? receipt.error
          : "The run ended without a video that passed its own checks.",
      );
    if (receipt.frames !== run.recipe.frames)
      return failed("The run made a different length from the one asked for.");
    const file = path.join(folder, run.recipe.output);
    const size = await stat(file).then(
      (found) => found.size,
      () => 0,
    );
    // Empty or missing is what a bad download leaves, as well as a bad run.
    if (size < 1) {
      await rm(folder, { recursive: true, force: true });
      throw new Garbled("The run's video did not come down.");
    }
    if (size > ENGINE_V2_LIMITS.artifactBytes)
      return failed("The video is not a size this can take.");
    const hash = await hashOf(file);
    if (hash !== receipt.sha256) {
      await rm(folder, { recursive: true, force: true });
      throw new Garbled("The video is not the one its receipt names.");
    }
    await keepOnly(run, file);
    run.video = {
      file,
      artifact: {
        handle: run.recipe.output.toLowerCase(),
        mediaType: "video/mp4",
        byteLength: size,
        sha256: hash,
      },
    };
    return end(run, "succeeded");
  }

  const ask = async (run: Run): Promise<ExecutionStatus> => {
    // Anything Kaggle says now is of an earlier run, and acting on it could end this one
    // or take the files it is being sent from. A question begun here ends with the send.
    if (sendingNow.has(run.runId)) return waiting(run);
    if (run.foreign)
      return {
        executionRef: run.runId,
        state: "unknown",
        diagnostic: diagnostic(
          `This run was sent from another Kaggle account, as ${run.foreign}. It is not asked about from this one.`,
        ),
      };
    if (run.refetchAt !== undefined && now() < run.refetchAt)
      return {
        executionRef: run.runId,
        state: "unknown",
        diagnostic: diagnostic(run.refetchNote ?? ""),
      };
    try {
      const state = await remoteState(run.recipe);
      if (state === "QUEUED" || state === "NEW_SCRIPT" || state === "RUNNING")
        // The clock alone ends nothing. Whether time in a queue counts toward the limit
        // is not known, and what comes next says whose run this was.
        return {
          ...(state === "RUNNING"
            ? { executionRef: run.runId, state: "running" as const }
            : waiting(run)),
          ...(pastLimit(run) ? { diagnostic: diagnostic(PAST_LIMIT) } : {}),
        };
      if (state === "COMPLETE") {
        try {
          return await finish(run);
        } catch (e) {
          if (!(e instanceof Unreadable) || settling(run)) throw e;
          await keepOnly(run);
          return end(run, "failed", "The run ended without a readable result.");
        }
      }
      if (state === "ERROR") {
        const left = await collect(run).catch(() => null);
        const ours = left?.receipt.runId === run.runId;
        // Just after a push, this may still be what an earlier run came to.
        if (!ours && settling(run)) {
          if (left) await rm(left.folder, { recursive: true, force: true });
          return waiting(run);
        }
        // Read before the folder goes. A kill leaves no error of its own in a receipt.
        const killed = ours && (await logSaysKilled(left.folder));
        await keepOnly(run);
        if (left && !ours)
          return end(run, "failed", "Kaggle's latest run is not this one.");
        return end(
          run,
          "failed",
          ours && typeof left.receipt.error === "string"
            ? left.receipt.error
            : killed
              ? WAS_KILLED
              : "The run failed on Kaggle.",
        );
      }
      if (state === "CANCEL_REQUESTED" || state === "CANCEL_ACKNOWLEDGED") {
        // Likewise: someone stopping an earlier run on Kaggle is not this one.
        if (settling(run)) return waiting(run);
        if (run.uncertain)
          return {
            executionRef: run.runId,
            state: "unknown",
            diagnostic: diagnostic(
              "Kaggle's latest run on this notebook was stopped there. It may or may not have been this one.",
            ),
          };
        await keepOnly(run);
        return end(
          run,
          "cancelled",
          "Kaggle's latest run on this notebook was stopped there.",
        );
      }
      return {
        executionRef: run.runId,
        state: "unknown",
        diagnostic: diagnostic(`Kaggle says ${state}.`),
      };
    } catch (e) {
      // Being unable to ask is not the run failing, however late: it is asked again,
      // and a person can stop following it. A finished video may be waiting.
      if (e instanceof Garbled) {
        run.fetchTries = (run.fetchTries ?? 0) + 1;
        if (run.fetchTries >= FETCH_TRIES) {
          await keepOnly(run).catch(() => {});
          return end(
            run,
            "failed",
            `${e.message} It was fetched ${FETCH_TRIES} times, and came no differently. Any result is still on its notebook, until a later run replaces it.`,
          );
        }
        run.refetchAt = now() + REFETCH_MS;
        run.refetchNote = `What came down from Kaggle could not be used: ${e.message} It will be fetched again.`;
        return {
          executionRef: run.runId,
          state: "unknown",
          diagnostic: diagnostic(run.refetchNote),
        };
      }
      return {
        executionRef: run.runId,
        state: "unknown",
        diagnostic: diagnostic(
          `${pastLimit(run) ? `${PAST_LIMIT} ` : ""}Could not get an answer from Kaggle: ${(e as Error).message}`,
        ),
      };
    }
  };

  const check = async (run: Run): Promise<ExecutionStatus> => {
    if (!run.ended)
      run.asking ??= ask(run).finally(() => {
        run.asking = undefined;
      });
    const answer = run.ended ? status(run) : await run.asking!;
    if (!run.warning) return answer;
    return {
      ...answer,
      diagnostic: diagnostic(
        answer.diagnostic ? `${run.warning} ${answer.diagnostic}` : run.warning,
      ),
    };
  };

  const folderOf = (runId: string) =>
    path.join(folderRoot, `${FOLDER_PREFIX}${runId}`);

  const runOf = async (ref: string) => {
    const known = runs.get(ref);
    if (known) return known;
    let pending = adopting.get(ref);
    if (!pending) {
      pending = adopt(ref).finally(() => adopting.delete(ref));
      adopting.set(ref, pending);
    }
    return pending;
  };

  const adopt = async (ref: string) => {
    const record = options.recorded?.(ref);
    const recipe = KAGGLE_RECIPES.find((r) => r.id === record?.recipeId);
    if (!record || !recipe)
      throw new CommandError("NOT_FOUND", "That run is not known here.");
    const run: Run = {
      recipe,
      runId: ref,
      // Sent no later than this: an earlier run may answer for it until then.
      startedAt: record.startedAt + SEND_BOUND_MS,
      folder: folderOf(ref),
      uncertain: !record.sent,
      ...(record.notice ? { warning: record.notice } : {}),
      ...(record.remote &&
      record.remote.toLowerCase() !== remote(recipe).toLowerCase()
        ? { foreign: record.remote }
        : {}),
    };
    await clearLeftovers(run);
    // Its video from before the restart, if it is still the one recorded.
    const file = path.join(run.folder, "output", recipe.output);
    if (record.videoSha256) {
      const size = await stat(file).then(
        (found) => found.size,
        () => 0,
      );
      const hash = size > 0 ? await hashOf(file).catch(() => "") : "";
      if (hash === record.videoSha256) {
        run.video = {
          file,
          artifact: {
            handle: recipe.output.toLowerCase(),
            mediaType: "video/mp4",
            byteLength: size,
            sha256: record.videoSha256,
          },
        };
        run.ended = "succeeded";
      }
    }
    // Being sent, it is the send's to record: if refused, it never was.
    if (!sendingNow.has(ref)) runs.set(ref, run);
    return run;
  };

  // Kaggle's own answer on a notebook's privacy, not what was asked of it. A pull
  // brings the script too, with its prompt, so nothing of it stays.
  async function reportedPrivate(recipe: KaggleRecipe, folder: string) {
    const pulled = path.join(folder, "pulled");
    await mkdir(pulled);
    try {
      await cli(
        ["kernels", "pull", remote(recipe), "-p", pulled, "-m"],
        90_000,
      );
      const metadata = JSON.parse(
        await readFile(path.join(pulled, "kernel-metadata.json"), "utf8"),
      );
      return metadata.is_private === true;
    } finally {
      await rm(pulled, { recursive: true, force: true });
    }
  }
  const listed = async (recipe: KaggleRecipe) => {
    const { stdout } = await cli(
      [
        "kernels",
        "list",
        "--mine",
        "-s",
        recipe.slug,
        "--page-size",
        "100",
        "--csv",
      ],
      90_000,
    );
    const lines = stdout.split(/\r?\n/);
    if (!lines.some((l) => l.startsWith("ref,") || l.startsWith("Not found")))
      throw new Error("Kaggle gave no list.");
    const name = `${remote(recipe).toLowerCase()},`;
    if (lines.some((l) => l.toLowerCase().startsWith(name))) return true;
    // It is a search, in no order of use: with more pages, it could be on one of them.
    if (lines.some((l) => l.startsWith("Next Page Token")))
      throw new Error("Kaggle's list goes on past what was read.");
    return false;
  };

  const NOT_PRIVATE =
    "Kaggle does not report this notebook as private. Check it on Kaggle before running again.";

  // Whether its notebook can take this prompt: nothing goes to one that is running,
  // or that Kaggle does not report as private.
  async function assertFree(
    recipe: KaggleRecipe,
    folder: string,
    attemptKey: string,
  ) {
    const busy = () =>
      new CommandError(
        "CAPABILITY_UNAVAILABLE",
        "This model's notebook is still running. Wait for it to finish, or stop it on Kaggle.",
      );
    // Kaggle may not yet show a run just pushed.
    const justSent = () =>
      new CommandError(
        "CAPABILITY_UNAVAILABLE",
        "A run of this model was sent a few minutes ago, and Kaggle may not show it yet. Try again shortly.",
      );
    for (const run of runs.values())
      if (run.recipe === recipe && !run.ended && settling(run))
        throw justSent();
    const sent = options.lastSentAt?.(recipe.id, attemptKey);
    if (sent !== undefined && now() - sent < SEND_BOUND_MS + PUSH_SETTLE_MS)
      throw justSent();
    let state: string;
    try {
      state = await remoteState(recipe);
    } catch (e) {
      // The CLI says this of any refusal, so it means new only when the account's own
      // list, which needs working credentials, does not hold it.
      if (
        NO_SUCH_NOTEBOOK.test((e as Error).message) &&
        (await listed(recipe).catch(() => true)) === false
      )
        return;
      throw new CommandError(
        "CAPABILITY_UNAVAILABLE",
        diagnostic(
          `Could not ask Kaggle whether this notebook is free: ${(e as Error).message}`,
        ) ?? "Could not ask Kaggle whether this notebook is free.",
      );
    }
    if (
      state === "RUNNING" ||
      state === "QUEUED" ||
      state === "NEW_SCRIPT" ||
      state === "CANCEL_REQUESTED"
    )
      throw busy();
    let answer: boolean;
    try {
      answer = await reportedPrivate(recipe, folder);
    } catch {
      throw new CommandError(
        "CAPABILITY_UNAVAILABLE",
        "Could not confirm that this notebook is private, so nothing was sent.",
      );
    }
    if (!answer) throw new CommandError("CAPABILITY_UNAVAILABLE", NOT_PRIVATE);
  }

  async function readFirstFrame(asset: AssetRef, context: EngineContextV2) {
    const parts: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of context.openAsset(asset)) {
      bytes += chunk.byteLength;
      if (bytes > FIRST_FRAME_BYTES)
        throw new CommandError(
          "VALIDATION",
          `A first frame can be up to ${FIRST_FRAME_BYTES / (1024 * 1024)} MB.`,
        );
      parts.push(chunk);
    }
    const image = Buffer.concat(parts);
    if (sha256(image) !== asset.sha256)
      throw new CommandError(
        "VALIDATION",
        "That image is not the version this run was started with.",
      );
    // The founder chose that a photo's metadata does not go. Its hash is now this copy's.
    let stripped;
    try {
      stripped = stripImage(image, asset.mediaType);
    } catch (e) {
      throw new CommandError("VALIDATION", (e as Error).message);
    }
    return {
      data: stripped.image.toString("base64"),
      mediaType: asset.mediaType,
      sha256: sha256(stripped.image),
      orientation: stripped.orientation,
    };
  }

  return {
    contract: ENGINE_CONTRACT_V2,
    capabilities: () => [],
    location: (recipeId) => {
      const recipe = KAGGLE_RECIPES.find((r) => r.id === recipeId);
      return recipe ? remote(recipe).toLowerCase() : null;
    },
    async submit(request, context) {
      const recipe = KAGGLE_RECIPES.find((r) => r.id === request.recipeId);
      if (
        !recipe ||
        !(recipe.offered || options.alsoOffered?.includes(recipe.id)) ||
        request.operation !== (recipe.operation ?? "textToVideo")
      )
        return { refused: "ENGINE_DISABLED" as const };
      // One first frame, or none. This model ignores a last frame without saying so.
      const [frame] = request.inputs as readonly {
        role: string;
        asset: AssetRef;
      }[];
      const wanted = recipe.operation === "imageToVideo" ? 1 : 0;
      if (
        request.inputs.length !== wanted ||
        (wanted === 1 && frame.role !== "firstFrame")
      )
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
      if (pushing.has(recipe.id))
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          "A run of this model is already being sent to Kaggle.",
        );
      pushing.add(recipe.id);
      sendingNow.add(request.attemptKey);
      let folder: string | null = null;
      let sending = false;
      let sent = false;
      try {
        folder = folderOf(request.attemptKey);
        await mkdir(folder, { recursive: true, mode: 0o700 });
        // Its notebook has one latest run: another would hide this one's result.
        await assertFree(recipe, folder, request.attemptKey);
        // Recorded by the service before this: after a crash it is how the run is found.
        const runId = request.attemptKey;
        const push = path.join(folder, "push");
        await mkdir(push);
        // Read last: opening it is where consent is checked, so that answer is this moment's.
        const firstFrame = frame
          ? await readFirstFrame(frame.asset, context)
          : null;
        await writeFile(
          path.join(push, "run.py"),
          scriptWithBrief(await scriptFor(recipe), {
            prompt: request.prompt,
            seed: request.seed ?? 42,
            runId,
            ...(firstFrame ? { firstFrame } : {}),
          }),
        );
        await writeFile(
          path.join(push, "kernel-metadata.json"),
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
        sending = true;
        const { stdout } = await cli(
          ["kernels", "push", "-p", push, "-t", String(recipe.timeoutSeconds)],
          3 * 60 * 1000,
        );
        if (!/successfully pushed/i.test(stdout))
          throw new Error(
            cliWords(stdout).slice(0, ENGINE_V2_LIMITS.diagnosticChars),
          );
        sent = true;
        // It has gone: from here a problem is this run's, reported by this run.
        await rm(push, { recursive: true, force: true }).catch(() => {});
        const run: Run = { recipe, runId, startedAt: now(), folder };
        runs.set(runId, run);
        // It has gone and it is running, whatever this says: so this warns, it does
        // not end what is still happening.
        await reportedPrivate(recipe, folder)
          .then((answer) => {
            if (!answer) run.warning = NOT_PRIVATE;
          })
          .catch(() => {
            run.warning =
              "Could not confirm that this notebook is private. Check it on Kaggle.";
          });
        return {
          executionRef: runId,
          ...(run.warning ? { notice: run.warning } : {}),
        };
      } catch (e) {
        // No answer is not a refusal: it may have arrived, and a second push would
        // replace it. It is followed like any other, and said to be uncertain.
        if (sending && !sent && !wasRefused((e as Error).message)) {
          if (folder)
            await rm(path.join(folder, "push"), {
              recursive: true,
              force: true,
            }).catch(() => {});
          runs.set(request.attemptKey, {
            recipe,
            runId: request.attemptKey,
            startedAt: now(),
            folder: folder!,
            uncertain: true,
          });
          return {
            executionRef: request.attemptKey,
            uncertain: [
              "No clear answer came from Kaggle, so this may or may not have reached it. It will not be sent again automatically.",
              diagnostic(`The Kaggle tool said: ${(e as Error).message}`),
            ]
              .filter(Boolean)
              .join(" "),
          };
        }
        if (folder)
          await rm(folder, { recursive: true, force: true }).catch(() => {});
        if (e instanceof CommandError) throw e;
        throw new CommandError(
          "CAPABILITY_UNAVAILABLE",
          diagnostic(`Kaggle did not take the run: ${(e as Error).message}`) ??
            "Kaggle did not take the run.",
        );
      } finally {
        pushing.delete(recipe.id);
        sendingNow.delete(request.attemptKey);
      }
    },
    status: async (ref) => check(await runOf(ref)),
    reconcile: async (ref) => check(await runOf(ref)),
    // Kaggle's public interface offers no way to stop a run. This stops following it,
    // and says so: it goes on until it ends or reaches its time limit.
    async requestCancel(ref) {
      const run = await runOf(ref);
      return {
        // Nothing was asked of Kaggle: it has no way to be asked.
        requested: false,
        localProcessExited: true,
        remoteAcknowledged: false,
        remoteOutcome:
          run.ended || run.uncertain || run.foreign || pastLimit(run)
            ? ("unknown" as const)
            : ("continuing" as const),
        billingOutcome: "notApplicable" as const,
      };
    },
    async enumerateArtifacts(ref) {
      const { video } = await runOf(ref);
      return video ? [video.artifact] : [];
    },
    async *readArtifact(ref, handle) {
      const { video } = await runOf(ref);
      if (!video || video.artifact.handle !== handle)
        throw new CommandError("NOT_FOUND", "That output is not known here.");
      for await (const chunk of createReadStream(video.file, {
        highWaterMark: ENGINE_V2_LIMITS.chunkBytes,
      }))
        yield chunk as Uint8Array;
    },
  };
}
