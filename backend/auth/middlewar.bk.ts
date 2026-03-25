/**
 * Authentication Middleware
 *
 * This module provides authentication and authorization middleware for URLoft using Better Auth.
 * It implements session validation, fingerprint-based session security, role-based access control,
 * and protection against common attacks (timing attacks, session hijacking).
 *
 * ## Architecture Overview
 *
 * The middleware system consists of several layers:
 *
 * 1. **Session Extraction**: Extract session token from Authorization header or cookie
 * 2. **Session Validation**: Validate session against database using Better Auth API
 * 3. **Fingerprint Verification**: Verify IP + User-Agent fingerprint to prevent session hijacking
 * 4. **Role-Based Authorization**: Check user permissions based on role (user/admin)
 *
 * ## Security Features
 *
 * ### Fingerprint-Based Session Security
 *
 * Each session is bound to the IP address and User-Agent of the device that created it.
 * This prevents session theft even if the session token is leaked.
 *
 * - **Fingerprint Generation**: SHA-256 hash of `IP|User-Agent`
 * - **Storage**: Stored in `session.fingerprint` column on session creation
 * - **Verification**: On each request, compare current fingerprint with stored fingerprint
 * - **Comparison**: Constant-time comparison using `crypto.subtle.timingSafeEqual()` to prevent timing attacks
 *
 * ### Proxy Handling
 *
 * The middleware respects the `TRUST_PROXY` environment variable:
 *
 * - **TRUST_PROXY=true**: Trust `X-Forwarded-For` header for IP extraction (useful behind reverse proxy)
 * - **TRUST_PROXY=false** (default): Ignore proxy headers, use direct connection IP only
 *
 * This prevents IP spoofing attacks when the application is not behind a trusted proxy.
 *
 * ## Performance Targets
 *
 * - Session validation: < 10ms p95
 * - Fingerprint generation: < 5ms
 * - Middleware overhead: < 2ms
 * - **Total auth flow: < 12ms p95**
 *
 * ## Usage Examples
 *
 * ### Basic Authentication
 *
 * ```typescript
 * import { authenticated, jsonError } from "./middleware";
 *
 * // In a route handler
 * export async function GET(request: Request) {
 *   const session = await authenticated(request);
 *   if (session instanceof Response) return session; // Error response
 *
 *   // session is typed and validated
 *   console.log(session.user.email);
 *   return Response.json({ data: "protected" });
 * }
 * ```
 *
 * ### Role-Based Authorization
 *
 * ```typescript
 * import { requireRoleMiddleware, requireAdmin } from "./middleware";
 *
 * // Require specific roles
 * const adminOrModerator = requireRoleMiddleware(["admin", "moderator"]);
 *
 * export async function DELETE(request: Request) {
 *   const session = await adminOrModerator(request);
 *   if (session instanceof Response) return session; // Error response
 *
 *   // User is admin or moderator
 *   return Response.json({ deleted: true });
 * }
 *
 * // Or use the shortcut for admin-only
 * export async function DELETE(request: Request) {
 *   const session = await requireAdmin(request);
 *   if (session instanceof Response) return session;
 *
 *   // User is admin
 *   return Response.json({ deleted: true });
 * }
 * ```
 *
 * @module backend/auth/middleware
 */

import { authConfig, type Session as ConfigSession } from "./config.js";
import { createAuditLog, extractRequestInfo } from "../services/audit-log.service.js";
import { getDatabase } from "../db/connection.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Re-export Session type for convenience.
 * This allows tests and other modules to import Session from middleware.ts.
 */
export type Session = ConfigSession;

/**
 * Error response type returned by middleware when authentication fails.
 *
 * Middleware functions return either a `Session` object on success or a
 * `Response` object on error. This union type captures both possibilities.
 *
 * @example
 * ```typescript
 * const result = await authenticated(request);
 * if (result instanceof Response) {
 *   // Authentication failed - return error response
 *   return result;
 * }
 * // Authentication succeeded - result is Session
 * console.log(result.user.email);
 * ```
 */
export type AuthResult = Session | Response;

function toNumericUserId(value: unknown): number | undefined {
	const numericId = Number(value);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		return undefined;
	}
	return numericId;
}

function previewToken(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length === 0) {
		return undefined;
	}
	return `${value.slice(0, 8)}...`;
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

/**
 * Standard error codes used throughout the middleware system.
 *
 * These codes provide machine-readable error information that clients can use
 * to handle different authentication failure scenarios appropriately.
 */
