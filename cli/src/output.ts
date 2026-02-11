/**
 * UAS CLI — Output Helpers
 *
 * Centralized formatting for all CLI output: colors, spinners, tables.
 * Uses chalk (v4, CommonJS compatible) for ANSI colors,
 * ora for spinners, and cli-table3 for tabular data.
 *
 * All user-visible output flows through this module so we can
 * control verbosity and support --json mode in the future.
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';

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
};

// ─── Print Helpers ──────────────────────────────────────────

export function printSuccess(msg: string): void {
  console.log(colors.success('✔ ') + msg);
}

export function printError(msg: string): void {
  console.error(colors.error('✖ ') + msg);
}

export function printWarn(msg: string): void {
  console.log(colors.warn('⚠ ') + msg);
}

export function printInfo(msg: string): void {
  console.log(colors.info('ℹ ') + msg);
}

export function printDryRun(msg: string): void {
  console.log(colors.warn('[DRY RUN] ') + msg);
}

// ─── Spinner ────────────────────────────────────────────────

export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan' });
}

// ─── Tables ─────────────────────────────────────────────────

export interface TableOptions {
  head: string[];
  rows: string[][];
}

export function printTable({ head, rows }: TableOptions): void {
  const table = new Table({
    head: head.map((h) => chalk.bold.cyan(h)),
    style: { head: [], border: ['gray'] },
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

export function formatState(state: string): string {
  const colorFn = STATE_COLORS[state] || chalk.white;
  return colorFn(state);
}

// ─── Byte Formatting ────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
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
