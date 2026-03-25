/**
 * Auth Router
 *
 * Handles `POST /api/auth/register`, `POST /api/auth/login`,
 * `POST /api/auth/logout`, `GET /api/auth/verify/:token`, and
 * `POST /api/auth/resend-verification`.
 *
 * ## Flow Overview
 *
 * Register:
 *   rate-limit check → validate body → authConfig.api.signUpEmail → generate token → send email → audit
 *
 * Login:
 *   rate-limit check → validate body → check email_verified → authConfig.api.signInEmail → audit
 *
 * Logout:
 *   authenticated() → authConfig.api.signOut → audit
 *
 * Verify:
 *   extract token → DB lookup + expiry check → mark verified → audit
 *
 * Resend:
 *   parse body → user lookup → regenerate token → send email → audit
 *
 * ## Testability
 *
 * `handleAuthRoute()` accepts optional dependency overrides so tests can
 * inject mocks without relying on module-level mocking.
 *
 * @module backend/routes/auth
 */

import { authConfig } from "../../auth/config.js";
import {
  authenticated,
} from "../../auth/middleware.js";
import {
  generateVerificationToken,
  storeVerificationToken,
  sendVerificationEmail,
} from "../../auth/verification.js";
import {
  consumePasswordResetToken,
  generateResetToken,
  hashResetToken,
  insertPasswordResetToken,
  sendPasswordResetEmail,
  ResetTokenError,
} from "../../auth/password-reset.js";
import { createAuditLog, extractRequestInfo } from "../../services/audit-log.service.js";
import { getUserByEmail, invalidateUserSessions, updateUser } from "../../db/queries.js";
import { getDatabase } from "../../db/connection.js";
import { verifyEmailToken } from "../../services/email-verification.service.js";
import { checkRateLimit } from "./rate-limit.js";
import {
  validateForgotPasswordBody,
  validateLoginBody,
  validateRegisterBody,
  validateResetPasswordBody,
} from "./validation.js";
import type { ApiErrorBody, AuthErrorCode, VerificationErrorCode } from "./types.js";

// ============================================================================
// DEPENDENCY TYPES (for testing)
// ============================================================================

/**
 * Auth API operations that can be injected/mocked in tests.
 */
