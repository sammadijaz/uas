# UAS App Catalog

> **Status:** ⬜ Phase 4 — Not started
> **Depends on:** Phase 1 (recipe spec must be defined first)

## Purpose

The catalog is a collection of install recipes — YAML files that describe how to install software on Windows. It is the **single source of truth** for "how to install X."

## Design Goals

- Human-readable (YAML, not JSON blobs)
- Diffable (works well with git)
- Schema-validated (every recipe checked against a JSON Schema)
- Versioned (recipes track which versions of an app they support)
- Community-maintained (with contributor guidelines and review process)

## Planned Layout

```
/catalog
  /recipes
    /node
      recipe.yaml
    /git
      recipe.yaml
    /vscode
      recipe.yaml
    ...
  schema.json         ← JSON Schema for recipe validation
  CONTRIBUTING.md     ← How to write and submit recipes
```

## Implementation

_Will be built when Phase 4 begins._
