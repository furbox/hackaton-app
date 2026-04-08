import type { RouteDefinition } from "./index.ts";
import { homeController } from "../controllers/home.controller.ts";
import { exploreController } from "../controllers/explore.controller.ts";
import { behindScenesController } from "../controllers/behind-scenes.controller.ts";
import { tecnologiaController } from "../controllers/tecnologia.controller.ts";
import { profileController } from "../controllers/profile.controller.ts";
import { privacidadController } from "../controllers/privacidad.controller.ts";
import { terminosController } from "../controllers/terminos.controller.ts";
import { sobreController } from "../controllers/sobre.controller.ts";

/**
 * Rutas públicas del sitio.
 *
 * Incluye:
 * - Home page
 * - Explore
 * - Páginas informativas (behind scenes, tecnología, sobre, legal)
 * - Perfiles públicos de usuario
 */
export const publicRoutes: RouteDefinition[] = [
  { method: "GET", pattern: "/", handler: homeController },
  { method: "GET", pattern: "/explore", handler: exploreController },
  { method: "GET", pattern: "/como-lo-hice", handler: behindScenesController },
  { method: "GET", pattern: "/tecnologia", handler: tecnologiaController },
  { method: "GET", pattern: "/u/:username", handler: profileController },
  { method: "GET", pattern: "/privacidad", handler: privacidadController },
  { method: "GET", pattern: "/terminos", handler: terminosController },
  { method: "GET", pattern: "/sobre", handler: sobreController },
];
