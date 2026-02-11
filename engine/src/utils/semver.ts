/**
 * UAS Engine -- Semver Utilities
 *
 * Uses the "semver" npm package for proper version comparison.
 * Wraps it with UAS-specific helpers for normalization and
 * upgrade/downgrade classification.
 */

import semver from "semver";

/**
 * Strip leading "v" or "V", trim whitespace.
 *
 * Examples:
 *   "v24.12.0"  -> "24.12.0"
 *   " V1.2.3 "  -> "1.2.3"
 *   "1.0"       -> "1.0"
 */
export function normalizeSemver(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

/**
 * Coerce a version string into a valid semver, or return null.
 * Handles partial versions like "24.12" -> "24.12.0".
 */
export function coerceSemver(version: string): string | null {
  const coerced = semver.coerce(normalizeSemver(version));
  return coerced ? coerced.version : null;
}

/**
 * Compare two version strings using proper semver.
 *
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *   null if either string is not a valid semver
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 | null {
  const ca = semver.coerce(normalizeSemver(a));
  const cb = semver.coerce(normalizeSemver(b));
  if (!ca || !cb) return null;
  return semver.compare(ca, cb);
}

/**
 * Check whether a version string can be parsed as semver.
 */
export function isValidSemver(version: string): boolean {
  return semver.coerce(normalizeSemver(version)) !== null;
}

/**
 * Determine the upgrade relationship between two versions.
 *
 * Returns:
 *   "same"      -- versions are identical
 *   "upgrade"   -- target is newer than installed
 *   "downgrade" -- target is older than installed
 *   "unknown"   -- one or both versions couldn't be parsed
 */
export function classifyVersionChange(
  installed: string,
  target: string,
): "same" | "upgrade" | "downgrade" | "unknown" {
  const cmp = compareSemver(installed, target);
  if (cmp === null) return "unknown";
  if (cmp === 0) return "same";
  if (cmp < 0) return "upgrade";
  return "downgrade";
}
