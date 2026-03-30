/**
 * Email Verification Module — Phase 3.5
 *
 * Provides:
 * - `generateVerificationToken()` — 32-byte CSPRNG hex token (256-bit entropy)
 * - `storeVerificationToken()` — writes token + 24-hour expiry to DB
 * - `sendVerificationEmail()` — fire-and-forget email via Resend SDK
 *
 * ## Design Decisions
 *
 * ### Token Format
 * `crypto.randomBytes(32).toString('hex')` produces a 64-character lowercase
 * hex string. Each call uses the OS CSPRNG — same source as JWT libraries.
 *
 * ### Email Strategy
 * Fire-and-forget: registration responds immediately regardless of whether
 * Resend delivers. Users can request a resend via `POST /api/auth/resend-verification`.
 *
 * ### Token Expiration
 * Tokens expire after 24 hours (stored in `users.verification_expires`).
 * The column is added via migration; NULL is treated as expired for safety.
 *
 * @module backend/auth/verification
 */

import { Resend } from "resend";
import { getDatabase } from "../db/connection.js";
import { loadTemplate } from "../emails/load-template.js";

// ============================================================================
// A.2 — TOKEN GENERATION
// ============================================================================

/**
 * Generates a cryptographically secure email verification token.
 *
 * Uses `crypto.randomBytes(32)` from Node's/Bun's native crypto module for
 * 256-bit entropy. Hex-encodes the result for URL-safe storage.
 *
 * @returns 64-character lowercase hex string (e.g. "a3f9b2c1...")
 *
 * @example
 * ```typescript
 * const token = generateVerificationToken();
 * // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * console.log(token.length); // 64
 * ```
 */
export function generateVerificationToken(): string {
  // crypto is a global in Bun (Web Crypto API)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// A.2b — TOKEN STORAGE
// ============================================================================

/**
 * Stores a verification token for a user with a 24-hour expiration.
 *
 * Updates `users.verification_token` and `users.verification_expires`
 * (the expiration column is added by the Phase 3.5 migration).
 *
 * @param userId - User's database ID
 * @param token - Hex verification token from `generateVerificationToken()`
 */
export function storeVerificationToken(userId: number, token: string): void {
  const db = getDatabase();

  // Calculate expiration: NOW + 24 hours
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");

  db.prepare(
    `UPDATE users
       SET verification_token = ?,
           verification_expires = ?
     WHERE id = ?`
  ).run(token, expiresAt, userId);
}

// ============================================================================
// A.3 — RESEND SINGLETON
// ============================================================================

/**
 * Lazy-initialized Resend client singleton.
 *
 * Deferred initialization prevents crashes at import time when
 * `RESEND_API_KEY` is not set (e.g. during testing with mocks).
 */
let _resendClient: Resend | null = null;

/**
 * Returns the singleton Resend client, initializing it on first access.
 *
 * @throws {Error} If `RESEND_API_KEY` environment variable is not set.
 */
export function getResendClient(): Resend {
  if (_resendClient !== null) {
    return _resendClient;
  }

  const apiKey = Bun.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[verification] RESEND_API_KEY environment variable is not set. " +
        "Add it to your .env file to enable email verification."
    );
  }

  _resendClient = new Resend(apiKey);
  return _resendClient;
}

/**
 * Resets the Resend client singleton.
 * Useful in tests to inject a different API key between runs.
 */
export function _resetResendClient(): void {
  _resendClient = null;
}

// ============================================================================
// A.4 — EMAIL SENDER
// ============================================================================

/**
 * Sends a verification email to the given address via Resend.
 *
 * **Fire-and-forget**: this function never throws. Any Resend API errors are
 * logged to the console so registration / resend endpoints can remain fast.
 *
 * @param email - Recipient's email address
 * @param token - Verification token (hex string)
 * @returns `true` if Resend accepted the email, `false` on any failure
 *
 * @example
 * ```typescript
 * // Non-blocking usage in register handler:
 * void sendVerificationEmail(user.email, token);
 * ```
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  const rawFrontendUrl = Bun.env.FRONTEND_URL?.trim();
  const frontendUrl =
    rawFrontendUrl && rawFrontendUrl !== "undefined" && rawFrontendUrl !== "null"
      ? rawFrontendUrl.replace(/\/+$/, "")
      : "http://localhost:3001";
  const normalizedToken = token.trim();
  const from = Bun.env.EMAIL_FROM ?? "URLoft <noreply@urloft.site>";

  if (!normalizedToken || normalizedToken.includes("/")) {
    console.error(
      `[verification] Refusing to send email with invalid token format: "${token}"`
    );
    return false;
  }

  const verificationUrl = `${frontendUrl}/auth/verify/${encodeURIComponent(normalizedToken)}`;

  let html: string;

  try {
    html = await loadTemplate("verification", {
      verification_url: verificationUrl,
      base_url: frontendUrl,
    });
  } catch (err) {
    console.error(
      `[verification] Failed to load email template:`,
      err
    );
    return false;
  }

  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from,
      to: email,
      subject: "Verify your email address",
      html,
    });

    if (result.error) {
      console.error(
        `[verification] Resend API error for ${email}:`,
        result.error
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[verification] Failed to send verification email to ${email}:`, err);
    return false;
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Email templates are now loaded from `backend/emails/templates/verification.html`
 * via the shared `loadTemplate()` function. This ensures consistent branding
 * and easier maintenance of email content.
 */
