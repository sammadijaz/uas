/**
 * UAS Engine -- Structured Logger
 *
 * Wraps pino for structured, human-readable logging.
 * All engine operations log through this module.
 *
 * When verbose=false (default), logging is silent -- no JSON logs are
 * emitted to stdout. This ensures CLI users only see clean output.
 * When verbose=true (--debug mode), structured logs go to stderr.
 */

import pino from "pino";

export interface LoggerOptions {
  level: "silent" | "debug" | "info" | "warn" | "error";
  pretty: boolean;
}

const DEFAULT_OPTIONS: LoggerOptions = {
  level: "silent",
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
          options: { destination: 2 }, // stderr (not stdout)
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
