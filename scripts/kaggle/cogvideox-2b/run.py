"""First real generation test: CogVideoX-2b on a Kaggle GPU, on Kaggle's disk only.

Pinned to one model revision. It writes the video and a receipt to the working
folder: versions, GPU, memory, timings, and the video's hash and decoded frame
count. `verified` is a rough check of frame count, contrast in the first frame and
change between frames. Noise would pass it, and it says nothing about the prompt, so
real inference rests on this code path and the log, and fit to the prompt on looking.
It writes the receipt as it goes, with memory for each stage, so a run that runs out of
memory still says how far it got.
It uses no token or secret, and its weights never leave Kaggle.
"""
import hashlib
import json
import os
import subprocess
import resource
import sys
import threading
import time
import traceback

MODEL = "zai-org/CogVideoX-2b"
REVISION = "1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01"
LICENSE = "apache-2.0"
BRIEF = {}  # yamakan:brief
PROMPT = BRIEF.get("prompt", "A paper boat floats slowly along a calm stream in soft morning light.")
SEED = BRIEF.get("seed", 42)
STEPS = 50
FRAMES = 49
FPS = 8
OUT = "/kaggle/working"
MEMORY_SAMPLE_SECONDS = 5
PACKAGES = [
    "diffusers==0.35.1",
    "transformers==4.57.1",
    "accelerate==1.10.1",
    "sentencepiece==0.2.1",
    "imageio==2.37.0",
    "imageio-ffmpeg==0.6.0",
]

receipt = {
    "format": "yamakan.generation-receipt/v1",
    "runId": BRIEF.get("runId"),
    "model": MODEL,
    "revision": REVISION,
    "license": LICENSE,
    "prompt": PROMPT,
    "seed": SEED,
    "steps": STEPS,
    "frames": FRAMES,
    "fps": FPS,
    "packages": PACKAGES,
    "verified": False,
    "stage": "start",
    "hostMemory": {},
}


saving = threading.Lock()


def note(text):
    try:
        print(text, file=sys.stderr)
    except Exception:
        pass


# Whole or not at all: a kill can come at any moment, and what is left must read. Those
# in between may fail. The first and the last may not, and they try harder: the first
# stops the run before the model loads, and the last is the run's own result.
def save(attempts=1):
    target = os.path.join(OUT, "receipt.json")
    for attempt in range(attempts):
        try:
            with saving:
                with open(target + ".part", "w") as f:
                    json.dump(receipt, f, indent=2)
                os.replace(target + ".part", target)
            return True
        except Exception as error:
            note(f"Could not write the receipt: {type(error).__name__}")
            if attempt + 1 < attempts:
                time.sleep(2)
    return False


def read_kb(path, field):
    with open(path) as f:
        for line in f:
            if line.startswith(field + ":"):
                return int(line.split()[1]) * 1024
    return None


def read_number(path):
    with open(path) as f:
        return int(f.read().strip())


def read_oom_kills():
    with open("/sys/fs/cgroup/memory.events") as f:
        for line in f:
            if line.startswith("oom_kill "):
                return int(line.split()[1])
    return None


# Each is what this host happens to offer: one it lacks is left out, not guessed.
def sample(read, *args):
    try:
        return read(*args)
    except Exception:
        return None


# As in the text script: this writes as it goes, how far the run got and how much memory
# was left, for the whole run and for each stage. Reading it changes no output.
def watch_memory():
    seen = {"samples": 0, "byStage": {}}
    while True:
        # It has one job, and no failure of it may reach the run or stop it watching.
        try:
            take_sample(seen)
        except Exception as error:
            note(f"Could not sample memory: {type(error).__name__}")
        time.sleep(MEMORY_SAMPLE_SECONDS)


def take_sample(seen):
    available = sample(read_kb, "/proc/meminfo", "MemAvailable")
    rss = sample(read_kb, "/proc/self/status", "VmRSS")
    if available is not None and available < seen.get(
        "lowestAvailableBytes", float("inf")
    ):
        seen["lowestAvailableBytes"] = available
        seen["stageAtLowest"] = receipt["stage"]
    if rss is not None and rss > seen.get("highestRssBytes", 0):
        seen["highestRssBytes"] = rss
        seen["stageAtHighest"] = receipt["stage"]
    stage = seen["byStage"].setdefault(receipt["stage"], {})
    if available is not None:
        stage["lowestAvailableBytes"] = min(
            available, stage.get("lowestAvailableBytes", available)
        )
    if rss is not None:
        stage["highestRssBytes"] = max(rss, stage.get("highestRssBytes", rss))
    seen["samples"] += 1
    seen.update(
        {
            name: value
            for name, value in {
                "totalBytes": sample(read_kb, "/proc/meminfo", "MemTotal"),
                "cgroupLimitBytes": sample(read_number, "/sys/fs/cgroup/memory.max"),
                "cgroupPeakBytes": sample(
                    read_number, "/sys/fs/cgroup/memory.peak"
                ),
                "cgroupOomKills": sample(read_oom_kills),
            }.items()
            if value is not None
        }
    )
    # Replaced, never added, with nothing in it changed later, so this cannot disturb a
    # save in the other thread.
    receipt["hostMemory"] = {
        **seen,
        "byStage": {name: dict(s) for name, s in seen["byStage"].items()},
    }
    save()


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()


