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
   - `tests/provenance.test.ts`.
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
19. **Owner, phase, gate:** security reviewer; MVP (W6); precedes any new import.
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
19. **Owner, phase, gate:** editing builder; P10 Edit+; after the M-gate.
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
18. **Size:** 398 donor lines / 450–700 new.
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
   - npm `ag-psd` (MIT) and `perfect-freehand` (MIT), pinned.
   - `zod` is already present (Yamakan 4.4.3 against donor ^4.6.5; aligned in step 1).
9. **Excluded:**
   - `workbench/canvas-operations/**` (account lifecycle, gallery, backend).
   - `samInteraction.ts` and `samCoordinates.ts` until a local segmentation engine is qualified.
   - Any socket or backend file.
   - Browser-mode Vitest tests run only in the e2e browser.
10. **Modifications:**
    - Path aliases are rewritten (`@workbench/canvas-engine/*` → relative).
    - `controlAdapters` is stubbed to the engines Yamakan has enabled (none at first).
    - No behavioural changes inside the engine.
    - `importBoundaries.test.ts` is kept and extended to forbid `node:`, `fetch` and `WebSocket` inside the subtree.
11. **Adapter contract:**
    - The host owns the document (canonical revision) and assets.
    - The engine owns pixels and transient history. Its undo is session-local; a committed canvas edit is a canonical revision with its own undo.
    - The `PersistenceController` flush barrier must complete before a revision commits.
12. **Canonical impact:** a new `studioDocument` entity (JSON contract V3 stored as canonical bytes) and bitmap assets.
13. **Security boundary:**
    - Browser-only code.
    - No network.
    - PSD import (`ag-psd`) parses untrusted files, so it gets size and dimension limits and runs in a Worker.
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
13. **Security boundary:** schema-validated; bounded item count (10,000).
14. **Inherited tests:** none.
15. **New tests:** round trip; a hostile scene (NaN, huge counts, unknown asset) refused.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** about 60 donor lines / 200–300 new.
19. **Owner, phase, gate:** Cinema builder; P06.
20. **Fallback and rollback:** the entity is absent.

### M10 — Camera controller

1. **ID:** M10.
2. **Workspace/subsystem:** Cinema, viewport navigation.
3. **Donor @ pin:** ArtCraft `28a39a0d`.
4. **Licence/notice:** Apache-2.0 / MIT.
5. **Donor paths:** `.../engine/CameraController.ts` (345 lines).
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
13. **Security boundary:** likeness consent is required before any encoding job runs (the likeness row of [SECURITY.md](../../SECURITY.md) requires it before the respective AI operation; this module implements it).
14. **Inherited tests:** the identity test cases translated to `node:test`.
15. **New tests:** a missing consent refuses the encoding job; a reference not an image is refused.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** 318 donor lines / 300–450 new.
19. **Owner, phase, gate:** Director builder; P07.
20. **Fallback and rollback:** the entity is absent.

### M12 — Stage manifests and gates

1. **ID:** M12.
2. **Workspace/subsystem:** Director / Flow, script → shots → takes → timeline stages with approvals.
3. **Donor @ pin:** calesthio/OpenMontage `9327439db69021ab4b0e2776729bf3b58fdb5a87`.
4. **Licence/notice:** AGPL-3.0. Combined under GPL-3.0 §13; ported files keep the AGPL notice and are listed separately in `NOTICE`. **AGPL §13 network-interaction duty:** Yamakan's local web server serves only its own user over loopback, but the source-offer link is added to the About view anyway.
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
    - Approval is an explicit command with a principal.
11. **Adapter contract:** `nextStage(project, manifest) → stage | blocked(reasons)`.
12. **Canonical impact:** new entities `directorRun` and `stageReceipt`.
13. **Security boundary:** manifests are data only and cannot name executables.
14. **Inherited tests:** 6 test cases (run earlier at the pin).
15. **New tests:**
    - Resume after a kill continues at the correct stage.
    - A fenced attempt cannot write a stale receipt.
    - An approval-required stage blocks agents without approval.
16. **Validation commands:** `npm test`.
17. **Benchmark:** none.
18. **Size:** about 500 donor lines / 700–1,000 new.
19. **Owner, phase, gate:** Director builder; P07.
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
   - `tests/engines.test.ts`.
7. **Ladder level:** D (wrap) plus B for the client.
8. **Dependency closure:**
   - Python and ComfyUI pinned in a separate runtime folder, installed only by explicit user action.
   - **No weights are downloaded by Yamakan.**
9. **Excluded:**
   - ComfyUI-Manager and automatic custom-node install.
   - Any node not in a pinned allowlist.
10. **Modifications:**
    - Polling → durable job attempts with fencing.
    - Output path lookup → `/view` download into content-addressed import, then probe.
11. **Adapter contract:**
    - `EngineAdapter { capabilities(), submit(graph, inputs), status(id), cancel(id), outputs(id) }`.
    - The server is started by procd as a contained worker bound to 127.0.0.1 on an ephemeral port, with no outbound network.
12. **Canonical impact:** takes and outputs are assets with a generation receipt (graph hash, engine version, seed).
13. **Security boundary:**
    - procd containment.
    - A loopback port reachable only by the service: a random token header via ComfyUI's `--` options if available; otherwise the port is protected by the AppContainer loopback rules. **Unresolved, task step 1.**
    - Uploads are only the job's inputs.
14. **Inherited tests:** the OpenVideoStudio `test_comfy_client.py` cases translated against the fake engine.
15. **New tests:**
    - Cancel ends the attempt.
    - A crash mid-job leads to retry with fencing.
    - An output that fails the probe is quarantined.
    - The engine absent leaves the capability disabled with a reason.
16. **Validation commands:** `npm test`. A real-engine run needs qualified hardware and weights (founder choice F), so it is not part of CI.
17. **Benchmark:** recorded per named hardware once F is approved.
18. **Size:** 147 donor lines (shape) / 900–1,400 new.
19. **Owner, phase, gate:** engine builder; P06; the real engine requires founder decision F.
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
   - `src/media/demux.ts` (wrapper);
   - `src/donors/film-editor/components/Waveform.tsx` (modification: a data source from Mediabunny-decoded samples instead of a full `decodeAudioData`).
7. **Ladder level:** A.
8. **Dependency closure:** none (REA).
9. **Excluded:**
   - URL, HLS and segmented sources.
   - Encoding/muxing (export stays FFmpeg).
10. **Modifications:** none to the library.
11. **Adapter contract:** `openAsset(blobUrlFromService) → tracks, packets, samples`, read through the existing authenticated media route.
12. **Canonical impact:** none.
13. **Security boundary:**
    - It parses untrusted media in the browser, so it runs in a Worker, size-limited.
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
3. **Donor @ pin:** ThaUnknown/jassub `dea3d2d3`, npm `jassub` at the release matching the pin (step 1 confirms the release; 2.5.21 is current on npm).
4. **Licence/notice:** MIT plus bundled libass (ISC), FreeType (FTL or GPL-2.0-or-later) and HarfBuzz/fribidi notices; all copied into `notices/`.
5. **Donor paths:** npm (no copy).
6. **Yamakan paths:** `src/preview/titles.ts`; `src/donors/film-editor/components/PreviewPlayer.tsx` (overlay canvas).
7. **Ladder level:** A.
8. **Dependency closure:** WebAssembly; the font files are the same pinned IBM Plex Sans Arabic bytes served by the service.
9. **Excluded:** system-font fallback (only the pinned fonts are provided).
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
13. **Security boundary:** import is a hostile-input parser with size limits; media references must resolve to existing assets.
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
