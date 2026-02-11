/**
 * UAS Engine — Windows Elevation Helper
 *
 * Handles UAC elevation requests for operations that need admin privileges.
 * On Windows, certain operations (MSI installs to Program Files, system PATH,
 * HKLM registry) require elevation.
 *
 * The engine NEVER runs elevated by default. Elevation is per-operation.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Check if the current process is running with administrator privileges.
 */
export async function isElevated(): Promise<boolean> {
  try {
    // 'net session' succeeds only when running as admin
    await execAsync("net session", { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a command with elevation via PowerShell's Start-Process -Verb RunAs.
 * This triggers a UAC prompt for the user.
 *
 * @param command - The executable to run (absolute path)
 * @param args - Arguments to pass
 * @param waitForExit - Whether to wait for the elevated process to finish
 * @returns Exit code of the elevated process (if waitForExit is true)
 */
export async function runElevated(
  command: string,
  args: string[],
  waitForExit: boolean = true,
): Promise<number> {
  // Escape arguments for PowerShell
  const escapedArgs = args.map((a) => `'${a.replace(/'/g, "''")}'`).join(", ");
  const argsArray = args.length > 0 ? `-ArgumentList @(${escapedArgs})` : "";
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

  try {
    await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`,
      { windowsHide: true },
    );
    return 0;
  } catch (error: unknown) {
    // If the user denied UAC, the error code is typically 1
    if (error && typeof error === "object" && "code" in error) {
      return (error as { code: number }).code;
    }
    return 1;
  }
}
