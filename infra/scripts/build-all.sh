#!/usr/bin/env bash
# UAS — Build All Packages (Linux/macOS)
# Usage: bash infra/scripts/build-all.sh
#
# Builds each package in dependency order:
#   engine → catalog → cli → backend → desktop

set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PACKAGES=(engine catalog cli backend desktop)
SKIP_DESKTOP="${SKIP_DESKTOP:-false}"
VERBOSE="${VERBOSE:-false}"

if [ "$SKIP_DESKTOP" = "true" ]; then
    PACKAGES=(engine catalog cli backend)
fi

PASSED=()
FAILED=()

status() {
    local pkg=$1 msg=$2 color=$3
    case $color in
        green)  printf "\033[36m[%s]\033[0m \033[32m%s\033[0m\n" "$pkg" "$msg" ;;
        red)    printf "\033[36m[%s]\033[0m \033[31m%s\033[0m\n" "$pkg" "$msg" ;;
        *)      printf "\033[36m[%s]\033[0m %s\n" "$pkg" "$msg" ;;
    esac
}

echo ""
echo "=== UAS Build All ==="
echo "Root: $ROOT"
echo "Packages: ${PACKAGES[*]}"
echo ""

for pkg in "${PACKAGES[@]}"; do
    dir="$ROOT/$pkg"
    if [ ! -d "$dir" ]; then
        status "$pkg" "SKIP — directory not found" "gray"
        continue
    fi

    cd "$dir"

    status "$pkg" "Installing..." ""
    if [ "$VERBOSE" = "true" ]; then
        npm install
    else
        npm install --loglevel error 2>&1 || true
    fi

    status "$pkg" "Building..." ""
    if npm run build 2>&1; then
        status "$pkg" "OK" "green"
        PASSED+=("$pkg")
    else
        status "$pkg" "FAIL" "red"
        FAILED+=("$pkg")
    fi
done

echo ""
echo "=== Results ==="
echo "Passed: ${#PASSED[@]}/${#PACKAGES[@]}"

if [ ${#FAILED[@]} -gt 0 ]; then
    echo "Failed: ${FAILED[*]}"
    exit 1
fi

echo "All packages built successfully."
