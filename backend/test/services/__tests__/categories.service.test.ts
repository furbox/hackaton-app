import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.js";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../categories.service.js";

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
      short_code TEXT UNIQUE NOT NULL,
      category_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      UNIQUE(user_id, url)
    )
  `);
}

function seedBaseData(): void {
  testDb.run("INSERT INTO users (id, username) VALUES (1, 'owner')");
  testDb.run("INSERT INTO users (id, username) VALUES (2, 'other')");
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
  testDb.run("DELETE FROM categories");
  testDb.run("DELETE FROM users");
  seedBaseData();
});

describe("categories.service core CRUD", () => {
  test("createCategory requires auth and validates input", () => {
    const unauthorized = createCategory(null, {
      name: "Tech",
      color: "#6366f1",
    });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    const missingName = createCategory({ userId: 1 }, {
      name: "",
      color: "#6366f1",
    });
    expect(missingName.ok).toBe(false);
    if (!missingName.ok) {
      expect(missingName.error.code).toBe("VALIDATION_ERROR");
    }

    const invalidColor = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "red",
    });
    expect(invalidColor.ok).toBe(false);
    if (!invalidColor.ok) {
      expect(invalidColor.error.code).toBe("VALIDATION_ERROR");
    }

    const invalidColorShort = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#fff",
    });
    expect(invalidColorShort.ok).toBe(false);
    if (!invalidColorShort.ok) {
      expect(invalidColorShort.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("createCategory enforces per-user name uniqueness", () => {
    const created = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#6366f1",
    });
    expect(created.ok).toBe(true);

    const duplicate = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#8b5cf6",
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe("CONFLICT");
    }

    // Same name allowed across users
    const otherUser = createCategory({ userId: 2 }, {
      name: "Tech",
      color: "#ec4899",
    });
    expect(otherUser.ok).toBe(true);
  });

  test("getCategories requires auth and returns list with links count", () => {
    const unauthorized = getCategories(null);
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    // Create categories
    const cat1 = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#6366f1",
    });
    const cat2 = createCategory({ userId: 1 }, {
      name: "Design",
      color: "#8b5cf6",
    });
    if (!cat1.ok || !cat2.ok) throw new Error("seed failed");

    // Add some links to categories
    testDb.run(`
      INSERT INTO links (user_id, url, title, short_code, category_id)
      VALUES (1, 'https://example.com', 'Example', 'ex1', ?)
    `, [cat1.data.id]);
    testDb.run(`
      INSERT INTO links (user_id, url, title, short_code, category_id)
      VALUES (1, 'https://example2.com', 'Example2', 'ex2', ?)
    `, [cat1.data.id]);

    const result = getCategories({ userId: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      const tech = result.data.find((c) => c.name === "Tech");
      const design = result.data.find((c) => c.name === "Design");
      expect(tech?.linksCount).toBe(2); // Tech has 2 links
      expect(design?.linksCount).toBe(0); // Design has 0 links
    }
  });

  test("getCategoryById enforces ownership policy", () => {
    const created = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#6366f1",
    });
    if (!created.ok) throw new Error("seed failed");

    const unauthorized = getCategoryById(null, { id: created.data.id });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    const forbidden = getCategoryById({ userId: 2 }, { id: created.data.id });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe("FORBIDDEN");
    }

    const success = getCategoryById({ userId: 1 }, { id: created.data.id });
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.data.id).toBe(created.data.id);
      expect(success.data.name).toBe("Tech");
    }
  });

  test("getCategoryById returns NOT_FOUND for non-existent category", () => {
    const result = getCategoryById({ userId: 1 }, { id: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  test("updateCategory enforces ownership and validates input", () => {
    const created = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#6366f1",
    });
    if (!created.ok) throw new Error("seed failed");

    const unauthorized = updateCategory(null, {
      id: created.data.id,
      patch: { color: "#8b5cf6" },
    });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    const forbidden = updateCategory({ userId: 2 }, {
      id: created.data.id,
      patch: { color: "#8b5cf6" },
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe("FORBIDDEN");
    }

    const invalidColor = updateCategory({ userId: 1 }, {
      id: created.data.id,
      patch: { color: "red" },
    });
    expect(invalidColor.ok).toBe(false);
    if (!invalidColor.ok) {
      expect(invalidColor.error.code).toBe("VALIDATION_ERROR");
    }

    const emptyPatch = updateCategory({ userId: 1 }, {
      id: created.data.id,
      patch: {},
    });
    expect(emptyPatch.ok).toBe(false);
    if (!emptyPatch.ok) {
      expect(emptyPatch.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("updateCategory supports partial updates and detects name conflicts", () => {
    const cat1 = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#6366f1",
    });
    const cat2 = createCategory({ userId: 1 }, {
      name: "Design",
      color: "#8b5cf6",
    });
    if (!cat1.ok || !cat2.ok) throw new Error("seed failed");

    // Partial update - color only
    const colorUpdate = updateCategory({ userId: 1 }, {
      id: cat1.data.id,
      patch: { color: "#ec4899" },
    });
    expect(colorUpdate.ok).toBe(true);
    if (colorUpdate.ok) {
      expect(colorUpdate.data.color).toBe("#ec4899");
      expect(colorUpdate.data.name).toBe("Tech"); // name unchanged
    }

    // Name conflict
    const conflict = updateCategory({ userId: 1 }, {
      id: cat1.data.id,
      patch: { name: "Design" },
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.code).toBe("CONFLICT");
    }
  });

  test("deleteCategory enforces ownership and sets links category_id to NULL", () => {
    const cat = createCategory({ userId: 1 }, {
      name: "Tech",
      color: "#6366f1",
    });
    if (!cat.ok) throw new Error("seed failed");

    // Add links to category
    testDb.run(`
      INSERT INTO links (user_id, url, title, short_code, category_id)
      VALUES (1, 'https://example.com', 'Example', 'ex1', ?)
    `, [cat.data.id]);
    testDb.run(`
      INSERT INTO links (user_id, url, title, short_code, category_id)
      VALUES (1, 'https://example2.com', 'Example2', 'ex2', ?)
    `, [cat.data.id]);

    // Verify links have category_id set
    const before = testDb.query(`
      SELECT category_id FROM links WHERE category_id = ?
    `).all(cat.data.id);
    expect(before).toHaveLength(2);

    // Unauthorized
    const unauthorized = deleteCategory(null, { id: cat.data.id });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) {
      expect(unauthorized.error.code).toBe("UNAUTHORIZED");
    }

    // Forbidden
    const forbidden = deleteCategory({ userId: 2 }, { id: cat.data.id });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) {
      expect(forbidden.error.code).toBe("FORBIDDEN");
    }

    // Success
    const deleted = deleteCategory({ userId: 1 }, { id: cat.data.id });
    expect(deleted.ok).toBe(true);

    // Verify links have category_id set to NULL (ON DELETE SET NULL)
    const after = testDb.query(`
      SELECT category_id FROM links
    `).all();
    expect(after).toHaveLength(2);
    expect((after[0] as { category_id: number | null }).category_id).toBeNull();
    expect((after[1] as { category_id: number | null }).category_id).toBeNull();

    // Verify category is deleted
    const notFound = getCategoryById({ userId: 1 }, { id: cat.data.id });
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) {
      expect(notFound.error.code).toBe("NOT_FOUND");
    }
  });

  test("deleteCategory returns NOT_FOUND for non-existent category", () => {
    const result = deleteCategory({ userId: 1 }, { id: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
