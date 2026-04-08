import { getCategories } from "../../services/categories.service.ts";
import type { MCPToolContext, MCPToolDefinition } from "../types.ts";
import { MCPInvalidParamsError } from "./links.ts";
import { unwrapServiceResult } from "./shared.ts";

export interface CategoriesToolDeps {
  getCategories: typeof getCategories;
}

function assertNoInput(input: unknown): void {
  if (input === undefined) {
    return;
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new MCPInvalidParamsError("Invalid params: input must be an object");
  }

  if (Object.keys(input).length > 0) {
    throw new MCPInvalidParamsError("Invalid params: get_categories does not accept input fields");
  }
}

export function createCategoriesTools(
  deps: Partial<CategoriesToolDeps> = {}
): Record<string, MCPToolDefinition> {
  const resolved: CategoriesToolDeps = {
    getCategories,
    ...deps,
  };

  return {
    get_categories: {
      name: "get_categories",
      description: "List categories owned by the authenticated user",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      handler: (input: unknown, context: MCPToolContext) => {
        assertNoInput(input);
        const result = resolved.getCategories({ userId: context.actor.userId });
        return unwrapServiceResult(result);
      },
    },
  };
}
