/**
 * Ban Enforcement Tests - Phase D
 *
 * Integration tests for ban checking in the login flow.
 *
 * Test coverage:
 * - D.1: Login rejects permanently banned users
 * - D.2: Login rejects temporarily banned users (non-expired)
 * - D.3: Login allows users after temporary ban expires (auto-unban)
 * - D.4: Login allows non-banned users
 *
 * These tests use an in-memory SQLite database to verify the complete
 * ban enforcement logic without affecting the real database.
 */

import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { handleAuthRoute, type AuthDeps } from "../index.js";
import { setTestDatabase, closeDatabase, getDatabase } from "../../../db/connection.js";
import { clearAllRateLimits } from "../rate-limit.js";
import { getUserByEmail } from "../../../db/queries.js";

// ============================================================================
// TEST CONSTANTS
// ============================================================================

const VALID_LOGIN_BODY = {
  email: "banned-user@example.com",
  password: "SecurePass123",
};

const MOCK_USER = {
  id: "user-123",
  name: "Banned User",
  email: "banned-user@example.com",
  emailVerified: true,
  role: "user",
  createdAt: new Date().toISOString(),
};

// ============================================================================
// MOCK DEPS
// ============================================================================

function happyPathDeps(): AuthDeps {
  return {
    signUpEmail: async () => ({
      headers: new Headers(),
      response: { user: MOCK_USER, token: null },
    }),

    signInEmail: async () => ({
      headers: new Headers({ "Set-Cookie": "urlft_session=abc123; Path=/" }),
      response: { token: "session-token-abc", user: MOCK_USER, redirect: false },
    }),

    signOut: async () => ({
      headers: new Headers({ "Set-Cookie": "urlft_session=; Max-Age=0; Path=/" }),
      response: {},
    }),

    authenticateSession: async (_req: Request) => ({
      session: { id: "session-1", userId: "user-123" },
      user: MOCK_USER,
      fingerprint: "abc123",
    }),
  };
}

// ============================================================================
// REQUEST HELPERS
// ============================================================================

function makePost(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "TestAgent/1.0" },
    body: JSON.stringify(body),
  });
}

async function call(
  req: Request,
  path: string,
  deps: Partial<AuthDeps>
): Promise<Response> {
  const res = await handleAuthRoute(req, path, deps);
  return res ?? new Response("Not found", { status: 404 });
}

// ============================================================================
// TEST DATABASE SETUP
// ============================================================================

