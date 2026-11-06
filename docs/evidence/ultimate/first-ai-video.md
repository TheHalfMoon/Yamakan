# First real AI-generated video through Yamakan

Run 2026-11-05 by Claude Opus. The founder approved using their Kaggle account directly: "Yes, use Kaggle".

**What this shows:** a real model made a real video in which a paper boat on water is visible, on a free Kaggle GPU, and Yamakan imported, placed and exported it. **What it does not show:** generation from inside Yamakan. These videos were made elsewhere and brought in as files. Wan2.2 started from Yamakan's own page came later: see the end of this file.

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

| Step     | Result                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import   | One asset, with the same hash                                                                                                                                                   |
| Timeline | The clip shows in the browser                                                                                                                                                   |
| Export   | H.264, 1280x720, 30 fps, 183 frames. The boat is plainly there in an exported frame looked at from the 50-step run                                                              |
| Picture  | All 49 source frames, each compared with every export frame that shows it: mean difference at most 1.80 of 255 at 20 steps and 1.89 at 50. See "What the picture check catches" |
| Bars     | Both sides dark, brightest value 19 and 20 of 255                                                                                                                               |

**Found by this:**

- **Yamakan projects offer no 8 fps,** this model's rate, only 30 and 24000/1001. So the 8 fps video plays in a 30 fps project, with each source frame lasting 3.75 of its frames. It works, but a person cannot edit on the model's own frames.
- **A 3:2 video gets black bars in a 16:9 project.** That is correct fitting, and a person has no way yet to set a project to the video's shape from this path.

**What the picture check catches.** Two rules. Every export frame is within 8 of 255 of the source frame it shows. And wherever two source frames one or two apart, or the clip's first and last, differ by at least 2, each one's export frames are closer to it than to the other, once the export's steady colour offset is taken out. A fully frozen export cannot meet the second rule if any compared pair differs that much; a clip that drifts away and back, with no such pair, passes frozen. The earlier rules passed exports shifted by one source frame, and rejected good still and looping clips.

A reviewer built bad exports from the real ones, re-encoded with libx264, not through Yamakan's pipeline. They are kept outside the repository, and were measured with `scripts/ai-video-frames.mjs` directly. Swaps and repeats were simulated on real export frames, without re-encoding. The unit tests are in `tests/ai-video-frames.test.ts`.

| Bad export                                       | CogVideoX, 50 steps                | Wan                                              |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------ |
| Fully frozen                                     | Rejected                           | Rejected                                         |
| One source frame late, or early                  | Rejected                           | Rejected                                         |
| Every other source frame dropped                 | Rejected                           | Passes keeping even frames, rejected keeping odd |
| Two neighbouring frames swapped, or one repeated | Rejected at all 47 positions tried | **Passes at 38 of 39 tried**                     |
| Two stills, either side of the clip's jump       | Not built                          | **Passes**                                       |
| Each side of the jump reversed                   | Not built                          | **Passes**                                       |

**The order rule only reaches frames near a change.** It reaches all 49 of CogVideoX's frames, with all 96 pairs compared, and 6 of Wan's 41, with 4 of 80: around its one jump, plus its first and last. The rest of Wan differs by under 1 of 255 from frame to frame at this measure, so a mistake confined to those frames passes, as the table shows. A clip with no such pairs passes with its order unchecked. In the other direction, a reviewer's correct exports of flat-colour fades were refused, because one steady offset does not fit them: the check fails safe there, and has only been shown right on natural clips like these three. A grainy clip's bars can also reach past the limit of 24, and a picture as wide as 16:9, such as Wan's own 1280x704, stops the check with a message. Each run prints how many frames the rule reached.

**Open finding:** real exports sit steadily darker than their sources, by about 1.5, 2.1 and 1.6 of 255 in red, green and blue on all three videos. The cause has not been looked at. The check takes this out when comparing order, but the limit of 8 counts it.

The rule that a source frame starts at the project frame nearest its time matches all 183 frames of the CogVideoX exports. A reviewer's clean test clips showed that the check's earlier mapping rejected good video at 25, 23.976 and 29.97 fps.

## Not done

For these runs: generation from inside Yamakan, which came later and is at the end of this file; a check of the notebook's privacy other than its metadata; audio; a person making this choice in the browser rather than a script.

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

`qualify:ai-video` passes for it: one asset with the same hash, on the timeline in a real browser, export H.264, 1280x720, 30 fps, 51 frames with a 1056x720 picture, bars at most 8 of 255. All 41 source frames match with a worst difference of 1.93. The order rule compared 4 of 80 pairs and reached 6 source frames.

**Not a comparison of the two models.** One prompt and seed each, different sizes, steps and lengths: 6.1 s of CogVideoX against 1.7 s of Wan. Wan's 24 fps also has no matching project rate: a source frame lasts 1.25 project frames, so some repeat.

Not tried then: longer or larger Wan clips. 81 frames came later; the 1280x704 and 121 frames its own card uses are still not tried, and neither are quantization or a second GPU. These runs say only that clips this small fit one T4.

## Wan2.2 from Yamakan's own page

**A real generation started from the page, 2026-11-06.** `npm run qualify:kaggle`: a person's steps in real Edge against the real service, on a private Kaggle notebook. See `create-workspace.md`.

**41 frames had a defect, so the page offers 81.** With the prompt "A red kite flies above a green hill under a clear blue sky." and seed 7, frame-to-frame change at 64x36:

|                           | Largest change | Where                 | Picture, by the builder's look at sampled frames                                                   |
| ------------------------- | -------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| 41 frames, VAE tiling on  | 54.9 of 255    | Frames 37 to 38 of 41 | A bird-like red shape over hills, then a sudden snap to a different picture for the last 3 frames  |
| 41 frames, VAE tiling off | 54.9 of 255    | The same frames       | Not looked at: its frame changes match the row above almost exactly. So tiling is not the cause    |
| **81 frames, tiling on**  | **1.8 of 255** | **Frame 44 of 81**    | **A red kite-like shape over a green hill under blue sky, with no snap, and very little movement** |

The earlier paper-boat clip, at 41 frames, had a smaller jump between frames 25 and 26. Why a short clip does this was not worked out. Runs from the page with the same prompt and seed gave a byte-identical video each time, `8c4fe902a27baa98b526e2c6a3f4f3f6add7d53407a5e9f1a322fc57b3f67d8c`, so a run repeats here. **This is one prompt and one seed at each length,** so it says 81 frames avoided this here, not that it always does. The GPU peak was 13,619,549,184 bytes in all three: that figure may not reflect decoding, which was not measured separately.

**81 frames does not always finish.** Of the first five runs at 81 frames, four finished and one, from the page at `bcc9bed` with the same prompt and seed as others that worked, was killed after all 30 steps, while decoding. The log says only `Killed`. Running out of host memory is the likely reason, not a measured one: the receipts until then did not record it. The script now encodes the prompt first and frees the text encoder, and records `peakHostBytes`. That a change fixes a one-in-five failure takes more runs than have been made here to show.
