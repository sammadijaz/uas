# Profile Specification

> Version: 1.0-draft
> Status: Phase 1 — Contract definition
> Last updated: Phase 1

---

## Overview

A **profile** is a YAML manifest that declares a set of applications (with optional version constraints) forming a development environment. Profiles are portable — applying one on any Windows machine reproduces the same toolchain.

Profiles are the user-facing abstraction. While recipes describe *how* to install one app, profiles describe *what* a complete environment looks like.

---

## File Location

Profiles can live in three places:

1. **Local file** — Anywhere on disk, referenced by path
2. **Backend** — Stored remotely, synced by account
3. **Inline in catalog** — Curated starter profiles for common setups

```
# Local profile (user-created)
~/.uas/profiles/my-dev-setup.yaml

# Catalog starter profile
/catalog/profiles/frontend-dev.yaml
```

---

## Schema

```yaml
# ─── Identity ────────────────────────────────────────────
name: string                  # Human-readable profile name
id: string                    # Unique identifier (kebab-case, auto-generated if not set)
description: string           # What this profile sets up
author: string                # Who created this profile

# ─── Version ─────────────────────────────────────────────
version: string               # Profile version (semver)
schema_version: string        # Spec version this profile conforms to (e.g., "1.0")

# ─── Apps ─────────────────────────────────────────────────
apps:
  - id: string                # Recipe ID from the catalog
    version: string           # Exact version, semver range, or "latest" (default: "latest")
    optional: boolean         # If true, failure to install doesn't fail the profile (default: false)
    config: object            # App-specific config overrides (passed to recipe, optional)

# ─── Metadata ─────────────────────────────────────────────
metadata:
  created: string             # ISO 8601 timestamp
  updated: string             # ISO 8601 timestamp
  tags: string[]              # Freeform tags for search
  platform: string            # Target platform (currently always "windows")
  min_uas_version: string     # Minimum UAS version required to apply this profile
```

---

## Validation Rules

1. **name** — Required, 1-128 characters
2. **id** — If provided, must be kebab-case, 1-64 characters
3. **apps** — Must contain at least one entry
4. **apps[].id** — Must reference a valid recipe ID in the catalog
5. **apps[].version** — Must be a valid semver string, a semver range (e.g., `^20.0.0`), or `"latest"`
6. **schema_version** — Required, must match a known spec version
7. **No duplicate app IDs** — Each recipe ID appears at most once in the `apps` array
8. **Dependency order** — Apps are installed in array order; if app B depends on app A, A must come first

---

## Version Semantics

| Version String | Meaning |
|---|---|
| `"20.11.1"` | Exactly this version |
| `"^20.0.0"` | Compatible with 20.x.x (semver caret) |
| `"~20.11.0"` | Approximately 20.11.x (semver tilde) |
| `">=18.0.0"` | Any version 18 or above |
| `"latest"` | Whatever the catalog's latest recipe provides |

Version resolution happens at apply-time, not at profile-save-time. A profile with `"latest"` will install whatever version is current when applied.

---

## Example: Frontend Developer Profile

```yaml
name: Frontend Developer Setup
id: frontend-dev
description: Everything needed for modern frontend development on Windows
author: uas-core-team

version: "1.0.0"
schema_version: "1.0"

apps:
  - id: git
    version: "latest"

  - id: node
    version: "^20.0.0"

  - id: visual-studio-code
    version: "latest"

  - id: windows-terminal
    version: "latest"

  - id: docker-desktop
    version: "latest"
    optional: true

metadata:
  created: "2026-02-11T00:00:00Z"
  updated: "2026-02-11T00:00:00Z"
  tags: ["frontend", "javascript", "web"]
  platform: windows
  min_uas_version: "0.1.0"
```

---

## Profile Operations

### Apply
Install all apps in the profile that aren't already installed (or upgrade those that need it).

```
uas profile apply frontend-dev
```

**Behavior:**
1. Parse and validate the profile
2. For each app in order:
   a. Resolve version against catalog
   b. Check if already installed at a compatible version
   c. If not: install or upgrade
   d. If optional and fails: warn, continue
   e. If required and fails: stop, report error
3. Report summary

### Diff
Compare profile against current machine state.

```
uas profile diff frontend-dev
```

**Output:**
```
✅ git 2.43.0     — installed, matches profile
⬆️ node 18.19.0  — installed, but profile wants ^20.0.0
❌ vscode         — not installed
⏭️ docker-desktop — not installed (optional, can skip)
```

### Export
Generate a profile from current machine state.

```
uas profile export my-setup
```

Creates a profile YAML from whatever UAS has tracked as installed.

### Sync
Push/pull profiles to/from the backend.

```
uas sync
```

---

## Design Decisions

### Why is app order significant?
Dependencies between apps may exist (e.g., npm needs Node.js). Rather than building a complex dependency resolver, we make order explicit. The profile author knows the correct order.

### Why support "optional" apps?
Some tools are nice-to-have but not essential. Docker Desktop might require Hyper-V, which isn't available on all machines. Marking it optional lets the profile succeed even if one app can't install.

### Why version ranges, not just exact versions?
Exact versions become stale quickly. A team profile that says `node: "20.11.1"` will need constant updates. A range like `^20.0.0` says "any compatible 20.x" — much more maintainable.

### Why is sync separate from apply?
Sync is a network operation that touches the backend. Apply is a local operation. Keeping them separate means you can apply a local profile offline, and sync when convenient.
