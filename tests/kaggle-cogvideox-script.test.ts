// The CogVideoX script itself, on a stand-in for its GPU libraries. It shows the script's own
// logic: what it asks of the pipeline and what a kill leaves. Only a real run says whether it
// fits in memory, or what video it makes.
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
import { KAGGLE_RECIPES } from "../core/engines/kaggle.ts";

const recipe = KAGGLE_RECIPES.find((r) => r.id === "kaggle-cogvideox-2b")!;
const SCRIPT = `scripts/kaggle/${recipe.folder}/run.py`;
const python = ["python3", "python"].find(
  (name) =>
    spawnSync(name, ["-c", "import sys; assert sys.version_info >= (3, 8)"], {
      windowsHide: true,
    }).status === 0,
);
const roots: string[] = [];
after(() => {
  for (const r of roots)
    try {
      rmSync(r, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // Windows can still hold a folder: tidying up is not what this tests.
    }
});

test("its recipe is offered, since its own run from Yamakan passed", () => {
  assert.equal(recipe.offered, true);
});

// Stands in for pip, the GPU libraries and the video reader, then runs the real script.
const HARNESS = String.raw`
import json, os, sys, types, subprocess

out, script, mode = sys.argv[1:4]
source = open(script, encoding="utf-8").read()
line = "BRIEF = {}  # yamakan:brief"
assert source.count(line) == 1 and source.count('OUT = "/kaggle/working"') == 1
source = source.replace(line, "BRIEF = " + repr({"prompt": "A boat", "seed": 7, "runId": "r"}))
source = source.replace('OUT = "/kaggle/working"', "OUT = " + repr(out))
assert source.count("MEMORY_SAMPLE_SECONDS = 5") == 1
# A failure's receipt must be its own save's, so then the watcher waits past the run.
source = source.replace("MEMORY_SAMPLE_SECONDS = 5",
    "MEMORY_SAMPLE_SECONDS = " + ("3600" if mode == "pipeline-raises" else "0.01"))
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
torch.version = types.SimpleNamespace(cuda="stand-in")
torch.float16 = "f"
torch.cuda = types.SimpleNamespace(max_memory_allocated=lambda _: 1)
class Generator:
    def __init__(self, device): pass
    def manual_seed(self, s): return s
torch.Generator = Generator
sys.modules["torch"] = torch

asked = {}
class Part:
    def enable_tiling(self): pass
    def enable_slicing(self): pass
class Pipe:
    vae = Part()
    @classmethod
    def from_pretrained(cls, *a, **k): return cls()
    def enable_model_cpu_offload(self, **k): pass
    def __call__(self, **k):
        asked["call"] = sorted(k)
        asked["values"] = {n: k[n] for n in ("num_inference_steps", "num_frames", "guidance_scale", "prompt")}
        if mode == "pipeline-raises":
            raise RuntimeError("words of the boat")
        ending = k["callback_on_step_end"]
        asked["stepEnds"] = [ending(self, s, 0, {}) for s in range(k["num_inference_steps"])][-1]
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
        if mode == "kill":
            os._exit(137)
        return types.SimpleNamespace(frames=[["frame"]])
diffusers = types.ModuleType("diffusers")
diffusers.CogVideoXPipeline = Pipe
utils = types.ModuleType("diffusers.utils")
utils.export_to_video = lambda video, path, fps: open(path, "wb").write(b"video")
sys.modules["diffusers"] = diffusers
sys.modules["diffusers.utils"] = utils

class Array:
    shape = (49, 480, 720, 3)
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

function run(
  mode: "finish" | "kill" | "kill-while-writing" | "pipeline-raises",
) {
  const out = mkdtempSync(path.join(tmpdir(), "cogvideox-run-"));
  roots.push(out);
  const harness = path.join(out, "harness.py");
  writeFileSync(harness, HARNESS);
  const made = spawnSync(python!, [harness, out, SCRIPT, mode], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
  });
  return {
    status: made.status,
    stderr: made.stderr,
    asked: JSON.parse(/^ASKED (.*)$/m.exec(made.stdout)?.[1] ?? "null"),
    receipt: JSON.parse(readFileSync(path.join(out, "receipt.json"), "utf8")),
    out,
  };
}

test(
  "a run that finishes asks what it always did, and writes its figures by stage",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, asked, stderr, out } = run("finish");
    assert.equal(status, 0, stderr);
    assert.equal(receipt.stage, "done");
    assert.equal(receipt.verified, true);
    assert.deepEqual(asked.values, {
      num_inference_steps: 50,
      num_frames: 49,
      guidance_scale: 6,
      prompt: "A boat",
    });
    assert.deepEqual(asked.stepEnds, {}, "the callback changes nothing");
    assert.equal(asked.stageAtDecode, "decoding");
    assert.equal(typeof receipt.decodingAfterSeconds, "number");
    assert.equal(receipt.hostMemory.cgroupLimitBytes, 30 * 1024 ** 3);
    assert.equal(
      receipt.hostMemory.byStage.decoding.lowestAvailableBytes,
      2000000 * 1024,
    );
    assert.ok(existsSync(path.join(out, recipe.output)));
  },
);

test(
  "a killed run leaves a whole receipt, saying it reached decoding",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("kill");
    assert.equal(status, 137, stderr);
    assert.equal(receipt.stage, "decoding");
    assert.equal(receipt.hostMemory.highestRssBytes, 25000000 * 1024);
  },
);

test(
  "a kill in the middle of a write leaves the last whole receipt",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("kill-while-writing");
    assert.equal(status, 137, stderr);
    assert.ok(
      ["generating", "decoding"].includes(receipt.stage),
      receipt.stage,
    );
  },
);

test(
  "a failure says where it was, in its own fields only",
  { skip: python ? false : "no Python here" },
  () => {
    const { status, receipt, stderr } = run("pipeline-raises");
    assert.equal(status, 1, stderr);
    assert.equal(receipt.stage, "failed at generating");
    assert.match(receipt.error, /words of the boat/);
    assert.ok(!JSON.stringify(receipt.hostMemory).includes("words of"));
  },
);
