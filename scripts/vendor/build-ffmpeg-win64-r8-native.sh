#!/usr/bin/env bash
# Native Windows x86_64 FFmpeg build (Strawberry MinGW + Git Bash / MSYS).
# libass: DirectWrite OFF, fontconfig ON — required for Q3 / R8.
# Output: dist/ffmpeg-win64-r8/{ffmpeg,ffprobe}.exe + SHA256SUMS + BUILD.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="${YAMAKAN_R8_BUILD:-$HOME/yamakan-r8-ffmpeg-build}"
PREFIX="$BUILD/prefix"
SRC="$BUILD/src"
DIST="$ROOT/dist/ffmpeg-win64-r8"
JOBS="${YAMAKAN_R8_JOBS:-$(nproc 2>/dev/null || echo 4)}"

# Prefer Strawberry MinGW if present.
if [[ -d /c/Strawberry/c/bin ]]; then
  export PATH="/c/Strawberry/c/bin:/c/Strawberry/perl/bin:$PATH"
fi
# Meson from pip --user
if [[ -d "$HOME/AppData/Roaming/Python/Python314/Scripts" ]]; then
  export PATH="$HOME/AppData/Roaming/Python/Python314/Scripts:$PATH"
fi
if [[ -d "/c/Users/Shehr/AppData/Roaming/Python/Python314/Scripts" ]]; then
  export PATH="/c/Users/Shehr/AppData/Roaming/Python/Python314/Scripts:$PATH"
fi

export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export PATH="$PREFIX/bin:$PATH"
export CC="${CC:-gcc}"
export CXX="${CXX:-g++}"
export AR="${AR:-ar}"
# Git Bash lives under "Program Files"; libtool breaks on the space unless SHELL
# is the space-free /usr/bin/sh mount.
export SHELL=/usr/bin/sh
export CONFIG_SHELL=/usr/bin/sh
export MAKESHELL=/usr/bin/sh

log() { printf '[r8-ffmpeg-native] %s\n' "$*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || { log "missing tool: $1"; exit 1; }
}

fetch() {
  local url="$1" dest="$2"
  if [[ -f "$dest" ]]; then return 0; fi
  log "fetch $url"
  curl -fsSL --retry 3 -o "$dest" "$url"
}

untar() {
  local archive="$1" dir="$2"
  mkdir -p "$dir"
  tar -xf "$archive" -C "$dir" --strip-components=1
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    # Git Bash often has sha256sum; fallback to powershell
    powershell.exe -NoProfile -Command "(Get-FileHash -Algorithm SHA256 '$1').Hash.ToLower()" | tr -d '\r'
  fi
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
    make -f win32/Makefile.gcc BINARY_PATH="$PREFIX/bin" INCLUDE_PATH="$PREFIX/include" LIBRARY_PATH="$PREFIX/lib" install -j"$JOBS"
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static \
      --without-docbook --without-examples --without-tests
    make -j"$JOBS"
    # Manual install avoids libtool + "Program Files" path breakage.
    mkdir -p "$PREFIX/lib" "$PREFIX/include" "$PREFIX/lib/pkgconfig"
    cp -f lib/.libs/libexpat.a "$PREFIX/lib/"
    cp -f lib/expat.h lib/expat_external.h "$PREFIX/include/"
    cat >"$PREFIX/lib/pkgconfig/expat.pc" <<PC
prefix=$PREFIX
exec_prefix=\${prefix}
libdir=\${prefix}/lib
includedir=\${prefix}/include
Name: expat
Description: expat XML parser
Version: $v
Libs: -L\${libdir} -lexpat
Cflags: -I\${includedir}
PC
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static \
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static \
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static --disable-docs
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
    meson setup build --prefix="$PREFIX" --default-library=static \
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static \
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
  local stamp="$PREFIX/lib/libass-r8.stamp"
  [[ -f "$stamp" && -f "$PREFIX/lib/libass.a" ]] && return 0
  fetch "https://github.com/libass/libass/releases/download/$v/libass-$v.tar.xz" "$SRC/libass-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/libass-$v.tar.xz" "$d"
  (
    cd "$d"
    # Critical: DirectWrite OFF, fontconfig ON — Q3 / R8 requirement.
    rm -rf build
    meson setup build --prefix="$PREFIX" --default-library=static \
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
    ./configure --prefix="$PREFIX" --enable-static --disable-cli --disable-opencl
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static --disable-frontend \
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
    ./configure --prefix="$PREFIX" --disable-shared --enable-static --disable-doc --disable-extra-programs
    make -j"$JOBS"
    make install
  )
}

build_ffmpeg() {
  local v=7.1.1
  local d="$SRC/ffmpeg-$v"
  fetch "https://ffmpeg.org/releases/ffmpeg-$v.tar.xz" "$SRC/ffmpeg-$v.tar.xz"
  rm -rf "$d" && untar "$SRC/ffmpeg-$v.tar.xz" "$d"
  (
    cd "$d"
    ./configure \
      --prefix="$PREFIX" \
      --arch=x86_64 \
      --target-os=mingw32 \
      --pkg-config=pkg-config \
      --pkg-config-flags=--static \
      --extra-cflags="-I$PREFIX/include" \
      --extra-ldflags="-L$PREFIX/lib" \
      --extra-libs="-lstdc++ -lwinpthread -lws2_32 -lgdi32 -lole32 -luser32 -lbcrypt -lstrmiids" \
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
  local ffhash fphash
  ffhash="$(sha256_file "$DIST/ffmpeg.exe")"
  fphash="$(sha256_file "$DIST/ffprobe.exe")"
  printf '%s  ffmpeg.exe\n%s  ffprobe.exe\n' "$ffhash" "$fphash" >"$DIST/SHA256SUMS"
  cat >"$DIST/BUILD.json" <<EOF
{
  "receipt": "yamakan.ffmpeg-win64-r8/1",
  "purpose": "Q3/R8: libass fontconfig provider, DirectWrite disabled",
  "ffmpegVersion": "7.1.1",
  "libassVersion": "0.17.3",
  "host": "x86_64-w64-mingw32-native-strawberry",
  "libass": { "directwrite": "disabled", "fontconfig": "enabled" },
  "configureNotes": "Native MinGW via scripts/vendor/build-ffmpeg-win64-r8-native.sh (Strawberry). Free toolchain only.",
  "ffmpegSha256": "$ffhash",
  "ffprobeSha256": "$fphash"
}
EOF
  log "Artifacts in $DIST"
  cat "$DIST/BUILD.json"
}

main() {
  # Strawberry ships mingw32-make; expose it as make for autoconf projects.
  if ! command -v make >/dev/null 2>&1 && command -v mingw32-make >/dev/null 2>&1; then
    make() { mingw32-make "$@"; }
    export -f make
  fi
  need gcc
  need curl
  need tar
  need git
  need ninja
  need nasm
  need pkg-config
  if ! command -v meson >/dev/null 2>&1 && ! command -v meson.exe >/dev/null 2>&1; then
    log "missing tool: meson"
    exit 1
  fi
  if ! command -v make >/dev/null 2>&1 && ! type make >/dev/null 2>&1; then
    log "missing tool: make / mingw32-make"
    exit 1
  fi
  log "gcc=$(gcc -dumpmachine) $(gcc --version | head -1)"
  mkdir -p "$SRC" "$PREFIX"
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
  log "Done."
}

main "$@"
