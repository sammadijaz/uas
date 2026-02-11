/**
 * UAS Backend — Configuration
 *
 * Central configuration loaded from environment variables with sensible defaults.
 */

export interface Config {
  /** Server port */
  port: number;
  /** Node environment */
  env: string;
  /** JWT signing secret */
  jwtSecret: string;
  /** JWT token expiry (e.g. '7d', '24h') */
  jwtExpiry: string;
  /** Path to the SQLite database file (empty = in-memory) */
  dbPath: string;
  /** CORS allowed origins (comma-separated) */
  corsOrigins: string[];
  /** Log level */
  logLevel: string;
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.UAS_PORT || '3100', 10),
    env: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.UAS_JWT_SECRET || 'uas-dev-secret-change-me',
    jwtExpiry: process.env.UAS_JWT_EXPIRY || '7d',
    dbPath: process.env.UAS_DB_PATH || '',
    corsOrigins: (process.env.UAS_CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
    logLevel: process.env.UAS_LOG_LEVEL || 'info',
  };
}
