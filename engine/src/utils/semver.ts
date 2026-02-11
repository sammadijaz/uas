/**
 * UAS Engine — Semver Utilities
 *
 * Lightweight semver comparison for version strings.
 * Handles common quirks: "v" prefix, leading zeros, whitespace.
 *
 * This is intentionally NOT a full semver library — it handles the
 * major.minor.patch patterns seen in real-world installer versions
 * (e.g. "24.12.0", "v22.11.0", "3.14.2").
 */

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  /** Original input after normalization */
  normalized: string;
}

/**
 * Strip leading "v" or "V", trim whitespace, collapse dots.
 *
 * Examples:
 *   "v24.12.0"  → "24.12.0"
 *   " V1.2.3 "  → "1.2.3"
 *   "1.0"       → "1.0"
 */
export function normalizeSemver(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

/**
 * Parse a version string into major.minor.patch parts.
 * Returns null if the string cannot be parsed.
 *
 * Accepts:
 *   "1.2.3", "v1.2.3", "24.12.0", "1.0" (patch defaults to 0)
 */
export function parseSemver(version: string): SemverParts | null {
  const normalized = normalizeSemver(version);
  const match = normalized.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] !== undefined ? parseInt(match[3], 10) : 0,
    normalized,
  };
}

/**
 * Compare two semver strings.
 *
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *   null if either string is not a valid semver
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  return 0;
}

/**
 * Check whether a version string is a valid semver (major.minor.patch).
 */
export function isValidSemver(version: string): boolean {
  return parseSemver(version) !== null;
}

/**
 * Determine the upgrade relationship between two versions.
 *
 * Returns:
 *   "same"      — versions are identical
 *   "upgrade"   — target is newer than installed
 *   "downgrade" — target is older than installed
 *   "unknown"   — one or both versions couldn't be parsed
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