export interface AuthDeps {
  signUpEmail(opts: {
    body: { name: string; email: string; password: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user: Record<string, unknown>; token: string | null } }>;

  signInEmail(opts: {
    body: { email: string; password: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { token: string; user: Record<string, unknown>; redirect: boolean } }>;

  signOut(opts: {
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: Record<string, unknown> }>;

  /**
   * Validates session and fingerprint. Returns a Session object or an error Response.
   */
  authenticateSession(req: Request): Promise<Response | { user: { id: string; [key: string]: unknown } }>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Builds a JSON error response using the canonical `{ error, code }` shape.
 */
function authError(
  status: number,
  message: string,
  code: AuthErrorCode,
  extraHeaders?: Record<string, string>
): Response {
  const body: ApiErrorBody = { error: message, code };
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

/**
 * Builds a JSON error response for verification-specific error codes.
 */
function verificationError(
  status: number,
  message: string,
  code: VerificationErrorCode
): Response {
  return Response.json(
    { error: message, code },
    { status, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Parses the request body as JSON safely.
 */
async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function toNumericUserId(value: unknown): number | undefined {
  const numericId = Number(value);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return undefined;
  }
  return numericId;
}

function tokenPreview(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const preview = value.slice(0, 8);
  return `${preview}...`;
}

// ============================================================================
// RATE LIMIT GUARD
// ============================================================================

function applyRateLimit(ip: string): Response | null {
  const result = checkRateLimit(ip);
  if (!result.allowed) {
    return authError(
      429,
      "Too many requests — please wait before trying again",
      "RATE_LIMITED",
      { "Retry-After": String(result.retryAfterSeconds) }
    );
  }
  return null;
}

export const FORGOT_PASSWORD_RESPONSE_MESSAGE =
  "If that email exists, a reset link has been sent to the associated account.";

export const RESET_PASSWORD_RESPONSE_MESSAGE =
  "Password reset successful. Please log in with your new credentials.";

// ============================================================================
// ERROR MAPPER
// ============================================================================

/**
 * Maps Better Auth thrown errors to canonical HTTP responses.
 */
function mapBetterAuthError(err: unknown, context: string): Response {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const status = typeof e.status === "number" ? e.status : 0;

    const body = e.body && typeof e.body === "object"
      ? (e.body as Record<string, unknown>)
      : {};

    const message =
      typeof e.message === "string" ? e.message :
      typeof body.message === "string" ? body.message :
      "Authentication error";

    const baCode = typeof body.code === "string" ? body.code : "";

    // ── 422 / 409 — duplicate user ──
    if (
      status === 422 ||
      status === 409 ||
      baCode === "USER_ALREADY_EXISTS" ||
      baCode === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
      (typeof message === "string" && message.toLowerCase().includes("already"))
    ) {
      return authError(409, "An account with this email already exists", "ALREADY_EXISTS");
    }

    // ── 403 — email not verified ──
    if (
      baCode === "EMAIL_NOT_VERIFIED" ||
      (typeof message === "string" && message.toLowerCase().includes("verify"))
    ) {
      return authError(403, "Please verify your email before logging in", "EMAIL_NOT_VERIFIED");
    }

    // ── 403 — user banned ──
    if (
      baCode === "USER_BANNED" ||
      (typeof message === "string" && message.toLowerCase().includes("ban"))
    ) {
      return authError(403, "This account has been suspended", "USER_BANNED");
    }

    // ── 401 — invalid credentials ──
    if (status === 401 || status === 400) {
      return authError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    console.error(`[AUTH:${context}] Unhandled Better Auth error`, { status, message, baCode });
  } else {
    console.error(`[AUTH:${context}] Unknown error`, err);
  }

  return authError(500, "An unexpected authentication error occurred", "AUTH_PROVIDER_ERROR");
}

// ============================================================================
// HANDLER FACTORIES
// ============================================================================

/**
 * Handles `POST /api/auth/register`.
 */
async function handleRegister(req: Request, deps: AuthDeps): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  // 1. Rate limit
  const rateLimitResponse = applyRateLimit(ipAddress);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Parse + validate body
  const rawBody = await parseJsonBody(req);
  if (rawBody === null) {
    return authError(400, "Invalid JSON body", "VALIDATION_ERROR");
  }

  const validation = validateRegisterBody(rawBody);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] ?? "Validation failed";
    return authError(400, firstError, "VALIDATION_ERROR");
  }

  const { name, email, password } = validation.data;

  // 3. Call Better Auth to create the user
  try {
    const baResponse = await deps.signUpEmail({
      body: { name, email, password },
      headers: req.headers,
      returnHeaders: true,
    });

    const user = baResponse.response?.user ?? null;

    // 4. Generate and store verification token (NEW — Phase 3.5)
    const userId = toNumericUserId(user?.id);
    if (userId) {
      try {
        const token = generateVerificationToken();
        storeVerificationToken(userId, token);

        // 5. Send verification email (fire-and-forget — never blocks response)
        void sendVerificationEmail(email, token);
      } catch (tokenErr) {
        // Non-fatal: token generation failure should not break registration
        console.error("[register] Failed to generate/store verification token:", tokenErr);
      }
    }

    // 6. Audit log (fire-and-forget)
    void createAuditLog({
      userId,
      event: "register",
      ipAddress,
      userAgent,
      metadata: { method: "email_password", username: name },
    });

    // 7. Return 201 with user (no password hash)
    return Response.json({ user }, { status: 201 });
  } catch (err: unknown) {
    return mapBetterAuthError(err, "register");
  }
}

/**
 * Handles `POST /api/auth/login`.
 */
async function handleLogin(req: Request, deps: AuthDeps): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  // 1. Rate limit
  const rateLimitResponse = applyRateLimit(ipAddress);
  if (rateLimitResponse) return rateLimitResponse;

  // 2. Parse + validate body
  const rawBody = await parseJsonBody(req);
  if (rawBody === null) {
    return authError(400, "Invalid JSON body", "VALIDATION_ERROR");
  }

  const validation = validateLoginBody(rawBody);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] ?? "Validation failed";
    return authError(400, firstError, "VALIDATION_ERROR");
  }

  const { email, password } = validation.data;

  // 3. Check email verification BEFORE calling Better Auth (NEW — Phase 3.5)
  //    This gives a clear "verify your email" message instead of a generic BA error.
  const userRecord = getUserByEmail(email);
  if (userRecord && !userRecord.email_verified) {
    return authError(
      403,
      "Please verify your email before logging in. Check your inbox or request a new verification email.",
      "EMAIL_NOT_VERIFIED"
    );
  }

  // 3.1. Check ban status BEFORE calling Better Auth (Phase D)
  //     This prevents banned users from logging in and auto-unbans expired bans.
  if (userRecord && userRecord.banned === 1) {
    // Check if the ban has expired
    if (userRecord.banExpires) {
      const expiresAt = new Date(userRecord.banExpires);
      if (expiresAt <= new Date()) {
        // Ban expired - auto-unban the user
        const db = getDatabase();
        db.prepare("UPDATE users SET banned = 0, banReason = NULL, banExpires = NULL WHERE id = ?").run(userRecord.id);
      } else {
        // Ban is still active - reject login
        const reason = userRecord.banReason || "No reason provided";
        return authError(
          403,
          `This account has been banned. Reason: ${reason}`,
          "USER_BANNED"
        );
      }
    } else {
      // Permanent ban - reject login
      const reason = userRecord.banReason || "No reason provided";
      return authError(
        403,
        `This account has been banned. Reason: ${reason}`,
        "USER_BANNED"
      );
    }
  }

  // 4. Call Better Auth to sign in
  try {
    const baResponse = await deps.signInEmail({
      body: { email, password },
      headers: req.headers,
      returnHeaders: true,
    });

    const token = baResponse.response?.token;
    const user = baResponse.response?.user ?? null;

    // 5. Audit log (fire-and-forget)
    void createAuditLog({
      userId: toNumericUserId(user?.id),
      event: "login",
      ipAddress,
      userAgent,
      metadata: {
        method: "email_password",
        ...(tokenPreview(token) ? { sessionTokenPreview: tokenPreview(token) } : {}),
      },
    });

    // 6. Forward Set-Cookie headers from Better Auth response
    const headers = new Headers({ "Content-Type": "application/json" });
    const setCookie = baResponse.headers?.get?.("set-cookie");
    if (setCookie) {
      headers.set("Set-Cookie", setCookie);
    }

    // 7. Return 200 with token + user
    return new Response(JSON.stringify({ token, user }), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    return mapBetterAuthError(err, "login");
  }
}

async function handleForgotPassword(req: Request): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  const rateLimitResponse = applyRateLimit(ipAddress);
  if (rateLimitResponse) return rateLimitResponse;

  const rawBody = await parseJsonBody(req);
  if (rawBody === null) {
    return authError(400, "Invalid JSON body", "VALIDATION_ERROR");
  }

  const validation = validateForgotPasswordBody(rawBody);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] ?? "Validation failed";
    return authError(400, firstError, "VALIDATION_ERROR");
  }

