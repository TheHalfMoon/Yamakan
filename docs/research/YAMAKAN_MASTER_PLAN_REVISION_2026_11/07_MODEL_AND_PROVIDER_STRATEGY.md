# Model and provider integration strategy

> Status: PROPOSED — planning only. Not authority until founder review.
> Baseline: `main` at `7b1ca46ce20efaa603be12b51d57aee04a3f5f72`, verified 2026-11-12.

Part of the proposed revision. System placement is in
[05_TARGET_ARCHITECTURE.md](05_TARGET_ARCHITECTURE.md), the cards in
[09_TASK_PROGRAM.md](09_TASK_PROGRAM.md), gates and licensing in
[11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md](11_GATES_SECURITY_PRIVACY_RESOURCE_LICENSING.md),
cost and hardware in [12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md](12_COST_PERFORMANCE_HARDWARE_FEASIBILITY.md).
External facts come from research notes accessed 2026-11-11 and carry one label each: `[DOC]`
first-party documentation, model card or licence text; `[CLAIM]` vendor marketing; `[IND]`
independent third party; `[ASSUMED]` our inference; `[UNKNOWN]` not established. Nothing is
`[TESTED]`: this project has run none of the hosted models or local runtimes named here. Keys
such as S13 resolve in section 10.

## 1. Strategy in one paragraph

Models are replaceable inputs to a production record. Yamakan's value is that a shot stays a revisable, attributable object with a stated cost whichever model made it, so the platform defines the
operations (what "image to video from a first frame" means, with typed limits) and an adapter
either implements a definition exactly or declares it unsupported; providers never define the
vocabulary. A model is offered only when it is catalogued under an exact identity (host, slug,
revision, variant), its licence fields are complete and machine-checked, its capability cells
were measured on the route and hardware tier that will run it, and a preflight of the specific
request has shown the estimate and what leaves the PC. Nothing leaves the PC or uses a remote
allowance without an approval recorded in the existing SQLite authority by a human-only command.
The product downloads nothing, and no approval in this build can open a download or authorise a
money charge (MPR-204).
Success is revision cost, lineage completeness and zero surprise spend (see
[00_VISION_AND_DIFFERENTIATION.md](00_VISION_AND_DIFFERENTIATION.md)), never the number of
integrations.

## 2. What the code does today

Verified by reading the files at the baseline. No tests or builds were run.

### 2.1 Engine layer at head

| File and symbols | What it is | Maturity |
|---|---|---|
| `core/engines/contract-v2.ts` `EngineAdapterV2`, `Operation`, `CapabilityV2Schema`, `CancellationSchema`, `AttemptFence` | Operation-based contract. `Operation` has five values: `textToVideo`, `imageToVideo`, `videoEdit`, `transcribe`, `enhance`. A capability is `available` with measured constraints or unavailable with a reason; cancellation reports `remoteOutcome` and `billingOutcome`; `submit` may answer `uncertain`. No quote, estimate or dry-run method. | Contract enabled; only `textToVideo` and `imageToVideo` have a running adapter. |
| `core/engines/generation.ts` `createGenerationService`, `GenerationRequest`, `GenerationRecipe`, `GenerationLineage` | One service before any adapter: consent check (`permittedToSend`), record before send (`ledger.begin`), an uncertain send is followed and never resent, import verified by length and SHA-256. Recipes are limited to two operations; the request hard-codes `audio: false` and `leaseGeneration: 1`. Lineage keeps `promptHash`, not the prompt; the generation ledger row keeps the prompt. | Enabled; used by Kaggle. |
| `core/engines/kaggle.ts` `createKaggleEngine`, `KAGGLE_RECIPES`, `kaggleCli`, `kaggleCliEnvironment` | Runs the person's own Kaggle CLI with plain `execFile` outside `yamakan-procd`; the environment allow-list passes `KAGGLE_*`, proxy and CA-bundle variables. Pushes a private notebook with GPU and internet on; work folders default to `tmpdir()`. `capabilities()` returns `[]`; `requestCancel` asks Kaggle nothing. | **Working; the only generation path.** Env-gated (`YAMAKAN_KAGGLE_CLI`, `YAMAKAN_KAGGLE_USERNAME` read in `server/main.ts`); not gated by `ENGINE_ENABLED`. |
| `core/engines/comfyui.ts` `createComfyEngine`, `PINNED_COMFY_RECIPES`, `comfyStartProblems`, `isComfyCloudNode`, `probeComfy` | Adapter for a person-started ComfyUI at a numeric loopback address; requires `--offline` and `--disable-all-custom-nodes`; flags partner ("cloud") nodes. | Tested, unreachable: no recipe pinned, flag off. Its branch of `generationOf` (`core/command/registry.ts`) passes no durable ledger. |
| `core/engines/manifests.ts` `PINNED_MODEL_MANIFESTS`, `ACCEPTED_MODEL_LICENSES`, `HostProfile`, `discoverEngineCapabilities` | Local weights discovery; accepted licences `apache-2.0`, `mit`, `bsd-2-clause`, `bsd-3-clause`; default host `{ memoryBytes: totalmem(), gpu: false }`. | Stub: no pins; with the flag off every operation reports `ENGINE_DISABLED`; the service never sets `modelRoot`. |
| `core/engines/contract.ts` `ENGINE_ENABLED` | v1 contract and build flag. | `false`. |
| `core/engines/candidates.ts` | YU-043 evidence schema over `docs/evidence/ultimate/engine-candidate-manifests.json` (Wan2.2-TI2V-5B native `blocked`; Wan2.2-TI2V-5B Diffusers and CogVideoX-2b Diffusers `eligibleForQualification`). | Validation only. |
| `core/engines/reasons.ts` `ENGINE_REASON_MESSAGES` | Messages for `ENGINE_DISABLED`, `WEIGHTS_ABSENT`, `HARDWARE_UNQUALIFIED`, `RIGHTS_UNQUALIFIED`; other codes get a generic sentence. | Enabled. |
| `core/engines/fake.ts`, `v1-bridge.ts`, `clean-image.ts` | `createFakeEngineV2` for tests; v1 bridge over fake recipes; metadata-free re-encoding of a first frame. | Fakes test-only; `clean-image.ts` used by Kaggle. |
| `core/router/explain.ts` `ROUTER_PROVIDERS_ENABLED`, `explainRoutes` | Route explanation; `remainingBudgetMinor` parsed, unused. | Stub: flag `false`, always `eligible: []`. |
| `core/audio/transcription.ts` `WHISPER_CPP` | Transcription contract; whisper.cpp v1.9.5 (MIT) pinned by commit; `silencedetect` stand-in. | Stub: `yamakan.audio.transcribe` always `CAPABILITY_UNAVAILABLE`. |
| `src/create/create-model.ts` `CREATE_MODELS` | Create's own copy of two models' facts; `PROMPT_LIMIT` 2000 against `ENGINE_V2_LIMITS.promptChars` 4000. | Enabled; duplicate list. |
| `scripts/kaggle/` | `run.py` per recipe: version-pinned (not hash-pinned) `pip install`, weights from Hugging Face at a pinned revision on Kaggle, receipt. Two committed `kernel-metadata.json` files carry an account-prefixed notebook id (FD-10). | Enabled through the adapter. |

