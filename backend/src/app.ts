/**
 * UAS Backend — Express Application Factory
 *
 * Creates and configures the Express app with all middleware and routes.
 * Separated from server.ts to enable testing with supertest.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Database } from './db';
import { Config } from './config';
import { authRoutes } from './routes/auth';
import { profileRoutes } from './routes/profiles';
import { machineRoutes } from './routes/machines';
import { historyRoutes } from './routes/history';
import { healthRoutes } from './routes/health';

export interface AppContext {
  app: express.Application;
  db: Database;
}

export function createApp(config: Config, db: Database): AppContext {
  const app = express();

  // ─── Middleware ────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  // ─── Routes ───────────────────────────────────────────────
  app.use('/api/health', healthRoutes());
  app.use('/api/auth', authRoutes(db, config.jwtSecret, config.jwtExpiry));
  app.use('/api/profiles', profileRoutes(db, config.jwtSecret));
  app.use('/api/machines', machineRoutes(db, config.jwtSecret));
  app.use('/api/history', historyRoutes(db, config.jwtSecret));

  // ─── 404 Handler ──────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ─── Error Handler ────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return { app, db };
}
