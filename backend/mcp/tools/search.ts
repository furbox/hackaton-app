import { getLinks } from "../../services/links.service.ts";
import type { MCPToolContext, MCPToolDefinition } from "../types.ts";
import { MCPInternalError, MCPInvalidParamsError } from "./links.ts";

export interface SearchToolDeps {
  getLinks: typeof getLinks;
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

export function createSearchTools(
  deps: Partial<SearchToolDeps> = {}
): Record<string, MCPToolDefinition> {
  const resolved: SearchToolDeps = {
    getLinks,
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
          const result = resolved.getLinks(
            { userId: context.actor.userId },
            {
              q: parsed.query,
              ownerUserId: context.actor.userId,
              categoryId: parsed.categoryId,
              page: 1,
              limit: parsed.limit,
              sort: "recent",
            }
          );

          if (!result.ok) {
            throw new MCPInternalError(result.error.message, {
              serviceCode: result.error.code,
              ...(result.error.details ? { details: result.error.details } : {}),
            });
          }

          return {
            items: result.data.items,
            limit: parsed.limit,
          };
        } catch (error) {
          if (error instanceof MCPInternalError) {
            throw error;
          }

          throw new MCPInternalError("Failed to search links", {
            serviceCode: "INTERNAL",
          });
        }
      },
    },
  };
}
