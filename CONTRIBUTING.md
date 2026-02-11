# Contributing to UAS

Thank you for your interest in contributing to the Universal App Store. This document explains how to participate effectively.

---

## Code of Conduct

Be respectful. Be constructive. Focus on the work.

---

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/user/uas/issues) first
2. Include: OS version, Node.js version, steps to reproduce, expected vs actual behavior
3. Attach logs if relevant (`UAS_LOG_LEVEL=debug`)

### Suggesting Features

Open a discussion or issue with:

- **Problem**: What pain point does this solve?
- **Proposal**: How should it work?
- **Alternatives**: What else was considered?

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-change`
3. Make your changes following the guidelines below
4. Ensure all tests pass: `.\infra\scripts\test-all.ps1`
5. Commit with a clear message: `git commit -m "feat(engine): add ZIP extraction support"`
6. Push and open a pull request

---

## Development Setup

```powershell
git clone https://github.com/user/uas.git
cd uas
.\infra\scripts\build-all.ps1
.\infra\scripts\test-all.ps1
```

See [GUIDE.md](GUIDE.md) for detailed setup instructions.

---

## Commit Message Convention

Format: `type(scope): description`

| Type       | When to use                             |
| ---------- | --------------------------------------- |
| `feat`     | New feature                             |
| `fix`      | Bug fix                                 |
| `docs`     | Documentation only                      |
| `test`     | Adding or fixing tests                  |
| `refactor` | Code change that's not a fix or feature |
| `chore`    | Build, CI, tooling changes              |

**Scope** is the package name: `engine`, `cli`, `catalog`, `backend`, `desktop`, `infra`, `docs`.

Examples:

```
feat(catalog): add recipe for Docker Desktop
fix(engine): handle registry rollback on partial failure
test(backend): add auth rate-limiting tests
docs(guide): add troubleshooting section
```

---

## Code Standards

- **Language**: TypeScript (strict mode, ES2022 target)
- **Style**: Prettier-formatted, consistent with existing code
- **Testing**: Every new feature must include tests
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Exports**: Use barrel files (`index.ts`) for public APIs
- **Comments**: JSDoc for public functions; inline comments for non-obvious logic

### File Organization

```
src/
  index.ts        ← Public API barrel (exports only)
  <module>.ts     ← Implementation files
  types.ts        ← Shared type definitions (if needed)
tests/
  <module>.test.ts ← Tests mirror src/ structure
```

---

## Adding a Recipe

See [catalog/CONTRIBUTING.md](catalog/CONTRIBUTING.md) for recipe-specific guidelines.

Quick checklist:

- [ ] Recipe follows `schema.json`
- [ ] `id` matches folder name
- [ ] SHA256 checksum is accurate
- [ ] Silent install arguments are correct
- [ ] Verification command works
- [ ] Uninstall path is specified
- [ ] Passes `node dist/validate.js`

---

## Testing Guidelines

- Use **Vitest** for all test suites
- Test files go in `tests/` at the package root
- Name tests descriptively: `it('should reject recipe without installer URL')`
- Use `describe` blocks to group related tests
- Mock external dependencies (filesystem, network, processes)
- Backend tests use **Supertest** for HTTP integration testing
- Aim for both happy-path and error-path coverage

Run tests:

```powershell
# All packages
.\infra\scripts\test-all.ps1

# Single package
cd engine && npm test

# Watch mode
cd engine && npm run test:watch
```

---

## Pull Request Checklist

- [ ] Branch is based on latest `main`
- [ ] All packages build: `.\infra\scripts\build-all.ps1`
- [ ] All tests pass: `.\infra\scripts\test-all.ps1`
- [ ] New code includes tests
- [ ] Commit messages follow convention
- [ ] No secrets, credentials, or API keys committed
- [ ] Documentation updated if behavior changed

---

## Architecture Decisions

Decisions are documented in each component's README and in `docs/architecture.md`. Major decisions:

- **sql.js over better-sqlite3**: No native bindings = works on all platforms without node-gyp
- **CommonJS over ESM**: Maximum compatibility with existing ecosystem (Chalk v4, Commander, Electron)
- **Separate packages**: Each component is independent with its own deps, build, and tests
- **YAML recipes**: Human-readable, git-diffable, familiar to DevOps practitioners
- **Electron over Tauri**: Full Node.js access for reusing engine code directly

If you want to propose an architecture change, open an issue first to discuss.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
