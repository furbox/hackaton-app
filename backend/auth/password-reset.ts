/**
 * Password Reset Helpers — Phase 3.6
 *
 * Provides secure token generation, Resend email delivery, and DAO helpers
 * for inserting, consuming, and invalidating password reset tokens.
 *
 * Tokens are hashed (SHA-256) before being stored and expire after one hour.
 * Emails are sent fire-and-forget while errors are logged to the console.
 *
 * @module backend/auth/password-reset
 */

import { Resend } from "resend";
import {
  deleteUnusedPasswordResets,
  insertPasswordResetRow,
  getPasswordResetByToken,
  markPasswordResetAsUsed,
} from "../db/queries/index.js";
import { loadTemplate } from "../emails/load-template.js";

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const DEFAULT_EMAIL_FROM = "URLoft <noreply@urloft.site>";
const DEFAULT_FRONTEND_URL = "http://localhost:5173";
const RESET_EMAIL_SUBJECT = "Reset your URLoft password";

// ---------------------------------------------------------------------------
// RESEND CLIENT
// ---------------------------------------------------------------------------

let _resendClient: Resend | null = null;

export function _resetResendClient(): void {
  _resendClient = null;
}

export function _setResendClient(client: Resend): void {
  _resendClient = client;
}

function getResendClient(): Resend {
  if (_resendClient !== null) {
    return _resendClient;
  }

  const apiKey = Bun.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("[password-reset] RESEND_API_KEY is not configured.");
  }

  _resendClient = new Resend(apiKey);
  return _resendClient;
}

// ---------------------------------------------------------------------------
// TOKEN UTILITIES
// ---------------------------------------------------------------------------

export function generateResetToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashResetToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

// ---------------------------------------------------------------------------
// EMAIL SENDER
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  const rawFrontendUrl = Bun.env.FRONTEND_URL?.trim();
  const frontendUrl =
    rawFrontendUrl && rawFrontendUrl !== "undefined" && rawFrontendUrl !== "null"
      ? rawFrontendUrl.replace(/\/+$/, "")
      : DEFAULT_FRONTEND_URL;
  const normalizedToken = token.trim();
  const from = Bun.env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;

  if (!normalizedToken || normalizedToken.includes("/")) {
    console.error(
      `[password-reset] Refusing to send email with invalid token format: "${token}"`
    );
    return false;
  }

  const resetUrl = `${frontendUrl}/auth/reset-password/${encodeURIComponent(normalizedToken)}`;

  let html: string;

  try {
    html = await loadTemplate("password-reset", {
      reset_url: resetUrl,
      base_url: frontendUrl,
    });
  } catch (err) {
    console.error("[password-reset] Failed to load email template:", err);
    return false;
  }

  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from,
      to: email,
      subject: RESET_EMAIL_SUBJECT,
      html,
    });

    if (result.error) {
      console.error("[password-reset] Resend API error", { email, error: result.error });
      return false;
    }

    return true;
  } catch (err) {
    console.error("[password-reset] Failed to send reset email", { email, err });
    return false;
  }
}

// ---------------------------------------------------------------------------
// PASSWORD RESET STORE
// ---------------------------------------------------------------------------

export type PasswordResetErrorCode =
  | "RESET_TOKEN_INVALID"
  | "RESET_TOKEN_EXPIRED"
  | "RESET_TOKEN_USED";

export class ResetTokenError extends Error {
  constructor(public code: PasswordResetErrorCode, message: string) {
    super(message);
    this.name = "ResetTokenError";
  }
}

export interface PasswordResetConsumeResult {
  userId: number;
  resetId: number;
}

export function insertPasswordResetToken(userId: number, tokenHash: string): number {
  deleteUnusedPasswordResets(userId);
  const expiresAt = formatTimestamp(new Date(Date.now() + PASSWORD_RESET_TTL_MS));
  return insertPasswordResetRow(userId, tokenHash, expiresAt);
}

export async function consumePasswordResetToken(tokenHash: string): Promise<PasswordResetConsumeResult> {
  const row = getPasswordResetByToken(tokenHash);

  if (!row) {
    throw new ResetTokenError("RESET_TOKEN_INVALID", "Reset token is invalid or has already been used.");
  }

  if (row.used === 1) {
    throw new ResetTokenError("RESET_TOKEN_USED", "This reset token has already been used.");
  }

  if (!row.expires_at) {
    throw new ResetTokenError("RESET_TOKEN_INVALID", "Reset token is invalid or has already been used.");
  }

  const expiresAt = new Date(row.expires_at);
  if (expiresAt < new Date()) {
    throw new ResetTokenError("RESET_TOKEN_EXPIRED", "Reset token has expired.");
  }

  const success = markPasswordResetAsUsed(row.id);
  if (!success) {
    throw new ResetTokenError("RESET_TOKEN_USED", "This reset token has already been used.");
  }

  return { userId: row.user_id, resetId: row.id };
}
