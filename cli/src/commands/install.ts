/**
 * UAS CLI -- Install Command
 *
 * Installs an application from the catalog.
 *
 * Usage:
 *   uas install <app>            Install latest version
 *   uas install <app> --version  Install specific version
 *   uas install <app> --dry-run  Preview without installing
 *
 * Output:
 *   Beautiful staged output with check marks for each phase.
 *   Only shows debug/log info when --debug is set.
 *
 *   uas install node
 *
 *   Installing Node.js v22.11.0
 *
 *     ✔ Validated recipe
 *     ✔ Resolved download URL
 *     ✔ Downloaded installer (cached)
 *     ✔ Verified checksum
 *     ✔ Executed installer
 *     ✔ Applied 2 side effects
 *     ✔ Confirmed: node --version -> v22.11.0
 *
 *   ✔ Installed Node.js v22.11.0 in 4.2s
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
  printHeader,
  printStageSuccess,
  printStageError,
  printStageInfo,
  printDetail,
  printBlank,
  printDebug,
  isDebugMode,
  createSpinner,
  formatState,
  formatDuration,
  formatErrorCategory,
  colors,
} from "../output";

/** Stages the spinner cycles through */
const STAGE_MESSAGES: Partial<Record<ExecutionState, string>> = {
  VALIDATING: "Validating recipe...",
  RESOLVING: "Resolving download URL...",
  DOWNLOADING: "Downloading installer...",
  VERIFYING: "Verifying checksum...",
  EXECUTING: "Running installer...",
  SIDE_EFFECTS: "Applying side effects...",
  CONFIRMING: "Confirming installation...",
};

/** After each stage completes, print a check-marked line */
const STAGE_DONE: Partial<Record<ExecutionState, string>> = {
  VALIDATING: "Validated recipe",
  RESOLVING: "Resolved download URL",
  DOWNLOADING: "Downloaded installer",
  VERIFYING: "Verified checksum",
  EXECUTING: "Executed installer",
  SIDE_EFFECTS: "Applied side effects",
  CONFIRMING: "Confirmed installation",
};

export function registerInstallCommand(program: Command): void {
  program
    .command("install <app>")
    .alias("i")
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

        // 2. Create engine (use debug-aware verbose mode)
        const verbose = opts.verbose || isDebugMode();
        const engineOpts = getEngineOptions(verbose, opts.dryRun);
        const engine = new UASEngine(engineOpts);
        await engine.init();

        // 3. Print header
        if (opts.dryRun) {
          printDryRun(
            `Would install ${colors.app(recipe.name)} v${colors.version(recipe.version)}`,
          );
        } else {
          printHeader(
            `Installing ${colors.app(recipe.name)} v${colors.version(recipe.version)}`,
          );
        }

        // 4. Wire up progress display
        const spinner = createSpinner("Starting...");
        let lastState: ExecutionState | "" = "";
        const completedStages: ExecutionState[] = [];

        engine.on((event: EngineEvent) => {
          if (event.type === "state_change") {
            const data = event.data as {
              state: ExecutionState;
              message?: string;
            };

            // Skip duplicate events for the same state (engine emits
            // enter + success for each stage)
            if (data.state === lastState) {
              if (data.message) {
                printDebug(`${data.state}: ${data.message}`);
              }
              return;
            }

            // When entering a new stage, mark the previous one as done
            if (lastState && STAGE_DONE[lastState]) {
              spinner.stop();
              printStageSuccess(STAGE_DONE[lastState]!);
              completedStages.push(lastState);
              spinner.start();
            }

            lastState = data.state;

            // Update spinner text to current stage
            const stageMsg = STAGE_MESSAGES[data.state];
            if (stageMsg) {
              spinner.text = stageMsg;
            }

            // Debug logging
            if (data.message) {
              printDebug(`${data.state}: ${data.message}`);
            }
          }

          if (event.type === "progress") {
            const data = event.data as {
              progress_percent?: number;
              bytes_downloaded?: number;
              bytes_total?: number;
            };
            if (data.progress_percent !== undefined) {
              spinner.text = `Downloading installer... ${data.progress_percent}%`;
            }
          }
        });

        spinner.start();
        const startTime = Date.now();

        // 5. Execute installation
        try {
          const result = await engine.install(recipe, {
            dry_run: opts.dryRun,
            force: opts.force,
          });

          spinner.stop();
          const elapsed = Date.now() - startTime;

          // Print the final stage completion if we missed it
          if (
            lastState &&
            STAGE_DONE[lastState] &&
            !completedStages.includes(lastState)
          ) {
            if (result.final_state === "COMPLETED") {
              printStageSuccess(STAGE_DONE[lastState]!);
            }
          }

          if (result.final_state === "COMPLETED") {
            // Check for "already_installed" quick return (no stages printed)
            if (elapsed < 500 && completedStages.length === 0) {
              printBlank();
              printSuccess(
                `${colors.app(recipe.name)} v${colors.version(recipe.version)} is already installed`,
              );
            } else if (opts.dryRun) {
              printBlank();
              printDryRun(
                `Dry run complete for ${colors.app(recipe.name)} v${colors.version(recipe.version)}`,
              );
            } else {
              // Side effects detail
              if (result.side_effects_applied.length > 0) {
                printStageInfo(
                  `Applied ${result.side_effects_applied.length} side effect(s)`,
                );
                for (const effect of result.side_effects_applied) {
                  printDebug(`  ${effect.type}: ${effect.target}`);
                }
              }

              printBlank();
              printSuccess(
                `Installed ${colors.app(recipe.name)} v${colors.version(recipe.version)} in ${formatDuration(elapsed)}`,
              );
            }
          } else {
            // ─── Failure output ───
            printBlank();
            printError(
              `Failed to install ${colors.app(recipe.name)} v${colors.version(recipe.version)}`,
            );

            if (result.error) {
              printDetail("Reason", formatErrorCategory(result.error.category));
              printDetail("Details", result.error.message);
              printDetail("Stage", formatState(result.error.state));

              if (result.error.category === "DOWNGRADE_BLOCKED") {
                printBlank();
                printInfo(
                  `Use ${colors.bold("--force")} to override the downgrade check.`,
                );
              }
            }

            if (result.side_effects_rolled_back.length > 0) {
              printBlank();
              printInfo(
                `Rolled back ${result.side_effects_rolled_back.length} side effect(s)`,
              );
            }

            process.exit(1);
          }
        } catch (err) {
          spinner.stop();
          printBlank();
          printError(`Unexpected error during installation`);

          if (isDebugMode()) {
            console.error(err);
          } else {
            printDetail("Message", (err as Error).message);
            printInfo(
              `Use ${colors.bold("--debug")} to see the full stack trace.`,
            );
          }

          process.exit(1);
        } finally {
          engine.close();
        }
      },
    );
}
