import { getCategories } from "../../services/categories.service.ts";
import type { Phase4ServiceResult } from "../../contracts/service-error.ts";
import type { MCPToolContext, MCPToolDefinition } from "../types.ts";
import { MCPInternalError, MCPInvalidParamsError } from "./links.ts";

export interface CategoriesToolDeps {
  getCategories: typeof getCategories;
}

function unwrapServiceResult<T>(result: Phase4ServiceResult<T>): T {
  if (result.ok) {
    return result.data;
  }

  if (result.error.code === "VALIDATION_ERROR") {
    throw new MCPInvalidParamsError(result.error.message, {
      serviceCode: result.error.code,
      ...(result.error.details ? { details: result.error.details } : {}),
    });
  }

  throw new MCPInternalError(result.error.message, {
    serviceCode: result.error.code,
    ...(result.error.details ? { details: result.error.details } : {}),
  });
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
