/**
 * Session middleware for the EJS frontend.
 *
 * Uses the backend as the source of truth — no local token parsing.
 * Each authenticated page makes one extra round-trip to /api/auth/session.
 */

import { apiFetch } from "../api/client.ts";
import type { Controller } from "../router.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  bio?: string | null;
  rank: string;
}

interface BackendSessionUser {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  rank?: string;
}

/** Shape returned by backend GET /api/auth/session */
interface SessionResponse {
  user?: BackendSessionUser;
  session?: unknown;
}

// ─── getSession ───────────────────────────────────────────────────────────────

/**
 * Calls `GET /api/auth/session` forwarding the browser cookie.
 * Returns the `User` object on success, or `null` on 401 / any error.
 */
export async function getSession(request: Request): Promise<User | null> {
  const result = await apiFetch<SessionResponse>(
    "/api/auth/session",
    { method: "GET" },
    request
  );

  if (!result.ok || !result.data) return null;

  const backendUser = result.data.user ?? null;
  if (!backendUser) return null;

  return {
    ...backendUser,
    avatar_url: backendUser.avatar_url ?? backendUser.avatarUrl ?? null,
    rank: backendUser.rank ?? "newbie",
  };
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Returns a 302 redirect Response if `user` is null, otherwise `null`.
 *
 * Usage:
 *   const redirect = requireAuth(user);
 *   if (redirect) return redirect;
 */
export function requireAuth(
  user: User | null,
  redirectPath = "/auth/login"
): Response | null {
  if (user !== null) return null;
  return Response.redirect(redirectPath, 302);
}

// ─── withAuth HOF ─────────────────────────────────────────────────────────────

/**
 * Higher-order function that wraps a controller with auth enforcement.
 *
 * If the request has no valid session → 302 to /auth/login.
 * If authenticated → calls the inner handler with `user` injected.
 *
 * Usage:
 *   addRoute('GET', '/dashboard', withAuth(dashboardController));
 */
export function withAuth(
  handler: (
    req: Request,
    params: Record<string, string>,
    user: User
  ) => Promise<Response>
): Controller {
  return async (req: Request, params: Record<string, string>) => {
    const user = await getSession(req);
    const redirect = requireAuth(user);
    if (redirect) return redirect;
    return handler(req, params, user!);
  };
}
