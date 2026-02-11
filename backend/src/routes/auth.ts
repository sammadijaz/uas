/**
 * UAS Backend — Auth Routes
 *
 * POST /api/auth/register  — Create a new account
 * POST /api/auth/login     — Authenticate and get a JWT
 * GET  /api/auth/me        — Get current user info (requires auth)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { Database } from '../db';
import { hashPassword, verifyPassword, generateToken, requireAuth } from '../auth';
import { RegisterSchema, LoginSchema } from '../schemas';

export function authRoutes(db: Database, jwtSecret: string, jwtExpiry: string): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response) => {
    const parse = RegisterSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
      return;
    }

    const { username, email, password } = parse.data;

    // Check uniqueness
    const existing = db.getOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }

    const id = uuid();
    const passwordHash = await hashPassword(password);

    db.run(
      'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
      [id, username, email, passwordHash]
    );
    db.persist();

    const token = generateToken({ userId: id, username }, jwtSecret, jwtExpiry);

    res.status(201).json({
      user: { id, username, email },
      token,
    });
  });

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response) => {
    const parse = LoginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
      return;
    }

    const { username, password } = parse.data;

    const user = db.getOne<{ id: string; username: string; email: string; password_hash: string }>(
      'SELECT id, username, email, password_hash FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(
      { userId: user.id as string, username: user.username as string },
      jwtSecret,
      jwtExpiry
    );

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  });

  // GET /api/auth/me
  router.get('/me', requireAuth(jwtSecret), (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const user = db.getOne<{ id: string; username: string; email: string; created_at: string }>(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  });

  return router;
}
