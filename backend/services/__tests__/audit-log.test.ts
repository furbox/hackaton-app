import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import {
  createAuditLog,
  extractRequestInfo,
  getAllAuditLogs,
  getUserAuditLogs,
  parseMetadata,
  type AuditEvent,
} from "../audit-log.service.js";

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

describe("extractRequestInfo", () => {
  test("uses proxy headers when TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";
    const request = new Request("http://localhost/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.20",
        "user-agent": "TestAgent/1.0",
      },
    });

    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("203.0.113.10");
    expect(info.userAgent).toBe("TestAgent/1.0");
  });

  test("ignores proxy headers when TRUST_PROXY is disabled", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
      },
    });

    const info = extractRequestInfo(request);
    expect(info.ipAddress).toBe("unknown");
    expect(info.userAgent).toBe("unknown");
  });

  test("truncates User-Agent to 512 chars", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "user-agent": "x".repeat(900),
      },
    });
    const info = extractRequestInfo(request);
    expect(info.userAgent.length).toBe(512);
  });
});

describe("createAuditLog", () => {
  test("inserts persisted audit row", async () => {
    seedUser(1);

    await createAuditLog({
      userId: 1,
      event: "login",
      ipAddress: "203.0.113.10",
      userAgent: "Browser/1.0",
      metadata: { method: "password" },
    });

    const row = testDb.query(
      "SELECT user_id, event, ip_address, user_agent, metadata FROM audit_logs LIMIT 1"
    ).get() as {
      user_id: number;
      event: AuditEvent;
      ip_address: string;
      user_agent: string;
      metadata: string;
    } | null;

    expect(row).toBeTruthy();
    expect(row?.user_id).toBe(1);
    expect(row?.event).toBe("login");
    expect(row?.ip_address).toBe("203.0.113.10");
    expect(row?.user_agent).toBe("Browser/1.0");
    expect(row?.metadata).toContain("password");
  });

  test("supports anonymous events with null user_id", async () => {
    await createAuditLog({
      event: "token_rejected",
      ipAddress: "unknown",
      userAgent: "unknown",
    });

    const row = testDb.query("SELECT user_id FROM audit_logs LIMIT 1").get() as { user_id: number | null } | null;
    expect(row?.user_id).toBeNull();
  });
});

describe("query functions", () => {
  test("getUserAuditLogs returns newest first and respects limit", async () => {
    seedUser(1);
    await createAuditLog({ userId: 1, event: "register", ipAddress: "ip1", userAgent: "ua1" });
    await createAuditLog({ userId: 1, event: "login", ipAddress: "ip2", userAgent: "ua2" });

    const logs = getUserAuditLogs(1, 1);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.event).toBe("login");
  });

  test("getAllAuditLogs applies filters and pagination", async () => {
    seedUser(1);
    seedUser(2);
    await createAuditLog({ userId: 1, event: "login", ipAddress: "ip1", userAgent: "ua1" });
    await createAuditLog({ userId: 2, event: "logout", ipAddress: "ip2", userAgent: "ua2" });

    const all = getAllAuditLogs({ limit: 10 });
    expect(all.length).toBe(2);

    const onlyLogins = getAllAuditLogs({ event: "login" });
    expect(onlyLogins).toHaveLength(1);
    expect(onlyLogins[0]?.event).toBe("login");

    const secondPage = getAllAuditLogs({ limit: 1, offset: 1 });
    expect(secondPage).toHaveLength(1);
  });
});

describe("parseMetadata", () => {
  test("parses valid JSON objects", () => {
    expect(parseMetadata('{"foo":"bar"}')).toEqual({ foo: "bar" });
  });

  test("returns null for invalid JSON", () => {
    expect(parseMetadata("not-json")).toBeNull();
    expect(parseMetadata(null)).toBeNull();
  });
});
