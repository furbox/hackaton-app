import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import {
  createLink,
  deleteLink,
  getLinkById,
  getLinks,
  previewLink,
  toggleFavorite,
  toggleLike,
  updateLink,
} from "../links.service.js";

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

describe("links.service core CRUD", () => {
  test("createLink requires auth and validates input", () => {
    const unauthorized = createLink(null, {
      url: "https://example.com",
      title: "Example",
      shortCode: "unauth1",
    });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    const invalid = createLink({ userId: 1 }, {
      url: "notaurl",
      title: "Example",
      shortCode: "badurl1",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("createLink maps duplicate and FK errors deterministically", () => {
    const created = createLink({ userId: 1 }, {
      url: "https://dup.example.com",
      title: "dup",
      shortCode: "dup111",
      categoryId: 10,
    });
    expect(created.ok).toBe(true);

    const duplicate = createLink({ userId: 1 }, {
      url: "https://dup.example.com",
      title: "dup2",
      shortCode: "dup112",
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe("CONFLICT");
    }

    const badCategory = createLink({ userId: 1 }, {
      url: "https://fk.example.com",
      title: "fk",
      shortCode: "fk111",
      categoryId: 999,
    });
    expect(badCategory.ok).toBe(false);
    if (!badCategory.ok) {
      expect(badCategory.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("getLinkById prevents private resource leakage", () => {
    const pub = createLink({ userId: 1 }, {
      url: "https://public.example.com",
      title: "public",
      shortCode: "pub111",
      isPublic: true,
    });
    const pri = createLink({ userId: 1 }, {
      url: "https://private.example.com",
      title: "private",
      shortCode: "pri111",
      isPublic: false,
    });

    if (!pub.ok || !pri.ok) throw new Error("seed failed");

    const publicRead = getLinkById(null, pub.data.id);
    expect(publicRead.ok).toBe(true);

    const privateReadAnon = getLinkById(null, pri.data.id);
    expect(privateReadAnon.ok).toBe(false);
    if (!privateReadAnon.ok) {
      expect(privateReadAnon.error.code).toBe("NOT_FOUND");
    }

    const privateReadNonOwner = getLinkById({ userId: 2 }, pri.data.id);
    expect(privateReadNonOwner.ok).toBe(false);
    if (!privateReadNonOwner.ok) {
      expect(privateReadNonOwner.error.code).toBe("NOT_FOUND");
    }

    const privateReadOwner = getLinkById({ userId: 1 }, pri.data.id);
    expect(privateReadOwner.ok).toBe(true);
  });

  test("getLinks normalizes page/limit/sort defaults", () => {
    const created = createLink({ userId: 1 }, {
      url: "https://norm.example.com",
      title: "norm",
      shortCode: "nor111",
    });
    if (!created.ok) throw new Error("seed failed");

    const listed = getLinks(null, {
      ownerUserId: 1,
      page: 0,
      limit: 999,
      sort: "unknown",
    });

    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.data.page).toBe(1);
      expect(listed.data.limit).toBe(100);
      expect(listed.data.sort).toBe("recent");
      expect(Array.isArray(listed.data.items)).toBe(true);
    }
  });

  test("updateLink enforces owner policy and returns deterministic codes", () => {
    const created = createLink({ userId: 1 }, {
      url: "https://update.example.com",
      title: "before",
      shortCode: "upd111",
    });
    if (!created.ok) throw new Error("seed failed");

    const unauthorized = updateLink(null, {
      id: created.data.id,
      patch: { title: "x" },
    });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    const forbidden = updateLink({ userId: 2 }, {
      id: created.data.id,
      patch: { title: "x" },
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe("FORBIDDEN");
    }

    const success = updateLink({ userId: 1 }, {
      id: created.data.id,
      patch: { title: "after", description: null },
    });
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.data.title).toBe("after");
    }
  });

  test("deleteLink enforces owner policy and deletes owned links", () => {
    const created = createLink({ userId: 1 }, {
      url: "https://delete.example.com",
      title: "delete",
      shortCode: "del111",
    });
    if (!created.ok) throw new Error("seed failed");

    const forbidden = deleteLink({ userId: 2 }, { id: created.data.id });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe("FORBIDDEN");
    }

    const success = deleteLink({ userId: 1 }, { id: created.data.id });
    expect(success.ok).toBe(true);

    const missing = getLinkById({ userId: 1 }, created.data.id);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("NOT_FOUND");
    }
  });

  test("toggleLike and toggleFavorite enforce auth/id/visibility guards", () => {
    const unauthorizedLike = toggleLike(null, 1);
    expect(unauthorizedLike.ok).toBe(false);
    if (!unauthorizedLike.ok) {
      expect(unauthorizedLike.error.code).toBe("UNAUTHORIZED");
    }

    const invalidFavorite = toggleFavorite({ userId: 1 }, 0);
    expect(invalidFavorite.ok).toBe(false);
    if (!invalidFavorite.ok) {
      expect(invalidFavorite.error.code).toBe("VALIDATION_ERROR");
    }

    const privateLink = createLink({ userId: 1 }, {
      url: "https://private-toggle.example.com",
      title: "private",
      shortCode: "tpri11",
      isPublic: false,
    });
    if (!privateLink.ok) throw new Error("seed failed");

    const hidden = toggleLike({ userId: 2 }, privateLink.data.id);
    expect(hidden.ok).toBe(false);
    if (!hidden.ok) {
      expect(hidden.error.code).toBe("NOT_FOUND");
    }

    const hiddenFavorite = toggleFavorite({ userId: 2 }, privateLink.data.id);
    expect(hiddenFavorite.ok).toBe(false);
    if (!hiddenFavorite.ok) {
      expect(hiddenFavorite.error.code).toBe("NOT_FOUND");
    }
  });

  test("toggle interactions return persisted snapshot transitions", () => {
    const publicLink = createLink({ userId: 1 }, {
      url: "https://toggle.example.com",
      title: "toggle",
      shortCode: "tgl111",
      isPublic: true,
    });
    if (!publicLink.ok) throw new Error("seed failed");

    const likeOn = toggleLike({ userId: 2 }, publicLink.data.id);
    expect(likeOn.ok).toBe(true);
    if (likeOn.ok) {
      expect(likeOn.data.link_id).toBe(publicLink.data.id);
      expect(likeOn.data.liked_by_me).toBe(true);
      expect(likeOn.data.favorited_by_me).toBe(false);
      expect(likeOn.data.likes_count).toBe(1);
      expect(likeOn.data.favorites_count).toBe(0);
    }

    const likeOff = toggleLike({ userId: 2 }, publicLink.data.id);
    expect(likeOff.ok).toBe(true);
    if (likeOff.ok) {
      expect(likeOff.data.liked_by_me).toBe(false);
      expect(likeOff.data.likes_count).toBe(0);
    }

    const favoriteOn = toggleFavorite({ userId: 2 }, publicLink.data.id);
    expect(favoriteOn.ok).toBe(true);
    if (favoriteOn.ok) {
      expect(favoriteOn.data.favorited_by_me).toBe(true);
      expect(favoriteOn.data.favorites_count).toBe(1);
      expect(typeof favoriteOn.data.liked_by_me).toBe("boolean");
      expect(typeof favoriteOn.data.likes_count).toBe("number");
    }
  });
});

describe("links.service previewLink", () => {
  test("rejects invalid absolute urls with deterministic validation reason", async () => {
    const result = await previewLink({ url: "notaurl" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.details).toEqual({ reason: "INVALID_URL" });
    }
  });

  test("returns deterministic payload shape with nullable fields", async () => {
    const result = await previewLink(
      { url: "https://example.com" },
      {
        extractMetadata: async () => ({
          ok: true,
          data: {
            title: "Example",
            description: null,
            image: null,
          },
        }),
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data).sort()).toEqual(["description", "image", "title"]);
      expect(result.data).toEqual({
        title: "Example",
        description: null,
        image: null,
      });
    }
  });

  test("maps helper failures to INTERNAL with stable reason", async () => {
    const timeout = await previewLink(
      { url: "https://example.com" },
      {
        extractMetadata: async () => ({ ok: false, reason: "TIMEOUT" }),
      }
    );
    const fetchFailed = await previewLink(
      { url: "https://example.com" },
      {
        extractMetadata: async () => ({ ok: false, reason: "FETCH_FAILED" }),
      }
    );

    expect(timeout.ok).toBe(false);
    if (!timeout.ok) {
      expect(timeout.error.code).toBe("INTERNAL");
      expect(timeout.error.details).toEqual({ reason: "TIMEOUT" });
    }

    expect(fetchFailed.ok).toBe(false);
    if (!fetchFailed.ok) {
      expect(fetchFailed.error.code).toBe("INTERNAL");
      expect(fetchFailed.error.details).toEqual({ reason: "FETCH_FAILED" });
    }
  });

  test("does not persist preview side effects in links table", async () => {
    const seeded = createLink({ userId: 1 }, {
      url: "https://existing.example.com",
      title: "existing",
      shortCode: "prv111",
      description: null,
    });
    if (!seeded.ok) throw new Error("seed failed");

    const before = testDb
      .query("SELECT COUNT(*) as total FROM links")
      .get() as { total: number };

    const success = await previewLink(
      { url: "https://example.com" },
      {
        extractMetadata: async () => ({
          ok: true,
          data: { title: "Example", description: "desc", image: null },
        }),
      }
    );

    const timeout = await previewLink(
      { url: "https://example.com" },
      {
        extractMetadata: async () => ({ ok: false, reason: "TIMEOUT" }),
      }
    );

    expect(success.ok).toBe(true);
    expect(timeout.ok).toBe(false);

    const after = testDb
      .query("SELECT COUNT(*) as total FROM links")
      .get() as { total: number };
    expect(after.total).toBe(before.total);
  });
});
