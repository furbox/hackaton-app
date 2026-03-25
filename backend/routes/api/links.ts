import { getSession, type Session } from "../../middleware/auth/index.ts";
import {
  createLink,
  deleteLink,
  getLinks,
  previewLink,
  toggleFavorite,
  toggleLike,
  updateLink,
  type CreateLinkInput,
  type DeleteLinkInput,
  type GetLinksInput,
  type ServiceActor,
  type UpdateLinkInput,
} from "../../services/links.service.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../../contracts/service-error.ts";

const SORT_VALUES = ["recent", "likes", "views", "favorites"] as const;

export interface LinksRouteDeps {
  getSession: (request: Request) => Promise<Session | null>;
  getLinks: (actor: ServiceActor, input?: GetLinksInput) => Phase4ServiceResult<unknown>;
  createLink: (actor: ServiceActor, input: CreateLinkInput) => Phase4ServiceResult<unknown>;
  updateLink: (actor: ServiceActor, input: UpdateLinkInput) => Phase4ServiceResult<unknown>;
  deleteLink: (actor: ServiceActor, input: DeleteLinkInput) => Phase4ServiceResult<unknown>;
  toggleLike: (actor: ServiceActor, linkId: number) => Phase4ServiceResult<unknown>;
  toggleFavorite: (actor: ServiceActor, linkId: number) => Phase4ServiceResult<unknown>;
  previewLink: (input: { url: string }) => Promise<
    Phase4ServiceResult<{
      title: string | null;
      description: string | null;
      image: string | null;
    }>
  >;
}

