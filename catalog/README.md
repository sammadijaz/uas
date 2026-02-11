# UAS Catalog

> **Status:** ✅ Phase 4 — Complete

**Versioned collection of install recipes with schema validation.**

The catalog is the authoritative source of truth for what UAS can install — a structured, validated, community-maintained repository of install recipes.

---

## Architecture

```
catalog/
  schema.json            — JSON Schema for recipe validation
  recipes/
    <app-id>/
      recipe.yaml        — Install recipe
  profiles/
    <profile-id>.yaml    — Curated app sets
  src/
    validator.ts         — AJV schema + semantic validation
    loader.ts            — Catalog indexer, search, filter
    validate.ts          — CLI batch validation tool
    index.ts             — Public API barrel
  tests/
    catalog.test.ts      — 40 tests
  CONTRIBUTING.md        — Guide for writing recipes
```

## Validation Layers

1. **JSON Schema** (AJV) — structure, types, patterns, conditional `if/then` for type-specific options
2. **Semantic rules** — business logic from the spec:
   - `registry-requires-admin` — registry side effects require `requirements.admin: true`
   - `path-use-variables` — PATH entries must use `${VAR}`, not hardcoded `C:\...`
   - `no-shell-commands` — recipes are strictly declarative
   - `type-options-match` — installer type must have matching options block

## Recipe Types

| Type       | Use Case                            | Required Options                          |
| ---------- | ----------------------------------- | ----------------------------------------- |
| `exe`      | `.exe` installers (NSIS/Inno Setup) | `exe.silent_args`                         |
| `msi`      | Windows Installer packages          | `msi.properties`                          |
| `zip`      | Archive extraction                  | `zip.extract_to`                          |
| `portable` | Single executable / self-contained  | `portable.copy_to`, `portable.executable` |

## Sample Recipes

| ID       | Name    | Type     | Admin | Version |
| -------- | ------- | -------- | ----- | ------- |
| `node`   | Node.js | MSI      | Yes   | 22.14.0 |
| `git`    | Git     | EXE      | Yes   | 2.47.1  |
| `python` | Python  | EXE      | No    | 3.13.2  |
| `vscode` | VS Code | EXE      | No    | 1.97.2  |
| `rust`   | Rust    | Portable | No    | 1.84.1  |

## Usage

```typescript
import { Catalog, validateRecipe } from "@uas/catalog";

const catalog = new Catalog("./catalog");

// Search
const results = catalog.search("javascript");

// Load recipe
const recipe = catalog.loadRecipe("node");

// Validate
const result = validateRecipe(recipe);
if (!result.valid) console.log(result.errors);

// Profiles
const profiles = catalog.listProfiles();
const profile = catalog.loadProfile("frontend-dev");
```

## Scripts

```bash
npm run build       # Compile TypeScript
npm test            # Run 40 tests
npm run validate    # Validate all recipes against schema
```

Phase 4 — **Complete**. 5 sample recipes, 1 starter profile, 40 tests passing.
