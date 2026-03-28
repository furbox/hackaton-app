/**
 * Service tests for resolveShortCode (Task 4.10.2)
 *
 * Uses an in-memory SQLite database and injects it via setTestDatabase.
 * Tests cover: NOT_FOUND, VALIDATION_ERROR, and success with telemetry + view increment.
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
  db.run(`
    CREATE TABLE link_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      user_id INTEGER,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
}

function seedBaseData(): void {
  testDb.run("INSERT INTO users (id, username) VALUES (1, 'owner')");
  testDb.run("INSERT INTO users (id, username) VALUES (2, 'other-user')");
}

function insertLink(shortCode: string, url: string, userId = 1, isPublic = 1): number {
  const result = testDb.run(
    `INSERT INTO links (user_id, url, title, short_code, is_public)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, url, "Test Link", shortCode, isPublic]
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
  testDb.run("DELETE FROM link_views");
  testDb.run("DELETE FROM links");
  testDb.run("DELETE FROM users");
  seedBaseData();
});

describe("resolveShortCode", () => {
  test("returns VALIDATION_ERROR for empty code", () => {
    const result = resolveShortCode({
      code: "",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("returns VALIDATION_ERROR for blank (whitespace-only) code", () => {
    const result = resolveShortCode({
      code: "   ",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("returns NOT_FOUND for unknown short code", () => {
    const result = resolveShortCode({
      code: "unknown99",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  test("returns NOT_FOUND and does not persist visits for unknown short code", () => {
    const result = resolveShortCode({
      code: "unknown-not-found",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }

    const visitCount = testDb
      .query("SELECT COUNT(*) as count FROM link_views")
      .get() as { count: number };

    expect(visitCount.count).toBe(0);
  });

  test("returns url and id on anonymous success, increments views, stores NULL user_id", () => {
    const linkId = insertLink("xyz789", "https://success.example.com");

    const result = resolveShortCode({
      code: "xyz789",
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.url).toBe("https://success.example.com");
      expect(result.data.id).toBe(linkId);
    }

    const row = testDb
      .query("SELECT views FROM links WHERE id = ?")
      .get(linkId) as { views: number } | null;

    const visitRow = testDb
      .query("SELECT user_id, ip_address, user_agent FROM link_views WHERE link_id = ?")
      .get(linkId) as
      | { user_id: number | null; ip_address: string; user_agent: string }
      | null;

    expect(row?.views).toBe(1);
    expect(visitRow?.user_id).toBeNull();
    expect(visitRow?.ip_address).toBe("127.0.0.1");
    expect(visitRow?.user_agent).toBe("Mozilla/5.0");
  });

  test("stores actor user id for authenticated success", () => {
    const linkId = insertLink("auth999", "https://auth.example.com");

    const result = resolveShortCode({
      code: "auth999",
      ipAddress: "10.1.1.1",
      userAgent: "AuthBrowser/2.1",
      actorUserId: 1,
    });

    expect(result.ok).toBe(true);

    const visitRow = testDb
      .query("SELECT user_id FROM link_views WHERE link_id = ?")
      .get(linkId) as { user_id: number | null } | null;

    expect(visitRow?.user_id).toBe(1);
  });

  test("returns UNAUTHORIZED for private link when actor is anonymous", () => {
    const linkId = insertLink("private-anon", "https://private-anon.example.com", 1, 0);

    const result = resolveShortCode({
      code: "private-anon",
      ipAddress: "127.0.0.1",
      userAgent: "AnonAgent/1.0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }

    const viewsRow = testDb
      .query("SELECT views FROM links WHERE id = ?")
      .get(linkId) as { views: number } | null;
    const visitCount = testDb
      .query("SELECT COUNT(*) as count FROM link_views WHERE link_id = ?")
      .get(linkId) as { count: number };

    expect(viewsRow?.views).toBe(0);
    expect(visitCount.count).toBe(0);
  });

  test("returns FORBIDDEN for private link when actor is not owner", () => {
    const linkId = insertLink("private-foreign", "https://private-foreign.example.com", 1, 0);

    const result = resolveShortCode({
      code: "private-foreign",
      ipAddress: "127.0.0.1",
      userAgent: "ForeignAgent/1.0",
      actorUserId: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }

    const viewsRow = testDb
      .query("SELECT views FROM links WHERE id = ?")
      .get(linkId) as { views: number } | null;
    const visitCount = testDb
      .query("SELECT COUNT(*) as count FROM link_views WHERE link_id = ?")
      .get(linkId) as { count: number };

    expect(viewsRow?.views).toBe(0);
    expect(visitCount.count).toBe(0);
  });

  test("allows owner to resolve private link and still tracks visit", () => {
    const linkId = insertLink("private-owner", "https://private-owner.example.com", 1, 0);

    const result = resolveShortCode({
      code: "private-owner",
      ipAddress: "10.0.0.9",
      userAgent: "OwnerAgent/3.0",
      actorUserId: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(linkId);
      expect(result.data.url).toBe("https://private-owner.example.com");
    }

    const viewsRow = testDb
      .query("SELECT views FROM links WHERE id = ?")
      .get(linkId) as { views: number } | null;
    const visitRow = testDb
      .query("SELECT user_id FROM link_views WHERE link_id = ?")
      .get(linkId) as { user_id: number | null } | null;

    expect(viewsRow?.views).toBe(1);
    expect(visitRow?.user_id).toBe(1);
  });
});
