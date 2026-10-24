# Other generative competitors: practical REA

Access date2026-10-23. Sources retrieved without an account, generation, paid tool or model download. Official claims are **OFFICIAL DOCUMENTATION**; product recommendations are **ENGINEERING INFERENCE**. Immutable HTML hashes/status/final URLs are in `evidence/official-web-receipts.json`. A200 response that contains only a JavaScript/login shell is an access gap, not evidence of its advertised API limits.

## Kling: controls belong to a model/mode tuple

The [capability map](https://kling.ai/document-api/guides/capability-map/video.md), updated2026-10-20, lists Kling4.0 with3–30s and720p/1080p/4K, plus3.0/Turbo/Omni,O1,2.6 and2.5. First/last frames, multishot, references, native audio and motion control vary by operation. Its4.0 Omni row distinguishes image/video/element/voice budgets; Motion Control is listed for3.0 and2.6. Do not combine maximum values from unrelated rows into one supposedly supported request.

Yamakan extraction: a reference role/limit matrix, reusable elements, explicit shot duration and model-qualified controls. Adapt local reference bookkeeping; optional API wrappers stay gated. Closed model source and applied optical quality remain inaccessible/unverified. Acceptance: a request containing unsupported audio/reference combination fails before submission; switching modes shows dropped controls. Character/motion quality requires matched output evaluation.

## Luma: modern Agents API supersedes legacy assumptions

[Ray3.2 generation](https://docs.agents.lumalabs.ai/guides/videos/generation/) exposes typed video operations, anchor frames and multi-keyframe input with distinct validation rules. Its current page lists360p/540p/720p/1080p and5s/10s; this differs from legacy Ray2 resolution assumptions. Start/end anchors have restrictions that do not equal multi-keyframe restrictions. [Editing](https://docs.agents.lumalabs.ai/guides/videos/editing/) is a separate video_edit operation; reframe is separate again. Use one immutable source lineage while changing the requested operation.

[Pricing](https://docs.agents.lumalabs.ai/guides/pricing/) lists720p SDR generation at$0.30/5s and$0.90/10s, with distinct edit/HDR/reframe tariffs. These are documented USD list prices at access, not quotes, actual paid charges or a promise of availability. Partial billing can occur for a budget-exhausted failure; cost outcome cannot be inferred from local cancellation. No entitlement, latency or cost was executed.

Yamakan adaptation: capability constraints per request type; keep draft vs final output intent and source/generation identities. Test rejection of invalid HDR/duration/frame combinations and reconcile billing independently from job completion. No hard-coded Ray2 adapter should be selected from older docs.

## ByteDance Seedance

The official [Seedance2.5 page](https://seed.bytedance.com/en/seedance2_5) describes joint audio-video, up to30s storytelling with extensions, richer references and editing/production controls. Its claims do not establish a local open backend, published weights, export interchange or independently measured adherence. The [Seedance1.5 Pro publication page](https://seed.bytedance.com/en/public_papers/seedance-1-5-pro-a-native-audio-visual-joint-generation-foundation-model) is an older technical context, not proof of2.5 architecture or benchmark performance. Full current2.5 training/inference implementation was not available in the inspected material.

Extract multimodal reference intent and edit-locality evaluation; adapt story/take schema now, defer hosted/native A/V until entitled. Do not train a replacement. Acceptance: selective regeneration references exactly the approved shot/refs and leaves unrelated timeline content byte-identical; generative quality evaluated separately.

## Google Flow / Veo: product, model and API lifecycle differ

[Flow help](https://support.google.com/flow/answer/16353334?hl=en) documents projects, agent variation requests, ingredients, start/end frames, named character references, assets and voice references. [DeepMind](https://deepmind.google/models/veo/) still describes Veo3.1. The [Gemini video API guide](https://ai.google.dev/gemini-api/docs/video), updated2026-10-22, explicitly states Veo3.1 **preview endpoints shut down on October22,2026**, and directs Gemini API users toward `gemini-omni-1.1-flash` or other GA routes. This does not establish that every Veo service/product route is retired.

Yamakan lesson: recipes carry endpoint/version/availability evidence and cannot be assumed live because a model marketing page exists. Persistent reference packs and ingredient names are product value; the service remains optional. Acceptance: retired endpoint capability is unavailable with actionable explanation, not retried or silently substituted; substitution requires an approved new quote/recipe.

## Pika

[Current homepage](https://pika.art/) describes focused Video/Image/Character/Music/Speech/SFX apps, partner models, Pika2.5, agent/MCP surfaces and templates. This is broader than the historical playful-effect product stereotype. [Pricing](https://pika.art/pricing) lists Free as0 monthly credits/packs only and paid monthly tiers ($10/900,$35/3150,from$95/8550 at capture); product credit packs are distinct from API balances. No free-generation entitlement is assumed.

Extract focused actions in the selected clip context and retry-aware cost previews. Defer soundtrack-to-picture and character conditioning until a qualified adapter; do not recreate a separate app for each utility. API/MCP availability is documented; task success, speed, lip-sync quality and final project portability are UNKNOWN here.

## PixVerse

[Product page](https://pixverse.ai/) advertises V6/C1/R2, partner models, character, lip-sync, templates, Agent, node Canvas, CLI and marketing workflows. R2 real-time-world positioning is a different task from deterministic editing. Do not import vendor percentages/Elo as Yamakan comparison results. [API billing](https://docs.platform.pixverse.ai/) distinguishes request acceptance, returned credits and final ledger debit/refund; consumer subscriptions are separate.

Extract optional workflow graph visualization and explicit financial reconciliation. Build Yamakan-native DAG views over existing jobs; do not adopt a second queue. Test HTTP200 creation plus later failure/late refund and preserve unsettled accounting. Precise current endpoint constraints, real-time guarantees and account quotas require deeper API-specific qualification before implementation.

## Vidu

[Homepage](https://www.vidu.com/) labels Q4/Q3, reference-to-video, start/end workflows, My References and Agent. Reusable character/prop/scene references are the distinctive product pattern. Testimonials there are vendor-selected **COMMUNITY REPORTED** material, not an independent user study or quality ranking. The fetched [API docs](https://platform.vidu.com/docs) returned an eight-character rendered text shell; no parameter limits, API pricing or cancellation semantics were verified from it.

Extract reusable reference library and storyboard linkage. Defer provider-specific implementation until real API contracts are accessible. Acceptance: pack updates create new versions, existing takes remain bound to original refs, and unknown provider limits do not become defaults.

## MiniMax

[Current API guide](https://platform.minimax.io/docs/guides/video-generation) names H3 and H3 Max, multimodal content roles, asynchronous create/poll/download, first/last frames, reference creation and prompt-context tasks. H3 lists768p/2K and4–15s; H3 Max lists480p/768p and5–15s. The page describes H3 Max as fal.ai-post-trained; source ownership is not inferred from the service name. The term 'open' does not substitute for inspecting a code/weight license.

Extract distinct planner output vs generated video, source preservation during higher-resolution regeneration and explicit task-type receipts. No local H3 weights/source were qualified; all provider work deferred. Acceptance: enhanced-prompt success cannot mark video generation succeeded; regeneration requires the exact approved source/inputs and a new bounded cost attempt.

## Adobe Firefly

[Firefly](https://www.adobe.com/products/firefly.html) situates generation within a broader creative workflow. Professional Adobe application finishing matters as much as model quality. Its commercial safety statements must be evaluated against exact plan/terms and content provenance; they are not a transferable indemnity for Yamakan. Extract integration with finishing, assets and provenance; reject proprietary backend cloning. Detailed per-model output/API pricing and real collaboration/export behavior were not executed.

## Cross-vendor unknowns and closure

For all products above: actual generation speed, quality, prompt adherence, continuity, multilingual speech accuracy, export fidelity, storage retention, cancellation charges and team permissions remain UNKNOWN unless a specific first-party constraint is cited. No request was submitted to discover these at cost. [16](16_BENCHMARK_AND_EVALUATION_PLAN.md) freezes legitimate future tasks; the implementation registry blocks provider adapters until their versioned schemas/terms/error/billing contracts are inspected. Public pages alone cannot close those gates.
