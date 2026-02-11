/**
 * UAS Backend — Health Route
 *
 * GET /api/health — Service health check
 */

import { Router, Request, Response } from 'express';

export function healthRoutes(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
    });
  });

  return router;
}
