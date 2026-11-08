// A first frame travels inside the run's brief, as the founder chose: only once a recipe
// is qualified, only the image this run was started with, and only if consent still allows
// it at the moment it is read. A stand-in for the CLI, and for the GPU libraries.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { ProjectStore } from "../core/store.ts";
import { JobSupervisor } from "../core/jobs.ts";
import {
  FIRST_FRAME_BYTES,
  KAGGLE_RECIPES,
  SCRIPT_BYTES,
  imageRoom,
  scriptWithBrief,
  createKaggleEngine,
  kaggleRecipes,
  ledgerOptions,
  offeredKaggleRecipes,
  type KaggleCli,
} from "../core/engines/kaggle.ts";
import { createGenerationService } from "../core/engines/generation.ts";
import { mediaTools } from "../core/process/workers.ts";
import { jpegHoldsOnlyAPicture } from "../core/engines/clean-image.ts";
import { Readable } from "node:stream";

const recipe = KAGGLE_RECIPES.find((r) => r.operation === "imageToVideo")!;
const REFUSED_RECIPE = /turned off in this build/;
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

const stillRoot = mkdtempSync(path.join(tmpdir(), "first-frame-still-"));
roots.push(stillRoot);
const STILL_FILE = path.join(stillRoot, "still.png");
execFileSync(
  mediaTools().ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=navy:s=320x200",
    "-frames:v",
    "1",
    STILL_FILE,
  ],
  { windowsHide: true },
);
const STILL = readFileSync(STILL_FILE);
const STILL_HASH = createHash("sha256").update(STILL).digest("hex");

function briefOf(folder: string) {
  const script = readFileSync(path.join(folder, "run.py"), "utf8");
  return JSON.parse(
    Buffer.from(/b64decode\("([^"]+)"\)/.exec(script)![1], "base64").toString(),
  );
}

async function fixture(
  alsoOffered: readonly string[] = [recipe.id],
  world: { exists?: boolean; push?: "ok" | "lost" | "refused" } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "first-frame-"));
  roots.push(root);
  mkdirSync(path.join(root, "tmp"));
  const store = new ProjectStore(path.join(root, "workspace"));
  await store.initialize();
  const queue = new JobSupervisor(store);
  await queue.start();
  const ledger = queue.generationLedger();
  const pushes: any[] = [];
  const asked: string[] = [];
  const cli: KaggleCli = async (args) => {
    asked.push(args[1]);
    if (args[1] === "list") return { stdout: "Not found\n" };
    if (args[1] === "status") {
      if (world.exists)
        return { stdout: 'has status "KernelWorkerStatus.COMPLETE"' };
      if (pushes.length === 0)
        throw new Error(
          "Cannot access kernel (Permission 'kernels.get' was denied).",
        );
      return { stdout: 'has status "KernelWorkerStatus.RUNNING"' };
    }
    if (args[1] === "pull") {
      writeFileSync(
        path.join(args[4], "kernel-metadata.json"),
        JSON.stringify({ is_private: true }),
      );
      return { stdout: "" };
    }
    if (args[1] === "push") {
      if (world.push === "refused")
        throw new Error("Kernel push error: Maximum weekly GPU quota");
      if (world.push === "lost") throw new Error("Connection reset");
      pushes.push({
        scriptBytes: statSync(path.join(args[3], "run.py")).size,
        brief: briefOf(args[3]),
        metadata: JSON.parse(
          readFileSync(path.join(args[3], "kernel-metadata.json"), "utf8"),
        ),
      });
      return { stdout: "successfully pushed" };
    }
    throw new Error(`unexpected ${args}`);
  };
  const adapter = createKaggleEngine({
    cli,
    username: "someone",
    folderRoot: path.join(root, "tmp"),
    scriptFor: async () => SCRIPT,
    alsoOffered,
    ...ledgerOptions(ledger),
  });
  const service = createGenerationService({
    adapter,
    store,
    resourcePolicyHash: "c".repeat(64),
    ledger,
  });
  const project = await store.create("First frame");
  const { asset } = await store.importAsset(
    project.id,
    "still.png",
    Readable.from([STILL]),
    STILL.length,
  );
  const request = {
    projectId: project.id,
    recipe: {
      id: recipe.id,
      hash: "a".repeat(64),
      operation: "imageToVideo" as const,
      modelManifestHash: "b".repeat(64),
    },
    prompt: "The boat drifts.",
    seed: 7,
    width: recipe.width,
    height: recipe.height,
    durationFrames: 100,
    firstFrameAssetId: asset.id,
    noUnconsentedPerson: true as const,
  };
  return {
    root,
    store,
    adapter,
    service,
    pushes,
    asked,
    request,
    asset,
    close: async () => {
      await queue.close();
      await store.close();
    },
  };
}

