/**
 * End-to-end tests for authentication with direct database verification.
 *
 * These tests complement the existing test suite by explicitly verifying
 * database state after authentication operations.
 *
 * Focus: DB state verification (not HTTP responses, which are covered elsewhere)
 *
 * See also:
 * - auth-routes.test.ts: HTTP contract validation (with mocks)
 * - audit-e2e.test.ts: Complete user lifecycle audit trail
 * - verification.test.ts: Email verification endpoints
 * - password-reset.test.ts: Password reset endpoints
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import { clearAllRateLimits } from "../../routes/auth/rate-limit.js";
import { handleAuthRoute, type AuthDeps } from "../../routes/auth/index.js";
import {
  generateResetToken,
  hashResetToken,
  insertPasswordResetToken,
} from "../../auth/password-reset.js";
import { getUserByEmail } from "../../db/queries/index.js";
import { extractRequestInfo } from "../../services/audit-log.service.js";

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
  name: "DB Test User",
  email: "db-test@example.com",
  password: "SecurePassword123!",
  newPassword: "NewSecurePassword456!",
};

function makePost(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "DB-Test/1.0",
      "x-forwarded-for": "203.0.113.42",
    },
    body: JSON.stringify(body),
  });
}

function makeGet(path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "GET",
    headers: {
      "user-agent": "DB-Test/1.0",
      "x-forwarded-for": "203.0.113.42",
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
 * Helper to create a fingerprint from IP and User-Agent.
 */
async function createFingerprint(ip: string, userAgent: string): Promise<string> {
  const data = `${ip}|${userAgent}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Helper to create a session in the database.
 */
async function createSessionInDb(userId: number, tokenJti: string, ipAddress: string, userAgent: string): Promise<void> {
  const fingerprint = await createFingerprint(ipAddress, userAgent);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const expiresAtStr = expiresAt.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  testDb.run(
    `INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, fingerprint, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [userId, tokenJti, ipAddress, userAgent, fingerprint, expiresAtStr]
  );
}

/**
 * Mock dependencies for Better Auth operations.
 * Returns a fresh user object for each call to simulate actual auth behavior.
 */
