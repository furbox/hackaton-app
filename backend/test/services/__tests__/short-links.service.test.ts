/**
 * Service tests for resolveShortCode (Task 4.10.2)
 *
 * Uses an in-memory SQLite database and injects it via setTestDatabase.
 * Tests cover: NOT_FOUND, VALIDATION_ERROR, and success with view increment.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import { resolveShortCode } from "../short-links.service.js";

let testDb: Database;

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);
  db.run(`
    CREATE TABLE links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      short_code TEXT UNIQUE NOT NULL,
      is_public INTEGER DEFAULT 1,
      category_id INTEGER,
      views INTEGER DEFAULT 0,
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      status_code INTEGER DEFAULT 200,
      archive_url TEXT,
      content_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      UNIQUE(user_id, url)
    )
  `);
}

function seedBaseData(): void {
  testDb.run("INSERT INTO users (id, username) VALUES (1, 'owner')");
}

function insertLink(shortCode: string, url: string): number {
  const result = testDb.run(
    `INSERT INTO links (user_id, url, title, short_code, is_public)
     VALUES (1, ?, ?, ?, 1)`,
    [url, "Test Link", shortCode]
  );
  return Number(result.lastInsertRowid);
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
  testDb.run("DELETE FROM links");
  testDb.run("DELETE FROM users");
  seedBaseData();
});

describe("resolveShortCode", () => {
  test("returns VALIDATION_ERROR for empty code", () => {
    const result = resolveShortCode({ code: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("returns VALIDATION_ERROR for blank (whitespace-only) code", () => {
    const result = resolveShortCode({ code: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("returns NOT_FOUND for unknown short code", () => {
    const result = resolveShortCode({ code: "unknown99" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  test("returns url and id on success and increments views", () => {
    const linkId = insertLink("xyz789", "https://success.example.com");

    const result = resolveShortCode({ code: "xyz789" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://success.example.com");
      expect(result.data.id).toBe(linkId);
    }

    // Verify the view count was incremented
    const row = testDb
      .query("SELECT views FROM links WHERE id = ?")
      .get(linkId) as { views: number } | null;

    expect(row?.views).toBe(1);
  });
});
