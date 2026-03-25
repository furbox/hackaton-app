/**
 * Integration tests for the password reset endpoints.
 *
 * Covers non-enumerating forgot-password, reset success, expired/used/invalid tokens,
 * session invalidation, and Resend delivery invocation.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "bun:test";
import { Database } from "bun:sqlite";
import type { Resend } from "resend";
import {
  FORGOT_PASSWORD_RESPONSE_MESSAGE,
  RESET_PASSWORD_RESPONSE_MESSAGE,
  handleAuthRoute,
} from "../index.js";
import { clearAllRateLimits } from "../rate-limit.js";
import { setTestDatabase, closeDatabase } from "../../../db/connection.js";
import {
  consumePasswordResetToken,
  generateResetToken,
  hashResetToken,
  insertPasswordResetToken,
  _setResendClient,
  _resetResendClient,
} from "../../../auth/password-reset.ts";

let testDb: Database;

function makePost(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "TestAgent/1.0" },
    body: JSON.stringify(body),
  });
}

async function callRoute(req: Request, path: string): Promise<Response> {
  const res = await handleAuthRoute(req, path);
  return res ?? new Response("Not found", { status: 404 });
}

function formatSqlDatetime(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

function createUser(email: string): number {
  testDb.run(
    `INSERT INTO users (username, email, password_hash, rank_id) VALUES (?, ?, ?, 1)`,
    [`user-${email}`, email, "old-password"]
  );
  const row = testDb.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | null;
  if (!row) {
    throw new Error("Failed to insert user");
  }
  return row.id;
}

function createSession(userId: number, jti: string): void {
  const expiresAt = formatSqlDatetime(new Date(Date.now() + 24 * 60 * 60 * 1000));
  testDb.run(
    `
      INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, fingerprint, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [userId, jti, "127.0.0.1", "TestAgent/1.0", "fingerprint", expiresAt]
  );
}

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.run("PRAGMA foreign_keys = ON;");
  testDb.run(`
    CREATE TABLE ranks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);
  testDb.run(`INSERT INTO ranks (id, name) VALUES (1, 'newbie')`);
  testDb.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      rank_id INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rank_id) REFERENCES ranks(id)
    )
  `);
  testDb.run(`
    CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  testDb.run(`
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
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  testDb.run(`
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
  setTestDatabase(testDb);
});

afterAll(() => {
  closeDatabase();
});

beforeEach(() => {
  testDb.run("DELETE FROM password_resets");
  testDb.run("DELETE FROM sessions");
  testDb.run("DELETE FROM audit_logs");
  testDb.run("DELETE FROM users");
  clearAllRateLimits();
});

afterEach(() => {
  _resetResendClient();
  delete process.env.BASE_URL;
  delete process.env.EMAIL_FROM;
});

describe("POST /api/auth/forgot-password", () => {
  test("creates reset row and triggers Resend for known email", async () => {
    const userId = createUser("reset-1@example.com");
    const captured: Record<string, string>[] = [];
    _setResendClient({
      emails: {
        send: async (payload: Record<string, string>) => {
          captured.push(payload);
          return { id: "email" };
        },
      },
    } as unknown as Resend);
    process.env.BASE_URL = "https://test.local";
    process.env.EMAIL_FROM = "URLoft Test <test@urloft.local>";

    const req = makePost("/api/auth/forgot-password", { email: "reset-1@example.com" });
    const res = await callRoute(req, "/api/auth/forgot-password");

    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe(FORGOT_PASSWORD_RESPONSE_MESSAGE);

    // Wait for the fire-and-forget email to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(captured.length).toBe(1);

    const row = testDb.query("SELECT * FROM password_resets WHERE user_id = ?").get(userId) as { used: number } | null;
    expect(row).toBeTruthy();
    expect(row!.used).toBe(0);
  });

  test("returns generic message for unknown email without creating rows", async () => {
    const req = makePost("/api/auth/forgot-password", { email: "reset-unknown@example.com" });
    const res = await callRoute(req, "/api/auth/forgot-password");
    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe(FORGOT_PASSWORD_RESPONSE_MESSAGE);
    const count = testDb.query("SELECT COUNT(*) as count FROM password_resets").get() as { count: number };
    expect(count.count).toBe(0);
  });
});

describe("POST /api/auth/reset-password", () => {
  test("valid token updates password and invalidates sessions", async () => {
    const userId = createUser("reset-2@example.com");
    createSession(userId, "session-jti");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    insertPasswordResetToken(userId, hash);

    const req = makePost("/api/auth/reset-password", { token, newPassword: "NewPass123" });
    const res = await callRoute(req, "/api/auth/reset-password");
    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBe(RESET_PASSWORD_RESPONSE_MESSAGE);

    const userRow = testDb.query("SELECT password_hash FROM users WHERE id = ?").get(userId) as { password_hash: string } | null;
    expect(userRow!.password_hash).not.toBe("old-password");

    const resetRow = testDb.query("SELECT used FROM password_resets WHERE user_id = ?").get(userId) as { used: number } | null;
    expect(resetRow!.used).toBe(1);

    const sessionRow = testDb.query("SELECT is_active FROM sessions WHERE user_id = ?").get(userId) as { is_active: number } | null;
    expect(sessionRow!.is_active).toBe(0);
  });

  test("invalid token returns RESET_TOKEN_INVALID", async () => {
    const req = makePost("/api/auth/reset-password", { token: "nope", newPassword: "NewPass123" });
    const res = await callRoute(req, "/api/auth/reset-password");
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("RESET_TOKEN_INVALID");
  });

  test("expired token returns RESET_TOKEN_EXPIRED", async () => {
    const userId = createUser("reset-3@example.com");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    const insertedId = insertPasswordResetToken(userId, hash);
    const past = formatSqlDatetime(new Date(Date.now() - 2 * 60 * 60 * 1000));
    testDb.run("UPDATE password_resets SET expires_at = ? WHERE id = ?", [past, insertedId]);

    const req = makePost("/api/auth/reset-password", { token, newPassword: "NewPass123" });
    const res = await callRoute(req, "/api/auth/reset-password");
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("RESET_TOKEN_EXPIRED");
  });

  test("used token returns RESET_TOKEN_USED", async () => {
    const userId = createUser("reset-4@example.com");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    insertPasswordResetToken(userId, hash);
    await consumePasswordResetToken(hash);

    const req = makePost("/api/auth/reset-password", { token, newPassword: "NewPass123" });
    const res = await callRoute(req, "/api/auth/reset-password");
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe("RESET_TOKEN_USED");
  });
});
