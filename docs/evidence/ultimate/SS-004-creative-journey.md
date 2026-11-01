# SS-004a: deterministic three-shot revision journey

Checked 2026-11-02 (Asia/Riyadh). Base `495f76df8251d079627238d8716d45882bfa04a6`. This is a command-integration qualification slice, not a browser or hard-crash journey. It adds a test and this evidence only; no production feature, source transplant, provider or resource policy changes.

## Source-first boundary

Combine existing Yamakan `tests/story-packs.test.ts` story assembly, `tests/journey.test.ts` real-media/reopen fixtures, command registry take/history operations, and `tests/fixtures/golden.ts` decoded-frame/audio checks. Reuse the canonical SQLite project, existing job supervisor, FFmpeg and reference-preview path. No donor scheduler, alternate timeline, dependency or codec is introduced.

The product opportunity follows documented shot-scoped controls and reusable assets in [Higgsfield Cinema Studio](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-cinema-studio) and reversible agent edits in [Descript Underlord](https://descript.canny.io/changelog/release-roundupfebruary-10th-2026). Those pages were inspected, not executed. OpenFilm touched-field undo was inspected at `97bc98b9d2d9585ea917b24abc9742c68b5f0a27`; copying it is unnecessary because Yamakan already has writer-scoped undo and take proposals. This task tests their integration instead.

## Executed journey

`tests/creative-revision-journey.test.ts` creates real FFmpeg fixture files: three-second red/blue footage, a green still and timed sine audio. It imports them and verifies hashes, saves/assembles a three-shot story, adds audio and a burned caption, and scales the middle clip with the existing transform effect. The third shot is a title card.

The fixture exports H.264/AAC at 640 by 360, 30 fps, 90 frames. It checks frame count, duration, audio onset within 20 ms, exact caption boundaries, visible title glyphs, expected source colours and transform borders. Reference preview matches the decoded export. An actual scoped agent proposes/applies only the middle take; stale revision and human-approval operations are denied without changing the project/history.

The revised middle shot becomes blue while unrelated decoded frames and project fields remain unchanged. A negative control proves the old green export cannot satisfy that revised colour intent. Writer undo/redo restores the expected state and preview. Graceful database/job shutdown and reopen preserve project, story document and history. Replaying the original command after reopen returns its historical response without another edit. A third export has byte-identical sampled decoded frames to the revised export.

## Actual results

- First local run: **failed** at the title assertion. The test sampled the middle of the image, but Yamakan's documented title layout is bottom-centred. Corrected the test to count bright glyph pixels in the bottom title region rather than average a large black region. No renderer change was needed, and this failure is not described as a product regression RED.
- Corrected local Windows run: **1 passed, 0 failed, 0 skipped**, 19.756 s total test process time. This is test duration, not a performance benchmark.
- Baseline export revision 9 SHA-256: `d307c5cb1a6ce6ecc381c07d4f6fc714fb7c0b1e3c3b48860711b71d0ec89176`.
- Revised export revision 10 SHA-256: `4079d2c5a4ebdd0425b16be435978ce84d8799e0a60f90864df0d105253e2746`.
- Reopened export revision 12 had the same SHA-256 as revised. History contained 13 snapshots. Cross-run container-hash stability is not an acceptance requirement; sampled decoded equality is.
- Compared frames: 0, 5, 6, 23, 24, 29, 30, 45, 59, 60, 75 and 89.
- Local logs: `work/ss004-first.log` (failed assertion) and `work/ss004-second.log` (pass). Raw captures remain local.
- Typecheck, lint, changed-file formatting, provenance (404 pinned records) and brand checks passed. Formatting was corrected after the first formatting check failed; the later check passed.

## Remaining qualification

Independent review is pending: the review-agent service reported the account usage limit. Do not substitute D1 or self-review for the required fresh review, and do not merge on these local results alone. Exact-head CI must pass before normal pinned-head merge and post-main verification.

SS-004b remains: integrate a forced service interruption and the same targeted-revision journey through the creator UI, including keyboard and Arabic layout. Existing TesterArmy crash/reopen/restore passed for SS-001, but that is not execution of this new journey. This slice uses the supported transform effect, not a new transition. There is no generation, recognition, native Arabic approval, broad performance qualification or public-release claim.

Rollback: remove this test/evidence; production behavior and stored projects are unaffected.
