# First real AI-generated video through Yamakan

Run 2026-11-05 by Claude Opus. The founder approved using their Kaggle account directly: "Yes, use Kaggle".

**What this shows:** a real model made a real video on a free Kaggle GPU, and Yamakan imported, placed and exported it. **What it does not show:** generation inside Yamakan, which is still off. The video was made elsewhere and brought in as a file. Nothing here enables a model in Yamakan.

## The generation

`scripts/kaggle/cogvideox-2b/`, a private Kaggle notebook. [Its receipt](first-ai-video-receipt.json).

|          |                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------- |
| Model    | `zai-org/CogVideoX-2b` at `1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01`, Apache-2.0 by its model card |
| Machine  | Kaggle, two Tesla T4 at 15,360 MiB offered, one used, with model CPU offload                       |
| Settings | 20 steps, 49 frames, 8 fps, seed 42                                                                |
| Time     | 85.8 s to load, 439.9 s to generate                                                                |
| GPU peak | 11,602,235,392 bytes allocated                                                                     |
| Output   | H.264, 720x480, 49 frames, 285,479 bytes                                                           |
| SHA-256  | `2c04b28d4f48783b37e1f1c1e80deea2ba52f812118d89464050fd9bfacaa877`                                 |

The hash, codec, size and frame count were checked again on this machine with Yamakan's own FFprobe, not taken from the receipt. Weights stayed on Kaggle. Neither they nor the video are in this repository; the video is kept outside it, named by that hash.

The first push failed in about a minute, before any model loaded: Kaggle's Python 3.13 has no ready-built package for the older `sentencepiece` pinned. It is kept here because it happened.

**Quality is poor, and it does not show the prompt.** The prompt asked for a paper boat on a calm stream. Looking at four frames, they show blurred moving water and light, and no boat can be seen. The numeric checks show only that it is a moving picture. 20 steps is well below the 50 in the model card's example.

## Through Yamakan

`npm run qualify:ai-video <video> <sha256>`, real Edge against the real service, passing at the head of this change.

| Step     | Result                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import   | One asset, with the same hash                                                                                                                                   |
| Timeline | The clip shows in the browser                                                                                                                                   |
| Export   | H.264, 1280x720, 30 fps, 183 frames                                                                                                                             |
| Picture  | Each source frame compared with the export frame from the middle of its time: worst mean difference 1.79 of 255, against 13.2 between the first and last frames |
| Bars     | Black, brightest value 9                                                                                                                                        |

**Found by this:**

- **Yamakan projects offer no 8 fps,** this model's rate, only 30 and 24000/1001. So the 8 fps video plays in a 30 fps project, with each source frame lasting 3.75 of its frames. It works, but a person cannot edit on the model's own frames.
- **A 3:2 video gets black bars in a 16:9 project.** That is correct fitting, and a person has no way yet to set a project to the video's shape from this path.

## Not done

Generation from inside Yamakan; a start control; a clip that matches its prompt; audio; a person making this choice in the browser rather than a script; running Wan2.2-TI2V-5B, whose metadata says Apache-2.0 at `b8fff7315c768468a5333511427288870b2e9635` with about 31.9 GiB of files.
