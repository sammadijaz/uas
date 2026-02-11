# UAS Infrastructure

> **Status:** ✅ Phase 7 — Complete
> **Depends on:** All other components

## Purpose

Build, release, and distribution tooling for UAS itself.

## Architecture

```
infra/
├── .github/workflows/
│   ├── ci.yml              ← CI pipeline (build + test on push/PR)
│   └── release.yml         ← Release pipeline (tag → build → publish)
├── scripts/
│   ├── build-all.ps1       ← Windows: build all packages in order
│   ├── build-all.sh        ← Linux/macOS: build all packages
│   └── test-all.ps1        ← Windows: test all packages
├── docker/
│   ├── Dockerfile          ← Multi-stage backend image (node:22-slim)
│   ├── docker-compose.yml  ← Development stack
│   └── .dockerignore       ← Build context exclusions
├── installer/
│   ├── uas-setup.nsi       ← NSIS installer config (per-user, no admin)
│   └── install.ps1         ← Bootstrap script (one-liner install)
└── auto-update/
    ├── updater.ts          ← GitHub Releases update client
    └── update-config.json  ← Update channels & signing config
```

## CI/CD

**CI Pipeline** (`.github/workflows/ci.yml`):

- Triggers on push to `main` and all PRs
- Matrix strategy: tests each package independently (engine, cli, catalog, backend, desktop)
- Runs on `windows-latest` — matches target platform
- Separate lint job checks TypeScript with `--noEmit`

**Release Pipeline** (`.github/workflows/release.yml`):

- Triggers on `v*` tags or manual dispatch
- Runs full test suite → builds CLI, backend, desktop → creates draft GitHub Release
- Uploads build artifacts (CLI dist, backend dist, desktop installer)

## Build & Test Scripts

| Script          | Platform    | Description                             |
| --------------- | ----------- | --------------------------------------- |
| `build-all.ps1` | Windows     | Builds all packages in dependency order |
| `build-all.sh`  | Linux/macOS | Same, for CI environments               |
| `test-all.ps1`  | Windows     | Runs all test suites, reports summary   |

Usage: `.\infra\scripts\build-all.ps1 [-SkipDesktop] [-Verbose]`

## Docker

The backend runs in a multi-stage Docker image:

1. **Builder stage**: Compiles TypeScript
2. **Runtime stage**: `node:22-slim`, production deps only, non-root user

```bash
cd infra/docker
docker compose up
```

Environment variables: `UAS_PORT`, `UAS_JWT_SECRET`, `UAS_DB_PATH`, `UAS_CORS_ORIGIN`, `UAS_LOG_LEVEL`

## Installer

**NSIS Installer** (`uas-setup.nsi`):

- Per-user install (no admin required) → `%LOCALAPPDATA%\UAS`
- Bundles desktop app + CLI
- Adds CLI to user PATH
- Creates Start Menu shortcuts
- Registers in Add/Remove Programs

**Bootstrap Script** (`install.ps1`):

```powershell
irm https://raw.githubusercontent.com/user/uas/main/infra/installer/install.ps1 | iex
```

## Auto-Update

- Checks GitHub Releases API for newer versions
- Semver comparison (current vs latest tag)
- Downloads matching installer asset, runs silently, quits current app
- Configurable check interval (default: 4 hours)
- Support for stable/beta channels

## Key Challenges & Solutions

| Challenge                              | Solution                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Self-bootstrapping                     | NSIS installer + PowerShell one-liner bootstrap                          |
| Code signing                           | Config ready in `update-config.json`; enable after obtaining certificate |
| Auto-updates without breaking state DB | Installer overwrites binaries, preserves `%LOCALAPPDATA%\UAS\data/`      |
| CI on Windows                          | GitHub Actions `windows-latest` runners; PowerShell scripts              |
