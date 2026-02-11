# UAS — Test All Packages
# Usage: .\infra\scripts\test-all.ps1
#
# Runs tests for each package, reports summary.

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
Write-Host "=== UAS Test All ===" -ForegroundColor Yellow
Write-Host "Root: $root"
Write-Host "Packages: $($packages -join ', ')"
Write-Host ""

foreach ($pkg in $packages) {
    $dir = Join-Path $root $pkg
    if (-not (Test-Path $dir)) {
        Write-Status $pkg "SKIP — directory not found" "DarkGray"
        continue
    }

    # Ensure deps are installed and built
    Push-Location $dir
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Status $pkg "Installing..." "White"
            & npm install --loglevel error 2>&1 | ForEach-Object { if ($Verbose) { Write-Host "  $_" } }
        }
        if (-not (Test-Path "dist")) {
            Write-Status $pkg "Building..." "White"
            & npm run build 2>&1 | ForEach-Object { if ($Verbose) { Write-Host "  $_" } }
        }

        Write-Status $pkg "Testing..." "White"
        $output = & npm test 2>&1
        $exitCode = $LASTEXITCODE

        if ($Verbose -or $exitCode -ne 0) {
            $output | ForEach-Object { Write-Host "  $_" }
        }

        if ($exitCode -eq 0) {
            Write-Status $pkg "PASS" "Green"
            $passed += $pkg
        }
        else {
            Write-Status $pkg "FAIL (exit $exitCode)" "Red"
            $failed += $pkg
        }
    }
    catch {
        Write-Status $pkg "ERROR — $_" "Red"
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
Write-Host "All tests passed!" -ForegroundColor Green
