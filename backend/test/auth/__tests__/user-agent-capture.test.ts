/**
 * Real Browser User-Agent Capture Tests
 *
 * This test verifies that audit_logs and sessions tables properly capture
 * real browser user-agent strings (Firefox, Chrome, curl) along with IP addresses.
 *
 * @module backend/auth/__tests__/user-agent-capture.test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../../db/connection.js";
import { createAuditLog, extractRequestInfo } from "../../../services/audit-log.service.js";

let testDb: Database;

// ============================================================================
// REAL USER-AGENT STRINGS
// ============================================================================

const REAL_USER_AGENTS = {
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  curl: "curl/8.18.0",
  safari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
};

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

/**
 * Create a test user in the database
 */
function seedUser(id: number, email: string, emailVerified = true): void {
  const passwordHash = Bun.password.hashSync("TestPassword123!", {
    algorithm: "argon2id",
  });
  testDb.run(
    `INSERT INTO users (id, username, email, password_hash, email_verified, rank_id) VALUES (?, ?, ?, ?, ?, 1)`,
    [id, `user-${id}`, email, passwordHash, emailVerified ? 1 : 0]
  );
}

/**
 * Create a session in the database
 */
async function createSession(
  userId: number,
  tokenJti: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const fingerprint = await Bun.password.hash(`${ipAddress}|${userAgent}`, {
    algorithm: "argon2id",
  });

  testDb.run(
    `INSERT INTO sessions (user_id, token_jti, ip_address, user_agent, fingerprint, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now', '+1 day'))`,
    [userId, tokenJti, ipAddress, userAgent, fingerprint]
  );
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
  testDb.run("DELETE FROM sessions");
  testDb.run("DELETE FROM users");
});

// ============================================================================
// TESTS: AUDIT LOGS USER-AGENT CAPTURE
// ============================================================================

describe("Audit logs: real browser user-agent capture", () => {
  test("captures Firefox user-agent in audit_logs", async () => {
    const userId = 5101;
    seedUser(userId, "firefox@example.com");

    await createAuditLog({
      userId,
      event: "login",
      ipAddress: "192.168.1.100",
      userAgent: REAL_USER_AGENTS.firefox,
      metadata: { method: "test" },
    });

    // Wait for async write
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify user-agent and IP in audit_logs table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'login'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("192.168.1.100");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.firefox);
  });

  test("captures Chrome user-agent in audit_logs", async () => {
    const userId = 5102;
    seedUser(userId, "chrome@example.com");

    await createAuditLog({
      userId,
      event: "login",
      ipAddress: "10.0.0.50",
      userAgent: REAL_USER_AGENTS.chrome,
      metadata: { method: "test" },
    });

    // Wait for async write
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify user-agent and IP in audit_logs table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'login'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("10.0.0.50");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.chrome);
  });

  test("captures curl user-agent in audit_logs", async () => {
    const userId = 5103;
    seedUser(userId, "curl@example.com");

    await createAuditLog({
      userId,
      event: "logout",
      ipAddress: "172.16.0.10",
      userAgent: REAL_USER_AGENTS.curl,
      metadata: { method: "test" },
    });

    // Wait for async write
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify user-agent and IP in audit_logs table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'logout'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("172.16.0.10");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.curl);
  });

  test("captures Safari user-agent in audit_logs", async () => {
    const userId = 5104;
    seedUser(userId, "safari@example.com");

    await createAuditLog({
      userId,
      event: "login",
      ipAddress: "203.0.113.50",
      userAgent: REAL_USER_AGENTS.safari,
      metadata: { method: "test" },
    });

    // Wait for async write
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify user-agent and IP in audit_logs table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'login'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("203.0.113.50");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.safari);
  });

  test("captures Edge user-agent in audit_logs", async () => {
    const userId = 5105;
    seedUser(userId, "edge@example.com");

    await createAuditLog({
      userId,
      event: "register",
      ipAddress: "198.51.100.75",
      userAgent: REAL_USER_AGENTS.edge,
      metadata: { method: "test" },
    });

    // Wait for async write
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify user-agent and IP in audit_logs table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'register'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("198.51.100.75");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.edge);
  });
});

// ============================================================================
// TESTS: SESSIONS USER-AGENT CAPTURE
// ============================================================================

