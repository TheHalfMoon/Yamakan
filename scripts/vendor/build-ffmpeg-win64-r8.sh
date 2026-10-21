#!/usr/bin/env bash
# Cross-build a Windows x86_64 FFmpeg whose libass uses fontconfig and NOT
# DirectWrite, so Q3 / R8 font confinement can pass. Free toolchain only
# (apt mingw-w64). Output: dist/ffmpeg-win64-r8/{ffmpeg,ffprobe}.exe + SHA256SUMS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="${YAMAKAN_R8_BUILD:-$HOME/yamakan-r8-ffmpeg-build}"
PREFIX="$BUILD/prefix"
SRC="$BUILD/src"
DIST="$ROOT/dist/ffmpeg-win64-r8"
JOBS="${YAMAKAN_R8_JOBS:-$(nproc)}"
HOST=x86_64-w64-mingw32
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
export PATH="$PREFIX/bin:$PATH"

log() { printf '[r8-ffmpeg] %s\n' "$*"; }

need_pkgs() {
  local pkgs=(
    build-essential git curl ca-certificates pkg-config
    meson ninja-build nasm yasm python3
    mingw-w64 mingw-w64-tools
    autoconf automake libtool gperf gettext
  )
  log "Installing build packages (sudo)…"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${pkgs[@]}"
}

fetch() {
  local url="$1" dest="$2"
  if [[ -f "$dest" ]]; then return 0; fi
  curl -fsSL --retry 3 -o "$dest" "$url"
}

untar() {
  local archive="$1" dir="$2"
  mkdir -p "$dir"
  tar -xf "$archive" -C "$dir" --strip-components=1
}

build_zlib() {
  local v=1.3.1
  local d="$SRC/zlib-$v"
  [[ -f "$PREFIX/lib/libz.a" ]] && return 0
  mkdir -p "$SRC"
  fetch "https://zlib.net/fossils/zlib-$v.tar.gz" "$SRC/zlib-$v.tar.gz"
  rm -rf "$d" && untar "$SRC/zlib-$v.tar.gz" "$d"
  (
    cd "$d"
    CHOST=$HOST ./configure --static --prefix="$PREFIX"
    make -j"$JOBS"
    make install
  )
}

build_expat() {
  local v=2.6.4
  local d="$SRC/expat-$v"
  [[ -f "$PREFIX/lib/libexpat.a" ]] && return 0
  fetch "https://github.com/libexpat/libexpat/releases/download/R_2_6_4/expat-$v.tar.xz" "$SRC/expat-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/expat-$v.tar.xz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --without-docbook --without-examples --without-tests
    make -j"$JOBS"
    make install
  )
}

build_libpng() {
  local v=1.6.44
  local d="$SRC/libpng-$v"
  [[ -f "$PREFIX/lib/libpng16.a" ]] && return 0
  fetch "https://download.sourceforge.net/libpng/libpng-$v.tar.xz" "$SRC/libpng-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/libpng-$v.tar.xz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib"
    make -j"$JOBS"
    make install
  )
}

build_freetype() {
  local v=2.13.3
  local d="$SRC/freetype-$v"
  [[ -f "$PREFIX/lib/libfreetype.a" ]] && return 0
  fetch "https://download.savannah.gnu.org/releases/freetype/freetype-$v.tar.xz" "$SRC/freetype-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/freetype-$v.tar.xz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --without-brotli --without-harfbuzz --with-png=yes --with-zlib=yes \
      CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib"
    make -j"$JOBS"
    make install
  )
}

build_fribidi() {
  local v=1.0.16
  local d="$SRC/fribidi-$v"
  [[ -f "$PREFIX/lib/libfribidi.a" ]] && return 0
  fetch "https://github.com/fribidi/fribidi/releases/download/v$v/fribidi-$v.tar.xz" "$SRC/fribidi-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/fribidi-$v.tar.xz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static --disable-docs
    make -j"$JOBS"
    make install
  )
}

build_harfbuzz() {
  local v=10.1.0
  local d="$SRC/harfbuzz-$v"
  [[ -f "$PREFIX/lib/libharfbuzz.a" ]] && return 0
  fetch "https://github.com/harfbuzz/harfbuzz/releases/download/$v/harfbuzz-$v.tar.xz" "$SRC/harfbuzz-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/harfbuzz-$v.tar.xz" "$d"
  (
    cd "$d"
    meson setup build --cross-file="$BUILD/mingw.meson" --prefix="$PREFIX" --default-library=static \
      -Dtests=disabled -Ddocs=disabled -Dglib=disabled -Dgobject=disabled -Dcairo=disabled \
      -Dfreetype=enabled -Dintrospection=disabled
    ninja -C build
    ninja -C build install
  )
}

build_fontconfig() {
  local v=2.15.0
  local d="$SRC/fontconfig-$v"
  [[ -f "$PREFIX/lib/libfontconfig.a" ]] && return 0
  fetch "https://www.freedesktop.org/software/fontconfig/release/fontconfig-$v.tar.xz" "$SRC/fontconfig-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/fontconfig-$v.tar.xz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-docs --disable-nls --enable-libxml2=no \
      FREETYPE_CFLAGS="-I$PREFIX/include/freetype2" FREETYPE_LIBS="-L$PREFIX/lib -lfreetype" \
      EXPAT_CFLAGS="-I$PREFIX/include" EXPAT_LIBS="-L$PREFIX/lib -lexpat" \
      CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib"
    make -j"$JOBS"
    make install
  )
}