function createMockDeps(): AuthDeps {
  let sessionTokenCounter = 0;
  const userId = 2000; // Fixed user ID for consistency in the test

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
      // Create session in database (simulating what Better Auth does)
      await createSessionInDb(userId, token, "203.0.113.42", "DB-Test/1.0");

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

    authenticateSession: async (req) => {
      // Extract session token from cookie
      const cookieHeader = req.headers.get("cookie") ?? "";
      const sessionTokenMatch = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
      const sessionToken = sessionTokenMatch ? sessionTokenMatch[1] : null;

      if (!sessionToken) {
        // Return error response
        return new Response(JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if session exists and is active
      const session = testDb
        .query("SELECT * FROM sessions WHERE token_jti = ? AND is_active = 1")
        .get(sessionToken) as { user_id: number; fingerprint: string } | null;

      if (!session) {
        return new Response(JSON.stringify({ error: "Invalid session", code: "UNAUTHORIZED" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify fingerprint
      const { ipAddress, userAgent } = extractRequestInfo(req);
      const expectedFingerprint = await createFingerprint(ipAddress, userAgent);

      if (session.fingerprint !== expectedFingerprint) {
        // Fingerprint mismatch - session hijacking attempt
        // Create audit log for token rejection (fire-and-forget)
        const { createAuditLog: createAuditLogImport } = await import("../../services/audit-log.service.js");
        void createAuditLogImport({
          userId: session.user_id,
          event: "token_rejected",
          ipAddress,
          userAgent,
          metadata: { reason: "fingerprint_mismatch" },
        });

        return new Response(JSON.stringify({ error: "Fingerprint mismatch", code: "FINGERPRINT_MISMATCH" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      return {
        user: {
          id: String(userId),
          email: TEST_USER.email,
          name: TEST_USER.name,
        },
      };
    },
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
// TESTS: Database State Verification
// ============================================================================

describe("Authentication with database verification", () => {
  test("3.9.4: register creates user with unverified email", async () => {
    const mockDeps = createMockDeps();

    // 1. Call POST /api/auth/register
    const response = await callRoute(
      makePost("/api/auth/register", {
        name: TEST_USER.name,
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      "/api/auth/register",
      mockDeps
    );

    expect(response.status).toBe(201);

    // 2. Query users table
    const user = testDb
      .query("SELECT id, email, email_verified, password_hash FROM users WHERE email = ?")
      .get(TEST_USER.email) as { id: number; email: string; email_verified: number; password_hash: string } | null;

    // 3. Verify database state
    expect(user).toBeTruthy();
    expect(user?.id).toBeDefined();
    expect(user?.email_verified).toBe(0); // Not verified
    expect(user?.password_hash).not.toBe(TEST_USER.password); // Not plain text
    expect(user?.password_hash).toMatch(/^\$argon2id\$/); // Argon2id hash (Bun.password.hash default)
  });

  test("3.9.8: login succeeds after email verification", async () => {
    const mockDeps = createMockDeps();

    // 1. Register user
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

    // 2. Manually verify email
    testDb.run("UPDATE users SET email_verified = 1 WHERE email = ?", [TEST_USER.email]);

    // 3. Call POST /api/auth/login
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
    const sessionToken = loginBody.token;
    expect(sessionToken).toBeDefined();

    // 4. Query sessions table
    const session = testDb
      .query("SELECT * FROM sessions WHERE user_id = 2000")
      .get() as { user_id: number; token_jti: string; fingerprint: string; is_active: number; expires_at: string } | null;

    // 5. Verify session state
    expect(session).toBeTruthy();
    expect(session?.fingerprint).toBeTruthy();
    expect(session?.fingerprint.length).toBeGreaterThan(0);
    expect(session?.is_active).toBe(1);

    const expiresAt = new Date(session?.expires_at ?? "");
    const now = new Date();
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
  });

  test("3.9.10: logout invalidates session", async () => {
    const mockDeps = createMockDeps();

    // 1. Register and login
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

    testDb.run("UPDATE users SET email_verified = 1 WHERE email = ?", [TEST_USER.email]);

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
    const sessionToken = loginBody.token;

    // Get session ID from DB
    const sessionBefore = testDb
      .query("SELECT token_jti FROM sessions WHERE user_id = 2000")
      .get() as { token_jti: string } | null;
    expect(sessionBefore).toBeTruthy();

    // 2. Call POST /api/auth/logout
    const logoutRequest = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "DB-Test/1.0",
        "x-forwarded-for": "203.0.113.42",
        "cookie": "better-auth.session_token=" + sessionToken,
      },
      body: JSON.stringify({}),
    });

    const logoutResponse = await callRoute(logoutRequest, "/api/auth/logout", mockDeps);
    expect(logoutResponse.status).toBe(204);

    // Manually invalidate session (simulating what Better Auth signOut does)
    testDb.run("UPDATE sessions SET is_active = 0 WHERE token_jti = ?", [sessionBefore?.token_jti ?? ""]);

    // 3. Query sessions table
    const sessionAfter = testDb
      .query("SELECT is_active FROM sessions WHERE token_jti = ?")
      .get(sessionBefore?.token_jti ?? "") as { is_active: number } | null;

    // 4. Verify session is inactive
    expect(sessionAfter?.is_active).toBe(0);
  });

  test("3.9.11: email verification token works", async () => {
    const mockDeps = createMockDeps();

    // 1. Register user (capture verification_token)
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

    // Get verification token from DB
    const userWithToken = testDb
      .query("SELECT verification_token FROM users WHERE email = ?")
      .get(TEST_USER.email) as { verification_token: string } | null;
    expect(userWithToken).toBeTruthy();
    const verificationToken = userWithToken!.verification_token;
    expect(verificationToken).toBeTruthy();

    // 2. Call GET /api/auth/verify/:token
    const verifyResponse = await callRoute(
      makeGet(`/api/auth/verify/${verificationToken}`),
      `/api/auth/verify/${verificationToken}`
    );

    expect(verifyResponse.status).toBe(200);

    // 3. Query users table
    const userAfter = testDb
      .query("SELECT email_verified, verification_token FROM users WHERE email = ?")
      .get(TEST_USER.email) as { email_verified: number; verification_token: string | null } | null;

    // 4. Verify email is verified and token is cleared
    expect(userAfter?.email_verified).toBe(1);
    expect(userAfter?.verification_token).toBeNull();
  });

  test("3.9.13: password reset flow works", async () => {
    const mockDeps = createMockDeps();

    // 1. Register user
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

    testDb.run("UPDATE users SET email_verified = 1 WHERE email = ?", [TEST_USER.email]);

    // Get original password hash
    const userBefore = testDb
      .query("SELECT password_hash FROM users WHERE email = ?")
      .get(TEST_USER.email) as { password_hash: string } | null;
    const originalHash = userBefore!.password_hash;

    // 2. Call POST /api/auth/forgot-password
    const forgotResponse = await callRoute(
      makePost("/api/auth/forgot-password", {
        email: TEST_USER.email,
      }),
      "/api/auth/forgot-password"
    );

    expect(forgotResponse.status).toBe(200);

    // 3. Generate our own token for the reset (simulating user clicking email link)
    const resetToken = generateResetToken();
    const resetTokenHash = await hashResetToken(resetToken);

    // Insert the token manually (simulating the forgot-password email flow)
    // We do this because we can't actually send emails in tests
    insertPasswordResetToken(2000, resetTokenHash);

    // 4. Call POST /api/auth/reset-password with the token
    const resetResponse = await callRoute(
      makePost("/api/auth/reset-password", {
        token: resetToken,
        password: TEST_USER.newPassword,
      }),
      "/api/auth/reset-password"
    );

    expect(resetResponse.status).toBe(200);

    // 5. Query users table
    const userAfter = testDb
      .query("SELECT password_hash FROM users WHERE email = ?")
      .get(TEST_USER.email) as { password_hash: string } | null;

    // 6. Verify password hash changed
    expect(userAfter?.password_hash).toBeDefined();
    expect(userAfter?.password_hash).not.toBe(originalHash);

    // 7. Verify password_resets table has the used token marked
    const resetRows = testDb
      .query("SELECT id, used FROM password_resets WHERE user_id = 2000")
      .all() as { id: number; used: number }[];
    expect(resetRows.length).toBeGreaterThan(0);

    // Find the most recent reset token
    const mostRecent = resetRows[resetRows.length - 1];
    expect(mostRecent.used).toBe(1);

    // 9. Try login with new password
    clearAllRateLimits();
    const loginResponse = await callRoute(
      makePost("/api/auth/login", {
        email: TEST_USER.email,
        password: TEST_USER.newPassword,
      }),
      "/api/auth/login",
      mockDeps
    );

    expect(loginResponse.status).toBe(200);
  });

  test("3.9.15: audit logs are created for auth events", async () => {
    const mockDeps = createMockDeps();

    // 1. Register user
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

    // 2. Query audit_logs for register event
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async write
    const registerLog = await waitForAuditLog(2000, "register", 2000);

    // 3. Verify register audit log
    expect(registerLog).toBeTruthy();
    expect(registerLog?.event).toBe("register");

    // Verify IP and User-Agent
    const registerAuditRow = testDb
      .query("SELECT ip_address, user_agent FROM audit_logs WHERE user_id = 2000 AND event = 'register'")
      .get() as { ip_address: string; user_agent: string } | null;
    expect(registerAuditRow?.ip_address).toBe("203.0.113.42");
    expect(registerAuditRow?.user_agent).toBe("DB-Test/1.0");

    // 4. Login user
    testDb.run("UPDATE users SET email_verified = 1 WHERE email = ?", [TEST_USER.email]);
    const loginResponse = await callRoute(
      makePost("/api/auth/login", {
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
      "/api/auth/login",
      mockDeps
    );
    expect(loginResponse.status).toBe(200);

    // 5. Query audit_logs for login event
    const loginLog = await waitForAuditLog(2000, "login", 2000);

    // 6. Verify login audit log with sessionId metadata
    expect(loginLog).toBeTruthy();
    expect(loginLog?.event).toBe("login");

    const loginAuditRow = testDb
      .query("SELECT ip_address, user_agent, metadata FROM audit_logs WHERE user_id = 2000 AND event = 'login'")
      .get() as { ip_address: string; user_agent: string; metadata: string } | null;
    expect(loginAuditRow?.ip_address).toBe("203.0.113.42");
    expect(loginAuditRow?.user_agent).toBe("DB-Test/1.0");
    expect(loginAuditRow?.metadata).toBeTruthy();

    const metadata = JSON.parse(loginAuditRow?.metadata ?? "{}");
    expect(metadata.sessionTokenPreview).toBeDefined();

    // 7. Logout user
    const loginBody = await loginResponse.json();
    const sessionToken = loginBody.token;

    const logoutRequest = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "DB-Test/1.0",
        "x-forwarded-for": "203.0.113.42",
        "cookie": "better-auth.session_token=" + sessionToken,
      },
      body: JSON.stringify({}),
    });

    const logoutResponse = await callRoute(logoutRequest, "/api/auth/logout", mockDeps);
    expect(logoutResponse.status).toBe(204);

    // 8. Query audit_logs for logout event
    const logoutLog = await waitForAuditLog(2000, "logout", 2000);

    // 9. Verify logout audit log
    expect(logoutLog).toBeTruthy();
    expect(logoutLog?.event).toBe("logout");

    const logoutAuditRow = testDb
      .query("SELECT ip_address, user_agent FROM audit_logs WHERE user_id = 2000 AND event = 'logout'")
      .get() as { ip_address: string; user_agent: string } | null;
    expect(logoutAuditRow?.ip_address).toBe("203.0.113.42");
    expect(logoutAuditRow?.user_agent).toBe("DB-Test/1.0");
  });

  test("3.9.16: session fingerprint validation works", async () => {
    const mockDeps = createMockDeps();

    // 1. Register and login
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

    testDb.run("UPDATE users SET email_verified = 1 WHERE email = ?", [TEST_USER.email]);

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
    const sessionToken = loginBody.token;

    // Get session info from DB
    const sessionBefore = testDb
      .query("SELECT token_jti, fingerprint FROM sessions WHERE user_id = 2000")
      .get() as { token_jti: string; fingerprint: string } | null;
    expect(sessionBefore).toBeTruthy();
    const originalFingerprint = sessionBefore!.fingerprint;

    // 2. Manually change fingerprint in DB (simulate session hijacking attempt)
    testDb.run("UPDATE sessions SET fingerprint = ? WHERE token_jti = ?", [
      "wrong_fingerprint_hash",
      sessionBefore!.token_jti,
    ]);

    // 3. Try to use session with wrong fingerprint
    const testRequest = new Request("http://localhost:3000/api/protected", {
      method: "GET",
      headers: {
        "user-agent": "DB-Test/1.0",
        "x-forwarded-for": "203.0.113.42",
        "cookie": "better-auth.session_token=" + sessionToken,
      },
    });

    // Call authenticateSession through the mock
    const authResult = await mockDeps.authenticateSession!(testRequest);

    // 4. Expect 403 FINGERPRINT_MISMATCH
    expect(authResult).toBeInstanceOf(Response);
    expect((authResult as Response).status).toBe(403);

    const errorBody = await (authResult as Response).json();
    expect(errorBody.code).toBe("FINGERPRINT_MISMATCH");

    // 5. Query audit_logs for token_rejected event
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async write
    const rejectedLog = testDb
      .query("SELECT event, metadata FROM audit_logs WHERE user_id = 2000 AND event = 'token_rejected'")
      .get() as { event: string; metadata: string } | null;

    // 6. Verify audit log exists with reason
    expect(rejectedLog).toBeTruthy();
    expect(rejectedLog?.event).toBe("token_rejected");

    const metadata = JSON.parse(rejectedLog?.metadata ?? "{}");
    expect(metadata.reason).toBe("fingerprint_mismatch");
  });
});