describe("Sessions: real browser user-agent capture", () => {
  test("captures Firefox user-agent in sessions table", async () => {
    const userId = 5201;
    seedUser(userId, "firefox-session@example.com");

    const tokenJti = `session-firefox-${Date.now()}`;
    await createSession(userId, tokenJti, "127.0.0.1", REAL_USER_AGENTS.firefox);

    // Verify user-agent and IP in sessions table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("127.0.0.1");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.firefox);
  });

  test("captures Chrome user-agent in sessions table", async () => {
    const userId = 5202;
    seedUser(userId, "chrome-session@example.com");

    const tokenJti = `session-chrome-${Date.now()}`;
    await createSession(userId, tokenJti, "192.168.1.200", REAL_USER_AGENTS.chrome);

    // Verify user-agent and IP in sessions table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("192.168.1.200");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.chrome);
  });

  test("captures curl user-agent in sessions table", async () => {
    const userId = 5203;
    seedUser(userId, "curl-session@example.com");

    const tokenJti = `session-curl-${Date.now()}`;
    await createSession(userId, tokenJti, "10.20.30.40", REAL_USER_AGENTS.curl);

    // Verify user-agent and IP in sessions table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("10.20.30.40");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.curl);
  });

  test("captures Safari user-agent in sessions table", async () => {
    const userId = 5204;
    seedUser(userId, "safari-session@example.com");

    const tokenJti = `session-safari-${Date.now()}`;
    await createSession(userId, tokenJti, "203.0.113.60", REAL_USER_AGENTS.safari);

    // Verify user-agent and IP in sessions table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("203.0.113.60");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.safari);
  });

  test("captures Edge user-agent in sessions table", async () => {
    const userId = 5205;
    seedUser(userId, "edge-session@example.com");

    const tokenJti = `session-edge-${Date.now()}`;
    await createSession(userId, tokenJti, "198.51.100.90", REAL_USER_AGENTS.edge);

    // Verify user-agent and IP in sessions table
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("198.51.100.90");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.edge);
  });
});

// ============================================================================
// TESTS: LOCALHOST IP CAPTURE
// ============================================================================

describe("IP address capture: localhost (127.0.0.1)", () => {
  test("captures 127.0.0.1 in audit_logs for localhost requests", async () => {
    const userId = 5301;
    seedUser(userId, "localhost@example.com");

    await createAuditLog({
      userId,
      event: "register",
      ipAddress: "127.0.0.1",
      userAgent: REAL_USER_AGENTS.firefox,
      metadata: { method: "test" },
    });

    // Wait for async write
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify IP is 127.0.0.1
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'register'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("127.0.0.1");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.firefox);
  });

  test("captures 127.0.0.1 in sessions table for localhost requests", async () => {
    const userId = 5302;
    seedUser(userId, "localhost-session@example.com");

    const tokenJti = `session-localhost-${Date.now()}`;
    await createSession(userId, tokenJti, "127.0.0.1", REAL_USER_AGENTS.chrome);

    // Verify IP is 127.0.0.1
    const row = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(row).toBeTruthy();
    expect(row?.ip_address).toBe("127.0.0.1");
    expect(row?.user_agent).toBe(REAL_USER_AGENTS.chrome);
  });
});

// ============================================================================
// TESTS: extractRequestInfo HELPER
// ============================================================================

describe("extractRequestInfo: user-agent extraction", () => {
  test("extracts Firefox user-agent from request headers", () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("http://localhost/test", {
      headers: {
        "user-agent": REAL_USER_AGENTS.firefox,
        "x-forwarded-for": "192.168.1.100",
      },
    });

    const info = extractRequestInfo(request);
    expect(info.userAgent).toBe(REAL_USER_AGENTS.firefox);
    expect(info.ipAddress).toBe("192.168.1.100");
  });

  test("extracts Chrome user-agent from request headers", () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("http://localhost/test", {
      headers: {
        "user-agent": REAL_USER_AGENTS.chrome,
        "x-forwarded-for": "10.0.0.50",
      },
    });

    const info = extractRequestInfo(request);
    expect(info.userAgent).toBe(REAL_USER_AGENTS.chrome);
    expect(info.ipAddress).toBe("10.0.0.50");
  });

  test("extracts curl user-agent from request headers", () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("http://localhost/test", {
      headers: {
        "user-agent": REAL_USER_AGENTS.curl,
        "x-forwarded-for": "172.16.0.10",
      },
    });

    const info = extractRequestInfo(request);
    expect(info.userAgent).toBe(REAL_USER_AGENTS.curl);
    expect(info.ipAddress).toBe("172.16.0.10");
  });

  test("returns 'unknown' for IP but extracts user-agent when TRUST_PROXY is false", () => {
    delete process.env.TRUST_PROXY;
    const request = new Request("http://localhost/test", {
      headers: {
        "user-agent": REAL_USER_AGENTS.firefox,
      },
    });

    const info = extractRequestInfo(request);
    // User-agent is ALWAYS extracted, regardless of TRUST_PROXY
    expect(info.userAgent).toBe(REAL_USER_AGENTS.firefox);
    // IP is only trusted when TRUST_PROXY is true
    expect(info.ipAddress).toBe("unknown");
  });
});

