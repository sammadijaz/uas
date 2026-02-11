/**
 * UAS CLI - List Command
 *
 * Lists all available software in the catalog or all installed apps.
 * Adapts table layout to terminal width; falls back to compact cards
 * when the terminal is narrower than 70 columns.
 *
 * Usage:
 *   uas list              List all available software
 *   uas list --installed  List only installed software
 */

import { Command } from "commander";
import { UASEngine } from "@uas/engine";
import { getEngineOptions } from "../config";
import { searchRecipes, listRecipes } from "../catalog";
import { printInfo, printAdaptiveTable, colors } from "../output";

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
          printAdaptiveTable({
            columns: [
              { header: "Name", minWidth: 12 },
              { header: "Version", minWidth: 10 },
              { header: "Installed On", minWidth: 14, flexible: true },
            ],
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

          printInfo(
            `${colors.bold(String(recipes.length))} software available:\n`,
          );
          printAdaptiveTable({
            columns: [
              { header: "Name", minWidth: 10 },
              { header: "Version", minWidth: 8 },
              { header: "Description", minWidth: 12, flexible: true },
              { header: "Status", minWidth: 10 },
            ],
            rows: recipes.map((r) => {
              const installed = engine.isInstalled(r.id);
              const status = installed
                ? colors.success("installed")
                : colors.dim("available");
              return [
                colors.app(r.id),
                colors.version(r.version),
                r.description || "",
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
