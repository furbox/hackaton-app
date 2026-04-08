/**
 * Auth Rate Limiter
 *
 * Fixed-window in-memory rate limiter scoped to auth endpoints.
 * Limits each IP to `MAX_REQUESTS` requests per `WINDOW_MS` milliseconds.
 *
 * ## Tradeoffs
 * - ✅ Zero dependencies, sub-millisecond check latency
 * - ✅ Deterministic: window resets at `resetAt` timestamp
 * - ⚠️  Resets on server restart (documented, accepted for Phase 3.4)
 * - ⚠️  Not distributed (one instance only; replace with Redis in Phase N)
 *
 * @module backend/routes/auth/rate-limit
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of requests per IP per window. */
const MAX_REQUESTS = 5;

/** Window duration in milliseconds (1 minute). */
const WINDOW_MS = 60_000;

// ============================================================================
// TYPES
// ============================================================================

interface Bucket {
  /** Number of requests made in the current window. */
  count: number;
  /** Timestamp (ms) when the window resets. */
  resetAt: number;
}

// ============================================================================
// STATE
// ============================================================================

/**
 * In-memory bucket map: IP address → current window state.
 *
 * Exported for testing (allows resetting state between test cases).
 */
export const rateLimitBuckets = new Map<string, Bucket>();

// ============================================================================
// RESULT TYPE
// ============================================================================

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Checks whether the given IP is within the rate limit.
 *
 * Increments the counter and returns:
 * - `{ allowed: true }` if under the limit
 * - `{ allowed: false, retryAfterSeconds }` if over the limit
 *
 * @param ip - Client IP address (use "unknown" as fallback)
 * @returns Rate limit check result
 *
 * @example
 * ```typescript
 * const rl = checkRateLimit(ip);
 * if (!rl.allowed) {
 *   return new Response(null, {
 *     status: 429,
 *     headers: { "Retry-After": String(rl.retryAfterSeconds) }
 *   });
 * }
 * ```
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(ip);

  // Initialize or reset expired window
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    rateLimitBuckets.set(ip, bucket);
  }

  // Increment counter
  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS) {
    // Compute seconds until window resets (ceil to avoid Retry-After: 0)
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

/**
 * Resets the rate-limit state for a specific IP.
 *
 * Primarily useful for tests to clean up between cases.
 *
 * @param ip - IP address to reset
 */
export function resetRateLimit(ip: string): void {
  rateLimitBuckets.delete(ip);
}

/**
 * Clears ALL rate-limit state.
 *
 * Use only in tests or server shutdown.
 */
export function clearAllRateLimits(): void {
  rateLimitBuckets.clear();
}
