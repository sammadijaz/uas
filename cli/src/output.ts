/**
 * UAS CLI -- Output Helpers
 *
 * Centralized formatting for all CLI output: colors, spinners, tables.
 * Uses chalk (v4, CommonJS compatible) for ANSI colors,
 * ora for spinners, and cli-table3 for tabular data.
 *
 * All user-visible output flows through this module so we can
 * control verbosity and support --json mode in the future.
 */

import chalk from "chalk";
import ora, { Ora } from "ora";
import Table from "cli-table3";

// ─── Debug Mode ─────────────────────────────────────────────

let _debugMode = false;

export function setDebugMode(enabled: boolean): void {
  _debugMode = enabled;
}

export function isDebugMode(): boolean {
  return _debugMode;
}

// ─── Color Shortcuts ────────────────────────────────────────

export const colors = {
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  dim: chalk.gray,
  bold: chalk.bold,
  app: chalk.bold.white,
  version: chalk.cyan,
  state: chalk.magenta,
  muted: chalk.gray,
};

// ─── Symbols (safe for Windows terminals) ───────────────────

export const symbols = {
  success: chalk.green("\u2714"), // ✔
  error: chalk.red("\u2716"), // ✖
  warn: chalk.yellow("\u26A0"), // ⚠
  info: chalk.cyan("\u2139"), // ℹ
  arrow: chalk.gray("\u2192"), // →
  bullet: chalk.gray("\u2022"), // •
  dash: chalk.gray("\u2500"), // ─
};

// ─── Print Helpers ──────────────────────────────────────────

export function printSuccess(msg: string): void {
  console.log(`${symbols.success} ${msg}`);
}

export function printError(msg: string): void {
  console.error(`${symbols.error} ${msg}`);
}

export function printWarn(msg: string): void {
  console.log(`${symbols.warn}  ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`${symbols.info} ${msg}`);
}

export function printDryRun(msg: string): void {
  console.log(colors.warn("[DRY RUN] ") + msg);
}

/**
 * Print a debug message. Only visible with --debug flag.
 */
export function printDebug(msg: string): void {
  if (_debugMode) {
    console.log(colors.muted(`  [debug] ${msg}`));
  }
}

/**
 * Print a blank separator line.
 */
export function printBlank(): void {
  console.log();
}

/**
 * Print an indented detail line (for sub-items under a stage).
 */
export function printDetail(label: string, value: string): void {
  console.log(`  ${colors.dim(label + ":")} ${value}`);
}

// ─── Stage Output ───────────────────────────────────────────

/**
 * Print a completed stage line with ✔ prefix.
 *
 *   ✔ Validated recipe
 *   ✔ Downloaded installer (cached)
 *   ✔ Installed Node.js v22.11.0
 */
export function printStageSuccess(msg: string): void {
  console.log(`  ${symbols.success} ${msg}`);
}

export function printStageError(msg: string): void {
  console.log(`  ${symbols.error} ${msg}`);
}

export function printStageWarn(msg: string): void {
  console.log(`  ${symbols.warn}  ${msg}`);
}

export function printStageInfo(msg: string): void {
  console.log(`  ${symbols.info} ${colors.dim(msg)}`);
}

// ─── Header / Banner ────────────────────────────────────────

/**
 * Print a bold header line, e.g.  "Installing Node.js v22.11.0"
 */
export function printHeader(msg: string): void {
  console.log();
  console.log(`  ${colors.bold(msg)}`);
  console.log();
}

// ─── Spinner ────────────────────────────────────────────────

export function createSpinner(text: string): Ora {
  return ora({ text, color: "cyan" });
}

// ─── Tables ─────────────────────────────────────────────────

export interface TableOptions {
  head: string[];
  rows: string[][];
}

export function printTable({ head, rows }: TableOptions): void {
  const table = new Table({
    head: head.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: ["gray"] },
  });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}

// ─── State Badge ────────────────────────────────────────────

const STATE_COLORS: Record<string, chalk.Chalk> = {
  PENDING: chalk.gray,
  VALIDATING: chalk.cyan,
  RESOLVING: chalk.cyan,
  DOWNLOADING: chalk.blue,
  VERIFYING: chalk.blue,
  EXECUTING: chalk.yellow,
  SIDE_EFFECTS: chalk.yellow,
  CONFIRMING: chalk.magenta,
  COMPLETED: chalk.green,
  FAILED: chalk.red,
  ROLLING_BACK: chalk.red,
  ROLLED_BACK: chalk.red,
};

/** Human-friendly state labels */
const STATE_LABELS: Record<string, string> = {
  PENDING: "Starting",
  VALIDATING: "Validating",
  RESOLVING: "Resolving",
  DOWNLOADING: "Downloading",
  VERIFYING: "Verifying",
  EXECUTING: "Installing",
  SIDE_EFFECTS: "Applying changes",
  CONFIRMING: "Confirming",
  COMPLETED: "Done",
  FAILED: "Failed",
  ROLLING_BACK: "Rolling back",
  ROLLED_BACK: "Rolled back",
};

export function formatState(state: string): string {
  const colorFn = STATE_COLORS[state] || chalk.white;
  return colorFn(STATE_LABELS[state] || state);
}

// ─── Error Category Labels ──────────────────────────────────

const ERROR_LABELS: Record<string, string> = {
  VALIDATION_ERROR: "Invalid recipe or configuration",
  REQUIREMENT_ERROR: "Missing system requirement",
  NETWORK_ERROR: "Network or download failure",
  INTEGRITY_ERROR: "File integrity check failed",
  EXECUTION_ERROR: "Installer execution failed",
  PERMISSION_ERROR: "Insufficient permissions",
  VERIFICATION_ERROR: "Post-install verification failed",
  ROLLBACK_ERROR: "Rollback failed",
  DOWNGRADE_BLOCKED: "Downgrade not allowed",
};

export function formatErrorCategory(category: string): string {
  return ERROR_LABELS[category] || category;
}

// ─── Byte Formatting ────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ─── Duration ───────────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}