test("no image-to-video recipe is offered until its own real run has passed", () => {
  assert.equal(recipe.offered, false);
  assert.ok(!offeredKaggleRecipes().includes(recipe));
  assert.ok(!kaggleRecipes().some((r) => r.operation === "imageToVideo"));
});

test("the engine says where a run goes, which is what makes consent to send apply", async () => {
  const f = await fixture();
  assert.equal(f.adapter.location?.(recipe.id), `someone/${recipe.slug}`);
  await f.close();
});

test("a recipe not offered refuses a first frame, and sends nothing", async () => {
  const f = await fixture([]);
  await assert.rejects(f.service.start(f.request), REFUSED_RECIPE);
  assert.equal(f.pushes.length, 0);
  await f.close();
});

test("the image travels inside the brief, and is the one started with", async () => {
  const f = await fixture();
  await f.service.start(f.request);
  assert.equal(f.pushes.length, 1);
  const { brief, metadata } = f.pushes[0];
  const sent = Buffer.from(brief.firstFrame.data, "base64");
  assert.equal(
    brief.firstFrame.sha256,
    createHash("sha256").update(sent).digest("hex"),
  );
  assert.equal(brief.firstFrame.mediaType, "image/png");
  assert.notEqual(
    brief.firstFrame.sha256,
    STILL_HASH,
    "a new file, not the original",
  );
  assert.equal(sent.readUInt32BE(16), recipe.width);
  assert.equal(sent.readUInt32BE(20), recipe.height);
  assert.equal(brief.prompt, "The boat drifts.");
  // Nothing else goes to Kaggle: no dataset, and the notebook is asked to be private.
  assert.deepEqual(metadata.dataset_sources, []);
  assert.equal(metadata.is_private, true);
  assert.equal(metadata.id, `someone/${recipe.slug}`);
  await f.close();
});

test("once sent, the image's copy in the script does not stay on this computer", async () => {
  const f = await fixture();
  await f.service.start(f.request);
  const left = readdirSync(path.join(f.root, "tmp"), {
    recursive: true,
    withFileTypes: true,
  }).filter((e) => e.isFile());
  assert.deepEqual(left, []);
  await f.close();
});

test("the ledger holds the image's hash, not the image", async () => {
  const f = await fixture();
  const { generationId } = await f.service.start(f.request);
  const row = f.store.read(
    (db) =>
      db
        .prepare("SELECT payload FROM jobs WHERE job_id = ?")
        .get(generationId) as { payload: string },
  );
  assert.ok(row.payload.includes(STILL_HASH));
  const once = STILL.toString("base64");
  const twice = Buffer.from(JSON.stringify({ data: once })).toString("base64");
  assert.ok(!row.payload.includes(once.slice(0, 40)));
  assert.ok(!row.payload.includes(twice.slice(8, 48)));
  await f.close();
});

const adapterRequest = (
  f: Awaited<ReturnType<typeof fixture>>,
  inputs: unknown,
) =>
  ({
    contract: "yamakan.engine/v2",
    operation: "imageToVideo",
    recipeId: recipe.id,
    attemptKey: randomUUID(),
    prompt: "x",
    seed: 1,
    inputs,
    output: {
      kind: "video",
      width: recipe.width,
      height: recipe.height,
      audio: false,
    },
  }) as never;
const frameRef = {
  assetVersionId: randomUUID(),
  sha256: STILL_HASH,
  mediaType: "image/png",
};
const opening = (data: Uint8Array) =>
  ({
    openAsset: () => Readable.from([data]),
  }) as never;