if not save(attempts=5):
    sys.exit("The receipt could not be written, so the run did not start.")
try:
    threading.Thread(target=watch_memory, daemon=True).start()
except Exception as error:
    note(f"Could not start sampling memory: {type(error).__name__}")
receipt["gpus"] = sh(
    "nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"
).splitlines()
receipt["disk"] = sh("df", "-h", "/kaggle/working").splitlines()[-1:]
if not receipt["gpus"]:
    receipt["stage"] = "no GPU"
    save(attempts=5)
    sys.exit("No GPU was given to this notebook.")
save()

subprocess.check_call(
    [sys.executable, "-m", "pip", "install", "--quiet", *PACKAGES]
)

receipt["python"] = sys.version.split()[0]
receipt["stage"] = "installed"
save()

import numpy as np  # noqa: E402
import torch  # noqa: E402
from diffusers import CogVideoXPipeline  # noqa: E402
from diffusers.utils import export_to_video  # noqa: E402
import imageio  # noqa: E402

receipt["torch"] = torch.__version__
receipt["cuda"] = torch.version.cuda
try:
    receipt["stage"] = "loading"
    save()
    started = time.time()
    pipe = CogVideoXPipeline.from_pretrained(
        MODEL, revision=REVISION, torch_dtype=torch.float16
    )
    pipe.enable_model_cpu_offload(gpu_id=0)
    pipe.vae.enable_tiling()
    pipe.vae.enable_slicing()
    receipt["loadSeconds"] = round(time.time() - started, 1)
    receipt["stage"] = "generating"
    save()


    # The last step's end is where decoding begins, with nothing else changed.
    def at_step_end(_pipe, step, _timestep, _inputs):
        if step == STEPS - 1:
            receipt["decodingAfterSeconds"] = round(time.time() - started, 1)
            receipt["stage"] = "decoding"
            save()
        return {}


    started = time.time()
    video = pipe(
        prompt=PROMPT,
        num_inference_steps=STEPS,
        num_frames=FRAMES,
        guidance_scale=6.0,
        generator=torch.Generator(device="cpu").manual_seed(SEED),
        callback_on_step_end=at_step_end,
    ).frames[0]
    receipt["generateSeconds"] = round(time.time() - started, 1)
    receipt["peakHostBytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
    receipt["peakGpuBytes"] = torch.cuda.max_memory_allocated(0)
    receipt["stage"] = "exporting"
    save()
    path = os.path.join(OUT, "first-video.mp4")
    export_to_video(video, path, fps=FPS)

except Exception as error:
    receipt["stage"] = f"failed at {receipt['stage']}"
    receipt["error"] = f"{type(error).__name__}: {error}"[:1000]
    receipt["trace"] = traceback.format_exc()[-1500:]
    receipt["peakGpuBytes"] = torch.cuda.max_memory_allocated(0)
    save(attempts=5)
    sys.exit(f"Stopped: {receipt['error']}")

with open(path, "rb") as f:
    receipt["sha256"] = hashlib.sha256(f.read()).hexdigest()
receipt["bytes"] = os.path.getsize(path)

# Decoded back from the file: the frames, and that they are a picture that moves.
reader = imageio.get_reader(path)
decoded = np.stack([frame for frame in reader])
reader.close()
receipt["decodedFrames"] = int(decoded.shape[0])
receipt["size"] = [int(decoded.shape[2]), int(decoded.shape[1])]
receipt["spatialStd"] = round(float(decoded[0].std()), 2)
receipt["temporalDiff"] = round(float(np.abs(np.diff(decoded.astype(np.int16), axis=0)).mean()), 3)
receipt["verified"] = (
    receipt["decodedFrames"] == FRAMES
    and receipt["spatialStd"] > 5
    and receipt["temporalDiff"] > 0.1
)
receipt["stage"] = "done"
if not save(attempts=5):
    sys.exit("The video was made, and its receipt could not be written.")
print(json.dumps(receipt, indent=2))
if not receipt["verified"]:
    sys.exit("The video did not pass its own checks.")
