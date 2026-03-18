import { Elysia } from 'elysia';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitStore>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const rateLimit = (config: RateLimitConfig) => {
  const { maxRequests, windowMs } = config;

  return new Elysia({ name: 'rate-limit' })
    .onBeforeHandle(({ request, set }) => {
      const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown';
      
      const now = Date.now();
      const record = store.get(ip);

      if (!record || now > record.resetTime) {
        store.set(ip, {
          count: 1,
          resetTime: now + windowMs,
        });
        return;
      }

      if (record.count >= maxRequests) {
        set.status = 429;
        set.headers['Retry-After'] = Math.ceil((record.resetTime - now) / 1000).toString();
        throw new Error('Too many requests');
      }

      record.count++;
      
      const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);
      set.headers['X-RateLimit-Limit'] = maxRequests.toString();
      set.headers['X-RateLimit-Remaining'] = (maxRequests - record.count).toString();
      set.headers['X-RateLimit-Reset'] = resetTimeSeconds.toString();
    });
};

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [ip, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(ip);
    }
  }
}

setInterval(cleanupRateLimitStore, 60000);
