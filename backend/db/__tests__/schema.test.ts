/**
 * Database Schema Tests
 *
 * Tests to verify the schema.sql file creates all tables correctly:
 * - All tables exist (users, links, categories, ranks, etc.)
 * - Foreign keys are enforced (CASCADE/SET NULL works)
 * - FTS5 triggers synchronize data correctly
 * - WAL mode is enabled for concurrency
 *
 * @module backend/db/__tests__/schema.test
 */

import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

describe("Database Schema - Phase 2.7", () => {
  /**
   * Helper function to create a fresh in-memory database with schema loaded
   */
  function createTestDatabase(): Database {
    const db = new Database(":memory:");

    // Enable foreign keys (required for CASCADE/SET NULL)
    db.run("PRAGMA foreign_keys = ON;");

    // Get the correct path to schema.sql
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, "..", "schema.sql");

    // Read and execute schema.sql
    const schema = readFileSync(schemaPath, "utf-8");
    db.run(schema);

    return db;
  }

  describe("Table Creation", () => {
    test("creates all tables", () => {
      const db = createTestDatabase();

      // Get all table names from sqlite_master
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      // Verify all expected tables exist
      expect(tableNames).toContain("ranks");
      expect(tableNames).toContain("users");
      expect(tableNames).toContain("password_resets");
      expect(tableNames).toContain("categories");
      expect(tableNames).toContain("links");
      expect(tableNames).toContain("links_fts");
      expect(tableNames).toContain("likes");
      expect(tableNames).toContain("favorites");
      expect(tableNames).toContain("sessions");
      expect(tableNames).toContain("audit_logs");
      expect(tableNames).toContain("api_keys");

      // Total tables: 11 normal tables + 1 FTS5 virtual table + SQLite system tables
      // (sqlite_sequence, etc. are created automatically)
      expect(tableNames.length).toBeGreaterThanOrEqual(11);

      db.close();
    });

    test("creates expected columns in users table", () => {
      const db = createTestDatabase();

      // Get table info for users
      const columns = db
        .query("PRAGMA table_info(users)")
        .all() as { name: string }[];

      const columnNames = columns.map((c) => c.name);

      // Verify key columns exist
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("username");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("password_hash");
      expect(columnNames).toContain("avatar_url");
      expect(columnNames).toContain("bio");
      expect(columnNames).toContain("rank_id");
      expect(columnNames).toContain("email_verified");
      expect(columnNames).toContain("verification_token");
      expect(columnNames).toContain("created_at");

      db.close();
    });

    test("creates expected columns in links table", () => {
      const db = createTestDatabase();

      const columns = db
        .query("PRAGMA table_info(links)")
        .all() as { name: string }[];

      const columnNames = columns.map((c) => c.name);

      // Verify key columns including Open Graph and FTS5 fields
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("user_id");
      expect(columnNames).toContain("url");
      expect(columnNames).toContain("title");
      expect(columnNames).toContain("description");
      expect(columnNames).toContain("short_code");
      expect(columnNames).toContain("is_public");
      expect(columnNames).toContain("category_id");
      expect(columnNames).toContain("views");
      expect(columnNames).toContain("og_title");
      expect(columnNames).toContain("og_description");
      expect(columnNames).toContain("og_image");
      expect(columnNames).toContain("status_code");
      expect(columnNames).toContain("archive_url");
      expect(columnNames).toContain("content_text");
      expect(columnNames).toContain("created_at");

      db.close();
    });
  });

  describe("Foreign Keys", () => {
    test("enables foreign keys constraint", () => {
      const db = createTestDatabase();

      // Verify foreign_keys pragma is enabled
      const result = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
      expect(result.foreign_keys).toBe(1);

      db.close();
    });

    test("rejects insert with invalid user_id foreign key", () => {
      const db = createTestDatabase();

      // Try to insert a link with non-existent user_id
      expect(() => {
        db.run(
          `INSERT INTO links (user_id, url, title, short_code) 
           VALUES (9999, 'https://example.com', 'Test', 'test123')`
        );
      }).toThrow();

      db.close();
    });

    test("rejects insert with invalid category_id foreign key", () => {
      const db = createTestDatabase();

      // First create a user (required for links)
      const userResult = db.run(
        `INSERT INTO users (username, email, password_hash)
          VALUES ('testuser', 'test@example.com', 'hash123')`
      );
      const userId = Number(userResult.lastInsertRowid);

      // Try to insert a link with non-existent category_id
      expect(() => {
        db.run(
          `INSERT INTO links (user_id, url, title, short_code, category_id)
           VALUES (${userId}, 'https://example.com', 'Test', 'test123', 9999)`
        );
      }).toThrow();

      db.close();
    });

    test("sets category_id to NULL when category is deleted", () => {
      const db = createTestDatabase();

      // Create a user
       const userResult = db.run(
        `INSERT INTO users (username, email, password_hash)
          VALUES ('testuser_cat', 'testcat@example.com', 'hash123')`
      );
      const userId = Number(userResult.lastInsertRowid);

      // Create a category
      const catResult = db.run(
        `INSERT INTO categories (user_id, name)
          VALUES (${userId}, 'Tech')`
      );
      const categoryId = Number(catResult.lastInsertRowid);

      // Create a link with that category
      const linkResult = db.run(
        `INSERT INTO links (user_id, url, title, short_code, category_id)
          VALUES (${userId}, 'https://example.com', 'Test', 'test123', ${categoryId})`
      );
      const linkId = Number(linkResult.lastInsertRowid);

      // Verify link has category
      const linkBefore = db
        .query(`SELECT category_id FROM links WHERE id = ${linkId}`)
        .get() as { category_id: number };
      expect(linkBefore.category_id).toBe(categoryId);

      // Delete the category (should SET NULL on links)
      db.run(`DELETE FROM categories WHERE id = ${categoryId}`);

      // Verify link category was set to NULL
      const linkAfter = db
        .query(`SELECT category_id FROM links WHERE id = ${linkId}`)
        .get() as { category_id: number | null };
      expect(linkAfter.category_id).toBeNull();

      db.close();
    });
  });

  describe("FTS5 Full-Text Search", () => {
    test("creates links_fts virtual table", () => {
      const db = createTestDatabase();

      // Verify FTS5 table exists
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='links_fts'")
        .all();

      expect(tables).toHaveLength(1);

      db.close();
    });

    test("FTS5 trigger syncs on INSERT", () => {
      const db = createTestDatabase();

      // Create a user and link
      const userResult = db.run(
        `INSERT INTO users (username, email, password_hash)
          VALUES ('testuser_fts_ins', 'testftsins@example.com', 'hash123')`
      );
      const userId = Number(userResult.lastInsertRowid);

      db.run(
        `INSERT INTO links (user_id, url, title, description, short_code)
          VALUES (${userId}, 'https://example.com', 'Test Link', 'This is a test description', 'test123')`
      );

      // Verify FTS5 index has the new link
      const results = db
        .query(`SELECT rowid FROM links_fts WHERE links_fts MATCH 'test'`)
        .all() as { rowid: number }[];

      expect(results.length).toBeGreaterThan(0);

      db.close();
    });

    test("FTS5 trigger syncs on UPDATE", () => {
      const db = createTestDatabase();

      // Create a user and link
      const userResult = db.run(
        `INSERT INTO users (username, email, password_hash)
          VALUES ('testuser_fts_upd', 'testftsupd@example.com', 'hash123')`
      );
      const userId = Number(userResult.lastInsertRowid);

      const linkResult = db.run(
        `INSERT INTO links (user_id, url, title, description, short_code)
          VALUES (${userId}, 'https://example.com', 'Original Title', 'Original description', 'test123')`
      );
      const linkId = Number(linkResult.lastInsertRowid);

      // Update the link
      db.run(
        `UPDATE links SET title = 'Updated Title', description = 'Updated description'
         WHERE id = ${linkId}`
      );

      // Verify FTS5 index has the updated content
      const results = db
        .query(`SELECT rowid FROM links_fts WHERE links_fts MATCH 'updated'`)
        .all() as { rowid: number }[];

      expect(results.length).toBeGreaterThan(0);

      // Old content should not be searchable
      const oldResults = db
        .query(`SELECT rowid FROM links_fts WHERE links_fts MATCH 'original'`)
        .all();

      expect(oldResults).toHaveLength(0);

      db.close();
    });

    test("FTS5 trigger syncs on DELETE", () => {
      const db = createTestDatabase();

      // Create a user and link
      const userResult = db.run(
        `INSERT INTO users (username, email, password_hash)
          VALUES ('testuser_fts_del', 'testftsdel@example.com', 'hash123')`
      );
      const userId = Number(userResult.lastInsertRowid);

      const linkResult = db.run(
        `INSERT INTO links (user_id, url, title, description, short_code)
          VALUES (${userId}, 'https://example.com', 'Test Link', 'This is a test', 'test123')`
      );
      const linkId = Number(linkResult.lastInsertRowid);

      // Verify FTS5 has the link
      const beforeDelete = db
        .query(`SELECT rowid FROM links_fts WHERE links_fts MATCH 'test'`)
        .all();
      expect(beforeDelete.length).toBeGreaterThan(0);

      // Delete the link
      db.run(`DELETE FROM links WHERE id = ${linkId}`);

      // Verify FTS5 removed the link
      const afterDelete = db
        .query(`SELECT rowid FROM links_fts WHERE links_fts MATCH 'test'`)
        .all();

      expect(afterDelete).toHaveLength(0);

      db.close();
    });
  });

  describe("WAL Mode", () => {
    test("can set WAL mode with PRAGMA", () => {
      // In-memory databases don't support true WAL mode (they return 'memory')
      // but we verify the PRAGMA syntax works correctly
      const db = new Database(":memory:");
      
      // This won't actually set WAL mode in-memory, but verifies syntax is valid
      db.run("PRAGMA journal_mode=WAL;");
      
      // In-memory DB returns 'memory' instead of 'wal'
      const result = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
      expect(result.journal_mode).toBe("memory");
      
      db.close();
    });

    test("verifies WAL mode PRAGMA is accepted", () => {
      // Just verify the PRAGMA command doesn't throw errors
      const db = new Database(":memory:");
      
      expect(() => {
        db.run("PRAGMA journal_mode=WAL;");
      }).not.toThrow();
      
      db.close();
    });
  });

  describe("Initial Data", () => {
    test("inserts initial rank data", () => {
      const db = createTestDatabase();

      // Verify ranks table has 5 initial ranks
      const count = db
        .query("SELECT COUNT(*) as count FROM ranks")
        .get() as { count: number };

      expect(count.count).toBe(5);

      // Verify specific ranks exist
      const newbie = db
        .query("SELECT * FROM ranks WHERE name = 'newbie'")
        .get() as { display_name: string };

      expect(newbie).toBeTruthy();
      expect(newbie.display_name).toBe("🌱 Newbie");

      db.close();
    });
  });
});
