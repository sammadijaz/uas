/**
 * UAS Engine — Portable Executor
 *
 * Handles portable applications — standalone executables that don't
 * need an installer. Just copy to a directory and it's ready.
 */

import * as fs from "fs";
import * as path from "path";
import { InstallRecipe } from "../types";
import { BaseExecutor, ExecutorContext, ExecutorResult } from "./base-executor";
import { resolveVariables } from "../utils/variables";

export class PortableExecutor extends BaseExecutor {
  readonly type = "portable" as const;

  validate(recipe: InstallRecipe): string[] {
    const errors: string[] = [];

    if (!recipe.installer.portable) {
      errors.push(
        'Recipe with installer.type "portable" must have installer.portable options',
      );
    } else {
      if (!recipe.installer.portable.copy_to) {
        errors.push("portable installer must declare copy_to path");
      }
      if (!recipe.installer.portable.executable) {
        errors.push("portable installer must declare executable name");
      }
    }

    return errors;
  }

  async execute(
    recipe: InstallRecipe,
    context: ExecutorContext,
  ): Promise<ExecutorResult> {
    const { downloaded_file, logger, dry_run } = context;
    const portableOpts = recipe.installer.portable!;

    const copyTo =
      context.install_dir_override || resolveVariables(portableOpts.copy_to);
    const destFile = path.join(copyTo, portableOpts.executable);

    logger.info(
      { source: downloaded_file, dest: destFile },
      `Portable install: ${recipe.name} v${recipe.version}`,
    );

    if (dry_run) {
      return {
        success: true,
        exit_code: 0,
        reboot_required: false,
        message: `[DRY RUN] Would copy ${downloaded_file} → ${destFile}`,
        files_created: [],
      };
    }

    try {
      // Ensure target directory exists
      fs.mkdirSync(copyTo, { recursive: true });

      // Determine if downloaded file is the executable or an archive
      // For now: simple file copy
      fs.copyFileSync(downloaded_file, destFile);

      // Make sure the file is executable (matters less on Windows, but good practice)
      // On Windows, executability is determined by extension, not file permissions

      // Verify the file was copied
      if (!fs.existsSync(destFile)) {
        return {
          success: false,
          exit_code: 1,
          reboot_required: false,
          message: `Portable install failed: file not found after copy to ${destFile}`,
          files_created: [],
        };
      }

      return {
        success: true,
        install_dir: copyTo,
        exit_code: 0,
        reboot_required: false,
        message: `Installed ${recipe.name} v${recipe.version} to ${copyTo}`,
        files_created: [destFile],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        exit_code: 1,
        reboot_required: false,
        message: `Portable install failed: ${message}`,
        files_created: [],
      };
    }
  }
}
