import { requireAdmin, type AuthResult } from "../../../middleware/auth/index.js";
import {
  getAllAuditLogs,
  type AuditEvent,
  type AuditLogFilters,
} from "../../../services/audit-log.service.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const VALID_EVENTS: ReadonlySet<AuditEvent> = new Set([
  "register",
  "login",
  "logout",
  "email_verified",
  "verification_resent",
  "password_change",
  "password_reset_requested",
  "password_reset_completed",
  "token_rejected",
  "session_revoked",
  "api_key_created",
  "api_key_revoked",
  "role_changed",
  "user_banned",
  "user_unbanned",
  "impersonation_started",
  "impersonation_ended",
]);

export interface AdminAuditRouteDeps {
  authorize: (request: Request) => Promise<AuthResult>;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function parseEvent(value: string | null): AuditEvent | undefined {
  if (!value) return undefined;
  if (VALID_EVENTS.has(value as AuditEvent)) {
    return value as AuditEvent;
  }
  return undefined;
}

function parseUserId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function defaultDeps(): AdminAuditRouteDeps {
  return {
    authorize: requireAdmin,
  };
}

export async function handleAdminAuditLogRoute(
  request: Request,
  path: string,
  deps?: Partial<AdminAuditRouteDeps>
): Promise<Response | null> {
  if (request.method !== "GET" || path !== "/api/admin/audit-log") {
    return null;
  }

  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();
  const authResult = await resolvedDeps.authorize(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const adminId = parseUserId(authResult.user.id);
  if (adminId === null) {
    return Response.json(
      { error: "Invalid admin session", code: "INVALID_SESSION" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const requestedEvent = url.searchParams.get("event");
  const parsedEvent = parseEvent(requestedEvent);
  if (requestedEvent && !parsedEvent) {
    return Response.json(
      { error: "Invalid event filter", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const filters: AuditLogFilters = {
    userId: parsePositiveInt(url.searchParams.get("userId")),
    event: parsedEvent,
    limit: parseLimit(url.searchParams.get("limit")),
    offset: parseOffset(url.searchParams.get("offset")),
  };

  const logs = getAllAuditLogs(filters);

  return Response.json({
    logs,
    filters,
    returned: logs.length,
    adminId,
  });
}
