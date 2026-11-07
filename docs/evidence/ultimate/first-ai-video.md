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

The earlier paper-boat clip, at 41 frames, had a smaller jump between frames 25 and 26. Why a short clip does this was not worked out. Runs from the page with the same prompt, seed and settings gave a byte-identical video, `8c4fe902a27baa98b526e2c6a3f4f3f6add7d53407a5e9f1a322fc57b3f67d8c`, so a run repeats here. **This is one prompt and one seed at each length,** so it says 81 frames avoided this here, not that it always does. The GPU peak was 13,619,549,184 bytes in all three: that figure may not reflect decoding, which was not measured separately.

**81 frames does not always finish.** Of the first five runs at 81 frames, four finished and one, from the page at `bcc9bed` with the same prompt and seed as others that worked, was killed after all 30 steps, while decoding. The log says only `Killed`. Running out of host memory is the likely reason, not a measured one: the receipts until then did not record it. The script now encodes the prompt first and frees the text encoder, and records `peakHostBytes`. The two runs with this change both finished, at `257a21c` and `7b04dbf`, at a host peak of 26,467,381,248 and 26,384,965,632 bytes (about 24.6 GiB) of the 31 GiB reported, with the text encoder freed. That fits running out of memory without proving it. The first used a shorter prompt length than the pipeline's by mistake, which changed its bytes. With that fixed the video is again `8c4fe902a27baa98b526e2c6a3f4f3f6add7d53407a5e9f1a322fc57b3f67d8c`, the same bytes as before the change. That a change fixes a one-in-five failure takes more runs than have been made here to show.

**What is known of the `Killed` run, and what is not.** One kill, at `bcc9bed`, in about ten runs at 81 frames, which is too few to give a rate. Its log ends at `Killed`, after all 30 steps. The three later runs that recorded it, at `257a21c`, `7b04dbf` and `7541843`, peaked at 26,384,965,632 to 26,467,381,248 bytes of host memory, about 24.6 GiB of the 31 GiB reported, all with the text encoder freed. That peak could not be read from the killed run, or from any run killed while decoding: the script read it only after the pipeline returned. So running out of memory remains likely and unmeasured, and **the problem is not shown to be solved**. A handful of good runs would not show it either, when kills are this rare.

The script now writes as it goes: the stage, including when decoding begins, the lowest free memory and the stage it happened at, the highest resident memory, each of those for every stage, and where the host offers them, the container's peak and its count of out-of-memory kills. A kill should leave all of this, as of its last save, in the receipt on its notebook, until a later run replaces it. No real kill has shown that. The page reports the stage, the lowest free memory, the stage it was lowest in, and the lowest in the stage the run died in. Only two saves can stop a run, on purpose: the first, before the model loads, and the last, since a video with no receipt cannot be trusted. The container's count of kills is read before the run's own kill, so it says nothing of that kill, and the page leaves it out. A kill itself is tested with a stand-in for the GPU libraries only, in `tests/kaggle-run-script.test.ts`. No real run has been killed with this in place. The real test now also fails if the kite video is not the same bytes as before, `8c4fe902...`.

**Two real runs have written these figures,** on 2026-11-07, both with the service restarted partway. Both made the same bytes, so writing them did not change the video, and neither was killed. The second also recorded each stage, in `kaggle-restart-run-notebook-receipt.json`:

| Stage      | Highest resident memory | Lowest free memory |
| ---------- | ----------------------- | ------------------ |
| Loading    | 24.2 GiB                | 7.06 GiB           |
| Generating | 7.49 GiB                | 23.62 GiB          |
| Decoding   | 17.71 GiB               | 12.79 GiB          |

Of 31.35 GiB, from 224 samples 5 seconds apart. Free memory here is the kernel's `MemAvailable`, an estimate, and whether it reflects the container's limit is not known. The sampled highest was 24.2 GiB where the peak read at the end was 24.42 GiB, so sampling did miss about 0.2 GiB. The first run, at `48495f7`, had 8.4 GiB free at its lowest and 24.65 GiB resident at its highest, both while loading. In the second, the container's peak was 31,484,661,760 bytes (about 29.3 GiB), which may count file cache that could have been given back, and its out-of-memory kills were 0. Decoding began 387.8 seconds into the 738.7 seconds of generating.

What this shows, in this one run: loading is the hardest moment overall, and at its sampled peak decoding is about 10 GiB above generating. The stage lasted about six minutes, and how long that peak lasted was not recorded. What it suggests, and does not show: the killed run came before the text encoder was freed, which the script's own comment puts at about 10 GB, not measured here. The first-frame run below read a container limit of 30.0 GiB from `/sys/fs/cgroup/memory.max`, not the 31.35 GiB reported. That was one session: the text runs and the killed run recorded no limit. If it held for that run too, holding that encoder through decoding would have made about 27.7 GiB resident at the sampled peak, about 2.3 GiB under that limit. That alone predicts no kill: it would take a spike between samples, or file cache that could not be given back. So this does not rule out running out of memory while decoding, and it is an inference from good runs, not a measurement of the killed one. **Why that run was killed is still not known, and the problem is still not shown to be solved.**

