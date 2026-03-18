import { Elysia } from 'elysia';
import { authGuard } from '../../middleware/auth';
import db from '../../db/client';
import { statsController } from './stats.controller';

export const statsRoutes = new Elysia({ prefix: '/api' })
  .derive(() => ({
    db,
  }))
  .use(statsController)
  .get('/stats/top', () => '')
  .get('/stats', () => '')
  .guard({
    beforeHandle: authGuard,
  })
  .get('/stats/link/:id', () => '');
