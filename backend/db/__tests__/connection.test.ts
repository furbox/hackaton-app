/**
 * Database Connection Tests
 *
 * Tests to verify the connection wrapper follows Bun best practices:
 * - Singleton pattern works correctly
 * - Foreign keys are enabled
 * - Database connection opens correctly
 *
 * @module backend/db/__tests__/connection.test
 */

import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import { getDatabase, closeDatabase } from "../connection";

describe("Database Connection - Bun Best Practices", () => {
  let db: ReturnType<typeof getDatabase>;

  beforeAll(() => {
    // Ensure clean state before tests
    closeDatabase();
  });

  afterEach(() => {
    // Clean up after each test
    closeDatabase();
  });

  describe("Singleton Pattern", () => {
    test("should return same instance on multiple calls", () => {
      const db1 = getDatabase();
      const db2 = getDatabase();

      // Verify it's literally the same object
      expect(db1).toBe(db2);
      expect(db1).toEqual(db2);
    });

    test("should cache connection across module imports", () => {
      // Import again to test module-level caching
      const { getDatabase: getDatabase2 } = require("../connection");

      const db1 = getDatabase();
      const db2 = getDatabase2();

      expect(db1).toBe(db2);
    });
  });

  describe("Foreign Keys Pragma", () => {
    test("should have foreign_keys enabled", () => {
      db = getDatabase();

      // PRAGMA returns { foreign_keys: 1 } object
      const result = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };

      expect(result.foreign_keys).toBe(1); // 1 = enabled
    });

    test("should maintain foreign_keys on subsequent calls", () => {
      const db1 = getDatabase();
      const result1 = db1.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
      closeDatabase();

      const db2 = getDatabase();
      const result2 = db2.query("PRAGMA foreign_keys").get() as { foreign_keys: number };

      expect(result1.foreign_keys).toBe(1);
      expect(result2.foreign_keys).toBe(1);
    });
  });

  describe("Database File Operations", () => {
    test("should be able to execute PRAGMA queries", () => {
      db = getDatabase();

      // Try a simple PRAGMA query
      const result = db.query("PRAGMA journal_mode").all();

      expect(result).toHaveLength(1);
    });

    test("should handle query errors gracefully", () => {
      db = getDatabase();

      // Try to query non-existent table
      expect(() => {
        db.query("SELECT * FROM nonexistent_table").all();
      }).toThrow();
    });
  });

  describe("Bun Native APIs", () => {
    test("uses Bun's native Database from bun:sqlite", () => {
      db = getDatabase();

      // Verify the database has Bun's native methods
      expect(typeof db.query).toBe("function");
      expect(typeof db.exec).toBe("function");
      expect(typeof db.prepare).toBe("function");
      expect(typeof db.close).toBe("function");
    });
  });
});
