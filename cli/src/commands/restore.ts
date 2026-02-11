/**
 * UAS CLI — Restore Command
 *
 * Restores a saved profile: installs all apps and restores environment
 * variables. This is the counterpart to `uas save`.
 *
 * Usage:
 *   uas restore                  Restore from default profile
 *   uas restore <file>           Restore from a specific profile file
 *   uas restore --env-only       Only restore environment variables
 *   uas restore --apps-only      Only install apps (skip env restore)
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import { execSync } from "child_process";
import { UASEngine, EngineEvent, ExecutionState } from "@uas/engine";
import { getEngineOptions, paths, ensureDirectories } from "../config";
import { loadRecipe } from "../catalog";
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
} from "../output";

interface SavedProfile {
  name: string;
  apps: Array<{ id: string; version: string; optional: boolean }>;
  environment?: {
    user_path: string[];
    variables: Record<string, string>;
  };
}

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore [file]")
    .description("Restore apps and environment from a saved profile")
    .option("--dry-run", "Preview restoration without executing", false)
    .option("--verbose", "Show detailed output", false)
    .option("--apps-only", "Only install apps, skip environment", false)
    .option("--env-only", "Only restore environment, skip apps", false)
    .action(
      async (
        file: string | undefined,
        opts: {
          dryRun: boolean;
          verbose: boolean;
          appsOnly: boolean;
          envOnly: boolean;
        },
      ) => {
        ensureDirectories();

        // Resolve profile file
        const profilePath = resolveProfileFile(file);
        if (!profilePath) {
          if (file) {
            printError(`Profile not found: ${file}`);
          } else {
            printError("No default profile found.");
            printInfo(
              `Run ${colors.bold("uas save")} on your source machine first.`,
            );
          }
          process.exit(1);
        }

        const content = fs.readFileSync(profilePath, "utf-8");
        const profile = parseYaml(content) as SavedProfile;

        printInfo(
          `Restoring profile: ${colors.bold(profile.name)} ` +
            `(${profile.apps.length} apps)`,
        );
        console.log();

        const startTime = Date.now();
        let appsInstalled = 0;
        let appsSkipped = 0;
        let appsFailed = 0;

        // ─── Step 1: Install apps ─────────────────────────────

        if (!opts.envOnly) {
          const engineOpts = getEngineOptions(opts.verbose, opts.dryRun);
          const engine = new UASEngine(engineOpts);
          await engine.init();

          try {
            for (const appSpec of profile.apps) {
              // Skip already-installed apps
              const current = engine.getInstalledApp(appSpec.id);
              if (current) {
                printInfo(
                  `${colors.app(appSpec.id)} already installed ` +
                    `(v${colors.version(current.version)}), skipping`,
                );
                appsSkipped++;
                continue;
              }

              // Load recipe from catalog
              const recipe = loadRecipe(appSpec.id);
              if (!recipe) {
                if (appSpec.optional) {
                  printWarn(
                    `Optional app "${appSpec.id}" not in catalog, skipping`,
                  );
                  appsSkipped++;
                } else {
                  printError(
                    `"${appSpec.id}" not found in catalog — ` +
                      `add it to ~/.uas/catalog/ and retry`,
                  );
                  appsFailed++;
                }
                continue;
              }

              // Override version if specified
              if (appSpec.version && appSpec.version !== "latest") {
                recipe.version = appSpec.version;
              }

              // Install with progress
              const spinner = createSpinner(`Installing ${recipe.name}...`);
              engine.on((event: EngineEvent) => {
                if (event.type === "state_change") {
                  const data = event.data as { state: ExecutionState };
                  spinner.text = `${formatState(data.state)} — ${recipe.name}`;
                }
              });

              spinner.start();

              try {
                const result = await engine.install(recipe, {
                  dry_run: opts.dryRun,
                });
                spinner.stop();

                if (result.final_state === "COMPLETED") {
                  if (opts.dryRun) {
                    printDryRun(
                      `Would install ${colors.app(recipe.id)} v${colors.version(recipe.version)}`,
                    );
                  } else {
                    printSuccess(
                      `Installed ${colors.app(recipe.id)} v${colors.version(recipe.version)}`,
                    );
                  }
                  appsInstalled++;
                } else {
                  printError(
                    `Failed: ${recipe.id} — ${result.error?.message || result.final_state}`,
                  );
                  appsFailed++;
                }
              } catch (err: unknown) {
                spinner.stop();
                const msg = err instanceof Error ? err.message : String(err);
                printError(`Failed: ${recipe.id} — ${msg}`);
                appsFailed++;
              }
            }
          } finally {
            engine.close();
          }

          console.log();
          printInfo(
            `Apps: ${colors.success(String(appsInstalled) + " installed")}, ` +
              `${colors.dim(String(appsSkipped) + " skipped")}, ` +
              `${appsFailed > 0 ? colors.error(String(appsFailed) + " failed") : colors.dim("0 failed")}`,
          );
        }

        // ─── Step 2: Restore environment variables ────────────

        if (!opts.appsOnly && profile.environment) {
          console.log();
          const env = profile.environment;

          // Restore variables
          const varEntries = Object.entries(env.variables || {});
          if (varEntries.length > 0) {
            printInfo(
              `Restoring ${colors.bold(String(varEntries.length))} environment variables...`,
            );
            for (const [key, value] of varEntries) {
              if (opts.dryRun) {
                printInfo(
                  `  ${colors.dim("[dry-run]")} SET ${key}=${truncate(value, 50)}`,
                );
              } else {
                try {
                  setUserEnvVar(key, value);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  printWarn(`Failed to set ${key}: ${msg}`);
                }
              }
            }
          }

          // Restore PATH
          if (env.user_path && env.user_path.length > 0) {
            printInfo(
              `Restoring ${colors.bold(String(env.user_path.length))} PATH entries...`,
            );
            if (opts.dryRun) {
              for (const p of env.user_path) {
                printInfo(`  ${colors.dim("[dry-run]")} PATH += ${p}`);
              }
            } else {
              try {
                restoreUserPath(env.user_path);
                printSuccess("PATH entries restored");
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                printWarn(`Failed to restore PATH: ${msg}`);
              }
            }
          }
        }

        // ─── Summary ─────────────────────────────────────────

        console.log();
        const elapsed = Date.now() - startTime;
        if (opts.dryRun) {
          printInfo(`Dry run complete (${formatDuration(elapsed)})`);
        } else {
          printSuccess(
            `Profile "${profile.name}" restored (${formatDuration(elapsed)})`,
          );
          if (profile.environment) {
            printInfo("Open a new terminal to see environment changes.");
          }
        }

        if (appsFailed > 0) process.exit(1);
      },
    );
}

// ─── Helpers ──────────────────────────────────────────────────

function resolveProfileFile(file?: string): string | null {
  if (file) {
    // Direct path
    if (fs.existsSync(file)) return path.resolve(file);
    // In profiles dir
    const inDir = path.join(paths.profiles, file);
    if (fs.existsSync(inDir)) return inDir;
    if (!file.endsWith(".yaml")) {
      if (fs.existsSync(inDir + ".yaml")) return inDir + ".yaml";
      if (fs.existsSync(file + ".yaml")) return path.resolve(file + ".yaml");
    }
    return null;
  }

  // No file specified — try default profile
  const defaultPath = path.join(paths.profiles, "my-machine.yaml");
  if (fs.existsSync(defaultPath)) return defaultPath;

  // Try any profile in the directory
  if (fs.existsSync(paths.profiles)) {
    const files = fs
      .readdirSync(paths.profiles)
      .filter((f) => f.endsWith(".yaml"));
    if (files.length === 1) {
      return path.join(paths.profiles, files[0]);
    }
  }

  return null;
}

function setUserEnvVar(key: string, value: string): void {
  execSync(
    `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('${escapePS(key)}', '${escapePS(value)}', 'User')"`,
  );
}

function restoreUserPath(entries: string[]): void {
  const newPath = entries.join(";");
  execSync(
    `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', '${escapePS(newPath)}', 'User')"`,
  );
}

function escapePS(s: string): string {
  return s.replace(/'/g, "''");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
