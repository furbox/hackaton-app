import { getSession, type Session } from "../../middleware/auth/index.ts";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type CreateCategoryInput,
  type DeleteCategoryInput,
  type ServiceActor,
  type UpdateCategoryInput,
  type CategoryDTO,
  type CategoryWithLinksCountDTO,
  type GetCategoriesOutput,
} from "../../services/categories.service.ts";
import {
  mapPhase4ServiceError,
  type Phase4ServiceResult,
} from "../../contracts/service-error.ts";

export interface CategoriesRouteDeps {
  getSession: (request: Request) => Promise<Session | null>;
  getCategories: (actor: ServiceActor) => Phase4ServiceResult<GetCategoriesOutput>;
  createCategory: (actor: ServiceActor, input: CreateCategoryInput) => Phase4ServiceResult<CategoryDTO>;
  updateCategory: (actor: ServiceActor, input: UpdateCategoryInput) => Phase4ServiceResult<CategoryDTO>;
  deleteCategory: (actor: ServiceActor, input: DeleteCategoryInput) => Phase4ServiceResult<{ deleted: true }>;
}

function defaultDeps(): CategoriesRouteDeps {
  return {
    getSession,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
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

async function parseActorRequired(request: Request, deps: CategoriesRouteDeps): Promise<
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

function parseCreateCategoryInput(body: Record<string, unknown>): CreateCategoryInput | Response {
  const { name, color } = body;

  if (typeof name !== "string") {
    return validationError("name must be a string");
  }

  if (typeof color !== "string") {
    return validationError("color must be a string");
  }

  const trimmedName = name.trim();
  const trimmedColor = color.trim();

  if (trimmedName.length === 0) {
    return validationError("name cannot be empty");
  }

  if (trimmedName.length > 100) {
    return validationError("name must be 100 characters or less");
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
    return validationError("color must be a valid hex color (e.g., #6366f1)");
  }

  return {
    name: trimmedName,
    color: trimmedColor,
  };
}

function parseUpdateCategoryPatch(body: Record<string, unknown>): UpdateCategoryInput["patch"] | Response {
  const patch: UpdateCategoryInput["patch"] = {};
  let hasField = false;

  if (hasOwn(body, "name")) {
    if (typeof body.name !== "string") {
      return validationError("name must be a string");
    }

    const trimmedName = body.name.trim();
    if (trimmedName.length === 0) {
      return validationError("name cannot be empty");
    }

    if (trimmedName.length > 100) {
      return validationError("name must be 100 characters or less");
    }

    patch.name = trimmedName;
    hasField = true;
  }

  if (hasOwn(body, "color")) {
    if (typeof body.color !== "string") {
      return validationError("color must be a string");
    }

    const trimmedColor = body.color.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
      return validationError("color must be a valid hex color (e.g., #6366f1)");
    }

    patch.color = trimmedColor;
    hasField = true;
  }

  if (!hasField) {
    return validationError("at least one field (name or color) must be provided");
  }

  return patch;
}

function parseCategoryId(path: string): number | Response {
  const match = path.match(/^\/api\/categories\/([^/]+)$/);
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

export async function handleCategoriesRoute(
  request: Request,
  path: string,
  deps?: Partial<CategoriesRouteDeps>
): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const resolvedDeps = deps ? { ...defaultDeps(), ...deps } : defaultDeps();

  // GET /api/categories - List all categories for authenticated user
  if (path === "/api/categories" && method === "GET") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    return responseFromService(resolvedDeps.getCategories(actorResult.actor));
  }

  // POST /api/categories - Create new category
  if (path === "/api/categories" && method === "POST") {
    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await parseJsonObjectBody(request);
    if (body instanceof Response) {
      return body;
    }

    const input = parseCreateCategoryInput(body);
    if (input instanceof Response) {
      return input;
    }

    return responseFromService(resolvedDeps.createCategory(actorResult.actor, input), 201);
  }

  // PUT /api/categories/:id - Update category
  if (method === "PUT" && path.startsWith("/api/categories/")) {
    const id = parseCategoryId(path);
    if (id instanceof Response) {
      return id;
    }

    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    const body = await parseJsonObjectBody(request);
    if (body instanceof Response) {
      return body;
    }

    const patch = parseUpdateCategoryPatch(body);
    if (patch instanceof Response) {
      return patch;
    }

    return responseFromService(
      resolvedDeps.updateCategory(actorResult.actor, {
        id,
        patch,
      })
    );
  }

  // DELETE /api/categories/:id - Delete category
  if (method === "DELETE" && path.startsWith("/api/categories/")) {
    const id = parseCategoryId(path);
    if (id instanceof Response) {
      return id;
    }

    const actorResult = await parseActorRequired(request, resolvedDeps);
    if (!actorResult.ok) {
      return actorResult.response;
    }

    return responseFromService(resolvedDeps.deleteCategory(actorResult.actor, { id }));
  }

  // Non-matching path - return null for fallthrough
  return null;
}