test("a phone's photo goes made anew, with nothing of its file", async () => {
  const file = path.join(stillRoot, "photo.jpg");
  execFileSync(
    mediaTools().ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=teal:s=64x48",
      "-frames:v",
      "1",
      file,
    ],
    { windowsHide: true },
  );
  const jpeg = readFileSync(file);
  const SECRET = "24.7136N 46.6753E";
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(6, 18);
  const body = Buffer.concat([
    Buffer.from("Exif\0\0", "latin1"),
    tiff,
    Buffer.from(SECRET, "latin1"),
  ]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  const photo = Buffer.concat([
    jpeg.subarray(0, 2),
    head,
    body,
    jpeg.subarray(2),
  ]);
  const f = await fixture();
  await f.adapter.submit(
    adapterRequest(f, [
      {
        role: "firstFrame",
        asset: {
          assetVersionId: randomUUID(),
          sha256: createHash("sha256").update(photo).digest("hex"),
          mediaType: "image/jpeg",
        },
      },
    ]),
    opening(photo),
  );
  const { firstFrame } = f.pushes[0].brief;
  const sent = Buffer.from(firstFrame.data, "base64");
  assert.equal(firstFrame.mediaType, "image/png");
  assert.ok(!sent.includes(SECRET));
  assert.ok(!JSON.stringify(f.pushes[0]).includes(SECRET));
  assert.equal(
    firstFrame.orientation,
    undefined,
    "no word of its file comes beside it",
  );
  await f.close();
});

// Fine detail, as a real photo has: as a PNG it is far more than a script can carry.
const NOISY_FILE = path.join(stillRoot, "noisy.png");
execFileSync(
  mediaTools().ffmpeg,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `gradients=s=${recipe.width}x${recipe.height}:seed=7`,
    "-vf",
    "noise=alls=14:allf=u:all_seed=7,format=rgb24",
    "-frames:v",
    "1",
    NOISY_FILE,
  ],
  { windowsHide: true },
);
const NOISY = readFileSync(NOISY_FILE);
const noisyRef = () => ({
  assetVersionId: randomUUID(),
  sha256: createHash("sha256").update(NOISY).digest("hex"),
  mediaType: "image/png",
});

test("a picture too large as a PNG goes as a JPEG with only a picture in it, and fits", async () => {
  const f = await fixture();
  await f.adapter.submit(
    adapterRequest(f, [{ role: "firstFrame", asset: noisyRef() }]),
    opening(NOISY),
  );
  assert.equal(f.pushes.length, 1);
  assert.ok(f.pushes[0].scriptBytes <= SCRIPT_BYTES, f.pushes[0].scriptBytes);
  const { firstFrame } = f.pushes[0].brief;
  assert.equal(firstFrame.mediaType, "image/jpeg");
  const sent = Buffer.from(firstFrame.data, "base64");
  assert.equal(
    firstFrame.sha256,
    createHash("sha256").update(sent).digest("hex"),
  );
  assert.ok(
    jpegHoldsOnlyAPicture(sent, { width: recipe.width, height: recipe.height }),
  );
  // Nor does the person's picture stay here, in any form.
  const left = readdirSync(path.join(f.root, "tmp"), {
    recursive: true,
    withFileTypes: true,
  }).filter((e) => e.isFile());
  assert.deepEqual(left, []);
  await f.close();
});

test("what a script cannot carry is refused, and nothing is sent", async () => {
  const f = await fixture();
  await assert.rejects(
    f.adapter.submit(
      {
        ...(adapterRequest(f, [
          { role: "firstFrame", asset: noisyRef() },
        ]) as object),
        prompt: "words ".repeat(170_000),
      } as never,
      opening(NOISY),
    ),
    /more than Kaggle accepts, so nothing was sent/,
  );
  assert.equal(f.pushes.length, 0);
  assert.ok(!f.asked.includes("push"));
  // It leaves nothing, and does not stop the next.
  const left = readdirSync(path.join(f.root, "tmp"), {
    recursive: true,
    withFileTypes: true,
  }).filter((e) => e.isFile());
  assert.deepEqual(left, []);
  await f.adapter.submit(
    adapterRequest(f, [{ role: "firstFrame", asset: noisyRef() }]),
    opening(NOISY),
  );
  assert.equal(f.pushes.length, 1);
  await f.close();
});

