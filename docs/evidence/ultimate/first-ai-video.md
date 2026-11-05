# First real AI-generated video through Yamakan

Run 2026-11-05 by Claude Opus. The founder approved using their Kaggle account directly: "Yes, use Kaggle".

**What this shows:** a real model made a real video in which a paper boat on water is visible, on a free Kaggle GPU, and Yamakan imported, placed and exported it. **What it does not show:** generation inside Yamakan, which is still off. The video was made elsewhere and brought in as a file. Nothing here enables a model in Yamakan.

## The generation

`scripts/kaggle/cogvideox-2b/`, a private Kaggle notebook. [Its receipt](first-ai-video-receipt.json).

|                       | 20 steps, first                                                                                           | **50 steps, the reference**                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time to generate      | 439.9 s                                                                                                   | **1,051.1 s**                                                                                                                                                                 |
| Time to load          | 85.8 s                                                                                                    | 74.4 s                                                                                                                                                                        |
| GPU peak              | 11,602,235,392 bytes                                                                                      | 11,602,235,392 bytes                                                                                                                                                          |
| Size in bytes         | 285,479                                                                                                   | 303,402                                                                                                                                                                       |
| SHA-256               | `2c04b28d4f48783b37e1f1c1e80deea2ba52f812118d89464050fd9bfacaa877`                                        | `e1c3f4880272e913b7c1ee329308e3a1cf3b93f941dc0c4f967402be0a2bc38b`                                                                                                            |
| **Shows the prompt?** | **No:** blurred water and light, no boat, by the builder's look at four frames and a reviewer's at all 49 | **In part, by the builder's look at four frames and one exported frame:** a folded paper boat on calm water with its reflection, in soft light; see below for what is missing |

Both: `zai-org/CogVideoX-2b` at `1137dacfc2c9c012bed6a0793f4ecf2ca8e7ba01`, Apache-2.0 by its repository's tag and licence file, with a text encoder from T5, tagged Apache-2.0 today. Kaggle offered two Tesla T4 at 15,360 MiB; the code asks for one, with model CPU offload. 49 frames, 720x480, 8 fps, seed 42, half precision. H.264. The prompt: "A paper boat floats slowly along a calm stream in soft morning light." **The same seed and settings with more steps made this difference, which is one comparison, not a finding about the model.**

**How well it shows it:** a reviewer looked at all 49 frames at 50 steps. The boat-like object is in every one, but it stays in about the same place and its outline changes between frames, and the water could be a stream or a pond. So the "floats slowly along a stream" part of the prompt is not shown. This is an AI reviewer's judgement from looking, not a measure, and no person has made it yet.

`qualify:ai-video` asserts the source hash and the export's codec, size, rate and frame count. It takes the source's frame count by decoding it, and its size and rate from its stream. The runs used diffusers 0.35.1, while `OPERATIONAL_CONTRACTS.md` lists this model as eligible on 0.42.1, so these runs say nothing about that version. The install pins cover top-level packages only. Weights stayed on Kaggle. Neither they nor the videos are in this repository; the videos, and the qualifier's own outputs behind the figures below, are kept outside it, so those figures cannot be checked from the repository alone. The 20-step receipt is in this file's git history.

The `verified` in each receipt, this and Wan's below, is a rough check that noise would pass: real inference rests on the code path and the log, which shows every step completed. The revision pin rests on the script; the log does not name a revision. The first push failed while installing packages, before any model loaded: the older `sentencepiece` pinned would not build on Kaggle's Python 3.13. It is kept here because it happened.

## Through Yamakan

`npm run qualify:ai-video <video> <sha256>`, real Edge against the real service, passing for the 20-step, 50-step and Wan videos. Import, placing and export are calls made from the page; the timeline check is what uses the interface.

| Step     | Result                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import   | One asset, with the same hash                                                                                                                                                                                                      |
| Timeline | The clip shows in the browser                                                                                                                                                                                                      |
| Export   | H.264, 1280x720, 30 fps, 183 frames. The boat is plainly there in an exported frame looked at from the 50-step run                                                                                                                 |
| Picture  | All 49 source frames, each compared with an export frame from the middle of where it shows: mean difference at most 1.88 of 255 at 50 steps, against 12.28 between the first and last frames. See "What the picture check catches" |
| Bars     | Both sides dark, brightest value 19 and 20 of 255                                                                                                                                                                                  |

**Found by this:**

- **Yamakan projects offer no 8 fps,** this model's rate, only 30 and 24000/1001. So the 8 fps video plays in a 30 fps project, with each source frame lasting 3.75 of its frames. It works, but a person cannot edit on the model's own frames.
- **A 3:2 video gets black bars in a 16:9 project.** That is correct fitting, and a person has no way yet to set a project to the video's shape from this path.

