/**
 * UAS CLI — Status Command
 *
 * Shows current installation state: what apps are installed,
 * their versions, and when they were installed.
 *
 * Usage:
 *   uas status              Show all installed apps
 *   uas status <app>        Show details for a specific app
 */

import { Command } from 'commander';
import { UASEngine, InstalledApp } from '@uas/engine';
import { getEngineOptions } from '../config';
import {
  printInfo,
  printError,
  printTable,
  colors,
} from '../output';

export function registerStatusCommand(program: Command): void {
  program
    .command('status [app]')
    .description('Show current installation state')
    .option('--verbose', 'Show detailed output', false)
    .action(async (app: string | undefined, opts: { verbose: boolean }) => {
      const engineOpts = getEngineOptions(opts.verbose);
      const engine = new UASEngine(engineOpts);
      await engine.init();

      try {
        if (app) {
          // Show details for a specific app
          const installed = engine.getInstalledApp(app);
          if (!installed) {
            printError(`App "${app}" is not installed.`);
            process.exit(1);
          }
          printAppDetails(installed);
        } else {
          // Show all installed apps
          const apps = engine.getInstalledApps();
          if (apps.length === 0) {
            printInfo('No apps installed yet.');
            printInfo(`Run ${colors.bold('uas install <app>')} to get started.`);
            return;
          }

          printInfo(`${colors.bold(String(apps.length))} app(s) installed:\n`);
          printTable({
            head: ['App', 'Version', 'Installed', 'Directory'],
            rows: apps.map((a) => [
              colors.app(a.app_id),
              colors.version(a.version),
              formatDate(a.installed_at),
              a.install_dir || colors.dim('(default)'),
            ]),
          });
        }
      } finally {
        engine.close();
      }
    });
}

function printAppDetails(app: InstalledApp): void {
  console.log();
  console.log(`  ${colors.bold('App:')}        ${colors.app(app.app_id)}`);
  console.log(`  ${colors.bold('Version:')}    ${colors.version(app.version)}`);
  console.log(`  ${colors.bold('Installed:')}  ${formatDate(app.installed_at)}`);
  console.log(`  ${colors.bold('Directory:')}  ${app.install_dir || colors.dim('(default)')}`);
  console.log(`  ${colors.bold('Recipe:')}     ${colors.dim(app.recipe_hash.slice(0, 12) + '...')}`);

  if (app.side_effects.length > 0) {
    console.log(`  ${colors.bold('Side Effects:')}`);
    for (const effect of app.side_effects) {
      console.log(`    ${colors.dim('•')} ${effect.type}: ${effect.target}`);
    }
  }
  console.log();
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
