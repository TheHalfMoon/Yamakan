"""Wan2.2-TI2V-5B on a Kaggle GPU, on Kaggle's disk only: can it run here at all?

Pinned to one model revision, with CPU offload and half precision. Short and small
on purpose: the question is whether it fits a T4, and what it costs. It writes a
receipt at every stage, so a run that runs out of memory still says how far it got.
`verified` is a rough check; fit to the prompt is judged by looking.
It uses no token or secret, and its weights never leave Kaggle.
"""
import hashlib
import json
import os
import subprocess
import sys
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
}


def save():
    with open(os.path.join(OUT, "receipt.json"), "w") as f:
        json.dump(receipt, f, indent=2)


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True).stdout.strip()


save()
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
    pipe.enable_model_cpu_offload(gpu_id=0)
    pipe.vae.enable_tiling()
    pipe.vae.enable_slicing()
    receipt["loadSeconds"] = round(time.time() - started, 1)
    receipt["stage"] = "generating"
    save()

    started = time.time()
    video = pipe(
        prompt=PROMPT,
        negative_prompt=NEGATIVE,
        height=HEIGHT,
        width=WIDTH,
        num_frames=FRAMES,
        num_inference_steps=STEPS,
        guidance_scale=5.0,
        generator=torch.Generator(device="cpu").manual_seed(SEED),
    ).frames[0]
    receipt["generateSeconds"] = round(time.time() - started, 1)
    receipt["peakGpuBytes"] = torch.cuda.max_memory_allocated(0)
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
save()
print(json.dumps(receipt, indent=2))
if not receipt["verified"]:
    sys.exit("The video did not pass its own checks.")
