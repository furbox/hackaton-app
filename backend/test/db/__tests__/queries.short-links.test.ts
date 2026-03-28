/**
 * DB query tests for shortlink resolution data access.
 *
 * Uses an in-memory SQLite database to test query functions in isolation.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../connection.js";
import {
  createLinkScoped,
  getLinkByShortCode,
  getLinkByShortCodeVisibleToActor,
  insertLinkView,
  recordLinkVisitAndIncrementViews,
} from "../queries.js";

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
  testDb.run("INSERT INTO users (id, username) VALUES (2, 'viewer')");
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

describe("getLinkByShortCodeVisibleToActor", () => {
  test("returns public link for anonymous actor", () => {
    const created = createLinkScoped({
      user_id: 1,
      url: "https://public.example.com",
      title: "Public",
      short_code: "pub123",
      is_public: 1,
    });

    const found = getLinkByShortCodeVisibleToActor("pub123");

    expect(found?.id).toBe(created.id);
  });

  test("returns private link for owner actor", () => {
    const created = createLinkScoped({
      user_id: 1,
      url: "https://private.example.com",
      title: "Private",
      short_code: "priv123",
      is_public: 0,
    });

    const found = getLinkByShortCodeVisibleToActor("priv123", 1);

    expect(found?.id).toBe(created.id);
  });

  test("returns null for private link when actor is not owner", () => {
    createLinkScoped({
      user_id: 1,
      url: "https://private-hidden.example.com",
      title: "Private Hidden",
      short_code: "priv-hidden",
      is_public: 0,
    });

    const found = getLinkByShortCodeVisibleToActor("priv-hidden", 2);

    expect(found).toBeNull();
  });
});

describe("insertLinkView", () => {
  test("stores anonymous visit rows with NULL user_id", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://anonymous.example.com",
      title: "Anonymous",
      short_code: "anon1",
      is_public: 1,
    });

    const inserted = insertLinkView({
      linkId: link.id,
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(inserted).toBe(true);

    const row = testDb
      .query("SELECT link_id, user_id, ip_address, user_agent FROM link_views WHERE link_id = ?")
      .get(link.id) as
      | { link_id: number; user_id: number | null; ip_address: string; user_agent: string }
      | null;

    expect(row).not.toBeNull();
    expect(row?.link_id).toBe(link.id);
    expect(row?.user_id).toBeNull();
    expect(row?.ip_address).toBe("127.0.0.1");
    expect(row?.user_agent).toBe("TestAgent/1.0");
  });

  test("stores authenticated visit rows with user_id", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://authenticated.example.com",
      title: "Authenticated",
      short_code: "auth1",
      is_public: 1,
    });

    const inserted = insertLinkView({
      linkId: link.id,
      userId: 1,
      ipAddress: "192.168.1.12",
      userAgent: "AuthAgent/2.0",
    });

    expect(inserted).toBe(true);

    const row = testDb
      .query("SELECT user_id FROM link_views WHERE link_id = ?")
      .get(link.id) as { user_id: number | null } | null;

    expect(row?.user_id).toBe(1);
  });
});

describe("recordLinkVisitAndIncrementViews", () => {
  test("writes one visit and increments links.views exactly once", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://atomic.example.com",
      title: "Atomic",
      short_code: "tx1",
      is_public: 1,
    });

    recordLinkVisitAndIncrementViews({
      linkId: link.id,
      userId: 1,
      ipAddress: "10.0.0.20",
      userAgent: "AtomicAgent/1.0",
    });

    const viewsRow = testDb.query("SELECT views FROM links WHERE id = ?").get(link.id) as
      | { views: number }
      | null;
    const visitCountRow = testDb
      .query("SELECT COUNT(*) as count FROM link_views WHERE link_id = ?")
      .get(link.id) as { count: number };

    expect(viewsRow?.views).toBe(1);
    expect(visitCountRow.count).toBe(1);
  });

  test("rolls back visit insert when views increment fails", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://rollback.example.com",
      title: "Rollback",
      short_code: "tx2",
      is_public: 1,
    });

    testDb.run(`
      CREATE TRIGGER fail_views_increment
      BEFORE UPDATE OF views ON links
      BEGIN
        SELECT RAISE(ABORT, 'forced views increment failure');
      END;
    `);

    try {
      expect(() => {
        recordLinkVisitAndIncrementViews({
          linkId: link.id,
          ipAddress: "10.0.0.30",
          userAgent: "RollbackAgent/1.0",
        });
      }).toThrow();
    } finally {
      testDb.run("DROP TRIGGER IF EXISTS fail_views_increment");
    }

    const viewsRow = testDb.query("SELECT views FROM links WHERE id = ?").get(link.id) as
      | { views: number }
      | null;
    const visitCountRow = testDb
      .query("SELECT COUNT(*) as count FROM link_views WHERE link_id = ?")
      .get(link.id) as { count: number };

    expect(viewsRow?.views).toBe(0);
    expect(visitCountRow.count).toBe(0);
  });
});