  const { email } = validation.data;
  const user = getUserByEmail(email);

  if (user) {
    try {
      const token = generateResetToken();
      const tokenHash = await hashResetToken(token);
      insertPasswordResetToken(user.id, tokenHash);
      void sendPasswordResetEmail(user.email, token);
      void createAuditLog({
        userId: user.id,
        event: "password_reset_requested",
        ipAddress,
        userAgent,
        metadata: { method: "email" },
      });
    } catch (err) {
      console.error("[forgot-password] Failed to queue reset email", err);
    }
  }

  return Response.json({ message: FORGOT_PASSWORD_RESPONSE_MESSAGE }, { status: 200 });
}

async function handleResetPassword(req: Request): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  const rateLimitResponse = applyRateLimit(ipAddress);
  if (rateLimitResponse) return rateLimitResponse;

  const rawBody = await parseJsonBody(req);
  if (rawBody === null) {
    return authError(400, "Invalid JSON body", "VALIDATION_ERROR");
  }

  const validation = validateResetPasswordBody(rawBody);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] ?? "Validation failed";
    return authError(400, firstError, "VALIDATION_ERROR");
  }

  const { token, newPassword } = validation.data;

  let consumed;
  try {
    const tokenHash = await hashResetToken(token);
    consumed = await consumePasswordResetToken(tokenHash);
  } catch (err) {
    if (err instanceof ResetTokenError) {
      return authError(400, err.message, err.code);
    }
    console.error("[reset-password] Failed to consume token", err);
    return authError(500, "An unexpected authentication error occurred", "AUTH_PROVIDER_ERROR");
  }

  let hashedPassword: string;
  try {
    hashedPassword = await Bun.password.hash(newPassword);
  } catch (err) {
    console.error("[reset-password] Failed to hash password", err);
    return authError(500, "An unexpected authentication error occurred", "AUTH_PROVIDER_ERROR");
  }

  const updatedUser = updateUser(consumed.userId, { password_hash: hashedPassword });
  if (!updatedUser) {
    console.error("[reset-password] User not found after token consumption", consumed.userId);
    return authError(500, "An unexpected authentication error occurred", "AUTH_PROVIDER_ERROR");
  }

  const invalidatedSessions = invalidateUserSessions(consumed.userId);
  invalidatedSessions.forEach((session) => {
    void createAuditLog({
      userId: consumed.userId,
      event: "session_revoked",
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      metadata: {
        reason: "password_reset",
        ...(tokenPreview(session.token_jti) ? { tokenJtiPreview: tokenPreview(session.token_jti) } : {}),
      },
    });
  });

  void createAuditLog({
    userId: consumed.userId,
    event: "password_reset_completed",
    ipAddress,
    userAgent,
    metadata: { method: "token", invalidatedSessions: invalidatedSessions.length },
  });

  return Response.json({ message: RESET_PASSWORD_RESPONSE_MESSAGE }, { status: 200 });
}

