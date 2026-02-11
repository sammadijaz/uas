# UAS — Bootstrap Installer Script
# Downloads and installs the latest UAS release.
# Usage: irm https://raw.githubusercontent.com/user/uas/main/infra/installer/install.ps1 | iex

param(
    [string]$Version = "latest",
    [string]$InstallDir = "$env:LOCALAPPDATA\UAS"
)

$ErrorActionPreference = "Stop"

$repo = "user/uas"
$apiBase = "https://api.github.com/repos/$repo"

Write-Host ""
Write-Host "  Universal App Store (UAS) Installer" -ForegroundColor Cyan
Write-Host "  =====================================" -ForegroundColor Cyan
Write-Host ""

# --- Resolve version ---
if ($Version -eq "latest") {
    Write-Host "Fetching latest release..." -ForegroundColor Gray
    try {
        $release = Invoke-RestMethod "$apiBase/releases/latest"
        $Version = $release.tag_name -replace '^v', ''
        Write-Host "Latest version: $Version" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Could not fetch latest release. Check network." -ForegroundColor Red
        exit 1
    }
}

# --- Download ---
$downloadUrl = "https://github.com/$repo/releases/download/v$Version/uas-setup-$Version.exe"
$tempFile = Join-Path $env:TEMP "uas-setup-$Version.exe"

Write-Host "Downloading UAS v$Version..." -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
}
catch {
    Write-Host "ERROR: Download failed — $downloadUrl" -ForegroundColor Red
    Write-Host "Check that the version exists and URL is correct." -ForegroundColor Yellow
    exit 1
}

# --- Install ---
Write-Host "Running installer..." -ForegroundColor Gray
Start-Process -FilePath $tempFile -ArgumentList "/S /D=$InstallDir" -Wait

# --- Verify ---
$uasExe = Join-Path $InstallDir "bin\uas.exe"
if (Test-Path $uasExe) {
    Write-Host ""
    Write-Host "UAS installed successfully!" -ForegroundColor Green
    Write-Host "Location: $InstallDir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run 'uas --help' to get started." -ForegroundColor Cyan
}
else {
    # Fallback — installer might not produce uas.exe yet, still report
    Write-Host ""
    Write-Host "Installer completed." -ForegroundColor Green
    Write-Host "Location: $InstallDir" -ForegroundColor Gray
}

# --- Cleanup ---
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
