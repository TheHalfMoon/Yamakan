# SS-017: reproducible setup and evidence

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Own clone from main, with its own `node_modules` and native target and task-owned logs. Windows, Node v24.19.0.

## Friction observed and corrected

Following the documented setup in a new clone exposed two real problems:

1. **`npm ci` alone is not a working setup.** The first media test failed with `The process owner is not built`. The sequence in `07` and the handoff did not include `npm run build:native` before qualification; it now does.
2. **The documented `CARGO_TARGET_DIR` broke every media test.** The build passed, and the test failed with the same error, because the application reads helpers from `native/procd/target` unless `YAMAKAN_PROCD` and `YAMAKAN_ACL` are set. An owned checkout's default target is already owned, so the documents now say to leave it unset.

The second problem also exposed a defect in the qualifier, whose comment promises recorded hashes are "never a stale binary". With an external target it built elsewhere and hashed any older binary still in the repository.

## Change

`checkoutOwnership` in `scripts/ultimate-environment.mjs` feeds four new `BLOCKED` codes: `SHARED_NODE_MODULES`, `SHARED_NATIVE_TARGET`, `NATIVE_TARGET_REDIRECTED` and `NATIVE_HELPER_OVERRIDDEN`. With a redirected target the qualifier no longer builds. Existing disk, lockfile, DLL and LFS checks are unchanged. No download, dependency, limit or schema change.

## Results

Unit tests: `tests/ultimate-environment.test.ts` 18 of 18, including real junctions for shared paths.

Real qualifier runs:

| Run                                     | Head                        | Status                   | Detail                                                                                                                                                                                                                                                       |
| --------------------------------------- | --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CARGO_TARGET_DIR` outside the checkout | `f4b3808` plus working tree | `BLOCKED`, exit 2        | `NATIVE_HELPER_MISSING`, `NATIVE_TARGET_REDIRECTED`; all scripts skipped                                                                                                                                                                                     |
| `YAMAKAN_PROCD` set                     | `f4b3808` plus working tree | `BLOCKED`, exit 2        | `NATIVE_HELPER_OVERRIDDEN`; all scripts skipped                                                                                                                                                                                                              |
| Full, first                             | `f4b3808`                   | `RECORDED_WITH_FAILURES` | Typecheck and build failed on a type error in the new test, which the builder had committed without typechecking. E2E also failed, timing out at the first status message; the cause was not separately established. Test suite passed, 750 tests, 3 skipped |
| Full, second                            | `0162825`                   | `RECORDED_WITH_FAILURES` | Type error fixed; typecheck, lint, format, build, provenance, brand and E2E passed. **Test suite failed: 10 failures**                                                                                                                                       |
| Full, third, nothing else running       | `0162825`                   | `RECORDED_WITH_FAILURES` | Same passes. **Test suite failed: 3 failures**                                                                                                                                                                                                               |

Separately, `npm test` alone at `0162825` gave 1 failure.

**Clean-checkout outcome: no full `RECORDED` pass was obtained, and this card's blocker is recorded rather than cleared.** The failures were Windows worker launch and media errors, and analysis found a real race: see `SS-017-access-lock.md`. With that fix on main, a full qualifier run is still required to claim a clean capture. Launch error 2 remains unexplained.

The negative cases for insufficient disk, stale lockfile and invalid media runtime are existing unit tests in the same file, not rerun as real conditions. An unavailable reviewer or backend is process policy, not something this qualifier models; review-account limits remain handled by retaining the block.

## Impact tools

- Graft, deterministic build only: 694 of 694 files parsed, into a task-owned folder. `graft ask` located `checkoutOwnership` in `scripts/ultimate-environment.mjs`. Structural evidence only.
- OCR: `ocr review --preview` only, listing the changed files. No AI review ran.
- D1: not used for this change.

## Local receipts

Raw logs stay local; SHA-256 binds them. The qualifier overwrites the tracked `docs/evidence/ultimate/environment.json`, so each capture was copied out and the tracked file restored; it is not updated here because no run passed.

| File                    | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| First full capture      | `b380d2bd42d62d836e77db4fcba46618a00a43be22811409dfeb7a04610f0418` |
| Second full capture     | `23fe340e2c72c825797d8ec399ea807856a008731131657871cf6632436d80c0` |
| Third full capture      | `f1d68a0f2a4c39a7a635517b267667c7bf4684950f2d028bd7398938a6ba36d0` |
| Separate `npm test` log | `fa77d305556cd6a6b2f905d049435c09a8f401cce2d8bf7ca299e7d4525311b2` |

Rollback: revert the diagnostics and documents. No shared path was cleaned and no historical evidence removed.