Commands: `yamakan.generation.options` (`project:read`; `route: "kaggle"` and offered recipes
with licence, `expectedSeconds`, `timeoutSeconds`, or `route: null`); `yamakan.generation.start`,
`.cancel`, `.import`, `.dismiss` (`project:write`, human-only, refuse a request id; start has no
shot target; cancel only stops following; import never touches the timeline);
`yamakan.generation.status`, `.list` (read); `yamakan.engines.capabilities` (read; all
`ENGINE_DISABLED`, silent about Kaggle); `yamakan.engines.comfyui` (read-only probe);
`yamakan.router.explain` (always empty).

### 2.2 The Kaggle recipes (`KAGGLE_RECIPES`)

| Recipe id | Model @ revision | Licence | Operation | Output | Steps | Timeout / expected |
|---|---|---|---|---|---|---|
| `kaggle-wan22-ti2v-5b` | `Wan-AI/Wan2.2-TI2V-5B-Diffusers` @ `b8fff73…` | Apache-2.0 | `textToVideo` | 704x480, 81 frames, 24 fps, silent | 30 | 3600 s / 1132 s |
| `kaggle-wan22-ti2v-5b-first-frame` | same | Apache-2.0 | `imageToVideo`, first frame only | same | 30 | 3600 s / 1132 s |
| `kaggle-cogvideox-2b` | `zai-org/CogVideoX-2b` @ `1137dac…` | Apache-2.0 | `textToVideo` | 720x480, 49 frames, 8 fps | 50 | 3600 s / 1125 s |

All are `offered: true`, with real runs in `docs/evidence/ultimate/first-ai-video.md`; a weekly
quota refusal is kept in `docs/evidence/ultimate/kaggle-quota-refusal-receipt.json`. The research
agrees on the licences: Wan 2.2 and CogVideoX-2B are Apache-2.0 [DOC] (S76, S100).

Consequences: generation works only by sending a prompt, and optionally a cleaned still, to the
person's notebook; the founder host runs no model. "Zero unapproved spending" and "no unapproved
downloads" hold by absence of code, not by a gate (see
[02_CURRENT_ARCHITECTURE_ASSESSMENT.md](02_CURRENT_ARCHITECTURE_ASSESSMENT.md)). Model facts live
in six places (`KAGGLE_RECIPES`, `PINNED_COMFY_RECIPES`, `PINNED_MODEL_MANIFESTS`,
`candidates.ts` with its evidence file, `CREATE_MODELS`, the research snapshot
`docs/evidence/yamakan/provider-registry.json`), and two commands describe capability.

## 3. Target design, mapped to cards

Cards are specified in [09_TASK_PROGRAM.md](09_TASK_PROGRAM.md).

**MPR-201 One model catalog.** *What:* a proposed new file `core/engines/catalog.ts` (it does not
exist; declare it in `localFilesInDonorRoots` of `docs/provenance/import-policy.json`) with one
entry per identity tuple (host, slug, revision, variant): operations, typed limits, licence facts
(a record only; the gate is MPR-208), lifecycle `candidate → qualified → offered → retired`,
`verifiedAt`, source URL, and negative entries. One test checks the first five lists above against
it; this card derives none of them from it, and the research snapshot names no runnable model.
*Why:* a family name is
not an identity. MiniMax H3 open is the 768p base without the hosted 2K stage; LTX-2.5 hosted
lacks the retake and extend of the open pipelines [DOC] (S85, S42, S88); aliases move
(`gemini-omni-1.1-flash` now routes to 1.2) [DOC] (S6); Sora's API, Nova Reel and Moonvalley are
gone [DOC] (S1, S68, S46). *Customer sees:* one list with the exact version that ran, its licence
and state; a retired model stays named on old takes.

**MPR-202 Three-state capability cells.** *What:* `yamakan.engines.capabilities` returns route ×
model × operation cells, `supported`, `unsupported` or `unverified`, each with source, date,
typed limits and reason codes; `yamakan.generation.options` becomes a projection. *Why:* in the
research matrix "not mentioned" dominates; seed, cancel and webhooks are undocumented for most
hosted video APIs [DOC] (S5, S13, S26, S30, S38, S41). A vendor claim alone (Seedance reference
counts [CLAIM] S9) is `unverified`. Today the live adapter reports nothing. *Customer sees:* what
works, what does not, and what is untested, with date and source.

**MPR-203 Preflight with estimate and egress disclosure.** *What:* read command
`yamakan.generation.preflight`: normalised request, refusals, an estimate (unit seconds, with no
currency field; low, high, worst case; basis `static` or `historical`; as-of date), quota reported
as `unknown` with what is known, what leaves (bytes, host, account), a reference delivery report,
the state of each gate and a `preflightHash` that start requires once part b lands. The type names
a `liveQuote` basis, which no route produces; that tier and a provider's post-run usage record
belong to the MPR-210 profile, which stays off. *Why:*
units differ (per second, fixed-value units, credits with no currency value, video tokens, per
image, per megapixel) [DOC] (S3, S11d, S16, S21, S27, S39, S107); minimums and input billing exist
[DOC] (S21, S16); live quotes exist at LTX, fal, OpenRouter, Runware [DOC] (S39, S50, S58, S60);
a model-chosen duration cannot be priced [DOC] (S11a). Today only time is shown. *Customer sees:*
before start, "about N minutes, uses your Kaggle quota, this prompt and picture leave the PC". A
dated range in a provider's own unit would come only with the MPR-210 profile.

**MPR-204 Default-deny gates.** *What:* three gates named `egress`, `spend` and `download`. Egress
and spend approvals are recorded in SQLite through a human-only command; the download gate always
refuses, and no approval of that kind can be recorded. An approval binds to kind, route, host,
account, purpose, expiry, a run limit and a unit limit (seconds or bytes); it has no currency
column, so it cannot authorise a money charge in this build. Negative tests prove nothing is sent
without one. The card needs no founder decision. *Why:* the guarantees hold by absence of code
today; outputs can expire in 10 minutes to an hour (BFL, Replicate, Luma) [DOC] (S108, S55, S26),
so a later hosted route must fetch its result at once without a second prompt; this card does not
build that. *Customer sees:* an approval naming what leaves, to which host and account, for which
purpose and within which limits, and a list of approvals.

