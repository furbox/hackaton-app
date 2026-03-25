import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { setTestDatabase, closeDatabase } from "../../../db/connection.js";
import { clearAllRateLimits } from "../rate-limit.js";
import { handleAuthRoute, type AuthDeps } from "../index.js";
import { generateResetToken, hashResetToken, insertPasswordResetToken } from "../../../auth/password-reset.js";
import { parseMetadata } from "../../../services/audit-log.service.js";

let testDb: Database;

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
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

function seedUser(id: number, email: string, emailVerified = true): void {
  testDb.run(
    `INSERT INTO users (id, username, email, password_hash, email_verified, rank_id) VALUES (?, ?, ?, ?, ?, 1)`,
    [id, `user-${id}`, email, "hash", emailVerified ? 1 : 0]
  );
}

function makePost(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "AuditIntegration/1.0",
      "x-forwarded-for": "203.0.113.40",
    },
    body: JSON.stringify(body),
  });
}

function makeGet(path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: "GET",
    headers: {
      "user-agent": "AuditIntegration/1.0",
      "x-forwarded-for": "203.0.113.40",
    },
  });
}

async function callRoute(req: Request, path: string, deps?: Partial<AuthDeps>): Promise<Response> {
  const response = await handleAuthRoute(req, path, deps);
  return response ?? new Response("Not found", { status: 404 });
}

function defaultDeps(userId = 101, email = "audit@example.com"): AuthDeps {
  return {
    signUpEmail: async () => ({
      headers: new Headers(),
      response: {
        user: { id: String(userId), email, name: "Audit User" },
        token: null,
      },
    }),
    signInEmail: async () => ({
      headers: new Headers(),
      response: {
        token: "session-token-abcdef123456",
        user: { id: String(userId), email },
        redirect: false,
      },
    }),
    signOut: async () => ({
      headers: new Headers(),
      response: {},
    }),
    authenticateSession: async () => ({ user: { id: String(userId), email } }),
  };
}

function latestAudit(event: string): { user_id: number | null; metadata: string | null } | null {
  return testDb.query(
    `SELECT user_id, metadata FROM audit_logs WHERE event = ? ORDER BY id DESC LIMIT 1`
  ).get(event) as { user_id: number | null; metadata: string | null } | null;
}

beforeAll(() => {
  testDb = new Database(":memory:");
  createSchema(testDb);
  setTestDatabase(testDb);
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
  process.env.TRUST_PROXY = "true";
});

describe("auth endpoint audit integration", () => {
  test("register logs register event", async () => {
    seedUser(101, "audit-register@example.com", false);
    const response = await callRoute(
      makePost("/api/auth/register", {
        name: "Audit Register",
        email: "audit-register@example.com",
        password: "Secret123",
      }),
      "/api/auth/register",
      defaultDeps(101, "audit-register@example.com")
    );

    expect(response.status).toBe(201);
    const row = latestAudit("register");
    expect(row?.user_id).toBe(101);
  });

  test("login logs login event without full token", async () => {
    seedUser(101, "audit-login@example.com", true);
    const response = await callRoute(
      makePost("/api/auth/login", {
        email: "audit-login@example.com",
        password: "Secret123",
      }),
      "/api/auth/login",
      defaultDeps(101, "audit-login@example.com")
    );

    expect(response.status).toBe(200);
    const row = latestAudit("login");
    const metadata = parseMetadata(row?.metadata ?? null);
    expect(row?.user_id).toBe(101);
    expect(typeof metadata?.sessionTokenPreview).toBe("string");
  });

  test("logout logs logout event", async () => {
    seedUser(101, "audit-logout@example.com", true);
    const response = await callRoute(
      makePost("/api/auth/logout", {}),
      "/api/auth/logout",
      defaultDeps(101, "audit-logout@example.com")
    );

    expect(response.status).toBe(204);
    const row = latestAudit("logout");
    expect(row?.user_id).toBe(101);
  });

  test("verify endpoint logs email_verified event", async () => {
    seedUser(201, "audit-verify@example.com", false);
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
    testDb.run(
      `UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?`,
      ["verify-token-1", expires, 201]
    );

    const response = await callRoute(makeGet("/api/auth/verify/verify-token-1"), "/api/auth/verify/verify-token-1");
    expect(response.status).toBe(200);
    const row = latestAudit("email_verified");
    expect(row?.user_id).toBe(201);
  });

  test("forgot-password logs password_reset_requested", async () => {
    seedUser(301, "audit-forgot@example.com", true);
    const response = await callRoute(
      makePost("/api/auth/forgot-password", { email: "audit-forgot@example.com" }),
      "/api/auth/forgot-password"
    );

    expect(response.status).toBe(200);
    const row = latestAudit("password_reset_requested");
    expect(row?.user_id).toBe(301);
  });

  test("reset-password logs completion and session revocation", async () => {
    seedUser(401, "audit-reset@example.com", true);
    testDb.run(
      `INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, fingerprint, is_active, expires_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now', '+1 day'))`,
      [401, "session-jti-1234", "203.0.113.40", "AuditIntegration/1.0", "fp"]
    );

    const token = generateResetToken();
    const hash = await hashResetToken(token);
    insertPasswordResetToken(401, hash);

    const response = await callRoute(
      makePost("/api/auth/reset-password", { token, newPassword: "NewSecret123" }),
      "/api/auth/reset-password"
    );

    expect(response.status).toBe(200);
    expect(latestAudit("password_reset_completed")?.user_id).toBe(401);
    expect(latestAudit("session_revoked")?.user_id).toBe(401);
  });
});
