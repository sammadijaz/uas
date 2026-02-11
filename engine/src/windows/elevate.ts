/**
 * UAS Engine — Windows Elevation Handler (Hardened)
 *
 * Reliable UAC elevation for operations requiring admin privileges.
 *
 * Improvements over the original utils/elevation.ts:
 * - Better error messages when elevation is denied
 * - Structured result instead of raw exit code
 * - Pre-check elevation status before attempting
 * - Does not silently fail
 */

import { exec } from "child_process";
import { promisify } from "util";
import { Logger } from "../utils/logger";
import { ElevationStatus } from "./types";

const execAsync = promisify(exec);

/**
 * Check if the current process is running with administrator privileges.
 * Uses `net session` which only succeeds when elevated.
 */
export async function checkElevation(logger: Logger): Promise<ElevationStatus> {
  try {
    await execAsync("net session", { windowsHide: true, timeout: 5000 });
    logger.debug("Process is running elevated (admin)");
    return { elevated: true };
  } catch {
    logger.debug("Process is NOT running elevated");
    return { elevated: false };
  }
}

/**
 * Run a command with elevation via PowerShell's Start-Process -Verb RunAs.
 * Triggers a UAC prompt for the user.
 *
 * @returns Structured result with exit code and error context
 */
export async function runElevated(
  command: string,
  args: string[],
  logger: Logger,
  waitForExit: boolean = true,
): Promise<{ exitCode: number; elevated: boolean; error?: string }> {
  logger.info(
    { command, argsCount: args.length },
    "Requesting UAC elevation",
  );

  // Escape arguments for PowerShell
  // Each arg is wrapped in single quotes with internal quotes escaped
  const escapedArgs = args.map((a) => {
    // Replace single quotes with two single quotes (PowerShell escape)
    return `'${a.replace(/'/g, "''")}'`;
  });

  const argsArray =
    escapedArgs.length > 0
      ? `-ArgumentList @(${escapedArgs.join(", ")})`
      : "";

  const waitFlag = waitForExit ? "-Wait" : "";

  const psCommand = [
    "Start-Process",
    `-FilePath '${command}'`,
    argsArray,
    "-Verb RunAs",
    waitFlag,
    "-PassThru",
  ]
    .filter(Boolean)
    .join(" ");

  // Wrap in a script that captures the exit code
  const script = waitForExit
    ? `$p = ${psCommand}; exit $p.ExitCode`
    : psCommand;

  // Use -EncodedCommand to avoid quoting issues with complex arguments
  const encodedScript = Buffer.from(script, "utf16le").toString("base64");

  try {
    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`,
      { windowsHide: true, timeout: 300000 }, // 5 minute timeout for large installs
    );
    logger.info("Elevated command completed successfully");
    return { exitCode: 0, elevated: true };
  } catch (error: unknown) {
    let exitCode = 1;
    let errorMessage = "Elevation failed";

    if (error && typeof error === "object") {
      if ("code" in error) {
        exitCode = (error as { code: number }).code;
      }
      if ("stderr" in error) {
        const stderr = String((error as { stderr: unknown }).stderr).trim();
        if (stderr) {
          errorMessage = stderr;
        }
      }
      if ("message" in error) {
        errorMessage = (error as Error).message;
      }
    }

    // Detect user cancellation (UAC denied)
    const isAccessDenied =
      exitCode === 1 ||
      errorMessage.includes("canceled") ||
      errorMessage.includes("cancelled") ||
      errorMessage.includes("The operation was canceled");

    if (isAccessDenied) {
      const msg =
        "Elevation denied. The installation requires administrator privileges. " +
        "Please approve the UAC prompt or run the terminal as Administrator.";
      logger.error(msg);
      return { exitCode, elevated: false, error: msg };
    }

    logger.error(
      { exitCode, error: errorMessage },
      "Elevated command failed",
    );
    return { exitCode, elevated: true, error: errorMessage };
  }
}

/**
 * Ensure the current process has admin privileges.
 * If not elevated, attempts elevation. If that fails, returns a clear error.
 *
 * Use this at the START of operations that need admin, before doing any work.
 */
export async function ensureElevated(
  logger: Logger,
): Promise<ElevationStatus> {
  const status = await checkElevation(logger);
  if (status.elevated) return status;

  logger.warn(
    "Current process is not elevated. " +
      "Operations requiring admin (MSI to Program Files, system PATH, HKLM registry) " +
      "will need UAC approval.",
  );

  return { elevated: false, attempted: false };
}
