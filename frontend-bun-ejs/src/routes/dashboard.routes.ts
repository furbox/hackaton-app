import type { RouteDefinition } from "./index.ts";
import { dashboardController } from "../controllers/dashboard/index.controller.ts";
import {
  linksGetController,
  linksCreateController,
  linksEditController,
  linksDeleteController,
} from "../controllers/dashboard/links.controller.ts";
import { linkDetailsGetController } from "../controllers/dashboard/link-details.controller.ts";
import {
  categoriesGetController,
  categoriesCreateController,
  categoriesEditController,
  categoriesDeleteController,
} from "../controllers/dashboard/categories.controller.ts";
import { favoritesController } from "../controllers/dashboard/favorites.controller.ts";
import {
  profileGetController,
  profilePostController,
  profilePasswordController,
} from "../controllers/dashboard/profile.controller.ts";
import {
  keysGetController,
  keysCreateController,
  keysDeleteController,
} from "../controllers/dashboard/keys.controller.ts";
import {
  importGetController,
  importPostController,
} from "../controllers/dashboard/import.controller.ts";

/**
 * Rutas del dashboard (requieren autenticación).
 *
 * NOTA IMPORTANTE sobre el orden de rutas:
 * Las rutas estáticas (como `/dashboard/links/create`) deben registrarse
 * ANTES que las rutas dinámicas (como `/dashboard/links/:id`) para evitar
 * que el parámetro capture el path estático.
 *
 * Incluye:
 * - Dashboard home
 * - Links (list, create, view, edit, delete)
 * - Categories (list, create, edit, delete)
 * - Favorites
 * - Profile (view, update, change password)
 * - API Keys (list, create, delete)
 * - Import bookmarks
 */
export const dashboardRoutes: RouteDefinition[] = [
  // Dashboard home
  { method: "GET", pattern: "/dashboard", handler: dashboardController },

  // Links (static paths BEFORE dynamic :id)
  { method: "GET", pattern: "/dashboard/links", handler: linksGetController },
  { method: "POST", pattern: "/dashboard/links/create", handler: linksCreateController },
  { method: "GET", pattern: "/dashboard/links/:id", handler: linkDetailsGetController },
  { method: "POST", pattern: "/dashboard/links/:id/edit", handler: linksEditController },
  { method: "POST", pattern: "/dashboard/links/:id/delete", handler: linksDeleteController },

  // Categories
  { method: "GET", pattern: "/dashboard/categories", handler: categoriesGetController },
  { method: "POST", pattern: "/dashboard/categories/create", handler: categoriesCreateController },
  { method: "POST", pattern: "/dashboard/categories/:id/edit", handler: categoriesEditController },
  { method: "POST", pattern: "/dashboard/categories/:id/delete", handler: categoriesDeleteController },

  // Favorites
  { method: "GET", pattern: "/dashboard/favorites", handler: favoritesController },

  // Profile
  { method: "GET", pattern: "/dashboard/profile", handler: profileGetController },
  { method: "POST", pattern: "/dashboard/profile", handler: profilePostController },
  { method: "POST", pattern: "/dashboard/profile/password", handler: profilePasswordController },

  // API Keys (static paths BEFORE dynamic :id)
  { method: "GET", pattern: "/dashboard/keys", handler: keysGetController },
  { method: "POST", pattern: "/dashboard/keys/create", handler: keysCreateController },
  { method: "POST", pattern: "/dashboard/keys/:id/delete", handler: keysDeleteController },

  // Import
  { method: "GET", pattern: "/dashboard/import", handler: importGetController },
  { method: "POST", pattern: "/dashboard/import", handler: importPostController },
];
