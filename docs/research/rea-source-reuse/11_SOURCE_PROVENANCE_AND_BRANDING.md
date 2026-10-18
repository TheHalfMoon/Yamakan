# 11 — Source provenance and branding

## Founder authorization statement (minimal, non-sensitive)

On 2026-10-18, the founder (repository owner TheHalfMoon) stated in a written instruction to the implementing agent (Claude, Claude Code) that the founder has legal permission covering source-code reuse for the donor sources named in that instruction and in existing authorizations. The permission covers copying, modifying, adapting, combining, deriving, rebranding, renaming, distributing and commercial use. The founder also stated that the underlying agreements are confidential and will not be provided.

**What this record does not claim:**

- The agreements were not seen by the agent, and they are not reproduced or summarised here.
- They are not independently verified.
- No signature, date, clause, licensor or legal representation is stated beyond the founder's own statement above.
- The statement does not extend to:
  - trademarks;
  - unrelated proprietary content;
  - user data;
  - hosted-service entitlements;
  - model weights, datasets, or face and voice assets.

These keep their own rights, as the [source reuse ledger](../../SOURCE_REUSE_LEDGER.md) already records.

**How the plan uses it:**

- Every primary source in this plan is eligible under its **public** licence alone ([03](03_SOURCE_RANKING.md), gate H1), so no technical choice depends on the confidential terms.
- Ledger records use `authorization: "public-licence"`, or `"founder-attested"` for founder-owned repositories (Skelet, Ninerr, Gomrey, Ascout).
- Public-licence obligations (notices, source offers, AGPL network terms) are honoured in every case.

## Licence obligations per selected donor

| Donor                      | Licence                                                                                                                                       | Obligation in Yamakan (GPL-3.0-or-later)                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCut Classic            | MIT                                                                                                                                           | Keep the copyright and permission notice (`notices/OpenCut-LICENSE`, present)                                                                                                                                    |
| InvokeAI                   | Apache-2.0 + NOTICE                                                                                                                           | Keep LICENSE and NOTICE; mark modified files; no InvokeAI trademarks in UI. Model licence files not imported.                                                                                                    |
| ArtCraft                   | Apache-2.0 / MIT                                                                                                                              | Keep both licences and NOTICE; mark modified files                                                                                                                                                               |
| OpenVideoStudio            | Apache-2.0 + NOTICE                                                                                                                           | As for InvokeAI                                                                                                                                                                                                  |
| OpenMontage                | AGPL-3.0                                                                                                                                      | Ported files stay under AGPL-3.0 terms within the combined work (GPL-3.0 §13), so the combined work is in practice distributable only under version 3. Source offer in About, including for network interaction. |
| Mediabunny                 | MPL-2.0                                                                                                                                       | Unmodified dependency; notice and source location                                                                                                                                                                |
| JASSUB                     | `LGPL-2.1-or-later AND (FTL OR GPL-2.0-or-later) AND MIT AND MIT-Modern-Variant AND ISC AND NTP AND Zlib AND BSL-1.0` (pinned `package.json`) | Yamakan elects GPL-2.0-or-later for FreeType; LGPL fribidi stays replaceable; all notices in `notices/`; the full licence expression is recorded in the ledger                                                   |
| soundtouchjs               | LGPL-2.1                                                                                                                                      | Unmodified dependency; notice; replaceable as a separate module in the bundle                                                                                                                                    |
| ComfyUI                    | GPL-3.0                                                                                                                                       | Not copied. If ever distributed with Yamakan, the source offer and the pinned commit go in `NOTICE`.                                                                                                             |
| AI Video Production Editor | GPL-3.0-or-later                                                                                                                              | Keep `NOTICE`; never present Yamakan as the official project (its `TRADEMARK.md`)                                                                                                                                |
| FFmpeg, libass, fonts      | As already recorded                                                                                                                           | Unchanged (exact binary build and codec notices remain release gate W5)                                                                                                                                          |

## Provenance record (extended by W6)

```json
{
  "source": "OpenCut-app/opencut-classic",
  "sha": "cf5e79e919144200294fb9fed22a222592a0aeea",
  "original": "apps/web/src/ripple/apply.ts",
  "sha256": "<upstream file sha256>",
  "imported": "core/donors/opencut/ripple/apply.ts",
  "importedSha256": "<imported file sha256>",
  "modifications": [
    "MediaTime -> flick ticks with checked addTicks",
    "returns ClipPatch[]"
  ],
  "license": "MIT",
  "authorization": "public-licence",
  "owner": "editing builder",
  "tests": ["tests/ripple.test.ts"]
}
```

`npm run provenance:check` fails on any of the following:

- a missing field;
- a hash mismatch;
- an excluded path;
- a missing notice file for the source.

`--diff <source>` reports upstream drift against a local clone at the pin. Pins are frozen, and an upgrade is its own PR.

## Branding rules

1. **Every user-visible surface says Yamakan:** UI text in both languages, the CLI name and help, MCP server and tool names (`yamakan.*`), window and tab titles, export metadata (`encoder` and `comment` tags), installer, update and uninstall names.
2. **Donor names may appear only in** `NOTICE`, `notices/`, `docs/`, source-file provenance headers and the About → Open-source notices view.
3. **Donor-internal identifiers are renamed at the seam, not inside donor files.** Seam names include the `@workbench/...` aliases, `opencut` CSS classes and `storyteller` events. Renaming inside donor files would make upstream diffs unreadable.
4. **Formats are not renamed when that would break interchange:** `.otio` stays `.otio`, and ASS stays ASS. Imported ArtCraft scene JSON is read as-is and saved as a Yamakan `scene3d`.
5. **No donor logo, icon, screenshot, sample media or product name** enters `assets/`. Film-editor icons already imported (`icons.tsx`) are generic glyphs; W6 reviews them against the donor's `TRADEMARK.md`.
6. **`scripts/brand-check.mjs` (W6) enforces rules 1–2** for `src/**`, `src/i18n.ts`, `cli/**` and `mcp/**` strings.
