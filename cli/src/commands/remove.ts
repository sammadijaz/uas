/**
 * UAS CLI — Remove Command
 *
 * User-friendly alias for `uas uninstall`.
 *
 * Usage:
 *   uas remove <app>            Remove an installed app
 *   uas remove <app> --dry-run  Preview removal without executing
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

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove <app>")
    .description("Remove an installed application")
    .option("--dry-run", "Preview removal without executing", false)
    .option("--verbose", "Show detailed output", false)
    .action(
      async (app: string, opts: { dryRun: boolean; verbose: boolean }) => {
        const engineOpts = getEngineOptions(opts.verbose, opts.dryRun);
        const engine = new UASEngine(engineOpts);
        await engine.init();

        if (!engine.isInstalled(app)) {
          printError(`"${app}" is not installed.`);
          engine.close();
          process.exit(1);
        }

        const installed = engine.getInstalledApp(app)!;

        if (opts.dryRun) {
          printDryRun(
            `Would remove ${colors.app(app)} v${colors.version(installed.version)}`,
          );
        }

        const spinner = createSpinner(`Removing ${app}...`);
        engine.on((event: EngineEvent) => {
          if (event.type === "state_change") {
            const data = event.data as { state: ExecutionState };
            spinner.text = `${formatState(data.state)} — ${app}`;
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
                `Dry run complete — would remove ${colors.app(app)} v${colors.version(installed.version)}`,
              );
            } else {
              printSuccess(
                `Removed ${colors.app(app)} v${colors.version(installed.version)} ` +
                  `in ${formatDuration(elapsed)}`,
              );
            }
          } else {
            printError(`Remove failed: ${result.final_state}`);
            if (result.error) {
              printError(`  ${result.error.message}`);
            }
            process.exit(1);
          }
        } catch (err: unknown) {
          spinner.stop();
          const msg = err instanceof Error ? err.message : String(err);
          printError(`Remove failed: ${msg}`);
          process.exit(1);
        } finally {
          engine.close();
        }
      },
    );
}
