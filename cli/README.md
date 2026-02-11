# UAS CLI Tool

> **Status:** ✅ Phase 3 — Complete
> **Depends on:** Phase 2 (engine)

## Purpose

The CLI is a command-line interface for UAS. It wraps the install engine, providing terminal-friendly commands for installing apps, managing profiles, and syncing state.

## Commands

```
uas install <app>              Install an app from the catalog
uas install <app> --version    Install specific version
uas install <app> --dry-run    Preview without installing
uas install <app> --force      Force reinstall
uas uninstall <app>            Uninstall a tracked app
uas uninstall <app> --dry-run  Preview removal
uas status                     Show all installed apps
uas status <app>               Show details for one app
uas search <query>             Search the catalog
uas search --list              List all available apps
uas profile apply <file>       Install all apps in a profile
uas profile diff <file>        Show what a profile would change
uas profile export [file]      Export current state as profile YAML
uas sync                       Sync with backend (Phase 5)
uas login                      Authenticate (Phase 5)
uas logout                     Clear credentials (Phase 5)
```

## Architecture

```
src/
  index.ts             Entry point — registers all commands via Commander
  config.ts            Paths, defaults, engine option builder
  output.ts            Colors (chalk), spinners (ora), tables (cli-table3)
  catalog.ts           Load/search recipe YAMLs from local catalog dir
  commands/
    install.ts         Install command — delegates to engine.install()
    uninstall.ts       Uninstall command — delegates to engine.uninstall()
    status.ts          Status display — reads from engine state
    search.ts          Catalog search — filters by name/tag/description
    profile.ts         Profile apply/diff/export — batch operations
    sync.ts            Sync stub (Phase 5)
    login.ts           Login/logout stubs (Phase 5)
```

## Boundaries

- The CLI is a **thin wrapper** around the engine
- The CLI **never** installs software directly — it delegates to the engine
- All installation state lives in the engine's SQLite database
- Output formatting is centralized in `output.ts`
- The CLI is feature-equivalent with the future Desktop app

## Data Directory

All UAS data lives under `~/.uas/`:

```
~/.uas/
  state.db        SQLite state database
  downloads/      Cached installers
  catalog/        Local recipe YAML files
  profiles/       User profile YAML files
  apps/           Portable app installations
  logs/           Log files
  auth.json       Auth token (Phase 5)
```
