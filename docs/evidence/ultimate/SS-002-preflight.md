# SS-002: selected Windows media runtime preflight

Scope: development environment evidence on base `ad5b12b`. This change does not
qualify media execution, the worker sandbox, installed bundles, or release readiness.

## Source-first decision

ADAPT `core/process/workers.ts:mediaTools()` directly for selection and Windows EXE
hard pins. This preserves modern and legacy overrides, installed bundle selection,
vendor fallback, and PATH fallback without a second precedence implementation.
Load it lazily so dependency/resolution failures become BLOCKED evidence.

ADAPT the `scripts/bundle.ts:copyPinnedCompanions()` contract: `companions.txt`
allowlists DLLs and `SHA256SUMS` supplies their hashes. The new read-only helper
validates these manifests and checks actual selected EXE/DLL bytes. Production
preflight always takes metadata from this checkout's `vendor/ffmpeg-win64-r8`;
installed directories need no metadata copies and cannot redefine the pins.
Renamed selected executables retain the canonical EXE hash names. No production
resolver, sandbox, process policy, dependency, or binary changed.

## Acceptance and evidence

- Matching file hashes permit version probing at the selected paths. Both selected
  directories are checked if the tools come from different directories.
- Missing, corrupt, or Git LFS pointer companions block before any version probe
  or required test script. Missing/invalid metadata, duplicate/unsafe names and
  missing hashes also block; manifest names cannot traverse directories.
- `MEDIA_RUNTIME_INVALID` remains BLOCKED even if tool versions and every required
  script claim success. The file-level evidence is retained in the environment.
- Linux selection uses the production resolver without Windows manifest checks.
- Version probes have a 10-second timeout. The complete qualification script was
  not executed in this bounded change.

Command: `node --test tests/media-runtime-preflight.test.mjs tests/ultimate-environment.test.ts`
(through `rtk proxy`, with TEMP/TMP under this worktree's `work/`).

| Run                             | Result                                                                                        | Local evidence                  |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| Initial RED                     | 15 passed, 2 failed: missing new helper module and invalid runtime incorrectly RECORDED       | `work/ss-002-red.log`           |
| Installed-layout regression RED | 30 passed, 2 failed: metadata outside selected runtime rejected, with and without EXE aliases | `work/ss-002-installed-red.log` |
| Final GREEN                     | 32 passed, 0 failed, 0 skipped                                                                | `work/ss-002-green.log`         |

The positive fixtures use inert text files and known hashes, not FFmpeg execution.
Production resolver tests prove modern/legacy override and bundle selection by
observing the expected hard-pin rejection of inert EXEs. These do not claim that
the fixtures are usable runtimes. An intermediate run could not import `zod`
because the existing dependency junction target disappeared; after repointing only
the local junction to the parent's completed installation, the installed-layout
RED above was reproduced. This dependency failure is not counted as a test RED.

Changed-file Prettier `--check` and oxlint `--deny-warnings` both exited 0
(`work/ss-002-format.log`, `work/ss-002-lint.log`); `git diff --check` passed. Full suite,
typecheck, build, native/FFmpeg/browser execution, and independent review remain
the parent task's gates; none is claimed here.
