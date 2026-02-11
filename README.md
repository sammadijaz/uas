# Universal App Store (UAS)

<div align="center">

**A Windows-first, account-synced, stateful environment installer.**

[![CI](https://img.shields.io/badge/tests-125%20passing-brightgreen)](.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-green)](https://nodejs.org/)

_Define your entire dev environment as a portable profile._
_Install it on any Windows machine with a single command._

[Getting Started](GUIDE.md) · [API Docs](backend/README.md) · [Contributing](CONTRIBUTING.md) · [Architecture](docs/architecture.md)

</div>

---

## The Problem

Setting up a new Windows machine for development is painful:

- You visit 15 websites, download 15 installers, click through 15 wizards
- You forget which tools you had, which versions, which settings
- You can't reproduce your setup reliably
- Existing package managers (Chocolatey, Winget, Scoop) manage packages but not _environments_

## The Solution

UAS treats your entire toolchain as a **versioned, declarative profile** that can be installed, synced, diffed, and rolled back.

```powershell
# Install globally
npm install -g uas

# Browse and install software
uas list
uas install node
uas install python

# Save your ENTIRE environment (apps + env vars)
uas save

# Restore on a new machine
uas restore
```

Think of it as **"dotfiles for Windows"** meets **"Homebrew + Chocolatey + Ninite"** — with cloud sync, env vars, and rollback.

---

## Quick Start

```powershell
git clone https://github.com/user/uas.git
cd uas
.\infra\scripts\build-all.ps1    # Build all 5 packages
.\infra\scripts\test-all.ps1     # Run all 125 tests
```

> **[Read the full Getting Started guide →](GUIDE.md)**

---

## Features

| Capability         | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| **Install Engine** | Executes install recipes (EXE, MSI, ZIP, portable) with full state tracking |
| **CLI**            | `uas list`, `uas install`, `uas remove`, `uas save`, `uas restore`          |
| **Desktop App**    | Browse catalog, manage profiles, trigger installs — Electron-powered        |
| **Web Backend**    | Auth, profile storage, install history — REST API with JWT                  |
| **App Catalog**    | Community-maintained recipes with JSON Schema + semantic validation         |
| **Profiles**       | Declarative manifests: tools + versions + config in one YAML file           |
| **Rollback**       | Every install tracked; undo any change with full state reversal             |
| **Cloud Sync**     | Push/pull your environment across machines via the backend API              |
| **Env Backup**     | Save and restore PATH + environment variables between machines              |

---

## Boundaries

| Non-Goal                        | Reason                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| A package manager replacement   | We delegate to existing installers; we orchestrate, not compile         |
| Linux/macOS support (initially) | Windows-first by design. Cross-platform is a future goal                |
| A configuration management tool | We install software; we don't manage dotfiles or OS settings            |
| A container runtime             | Containers solve isolation; UAS solves native Windows environment setup |
| An app store with payments      | No monetization. Open-source tool, MIT licensed                         |

---

## Architecture Overview

```
┌─────────────┐   ┌─────────────┐
│   CLI Tool   │   │ Desktop App │
└──────┬──────┘   └──────┬──────┘
       │                  │
       └────────┬─────────┘
                │
        ┌───────▼────────┐
        │  Install Engine │  ← The heart of UAS
        └───────┬────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼──┐  ┌────▼───┐  ┌────▼────┐
│Catalog│  │ State  │  │ Backend │
│(local)│  │  DB    │  │  (API)  │
└───────┘  └────────┘  └─────────┘
```

Both the CLI and Desktop App are **thin controllers** over the shared Install Engine. They never bypass engine logic. The engine owns all state transitions, filesystem changes, and rollback capability.

---

## Project Structure

```
uas/
├── engine/     Core installation engine — the heart of UAS          (25 tests)
├── cli/        Command-line interface — list, install, save, restore (20 tests)
├── catalog/    Install recipes + JSON Schema validation             (40 tests)
├── backend/    Express REST API — auth, profiles, machines          (27 tests)
├── desktop/    Electron GUI — catalog browser, profiles, settings   (13 tests)
├── infra/      CI/CD, Docker, installer, auto-update scripts
├── docs/       Architecture, specs, security model, glossary
└── GUIDE.md    ← Complete getting started & deployment guide
```

Each component is an independent package with its own `package.json`, `tsconfig.json`, build process, and test suite. **125 tests total, all passing.**

---

## Build Phases

All 8 phases complete. The project is fully implemented and tested.

| Phase | Component                 | Tests | Status      |
| ----- | ------------------------- | ----- | ----------- |
| 0     | Project Foundation        | —     | ✅ Complete |
| 1     | Core Concepts & Contracts | —     | ✅ Complete |
| 2     | Installation Engine       | 25    | ✅ Complete |
| 3     | CLI Tool                  | 20    | ✅ Complete |
| 4     | Catalog System            | 40    | ✅ Complete |
| 5     | Backend API               | 27    | ✅ Complete |
| 6     | Desktop App               | 13    | ✅ Complete |
| 7     | Infra & Distribution      | —     | ✅ Complete |

---

## Technology Stack

| Layer                | Choice                           | Why                                                         |
| -------------------- | -------------------------------- | ----------------------------------------------------------- |
| **Language**         | TypeScript (strict, ES2022)      | Cross-component consistency, strong typing, large ecosystem |
| **Runtime**          | Node.js ≥ 20                     | Process spawning, filesystem ops, registry access           |
| **State DB**         | SQLite via sql.js                | Zero-config, single-file, no native deps, works everywhere  |
| **CLI**              | Commander.js + Chalk + Ora       | Mature, composable, CJS-compatible                          |
| **Desktop**          | Electron 33                      | Full Node.js access, contextIsolation, proven ecosystem     |
| **Backend**          | Express + Helmet + JWT + Zod     | Lightweight, well-understood, strong validation             |
| **Catalog**          | YAML + AJV (JSON Schema)         | Human-readable, diffable, schema-validated                  |
| **Testing**          | Vitest + Supertest               | Fast, modern, excellent DX                                  |
| **CI/CD**            | GitHub Actions (Windows runners) | Native Windows testing, matrix strategy                     |
| **Packaging**        | NSIS + electron-builder          | Per-user install, no admin, SmartScreen-ready               |
| **Containerization** | Docker (multi-stage)             | Backend deployment, reproducible builds                     |

---

## Documentation

| Document                                               | Description                                                |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| **[GUIDE.md](GUIDE.md)**                               | Complete getting started, deployment, and operations guide |
| **[CONTRIBUTING.md](CONTRIBUTING.md)**                 | How to contribute code, recipes, and bug reports           |
| **[docs/architecture.md](docs/architecture.md)**       | System design, component boundaries, data flow             |
| **[docs/security-model.md](docs/security-model.md)**   | Trust boundaries, threat model, mitigations                |
| **[docs/glossary.md](docs/glossary.md)**               | Canonical terminology used across UAS                      |
| **[docs/specs/](docs/specs/)**                         | Formal specs: recipes, profiles, execution lifecycle       |
| **[catalog/CONTRIBUTING.md](catalog/CONTRIBUTING.md)** | How to write and submit install recipes                    |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```powershell
# Setup
git clone https://github.com/user/uas.git && cd uas
.\infra\scripts\build-all.ps1

# Make changes, then verify
.\infra\scripts\test-all.ps1

# Submit a PR
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
