import { getSession, type Session } from "../../middleware/auth/index.ts";
import {
  getUserStats,
  getGlobalStats,
  type ServiceActor,
} from "../../services/stats.service.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../../contracts/service-error.ts";

export interface StatsRouteDeps {
  getSession: (request: Request) => Promise<Session | null>;
  getUserStats: (actor: ServiceActor) => Phase4ServiceResult<unknown>;
  getGlobalStats: () => Phase4ServiceResult<unknown>;
}

function defaultDeps(): StatsRouteDeps {
  return {
    getSession,
    getUserStats,
    getGlobalStats,
  };
}

function unauthorizedError(message = "Authentication required"): Response {
  return Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message,
      },
    },
    { status: 401 }
  );
}

function parseActorOptional(session: Session | null): ServiceActor {
  if (!session) {
    return null;
  }

  const numericUserId = Number(session.user.id);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    return null;
  }

  return { userId: numericUserId };
}

async function parseActorRequired(request: Request, deps: StatsRouteDeps): Promise<
  | { ok: true; actor: NonNullable<ServiceActor> }
  | { ok: false; response: Response }
> {
  const session = await deps.getSession(request);
  if (!session) {
    return { ok: false, response: unauthorizedError() };
  }

  const actor = parseActorOptional(session);
  if (!actor) {
    return {
      ok: false,
      response: unauthorizedError("Invalid session user id"),
    };
  }

  return { ok: true, actor };
}

/**
 * Handles stats routes:
 * - GET /api/stats/me - Get authenticated user's stats (requires auth)
 * - GET /api/stats/global - Get platform-wide stats (public)
 *
 * @param request - HTTP request
 * @param path - Request path (e.g., "/api/stats/me", "/api/stats/global")
 * @param deps - Optional dependencies for testing
 * @returns Response or null if path doesn't match
 *
 * @example
 * ```typescript
 * const response = await handleStatsRoute(request, "/api/stats/me");
 * if (response) return response;
 * ```
 */
export async function handleStatsRoute(
  request: Request,
  path: string,
  deps?: Partial<StatsRouteDeps>
): Promise<Response | null> {
  const resolvedDeps = { ...defaultDeps(), ...deps };

  // GET /api/stats/me - Requires authentication
  if (path === "/api/stats/me" && request.method === "GET") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const serviceResult = resolvedDeps.getUserStats(actorResult.actor);

    if (!serviceResult.ok) {
      const { status, body } = mapPhase4ServiceError(serviceResult.error);
      return Response.json(body, { status });
    }

    return Response.json({
      data: serviceResult.data,
    });
  }

  // GET /api/stats/global - Public endpoint, no auth required
  if (path === "/api/stats/global" && request.method === "GET") {
    const serviceResult = resolvedDeps.getGlobalStats();

    if (!serviceResult.ok) {
      const { status, body } = mapPhase4ServiceError(serviceResult.error);
      return Response.json(body, { status });
    }

    return Response.json({
      data: serviceResult.data,
    });
  }

  // Path not handled by this router
  return null;
}
