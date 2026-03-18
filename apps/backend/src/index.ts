import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import db from './db/client';
import { initializeSchema } from './db/schema';
import { authRoutes } from './modules/auth/auth.routes';
import { linksRoutes } from './modules/links/links.routes';
import { logsRoutes } from './modules/logs/logs.routes';
import { categoriesRoutes, linkCategoriesRoutes } from './modules/categories/categories.routes';
import { statsRoutes } from './modules/stats/stats.routes';
import { badgesRoutes } from './modules/badges/badges.routes';
import { usersRoutes } from './modules/users/users.routes';
import { rateLimit } from './middleware/rateLimit';

// Initialize database schema
initializeSchema(db);
console.log('✅ Database schema initialized');

const app = new Elysia()
  .use(cors({
    origin: Bun.env.APP_URL || 'http://localhost:5173',
    credentials: true,
  }))
  .onError(({ code, error, set }) => {
    if (error.message === 'unauthorized' || error.message === 'invalid_token') {
      set.status = 401;
      return { error: 'unauthorized', message: 'Invalid or missing authentication token' };
    }
    if (error.message === 'Too many requests') {
      set.status = 429;
      return { error: 'too_many_requests', message: 'Rate limit exceeded. Please try again later.' };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'not_found', message: 'Resource not found' };
    }
    console.error('Unhandled error:', error);
    set.status = 500;
    return { error: 'internal_error', message: 'An unexpected error occurred' };
  })
  .use(authRoutes)
  .use(linksRoutes)
  .use(logsRoutes)
  .use(categoriesRoutes(db))
  .use(linkCategoriesRoutes(db))
  .use(statsRoutes)
  .use(badgesRoutes)
  .use(usersRoutes)
  .get('/', () => ({ status: 'ok' }))
  .listen(Bun.env.PORT || 3000);

console.log(`🦊 Backend running at http://localhost:${app.server?.port}`);
