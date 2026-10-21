# 0003. Studio canvas engine path (W10 / M7 + M13)

Status: accepted (agent decision under frozen plan W10; founder E-SEC and F remain separate gates). Dated 2026-10-21. Measurements run outside the repository under `%TEMP%\yamakan-w10-q7a-*` (throwaway; never merged).

## Context

W10 decides the Studio integration by Q7a, Q7b, Q8–Q10 against the frozen M7 boundary, and lands the M13 engine contract with a fake engine only. No real ComfyUI run. Primary donor: InvokeAI `ffe9e1a98b19640388d72f88ae0ecadf1bee1717` `invokeai/frontend/webv2` canvas-engine.

## Measurements (throwaway)

| Qual | Method | Result | Binding |
| ---- | ------ | ------ | ------- |
| Q7a | Sparse-cloned the pin into `%TEMP%\yamakan-w10-q7a-invoke` (338 files under `canvas-engine`). Copied into a TypeScript 5.9.3 + zod 4.4.3 throwaway package with host shims for `@workbench/*` / `@platform/*` / `@features/*`. Ran `tsc --noEmit`. | **Fail:** 742 errors in 161 files (TS7006×398, TS2307×234, TS7031×57, …). Far above the ≤50 ledgered syntax-only allowance for engine files. Host shim gaps alone do not explain the volume. At this pin the sparse tree exposed `frontend/webv2` only (no `frontend/web` / `controlLayers` tree in the checkout), so the documented webv1 fallback could not be measured in the same throwaway without a wider clone. | **Primary canvas-engine path is not selected.** Interim binding: **ladder C** (original host Studio) until a fuller throwaway re-runs Q7a on webv1 `controlLayers` or a reduced webv2 closure clears the budget. **W11 stays blocked** on a passing Q7a receipt. |
| Q7b | Reducer seam compile + inherited tests | **Not run** (blocked on Q7a primary failure; seam copy would be premature). | Host reducer fallback remains available when W11 resumes after a passing path. |
| Q8 | Mount engine in React 18.3.1 and draw one stroke | **Not run** (blocked on Q7a). Plain-container fallback remains available per Q8. | — |
| Q9 | Vitest scoped to `src/studio/**`, ≥90% node-mode pass | **Not run** (no `src/studio/**` yet; Vitest not added). | Do not add Vitest until a Q7a-passing import lands. |
| Q10 | Studio chunk ≤ 2.5 MiB gzip; stroke p95 ≤ 16 ms | **Not run** (no Studio chunk). | Flag stays off. |

## Decision

1. **Studio canvas primary (InvokeAI webv2 canvas-engine) is not adopted for W11 copy** until a new throwaway Q7a pass is recorded (webv1 `controlLayers` trial or a reduced closure that clears the error budget). This ADR keeps the M7 boundary and the fail decision; it does not rewrite the frozen plan.
2. **Land M13 now:** `core/engines/contract.ts` and `core/engines/fake.ts` with `ENGINE_ENABLED = false`. Fake covers cancel, crash-retry fencing, and probe quarantine. Real `comfyui.ts` stays absent until E-SEC + founder F.
3. **Engine-absent product behaviour:** capability reports `available: false` with an explicit reason; no egress; Studio flag off.

## Consequences

Track 2 may continue with W13+ work that does not require the Studio engine. W11 waits on a revised Q7a. W12 still waits on H1. Release remains **NO-GO**.

## Change rule

A new ADR entry or amendment is required to select a Studio engine path after a passing Q7a (and Q8) receipt at a named throwaway measurement commit.
