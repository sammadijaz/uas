# UAS Architecture

> Last updated: Phase 0 — Project Foundation

## System Overview

UAS is a layered system with strict dependency direction: UI layers depend on the engine, never the reverse.

```
┌───────────────────────────────────────────────────┐
│                   User Interfaces                  │
│                                                    │
│   ┌─────────────┐          ┌─────────────────┐   │
│   │   CLI Tool   │          │   Desktop App    │   │
│   │  (/cli)      │          │   (/desktop)     │   │
│   └──────┬──────┘          └────────┬────────┘   │
│          │                          │              │
└──────────┼──────────────────────────┼──────────────┘
           │                          │
           └────────────┬─────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│                  Install Engine                       │
│                  (/engine)                            │
│                                                       │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │   Executor   │ │  State   │ │    Rollback      │  │
│  │  (run        │ │  Tracker │ │    Manager       │  │
│  │  installers) │ │  (SQLite)│ │  (best-effort)   │  │
│  └──────┬──────┘ └────┬─────┘ └────────┬─────────┘  │
│         │              │                │             │
└─────────┼──────────────┼────────────────┼─────────────┘
          │              │                │
┌─────────▼──────────────▼────────────────▼─────────────┐
│                 Local Resources                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Catalog  │  │ State DB │  │ Windows  │              │
│  │ (YAML    │  │ (SQLite) │  │ (FS,     │              │
│  │  files)  │  │          │  │  PATH,   │              │
│  │          │  │          │  │  Reg,    │              │
│  │          │  │          │  │  Env)    │              │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
          │
          │ (optional, for sync)
          ▼
┌──────────────────────────┐
│      Backend API          │
│      (/backend)           │
│                           │
│  Auth · Profiles · History│
└──────────────────────────┘
```

## Component Responsibilities

### Install Engine (`/engine`)
**The single most important component.**

- Parses install recipes (YAML manifests describing how to install software)
- Executes installers: `.exe`, `.msi`, `.zip` extraction, portable copy
- Tracks all side effects: files created, PATH modifications, env vars, registry keys
- Maintains a local SQLite state database
- Supports dry-run mode (predict what would happen without doing it)
- Supports rollback (best-effort undo of an installation)

The engine exposes a programmatic API. It has **zero UI logic**. It does not know whether it's being called from a CLI or a GUI.

### CLI Tool (`/cli`)
A command-line interface that wraps the engine.

- Provides commands: `install`, `uninstall`, `profile apply`, `sync`, `diff`, `dry-run`
- Handles authentication flow (login, token storage)
- Formats output for terminal consumption
- **Delegates all real work to the engine**

### Desktop App (`/desktop`)
A GUI application that wraps the engine.

- Provides visual catalog browsing
- Profile management UI
- Install progress and log viewing
- **Delegates all real work to the engine**
- Must be feature-equivalent with the CLI (same engine, different interface)

### Backend API (`/backend`)
A web service for cloud features.

- User authentication
- Profile storage and retrieval
- Install history (what was installed, when, on which machine)
- Catalog metadata (popularity, ratings, validation status)
- Supports both hosted and self-hosted deployment

### Catalog (`/catalog`)
A collection of install recipes.

- Each recipe is a YAML file describing how to install one application
- Recipes are versioned and schema-validated
- Community-maintained with contributor guidelines
- The catalog is the single source of truth for "how to install X"

### Infrastructure (`/infra`)
Build, release, and distribution tooling.

- CI/CD pipelines
- Binary signing
- Auto-update mechanism
- Installer for UAS itself (bootstrapping)

## Dependency Rules

```
CLI ──────────▶ Engine ──────────▶ Catalog (read-only)
Desktop ──────▶ Engine ──────────▶ State DB (read/write)
                Engine ──────────▶ Windows OS (FS, Registry, Env)
CLI ──────────▶ Backend (optional, for sync)
Desktop ──────▶ Backend (optional, for sync)
```

**Forbidden dependencies:**
- Engine MUST NOT depend on CLI or Desktop
- CLI MUST NOT depend on Desktop (or vice versa)
- Catalog MUST NOT depend on anything (it's pure data)
- Backend MUST NOT call the engine directly (engine runs client-side only)

## Data Flow: Installing an App

```
1. User runs: uas install node
2. CLI resolves "node" → looks up catalog recipe
3. CLI calls engine.install(recipe)
4. Engine:
   a. Validates recipe
   b. Checks current state (already installed? version?)
   c. Downloads installer
   d. Runs installer (exe/msi/zip)
   e. Tracks side effects (files, PATH, env, registry)
   f. Writes state to SQLite
   g. Returns result
5. CLI formats and displays result
```

## Data Flow: Applying a Profile

```
1. User runs: uas profile apply dev-setup
2. CLI fetches profile (local file or from backend)
3. Profile contains: [node@20, git@latest, vscode@latest, ...]
4. CLI calls engine.applyProfile(profile)
5. Engine:
   a. Diffs profile vs current state
   b. Plans installs/upgrades/removals
   c. Presents plan (or executes in dry-run)
   d. Executes plan sequentially
   e. Reports results
6. CLI shows summary
```

## Security Boundaries

See [security-model.md](security-model.md) for the full threat model. Key points:

- The engine runs with **user-level privileges** by default
- Elevation (admin) is requested **per-operation** when needed (e.g., MSI installers)
- The backend never executes code — it stores and serves data
- Catalog recipes are **not trusted by default** — they are validated and sandboxed
