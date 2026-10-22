# P10-08 residual: install an UNSIGNED release-candidate bundle for internal/test use.
# NOT a public release. NOT code-signed. Does NOT claim Profile A.
#
# Default install root: %LOCALAPPDATA%\Yamakan-unsigned-rc (per-user, no Program Files).
# Refuses protected system paths.
param(
  [Parameter(Mandatory = $true)]
  [string]$Artifact,

  [string]$Version = "0.1.0-unsigned-rc",

  [string]$InstallRoot = $(Join-Path $env:LOCALAPPDATA "Yamakan-unsigned-rc")
)

$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

Write-Host "Yamakan UNSIGNED RC installer (test only — not a release)"
Write-Host "  Artifact:    $Artifact"
Write-Host "  Version:     $Version"
Write-Host "  InstallRoot: $InstallRoot"

$resolved = (Resolve-Path -LiteralPath $Artifact).Path
rtk node scripts/bundle.ts install-unsigned-rc $Version $resolved $InstallRoot

Write-Host ""
Write-Host "Installed unsigned RC under: $InstallRoot"
Write-Host "Launch with bundle verify:"
Write-Host "  `$env:YAMAKAN_BUNDLE_INSTALL = '$InstallRoot'"
Write-Host "  rtk npm start"
Write-Host ""
Write-Host "Gates still open: code signing, Profile A, public release (NO-GO)."