**MPR-205 Contain the Kaggle route.** *What:* named and tested environment lists in place of the
`KAGGLE_` prefix rule, a work folder the service owns, named output and time caps, a tested CLI
version check, "cannot cancel remotely" copy, quota facts (remaining quota is reported as
`unknown`), and, in part b, the account id templated out of the two committed
`kernel-metadata.json` files under `scripts/kaggle/`. *Why:* `kaggleCli` runs outside procd with
network and credentials; folders sit in `tmpdir()`; no quota accounting. The environment is
already an allow-list, and `kaggleCliEnvironment` passes eleven proxy and certificate-bundle
variables on purpose, so that a CLI behind a proxy works. The card keeps that pass-through as a
named exception, written in `docs/SECURITY.md`, pinned by a test and disclosed as two booleans in
`yamakan.generation.options` and in the preflight (MPR-203); it does not strip them. The card
narrows what it inherits; it does not sandbox the CLI. FD-10, for part b only; the containment is
the same whichever way FD-3 goes.
*Customer sees:* that a sent run cannot be stopped, what is known about quota, whether a proxy or
certificate override is set, and no account id in files.

**MPR-206 Operation vocabulary and conformance kit.** *What:* an operation is added only with a
written definition, an adapter, fake-adapter conformance and qualification evidence; the kit
(every `EngineAdapterV2` against `core/engines/fake.ts`) checks job id persisted before polling,
restart reconciliation, cancel semantics, artifact hash, no resend of an uncertain submit, and
carries the intake checklist (7.1). *Why:* one word, several operations. "Extend" is end-only at
Gemini Omni, by generation id at Luma, absent at Kling 4.0 and LTX-2.5; "edit" is conversational,
in-context or masked; a last frame is honoured by Veo, Kling and Seedance but reported ignored for
Grok and Wan [DOC] (S5, S26, S12, S42, S23, S81, S69). The Wan recipe already refuses a last frame
it would ignore. Image, speech, music and lip sync are not operations, and this card adds none. It
defines the five contract operations in a new `docs/ENGINE_OPERATIONS.md`, leaves
`core/engines/contract-v2.ts` unchanged, writes the five steps for adding an operation, and lists
the further names in `docs/MODEL_CAPABILITIES.md` as proposed only. *Customer sees:* a
request runs as defined or is refused with a reason.

**MPR-207 Typed failures; retry is a new attempt.** *What:* classes (refused by policy, quota
exhausted, provider rejected, timeout, lost job, invalid artifact, cancelled, unknown) with "may
still be billed" and advice; no automatic resubmission. *Why:* only Vercel documents an
idempotency key; Runware and Alibaba warn a resend is a second billed job [DOC] (S69, S60, S36);
Runway charges moderated requests while Luma, Vidu and Seedance do not charge failures [DOC] (S23,
S27, S31, S11d). *Customer sees:* why, whether they may have paid, and a retry that shows a new
preflight.

**MPR-208 Licence gate.** *What:* a licence block (`yamakan.model-licence/v1`) with the fields
`code`, `weights`, `baseModel`, `bundled`, `revenueCap`, `territorialExclusions`,
`hostedServiceRight`, `outputUse`, `watermark`, `gated`, `attribution`, `sourceUrl`, `verifiedAt`
and `evidence`. A model is not offered when the block is absent, any field is unknown, the
evidence is not first-party documentation, a licence is outside the accepted lists, commercial use
is not allowed, or there is any revenue cap, territorial exclusion, output-use restriction or
gating; a hosted run (a Kaggle run counts as one) also needs the hosted-service right. A test
fails on an incomplete offered entry. *Why:* licence is the main selection constraint: non-commercial weights behind
permissive code (F5-TTS, MMAudio, MusicGen), territorial exclusions (Tencent Hunyuan; MiniMax H3
also the US), revenue caps (LTX-2.x, FLUX 3 Klein, SD 3.5), a licence change inside a family name
(Qwen-Image 2.1), InsightFace models inside permissive pipelines [DOC] (S86, S89, S92, S109,
S116, S126; V-F5, V-MMA, V-MUS, V-INS). The research also asks for gating, an attribution or
UI-branding duty, and maintenance status [DOC] (S86, S23, V-CHB): the block holds the first two,
and maintenance status is the catalog lifecycle state (MPR-201). Today
`ACCEPTED_MODEL_LICENSES` is not applied to Kaggle recipes. *Customer sees:* a refusal shown as
`RIGHTS_UNQUALIFIED` for a model that fails the rule; the route's licence terms before starting a
run (MPR-209).

**MPR-101 Generation record on every take.** *What:* an immutable, content-addressed record
(route, recipe id and hash, model identity, operation, full request with prompt and seed, input
pins with roles, timings, usage, `derivedFromTakeId`, `changedFields`) referenced by hash. FD-2.
*Why:* seeds are not a guarantee (none on Seedance 2.x or Kling 4.0; not guaranteed on Wan) [DOC]
(S11a, S13, S36); the request is what can be kept [ASSUMED]. *Customer sees:* on every take, what
made it, with which words and inputs, at what cost, and what changed.

**MPR-103 Revise from a take.** *What:* the stored request returned as a draft with a capability
check against today's catalog; the new take records `derivedFromTakeId` and `changedFields`;
placement through `yamakan.take.proposeReplace` and `yamakan.take.apply`. *Why:* models retire and
limits change (5.3); the clip interior is flattened pixels, so whole-shot regeneration is the
honest revision (rung L1). *Customer sees:* "Revise this shot" with anything no longer possible
flagged, and the new take beside the old.

**MPR-210 Provider contract with a fake provider.** *What:* the provider profile of
`EngineAdapterV2` (credential reference, never the value; submit, poll, download; usage; estimate
tier) proven against a loopback fake provider; no real provider code. The profile is built off
(`PROVIDER_PROFILE_ENABLED` false) and building it needs no founder decision; activation waits for
FD-5, MPR-211 and MPR-222. *Why:* aggregators
normalise the job envelope, not parameters [DOC] (S51, S58, S60, S69); a fake can exercise lost
submits, queued-only cancel, charge on moderation and one-hour expiry with no key or charge.
*Customer sees:* nothing until FD-5; then provider runs behave like Kaggle runs.

## 4. Route types

