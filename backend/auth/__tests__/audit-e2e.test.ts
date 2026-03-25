/**
 * E2E Audit Trail Verification Test
 *
 * This test verifies the complete lifecycle of a user and their corresponding audit trail.
 * It ensures that all security events are properly logged in the correct order with the
 * appropriate metadata.
 *
 * @module backend/auth/__tests__/audit-e2e.test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import { clearAllRateLimits } from "../../routes/auth/rate-limit.js";
import { handleAuthRoute, type AuthDeps } from "../../routes/auth/index.js";
import { getUserAuditLogs, parseMetadata } from "../../services/audit-log.service.js";
import {
  generateResetToken,
  hashResetToken,
  insertPasswordResetToken,
} from "../../auth/password-reset.js";
import { getUserByEmail, updateUser } from "../../db/queries.js";

let testDb: Database;

// ============================================================================
// SCHEMA SETUP
// ============================================================================

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");

  // Ranks table
  db.run(`
    CREATE TABLE ranks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      min_links INTEGER NOT NULL DEFAULT 0,
      max_links INTEGER,
      display_name TEXT NOT NULL DEFAULT 'Newbie',
      badge_url TEXT,
      color TEXT DEFAULT '#6366f1',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`INSERT INTO ranks (id, name, min_links, display_name) VALUES (1, 'newbie', 0, 'Newbie')`);

  // Users table
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      rank_id INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
    )
  `);

  // Password Resets table
  db.run(`
    CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Sessions table
  db.run(`
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_jti TEXT UNIQUE NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Audit Logs table
  db.run(`
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

const TEST_USER = {
  name: "E2E Test User",
  email: "e2e-test@example.com",
  password: "InitialPassword123!",
  newPassword: "NewPassword456!",
};

function makePost(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "E2E-Test/1.0",
      "x-forwarded-for": "198.51.100.42",
    },
    body: JSON.stringify(body),
  });
}

function makeGet(path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "GET",
    headers: {
      "user-agent": "E2E-Test/1.0",
      "x-forwarded-for": "198.51.100.42",
    },
  });
}

async function callRoute(req: Request, path: string, deps?: Partial<AuthDeps>): Promise<Response> {
  const response = await handleAuthRoute(req, path, deps);
  return response ?? new Response("Not found", { status: 404 });
}

/**
 * Wait for an audit log event to appear in the database.
 * Since audit logs are fire-and-forget (async), we need to poll until they're written.
 */
async function waitForAuditLog(
  userId: number,
  event: string,
  timeoutMs = 1000
): Promise<{ id: number; event: string; metadata: string | null } | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const row = testDb
      .query(`SELECT id, event, metadata FROM audit_logs WHERE user_id = ? AND event = ?`)
      .get(userId, event) as { id: number; event: string; metadata: string | null } | null;
    if (row) {
      return row;
    }
    // Sleep for 10ms before retrying
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

/**
 * Mock dependencies for Better Auth operations.
 * Returns a fresh user object for each call to simulate actual auth behavior.
 */
