/**
 * UAS Engine — Environment Variable Manager
 *
 * Sets and removes persistent user-level environment variables on Windows.
 * Uses [Environment]::SetEnvironmentVariable to persist across reboots.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { AppliedSideEffect } from "../types";
import { Logger } from "../utils/logger";

const execAsync = promisify(exec);

/**
 * Set a persistent user-level environment variable.
 */
export async function setEnvVar(
  name: string,
  value: string,
  logger: Logger,
): Promise<AppliedSideEffect> {
  const timestamp = new Date().toISOString();

  try {
    // Capture previous value
    const previousValue = await getEnvVar(name);

    const escapedName = name.replace(/'/g, "''");
    const escapedValue = value.replace(/'/g, "''");

    await execAsync(
      `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('${escapedName}', '${escapedValue}', 'User')"`,
      { windowsHide: true },
    );

    // Update current process environment
    process.env[name] = value;

    logger.info({ name, value }, "Set environment variable");

    return {
      type: "env_set",
      target: name,
      value,
      previous_value: previousValue || undefined,
      applied: true,
      applied_at: timestamp,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { name, error: message },
      "Failed to set environment variable",
    );
    return {
      type: "env_set",
      target: name,
      value,
      applied: false,
      applied_at: timestamp,
    };
  }
}

/**
 * Remove a persistent user-level environment variable.
 * Passing null/empty to SetEnvironmentVariable removes it.
 */
export async function removeEnvVar(
  name: string,
  logger: Logger,
): Promise<boolean> {
  try {
    const escapedName = name.replace(/'/g, "''");
    await execAsync(
      `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('${escapedName}', $null, 'User')"`,
      { windowsHide: true },
    );

    delete process.env[name];

    logger.info({ name }, "Removed environment variable");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { name, error: message },
      "Failed to remove environment variable",
    );
    return false;
  }
}

/**
 * Restore a previously saved environment variable value.
 */
export async function restoreEnvVar(
  name: string,
  previousValue: string | undefined,
  logger: Logger,
): Promise<boolean> {
  if (previousValue === undefined) {
    return removeEnvVar(name, logger);
  }

  const result = await setEnvVar(name, previousValue, logger);
  return result.applied;
}

/**
 * Get current value of a user-level environment variable.
 */
async function getEnvVar(name: string): Promise<string | null> {
  try {
    const escapedName = name.replace(/'/g, "''");
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('${escapedName}', 'User')"`,
      { windowsHide: true },
    );
    const value = stdout.trim();
    return value || null;
  } catch {
    return null;
  }
}