| Route | Who pays | What leaves the PC | Cancel semantics | Failure modes | Estimate possible | Status in Yamakan |
|---|---|---|---|---|---|---|
| **Local runtime on this PC** | Nobody in money; time, energy, disk. | Nothing, inside procd (engine profile `gpu: "none"`, `network: "none"`, `core/process/owner.ts` `ENGINE_WORKER_PROFILE`). | Reliable: process tree ended through the Job Object. | Memory or VRAM exhaustion, disk, wall limit, laptop thermals, weights failing hash check. | Duration from qualification on the tier, then the person's history. | **Blocked on FD-4**: no weights, no pins, `modelRoot` unset, flag off, no GPU worker profile. |
| **Customer's own remote compute (Kaggle)** | No money; the person's weekly GPU quota (30 hours in an observed refusal). Kaggle's terms for this use [UNKNOWN]. | Prompt, seed, run id and, for the first-frame recipe, a cleaned still, into the private notebook's history. Weights download on Kaggle. | None remotely; a run continues to its end or 3600 s. Yamakan stops following. | Quota exhausted, CLI authentication, uncertain push (followed, not resent), notebook busy, output over 512 MiB, receipt mismatch, timeout. | Time from real runs; quota per run could be shown; remaining quota not read. | **Working, env-gated**; founder record entries of 2026-11-05 and 2026-11-06 in `docs/FOUNDER_DECISION_RECORD.md`; scope **FD-3**; MPR-205. |
| **Customer's own local ComfyUI** | Nobody while partner nodes stay off (they need prepaid Comfy credits and take no customer keys [DOC] S63). | Nothing from Yamakan (numeric loopback). ComfyUI itself is not contained by procd. | Best effort interrupt; `remoteOutcome` `unknown`. | Unsafe start flags, missing node or model, VRAM, lost job; no durable ledger as wired. | Duration from a pinned recipe's qualification. | **Flag off**; no recipe; needs weights (**FD-4** or wider) and a GPU tier the founder host lacks. |
| **Hosted provider, customer's credential** | The customer, under their own account. | Prompt, parameters, references; retention 10 minutes (BFL) to 30 days (Kling) [DOC] (S108, S13). | Queued-only (Seedance, MiniMax), any state (Runway), state-dependent (Vidu), none documented (Kling, LTX, Wan, xAI, Gemini Omni) [DOC] (S11c, S30, S23, S32, S13, S41, S36, S38, S5); billing may continue. | Moderation (charged at Runway), concurrency (Kling 1303 [DOC] S19), region (Gemini Omni editing off in EEA/CH/UK [DOC] S5), organisation verification (OpenAI images [DOC] S123), duplicate charge on resend, URL expiry. | Dated static snapshot; live quote where offered; post-run actual where a usage field exists. | **Blocked on FD-5**, then MPR-204, MPR-210, MPR-211, MPR-222; no code; `ROUTER_PROVIDERS_ENABLED` false. |
| **Aggregator host** (fal, Replicate, OpenRouter, Runware; Runway or Pika reselling) | The customer, to the aggregator. | As above, to the aggregator and on to the vendor: two parties' terms. | fal signals a model that may ignore it; Replicate bills cancelled runs for time used; OpenRouter has no cancel call [DOC] (S51, S54, S58). | Version lag, schema drift, 1-hour retention at Replicate [DOC] S55, gateway credential fallback [DOC] S70, end-user exposure clauses [DOC] (S52, S57). | Best live quotes, but SKU units differ by provider [DOC] (S58, S60). | **Blocked on FD-5** plus counsel (9.2). |

On every route the output is downloaded and hashed into the content-addressed store as soon as
it exists, never kept as a provider URL [ASSUMED]; and cancel never claims billing stopped unless
the adapter's `billingOutcome` says so.

## 5. Model family assessments

Dispositions: **recipe** (already a Kaggle recipe); **FD-4** (local, after FD-4); **FD-5**
(customer-credential hosted, after FD-5); **refused** (reason given; kept as a negative entry).
"Third-party use" asks whether terms document that a customer may use their own key in a desktop
tool written by someone else; unread terms are [UNKNOWN] and need counsel. FD-4 as worded covers
captions, voice and image; local video, lip sync, music and restoration would each need a wider
decision.

### 5.1 Hosted video

| Family | Operations documented (never assumed equal) | Access; third-party use | Terms notes | Cost basis | Disposition |
|---|---|---|---|---|---|
| Seedance 2.5 / 2.0 (ByteDance) | T2V, I2V, first+last, edit and extend tasks, audio on by default, 4-30 s, no seed on 2.x [DOC] S11a; up to 50 references [CLAIM] S9 | Volcengine Ark; BytePlus (not in the US [CLAIM] S9); resold by Runway, Pika, fal [DOC] (S21, S49, S53). [UNKNOWN] | Watermark plus C2PA [CLAIM] S9; cancel queued only [DOC] S11c | RMB per 1M tokens; successes only [DOC] S11d | FD-5 |
| Kling 4.0 / 3.0 (Kuaishou) | T2V, I2V, first/middle/last, 10 images plus 7 elements, 5 videos, voice reference, lip sync, audio, multi-shot; no cancel, no seed [DOC] (S13, S14, S17) | Official API. Key only for "your Client Application" [DOC] S18; a third-party desktop client [UNKNOWN] | Outputs the user's; 30-day retention [DOC] (S13, S18) | Units per second, USD 0.157 per unit on 4.0 [DOC] S16 | FD-5 |
| Gemini Omni 1.2 Flash (Google) | T2V, I2V, first+last (3-10 s), 6 images, 3 s videos, conversational edit (not EEA/CH/UK), extend to 30 s, audio; no audio input [DOC] S5 | Gemini API key [DOC] S3. [UNKNOWN] | SynthID always; recognisable people unsupported [DOC] S5 | USD 12 per 1M output tokens, about 0.07/s at 720p [DOC] S3 | FD-5 |
| Veo 3.1 (Google) | T2V, I2V, first+last, extend; images on Generate and Fast; audio; 4/6/8 s [DOC] S7 | Vertex only, one US region, Cloud credentials [DOC] (S4, S7). [UNKNOWN] | C2PA supported [DOC] S7 | Per second; USD 0.05-0.60 reported [IND] S8-ind | FD-5, after Gemini Omni |
| Runway Gen-4.5, Aleph 2.0, Act-Two | T2V (two ratios), I2V 2-10 s; in-context edit; performance transfer; seed on some models [DOC] S23 | Official API, also a reseller [DOC] S21. "Powered by Runway" display [DOC] S23; key ownership reported to vest in Runway [IND] S25 | Moderated requests charged; `DELETE` cancels; URLs 24-48 h [DOC] (S23, S24) | Credits at USD 0.01; Gen-4.5 12/s [DOC] S21 | FD-5 |
| Luma Ray 3.2 | T2V, I2V start/end, multi-keyframe, edit, reframe, extend by id, HDR; 5 or 10 s [DOC] S26 | Official API. [UNKNOWN] | URLs expire in 1 hour; failures refunded [DOC] (S26, S27) | Credits; currency value depends on plan [DOC] S27 | FD-5, credits only |
| MiniMax H3 (hosted) | T2V, I2V first/last, 9 images / 3 videos / 3 audio, 2K regeneration [DOC] S30 | Official API. [UNKNOWN] | Cancel queued only [DOC] S30 | USD 0.08-0.13/s [DOC] S29 | FD-5 |
| Wan 3.0 (Alibaba, hosted) | T2V, I2V first and first+last, references, audio input, up to 30 s [DOC] S35 | Model Studio, regional endpoints [DOC] S36. [UNKNOWN] | Seed not guaranteed; `prompt_extend` rewrites prompts by default; no cancel [DOC] S36 | CNY per second by region [DOC] S35 | FD-5, rewriting off or captured |
| Grok Imagine Video 1.5 (xAI) | T2V, I2V, references incl. 3 voices, first/last plus 4 keyframes, audio on [DOC] S38 | Official API. [UNKNOWN] | Temporary URLs [DOC] S38 | USD 0.080/s [DOC] S37 | FD-5 |
| Vidu Q4 / Q3 (Shengshu) | Reference-to-video, I2V, T2V, first-last, up to 16 s [DOC] S31 | Official API. [UNKNOWN] | Failures free; cancel state-dependent [DOC] (S31, S32) | Credits, RMB 0.03125 each [DOC] S31 | FD-5 |
| LTX-2.5 (Lightricks, hosted) | T2V, I2V with last frame, audio-to-video, multi-shot, `camera_motion`; no retake or extend on 2.5 [DOC] S42 | Official API. [UNKNOWN] | No cancel documented [DOC] S41 | USD per second; live pricing endpoint [DOC] S39 | FD-5 |

