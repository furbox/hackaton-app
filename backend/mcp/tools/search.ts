import { searchLinks } from "../../db/queries/search.ts";
import type { MCPToolContext, MCPToolDefinition } from "../types.ts";
import { MCPInternalError, MCPInvalidParamsError } from "./links.ts";

export interface SearchToolDeps {
  searchLinks: typeof searchLinks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePositiveInt(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new MCPInvalidParamsError(`Invalid params: '${field}' must be a positive integer`);
  }

  return value as number;
}

function parseSearchInput(input: unknown): { query: string; categoryId?: number; limit: number } {
  if (!isRecord(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  const query = input.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new MCPInvalidParamsError("Invalid params: 'query' must be a non-empty string");
  }

  const categoryId = input.categoryId === undefined
    ? undefined
    : parsePositiveInt(input.categoryId, "categoryId");

  const limit = input.limit === undefined ? 20 : parsePositiveInt(input.limit, "limit");

  return {
    query: query.trim(),
    categoryId,
    limit: Math.min(100, limit),
  };
}

function toLinkListItemDTO(
  row: ReturnType<typeof searchLinks>[number]
): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    description: row.description,
    shortCode: row.short_code,
    isPublic: row.is_public === 1,
    categoryId: row.category_id,
    views: row.views,
    createdAt: row.created_at,
    likesCount: row.likes_count,
    favoritesCount: row.favorites_count,
  };
}

export function createSearchTools(
  deps: Partial<SearchToolDeps> = {}
): Record<string, MCPToolDefinition> {
  const resolved: SearchToolDeps = {
    searchLinks,
    ...deps,
  };

  return {
    search_links: {
      name: "search_links",
      description: "Search links with FTS5 and return only owner-visible items",
      inputSchema: {
        type: "object",
        required: ["query"],
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          categoryId: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1 },
        },
      },
      handler: (input: unknown, context: MCPToolContext) => {
        const parsed = parseSearchInput(input);

        try {
          const rows = resolved.searchLinks(parsed.query, {
            category_id: parsed.categoryId,
          });

          return {
            items: rows
              .filter((row) => row.user_id === context.actor.userId)
              .slice(0, parsed.limit)
              .map(toLinkListItemDTO),
            limit: parsed.limit,
          };
        } catch {
          throw new MCPInternalError("Failed to search links", {
            serviceCode: "INTERNAL",
          });
        }
      },
    },
  };
}
