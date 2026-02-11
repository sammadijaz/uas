/**
 * UAS Engine — Windows Pipeline (Barrel Export)
 *
 * All Windows-specific installation pipeline modules re-exported
 * from a single entry point.
 *
 * Usage:
 *   import { smartDownload, executeMsi, detectInstalled, ... } from "./windows";
 */

// Smart downloader (idempotent, checksum-aware)
export {
  smartDownload,
  evaluateDownload,
  type SmartDownloadOptions,
  type SmartDownloadResult,
} from "./download";

// Integrity verification
export { verifyInstaller } from "./verify";

// MSI execution (hardened)
export {
  executeMsi,
  buildMsiArgs,
  type MsiInstallOptions,
  type MsiInstallResult,
} from "./msi";

// Software detection (idempotency)
export {
  detectInstalled,
  detectVersionByCommand,
  detectVersionByRegistry,
  readAppState,
  writeAppState,
  removeAppState,
  getStateFilePath,
  type DetectInstalledOptions,
} from "./detectInstalled";

// Elevation handling
export {
  checkElevation,
  runElevated,
  ensureElevated,
} from "./elevate";

// Shared types
export {
  lookupMsiExitCode,
  MSI_EXIT_CODES,
  type MsiExitCodeInfo,
  type AppStateFile,
  type DetectionResult,
  type DownloadDecision,
  type ElevationStatus,
} from "./types";
