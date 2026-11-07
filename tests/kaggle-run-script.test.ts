// The Wan script itself, on a stand-in for its GPU libraries. It shows the script's own
// logic: what it asks of the pipeline and what a kill leaves. It says nothing of whether
// a real run fits in memory, or makes the same video: only a real run can say that.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { killedAt } from "../core/engines/kaggle.ts";

const SCRIPT = "scripts/kaggle/wan22-ti2v-5b/run.py";
const source = readFileSync(SCRIPT, "utf8");
const python = ["python3", "python"].find(
  (name) =>
    spawnSync(name, ["-c", "import sys; assert sys.version_info >= (3, 8)"], {
      windowsHide: true,
    }).status === 0,
);
const roots: string[] = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

// Asserted of what the script is, since the stand-in cannot hold it to these. Each changes
// a real video's bytes, or what it can do: see docs/evidence/ultimate/first-ai-video.md.
test("what makes the same video stays pinned", () => {
  for (const pin of [
    "max_sequence_length=512",
    'REVISION = "b8fff7315c768468a5333511427288870b2e9635"',
    "STEPS = 30",
    "FRAMES = 81",
    "WIDTH = 704",
    "HEIGHT = 480",
    "guidance_scale=5.0",
    '"diffusers==0.36.0"',
    "pipe.text_encoder = None",
    "pipe.vae.enable_tiling()",
    "pipe.vae.enable_slicing()",
    'NEGATIVE = "blurry, low quality, distorted, static"',
    "FPS = 24",
    "torch_dtype=torch.float16",
    "torch_dtype=torch.float32",
    '"transformers==4.57.1"',
    '"accelerate==1.10.1"',
    'torch.Generator(device="cpu").manual_seed(SEED)',
  ])
    assert.ok(source.includes(pin), pin);
});

