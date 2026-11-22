# Cost, performance and hardware feasibility

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

This document covers what the revision costs in hardware, money, quota and human time, and what the
frozen limits allow. Measured numbers name their evidence file. External numbers carry an evidence
label and a URL. Arithmetic done here is marked as such and is not a measurement. Every
Yamakan-versus-competitor outcome is NOT TESTED.

## 1. Ground rules

- **The founder host is the target.** `core/qualification-policy.ts` `QUALIFICATION_POLICY.hardware`:
  Windows 11 (10.0.26300), i5-13420H with 12 logical cores, 16 GiB RAM, 512 GB NVMe SSD.
  - Graphics are integrated: "Intel(R) UHD Graphics" (`docs/evidence/qualification/playback.json`). There is no discrete GPU.
  - Free memory is often under 3 GB (per the brief). One reading found 1.2 of 15.7 GiB free
    (`docs/evidence/ultimate/SS-009-preview-qualification.md`).
  - Free disk is small and has fallen: about 24 GiB on C: and 10 GiB on D: on 2026-10-13
    (`specs/CURRENT.md`); about 2.9 GiB at a later preflight (`docs/LOCAL_INFERENCE.md`); and
    about 1.9 GB on C: in the pull request #278 entry of
    `docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md`, where
    the local full suite failed for lack of space. Free space was not measured here. Any card
    that installs a runtime or weights is expected to end BLOCKED on disk until space is freed.
