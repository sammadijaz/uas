/**
 * UAS Engine — Structured Logger
 *
 * Wraps pino for structured, human-readable logging.
 * All engine operations log through this module.
 */

import pino from "pino";

export interface LoggerOptions {
  level: "debug" | "info" | "warn" | "error";
  pretty: boolean;
}

const DEFAULT_OPTIONS: LoggerOptions = {
  level: "info",
  pretty: true,
};

export function createLogger(
  options: Partial<LoggerOptions> = {},
): pino.Logger {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return pino({
    level: opts.level,
    transport: opts.pretty
      ? {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        }
      : undefined,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = pino.Logger;
