/**
 * Audit Log Service — Phase 3.8
 *
 * Database-backed audit logging for auth and security events.
 *
 * @module backend/services/audit-log.service
 */

import { getDatabase } from "../db/connection.js";

export type AuditEvent =
  | "register"
  | "login"
  | "logout"
  | "email_verified"
  | "verification_resent"
  | "password_change"
  | "password_reset_requested"
  | "password_reset_completed"
  | "token_rejected"
  | "session_revoked"
  | "api_key_created"
  | "api_key_revoked"
  | "role_changed"
  | "user_banned"
  | "user_unbanned"
  | "impersonation_started"
  | "impersonation_ended";

export interface AuditLogParams {
  userId?: number;
  event: AuditEvent;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  event: AuditEvent;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogFilters {
  userId?: number;
  event?: AuditEvent;
  limit?: number;
  offset?: number;
}

interface AuditLogRow {
  id: number;
  user_id: number | null;
  event: AuditEvent;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
}

const DEFAULT_USER_LOG_LIMIT = 50;
const DEFAULT_ADMIN_LOG_LIMIT = 100;
const MAX_LIMIT = 500;

function clampLimit(limit: number, fallback: number): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)));
}

function clampOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    event: row.event,
    ipAddress: row.ip_address ?? "unknown",
    userAgent: row.user_agent ?? "unknown",
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

export function extractRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const trustProxy = process.env.TRUST_PROXY === "true";

  let ipAddress = "unknown";
  if (trustProxy) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      ipAddress = forwardedFor.split(",")[0]?.trim() || "unknown";
    } else {
      const realIp = request.headers.get("x-real-ip");
      if (realIp) {
        ipAddress = realIp.trim();
      }
    }
  }

  const rawUserAgent = request.headers.get("user-agent") ?? "unknown";
  const userAgent = rawUserAgent.length > 512
    ? rawUserAgent.slice(0, 512)
    : rawUserAgent;

  return { ipAddress, userAgent };
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, event, ip_address, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      params.userId ?? null,
      params.event,
      params.ipAddress,
      params.userAgent,
      params.metadata ? JSON.stringify(params.metadata) : null
    );
  } catch (error) {
    console.error("[audit-log] Failed to write audit log", {
      event: params.event,
      userId: params.userId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getUserAuditLogs(userId: number, limit = DEFAULT_USER_LOG_LIMIT): AuditLogEntry[] {
  const db = getDatabase();
  const safeLimit = clampLimit(limit, DEFAULT_USER_LOG_LIMIT);
  const stmt = db.prepare(`
    SELECT id, user_id, event, ip_address, user_agent, metadata, created_at
    FROM audit_logs
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);

  const rows = stmt.all(userId, safeLimit) as AuditLogRow[];
  return rows.map(toEntry);
}

export function getAllAuditLogs(filters: AuditLogFilters = {}): AuditLogEntry[] {
  const db = getDatabase();
  const clauses: string[] = [];
  const params: Array<number | string> = [];

  if (filters.userId !== undefined) {
    clauses.push("user_id = ?");
    params.push(filters.userId);
  }

  if (filters.event !== undefined) {
    clauses.push("event = ?");
    params.push(filters.event);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const safeLimit = clampLimit(filters.limit ?? DEFAULT_ADMIN_LOG_LIMIT, DEFAULT_ADMIN_LOG_LIMIT);
  const safeOffset = clampOffset(filters.offset ?? 0);

  const stmt = db.prepare(`
    SELECT id, user_id, event, ip_address, user_agent, metadata, created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `);

  const rows = stmt.all(...params, safeLimit, safeOffset) as AuditLogRow[];
  return rows.map(toEntry);
}

export function parseMetadata(metadataJson: string | null): Record<string, unknown> | null {
  if (!metadataJson) return null;

  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