**What the picture check catches.** Three rules: every frame within 8 of 255; the first-to-last difference larger than the worst match, which a fully frozen picture cannot meet; and, wherever two source frames one or two apart differ by at least 4, each one's export frame closer to its own source frame than to the other's. The third is new. The first two alone passed exports shifted by one source frame.

A reviewer built bad exports from the real ones, re-encoded with libx264, not through Yamakan's pipeline. These are kept outside the repository; the rules' unit tests are in `tests/ai-video-frames.test.ts`.

| Bad export                                 | CogVideoX, 50 steps | Wan                       |
| ------------------------------------------ | ------------------- | ------------------------- |
| Fully frozen                               | Rejected            | Rejected                  |
| One source frame late, or early            | Rejected            | Rejected                  |
| Every other source frame dropped           | Rejected            | Not run under these rules |
| Two stills, either side of the clip's jump | Not built           | **Passes**                |
| Each side of the jump reversed             | Not built           | **Passes**                |

**The order rule only reaches frames near a change.** It reaches all 49 of CogVideoX's frames and 4 of Wan's 41, where the clip's one jump falls. The rest of Wan differs by under 1 of 255 from frame to frame at this measure, less than the roughly 2 that a correct export already sits from its source, so a mistake confined to those frames passes, as the table shows. Each run's output says how many frames the rule reached, and a clip with no such frames passes with a note that its order went unchecked. The rule assumes export frame i shows source frame floor(i / rate ratio), which was confirmed at Wan's one jump only.

## Not done

Generation from inside Yamakan; a start control; a check of the notebook's privacy other than its metadata; audio; a person making this choice in the browser rather than a script.

## Wan2.2-TI2V-5B

`scripts/kaggle/wan22-ti2v-5b/`, a private Kaggle notebook. `Wan-AI/Wan2.2-TI2V-5B-Diffusers` at `b8fff7315c768468a5333511427288870b2e9635`, whose metadata says Apache-2.0, with about 31.9 GiB of files. 704x480, 41 frames, 24 fps, 30 steps, seed 42, on one T4 with model CPU offload.

**First run, 2026-11-05: failed, no video.** All 30 denoising steps finished, at about 6 s each. Decoding then stopped with `RuntimeError: The size of tensor a (2) must match the size of tensor b (4)`, at a GPU peak of 13,619,549,184 bytes. The cause is in the pinned package, not memory: diffusers 0.35.1's `tiled_decode` does not pass `first_chunk` to the decoder, and 0.36.0 does. The script now pins 0.36.0.

**Second run, 2026-11-05: finished, a video, on one T4.** The same script with diffusers 0.36.0; `OPERATIONAL_CONTRACTS.md` lists this model as eligible on 0.42.1, so this run says nothing about that version. [Its receipt](wan22-first-video-receipt.json).

|                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time to load          | 286.8 s, of which about half is the first download of the weights on Kaggle's disk                                                                                                                                                                                                                                                                                                                                                                                           |
| Time to generate      | 352.5 s, of which 167 s denoising (5.6 s a step) and the rest mostly decoding                                                                                                                                                                                                                                                                                                                                                                                                |
| GPU peak              | 13,619,549,184 bytes of 15,360 MiB. The second T4 was not used. No quantization was needed at this size                                                                                                                                                                                                                                                                                                                                                                      |
| Video                 | H.264, 704x480, 24 fps, 41 frames, 1.7 s, 123,592 bytes                                                                                                                                                                                                                                                                                                                                                                                                                      |
| SHA-256               | `4946b41cfc1ec709abd0b0a0c308289cfce3488201126d4a17e1e58d7e9e6f4e`                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Shows the prompt?** | **In part, by the builder's look at six frames and one exported frame.** A boat on a stream between banks in warm light, plainly. But it reads as a wooden boat, not a folded paper one, in an illustrated style the prompt did not ask for, and it stays in place with small movement in the water, plus one visible pop between frames 25 and 26, where the picture shifts and its texture changes. A reviewer agreed after looking at all 41. No person has judged it yet |

`qualify:ai-video` passes for it: one asset with the same hash, on the timeline in a real browser, export H.264, 1280x720, 30 fps, 51 frames with a 1056x720 picture, bars at most 8 of 255. All 41 source frames match with a worst difference of 1.93, against 5.45 first to last, nearly all of which is the one jump. The order rule made 3 comparisons and reached 4 source frames.

**Not a comparison of the two models.** One prompt and seed each, different sizes, steps and lengths: 6.1 s of CogVideoX against 1.7 s of Wan. Wan's 24 fps also has no matching project rate: a source frame lasts 1.25 project frames, so some repeat.

Not tried: longer or larger Wan clips, including the 1280x704 and 121 frames its own card uses; quantization; a second GPU. This run says only that this small clip fits one T4.
