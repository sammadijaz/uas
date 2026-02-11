/**
 * UAS Engine — PATH Manager
 *
 * Manages additions and removals from the Windows PATH environment variable.
 * Operates on user-level PATH by default, system PATH requires elevation.
 *
 * Windows stores PATH in the registry:
 *   User PATH: HKCU\Environment\Path
 *   System PATH: HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment\Path
 */

import { exec } from "child_process";
import { promisify } from "util";
import { AppliedSideEffect } from "../types";
import { Logger } from "../utils/logger";

const execAsync = promisify(exec);

/**
 * Add a directory to the user's PATH.
 *
 * @param directory - Directory to add (absolute path)
 * @param logger - Logger instance
 * @returns The applied side effect record
 */
export async function addToPath(
  directory: string,
  logger: Logger,
): Promise<AppliedSideEffect> {
  const timestamp = new Date().toISOString();

  try {
    // Read current user PATH from registry (more reliable than process.env)
    const currentPath = await getUserPath();

    // Check if already in PATH
    const pathEntries = currentPath
      .split(";")
      .map((p) => p.toLowerCase().trim())
      .filter(Boolean);
    if (pathEntries.includes(directory.toLowerCase().trim())) {
      logger.debug({ directory }, "Directory already in PATH, skipping");
      return {
        type: "path_add",
        target: "User PATH",
        value: directory,
        previous_value: currentPath,
        applied: true,
        applied_at: timestamp,
      };
    }

    // Append to PATH
    const newPath = currentPath ? `${currentPath};${directory}` : directory;
    await setUserPath(newPath);

    // Also update current process environment so subsequent operations see it
    process.env.PATH = `${process.env.PATH};${directory}`;

    logger.info({ directory }, "Added to PATH");

    return {
      type: "path_add",
      target: "User PATH",
      value: directory,
      previous_value: currentPath,
      applied: true,
      applied_at: timestamp,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ directory, error: message }, "Failed to add to PATH");
    return {
      type: "path_add",
      target: "User PATH",
      value: directory,
      applied: false,
      applied_at: timestamp,
    };
  }
}

/**
 * Remove a directory from the user's PATH.
 * Used during rollback.
 */
export async function removeFromPath(
  directory: string,
  logger: Logger,
): Promise<boolean> {
  try {
    const currentPath = await getUserPath();
    const entries = currentPath.split(";").filter(Boolean);
    const filtered = entries.filter(
      (entry) => entry.toLowerCase().trim() !== directory.toLowerCase().trim(),
    );

    if (filtered.length === entries.length) {
      logger.debug({ directory }, "Directory not in PATH, nothing to remove");
      return true;
    }

    await setUserPath(filtered.join(";"));

    logger.info({ directory }, "Removed from PATH");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ directory, error: message }, "Failed to remove from PATH");
    return false;
  }
}

/**
 * Read the current user PATH from the registry.
 */
async function getUserPath(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\"",
      { windowsHide: true },
    );
    return stdout.trim();
  } catch {
    return process.env.PATH || "";
  }
}

/**
 * Set the user PATH in the registry.
 * This persists across reboots (unlike process.env changes).
 */
async function setUserPath(newPath: string): Promise<void> {
  const escapedPath = newPath.replace(/'/g, "''");
  await execAsync(
    `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', '${escapedPath}', 'User')"`,
    { windowsHide: true },
  );
}
