/**
 * UAS Engine — Base Executor Interface
 *
 * Every installer type (exe, msi, zip, portable) implements this interface.
 * Executors focus ONLY on running the installer — they don't handle
 * downloads, verification, side effects, or state tracking.
 */

import { InstallRecipe, InstallerType } from "../types";
import { Logger } from "../utils/logger";

export interface ExecutorResult {
  success: boolean;
  /** Directory where the application was installed */
  install_dir?: string;
  /** Exit code from the installer process (if applicable) */
  exit_code?: number;
  /** Whether a system reboot is needed */
  reboot_required: boolean;
  /** Human-readable message */
  message: string;
  /** Files that were created (for tracking) */
  files_created: string[];
}

export interface ExecutorContext {
  /** Absolute path to the downloaded installer file */
  downloaded_file: string;
  /** Logger instance */
  logger: Logger;
  /** Is this a dry run? If true, executor should NOT make changes */
  dry_run: boolean;
  /** Override install directory (optional) */
  install_dir_override?: string;
}

/**
 * Abstract base for all executor implementations.
 */
export abstract class BaseExecutor {
  abstract readonly type: InstallerType;

  /**
   * Execute the installation.
   *
   * @param recipe - The install recipe
   * @param context - Execution context (file path, logger, dry_run flag)
   * @returns Result of the execution
   */
  abstract execute(
    recipe: InstallRecipe,
    context: ExecutorContext,
  ): Promise<ExecutorResult>;

  /**
   * Validate that the recipe has the required options for this executor type.
   * Called during the VALIDATING state.
   */
  abstract validate(recipe: InstallRecipe): string[];
}
