import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import { authConfig } from "../config.js";
import { generateFingerprint, getSession, validateFingerprint } from "../middleware.js";
import { parseMetadata } from "../../services/audit-log.service.js";

let testDb: Database;

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
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

function seedUser(id: number): void {
  testDb.run(
    `INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)`,
    [id, `user-${id}`, `user-${id}@example.com`, "hash"]
  );
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
  testDb.run("DELETE FROM users");
  delete process.env.TRUST_PROXY;
});

describe("audit logging in middleware security paths", () => {
  test("logs token_rejected on fingerprint mismatch", async () => {
    seedUser(1);
    process.env.TRUST_PROXY = "true";

    const storedFingerprint = await generateFingerprint("203.0.113.10", "Agent/1.0");
    const session = {
      user: { id: "1" },
      token: "session-token-123456",
      fingerprint: storedFingerprint,
    } as any;

    const request = new Request("http://localhost/protected", {
      headers: {
        "x-forwarded-for": "198.51.100.40",
        "user-agent": "Agent/1.0",
      },
    });

    const valid = await validateFingerprint(session, request);
    expect(valid).toBe(false);

    const row = testDb.query(
      `SELECT event, metadata FROM audit_logs WHERE event = 'token_rejected' ORDER BY id DESC LIMIT 1`
    ).get() as { event: string; metadata: string | null } | null;

    expect(row).toBeTruthy();
    const metadata = parseMetadata(row?.metadata ?? null);
    expect(metadata?.reason).toBe("fingerprint_mismatch");
  });

  test("logs token_rejected on invalid/expired token", async () => {
    const originalGetSession = authConfig.api.getSession;
    try {
      authConfig.api.getSession = (async () => null) as typeof authConfig.api.getSession;

      const request = new Request("http://localhost/protected", {
        headers: {
          Authorization: "Bearer deadbeefcafebabe",
          "user-agent": "Agent/1.0",
        },
      });

      const result = await getSession(request);
      expect(result).toBeNull();

      const row = testDb.query(
        `SELECT event, metadata FROM audit_logs WHERE event = 'token_rejected' ORDER BY id DESC LIMIT 1`
      ).get() as { event: string; metadata: string | null } | null;

      expect(row).toBeTruthy();
      const metadata = parseMetadata(row?.metadata ?? null);
      expect(metadata?.reason).toBe("invalid_or_expired_token");
      expect(typeof metadata?.tokenPreview).toBe("string");
    } finally {
      authConfig.api.getSession = originalGetSession;
    }
  });
});
