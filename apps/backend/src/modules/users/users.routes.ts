import { Elysia } from 'elysia';
import { authGuard } from '../../middleware/auth';
import db from '../../db/client';
import { usersController } from './users.controller';

export const usersRoutes = new Elysia({ prefix: '/api' })
  .derive(() => ({
    db,
  }))
  .get('/users/:username', () => '')
  .guard({
    beforeHandle: authGuard,
  })
  .use(usersController);
