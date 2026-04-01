import {
  createLink,
  deleteLink,
  getLinkById,
  getLinks,
  updateLink,
  type CreateLinkInput,
  type GetLinksInput,
  type UpdateLinkInput,
} from "../../services/links.service.ts";
import {
  MCPForbiddenError,
  MCPInternalError,
  MCPInvalidParamsError,
  type MCPToolContext,
  type MCPToolDefinition,
} from "../types.ts";
import { isRecord, unwrapServiceResult } from "./shared.ts";

// Re-export error classes so existing consumers (tests, categories.ts, search.ts)
// can continue importing them from this module without breaking changes.
export { MCPForbiddenError, MCPInternalError, MCPInvalidParamsError };

type LinkActor = { userId: number };

export interface LinksToolDeps {
  createLink: typeof createLink;
  getLinks: typeof getLinks;
  getLinkById: typeof getLinkById;
  updateLink: typeof updateLink;
  deleteLink: typeof deleteLink;
}

function readActor(context: MCPToolContext): LinkActor {
  return { userId: context.actor.userId };
}

function requireWritePermission(context: MCPToolContext): void {
  if (context.actor.permissions !== "read+write") {
    throw new MCPForbiddenError(
      "Forbidden: this API key does not have write permission",
      { requiredPermission: "read+write" }
    );
  }
}

function parsePositiveInt(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new MCPInvalidParamsError(`Invalid params: '${field}' must be a positive integer`);
  }

  return value as number;
}

function parseOptionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parsePositiveInt(value, field);
}

function parseOptionalNullablePositiveInt(value: unknown, field: string): number | null | undefined {
  if (value === undefined || value === null) {
    return value as null | undefined;
  }

  return parsePositiveInt(value, field);
}

function parseOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new MCPInvalidParamsError(`Invalid params: '${field}' must be a boolean`);
  }

  return value;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new MCPInvalidParamsError(`Invalid params: '${field}' must be a string`);
  }

  return value;
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MCPInvalidParamsError(`Invalid params: '${field}' must be a non-empty string`);
  }

  return value;
}

const allowedSortValues = new Set(["recent", "likes", "views", "favorites"]);

