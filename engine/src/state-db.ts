/**
 * UAS Engine — State Database
 *
 * Local SQLite database that tracks:
 * - What apps are installed (and their versions)
 * - Installation history (every attempt, success or failure)
 * - Side effects applied (for rollback support)
 * - Execution log (state transitions)
 *
 * This is the single source of truth for the local machine's state.
 * Schema matches the contracts in /docs/specs/execution-lifecycle.md.
 *
 * Uses sql.js (Emscripten-compiled SQLite) for zero-native-dependency operation.
 * The database is persisted to disk on every write operation.
 */

import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import * as path from "path";
import * as fs from "fs";
import { InstalledApp, AppliedSideEffect, ExecutionState } from "./types";
import { Logger } from "./utils/logger";

export class StateDB {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private logger: Logger;
  private initialized = false;

  constructor(dbPath: string, logger: Logger) {
    this.dbPath = dbPath;
    this.logger = logger;
  }

  /**
   * Initialize the database. Must be called before any operations.
   * sql.js requires async initialization.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });

    const SQL = await initSqlJs();

    // Load existing database if it exists
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initialized = true;
    this.initSchema();
    this.logger.debug({ path: this.dbPath }, "State database initialized");
  }

  /**
   * Ensure db is initialized, throw if not.
   */
  private ensureInit(): SqlJsDatabase {
    if (!this.db || !this.initialized) {
      throw new Error("StateDB not initialized. Call init() first.");
    }
    return this.db;
  }

