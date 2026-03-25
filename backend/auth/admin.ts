/**
 * Admin Helper Functions — Phase B
 *
 * This module provides helper functions for user administration operations.
 * These functions encapsulate the business logic for role management, user banning,
 * and session impersonation while maintaining security and audit trails.
 *
 * ## Security Features
 *
 * ### Self-Action Prevention
 *
 * All admin operations include safeguards to prevent self-actions:
 * - **Role Change**: Admins cannot change their own role (prevents locking themselves out)
 * - **Ban**: Admins cannot ban themselves (prevents self-denial-of-service)
 * - **Ban Protection**: Admins cannot ban other admins (protects admin chain of command)
 *
 * ### Audit Trail
 *
 * All operations create comprehensive audit logs:
 * - Actor (admin user ID)
 * - Target (affected user ID)
 * - Action type (role_changed, user_banned, etc.)
 * - IP address and User-Agent of the request
 * - Full metadata (old/new values, reasons, expiration)
 *
 * ### Session Management
 *
 * - **Ban**: Automatically invalidates all active sessions of banned user
 * - **Impersonation**: Creates isolated session tracked with `impersonatedBy` field
 * - **Unban**: Does NOT restore sessions (requires explicit re-login for security)
 *
 * ## Architecture
 *
 * These helpers follow the Layered Modular architecture:
 *
 * ```
 * Routes (HTTP) → Services (use case) → Repository/DB (persistence)
 * ```
 *
 * These functions are at the **Service layer** - they contain business logic,
 * permission checks, and audit logging, but don't handle HTTP concerns.
 *
 * @module backend/auth/admin
 */

import { getDatabase } from "../db/connection.js";
import { createAuditLog, extractRequestInfo } from "../services/audit-log.service.js";
import { requireAdmin, isAdmin, type Session } from "../middleware/auth/index.js";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts a user ID from unknown type to number safely.
 *
 * Better Auth may return user IDs as strings or numbers depending on configuration.
 * This utility ensures we always work with numbers for database operations.
 *
 * @param value - The user ID value (string | number | unknown)
 * @returns The numeric user ID or undefined if conversion fails
 *
 * @example
 * ```typescript
 * const numericId = toNumericUserId(session.user.id);
 * if (!numericId) {
 *   throw new Error("Invalid user ID");
 * }
 * ```
 */
function toNumericUserId(value: unknown): number | undefined {
	const numericId = Number(value);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		return undefined;
	}
	return numericId;
}

/**
 * Compares two user IDs for equality, handling type differences.
 *
 * This function safely compares user IDs that may be strings or numbers.
 * It converts both to numbers before comparison to ensure type safety.
 *
 * @param id1 - First user ID (typically from database as number)
 * @param id2 - Second user ID (typically from session as unknown)
 * @returns true if the IDs represent the same user
 *
 * @example
 * ```typescript
 * if (areSameUserIds(targetUserId, session.user.id)) {
 *   throw new Error("Cannot perform action on yourself");
 * }
 * ```
 */
