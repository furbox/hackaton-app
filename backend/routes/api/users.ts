import { getSession, type Session } from "../../middleware/auth/index.ts";
import {
  getPublicProfile,
  updateProfile,
  changePassword,
  type ServiceActor,
} from "../../services/users.service.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../../contracts/service-error.ts";

export interface UsersRouteDeps {
  getSession: (request: Request) => Promise<Session | null>;
  getPublicProfile: (actor: ServiceActor, input: { username: string }) => Phase4ServiceResult<unknown>;
  updateProfile: (actor: ServiceActor, input: UpdateProfileInput) => Phase4ServiceResult<unknown>;
  changePassword: (actor: ServiceActor, input: ChangePasswordInput) => Promise<Phase4ServiceResult<unknown>>;
}

export interface UpdateProfileInput {
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

function defaultDeps(): UsersRouteDeps {
  return {
    getSession,
    getPublicProfile,
    updateProfile,
    changePassword,
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

async function parseActorRequired(request: Request, deps: UsersRouteDeps): Promise<
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
 * Handles users routes:
 * - GET /api/users/:username - Get public profile (no auth required)
 * - PUT /api/users/me - Update own profile (auth required)
 * - PUT /api/users/me/password - Change password (auth required)
 *
 * @param request - HTTP request
 * @param path - Request path
 * @param deps - Optional dependencies for testing
 * @returns Response or null if path doesn't match
 *
 * @example
 * ```typescript
 * const response = await handleUsersRoute(request, "/api/users/alice");
 * if (response) return response;
 * ```
 */
export async function handleUsersRoute(
  request: Request,
  path: string,
  deps?: Partial<UsersRouteDeps>
): Promise<Response | null> {
  const resolvedDeps = { ...defaultDeps(), ...deps };

  // GET /api/users/:username - Public profile (no auth required)
  if (path.startsWith("/api/users/") && request.method === "GET") {
    // Extract username from path: /api/users/:username
    const username = path.replace("/api/users/", "");

    // Empty username check (e.g., /api/users/ or /api/users//)
    if (!username) {
      return Response.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
        },
        { status: 404 }
      );
    }

    const session = await resolvedDeps.getSession(request);
    const actor = parseActorOptional(session);
    const serviceResult = resolvedDeps.getPublicProfile(actor, { username });

    if (!serviceResult.ok) {
      const { status, body } = mapPhase4ServiceError(serviceResult.error);
      return Response.json(body, { status });
    }

    return Response.json(serviceResult.data);
  }

  // PUT /api/users/me - Update own profile (auth required)
  if (path === "/api/users/me" && request.method === "PUT") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid JSON in request body",
          },
        },
        { status: 400 }
      );
    }

    // Validate body is an object and not null/array
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Request body must be an object",
          },
        },
        { status: 400 }
      );
    }

    const serviceResult = resolvedDeps.updateProfile(actorResult.actor, body);

    if (!serviceResult.ok) {
      const { status, body: errorBody } = mapPhase4ServiceError(serviceResult.error);
      return Response.json(errorBody, { status });
    }

    return Response.json(serviceResult.data);
  }

  // PUT /api/users/me/password - Change password (auth required)
  if (path === "/api/users/me/password" && request.method === "PUT") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid JSON in request body",
          },
        },
        { status: 400 }
      );
    }

    // Validate body is an object and not null/array
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Request body must be an object",
          },
        },
        { status: 400 }
      );
    }

    // Type assertion after validation - body is now known to be an object
    const passwordData = body as ChangePasswordInput;

    // Validate required fields
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Both currentPassword and newPassword are required",
          },
        },
        { status: 400 }
      );
    }

    const serviceResult = await resolvedDeps.changePassword(actorResult.actor, passwordData);

    if (!serviceResult.ok) {
      const { status, body: errorBody } = mapPhase4ServiceError(serviceResult.error);
      return Response.json(errorBody, { status });
    }

    return Response.json(serviceResult.data);
  }

  // Path not handled by this router
  return null;
}
