/**
 * UAS Engine — Windows MSI Executor (Hardened)
 *
 * Production-grade MSI installation via msiexec.
 *
 * Fixes over the original executor:
 * 1. Properly quotes paths with spaces (INSTALLDIR="C:\Program Files\...")
 * 2. Uses correct MSI property syntax (KEY="VALUE")
 * 3. Maps all common MSI exit codes to structured errors
 * 4. Captures stderr for diagnostics
 * 5. Logs the exact command for debugging
 * 6. Adds /norestart to prevent unexpected reboots
 * 7. Generates msiexec log file for forensics
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "../utils/logger";
import { resolveVariables } from "../utils/variables";
import { lookupMsiExitCode, MsiExitCodeInfo } from "./types";

export interface MsiInstallOptions {
  /** Absolute path to the .msi file */
  msiPath: string;
  /** MSI property overrides (e.g., { INSTALLDIR: "C:\\..." }) */
  properties?: Record<string, string>;
  /** Override install directory (takes precedence over properties.INSTALLDIR) */
  installDirOverride?: string;
  /** App ID (for log file naming) */
  appId: string;
  /** App name + version (for messages) */
  displayName: string;
  /** Whether to run in dry-run mode */
  dryRun: boolean;
  /** Logger */
  logger: Logger;
}

export interface MsiInstallResult {
  success: boolean;
  exitCode: number;
  exitCodeInfo: MsiExitCodeInfo;
  rebootRequired: boolean;
  message: string;
  /** Full msiexec command that was (or would be) executed */
  command: string;
  /** Path to the msiexec log file */
  logFile?: string;
  /** Captured stderr output */
  stderr?: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Quote a value for MSI property assignment.
 * MSI properties with spaces MUST be quoted: INSTALLDIR="C:\Program Files\foo"
 */
function quoteMsiValue(value: string): string {
  // Always wrap in quotes — harmless if no spaces, essential if there are
  // Remove any existing outer quotes first to avoid double-quoting
  const stripped = value.replace(/^"(.*)"$/, "$1");
  return `"${stripped}"`;
}

/**
 * Build the msiexec argument array from the options.
 *
 * Resulting command shape:
 *   msiexec /i "path\to\installer.msi" /qn /norestart /l*v "logfile.log" KEY="VALUE" ...
 */
export function buildMsiArgs(opts: MsiInstallOptions): {
  args: string[];
  logFile: string;
} {
  const logDir = path.join(os.homedir(), ".uas", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `msi-${opts.appId}-${Date.now()}.log`);

  const args: string[] = [
    "/i",
    opts.msiPath, // msiexec handles its own path quoting with /i
    "/qn", // Quiet, no UI
    "/norestart", // Never auto-restart
    `/l*v`, // Verbose logging
    logFile,
  ];

  // Collect properties (resolve variables, quote values)
  const props: Record<string, string> = {};

  if (opts.properties) {
    for (const [key, rawValue] of Object.entries(opts.properties)) {
      props[key] = resolveVariables(rawValue);
    }
  }

  // Override INSTALLDIR if specified
  if (opts.installDirOverride) {
    props["INSTALLDIR"] = opts.installDirOverride;
  }

  // Append properties with proper quoting
  for (const [key, value] of Object.entries(props)) {
    // MSI property syntax: KEY="VALUE" (no space around =)
    args.push(`${key}=${quoteMsiValue(value)}`);
  }

  return { args, logFile };
}

/**
 * Format the msiexec command as a string for logging.
 */
function formatCommand(args: string[]): string {
  return `msiexec.exe ${args.join(" ")}`;
}

/**
 * Execute an MSI installation via msiexec.
 *
 * This is the hardened MSI installer that:
 * - Properly quotes all paths
 * - Uses /qn /norestart
 * - Captures exit codes with structured categorisation
 * - Produces verbose log files
 * - Captures stderr
 */
export async function executeMsi(
  opts: MsiInstallOptions,
): Promise<MsiInstallResult> {
  const { logger, dryRun, displayName } = opts;
  const { args, logFile } = buildMsiArgs(opts);
  const command = formatCommand(args);

  logger.info({ command, logFile }, `MSI install: ${displayName}`);

  if (dryRun) {
    return {
      success: true,
      exitCode: 0,
      exitCodeInfo: lookupMsiExitCode(0),
      rebootRequired: false,
      message: `[DRY RUN] Would execute: ${command}`,
      command,
      logFile,
      durationMs: 0,
    };
  }

  const startMs = Date.now();

  return new Promise<MsiInstallResult>((resolve) => {
    const stderrChunks: Buffer[] = [];

    const child = spawn("msiexec.exe", args, {
      stdio: ["ignore", "ignore", "pipe"], // capture stderr
      windowsHide: true,
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - startMs;
      const exitCode = code ?? 1;
      const info = lookupMsiExitCode(exitCode);
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();

      if (stderr) {
        logger.debug({ stderr }, "msiexec stderr output");
      }

      if (!info.ok) {
        logger.error(
          {
            exitCode,
            exitCodeName: info.name,
            category: info.category,
            logFile,
            durationMs,
          },
          `MSI install failed: ${info.message}`,
        );

        // Extra diagnostics for ERROR_INSTALL_FAILURE (1603)
        if (exitCode === 1603) {
          logger.error(
            { logFile },
            "Exit code 1603 (fatal installation error). " +
              "Common causes: a newer version is already installed, " +
              "installer blocked by Windows, or a previous install is incomplete. " +
              "Check the MSI log for details.",
          );
        }

        // Extra diagnostics for ERROR_INVALID_COMMAND_LINE (1639)
        if (exitCode === 1639) {
          logger.error(
            { fullCommand: command },
            "Exit code 1639 means invalid arguments. " +
              "Verify MSI property syntax: KEY=\"VALUE\" with no spaces around '='.",
          );
        }
      } else {
        logger.info(
          { exitCode, exitCodeName: info.name, durationMs },
          `MSI install completed: ${displayName}`,
        );
      }

      resolve({
        success: info.ok,
        exitCode,
        exitCodeInfo: info,
        rebootRequired: exitCode === 3010 || exitCode === 1641,
        message: info.ok
          ? `Installed ${displayName}${exitCode === 3010 ? " (reboot required)" : ""}`
          : exitCode === 1603
            ? `MSI returned 1603 (Fatal installation error).\n` +
              `This often happens when:\n` +
              `  - A newer version is already installed\n` +
              `  - Installer is blocked by Windows\n` +
              `  - A previous install is incomplete\n` +
              `MSI log: ${logFile}`
            : `MSI install failed [${info.name}]: ${info.message}`,
        command,
        logFile,
        stderr: stderr || undefined,
        durationMs,
      });
    });

    child.on("error", (err) => {
      const durationMs = Date.now() - startMs;
      logger.error({ error: err.message }, "Failed to launch msiexec.exe");
      resolve({
        success: false,
        exitCode: -1,
        exitCodeInfo: {
          code: -1,
          name: "LAUNCH_FAILURE",
          category: "fatal",
          message: `Failed to launch msiexec: ${err.message}`,
          ok: false,
        },
        rebootRequired: false,
        message: `Failed to launch msiexec.exe: ${err.message}`,
        command,
        logFile,
        durationMs,
      });
    });
  });
}