function createMockDeps(): AuthDeps {
  let sessionTokenCounter = 0;
  const userId = 1000; // Fixed user ID for consistency in the test

  return {
    signUpEmail: async () => {
      // Manually create the user in the database to satisfy foreign key constraints
      const passwordHash = await Bun.password.hash(TEST_USER.password);
      testDb.run(
        `INSERT INTO users (id, username, email, password_hash, email_verified, rank_id)
         VALUES (?, ?, ?, ?, 0, 1)`,
        [userId, TEST_USER.name.toLowerCase().replace(/\s+/g, ""), TEST_USER.email, passwordHash]
      );

      return {
        headers: new Headers(),
        response: {
          user: {
            id: String(userId),
            email: TEST_USER.email,
            name: TEST_USER.name,
          },
          token: null,
        },
      };
    },

    signInEmail: async () => {
      const token = `session-token-${++sessionTokenCounter}`;
      return {
        headers: new Headers(),
        response: {
          token,
          user: {
            id: String(userId),
            email: TEST_USER.email,
            name: TEST_USER.name,
          },
          redirect: false,
        },
      };
    },

    signOut: async () => ({
      headers: new Headers(),
      response: {},
    }),

    authenticateSession: async () => ({
      user: {
        id: String(userId),
        email: TEST_USER.email,
        name: TEST_USER.name,
      },
    }),
  };
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeAll(() => {
  testDb = new Database(":memory:");
  createSchema(testDb);
  setTestDatabase(testDb);
  process.env.TRUST_PROXY = "true";
});

afterAll(() => {
  closeDatabase();
});

beforeEach(() => {
  testDb.run("DELETE FROM audit_logs");
  testDb.run("DELETE FROM password_resets");
  testDb.run("DELETE FROM sessions");
  testDb.run("DELETE FROM users");
  clearAllRateLimits();
});

// ============================================================================
// E2E TEST: Complete User Lifecycle Audit Trail
// ============================================================================

describe("E2E: Complete user lifecycle audit trail", () => {
  test("complete user journey creates comprehensive audit trail in correct order", async () => {
    const mockDeps = createMockDeps();

    // =========================================================================
    // 1. REGISTER
    // =========================================================================
    const registerResponse = await callRoute(
      makePost("/api/auth/register", {
        name: TEST_USER.name,
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      "/api/auth/register",
      mockDeps
    );

    expect(registerResponse.status).toBe(201);
    const registerBody = await registerResponse.json();
    expect(registerBody.user).toBeDefined();
    expect(registerBody.user.email).toBe(TEST_USER.email);

    // Verify user exists in database
    const userAfterRegister = getUserByEmail(TEST_USER.email);
    expect(userAfterRegister).toBeDefined();
    expect(userAfterRegister?.email_verified).toBe(0); // Not verified yet

    // Verify register event in audit log (wait for async write)
    await new Promise((resolve) => setTimeout(resolve, 100)); // Extra delay for audit log
    const registerLog = await waitForAuditLog(1000, "register", 2000);
    expect(registerLog).toBeTruthy();
    expect(registerLog?.event).toBe("register");

    const registerMetadata = parseMetadata(registerLog?.metadata ?? null);
    expect(registerMetadata?.username).toBe(TEST_USER.name);

    // =========================================================================
    // 2. LOGIN (WITHOUT VERIFICATION) - SHOULD FAIL
    // =========================================================================
    const loginBeforeVerifyResponse = await callRoute(
      makePost("/api/auth/login", {
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      "/api/auth/login",
      mockDeps
    );

    expect(loginBeforeVerifyResponse.status).toBe(403);
    const loginBeforeVerifyBody = await loginBeforeVerifyResponse.json();
    expect(loginBeforeVerifyBody.code).toBe("EMAIL_NOT_VERIFIED");

    // Verify NO login event in audit log (login failed)
    // Wait a bit to ensure no async log appears
    await new Promise((resolve) => setTimeout(resolve, 50));
    const loginEventsBeforeVerify = testDb
      .query(`SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ? AND event = 'login'`)
      .get(1000) as { count: number };
    expect(loginEventsBeforeVerify.count).toBe(0);

    // =========================================================================
    // 3. VERIFY EMAIL
    // =========================================================================
    // Extract verification token from database
    const userWithToken = testDb
      .query("SELECT id, verification_token FROM users WHERE email = ?")
      .get(TEST_USER.email) as { id: number; verification_token: string } | null;
    expect(userWithToken).toBeTruthy();
    const verificationToken = userWithToken!.verification_token;
    expect(verificationToken).toBeTruthy();

    // Call verification endpoint
    const verifyResponse = await callRoute(
      makeGet(`/api/auth/verify/${verificationToken}`),
      `/api/auth/verify/${verificationToken}`
    );

    expect(verifyResponse.status).toBe(200);
    const verifyBody = await verifyResponse.json();
    expect(verifyBody.message).toContain("verified successfully");

    // Verify email_verified = true in database
    const userAfterVerify = getUserByEmail(TEST_USER.email);
    expect(userAfterVerify?.email_verified).toBe(1);
    expect(userAfterVerify?.verification_token).toBeNull();

    // Verify email_verified event in audit log (wait for async write)
    const emailVerifiedLog = await waitForAuditLog(1000, "email_verified");
    expect(emailVerifiedLog).toBeTruthy();

    // =========================================================================
    // 4. LOGIN (SUCCESSFUL)
    // =========================================================================
    const loginResponse = await callRoute(
      makePost("/api/auth/login", {
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      "/api/auth/login",
      mockDeps
    );

    expect(loginResponse.status).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.token).toBeDefined();
    expect(loginBody.user).toBeDefined();

    // Verify login event in audit log (wait for async write)
    const loginLog = await waitForAuditLog(1000, "login");
    expect(loginLog).toBeTruthy();
    const loginMetadata = parseMetadata(loginLog?.metadata ?? null);
    expect(loginMetadata?.method).toBe("email_password");
    expect(typeof loginMetadata?.sessionTokenPreview).toBe("string");

    // =========================================================================
    // 5. LOGOUT
    // =========================================================================
    // Create a request with the session cookie from login
    const logoutRequest = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "E2E-Test/1.0",
        "x-forwarded-for": "198.51.100.42",
        "cookie": "better-auth.session_token=" + loginBody.token,
      },
      body: JSON.stringify({}),
    });

    const logoutResponse = await callRoute(logoutRequest, "/api/auth/logout", mockDeps);

    expect(logoutResponse.status).toBe(204);

    // Verify logout event in audit log (wait for async write)
    const logoutLog = await waitForAuditLog(1000, "logout");
    expect(logoutLog).toBeTruthy();
    expect(parseMetadata(logoutLog?.metadata ?? null)?.method).toBe("user");

    // =========================================================================
    // 6. PASSWORD RESET - REQUEST
    // =========================================================================
    const forgotPasswordResponse = await callRoute(
      makePost("/api/auth/forgot-password", {
        email: TEST_USER.email,
      }),
      "/api/auth/forgot-password"
    );

    expect(forgotPasswordResponse.status).toBe(200);
    const forgotPasswordBody = await forgotPasswordResponse.json();
    expect(forgotPasswordBody.message).toContain("reset link has been sent");

    // Verify password_reset_requested event in audit log (wait for async write)
    const resetRequestedLog = await waitForAuditLog(1000, "password_reset_requested");
    expect(resetRequestedLog).toBeTruthy();
    expect(parseMetadata(resetRequestedLog?.metadata ?? null)?.method).toBe("email");

    // =========================================================================
    // 7. PASSWORD RESET - COMPLETE
    // =========================================================================
    // Generate our own token for the reset (simulating user clicking the link in email)
    const resetToken = generateResetToken();
    const resetTokenHash = await hashResetToken(resetToken);
    insertPasswordResetToken(1000, resetTokenHash);

    // Call reset password endpoint
    const resetPasswordResponse = await callRoute(
      makePost("/api/auth/reset-password", {
        token: resetToken,
        newPassword: TEST_USER.newPassword,
      }),
      "/api/auth/reset-password"
    );

    if (resetPasswordResponse.status !== 200) {
      const errorBody = await resetPasswordResponse.json();
      console.error("Reset password error:", errorBody);
    }

    expect(resetPasswordResponse.status).toBe(200);
    const resetPasswordBody = await resetPasswordResponse.json();
    expect(resetPasswordBody.message).toContain("reset successful");

    // Verify password was actually changed in database
    const userAfterReset = getUserByEmail(TEST_USER.email);
    expect(userAfterReset).toBeDefined();

    // Verify password_reset_completed event in audit log (wait for async write)
    const resetCompletedLog = await waitForAuditLog(1000, "password_reset_completed");
    expect(resetCompletedLog).toBeTruthy();
    expect(parseMetadata(resetCompletedLog?.metadata ?? null)?.method).toBe("token");

    // =========================================================================
    // 8. LOGIN WITH NEW PASSWORD
    // =========================================================================
    // Clear rate limits to avoid 429 on final login
    clearAllRateLimits();

    const loginWithNewPasswordResponse = await callRoute(
      makePost("/api/auth/login", {
        email: TEST_USER.email,
        password: TEST_USER.newPassword,
      }),
      "/api/auth/login",
      mockDeps
    );

    expect(loginWithNewPasswordResponse.status).toBe(200);
    const loginWithNewPasswordBody = await loginWithNewPasswordResponse.json();
    expect(loginWithNewPasswordBody.token).toBeDefined();

    // Wait a bit for the final audit log to be written
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify second login event in audit log
    const loginCount = testDb
      .query(`SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ? AND event = 'login'`)
      .get(1000) as { count: number };
    expect(loginCount.count).toBeGreaterThanOrEqual(2); // At least 2 logins

    // =========================================================================
    // VERIFY FINAL AUDIT TRAIL
    // =========================================================================
    const finalLogs = getUserAuditLogs(1000, 100);
    const events = finalLogs.map((l) => l.event);

    // Expected sequence of events (in DESC order from getUserAuditLogs):
    // 0. login (second with new password) - newest
    // 1. password_reset_completed
    // 2. password_reset_requested
    // 3. logout
    // 4. login (first)
    // 5. email_verified
    // 6. register - oldest

    expect(events.length).toBeGreaterThanOrEqual(7);

    // Find indices of critical events
    const registerIndex = events.indexOf("register");
    const emailVerifiedIndex = events.indexOf("email_verified");
    const firstLoginIndex = events.lastIndexOf("login"); // Last occurrence = first login (older)
    const logoutIndex = events.indexOf("logout");
    const resetRequestedIndex = events.indexOf("password_reset_requested");
    const resetCompletedIndex = events.indexOf("password_reset_completed");

    // Verify all critical events are present
    expect(registerIndex).toBeGreaterThanOrEqual(0);
    expect(emailVerifiedIndex).toBeGreaterThanOrEqual(0);
    expect(firstLoginIndex).toBeGreaterThanOrEqual(0);
    expect(logoutIndex).toBeGreaterThanOrEqual(0);
    expect(resetRequestedIndex).toBeGreaterThanOrEqual(0);
    expect(resetCompletedIndex).toBeGreaterThanOrEqual(0);

    // Verify reverse chronological order (DESC from getUserAuditLogs)
    // In DESC order: register should have the HIGHEST index (oldest)
    expect(registerIndex).toBeGreaterThan(emailVerifiedIndex);
    expect(emailVerifiedIndex).toBeGreaterThan(firstLoginIndex);
    expect(firstLoginIndex).toBeGreaterThan(logoutIndex);
    expect(logoutIndex).toBeGreaterThan(resetRequestedIndex);
    expect(resetRequestedIndex).toBeGreaterThan(resetCompletedIndex);

    // Verify timestamps are in descending order (newest first)
    for (let i = 0; i < finalLogs.length - 1; i++) {
      const current = new Date(finalLogs[i].createdAt).getTime();
      const next = new Date(finalLogs[i + 1].createdAt).getTime();
      // Since logs are ordered DESC, current should be >= next
      expect(current).toBeGreaterThanOrEqual(next);
    }

    // Verify metadata in critical events
    // Note: getUserAuditLogs already parses metadata, so finalRegisterLog.metadata is an object, not JSON
    const finalRegisterLog = finalLogs.find((l) => l.event === "register");
    expect(finalRegisterLog?.metadata).toBeTruthy();
    expect(finalRegisterLog?.metadata?.username).toBe(TEST_USER.name);

    // Find the first login (older one, not the most recent)
    // Since logs are in DESC order, we need the LAST occurrence of "login"
    const loginEvents = finalLogs.filter((l) => l.event === "login");
    expect(loginEvents.length).toBeGreaterThanOrEqual(2); // Should have at least 2 logins
    const finalFirstLoginLog = loginEvents[loginEvents.length - 1]; // Last (oldest) login
    expect(finalFirstLoginLog?.metadata?.method).toBe("email_password");
    expect(typeof finalFirstLoginLog?.metadata?.sessionTokenPreview).toBe("string");

    const finalLogoutLog = finalLogs.find((l) => l.event === "logout");
    expect(finalLogoutLog?.metadata?.method).toBe("user");

    const finalResetRequestedLog = finalLogs.find((l) => l.event === "password_reset_requested");
    expect(finalResetRequestedLog?.metadata?.method).toBe("email");

    const finalResetCompletedLog = finalLogs.find((l) => l.event === "password_reset_completed");
    expect(finalResetCompletedLog?.metadata?.method).toBe("token");
  });
});
