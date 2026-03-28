/**
 * Rank System Tests
 *
 * Tests automatic rank updates based on link count thresholds.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import {
  createUser,
  recalculateAndUpdateRank,
  getUserRankWithCounts,
  getUserById,
  type CreateUserParams,
} from "../users.ts";
import {
  createLinkScoped,
  deleteLinkByOwner,
} from "../links.ts";
import { getDatabase, setTestDatabase } from "../../connection.ts";

describe("Rank System", () => {
  let testDb: Database;
  let userId: number;

  beforeAll(async () => {
    // Create an in-memory database for testing
    testDb = new Database(":memory:");
    testDb.exec("PRAGMA foreign_keys = ON;");

    // Create schema manually for testing
    testDb.exec(`
      CREATE TABLE ranks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        min_links INTEGER NOT NULL,
        max_links INTEGER,
        display_name TEXT NOT NULL,
        badge_url TEXT,
        color TEXT DEFAULT '#6366f1',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO ranks (id, name, min_links, max_links, display_name, badge_url, color, description) VALUES
      (1, 'newbie', 0, 10, '🌱 Newbie', '/badges/newbie.svg', '#6366f1', 'Just getting started'),
      (2, 'active', 11, 50, '⚡ Active', '/badges/active.svg', '#3b82f6', 'Contributing regularly'),
      (3, 'power_user', 51, 150, '🔥 Power User', '/badges/power.svg', '#f59e0b', 'Link master'),
      (4, 'legend', 151, 500, '💎 Legend', '/badges/legend.svg', '#8b5cf6', 'Respected member'),
      (5, 'god_mode', 500, NULL, '👑 GOD Mode', '/badges/god.svg', '#ec4899', 'Untouchable royalty');

      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        rank_id INTEGER NOT NULL DEFAULT 1,
        email_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        verification_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE RESTRICT
      );

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      );

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
      );
    `);

    // Set test database
    setTestDatabase(testDb);

    // Create a test user
    const passwordHash = await Bun.password.hash("password123");
    const userParams: CreateUserParams = {
      username: "testuser",
      email: "test@example.com",
      password_hash: passwordHash,
      bio: "Test user",
      rank_id: 1, // Start as newbie
    };

    const user = createUser(userParams);
    userId = user.id;
  });

  afterAll(() => {
    testDb.close();
  });

  describe("recalculateAndUpdateRank", () => {
    it("should maintain newbie rank (0-10 links)", () => {
      // Create 5 links
      for (let i = 0; i < 5; i++) {
        createLinkScoped({
          user_id: userId,
          url: `https://example${i}.com`,
          title: `Link ${i}`,
          description: null,
          short_code: `test${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const updated = recalculateAndUpdateRank(userId);
      expect(updated).toBeDefined();
      expect(updated?.rank_id).toBe(1); // Still newbie
    });

    it("should upgrade to active rank (11-50 links)", () => {
      // Create 10 more links (total 15)
      for (let i = 5; i < 15; i++) {
        createLinkScoped({
          user_id: userId,
          url: `https://example${i}.com`,
          title: `Link ${i}`,
          description: null,
          short_code: `test${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const updated = recalculateAndUpdateRank(userId);
      expect(updated?.rank_id).toBe(2); // Now active
    });

    it("should upgrade to power_user rank (51-150 links)", () => {
      // Create 40 more links (total 55)
      for (let i = 15; i < 55; i++) {
        createLinkScoped({
          user_id: userId,
          url: `https://example${i}.com`,
          title: `Link ${i}`,
          description: null,
          short_code: `test${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const updated = recalculateAndUpdateRank(userId);
      expect(updated?.rank_id).toBe(3); // Now power_user
    });

    it("should handle edge case at threshold (exactly 150 links)", () => {
      // Create exactly 150 total links (add 95 more)
      for (let i = 55; i < 150; i++) {
        createLinkScoped({
          user_id: userId,
          url: `https://example${i}.com`,
          title: `Link ${i}`,
          description: null,
          short_code: `test${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const updated = recalculateAndUpdateRank(userId);
      expect(updated?.rank_id).toBe(3); // Still power_user at exactly 150
    });

    it("should upgrade to legend rank (151-500 links)", () => {
      // Create 1 more link (total 151)
      createLinkScoped({
        user_id: userId,
        url: "https://example151.com",
        title: "Link 151",
        description: null,
        short_code: "test151",
        is_public: 1,
        category_id: null,
      });

      const updated = recalculateAndUpdateRank(userId);
      expect(updated?.rank_id).toBe(4); // Now legend
    });

    it("should downgrade rank when links are deleted", () => {
      // Get user's links
      const db = getDatabase();
      const links = db.query("SELECT id FROM links WHERE user_id = ?").all(userId) as { id: number }[];

      // Delete all but 10 links
      for (let i = 0; i < links.length - 10; i++) {
        deleteLinkByOwner(links[i].id, userId);
      }

      const updated = recalculateAndUpdateRank(userId);
      expect(updated?.rank_id).toBe(1); // Back to newbie with 10 links
    });

    it("should handle zero links", () => {
      // Delete remaining links
      const db = getDatabase();
      const links = db.query("SELECT id FROM links WHERE user_id = ?").all(userId) as { id: number }[];

      for (const link of links) {
        deleteLinkByOwner(link.id, userId);
      }

      const updated = recalculateAndUpdateRank(userId);
      expect(updated?.rank_id).toBe(1); // Still newbie with 0 links
    });
  });

  describe("getUserRankWithCounts", () => {
    it("should return rank info with progression", () => {
      // Create 5 links (newbie range: 0-10)
      for (let i = 0; i < 5; i++) {
        createLinkScoped({
          user_id: userId,
          url: `https://ranktest${i}.com`,
          title: `Rank Test ${i}`,
          description: null,
          short_code: `ranktest${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const rankInfo = getUserRankWithCounts(userId);
      expect(rankInfo).toBeDefined();
      expect(rankInfo?.totalLinks).toBe(5);
      expect(rankInfo?.currentRank.name).toBe("newbie");
      expect(rankInfo?.currentRank.displayName).toBe("🌱 Newbie");
      expect(rankInfo?.nextRank).toBeDefined();
      expect(rankInfo?.nextRank?.name).toBe("active");
      expect(rankInfo?.nextRank?.linksNeeded).toBe(6); // Need 6 more to reach 11
    });

    it("should return null for next rank at god_mode", () => {
      // Create 500+ links (god_mode range)
      for (let i = 5; i < 505; i++) {
        createLinkScoped({
          user_id: userId,
          url: `https://godtest${i}.com`,
          title: `God Test ${i}`,
          description: null,
          short_code: `godtest${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const rankInfo = getUserRankWithCounts(userId);
      expect(rankInfo?.currentRank.name).toBe("god_mode");
      expect(rankInfo?.nextRank).toBeNull(); // No rank above god_mode
    });
  });

  describe("Edge cases", () => {
    it("should handle user with no links", async () => {
      // Create a new user with no links
      const passwordHash = await Bun.password.hash("password123");
      const newUser = createUser({
        username: "nolinks",
        email: "nolinks@example.com",
        password_hash: passwordHash,
        rank_id: 1,
      });

      const rankInfo = getUserRankWithCounts(newUser.id);
      expect(rankInfo?.totalLinks).toBe(0);
      expect(rankInfo?.currentRank.name).toBe("newbie");
      expect(rankInfo?.nextRank?.linksNeeded).toBe(11);
    });

    it("should handle exactly at threshold boundaries", async () => {
      // Create user at exactly 10 links (newbie max)
      const passwordHash = await Bun.password.hash("password123");
      const boundaryUser = createUser({
        username: "boundary",
        email: "boundary@example.com",
        password_hash: passwordHash,
        rank_id: 1,
      });

      for (let i = 0; i < 10; i++) {
        createLinkScoped({
          user_id: boundaryUser.id,
          url: `https://boundary${i}.com`,
          title: `Boundary ${i}`,
          description: null,
          short_code: `boundary${i}`,
          is_public: 1,
          category_id: null,
        });
      }

      const updated = recalculateAndUpdateRank(boundaryUser.id);
      expect(updated?.rank_id).toBe(1); // Still newbie at exactly 10

      const rankInfo = getUserRankWithCounts(boundaryUser.id);
      expect(rankInfo?.nextRank?.minLinks).toBe(11);
      expect(rankInfo?.nextRank?.linksNeeded).toBe(1);
    });
  });
});
