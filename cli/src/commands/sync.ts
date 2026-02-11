/**
 * UAS CLI — Sync Command
 *
 * Syncs local installation state with the backend account.
 * This is a stub — actual implementation requires Phase 5 (Backend API).
 *
 * Usage:
 *   uas sync                Push/pull state with backend
 *   uas sync --push         Push local state to backend
 *   uas sync --pull         Pull remote state to local
 */

import { Command } from 'commander';
import { printWarn, printInfo, colors } from '../output';

export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync local state with backend account')
    .option('--push', 'Push local state to backend')
    .option('--pull', 'Pull remote state to local')
    .action(async (_opts: { push?: boolean; pull?: boolean }) => {
      printWarn('Sync is not yet available — requires backend (Phase 5).');
      printInfo(`This command will push/pull your installation state to your UAS account.`);
      printInfo(`For now, use ${colors.bold('uas profile export')} to save your state locally.`);
    });
}
