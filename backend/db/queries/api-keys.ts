/**
 * API Key Queries
 *
 * Covers: api_keys table — create, list, ownership-check, and soft-revoke.
 *
 * @module backend/db/queries/api-keys
 */

import { getDatabase } from "../../db/connection.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Represents an API key record from the database.
 */
export interface ApiKey {
  id: number;
  user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string; // 'read' | 'read+write'
  last_used_at: string | null;
  expires_at: string | null;
  is_active: number; // 0 or 1 (SQLite BOOLEAN)
  created_at: string;
}

/**
 * Parameters for creating a new API key.
 */
export interface CreateApiKeyParams {
  user_id: number;
  key_hash: string;
  key_prefix: string;
  name: string;
  permissions: string;
}

/**
 * API key owner record for ownership checks.
 */
export interface ApiKeyOwnerRecord {
  id: number;
  user_id: number;
}

/**
 * Active API key record used for bearer-key authentication.
 */
export interface ActiveApiKeyRecord {
  id: number;
  user_id: number;
  permissions: "read" | "read+write";
  key_prefix: string;
  expires_at: string | null;
}

/**
 * Result of an API key mutation operation.
 */
export interface ApiKeyMutationResult {
  changes: number;
}

// ============================================================================
// PREPARED STATEMENT FACTORIES
// ============================================================================

const getDb = () => getDatabase();

const insertApiKeyStmt = () => getDb().prepare(`
  INSERT INTO api_keys (user_id, key_hash, key_prefix, name, permissions)
  VALUES (?, ?, ?, ?, ?)
`);

const getApiKeysByUserStmt = () => getDb().prepare(`
  SELECT
    id,
    user_id,
    name,
    key_prefix,
    permissions,
    last_used_at,
    expires_at,
    is_active,
    created_at
  FROM api_keys
  WHERE user_id = ? AND is_active = 1
  ORDER BY created_at DESC
`);

const getApiKeyOwnerByIdStmt = () => getDb().prepare(`
  SELECT id, user_id FROM api_keys WHERE id = ?
`);

const revokeApiKeyStmt = () => getDb().prepare(`
  UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?
`);

const getActiveApiKeyByHashStmt = () => getDb().prepare(`
  SELECT id, user_id, permissions, key_prefix, expires_at
  FROM api_keys
  WHERE key_hash = ? AND is_active = 1
  LIMIT 1
`);

// ============================================================================
// API KEY QUERIES
// ============================================================================

/**
 * Creates a new API key for a user.
 *
 * @param params - API key creation parameters
 * @returns The created key record's ID
 *
 * @example
 * ```typescript
 * const keyId = insertApiKey({
 *   user_id: 123,
 *   key_hash: "abc123...",
 *   key_prefix: "urlk_a1b2",
 *   name: "Claude Desktop",
 *   permissions: "read+write"
 * });
 * ```
 */
export function insertApiKey(params: CreateApiKeyParams): number {
  const stmt = insertApiKeyStmt();
  const result = stmt.run(
    params.user_id,
    params.key_hash,
    params.key_prefix,
    params.name,
    params.permissions
  );

  return Number(result.lastInsertRowid);
}

/**
 * Retrieves all active API keys for a user.
 *
 * Exposes key_prefix but NOT key_hash for security.
 *
 * @param userId - User's primary key ID
 * @returns Array of user's active API keys ordered by creation date (newest first)
 *
 * @example
 * ```typescript
 * const keys = getApiKeysByUser(123);
 * keys.forEach(key => {
 *   console.log(`${key.name}: ${key.key_prefix}`);
 * });
 * ```
 */
export function getApiKeysByUser(userId: number): Omit<ApiKey, "key_hash">[] {
  const stmt = getApiKeysByUserStmt();
  return stmt.all(userId) as Omit<ApiKey, "key_hash">[];
}

/**
 * Retrieves API key owner record for ownership checks.
 *
 * @param id - API key's primary key ID
 * @returns API key owner record (id, user_id) or null if not found
 *
 * @example
 * ```typescript
 * const owner = getApiKeyOwnerById(7);
 * if (owner && owner.user_id === currentUserId) {
 *   // User owns this key
 * }
 * ```
 */
export function getApiKeyOwnerById(id: number): ApiKeyOwnerRecord | null {
  const stmt = getApiKeyOwnerByIdStmt();
  return stmt.get(id) as ApiKeyOwnerRecord | null;
}

/**
 * Revokes an API key by soft delete (ownership-guarded).
 *
 * Sets `is_active = 0` only if the key exists and belongs to the user.
 * Returns the number of rows changed (0 if key not found or not owned).
 *
 * @param keyId - API key's primary key ID
 * @param ownerUserId - User ID who must own the key
 * @returns Mutation result with changes count
 *
 * @example
 * ```typescript
 * const result = revokeApiKey(7, 123);
 * if (result.changes === 1) {
 *   console.log("API key revoked");
 * } else {
 *   console.log("Not found or not owned");
 * }
 * ```
 */
export function revokeApiKey(keyId: number, ownerUserId: number): ApiKeyMutationResult {
  const stmt = revokeApiKeyStmt();
  const result = stmt.run(keyId, ownerUserId);

  return { changes: result.changes };
}

/**
 * Retrieves an active API key by its SHA-256 hash.
 *
 * Used by bearer-key auth flows (MCP/Web Skill) to resolve the actor context
 * without exposing raw keys in persistence.
 *
 * @param keyHash - Hex-encoded SHA-256 hash of the raw API key
 * @returns Active API key auth record or null when not found
 */
export function getActiveApiKeyByHash(keyHash: string): ActiveApiKeyRecord | null {
  const stmt = getActiveApiKeyByHashStmt();
  return stmt.get(keyHash) as ActiveApiKeyRecord | null;
}
