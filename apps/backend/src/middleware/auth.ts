import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';

interface User {
  userId: number;
  username: string;
  email: string;
  rank: string;
}

export const authMiddleware = (app: Elysia) =>
  app.derive(async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('unauthorized');
    }

    const token = authHeader.substring(7);
    const jwtSecret = Bun.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('invalid_token');
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const signatureData = `${encodedHeader}.${encodedPayload}`;

      const isValid = await crypto.subtle.verify(
        'HMAC',
        await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(jwtSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        ),
        Buffer.from(signature, 'base64url'),
        new TextEncoder().encode(signatureData)
      );

      if (!isValid) {
        throw new Error('invalid_token');
      }

      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

      return {
        user: {
          userId: payload.sub,
          username: payload.username,
          email: payload.email,
          rank: payload.rank,
        } as User,
      };
    } catch (error) {
      throw new Error('unauthorized');
    }
  });

export const authGuard = async ({ request, set }: { request: Request; set: any }) => {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    set.status = 401;
    throw new Error('unauthorized');
  }

  const token = authHeader.substring(7);
  const jwtSecret = Bun.env.JWT_SECRET;

  if (!jwtSecret) {
    set.status = 500;
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      set.status = 401;
      throw new Error('invalid_token');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureData = `${encodedHeader}.${encodedPayload}`;

    const isValid = await crypto.subtle.verify(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(jwtSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      ),
      Buffer.from(signature, 'base64url'),
      new TextEncoder().encode(signatureData)
    );

    if (!isValid) {
      set.status = 401;
      throw new Error('invalid_token');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

    return {
      user: {
        userId: payload.sub,
        username: payload.username,
        email: payload.email,
        rank: payload.rank,
      } as User,
    };
  } catch (error) {
    set.status = 401;
    throw new Error('unauthorized');
  }
};
