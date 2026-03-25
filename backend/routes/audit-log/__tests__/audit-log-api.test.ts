import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../../db/connection.js";
import { createAuditLog } from "../../../services/audit-log.service.js";
import { handleAuditLogRoute } from "../index.js";
import { handleAdminAuditLogRoute } from "../../admin/audit-log.js";

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

function makeGet(path: string): Request {
  return new Request(`http://localhost:3000${path}`, { method: "GET" });
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
});

describe("GET /api/audit-log", () => {
  test("returns only current user logs", async () => {
    seedUser(1);
    seedUser(2);
    await createAuditLog({ userId: 1, event: "login", ipAddress: "ip1", userAgent: "ua1" });
    await createAuditLog({ userId: 2, event: "logout", ipAddress: "ip2", userAgent: "ua2" });

    const response = await handleAuditLogRoute(makeGet("/api/audit-log?limit=20"), "/api/audit-log", {
      authenticate: async () => ({ user: { id: "1" } } as any),
    });

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(200);
    const body = await response!.json() as { logs: Array<{ userId: number | null }> };
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0]?.userId).toBe(1);
  });

  test("returns auth error response when unauthenticated", async () => {
    const response = await handleAuditLogRoute(makeGet("/api/audit-log"), "/api/audit-log", {
      authenticate: async () => Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect(response?.status).toBe(401);
  });
});

describe("GET /api/admin/audit-log", () => {
  test("returns all logs for admin and supports filters", async () => {
    seedUser(1);
    seedUser(2);
    await createAuditLog({ userId: 1, event: "login", ipAddress: "ip1", userAgent: "ua1" });
    await createAuditLog({ userId: 2, event: "logout", ipAddress: "ip2", userAgent: "ua2" });

    const response = await handleAdminAuditLogRoute(
      makeGet("/api/admin/audit-log?event=logout&limit=10"),
      "/api/admin/audit-log",
      {
        authorize: async () => ({ user: { id: "999", role: "admin" } } as any),
      }
    );

    expect(response?.status).toBe(200);
    const body = await response!.json() as { logs: Array<{ event: string }>; returned: number };
    expect(body.returned).toBe(1);
    expect(body.logs[0]?.event).toBe("logout");
  });

  test("returns 403 when non-admin", async () => {
    const response = await handleAdminAuditLogRoute(
      makeGet("/api/admin/audit-log"),
      "/api/admin/audit-log",
      {
        authorize: async () => Response.json({ error: "Forbidden" }, { status: 403 }),
      }
    );

    expect(response?.status).toBe(403);
  });
});
