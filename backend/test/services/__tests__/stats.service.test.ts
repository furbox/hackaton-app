import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import {
  getUserStats,
  getGlobalStats,
} from "../stats.service.js";

let testDb: Database;

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      bio TEXT,
      rank_id INTEGER DEFAULT 1,
      email_verified INTEGER DEFAULT 0
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
      UNIQUE(user_id, url)
    )
  `);
  db.run(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);
  db.run(`
    CREATE TABLE likes (
      user_id INTEGER NOT NULL,
      link_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, link_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
    )
  `);
}

function seedBaseData(): void {
  // User 1: Active user with links
  testDb.run("INSERT INTO users (id, username, avatar_url, bio, rank_id) VALUES (1, 'alice', 'https://avatar1.png', 'Bio 1', 3)");

  // User 2: New user with zero links
  testDb.run("INSERT INTO users (id, username, avatar_url, bio, rank_id) VALUES (2, 'bob', 'https://avatar2.png', 'Bio 2', 1)");

  // User 3: Another user for likes
  testDb.run("INSERT INTO users (id, username, avatar_url, bio, rank_id) VALUES (3, 'charlie', NULL, NULL, 2)");

  // Create links for user 1
  testDb.run(`
    INSERT INTO links (user_id, url, title, short_code, is_public, views)
    VALUES (1, 'https://example1.com', 'Link 1', 'link1', 1, 100)
  `);
  testDb.run(`
    INSERT INTO links (user_id, url, title, short_code, is_public, views)
    VALUES (1, 'https://example2.com', 'Link 2', 'link2', 1, 50)
  `);
  testDb.run(`
    INSERT INTO links (user_id, url, title, short_code, is_public, views)
    VALUES (1, 'https://example3.com', 'Link 3', 'link3', 0, 25)
  `);

  // Create a category for global stats
  testDb.run("INSERT INTO categories (user_id, name, color) VALUES (1, 'Tech', '#3b82f6')");

  // Get the actual link IDs (they are autoincremented)
  const links = testDb.query("SELECT id FROM links ORDER BY id").all() as { id: number }[];
  if (links.length >= 2) {
    // Add likes to user 1's links (from user 3)
    testDb.run("INSERT INTO likes (user_id, link_id) VALUES (3, ?)", [links[0].id]);
    testDb.run("INSERT INTO likes (user_id, link_id) VALUES (3, ?)", [links[1].id]);
  }
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
  testDb.run("DELETE FROM likes");
  testDb.run("DELETE FROM links");
  testDb.run("DELETE FROM categories");
  testDb.run("DELETE FROM users");
  seedBaseData();
});

describe("getUserStats", () => {
  test("returns UNAUTHORIZED when actor is null", () => {
    const result = getUserStats(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toBe("Authentication required");
    }
  });

  test("returns user stats for authenticated user", () => {
    const result = getUserStats({ userId: 1 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.username).toBe("alice");
      expect(result.data.avatarUrl).toBe("https://avatar1.png");
      expect(result.data.bio).toBe("Bio 1");
      expect(result.data.rankId).toBe(3);
      expect(result.data.totalLinks).toBe(3);
      expect(result.data.totalViews).toBe(175); // 100 + 50 + 25
      expect(result.data.totalLikes).toBe(2);
    }
  });

  test("returns zero counts for user with no links", () => {
    const result = getUserStats({ userId: 2 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.username).toBe("bob");
      expect(result.data.totalLinks).toBe(0);
      expect(result.data.totalViews).toBe(0);
      expect(result.data.totalLikes).toBe(0);
    }
  });

  test("returns NOT_FOUND when user does not exist", () => {
    const result = getUserStats({ userId: 999 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("User not found");
    }
  });

  test("handles null avatar_url and bio", () => {
    const result = getUserStats({ userId: 3 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.username).toBe("charlie");
      expect(result.data.avatarUrl).toBeNull();
      expect(result.data.bio).toBeNull();
    }
  });
});

describe("getGlobalStats", () => {
  test("returns platform-wide counters", () => {
    const result = getGlobalStats();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalUsers).toBe(3);
      expect(result.data.totalLinks).toBe(2); // 2 public links
      expect(result.data.totalCategories).toBe(1);
    }
  });

  test("handles empty database", () => {
    testDb.run("DELETE FROM likes");
    testDb.run("DELETE FROM links");
    testDb.run("DELETE FROM categories");
    testDb.run("DELETE FROM users");

    const result = getGlobalStats();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalUsers).toBe(0);
      expect(result.data.totalLinks).toBe(0);
      expect(result.data.totalCategories).toBe(0);
    }
  });
});
