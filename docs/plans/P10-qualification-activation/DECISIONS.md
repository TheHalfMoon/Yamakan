# P10 agent decisions

Agent decisions under founder P10 authorization. Not attributed to earlier approvals I / Track 1–2 start unless restated.

## P10-D1 — Phase boundary

- **Decision:** Treat P10 as a new engineering phase: qualification, activation, and release-candidate readiness of already-merged capabilities. Do not open new W19+ feature cards without further founder instruction.
- **Rationale:** Founder P10 directive 2026-10-21; CURRENT previously had no further W-card eligibility.
- **Date:** 2026-10-21

## P10-D2 — Serial priority

- **Decision:** When only one builder is available, execute cards in the DEPENDENCY_GRAPH tie-break order (Studio first).
- **Rationale:** Founder named Studio canvas as highest-priority product activation task; empty `imageResolver` / metadata-only uploads are known functional gaps.
- **Date:** 2026-10-21

## P10-D3 — Enablement honesty

- **Decision:** Never enable a capability flag because related unit tests pass if the named Q gate or user-visible E2E is unmet. Document binding fallbacks instead.
- **Rationale:** Frozen Q fail decisions; founder P10 §5–§10.
- **Date:** 2026-10-21

## P10-D4 — External gates

- **Decision:** Produce review/escalation packets for H1–H4; do not fabricate native Arabic review, second-account, or Profile A results.
- **Rationale:** Founder constraints; START_HERE gates.
- **Date:** 2026-10-21

## P10-D5 — Tooling truthfulness

- **Decision:** Record actual availability of D1, Alibaba OCR (local/delegate-only), PStack (playbook), Graft. Delegate-only OCR is not model-backed review. Do not send confidential code to paid inference.
- **Rationale:** Founder P10 §15 and §19; CURRENT tooling status.
- **Date:** 2026-10-21
