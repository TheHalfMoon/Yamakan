# R6 partial (dev profile): scaffold and install the W5 bundle under
# %LOCALAPPDATA%\Yamakan\<version>. Does not code-sign, does not claim R8
# closed (pinned FFmpeg still comes from PATH and may use DirectWrite).
param(
  [string]$Version = "0.0.0-dev"
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

rtk node scripts/bundle.ts install-dev $Version

$root = Join-Path $env:LOCALAPPDATA "Yamakan"
Write-Host ""
Write-Host "Installed under: $root"
Write-Host "Launch with bundle verify:"
Write-Host "  `$env:YAMAKAN_BUNDLE_INSTALL = '$root'"
Write-Host "  rtk npm start"
