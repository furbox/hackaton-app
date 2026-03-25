import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { setTestDatabase } from "../../db/connection.js";
import {
  generateApiKey,
  extractKeyPrefix,
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from "../api-keys.service.js";
import { insertApiKey, getApiKeysByUser } from "../../db/queries/index.js";

let testDb: Database;

function setupTestDb() {
  testDb = new Database(":memory:");
  testDb.run("PRAGMA foreign_keys = ON;");

  // Create schema
  testDb.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL
    )
  `);
  testDb.run(`
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
  testDb.run(`
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed user
  testDb.run("INSERT INTO users (id, username) VALUES (1, 'testuser')");

  setTestDatabase(testDb);
}

function cleanupTestDb() {
  testDb.close();
}

// Setup before first test
setupTestDb();

// Clean and reset between tests
beforeEach(() => {
  cleanupTestDb();
  setupTestDb();
});

describe("generateApiKey", () => {
  test("generates key with format urlk_{64-hex-chars}", () => {
    const key = generateApiKey();

    expect(key).toMatch(/^urlk_[0-9a-f]{64}$/);
    expect(key.length).toBe(69); // "urlk_" (5) + 64 hex chars
  });

  test("generates unique keys", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    expect(key1).not.toBe(key2);
  });

  test("uses API_KEY_PREFIX from env when configured", () => {
    const previousPrefix = process.env.API_KEY_PREFIX;
    process.env.API_KEY_PREFIX = "mykey";

    try {
      const key = generateApiKey();
      expect(key).toMatch(/^mykey_[0-9a-f]{64}$/);
      expect(extractKeyPrefix(key)).toBe(key.slice(0, "mykey_".length + 8));
    } finally {
      if (previousPrefix === undefined) {
        delete process.env.API_KEY_PREFIX;
      } else {
        process.env.API_KEY_PREFIX = previousPrefix;
      }
    }
  });

  test("falls back to urlk prefix when API_KEY_PREFIX is empty", () => {
    const previousPrefix = process.env.API_KEY_PREFIX;
    process.env.API_KEY_PREFIX = "   ";

    try {
      const key = generateApiKey();
      expect(key).toMatch(/^urlk_[0-9a-f]{64}$/);
    } finally {
      if (previousPrefix === undefined) {
        delete process.env.API_KEY_PREFIX;
      } else {
        process.env.API_KEY_PREFIX = previousPrefix;
      }
    }
  });

  test("SHA-256 hash is reproducible for same key", async () => {
    const key = generateApiKey();

    // Use Bun.password.hash with SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Hash again - should be same
    const encoder2 = new TextEncoder();
    const data2 = encoder2.encode(key);
    const hashBuffer2 = await crypto.subtle.digest("SHA-256", data2);
    const hashArray2 = Array.from(new Uint8Array(hashBuffer2));
    const hashHex2 = hashArray2.map(b => b.toString(16).padStart(2, "0")).join("");

    expect(hashHex).toBe(hashHex2);
  });
});

describe("listApiKeys", () => {
  test("returns user's active keys without raw key or hash", () => {
    const actor = { userId: 1 };

    // Insert a key
    insertApiKey({
      key_hash: "secret_hash",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read+write",
      user_id: 1,
    });

    const result = listApiKeys(actor);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      const key = result.data[0];
      expect(key.name).toBe("Test Key");
      expect(key.key_prefix).toBe("urlk_aaa1");
      expect(key.permissions).toBe("read+write");
      expect(key).not.toHaveProperty("key_hash");
      expect(key).not.toHaveProperty("raw_key");
    }
  });

  test("returns empty array for user with no keys", () => {
    const actor = { userId: 1 };
    const result = listApiKeys(actor);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  test("returns UNAUTHORIZED for unauthenticated actor", () => {
    const actor = null;
    const result = listApiKeys(actor);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("createApiKey", () => {
  test("creates key with valid permissions", async () => {
    const actor = { userId: 1 };
    const input = {
      name: "Claude Desktop",
      permissions: "read+write" as const,
    };

    const result = await createApiKey(actor, input, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("Claude Desktop");
      expect(result.data.permissions).toBe("read+write");
      expect(result.data.raw_key).toMatch(/^urlk_[0-9a-f]{64}$/);
      expect(result.data.key_prefix).toBe(result.data.raw_key.slice(0, 13)); // "urlk_" + first 8 hex chars
    }
  });

  test("rejects invalid permissions", async () => {
    const actor = { userId: 1 };
    const input = {
      name: "Test Key",
      permissions: "admin" as "read" | "read+write",
    };

    const result = await createApiKey(actor, input, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toContain("permissions");
    }
  });

  test("detects duplicate name for same user", async () => {
    const actor = { userId: 1 };

    // Insert existing key
    insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Dev Key",
      permissions: "read",
      user_id: 1,
    });

    const input = {
      name: "Dev Key", // Duplicate
      permissions: "read" as const,
    };

    const result = await createApiKey(actor, input, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.message).toContain("already exists");
    }
  });

  test("returns UNAUTHORIZED for unauthenticated actor", async () => {
    const actor = null;
    const input = {
      name: "Test Key",
      permissions: "read" as const,
    };

    const result = await createApiKey(actor, input, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("revokeApiKey", () => {
  test("revokes owned key successfully", async () => {
    const actor = { userId: 1 };

    // Insert a key
    const keyId = insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read",
      user_id: 1,
    });

    const result = await revokeApiKey(actor, { id: keyId }, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ revoked: true });
    }
  });

  test("returns FORBIDDEN when revoking another user's key", async () => {
    // Create key for user 1
    const keyId = insertApiKey({
      key_hash: "hash1",
      key_prefix: "urlk_aaa1",
      name: "Test Key",
      permissions: "read",
      user_id: 1,
    });

    // Try to revoke as user 999
    const actor = { userId: 999 };
    const result = await revokeApiKey(actor, { id: keyId }, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("returns NOT_FOUND for non-existent key", async () => {
    const actor = { userId: 1 };
    const result = await revokeApiKey(actor, { id: 99999 }, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("API key not found");
    }
  });

  test("returns UNAUTHORIZED for unauthenticated actor", async () => {
    const actor = null;
    const result = await revokeApiKey(actor, { id: 1 }, "127.0.0.1", "test-agent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
    }
  });
});
