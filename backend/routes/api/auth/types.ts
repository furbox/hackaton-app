/**
 * Auth Route Contracts
 *
 * Shared types for all auth endpoints: error codes, request payloads,
 * and the canonical `{ error, code }` response shape.
 *
 * @module backend/routes/auth/types
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Machine-readable error codes returned by auth endpoints.
 *
 * These codes are stable identifiers that clients can switch on to display
 * appropriate messages without parsing human-readable error strings.
 */
export type AuthErrorCode =
  | "VALIDATION_ERROR"     // 400 — malformed or invalid payload
  | "RATE_LIMITED"         // 429 — too many requests from this IP
  | "INVALID_CREDENTIALS"  // 401 — wrong email or password
  | "EMAIL_NOT_VERIFIED"   // 403 — account exists but email not confirmed
  | "USER_BANNED"          // 403 — user has been banned
  | "ALREADY_EXISTS"       // 409 — duplicate email or username
  | "UNAUTHORIZED"         // 401 — missing or invalid session
  | "AUTH_PROVIDER_ERROR"   // 500 — unexpected error from Better Auth
  | "RESET_TOKEN_INVALID"   // 400 — token not found or already used
  | "RESET_TOKEN_EXPIRED"   // 400 — token expired
  | "RESET_TOKEN_USED"      // 400 — token already consumed

// ============================================================================
// ERROR RESPONSE BODY
// ============================================================================

/**
 * Standard JSON error envelope returned by all auth endpoints.
 *
 * @example
 * ```json
 * { "error": "Email already registered", "code": "ALREADY_EXISTS" }
 * ```
 */
export interface ApiErrorBody {
  error: string;
  code: AuthErrorCode;
}

// ============================================================================
// REQUEST PAYLOAD TYPES
// ============================================================================

/**
 * Request body for `POST /api/auth/register`.
 */
export interface RegisterBody {
  /** Display name for the new user */
  name: string;
  /** Email address (will be normalized to lowercase/trimmed) */
  email: string;
  /** Password — must satisfy minimum complexity rules */
  password: string;
}

/**
 * Request body for `POST /api/auth/login`.
 */
export interface LoginBody {
  /** Registered email address */
  email: string;
  /** User's password */
  password: string;
}

/**
 * Request body for `POST /api/auth/forgot-password`.
 */
export interface ForgotPasswordBody {
  /** Email address requesting password reset */
  email: string;
}

/**
 * Request body for `POST /api/auth/reset-password`.
 */
export interface ResetPasswordBody {
  /** Reset token received via email */
  token: string;
  /** New password that must satisfy strength requirements */
  newPassword: string;
}

// ============================================================================
// VERIFICATION TYPES
// ============================================================================

/**
 * Request body for `POST /api/auth/resend-verification`.
 */
export interface VerificationBody {
  /** Email address to resend verification to */
  email: string;
}

/**
 * Machine-readable error codes returned by verification endpoints.
 *
 * These codes allow clients to switch on specific verification errors
 * without parsing human-readable strings.
 */
export type VerificationErrorCode =
  | "TOKEN_INVALID"    // 400 — token not found or does not match any user
  | "TOKEN_EXPIRED"    // 400 — token found but past its expiration timestamp
  | "ALREADY_VERIFIED" // 400 — email already marked as verified
  | "USER_NOT_FOUND";  // 404 — no user with that email address (resend endpoint)

// ============================================================================
// REQUEST CONTEXT
// ============================================================================

/**
 * Extracted request metadata used for audit logging and rate limiting.
 */
export interface RequestContext {
  /** Client IP address (or "unknown") */
  ip: string;
  /** Sanitized User-Agent string (or "unknown") */
  userAgent: string;
}