function parseGetLinksInput(input: unknown): GetLinksInput {
  if (input === undefined) {
    return {};
  }

  if (!isRecord(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  const sortValue = parseOptionalString(input.sort, "sort");
  if (sortValue !== undefined && !allowedSortValues.has(sortValue)) {
    throw new MCPInvalidParamsError(
      "Invalid params: 'sort' must be one of recent, likes, views, favorites"
    );
  }

  return {
    ownerUserId: parseOptionalPositiveInt(input.ownerUserId, "ownerUserId"),
    categoryId: parseOptionalPositiveInt(input.categoryId, "categoryId"),
    page: parseOptionalPositiveInt(input.page, "page"),
    limit: parseOptionalPositiveInt(input.limit, "limit"),
    sort: sortValue,
  };
}

function parseCreateLinkInput(input: unknown): CreateLinkInput {
  if (!isRecord(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  const shortCode = parseOptionalString(input.shortCode, "shortCode");

  return {
    url: parseRequiredString(input.url, "url"),
    title: parseRequiredString(input.title, "title"),
    // shortCode omitido cuando no se provee — el servicio debe generarlo
    ...(shortCode !== undefined ? { shortCode } : {}),
    description: parseOptionalString(input.description, "description"),
    isPublic: parseOptionalBoolean(input.isPublic, "isPublic"),
    categoryId: parseOptionalNullablePositiveInt(input.categoryId, "categoryId"),
  } as CreateLinkInput;
}

function parseGetLinkInput(input: unknown): { id: number } {
  if (!isRecord(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  return {
    id: parsePositiveInt(input.id, "id"),
  };
}

function parseUpdateLinkInput(input: unknown): UpdateLinkInput {
  if (!isRecord(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  const patchValue = input.patch;
  if (!isRecord(patchValue) || Object.keys(patchValue).length === 0) {
    throw new MCPInvalidParamsError("Invalid params: 'patch' must be a non-empty object");
  }

  const patch: UpdateLinkInput["patch"] = {};

  if (Object.prototype.hasOwnProperty.call(patchValue, "url")) {
    patch.url = parseRequiredString(patchValue.url, "patch.url");
  }

  if (Object.prototype.hasOwnProperty.call(patchValue, "title")) {
    patch.title = parseRequiredString(patchValue.title, "patch.title");
  }

  if (Object.prototype.hasOwnProperty.call(patchValue, "description")) {
    if (patchValue.description !== null && typeof patchValue.description !== "string") {
      throw new MCPInvalidParamsError("Invalid params: 'patch.description' must be a string or null");
    }
    patch.description = patchValue.description as string | null;
  }

  if (Object.prototype.hasOwnProperty.call(patchValue, "isPublic")) {
    patch.isPublic = parseOptionalBoolean(patchValue.isPublic, "patch.isPublic");
  }

  if (Object.prototype.hasOwnProperty.call(patchValue, "categoryId")) {
    patch.categoryId = parseOptionalNullablePositiveInt(patchValue.categoryId, "patch.categoryId") ?? null;
  }

  if (Object.keys(patch).length === 0) {
    throw new MCPInvalidParamsError("Invalid params: 'patch' must include at least one supported field");
  }

  return {
    id: parsePositiveInt(input.id, "id"),
    patch,
  };
}

function parseDeleteLinkInput(input: unknown): { id: number } {
  if (!isRecord(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  return {
    id: parsePositiveInt(input.id, "id"),
  };
}

export function createLinksTools(
  deps: Partial<LinksToolDeps> = {}
): Record<string, MCPToolDefinition> {
  const resolved: LinksToolDeps = {
    createLink,
    getLinks,
    getLinkById,
    updateLink,
    deleteLink,
    ...deps,
  };

  return {
    create_link: {
      name: "create_link",
      description: "Create a new link owned by the authenticated user",
      inputSchema: {
        type: "object",
        required: ["url", "title"],
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          shortCode: { type: "string" },
          description: { type: "string" },
          isPublic: { type: "boolean" },
          categoryId: { type: "integer", minimum: 1 },
        },
      },
      handler: (input: unknown, context: MCPToolContext) => {
        requireWritePermission(context);
        const parsed = parseCreateLinkInput(input);
        const result = resolved.createLink(readActor(context), parsed);
        return unwrapServiceResult(result);
      },
    },
    get_links: {
      name: "get_links",
      description: "List links visible to the authenticated user",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ownerUserId: { type: "integer", minimum: 1 },
          categoryId: { type: "integer", minimum: 1 },
          sort: {
            type: "string",
            enum: ["recent", "likes", "views", "favorites"],
          },
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1 },
        },
      },
      handler: (input: unknown, context: MCPToolContext) => {
        const parsed = parseGetLinksInput(input);
        const result = resolved.getLinks(readActor(context), parsed);
        return unwrapServiceResult(result);
      },
    },
    get_link: {
      name: "get_link",
      description: "Get a single link by id if visible to the authenticated user",
      inputSchema: {
        type: "object",
        required: ["id"],
        additionalProperties: false,
        properties: {
          id: { type: "integer", minimum: 1 },
        },
      },
      handler: (input: unknown, context: MCPToolContext) => {
        const parsed = parseGetLinkInput(input);
        const result = resolved.getLinkById(readActor(context), parsed.id);
        return unwrapServiceResult(result);
      },
    },
    update_link: {
      name: "update_link",
      description: "Update a link owned by the authenticated user",
      inputSchema: {
        type: "object",
        required: ["id", "patch"],
        additionalProperties: false,
        properties: {
          id: { type: "integer", minimum: 1 },
          patch: {
            type: "object",
            additionalProperties: false,
            properties: {
              url: { type: "string" },
              title: { type: "string" },
              description: { type: ["string", "null"] },
              isPublic: { type: "boolean" },
              categoryId: { type: ["integer", "null"], minimum: 1 },
            },
          },
        },
      },
      handler: (input: unknown, context: MCPToolContext) => {
        requireWritePermission(context);
        const parsed = parseUpdateLinkInput(input);
        const result = resolved.updateLink(readActor(context), parsed);
        return unwrapServiceResult(result);
      },
    },
    delete_link: {
      name: "delete_link",
      description: "Delete a link owned by the authenticated user",
      inputSchema: {
        type: "object",
        required: ["id"],
        additionalProperties: false,
        properties: {
          id: { type: "integer", minimum: 1 },
        },
      },
      handler: (input: unknown, context: MCPToolContext) => {
        requireWritePermission(context);
        const parsed = parseDeleteLinkInput(input);
        const result = resolved.deleteLink(readActor(context), parsed);
        return unwrapServiceResult(result);
      },
    },
  };
}