test("a picture's room is what a script can carry, by the byte", () => {
  const brief = (bytes: number, pad = 0) =>
    Buffer.byteLength(
      scriptWithBrief(`${"#".repeat(pad)}\nBRIEF = {}  # yamakan:brief\n`, {
        prompt: "A boat",
        seed: 7,
        runId: "r",
        firstFrame: {
          data: Buffer.alloc(bytes).toString("base64"),
          mediaType: "image/jpeg",
          sha256: "0".repeat(64),
        },
      }),
    );
  // Padding depends on where the bytes fall, so this holds at every remainder.
  for (const pad of [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  ]) {
    const room = imageRoom(brief(0, pad));
    for (const bytes of [room, room - 1, room - 2])
      assert.ok(brief(bytes, pad) <= SCRIPT_BYTES, `${pad} ${bytes}`);
    // And not much is left unused.
    assert.ok(brief(room + 32, pad) > SCRIPT_BYTES);
  }
  assert.ok(imageRoom(SCRIPT_BYTES) <= 0);
});

test("consent is asked again at the moment of sending, after the picture is prepared", async () => {
  const f = await fixture();
  let opened = 0;
  let read = false;
  let readBeforeAsked = false;
  await assert.rejects(
    f.adapter.submit(
      adapterRequest(f, [{ role: "firstFrame", asset: noisyRef() }]),
      {
        openAsset: () => {
          if (++opened > 1) {
            readBeforeAsked = read;
            throw new Error("consent was revoked just now");
          }
          return Readable.from(
            (function* () {
              yield NOISY;
              read = true;
            })(),
          );
        },
      } as never,
    ),
    /consent was revoked just now/,
  );
  assert.equal(opened, 2);
  assert.ok(readBeforeAsked, "after it was read, not before");
  assert.equal(f.pushes.length, 0);
  await f.close();
});

test("a picture that cannot be prepared is refused before consent is asked again", async () => {
  // So that second question comes after preparing it, which is what can take minutes.
  const f = await fixture();
  const bytes = Buffer.from("not a picture at all");
  let opened = 0;
  await assert.rejects(
    f.adapter.submit(
      adapterRequest(f, [
        {
          role: "firstFrame",
          asset: {
            assetVersionId: randomUUID(),
            sha256: createHash("sha256").update(bytes).digest("hex"),
            mediaType: "image/png",
          },
        },
      ]),
      {
        openAsset: () => {
          opened++;
          return Readable.from([bytes]);
        },
      } as never,
    ),
    /could not be prepared/,
  );
  assert.equal(opened, 1);
  assert.equal(f.pushes.length, 0);
  await f.close();
});

test("so is a prompt too long for a script, with no image", async () => {
  const f = await fixture();
  const text = KAGGLE_RECIPES.find(
    (r) => r.operation === undefined && r.offered,
  )!;
  await assert.rejects(
    f.adapter.submit(
      {
        ...(adapterRequest(f, []) as object),
        recipeId: text.id,
        operation: "textToVideo",
        prompt: "words ".repeat(170_000),
      } as never,
      opening(NOISY),
    ),
    /more than Kaggle accepts, so nothing was sent/,
  );
  assert.equal(f.pushes.length, 0);
  await f.close();
});

test("a last frame is refused, since this model would ignore it without saying", async () => {
  const f = await fixture();
  const answer = await f.adapter.submit(
    adapterRequest(f, [
      { role: "firstFrame", asset: frameRef },
      { role: "lastFrame", asset: frameRef },
    ]),
    opening(STILL),
  );
  assert.deepEqual(answer, { refused: "INPUT_UNSUPPORTED" });
  assert.equal(f.pushes.length, 0);
  await f.close();
});

test("a single last frame is refused too", async () => {
  const f = await fixture();
  const answer = await f.adapter.submit(
    adapterRequest(f, [{ role: "lastFrame", asset: frameRef }]),
    opening(STILL),
  );
  assert.deepEqual(answer, { refused: "INPUT_UNSUPPORTED" });
  assert.equal(f.pushes.length, 0);
  await f.close();
});

