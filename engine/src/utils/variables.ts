/**
 * UAS Engine — Path Variable Resolution
 *
 * Recipes use variables like ${LOCALAPPDATA} instead of hardcoded paths.
 * This module resolves those variables to actual Windows paths.
 *
 * See: /docs/specs/install-recipe.md → "Path Variables" section
 */

import * as path from "path";
import * as os from "os";

/**
 * Map of supported path variables to their resolved values.
 * Lazily computed on first access.
 */
function getVariableMap(): Record<string, string> {
  const env = process.env;
  const home = os.homedir();

  return {
    LOCALAPPDATA: env.LOCALAPPDATA || path.join(home, "AppData", "Local"),
    APPDATA: env.APPDATA || path.join(home, "AppData", "Roaming"),
    USERPROFILE: env.USERPROFILE || home,
    PROGRAMFILES: env.PROGRAMFILES || "C:\\Program Files",
    PROGRAMFILES_X86: env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
    TEMP: env.TEMP || path.join(home, "AppData", "Local", "Temp"),
    UAS_APPS:
      env.UAS_APPS ||
      path.join(
        env.LOCALAPPDATA || path.join(home, "AppData", "Local"),
        "uas",
        "apps",
      ),
  };
}

/**
 * Resolve all ${VARIABLE} references in a path string.
 *
 * @param input - Path string containing ${VARIABLE} references
 * @returns Resolved path with all variables replaced
 * @throws Error if an unknown variable is referenced
 *
 * @example
 * resolveVariables("${LOCALAPPDATA}\\uas\\apps\\node")
 * // → "C:\\Users\\Jane\\AppData\\Local\\uas\\apps\\node"
 */
export function resolveVariables(input: string): string {
  const variables = getVariableMap();

  return input.replace(/\$\{([A-Z_]+)\}/g, (_match, varName: string) => {
    const value = variables[varName];
    if (value === undefined) {
      throw new Error(
        `Unknown path variable: \${${varName}}. ` +
          `Supported variables: ${Object.keys(variables).join(", ")}`,
      );
    }
    return value;
  });
}

/**
 * Validate that a path string only contains known variables.
 * Does not resolve — just checks.
 */
export function validateVariables(input: string): string[] {
  const known = new Set(Object.keys(getVariableMap()));
  const errors: string[] = [];

  const pattern = /\$\{([A-Z_]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (!known.has(match[1])) {
      errors.push(`Unknown variable: \${${match[1]}}`);
    }
  }

  return errors;
}

/**
 * Get all supported variable names and their current values.
 * Useful for debugging and dry-run output.
 */
export function getResolvedVariables(): Record<string, string> {
  return { ...getVariableMap() };
}
