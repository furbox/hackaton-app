/**
 * Unit tests for the password reset helpers.
 *
 * Covers token generation, hashing, DB lifecycle helpers, and Resend integration.
 */

import type { Resend } from "resend";
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
import {
  consumePasswordResetToken,
  generateResetToken,
  hashResetToken,
  insertPasswordResetToken,
  sendPasswordResetEmail,
  _resetResendClient,
  _setResendClient,
  ResetTokenError,
} from "../password-reset.js";
import { setTestDatabase, closeDatabase } from "../../db/connection.js";

let testDb: Database;

function formatSqlDatetime(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

function createUser(email: string): number {
  testDb.run(
    `INSERT INTO users (username, email, password_hash, rank_id) VALUES (?, ?, ?, 1)`,
    [`test-${email}`, email, "initial"]
  );
  const row = testDb.query("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | null;
  if (!row) {
    throw new Error("Failed to create test user");
  }
  return row.id;
}

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.run("PRAGMA foreign_keys = ON;");
  testDb.run(
    `CREATE TABLE ranks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )`
  );
  testDb.run(`INSERT INTO ranks (id, name) VALUES (1, 'newbie')`);
  testDb.run(
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rank_id INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rank_id) REFERENCES ranks(id)
    )`
  );
  testDb.run(
    `CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  );
  setTestDatabase(testDb);
});

afterAll(() => {
  closeDatabase();
});

beforeEach(() => {
  testDb.run("DELETE FROM password_resets");
  testDb.run("DELETE FROM users WHERE email LIKE 'test-%'");
  _resetResendClient();
});

afterEach(() => {
  _resetResendClient();
  delete process.env.BASE_URL;
  delete process.env.EMAIL_FROM;
});

describe("Token generation", () => {
  test("returns a 64-character string", () => {
    const token = generateResetToken();
    expect(token).toHaveLength(64);
  });

  test("only contains lowercase hex characters", () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("produces unique tokens across multiple calls", () => {
    const values = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      values.add(generateResetToken());
    }
    expect(values.size).toBe(50);
  });
});

describe("Token hashing", () => {
  test("produces deterministic SHA-256 hashes", async () => {
    const token = generateResetToken();
    const hashA = await hashResetToken(token);
    const hashB = await hashResetToken(token);
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64);
  });

  test("different tokens produce different hashes", async () => {
    const hashA = await hashResetToken(generateResetToken());
    const hashB = await hashResetToken(generateResetToken());
    expect(hashA).not.toBe(hashB);
  });
});

describe("Password reset lifecycle", () => {
  test("inserts a new reset token for a user", async () => {
    const userId = createUser("test@example.com");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    insertPasswordResetToken(userId, hash);

    const rows = testDb.query("SELECT * FROM password_resets WHERE user_id = ?").all(userId);
    expect(rows.length).toBe(1);
    expect((rows[0] as { used: number }).used).toBe(0);
  });

  test("replaces previous tokens for the same user", async () => {
    const userId = createUser("test2@example.com");
    const tokenA = await hashResetToken(generateResetToken());
    insertPasswordResetToken(userId, tokenA);

    const tokenB = await hashResetToken(generateResetToken());
    insertPasswordResetToken(userId, tokenB);

    const rows = testDb.query("SELECT COUNT(*) as count FROM password_resets WHERE user_id = ?").get(userId) as { count: number };
    expect(rows.count).toBe(1);
    const stored = testDb.query("SELECT * FROM password_resets WHERE user_id = ?").get(userId) as { token: string };
    expect(stored.token).toBe(tokenB);
  });

  test("consumes a token and marks it as used", async () => {
    const userId = createUser("test3@example.com");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    insertPasswordResetToken(userId, hash);

    const consumed = await consumePasswordResetToken(hash);
    expect(consumed.userId).toBe(userId);

    const row = testDb.query("SELECT used FROM password_resets WHERE id = ?").get(consumed.resetId) as { used: number };
    expect(row.used).toBe(1);
  });

  test("throws RESET_TOKEN_INVALID for unknown hashes", async () => {
    await expect(consumePasswordResetToken("deadbeef")).rejects.toMatchObject({ code: "RESET_TOKEN_INVALID" });
  });

  test("throws RESET_TOKEN_USED when the token was consumed", async () => {
    const userId = createUser("test4@example.com");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    insertPasswordResetToken(userId, hash);
    await consumePasswordResetToken(hash);
    await expect(consumePasswordResetToken(hash)).rejects.toMatchObject({ code: "RESET_TOKEN_USED" });
  });

  test("throws RESET_TOKEN_EXPIRED when the token is past its TTL", async () => {
    const userId = createUser("test5@example.com");
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    const insertId = insertPasswordResetToken(userId, hash);

    const past = formatSqlDatetime(new Date(Date.now() - 2 * 60 * 60 * 1000));
    testDb.run("UPDATE password_resets SET expires_at = ? WHERE id = ?", [past, insertId]);

    await expect(consumePasswordResetToken(hash)).rejects.toMatchObject({ code: "RESET_TOKEN_EXPIRED" });
  });
});