// ============================================================================
// PHASE B — VERIFICATION ENDPOINT (GET /api/auth/verify/:token)
// ============================================================================

/**
 * Handles `GET /api/auth/verify/:token`.
 *
 * Flow:
 *   1. Extract token from URL
 *   2. Look up user by token — check expiry
 *   3. If invalid/expired → 400 TOKEN_INVALID / TOKEN_EXPIRED
 *   4. If already verified → 400 ALREADY_VERIFIED
 *   5. Mark user as verified, clear token
 *   6. Audit log email_verified event
 *   7. Return 200 with success message
 */
async function handleVerifyEmail(req: Request, token: string): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  if (!token) {
    return verificationError(400, "Invalid or expired verification token", "TOKEN_INVALID");
  }

  const verification = verifyEmailToken(token);

  if (verification.status === "TOKEN_INVALID") {
    return verificationError(400, "Invalid or expired verification token", "TOKEN_INVALID");
  }

  if (verification.status === "TOKEN_EXPIRED") {
    return verificationError(400, "Verification token has expired. Please request a new one.", "TOKEN_EXPIRED");
  }

  if (verification.status === "ALREADY_VERIFIED") {
    return verificationError(400, "Email is already verified", "ALREADY_VERIFIED");
  }

  // B.3 — Audit log
  void createAuditLog({
    userId: verification.userId,
    event: "email_verified",
    ipAddress,
    userAgent,
    metadata: { verificationMethod: "token" },
  });

  return Response.json(
    { message: "Email verified successfully. You can now log in." },
    { status: 200 }
  );
}

// ============================================================================
// PHASE C — RESEND VERIFICATION (POST /api/auth/resend-verification)
// ============================================================================

/**
 * Handles `POST /api/auth/resend-verification`.
 *
 * Flow:
 *   1. Parse + validate body { email }
 *   2. Look up user by email
 *   3. 404 if not found (security: don't reveal existence)
 *   4. 400 if already verified
 *   5. Generate new token, update DB
 *   6. Send email (fire-and-forget)
 *   7. Audit log verification_resent
 *   8. Return 200
 */
