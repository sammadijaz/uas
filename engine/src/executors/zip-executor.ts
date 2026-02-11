/**
 * UAS Engine — ZIP Executor
 *
 * Handles .zip archive installations.
 * Extracts archive to a target directory, optionally stripping the root folder.
 *
 * Uses Node.js built-in zlib — no external unzip dependency.
 * For .zip specifically, we use the 'unzipper' approach via raw stream parsing.
 * In production, we'd use a proper zip library. For now, we delegate to
 * PowerShell's Expand-Archive which is available on all modern Windows systems.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { InstallRecipe } from "../types";
import { BaseExecutor, ExecutorContext, ExecutorResult } from "./base-executor";
import { resolveVariables } from "../utils/variables";
import { Logger } from "../utils/logger";

const execAsync = promisify(exec);

export class ZipExecutor extends BaseExecutor {
  readonly type = "zip" as const;

  validate(recipe: InstallRecipe): string[] {
    const errors: string[] = [];

    if (!recipe.installer.zip) {
      errors.push(
        'Recipe with installer.type "zip" must have installer.zip options',
      );
    } else {
      if (!recipe.installer.zip.extract_to) {
        errors.push("zip installer must declare extract_to path");
      }
    }

    return errors;
  }

  async execute(
    recipe: InstallRecipe,
    context: ExecutorContext,
  ): Promise<ExecutorResult> {
    const { downloaded_file, logger, dry_run } = context;
    const zipOpts = recipe.installer.zip!;

    const extractTo =
      context.install_dir_override || resolveVariables(zipOpts.extract_to);

    logger.info(
      {
        archive: downloaded_file,
        dest: extractTo,
        stripRoot: zipOpts.strip_root,
      },
      `ZIP extract: ${recipe.name} v${recipe.version}`,
    );

    if (dry_run) {
      return {
        success: true,
        exit_code: 0,
        reboot_required: false,
        message: `[DRY RUN] Would extract ${downloaded_file} → ${extractTo}`,
        files_created: [],
      };
    }

    try {
      // Ensure target directory exists
      fs.mkdirSync(extractTo, { recursive: true });

      // Use PowerShell Expand-Archive (available on Windows 10+)
      // This is reliable, requires no npm dependencies, and handles paths with spaces
      const psCommand = [
        "Expand-Archive",
        `-Path '${downloaded_file}'`,
        `-DestinationPath '${extractTo}'`,
        "-Force",
      ].join(" ");

      await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`,
        { windowsHide: true },
      );

      // Handle strip_root: move contents from the single root folder up one level
      if (zipOpts.strip_root) {
        await this.stripRootDirectory(extractTo, logger);
      }

      // Collect created files for tracking
      const filesCreated = this.collectFiles(extractTo);

      return {
        success: true,
        install_dir: extractTo,
        exit_code: 0,
        reboot_required: false,
        message: `Extracted ${recipe.name} v${recipe.version} to ${extractTo}`,
        files_created: filesCreated,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        exit_code: 1,
        reboot_required: false,
        message: `ZIP extraction failed: ${message}`,
        files_created: [],
      };
    }
  }

  /**
   * If the zip contained a single root directory, move its contents up.
   * Example: extracting "node-v20.zip" creates "node-v20/" inside the target.
   * strip_root moves everything from "target/node-v20/*" to "target/*".
   */
  private async stripRootDirectory(dir: string, logger: Logger): Promise<void> {
    const entries = fs.readdirSync(dir);

    // Only strip if there's exactly one entry and it's a directory
    if (entries.length === 1) {
      const rootDir = path.join(dir, entries[0]);
      if (fs.statSync(rootDir).isDirectory()) {
        logger.debug({ rootDir }, "Stripping root directory from archive");

        const innerEntries = fs.readdirSync(rootDir);
        for (const entry of innerEntries) {
          const src = path.join(rootDir, entry);
          const dest = path.join(dir, entry);
          fs.renameSync(src, dest);
        }

        // Remove the now-empty root directory
        fs.rmdirSync(rootDir);
      }
    }
  }

  /**
   * Recursively collect all file paths in a directory.
   * Used for tracking what files were created.
   */
  private collectFiles(dir: string, maxDepth: number = 3): string[] {
    const files: string[] = [];

    const walk = (current: string, depth: number) => {
      if (depth > maxDepth) return;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else {
          files.push(fullPath);
        }
      }
    };

    walk(dir, 0);
    return files;
  }
}
