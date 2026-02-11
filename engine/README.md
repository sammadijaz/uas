# UAS Install Engine

> **Status:**  Phase 2  Core implementation complete
> **Language:** TypeScript (Node.js)
> **Database:** SQLite via better-sqlite3

## Purpose

The engine is the **heart of UAS**. It is the only component that interacts with the Windows operating system to install, track, and manage software. Both the CLI and Desktop app are thin wrappers that delegate to the engine.

## Architecture

```
engine/src/
  index.ts              <- Public API (single entry point for consumers)
  types.ts              <- All TypeScript types (1:1 with specs)
  engine.ts             <- Main UASEngine class (lifecycle orchestrator)
  state-db.ts           <- SQLite state database
  downloader.ts         <- HTTPS file download with progress
  verifier.ts           <- SHA-256 checksum verification

  executors/
    index.ts            <- Executor registry
    base-executor.ts    <- Abstract executor interface
    exe-executor.ts     <- .exe installer executor
    msi-executor.ts     <- .msi installer executor (via msiexec)
    zip-executor.ts     <- .zip extraction (via PowerShell)
    portable-executor.ts<- Portable app file copy

  side-effects/
    index.ts            <- Side effect orchestrator (apply + rollback)
    path-manager.ts     <- Windows PATH modifications
    env-manager.ts      <- Environment variable management
    registry-manager.ts <- Windows Registry operations
    shortcut-manager.ts <- .lnk shortcut creation

  utils/
    variables.ts        <- Variable resolution for recipe paths
    elevation.ts        <- Windows UAC elevation helper
    logger.ts           <- Structured logging (pino)
```

## Testing

```bash
cd engine
npm install
npm test
```

## Dependencies

| Package | Purpose |
|---|---|
| better-sqlite3 | Local state database |
| yaml | Parse YAML recipes |
| ajv / ajv-formats | JSON Schema validation |
| pino | Structured logging |
