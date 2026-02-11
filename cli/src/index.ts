#!/usr/bin/env node

/**
 * UAS CLI — Entry Point
 *
 * The Universal App Store command-line interface.
 * Install once, run everywhere: npm install -g uas
 *
 * Core Commands:
 *   uas list                   List available software
 *   uas install <app>          Install an app
 *   uas remove <app>           Remove an app
 *   uas status [app]           Show installation state
 *   uas search [query]         Search the catalog
 *
 * Profile & Environment:
 *   uas save                   Save installed apps + env vars
 *   uas restore [file]         Restore apps + env vars on a new machine
 *   uas env save               Save environment variables
 *   uas env restore <file>     Restore environment variables
 *   uas env show               List saved snapshots
 *
 * Advanced:
 *   uas profile apply <file>   Apply a profile YAML
 *   uas profile diff <file>    Show what a profile would change
 *   uas profile export [file]  Export state as profile YAML
 *   uas sync                   Sync with backend account
 *   uas login                  Authenticate with backend
 *   uas logout                 Clear credentials
 */

import { Command } from "commander";
import { registerInstallCommand } from "./commands/install";
import { registerUninstallCommand } from "./commands/uninstall";
import { registerRemoveCommand } from "./commands/remove";
import { registerListCommand } from "./commands/list";
import { registerStatusCommand } from "./commands/status";
import { registerSearchCommand } from "./commands/search";
import { registerSaveCommand } from "./commands/save";
import { registerRestoreCommand } from "./commands/restore";
import { registerEnvCommand } from "./commands/env";
import { registerProfileCommand } from "./commands/profile";
import { registerSyncCommand } from "./commands/sync";
import { registerLoginCommand } from "./commands/login";

const program = new Command();

program
  .name("uas")
  .description("Universal App Store — install, save, and restore your entire dev environment")
  .version("0.1.0");

// ─── Core commands (most-used first) ────────────────────────
registerListCommand(program);
registerInstallCommand(program);
registerRemoveCommand(program);
registerUninstallCommand(program);
registerStatusCommand(program);
registerSearchCommand(program);

// ─── Save / Restore workflow ────────────────────────────────
registerSaveCommand(program);
registerRestoreCommand(program);
registerEnvCommand(program);

// ─── Advanced profile management ────────────────────────────
registerProfileCommand(program);
registerSyncCommand(program);
registerLoginCommand(program);

// Parse command line
program.parseAsync(process.argv).catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