export const ERROR_CODES = {
	/** No session token provided in request */
	NO_SESSION: "NO_SESSION",

	/** Session token is invalid or expired */
	INVALID_SESSION: "INVALID_SESSION",

	/** Session fingerprint mismatch (possible session hijacking attempt) */
	FINGERPRINT_MISMATCH: "FINGERPRINT_MISMATCH",

	/** User lacks required role for this operation */
	INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

	// Validation errors
	/** Invalid user ID provided in request */
	INVALID_USER_ID: "INVALID_USER_ID",

	/** Invalid JSON in request body */
	INVALID_JSON: "INVALID_JSON",

	/** Invalid role value provided */
	INVALID_ROLE: "INVALID_ROLE",

	/** Missing required field */
	MISSING_REASON: "MISSING_REASON",

	/** Invalid expiration date format */
	INVALID_EXPIRATION: "INVALID_EXPIRATION",

	// Operation-specific errors
	/** Operation failed (generic error) */
	OPERATION_FAILED: "OPERATION_FAILED",

	/** User cannot change their own role */
	SELF_ROLE_CHANGE_FORBIDDEN: "SELF_ROLE_CHANGE_FORBIDDEN",

	/** User cannot ban themselves */
	SELF_BAN_FORBIDDEN: "SELF_BAN_FORBIDDEN",

	/** Cannot ban admin users */
	CANNOT_BAN_ADMIN: "CANNOT_BAN_ADMIN",

	/** Not an impersonation session */
	NOT_IMPERSONATION_SESSION: "NOT_IMPERSONATION_SESSION",
} as const;

/**
 * Error code type for type-safe error handling.
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Generates a consistent JSON error response.
 *
 * This helper function ensures all authentication errors follow the same format,
 * making it easier for clients to handle them consistently.
 *
 * The error response includes:
 * - `error`: Human-readable error message
 * - `code`: Machine-readable error code from `ERROR_CODES`
 * - `status`: HTTP status code (for reference, also in the response status line)
 *
 * @param status - HTTP status code (401, 403, etc.)
 * @param error - Human-readable error message
 * @param code - Machine-readable error code
 * @returns JSON Response with error details
 *
 * @example
 * ```typescript
 * return jsonError(401, "No session token provided", "NO_SESSION");
 * // Response: { "error": "No session token provided", "code": "NO_SESSION" }
 * ```
 */
export function jsonError(
	status: number,
	error: string,
	code: ErrorCode
): Response {
	return Response.json(
		{ error, code },
		{ status, headers: { "Content-Type": "application/json" } }
	);
}

// ============================================================================
// PHASE B: CORE HELPERS
// ============================================================================

/**
 * Extracts the session token from a request.
 *
 * This function tries multiple sources in order:
 * 1. `Authorization: Bearer <token>` header - Preferred for API calls
 * 2. `urlft_session` cookie - Fallback for browser-based auth
 *
 * The Bearer token approach is preferred for API clients because:
 * - It's stateless from the client's perspective
 * - It works well with CSRF protection
 * - It's the standard for modern APIs
 *
 * @param request - The incoming HTTP request
 * @returns The session token or `null` if not found
 *
 * @example
 * ```typescript
 * const token = extractSessionToken(request);
 * if (!token) {
 *   return jsonError(401, "No session token", "NO_SESSION");
 * }
 * ```
 */
function extractSessionToken(request: Request): string | null {
	// Try Authorization header first (Bearer token)
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7); // Remove "Bearer " prefix
	}

	// Fallback to session cookie
	// The cookie name is configured in auth config as "urlft_session"
	const cookieHeader = request.headers.get("Cookie");
	if (cookieHeader) {
		// Parse cookies and find the session token
		const cookies = cookieHeader.split(";").map((c) => c.trim());
		const sessionCookie = cookies.find((c) =>
			c.startsWith("urlft_session=")
		);
		if (sessionCookie) {
			return sessionCookie.slice("urlft_session=".length);
		}
	}

	// No token found
	return null;
}

/**
 * Validates a request and returns the associated session.
 *
 * This function:
 * 1. Extracts the session token from the request (header or cookie)
 * 2. Validates the token against the database using Better Auth
 * 3. Returns the session object if valid, `null` otherwise
 *
 * @param request - The incoming HTTP request
 * @returns The validated session or `null` if token is invalid/missing
 *
 * @example
 * ```typescript
 * const session = await getSession(request);
 * if (!session) {
 *   return jsonError(401, "Invalid session", "INVALID_SESSION");
 * }
 * console.log(session.user.email);
 * ```
 */
