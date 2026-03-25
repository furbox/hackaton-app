/**
 * Short Link Route Handler
 *
 * Handles GET /api/s/:code → 302 redirect to the original URL.
 * Follows Phase 4 route pattern: HTTP only, injects deps for testability.
 *
 * @module backend/routes/api/short
 */

import {
  resolveShortCode,
  type ResolveShortCodeInput,
  type ResolvedLinkDTO,
} from "../../services/short-links.service.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../../contracts/service-error.ts";

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface ShortRouteDeps {
  resolveShortCode: (
    input: ResolveShortCodeInput
  ) => Phase4ServiceResult<ResolvedLinkDTO>;
}

function defaultDeps(): ShortRouteDeps {
  return { resolveShortCode };
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

/**
 * Handles the GET /api/s/:code short-link redirect route.
 *
 * Returns null for non-matching paths or non-GET methods so the caller
 * can fall through to other handlers.
 *
 * @param request - The incoming HTTP request
 * @param path    - The URL pathname (e.g. "/api/s/abc123")
 * @param deps    - Optional injected dependencies (for testing)
 * @returns 302 redirect on success, 404/400 JSON error, or null for non-match
 */
export async function handleShortRoute(
  request: Request,
  path: string,
  deps?: Partial<ShortRouteDeps>
): Promise<Response | null> {
  const d = { ...defaultDeps(), ...deps };

  // Match: GET /api/s/:code only
  if (request.method !== "GET" || !path.startsWith("/api/s/")) {
    return null;
  }

  // Extract code from path: /api/s/<code>
  const code = path.slice(7); // Remove leading "/api/s/"

  const result = d.resolveShortCode({ code });

  if (result.ok) {
    return Response.redirect(result.data.url, 302);
  }

  const { status, body } = mapPhase4ServiceError(result.error);
  return Response.json(body, { status });
}
