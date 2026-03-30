import { addRoute, listRoutes } from "../router.ts";
import type { Controller } from "../router.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * Definición de ruta para módulos de rutas.
 * Contrato simple type-safe entre módulos y el router core.
 */
export interface RouteDefinition {
  method: HttpMethod;
  pattern: string;
  handler: Controller;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Registra un array de rutas en el router core.
 *
 * Features:
 * - Valida duplicados exactos (mismo method + pattern) y loguea warning
 * - Delega a `addRoute()` del router core (que maneja orden estático vs dinámico)
 * - Centraliza validaciones para fácil debugging
 *
 * @param routes - Array de definiciones de rutas a registrar
 */
export function registerRoutes(routes: RouteDefinition[]): void {
  const registered = listRoutes(); // Get current state for validation

  routes.forEach(({ method, pattern, handler }) => {
    // Validación: detectar duplicados exactos (method + pattern)
    // NOTA: listRoutes() retorna regex.source (con ^ y $), así que normalizamos
    const normalizedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexPattern = `^${normalizedPattern.replace(/\//g, "\\/")}$`;

    const isDuplicate = registered.some(
      (r) => r.method === method && r.pattern === regexPattern
    );

    if (isDuplicate) {
      console.warn(`[routes] Duplicate route detected: ${method} ${pattern}`);
    }

    addRoute(method, pattern, handler);
  });
}

// ─── Module Re-exports ───────────────────────────────────────────────────────

export { publicRoutes } from "./public.routes.ts";
export { authRoutes } from "./auth.routes.ts";
export { dashboardRoutes } from "./dashboard.routes.ts";
export { apiRoutes } from "./api.routes.ts";
