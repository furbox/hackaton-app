/**
 * Admin HTTP Handlers — Phase C
 *
 * This module exposes admin helper functions as HTTP endpoints.
 * It implements the Route layer of the Layered Modular architecture:
 *
 * ```
 * Routes (HTTP) → Services (use case) → Repository/DB (persistence)
 * ```
 *
 * These handlers:
 * - Parse and validate HTTP input (params, body)
 * - Call service layer functions from `backend/auth/admin.ts`
 * - Serialize responses with appropriate status codes
 * - Handle errors with structured JSON responses
 *
 * ## Dependency Injection
 *
 * All handlers accept an optional `deps` parameter for testing:
 *
 * ```typescript
 * await setRoleHandler(request, { id: "123" }, {
 *   authorize: mockRequireAdmin,
 *   services: { setUserRole: mockSetUserRole }
 * });
 * ```
 *
 * ## Security
 *
 * All endpoints are protected with `requireAdmin` middleware by default.
 *
 * ## Error Codes
 *
 * All errors follow the standard format:
 * ```json
 * {
 *   "error": "Human-readable message",
 *   "code": "MACHINE_READABLE_CODE"
 * }
 * ```
 *
 * @module backend/routes/admin
 */

import {
  requireAdmin,
  jsonError,
  type Session,
  type AuthResult,
  type ErrorCode
} from "../../../middleware/auth/index.js";
import {
  setUserRole,
  banUser,
  unbanUser,
  startImpersonation,
  endImpersonation,
  type UserRole,
} from "../../../auth/admin.js";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Service layer functions for admin operations.
 * Used for dependency injection in tests.
 */
export interface AdminServices {
  setUserRole: (
    targetUserId: number,
    newRole: UserRole,
    adminSession: Session
  ) => Promise<boolean>;
  banUser: (
    params: {
      targetUserId: number;
      reason: string;
      expiresAt: Date | null;
    },
    adminSession: Session
  ) => Promise<boolean>;
  unbanUser: (targetUserId: number, adminSession: Session) => Promise<boolean>;
  startImpersonation: (
    targetUserId: number,
    adminSession: Session
  ) => Promise<string>;
  endImpersonation: (impersonatedSession: Session) => Promise<boolean>;
}

/**
 * Dependencies for admin route handlers.
 */
export interface AdminDeps {
  authorize: (request: Request) => Promise<AuthResult>;
  services: AdminServices;
}

/**
 * Default service implementations using real admin functions.
 */
function defaultServices(): AdminServices {
  return {
    setUserRole,
    banUser,
    unbanUser,
    startImpersonation,
    endImpersonation,
  };
}

/**
 * Default dependencies using real auth and admin functions.
 */
function defaultDeps(): AdminDeps {
  return {
    authorize: requireAdmin,
    services: defaultServices(),
  };
}

// ============================================================================
// C.2: PUT /api/admin/users/:id/role - Change User Role
// ============================================================================

/**
 * HTTP handler for changing a user's role.
 *
 * **Endpoint:** `PUT /api/admin/users/:id/role`
 *
 * **Request Body:**
 * ```json
 * {
 *   "role": "admin" | "user"
 * }
 * ```
 *
 * **Response (200):**
 * ```json
 * {
 *   "success": true,
 *   "userId": 123,
 *   "newRole": "admin"
 * }
 * ```
 *
 * **Errors:**
 * - 400: Invalid user ID, invalid role, or self-role-change
 * - 401: Not authenticated
 * - 403: Not an admin
 *
 * @param request - The incoming HTTP request
 * @param params - Route parameters with `id` (user ID)
 * @param deps - Optional dependencies for testing
 * @returns JSON response with success/error
 *
 * @example
 * ```typescript
 * // PUT /api/admin/users/123/role
 * // Body: { "role": "admin" }
 * const response = await setRoleHandler(request, { id: "123" });
 * ```
 */
