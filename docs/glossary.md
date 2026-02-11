# UAS Glossary

> Canonical terminology for the Universal App Store project.
> If a term is not here, it is not official. Define it here before using it in code or docs.

---

## Core Concepts

### Recipe
A YAML manifest that describes how to install a single application. Contains download URLs, installer type, expected side effects, verification steps, and metadata. Recipes live in `/catalog`.

### Profile
A declarative manifest listing a set of applications (with optional version constraints) that together define a development environment. A profile is portable — it can be applied on any Windows machine to reproduce the same toolchain.

### Catalog
The collection of all available recipes. Think of it as the package index. It is versioned, schema-validated, and community-maintained.

### Engine
The core library that parses recipes, executes installations, tracks state, and supports rollback. The engine has no UI — it is consumed by the CLI and Desktop app.

### State Database
A local SQLite database maintained by the engine. It records what is installed, when, how, and what side effects occurred. This is the source of truth for the local machine's installation state.

---

## Installation Concepts

### Installer Type
The mechanism used to install an application:
- **exe** — Standard Windows executable installer (may be silent-installable)
- **msi** — Windows Installer package (supports standard msiexec flags)
- **zip** — Archive that gets extracted to a target directory
- **portable** — A standalone executable that doesn't require installation

### Side Effect
Any change the engine makes to the system beyond placing application files:
- Files created or modified
- PATH environment variable changes
- Other environment variable changes
- Windows Registry modifications
- Shortcuts created

### Dry Run
Executing the installation logic without making any actual changes to the system. The engine reports what *would* happen. Used for previewing, debugging, and CI validation.

### Rollback
Best-effort reversal of an installation. The engine uses tracked side effects to undo changes. "Best-effort" because some changes (e.g., shared DLLs, registry entries used by other apps) may not be safely reversible.

---

## User Concepts

### Sync
The process of uploading local installation state to the backend and/or downloading a profile from the backend to apply locally. Sync bridges the gap between machines.

### Diff
A comparison between two states — e.g., what a profile expects vs. what is actually installed, or what changed between two sync points.

### Machine
A single Windows installation identified by a machine ID. UAS tracks state per-machine when syncing to the backend.

---

## System Concepts

### Trust Boundary
A security perimeter where data crosses from one trust level to another:
- **Catalog → Engine**: Recipes are untrusted input; engine must validate
- **Backend → Client**: API responses are untrusted; client must validate
- **User → CLI**: User input is untrusted; CLI must sanitize

### Elevation
Requesting Windows administrator privileges for an operation that requires them (e.g., writing to `Program Files`, running an MSI installer). UAS runs at user level by default and elevates per-operation.

### Silent Install
Running an installer with flags that suppress all UI (wizards, dialogs, progress windows). Essential for automation. Each recipe must declare the correct silent flags for its installer type.

---

## Project Structure Concepts

### Component
One of the top-level folders in the project (`engine`, `cli`, `desktop`, `backend`, `catalog`, `infra`). Each component is isolated with its own dependencies and build process.

### Spec
A formal specification document in `/docs/specs/`. Specs define contracts — data formats, interfaces, lifecycles — that code must conform to. Specs are written before code.

---

## Status Markers Used in Docs

| Marker | Meaning |
|---|---|
| ✅ | Complete |
| 🔜 | Next up |
| ⬜ | Planned but not started |
| ⚠️ | Needs attention / partially complete |
| ❌ | Blocked or removed |
