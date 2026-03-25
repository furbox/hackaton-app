import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import {
  createAuditLog,
  getAllAuditLogs,
  getUserAuditLogs,
  type AuditEvent,
} from "../audit-log.service.js";

describe("audit-log performance benchmarks", () => {
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

  function seedAuditLogs(userId: number, count: number, event?: AuditEvent): void {
    const stmt = testDb.prepare(`
      INSERT INTO audit_logs (user_id, event, ip_address, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (let i = 0; i < count; i++) {
      stmt.run(
        userId,
        event ?? (i % 2 === 0 ? "login" : "logout"),
        `203.0.113.${i % 256}`,
        `Benchmark/1.0`,
        JSON.stringify({ iteration: i })
      );
    }
  }

  function calculatePercentiles(times: number[]): { p50: number; p95: number; p99: number } {
    const sorted = [...times].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
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

  describe("createAuditLog()", () => {
    test("creates audit log < 5ms p95 (100 iterations)", async () => {
      seedUser(1);
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await createAuditLog({
          userId: 1,
          event: i % 2 === 0 ? "login" : "logout",
          ipAddress: `203.0.113.${i % 256}`,
          userAgent: "Benchmark/1.0",
          metadata: { method: "password", iteration: i },
        });
        times.push(performance.now() - start);
      }

      const { p50, p95, p99 } = calculatePercentiles(times);

      console.log(`\n  📊 createAuditLog() (${iterations} iterations):`);
      console.log(`     p50: ${p50.toFixed(2)}ms`);
      console.log(`     p95: ${p95.toFixed(2)}ms`);
      console.log(`     p99: ${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(5);
      expect(p50).toBeLessThan(3); // p50 should be even faster
    });
  });

  describe("getUserAuditLogs()", () => {
    test("queries 50 logs < 10ms p95 (100 iterations)", () => {
      seedUser(1);
      seedUser(2);

      // Seed 50 audit logs for user 1
      seedAuditLogs(1, 50);

      // Seed some logs for user 2 to test filtering
      seedAuditLogs(2, 20, "login");

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const logs = getUserAuditLogs(1, 50);
        expect(logs).toHaveLength(50);
        times.push(performance.now() - start);
      }

      const { p50, p95, p99 } = calculatePercentiles(times);

      console.log(`\n  📊 getUserAuditLogs() (50 rows, ${iterations} iterations):`);
      console.log(`     p50: ${p50.toFixed(2)}ms`);
      console.log(`     p95: ${p95.toFixed(2)}ms`);
      console.log(`     p99: ${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(10);
      expect(p50).toBeLessThan(5); // p50 should be even faster
    });
  });

  describe("getAllAuditLogs()", () => {
    test("queries 100 logs with filters < 20ms p95 (100 iterations)", () => {
      // Seed multiple users
      for (let i = 1; i <= 5; i++) {
        seedUser(i);
      }

      // Seed 100 audit logs across different users and events
      const events: AuditEvent[] = ["login", "logout", "password_change", "email_verified", "session_revoked"];
      for (let i = 0; i < 100; i++) {
        const userId = (i % 5) + 1;
        const event = events[i % events.length];
        seedAuditLogs(userId, 1, event);
      }

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // Test with various filters to simulate real usage
        const logs = getAllAuditLogs({
          limit: 100,
          offset: 0,
        });
        expect(logs.length).toBeGreaterThan(0);
        times.push(performance.now() - start);
      }

      const { p50, p95, p99 } = calculatePercentiles(times);

      console.log(`\n  📊 getAllAuditLogs() (100 rows, ${iterations} iterations):`);
      console.log(`     p50: ${p50.toFixed(2)}ms`);
      console.log(`     p95: ${p95.toFixed(2)}ms`);
      console.log(`     p99: ${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(20);
      expect(p50).toBeLessThan(10); // p50 should be even faster
    });

    test("queries with event filter < 15ms p95", () => {
      // Seed data
      for (let i = 1; i <= 3; i++) {
        seedUser(i);
      }

      const events: AuditEvent[] = ["login", "logout", "password_change"];
      for (let i = 0; i < 50; i++) {
        const userId = (i % 3) + 1;
        const event = events[i % events.length];
        seedAuditLogs(userId, 1, event);
      }

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const logs = getAllAuditLogs({
          event: "login",
          limit: 50,
        });
        times.push(performance.now() - start);
      }

      const { p50, p95, p99 } = calculatePercentiles(times);

      console.log(`\n  📊 getAllAuditLogs() with event filter (${iterations} iterations):`);
      console.log(`     p50: ${p50.toFixed(2)}ms`);
      console.log(`     p95: ${p95.toFixed(2)}ms`);
      console.log(`     p99: ${p99.toFixed(2)}ms`);

      expect(p95).toBeLessThan(15);
    });
  });
});