for (const push of ["lost", "refused"] as const)
  test(`after a ${push} push, the image's copy does not stay on this computer`, async () => {
    const f = await fixture([recipe.id], { push });
    await f.service.start(f.request).catch(() => {});
    const left = readdirSync(path.join(f.root, "tmp"), {
      recursive: true,
      withFileTypes: true,
    }).filter((e) => e.isFile());
    assert.deepEqual(left, []);
    assert.equal(f.pushes.length, 0);
    await f.close();
  });

test("no frame at all is refused", async () => {
  const f = await fixture();
  const answer = await f.adapter.submit(adapterRequest(f, []), opening(STILL));
  assert.deepEqual(answer, { refused: "INPUT_UNSUPPORTED" });
  await f.close();
});

test("bytes that are not the version started with are refused, before anything is sent", async () => {
  const f = await fixture();
  await assert.rejects(
    f.adapter.submit(
      adapterRequest(f, [{ role: "firstFrame", asset: frameRef }]),
      opening(Buffer.from("something else")),
    ),
    /not the version/,
  );
  assert.equal(f.pushes.length, 0);
  await f.close();
});

test("an image over the limit is refused, before anything is sent", async () => {
  const f = await fixture();
  await assert.rejects(
    f.adapter.submit(
      adapterRequest(f, [{ role: "firstFrame", asset: frameRef }]),
      opening(Buffer.alloc(FIRST_FRAME_BYTES + 1)),
    ),
    /can be up to 4 MB/,
  );
  assert.equal(f.pushes.length, 0);
  await f.close();
});

// That the read is where consent is checked is shown in generation-service.test.ts. This
// shows that read comes after the questions about the notebook, which can take minutes.
test("the image is read only after the notebook has been checked, privacy included", async () => {
  const f = await fixture([recipe.id], { exists: true });
  let askedBeforeRead: string[] = [];
  const context = {
    openAsset: () => {
      askedBeforeRead = [...f.asked];
      throw new Error("Consent has ended.");
    },
  } as never;
  const answer = f.adapter.submit(
    adapterRequest(f, [{ role: "firstFrame", asset: frameRef }]),
    context,
  );
  await assert.rejects(answer, /Consent has ended/);
  assert.ok(askedBeforeRead.includes("status"), "the notebook was checked");
  assert.ok(askedBeforeRead.includes("pull"), "and its privacy read");
  assert.equal(f.pushes.length, 0);
  await f.close();
});

