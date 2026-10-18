# 05 — Architecture alternatives

All three alternatives keep what is already qualified on main `6e471088`:

- one SQLite authority;
- the canonical project v-current with flick time;
- the typed command registry (REST, MCP, CLI, SDK);
- durable jobs and attempts with fencing;
- procd with Job Objects (plus the AppContainer once PR #29 merges);
- the FFmpeg plan compiler with libass and pinned fonts;
- the reference preview and backups.

Replacing any of these would discard merged, tested work (T1–T10, PRs #1–#28). None of the donors provides a material improvement over them, because none has a single transactional authority, fenced jobs or contained workers.

## A — Maximum reuse ("adopt an editor")

- **What:**
  - Take the largest donor application wholesale as the Edit workspace: OpenCut Classic's `EditorCore`, commands, timeline UI and wasm, or the film editor's full shell.
  - Bridge it to Yamakan's store through a sync layer.
  - Take InvokeAI's workbench (engine plus operations) for Studio.
  - Take ArtCraft's scene editor with its save manager for Cinema.
- **Reuse share:** highest. An estimated 120,000+ donor lines, around 85% of the expansion code.
- **Cost:**
  - Each donor brings its own state engine and history: OpenCut `EditorCore`, InvokeAI workbench reducers, ArtCraft `HistoryManager`.
  - This breaks the "no second canonical store" rule.
  - It forces a two-way sync (an unbounded source of conflict and data-loss bugs).
  - It brings React 19 into the app shell (Yamakan is React 18.3.1) and adds a Rust-wasm toolchain.
  - InvokeAI operations need its backend and account lifecycle; ArtCraft needs hosted tokens.
- **Verdict:** **Rejected.** It fails hard gate H2 for three subsystems and H3 for two.

## B — Balanced reuse (recommended)

- **What:** copy or adapt every donor subsystem that is pure or has a narrow seam, wrap engines behind the existing process and job boundary, and use unmodified libraries as dependencies. Specifically:
  - **Edit:** OpenCut ripple, group move, retime and animation.
  - **Studio:** InvokeAI canvas engine with a host adapter.
  - **Cinema:** ArtCraft camera math and schema.
  - **Director:** OpenVideoStudio contracts and OpenMontage manifests.
  - **Media:** Mediabunny, and JASSUB later as a live-preview upgrade over the existing reference still.
  - **Engines:** ComfyUI wrapped.
  - The file-level map is in [04](04_EXACT_SOURCE_IMPORT_BLUEPRINT.md).
- **Reuse share:** an estimated 42,000 donor lines; 74–82% of expansion code by line count ([09](09_REUSE_AND_EFFORT_ESTIMATES.md)).
- **Cost:**
  - Host adapters, the largest being Studio at an estimated 2,500–4,000 lines.
  - Canonical schema additions (sound, speed, animation, studioDocument, scene3d, character, directorRun).
  - Test ports from Vitest and pytest.
- **Risks:**
  - InvokeAI subtree upkeep, mitigated by the `provenance --diff` drift report and a frozen pin.
  - AGPL notice handling for OpenMontage ports.
- **Verdict:** **Recommended.** It passes every hard gate, and every primary is eligible under its public licence alone.

## C — Selective reuse ("MVP plus minimal imports")

- **What:** import only what the MVP needs (nothing new, since the original-audio fix is original work). Expansion workspaces are built mostly as original code with donors used as references.
- **Reuse share:** an estimated 5,000 donor lines (OpenCut ripple, retime and camera math only).
- **Cost:** reimplementing a layered canvas engine, keyframe interpolation and group move. The estimate is about 85–128 builder days (the all-reimplementation estimate of 88–131 less the three small modules C still imports) against 41–63 for B.
- **Verdict:** **Not recommended.** It is slower and less tested than donor code, which is the opposite of the reuse mandate. It remains the fallback for any module whose B-path validation fails, module by module.

## Comparison

| Criterion                                 | A Max                                | B Balanced                                                                       | C Selective |
| ----------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- | ----------- |
| Hard gates                                | Fail (H2 ×3, H3 ×2)                  | Pass                                                                             | Pass        |
| One authority preserved                   | No                                   | Yes                                                                              | Yes         |
| Donor lines reused (estimate)             | ~120,000                             | ~42,000                                                                          | ~5,000      |
| Expansion effort (builder days, estimate) | Not estimated (sync layer unbounded) | 41–63                                                                            | ~85–128     |
| Inherited donor tests                     | Most                                 | ~150 files (InvokeAI 145, OpenCut 3, plus OpenMontage and OpenVideoStudio cases) | ~3          |
| Upstream drift burden                     | Very high                            | Medium (one large subtree)                                                       | Low         |
| Security surface                          | Hosted and backend coupling          | Contained engines; browser-only canvas                                           | Smallest    |
| MVP impact                                | Blocks MVP (rewrite)                 | None (expansion after the M-gate)                                                | None        |

## Recommendation

**B.** C is used as the per-module fallback when a B import fails validation. Any move toward A would need a new architecture decision with evidence of a material improvement, which no inspected donor currently provides.
