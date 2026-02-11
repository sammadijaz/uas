/**
 * UAS Engine — Windows Pipeline Types
 *
 * Shared types for the modular Windows installation pipeline.
 */

// ─── MSI Exit Codes ────────────────────────────────────────────

export interface MsiExitCodeInfo {
  code: number;
  name: string;
  category: "success" | "args" | "permission" | "fatal" | "busy" | "unknown";
  message: string;
  /** Whether this code still counts as a successful install */
  ok: boolean;
}

/**
 * Comprehensive MSI (Windows Installer) exit-code map.
 * See: https://learn.microsoft.com/en-us/windows/win32/msi/error-codes
 */
export const MSI_EXIT_CODES: Record<number, MsiExitCodeInfo> = {
  0: {
    code: 0,
    name: "ERROR_SUCCESS",
    category: "success",
    message: "Installation completed successfully.",
    ok: true,
  },
  1602: {
    code: 1602,
    name: "ERROR_INSTALL_USEREXIT",
    category: "fatal",
    message: "User cancelled the installation.",
    ok: false,
  },
  1603: {
    code: 1603,
    name: "ERROR_INSTALL_FAILURE",
    category: "fatal",
    message:
      "Fatal error during installation. Check Windows Event Log for details.",
    ok: false,
  },
  1618: {
    code: 1618,
    name: "ERROR_INSTALL_ALREADY_RUNNING",
    category: "busy",
    message: "Another MSI installation is already in progress. Wait and retry.",
    ok: false,
  },
  1619: {
    code: 1619,
    name: "ERROR_INSTALL_PACKAGE_OPEN_FAILED",
    category: "fatal",
    message: "MSI package could not be opened. File may be corrupt.",
    ok: false,
  },
  1620: {
    code: 1620,
    name: "ERROR_INSTALL_PACKAGE_INVALID",
    category: "fatal",
    message: "MSI package is invalid.",
    ok: false,
  },
  1639: {
    code: 1639,
    name: "ERROR_INVALID_COMMAND_LINE",
    category: "args",
    message:
      "Invalid command-line argument passed to msiexec. Check property syntax.",
    ok: false,
  },
  1641: {
    code: 1641,
    name: "ERROR_SUCCESS_REBOOT_INITIATED",
    category: "success",
    message: "Installation succeeded. A system restart was initiated.",
    ok: true,
  },
  3010: {
    code: 3010,
    name: "ERROR_SUCCESS_REBOOT_REQUIRED",
    category: "success",
    message: "Installation succeeded. A system restart is required.",
    ok: true,
  },
};

/**
 * Look up an MSI exit code. Returns a structured description.
 */
export function lookupMsiExitCode(code: number): MsiExitCodeInfo {
  return (
    MSI_EXIT_CODES[code] ?? {
      code,
      name: "UNKNOWN",
      category: "unknown" as const,
      message: `Unrecognised MSI exit code: ${code}`,
      ok: false,
    }
  );
}

// ─── Install State File ────────────────────────────────────────

/**
 * Per-app state file stored at ~/.uas/state/<app>.json
 * Used for idempotency checks independent of the SQLite DB.
 */
export interface AppStateFile {
  /** Installed version string */
  version: string;
  /** ISO-8601 timestamp */
  installedAt: string;
  /** Absolute path to the cached installer */
  installerPath: string;
  /** SHA-256 of the installer file */
  checksum: string;
  /** Installer method used */
  method: "msi" | "exe" | "zip" | "portable";
  /** Install directory if known */
  installDir?: string;
}

// ─── Detection Result ──────────────────────────────────────────

export interface DetectionResult {
  /** Whether the app was detected on the system */
  found: boolean;
  /** Detected version (if found) */
  version?: string;
  /** How the app was detected */
  source?: "version_cmd" | "registry" | "state_file";
  /** Extra info (registry key, command output, etc.) */
  details?: string;
}

// ─── Download Decision ─────────────────────────────────────────

export interface DownloadDecision {
  /** Whether a download is needed */
  needed: boolean;
  /** If not needed, why? */
  reason?: "cached_valid" | "exists_mismatch_redownload";
  /** Path to the existing (or to-be-written) file */
  filePath: string;
}

// ─── Elevation Status ──────────────────────────────────────────

export interface ElevationStatus {
  elevated: boolean;
  /** Whether we attempted to elevate */
  attempted?: boolean;
  /** If elevation failed, reason */
  error?: string;
}
