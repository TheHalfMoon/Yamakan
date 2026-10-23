# Product UX blueprint

Design recommendation (**ENGINEERING INFERENCE**), not a tested usability result or visual clone. Evidence patterns: [Cuty](03_CUTY_DEEP_REA.md) focused task forms, [Higgsfield](04_HIGGSFIELD_DEEP_REA.md) cinematic intent controls, [Runway](05_RUNWAY_DEEP_REA.md) creative iteration, [professional editors](07_PROFESSIONAL_EDITORS_REA.md) precise finishing. The application remains Yamakan throughout; donor notices live in About/attribution and distribution records.

## Information architecture

Projects home shows recent work, last committed revision, missing-media/recovery indicators and open/import actions. Inside a project, three primary workspaces share one asset library, selection, revision stream and job tray:

- **Story:** brief, script, scene/shot cards, references, alternate takes and continuity notes. Director is the assistant panel here. Cinema camera controls are shot-inspector fields with a 3D previs view when relevant.
- **Edit:** media/source viewer, reference/program viewer, timeline, contextual inspector. Studio opens an image/mask/drawing document in a focused panel, then returns to the same shot/clip selection.
- **Finish:** captions, audio/loudness, output profile, variant/batch queue, preflight and artifact receipts. Advanced color/compositing controls appear only after their render parity qualifies.

Flow is an optional progress/dependency view of the same jobs. Quality Lab is a comparison mode reached from takes or the finish panel. Smart Router is a capability/cost explanation inside a requested operation. Avoid seven unrelated home screens, multiple project pickers or a graph editor as the required starting surface.

## Six complete journeys

| Journey | Interaction sequence | Persistent result | Failure/recovery state | Acceptance |
|---|---|---|---|---|
| Idea to film | New project → brief → manually editable shot cards → choose refs → approved generation/import → attach takes → Edit → Finish | Story and take refs bound to canonical revision | Unavailable generation offers import/manual storyboard; no fake clip | Reopen all cards/refs, replace one shot without altering others |
| Footage to export | Import → indexed bins → source in/out → insert → ripple/trim → sound/captions → reference preview → export | Typed edit receipts and immutable artifact | Missing/invalid media stays visible; repair by verified source | Keyboard-only edit, stale revision conflict preserved, export matches preview |
| Consistent sequence | Character pack → consent/ref hashes → shot links → compare takes → approve take | Versioned pack links, independent consent ledger | Revocation blocks new uses and flags affected jobs | No claim of identity fidelity without category F evidence |
| Agent commercial | Brief → proposed bounded edit list → human inspection → approve exact proposal → jobs → review → export | Proposal hash, revision, attempt/output lineage | Interrupted run resumes without duplicate attachment/billing | Replaying approval cannot authorize modified plan |
| Arabic/English production | Language choice → captions/transcript import → mixed text edit → preview → subtitle/export | Language and caption timing, text remains unmodified | Missing font or shaping gate gives actionable preflight | H1 native review plus mixed bidi/punctuation fixtures |
| Repair footage | Select clip → capability-specific enhancement/transcription → compare → keep source/accept derivative | Original plus provenance-linked derivative | OOM/unsupported/absent weights leave original usable | Cancel/restart never replaces source with partial output |

## Interaction and visual system

Use neutral charcoal workspace surfaces, quiet separators, one restrained Yamakan accent, clear selected/focused/error states and content-led density. Exact tokens should be extracted from existing `src/style.css` and editor CSS, consolidated before new styling; no speculative brand overhaul blocks persistence. One spacing scale, typography scale, button hierarchy and icon vocabulary. Persistent job badges state queued/running/needs review/failed; animation never implies completion. Disabled tools explain the exact capability gap in plain language.

Timeline: visible timecode with rational-rate policy, source/program monitors, scalable tracks, selection/trim/ripple modes, audio linkage, snap toggle, keyboard command palette and explicit lock/mute/solo. Dragging updates an ephemeral preview; release commits once. Undo/redo labels identify the operation; another writer's edit cannot disappear. Selection survives panel switching; Inspector reflects the selected shot/clip/document rather than a different local project.

Cinematic inspector: show intent (lens/light/motion) separately from **applied controls** supported by the chosen model recipe. Never silently turn unsupported pose/depth/keyframe controls into prompt text. Show reference purpose and exact first/last-frame support; when switching models, preview retained/dropped settings and require explicit acceptance before submission.

Generation/take cards show input version, model version, elapsed time, estimated/actual cost when applicable, output dimensions/audio and last failure. Retry creates an attempt. Replace take proposes a timeline operation with exact affected clips; it cannot rewrite a finished sequence automatically. Advanced settings remain discoverable but collapsed until needed.

## Accessibility and localization

Use semantic landmarks, named controls, visible keyboard focus, tab order, screen-reader labels, reduced motion, 200% zoom, contrast checks and no color-only status. Keyboard shortcuts must avoid destructive actions while typing text. Mirror navigation for Arabic; keep time progression and timecode behavior explicit and test with editors rather than mechanically reversing all timeline semantics. Isolate inserted filenames/numbers with bidi-safe presentation; never rewrite stored user text. Native Arabic H1 remains open, independent of automated RTL screenshots.

## UX qualification

Start with a formative 5–8 participant study across novice creators, experienced editors and native Arabic speakers; it finds problems and does not establish statistical superiority. Record task completion, recoveries, wrong actions and observed confusion on consented sessions. Later run counterbalanced matched workflows with sample size derived from pilot variance. Targets: complete the six journeys without data loss, accessible failure states, and no unsupported capability advertised. Time advantages require actual comparative evidence. Retain the founder's current visual work unless a measured usability issue warrants change.
