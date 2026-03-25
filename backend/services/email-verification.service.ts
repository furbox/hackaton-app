import {
  getUserVerificationByToken,
  markUserEmailVerified,
} from "../db/queries.js";

export type VerifyEmailResult =
  | { status: "TOKEN_INVALID" }
  | { status: "TOKEN_EXPIRED" }
  | { status: "ALREADY_VERIFIED" }
  | { status: "VERIFIED"; userId: number; email: string };

function isExpired(value: string | null): boolean {
  if (!value) {
    return true;
  }

  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    return true;
  }

  return expiresAt.getTime() < Date.now();
}

export function verifyEmailToken(token: string): VerifyEmailResult {
  const user = getUserVerificationByToken(token);
  if (!user) {
    return { status: "TOKEN_INVALID" };
  }

  if (isExpired(user.verification_expires)) {
    return { status: "TOKEN_EXPIRED" };
  }

  if (user.email_verified === 1) {
    return { status: "ALREADY_VERIFIED" };
  }

  const updated = markUserEmailVerified(user.id);
  if (!updated) {
    return { status: "TOKEN_INVALID" };
  }

  return {
    status: "VERIFIED",
    userId: user.id,
    email: user.email,
  };
}
