# UAS Desktop Application

> **Status:** ✅ Phase 6 — Complete

## Purpose

The Desktop app is a graphical interface for UAS built with Electron. It provides visual catalog browsing, profile management, install progress tracking, and system settings.

## Architecture

```
desktop/
  src/
    main/
      main.ts          — Electron main process (window, lifecycle)
      ipc.ts           — IPC handlers (bridges renderer ↔ engine/catalog)
      preload.ts       — Context bridge (secure API for renderer)
  renderer/
    index.html         — Main HTML shell
    styles.css         — Dark theme UI styles
    renderer.js        — Client-side JavaScript (vanilla, no framework)
  tests/
    desktop.test.ts    — 13 tests (IPC contracts, renderer utils)
```

## Views

| View          | Description                                              |
| ------------- | -------------------------------------------------------- |
| **Catalog**   | Browse all recipes, search, filter by category           |
| **Profiles**  | List and inspect curated profiles                        |
| **Installed** | View installed apps (placeholder for engine integration) |
| **Settings**  | System info and UAS paths                                |

## Security Model

- **Context Isolation** — renderer cannot access Node.js
- **Preload bridge** — only exposes typed IPC methods via `contextBridge`
- **No `nodeIntegration`** — strict Electron security defaults
- **CSP** — Content Security Policy in HTML meta tag

## Technology

- **Electron** — Cross-platform desktop framework
- **Vanilla HTML/CSS/JS** — Lightweight renderer (no React/Vue dependency)
- **IPC** — `ipcMain.handle` / `ipcRenderer.invoke` pattern
- **@uas/catalog** — Catalog loading and validation (linked)
- **@uas/engine** — Engine integration (linked)

## Scripts

```bash
npm run build    # Compile TypeScript
npm run dev      # Build + launch Electron
npm start        # Launch Electron (pre-built)
npm test         # Run 13 tests
npm run package  # Package with electron-builder
```

## Boundaries

- The Desktop app is a **controller and viewer only**
- It **never** bypasses the engine to install software directly
- It must be **feature-equivalent** with the CLI
- The engine runs locally — the Desktop app calls it in-process
