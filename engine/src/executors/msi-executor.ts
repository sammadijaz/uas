/**
 * UAS Engine — MSI Executor
 *
 * Handles Windows Installer (.msi) packages via msiexec.
 * MSI is the most structured installer format on Windows.
 * Exit code 3010 means success but reboot required.
 */

import { spawn } from "child_process";
import { InstallRecipe } from "../types";
import { BaseExecutor, ExecutorContext, ExecutorResult } from "./base-executor";
import { isElevated, runElevated } from "../utils/elevation";
import { resolveVariables } from "../utils/variables";

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

    // Build msiexec arguments
    const args: string[] = ["/i", downloaded_file, "/qn"]; // /qn = quiet, no UI

    // Add MSI properties
    if (msiOpts.properties) {
      for (const [key, value] of Object.entries(msiOpts.properties)) {
        const resolvedValue = resolveVariables(value);
        args.push(`${key}=${resolvedValue}`);
      }
    }

    // Install directory override
    if (context.install_dir_override) {
      args.push(`INSTALLDIR=${context.install_dir_override}`);
    }

    logger.info(
      { msi: downloaded_file, args },
      `MSI install: ${recipe.name} v${recipe.version}`,
    );

    if (dry_run) {
      return {
        success: true,
        exit_code: 0,
        reboot_required: false,
        message: `[DRY RUN] Would execute: msiexec ${args.join(" ")}`,
        files_created: [],
      };
    }

    // MSI installs almost always need elevation for Program Files
    if (recipe.requirements.admin) {
      const elevated = await isElevated();
      if (!elevated) {
        logger.info("Requesting elevation for MSI installer");
        const exitCode = await runElevated("msiexec.exe", args);
        const reboot = exitCode === 3010;
        return {
          success: exitCode === 0 || reboot,
          exit_code: exitCode,
          reboot_required: reboot,
          message: reboot
            ? `Installed ${recipe.name} v${recipe.version} (reboot required)`
            : exitCode === 0
              ? `Installed ${recipe.name} v${recipe.version} (elevated)`
              : `MSI installer failed with exit code ${exitCode}`,
          files_created: [],
        };
      }
    }

    // Run msiexec directly
    return new Promise<ExecutorResult>((resolve) => {
      const child = spawn("msiexec.exe", args, {
        stdio: "ignore",
        windowsHide: true,
      });

      child.on("close", (code) => {
        const exitCode = code ?? 1;
        const reboot = exitCode === 3010;
        resolve({
          success: exitCode === 0 || reboot,
          exit_code: exitCode,
          reboot_required: reboot,
          message: reboot
            ? `Installed ${recipe.name} v${recipe.version} (reboot required)`
            : exitCode === 0
              ? `Installed ${recipe.name} v${recipe.version}`
              : `MSI installer exited with code ${exitCode}`,
          files_created: [],
        });
      });

      child.on("error", (err) => {
        resolve({
          success: false,
          exit_code: -1,
          reboot_required: false,
          message: `Failed to launch msiexec: ${err.message}`,
          files_created: [],
        });
      });
    });
  }
}
