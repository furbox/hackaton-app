import { Elysia } from 'elysia';
import db from '../../db/client';
import { logVisit } from './logs.service';

const logsRoutes = (app: Elysia) =>
  app
    .post('/api/logs', ({ db, body, set }) => {
      const { link_id, ip_hash, action } = body as { link_id: number; ip_hash: string; action: string };

      if (action === 'view') {
        logVisit(db, link_id, ip_hash);
        set.status = 201;
        return { success: true };
      }

      set.status = 400;
      return { error: 'invalid_action', message: 'Only view action is supported via this endpoint' };
    });

export { logsRoutes };
