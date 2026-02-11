# UAS Infrastructure

> **Status:** ⬜ Phase 7 — Not started
> **Depends on:** All other components

## Purpose

Build, release, and distribution tooling for UAS itself.

## Responsibilities

- CI/CD pipelines (build, test, release)
- Release strategy and versioning
- Binary signing (code signing certificates)
- Auto-update mechanism for UAS
- Installer for UAS itself (bootstrapping)

## Key Challenges

- **Self-bootstrapping:** UAS installs apps, but UAS itself needs an installer
- **Code signing:** Windows SmartScreen blocks unsigned binaries
- **Auto-updates:** UAS needs to update itself without breaking its own state DB
- **CI on Windows:** GitHub Actions Windows runners have quirks

## Implementation

_Will be built when Phase 7 begins._