### 5.2 Open-weight video (research findings; nothing measured by Yamakan)

| Family | Operations | Licence | Hardware per research | Disposition |
|---|---|---|---|---|
| Wan 2.2 TI2V-5B | T2V, I2V, 720p/24 fps | Apache-2.0 [DOC] S76 | Fits 8 GB with ComfyUI offload [DOC] S77 | **Recipe** (two) |
| Wan 2.1 (1.3B, 14B, VACE, FLF2V), Wan 2.2 A14B, S2V, Animate-2 | T2V, I2V, first/last, reference and masked video-to-video, audio-driven, character replacement [DOC] (S76, S80, S81) | Apache-2.0; derivatives unchecked [UNKNOWN] | 1.3B 8.19 GB peak [DOC] S81; A14B 80 GB without offload [DOC] S76 | Kaggle recipe candidates if FD-3 makes the route product scope; Kaggle GPU memory [UNKNOWN] |
| LTX-2.5 (open) | T2V/I2V, video-to-video, re-dub, audio-to-video, retake, keyframes, multi-shot [DOC] S88 | Free under USD 10M revenue; full text unread; gated [DOC] (S89, S90) | 32 GB official minimum, about 66 GiB [DOC] (S43, S88); about 16 GB per a third party [IND] V-LTX16 | Refused locally; hosted FD-5 |
| MiniMax H3 (open) | 768p base: T2V with audio, first/last, references [DOC] S85 | Excludes EU, UK, South Korea, US; USD 20M cap; UI must name it [DOC] S86 | Not stated | Refused (territory, branding) |
| HunyuanVideo 1.5 | T2V, I2V, 480p/720p [DOC] S91 | Excludes EU, UK, South Korea [DOC] S92 | 14 GB with offload; Linux per README [DOC] S91 | Refused (territory) |
| CogVideoX-2B / 5B / 1.5 | T2V, I2V [DOC] S100 | 2B Apache-2.0; 5B own licence; 1.5 unstated [DOC] S100 | 3.6-5 GB optimised [DOC] S100 | 2B **recipe**; others refused until read |
| FramePack | I2V, long clips [DOC] S95 | Code Apache-2.0; base weights' licence not restated [DOC] S95 | 6 GB; Windows package [DOC] S95 | Refused until weights' licence confirmed |
| Mochi 1, MAGI-1, LongCat, SkyReels-V3, HappyHorse | Various [DOC] (S101-S104) | Apache-2.0, Apache-2.0, MIT, unread, [UNKNOWN] | Under 20 GB; 12 GB (4.5B); unstated | Not proposed (dated or unknown needs); SkyReels and HappyHorse refused until verified |

No video model is practical on CPU only [ASSUMED] (research note C.7).

### 5.3 Retired, unavailable or refused routes

| Item | Finding | Disposition |
|---|---|---|
| OpenAI Sora 2 | API removed 2026-09-24 [DOC] S1 | Refused: retired |
| Moonvalley Marey; Amazon Nova Reel | API discontinued; end of life 2026-09-30 [DOC] (S46, S68) | Refused: retired |
| Midjourney | No official API; automation prohibited per secondary sources [IND] S45-note | Refused; import an exported file only |
| PixVerse V6 | Terms forbid commercial use and integration for resale or sharing without written authorisation [DOC] S33 | Refused |
| Pika | Developer API lists other vendors' models [DOC] S49 | Own models refused; as aggregator FD-5 |
| ComfyUI partner nodes | Prepaid Comfy credits, no customer keys [DOC] S63 | Refused; flagged by `isComfyCloudNode` |
| Vercel AI Gateway | BYOK may fall back to the gateway's credentials [DOC] S70 | Refused while that cannot be disabled |
| fal, Replicate, OpenRouter, Runware | No end-user exposure or key sharing [DOC] S52; 1-hour retention, model licence on top [DOC] (S55, S57); video retains data [DOC] S59; Runware terms [UNKNOWN] | FD-5, after a first-party provider |

### 5.4 Image models (no image operation exists yet; MPR-206 first)

MPR-206 adds no image operation: it defines the five existing operations and the five steps for
adding one. MPR-220 adds `textToImage` and MPR-221 adds `textToSpeech`, each by those steps,
which include the new name in `Operation` in `core/engines/contract-v2.ts`. Both cards wait on
FD-4.

