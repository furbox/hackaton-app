import { Elysia } from 'elysia';
import { authGuard } from '../../middleware/auth';
import db from '../../db/client';
import { badgesController } from './badges.controller';

export const badgesRoutes = new Elysia({ prefix: '/api' })
  .derive(() => ({
    db,
  }))
  .use(badgesController)
  .guard({
    beforeHandle: authGuard,
  })
  .get('/badges/me', () => '')
  .get('/badges/:username', () => '');
