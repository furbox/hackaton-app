/**
 * Auth Endpoint Validators
 *
 * Pure validation helpers for request payloads. Each validator returns
 * either `null` (valid) or a human-readable error message (invalid).
 * All validators are synchronous and free of side effects.
 *
 * @module backend/routes/auth/validation
 */

import type { RegisterBody, LoginBody, ForgotPasswordBody, ResetPasswordBody } from "./types.js";

// ============================================================================
// EMAIL
// ============================================================================

/**
 * RFC 5322-compatible email regex (simplified, production-safe).
 * Rejects strings that couldn't be valid email addresses.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes an email address: trim whitespace + lowercase.
 *
 * @param raw - Raw email string from request body
 * @returns Normalized email string
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Validates an email address.
 *
 * @param email - Already-normalized email string
 * @returns `null` if valid, error message if invalid
 */
export function validateEmail(email: string): string | null {
  if (!email || email.length === 0) {
    return "Email is required";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "Invalid email format";
  }
  return null;
}

// ============================================================================
// PASSWORD
// ============================================================================

/**
 * Minimum password length.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates a password for minimum strength requirements.
 *
 * Rules:
 * - At least 8 characters
 * - At least 1 letter (a-z, A-Z)
 * - At least 1 digit (0-9)
 *
 * @param password - Raw password string
 * @returns `null` if valid, error message if invalid
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length === 0) {
    return "Password is required";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "Password must contain at least one letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
}

// ============================================================================
// REQUEST VALIDATORS
// ============================================================================

/**
 * Validation result: either valid parsed body or a list of field errors.
 */
export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: Record<string, string> };

/**
 * Validates and normalizes a register request body.
 *
 * @param raw - Parsed JSON body (may be any shape)
 * @returns Validated `RegisterBody` or field errors
 *
 * @example
 * ```typescript
 * const result = validateRegisterBody(await req.json());
 * if (!result.valid) {
 *   return Response.json({ error: result.errors.email }, { status: 400 });
 * }
 * const { name, email, password } = result.data;
 * ```
 */
export function validateRegisterBody(
  raw: unknown
): ValidationResult<RegisterBody> {
  const errors: Record<string, string> = {};

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: { body: "Request body must be a JSON object" } };
  }

  const body = raw as Record<string, unknown>;

  // Validate name
  const name =
    typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    errors.name = "Name is required";
  } else if (name.length > 100) {
    errors.name = "Name must be at most 100 characters";
  }

  // Validate email
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  // Validate password
  const password =
    typeof body.password === "string" ? body.password : "";
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { name, email, password } };
}

/**
 * Validates a login request body.
 *
 * @param raw - Parsed JSON body (may be any shape)
 * @returns Validated `LoginBody` or field errors
 */
export function validateLoginBody(
  raw: unknown
): ValidationResult<LoginBody> {
  const errors: Record<string, string> = {};

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: { body: "Request body must be a JSON object" } };
  }

  const body = raw as Record<string, unknown>;

  // Validate email
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  // Password presence check only (no strength check on login — avoids leaking rules)
  const password =
    typeof body.password === "string" ? body.password : "";
  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { email, password } };
}

/**
 * Validates the forgot-password request body.
 */
export function validateForgotPasswordBody(
  raw: unknown
): ValidationResult<ForgotPasswordBody> {
  const errors: Record<string, string> = {};

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: { body: "Request body must be a JSON object" } };
  }

  const body = raw as Record<string, unknown>;

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const emailError = validateEmail(email);
  if (emailError) {
    errors.email = emailError;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { email } };
}

/**
 * Validates the reset-password request body.
 */
export function validateResetPasswordBody(
  raw: unknown
): ValidationResult<ResetPasswordBody> {
  const errors: Record<string, string> = {};

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: { body: "Request body must be a JSON object" } };
  }

  const body = raw as Record<string, unknown>;

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    errors.token = "Reset token is required";
  }

  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    errors.newPassword = passwordError;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { token, newPassword } };
}