| Model | Licence | Abilities | Hardware per research | Disposition |
|---|---|---|---|---|
| Z-Image-Turbo (6B) | Apache-2.0 [DOC] S118 | Text-to-image | Within 16 GB [DOC] S118; about 4 GB quantised [IND] S96 | FD-4 (CPU: minutes per image [ASSUMED]) |
| FLUX.2 [klein] 4B | Apache-2.0 [DOC] S113 | T2I, multi-reference edit | About 13 GB [DOC] S113 | FD-4 (Tier 2; Tier 1 quantised [ASSUMED]) |
| Qwen-Image 2025 line | Apache-2.0 [DOC] S115 | Edit, multi-image, RGBA layers | 4 GB with slow offload [DOC] S115 | FD-4 (Tier 2) |
| Qwen-Image-2.1; FLUX.2 [dev], [klein] 9B, Kontext [dev] | Non-commercial [DOC] (S112-S114, S116) | Edit, references | | Refused |
| FLUX 3 Image Klein; SD 3.5; HiDream-I1 | USD 5M cap; USD 1M cap; gated Llama encoder [DOC] (S109, S126, S128) | Up to 10 references (Klein) | 25-31 GB (Klein) [DOC] S109 | Refused under FD-4 |
| Krea-2, Ideogram 4.0 open, MiniMax-H3-Image, HunyuanImage 3.0 | Unread or restrictive [DOC] (S119, S120, S122, S125) | Various | Up to 3×80 GB | Refused |
| Hosted: BFL, OpenAI GPT Image, Google Nano Banana, Seedream, Ideogram, Recraft | Provider terms; OpenAI needs organisation verification [DOC] S123 | Per vendor [DOC] (S107, S121, S127) | n/a | FD-5; BFL URLs expire in 10 minutes [DOC] S108 |

### 5.5 Speech, voice, music, lip sync, restoration

| Category | Shortlist | Licence and caveats | Hardware per research | Disposition |
|---|---|---|---|---|
| Speech to text | faster-whisper with Whisper large-v3-turbo; WhisperX | MIT; MIT; BSD-2; diarization needs a gated account [DOC] (V-WHI, V-FW, V-WX) | CPU int8, 13 min of audio in 1 min 42 s, small model, i7-12700K [DOC] V-FW | FD-4 (Tier 0), no diarization. Code pins whisper.cpp, which the research did not assess [UNKNOWN] |
| Voice | Kokoro-82M; Arabic: Habibi-TTS Apache-2.0 checkpoints | Apache-2.0, no Arabic or cloning [DOC] V-KOK; some Habibi checkpoints non-commercial [IND] V-HAB | Kokoro on CPU [IND] | FD-4; Habibi after a direct licence read. Chatterbox (MIT) is retired [DOC] V-CHB |
| Voice refused | F5-TTS, XTTS-v2, Higgs Audio v3, Fish Speech, IndexTTS | Non-commercial, revenue-capped or custom [DOC] (V-F5, V-XTTS, V-HIG, V-FISH, V-IDX) | | Refused; Piper GPL-3.0 [DOC] V-PIP needs counsel |
| Music and effects | ACE-Step 1.5; DiffRhythm | MIT (training data undescribed); Apache-2.0 [DOC] (V-ACE, V-DR) | 6 GB or less, CPU slow; 8 GB | Outside FD-4. MusicGen, YuE, MMAudio refused (non-commercial) [DOC] (V-MUS, V-YUE, V-MMA); Suno, Udio refused [IND] V-SUNO; hosted SFX FD-5 [DOC] V-ELSFX |
| Lip sync | MuseTalk 1.5 | MIT [DOC] V-MT | 4 GB laptop GPU, 8 s in about 5 min [DOC] V-MT | Outside FD-4 (Tier 1). LatentSync, Wav2Lip, LivePortrait as shipped refused (openrail++, non-commercial, InsightFace) [DOC] (V-LS, V-W2L, V-LP, V-INS); Sync Labs FD-5 [DOC] V-SYNC |
| Restoration (`enhance`) | Real-ESRGAN, RIFE, SeedVR2 GGUF | BSD-3, MIT, Apache-2.0 [DOC] (V-ESR, V-RIFE, V-SVR) | Real-ESRGAN on any GPU via Vulkan [DOC] V-ESR | Outside FD-4; may alter faces, so recorded as a generation step [ASSUMED] |

No model was found that exports separate dialogue, music and effects stems [UNKNOWN]; native
audio is one mixed asset (rung L0), and editable sound uses separate tracks.

## 6. Hardware tiers

Research findings only (labels as in section 5 and research note sections C.7, D.3, 9); none is
a Yamakan measurement, and vendors publish almost no 8-16 GB timings. **Yamakan qualifies only
Tier 0 today, and qualifies no local model on it.**

| Tier | Hardware | Realistic per research | Yamakan |
|---|---|---|---|
| **Tier 0** | CPU only, 16 GiB RAM, integrated graphics (founder host: i5-13420H, little free disk) | No video [ASSUMED]; small images through stable-diffusion.cpp's CPU back end at minutes each [DOC] S96, timing [ASSUMED]; faster-whisper int8 [DOC] V-FW; Kokoro [IND]; Real-ESRGAN via Vulkan [DOC] V-ESR | Qualified tier; policies v3 and v1 unchanged; captions and voice are the first local work (FD-4) |
| **Tier 1** | 8 GB GPU | Wan 2.2 TI2V-5B with offload, Wan 2.1 1.3B, FramePack at an estimated 25-50 min per 5 s clip [DOC] (S77, S81, S95), time [ASSUMED]; Z-Image-Turbo and FLUX.2 [klein] 4B quantised [ASSUMED]; MuseTalk, ACE-Step, SeedVR2 GGUF, RIFE [DOC] | Not qualified |
| **Tier 2** | 12-16 GB GPU | Quantised Wan 14B at 480p-720p, experimental [ASSUMED]; FLUX.2 [klein] 4B and Z-Image-Turbo as documented [DOC] (S113, S118); EchoMimicV3-Flash at 12 GB [DOC] V-ECHO | Not qualified |
| **Tier 3** | 24 GB+ GPU | Wan 14B reference configuration [ASSUMED]; LTX-2.5 needs 32 GB [DOC] S43; FLUX 3 Image Klein 25-31 GB [DOC] S109; LatentSync 1.6 18 GB [DOC] V-LS | Not qualified |

Only in-house measurement settles time, peak VRAM, the system-RAM floor for offload, thermals
and disk per model set; NVIDIA, AMD and Intel are separate targets [ASSUMED] from (S84, S94,
S96). Plans: [10_BENCHMARK_AND_EVALUATION.md](10_BENCHMARK_AND_EVALUATION.md).

## 7. Activation order and the model-intake procedure

### 7.1 Model intake: a reviewed data change

1. **Catalog entry** in the proposed `core/engines/catalog.ts` (MPR-201): identity tuple, source
   URL, `verifiedAt`, lifecycle `candidate`. A pull request, never a runtime fetch.
2. **Licence fields** complete with source and date (MPR-208); unknown or non-commercial stops
   here as a negative entry.