function defaultDeps(): LinksRouteDeps {
  return {
    getSession,
    getLinks,
    createLink,
    updateLink,
    deleteLink,
    toggleLike,
    toggleFavorite,
    previewLink,
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

async function parseActorRequired(request: Request, deps: LinksRouteDeps): Promise<
  | { ok: true; actor: NonNullable<ServiceActor> }
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

  return { ok: true, actor };
}

function parseLinksId(path: string): number | Response {
  const match = path.match(/^\/api\/links\/([^/]+)$/);
  if (!match) {
    return validationError("id path parameter is required");
  }

  return parsePositiveInt(match[1], "id");
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

function parseCreateLinkInput(body: Record<string, unknown>): CreateLinkInput | Response {
  const { url, title, shortCode, description, isPublic, categoryId } = body;

  if (typeof url !== "string" || typeof title !== "string" || typeof shortCode !== "string") {
    return validationError("url, title and shortCode must be strings");
  }

  if (description !== undefined && description !== null && typeof description !== "string") {
    return validationError("description must be a string or null");
  }

  if (isPublic !== undefined && typeof isPublic !== "boolean") {
    return validationError("isPublic must be a boolean");
  }

  if (categoryId !== undefined && categoryId !== null) {
    if (typeof categoryId !== "number" || !Number.isInteger(categoryId) || categoryId <= 0) {
      return validationError("categoryId must be a positive integer or null");
    }
  }

  const input: CreateLinkInput = {
    url,
    title,
    shortCode,
  };

  if (description !== undefined) {
    input.description = description;
  }
  if (isPublic !== undefined) {
    input.isPublic = isPublic;
  }
  if (categoryId !== undefined) {
    input.categoryId = categoryId;
  }

  return input;
}

function parseUpdateLinkPatch(body: Record<string, unknown>): UpdateLinkInput["patch"] | Response {
  const patch: UpdateLinkInput["patch"] = {};

  if (hasOwn(body, "url")) {
    if (typeof body.url !== "string") {
      return validationError("url must be a string");
    }
    patch.url = body.url;
  }

  if (hasOwn(body, "title")) {
    if (typeof body.title !== "string") {
      return validationError("title must be a string");
    }
    patch.title = body.title;
  }

  if (hasOwn(body, "description")) {
    if (body.description !== null && typeof body.description !== "string") {
      return validationError("description must be a string or null");
    }
    patch.description = body.description;
  }

  if (hasOwn(body, "isPublic")) {
    if (typeof body.isPublic !== "boolean") {
      return validationError("isPublic must be a boolean");
    }
    patch.isPublic = body.isPublic;
  }

  if (hasOwn(body, "categoryId")) {
    if (body.categoryId !== null) {
      if (typeof body.categoryId !== "number" || !Number.isInteger(body.categoryId) || body.categoryId <= 0) {
        return validationError("categoryId must be a positive integer or null");
      }
    }
    patch.categoryId = body.categoryId;
  }

  return patch;
}

function parseGetLinksQuery(url: URL): GetLinksInput | Response {
  const ownerUserIdRaw = url.searchParams.get("ownerUserId");
  const categoryIdRaw = url.searchParams.get("categoryId");
  const sortRaw = url.searchParams.get("sort");
  const pageRaw = url.searchParams.get("page");
  const limitRaw = url.searchParams.get("limit");

  const input: GetLinksInput = {};

  if (ownerUserIdRaw !== null) {
    const parsed = parsePositiveInt(ownerUserIdRaw, "ownerUserId");
    if (parsed instanceof Response) {
      return parsed;
    }
    input.ownerUserId = parsed;
  }

  if (categoryIdRaw !== null) {
    const parsed = parsePositiveInt(categoryIdRaw, "categoryId");
    if (parsed instanceof Response) {
      return parsed;
    }
    input.categoryId = parsed;
  }

  if (sortRaw !== null) {
    if (!SORT_VALUES.includes(sortRaw as (typeof SORT_VALUES)[number])) {
      return validationError("sort must be one of: recent, likes, views, favorites");
    }
    input.sort = sortRaw;
  }

  if (pageRaw !== null) {
    const parsed = parsePositiveInt(pageRaw, "page");
    if (parsed instanceof Response) {
      return parsed;
    }
    input.page = parsed;
  }

  if (limitRaw !== null) {
    const parsed = parsePositiveInt(limitRaw, "limit");
    if (parsed instanceof Response) {
      return parsed;
    }
    input.limit = parsed;
  }

  return input;
}

function responseFromService<T>(result: Phase4ServiceResult<T>, successStatus = 200): Response {
  if (!result.ok) {
    const mapped = mapPhase4ServiceError(result.error);
    return Response.json(mapped.body, { status: mapped.status });
  }

  return Response.json({ data: result.data }, { status: successStatus });
}

function isPhase43PassThrough(method: string, path: string): boolean {
  if (method === "GET" && path === "/api/links/me") {
    return true;
  }

  if (method === "GET" && path === "/api/links/me/favorites") {
    return true;
  }

  if (method === "POST" && path === "/api/links/import") {
    return true;
  }

  if (method === "GET" && /^\/api\/links\/[^/]+$/.test(path)) {
    return true;
  }

  return false;
}

export async function handleLinksRoute(
  request: Request,
  path: string,
  deps?: Partial<LinksRouteDeps>
): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  if (path === "/api/links" && method === "GET") {
    const query = parseGetLinksQuery(new URL(request.url));
    if (query instanceof Response) {
      return query;
    }

    const session = await resolvedDeps.getSession(request);
    const actor = parseActorOptional(session);
    return responseFromService(resolvedDeps.getLinks(actor, query));
  }

  if (path === "/api/links" && method === "POST") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await parseJsonObjectBody(request);
    if (body instanceof Response) {
      return body;
    }

    const input = parseCreateLinkInput(body);
    if (input instanceof Response) {
      return input;
    }

    return responseFromService(resolvedDeps.createLink(actorResult.actor, input), 201);
  }

  if (path === "/api/links/preview" && method === "POST") {
    const body = await parseJsonObjectBody(request);
    if (body instanceof Response) {
      return body;
    }

    if (typeof body.url !== "string") {
      return validationError("url is required and must be a string");
    }

    const result = await resolvedDeps.previewLink({ url: body.url });
    return responseFromService(result);
  }

  if (method === "POST") {
    const interactionMatch = path.match(/^\/api\/links\/([^/]+)\/(like|favorite)$/);
    if (interactionMatch) {
      const id = parsePositiveInt(interactionMatch[1], "id");
      if (id instanceof Response) {
        return id;
      }

      const actorResult = await parseActorRequired(request, resolvedDeps);
      if (!actorResult.ok) {
        return actorResult.response;
      }

      if (interactionMatch[2] === "like") {
        return responseFromService(resolvedDeps.toggleLike(actorResult.actor, id));
      }

      return responseFromService(resolvedDeps.toggleFavorite(actorResult.actor, id));
    }
  }

  if (isPhase43PassThrough(method, path)) {
    return null;
  }

  if ((method === "PUT" || method === "DELETE") && path.startsWith("/api/links/")) {
    const id = parseLinksId(path);
    if (id instanceof Response) {
      return id;
    }

    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    if (method === "PUT") {
      const body = await parseJsonObjectBody(request);
      if (body instanceof Response) {
        return body;
      }

      const patch = parseUpdateLinkPatch(body);
      if (patch instanceof Response) {
        return patch;
      }

      return responseFromService(
        resolvedDeps.updateLink(actorResult.actor, {
          id,
          patch,
        })
      );
    }

    return responseFromService(resolvedDeps.deleteLink(actorResult.actor, { id }));
  }

  return null;
}
