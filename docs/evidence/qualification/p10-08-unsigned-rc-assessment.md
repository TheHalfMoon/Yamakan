# P10-08 residual — Unsigned Windows release-candidate packaging assessment

**Date:** 2026-10-22  
**Branch context:** `feat/p10-08-unsigned-rc` (from main `5d023c6`)  
**Prior evidence:** [p10-08-bundle-r6.json](./p10-08-bundle-r6.json) (lifecycle suite PASS; residuals listed)  
**Authority:** [FOUNDER_DECISION_RECORD](../../FOUNDER_DECISION_RECORD.md) (decision D deferred; P10 2026-10-21 auth); [RELEASE_PROPOSAL](../../RELEASE_PROPOSAL.md) (NO-GO)

## Verdict

**Yes — an unsigned, non-public release-candidate (RC) installer artifact can be built and exercised for internal/test use without purchasing a code-signing certificate.**

This does **not** authorize a signed release installer, Profile A claims, or a public ship decision. Release verdict remains **NO-GO**.

## Founder / gate reading

| Gate | Reading | Effect on this residual |
| --- | --- | --- |
| Decision **D** (desktop) | Packaging/installers wait for separate qualification; MVP process-lifecycle stays mandatory | Full *release* packaging stays deferred. Does **not** forbid engineering a clearly labeled unsigned RC under P10. |
| P10 auth (2026-10-21) | Explicitly covers **release-candidate packaging** and Windows bundle residuals | In-scope to implement/test an unsigned RC path. |
| Purchases | Signing certs / paid services not authorized | Must not require or purchase Authenticode certs. |
| Profile A / H2–H5 | External / human / founder ship | Remain open; do not claim from this work. |
| [RELEASE_PROPOSAL](../../RELEASE_PROPOSAL.md) | NO-GO; release/update row still needs signed/public path | Unsigned RC does not flip release to GO. |

**Blocked only if** someone treats this work as the public release installer or claims Profile A / H5. Those claims are out of scope here.

## Can we ship an unsigned RC artifact without a cert?

**For internal/test use: yes.**

Safe shape (chosen):

1. Consume the existing `scripts/bundle.ts` layout + `bundle.manifest.json` hashes (same as Bundle R6).
2. Pack a versioned **directory** and optional **ZIP** under a name that includes `unsigned-rc` (never “release”).
3. Install via PowerShell/Node into a **test install root** under `%LOCALAPPDATA%\Yamakan-unsigned-rc` (or a temp root in tests) — **not** Program Files, no admin elevation required for the default path.
4. Exercise install → launch-verify (`verifyInstalledBinaries` / `YAMAKAN_BUNDLE_INSTALL`) → update → rollback → uninstall on that safe root.

An MSI/EXE “setup.exe” is unnecessary for this residual and would invite SmartScreen/publisher UX without improving eng coverage. Zip + install script is enough.

## SmartScreen / Windows implications (unsigned)

| Scenario | Expected Windows behavior | Implication |
| --- | --- | --- |
| Locally built ZIP/PS1 never downloaded | Usually no Mark-of-the-Web; PowerShell may still need execution policy allowance for `.ps1` | Fine for engineering/CI on the builder machine. |
| ZIP downloaded from the internet | MOTW; SmartScreen / “files from the internet” warnings possible on extracted `.exe` / scripts | Acceptable for **internal** distribution with explicit unblock + trust steps; **not** a public release UX. |
| Unsigned Authenticode binary (if we shipped `.exe` installer) | “Unknown publisher”; SmartScreen reputation warnings until reputation accrues | Requires cert purchase (not authorized) for a credible public installer. |
| Default install under `%LOCALAPPDATA%` | Per-user, no UAC for Program Files | Matches “safe test root” constraint. |

**Honest statement:** unsigned artifacts are suitable for qualification and internal RC testing. They are **not** a substitute for a signed release installer or Profile A evidence.

## In-scope engineering vs external

### In-scope (this residual)

- Assessment + clearly named unsigned RC pack/install path.
- Reuse Bundle R6 manifest, install pointer, update/rollback/uninstall, junction-safe remove, tamper refuse.
- Automated tests on temp / `%LOCALAPPDATA%\Yamakan-unsigned-rc` roots.
- Qualification receipt that keeps signing, Profile A, and public release **open**.

### External / still gated

| Item | Why gated |
| --- | --- |
| Code signing certificate purchase | Founder: purchases not authorized |
| Signed Windows release installer (MSI/EXE + Authenticode) | Decision D + residual “Windows release installer / code signing” |
| Clean Profile A install (H2) | External admin / clean profile |
| Second account / constrained volume (H3/H4) | External |
| Auto-update servers | Out of scope (bundle.ts already states this) |
| Public production ship (H5) | Founder artifact-bound authorization required |
| Claiming this is a “release” | Forbidden by naming and RELEASE_PROPOSAL NO-GO |

## Residual after this work

1. **Windows release installer / code signing** — open (cert + signed artifact).  
2. **Profile A** — open (do not claim).  
3. **Public release** — NO-GO.  
4. Unsigned RC pack/install/lifecycle on safe roots — **engineering closable** without a cert.
