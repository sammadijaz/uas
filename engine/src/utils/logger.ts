/**
 * UAS Engine -- Structured Logger
 *
 * Wraps pino for structured, human-readable logging.
 * All engine operations log through this module.
 *
 * When verbose=false (default), logging is silent -- no JSON logs are
 * emitted to stdout. This ensures CLI users only see clean output.
 * When verbose=true (--debug mode), structured logs go to stderr.
 *
 * NOTE: We use pino.destination() instead of pino transports because
 * transports spawn worker_threads which break inside esbuild bundles.
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

  // Use pino.destination() for synchronous I/O — no worker_threads.
  // This is bundle-safe and works identically when published to npm.
  const dest = opts.pretty
    ? pino.destination({ fd: 2, sync: true }) // stderr
    : undefined;

  return pino(
    {
      level: opts.level,
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    dest ?? pino.destination({ fd: 2, sync: true }),
  );
}

export type Logger = pino.Logger;
