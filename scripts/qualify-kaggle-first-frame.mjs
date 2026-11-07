// One real image-to-video run on the person's own Kaggle, for the recipe that is not offered.
// It sends a picture made here, of no one, because nothing has yet shown this path works, and
// it reaches the recipe only by naming it, in this process. The page cannot reach it.
// It uses GPU quota: a person starts it, and it does not retry.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RESOURCE_POLICY_HASH } from "../core/command/registry.ts";
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
  console.log("FIRST FRAME RUN NOT RUN");
  process.exit(2);
}
const PROMPT = "The camera drifts slowly forward as the colours gently shift.";
const SEED = 7;
const MAX_WAIT_MS = 50 * 60 * 1000;
const recipe = KAGGLE_RECIPES.find((r) => r.operation === "imageToVideo");
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
const step = (name, detail = {}) => {
  steps.push({ name, ...detail, at: new Date().toISOString() });
  console.log(`ok - ${name}`);
};
const root = mkdtempSync(join(tmpdir(), "yamakan-first-frame-run-"));
const started = Date.now();
let passed = false;
let failure = null;
let generationId = null;
let queue;
let store;
try {
  // Made here, and made of fine detail: what is sent is a PNG, and its size is part of the
  // question of what Kaggle accepts inside a script.
  const still = join(out, "sent-frame.png");
  ffmpeg(
    "-y",
    "-f",
    "lavfi",
    "-i",
    `mandelbrot=s=${recipe.width}x${recipe.height}:end_scale=0.05:start_scale=0.05`,
    "-vf",
    "noise=alls=14:allf=u:all_seed=7,format=rgb24",
    "-frames:v",
    "1",
    still,
  );
  const size = statSync(still).size;
  step("made a picture of no one", {
    bytes: size,
    sha256: createHash("sha256").update(readFileSync(still)).digest("hex"),
  });

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
  const project = await store.create("First frame qualification");
  const { asset } = await store.importAsset(
    project.id,
    "sent-frame.png",
    createReadStream(still),
    size,
  );

  ({ generationId } = await service.start({
    projectId: project.id,
    recipe: {
      id: recipe.id,
      hash: "a".repeat(64),
      operation: "imageToVideo",
      modelManifestHash: "b".repeat(64),
    },
    prompt: PROMPT,
    seed: SEED,
    width: recipe.width,
    height: recipe.height,
    durationFrames: 100,
    firstFrameAssetId: asset.id,
  }));
  step("Kaggle took a script with the picture inside", {
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

  // How like the picture it sent is the video's first frame? Looking at them decides; this is
  // the figure beside that, at a size where the picture's fine noise averages out.
  const measured = spawnSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-i",
      file,
      "-i",
      still,
      "-lavfi",
      "[0:v]select='eq(n,0)',scale=88:60:flags=area,format=rgb24[a];[1:v]scale=88:60:flags=area,format=rgb24[b];[a][b]psnr",
      "-frames:v",
      "1",
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const psnr = Number(/average:([\d.]+|inf)/.exec(measured.stderr)?.[1]);
  assert.ok(psnr > 0, "the first frame could be compared with the picture");
  step("compared the first frame with the picture", { psnr });
  for (const [name, at] of [
    ["first", 0],
    ["middle", 40],
    ["last", 80],
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
  failure = String(e?.message ?? e).slice(0, 1000);
  console.error(failure);
} finally {
  // Whatever happens here, the receipt below must still be written.
  try {
    await queue?.close();
    await store?.close();
  } catch (e) {
    console.error(`Could not close: ${e?.message}`);
  }
  writeFileSync(
    join(out, "receipt.json"),
    `${JSON.stringify({ task: "first-frame-from-yamakan-on-kaggle", recipe: recipe.id, generationId, prompt: PROMPT, seed: SEED, head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "", passed, failure, steps }, null, 2)}\n`,
  );
}
console.log(passed ? "FIRST FRAME RUN PASS" : "FIRST FRAME RUN FAIL");
process.exit(passed ? 0 : 1);
