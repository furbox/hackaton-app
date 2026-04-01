/**
 * API Keys Contracts
 *
 * Shared API key DTOs and service input/output types.
 *
 * @module backend/contracts/api-keys
 */

/**
 * API key data transfer object (excludes sensitive fields).
 */
export interface ApiKeyDTO {
  id: number;
  name: string;
  key_prefix: string; // First 8 chars ONLY (not full key, not hash)
  permissions: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * API key creation DTO (includes raw key for one-time exposure).
 */
export interface ApiKeyCreationDTO extends ApiKeyDTO {
  raw_key: string; // FULL KEY (one-time exposure only)
}

/**
 * Input for creating a new API key.
 */
export interface CreateApiKeyInput {
  name: string;
  permissions: "read" | "read+write";
  expires_at?: string; // ISO 8601 date string (optional)
}

/**
 * Input for revoking an API key.
 */
export interface RevokeApiKeyInput {
  id: number;
}

/**
 * Authentication context resolved from a valid API key.
 */
export interface ApiKeyAuthContext {
  key_id: number;
  user_id: number;
  permissions: "read" | "read+write";
  key_prefix: string;
  expires_at: string | null;
}

/**
 * Output for listing API keys.
 */
export type ListApiKeysOutput = ApiKeyDTO[];

/**
 * Output for creating an API key (includes raw key).
 */
export type CreateApiKeyOutput = ApiKeyCreationDTO;

/**
 * Output for revoking an API key.
 */
export type RevokeApiKeyOutput = { revoked: true };