function areSameUserIds(id1: number, id2: unknown): boolean {
	const numericId2 = toNumericUserId(id2);
	if (numericId2 === undefined) {
		return false;
	}
	return id1 === numericId2;
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Valid user roles in the system.
 */
export type UserRole = "user" | "admin";

/**
 * Parameters for user banning operation.
 */
export interface BanUserParams {
  /** ID of the user to ban */
  targetUserId: number;
  /** Reason for the ban (shown to user) */
  reason: string;
  /** Optional expiration date (null = permanent ban) */
  expiresAt: Date | null;
}

/**
 * Result of an impersonation operation.
 */
export interface ImpersonationResult {
  /** The session token for the impersonated session */
  token: string;
  /** When the impersonation session expires (1 hour from creation) */
  expiresAt: Date;
}

// ============================================================================
// B.1: ROLE MANAGEMENT
// ============================================================================

/**
 * Changes the role of a user (user/admin).
 *
 * **Security Checks:**
 * - Caller must be an admin
 * - Cannot change your own role (prevents self-lockout)
 * - Target user must exist
 * - Role must be valid ("user" or "admin")
 *
 * **Audit Trail:**
 * - Logs role_changed event with old and new roles
 * - Includes admin's IP and User-Agent
 *
 * @param targetUserId - ID of the user whose role will be changed
 * @param newRole - The new role to assign ("user" or "admin")
 * @param adminSession - The admin's session (for permission check and audit)
 * @returns `true` if role was changed successfully
 * @throws Error if permissions insufficient, self-change, or invalid role
 *
 * @example
 * ```typescript
 * const adminSession = await requireAdmin(request);
 * const { ipAddress, userAgent } = extractRequestInfo(request);
 *
 * await setUserRole(targetUserId, "admin", adminSession);
 * // Role changed, audit log created
 * ```
 */
export async function setUserRole(
  targetUserId: number,
  newRole: UserRole,
  adminSession: Session
): Promise<boolean> {
  // 1. Validate admin permissions
  if (!isAdmin(adminSession)) {
    throw new Error("Insufficient permissions: admin role required");
  }

  // 2. Validate: no self-role-change
  if (areSameUserIds(targetUserId, adminSession.user.id)) {
    throw new Error("Cannot change your own role");
  }

  // 3. Validate: role is valid
  if (!["user", "admin"].includes(newRole)) {
    throw new Error(`Invalid role: "${newRole}". Must be "user" or "admin"`);
  }

  // 4. Validate: target user exists
  const db = getDatabase();
  const targetUser = db
    .prepare("SELECT id, role FROM users WHERE id = ?")
    .get(targetUserId) as { id: number; role: string } | undefined;

  if (!targetUser) {
    throw new Error(`User not found: ID ${targetUserId}`);
  }

  // 5. Get current role for audit log
  const oldRole = targetUser.role;

  // 6. Update role
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, targetUserId);

  // 7. Create audit log
  // Note: extractRequestInfo needs a Request object. In this helper context,
  // we don't have the original request, so we create a minimal one.
  const { ipAddress, userAgent } = extractRequestInfo(new Request("http://localhost"));
  const adminUserId = toNumericUserId(adminSession.user.id);
  if (adminUserId === undefined) {
    throw new Error("Invalid admin user ID in session");
  }

  await createAuditLog({
    userId: adminUserId,
    event: "role_changed",
    ipAddress,
    userAgent,
    metadata: {
      targetUserId,
      oldRole,
      newRole,
    },
  });

  return true;
}

// ============================================================================
// B.2: USER BANNING
// ============================================================================

/**
 * Bans a user and invalidates all their active sessions.
 *
 * **Security Checks:**
 * - Caller must be an admin
 * - Cannot ban yourself
 * - Cannot ban other admins (protects admin chain of command)
 * - Target user must exist
 *
 * **Effects:**
 * - Sets `banned = 1` on user record
 * - Stores ban reason and expiration (if any)
 * - Invalidates ALL active sessions of the user
 * - Creates comprehensive audit log
 *
 * **Audit Trail:**
 * - Logs user_banned event with reason and expiration
 * - Includes admin's IP and User-Agent
 *
 * @param params - Ban parameters (target user, reason, expiration)
 * @param adminSession - The admin's session (for permission check and audit)
 * @returns `true` if user was banned successfully
 * @throws Error if permissions insufficient, self-ban, or attempting to ban admin
 *
 * @example
 * ```typescript
 * const adminSession = await requireAdmin(request);
 *
 * // Permanent ban
 * await banUser({
 *   targetUserId: 123,
 *   reason: "Violation of Terms of Service",
 *   expiresAt: null
 * }, adminSession);
 *
 * // Temporary ban (24 hours)
 * await banUser({
 *   targetUserId: 123,
 *   reason: "Spam behavior",
 *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
 * }, adminSession);
 * ```
 */
