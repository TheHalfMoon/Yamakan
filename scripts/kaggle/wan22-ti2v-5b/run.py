"""Wan2.2-TI2V-5B on a Kaggle GPU, on Kaggle's disk only: can it run here at all?

Pinned to one model revision, with CPU offload and half precision. Short and small
on purpose: the question is whether it fits a T4, and what it costs. It writes a
receipt at every stage, so a run that runs out of memory still says how far it got.
`verified` is a rough check; fit to the prompt is judged by looking.
It uses no token or secret, and its weights never leave Kaggle.
"""
import hashlib
import json
import gc
import os
import resource
import subprocess
import sys
import threading
import time
import traceback

MODEL = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
REVISION = "b8fff7315c768468a5333511427288870b2e9635"
LICENSE = "apache-2.0"
BRIEF = {}  # yamakan:brief
PROMPT = BRIEF.get("prompt", "A paper boat floats slowly along a calm stream in soft morning light.")
NEGATIVE = "blurry, low quality, distorted, static"
SEED = BRIEF.get("seed", 42)
STEPS = 30
FRAMES = 81
FPS = 24
WIDTH = 704
HEIGHT = 480
OUT = "/kaggle/working"
MEMORY_SAMPLE_SECONDS = 5
PACKAGES = [
    "diffusers==0.36.0",
    "transformers==4.57.1",
    "accelerate==1.10.1",
    "sentencepiece==0.2.1",
    "ftfy==6.3.1",
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
    "negativePrompt": NEGATIVE,
    "seed": SEED,
    "steps": STEPS,
    "frames": FRAMES,
    "fps": FPS,
    "size": [WIDTH, HEIGHT],
    "packages": PACKAGES,
    "verified": False,
    "stage": "start",
    "hostMemory": {},
}


saving = threading.Lock()


# Whole or not at all: a kill can come at any moment, and what is left must read. Only
# the last one has to land, and it tries harder: no other can be why a run fails.
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
            print(f"Could not write the receipt: {type(error).__name__}", file=sys.stderr)
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


# A killed process cannot report its own end, and the peak read after the pipeline
# returns never happens if it dies decoding. So this writes as it goes: how far the run
# got, and how much memory was left when it was lowest. Reading it changes no output.
def watch_memory():
    seen = {"samples": 0}
    while True:
        # It has one job, and no failure of it may reach the run or stop it watching.
        try:
            take_sample(seen)
        except Exception as error:
            print(f"Could not sample memory: {type(error).__name__}", file=sys.stderr)
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
    seen["samples"] += 1
    seen.update(
        {
            name: value
            for name, value in {
                "totalBytes": sample(read_kb, "/proc/meminfo", "MemTotal"),
                "cgroupPeakBytes": sample(
                    read_number, "/sys/fs/cgroup/memory.peak"
                ),
                "cgroupOomKills": sample(read_oom_kills),
            }.items()
            if value is not None
        }
    )
    # Replaced, never added, so this cannot disturb a save in the other thread.
    receipt["hostMemory"] = dict(seen)
    save()


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()


save()
threading.Thread(target=watch_memory, daemon=True).start()
receipt["gpus"] = sh(
    "nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"
).splitlines()
receipt["memory"] = sh("free", "-g").splitlines()[1:2]
receipt["disk"] = sh("df", "-h", "/kaggle/working").splitlines()[-1:]
if not receipt["gpus"]:
    receipt["stage"] = "no GPU"
    save()
    sys.exit("No GPU was given to this notebook.")
save()

subprocess.check_call(
    [sys.executable, "-m", "pip", "install", "--quiet", *PACKAGES]
)
receipt["python"] = sys.version.split()[0]
receipt["stage"] = "installed"
save()

import imageio  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
from diffusers import AutoencoderKLWan, WanPipeline  # noqa: E402
from diffusers.utils import export_to_video  # noqa: E402

receipt["torch"] = torch.__version__
try:
    receipt["stage"] = "loading"
    save()
    started = time.time()
    vae = AutoencoderKLWan.from_pretrained(
        MODEL, subfolder="vae", revision=REVISION, torch_dtype=torch.float32
    )
    pipe = WanPipeline.from_pretrained(
        MODEL, vae=vae, revision=REVISION, torch_dtype=torch.float16
    )
    # The text encoder is about 10 GB and is only needed once. One run in five was
    # killed while decoding, so it goes before the rest is loaded onto the GPU.
    pipe.text_encoder.to("cuda:0")
    with torch.no_grad():
        prompt_embeds, negative_embeds = pipe.encode_prompt(
            prompt=PROMPT,
            negative_prompt=NEGATIVE,
            do_classifier_free_guidance=True,
            device="cuda:0",
            # What the pipeline itself uses: the default here would cut a long prompt.
            max_sequence_length=512,
        )
    pipe.text_encoder = None
    gc.collect()
    torch.cuda.empty_cache()
    pipe.enable_model_cpu_offload(gpu_id=0)
    pipe.vae.enable_tiling()
    pipe.vae.enable_slicing()
    receipt["loadSeconds"] = round(time.time() - started, 1)
    receipt["stage"] = "generating"
    save()

    # The last step's end is where decoding begins, with nothing else changed.
    def at_step_end(_pipe, step, _timestep, _inputs):
        if step == STEPS - 1:
            receipt["stage"] = "decoding"
            save()
        return {}

    started = time.time()
    video = pipe(
        prompt_embeds=prompt_embeds,
        negative_prompt_embeds=negative_embeds,
        height=HEIGHT,
        width=WIDTH,
        num_frames=FRAMES,
        num_inference_steps=STEPS,
        guidance_scale=5.0,
        generator=torch.Generator(device="cpu").manual_seed(SEED),
        callback_on_step_end=at_step_end,
    ).frames[0]
    receipt["generateSeconds"] = round(time.time() - started, 1)
    receipt["peakHostBytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
    receipt["peakGpuBytes"] = torch.cuda.max_memory_allocated(0)
    receipt["stage"] = "exporting"
    save()
    path = os.path.join(OUT, "wan-video.mp4")
    export_to_video(video, path, fps=FPS)
except Exception as error:
    receipt["stage"] = f"failed at {receipt['stage']}"
    receipt["error"] = f"{type(error).__name__}: {error}"[:1000]
    receipt["trace"] = traceback.format_exc()[-1500:]
    receipt["peakGpuBytes"] = torch.cuda.max_memory_allocated(0)
    save()
    sys.exit(f"Stopped: {receipt['error']}")

with open(path, "rb") as f:
    receipt["sha256"] = hashlib.sha256(f.read()).hexdigest()
receipt["bytes"] = os.path.getsize(path)

reader = imageio.get_reader(path)
decoded = np.stack([frame for frame in reader])
reader.close()
receipt["decodedFrames"] = int(decoded.shape[0])
receipt["decodedSize"] = [int(decoded.shape[2]), int(decoded.shape[1])]
receipt["spatialStd"] = round(float(decoded[0].std()), 2)
receipt["temporalDiff"] = round(
    float(np.abs(np.diff(decoded.astype(np.int16), axis=0)).mean()), 3
)
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
