/**
 * UAS Engine — Windows Registry Manager
 *
 * Reads and writes Windows Registry keys.
 * Registry operations always require care — incorrect edits can destabilize the system.
 *
 * UAS only writes to keys explicitly declared in recipes.
 * HKLM operations require elevation.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { AppliedSideEffect, RegistryEntry, RegistryValueType } from "../types";
import { Logger } from "../utils/logger";

const execAsync = promisify(exec);

/**
 * Map RegistryValueType to PowerShell property type names.
 */
const PS_TYPE_MAP: Record<RegistryValueType, string> = {
  REG_SZ: "String",
  REG_DWORD: "DWord",
  REG_QWORD: "QWord",
  REG_EXPAND_SZ: "ExpandString",
  REG_MULTI_SZ: "MultiString",
};

/**
 * Write a registry value.
 */
export async function writeRegistryValue(
  entry: RegistryEntry,
  logger: Logger,
): Promise<AppliedSideEffect> {
  const timestamp = new Date().toISOString();

  try {
    // Read previous value for rollback
    const previousValue = await readRegistryValue(entry.key, entry.value_name);

    const psType = PS_TYPE_MAP[entry.value_type];
    if (!psType) {
      throw new Error(`Unsupported registry value type: ${entry.value_type}`);
    }

    // Ensure the registry key path exists
    const createKeyCmd = `New-Item -Path '${entry.key}' -Force -ErrorAction SilentlyContinue | Out-Null`;

    // Set the value
    const setValueCmd = `Set-ItemProperty -Path '${entry.key}' -Name '${entry.value_name}' -Value '${entry.value_data}' -Type ${psType}`;

    const command = `${createKeyCmd}; ${setValueCmd}`;

    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${command}"`,
      { windowsHide: true },
    );

    logger.info(
      { key: entry.key, name: entry.value_name, type: entry.value_type },
      "Wrote registry value",
    );

    return {
      type: "registry_write",
      target: `${entry.key}\\${entry.value_name}`,
      value: entry.value_data,
      previous_value: previousValue || undefined,
      applied: true,
      applied_at: timestamp,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { key: entry.key, name: entry.value_name, error: message },
      "Failed to write registry value",
    );
    return {
      type: "registry_write",
      target: `${entry.key}\\${entry.value_name}`,
      value: entry.value_data,
      applied: false,
      applied_at: timestamp,
    };
  }
}

/**
 * Delete a registry value. Used during rollback.
 */
export async function deleteRegistryValue(
  key: string,
  valueName: string,
  logger: Logger,
): Promise<boolean> {
  try {
    await execAsync(
      `powershell -NoProfile -Command "Remove-ItemProperty -Path '${key}' -Name '${valueName}' -ErrorAction SilentlyContinue"`,
      { windowsHide: true },
    );
    logger.info({ key, name: valueName }, "Deleted registry value");
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { key, name: valueName, error: message },
      "Failed to delete registry value",
    );
    return false;
  }
}

/**
 * Restore a registry value to its previous state.
 */
export async function restoreRegistryValue(
  key: string,
  valueName: string,
  previousValue: string | undefined,
  valueType: RegistryValueType,
  logger: Logger,
): Promise<boolean> {
  if (previousValue === undefined) {
    return deleteRegistryValue(key, valueName, logger);
  }

  const result = await writeRegistryValue(
    {
      key,
      value_name: valueName,
      value_data: previousValue,
      value_type: valueType,
    },
    logger,
  );
  return result.applied;
}

/**
 * Read a registry value. Returns null if not found.
 */
async function readRegistryValue(
  key: string,
  valueName: string,
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "(Get-ItemProperty -Path '${key}' -Name '${valueName}' -ErrorAction Stop).'${valueName}'"`,
      { windowsHide: true },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