## Image to video, first real runs (2026-11-07)

Run `a7d72d34-df87-4158-8ea4-a54e43e09629` at `5f51ad7`, from `npm run qualify:kaggle-first-frame`. **It is still not offered:** the command names the recipe in its own process, and no page or service command can reach it. Receipts: `kaggle-first-frame-run-receipt.json` and `kaggle-first-frame-notebook-receipt.json`.

The picture was made here from a fractal and noise, of no one. As a clean PNG it was 861,006 bytes. What went was a JPEG of 108,565 bytes, at the best quality: rebuilt here from the same picture, it has the hash the notebook recorded, `5ca99535...`. Kaggle ran it, and its video came back with the bytes its receipt names, `2eaa30e6...`, 81 frames at 704×480. Kaggle said it had finished 1,162 seconds after the command started, which was 13 seconds before Kaggle took the script.

**Is the frame used?** Yes, by looking: the video's first frame is plainly the picture sent. At 88×60, where the noise averages out, they are 27.14 dB apart, with nothing to compare that figure against. By the middle frame the picture is gone, and the last shows something else again. That may be the picture being abstract and the prompt vague. **This run says nothing yet of how a real photograph holds up**, or whether the prompt was followed. Those are for looking at, on a real photo.

**What the real run found that nothing else could:**

- **Kaggle has a limit on a script.** The same picture as a PNG made a script of about 1.5 MB, and Kaggle refused it with `400 Client Error: Bad Request` and no reason. Separate pushes of a private, CPU-only notebook of a print and padding, `yamakan-probe-script-size`, used no GPU quota and no picture: 100,000 and 1,000,000 bytes were accepted, and 1,062,500, 1,125,000, 1,250,000, 1,500,000 and 2,000,000 were refused. Whether that is size alone, and exactly where it falls, is not known. `SCRIPT_BYTES` is the largest seen to pass. These figures are in `kaggle-script-size-probe.json`, written by hand from what the probe printed. That notebook is still on the account.
- **A refused first push leaves an empty notebook behind.** Before it, the CLI said `Permission 'kernels.get' was denied`. After it, `404 Client Error: Not Found for url: https://api.kaggle.com/v1/kernels.KernelsApiService/GetKernelSessionStatus`, and the account's list still did not hold it. The engine took that for not knowing, and would have refused that model from then on. A real run did then go through. Since then this applies only when it is the status question that had the 404, and only a plain no on what can be read of the notebook's privacy stops it. That narrower form has run on a stand-in only, with the real words of the refusal, since the real notebook is no longer empty.

**Memory,** of a 30.0 GiB container limit, from 220 samples 5 seconds apart. Free memory is the kernel's `MemAvailable`, an estimate:

| Stage      | Highest resident | Lowest free |
| ---------- | ---------------- | ----------- |
| Loading    | 23.86 GiB        | 7.76 GiB    |
| Generating | 13.95 GiB        | 17.02 GiB   |
| Decoding   | 15.19 GiB        | 14.94 GiB   |
| Exporting  | 17.51 GiB        | 12.9 GiB    |

The container's peak was 29.47 GiB, close under that limit, with 0 out-of-memory kills. That peak may count file cache that could have been given back. The stages are not the text run's figures in another form: its generating was 7.49 GiB, this one 13.95. Why is not established, though this one also encodes the frame with the VAE. One run.

Decoding began 405.0 seconds into the 742.3 seconds of generating.

**A second run went as a PNG,** `481f65e5-6856-410c-b4aa-10ed3ae8e7ba` at `6ee67ee`, after a review tightened the picture path. Its receipts are `kaggle-first-frame-png-run-receipt.json` and `kaggle-first-frame-png-notebook-receipt.json`. The same picture without noise is a clean PNG of 417,786 bytes, in a script of about 0.75 MB by arithmetic, which was not read from what was sent. The notebook recorded `92c82d3f...`, the hash of that PNG rebuilt here, so it went as a PNG and arrived as it was. So real Kaggle has taken scripts of about 0.2 and 0.75 MB holding a picture, with 1,000,000 bytes seen only for padding. Its first frame is again plainly the picture, 27.07 dB apart at 88×60.

The container's limit read 30.0 GiB again. Lowest free was 7.43 GiB and highest resident 24.73 GiB, both while loading. While decoding, 17.66 GiB resident and 13.01 GiB free. In the first run the decoding stage peaked at 15.19 GiB and its exporting stage at 17.51 GiB, so with samples 5 seconds apart, which stage holds a peak near the change between them is not exact.
