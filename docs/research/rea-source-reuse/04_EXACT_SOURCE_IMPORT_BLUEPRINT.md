# 04 — Exact source import blueprint

This is the mandatory file-level map, **donor path → Yamakan path → modification → validation**. Each module lists the same 20 fields. Paths are relative to the donor repository at its pin, or to the Yamakan repository. No file below has been imported yet: this blueprint is the instruction for the PRs in [08](08_IMPLEMENTATION_TASKS.md).

**Field key:**

1. ID
2. Workspace/subsystem
3. Donor @ pin
4. Licence/notice
5. Donor paths
6. Yamakan paths
7. Ladder level
8. Dependency closure
9. Excluded
10. Modifications
11. Adapter contract
12. Canonical impact
13. Security boundary
14. Inherited tests
15. New tests
16. Validation commands
17. Benchmark
18. Size (donor lines / estimated new lines)
19. Owner, phase, gate
20. Fallback and rollback

**Rules for every import:**

- **Ledger entry.** Each copied file gets an entry in [`docs/provenance/imports.json`](../../provenance/imports.json) with source, pin, original path and SHA-256, imported path and SHA-256, and modifications. The PR in [08](08_IMPLEMENTATION_TASKS.md) task W6 extends the record with `license`, `authorization`, `owner` and `tests`.
- **Notices.** Each donor licence is kept verbatim as `notices/<Donor>-LICENSE` (the existing convention) and listed in `NOTICE`. A donor file keeps its header, and a first line `// Adapted from <repo>@<pin> <path> (<licence>)` is added where the file had no header.
- **Policy.** `docs/provenance/import-policy.json` gains the donor root and the excluded paths before the first file lands. `npm run provenance:check` must fail on any excluded path.
  - **Known gap today (security review of this PR):** `donorRoots` covers only `src/donors` and `core/donors`. The excluded patterns also miss part of the do-not-import list: the real ArtCraft paths `crates/desktop/artcraft/tauri.conf.json` and `capabilities/default.json`, the five ArtCraft `crates/api_clients/*` consumer clients, and other ledger rows.
  - **W6 closes it:** it adds every new destination root used below (`src/studio/canvas-engine`, `src/studio/host`, `src/cinema`, `core/director`, `core/engines`, `core/identity*.ts`, `core/scene3d.ts`, `core/donors/opencut/*`) and one pattern per row of the [mandatory do-not-import list](../../SOURCE_REUSE_LEDGER.md#mandatory-do-not-import-list-independent-review-2026-10-11). A test copies each excluded path at its pin into a scratch tree and expects the check to fail.
- **Dependencies.** Every new npm dependency is pinned to an exact version with its lockfile integrity hash. Its own dependency tree is reviewed in the PR that adds it. No `^` or `~` ranges.
- **Upstream security fixes.** A frozen pin does not track upstream fixes, because `--diff` finds only local drift. For each copied subtree (above all M7), W6 adds a monthly check of upstream commits and advisories since the pin. The module's named owner is responsible for security patches, which land as their own PRs.
- **Time.** Donor time units are converted to integer flick ticks with checked arithmetic, following the `core/donors/opencut/snapping.ts` pattern. One OpenCut tick is 5,880 flicks.
- **No donor state.** No donor module may own state that survives a reload. Everything persistent is a canonical revision, an asset or a job.

---

## Wave 1 (MVP)

### M1 — Video clip's own sound (original Yamakan work)

1. **ID:** M1.
2. **Workspace/subsystem:** Edit / Audio, render plan.
3. **Donor @ pin:** none. No donor at any pin renders a video clip's embedded sound under Yamakan's plan model (R8 in [02](02_REA_DEEP_INVESTIGATIONS.md)). The behaviour reference is linked audio in Kdenlive and in Resolve's public documentation.
4. **Licence/notice:** Yamakan GPL-3.0-or-later.
5. **Donor paths:** none.
6. **Yamakan paths:**
   - `core/canonical.ts` (clip `sound` field for video clips; schema version bump);
   - `core/migrate.ts` (v→v+1);
   - `core/render/plan.ts` (emit `AudioInstruction` for an enabled video clip whose asset has audio);
   - `core/timeline/operations.ts` (set gain, fades and enabled);
   - `core/command/*` (registry entries);
   - `src/donors/film-editor/components/PreviewPlayer.tsx` (unmute when enabled; recorded as a modification in the ledger);
   - `src/edit-ops.ts` and `src/main.tsx` (controls);
   - `tests/export-golden.test.ts`, `tests/migrate.test.ts` and `tests/parity.test.ts`.
7. **Ladder level:** E (justified: the defect lives in Yamakan's own plan compiler, and no donor shares its model).
8. **Dependency closure:** none new.
9. **Excluded:** separate "unlink" into an independent sound clip is deferred to Edit expansion.
10. **Modifications:** not applicable.
11. **Adapter contract:**
    - The clip field is `sound: { enabled: boolean, gainDb: number, fadeInTicks: Flicks, fadeOutTicks: Flicks }`.
    - It applies only to clips on video tracks whose asset is video and has an audio stream (recorded at probe).
    - It goes through the existing audio filter chain, unchanged.
12. **Canonical impact:**
    - New schema version.
    - **Migration preserves render intent:** migrated video clips get `enabled: false`, so existing exports stay byte-comparable.
    - New clips default to `enabled: true` when the asset has audio.
    - Recorded as an agent decision in [the agent decision record](../../AGENT_DECISION_RECORD.md).
13. **Security boundary:** unchanged (same FFmpeg worker, same inputs).
14. **Inherited tests:** export goldens, the A/V sync fixture and the parity replay.
15. **New tests:**
    - Golden: a video with a 1 kHz tone at a known instant is heard in the export at ±1 audio frame, under gain and fades.
    - Muting the track removes it.
    - The migration fixture keeps the old output.
    - Preview and export agree on enabled/disabled.
    - A negative fixture (sound off by one frame) fails.
16. **Validation commands:**
    - `npm run lint && npm run format:check && npm run provenance:check && npm test && npm run build && npm run test:e2e`
    - `npm run qualify:av-sync`
17. **Benchmark:** the 10-minute A/V fixture with the video's own sound shows drift ≤ 20 ms, measured against the frozen policy.
18. **Size:** 0 donor lines / an estimated 350–600 new lines including tests.
19. **Owner, phase, gate:** runtime builder; MVP; blocks the M-gate.
20. **Fallback and rollback:**
    - Fallback: auto-create a linked sound clip on a sound track, which needs a schema change that allows a video asset on a sound track.
    - Rollback: the new schema version is refused by older builds, and backups restore. A revert PR plus the migration's inverse is not offered, because forward-only migrations are policy.

### M2 — Provenance and brand tooling

1. **ID:** M2.
2. **Workspace/subsystem:** governance.
3. **Donor @ pin:** Yamakan's own `scripts/provenance.mjs`.
4. **Licence/notice:** GPL-3.0-or-later.
5. **Donor paths:** none.
6. **Yamakan paths:**
   - `scripts/provenance.mjs` (new required fields; a `--diff <source>` mode that re-hashes the upstream file at the pin from a local clone and reports drift);
   - `scripts/brand-check.mjs` (fails if a user-visible string in `src/**`, `src/i18n.ts` or the CLI help names a donor product);
   - `docs/provenance/import-policy.json`;
   - `tests/provenance.test.ts` (new).
7. **Ladder level:** E (small and Yamakan-specific).
8. **Dependency closure:** none.
9. **Excluded:** none.
10. **Modifications:** not applicable.
11. **Adapter contract:** each ledger record gains `license` (SPDX), `authorization` (`"public-licence"` or `"founder-attested"`), `owner` and `tests` (test file paths).
12. **Canonical impact:** none.
13. **Security boundary:** excluded paths stay hard failures.
14. **Inherited tests:** the existing provenance check in CI.
15. **New tests:**
    - A missing field fails.
    - An excluded path fails.
    - A donor name in a UI string fails.
    - A donor name in `NOTICE` or `notices/` passes.
16. **Validation commands:** `npm run provenance:check && node --test tests/provenance.test.ts`.
17. **Benchmark:** none.
18. **Size:** 0 donor lines / 200–350 new.
19. **Owner, phase, gate:** runtime builder (author), reviewed by a fresh independent security reviewer; MVP (W6); precedes any new import.
20. **Fallback and rollback:** revert the PR; the existing checks remain.

---

## Edit expansion (after the M-gate)

### M3 — Ripple

1. **ID:** M3.
2. **Workspace/subsystem:** Edit, ripple delete, insert and trim.
3. **Donor @ pin:** OpenCut-app/opencut-classic `cf5e79e919144200294fb9fed22a222592a0aeea`.
4. **Licence/notice:** MIT, "Copyright 2025-2026 OpenCut", in `notices/OpenCut-LICENSE` (already present for snapping and overlap).
5. **Donor paths:**
   - `apps/web/src/ripple/apply.ts` (77 lines);
   - `apps/web/src/ripple/diff.ts` (279);
   - `apps/web/src/ripple/shift.ts` (17);
   - `apps/web/src/ripple/index.ts` (4).
6. **Yamakan paths:**
   - `core/donors/opencut/ripple/{apply,diff,shift,index}.ts`;
   - commands in `core/timeline/operations.ts` (`yamakan.timeline.rippleDelete`, `rippleTrim`, `insert`).
7. **Ladder level:** B.
8. **Dependency closure:** `@/timeline/types` only (REA). Mapped to a local `types.ts` exposing the canonical clip fields that ripple reads (track id, start, duration, source start).
9. **Excluded:** none.
10. **Modifications:**
    - `MediaTime` → flick ticks with checked `addTicks`.
    - Element types → canonical clip subset.
    - No mutation in place: functions return a patch applied by the reducer.
11. **Adapter contract:** `ripple(project, edit) → ClipPatch[]`, validated by the canonical schema, committed in one revision.
12. **Canonical impact:** none (operations only).
13. **Security boundary:** pure functions; no I/O.
14. **Inherited tests:** none at the pin.
15. **New tests:**
    - A property test: total duration is conserved across ripple delete plus insert.
    - No overlaps after ripple (canonical validation).
    - Locked tracks are untouched.
    - Integer exactness at 23.976 and 29.97.
    - Undo restores bytes.
16. **Validation commands:** `npm test && npm run provenance:check && npm run test:e2e`.
17. **Benchmark:** a ripple on 10,000 clips across 20 tracks takes ≤ 50 ms p95 on Profile A (proposed target).
18. **Size:** 377 donor lines / 300–500 new.
19. **Owner, phase, gate:** editing builder; P05 Edit+; after the M-gate.
20. **Fallback and rollback:**
    - Fallback: the existing film-editor timeline operations (`src/edit-ops.ts`).
    - Rollback: remove the commands. The data model is unchanged.

### M4 — Group move

1. **ID:** M4.
2. **Workspace/subsystem:** Edit, multi-select move with snapping and track placement.
3. **Donor @ pin:** opencut-classic `cf5e79e9`.
4. **Licence/notice:** MIT (as above).
5. **Donor paths:**
   - `apps/web/src/timeline/group-move/build-group.ts` (91 lines);
   - `apps/web/src/timeline/group-move/resolve-move.ts` (497);
   - `apps/web/src/timeline/group-move/snap.ts` (100);
   - `apps/web/src/timeline/group-move/track-placement.ts` (83);
   - `apps/web/src/timeline/group-move/types.ts` (37);
   - `apps/web/src/timeline/group-move/index.ts` (12).
6. **Yamakan paths:** `core/donors/opencut/group-move/*`, reusing the already-imported `core/donors/opencut/{snapping,overlap}.ts`.
7. **Ladder level:** B.
8. **Dependency closure:**
   - `@/timeline`, `@/wasm`, snapping, placement/overlap, element update and snap sources.
   - Snapping and overlap are already imported.
   - The element-update helper is replaced by a canonical patch.
   - The snap sources map to canonical clip edges, markers and the playhead.
9. **Excluded:** UI drag handlers.
10. **Modifications:**
    - Flick ticks.
    - Canonical track kinds (video, audio, title): a clip never moves to a track of another kind.
    - Return a patch.
11. **Adapter contract:** `resolveGroupMove(project, selection, delta, snap) → { patch, snappedTo }`.
12. **Canonical impact:** none.
13. **Security boundary:** pure.
14. **Inherited tests:** none at the pin.
15. **New tests:**
    - Moving a group preserves relative offsets.
    - The group snaps to the nearest edge within the threshold.
    - A move refused for overlap leaves the revision unchanged.
    - Cross-kind placement is refused.
16. **Validation commands:** as for M3.
17. **Benchmark:** resolving a 100-clip group move takes ≤ 16 ms p95 (one frame at 60 Hz; proposed).
18. **Size:** 820 donor lines / 350–550 new.
19. **Owner, phase, gate:** editing builder; Edit+; after M3.
20. **Fallback and rollback:** single-clip move (present today).

### M5 — Retime (speed)

1. **ID:** M5.
2. **Workspace/subsystem:** Edit / Motion, constant speed and presets.
3. **Donor @ pin:** opencut-classic `cf5e79e9`.
4. **Licence/notice:** MIT; soundtouchjs is LGPL-2.1, used as an unmodified npm dependency with its notice in `notices/`.
5. **Donor paths:**
   - `apps/web/src/retime/rate.ts` (25 lines);
   - `apps/web/src/retime/resolve.ts` (48);
   - `apps/web/src/retime/split.ts` (34);
   - `apps/web/src/retime/presets.ts` (12);
   - `apps/web/src/retime/index.ts` (5);
   - `apps/web/src/retime/audio-stretch.ts` (182; preview only);
   - tests `apps/web/src/retime/__tests__/resolve.test.ts` (61) and `split.test.ts` (31).
6. **Yamakan paths:**
   - `core/donors/opencut/retime/*`;
   - `src/donors/opencut/audio-stretch.ts`;
   - canonical clip `speed` (rational);
   - `core/render/plan.ts`: video `setpts`, audio `atempo` chain, exact durations.
7. **Ladder level:** B.
8. **Dependency closure:** `@/timeline`, `@/retime/rate` and `soundtouchjs`.
9. **Excluded:** variable-speed curves (later, with M6).
10. **Modifications:**
    - The rate is a rational number (numerator/denominator integers) instead of a float, so durations stay exact in flicks.
    - Split keeps source mapping exact.
    - Tests are ported from Vitest to `node:test`.
11. **Adapter contract:** `sourceRange(clip)` and `timelineDuration(clip)` are pure and used by both the preview and `plan.ts`.
12. **Canonical impact:** new optional `speed` field (default 1/1); migration not needed when absent.
13. **Security boundary:** the FFmpeg filters are generated from integers only.
14. **Inherited tests:** 2 files (92 lines).
15. **New tests:**
    - Goldens at 0.5×, 2× and 3/2×: frame-exact boundaries and audio pitch preserved (spectral peak within ±2%).
    - Split of a retimed clip equals the whole.
    - Parity between preview and export.
16. **Validation commands:** `npm test && npm run test:e2e && npm run qualify:av-sync`.
17. **Benchmark:** a 30 s export at 2× stays ≤ 3× real time (the frozen export target).
18. **Size:** 306 donor source lines (plus 92 imported test lines) / 450–700 new.
19. **Owner, phase, gate:** media builder; Edit+; after the M-gate.
20. **Fallback and rollback:** the field is absent, so behaviour is unchanged.

### M6 — Keyframe animation

1. **ID:** M6.
2. **Workspace/subsystem:** Motion / Edit, animated clip properties (transform, opacity, gain).
3. **Donor @ pin:** opencut-classic `cf5e79e9`.
4. **Licence/notice:** MIT.
5. **Donor paths:**
   - `apps/web/src/animation/` files:

     | File                 | Lines |
     | -------------------- | ----- |
     | `bezier.ts`          | 90    |
     | `interpolation.ts`   | 425   |
     | `keyframes.ts`       | 1,361 |
     | `keyframe-query.ts`  | 314   |
     | `resolve.ts`         | 153   |
     | `values.ts`          | 61    |
     | `types.ts`           | 157   |
     | `curve-bridge.ts`    | 96    |
     | `channel-data.ts`    | 57    |
     | `graph-channels.ts`  | 114   |
     | `property-groups.ts` | 39    |
     | `path.ts`            | 22    |
     | `index.ts`           | 72    |

   - Test `__tests__/animated-params.test.ts` (241).
   - Not imported: `effect-param-channel.ts`, `graphic-param-channel.ts` and `transform.ts` (coupled to OpenCut effects and graphics).
6. **Yamakan paths:**
   - `core/donors/opencut/animation/*`;
   - canonical `animation` map on clips;
   - `core/render/plan.ts` compiles channels to FFmpeg expressions sampled per frame (`overlay` x/y, `scale`, `colorchannelmixer` alpha, `volume` with `eval=frame`).
7. **Ladder level:** B.
8. **Dependency closure:**
   - `@/animation/types`, `@/params`, `@/wasm` and `@/utils`.
   - `@params` descriptors are replaced by a Yamakan property registry (`core/timeline/properties.ts`, new).
   - `@/utils` helpers are inlined after REA confirms the exact functions used (task step 1).
9. **Excluded:** effect and graphic channels; OpenCut's keyframe UI.
10. **Modifications:**
    - Flick ticks.
    - Integer or fixed-point values for exact render compilation.
    - Bezier evaluation stays in floating point, but sampling happens only at frame instants, so preview and export compute identical samples (one shared function).
11. **Adapter contract:** `sampleChannel(channel, tick) → number` is used by both preview and plan. The plan emits per-frame values through an expression or a `sendcmd` file, chosen in step 1 by a fixture test.
12. **Canonical impact:** a new `animation` field (versioned; refused by older builds).
13. **Security boundary:** the compiler accepts only numbers; no user text reaches filter expressions.
14. **Inherited tests:** 1 file (241 lines).
15. **New tests:**
    - Keyframed position, opacity and gain goldens (±1 px, ±1 alpha step, ±0.1 dB at sampled frames).
    - Preview/export sample equality.
    - A negative fixture: a keyframe one frame late fails.
16. **Validation commands:** `npm test && npm run test:e2e && npm run qualify:preview`.
17. **Benchmark:** export of a 30 s, 3-layer animated fixture ≤ 3× real time; preview sampling ≤ 1 ms per frame per layer.
18. **Size:** 2,961 donor lines imported (plus a 241-line test) / 1,200–1,800 new.
19. **Owner, phase, gate:** media builder; Motion; after M5.
20. **Fallback and rollback:** a static-property clip (present today); the field absent means unchanged output.

---

## Studio (after the M-gate and the Studio ADR)

### M7 — Studio canvas core

1. **ID:** M7.
2. **Workspace/subsystem:** Studio, layered image canvas (raster, masks, regions, control layers, history, export).
3. **Donor @ pin:** invoke-ai/InvokeAI `ffe9e1a98b19640388d72f88ae0ecadf1bee1717`.
4. **Licence/notice:** Apache-2.0 plus the InvokeAI `NOTICE`, kept in `notices/InvokeAI-LICENSE` and `notices/InvokeAI-NOTICE`. The model licence files (SD1/SD2, SDXL and similar) are **not** imported.
5. **Donor paths:**
   - `invokeai/frontend/webv2/src/workbench/canvas-engine/**`, excluding the tests listed in field 9.
   - About 35,589 source lines; subtrees include `api.ts`, `engine.ts`, `contracts.ts`, `capabilities.ts`, `controllers/`, `document/`, `document-model/`, `editing/`, `export/`, `history/`, `input/`, `math/`, `render/`, `selection/`, `tools/` and `transform/`.
6. **Yamakan paths:**
   - `src/studio/canvas-engine/**` (copied subtree);
   - `src/studio/host/` (new): `documentStore.ts` maps `CanvasDocumentContractV3` ↔ a canonical `studioDocument` revision; `bitmapStore.ts` makes dirty-bitmap flushes content-addressed asset puts; `mediaReferences.ts` maps media references to asset ids; `platform.ts` provides `sha256` (WebCrypto) and `downloadBlob`.
7. **Ladder level:** B (copy the subtree whole; adapt only at the host seam).
8. **Dependency closure:**
   - `@workbench/mediaReferences`, `@workbench/controlAdapters` and `@platform/browser/{sha256,downloadBlob}` are supplied by the host.
   - npm `ag-psd` (MIT) and `perfect-freehand` (MIT). The donor declares `^31.0.2` and `^1.2.3`; Yamakan pins exact versions with integrity hashes. M8–M10 likewise pin `three` exactly.
   - `zod` is already present (Yamakan 4.4.3 against donor ^4.6.5; aligned in step 1).
9. **Excluded:**
   - `workbench/canvas-operations/**` (account lifecycle, gallery, backend).
   - `samInteraction.ts` and `samCoordinates.ts` until a local segmentation engine is qualified.
   - Any socket or backend file.
   - Browser-mode Vitest tests run only in the e2e browser.
10. **Modifications:**
    - Path aliases are rewritten (`@workbench/canvas-engine/*` → relative).
    - `controlAdapters` is stubbed to the engines Yamakan has enabled (none at first).
    - No behavioural changes inside the engine. The exception is that any decoding moved into a Worker is a ledgered modification.
    - The canvas-engine rules from InvokeAI's dependency policy (`src/architecture/dependencyPolicy.ts`, 305 lines, with `dependencyPolicy.test.ts` and `canvasSeamOwnership.test.ts`) are ported into a new `src/studio/boundaries.test.ts`. That file does not ship inside the subtree; `importBoundaries.test.ts`, named in the donor's `ARCHITECTURE.md`, does not exist at the pin. The new test also forbids `node:`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and dynamic `import()` inside the subtree. A text rule is easy to evade, so it is a lint aid, not the control.
    - **The control:** the page's Content Security Policy limits `connect-src` to `'self'` and refuses remote `img-src`, `font-src` and `script-src`. The e2e egress capture must show no request off loopback.
11. **Adapter contract:**
    - The host owns the document (canonical revision) and assets.
    - The engine owns pixels and transient history. Its undo is session-local; a committed canvas edit is a canonical revision with its own undo.
    - The `PersistenceController` flush barrier must complete before a revision commits.
12. **Canonical impact:** a new `studioDocument` entity (JSON contract V3 stored as canonical bytes) and bitmap assets.
13. **Security boundary:**
    - Browser-only code.
    - No network.
    - The engine only **writes** PSD at the pin (`export/psdExport.ts`, `writePsd`); `readPsd` appears only in tests. PSD import is not planned, and adding it would need its own Worker-based importer with limits.
    - Untrusted images reach `createImageBitmap` (`rasterController.ts`) with no dimension limit. The host seam checks the asset's probed dimensions first: at most 16,384 px a side and 64 megapixels. Larger images are refused before decoding.
14. **Inherited tests:** 145 test files (56,394 lines, Vitest). Node-compatible ones run under Vitest added as a dev dependency for `src/studio/**` only; browser-mode ones run in Playwright.
15. **New tests:**
    - Host round trip: document → revision → reload → identical contract bytes.
    - Bitmap flush → asset hash stable.
    - Kill during flush → no partial asset is published.
    - The 10,000-node limit is enforced by the canonical schema too.
16. **Validation commands:** `npx vitest run src/studio && npm test && npm run build && npm run test:e2e && npm run provenance:check`.
17. **Benchmark:**
    - A 4096×4096 document with 20 raster layers: brush stroke latency ≤ 16 ms p95.
    - Memory within the engine's own raster budget.
    - Reload ≤ 2 s on Profile A (proposed).
18. **Size:** about 35,600 donor lines / 2,500–4,000 new (host, schema, commands, UI shell, tests).
19. **Owner, phase, gate:** Studio builder; P06; after the M-gate and the Studio ADR (React 18 host, Vitest scope, bundle size).
20. **Fallback and rollback:**
    - Fallback: InvokeAI webv1 `controlLayers` (Konva), with higher coupling.
    - Rollback: the Studio workspace stays disabled behind its capability flag; no canonical data is written until enabled.

---

## Cinema

### M8 — Camera math

1. **ID:** M8.
2. **Workspace/subsystem:** Cinema, virtual camera moves.
3. **Donor @ pin:** storytold/artcraft `28a39a0de4a2fc2eccc237df2046c24245bd12ab`.
4. **Licence/notice:** Apache-2.0 / MIT (dual), with `NOTICE`.
5. **Donor paths:** `frontend/libs/components/pagescene/src/lib/engine/cameraMath.ts` (196 lines).
6. **Yamakan paths:** `src/cinema/camera/cameraMath.ts`.
7. **Ladder level:** A/B (copied nearly unchanged).
8. **Dependency closure:** `three` (`MathUtils`, `Vector3`, `PerspectiveCamera`), pinned.
9. **Excluded:** none.
10. **Modifications:** header and provenance only.
11. **Adapter contract:** pure functions on a camera state.
12. **Canonical impact:** none by itself.
13. **Security boundary:** pure.
14. **Inherited tests:** none.
15. **New tests:** lerp endpoints exact; pan/zoom invariants; no NaN at the poles.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** 196 donor lines / 80–150 new.
19. **Owner, phase, gate:** Cinema builder; P06.
20. **Fallback and rollback:** none needed.

### M9 — Scene schema

1. **ID:** M9.
2. **Workspace/subsystem:** Cinema, saved 3D blocking scenes.
3. **Donor @ pin:** ArtCraft `28a39a0d`.
4. **Licence/notice:** Apache-2.0 / MIT.
5. **Donor paths:** `frontend/libs/components/pagescene/src/lib/engine/EditorState/EditorStateJSON/{object_3d_json.ts,scene_state_json.ts}`.
6. **Yamakan paths:** `core/scene3d.ts` (zod) as a canonical entity.
7. **Ladder level:** B.
8. **Dependency closure:** none.
9. **Excluded:** `media_file_token` (hosted token).
10. **Modifications:**
    - Add camera intrinsics (focal length in mm, sensor width, near/far).
    - Add units (metres), Euler order and the asset id instead of the token.
    - Add a version.
11. **Adapter contract:** `Scene3D ↔ Object3DJSON[]` import for scenes exported from ArtCraft-format JSON.
12. **Canonical impact:** a new entity `scene3d`.
13. **Security boundary:** schema-validated, with these limits: 4 MiB of JSON, 10,000 items, nesting depth 16, strings of at most 1,024 characters, and finite numbers only.
14. **Inherited tests:** none.
15. **New tests:** round trip; a hostile scene (NaN, huge counts, unknown asset) refused.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** 34 donor lines (27 + 7) / 200–300 new.
19. **Owner, phase, gate:** Cinema builder; P06.
20. **Fallback and rollback:** the entity is absent.

### M10 — Camera controller

1. **ID:** M10.
2. **Workspace/subsystem:** Cinema, viewport navigation.
3. **Donor @ pin:** ArtCraft `28a39a0d`.
4. **Licence/notice:** Apache-2.0 / MIT.
5. **Donor paths:** `frontend/libs/components/pagescene/src/lib/engine/editor/CameraController.ts` (345 lines).
6. **Yamakan paths:** `src/cinema/camera/CameraController.ts`.
7. **Ladder level:** B.
8. **Dependency closure:** `three`, `three/addons/controls/PointerLockControls.js` and the ArtCraft event bus.
9. **Excluded:** the event bus (replaced by callbacks) and `@storyteller/*`.
10. **Modifications:** remove the hosted-platform hooks; keymap from `src/i18n.ts`-aware shortcuts.
11. **Adapter contract:** a controller emitting camera state.
12. **Canonical impact:** none.
13. **Security boundary:** browser only.
14. **Inherited tests:** none.
15. **New tests:** a scripted input sequence leads to the expected camera state.
16. **Validation commands:** `npm run test:e2e`.
17. **Benchmark:** 60 fps navigation on Profile A (proposed).
18. **Size:** 345 donor lines / 150–250 new.
19. **Owner, phase, gate:** Cinema builder; P06.
20. **Fallback and rollback:** `OrbitControls` from three.

---

## Director

### M11 — Identity contracts

1. **ID:** M11.
2. **Workspace/subsystem:** Director / Studio, character bible and identity.
3. **Donor @ pin:** mne03005-png/OpenVideoStudio `175da9960411fbe740932b0a08d57e32a4a36a18`.
4. **Licence/notice:** Apache-2.0 plus `NOTICE`.
5. **Donor paths:**
   - `studio/identity/models.py` (46 lines);
   - `studio/identity/assets.py` (66);
   - `studio/creative/identity.py` (206, formatting rules);
   - tests `studio/tests/test_identity.py` and `test_identity_provider.py`.
6. **Yamakan paths:** `core/identity.ts` (zod), `core/identity-format.ts` and `tests/identity.test.ts`.
7. **Ladder level:** B (translated Python → TypeScript).
8. **Dependency closure:** none.
9. **Excluded:** the provider implementations (InstantID, Ollama, edge-tts).
10. **Modifications:**
    - Paths → asset ids.
    - Bible version → canonical revision.
    - Frozen dataclasses → zod `readonly` schemas.
11. **Adapter contract:** a `CharacterAsset` is a canonical entity. `IdentityEncoding` and `IdentityApplication` are job outputs owned by an engine.
12. **Canonical impact:** a new entity `character`.
13. **Security boundary:** likeness consent is required before any encoding job runs. The likeness row of [SECURITY.md](../../SECURITY.md) requires, before the respective AI operation:
    - consent with version, purpose, expiry and revocation;
    - lineage;
    - invalidation of derived outputs and references when consent is revoked.

    This module implements all of it, not only the presence check.

14. **Inherited tests:** the identity test cases translated to `node:test`.
15. **New tests:**
    - Missing, expired, revoked or wrong-purpose consent refuses the encoding job.
    - Revocation invalidates every encoding and take derived from that consent.
    - A reference that is not an image is refused.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** 318 donor lines / 300–450 new.
19. **Owner, phase, gate:** Director builder; P07.
20. **Fallback and rollback:** the entity is absent.

### M12 — Stage manifests and gates

1. **ID:** M12.
2. **Workspace/subsystem:** Director / Flow, script → shots → takes → timeline stages with approvals.
3. **Donor @ pin:** calesthio/OpenMontage `9327439db69021ab4b0e2776729bf3b58fdb5a87`.
4. **Licence/notice:** AGPL-3.0. Combined under GPL-3.0 §13; once AGPL code is included, the combined work can in practice be distributed only under version 3, which limits Yamakan's "or later" option; ported files keep the AGPL notice and are listed separately in `NOTICE`. **AGPL §13 network-interaction duty:** Yamakan's local web server serves only its own user over loopback, but the source-offer link is added to the About view anyway.
5. **Donor paths:**
   - `schemas/pipelines/**` (manifest schema);
   - `lib/pipeline_loader.py` (240 lines);
   - the prerequisite and approval parts of `lib/checkpoint.py` (`_enforce_stage_prerequisites`, `_stage_requires_approval`, `get_next_stage`, `get_completed_stages`);
   - `pipeline_defs/framework-smoke.yaml`;
   - tests `tests/lib/test_checkpoint_prerequisites.py` and `tests/contracts/test_phase0_contracts.py`.
6. **Yamakan paths:**
   - `core/director/manifest.ts` (zod schema);
   - `core/director/stages.ts` (rules);
   - `assets/pipelines/*.yaml` (Yamakan-authored manifests);
   - `tests/director-stages.test.ts`.
7. **Ladder level:** B.
8. **Dependency closure:** `jsonschema` → zod.
9. **Excluded:**
   - The file checkpoint store (`write_checkpoint` and related).
   - `remotion-composer/**`, external font loading and `lib/providers/**`.
10. **Modifications:**
    - A checkpoint becomes a durable job plus a canonical revision receipt.
    - Approval is an explicit command, `director.approve`. It is **human-only**: it is granted to the browser session principal and never to MCP, CLI or SDK agent principals.
    - An approval binds the stage output's hash and an expiry, as [SECURITY.md](../../SECURITY.md) requires for approvals. A changed output needs a new approval.
    - Principals come from the authenticated transport or token (W4), never from a client-declared name such as MCP `clientInfo`.
11. **Adapter contract:** `nextStage(project, manifest) → stage | blocked(reasons)`.
12. **Canonical impact:** new entities `directorRun` and `stageReceipt`.
13. **Security boundary:** manifests are data only and cannot name executables.
14. **Inherited tests:** 6 test cases (run earlier at the pin).
15. **New tests:**
    - Resume after a kill continues at the correct stage.
    - A fenced attempt cannot write a stale receipt.
    - An approval-required stage blocks agents without approval.
    - An agent principal calling `director.approve`, including on its own stage, is refused.
    - An approval for an output hash that has since changed is refused.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** about 500 donor lines / 700–1,000 new.
19. **Owner, phase, gate:** Director builder; P07. W4 (transport-bound principals) is a hard prerequisite.
20. **Fallback and rollback:** a manual storyboard (no stages).

---

## Engines and the router

### M13 — Local engine adapter and ComfyUI

1. **ID:** M13.
2. **Workspace/subsystem:** Studio, Motion and Smart Router; the local generative engine.
3. **Donor @ pin:**
   - Comfy-Org/ComfyUI `7f7fd918ed0815c5d5ef2ccfe44bfc8e72cfd217` (the engine);
   - OpenVideoStudio `studio/providers/_comfy_client.py` (147 lines, client shape).
4. **Licence/notice:**
   - ComfyUI is GPL-3.0 and is not copied; if Yamakan bundles it, the source offer goes in `NOTICE`.
   - The OpenVideoStudio client is Apache-2.0.
5. **Donor paths:** client shape from `_comfy_client.py`. Engine: none copied.
6. **Yamakan paths:**
   - `core/engines/contract.ts` (engine capability, submit, poll, cancel, outputs);
   - `core/engines/comfyui.ts`;
   - `core/engines/fake.ts` (for tests);
   - `tests/engines.test.ts` (new).
7. **Ladder level:** D (wrap) plus B for the client.
8. **Dependency closure:**
   - Python and ComfyUI pinned in a separate runtime folder, installed only by explicit user action.
   - **No weights are downloaded by Yamakan.**
9. **Excluded:**
   - ComfyUI-Manager and automatic custom-node install.
   - Any node not in a pinned allowlist. This is **enforced** two ways:
     - **Launch flags, checked at the pin's `comfy/cli_args.py`:** `--disable-all-custom-nodes`, `--disable-api-nodes`, `--disable-partner-nodes`, `--offline`, `--disabled-nodes-config <pinned file>`, `--disable-metadata`, a pinned `--front-end-root` (never `--front-end-version`, which downloads), and fixed `--input-directory`, `--output-directory`, `--user-directory` and `--temp-directory`. `--enable-manager` is never passed, so ComfyUI-Manager is not loaded at all. `--disable-manager-ui` is not relied on, because its help text says background tasks still run.
     - **Service-side validation:** every node `class_type` in a graph must be in the pinned allowlist before submit. Core ComfyUI ships paid partner/API nodes, so this check is required even with the flags.
10. **Modifications:**
    - Polling → durable job attempts with fencing.
    - Output path lookup → `/view` download into content-addressed import, then probe.
11. **Adapter contract:**
    - `EngineAdapter { capabilities(), submit(graph, inputs), status(id), cancel(id), outputs(id) }`.
    - The server is started by procd as a contained worker bound to 127.0.0.1 on an ephemeral port.
    - Outbound-network denial for engines is **not** in place today. PR #29 is read containment, and SECURITY.md treats policy types as not being enforcement. Network denial is part of gate E-SEC below.
12. **Canonical impact:** takes and outputs are assets with a generation receipt (graph hash, engine version, seed).
13. **Security boundary:**
    - procd containment.
    - **Unresolved: an authenticated channel.** ComfyUI at the pin has no auth or token option. AppContainer loopback isolation would either block the service or need a machine-wide loopback exemption, which opens the port to every local process and user. Until this is solved, any local process could submit graphs to `/prompt` or write through `/upload/*`. **No real engine runs until this is resolved.** Candidate designs (decided in the gate below):
      - a per-launch-token reverse proxy owned by the service;
      - a named pipe with an owner-only ACL.
    - Uploads are only the job's inputs. Outputs are imported through the probe path and never trusted.
    - **Gate E-SEC before any real engine run, required in addition to founder decision F.** All of the following must hold:
      - the authenticated channel above;
      - B4 qualified for Python and its descendant processes ([SECURITY.md](../../SECURITY.md));
      - an enforced network-deny mechanism, proved by a packet-capture test;
      - a negative test showing that a second account and an unrelated local process cannot reach the engine;
      - the launch-flag and node-allowlist checks above.
14. **Inherited tests:** the OpenVideoStudio `test_comfy_client.py` cases translated against the fake engine.
15. **New tests:**
    - Cancel ends the attempt.
    - A crash mid-job leads to retry with fencing.
    - An output that fails the probe is quarantined.
    - The engine absent leaves the capability disabled with a reason.
16. **Validation commands:** `npm test`. A real-engine run needs qualified hardware and weights (founder choice F), so it is not part of CI.
17. **Benchmark:** recorded per named hardware once F is approved.
18. **Size:** 147 donor lines (shape) / 900–1,400 new.
19. **Owner, phase, gate:** engine builder; P06. The contract and the fake engine land first. A real engine needs gate E-SEC and founder decision F.
20. **Fallback and rollback:** the fake engine only; the capability is disabled.

---

## Media and preview

### M14 — Mediabunny

1. **ID:** M14.
2. **Workspace/subsystem:** Edit / Audio preview, browser demux, waveform and thumbnails.
3. **Donor @ pin:** Vanilagy/mediabunny `9d36fc57`, npm `mediabunny@1.61.3`.
4. **Licence/notice:** MPL-2.0, unmodified, so only notice and source availability apply.
5. **Donor paths:** npm package (no copy).
6. **Yamakan paths:**
   - `package.json` dependency;
   - `src/media/demux.ts` (new wrapper);
   - `src/donors/film-editor/components/Waveform.tsx` (modification: a data source from Mediabunny-decoded samples instead of a full `decodeAudioData`).
7. **Ladder level:** A.
8. **Dependency closure:** none (REA).
9. **Excluded:**
   - URL, HLS and segmented sources.
   - Encoding/muxing (export stays FFmpeg).
10. **Modifications:** none to the library.
11. **Adapter contract:** `openAsset(blob) → tracks, packets, samples`. The input is a `Blob` or `ArrayBuffer` fetched by the page through the existing authenticated media route. Mediabunny's URL source is never used.
12. **Canonical impact:** none.
13. **Security boundary:**
    - It parses untrusted media in the browser, so it runs in a Worker. Input is capped at the import size limit, and the Worker is terminated after a 2 s timeout. Browsers cannot cap Worker memory, so the 64 MiB figure below is a benchmark, not a limit.
    - Results never override the server probe.
14. **Inherited tests:** library tests are not run (dependency).
15. **New tests:**
    - The hostile-media corpus (from PR #29) loaded in the browser never hangs more than 2 s or crashes the page.
    - Waveform peaks equal the FFmpeg-derived reference within 1%.
16. **Validation commands:** `npm run test:e2e && npm run qualify:playback`.
17. **Benchmark:** waveform for a 10-minute WAV ≤ 1.5 s; memory ≤ 64 MiB in the Worker (proposed).
18. **Size:** 0 copied / 250–400 new.
19. **Owner, phase, gate:** media builder; Edit+.
20. **Fallback and rollback:** the current `decodeAudioData` path.

### M15 — JASSUB live title preview

1. **ID:** M15.
2. **Workspace/subsystem:** Edit, titles in the live preview.
3. **Donor @ pin:** ThaUnknown/jassub `dea3d2d3`, which is `package.json` version 2.5.20. The npm dependency is pinned to exactly `jassub@2.5.20` with its lockfile integrity hash.
4. **Licence/notice:** the pinned `package.json` declares `LGPL-2.1-or-later AND (FTL OR GPL-2.0-or-later) AND MIT AND MIT-Modern-Variant AND ISC AND NTP AND Zlib AND BSL-1.0`. Obligations:
   - **FreeType:** Yamakan elects GPL-2.0-or-later, because FTL's credit clause is generally treated as GPL-incompatible.
   - **fribidi (LGPL-2.1-or-later):** the notice, plus replaceability of the WebAssembly module.
   - **Everything else:** all notices are copied into `notices/`.
5. **Donor paths:** npm (no copy).
6. **Yamakan paths:** `src/preview/titles.ts`; `src/donors/film-editor/components/PreviewPlayer.tsx` (overlay canvas).
7. **Ladder level:** A.
8. **Dependency closure:** WebAssembly; the font files are the same pinned IBM Plex Sans Arabic bytes served by the service.
9. **Excluded:** system-font fallback. Only the pinned fonts are provided, through options that load fonts from the service alone. `queryLocalFonts` and any remote font loading are disabled explicitly. The threaded build needs COOP/COEP headers, which would change the service's headers, so step 1 chooses between the non-threaded build and a reviewed header change.
10. **Modifications:** none.
11. **Adapter contract:** the same `titles.ass` generated by `core/render/ass.ts`.
12. **Canonical impact:** none.
13. **Security boundary:** ASS text is generated by Yamakan (override-injection already blocked).
14. **Inherited tests:** none.
15. **New tests:** glyph-box SSIM ≥ 0.95 against the export frame for the T7 Arabic/Latin fixtures; a negative control with a different font fails.
16. **Validation commands:** `npm run qualify:typography && npm run test:e2e`.
17. **Benchmark:** title overlay ≤ 4 ms per frame at 1080p.
18. **Size:** 0 copied / 200–350 new.
19. **Owner, phase, gate:** media builder; Edit+, after the native Arabic review of T7 goldens.
20. **Fallback and rollback:** the server reference still (present today).

### M16 — OTIO interchange

1. **ID:** M16.
2. **Workspace/subsystem:** Edit, export and import of timelines for other editors.
3. **Donor @ pin:** AcademySoftwareFoundation/OpenTimelineIO `00c22fa3`, as a test oracle only.
4. **Licence/notice:** Apache-2.0 (not shipped).
5. **Donor paths:** the schema reference `src/opentimelineio/` (read only).
6. **Yamakan paths:** `core/interchange/otio.ts` and `tests/otio.test.ts`.
7. **Ladder level:** E (justified: the format is JSON, and the native library needs an unqualified C++ build on Windows).
8. **Dependency closure:** none at runtime; CI runs `pip install opentimelineio==<pinned>` only in a test job.
9. **Excluded:** adapters for other formats.
10. **Modifications:** not applicable.
11. **Adapter contract:**
    - `toOtio(project) → JSON`, using rational time (rate 705,600,000).
    - `fromOtio(json) → proposal`, which is a reviewable batch, never a direct write.
12. **Canonical impact:** none.
13. **Security boundary:** import is a hostile-input parser. Its limits are 16 MiB of JSON, 50,000 objects, nesting depth 32 and strings of at most 4,096 characters, with rational times checked as integers. Media references must resolve to existing assets.
14. **Inherited tests:** none.
15. **New tests:** a round trip through the official Python library preserves every clip's range exactly.
16. **Validation commands:** `npm test`; CI job `otio-oracle`.
17. **Benchmark:** none.
18. **Size:** 0 copied / 500–800 new.
19. **Owner, phase, gate:** editing builder; P05.
20. **Fallback and rollback:** none (feature absent).

---

## Agents

### M17 — Founder repositories

1. **ID:** M17.
2. **Workspace/subsystem:** Agents / Quality.
3. **Donor @ pin:**
   - TheHalfMoon/Gomrey `5f299a7a` (job transition rules);
   - Ascout `ca6b6f51` (assurance lineage);
   - Ninerr `bec85aa7` (session and transport, beyond the already-imported serializer).
4. **Licence/notice:** founder-owned; authorization recorded ([11](11_SOURCE_PROVENANCE_AND_BRANDING.md)).
5. **Donor paths:** Gomrey transition-rule module and its 8 pure tests (catalog); Ascout review lineage contracts.
6. **Yamakan paths:** `core/jobs.ts` (rule table) and `core/agents/lineage.ts`.
7. **Ladder level:** B.
8. **Dependency closure:** in-memory rules only.
9. **Excluded:** Orcel/Aly shell authority and Aladdin (not pinned in the catalog, not inspected).
10. **Modifications:** rules applied within the SQLite transaction.
11. **Adapter contract:** `transition(state, event) → state | refusal`.
12. **Canonical impact:** none.
13. **Security boundary:** per-agent principals (open defect) come first.
14. **Inherited tests:** 8 Gomrey tests.
15. **New tests:** each refused transition leaves the row unchanged.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** about 300 donor lines / 250–400 new.
19. **Owner, phase, gate:** runtime builder; P09.
20. **Fallback and rollback:** the current job states.

---

## Not imported (decisions)

| Candidate                                                                                              | Decision                                    | Reason (evidence)                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------- |
| OpenCut `apps/web/src/commands/**`, `EditorCore`                                                       | Reject                                      | REA: every command imports `@/core`, a second state engine    |
| OpenCut masks UI                                                                                       | Reject; geometry later                      | UI-coupled (R1)                                               |
| InvokeAI `canvas-operations`                                                                           | Reject                                      | Account lifecycle, gallery, backend (R2)                      |
| ArtCraft `save_manager.ts`, `HistoryManager.ts`, Tauri configs, browser-emulation and consumer clients | Reject                                      | Hosted coupling, second history; mandatory do-not-import list |
| OpenMontage checkpoint file store, Remotion composer                                                   | Reject                                      | Second authority; company-size licence                        |
| Remotion, React Video Editor                                                                           | Reference only                              | Company-size licences (H1)                                    |
| MLT, Kdenlive, Blender                                                                                 | Reference; Blender a later worker candidate | Second render model; native build unqualified                 |
| Film editor `audioMastering` remote provider                                                           | Reject                                      | Hosted service                                                |
| Wan2GP, StoryMind                                                                                      | Reference                                   | Community licence; default third-party LLM endpoint           |
