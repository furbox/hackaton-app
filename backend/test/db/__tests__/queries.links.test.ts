import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../connection.js";
import {
  createLinkScoped,
  deleteLinkByOwner,
  getLinkByIdVisibleToActor,
  getLinksVisibleToActor,
  toggleFavoriteAndGetSnapshot,
  toggleLikeAndGetSnapshot,
  updateLinkByOwner,
} from "../queries.js";

let testDb: Database;

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      avatar_url TEXT
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
    CREATE VIRTUAL TABLE links_fts USING fts5(
      title,
      description,
      url,
      content_text,
      content='links',
      content_rowid='id'
    )
  `);
  db.run(`
    CREATE TRIGGER links_ai AFTER INSERT ON links BEGIN
      INSERT INTO links_fts(rowid, title, description, url, content_text)
      VALUES (new.id, new.title, new.description, new.url, new.content_text);
    END
  `);
  db.run(`
    CREATE TRIGGER links_ad AFTER DELETE ON links BEGIN
      INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
      VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
    END
  `);
  db.run(`
    CREATE TRIGGER links_au AFTER UPDATE ON links BEGIN
      INSERT INTO links_fts(links_fts, rowid, title, description, url, content_text)
      VALUES('delete', old.id, old.title, old.description, old.url, old.content_text);
      INSERT INTO links_fts(rowid, title, description, url, content_text)
      VALUES (new.id, new.title, new.description, new.url, new.content_text);
    END
  `);
  db.run(`
    CREATE TABLE likes (
      user_id INTEGER NOT NULL,
      link_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, link_id)
    )
  `);
  db.run(`
    CREATE TABLE favorites (
      user_id INTEGER NOT NULL,
      link_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, link_id)
    )
  `);
}

function seedBaseData(): void {
  testDb.run("INSERT INTO users (id, username) VALUES (1, 'owner')");
  testDb.run("INSERT INTO users (id, username) VALUES (2, 'other')");
  testDb.run("INSERT INTO users (id, username) VALUES (3, 'fan')");
  testDb.run("INSERT INTO categories (id, user_id, name) VALUES (10, 1, 'docs')");
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
  testDb.run("DELETE FROM favorites");
  testDb.run("DELETE FROM likes");
  testDb.run("DELETE FROM links");
  testDb.run("DELETE FROM categories");
  testDb.run("DELETE FROM users");
  seedBaseData();
});

describe("scoped link helpers", () => {
  test("getLinkByIdVisibleToActor enforces visibility", () => {
    const publicLink = createLinkScoped({
      user_id: 1,
      url: "https://public.example.com",
      title: "public",
      short_code: "pub01",
      is_public: 1,
    });

    const privateLink = createLinkScoped({
      user_id: 1,
      url: "https://private.example.com",
      title: "private",
      short_code: "pri01",
      is_public: 0,
    });

    expect(getLinkByIdVisibleToActor(publicLink.id, undefined)?.id).toBe(publicLink.id);
    expect(getLinkByIdVisibleToActor(privateLink.id, undefined)).toBeNull();
    expect(getLinkByIdVisibleToActor(privateLink.id, 2)).toBeNull();
    expect(getLinkByIdVisibleToActor(privateLink.id, 1)?.id).toBe(privateLink.id);
  });

  test("updateLinkByOwner and deleteLinkByOwner are owner-guarded", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://guard.example.com",
      title: "guard",
      short_code: "grd01",
    });

    const deniedUpdate = updateLinkByOwner(link.id, 2, { title: "hacked" });
    expect(deniedUpdate.changes).toBe(0);

    const allowedUpdate = updateLinkByOwner(link.id, 1, { title: "updated" });
    expect(allowedUpdate.changes).toBeGreaterThan(0);

    const deniedDelete = deleteLinkByOwner(link.id, 2);
    expect(deniedDelete.changes).toBe(0);

    const allowedDelete = deleteLinkByOwner(link.id, 1);
    expect(allowedDelete.changes).toBeGreaterThan(0);
  });

  test("getLinksVisibleToActor supports visibility, sort, and paging", () => {
    const l1 = createLinkScoped({
      user_id: 1,
      url: "https://one.example.com",
      title: "one",
      short_code: "ls01",
      is_public: 1,
      category_id: 10,
    });
    const l2 = createLinkScoped({
      user_id: 1,
      url: "https://two.example.com",
      title: "two",
      short_code: "ls02",
      is_public: 1,
      category_id: 10,
    });
    const l3 = createLinkScoped({
      user_id: 1,
      url: "https://three.example.com",
      title: "three",
      short_code: "ls03",
      is_public: 0,
      category_id: 10,
    });

    testDb.run("UPDATE links SET views = 5 WHERE id = ?", [l1.id]);
    testDb.run("UPDATE links SET views = 20 WHERE id = ?", [l2.id]);
    testDb.run("INSERT INTO likes (user_id, link_id) VALUES (2, ?)", [l1.id]);
    testDb.run("INSERT INTO likes (user_id, link_id) VALUES (3, ?)", [l1.id]);
    testDb.run("INSERT INTO favorites (user_id, link_id) VALUES (2, ?)", [l2.id]);

    const anon = getLinksVisibleToActor({
      sort: "recent",
      limit: 10,
      offset: 0,
      owner_user_id: 1,
    });
    expect(anon.some((item) => item.id === l3.id)).toBe(false);
    expect(anon.every((item) => item.owner_username === "owner")).toBe(true);

    const owner = getLinksVisibleToActor({
      sort: "recent",
      limit: 10,
      offset: 0,
      owner_user_id: 1,
      actor_user_id: 1,
    });
    expect(owner.some((item) => item.id === l3.id)).toBe(true);

    const byLikes = getLinksVisibleToActor({
      sort: "likes",
      limit: 10,
      offset: 0,
      owner_user_id: 1,
    });
    expect(byLikes[0]?.id).toBe(l1.id);

    const byViews = getLinksVisibleToActor({
      sort: "views",
      limit: 10,
      offset: 0,
      owner_user_id: 1,
    });
    expect(byViews[0]?.id).toBe(l2.id);

    const pageOne = getLinksVisibleToActor({
      sort: "recent",
      limit: 1,
      offset: 0,
      owner_user_id: 1,
    });
    const pageTwo = getLinksVisibleToActor({
      sort: "recent",
      limit: 1,
      offset: 1,
      owner_user_id: 1,
    });

    expect(pageOne).toHaveLength(1);
    expect(pageTwo).toHaveLength(1);
    expect(pageOne[0]?.id).not.toBe(pageTwo[0]?.id);
  });

  test("getLinksVisibleToActor filters by q using FTS", () => {
    const googleLink = createLinkScoped({
      user_id: 1,
      url: "https://google.com",
      title: "Google Search",
      short_code: "gq001",
      is_public: 1,
    });

    createLinkScoped({
      user_id: 1,
      url: "https://bun.sh",
      title: "Bun Runtime",
      short_code: "gq002",
      is_public: 1,
    });

    const results = getLinksVisibleToActor({
      q: "google",
      sort: "recent",
      limit: 10,
      offset: 0,
      owner_user_id: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(googleLink.id);
  });

  test("createLinkScoped preserves conflict and foreign key signals", () => {
    createLinkScoped({
      user_id: 1,
      url: "https://dup.example.com",
      title: "dup",
      short_code: "dup01",
    });

    expect(() => {
      createLinkScoped({
        user_id: 1,
        url: "https://dup.example.com",
        title: "dup2",
        short_code: "dup02",
      });
    }).toThrow("UNIQUE constraint failed: links.user_id, links.url");

    expect(() => {
      createLinkScoped({
        user_id: 1,
        url: "https://fk.example.com",
        title: "fk",
        short_code: "fk01",
        category_id: 999,
      });
    }).toThrow("FOREIGN KEY constraint failed");
  });

  test("toggleLikeAndGetSnapshot flips state with conflict-safe writes", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://like-toggle.example.com",
      title: "like-toggle",
      short_code: "lks001",
      is_public: 1,
    });

    const first = toggleLikeAndGetSnapshot(2, link.id);
    expect(first).not.toBeNull();
    expect(first?.liked_by_me).toBe(true);
    expect(first?.likes_count).toBe(1);
    expect(first?.favorited_by_me).toBe(false);
    expect(first?.favorites_count).toBe(0);

    const second = toggleLikeAndGetSnapshot(2, link.id);
    expect(second).not.toBeNull();
    expect(second?.liked_by_me).toBe(false);
    expect(second?.likes_count).toBe(0);

    const third = toggleLikeAndGetSnapshot(2, link.id);
    expect(third?.liked_by_me).toBe(true);
    expect(third?.likes_count).toBe(1);
  });

  test("toggleFavoriteAndGetSnapshot scopes mutation to actor-link pair", () => {
    const link = createLinkScoped({
      user_id: 1,
      url: "https://favorite-toggle.example.com",
      title: "favorite-toggle",
      short_code: "fav001",
      is_public: 1,
    });

    testDb.run("INSERT INTO favorites (user_id, link_id) VALUES (3, ?)", [link.id]);

    const first = toggleFavoriteAndGetSnapshot(2, link.id);
    expect(first).not.toBeNull();
    expect(first?.favorited_by_me).toBe(true);
    expect(first?.favorites_count).toBe(2);
    expect(first?.liked_by_me).toBe(false);
    expect(first?.likes_count).toBe(0);

    const second = toggleFavoriteAndGetSnapshot(2, link.id);
    expect(second).not.toBeNull();
    expect(second?.favorited_by_me).toBe(false);
    expect(second?.favorites_count).toBe(1);
  });
});