3. **Capability cells** start `unverified` (MPR-202), limits copied from documentation and
   labelled so; a vendor claim never sets `supported`.
4. **Operation check**: a needed operation outside `Operation` gets a written definition and
   conformance cases first (MPR-206); nothing is approximated.
5. **Conformance** against the kit with `core/engines/fake.ts` or the loopback fake provider
   (MPR-206, MPR-210).
6. **Qualification evidence** on the real route and tier: a qualify script under `scripts/`, a
   receipt under `docs/evidence/`, measured cells with date and n; lifecycle `qualified`.
7. **Offered** only when gates (MPR-204) and preflight (MPR-203) cover the route and any route
   decision is recorded; the existing lists pass the consistency test (MPR-201).
8. **Retired** when a provider retires the model or re-points an alias; MPR-103 reports it.

MPR-206 writes the checklist in a new `docs/MODEL_INTAKE.md`, held to the catalog by a test. Its
machine-checked items are `identity`, `licence`, `route`, `operation`, `limits`, `evidence` and
`conformance`; its written items are `egress`, `spend`, `download` and `withdrawal`.

### 7.2 Route activation order

| Order | Route | Precondition | Cards |
|---|---|---|---|
| 0 | Kaggle notebook (exists, env-gated) | Founder record 2026-11-05 and 2026-11-06 | none |
| 1 | No activation: catalog, cells, operations, failures, licence, gates, preflight, fake provider | FD-2 for the record | MPR-201 to 204, 206 to 208, 210, MPR-101, MPR-103 |
| 2 | Kaggle as product scope or founder-only | **FD-3** for the scope; MPR-205 itself needs only FD-10, for part b | MPR-205 |
| 3 | Local captions, then voice, then image. The person fetches the pinned files and an install script verifies each hash; the product downloads nothing | **FD-4** naming the files; MPR-204 keeps the product's download gate closed | MPR-221, MPR-220 |
| 4 | Local ComfyUI recipe | Weights decision, a GPU tier, durable ledger | not carded |
| 5 | First hosted provider, chosen on terms clarity, cancel and usage fields, not quality claims | **FD-5** legal review, MPR-204, MPR-210, MPR-211 | MPR-222 |
| 6 | Aggregators | FD-5 plus counsel | none |

## 8. What we will not do

- Bundle or download weights without FD-4; never weights that are unknown, non-commercial,
  territorially restricted, or gated behind a licence the person has not accepted themselves.
- Scrape an app, use an unofficial API, or wrap a service whose terms forbid it (Midjourney,
  PixVerse).
- Silently approximate an unsupported operation (drop a last frame, send fewer references than
  chosen without saying so in preflight, substitute a new generation for "extend").
- Resubmit automatically a send whose answer was lost.
- Route by "best model" claims or arena rankings, which disagree at the top [IND] S47; selection
  follows fixed, explained rules (MPR-305).
- Pay or proxy on the customer's behalf, or use a path that bills anyone but the customer's own
  account (ComfyUI partner nodes, gateway credential fallback).
- Set an integration-count target.

## 9. Open questions

**For the founder** ([FOUNDER_DECISIONS_REQUESTED.md](FOUNDER_DECISIONS_REQUESTED.md)):
FD-2 does the full request, prompt included, travel with the take and export? FD-3 is Kaggle
product scope or founder-only (its terms were not researched)? FD-4 may small permissive weights
be downloaded for captions, voice and image, and should the wording later cover lip sync, music
and restoration? FD-5 may legal review start, and for which first provider? FD-10 template the
account id out of kernel metadata.

**For counsel:**
1. Is a customer's own key in a third-party desktop tool inside the credential-sharing and
   end-user clauses of Kling, fal, Replicate and Runway?
2. Does Runway's attribution duty reach such a tool, and where must it appear?
3. May the application facilitate a gated download the person accepts on their own account, and
   what must it record (territory, revenue band)?
4. The unread texts: LTX-2.x Community, Krea 2, MiniMax-H3-Image, skywork-license, CogVideoX
   License, FramePack's base weights, Wan third-party derivatives.
5. Output ownership and commercial terms for Google, OpenAI, Luma, BFL, Ideogram, Recraft, Vidu,
   xAI, Runway.
6. Is GPL-3.0 Piper usable as a separate process in a GPL-3.0-or-later distribution?
7. Do MiniMax and Tencent "no improving other models" clauses reach a LoRA trained on one's own
   footage?
8. What do Kaggle's terms say about driving private notebooks from a product, and output use?

## 10. Sources

Accessed 2026-11-11 by the research notes. S-keys follow the video and image note; V-keys are
assigned here to URLs from the audio and lip-sync note. Consolidated list: [SOURCES.md](SOURCES.md).

Hosted video: S1 https://developers.openai.com/api/docs/deprecations ·
S3 https://aistudio.google.com/docs/pricing · S4 https://aistudio.google.com/docs/video ·
S5 https://aistudio.google.com/docs/omni · S6 https://aistudio.google.com/docs/deprecations ·
S7 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate ·
S8-ind https://benchlm.ai/media-pricing/veo · S9 https://byteplus.com/en/blog/dreamina-seedance2-5 ·
S11a https://docs.volcengine.com/docs/82379/1520757 · S11c https://docs.volcengine.com/docs/82379/1521720 ·
S11d https://docs.volcengine.com/docs/82379/1099320 · S12 https://kling.ai/document-api/llms.txt ·
S13 https://kling.ai/document-api/api/video/4-0/image-to-video.md ·
S14 https://kling.ai/document-api/api/video/4-0/video-omni.md ·
S16 https://kling.ai/document-api/pricing/base/video.md ·
S17 https://kling.ai/document-api/guides/capability-map/video.md ·
S18 https://kling.ai/document-api/guides/protocols/paid-service.md ·
S19 https://kling.ai/document-api/api/get-started/concurrency-rules.md ·
S21 https://docs.dev.runwayml.com/guides/pricing/ · S23 https://docs.dev.runwayml.com/_llms-txt/core-api.txt ·
S24 https://docs.dev.runwayml.com/assets/outputs/ ·
S25 https://conductatlas.com/platform/runway/runway-terms-of-service/api-use-requires-prominent-powered-by-runway-display/ ·
S26 https://docs.agents.lumalabs.ai/guides/model · S27 https://docs.agents.lumalabs.ai/guides/pricing/ ·
S29 https://platform.minimax.io/docs/pricing/overview · S30 https://platform.minimax.io/docs/guides/video-generation ·
S31 https://platform.vidu.com/docs/overview/pricing ·
S32 https://platform.vidu.com/docs/api-reference/task-management/cancel-task ·
S33 https://pixverse.ai/de/pixverse-platform-terms-of-service ·
S35 https://help.aliyun.com/en/model-studio/wan3-0-video ·
S36 https://www.alibabacloud.com/help/en/model-studio/text-to-video-api-reference ·
S37 https://docs.x.ai/developers/models/grok-imagine-video-1.5 ·
S38 https://docs.x.ai/developers/model-capabilities/video/generation · S39 https://docs.ltx.io/pricing.md ·
S41 https://docs.ltx.io/async-jobs.md · S42 https://docs.ltx.io/models/ltx-2-5.md ·
S43 https://docs.ltx.io/open-source-model/getting-started/system-requirements.md ·
S45-note https://wavespeed.ai/blog/posts/what-is-midjourney-v8-features-pricing-how-to-use-2026 ·
S46 https://docs.comfy.org/tutorials/partner-nodes/moonvalley/moonvalley-video-generation ·
S47 https://artificialanalysis.ai/video/leaderboard/text-to-video · S49 https://dev.pika.art/

