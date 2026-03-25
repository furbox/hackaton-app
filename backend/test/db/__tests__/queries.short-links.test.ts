/**
 * DB query tests for getLinkByShortCode (Task 4.10.1)
 *
 * Uses an in-memory SQLite database to test the query function in isolation.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../connection.js";
import { createLinkScoped, getLinkByShortCode } from "../queries.js";

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

describe("getLinkByShortCode", () => {
  test("returns the link for a valid short code", () => {
    const created = createLinkScoped({
      user_id: 1,
      url: "https://example.com",
      title: "Example",
      short_code: "abc123",
      is_public: 1,
    });

    const found = getLinkByShortCode("abc123");

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.url).toBe("https://example.com");
    expect(found?.short_code).toBe("abc123");
  });

  test("returns null for an unknown short code", () => {
    const result = getLinkByShortCode("doesnotexist");

    expect(result).toBeNull();
  });
});
