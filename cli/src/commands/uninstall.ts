/**
 * UAS CLI — Uninstall Command
 *
 * Removes an installed application and rolls back its side effects.
 *
 * Usage:
 *   uas uninstall <app>            Remove an installed app
 *   uas uninstall <app> --dry-run  Preview removal without executing
 */

import { Command } from "commander";
import { UASEngine, EngineEvent, ExecutionState } from "@uas/engine";
import { getEngineOptions } from "../config";
import {
  printSuccess,
  printError,
  printDryRun,
  createSpinner,
  formatState,
  formatDuration,
  colors,
} from "../output";

export function registerUninstallCommand(program: Command): void {
  program
    .command("uninstall <app>")
    .description("Uninstall a tracked application")
    .option("--dry-run", "Preview uninstall without executing", false)
    .option("--verbose", "Show detailed output", false)
    .action(
      async (app: string, opts: { dryRun: boolean; verbose: boolean }) => {
        const engineOpts = getEngineOptions(opts.verbose, opts.dryRun);
        const engine = new UASEngine(engineOpts);
        await engine.init();

        // Check if app is installed
        if (!engine.isInstalled(app)) {
          printError(`App "${app}" is not installed.`);
          engine.close();
          process.exit(1);
        }

        const installed = engine.getInstalledApp(app)!;

        if (opts.dryRun) {
          printDryRun(
            `Would uninstall ${colors.app(app)} v${colors.version(installed.version)}`,
          );
        }

        const spinner = createSpinner(`Uninstalling ${app}...`);
        engine.on((event: EngineEvent) => {
          if (event.type === "state_change") {
            const data = event.data as { state: ExecutionState };
            spinner.text = `${formatState(data.state)} - ${app}`;
          }
        });

        spinner.start();
        const startTime = Date.now();

        try {
          const result = await engine.uninstall(app, opts.dryRun);
          spinner.stop();
          const elapsed = Date.now() - startTime;

          if (result.final_state === "COMPLETED") {
            if (opts.dryRun) {
              printDryRun(
                `Dry run complete - would uninstall ${colors.app(app)} v${colors.version(installed.version)}`,
              );
            } else {
              printSuccess(
                `Uninstalled ${colors.app(app)} v${colors.version(installed.version)} ` +
                  `in ${formatDuration(elapsed)}`,
              );
            }
          } else {
            printError(`Uninstall failed: ${result.final_state}`);
            if (result.error) {
              console.error(
                `  ${colors.dim("Message:")} ${result.error.message}`,
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
