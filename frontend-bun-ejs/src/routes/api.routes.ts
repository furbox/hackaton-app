import type { RouteDefinition } from "./index.ts";
import { likeController } from "../controllers/links/like.controller.ts";
import { favoriteController } from "../controllers/links/favorite.controller.ts";
import { shortLinkController } from "../controllers/short-link.controller.ts";
import { previewController } from "../controllers/links/preview.controller.ts";

/**
 * Rutas de API y endpoints especiales.
 *
 * Incluye:
 * - HTMX partials (like, favorite)
 * - Short links proxy
 * - Preview proxy (OG metadata)
 * - Futuros: Web Skill endpoints, MCP server
 */
export const apiRoutes: RouteDefinition[] = [
  // HTMX partials
  { method: "POST", pattern: "/links/:id/like", handler: likeController },
  { method: "POST", pattern: "/links/:id/favorite", handler: favoriteController },

  // Short links proxy
  { method: "GET", pattern: "/s/:code", handler: shortLinkController },

  // Preview proxy (OG metadata)
  { method: "POST", pattern: "/api/links/preview", handler: previewController },
];
