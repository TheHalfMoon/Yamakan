# P10-02 Animation residual — CLOSED

**Checked:** 2026-10-22  
**`ANIMATION_ENABLED`:** **true** (after UI→render E2E)

## Verified

- `yamakan.clip.setAnimation` / `yamakan.clip.upsertAnimationKeyframe` → canonical `clip.animation`.
- `compilePlan` attaches animation to video layers and audio when the flag is on.
- Preview/export share `sampleScalarChannelsAtTime` (opacity + volume piecewise FFmpeg filters).
- Editor Animation panel (`data-testid="clip-animation-panel"`) drives `setClipAnimation`.
- `npm run qualify:q13` / `qualify:q14` / `qualify:animation-e2e` PASS.

## Remaining residual (documented, not a flag blocker)

- **Transform** channels (`position` / `scale` / `rotate`) may be stored on the plan but are **not** compiled into the FFmpeg filtergraph yet (opacity + volume MVP per Q13).
- Donor film-editor keyframe UI under `src/donors/film-editor/**` remains a separate surface; the gated path is the main editor Animation panel.
