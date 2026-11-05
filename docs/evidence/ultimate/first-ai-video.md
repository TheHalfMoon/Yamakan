# First real AI-generated video through Yamakan

Run 2026-11-05 by Claude Opus. The founder approved using their Kaggle account directly: "Yes, use Kaggle".

**What this shows:** a real model made a real video that shows its prompt, on a free Kaggle GPU, and Yamakan imported, placed and exported it. **What it does not show:** generation inside Yamakan, which is still off. The video was made elsewhere and brought in as a file. Nothing here enables a model in Yamakan.

## The generation

`scripts/kaggle/cogvideox-2b/`, a private Kaggle notebook. [Its receipt](first-ai-video-receipt.json).

|                       | 20 steps, first                                                                                           | **50 steps, the reference**                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Time to generate      | 439.9 s                                                                                                   | **1,051.1 s**                                                                                                                              |
| Time to load          | 85.8 s                                                                                                    | 74.4 s                                                                                                                                     |
| GPU peak              | 11,602,235,392 bytes                                                                                      | 11,602,235,392 bytes                                                                                                                       |
| Size in bytes         | 285,479                                                                                                   | 303,402                                                                                                                                    |
| SHA-256               | `2c04b28d4f48783b37e1f1c1e80deea2ba52f812118d89464050fd9bfacaa877`                                        | `e1c3f4880272e913b7c1ee329308e3a1cf3b93f941dc0c4f967402be0a2bc38b`                                                                         |
| **Shows the prompt?** | **No:** blurred water and light, no boat, by the builder's look at four frames and a reviewer's at all 49 | **Yes, by the builder's look at four frames and one exported frame:** a folded paper boat on calm water with its reflection, in soft light |

Both: `zai-org/CogVideoX-2b` at `1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01`, Apache-2.0 by its repository's tag and licence file, with a text encoder from T5, tagged Apache-2.0 today. Kaggle offered two Tesla T4 at 15,360 MiB; the code asks for one, with model CPU offload. 49 frames, 720x480, 8 fps, seed 42, half precision. H.264. The prompt: "A paper boat floats slowly along a calm stream in soft morning light." **The same seed and settings with more steps made this difference, which is one comparison, not a finding about the model.**

The hash, codec, size and frame count were checked again on this machine with Yamakan's own tools, not taken from the receipt. Weights stayed on Kaggle. Neither they nor the videos are in this repository; the videos are kept outside it, named by those hashes.

The receipt's `verified` is a rough check that noise would pass: real inference rests on the code path and the log, which shows the pinned files fetched and every step completed. The first push failed in about a minute, before any model loaded: Kaggle's Python 3.13 has no ready-built package for the older `sentencepiece` pinned. It is kept here because it happened.

## Through Yamakan

`npm run qualify:ai-video <video> <sha256>`, real Edge against the real service, passing for both videos. Import, placing and export are calls made from the page; the timeline check is what uses the interface.

| Step     | Result                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import   | One asset, with the same hash                                                                                                                                                                                                                                                                     |
| Timeline | The clip shows in the browser                                                                                                                                                                                                                                                                     |
| Export   | H.264, 1280x720, 30 fps, 183 frames. The boat is plainly there in an exported frame looked at from the 50-step run                                                                                                                                                                                |
| Picture  | All 49 source frames, each compared with the export frame from the middle of its time: mean difference at most 1.79 of 255 at 20 steps and 1.88 at 50, against 13.2 and 12.28 between the first and last frames. A shift of one source frame would pass this; two, or a frozen picture, would not |
| Bars     | Both sides dark, brightest value 19 and 20 of 255                                                                                                                                                                                                                                                 |

**Found by this:**

- **Yamakan projects offer no 8 fps,** this model's rate, only 30 and 24000/1001. So the 8 fps video plays in a 30 fps project, with each source frame lasting 3.75 of its frames. It works, but a person cannot edit on the model's own frames.
- **A 3:2 video gets black bars in a 16:9 project.** That is correct fitting, and a person has no way yet to set a project to the video's shape from this path.

## Not done

Generation from inside Yamakan; a start control; a check of the notebook's privacy other than its metadata; audio; a person making this choice in the browser rather than a script; running `Wan-AI/Wan2.2-TI2V-5B-Diffusers`, whose metadata says Apache-2.0 at `b8fff7315c768468a5333511427288870b2e9635` with about 31.9 GiB of files.
