/**
 * Unit tests for auth utilities: validators and rate limiter.
 *
 * These tests are pure — no DB, no Better Auth, no network.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateRegisterBody,
  validateLoginBody,
} from "../validation.js";
import {
  checkRateLimit,
  resetRateLimit,
  clearAllRateLimits,
} from "../rate-limit.js";

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

describe("validateEmail", () => {
  test("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  test("accepts email with subdomain", () => {
    expect(validateEmail("user@mail.example.co.uk")).toBeNull();
  });

  test("rejects empty string", () => {
    expect(validateEmail("")).not.toBeNull();
  });

  test("rejects email without @", () => {
    expect(validateEmail("notanemail")).not.toBeNull();
  });

  test("rejects email without domain", () => {
    expect(validateEmail("user@")).not.toBeNull();
  });

  test("rejects email without local part", () => {
    expect(validateEmail("@domain.com")).not.toBeNull();
  });
});

describe("normalizeEmail", () => {
  test("lowercases the email", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  test("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  test("handles combined cases", () => {
    expect(normalizeEmail("  Alice@Mail.Org  ")).toBe("alice@mail.org");
  });
});

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

describe("validatePassword", () => {
  test("accepts valid password (8+ chars, letter + digit)", () => {
    expect(validatePassword("Secret99")).toBeNull();
  });

  test("rejects empty string", () => {
    expect(validatePassword("")).not.toBeNull();
  });

  test("rejects password shorter than 8 chars", () => {
    expect(validatePassword("abc1234")).not.toBeNull();
  });

  test("rejects password with no letters", () => {
    expect(validatePassword("12345678")).not.toBeNull();
  });

  test("rejects password with no digits", () => {
    expect(validatePassword("abcdefgh")).not.toBeNull();
  });

  test("accepts password exactly 8 chars", () => {
    expect(validatePassword("abcdef12")).toBeNull();
  });

  test("accepts long complex password", () => {
    expect(validatePassword("Sup3rS3cur3P@ssw0rd!")).toBeNull();
  });
});

// ============================================================================
// REGISTER BODY VALIDATION
// ============================================================================

describe("validateRegisterBody", () => {
  test("accepts valid payload", () => {
    const result = validateRegisterBody({
      name: "Alice",
      email: "alice@example.com",
      password: "Secret99",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.email).toBe("alice@example.com");
      expect(result.data.name).toBe("Alice");
    }
  });

  test("normalizes email to lowercase", () => {
    const result = validateRegisterBody({
      name: "Alice",
      email: "ALICE@EXAMPLE.COM",
      password: "Secret99",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });

  test("rejects missing name", () => {
    const result = validateRegisterBody({
      email: "alice@example.com",
      password: "Secret99",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.name).toBeDefined();
    }
  });

  test("rejects missing email", () => {
    const result = validateRegisterBody({ name: "Alice", password: "Secret99" });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.email).toBeDefined();
    }
  });

  test("rejects invalid email", () => {
    const result = validateRegisterBody({
      name: "Alice",
      email: "notvalid",
      password: "Secret99",
    });
    expect(result.valid).toBe(false);
  });

  test("rejects weak password", () => {
    const result = validateRegisterBody({
      name: "Alice",
      email: "alice@example.com",
      password: "short",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.password).toBeDefined();
    }
  });

  test("rejects non-object body", () => {
    const result = validateRegisterBody("not an object");
    expect(result.valid).toBe(false);
  });

  test("rejects null body", () => {
    const result = validateRegisterBody(null);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// LOGIN BODY VALIDATION
// ============================================================================

describe("validateLoginBody", () => {
  test("accepts valid payload", () => {
    const result = validateLoginBody({
      email: "alice@example.com",
      password: "anypassword",
    });
    expect(result.valid).toBe(true);
  });

  test("normalizes email on login", () => {
    const result = validateLoginBody({
      email: "ALICE@EXAMPLE.COM",
      password: "anypassword",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.email).toBe("alice@example.com");
    }
  });

  test("accepts rememberMe: true", () => {
    const result = validateLoginBody({
      email: "alice@example.com",
      password: "anypassword",
      rememberMe: true,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.rememberMe).toBe(true);
    }
  });

  test("accepts rememberMe: false", () => {
    const result = validateLoginBody({
      email: "alice@example.com",
      password: "anypassword",
      rememberMe: false,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.rememberMe).toBe(false);
    }
  });

  test("defaults rememberMe to false when not provided", () => {
    const result = validateLoginBody({
      email: "alice@example.com",
      password: "anypassword",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.rememberMe).toBe(false);
    }
  });

  test("accepts kebab-case remember-me from HTML forms", () => {
    const result = validateLoginBody({
      email: "alice@example.com",
      password: "anypassword",
      "remember-me": true,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.rememberMe).toBe(true);
    }
  });

  test("defaults rememberMe to false for invalid values", () => {
    const result = validateLoginBody({
      email: "alice@example.com",
      password: "anypassword",
      rememberMe: "true" as any, // string instead of boolean
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.rememberMe).toBe(false);
    }
  });

  test("rejects missing email", () => {
    const result = validateLoginBody({ password: "anypassword" });
    expect(result.valid).toBe(false);
  });

  test("rejects missing password", () => {
    const result = validateLoginBody({ email: "alice@example.com" });
    expect(result.valid).toBe(false);
  });

  test("rejects non-object body", () => {
    const result = validateLoginBody(42);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// RATE LIMITER
// ============================================================================

describe("checkRateLimit", () => {
  const TEST_IP = "192.168.0.test";

  beforeEach(() => {
    resetRateLimit(TEST_IP);
  });

  test("allows first 5 requests", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(TEST_IP).allowed).toBe(true);
    }
  });

  test("blocks the 6th request", () => {
    for (let i = 0; i < 5; i++) checkRateLimit(TEST_IP);
    const result = checkRateLimit(TEST_IP);
    expect(result.allowed).toBe(false);
  });

  test("retryAfterSeconds is positive when blocked", () => {
    for (let i = 0; i < 6; i++) checkRateLimit(TEST_IP);
    const result = checkRateLimit(TEST_IP);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  test("different IPs have independent buckets", () => {
    const ipA = "10.0.0.1.test";
    const ipB = "10.0.0.2.test";
    clearAllRateLimits();

    for (let i = 0; i < 5; i++) checkRateLimit(ipA);
    const blockA = checkRateLimit(ipA);
    const firstB = checkRateLimit(ipB);

    expect(blockA.allowed).toBe(false);
    expect(firstB.allowed).toBe(true);

    resetRateLimit(ipA);
    resetRateLimit(ipB);
  });

  test("reset clears the bucket for that IP", () => {
    for (let i = 0; i < 5; i++) checkRateLimit(TEST_IP);
    resetRateLimit(TEST_IP);
    expect(checkRateLimit(TEST_IP).allowed).toBe(true);
  });
});
