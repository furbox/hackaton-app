import { verifyApiKey as serviceVerifyApiKey } from "../services/api-keys.service.ts";
import {
  searchSkillLinks as serviceSearchSkillLinks,
  type SkillSearchActor,
  type SkillSearchInput,
  type SkillSearchOutput,
} from "../services/skill-search.service.ts";
import { extractRequestInfo } from "../services/audit-log.service.ts";
import {
  checkRateLimit as authCheckRateLimit,
  type RateLimitResult,
} from "../routes/api/auth/rate-limit.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../contracts/service-error.ts";
import type { ApiKeyAuthContext } from "../contracts/api-keys.ts";

export interface SkillSearchRouteDeps {
  verifyApiKey: (key: string) => Promise<Phase4ServiceResult<ApiKeyAuthContext>>;
  searchSkillLinks: (
    actor: SkillSearchActor,
    input: SkillSearchInput
  ) => Phase4ServiceResult<SkillSearchOutput>;
  checkRateLimit: (ip: string) => RateLimitResult;
}

function defaultDeps(): SkillSearchRouteDeps {
  return {
    verifyApiKey: serviceVerifyApiKey,
    searchSkillLinks: serviceSearchSkillLinks,
    checkRateLimit: authCheckRateLimit,
  };
}

function validationError(message: string): Response {
  return Response.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    },
    { status: 400 }
  );
}

function unauthorizedError(message: string): Response {
  return Response.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message,
      },
    },
    { status: 401 }
  );
}

function responseFromService<T>(result: Phase4ServiceResult<T>): Response {
  if (!result.ok) {
    const mapped = mapPhase4ServiceError(result.error);
    return Response.json(mapped.body, { status: mapped.status });
  }

  return Response.json({ data: result.data }, { status: 200 });
}

function parsePositiveIntParam(value: string, field: string): number | Response {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return validationError(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeIntParam(value: string, field: string): number | Response {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return validationError(`${field} must be a non-negative integer`);
  }
  return parsed;
}

function parseBearerApiKey(request: Request): { key: string | null; malformed: boolean } {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return { key: null, malformed: false };
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { key: null, malformed: true };
  }

  const candidate = match[1].trim();
  if (!candidate) {
    return { key: null, malformed: true };
  }

  return { key: candidate, malformed: false };
}

export async function handleSkillSearchRoute(
  request: Request,
  path: string,
  deps?: Partial<SkillSearchRouteDeps>
): Promise<Response | null> {
  if (path !== "/api/skill/search") {
    return null;
  }

  if (request.method.toUpperCase() !== "GET") {
    return Response.json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
        },
      },
      { status: 405 }
    );
  }

  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();
  const { ipAddress } = extractRequestInfo(request);
  const rateLimitResult = resolvedDeps.checkRateLimit(ipAddress);

  if (!rateLimitResult.allowed) {
    return Response.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests — please wait before trying again",
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) },
      }
    );
  }

  const auth = parseBearerApiKey(request);
  if (auth.malformed) {
    return unauthorizedError("Invalid Authorization header");
  }

  let actor: SkillSearchActor = null;
  if (auth.key) {
    const authResult = await resolvedDeps.verifyApiKey(auth.key);
    if (!authResult.ok) {
      return unauthorizedError("Invalid API key");
    }

    actor = { userId: authResult.data.user_id };
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q");

  if (typeof q !== "string" || q.trim().length === 0) {
    return validationError("q is required and must be a non-empty string");
  }

  let category_id: number | undefined;
  let user_id: number | undefined;
  let limit: number | undefined;
  let offset: number | undefined;

  const categoryIdRaw = url.searchParams.get("category_id");
  if (categoryIdRaw !== null) {
    const parsed = parsePositiveIntParam(categoryIdRaw, "category_id");
    if (parsed instanceof Response) {
      return parsed;
    }
    category_id = parsed;
  }

  const userIdRaw = url.searchParams.get("user_id");
  if (userIdRaw !== null) {
    const parsed = parsePositiveIntParam(userIdRaw, "user_id");
    if (parsed instanceof Response) {
      return parsed;
    }
    user_id = parsed;
  }

  const limitRaw = url.searchParams.get("limit");
  if (limitRaw !== null) {
    const parsed = parsePositiveIntParam(limitRaw, "limit");
    if (parsed instanceof Response) {
      return parsed;
    }
    limit = parsed;
  }

  const offsetRaw = url.searchParams.get("offset");
  if (offsetRaw !== null) {
    const parsed = parseNonNegativeIntParam(offsetRaw, "offset");
    if (parsed instanceof Response) {
      return parsed;
    }
    offset = parsed;
  }

  return responseFromService(
    resolvedDeps.searchSkillLinks(actor, {
      q,
      category_id,
      user_id,
      limit,
      offset,
    })
  );
}
