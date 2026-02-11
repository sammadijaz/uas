# Contributing to the UAS Catalog

Thank you for helping grow the UAS catalog! This guide explains how to write and submit install recipes.

## Quick Start

1. Fork the repository
2. Create a new directory under `recipes/` with your app's ID
3. Write a `recipe.yaml` following the schema
4. Validate with `npm run validate`
5. Submit a pull request

## Recipe Structure

Each recipe lives in its own directory:

```
recipes/
  my-app/
    recipe.yaml
```

## Writing a Recipe

### Required Fields

| Field          | Description                     | Example                       |
| -------------- | ------------------------------- | ----------------------------- |
| `id`           | Lowercase kebab-case identifier | `my-app`                      |
| `name`         | Human-readable display name     | `My Application`              |
| `description`  | One-line description            | `A great tool for developers` |
| `homepage`     | Official website URL            | `https://myapp.dev`           |
| `license`      | SPDX license identifier         | `MIT`                         |
| `version`      | Semantic version                | `1.2.3`                       |
| `installer`    | Installer configuration         | (see below)                   |
| `metadata`     | Categories, tags, maintainer    | (see below)                   |
| `requirements` | OS, arch, admin, dependencies   | (see below)                   |

### Installer Types

| Type       | Use When                                            |
| ---------- | --------------------------------------------------- |
| `exe`      | App has a `.exe` installer (Inno Setup, NSIS, etc.) |
| `msi`      | App has a `.msi` Windows Installer package          |
| `zip`      | App is distributed as a `.zip` archive              |
| `portable` | App is a single executable or self-contained folder |

### SHA-256 Checksums

Every recipe **must** include a SHA-256 checksum. To compute one:

```powershell
# PowerShell
Get-FileHash -Algorithm SHA256 .\installer.exe | Select-Object -ExpandProperty Hash
```

```bash
# Git Bash / WSL
sha256sum installer.exe
```

### Path Variables

Use variables instead of hardcoded paths:

| Variable              | Resolves To                     |
| --------------------- | ------------------------------- |
| `${LOCALAPPDATA}`     | `C:\Users\X\AppData\Local`      |
| `${APPDATA}`          | `C:\Users\X\AppData\Roaming`    |
| `${USERPROFILE}`      | `C:\Users\X`                    |
| `${PROGRAMFILES}`     | `C:\Program Files`              |
| `${PROGRAMFILES_X86}` | `C:\Program Files (x86)`        |
| `${TEMP}`             | `C:\Users\X\AppData\Local\Temp` |
| `${UAS_APPS}`         | UAS managed app directory       |

## Validation Rules

1. **id** must be lowercase kebab-case, 2-64 characters
2. **installer.url** must be HTTPS (HTTP is rejected)
3. **installer.sha256** must be a 64-character hex string
4. **Registry side effects** require `requirements.admin: true`
5. **PATH entries** must use variables, not hardcoded absolute paths
6. **No shell commands** — recipes are declarative only

## Validation

Before submitting, validate your recipe:

```bash
cd catalog
npm run validate
```

This checks all recipes against the JSON Schema and semantic rules.

## Review Checklist

- [ ] Recipe YAML parses without errors
- [ ] `npm run validate` passes
- [ ] SHA-256 checksum is correct for the download URL
- [ ] Silent install arguments are tested on a clean Windows machine
- [ ] Side effects are complete and accurate
- [ ] Description is clear and concise
- [ ] Categories and tags are appropriate
