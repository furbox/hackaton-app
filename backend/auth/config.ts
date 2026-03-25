/**
 * Better Auth Configuration
 *
 * This module configures Better Auth for URLoft with the following features:
 *
 * - **Stateful Sessions**: Sessions are stored in the database, not as stateless JWTs.
 *   This provides immediate session revocation, audit trails, and better security.
 * - **Email & Password Authentication**: Standard credential-based auth with email verification.
 * - **Admin Plugin**: Role-based access control with user/admin roles and ban functionality.
 * - **SQLite Integration**: Direct integration with bun:sqlite (no separate adapter needed).
 *
 * ## Why Stateful Sessions?
 *
 * We chose database-backed sessions over JWTs because:
 * 1. **Immediate Revocation**: Sessions can be revoked instantly without waiting for token expiration
 * 2. **Audit Trail**: All sessions are visible in the database for security monitoring
 * 3. **No Crypto Overhead**: No JWT signature verification on every request
 * 4. **Simpler Security**: No need to manage token rotation, refresh tokens, or blacklists
 *
 * The tradeoff is a database query on each authenticated request, but this is acceptable
 * for our use case and provides better security guarantees.
 *
 * @module backend/auth/config
 */

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { getDatabase } from "../db/connection.js";

/**
 * Better Auth configuration instance.
 *
 * This configures:
 * - Database: Direct bun:sqlite connection (no adapter needed)
 * - Secret: From BETTER_AUTH_SECRET environment variable
 * - Sessions: 7-day expiry with refresh on activity
 * - Email/Password: Enabled with required email verification
 * - Admin Plugin: Role-based access control (user/admin)
 */
export const authConfig = betterAuth({
  /**
   * Application name for cookie prefixes and identification.
   */
  appName: "URLoft",

  /**
   * Base URL for the auth API.
   * Defaults to BETTER_AUTH_URL env var or http://localhost:3000.
   */
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  /**
   * Database configuration.
   *
   * Better Auth has native support for bun:sqlite - we pass the Database instance
   * directly. No separate adapter package is needed.
   */
  database: getDatabase(),

  /**
   * Secret for signing and encryption.
   *
   * MUST be set in production. Generated with `openssl rand -base64 32`.
   * Currently set in backend/.env as:
   * BETTER_AUTH_SECRET=qpbzSwXxeQKZAz3EQLmzcF5V7jUXnILsfA52i2vr1xc=
   */
  secret: process.env.BETTER_AUTH_SECRET,

  /**
   * Session configuration.
   *
   * - expiresIn: 7 days - sessions expire after a week of inactivity
   * - updateAge: 1 day - refresh session if it's been more than a day since last refresh
   * - cookieCache: disabled - we use database-backed sessions, not cookie cache
   * - storeSessionInDatabase: true - persist sessions to SQLite for audit trail
   */
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    updateAge: 60 * 60 * 24, // 1 day - refresh session daily
    cookieCache: {
      enabled: false,
      maxAge: 0,
    },
    storeSessionInDatabase: true, // Required for audit trail and revocation
  },

  /**
   * Advanced security options.
   */
  advanced: {
    /**
     * Use secure cookies (HTTPS-only) in production.
     * Disabled in development for localhost testing.
     */
    useSecureCookies: process.env.NODE_ENV === "production",

    /**
     * Cross-subdomain cookies - disabled for same-origin security.
     */
    crossSubDomainCookies: {
      enabled: false,
    },

    /**
     * Cookie configuration.
     *
     * Configure the session token cookie name.
     */
    cookies: {
      sessionToken: {
        name: "urlft_session", // Cookie name for session token
      },
    },
  },

  /**
   * Email and password authentication.
   */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Block login until email is verified
    sendResetPassword: undefined, // We'll implement custom flow with Resend
    autoSignIn: false, // Don't auto-signin after signup (require verification first)
  },

  /**
   * Admin plugin for role-based access control.
   *
   * This adds:
   * - `role` field to user table (default: "user")
   * - `banned`, `banReason`, `banExpires` fields for user bans
   * - Admin endpoints for user management
   * - Permission system for fine-grained access control
   */
  plugins: [
    admin({
      /**
       * Default role for new users.
       */
      defaultRole: "user",

      /**
       * Roles that have admin privileges.
       *
       * Only users with these roles can:
       * - Manage other users (set roles, ban, delete)
       * - View and revoke sessions
       * - Access admin endpoints
       */
      adminRoles: ["admin"],

      /**
       * List of user IDs that should always have admin access.
       *
       * Empty for now - can be populated via env var in production.
       * Format: adminUserIds: ["user-id-1", "user-id-2"]
       *
       * If set, this takes precedence over adminRoles.
       */
      adminUserIds: [],

      /**
       * Default ban reason when none is provided.
       */
      defaultBanReason: "No reason",

      /**
       * Message shown to banned users.
       */
      bannedUserMessage:
        "You have been banned from this application. Please contact support if you believe this is an error.",
    }),
  ],

  /**
   * Database hooks for session lifecycle management.
   *
   * These hooks run at specific points during database operations and allow
   * us to add custom behavior like storing fingerprints for session security.
   */
  databaseHooks: {
    /**
     * Session creation hook.
     *
     * This hook runs before a new session is inserted into the database.
     * We use it to:
     * 1. Extract the IP and User-Agent from the request context
     * 2. Generate a fingerprint hash
     * 3. Store it in the session record for later validation
     *
     * The fingerprint is verified on each authenticated request to prevent
     * session hijacking.
     */
    session: {
      create: {
        before: async (session, context) => {
          // Extract request context from the hook context
          // Better Auth provides the request in ctx.context when available
          const request =
            ((context as any)?.request as Request | undefined) ??
            ((context as any)?.context?.request as Request | undefined);

          if (request) {
            // Extract IP and User-Agent
            const ip = extractIP(request);
            const userAgent = extractUserAgent(request);

            // Generate fingerprint
            const fingerprint = await generateFingerprint(ip, userAgent);

            // Add fingerprint to session data
            return {
              data: {
                ...session,
                fingerprint,
              },
            };
          }

          return { data: session };
        },
      },
    },
  },
});

