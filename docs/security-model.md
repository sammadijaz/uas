# UAS Security Model

> Last updated: Phase 0 — Project Foundation
> Status: Initial threat model. Will be refined as components are built.

---

## Principles

1. **Least privilege by default.** UAS runs as the current user. Admin elevation is requested per-operation, never blanket.
2. **Untrusted input everywhere.** Catalog recipes, backend responses, user input — all are validated before use.
3. **Transparency over convenience.** The user always knows what UAS is about to do. No hidden side effects.
4. **Fail closed.** If validation fails, the operation stops. No "try anyway" paths.

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│                  TRUSTED ZONE                    │
│                                                  │
│  ┌──────────┐    ┌──────────┐                   │
│  │  Engine   │    │ State DB │                   │
│  │ (local)   │    │ (SQLite) │                   │
│  └──────────┘    └──────────┘                   │
│                                                  │
└─────────────┬───────────────────────────────────┘
              │
    ══════════╪════════════  Trust Boundary  ══════
              │
┌─────────────▼───────────────────────────────────┐
│               UNTRUSTED ZONE                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Catalog  │  │ Backend  │  │ Downloaded   │  │
│  │ recipes  │  │ API      │  │ installers   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Boundary 1: Catalog Recipes → Engine
- Recipes are YAML files that describe installation steps
- **Threat:** Malicious recipe could execute arbitrary commands, download malware, or modify system files
- **Mitigation:**
  - Schema validation (reject recipes that don't match the spec)
  - Allowed-action whitelist (recipes can only declare known installer types)
  - No arbitrary command execution in recipes (no `shell: rm -rf /`)
  - Checksum verification for downloaded files
  - Future: signing and reputation system

### Boundary 2: Backend API → Client
- The backend stores profiles and history
- **Threat:** Compromised backend could serve malicious profiles or manipulate sync data
- **Mitigation:**
  - Client validates all API responses against schemas
  - Profiles are diffed and previewed before application
  - Backend never sends executable code
  - HTTPS only
  - Authentication tokens scoped with minimal permissions

### Boundary 3: Downloaded Installers → Engine
- Installers are downloaded from URLs specified in recipes
- **Threat:** MITM attacks, compromised mirrors, tampered binaries
- **Mitigation:**
  - HTTPS-only download URLs
  - SHA-256 checksum verification (checksum stored in recipe)
  - Optional: GPG signature verification for known publishers
  - Download to temp directory, verify before executing

### Boundary 4: User Input → CLI / Desktop
- Users provide app names, profile names, flags
- **Threat:** Injection attacks (path traversal, command injection)
- **Mitigation:**
  - Input sanitization at the CLI/GUI layer
  - Engine receives typed, validated objects — never raw strings
  - No string interpolation into shell commands

---

## Privilege Model

### Default: User Level
- UAS runs as the current Windows user
- Can install to: `%LOCALAPPDATA%`, `%USERPROFILE%`, user-writable directories
- Can modify: User-level environment variables, user-level PATH
- Can write: User-level registry keys (`HKCU`)

### Elevated: Administrator
- Required for: MSI installations to `Program Files`, system-level PATH, `HKLM` registry
- Elevation is requested **per-operation** via Windows UAC
- The engine explicitly marks which operations need elevation
- User is prompted before elevation occurs
- Dry-run mode never requests elevation

---

## Data at Rest

| Data | Location | Sensitivity | Protection |
|---|---|---|---|
| State DB | `%LOCALAPPDATA%\uas\state.db` | Medium (install history) | File permissions (user-only) |
| Auth tokens | `%LOCALAPPDATA%\uas\auth.json` | High | File permissions + future: Windows Credential Manager |
| Downloaded installers | `%TEMP%\uas\downloads\` | Low (public binaries) | Cleaned after install |
| Catalog cache | `%LOCALAPPDATA%\uas\catalog\` | Low | Refreshed on sync |

---

## Threat Summary

| Threat | Likelihood | Impact | Mitigation Status |
|---|---|---|---|
| Malicious recipe in catalog | Medium | High | ⬜ Schema validation (Phase 1), signing (future) |
| Tampered installer download | Low | Critical | ⬜ Checksum verification (Phase 2) |
| Compromised backend API | Low | Medium | ⬜ Client-side validation (Phase 5) |
| Path traversal in app names | Low | Medium | ⬜ Input sanitization (Phase 2) |
| Credential theft from disk | Medium | High | ⬜ Credential Manager integration (Phase 3) |
| Privilege escalation via engine | Low | Critical | ⬜ Per-operation elevation (Phase 2) |

---

## Future Considerations

- **Recipe signing**: Cryptographic signatures for trusted recipe authors
- **Reputation system**: Community ratings and install counts as trust signals
- **Sandboxed execution**: Running installers in restricted contexts where possible
- **Audit log**: Immutable local log of all engine actions for forensics
- **Network policy**: Allow users to restrict which domains UAS can download from
