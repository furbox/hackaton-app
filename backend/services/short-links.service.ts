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
  getLinkByShortCodeVisibleToActor,
  recordLinkVisitAndIncrementViews,
} from "../db/queries/index.js";
import type { Phase4ServiceResult } from "../contracts/service-error.js";

// ============================================================================
// INPUT / OUTPUT TYPES
// ============================================================================

export interface ResolveShortCodeInput {
  code: string;
  ipAddress: string;
  userAgent: string;
  actorUserId?: number;
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
  const link = getLinkByShortCodeVisibleToActor(input.code, input.actorUserId);

  if (!link) {
    const hiddenLink = getLinkByShortCode(input.code);

    if (hiddenLink && hiddenLink.is_public !== 1) {
      return {
        ok: false,
        error: {
          code: input.actorUserId ? "FORBIDDEN" : "UNAUTHORIZED",
          message: input.actorUserId
            ? "You are not allowed to access this short link"
            : "Authentication required to access this short link",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Short link not found",
      },
    };
  }

  // Side effects: persist visit telemetry + increment aggregate views counter.
  recordLinkVisitAndIncrementViews({
    linkId: link.id,
    userId: input.actorUserId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    ok: true,
    data: {
      url: link.url,
      id: link.id,
    },
  };
}
