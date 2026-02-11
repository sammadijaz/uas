# Changelog

All notable changes to the Universal App Store project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-02-11

### Added

**Engine (Phase 2)**

- Core installation engine with dry-run, execute, rollback lifecycle
- SQLite state database via sql.js (zero native dependencies)
- Recipe parser with YAML support and schema validation
- Executor framework: MSI, EXE, ZIP, portable installer types
- Template variable system (`%PROGRAMFILES%`, `%LOCALAPPDATA%`, etc.)
- Full rollback capability with state tracking
- 25 unit tests

**CLI (Phase 3)**

- Commander.js-based command-line interface
- Commands: `install`, `uninstall`, `status`, `search`, `profile apply|diff|export`
- Stub commands: `sync`, `login` (backend integration pending)
- Formatted output with Chalk colors, Ora spinners, cli-table3 tables
- Local catalog resolution
- 12 unit tests

**Catalog (Phase 4)**

- JSON Schema for install recipes with conditional validation
- AJV-based validator with 4 semantic rules
- Catalog loader with lazy indexing, text search, category/tag filtering
- Profile loader (YAML-based environment definitions)
- 5 sample recipes: Node.js, Git, Python, VS Code, Rust
- 1 sample profile: `frontend-dev`
- CLI batch validation tool (`validate.ts`)
- Recipe contribution guide
- 40 unit tests

**Backend API (Phase 5)**

- Express 4 REST API with Helmet security headers
- JWT authentication with bcrypt password hashing
- Zod request validation on all endpoints
- CRUD: users, profiles, machines, install history
- SQLite persistence via sql.js
- Health check endpoint
- Environment-based configuration
- Graceful shutdown (SIGINT/SIGTERM)
- 27 integration tests (Supertest)

**Desktop App (Phase 6)**

- Electron 33 with strict security (contextIsolation, CSP)
- Catalog browser with search (200ms debounce) and category filtering
- App detail modal with installer info, side effects, metadata
- Profile manager
- Settings view (system info, paths)
- Dark theme UI
- IPC-only communication (preload bridge pattern)
- 13 unit tests

**Infrastructure (Phase 7)**

- GitHub Actions CI pipeline (matrix: 5 packages on Windows)
- GitHub Actions release pipeline (tag → build → draft release)
- Build and test scripts (PowerShell + Bash)
- Multi-stage Docker image for backend
- Docker Compose development stack
- NSIS installer configuration (per-user, no admin)
- Bootstrap PowerShell script (one-liner install)
- Auto-update client (GitHub Releases, semver comparison)
- Update configuration with stable/beta channels

**Documentation (Phases 0–1)**

- Architecture document with component boundaries
- Security model with trust boundaries and threat analysis
- Glossary of canonical terminology
- Formal specs: install recipe, profile, execution lifecycle
- Getting started guide (GUIDE.md)
- Contributing guide (CONTRIBUTING.md)
- Per-component READMEs

### Project Stats

- **5 packages**, all independently buildable and testable
- **117 tests**, all passing
- **0 external services required** — works completely offline
- **0 native dependencies** — pure JavaScript/TypeScript stack