- **Gates run only on an idle host on mains power, with the load and power state recorded.**
  - Sustained 720p playback measured 8.1 and 10.9 fps with the host busy or on battery, and 25 fps
    on AC power with the host quiet (`docs/evidence/ultimate/SS-009-preview-qualification.md`).
  - On battery, timing-bound tests failed, including the real Blender render. Each failing file
    passed when run alone (`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md`, PR #266 entry).
- **Resource policy v3 (`core/command/policy.ts` `RESOURCE_POLICY`) and qualification policy v1
  (`QUALIFICATION_POLICY`) are frozen.** No threshold is adjusted to pass. A change needs a new
  version and a new approval. A project or client never raises a limit.
- **No GPU, paid service, model download or provider API access is assumed.** The only remote
  compute in use is the person's own Kaggle account and quota. Its product scope is open (FD-3).

## 2. Frozen limits

All values are read from the code at the baseline.

**`RESOURCE_POLICY.enforced` (v3)**

| Limit | Value | Limit | Value |
|---|---|---|---|
| `requestBytes` | 2 MiB | `snapshotBytes` | 2 MiB |
| `assetImportBytes` (streamed) | 4 GiB | `diskReserveBytes` | 256 MiB |
| `concurrentImports` | 2 | `minUploadBytesPerSecond` | 1 MiB/s |
| `assetsPerProject` | 200 | `timelineFrames` | 18,000 |
| `activeRenderWorkers` | 1 | `activeJobs` | 128 |
| `activeConversionsPerProject` | 4 | `renderWallSeconds` | 180 |
| `exportWallPerMinuteSeconds` | 30 | `exportWallMaxSeconds` | 900 |
| `exportSegmentChains` | 32 | `previewCacheBytes` | 256 MiB |
| `previewSegmentFrames` | 150 | `previewQueueDepth` | 6 |
| `previewWallSeconds` | 30 | `conversionWallSeconds` | 900 |
| `renderMemoryBytes` | 2 GiB | `renderThreads` | 2 |
| `mediaDimension` | 4096 | `probeStreams` | 10 |
| `probeWallSeconds` | 10 | `workerMemoryBytes` | 1 GiB |

**Other policy values**

- `RESOURCE_POLICY.qualification`: `importServicePeakMiB` 300, `workerPeakShareOfLimit` 0.875,
  `budget` {`serviceMiB` 300, `maxShareOfRam` 0.5}.
- `RESOURCE_POLICY.candidate` (not advertised): `queuedJobs` 128, `durationSeconds` 7,200,
  `streams` 16, 3840×2160 video, `stillMegapixels` 100, `probeWallSeconds` 30,
  `diagnosticOutputBytes` 1 MiB.
- `SCALE_PROFILES` v1:

  | Profile | Clips | Tracks | Frames | Size |
  |---|---|---|---|---|
  | S | 24 | 4 | 3,600 | 1280×720 |
  | M | 200 | 16 | 18,000 | 1920×1080 |
  | T | 100 | 2 | 18,000 | 1920×1080 |

  L, H, A and K must be refused.

| Qualification value | Measured | Evidence |
|---|---|---|
| Service peak during a ≥ 2 GiB import ≤ 300 MiB | 163 MiB (2,239,490,938 bytes in 23.7 s); earlier 154 MiB | `docs/evidence/qualification/large-import.json` (policy v2), `docs/evidence/qualification/t4-large-import.json` |
| Worker peak ≤ 0.875 of limit | highest 0.481 (985 of 2,048 MiB, heavy 1080p export) | `docs/evidence/qualification/resource-policy.json` (policy **v2**; no v3 `qualify-resources` receipt found) |
| Worst case at once ≤ half of RAM | 300 + 2 × 2,048 + 3 × 1,024 = 7,468 of 8,192 MiB (arithmetic) | `tests/resource-policy.test.ts`, `scripts/qualify-resources.ts` |
| Editor scale | Editing qualified at S, M and T. Export qualified at S and T. **M export not qualified**: 2 of 5 runs finished inside 480 s | `docs/evidence/ultimate/editor-scale.json`, `docs/evidence/ultimate/render-optimization-yu026e.json` |

**Finding (arithmetic, not measured).** The worst-case formula counts the job worker at
`renderMemoryBytes` (2 GiB). A Blender render runs in the same serial job loop (`core/jobs.ts`
`#execute`), but under `core/process/owner.ts` `ENGINE_WORKER_PROFILE.memoryBytes`, which is 4 GiB.
In that slot the formula gives 300 + 4,096 + 2,048 + 3,072 = 9,516 MiB, more than 8,192 MiB. The
policy is not edited to fit. The gate review in
[11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md)
names two fixes:

- bring the Blender job's limit within the formula; or
- account for Blender in a new policy version.

MPR-507 (Stage 2) takes the first. It measures the Blender worker's peak memory on the founder host
and lowers the worker's limit to 2 GiB, or to 2,560 MiB flagged for founder review, when the
measured peak allows. If the peak is higher, it stops and reports. No card plans a new policy
version.

**`QUALIFICATION_POLICY.thresholds` (v1, p95)**

| Threshold | Limit | Measured | Evidence |
|---|---|---|---|
| `coldLaunch` | ≤ 5,000 ms | 1,087 ms | `docs/evidence/qualification/t10-release.json` (2026-10-22) |
| `reopen` | ≤ 2,000 ms | 1,012 ms | same |
| `referenceStillWarm` | ≤ 1,000 ms | 2 ms; later 80 ms | `docs/evidence/qualification/t8-preview.json` (2026-10-12, a day before v1 was approved); `docs/evidence/ultimate/SS-009-preview-qualification.md` (2026-11-04) |
| `referenceStillCold` | ≤ 3,000 ms | 410 ms; later 1,502 ms | same two files |
| `referenceSegmentCold` | ≤ 6,000 ms | 894 ms; later 1,680 ms | same two files |
| `playback720p` | ≥ 24 fps | 27.3 fps (headless Edge); 25 fps on AC power and quiet; 8.1 and 10.9 fps when contended | `docs/evidence/qualification/playback.json` (2026-10-26); `docs/evidence/ultimate/SS-009-preview-qualification.md` |

The `playback720p` fixture text in `core/qualification-policy.ts` still says "not yet measured".
The receipts above show it has been measured. The file is frozen and is not edited. No card
records this discrepancy: the index that MPR-002 writes covers documents, not this file.

**Story and take limits**

- `core/story.ts` `STORY_LIMITS`: `documentBytes` 262,144 (256 KiB), `scenes` 50, `shotsPerScene`
  100, `shots` 200, `takesPerShot` 8, `inputsPerTake` 8, `packsPerShot` 4, `entriesPerPack` 64.
- `core/takes.ts` `TAKE_LIMITS.compare` 8.
- Related: `core/document-ref.ts` `DOCUMENT_LIMITS` (`documentBytes` 8 MiB, `documentsPerProject`
  32, `modelBytes` 64 MiB) and `core/engines/contract-v2.ts` `ENGINE_V2_LIMITS.promptChars` 4,000.

**Blender limits**

- `core/blender/scene.ts` `BLENDER_SCENE_LIMITS`:
  - size: width ≤ 1280, height ≤ 720, sides ≥ 64 and even;
  - length and quality: ≤ 120 frames, ≤ 32 samples, fps 24, 25 or 30;
  - content: ≤ 200 objects, ≤ 8 models, ≤ 128 megapixels of texture.
- `core/blender/track.ts` `BLENDER_TRACK_LIMITS`:
  - input: 10 to 720 frames, ≤ 1920×1080;
  - solve: error ≤ 3 px, ≥ 8 tracks;
  - result ≤ 4 MiB.
- `core/jobs.ts` `BLENDER_RENDERS_AT_ONCE` = 1. Renders and tracks share this one slot across all
  projects, and a second request is refused.
- Worker profile `ENGINE_WORKER_PROFILE`: 4 processes, 30 min wall, 4 GiB, 64 MiB output, no GPU,
  no network. Threads: `renderThreads` (2).
- Pinned build: `core/blender/runtime.ts` `BLENDER_PIN.version` 5.3.0.

## 3. Hardware tiers

Only Tier 0 is a Yamakan target. The Tier 1 to 3 cells report **research findings, not Yamakan
measurements**. No GPU worker profile exists (`ENGINE_WORKER_PROFILE.gpu` is `"none"`), and
`core/engines/comfyui.ts` `PINNED_COMFY_RECIPES` is empty. Local weights wait on FD-4. Routes and
licences are covered in [07_MODEL_AND_PROVIDER_STRATEGY.md](07_MODEL_AND_PROVIDER_STRATEGY.md).

| Tier | Yamakan today | Research findings (not measured by Yamakan) |
|---|---|---|
| **0: CPU only, 16 GiB, integrated graphics (target)** | Editing at S, M and T (M export not qualified). Preview and playback thresholds met on AC power. Blender Cycles CPU renders within the limits (section 5). Remote generation through the person's Kaggle quota (section 4). No local generative model. | Video on CPU: "not practical" for every surveyed model [ASSUMED]. Images: stable-diffusion.cpp has a CPU backend [DOC]; minutes per image [ASSUMED] (https://github.com/leejet/stable-diffusion.cpp). faster-whisper int8 and Kokoro-82M listed as usable without a GPU [ASSUMED] (https://github.com/SYSTRAN/faster-whisper, https://huggingface.co/hexgrad/Kokoro-82M). All wait on FD-4 (MPR-220, MPR-221). |
| **1: 8 GB GPU** | Nothing beyond Tier 0. | Wan 2.2 TI2V-5B "should fit well on 8GB vram" with offloading [DOC]; time per clip [UNKNOWN] (https://docs.comfy.org/tutorials/video/wan/wan2_2.md). Wan 2.1 1.3B peaks at 8.19 GB [DOC] (https://github.com/Wan-Video/Wan2.1). FramePack: 6 GB minimum [DOC]; 25 to 50 min per 5 s clip on a laptop 3060-class GPU [ASSUMED] (https://github.com/lllyasviel/FramePack). |
| **2: 12 to 16 GB GPU** | As Tier 1. | HunyuanVideo 1.5: 14 GB minimum with offloading [DOC]; licence excludes the EU, UK and South Korea (https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5). Quantised 14B Wan at 480p [ASSUMED]. Times at 8 to 16 GB [UNKNOWN]. |
| **3: 24 GB+ GPU** | As Tier 1. | Wan 2.2 TI2V-5B: 5 s of 720p in under 9 min on one consumer GPU [DOC] (https://github.com/Wan-Video/Wan2.2). Wan 2.1 1.3B: 5 s of 480p in about 4 min on an RTX 4090 [DOC] (https://github.com/Wan-Video/Wan2.1). LTX-2.5: 32 GB minimum [DOC] (https://docs.ltx.io/open-source-model/getting-started/system-requirements.md). |

The only GPU Yamakan has used is Kaggle's. The notebooks report:

- two Tesla T4 at 15,360 MiB, of which the scripts use one;
- a 30.0 GiB container limit (`docs/evidence/ultimate/kaggle-first-frame-notebook-receipt.json`);
- GPU peaks of 13,619,549,184 bytes for Wan and 11,602,235,392 for CogVideoX
  (`docs/evidence/ultimate/kaggle-restart-run-notebook-receipt.json`,
  `docs/evidence/ultimate/kaggle-cogvideox-notebook-receipt.json`).

These figures do not transfer to a laptop GPU [ASSUMED].

## 4. The Kaggle route in numbers

**Recipes** (`core/engines/kaggle.ts` `KAGGLE_RECIPES`, all `offered: true`, Apache-2.0):

| Recipe id | Output | Steps | `expectedSeconds` | `timeoutSeconds` |
|---|---|---|---|---|
| `kaggle-wan22-ti2v-5b` | 704×480, 81 frames, 24 fps (3.375 s) | 30 | 1,132 | 3,600 |
| `kaggle-wan22-ti2v-5b-first-frame` | same, from one first frame | 30 | 1,132 | 3,600 |
| `kaggle-cogvideox-2b` | 720×480, 49 frames, 8 fps (6.125 s) | 50 | 1,125 | 3,600 |

Size caps:

- `VIDEO_BYTES` 512 MiB;
- `FIRST_FRAME_BYTES` 4 MiB;
- `SCRIPT_BYTES` 1,000,000 (Kaggle refused 1,062,500: `docs/evidence/ultimate/kaggle-script-size-probe.json`);
- `RECEIPT_BYTES` 1 MiB.

**Measured runs started from Yamakan** (wall-clock from start to "succeeded"):

| Evidence | Recipe | Wall-clock |
|---|---|---|
| `docs/evidence/ultimate/kaggle-page-run-receipt.json` (2026-11-06) | Wan, text | 1,171.6 s |
| `docs/evidence/ultimate/kaggle-restart-run-receipt.json` (service killed mid-run) | Wan, text | 1,184.6 s |
| `docs/evidence/ultimate/kaggle-first-frame-run-receipt.json` | Wan, first frame | 1,162.4 s |
| `docs/evidence/ultimate/kaggle-first-frame-png-run-receipt.json` | Wan, first frame | 1,149.6 s |
| `docs/evidence/ultimate/kaggle-first-frame-page-run-receipt.json` (2026-11-08) | Wan, photograph | 1,091.7 s |
| `docs/evidence/ultimate/kaggle-cogvideox-run-receipt.json` | CogVideoX | 1,184.1 s |
| `docs/evidence/ultimate/kaggle-cogvideox-page-run-receipt.json` | CogVideoX | 1,213.3 s |
| `docs/evidence/ultimate/kaggle-first-frame-photo-run-receipt.json` | Wan, photograph | Queued until 1,995.3 s. The command stopped waiting; the notebook finished (load 299.4 s, generate 682.0 s) |

Other observations:

- "Running" usually began 10 to 18 s after the start. One run waited about 33 minutes in Kaggle's queue.
- Kaggle's refusal stated a weekly limit, "Maximum weekly GPU quota of 30.00 hours reached."
  (`docs/evidence/ultimate/kaggle-quota-refusal-receipt.json`, 2026-11-06).
- One of about ten 81-frame runs was killed while decoding. That is too few runs to give a rate,
  and the cause is not established (`docs/evidence/ultimate/first-ai-video.md`).

**Cannot cancel remotely.** `requestCancel` returns `requested: false` and stops following. The run
goes on until it ends or reaches `timeoutSeconds`. An unwanted run costs about 20 min of quota, at
most 60.

**Revision loop.** This is arithmetic. How Kaggle counts quota is [UNKNOWN]; the figures assume
session wall-clock counts [ASSUMED].

- **Per generation:** 0.30 to 0.34 quota-hours (1,092 to 1,213 s).
- **Per hour:** a recipe's notebook takes one run at a time (`assertFree`), so about 3 clips per
  hour per recipe at most. Kaggle's limit on concurrent sessions is [UNKNOWN].
- **Per week:** quota, not the clock, binds. That gives about **89 to 98 generations per week**,
  about 5 to 5.5 minutes of 704×480 Wan footage before any rejection.
- **Not shown yet:** remaining quota is not read today. MPR-205 shows two quota facts (the time of
  the last quota refusal, and the seconds this service followed in the last seven days) and reports
  remaining quota as unknown.
- **Not reviewed:** Kaggle's terms for this use [UNKNOWN] (FD-3).

## 5. Blender in numbers

The limits are in section 2.

- **One slot.** A second render or track is refused, not queued (`core/jobs.ts`
  `BLENDER_RENDERS_AT_ONCE`). MPR-507 adds a queue of at most 4 waiting jobs, still one at a time.
- **Disk check.** `#runBlender` requires `frames × width × height × 4 × 2` bytes, plus 64 MiB, plus
  64 MiB per model, plus any plate footage, above the 256 MiB reserve.
- **Install check.** The install's listing and code hashes are checked on every render; every byte
  is re-read daily (`core/blender/runtime.ts` `verifyBlenderForRun`).

**Measured.** No Blender receipt is committed: the qualify scripts write receipts outside the
repository (`scripts/qualify-blender-e2e.mjs`, `YAMAKAN_QUALIFY_RECEIPT`). The ledger
(`docs/research/YAMAKAN_SYSTEM_SUPREMACY_REA/12_EXECUTION_AND_CONTINUATION_LEDGER.md`) records two
figures, neither checkable from the repository:

- 89 s for 30 frames at 320×180 with Cycles CPU, including the first full install check
  (`qualify:blender-slice`);
- a "full 34 s render" at 320×180 (`qualify:cinema-blender`, at `38e9b12`).

**Not measured: the limit corner** (1280×720, 120 frames, 32 samples) against the 30-minute wall.

- Scaling 34 s by pixels (×16) and frames (×4) alone gives 2,176 s [ASSUMED].
- Fixed per-frame overhead makes linear scaling uncertain in both directions.
- No Stage 5 card measures the corner's render time. MPR-507 (Stage 2) runs the corner on the
  founder host to measure memory: three runs under the 4 GiB limit, then three under the new limit.
  Every run must succeed, so a passing run also finished inside the 30-minute wall.
- No card records the corner's render time as a result of its own.
- The scene limits and the wall limit are not changed in advance.

## 6. Revision cost model

> **Cost to an accepted shot** = g × (W + Q) + R

| Term | Meaning |
|---|---|
| g | generations to accept |
| W | wall-clock per generation, including queue |
| Q | quota-hours or money per generation |
| R | collateral rework (repairing anything else the revision changed) |

**g and R are illustrative assumptions.** Neither has been measured for Yamakan or any competitor:
**NOT TESTED**. [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md) exists to measure
generations-to-accept and the collateral-change rate.

Inputs:

- **Yamakan, Kaggle, Wan 2.2 TI2V-5B** (704×480, 3.375 s): W = 1,092 to 1,213 s measured (section 4),
  plus a queue of 0 to 1,995 s as observed. Q = 0.30 to 0.34 quota-hours [ASSUMED]. Money: none.
- **Hosted credits, Higgsfield:**
  - Kling 3.0, 8 s, 1080p: 20 credits, which the vendor equates to about USD 1.00 [CLAIM].
  - Seedance 2.5, 8 s, 1080p: 72 credits, about USD 3.60 [CLAIM].
  - Source for both: Higgsfield blog, 15 Sep 2026, https://higgsfield.ai/blog/credits-vs-unlimited-ai-video-generation.
  - Re-rolls consume credits [DOC] (https://higgsfield.ai/creator-hub/help-center/credits/how-credits-work.md).
  - Plus plan: USD 59 for 1,200 credits [IND, competitor, captured 31 Aug 2026]
    (https://www.krea.ai/blog/higgsfield-pricing-explained-2026-unlimited-credits-and-real-monthly-costs).
  - Hosted W is [UNKNOWN].

| g (illustrative) | Yamakan W (no queue) | Yamakan Q (share of 30 h) | Accepted shots/week (quota-bound) | Kling 3.0, 8 s 1080p | Seedance 2.5, 8 s 1080p | Kling 3.0 accepted shots per Plus month |
|---|---|---|---|---|---|---|
| 2 | 36 to 40 min | 0.6 to 0.7 h (2.0 to 2.2 %) | 44 to 49 | about USD 2.00 | about USD 7.20 | 30 |
| 4 | 73 to 81 min | 1.2 to 1.3 h (4.0 to 4.5 %) | 22 to 24 | about USD 4.00 | about USD 14.40 | 15 |
| 8 | 146 to 162 min | 2.4 to 2.7 h (8.1 to 9.0 %) | 11 to 12 | about USD 8.00 | about USD 28.80 | 7 |

**The rows are not comparable outputs.** Model, resolution, length and quality differ, and nothing
has been judged. The table shows only structure:

- On the Kaggle route a rejected take costs time and allowance, never money, so H-C (no surprise
  spend) holds by construction.
- On a credit model, every rejected take is money spent.
- For both, lowering g or keeping R near zero (H-A, H-B, NOT TESTED) is worth more than any
  per-generation saving.

R today: a take replacement is one undo step, but only for a shot with exactly one clip
(`core/takes.ts` `shotClip`). MPR-105 lifts that limit.

## 7. Performance budgets for the proposed work

### 7.1 Generation record size and the story limit (MPR-101)

Byte counts are canonical JSON. `Id` is a UUID (`core/project.ts` `Id`), and hashes are 64 hex
characters.

| Item | Bytes per take |
|---|---|
| Take without lineage | 115 |
| Take with minimal lineage (`outputHash`, empty `inputs`), as written today | 219 |
| With Create's label ("seed 7, steps 30, Wan-AI/Wan2.2-TI2V-5B-Diffusers") | about 281 |
| Inline record: about 1 KiB of fixed fields [ASSUMED] + prompt (≤ 4,000 UTF-16 units, so ≤ 12,000 UTF-8 bytes), as MPR-101 estimates | about 1 to 13 KiB |
| Reference by hash, `,"recordHash":"<64 hex>"` (the field MPR-101 adds) | 80 |

At the story maximum, 200 shots × 8 takes = 1,600 takes:

- **Inline records.** 1,600 × 1 KiB = 1,638,400 bytes, 6.25 times `STORY_LIMITS.documentBytes`
  (262,144). With maximal prompts it is about 80 times. Even one record per shot (204,800 bytes
  before any prompt) takes 78 % of the limit. **Inline is not feasible.**
- **Without records.** 1,600 × 219 = 350,400 bytes already exceeds the limit. The byte limit binds
  before the count limits, and the schema refuses an oversized story, so this limits capacity and is
  not a safety gap.
- **With hash references.** At 299 bytes per take plus about 186 per shot, a 200-shot story holds
  about 752 takes (3.8 per shot), against about 1,027 without the reference. MPR-101 assumes a
  larger take and estimates about 3.5 per shot; its limits test pins the figure.
  - Create writes the prompt into shot `notes` today (`src/create/create-story.ts` `addMadeVideo`,
    up to 2,000 characters).
  - Moving the prompt into the record frees up to that much per shot.
- **Not as project documents.** Records cannot be project document entries, because
  `DOCUMENT_LIMITS.documentsPerProject` is 32 (enforced in `core/canonical.ts`).

**Recommendation for the card**

MPR-101 as written settles each point:

- The record is an immutable content-addressed object of its own document kind, named by hash from
  the take.
- Each record is capped at 16 KiB (16,384 canonical bytes). At the maximum that is at most 25 MiB
  per story (1,600 × 16,384 bytes).
- Its limits test reports how many shots and takes fit in the byte limit.
- It weighed four storage alternatives. A dedicated table is rejected unless review finds a reader
  of story versions that does not filter by kind. A take-id index is not planned. The output hash
  alone could not key one, because identical requests gave a byte-identical video
  (`docs/evidence/ultimate/first-ai-video.md`).

### 7.2 Proposed bounds

The latency targets are proposals for the idle host. Their basis:

- measured edit ≤ 23 ms, reopen ≤ 17 ms and batch save ≤ 29 ms (`docs/evidence/ultimate/editor-scale.json`);
- `reopen` p95 1,012 ms including service start (`docs/evidence/qualification/t10-release.json`).

All bounds sit inside the 2 MiB `requestBytes` and `snapshotBytes`. None adds a worker or a
concurrent job.

| Proposal (card) | Count bound | Byte bound | p95 target | Notes |
|---|---|---|---|---|
| Record read / revise draft (MPR-101, MPR-103) | 1 record, ≤ 8 inputs, ≤ 16 changed fields | ≤ 16 KiB | ≤ 100 ms (this document's target) | One row read by its hash |
| Shot history (MPR-107) | ≤ 8 takes; ≤ 100 attempts per page, cursor | ≤ 128 KiB per answer | ≤ 250 ms, worst of 20 calls (the card's figure) | Totals come from a bounded scan: ≤ 5,000 job rows, ≤ 2,000 notes |
| Preflight (MPR-203) | 1 request; ≤ 16 refusals | ≤ 64 KiB | ≤ 250 ms, local (this document's target) | Starts no process and opens no connection; reads ≤ 200 job rows |
| Capability report (MPR-202) | today 30 cells; cap 960 cells (64 entries × 3 routes × 5 operations) and 32 refusals | ≤ 512 KiB | ≤ 250 ms (this document's target) | No network; refuses past either bound |
| Events read (MPR-502) | 1 to 200 per page, default 100; ≤ 5,000 rows scanned (the existing clamp in `core/store.ts` `events` is 1,000) | about 120 B/event | ≤ 100 ms (this document's target) | Cursor `event_id` from `outbox` |
| Job wait (MPR-502) | ≤ 25 s per call; ≤ 4 per principal, ≤ 32 in all | the job status shape | within 250 ms of a change (the card's figure) | Bounded long poll, no new scheduler |
| Export manifest (MPR-701) | ≤ 200 clip entries, ≤ 200 media | ≤ 1 MiB | build ≤ 100 ms (the card's proposed budget) | Stored hashes; one streamed hash of the output |
| Blender queue (MPR-507) | ≤ 4 waiting, ≤ 2 per principal | n/a | n/a | Still one at a time, within `activeJobs` |
| Agent budgets (MPR-505) | generations, quota seconds, currency, egress bytes, optional local job seconds, end date | n/a | at the gates | The default is zero |

Each card sets its count and byte bounds. MPR-107, MPR-502 and MPR-701 state the latency figures
marked as the card's. MPR-505 and MPR-507 each state a figure under 5 ms for their own check (the
budget check and the queue claim). The other p95 targets are this document's proposals, and no card
measures them.

## 8. Disk and memory reality

Every ready object referenced by a retained revision is kept. "Disk pressure blocks new work rather
than deleting history" (`docs/OPERATIONAL_CONTRACTS.md`, "Assets, backup and recovery"). A rejected
take stays on disk while any retained revision names it. Per project the store allows ≤ 200 assets
of ≤ 4 GiB each, and every import keeps 256 MiB free.

| Consumer | What the code or receipts show |
|---|---|
| Kaggle clips | 67,660 to 785,334 bytes each (`docs/evidence/ultimate/kaggle-*-notebook-receipt.json`); 100 clips < 80 MB. The temp fetch folder is capped at 512 MiB + 2 MiB and kept ≤ 24 h (`core/engines/kaggle.ts` `VIDEO_BYTES`, `FOLDER_KEEP_MS`). |
| Edit proxies | ≤ 2 × source, 64 MiB to 1 GiB each, within half the space above the reserve. No cross-project budget. Thumbnails cached ≤ 64 MiB (`docs/OPERATIONAL_CONTRACTS.md`, "Edit proxies and thumbnails"). |
| Preview cache | ≤ 256 MiB per project (`previewCacheBytes`). |
| Blender install | The pinned 5.3.0 tree. The code mentions a 120 MB executable and about 96 MB of debug symbols left out (`core/blender/runtime.ts`, `scripts/blender-install.ts`). **Total installed size: not found.** |
| Blender render, temporary | Corner: 120 × 1280 × 720 × 4 × 2 + 64 MiB = 951,844,864 bytes (about 908 MiB). Up to about 1.4 GiB with 8 models, plus plate footage (arithmetic). |
| Exports | Synthetic: 750,183 bytes (S) and 6,782,341 bytes (T) (`docs/evidence/ultimate/editor-scale.json`). Real footage is larger [ASSUMED]. |
| Backups | A full, hash-verified byte copy of every referenced object plus the database (`core/recovery.ts` `copyVerified`), so each backup needs as much space as the objects it holds. |
| Workspace budgets | Studio bitmaps ≤ 8 GiB, documents ≤ 4 GiB, 3D models ≤ 8 GiB (`DOCUMENT_LIMITS`). |

**Garbage collection** runs at start and hourly (`server/main.ts`), or on demand through
`yamakan.workspace.collectGarbage`.

- What it removes (`core/store.ts` `collectGarbage`), once older than a 1-hour grace period:
  unregistered objects, temporary and staging files, hidden VFR originals, and unreferenced Studio
  bitmaps and Cinema models.
- What it never touches: registered objects. It skips a run while a backup holds objects.
- **No retention policy for old revisions or rejected takes exists.** One would trade
  recoverability (H-D) for disk, so it is a founder decision.
- **Nothing in this plan frees disk held by registered objects.** A search of the command
  registry for delete, remove and purge finds only `yamakan.transition.remove`, and no card adds
  a command that deletes a project or an asset. When the reserve is reached new work is refused,
  and space comes back only by removing workspace data outside the product, which removes its
  history as well.

**Memory.** The budget gap is in section 2. `RESOURCE_POLICY` limits Yamakan's own requests, jobs
and workers: the service does not read the PC's free memory before it admits work, and the
browser's memory is outside those limits. The Kaggle CLI runs outside procd through `execFile`
with a 4 MiB output buffer. It has no Job Object memory limit, and its use is unmeasured
[UNKNOWN]. MPR-205 names the 4 MiB cap. It adds no memory limit and no measurement.

**First-run sample (MPR-604).** No sample project exists today. MPR-604 plans to:

- build it locally from FFmpeg test patterns with the bundled FFmpeg, with no download and no fonts;
- keep it ≤ 64 MiB (the S-profile workspace was 1,863,291 bytes, `docs/evidence/ultimate/editor-scale.json`);
- refuse to build it when free space is below the reserve plus 64 MiB;
- include no generated clip.

Removing the sample in one step is not planned: there is no project delete command, and MPR-604
adds none.

## 9. Engineering cost and capacity

- **One implementation owner** (Opus). One card is one pull request, or a few parts under one id
  (MPR-507 has three), built in series. FD-11 sets
  the order: the in-flight Blender pull requests first, then Stage 1.
- **CI**
  - The repository was read as public on 2026-11-12 (`gh repo view`). FD-8 records that full
    Windows CI is free of charge there and costs CI time only. GitHub's pricing page was not
    re-read.
  - Today `npm test`, the build and the E2E run only on `ubuntu-24.04`.
  - The one `windows-latest` job (`qualify-windows-r8`, 20-minute timeout) runs three test files and
    a probe (`.github/workflows/qualify.yml`).
  - MPR-804 adds `npm test`, the studio tests and `cargo` on Windows. Their runtime there is
    unmeasured.
  - The suite at `38e9b12` had 1,335 tests (ledger 12).
  - The real-Blender tests need the pinned zip on the runner. Whether FD-8 covers fetching it is
    part of that decision.
- **Runs that need the idle founder host** (not CI):
  - policy timings: `npm run qualify:release`, `qualify:preview`, `qualify:playback`, `qualify:resources`;
  - `qualify:large-import`: a 2,239,490,938-byte fixture plus its imported copy, about 4.2 GiB by
    arithmetic, plus the reserve;
  - `node scripts/qualify-editor-scale.mjs`: the M export alone takes up to 480 s;
  - real Blender: `qualify:blender-slice`, `qualify:cinema-blender`, `qualify:director-cinema`;
  - Kaggle: `qualify:kaggle`, `qualify:kaggle-first-frame`, `qualify:kaggle-cogvideox`. Each takes
    about 20 min and 0.3 quota-hours, and needs the founder's go-ahead.
- **Queueing**
  - Run one at a time, in a window when the owner is not building, on AC power.
  - Record load and power state first (`docs/evidence/ultimate/SS-009-preview-qualification.md`).
  - A Kaggle run mostly waits on Kaggle. It may overlap local work, but never a timing measurement.

## 10. Feasibility by roadmap stage

Stage contents are defined in [08_ROADMAP.md](08_ROADMAP.md).

| Stage | Hardware | Money | Human time | Waits on |
|---|---|---|---|---|
| 0 Truth and frontier | Nothing new | None | Documentation and CI pull requests | FD-1 (MPR-001), FD-8 (MPR-804) |
| 1 The Revisable Shot | Nothing new. Demonstrations use about 0.3 quota-hours per generation | None | First card batch. Kaggle runs need the founder's go-ahead | FD-2, FD-11 |
| 2 Governed execution | Nothing new. Loopback fakes (MPR-210) | None | Gates, catalog, MCP, agent cards | FD-10 (one part of MPR-205). No Stage 2 card waits on FD-3 or FD-5; MPR-211 and MPR-222 are in Stage 6 |
| 3 Editor depth and interchange | Nothing new. M export is still unqualified | None | UI and export cards. Arabic review by a human (MPR-606) | FD-2 (MPR-701, prompt text in the export report only). FD-3 and FD-4 change only the wording of MPR-604's banner |
| 4 Consistency and control | Nothing new for the registry and schedule | None | Volunteer raters (MPR-405) | MPR-404 is deferred until an authorised control route exists (FD-3, FD-4 or FD-5). MPR-405 needs FD-3, FD-4 or FD-5 for real results and FD-6 for outside raters. MPR-403 waits on the Blender stream (FD-11) |
| 5 Qualification and benchmark | The idle founder host; Kaggle quota | The competitor arm needs paid access | Raters, an operator | FD-3, FD-6, FD-7 (MPR-801, MPR-803). MPR-802 needs FD-3 for its Arm 1 only; its Arm 0 needs no decision. MPR-805 needs no decision |
| 6 Gated expansions | Weights (Tier 0 CPU or Tier 1+ GPU), or the customer's provider account | The customer's own, never Yamakan's | Legal review | FD-4 (MPR-220, MPR-221), FD-5 (MPR-211, MPR-222) and FD-9 (MPR-508), separately |

- **Need nothing new:** stages 0, 1, most of 2, and 3.
- **Wait on a founder decision or an outside party:** stages 4 to 6, each in at least one part.

## 11. Risks

| Risk | Evidence | Mitigation |
|---|---|---|
| **Host contention** with the owner's builds and tests | Playback 8.1 and 10.9 fps contended, 25 fps quiet. Host CPU at 82 % before one export probe (`docs/evidence/ultimate/SS-009-preview-qualification.md`, `docs/evidence/ultimate/render-optimization-yu026e.json`) | Agreed quiet windows on AC power, with load and power recorded. A contended failure is repeated, never waived or re-thresholded. Routine tests move to Windows CI (MPR-804). |
| **Disk exhaustion**: little space, history kept, full-copy backups, no cross-project proxy budget | `specs/CURRENT.md`; `docs/OPERATIONAL_CONTRACTS.md`; `core/recovery.ts` `copyVerified` | The existing reserve checks refuse work rather than corrupt it (imports, `#runBlender`, Kaggle `bounded`). No card shows disk bytes in preflight (MPR-203 reports seconds and refusals). The sample stays ≤ 64 MiB. Backups go to another volume where one exists. Retention only by founder decision. |
| **Kaggle quota or terms change**; no remote cancel | `docs/evidence/ultimate/kaggle-quota-refusal-receipt.json`; `core/engines/kaggle.ts` `requestCancel`; terms [UNKNOWN] | FD-3 decides scope. The refusal path already reports Kaggle's words (`REFUSED_PUSH`). MPR-205 shows quota facts with remaining quota unknown, and reports that a run cannot be cancelled remotely. Stages 0 to 3 use Kaggle only for demonstrations. Without it, editing, Blender and import still work. |
| **Measurement noise**: single borderline runs show no margin | M export finished in 2 of 5 runs (`docs/evidence/ultimate/render-optimization-yu026e.json`). Playback 25 fps with a worst one-second window of 17 fps (`docs/evidence/ultimate/SS-009-preview-qualification.md`) | Report every run. Use the policy's run counts and p95. Bind receipts to a commit and a clean tree. A borderline pass reads "met once, margin not shown". |
| **The memory budget omits Blender** | Section 2: 9,516 against 8,192 MiB (arithmetic) | Gate review ([11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md)). MPR-507 measures the Blender worker and lowers its limit (section 2). The policy is not edited to pass. |
| **The Blender corner is unmeasured** | Section 5 extrapolation [ASSUMED] | MPR-507 runs the corner in Stage 2 to measure memory, and each run must finish inside the wall limit. No card records the render time as a result of its own (section 5). Director defaults stay small (`core/director/cinema-shot.ts`, 8 samples). A wall-limit stop is a typed failure. |

See also [03_GAP_AND_DEPENDENCY_ANALYSIS.md](03_GAP_AND_DEPENDENCY_ANALYSIS.md),
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md), [13_ADVERSARIAL_REVIEW.md](13_ADVERSARIAL_REVIEW.md),
[FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md) and [SOURCES.md](SOURCES.md).
