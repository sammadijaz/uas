#!/usr/bin/env node

/**
 * UAS CLI — Entry Point
 *
 * The Universal App Store command-line interface.
 * This is a thin wrapper around @uas/engine — it contains zero
 * installation logic. Every operation delegates to the engine.
 *
 * Commands:
 *   install <app>           Install an app from the catalog
 *   uninstall <app>         Uninstall a tracked app
 *   status [app]            Show installation state
 *   search [query]          Search the catalog
 *   profile apply <file>    Apply a profile
 *   profile diff <file>     Show profile diff
 *   profile export [file]   Export current state as profile
 *   sync                    Sync with backend (Phase 5)
 *   login                   Authenticate (Phase 5)
 *   logout                  Clear credentials (Phase 5)
 */

import { Command } from 'commander';
import { registerInstallCommand } from './commands/install';
import { registerUninstallCommand } from './commands/uninstall';
import { registerStatusCommand } from './commands/status';
import { registerSearchCommand } from './commands/search';
import { registerProfileCommand } from './commands/profile';
import { registerSyncCommand } from './commands/sync';
import { registerLoginCommand } from './commands/login';

const program = new Command();

program
  .name('uas')
  .description('Universal App Store — Windows environment installer')
  .version('0.1.0');

// Register all commands
registerInstallCommand(program);
registerUninstallCommand(program);
registerStatusCommand(program);
registerSearchCommand(program);
registerProfileCommand(program);
registerSyncCommand(program);
registerLoginCommand(program);

// Parse command line
program.parseAsync(process.argv).catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