export async function setRoleHandler(
  request: Request,
  params: { id: string },
  deps?: Partial<AdminDeps>
): Promise<Response> {
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // 1. Extract and validate target user ID
  const targetUserId = parseInt(params.id, 10);
  if (isNaN(targetUserId)) {
    return jsonError(400, "Invalid user ID", "INVALID_USER_ID");
  }

  // 2. Validate admin session
  const authResult = await resolvedDeps.authorize(request);
  if (authResult instanceof Response) return authResult;
  const session = authResult;

  // 3. Extract and validate request body
  let body: { role: string };
  try {
    body = await request.json() as { role: string };
  } catch {
    return jsonError(400, "Invalid JSON body", "INVALID_JSON");
  }

  if (!body.role || typeof body.role !== "string") {
    return jsonError(
      400,
      "Invalid role. Must be 'user' or 'admin'",
      "INVALID_ROLE"
    );
  }

  if (!["user", "admin"].includes(body.role)) {
    return jsonError(
      400,
      "Invalid role. Must be 'user' or 'admin'",
      "INVALID_ROLE"
    );
  }

  // 4. Call service layer
  try {
    await resolvedDeps.services.setUserRole(targetUserId, body.role as UserRole, session);

    return Response.json(
      {
        success: true,
        userId: targetUserId,
        newRole: body.role,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to change role";
    const code = message.includes("Cannot change your own role")
      ? "SELF_ROLE_CHANGE_FORBIDDEN"
      : "OPERATION_FAILED";

    return jsonError(400, message, code);
  }
}

// ============================================================================
// C.3: POST /api/admin/users/:id/ban - Ban User
// ============================================================================

/**
 * HTTP handler for banning a user.
 *
 * **Endpoint:** `POST /api/admin/users/:id/ban`
 *
 * **Request Body:**
 * ```json
 * {
 *   "reason": "Violation of Terms of Service",
 *   "expiresAt": "2026-03-26T10:00:00.000Z" // optional
 * }
 * ```
 *
 * **Response (200):**
 * ```json
 * {
 *   "success": true,
 *   "userId": 123,
 *   "banned": true,
 *   "expiresAt": "2026-03-26T10:00:00.000Z" | null
 * }
 * ```
 *
 * **Errors:**
 * - 400: Invalid user ID, missing reason, invalid expiration, self-ban, or trying to ban admin
 * - 401: Not authenticated
 * - 403: Not an admin
 *
 * @param request - The incoming HTTP request
 * @param params - Route parameters with `id` (user ID)
 * @param deps - Optional dependencies for testing
 * @returns JSON response with success/error
 *
 * @example
 * ```typescript
 * // POST /api/admin/users/123/ban
 * // Body: { "reason": "Spam behavior" }
 * const response = await banUserHandler(request, { id: "123" });
 * ```
 */
export async function banUserHandler(
  request: Request,
  params: { id: string },
  deps?: Partial<AdminDeps>
): Promise<Response> {
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // 1. Extract and validate target user ID
  const targetUserId = parseInt(params.id, 10);
  if (isNaN(targetUserId)) {
    return jsonError(400, "Invalid user ID", "INVALID_USER_ID");
  }

  // 2. Validate admin session
  const authResult = await resolvedDeps.authorize(request);
  if (authResult instanceof Response) return authResult;
  const session = authResult;

  // 3. Extract and validate request body
  let body: { reason: string; expiresAt?: string };
  try {
    body = await request.json() as { reason: string; expiresAt?: string };
  } catch {
    return jsonError(400, "Invalid JSON body", "INVALID_JSON");
  }

  if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length === 0) {
    return jsonError(400, "Ban reason is required", "MISSING_REASON");
  }

  // 4. Parse expiresAt if provided
  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      return jsonError(400, "Invalid expiration date", "INVALID_EXPIRATION");
    }
  }

  // 5. Call service layer
  try {
    await resolvedDeps.services.banUser(
      {
        targetUserId,
        reason: body.reason.trim(),
        expiresAt,
      },
      session
    );

    return Response.json(
      {
        success: true,
        userId: targetUserId,
        banned: true,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ban user";
    let code: ErrorCode = "OPERATION_FAILED";

    if (message.includes("Cannot ban yourself")) {
      code = "SELF_BAN_FORBIDDEN";
    } else if (message.includes("Cannot ban admin users")) {
      code = "CANNOT_BAN_ADMIN";
    }

    return jsonError(400, message, code);
  }
}

// ============================================================================
// C.4: POST /api/admin/users/:id/unban - Unban User
// ============================================================================

/**
 * HTTP handler for unbanning a user.
 *
 * **Endpoint:** `POST /api/admin/users/:id/unban`
 *
 * **Response (200):**
 * ```json
 * {
 *   "success": true,
 *   "userId": 123,
 *   "banned": false
 * }
 * ```
 *
 * **Errors:**
 * - 400: Invalid user ID
 * - 401: Not authenticated
 * - 403: Not an admin
 *
 * @param request - The incoming HTTP request
 * @param params - Route parameters with `id` (user ID)
 * @param deps - Optional dependencies for testing
 * @returns JSON response with success/error
 *
 * @example
 * ```typescript
 * // POST /api/admin/users/123/unban
 * const response = await unbanUserHandler(request, { id: "123" });
 * ```
 */
export async function unbanUserHandler(
  request: Request,
  params: { id: string },
  deps?: Partial<AdminDeps>
): Promise<Response> {
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // 1. Extract and validate target user ID
  const targetUserId = parseInt(params.id, 10);
  if (isNaN(targetUserId)) {
    return jsonError(400, "Invalid user ID", "INVALID_USER_ID");
  }

  // 2. Validate admin session
  const authResult = await resolvedDeps.authorize(request);
  if (authResult instanceof Response) return authResult;
  const session = authResult;

  // 3. Call service layer
  try {
    await resolvedDeps.services.unbanUser(targetUserId, session);

    return Response.json(
      {
        success: true,
        userId: targetUserId,
        banned: false,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unban user";
    return jsonError(400, message, "OPERATION_FAILED");
  }
}

// ============================================================================
// C.5: POST /api/admin/impersonate/:id - Start Impersonation
// ============================================================================

/**
 * HTTP handler for starting an impersonation session.
 *
 * **Endpoint:** `POST /api/admin/impersonate/:id`
 *
 * **Response (200):**
 * ```json
 * {
 *   "success": true,
 *   "impersonatedUserId": 123,
 *   "sessionToken": "uuid-v4-token"
 * }
 * ```
 *
 * **Errors:**
 * - 400: Invalid user ID or user not found
 * - 401: Not authenticated
 * - 403: Not an admin
 *
 * **Note:** The returned `sessionToken` is the impersonation session token.
 * The admin should use this token in subsequent requests to act as the target user.
 *
 * @param request - The incoming HTTP request
 * @param params - Route parameters with `id` (user ID to impersonate)
 * @param deps - Optional dependencies for testing
 * @returns JSON response with success/error
 *
 * @example
 * ```typescript
 * // POST /api/admin/impersonate/123
 * const response = await startImpersonationHandler(request, { id: "123" });
 * // Returns: { success: true, impersonatedUserId: 123, sessionToken: "..." }
 * ```
 */
export async function startImpersonationHandler(
  request: Request,
  params: { id: string },
  deps?: Partial<AdminDeps>
): Promise<Response> {
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // 1. Extract and validate target user ID
  const targetUserId = parseInt(params.id, 10);
  if (isNaN(targetUserId)) {
    return jsonError(400, "Invalid user ID", "INVALID_USER_ID");
  }

  // 2. Validate admin session
  const authResult = await resolvedDeps.authorize(request);
  if (authResult instanceof Response) return authResult;
  const session = authResult;

  // 3. Call service layer
  try {
    const sessionToken = await resolvedDeps.services.startImpersonation(targetUserId, session);

    return Response.json(
      {
        success: true,
        impersonatedUserId: targetUserId,
        sessionToken,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start impersonation";
    return jsonError(400, message, "OPERATION_FAILED");
  }
}

// ============================================================================
// C.6: POST /api/admin/end-impersonation - End Impersonation
// ============================================================================

/**
 * HTTP handler for ending an active impersonation session.
 *
 * **Endpoint:** `POST /api/admin/end-impersonation`
 *
 * **Response (204):** No Content
 *
 * **Errors:**
 * - 400: Not an impersonation session
 * - 401: Not authenticated
 * - 403: Not an admin
 *
 * **Note:** This endpoint must be called using the impersonation session token
 * (the one returned by `startImpersonationHandler`), not the admin's original session.
 *
 * @param request - The incoming HTTP request
 * @param deps - Optional dependencies for testing
 * @returns 204 No Content on success, error response otherwise
 *
 * @example
 * ```typescript
 * // POST /api/admin/end-impersonation
 * // Called with impersonation session token in Authorization header
 * const response = await endImpersonationHandler(request);
 * // Returns 204 No Content
 * ```
 */
export async function endImpersonationHandler(
  request: Request,
  deps?: Partial<AdminDeps>
): Promise<Response> {
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // 1. Validate admin session
  const authResult = await resolvedDeps.authorize(request);
  if (authResult instanceof Response) return authResult;
  const session = authResult;

  // 2. Verify this is an impersonation session
  if (!(session as any).impersonatedBy) {
    return jsonError(400, "Not an impersonation session", "NOT_IMPERSONATION_SESSION");
  }

  // 3. Call service layer
  try {
    await resolvedDeps.services.endImpersonation(session);
    return new Response(null, { status: 204 }); // No Content
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to end impersonation";
    return jsonError(400, message, "OPERATION_FAILED");
  }
}
