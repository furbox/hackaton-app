import { getSession, type Session } from "../../middleware/auth/index.ts";
import {
  createLink,
  deleteLink,
  getFavoriteLinks,
  getLinks,
  getLinksMe,
  getLinkDetailsById,
  importLinks,
  previewLink,
  toggleFavorite,
  toggleLike,
  updateLink,
  type CreateLinkInput,
  type DeleteLinkInput,
  type GetLinksInput,
  type ImportLinksInput,
  type ImportLinksOutput,
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
  getLinksMe: (actor: ServiceActor, input?: { limit?: number }) => Phase4ServiceResult<unknown>;
  getFavoriteLinks: (actor: ServiceActor) => Phase4ServiceResult<unknown>;
  getLinkDetailsById: (actor: ServiceActor, linkId: number) => Phase4ServiceResult<unknown>;
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
  importLinks: (actor: ServiceActor, input: ImportLinksInput) => Phase4ServiceResult<ImportLinksOutput>;
}

function defaultDeps(): LinksRouteDeps {
  return {
    getSession,
    getLinks,
    getLinksMe,
    getFavoriteLinks,
    getLinkDetailsById,
    createLink,
    updateLink,
    deleteLink,
    toggleLike,
    toggleFavorite,
    previewLink,
    importLinks,
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
  const qRaw = url.searchParams.get("q");
  const ownerUserIdRaw = url.searchParams.get("ownerUserId");
  const categoryIdRaw = url.searchParams.get("categoryId");
  const sortRaw = url.searchParams.get("sort");
  const pageRaw = url.searchParams.get("page");
  const limitRaw = url.searchParams.get("limit");

  const input: GetLinksInput = {};

  if (qRaw !== null) {
    input.q = qRaw;
  }

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

function parseImportLinksInput(body: Record<string, unknown>): ImportLinksInput | Response {
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return validationError("items must be a non-empty array");
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!isRecord(item)) {
      return validationError(`items[${i}] must be an object`);
    }

    if (typeof item.url !== "string") {
      return validationError(`items[${i}].url must be a string`);
    }

    if (item.title !== undefined && typeof item.title !== "string") {
      return validationError(`items[${i}].title must be a string when provided`);
    }

    if (item.description !== undefined && item.description !== null && typeof item.description !== "string") {
      return validationError(`items[${i}].description must be a string or null`);
    }

    if (item.category !== undefined && item.category !== null && typeof item.category !== "string") {
      return validationError(`items[${i}].category must be a string or null`);
    }
  }

  return { items: items as ImportLinksInput["items"] };
}

function responseFromService<T>(result: Phase4ServiceResult<T>, successStatus = 200): Response {
  if (!result.ok) {
    const mapped = mapPhase4ServiceError(result.error);
    return Response.json(mapped.body, { status: mapped.status });
  }

  return Response.json({ data: result.data }, { status: successStatus });
}

function isPhase43PassThrough(method: string, path: string): boolean {
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

    // Public explore page - always show only public links, even for authenticated users.
    // This ensures /explore only displays publicly shared content from all users.
    return responseFromService(resolvedDeps.getLinks(null, query));
  }

  if (path === "/api/links/me" && method === "GET") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const input: { limit?: number } = {};

    if (limitRaw !== null) {
      const parsed = parsePositiveInt(limitRaw, "limit");
      if (parsed instanceof Response) {
        return parsed;
      }
      input.limit = parsed;
    }

    return responseFromService(resolvedDeps.getLinksMe(actorResult.actor, input));
  }

  if (path === "/api/links/me/favorites" && method === "GET") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    return responseFromService(resolvedDeps.getFavoriteLinks(actorResult.actor));
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

  if (path === "/api/links/import" && method === "POST") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await parseJsonObjectBody(request);
    if (body instanceof Response) {
      return body;
    }

    const input = parseImportLinksInput(body);
    if (input instanceof Response) {
      return input;
    }

    return responseFromService(resolvedDeps.importLinks(actorResult.actor, input));
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

  // GET /api/links/:id/details - Link details with engagement stats
  if (method === "GET") {
    const detailsMatch = path.match(/^\/api\/links\/([^/]+)\/details$/);
    if (detailsMatch) {
      const id = parsePositiveInt(detailsMatch[1], "id");
      if (id instanceof Response) {
        return id;
      }

      const actorResult = await parseActorRequired(request, resolvedDeps);
      if (!actorResult.ok) {
        return actorResult.response;
      }

      return responseFromService(resolvedDeps.getLinkDetailsById(actorResult.actor, id));
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

      // Parse forceRefresh option
      let forceRefresh: boolean | undefined = undefined;
      if (hasOwn(body, "forceRefresh")) {
        if (typeof body.forceRefresh !== "boolean") {
          return validationError("forceRefresh must be a boolean");
        }
        forceRefresh = body.forceRefresh;
      }

      return responseFromService(
        resolvedDeps.updateLink(actorResult.actor, {
          id,
          patch,
          forceRefresh,
        })
      );
    }

    return responseFromService(resolvedDeps.deleteLink(actorResult.actor, { id }));
  }

  return null;
}