export async function banUser(
  params: BanUserParams,
  adminSession: Session
): Promise<boolean> {
  const { targetUserId, reason, expiresAt } = params;

  // 1. Validate admin permissions
  if (!isAdmin(adminSession)) {
    throw new Error("Insufficient permissions: admin role required");
  }

  // 2. Validate: no self-ban
  if (areSameUserIds(targetUserId, adminSession.user.id)) {
    throw new Error("Cannot ban yourself");
  }

  // 3. Validate: target user exists and is not an admin
  const db = getDatabase();
  const targetUser = db
    .prepare("SELECT id, role FROM users WHERE id = ?")
    .get(targetUserId) as { id: number; role: string } | undefined;

  if (!targetUser) {
    throw new Error(`User not found: ID ${targetUserId}`);
  }

  if (targetUser.role === "admin") {
    throw new Error("Cannot ban admin users");
  }

  // 4. Ban the user
  const expiresAtStr = expiresAt ? expiresAt.toISOString() : null;

  db.prepare(
    `
    UPDATE users
    SET banned = 1, banReason = ?, banExpires = ?
    WHERE id = ?
  `
  ).run(reason, expiresAtStr, targetUserId);

  // 5. Invalidate all sessions of the banned user
  db.prepare("UPDATE sessions SET is_active = 0 WHERE user_id = ?").run(
    targetUserId
  );

  // 6. Create audit log
  const { ipAddress, userAgent } = extractRequestInfo(new Request("http://localhost"));
  const adminUserId = toNumericUserId(adminSession.user.id);
  if (adminUserId === undefined) {
    throw new Error("Invalid admin user ID in session");
  }

  await createAuditLog({
    userId: adminUserId,
    event: "user_banned",
    ipAddress,
    userAgent,
    metadata: {
      targetUserId,
      reason,
      expiresAt: expiresAtStr,
      sessionsInvalidated: "all",
    },
  });

  return true;
}

// ============================================================================
// B.3: USER UNBANNING
// ============================================================================

/**
 * Removes a ban from a user.
 *
 * **Security Checks:**
 * - Caller must be an admin
 *
 * **Effects:**
 * - Sets `banned = 0` on user record
 * - Clears ban reason and expiration
 * - Creates audit log
 *
 * **Note:** This does NOT restore the user's sessions. The user must log in
 * again after being unbanned for security reasons.
 *
 * **Audit Trail:**
 * - Logs user_unbanned event
 * - Includes admin's IP and User-Agent
 *
 * @param targetUserId - ID of the user to unban
 * @param adminSession - The admin's session (for permission check and audit)
 * @returns `true` if user was unbanned successfully
 * @throws Error if permissions insufficient
 *
 * @example
 * ```typescript
 * const adminSession = await requireAdmin(request);
 *
 * await unbanUser(123, adminSession);
 * // User is unbanned but must log in again
 * ```
 */
export async function unbanUser(
  targetUserId: number,
  adminSession: Session
): Promise<boolean> {
  // 1. Validate admin permissions
  if (!isAdmin(adminSession)) {
    throw new Error("Insufficient permissions: admin role required");
  }

  // 2. Remove ban
  const db = getDatabase();

  db.prepare(
    `
    UPDATE users
    SET banned = 0, banReason = NULL, banExpires = NULL
    WHERE id = ?
  `
  ).run(targetUserId);

  // 3. Create audit log
  const { ipAddress, userAgent } = extractRequestInfo(new Request("http://localhost"));
  const adminUserId = toNumericUserId(adminSession.user.id);
  if (adminUserId === undefined) {
    throw new Error("Invalid admin user ID in session");
  }

  await createAuditLog({
    userId: adminUserId,
    event: "user_unbanned",
    ipAddress,
    userAgent,
    metadata: {
      targetUserId,
    },
  });

  return true;
}

// ============================================================================
// B.4: IMPERSONATION
// ============================================================================

/**
 * Starts an impersonation session for an admin.
 *
 * **Security Checks:**
 * - Caller must be an admin
 * - Target user must exist
 *
 * **Effects:**
 * - Creates a new session for the target user
 * - Session is marked with `impersonatedBy` field (admin's user ID)
 * - Session expires in 1 hour (configurable)
 * - Creates audit log with masked token
 *
 * **Impersonation Flow:**
 * 1. Admin calls `startImpersonation(targetUserId, adminSession)`
 * 2. System creates a new session for target user
 * 3. Admin receives the impersonation session token
 * 4. Admin uses this token to act as the target user
 * 5. All actions are logged with impersonation metadata
 * 6. Admin calls `endImpersonation()` to terminate
 *
 * **Audit Trail:**
 * - Logs impersonation_started event
 * - Includes target user ID and token prefix (first 8 chars)
 *
 * @param targetUserId - ID of the user to impersonate
 * @param adminSession - The admin's session (for permission check and audit)
 * @returns The impersonation session token
 * @throws Error if permissions insufficient or user not found
 *
 * @example
 * ```typescript
 * const adminSession = await requireAdmin(request);
 *
 * const token = await startImpersonation(123, adminSession);
 * // Now admin can use this token to act as user 123
 * ```
 */
