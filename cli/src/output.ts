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

// ─── Force UTF-8 encoding on Windows ───────────────────────
// Prevents broken characters (ΓÇö) when terminals default to legacy codepages.
if (process.platform === "win32") {
  try {
    if (process.stdout.setEncoding) process.stdout.setEncoding("utf8");
    if (process.stderr.setEncoding) process.stderr.setEncoding("utf8");
  } catch {
    /* swallow — some environments don't support setEncoding on stdout */
  }
}

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

/** Minimum terminal width below which we switch to compact (no-table) layout */
const MIN_TABLE_WIDTH = 70;

/** Default terminal width when process.stdout.columns is unavailable */
const DEFAULT_TERMINAL_WIDTH = 80;

/**
 * Detect whether to use ASCII-only box drawing characters.
 * On Windows cmd/PowerShell without TERM set, Unicode borders corrupt.
 */
export function shouldUseAsciiBorders(): boolean {
  return process.platform === "win32" && !process.env.TERM;
}

/**
 * Get the usable terminal width in columns.
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || DEFAULT_TERMINAL_WIDTH;
}

/**
 * Truncate a plain-text string to `max` visible characters, appending "..."
 * if it was shortened. Never returns a string longer than `max`.
 */
export function truncateText(s: string, max: number): string {
  if (max < 4) return s.slice(0, max);
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

/**
 * Strip ANSI escape codes to get the visible length of a string.
 */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

/**
 * Pad or truncate a (possibly ANSI-colored) string to exactly `width`
 * visible characters. Truncates with "..." if over; right-pads if under.
 */
function fitToWidth(s: string, width: number): string {
  const visible = stripAnsi(s);
  if (visible.length <= width) {
    return s + " ".repeat(width - visible.length);
  }
  // Need to truncate — work character by character preserving ANSI
  const RESET = "\u001b[0m";
  let out = "";
  let visCount = 0;
  const target = width - 3; // leave room for "..."
  let i = 0;
  while (i < s.length && visCount < target) {
    if (s[i] === "\u001b") {
      // Consume entire escape sequence
      const end = s.indexOf("m", i);
      if (end !== -1) {
        out += s.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    out += s[i];
    visCount++;
    i++;
  }
  return out + RESET + "...";
}

export interface TableColumn {
  /** Header label */
  header: string;
  /** Minimum column width (content area, excluding borders) */
  minWidth?: number;
  /**
   * If true, this column absorbs remaining space and shrinks first
   * when the terminal is narrow. Only one column should be flexible.
   */
  flexible?: boolean;
}

export interface AdaptiveTableOptions {
  /** Column definitions */
  columns: TableColumn[];
  /**
   * Row data — each inner array must match columns.length.
   * Values may contain ANSI color codes.
   */
  rows: string[][];
}

export interface CompactItem {
  /** Primary label displayed as the heading line */
  label: string;
  /** Key-value pairs displayed indented below the label */
  fields: { key: string; value: string }[];
}

/**
 * Calculate column widths that fit within `termWidth`.
 *
 * Strategy:
 * 1. Start each column at its minWidth (default 8).
 * 2. The flexible column gets all remaining space.
 * 3. If there is no remaining space, the flexible column gets its minWidth.
 * 4. All columns are clamped to >= minWidth.
 *
 * cli-table3 colWidths include 2 chars of padding (1 left + 1 right)
 * plus 1 char per border. With N columns there are N+1 border chars.
 */
function calculateColWidths(
  columns: TableColumn[],
  termWidth: number,
): number[] {
  const borderOverhead = columns.length + 1; // N+1 border chars (│)
  const paddingPerCol = 2; // 1 space each side
  const available = termWidth - borderOverhead;

  const minWidths = columns.map((c) => Math.max(c.minWidth ?? 8, 4));
  const flexIdx = columns.findIndex((c) => c.flexible);

  // Sum of all non-flexible minimums
  const fixedSum = minWidths.reduce(
    (sum, w, i) => sum + (i === flexIdx ? 0 : w + paddingPerCol),
    0,
  );

  const widths = minWidths.map((min, i) => {
    if (i === flexIdx) {
      const remaining = available - fixedSum - paddingPerCol;
      return Math.max(remaining, min);
    }
    return min;
  });

  // Return as cli-table3 colWidths (content + padding)
  return widths.map((w) => w + paddingPerCol);
}

/**
 * Print a table that adapts to terminal width.
 *
 * - Wide terminal  → full bordered table with dynamic column sizing
 * - Narrow terminal (<70 cols) → compact card-style layout
 * - Windows cmd without TERM → ASCII borders instead of Unicode
 * - Content that exceeds column width → truncated with "...", never wraps
 */
export function printAdaptiveTable(opts: AdaptiveTableOptions): void {
  const termWidth = getTerminalWidth();
  const { columns, rows } = opts;

  // ─── Narrow fallback: compact card layout ───
  if (termWidth < MIN_TABLE_WIDTH) {
    printCompactList(
      rows.map((row) => ({
        label: stripAnsi(row[0]),
        fields: columns.slice(1).map((col, i) => ({
          key: col.header,
          value: row[i + 1],
        })),
      })),
    );
    return;
  }

  // ─── Calculate widths ───
  const colWidths = calculateColWidths(columns, termWidth);
  // Content width is colWidth - padding (2)
  const contentWidths = colWidths.map((w) => w - 2);

  // ─── Pick border style ───
  const ascii = shouldUseAsciiBorders();
  const chars = ascii
    ? {
        top: "-",
        "top-mid": "+",
        "top-left": "+",
        "top-right": "+",
        bottom: "-",
        "bottom-mid": "+",
        "bottom-left": "+",
        "bottom-right": "+",
        left: "|",
        "left-mid": "+",
        mid: "-",
        "mid-mid": "+",
        right: "|",
        "right-mid": "+",
        middle: "|",
      }
    : undefined; // cli-table3 default Unicode

  // ─── Fit all cells ───
  const fittedRows = rows.map((row) =>
    row.map((cell, i) => fitToWidth(cell, contentWidths[i])),
  );

  // ─── Build table ───
  const tableOpts: Record<string, unknown> = {
    head: columns.map((c) => chalk.bold.cyan(c.header)),
    colWidths,
    style: { head: [], border: ascii ? [] : ["gray"] },
    wordWrap: false,
  };
  if (chars) {
    tableOpts.chars = chars;
  }

  const table = new Table(tableOpts as ConstructorParameters<typeof Table>[0]);
  for (const row of fittedRows) {
    table.push(row);
  }
  console.log(table.toString());
}

/**
 * Print a compact card-style list for narrow terminals.
 *
 * Example:
 *   node
 *     Version:     20.11.1
 *     Status:      available
 *     Description: JavaScript runtime built on V8
 */
export function printCompactList(items: CompactItem[]): void {
  for (const item of items) {
    console.log(colors.app(item.label));
    const maxKeyLen = Math.max(...item.fields.map((f) => f.key.length));
    for (const f of item.fields) {
      const padded = f.key.padEnd(maxKeyLen);
      console.log(`  ${colors.dim(padded + ":")} ${f.value}`);
    }
    console.log();
  }
}

// ─── Legacy printTable (backward-compatible) ────────────────

export interface TableOptions {
  head: string[];
  rows: string[][];
  colWidths?: number[];
}

/**
 * Simple table printer (legacy API kept for callers that don't need
 * adaptive sizing). For the list command use `printAdaptiveTable`.
 */
export function printTable({ head, rows, colWidths }: TableOptions): void {
  const ascii = shouldUseAsciiBorders();
  const tableOpts: Record<string, unknown> = {
    head: head.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: ascii ? [] : ["gray"] },
    wordWrap: false,
  };
  if (colWidths) {
    tableOpts.colWidths = colWidths;
  }
  if (ascii) {
    tableOpts.chars = {
      top: "-",
      "top-mid": "+",
      "top-left": "+",
      "top-right": "+",
      bottom: "-",
      "bottom-mid": "+",
      "bottom-left": "+",
      "bottom-right": "+",
      left: "|",
      "left-mid": "+",
      mid: "-",
      "mid-mid": "+",
      right: "|",
      "right-mid": "+",
      middle: "|",
    };
  }
  const table = new Table(tableOpts as ConstructorParameters<typeof Table>[0]);
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
