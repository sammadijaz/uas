/**
 * UAS CLI — Save Command
 *
 * Saves the current machine state: installed apps + environment variables.
 * Creates a complete profile YAML that `uas restore` can replay.
 *
 * Usage:
 *   uas save                 Save to default profile
 *   uas save -n <name>       Save with custom profile name
 *   uas save --with-env      Include environment variables (default: true)
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { stringify as stringifyYaml } from "yaml";
import { execSync } from "child_process";
import { UASEngine, Profile } from "@uas/engine";
import { getEngineOptions, paths, ensureDirectories } from "../config";
import { printSuccess, printError, printInfo, colors } from "../output";

export function registerSaveCommand(program: Command): void {
  program
    .command("save")
    .description("Save current installed apps and environment to a profile")
    .option("-n, --name <name>", "Profile name", "my-machine")
    .option("--no-env", "Skip saving environment variables")
    .option("-o, --output <file>", "Save to a specific file path")
    .action(async (opts: { name: string; env: boolean; output?: string }) => {
      ensureDirectories();
      const engineOpts = getEngineOptions();
      const engine = new UASEngine(engineOpts);
      await engine.init();

      try {
        const apps = engine.getInstalledApps();
        const envVars = opts.env ? captureUserEnvVars() : {};
        const userPath = opts.env ? captureUserPath() : [];

        // Build profile
        const profile: Profile & { environment?: object } = {
          name: opts.name,
          id: opts.name.toLowerCase().replace(/\s+/g, "-"),
          description: `Saved from ${process.env.COMPUTERNAME || "unknown"} on ${today()}`,
          author: process.env.USERNAME || "unknown",
          version: "1.0.0",
          schema_version: "1.0",
          apps: apps.map((a) => ({
            id: a.app_id,
            version: a.version,
            optional: false,
          })),
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            tags: ["saved"],
            platform: "windows",
            min_uas_version: "0.1.0",
          },
        };

        // Attach environment if requested
        if (opts.env) {
          (profile as any).environment = {
            user_path: userPath,
            variables: envVars,
          };
        }

        const yamlContent = stringifyYaml(profile);

        // Determine output path
        const dest = opts.output
          ? path.resolve(opts.output)
          : path.join(paths.profiles, `${profile.id}.yaml`);

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, yamlContent, "utf-8");

        printSuccess(`Profile saved to ${colors.bold(dest)}`);
        printInfo(`${colors.bold(String(apps.length))} apps tracked`);
        if (opts.env) {
          printInfo(
            `${colors.bold(String(Object.keys(envVars).length))} environment variables saved`,
          );
          printInfo(
            `${colors.bold(String(userPath.length))} PATH entries saved`,
          );
        }
        printInfo(
          `Restore on another machine with: ${colors.bold("uas restore " + path.basename(dest))}`,
        );
      } finally {
        engine.close();
      }
    });
}

// ─── Helpers ──────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function captureUserPath(): string[] {
  try {
    const raw = execSync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\"",
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

function captureUserEnvVars(): Record<string, string> {
  try {
    const raw = execSync(
      "powershell -NoProfile -Command \"[Environment]::GetEnvironmentVariables('User') | ConvertTo-Json\"",
      { encoding: "utf-8" },
    ).trim();
    if (!raw || raw === "null") return {};
    const parsed = JSON.parse(raw);
    const result: Record<string, string> = {};
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
