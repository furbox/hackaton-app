/**
 * API Keys Service — Phase 4.9
 *
 * CRUD operations for API key management with cryptographic key generation,
 * ownership enforcement, and audit logging.
 *
 * @module backend/services/api-keys.service
 */

import type {
  ApiKeyDTO,
  ApiKeyCreationDTO,
  CreateApiKeyInput,
  RevokeApiKeyInput,
  ListApiKeysOutput,
  CreateApiKeyOutput,
  RevokeApiKeyOutput,
} from "../contracts/api-keys.js";
import type {
  Phase4ServiceError,
  Phase4ServiceResult,
} from "../contracts/service-error.js";
import {
  getApiKeysByUser as dbGetApiKeysByUser,
  getApiKeyOwnerById,
  insertApiKey,
  revokeApiKey as dbRevokeApiKey,
  type ApiKey as DbApiKey,
} from "../db/queries/index.js";
import { createAuditLog } from "./audit-log.service.js";

export type ServiceActor = { userId: number } | null;

const DEFAULT_API_KEY_PREFIX = "urlk";

function getApiKeyPrefix(): string {
  const envPrefix = process.env.API_KEY_PREFIX?.trim();
  if (!envPrefix) {
    return DEFAULT_API_KEY_PREFIX;
  }
  return envPrefix;
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generates a cryptographically secure API key.
 *
 * Format: `{API_KEY_PREFIX}_{64-hex-chars}` (256-bit entropy)
 * Defaults to `urlk` prefix when env var is not set.
 *
 * @returns Generated API key
 *
 * @example
 * ```typescript
 * const key = generateApiKey();
 * // "urlk_a1b2c3d4e5f6..."
 * ```
 */
export function generateApiKey(): string {
  const configuredPrefix = getApiKeyPrefix();

  // Generate 32 cryptographically secure random bytes (256 bits)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));

  // Convert to hex string (64 characters)
  const hexChars = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Add prefix
  return `${configuredPrefix}_${hexChars}`;
}

/**
 * Computes SHA-256 hash of an API key for storage.
 *
 * @param key - Raw API key
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const hash = await hashApiKey("urlk_a1b2...");
 * // "9f86d081884c7d65..."
 * ```
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extracts the key prefix (first 8 characters after "urlk_").
 *
 * Used for display in UI and identifying keys without exposing the full key.
 *
 * @param key - Raw API key
 * @returns Key prefix (e.g., "urlk_a1b2c3d4")
 *
 * @example
 * ```typescript
 * const prefix = extractKeyPrefix("urlk_a1b2c3d4e5f6...");
 * // "urlk_a1b2c3d4"
 * ```
 */
export function extractKeyPrefix(key: string): string {
  const configuredPrefix = getApiKeyPrefix();
  const prefixLength = `${configuredPrefix}_`.length + 8;
  return key.slice(0, prefixLength);
}

// ============================================================================
// SERVICE HELPERS
// ============================================================================

function ok<T>(data: T): Phase4ServiceResult<T> {
  return { ok: true, data };
}

function fail(code: Phase4ServiceError["code"], message: string): Phase4ServiceResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}

function isAuthenticatedActor(actor: ServiceActor): actor is NonNullable<ServiceActor> {
  return actor !== null;
}

function toApiKeyDTO(row: Omit<DbApiKey, "key_hash">): ApiKeyDTO {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    permissions: row.permissions,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    is_active: row.is_active === 1,
    created_at: row.created_at,
  };
}

function isValidPermissions(permissions: string): permissions is "read" | "read+write" {
  return permissions === "read" || permissions === "read+write";
}

// ============================================================================
// SERVICE OPERATIONS
// ============================================================================

/**
 * Lists all active API keys for the authenticated user.
 *
 * @param actor - Authenticated user context
 * @returns Service result with array of API key DTOs
 *
 * @example
 * ```typescript
 * const result = await listApiKeys({ userId: 123 });
 * if (result.ok) {
 *   console.log(result.data); // [{ id, name, key_prefix, ... }]
 * }
 * ```
 */
export function listApiKeys(
  actor: ServiceActor
): Phase4ServiceResult<ListApiKeysOutput> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  try {
    const rows = dbGetApiKeysByUser(actor.userId);

    return ok(rows.map(toApiKeyDTO));
  } catch {
    return fail("INTERNAL", "Failed to load API keys");
  }
}

