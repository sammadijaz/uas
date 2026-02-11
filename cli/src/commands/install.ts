/**
 * UAS CLI — Install Command
 *
 * Installs an application from the catalog.
 *
 * Usage:
 *   uas install <app>            Install latest version
 *   uas install <app> --version  Install specific version
 *   uas install <app> --dry-run  Preview without installing
 *
 * Flow:
 *   1. Load recipe from catalog by app ID
 *   2. Create engine instance
 *   3. Wire up progress events to spinner/output
 *   4. Call engine.install()
 *   5. Report result
 */

import { Command } from "commander";
import { UASEngine, ExecutionState, EngineEvent } from "@uas/engine";
import { getEngineOptions } from "../config";
import { loadRecipe } from "../catalog";
import {
  printSuccess,
  printError,
  printDryRun,
  printInfo,
  createSpinner,
  formatState,
  formatDuration,
  colors,
} from "../output";

export function registerInstallCommand(program: Command): void {
  program
    .command("install <app>")
    .description("Install an application from the catalog")
    .option("-v, --version <version>", "Specific version to install")
    .option("--dry-run", "Preview installation without executing", false)
    .option("--verbose", "Show detailed output", false)
    .option("--force", "Force reinstall even if already installed", false)
    .action(
      async (
        app: string,
        opts: {
          version?: string;
          dryRun: boolean;
          verbose: boolean;
          force: boolean;
        },
      ) => {
        // 1. Load recipe
        const recipe = loadRecipe(app);
        if (!recipe) {
          printError(`App "${app}" not found in catalog.`);
          printInfo(
            `Run ${colors.bold("uas search " + app)} to find available apps.`,
          );
          process.exit(1);
        }

        // Override version if specified
        if (opts.version) {
          recipe.version = opts.version;
        }

        // 2. Create engine
        const engineOpts = getEngineOptions(opts.verbose, opts.dryRun);
        const engine = new UASEngine(engineOpts);
        await engine.init();

        if (opts.dryRun) {
          printDryRun(
            `Would install ${colors.app(recipe.name)} v${colors.version(recipe.version)}`,
          );
        }

        // 3. Wire up progress display
        const spinner = createSpinner(`Installing ${recipe.name}...`);
        let lastState = "";

        engine.on((event: EngineEvent) => {
          if (event.type === "state_change") {
            const data = event.data as { state: ExecutionState };
            lastState = data.state;
            spinner.text = `${formatState(data.state)} — ${recipe.name} v${recipe.version}`;
          }
          if (event.type === "progress") {
            const data = event.data as { progress_percent?: number };
            if (data.progress_percent !== undefined) {
              spinner.text = `Downloading ${recipe.name}... ${data.progress_percent}%`;
            }
          }
        });

        spinner.start();
        const startTime = Date.now();

        // 4. Execute installation
        try {
          const result = await engine.install(recipe, {
            dry_run: opts.dryRun,
            force: opts.force,
          });

          spinner.stop();
          const elapsed = Date.now() - startTime;

          if (result.final_state === "COMPLETED") {
            if (opts.dryRun) {
              printDryRun(
                `Dry run complete for ${colors.app(recipe.name)} v${colors.version(recipe.version)}`,
              );
            } else {
              printSuccess(
                `Installed ${colors.app(recipe.name)} v${colors.version(recipe.version)} ` +
                  `in ${formatDuration(elapsed)}`,
              );
            }

            if (result.side_effects_applied.length > 0) {
              printInfo(
                `Applied ${result.side_effects_applied.length} side effect(s):`,
              );
              for (const effect of result.side_effects_applied) {
                console.log(
                  `  ${colors.dim("\u2022")} ${effect.type}: ${effect.target}`,
                );
              }
            }
          } else {
            printError(`Installation failed: ${result.final_state}`);
            if (result.error) {
              console.error(
                `  ${colors.dim("Category:")} ${result.error.category}`,
              );
              console.error(
                `  ${colors.dim("Message:")}  ${result.error.message}`,
              );
            }
            process.exit(1);
          }
        } catch (err) {
          spinner.stop();
          printError(`Unexpected error: ${(err as Error).message}`);
          process.exit(1);
        } finally {
          engine.close();
        }
      },
    );
}
