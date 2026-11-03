# SS-004a: deterministic three-shot revision journey

Checked 2026-11-02 (Asia/Riyadh). Base `495f76df8251d079627238d8716d45882bfa04a6`. This is a command-integration qualification slice, not a browser or hard-crash journey. It adds a test and this evidence only; no production feature, source transplant, provider or resource policy changes.

## Source-first boundary

Combine existing Yamakan `tests/story-packs.test.ts` story assembly, `tests/journey.test.ts` real-media/reopen fixtures, command registry take/history operations, and `tests/fixtures/golden.ts` decoded-frame/audio checks. Reuse the canonical SQLite project, existing job supervisor, FFmpeg and reference-preview path. No donor scheduler, alternate timeline, dependency or codec is introduced.

The product opportunity follows documented shot-scoped controls and reusable assets in [Higgsfield Cinema Studio](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-cinema-studio) and reversible agent edits in [Descript Underlord](https://descript.canny.io/changelog/release-roundupfebruary-10th-2026). Those pages were inspected, not executed. OpenFilm touched-field undo was inspected at `97bc98b9d2d9585ea917b24abc9742c68b5f0a27`; copying it is unnecessary because Yamakan already has writer-scoped undo and take proposals. This task tests their integration instead.

## Executed journey

`tests/creative-revision-journey.test.ts` creates real FFmpeg fixture files: three-second red/blue footage, a green still and timed sine audio. It imports them and verifies hashes, saves/assembles a three-shot story, adds audio and a burned caption, and scales the middle clip with the existing transform effect. The third shot is a title card.

The fixture exports H.264/AAC at 640 by 360, 30 fps, 90 frames. It checks frame count, duration, audio onset within 20 ms, exact caption boundaries, visible title glyphs, expected source colours and transform borders. Reference preview matches the decoded export. An actual scoped agent proposes/applies only the middle take; a stale revision is denied without changing the project/history, and authorization refuses one Director approval call before any run lookup. Real-run Director coverage lives in the director test suites.

The revised middle shot becomes blue while project fields stay equal and nine unrelated decoded frames match within SSIM above 0.99: 0, 5, 6, 23, 24, 29, 60, 75 and 89 are compared across the two exports, whole-frame and in the caption/title band. This is a similarity threshold, not pixel equality. A whole-frame positive control confirms the measure sees the revised frame 45. A negative control proves the old green export cannot satisfy that revised colour intent. Writer undo/redo restores the expected state and preview. Graceful database/job shutdown and reopen preserve project, story document and history. Replaying the original command after reopen returns its historical response without another edit. A third export has byte-identical sampled decoded frames to the revised export.

## Actual results

- First local run: **failed** at the title assertion. The test sampled the middle of the image, but Yamakan's documented title layout is bottom-centred. Corrected the test to count bright glyph pixels in the bottom title region rather than average a large black region. No renderer change was needed, and this failure is not described as a product regression RED.
- Corrected local Windows run: **1 passed, 0 failed, 0 skipped**, 19.756 s total test process time. This is test duration, not a performance benchmark.
- Baseline export revision 9 SHA-256: `d307c5cb1a6ce6ecc381c07d4f6fc714fb7c0b1e3c3b48860711b71d0ec89176`.
- Revised export revision 10 SHA-256: `4079d2c5a4ebdd0425b16be435978ce84d8799e0a60f90864df0d105253e2746`.
- Reopened export revision 12 had the same SHA-256 as revised. History contained 13 snapshots. Cross-run container-hash stability is not an acceptance requirement; sampled decoded equality is.
- Reopened versus revised export compares frames 0, 5, 6, 23, 24, 29, 30, 45, 59, 60, 75 and 89.
- The first-run logs `work/ss004-first.log` and `work/ss004-second.log` were cited by the original builder and could not be located during review. The failing assertion text and its observed value are therefore not recoverable; only the description above is retained.
- Typecheck, lint, changed-file formatting, provenance (404 pinned records) and brand checks passed. Formatting was corrected after the first formatting check failed; the later check passed.

## Remaining qualification

Founder handoff to Claude Opus was given 2026-11-04. Fresh independent correctness and security reviews of `5388eed` returned APPROVE with no must-fix findings. Their should-fix items are applied here: precise human-only denial, wider unrelated-frame and text-band comparison, and corrected evidence wording. Exact-head CI run 41355216482 passed on `5388eed`, but that base predates current main, so the final head needed its own delta review and CI. A delta review of `c69a588` required this evidence wording to be corrected and found the test changes correct. A final delta review approved `a4f2a88`; exact-head CI run 41740171246 and post-main CI run 41741292931 passed. Windows CI does not run this test, so the Windows result below is the only Windows evidence for it.

Requalification on current main, Windows, Opus as builder:

- Clean checkout, `npm ci --ignore-scripts` only: **failed**, `The process owner is not built`. Setup gap for SS-017.
- Native build with an owned `CARGO_TARGET_DIR` outside the repository, as the handoff directs: build passed, test **failed** with the same error, because the default owner path is inside the repository unless `YAMAKAN_PROCD` is set. Setup gap for SS-017.
- Native build in the owned checkout, merged head `0e88250`, before any hardening: **1 passed, 0 failed, 0 skipped**. Revised and baseline hashes matched those above. This run does not cover the assertions added later.
- Mutation check, denial hardening only: with `humanOnly` removed from `yamakan.director.approve`, the test **failed** with `lacks scope director:approve`, as intended, before reaching the later frame assertions. The source was restored.
- All hardened assertions, Windows, pinned runtime, the code of this commit: **1 passed, 0 failed, 0 skipped**, 14.069 s test time. Baseline and revised SHA-256 again matched those above.

SS-004b remains: integrate a forced service interruption and the same targeted-revision journey through the creator UI, including keyboard and Arabic layout. Existing TesterArmy crash/reopen/restore passed for SS-001, but that is not execution of this new journey. This slice uses the supported transform effect, not a new transition. There is no generation, recognition, native Arabic approval, broad performance qualification or public-release claim.

Rollback: remove this test/evidence; production behavior and stored projects are unaffected.
