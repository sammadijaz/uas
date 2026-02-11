# Execution Lifecycle Specification

> Version: 1.0-draft
> Status: Phase 1 — Contract definition
> Last updated: Phase 1

---

## Overview

The **execution lifecycle** defines the state machine that governs how the install engine processes a single app installation. Every installation transitions through a fixed sequence of states. No state can be skipped. Every transition is logged.

This lifecycle is the same regardless of whether the trigger is CLI, Desktop, or a profile apply.

---

## State Machine

```
                    ┌──────────┐
                    │  PENDING  │  ← Initial state: recipe received, not yet started
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │VALIDATING│  ← Schema + requirements check
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │RESOLVING │  ← Version resolution, download URL determination
                    └────┬─────┘
                         │
                    ┌────▼──────┐
                    │DOWNLOADING│  ← Fetch installer binary
                    └────┬──────┘
                         │
                    ┌────▼─────┐
                    │VERIFYING │  ← Checksum validation
                    └────┬─────┘
                         │
                    ┌────▼──────┐
                    │ EXECUTING │  ← Run installer (or extract archive)
                    └────┬──────┘
                         │
                    ┌────▼────────┐
                    │SIDE_EFFECTS │  ← Apply PATH, env, registry, shortcuts
                    └────┬────────┘
                         │
                    ┌────▼──────┐
                    │CONFIRMING │  ← Verify installation succeeded (version_cmd check)
                    └────┬──────┘
                         │
                    ┌────▼─────┐
                    │COMPLETED │  ← Terminal success state
                    └──────────┘

Any state can transition to:

                    ┌──────────┐
                    │  FAILED  │  ← Terminal failure state (with error details)
                    └──────────┘

                    ┌───────────┐
                    │ROLLING_BACK│ ← Triggered on failure or user request
                    └─────┬─────┘
                          │
                    ┌─────▼──────┐
                    │ROLLED_BACK │ ← Terminal state after rollback
                    └────────────┘
```

---

## States

### PENDING
- **Description:** The installation request has been received but not started
- **Entry conditions:** Engine receives a valid install request
- **Actions:** None
- **Exit:** Always transitions to VALIDATING

### VALIDATING
- **Description:** The recipe is checked against the schema and the system requirements are verified
- **Actions:**
  1. Validate recipe YAML against JSON Schema
  2. Check `requirements.os` against current Windows version
  3. Check `requirements.arch` against current system architecture
  4. Check `requirements.dependencies` against current state DB
  5. Check if already installed at requested version
- **Exit on success:** → RESOLVING
- **Exit on failure:** → FAILED (with validation error details)

### RESOLVING
- **Description:** Determine the exact version and download URL to use
- **Actions:**
  1. If version is `"latest"`, resolve to the most recent recipe version
  2. If version is a range, find the best matching recipe version
  3. Confirm the download URL is reachable (HEAD request)
- **Exit on success:** → DOWNLOADING
- **Exit on failure:** → FAILED (with resolution error details)

### DOWNLOADING
- **Description:** Download the installer file
- **Actions:**
  1. Create temp directory: `${TEMP}/uas/downloads/<app-id>/`
  2. Download file from `installer.url` with progress reporting
  3. Verify file size if `installer.size_bytes` is specified
- **Exit on success:** → VERIFYING
- **Exit on failure:** → FAILED (with download error, cleanup temp)
- **Progress:** Reports bytes downloaded / total bytes to the caller

### VERIFYING
- **Description:** Validate the downloaded file's integrity
- **Actions:**
  1. Compute SHA-256 hash of downloaded file
  2. Compare against `installer.sha256`
- **Exit on match:** → EXECUTING
- **Exit on mismatch:** → FAILED ("Checksum mismatch: expected X, got Y")

### EXECUTING
- **Description:** Run the installer or extract the archive
- **Actions (vary by type):**

  **exe:**
  1. If `requirements.admin: true`, request elevation
  2. Spawn process: `<downloaded-file> <silent_args>`
  3. Wait for exit code
  4. Exit code 0 = success; anything else = failure

  **msi:**
  1. If `requirements.admin: true`, request elevation
  2. Spawn: `msiexec /i <downloaded-file> /qn <properties>`
  3. Wait for exit code
  4. Exit code 0 = success; 3010 = success (reboot needed); else = failure

  **zip:**
  1. Extract to `zip.extract_to` (resolve path variables)
  2. If `zip.strip_root: true`, move contents up one level
  3. Verify expected files exist

  **portable:**
  1. Copy executable to `portable.copy_to` (resolve path variables)
  2. Verify executable exists and is runnable

- **Exit on success:** → SIDE_EFFECTS
- **Exit on failure:** → FAILED (with executor error details, begin rollback)

### SIDE_EFFECTS
- **Description:** Apply declared side effects to the system
- **Actions (in order):**
  1. **PATH additions:** Add directories to user PATH (or system PATH if admin)
  2. **Environment variables:** Set variables in user environment
  3. **Registry edits:** Write registry keys (requires admin)
  4. **Shortcuts:** Create shortcuts in declared locations
