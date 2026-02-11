/**
 * UAS Backend — Install History Routes
 *
 * POST /api/history               — Record an install event
 * GET  /api/history               — List user's install history
 * GET  /api/history/machine/:id   — History for a specific machine
 * GET  /api/history/app/:appId    — History for a specific app
 */

import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { Database } from "../db";
import { requireAuth } from "../auth";
import { RecordInstallSchema } from "../schemas";

export function historyRoutes(db: Database, jwtSecret: string): Router {
  const router = Router();

  router.use(requireAuth(jwtSecret));

  // POST /api/history
  router.post("/", (req: Request, res: Response) => {
    const parse = RecordInstallSchema.safeParse(req.body);
    if (!parse.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parse.error.flatten() });
      return;
    }

    const { userId } = (req as any).user;
    const { machine_id, app_id, version, action, status, details } = parse.data;

    // Verify machine belongs to user
    const machine = db.getOne<{ id: string }>(
      "SELECT id FROM machines WHERE id = ? AND user_id = ?",
      [machine_id, userId],
    );

    if (!machine) {
      res.status(404).json({ error: "Machine not found or not owned by you" });
      return;
    }

    const id = uuid();
    db.run(
      "INSERT INTO install_history (id, user_id, machine_id, app_id, version, action, status, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        userId,
        machine_id,
        app_id,
        version,
        action,
        status,
        JSON.stringify(details || {}),
      ],
    );

    // Update machine last_sync
    db.run("UPDATE machines SET last_sync = datetime('now') WHERE id = ?", [
      machine_id,
    ]);
    db.persist();

    res.status(201).json({
      event: {
        id,
        user_id: userId,
        machine_id,
        app_id,
        version,
        action,
        status,
      },
    });
  });

  // GET /api/history
  router.get("/", (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const rows = db.getAll(
      "SELECT * FROM install_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [userId, limit, offset],
    );

    const events = rows.map((r: any) => ({
      ...r,
      details: JSON.parse(r.details),
    }));

    res.json({ events, limit, offset });
  });

  // GET /api/history/machine/:id
  router.get("/machine/:id", (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const rows = db.getAll(
      "SELECT * FROM install_history WHERE user_id = ? AND machine_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, req.params.id, limit],
    );

    const events = rows.map((r: any) => ({
      ...r,
      details: JSON.parse(r.details),
    }));

    res.json({ events });
  });

  // GET /api/history/app/:appId
  router.get("/app/:appId", (req: Request, res: Response) => {
    const { userId } = (req as any).user;

    const rows = db.getAll(
      "SELECT * FROM install_history WHERE user_id = ? AND app_id = ? ORDER BY created_at DESC",
      [userId, req.params.appId],
    );

    const events = rows.map((r: any) => ({
      ...r,
      details: JSON.parse(r.details),
    }));

    res.json({ events });
  });

  return router;
}
