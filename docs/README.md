# UAS Documentation

This folder contains all project-level documentation for the Universal App Store.

## Contents

| Document | Purpose |
|---|---|
| [architecture.md](architecture.md) | System architecture, component boundaries, data flow |
| [glossary.md](glossary.md) | Canonical terminology — every term used across UAS |
| [security-model.md](security-model.md) | Trust boundaries, threat model, privilege requirements |
| [specs/](specs/) | Formal specifications for recipes, profiles, lifecycle |

## Rules

1. **Documentation is not optional.** Every behavioral change must update docs.
2. **Specs are contracts.** Code must conform to specs, not the other way around.
3. **Glossary is law.** If a term isn't in the glossary, define it before using it.
4. **No stale docs.** If you find outdated documentation, fix it or file an issue.

## Diagram Conventions

Architecture diagrams use ASCII box-drawing characters for portability. No external tooling required to read them.

```
┌──────────┐     ─── depends on ──▶    ┌──────────┐
│Component │                            │Component │
└──────────┘     ◀── calls back ───    └──────────┘
```
