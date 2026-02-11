# UAS — Build All Packages
# Usage: .\infra\scripts\build-all.ps1
#
# Builds each package in dependency order:
#   engine → catalog → cli → backend → desktop

param(
    [switch]$SkipDesktop,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$packages = @("engine", "catalog", "cli", "backend")
if (-not $SkipDesktop) {
    $packages += "desktop"
}

$failed = @()
$passed = @()

function Write-Status($pkg, $msg, $color) {
    Write-Host "[$pkg] " -ForegroundColor Cyan -NoNewline
    Write-Host $msg -ForegroundColor $color
}

Write-Host ""
Write-Host "=== UAS Build All ===" -ForegroundColor Yellow
Write-Host "Root: $root"
Write-Host "Packages: $($packages -join ', ')"
Write-Host ""

foreach ($pkg in $packages) {
    $dir = Join-Path $root $pkg
    if (-not (Test-Path $dir)) {
        Write-Status $pkg "SKIP — directory not found" "DarkGray"
        continue
    }

    Write-Status $pkg "Installing..." "White"
    Push-Location $dir
    try {
        & npm install --loglevel error 2>&1 | ForEach-Object { if ($Verbose) { Write-Host "  $_" } }
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

        Write-Status $pkg "Building..." "White"
        & npm run build 2>&1 | ForEach-Object { if ($Verbose) { Write-Host "  $_" } }
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

        Write-Status $pkg "OK" "Green"
        $passed += $pkg
    }
    catch {
        Write-Status $pkg "FAIL — $_" "Red"
        $failed += $pkg
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "=== Results ===" -ForegroundColor Yellow
Write-Host "Passed: $($passed.Count)/$($packages.Count)" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "All packages built successfully." -ForegroundColor Green