export async function getSession(
	request: Request
): Promise<Session | null> {
	// Extract session token from request
	const token = extractSessionToken(request);
	if (!token) {
		return null;
	}

	// Validate token using Better Auth API
	// authConfig.api.getSession validates the token against the database
	// and returns the session with user data if valid
	try {
		const session = await authConfig.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			const { ipAddress, userAgent } = extractRequestInfo(request);
			void createAuditLog({
				event: "token_rejected",
				ipAddress,
				userAgent,
				metadata: {
					reason: "invalid_or_expired_token",
					...(previewToken(token) ? { tokenPreview: previewToken(token) } : {}),
				},
			});
		}

		return session;
	} catch {
		const { ipAddress, userAgent } = extractRequestInfo(request);
		void createAuditLog({
			event: "token_rejected",
			ipAddress,
			userAgent,
			metadata: {
				reason: "invalid_or_expired_token",
				...(previewToken(token) ? { tokenPreview: previewToken(token) } : {}),
			},
		});

		// Any error during validation means invalid session
		return null;
	}
}

/**
 * Validates authentication and throws an error if not authenticated.
 *
 * This is a strict version of `getSession` that always returns a session
 * or throws an error response. Use this when a route requires authentication.
 *
 * @param request - The incoming HTTP request
 * @returns The validated session
 * @throws JSON error response with 401 status if not authenticated
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   const session = await requireAuth(request);
 *   // session is guaranteed to be non-null here
 *   return Response.json({ user: session.user });
 * }
 * ```
 */
export async function requireAuth(
	request: Request
): Promise<Session> {
	const session = await getSession(request);
	if (!session) {
		throw jsonError(401, "Authentication required", "NO_SESSION");
	}
	return session;
}

/**
 * Generates a SHA-256 fingerprint from IP address and User-Agent.
 *
 * The fingerprint is a hash of the combination of IP and User-Agent,
 * which uniquely identifies a device while preventing the storage of
 * raw PII (IP addresses).
 *
 * **Why SHA-256 and not Bun.password.hash?**
 * - Bun.password.hash is designed for password hashing (slow, with salt)
 * - We need fast, deterministic hashing for fingerprints (< 5ms target)
 * - SHA-256 is cryptographically secure but much faster (sub-millisecond)
 * - The combination of IP + UA provides sufficient entropy
 *
 * **Performance**: ~1-2ms for a single hash operation
 *
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent string
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const fingerprint = await generateFingerprint("192.168.1.1", "Mozilla/5.0...");
 * console.log(fingerprint); // "a1b2c3d4e5f6..." (64 hex chars)
 * ```
 */
export async function generateFingerprint(
	ip: string,
	userAgent: string
): Promise<string> {
	// Concatenate IP and User-Agent with a separator
	const data = `${ip}|${userAgent}`;

	// Encode as UTF-8 bytes
	const encoder = new TextEncoder();
	const bytes = encoder.encode(data);

	// Generate SHA-256 hash using Web Crypto API
	// This is fast (< 2ms) and available natively in Bun
	const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

	// Convert to hex string
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

	return hashHex;
}

/**
 * Extracts the client IP address from a request.
 *
 * This function respects the `TRUST_PROXY` environment variable:
 *
 * - **TRUST_PROXY=false** (default): Use the direct connection IP only.
 *   This prevents IP spoofing when not behind a proxy.
 *
 * - **TRUST_PROXY=true**: Trust the `X-Forwarded-For` header and use the
 *   first IP in the list. This is required when running behind a reverse
 *   proxy (nginx, Cloudflare, AWS ALB, etc.).
 *
 * **Security Warning**: Only set `TRUST_PROXY=true` if you're behind a trusted
 * reverse proxy. Otherwise, attackers can spoof their IP address.
 *
 * @param request - The incoming HTTP request
 * @returns The client IP address or "unknown" if not detectable
 *
 * @example
 * ```typescript
 * // Behind CloudFlare (TRUST_PROXY=true)
 * const ip = extractIP(request); // "203.0.113.1"
 *
 * // Direct connection (TRUST_PROXY=false)
 * const ip = extractIP(request); // "198.51.100.1"
 * ```
 */
