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

# The newest 7.1 release when this was built: it carries the security fixes 7.1.1 lacks, and
# those of the point releases since. See the security checkpoint in the ledger.
FFMPEG_VERSION=7.1.5
# Pinned after checking: FFmpeg's tarball against its release key below; libass's against its
# release's own signature, made by Oneric's key 5EE63F2A71BF132CFE3567E1DFFE615F2824C720.
FFMPEG_SHA256=de668509caf9e35e3cd162473441fdb29538c6d96ed080292b3cf9e6fc5d558f
LIBASS_SHA256=eae425da50f0015c21f7b3a9c7262a910f0218af469e22e2931462fed3c50959

fetch() {
  local url="$1" dest="$2"
  [[ -f "$dest" ]] && return 0
  log "fetch $url"
  curl -fsSL --retry 3 -o "$dest" "$url"
}

# A source is used only if its hash is the one pinned here; a pin of "" refuses it after
# printing the hash it has, so a new version is pinned on purpose, never taken as it comes.
pinned() {
  local file="$1" want="$2" have
  have="$(sha256sum "$file" | awk '{print $1}')"
  if [[ "$have" != "$want" ]]; then
    log "ERROR: $file has sha256 $have, not the pinned ${want:-(none)}"
    exit 1
  fi
}

# FFmpeg's release signing key, by fingerprint: a tarball is used only if this key signed it.
FFMPEG_RELEASE_KEY=FCF986EA15E6E293A5644F10B4322F04D67658D8
signed_by_ffmpeg() {
  local file="$1" home
  home="$(mktemp -d)"
  fetch "https://ffmpeg.org/ffmpeg-devel.asc" "$SRC/ffmpeg-devel.asc"
  fetch "${2}.asc" "$file.asc"
  local status=""
  # Read whole before it is looked at: a pipe could close on gpg early. A revoked or expired
  # key, or one past its validity, is not accepted even with a good signature.
  if gpg --homedir "$home" --batch --quiet --import "$SRC/ffmpeg-devel.asc"; then
    status="$(gpg --homedir "$home" --batch --status-fd 1 --verify "$file.asc" "$file" 2>/dev/null || true)"
  fi
  rm -rf "$home"
  if ! grep -q "^\[GNUPG:\] VALIDSIG .* $FFMPEG_RELEASE_KEY\$" <<<"$status" ||
    grep -qE "^\[GNUPG:\] (REVKEYSIG|EXPKEYSIG|EXPSIG|BADSIG|ERRSIG)" <<<"$status"; then
    log "ERROR: $file is not signed by FFmpeg's release key $FFMPEG_RELEASE_KEY"
    exit 1
  fi
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
  # Built before only counts if from the source pinned now; otherwise it is built again.
  if [[ -f "$stamp" && -f "$PREFIX/lib/libass.a" ]] &&
    grep -qx "source=$LIBASS_SHA256" "$stamp"; then
    return 0
  fi
  mkdir -p "$SRC" "$PREFIX"
  fetch "https://github.com/libass/libass/releases/download/$v/libass-$v.tar.xz" "$SRC/libass-$v.tar.xz"
  pinned "$SRC/libass-$v.tar.xz" "$LIBASS_SHA256"
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
  printf 'directwrite=disabled\nfontconfig=enabled\nlibass=%s\nsource=%s\n' "$v" "$LIBASS_SHA256" >"$stamp"
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
  local v="$FFMPEG_VERSION"
  local d="$SRC/ffmpeg-$v"
  fetch "https://ffmpeg.org/releases/ffmpeg-$v.tar.xz" "$SRC/ffmpeg-$v.tar.xz"
  signed_by_ffmpeg "$SRC/ffmpeg-$v.tar.xz" "https://ffmpeg.org/releases/ffmpeg-$v.tar.xz"
  pinned "$SRC/ffmpeg-$v.tar.xz" "$FFMPEG_SHA256"
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
  # Only this build's files: what an earlier one left would be hashed in and allowed.
  rm -rf "$DIST"
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
  {
    printf '{\n  "receipt": "yamakan.ffmpeg-win64-r8/3",\n'
    printf '  "purpose": "Q3/R8: libass fontconfig provider, DirectWrite disabled; libx265 for qualification fixtures",\n'
    printf '  "ffmpegVersion": "%s",\n  "libassVersion": "0.17.3",\n  "host": "msys2-mingw64",\n' "$FFMPEG_VERSION"
    printf '  "libass": { "directwrite": "disabled", "fontconfig": "enabled" },\n'
    printf '  "sources": { "ffmpeg": { "sha256": "%s", "signedBy": "%s" }, "libass": { "sha256": "%s" } },\n' "$FFMPEG_SHA256" "$FFMPEG_RELEASE_KEY" "$LIBASS_SHA256"
    printf '  "configureNotes": "Built via scripts/vendor/build-ffmpeg-win64-r8-msys2.sh with --enable-libx265.",\n'
    printf '  "ffmpegSha256": "%s",\n  "ffprobeSha256": "%s",\n' "$ffhash" "$fphash"
    # This machine's MSYS2 packages when it was built, for the record: they are not installed
    # or held to these versions by this script, so this is not a lock.
    printf '  "packagesAtBuild": [\n'
    pacman -Q | sed 's/.*/    "&"/' | paste -sd, - | sed 's/,/,\n/g'
    printf '\n  ],\n  "binaries": {\n'
    (cd "$DIST" && for f in *.exe *.dll; do
      printf '    "%s": { "sha256": "%s", "bytes": %s }\n' "$f" "$(sha256sum "$f" | awk '{print $1}')" "$(stat -c %s "$f")"
    done) | paste -sd, - | sed 's/,    /,\n    /g'
    printf '  }\n}\n'
  } >"$DIST/BUILD.json"
  (cd "$DIST" && ls *.dll | sort >companions.txt)
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
