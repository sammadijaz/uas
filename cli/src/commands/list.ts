/**
 * UAS CLI — List Command
 *
 * Lists all available software in the catalog or all installed apps.
 *
 * Usage:
 *   uas list              List all available software
 *   uas list --installed  List only installed software
 */

import { Command } from "commander";
import { UASEngine } from "@uas/engine";
import { getEngineOptions } from "../config";
import { searchRecipes, listRecipes } from "../catalog";
import { printInfo, printTable, colors } from "../output";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List available software in the catalog")
    .option("-i, --installed", "Show only installed software", false)
    .action(async (opts: { installed: boolean }) => {
      const engineOpts = getEngineOptions();
      const engine = new UASEngine(engineOpts);
      await engine.init();

      try {
        if (opts.installed) {
          const apps = engine.getInstalledApps();
          if (apps.length === 0) {
            printInfo("No software installed yet.");
            printInfo(
              `Run ${colors.bold("uas install <app>")} to get started.`,
            );
            return;
          }

          printInfo(
            `${colors.bold(String(apps.length))} software installed:\n`,
          );
          printTable({
            head: ["Name", "Version", "Installed On"],
            rows: apps.map((a) => [
              colors.app(a.app_id),
              colors.version(a.version),
              formatDate(a.installed_at),
            ]),
          });
        } else {
          const recipes = listRecipes();
          if (recipes.length === 0) {
            printInfo("Catalog is empty.");
            printInfo(
              "Add recipe YAML files to ~/.uas/catalog/ or sync from remote.",
            );
            return;
          }

          printInfo(`${colors.bold(String(recipes.length))} software available:\n`);
          printTable({
            head: ["Name", "Version", "Description", "Status"],
            rows: recipes.map((r) => {
              const installed = engine.isInstalled(r.id);
              const status = installed
                ? colors.success("✔ installed")
                : colors.dim("available");
              return [
                colors.app(r.id),
                colors.version(r.version),
                (r.description || "").slice(0, 50),
                status,
              ];
            }),
          });
        }
      } finally {
        engine.close();
      }
    });
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
