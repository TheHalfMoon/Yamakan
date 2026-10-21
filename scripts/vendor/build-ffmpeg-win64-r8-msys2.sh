#!/usr/bin/env bash
# MSYS2 mingw64: rebuild libass with DirectWrite disabled + FFmpeg linked to it.
# Reuses free MSYS2 packages for zlib/expat/freetype/fontconfig/fribidi/harfbuzz/x264/lame/opus.
# Output: dist/ffmpeg-win64-r8/{ffmpeg,ffprobe}.exe + SHA256SUMS + BUILD.json
set -euo pipefail

# Must run under mingw64 (PATH starts with /mingw64/bin).
case "$(gcc -dumpmachine 2>/dev/null || true)" in
  x86_64-w64-mingw32) ;;
  *)
    echo "Run inside MSYS2 mingw64 (gcc -dumpmachine must be x86_64-w64-mingw32)" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="${YAMAKAN_R8_BUILD:-$HOME/yamakan-r8-ffmpeg-msys2}"
PREFIX="$BUILD/prefix"
SRC="$BUILD/src"
DIST="$ROOT/dist/ffmpeg-win64-r8"
JOBS="${YAMAKAN_R8_JOBS:-$(nproc)}"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:/mingw64/lib/pkgconfig"
export PATH="$PREFIX/bin:/mingw64/bin:$PATH"

log() { printf '[r8-ffmpeg-msys2] %s\n' "$*"; }

fetch() {
  local url="$1" dest="$2"
  [[ -f "$dest" ]] && return 0
  log "fetch $url"
  curl -fsSL --retry 3 -o "$dest" "$url"
}

untar() {
  local archive="$1" dir="$2"
  mkdir -p "$dir"
  tar -xf "$archive" -C "$dir" --strip-components=1
}

build_libass() {
  local v=0.17.3
  local d="$SRC/libass-$v"
  local stamp="$PREFIX/lib/libass-r8.stamp"
  [[ -f "$stamp" && -f "$PREFIX/lib/libass.a" ]] && return 0
  mkdir -p "$SRC" "$PREFIX"
  fetch "https://github.com/libass/libass/releases/download/$v/libass-$v.tar.xz" "$SRC/libass-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/libass-$v.tar.xz" "$d"
  (
    cd "$d"
    # Critical: DirectWrite OFF, fontconfig ON — Q3 / R8 requirement.
    rm -rf build
    meson setup build --prefix="$PREFIX" --libdir=lib --default-library=static \
      -Ddirectwrite=disabled -Dfontconfig=enabled -Dtest=false -Dprofile=false \
      -Dlibunibreak=disabled
    ninja -C build
    ninja -C build install
  )
  # Prefer our static libass over any mingw shared package.
  printf 'directwrite=disabled\nfontconfig=enabled\nlibass=%s\n' "$v" >"$stamp"
  log "libass meson summary:"
  grep -E 'directwrite|fontconfig|Feature' "$d/build/meson-info/intro-features.json" 2>/dev/null || true
  # Confirm DirectWrite was not enabled in the build options.
  if grep -qi 'directwrite.*enabled\|CONFIG_DIRECTWRITE' "$d/build/config.h" 2>/dev/null; then
    if grep -E 'define CONFIG_DIRECTWRITE[[:space:]]+1' "$d/build/config.h"; then
      log "ERROR: DirectWrite still enabled in libass config.h"
      exit 1
    fi
  fi
}

build_ffmpeg() {
  local v=7.1.1
  local d="$SRC/ffmpeg-$v"
  fetch "https://ffmpeg.org/releases/ffmpeg-$v.tar.xz" "$SRC/ffmpeg-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/ffmpeg-$v.tar.xz" "$d"
  (
    cd "$d"
    # Force our prefix libass ahead of system.
    export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:/mingw64/lib/pkgconfig"
    ./configure \
      --prefix="$PREFIX" \
      --arch=x86_64 \
      --target-os=mingw32 \
      --pkg-config=pkg-config \
      --pkg-config-flags=--static \
      --extra-cflags="-I$PREFIX/include" \
      --extra-ldflags="-L$PREFIX/lib" \
      --extra-libs="-lfontconfig -lfreetype -lharfbuzz -lfribidi -lexpat -lpng -lz -lbz2 -lx265 -lstdc++ -lwinpthread -lws2_32 -lgdi32 -lole32 -luser32 -lbcrypt -lstrmiids -lrpcrt4" \
      --enable-gpl --enable-version3 \
      --enable-static --disable-shared \
      --disable-doc --disable-ffplay --disable-debug \
      --enable-libass --enable-libfreetype --enable-fontconfig \
      --enable-libfribidi --enable-libharfbuzz \
      --enable-libx264 --enable-libx265 --enable-libmp3lame --enable-libopus \
      --enable-zlib \
      --disable-autodetect \
      --enable-ffmpeg --enable-ffprobe
    make -j"$JOBS"
    make install
  )
}

