# Yamakan Windows FFmpeg pin (R8 / Q3)

Redistributable Windows x86_64 FFmpeg **7.1.1** whose **libass 0.17.3** is built
with **fontconfig enabled and DirectWrite disabled**, so title fonts can be
confined through `FONTCONFIG_FILE` (Q3).

## Build

```text
scripts/vendor/build-ffmpeg-win64-r8-msys2.sh
```

Free toolchain only (MSYS2 mingw64). Custom libass; other libraries come from
MSYS2 mingw64 packages at build time and are vendored as companion DLLs here.

## Verify

```text
ffmpeg.exe -hide_banner -loglevel debug -f lavfi -i color=c=black:s=640x360:d=1 -vf ass=t.ass -frames:v 1 -f null -
```

Expect: `Using font provider fontconfig` (not DirectWrite).

## Hashes

See `SHA256SUMS` and `BUILD.json`. Companion DLLs must sit beside `ffmpeg.exe`
and `ffprobe.exe` (Windows loads them from the executable directory).

## Licenses

FFmpeg is GPL-3.0-or-later in this build (`--enable-gpl --enable-version3`).
See `NOTICE` and `notices/ffmpeg-win64-r8-NOTICE.txt` in the repository root.
