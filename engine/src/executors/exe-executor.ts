/**
 * UAS Engine — EXE Executor
 *
 * Handles standard Windows .exe installers.
 * Runs the installer with silent flags declared in the recipe.
 */

import { spawn } from "child_process";
import { InstallRecipe } from "../types";
import { BaseExecutor, ExecutorContext, ExecutorResult } from "./base-executor";
import { isElevated, runElevated } from "../utils/elevation";

export class ExeExecutor extends BaseExecutor {
  readonly type = "exe" as const;

  validate(recipe: InstallRecipe): string[] {
    const errors: string[] = [];

    if (!recipe.installer.exe) {
      errors.push(
        'Recipe with installer.type "exe" must have installer.exe options',
      );
    } else {
      if (
        !recipe.installer.exe.silent_args ||
        recipe.installer.exe.silent_args.length === 0
      ) {
        errors.push(
          "exe installer must declare silent_args (even if empty array)",
        );
      }
    }

    return errors;
  }

  async execute(
    recipe: InstallRecipe,
    context: ExecutorContext,
  ): Promise<ExecutorResult> {
    const { downloaded_file, logger, dry_run } = context;
    const exeOpts = recipe.installer.exe!;

    const args = [...exeOpts.silent_args];
    if (context.install_dir_override && exeOpts.install_dir_arg) {
      args.push(exeOpts.install_dir_arg + context.install_dir_override);
    }

    logger.info(
      { file: downloaded_file, args },
      `EXE install: ${recipe.name} v${recipe.version}`,
    );

    if (dry_run) {
      return {
        success: true,
        exit_code: 0,
        reboot_required: false,
        message: `[DRY RUN] Would execute: ${downloaded_file} ${args.join(" ")}`,
        files_created: [],
      };
    }

    // Check if elevation is needed
    if (recipe.requirements.admin) {
      const elevated = await isElevated();
      if (!elevated) {
        logger.info("Requesting elevation for EXE installer");
        const exitCode = await runElevated(downloaded_file, args);
        return {
          success: exitCode === 0,
          exit_code: exitCode,
          reboot_required: false,
          message:
            exitCode === 0
              ? `Installed ${recipe.name} v${recipe.version} (elevated)`
              : `EXE installer failed with exit code ${exitCode}`,
          files_created: [],
        };
      }
    }

    // Run directly
    return new Promise<ExecutorResult>((resolve) => {
      const child = spawn(downloaded_file, args, {
        stdio: "ignore",
        windowsHide: true,
      });

      child.on("close", (code) => {
        const exitCode = code ?? 1;
        resolve({
          success: exitCode === 0,
          exit_code: exitCode,
          reboot_required: false,
          message:
            exitCode === 0
              ? `Installed ${recipe.name} v${recipe.version}`
              : `EXE installer exited with code ${exitCode}`,
          files_created: [],
        });
      });

      child.on("error", (err) => {
        resolve({
          success: false,
          exit_code: -1,
          reboot_required: false,
          message: `Failed to launch EXE installer: ${err.message}`,
          files_created: [],
        });
      });
    });
  }
}
