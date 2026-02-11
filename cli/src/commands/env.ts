/**
 * UAS CLI — Environment Variable Commands
 *
 * Save and restore system environment variables.
 *
 * Usage:
 *   uas env save [file]       Save current PATH & custom env vars
 *   uas env restore <file>    Restore env vars from a saved snapshot
 *   uas env show              Show saved environment snapshots
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { execSync } from "child_process";
import { paths, ensureDirectories } from "../config";
import {
  printSuccess,
  printError,
  printInfo,
  printWarn,
  printTable,
  colors,
} from "../output";

/** Shape of an env snapshot file */
interface EnvSnapshot {
  name: string;
  created: string;
  machine: string;
  user_path: string[];
  system_path: string[];
  user_vars: Record<string, string>;
}

/** Directory for env snapshots */
const envDir = (): string => {
  const dir = path.join(paths.profiles, "env");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export function registerEnvCommand(program: Command): void {
  const env = program
    .command("env")
    .description("Save and restore environment variables");

  // ─── env save ──────────────────────────────────────────────

  env
    .command("save [file]")
    .description("Save current environment variables to a snapshot")
    .option("-n, --name <name>", "Snapshot name", "default")
    .action(async (file: string | undefined, opts: { name: string }) => {
      ensureDirectories();
      const snapshot = captureEnvironment(opts.name);

      const dest = file
        ? path.resolve(file)
        : path.join(envDir(), `${opts.name}.yaml`);

      fs.writeFileSync(dest, stringifyYaml(snapshot), "utf-8");
      printSuccess(`Environment saved to ${colors.bold(dest)}`);
      printInfo(`${snapshot.user_path.length} PATH entries captured`);
      printInfo(
        `${Object.keys(snapshot.user_vars).length} environment variables captured`,
      );
    });

  // ─── env restore ───────────────────────────────────────────

  env
    .command("restore <file>")
    .description("Restore environment variables from a snapshot")
    .option("--dry-run", "Preview changes without applying", false)
    .action(async (file: string, opts: { dryRun: boolean }) => {
      const resolved = resolveEnvFile(file);
      if (!resolved) {
        printError(`Snapshot file not found: ${file}`);
        process.exit(1);
      }

      const content = fs.readFileSync(resolved, "utf-8");
      const snapshot = parseYaml(content) as EnvSnapshot;

      printInfo(
        `Restoring environment from "${colors.bold(snapshot.name)}" ` +
          `(saved ${snapshot.created})`,
      );

      // Restore user environment variables
      const varEntries = Object.entries(snapshot.user_vars);
      if (varEntries.length > 0) {
        printInfo(
          `Restoring ${colors.bold(String(varEntries.length))} environment variables...`,
        );
        for (const [key, value] of varEntries) {
          if (opts.dryRun) {
            printInfo(`  ${colors.dim("[dry-run]")} SET ${key}=${truncate(value, 60)}`);
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

      // Restore PATH entries
      if (snapshot.user_path.length > 0) {
        printInfo(
          `Restoring ${colors.bold(String(snapshot.user_path.length))} PATH entries...`,
        );
        if (opts.dryRun) {
          for (const p of snapshot.user_path) {
            printInfo(`  ${colors.dim("[dry-run]")} PATH += ${p}`);
          }
        } else {
          try {
            restoreUserPath(snapshot.user_path);
            printSuccess("PATH updated successfully");
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            printWarn(`Failed to update PATH: ${msg}`);
          }
        }
      }

      if (opts.dryRun) {
        printInfo("Dry run complete — no changes were made.");
      } else {
        printSuccess("Environment restored.");
        printInfo(
          "Open a new terminal window to see the changes take effect.",
        );
      }
    });

  // ─── env show ──────────────────────────────────────────────

  env
    .command("show")
    .description("List saved environment snapshots")
    .action(async () => {
      ensureDirectories();
      const dir = envDir();
      const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))
        : [];

      if (files.length === 0) {
        printInfo("No environment snapshots saved yet.");
        printInfo(`Run ${colors.bold("uas env save")} to create one.`);
        return;
      }

      const rows: string[][] = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dir, file), "utf-8");
          const snap = parseYaml(content) as EnvSnapshot;
          rows.push([
            colors.app(snap.name),
            snap.created,
            String(snap.user_path.length),
            String(Object.keys(snap.user_vars).length),
          ]);
        } catch {
          rows.push([file, "—", "—", "—"]);
        }
      }

      printTable({
        head: ["Name", "Created", "PATH Entries", "Variables"],
        rows,
      });
    });
}

// ─── Helpers ──────────────────────────────────────────────────

function captureEnvironment(name: string): EnvSnapshot {
  const userPath = getUserPath();
  const systemPath = getSystemPath();
  const userVars = getUserEnvVars();

  return {
    name,
    created: new Date().toISOString().split("T")[0],
    machine: process.env.COMPUTERNAME || "unknown",
    user_path: userPath,
    system_path: systemPath,
    user_vars: userVars,
  };
}

function getUserPath(): string[] {
  try {
    const raw = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'User\')"',
      { encoding: "utf-8" },
    ).trim();
    return raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return (process.env.PATH || "").split(";").filter(Boolean);
  }
}

function getSystemPath(): string[] {
  try {
    const raw = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'Machine\')"',
      { encoding: "utf-8" },
    ).trim();
    return raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getUserEnvVars(): Record<string, string> {
  try {
    const raw = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariables(\'User\') | ConvertTo-Json"',
      { encoding: "utf-8" },
    ).trim();
    if (!raw || raw === "null") return {};
    const parsed = JSON.parse(raw);
    const result: Record<string, string> = {};
    // Filter out PATH (handled separately) and noisy vars
    const skipKeys = new Set(["path", "temp", "tmp"]);
    for (const [key, value] of Object.entries(parsed)) {
      if (!skipKeys.has(key.toLowerCase()) && typeof value === "string") {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
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

function resolveEnvFile(file: string): string | null {
  // Direct path
  if (fs.existsSync(file)) return path.resolve(file);

  // Try in env snapshots dir
  const inDir = path.join(envDir(), file);
  if (fs.existsSync(inDir)) return inDir;

  // Try with .yaml extension
  if (!file.endsWith(".yaml")) {
    if (fs.existsSync(inDir + ".yaml")) return inDir + ".yaml";
    if (fs.existsSync(file + ".yaml")) return path.resolve(file + ".yaml");
  }

  return null;
}

function escapePS(s: string): string {
  return s.replace(/'/g, "''");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
