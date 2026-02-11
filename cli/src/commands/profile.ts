/**
 * UAS CLI — Profile Commands
 *
 * Manage environment profiles: apply, diff, export.
 *
 * Usage:
 *   uas profile apply <file>    Install all apps in a profile
 *   uas profile diff <file>     Show what a profile would change
 *   uas profile export [file]   Export current state as a profile
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { UASEngine, Profile, EngineEvent, ExecutionState } from '@uas/engine';
import { getEngineOptions, paths } from '../config';
import { loadRecipe } from '../catalog';
import {
  printSuccess,
  printError,
  printInfo,
  printWarn,
  printDryRun,
  printTable,
  createSpinner,
  formatState,
  formatDuration,
  colors,
} from '../output';

export function registerProfileCommand(program: Command): void {
  const profile = program
    .command('profile')
    .description('Manage environment profiles');

  // ─── profile apply ─────────────────────────────────────────

  profile
    .command('apply <file>')
    .description('Apply a profile — install all its apps')
    .option('--dry-run', 'Preview without installing', false)
    .option('--verbose', 'Show detailed output', false)
    .action(async (file: string, opts: { dryRun: boolean; verbose: boolean }) => {
      const profileData = loadProfile(file);
      if (!profileData) {
        printError(`Could not load profile from "${file}"`);
        process.exit(1);
      }

      printInfo(`Applying profile: ${colors.bold(profileData.name)} (${profileData.apps.length} apps)`);

      const engineOpts = getEngineOptions(opts.verbose, opts.dryRun);
      const engine = new UASEngine(engineOpts);
      await engine.init();

      let installed = 0;
      let skipped = 0;
      let failed = 0;
      const startTime = Date.now();

      try {
        for (const appSpec of profileData.apps) {
          // Skip already-installed apps (unless version differs)
          const current = engine.getInstalledApp(appSpec.id);
          if (current && (!appSpec.version || appSpec.version === 'latest' || current.version === appSpec.version)) {
            printInfo(`${colors.app(appSpec.id)} already installed (v${colors.version(current.version)}), skipping`);
            skipped++;
            continue;
          }

          // Load recipe
          const recipe = loadRecipe(appSpec.id);
          if (!recipe) {
            if (appSpec.optional) {
              printWarn(`Optional app "${appSpec.id}" not found in catalog, skipping`);
              skipped++;
            } else {
              printError(`Required app "${appSpec.id}" not found in catalog`);
              failed++;
            }
            continue;
          }

          // Override version if profile specifies one
          if (appSpec.version && appSpec.version !== 'latest') {
            recipe.version = appSpec.version;
          }

          // Install
          const spinner = createSpinner(`Installing ${recipe.name}...`);
          engine.on((event: EngineEvent) => {
            if (event.type === 'state_change') {
              const data = event.data as { state: ExecutionState };
              spinner.text = `${formatState(data.state)} — ${recipe.name}`;
            }
          });

          spinner.start();
          const result = await engine.install(recipe, { dry_run: opts.dryRun });
          spinner.stop();

          if (result.final_state === 'COMPLETED') {
            if (opts.dryRun) {
              printDryRun(`Would install ${colors.app(recipe.id)} v${colors.version(recipe.version)}`);
            } else {
              printSuccess(`Installed ${colors.app(recipe.id)} v${colors.version(recipe.version)}`);
            }
            installed++;
          } else {
            printError(`Failed to install ${recipe.id}: ${result.error?.message || result.final_state}`);
            failed++;
          }
        }

        const elapsed = Date.now() - startTime;
        console.log();
        printInfo(
          `Profile "${profileData.name}" — ` +
          `${colors.success(String(installed) + ' installed')}, ` +
          `${colors.dim(String(skipped) + ' skipped')}, ` +
          `${failed > 0 ? colors.error(String(failed) + ' failed') : colors.dim('0 failed')} ` +
          `(${formatDuration(elapsed)})`
        );
      } finally {
        engine.close();
      }

      if (failed > 0) process.exit(1);
    });

  // ─── profile diff ──────────────────────────────────────────

  profile
    .command('diff <file>')
    .description('Show what a profile would change')
    .option('--verbose', 'Show detailed output', false)
    .action(async (file: string, opts: { verbose: boolean }) => {
      const profileData = loadProfile(file);
      if (!profileData) {
        printError(`Could not load profile from "${file}"`);
        process.exit(1);
      }

      const engineOpts = getEngineOptions(opts.verbose);
      const engine = new UASEngine(engineOpts);
      await engine.init();

      try {
        const rows: string[][] = [];

        for (const appSpec of profileData.apps) {
          const current = engine.getInstalledApp(appSpec.id);
          const wantVersion = appSpec.version || 'latest';

          if (!current) {
            rows.push([
              colors.success('+ install'),
              colors.app(appSpec.id),
              colors.version(wantVersion),
              colors.dim('—'),
            ]);
          } else if (wantVersion !== 'latest' && current.version !== wantVersion) {
            rows.push([
              colors.warn('~ update'),
              colors.app(appSpec.id),
              colors.version(wantVersion),
              `currently ${colors.version(current.version)}`,
            ]);
          } else {
            rows.push([
              colors.dim('= keep'),
              colors.app(appSpec.id),
              colors.version(current.version),
              colors.dim('already installed'),
            ]);
          }
        }

        printInfo(`Profile diff: ${colors.bold(profileData.name)}\n`);
        printTable({
          head: ['Action', 'App', 'Version', 'Notes'],
          rows,
        });
      } finally {
        engine.close();
      }
    });

  // ─── profile export ────────────────────────────────────────

  profile
    .command('export [file]')
    .description('Export current installed state as a profile YAML')
    .option('-n, --name <name>', 'Profile name', 'my-environment')
    .action(async (file: string | undefined, opts: { name: string }) => {
      const engineOpts = getEngineOptions();
      const engine = new UASEngine(engineOpts);
      await engine.init();

      try {
        const apps = engine.getInstalledApps();
        if (apps.length === 0) {
          printInfo('No apps installed — nothing to export.');
          return;
        }

        const profileData: Profile = {
          name: opts.name,
          id: opts.name.toLowerCase().replace(/\s+/g, '-'),
          description: `Exported from UAS on ${new Date().toISOString().split('T')[0]}`,
          author: process.env.USERNAME || 'unknown',
          version: '1.0.0',
          schema_version: '1.0',
          apps: apps.map((a) => ({
            id: a.app_id,
            version: a.version,
            optional: false,
          })),
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            tags: ['exported'],
            platform: 'windows',
            min_uas_version: '0.1.0',
          },
        };

        const yamlContent = stringifyYaml(profileData);

        if (file) {
          const outputPath = path.resolve(file);
          fs.writeFileSync(outputPath, yamlContent, 'utf-8');
          printSuccess(`Profile exported to ${outputPath}`);
        } else {
          // Print to stdout
          console.log(yamlContent);
        }
      } finally {
        engine.close();
      }
    });
}

// ─── Helpers ──────────────────────────────────────────────────

function loadProfile(filePath: string): Profile | null {
  // Check absolute/relative path first
  let resolved = path.resolve(filePath);

  // If not found, try in the profiles directory
  if (!fs.existsSync(resolved)) {
    resolved = path.join(paths.profiles, filePath);
  }

  // Try with .yaml extension
  if (!fs.existsSync(resolved) && !resolved.endsWith('.yaml')) {
    resolved += '.yaml';
  }

  if (!fs.existsSync(resolved)) return null;

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    return parseYaml(content) as Profile;
  } catch {
    return null;
  }
}