package_dist() {
  mkdir -p "$DIST"
  cp -f "$PREFIX/bin/ffmpeg.exe" "$DIST/ffmpeg.exe"
  cp -f "$PREFIX/bin/ffprobe.exe" "$DIST/ffprobe.exe"
  # Vendor every mingw64 DLL the binaries need (AppContainer loads from exe dir).
  {
    ldd "$DIST/ffmpeg.exe"
    ldd "$DIST/ffprobe.exe"
  } | awk '/=> \/mingw64\/bin\// {print $3}' | sort -u | while read -r p; do
    cp -f "$p" "$DIST/"
  done
  for dll in libgcc_s_seh-1.dll libstdc++-6.dll libwinpthread-1.dll; do
    [[ -f "/mingw64/bin/$dll" ]] && cp -f "/mingw64/bin/$dll" "$DIST/"
  done
  (
    cd "$DIST"
    sha256sum *.exe *.dll | sort -k2 >SHA256SUMS
  )
  local ffhash fphash
  ffhash="$(awk '/ffmpeg.exe/{print $1}' "$DIST/SHA256SUMS")"
  fphash="$(awk '/ffprobe.exe/{print $1}' "$DIST/SHA256SUMS")"
  cat >"$DIST/BUILD.json" <<EOF
{
  "receipt": "yamakan.ffmpeg-win64-r8/1",
  "purpose": "Q3/R8: libass fontconfig provider, DirectWrite disabled",
  "ffmpegVersion": "7.1.1",
  "libassVersion": "0.17.3",
  "host": "msys2-mingw64",
  "libass": { "directwrite": "disabled", "fontconfig": "enabled" },
  "configureNotes": "Built via scripts/vendor/build-ffmpeg-win64-r8-msys2.sh. Free MSYS2 mingw64 toolchain; custom libass only.",
  "ffmpegSha256": "$ffhash",
  "ffprobeSha256": "$fphash"
}
EOF
  log "Artifacts in $DIST"
  cat "$DIST/BUILD.json"
}

probe_provider() {
  log "Probing font provider (expect fontconfig, not directwrite)…"
  local tmp
  tmp="$(mktemp -d)"
  cat >"$tmp/t.ass" <<'ASS'
[Script Info]
ScriptType: v4.00+
PlayResX: 640
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,Hello
ASS
  local logf="$tmp/ffmpeg.log"
  set +e
  "$DIST/ffmpeg.exe" -hide_banner -loglevel debug -f lavfi -i color=c=black:s=640x360:d=1 \
    -vf "ass=$tmp/t.ass" -frames:v 1 -f null - >"$logf" 2>&1
  set -e
  if grep -qi 'font provider directwrite' "$logf"; then
    log "ERROR: runtime still uses DirectWrite"
    grep -i 'font provider' "$logf" || true
    exit 1
  fi
  if ! grep -qi 'font provider fontconfig\|Using font provider fontconfig\|fontconfig' "$logf"; then
    log "WARN: could not confirm fontconfig provider string; dumping provider lines:"
    grep -i 'font provider\|fontselect\|fontconfig\|directwrite' "$logf" | head -40 || true
  else
    grep -i 'font provider' "$logf" | head -5 || true
    log "Provider probe OK"
  fi
  rm -rf "$tmp"
}

main() {
  log "gcc=$(gcc -dumpmachine) $(gcc --version | head -1)"
  command -v meson >/dev/null
  command -v ninja >/dev/null
  command -v pkg-config >/dev/null
  pkg-config --exists fontconfig freetype2 fribidi harfbuzz opus || {
    log "missing mingw64 pkg-config deps (fontconfig/freetype2/fribidi/harfbuzz/opus)"
    exit 1
  }
  pkg-config --exists x264 || pkg-config --exists libx264 || {
    log "missing x264/libx264 pkg-config"
    exit 1
  }
  # lame.pc may be named differently
  pkg-config --exists lame || pkg-config --exists libmp3lame || log "WARN: lame pc missing; configure may still find -lmp3lame"
  mkdir -p "$SRC" "$PREFIX"
  build_libass
  build_ffmpeg
  package_dist
  probe_provider
  log "Done."
}

main "$@"
