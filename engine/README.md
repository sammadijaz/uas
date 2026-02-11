# UAS Install Engine

> **Status:** ⬜ Phase 2 — Not started
> **Depends on:** Phase 1 (specs must be defined first)

## Purpose

The engine is the **heart of UAS**. It is the only component that interacts with the Windows operating system to install, track, and manage software.

## Responsibilities

- Parse and validate install recipes
- Execute installers (exe, msi, zip, portable)
- Track all side effects (files, PATH, env vars, registry)
- Maintain a local SQLite state database
- Support dry-run (predict without acting)
- Support rollback (best-effort undo)

## Boundaries

- The engine has **no UI logic** — it doesn't know if it's called from CLI or GUI
- The engine **never** requests network access directly — downloads are fed to it
- The engine **exposes a programmatic API** consumed by CLI and Desktop

## Internal Architecture

_Will be documented when Phase 2 begins._

## API Surface

_Will be defined when Phase 2 begins._
