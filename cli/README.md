# UAS CLI Tool

> **Status:** ⬜ Phase 3 — Not started
> **Depends on:** Phase 2 (engine must exist first)

## Purpose

The CLI is a command-line interface for UAS. It wraps the install engine, providing terminal-friendly commands for installing apps, managing profiles, and syncing state.

## Planned Commands

```
uas install <app>           Install an app from the catalog
uas uninstall <app>         Uninstall a tracked app
uas profile apply <name>    Apply a profile (install all its apps)
uas profile diff <name>     Show what a profile would change
uas sync                    Sync local state with backend
uas search <query>          Search the catalog
uas status                  Show current installation state
uas login                   Authenticate with the backend
uas dry-run <command>       Preview any command without executing
```

## Boundaries

- The CLI is a **thin wrapper** around the engine
- The CLI **never** installs software directly — it delegates to the engine
- The CLI must be **feature-equivalent** with the Desktop app

## Implementation

_Will be built when Phase 3 begins._