/**
 * Generates a fingerprint from IP address and User-Agent.
 *
 * This is a duplicate of the function in middleware.ts to avoid circular
 * dependencies. The auth config needs this for the beforeSessionCreate hook,
 * but the config file is imported by middleware.ts.
 *
 * @param ip - Client IP address
 * @param userAgent - Client User-Agent string
 * @returns Hex-encoded SHA-256 hash
 */
async function generateFingerprint(
	ip: string,
	userAgent: string
): Promise<string> {
	const data = `${ip}|${userAgent}`;
	const encoder = new TextEncoder();
	const bytes = encoder.encode(data);
	const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	return hashHex;
}

/**
 * Extracts client IP from request headers.
 *
 * Respects TRUST_PROXY environment variable for security.
 */
function extractIP(request: Request): string {
	const trustProxy = process.env.TRUST_PROXY === "true";

	if (trustProxy) {
		const forwardedFor = request.headers.get("x-forwarded-for");
		if (forwardedFor) {
			return forwardedFor.split(",")[0].trim();
		}
		const realIP = request.headers.get("x-real-ip");
		if (realIP) {
			return realIP.trim();
		}
	}

	return "unknown";
}

/**
 * Extracts and sanitizes User-Agent from request headers.
 */
function extractUserAgent(request: Request): string {
	const ua = request.headers.get("user-agent");
	if (!ua) return "unknown";

	const MAX_UA_LENGTH = 512;
	return ua.length > MAX_UA_LENGTH ? ua.slice(0, MAX_UA_LENGTH) : ua;
}

/**
 * TypeScript type for a Session.
 *
 * Inferred from the authConfig to include all fields added by plugins
 * (role, banned, etc.).
 *
 * @example
 * ```typescript
 * import { Session } from "./config";
 *
 * function handleSession(session: Session) {
 *   console.log(session.user.role); // "user" | "admin"
 *   console.log(session.user.banned); // boolean
 * }
 * ```
 */
export type Session = typeof authConfig.$Infer.Session;
