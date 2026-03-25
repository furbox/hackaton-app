import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../connection.js";
import {
  createLinkScoped,
  getGlobalStats,
  getUserStatsById,
} from "../queries.js";

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

describe("getUserStatsById", () => {
  test("returns aggregated stats for active user with links", () => {
    const stats = getUserStatsById(1);

    expect(stats).not.toBeNull();
    expect(stats?.username).toBe("alice");
    expect(stats?.avatar_url).toBe("https://avatar1.png");
    expect(stats?.bio).toBe("Bio 1");
    expect(stats?.rank_id).toBe(3);
    expect(stats?.total_links).toBe(3);
    expect(stats?.total_views).toBe(175); // 100 + 50 + 25
    expect(stats?.total_likes).toBe(2); // 2 likes from user 3
  });

  test("returns zero counts for user with no links", () => {
    const stats = getUserStatsById(2);

    expect(stats).not.toBeNull();
    expect(stats?.username).toBe("bob");
    expect(stats?.avatar_url).toBe("https://avatar2.png");
    expect(stats?.bio).toBe("Bio 2");
    expect(stats?.rank_id).toBe(1);
    expect(stats?.total_links).toBe(0);
    expect(stats?.total_views).toBe(0);
    expect(stats?.total_likes).toBe(0);
  });

  test("returns null for non-existent user", () => {
    const stats = getUserStatsById(999);
    expect(stats).toBeNull();
  });

  test("handles NULL avatar_url and bio correctly", () => {
    const stats = getUserStatsById(3);

    expect(stats).not.toBeNull();
    expect(stats?.username).toBe("charlie");
    expect(stats?.avatar_url).toBeNull();
    expect(stats?.bio).toBeNull();
    expect(stats?.total_links).toBe(0);
    expect(stats?.total_views).toBe(0);
    expect(stats?.total_likes).toBe(0);
  });
});

describe("getGlobalStats", () => {
  test("returns platform-wide counters", () => {
    const stats = getGlobalStats();

    expect(stats.total_users).toBe(3);
    expect(stats.total_links).toBe(2); // 2 public links out of 3 (link3 is private)
    expect(stats.total_categories).toBe(1);
  });

  test("counts only public links", () => {
    // Add a private link
    testDb.run(`
      INSERT INTO links (user_id, url, title, short_code, is_public, views)
      VALUES (1, 'https://private.com', 'Private', 'priv', 0, 10)
    `);

    const stats = getGlobalStats();
    expect(stats.total_links).toBe(2); // Still 2, new private link not counted
  });

  test("handles empty database", () => {
    testDb.run("DELETE FROM likes");
    testDb.run("DELETE FROM links");
    testDb.run("DELETE FROM categories");
    testDb.run("DELETE FROM users");

    const stats = getGlobalStats();
    expect(stats.total_users).toBe(0);
    expect(stats.total_links).toBe(0);
    expect(stats.total_categories).toBe(0);
  });
});
