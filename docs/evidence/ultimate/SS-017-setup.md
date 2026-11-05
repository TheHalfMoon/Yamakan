# SS-017: reproducible setup and evidence

Checked 2026-11-04 (Asia/Riyadh). Builder Claude Opus. Own clone from main, with its own `node_modules` and native target and task-owned logs. Windows, Node v24.19.0.

## Friction observed and corrected

Following the documented setup in a new clone exposed two real problems:

1. **`npm ci` alone is not a working setup.** The first media test failed with `The process owner is not built`. The qualifier builds the helpers itself, so the documented sequence is unchanged on that point, and `07` now says this and warns against building directly in a checkout not confirmed as your own.
2. **The documented `CARGO_TARGET_DIR` broke every media test.** The build passed, and the test failed with the same error, because the application reads helpers from `native/procd/target` unless `YAMAKAN_PROCD` and `YAMAKAN_ACL` are set. An owned checkout's default target is already owned, so the documents now say to leave it unset.

The second problem also exposed a defect in the qualifier, whose comment promises recorded hashes are "never a stale binary". With an external target it built elsewhere and hashed any older binary still in the repository.

## Change

`checkoutOwnership` in `scripts/ultimate-environment.mjs` feeds four new `BLOCKED` codes: `SHARED_NODE_MODULES`, `SHARED_NATIVE_TARGET`, `NATIVE_TARGET_REDIRECTED` and `NATIVE_HELPER_OVERRIDDEN`. Links are found at any depth by resolving real paths. With a redirected or linked target the qualifier does not build. For any other route, such as `CARGO_BUILD_TARGET_DIR` or `.cargo/config.toml`, `helpersBuiltElsewhere` compares the helper paths in cargo's own report with those that are hashed. A `node_modules/<package>` link is not detected. Existing disk, lockfile, DLL and LFS checks are unchanged. No download, dependency, limit or schema change.

## Results

Unit tests: `tests/ultimate-environment.test.ts` 19 of 19, including real junctions for shared paths and for a parent folder.

Real qualifier runs:

