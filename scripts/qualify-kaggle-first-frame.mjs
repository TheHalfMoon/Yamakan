// One real image-to-video run on the person's own Kaggle, for the recipe that is not offered.
// It sends a picture made here, of no one, or a photograph a person names, which must show no
// one either. It reaches the recipe only by naming it, in this process. The page cannot reach it.
// It uses GPU quota: a person starts it, and it does not retry.
//
// Usage: npm run qualify:kaggle-first-frame -- <out> [noise | photo.png | photo.jpg] [prompt]
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
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

// How much noise a picture made here has decides whether it goes as a PNG or a JPEG. A path
// instead names a photograph to send.
const [out, picture = "14", promptGiven] = process.argv.slice(2);
const photo = /\.(png|jpe?g)$/i.test(picture) ? picture : null;
const noise = photo ? null : picture;
const { YAMAKAN_KAGGLE_CLI: cliFile, YAMAKAN_KAGGLE_USERNAME: username } =
  process.env;
if (!out || !cliFile || !username) {
  console.error(
    "Set YAMAKAN_KAGGLE_CLI and YAMAKAN_KAGGLE_USERNAME, and name an out folder.",
  );
  console.log("FIRST FRAME RUN NOT RUN");
  process.exit(2);
}
const PROMPT =
  promptGiven ??
  "The camera drifts slowly forward as the colours gently shift.";
const SEED = 7;
// From when Kaggle starts running it, since its queue alone has taken over half an hour.
const MAX_RUN_MS = 50 * 60 * 1000;
const MAX_WAIT_MS = 120 * 60 * 1000;
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
const root = mkdtempSync(join(tmpdir(), "yamakan-first-frame-run-"));
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
        task: "first-frame-from-yamakan-on-kaggle",
        recipe: recipe.id,
        generationId,
        prompt: PROMPT,
        seed: SEED,
        photo: photo ? { name: photo.split(/[\\/]/).pop() } : null,
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
  // Made here, and made of fine detail, since its size is part of the question of what Kaggle
  // accepts inside a script. Or the photograph named, as it is: Yamakan cleans it on the way.
  const still = join(
    out,
    photo
      ? `given-photo.${photo.split(".").pop().toLowerCase()}`
      : "sent-frame.png",
  );
  if (photo) writeFileSync(still, readFileSync(photo));
  else
    ffmpeg(
      "-y",
      "-f",
      "lavfi",
      "-i",
      `mandelbrot=s=${recipe.width}x${recipe.height}:end_scale=0.05:start_scale=0.05`,
      "-vf",
      `noise=alls=${noise}:allf=u:all_seed=7,format=rgb24`,
      "-frames:v",
      "1",
      still,
    );
  const size = statSync(still).size;
  step(photo ? "took the photograph named" : "made a picture of no one", {
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
    still.split(/[\\/]/).pop(),
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
    noUnconsentedPerson: true,
  }));
  step("Kaggle took a script with the picture inside", {
    generationId,
    afterSeconds: (Date.now() - started) / 1000,
  });

  let answer;
  let last;
  let running = null;
  while (
    Date.now() - started < MAX_WAIT_MS &&
    (running === null || Date.now() - running < MAX_RUN_MS)
  ) {
    answer = await service.status(generationId);
    if (answer.state !== last)
      step(`Kaggle says ${answer.state}`, {
        afterSeconds: (Date.now() - started) / 1000,
      });
    last = answer.state;
    if (running === null && answer.state === "running") running = Date.now();
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
      `[0:v]select='eq(n,0)',scale=88:60:flags=area,format=rgb24[a];[1:v]scale=${recipe.width}:${recipe.height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${recipe.width}:${recipe.height},scale=88:60:flags=area,format=rgb24[b];[a][b]psnr`,
      "-frames:v",
      "1",
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  const figure = /average:([\d.]+|inf)/.exec(measured.stderr)?.[1];
  assert.ok(figure, "the first frame could be compared with the picture");
  // A figure, not a verdict: whether the frame was used is judged by looking at what is kept.
  step("compared the first frame with the picture", { psnr: figure });
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
console.log(passed ? "FIRST FRAME RUN PASS" : "FIRST FRAME RUN FAIL");
process.exit(passed ? 0 : 1);
