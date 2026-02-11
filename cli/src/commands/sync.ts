/**
 * UAS CLI — Sync Command
 *
 * Syncs local installation state with the UAS backend.
 *
 * Usage:
 *   uas sync          Push local state to your cloud account
 *   uas sync --pull   Pull remote profile to local
 */

import { Command } from "commander";
import { UASEngine, Profile } from "@uas/engine";
import { getEngineOptions, ensureDirectories } from "../config";
import {
  printSuccess,
  printError,
  printInfo,
  printWarn,
  createSpinner,
  colors,
} from "../output";
import { loadAuth } from "./login";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync local state with your UAS cloud account")
    .option("--push", "Push local state to backend (default)")
    .option("--pull", "Pull remote profile to local")
    .action(async (opts: { push?: boolean; pull?: boolean }) => {
      ensureDirectories();
      const auth = loadAuth();
      if (!auth) {
        printError("Not logged in.");
        printInfo(
          `Run ${colors.bold("uas login")} first to connect your account.`,
        );
        process.exit(1);
      }

      const headers = {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      };

      if (opts.pull) {
        await pullFromBackend(auth.server, headers);
      } else {
        await pushToBackend(auth.server, headers);
      }
    });
}

async function pushToBackend(
  server: string,
  headers: Record<string, string>,
): Promise<void> {
  const spinner = createSpinner("Syncing to cloud...");
  spinner.start();

  try {
    const engineOpts = getEngineOptions();
    const engine = new UASEngine(engineOpts);
    await engine.init();

    const apps = engine.getInstalledApps();
    engine.close();

    if (apps.length === 0) {
      spinner.stop();
      printInfo("No apps installed - nothing to sync.");
      return;
    }

    // Check for existing profile
    const listRes = await fetch(`${server}/api/profiles`, { headers });
    if (!listRes.ok) {
      spinner.stop();
      printError("Failed to fetch profiles from server.");
      process.exit(1);
    }

    const { profiles } = (await listRes.json()) as {
      profiles: Array<{ id: number; name: string }>;
    };

    const profileData = {
      apps: apps.map((a) => ({
        id: a.app_id,
        version: a.version,
        optional: false,
      })),
      metadata: {
        tags: ["synced"],
        platform: "windows",
      },
    };

    const machineName =
      process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown";

    if (profiles.length > 0) {
      // Update existing profile
      const existing = profiles[0];
      const res = await fetch(`${server}/api/profiles/${existing.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: machineName,
          data: profileData,
        }),
      });

      if (!res.ok) {
        spinner.stop();
        printError("Failed to update profile on server.");
        process.exit(1);
      }
    } else {
      // Create new profile
      const res = await fetch(`${server}/api/profiles`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: machineName,
          description: `Synced from ${machineName}`,
          data: profileData,
        }),
      });

      if (!res.ok) {
        spinner.stop();
        printError("Failed to create profile on server.");
        process.exit(1);
      }
    }

    spinner.stop();
    printSuccess(`Synced ${colors.bold(String(apps.length))} apps to cloud`);
  } catch (err: unknown) {
    spinner.stop();
    const msg = err instanceof Error ? err.message : String(err);
    printError(`Sync failed: ${msg}`);
    process.exit(1);
  }
}

async function pullFromBackend(
  server: string,
  headers: Record<string, string>,
): Promise<void> {
  const spinner = createSpinner("Pulling from cloud...");
  spinner.start();

  try {
    const res = await fetch(`${server}/api/profiles`, { headers });
    if (!res.ok) {
      spinner.stop();
      printError("Failed to fetch profiles from server.");
      process.exit(1);
    }

    const { profiles } = (await res.json()) as {
      profiles: Array<{
        id: number;
        name: string;
        data: { apps: Array<{ id: string; version?: string }> };
      }>;
    };

    spinner.stop();

    if (profiles.length === 0) {
      printInfo("No profiles found on your account.");
      printInfo(
        `Run ${colors.bold("uas sync --push")} from your source machine first.`,
      );
      return;
    }

    const profile = profiles[0];
    printSuccess(`Found profile: ${colors.bold(profile.name)}`);
    printInfo(`${profile.data.apps.length} apps in remote profile`);
    printInfo(
      `Use ${colors.bold("uas restore")} with this profile to install apps.`,
    );
  } catch (err: unknown) {
    spinner.stop();
    const msg = err instanceof Error ? err.message : String(err);
    printError(`Pull failed: ${msg}`);
    process.exit(1);
  }
}
