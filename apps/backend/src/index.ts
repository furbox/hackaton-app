import { Elysia } from 'elysia';
import db from './db/client';
import { initializeSchema } from './db/schema';

// Initialize database schema
initializeSchema(db);
console.log('✅ Database schema initialized');

const app = new Elysia()
  .get('/', () => ({ status: 'ok' }))
  .listen(Bun.env.PORT || 3000);

console.log(`🦊 Backend running at http://localhost:${app.server?.port}`);
