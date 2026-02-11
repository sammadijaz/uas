/**
 * UAS CLI — Login Command
 *
 * Authenticates the user with the UAS backend for sync features.
 * This is a stub — actual implementation requires Phase 5 (Backend API).
 *
 * Usage:
 *   uas login               Start interactive login
 *   uas login --token <t>   Login with an API token
 *   uas logout              Clear stored credentials
 */

import { Command } from 'commander';
import { printWarn, printInfo, colors } from '../output';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with the UAS backend')
    .option('--token <token>', 'Use an API token instead of interactive login')
    .action(async (_opts: { token?: string }) => {
      printWarn('Login is not yet available — requires backend (Phase 5).');
      printInfo('Authentication will enable profile sync, remote catalog access, and account features.');
    });

  program
    .command('logout')
    .description('Clear stored authentication credentials')
    .action(async () => {
      printWarn('Logout is not yet available — requires backend (Phase 5).');
    });
}
