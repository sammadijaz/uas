/**
 * UAS Desktop — IPC Handlers
 *
 * Bridges the renderer process (UI) with the engine and catalog.
 * All engine calls go through here — the renderer never accesses Node APIs directly.
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Catalog, CatalogEntry, validateRecipe } from '@uas/catalog';

// Engine types (import the types we need without full engine init here)
// Engine requires async init, so we lazy-load it

const UAS_HOME = path.join(os.homedir(), '.uas');
const CATALOG_DIR = path.join(UAS_HOME, 'catalog');
const DB_PATH = path.join(UAS_HOME, 'state.db');

let catalog: Catalog | null = null;

function getCatalog(): Catalog {
  if (!catalog) {
    // Use bundled catalog as fallback if local doesn't exist
    const catalogDir = fs.existsSync(CATALOG_DIR)
      ? CATALOG_DIR
      : path.join(__dirname, '..', '..', '..', 'catalog');
    catalog = new Catalog(catalogDir);
  }
  return catalog;
}

/**
 * Register all IPC handlers for the renderer process.
 */
export async function registerIpcHandlers(): Promise<void> {
  // ─── Catalog Handlers ───────────────────────────────────

  ipcMain.handle('catalog:search', (_event, query: string) => {
    return getCatalog().search(query);
  });

  ipcMain.handle('catalog:list', () => {
    return getCatalog().getEntries();
  });

  ipcMain.handle('catalog:get', (_event, appId: string) => {
    return getCatalog().loadRecipe(appId);
  });

  ipcMain.handle('catalog:validate', (_event, appId: string) => {
    return getCatalog().validateRecipe(appId);
  });

  ipcMain.handle('catalog:filter-category', (_event, category: string) => {
    return getCatalog().filterByCategory(category);
  });

  ipcMain.handle('catalog:filter-tag', (_event, tag: string) => {
    return getCatalog().filterByTag(tag);
  });

  // ─── Profile Handlers ──────────────────────────────────

  ipcMain.handle('profile:list', () => {
    return getCatalog().listProfiles();
  });

  ipcMain.handle('profile:load', (_event, name: string) => {
    return getCatalog().loadProfile(name);
  });

  // ─── System Info ────────────────────────────────────────

  ipcMain.handle('system:info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      homedir: os.homedir(),
      uasHome: UAS_HOME,
    };
  });

  ipcMain.handle('system:paths', () => {
    return {
      uasHome: UAS_HOME,
      catalogDir: CATALOG_DIR,
      dbPath: DB_PATH,
    };
  });
}

/**
 * Cleanup engine resources on app shutdown.
 */
export async function cleanupEngine(): Promise<void> {
  catalog = null;
}
