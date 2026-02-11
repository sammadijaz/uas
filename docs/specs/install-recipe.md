# Install Recipe Specification

> Version: 1.0-draft
> Status: Phase 1 — Contract definition
> Last updated: Phase 1

---

## Overview

An **install recipe** is a YAML file that describes how to install a single application on Windows. Recipes are the atomic unit of the UAS catalog. They are declarative — they describe *what* to install and *how*, but don't contain executable code.

---

## File Location

```
/catalog/recipes/<app-id>/recipe.yaml
```

The `<app-id>` is a lowercase, kebab-case identifier (e.g., `node`, `visual-studio-code`, `git`).

---

## Schema

```yaml
# ─── Identity ────────────────────────────────────────────
id: string                    # Unique app identifier (kebab-case, lowercase)
name: string                  # Human-readable display name
description: string           # One-line description
homepage: string              # Official website URL
license: string               # SPDX license identifier (e.g., "MIT", "Apache-2.0")

# ─── Version ─────────────────────────────────────────────
version: string               # Semantic version (e.g., "20.11.1")
version_cmd: string           # Command to check installed version (e.g., "node --version")
version_regex: string         # Regex to extract version from command output

# ─── Installer ────────────────────────────────────────────
installer:
  type: enum                  # One of: exe, msi, zip, portable
  url: string                 # HTTPS download URL
  sha256: string              # SHA-256 checksum of the downloaded file
  size_bytes: number          # Expected file size (optional, for progress)

  # Type-specific options:

  # For type: exe
  exe:
    silent_args: string[]     # Arguments for silent installation (e.g., ["/S", "/VERYSILENT"])
    install_dir_arg: string   # Argument to specify install directory (optional)

  # For type: msi
  msi:
    properties: object        # MSI property overrides (e.g., { INSTALLDIR: "..." })

  # For type: zip
  zip:
    extract_to: string        # Path to extract to (supports variables)
    strip_root: boolean       # Strip the root directory from the archive (default: false)

  # For type: portable
  portable:
    copy_to: string           # Destination directory (supports variables)
    executable: string        # Name of the executable file within the archive/download

# ─── Side Effects ─────────────────────────────────────────
side_effects:
  path:
    add: string[]             # Directories to add to PATH (supports variables)
  env:
    set: object               # Environment variables to set (key:value pairs)
  registry:
    - key: string             # Registry key path
      value_name: string      # Value name
      value_data: string      # Value data
      value_type: string      # REG_SZ, REG_DWORD, etc.
  shortcuts:
    - name: string            # Shortcut display name
      target: string          # Target executable
      location: enum          # desktop, start_menu

# ─── Metadata ─────────────────────────────────────────────
metadata:
  categories: string[]        # e.g., ["runtime", "development", "editor"]
  tags: string[]              # Freeform tags for search
  maintainer: string          # Recipe maintainer (not the app author)
  updated: string             # ISO 8601 date when recipe was last updated

# ─── Requirements ─────────────────────────────────────────
requirements:
  os: string                  # Minimum Windows version (e.g., "10.0.19041")
  arch: enum                  # x64, x86, arm64
  admin: boolean              # Whether installation requires elevation (default: false)
  dependencies: string[]      # Other recipe IDs that must be installed first
```

---

## Path Variables

Recipes support the following variables in path strings:

| Variable | Resolves To | Example |
|---|---|---|
| `${LOCALAPPDATA}` | `%LOCALAPPDATA%` | `C:\Users\X\AppData\Local` |
| `${APPDATA}` | `%APPDATA%` | `C:\Users\X\AppData\Roaming` |
| `${USERPROFILE}` | `%USERPROFILE%` | `C:\Users\X` |
| `${PROGRAMFILES}` | `%PROGRAMFILES%` | `C:\Program Files` |
| `${PROGRAMFILES_X86}` | `%PROGRAMFILES(X86)%` | `C:\Program Files (x86)` |
| `${TEMP}` | `%TEMP%` | `C:\Users\X\AppData\Local\Temp` |
| `${UAS_APPS}` | UAS managed app directory | `C:\Users\X\AppData\Local\uas\apps` |

---

## Validation Rules

1. **id** — Must be lowercase, kebab-case, 1-64 characters, matching `^[a-z0-9][a-z0-9-]*[a-z0-9]$`
2. **version** — Must be a valid semver string or a recognized alias (`latest`)
3. **installer.url** — Must be HTTPS. HTTP is rejected.
4. **installer.sha256** — Must be a 64-character hex string
5. **installer.type** — Must be one of: `exe`, `msi`, `zip`, `portable`
6. **side_effects.registry** — Only allowed when `requirements.admin: true`
7. **side_effects.path.add** — Entries must use path variables, not hardcoded absolute paths
8. **requirements.arch** — Must be one of: `x64`, `x86`, `arm64`
9. **No arbitrary commands.** Recipes cannot contain shell commands, scripts, or PowerShell blocks.

---

## Example: Node.js

```yaml
id: node
name: Node.js
description: JavaScript runtime built on V8
homepage: https://nodejs.org
license: MIT

version: "20.11.1"
version_cmd: "node --version"
version_regex: "v(\\d+\\.\\d+\\.\\d+)"

installer:
  type: msi
  url: https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi
  sha256: "a1b2c3d4e5f6..."
  size_bytes: 30000000
  msi:
    properties:
      INSTALLDIR: "${PROGRAMFILES}\\nodejs"

side_effects:
  path:
    add:
      - "${PROGRAMFILES}\\nodejs"
  env:
    set:
      NODE_ENV: ""

metadata:
  categories: ["runtime", "development"]
  tags: ["javascript", "typescript", "npm"]
  maintainer: "uas-core-team"
  updated: "2024-02-01"

requirements:
  os: "10.0.0"
  arch: x64
  admin: true
  dependencies: []
```

---

## Design Decisions

### Why YAML, not JSON?
- YAML is more readable for humans who will author and review recipes
- YAML supports comments (useful for documenting unusual installer flags)
- YAML diffs cleanly in git
- Validation happens via JSON Schema (YAML is parsed to JSON for validation)

### Why no shell commands?
- Arbitrary commands are a security risk (recipe authors could run anything)
- Declarative recipes are auditable: you can see what happens by reading the YAML
- If an app truly needs custom logic, that's a signal the engine needs a new installer type

### Why sha256 is required?
- Download integrity verification is non-negotiable for security
- Without checksums, a compromised mirror could serve malware
- The recipe author computes the checksum once; every user benefits

### Why side_effects are explicit?
- The engine needs to know what changed to support rollback
- Implicit side effects (hidden PATH changes, surprise registry keys) break trust
- Explicit side effects make recipes auditable
