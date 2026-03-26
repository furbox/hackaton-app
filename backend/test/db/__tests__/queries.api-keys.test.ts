import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { closeDatabase, setTestDatabase } from "../connection.js";
import {
  insertApiKey,
  getApiKeysByUser,
  getApiKeyOwnerById,
  getActiveApiKeyByHash,
  revokeApiKey,
  type ApiKey,
} from "../queries.js";

let testDb: Database;

function createSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      permissions TEXT DEFAULT 'read',
      last_used_at DATETIME,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
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
  testDb.run("DELETE FROM api_keys");
  testDb.run("DELETE FROM users");
  seedBaseData();
});

describe("insertApiKey", () => {
  test("inserts a new API key and returns the ID", () => {
    const keyHash = "hash123";
    const keyPrefix = "urlk_a1b2";
    const name = "Test Key";
    const permissions = "read+write";
    const userId = 1;

    const result = insertApiKey({
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      permissions,
      user_id: userId,
    });

    expect(result).toBeGreaterThan(0);

    // Verify it was inserted
    const row = testDb.query("SELECT * FROM api_keys WHERE id = ?").get(result) as ApiKey;
    expect(row).toBeDefined();
    expect(row.user_id).toBe(userId);
    expect(row.name).toBe(name);
    expect(row.key_hash).toBe(keyHash);
    expect(row.key_prefix).toBe(keyPrefix);
    expect(row.permissions).toBe(permissions);
    expect(row.is_active).toBe(1);
  });

  test("enforces UNIQUE constraint on (user_id, name)", () => {
    insertApiKey({
      key_hash: "hash1",
      key_prefix: "prefix1",
      name: "Dev Key",
      permissions: "read",
      user_id: 1,
    });

    expect(() =>
      insertApiKey({
        key_hash: "hash2",
        key_prefix: "prefix2",
        name: "Dev Key", // Same name for same user
        permissions: "read",
        user_id: 1,
      })
    ).toThrow();
  });
});

describe("getApiKeysByUser", () => {
  test("returns only active keys for the user", () => {
    // Insert keys for user 1
    insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Key 1",
      permissions: "read",
      user_id: 1,
    });
    insertApiKey({
      key_hash: "hash2",
      key_prefix: "urlk_bbb2",
      name: "Key 2",
      permissions: "read+write",
      user_id: 1,
    });

    // Insert key for user 2
    insertApiKey({
      key_hash: "hash3",
      key_prefix: "urlk_ccc3",
      name: "Other Key",
      permissions: "read",
      user_id: 2,
    });

    // Revoke one of user 1's keys
    testDb.run("UPDATE api_keys SET is_active = 0 WHERE name = 'Key 2'");

    const keys = getApiKeysByUser(1);

    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe("Key 1");
    expect(keys[0].key_prefix).toBe("urlk_aaa1");
    expect(keys[0].permissions).toBe("read");
    expect(keys[0].is_active).toBe(1);
  });

  test("returns empty array for user with no keys", () => {
    const keys = getApiKeysByUser(999);
    expect(keys).toEqual([]);
  });

  test("excludes key_hash from results for security", () => {
    insertApiKey({
      key_hash: "secret_hash",
      key_prefix: "urlk_xxx",
      name: "My Key",
      permissions: "read",
      user_id: 1,
    });

    const keys = getApiKeysByUser(1);
    expect(keys[0]).not.toHaveProperty("key_hash");
  });
});

describe("getApiKeyOwnerById", () => {
  test("returns owner record for valid key", () => {
    const keyId = insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read",
      user_id: 1,
    });

    const owner = getApiKeyOwnerById(keyId);

    expect(owner).toBeDefined();
    expect(owner!.id).toBe(keyId);
    expect(owner!.user_id).toBe(1);
  });

  test("returns null for non-existent key", () => {
    const owner = getApiKeyOwnerById(99999);
    expect(owner).toBeNull();
  });
});

describe("revokeApiKey", () => {
  test("sets is_active = 0 for the key and returns changes count", () => {
    const keyId = insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read",
      user_id: 1,
    });

    const result = revokeApiKey(keyId, 1);

    expect(result.changes).toBe(1);

    // Verify it was revoked
    const row = testDb.query("SELECT is_active FROM api_keys WHERE id = ?").get(keyId) as { is_active: number };
    expect(row.is_active).toBe(0);
  });

  test("returns 0 changes when key not found", () => {
    const result = revokeApiKey(99999, 1);
    expect(result.changes).toBe(0);
  });

  test("returns 0 changes when key belongs to different user", () => {
    const keyId = insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read",
      user_id: 1,
    });

    const result = revokeApiKey(keyId, 2); // Wrong user

    expect(result.changes).toBe(0);

    // Verify key is still active
    const row = testDb.query("SELECT is_active FROM api_keys WHERE id = ?").get(keyId) as { is_active: number };
    expect(row.is_active).toBe(1);
  });

  test("preserves the row for audit trail", () => {
    const keyId = insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read",
      user_id: 1,
    });

    revokeApiKey(keyId, 1);

    // Row should still exist, just inactive
    const row = testDb.query("SELECT * FROM api_keys WHERE id = ?").get(keyId);
    expect(row).toBeDefined();
  });
});

describe("getActiveApiKeyByHash", () => {
  test("returns active key auth record when hash exists", () => {
    insertApiKey({
      key_hash: "hash_active",
      key_prefix: "urlk_live1",
      name: "Live Key",
      permissions: "read+write",
      user_id: 1,
    });

    const record = getActiveApiKeyByHash("hash_active");

    expect(record).toBeDefined();
    expect(record!.user_id).toBe(1);
    expect(record!.permissions).toBe("read+write");
    expect(record!.key_prefix).toBe("urlk_live1");
  });

  test("returns null for revoked key", () => {
    const keyId = insertApiKey({
      key_hash: "hash_revoked",
      key_prefix: "urlk_dead1",
      name: "Dead Key",
      permissions: "read",
      user_id: 1,
    });

    revokeApiKey(keyId, 1);

    const record = getActiveApiKeyByHash("hash_revoked");
    expect(record).toBeNull();
  });

  test("returns null when hash does not exist", () => {
    const record = getActiveApiKeyByHash("missing_hash");
    expect(record).toBeNull();
  });
});