// The script, on a stand-in for its GPU libraries.
const python = ["python3", "python"].find(
  (name) =>
    spawnSync(name, ["-c", "import sys; assert sys.version_info >= (3, 8)"], {
      windowsHide: true,
    }).status === 0,
);
const HARNESS = String.raw`
import base64, hashlib, json, os, subprocess, sys, types

out, script, mode = sys.argv[1:4]
source = open(script, encoding="utf-8").read()
frame = b"the bytes of a still"
digest = hashlib.sha256(frame).hexdigest()
brief = {"prompt": "A SECRET boat", "seed": 7, "runId": "r", "firstFrame": {
    "data": base64.b64encode(frame).decode(),
    "mediaType": "image/png",
    "sha256": digest if mode != "wrong-hash" else "0" * 64,
}}
line = "BRIEF = {}  # yamakan:brief"
assert source.count(line) == 1 and source.count('OUT = "/kaggle/working"') == 1
source = source.replace(line, "BRIEF = " + repr(brief))
source = source.replace('OUT = "/kaggle/working"', "OUT = " + repr(out))
assert source.count("MEMORY_SAMPLE_SECONDS = 5") == 1
source = source.replace("MEMORY_SAMPLE_SECONDS = 5", "MEMORY_SAMPLE_SECONDS = 0.01")
# What Kaggle's Linux host offers, in its own form, wherever this runs.
for name, text in {
    "meminfo": "MemTotal:       32000000 kB\nMemAvailable:    2000000 kB\n",
    "status": "Name:\tpython\nVmRSS:\t25000000 kB\n",
    "limit": "32212254720\n",
}.items():
    open(os.path.join(out, "fake-" + name), "w").write(text)
for real, name, uses in (("/proc/meminfo", "meminfo", 2), ("/proc/self/status", "status", 1),
                         ("/sys/fs/cgroup/memory.max", "limit", 1)):
    assert source.count('"' + real + '"') == uses, real
    source = source.replace('"' + real + '"', repr(os.path.join(out, "fake-" + name)))
real_dump = json.dump
def dying_dump(obj, f, **k):
    if obj.get("stage") == "decoding":
        f.write('{"half')
        f.flush()
        os._exit(137)
    real_dump(obj, f, **k)
if mode == "kill-while-writing":
    json.dump = dying_dump

subprocess.check_call = lambda *a, **k: 0
subprocess.run = lambda args, **k: types.SimpleNamespace(
    stdout="T4, 15360 MiB\n" if args[0] == "nvidia-smi" else "a\nb\n")
try:
    import resource
except ImportError:
    m = types.ModuleType("resource")
    m.RUSAGE_SELF = 0
    m.getrusage = lambda _: types.SimpleNamespace(ru_maxrss=1)
    sys.modules["resource"] = m

torch = types.ModuleType("torch")
torch.__version__ = "stand-in"
torch.float16 = torch.float32 = "f"
class NoGrad:
    def __enter__(self): return self
    def __exit__(self, *a): return False
torch.no_grad = NoGrad
torch.cuda = types.SimpleNamespace(empty_cache=lambda: None, max_memory_allocated=lambda _: 1)
class Generator:
    def __init__(self, device): pass
    def manual_seed(self, s): return s
torch.Generator = Generator
sys.modules["torch"] = torch

asked = {}
class Part:
    def to(self, _): return self
    def enable_tiling(self): pass
    def register_forward_pre_hook(self, hook): asked["hook"] = hook
    def enable_slicing(self): pass
class Pipe:
    text_encoder = Part()
    vae = Part()
    transformer = Part()
    @classmethod
    def from_pretrained(cls, *a, **k): return cls()
    def encode_prompt(self, **k):
        asked["encode"] = k.get("max_sequence_length")
        return "p", "n"
    def enable_model_cpu_offload(self, **k): pass
    def __call__(self, **k):
        asked["call"] = sorted(k)
        asked["image"] = k["image"]
        # As torch does: whatever a pre-hook returns replaces the model's inputs.
        before = dict(moved=None)
        Part.to = lambda part, where: (before.update(moved=where), part)[1]
        hook = asked.pop("hook")
        asked["hookReturned"] = repr(hook(self.transformer, ()))
        asked["vaeMovedTo"] = before["moved"]
        ending = k["callback_on_step_end"]
        asked["stepEnds"] = [ending(self, step, 0, {}) for step in range(k["num_inference_steps"])][-1]
        import time
        seen = {}
        for _ in range(3000):
            try:
                with open(os.path.join(out, "receipt.json")) as f:
                    seen = json.load(f)
            except (OSError, ValueError):
                seen = {}
            if "decoding" in seen.get("hostMemory", {}).get("byStage", {}):
                break
            time.sleep(0.01)
        asked["stageAtDecode"] = seen.get("stage")
        return types.SimpleNamespace(frames=[["frame"]])
diffusers = types.ModuleType("diffusers")
diffusers.AutoencoderKLWan = Pipe
diffusers.WanImageToVideoPipeline = Pipe
utils = types.ModuleType("diffusers.utils")
utils.export_to_video = lambda video, path, fps: open(path, "wb").write(b"video")
sys.modules["diffusers"] = diffusers
sys.modules["diffusers.utils"] = utils

class Opened:
    size = (320, 200)
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def convert(self, mode): return self
pil = types.ModuleType("PIL")
image = types.ModuleType("PIL.Image")
image.LANCZOS = 1
def opening(stream):
    asked["opened"] = stream.getvalue() == frame
    return Opened()
image.open = opening
ops = types.ModuleType("PIL.ImageOps")
def fit(picture, size, method):
    asked["fit"] = list(size)
    return "the fitted frame"
ops.fit = fit
pil.Image = image
pil.ImageOps = ops
sys.modules["PIL"] = pil
sys.modules["PIL.Image"] = image
sys.modules["PIL.ImageOps"] = ops

class Array:
    shape = (81, 480, 704, 3)
    def __getitem__(self, _): return self
    def std(self): return 9.0
    def astype(self, _): return self
numpy = types.ModuleType("numpy")
numpy.int16 = "i"
numpy.stack = lambda _: Array()
numpy.diff = lambda a, axis: a
class Abs:
    def mean(self): return 1.0
numpy.abs = lambda _: Abs()
sys.modules["numpy"] = numpy
imageio = types.ModuleType("imageio")
class Reader:
    def __iter__(self): return iter([])
    def close(self): pass
imageio.get_reader = lambda _: Reader()
sys.modules["imageio"] = imageio

try:
    exec(compile(source, script, "exec"), {"__name__": "__main__"})
finally:
    print("ASKED " + json.dumps(asked))
`;