  /**
   * Persist database to disk.
   */
  private persist(): void {
    const db = this.ensureInit();
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Create tables if they don't exist.
   */
  private initSchema(): void {
    const db = this.ensureInit();
    db.run(`
      CREATE TABLE IF NOT EXISTS installed_apps (
        app_id        TEXT    PRIMARY KEY,
        version       TEXT    NOT NULL,
        installed_at  TEXT    NOT NULL,
        install_dir   TEXT,
        recipe_hash   TEXT    NOT NULL,
        side_effects  TEXT    NOT NULL DEFAULT '[]'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS installation_log (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id  TEXT    NOT NULL,
        app_id        TEXT    NOT NULL,
        state         TEXT    NOT NULL,
        entered_at    TEXT    NOT NULL,
        exited_at     TEXT,
        result        TEXT,
        details       TEXT,
        dry_run       INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_log_execution
        ON installation_log (execution_id)
    `);
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_log_app
        ON installation_log (app_id)
    `);

    this.persist();
  }

  // ─── Installed Apps ──────────────────────────────────────────

  /**
   * Record a newly installed application.
   */
  recordInstall(app: InstalledApp): void {
    const db = this.ensureInit();
    db.run(
      `INSERT OR REPLACE INTO installed_apps
         (app_id, version, installed_at, install_dir, recipe_hash, side_effects)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        app.app_id,
        app.version,
        app.installed_at,
        app.install_dir || null,
        app.recipe_hash,
        JSON.stringify(app.side_effects),
      ],
    );
    this.persist();
    this.logger.debug(
      { app_id: app.app_id, version: app.version },
      "Recorded installation",
    );
  }

  /**
   * Remove an app from the installed list (after uninstall or rollback).
   */
  removeInstall(appId: string): void {
    const db = this.ensureInit();
    db.run("DELETE FROM installed_apps WHERE app_id = ?", [appId]);
    this.persist();
    this.logger.debug({ app_id: appId }, "Removed installation record");
  }

  /**
   * Get a specific installed app, or null if not installed.
   */
  getInstalledApp(appId: string): InstalledApp | null {
    const db = this.ensureInit();
    const stmt = db.prepare("SELECT * FROM installed_apps WHERE app_id = ?");
    stmt.bind([appId]);

    if (!stmt.step()) {
      stmt.free();
      return null;
    }

    const row = stmt.getAsObject();
    stmt.free();

    return {
      app_id: row.app_id as string,
      version: row.version as string,
      installed_at: row.installed_at as string,
      install_dir: (row.install_dir as string) || undefined,
      recipe_hash: row.recipe_hash as string,
      side_effects: JSON.parse(
        row.side_effects as string,
      ) as AppliedSideEffect[],
    };
  }

  /**
   * Get all installed apps.
   */
  getAllInstalledApps(): InstalledApp[] {
    const db = this.ensureInit();
    const results: InstalledApp[] = [];
    const stmt = db.prepare("SELECT * FROM installed_apps ORDER BY app_id");

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        app_id: row.app_id as string,
        version: row.version as string,
        installed_at: row.installed_at as string,
        install_dir: (row.install_dir as string) || undefined,
        recipe_hash: row.recipe_hash as string,
        side_effects: JSON.parse(
          row.side_effects as string,
        ) as AppliedSideEffect[],
      });
    }
    stmt.free();

    return results;
  }

  /**
   * Check if an app is installed.
   */
  isInstalled(appId: string): boolean {
    const db = this.ensureInit();
    const stmt = db.prepare("SELECT 1 FROM installed_apps WHERE app_id = ?");
    stmt.bind([appId]);
    const exists = stmt.step();
    stmt.free();
    return exists;
  }

  // ─── Execution Log ──────────────────────────────────────────

  /**
   * Log a state transition in the execution lifecycle.
   */
  logStateTransition(
    executionId: string,
    appId: string,
    state: ExecutionState,
    result?: "success" | "failure",
    details?: Record<string, unknown>,
    dryRun: boolean = false,
  ): void {
    const db = this.ensureInit();
    const now = new Date().toISOString();

    // Close the previous state for this execution
    db.run(
      `UPDATE installation_log
       SET exited_at = ?, result = ?
       WHERE execution_id = ? AND exited_at IS NULL`,
      [now, result || null, executionId],
    );

    // Open the new state
    db.run(
      `INSERT INTO installation_log
         (execution_id, app_id, state, entered_at, details, dry_run)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        executionId,
        appId,
        state,
        now,
        details ? JSON.stringify(details) : null,
        dryRun ? 1 : 0,
      ],
    );

    this.persist();
  }

  /**
   * Get the full execution log for a specific execution ID.
   */
  getExecutionLog(executionId: string): Array<{
    state: ExecutionState;
    entered_at: string;
    exited_at: string | null;
    result: string | null;
    details: Record<string, unknown> | null;
  }> {
    const db = this.ensureInit();
    const results: Array<{
      state: ExecutionState;
      entered_at: string;
      exited_at: string | null;
      result: string | null;
      details: Record<string, unknown> | null;
    }> = [];

    const stmt = db.prepare(
      `SELECT state, entered_at, exited_at, result, details
       FROM installation_log
       WHERE execution_id = ?
       ORDER BY id ASC`,
    );
    stmt.bind([executionId]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        state: row.state as ExecutionState,
        entered_at: row.entered_at as string,
        exited_at: (row.exited_at as string) || null,
        result: (row.result as string) || null,
        details: row.details ? JSON.parse(row.details as string) : null,
      });
    }
    stmt.free();

    return results;
  }

  /**
   * Get recent installation history for an app.
   */
  getAppHistory(
    appId: string,
    limit: number = 10,
  ): Array<{
    execution_id: string;
    state: ExecutionState;
    entered_at: string;
    result: string | null;
    dry_run: boolean;
  }> {
    const db = this.ensureInit();
    const results: Array<{
      execution_id: string;
      state: ExecutionState;
      entered_at: string;
      result: string | null;
      dry_run: boolean;
    }> = [];

    const stmt = db.prepare(
      `SELECT DISTINCT execution_id, state, entered_at, result, dry_run
       FROM installation_log
       WHERE app_id = ? AND state IN ('COMPLETED', 'FAILED', 'ROLLED_BACK')
       ORDER BY entered_at DESC
       LIMIT ?`,
    );
    stmt.bind([appId, limit]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        execution_id: row.execution_id as string,
        state: row.state as ExecutionState,
        entered_at: row.entered_at as string,
        result: (row.result as string) || null,
        dry_run: (row.dry_run as number) === 1,
      });
    }
    stmt.free();

    return results;
  }

  /**
   * Close the database connection and persist final state.
   */
  close(): void {
    if (this.db) {
      if (this.initialized) {
        this.persist();
      }
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
    this.logger.debug("State database closed");
  }
}