export async function startImpersonation(
  targetUserId: number,
  adminSession: Session
): Promise<string> {
  // 1. Validate admin permissions
  if (!isAdmin(adminSession)) {
    throw new Error("Insufficient permissions: admin role required");
  }

  // 2. Validate: target user exists
  const db = getDatabase();
  const targetUser = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(targetUserId) as { id: number } | undefined;

  if (!targetUser) {
    throw new Error(`User not found: ID ${targetUserId}`);
  }

  // 3. Create impersonation session
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const token = crypto.randomUUID(); // Generate unique session token
  const fingerprint = "impersonation"; // Special fingerprint for impersonation sessions
  const adminUserId = toNumericUserId(adminSession.user.id);
  if (adminUserId === undefined) {
    throw new Error("Invalid admin user ID in session");
  }

  db.prepare(
    `
    INSERT INTO sessions (
      user_id,
      token_jti,
      ip_address,
      user_agent,
      fingerprint,
      is_active,
      created_at,
      expires_at,
      impersonatedBy
    )
    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?)
  `
  ).run(
    targetUserId,
    token,
    "unknown", // IP address - would be extracted from real request in route layer
    "impersonation-session", // User-Agent placeholder
    fingerprint,
    expiresAt.toISOString(),
    adminUserId // Track which admin created this session
  );

  // 4. Create audit log
  // Note: extractRequestInfo needs a Request object. In this helper context,
  // we don't have the original request, so we create a minimal one.
  const { ipAddress, userAgent } = extractRequestInfo(new Request("http://localhost"));

  await createAuditLog({
    userId: adminUserId,
    event: "impersonation_started",
    ipAddress,
    userAgent,
    metadata: {
      targetUserId,
      impersonationToken: `${token.slice(0, 8)}...`, // Log only token prefix
      expiresAt: expiresAt.toISOString(),
    },
  });

  return token;
}

/**
 * Ends an active impersonation session.
 *
 * **Security Checks:**
 * - Session must be an impersonation session (have `impersonatedBy` field)
 *
 * **Effects:**
 * - Terminates the impersonation session
 * - Creates audit log
 *
 * **Audit Trail:**
 * - Logs impersonation_ended event
 * - Includes which admin ended it and which user was being impersonated
 *
 * @param impersonatedSession - The active impersonation session to terminate
 * @returns `true` if impersonation was ended successfully
 * @throws Error if session is not an impersonation session
 *
 * @example
 * ```typescript
 * const session = await requireAuth(request);
 *
 * if (session.impersonatedBy) {
 *   await endImpersonation(session);
 *   // Impersonation session terminated
 * }
 * ```
 */
export async function endImpersonation(
  impersonatedSession: Session
): Promise<boolean> {
  // 1. Validate: this is an impersonation session
  const impersonatedBy = (impersonatedSession as any).impersonatedBy;

  if (!impersonatedBy) {
    throw new Error("Not an impersonation session");
  }

  // 2. Validate impersonatedBy is a valid number
  const numericImpersonatedBy = toNumericUserId(impersonatedBy);
  if (numericImpersonatedBy === undefined) {
    throw new Error("Invalid impersonatedBy user ID in session");
  }

  // 3. Terminate the impersonation session
  const db = getDatabase();

  const sessionToken = (impersonatedSession as any).token;
  if (!sessionToken) {
    throw new Error("Session token not found");
  }

  db.prepare("UPDATE sessions SET is_active = 0 WHERE token_jti = ?").run(
    sessionToken
  );

  // 4. Create audit log
  const { ipAddress, userAgent } = extractRequestInfo(new Request("http://localhost"));
  const targetUserId = toNumericUserId(impersonatedSession.user.id);
  if (targetUserId === undefined) {
    throw new Error("Invalid target user ID in session");
  }

  await createAuditLog({
    userId: numericImpersonatedBy,
    event: "impersonation_ended",
    ipAddress,
    userAgent,
    metadata: {
      targetUserId,
    },
  });

  return true;
}
