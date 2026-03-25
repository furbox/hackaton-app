import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../../db/connection.ts";
import { createLink } from "../../../services/links.service.ts";
import { _setWorkerPoolForTests } from "../../../workers/pool.ts";
import { WorkerMessageType } from "../../../workers/types.ts";

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

beforeAll(() => {
  testDb = new Database(":memory:");
  createSchema(testDb);
  setTestDatabase(testDb);
});

beforeEach(() => {
  testDb.run("DELETE FROM links");
  testDb.run("DELETE FROM categories");
  testDb.run("DELETE FROM users");
  testDb.run("INSERT INTO users (id, username) VALUES (1, 'owner')");
});

afterEach(() => {
  _setWorkerPoolForTests(null);
});

describe("workers integration with links.service createLink", () => {
  test("dispatches HEALTH_CHECK, READER_MODE, and WAYBACK jobs fire-and-forget", () => {
    const dispatch = mock(() => undefined);
    _setWorkerPoolForTests({ dispatch } as unknown as import("../../../workers/pool.ts").WorkerPool);

    const created = createLink({ userId: 1 }, {
      url: "https://workers.example.com",
      title: "Workers",
      shortCode: "wrk111",
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.url).toBe("https://workers.example.com");
      expect(created.data.title).toBe("Workers");
    }

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: WorkerMessageType.HEALTH_CHECK,
        payload: { linkId: created.ok ? created.data.id : -1, url: "https://workers.example.com" },
      })
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: WorkerMessageType.READER_MODE,
        payload: { linkId: created.ok ? created.data.id : -1, url: "https://workers.example.com" },
      })
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: WorkerMessageType.WAYBACK,
        payload: { linkId: created.ok ? created.data.id : -1, url: "https://workers.example.com" },
      })
    );
  });

  test("skips dispatch safely when worker pool is not initialized", () => {
    const created = createLink({ userId: 1 }, {
      url: "https://no-pool.example.com",
      title: "No pool",
      shortCode: "np1111",
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.data.url).toBe("https://no-pool.example.com");
    }
  });
});

afterAll(() => {
  closeDatabase();
});
