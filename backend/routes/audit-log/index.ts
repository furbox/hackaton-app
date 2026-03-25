import { authenticated, type AuthResult } from "../../auth/middleware.js";
import { getUserAuditLogs } from "../../services/audit-log.service.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export interface UserAuditRouteDeps {
  authenticate: (request: Request) => Promise<AuthResult>;
}

function parseLimit(rawValue: string | null): number {
  if (!rawValue) return DEFAULT_LIMIT;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
}

function parseUserId(value: unknown): number | null {
  const numericId = Number(value);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }
  return numericId;
}

function defaultDeps(): UserAuditRouteDeps {
  return {
    authenticate: authenticated,
  };
}

export async function handleAuditLogRoute(
  request: Request,
  path: string,
  deps?: Partial<UserAuditRouteDeps>
): Promise<Response | null> {
  if (request.method !== "GET" || path !== "/api/audit-log") {
    return null;
  }

  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();
  const authResult = await resolvedDeps.authenticate(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = parseUserId(authResult.user.id);
  if (userId === null) {
    return Response.json(
      { error: "Invalid session user id", code: "INVALID_SESSION" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const logs = getUserAuditLogs(userId, limit);

  return Response.json({
    logs,
    count: logs.length,
    limit,
  });
}
