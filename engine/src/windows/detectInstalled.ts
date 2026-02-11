/**
 * UAS Engine — Detect Already-Installed Software
 *
 * Before running an installer, check whether the software is already present
 * at the target version. This prevents redundant installs and makes the
 * pipeline idempotent.
 *
 * Detection strategies (tried in order):
 * 1. App state file (~/.uas/state/<app>.json)
 * 2. Version command (e.g., `node --version`)
 * 3. Windows registry (HKLM + HKCU Uninstall keys)
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { Logger } from "../utils/logger";
import { AppStateFile, DetectionResult } from "./types";

const execAsync = promisify(exec);

// ─── State File ────────────────────────────────────────────────

const STATE_DIR = path.join(os.homedir(), ".uas", "state");

/**
 * Get the path to an app's state file.
 */
export function getStateFilePath(appId: string): string {
  return path.join(STATE_DIR, `${appId}.json`);
}

/**
 * Read the persisted state for an app. Returns null if no state file exists.
 */
export function readAppState(appId: string): AppStateFile | null {
  const filePath = getStateFilePath(appId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as AppStateFile;
  } catch {
    return null;
  }
}

/**
 * Write (or update) the persisted state for an app.
 */
export function writeAppState(appId: string, state: AppStateFile): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const filePath = getStateFilePath(appId);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Remove the persisted state for an app.
 */
export function removeAppState(appId: string): void {
  const filePath = getStateFilePath(appId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ─── Version Command Detection ────────────────────────────────

/**
 * Try to detect an installed version by running a command (e.g., `node --version`).
 *
 * @param versionCmd - Command to run (e.g., "node --version")
 * @param versionRegex - Regex to extract version (e.g., "v(\\d+\\.\\d+\\.\\d+)")
 * @returns Detected version string, or null if command failed / pattern didn't match
 */
export async function detectVersionByCommand(
  versionCmd: string,
  versionRegex: string,
  logger: Logger,
): Promise<string | null> {
  if (!versionCmd) return null;

  try {
    const { stdout } = await execAsync(versionCmd, {
      windowsHide: true,
      timeout: 10000,
    });

    if (versionRegex) {
      const regex = new RegExp(versionRegex);
      const match = stdout.match(regex);
      if (match && match[1]) {
        logger.debug(
          { cmd: versionCmd, detected: match[1] },
          "Version detected via command",
        );
        return match[1];
      }
    }

    // If no regex, command success means *something* is installed but version unknown
    return "unknown";
  } catch {
    logger.debug({ cmd: versionCmd }, "Version command failed (app likely not installed)");
    return null;
  }
}

// ─── Registry Detection ────────────────────────────────────────

/**
 * Well-known registry paths where Windows tracks installed software.
 */
const UNINSTALL_KEYS = [
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

/**
 * Search the Windows Uninstall registry for a matching app.
 *
 * @param appName - Display name to search for (case-insensitive substring match)
 * @returns Detected version, or null
 */
export async function detectVersionByRegistry(
  appName: string,
  logger: Logger,
): Promise<string | null> {
  for (const key of UNINSTALL_KEYS) {
    try {
      const { stdout } = await execAsync(
        `reg query "${key}" /s /f "${appName}" /d`,
        { windowsHide: true, timeout: 15000 },
      );

      // Look for DisplayVersion in the output
      const versionMatch = stdout.match(/DisplayVersion\s+REG_SZ\s+(\S+)/i);
      if (versionMatch && versionMatch[1]) {
        logger.debug(
          { registryKey: key, version: versionMatch[1] },
          "Version detected via registry",
        );
        return versionMatch[1];
      }
    } catch {
      // Key not found or access denied — try next
      continue;
    }
  }

  return null;
}

// ─── Combined Detection ────────────────────────────────────────

export interface DetectInstalledOptions {
  /** Recipe app ID */
  appId: string;
  /** Recipe display name (for registry search) */
  appName: string;
  /** Version command (e.g., "node --version") */
  versionCmd?: string;
  /** Regex to extract version from command output */
  versionRegex?: string;
  /** The target version we want to install */
  targetVersion: string;
  /** Logger */
  logger: Logger;
}

/**
 * Detect whether an application is already installed.
 *
 * Checks in order:
 * 1. UAS state file (~/.uas/state/<app>.json)
 * 2. Version command
 * 3. Windows registry
 *
 * Returns a DetectionResult indicating whether install can be skipped.
 */
export async function detectInstalled(
  opts: DetectInstalledOptions,
): Promise<DetectionResult> {
  const { appId, appName, versionCmd, versionRegex, targetVersion, logger } = opts;

  // 1. State file
  const state = readAppState(appId);
  if (state && state.version === targetVersion) {
    logger.info(
      { appId, version: state.version, source: "state_file" },
      "Already installed (state file match). Skipping.",
    );
    return {
      found: true,
      version: state.version,
      source: "state_file",
      details: `State file: ${getStateFilePath(appId)}`,
    };
  }

  // 2. Version command
  if (versionCmd) {
    const detected = await detectVersionByCommand(versionCmd, versionRegex || "", logger);
    if (detected && detected === targetVersion) {
      logger.info(
        { appId, version: detected, source: "version_cmd" },
        "Already installed (version command match). Skipping.",
      );
      return {
        found: true,
        version: detected,
        source: "version_cmd",
        details: `Command: ${versionCmd}`,
      };
    }
    // If detected but different version, we still install (upgrade/downgrade)
    if (detected) {
      logger.info(
        { appId, installedVersion: detected, targetVersion },
        "Different version detected — will proceed with install",
      );
    }
  }

  // 3. Registry
  const regVersion = await detectVersionByRegistry(appName, logger);
  if (regVersion && regVersion === targetVersion) {
    logger.info(
      { appId, version: regVersion, source: "registry" },
      "Already installed (registry match). Skipping.",
    );
    return {
      found: true,
      version: regVersion,
      source: "registry",
      details: "Windows Uninstall registry",
    };
  }

  logger.debug({ appId, targetVersion }, "App not detected at target version — install needed");
  return { found: false };
}
