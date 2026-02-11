/**
 * UAS Engine — Shortcut Manager
 *
 * Creates and removes Windows shortcuts (.lnk files) on the desktop
 * and in the Start Menu.
 *
 * Uses PowerShell's COM object for creating proper .lnk shortcuts.
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { AppliedSideEffect, ShortcutLocation } from "../types";
import { Logger } from "../utils/logger";

const execAsync = promisify(exec);

/**
 * Resolve a shortcut location to its filesystem path.
 */
function getShortcutDir(location: ShortcutLocation): string {
  const home = os.homedir();
  switch (location) {
    case "desktop":
      return path.join(home, "Desktop");
    case "start_menu":
      return path.join(
        home,
        "AppData",
        "Roaming",
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
      );
  }
}

/**
 * Create a Windows shortcut (.lnk file).
 */
export async function createShortcut(
  name: string,
  target: string,
  location: ShortcutLocation,
  logger: Logger,
): Promise<AppliedSideEffect> {
  const timestamp = new Date().toISOString();

  const shortcutDir = getShortcutDir(location);
  const shortcutPath = path.join(shortcutDir, `${name}.lnk`);

  try {
    // Ensure directory exists
    fs.mkdirSync(shortcutDir, { recursive: true });

    // PowerShell script to create a proper .lnk shortcut
    const psScript = [
      `$ws = New-Object -ComObject WScript.Shell;`,
      `$sc = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');`,
      `$sc.TargetPath = '${target.replace(/'/g, "''")}';`,
      `$sc.Save()`,
    ].join(" ");

    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`,
      { windowsHide: true },
    );

    logger.info(
      { name, target, location, path: shortcutPath },
      "Created shortcut",
    );

    return {
      type: "shortcut_create",
      target: shortcutPath,
      value: target,
      applied: true,
      applied_at: timestamp,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ name, target, error: message }, "Failed to create shortcut");
    return {
      type: "shortcut_create",
      target: shortcutPath,
      value: target,
      applied: false,
      applied_at: timestamp,
    };
  }
}

/**
 * Remove a shortcut. Used during rollback.
 */
export async function removeShortcut(
  shortcutPath: string,
  logger: Logger,
): Promise<boolean> {
  try {
    if (fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
      logger.info({ path: shortcutPath }, "Removed shortcut");
    }
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { path: shortcutPath, error: message },
      "Failed to remove shortcut",
    );
    return false;
  }
}