export function extractIP(request: Request): string {
	// Check if we trust proxy headers
	const trustProxy = process.env.TRUST_PROXY === "true";

	if (trustProxy) {
		// Try X-Forwarded-For header (set by reverse proxies)
		const forwardedFor = request.headers.get("x-forwarded-for");
		if (forwardedFor) {
			// X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
			// The first IP is the original client IP
			const firstIP = forwardedFor.split(",")[0].trim();
			return firstIP;
		}

		// Try X-Real-IP header (nginx, some proxies)
		const realIP = request.headers.get("x-real-ip");
		if (realIP) {
			return realIP.trim();
		}
	}

	// Fallback: For server-side requests, we'd use the connection info
	// But with the Fetch API, we don't have direct access to the connection
	// Return a placeholder that indicates we couldn't determine the IP
	return "unknown";
}

/**
 * Extracts and sanitizes the User-Agent string from a request.
 *
 * User-Agent strings can be extremely long (up to 2KB in some cases), which
 * could lead to denial-of-service if we hash them without limits. This function
 * truncates the UA to a maximum length while preserving the identifying parts.
 *
 * **Max length**: 512 characters (sufficient for all real browsers)
 *
 * @param request - The incoming HTTP request
 * @returns Sanitized User-Agent string or "unknown" if not present
 *
 * @example
 * ```typescript
 * const ua = extractUserAgent(request);
 * console.log(ua); // "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
 * ```
 */
export function extractUserAgent(request: Request): string {
	const ua = request.headers.get("user-agent");

	if (!ua) {
		return "unknown";
	}

	// Truncate to max 512 chars to prevent DoS
	const MAX_UA_LENGTH = 512;
	return ua.length > MAX_UA_LENGTH
		? ua.slice(0, MAX_UA_LENGTH)
		: ua;
}

/**
 * Validates that the current request matches the session's stored fingerprint.
 *
 * This is the core security function that prevents session hijacking. It:
 * 1. Extracts the current IP and User-Agent from the request
 * 2. Generates a fingerprint from those values
 * 3. Compares it with the stored fingerprint using constant-time comparison
 *
 * **Why constant-time comparison?**
 * Regular string comparison (`===`) short-circuits on the first mismatch, which
 * allows timing attacks where an attacker can measure response times to guess
 * the correct fingerprint character by character. `crypto.subtle.timingSafeEqual()`
 * always compares the entire string, preventing this attack.
 *
 * @param session - The validated session object
 * @param request - The incoming HTTP request
 * @returns `true` if fingerprint matches, `false` otherwise
 *
 * @example
 * ```typescript
 * const session = await requireAuth(request);
 * const isValid = await validateFingerprint(session, request);
 * if (!isValid) {
 *   return jsonError(403, "Session fingerprint mismatch", "FINGERPRINT_MISMATCH");
 * }
 * ```
 */
export async function validateFingerprint(
	session: Session,
	request: Request
): Promise<boolean> {
	// Get the stored fingerprint from the session
	// Note: Better Auth stores custom fields in the session object
	// The fingerprint field is added via the beforeSessionCreate hook
	//
	// Better Auth may store custom fields at the session level or in a nested object
	// Try multiple possible locations
	let storedFingerprint = (session as any).fingerprint;

	// If not at top level, check for it in other common locations
	if (!storedFingerprint && (session as any).extra) {
		storedFingerprint = (session as any).extra.fingerprint;
	}

	// Also check if it's stored with an underscore prefix (common pattern)
	if (!storedFingerprint) {
		storedFingerprint = (session as any)._fingerprint;
	}

	if (!storedFingerprint) {
		const { ipAddress, userAgent } = extractRequestInfo(request);
		void createAuditLog({
			userId: toNumericUserId((session as any)?.user?.id),
			event: "token_rejected",
			ipAddress,
			userAgent,
			metadata: {
				reason: "missing_session_fingerprint",
				...(previewToken((session as any)?.token) ? { sessionTokenPreview: previewToken((session as any)?.token) } : {}),
			},
		});

		// Legacy session without fingerprint - reject for security
		// Or the field hasn't been stored yet
		return false;
	}

	// Extract current IP and User-Agent
	const currentIP = extractIP(request);
	const currentUserAgent = extractUserAgent(request);

	// Generate fingerprint from current request
	const currentFingerprint = await generateFingerprint(
		currentIP,
		currentUserAgent
	);

	// Constant-time comparison to prevent timing attacks
	// Convert hex strings to Uint8Array for comparison
	const storedBytes = new TextEncoder().encode(storedFingerprint);
	const currentBytes = new TextEncoder().encode(currentFingerprint);

	// If lengths differ, fingerprints don't match
	// (We check this first because crypto.timingSafeEqual throws for different lengths)
	if (storedBytes.length !== currentBytes.length) {
		void createAuditLog({
			userId: toNumericUserId((session as any)?.user?.id),
			event: "token_rejected",
			ipAddress: currentIP,
			userAgent: currentUserAgent,
			metadata: {
				reason: "fingerprint_mismatch",
				expectedFingerprint: storedFingerprint,
				actualFingerprint: currentFingerprint,
				...(previewToken((session as any)?.token) ? { sessionTokenPreview: previewToken((session as any)?.token) } : {}),
			},
		});

		return false;
	}

	// Use timing-safe comparison
	// In Bun, crypto.timingSafeEqual returns a boolean (true if equal, false otherwise)
	// This prevents timing attacks by always comparing all bytes
	const result = (crypto as any).timingSafeEqual(storedBytes, currentBytes);
	if (result !== true) {
		void createAuditLog({
			userId: toNumericUserId((session as any)?.user?.id),
			event: "token_rejected",
			ipAddress: currentIP,
			userAgent: currentUserAgent,
			metadata: {
				reason: "fingerprint_mismatch",
				expectedFingerprint: storedFingerprint,
				actualFingerprint: currentFingerprint,
				...(previewToken((session as any)?.token) ? { sessionTokenPreview: previewToken((session as any)?.token) } : {}),
			},
		});
	}
	return result === true;
}

