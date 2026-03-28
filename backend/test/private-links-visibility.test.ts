import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import {
  getLinksVisibleToActor,
  type LinkWithCounts,
} from "../db/queries/links.ts";
import {
  getUserPublicProfile,
  getProfileCreatedLinksVisibleToActor,
  getProfileFavoriteLinksVisibleToActor,
} from "../db/queries/stats.ts";
import { setTestDatabase, closeDatabase } from "../db/connection.ts";

describe("Private Links Visibility Tests", () => {
  let db: Database;

  beforeAll(() => {
    // Create an in-memory database for testing
    db = new Database(":memory:");

    // Enable foreign keys
    db.exec("PRAGMA foreign_keys = ON;");

    // Set the test database to override the singleton
    setTestDatabase(db);

    // Create schema
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        rank_id INTEGER DEFAULT 1,
        email_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        short_code TEXT UNIQUE NOT NULL,
        is_public BOOLEAN DEFAULT true,
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
      );

      CREATE VIRTUAL TABLE links_fts USING fts5(
        title,
        description,
        url,
        content_text,
        content='links',
        content_rowid='id'
      );

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      );

      CREATE TABLE likes (
        user_id INTEGER NOT NULL,
        link_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, link_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
      );

      CREATE TABLE favorites (
        user_id INTEGER NOT NULL,
        link_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, link_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
      );

      CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
        INSERT INTO links_fts(rowid, title, description, url, content_text)
        VALUES (new.id, new.title, new.description, new.url, new.content_text);
      END;

      CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN
        INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
        VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
      END;

      CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
        INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
        VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
        INSERT INTO links_fts(rowid, title, description, url, content_text)
        VALUES (new.id, new.title, new.description, new.url, new.content_text);
      END;
    `);

    // Insert test data
    // User 1 (Alice)
    db.run(
      "INSERT INTO users (id, username, email, password_hash, bio) VALUES (1, 'alice', 'alice@example.com', 'hash1', 'Alice bio')"
    );

    // User 2 (Bob)
    db.run(
      "INSERT INTO users (id, username, email, password_hash, bio) VALUES (2, 'bob', 'bob@example.com', 'hash2', 'Bob bio')"
    );

    // Alice's links (3 public, 2 private)
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (1, 1, 'https://example.com/1', 'Alice Public Link 1', 'apub1', 1)"
    );
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (2, 1, 'https://example.com/2', 'Alice Public Link 2', 'apub2', 1)"
    );
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (3, 1, 'https://example.com/3', 'Alice Public Link 3', 'apub3', 1)"
    );
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (4, 1, 'https://example.com/4', 'Alice Private Link 1', 'aprv1', 0)"
    );
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (5, 1, 'https://example.com/5', 'Alice Private Link 2', 'aprv2', 0)"
    );

    // Bob's links (2 public, 1 private)
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (6, 2, 'https://example.com/6', 'Bob Public Link 1', 'bpub1', 1)"
    );
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (7, 2, 'https://example.com/7', 'Bob Public Link 2', 'bpub2', 1)"
    );
    db.run(
      "INSERT INTO links (id, user_id, url, title, short_code, is_public) VALUES (8, 2, 'https://example.com/8', 'Bob Private Link 1', 'bprv1', 0)"
    );
  });

  afterAll(() => {
    // Close the test database and reset the singleton
    closeDatabase();
  });

  describe("Explore Page (GET /api/links)", () => {
    it("should show only public links to unauthenticated users", () => {
      const links = getLinksVisibleToActor({
        actor_user_id: null, // Unauthenticated
        q: null,
        owner_user_id: null,
        category_id: null,
        sort: "recent",
        limit: 100,
        offset: 0,
      });

      // Should only see public links (Alice's 3 + Bob's 2 = 5 total)
      expect(links.length).toBe(5);
      expect(links.every((link) => link.is_public === 1)).toBe(true);
    });

    it("should show only public links to authenticated users (new behavior)", () => {
      // NEW: The route handler now always passes actor=null for the explore page
      // This test verifies that when actor=null, only public links are shown
      const links = getLinksVisibleToActor({
        actor_user_id: null, // Route handler always passes null now
        q: null,
        owner_user_id: null,
        category_id: null,
        sort: "recent",
        limit: 100,
        offset: 0,
      });

      // Alice should ONLY see public links (her 3 public + Bob's 2 public = 5 total)
      // Her private links should NOT be shown on the explore page
      expect(links.length).toBe(5);
      expect(links.every((link) => link.is_public === 1)).toBe(true);
    });

    it("should not show private links from any user on explore page", () => {
      // NEW: The route handler now always passes actor=null for the explore page
      const links = getLinksVisibleToActor({
        actor_user_id: null, // Route handler always passes null now
        q: null,
        owner_user_id: null,
        category_id: null,
        sort: "recent",
        limit: 100,
        offset: 0,
      });

      // Should ONLY see public links (Alice's 3 public + Bob's 2 public = 5 total)
      expect(links.length).toBe(5);
      expect(links.every((link) => link.is_public === 1)).toBe(true);
    });
  });

  describe("Profile Page (GET /api/users/:username)", () => {
    it("should show only public links when viewing another user's profile while unauthenticated", () => {
      const profile = getUserPublicProfile("alice");
      expect(profile).not.toBeNull();

      const links = getProfileCreatedLinksVisibleToActor(
        profile!.id,
        null // Unauthenticated
      );

      // Should only see Alice's 3 public links
      expect(links.length).toBe(3);
      expect(links.every((link) => link.is_public === 1)).toBe(true);
    });

    it("should show only public links when viewing another user's profile while authenticated as different user", () => {
      const profile = getUserPublicProfile("alice");
      expect(profile).not.toBeNull();

      // NEW: The route handler now always passes actor=null for public profiles
      const links = getProfileCreatedLinksVisibleToActor(
        profile!.id,
        null // Route handler always passes null now
      );

      // Should only see Alice's 3 public links (not her private ones)
      expect(links.length).toBe(3);
      expect(links.every((link) => link.is_public === 1)).toBe(true);
    });

    it("should show only public links when viewing own profile (new behavior)", () => {
      const profile = getUserPublicProfile("alice");
      expect(profile).not.toBeNull();

      // NEW: The route handler now always passes actor=null for public profiles
      // Even when Alice views her own public profile, she sees only public links
      const links = getProfileCreatedLinksVisibleToActor(
        profile!.id,
        null // Route handler always passes null now
      );

      // NEW BEHAVIOR: Public profiles show ONLY public links, even to the owner
      // Should only see Alice's 3 public links (not her private ones)
      expect(links.length).toBe(3);
      expect(links.every((link) => link.is_public === 1)).toBe(true);

      // Verify private links are NOT shown
      const privateLinks = links.filter((link) => link.is_public === 0);
      expect(privateLinks.length).toBe(0);
    });
  });
});
