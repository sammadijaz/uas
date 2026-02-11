/**
 * UAS CLI — Configuration
 *
 * Central location for all CLI paths, defaults, and environment detection.
 * All UAS data lives under ~/.uas (i.e., %USERPROFILE%\.uas on Windows).
 */

import * as path from "path";
import * as os from "os";
import * as fs from "fs";

/** Root data directory: ~/.uas */
export const UAS_HOME = path.join(os.homedir(), ".uas");

/** Default paths derived from UAS_HOME */
export const paths = {
  /** SQLite state database */
  stateDb: path.join(UAS_HOME, "state.db"),
  /** Downloaded installers cache */
  downloads: path.join(UAS_HOME, "downloads"),
  /** Local catalog mirror */
  catalog: path.join(UAS_HOME, "catalog"),
  /** User profiles directory */
  profiles: path.join(UAS_HOME, "profiles"),
  /** Portable apps directory */
  apps: path.join(UAS_HOME, "apps"),
  /** Log files */
  logs: path.join(UAS_HOME, "logs"),
  /** Auth token file */
  authToken: path.join(UAS_HOME, "auth.json"),
};

/**
 * Ensure all required UAS directories exist.
 */
export function ensureDirectories(): void {
  for (const [key, dirPath] of Object.entries(paths)) {
    // Skip files (auth token, state db)
    if (key === "authToken" || key === "stateDb") continue;
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Build EngineOptions from CLI configuration.
 */
export function getEngineOptions(
  verbose: boolean = false,
  dryRun: boolean = false,
) {
  ensureDirectories();
  return {
    state_db_path: paths.stateDb,
    catalog_path: paths.catalog,
    download_dir: paths.downloads,
    dry_run: dryRun,
    verbose,
  };
}
