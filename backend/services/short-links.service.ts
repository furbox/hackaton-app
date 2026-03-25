/**
 * Short Links Service
 *
 * Business logic for resolving short codes to their original URLs.
 * Follows Phase 4 service pattern: typed args, no Request/Response, sync.
 *
 * @module backend/services/short-links.service
 */

import {
  getLinkByShortCode,
  incrementViews,
} from "../db/queries/index.js";
import type { Phase4ServiceResult } from "../contracts/service-error.js";

// ============================================================================
// INPUT / OUTPUT TYPES
// ============================================================================

export interface ResolveShortCodeInput {
  code: string;
}

export type ResolvedLinkDTO = {
  url: string;
  id: number;
};

// ============================================================================
// SERVICE FUNCTION
// ============================================================================

/**
 * Resolves a short code to its original URL and increments the view count.
 *
 * Validation rules:
 * - Empty or blank code → VALIDATION_ERROR
 *
 * Lookup rules:
 * - Unknown code → NOT_FOUND
 *
 * Side effect (on success):
 * - Atomically increments the view counter for the resolved link
 *
 * @param input - Contains the short code to resolve
 * @returns Phase4ServiceResult with url + id on success, or a typed error
 */
export function resolveShortCode(
  input: ResolveShortCodeInput
): Phase4ServiceResult<ResolvedLinkDTO> {
  // Validate: empty or blank code
  if (!input.code || input.code.trim().length === 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Short code cannot be empty",
      },
    };
  }

  // Lookup
  const link = getLinkByShortCode(input.code);

  if (!link) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Short link not found",
      },
    };
  }

  // Side effect: increment view count (bun:sqlite is sync — no await needed)
  incrementViews(link.id);

  return {
    ok: true,
    data: {
      url: link.url,
      id: link.id,
    },
  };
}
