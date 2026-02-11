/**
 * UAS Engine — Side Effect Manager
 *
 * Orchestrates the application and rollback of all side effects
 * declared in an install recipe.
 *
 * Side effects are applied in order: PATH → env → registry → shortcuts
 * Rollback happens in reverse order: shortcuts → registry → env → PATH
 */

import { SideEffectsSpec, AppliedSideEffect } from "../types";
import { Logger } from "../utils/logger";
import { resolveVariables } from "../utils/variables";
import { addToPath, removeFromPath } from "./path-manager";
import { setEnvVar, restoreEnvVar } from "./env-manager";
import { writeRegistryValue, deleteRegistryValue } from "./registry-manager";
import { createShortcut, removeShortcut } from "./shortcut-manager";

export { addToPath, removeFromPath } from "./path-manager";
export { setEnvVar, removeEnvVar, restoreEnvVar } from "./env-manager";
export {
  writeRegistryValue,
  deleteRegistryValue,
  restoreRegistryValue,
} from "./registry-manager";
export { createShortcut, removeShortcut } from "./shortcut-manager";

/**
 * Apply all side effects declared in a recipe.
 *
 * @param spec - The side_effects section from the recipe
 * @param logger - Logger instance
 * @param dryRun - If true, don't actually apply changes
 * @returns Array of applied side effect records
 */
export async function applySideEffects(
  spec: SideEffectsSpec | undefined,
  logger: Logger,
  dryRun: boolean,
): Promise<AppliedSideEffect[]> {
  if (!spec) {
    logger.debug("No side effects declared in recipe");
    return [];
  }

  const applied: AppliedSideEffect[] = [];
  const timestamp = new Date().toISOString();

  // 1. PATH additions
  if (spec.path?.add) {
    for (const dir of spec.path.add) {
      const resolved = resolveVariables(dir);
      if (dryRun) {
        logger.info({ directory: resolved }, "[DRY RUN] Would add to PATH");
        applied.push({
          type: "path_add",
          target: "User PATH",
          value: resolved,
          applied: false,
          applied_at: timestamp,
        });
      } else {
        const result = await addToPath(resolved, logger);
        applied.push(result);
      }
    }
  }

  // 2. Environment variables
  if (spec.env?.set) {
    for (const [name, value] of Object.entries(spec.env.set)) {
      if (dryRun) {
        logger.info({ name, value }, "[DRY RUN] Would set env var");
        applied.push({
          type: "env_set",
          target: name,
          value,
          applied: false,
          applied_at: timestamp,
        });
      } else {
        const result = await setEnvVar(name, value, logger);
        applied.push(result);
      }
    }
  }

  // 3. Registry entries
  if (spec.registry) {
    for (const entry of spec.registry) {
      if (dryRun) {
        logger.info(
          { key: entry.key, name: entry.value_name },
          "[DRY RUN] Would write registry value",
        );
        applied.push({
          type: "registry_write",
          target: `${entry.key}\\${entry.value_name}`,
          value: entry.value_data,
          applied: false,
          applied_at: timestamp,
        });
      } else {
        const result = await writeRegistryValue(entry, logger);
        applied.push(result);
      }
    }
  }

  // 4. Shortcuts
  if (spec.shortcuts) {
    for (const shortcut of spec.shortcuts) {
      const resolvedTarget = resolveVariables(shortcut.target);
      if (dryRun) {
        logger.info(
          { name: shortcut.name, location: shortcut.location },
          "[DRY RUN] Would create shortcut",
        );
        applied.push({
          type: "shortcut_create",
          target: `${shortcut.location}/${shortcut.name}`,
          value: resolvedTarget,
          applied: false,
          applied_at: timestamp,
        });
      } else {
        const result = await createShortcut(
          shortcut.name,
          resolvedTarget,
          shortcut.location,
          logger,
        );
        applied.push(result);
      }
    }
  }

  return applied;
}

/**
 * Roll back applied side effects.
 * Processes in reverse order (shortcuts → registry → env → PATH).
 *
 * @param effects - Previously applied side effects to reverse
 * @param logger - Logger instance
 * @returns Array of effects that were successfully rolled back
 */
export async function rollbackSideEffects(
  effects: AppliedSideEffect[],
  logger: Logger,
): Promise<AppliedSideEffect[]> {
  const rolledBack: AppliedSideEffect[] = [];

  // Reverse order
  const reversed = [...effects].reverse();

  for (const effect of reversed) {
    if (!effect.applied) continue; // Skip effects that weren't actually applied

    let success = false;

    switch (effect.type) {
      case "shortcut_create":
        success = await removeShortcut(effect.target, logger);
        break;

      case "registry_write": {
        // Parse key and value name from target "key\\valueName"
        const lastSep = effect.target.lastIndexOf("\\");
        const key = effect.target.substring(0, lastSep);
        const valueName = effect.target.substring(lastSep + 1);
        if (effect.previous_value !== undefined) {
          // Restore previous value — we'd need the type, default to REG_SZ
          success = await deleteRegistryValue(key, valueName, logger);
        } else {
          success = await deleteRegistryValue(key, valueName, logger);
        }
        break;
      }

      case "env_set":
        success = await restoreEnvVar(
          effect.target,
          effect.previous_value,
          logger,
        );
        break;

      case "path_add":
        success = await removeFromPath(effect.value, logger);
        break;

      case "file_write":
        // File cleanup is handled by the engine, not side effect manager
        logger.debug(
          { file: effect.target },
          "File cleanup deferred to engine",
        );
        success = true;
        break;
    }

    if (success) {
      rolledBack.push(effect);
      logger.info(
        { type: effect.type, target: effect.target },
        "Rolled back side effect",
      );
    } else {
      logger.warn(
        { type: effect.type, target: effect.target },
        "Failed to roll back side effect",
      );
    }
  }

  return rolledBack;
}
