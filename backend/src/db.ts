/**
 * UAS Backend — Database Layer
 *
 * Uses sql.js (pure JS SQLite) for zero-dependency persistence.
 * Supports both in-memory (for tests) and file-backed modes.
 */

import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import * as fs from "fs";
import * as path from "path";

export class Database {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string = "") {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    if (this.dbPath && fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initSchema();
  }

  private initSchema(): void {
    const db = this.getDb();

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS machines (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL DEFAULT '',
        os_version TEXT NOT NULL DEFAULT '',
        last_sync TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS install_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        machine_id TEXT NOT NULL,
        app_id TEXT NOT NULL,
        version TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      )
    `);

    // Indexes
    db.run("CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_machines_user ON machines(user_id)");
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_history_user ON install_history(user_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_history_machine ON install_history(machine_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_history_app ON install_history(app_id)",
    );
  }

  private getDb(): SqlJsDatabase {
    if (!this.db)
      throw new Error("Database not initialized. Call init() first.");
    return this.db;
  }

  /**
   * Run an INSERT/UPDATE/DELETE statement.
   */
  run(sql: string, params: unknown[] = []): void {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as any[]);
    stmt.step();
    stmt.free();
  }

  /**
   * Query a single row.
   */
  getOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): T | null {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as any[]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }

    stmt.free();
    return null;
  }

  /**
   * Query multiple rows.
   */
  getAll<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): T[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params as any[]);

    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }

    stmt.free();
    return rows;
  }

  /**
   * Persist database to disk (if a path was configured).
   */
  persist(): void {
    if (!this.dbPath || !this.db) return;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /**
   * Close the database.
   */
  close(): void {
    if (this.db) {
      this.persist();
      this.db.close();
      this.db = null;
    }
  }
}