/**
 * Revoca todas las sesiones de un usuario y registra el evento en audit log.
 *
 * Esta función es utilizada por administradores para forzar el cierre de todas
 * las sesiones activas de un usuario específico. Es útil en casos de:
 * - Compromiso de cuenta sospechado
 * - Acción disciplinaria
 * - Solicitud del usuario
 * - Cambio de roles que requiere reautenticación
 *
 * **Proceso:**
 * 1. Actualiza todas las sesiones del usuario a `is_active = false`
 * 2. Registra el evento en audit log con metadata completa
 * 3. Retorna el número de sesiones revocadas
 *
 * **Nota:** Las sesiones revocadas no se eliminan de la base de datos, solo
 * se marcan como inactivas. Esto permite mantener un historial de sesiones
 * para auditoría y forense.
 *
 * @param userId - ID del usuario cuyas sesiones se revocarán
 * @param adminId - ID del admin que está realizando la revocación
 * @param ipAddress - IP address de la solicitud del admin
 * @param userAgent - User-Agent de la solicitud del admin
 * @returns Número de sesiones revocadas
 *
 * @example
 * ```typescript
 * // En una ruta de admin
 * const session = await requireAdmin(request);
 * const { ipAddress, userAgent } = extractRequestInfo(request);
 *
 * const revokedCount = await revokeUserSessions(
 *   targetUserId,
 *   session.user.id,
 *   ipAddress,
 *   userAgent
 * );
 *
 * console.log(`Revocadas ${revokedCount} sesiones`);
 * ```
 */
export async function revokeUserSessions(
	userId: number,
	adminId: number,
	ipAddress: string,
	userAgent: string
): Promise<number> {
	const db = getDatabase();

	// Actualizar todas las sesiones del usuario a inactivas
	const stmt = db.prepare(`
    UPDATE sessions
    SET is_active = false
    WHERE user_id = ? AND is_active = true
  `);

	const result = stmt.run(userId);
	const revokedCount = result.changes;

	// Registrar el evento en audit log
	// userId es el admin que realizó la acción
	await createAuditLog({
		userId: adminId,
		event: "session_revoked",
		ipAddress,
		userAgent,
		metadata: {
			targetUserId: userId,
			revokedCount,
		},
	});

	return revokedCount;
}

// ============================================================================
// PHASE C: SECURITY HELPERS
// ============================================================================

/**
 * Extracts the user's role from a session.
 *
 * The Better Auth admin plugin adds a `role` field to the user object.
 * This function extracts it with a safe default.
 *
 * @param session - The validated session object
 * @returns The user's role ("user", "admin", etc.)
 *
 * @example
 * ```typescript
 * const role = getUserRole(session);
 * if (role === "admin") {
 *   // Show admin panel
 * }
 * ```
 */
export function getUserRole(session: Session): string {
	// Better Auth admin plugin adds role field
	// Type assertion is safe because we know the field exists
	return (session.user as any).role || "user";
}

