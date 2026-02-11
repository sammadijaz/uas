/**
 * UAS Backend — Machine Routes
 *
 * POST   /api/machines       — Register a machine
 * GET    /api/machines       — List user's machines
 * GET    /api/machines/:id   — Get machine details
 * DELETE /api/machines/:id   — Unregister a machine
 */

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { Database } from '../db';
import { requireAuth } from '../auth';
import { RegisterMachineSchema } from '../schemas';

export function machineRoutes(db: Database, jwtSecret: string): Router {
  const router = Router();

  router.use(requireAuth(jwtSecret));

  // POST /api/machines
  router.post('/', (req: Request, res: Response) => {
    const parse = RegisterMachineSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
      return;
    }

    const { userId } = (req as any).user;
    const { name, hostname, os_version } = parse.data;
    const id = uuid();

    db.run(
      'INSERT INTO machines (id, user_id, name, hostname, os_version) VALUES (?, ?, ?, ?, ?)',
      [id, userId, name, hostname || '', os_version || '']
    );
    db.persist();

    res.status(201).json({
      machine: { id, user_id: userId, name, hostname: hostname || '', os_version: os_version || '' },
    });
  });

  // GET /api/machines
  router.get('/', (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const rows = db.getAll(
      'SELECT id, name, hostname, os_version, last_sync, created_at FROM machines WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json({ machines: rows });
  });

  // GET /api/machines/:id
  router.get('/:id', (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const machine = db.getOne(
      'SELECT * FROM machines WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (!machine) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    res.json({ machine });
  });

  // DELETE /api/machines/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const existing = db.getOne<{ id: string }>(
      'SELECT id FROM machines WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    db.run('DELETE FROM machines WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    db.persist();

    res.status(204).send();
  });

  return router;
}
