/**
 * UAS Backend — Profile Routes
 *
 * POST   /api/profiles            — Create a profile
 * GET    /api/profiles            — List user's profiles
 * GET    /api/profiles/:id        — Get a specific profile
 * PUT    /api/profiles/:id        — Update a profile
 * DELETE /api/profiles/:id        — Delete a profile
 */

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { Database } from '../db';
import { requireAuth } from '../auth';
import { CreateProfileSchema, UpdateProfileSchema } from '../schemas';

export function profileRoutes(db: Database, jwtSecret: string): Router {
  const router = Router();

  // All profile routes require authentication
  router.use(requireAuth(jwtSecret));

  // POST /api/profiles
  router.post('/', (req: Request, res: Response) => {
    const parse = CreateProfileSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
      return;
    }

    const { userId } = (req as any).user;
    const { name, description, data } = parse.data;
    const id = uuid();

    db.run(
      'INSERT INTO profiles (id, user_id, name, description, data) VALUES (?, ?, ?, ?, ?)',
      [id, userId, name, description || '', JSON.stringify(data)]
    );
    db.persist();

    res.status(201).json({
      profile: { id, user_id: userId, name, description: description || '', data },
    });
  });

  // GET /api/profiles
  router.get('/', (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const rows = db.getAll<{ id: string; name: string; description: string; data: string; created_at: string; updated_at: string }>(
      'SELECT id, name, description, data, created_at, updated_at FROM profiles WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );

    const profiles = rows.map((r) => ({
      ...r,
      data: JSON.parse(r.data as string),
    }));

    res.json({ profiles });
  });

  // GET /api/profiles/:id
  router.get('/:id', (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const row = db.getOne<{ id: string; user_id: string; name: string; description: string; data: string; created_at: string; updated_at: string }>(
      'SELECT * FROM profiles WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (!row) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      profile: { ...row, data: JSON.parse(row.data as string) },
    });
  });

  // PUT /api/profiles/:id
  router.put('/:id', (req: Request, res: Response) => {
    const parse = UpdateProfileSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation failed', details: parse.error.flatten() });
      return;
    }

    const { userId } = (req as any).user;
    const existing = db.getOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (parse.data.name !== undefined) {
      updates.push('name = ?');
      params.push(parse.data.name);
    }
    if (parse.data.description !== undefined) {
      updates.push('description = ?');
      params.push(parse.data.description);
    }
    if (parse.data.data !== undefined) {
      updates.push('data = ?');
      params.push(JSON.stringify(parse.data.data));
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(req.params.id, userId);

      db.run(
        `UPDATE profiles SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
      db.persist();
    }

    // Fetch updated
    const updated = db.getOne<{ id: string; user_id: string; name: string; description: string; data: string; created_at: string; updated_at: string }>(
      'SELECT * FROM profiles WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    res.json({
      profile: { ...updated, data: JSON.parse((updated as any).data) },
    });
  });

  // DELETE /api/profiles/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const existing = db.getOne<{ id: string }>(
      'SELECT id FROM profiles WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    db.run('DELETE FROM profiles WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    db.persist();

    res.status(204).send();
  });

  return router;
}
