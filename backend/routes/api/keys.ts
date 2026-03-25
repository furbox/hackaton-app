import { getSession, type Session } from "../../middleware/auth/index.ts";
import { extractRequestInfo } from "../../services/audit-log.service.ts";
import {
  createApiKey as serviceCreateApiKey,
  listApiKeys as serviceListApiKeys,
  revokeApiKey as serviceRevokeApiKey,
  type ServiceActor,
} from "../../services/api-keys.service.ts";
import {
  type CreateApiKeyInput,
  type RevokeApiKeyInput,
  type ApiKeyDTO,
  type ApiKeyCreationDTO,
  type ListApiKeysOutput,
  type CreateApiKeyOutput,
  type RevokeApiKeyOutput,
} from "../../contracts/api-keys.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../../contracts/service-error.ts";

export interface KeysRouteDeps {
  getSession: (request: Request) => Promise<Session | null>;
  listApiKeys: (actor: ServiceActor) => Phase4ServiceResult<ListApiKeysOutput>;
  createApiKey: (
    actor: ServiceActor,
    input: CreateApiKeyInput,
    ipAddress: string,
    userAgent: string
  ) => Promise<Phase4ServiceResult<CreateApiKeyOutput>>;
  revokeApiKey: (
    actor: ServiceActor,
    input: RevokeApiKeyInput,
    ipAddress: string,
    userAgent: string
  ) => Promise<Phase4ServiceResult<RevokeApiKeyOutput>>;
}

function defaultDeps(): KeysRouteDeps {
  return {
    getSession,
    listApiKeys: serviceListApiKeys,
    createApiKey: serviceCreateApiKey,
    revokeApiKey: serviceRevokeApiKey,
  };
}

function validationError(message: string, details?: Record<string, unknown>): Response {
  return Response.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message,
        ...(details ? { details } : {}),
      },
    },
    { status: 400 }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function unauthorizedError(message = "Authentication required"): Response {
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

function parsePositiveInt(value: string, field: string): number | Response {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return validationError(`${field} must be a positive integer`);
  }
  return parsed;
}

function parseActorOptional(session: Session | null): ServiceActor {
  if (!session) {
    return null;
  }

  const numericUserId = Number(session.user.id);
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    return null;
  }

  return { userId: numericUserId };
}

async function parseActorRequired(request: Request, deps: KeysRouteDeps): Promise<
  | { ok: true; actor: NonNullable<ServiceActor>; requestInfo: { ipAddress: string; userAgent: string } }
  | { ok: false; response: Response }
> {
  const session = await deps.getSession(request);
  if (!session) {
    return { ok: false, response: unauthorizedError() };
  }

  const actor = parseActorOptional(session);
  if (!actor) {
    return {
      ok: false,
      response: unauthorizedError("Invalid session user id"),
    };
  }

  const requestInfo = extractRequestInfo(request);
  return { ok: true, actor, requestInfo };
}

async function parseJsonObjectBody(request: Request): Promise<Record<string, unknown> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!isRecord(body)) {
    return validationError("Body must be a JSON object");
  }

  return body;
}

function parseCreateApiKeyInput(body: Record<string, unknown>): CreateApiKeyInput | Response {
  const { name, permissions } = body;

  if (typeof name !== "string") {
    return validationError("name must be a string");
  }

  if (typeof permissions !== "string") {
    return validationError("permissions must be a string");
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return validationError("name cannot be empty");
  }

  if (trimmedName.length > 100) {
    return validationError("name must be 100 characters or less");
  }

  if (permissions !== "read" && permissions !== "read+write") {
    return validationError("permissions must be 'read' or 'read+write'");
  }

  const input: CreateApiKeyInput = {
    name: trimmedName,
    permissions: permissions as "read" | "read+write",
  };

  // Optional expires_at field
  if (hasOwn(body, "expires_at")) {
    if (typeof body.expires_at !== "string") {
      return validationError("expires_at must be a string");
    }
    input.expires_at = body.expires_at;
  }

  return input;
}

function parseKeyId(path: string): number | Response {
  const match = path.match(/^\/api\/keys\/([^/]+)$/);
  if (!match) {
    return validationError("id path parameter is required");
  }

  return parsePositiveInt(match[1], "id");
}

function responseFromService<T>(result: Phase4ServiceResult<T>, successStatus = 200): Response {
  if (!result.ok) {
    const mapped = mapPhase4ServiceError(result.error);
    return Response.json(mapped.body, { status: mapped.status });
  }

  return Response.json({ data: result.data }, { status: successStatus });
}

export async function handleKeysRoute(
  request: Request,
  path: string,
  deps?: Partial<KeysRouteDeps>
): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // GET /api/keys - List all API keys for authenticated user
  if (path === "/api/keys" && method === "GET") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    return responseFromService(resolvedDeps.listApiKeys(actorResult.actor));
  }

  // POST /api/keys - Create new API key
  if (path === "/api/keys" && method === "POST") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await parseJsonObjectBody(request);
    if (body instanceof Response) {
      return body;
    }

    const input = parseCreateApiKeyInput(body);
    if (input instanceof Response) {
      return input;
    }

    return responseFromService(
      await resolvedDeps.createApiKey(
        actorResult.actor,
        input,
        actorResult.requestInfo.ipAddress,
        actorResult.requestInfo.userAgent
      ),
      201
    );
  }

  // DELETE /api/keys/:id - Revoke API key
  if (method === "DELETE" && path.startsWith("/api/keys/")) {
    const id = parseKeyId(path);
    if (id instanceof Response) {
      return id;
    }

    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    return responseFromService(
      await resolvedDeps.revokeApiKey(
        actorResult.actor,
        { id },
        actorResult.requestInfo.ipAddress,
        actorResult.requestInfo.userAgent
      )
    );
  }

  // Non-matching path - return null for fallthrough
  return null;
}