- **Tracking:** Each side effect is recorded in the state DB with enough detail to reverse it
- **Exit on success:** → CONFIRMING
- **Exit on failure:** → FAILED (partial side effects may have applied; state DB records what succeeded)

### CONFIRMING
- **Description:** Verify the installation actually worked
- **Actions:**
  1. Run `version_cmd` (e.g., `node --version`)
  2. Extract version from output using `version_regex`
  3. Confirm extracted version matches expected version
- **Exit on success:** → COMPLETED
- **Exit on failure:** → FAILED ("Installation appeared to succeed but version check failed")

### COMPLETED
- **Description:** Terminal success state
- **Actions:**
  1. Write installation record to state DB (app, version, timestamp, side effects)
  2. Cleanup temp files (downloaded installer)
  3. Report success to caller
- **This is a terminal state.** No further transitions.

### FAILED
- **Description:** Terminal failure state
- **Actions:**
  1. Record failure in state DB (app, error, state where failure occurred)
  2. Cleanup temp files
  3. If side effects were partially applied and rollback is enabled → ROLLING_BACK
  4. Report failure to caller with:
     - Which state failed
     - What the error was
     - What (if anything) was left behind
- **This is a terminal state** (unless transitioning to ROLLING_BACK).

### ROLLING_BACK
- **Description:** Best-effort reversal of changes made during this installation
- **Actions:**
  1. Read side effects that were applied (from state DB)
  2. Reverse in opposite order:
     - Remove shortcuts
     - Delete registry keys (only if UAS created them)
     - Remove environment variables
     - Remove PATH entries
     - Delete extracted/copied files
  3. Note: Some reversals may fail (file locked, insufficient permissions)
- **Exit:** → ROLLED_BACK (always, even if some reversals failed)

### ROLLED_BACK
- **Description:** Terminal state after rollback attempt
- **Actions:**
  1. Record rollback result in state DB (what was reversed, what wasn't)
  2. Report to caller (list of reversed and unreversed items)
- **This is a terminal state.**

---

## Dry Run Mode

In dry run mode, the engine goes through the same state transitions but **takes no actions**:

| State | Dry Run Behavior |
|---|---|
| PENDING | Same |
| VALIDATING | Full validation (schema, requirements, dependencies) |
| RESOLVING | Full resolution (version, URL) |
| DOWNLOADING | **Skipped** (HEAD request only to confirm URL is valid) |
| VERIFYING | **Skipped** |
| EXECUTING | **Skipped** (reports what would be executed) |
| SIDE_EFFECTS | **Skipped** (reports what would change) |
| CONFIRMING | **Skipped** |
| COMPLETED | Reports predicted outcome |

Dry run always returns a **plan** — a human-readable list of what would happen.

---

## State Transitions in State DB

Every state transition is recorded:

```sql
CREATE TABLE installation_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id  TEXT    NOT NULL,    -- UUID for this installation attempt
  app_id        TEXT    NOT NULL,    -- Recipe ID
  state         TEXT    NOT NULL,    -- State name
  entered_at    TEXT    NOT NULL,    -- ISO 8601 timestamp
  exited_at     TEXT,                -- ISO 8601 timestamp (null if still in state)
  result        TEXT,                -- 'success' or 'failure'
  details       TEXT,                -- JSON: error messages, side effects applied, etc.
  dry_run       INTEGER NOT NULL DEFAULT 0  -- 1 if this was a dry run
);
```

---

## Error Classification

Errors are classified to help the user understand what to do:

| Category | Example | User Action |
|---|---|---|
| `VALIDATION_ERROR` | Recipe schema invalid | Fix recipe or report to maintainer |
| `REQUIREMENT_ERROR` | Wrong architecture | Use correct recipe version |
| `NETWORK_ERROR` | Download failed | Check network, retry |
| `INTEGRITY_ERROR` | Checksum mismatch | Recipe may be outdated; report |
| `EXECUTION_ERROR` | Installer exit code != 0 | Check installer logs |
| `PERMISSION_ERROR` | Elevation denied | Run as admin or use non-admin recipe |
| `VERIFICATION_ERROR` | Version check failed | Installation may be corrupt; retry |
| `ROLLBACK_ERROR` | Could not reverse change | Manual cleanup may be needed |

---

## Design Decisions

### Why so many states?
Each state is an observable checkpoint. When an installation fails, the user (and the logs) know *exactly* where it failed. "It failed during VERIFYING" is far more actionable than "install failed."

### Why is CONFIRMING a separate state?
Just because an installer exited with code 0 doesn't mean it worked. We've all seen silent installers that "succeed" but leave nothing behind. The version check is our proof.

### Why is rollback best-effort?
A perfect rollback would require filesystem snapshots or transactional installs. That's impractical for most Windows software. Best-effort rollback that handles the common cases (PATH, env, registry, files) is pragmatic.

### Why record dry runs in the DB?
Dry runs are useful for auditing. "What was the plan?" is a question worth answering after the fact, especially in team environments.