Aggregators: S50 https://fal.ai/docs/llms.txt ·
S51 https://fal.ai/docs/api-reference/inference-api/queue/submit.md · S52 https://fal.ai/terms ·
S53 https://fal.ai/explore/models?categories=text-to-video ·
S54 https://replicate.com/docs/topics/predictions/lifecycle ·
S55 https://replicate.com/docs/topics/predictions/data-retention · S57 https://replicate.com/terms ·
S58 https://openrouter.ai/docs/cookbook/video-generation/text-to-video.md ·
S59 https://openrouter.ai/docs/guides/overview/auth/byok · S60 https://runware.ai/docs/llms.txt ·
S63 https://docs.comfy.org/tutorials/partner-nodes/overview ·
S68 https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html ·
S69 https://vercel.com/docs/ai-gateway/modalities/video-generation ·
S70 https://vercel.com/docs/ai-gateway/authentication-and-byok/byok

Open video and runtimes: S76 https://github.com/Wan-Video/Wan2.2 ·
S77 https://docs.comfy.org/tutorials/video/wan/wan2_2.md ·
S80 https://huggingface.co/Wan-AI/Wan2.2-Animate-2-14B · S81 https://github.com/Wan-Video/Wan2.1 ·
S84 https://docs.comfy.org/installation/system_requirements.md · S85 https://huggingface.co/MiniMaxAI/MiniMax-H3 ·
S86 https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE · S88 https://github.com/Lightricks/LTX-2 ·
S89 https://huggingface.co/Lightricks/LTX-2.5 · S90 https://docs.comfy.org/tutorials/video/ltx/ltx-2-5.md ·
S91 https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5 ·
S92 https://huggingface.co/tencent/HunyuanVideo-1.5/blob/main/LICENSE ·
S94 https://github.com/deepbeepmeep/Wan2GP · S95 https://github.com/lllyasviel/FramePack ·
S96 https://github.com/leejet/stable-diffusion.cpp · S100 https://github.com/zai-org/CogVideo ·
S101 https://github.com/SkyworkAI/SkyReels-V3 · S102 https://github.com/genmoai/mochi ·
S103 https://github.com/SandAI-org/MAGI-1 · S104 https://github.com/meituan-longcat/LongCat-Video

Image: S107 https://docs.bfl.ml/quick_start/pricing.md ·
S108 https://docs.bfl.ml/api_integration/integration_guidelines.md ·
S109 https://huggingface.co/black-forest-labs/flux-3-image-klein ·
S112 https://huggingface.co/black-forest-labs/FLUX.2-dev ·
S113 https://huggingface.co/black-forest-labs/FLUX.2-klein-4B ·
S114 https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev · S115 https://github.com/QwenLM/Qwen-Image ·
S116 https://huggingface.co/Qwen/Qwen-Image-2.1 · S118 https://github.com/Tongyi-MAI/Z-Image ·
S119 https://huggingface.co/MiniMaxAI/MiniMax-H3-Image ·
S120 https://docs.comfy.org/tutorials/image/ideogram/ideogram-v4.md · S121 https://developer.ideogram.ai/v2/llms.txt ·
S122 https://huggingface.co/krea/Krea-2-Turbo ·
S123 https://developers.openai.com/api/docs/guides/image-generation ·
S125 https://github.com/Tencent-Hunyuan/HunyuanImage-3.0 ·
S126 https://huggingface.co/stabilityai/stable-diffusion-3.5-large · S127 https://www.recraft.ai/docs ·
S128 https://github.com/HiDream-ai/HiDream-I1

Speech, voice, music, lip sync, restoration: V-WHI https://huggingface.co/openai/whisper-large-v3-turbo ·
V-FW https://github.com/SYSTRAN/faster-whisper · V-WX https://github.com/m-bain/whisperX ·
V-KOK https://huggingface.co/hexgrad/Kokoro-82M · V-HAB https://github.com/SWivid/Habibi-TTS ·
V-CHB https://github.com/resemble-ai/chatterbox · V-F5 https://github.com/SWivid/F5-TTS ·
V-XTTS https://huggingface.co/coqui/XTTS-v2 · V-HIG https://github.com/boson-ai/higgs-audio ·
V-FISH https://github.com/fishaudio/fish-speech/blob/main/LICENSE · V-IDX https://github.com/index-tts/index-tts ·
V-PIP https://github.com/OHF-Voice/piper1-gpl · V-ACE https://github.com/ace-step/ACE-Step-1.5 ·
V-DR https://github.com/ASLP-lab/DiffRhythm · V-MUS https://github.com/facebookresearch/audiocraft ·
V-YUE https://github.com/multimodal-art-projection/YuE ·
V-SUNO https://www.digitalmusicnews.com/2026/09/18/universal-music-suno-lawsuit-second/ ·
V-MMA https://github.com/hkchengrex/MMAudio ·
V-ELSFX https://elevenlabs.io/docs/overview/capabilities/sound-effects · V-MT https://github.com/TMElyralab/MuseTalk ·
V-LS https://github.com/bytedance/LatentSync · V-W2L https://github.com/Rudrabha/Wav2Lip ·
V-LP https://github.com/KwaiVGI/LivePortrait/blob/main/LICENSE · V-INS https://github.com/deepinsight/insightface ·
V-SYNC https://sync.so/docs/models/lipsync · V-ESR https://github.com/xinntao/Real-ESRGAN ·
V-RIFE https://github.com/hzwer/Practical-RIFE · V-SVR https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler ·
V-ECHO https://github.com/antgroup/echomimic_v3 ·
V-LTX16 https://medium.com/@creativeaininja/ltx-2-5-what-lightricks-open-weights-video-model-actually-does-and-how-to-run-it-a17bad9664fd