// Stands in for pip, the GPU libraries and the video reader, then runs the real script.
const HARNESS = String.raw`
import json, os, runpy, subprocess, sys, types

out, script, mode = sys.argv[1:4]
source = open(script, encoding="utf-8").read()
assert source.count('OUT = "/kaggle/working"') == 1
source = source.replace('OUT = "/kaggle/working"', "OUT = " + repr(out))
assert source.count("MEMORY_SAMPLE_SECONDS = 5") == 1
# A failure's receipt must be its own save's, so then the watcher waits past the run.
source = source.replace("MEMORY_SAMPLE_SECONDS = 5",
    "MEMORY_SAMPLE_SECONDS = " + ("3600" if mode == "pipeline-raises" else "0.01"))
assert source.count("time.sleep(2)") == 1
source = source.replace("time.sleep(2)", "time.sleep(0.01)")
assert source.count('"/proc/meminfo"') == 2 and source.count('"/proc/self/status"') == 1
# What Kaggle's Linux host offers, in its own form, wherever this runs.
def set_memory(available_kb, rss_kb):
    import time
    for attempt in range(100):
        try:
            with open(os.path.join(out, "fake-meminfo"), "w") as f:
                f.write(f"MemTotal:       32000000 kB\nMemAvailable:    {available_kb} kB\n")
            with open(os.path.join(out, "fake-status"), "w") as f:
                f.write(f"Name:\tpython\nVmRSS:\t{rss_kb} kB\n")
            return
        except PermissionError:
            time.sleep(0.05)
    os._exit(99)
set_memory(30000000, 1000000)
# Until the sampling thread has written what is wanted, however busy this machine.
def wait_for(check):
    if mode == "pipeline-raises":
        return {}  # Nothing is sampled then: see above.
    import time
    seen = {}
    for _ in range(3000):
        try:
            with open(os.path.join(out, "receipt.json")) as f:
                seen = json.load(f)
        except (OSError, ValueError):
            seen = {}
        if seen and check(seen):
            return seen
        time.sleep(0.01)
    print("WAITED IN VAIN", file=sys.stderr)
    sys.stderr.flush()
    os._exit(99)
def in_stage(stage, low_kb, rss_kb):
    def check(seen):
        figures = seen["hostMemory"].get("byStage", {}).get(stage, {})
        return (figures.get("lowestAvailableBytes") == low_kb * 1024
                and figures.get("highestRssBytes") == rss_kb * 1024)
    return check
source = source.replace('"/proc/meminfo"', repr(os.path.join(out, "fake-meminfo")))
source = source.replace('"/proc/self/status"', repr(os.path.join(out, "fake-status")))

real_replace = os.replace
real_dump = json.dump
failed = {"last": 0}
# The last save is the one that says done: this has it fail, however often it asks.
def failing_replace(a, b):
    with open(a) as f:
        if mode == "first-save-fails" or (mode.startswith("last-save") and json.load(f)["stage"] == "done"):
            failed["last"] += 1
            if mode != "last-save-fails-four" or failed["last"] <= 4:
                raise OSError(28, "No space left on device")
    real_replace(a, b)
if mode == "first-save-fails" or mode.startswith("last-save"):
    os.replace = failing_replace
def dying_dump(obj, f, **k):
    if obj.get("stage") == "decoding":
        f.write('{"half')
        f.flush()
        os._exit(137)
    real_dump(obj, f, **k)
if mode == "kill-while-writing":
    json.dump = dying_dump

subprocess.check_call = lambda *a, **k: 0
real_run = subprocess.run
def fake_run(args, **kwargs):
    gpu = "" if mode == "no-gpu" else "T4, 15360 MiB\n"
    r = types.SimpleNamespace(stdout=gpu if args[0] == "nvidia-smi" else "a\nb\n")
    return r
subprocess.run = fake_run

if "resource" not in sys.modules:
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
    def enable_slicing(self): pass
class Pipe:
    text_encoder = Part()
    vae = Part()
    @classmethod
    def from_pretrained(cls, *a, **k):
        asked["loaded"] = True
        set_memory(1000000, 28000000)
        wait_for(in_stage("loading", 1000000, 28000000))
        return cls()
    def encode_prompt(self, **k):
        asked["encode"] = k.get("max_sequence_length")
        return "p", "n"
    def enable_model_cpu_offload(self, **k): pass
    def __call__(self, **k):
        asked["call"] = sorted(k)
        asked["values"] = {n: k[n] for n in ("height", "width", "num_frames", "num_inference_steps", "guidance_scale")}
        ending = k["callback_on_step_end"]
        if mode == "pipeline-raises":
            raise RuntimeError("words of the paper boat")
        set_memory(20000000, 8000000)
        wait_for(lambda seen: "generating" in seen["hostMemory"].get("byStage", {}))
        if mode == "save-fails":
            def failing(a, b):
                os.replace = real_replace
                raise OSError(28, "No space left on device")
            os.replace = failing
        for step in range(k["num_inference_steps"]):
            assert ending(self, step, 0, {}) == {}
        # Memory that moves within the stage, so its lowest and highest are not just its last.
        set_memory(6000000, 17000000)
        wait_for(in_stage("decoding", 6000000, 17000000))
        set_memory(5000000, 18000000)
        wait_for(in_stage("decoding", 5000000, 18000000))
        set_memory(7000000, 16000000)
        # Counted after the change, and one more than a sample already under way.
        samples = wait_for(lambda seen: True)["hostMemory"].get("samples", 0)
        seen = wait_for(lambda seen: seen["hostMemory"].get("samples", 0) >= samples + 2)
        asked["stageAtDecode"] = seen.get("stage")
        if mode == "kill":
            os._exit(137)
        return types.SimpleNamespace(frames=[["frame"]])
diffusers = types.ModuleType("diffusers")
diffusers.AutoencoderKLWan = Pipe
diffusers.WanPipeline = Pipe
utils = types.ModuleType("diffusers.utils")
def export(video, path, fps):
    if mode == "kill-exporting":
        os._exit(137)
    open(path, "wb").write(b"video")
utils.export_to_video = export
sys.modules["diffusers"] = diffusers
sys.modules["diffusers.utils"] = utils

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
    if failed["last"]:
        asked["failedWrites"] = failed["last"]
    print("ASKED " + json.dumps(asked))
`;

function run(
  mode:
    | "finish"
    | "kill"
    | "kill-while-writing"
    | "kill-exporting"
    | "pipeline-raises"
    | "no-gpu"
    | "save-fails"
    | "first-save-fails"
    | "last-save-fails"
    | "last-save-fails-four",
) {
  const out = mkdtempSync(path.join(tmpdir(), "yamakan-run-script-"));
  roots.push(out);
  const harness = path.join(out, "harness.py");
  writeFileSync(harness, HARNESS);
  const made = spawnSync(python!, [harness, out, SCRIPT, mode], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 240_000,
  });
  const asked = JSON.parse(/^ASKED (.*)$/m.exec(made.stdout)?.[1] ?? "null");
  return {
    status: made.status,
    stderr: made.stderr,
    asked,
    receipt: existsSync(path.join(out, "receipt.json"))
      ? JSON.parse(readFileSync(path.join(out, "receipt.json"), "utf8"))
      : null,
    out,
  };
}

