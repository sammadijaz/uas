# UAS Desktop Application

> **Status:** ⬜ Phase 6 — Not started
> **Depends on:** Phase 2 (engine), Phase 4 (catalog), Phase 5 (backend)

## Purpose

The Desktop app is a graphical interface for UAS. It provides visual catalog browsing, profile management, install progress tracking, and log viewing.

## Responsibilities

- Browse and search the app catalog
- Create, edit, and apply profiles
- Trigger installations and show progress
- Display logs and installation history
- Sync with the backend

## Boundaries

- The Desktop app is a **controller and viewer only**
- It **never** bypasses the engine to install software directly
- It must be **feature-equivalent** with the CLI
- The engine runs locally — the Desktop app calls it in-process

## Technology

Framework decision (Electron vs Tauri) deferred until Phase 6.

## Implementation

_Will be built when Phase 6 begins._
