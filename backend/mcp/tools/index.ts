import type { MCPToolDefinition } from "../types.ts";
import { createCategoriesTools } from "./categories.ts";
import { createLinksTools } from "./links.ts";
import { createSearchTools } from "./search.ts";

export function createMcpToolsRegistry(): Record<string, MCPToolDefinition> {
  return {
    ...createLinksTools(),
    ...createSearchTools(),
    ...createCategoriesTools(),
  };
}