function runScript(mode: "right" | "wrong-hash" | "kill-while-writing") {
  const out = mkdtempSync(path.join(tmpdir(), "first-frame-run-"));
  roots.push(out);
  const harness = path.join(out, "harness.py");
  writeFileSync(harness, HARNESS);
  const made = spawnSync(
    python!,
    [harness, out, `scripts/kaggle/${recipe.folder}/run.py`, mode],
    { encoding: "utf8", windowsHide: true, timeout: 60_000 },
  );
  return {
    status: made.status,
    stderr: made.stderr,
    stdout: made.stdout,
    asked: JSON.parse(/^ASKED (.*)$/m.exec(made.stdout)?.[1] ?? "null"),
    receipt: readFileSync(path.join(out, "receipt.json"), "utf8"),
    out,
  };
}

test(
  "the script gives the pipeline the frame it was sent, fitted, and keeps only its hash",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, stderr, stdout, asked, receipt, out } = runScript("right");
    const sent = Buffer.from("the bytes of a still").toString("base64");
    assert.ok(!stdout.includes(sent), "nor in what it prints");
    assert.ok(!stderr.includes(sent), "nor in what it prints");
    assert.equal(status, 0, stderr);
    assert.equal(asked.opened, true);
    assert.deepEqual(asked.fit, [recipe.width, recipe.height]);
    assert.equal(asked.image, "the fitted frame");
    assert.equal(asked.encode, 512);
    assert.equal(asked.vaeMovedTo, "cpu", "the VAE is sent off the GPU");
    assert.equal(
      asked.hookReturned,
      "None",
      "and the model's inputs are left alone",
    );
    assert.ok(!asked.call.includes("last_image"));
    assert.deepEqual(asked.stepEnds, {}, "the callback changes nothing");
    assert.equal(asked.stageAtDecode, "decoding");
    const kept = JSON.parse(receipt);
    assert.equal(kept.stage, "done");
    assert.equal(kept.verified, true);
    assert.deepEqual(kept.firstFrameSize, [320, 200]);
    assert.equal(typeof kept.decodingAfterSeconds, "number");
    assert.equal(kept.hostMemory.cgroupLimitBytes, 30 * 1024 ** 3);
    assert.equal(
      kept.hostMemory.byStage.decoding.lowestAvailableBytes,
      2000000 * 1024,
    );
    assert.equal(kept.hostMemory.highestRssBytes, 25000000 * 1024);
    assert.equal(
      kept.firstFrameSha256,
      createHash("sha256").update("the bytes of a still").digest("hex"),
    );
    assert.ok(
      !receipt.includes(Buffer.from("the bytes of a still").toString("base64")),
    );
    assert.ok(existsSync(path.join(out, recipe.output)));
  },
);

test(
  "the script makes nothing from a frame that is not the one it was sent",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, asked, receipt } = runScript("wrong-hash");
    assert.notEqual(status, 0);
    assert.equal(asked.call, undefined, "the pipeline was not reached");
    const kept = JSON.parse(receipt);
    assert.equal(kept.stage, "failed at reading the frame");
    assert.match(kept.error, /not the one this run was sent/);
  },
);

test(
  "a kill in the middle of a write leaves the last whole receipt",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = runScript("kill-while-writing");
    assert.equal(status, 137, stderr);
    assert.ok(
      ["generating", "decoding"].includes(JSON.parse(receipt).stage),
      receipt,
    );
  },
);
