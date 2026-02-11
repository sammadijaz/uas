# Getting Started with UAS

> **The complete guide to building, running, deploying, and contributing to the Universal App Store.**

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (5 minutes)](#quick-start-5-minutes)
- [Project Structure](#project-structure)
- [Building from Source](#building-from-source)
- [Running Each Component](#running-each-component)
  - [Installation Engine](#1-installation-engine)
  - [CLI Tool](#2-cli-tool)
  - [Catalog System](#3-catalog-system)
  - [Backend API](#4-backend-api)
  - [Desktop App](#5-desktop-app)
- [Testing](#testing)
- [Writing Your First Recipe](#writing-your-first-recipe)
- [Creating a Profile](#creating-a-profile)
- [Deploying the Backend](#deploying-the-backend)
  - [Docker (Recommended)](#docker-recommended)
  - [Manual Deployment](#manual-deployment)
  - [Cloud Deployment](#cloud-deployment)
- [Building the Desktop Installer](#building-the-desktop-installer)
- [Publishing a Release](#publishing-a-release)
- [CI/CD Pipeline](#cicd-pipeline)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | ≥ 20.0.0 | Runtime for all components |
| **npm** | ≥ 10 | Package management (ships with Node.js) |
| **Git** | ≥ 2.30 | Version control |
| **Windows 10/11** | Build 19041+ | Target platform |

**Optional:**
- **Docker** — for backend containerized deployment
- **NSIS 3.x** — for building the Windows installer
- **Code signing certificate** — for SmartScreen trust (production only)

### Install Node.js

```powershell
# Option A: Download from nodejs.org
# Option B: Using winget
winget install OpenJS.NodeJS.LTS

# Verify
node --version   # Should print v20+ or v22+
npm --version    # Should print 10+
```

---

## Quick Start (5 minutes)

```powershell
# 1. Clone the repository
git clone https://github.com/user/uas.git
cd uas

# 2. Build everything
.\infra\scripts\build-all.ps1

# 3. Test everything
.\infra\scripts\test-all.ps1

# 4. Use the CLI
cd cli
node dist/index.js search node
node dist/index.js install node --dry-run
node dist/index.js status

# 5. Start the backend API
cd ..\backend
node dist/server.js
# → API running at http://localhost:3100

# 6. Launch the desktop app
cd ..\desktop
npx electron .
```

That's it. You're running UAS.

---

## Project Structure

```
uas/
├── .github/workflows/   CI/CD pipelines (GitHub Actions)
│   ├── ci.yml           Build + test on push/PR
│   └── release.yml      Tag → build → publish release
│
├── docs/                Architecture, specs, glossary
│   ├── architecture.md  System design & data flow
│   ├── glossary.md      Canonical terminology
│   ├── security-model.md Trust boundaries & threats
│   └── specs/           Formal specifications
│       ├── execution-lifecycle.md
│       ├── install-recipe.md
│       └── profile.md
│
├── engine/              Core installation engine (the heart)
│   ├── src/             Engine source code
│   │   ├── engine.ts    Main orchestrator
│   │   ├── state-db.ts  SQLite state tracking
│   │   ├── recipe-parser.ts  YAML parsing + validation
│   │   ├── executors/   Installer type handlers (MSI, EXE, ZIP, portable)
│   │   ├── rollback.ts  Undo/rollback operations
│   │   └── variables.ts Template variable expansion
│   └── tests/           25 tests
│
├── cli/                 Command-line interface
│   ├── src/
│   │   ├── index.ts     Commander.js program entry
│   │   ├── commands/    install, uninstall, status, search, profile, sync, login
│   │   ├── output.ts    Formatted terminal output (chalk, tables)
│   │   └── catalog.ts   Recipe resolution from local catalog
│   └── tests/           12 tests
│
├── catalog/             Install recipes & validation
│   ├── recipes/         One folder per app (node, git, python, vscode, rust)
│   │   └── <app>/recipe.yaml
│   ├── profiles/        Declarative environment profiles
│   │   └── frontend-dev.yaml
│   ├── schema.json      JSON Schema for recipe validation
│   ├── src/
│   │   ├── validator.ts AJV schema + semantic rules
│   │   ├── loader.ts    Catalog indexing, search, filtering
│   │   └── validate.ts  CLI batch validation tool
│   └── tests/           40 tests
│
├── backend/             Express REST API
│   ├── src/
│   │   ├── app.ts       Express app factory
│   │   ├── server.ts    HTTP server + graceful shutdown
│   │   ├── db.ts        sql.js SQLite (users, profiles, machines, history)
│   │   ├── auth.ts      JWT + bcrypt authentication
│   │   ├── schemas.ts   Zod request validation
│   │   └── routes/      auth, profiles, machines, history, health
│   └── tests/           27 tests
│
├── desktop/             Electron GUI application
│   ├── src/main/
│   │   ├── main.ts      Electron main process
│   │   ├── ipc.ts       IPC handlers (catalog, profiles, system info)
│   │   └── preload.ts   Context bridge (secure API surface)
│   ├── renderer/
│   │   ├── index.html   App shell (4 views + modal)
│   │   ├── styles.css   Dark theme UI
│   │   └── renderer.js  Navigation, catalog browsing, search
│   └── tests/           13 tests
│
├── infra/               Build, release, deployment
│   ├── scripts/         build-all.ps1, test-all.ps1, build-all.sh
│   ├── docker/          Dockerfile + docker-compose.yml
│   ├── installer/       NSIS config + bootstrap PowerShell script
│   └── auto-update/     GitHub Releases update client
│
├── README.md            Project overview
├── GUIDE.md             ← You are here
├── CONTRIBUTING.md      How to contribute
└── LICENSE              MIT license
```

---

## Building from Source

Each package is independent. Build them in dependency order:

```powershell
# Build all at once (recommended)
.\infra\scripts\build-all.ps1

# Or build individually:
cd engine  && npm install && npm run build && cd ..
cd catalog && npm install && npm run build && cd ..
cd cli     && npm install && npm run build && cd ..
cd backend && npm install && npm run build && cd ..
cd desktop && npm install && npm run build && cd ..
```

### Watch Mode (Development)

```powershell
# In any package directory:
npm run dev    # Recompiles on file changes
```

---

## Running Each Component

### 1. Installation Engine

The engine is a library — it's consumed by the CLI and desktop app, not run directly.

```typescript
import { UasEngine } from '@uas/engine';

const engine = await UasEngine.create({ dbPath: './uas-state.db' });

// Install an app
await engine.install(recipe, { dryRun: true });

// Check installed apps
const apps = engine.listInstalled();

// Rollback an installation
await engine.rollback(installId);

await engine.shutdown();
```

### 2. CLI Tool

```powershell
cd cli

# Search the catalog
node dist/index.js search "node"

# Install an app (dry run)
node dist/index.js install node --dry-run

# Install for real
node dist/index.js install node

# Check what's installed
node dist/index.js status

# Apply a profile (installs all apps in the profile)
node dist/index.js profile apply frontend-dev --dry-run

# See profile differences
node dist/index.js profile diff frontend-dev

# Export current state as a profile
node dist/index.js profile export > my-setup.yaml

# Uninstall an app
node dist/index.js uninstall node
```

**Global install (for `uas` command everywhere):**

```powershell
cd cli
npm link
# Now use from anywhere:
uas install node
uas status
```

### 3. Catalog System

```powershell
cd catalog

# Validate all recipes
node dist/validate.js

# Validate a specific recipe
node dist/validate.js recipes/node/recipe.yaml
```

**Using the catalog API:**

```typescript
import { Catalog } from '@uas/catalog';

const catalog = new Catalog('./catalog');

// List all recipes
const all = catalog.list();

// Search
const results = catalog.search('javascript');

// Filter by category
const devTools = catalog.filterByCategory('development');

// Load a profile
const profile = catalog.loadProfile('frontend-dev');
```

### 4. Backend API

```powershell
cd backend
node dist/server.js
# → UAS Backend listening on http://localhost:3100
```

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `UAS_PORT` | `3100` | HTTP port |
| `UAS_JWT_SECRET` | `uas-dev-secret-...` | JWT signing secret |
| `UAS_JWT_EXPIRY` | `24h` | Token expiration |
| `UAS_DB_PATH` | `./data/uas.db` | SQLite database path |
| `UAS_CORS_ORIGIN` | `*` | Allowed CORS origins |
| `UAS_LOG_LEVEL` | `info` | Log verbosity |

**API Endpoints:**

```
POST   /api/auth/register     Create account
POST   /api/auth/login        Get JWT token
GET    /api/auth/me           Current user info

POST   /api/profiles          Create profile
GET    /api/profiles          List profiles
GET    /api/profiles/:id      Get profile
PUT    /api/profiles/:id      Update profile
DELETE /api/profiles/:id      Delete profile

POST   /api/machines          Register machine
GET    /api/machines          List machines
GET    /api/machines/:id      Get machine
DELETE /api/machines/:id      Remove machine

POST   /api/history           Record install event
GET    /api/history           List history (paginated)
GET    /api/history/machine/:id   History by machine
GET    /api/history/app/:name     History by app

GET    /api/health            Health check
```

**Quick test:**

```powershell
# Health check
curl http://localhost:3100/api/health

# Register
curl -X POST http://localhost:3100/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","email":"admin@example.com","password":"MySecure123!"}'

# Login
curl -X POST http://localhost:3100/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@example.com","password":"MySecure123!"}'
```

### 5. Desktop App

```powershell
cd desktop
npx electron .
```

The desktop app provides:
- **Catalog Browser** — search, filter by category, view app details
- **Profile Manager** — browse and inspect profiles
- **Installed Apps** — view what's on this machine
- **Settings** — system info, paths, configuration

---

## Testing

```powershell
# Test everything
.\infra\scripts\test-all.ps1

# Test individual packages
cd engine  && npm test   # 25 tests
cd catalog && npm test   # 40 tests
cd cli     && npm test   # 12 tests
cd backend && npm test   # 27 tests
cd desktop && npm test   # 13 tests

# Watch mode (re-runs on change)
npm run test:watch
```

**Total: 117 tests across 5 packages.**

Test breakdown:
- **Engine**: Variables/template expansion, recipe verification, state DB operations, install/uninstall lifecycle, rollback
- **Catalog**: JSON Schema validation (10), semantic rules (6), catalog loader/indexer (14), profile loading (4), sample recipe validation (6)
- **CLI**: Command parsing, help output, version flag, error handling
- **Backend**: Auth flow (register/login/me), profile CRUD, machine management, install history, health check, error cases
- **Desktop**: IPC contract verification, renderer utilities, preload API shape

---

## Writing Your First Recipe

Create a new folder in `catalog/recipes/` with a `recipe.yaml`:

```powershell
mkdir catalog/recipes/my-tool
```

```yaml
# catalog/recipes/my-tool/recipe.yaml
id: my-tool
name: My Tool
version: "2.0.0"
description: A useful development tool.
license: MIT

installer:
  type: exe                          # exe, msi, zip, or portable
  url: https://example.com/my-tool-2.0.0-setup.exe
  sha256: abc123...                  # Checksum for integrity
  silent_args: "/S"                  # Silent install flags
  size_bytes: 15000000

requirements:
  os: windows
  arch: x64
  admin: false                       # Does it need admin rights?
  min_os_version: "10.0.19041"
  disk_space_mb: 100
  dependencies: []

side_effects:
  path:
    add:
      - "%PROGRAMFILES%\\MyTool\\bin"
  env:
    set:
      MY_TOOL_HOME: "%PROGRAMFILES%\\MyTool"
  registry: []
  shortcuts:
    - name: My Tool
      target: "%PROGRAMFILES%\\MyTool\\my-tool.exe"
      location: startmenu

verification:
  command: "my-tool --version"
  expected_output: "2.0.0"

uninstall:
  type: exe
  command: "%PROGRAMFILES%\\MyTool\\uninstall.exe"
  silent_args: "/S"

metadata:
  categories: [development, utilities]
  tags: [tool, productivity]
  maintainer: your-name
  updated: "2026-02-11"
  homepage: https://example.com/my-tool
  docs: https://example.com/my-tool/docs
```

**Validate it:**

```powershell
cd catalog
npm run build
node dist/validate.js recipes/my-tool/recipe.yaml
```

See [catalog/CONTRIBUTING.md](catalog/CONTRIBUTING.md) for detailed recipe guidelines.

---

## Creating a Profile

Profiles define a complete environment — a list of apps with optional versions:

```yaml
# catalog/profiles/my-setup.yaml
name: my-setup
description: My personal development environment
version: "1.0.0"
author: your-name

apps:
  - id: node
    version: "22.12.0"
  - id: git
  - id: vscode
  - id: python
    version: "3.13.0"
  - id: rust

settings:
  install_dir: "%LOCALAPPDATA%\\Programs"
  parallel: false
  continue_on_error: true
```

**Use the profile:**

```powershell
# See what would be installed
uas profile diff my-setup

# Apply it (dry run first!)
uas profile apply my-setup --dry-run

# Apply for real
uas profile apply my-setup

# Export your current machine state as a profile
uas profile export > my-current-setup.yaml
```

---

## Deploying the Backend

### Docker (Recommended)

```powershell
cd infra/docker

# Start the backend
docker compose up -d

# Check health
curl http://localhost:3100/api/health

# View logs
docker compose logs -f backend

# Stop
docker compose down
```

**Production configuration:**

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      UAS_JWT_SECRET: "${UAS_JWT_SECRET}"   # Set via .env or CI secrets
      UAS_CORS_ORIGIN: "https://your-domain.com"
      UAS_LOG_LEVEL: "warn"
    volumes:
      - /var/data/uas:/data                 # Persistent storage
    restart: always
```

### Manual Deployment

```powershell
# On the server:
cd backend
npm install --omit=dev
npm run build

# Set production environment
$env:NODE_ENV = "production"
$env:UAS_JWT_SECRET = "your-strong-random-secret-here"
$env:UAS_DB_PATH = "/var/data/uas/uas.db"
$env:UAS_CORS_ORIGIN = "https://your-domain.com"

# Start
node dist/server.js
```

**Use a process manager for production:**

```powershell
# With PM2:
npm install -g pm2
pm2 start dist/server.js --name uas-backend
pm2 save
pm2 startup
```

### Cloud Deployment

**Azure App Service:**
```powershell
# Build and deploy
az webapp up --name uas-backend --runtime "NODE:22-lts"
```

**AWS (EC2 / ECS):**
```powershell
# Build Docker image
docker build -f infra/docker/Dockerfile -t uas-backend .
docker tag uas-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/uas-backend
docker push <account>.dkr.ecr.<region>.amazonaws.com/uas-backend
```

**Railway / Render / Fly.io:**
- Point to the repo, set `infra/docker/Dockerfile` as the Dockerfile path
- Set environment variables in the dashboard
- Deploy

---

## Building the Desktop Installer

### Development Build

```powershell
cd desktop
npx electron-builder --dir
# Output: desktop/release/win-unpacked/
```

### Production Installer

```powershell
cd desktop
npx electron-builder --win nsis
# Output: desktop/release/UAS-Setup-0.1.0.exe
```

### With NSIS (Custom Installer)

```powershell
# Requires NSIS 3.x installed and on PATH
cd infra/installer
makensis uas-setup.nsi
# Output: uas-setup-0.1.0.exe
```

### Code Signing (Production)

To avoid Windows SmartScreen warnings:

1. Obtain a code signing certificate (DigiCert, Sectigo, etc.)
2. Update `infra/auto-update/update-config.json`:
   ```json
   {
     "signing": {
       "enabled": true,
       "certificateSubjectName": "Your Organization Name"
     }
   }
   ```
3. Sign during the build:
   ```powershell
   signtool sign /n "Your Organization Name" /t http://timestamp.digicert.com /fd sha256 UAS-Setup-0.1.0.exe
   ```

---

## Publishing a Release

### Automated (via CI/CD)

```powershell
# Tag a new version
git tag v0.2.0
git push origin v0.2.0
# → GitHub Actions runs the release pipeline automatically
# → Creates a draft release with all artifacts
```

### Manual

1. Update version numbers in all `package.json` files
2. Build everything: `.\infra\scripts\build-all.ps1`
3. Test everything: `.\infra\scripts\test-all.ps1`
4. Build the installer: `cd desktop && npx electron-builder --win nsis`
5. Create a GitHub Release and upload:
   - `UAS-Setup-0.2.0.exe` (desktop installer)
   - `uas-cli-0.2.0.tgz` (CLI package)
   - `CHANGELOG.md`

---

## CI/CD Pipeline

### Continuous Integration (`ci.yml`)

Runs on every push and PR to `main`:

```
Push/PR → Checkout → Setup Node 22 → Install → Build → Test
                                          ↓
                                 Matrix: [engine, cli, catalog, backend, desktop]
```

- Each package tested independently on `windows-latest`
- Separate TypeScript lint job on `ubuntu-latest`
- Fail-fast disabled — all packages run even if one fails

### Release Pipeline (`release.yml`)

Triggered by version tags (`v*`) or manual dispatch:

```
Tag v* → Test All → Build CLI  ──┐
                  → Build Backend ├─→ Draft GitHub Release
                  → Build Desktop ─┘
```

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Unsigned binaries** | SmartScreen blocks them; use code signing for production |
| **JWT secrets** | Never commit secrets; use environment variables |
| **SQL injection** | All queries use parameterized statements via sql.js |
| **XSS in desktop** | Electron `contextIsolation: true`, CSP headers, `escapeHtml()` |
| **CORS** | Configurable origins; lock down in production |
| **Password storage** | bcrypt with 10 salt rounds; never stored in plaintext |
| **Installer integrity** | SHA256 checksums in recipes; verify before execution |
| **Auto-updates** | Only from configured GitHub repository; semver comparison |
| **Admin privileges** | Per-user install by default; admin only when recipe requires it |

See [docs/security-model.md](docs/security-model.md) for the full threat model.

---

## Troubleshooting

### "Cannot find module @uas/engine"

```powershell
# Rebuild the engine first
cd engine && npm install && npm run build
# Then rebuild the dependent package
cd ../cli && npm install && npm run build
```

### "EACCES permission denied" on install

The recipe requires admin rights. Run your terminal as Administrator, or use recipes that support per-user install.

### "sql.js failed to initialize"

Ensure sql.js WASM file is accessible. The engine auto-downloads it on first run:

```powershell
cd engine
npm install sql.js
```

### Tests fail with "EBUSY" on Windows

SQLite lock contention. Ensure no other process has the `.db` file open:

```powershell
# Check for locks
Get-Process | Where-Object { $_.Modules.FileName -like "*uas*" }
```

### Desktop app shows blank screen

Check that the renderer files exist and preload is loading:

```powershell
cd desktop
# Verify build output
ls dist/main/
# Should contain: main.js, ipc.js, preload.js

# Launch with DevTools
$env:NODE_ENV = "development"
npx electron .
# DevTools will auto-open in development mode
```

### Backend returns 500 errors

Check the logs and database:

```powershell
# Run with debug logging
$env:UAS_LOG_LEVEL = "debug"
node dist/server.js

# Reset the database
Remove-Item data/uas.db
node dist/server.js    # Will recreate tables on startup
```

---

## FAQ

**Q: Does UAS replace Chocolatey/Winget/Scoop?**
A: No. UAS orchestrates installations using native installers (EXE, MSI, ZIP). It doesn't compile or package software. Think of it as a layer above package managers — it manages your entire environment, not individual packages.

**Q: Do I need admin rights?**
A: Not for UAS itself (installs per-user). Some app recipes may require admin — this is declared in the recipe's `requirements.admin` field so you know upfront.

**Q: Can I use UAS on macOS/Linux?**
A: Not yet. UAS is Windows-first by design. Cross-platform support is a future goal.

**Q: How does sync work?**
A: The backend stores your profiles and install history. Register a machine with `uas login` and `uas sync` to push/pull your setup between machines.

**Q: How do I add a new app to the catalog?**
A: Write a `recipe.yaml`, validate it, and submit a PR. See [Writing Your First Recipe](#writing-your-first-recipe) and [catalog/CONTRIBUTING.md](catalog/CONTRIBUTING.md).

**Q: Is my data safe?**
A: Passwords are bcrypt-hashed. All database queries are parameterized. The state DB is local SQLite — no data leaves your machine unless you explicitly sync.

**Q: How does rollback work?**
A: Every install is tracked in the state DB with a unique ID. The engine records what was changed (files, registry, PATH, etc.) and can reverse those changes using `uas uninstall <app>` or the engine's `rollback()` API.

---

## What's Next

UAS is at v0.1.0. Here's the roadmap:

| Priority | Feature | Status |
|----------|---------|--------|
| High | Real installer execution (not just dry-run) | Planned |
| High | `uas sync` cloud synchronization | Stub ready |
| Medium | Catalog auto-update from Git | Planned |
| Medium | Desktop app install/uninstall integration | Planned |
| Medium | Recipe dependency resolution | Planned |
| Low | Cross-platform support (macOS, Linux) | Future |
| Low | Plugin system for custom executors | Future |
| Low | Web dashboard | Future |

---

*Built with TypeScript, tested with Vitest, automated with GitHub Actions.*
*117 tests. Zero external services required. Works offline.*