test(
  "a killed run leaves a whole receipt, saying it reached decoding",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, out, stderr } = run("kill");
    assert.equal(status, 137, stderr);
    assert.equal(receipt.stage, "decoding");
    assert.ok(!existsSync(path.join(out, "wan-video.mp4")));
    assert.ok(receipt.hostMemory.samples >= 1);
    assert.equal(receipt.hostMemory.lowestAvailableBytes, 1000000 * 1024);
    assert.equal(receipt.hostMemory.stageAtLowest, "loading");
    assert.equal(receipt.hostMemory.highestRssBytes, 28000000 * 1024);
    assert.equal(receipt.hostMemory.stageAtHighest, "loading");
    assert.deepEqual(receipt.hostMemory.byStage.loading, {
      lowestAvailableBytes: 1000000 * 1024,
      highestRssBytes: 28000000 * 1024,
    });
    assert.deepEqual(receipt.hostMemory.byStage.decoding, {
      lowestAvailableBytes: 5000000 * 1024,
      highestRssBytes: 18000000 * 1024,
    });
    assert.equal(receipt.peakHostBytes, undefined);
    assert.ok(!stderr.includes("Traceback"), stderr);
    // What this writes is what the page reads.
    assert.match(killedAt(receipt), /reached decoding/);
    assert.match(killedAt(receipt), /during loading, 1\.0 GiB of 30\.5 GiB/);
    assert.match(killedAt(receipt), /During decoding, the lowest was 4\.8 GiB/);
  },
);

test(
  "a kill in the middle of a write leaves the last whole receipt",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("kill-while-writing");
    assert.equal(status, 137, stderr);
    // It read whole, or this would have thrown. The sampling thread may have finished one
    // saying decoding just before the kill, which is just as true.
    assert.ok(
      ["generating", "decoding"].includes(receipt.stage),
      receipt.stage,
    );
  },
);

test(
  "a kill while exporting says so, with the peaks read by then",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("kill-exporting");
    assert.equal(status, 137, stderr);
    assert.equal(receipt.stage, "exporting");
    assert.equal(typeof receipt.peakHostBytes, "number");
    assert.equal(typeof receipt.decodingAfterSeconds, "number");
  },
);

test(
  "a failure says what failed in its own fields, and only there",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("pipeline-raises");
    assert.equal(status, 1, stderr);
    assert.equal(receipt.stage, "failed at generating");
    assert.match(receipt.error, /words of the paper boat/);
    assert.ok(!JSON.stringify(receipt.hostMemory).includes("words of"));
  },
);

test(
  "a notebook given no GPU says so, and loads nothing",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, asked, stderr } = run("no-gpu");
    assert.equal(status, 1, stderr);
    assert.match(stderr, /No GPU was given/);
    assert.equal(receipt.stage, "no GPU");
    assert.deepEqual(asked, {});
  },
);

test(
  "a run whose receipt cannot be written at the start stops before the model loads",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, asked, stderr } = run("first-save-fails");
    assert.equal(status, 1, stderr);
    assert.match(stderr, /The receipt could not be written/);
    assert.equal(receipt, null);
    assert.deepEqual(asked, { failedWrites: 5 });
  },
);

test(
  "the last receipt tries again, and a video it cannot record is not a success",
  { skip: python ? false : "no Python here" },
  () => {
    const again = run("last-save-fails-four");
    assert.equal(again.status, 0, again.stderr);
    assert.equal(again.receipt.stage, "done");
    const never = run("last-save-fails");
    assert.equal(never.status, 1, never.stderr);
    assert.match(never.stderr, /its receipt could not be written/);
    assert.notEqual(never.receipt.stage, "done");
  },
);

test(
  "a receipt that cannot be written partway does not fail the run",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("save-fails");
    assert.equal(status, 0, stderr);
    assert.match(stderr, /Could not write the receipt: OSError/);
    assert.equal(receipt.stage, "done");
    assert.equal(receipt.verified, true);
  },
);

test(
  "a run that finishes asks the pipeline what it always did, and ends done",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, asked, stderr } = run("finish");
    assert.equal(status, 0, stderr);
    assert.equal(receipt.stage, "done");
    assert.equal(receipt.verified, true);
    assert.equal(asked.encode, 512);
    assert.equal(asked.stageAtDecode, "decoding");
    assert.equal(typeof receipt.decodingAfterSeconds, "number");
    assert.deepEqual(asked.values, {
      height: 480,
      width: 704,
      num_frames: 81,
      num_inference_steps: 30,
      guidance_scale: 5,
    });
    assert.deepEqual(asked.call, [
      "callback_on_step_end",
      "generator",
      "guidance_scale",
      "height",
      "negative_prompt_embeds",
      "num_frames",
      "num_inference_steps",
      "prompt_embeds",
      "width",
    ]);
  },
);