// ============================================================================
// TESTS: COMPREHENSIVE INTEGRATION
// ============================================================================

describe("Integration: multiple user-agents across audit and session tables", () => {
  test("stores different user-agents for multiple events", async () => {
    const userId = 5401;
    seedUser(userId, "multi-ua@example.com");

    // Create audit log with Firefox
    await createAuditLog({
      userId,
      event: "login",
      ipAddress: "192.168.1.100",
      userAgent: REAL_USER_AGENTS.firefox,
      metadata: { method: "test" },
    });

    // Create session with Chrome
    const tokenJti = `session-multi-${Date.now()}`;
    await createSession(userId, tokenJti, "192.168.1.101", REAL_USER_AGENTS.chrome);

    // Wait for async writes
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify audit log has Firefox UA
    const auditRow = testDb
      .query(`SELECT ip_address, user_agent FROM audit_logs WHERE user_id = ? AND event = 'login'`)
      .get(userId) as { ip_address: string; user_agent: string } | null;

    expect(auditRow?.user_agent).toBe(REAL_USER_AGENTS.firefox);
    expect(auditRow?.ip_address).toBe("192.168.1.100");

    // Verify session has Chrome UA
    const sessionRow = testDb
      .query(`SELECT ip_address, user_agent FROM sessions WHERE user_id = ? AND token_jti = ?`)
      .get(userId, tokenJti) as { ip_address: string; user_agent: string } | null;

    expect(sessionRow?.user_agent).toBe(REAL_USER_AGENTS.chrome);
    expect(sessionRow?.ip_address).toBe("192.168.1.101");

    // Verify we have distinct entries
    const allAuditLogs = testDb
      .query(`SELECT event, user_agent, ip_address FROM audit_logs WHERE user_id = ?`)
      .all(userId) as { event: string; user_agent: string; ip_address: string }[];

    const allSessions = testDb
      .query(`SELECT user_agent, ip_address FROM sessions WHERE user_id = ?`)
      .all(userId) as { user_agent: string; ip_address: string }[];

    expect(allAuditLogs.length).toBe(1);
    expect(allSessions.length).toBe(1);
    expect(allAuditLogs[0]?.user_agent).toBe(REAL_USER_AGENTS.firefox);
    expect(allSessions[0]?.user_agent).toBe(REAL_USER_AGENTS.chrome);
  });

  test("handles all major browser user-agents correctly", async () => {
    const browsers = [
      { name: "Firefox", ua: REAL_USER_AGENTS.firefox },
      { name: "Chrome", ua: REAL_USER_AGENTS.chrome },
      { name: "Safari", ua: REAL_USER_AGENTS.safari },
      { name: "Edge", ua: REAL_USER_AGENTS.edge },
      { name: "curl", ua: REAL_USER_AGENTS.curl },
    ];

    for (let i = 0; i < browsers.length; i++) {
      const browser = browsers[i];
      const userId = 5500 + i;

      seedUser(userId, `${browser.name}@example.com`);

      // Create audit log
      await createAuditLog({
        userId,
        event: "test",
        ipAddress: `203.0.113.${100 + i}`,
        userAgent: browser.ua,
        metadata: { browser: browser.name },
      });

      // Create session
      const tokenJti = `session-${browser.name}-${Date.now()}`;
      await createSession(userId, tokenJti, `198.51.100.${200 + i}`, browser.ua);
    }

    // Wait for async writes
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify all browsers were stored correctly in audit_logs
    for (let i = 0; i < browsers.length; i++) {
      const browser = browsers[i];
      const userId = 5500 + i;

      const auditRow = testDb
        .query(`SELECT user_agent, ip_address FROM audit_logs WHERE user_id = ?`)
        .get(userId) as { user_agent: string; ip_address: string } | null;

      expect(auditRow?.user_agent).toBe(browser.ua);
      expect(auditRow?.ip_address).toBe(`203.0.113.${100 + i}`);
    }

    // Verify all browsers were stored correctly in sessions
    for (let i = 0; i < browsers.length; i++) {
      const browser = browsers[i];
      const userId = 5500 + i;

      const sessionRow = testDb
        .query(`SELECT user_agent, ip_address FROM sessions WHERE user_id = ?`)
        .get(userId) as { user_agent: string; ip_address: string } | null;

      expect(sessionRow?.user_agent).toBe(browser.ua);
      expect(sessionRow?.ip_address).toBe(`198.51.100.${200 + i}`);
    }
  });
});
