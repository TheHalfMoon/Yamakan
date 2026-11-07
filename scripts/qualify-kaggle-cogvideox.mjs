// One real CogVideoX run on the person's own Kaggle, for the recipe that is not offered: it
// reaches the recipe only by naming it, in this process, and the page cannot reach it.
// It uses GPU quota: a person starts it, and it does not retry.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RESOURCE_POLICY_HASH } from "../core/command/registry.ts";
import { diagnostic } from "../core/engines/contract-v2.ts";
import { createGenerationService } from "../core/engines/generation.ts";
import {
  KAGGLE_RECIPES,
  createKaggleEngine,
  kaggleCli,
  ledgerOptions,
} from "../core/engines/kaggle.ts";
import { JobSupervisor } from "../core/jobs.ts";
import { mediaTools } from "../core/process/workers.ts";
import { ProjectStore } from "../core/store.ts";

const [out] = process.argv.slice(2);
const { YAMAKAN_KAGGLE_CLI: cliFile, YAMAKAN_KAGGLE_USERNAME: username } =
  process.env;
if (!out || !cliFile || !username) {
  console.error(
    "Set YAMAKAN_KAGGLE_CLI and YAMAKAN_KAGGLE_USERNAME, and name an out folder.",
  );
  console.log("COGVIDEOX RUN NOT RUN");
  process.exit(2);
}
const PROMPT =
  "A paper boat floats slowly along a calm stream in soft morning light.";
const SEED = 7;
const MAX_WAIT_MS = 50 * 60 * 1000;
const recipe = KAGGLE_RECIPES.find((r) => r.id === "kaggle-cogvideox-2b");
const ffmpeg = (...args) =>
  execFileSync(
    mediaTools().ffmpeg,
    ["-hide_banner", "-loglevel", "error", ...args],
    {
      windowsHide: true,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

mkdirSync(out, { recursive: true });
const steps = [];
// Each step as it comes, since a closed terminal in the long wait runs no `finally`.
const step = (name, detail = {}) => {
  steps.push({ name, ...detail, at: new Date().toISOString() });
  console.log(`ok - ${name}`);
  // One that fails here must not end a good run: the last one below is the one that must land.
  try {
    writeReceipt();
  } catch (e) {
    console.error(`Could not write the receipt yet: ${e?.name}`);
  }
};
const root = mkdtempSync(join(tmpdir(), "yamakan-cogvideox-run-"));
const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};
const head = git("rev-parse", "HEAD");
const changes = git("status", "--porcelain");
const started = Date.now();
let passed = false;
let failure = null;
let generationId = null;
function writeReceipt() {
  writeFileSync(
    join(out, "receipt.json"),
    `${JSON.stringify(
      {
        task: "cogvideox-from-yamakan-on-kaggle",
        recipe: recipe.id,
        generationId,
        prompt: PROMPT,
        seed: SEED,
        head,
        dirty: changes !== "",
        passed,
        failure,
        steps,
      },
      null,
      2,
    )}\n`,
  );
}
let queue;
let store;
try {
  store = new ProjectStore(join(root, "workspace"));
  await store.initialize();
  queue = new JobSupervisor(store);
  await queue.start();
  const ledger = queue.generationLedger();
  const service = createGenerationService({
    adapter: createKaggleEngine({
      cli: kaggleCli(cliFile),
      username,
      alsoOffered: [recipe.id],
      ...ledgerOptions(ledger),
    }),
    store,
    resourcePolicyHash: RESOURCE_POLICY_HASH,
    ledger,
  });
  const project = await store.create("CogVideoX qualification");
  ({ generationId } = await service.start({
    projectId: project.id,
    recipe: {
      id: recipe.id,
      hash: "a".repeat(64),
      operation: "textToVideo",
      modelManifestHash: "b".repeat(64),
    },
    prompt: PROMPT,
    seed: SEED,
    width: recipe.width,
    height: recipe.height,
    // Its 49 frames at 8 a second, in this project's 30.
    durationFrames: Math.round((recipe.frames / recipe.fps) * 30),
  }));
  step("Kaggle took the script", {
    generationId,
    afterSeconds: (Date.now() - started) / 1000,
  });

  let answer;
  let last;
  while (Date.now() - started < MAX_WAIT_MS) {
    answer = await service.status(generationId);
    if (answer.state !== last)
      step(`Kaggle says ${answer.state}`, {
        afterSeconds: (Date.now() - started) / 1000,
      });
    last = answer.state;
    if (["succeeded", "failed", "canceled", "cancelled"].includes(answer.state))
      break;
    await new Promise((r) => setTimeout(r, 30_000));
  }
  assert.equal(
    answer?.state,
    "succeeded",
    answer?.diagnostic ?? "no answer in time",
  );

  const imported = await service.importResult(generationId);
  const video = await store.assetFile(project.id, imported.assetId);
  const file = join(out, "video.mp4");
  writeFileSync(file, readFileSync(video.file));
  step("its video passed its receipt and came in", {
    sha256: video.asset.hash,
  });

  for (const [name, at] of [
    ["first", 0],
    ["middle", Math.floor(recipe.frames / 2)],
    ["last", recipe.frames - 1],
  ])
    ffmpeg(
      "-y",
      "-i",
      file,
      "-vf",
      `select='eq(n,${at})'`,
      "-frames:v",
      "1",
      join(out, `frame-${name}.png`),
    );
  step("kept its first, middle and last frames, to look at");
  passed = true;
} catch (e) {
  // This receipt may be committed, and a CLI's error can hold an address naming the account.
  failure = diagnostic(String(e?.message ?? e)) ?? "It failed.";
  console.error(failure);
} finally {
  // Whatever happens here, the receipt below must still be written.
  for (const close of [
    () => queue?.close(),
    () => store?.close(),
    () =>
      rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      }),
  ])
    try {
      await close();
    } catch (e) {
      console.error(`Could not tidy up: ${e?.name}`);
    }
  writeReceipt();
}
console.log(passed ? "COGVIDEOX RUN PASS" : "COGVIDEOX RUN FAIL");
process.exit(passed ? 0 : 1);
