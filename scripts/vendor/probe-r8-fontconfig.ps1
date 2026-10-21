# R8/Q3: assert the vendored FFmpeg uses fontconfig, not DirectWrite.
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ff = Join-Path $root "vendor\ffmpeg-win64-r8\ffmpeg.exe"
if (-not (Test-Path $ff)) { throw "missing $ff" }
$tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ("r8-probe-" + [guid]::NewGuid().ToString("N")))
Push-Location $tmp
try {
  @"
[Script Info]
ScriptType: v4.00+
PlayResX: 64
PlayResY: 64
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,12,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,x
"@ | Set-Content -Encoding ascii t.ass
  $log = & $ff -hide_banner -loglevel info -f lavfi -i color=c=black:s=64x64:d=0.04 -vf ass=t.ass -frames:v 1 -f null - 2>&1 | Out-String
  if ($log -notmatch "Using font provider fontconfig") {
    throw "expected fontconfig provider`n$log"
  }
  if ($log -match "font provider directwrite") {
    throw "DirectWrite must be disabled`n$log"
  }
  Write-Host "R8 font provider probe OK (fontconfig)"
}
finally {
  Pop-Location
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
