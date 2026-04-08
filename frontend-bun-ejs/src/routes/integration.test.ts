import { describe, test, expect } from "bun:test";
import { listRoutes } from "../router.ts";
import { registerRoutes, publicRoutes, authRoutes, dashboardRoutes, apiRoutes } from "../routes/index.ts";

describe("Route Registration - Integration Tests", () => {
  test("should register all expected routes (37 total)", () => {
    // Registrar todas las rutas
    registerRoutes(publicRoutes);
    registerRoutes(authRoutes);
    registerRoutes(dashboardRoutes);
    registerRoutes(apiRoutes);

    const registered = listRoutes();

    // Verificar cantidad total de rutas
    expect(registered.length).toBeGreaterThanOrEqual(37);
  });

  test("should preserve order: static routes before dynamic routes", () => {
    const registered = listRoutes();

    // Encontrar índices de rutas específicas (usando regex patterns)
    const staticLinksIndex = registered.findIndex(
      (r) => r.method === "GET" && r.pattern === "^\\/dashboard\\/links$"
    );
    const dynamicLinksIndex = registered.findIndex(
      (r) => r.method === "GET" && r.pattern === "^\\/dashboard\\/links\\/([^/]+)$"
    );

    // La ruta estática debe estar antes que la dinámica
    expect(staticLinksIndex).toBeGreaterThanOrEqual(0);
    expect(dynamicLinksIndex).toBeGreaterThanOrEqual(0);
    expect(staticLinksIndex).toBeLessThan(dynamicLinksIndex);
  });

  test("should include all public routes", () => {
    const registered = listRoutes();

    // Verificar rutas públicas clave (usando regex patterns)
    expect(registered.some((r) => r.pattern === "^\\/$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/explore$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/u\\/([^/]+)$" && r.method === "GET")).toBe(true);
  });

  test("should include all auth routes", () => {
    const registered = listRoutes();

    // Verificar rutas de auth clave (usando regex patterns)
    expect(registered.some((r) => r.pattern === "^\\/auth\\/login$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/auth\\/login$" && r.method === "POST")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/auth\\/register$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/auth\\/register$" && r.method === "POST")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/auth\\/logout$" && r.method === "POST")).toBe(true);
  });

  test("should include all dashboard routes", () => {
    const registered = listRoutes();

    // Verificar rutas de dashboard clave (usando regex patterns)
    expect(registered.some((r) => r.pattern === "^\\/dashboard$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/dashboard\\/links$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/dashboard\\/categories$" && r.method === "GET")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/dashboard\\/favorites$" && r.method === "GET")).toBe(true);
  });

  test("should include all API routes", () => {
    const registered = listRoutes();

    // Verificar rutas de API clave (usando regex patterns)
    expect(registered.some((r) => r.pattern === "^\\/links\\/([^/]+)\\/like$" && r.method === "POST")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/links\\/([^/]+)\\/favorite$" && r.method === "POST")).toBe(true);
    expect(registered.some((r) => r.pattern === "^\\/s\\/([^/]+)$" && r.method === "GET")).toBe(true);
  });

  test("should have correct route distribution across modules", () => {
    const registered = listRoutes();

    // Contar rutas por método
    const getRoutes = registered.filter((r) => r.method === "GET").length;
    const postRoutes = registered.filter((r) => r.method === "POST").length;

    // Verificar distribución esperada (aproximada)
    expect(getRoutes).toBeGreaterThanOrEqual(19); // ~19 rutas GET
    expect(postRoutes).toBeGreaterThanOrEqual(13); // ~13 rutas POST
  });

  test("should register routes with correct HTTP methods", () => {
    const registered = listRoutes();

    // Verificar que solo hay GET y POST (no PUT o DELETE en este proyecto)
    const allowedMethods = ["GET", "POST"];
    const invalidMethods = registered.filter((r) => !allowedMethods.includes(r.method));

    expect(invalidMethods.length).toBe(0);
  });
});
