/**
 * UAS Engine — MSI Executor (Hardened)
 *
 * Handles Windows Installer (.msi) packages via the windows/msi module.
 *
 * This executor is now a thin adapter between the BaseExecutor interface
 * and the production-grade MSI pipeline in windows/msi.ts.
 *
 * Fixes:
 * - Proper quoting of INSTALLDIR and all MSI properties
 * - /norestart flag to prevent unexpected reboots
 * - Verbose msiexec log files for forensics
 * - Structured exit-code mapping (1639 → invalid args, etc.)
 * - Elevation via windows/elevate with clear error messages
 */

import { InstallRecipe } from "../types";
import { BaseExecutor, ExecutorContext, ExecutorResult } from "./base-executor";
import { executeMsi } from "../windows/msi";
import { checkElevation, runElevated } from "../windows/elevate";
import { lookupMsiExitCode } from "../windows/types";
import { buildMsiArgs } from "../windows/msi";

export class MsiExecutor extends BaseExecutor {
  readonly type = "msi" as const;

  validate(recipe: InstallRecipe): string[] {
    const errors: string[] = [];

    if (!recipe.installer.msi) {
      errors.push(
        'Recipe with installer.type "msi" must have installer.msi options',
      );
    }

    return errors;
  }

  async execute(
    recipe: InstallRecipe,
    context: ExecutorContext,
  ): Promise<ExecutorResult> {
    const { downloaded_file, logger, dry_run } = context;
    const msiOpts = recipe.installer.msi!;
    const displayName = `${recipe.name} v${recipe.version}`;

    // If admin required, check elevation first
    if (recipe.requirements.admin && !dry_run) {
      const elevation = await checkElevation(logger);
      if (!elevation.elevated) {
        logger.info("Requesting elevation for MSI installer");

        // Build args through the hardened builder so quoting is correct
        const { args } = buildMsiArgs({
          msiPath: downloaded_file,
          properties: msiOpts.properties,
          installDirOverride: context.install_dir_override,
          appId: recipe.id,
          displayName,
          dryRun: false,
          logger,
        });

        const result = await runElevated("msiexec.exe", args, logger);
        const info = lookupMsiExitCode(result.exitCode);

        return {
          success: info.ok,
          exit_code: result.exitCode,
          reboot_required: result.exitCode === 3010 || result.exitCode === 1641,
          message: info.ok
            ? `Installed ${displayName} (elevated)${result.exitCode === 3010 ? " — reboot required" : ""}`
            : `MSI install failed [${info.name}]: ${info.message}`,
          files_created: [],
        };
      }
    }

    // Run via the hardened MSI pipeline
    const msiResult = await executeMsi({
      msiPath: downloaded_file,
      properties: msiOpts.properties,
      installDirOverride: context.install_dir_override,
      appId: recipe.id,
      displayName,
      dryRun: dry_run,
      logger,
    });

    return {
      success: msiResult.success,
      exit_code: msiResult.exitCode,
      reboot_required: msiResult.rebootRequired,
      message: msiResult.message,
      files_created: [],
    };
  }
}