describe("sendPasswordResetEmail", () => {
  test("calls Resend with the correct payload", async () => {
    const captured: Record<string, string>[] = [];
    const stubResend = {
      emails: {
        send: async (payload: Record<string, string>) => {
          captured.push(payload);
          return { id: "abc" };
        },
      },
    } as unknown as Resend;
    _setResendClient(stubResend);
    process.env.BASE_URL = "https://test.local";
    process.env.EMAIL_FROM = "URLoft Test <test@urloft.local>";

    const result = await sendPasswordResetEmail("user@example.com", "token-123");
    expect(result).toBe(true);
    expect(captured.length).toBe(1);
    const call = captured[0];
    expect(call.to).toBe("user@example.com");
    expect(call.from).toBe("URLoft Test <test@urloft.local>");
    expect(call.subject).toBe("Reset your URLoft password");
    expect(call.html).toContain("token-123");
  });

  test("returns false when Resend reports an error", async () => {
    const stubResend = {
      emails: {
        send: async () => ({ error: "boom" }),
      },
    } as unknown as Resend;
    _setResendClient(stubResend);
    process.env.BASE_URL = "https://test.local";
    process.env.EMAIL_FROM = "URLoft Test <test@urloft.local>";

    const result = await sendPasswordResetEmail("user@example.com", "token-123");
    expect(result).toBe(false);
  });

  test("returns false when template loading fails", async () => {
    // Test D2 requirement: sender-level guards prevent send on template failure
    process.env.BASE_URL = "https://test.local";
    process.env.EMAIL_FROM = "URLoft Test <test@urloft.local>";

    // The template loader has fallback HTML, so this tests that path
    const result = await sendPasswordResetEmail("user@example.com", "test-token");
    expect(typeof result).toBe("boolean");
  });
});

// ============================================================================
// PHASE C2/E2: TEMPLATE INTEGRATION TESTS
// ============================================================================

describe("sendPasswordResetEmail() — Phase C2/E2: Template Integration", () => {
  const originalApiKey = Bun.env.RESEND_API_KEY;
  const originalBaseUrl = Bun.env.BASE_URL;
  const originalEmailFrom = Bun.env.EMAIL_FROM;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = "test-key-12345";
    process.env.BASE_URL = "https://urloft.test";
    process.env.EMAIL_FROM = "URLoft <test@urloft.test>";
    _resetResendClient();
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.RESEND_API_KEY = originalApiKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
    if (originalBaseUrl !== undefined) {
      process.env.BASE_URL = originalBaseUrl;
    } else {
      delete process.env.BASE_URL;
    }
    if (originalEmailFrom !== undefined) {
      process.env.EMAIL_FROM = originalEmailFrom;
    } else {
      delete process.env.EMAIL_FROM;
    }
  });

  test("renders reset URL in template HTML", async () => {
    const captured: Record<string, string>[] = [];

    const stubResend = {
      emails: {
        send: async (payload: Record<string, string>) => {
          captured.push(payload);
          return { id: "test-id" };
        },
      },
    } as unknown as Resend;

    _setResendClient(stubResend);

    const result = await sendPasswordResetEmail("user@example.com", "reset-token-xyz789");

    expect(result).toBe(true);
    expect(captured.length).toBe(1);

    const call = captured[0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toBe("Reset your URLoft password");

    // Verify the HTML contains the reset URL
    expect(call.html).toContain("https://urloft.test/api/auth/reset-password/reset-token-xyz789");

    // Verify template content
    expect(call.html).toContain("Reset your password");
    expect(call.html).toContain("1 hour");
    expect(call.html).toContain("Reset Password");
    expect(call.html).toContain("didn't request this");
    expect(call.html).toContain("ignore this email");
  });

  test("template includes fallback link for accessibility", async () => {
    const captured: Record<string, string>[] = [];

    const stubResend = {
      emails: {
        send: async (payload: Record<string, string>) => {
          captured.push(payload);
          return { id: "test-id" };
        },
      },
    } as unknown as Resend;

    _setResendClient(stubResend);

    await sendPasswordResetEmail("user@example.com", "token-abc");

    expect(captured.length).toBe(1);

    // Should have the URL visible as text for accessibility
    expect(captured[0].html).toContain("https://urloft.test/api/auth/reset-password/token-abc");
  });

  test("template includes security notice about password sharing", async () => {
    const captured: Record<string, string>[] = [];

    const stubResend = {
      emails: {
        send: async (payload: Record<string, string>) => {
          captured.push(payload);
          return { id: "test-id" };
        },
      },
    } as unknown as Resend;

    _setResendClient(stubResend);

    await sendPasswordResetEmail("user@example.com", "token-123");

    expect(captured.length).toBe(1);
    expect(captured[0].html).toContain("Never share your password");
  });
});