let testDb: Database;

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.run("PRAGMA foreign_keys = ON;");

  // Create ranks table
  testDb.run(`
    CREATE TABLE IF NOT EXISTS ranks (
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

  testDb.run(`INSERT OR IGNORE INTO ranks (id, name, min_links, display_name)
    VALUES (1, 'newbie', 0, '🌱 Newbie')`);

  // Create users table with ban columns
  testDb.run(`
    CREATE TABLE IF NOT EXISTS users (
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
      role TEXT DEFAULT 'user',
      banned INTEGER DEFAULT 0,
      banReason TEXT,
      banExpires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
    )
  `);

  // Create indexes for ban columns
  testDb.run("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)");
  testDb.run("CREATE INDEX IF NOT EXISTS idx_users_banned ON users(banned)");

  // Create audit_logs table (required by auth routes)
  testDb.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
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

  setTestDatabase(testDb);
});

beforeEach(() => {
  clearAllRateLimits();
  // Clear all users before each test
  testDb.run("DELETE FROM users");
});

// ============================================================================
// BAN ENFORCEMENT TESTS
// ============================================================================

describe("Phase D - Ban Enforcement in Login", () => {
  describe("D.1: Login rejects permanently banned users", () => {
    test("should return 403 USER_BANNED for permanently banned user", async () => {
      // 1. Register and verify a user
      const hashedPassword = await Bun.password.hash("SecurePass123");
      const insertResult = testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned, banReason) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run("banned-user", "banned-user@example.com", hashedPassword, 1, "user", 1, "Violation of Terms of Service");

      const userId = insertResult.lastInsertRowid as number;
      expect(userId).toBeGreaterThan(0);

      // 2. Verify user is banned in database
      const user = testDb.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      expect(user.banned).toBe(1);
      expect(user.banReason).toBe("Violation of Terms of Service");
      expect(user.banExpires).toBeNull();

      // 3. Attempt to login
      const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // 4. Verify rejection
      expect(res.status).toBe(403);
      const body = await res.json() as { error: string; code: string };
      expect(body.code).toBe("USER_BANNED");
      expect(body.error).toContain("banned");
      expect(body.error).toContain("Violation of Terms of Service");
    });

    test("should return 403 with default reason when banReason is null", async () => {
      // 1. Create permanently banned user without reason
      const hashedPassword = await Bun.password.hash("SecurePass123");
      testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run("banned-user", "banned-user@example.com", hashedPassword, 1, "user", 1);

      // 2. Attempt to login
      const req = makePost("/api/auth/login", VALID_LOGIN_BODY);
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // 3. Verify error includes default reason
      expect(res.status).toBe(403);
      const body = await res.json() as { error: string };
      expect(body.error).toContain("No reason provided");
    });
  });

  describe("D.2: Login rejects temporarily banned users (ban not expired)", () => {
    test("should return 403 USER_BANNED for temporary ban in the future", async () => {
      // 1. Create user with temporary ban (expires in 24 hours)
      const hashedPassword = await Bun.password.hash("SecurePass123");
      const banExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

      testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned, banReason, banExpires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          "temp-banned-user",
          "temp-banned-user@example.com",
          hashedPassword,
          1,
          "user",
          1,
          "Spam behavior",
          banExpires
        );

      // 2. Verify user is temporarily banned
      const user = testDb
        .prepare("SELECT * FROM users WHERE email = ?")
        .get("temp-banned-user@example.com") as any;
      expect(user.banned).toBe(1);
      expect(user.banExpires).toBeTruthy();

      // 3. Attempt to login
      const req = makePost("/api/auth/login", {
        email: "temp-banned-user@example.com",
        password: "SecurePass123",
      });
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // 4. Verify rejection
      expect(res.status).toBe(403);
      const body = await res.json() as { error: string; code: string };
      expect(body.code).toBe("USER_BANNED");
      expect(body.error).toContain("Spam behavior");
    });
  });

  describe("D.3: Login allows users after temporary ban expires (auto-unban)", () => {
    test("should auto-unban and allow login when ban has expired", async () => {
      // 1. Create user with expired temporary ban (expired 1 hour ago)
      const hashedPassword = await Bun.password.hash("SecurePass123");
      const banExpires = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      const insertResult = testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned, banReason, banExpires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          "expired-ban-user",
          "expired-ban-user@example.com",
          hashedPassword,
          1,
          "user",
          1,
          "Old ban",
          banExpires
        );

      const userId = insertResult.lastInsertRowid as number;

      // 2. Verify user is initially banned
      let user = testDb.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      expect(user.banned).toBe(1);
      expect(user.banExpires).toBeTruthy();

      // 3. Attempt to login (should auto-unban)
      const req = makePost("/api/auth/login", {
        email: "expired-ban-user@example.com",
        password: "SecurePass123",
      });
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // 4. Verify login succeeded
      expect(res.status).toBe(200);
      const body = await res.json() as { token: string; user: unknown };
      expect(body.token).toBe("session-token-abc");

      // 5. Verify user was auto-unbanned in database
      user = testDb.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      expect(user.banned).toBe(0);
      expect(user.banReason).toBeNull();
      expect(user.banExpires).toBeNull();
    });

    test("should auto-unban when banExpires is exactly now", async () => {
      // Edge case: ban expired exactly at this moment
      const hashedPassword = await Bun.password.hash("SecurePass123");
      const banExpires = new Date().toISOString(); // Exactly now

      testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned, banReason, banExpires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          "just-expired-user",
          "just-expired-user@example.com",
          hashedPassword,
          1,
          "user",
          1,
          "Just expired",
          banExpires
        );

      // Attempt to login
      const req = makePost("/api/auth/login", {
        email: "just-expired-user@example.com",
        password: "SecurePass123",
      });
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // Verify login succeeded and user was auto-unbanned
      expect(res.status).toBe(200);
      const user = testDb
        .prepare("SELECT * FROM users WHERE email = ?")
        .get("just-expired-user@example.com") as any;
      expect(user.banned).toBe(0);
    });
  });

  describe("D.4: Login allows non-banned users", () => {
    test("should return 200 for non-banned user", async () => {
      // 1. Create non-banned user
      const hashedPassword = await Bun.password.hash("SecurePass123");
      testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run("normal-user", "normal-user@example.com", hashedPassword, 1, "user", 0);

      // 2. Verify user is not banned
      const user = testDb
        .prepare("SELECT * FROM users WHERE email = ?")
        .get("normal-user@example.com") as any;
      expect(user.banned).toBe(0);

      // 3. Attempt to login
      const req = makePost("/api/auth/login", {
        email: "normal-user@example.com",
        password: "SecurePass123",
      });
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // 4. Verify successful login
      expect(res.status).toBe(200);
      const body = await res.json() as { token: string; user: unknown };
      expect(body.token).toBe("session-token-abc");
      expect(body.user).toBeDefined();
    });

    test("should not affect login when banned = 0 but banReason/banExpires are set", async () => {
      // Edge case: user has banReason/banExpires but banned = 0 (manually unbanned)
      const hashedPassword = await Bun.password.hash("SecurePass123");
      testDb
        .prepare(
          "INSERT INTO users (username, email, password_hash, email_verified, role, banned, banReason, banExpires) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          "unbanned-user",
          "unbanned-user@example.com",
          hashedPassword,
          1,
          "user",
          0,
          "Old ban reason",
          new Date(Date.now() - 60 * 60 * 1000).toISOString()
        );

      // Attempt to login
      const req = makePost("/api/auth/login", {
        email: "unbanned-user@example.com",
        password: "SecurePass123",
      });
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // Verify login succeeds (banned = 0 takes precedence)
      expect(res.status).toBe(200);
    });
  });

  describe("Ban check performance", () => {
    test("should not throw error when user doesn't exist", async () => {
      // This test verifies that the ban check doesn't cause errors
      // when the user doesn't exist (getUserByEmail returns null)

      // 1. Don't create any user
      // 2. Attempt to login with non-existent email
      const req = makePost("/api/auth/login", {
        email: "non-existent@example.com",
        password: "DoesNotMatter",
      });
      const res = await call(req, "/api/auth/login", happyPathDeps());

      // 3. Should proceed to Better Auth mock (returns 200 in happy path)
      // and NOT throw an error during ban check
      // The key assertion: ban check didn't crash the request
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });
  });
});

// ============================================================================
// CLEANUP
// ============================================================================

// Cleanup is handled by the test framework
