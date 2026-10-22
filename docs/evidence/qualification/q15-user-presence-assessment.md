# Q15 — Windows OS user-presence assessment (zero-cost)

**Date:** 2026-10-22  
**Base:** `ec7cb6005895541bc2c19d248bd02ccbfec10ccd`  
**Binding:** [08_IMPLEMENTATION_TASKS.md Q15](../../research/rea-source-reuse/08_IMPLEMENTATION_TASKS.md)  
**Public release:** NO-GO

## Goal

Add an OS user-presence confirmation for human-only commands that **no API caller can satisfy**, without weakening the existing browser-principal + single-use launch-secret controls.

## Zero-cost OS options

| API | Cost | Semantics | Fit |
| --- | --- | --- | --- |
| `Windows.Security.Credentials.UI.UserConsentVerifier` | Free OS API | Returns verified/cancelled only; Yamakan never sees a secret | **Preferred** (matches Q15 procedure) |
| `CredUIPromptForWindowsCredentials` (`credui.dll` present) | Free | Returns credentials to the caller unless carefully discarded | Weaker fit; avoid unless UserConsentVerifier unavailable |
| Third-party MFA / cloud IdP | Paid / networked | Out of scope | **Rejected** |

## Constraints in this repo

- `native/procd` is **deliberately dependency-free** (hand FFI only). WinRT `UserConsentVerifier` does not belong inside procd without a founder-approved dependency policy change.
- A **separate** local helper binary (e.g. `native/presence/`) using the official `windows` crate, invoked only for human-only commands, would preserve procd’s constraint and keep secrets out of Node.
- Interactive Hello / PIN prompts **cannot** be exercised in headless CI; Profile A interactive run remains an external gate.

## Probe on this development machine

- `credui.dll` is present under `%SystemRoot%\System32`.
- WinRT `UserConsentVerifier` type presence / `CheckAvailabilityAsync` was **not** successfully exercised from this agent session (PowerShell WinRT interop failed to return a clean availability enum in the automated probe). Treat availability as **unconfirmed here**, not as a pass.
- No Windows Hello enrollment was verified.

## Decision (this packet)

| Choice | Rationale |
| --- | --- |
| **Do not weaken** launch secret or browser-only human-only gate | Existing residual in `docs/SECURITY.md` stays accurate |
| **Do not** claim Q15 pass | Availability and interactive verification not established on Profile A |
| **Defer wiring** of a native helper until CheckAvailability is confirmed Available on a real Profile A machine with Hello/PIN | Avoid shipping a prompt path that always fails closed and confuses operators |
| Keep `qualify:q15` fallback receipt | Binding fail decision still applies |

## What would close Q15 later (engineering + external)

1. Confirm `UserConsentVerifier.CheckAvailabilityAsync() == Available` on Profile A.
2. Add `native/presence` helper (verified/cancelled only); call it from human-only command path **in addition to** browser principal.
3. Interactive qualify: RequestVerification shows OS UI; cancel and verify both handled.
4. Update `q15-user-presence.json` to `outcome: pass` and shrink the SECURITY.md residual.

## Non-claims

- No Q15 pass fabricated.
- No paid MFA.
- Same-account residual remains until OS confirmation is wired **and** qualified.
