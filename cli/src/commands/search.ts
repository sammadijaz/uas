/**
 * UAS CLI — Search Command
 *
 * Searches the local catalog for apps matching a query.
 *
 * Usage:
 *   uas search <query>     Search apps by name, description, or tags
 *   uas search --list      List all available apps
 */

import { Command } from 'commander';
import { UASEngine } from '@uas/engine';
import { getEngineOptions } from '../config';
import { searchRecipes, listRecipes } from '../catalog';
import {
  printInfo,
  printTable,
  colors,
} from '../output';

export function registerSearchCommand(program: Command): void {
  program
    .command('search [query]')
    .description('Search the catalog for applications')
    .option('--list', 'List all available apps', false)
    .action(async (query: string | undefined, opts: { list: boolean }) => {
      const recipes = opts.list || !query ? listRecipes() : searchRecipes(query!);

      if (recipes.length === 0) {
        if (query) {
          printInfo(`No apps found matching "${query}".`);
        } else {
          printInfo('Catalog is empty. Add recipe files to ~/.uas/catalog/');
        }
        return;
      }

      // Check what's already installed to show status
      const engineOpts = getEngineOptions();
      const engine = new UASEngine(engineOpts);
      await engine.init();

      try {
        const header = query
          ? `Found ${recipes.length} app(s) matching "${query}":`
          : `${recipes.length} app(s) available:`;
        printInfo(header + '\n');

        printTable({
          head: ['App', 'Version', 'Description', 'Status'],
          rows: recipes.map((r) => {
            const installed = engine.isInstalled(r.id);
            const installedApp = installed ? engine.getInstalledApp(r.id) : null;
            const status = installed
              ? colors.success(`✔ ${installedApp?.version || 'installed'}`)
              : colors.dim('not installed');

            return [
              colors.app(r.id),
              colors.version(r.version),
              (r.description || '').slice(0, 50),
              status,
            ];
          }),
        });
      } finally {
        engine.close();
      }
    });
}