/**
 * Creates a new API key for the authenticated user.
 *
 * Generates a cryptographically secure key, hashes it for storage,
 * and logs an audit event. The raw key is returned only once.
 *
 * @param actor - Authenticated user context
 * @param input - Key creation parameters
 * @param ipAddress - Request IP address for audit log
 * @param userAgent - Request user agent for audit log
 * @returns Service result with API key creation DTO (includes raw key)
 *
 * @example
 * ```typescript
 * const result = await createApiKey(
 *   { userId: 123 },
 *   { name: "Claude Desktop", permissions: "read+write" },
 *   "127.0.0.1",
 *   "Mozilla/5.0..."
 * );
 * if (result.ok) {
 *   console.log(result.data.raw_key); // Show this to user ONCE
 * }
 * ```
 */
export async function createApiKey(
  actor: ServiceActor,
  input: CreateApiKeyInput,
  ipAddress: string,
  userAgent: string
): Promise<Phase4ServiceResult<CreateApiKeyOutput>> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  const trimmedName = input.name.trim();

  if (!trimmedName) {
    return fail("VALIDATION_ERROR", "name cannot be empty");
  }

  if (!isValidPermissions(input.permissions)) {
    return fail(
      "VALIDATION_ERROR",
      "permissions must be either 'read' or 'read+write'"
    );
  }

  try {
    // Check for duplicate name
    const existingKeys = dbGetApiKeysByUser(actor.userId);
    const nameExists = existingKeys.some((key) => key.name === trimmedName);

    if (nameExists) {
      return fail("CONFLICT", "API key with this name already exists");
    }

    // Generate key
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = extractKeyPrefix(rawKey);

    // Insert to database
    const keyId = insertApiKey({
      user_id: actor.userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: trimmedName,
      permissions: input.permissions,
    });

    // Get the created key
    const dbKeys = dbGetApiKeysByUser(actor.userId);
    const createdKey = dbKeys.find((k) => k.id === keyId);

    if (!createdKey) {
      return fail("INTERNAL", "Failed to retrieve created API key");
    }

    // Log audit event
    void createAuditLog({
      userId: actor.userId,
      event: "api_key_created",
      ipAddress,
      userAgent,
      metadata: {
        keyId,
        keyName: trimmedName,
        keyPrefix,
        permissions: input.permissions,
      },
    });

    // Return with raw key (one-time exposure)
    return ok({
      ...toApiKeyDTO(createdKey),
      raw_key: rawKey,
    });
  } catch (error) {
    console.error("[api-keys] Failed to create API key", error);
    return fail("INTERNAL", "Failed to create API key");
  }
}

/**
 * Revokes an API key by soft delete (ownership-guarded).
 *
 * Sets `is_active = 0` only if the key exists and belongs to the user.
 * Logs an audit event for security tracking.
 *
 * @param actor - Authenticated user context
 * @param input - Revocation parameters (key ID)
 * @param ipAddress - Request IP address for audit log
 * @param userAgent - Request user agent for audit log
 * @returns Service result with revocation confirmation
 *
 * @example
 * ```typescript
 * const result = await revokeApiKey(
 *   { userId: 123 },
 *   { id: 456 },
 *   "127.0.0.1",
 *   "Mozilla/5.0..."
 * );
 * if (result.ok) {
 *   console.log("Key revoked successfully");
 * }
 * ```
 */
export async function revokeApiKey(
  actor: ServiceActor,
  input: RevokeApiKeyInput,
  ipAddress: string,
  userAgent: string
): Promise<Phase4ServiceResult<RevokeApiKeyOutput>> {
  if (!isAuthenticatedActor(actor)) {
    return fail("UNAUTHORIZED", "Authentication required");
  }

  if (!Number.isInteger(input.id) || input.id <= 0) {
    return fail("VALIDATION_ERROR", "id must be a positive integer");
  }

  try {
    // Verify ownership
    const owner = getApiKeyOwnerById(input.id);

    if (!owner) {
      return fail("NOT_FOUND", "API key not found");
    }

    if (owner.user_id !== actor.userId) {
      return fail("FORBIDDEN", "You do not have permission to revoke this API key");
    }

    // Revoke the key
    const result = dbRevokeApiKey(input.id, actor.userId);

    if (result.changes === 0) {
      return fail("NOT_FOUND", "API key not found");
    }

    // Log audit event
    void createAuditLog({
      userId: actor.userId,
      event: "api_key_revoked",
      ipAddress,
      userAgent,
      metadata: {
        keyId: input.id,
      },
    });

    return ok({ revoked: true });
  } catch {
    return fail("INTERNAL", "Failed to revoke API key");
  }
}
