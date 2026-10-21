# P10 task cards

Each card: objective, existing implementation, gap, files, fixtures, acceptance, security, E2E, dependencies, rollback, definition of done.

---

## P10-00 — Plan package and authorization record

- **Objective:** Publish implementation-ready P10 plan; record founder P10 authorization; update frontier.
- **Existing:** W1–W18 engineering merged; CURRENT next-eligible says no further W-card without new founder decision.
- **Gap:** No P10 plan; frontier does not yet name P10.
- **Files:** `docs/plans/P10-qualification-activation/*`, `docs/FOUNDER_DECISION_RECORD.md`, `specs/CURRENT.md`.
- **Fixtures:** None.
- **Acceptance:** Plan docs merged; authorization recorded without inventing extra permissions; CURRENT points to P10.
- **Security review:** Docs-only; confirm no gate weakening.
- **E2E:** N/A.
- **Dependencies:** None.
- **Rollback:** Revert docs PR.
- **DoD:** Planning PR merged; PROGRESS.md lists next card P10-01.

---

## P10-01 — Finish Studio canvas (Q8–Q10)

- **Objective:** Real brush path, durable assets, Q8–Q10 receipts; enable `STUDIO_ENABLED` only if all pass.
- **Existing:** InvokeAI webv2 engine + host (PR #52); `STUDIO_ENABLED=false`; Q7a proper pass; Q8 scaffolded mount only; `uploadImage` returns metadata without storage; `imageResolver` returns empty `Blob`.
- **Gap:** No real stroke E2E; incomplete asset round-trip; Q9 inherited suite incomplete; Q10 app-chunk/stroke latency not measured.
- **Files:** `src/studio/StudioCanvas.tsx`, `src/studio/host/*`, `core/studio.ts`, Studio E2E, `docs/evidence/qualification/q8*`, `q9*`, `q10*`, ADR amendment.
- **Fixtures:** 1024² and 4096²×20-layer documents; Playwright stroke; inherited node-mode tests per M7 exclusions.
- **Acceptance:**
  - Q8: Playwright draws a stroke; pixels/state change; undo/redo/save/reopen/export as applicable; mount-without-stroke ≠ PASS.
  - Q9: ≥90% applicable node-mode inherited tests; exclusions explicit; limit/loader/dependency/seam tests retained.
  - Q10: Studio **application** chunk ≤ 2.5 MiB gzip; brush p95 ≤ 16 ms on 4096²/20 layers; fallback = keep flag off (do not raise threshold).
- **Security:** No unauthorized egress; assets content-addressed under Yamakan; no competing persistence; CSP unchanged unless separately reviewed.
- **E2E:** Browser Studio journey with `forceMount` then enablement path.
- **Dependencies:** P10-00.
- **Rollback:** Keep `STUDIO_ENABLED=false`.
- **DoD:** Receipts bound to exact head; flag on only if Q8–Q10 pass; else documented binding fallback.

---

## P10-02 — Finish Animation

- **Objective:** Wire OpenCut animation into UI + renderer; qualify; enable only if user-visible path passes.
- **Existing:** Modules imported (W16); Q13/Q14 scripts; `ANIMATION_ENABLED=false`.
- **Gap:** UI/render wiring incomplete.
- **Files:** `core/donors/opencut/animation/*`, timeline UI, `core/render/plan.ts`, flags, E2E, Q13/Q14 receipts.
- **Fixtures:** Keyframe fixture from Q13; rational fps; negative/boundary cases.
- **Acceptance:** Keyframes, interpolation, frame-accurate preview/export parity, undo/redo, persistence, reopen; Q13/Q14 green.
- **Security:** No new spawn/filtergraph surface beyond plan compiler.
- **E2E:** Edit keyframes → export → compare.
- **Dependencies:** P10-00 (parallel after).
- **Rollback:** Flag off.
- **DoD:** Flag on only after qualified path; else residual recorded.

---

## P10-03 — Finish Cinema (supported scope)

- **Objective:** Qualify camera/scene load, transforms, persistence, preview; enable supported preview/camera only.
- **Existing:** ArtCraft camera/scene (W14); `yamakan.scene.save`; `CINEMA_ENABLED=false`.
- **Gap:** UI attachment; cross-session reopen E2E; clear separation from generative video.
- **Files:** `src/cinema/*`, `core/scene3d.ts`, Cinema UI, flags, E2E.
- **Fixtures:** Scene with camera intrinsics and object transforms.
- **Acceptance:** Load/save/reopen; units/coords; revision history; safe asset refs; browser interaction. AI-conditioned camera stays disabled with reasons.
- **Security:** Asset ids only; no remote URL fetch.
- **E2E:** Cinema camera preview journey.
- **Dependencies:** P10-00.
- **Rollback:** Flag off / partial capability map.
- **DoD:** Supported capabilities enabled; unsupported stay disabled with reasons.

---

## P10-04 — Finish Director (manual/deterministic)

- **Objective:** Usable script/shot/identity/stage flows without AI models.
- **Existing:** Identity + stages (W15); human-only approve/consent; `DIRECTOR_ENABLED=false`.
- **Gap:** User-facing UI/E2E; REST/MCP parity proof for Director commands.
- **Files:** `core/director/*`, `core/identity.ts`, Director UI, tests, flags.
- **Fixtures:** Manifest stages; consent grant/revoke/expiry; agent refusal.
- **Acceptance:** Manual stage advance/approve/reject/retry; continuity metadata; job fencing; identity-consent; revision; save/reopen; REST/MCP parity; Q15 presence policy preserved.
- **Security:** Human-only commands stay browser-principal; agent refused; security review required.
- **E2E:** Journey 5 (manual).
- **Dependencies:** P10-00.
- **Rollback:** Flag off.
- **DoD:** Manual Director enabled; model-dependent stages remain disabled.

---

## P10-05 — Finish Quality Lab (deterministic)

- **Objective:** Qualify deterministic evaluation datasets/comparisons; keep paid/provider ranks off.
- **Existing:** Quality Lab + lineage (W17); `QUALITY_LAB_ENABLED=false`.
- **Gap:** Fixture datasets, blinded compare where applicable, receipts, inspectable evidence.
- **Files:** `core/quality/lab.ts`, fixtures, commands, flags, receipts.
- **Fixtures:** Labeled synthetic or real artifacts; never claim generative quality from fake engines.
- **Acceptance:** Deterministic load/compare/score/failure categories/benchmark receipts/regression; lineage inspectable.
- **Security:** No egress to paid providers.
- **E2E:** Lab compare on fixtures via REST/MCP.
- **Dependencies:** P10-00.
- **Rollback:** Flag off for unsupported; enable only deterministic subset.
- **DoD:** Deterministic lab on; unsupported comparisons disabled with explanations.

---

## P10-06 — Finish Smart Router (explain)

- **Objective:** Qualify deterministic eligibility/explain; do not enable real model routes.
- **Existing:** Router explain (W17); `ROUTER_PROVIDERS_ENABLED=false`.
- **Gap:** Full rule matrix receipts; capability/cost/offline/safety refusal coverage.
- **Files:** `core/router/explain.ts`, tests, receipts.
- **Fixtures:** Eligibility matrix covering offline, entitlement, safety, fallback.
- **Acceptance:** Deterministic selection/refusal with exact receipts; providers stay off.
- **Security:** No paid route activation; E-SEC still binds real engines.
- **E2E:** `yamakan.router.explain` over REST/MCP.
- **Dependencies:** P10-00.
- **Rollback:** Providers stay false.
- **DoD:** Explain qualified; providers remain false unless separate founder auth.

---

## P10-07 — W12 JASSUB engineering + H1 packet

- **Objective:** Complete all engineering prerequisites for JASSUB; prepare H1 review packet; keep disabled until H1.
- **Existing:** W12 blocked on H1; T7 typography goldens exist.
- **Gap:** Pinned JASSUB dependency path, Q11 measurements, CSP review, Arabic review packet.
- **Files:** `src/preview/titles.ts` (or equivalent), PreviewPlayer, CSP commit if needed, Q11 receipts, `docs/evidence/h1-arabic-review-packet/`.
- **Fixtures:** T7 Arabic/Latin set; font-substitution negative; bidi/diacritics/digits.
- **Acceptance:** Q11 ≤4 ms/frame and SSIM ≥0.95 or recorded fallback; H1 packet with images + checklist; no fabricated Arabic sign-off.
- **Security:** CSP/`wasm-unsafe-eval` or COOP/COEP only with security review.
- **E2E:** Playwright title preview when engineered.
- **Dependencies:** P10-00; **H1 human** for enablement.
- **Rollback:** Server reference still remains primary; JASSUB off.
- **DoD:** Engineering ready; H1 packet published; enablement waits for native Arabic reviewer.

---

## P10-08 — Windows bundle engineering (R6)

- **Objective:** Complete achievable installable-bundle engineering beyond dev scaffold.
- **Existing:** Bundle scaffold (W5), install-dev helper (#40), R8 fontconfig pin closed.
- **Gap:** Launch-time verify, update/rollback/uninstall, SBOM/licenses/hashes, tamper refusal, junction protection, Profile A still external.
- **Files:** `scripts/bundle*`, manifests, SBOM, install/update/rollback scripts, tests.
- **Fixtures:** Safe test install root (no unrelated app changes).
- **Acceptance:** Pinned runtime/FFmpeg/fonts; integrity; install/update/rollback/uninstall; workspace/recovery preservation; tampered binary refuse.
- **Security:** Tamper/reparse tests; no weakened font isolation.
- **E2E:** Install from artifact → launch → uninstall in test location.
- **Dependencies:** P10-00.
- **Rollback:** Dev profile remains.
- **DoD:** Achievable R6 engineering closed; Profile A residual listed if still external.

---

## P10-09 — Release evidence (R7)

- **Objective:** Exact-head qualification matrix and bound receipts for available commands.
- **Existing:** `qualify:release`, `qualify:release-evidence`, t10 receipts at older heads.
- **Gap:** Fresh exact-head matrix covering Studio/creative journeys where enabled; MCP/UI parity transcript residual; Profile A still external.
- **Files:** `docs/evidence/qualification/*`, release proposal updates, PROGRESS.
- **Fixtures:** Per `package.json` qualify scripts (confirm live names before run).
- **Acceptance:** Receipts bound to commit, artifact hashes, machine profile, command outputs; never claim Profile A from dev-profile alone.
- **Security:** Offline/network checks as available without admin packet capture (H2 remains).
- **E2E:** Full available qualify + e2e suite.
- **Dependencies:** Prefer after capability cards that change enablement.
- **Rollback:** N/A (evidence-only).
- **DoD:** Matrix published; residuals explicit.

---

## P10-10 — Windows security tests (achievable)

- **Objective:** Run authorized, safe security tests; package true external-admin requirements.
- **Existing:** AppContainer containment tests; probe-other ACL; Q15 fallback noted.
- **Gap:** Second-account, clean-profile, disk-full, packet capture need admin/H3/H4; do not substitute weaker tests as passes.
- **Files:** Tests/scripts for achievable cases; escalation packets for H2–H4.
- **Fixtures:** Contained workers; tamper; launch-secret reuse; token revoke; backup/restore; low-disk where injectable.
- **Acceptance:** Distinguish isolated vs simulated; escalate H2–H4 honestly.
- **Security:** Never create privileged accounts or weaken host security for green receipts.
- **E2E:** Existing containment/hostile-media where safe.
- **Dependencies:** P10-08 helpful for artifact-bound runs.
- **Rollback:** N/A.
- **DoD:** Achievable tests green; external gates listed precisely.