build_libass() {
  local v=0.17.3
  local d="$SRC/libass-$v"
  # Rebuild always if a prior host build left DirectWrite on — stamp the R8 flags.
  local stamp="$PREFIX/lib/libass-r8.stamp"
  [[ -f "$stamp" && -f "$PREFIX/lib/libass.a" ]] && return 0
  fetch "https://github.com/libass/libass/releases/download/$v/libass-$v.tar.xz" "$SRC/libass-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/libass-$v.tar.xz" "$d"
  (
    cd "$d"
    # Critical: DirectWrite OFF, fontconfig ON — Q3 / R8 requirement.
    rm -rf build
    meson setup build --cross-file="$BUILD/mingw.meson" --prefix="$PREFIX" --default-library=static \
      -Ddirectwrite=disabled -Dfontconfig=enabled -Dtest=false -Dprofile=false \
      -Dlibunibreak=disabled
    ninja -C build
    ninja -C build install
  )
  printf 'directwrite=disabled\nfontconfig=enabled\nlibass=%s\n' "$v" >"$stamp"
}

build_x264() {
  local d="$SRC/x264"
  [[ -f "$PREFIX/lib/libx264.a" ]] && return 0
  rm -rf "$d"
  git clone --depth 1 https://code.videolan.org/videolan/x264.git "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --enable-static --disable-cli --disable-opencl --cross-prefix="${HOST}-"
    make -j"$JOBS"
    make install
  )
}

build_lame() {
  local v=3.100
  local d="$SRC/lame-$v"
  [[ -f "$PREFIX/lib/libmp3lame.a" ]] && return 0
  fetch "https://sourceforge.net/projects/lame/files/lame/$v/lame-$v.tar.gz/download" "$SRC/lame-$v.tar.gz"
  rm -rf "$d" && untar "$SRC/lame-$v.tar.gz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static --disable-frontend \
      --disable-decoder --disable-gtktest
    make -j"$JOBS"
    make install
  )
}

build_opus() {
  local v=1.5.2
  local d="$SRC/opus-$v"
  [[ -f "$PREFIX/lib/libopus.a" ]] && return 0
  fetch "https://downloads.xiph.org/releases/opus/opus-$v.tar.gz" "$SRC/opus-$v.tar.gz"
  rm -rf "$d" && untar "$SRC/opus-$v.tar.gz" "$d"
  (
    cd "$d"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static --disable-doc --disable-extra-programs
    make -j"$JOBS"
    make install
  )
}

write_cross_file() {
  mkdir -p "$BUILD"
  cat >"$BUILD/mingw.meson" <<EOF
[binaries]
c = '${HOST}-gcc'
cpp = '${HOST}-g++'
ar = '${HOST}-ar'
strip = '${HOST}-strip'
pkg-config = 'pkg-config'
windres = '${HOST}-windres'

[host_machine]
system = 'windows'
cpu_family = 'x86_64'
cpu = 'x86_64'
endian = 'little'

[built-in options]
default_library = 'static'
EOF
}

build_ffmpeg() {
  local v=7.1.1
  local d="$SRC/ffmpeg-$v"
  fetch "https://ffmpeg.org/releases/ffmpeg-$v.tar.xz" "$SRC/ffmpeg-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/ffmpeg-$v.tar.xz" "$d"
  (
    cd "$d"
    # Medium GPL build covering Yamakan import/export + libass titles.
    ./configure \
      --prefix="$PREFIX" \
      --cross-prefix="${HOST}-" \
      --arch=x86_64 \
      --target-os=mingw32 \
      --pkg-config=pkg-config \
      --pkg-config-flags=--static \
      --extra-cflags="-I$PREFIX/include" \
      --extra-ldflags="-L$PREFIX/lib" \
      --extra-libs="-lstdc++ -lwinpthread -lws2_32 -lgdi32 -lole32 -luser32" \
      --enable-gpl --enable-version3 \
      --enable-static --disable-shared \
      --disable-doc --disable-ffplay --disable-debug \
      --enable-libass --enable-libfreetype --enable-fontconfig \
      --enable-libfribidi --enable-libharfbuzz \
      --enable-libx264 --enable-libmp3lame --enable-libopus \
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
  (
    cd "$DIST"
    sha256sum ffmpeg.exe ffprobe.exe >SHA256SUMS
  )
  cat >"$DIST/BUILD.json" <<EOF
{
  "receipt": "yamakan.ffmpeg-win64-r8/1",
  "purpose": "Q3/R8: libass fontconfig provider, DirectWrite disabled",
  "ffmpegVersion": "7.1.1",
  "libassVersion": "0.17.3",
  "host": "x86_64-w64-mingw32",
  "libass": { "directwrite": "disabled", "fontconfig": "enabled" },
  "configureNotes": "Cross-built via scripts/vendor/build-ffmpeg-win64-r8.sh under WSL. Free toolchain only.",
  "ffmpegSha256": "$(awk '/ffmpeg.exe/{print \$1}' "$DIST/SHA256SUMS")",
  "ffprobeSha256": "$(awk '/ffprobe.exe/{print \$1}' "$DIST/SHA256SUMS")"
}
EOF
  log "Artifacts in $DIST"
  cat "$DIST/BUILD.json"
}

main() {
  need_pkgs
  mkdir -p "$SRC" "$PREFIX"
  write_cross_file
  build_zlib
  build_expat
  build_libpng
  build_freetype
  build_fribidi
  build_harfbuzz
  build_fontconfig
  build_libass
  build_x264
  build_lame
  build_opus
  build_ffmpeg
  package_dist
  log "Done. Probe with: wine $DIST/ffmpeg.exe -hide_banner -buildconf | head"
}

main "$@"