| Run                                           | Head      | Status                   | Detail                                                                                                                                                                                                                                                       |
| --------------------------------------------- | --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CARGO_TARGET_DIR` outside the checkout       | `6b20577` | `BLOCKED`, exit 2        | `NATIVE_HELPER_MISSING`, `NATIVE_TARGET_REDIRECTED`; no build; all scripts skipped                                                                                                                                                                           |
| `YAMAKAN_PROCD=x.exe`                         | `6b20577` | `BLOCKED`, exit 2        | `NATIVE_HELPER_OVERRIDDEN`; all scripts skipped                                                                                                                                                                                                              |
| `CARGO_BUILD_TARGET_DIR` outside the checkout | `6b20577` | `BLOCKED`, exit 2        | `NATIVE_TARGET_REDIRECTED`, from cargo's report; all scripts skipped                                                                                                                                                                                         |
| Full, first                                   | `f4b3808` | `RECORDED_WITH_FAILURES` | Typecheck and build failed on a type error in the new test, which the builder had committed without typechecking. E2E also failed, timing out at the first status message; the cause was not separately established. Test suite passed, 750 tests, 3 skipped |
| Full, second                                  | `0162825` | `RECORDED_WITH_FAILURES` | Type error fixed; typecheck, lint, format, build, provenance, brand and E2E passed. **Test suite failed: 10 failures**                                                                                                                                       |
| Full, third, nothing else running             | `0162825` | `RECORDED_WITH_FAILURES` | Same passes. **Test suite failed: 3 failures**                                                                                                                                                                                                               |

Separately, `npm test` alone at `0162825` gave 1 failure.

The full captures predate `6b20577`, which changed `scripts/`; **no capture exists at this head**, and the 10 and the first capture's test counts were read from logs later overwritten.

**Clean-checkout outcome: no full `RECORDED` pass was obtained.** All 3 failures in the third capture, and the 10 as read at the time, include launch error 2, which the access list lock in PR #161 does **not** fix or explain; `MEDIA_INVALID` appeared in the separate `npm test` run. A green capture after that lands cannot be assumed.

**This card stays open after this PR, in state `QUALIFICATION_READY`.** Still needed: a full `RECORDED` capture from a new clone at final code, launch error 2 explained or explicitly tracked, and real results or an explicit decision on these negatives:

- Insufficient disk, lockfile and invalid media runtime are existing unit tests in the same file, not run as real conditions.
- "Stale manifest" is covered here only as stale lockfile; nothing compares `environment.json` to `HEAD`.
- An unavailable reviewer or backend is not something this qualifier models.

## Later capture from a new clone

**A full `RECORDED` capture now exists, at `ee910bcdb0751c0a0d8790fb77a219715bb4d9e0` (the merge of #168).** It ran in a clone made for this run, with `npm ci --ignore-scripts` and then `npm run qualify:ultimate-environment`, from a clean tree on AC power. All eight stages passed, with no blockers, and the tests gave 764 total, 761 passed, 3 skipped and 0 failed. Launch error 2 did not appear as a failure in this run. This is one run. It replaces the statement above that no run passed, not the card's requirement that the capture be at final code: **later code needs a new capture**.

The tracked `docs/evidence/ultimate/environment.json` is this capture, reformatted by Prettier. The hashes below bind the unformatted local files.

Still open on this card then: launch error 2 stays tracked rather than explained, and the negatives listed above, since answered below.

| Local file             | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `new-environment.json` | `c978f0d4fa551906a12dc8c82ed440a09b75e50964492a5875f1d4fb6f933168` |
| `new-test.log`         | `e2e4c2c6a2c5df6a6e4bc8a9fd6c99123ce262bb68fe9fbfdd45974be7fd7c33` |
| `new-e2e.log`          | `ab2078acf5f08d562cba4ab2af5ec244cd4b806bb364fa23a8ecebba48c70e62` |

## Negatives as real conditions

Run 2026-11-05 at `32187feee193485de17a31b6894b2a16a79aedac`, in a clone made for this run with `GIT_LFS_SKIP_SMUDGE=1` and `npm ci --ignore-scripts`, running `scripts/qualify-ultimate-environment.mjs` for each. No code changed.

| Condition                                                            | Exit | Status    | Blockers                                                                           | Stages           |
| -------------------------------------------------------------------- | ---- | --------- | ---------------------------------------------------------------------------------- | ---------------- |
| Media runtime as LFS pointers, as a clone without LFS objects has it | 2    | `BLOCKED` | `FFMPEG_MISSING`, `FFPROBE_MISSING`, `MEDIA_RUNTIME_INVALID`                       | 8 skipped, 0 ran |
| Real runtime, with one DLL one byte longer                           | 2    | `BLOCKED` | The same three                                                                     | 8 skipped, 0 ran |
| `zod` at a version the lockfile does not pin                         | 2    | `BLOCKED` | `DEPENDENCY_MISSING`                                                               | 8 skipped, 0 ran |
| `zod` removed                                                        | 2    | `BLOCKED` | `DEPENDENCY_MISSING`, `FFMPEG_MISSING`, `FFPROBE_MISSING`, `MEDIA_RUNTIME_INVALID` | 8 skipped, 0 ran |

The third row is also the control for the second: with the DLL restored, its media blockers are gone. No condition gave `RECORDED` or a pass.

**Friction observed, not changed:** with `zod` removed, the capture also reports FFmpeg and FFprobe missing and the runtime invalid, though the runtime was intact. The verdict is right; the extra blockers are misleading, and why they appear was not traced.

**The remaining negatives, decided rather than run:**

- **Insufficient disk** stays a unit test. Filling a real drive on this machine to trigger it is not worth the risk to the founder's work, and a small virtual disk would need administrator rights.
- **Stale manifest:** nothing reads `environment.json` as a verdict; only the qualifier writes it. It records the head it was captured at, so a stale one cannot yield `RECORDED` for later code, because nothing takes it as such. A reader comparing it with `HEAD` must do so by hand.
- **Unavailable reviewer or backend:** the qualifier does not model these and should not. A review that did not run is recorded as not run in each receipt, as the d1 line below does.

This is a founder's call to overrule. **The card stays open** for a `RECORDED` capture at final code, and launch error 2, tracked and not explained.

| Local file                | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `lfs-pointers.json`       | `99c40ff0e331400ffa440631ab9403ae5ba81a959260b0b6cb90cf778ad2dc73` |
| `tampered-dll.json`       | `ce1a0669f2fd58fc3f103f233ecbb2a025b95258cfb72ec5b3bae9246598c70d` |
| `drifted-dependency.json` | `560be454fe1fb22aea920070c3e55f5c75b0252802d290f4d23c42528f2dfc6a` |
| `missing-dependency.json` | `c43176520699449237f3be76d81167927dfd293fed9266496629b7caeca6e4c6` |

## Impact tools

- Graft, deterministic build only: 694 of 694 files parsed, into a task-owned folder. `graft ask` located `checkoutOwnership` in `scripts/ultimate-environment.mjs`. Structural evidence only.
- OCR: `ocr review --preview` only, listing the changed files. No AI review ran.
- D1: not used for this change.

## Local receipts

Raw logs stay local; SHA-256 binds these files. The capture JSONs record script exit codes, not failure counts. The qualifier overwrites the tracked `docs/evidence/ultimate/environment.json`, so each capture was copied out and the tracked file restored; it is not updated here because no run passed.

| File                                      | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| First full capture                        | `b380d2bd42d62d836e77db4fcba46618a00a43be22811409dfeb7a04610f0418` |
| Second full capture                       | `23fe340e2c72c825797d8ec399ea807856a008731131657871cf6632436d80c0` |
| Third full capture                        | `f1d68a0f2a4c39a7a635517b267667c7bf4684950f2d028bd7398938a6ba36d0` |
| Separate `npm test` log                   | `fa77d305556cd6a6b2f905d049435c09a8f401cce2d8bf7ca299e7d4525311b2` |
| Third capture's test log                  | `f8a9c19c1137fdbcb0d1c023a9052977be0655b6c4621f9981de3af40ec263f7` |
| Blocked capture, `CARGO_TARGET_DIR`       | `4e0f2453613c4b1f427d4803eb9e3d3de93ddffa342151ac96d0ebe7b23fa9a2` |
| Blocked capture, `YAMAKAN_PROCD`          | `04c9aa2ce37e4cebd125183eb5d68bb1a5cb130ac240e970dc1b78b1fef764e4` |
| Blocked capture, `CARGO_BUILD_TARGET_DIR` | `dabd810fdb39afd1c0834b7ffc5a1e9b83e1355f89010e62b092d5a23dd153f4` |

Rollback: revert the diagnostics and documents. No shared path was cleaned and no historical evidence removed.