/**
 * Checks if a user's role is in the list of allowed roles.
 *
 * This is the core authorization function for role-based access control.
 * Use it to check if a user has permission to access a resource.
 *
 * @param session - The validated session object
 * @param allowedRoles - Array of role names that are allowed
 * @returns `true` if user's role is in the allowed list
 *
 * @example
 * ```typescript
 * const session = await requireAuth(request);
 *
 * if (!requireRole(session, ["admin", "moderator"])) {
 *   return jsonError(403, "Insufficient permissions", "INSUFFICIENT_PERMISSIONS");
 * }
 * ```
 */
export function requireRole(
	session: Session,
	allowedRoles: string[]
): boolean {
	const userRole = getUserRole(session);
	return allowedRoles.includes(userRole);
}

/**
 * Checks if a user has admin role.
 *
 * This is a convenience wrapper around `requireRole` for the common case
 * of admin-only endpoints.
 *
 * @param session - The validated session object
 * @returns `true` if user is an admin
 *
 * @example
 * ```typescript
 * const session = await requireAuth(request);
 *
 * if (!isAdmin(session)) {
 *   return jsonError(403, "Admin access required", "INSUFFICIENT_PERMISSIONS");
 * }
 * ```
 */
export function isAdmin(session: Session): boolean {
	return requireRole(session, ["admin"]);
}

// ============================================================================
// PHASE D: MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware that validates sessions and fingerprints.
 *
 * This is the main middleware function for protected routes. It:
 * 1. Validates the session token (returns 401 if invalid)
 * 2. Verifies the fingerprint (returns 403 if mismatch)
 * 3. Returns the session object if both pass
 *
 * Use this for any route that requires authentication but doesn't require
 * specific role permissions.
 *
 * @param request - The incoming HTTP request
 * @returns Session object on success, error Response on failure
 *
 * @example
 * ```typescript
 * import { authenticated } from "./middleware";
 *
 * export async function GET(request: Request) {
 *   const session = await authenticated(request);
 *   if (session instanceof Response) return session;
 *
 *   // User is authenticated and fingerprint matches
 *   return Response.json({ user: session.user });
 * }
 * ```
 */
export async function authenticated(
	request: Request
): Promise<AuthResult> {
	// Step 1: Validate session
	const session = await getSession(request);
	if (!session) {
		return jsonError(401, "Invalid or missing session", "INVALID_SESSION");
	}

	// Step 2: Validate fingerprint
	const fingerprintValid = await validateFingerprint(session, request);
	if (!fingerprintValid) {
		return jsonError(
			403,
			"Session fingerprint mismatch - possible hijacking attempt",
			"FINGERPRINT_MISMATCH"
		);
	}

	// Both checks passed
	return session;
}

/**
 * Factory function that creates role-based authorization middleware.
 *
 * This function returns a middleware function that checks if the authenticated
 * user has one of the allowed roles. Use it to create role-specific middleware
 * for different access levels.
 *
 * @param allowedRoles - Array of role names that can access the route
 * @returns Middleware function that validates both auth and role
 *
 * @example
 * ```typescript
 * // Create middleware for admin and moderator routes
 * const adminOrModerator = requireRoleMiddleware(["admin", "moderator"]);
 *
 * export async function DELETE(request: Request) {
 *   const session = await adminOrModerator(request);
 *   if (session instanceof Response) return session;
 *
 *   // User is authenticated and has admin or moderator role
 *   return Response.json({ deleted: true });
 * }
 * ```
 */
export function requireRoleMiddleware(
	allowedRoles: string[]
): (request: Request) => Promise<AuthResult> {
	return async (request: Request) => {
		// Step 1: Authenticate and validate fingerprint
		const session = await authenticated(request);
		if (session instanceof Response) {
			return session; // Error response
		}

		// Step 2: Check role permissions
		const hasRole = requireRole(session, allowedRoles);
		if (!hasRole) {
			return jsonError(
				403,
				`Requires one of these roles: ${allowedRoles.join(", ")}`,
				"INSUFFICIENT_PERMISSIONS"
			);
		}

		// All checks passed
		return session;
	};
}

/**
 * Admin-only authorization middleware.
 *
 * This is a convenience middleware that combines authentication with admin
 * role checking. Use it for routes that should only be accessible to administrators.
 *
 * @example
 * ```typescript
 * import { requireAdmin } from "./middleware";
 *
 * export async function DELETE(request: Request) {
 *   const session = await requireAdmin(request);
 *   if (session instanceof Response) return session;
 *
 *   // User is authenticated and is an admin
 *   return Response.json({ deleted: true });
 * }
 * ```
 */
export const requireAdmin = requireRoleMiddleware(["admin"]);
