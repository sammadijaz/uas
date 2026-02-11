/**
 * UAS Backend — Server Entry Point
 *
 * Starts the HTTP server. This is the main entry point for production.
 * For tests, use app.ts directly with supertest.
 */

import { loadConfig } from "./config";
import { Database } from "./db";
import { createApp } from "./app";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = new Database(config.dbPath);
  await db.init();

  const { app } = createApp(config, db);

  const server = app.listen(config.port, () => {
    console.log(`UAS Backend running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.env}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down...");
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