async function handleResendVerification(req: Request): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  // C.1 — Parse + validate body
  const rawBody = await parseJsonBody(req);
  if (rawBody === null || typeof rawBody !== "object" || rawBody === null) {
    return verificationError(400, "Email is required", "USER_NOT_FOUND");
  }

  const body = rawBody as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;

  if (!email || !email.includes("@")) {
    return verificationError(400, "A valid email address is required", "USER_NOT_FOUND");
  }

  // C.2 — User lookup
  const user = getUserByEmail(email);

  if (!user) {
    // Security: don't reveal whether the email is registered
    return Response.json(
      { error: "User not found", code: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (user.email_verified === 1) {
    return verificationError(400, "Email is already verified", "ALREADY_VERIFIED");
  }

  // C.3 — Generate new token and send email
  try {
    const newToken = generateVerificationToken();
    storeVerificationToken(user.id, newToken);

    // Fire-and-forget
    void sendVerificationEmail(user.email, newToken);

    // Audit log
    void createAuditLog({
      userId: user.id,
      event: "verification_resent",
      ipAddress,
      userAgent,
      metadata: { method: "manual" },
    });

    return Response.json(
      { message: "Verification email sent. Please check your inbox." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[resend-verification] Failed to regenerate token:", err);
    return Response.json(
      { error: "Failed to resend verification email. Please try again.", code: "AUTH_PROVIDER_ERROR" },
      { status: 500 }
    );
  }
}

// ============================================================================
// LOGOUT HANDLER
// ============================================================================

/**
 * Handles `POST /api/auth/logout`.
 */
async function handleLogout(req: Request, deps: AuthDeps): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  // 1. Require valid session
  const sessionResult = await deps.authenticateSession(req);
  if (sessionResult instanceof Response) {
    return sessionResult;
  }

  const session = sessionResult;

  // 2. Call Better Auth to sign out
  try {
    const baResponse = await deps.signOut({
      headers: req.headers,
      returnHeaders: true,
    });

    // 3. Audit log (fire-and-forget)
    void createAuditLog({
      userId: toNumericUserId(session.user.id),
      event: "logout",
      ipAddress,
      userAgent,
      metadata: { method: "user" },
    });

    // 4. Return 204, forwarding cookie-clear headers
    const headers = new Headers();
    const setCookie = baResponse?.headers?.get?.("set-cookie");
    if (setCookie) {
      headers.set("Set-Cookie", setCookie);
    }

    return new Response(null, { status: 204, headers });
  } catch (err: unknown) {
    return mapBetterAuthError(err, "logout");
  }
}

// ============================================================================
// DEFAULT PRODUCTION DEPS
// ============================================================================

/**
 * Creates the production dependency bundle from Better Auth.
 * Tests inject their own implementations instead.
 */
function createDefaultDeps(): AuthDeps {
  return {
    signUpEmail: async (opts) => {
      const result = await (authConfig.api.signUpEmail as unknown as (o: unknown) => Promise<unknown>)(
        { ...opts, returnHeaders: true }
      );
      return result as ReturnType<AuthDeps["signUpEmail"]>;
    },

    signInEmail: async (opts) => {
      const result = await (authConfig.api.signInEmail as unknown as (o: unknown) => Promise<unknown>)(
        { ...opts, returnHeaders: true }
      );
      return result as ReturnType<AuthDeps["signInEmail"]>;
    },

    signOut: async (opts) => {
      const result = await (authConfig.api.signOut as unknown as (o: unknown) => Promise<unknown>)(
        { ...opts, returnHeaders: true }
      );
      return result as ReturnType<AuthDeps["signOut"]>;
    },

    authenticateSession: authenticated,
  };
}

// Module-level production deps (lazy-initialized to avoid DB access at import time)
let _defaultDeps: AuthDeps | null = null;
function getDefaultDeps(): AuthDeps {
  if (!_defaultDeps) {
    _defaultDeps = createDefaultDeps();
  }
  return _defaultDeps;
}

// ============================================================================
// PUBLIC ROUTER FUNCTION
// ============================================================================

/**
 * Auth route dispatcher.
 *
 * Handles:
 * - `POST /api/auth/register`
 * - `POST /api/auth/login`
 * - `POST /api/auth/logout`
 * - `GET  /api/auth/verify/:token`    (Phase 3.5)
 * - `POST /api/auth/resend-verification` (Phase 3.5)
 *
 * Returns `null` for unmatched routes so the caller can fall through.
 *
 * @param req   - Incoming HTTP request
 * @param path  - URL pathname (e.g. `/api/auth/register`)
 * @param deps  - Optional dependency overrides for testing
 * @returns A Response or `null` if the path/method doesn't match
 */
export async function handleAuthRoute(
  req: Request,
  path: string,
  deps?: Partial<AuthDeps>
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // Merge provided deps with defaults (only override what's provided)
  const resolvedDeps: AuthDeps = deps
    ? { ...getDefaultDeps(), ...deps }
    : getDefaultDeps();

  // ── GET /api/auth/verify/:token ──────────────────────────────────────────
  if (method === "GET") {
    const verifyMatch = path.match(/^\/api\/auth\/verify\/(.+)$/);
    if (verifyMatch) {
      const token = verifyMatch[1];
      return handleVerifyEmail(req, token);
    }
    return null;
  }

  if (method !== "POST") {
    return null;
  }

  // ── POST routes ──────────────────────────────────────────────────────────
  switch (path) {
    case "/api/auth/register":
      return handleRegister(req, resolvedDeps);

    case "/api/auth/login":
      return handleLogin(req, resolvedDeps);

    case "/api/auth/forgot-password":
      return handleForgotPassword(req);

    case "/api/auth/logout":
      return handleLogout(req, resolvedDeps);

    case "/api/auth/resend-verification":
      return handleResendVerification(req);

    case "/api/auth/reset-password":
      return handleResetPassword(req);

    default:
      return null;
  }
}
