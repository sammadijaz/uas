# Universal App Store (UAS)

**A Windows-first, account-synced, stateful environment installer.**

UAS lets you define your entire development environment as a portable profile — tools, runtimes, editors, fonts, configs — and install it on any Windows machine with a single command.

Think of it as "dotfiles for Windows" meets "Homebrew + Chocolatey + Ninite" with cloud sync and rollback.

---

## Why UAS Exists

Setting up a new Windows machine for development is painful:

- You visit 15 websites, download 15 installers, click through 15 wizards
- You forget which tools you had, which versions, which settings
- You can't reproduce your setup reliably
- Existing package managers (Chocolatey, Winget, Scoop) manage packages but not _environments_

UAS solves this by treating your entire toolchain as a **versioned, declarative profile** that can be installed, synced, diffed, and rolled back.

---

## What UAS Is

| Capability         | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| **Install Engine** | Executes install recipes (exe, msi, zip, portable) with full state tracking |
| **CLI**            | `uas install node`, `uas profile apply dev`, `uas sync`                     |
| **Desktop App**    | Browse catalog, manage profiles, trigger installs, view logs                |
| **Web Backend**    | Auth, profile storage, install history, catalog metadata                    |
| **App Catalog**    | Community-maintained, versioned install recipes with schema validation      |
| **Profiles**       | Declarative manifests listing tools + versions + config                     |

---

## What UAS Is NOT

| Non-Goal                        | Reason                                                                      |
| ------------------------------- | --------------------------------------------------------------------------- |
| A package manager replacement   | We delegate to existing installers; we orchestrate, not compile             |
| Linux/macOS support (initially) | Windows-first. Cross-platform is a future concern, not a launch requirement |
| A configuration management tool | We install software; we don't manage dotfiles, SSH keys, or OS settings     |
| A container runtime             | Containers solve isolation; UAS solves native Windows environment setup     |
| An app store with payments      | No monetization layer. This is an open-source tool                          |

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
/uas
  /docs        — Architecture, specs, security model, glossary
  /engine      — Core installation engine (the heart)
  /cli         — Command-line interface
  /desktop     — Desktop GUI application
  /backend     — Web API + dashboard backend
  /catalog     — App install recipes and validation
  /infra       — CI/CD, release, signing, distribution
```

Each folder is an isolated component with its own README, dependencies, and build process.

---

## Build Phases

| Phase | Component                 | Status      |
| ----- | ------------------------- | ----------- |
| 0     | Project Foundation        | ✅ Complete |
| 1     | Core Concepts & Contracts | ✅ Complete |
| 2     | Installation Engine       | ✅ Complete |
| 3     | CLI Tool                  | ✅ Complete |
| 4     | Catalog System            | ✅ Complete |
| 5     | Backend API               | 🔜 Next     |
| 6     | Desktop App               | ⬜ Planned  |
| 7     | Infra & Distribution      | ⬜ Planned  |

---

## Technology Decisions

| Decision              | Choice                                    | Reasoning                                                        |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| **Primary language**  | TypeScript (Node.js)                      | Cross-component consistency, strong typing, large ecosystem      |
| **Engine runtime**    | Node.js with native bindings where needed | Sufficient for process spawning, filesystem ops, registry access |
| **CLI framework**     | TBD (Phase 3)                             | Evaluated when we get there                                      |
| **Desktop framework** | TBD (Phase 6)                             | Electron or Tauri — decided when we get there                    |
| **Backend**           | TBD (Phase 5)                             | Decided when we get there                                        |
| **State storage**     | SQLite (local)                            | Zero-config, single-file, battle-tested                          |
| **Catalog format**    | YAML with JSON Schema validation          | Human-readable, diffable, familiar                               |
| **License**           | MIT                                       | See LICENSE file for reasoning                                   |

Decisions are made at the latest responsible moment — not earlier.

---

## Contributing

Not yet accepting contributions. The project is in early foundational phases. Contribution guidelines will be published when the engine reaches a testable state.

---

## License

MIT — see [LICENSE](LICENSE) for details and reasoning.
