import { Elysia } from 'elysia';
import { authController } from './auth.controller';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .post('/register', async ({ body }) => {
    const result = await authController.register(body as { username: string; email: string; password: string });
    return Response.json(result.body, { status: result.status });
  })
  .get('/verify', async ({ query }) => {
    const result = await authController.verifyEmail(query.token as string);
    return Response.json(result.body, { status: result.status });
  })
  .post('/login', async ({ body }) => {
    const result = await authController.login(body as { email: string; password: string });
    return Response.json(result.body, { status: result.status });
  })
  .post('/forgot-password', async ({ body }) => {
    const result = await authController.forgotPassword(body as { email: string });
    return Response.json(result.body, { status: result.status });
  })
  .post('/reset-password', async ({ body }) => {
    const result = await authController.resetPassword(body as { token: string; newPassword: string });
    return Response.json(result.body, { status: result.status });
  });
